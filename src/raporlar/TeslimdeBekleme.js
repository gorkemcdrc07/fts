// ===============================================
// TeslimdeBekleme.jsx — NİHAİ SÜRÜM (HATA DÜZELTME: c.sx is not a function)
// ===============================================

import React, { useState, useCallback, useEffect } from "react";
// Supabase (ÖNEMLİ: Kendi projenizdeki yolu güncelleyin)
import { supabase } from "../supabaseClient";

// DayJS ve Eklentiler
import dayjs from "dayjs";
import "dayjs/locale/tr";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import weekOfYear from "dayjs/plugin/weekOfYear";
import updateLocale from 'dayjs/plugin/updateLocale';
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// MUI Bileşenleri
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
    Accordion,
    AccordionSummary,
    AccordionDetails,
    InputAdornment,
    Collapse,
    IconButton,
    useTheme
} from "@mui/material";

// MUI İkonlar
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DateRangeIcon from '@mui/icons-material/DateRange';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';


// DayJS Eklentileri ve Global Ayarlar
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekOfYear);
dayjs.extend(updateLocale);
dayjs.locale('tr');

dayjs.updateLocale('tr', {
    weekStart: 1,
});


// --------------------------------------------------
// SQL TABLO ALANLARI
// --------------------------------------------------
const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";

const SUMMARY_COLS = [
    "id", "sefer_no", "plaka", "treyler", "surucu_ad_soyad", "surucu_tckn",
    "sefer_tarihi", "yukleme_ili", "teslim_ili", "musteri_adi",
    "proje_adi"
].join(",");

const DETAIL_COLS = [
    "sefer_no", "nokta_sirasi", "yukleme_noktasi", "teslim_noktasi",
    "yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis"
].join(",");

// --------------------------------------------------
// YARDIMCI FONKSİYONLAR VE KURAL HESAPLAMA
// --------------------------------------------------

const parseDT = (v) => {
    const d = dayjs(v);
    return d.isValid() ? d : null;
};

