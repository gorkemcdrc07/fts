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
} from "@mui/material";
import {
    Person as PersonIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Login as LoginIcon,
} from "@mui/icons-material";

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
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M40 0H0V40" fill="none" stroke="rgba(255,255,255,0.12)" />
                    </pattern>
                    <linearGradient id="grad" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.20" />
                        <stop offset="100%" stopColor="#34D399" stopOpacity="0.20" />
                    </linearGradient>
                    <linearGradient id="route" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#22C55E" />
                        <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
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

                {[[180, 180], [240, 540], [1080, 200], [1280, 520], [820, 740], [420, 720]].map(([x, y], i) => (
                    <g key={i} transform={`translate(${x} ${y})`} opacity="0.7">
                        <rect x="-16" y="-16" width="32" height="32" rx="6" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" />
                        <rect x="-9" y="-9" width="18" height="18" rx="4" fill="rgba(255,255,255,0.2)" />
                    </g>
                ))}

                {[[220, 200], [1180, 540], [860, 760], [460, 740]].map(([x, y], i) => (
                    <g key={i + "pin"} transform={`translate(${x} ${y})`} filter="url(#glow)">
                        <circle r="8" fill="#34D399" />
                        <circle r="18" fill="none" stroke="#34D399" strokeOpacity="0.5" />
                    </g>
                ))}

                <path
                    id="routePath"
                    d="M 200 220
             C 420 80, 860 160, 1180 560
             S 920 820, 460 760"
                    fill="none"
                    stroke="url(#route)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${dash}`}
                    strokeDashoffset="0"
                    opacity="0.9"
                />

                <motion.path
                    d="M 200 220
             C 420 80, 860 160, 1180 560
             S 920 820, 460 760"
                    fill="none"
                    stroke="white"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${dash / 6} ${dash}`}
                    initial={{ strokeDashoffset: 0 }}
                    animate={{ strokeDashoffset: -dash }}
                    transition={{ duration: 6, ease: "linear", repeat: Infinity }}
                    style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.7))" }}
                    opacity="0.65"
                />

                <motion.g
                    transform="translate(0,0) scale(1)"
                    initial={{ offsetDistance: "0%" }}
                    animate={{ offsetDistance: "100%" }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                        offsetPath: "path('M 200 220 C 420 80, 860 160, 1180 560 S 920 820, 460 760')",
                    }}
                >
                    <g transform="translate(-12,-12)">
                        <rect x="0" y="4" width="26" height="16" rx="3" fill="#1F2937" />
                        <rect x="18" y="0" width="18" height="16" rx="3" fill="#3B82F6" />
                        <rect x="22" y="3" width="6" height="5" rx="1" fill="white" />
                        <circle cx="6" cy="22" r="4" fill="#111827" stroke="white" strokeWidth="1" />
                        <circle cx="22" cy="22" r="4" fill="#111827" stroke="white" strokeWidth="1" />
                    </g>
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

    // Rol normalizasyonu: TAKİP / OPERASYON / YÖNETİCİ varyantlarını tekleştir
    const normalizeRole = (s = "") =>
        s
            .normalize("NFKC")
            .toLocaleUpperCase("tr-TR")
            .replace(/\s+/g, "");

    const aliasRole = (s = "") => {
        const k = normalizeRole(s);
        if (k === "YONETICI") return "YÖNETİCİ"; // noktasız girilmişse de tekleştir
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

            // REEL alanlarını güvenli şekilde oku
            const reelUserCol = (data.Reel_kullanici ?? data.reel_kullanici ?? "").toString().trim();
            const reelPassCol = (data.Reel_sifre ?? data.reel_sifre ?? "").toString().trim();

            // Boşsa giriş formundaki bilgileri kullan
            const reelUserToSave = reelUserCol || (kullaniciAdi || "").trim();
            const reelPassToUse = reelPassCol || sifre;

            // --- ROL NORMALİZASYONU ---
            const resolvedRole = aliasRole(data.rol || "");

            // Oturum bilgileri (mevcut anahtarlar korunur)
            localStorage.setItem("kullaniciAdi", data.kullaniciAdi || "");
            localStorage.setItem("kullanici", data.kullanici || "");
            localStorage.setItem("rol", resolvedRole);     // Örn: "TAKİP" | "OPERASYON" | "YÖNETİCİ"
            localStorage.setItem("roleKey", resolvedRole); // Okunması kolay sabit
            localStorage.setItem("kullaniciId", String(data.id ?? ""));
            localStorage.setItem("girisYapanKullanici", JSON.stringify(data));
            localStorage.setItem("profilFotograf", data.profil_fotograf || "");

            // REEL bilgileri
            localStorage.setItem("Reel-kullanici", reelUserToSave);
            // Güvenlik: şifreyi localStorage yerine sessionStorage'a yazalım
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
                background: (t) =>
                    t.palette.mode === "dark"
                        ? "linear-gradient(180deg,#0b1020,#0e1428)"
                        : "linear-gradient(180deg,#F0F9FF,#F8FFFB)",
            }}
        >
            {/* Animasyonlu lojistik sahnesi */}
            <LogisticsScene />

            <Container
                maxWidth={false}
                sx={{
                    position: "relative",
                    zIndex: 1,
                    maxWidth: "980px",
                    px: { xs: 2, md: 4 },
                }}
            >
                <Paper
                    component={motion.div}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    elevation={6}
                    sx={{
                        borderRadius: 4,
                        overflow: "hidden",
                        mx: "auto",
                        backdropFilter: "saturate(140%) blur(10px)",
                        bgcolor: (t) =>
                            t.palette.mode === "dark" ? "rgba(17,23,41,0.65)" : "rgba(255,255,255,0.85)",
                        border: (t) =>
                            `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)"}`,
                    }}
                >
                    <Stack direction={{ xs: "column", md: "row" }} sx={{ minHeight: { xs: "auto", md: 480 } }}>
                        {/* Sol: Başlık + kısa değer önermesi */}
                        <Stack
                            alignItems={{ xs: "center", md: "flex-start" }}
                            justifyContent="center"
                            spacing={1}
                            sx={{
                                flex: 1,
                                p: { xs: 3, md: 5 },
                                background: "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(52,211,153,0.14))",
                                backdropFilter: "blur(2px)",
                            }}
                        >
                            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: 0.3 }}>
                                Filo Takip Sistemi
                            </Typography>
                            <Typography sx={{ opacity: 0.85 }}>
                                Görevler, masraflar ve operasyonların merkez üssü.
                            </Typography>
                            <Divider flexItem sx={{ my: 2, opacity: 0.25 }} />
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                                Güvenli giriş • Canlı bildirim • Modern arayüz
                            </Typography>
                        </Stack>

                        {/* Sağ: Form */}
                        <Box
                            component="form"
                            onSubmit={handleSubmit}
                            sx={{
                                flex: 1,
                                p: { xs: 3, md: 5 },
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Stack spacing={2.25} sx={{ width: "100%", maxWidth: 420 }}>
                                <Typography variant="h6" fontWeight={800}>
                                    Giriş Yap
                                </Typography>

                                <TextField
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
                                                <PersonIcon />
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                <TextField
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
                                                <LockIcon />
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
                                    <Alert severity="error" variant="outlined">
                                        {hata}
                                    </Alert>
                                )}

                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    startIcon={<LoginIcon />}
                                    disabled={loading}
                                    sx={{ py: 1.25, fontWeight: 700, borderRadius: 2 }}
                                >
                                    {loading ? "Giriş yapılıyor…" : "Giriş"}
                                </Button>

                                <Typography variant="caption" sx={{ opacity: 0.65, textAlign: "center" }}>
                                    Oturum bilgileriniz güvenle saklanır.
                                </Typography>
                            </Stack>
                        </Box>
                    </Stack>
                </Paper>
            </Container>

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

export default Login;
