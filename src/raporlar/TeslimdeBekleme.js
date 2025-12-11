// ===============================================
// TeslimdeBekleme.jsx — SON SÜRÜM (Sefer Tekrarı Hatası Düzeltildi)
// ===============================================

import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "../supabaseClient";

import dayjs from "dayjs";
import "dayjs/locale/tr";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import weekOfYear from "dayjs/plugin/weekOfYear";
import updateLocale from "dayjs/plugin/updateLocale";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import {
    Container,
    Typography,
    Box,
    TextField,
    Button,
    Grid,
    CircularProgress,
    Alert,
    Paper,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Tooltip,
    Collapse,
    IconButton,
    LinearProgress,
} from "@mui/material";

import { useTheme } from "@mui/material/styles"; // useTheme importu düzeltildi

import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";


// --------------------------------------------------------------
// DAYJS AYARLARI
// --------------------------------------------------------------
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekOfYear);
dayjs.extend(updateLocale);
dayjs.locale("tr");

dayjs.updateLocale("tr", { weekStart: 1 });


// --------------------------------------------------------------
// SUPABASE TABLOLARI
// --------------------------------------------------------------
const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";

const DETAIL_COLS = `
    sefer_no,
    teslim_noktasi,
    teslim_varis,
    teslim_cikis
`;

const SUMMARY_COLS = `
    sefer_no,
    plaka,
    proje_adi,
    yukleme_ili,
    teslim_ili,
    sefer_tarihi
`;


// --------------------------------------------------------------
// YARDIMCI FONKSİYONLAR
// --------------------------------------------------------------
const parseDT = (v) => {
    const d = dayjs(v);
    return d.isValid() ? d : null;
};

const fmt = (v) => {
    const d = parseDT(v);
    return d ? d.format("DD.MM.YYYY HH:mm") : "—";
};

const minToHM = (m) => {
    const total = Math.max(0, Math.round(m || 0));
    const h = Math.floor(total / 60);
    const r = total % 60;
    if (h && r) return `${h} sa ${r} dk`;
    if (h) return `${h} sa`;
    if (r) return `${r} dk`;
    return "0 dk";
};


// --------------------------------------------------------------
// KURAL HESAPLAMA
// --------------------------------------------------------------
const calcRule = (varis, cikis) => {
    const v = parseDT(varis);
    const c = parseDT(cikis);

    if (!v || !c) return { appliedRule: "None", compliant: null, delay: 0 };
    if (v.day() === 0) return { appliedRule: "None", compliant: true, delay: 0 };

    if (v.day() === 6 && v.hour() >= 12) {
        const monday = v.clone().add(2, "day").hour(12).minute(0);
        return c.isSameOrBefore(monday)
            ? { appliedRule: "Rule 3", compliant: true, delay: 0 }
            : { appliedRule: "Rule 3", compliant: false, delay: c.diff(monday, "minute") };
    }

    const lower1 = v.clone().hour(8).minute(30);
    const upper1 = v.clone().hour(12).minute(0);

    if (v.isSameOrAfter(lower1) && v.isBefore(upper1)) {
        const deadline = v.clone().hour(17).minute(0);
        return c.isSameOrBefore(deadline)
            ? { appliedRule: "Rule 1", compliant: true, delay: 0 }
            : { appliedRule: "Rule 1", compliant: false, delay: c.diff(deadline, "minute") };
    }

    if (v.isSameOrAfter(upper1)) {
        let deadline = v.clone().add(1, "day").hour(12).minute(0);

        if (v.day() === 5 && v.hour() >= 12) {
            deadline = v.clone().add(3, "day").hour(12).minute(0);
        }

        return c.isSameOrBefore(deadline)
            ? { appliedRule: "Rule 2", compliant: true, delay: 0 }
            : { appliedRule: "Rule 2", compliant: false, delay: c.diff(deadline, "minute") };
    }

    return { appliedRule: "None", compliant: true, delay: 0 };
};


