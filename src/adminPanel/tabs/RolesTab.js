// src/adminPanel/tabs/RolesTab.js
// DİKKAT: useCallback import'u eklendi!
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import {
    Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
    TableContainer, Toolbar, Chip, Switch, Tooltip, IconButton, Button,
    CircularProgress, FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";

/** APP'in tanıdığı sabit roller (key = diakritiksiz) */
const ROLES = [
    { key: "YONETICI", name: "YÖNETİCİ" },
    { key: "OPERASYON", name: "OPERASYON" },
    { key: "TAKIP", name: "TAKİP" },
];

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
    { key: "izin_yonetimi", name: "İzin Yönetimi" }, // eklendi
];

/** role_permissions tablosundaki GERÇEK kolon isimleri — user_permissions ile BİREBİR */
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
    hakedis_seferleri: [
        { key: "hks_upload", label: "Dosya Yükle" },
    ],
    izin_yonetimi: [
        { key: "izin_create", label: "Yeni Kayıt Oluştur" },
        { key: "izin_edit", label: "Kayıt Düzenle" },
        { key: "izin_delete", label: "Kayıt Sil" },
    ],
};

/** roles tablosunda ROLES yoksa ekler */
async function ensureRolesExist() {
    const payload = ROLES.map((r) => ({ key: r.key, name: r.name }));
    const { error } = await supabase.from("roles").upsert(payload, { onConflict: "key" });
    if (error) throw error;
}

/** roles -> Map(key => {id,key,name}) */
async function fetchRoleMap() {
    const { data, error } = await supabase.from("roles").select("id,key,name");
    if (error) throw error;
    const byKey = new Map();
    (data || []).forEach((r) => byKey.set(r.key, { id: r.id, key: r.key, name: r.name }));
    return byKey;
}

/** role_permissions: Map(role_id => row) — sadece seçili ekran için */
async function fetchRolePermissions(screenKey) {
    const { data, error } = await supabase.from("role_permissions").select("*").eq("screen_key", screenKey);
    if (error) throw error;
    const byRoleId = new Map();
    (data || []).forEach((p) => byRoleId.set(p.role_id, p));
    return byRoleId;
}

/** Upsert + daima .select() ile görünür hata */
async function safeUpsertRolePerms(payload) {
    const { error } = await supabase
        .from("role_permissions")
        .upsert(payload, { onConflict: "role_id,screen_key" })
        .select();
    if (error) throw error;
}

export default function RolesTab() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const [selectedScreen, setSelectedScreen] = useState(SCREENS[0].key);
    const permKeys = PERM_KEYS_BY_SCREEN[selectedScreen] || [];

    // DEĞİŞİKLİK YAPILDI: load fonksiyonu useCallback ile sarmalandı
    const load = useCallback(async (screen = selectedScreen) => {
        setLoading(true);
        try {
            await ensureRolesExist();
            const roleMap = await fetchRoleMap();
            const permsMap = await fetchRolePermissions(screen);

            const uiRows = ROLES.map((r) => {
                const role = roleMap.get(r.key);
                const existing = role ? permsMap.get(role.id) : null;

                const base = {
                    role_id: role?.id || null,
                    role_key: r.key,
                    role_name: role?.name || r.name,
                };
                // permKeys burada kullanıldığı için useCallback bağımlılığına eklendi.
                permKeys.forEach((p) => { base[p.key] = !!existing?.[p.key]; });
                return base;
            });

            setRows(uiRows);
            setDirty(false);
        } catch (e) {
            console.error("role_permissions load error:", e);
            alert("Roller & izinler yüklenemedi: " + (e?.message || e));
        } finally {
            setLoading(false);
        }
    }, [permKeys, selectedScreen]); // <-- 'permKeys' ve 'selectedScreen' bağımlılık olarak eklendi.

    // DEĞİŞİKLİK YAPILDI: load bağımlılık dizisine eklendi.
    // selectedScreen değiştiğinde de load'un tekrar çalışmasını sağlar.
    useEffect(() => { load(selectedScreen); /* eslint-disable-next-line */ }, [selectedScreen, load]);

    const toggle = (role_id, key) => {
        setRows((prev) => prev.map((r) => (r.role_id === role_id ? { ...r, [key]: !r[key] } : r)));
        setDirty(true);
    };

    const save = async () => {
        try {
            setSaving(true);
            const payload = rows
                .filter((r) => !!r.role_id)
                .map((r) => {
                    const obj = { role_id: r.role_id, screen_key: selectedScreen };
                    permKeys.forEach((p) => (obj[p.key] = !!r[p.key])); // sadece görünenler
                    return obj;
                });

            if (!payload.length) {
                setDirty(false);
                return;
            }

            await safeUpsertRolePerms(payload);
            setDirty(false);
            await load(); // load artık useCallback içinde, güvenle çağrılabilir.
        } catch (e) {
            console.error("save roles error:", e);
            alert("Kaydetme hatası: " + (e?.message || e));
        } finally {
            setSaving(false);
        }
    };

    const rowsWithNames = useMemo(() => rows.map((r) => ({ ...r, name: r.role_name || r.role_key })), [rows]);

    return (
        <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
            <Toolbar
                sx={{
                    gap: 1, px: 2, py: 1.5,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                }}
            >
                <Typography variant="subtitle1" fontWeight={800}>Roller & Yetkiler</Typography>

                <FormControl size="small" sx={{ minWidth: 220, ml: 2 }}>
                    <InputLabel id="screen-select-label">Ekran</InputLabel>
                    <Select
                        labelId="screen-select-label"
                        value={selectedScreen}
                        label="Ekran"
                        onChange={(e) => setSelectedScreen(e.target.value)}
                        disabled={saving}
                    >
                        {SCREENS.map((s) => (
                            <MenuItem key={s.key} value={s.key}>{s.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Chip size="small" label={`Rol sayısı: ${rowsWithNames.length}`} sx={{ ml: "auto" }} />

                <Tooltip title="Yenile">
                    <span>
                        {/* load çağrımı useCallback içinde olduğu için güvenlidir */}
                        <IconButton onClick={() => load(selectedScreen)} disabled={loading || saving}>
                            {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                        </IconButton>
                    </span>
                </Tooltip>

                <Button startIcon={<SaveIcon />} onClick={save} disabled={!dirty || saving || loading} variant="contained" size="small">
                    {saving ? "Kaydediliyor…" : "Kaydet"}
                </Button>
            </Toolbar>

            <TableContainer sx={{ maxHeight: 520 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 160, fontWeight: 800 }}>Rol</TableCell>
                            {PERM_KEYS_BY_SCREEN[selectedScreen].map((p) => (
                                <TableCell key={p.key} sx={{ fontWeight: 800 }}>{p.label}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={1 + PERM_KEYS_BY_SCREEN[selectedScreen].length}>
                                    <Box sx={{ py: 3, display: "flex", gap: 1, alignItems: "center", justifyContent: "center" }}>
                                        <CircularProgress size={20} />
                                        <Typography>Yükleniyor…</Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            rowsWithNames.map((r) => {
                                const disabled = !r.role_id;
                                return (
                                    <TableRow key={r.role_key}>
                                        <TableCell><Typography fontWeight={800}>{r.name}</Typography></TableCell>
                                        {PERM_KEYS_BY_SCREEN[selectedScreen].map((p) => (
                                            <TableCell key={p.key}>
                                                <Switch
                                                    size="small"
                                                    checked={!!r[p.key]}
                                                    onChange={() => !disabled && toggle(r.role_id, p.key)}
                                                    disabled={disabled || saving}
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}
