// src/Gorevler/GorevAta.jsx
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
    TextField,
    Autocomplete,
    Button,
    Snackbar,
    Alert,
    Divider,
    CircularProgress,
    InputAdornment,
    useTheme, // Temayı kullanmak için eklendi
} from "@mui/material";
import {
    Add as AddIcon,
    Send as SendIcon,
    Refresh as RefreshIcon,
    People as PeopleIcon,
    Title as TitleIcon,
    Notes as NotesIcon,
    Event as EventIcon,
    ArrowBackIosNew as ArrowBackIcon, // Geri butonu için eklendi
} from "@mui/icons-material";

/** Date Picker (MUI X) */
import dayjs from "dayjs";
import "dayjs/locale/tr";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import HomeIcon from "@mui/icons-material/Home";


dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("tr");

const IST_TZ = "Europe/Istanbul";
const HOME_PATH = "/anasayfa";


export default function GorevAta() {
    const navigate = useNavigate();
    const theme = useTheme();

    const [kullanicilar, setKullanicilar] = useState([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [yenileniyor, setYenileniyor] = useState(false);

    const [form, setForm] = useState({
        baslik: "",
        aciklama: "",
        duedate: null,       // dayjs objesi
        atanan: null,        // { id, kullanici, rol }
    });

    const [hata, setHata] = useState("");
    const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
    const atayanid = Number(localStorage.getItem("kullaniciId"));

    /** Kullanıcıları getir */
    const fetchKullanicilar = useCallback(async () => {
        try {
            setYenileniyor(true);
            const { data, error } = await supabase.from("login").select("id, kullanici, rol").order("kullanici", { ascending: true });
            if (error) throw error;
            setKullanicilar(data || []);
        } catch (err) {
            console.error("Kullanıcılar alınamadı:", err.message);
            setSnack({ open: true, type: "error", msg: "Kullanıcı listesi alınamadı." });
        } finally {
            setYenileniyor(false);
            setYukleniyor(false);
        }
    }, []);

    useEffect(() => {
        fetchKullanicilar();
    }, [fetchKullanicilar]);

    /** Form doğrulama */
    const errors = useMemo(() => {
        const e = {};
        if (!form.baslik?.trim()) e.baslik = "Başlık gerekli";
        if (!form.duedate || !dayjs(form.duedate).isValid()) e.duedate = "Geçerli bir tarih seçin";
        if (!form.atanan?.id) e.atanan = "Bir kullanıcı seçin";
        return e;
    }, [form]);

    const disabled = Object.keys(errors).length > 0;

    /** Supabase insert */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setHata("");

        if (disabled) {
            setSnack({ open: true, type: "warning", msg: "Lütfen zorunlu alanları doldurun." });
            return;
        }

        try {
            // DueDate'i gün sonuna (23:59) ayarlayıp UTC ISO olarak kaydet
            const localEnd = dayjs(form.duedate).tz(IST_TZ).hour(23).minute(59).second(0).millisecond(0);
            const duedateISO = localEnd.utc().toISOString();

            const { error } = await supabase.from("gorevler").insert([
                {
                    baslik: form.baslik.trim(),
                    aciklama: form.aciklama?.trim() || "",
                    duedate: duedateISO,
                    atayanid,
                    atananid: Number(form.atanan.id),
                    durum: "Beklemede",
                    okundu: false,
                    gorev_verilen_tarih: dayjs().utc().toISOString(),
                },
            ]);

            if (error) throw error;

            setSnack({ open: true, type: "success", msg: "Görev başarıyla oluşturuldu." });
            // küçük bir gecikmeden sonra listeye dön
            setTimeout(() => navigate("/gorevler/tum"), 600); // Gecikme biraz artırıldı
        } catch (err) {
            console.error(err.message);
            setHata("Görev oluşturulurken sunucu hatası oluştu.");
            setSnack({ open: true, type: "error", msg: "Görev oluşturulamadı." });
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="tr">
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
                        maxWidth: "900px",
                        px: { xs: 2, md: 4 },
                    }}
                >
                    <Paper
                        elevation={12}
                        sx={{
                            borderRadius: 4,
                            overflow: "hidden",
                            backdropFilter: "saturate(140%) blur(12px)",
                            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.95)"),
                            border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
                            boxShadow: `0 20px 40px rgba(0,0,0,0.15)`,
                        }}
                    >
                        {/* Başlık şeridi */}
                        <Box
                            sx={{
                                px: { xs: 2, md: 3 },
                                py: { xs: 1.5, md: 2 },
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 2,
                                flexWrap: "wrap",
                                bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(240, 245, 250, 0.6)'),
                            }}
                        >
                            <Typography
                                variant="h5"
                                fontWeight={900}
                                sx={{
                                    // Başlığa modern gradient renk
                                    background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    lineHeight: 1,
                                }}
                            >
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <AddIcon sx={{ fontSize: 32 }} />
                                    <span>YENİ GÖREV ATA</span>
                                </Stack>
                            </Typography>

                            {/* Aksiyon Butonları */}
                            <Stack direction="row" spacing={1.5}>
                                <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ textTransform: 'none' }}>
                                    Geri
                                </Button>
                                <Button variant="outlined" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)} size="small" sx={{ textTransform: 'none' }}>
                                    Anasayfa
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={yenileniyor ? <CircularProgress size={16} color="secondary" /> : <RefreshIcon />}
                                    onClick={fetchKullanicilar}
                                    disabled={yenileniyor || yukleniyor}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Kullanıcıları Yenile
                                </Button>
                            </Stack>
                        </Box>

                        <Divider />

                        {/* Form */}
                        <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 } }}>
                            <Stack spacing={3}>
                                {/* Görev Başlığı */}
                                <TextField
                                    label="Görev Başlığı"
                                    placeholder="Örn: Sevkiyat planının gözden geçirilmesi"
                                    value={form.baslik}
                                    onChange={(e) => setForm((p) => ({ ...p, baslik: e.target.value }))}
                                    required
                                    fullWidth
                                    error={!!errors.baslik}
                                    helperText={errors.baslik}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <TitleIcon color="action" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                {/* Açıklama */}
                                <TextField
                                    label="Açıklama (İsteğe Bağlı)"
                                    placeholder="İsteğe bağlı detay / beklenti / bağlam"
                                    value={form.aciklama}
                                    onChange={(e) => setForm((p) => ({ ...p, aciklama: e.target.value }))}
                                    multiline
                                    minRows={3}
                                    fullWidth
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                                                <NotesIcon color="action" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                {/* Son Teslim Tarihi */}
                                <DatePicker
                                    label="Son Teslim Tarihi"
                                    value={form.duedate}
                                    onChange={(v) => setForm((p) => ({ ...p, duedate: v }))}
                                    slotProps={{
                                        textField: {
                                            required: true,
                                            error: !!errors.duedate,
                                            helperText: errors.duedate,
                                            fullWidth: true,
                                            InputProps: {
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <EventIcon color="action" />
                                                    </InputAdornment>
                                                ),
                                            },
                                        },
                                    }}
                                    disablePast
                                    format="DD.MM.YYYY"
                                />

                                {/* Görevi Atanan */}
                                <Autocomplete
                                    options={kullanicilar}
                                    loading={yukleniyor || yenileniyor}
                                    getOptionLabel={(o) => (o ? `${o.kullanici} (${o.rol})` : "")}
                                    value={form.atanan}
                                    onChange={(_, val) => setForm((p) => ({ ...p, atanan: val }))}
                                    isOptionEqualToValue={(o, v) => o.id === v?.id}
                                    fullWidth
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Görevi Atanan"
                                            required
                                            error={!!errors.atanan}
                                            helperText={errors.atanan}
                                            InputProps={{
                                                ...params.InputProps,
                                                startAdornment: (
                                                    <>
                                                        <InputAdornment position="start">
                                                            <PeopleIcon color="action" />
                                                        </InputAdornment>
                                                        {params.InputProps.startAdornment}
                                                    </>
                                                ),
                                                endAdornment: (
                                                    <>
                                                        {(yukleniyor || yenileniyor) ? <CircularProgress size={18} /> : null}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
                                            }}
                                        />
                                    )}
                                />

                                {/* Hata Mesajı */}
                                {hata && (
                                    <Alert severity="error" variant="filled" sx={{ mt: 2 }}>
                                        {hata}
                                    </Alert>
                                )}

                                {/* Butonlar */}
                                <Stack direction="row" justifyContent="flex-end" spacing={1.5} pt={2}>
                                    <Button variant="outlined" onClick={() => navigate(-1)} sx={{ textTransform: 'none' }}>
                                        Vazgeç
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        color="secondary"
                                        startIcon={<SendIcon />}
                                        disabled={disabled || yukleniyor || yenileniyor}
                                        sx={{ textTransform: 'none', fontWeight: 600 }}
                                    >
                                        Görevi Oluştur
                                    </Button>
                                </Stack>
                            </Stack>
                        </Box>
                    </Paper>
                </Container>

                <Snackbar
                    open={snack.open}
                    autoHideDuration={4000} // Süre artırıldı
                    onClose={() => setSnack((p) => ({ ...p, open: false }))}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert
                        onClose={() => setSnack((p) => ({ ...p, open: false }))}
                        severity={snack.type}
                        variant="filled"
                        sx={{ width: "100%", fontWeight: 500 }}
                    >
                        {snack.msg}
                    </Alert>
                </Snackbar>
            </Box>
        </LocalizationProvider>
    );
}