const fmt = (v) => {
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

const calcRule = (varis, cikis) => {
    const v = parseDT(varis);
    const c = parseDT(cikis);

    if (!v || !c) return { appliedRule: 'None', compliant: null, delay: 0 };
    if (v.day() === 0) return { appliedRule: 'None', compliant: true, delay: 0 };

    const isSaturday = v.day() === 6;
    const isAfter1700 = v.hour() >= 17;

    if (isSaturday && isAfter1700) {
        const deadline3 = v.clone().add(2, 'day').hour(8).minute(30).startOf('minute');
        if (c.isSameOrBefore(deadline3)) {
            return { appliedRule: 'Rule 3', compliant: true, delay: 0 };
        } else {
            return { appliedRule: 'Rule 3', compliant: false, delay: c.diff(deadline3, "minute") };
        }
    }

    const lower1 = v.clone().hour(8).minute(30).startOf('minute');
    const upper1 = v.clone().hour(12).minute(0).startOf('minute');
    const isApplicable1 = v.isSameOrAfter(lower1) && v.isBefore(upper1);

    if (isApplicable1) {
        const deadline1 = v.clone().hour(17).minute(0).startOf('minute');
        if (c.isSameOrBefore(deadline1)) {
            return { appliedRule: 'Rule 1', compliant: true, delay: 0 };
        } else {
            return { appliedRule: 'Rule 1', compliant: false, delay: c.diff(deadline1, "minute") };
        }
    }

    const lower2 = v.clone().hour(12).minute(0).startOf('minute');
    const isApplicable2 = v.isSameOrAfter(lower2);

    if (isApplicable2) {
        const deadline2 = v.clone().add(1, 'day').hour(12).minute(0).startOf('minute');

        if (c.isSameOrBefore(deadline2)) {
            return { appliedRule: 'Rule 2', compliant: true, delay: 0 };
        } else {
            return { appliedRule: 'Rule 2', compliant: false, delay: c.diff(deadline2, "minute") };
        }
    }

    return { appliedRule: 'None', compliant: true, delay: 0 };
};

// --------------------------------------------------
// PUANLAMA FONKSİYONU
// --------------------------------------------------
const calculateScore = (totalTrips, nonCompliantCount, totalDelayMinutes) => {
    const MAX_VIOLATION_RATE = 50;
    const MAX_DELAY_MINUTES_PER_TRIP = 180;

    if (totalTrips === 0) {
        return { score: 10.0, penalty: 0.0 };
    }

    const violationRate = (nonCompliantCount / totalTrips) * 100;
    const avgDelayPerViolation = nonCompliantCount > 0
        ? totalDelayMinutes / nonCompliantCount
        : 0;

    let penalty = 0;

    // A. İhlal Oranı Cezası (Maksimum 5 Puan Ceza)
    const violationPenalty = Math.min(5, (violationRate / MAX_VIOLATION_RATE) * 5);
    penalty += violationPenalty;

    // B. Gecikme Süresi Cezası (Maksimum 5 Puan Ceza)
    const delayPenalty = Math.min(5, (avgDelayPerViolation / MAX_DELAY_MINUTES_PER_TRIP) * 5);
    penalty += delayPenalty;

    const finalScore = Math.max(0, 10 - penalty);

    return {
        score: parseFloat(finalScore.toFixed(1)),
        penalty: parseFloat(penalty.toFixed(1))
    };
};


// --------------------------------------------------
// EXCEL EXPORT (Aynı kaldı)
// --------------------------------------------------
const exportExcel = async (rows) => {
    if (!rows.length) return;

    const filteredRows = rows.filter(r => {
        const rule = r.rule;
        return rule && rule.compliant === false && rule.delay > 0;
    });

    if (!filteredRows.length) {
        alert("Seçilen tarihte kural ihlali olan kayıt bulunamadı.");
        return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Teslimde Bekleme - İHLAL");

    ws.columns = [
        { header: "Sefer No", key: "sefer_no", width: 15 },
        { header: "Plaka", key: "plaka", width: 12 },
        { header: "Proje", key: "proje_adi", width: 20 },
        { header: "Teslim Noktası", key: "teslim_noktasi", width: 25 },
        { header: "Varış", key: "teslim_varis", width: 20 },
        { header: "Çıkış", key: "teslim_cikis", width: 20 },
        { header: "Uygulanan Kural", key: "rule_name", width: 30 },
        { header: "Kurala Uygun", key: "kural", width: 25 },
        { header: "Şartlı Bekleme (İhlal Süresi)", key: "delay", width: 30 }
    ];

    filteredRows.forEach((r) => {
        const rule = r.rule;
        let ruleName = '';
        let kuralText = 'Hayır';

        if (rule.appliedRule === 'Rule 1') {
            ruleName = 'Kural 1: [08:30 - 12:00) Varış';
        } else if (rule.appliedRule === 'Rule 2') {
            ruleName = 'Kural 2: [12:00 - Sonrası] Varış';
        } else if (rule.appliedRule === 'Rule 3') {
            ruleName = 'Kural 3: [Cmt 17:00 - Sonrası] Varış';
        }

        ws.addRow({
            sefer_no: r.sefer_no,
            plaka: r.plaka,
            proje_adi: r.proje_adi,
            teslim_noktasi: r.teslim_noktasi,
            teslim_varis: fmt(r.teslim_varis),
            teslim_cikis: fmt(r.teslim_cikis),
            rule_name: ruleName,
            kural: kuralText,
            delay: minToHM(rule.delay)
        });
    });

    ws.getRow(1).font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `teslimde_bekleme_IHLAL_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
};


// --------------------------------------------------
// BİLEŞEN: DetailedRow (KOYU TEMA UYUMLU)
// --------------------------------------------------
const DetailedRow = ({ row }) => {
    const [open, setOpen] = useState(false);
    const theme = useTheme();

    const renderCompliance = (r) => {
        const rule = r.rule;
        const color = rule.compliant === false ? 'error.main' : rule.compliant === true ? 'success.main' : 'warning.dark';
        const icon = rule.compliant === false ? <AccessTimeFilledIcon fontSize="small" /> : rule.compliant === true ? <CheckCircleIcon fontSize="small" /> : <ErrorOutlineIcon fontSize="small" />;
        const text = rule.compliant === false ? `GEÇ KALDI (${rule.appliedRule.replace('Rule ', 'K')})` : rule.compliant === true ? `UYGUN (${rule.appliedRule.replace('Rule ', 'K')})` : 'Eksik Veri';

        return (
            <Tooltip title={`Gecikme: ${minToHM(rule.delay)}`}>
                <Box sx={{ color: color, display: "flex", alignItems: "center" }}>
                    {icon}
                    <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 'bold' }}>
                        {text}
                    </Typography>
                </Box>
            </Tooltip>
        );
    };

    const nonCompliantBg = 'rgba(255, 0, 0, 0.08)';
    const headerBg = theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200];
    const detailBg = theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50];


    return (
        <React.Fragment>
            {/* 1. ANA SATIR (Plaka Özeti) */}
            <TableRow hover>
                <TableCell>
                    <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={() => setOpen(!open)}
                        sx={{ color: theme.palette.text.secondary }}
                    >
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{row.plaka}</TableCell>
                <TableCell>{row.proje_adi}</TableCell>
                <TableCell align="right">{row.totalTrips}</TableCell>
                <TableCell align="right" sx={{ color: row.nonCompliantCount > 0 ? 'error.dark' : 'text.primary', fontWeight: 'bold' }}>
                    {row.nonCompliantCount}
                </TableCell>
                <TableCell align="right">{row.violationRate}</TableCell>
                <TableCell align="right" sx={{ color: row.totalDelayMinutes > 0 ? 'error.dark' : 'text.primary', fontWeight: 'bold' }}>{row.totalDelay}</TableCell>
            </TableRow>

            {/* 2. DETAY SATIRI (Sefer Listesi) */}
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        {/* Koyu temada detay arkaplanı grey[900] */}
                        <Box sx={{ margin: 1, p: 2, bgcolor: detailBg, border: `1px solid ${theme.palette.divider}` }}>
                            <Typography variant="h6" gutterBottom component="div" sx={{ fontWeight: 'bold', mb: 2 }}>
                                📑 Sefer Detayları ({row.plaka})
                            </Typography>
                            <Table size="small" aria-label="sefer-detay">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: headerBg }}>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Sefer No</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Sefer Tarihi</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Güzergah</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Teslim Noktası</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Varış / Çıkış</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Kural Durumu</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>İhlal Süresi</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {row.trips?.map((trip) => (
                                        <TableRow key={trip.sefer_no + trip.teslim_noktasi}
                                            sx={{ bgcolor: trip.rule.compliant === false ? nonCompliantBg : 'inherit' }}>
                                            <TableCell component="th" scope="row">
                                                {trip.sefer_no}
                                            </TableCell>
                                            <TableCell>{dayjs(trip.sefer_tarihi).format('DD.MM.YYYY')}</TableCell>
                                            <TableCell>{`${trip.yukleme_ili || '—'} -> ${trip.teslim_ili || '—'}`}</TableCell>
                                            <TableCell>{trip.teslim_noktasi || '—'}</TableCell>
                                            <TableCell>
                                                Varış: {fmt(trip.teslim_varis)} <br />
                                                Çıkış: {fmt(trip.teslim_cikis)}
                                            </TableCell>
                                            <TableCell>
                                                {renderCompliance(trip)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ color: trip.rule.delay > 0 ? 'error.dark' : 'text.primary', fontWeight: trip.rule.delay > 0 ? 'bold' : 'normal' }}>
                                                {minToHM(trip.rule.delay)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!row.trips || row.trips.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={7} sx={{ color: 'text.secondary', textAlign: 'center' }}>
                                                Bu plaka için detaylı sefer kaydı bulunamadı.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </React.Fragment>
    );
};

// --------------------------------------------------
// BİLEŞEN: DetailedAnalysisTable (Aynı kaldı)
// --------------------------------------------------
const DetailedAnalysisTable = ({ data, loading, start, end }) => {
    const theme = useTheme();

    return (
        <Paper
            elevation={8}
            sx={{
                borderRadius: 2,
                overflow: 'hidden',
                mt: 4,
                bgcolor: theme.palette.background.paper
            }}
        >
            <Box sx={{ p: 2, bgcolor: 'primary.dark', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        🚚 Plaka Bazlı Detaylı Bekleme Analizi
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        ({start} - {end}) Aralığı | Tıklayarak sefer detaylarını görebilirsiniz.
                    </Typography>
                </Box>
                <Box>
                    {loading && <CircularProgress size={24} sx={{ color: 'white' }} />}
                </Box>
            </Box>

            <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100] }}>
                            <TableCell sx={{ fontWeight: 'bold' }} width={50} />
                            <TableCell sx={{ fontWeight: 'bold' }}>Plaka</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Proje Adı</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Toplam Sefer</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>İhlalli Sefer</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>İhlal Oranı (%)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: theme.palette.error.main }}>Toplam İhlal Süresi</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {!loading && data.length > 0 ? (
                            data.map((row) => (
                                <DetailedRow key={row.plaka} row={row} />
                            ))
                        ) : !loading && data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    <Box sx={{ p: 2 }}>
                                        <Typography variant="body1">Belirtilen aralıkta ( {start} - {end} ) ihlalli kayıt veya tamamlanmış sefer bulunamadı.</Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : null}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};


// --------------------------------------------------
// BİLEŞEN: ScoreAnalysisTable (HATA DÜZELTİLDİ)
// --------------------------------------------------
const ScoreAnalysisTable = ({ data }) => {
    const theme = useTheme();

    // Sütun tanımları: sx artık sadece nesne/statik stil için kullanılıyor.
    const columns = [
        { header: "Sıra", render: (r, i) => i + 1, width: 60, align: 'right', key: 'rank' },
        { header: "Plaka", render: (r) => r.plaka, width: 100, align: 'left', key: 'plaka' },
        { header: "Proje", render: (r) => r.proje_adi, width: 150, align: 'left', key: 'proje' },
        { header: "Toplam Sefer", render: (r) => r.totalTrips, align: 'right', width: 100, key: 'trips' },
        { header: "İhlal Oranı (%)", render: (r) => `${r.violationRate}%`, align: 'right', width: 120, key: 'rate' },
        { header: "Toplam İhlal Süresi", render: (r) => r.totalDelay, align: 'right', width: 150, key: 'delay' },
        {
            header: "Ceza Puanı (10 Üzerinden)",
            render: (r) => r.penalty,
            align: 'right',
            width: 150,
            // Statik stil nesnesi (TableHead ve TableBody'deki sabit renk)
            sx: { color: theme.palette.error.light },
            key: 'penalty'
        },
        {
            header: "✨ Performans Puanı (10 Üzerinden)",
            render: (r) => r.score,
            align: 'right',
            width: 180,
            key: 'score'
        },
    ];

    // Puana göre dinamik stil fonksiyonu (Sadece TableBody'de kullanılacak)
    const getScoreSx = (row) => ({
        fontWeight: 'bold',
        fontSize: '1.1rem',
        color: row.score >= 8 ? theme.palette.success.main : row.score >= 5 ? theme.palette.warning.main : theme.palette.error.main
    });

    return (
        <Paper elevation={8} sx={{ borderRadius: 2, overflow: 'hidden', mt: 4, bgcolor: theme.palette.background.paper }}>
            <Box sx={{ p: 2, bgcolor: theme.palette.primary.main, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    🏆 Plaka Performans Puanları (İhlal Oranı ve Süreye Göre)
                </Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100] }}>
                            {columns.map((c, i) => (
                                <TableCell
                                    key={c.key || i}
                                    align={c.align || 'left'}
                                    // Sadece nesne/statik stil uygulanıyor
                                    sx={{ fontWeight: 'bold', minWidth: c.width, ...(c.sx || {}) }}>
                                    {c.header}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.length > 0 ? (
                            data.map((row, index) => (
                                <TableRow key={row.plaka} hover>
                                    {columns.map((c, i) => (
                                        <TableCell
                                            key={c.key || i}
                                            align={c.align || 'left'}
                                            // c.key === 'score' ise dinamik stili uygula, aksi takdirde statik stili (c.sx)
                                            sx={c.key === 'score'
                                                ? getScoreSx(row)
                                                : c.sx
                                            }
                                        >
                                            {c.render(row, index)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} align="center">
                                    <Typography variant="body1" sx={{ p: 2 }}>
                                        Puanlanacak veri bulunamadı. Lütfen analiz aralığını kontrol edin.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};


// --------------------------------------------------
// FONKSİYON: Plaka Bazlı Detaylı Analiz Verisi Çekme (PUANLAMA EKLENDİ)
// --------------------------------------------------
const fetchDetailedAnalysis = async (start, end) => {
    if (!start || !end || dayjs(start).isAfter(dayjs(end))) {
        throw new Error("Geçersiz tarih aralığı.");
    }

    const startTime = dayjs(start).startOf('day').toISOString();
    const endTime = dayjs(end).endOf('day').toISOString();

    const { data: detail, error: e1 } = await supabase
        .from(DETAIL_TABLE)
        .select(DETAIL_COLS)
        .gte("teslim_varis", startTime)
        .lte("teslim_varis", endTime);

    if (e1) throw e1;

    const seferNos = [...new Set(detail.map((x) => x.sefer_no))];

    const { data: summary, error: e2 } = await supabase
        .from(SUMMARY_TABLE)
        .select(SUMMARY_COLS)
        .in("sefer_no", seferNos);

    if (e2) throw e2;

    const analysisMap = new Map();

    detail.forEach((d) => {
        const s = summary.find((x) => x.sefer_no === d.sefer_no);
        if (!s || !s.plaka) return;

        const plaka = s.plaka;
        const rule = calcRule(d.teslim_varis, d.teslim_cikis);

        if (!analysisMap.has(plaka)) {
            analysisMap.set(plaka, {
                plaka,
                proje_adi: s.proje_adi || 'Bilinmiyor',
                totalTrips: 0,
                nonCompliantCount: 0,
                totalDelayMinutes: 0,
                trips: []
            });
        }

        const currentData = analysisMap.get(plaka);

        currentData.trips.push({
            ...s,
            teslim_varis: d.teslim_varis,
            teslim_cikis: d.teslim_cikis,
            teslim_noktasi: d.teslim_noktasi,
            rule,
        });

        if (rule.compliant !== null) {
            currentData.totalTrips++;
        }

        if (rule.compliant === false && rule.delay > 0) {
            currentData.nonCompliantCount++;
            currentData.totalDelayMinutes += rule.delay;
        }
    });

    return Array.from(analysisMap.values())
        .map(item => {
            // PUANLAMA VE CEZA HESAPLAMA
            const { score, penalty } = calculateScore(
                item.totalTrips,
                item.nonCompliantCount,
                item.totalDelayMinutes
            );

            return {
                ...item,
                trips: item.trips.sort((a, b) => dayjs(b.sefer_tarihi).valueOf() - dayjs(a.sefer_tarihi).valueOf()),

                totalDelay: minToHM(item.totalDelayMinutes),
                avgDelayPerViolation: item.nonCompliantCount > 0
                    ? minToHM(item.totalDelayMinutes / item.nonCompliantCount)
                    : "0 dk",
                violationRate: item.totalTrips > 0
                    ? ((item.nonCompliantCount / item.totalTrips) * 100).toFixed(1)
                    : 0,

                score: score,
                penalty: penalty,
            };
        })
        .sort((a, b) => b.score - a.score); // Puanı en yüksekten en düşüğe sırala
};


// --------------------------------------------------
// ANA KOMPONENT: TeslimdeBekleme 
// --------------------------------------------------
export default function TeslimdeBekleme() {
    const [rows, setRows] = useState([]);
    const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [dailyMonth, setDailyMonth] = useState(dayjs().format("YYYY-MM"));

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format("YYYY-MM-DD"));
    const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));

    // YENİ EKLENECEK SATIR
    const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
    const [detailedAnalysis, setDetailedAnalysis] = useState([]);
    const [analysisLoading, setAnalysisLoading] = useState(false);

    const theme = useTheme();

    // AY DEĞİŞİMİ — Yeni Fonksiyon
    const handleMonthChange = (month) => {
        setSelectedMonth(month);

        const start = dayjs(month).startOf("month").format("YYYY-MM-DD");
        const end = dayjs(month).endOf("month").format("YYYY-MM-DD");

        setStartDate(start);
        setEndDate(end);

        // Ay seçilince otomatik analiz başlasın
        setTimeout(() => {
            runDetailedAnalysis();
        }, 50);
    };


    const runDetailedAnalysis = useCallback(async () => {
        if (!startDate || !endDate) return;
        setAnalysisLoading(true);
        setError(null);
        try {
            const analysisResult = await fetchDetailedAnalysis(startDate, endDate);
            setDetailedAnalysis(analysisResult);
        } catch (err) {
            console.error("Detaylı analiz çekilirken hata oluştu:", err);
            setError("Detaylı Analiz Hatası: " + (err.message || "Bilinmeyen Hata"));
            setDetailedAnalysis([]);
        }
        setAnalysisLoading(false);
    }, [startDate, endDate]);


    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        setRows([]);

        try {
            let start, end;

            // 📌 AY SEÇİLDİYSE → AYLIK VERİ GETİR
            if (dailyMonth && dailyMonth !== "" && !date) {
                start = dayjs(dailyMonth).startOf("month").toISOString();
                end = dayjs(dailyMonth).endOf("month").toISOString();
            }
            // 📌 GÜN SEÇİLDİYSE → SADECE O GÜNÜ GETİR
            else if (date) {
                start = dayjs(date).startOf("day").toISOString();
                end = dayjs(date).endOf("day").toISOString();
            }
            else {
                setLoading(false);
                return;
            }

            const { data: detail, error: e1 } = await supabase
                .from(DETAIL_TABLE)
                .select(DETAIL_COLS)
                .gte("teslim_varis", start)
                .lte("teslim_varis", end);

            if (e1) throw e1;

            // 📌 Eğer gün seçiliyse → sadece o güne ait kayıtları ayıkla
            const filtered = date
                ? detail.filter(d => dayjs(d.teslim_varis).isSame(date, "day"))
                : detail;

            if (!filtered.length) {
                setRows([]);
                setLoading(false);
                return;
            }

            const seferNos = [...new Set(filtered.map((x) => x.sefer_no))];
            const { data: summary, error: e2 } = await supabase
                .from(SUMMARY_TABLE)
                .select(SUMMARY_COLS)
                .in("sefer_no", seferNos);

            if (e2) throw e2;

            const final = filtered.map((d) => {
                const s = summary.find((x) => x.sefer_no === d.sefer_no);
                if (!s) return null;

                return {
                    ...s,
                    teslim_varis: d.teslim_varis,
                    teslim_cikis: d.teslim_cikis,
                    teslim_noktasi: d.teslim_noktasi,
                    rule: calcRule(d.teslim_varis, d.teslim_cikis),
                };
            }).filter(Boolean);

            setRows(final);
        } catch (err) {
            setError("Veri çekerken hata oluştu: " + err.message);
        }

        setLoading(false);
    }, [date, dailyMonth]);


    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        runDetailedAnalysis();
    }, [runDetailedAnalysis]);

    const columns = [
        { header: "Sefer No", render: (r) => r.sefer_no, width: 100 },
        { header: "Plaka", render: (r) => r.plaka, width: 80 },
        { header: "Proje", render: (r) => r.proje_adi, width: 150 },
        { header: "Teslim Noktası", render: (r) => r.teslim_noktasi, width: 150 },
        { header: "Varış Zamanı", render: (r) => fmt(r.teslim_varis), width: 130 },
        { header: "Çıkış Zamanı", render: (r) => fmt(r.teslim_cikis), width: 130 },

        {
            header: "Kural Uygunluğu",
            width: 280,
            render: (r) => {
                const varisSaati = r.teslim_varis ? parseDT(r.teslim_varis).format('HH:mm') : '—';
                const rule = r.rule;

                const Text = ({ children, color, icon, tooltipTitle }) => (
                    <Tooltip title={tooltipTitle}>
                        <Box sx={{ color: color, display: "flex", alignItems: "center" }}>
                            {icon}
                            <Typography variant="subtitle2" sx={{ ml: 1, fontWeight: 'bold' }}>
                                {children}
                            </Typography>
                        </Box>
                    </Tooltip>
                );

                if (rule.compliant === null)
                    return (<Text color="warning.dark" icon={<ErrorOutlineIcon fontSize="small" />} tooltipTitle="Teslim Varış veya Çıkış tarih/saati eksik veya geçersiz.">Eksik Veri</Text>);

                if (rule.appliedRule === 'Rule 3') {
                    const deadline = parseDT(r.teslim_varis).add(2, 'day').hour(8).minute(30);
                    const deadlineFmt = deadline.format('DD.MM HH:mm');
                    if (rule.compliant) return (<Text color="success.main" icon={<CheckCircleIcon fontSize="small" />} tooltipTitle={`[Kural 3 - Cmt Varış ${varisSaati}] Çıkış saati Pzt ${deadlineFmt}'dan önce.`}>UYGUN (Kural 3)</Text>);
                    return (<Text color="error.main" icon={<AccessTimeFilledIcon fontSize="small" />} tooltipTitle={`[Kural 3 İhlali] Çıkış saati Pzt ${deadlineFmt}'ı aştı. Gecikme: ${minToHM(rule.delay)}`}>GEÇ KALDI (Kural 3)</Text>);
                }
                if (rule.appliedRule === 'Rule 1') {
                    const deadline = parseDT(r.teslim_varis).hour(17).minute(0).format('HH:mm');
                    if (rule.compliant) return (<Text color="success.main" icon={<CheckCircleIcon fontSize="small" />} tooltipTitle={`[Kural 1 - Varış ${varisSaati}] Çıkış saati ${deadline}'dan önce.`}>UYGUN (Kural 1)</Text>);
                    return (<Text color="error.main" icon={<AccessTimeFilledIcon fontSize="small" />} tooltipTitle={`[Kural 1 İhlali] Çıkış saati ${deadline}'ı aştı. Gecikme: ${minToHM(rule.delay)}`}>GEÇ KALDI (Kural 1)</Text>);
                }
                if (rule.appliedRule === 'Rule 2') {
                    const deadline = parseDT(r.teslim_varis).add(1, 'day').hour(12).minute(0);
                    const deadlineFmt = deadline.format('DD.MM HH:mm');
                    if (rule.compliant) return (<Text color="success.main" icon={<CheckCircleIcon fontSize="small" />} tooltipTitle={`[Kural 2 - Varış ${varisSaati}] Çıkış saati ertesi gün ${deadlineFmt}'dan önce.`}>UYGUN (Kural 2)</Text>);
                    return (<Text color="error.main" icon={<AccessTimeFilledIcon fontSize="small" />} tooltipTitle={`[Kural 2 İhlali] Çıkış saati ertesi gün ${deadlineFmt}'ı aştı. Gecikme: ${minToHM(rule.delay)}`}>GEÇ KALDI (Kural 2)</Text>);
                }
                return (
                    <Text color="grey.600" icon={<CloseIcon fontSize="small" />} tooltipTitle={`Kural dışı varış. Varış saati kural aralıklarının dışında.`}>
                        Uygulanmadı
                    </Text>
                );
            }
        },

        {
            header: "Şartlı Bekleme Süresi",
            width: 150,
            render: (r) => {
                const color = r.rule.delay > 0 ? "error.dark" : "text.primary";
                return (
                    <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: r.rule.delay > 0 ? 'bold' : 'normal', color: color }}
                    >
                        {minToHM(r.rule.delay)}
                    </Typography>
                );
            }
        }
    ];

    // --------------------------------------------------
    // UI RENDER 
    // --------------------------------------------------
    return (
        <Container maxWidth="xl" sx={{ py: 5 }}>
            <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold", color: "primary.main" }}>
                🚚 Teslimde Bekleme Raporu ve Analizi
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Plaka Bazlı Detaylı Analiz Sonuçları */}
            <DetailedAnalysisTable
                data={detailedAnalysis}
                loading={analysisLoading}
                start={dayjs(startDate).format('DD.MM.YYYY')}
                end={dayjs(endDate).format('DD.MM.YYYY')}
            />

            {/* Plaka Performans Puanlama Tablosu */}
            <ScoreAnalysisTable
                data={detailedAnalysis}
            />

            <hr />

            {/* Analiz Tarih Aralığı Filtrelemesi */}
            <Paper elevation={8} sx={{ p: 3, mb: 4, mt: 4, borderRadius: 2, bgcolor: theme.palette.background.paper }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    🗓️ Analiz Tarih Aralığı Filtresi (Plaka Bazlı)
                </Typography>
                <Grid container spacing={3} alignItems="center">
                    {/* YENİ EKLENEN AY FİLTRESİ */}
                    <Grid item>
                        <TextField
                            type="month"
                            label="Ay Seçin"
                            value={selectedMonth}
                            onChange={(e) => handleMonthChange(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item>
                        <TextField
                            type="date"
                            label="Başlangıç Tarihi"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            variant="outlined"
                            size="medium"
                            InputProps={{
                                startAdornment: (<InputAdornment position="start"><DateRangeIcon color="primary" /></InputAdornment>),
                            }}
                        />
                    </Grid>
                    <Grid item>
                        <TextField
                            type="date"
                            label="Bitiş Tarihi"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            variant="outlined"
                            size="medium"
                            InputProps={{
                                startAdornment: (<InputAdornment position="start"><DateRangeIcon color="primary" /></InputAdornment>),
                            }}
                        />
                    </Grid>

                    <Grid item>
                        <Button
                            variant="contained"
                            color="secondary"
                            size="large"
                            startIcon={analysisLoading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                            onClick={runDetailedAnalysis}
                            disabled={analysisLoading}
                        >
                            Analizi Güncelle
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            <hr />

            {/* Günlük Detay Tablosu Filtrelemesi */}
            {/* Günlük Detay Tablosu Filtrelemesi */}
            <Paper elevation={8} sx={{ p: 3, mb: 4, borderRadius: 2, bgcolor: theme.palette.background.paper }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    📋 Günlük Detay Tablosu Filtresi
                </Typography>

                <Grid container spacing={3} alignItems="center">

                    {/* ✅ YENİ EKLENEN AY FİLTRESİ */}
                    <Grid item>
                        <TextField
                            type="month"
                            label="Ay (Detay Tablosu)"
                            value={dailyMonth}
                            onChange={(e) => {
                                setDailyMonth(e.target.value);
                                setDate(""); // Gün seçimini sıfırlar
                            }}
                            InputLabelProps={{ shrink: true }}
                            variant="outlined"
                            size="medium"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <DateRangeIcon color="primary" />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>

                    {/* 🟦 Gün seçme alanı (eski halinde duruyor) */}
                    <Grid item>
                        <TextField
                            type="date"
                            label="Varış Günü (Detay Tablosu İçin)"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            variant="outlined"
                            size="medium"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <DateRangeIcon color="primary" />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>

                    <Grid item>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                            onClick={fetchAll}
                            disabled={loading}
                        >
                            Detay Tablosunu Getir
                        </Button>
                    </Grid>

                    <Grid item>
                        <Button
                            variant="outlined"
                            color="success"
                            size="large"
                            startIcon={<FileDownloadIcon />}
                            onClick={() => exportExcel(rows)}
                            disabled={!rows.length || loading}
                        >
                            Excel'e Aktar (Sadece Günlük İhlaller)
                        </Button>
                        {rows.length > 0 && (
                            <Grid item xs={12}>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                    📌 Toplam Gelen Kayıt: {rows.length}
                                </Typography>

                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                                    ⚠️ İhlalli + Eksik Veri Kayıt Sayısı: {
                                        rows.filter(r => r.rule.compliant === false || r.rule.compliant === null).length
                                    }
                                </Typography>
                            </Grid>
                        )}

                    </Grid>

                    {rows.length > 0 && (
                        <Grid item>
                            <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                                Tabloda gösterilen kayıt sayısı: {rows.filter(r => r.rule.compliant === false || r.rule.compliant === null).length} / Toplam {rows.length} kayıt
                            </Typography>
                        </Grid>
                    )}
                </Grid>
            </Paper>


            {/* Kural Tanımları - Accordion */}
            <Accordion
                elevation={2}
                sx={{
                    mb: 3,
                    borderRadius: 1,
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: theme.palette.background.paper
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                >
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>
                        📊 Kural Tanımları ve Bekleme Süresi Hesaplama Mantığı
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        <li style={{ color: theme.palette.text.primary }}>**Kural 1 (ÖÖ Varış):** Varış **08:30 (Dahil) - 12:00 (Hariç)**. Sınır: Aynı Gün **17:00**. Bu saatten sonraki çıkış süresi bekleme olarak hesaplanır.</li>
                        <li style={{ color: theme.palette.text.primary }}>**Kural 2 (ÖS Varış):** Varış **12:00 (Dahil) ve sonrası**. Sınır: **Ertesi Gün 12:00**. Bu saatten sonraki çıkış süresi bekleme olarak hesaplanır.</li>
                        <li style={{ color: theme.palette.text.primary }}>**Kural 3 (Hafta Sonu):** Varış **Cumartesi 17:00 (Dahil) ve sonrası**. Sınır: **Pazartesi 08:30**. Bu saatten sonraki çıkış süresi bekleme olarak hesaplanır.</li>
                    </ul>
                </AccordionDetails>
            </Accordion>


            {/* GÜNLÜK DETAY TABLOSU */}
            <Paper elevation={8} sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: theme.palette.background.paper }}>
                <TableContainer sx={{ maxHeight: "70vh", overflow: "auto" }}>
                    <Table stickyHeader sx={{ minWidth: 1400 }} size="medium">
                        <TableHead>
                            <TableRow>
                                {columns.map((c, i) => (
                                    <TableCell
                                        key={i}
                                        sx={{
                                            backgroundColor: "primary.main",
                                            color: "white",
                                            fontWeight: "bold",
                                            minWidth: c.width || 100,
                                            py: 1.5
                                        }}
                                    >
                                        {c.header}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length}>
                                        <Box sx={{ p: 5, textAlign: "center" }}>
                                            <CircularProgress size={30} />
                                            <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
                                                Günlük detay verileri yükleniyor...
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : rows.length ? (
                                rows
                                    .filter(r => r.rule.compliant === false || r.rule.compliant === null)
                                    .map((r, idx) => (
                                        <TableRow
                                            key={r.sefer_no + idx}
                                            hover
                                            sx={{
                                                backgroundColor:
                                                    r.rule.compliant === false
                                                        ? "rgba(255, 0, 0, 0.08)"
                                                        : r.rule.compliant === null
                                                            ? "rgba(255, 193, 7, 0.15)"
                                                            : "inherit",
                                                '&:last-child td, &:last-child th': { border: 0 },
                                            }}
                                        >
                                            {columns.map((c, i) => (
                                                <TableCell key={i}>{c.render(r)}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length}>
                                        <Box sx={{ p: 5, textAlign: "center", color: "text.secondary" }}>
                                            <Typography variant="h6">
                                                🔍 Seçilen gün ({dayjs(date).format('DD.MM.YYYY')}) için ihlalli veya eksik kayıt bulunamadı.
                                            </Typography>
                                            <Typography variant="body2">
                                                Lütfen detayları görmek için farklı bir varış tarihi seçin.
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Container>
    );
}

