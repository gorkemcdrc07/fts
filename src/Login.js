// src/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

// UI
import { motion } from "framer-motion";
import {
    Box,
    Container,
    Paper,
    Stack,
    Typography,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Snackbar,
    Alert,
    Divider,
    CircularProgress, // Loading için eklendi
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles"; // Stil için alpha ve styled eklendi
import {
    Person as PersonIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Login as LoginIcon,
} from "@mui/icons-material";

// Renk Sabitleri
const PRIMARY_NEON = "#6dd5ed"; // Açık Mavi
const SECONDARY_NEON = "#2193b0"; // Koyu Mavi

/** Özel Stilli TextField (Modernizasyonun Anahtarı) */
const StyledTextField = styled(TextField)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        borderRadius: 12,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.02)',
        transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',

        '& fieldset': {
            borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
            transition: 'border-color 0.3s',
        },
        '&:hover fieldset': {
            borderColor: theme.palette.mode === 'dark' ? PRIMARY_NEON : SECONDARY_NEON,
            boxShadow: `0 0 8px ${alpha(PRIMARY_NEON, 0.5)}`, // Hover'da neon gölge
        },
        '&.Mui-focused fieldset': {
            borderColor: PRIMARY_NEON,
            borderWidth: '2px !important', // Aktifken kalın çizgi
            boxShadow: `0 0 10px ${alpha(PRIMARY_NEON, 0.8)}`, // Aktifken güçlü neon gölge
        },
    },
    '& .MuiInputLabel-root': {
        color: theme.palette.text.secondary,
        '&.Mui-focused': {
            color: PRIMARY_NEON, // Aktifken label rengi
        },
    },
}));


/** Lojistik SVG Sahnesi */
function LogisticsScene() {
    const dash = 680;
    return (
        <Box
            aria-hidden
            sx={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                pointerEvents: "none",
                opacity: 0.9,
                // Hafif Parıltılı Zemin
                filter: 'brightness(1.1) contrast(1.1)',
            }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 1440 900"
                preserveAspectRatio="xMidYMid slice"
                style={{ display: "block" }}
            >
                <defs>
                    {/* Grid Rengi Güncellendi (Daha koyu zemine uygun) */}
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M40 0H0V40" fill="none" stroke="rgba(255,255,255,0.07)" />
                    </pattern>
                    {/* Arkaplan Gradyanı Güncellendi (Daha derin ve doygun) */}
                    <linearGradient id="grad" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.25" />
                    </linearGradient>
                    {/* Rota Gradyanı Güncellendi */}
                    <linearGradient id="route" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                    {/* Glow Efekti (Daha keskin) */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <rect x="0" y="0" width="1440" height="900" fill="url(#grad)" />
                <rect x="0" y="0" width="1440" height="900" fill="url(#grid)" />

                {/* Statik Kutular */}
                {[[180, 180], [240, 540], [1080, 200], [1280, 520], [820, 740], [420, 720]].map(([x, y], i) => (
                    <g key={i} transform={`translate(${x} ${y})`} opacity="0.5" filter="url(#glow)">
                        <rect x="-16" y="-16" width="32" height="32" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.25)" />
                        <rect x="-9" y="-9" width="18" height="18" rx="4" fill="rgba(255,255,255,0.15)" />
                    </g>
                ))}

                {/* Dinamik Pinler */}
                {[[220, 200], [1180, 540], [860, 760], [460, 740]].map(([x, y], i) => (
                    <motion.g
                        key={i + "pin"}
                        transform={`translate(${x} ${y})`}
                        filter="url(#glow)"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1.1 }}
                        transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: i * 0.3 }}
                    >
                        <circle r="8" fill="#10B981" />
                        <circle r="18" fill="none" stroke="#10B981" strokeOpacity="0.5" strokeWidth="2" />
                    </motion.g>
                ))}

                {/* Rota Yolu */}
                <path
                    id="routePath"
                    d="M 200 220 C 420 80, 860 160, 1180 560 S 920 820, 460 760"
                    fill="none"
                    stroke="url(#route)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${dash}`}
                    strokeDashoffset="0"
                    opacity="0.9"
                />

                {/* Animasyonlu Işık İzi (Daha parlak) */}
                <motion.path
                    d="M 200 220 C 420 80, 860 160, 1180 560 S 920 820, 460 760"
                    fill="none"
                    stroke="white"
                    strokeWidth="4" // Daha kalın iz
                    strokeLinecap="round"
                    strokeDasharray={`${dash / 6} ${dash}`}
                    initial={{ strokeDashoffset: 0 }}
                    animate={{ strokeDashoffset: -dash }}
                    transition={{ duration: 5, ease: "linear", repeat: Infinity }} // Daha hızlı animasyon
                    style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.9))" }} // Daha güçlü gölge
                    opacity="0.75"
                />

                {/* Kamyon/İçerik sembolü (opsiyonel) */}
                <motion.g
                    transform="translate(0,0) scale(1)"
                    style={{
                        offsetPath: "path('M 200 220 C 420 80, 860 160, 1180 560 S 920 820, 460 760')",
                        offsetDistance: "var(--od)",
                        willChange: "offset-distance",
                        "--od": "0%",
                    }}
                    animate={{ "--od": ["0%", "100%"] }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                >
                    <path d="M -10 10 L 10 10 L 10 -10 L -10 -10 Z" fill="#FFC107" filter="url(#glow)" />
                </motion.g>
            </svg>
        </Box>
    );
}

