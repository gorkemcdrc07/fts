// src/Gorevler/TumGorevler.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";

/** UI & Animations */
import { motion } from "framer-motion";
import {
    Box,
    Container,
    Paper,
    Typography,
    Stack,
    Chip,
    TextField,
    InputAdornment,
    IconButton,
    Tooltip,
    Grid,
    Card,
    CardContent,
    CardHeader,
    Divider,
    Skeleton,
    Button,
    useTheme,
    CircularProgress, // <-- Eklendi
} from "@mui/material";
import {
    Search as SearchIcon,
    Refresh as RefreshIcon,
    Download as DownloadIcon,
    CheckCircle as CheckCircleIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
    HourglassBottom as HourglassBottomIcon,
    ErrorOutline as ErrorOutlineIcon,
    ArrowBackIosNew as ArrowBackIcon,
    Close as CloseIcon, // <-- Eklendi
} from "@mui/icons-material";

/** Dates */
import dayjs from "dayjs";
import "dayjs/locale/tr";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import HomeIcon from "@mui/icons-material/Home";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("tr");

// ---- Helpers ----
const HOME_PATH = "/anasayfa";
const IST_TZ = "Europe/Istanbul";

const DURUM_RENK = {
    TAMAMLANDI: { color: "success", icon: <CheckCircleIcon fontSize="small" /> },
    BEKLEMEDE: { color: "warning", icon: <HourglassBottomIcon fontSize="small" /> },
    "DEVAM EDİYOR": { color: "info", icon: <RadioButtonUncheckedIcon fontSize="small" /> },
    HATA: { color: "error", icon: <ErrorOutlineIcon fontSize="small" /> },
};

function fmtDT(value, withTime = true) {
    if (!value) return "-";
    const d = dayjs(value).tz(IST_TZ);
    if (!d.isValid()) return "-";
    return withTime ? d.format("DD.MM.YYYY HH:mm") : d.format("DD.MM.YYYY");
}

function useDebounced(val, ms = 350) {
    const [v, setV] = useState(val);
    useEffect(() => {
        const id = setTimeout(() => setV(val), ms);
        return () => clearTimeout(id);
    }, [val, ms]);
    return v;
}

