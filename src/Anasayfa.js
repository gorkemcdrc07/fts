import React, { useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { Helmet } from "react-helmet-async";
import { supabase } from "./supabaseClient";

import { motion, AnimatePresence } from "framer-motion";
import {
    Box,
    Paper,
    Stack,
    Typography,
    Grid,
    Chip,
    Divider,
    IconButton,
    Tooltip,
    CircularProgress,
    Alert,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Button,
    Table, TableHead, TableRow, TableCell, TableBody,
} from "@mui/material";
import { alpha, styled, useTheme } from "@mui/material/styles";
import {
    Refresh as RefreshIcon,
    CheckCircleOutline as CheckIcon,
    LocalShipping as TruckIcon,
    ReportProblem as AlertIcon,
    AccessTime as TimeIcon,
    CalendarToday as CalendarIcon,
    Person as PersonIcon,
    TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";

// ─── Renk Sabitleri ───────────────────────────────────────────
const ACCENT = "#6dd5ed";
const ACCENT_DARK = "#2193b0";

// ─── Styled: Tablo paneli başlığı ─────────────────────────────
const PanelTitle = styled(Typography)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    fontWeight: 700,
    fontSize: "0.95rem",
    marginBottom: theme.spacing(2),
    color: ACCENT,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
}));

// ─── Kart arka planı yardımcısı ───────────────────────────────
const cardBg = (t) =>
    t.palette.mode === "dark"
        ? alpha("#0d1520", 0.96)
        : alpha("#ffffff", 0.97);

// ─── Yardımcı: tema rengini çöz ───────────────────────────────
const resolveColor = (colorKey, theme) => {
    if (!colorKey) return ACCENT;
    if (colorKey.includes(".")) {
        const [main, shade] = colorKey.split(".");
        return theme.palette[main]?.[shade] || ACCENT;
    }
    return colorKey;
};

// ══════════════════════════════════════════════════════════════
// METRİK KARTI
// ══════════════════════════════════════════════════════════════
const MetricCard = ({ title, value, unit, icon, color, subTitle, isLoading, index = 0 }) => {
    const theme = useTheme();
    const clr = resolveColor(color, theme);

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.07, ease: "easeOut" }}
            style={{ height: "100%" }}
        >
            <Paper
                elevation={0}
                sx={{
                    p: 3,
                    height: "100%",
                    borderRadius: 3,
                    bgcolor: cardBg,
                    border: `1px solid ${alpha(clr, 0.22)}`,
                    position: "relative",
                    overflow: "hidden",
                    transition: "border-color 0.2s, transform 0.2s",
                    "&:hover": {
                        borderColor: alpha(clr, 0.5),
                        transform: "translateY(-2px)",
                    },
                    // Üst çizgi vurgusu
                    "&::before": {
                        content: '""',
                        position: "absolute",
                        top: 0, left: 0, right: 0,
                        height: "3px",
                        background: `linear-gradient(90deg, ${clr}, ${alpha(clr, 0.3)})`,
                        borderRadius: "12px 12px 0 0",
                    },
                }}
            >
                {/* İkon – sağ üst köşe */}
                <Box
                    sx={{
                        position: "absolute",
                        top: 18, right: 18,
                        color: alpha(clr, 0.18),
                        fontSize: 56,
                        lineHeight: 1,
                        "& svg": { fontSize: "inherit" },
                    }}
                >
                    {icon}
                </Box>

                <Stack spacing={0.5}>
                    <Typography
                        variant="overline"
                        sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            color: "text.secondary",
                        }}
                    >
                        {title}
                    </Typography>

                    {isLoading ? (
                        <Box sx={{ pt: 1 }}>
                            <CircularProgress size={28} sx={{ color: clr }} />
                        </Box>
                    ) : (
                        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
                            <Typography
                                sx={{
                                    fontSize: 38,
                                    fontWeight: 800,
                                    lineHeight: 1.05,
                                    color: clr,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {value ?? 0}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
                                {unit}
                            </Typography>
                        </Box>
                    )}

                    {subTitle && (
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.secondary",
                                lineHeight: 1.5,
                                display: "block",
                                pt: 0.5,
                                borderTop: `1px solid ${alpha(clr, 0.12)}`,
                                mt: 1,
                            }}
                        >
                            {subTitle}
                        </Typography>
                    )}
                </Stack>
            </Paper>
        </motion.div>
    );
};