// --------------------------------------------------------------
// PERFORMANS PUANI HESABI
// --------------------------------------------------------------
const calculateScore = (trips, nonComp, delayMin) => {
    if (trips === 0) return { score: 10.0, penalty: 0.0 };

    const violRate = (nonComp / trips) * 100;
    const avgDelay = nonComp > 0 ? delayMin / nonComp : 0;

    const violPenalty = Math.min(5, (violRate / 50) * 5);
    const delayPenalty = Math.min(5, (avgDelay / 180) * 5);

    const penalty = violPenalty + delayPenalty;
    const score = Math.max(0, 10 - penalty);

    return {
        score: parseFloat(score.toFixed(1)),
        penalty: parseFloat(penalty.toFixed(1)),
    };
};


// --------------------------------------------------------------
// EXCEL EXPORT
// --------------------------------------------------------------
const exportExcel = async (rows) => {
    if (!rows.length) return;

    // Sadece ihlalli kayıtları filtrele
    const filtered = rows.filter(
        (r) => r.rule.compliant === false && r.rule.delay > 0
    );

    if (!filtered.length) {
        alert("İhlalli kayıt bulunamadı.");
        return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("İhlalli Kayıtlar");

    ws.columns = [
        { header: "Sefer No", key: "sefer_no", width: 12 },
        { header: "Plaka", key: "plaka", width: 10 },
        { header: "Proje", key: "proje", width: 20 },
        { header: "Teslim Noktası", key: "nokta", width: 25 },
        { header: "Varış", key: "varis", width: 20 },
        { header: "Çıkış", key: "cikis", width: 20 },
        { header: "Kural", key: "rule", width: 15 },
        { header: "Gecikme", key: "delay", width: 15 },
    ];

    filtered.forEach((r) =>
        ws.addRow({
            sefer_no: r.sefer_no,
            plaka: r.plaka,
            proje: r.proje_adi,
            nokta: r.teslim_noktasi,
            varis: fmt(r.teslim_varis),
            cikis: fmt(r.teslim_cikis),
            rule: r.rule.appliedRule,
            delay: minToHM(r.rule.delay),
        })
    );

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(
        new Blob([buffer]),
        `bekleme_ihlalleri_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`
    );
};


// ======================================================================
// UI — Detaylı plaka satırı (açılır liste)
// ======================================================================
const DetailedRow = ({ row }) => {
    const [open, setOpen] = useState(false);

    // Kurala uymayan seferleri say
    const nonCompliantTrips = row.trips.filter(t => t.rule.compliant === false);

    return (
        <>
            <TableRow hover onClick={() => setOpen(!open)} sx={{ cursor: "pointer" }}>
                <TableCell>{open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>{row.plaka}</TableCell>
                <TableCell>{row.proje_adi}</TableCell>
                <TableCell align="right">{row.totalTrips}</TableCell>
                <TableCell align="right" sx={{ color: row.nonCompliantCount ? "error.main" : "" }}>
                    {row.nonCompliantCount}
                </TableCell>
                <TableCell align="right">{row.violationRate}%</TableCell>
                <TableCell align="right">{row.totalDelay}</TableCell>
            </TableRow>

            <TableRow>
                <TableCell colSpan={7} sx={{ p: 0 }}>
                    <Collapse in={open}>
                        <Box sx={{ p: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                İhlalli Sefer Detayları ({nonCompliantTrips.length} kayıt)
                            </Typography>

                            {nonCompliantTrips.length === 0 ? (
                                <Alert severity="success" size="small">
                                    Bu araç için seçili aralıkta kural ihlali bulunmamaktadır.
                                </Alert>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Sefer</TableCell>
                                            <TableCell>Tarih</TableCell>
                                            <TableCell>Güzergah</TableCell>
                                            <TableCell>Nokta</TableCell>
                                            <TableCell>Varış / Çıkış</TableCell>
                                            <TableCell>Kural</TableCell>
                                            <TableCell align="right">Gecikme</TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {nonCompliantTrips.map((t, i) => (
                                            <TableRow
                                                key={i}
                                                sx={{
                                                    backgroundColor: "rgba(255,0,0,0.08)",
                                                }}
                                            >
                                                <TableCell>{t.sefer_no}</TableCell>
                                                <TableCell>
                                                    {dayjs(t.sefer_tarihi).format("DD.MM.YYYY")}
                                                </TableCell>
                                                <TableCell>
                                                    {t.yukleme_ili} → {t.teslim_ili}
                                                </TableCell>
                                                <TableCell>{t.teslim_noktasi}</TableCell>
                                                <TableCell>
                                                    {fmt(t.teslim_varis)} <br /> {fmt(t.teslim_cikis)}
                                                </TableCell>
                                                <TableCell>{t.rule.appliedRule}</TableCell>
                                                <TableCell align="right">
                                                    {minToHM(t.rule.delay)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
};


// ======================================================================
// ANA KOMPONENT
// ======================================================================
export default function TeslimdeBekleme() {
    const theme = useTheme();

    // GÜNLÜK & AYLIK
    const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [dailyMonth, setDailyMonth] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    // YENİ STATE'LER (Progress ve Zaman Takibi)
    const [progressMessage, setProgressMessage] = useState(null);
    const [startTime, setStartTime] = useState(null);
    const [progressValue, setProgressValue] = useState(0);


    // ANALİZ
    const [startDate, setStartDate] = useState(dayjs().subtract(7, "day").format("YYYY-MM-DD"));
    const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [detailedAnalysis, setDetailedAnalysis] = useState([]);
    const [analysisLoading, setAnalysisLoading] = useState(false);

    const [error, setError] = useState(null);

    /**
     * Tek bir gün/hafta aralığı için veriyi çeken yardımcı fonksiyon
     */
    const fetchByDayRange = async (startISO, endISO) => {
        const { data: detail, error: detailError } = await supabase
            .from(DETAIL_TABLE)
            .select(DETAIL_COLS)
            .gte("teslim_varis", startISO)
            .lte("teslim_varis", endISO);

        if (detailError) throw detailError;
        return detail;
    }


    // --------------------------------------------------------------
    // GÜNLÜK + AYLIK VERİ ÇEK (AYLIK HAFTA HAFTA ÇEKİYOR)
    // --------------------------------------------------------------
    const fetchDaily = useCallback(async () => {
        setLoading(true);
        setRows([]);
        setError(null);
        setProgressMessage("Veri çekimi başlatılıyor...");
        setProgressValue(0);

        const fetchStartTime = Date.now();
        setStartTime(fetchStartTime);

        let allDetails = [];
        let totalWeeks = 1;

        try {
            if (date) {
                // 1. Günlük filtre (Tek sorgu)
                const start = dayjs(date).startOf("day").toISOString();
                const end = dayjs(date).endOf("day").toISOString();
                setProgressValue(50);
                allDetails = await fetchByDayRange(start, end);
                setProgressMessage(`'${dayjs(date).format('DD.MM.YYYY')}' tarihi için ${allDetails.length} detay kaydı çekildi.`);
                setProgressValue(100);

            } else if (dailyMonth) {
                // 2. Aylık filtre: HAFTA HAFTA ÇEKİP BİRLEŞTİRME İYİLEŞTİRMESİ
                const startOfMonth = dayjs(dailyMonth).startOf("month");
                const endOfMonth = dayjs(dailyMonth).endOf("month");

                let currentDate = startOfMonth.clone();
                let allMonthDetails = [];
                let weekCounter = 0;
                let totalDetailsCount = 0;

                // Tahmini hafta sayısını hesapla
                totalWeeks = Math.ceil(endOfMonth.diff(startOfMonth, 'week', true));
                if (totalWeeks === 0) totalWeeks = 1;


                while (currentDate.isSameOrBefore(endOfMonth, 'day')) {
                    weekCounter++;

                    // Haftalık aralığın sonunu belirle
                    let weekEnd = currentDate.clone().endOf('week');
                    if (weekEnd.isAfter(endOfMonth)) {
                        weekEnd = endOfMonth.clone();
                    }

                    // Progress Bar Güncellemesi (Çekim Kısmı: %0'dan %90'a kadar)
                    const calculatedProgress = Math.round((weekCounter / totalWeeks) * 90);
                    setProgressValue(calculatedProgress);


                    setProgressMessage(
                        `Veri çekiliyor: ${weekCounter} / ${totalWeeks} Hafta (${currentDate.format('DD.MM')} - ${weekEnd.format('DD.MM')})`
                    );

                    // --- Veri Çekme ---
                    const start = currentDate.startOf("day").toISOString();
                    const end = weekEnd.endOf("day").toISOString();
                    const details = await fetchByDayRange(start, end);
                    // ------------------


                    allMonthDetails = allMonthDetails.concat(details);
                    totalDetailsCount += details.length;

                    // Kalan Süre Tahmini Güncellemesi
                    const elapsed = Date.now() - fetchStartTime;
                    const timePerWeek = elapsed / weekCounter;
                    const remainingTimeMs = timePerWeek * (totalWeeks - weekCounter);
                    const remainingTimeSec = Math.round(remainingTimeMs / 1000);

                    setProgressMessage(
                        `Veri çekiliyor: ${weekCounter} / ${totalWeeks} Hafta (${totalDetailsCount} kayıt). Tahmini kalan süre: ${remainingTimeSec} sn.`
                    );

                    currentDate = weekEnd.add(1, 'day').startOf('day');
                }
                allDetails = allMonthDetails;

                // Progress Bar %95
                setProgressValue(95);
                setProgressMessage(`Detay kayıtları çekimi tamamlandı (${totalDetailsCount} kayıt). Özet veriler alınıyor...`);


            } else {
                // 3. Varsayılan olarak bugünü getir
                const today = dayjs();
                const start = today.startOf("day").toISOString();
                const end = today.endOf("day").toISOString();
                setDate(today.format("YYYY-MM-DD"));
                setProgressValue(50);
                allDetails = await fetchByDayRange(start, end);
                setProgressMessage(`Bugün (${today.format('DD.MM.YYYY')}) için ${allDetails.length} detay kaydı çekildi.`);
                setProgressValue(100);
            }

            if (!allDetails || allDetails.length === 0) {
                setRows([]);
                setLoading(false);
                setProgressMessage("Kayıt bulunamadı.");
                return;
            }

            // Özet verileri (Summary) tek seferde çek
            const seferNos = [...new Set(allDetails.map((d) => d.sefer_no))];

            setProgressValue(98);
            setProgressMessage(`Özet veri alınıyor (${seferNos.length} sefer)...`);

            const { data: summary, error: summaryError } = await supabase
                .from(SUMMARY_TABLE)
                .select(SUMMARY_COLS)
                .in("sefer_no", seferNos);

            if (summaryError) throw summaryError;

            // Summary verilerini Map'e atayalım
            const summaryMap = new Map();
            summary.forEach(s => summaryMap.set(s.sefer_no, s));

            // =========================================================================
            // YENİ GRUPLAMA MANTIĞI: Sefer Bazında En Kötü İhlali Bulma
            // =========================================================================
            const consolidatedMap = new Map();

            allDetails.forEach((d) => {
                const seferNo = d.sefer_no;
                const s = summaryMap.get(seferNo);
                if (!s) return;

                const rule = calcRule(d.teslim_varis, d.teslim_cikis);

                // Eğer bu detay kaydı ihlalli veya eksikse, işleme devam et
                if (rule.compliant === false || rule.compliant === null) {

                    const currentRecord = {
                        ...s,
                        teslim_noktasi: d.teslim_noktasi,
                        teslim_varis: d.teslim_varis,
                        teslim_cikis: d.teslim_cikis,
                        rule: rule,
                    };

                    // Haritada bu sefer için zaten bir kayıt var mı?
                    if (consolidatedMap.has(seferNo)) {
                        const existingRecord = consolidatedMap.get(seferNo);

                        // 1. Priorite: Eğer mevcut kayıt eksik veri (null) ise, yeni kural (false) veya daha büyük gecikme varsa değiştir.
                        if (existingRecord.rule.compliant === null) {
                            if (rule.compliant === false || rule.delay > existingRecord.rule.delay) {
                                consolidatedMap.set(seferNo, currentRecord);
                            }
                        }
                        // 2. Priorite: Eğer mevcut kayıt ihlalli (false) ise, daha büyük gecikmeyi seç.
                        else if (rule.delay > existingRecord.rule.delay) {
                            consolidatedMap.set(seferNo, currentRecord);
                        }
                        // Not: Yeni kural null ise ve mevcut false ise, değiştirme.

                    } else {
                        // İlk kez ekleniyorsa
                        consolidatedMap.set(seferNo, currentRecord);
                    }
                }
            });

            const final = Array.from(consolidatedMap.values());
            // =========================================================================


            setRows(final);

            // Bitiş mesajı
            const totalElapsed = (Date.now() - fetchStartTime) / 1000;
            setProgressMessage(`İşlem ${totalElapsed.toFixed(1)} saniyede tamamlandı. ${final.length} ihlal kaydı bulundu.`);
            setProgressValue(100);

        } catch (err) {
            setError(err.message);
            setProgressMessage("Hata oluştu.");
            setProgressValue(0);
        }

        setLoading(false);
        setStartTime(null);
    }, [date, dailyMonth]);


    // Günlük/Aylık Filtre Değişimini Otomatik Tetikle
    useEffect(() => {
        fetchDaily();
    }, [date, dailyMonth, fetchDaily]);


    // --------------------------------------------------------------
    // DETAYLI ANALİZ VERİSİ ÇEK
    // --------------------------------------------------------------
    const runAnalysis = useCallback(async () => {
        setAnalysisLoading(true);
        setDetailedAnalysis([]);
        setError(null);

        try {
            const start = dayjs(startDate).startOf("day").toISOString();
            const end = dayjs(endDate).endOf("day").toISOString();

            // Tüm detay kayıtlarını tek seferde çek 
            const { data: detail, error: detailError } = await supabase
                .from(DETAIL_TABLE)
                .select(DETAIL_COLS)
                .gte("teslim_varis", start)
                .lte("teslim_varis", end);

            if (detailError) throw detailError;

            if (!detail || !detail.length) {
                setDetailedAnalysis([]);
                setAnalysisLoading(false);
                return;
            }

            const seferNos = [...new Set(detail.map((d) => d.sefer_no))];

            const { data: summary, error: summaryError } = await supabase
                .from(SUMMARY_TABLE)
                .select(SUMMARY_COLS)
                .in("sefer_no", seferNos);

            if (summaryError) throw summaryError;


            const map = new Map();

            detail.forEach((d) => {
                const s = summary.find((x) => x.sefer_no === d.sefer_no);
                if (!s) return;

                const plaka = s.plaka;
                const rule = calcRule(d.teslim_varis, d.teslim_cikis);

                // Tüm verinin dahil edildiği, plaka bazlı gruplama
                if (!map.has(plaka)) {
                    map.set(plaka, {
                        plaka,
                        proje_adi: s.proje_adi,
                        totalTrips: 0,
                        nonCompliantCount: 0,
                        totalDelayMinutes: 0,
                        trips: [], // Detaylı seyahat listesi
                    });
                }

                const item = map.get(plaka);

                item.trips.push({
                    ...s,
                    teslim_noktasi: d.teslim_noktasi,
                    teslim_varis: d.teslim_varis,
                    teslim_cikis: d.teslim_cikis,
                    rule,
                });

                if (rule.compliant !== null) {
                    item.totalTrips++;
                }

                if (rule.compliant === false) {
                    item.nonCompliantCount++;
                    item.totalDelayMinutes += rule.delay;
                }
            });

            const output = Array.from(map.values()).map((item) => {
                const { score, penalty } = calculateScore(
                    item.totalTrips,
                    item.nonCompliantCount,
                    item.totalDelayMinutes
                );

                return {
                    ...item,
                    violationRate:
                        item.totalTrips > 0
                            ? ((item.nonCompliantCount / item.totalTrips) * 100).toFixed(1)
                            : 0,
                    totalDelay: minToHM(item.totalDelayMinutes),
                    score,
                    penalty,
                };
            });

            setDetailedAnalysis(output.sort((a, b) => b.score - a.score));
        } catch (err) {
            setError(err.message);
        }

        setAnalysisLoading(false);
    }, [startDate, endDate]);


    // --------------------------------------------------------------
    // RENDER
    // --------------------------------------------------------------
    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold", color: "primary.main" }}>
                🚚 Teslimde Bekleme Analizi
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}

            {/* ========================================================= */}
            {/* 1️⃣ GÜNLÜK + AYLIK TABLO (İHLALLİ KAYITLAR) */}
            {/* ========================================================= */}

            <Paper sx={{ p: 3, mb: 4 }} elevation={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    📅 Günlük / Aylık İhlal Detay Tablosu ({rows.length} İhlal Kaydı)
                </Typography>

                <Grid container spacing={3} alignItems="center">
                    <Grid item>
                        <TextField
                            label="Günlük Tarih"
                            type="date"
                            value={date}
                            InputLabelProps={{ shrink: true }}
                            onChange={(e) => {
                                setDate(e.target.value);
                                setDailyMonth("");
                            }}
                            disabled={loading}
                        />
                    </Grid>

                    <Grid item>
                        <TextField
                            label="Ay Seç"
                            type="month"
                            value={dailyMonth}
                            InputLabelProps={{ shrink: true }}
                            onChange={(e) => {
                                setDailyMonth(e.target.value);
                                setDate("");
                            }}
                            disabled={loading}
                        />
                    </Grid>

                    <Grid item>
                        <Tooltip title="Tarih/Ay seçildiğinde otomatik güncellenir.">
                            <span>
                                <Button
                                    variant="contained"
                                    startIcon={<SearchIcon />}
                                    onClick={fetchDaily}
                                    disabled={loading}
                                >
                                    {loading ? "Yükleniyor..." : "Yenile"}
                                </Button>
                            </span>
                        </Tooltip>
                    </Grid>

                    <Grid item>
                        <Button
                            variant="outlined"
                            color="success"
                            startIcon={<FileDownloadIcon />}
                            disabled={!rows.length || loading}
                            onClick={() => exportExcel(rows)}
                        >
                            İhlalli Kayıtları Excel İndir ({rows.length})
                        </Button>
                    </Grid>
                </Grid>

                {/* Yükleme Durumu ve Progress Mesajı */}
                {loading && (
                    <Box sx={{ mt: 2, p: 1, backgroundColor: theme.palette.action.hover, borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <CircularProgress size={20} sx={{ mr: 2 }} />
                            <Typography variant="body2" color="textSecondary">
                                {progressMessage}
                            </Typography>
                        </Box>

                        {/* Progress Bar */}
                        <LinearProgress variant="determinate" value={progressValue} sx={{ height: 8, borderRadius: 4 }} />

                    </Box>
                )}

                {/* Günlük Tablo */}
                <TableContainer sx={{ mt: 3, maxHeight: "60vh" }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Sefer</TableCell>
                                <TableCell>Plaka</TableCell>
                                <TableCell>Proje</TableCell>
                                <TableCell>Teslim Noktası</TableCell>
                                <TableCell>Varış</TableCell>
                                <TableCell>Çıkış</TableCell>
                                <TableCell>Kural</TableCell>
                                <TableCell>Bekleme</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell align="center" colSpan={8}>
                                        {/* Progress bilgisi yukarıda gösterildiği için burada boş bırakılabilir. */}
                                    </TableCell>
                                </TableRow>
                            ) : rows.length > 0 ? (
                                rows.map((r, i) => (
                                    <TableRow
                                        key={i}
                                        sx={{
                                            backgroundColor:
                                                r.rule.compliant === false
                                                    ? theme.palette.error.main + "14"
                                                    : r.rule.compliant === null
                                                        ? theme.palette.warning.main + "14"
                                                        : "inherit",
                                        }}
                                    >
                                        <TableCell>{r.sefer_no}</TableCell>
                                        <TableCell>{r.plaka}</TableCell>
                                        <TableCell>{r.proje_adi}</TableCell>
                                        <TableCell>{r.teslim_noktasi}</TableCell>
                                        <TableCell>{fmt(r.teslim_varis)}</TableCell>
                                        <TableCell>{fmt(r.teslim_cikis)}</TableCell>
                                        <TableCell>
                                            {r.rule.compliant === false && <CloseIcon color="error" fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />}
                                            {r.rule.compliant === null && <ErrorOutlineIcon color="warning" fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />}
                                            {r.rule.appliedRule}
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: r.rule.delay > 0 ? 'bold' : 'normal' }}>
                                            {minToHM(r.rule.delay)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell align="center" colSpan={8} sx={{ py: 2 }}>
                                        <Alert severity="info" variant="outlined">
                                            Seçili tarih/ay aralığında kural ihlalli veya eksik veri içeren kayıt bulunamadı.
                                        </Alert>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* ========================================================= */}
            {/* 2️⃣ TARİH ARALIĞI ANALİZİ (Giriş) */}
            {/* ========================================================= */}

            <Paper sx={{ p: 3, mb: 4 }} elevation={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    📊 Tarih Aralığı Analizi (Performans Puanı)
                </Typography>

                <Grid container spacing={3} alignItems="center">
                    <Grid item>
                        <TextField
                            type="date"
                            label="Başlangıç"
                            value={startDate}
                            InputLabelProps={{ shrink: true }}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </Grid>

                    <Grid item>
                        <TextField
                            type="date"
                            label="Bitiş"
                            value={endDate}
                            InputLabelProps={{ shrink: true }}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </Grid>

                    <Grid item>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<SearchIcon />}
                            disabled={analysisLoading}
                            onClick={runAnalysis}
                        >
                            {analysisLoading ? "Analiz Ediliyor..." : "Analiz Et"}
                        </Button>
                    </Grid>
                </Grid>

                {analysisLoading && (
                    <Box sx={{ textAlign: "center", mt: 2 }}>
                        <CircularProgress size={24} />
                        <Typography variant="body2" color="textSecondary">
                            Detaylı analiz verileri çekiliyor...
                        </Typography>
                    </Box>
                )}
            </Paper>

            {/* ========================================================= */}
            {/* 3️⃣ ANALİZ TABLOLARI (Sonuç) */}
            {/* ========================================================= */}

            {detailedAnalysis.length > 0 && (
                <Paper sx={{ p: 3 }} elevation={6}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        📄 Plaka Bazlı Sonuçlar ({detailedAnalysis.length} Plaka - 10.0 Üzerinden Performans Puanı)
                    </Typography>

                    <TableContainer sx={{ maxHeight: 600 }}>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell />
                                    <TableCell>Plaka</TableCell>
                                    <TableCell>Proje</TableCell>
                                    <TableCell align="right">Toplam Sefer</TableCell>
                                    <TableCell align="right">İhlal Sayısı</TableCell>
                                    <TableCell align="right">İhlal Oranı</TableCell>
                                    <TableCell align="right">Toplam Gecikme</TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {detailedAnalysis.map((row) => (
                                    <DetailedRow key={row.plaka} row={row} />
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}
        </Container>
    );
}
