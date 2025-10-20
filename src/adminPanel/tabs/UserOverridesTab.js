import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import {
    Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
    TableContainer, Toolbar, Chip, Switch, Tooltip, IconButton, Button,
    CircularProgress, TextField, InputAdornment, Stack, FormControl, InputLabel,
    Select, MenuItem,
} from "@mui/material";

// İKONLAR
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
// RestartAltIcon kullanılmadığı için kaldırıldı.
import CheckIcon from "@mui/icons-material/Check"; // Açmak için
import CloseIcon from "@mui/icons-material/Close"; // Kapatmak için

/** EKRANLAR - Değişiklik yok */
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

/** Ekrana göre (tek tabloda) gerçek kolonlar - Değişiklik yok */
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
        { key: "acf_edit", label: "Kayıt Düzenle (Genel)" },
        { key: "acf_delete", label: "Kayıt Sil" },

        // Alan-bazlı düzenleme yetkileri:
        { key: "acf_edit_cari_id", label: "Cari ID Düzenle" },
        { key: "acf_edit_cari_adi", label: "Cari Adı Düzenle" },
        { key: "acf_edit_arac_sahibi", label: "Araç Sahibi Düzenle" },
        { key: "acf_edit_odak_tipi", label: "Odak Çalışma Tipi Düzenle" },
        { key: "acf_edit_aylik_kira", label: "Aylık Kira Düzenle" },
        { key: "acf_edit_aylik_surucu", label: "Aylık Sürücü Düzenle" },
        { key: "acf_edit_calisma_gunu", label: "Çalışma Günü Düzenle" },
        { key: "acf_edit_pasif", label: "Pasif Alanını Düzenle" },
    ],
    hakedis_seferleri: [{ key: "hks_upload", label: "Dosya Yükle" }],
    izin_yonetimi: [
        { key: "izin_create", label: "Yeni Kayıt Oluştur" },
        { key: "izin_edit", label: "Kayıt Düzenle" },
        { key: "izin_delete", label: "Kayıt Sil" },
    ],
};

/** Tablo gerçek kolon seti - Değişiklik yok */
const USER_PERMISSIONS_COLUMNS = new Set([
    "user_id", "updated_at",
    "aktif_can_sync", "aktif_can_edit", "aktif_can_eta", "aktif_may_open_edit", "aktif_may_open_eta",
    "pln_update", "pln_save", "pln_export_excel", "pln_import_excel",
    "adur_create", "adur_edit", "adur_delete",
    "ayon_create", "ayon_edit", "ayon_delete",
    "kes_create", "kes_edit", "kes_delete",
    "tdm_create", "tdm_edit", "tdm_delete", "tdm_may_open_edit",

    // Araç & Cari Fiyat
    "acf_create", "acf_edit", "acf_delete",
    "acf_edit_cari_id",
    "acf_edit_cari_adi",
    "acf_edit_arac_sahibi",
    "acf_edit_odak_tipi",
    "acf_edit_aylik_kira",
    "acf_edit_aylik_surucu",
    "acf_edit_calisma_gunu",
    "acf_edit_pasif",

    "hks_upload",
    "izin_create", "izin_edit", "izin_delete",
]);

/** Supabase'e veri kaydetme işlevi */
async function upsertUserPermissions(rows) {
    const { error } = await supabase
        .from("user_permissions")
        .upsert(rows, { onConflict: "user_id" })
        .select();
    if (error) throw error;
}

