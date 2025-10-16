// src/adminPanel/tabs/PagePermissionsTab.js
import React, { useEffect, useMemo, useState } from "react";
import {
    Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
    TableContainer, Toolbar, Chip, Switch, Tooltip, IconButton, Button,
    CircularProgress, TextField, InputAdornment, Stack
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import { supabase } from "../../supabaseClient";
import { APP_PAGES } from "../../routes/pages";

/** Yardımcılar */
function normalizePath(path) {
    if (!path) return "/";
    let s = String(path).trim().toLowerCase();
    if (!s.startsWith("/")) s = "/" + s;
    s = s.replace(/\/+$/g, "");
    if (s === "") s = "/";
    return s;
}

function pathToColumn(path) {
    // "/hakedis/arac-cari-ve-fiyat" -> "p_hakedis_arac_cari_ve_fiyat"
    const s = normalizePath(path).replace(/^\//, "");
    const core = s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return "p_" + (core || "anasayfa");
}

/** APP_PAGES → [{ title, path, col }] (DB kolonları ile bire bir) */
const PAGE_COLUMNS = APP_PAGES.map((p) => ({
    title: p.title,
    path: normalizePath(p.path),
    col: pathToColumn(p.path),
}));

async function upsertUserPageAccess(rows) {
    const { error, data } = await supabase
        .from("user_page_access")
        .upsert(rows, { onConflict: "user_id" }) // user_id PK/UNIQUE olmalı
        .select(); // temsil döndür (debug için yararlı)
    if (error) throw error;
    return data;
}

export default function PagePermissionsTab() {
    const [rows, setRows] = useState([]);       // [{ user_id, name, kullanici, rol, p_*... }]
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [q, setQ] = useState("");

    const cols = useMemo(() => PAGE_COLUMNS, []);

    const load = async () => {
        setLoading(true);
        try {
            // 1) login kullanıcıları
            const { data: users, error: e1 } = await supabase
                .from("login")
                .select("id, kullanici, kullaniciAdi, rol")
                .order("kullaniciAdi", { ascending: true });
            if (e1) throw e1;

            // 2) mevcut user_page_access satırları
            const { data: accessRows, error: e2 } = await supabase
                .from("user_page_access")
                .select("*");
            if (e2) throw e2;

            const byUser = new Map((accessRows || []).map((r) => [String(r.user_id), r]));

            // 3) UI satırları: tüm boolean kolonları doldur
            const uiRows = (users || []).map((u) => {
                const dbRow = byUser.get(String(u.id)) || {};
                const base = {
                    user_id: Number(u.id),                               // BIGINT
                    name: u.kullaniciAdi || u.kullanici || "",
                    kullanici: u.kullanici || "",
                    rol: u.rol || "",
                    _hasRow: !!byUser.get(String(u.id)),
                };
                cols.forEach(({ col }) => { base[col] = dbRow[col] ?? false; });
                return base;
            });

            setRows(uiRows);
            setDirty(false);
        } catch (e) {
            console.error("user_page_access load error:", e);
            alert("Sayfa erişimleri yüklenemedi: " + (e?.message || e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []); // ilk yükleme

    const toggle = (user_id, col) => {
        setRows((prev) =>
            prev.map((r) => (r.user_id === user_id ? { ...r, [col]: !r[col] } : r))
        );
        setDirty(true);
    };

    // Kullanıcının tüm sayfa izinlerini false'a çek
    const clearRow = (user_id) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.user_id !== user_id) return r;
                const next = { ...r };
                cols.forEach(({ col }) => { next[col] = false; });
                return next;
            })
        );
        setDirty(true);
    };

    const save = async () => {
        try {
            setSaving(true);

            // user_id başına tek obje (tüm boolean kolonlar)
            const payload = rows.map((r) => {
                const obj = { user_id: Number(r.user_id), updated_at: new Date().toISOString() };
                cols.forEach(({ col }) => { obj[col] = !!r[col]; });
                return obj;
            });

            if (!payload.length) { setSaving(false); return; }

            // Debug yardımcıları:
            // console.log("[UPA] payload sample:", payload[0]);

            const data = await upsertUserPageAccess(payload);
            // console.log("[UPA] upsert result:", data);

            setDirty(false);
            await load();
        } catch (e) {
            console.error("save user_page_access error:", {
                message: e?.message,
                code: e?.code,
                details: e?.details,
                hint: e?.hint,
                error: e,
            });
            alert("Kaydetme hatası: " + (e?.message || e));
        } finally {
            setSaving(false);
        }
    };

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return rows;
        return rows.filter((r) =>
            [r.name, r.kullanici, r.rol].some((v) => String(v || "").toLowerCase().includes(needle))
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
                <Typography variant="subtitle1" fontWeight={800}>Kullanıcı Ekranları (Sayfa Erişimleri)</Typography>

                <TextField
                    size="small"
                    placeholder="Ara: ad soyad, kullanıcı, rol…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
                    sx={{ width: 320, ml: "auto" }}
                />

                <Chip size="small" label={`Kullanıcı: ${filtered.length}`} />

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
                            <TableCell sx={{ fontWeight: 800, width: 240 }}>Ad Soyad</TableCell>
                            <TableCell sx={{ fontWeight: 800, width: 160 }}>Rol</TableCell>
                            {cols.map(({ col, title, path }) => (
                                <TableCell key={col} sx={{ fontWeight: 800 }}>
                                    {title}
                                    <Typography variant="caption" sx={{ display: "block", opacity: 0.6 }}>{path}</Typography>
                                </TableCell>
                            ))}
                            <TableCell align="right" sx={{ width: 90, fontWeight: 800 }}>İşlem</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={2 + cols.length + 1}>
                                    <Box sx={{ py: 3, display: "flex", gap: 1, alignItems: "center", justifyContent: "center" }}>
                                        <CircularProgress size={20} />
                                        <Typography>Yükleniyor…</Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2 + cols.length + 1}>
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
                                    <TableCell>
                                        <Stack spacing={0.25}>
                                            <Typography fontWeight={800}>{r.name || "-"}</Typography>
                                            {r.kullanici && (
                                                <Typography variant="caption" sx={{ opacity: 0.7 }}>{r.kullanici}</Typography>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{r.rol || "-"}</TableCell>

                                    {cols.map(({ col }) => (
                                        <TableCell key={col}>
                                            <Switch
                                                size="small"
                                                checked={!!r[col]}
                                                onChange={() => toggle(r.user_id, col)}
                                            />
                                        </TableCell>
                                    ))}

                                    <TableCell align="right">
                                        <Tooltip title="Bu kullanıcının tüm sayfa izinlerini kapat">
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
