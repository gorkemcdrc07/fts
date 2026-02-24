// ======================================================
// CLEANFETCHER — Yüklemede Bekleme Performans Yönetimi (MODERN + GÜNCEL)
// KURAL: Sefer aralığa dahil sayılırsa => detay satırındaki `yukleme_varis` seçilen aralık içinde olmalı
// İHLAL: (en erken yukleme_varis) → (en geç yukleme_cikis) farkı >= 240 dk (4 saat)
// NOT: Aylık/haftalık çok seferde `.in()` limitlerine takılmamak için summary çekimi chunk'landı.
// ======================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

import dayjs from "dayjs";
import "dayjs/locale/tr";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Collapse,
    Container,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
    LinearProgress,
    MenuItem,
    Paper,
    Skeleton,
    Stack,
    Tab,
    Tabs,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";

// Icons
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DateRangeIcon from "@mui/icons-material/DateRange";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SpeedIcon from "@mui/icons-material/Speed";
import StarIcon from "@mui/icons-material/Star";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import WarningIcon from "@mui/icons-material/Warning";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

// ======================================================
// Sabitler
// ======================================================
const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";
const MINIMUM_WAIT_TIME_MINUTES = 240;

// ======================================================
// Helpers
// ======================================================
dayjs.locale("tr");

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

const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

// ======================================================
// ✅ LIMITSİZ GİBİ DAVRANAN "TÜM SATIRLARI ÇEK" HELPER'I
// PostgREST/Supabase tek seferde limitsiz dönmez.
// Bu helper sayfalama ile ne kadar satır varsa hepsini biriktirir.
// ======================================================
async function fetchAllDetails({ startISO, endISO, pageSize = 1000 }) {
    let from = 0;
    let all = [];

    while (true) {
        const { data, error } = await supabase
            .from(DETAIL_TABLE)
            .select("sefer_no, yukleme_varis, yukleme_cikis")
            .gte("yukleme_varis", startISO)
            .lte("yukleme_varis", endISO)
            // pagination için stabil sıralama şart
            .order("yukleme_varis", { ascending: true })
            .range(from, from + pageSize - 1);

        if (error) throw error;

        if (!data || data.length === 0) break;

        all = all.concat(data);

        // son sayfa geldiyse bitir
        if (data.length < pageSize) break;

        from += pageSize;
    }

    return all;
}

