// src/adminPanel/tabs/PagePermissionsTab.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
    Box, Paper, Typography, Stack, Divider, Checkbox, List, ListItemButton,
    ListItemText, TextField, Button, InputAdornment, Tooltip, Chip, Skeleton,
    Snackbar, Alert, Badge, LinearProgress, Switch, FormControlLabel, IconButton, Toolbar
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SaveIcon from "@mui/icons-material/Save";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CloseIcon from "@mui/icons-material/Close";
import { createClient } from "@supabase/supabase-js";

import { APP_PAGES } from "../../routes/pages";

// ---- Supabase client (frontend-safe anon key) ----
// JS dosyasında TypeScript '!' non-null operatörünü kullanmıyoruz.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnon = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnon);

// ---- helpers ----
function safeGetUsername() {
    const k1 = (localStorage.getItem("kullaniciAdi") || "").trim();
    const k2 = (localStorage.getItem("kullanici") || "").trim();
    let k3 = "";
    try { k3 = JSON.parse(localStorage.getItem("girisYapanKullanici") || "{}")?.kullaniciAdi || ""; } catch (e) { }
    const pick = (k1 || k2 || k3 || "").toLowerCase();
    return pick.includes("@") ? pick.split("@")[0] : pick;
}

function normalizeUsers(arr) {
    const set = new Set(
        (arr || [])
            .map(r => (typeof r === "string" ? r : r?.kullanici || ""))
            .map(s => s.trim().toLowerCase())
            .filter(Boolean)
    );
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
}

