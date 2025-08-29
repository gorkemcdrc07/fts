// src/Gorevler/BenimGorevlerim.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../supabaseClient";

/** UI & Animations */
import { motion } from "framer-motion";
import {
    Box,
    Container,
    Paper,
    Typography,
    Stack,
    Chip,
    Button,
    IconButton,
    Tooltip,
    Grid,
    Card,
    CardHeader,
    CardContent,
    Divider,
    Snackbar,
    Alert,
    Skeleton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
} from "@mui/material";
import {
    CheckCircle as CheckCircleIcon,
    RocketLaunch as RocketLaunchIcon,
    HourglassBottom as HourglassBottomIcon,
    TaskAlt as TaskAltIcon,
    ErrorOutline as ErrorOutlineIcon,
    Refresh as RefreshIcon,
} from "@mui/icons-material";

/** Dates */
import dayjs from "dayjs";
import "dayjs/locale/tr";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("tr");
const IST_TZ = "Europe/Istanbul";

/* ---------- Helpers ---------- */
const DURUM = {
    BEKLEMEDE: "Beklemede",
    ISLEME_ALINDI: "İşleme Alındı",
    TAMAMLANDI: "Tamamlandı",
};

const DURUM_MAP = {
    [DURUM.BEKLEMEDE]: { color: "warning", icon: <HourglassBottomIcon fontSize="small" /> },
    [DURUM.ISLEME_ALINDI]: { color: "info", icon: <RocketLaunchIcon fontSize="small" /> },
    [DURUM.TAMAMLANDI]: { color: "success", icon: <TaskAltIcon fontSize="small" /> },
};

const fmtDT = (value, withTime = true) => {
    if (!value) return "-";
    const d = dayjs(value).tz(IST_TZ);
    if (!d.isValid()) return "-";
    return withTime ? d.format("DD.MM.YYYY HH:mm") : d.format("DD.MM.YYYY");
};

