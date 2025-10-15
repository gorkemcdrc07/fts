// src/adminPanel/tabs/RolesTab.jsx
import React, { useEffect, useMemo, useState } from "react";
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
];

/** Ekrana göre İZİN KOLONLARI — role_permissions tablosundaki GERÇEK isimlerle */
const PERM_KEYS_BY_SCREEN = {
    aktif_seferler: [
        { key: "can_sync", label: "Senkronize" },
        { key: "can_edit", label: "Sefer Düzenle" },
        { key: "can_eta", label: "ETA Gör" },
        { key: "may_open_edit", label: "Editörü Aç" },
        { key: "may_open_eta", label: "ETA Paneli Aç" },
    ],
    planlama: [
        { key: "pln_update", label: "Güncelle" },
        { key: "pln_save", label: "Kaydet" },
        { key: "pln_export_excel", label: "Excel Aktar" },
        { key: "pln_import_excel", label: "Dosya İçe Aktar" },
    ],
    // Bu üç ekran generic arcdur_* kolonlarını paylaşıyor
    arac_durumlari: [
        { key: "arcdur_create", label: "Yeni Kayıt Oluştur" },
        { key: "arcdur_edit", label: "Kayıt Düzenle" },
        { key: "arcdur_delete", label: "Kayıt Sil" },
    ],
    arac_yonetimi: [
        { key: "arcdur_create", label: "Yeni Kayıt Oluştur" },
        { key: "arcdur_edit", label: "Kayıt Düzenle" },
        { key: "arcdur_delete", label: "Kayıt Sil" },
    ],
    kesinti_yonetimi: [
        { key: "arcdur_create", label: "Yeni Kayıt Oluştur" },
        { key: "arcdur_edit", label: "Kayıt Düzenle" },
        { key: "arcdur_delete", label: "Kayıt Sil" },
    ],
    // Tedarikçi Masraf: generic create/edit/delete + approve için may_open_edit
    tedarikci_masraf: [
        { key: "arcdur_create", label: "Yeni Kayıt Oluştur" },
        { key: "arcdur_edit", label: "Kayıt Düzenle" },
        { key: "arcdur_delete", label: "Kayıt Sil" },
        { key: "may_open_edit", label: "Masrafı Onayla" },
    ],
    // Araç ve Cari Fiyat: generic create/edit/delete
    arac_cari_fiyat: [
        { key: "arcdur_create", label: "Yeni Kayıt Oluştur" },
        { key: "arcdur_edit", label: "Kayıt Düzenle" },
        { key: "arcdur_delete", label: "Kayıt Sil" },
    ],
    // Hakediş Seferleri: upload izni için arcdur_create'ı kullanıyoruz
    hakedis_seferleri: [
        { key: "arcdur_create", label: "Dosya Yükle" },
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

/** Upsert + 406 fallback */
async function safeUpsertRolePerms(payload) {
    const { error } = await supabase
        .from("role_permissions")
        .upsert(payload, { onConflict: "role_id,screen_key" });
    if (!error) return;

    if (String(error.code) === "406") {
        const { error: e2 } = await supabase
            .from("role_permissions")
            .upsert(payload, { onConflict: "role_id,screen_key" })
            .select();
        if (e2) throw e2;
        return;
    }
    throw error;
}

export default function RolesTab() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const [selectedScreen, setSelectedScreen] = useState(SCREENS[0].key);
    const permKeys = PERM_KEYS_BY_SCREEN[selectedScreen] || [];

    const load = async (screen = selectedScreen) => {
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
                // sadece bu ekranda görünen kolonları oku/yaz
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
    };

    useEffect(() => { load(selectedScreen); /* eslint-disable-next-line */ }, [selectedScreen]);

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