function Login() {
    const [kullaniciAdi, setKullaniciAdi] = useState("");
    const [sifre, setSifre] = useState("");
    const [hata, setHata] = useState("");
    const [snack, setSnack] = useState({ open: false, type: "error", msg: "" });
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const navigate = useNavigate();

    // Rol normalizasyonu (Kısaltıldı)
    const normalizeRole = (s = "") =>
        s.normalize("NFKC").toLocaleUpperCase("tr-TR").replace(/\s+/g, "");

    const aliasRole = (s = "") => {
        const k = normalizeRole(s);
        if (k === "YONETICI") return "YÖNETİCİ";
        if (k === "OPERASYON") return "OPERASYON";
        if (k === "TAKIP") return "TAKİP";
        return k || "";
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setHata("");
        setSnack((p) => ({ ...p, open: false }));

        if (!kullaniciAdi.trim() || !sifre) {
            setHata("Kullanıcı adı ve şifre zorunludur.");
            setSnack({ open: true, type: "warning", msg: "Lütfen tüm alanları doldurun." });
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("login")
                .select("*")
                .eq("kullaniciAdi", kullaniciAdi)
                .eq("sifre", sifre)
                .single();

            if (error || !data) {
                setHata("Kullanıcı adı veya şifre hatalı.");
                setSnack({ open: true, type: "error", msg: "Kullanıcı adı veya şifre hatalı." });
                return;
            }

            // ... (Oturum ve LocalStorage Kayıt Mantığı Kısaltıldı) ...

            const reelUserCol = (data.Reel_kullanici ?? data.reel_kullanici ?? "").toString().trim();
            const reelPassCol = (data.Reel_sifre ?? data.reel_sifre ?? "").toString().trim();
            const reelUserToSave = reelUserCol || (kullaniciAdi || "").trim();
            const reelPassToUse = reelPassCol || sifre;
            const resolvedRole = aliasRole(data.rol || "");

            localStorage.setItem("kullaniciAdi", data.kullaniciAdi || "");
            localStorage.setItem("kullanici", data.kullanici || "");
            localStorage.setItem("rol", resolvedRole);
            localStorage.setItem("roleKey", resolvedRole);
            localStorage.setItem("kullaniciId", String(data.id ?? ""));
            localStorage.setItem("girisYapanKullanici", JSON.stringify(data));
            localStorage.setItem("profilFotograf", data.profil_fotograf || "");
            localStorage.setItem("Reel-kullanici", reelUserToSave);
            sessionStorage.setItem("Reel-sifre", reelPassToUse);

            navigate("/anasayfa");
        } catch (err) {
            setHata("Beklenmeyen bir hata oluştu.");
            setSnack({ open: true, type: "error", msg: "Beklenmeyen bir hata oluştu." });
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            component={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            sx={{
                minHeight: "100dvh",
                position: "relative",
                display: "grid",
                placeItems: "center",
                // Arkaplan Gradyanı: Daha derin ve fütüristik
                background: (t) =>
                    t.palette.mode === "dark"
                        ? "linear-gradient(180deg,#0a101d,#0e1526)" // Koyu Mavi/Gri Tonları
                        : "linear-gradient(180deg,#E8F3FF,#F8F0FF)", // Hafif Pastel Tonları
            }}
        >
            {/* Animasyonlu lojistik sahnesi */}
            <LogisticsScene />

            <Container
                maxWidth={false}
                sx={{ position: "relative", zIndex: 1, maxWidth: "980px", px: { xs: 2, md: 4 } }}
            >
                <Paper
                    component={motion.div}
                    initial={{ opacity: 0, y: 30, scale: 0.95 }} // Daha belirgin giriş animasyonu
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    elevation={12} // Daha derin gölge
                    sx={{
                        borderRadius: 4,
                        overflow: "hidden",
                        mx: "auto",
                        // Müthiş Modern Glassmorphism
                        backdropFilter: "saturate(180%) blur(15px)",
                        bgcolor: (t) =>
                            t.palette.mode === "dark" ? "rgba(10,15,30,0.8)" : "rgba(255,255,255,0.95)",
                        border: (t) =>
                            `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"}`,
                        // Hafif Neon İç Parıltı (Koyu Temada)
                        boxShadow: (t) => t.palette.mode === "dark"
                            ? `0 0 40px ${alpha(PRIMARY_NEON, 0.25)}, 0 10px 30px ${alpha(t.palette.common.black, 0.6)}`
                            : `0 10px 30px ${alpha(t.palette.common.black, 0.1)}`,
                    }}
                >
                    <Stack direction={{ xs: "column", md: "row" }} sx={{ minHeight: { xs: "auto", md: 520 } }}>
                        {/* Sol: Başlık + kısa değer önermesi (Vurgulu) */}
                        <Stack
                            alignItems={{ xs: "center", md: "flex-start" }}
                            justifyContent="center"
                            spacing={2}
                            sx={{
                                flex: 1,
                                p: { xs: 4, md: 6 },
                                // Neon Gradyan Vurgusu
                                background: `linear-gradient(145deg, ${alpha(PRIMARY_NEON, 0.2)}, ${alpha(SECONDARY_NEON, 0.1)})`,
                                borderRight: (t) => t.palette.mode === 'dark' ? `1px solid ${alpha(PRIMARY_NEON, 0.4)}` : 'none',
                                backdropFilter: "blur(2px)",
                            }}
                        >
                            <Box sx={{ p: 1, borderRadius: '50%', background: `linear-gradient(135deg, ${PRIMARY_NEON}, ${SECONDARY_NEON})`, boxShadow: `0 0 15px ${alpha(PRIMARY_NEON, 0.8)}` }}>
                                <LoginIcon sx={{ fontSize: 40, color: 'white' }} />
                            </Box>

                            <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: 0.5, mt: 1 }}>
                                FTS WEB
                            </Typography>
                            <Typography variant="h5" fontWeight={700} sx={{
                                // Fütüristik Metin Vurgusu
                                background: `linear-gradient(90deg, ${PRIMARY_NEON}, ${SECONDARY_NEON})`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                textShadow: `0 0 8px ${alpha(PRIMARY_NEON, 0.6)}`
                            }}>
                                Filo Takip Sistemi
                            </Typography>
                            <Typography sx={{ opacity: 0.85, fontSize: '1.1rem' }}>
                                Görevler, masraflar ve operasyonların merkez üssü.
                            </Typography>
                            <Divider flexItem sx={{ my: 3, width: { xs: '80%', md: '100%' }, opacity: 0.25 }} />
                            <Typography variant="caption" sx={{ opacity: 0.65, fontWeight: 500 }}>
                                Güvenli giriş • Canlı bildirim • Akıcı operasyonlar
                            </Typography>
                        </Stack>

                        {/* Sağ: Form */}
                        <Box
                            component="form"
                            onSubmit={handleSubmit}
                            sx={{
                                flex: 1,
                                p: { xs: 4, md: 6 },
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Stack spacing={3} sx={{ width: "100%", maxWidth: 420 }}>
                                <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>
                                    Oturum Aç
                                </Typography>

                                <StyledTextField // Özel TextField kullanılıyor
                                    label="Kullanıcı Adı"
                                    placeholder="kullanici.adiniz"
                                    value={kullaniciAdi}
                                    onChange={(e) => setKullaniciAdi(e.target.value)}
                                    autoComplete="username"
                                    required
                                    fullWidth
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PersonIcon sx={{ color: PRIMARY_NEON }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                <StyledTextField // Özel TextField kullanılıyor
                                    label="Şifre"
                                    type={showPass ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={sifre}
                                    onChange={(e) => setSifre(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                    fullWidth
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockIcon sx={{ color: PRIMARY_NEON }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    aria-label="şifreyi göster"
                                                    onClick={() => setShowPass((v) => !v)}
                                                    edge="end"
                                                >
                                                    {showPass ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                {hata && (
                                    <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
                                        {hata}
                                    </Alert>
                                )}

                                <Button
                                    component={motion.button} // Framer Motion ile animasyon
                                    whileHover={{ scale: 1.02, boxShadow: `0 0 15px ${alpha(PRIMARY_NEON, 0.7)}` }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <LoginIcon />}
                                    disabled={loading}
                                    sx={{
                                        py: 1.5,
                                        fontWeight: 700,
                                        borderRadius: 3, // Daha yuvarlak buton
                                        // Butona Neon Gradyan
                                        background: `linear-gradient(90deg, ${SECONDARY_NEON}, ${PRIMARY_NEON})`,
                                        '&:hover': {
                                            background: `linear-gradient(90deg, ${PRIMARY_NEON}, ${SECONDARY_NEON})`,
                                        }
                                    }}
                                >
                                    {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                                </Button>

                                <Typography variant="caption" sx={{ opacity: 0.65, textAlign: "center", pt: 1 }}>
                                    Oturum bilgileriniz güvenle saklanır.
                                </Typography>
                            </Stack>
                        </Box>
                    </Stack>
                </Paper>
            </Container>

            {/* Snackbar (Koyu temaya uyumlu) */}
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
                    sx={{ width: "100%", borderRadius: 2 }}
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}

export default Login;
