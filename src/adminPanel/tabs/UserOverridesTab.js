// src/adminPanel/tabs/UserOverridesTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import {
    Box,
    Paper,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableContainer,
    Toolbar,
    Chip,
    Switch,
    Tooltip,
    IconButton,
    Button,
    CircularProgress,
    TextField,
    InputAdornment,
    Stack,              // <-- eklendi
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

/** İzin anahtarları (user_permissions & role_permissions ile aynı) */
const PERM_KEYS = [
    { key: "can_sync", label: "Senkronize" },
    { key: "can_edit", label: "Sefer Düzenle" },
    { key: "can_eta", label: "ETA Gör" },
    { key: "may_open_edit", label: "Editörü Aç" },
    { key: "may_open_eta", label: "ETA Paneli Aç" },
];

/** Bazı projelerde upsert sonrası 406 alınabiliyor: fallback .select() */
async function safeUpsert(table, payload, onConflict) {
    const { error } = await supabase.from(table).upsert(payload, { onConflict });
    if (!error) return;
    if (String(error.code) === "406") {
        const { error: e2 } = await supabase.from(table).upsert(payload, { onConflict }).select();
        if (e2) throw e2;
        return;
    }
    throw error;
}

export default function UserOverridesTab() {
    const [rows, setRows] = useState([]); // [{user_id, username, name, email, rol, ...permKeys, _hasOverride, _clear}]
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [q, setQ] = useState("");

    const load = async () => {
        setLoading(true);
        try {
            // 1) Tüm kullanıcılar
            const { data: users, error: e1 } = await supabase
                .from("login")
                .select("id, kullaniciAdi, kullanici, email, rol")
                .order("kullaniciAdi", { ascending: true });
            if (e1) throw e1;

            // 2) Mevcut kullanıcı overrides
            const { data: ovrs, error: e2 } = await supabase
                .from("user_permissions")
                .select("user_id, can_sync, can_edit, can_eta, may_open_edit, may_open_eta");
            if (e2) throw e2;

            const byUser = new Map((ovrs || []).map((o) => [String(o.user_id), o]));

            const uiRows = (users || []).map((u) => {
                const o = byUser.get(String(u.id));
                return {
                    user_id: u.id,
                    username: u.kullaniciAdi || "",
                    name: u.kullanici || "",
                    email: u.email || "",
                    rol: u.rol || "",
                    // override değer varsa al, yoksa null (inherit)
                    can_sync: o?.can_sync ?? null,
                    can_edit: o?.can_edit ?? null,
                    can_eta: o?.can_eta ?? null,
                    may_open_edit: o?.may_open_edit ?? null,
                    may_open_eta: o?.may_open_eta ?? null,
                    _hasOverride: !!o,
                    _clear: false,
                };
            });

            setRows(uiRows);
            setDirty(false);
        } catch (e) {
            console.error("user_permissions load error:", e);
            alert("Kullanıcı yetkileri yüklenemedi: " + (e?.message || e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const toggle = (user_id, key) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.user_id !== user_id) return r;
                const current = r[key];
                // null (inherit) -> true, true -> false, false -> true (senin tercihin)
                const next = current === true ? false : true;
                return { ...r, [key]: next, _hasOverride: true, _clear: false };
            })
        );
        setDirty(true);
    };

    const clearRow = (user_id) => {
        // bu kullanıcı için tüm override’ları sıfırla (inherit)
        setRows((prev) =>
            prev.map((r) =>
                r.user_id === user_id
                    ? {
                        ...r,
                        can_sync: null,
                        can_edit: null,
                        can_eta: null,
                        may_open_edit: null,
                        may_open_eta: null,
                        _hasOverride: false,
                        _clear: true, // save’de delete çalıştıracağız
                    }
                    : r
            )
        );
        setDirty(true);
    };

    const save = async () => {
        try {
            setSaving(true);

            const toDelete = rows.filter((r) => r._clear).map((r) => r.user_id);
            const toUpsert = rows
                .filter((r) => !r._clear)
                .filter((r) => {
                    // en az bir alan true/false ise override satırı yaz
                    return PERM_KEYS.some((p) => r[p.key] === true || r[p.key] === false);
                })
                .map((r) => ({
                    user_id: r.user_id,
                    can_sync: r.can_sync,
                    can_edit: r.can_edit,
                    can_eta: r.can_eta,
                    may_open_edit: r.may_open_edit,
                    may_open_eta: r.may_open_eta,
                    updated_at: new Date().toISOString(),
                }));

            // 1) Sıfırlanacakları sil
            if (toDelete.length) {
                const { error: delErr } = await supabase
                    .from("user_permissions")
                    .delete()
                    .in("user_id", toDelete);
                if (delErr) throw delErr;
            }

            // 2) Upsert
            if (toUpsert.length) {
                await safeUpsert("user_permissions", toUpsert, "user_id");
            }

            setDirty(false);
            await load();
        } catch (e) {
            console.error("save user overrides error:", e);
            alert("Kaydetme hatası: " + (e?.message || e));
        } finally {
            setSaving(false);
        }
    };

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return rows;
        return rows.filter((r) =>
            [r.username, r.name, r.email, r.rol]
                .map((v) => String(v || "").toLowerCase())
                .some((s) => s.includes(needle))
        );
    }, [rows, q]);

    return (
        <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
            <Toolbar
                sx={{
                    gap: 1,
                    px: 2,
                    py: 1.5,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                }}
            >
                <Typography variant="subtitle1" fontWeight={800} sx={{ mr: "auto" }}>
                    Kullanıcı Bazlı Yetkiler (Overrides)
                </Typography>

                <TextField
                    size="small"
                    placeholder="Ara: kullanıcı, ad soyad, e-posta, rol…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ width: 340 }}
                />

                <Chip size="small" label={`Kullanıcı: ${filtered.length}`} />

                <Tooltip title="Yenile">
                    <span>
                        <IconButton onClick={load} disabled={loading || saving}>
                            {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                        </IconButton>
                    </span>
                </Tooltip>

                <Button
                    startIcon={<SaveIcon />}
                    onClick={save}
                    disabled={!dirty || saving || loading}
                    variant="contained"
                    size="small"
                >
                    {saving ? "Kaydediliyor…" : "Kaydet"}
                </Button>
            </Toolbar>

            <TableContainer sx={{ maxHeight: 560 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 260, fontWeight: 800 }}>Kullanıcı</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Ad Soyad</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>E-posta</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Rol</TableCell>
                            {PERM_KEYS.map((p) => (
                                <TableCell key={p.key} sx={{ fontWeight: 800 }}>
                                    {p.label}
                                </TableCell>
                            ))}
                            <TableCell align="right" sx={{ width: 90, fontWeight: 800 }}>
                                İşlem
                            </TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4 + PERM_KEYS.length + 1}>
                                    <Box
                                        sx={{
                                            py: 3,
                                            display: "flex",
                                            gap: 1,
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <CircularProgress size={20} />
                                        <Typography>Yükleniyor…</Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4 + PERM_KEYS.length + 1}>
                                    <Box sx={{ py: 4, textAlign: "center", opacity: 0.7 }}>Sonuç yok.</Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((r) => (
                                <TableRow
                                    key={r.user_id}
                                    sx={{
                                        "&:nth-of-type(2n) td": {
                                            bgcolor: (t) =>
                                                t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                                        },
                                    }}
                                >
                                    <TableCell>
                                        <Typography fontWeight={800}>{r.username || "-"}</Typography>
                                    </TableCell>
                                    <TableCell>{r.name || "-"}</TableCell>
                                    <TableCell>{r.email || "-"}</TableCell>
                                    <TableCell>{r.rol || "-"}</TableCell>

                                    {PERM_KEYS.map((p) => {
                                        const val = r[p.key]; // true | false | null
                                        const checked = val === true; // null -> false görünür
                                        const isInherited = val === null;
                                        return (
                                            <TableCell key={p.key}>
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <Switch
                                                        size="small"
                                                        checked={checked}
                                                        onChange={() => toggle(r.user_id, p.key)}
                                                    />
                                                    {isInherited && (
                                                        <Typography variant="caption" sx={{ opacity: 0.55 }}>
                                                            (miras)
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </TableCell>
                                        );
                                    })}

                                    <TableCell align="right">
                                        <Tooltip title="Varsayılana sıfırla (override sil)">
                                            <span>
                                                <IconButton size="small" onClick={() => clearRow(r.user_id)}>
                                                    <RestartAltIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}
