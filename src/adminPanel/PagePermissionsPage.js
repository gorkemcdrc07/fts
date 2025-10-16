// src/adminPanel/PagePermissionsPage.js
import React, { useEffect, useMemo, useState } from "react";
import {
    Box, Paper, Typography, Stack, Divider, Checkbox,
    FormControlLabel, Button, FormControl, InputLabel, Select, MenuItem, CircularProgress
} from "@mui/material";
import { APP_PAGES } from "../routes/pages"; // <-- bu dosyanın konumuna göre doğru
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function PagePermissionsPage() {
    const [users, setUsers] = useState([]);            // login tablosu
    const [usersLoading, setUsersLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState(null); // login.id (number)
    const [allowedForUser, setAllowedForUser] = useState([]);
    const [permLoading, setPermLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const pages = useMemo(() => APP_PAGES, []);

    // 1) login kullanıcılarını getir
    useEffect(() => {
        (async () => {
            setUsersLoading(true);
            const { data, error } = await supabase
                .from("login")
                .select("id, kullaniciAdi, kullanici")
                .order("kullaniciAdi", { ascending: true });

            if (error) {
                console.error("[Permissions] login fetch:", error);
                setUsers([]);
            } else {
                setUsers(data || []);
                if (selectedUserId == null && data && data.length > 0) {
                    setSelectedUserId(Number(data[0].id));
                }
            }
            setUsersLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2) Seçili kullanıcı değişince mevcut izinleri user_id (bigint) ile çek
    useEffect(() => {
        (async () => {
            if (selectedUserId == null) { setAllowedForUser([]); return; }
            setPermLoading(true);
            const { data, error } = await supabase
                .from("page_permissions")
                .select("paths")
                .eq("user_id", Number(selectedUserId))
                .maybeSingle();

            if (error) {
                console.error("[Permissions] fetch by user_id:", error);
                setAllowedForUser([]);
            } else {
                setAllowedForUser(Array.isArray(data?.paths) ? data.paths : []);
            }
            setPermLoading(false);
        })();
    }, [selectedUserId]);

    // Toggle tek path
    const toggle = (path) => {
        setAllowedForUser((prev) => {
            const set = new Set(prev);
            set.has(path) ? set.delete(path) : set.add(path);
            return [...set];
        });
    };

    const selectAll = () => setAllowedForUser(pages.map((p) => p.path));
    const clearAll = () => setAllowedForUser([]);

    // 3) Kaydet: page_permissions.user_id = login.id (bigint), mükerrer yok
    const save = async () => {
        try {
            if (selectedUserId == null) return;
            setSaving(true);
            const payload = {
                user_id: Number(selectedUserId),                 // BIGINT
                paths: [...new Set(allowedForUser)],             // dublikeleri temizle
            };
            const { error } = await supabase
                .from("page_permissions")
                .upsert(payload, { onConflict: "user_id" });     // user_id UNIQUE ise merge eder

            if (error) throw error;
            alert("Kaydedildi.");
        } catch (e) {
            console.error("[Permissions] save:", e);
            alert("Kaydedilemedi.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box p={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
                    <Typography variant="subtitle1" fontWeight={800}>Kullanıcı Ekranları</Typography>
                    <Box sx={{ flex: 1 }} />

                    <FormControl size="small" sx={{ minWidth: 320 }}>
                        <InputLabel id="user-select-label">Kullanıcı</InputLabel>
                        <Select
                            labelId="user-select-label"
                            label="Kullanıcı"
                            value={selectedUserId ?? ""}
                            onChange={(e) => setSelectedUserId(Number(e.target.value))}
                            disabled={usersLoading}
                        >
                            {usersLoading && (
                                <MenuItem disabled>
                                    <CircularProgress size={18} style={{ marginRight: 8 }} /> Yükleniyor…
                                </MenuItem>
                            )}
                            {!usersLoading && users.length === 0 && (
                                <MenuItem disabled>Liste boş</MenuItem>
                            )}
                            {!usersLoading && users.map((u) => (
                                <MenuItem key={u.id} value={Number(u.id)}>
                                    {/* solda kullaniciAdi, yanında login.kullanici (bilgi amaçlı) */}
                                    {u.kullaniciAdi}{u.kullanici ? ` — ${u.kullanici}` : ""}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button variant="outlined" onClick={selectAll} disabled={selectedUserId == null || permLoading}>
                        Tümünü İzinle
                    </Button>
                    <Button variant="text" onClick={clearAll} disabled={selectedUserId == null || permLoading}>
                        Temizle
                    </Button>
                    <Button variant="contained" onClick={save} disabled={selectedUserId == null || saving || permLoading}>
                        {saving ? "Kaydediliyor…" : "Kaydet"}
                    </Button>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                {permLoading ? (
                    <Stack alignItems="center" py={3}><CircularProgress /></Stack>
                ) : (
                    <Stack spacing={0.25}>
                        {pages.map((p, i) => {
                            const checked = allowedForUser.includes(p.path);
                            return (
                                <FormControlLabel
                                    key={p.path}
                                    control={<Checkbox checked={checked} onChange={() => toggle(p.path)} />}
                                    label={
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Typography sx={{ width: 28 }} align="right">{i + 1}.</Typography>
                                            <Typography sx={{ minWidth: 260, fontWeight: 600 }}>{p.title}</Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.7 }}>{p.path}</Typography>
                                        </Stack>
                                    }
                                />
                            );
                        })}
                    </Stack>
                )}
            </Paper>
        </Box>
    );
}