// ══════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ══════════════════════════════════════════════════════════════
const getTodayDate = () => new Date().toISOString().slice(0, 10);
const fmtTR = (iso) => (iso ? new Date(iso).toLocaleDateString("tr-TR") : "—");

async function fetchLimited(table, limit = 50) {
    const { data, error } = await supabase.from(table).select("*").limit(limit);
    return { rows: data || [], warn: error?.message || "" };
}

const UPDATE_FIELDS = [
    "yukleme_varis_guncelleyen",
    "yukleme_cikis_guncelleyen",
    "teslim_varis_guncelleyen",
    "teslim_cikis_guncelleyen",
];
const DATE_FIELDS = [
    "yukleme_varis_guncelleme_tarihi",
    "yukleme_cikis_guncelleme_tarihi",
    "teslim_varis_guncelleme_tarihi",
    "teslim_cikis_guncelleme_tarihi",
];

function getSeferDetayUpdates(detaylar, targetDate) {
    const counts = {};
    const targetISO = targetDate.slice(0, 10);
    for (const d of detaylar) {
        for (let i = 0; i < UPDATE_FIELDS.length; i++) {
            const username = d[UPDATE_FIELDS[i]];
            const dateStr = d[DATE_FIELDS[i]]?.slice(0, 10);
            if (username && dateStr === targetISO) {
                const key = username.toString().trim() || "Bilinmeyen";
                if (!counts[key]) {
                    counts[key] = {
                        total: 0,
                        updates: Object.fromEntries(UPDATE_FIELDS.map(f => [f.replace("_guncelleyen", ""), 0])),
                    };
                }
                counts[key].total++;
                counts[key].updates[UPDATE_FIELDS[i].replace("_guncelleyen", "")]++;
            }
        }
    }
    return Object.entries(counts)
        .map(([username, data]) => ({ username, ...data }))
        .sort((a, b) => b.total - a.total);
}

const createLogEntry = (r, type, color, icon) => {
    const date = r.created_at || r.baslangic_tarihi || r.sefer_tarihi;
    const message = r.sefer_no
        ? `Sefer: ${r.sefer_no} — ${r.musteri_adi || "Bilinmeyen Müşteri"}`
        : r.izin_turu
            ? `İzin: ${r.surucu_adi} → ${r.izin_turu}`
            : r.kesinti_turu
                ? `Kesinti: ${r.plaka_treyler || r.surucu_adi} — ${r.neden || r.kesinti_turu}`
                : `Kayıt eklendi.`;
    return {
        id: `${type}-${r.id || r.sefer_no || Math.random()}`,
        type, color, icon, message,
        date: date ? new Date(date) : new Date(),
    };
};

const rowSX = {
    "& td, & th": {
        borderBottomColor: "rgba(255,255,255,0.06)",
        py: 0.9,
        lineHeight: 1.4,
    },
};

