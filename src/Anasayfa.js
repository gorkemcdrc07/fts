// src/Anasayfa.jsx
import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { Helmet } from "react-helmet-async";
import { supabase } from "./supabaseClient";

// UI
import { motion, useMotionValue, animate } from "framer-motion";
import {
    Box,
    Container,
    Paper,
    Stack,
    Typography,
    Grid,
    Chip,
    Divider,
    Card,
    CardContent,
    CardHeader,
    IconButton,
    Tooltip,
    CircularProgress,
    Alert,
} from "@mui/material";
import {
    LocalShipping as TruckIcon,
    Assignment as TaskIcon,
    EvStation as VehicleIcon,
    Refresh as RefreshIcon,
} from "@mui/icons-material";

/** --- SVG HERO --- */
function LogisticsHero() {
    const dash = 680;
    const distance = useMotionValue("0%");

    useEffect(() => {
        const controls = animate(0, 100, {
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            onUpdate: (v) => distance.set(`${v}%`),
        });
        return () => controls.stop();
    }, [distance]);

    return (
        <Box aria-hidden sx={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <svg width="100%" height="100%" viewBox="0 0 1440 340" preserveAspectRatio="xMidYMid slice">
                <defs>
                    <linearGradient id="heroGrad" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.20" />
                        <stop offset="100%" stopColor="#34D399" stopOpacity="0.20" />
                    </linearGradient>
                    <linearGradient id="route" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#22C55E" />
                        <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="b" />
                        <feMerge>
                            <feMergeNode in="b" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <rect x="0" y="0" width="1440" height="340" fill="url(#heroGrad)" />

                {[[120, 220], [560, 100], [1020, 240], [1320, 120]].map(([x, y], i) => (
                    <g key={i} transform={`translate(${x} ${y})`} filter="url(#glow)">
                        <circle r="7" fill="#34D399" />
                        <circle r="16" fill="none" stroke="#34D399" strokeOpacity="0.5" />
                    </g>
                ))}

                <path
                    d="M 80 230 C 260 70, 640 60, 840 180 S 1160 320, 1340 120"
                    fill="none"
                    stroke="url(#route)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={dash}
                    opacity="0.9"
                />

                <motion.path
                    d="M 80 230 C 260 70, 640 60, 840 180 S 1160 320, 1340 120"
                    fill="none"
                    stroke="white"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${dash / 6} ${dash}`}
                    initial={{ strokeDashoffset: 0 }}
                    animate={{ strokeDashoffset: -dash }}
                    transition={{ duration: 5.8, ease: "linear", repeat: Infinity }}
                    style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.7))" }}
                    opacity="0.6"
                />

                {/* Kamyon */}
                <motion.g
                    transform="translate(0,0) scale(1)"
                    style={{
                        offsetPath:
                            "path('M 80 230 C 260 70, 640 60, 840 180 S 1160 320, 1340 120')",
                        offsetDistance: distance,
                    }}
                >
                    <g transform="translate(-12,-12)">
                        <rect x="0" y="4" width="26" height="16" rx="3" fill="#111827" />
                        <rect x="18" y="0" width="18" height="16" rx="3" fill="#3B82F6" />
                        <rect x="22" y="3" width="6" height="5" rx="1" fill="white" />
                        <circle cx="6" cy="22" r="4" fill="#0B0F1A" stroke="white" strokeWidth="1" />
                        <circle cx="22" cy="22" r="4" fill="#0B0F1A" stroke="white" strokeWidth="1" />
                    </g>
                </motion.g>
            </svg>
        </Box>
    );
}

/** --- Helpers --- */
const monthKey = (d) => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    const m = dt.getMonth();
    const y = dt.getFullYear();
    return `${y}-${String(m + 1).padStart(2, "0")}`;
};
const getDateAny = (r) =>
    r?.tamamlanma_tarihi || r?.tarih || r?.created_at || r?.date || r?.updated_at;

/** Sayfalamalı güvenli çekiş */
async function fetchAllRows(table) {
    const pageSize = 1000;
    const head = await supabase.from(table).select("*", { count: "exact", head: true });
    if (head.error) {
        const msg = head.error.message || "";
        const code = head.error.code || "";
        if (String(code).includes("42P01")) return { rows: [], warn: `Supabase: "${table}" tablosu bulunamadı.` };
        if (msg.toLowerCase().includes("not found")) return { rows: [], warn: `Supabase REST: "${table}" (404).` };
        return { rows: [], warn: msg };
    }
    const total = head.count ?? 0;
    if (!total) return { rows: [], warn: "" };

    const pages = Math.ceil(total / pageSize);
    const out = [];
    for (let p = 0; p < pages; p++) {
        const from = p * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase.from(table).select("*").range(from, to);
        if (error) return { rows: out, warn: error.message || "Sorgu hatası" };
        if (!data?.length) break;
        out.push(...data);
    }
    return { rows: out, warn: "" };
}

/** Prefix sayacı: BOS / SFR ile BAŞLAYANLAR */
function countBosSfrPrefix(rows, field = "sefer_no") {
    let bos = 0, sfr = 0;
    for (const r of rows) {
        const v = (r?.[field] ?? "").toString().trim().toUpperCase();
        if (!v) continue;
        if (v.startsWith("BOS")) bos++;
        else if (v.startsWith("SFR")) sfr++;
    }
    return { bos, sfr };
}

/** --- Ana Sayfa --- */
export default function Anasayfa() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    // Paneller
    const [completedTotal, setCompletedTotal] = useState(0); // tamamlanan_seferler toplam
    const [seferlerTotal, setSeferlerTotal] = useState(0);   // seferler toplam
    const [aktifBos, setAktifBos] = useState(0);
    const [aktifSfr, setAktifSfr] = useState(0);
    const [tamBos, setTamBos] = useState(0);
    const [tamSfr, setTamSfr] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setErr("");

            const tTam = await fetchAllRows("tamamlanan_seferler");
            const tSef = await fetchAllRows("seferler");

            const tamamlanan = tTam.rows;
            const seferler = tSef.rows;

            const warns = [tTam.warn, tSef.warn].filter(Boolean);
            if (warns.length) setErr(warns.join("  "));

            setCompletedTotal(tamamlanan.length);
            setSeferlerTotal(seferler.length);

            const { bos: aBos, sfr: aSfr } = countBosSfrPrefix(seferler, "sefer_no");
            setAktifBos(aBos);
            setAktifSfr(aSfr);

            const { bos: tBos, sfr: tSfr } = countBosSfrPrefix(tamamlanan, "sefer_no");
            setTamBos(tBos);
            setTamSfr(tSfr);
        } catch (e) {
            console.error(e);
            setErr((e?.message || "Veriler alınamadı.") + "");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    return (
        <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: (t) => (t.palette.mode === "dark" ? "#0b1020" : "#f6f9ff") }}>
            <Helmet><title>ANA SAYFA</title></Helmet>

            <Sidebar />
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Navbar />

                {/* üst hero + içerik */}
                <Box
                    component={motion.div}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    sx={{
                        position: "relative",
                        py: { xs: 2, md: 4 },
                        background: (t) => (t.palette.mode === "dark"
                            ? "linear-gradient(180deg,#0b1020,#0e1428)"
                            : "linear-gradient(180deg,#f6f9ff,#f4f7ff)"),
                    }}
                >
                    {/* Hero */}
                    <Box sx={{ position: "relative", height: 220, mb: 2 }}>
                        <LogisticsHero />
                        <Container maxWidth={false} sx={{ position: "relative", zIndex: 1, px: { xs: 2, md: 4 }, maxWidth: "1600px" }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="h5" fontWeight={900} sx={{ pt: 2 }}>Ana Menü</Typography>
                                    <Typography sx={{ opacity: 0.7 }}>Operasyonlarınızın genel görünümü — seferler ve durumlar.</Typography>
                                </Box>
                                <Tooltip title="Yenile">
                                    <span>
                                        <IconButton onClick={fetchData} disabled={loading} color="primary">
                                            {loading ? <CircularProgress size={18} /> : <RefreshIcon />}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Stack>
                        </Container>
                    </Box>

                    {/* içerik */}
                    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, maxWidth: "1600px" }}>
                        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

                        {/* PANELLER */}
                        <Grid container spacing={2.4}>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <Paper elevation={6} sx={{
                                    borderRadius: 3, p: 2, backdropFilter: "saturate(140%) blur(8px)",
                                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
                                    border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                                }}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <TruckIcon />
                                        <Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Tamamlanan Seferler</Typography>
                                    </Stack>
                                    <Typography variant="h4" fontWeight={900} sx={{ mt: 0.5 }}>{completedTotal}</Typography>
                                    <Chip size="small" variant="outlined" label="tamamlanan_seferler" sx={{ mt: 1 }} />
                                </Paper>
                            </Grid>

                            <Grid size={{ xs: 12, md: 3 }}>
                                <Paper elevation={6} sx={{
                                    borderRadius: 3, p: 2, backdropFilter: "saturate(140%) blur(8px)",
                                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
                                    border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                                }}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <VehicleIcon />
                                        <Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Toplam Sefer (seferler)</Typography>
                                    </Stack>
                                    <Typography variant="h4" fontWeight={900} sx={{ mt: 0.5 }}>{seferlerTotal}</Typography>
                                    <Chip size="small" variant="outlined" label="seferler" sx={{ mt: 1 }} />
                                </Paper>
                            </Grid>

                            <Grid size={{ xs: 12, md: 3 }}>
                                <Paper elevation={6} sx={{
                                    borderRadius: 3, p: 2, backdropFilter: "saturate(140%) blur(8px)",
                                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
                                    border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                                }}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <TaskIcon />
                                        <Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Aktif BOS / SFR</Typography>
                                    </Stack>
                                    <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
                                        {aktifBos} <Typography component="span" variant="body2" sx={{ opacity: .65 }}>BOS</Typography>
                                        &nbsp;|&nbsp;
                                        {aktifSfr} <Typography component="span" variant="body2" sx={{ opacity: .65 }}>SFR</Typography>
                                    </Typography>
                                    <Chip size="small" variant="outlined" label="seferler.sefer_no startsWith" sx={{ mt: 1 }} />
                                </Paper>
                            </Grid>

                            <Grid size={{ xs: 12, md: 3 }}>
                                <Paper elevation={6} sx={{
                                    borderRadius: 3, p: 2, backdropFilter: "saturate(140%) blur(8px)",
                                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
                                    border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                                }}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <TaskIcon />
                                        <Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Tamamlanan BOS / SFR</Typography>
                                    </Stack>
                                    <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
                                        {tamBos} <Typography component="span" variant="body2" sx={{ opacity: .65 }}>BOS</Typography>
                                        &nbsp;|&nbsp;
                                        {tamSfr} <Typography component="span" variant="body2" sx={{ opacity: .65 }}>SFR</Typography>
                                    </Typography>
                                    <Chip size="small" variant="outlined" label="tamamlanan_seferler.sefer_no startsWith" sx={{ mt: 1 }} />
                                </Paper>
                            </Grid>
                        </Grid>

                        <Divider sx={{ my: 3, opacity: 0.2 }} />
                        <Typography sx={{ opacity: 0.7, mb: 1.5 }}>
                            İsteğe göre grafikler ve detaylı analizler buraya eklenir.
                        </Typography>
                    </Container>
                </Box>
            </Box>
        </Box>
    );
}
