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
} from "@mui/material";
import {
    Search as SearchIcon,
    Refresh as RefreshIcon,
    Download as DownloadIcon,
    CheckCircle as CheckCircleIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
    HourglassBottom as HourglassBottomIcon,
    ErrorOutline as ErrorOutlineIcon,
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
// Uygulamanızdaki gerçek ana sayfa yolu
const HOME_PATH = "/anasayfa"; // sizde neyse: "/dashboard" vb.

const IST_TZ = "Europe/Istanbul";

const DURUM_RENK = {
    // backend'deki durum string'lerine göre güncelle
    TAMAMLANDI: { color: "success", icon: <CheckCircleIcon fontSize="small" /> },
    BEKLEMEDE: { color: "warning", icon: <HourglassBottomIcon fontSize="small" /> },
    "DEVAM EDİYOR": { color: "info", icon: <RadioButtonUncheckedIcon fontSize="small" /> },
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
            transition={{ duration: 0.35, ease: "easeOut" }}
            sx={{
                minHeight: "100dvh",
                py: { xs: 2, md: 4 },
                background: (t) =>
                    t.palette.mode === "dark"
                        ? "linear-gradient(180deg,#0b1020,#0e1428)"
                        : "linear-gradient(180deg,#f6f9ff,#f4f7ff)",
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
                    elevation={6}
                    sx={{
                        borderRadius: 4,
                        overflow: "hidden",
                        backdropFilter: "saturate(140%) blur(10px)",
                        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
                        border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                    }}
                >
                    {/* Üst Şerit */}
                    <Box
                        sx={{
                            px: { xs: 2, md: 3 },
                            py: { xs: 1.5, md: 2.25 },
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 2,
                            flexWrap: "wrap",
                        }}
                    >
                        <Typography variant="h6" fontWeight={800}>
                            Tüm Görevler
                        </Typography>

                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flex: 1, justifyContent: "flex-end" }}>
                            <TextField
                                placeholder="Başlık / açıklama / durum / kullanıcı ara…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                size="small"
                                sx={{ minWidth: 260, maxWidth: 420 }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ opacity: 0.7 }} />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <Tooltip title="Yenile">
                                <span>
                                    <IconButton onClick={fetchGorevler} disabled={loading}>
                                        <RefreshIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                            {/* ⬇️ Eklendi: Geri & Anasayfa (işlevlere dokunmadan) */}
                            <Button size="small" variant="outlined" onClick={() => navigate(-1)}>
                                Geri
                            </Button>
                            <Button variant="text" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)}>
                                Anasayfa
                            </Button>

                            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCSV} disabled={loading || !filtered.length}>
                                Dışa Aktar (CSV)
                            </Button>
                        </Stack>
                    </Box>

                    {/* Sayaçlar */}
                    <Box sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
                        <Stack direction="row" spacing={1.25} flexWrap="wrap">
                            <Chip variant="outlined" label={`Toplam: ${sayilar.toplam}`} />
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
                        </Stack>
                    </Box>

                    <Divider />

                    {/* İçerik */}
                    <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
                        {loading ? (
                            <Grid container spacing={2.5}>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Grid item xs={12} sm={6} lg={4} key={i}>
                                        <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                            <CardHeader
                                                title={<Skeleton width="60%" />}
                                                subheader={<Skeleton width="40%" />}
                                                sx={{ pb: 0 }}
                                            />
                                            <CardContent>
                                                <Stack spacing={1}>
                                                    <Skeleton variant="text" width="80%" />
                                                    <Skeleton variant="text" width="70%" />
                                                    <Skeleton variant="text" width="90%" />
                                                    <Skeleton variant="rectangular" height={24} />
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : filtered.length === 0 ? (
                            <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={2}>
                                <ErrorOutlineIcon sx={{ fontSize: 56, opacity: 0.55 }} />
                                <Typography variant="h6" fontWeight={700} sx={{ opacity: 0.85 }}>
                                    Görev bulunamadı
                                </Typography>
                                <Typography sx={{ opacity: 0.7, textAlign: "center" }}>
                                    Filtreyi temizleyip tekrar deneyebilir ya da sayfayı yenileyebilirsiniz.
                                </Typography>
                            </Stack>
                        ) : (
                            <Grid container spacing={2.5}>
                                {filtered.map((g) => {
                                    const durumKey = (g.durum || "").toUpperCase();
                                    const m = DURUM_RENK[durumKey] || {};
                                    return (
                                        <Grid item xs={12} sm={6} lg={4} key={g.id}>
                                            <Card
                                                variant="outlined"
                                                component={motion.div}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.25, ease: "easeOut" }}
                                                sx={{ borderRadius: 3, height: "100%" }}
                                            >
                                                <CardHeader
                                                    title={
                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                            <Typography variant="subtitle1" fontWeight={800} noWrap title={g.baslik}>
                                                                {g.baslik || "-"}
                                                            </Typography>
                                                            <Chip
                                                                size="small"
                                                                color={m.color || "default"}
                                                                variant="outlined"
                                                                icon={m.icon || undefined}
                                                                label={g.durum || "-"}
                                                            />
                                                        </Stack>
                                                    }
                                                    subheader={
                                                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                                            Görev Veren: <b>{g.atayan?.kullanici || "-"}</b>
                                                        </Typography>
                                                    }
                                                />
                                                <CardContent sx={{ pt: 0 }}>
                                                    <Stack spacing={0.75}>
                                                        <Row label="Görev Verilen Tarih" value={fmtDT(g.gorev_verilen_tarih)} />
                                                        <Row label="Görev Alan" value={g.atanan?.kullanici || "-"} />
                                                        {g.aciklama && <Row label="Açıklama" value={g.aciklama} multiline />}
                                                        <Row label="Son Teslim Tarihi" value={fmtDT(g.duedate)} />
                                                        <Row label="Görev Kabul" value={fmtDT(g.gorev_kabul_tarih)} />
                                                        <Row label="Tamamlanma" value={fmtDT(g.teslim_tarihi)} />
                                                        {g.kullanici_aciklama && (
                                                            <Row label="Kullanıcı Açıklaması" value={g.kullanici_aciklama} multiline />
                                                        )}
                                                    </Stack>
                                                </CardContent>
                                            </Card>
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

/** Küçük bilgi satırı bileşeni */
function Row({ label, value, multiline = false }) {
    return (
        <Stack direction="row" spacing={1} alignItems="flex-start">
            <Typography variant="body2" sx={{ opacity: 0.7, minWidth: 170 }}>
                {label} :
            </Typography>
            {multiline ? (
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {value}
                </Typography>
            ) : (
                <Typography variant="body2" noWrap title={String(value || "")}>
                    {value}
                </Typography>
            )}
        </Stack>
    );
}