/** Küçük satır bileşeni */
function Row({ label, value, multiline = false }) {
    return (
        <Stack direction="row" spacing={1} alignItems="flex-start">
            <Typography variant="body2" sx={{ opacity: 0.7, minWidth: 160 }}>
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

/** Tamamlama açıklaması diyaloğu */
function CompleteDialog({ open, onClose, onConfirm, loading }) {
    const [text, setText] = useState("");
    useEffect(() => {
        if (!open) setText("");
    }, [open]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>Görevi Tamamla</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>
                    Tamamlama için kısa bir açıklama girin (zorunlu):
                </Typography>
                <TextField
                    autoFocus
                    multiline
                    minRows={3}
                    fullWidth
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Ne yaptınız? Son durum nedir? Varsa ek notlar…"
                />
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose}>Vazgeç</Button>
                <Button
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => onConfirm(text.trim())}
                    disabled={loading || !text.trim()}
                >
                    Tamamla
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/* ---------- Main Component ---------- */
export default function BenimGorevlerim() {
    const [gorevler, setGorevler] = useState([]);
    const [loading, setLoading] = useState(true);
    const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

    const girisYapan = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("girisYapanKullanici"));
        } catch {
            return null;
        }
    }, []);
    const kullaniciId = girisYapan?.id;

    const [completeOpen, setCompleteOpen] = useState(false);
    const [completingId, setCompletingId] = useState(null);
    const [completingLoading, setCompletingLoading] = useState(false);

    const fetchGorevler = useCallback(async () => {
        if (!kullaniciId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("gorevler")
            .select("*")
            .eq("atananid", kullaniciId)
            .neq("durum", DURUM.TAMAMLANDI)
            .order("duedate", { ascending: true });

        if (error) {
            console.error("Görev alınamadı:", error.message);
            setGorevler([]);
            setSnack({ open: true, type: "error", msg: "Görevler alınamadı." });
        } else {
            setGorevler(data || []);
        }
        setLoading(false);
    }, [kullaniciId]);

    /** İlk yükleme + okundu işaretleme */
    useEffect(() => {
        if (!kullaniciId) return;

        const markRead = async () => {
            await supabase
                .from("gorevler")
                .update({ okundu: true })
                .eq("atananid", kullaniciId)
                .eq("okundu", false);
        };

        fetchGorevler();
        markRead();
    }, [kullaniciId, fetchGorevler]);

    /** Realtime: bildirimler (bu kullanıcıya gelen INSERT) */
    useEffect(() => {
        if (!kullaniciId) return;
        const channel = supabase
            .channel("bildirim-kanali")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "bildirimler",
                    filter: `kullanici_id=eq.${kullaniciId}`,
                },
                (payload) => {
                    // Sessiz alert yerine modern snackbar
                    setSnack({
                        open: true,
                        type: "info",
                        msg: payload?.new?.mesaj || "Yeni bildirim",
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [kullaniciId]);

    /** Durum güncelleme */
    const guncelleDurum = async (id, yeniDurum) => {
        try {
            const updateData = { durum: yeniDurum };
            const simdiISO = dayjs().utc().toISOString();
            const gorev = gorevler.find((g) => g.id === id);

            if (yeniDurum === DURUM.ISLEME_ALINDI) {
                updateData.gorev_kabul_tarih = simdiISO;

                if (gorev) {
                    await supabase.from("bildirimler").insert([
                        {
                            kullanici_id: gorev.atayanid,
                            mesaj: `${girisYapan?.kullaniciAdi || "Kullanıcı"} "${gorev.baslik}" görevini kabul etti.`,
                        },
                    ]);
                }
            }

            if (yeniDurum === DURUM.TAMAMLANDI) {
                // Bu branch sadece dialog onayından sonra çalıştırılacak
                updateData.teslim_tarihi = simdiISO;
            }

            const { error } = await supabase.from("gorevler").update(updateData).eq("id", id);
            if (error) throw error;

            if (yeniDurum === DURUM.TAMAMLANDI) {
                setGorevler((prev) => prev.filter((g) => g.id !== id));
            } else {
                setGorevler((prev) =>
                    prev.map((g) => (g.id === id ? { ...g, durum: yeniDurum, ...updateData } : g))
                );
            }
        } catch (err) {
            console.error("Durum güncellenemedi:", err.message);
            setSnack({ open: true, type: "error", msg: "Durum güncellenemedi." });
        }
    };

    /** İşleme Al — tek tık */
    const handleAccept = async (id) => {
        await guncelleDurum(id, DURUM.ISLEME_ALINDI);
        setSnack({ open: true, type: "success", msg: "Görev işleme alındı." });
    };

    /** Tamamla — dialog ile açıklama al */
    const openComplete = (id) => {
        setCompletingId(id);
        setCompleteOpen(true);
    };

    const confirmComplete = async (desc) => {
        if (!completingId) return;
        setCompletingLoading(true);
        try {
            const simdiISO = dayjs().utc().toISOString();
            const gorev = gorevler.find((g) => g.id === completingId);

            const { error } = await supabase
                .from("gorevler")
                .update({
                    durum: DURUM.TAMAMLANDI,
                    teslim_tarihi: simdiISO,
                    kullanici_aciklama: desc,
                })
                .eq("id", completingId);
            if (error) throw error;

            // Bildirim
            if (gorev) {
                await supabase.from("bildirimler").insert([
                    {
                        kullanici_id: gorev.atayanid,
                        mesaj: `${girisYapan?.kullaniciAdi || "Kullanıcı"} "${gorev.baslik}" görevini tamamladı.`,
                    },
                ]);
            }

            setGorevler((prev) => prev.filter((g) => g.id !== completingId));
            setSnack({ open: true, type: "success", msg: "Görev tamamlandı." });
            setCompleteOpen(false);
            setCompletingId(null);
        } catch (err) {
            console.error(err.message);
            setSnack({ open: true, type: "error", msg: "Görev tamamlanamadı." });
        } finally {
            setCompletingLoading(false);
        }
    };

    const sayilar = useMemo(() => {
        const toplam = gorevler.length;
        const bekleyen = gorevler.filter((g) => (g.durum || "").toUpperCase() === DURUM.BEKLEMEDE.toUpperCase()).length;
        const islemde = gorevler.filter((g) => (g.durum || "").toUpperCase() === DURUM.ISLEME_ALINDI.toUpperCase()).length;
        return { toplam, bekleyen, islemde };
    }, [gorevler]);

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
                    maxWidth: "1400px",
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
                            Aktif Görevlerim
                        </Typography>

                        <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                            <Chip variant="outlined" label={`Toplam: ${sayilar.toplam}`} />
                            <Chip
                                color="warning"
                                variant="outlined"
                                icon={<HourglassBottomIcon fontSize="small" />}
                                label={`Beklemede: ${sayilar.bekleyen}`}
                            />
                            <Chip
                                color="info"
                                variant="outlined"
                                icon={<RocketLaunchIcon fontSize="small" />}
                                label={`İşleme Alındı: ${sayilar.islemde}`}
                            />

                            <Tooltip title="Yenile">
                                <span>
                                    <IconButton onClick={fetchGorevler} disabled={loading}>
                                        <RefreshIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
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
                                                title={<Skeleton width="70%" />}
                                                subheader={<Skeleton width="40%" />}
                                                sx={{ pb: 0 }}
                                            />
                                            <CardContent>
                                                <Stack spacing={1}>
                                                    <Skeleton variant="text" width="80%" />
                                                    <Skeleton variant="text" width="90%" />
                                                    <Skeleton variant="rectangular" height={28} />
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : gorevler.length === 0 ? (
                            <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={2}>
                                <ErrorOutlineIcon sx={{ fontSize: 56, opacity: 0.55 }} />
                                <Typography variant="h6" fontWeight={700} sx={{ opacity: 0.85 }}>
                                    Size atanmış aktif görev bulunmuyor
                                </Typography>
                                <Typography sx={{ opacity: 0.7, textAlign: "center" }}>
                                    Detaylar geldiğinde burada görünecek.
                                </Typography>
                            </Stack>
                        ) : (
                            <Grid container spacing={2.5}>
                                {gorevler.map((g) => {
                                    const durumKey = (g.durum || "").toUpperCase();
                                    const meta =
                                        DURUM_MAP[
                                        durumKey === "İSLEME ALINDI" ? DURUM.ISLEME_ALINDI : durumKey /* türkçe i/İ normalize */
                                        ] || DURUM_MAP[DURUM.BEKLEMEDE];

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
                                                        <Stack direction="row" spacing={1} alignItems="center">
                                                            <Typography variant="subtitle1" fontWeight={800} noWrap title={g.baslik}>
                                                                {g.baslik || "-"}
                                                            </Typography>
                                                            <Chip
                                                                size="small"
                                                                color={meta.color}
                                                                variant="outlined"
                                                                icon={meta.icon}
                                                                label={g.durum || "-"}
                                                            />
                                                        </Stack>
                                                    }
                                                    subheader={
                                                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                                            Teslim: <b>{fmtDT(g.duedate, false)}</b>
                                                        </Typography>
                                                    }
                                                />

                                                <CardContent sx={{ pt: 0 }}>
                                                    <Stack spacing={0.75}>
                                                        {g.aciklama && <Row label="Açıklama" value={g.aciklama} multiline />}
                                                        {g.gorev_kabul_tarih && (
                                                            <Row label="Görev Kabul" value={fmtDT(g.gorev_kabul_tarih)} />
                                                        )}
                                                        {g.kullanici_aciklama && (
                                                            <Row label="Kullanıcı Açıklaması" value={g.kullanici_aciklama} multiline />
                                                        )}
                                                    </Stack>

                                                    <Stack direction="row" spacing={1} sx={{ mt: 2 }} justifyContent="flex-end">
                                                        {g.durum === DURUM.BEKLEMEDE && (
                                                            <Button
                                                                variant="outlined"
                                                                color="info"
                                                                startIcon={<RocketLaunchIcon />}
                                                                onClick={() => handleAccept(g.id)}
                                                            >
                                                                Kabul Et
                                                            </Button>
                                                        )}
                                                        {g.durum === DURUM.ISLEME_ALINDI && (
                                                            <Button
                                                                variant="contained"
                                                                color="success"
                                                                startIcon={<CheckCircleIcon />}
                                                                onClick={() => openComplete(g.id)}
                                                            >
                                                                Tamamla
                                                            </Button>
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

            {/* Tamamla Diyaloğu */}
            <CompleteDialog
                open={completeOpen}
                onClose={() => setCompleteOpen(false)}
                onConfirm={confirmComplete}
                loading={completingLoading}
            />

            {/* Snackbar */}
            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((p) => ({ ...p, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert
                    onClose={() => setSnack((p) => ({ ...p, open: false }))}
                    severity={snack.type}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
