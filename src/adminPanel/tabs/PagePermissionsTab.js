// src/adminPanel/tabs/PagePermissionsTab.js
// DİKKAT: useCallback import'u eklendi!
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
    Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
    TableContainer, Toolbar, Chip, Switch, Tooltip, IconButton, Button,
    CircularProgress, TextField, InputAdornment, Stack, Select, MenuItem, FormControl, InputLabel
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from '@mui/icons-material/Visibility'; // Sayfa Erişim İkonu

import { supabase } from "../../supabaseClient";
import { APP_PAGES } from "../../routes/pages"; // Bu dosyanın dışarıdan geldiği varsayılıyor

/** Yardımcılar */
function normalizePath(path) {
    if (!path) return "/";
    let s = String(path).trim().toLowerCase();
    if (!s.startsWith("/")) s = "/" + s;
    s = s.replace(/\/+$/g, "");
    if (s === "") s = "/";
    return s;
}

/** * GÜNCEL KATEGORİLEME MANTIĞI: Yeni eklenen "/raporlar/sefer-tamamlayan" yolu, 
 * p.startsWith("/raporlar/") kuralına uyduğu için Raporlar kategorisine dahil edilir.
 */
function getCategoryByPath(path) {
    const p = normalizePath(path);

    // Genel
    if (p === "/anasayfa") return "Genel";

    // Kullanıcı İşlemleri (Eski /sefer-tamamlayan path'i bu listeye dahildi,
    // ancak şu anki yeni path'i (/raporlar/sefer-tamamlayan) Raporlar'a taşınmıştır.)
    if (
        p.startsWith("/planlama") ||
        ["/plaka-onerisi", "/siparisler", "/siparis-analiz"].includes(p) ||
        p.startsWith("/aktifseferler") || p === "/seferler" ||
        p.startsWith("/tamamlanan-seferler")
    ) return "Kullanıcı İşlemleri";

    // Araç Yönetimi
    if (p.startsWith("/arac/")) return "Araç Yönetimi";

    // Görevler
    if (p.startsWith("/gorevler/")) return "Görevler";

    // Hakedişler
    if (p.startsWith("/hakedis/")) return "Hakedişler";

    // Raporlar (Yeni ekranlar dahil)
    if (p.startsWith("/raporlar/")) return "Raporlar";

    // Yönetim (Admin)
    if (p === "/admin" || p.startsWith("/admin/")) return "Yönetim";

    return "Diğer";
}

