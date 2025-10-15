// src/adminPanel/tabs/UserOverridesTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import {
    Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
    TableContainer, Toolbar, Chip, Switch, Tooltip, IconButton, Button,
    CircularProgress, TextField, InputAdornment, Stack, FormControl, InputLabel,
    Select, MenuItem,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

/** EKRANLAR */
const SCREENS = [
    { key: "aktif_seferler", name: "Aktif Seferler" },
    { key: "planlama", name: "Planlama" },
    { key: "arac_durumlari", name: "Araç Durumları" },
    { key: "arac_yonetimi", name: "Araç Yönetimi" },
    { key: "kesinti_yonetimi", name: "Kesinti Yönetimi" },
    { key: "tedarikci_masraf", name: "Tedarikçi Masraf" },
    { key: "arac_cari_fiyat", name: "Araç ve Cari Fiyat" },
    { key: "hakedis_seferleri", name: "Hakediş Seferleri" },
    { key: "izin_yonetimi", name: "İzin Yönetimi" },
];

/** Ekrana göre (tek tabloda) gerçek kolonlar */
const PERM_KEYS_BY_SCREEN = {
    aktif_seferler: [
        { key: "aktif_can_sync", label: "Senkronize" },
        { key: "aktif_can_edit", label: "Sefer Düzenle" },
        { key: "aktif_can_eta", label: "ETA Gör" },
        { key: "aktif_may_open_edit", label: "Editörü Aç" },
        { key: "aktif_may_open_eta", label: "ETA Paneli Aç" },
    ],
    planlama: [
        { key: "pln_update", label: "Güncelle" },
        { key: "pln_save", label: "Kaydet" },
        { key: "pln_export_excel", label: "Excel Aktar" },
        { key: "pln_import_excel", label: "Dosya İçe Aktar" },
    ],
    arac_durumlari: [
        { key: "adur_create", label: "Yeni Kayıt Oluştur" },
        { key: "adur_edit", label: "Kayıt Düzenle" },
        { key: "adur_delete", label: "Kayıt Sil" },
    ],
    arac_yonetimi: [
        { key: "ayon_create", label: "Yeni Kayıt Oluştur" },
        { key: "ayon_edit", label: "Kayıt Düzenle" },
        { key: "ayon_delete", label: "Kayıt Sil" },
    ],
    kesinti_yonetimi: [
        { key: "kes_create", label: "Yeni Kayıt Oluştur" },
        { key: "kes_edit", label: "Kayıt Düzenle" },
        { key: "kes_delete", label: "Kayıt Sil" },
    ],
    tedarikci_masraf: [
        { key: "tdm_create", label: "Yeni Kayıt Oluştur" },
        { key: "tdm_edit", label: "Kayıt Düzenle" },
        { key: "tdm_delete", label: "Kayıt Sil" },
        { key: "tdm_may_open_edit", label: "Masrafı Onayla" },
    ],
    arac_cari_fiyat: [
        { key: "acf_create", label: "Yeni Kayıt Oluştur" },
        { key: "acf_edit", label: "Kayıt Düzenle" },
        { key: "acf_delete", label: "Kayıt Sil" },
    ],
    hakedis_seferleri: [{ key: "hks_upload", label: "Dosya Yükle" }],
    izin_yonetimi: [
        { key: "izin_create", label: "Yeni Kayıt Oluştur" },
        { key: "izin_edit", label: "Kayıt Düzenle" },
        { key: "izin_delete", label: "Kayıt Sil" },
    ],
};

/** Tablo gerçek kolon seti */
const USER_PERMISSIONS_COLUMNS = new Set([
    "id", "user_id", "updated_at",
    "aktif_can_sync", "aktif_can_edit", "aktif_can_eta", "aktif_may_open_edit", "aktif_may_open_eta",
    "pln_update", "pln_save", "pln_export_excel", "pln_import_excel",
    "adur_create", "adur_edit", "adur_delete",
    "ayon_create", "ayon_edit", "ayon_delete",
    "kes_create", "kes_edit", "kes_delete",
    "tdm_create", "tdm_edit", "tdm_delete", "tdm_may_open_edit",
    "acf_create", "acf_edit", "acf_delete",
    "hks_upload",
    // İZİN YÖNETİMİ — eklendi
    "izin_create", "izin_edit", "izin_delete",
]);

async function upsertUserPermissions(rows) {
    const { error } = await supabase
        .from("user_permissions")
        .upsert(rows, { onConflict: "user_id" });
    if (!error) return;
    if (String(error.code) === "406") {
        const { error: e2 } = await supabase
            .from("user_permissions")
            .upsert(rows, { onConflict: "user_id" })
            .select();
        if (!e2) return;
        throw e2;
    }
    throw error;
}

