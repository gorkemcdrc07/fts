// src/raporlar/ProjeLokasyonRaporlari.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";

// MUI
import {
    Box,
    Container,
    Stack,
    Typography,
    Paper,
    Chip,
    Divider,
    IconButton,
    Tooltip,
    CircularProgress,
    Button,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TextField,
    alpha,
    useTheme,
    styled,
} from "@mui/material";
// DÜZELTME: Import yolu '@mui/material/Unstable_Grid2' yerine stabil olan '@mui/material/Grid' kullanıldı
import Grid from "@mui/material/Grid";

import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import AssessmentIcon from "@mui/icons-material/Assessment";

/* -------------------- Helpers -------------------- */
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => new Date().toISOString().slice(0, 10);
const shiftDays = (iso, delta) => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d + delta);
    return dt.toISOString().slice(0, 10);
};
const startOfMonthISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
const monthKey = (isoDate) => {
    if (!isoDate) return null;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const monthStartEndByKey = (k) => {
    const [y, m] = k.split("-").map(Number);
    const s = new Date(y, m - 1, 1);
    const e = new Date(y, m, 0);
    return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
};
const prevMonthKey = (k) => {
    const [y, m] = k.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return monthKey(d.toISOString().slice(0, 10));
};
const enumerateDates = (startIso, endIso, cap = 180) => {
    let cur = startIso;
    const out = [cur];
    for (let i = 0; i < cap && cur < endIso; i++) {
        cur = shiftDays(cur, 1);
        out.push(cur);
        if (cur === endIso) break;
    }
    return out;
};
const normTR = (s) => (s || "").toString().trim().toLocaleUpperCase("tr-TR");
const titleCaseTR = (s) =>
    (s || "")
        .toString()
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/\b\p{L}/gu, (c) => c.toLocaleUpperCase("tr-TR"));

const getRowDate = (r) => {
    const raw = r?.sefer_tarihi || r?.atama_tarihi || r?.kayit_zamani || r?.created_at || r?.tarih;
    const s = String(raw || "");
    return s.length >= 10 ? s.slice(0, 10) : "";
};
const getProject = (r) =>
    (r?.proje_adi || r?.proje || r?.projeAdi || r?.ProjeAdi || "—").toString().trim();

const getYuklemeIl = (r) =>
    (r?.yukleme_ili || r?.yukleme_il || r?.yükleme_ili || r?.YuklemeIl || r?.yukleme_il_adi || "—")
        .toString()
        .trim();
const getTeslimIl = (r) =>
    (r?.teslim_ili || r?.teslim_il || r?.TeslimIl || r?.teslim_il_adi || "—")
        .toString()
        .trim();

async function fetchAllRows(table) {
    const page = 1000;
    const head = await supabase.from(table).select("*", { count: "exact", head: true });
    if (head.error) return { rows: [], warn: `${table}: ${head.error.message || "erişilemedi"}` };
    const total = head.count ?? 0;
    if (!total) return { rows: [], warn: "" };
    const pages = Math.ceil(total / page);
    const out = [];
    for (let p = 0; p < pages; p++) {
        const from = p * page;
        const to = from + page - 1;
        const { data, error } = await supabase.from(table).select("*").range(from, to);
        if (error) return { rows: out, warn: `${table}: ${error.message}` };
        if (!data?.length) break;
        out.push(...data);
    }
    return { rows: out, warn: "" };
}

/* -------------------- Styled Components (Modern MUI Styling) -------------------- */
const StyledPaper = styled(Paper)(({ theme }) => ({
    borderRadius: theme.shape.borderRadius * 3, // Daha yuvarlak köşeler
    padding: theme.spacing(3), // Daha fazla padding
    backdropFilter: "saturate(140%) blur(8px)",
    backgroundColor:
        theme.palette.mode === "dark"
            ? alpha(theme.palette.background.paper, 0.8)
            : alpha(theme.palette.background.paper, 0.95),
    border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
    boxShadow: theme.shadows[4], // Daha belirgin gölge
    transition: "transform 0.3s ease-in-out",
    "&:hover": {
        transform: "translateY(-2px)",
    },
}));

const StyledPanel = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius * 2,
    backgroundColor:
        theme.palette.mode === "dark"
            ? alpha(theme.palette.grey[800], 0.6)
            : alpha(theme.palette.grey[100], 0.8),
    border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
    height: "100%", // Panellerin yüksekliği eşitleniyor
    display: "flex",
    flexDirection: "column",
}));

