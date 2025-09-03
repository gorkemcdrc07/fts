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
} from "@mui/material";
import {
    Add as AddIcon,
    Send as SendIcon,
    Refresh as RefreshIcon,
    People as PeopleIcon,
    Title as TitleIcon,
    Notes as NotesIcon,
    Event as EventIcon,
} from "@mui/icons-material";

/** Date Picker (MUI X) */
import dayjs from "dayjs";
import "dayjs/locale/tr";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("tr");

const IST_TZ = "Europe/Istanbul";

export default function GorevAta() {
    const navigate = useNavigate();

    const [kullanicilar, setKullanicilar] = useState([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [yenileniyor, setYenileniyor] = useState(false);

    const [form, setForm] = useState({
        baslik: "",
        aciklama: "",
        duedate: null,      // dayjs objesi
        atanan: null,       // { id, kullanici, rol }
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

            setSnack({ open: true, type: "success", msg: "Görev oluşturuldu." });
            // küçük bir gecikmeden sonra listeye dön
            setTimeout(() => navigate("/gorevler/tum"), 300);
        } catch (err) {
            console.error(err.message);
            setHata("Görev oluşturulamadı.");
            setSnack({ open: true, type: "error", msg: "Görev oluşturulamadı." });
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="tr">
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
                        maxWidth: "900px",
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
                            }}
                        >
                            <Stack direction="row" spacing={1} alignItems="center">
                                <AddIcon />
                                <Typography variant="h6" fontWeight={800}>
                                    Görev Ata
                                </Typography>
                            </Stack>

                            {/* ⬇️ Eklendi: Geri & Anasayfa butonları (işlevlere dokunmadan) */}
                            <Stack direction="row" spacing={1}>
                                <Button size="small" variant="outlined" onClick={() => navigate(-1)}>
                                    Geri
                                </Button>
                                <Button size="small" variant="outlined" onClick={() => navigate("/")}>
                                    Anasayfa
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<RefreshIcon />}
                                    onClick={fetchKullanicilar}
                                    disabled={yenileniyor || yukleniyor}
                                >
                                    Kullanıcıları Yenile
                                </Button>
                            </Stack>
                        </Box>

                        <Divider />

                        {/* Form */}
                        <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 } }}>
                            <Stack spacing={2.25}>
                                <TextField
                                    label="Görev Başlığı"
                                    placeholder="Örn: Sevkiyat planının gözden geçirilmesi"
                                    value={form.baslik}
                                    onChange={(e) => setForm((p) => ({ ...p, baslik: e.target.value }))}
                                    required
                                    error={!!errors.baslik}
                                    helperText={errors.baslik || " "}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <TitleIcon />
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                <TextField
                                    label="Açıklama"
                                    placeholder="İsteğe bağlı detay / beklenti / bağlam"
                                    value={form.aciklama}
                                    onChange={(e) => setForm((p) => ({ ...p, aciklama: e.target.value }))}
                                    multiline
                                    minRows={3}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <NotesIcon />
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                <DatePicker
                                    label="Son Teslim Tarihi"
                                    value={form.duedate}
                                    onChange={(v) => setForm((p) => ({ ...p, duedate: v }))}
                                    slotProps={{
                                        textField: {
                                            required: true,
                                            error: !!errors.duedate,
                                            helperText: errors.duedate || " ",
                                            InputProps: {
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <EventIcon />
                                                    </InputAdornment>
                                                ),
                                            },
                                        },
                                    }}
                                    disablePast
                                    format="DD.MM.YYYY"
                                />

                                <Autocomplete
                                    options={kullanicilar}
                                    loading={yukleniyor || yenileniyor}
                                    getOptionLabel={(o) => (o ? `${o.kullanici} (${o.rol})` : "")}
                                    value={form.atanan}
                                    onChange={(_, val) => setForm((p) => ({ ...p, atanan: val }))}
                                    isOptionEqualToValue={(o, v) => o.id === v?.id}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Görevi Atanan"
                                            required
                                            error={!!errors.atanan}
                                            helperText={errors.atanan || " "}
                                            InputProps={{
                                                ...params.InputProps,
                                                startAdornment: (
                                                    <>
                                                        <InputAdornment position="start">
                                                            <PeopleIcon />
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

                                {hata && (
                                    <Alert severity="error" variant="outlined">
                                        {hata}
                                    </Alert>
                                )}

                                <Stack direction="row" justifyContent="flex-end" spacing={1.25}>
                                    <Button variant="text" onClick={() => navigate(-1)}>
                                        Vazgeç
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        startIcon={<SendIcon />}
                                        disabled={disabled}
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
        </LocalizationProvider>
    );
}
