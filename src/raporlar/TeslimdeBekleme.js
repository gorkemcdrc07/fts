// ===============================================
// TeslimdeBekleme.jsx — GÜNCEL (pagination + deterministic order + count verify + IN chunk)
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
    LinearProgress,
    MenuItem,
} from "@mui/material";

import { useTheme } from "@mui/material/styles";

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
dayjs.updateLocale("tr", { weekStart: 1 }); // Pazartesi başlangıç

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
  teslim_ili,
  teslim_ilcesi,
  sefer_tarihi,
  yukleme_ili
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

const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
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

    const filtered = rows.filter((r) => r.rule.compliant === false && r.rule.delay > 0);
    if (!filtered.length) {
        alert("İhlalli kayıt bulunamadı.");
        return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("İhlalli Kayıtlar");

    ws.columns = [
        { header: "Sefer No", key: "sefer_no", width: 12 },
        { header: "Plaka", key: "plaka", width: 10 },
        { header: "Proje", key: "proje", width: 22 },
        { header: "Teslim Noktası", key: "teslim_noktasi", width: 28 },
        { header: "Teslim İli", key: "teslim_ili", width: 14 },
        { header: "Teslim İlçesi", key: "teslim_ilcesi", width: 16 },
        { header: "Teslim Varış", key: "teslim_varis", width: 20 },
        { header: "Teslim Çıkış", key: "teslim_cikis", width: 20 },
        { header: "Gecikme Süresi", key: "gecikme", width: 18 },
    ];

    filtered.forEach((r) =>
        ws.addRow({
            sefer_no: r.sefer_no,
            plaka: r.plaka,
            proje: r.proje_adi,
            teslim_noktasi: r.teslim_noktasi,
            teslim_ili: r.teslim_ili || "",
            teslim_ilcesi: r.teslim_ilcesi || "",
            teslim_varis: fmt(r.teslim_varis),
            teslim_cikis: fmt(r.teslim_cikis),
            gecikme: minToHM(r.rule.delay),
        })
    );

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `bekleme_ihlalleri_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
};

// ======================================================================
// UI — Detaylı plaka satırı (açılır liste)
// ======================================================================
const DetailedRow = ({ row }) => {
    const [open, setOpen] = useState(false);
    const nonCompliantTrips = row.trips.filter((t) => t.rule.compliant === false);

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
                                            <TableRow key={i} sx={{ backgroundColor: "rgba(255,0,0,0.08)" }}>
                                                <TableCell>{t.sefer_no}</TableCell>
                                                <TableCell>{dayjs(t.sefer_tarihi).format("DD.MM.YYYY")}</TableCell>
                                                <TableCell>
                                                    {t.yukleme_ili} → {t.teslim_ili}
                                                </TableCell>
                                                <TableCell>{t.teslim_noktasi}</TableCell>
                                                <TableCell>
                                                    {fmt(t.teslim_varis)} <br /> {fmt(t.teslim_cikis)}
                                                </TableCell>
                                                <TableCell>{t.rule.appliedRule}</TableCell>
                                                <TableCell align="right">{minToHM(t.rule.delay)}</TableCell>
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

    const [mode, setMode] = useState("day"); // day | week | month
    const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [dailyMonth, setDailyMonth] = useState(dayjs().format("YYYY-MM"));
    const [weekCount, setWeekCount] = useState("1"); // 1|2|3|all

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const [progressMessage, setProgressMessage] = useState(null);
    const [progressValue, setProgressValue] = useState(0);

    const [startDate, setStartDate] = useState(dayjs().subtract(7, "day").format("YYYY-MM-DD"));
    const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [detailedAnalysis, setDetailedAnalysis] = useState([]);
    const [analysisLoading, setAnalysisLoading] = useState(false);

    const [error, setError] = useState(null);

    // ✅ Mod’a göre aralık üretir
    const computeRange = useCallback(() => {
        if (mode === "day") {
            const s = dayjs(date).startOf("day");
            const e = dayjs(date).endOf("day");
            return { start: s, end: e, label: dayjs(date).format("DD.MM.YYYY") };
        }

        const monthStart = dayjs(dailyMonth).startOf("month");
        const monthEnd = dayjs(dailyMonth).endOf("month");

        if (mode === "month") {
            return { start: monthStart, end: monthEnd, label: dayjs(dailyMonth).format("MMMM YYYY") };
        }

        let end;
        if (weekCount === "all") end = monthEnd;
        else {
            end = monthStart.add(Number(weekCount) * 7, "day").endOf("day");
            if (end.isAfter(monthEnd)) end = monthEnd;
        }

        return {
            start: monthStart,
            end,
            label:
                weekCount === "all"
                    ? `${monthStart.format("DD.MM")} - ${monthEnd.format("DD.MM.YYYY")}`
                    : `İlk ${weekCount} hafta (${monthStart.format("DD.MM")} - ${end.format("DD.MM.YYYY")})`,
        };
    }, [mode, date, dailyMonth, weekCount]);

    // ✅ COUNT: aralıkta kaç detail var (gerçek beklenen)
    const getDetailCount = useCallback(async (startISO, endISO) => {
        const { count, error: e } = await supabase
            .from(DETAIL_TABLE)
            .select("sefer_no", { count: "exact", head: true })
            .gte("teslim_varis", startISO)
            .lte("teslim_varis", endISO);

        if (e) throw e;
        return count || 0;
    }, []);

    // ✅ Pagination ile tüm detail
    const fetchDetailsUnlimited = useCallback(
        async (startISO, endISO, pageSize = 1000, onTick) => {
            let from = 0;
            let all = [];

            while (true) {
                const { data, error: e } = await supabase
                    .from(DETAIL_TABLE)
                    .select(DETAIL_COLS)
                    .gte("teslim_varis", startISO)
                    .lte("teslim_varis", endISO)
                    // ✅ deterministic order (aynı teslim_varis -> sefer_no tie-break)
                    .order("teslim_varis", { ascending: true })
                    .order("sefer_no", { ascending: true })
                    .range(from, from + pageSize - 1);

                if (e) throw e;
                if (!data || data.length === 0) break;

                all = all.concat(data);
                if (onTick) onTick(all.length);

                if (data.length < pageSize) break;
                from += pageSize;
            }

            return all;
        },
        []
    );

    // ✅ Summary IN chunk
    const fetchSummariesBySeferNos = useCallback(async (seferNos, onPart) => {
        let summaryAll = [];
        const parts = chunkArray(seferNos, 500);

        for (let i = 0; i < parts.length; i++) {
            const { data, error } = await supabase.from(SUMMARY_TABLE).select(SUMMARY_COLS).in("sefer_no", parts[i]);
            if (error) throw error;

            summaryAll = summaryAll.concat(data || []);
            if (onPart) onPart(i + 1, parts.length, summaryAll.length);
        }

        return summaryAll;
    }, []);

    // --------------------------------------------------------------
    // GÜNLÜK / HAFTALIK / AYLIK VERİ ÇEK
    // --------------------------------------------------------------
    const fetchDaily = useCallback(async () => {
        setLoading(true);
        setRows([]);
        setError(null);
        setProgressMessage("Veri çekimi başlatılıyor...");
        setProgressValue(0);

        const startedAt = Date.now();

        try {
            const range = computeRange();
            const startOfRange = range.start.clone().startOf("day");
            const endOfRange = range.end.clone().endOf("day");

            const shouldChunkByWeek = mode !== "day";
            let allDetails = [];

            // ✅ detay count doğrulama (ay/hafta/gün)
            const expectedTotal = await getDetailCount(startOfRange.toISOString(), endOfRange.toISOString());
            console.log("[VERIFY] Detail expected total:", expectedTotal);

            if (!shouldChunkByWeek) {
                setProgressValue(10);
                setProgressMessage(`Detay çekiliyor (${range.label})...`);

                allDetails = await fetchDetailsUnlimited(
                    startOfRange.toISOString(),
                    endOfRange.toISOString(),
                    1000,
                    (fetched) => {
                        // 10 → 60 arası
                        const pct = expectedTotal > 0 ? Math.min(60, 10 + Math.round((fetched / expectedTotal) * 50)) : 30;
                        setProgressValue(pct);
                        setProgressMessage(`Detay çekiliyor (${range.label})... ${fetched}/${expectedTotal}`);
                    }
                );
            } else {
                let currentDate = startOfRange.clone();
                const endDateLocal = endOfRange.clone();

                let totalWeeks = Math.ceil(endDateLocal.diff(currentDate, "week", true));
                if (totalWeeks <= 0) totalWeeks = 1;

                let weekCounter = 0;
                let fetchedTotal = 0;

                while (currentDate.isSameOrBefore(endDateLocal, "day")) {
                    weekCounter++;

                    let weekEnd = currentDate.clone().endOf("week");
                    if (weekEnd.isAfter(endDateLocal)) weekEnd = endDateLocal.clone();

                    const startISO = currentDate.startOf("day").toISOString();
                    const endISO = weekEnd.endOf("day").toISOString();

                    setProgressMessage(`Detay çekiliyor (${range.label}): ${weekCounter}/${totalWeeks} hafta...`);

                    // her haftayı da limitsiz çek
                    const weekDetails = await fetchDetailsUnlimited(startISO, endISO, 1000, (weekFetched) => {
                        // kaba progress: 5 → 60
                        const base = 5 + Math.round((weekCounter / totalWeeks) * 55);
                        setProgressValue(Math.min(60, base));
                    });

                    allDetails = allDetails.concat(weekDetails);
                    fetchedTotal += weekDetails.length;

                    currentDate = weekEnd.add(1, "day").startOf("day");
                }

                console.log("[VERIFY] Detail fetched total:", allDetails.length, "expected:", expectedTotal);
                setProgressValue(60);
            }

            // ✅ verify
            console.log("[VERIFY] Detail fetched total:", allDetails.length, "expected:", expectedTotal);

            if (!allDetails.length) {
                setProgressMessage("Kayıt bulunamadı.");
                setProgressValue(0);
                setLoading(false);
                return;
            }

            const seferNos = [...new Set(allDetails.map((d) => d.sefer_no))];

            setProgressValue(65);
            setProgressMessage(`Özet çekiliyor... (${seferNos.length} sefer)`);

            const summaryAll = await fetchSummariesBySeferNos(seferNos, (i, total, soFar) => {
                // 65 → 85
                setProgressValue(65 + Math.round((i / total) * 20));
                setProgressMessage(`Özet çekiliyor... ${i}/${total} parça (toplam ${soFar})`);
            });

            const summaryMap = new Map();
            summaryAll.forEach((s) => summaryMap.set(s.sefer_no, s));

            // ✅ summary eksiklerini say
            let missingSummary = 0;
            for (const sn of seferNos) if (!summaryMap.get(sn)) missingSummary++;
            console.log("[VERIFY] Missing summary for sefer_no:", missingSummary);

            // ✅ Sefer bazında en kötü ihlal
            const consolidatedMap = new Map();

            allDetails.forEach((d) => {
                const s = summaryMap.get(d.sefer_no);
                if (!s) return;

                const rule = calcRule(d.teslim_varis, d.teslim_cikis);

                if (rule.compliant === false || rule.compliant === null) {
                    const rec = {
                        ...s,
                        teslim_noktasi: d.teslim_noktasi,
                        teslim_varis: d.teslim_varis,
                        teslim_cikis: d.teslim_cikis,
                        rule,
                    };

                    if (consolidatedMap.has(d.sefer_no)) {
                        const ex = consolidatedMap.get(d.sefer_no);

                        if (ex.rule.compliant === null) {
                            if (rule.compliant === false || rule.delay > ex.rule.delay) consolidatedMap.set(d.sefer_no, rec);
                        } else if (rule.delay > ex.rule.delay) {
                            consolidatedMap.set(d.sefer_no, rec);
                        }
                    } else {
                        consolidatedMap.set(d.sefer_no, rec);
                    }
                }
            });

            const final = Array.from(consolidatedMap.values());
            setRows(final);

            const elapsed = (Date.now() - startedAt) / 1000;
            setProgressValue(100);
            setProgressMessage(
                `Bitti (${elapsed.toFixed(1)} sn). Detail: ${allDetails.length}/${expectedTotal}, Sefer: ${seferNos.length}, İhlal satırı: ${final.length}, Summary eksik: ${missingSummary}`
            );
        } catch (err) {
            setError(err?.message || "Bilinmeyen hata");
            setProgressMessage("Hata oluştu.");
            setProgressValue(0);
        }

        setLoading(false);
    }, [mode, computeRange, getDetailCount, fetchDetailsUnlimited, fetchSummariesBySeferNos]);

    // ✅ Otomatik tetikleme
    useEffect(() => {
        fetchDaily();
    }, [mode, date, dailyMonth, weekCount, fetchDaily]);

    // --------------------------------------------------------------
    // DETAYLI ANALİZ VERİSİ ÇEK (pagination + IN chunk)
    // --------------------------------------------------------------
    const runAnalysis = useCallback(async () => {
        setAnalysisLoading(true);
        setDetailedAnalysis([]);
        setError(null);

        try {
            const startISO = dayjs(startDate).startOf("day").toISOString();
            const endISO = dayjs(endDate).endOf("day").toISOString();

            const expected = await getDetailCount(startISO, endISO);
            console.log("[VERIFY][ANALYSIS] expected detail:", expected);

            const detail = await fetchDetailsUnlimited(startISO, endISO, 1000);
            console.log("[VERIFY][ANALYSIS] fetched detail:", detail.length);

            if (!detail.length) {
                setAnalysisLoading(false);
                return;
            }

            const seferNos = [...new Set(detail.map((d) => d.sefer_no))];
            const summaryAll = await fetchSummariesBySeferNos(seferNos);

            const summaryMap = new Map();
            summaryAll.forEach((s) => summaryMap.set(s.sefer_no, s));

            const map = new Map();

            detail.forEach((d) => {
                const s = summaryMap.get(d.sefer_no);
                if (!s) return;

                const plaka = s.plaka;
                const rule = calcRule(d.teslim_varis, d.teslim_cikis);

                if (!map.has(plaka)) {
                    map.set(plaka, {
                        plaka,
                        proje_adi: s.proje_adi,
                        totalTrips: 0,
                        nonCompliantCount: 0,
                        totalDelayMinutes: 0,
                        trips: [],
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

                if (rule.compliant !== null) item.totalTrips++;
                if (rule.compliant === false) {
                    item.nonCompliantCount++;
                    item.totalDelayMinutes += rule.delay;
                }
            });

            const output = Array.from(map.values()).map((item) => {
                const { score, penalty } = calculateScore(item.totalTrips, item.nonCompliantCount, item.totalDelayMinutes);

                return {
                    ...item,
                    violationRate: item.totalTrips > 0 ? ((item.nonCompliantCount / item.totalTrips) * 100).toFixed(1) : 0,
                    totalDelay: minToHM(item.totalDelayMinutes),
                    score,
                    penalty,
                };
            });

            setDetailedAnalysis(output.sort((a, b) => b.score - a.score));
        } catch (err) {
            setError(err?.message || "Bilinmeyen hata");
        }

        setAnalysisLoading(false);
    }, [startDate, endDate, getDetailCount, fetchDetailsUnlimited, fetchSummariesBySeferNos]);

    // --------------------------------------------------------------
    // RENDER
    // --------------------------------------------------------------
    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold", color: "primary.main" }}>
                🚚 Teslimde Bekleme Analizi
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}

            <Paper sx={{ p: 3, mb: 4 }} elevation={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    📅 İhlal Detay Tablosu ({rows.length} İhlal Kaydı)
                </Typography>

                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                        <TextField select fullWidth label="Mod" value={mode} onChange={(e) => setMode(e.target.value)} disabled={loading}>
                            <MenuItem value="day">Günlük</MenuItem>
                            <MenuItem value="week">Haftalık (Ay + İlk N Hafta)</MenuItem>
                            <MenuItem value="month">Aylık (Tüm Ay)</MenuItem>
                        </TextField>
                    </Grid>

                    {mode === "day" && (
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                label="Günlük Tarih"
                                type="date"
                                value={date}
                                InputLabelProps={{ shrink: true }}
                                onChange={(e) => setDate(e.target.value)}
                                disabled={loading}
                            />
                        </Grid>
                    )}

                    {(mode === "week" || mode === "month") && (
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                label="Ay Seç"
                                type="month"
                                value={dailyMonth}
                                InputLabelProps={{ shrink: true }}
                                onChange={(e) => setDailyMonth(e.target.value)}
                                disabled={loading}
                            />
                        </Grid>
                    )}

                    {mode === "week" && (
                        <Grid item xs={12} md={3}>
                            <TextField select fullWidth label="Kaç Haftası" value={weekCount} onChange={(e) => setWeekCount(e.target.value)} disabled={loading}>
                                <MenuItem value="1">İlk 1 Hafta</MenuItem>
                                <MenuItem value="2">İlk 2 Hafta</MenuItem>
                                <MenuItem value="3">İlk 3 Hafta</MenuItem>
                                <MenuItem value="all">Tüm Ay</MenuItem>
                            </TextField>
                        </Grid>
                    )}

                    <Grid item xs={12} md={3}>
                        <Tooltip title="Seçimler değişince otomatik güncellenir, yine de manuel yenileyebilirsin.">
                            <span>
                                <Button fullWidth variant="contained" startIcon={<SearchIcon />} onClick={fetchDaily} disabled={loading}>
                                    {loading ? "Yükleniyor..." : "Yenile"}
                                </Button>
                            </span>
                        </Tooltip>
                    </Grid>

                    <Grid item xs={12} md={3}>
                        <Button
                            fullWidth
                            variant="outlined"
                            color="success"
                            startIcon={<FileDownloadIcon />}
                            disabled={!rows.length || loading}
                            onClick={() => exportExcel(rows)}
                        >
                            İhlalli Kayıtları Excel ({rows.length})
                        </Button>
                    </Grid>
                </Grid>

                {loading && (
                    <Box sx={{ mt: 2, p: 1, backgroundColor: theme.palette.action.hover, borderRadius: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                            <CircularProgress size={20} sx={{ mr: 2 }} />
                            <Typography variant="body2" color="textSecondary">
                                {progressMessage}
                            </Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={progressValue} sx={{ height: 8, borderRadius: 4 }} />
                    </Box>
                )}

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
                                    <TableCell align="center" colSpan={8} />
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
                                            {r.rule.compliant === false && (
                                                <CloseIcon color="error" fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5 }} />
                                            )}
                                            {r.rule.compliant === null && (
                                                <ErrorOutlineIcon color="warning" fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5 }} />
                                            )}
                                            {r.rule.appliedRule}
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: r.rule.delay > 0 ? "bold" : "normal" }}>{minToHM(r.rule.delay)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell align="center" colSpan={8} sx={{ py: 2 }}>
                                        <Alert severity="info" variant="outlined">
                                            Seçili aralıkta kural ihlalli veya eksik veri içeren kayıt bulunamadı.
                                        </Alert>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Paper sx={{ p: 3, mb: 4 }} elevation={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    📊 Tarih Aralığı Analizi (Performans Puanı)
                </Typography>

                <Grid container spacing={3} alignItems="center">
                    <Grid item>
                        <TextField type="date" label="Başlangıç" value={startDate} InputLabelProps={{ shrink: true }} onChange={(e) => setStartDate(e.target.value)} />
                    </Grid>

                    <Grid item>
                        <TextField type="date" label="Bitiş" value={endDate} InputLabelProps={{ shrink: true }} onChange={(e) => setEndDate(e.target.value)} />
                    </Grid>

                    <Grid item>
                        <Button variant="contained" color="secondary" startIcon={<SearchIcon />} disabled={analysisLoading} onClick={runAnalysis}>
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

            {detailedAnalysis.length > 0 && (
                <Paper sx={{ p: 3 }} elevation={6}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        📄 Plaka Bazlı Sonuçlar ({detailedAnalysis.length} Plaka)
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

                            <TableBody>{detailedAnalysis.map((row) => <DetailedRow key={row.plaka} row={row} />)}</TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}
        </Container>
    );
}