// ======================================================
// Modern KPI Card
// ======================================================
const KPICard = ({ title, value, icon: Icon, color, subtitle }) => (
    <Card
        elevation={0}
        sx={{
            height: "100%",
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
        }}
    >
        <Box
            sx={{
                height: 6,
                background: `linear-gradient(90deg, ${color}, transparent)`,
            }}
        />
        <CardContent sx={{ p: 2.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {title}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {value}
                    </Typography>
                    {subtitle ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                            {subtitle}
                        </Typography>
                    ) : null}
                </Box>

                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: `${color}1a`,
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Icon sx={{ color, fontSize: 26 }} />
                </Box>
            </Stack>
        </CardContent>
    </Card>
);

// ======================================================
// Tab 0 Plaka Satırı
// ======================================================
function PlateRow({ p, idx }) {
    const theme = useTheme();
    return (
        <TableRow
            key={p.plaka}
            sx={{
                bgcolor: idx % 2 === 0 ? theme.palette.action.hover : "inherit",
                "&:hover": { bgcolor: theme.palette.action.selected },
            }}
        >
            <TableCell sx={{ width: 14 }} />
            <TableCell sx={{ fontWeight: 800 }}>{p.plaka}</TableCell>
            <TableCell sx={{ maxWidth: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.projeler}
            </TableCell>
            <TableCell align="right" sx={{ color: theme.palette.error.dark, fontWeight: 800 }}>
                {p.ihlalliSefer}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
                {minToHM(p.toplamIhlalSuresi)}
            </TableCell>
        </TableRow>
    );
}

// ======================================================
// Tab 1 Performans Satırı (detay açılır)
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

        if (!seferler.length) {
            return (
                <Box sx={{ p: 2, bgcolor: theme.palette.action.hover, borderTop: `1px solid ${theme.palette.divider}` }}>
                    <Alert severity="warning">Bu plakaya ait seçilen tarih aralığında detaylı sefer verisi bulunamadı.</Alert>
                </Box>
            );
        }

        return (
            <Box sx={{ p: 2, bgcolor: theme.palette.action.hover, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {p.plaka} — Tüm Seferler ({seferler.length})
                    </Typography>
                    <Chip size="small" label={`İhlal sınırı: ${minToHM(MINIMUM_WAIT_TIME_MINUTES)}`} variant="outlined" />
                </Stack>

                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: theme.palette.action.selected }}>
                            <TableCell sx={{ fontWeight: 800, py: 0.75 }}>Sefer No</TableCell>
                            <TableCell sx={{ fontWeight: 800, py: 0.75 }}>Proje</TableCell>
                            <TableCell sx={{ fontWeight: 800, py: 0.75 }}>Şoför</TableCell>
                            <TableCell sx={{ fontWeight: 800, py: 0.75 }}>İlk Varış</TableCell>
                            <TableCell sx={{ fontWeight: 800, py: 0.75 }}>Son Çıkış</TableCell>
                            <TableCell sx={{ fontWeight: 800, py: 0.75 }}>Toplam Bekleme</TableCell>
                            <TableCell sx={{ fontWeight: 800, py: 0.75 }}>Durum</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {seferler.map((s, i) => {
                            const isViol = s.isViolation;
                            return (
                                <TableRow
                                    key={i}
                                    hover
                                    sx={{
                                        bgcolor: isViol ? "rgba(255, 107, 107, 0.10)" : "inherit",
                                    }}
                                >
                                    <TableCell>{s.sefer_no}</TableCell>
                                    <TableCell>{s.proje_adi}</TableCell>
                                    <TableCell>{s.surucu_ad_soyad}</TableCell>
                                    <TableCell>{fmtDateTR(s.ilk_yukleme_varis)}</TableCell>
                                    <TableCell>{fmtDateTR(s.son_yukleme_cikis)}</TableCell>
                                    <TableCell
                                        sx={{
                                            fontWeight: isViol ? 900 : 600,
                                            color: isViol ? theme.palette.error.main : theme.palette.text.secondary,
                                        }}
                                    >
                                        {minToHM(s.total_wait_minutes)}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={isViol ? "error" : "success"}
                                            variant={isViol ? "filled" : "outlined"}
                                            label={isViol ? "İhlal (≥4sa)" : "Normal"}
                                        />
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
                    "& > *": { borderBottom: "unset" },
                    bgcolor: isViolation ? `${theme.palette.error.light}1a` : idx % 2 === 0 ? theme.palette.action.hover : "inherit",
                    "&:hover": { bgcolor: theme.palette.action.selected },
                }}
            >
                <TableCell width="1%">
                    <Tooltip title={open ? "Detayları Gizle" : "Tüm Sefer Detaylarını Göster"}>
                        <IconButton size="small" onClick={() => setOpen(!open)} color="primary">
                            {open ? <ExpandLessIcon /> : <VisibilityIcon />}
                        </IconButton>
                    </Tooltip>
                </TableCell>

                <TableCell sx={{ fontWeight: 900 }}>{p.plaka}</TableCell>
                <TableCell sx={{ maxWidth: 420, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.projeler}
                </TableCell>

                <TableCell align="right">{p.toplamSefer}</TableCell>
                <TableCell align="right" sx={{ color: isViolation ? theme.palette.error.dark : "inherit", fontWeight: 800 }}>
                    {p.ihlalliSefer}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>
                    {p.ihlalOrani}
                </TableCell>
                <TableCell align="right">{minToHM(p.toplamIhlalSuresi)}</TableCell>

                <TableCell align="right" sx={{ color: theme.palette.error.main, fontWeight: 900 }}>
                    {p.ceza}
                </TableCell>

                <TableCell
                    align="right"
                    sx={{
                        color: getPerfColor(parseFloat(p.performans)),
                        fontWeight: 900,
                        fontSize: "1.05em",
                        whiteSpace: "nowrap",
                    }}
                >
                    <StarIcon sx={{ fontSize: "1em", verticalAlign: "middle", mr: 0.5 }} />
                    {p.performans}
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
export default function CleanFetcherModern() {
    const theme = useTheme();

    // TAB
    const [tabValue, setTabValue] = useState(0);

    // TEK GÜN / HAFTALIK / AYLIK
    const [dailyMode, setDailyMode] = useState("day"); // day | week | month
    const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [selectedDailyMonth, setSelectedDailyMonth] = useState(dayjs().format("YYYY-MM"));
    const [selectedWeekCount, setSelectedWeekCount] = useState("1"); // 1 | 2 | 3 | all

    const [dailyViolationRows, setDailyViolationRows] = useState([]);
    const [loadingDaily, setLoadingDaily] = useState(false);

    // RANGE PERFORMANS
    const [performanceData, setPerformanceData] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
    const [startDate, setStartDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
    const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [loadingRange, setLoadingRange] = useState(false);

    // UI: search filters (client-side)
    const [qDaily, setQDaily] = useState("");
    const [qRange, setQRange] = useState("");

    const handleTabChange = (_, newValue) => setTabValue(newValue);

    const handleMonthChange = (month) => {
        setSelectedMonth(month);
        const start = dayjs(month).startOf("month").format("YYYY-MM-DD");
        const end = dayjs(month).endOf("month").format("YYYY-MM-DD");
        setStartDate(start);
        setEndDate(end);
    };

    // ======================================================
    // (1) Gün / Haftalık / Aylık — ARALIK HESAPLA
    // ======================================================
    const computeDailyRange = useCallback(() => {
        if (dailyMode === "day") {
            const d = dayjs(selectedDate);
            return {
                start: d.startOf("day"),
                end: d.endOf("day"),
                label: d.format("DD.MM.YYYY"),
            };
        }

        if (dailyMode === "month") {
            const m = dayjs(selectedDailyMonth);
            return {
                start: m.startOf("month"),
                end: m.endOf("month"),
                label: m.format("MMMM YYYY"),
            };
        }

        // week: ayın başından itibaren ilk N hafta / tüm ay
        const monthStart = dayjs(selectedDailyMonth).startOf("month");
        const monthEnd = dayjs(selectedDailyMonth).endOf("month");

        let end;
        if (selectedWeekCount === "all") {
            end = monthEnd;
        } else {
            end = monthStart.add(Number(selectedWeekCount) * 7, "day").endOf("day");
            if (end.isAfter(monthEnd)) end = monthEnd;
        }

        return {
            start: monthStart,
            end,
            label:
                selectedWeekCount === "all"
                    ? `${monthStart.format("DD.MM")} - ${monthEnd.format("DD.MM.YYYY")}`
                    : `İlk ${selectedWeekCount} hafta (${monthStart.format("DD.MM")} - ${end.format("DD.MM.YYYY")})`,
        };
    }, [dailyMode, selectedDate, selectedDailyMonth, selectedWeekCount]);

    const dailyRangeLabel = useMemo(() => computeDailyRange().label, [computeDailyRange]);

    // ======================================================
    // (2) Gün / Haftalık / Aylık — VERİ ÇEK (KURAL: yukleme_varis aralık içinde)
    // ✅ details pagination ile TÜM satırlar
    // ======================================================
    const fetchDailyViolations = useCallback(async () => {
        setLoadingDaily(true);
        setDailyViolationRows([]);

        const range = computeDailyRange();
        const startISO = range.start.toISOString();
        const endISO = range.end.toISOString();

        try {
            // ✅ Detayları limitsiz gibi: sayfalayarak hepsini al
            const details = await fetchAllDetails({ startISO, endISO, pageSize: 1000 });

            if (!details?.length) {
                setDailyViolationRows([]);
                setLoadingDaily(false);
                return;
            }

            // details -> sefer_no map
            const detailsBySefer = new Map();
            details.forEach((d) => {
                if (!detailsBySefer.has(d.sefer_no)) detailsBySefer.set(d.sefer_no, []);
                detailsBySefer.get(d.sefer_no).push(d);
            });

            const seferNos = [...detailsBySefer.keys()];

            // Summary (chunk ile güvenli)
            let summaryAll = [];
            for (const part of chunkArray(seferNos, 500)) {
                const { data: summary, error: e2 } = await supabase
                    .from(SUMMARY_TABLE)
                    .select(`
            sefer_no,
            plaka,
            treyler,
            surucu_ad_soyad,
            sefer_tarihi,
            yukleme_ili,
            yukleme_ilcesi,
            musteri_adi,
            yukleme_noktasi,
            proje_adi,
            teslim_noktasi,
            teslim_ili,
            teslim_ilcesi
          `)
                    .in("sefer_no", part);

                if (e2) throw e2;
                summaryAll = summaryAll.concat(summary || []);
            }

            const violationRows = [];

            (summaryAll || []).forEach((sRow) => {
                const group = detailsBySefer.get(sRow.sefer_no) || [];

                let firstArrival = null;
                let lastLeave = null;

                group.forEach((rec) => {
                    const v = parseDT(rec.yukleme_varis);
                    const c = parseDT(rec.yukleme_cikis);
                    if (v && (!firstArrival || v.isBefore(firstArrival))) firstArrival = v;
                    if (c && (!lastLeave || c.isAfter(lastLeave))) lastLeave = c;
                });

                let total = null;
                if (firstArrival && lastLeave) total = diffMinutes(firstArrival, lastLeave);

                // İhlal filtresi
                if (total >= MINIMUM_WAIT_TIME_MINUTES) {
                    violationRows.push({
                        ...sRow,
                        ilk_yukleme_varis: firstArrival?.toISOString(),
                        son_yukleme_cikis: lastLeave?.toISOString(),
                        toplam_bekleme_dk: total,
                    });
                }
            });

            setDailyViolationRows(violationRows);
        } catch (err) {
            console.error("Daily fetch error:", err);
        }

        setLoadingDaily(false);
    }, [computeDailyRange]);

    // ======================================================
    // (3) RANGE PERFORMANS (KURAL: yukleme_varis aralık içinde)
    // ✅ details pagination ile TÜM satırlar
    // ======================================================
    const fetchRangePerformance = useCallback(async () => {
        setLoadingRange(true);
        setPerformanceData([]);

        const dayStart = dayjs(startDate).startOf("day").toISOString();
        const dayEnd = dayjs(endDate).endOf("day").toISOString();

        try {
            // ✅ Detayları limitsiz gibi: sayfalayarak hepsini al
            const details = await fetchAllDetails({ startISO: dayStart, endISO: dayEnd, pageSize: 1000 });

            if (!details?.length) {
                setLoadingRange(false);
                return;
            }

            const detailsBySefer = new Map();
            details.forEach((d) => {
                if (!detailsBySefer.has(d.sefer_no)) detailsBySefer.set(d.sefer_no, []);
                detailsBySefer.get(d.sefer_no).push(d);
            });

            const seferNos = [...detailsBySefer.keys()];

            // Summary (chunk)
            let summaryAll = [];
            for (const part of chunkArray(seferNos, 500)) {
                const { data: summary, error: e2 } = await supabase
                    .from(SUMMARY_TABLE)
                    .select(
                        "sefer_no, plaka, treyler, surucu_ad_soyad, sefer_tarihi, yukleme_ili, yukleme_ilcesi, musteri_adi, yukleme_noktasi, proje_adi, teslim_ilcesi, teslim_ili, teslim_noktasi"
                    )
                    .in("sefer_no", part);

                if (e2) throw e2;
                summaryAll = summaryAll.concat(summary || []);
            }

            const allSeferRows = [];

            (summaryAll || []).forEach((sRow) => {
                const group = detailsBySefer.get(sRow.sefer_no) || [];

                let firstArrival = null;
                let lastLeave = null;

                group.forEach((rec) => {
                    const v = parseDT(rec.yukleme_varis);
                    const c = parseDT(rec.yukleme_cikis);
                    if (v && (!firstArrival || v.isBefore(firstArrival))) firstArrival = v;
                    if (c && (!lastLeave || c.isAfter(lastLeave))) lastLeave = c;
                });

                let total = null;
                if (firstArrival && lastLeave) total = diffMinutes(firstArrival, lastLeave);

                allSeferRows.push({
                    ...sRow,
                    isViolation: total >= MINIMUM_WAIT_TIME_MINUTES,
                    total_wait_minutes: total || 0,
                    ilk_yukleme_varis: firstArrival?.toISOString(),
                    son_yukleme_cikis: lastLeave?.toISOString(),
                });
            });

            // Plaka agregasyon
            const plakaMap = {};
            allSeferRows.forEach((r) => {
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
                obj.projeler.add(r.proje_adi);
                obj.tumSeferler.push(r);

                if (r.isViolation) {
                    obj.ihlalliSefer += 1;
                    obj.toplamIhlalSuresi += r.total_wait_minutes;
                }
            });

            const aggregatedList = Object.values(plakaMap).map((p) => ({
                ...p,
                projeler: [...p.projeler].filter(Boolean).join(", "),
                ihlalOrani: p.toplamSefer ? (p.ihlalliSefer / p.toplamSefer) * 100 : 0,
            }));

            const maxIhlalSure = Math.max(...aggregatedList.map((x) => x.toplamIhlalSuresi), 1);
            const maxIhlalOrani = Math.max(...aggregatedList.map((x) => x.ihlalOrani), 0.1);

            const scores = aggregatedList
                .map((item) => {
                    const cezaPuani = (item.toplamIhlalSuresi / maxIhlalSure) * 5 + (item.ihlalOrani / maxIhlalOrani) * 5;

                    const finalCeza = Math.min(10, cezaPuani).toFixed(1);
                    const perf = (10 - finalCeza).toFixed(1);

                    return {
                        ...item,
                        ihlalOrani: item.ihlalOrani.toFixed(1) + "%",
                        ceza: finalCeza,
                        performans: perf,
                    };
                })
                .sort((a, b) => parseFloat(b.performans) - parseFloat(a.performans));

            setPerformanceData(scores);
        } catch (err) {
            console.error("Range fetch error:", err);
        }

        setLoadingRange(false);
    }, [startDate, endDate]);

    // ======================================================
    // (4) Tab 0 Analiz (plaka bazlı)
    // ======================================================
    const dailyPlateAnalysis = useMemo(() => {
        const plakaMap = {};

        dailyViolationRows.forEach((r) => {
            const plaka = r.plaka || "Tanımsız";

            if (!plakaMap[plaka]) {
                plakaMap[plaka] = {
                    plaka,
                    projeler: new Set(),
                    ihlalliSefer: 0,
                    toplamIhlalSuresi: 0,
                    detaylar: [],
                };
            }

            const obj = plakaMap[plaka];
            obj.projeler.add(r.proje_adi);
            obj.ihlalliSefer += 1;
            obj.toplamIhlalSuresi += r.toplam_bekleme_dk;

            obj.detaylar.push({
                sefer_no: r.sefer_no,
                plaka: r.plaka,
                treyler: r.treyler || "",
                sofor: r.surucu_ad_soyad,
                proje: r.proje_adi,
                yukleme_noktasi: r.yukleme_noktasi,
                yukleme_ili: r.yukleme_ili || "",
                teslim_noktasi: r.teslim_noktasi || "",
                teslim_ili: r.teslim_ili || "",
                teslim_ilcesi: r.teslim_ilcesi || "",
                varis: r.ilk_yukleme_varis,
                cikis: r.son_yukleme_cikis,
                sure: r.toplam_bekleme_dk,
            });
        });

        return Object.values(plakaMap).map((p) => ({
            ...p,
            projeler: [...p.projeler].filter(Boolean).join(", "),
        }));
    }, [dailyViolationRows]);

    const dailyKpis = useMemo(() => {
        const totalViolations = dailyViolationRows.length;
        const totalViolationTime = dailyViolationRows.reduce((sum, row) => sum + row.toplam_bekleme_dk, 0);
        const avgViolationTime = totalViolations > 0 ? totalViolationTime / totalViolations : 0;

        return {
            totalViolations,
            totalViolationTime: minToHM(totalViolationTime),
            avgViolationTime: minToHM(avgViolationTime),
            uniquePlates: new Set(dailyViolationRows.map((r) => r.plaka)).size,
        };
    }, [dailyViolationRows]);

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
    // (5) EXCEL EXPORT
    // ======================================================
    const exportDailyViolationExcel = async () => {
        if (!dailyPlateAnalysis.length) return;

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Gunluk-Haftalik-Aylik");

        const data = dailyPlateAnalysis.flatMap((p) =>
            p.detaylar.map((d) => ({
                sefer_no: d.sefer_no,
                plaka: d.plaka,
                treyler: d.treyler || "",
                sofor: d.sofor,
                proje: d.proje,
                yukleme_noktasi: d.yukleme_noktasi,
                yukleme_ili: d.yukleme_ili || "",
                teslim_noktasi: d.teslim_noktasi || "",
                teslim_ili: d.teslim_ili || "",
                teslim_ilcesi: d.teslim_ilcesi || "",
                varis_zamani: fmtDateTR(d.varis),
                cikis_zamani: fmtDateTR(d.cikis),
                bekleme_suresi: minToHM(d.sure),
                bekleme_dk: d.sure,
            }))
        );

        ws.columns = [
            { header: "SEFER NO", key: "sefer_no", width: 15 },
            { header: "PLAKA", key: "plaka", width: 12 },
            { header: "TREYLER", key: "treyler", width: 12 },
            { header: "ŞOFÖR", key: "sofor", width: 25 },
            { header: "PROJE", key: "proje", width: 20 },
            { header: "YÜKLEME NOKTASI", key: "yukleme_noktasi", width: 30 },
            { header: "YÜKLEME İLİ", key: "yukleme_ili", width: 15 },
            { header: "TESLİM NOKTASI", key: "teslim_noktasi", width: 30 },
            { header: "TESLİM İLİ", key: "teslim_ili", width: 15 },
            { header: "TESLİM İLÇESİ", key: "teslim_ilcesi", width: 18 },
            { header: "İLK VARIŞ", key: "varis_zamani", width: 20 },
            { header: "SON ÇIKIŞ", key: "cikis_zamani", width: 20 },
            { header: "BEKLEME SÜRESİ", key: "bekleme_suresi", width: 20 },
            { header: "BEKLEME (DK)", key: "bekleme_dk", width: 12, hidden: true },
        ];

        ws.addRows(data);

        ws.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
        });

        const buf = await wb.xlsx.writeBuffer();
        const name =
            dailyMode === "day"
                ? `gunluk_ihlalli_bekleme_${selectedDate}.xlsx`
                : dailyMode === "week"
                    ? `haftalik_ihlalli_bekleme_${selectedDailyMonth}_ilk_${selectedWeekCount}.xlsx`
                    : `aylik_ihlalli_bekleme_${selectedDailyMonth}.xlsx`;

        saveAs(new Blob([buf]), name);
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
            { header: "Performans Puanı (10)", key: "performans", width: 15 },
        ];

        performanceData.forEach((r) =>
            ws.addRow({
                ...r,
                toplamIhlalSuresi: r.toplamIhlalSuresi,
            })
        );

        ws.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
        });

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf]), `plaka_performans_${startDate}_${endDate}.xlsx`);
    };

    // ======================================================
    // Client-side filtered views
    // ======================================================
    const filteredDailyPlateAnalysis = useMemo(() => {
        const q = (qDaily || "").trim().toLowerCase();
        if (!q) return dailyPlateAnalysis;
        return dailyPlateAnalysis.filter((p) => {
            const hay = `${p.plaka} ${p.projeler}`.toLowerCase();
            return hay.includes(q);
        });
    }, [dailyPlateAnalysis, qDaily]);

    const filteredPerformanceData = useMemo(() => {
        const q = (qRange || "").trim().toLowerCase();
        if (!q) return performanceData;
        return performanceData.filter((p) => {
            const hay = `${p.plaka} ${p.projeler}`.toLowerCase();
            return hay.includes(q);
        });
    }, [performanceData, qRange]);

    // Optional: auto-fill month for tab 0 when switching mode (nice UX)
    useEffect(() => {
        if (dailyMode === "day") return;
        if (!selectedDailyMonth) setSelectedDailyMonth(dayjs().format("YYYY-MM"));
    }, [dailyMode, selectedDailyMonth]);

    // ======================================================
    // RENDER
    // ======================================================
    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: theme.palette.mode === "dark" ? "background.default" : "#f7f8fb",
                py: 3,
            }}
        >
            <Container maxWidth="xl">
                {/* Header */}
                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 4,
                        p: { xs: 2, md: 3 },
                        mb: 2.5,
                        border: "1px solid",
                        borderColor: "divider",
                        background:
                            theme.palette.mode === "dark"
                                ? "linear-gradient(135deg, rgba(25,118,210,0.18), rgba(0,0,0,0))"
                                : "linear-gradient(135deg, rgba(25,118,210,0.10), rgba(255,255,255,1))",
                    }}
                >
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>
                                🚀 Yüklemede Bekleme Performans Yönetimi
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, flexWrap: "wrap" }}>
                                <Chip size="small" color="error" label={`İhlal sınırı: ${minToHM(MINIMUM_WAIT_TIME_MINUTES)}`} />
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    icon={<DateRangeIcon />}
                                    label={tabValue === 0 ? dailyRangeLabel : `${startDate} → ${endDate}`}
                                />
                            </Stack>
                        </Box>

                        <Stack direction="row" spacing={1} alignItems="center">
                            <Chip size="small" variant="outlined" icon={<WarningIcon />} label="Anlık Analiz" />
                            <Chip size="small" variant="outlined" icon={<SpeedIcon />} label="Kümülatif Performans" />
                        </Stack>
                    </Stack>
                </Paper>

                {/* Tabs */}
                <Paper
                    elevation={0}
                    sx={{
                        mb: 2.5,
                        borderRadius: 3,
                        border: "1px solid",
                        borderColor: "divider",
                        overflow: "hidden",
                    }}
                >
                    <Tabs value={tabValue} onChange={handleTabChange} indicatorColor="primary" textColor="primary" centered>
                        <Tab label="Anlık İhlal Analizi" icon={<WarningIcon />} iconPosition="start" />
                        <Tab label="Kümülatif Plaka Performansı" icon={<SpeedIcon />} iconPosition="start" />
                    </Tabs>
                    {(loadingDaily || loadingRange) && <LinearProgress />}
                </Paper>

                {/* TAB 0 */}
                {tabValue === 0 && (
                    <Stack spacing={2.5}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: { xs: 2, md: 2.5 },
                                borderRadius: 3,
                                border: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Stack spacing={2}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                        📌 Analiz Tipi
                                    </Typography>
                                    <Chip size="small" variant="outlined" label={dailyRangeLabel} />
                                </Stack>

                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={4}>
                                        <TextField select fullWidth label="Mod" value={dailyMode} onChange={(e) => setDailyMode(e.target.value)}>
                                            <MenuItem value="day">Günlük</MenuItem>
                                            <MenuItem value="week">Haftalık (Ay + İlk N Hafta)</MenuItem>
                                            <MenuItem value="month">Aylık (Tüm Ay)</MenuItem>
                                        </TextField>
                                    </Grid>

                                    {(dailyMode === "week" || dailyMode === "month") && (
                                        <Grid item xs={12} md={4}>
                                            <TextField
                                                fullWidth
                                                type="month"
                                                label="Ay Seçin"
                                                value={selectedDailyMonth}
                                                onChange={(e) => setSelectedDailyMonth(e.target.value)}
                                                InputLabelProps={{ shrink: true }}
                                            />
                                        </Grid>
                                    )}

                                    {dailyMode === "week" && (
                                        <Grid item xs={12} md={4}>
                                            <TextField select fullWidth label="Kaç Haftası" value={selectedWeekCount} onChange={(e) => setSelectedWeekCount(e.target.value)}>
                                                <MenuItem value="1">İlk 1 Hafta</MenuItem>
                                                <MenuItem value="2">İlk 2 Hafta</MenuItem>
                                                <MenuItem value="3">İlk 3 Hafta</MenuItem>
                                                <MenuItem value="all">Tüm Ay</MenuItem>
                                            </TextField>
                                        </Grid>
                                    )}
                                </Grid>

                                {dailyMode === "day" && (
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={6}>
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
                                                    ),
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                )}

                                <Divider />

                                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        startIcon={<SearchIcon />}
                                        onClick={fetchDailyViolations}
                                        disabled={loadingDaily}
                                        sx={{ height: 52, borderRadius: 2.5, fontWeight: 900 }}
                                    >
                                        İhlalleri Getir
                                    </Button>

                                    <TextField
                                        fullWidth
                                        placeholder="Plaka / Proje ara…"
                                        value={qDaily}
                                        onChange={(e) => setQDaily(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Stack>
                            </Stack>
                        </Paper>

                        {!loadingDaily && dailyPlateAnalysis.length > 0 && (
                            <Grid container spacing={2.5}>
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
                                        subtitle="Seçilen aralıkta kaybedilen toplam süre."
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

                        {loadingDaily && (
                            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                                <Stack spacing={1.5}>
                                    <Typography sx={{ fontWeight: 800 }}>Veriler analiz ediliyor…</Typography>
                                    <Skeleton variant="rounded" height={44} />
                                    <Skeleton variant="rounded" height={44} />
                                    <Skeleton variant="rounded" height={44} />
                                </Stack>
                            </Paper>
                        )}

                        {!loadingDaily && dailyViolationRows.length === 0 && (
                            <Alert severity="success" sx={{ borderRadius: 3 }}>
                                Seçilen aralıkta <b>4 saat üzeri</b> bekleme ihlali tespit edilmemiştir.
                            </Alert>
                        )}

                        {!loadingDaily && dailyPlateAnalysis.length > 0 && (
                            <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
                                <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 900 }}>
                                            İhlal Dağılımı (Plaka Bazlı)
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Filtre kuralı: <b>yukleme_varis</b> seçilen aralık içinde + bekleme ≥ 4 saat
                                        </Typography>
                                    </Box>
                                    <Button
                                        startIcon={<FileDownloadIcon />}
                                        variant="outlined"
                                        color="error"
                                        onClick={exportDailyViolationExcel}
                                        sx={{ borderRadius: 2.5, fontWeight: 900 }}
                                    >
                                        Excel (Detay)
                                    </Button>
                                </Box>

                                <Divider />

                                <TableContainer sx={{ maxHeight: 520 }}>
                                    <Table stickyHeader size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: theme.palette.action.selected }}>
                                                <TableCell />
                                                <TableCell sx={{ fontWeight: 900 }}>Plaka</TableCell>
                                                <TableCell sx={{ fontWeight: 900 }}>Projeler</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    İhlalli Sefer
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    Toplam İhlal Süresi
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>{filteredDailyPlateAnalysis.map((p, idx) => <PlateRow p={p} idx={idx} key={p.plaka} />)}</TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        )}
                    </Stack>
                )}

                {/* TAB 1 */}
                {tabValue === 1 && (
                    <Stack spacing={2.5}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: { xs: 2, md: 2.5 },
                                borderRadius: 3,
                                border: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} md={3}>
                                    <TextField
                                        fullWidth
                                        type="month"
                                        label="Ay Seçin"
                                        value={selectedMonth}
                                        onChange={(e) => handleMonthChange(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>

                                <Grid item xs={12} md={3}>
                                    <TextField
                                        fullWidth
                                        type="date"
                                        label="Başlangıç Tarihi"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>

                                <Grid item xs={12} md={3}>
                                    <TextField
                                        fullWidth
                                        type="date"
                                        label="Bitiş Tarihi"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>

                                <Grid item xs={12} md={3}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        color="success"
                                        size="large"
                                        startIcon={<SearchIcon />}
                                        onClick={fetchRangePerformance}
                                        disabled={loadingRange}
                                        sx={{ height: 52, borderRadius: 2.5, fontWeight: 900 }}
                                    >
                                        Performansı Getir
                                    </Button>
                                </Grid>

                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        placeholder="Plaka / Proje ara…"
                                        value={qRange}
                                        onChange={(e) => setQRange(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </Paper>

                        {!loadingRange && performanceData.length > 0 && (
                            <Grid container spacing={2.5}>
                                <Grid item xs={12} md={3}>
                                    <KPICard
                                        title="Ortalama Performans"
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
                                        title="Analiz Edilen Plaka"
                                        value={rangeKpis.totalPlates}
                                        icon={DirectionsCarIcon}
                                        color={theme.palette.primary.main}
                                        subtitle="Farklı plaka adedi."
                                    />
                                </Grid>
                            </Grid>
                        )}

                        {loadingRange && (
                            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                                <Stack spacing={1.5}>
                                    <Typography sx={{ fontWeight: 800 }}>Performans verileri analiz ediliyor…</Typography>
                                    <Skeleton variant="rounded" height={44} />
                                    <Skeleton variant="rounded" height={44} />
                                    <Skeleton variant="rounded" height={44} />
                                </Stack>
                            </Paper>
                        )}

                        {!loadingRange && performanceData.length === 0 && (
                            <Alert severity="info" sx={{ borderRadius: 3 }}>
                                Seçilen aralıkta yükleme kaydı olan sefer bulunamadı veya analiz için yeterli veri yok.
                            </Alert>
                        )}

                        {!loadingRange && performanceData.length > 0 && (
                            <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
                                <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 900 }}>
                                            Plaka Performans Sıralaması
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Filtre kuralı: <b>yukleme_varis</b> seçilen aralık içinde
                                        </Typography>
                                    </Box>

                                    <Button
                                        startIcon={<FileDownloadIcon />}
                                        variant="outlined"
                                        color="success"
                                        onClick={exportPerformanceExcel}
                                        sx={{ borderRadius: 2.5, fontWeight: 900 }}
                                    >
                                        Excel (Özet)
                                    </Button>
                                </Box>

                                <Divider />

                                <TableContainer sx={{ maxHeight: 650 }}>
                                    <Table stickyHeader size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: theme.palette.action.selected }}>
                                                <TableCell sx={{ fontWeight: 900, width: "1%" }}>Detay</TableCell>
                                                <TableCell sx={{ fontWeight: 900 }}>Plaka</TableCell>
                                                <TableCell sx={{ fontWeight: 900 }}>Projeler</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    Toplam Sefer
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    İhlalli Sefer
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    İhlal Oranı
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    Toplam İhlal Süresi
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    Ceza (10)
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    Performans (10)
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>

                                        <TableBody>
                                            {filteredPerformanceData.map((p, idx) => (
                                                <PlatePerformanceRow p={p} idx={idx} key={p.plaka} />
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        )}
                    </Stack>
                )}

                <Box sx={{ py: 4 }} />
            </Container>
        </Box>
    );
}
