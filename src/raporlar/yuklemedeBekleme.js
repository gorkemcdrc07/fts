// ======================================================
// CLEANFETCHER — Yüklemede Bekleme Raporu (Modernize Edilmiş Versiyon)
// ======================================================

import React, { useCallback, useEffect, useState, useMemo } from "react";
// Supabase istemcinizi doğru yoldan import ettiğiniz varsayılmıştır.
import { supabase } from "../supabaseClient";

import dayjs from "dayjs";
import "dayjs/locale/tr";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import {
    Container,
    Typography,
    Paper,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Button,
    CircularProgress,
    InputAdornment,
    Collapse,
    IconButton,
    useTheme,
    Divider,
    Grid,
    Alert,
    Tooltip,
    // Yeni Eklentiler
    Card,
    CardContent,
    Tabs,
    Tab,
} from "@mui/material";

// Material UI Icons
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DateRangeIcon from "@mui/icons-material/DateRange";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SpeedIcon from '@mui/icons-material/Speed';
import StarIcon from '@mui/icons-material/Star';
import VisibilityIcon from '@mui/icons-material/Visibility';
// Yeni Analitik İkonlar
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp'; // Yeni

// ======================================================
// Sabitler ve Yardımcı Fonksiyonlar (Aynı kaldı)
// ======================================================
const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";
const MINIMUM_WAIT_TIME_MINUTES = 240;


// ... (parseDT, fmtDateTR, minToHM, diffMinutes fonksiyonları aynı)

const parseDT = (v) => {
    const d = dayjs(v);
    return d.isValid() ? d : null;
};

const fmtDateTR = (v) => {
    const d = parseDT(v);
    return d ? d.format("DD.MM.YYYY HH:mm") : "—";
};

const minToHM = (m) => {
    const mm = Math.max(0, Math.round(m || 0));
    const h = Math.floor(mm / 60);
    const r = mm % 60;
    if (h && r) return `${h} sa ${r} dk`;
    if (h) return `${h} sa`;
    if (r) return `${r} dk`;
    return "0 dk";
};

const diffMinutes = (start, end) => {
    const s = parseDT(start);
    const e = parseDT(end);
    if (!s || !e) return null;
    return Math.max(0, e.diff(s, "minute"));
};

// ======================================================
// YENİ BİLEŞEN: KPI GÖSTERİM KARTI
// ======================================================
const KPICard = ({ title, value, icon: Icon, color, subtitle }) => (
    <Card elevation={6} sx={{ borderLeft: `5px solid ${color}`, height: '100%', borderRadius: 2 }}>
        <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    {title}
                </Typography>
                <Icon sx={{ color, fontSize: 36 }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {value}
            </Typography>
            {subtitle && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {subtitle}
                </Typography>
            )}
        </CardContent>
    </Card>
);

// ======================================================
// YENİ/EK BİLEŞEN: TEK GÜNLÜK İHLAL SATIRI (Aynı kaldı)
// ======================================================
function PlateRow({ p, idx }) {
    const theme = useTheme();

    return (
        <TableRow
            key={p.plaka}
            sx={{
                bgcolor: idx % 2 === 0 ? theme.palette.action.hover : 'inherit'
            }}>
            <TableCell></TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>{p.plaka}</TableCell>
            <TableCell>{p.projeler}</TableCell>
            <TableCell align="right" sx={{ color: theme.palette.error.dark }}>{p.ihlalliSefer}</TableCell>
            <TableCell align="right">{minToHM(p.toplamIhlalSuresi)}</TableCell>
        </TableRow>
    );
}

