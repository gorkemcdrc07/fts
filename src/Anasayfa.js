// src/Anasayfa.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { Helmet } from "react-helmet-async";
import { supabase } from "./supabaseClient";

// UI IMPORTS
import { motion } from "framer-motion";
import {
    Box,
    Container,
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
    // İKONLAR
    Refresh as RefreshIcon,
    Speed as SpeedIcon,
    CheckCircleOutline as CheckIcon,
    LocalShipping as TruckIcon,
    ReportProblem as AlertIcon,
    AccessTime as TimeIcon,
    Warning as WarningIcon,
    CalendarToday as CalendarIcon,
    Person as PersonIcon,
    AddCircleOutline as AddIcon,
} from "@mui/icons-material";


// Renk Sabitleri
const PRIMARY_NEON = "#6dd5ed"; // Açık Mavi (Cyan)
const SECONDARY_NEON = "#2193b0"; // Koyu Mavi

/* ----------------- GEREKSİZ COMPONENTLER KALDIRILDI ----------------- */
function LogisticsHero() { return null; }

// Yeni: Tablo paneli için başlık stili
const TablePanelTitle = styled(Typography)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontWeight: 800,
    fontSize: '1.2rem',
    marginBottom: theme.spacing(2),
    color: PRIMARY_NEON,
}));

// **********************************************************
// MAIN METRIC CARD TANIMI
// **********************************************************

const MainMetricCard = ({ title, value, unit, icon, color, subTitle, isLoading }) => {
    const theme = useTheme();

    const resolveColor = (colorKey) => {
        if (typeof colorKey === 'string' && colorKey.includes('.')) {
            const [main, shade] = colorKey.split('.');
            // Tema paletindeki rengi döndür
            return theme.palette[main]?.[shade] || PRIMARY_NEON;
        }
        // Eğer renk stringi değilse, doğrudan kullan
        return colorKey || PRIMARY_NEON;
    };

    const resolvedColor = resolveColor(color);

    return (
        <Paper
            component={motion.div}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, duration: 0.5 }}
            sx={{
                p: 3, // Padding azaltıldı
                borderRadius: 3, // Köşeler yumuşatıldı
                bgcolor: (t) => t.palette.mode === "dark" ? alpha('#111827', 0.95) : alpha('#FFFFFF', 0.95),
                backdropFilter: 'blur(5px)',

                border: `2px solid ${alpha(resolvedColor, 0.4)}`, // Border hafifletildi
                textAlign: 'left', // Metin sola yaslandı (daha profesyonel)
                minHeight: 180, // Minimum yükseklik azaltıldı
                boxShadow: (t) => `0 0 25px ${alpha(resolvedColor, 0.3)}`, // Gölge hafifletildi
                position: 'relative',
            }}
        >
            <Box sx={{ color: resolvedColor, position: 'absolute', top: 15, right: 15, fontSize: 48, mb: 1, filter: `drop-shadow(0 0 8px ${alpha(resolvedColor, 0.6)})` }}>
                {icon}
            </Box>
            <Stack spacing={0.5} alignItems="flex-start"> {/* Sol tarafa yaslandı */}
                <Typography variant="overline" fontWeight={700} sx={{ color: resolvedColor, letterSpacing: 1.5, fontSize: 13 }}>
                    {title}
                </Typography>
                {isLoading ? (
                    <Box sx={{ pt: 1 }}><CircularProgress size={30} sx={{ color: resolvedColor }} /></Box>
                ) : (
                    <Typography variant="h3" fontWeight={900} sx={{ mt: 0.5, lineHeight: 1.1 }}>
                        {value}
                        <Typography component="span" variant="h6" sx={{ ml: 1, opacity: 0.8, color: 'text.secondary' }}>{unit}</Typography>
                    </Typography>
                )}
                {subTitle && (
                    <Typography variant="body2" sx={{ opacity: 0.7, mt: 1, color: 'text.secondary' }}>
                        {subTitle}
                    </Typography>
                )}
            </Stack>
        </Paper>
    );
};


// **********************************************************
// YARDIMCI FONKSİYONLAR
// **********************************************************

// Tablo Satır Stili
const rowSX = {
    "& td, & th": {
        borderBottomColor: "rgba(255,255,255,0.08)",
        verticalAlign: "middle",
        paddingTop: 0.8,
        paddingBottom: 0.8,
        lineHeight: 1.3,
    },
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);
const fmtTR = (iso) => iso ? new Date(iso).toLocaleDateString("tr-TR") : '—';
const getDateAny = (r) => {
    const raw = r?.tamamlanma_tarihi || r?.sefer_tarihi || r?.tarih || r?.created_at || r?.date || r?.updated_at;
    if (!raw) return null; const s = String(raw);
    return s.length >= 10 ? s.slice(0, 10) : s;
};