// Tablo satır stili
const rowSX = {
    height: 40,
    "& td, & th": {
        borderBottomColor: (t) => alpha(t.palette.text.primary, 0.12), // Koyu modda daha iyi görünmesi için
        verticalAlign: "middle",
        paddingTop: 0.5,
        paddingBottom: 0.5,
        lineHeight: 1.2,
    },
};
const nameCellSX = { whiteSpace: "nowrap", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" };

/* -------------------- Custom Components -------------------- */

// Basit Bar Liste
function BarList({ rows = [], max = 10, height = 24 }) {
    const data = rows.slice(0, max);
    const maxVal = Math.max(1, ...data.map((d) => d.value));
    const theme = useTheme();

    return (
        <Stack spacing={1.5} sx={{ pr: 1 }}>
            {data.map((d, i) => (
                <Stack key={d.key || i} direction="row" alignItems="center" spacing={2}>
                    <Typography sx={{ width: 24, fontWeight: 700, color: "text.secondary" }}>
                        {i + 1}.
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap title={d.key} variant="body2" sx={{ fontWeight: 600 }}>
                            {d.key || "—"}
                        </Typography>
                        <Tooltip title={`${d.key}: ${d.value} adet`}>
                            <Box sx={{ position: "relative", height, mt: 0.4, borderRadius: 1, bgcolor: "action.hover" }}>
                                <Box
                                    sx={{
                                        position: "absolute",
                                        inset: 0,
                                        width: `${(d.value / maxVal) * 100}%`,
                                        bgcolor: theme.palette.primary.light,
                                        borderRadius: 1,
                                        transition: "width 0.5s ease-out",
                                    }}
                                />
                            </Box>
                        </Tooltip>
                    </Box>
                    <Chip size="small" label={d.value} color="primary" variant="outlined" sx={{ minWidth: 40 }} />
                </Stack>
            ))}
        </Stack>
    );
}

// Donut Chart
function DonutChart({ data = [], size = 148, thickness = 22, title, subtitle }) {
    const theme = useTheme();
    const radius = size / 2;
    const inner = radius - thickness / 2;
    const C = size / 2;
    const total = data.reduce((a, c) => a + (c.value || 0), 0);
    let acc = -Math.PI / 2;
    const circumference = 2 * Math.PI * inner;

    // Paletteyi dize içinden almak yerine doğrudan prop'lardan alıyoruz
    const palette = [
        theme.palette.primary.main,
        theme.palette.info.main,
        theme.palette.warning.main,
        theme.palette.success.main,
        theme.palette.secondary.main,
        theme.palette.error.main,
        theme.palette.grey[500],
    ];

    return (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
            <svg width={size} height={size}>
                {/* Arka plan / Tam daire */}
                <circle
                    cx={C}
                    cy={C}
                    r={inner}
                    fill="none"
                    stroke={alpha(theme.palette.text.primary, 0.08)}
                    strokeWidth={thickness}
                />
                {/* Dilimler */}
                {data.map((d, i) => {
                    const val = d.value || 0;
                    const dashoffset = circumference - (val / (total || 1)) * circumference;
                    const stroke = d.color || palette[i % palette.length];

                    const el = (
                        <circle
                            key={d.label + i}
                            cx={C}
                            cy={C}
                            r={inner}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={thickness}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashoffset}
                            strokeLinecap="round"
                            style={{
                                transformOrigin: "center",
                                transform: `rotate(${acc * (180 / Math.PI)}deg)`,
                                transition: "stroke-dashoffset 0.5s ease-out, transform 0.5s ease-out",
                            }}
                        />
                    );
                    acc += (val / (total || 1)) * Math.PI * 2;
                    return el;
                })}
            </svg>

            {/* Merkez metin */}
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    px: 1,
                }}
            >
                {title ? (
                    <Typography variant="body2" sx={{ opacity: 0.75, lineHeight: 1 }}>
                        {title}
                    </Typography>
                ) : null}
                <Typography variant="h5" fontWeight={900}>
                    {total}
                </Typography>
                {subtitle ? (
                    <Typography variant="caption" sx={{ opacity: 0.75, lineHeight: 1 }}>
                        {subtitle}
                    </Typography>
                ) : null}
            </Box>
        </Box>
    );
}

