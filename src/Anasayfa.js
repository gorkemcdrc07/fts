// src/Anasayfa.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { Helmet } from "react-helmet-async";
import { supabase } from "./supabaseClient";

// UI
import { motion, useMotionValue, animate } from "framer-motion";
import {
    Box, Container, Paper, Stack, Typography, Grid, Chip, Divider,
    IconButton, Tooltip, CircularProgress, Alert, MenuItem, Select,
    FormControl, InputLabel, Table, TableHead, TableRow, TableCell,
    TableBody, Button,
} from "@mui/material";
import {
    LocalShipping as TruckIcon,
    Assignment as TaskIcon,
    EvStation as VehicleIcon,
    Refresh as RefreshIcon,
    Download as DownloadIcon,
} from "@mui/icons-material";

/* ----------------- HERO ----------------- */
function LogisticsHero() {
    const dash = 680;
    const distance = useMotionValue("0%");
    useEffect(() => {
        const controls = animate(0, 100, {
            duration: 12, repeat: Infinity, ease: "easeInOut",
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
                        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>
                <rect x="0" y="0" width="1440" height="340" fill="url(#heroGrad)" />
                {[[120, 220], [560, 100], [1020, 240], [1320, 120]].map(([x, y], i) => (
                    <g key={i} transform={`translate(${x} ${y})`} filter="url(#glow)">
                        <circle r="7" fill="#34D399" />
                        <circle r="16" fill="none" stroke="#34D399" strokeOpacity="0.5" />
                    </g>
                ))}
                <path d="M 80 230 C 260 70, 640 60, 840 180 S 1160 320, 1340 120"
                    fill="none" stroke="url(#route)" strokeWidth="3.5" strokeLinecap="round"
                    strokeDasharray={dash} opacity="0.9" />
                <motion.path
                    d="M 80 230 C 260 70, 640 60, 840 180 S 1160 320, 1340 120"
                    fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"
                    strokeDasharray={`${dash / 6} ${dash}`} initial={{ strokeDashoffset: 0 }}
                    animate={{ strokeDashoffset: -dash }} transition={{ duration: 5.8, ease: "linear", repeat: Infinity }}
                    style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.7))" }} opacity="0.6"
                />
                <motion.g transform="translate(0,0) scale(1)"
                    style={{ offsetPath: "path('M 80 230 C 260 70, 640 60, 840 180 S 1160 320, 1340 120')", offsetDistance: distance }}>
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

/* ----------------- Helpers ----------------- */
const monthKey = (d) => {
    const dt = new Date(d); if (Number.isNaN(dt.getTime())) return null;
    const m = dt.getMonth(), y = dt.getFullYear();
    return `${y}-${String(m + 1).padStart(2, "0")}`;
};
const humanMonth = (k) => {
    if (!k) return "-"; const [y, m] = k.split("-");
    const dt = new Date(Number(y), Number(m) - 1, 1);
    return dt.toLocaleDateString("tr-TR", { year: "numeric", month: "long" });
};
const getDateAny = (r) => {
    const raw = r?.tamamlanma_tarihi || r?.sefer_tarihi || r?.tarih || r?.created_at || r?.date || r?.updated_at;
    if (!raw) return null; const s = String(raw);
    return s.length >= 10 ? s.slice(0, 10) : s;
};
const fmtTR = (iso) => {
    if (!iso) return "";
    const s = String(iso).slice(0, 10);
    const [y, m, d] = s.split("-");
    if (!y || !m || !d) return s;
    return `${d}.${m}.${y}`;
};

// sayfalamalı çekiş
async function fetchAllRows(table) {
    const pageSize = 1000;
    const head = await supabase.from(table).select("*", { count: "exact", head: true });
    if (head.error) {
        const msg = head.error.message || "", code = head.error.code || "";
        if (String(code).includes("42P01")) return { rows: [], warn: `Supabase: "${table}" tablosu bulunamadı.` };
        if (msg.toLowerCase().includes("not found")) return { rows: [], warn: `Supabase REST: "${table}" (404).` };
        return { rows: [], warn: msg };
    }
    const total = head.count ?? 0; if (!total) return { rows: [], warn: "" };
    const pages = Math.ceil(total / pageSize), out = [];
    for (let p = 0; p < pages; p++) {
        const from = p * pageSize, to = from + pageSize - 1;
        const { data, error } = await supabase.from(table).select("*").range(from, to);
        if (error) return { rows: out, warn: error.message || "Sorgu hatası" };
        if (!data?.length) break; out.push(...data);
    }
    return { rows: out, warn: "" };
}

// sadece toplam sayıyı (tam) getirir
async function fetchExactCount(table) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
}

function countBosSfrPrefix(rows, field = "sefer_no") {
    let bos = 0, sfr = 0;
    for (const r of rows) {
        const v = (r?.[field] ?? "").toString().trim().toUpperCase();
        if (!v) continue; if (v.startsWith("BOS")) bos++; else if (v.startsWith("SFR")) sfr++;
    }
    return { bos, sfr };
}

/* ---- Basit bar list (müşteri TOP10) ---- */
function BarList({ data = [], max = 10, height = 20 }) {
    const top = data.slice(0, max);
    const maxVal = Math.max(1, ...top.map(d => d.value));
    return (
        <Stack spacing={1}>
            {top.map((d, i) => (
                <Stack key={d.key} direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ width: 28, opacity: 0.6 }}>{i + 1}.</Typography>
                    <Box sx={{ flex: 1 }}>
                        <Typography noWrap title={d.key} sx={{ fontWeight: 700 }}>{d.key || "—"}</Typography>
                        <Box sx={{ position: "relative", height, mt: 0.3, borderRadius: 1, bgcolor: "action.hover" }}>
                            <Box sx={{ position: "absolute", inset: 0, width: `${(d.value / maxVal) * 100}%`, bgcolor: "primary.main", borderRadius: 1 }} />
                        </Box>
                    </Box>
                    <Chip size="small" label={d.value} />
                </Stack>
            ))}
        </Stack>
    );
}