// Sadece limitli fetch fonksiyonu
async function fetchLimitedData(table, limit = 50) {
    // order() parametresi kaldırıldı.
    const { data, error } = await supabase.from(table).select('*').limit(limit);
    if (error) return { rows: [], warn: error.message || "Sorgu hatası" };
    return { rows: data || [], warn: "" };
}

// Yeni: Log oluşturmak için yardımcı fonksiyon
const createLogEntry = (r, type, color, icon) => {
    const date = r.created_at || r.baslangic_tarihi || r.sefer_tarihi;
    return {
        id: `${type}-${r.id || r.sefer_no || Math.random()}`,
        type,
        color,
        icon,
        message: r.sefer_no
            ? `Sefer: ${r.sefer_no} - ${r.musteri_adi || 'Bilinmeyen Müşteri'}`
            : r.izin_turu
                ? `İzin: ${r.surucu_adi} için ${r.izin_turu}`
                : r.kesinti_turu
                    ? `Kesinti: ${r.plaka_treyler || r.surucu_adi} - ${r.neden || r.kesinti_turu}`
                    : `Kayıt: ${r.kullaniciAdi || 'Bilinmeyen kullanıcı'} tarafından eklendi.`,
        date: date ? new Date(date) : new Date(),
    };
};

const UPDATE_FIELDS = [
    'yukleme_varis_guncelleyen',
    'yukleme_cikis_guncelleyen',
    'teslim_varis_guncelleyen',
    'teslim_cikis_guncelleyen',
];
const DATE_FIELDS = [
    'yukleme_varis_guncelleme_tarihi',
    'yukleme_cikis_guncelleme_tarihi',
    'teslim_varis_guncelleme_tarihi',
    'teslim_cikis_guncelleme_tarihi',
];

function getSeferDetayUpdates(detaylar, targetDate) {
    const counts = {};
    const targetDateISO = targetDate.slice(0, 10);

    for (const detay of detaylar) {
        for (let i = 0; i < UPDATE_FIELDS.length; i++) {
            const userField = UPDATE_FIELDS[i];
            const dateField = DATE_FIELDS[i];
            const updateKey = userField.replace('_guncelleyen', '');

            const username = detay[userField];
            const updateDate = detay[dateField] ? detay[dateField].slice(0, 10) : null;

            if (username && updateDate === targetDateISO) {
                const user = username.toString().trim() || 'Bilinmeyen Kullanıcı';

                if (!counts[user]) {
                    counts[user] = { total: 0, updates: {} };
                    UPDATE_FIELDS.forEach(f => {
                        counts[user].updates[f.replace('_guncelleyen', '')] = 0;
                    });
                }

                counts[user].total++;
                counts[user].updates[updateKey]++;
            }
        }
    }

    return Object.keys(counts)
        .map(username => ({ username, ...counts[username] }))
        .sort((a, b) => b.total - a.total);
}
// Diğer yardımcı fonksiyonların yer tutucuları...
function BarList({ data = [], max = 10, height = 20 }) { return null; }
function monthBounds(monthKeyStr) { return { start: new Date(), end: new Date(), days: 30 }; }
function overlaps(aStart, aEnd, bStart, bEnd) { return true; }
function clampToMonthRange(startISO, endISO, monthStart, monthEnd) { return { start: new Date(), end: new Date() }; }