// ══════════════════════════════════════════════════════════════
// SAYFA BİLEŞENİ
// ══════════════════════════════════════════════════════════════
export default function Anasayfa() {
    const theme = useTheme();
    const today = getTodayDate();

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [selectedDate, setSelectedDate] = useState(today);
    const [dailyKPIs, setDailyKPIs] = useState({ totalActive: 0, totalCompleted: 0, totalIzin: 0, totalKesinti: 0 });
    const [tamamlanan, setTamamlanan] = useState([]);
    const [seferler, setSeferler] = useState([]);
    const [izinler, setIzinler] = useState([]);
    const [kesintiler, setKesintiler] = useState([]);
    const [seferDetaylari, setSeferDetaylari] = useState([]);

    const allActiveCount = seferler.length;

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setErr("");

            const [cActive, cCompleted, cIzin, cKesinti] = await Promise.all([
                supabase.from("seferler").select("id", { count: "exact", head: true }).eq("sefer_tarihi", today),
                supabase.from("tamamlanan_seferler").select("id", { count: "exact", head: true }).eq("tamamlanma_tarihi", today),
                supabase.from("izinler").select("id", { count: "exact", head: true }).gte("bitis_tarihi", today).lte("baslangic_tarihi", today),
                supabase.from("kesintiler").select("id", { count: "exact", head: true }).gte("bitis_tarihi", today).lte("baslangic_tarihi", today),
            ]);

            setDailyKPIs({
                totalActive: cActive.count ?? 0,
                totalCompleted: cCompleted.count ?? 0,
                totalIzin: cIzin.count ?? 0,
                totalKesinti: cKesinti.count ?? 0,
            });

            const [tTam, tSef, tIzn, tKes, tDetay] = await Promise.all([
                fetchLimited("tamamlanan_seferler", 50),
                fetchLimited("seferler", 50),
                fetchLimited("izinler", 50),
                fetchLimited("kesintiler", 50),
                supabase
                    .from("sefer_detaylari")
                    .select(`id, ${UPDATE_FIELDS.join(", ")}, ${DATE_FIELDS.join(", ")}`)
                    .limit(200),
            ]);

            const warns = [tTam.warn, tSef.warn, tIzn.warn, tKes.warn, tDetay.error?.message].filter(Boolean);
            if (warns.length) setErr(warns.join("  "));

            setTamamlanan(tTam.rows);
            setSeferler(tSef.rows);
            setIzinler(tIzn.rows);
            setKesintiler(tKes.rows);
            setSeferDetaylari(tDetay.data || []);
        } catch (e) {
            setErr("Veri alınırken hata: " + (e?.message || "Bilinmeyen hata"));
        } finally {
            setLoading(false);
        }
    }, [today]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const lastUpdated = useMemo(
        () => new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [loading],
    );

    const tp = theme.palette;

    const liveFeed = useMemo(() => {
        const logs = [];
        tamamlanan.forEach(r => logs.push(createLogEntry(r, "Tamamlandı", tp.success.main, <CheckIcon fontSize="small" />)));
        seferler.forEach(r => logs.push(createLogEntry(r, "Yeni Sefer", tp.primary.main, <TruckIcon fontSize="small" />)));
        izinler.forEach(r => logs.push(createLogEntry(r, "İzin Girişi", tp.warning.main, <CalendarIcon fontSize="small" />)));
        kesintiler.forEach(r => logs.push(createLogEntry(r, "Kesinti/Hata", tp.error.main, <AlertIcon fontSize="small" />)));
        return logs.sort((a, b) => b.date - a.date).slice(0, 15);
    }, [tamamlanan, seferler, izinler, kesintiler, tp]);

    const userUpdateCounts = useMemo(
        () => getSeferDetayUpdates(seferDetaylari, selectedDate),
        [seferDetaylari, selectedDate],
    );

    const currentDayTR = fmtTR(selectedDate);

    // ── KPI kart tanımları ──
    const kpiCards = [
        {
            title: "Aktif Sefer",
            value: dailyKPIs.totalActive,
            unit: "adet",
            icon: <TruckIcon />,
            color: ACCENT,
            subTitle: `Toplam kayıtlı: ${allActiveCount} adet`,
        },
        {
            title: "Tamamlanan",
            value: dailyKPIs.totalCompleted,
            unit: "teslimat",
            icon: <CheckIcon />,
            color: "success.main",
            subTitle: "Bugün başarıyla kapanan seferler",
        },
        {
            title: "İzinli Şoför",
            value: dailyKPIs.totalIzin,
            unit: "kayıt",
            icon: <CalendarIcon />,
            color: "warning.main",
            subTitle: "Aktif izin kaydı sayısı",
        },
        {
            title: "Kritik Kesinti",
            value: dailyKPIs.totalKesinti,
            unit: "arıza",
            icon: <AlertIcon />,
            color: "error.main",
            subTitle: "Bugün aktif arıza/kesinti",
        },
    ];

    // ── Sayfa iskelet rengi ──
    const pageBg = theme.palette.mode === "dark" ? "#080e1a" : "#f2f5f9";

    return (
        <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: pageBg }}>
            <Helmet><title>Dashboard | FTS Analiz</title></Helmet>
            <Sidebar />

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", pl: "var(--sidebar-w, 72px)" }}>
                <Navbar />

                <Box
                    component={motion.div}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    sx={{
                        flexGrow: 1,
                        pt: { xs: 2, md: 3 },
                        pb: { xs: 3, md: 5 },
                        px: { xs: 2, md: 3 },
                    }}
                >
                    {/* ── Hata ── */}
                    <AnimatePresence>
                        {err && (
                            <motion.div
                                key="err"
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                            >
                                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{err}</Alert>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Başlık + Kontroller ── */}
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        alignItems={{ xs: "flex-start", md: "center" }}
                        justifyContent="space-between"
                        spacing={2}
                        sx={{ mb: 4 }}
                    >
                        {/* Sol: Başlık */}
                        <Box>
                            <Typography
                                variant="h5"
                                fontWeight={800}
                                sx={{
                                    background: `linear-gradient(100deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    lineHeight: 1.2,
                                }}
                            >
                                Günlük Operasyon
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.3 }}>
                                {currentDayTR} tarihli anlık özet
                            </Typography>
                        </Box>

                        {/* Sağ: Tarih + Yenile */}
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            {/* Tarih Seçici */}
                            <Paper
                                elevation={0}
                                sx={{
                                    position: "relative",
                                    px: 1.5, py: 0.75,
                                    borderRadius: 2,
                                    border: `1px solid ${alpha(ACCENT, 0.3)}`,
                                    bgcolor: cardBg,
                                    cursor: "pointer",
                                }}
                            >
                                <Stack direction="row" alignItems="center" spacing={0.75}>
                                    <CalendarIcon sx={{ fontSize: 16, color: ACCENT }} />
                                    <Typography variant="body2" fontWeight={600} sx={{ color: "text.primary" }}>
                                        {currentDayTR}
                                    </Typography>
                                </Stack>
                                <Box
                                    component="input"
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    max={getTodayDate()}
                                    sx={{
                                        position: "absolute", inset: 0,
                                        opacity: 0, cursor: "pointer", width: "100%",
                                    }}
                                />
                            </Paper>

                            <Tooltip title="Yenile">
                                <IconButton
                                    onClick={fetchData}
                                    disabled={loading}
                                    size="small"
                                    sx={{
                                        color: ACCENT,
                                        border: `1px solid ${alpha(ACCENT, 0.3)}`,
                                        borderRadius: 2,
                                        bgcolor: cardBg,
                                        "&:hover": { bgcolor: alpha(ACCENT, 0.08) },
                                    }}
                                >
                                    {loading
                                        ? <CircularProgress size={16} sx={{ color: ACCENT }} />
                                        : <RefreshIcon fontSize="small" />}
                                </IconButton>
                            </Tooltip>

                            <Chip
                                size="small"
                                label={`Güncellendi: ${lastUpdated}`}
                                sx={{ fontSize: 11, color: "text.secondary", bgcolor: cardBg, border: `1px solid ${alpha(ACCENT, 0.15)}` }}
                            />
                        </Stack>
                    </Stack>

                    {/* ── KPI Kartları ── */}
                    <Grid container spacing={2.5} sx={{ mb: 4 }}>
                        {kpiCards.map((card, i) => (
                            <Grid item xs={12} sm={6} lg={3} key={card.title}>
                                <MetricCard {...card} index={i} isLoading={loading} />
                            </Grid>
                        ))}
                    </Grid>

                    {/* ── Alt Paneller ── */}
                    <Grid container spacing={2.5}>
                        {/* Detay Güncelleme Tablosu */}
                        <Grid item xs={12} md={7}>
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 3,
                                    borderRadius: 3,
                                    bgcolor: cardBg,
                                    border: `1px solid ${alpha(ACCENT, 0.18)}`,
                                    height: "100%",
                                }}
                            >
                                <PanelTitle>
                                    <TrendingUpIcon sx={{ fontSize: 16 }} />
                                    {currentDayTR} — Güncelleme Performansı
                                </PanelTitle>
                                <Divider sx={{ mb: 2, borderColor: alpha(ACCENT, 0.12) }} />

                                <Box sx={{ maxHeight: 340, overflowY: "auto" }}>
                                    <Table stickyHeader size="small">
                                        <TableHead>
                                            <TableRow sx={{
                                                "& th": {
                                                    bgcolor: theme.palette.mode === "dark"
                                                        ? alpha("#1a2235", 0.95)
                                                        : alpha("#f0f4f8", 0.95),
                                                    color: "text.secondary",
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    letterSpacing: "0.06em",
                                                    textTransform: "uppercase",
                                                    borderBottom: `1px solid ${alpha(ACCENT, 0.1)}`,
                                                },
                                            }}>
                                                <TableCell>Kullanıcı</TableCell>
                                                <TableCell align="right">Toplam</TableCell>
                                                <TableCell align="right">Yükleme</TableCell>
                                                <TableCell align="right">Teslimat</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {userUpdateCounts.map((u) => {
                                                const yukUpdates = u.updates.yukleme_varis + u.updates.yukleme_cikis;
                                                const teslimUpdates = u.updates.teslim_varis + u.updates.teslim_cikis;
                                                return (
                                                    <TableRow key={u.username} hover sx={rowSX}>
                                                        <TableCell>
                                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                                <Box sx={{
                                                                    width: 28, height: 28, borderRadius: "50%",
                                                                    bgcolor: alpha(ACCENT, 0.12),
                                                                    color: ACCENT,
                                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                                    fontSize: 11, fontWeight: 700,
                                                                    flexShrink: 0,
                                                                }}>
                                                                    {u.username.slice(0, 2).toUpperCase()}
                                                                </Box>
                                                                <Typography variant="body2" fontWeight={600}>{u.username}</Typography>
                                                            </Stack>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Chip
                                                                size="small"
                                                                label={u.total}
                                                                sx={{
                                                                    bgcolor: alpha(ACCENT, 0.12),
                                                                    color: ACCENT,
                                                                    fontWeight: 700,
                                                                    fontSize: 12,
                                                                    height: 22,
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Typography variant="body2" fontWeight={600} sx={{ color: tp.info.main }}>
                                                                {yukUpdates}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Typography variant="body2" fontWeight={600} sx={{ color: tp.success.main }}>
                                                                {teslimUpdates}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {userUpdateCounts.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4}>
                                                        <Typography variant="body2" sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
                                                            Bu tarihte güncelleme yapılmamış.
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Box>

                                <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.disabled" }}>
                                    * V. = Varış &nbsp;·&nbsp; Ç. = Çıkış güncelleme sayılarıdır.
                                </Typography>
                            </Paper>
                        </Grid>

                        {/* Canlı Aktivite Akışı */}
                        <Grid item xs={12} md={5}>
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 3,
                                    borderRadius: 3,
                                    bgcolor: cardBg,
                                    border: `1px solid ${alpha(ACCENT, 0.18)}`,
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                <PanelTitle>
                                    <TimeIcon sx={{ fontSize: 16 }} />
                                    Son Aktiviteler
                                </PanelTitle>
                                <Divider sx={{ mb: 2, borderColor: alpha(ACCENT, 0.12) }} />

                                <List dense disablePadding sx={{ overflowY: "auto", maxHeight: 320, flex: 1 }}>
                                    <AnimatePresence>
                                        {liveFeed.map((log, i) => (
                                            <motion.div
                                                key={log.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.03 }}
                                            >
                                                <ListItem
                                                    disablePadding
                                                    sx={{
                                                        py: 0.75,
                                                        px: 1,
                                                        borderRadius: 1.5,
                                                        mb: 0.25,
                                                        "&:hover": { bgcolor: alpha(ACCENT, 0.05) },
                                                    }}
                                                >
                                                    <ListItemIcon sx={{ minWidth: 32, color: log.color }}>
                                                        {log.icon}
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={
                                                            <Typography variant="body2" fontWeight={600} noWrap>
                                                                {log.message}
                                                            </Typography>
                                                        }
                                                        secondary={
                                                            <Typography variant="caption" sx={{ color: "text.disabled" }}>
                                                                {log.date.toLocaleTimeString("tr-TR")}
                                                            </Typography>
                                                        }
                                                    />
                                                </ListItem>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {liveFeed.length === 0 && (
                                        <Typography variant="body2" sx={{ p: 3, color: "text.secondary", textAlign: "center" }}>
                                            Henüz aktivite yok.
                                        </Typography>
                                    )}
                                </List>

                                <Button
                                    fullWidth
                                    variant="outlined"
                                    href="/seferler"
                                    startIcon={<TruckIcon />}
                                    sx={{
                                        mt: 2,
                                        py: 1,
                                        borderRadius: 2,
                                        fontWeight: 600,
                                        borderColor: alpha(ACCENT, 0.4),
                                        color: ACCENT,
                                        "&:hover": {
                                            borderColor: ACCENT,
                                            bgcolor: alpha(ACCENT, 0.06),
                                        },
                                    }}
                                >
                                    Tüm Seferlere Git
                                </Button>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        </Box>
    );
}