// ---- Component ----
export default function TumGorevler() {
    const navigate = useNavigate();
    const theme = useTheme();

    const [gorevler, setGorevler] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const qDebounced = useDebounced(q);

    const kullaniciId = localStorage.getItem("kullaniciId");
    const kullaniciRol = localStorage.getItem("rol");

    const fetchGorevler = useCallback(async () => {
        setLoading(true);

        const base = supabase
            .from("gorevler")
            .select(
                `
        *,
        atayan:login!gorevler_atayanid_fkey(kullanici),
        atanan:login!gorevler_atananid_fkey(kullanici)
      `
            )
            .order("created_at", { ascending: false });

        const sorgu = kullaniciRol !== "YÖNETİCİ" ? base.eq("atananid", kullaniciId) : base;

        const { data, error } = await sorgu;
        if (error) {
            console.error("Görevler alınamadı:", error.message);
            setGorevler([]);
        } else {
            setGorevler(data || []);
        }
        setLoading(false);
    }, [kullaniciId, kullaniciRol]);

    useEffect(() => {
        fetchGorevler();
    }, [fetchGorevler]);

    const filtered = useMemo(() => {
        const s = (qDebounced || "").toLowerCase();
        if (!s) return gorevler;
        return gorevler.filter((g) => {
            const baslik = (g.baslik || "").toLowerCase();
            const aciklama = (g.aciklama || "").toLowerCase();
            const durum = (g.durum || "").toLowerCase();
            const atayan = (g.atayan?.kullanici || "").toLowerCase();
            const atanan = (g.atanan?.kullanici || "").toLowerCase();
            return (
                baslik.includes(s) ||
                aciklama.includes(s) ||
                durum.includes(s) ||
                atayan.includes(s) ||
                atanan.includes(s)
            );
        });
    }, [gorevler, qDebounced]);

    const sayilar = useMemo(() => {
        const toplam = filtered.length;
        const durumCounts = filtered.reduce((acc, g) => {
            const d = (g.durum || "").toUpperCase();
            acc[d] = (acc[d] || 0) + 1;
            return acc;
        }, {});
        return { toplam, durumCounts };
    }, [filtered]);

    // CSV Export
    const exportCSV = () => {
        const rows = filtered.map((g) => ({
            ID: g.id,
            Başlık: g.baslik,
            Durum: g.durum,
            "Görev Veren": g.atayan?.kullanici || "-",
            "Görev Verilen Tarih": fmtDT(g.gorev_verilen_tarih),
            "Görev Alan": g.atanan?.kullanici || "-",
            "Son Teslim": fmtDT(g.duedate),
            "Görev Kabul": fmtDT(g.gorev_kabul_tarih),
            Tamamlanma: fmtDT(g.teslim_tarihi),
            Açıklama: g.aciklama || "",
            "Kullanıcı Açıklaması": g.kullanici_aciklama || "",
        }));
        const header = Object.keys(rows[0] || {});
        const csv = [
            header.join(";"),
            ...rows.map((r) => header.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";")),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tum_gorevler_${dayjs().format("YYYYMMDD_HHmm")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Box
            component={motion.div}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            sx={{
                minHeight: "100dvh",
                py: { xs: 2, md: 4 },
                // Modernleştirilmiş Arka Plan
                background: (t) =>
                    t.palette.mode === "dark"
                        ? "radial-gradient(1200px 600px at 10% -10%, rgba(56,189,248,0.18), transparent 60%), linear-gradient(180deg,#0b1020,#0e1428)"
                        : "radial-gradient(1200px 600px at 90% 110%, rgba(109,40,249,0.08), transparent 60%), linear-gradient(180deg,#f6f9ff,#f4f7ff)",
            }}
        >
            <Container
                maxWidth={false}
                sx={{
                    maxWidth: "1680px",
                    px: { xs: 2, md: 4 },
                }}
            >
                <Paper
                    elevation={12} // Daha belirgin gölge
                    sx={{
                        borderRadius: 4, // Yumuşak köşeler
                        overflow: "hidden",
                        // Şeffaflık ve Blur efekti
                        backdropFilter: "saturate(140%) blur(12px)",
                        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.95)"),
                        border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
                        boxShadow: `0 20px 40px rgba(0,0,0,0.15)`,
                    }}
                >
                    {/* ÜST BAŞLIK VE TOOLBAR */}
                    <Box
                        sx={{
                            px: { xs: 2, md: 3 },
                            py: { xs: 1.5, md: 2.25 },
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 2,
                            flexWrap: "wrap",
                            bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(240, 245, 250, 0.6)'),
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography
                            variant="h5"
                            fontWeight={900}
                            sx={{
                                // Başlığa modern gradient renk
                                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            TÜM GÖREVLERİNİZ 🎯
                        </Typography>

                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, justifyContent: "flex-end" }}>
                            <TextField
                                placeholder="Başlık, kullanıcı veya durum ara…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                size="small"
                                sx={{ minWidth: 200, maxWidth: 350 }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ opacity: 0.7 }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: q && (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setQ("")} size="small">
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <Tooltip title="Yenile">
                                <span>
                                    <IconButton onClick={fetchGorevler} disabled={loading} color="primary" size="medium">
                                        <RefreshIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="small" sx={{ textTransform: 'none' }}>
                                Geri
                            </Button>

                            <Button variant="outlined" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)} size="small" sx={{ textTransform: 'none' }}>
                                Anasayfa
                            </Button>
                        </Stack>
                    </Box>

                    {/* Sayaçlar ve Dışa Aktar */}
                    <Box sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems="center">
                            {/* Sayaçlar */}
                            <Stack direction="row" spacing={1.5} flexWrap="wrap">
                                <Chip
                                    variant="filled"
                                    color="primary"
                                    sx={{ fontWeight: 700 }}
                                    label={`Toplam Görev: ${sayilar.toplam}`}
                                />
                                {Object.entries(sayilar.durumCounts).map(([key, val]) => {
                                    const m = DURUM_RENK[key] || {};
                                    return (
                                        <Chip
                                            key={key}
                                            color={m.color || "default"}
                                            icon={m.icon || undefined}
                                            variant="outlined"
                                            label={`${key}: ${val}`}
                                        />
                                    );
                                })}
                                {loading && <Chip label="Yükleniyor..." size="small" icon={<CircularProgress size={14} />} />}
                            </Stack>

                            {/* Dışa Aktar Butonu */}
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<DownloadIcon />}
                                onClick={exportCSV}
                                disabled={loading || !filtered.length}
                                sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
                            >
                                Tümünü Dışa Aktar (CSV)
                            </Button>
                        </Stack>
                    </Box>

                    <Divider />

                    {/* İçerik */}
                    <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
                        {loading ? (
                            // Yüklenme (Skeleton)
                            <Grid container spacing={2.5}>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Grid item xs={12} sm={6} lg={4} key={i}>
                                        <SkeletonCard />
                                    </Grid>
                                ))}
                            </Grid>
                        ) : filtered.length === 0 ? (
                            // Kayıt Bulunamadı
                            <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={2}>
                                <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main', opacity: 0.7 }} />
                                <Typography variant="h5" fontWeight={700} color="text.primary">
                                    Görev bulunamadı 😟
                                </Typography>
                                <Typography sx={{ opacity: 0.7, textAlign: "center" }}>
                                    Aradığınız kriterlere uyan bir görev yok. Lütfen arama veya filtreleri kontrol edin.
                                </Typography>
                            </Stack>
                        ) : (
                            // Görev Listesi
                            <Grid container spacing={2.5}>
                                {filtered.map((g) => {
                                    const durumKey = (g.durum || "").toUpperCase();
                                    const m = DURUM_RENK[durumKey] || {};
                                    return (
                                        <Grid item xs={12} sm={6} lg={4} key={g.id}>
                                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
                                                <Card
                                                    elevation={3} // Hafif yükselti
                                                    sx={{ borderRadius: 3, height: "100%", transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: theme.shadows[6] } }}
                                                >
                                                    <CardHeader
                                                        title={
                                                            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                                                <Typography variant="subtitle1" fontWeight={800} noWrap title={g.baslik} sx={{ maxWidth: '60%' }}>
                                                                    {g.baslik || "-"}
                                                                </Typography>
                                                                <Chip
                                                                    size="small"
                                                                    color={m.color || "default"}
                                                                    variant="soft" // Yumuşak dolgu
                                                                    icon={m.icon || undefined}
                                                                    label={g.durum || "-"}
                                                                />
                                                            </Stack>
                                                        }
                                                        subheader={
                                                            <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
                                                                Atayan: <b style={{ color: theme.palette.primary.dark }}>{g.atayan?.kullanici || "-"}</b>
                                                            </Typography>
                                                        }
                                                        sx={{ pb: 1 }}
                                                    />
                                                    <CardContent sx={{ pt: 0 }}>
                                                        <Divider sx={{ mb: 1.5 }} />
                                                        <Stack spacing={0.75}>
                                                            <Row label="Görev Alan" value={g.atanan?.kullanici || "-"} primary />
                                                            <Row label="Görev Tarihi" value={fmtDT(g.gorev_verilen_tarih)} />
                                                            <Row label="Son Teslim" value={fmtDT(g.duedate)} highlight />
                                                            {g.aciklama && <Row label="Açıklama" value={g.aciklama} multiline />}
                                                            <Row label="Kabul Tarihi" value={fmtDT(g.gorev_kabul_tarih)} />
                                                            <Row label="Tamamlanma" value={fmtDT(g.teslim_tarihi)} />
                                                            {g.kullanici_aciklama && (
                                                                <Row label="Kullanıcı Notu" value={g.kullanici_aciklama} multiline />
                                                            )}
                                                        </Stack>
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        )}
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}

// ---- Yardımcı Bileşenler ----

/** Küçük bilgi satırı bileşeni (Güncellendi) */
function Row({ label, value, multiline = false, highlight = false, primary = false }) {
    const theme = useTheme();
    const isPlaceholder = value === "-";
    const color = highlight ? theme.palette.error.main : isPlaceholder ? theme.palette.text.secondary : (primary ? theme.palette.info.main : theme.palette.text.primary);

    return (
        <Stack direction="row" spacing={1} alignItems={multiline ? "flex-start" : "center"}>
            <Typography variant="body2" sx={{ opacity: 0.7, minWidth: 120, fontWeight: 500 }}>
                {label}:
            </Typography>
            {multiline ? (
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", flexGrow: 1, color, fontSize: 13.5 }}>
                    {value}
                </Typography>
            ) : (
                <Tooltip title={String(value || "")}>
                    <Typography variant="body2" noWrap sx={{ flexGrow: 1, color, fontWeight: highlight || primary ? 600 : 400, fontSize: 13.5 }}>
                        {value}
                    </Typography>
                </Tooltip>
            )}
        </Stack>
    );
}

/** Skeleton Card Bileşeni */
function SkeletonCard() {
    return (
        <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
            <CardHeader
                avatar={<Skeleton variant="circular" width={40} height={40} />}
                title={<Skeleton width="60%" height={20} />}
                subheader={<Skeleton width="40%" height={15} />}
                sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
                <Divider sx={{ mb: 1.5 }} />
                <Stack spacing={1}>
                    <Skeleton variant="text" width="85%" />
                    <Skeleton variant="text" width="70%" />
                    <Skeleton variant="text" width="90%" />
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="75%" />
                </Stack>
            </CardContent>
        </Card>
    );
}