/* ----------------- Page ----------------- */
export default function Anasayfa() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const today = getTodayDate();
    const theme = useTheme();
    const themePalette = theme.palette;

    // State'ler
    const [tamamlanan, setTamamlanan] = useState([]);
    const [seferler, setSeferler] = useState([]);
    const [izinler, setIzinler] = useState([]);
    const [kesintiler, setKesintiler] = useState([]);
    const [seferDetaylari, setSeferDetaylari] = useState([]);

    const [selectedDate, setSelectedDate] = useState(today);
    const [dailyKPIs, setDailyKPIs] = useState({ totalActive: 0, totalCompleted: 0, totalIzin: 0, totalKesinti: 0 });

    const allActiveCount = seferler.length;

    const fetchData = useCallback(async () => {
        try {
            setLoading(true); setErr("");

            // KPI COUNT'ları için TEK SEFERLİK ÇEKİM
            const [cActive, cCompleted, cIzin, cKesinti] = await Promise.all([
                // Filtreli sayımlar
                supabase.from("seferler").select('id', { count: 'exact', head: true }).eq('sefer_tarihi', today),
                supabase.from("tamamlanan_seferler").select('id', { count: 'exact', head: true }).eq('tamamlanma_tarihi', today),
                supabase.from("izinler").select('id', { count: 'exact', head: true }).gte('bitis_tarihi', today).lte('baslangic_tarihi', today),
                supabase.from("kesintiler").select('id', { count: 'exact', head: true }).gte('bitis_tarihi', today).lte('baslangic_tarihi', today),
            ]);

            // KPI Değerleri
            const totalActive = cActive.count ?? 0;
            const totalCompleted = cCompleted.count ?? 0;
            const totalIzin = cIzin.count ?? 0;
            const totalKesinti = cKesinti.count ?? 0;

            setDailyKPIs({ totalActive, totalCompleted, totalIzin, totalKesinti });

            // LOG ve ANALİZ Verileri için limitli çekim
            const [tTam, tSef, tIzn, tKes, tDetay] = await Promise.all([
                fetchLimitedData("tamamlanan_seferler", 50),
                fetchLimitedData("seferler", 50),
                fetchLimitedData("izinler", 50),
                fetchLimitedData("kesintiler", 50),
                supabase.from("sefer_detaylari").select(`id, ${UPDATE_FIELDS.join(', ')}, ${DATE_FIELDS.join(', ')}`).limit(200),
            ]);

            const warns = [tTam.warn, tSef.warn, tIzn.warn, tKes.warn, tDetay.error?.message].filter(Boolean);
            if (warns.length) setErr(warns.join("  "));

            setTamamlanan(tTam.rows);
            setSeferler(tSef.rows);
            setIzinler(tIzn.rows);
            setKesintiler(tKes.rows);
            setSeferDetaylari(tDetay.data || []);

        } catch (e) {
            console.error(e);
            setErr("Veri alınırken bir hata oluştu: " + (e?.message || "Bilinmeyen Hata"));
        } finally {
            setLoading(false);
        }
    }, [today]);
    useEffect(() => { fetchData(); }, [fetchData]);

    const lastUpdated = useMemo(
        () => new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        [dailyKPIs, seferDetaylari.length]
    );

    // **********************************************************
    // SEFER DETAY GÜNCELLEME ANALİZİ
    // **********************************************************
    const currentDay = selectedDate;
    const currentDayTR = fmtTR(currentDay);

    // CANLI AKIŞ (LOG)
    const liveFeed = useMemo(() => {
        const logs = [];
        // themePalette kullanılarak renk stringleri çözüldü
        tamamlanan.forEach(r => logs.push(createLogEntry(r, 'Tamamlandı', themePalette.success.main, <CheckIcon />)));
        seferler.forEach(r => logs.push(createLogEntry(r, 'Yeni Sefer', themePalette.primary.main, <TruckIcon />)));
        izinler.forEach(r => logs.push(createLogEntry(r, 'İzin Girişi', themePalette.warning.main, <CalendarIcon />)));
        kesintiler.forEach(r => logs.push(createLogEntry(r, 'Kesinti/Hata', themePalette.error.main, <AlertIcon />)));

        return logs.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 15);
    }, [tamamlanan, seferler, izinler, kesintiler, themePalette]);

    // SEFER DETAY GÜNCELLEME ANALİZİ
    const userUpdateCounts = useMemo(() => {
        return getSeferDetayUpdates(seferDetaylari, currentDay);
    }, [seferDetaylari, currentDay]);
    // **********************************************************


    /* ----------------- RETURN ----------------- */
    return (
        <Box sx={{
            display: "flex",
            minHeight: "100dvh",
            // Dark Mode Arka Plan
            bgcolor: (t) => (t.palette.mode === "dark" ? "#0a101d" : "#f0f4f8")
        }}>
            <Helmet><title>Dashboard | FTS Analiz</title></Helmet>
            <Sidebar />

            {/* ANA İÇERİK KUTUSU */}
            <Box sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                pl: 'var(--sidebar-w, 72px)',
            }}>
                <Navbar />

                <Box
                    component={motion.div}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    sx={{
                        // YUKARI KAYDIRMA: Top Padding (Navbar altına yaslama)
                        pt: { xs: 2, md: 3 },
                        pb: { xs: 2, md: 4 },
                        px: { xs: 2, md: 3 }, // Soldan padding
                        flexGrow: 1,
                        width: '100%',
                        display: 'flex',
                        // Sol/Yukarı hizalama
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                        flexDirection: 'column',
                        minHeight: 'calc(100vh - 60px)'
                    }}
                >
                    {/* Container'ı kaldırıp Box'ı direkt kullanmak, sol boşluğu Navbar altına daha iyi yaslar. */}
                    <Box sx={{ width: '100%' }}>
                        {err && <Alert severity="error" sx={{ mb: 4 }}>{err}</Alert>}

                        {/* GÜNLÜK METRİK BAŞLIK VE KONTROLLERİ */}
                        <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }}
                            justifyContent="space-between" spacing={2} sx={{ mb: 4, width: '100%' }}>

                            <Box>
                                <Typography variant="h4" fontWeight={900} sx={{
                                    mb: 0.5,
                                    // YENİ BAŞLIK STİLİ
                                    background: `linear-gradient(90deg, ${PRIMARY_NEON}, ${SECONDARY_NEON})`,
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    // Başlıkta "Operasyon Nabzı" yerine sadece tarih kaldı
                                }}>
                                    {currentDayTR} - Günlük Operasyon Metrikleri
                                </Typography>
                            </Box>

                            {/* TARİH SEÇİCİ & YENİLE BUTONLARI */}
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ flexShrink: 0 }}>

                                {/* Tarih Seçici */}
                                <Paper sx={{ position: 'relative', p: 1, borderRadius: 2, bgcolor: 'transparent', border: `1px solid ${alpha(PRIMARY_NEON, 0.4)}` }}>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <CalendarIcon sx={{ color: PRIMARY_NEON }} />
                                        <Typography variant="body1" fontWeight={700}>{currentDayTR}</Typography>

                                        {/* Gizli Tarih Inputu */}
                                        <Box
                                            component="input"
                                            type="date"
                                            value={currentDay}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            sx={{
                                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer',
                                            }}
                                            max={getTodayDate()}
                                        />
                                    </Stack>
                                </Paper>

                                <Tooltip title="Verileri Yenile">
                                    <IconButton onClick={fetchData} disabled={loading} sx={{ color: PRIMARY_NEON, '&:hover': { bgcolor: alpha(PRIMARY_NEON, 0.1) } }}>
                                        {loading ? <CircularProgress size={24} sx={{ color: PRIMARY_NEON }} /> : <RefreshIcon />}
                                    </IconButton>
                                </Tooltip>
                                <Chip size="small" variant="outlined" label={`Son Güncelleme: ${lastUpdated}`} sx={{ color: 'text.secondary' }} />
                            </Stack>
                        </Stack>


                        {/* METRİK KARTLARI VE LOG ANALİZİ */}
                        <Grid container spacing={4}>

                            {/* 1. KPI KARTLARI */}
                            <Grid item xs={12}>
                                <Grid container spacing={4}>
                                    <Grid item xs={12} sm={6} lg={3}>
                                        <MainMetricCard
                                            title="Bugün Aktif Sefer"
                                            value={dailyKPIs.totalActive || 0}
                                            unit="Adet"
                                            icon={<TruckIcon />}
                                            color={PRIMARY_NEON}
                                            subTitle={`Toplam aktif sefer sayısı: ${allActiveCount} adet.`}
                                            isLoading={loading}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} lg={3}>
                                        <MainMetricCard
                                            title="Bugün Tamamlanan"
                                            value={dailyKPIs.totalCompleted || 0}
                                            unit="Teslimat"
                                            icon={<CheckIcon />}
                                            color="success.main"
                                            subTitle={`Bugün başarıyla tamamlanan teslimat sayısıdır.`}
                                            isLoading={loading}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} lg={3}>
                                        <MainMetricCard
                                            title="İzinli Şoför Sayısı"
                                            value={dailyKPIs.totalIzin || 0}
                                            unit="Kayıt"
                                            icon={<CalendarIcon />}
                                            color="warning.main"
                                            subTitle={`Bugün izni devam eden/başlayan şoför kaydı.`}
                                            isLoading={loading}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} lg={3}>
                                        <MainMetricCard
                                            title="Kritik Kesinti"
                                            value={dailyKPIs.totalKesinti || 0}
                                            unit="Arıza"
                                            icon={<AlertIcon />}
                                            color="error.main"
                                            subTitle={`Bugün aktif olan arıza/kesinti sayısıdır.`}
                                            isLoading={loading}
                                        />
                                    </Grid>
                                </Grid>
                            </Grid>

                            {/* 2. OPERASYON VE ANALİZ KARTLARI */}
                            <Grid item xs={12}>
                                <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mt: 3 }}>

                                    {/* SEFER DETAY GÜNCELLEYEN ANALİZİ */}
                                    <Paper sx={{ p: 4, borderRadius: 4, flex: 2, minWidth: { xs: '100%', md: 400 }, bgcolor: (t) => t.palette.mode === "dark" ? alpha('#111827', 0.95) : alpha('#FFFFFF', 0.95), border: `1px solid ${alpha(PRIMARY_NEON, 0.2)}` }}>
                                        <TablePanelTitle>
                                            <PersonIcon /> {currentDayTR} - Detay Güncelleme Performansı
                                        </TablePanelTitle>
                                        <Divider sx={{ mb: 2, borderColor: alpha(PRIMARY_NEON, 0.3) }} />

                                        <Box sx={{ maxHeight: 350, overflowY: 'auto' }}>
                                            <Table stickyHeader size="small">
                                                <TableHead>
                                                    <TableRow sx={{ '& th': { bgcolor: (t) => t.palette.mode === "dark" ? alpha('#2A2A2A', 0.9) : alpha('#f0f4f8', 0.9), color: 'text.secondary' } }}>
                                                        <TableCell sx={{ fontWeight: 900, width: '30%' }}>Kullanıcı</TableCell>
                                                        <TableCell sx={{ fontWeight: 900 }} align="right">Toplam</TableCell>
                                                        <TableCell sx={{ fontWeight: 900 }} align="right">Yük V. + Ç.</TableCell>
                                                        <TableCell sx={{ fontWeight: 900 }} align="right">Teslim V. + Ç.</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {userUpdateCounts.map((u) => {
                                                        const yukUpdates = u.updates.yukleme_varis + u.updates.yukleme_cikis;
                                                        const teslimUpdates = u.updates.teslim_varis + u.updates.teslim_cikis;
                                                        return (
                                                            <TableRow key={u.username} hover sx={rowSX}>
                                                                <TableCell sx={{ fontWeight: 700 }}>{u.username}</TableCell>
                                                                <TableCell align="right"><Chip size="small" label={u.total} color="primary" sx={{ fontWeight: 700 }} /></TableCell>
                                                                <TableCell align="right"><Chip size="small" label={yukUpdates} color="info" /></TableCell>
                                                                <TableCell align="right"><Chip size="small" label={teslimUpdates} color="success" /></TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    {userUpdateCounts.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={4}><Typography sx={{ opacity: .7, textAlign: 'center', py: 3 }}>Bu tarihte sefer detay kaydı güncellenmedi.</Typography></TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </Box>
                                        <Typography variant="caption" sx={{ opacity: 0.6, mt: 2, display: 'block' }}>* V. = Varış, Ç. = Çıkış güncelleme sayılarıdır.</Typography>
                                    </Paper>


                                    {/* CANLI AKTİVİTE AKIŞI (LOG) */}
                                    <Paper sx={{ p: 4, borderRadius: 4, flex: 1, minWidth: { xs: '100%', md: 250 }, bgcolor: (t) => t.palette.mode === "dark" ? alpha('#111827', 0.95) : alpha('#FFFFFF', 0.95), border: `1px solid ${alpha(PRIMARY_NEON, 0.2)}` }}>
                                        <TablePanelTitle>
                                            <TimeIcon /> Son Aktivite Akışı (Log)
                                        </TablePanelTitle>
                                        <Divider sx={{ mb: 2, borderColor: alpha(PRIMARY_NEON, 0.3) }} />

                                        <List dense sx={{ maxHeight: 350, overflowY: 'auto' }}>
                                            {liveFeed.map((log, index) => (
                                                <ListItem
                                                    key={log.id}
                                                    disablePadding
                                                    sx={{ py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.03)', '&:last-child': { borderBottom: 'none' } }}
                                                >
                                                    <ListItemIcon sx={{ minWidth: 35, color: log.color }}>{log.icon}</ListItemIcon>
                                                    <ListItemText
                                                        primary={<Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{log.message}</Typography>}
                                                        secondary={<Typography variant="caption" sx={{ opacity: 0.7, color: 'text.secondary' }}>{log.date.toLocaleTimeString('tr-TR')}</Typography>}
                                                    />
                                                </ListItem>
                                            ))}
                                            {liveFeed.length === 0 && <Typography sx={{ p: 2, opacity: 0.7, color: 'text.secondary' }}>Son 15 aktivite yok.</Typography>}
                                        </List>
                                        <Button fullWidth variant="outlined" href="/seferler" startIcon={<TruckIcon />} sx={{ mt: 2, py: 1, borderRadius: 3, fontWeight: 600, borderColor: PRIMARY_NEON, color: PRIMARY_NEON }}>
                                            Tüm Seferlere Git
                                        </Button>
                                    </Paper>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