function pathToColumn(path) {
    const s = normalizePath(path).replace(/^\//, "");
    const core = s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return "p_" + (core || "anasayfa");
}

const PAGE_COLUMNS = APP_PAGES.map((p) => ({
    title: p.title,
    path: normalizePath(p.path),
    col: pathToColumn(p.path),
    category: getCategoryByPath(p.path),
}));

async function upsertUserPageAccess(rows) {
    const { error, data } = await supabase
        .from("user_page_access")
        .upsert(rows, { onConflict: "user_id" })
        .select();
    if (error) throw error;
    return data;
}

export default function PagePermissionsTab() {
    const cols = useMemo(() => PAGE_COLUMNS, []);

    // Kategori State Yönetimi
    const categories = useMemo(() => {
        const set = new Set(cols.map(c => c.category));
        return Array.from(set);
    }, [cols]);

    // Varsayılan kategoriyi "Raporlar" olarak ayarlayabiliriz, çünkü en son oraya ekleme yaptık.
    const initialCategory = categories.includes("Raporlar")
        ? "Raporlar"
        : (cols[0]?.category || "Genel");

    const [category, setCategory] = useState(initialCategory);

    const visibleCols = useMemo(() => {
        return cols.filter(c => c.category === category);
    }, [cols, category]);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [q, setQ] = useState("");

    /** ---- Veri yükleme (useCallback kullanıldı) ---- */
    const load = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Kullanıcıları yükle
            const { data: users, error: e1 } = await supabase
                .from("login")
                .select("id, kullanici, kullaniciAdi, rol")
                .order("kullaniciAdi", { ascending: true });
            if (e1) throw e1;

            // 2. Sayfa erişim yetkilerini yükle
            const { data: accessRows, error: e2 } = await supabase
                .from("user_page_access")
                .select("*");
            if (e2) throw e2;

            const byUser = new Map((accessRows || []).map((r) => [String(r.user_id), r]));

            // 3. Kullanıcı ve yetki verilerini birleştir
            const uiRows = (users || []).map((u) => {
                const dbRow = byUser.get(String(u.id)) || {};
                const base = {
                    user_id: Number(u.id),
                    name: u.kullaniciAdi || u.kullanici || "",
                    kullanici: u.kullanici || "",
                    rol: u.rol || "",
                    _hasRow: !!byUser.get(String(u.id)),
                };
                // Dinamik olarak tüm yetki sütunlarını ekle
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
    }, [cols]);

    // 'load' bağımlılık olarak eklendi.
    useEffect(() => { load(); }, [load]);

    /** ---- Etkileşimler ---- */
    const toggle = (user_id, col) => {
        setRows((prev) =>
            prev.map((r) => (r.user_id === user_id ? { ...r, [col]: !r[col] } : r))
        );
        setDirty(true);
    };

    const toggleRow = (user_id, value) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.user_id !== user_id) return r;
                const next = { ...r };
                // Sadece görünür sütunları (mevcut kategori) değiştirir
                visibleCols.forEach(({ col }) => { next[col] = value; });
                return next;
            })
        );
        setDirty(true);
    };

    const clearRow = (user_id) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.user_id !== user_id) return r;
                const next = { ...r };
                // Tüm sütunları (tüm kategoriler) sıfırlar
                cols.forEach(({ col }) => { next[col] = false; });
                return next;
            })
        );
        setDirty(true);
    };

    const save = async () => {
        try {
            setSaving(true);
            const payload = rows.map((r) => {
                const obj = { user_id: Number(r.user_id), updated_at: new Date().toISOString() };
                // Yeni eklenen sütunlar dahil, tüm sütunları payload'a dahil eder.
                cols.forEach(({ col }) => { obj[col] = !!r[col]; });
                return obj;
            });

            if (!payload.length) { setSaving(false); return; }
            await upsertUserPageAccess(payload); // Kaydetme işlemi
            setDirty(false);
            await load(); // Veriyi yeniden yükle
        } catch (e) {
            console.error("save user_page_access error:", e);
            alert("Kaydetme hatası: " + (e?.message || e));
        } finally {
            setSaving(false);
        }
    };

    /** ---- Arama filtresi ---- */
    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return rows;
        return rows.filter((r) =>
            [r.name, r.kullanici, r.rol].some((v) => String(v || "").toLowerCase().includes(needle))
        );
    }, [rows, q]);

    return (
        <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
            {/* Toolbar: Daha düzenli ve gruplanmış aksiyonlar */}
            <Toolbar
                sx={{
                    gap: 2, px: 2, py: 1.5,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                }}
            >
                <Typography variant="h6" component="div" fontWeight={600}>Sayfa Erişim Yönetimi</Typography>

                <Stack direction="row" spacing={2} ml="auto" alignItems="center">
                    {/* Kategori Seçici (Modern Select) */}
                    <FormControl size="small" sx={{ width: 200 }}>
                        <InputLabel id="category-select-label">Sayfa Kategorisi</InputLabel>
                        <Select
                            labelId="category-select-label"
                            value={category}
                            label="Sayfa Kategorisi"
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            {categories.map(cat => (
                                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Arama */}
                    <TextField
                        size="small"
                        placeholder="Kullanıcı/Rol ara..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
                        sx={{ width: 250 }}
                    />
                </Stack>

                <Chip size="small" label={`Toplam Kullanıcı: ${filtered.length}`} />

                <Tooltip title="Yenile">
                    <span>
                        <IconButton onClick={() => load()} disabled={loading || saving} size="small">
                            {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                        </IconButton>
                    </span>
                </Tooltip>

                <Button
                    startIcon={<SaveIcon />}
                    onClick={save}
                    disabled={!dirty || saving || loading}
                    variant="contained"
                    color="primary"
                    size="small"
                >
                    {saving ? "Kaydediliyor…" : "Kaydet"}
                </Button>
            </Toolbar>

            {/* Tablo: Daha minimalist stil */}
            <TableContainer sx={{ maxHeight: 600 }}>
                <Table
                    stickyHeader
                    size="small"
                    // Tabloya genel bir görünüm veriyor (ör. daha az yoğun borderlar)
                    sx={{
                        '& .MuiTableCell-root': { borderRight: (t) => `1px solid ${t.palette.divider}` },
                        '& .MuiTableCell-head': { bgcolor: (t) => t.palette.action.hover, fontWeight: 700 },
                    }}
                >
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ minWidth: 200, maxWidth: 250 }}>Kullanıcı</TableCell>
                            <TableCell sx={{ width: 150 }}>Rol</TableCell>
                            {/* Başlıklar: Daha kompakt, sadece isimler, path Tooltip'te */}
                            {visibleCols.map(({ col, title, path }) => (
                                <Tooltip title={`Sayfa Yolu: ${path}`} placement="top" key={col}>
                                    <TableCell
                                        align="center"
                                        sx={{
                                            maxWidth: 100,
                                            p: 0.5, // Daha kompakt
                                            fontWeight: 600,
                                        }}
                                    >
                                        <Stack
                                            direction="column"
                                            alignItems="center"
                                            justifyContent="center"
                                        >
                                            <VisibilityIcon fontSize="small" sx={{ mb: 0.5, color: (t) => t.palette.primary.main }} />
                                            <Typography variant="caption" fontWeight={600} lineHeight={1.2}>
                                                {title}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                </Tooltip>
                            ))}
                            <TableCell align="center" sx={{ width: 150 }}>Satır İşlemleri</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {loading || filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2 + visibleCols.length + 1}>
                                    <Box sx={{ py: 3, textAlign: "center", opacity: loading ? 1 : 0.7 }}>
                                        {loading ? <CircularProgress size={20} /> : "Gösterilecek sonuç yok."}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((r) => (
                                <TableRow
                                    key={r.user_id}
                                    // Zebra Satırlar
                                    sx={{
                                        "&:nth-of-type(odd)": {
                                            bgcolor: (t) => t.palette.action.hover,
                                        },
                                    }}
                                >
                                    <TableCell>
                                        <Typography fontWeight={600}>{r.name || "-"}</Typography>
                                        {r.kullanici && (
                                            <Typography variant="caption" color="text.secondary">{r.kullanici}</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={r.rol || "Tanımsız"} size="small" variant="outlined" />
                                    </TableCell>

                                    {/* Yetki Switch'leri */}
                                    {visibleCols.map(({ col }) => (
                                        <TableCell key={col} align="center">
                                            <Switch
                                                size="small"
                                                checked={!!r[col]}
                                                onChange={() => toggle(r.user_id, col)}
                                                // Yetki durumu görselleştirme: true=success, false/null=error
                                                color={r[col] ? "success" : "error"}
                                            />
                                        </TableCell>
                                    ))}

                                    {/* Kullanıcı bazlı tümünü aç/kapat butonları */}
                                    <TableCell align="center">
                                        <Stack direction="row" spacing={0} justifyContent="center" alignItems="center">
                                            <Tooltip title={`Bu kategorideki (${category}) tüm sayfalara erişimi AÇ (True)`}>
                                                <IconButton size="small" onClick={() => toggleRow(r.user_id, true)} color="success">
                                                    <CheckIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>

                                            <Tooltip title={`Bu kategorideki (${category}) tüm sayfalara erişimi KAPAT (False)`}>
                                                <IconButton size="small" onClick={() => toggleRow(r.user_id, false)} color="error">
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>

                                            <Tooltip title="TÜM sayfa erişimlerini KAPAT/Sıfırla (Tüm Kategoriler)">
                                                <IconButton size="small" onClick={() => clearRow(r.user_id)} color="primary">
                                                    <RestartAltIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
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
