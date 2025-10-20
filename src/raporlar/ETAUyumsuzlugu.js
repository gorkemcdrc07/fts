// src/aktifseferler/dashboard.jsx

import * as React from "react";
import {
    Box, Stack, Typography, Chip, IconButton, Divider, Collapse,
    Paper, useTheme, Container, TextField, MenuItem,
    Switch, FormControlLabel, Button, CircularProgress, Dialog, DialogTitle,
    DialogContent, DialogActions,
    Table, TableHead, TableRow, TableCell, TableBody
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TimelineIcon from "@mui/icons-material/Timeline";
import { alpha } from "@mui/system";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabase } from "../supabaseClient";


/* =========================================================== */
/* ==================== KOYU TEMA SABİTLERİ ================== */
/* =========================================================== */

const DARK_COLORS = {
    pageBg: "#121212",
    surface: "#1E1E1E",
    surface2: "#2A2A2A",
    border: "#444444",
    text: "#E0E0E0",
    textMuted: "#A0A0A0",
    zebra: "#252525",
    primary: "#BB86FC",
    neonGreen: "#03DAC6",
    neonRed: "#CF6679",
};

const getStatusPalette = (theme) => ({
    red: DARK_COLORS.neonRed,
    mint: DARK_COLORS.neonGreen,
    blue: DARK_COLORS.primary,
    themePrimary: theme.palette.primary.main,
});

/* =========================================================== */
/* ======================== HELPERS ========================== */
/* =========================================================== */

// ISO → "GG.AA.YYYY SS:DD"
const fmt = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
};

const minToHM = (m) => {
    const mm = Math.max(0, Math.round(m || 0));
    const h = Math.floor(mm / 60);
    const r = mm % 60;
    if (h && r) return `${h} saat ${r} dakika`;
    if (h) return `${h} saat`;
    return `${r} dakika`;
};

const getTodayDateString = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 🟢 YENİ HELPER: Zaman dilimi kaymasını önlemek için tarihleri UTC olarak kaydeder
const createExcelDate = (isoString) => {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return null;

    // Yerel saati alıp, bunu UTC saati olarak kabul eden bir Date objesi oluşturur.
    // Bu, Excel'in zaman dilimi dönüşümlerini yapmasını engeller.
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const seconds = d.getSeconds();

    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
};

/* =========================================================== */
/* ============== ETA HESABI (KGM 4.5s + 45dk) =============== */
/* =========================================================== */

/**
 * distanceKm: sayı (örn 528)
 * startIso: sefer başlangıç zamanı (ISO)
 * avgKmh: ortalama hız (default 65)
 */
function calcETAFromDistance({ distanceKm, startIso, avgKmh = 65 }) {
    if (!distanceKm || !startIso) return null;
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) return null;

    const driveHours = distanceKm / avgKmh; // toplam sürüş saati
    const driveMs = driveHours * 60 * 60 * 1000;

    const blocks = Math.floor(driveHours / 4.5); // her 4.5h için 45dk mola
    const breakMs = blocks * 45 * 60 * 1000;

    const etaMs = start.getTime() + driveMs + breakMs;
    return new Date(etaMs);
}

/* =========================================================== */
/* =================== DATA FETCH LOGIC ====================== */
/* =========================================================== */