// Sparkline Chart (Mini çizgi grafik)
function Sparkline({ points = [], width = 260, height = 80 }) {
    const theme = useTheme();
    const max = Math.max(1, ...points);
    const step = points.length > 1 ? width / (points.length - 1) : width;
    const padding = 6;

    const normalizedPoints = points.map((v) => height - padding - (v / max) * (height - 2 * padding));

    const path = normalizedPoints
        .map((y, i) => {
            const x = i * step;
            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

    const area = `${path} L ${width} ${height} L 0 ${height} Z`;

    const lastPoint = points.length > 0 ? normalizedPoints[normalizedPoints.length - 1] : height / 2;
    const lastX = points.length > 0 ? (points.length - 1) * step : width / 2;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <path d={area} fill={alpha(theme.palette.primary.main, 0.1)} style={{ transition: "all 0.5s" }} />
            <path d={path} fill="none" stroke={theme.palette.primary.main} strokeWidth={2.5} style={{ transition: "all 0.5s" }} />
            <circle cx={lastX} cy={lastPoint} r={4} fill={theme.palette.primary.main} />
        </svg>
    );
}

// CSV
function downloadCSV(filename, rows, headers) {
    const headerLine = headers.map((h) => `"${h.label}"`).join(",");
    const lines = rows.map((r) => headers.map((h) => `"${String(r[h.key] ?? "").replace(/"/g, '""')}"`).join(","));
    const BOM = "\ufeff";
    const csv = BOM + [headerLine, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* -------------------- Page -------------------- */
export default function ProjeLokasyonRaporlari() {
    // 💡 Hata Çözümü: Hook'u bileşenin en üst seviyesinde çağırın
    const theme = useTheme();

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [seferler, setSeferler] = useState([]);
    const [tamamlanan, setTamamlanan] = useState([]);

    const [mode, setMode] = useState("MONTH");
    const [month, setMonth] = useState(monthKey(todayISO()));
    const [startDate, setStartDate] = useState(startOfMonthISO());
    const [endDate, setEndDate] = useState(todayISO());

    const [selectedProject, setSelectedProject] = useState("");

    // DonutChart için renk paleti, theme objesini kullanıyor
    const donutChartColors = [
        theme.palette.primary.main,
        theme.palette.info.main,
        theme.palette.warning.main,
        theme.palette.success.main,
        theme.palette.secondary.main,
        theme.palette.error.main,
        theme.palette.grey[500], // Diğer
    ];

    // Veri çekme fonksiyonu
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setErr("");
            const [a, b] = await Promise.all([
                fetchAllRows("seferler"),
                fetchAllRows("tamamlanan_seferler"),
            ]);
            const warns = [a.warn, b.warn].filter(Boolean);
            if (warns.length) setErr(warns.join(" — "));
            setSeferler(a.rows || []);
            setTamamlanan(b.rows || []);
        } catch (e) {
            setErr(e?.message || "Veriler alınamadı.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const unified = useMemo(() => [...seferler, ...tamamlanan], [seferler, tamamlanan]);

    // Kullanılabilir tüm aylar
    const allMonths = useMemo(() => {
        const s = new Set();
        for (const r of unified) {
            const mk = monthKey(getRowDate(r));
            if (mk) s.add(mk);
        }
        return Array.from(s).sort().reverse();
    }, [unified]);

    // Tarih filtrelemesi
    const filteredRows = useMemo(() => {
        if (!unified.length) return [];
        if (mode === "MONTH") {
            if (!month) return [];
            return unified.filter((r) => monthKey(getRowDate(r)) === month);
        }
        const s = startDate;
        const e = endDate;
        if (!s || !e) return [];
        return unified.filter((r) => {
            const d = getRowDate(r);
            return d && d >= s && d <= e;
        });
    }, [unified, mode, month, startDate, endDate]);

    // Projelerin sayımı
    const projects = useMemo(() => {
        const m = new Map();
        for (const r of filteredRows) {
            const p = getProject(r) || "—";
            m.set(p, (m.get(p) || 0) + 1);
        }
        return Array.from(m.entries())
            .map(([proje, count]) => ({ proje, count }))
            .sort((a, b) => b.count - a.count || a.proje.localeCompare(b.proje, "tr"));
    }, [filteredRows]);

    // Seçili projeyi varsayılana ayarlama
    useEffect(() => {
        if (projects.length && !projects.some(p => p.proje === selectedProject)) {
            setSelectedProject(projects[0].proje);
        } else if (!projects.length) {
            setSelectedProject("");
        }
    }, [projects, selectedProject]);

    // Özet istatistikler
    const summary = useMemo(() => {
        const TOPLAM = filteredRows.length;
        const PROJE = projects.length;
        const days = new Map();
        for (const r of filteredRows) {
            const d = getRowDate(r);
            days.set(d, (days.get(d) || 0) + 1);
        }
        const peak = Array.from(days.entries()).sort((a, b) => b[1] - a[1])[0];
        return { TOPLAM, PROJE, PEAK_DAY: peak?.[0] || "—", PEAK_COUNT: peak?.[1] || 0 };
    }, [filteredRows, projects.length]);

    // Etkin tarih aralığı
    const effectiveRange = useMemo(() => {
        if (mode === "MONTH") {
            if (!month) return { start: todayISO(), end: todayISO() };
            return monthStartEndByKey(month);
        }
        return { start: startDate, end: endDate };
    }, [mode, month, startDate, endDate]);

    const dayNamesTR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cts", "Paz"];

    // Günlük - Tüm Projeler (Sparkline ve Tablo için)
    const dailyAll = useMemo(() => {
        const days = enumerateDates(effectiveRange.start, effectiveRange.end, 180);
        const map = new Map(days.map((d) => [d, { date: d, TOPLAM: 0 }]));
        const byDayProj = new Map();
        for (const r of filteredRows) {
            const d = getRowDate(r);
            if (!map.has(d)) continue;
            map.get(d).TOPLAM++;
            const p = getProject(r) || "—";
            if (!byDayProj.has(d)) byDayProj.set(d, new Map());
            const pm = byDayProj.get(d);
            pm.set(p, (pm.get(p) || 0) + 1);
        }
        for (const [d, row] of map.entries()) {
            const pm = byDayProj.get(d);
            if (pm) {
                const top = Array.from(pm.entries()).sort((a, b) => b[1] - a[1])[0];
                row.PEAK_PROJE = top?.[0] || "—";
                row.PEAK_SAYI = top?.[1] || 0;
            } else {
                row.PEAK_PROJE = "—";
                row.PEAK_SAYI = 0;
            }
            const wd = new Date(d + "T00:00:00").getDay();
            row.HAFTA_GUNU = dayNamesTR[(wd + 6) % 7];
        }
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }, [effectiveRange, filteredRows]);

    // Proje bazlı haftanın günü pivot tablosu
    const projectWeekdayAgg = useMemo(() => {
        const m = new Map();
        for (const r of filteredRows) {
            const p = getProject(r) || "—";
            const d = getRowDate(r);
            if (!d) continue;
            const wd = new Date(d + "T00:00:00").getDay();
            const idx = (wd + 6) % 7; // Pzt = 0, Paz = 6
            if (!m.has(p)) m.set(p, Array(7).fill(0));
            const arr = m.get(p);
            arr[idx] += 1;
        }
        const rows = Array.from(m.entries()).map(([proje, arr]) => {
            const maxVal = Math.max(...arr);
            const maxIdx = arr.findIndex(v => v === maxVal);
            return {
                proje,
                Pzt: arr[0],
                Sal: arr[1],
                "Çar": arr[2],
                Per: arr[3],
                Cum: arr[4],
                Cts: arr[5],
                Paz: arr[6],
                TOPLAM: arr.reduce((a, b) => a + b, 0),
                TEPE_GUN: maxVal > 0 ? dayNamesTR[maxIdx] : "—",
            };
        });
        rows.sort((a, b) => b.TOPLAM - a.TOPLAM || a.proje.localeCompare(b.proje, "tr"));
        return rows;
    }, [filteredRows]);

    // Günlük - Seçili Proje (Sparkline ve Tablo için)
    const dailyForProject = useMemo(() => {
        if (!selectedProject) return [];
        const days = enumerateDates(effectiveRange.start, effectiveRange.end, 180);
        const map = new Map(days.map((d) => [d, { date: d, ADET: 0 }]));
        for (const r of filteredRows) {
            const p = getProject(r);
            if (p !== selectedProject) continue;
            const d = getRowDate(r);
            if (!map.has(d)) continue;
            map.get(d).ADET++;
        }
        for (const row of map.values()) {
            const wd = new Date(row.date + "T00:00:00").getDay();
            row.HAFTA_GUNU = dayNamesTR[(wd + 6) % 7];
        }
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }, [effectiveRange, filteredRows, selectedProject]);

    // BarList ve Donut için TOP 10/5 projeler
    const topProjects = useMemo(
        () => projects.map((x) => ({ key: x.proje, value: x.count })),
        [projects]
    );

    // Genel Yükleme ve Teslim İl Dağılımı
    const overallLoadCities = useMemo(() => {
        const m = new Map();
        for (const r of filteredRows) {
            const il = titleCaseTR(normTR(getYuklemeIl(r)) || "—");
            m.set(il, (m.get(il) || 0) + 1);
        }
        return Array.from(m.entries())
            .map(([key, value]) => ({ key, value }))
            .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key, "tr"));
    }, [filteredRows]);

    const overallDelivCities = useMemo(() => {
        const m = new Map();
        for (const r of filteredRows) {
            const il = titleCaseTR(normTR(getTeslimIl(r)) || "—");
            m.set(il, (m.get(il) || 0) + 1);
        }
        return Array.from(m.entries())
            .map(([key, value]) => ({ key, value }))
            .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key, "tr"));
    }, [filteredRows]);

    // Seçili Proje Yükleme ve Teslim İl Dağılımı
    const projectLoadCities = useMemo(() => {
        if (!selectedProject) return [];
        const m = new Map();
        for (const r of filteredRows) {
            if (getProject(r) !== selectedProject) continue;
            const il = titleCaseTR(normTR(getYuklemeIl(r)) || "—");
            m.set(il, (m.get(il) || 0) + 1);
        }
        return Array.from(m.entries())
            .map(([key, value]) => ({ key, value }))
            .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key, "tr"));
    }, [filteredRows, selectedProject]);

    const projectDelivCities = useMemo(() => {
        if (!selectedProject) return [];
        const m = new Map();
        for (const r of filteredRows) {
            if (getProject(r) !== selectedProject) continue;
            const il = titleCaseTR(normTR(getTeslimIl(r)) || "—");
            m.set(il, (m.get(il) || 0) + 1);
        }
        return Array.from(m.entries())
            .map(([key, value]) => ({ key, value }))
            .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key, "tr"));
    }, [filteredRows, selectedProject]);

    // Son güncelleme zamanı
    const lastUpdated = useMemo(
        () =>
            new Date().toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            }),
        [filteredRows.length]
    );

    // Donut chart verileri
    const getDonutData = (dataArray) => {
        const top = dataArray.slice(0, 5);
        const topSum = top.reduce((a, c) => a + c.value, 0);
        const total = dataArray.reduce((a, c) => a + c.value, 0);
        const rest = Math.max(0, total - topSum);
        // Renklerin prop'lardan doğru atanması için
        const items = top.map((x, i) => ({ label: x.key, value: x.value, color: donutChartColors[i] }));
        if (rest > 0) items.push({ label: "Diğer", value: rest, color: donutChartColors[5] || theme.palette.grey[500] });
        return items;
    }

    const donutProjects = useMemo(() => getDonutData(topProjects), [topProjects, donutChartColors]);
    const donutLoadCities = useMemo(() => getDonutData(overallLoadCities), [overallLoadCities, donutChartColors]);
    const donutDelivCities = useMemo(() => getDonutData(overallDelivCities), [overallDelivCities, donutChartColors]);


    // Kısa yol buton fonksiyonları
    const setToday = () => {
        const t = todayISO();
        setMode("RANGE");
        setStartDate(t);
        setEndDate(t);
    };
    const setLast7 = () => {
        const e = todayISO();
        const s = shiftDays(e, -6);
        setMode("RANGE");
        setStartDate(s);
        setEndDate(e);
    };
    const setLast30 = () => {
        const e = todayISO();
        const s = shiftDays(e, -29);
        setMode("RANGE");
        setStartDate(s);
        setEndDate(e);
    };
    const setThisMonth = () => {
        setMode("MONTH");
        setMonth(monthKey(todayISO()));
    };
    const setPrevMonth = () => {
        const currentMonthKey = monthKey(todayISO());
        setMode("MONTH");
        setMonth(prevMonthKey(currentMonthKey));
    };

    return (
        <Box sx={{ display: "flex", minHeight: "100dvh" }}>
            <Helmet>
                <title>Proje & Lokasyon Raporları</title>
            </Helmet>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Üst Bar / Filtreler */}
                <Box
                    sx={{
                        py: { xs: 2, md: 3 },
                        background: (t) =>
                            t.palette.mode === "dark"
                                ? "linear-gradient(180deg,#0b1020,#0e1428)"
                                : "linear-gradient(180deg,#f6f9ff,#f4f7ff)",
                        position: "sticky",
                        top: 0,
                        zIndex: 1000,
                        borderBottom: (t) => `1px solid ${alpha(t.palette.text.primary, 0.08)}`,
                    }}
                >
                    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, maxWidth: "1600px" }}>
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            alignItems={{ xs: "flex-start", md: "center" }}
                            justifyContent="space-between"
                        >
                            <Box>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <AssessmentIcon color="primary" />
                                    <Typography variant="h5" fontWeight={900}>
                                        Proje & Lokasyon Raporları
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                                    <Chip
                                        size="small"
                                        color={mode === "MONTH" ? "info" : "primary"}
                                        variant={mode === "MONTH" ? "filled" : "outlined"}
                                        label={mode === "MONTH" ? month : `${startDate} → ${endDate}`}
                                    />
                                    <Chip size="small" variant="outlined" label={`Son güncelleme: ${lastUpdated}`} />
                                    {err && (
                                        <Tooltip title={err}>
                                            <Chip size="small" color="error" label="Veri Uyarısı/Eksik Tablo" />
                                        </Tooltip>
                                    )}
                                </Stack>
                            </Box>

                            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                                <Button size="small" onClick={setToday} variant="text">Bugün</Button>
                                <Button size="small" onClick={setLast7} variant="text">Son 7 Gün</Button>
                                <Button size="small" onClick={setLast30} variant="text">Son 30 Gün</Button>
                                <Button size="small" onClick={setThisMonth} variant="text">Bu Ay</Button>
                                <Button size="small" onClick={setPrevMonth} variant="text">Geçen Ay</Button>

                                <Tooltip title="Görünüm Modunu Değiştir">
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setMode((m) => (m === "MONTH" ? "RANGE" : "MONTH"))}
                                    >
                                        {mode === "MONTH" ? "Tarih Aralığı" : "Ay Görünümü"}
                                    </Button>
                                </Tooltip>

                                <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 28 }} />

                                {mode === "MONTH" && (
                                    <FormControl size="small" sx={{ minWidth: 140 }}>
                                        <InputLabel>Ay Seç</InputLabel>
                                        <Select label="Ay Seç" value={month || ""} onChange={(e) => setMonth(e.target.value)}>
                                            {allMonths.map((m) => (
                                                <MenuItem key={m} value={m}>
                                                    {m}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                )}

                                {mode === "RANGE" && (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <TextField
                                            size="small"
                                            type="date"
                                            label="Başlangıç"
                                            InputLabelProps={{ shrink: true }}
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            sx={{ maxWidth: 140 }}
                                        />
                                        <TextField
                                            size="small"
                                            type="date"
                                            label="Bitiş"
                                            InputLabelProps={{ shrink: true }}
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            sx={{ maxWidth: 140 }}
                                        />
                                    </Stack>
                                )}

                                <FormControl size="small" sx={{ minWidth: 200 }}>
                                    <InputLabel>Proje Seç</InputLabel>
                                    <Select
                                        label="Proje Seç"
                                        value={selectedProject || ""}
                                        onChange={(e) => setSelectedProject(e.target.value)}
                                        displayEmpty
                                    >
                                        {projects.map((p) => (
                                            <MenuItem key={p.proje} value={p.proje}>
                                                {p.proje} <Typography variant="caption" sx={{ ml: 1, opacity: 0.7 }}>({p.count})</Typography>
                                            </MenuItem>
                                        ))}
                                        {projects.length === 0 && <MenuItem value="" disabled>Proje yok</MenuItem>}
                                    </Select>
                                </FormControl>

                                <Tooltip title="Verileri Yenile">
                                    <span>
                                        <IconButton onClick={fetchData} disabled={loading} color="primary">
                                            {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    </Container>
                </Box>

                {/* Dashboard İçeriği */}
                <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, maxWidth: "1600px", py: 4 }}>
                    {/* Özet Kartlar */}
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={3}>
                            <StyledPaper>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7, mb: 0.5 }}>
                                    Toplam Kayıt (filtre)
                                </Typography>
                                <Typography variant="h3" fontWeight={900}>
                                    {summary.TOPLAM.toLocaleString("tr-TR")}
                                </Typography>
                                <Chip size="small" variant="outlined" label={`${summary.PROJE} proje`} color="primary" sx={{ mt: 1 }} />
                            </StyledPaper>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <StyledPaper>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7, mb: 0.5 }}>
                                    En Yoğun Gün
                                </Typography>
                                <Typography variant="h4" fontWeight={800}>
                                    {summary.PEAK_DAY}
                                </Typography>
                                <Chip size="small" color="info" label={`${summary.PEAK_COUNT} kayıt`} sx={{ mt: 1 }} />
                            </StyledPaper>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <StyledPaper>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7, mb: 0.5 }}>
                                    En Çok Proje (TOP 1)
                                </Typography>
                                <Typography variant="h6" fontWeight={800} sx={{ height: 28, overflow: 'hidden' }}>
                                    {projects[0]?.proje || "—"}
                                </Typography>
                                <Chip size="small" color="success" label={`${projects[0]?.count || 0} adet`} sx={{ mt: 1 }} />
                            </StyledPaper>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <StyledPaper>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7, mb: 0.5 }}>
                                    Seçili Proje Kayıt Sayısı
                                </Typography>
                                <Typography variant="h4" fontWeight={800}>
                                    {projects.find((p) => p.proje === selectedProject)?.count?.toLocaleString("tr-TR") || 0}
                                </Typography>
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label={selectedProject || "Proje Seçiniz"}
                                    sx={{ mt: 1 }}
                                />
                            </StyledPaper>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 3, opacity: 0.1 }} />

                    {/* Donut Paneller */}
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={4}>
                            <StyledPanel sx={{ height: 360 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" flexGrow={1}>
                                    <Box flexGrow={1} pr={2}>
                                        <Typography variant="h6" fontWeight={800} mb={1}>
                                            Proje Payları (TOP 5 + Diğer)
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            {donutProjects.map((d, i) => (
                                                <Typography key={i} variant="body2">
                                                    <Box component="span" sx={{ color: d.color || 'text.secondary', fontWeight: 900 }}>
                                                        &bull;
                                                    </Box> {d.label} — <b>{d.value}</b>
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>
                                    <DonutChart data={donutProjects} title="Toplam" subtitle="kayıt" />
                                </Stack>
                            </StyledPanel>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <StyledPanel sx={{ height: 360 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" flexGrow={1}>
                                    <Box flexGrow={1} pr={2}>
                                        <Typography variant="h6" fontWeight={800} mb={1}>
                                            Yükleme İl Payları (TOP 5 + Diğer)
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            {donutLoadCities.map((d, i) => (
                                                <Typography key={i} variant="body2">
                                                    <Box component="span" sx={{ color: d.color || 'text.secondary', fontWeight: 900 }}>
                                                        &bull;
                                                    </Box> {d.label} — <b>{d.value}</b>
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>
                                    <DonutChart data={donutLoadCities} title="Toplam" subtitle="yükleme" />
                                </Stack>
                            </StyledPanel>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <StyledPanel sx={{ height: 360 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" flexGrow={1}>
                                    <Box flexGrow={1} pr={2}>
                                        <Typography variant="h6" fontWeight={800} mb={1}>
                                            Teslim İl Payları (TOP 5 + Diğer)
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            {donutDelivCities.map((d, i) => (
                                                <Typography key={i} variant="body2">
                                                    <Box component="span" sx={{ color: d.color || 'text.secondary', fontWeight: 900 }}>
                                                        &bull;
                                                    </Box> {d.label} — <b>{d.value}</b>
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>
                                    <DonutChart data={donutDelivCities} title="Toplam" subtitle="teslim" />
                                </Stack>
                            </StyledPanel>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 3, opacity: 0.1 }} />

                    {/* TOP Projeler + Pivot */}
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={5}>
                            <StyledPanel sx={{ height: 460 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                                    <Typography variant="h6" fontWeight={800}>
                                        En Çok Proje (TOP 10)
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `proje_top_10.csv`,
                                                topProjects.map((x) => ({ proje: x.key, adet: x.value })),
                                                [
                                                    { key: "proje", label: "Proje" },
                                                    { key: "adet", label: "Adet" },
                                                ]
                                            )
                                        }
                                        disabled={!topProjects.length}
                                    >
                                        CSV İndir
                                    </Button>
                                </Stack>
                                <Box sx={{ flex: 1, overflow: "auto", pr: 1 }}>
                                    <BarList rows={topProjects} />
                                </Box>
                            </StyledPanel>
                        </Grid>

                        <Grid item xs={12} md={7}>
                            <StyledPanel sx={{ height: 460 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                    <Typography variant="h6" fontWeight={800}>
                                        Proje ↔ Haftanın Günü (Tepe Gün)
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `proje_hafta_gunu_pivot.csv`,
                                                projectWeekdayAgg.map((r) => ({
                                                    proje: r.proje,
                                                    Pzt: r.Pzt,
                                                    Sal: r.Sal,
                                                    Car: r["Çar"],
                                                    Per: r.Per,
                                                    Cum: r.Cum,
                                                    Cts: r.Cts,
                                                    Paz: r.Paz,
                                                    TOPLAM: r.TOPLAM,
                                                    TEPE_GUN: r.TEPE_GUN,
                                                })),
                                                [
                                                    { key: "proje", label: "Proje" },
                                                    { key: "Pzt", label: "Pzt" },
                                                    { key: "Sal", label: "Sal" },
                                                    { key: "Car", label: "Çar" },
                                                    { key: "Per", label: "Per" },
                                                    { key: "Cum", label: "Cum" },
                                                    { key: "Cts", label: "Cts" },
                                                    { key: "Paz", label: "Paz" },
                                                    { key: "TOPLAM", label: "Toplam" },
                                                    { key: "TEPE_GUN", label: "Tepe Gün" },
                                                ]
                                            )
                                        }
                                        disabled={!projectWeekdayAgg.length}
                                    >
                                        CSV İndir
                                    </Button>
                                </Stack>

                                <Box sx={{ flex: 1, overflow: "auto" }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow sx={rowSX}>
                                                <TableCell>#</TableCell>
                                                <TableCell>Proje</TableCell>
                                                {dayNamesTR.map(d => <TableCell key={d} align="right">{d}</TableCell>)}
                                                <TableCell align="right">Toplam</TableCell>
                                                <TableCell align="right">Tepe Gün</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {projectWeekdayAgg.map((r, i) => (
                                                <TableRow
                                                    key={r.proje || i}
                                                    sx={{
                                                        ...rowSX,
                                                        bgcolor: r.proje === selectedProject ? alpha(theme.palette.info.light, 0.1) : 'inherit'
                                                    }}
                                                >
                                                    <TableCell width={32}>{i + 1}</TableCell>
                                                    <TableCell sx={{ ...nameCellSX, fontWeight: 600 }}>{r.proje || "—"}</TableCell>
                                                    {dayNamesTR.map(d => (
                                                        <TableCell
                                                            key={d}
                                                            align="right"
                                                            sx={{
                                                                fontWeight: r.TEPE_GUN === d ? 700 : 400,
                                                                color: r.TEPE_GUN === d ? 'primary.main' : 'text.primary',
                                                            }}
                                                        >
                                                            {r[d]}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell align="right">
                                                        <Chip size="small" color="primary" label={r.TOPLAM} sx={{ height: 22 }} />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" variant="outlined" label={r.TEPE_GUN} sx={{ height: 22 }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {projectWeekdayAgg.length === 0 && (
                                                <TableRow sx={rowSX}>
                                                    <TableCell colSpan={11}>
                                                        <Typography sx={{ opacity: 0.7 }}>Kayıt yok.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Box>
                            </StyledPanel>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 3, opacity: 0.1 }} />

                    {/* Günlük paneller */}
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <StyledPanel sx={{ height: 500 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                    <Typography variant="h6" fontWeight={800}>
                                        Günlük Toplam Kayıtlar (Tüm Projeler)
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `gunluk_tum_projeler.csv`,
                                                dailyAll.map((d) => ({
                                                    tarih: d.date,
                                                    hafta_gunu: d.HAFTA_GUNU,
                                                    toplam: d.TOPLAM,
                                                    en_cok_proje: d.PEAK_PROJE,
                                                    en_cok_sayi: d.PEAK_SAYI,
                                                })),
                                                [
                                                    { key: "tarih", label: "Tarih" },
                                                    { key: "hafta_gunu", label: "Hafta Günü" },
                                                    { key: "toplam", label: "Toplam" },
                                                    { key: "en_cok_proje", label: "En Çok Proje" },
                                                    { key: "en_cok_sayi", label: "Adet" },
                                                ]
                                            )
                                        }
                                        disabled={!dailyAll.length}
                                    >
                                        CSV İndir
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1, px: 1, textAlign: 'center' }}>
                                    <Sparkline points={dailyAll.map((d) => d.TOPLAM)} width={500} height={100} />
                                </Box>
                                <Box sx={{ mt: 2, flex: 1, overflow: "auto" }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow sx={rowSX}>
                                                <TableCell>Tarih</TableCell>
                                                <TableCell align="right">Hafta Günü</TableCell>
                                                <TableCell align="right">Toplam</TableCell>
                                                <TableCell>En Çok Proje</TableCell>
                                                <TableCell align="right">Adet</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dailyAll.map((d) => (
                                                <TableRow key={d.date} sx={rowSX}>
                                                    <TableCell sx={{ fontWeight: 600 }}>{d.date}</TableCell>
                                                    <TableCell align="right">{d.HAFTA_GUNU}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" color="primary" label={d.TOPLAM} sx={{ height: 22 }} />
                                                    </TableCell>
                                                    <TableCell sx={nameCellSX}>{d.PEAK_PROJE}</TableCell>
                                                    <TableCell align="right">{d.PEAK_SAYI}</TableCell>
                                                </TableRow>
                                            ))}
                                            {dailyAll.length === 0 && (
                                                <TableRow sx={rowSX}>
                                                    <TableCell colSpan={5}>
                                                        <Typography sx={{ opacity: 0.7 }}>Kayıt yok.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Box>
                            </StyledPanel>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <StyledPanel sx={{ height: 500 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                    <Typography variant="h6" fontWeight={800}>
                                        Günlük — **{selectedProject || "Proje Seçiniz"}**
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `gunluk_${(selectedProject || "proje").replace(/\s+/g, "_")}.csv`,
                                                dailyForProject.map((d) => ({
                                                    tarih: d.date,
                                                    hafta_gunu: d.HAFTA_GUNU,
                                                    adet: d.ADET,
                                                })),
                                                [
                                                    { key: "tarih", label: "Tarih" },
                                                    { key: "hafta_gunu", label: "Hafta Günü" },
                                                    { key: "adet", label: "Adet" },
                                                ]
                                            )
                                        }
                                        disabled={!selectedProject || !dailyForProject.length}
                                    >
                                        CSV İndir
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1, px: 1, textAlign: 'center' }}>
                                    <Sparkline points={dailyForProject.map((d) => d.ADET)} width={500} height={100} />
                                </Box>
                                <Box sx={{ mt: 2, flex: 1, overflow: "auto" }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow sx={rowSX}>
                                                <TableCell>Tarih</TableCell>
                                                <TableCell align="right">Hafta Günü</TableCell>
                                                <TableCell align="right">Adet</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dailyForProject.map((d) => (
                                                <TableRow key={d.date} sx={rowSX}>
                                                    <TableCell sx={{ fontWeight: 600 }}>{d.date}</TableCell>
                                                    <TableCell align="right">{d.HAFTA_GUNU}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" color="primary" label={d.ADET} sx={{ height: 22 }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {dailyForProject.length === 0 && (
                                                <TableRow sx={rowSX}>
                                                    <TableCell colSpan={3}>
                                                        <Typography sx={{ opacity: 0.7 }}>Kayıt yok veya proje seçili değil.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Box>
                            </StyledPanel>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 3, opacity: 0.1 }} />

                    {/* Lokasyon panelleri */}
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <StyledPanel sx={{ height: 460 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                                    <Typography variant="h6" fontWeight={800}>
                                        Yükleme İl Dağılımı (Tüm Projeler) — TOP 15
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `yukleme_il_top.csv`,
                                                overallLoadCities.map((x) => ({ il: x.key, adet: x.value })),
                                                [
                                                    { key: "il", label: "İl" },
                                                    { key: "adet", label: "Adet" },
                                                ]
                                            )
                                        }
                                        disabled={!overallLoadCities.length}
                                    >
                                        CSV İndir
                                    </Button>
                                </Stack>
                                <Box sx={{ flex: 1, overflow: "auto", pr: 1 }}>
                                    <BarList rows={overallLoadCities} max={15} />
                                </Box>
                            </StyledPanel>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <StyledPanel sx={{ height: 460 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                                    <Typography variant="h6" fontWeight={800}>
                                        Teslim İl Dağılımı (Tüm Projeler) — TOP 15
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `teslim_il_top.csv`,
                                                overallDelivCities.map((x) => ({ il: x.key, adet: x.value })),
                                                [
                                                    { key: "il", label: "İl" },
                                                    { key: "adet", label: "Adet" },
                                                ]
                                            )
                                        }
                                        disabled={!overallDelivCities.length}
                                    >
                                        CSV İndir
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1.5, flex: 1, overflow: "auto", pr: 1 }}>
                                    <BarList rows={overallDelivCities} max={15} />
                                </Box>
                            </StyledPanel>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 3, opacity: 0.1 }} />

                    {/* Seçili proje için lokasyonlar */}
                    <Grid container spacing={3} sx={{ pb: 4 }}>
                        <Grid item xs={12} md={6}>
                            <StyledPanel sx={{ height: 460 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                                    <Typography variant="h6" fontWeight={800}>
                                        **{selectedProject || "Proje"}** — Yükleme İl — TOP 15
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `yukleme_il_${(selectedProject || "proje").replace(/\s+/g, "_")}.csv`,
                                                projectLoadCities.map((x) => ({ il: x.key, adet: x.value })),
                                                [
                                                    { key: "il", label: "İl" },
                                                    { key: "adet", label: "Adet" },
                                                ]
                                            )
                                        }
                                        disabled={!selectedProject || !projectLoadCities.length}
                                    >
                                        CSV İndir
                                    </Button>
                                </Stack>
                                <Box sx={{ flex: 1, overflow: "auto", pr: 1 }}>
                                    <BarList rows={projectLoadCities} max={15} />
                                </Box>
                            </StyledPanel>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <StyledPanel sx={{ height: 460 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                                    <Typography variant="h6" fontWeight={800}>
                                        **{selectedProject || "Proje"}** — Teslim İl — TOP 15
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `teslim_il_${(selectedProject || "proje").replace(/\s+/g, "_")}.csv`,
                                                projectDelivCities.map((x) => ({ il: x.key, adet: x.value })),
                                                [
                                                    { key: "il", label: "İl" },
                                                    { key: "adet", label: "Adet" },
                                                ]
                                            )
                                        }
                                        disabled={!selectedProject || !projectDelivCities.length}
                                    >
                                        CSV İndir
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1.5, flex: 1, overflow: "auto", pr: 1 }}>
                                    <BarList rows={projectDelivCities} max={15} />
                                </Box>
                            </StyledPanel>
                        </Grid>
                    </Grid>
                </Container>
            </Box>
        </Box>
    );
}