// ======================================================
// YENİ/EK BİLEŞEN: PLAKA PERFORMANS SATIRI (Aynı kaldı)
// ======================================================
function PlatePerformanceRow({ p, idx }) {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    const isViolation = p.ihlalliSefer > 0;

    const getPerfColor = (score) => {
        if (score >= 8.5) return theme.palette.success.dark;
        if (score >= 6) return theme.palette.warning.dark;
        return theme.palette.error.dark;
    };

    const SeferDetailTable = () => {
        const seferler = p.tumSeferler || [];

        if (seferler.length === 0) {
            return (
                <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5', borderTop: `1px solid ${theme.palette.divider}` }}>
                    <Alert severity="warning" size="small">Bu plakaya ait seçilen tarih aralığında detaylı sefer verisi bulunamadı.</Alert>
                </Box>
            );
        }

        return (
            <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5', borderTop: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold", color: theme.palette.text.primary }}>
                    {p.plaka} Plakasına Ait Tüm Seferler ({seferler.length} Adet)
                </Typography>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: theme.palette.action.selected }}>
                            <TableCell sx={{ fontWeight: "bold", py: 0.5 }}>Sefer No</TableCell>
                            <TableCell sx={{ fontWeight: "bold", py: 0.5 }}>Proje</TableCell>
                            <TableCell sx={{ fontWeight: "bold", py: 0.5 }}>Şoför</TableCell>
                            <TableCell sx={{ fontWeight: "bold", py: 0.5 }}>İlk Varış</TableCell>
                            <TableCell sx={{ fontWeight: "bold", py: 0.5 }}>Son Çıkış</TableCell>
                            <TableCell sx={{ fontWeight: "bold", py: 0.5 }}>Toplam Bekleme</TableCell>
                            <TableCell sx={{ fontWeight: "bold", py: 0.5 }}>Durum</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {seferler.map((s, i) => {
                            const isViol = s.isViolation;
                            return (
                                <TableRow key={i} hover sx={{ bgcolor: isViol ? 'rgba(255, 107, 107, 0.1)' : 'inherit' }}>
                                    <TableCell>{s.sefer_no}</TableCell>
                                    <TableCell>{s.proje_adi}</TableCell>
                                    <TableCell>{s.surucu_ad_soyad}</TableCell>
                                    <TableCell>{fmtDateTR(s.ilk_yukleme_varis)}</TableCell>
                                    <TableCell>{fmtDateTR(s.son_yukleme_cikis)}</TableCell>
                                    <TableCell sx={{ fontWeight: isViol ? 'bold' : 'normal', color: isViol ? theme.palette.error.main : theme.palette.text.secondary }}>
                                        {minToHM(s.total_wait_minutes)}
                                    </TableCell>
                                    <TableCell>
                                        <span style={{
                                            color: isViol ? theme.palette.error.dark : theme.palette.success.dark,
                                            fontWeight: 'bold'
                                        }}>
                                            {isViol ? 'İhlal (≥4sa)' : 'Normal'}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Box>
        );
    };

    return (
        <>
            <TableRow
                sx={{
                    '& > *': { borderBottom: 'unset' },
                    bgcolor: isViolation ? theme.palette.error.light + '1a' : (idx % 2 === 0 ? theme.palette.action.hover : 'inherit'),
                }}
            >
                <TableCell width="1%">
                    <Tooltip title={open ? "Detayları Gizle" : "Tüm Sefer Detaylarını Göster"}>
                        <IconButton size="small" onClick={() => setOpen(!open)} color="primary">
                            {open ? <ExpandLessIcon /> : <VisibilityIcon />}
                        </IconButton>
                    </Tooltip>
                </TableCell>

                <TableCell sx={{ fontWeight: "bold" }}>{p.plaka}</TableCell>
                <TableCell>{p.projeler}</TableCell>

                <TableCell align="right">{p.toplamSefer}</TableCell>
                <TableCell align="right" sx={{ color: isViolation ? theme.palette.error.dark : 'inherit' }}>{p.ihlalliSefer}</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>{p.ihlalOrani}</TableCell>
                <TableCell align="right">{minToHM(p.toplamIhlalSuresi)}</TableCell>

                <TableCell align="right" sx={{ color: theme.palette.error.main, fontWeight: "bold" }}>{p.ceza}</TableCell>
                <TableCell align="right" sx={{ color: getPerfColor(parseFloat(p.performans)), fontWeight: "bold", fontSize: '1.1em' }}>
                    <StarIcon sx={{ fontSize: '1em', verticalAlign: 'middle', mr: 0.5 }} />{p.performans}
                </TableCell>
            </TableRow>

            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <SeferDetailTable />
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}


// ======================================================
// ANA KOMPONENT
// ======================================================
export default function CleanFetcher() {
    const [dailyViolationRows, setDailyViolationRows] = useState([]);
    const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));

    const [performanceData, setPerformanceData] = useState([]);
    const [startDate, setStartDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
    const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));

    const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
    const [selectedDailyMonth, setSelectedDailyMonth] = useState(dayjs().format("YYYY-MM"));



    const [loadingDaily, setLoadingDaily] = useState(false);
    const [loadingRange, setLoadingRange] = useState(false);

    // YENİ EKLEME: Sekme Kontrolü
    const [tabValue, setTabValue] = useState(0);
    const theme = useTheme();

    const handleMonthChange = (month) => {
        setSelectedMonth(month);

        const start = dayjs(month).startOf("month").format("YYYY-MM-DD");
        const end = dayjs(month).endOf("month").format("YYYY-MM-DD");

        setStartDate(start);
        setEndDate(end);
    };
    const handleDailyMonthChange = (month) => {
        setSelectedDailyMonth(month);

        // 1) Ayın ilk gününü otomatik seç
        const firstDay = dayjs(month).startOf("month").format("YYYY-MM-DD");
        setSelectedDate(firstDay);

        // 2) Otomatik ihlal analizini çalıştır
        // Küçük bir timeout atıyoruz ki state güncellensin sonra fetch çalışsın
        setTimeout(() => {
            fetchDailyViolations("month");
        }, 50);
    };



    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    // ======================================================
    // TEK GÜNLÜK İHLAL VERİSİ ÇEKME (Aynı kaldı)
    // ======================================================

    const monthStart = dayjs(selectedDailyMonth).startOf("month").toISOString();
    const monthEnd = dayjs(selectedDailyMonth).endOf("month").toISOString();

    const fetchDailyViolations = useCallback(async (mode = "day") => {
        setLoadingDaily(true);
        setDailyViolationRows([]);

        let start, end;

        if (mode === "day") {
            // 🔥 GÜN MODU
            start = dayjs(selectedDate).startOf("day").toISOString();
            end = dayjs(selectedDate).endOf("day").toISOString();
        } else {
            // 🔥 AY MODU
            start = dayjs(selectedDailyMonth).startOf("month").toISOString();
            end = dayjs(selectedDailyMonth).endOf("month").toISOString();
        }

        try {
            const { data: details, error: e1 } = await supabase
                .from(DETAIL_TABLE)
                .select(`sefer_no, yukleme_noktasi, yukleme_varis, yukleme_cikis`)
                .filter("yukleme_varis::timestamp", "gte", start)
                .filter("yukleme_varis::timestamp", "lte", end);
            if (e1) throw e1;
            if (!details?.length) {
                setDailyViolationRows([]);
                setLoadingDaily(false);
                return;
            }

            const seferNos = [...new Set(details.map(x => x.sefer_no))];

            const { data: summary, error: e2 } = await supabase
                .from(SUMMARY_TABLE)
                .select(`sefer_no, plaka, treyler, surucu_ad_soyad, sefer_tarihi, yukleme_ili, yukleme_ilcesi, musteri_adi, yukleme_noktasi, proje_adi`)
                .in("sefer_no", seferNos);

            if (e2) throw e2;

            const violationRows = [];

            summary.forEach((summaryRow) => {
                const group = details.filter(d => d.sefer_no === summaryRow.sefer_no);

                let firstArrival = null;
                let lastLeave = null;

                group.forEach(rec => {
                    const v = parseDT(rec.yukleme_varis);
                    const c = parseDT(rec.yukleme_cikis);
                    if (v && (!firstArrival || v.isBefore(firstArrival))) firstArrival = v;
                    if (c && (!lastLeave || c.isAfter(lastLeave))) lastLeave = c;
                });

                let total = null;
                if (firstArrival && lastLeave) total = diffMinutes(firstArrival, lastLeave);

                if (total >= MINIMUM_WAIT_TIME_MINUTES) {
                    violationRows.push({
                        ...summaryRow,
                        proje_adlari_birlesik: summaryRow.proje_adi,
                        ilk_yukleme_varis: firstArrival?.toISOString(),
                        son_yukleme_cikis: lastLeave?.toISOString(),
                        toplam_bekleme_dk: total
                    });
                }
            });

            setDailyViolationRows(violationRows);
        } catch (err) {
            console.error("Daily fetch error:", err);
        }

        setLoadingDaily(false);
    }, [selectedDate]);

    useEffect(() => {
        // İlk yüklemede sadece günlük veriyi çekmesi için bu hook bırakıldı
        // Ancak sekmeli yapıya geçildiği için artık sadece ilgili sekmeye tıklandığında veya tarih değiştiğinde çalışması daha mantıklı.
        // Şimdilik fetchDailyViolations'ı kaldırıyorum ki sekmeyi manuel kontrol etsin.
    }, [selectedDate]);


    // ======================================================
    // TARİH ARALIĞI PERFORMANS VERİSİ ÇEKME (Aynı kaldı)
    // ======================================================
    const fetchRangePerformance = useCallback(async () => {
        // ... (Mevcut fetchRangePerformance fonksiyon kodu aynı)
        setLoadingRange(true);
        setPerformanceData([]);

        const dayStart = dayjs(startDate).startOf("day").toISOString();
        const dayEnd = dayjs(endDate).endOf("day").toISOString();

        try {
            const { data: details, error: e1 } = await supabase
                .from(DETAIL_TABLE)
                .select(`sefer_no, yukleme_noktasi, yukleme_varis, yukleme_cikis`)
                .filter("yukleme_varis::timestamp", "gte", dayStart)
                .filter("yukleme_varis::timestamp", "lte", dayEnd)

            if (e1) throw e1;
            if (!details?.length) {
                setLoadingRange(false);
                return;
            }

            const seferNos = [...new Set(details.map(x => x.sefer_no))];

            const { data: summary, error: e2 } = await supabase
                .from(SUMMARY_TABLE)
                .select(`sefer_no, plaka, treyler, surucu_ad_soyad, sefer_tarihi, yukleme_ili, yukleme_ilcesi, musteri_adi, yukleme_noktasi, proje_adi`)
                .in("sefer_no", seferNos);

            if (e2) throw e2;

            const allSeferRows = [];

            summary.forEach((summaryRow) => {
                const group = details.filter(d => d.sefer_no === summaryRow.sefer_no);

                let firstArrival = null;
                let lastLeave = null;

                group.forEach(rec => {
                    const v = parseDT(rec.yukleme_varis);
                    const c = parseDT(rec.yukleme_cikis);
                    if (v && (!firstArrival || v.isBefore(firstArrival))) firstArrival = v;
                    if (c && (!lastLeave || c.isAfter(lastLeave))) lastLeave = c;
                });

                let total = null;
                if (firstArrival && lastLeave) total = diffMinutes(firstArrival, lastLeave);

                allSeferRows.push({
                    ...summaryRow,
                    isViolation: total >= MINIMUM_WAIT_TIME_MINUTES,
                    total_wait_minutes: total || 0,
                    proje_adlari_birlesik: summaryRow.proje_adi,
                    ilk_yukleme_varis: firstArrival?.toISOString(),
                    son_yukleme_cikis: lastLeave?.toISOString(),
                });
            });

            const plakaMap = {};

            allSeferRows.forEach(r => {
                const plaka = r.plaka || "Tanımsız";

                if (!plakaMap[plaka]) {
                    plakaMap[plaka] = {
                        plaka,
                        projeler: new Set(),
                        toplamSefer: 0,
                        ihlalliSefer: 0,
                        toplamIhlalSuresi: 0,
                        tumSeferler: [],
                    };
                }

                const obj = plakaMap[plaka];
                obj.toplamSefer += 1;
                obj.projeler.add(r.proje_adlari_birlesik);
                obj.tumSeferler.push(r);

                if (r.isViolation) {
                    obj.ihlalliSefer += 1;
                    obj.toplamIhlalSuresi += r.total_wait_minutes;
                }
            });

            const aggregatedList = Object.values(plakaMap).map(p => ({
                ...p,
                projeler: [...p.projeler].join(", "),
                ihlalOrani: p.toplamSefer ? ((p.ihlalliSefer / p.toplamSefer) * 100) : 0
            }));

            const maxIhlalSure = Math.max(...aggregatedList.map(x => x.toplamIhlalSuresi), 1);
            const maxIhlalOrani = Math.max(...aggregatedList.map(x => x.ihlalOrani), 0.1);

            const scores = aggregatedList.map(item => {
                const cezaPuanı = (
                    (item.toplamIhlalSuresi / maxIhlalSure) * 5 +
                    (item.ihlalOrani / maxIhlalOrani) * 5
                );

                const finalCezaPuanı = Math.min(10, cezaPuanı).toFixed(1);
                const perfPuanı = (10 - finalCezaPuanı).toFixed(1);

                return {
                    ...item,
                    ihlalOrani: item.ihlalOrani.toFixed(1) + "%",
                    ceza: finalCezaPuanı,
                    performans: perfPuanı
                };
            }).sort((a, b) => parseFloat(b.performans) - parseFloat(a.performans));

            setPerformanceData(scores);

        } catch (err) {
            console.error("Range fetch error:", err);
        }

        setLoadingRange(false);
    }, [startDate, endDate]);


    // ======================================================
    // YENİ EKLEME: Analiz Verileri (useMemo)
    // ======================================================

    // Tek Günlük İhlal Analizi (Görünüm ve KPI Hesaplaması için temel veri)
    const dailyPlateAnalysis = useMemo(() => {
        const plakaMap = {};

        dailyViolationRows.forEach(r => {
            const plaka = r.plaka || "Tanımsız";

            if (!plakaMap[plaka]) {
                plakaMap[plaka] = {
                    plaka,
                    projeler: new Set(),
                    ihlalliSefer: 0,
                    toplamIhlalSuresi: 0,
                    detaylar: []
                };
            }

            const obj = plakaMap[plaka];

            obj.projeler.add(r.proje_adi);
            obj.ihlalliSefer += 1;
            obj.toplamIhlalSuresi += r.toplam_bekleme_dk;

            obj.detaylar.push({
                sefer_no: r.sefer_no,
                plaka: r.plaka,
                sofor: r.surucu_ad_soyad,
                proje: r.proje_adi,
                yukleme_noktasi: r.yukleme_noktasi,
                varis: r.ilk_yukleme_varis,
                cikis: r.son_yukleme_cikis,
                sure: r.toplam_bekleme_dk
            });
        });

        return Object.values(plakaMap).map(p => ({
            ...p,
            projeler: [...p.projeler].join(", "),
        }));
    }, [dailyViolationRows]);

    // YENİ EKLEME: Tek Günlük KPI Hesaplamaları
    const dailyKpis = useMemo(() => {
        const totalViolations = dailyViolationRows.length;
        const totalViolationTime = dailyViolationRows.reduce((sum, row) => sum + row.toplam_bekleme_dk, 0);
        const avgViolationTime = totalViolations > 0 ? totalViolationTime / totalViolations : 0;

        return {
            totalViolations,
            totalViolationTime: minToHM(totalViolationTime),
            avgViolationTime: minToHM(avgViolationTime),
            uniquePlates: new Set(dailyViolationRows.map(r => r.plaka)).size
        };
    }, [dailyViolationRows]);


    // YENİ EKLEME: Tarih Aralığı KPI Hesaplamaları
    const rangeKpis = useMemo(() => {
        const totalPlates = performanceData.length;
        const avgPerformance = performanceData.reduce((sum, p) => sum + parseFloat(p.performans), 0) / (totalPlates || 1);
        const totalViolationTime = performanceData.reduce((sum, p) => sum + p.toplamIhlalSuresi, 0);

        return {
            totalPlates,
            avgPerformance: avgPerformance.toFixed(1),
            totalViolationTime: minToHM(totalViolationTime),
            totalViolations: performanceData.reduce((sum, p) => sum + p.ihlalliSefer, 0),
        };
    }, [performanceData]);


    // ======================================================
    // EXCEL EXPORT FONKSİYONLARI (Başlıklar güncel haliyle korundu)
    // ======================================================
    const exportDailyViolationExcel = async () => {
        if (!dailyPlateAnalysis.length) return;

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Gunluk Ihlal Analizi");

        const data = dailyPlateAnalysis.flatMap(p =>
            p.detaylar.map(d => ({
                "sefer no": d.sefer_no,
                "plaka": d.plaka,
                "şoför": d.sofor,
                "proje": d.proje,
                "yükleme noktası": d.yukleme_noktasi,
                "varış": fmtDateTR(d.varis),
                "çıkış": fmtDateTR(d.cikis),
                "bekleme süresi": minToHM(d.sure),
                "Bekleme Süresi (DK)": d.sure,
            }))
        );

        ws.columns = [
            { header: "SEFER NO", key: "sefer no", width: 15 },
            { header: "PLAKA", key: "plaka", width: 12 },
            { header: "ŞOFÖR", key: "şoför", width: 25 },
            { header: "PROJE", key: "proje", width: 20 },
            { header: "YÜKLEME NOKTASI", key: "yükleme noktası", width: 30 },
            { header: "VARIŞ ZAMANI", key: "varış", width: 20 },
            { header: "ÇIKIŞ ZAMANI", key: "çıkış", width: 20 },
            { header: "BEKLEME SÜRESİ", key: "bekleme süresi", width: 20 },
            { header: "BEKLEME SÜRESİ (DK)", key: "Bekleme Süresi (DK)", width: 10, hidden: true },
        ];

        ws.addRows(data);

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf]), `gunluk_ihlalli_bekleme_${selectedDate}.xlsx`);
    };

    const exportPerformanceExcel = async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Plaka Performans");

        ws.columns = [
            { header: "Plaka", key: "plaka", width: 12 },
            { header: "Projeler", key: "projeler", width: 25 },
            { header: "Toplam Sefer", key: "toplamSefer", width: 15 },
            { header: "İhlalli Sefer", key: "ihlalliSefer", width: 15 },
            { header: "İhlal Oranı", key: "ihlalOrani", width: 15 },
            { header: "Toplam İhlal Süresi (dk)", key: "toplamIhlalSuresi", width: 25 },
            { header: "Ceza Puanı (10)", key: "ceza", width: 15 },
            { header: "Performans Puanı (10)", key: "performans", width: 15 }
        ];

        performanceData.forEach(r => ws.addRow({
            ...r,
            toplamIhlalSuresi: r.toplamIhlalSuresi
        }));

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf]), `plaka_performans_${startDate}_${endDate}.xlsx`);
    };

    // ======================================================
    // RENDER (Sekmeli ve KPI Kartlı Görünüm)
    // ======================================================
    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Typography variant="h4" sx={{ mb: 1, fontWeight: "bold", color: theme.palette.primary.main }}>
                🚀 Yüklemede Bekleme Performans Yönetimi
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                Filo bekleme sürelerini analiz edin ve performans puanlarını takip edin. (İhlal sınırı: **4 saat**)
            </Typography>

            {/* YENİ EKLEME: Sekmeli Navigasyon */}
            <Paper elevation={4} sx={{ mb: 4, borderRadius: 2 }}>
                <Tabs value={tabValue} onChange={handleTabChange} indicatorColor="primary" textColor="primary" centered>
                    <Tab label="Anlık İhlal Analizi (Tek Gün)" icon={<WarningIcon />} iconPosition="start" />
                    <Tab label="Kümülatif Plaka Performansı (Aralık)" icon={<SpeedIcon />} iconPosition="start" />
                </Tabs>
            </Paper>

            {/* İçerik Gösterimi - TAB 0: Tek Günlük İhlal */}
            {tabValue === 0 && (
                <Box>


                    {/* ---------------- AY FİLTRESİ (Sadece veri aralığı için) ---------------- */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
                            📅 Ay Bazlı Veri Aralığı
                        </Typography>

                        <TextField
                            fullWidth
                            type="month"
                            label="Ay Seçin"
                            value={selectedDailyMonth}
                            onChange={(e) => handleDailyMonthChange(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* ---------------- GÜNLÜK ANALİZ TARİHİ ---------------- */}
                    <Grid container spacing={3} alignItems="center" sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={8}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Analiz Edilecek Gün"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <DateRangeIcon color="primary" />
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={4}>
                            <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                size="large"
                                startIcon={loadingDaily ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                                onClick={() => fetchDailyViolations("day")}
                                disabled={loadingDaily}
                                sx={{ height: '56px' }}
                            >
                                {loadingDaily ? "Veriler Yükleniyor..." : "İhlalleri Getir"}
                            </Button>
                        </Grid>
                    </Grid>

                    {/* YENİ EKLEME: Tek Günlük KPI KARTLARI */}
                    {!loadingDaily && dailyPlateAnalysis.length > 0 && (
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid item xs={12} md={3}>
                                <KPICard
                                    title="Toplam İhlalli Sefer"
                                    value={dailyKpis.totalViolations}
                                    icon={WarningIcon}
                                    color={theme.palette.error.main}
                                    subtitle={`Toplam ${dailyKpis.uniquePlates} plakada gerçekleşti.`}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <KPICard
                                    title="Toplam İhlal Süresi"
                                    value={dailyKpis.totalViolationTime}
                                    icon={AccessTimeIcon}
                                    color={theme.palette.warning.main}
                                    subtitle="Seçili günde kaybedilen toplam süre."
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <KPICard
                                    title="Ortalama Bekleme (İhlalli)"
                                    value={dailyKpis.avgViolationTime}
                                    icon={TrendingUpIcon}
                                    color={theme.palette.info.main}
                                    subtitle="İhlalli seferlerin ortalama süresi."
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <KPICard
                                    title="İhlalli Plaka Çeşidi"
                                    value={dailyKpis.uniquePlates}
                                    icon={DirectionsCarIcon}
                                    color={theme.palette.primary.main}
                                    subtitle={`Toplam ${dailyKpis.totalViolations} seferde kullanıldı.`}
                                />
                            </Grid>
                        </Grid>
                    )}

                    {loadingDaily && <Box sx={{ p: 5, textAlign: "center" }}><CircularProgress /><Typography sx={{ mt: 1 }}>Günlük veriler analiz ediliyor...</Typography></Box>}

                    {!loadingDaily && dailyViolationRows.length === 0 && (
                        <Alert severity="success" sx={{ mt: 3, p: 2 }}>
                            **{dayjs(selectedDate).format("DD.MM.YYYY")}** tarihinde **4 saat üzeri** bekleme ihlali tespit edilmemiştir.
                        </Alert>
                    )}

                    {!loadingDaily && dailyPlateAnalysis.length > 0 && (
                        <Paper elevation={1} sx={{ mt: 3, p: 2, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                                    İhlal Dağılımı (Plaka Bazlı)
                                </Typography>
                                <Button
                                    startIcon={<FileDownloadIcon />}
                                    variant="outlined"
                                    color="error"
                                    onClick={exportDailyViolationExcel}
                                >
                                    Tüm Sefer Detaylarını Excel'e Aktar
                                </Button>
                            </Box>
                            <TableContainer sx={{ maxHeight: 400 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: theme.palette.error.light }}>
                                            <TableCell></TableCell>
                                            <TableCell sx={{ fontWeight: "bold", color: theme.palette.getContrastText(theme.palette.error.light) }}>Plaka</TableCell>
                                            <TableCell sx={{ fontWeight: "bold", color: theme.palette.getContrastText(theme.palette.error.light) }}>Projeler</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: "bold", color: theme.palette.getContrastText(theme.palette.error.light) }}>İhlalli Sefer Adedi</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: "bold", color: theme.palette.getContrastText(theme.palette.error.light) }}>Toplam İhlal Süresi</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {dailyPlateAnalysis.map((p, idx) => (
                                            <PlateRow p={p} idx={idx} key={p.plaka} />
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}
                </Box>
            )}

            {/* İçerik Gösterimi - TAB 1: Tarih Aralığı Performans */}
            {tabValue === 1 && (
                <Box>
                    <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>

                        <Grid item xs={12} sm={3}>
                            <TextField
                                fullWidth
                                type="month"
                                label="Ay Seçin"
                                value={selectedMonth}
                                onChange={(e) => handleMonthChange(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={3}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Başlangıç Tarihi"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={3}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Bitiş Tarihi"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={3}>
                            <Button
                                fullWidth
                                variant="contained"
                                color="success"
                                size="large"
                                startIcon={<SearchIcon />}
                                onClick={fetchRangePerformance}
                                disabled={loadingRange}
                                sx={{ height: '56px' }}
                            >
                                Performansı Getir
                            </Button>
                        </Grid>

                    </Grid>
                    {/* YENİ EKLEME: Performans KPI KARTLARI */}
                    {!loadingRange && performanceData.length > 0 && (
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid item xs={12} md={3}>
                                <KPICard
                                    title="Ortalama Performans Puanı"
                                    value={rangeKpis.avgPerformance}
                                    icon={StarIcon}
                                    color={rangeKpis.avgPerformance >= 8 ? theme.palette.success.main : theme.palette.warning.dark}
                                    subtitle={`Toplam ${rangeKpis.totalPlates} plakanın ortalaması.`}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <KPICard
                                    title="İhlalli Sefer Sayısı"
                                    value={rangeKpis.totalViolations}
                                    icon={WarningIcon}
                                    color={theme.palette.error.main}
                                    subtitle="Seçilen aralıktaki toplam ihlal sayısı."
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <KPICard
                                    title="Toplam İhlal Süresi"
                                    value={rangeKpis.totalViolationTime}
                                    icon={AccessTimeIcon}
                                    color={theme.palette.warning.main}
                                    subtitle="Aralık boyunca kaybedilen kümülatif süre."
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <KPICard
                                    title="Analiz Edilen Plaka Sayısı"
                                    value={rangeKpis.totalPlates}
                                    icon={DirectionsCarIcon}
                                    color={theme.palette.primary.main}
                                    subtitle="Sisteme giriş/çıkış yapan farklı plaka adedi."
                                />
                            </Grid>
                        </Grid>
                    )}


                    {loadingRange && <Box sx={{ p: 5, textAlign: "center" }}><CircularProgress /><Typography sx={{ mt: 1 }}>Performans verileri analiz ediliyor...</Typography></Box>}

                    {!loadingRange && performanceData.length === 0 && (
                        <Alert severity="info" sx={{ mt: 3, p: 2 }}>
                            Seçilen aralıkta yükleme kaydı olan sefer bulunamadı veya analiz için yeterli veri yok.
                        </Alert>
                    )}

                    {!loadingRange && performanceData.length > 0 && (
                        <Paper elevation={1} sx={{ mt: 3, p: 2, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                                    Plaka Performans Sıralaması (İhlal Oranına Göre)
                                </Typography>
                                <Button
                                    startIcon={<FileDownloadIcon />}
                                    variant="outlined"
                                    color="success"
                                    onClick={exportPerformanceExcel}
                                >
                                    Performans Özetini Excel'e Aktar
                                </Button>
                            </Box>
                            <TableContainer sx={{ maxHeight: 550 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: theme.palette.success.light }}>
                                            <TableCell sx={{ fontWeight: "bold", width: '1%' }}>Detay</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Plaka</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Projeler</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: "bold" }}>Toplam Sefer</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: "bold" }}>İhlalli Sefer</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: "bold" }}>İhlal Oranı</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: "bold" }}>Toplam İhlal Süresi</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: "bold" }}>Ceza Puanı (10)</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: "bold" }}>Performans (10)</TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {performanceData.map((p, idx) => (
                                            <PlatePerformanceRow p={p} idx={idx} key={p.plaka} />
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}
                </Box>
            )}
        </Container>
    );
}