export default function PagePermissionsTab() {
    const me = safeGetUsername();
    const pages = useMemo(() => APP_PAGES, []);

    // kullanıcı listesi
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState("");
    const [userFilter, setUserFilter] = useState("");
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [userError, setUserError] = useState("");

    // izinler
    // shape: { [kullanici]: string[] }
    const [permMap, setPermMap] = useState({});
    const [loadingPerms, setLoadingPerms] = useState(true);
    const [permError, setPermError] = useState("");

    // UI
    const [onlyAllowed, setOnlyAllowed] = useState(false);
    const [pageFilter, setPageFilter] = useState("");
    const [dirty, setDirty] = useState(false);
    const [snack, setSnack] = useState({ open: false, msg: "", sev: "info" });

    // seçili kullanıcı için izinler
    const allowedForUser = useMemo(
        () => (Array.isArray(permMap[selectedUser]) ? permMap[selectedUser] : []),
        [permMap, selectedUser]
    );

    const loading = loadingUsers || loadingPerms;
    const anyError = userError || permError;

    // ---- 1) Kullanıcıları getir ----
    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoadingUsers(true); setUserError("");
            try {
                const { data, error } = await supabase
                    .from("login")
                    .select("kullanici")
                    .order("kullanici", { ascending: true });
                if (error) throw error;
                const list = normalizeUsers(data);
                if (!mounted) return;
                setUsers(list);
                setSelectedUser(prev => prev || (list[0] || ""));
            } catch (err) {
                if (!mounted) return;
                setUserError("Kullanıcı listesi getirilemedi. Supabase erişimini ve policy'leri kontrol edin.");
                setUsers([]);
                setSelectedUser("");
            } finally {
                if (mounted) setLoadingUsers(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // ---- 2) Tüm izinleri getir ----
    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoadingPerms(true); setPermError("");
            try {
                const { data, error } = await supabase
                    .from("page_permissions")
                    .select("kullanici, paths");
                if (error) throw error;

                const map = {};
                (data || []).forEach((row) => {
                    const u = (row?.kullanici || "").trim().toLowerCase();
                    const p = Array.isArray(row?.paths) ? row.paths : [];
                    if (u) map[u] = p;
                });

                if (!mounted) return;
                setPermMap(map);
            } catch (err) {
                if (!mounted) return;
                setPermError("İzinler getirilemedi. RLS/policy ayarlarını kontrol edin.");
                setPermMap({});
            } finally {
                if (mounted) setLoadingPerms(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // ---- derived: filtrelenmiş kullanıcılar ----
    const filteredUsers = useMemo(() => {
        const q = (userFilter || "").toLowerCase();
        return users.filter(u => u.includes(q));
    }, [users, userFilter]);

    // ---- izin set yardımcıları ----
    const setAllowedForUser = useCallback((nextList) => {
        setPermMap(prev => {
            const prevList = Array.isArray(prev[selectedUser]) ? prev[selectedUser] : [];
            const value = typeof nextList === "function" ? nextList(prevList) : nextList;
            const next = { ...prev, [selectedUser]: value };
            setDirty(true);
            return next;
        });
    }, [selectedUser]);

    const togglePath = (path) => {
        setAllowedForUser(prev => {
            const set = new Set(prev);
            set.has(path) ? set.delete(path) : set.add(path);
            return [...set];
        });
    };

    const selectAll = () => setAllowedForUser(pages.map(p => p.path));
    const clearAll = () => setAllowedForUser([]);

    const selectVisible = (visiblePaths) => setAllowedForUser(prev => {
        const set = new Set(prev);
        visiblePaths.forEach(p => set.add(p));
        return [...set];
    });

    const invertSelectionVisible = (visiblePaths) => setAllowedForUser(prev => {
        const set = new Set(prev);
        visiblePaths.forEach(p => {
            set.has(p) ? set.delete(p) : set.add(p);
        });
        return [...set];
    });

    const saveForUser = async () => {
        if (!selectedUser) {
            setSnack({ open: true, msg: "Önce soldan bir kullanıcı seçin.", sev: "info" });
            return;
        }
        try {
            const paths = [...new Set(allowedForUser)];
            const { error } = await supabase
                .from("page_permissions")
                .upsert(
                    { kullanici: selectedUser, paths, updated_at: new Date().toISOString() },
                    { onConflict: "kullanici" }
                );
            if (error) throw error;

            setSnack({ open: true, msg: "İzinler kaydedildi.", sev: "success" });
            setDirty(false);
        } catch (err) {
            console.error(err);
            setSnack({ open: true, msg: "Kaydedilemedi. (Supabase upsert hatası)", sev: "error" });
        }
    };

    // ---- sayfa listesi: filtreleme ----
    const visiblePages = useMemo(() => {
        const q = (pageFilter || "").toLowerCase();
        const base = pages.filter(p => {
            const hit = (p.title || "").toLowerCase().includes(q) || (p.path || "").toLowerCase().includes(q);
            return hit;
        });
        if (!onlyAllowed) return base;
        const allowedSet = new Set(allowedForUser);
        return base.filter(p => allowedSet.has(p.path));
    }, [pages, pageFilter, onlyAllowed, allowedForUser]);

    const visiblePaths = useMemo(() => visiblePages.map(p => p.path), [visiblePages]);

    // ---- UI ----
    return (
        <Box>
            {loading && <LinearProgress sx={{ mb: 1 }} />}

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                {/* SOL: kullanıcılar */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, width: { xs: "100%", md: 320 }, flexShrink: 0 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight={800}>Kullanıcılar</Typography>
                        <Chip size="small" label={loadingUsers ? "..." : `Toplam: ${users.length}`} />
                    </Stack>

                    <TextField
                        placeholder="Kullanıcı ara..."
                        size="small"
                        fullWidth
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            )
                        }}
                        sx={{ mb: 1 }}
                    />

                    {loadingUsers ? (
                        <Stack spacing={0.5}>
                            {[...Array(8)].map((_, i) => (<Skeleton key={i} height={36} variant="rounded" />))}
                        </Stack>
                    ) : anyError ? (
                        <Alert severity="error" sx={{ mt: 1 }}>{anyError}</Alert>
                    ) : (
                        <List dense sx={{ maxHeight: 520, overflowY: "auto", borderRadius: 1 }}>
                            {filteredUsers.length === 0 && (
                                <Typography variant="caption" sx={{ opacity: 0.7, p: 1 }}>
                                    Kullanıcı bulunamadı.
                                </Typography>
                            )}
                            {filteredUsers.map(u => (
                                <ListItemButton
                                    key={u}
                                    selected={u === selectedUser}
                                    onClick={() => { setSelectedUser(u); setDirty(false); }}
                                    sx={{ borderRadius: 1 }}
                                >
                                    <ListItemText
                                        primaryTypographyProps={{ sx: { textTransform: "none" } }}
                                        primary={
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <span>{u}</span>
                                                {u === me && <Chip size="small" color="info" label="Bu oturum" />}
                                            </Stack>
                                        }
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </Paper>

                {/* SAĞ: sayfa izinleri */}
                <Paper variant="outlined" sx={{ p: 0, borderRadius: 2, flex: 1, overflow: "hidden" }}>
                    <Toolbar sx={{ gap: 1, flexWrap: "wrap", borderBottom: theme => `1px solid ${theme.palette.divider}` }}>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ mr: 1 }}>
                            {selectedUser ? `Kullanıcı Ekranları — ${selectedUser}` : "Kullanıcı seçin"}
                        </Typography>

                        <Badge badgeContent={allowedForUser.length} color="primary">
                            <Chip size="small" variant="outlined" label="Yetkili sayfa" />
                        </Badge>

                        <Box sx={{ flex: 1 }} />

                        <TextField
                            placeholder="Sayfa ara (başlık veya path)..."
                            size="small"
                            value={pageFilter}
                            onChange={(e) => setPageFilter(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                )
                            }}
                            sx={{ minWidth: 280 }}
                        />

                        <FormControlLabel
                            sx={{ ml: 1 }}
                            control={<Switch checked={onlyAllowed} onChange={(e) => setOnlyAllowed(e.target.checked)} />}
                            label="Yalnızca yetkili"
                        />

                        <Tooltip title="Görünürleri seç">
                            <span>
                                <IconButton size="small" onClick={() => selectVisible(visiblePaths)} disabled={!selectedUser || loading || !!anyError}>
                                    <DoneAllIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Tooltip title="Görünürlerin seçimini ters çevir">
                            <span>
                                <IconButton size="small" onClick={() => invertSelectionVisible(visiblePaths)} disabled={!selectedUser || loading || !!anyError}>
                                    <SwapHorizIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Tooltip title="Tümünü izinle">
                            <span>
                                <Button size="small" variant="outlined" startIcon={<SelectAllIcon />} onClick={selectAll} disabled={!selectedUser || loading || !!anyError}>
                                    Tümünü
                                </Button>
                            </span>
                        </Tooltip>

                        <Tooltip title="Tüm izinleri temizle">
                            <span>
                                <Button size="small" variant="text" startIcon={<ClearAllIcon />} onClick={clearAll} disabled={!selectedUser || loading || !!anyError}>
                                    Temizle
                                </Button>
                            </span>
                        </Tooltip>

                        <Tooltip title={dirty ? "Değişiklikler var, kaydet" : "Güncel"}>
                            <span>
                                <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<SaveIcon />}
                                    onClick={saveForUser}
                                    disabled={!selectedUser || loading || !!anyError || !dirty}
                                >
                                    Kaydet
                                </Button>
                            </span>
                        </Tooltip>
                    </Toolbar>

                    <Box sx={{ p: 2 }}>
                        {!selectedUser ? (
                            <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                Lütfen soldan bir kullanıcı seçin.
                            </Typography>
                        ) : loadingPerms ? (
                            <Stack spacing={0.75}>
                                {[...Array(10)].map((_, i) => (<Skeleton key={i} height={32} variant="text" />))}
                            </Stack>
                        ) : anyError ? (
                            <Alert severity="error">{anyError}</Alert>
                        ) : (
                            <>
                                {visiblePages.length === 0 && (
                                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                        Sonuç yok. Filtreyi değiştirin ya da “Yalnızca yetkili”yi kapatın.
                                    </Typography>
                                )}

                                <Stack spacing={0.25} sx={{ maxHeight: 560, overflowY: "auto" }}>
                                    {visiblePages.map((p, i) => {
                                        const checked = allowedForUser.includes(p.path);
                                        return (
                                            <Stack key={p.path} direction="row" alignItems="center" sx={{
                                                px: 1, py: 0.25, borderRadius: 1,
                                                "&:hover": { backgroundColor: "action.hover" }
                                            }}>
                                                <Checkbox
                                                    checked={checked}
                                                    onChange={() => togglePath(p.path)}
                                                    inputProps={{ "aria-label": `Sayfa izni: ${p.title}` }}
                                                />
                                                <Typography sx={{ width: 40 }} align="right">{i + 1}.</Typography>
                                                <Typography sx={{ minWidth: 280, fontWeight: 600, ml: 1 }}>{p.title}</Typography>
                                                <Chip size="small" variant="outlined" label={p.path} sx={{ ml: 1 }} />
                                            </Stack>
                                        );
                                    })}
                                </Stack>
                            </>
                        )}
                    </Box>
                </Paper>
            </Stack>

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setSnack(s => ({ ...s, open: false }))}
                    severity={snack.sev}
                    variant="filled"
                    sx={{ width: "100%" }}
                    action={
                        <IconButton size="small" color="inherit" onClick={() => setSnack(s => ({ ...s, open: false }))}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    }
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