async function fetchPerformanceData(startDate, endDate) {
    const rangeMin = `${startDate || ""}T00:00:00`;
    const rangeMax = `${endDate || ""}T23:59:59`;

    // Sorgu formatı düzeltildi ve teslim_varis kullanıldı
    const activeSeferSelectQuery = `id,sefer_no,sefer_tarihi,plaka,surucu_ad_soyad,eta_varis,eta_note,sefer_detaylari(teslim_varis,nokta_sirasi,yukleme_ili,yukleme_ilcesi,teslim_ili,teslim_ilcesi,yukleme_noktasi,teslim_noktasi)`;

    const { data: activeData, error: activeError } = await supabase
        .from('seferler')
        .select(activeSeferSelectQuery)
        .gte('sefer_tarihi', rangeMin)
        .lte('sefer_tarihi', rangeMax);

    if (activeError) console.error(`Supabase sorgu hatası (seferler):`, activeError);

    const reportData = [];

    (activeData || []).forEach(sefer => {
        const eta = sefer.eta_varis ? new Date(sefer.eta_varis) : null;

        const firstDeliveryDetail = (sefer.sefer_detaylari || [])
            .sort((a, b) => (a.nokta_sirasi || 0) - (b.nokta_sirasi || 0))[0];

        // Veritabanı şemasına göre 'teslim_varis' kullanılıyor.
        const firstDeliveryTimeISO = firstDeliveryDetail?.teslim_varis || null;
        const deliveryTime = firstDeliveryTimeISO ? new Date(firstDeliveryTimeISO) : null;

        let durum = 'KULLANICI GİRİŞİ BEKLENİYOR';
        let fark_dk_signed = null;
        let fark_dk = null;

        // Teslim var & ETA var → farkı hesapla
        if (deliveryTime && eta) {
            fark_dk_signed = Math.round((deliveryTime.getTime() - eta.getTime()) / 60000); // +gecikme, -erken
            fark_dk = Math.abs(fark_dk_signed);
            durum = fark_dk_signed > 5 ? 'GECİKMİŞ' : fark_dk_signed < -5 ? 'ERKEN' : 'ZAMANINDA';
        } else if (sefer.eta_note) {
            durum = 'VERİ EKSİK';
        }

        let eta_display = sefer.eta_varis ? fmt(sefer.eta_varis) : (sefer.eta_note || '-');
        if ((sefer.eta_note || '').toLowerCase().includes('mesafe bulunamadı')) {
            eta_display = 'Mesafe bulunamadı';
        }

        reportData.push({
            id: sefer.id,
            sefer_no: sefer.sefer_no,
            plaka: sefer.plaka,
            surucu: sefer.surucu_ad_soyad,
            sefer_tarihi: sefer.sefer_tarihi,
            eta_gosterim: eta_display,
            // Fiili teslimat zamanı olarak teslim_varis kullanılır
            ilk_teslim_varis: firstDeliveryTimeISO,
            fark_dk_signed,
            fark_dk,
            durum,
            sefer_tipi: 'Aktif',
            // Mesafe diyalogu için:
            yukleme_ili: firstDeliveryDetail?.yukleme_ili || null,
            yukleme_ilcesi: firstDeliveryDetail?.yukleme_ilcesi || null,
            teslim_ili: firstDeliveryDetail?.teslim_ili || null,
            teslim_ilcesi: firstDeliveryDetail?.teslim_ilcesi || null,
            yukleme_noktasi: firstDeliveryDetail?.yukleme_noktasi || null,
            teslim_noktasi: firstDeliveryDetail?.teslim_noktasi || null,
        });
    });

    return reportData;
}

/* =========================================================== */
/* ================ DISTANCE INPUT COMPONENT ================= */
/* =========================================================== */