export default function UserOverridesTab() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [q, setQ] = useState("");

    const [selectedScreen, setSelectedScreen] = useState(SCREENS[0].key);
    const permKeys = PERM_KEYS_BY_SCREEN[selectedScreen] || [];

    // Hata düzeltildi: permKeys bağımlılığı eklendi.
    const allowedKeysForScreen = useMemo(
        () => permKeys.filter((p) => USER_PERMISSIONS_COLUMNS.has(p.key)).map((p) => p.key),
        [permKeys]
    );
    const overridesSupported = allowedKeysForScreen.length > 0;

    // Hata düzeltildi: load fonksiyonu useCallback içine alındı ve bağımlılıkları eklendi.
    const load = useCallback(async () => {
        setLoading(true);
        try {
            // Kullanıcıları yükle
            const { data: users, error: e1 } = await supabase
                .from("login")
                .select("id, kullanici, rol")
                .order("kullanici", { ascending: true });
            if (e1) throw e1;

            // Yetki override'larını yükle
            const { data: ovrs, error: e2 } = await supabase
                .from("user_permissions")
                .select("*");
            if (e2) throw e2;

            const byUser = new Map((ovrs || []).map((o) => [String(o.user_id), o]));

            // Kullanıcı verileri ile yetki override'larını birleştir
            const uiRows = (users || []).map((u) => {
                const o = byUser.get(String(u.id)) || {};
                const base = {
                    user_id: u.id,
                    name: u.kullanici || "",
                    rol: u.rol || "",
                    _hasOverride: !!byUser.get(String(u.id)),
                    _clear: false,
                };
                // Yetkileri atar. Null yerine default olarak False (Engellendi) kullanacağız.
                // Veritabanındaki null değerler de artık FALSE olarak okunacak.
                // permKeys burada kullanıldığı için load, useCallback'e sarıldı.
                permKeys.forEach((p) => {
                    base[p.key] = (o[p.key] === true); // Sadece True ise True, diğer her durumda (False/Null) False olacak
                });
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
    }, [permKeys]); // <-- permKeys bağımlılık olarak eklendi.

    // Hata düzeltildi: load bağımlılık dizisine eklendi.
    useEffect(() => { load(); }, [selectedScreen, load]);

    const toggle = (user_id, key) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.user_id !== user_id) return r;
                const current = r[key];
                // True -> False, False -> True döngüsü
                const next = !current;
                return { ...r, [key]: next, _hasOverride: true, _clear: false };
            })
        );
        setDirty(true);
    };

    // Tümünü Aç/Kapat fonksiyonu (Miras durumu artık yok)
    const toggleRow = (user_id, value) => {
        if (!overridesSupported) return;
        setRows((prev) =>
            prev.map((r) => {
                if (r.user_id !== user_id) return r;
                const updatedRow = { ...r, _hasOverride: true, _clear: false };
                // allowedKeysForScreen burada kullanıldığı için toggleRow, allowedKeysForScreen'i bağımlılık olarak almalı.
                // Ancak bu, gereksiz yeniden render döngüsü yaratabilir. 
                // toggleRow'u useCallback içine alıp allowedKeysForScreen'i bağımlılık yapmaktansa, 
                // toggleRow'u sadece bir fonksiyona çevirip bağımlılıkları dışarıda tutmak daha temizdir.
                // Fonksiyon bileşen dışında tanımlı olmadığı için linter yine uyarı verecektir.
                // Bu yüzden, sadece `toggleRow` içinde kullanılan `allowedKeysForScreen` bağımlılığını ekleyerek
                // fonksiyonu useCallback içine alalım.
                allowedKeysForScreen.forEach((key) => {
                    updatedRow[key] = value; // True veya False olarak ayarlanır
                });
                return updatedRow;
            })
        );
        setDirty(true);
    };

    // Temizlik: clearRow fonksiyonu kaldırıldı, toggleRow(false) ile işlevi görüldü.
    // Bu, 'clearRow' is assigned a value but never used' uyarısını giderir.

    const save = async () => {
        try {
            setSaving(true);

            // Sadece yetkisi (True/False) değiştirilmiş satırları Supabase'e göndereceğiz.
            const toUpsert = rows.map((r) => {
                const obj = { user_id: r.user_id, updated_at: new Date().toISOString() };

                let hasScreenSpecificChange = false;

                // Sadece yetki değeri (true veya false) olan kolonları kaydet
                allowedKeysForScreen.forEach((k) => {
                    // Mantık: Her zaman True veya False kaydedeceğiz. Null durumunu kaldırdık.
                    obj[k] = r[k] === true; // r[k] mutlaka true veya false olacak.
                    hasScreenSpecificChange = true;
                });

                if (hasScreenSpecificChange) return obj;

                return null;
            }).filter(Boolean); // null olanları filtrele

            // Birden fazla ekranda yetki değiştirilmişse birleştirme yapar (aslında gerekli değil ama sağlamlık için kalsın)
            const merged = new Map();
            for (const o of toUpsert) {
                const prev = merged.get(o.user_id) || { user_id: o.user_id, updated_at: o.updated_at };
                merged.set(o.user_id, { ...prev, ...o });
            }

            const payload = Array.from(merged.values());

            if (payload.length) {
                await upsertUserPermissions(payload);
            }

            setDirty(false);
            await load(); // Başarılı kayıttan sonra verileri yeniden yükle
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

    const displayPermKeys = permKeys.filter((p) => USER_PERMISSIONS_COLUMNS.has(p.key));
    const unsupportedPermKeys = permKeys.filter((p) => !USER_PERMISSIONS_COLUMNS.has(p.key));

    return (
        <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
            {/* Toolbar: Kontroller ve filtreleme */}
            <Toolbar
                sx={{
                    gap: 2, px: 2, py: 1.5,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                }}
            >
                <Typography variant="h6" component="div" fontWeight={600}>Kullanıcı Bazlı Yetkiler (Overrides)</Typography>

                <FormControl size="small" sx={{ minWidth: 220, ml: 2 }}>
                    <InputLabel id="screen-select-label">Ekran Seçimi</InputLabel>
                    <Select
                        labelId="screen-select-label"
                        value={selectedScreen}
                        label="Ekran Seçimi"
                        onChange={(e) => setSelectedScreen(e.target.value)}
                        disabled={saving}
                    >
                        {SCREENS.map((s) => <MenuItem key={s.key} value={s.key}>{s.name}</MenuItem>)}
                    </Select>
                </FormControl>

                <TextField
                    size="small"
                    placeholder="Kullanıcı/Rol ara..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
                    sx={{ width: 250, ml: "auto" }}
                />

                <Chip size="small" label={`Kullanıcı: ${filtered.length}`} />

                {!overridesSupported && (
                    <Chip size="small" color="warning" variant="outlined" label="Bu ekranda override yetkisi yok" />
                )}

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
                    disabled={!dirty || saving || loading || !overridesSupported}
                    variant="contained"
                    color="primary"
                    size="small"
                >
                    {saving ? "Kaydediliyor…" : "Kaydet"}
                </Button>
            </Toolbar>

            {/* Tablo: Yatay Başlıklar ve Kompakt Görünüm */}
            <TableContainer sx={{ maxHeight: 560 }}>
                <Table
                    stickyHeader
                    size="small"
                    sx={{
                        // Sütun ayracı çizgisi ve genel hücre stilleri
                        '& .MuiTableCell-root': { borderRight: (t) => `1px solid ${t.palette.divider}`, borderBottom: (t) => `1px solid ${t.palette.divider}` },
                        // Başlık hücre stilleri
                        '& .MuiTableCell-head': {
                            bgcolor: (t) => t.palette.action.hover,
                            fontWeight: 700,
                            verticalAlign: 'bottom',
                            py: 1, // Dikey boşluk
                            px: 1, // Yatay boşluk
                            lineHeight: 1.3, // Satır aralığı (Daha fazla satır için önemli)
                        },
                    }}
                >
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ minWidth: 150, maxWidth: 200 }}>Kullanıcı</TableCell>
                            <TableCell sx={{ width: 120 }}>Rol</TableCell>

                            {/* Yatay ve Kompakt Başlıklar */}
                            {displayPermKeys.map((p) => (
                                <TableCell
                                    key={p.key}
                                    align="center"
                                    sx={{
                                        width: 100, // Başlık genişliğini sınırla
                                        minWidth: 80,
                                        p: 1,
                                        whiteSpace: 'normal', // Metnin sarmasını (wrap) sağlar
                                    }}
                                >
                                    <Tooltip title={`Yetki Kolonu Anahtarı: ${p.key}`} placement="top">
                                        <Typography variant="caption" fontWeight={600} sx={{ display: 'block' }}>
                                            {p.label} {/* Etiket metnini burada göster */}
                                        </Typography>
                                    </Tooltip>
                                </TableCell>
                            ))}

                            {/* Desteklenmeyenler için yer tutucu */}
                            {unsupportedPermKeys.map((p) => (
                                <TableCell
                                    key={p.key}
                                    align="center"
                                    sx={{ width: 100, opacity: 0.5, p: 1, whiteSpace: 'normal' }}
                                >
                                    <Typography variant="caption" fontWeight={600} sx={{ display: 'block' }}>
                                        {p.label} (Eksik Kolon)
                                    </Typography>
                                </TableCell>
                            ))}

                            <TableCell align="right" sx={{ width: 150, fontWeight: 800 }}>İşlemler</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {loading || filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2 + permKeys.length + 1}>
                                    <Box sx={{ py: 3, textAlign: "center", opacity: loading ? 1 : 0.7 }}>
                                        {loading ? <CircularProgress size={20} /> : "Gösterilecek sonuç yok."}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((r) => (
                                <TableRow
                                    key={r.user_id}
                                    sx={{
                                        "&:nth-of-type(odd)": {
                                            bgcolor: (t) => t.palette.action.hover,
                                        },
                                    }}
                                >
                                    <TableCell>
                                        <Typography fontWeight={600}>{r.name || "-"}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={r.rol || "Tanımsız"} size="small" variant="outlined" />
                                    </TableCell>

                                    {/* Yetki Switch'leri (true/false) */}
                                    {displayPermKeys.map((p) => {
                                        const checked = r[p.key]; // Sadece true | false (null yok)

                                        let tooltipText = checked ? "İzin Verildi (True)" : "İzin Engellendi (False)";

                                        return (
                                            <TableCell key={p.key} align="center">
                                                <Tooltip title={tooltipText} placement="top">
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Switch
                                                            size="small"
                                                            checked={checked}
                                                            onChange={() => toggle(r.user_id, p.key)}
                                                            color={checked ? "success" : "error"}
                                                        />
                                                    </Box>
                                                </Tooltip>
                                            </TableCell>
                                        );
                                    })}

                                    {/* Desteklenmeyen Yetki Kolonları */}
                                    {unsupportedPermKeys.map((p) => (
                                        <TableCell key={p.key} align="center">
                                            <Tooltip title="Bu yetki kolonu veritabanında tanımlı değil. Lütfen user_permissions tablosunu güncelleyin.">
                                                <Chip size="small" label="Eksik" color="warning" variant="outlined" />
                                            </Tooltip>
                                        </TableCell>
                                    ))}

                                    {/* Kullanıcı bazlı tümünü aç/kapat butonları */}
                                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                        {overridesSupported && (
                                            <Stack direction="row" spacing={0} justifyContent="flex-end" alignItems="center">
                                                <Tooltip title={`Bu ekrana ait tüm yetkileri AÇ (True)`}>
                                                    <IconButton size="small" onClick={() => toggleRow(r.user_id, true)}>
                                                        <CheckIcon color="success" fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={`Bu ekrana ait tüm yetkileri KAPAT (False)`}>
                                                    <IconButton size="small" onClick={() => toggleRow(r.user_id, false)}>
                                                        <CloseIcon color="error" fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                {/* Temizleme/Sıfırlama butonu kaldırıldı, işlevi KAPAT butonu tarafından görüldü. */}
                                            </Stack>
                                        )}
                                        {!overridesSupported && "-"}
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