/* ---- CSV export ---- */
function downloadCSV(filename, rows, headers) {
    const headerLine = headers.map(h => `"${h.label}"`).join(",");
    const lines = rows.map(r => headers.map(h => `"${(r[h.key] ?? "").toString().replace(/"/g, '""')}"`).join(","));
    const csv = [headerLine, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ------ shared styles for table cells ------ */
const rowSX = {
    height: 40,
    "& td, & th": {
        borderBottomColor: "rgba(255,255,255,0.08)",
        verticalAlign: "middle",
        paddingTop: 0.5,
        paddingBottom: 0.5,
        lineHeight: 1.2,
    },
};
const countCellSX = { textAlign: "right", width: 80 };
const nameCellSX = { whiteSpace: "nowrap", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" };

/* ---------- İZİN TAKVİMİ yardımcıları ---------- */
function monthBounds(monthKeyStr) {
    const [y, m] = monthKeyStr.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end, days: end.getDate() };
}
function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart <= bEnd && aEnd >= bStart;
}
function clampToMonthRange(startISO, endISO, monthStart, monthEnd) {
    const s = new Date(String(startISO).slice(0, 10));
    const e = new Date(String(endISO || startISO).slice(0, 10));
    const start = s < monthStart ? monthStart : s;
    const end = e > monthEnd ? monthEnd : e;
    return { start, end };
}

/* ----------------- Page ----------------- */
export default function Anasayfa() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [tamamlanan, setTamamlanan] = useState([]);
    const [seferler, setSeferler] = useState([]);
    const [izinler, setIzinler] = useState([]);
    const [kesintiler, setKesintiler] = useState([]);

    // *** TOPLAMLAR artık "tam" sayılır (1000 limiti yok)
    const [completedTotalExact, setCompletedTotalExact] = useState(0);
    const [seferlerTotalExact, setSeferlerTotalExact] = useState(0);

    const { bos: aktifBos, sfr: aktifSfr } = useMemo(() => countBosSfrPrefix(seferler, "sefer_no"), [seferler]);
    const { bos: tamBos, sfr: tamSfr } = useMemo(() => countBosSfrPrefix(tamamlanan, "sefer_no"), [tamamlanan]);

    const allMonths = useMemo(() => {
        const set = new Set();
        for (const r of tamamlanan) {
            const mk = monthKey(getDateAny(r)); if (mk) set.add(mk);
        }
        for (const r of izinler) {
            const mk = monthKey(r?.baslangic_tarihi || r?.bitis_tarihi); if (mk) set.add(mk);
        }
        for (const r of kesintiler) {
            const mk = monthKey(r?.baslangic_tarihi || r?.bitis_tarihi); if (mk) set.add(mk);
        }
        return Array.from(set).sort().reverse();
    }, [tamamlanan, izinler, kesintiler]);

    const [selectedMonth, setSelectedMonth] = useState("ALL");
    useEffect(() => { if (allMonths.length && selectedMonth === "ALL") setSelectedMonth(allMonths[0]); }, [allMonths]); // eslint-disable-line

    const filteredCompleted = useMemo(() => {
        if (selectedMonth === "ALL") return tamamlanan;
        return tamamlanan.filter(r => monthKey(getDateAny(r)) === selectedMonth);
    }, [tamamlanan, selectedMonth]);

    const topCustomers = useMemo(() => {
        const m = new Map();
        for (const r of filteredCompleted) {
            const key = (r?.musteri_adi || r?.CustomerFullTitle || "—").toString().trim();
            if (!key) continue; m.set(key, (m.get(key) || 0) + 1);
        }
        return Array.from(m.entries()).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
    }, [filteredCompleted]);

    const driversMonthly = useMemo(() => {
        const m = new Map();
        for (const r of filteredCompleted) {
            const drv = (r?.surucu_ad_soyad || r?.FullName || "—").toString().trim();
            if (!drv) continue; m.set(drv, (m.get(drv) || 0) + 1);
        }
        const total = Array.from(m.values()).reduce((a, b) => a + b, 0) || 1;
        return Array.from(m.entries())
            .map(([driver, count]) => ({ driver, count, share: (count / total) * 100 }))
            .sort((a, b) => b.count - a.count);
    }, [filteredCompleted]);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true); setErr("");

            // Tüm satırlar (analizler için)
            const [tTam, tSef, tIzn, tKes] = await Promise.all([
                fetchAllRows("tamamlanan_seferler"),
                fetchAllRows("seferler"),
                fetchAllRows("izinler"),
                fetchAllRows("kesintiler"),
            ]);

            // Toplam sayılar (tam)
            const [cTam, cSef] = await Promise.all([
                fetchExactCount("tamamlanan_seferler"),
                fetchExactCount("seferler"),
            ]);

            const warns = [tTam.warn, tSef.warn, tIzn.warn, tKes.warn].filter(Boolean);
            if (warns.length) setErr(warns.join("  "));

            setTamamlanan(tTam.rows);
            setSeferler(tSef.rows);
            setIzinler(tIzn.rows);
            setKesintiler(tKes.rows);

            setCompletedTotalExact(cTam);
            setSeferlerTotalExact(cSef);
        } catch (e) {
            console.error(e);
            setErr((e?.message || "Veriler alınamadı.") + "");
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { fetchData(); }, [fetchData]);

    const lastUpdated = useMemo(
        () => new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        [completedTotalExact, seferlerTotalExact, izinler.length, kesintiler.length]
    );

    /* ---- İZİNLER (seçilen aya göre) ---- */
    const izinAy = useMemo(() => {
        const monthKeyToUse = selectedMonth === "ALL" ? monthKey(new Date().toISOString()) : selectedMonth;
        if (!monthKeyToUse) return { monthKeyToUse: null, rows: [], drivers: [], days: 30 };
        const { start: mStart, end: mEnd, days } = monthBounds(monthKeyToUse);

        const rows = (izinler || [])
            .filter(r => {
                const s = r?.baslangic_tarihi, e = r?.bitis_tarihi || r?.baslangic_tarihi;
                if (!s) return false;
                return overlaps(new Date(s), new Date(e), mStart, mEnd);
            })
            .map(r => {
                const { start, end } = clampToMonthRange(r.baslangic_tarihi, r.bitis_tarihi || r.baslangic_tarihi, mStart, mEnd);
                return {
                    surucu: (r?.surucu_adi || "—").toString().trim(),
                    tur: r?.izin_turu || "İzin",
                    aciklama: r?.aciklama || "",
                    gun: Number(r?.gun_sayisi || 0),
                    range: { start, end },
                    _raw: r,
                };
            });

        const drivers = Array.from(new Set(rows.map(r => r.surucu))).sort((a, b) =>
            a.localeCompare(b, "tr")
        );

        return { monthKeyToUse, rows, drivers, days };
    }, [izinler, selectedMonth]);

    /* ---- KESİNTİLER (seçilen ay) ---- */
    const kesintiAy = useMemo(() => {
        const monthKeyToUse = selectedMonth === "ALL" ? monthKey(new Date().toISOString()) : selectedMonth;
        if (!monthKeyToUse) return { rows: [], days: 30 };
        const { start: mStart, end: mEnd } = monthBounds(monthKeyToUse);

        const rows = (kesintiler || [])
            .filter(r => {
                const s = r?.baslangic_tarihi, e = r?.bitis_tarihi || r?.baslangic_tarihi;
                if (!s) return false;
                return overlaps(new Date(s), new Date(e), mStart, mEnd);
            })
            .sort((a, b) => String(a.baslangic_tarihi).localeCompare(String(b.baslangic_tarihi)));

        return { rows };
    }, [kesintiler, selectedMonth]);

    return (
        <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: (t) => (t.palette.mode === "dark" ? "#0b1020" : "#f6f9ff") }}>
            <Helmet><title>ANA SAYFA</title></Helmet>
            <Sidebar />
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Navbar />

                <Box component={motion.div} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    sx={{
                        position: "relative", py: { xs: 2, md: 4 },
                        background: (t) => (t.palette.mode === "dark"
                            ? "linear-gradient(180deg,#0b1020,#0e1428)"
                            : "linear-gradient(180deg,#f6f9ff,#f4f7ff)")
                    }}>
                    {/* HERO */}
                    <Box sx={{ position: "relative", height: 220, mb: 2 }}>
                        <LogisticsHero />
                        <Container maxWidth={false} sx={{ position: "relative", zIndex: 1, px: { xs: 2, md: 4 }, maxWidth: "1600px" }}>
                            <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }}
                                justifyContent="space-between" spacing={1}>
                                <Box>
                                    <Typography variant="h5" fontWeight={900} sx={{ pt: 2 }}>Ana Menü</Typography>
                                    <Typography sx={{ opacity: 0.7 }}>Operasyonlarınızın genel görünümü — seferler ve durumlar.</Typography>
                                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                        <Chip size="small" color="success" label="Canlı dinleme açık" />
                                        <Chip size="small" variant="outlined" label={`Son güncelleme: ${lastUpdated}`} />
                                    </Stack>
                                </Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <FormControl size="small" sx={{ minWidth: 220 }}>
                                        <InputLabel>Ay Filtresi</InputLabel>
                                        <Select label="Ay Filtresi" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                                            <MenuItem value="ALL">Tümü</MenuItem>
                                            {allMonths.map(m => (<MenuItem key={m} value={m}>{humanMonth(m)}</MenuItem>))}
                                        </Select>
                                    </FormControl>
                                    <Tooltip title="Yenile">
                                        <span>
                                            <IconButton onClick={fetchData} disabled={loading} color="primary">
                                                {loading ? <CircularProgress size={18} /> : <RefreshIcon />}
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Stack>
                        </Container>
                    </Box>

                    {/* CONTENT */}
                    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, maxWidth: "1600px" }}>
                        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

                        {/* SUMMARY CARDS */}
                        <Grid container spacing={2.4}>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <Paper elevation={6} sx={cardSX}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <TruckIcon /><Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Tamamlanan Seferler</Typography>
                                    </Stack>
                                    {/* TAM SAYI */}
                                    <Typography variant="h4" fontWeight={900} sx={{ mt: 0.5 }}>{completedTotalExact}</Typography>
                                    <Chip size="small" variant="outlined" label="tamamlanan_seferler" sx={{ mt: 1 }} />
                                </Paper>
                            </Grid>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <Paper elevation={6} sx={cardSX}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <VehicleIcon /><Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Toplam Sefer (seferler)</Typography>
                                    </Stack>
                                    {/* TAM SAYI */}
                                    <Typography variant="h4" fontWeight={900} sx={{ mt: 0.5 }}>{seferlerTotalExact}</Typography>
                                    <Chip size="small" variant="outlined" label="seferler" sx={{ mt: 1 }} />
                                </Paper>
                            </Grid>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <Paper elevation={6} sx={cardSX}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <TaskIcon /><Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Aktif BOS / SFR</Typography>
                                    </Stack>
                                    <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
                                        {aktifBos} <Typography component="span" variant="body2" sx={{ opacity: .65 }}>BOS</Typography>
                                        &nbsp;|&nbsp; {aktifSfr} <Typography component="span" variant="body2" sx={{ opacity: .65 }}>SFR</Typography>
                                    </Typography>
                                    <Chip size="small" variant="outlined" label="seferler.sefer_no startsWith" sx={{ mt: 1 }} />
                                </Paper>
                            </Grid>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <Paper elevation={6} sx={cardSX}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <TaskIcon /><Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Tamamlanan BOS / SFR</Typography>
                                    </Stack>
                                    <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
                                        {tamBos} <Typography component="span" variant="body2" sx={{ opacity: .65 }}>BOS</Typography>
                                        &nbsp;|&nbsp; {tamSfr} <Typography component="span" variant="body2" sx={{ opacity: .65 }}>SFR</Typography>
                                    </Typography>
                                    <Chip size="small" variant="outlined" label="tamamlanan_seferler.sefer_no startsWith" sx={{ mt: 1 }} />
                                </Paper>
                            </Grid>
                        </Grid>

                        {/* TOP CUSTOMERS + DRIVERS TABLE */}
                        <Grid container spacing={2.4} sx={{ mt: 0.5 }}>
                            {/* MÜŞTERİLER */}
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                                        <Typography variant="subtitle1" fontWeight={800}>
                                            {selectedMonth === "ALL" ? "Tüm zamanlar" : humanMonth(selectedMonth)} — En çok iş yapılan Müşteriler (TOP 10)
                                        </Typography>
                                        <Button
                                            size="small"
                                            startIcon={<DownloadIcon />}
                                            onClick={() =>
                                                downloadCSV(
                                                    `top_musteriler_${selectedMonth === "ALL" ? "tum" : selectedMonth}.csv`,
                                                    topCustomers.map((x) => ({ musteri: x.key, sefer: x.value })),
                                                    [
                                                        { key: "musteri", label: "Müşteri" },
                                                        { key: "sefer", label: "Sefer Sayısı" },
                                                    ]
                                                )
                                            }
                                        >
                                            CSV
                                        </Button>
                                    </Stack>
                                    <Box sx={{ mt: 1.5, flex: 1, overflow: "auto" }}>
                                        <BarList data={topCustomers} />
                                    </Box>
                                </Paper>
                            </Grid>

                            {/* ŞOFÖRLER */}
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                                        <Typography variant="subtitle1" fontWeight={800}>
                                            {selectedMonth === "ALL" ? "Tüm zamanlar" : humanMonth(selectedMonth)} — Şoför Başına Sefer
                                        </Typography>
                                        <Button
                                            size="small"
                                            startIcon={<DownloadIcon />}
                                            onClick={() =>
                                                downloadCSV(
                                                    `sofor_aylik_${selectedMonth === "ALL" ? "tum" : selectedMonth}.csv`,
                                                    driversMonthly.map((x) => ({
                                                        sofor: x.driver,
                                                        sefer: x.count,
                                                        pay: x.share.toFixed(1) + "%",
                                                    })),
                                                    [
                                                        { key: "sofor", label: "Şoför" },
                                                        { key: "sefer", label: "Sefer Sayısı" },
                                                        { key: "pay", label: "Pay" },
                                                    ]
                                                )
                                            }
                                        >
                                            CSV
                                        </Button>
                                    </Stack>
                                    <Box sx={{ mt: 1, flex: 1, overflow: "auto" }}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow sx={rowSX}>
                                                    <TableCell>#</TableCell>
                                                    <TableCell>Şoför</TableCell>
                                                    <TableCell align="right">Sefer</TableCell>
                                                    <TableCell align="right">Pay</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {driversMonthly.slice(0, 200).map((r, idx) => (
                                                    <TableRow key={r.driver || idx} hover sx={rowSX}>
                                                        <TableCell width={32}>{idx + 1}</TableCell>
                                                        <TableCell sx={nameCellSX}>{r.driver || "—"}</TableCell>
                                                        <TableCell align="right" sx={countCellSX}>
                                                            <Chip size="small" label={r.count} sx={{ height: 22 }} />
                                                        </TableCell>
                                                        <TableCell align="right">{r.share.toFixed(1)}%</TableCell>
                                                    </TableRow>
                                                ))}
                                                {driversMonthly.length === 0 && (
                                                    <TableRow sx={rowSX}>
                                                        <TableCell colSpan={4}>
                                                            <Typography sx={{ opacity: 0.7 }}>Kayıt yok.</Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                </Paper>
                            </Grid>
                        </Grid>

                        {/* İZİN TAKVİMİ + KESİNTİLER */}
                        <Grid container spacing={2.4} sx={{ mt: 0.5 }}>
                            {/* İZİN TAKVİMİ */}
                            <Grid size={{ xs: 12, md: 8 }}>
                                <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                                        <Typography variant="subtitle1" fontWeight={800}>
                                            {humanMonth(izinAy.monthKeyToUse || (selectedMonth === "ALL" ? monthKey(new Date().toISOString()) : selectedMonth))} — İzin Takvimi
                                        </Typography>
                                        <Chip size="small" variant="outlined" label={`${izinAy.rows.length} kayıt • ${izinAy.drivers.length} şoför`} />
                                    </Stack>

                                    {/* Gün başlıkları */}
                                    <Box sx={{ mt: 1, pl: 1, pr: 1 }}>
                                        <Box sx={{ display: "grid", gridTemplateColumns: "220px 1fr", alignItems: "center", color: "text.secondary", fontSize: 12 }}>
                                            <Box>Şoför</Box>
                                            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${izinAy.days}, 1fr)`, gap: "2px" }}>
                                                {Array.from({ length: izinAy.days }, (_, i) => (
                                                    <Box key={i} sx={{ textAlign: "center" }}>{i + 1}</Box>
                                                ))}
                                            </Box>
                                        </Box>
                                    </Box>

                                    {/* Satırlar */}
                                    <Box sx={{ mt: 1, flex: 1, overflow: "auto", pb: 1 }}>
                                        {izinAy.drivers.map((drv) => {
                                            const items = izinAy.rows.filter(r => r.surucu === drv);
                                            return (
                                                <Box key={drv} sx={{ display: "grid", gridTemplateColumns: "220px 1fr", alignItems: "center", minHeight: 36, mb: 0.5 }}>
                                                    <Box sx={{ pr: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700 }}>{drv}</Box>
                                                    <Box sx={{ position: "relative" }}>
                                                        <Box sx={{
                                                            display: "grid",
                                                            gridTemplateColumns: `repeat(${izinAy.days}, 1fr)`,
                                                            gap: "2px",
                                                            height: 22,
                                                            alignItems: "center"
                                                        }}>
                                                            {Array.from({ length: izinAy.days }, (_, i) => (
                                                                <Box key={i} sx={{ height: 6, bgcolor: "action.hover", borderRadius: 1 }} />
                                                            ))}
                                                        </Box>
                                                        <Box sx={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${izinAy.days}, 1fr)`, gap: "2px" }}>
                                                            {items.map((it, idx) => {
                                                                const dayStart = it.range.start.getDate();
                                                                const dayEnd = it.range.end.getDate();
                                                                return (
                                                                    <Box
                                                                        key={idx}
                                                                        sx={{
                                                                            gridColumn: `${dayStart} / ${dayEnd + 1}`,
                                                                            alignSelf: "center",
                                                                            height: 18,
                                                                            borderRadius: 1.5,
                                                                            bgcolor: "warning.light",
                                                                            color: "warning.contrastText",
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                            px: 0.6,
                                                                            overflow: "hidden",
                                                                            whiteSpace: "nowrap",
                                                                            textOverflow: "ellipsis",
                                                                            boxShadow: 1
                                                                        }}
                                                                        title={`${it.tur} • ${fmtTR(it.range.start.toISOString())} - ${fmtTR(it.range.end.toISOString())} (${it.gun || "?"} gün) ${it.aciklama ? " — " + it.aciklama : ""}`}
                                                                    >
                                                                        {it.tur}
                                                                    </Box>
                                                                );
                                                            })}
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                        {izinAy.drivers.length === 0 && (
                                            <Box sx={{ p: 2, opacity: 0.7 }}>Bu ay için izin kaydı yok.</Box>
                                        )}
                                    </Box>
                                </Paper>
                            </Grid>

                            {/* KESİNTİLER */}
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                                        <Typography variant="subtitle1" fontWeight={800}>
                                            {selectedMonth === "ALL" ? humanMonth(monthKey(new Date().toISOString())) : humanMonth(selectedMonth)} — Kesintiler
                                        </Typography>
                                        <Button
                                            size="small"
                                            startIcon={<DownloadIcon />}
                                            onClick={() =>
                                                downloadCSV(
                                                    `kesintiler_${selectedMonth === "ALL" ? monthKey(new Date().toISOString()) : selectedMonth}.csv`,
                                                    kesintiAy.rows.map((k) => ({
                                                        tur: k.kesinti_turu || "",
                                                        baslangic: fmtTR(k.baslangic_tarihi),
                                                        bitis: fmtTR(k.bitis_tarihi || k.baslangic_tarihi),
                                                        gun: k.gun_sayisi || "",
                                                        plaka_treyler: k.plaka_treyler || "",
                                                        neden: k.neden || "",
                                                        aciklama: k.aciklama || "",
                                                    })),
                                                    [
                                                        { key: "tur", label: "Kesinti Türü" },
                                                        { key: "baslangic", label: "Başlangıç" },
                                                        { key: "bitis", label: "Bitiş" },
                                                        { key: "gun", label: "Gün" },
                                                        { key: "plaka_treyler", label: "Plaka/Treyler" },
                                                        { key: "neden", label: "Neden" },
                                                        { key: "aciklama", label: "Açıklama" },
                                                    ]
                                                )
                                            }
                                        >
                                            CSV
                                        </Button>
                                    </Stack>

                                    <Box sx={{ mt: 1, flex: 1, overflow: "auto" }}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow sx={rowSX}>
                                                    <TableCell>Tarih</TableCell>
                                                    <TableCell>Tür</TableCell>
                                                    <TableCell>Plaka</TableCell>
                                                    <TableCell>Neden</TableCell>
                                                    <TableCell align="right">Gün</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {kesintiAy.rows.map((k, i) => (
                                                    <TableRow key={i} hover sx={rowSX}>
                                                        <TableCell>
                                                            {fmtTR(k.baslangic_tarihi)}
                                                            {k.bitis_tarihi && ` - ${fmtTR(k.bitis_tarihi)}`}
                                                        </TableCell>
                                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{k.kesinti_turu || "—"}</TableCell>
                                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{k.plaka_treyler || "—"}</TableCell>
                                                        <TableCell title={k.aciklama || ""} sx={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {k.neden || "—"}
                                                        </TableCell>
                                                        <TableCell align="right">{k.gun_sayisi ?? "—"}</TableCell>
                                                    </TableRow>
                                                ))}
                                                {kesintiAy.rows.length === 0 && (
                                                    <TableRow sx={rowSX}>
                                                        <TableCell colSpan={5}><Typography sx={{ opacity: .7 }}>Bu ay için kesinti kaydı yok.</Typography></TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                </Paper>
                            </Grid>
                        </Grid>

                        <Divider sx={{ my: 3, opacity: 0.2 }} />
                        <Typography sx={{ opacity: 0.7, mb: 1.5 }}>
                            İsteğe göre müşteri/şoför kırılımlarına ve izin/kesinti panellerine yeni metrikler (km, proje, şehir) eklenebilir.
                        </Typography>
                    </Container>
                </Box>
            </Box>
        </Box>
    );
}

/* ------ styles ------ */
const cardSX = {
    borderRadius: 3, p: 2, backdropFilter: "saturate(140%) blur(8px)",
    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
    border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`
};
const panelSX = {
    p: 2, borderRadius: 3,
    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
    border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`
};