export default function UserOverridesTab() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [q, setQ] = useState("");

    const [selectedScreen, setSelectedScreen] = useState(SCREENS[0].key);
    const permKeys = PERM_KEYS_BY_SCREEN[selectedScreen] || [];

    const allowedKeysForScreen = useMemo(
        () => permKeys.filter((p) => USER_PERMISSIONS_COLUMNS.has(p.key)).map((p) => p.key),
        [permKeys]
    );
    const overridesSupported = allowedKeysForScreen.length > 0;

    const load = async () => {
        setLoading(true);
        try {
            const { data: users, error: e1 } = await supabase
                .from("login")
                .select("id, kullanici, rol")
                .order("kullanici", { ascending: true });
            if (e1) throw e1;

            const { data: ovrs, error: e2 } = await supabase
                .from("user_permissions")
                .select("*");
            if (e2) throw e2;

            const byUser = new Map((ovrs || []).map((o) => [String(o.user_id), o]));

            const uiRows = (users || []).map((u) => {
                const o = byUser.get(String(u.id)) || {};
                const base = {
                    user_id: u.id,
                    name: u.kullanici || "",
                    rol: u.rol || "",
                    _hasOverride: !!byUser.get(String(u.id)),
                    _clear: false,
                };
                permKeys.forEach((p) => { base[p.key] = (o[p.key] ?? null); });
                return base;
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

    useEffect(() => { load(); }, [selectedScreen]);

    const toggle = (user_id, key) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.user_id !== user_id) return r;
                const current = r[key];
                const next = current === true ? false : true; // null->true, true->false, false->true
                return { ...r, [key]: next, _hasOverride: true, _clear: false };
            })
        );
        setDirty(true);
    };

    // Sadece seçili ekrana ait alanları null'a çeker
    const clearRow = (user_id) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.user_id !== user_id) return r;
                const next = { ...r, _hasOverride: true, _clear: true };
                permKeys.forEach((p) => { next[p.key] = null; });
                return next;
            })
        );
        setDirty(true);
    };

    const save = async () => {
        try {
            setSaving(true);

            // Bu ekrana ait alanları (true/false/null) net şekilde gönder
            const toUpsert = rows.map((r) => {
                const obj = { user_id: r.user_id, updated_at: new Date().toISOString() };
                allowedKeysForScreen.forEach((k) => {
                    if (r[k] === true || r[k] === false || r[k] === null) obj[k] = r[k];
                });
                return obj;
            });

            // Aynı user_id için tek obje kalsın
            const merged = new Map();
            for (const o of toUpsert) {
                const prev = merged.get(o.user_id) || { user_id: o.user_id, updated_at: o.updated_at };
                merged.set(o.user_id, { ...prev, ...o });
            }

            const payload = Array.from(merged.values());
            if (payload.length) {
                await upsertUserPermissions(payload); // onConflict: 'user_id'
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
            [r.name, r.rol].map((v) => String(v || "").toLowerCase()).some((s) => s.includes(needle))
        );
    }, [rows, q]);

    return (
        <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
            <Toolbar
                sx={{
                    gap: 1, px: 2, py: 1.5,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                }}
            >
                <Typography variant="subtitle1" fontWeight={800}>Kullanıcı Bazlı Yetkiler (Overrides)</Typography>

                <FormControl size="small" sx={{ minWidth: 220, ml: 2 }}>
                    <InputLabel id="screen-select-label">Ekran</InputLabel>
                    <Select
                        labelId="screen-select-label"
                        value={selectedScreen}
                        label="Ekran"
                        onChange={(e) => setSelectedScreen(e.target.value)}
                        disabled={saving}
                    >
                        {SCREENS.map((s) => <MenuItem key={s.key} value={s.key}>{s.name}</MenuItem>)}
                    </Select>
                </FormControl>

                <TextField
                    size="small"
                    placeholder="Ara: ad soyad, rol…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
                    sx={{ width: 300, ml: "auto" }}
                />

                <Chip size="small" label={`Kullanıcı: ${filtered.length}`} />

                {!overridesSupported && (
                    <Chip size="small" color="warning" variant="outlined" label="Bu ekranda kullanıcı bazlı kolon yok (role geçerli)" />
                )}

                <Tooltip title="Yenile">
                    <span>
                        <IconButton onClick={() => load()} disabled={loading || saving}>
                            {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                        </IconButton>
                    </span>
                </Tooltip>

                <Button
                    startIcon={<SaveIcon />}
                    onClick={save}
                    disabled={!dirty || saving || loading || !overridesSupported}
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
                            <TableCell sx={{ fontWeight: 800, width: 260 }}>Ad Soyad</TableCell>
                            <TableCell sx={{ fontWeight: 800, width: 160 }}>Rol</TableCell>
                            {permKeys.map((p) => (<TableCell key={p.key} sx={{ fontWeight: 800 }}>{p.label}</TableCell>))}
                            <TableCell align="right" sx={{ width: 90, fontWeight: 800 }}>İşlem</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={2 + permKeys.length + 1}>
                                    <Box sx={{ py: 3, display: "flex", gap: 1, alignItems: "center", justifyContent: "center" }}>
                                        <CircularProgress size={20} />
                                        <Typography>Yükleniyor…</Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2 + permKeys.length + 1}>
                                    <Box sx={{ py: 4, textAlign: "center", opacity: 0.7 }}>Sonuç yok.</Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((r) => (
                                <TableRow
                                    key={r.user_id}
                                    sx={{
                                        "&:nth-of-type(2n) td": {
                                            bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                                        },
                                    }}
                                >
                                    <TableCell><Typography fontWeight={800}>{r.name || "-"}</Typography></TableCell>
                                    <TableCell>{r.rol || "-"}</TableCell>

                                    {permKeys.map((p) => {
                                        const val = r[p.key]; // true | false | null
                                        const checked = val === true;
                                        const isInherited = val === null;
                                        const isAllowed = USER_PERMISSIONS_COLUMNS.has(p.key);
                                        return (
                                            <TableCell key={p.key}>
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <Tooltip title={isAllowed ? "" : "Bu alan user_permissions tablosunda yok."}>
                                                        <span>
                                                            <Switch
                                                                size="small"
                                                                checked={checked}
                                                                onChange={() => toggle(r.user_id, p.key)}
                                                                disabled={!isAllowed}
                                                            />
                                                        </span>
                                                    </Tooltip>
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
                                        <Tooltip title="Varsayılana (null) çek — sadece bu ekranın alanları">
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
