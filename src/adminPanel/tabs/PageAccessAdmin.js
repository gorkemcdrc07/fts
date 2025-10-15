// src/adminPanel/tabs/PageAccessTab.js
import React, { useEffect, useMemo, useState } from "react";
import {
    Box, Paper, Typography, Stack, Divider,
    Checkbox, FormControlLabel, TextField, Button,
} from "@mui/material";
import { APP_PAGES } from "../../routes/pages";

function safeGetUsername() {
    const k1 = (localStorage.getItem("kullaniciAdi") || "").trim();
    const k2 = (localStorage.getItem("kullanici") || "").trim();
    let k3 = "";
    try {
        const obj = JSON.parse(localStorage.getItem("girisYapanKullanici") || "{}");
        k3 = (obj?.kullaniciAdi || "").trim();
    } catch { }
    const pick = (k1 || k2 || k3 || "").toLowerCase();
    return pick.includes("@") ? pick.split("@")[0] : pick;
}

const LS_KEY = "pageAccessOverrides"; // { [username]: string[] }

export default function PageAccessTab() {
    const me = safeGetUsername();
    const [username, setUsername] = useState(me || "");
    const [overrides, setOverrides] = useState({});
    const [allowedForUser, setAllowedForUser] = useState([]);

    useEffect(() => {
        try {
            const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
            setOverrides(raw && typeof raw === "object" ? raw : {});
        } catch {
            setOverrides({});
        }
    }, []);

    useEffect(() => {
        const list = Array.isArray(overrides[username]) ? overrides[username] : [];
        setAllowedForUser(list);
    }, [username, overrides]);

    const pages = useMemo(() => APP_PAGES, []);

    const toggle = (path) => {
        setAllowedForUser((prev) => {
            const set = new Set(prev);
            if (set.has(path)) set.delete(path); else set.add(path);
            return [...set];
        });
    };

    const selectAll = () => setAllowedForUser(pages.map((p) => p.path));
    const clearAll = () => setAllowedForUser([]);
    const save = () => {
        try {
            const next = { ...(overrides || {}) };
            next[username] = [...new Set(allowedForUser)];
            localStorage.setItem(LS_KEY, JSON.stringify(next));
            setOverrides(next);
            alert("Kaydedildi.");
        } catch {
            alert("Kaydedilemedi.");
        }
    };

    return (
        <Box>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                    Kullanıcı Ekranları (Sayfa Erişimleri)
                </Typography>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
                    <TextField
                        label="Kullanıcı"
                        size="small"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.trim().toLowerCase())}
                        helperText="Kullanıcı adını girin (ör. gorkem)"
                    />
                    <Button variant="outlined" onClick={selectAll}>Tümünü İzinle</Button>
                    <Button variant="text" onClick={clearAll}>Temizle</Button>
                    <Button variant="contained" onClick={save}>Kaydet</Button>
                </Stack>

                <Divider sx={{ mb: 2 }} />

                <Stack spacing={0.5}>
                    {pages.map((p, i) => {
                        const checked = allowedForUser.includes(p.path);
                        return (
                            <FormControlLabel
                                key={p.path}
                                control={<Checkbox checked={checked} onChange={() => toggle(p.path)} />}
                                label={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {/* Sıra numarası kullanıcı hangi sırada gittiğini görsün */}
                                        <Typography sx={{ width: 28 }} align="right">{i + 1}.</Typography>
                                        <Typography sx={{ minWidth: 240 }}>{p.title}</Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.7 }}>{p.path}</Typography>
                                    </Stack>
                                }
                            />
                        );
                    })}
                </Stack>
            </Paper>
        </Box>
    );
}
