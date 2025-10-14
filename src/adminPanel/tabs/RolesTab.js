// src/adminPanel/tabs/RolesTab.jsx
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
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";

/** APP'in tanıdığı sabit roller (key = diakritiksiz) */
const ROLES = [
    { key: "YONETICI", name: "YÖNETİCİ" },
    { key: "OPERASYON", name: "OPERASYON" },
    { key: "TAKIP", name: "TAKİP" },
];

/** İzin anahtarları (kolon adlarıyla birebir) */
const PERM_KEYS = [
    { key: "can_sync", label: "Senkronize" },
    { key: "can_edit", label: "Sefer Düzenle" },
    { key: "can_eta", label: "ETA Gör" },
    { key: "may_open_edit", label: "Editörü Aç" },
    { key: "may_open_eta", label: "ETA Paneli Aç" },
];

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

/** role_permissions: Map(role_id => row) */
async function fetchRolePermissions() {
    const { data, error } = await supabase
        .from("role_permissions")
        .select("role_id, can_sync, can_edit, can_eta, may_open_edit, may_open_eta");
    if (error) throw error;
    const byRoleId = new Map();
    (data || []).forEach((p) => byRoleId.set(p.role_id, p));
    return byRoleId;
}

/** Bazı projelerde upsert sonrası 406 alınabiliyor: fallback .select() */
async function safeUpsertRolePerms(payload) {
    const { error } = await supabase.from("role_permissions").upsert(payload, { onConflict: "role_id" });
    if (!error) return;
    if (String(error.code) === "406") {
        const { error: e2 } = await supabase
            .from("role_permissions")
            .upsert(payload, { onConflict: "role_id" })
            .select(); // 406 için fallback
        if (e2) throw e2;
        return;
    }
    throw error;
}

export default function RolesTab() {
    const [rows, setRows] = useState([]); // [{role_id, role_key, role_name, ...}]
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            // 1) roller garanti
            await ensureRolesExist();

            // 2) map’ler
            const roleMap = await fetchRoleMap();
            const permsMap = await fetchRolePermissions();

            // 3) UI satırları: eksik olanlar false olarak gelsin
            const uiRows = ROLES.map((r) => {
                const role = roleMap.get(r.key);
                const existing = role ? permsMap.get(role.id) : null;
                return {
                    role_id: role?.id || null, // uuid
                    role_key: r.key,
                    role_name: role?.name || r.name,
                    can_sync: !!existing?.can_sync,
                    can_edit: !!existing?.can_edit,
                    can_eta: !!existing?.can_eta,
                    may_open_edit: !!existing?.may_open_edit,
                    may_open_eta: !!existing?.may_open_eta,
                };
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

    useEffect(() => {
        load();
    }, []);

    const toggle = (role_id, key) => {
        setRows((prev) =>
            prev.map((r) =>
                r.role_id === role_id ? { ...r, [key]: !r[key] } : r
            )
        );
        setDirty(true);
    };

    const save = async () => {
        try {
            setSaving(true);
            // role_id olmayan satırları at (normalde olmamalı; yine de koruyalım)
            const payload = rows
                .filter((r) => !!r.role_id)
                .map((r) => ({
                    role_id: r.role_id,
                    can_sync: r.can_sync,
                    can_edit: r.can_edit,
                    can_eta: r.can_eta,
                    may_open_edit: r.may_open_edit,
                    may_open_eta: r.may_open_eta,
                }));

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

    const rowsWithNames = useMemo(
        () =>
            rows.map((r) => ({
                ...r,
                name: r.role_name || r.role_key,
            })),
        [rows]
    );

    return (
        <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
            <Toolbar
                sx={{
                    gap: 1,
                    px: 2,
                    py: 1.5,
                    bgcolor: (t) =>
                        t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                }}
            >
                <Typography variant="subtitle1" fontWeight={800} sx={{ mr: "auto" }}>
                    Roller & Yetkiler
                </Typography>

                <Chip size="small" label={`Rol sayısı: ${rowsWithNames.length}`} />

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

            <TableContainer sx={{ maxHeight: 520 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 160, fontWeight: 800 }}>Rol</TableCell>
                            {PERM_KEYS.map((p) => (
                                <TableCell key={p.key} sx={{ fontWeight: 800 }}>
                                    {p.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={1 + PERM_KEYS.length}>
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
                        ) : (
                            rowsWithNames.map((r) => {
                                const disabled = !r.role_id; // güvenlik için
                                return (
                                    <TableRow key={r.role_key}>
                                        <TableCell>
                                            <Typography fontWeight={800}>{r.name}</Typography>
                                        </TableCell>

                                        {PERM_KEYS.map((p) => (
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