function DistanceInputDialog({ open, onClose, seferData, onSaved }) {
    const [distance, setDistance] = React.useState('');
    const [status, setStatus] = React.useState('Arama Bekleniyor');
    const [loading, setLoading] = React.useState(false);
    const [foundDistance, setFoundDistance] = React.useState(null);
    const [canManuallyEnter, setCanManuallyEnter] = React.useState(false);

    const { yukleme_ili, yukleme_ilcesi, teslim_ili, teslim_ilcesi, yukleme_noktasi, teslim_noktasi } = seferData || {};

    const dialogInputSX = {
        "& .MuiInputBase-root": {
            backgroundColor: DARK_COLORS.surface2,
            color: DARK_COLORS.text,
            borderRadius: 1.5,
            border: `1px solid ${DARK_COLORS.border}`,
        },
        "& .MuiInputLabel-root": { color: DARK_COLORS.textMuted },
        "& .MuiFormLabel-root.Mui-focused": { color: DARK_COLORS.primary },
    };

    React.useEffect(() => {
        if (open && seferData) {
            setDistance('');
            setFoundDistance(null);
            setCanManuallyEnter(false);
            searchDistance();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, seferData]);

    const searchDistance = React.useCallback(async () => {
        if (!seferData) return;
        setLoading(true);
        setStatus('Veritabanında Mesafe Aranıyor...');

        if (!yukleme_ili || !yukleme_ilcesi || !teslim_ili || !teslim_ilcesi) {
            setStatus('Adres bilgileri eksik (İl/İlçe). Manuel giriş yapabilirsiniz.');
            setCanManuallyEnter(true);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('mesafeler')
            .select('mesafe')
            .eq('yukleme_il', yukleme_ili).eq('yukleme_ilce', yukleme_ilcesi)
            .eq('teslim_il', teslim_ili).eq('teslim_ilce', teslim_ilcesi)
            .limit(1).maybeSingle();

        setLoading(false);

        if (error) {
            console.error("Mesafe sorgu hatası:", error);
            setStatus('Mesafe sorgulanırken bir hata oluştu.');
            setCanManuallyEnter(true);
        } else if (data && data.mesafe) {
            setFoundDistance(data.mesafe);
            setDistance(String(data.mesafe));
            setStatus(`Mesafe bulundu: ${data.mesafe} km.`);
            setCanManuallyEnter(true);
        } else {
            setStatus('Bu güzergah için kayıtlı mesafe bulunamadı. Lütfen manuel girin.');
            setCanManuallyEnter(true);
        }
    }, [seferData, yukleme_ili, yukleme_ilcesi, teslim_ili, teslim_ilcesi]);

    const handleSave = async () => {
        if (!seferData || !distance || isNaN(Number(distance))) {
            return alert('Lütfen geçerli bir mesafe değeri girin.');
        }
        setLoading(true);
        setStatus('Mesafe kaydediliyor...');

        // 1) Mesafeyi kaydet / güncelle
        const { error: upsertErr } = await supabase
            .from('mesafeler')
            .upsert({
                yukleme_il: yukleme_ili, yukleme_ilce: yukleme_ilcesi,
                teslim_il: teslim_ili, teslim_ilce: teslim_ilcesi,
                mesafe: Number(distance)
            }, { onConflict: 'yukleme_il,yukleme_ilce,teslim_il,teslim_ilce' });

        if (upsertErr) {
            console.error("Mesafe kaydetme hatası:", upsertErr);
            setLoading(false);
            setStatus('Kaydetme sırasında bir hata oluştu.');
            return;
        }

        // 2) Yeni mesafeye göre ETA hesapla ve sefer kaydını güncelle
        try {
            const eta = calcETAFromDistance({
                distanceKm: Number(distance),
                startIso: seferData?.sefer_tarihi,
                avgKmh: 65, // istersen ayarlanabilir yaparız
            });
            if (eta) {
                const { error: updErr } = await supabase
                    .from('seferler')
                    .update({ eta_varis: eta.toISOString(), eta_note: null })
                    .eq('id', seferData.id);

                if (updErr) {
                    console.error("ETA güncelleme hatası:", updErr);
                    setStatus('ETA güncellenemedi, lütfen tekrar deneyin.');
                    setLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.error("ETA hesaplama/güncelleme hatası:", e);
            setStatus('ETA hesaplanırken bir sorun oluştu.');
            setLoading(false);
            return;
        }

        setLoading(false);
        setStatus('Mesafe ve ETA güncellendi.');
        // 3) Parent'a haber ver → tabloyu yenile
        onSaved?.(Number(distance));
    };

    if (!seferData) return null;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{
            sx: { borderRadius: 3, bgcolor: DARK_COLORS.surface, color: DARK_COLORS.text }
        }}>
            <DialogTitle sx={{ bgcolor: DARK_COLORS.surface2, pb: 1.5 }}>
                <Typography variant="h6" fontWeight={700} color={DARK_COLORS.text}>
                    Mesafe Girişi: Sefer #{seferData.sefer_no}
                </Typography>
                <Typography variant="caption" color={DARK_COLORS.textMuted}>
                    ETA hesaplaması için mesafe bilgisi gereklidir.
                </Typography>
            </DialogTitle>
            <DialogContent dividers sx={{ pt: 2, borderColor: DARK_COLORS.border }}>
                <Stack spacing={2}>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: DARK_COLORS.surface2, borderColor: DARK_COLORS.border }}>
                        <Stack direction="row" justifyContent="space-between" mb={1}>
                            <Typography variant="body2" fontWeight={600} color={DARK_COLORS.text}>Kalkış:</Typography>
                            <Typography variant="body2" color={DARK_COLORS.text}>{yukleme_ili} / {yukleme_ilcesi}</Typography>
                        </Stack>
                        <Typography variant="caption" display="block" color={DARK_COLORS.textMuted} mb={2}>
                            Nokta: {yukleme_noktasi || '-'}
                        </Typography>
                        <Stack direction="row" justifyContent="space-between" mb={1}>
                            <Typography variant="body2" fontWeight={600} color={DARK_COLORS.text}>Varış:</Typography>
                            <Typography variant="body2" color={DARK_COLORS.text}>{teslim_ili} / {teslim_ilcesi}</Typography>
                        </Stack>
                        <Typography variant="caption" display="block" color={DARK_COLORS.textMuted}>
                            Nokta: {teslim_noktasi || '-'}
                        </Typography>
                    </Paper>
                    <Divider sx={{ borderColor: DARK_COLORS.border }} />
                    <Box sx={{ minHeight: 40 }}>
                        {loading ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <CircularProgress size={20} color="primary" />
                                <Typography variant="body2" color={DARK_COLORS.textMuted}>{status}</Typography>
                            </Stack>
                        ) : (
                            <Typography variant="body2" color={foundDistance ? DARK_COLORS.neonGreen : DARK_COLORS.textMuted}>{status}</Typography>
                        )}
                    </Box>
                    {canManuallyEnter && (
                        <TextField
                            label="Mesafe (km) Giriniz" type="number" value={distance}
                            onChange={(e) => setDistance(e.target.value)}
                            fullWidth disabled={loading} variant="outlined"
                            sx={dialogInputSX}
                            InputProps={{ endAdornment: <Typography color={DARK_COLORS.textMuted}>KM</Typography> }}
                        />
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, bgcolor: DARK_COLORS.surface2 }}>
                <Button onClick={onClose} disabled={loading} sx={{ color: DARK_COLORS.textMuted }}>Kapat</Button>
                {canManuallyEnter && (
                    <Button
                        onClick={handleSave}
                        sx={{ bgcolor: DARK_COLORS.primary, color: DARK_COLORS.text, '&:hover': { bgcolor: alpha(DARK_COLORS.primary, 0.8) } }}
                        variant="contained"
                        disabled={loading || !distance}
                    >
                        {loading ? <CircularProgress size={20} color="inherit" /> : 'Mesafeyi Kaydet'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

/* =========================================================== */
/* =================== MAIN DASHBOARD ======================== */
/* =========================================================== */

export default function Dashboard({ onOpenRow }) {
    const theme = useTheme();
    const statusPalette = getStatusPalette(theme);

    const filterInputSX = {
        "& .MuiInputBase-root": {
            backgroundColor: DARK_COLORS.surface2,
            color: DARK_COLORS.text,
            borderRadius: 1,
            border: `1px solid ${DARK_COLORS.border}`,
        },
        "& .MuiInputLabel-root": { color: DARK_COLORS.textMuted },
        "& .MuiFormLabel-root.Mui-focused": { color: DARK_COLORS.primary },
    };

    const [reportRows, setReportRows] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [isExpanded, setIsExpanded] = React.useState(true);

    const [isDistanceModalOpen, setIsDistanceModalOpen] = React.useState(false);
    const [selectedSefer, setSelectedSefer] = React.useState(null);

    const todayString = getTodayDateString();
    const [startDate, setStartDate] = React.useState(todayString);
    const [endDate, setEndDate] = React.useState(todayString);

    // Filtre & Sıralama
    const [onlyLate, setOnlyLate] = React.useState(true);
    const [sortKey, setSortKey] = React.useState("farkDesc");

    const loadData = React.useCallback(async () => {
        setLoading(true);
        const data = await fetchPerformanceData(startDate, endDate);
        setReportRows(data);
        setLoading(false);
    }, [startDate, endDate]);

    React.useEffect(() => { loadData(); }, [loadData]);

    const filteredReport = React.useMemo(() => {
        let list = [...reportRows];
        if (onlyLate) {
            list = list.filter(r =>
                r.durum.includes('GECİK') ||
                r.durum.includes('AŞIMI') ||
                r.eta_gosterim === 'Mesafe bulunamadı' ||
                r.durum === 'KULLANICI GİRİŞİ BEKLENİYOR'
            );
        }

        if (sortKey === 'farkDesc') {
            list.sort((a, b) => (b.fark_dk ?? -1) - (a.fark_dk ?? -1));
        } else if (sortKey === 'dateAsc') {
            list.sort((a, b) => new Date(a.sefer_tarihi) - new Date(b.sefer_tarihi));
        }
        return list;
    }, [reportRows, onlyLate, sortKey]);

    const handleEtaClick = (sefer) => {
        if (sefer.eta_gosterim === 'Mesafe bulunamadı') {
            setSelectedSefer(sefer);
            setIsDistanceModalOpen(true);
        }
    };

    // Mesafe/ETA kaydedildikten sonra modal kapat & tabloyu yenile
    const handleDistanceSaved = () => {
        setIsDistanceModalOpen(false);
        loadData();
    };

    // 🛑 EXCEL EXPORT FONKSİYONU DÜZELTİLDİ
    const handleExportExcel = React.useCallback(async () => {
        const rows = filteredReport.map(r => ({
            Tip: r.sefer_tipi,
            "Sefer No": r.sefer_no,
            Plaka: r.plaka,
            // 🛑 DÜZELTME: createExcelDate kullanıldı
            "Tarih": createExcelDate(r.sefer_tarihi),
            "ETA / Not": r.eta_gosterim,
            // 🛑 DÜZELTME: createExcelDate kullanıldı
            "Teslim Varış": createExcelDate(r.ilk_teslim_varis),
            "Fark": r.fark_dk !== null ?
                `${(r.fark_dk_signed ?? 0) > 0 ? 'Gecikti ' : 'Erken '}${minToHM(r.fark_dk)}` : '-',
            "Durum": r.durum,
        }));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('ETA Raporu');

        worksheet.columns = [
            { header: "Tip", key: "Tip", width: 10 },
            { header: "Sefer No", key: "Sefer No", width: 14 },
            { header: "Plaka", key: "Plaka", width: 12 },
            // 🛑 DÜZELTME: Tarih formatına saat eklendi
            { header: "Tarih", key: "Tarih", width: 18, style: { numFmt: 'dd.mm.yyyy hh:mm' } },
            { header: "ETA / Not", key: "ETA / Not", width: 30 },
            // 🛑 DÜZELTME: Teslim Varış formatına saat eklendi
            { header: "Teslim Varış", key: "Teslim Varış", width: 18, style: { numFmt: 'dd.mm.yyyy hh:mm' } },
            { header: "Fark", key: "Fark", width: 18 },
            { header: "Durum", key: "Durum", width: 18 },
        ];

        worksheet.addRows(rows);

        // Dosyayı oluştur ve indir
        const fileName = `eta_rapor_${getTodayDateString()}.xlsx`;
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        saveAs(blob, fileName);

    }, [filteredReport, startDate, endDate]);

    return (
        <Container maxWidth="lg" disableGutters sx={{ color: DARK_COLORS.text }}>
            <Stack spacing={1.5}>
                {/* Kontrol Paneli */}
                <Paper
                    sx={{
                        p: 1.5,
                        borderRadius: 2.5,
                        background: DARK_COLORS.surface,
                        boxShadow: `0 4px 15px ${alpha(DARK_COLORS.pageBg, 0.5)}`,
                        border: `1px solid ${DARK_COLORS.border}`
                    }}
                >
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center">
                        <TextField
                            label="Başlangıç" type="date" size="small" value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={filterInputSX}
                        />
                        <TextField
                            label="Bitiş" type="date" size="small" value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={filterInputSX}
                        />
                        <Button
                            variant="contained"
                            onClick={loadData}
                            disabled={loading}
                            sx={{ bgcolor: DARK_COLORS.primary, color: DARK_COLORS.text, '&:hover': { bgcolor: alpha(DARK_COLORS.primary, 0.8) } }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : 'Yenile'}
                        </Button>

                        <Button
                            variant="outlined"
                            onClick={handleExportExcel}
                            disabled={loading || filteredReport.length === 0}
                            sx={{
                                borderColor: DARK_COLORS.primary,
                                color: DARK_COLORS.primary,
                                '&:hover': { borderColor: alpha(DARK_COLORS.primary, 0.8), bgcolor: alpha(DARK_COLORS.primary, 0.08) }
                            }}
                        >
                            Excel’e Aktar
                        </Button>

                        <Divider orientation="vertical" flexItem sx={{ bgcolor: DARK_COLORS.border }} />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={onlyLate}
                                    onChange={(e) => setOnlyLate(e.target.checked)}
                                    sx={{ '& .MuiSwitch-track': { bgcolor: DARK_COLORS.border }, '& .Mui-checked .MuiSwitch-thumb': { bgcolor: DARK_COLORS.primary } }}
                                />
                            }
                            label={<Typography color={DARK_COLORS.textMuted}>Sadece Uyumsuzluklar</Typography>}
                        />
                        <TextField
                            select size="small" value={sortKey}
                            onChange={(e) => setSortKey(e.target.value)}
                            label="Sırala" sx={{ minWidth: 200, ...filterInputSX }}
                            InputProps={{ sx: { color: DARK_COLORS.text } }}
                        >
                            <MenuItem value="farkDesc" sx={{ bgcolor: DARK_COLORS.surface, color: DARK_COLORS.text }}>Gecikme (En Yüksekten)</MenuItem>
                            <MenuItem value="dateAsc" sx={{ bgcolor: DARK_COLORS.surface, color: DARK_COLORS.text }}>Sefer Tarihi (Eskiden)</MenuItem>
                        </TextField>
                    </Stack>
                </Paper>

                {/* Rapor Başlığı */}
                <Box sx={{ border: `1px solid ${DARK_COLORS.border}`, borderRadius: 2.5, bgcolor: DARK_COLORS.surface2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <TimelineIcon sx={{ color: DARK_COLORS.primary }} />
                            <Typography variant="subtitle1" fontWeight={700} color={DARK_COLORS.text}>Sefer ETA Performans Raporu</Typography>
                            <Chip size="small" label={`${filteredReport.length} Sefer`} sx={{ bgcolor: DARK_COLORS.primary, color: DARK_COLORS.text, fontWeight: 700 }} />
                        </Stack>
                        <IconButton onClick={() => setIsExpanded(v => !v)} sx={{ color: DARK_COLORS.textMuted, '&:hover': { color: DARK_COLORS.primary, bgcolor: alpha(DARK_COLORS.primary, 0.1) } }}>
                            <ExpandMoreIcon sx={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: 'transform 0.3s' }} />
                        </IconButton>
                    </Stack>
                </Box>

                {/* Rapor Tablosu */}
                <Collapse in={isExpanded}>
                    <Paper sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: DARK_COLORS.surface, border: `1px solid ${DARK_COLORS.border}` }}>
                        <Box sx={{ maxHeight: 600, overflowY: "auto" }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow sx={{ '& th': { bgcolor: DARK_COLORS.surface2, color: DARK_COLORS.textMuted, fontWeight: 700, borderBottom: `1px solid ${DARK_COLORS.border}` } }}>
                                        {['Tip', 'Sefer No', 'Plaka', 'Tarih', 'ETA / Not', 'Teslim Varış', 'Fark', 'Durum'].map(head => <TableCell key={head}>{head}</TableCell>)}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center" sx={{ bgcolor: DARK_COLORS.surface }}>
                                                <CircularProgress color="primary" size={30} />
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredReport.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center" sx={{ bgcolor: DARK_COLORS.surface, color: DARK_COLORS.textMuted }}>
                                                Kriterlere uygun sefer bulunamadı.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredReport.map((r, index) => {
                                            const isDistanceError = r.eta_gosterim === 'Mesafe bulunamadı';

                                            let statusColor = DARK_COLORS.text;
                                            if (r.durum.includes('GECİK') || isDistanceError) statusColor = statusPalette.red;
                                            else if (r.durum === 'ERKEN') statusColor = statusPalette.mint;
                                            else if (r.durum === 'KULLANICI GİRİŞİ BEKLENİYOR' || r.durum === 'VERİ EKSİK') statusColor = DARK_COLORS.textMuted;

                                            const rowBg = index % 2 === 0 ? DARK_COLORS.surface : DARK_COLORS.zebra;

                                            return (
                                                <TableRow
                                                    hover
                                                    key={r.id || r.sefer_no}
                                                    sx={{
                                                        bgcolor: rowBg,
                                                        '&:hover': { bgcolor: alpha(DARK_COLORS.primary, 0.05) },
                                                        '& td': { borderColor: DARK_COLORS.border }
                                                    }}
                                                >
                                                    <TableCell sx={{ color: DARK_COLORS.text }}>
                                                        <Chip
                                                            label={r.sefer_tipi}
                                                            size="small"
                                                            color="info"
                                                            variant="outlined"
                                                            sx={{ borderColor: DARK_COLORS.border, color: DARK_COLORS.primary }}
                                                        />
                                                    </TableCell>

                                                    <TableCell
                                                        sx={{ cursor: 'pointer', fontWeight: 600, color: DARK_COLORS.primary }}
                                                        onClick={() => onOpenRow && onOpenRow(r)}
                                                    >
                                                        {r.sefer_no}
                                                    </TableCell>

                                                    <TableCell sx={{ color: DARK_COLORS.text }}>{r.plaka}</TableCell>
                                                    <TableCell sx={{ color: DARK_COLORS.text }}>{fmt(r.sefer_tarihi)}</TableCell>

                                                    <TableCell
                                                        onClick={() => handleEtaClick(r)}
                                                        sx={{
                                                            cursor: isDistanceError ? 'pointer' : 'default',
                                                            color: isDistanceError ? statusPalette.red : DARK_COLORS.text,
                                                            textDecoration: isDistanceError ? 'underline dashed' : 'none',
                                                            fontWeight: isDistanceError ? 700 : 400
                                                        }}
                                                    >
                                                        {r.eta_gosterim}
                                                    </TableCell>

                                                    <TableCell sx={{ color: DARK_COLORS.textMuted }}>{fmt(r.ilk_teslim_varis)}</TableCell>

                                                    <TableCell>
                                                        {r.fark_dk !== null ? (
                                                            <Chip
                                                                size="small"
                                                                label={`${(r.fark_dk_signed ?? 0) > 0 ? 'Gecikti ' : 'Erken '}${minToHM(r.fark_dk)}`}
                                                                color={(r.fark_dk_signed ?? 0) > 0 ? 'error' : 'success'}
                                                                variant={(r.fark_dk_signed ?? 0) > 0 ? "filled" : "outlined"}
                                                                sx={{
                                                                    bgcolor: (r.fark_dk_signed ?? 0) > 0 ? statusPalette.red : 'transparent',
                                                                    color: (r.fark_dk_signed ?? 0) > 0 ? DARK_COLORS.text : statusPalette.mint,
                                                                    borderColor: (r.fark_dk_signed ?? 0) > 0 ? 'none' : statusPalette.mint,
                                                                    fontWeight: 700
                                                                }}
                                                            />
                                                        ) : (
                                                            <Typography variant="caption" color={DARK_COLORS.textMuted}>-</Typography>
                                                        )}
                                                    </TableCell>

                                                    <TableCell>
                                                        <Typography fontWeight={700} color={statusColor}>{r.durum}</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </Box>
                    </Paper>
                </Collapse>
            </Stack>

            <DistanceInputDialog
                open={isDistanceModalOpen}
                onClose={() => setIsDistanceModalOpen(false)}
                seferData={selectedSefer}
                onSaved={handleDistanceSaved}
            />
        </Container>
    );
}
