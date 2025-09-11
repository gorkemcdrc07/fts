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
} from "@mui/material";
import Grid from "@mui/material/Grid"; // ✅ Klasik Grid

import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";

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

// Basit bar liste
function BarList({ rows = [], max = 10, height = 18 }) {
    const data = rows.slice(0, max);
    const maxVal = Math.max(1, ...data.map((d) => d.value));
    return (
        <Stack spacing={1}>
            {data.map((d, i) => (
                <Stack key={d.key || i} direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ width: 28, opacity: 0.6 }}>{i + 1}.</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap title={d.key} sx={{ fontWeight: 700 }}>
                            {d.key || "—"}
                        </Typography>
                        <Box sx={{ position: "relative", height, mt: 0.4, borderRadius: 1, bgcolor: "action.hover" }}>
                            <Box
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    width: `${(d.value / maxVal) * 100}%`,
                                    bgcolor: "primary.main",
                                    borderRadius: 1,
                                }}
                            />
                        </Box>
                    </Box>
                    <Chip size="small" label={d.value} />
                </Stack>
            ))}
        </Stack>
    );
}

// CSV
function downloadCSV(filename, rows, headers) {
    const headerLine = headers.map((h) => `"${h.label}"`).join(",");
    const lines = rows.map((r) => headers.map((h) => `"${String(r[h.key] ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [headerLine, ...lines].join("\r\n");
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

/* -------------------- Mini Chart Components (SVG) -------------------- */
function DonutChart({ data = [], size = 148, thickness = 18, title, subtitle }) {
    const theme = useTheme();
    const radius = size / 2;
    const inner = radius - thickness;
    const C = size / 2;
    const total = data.reduce((a, c) => a + (c.value || 0), 0);
    let acc = 0;
    const palette = [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.info.main,
        theme.palette.error.main,
    ];

    return (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
            <svg width={size} height={size}>
                {/* Arka plan */}
                <circle cx={C} cy={C} r={inner} fill="none" stroke={alpha(theme.palette.text.primary, 0.08)} strokeWidth={thickness} />
                {/* Dilimler */}
                {data.map((d, i) => {
                    const val = d.value || 0;
                    const angle = (val / (total || 1)) * Math.PI * 2;
                    const x1 = C + inner * Math.cos(acc);
                    const y1 = C + inner * Math.sin(acc);
                    const x2 = C + inner * Math.cos(acc + angle);
                    const y2 = C + inner * Math.sin(acc + angle);
                    const large = angle > Math.PI ? 1 : 0;
                    const path = `M ${x1} ${y1} A ${inner} ${inner} 0 ${large} 1 ${x2} ${y2}`;
                    const stroke = d.color || palette[i % palette.length];
                    const el = <path key={d.label + i} d={path} stroke={stroke} strokeWidth={thickness} fill="none" />;
                    acc += angle;
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
                    <Typography variant="body2" sx={{ opacity: 0.75 }}>
                        {title}
                    </Typography>
                ) : null}
                <Typography variant="h6" fontWeight={900}>
                    {total}
                </Typography>
                {subtitle ? (
                    <Typography variant="caption" sx={{ opacity: 0.75 }}>
                        {subtitle}
                    </Typography>
                ) : null}
            </Box>
        </Box>
    );
}

function Sparkline({ points = [], width = 260, height = 80 }) {
    const theme = useTheme();
    const max = Math.max(1, ...points);
    const step = points.length > 1 ? width / (points.length - 1) : width;
    const path = points
        .map((v, i) => {
            const x = i * step;
            const y = height - (v / max) * (height - 6) - 3;
            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

    const area = `${path} L ${width} ${height} L 0 ${height} Z`;

    return (
        <svg width={width} height={height}>
            <path d={area} fill={alpha(theme.palette.primary.main, 0.18)} />
            <path d={path} fill="none" stroke={theme.palette.primary.main} strokeWidth={2} />
        </svg>
    );
}

/* -------------------- Styles -------------------- */
const cardSX = {
    borderRadius: 3,
    p: 2,
    backdropFilter: "saturate(140%) blur(8px)",
    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
    border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
};
const panelSX = {
    p: 2,
    borderRadius: 3,
    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
    border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
};
const rowSX = {
    height: 40,
    "& td, & th": {
        borderBottomColor: "rgba(255,255,255,0.08)",
        verticalAlign: "middle",
        paddingTop: 0.5,
        paddingBottom: 0.5,
        lineHeight: 1.2,
    },
};
const nameCellSX = { whiteSpace: "nowrap", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" };

/* -------------------- Page -------------------- */
export default function ProjeLokasyonRaporlari() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [seferler, setSeferler] = useState([]);
    const [tamamlanan, setTamamlanan] = useState([]);

    const [mode, setMode] = useState("MONTH"); // 'MONTH' | 'RANGE'
    const [month, setMonth] = useState(monthKey(todayISO()));
    const [startDate, setStartDate] = useState(startOfMonthISO());
    const [endDate, setEndDate] = useState(todayISO());

    const [selectedProject, setSelectedProject] = useState("");

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setErr("");
            const a = await fetchAllRows("seferler");
            const b = await fetchAllRows("tamamlanan_seferler");
            const warns = [a.warn, b.warn].filter(Boolean);
            if (warns.length) setErr(warns.join("  "));
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

    const allMonths = useMemo(() => {
        const s = new Set();
        for (const r of unified) {
            const mk = monthKey(getRowDate(r));
            if (mk) s.add(mk);
        }
        return Array.from(s).sort().reverse();
    }, [unified]);

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

    useEffect(() => {
        if (!selectedProject && projects.length) setSelectedProject(projects[0].proje);
    }, [projects, selectedProject]);

    const summary = useMemo(() => {
        const TOPLAM = filteredRows.length;
        const PROJE = projects.length;
        const days = new Map();
        for (const r of filteredRows) {
            const d = getRowDate(r);
            days.set(d, (days.get(d) || 0) + 1);
        }
        const peak = Array.from(days.entries()).sort((a, b) => b[1] - a[1])[0];
        return { TOPLAM, PROJE, PEAK_DAY: peak?.[0] || "-", PEAK_COUNT: peak?.[1] || 0 };
    }, [filteredRows, projects.length]);

    const effectiveRange = useMemo(() => {
        if (mode === "MONTH") {
            const { start, end } = monthStartEndByKey(month);
            return { start, end };
        }
        return { start: startDate, end: endDate };
    }, [mode, month, startDate, endDate]);

    const dayNamesTR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cts", "Paz"];

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
            if (!pm) {
                row.PEAK_PROJE = "—";
                row.PEAK_SAYI = 0;
            } else {
                const top = Array.from(pm.entries()).sort((a, b) => b[1] - a[1])[0];
                row.PEAK_PROJE = top?.[0] || "—";
                row.PEAK_SAYI = top?.[1] || 0;
            }
            const wd = new Date(d + "T00:00:00").getDay();
            row.HAFTA_GUNU = dayNamesTR[(wd + 6) % 7];
        }
        return Array.from(map.values());
    }, [effectiveRange, filteredRows]);

    const projectWeekdayAgg = useMemo(() => {
        const m = new Map();
        for (const r of filteredRows) {
            const p = getProject(r) || "—";
            const d = getRowDate(r);
            if (!d) continue;
            const wd = new Date(d + "T00:00:00").getDay();
            const idx = (wd + 6) % 7;
            if (!m.has(p)) m.set(p, Array(7).fill(0));
            const arr = m.get(p);
            arr[idx] += 1;
        }
        const rows = Array.from(m.entries()).map(([proje, arr]) => {
            const maxIdx = arr.reduce((mi, v, i, a) => (v > a[mi] ? i : mi), 0);
            return {
                proje,
                Pzt: arr[0],
                Sal: arr[1],
                Çar: arr[2],
                Per: arr[3],
                Cum: arr[4],
                Cts: arr[5],
                Paz: arr[6],
                TOPLAM: arr.reduce((a, b) => a + b, 0),
                TEPE_GUN: dayNamesTR[maxIdx],
            };
        });
        rows.sort((a, b) => b.TOPLAM - a.TOPLAM || a.proje.localeCompare(b.proje, "tr"));
        return rows;
    }, [filteredRows]);

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
        return Array.from(map.values());
    }, [effectiveRange, filteredRows, selectedProject]);

    const topProjects = useMemo(
        () => projects.map((x) => ({ key: x.proje, value: x.count })),
        [projects]
    );

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

    const lastUpdated = useMemo(
        () =>
            new Date().toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            }),
        [filteredRows.length]
    );

    const donutProjects = useMemo(() => {
        const top = projects.slice(0, 5);
        const topSum = top.reduce((a, c) => a + c.count, 0);
        const rest = Math.max(0, filteredRows.length - topSum);
        const items = top.map((p) => ({ label: p.proje, value: p.count }));
        if (rest > 0) items.push({ label: "Diğer", value: rest });
        return items;
    }, [projects, filteredRows.length]);

    const donutLoadCities = useMemo(() => {
        const top = overallLoadCities.slice(0, 5);
        const topSum = top.reduce((a, c) => a + c.value, 0);
        const rest = Math.max(0, overallLoadCities.reduce((a, c) => a + c.value, 0) - topSum);
        const items = top.map((x) => ({ label: x.key, value: x.value }));
        if (rest > 0) items.push({ label: "Diğer", value: rest });
        return items;
    }, [overallLoadCities]);

    const donutDelivCities = useMemo(() => {
        const top = overallDelivCities.slice(0, 5);
        const topSum = top.reduce((a, c) => a + c.value, 0);
        const rest = Math.max(0, overallDelivCities.reduce((a, c) => a + c.value, 0) - topSum);
        const items = top.map((x) => ({ label: x.key, value: x.value }));
        if (rest > 0) items.push({ label: "Diğer", value: rest });
        return items;
    }, [overallDelivCities]);

    // Shortcuts
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
        setMode("MONTH");
        setMonth(prevMonthKey(monthKey(todayISO())));
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
                    }}
                >
                    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, maxWidth: "1600px" }}>
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={1.2}
                            alignItems={{ xs: "flex-start", md: "center" }}
                            justifyContent="space-between"
                        >
                            <Box>
                                <Typography variant="h5" fontWeight={900}>
                                    Proje & Lokasyon Raporları
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                                    <Chip
                                        size="small"
                                        color={mode === "MONTH" ? "info" : "default"}
                                        variant={mode === "MONTH" ? "filled" : "outlined"}
                                        label={mode === "MONTH" ? month : `${startDate} → ${endDate}`}
                                    />
                                    <Chip size="small" variant="outlined" label={`Son güncelleme: ${lastUpdated}`} />
                                    {err && <Chip size="small" color="error" label="Uyarı / Eksik tablo" />}
                                </Stack>
                            </Box>

                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Button size="small" onClick={setToday}>Bugün</Button>
                                <Button size="small" onClick={setLast7}>Son 7 Gün</Button>
                                <Button size="small" onClick={setLast30}>Son 30 Gün</Button>
                                <Button size="small" onClick={setThisMonth}>Bu Ay</Button>
                                <Button size="small" onClick={setPrevMonth}>Geçen Ay</Button>

                                {mode === "MONTH" && (
                                    <FormControl size="small" sx={{ minWidth: 180 }}>
                                        <InputLabel>Ay</InputLabel>
                                        <Select label="Ay" value={month || ""} onChange={(e) => setMonth(e.target.value)}>
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
                                        />
                                        <TextField
                                            size="small"
                                            type="date"
                                            label="Bitiş"
                                            InputLabelProps={{ shrink: true }}
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </Stack>
                                )}

                                <FormControl size="small" sx={{ minWidth: 220 }}>
                                    <InputLabel>Proje</InputLabel>
                                    <Select
                                        label="Proje"
                                        value={selectedProject || ""}
                                        onChange={(e) => setSelectedProject(e.target.value)}
                                    >
                                        {projects.map((p) => (
                                            <MenuItem key={p.proje} value={p.proje}>
                                                {p.proje} &nbsp;—&nbsp; {p.count}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <Tooltip title="Görünüm: Ay / Aralık">
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setMode((m) => (m === "MONTH" ? "RANGE" : "MONTH"))}
                                    >
                                        {mode === "MONTH" ? "Tarih Aralığı" : "Ay Görünümü"}
                                    </Button>
                                </Tooltip>

                                <Tooltip title="Yenile">
                                    <span>
                                        <IconButton onClick={fetchData} disabled={loading} color="primary">
                                            {loading ? <CircularProgress size={18} /> : <RefreshIcon />}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    </Container>
                </Box>

                {/* Dashboard */}
                <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, maxWidth: "1600px", py: 2 }}>
                    {/* Özet Kartlar */}
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                            <Paper elevation={6} sx={cardSX}>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                                    Toplam Kayıt (filtre)
                                </Typography>
                                <Typography variant="h4" fontWeight={900} sx={{ mt: 0.25 }}>
                                    {summary.TOPLAM}
                                </Typography>
                                <Chip size="small" variant="outlined" label={`${summary.PROJE} proje`} sx={{ mt: 1 }} />
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <Paper elevation={6} sx={cardSX}>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                                    En Yoğun Gün (tümü)
                                </Typography>
                                <Typography variant="h6" fontWeight={800} sx={{ mt: 0.25 }}>
                                    {summary.PEAK_DAY}
                                </Typography>
                                <Chip size="small" color="info" label={`${summary.PEAK_COUNT} kayıt`} sx={{ mt: 1 }} />
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <Paper elevation={6} sx={cardSX}>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                                    En Çok Proje (TOP 1)
                                </Typography>
                                <Typography variant="h6" fontWeight={800} sx={{ mt: 0.25 }}>
                                    {projects[0]?.proje || "—"}
                                </Typography>
                                <Chip size="small" label={`${projects[0]?.count || 0} adet`} sx={{ mt: 1 }} />
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <Paper elevation={6} sx={cardSX}>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                                    Seçili Proje
                                </Typography>
                                <Typography variant="h6" fontWeight={800} sx={{ mt: 0.25 }}>
                                    {selectedProject || "—"}
                                </Typography>
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`${projects.find((p) => p.proje === selectedProject)?.count || 0} adet`}
                                    sx={{ mt: 1 }}
                                />
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Donut Paneller */}
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} md={4}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 300, display: "flex", alignItems: "center", justifyContent: "space-between", px: 3 }}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Proje Payları (TOP 5 + Diğer)
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                        Filtrelenen kayıtlar içinde
                                    </Typography>
                                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                                        {donutProjects.slice(0, 6).map((d, i) => (
                                            <Typography key={i} variant="body2">
                                                • {d.label} — <b>{d.value}</b>
                                            </Typography>
                                        ))}
                                    </Stack>
                                </Box>
                                <DonutChart data={donutProjects} title="Toplam" subtitle="kayıt" />
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 300, display: "flex", alignItems: "center", justifyContent: "space-between", px: 3 }}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Yükleme İli Payları (TOP 5 + Diğer)
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                        Tüm veride, filtre bazında
                                    </Typography>
                                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                                        {donutLoadCities.slice(0, 6).map((d, i) => (
                                            <Typography key={i} variant="body2">
                                                • {d.label} — <b>{d.value}</b>
                                            </Typography>
                                        ))}
                                    </Stack>
                                </Box>
                                <DonutChart data={donutLoadCities} title="Toplam" subtitle="yükleme" />
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 300, display: "flex", alignItems: "center", justifyContent: "space-between", px: 3 }}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Teslim İli Payları (TOP 5 + Diğer)
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                        Tüm veride, filtre bazında
                                    </Typography>
                                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                                        {donutDelivCities.slice(0, 6).map((d, i) => (
                                            <Typography key={i} variant="body2">
                                                • {d.label} — <b>{d.value}</b>
                                            </Typography>
                                        ))}
                                    </Stack>
                                </Box>
                                <DonutChart data={donutDelivCities} title="Toplam" subtitle="teslim" />
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* TOP Projeler + Pivot */}
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} md={5}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        En çok proje (TOP 10)
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
                                    >
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1.5, flex: 1, overflow: "auto" }}>
                                    <BarList rows={topProjects} />
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={7}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Proje ↔ Haftanın Günü (tepe gün işaretli)
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
                                    >
                                        CSV
                                    </Button>
                                </Stack>

                                <Box sx={{ mt: 1, flex: 1, overflow: "auto" }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow sx={rowSX}>
                                                <TableCell>#</TableCell>
                                                <TableCell>Proje</TableCell>
                                                <TableCell align="right">Pzt</TableCell>
                                                <TableCell align="right">Sal</TableCell>
                                                <TableCell align="right">Çar</TableCell>
                                                <TableCell align="right">Per</TableCell>
                                                <TableCell align="right">Cum</TableCell>
                                                <TableCell align="right">Cts</TableCell>
                                                <TableCell align="right">Paz</TableCell>
                                                <TableCell align="right">Toplam</TableCell>
                                                <TableCell align="right">Tepe Gün</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {projectWeekdayAgg.map((r, i) => (
                                                <TableRow key={r.proje || i} sx={rowSX}>
                                                    <TableCell width={32}>{i + 1}</TableCell>
                                                    <TableCell sx={nameCellSX}>{r.proje || "—"}</TableCell>
                                                    <TableCell align="right">{r.Pzt}</TableCell>
                                                    <TableCell align="right">{r.Sal}</TableCell>
                                                    <TableCell align="right">{r["Çar"]}</TableCell>
                                                    <TableCell align="right">{r.Per}</TableCell>
                                                    <TableCell align="right">{r.Cum}</TableCell>
                                                    <TableCell align="right">{r.Cts}</TableCell>
                                                    <TableCell align="right">{r.Paz}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" color="info" label={r.TOPLAM} sx={{ height: 22 }} />
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
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Günlük paneller */}
                    <Divider sx={{ my: 3, opacity: 0.2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Günlük — Tüm projeler (o gün en çok proje)
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
                                    >
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1, px: 1 }}>
                                    <Sparkline points={dailyAll.map((d) => d.TOPLAM)} />
                                </Box>
                                <Box sx={{ mt: 1, flex: 1, overflow: "auto" }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow sx={rowSX}>
                                                <TableCell>Tarih</TableCell>
                                                <TableCell align="right">Hafta Günü</TableCell>
                                                <TableCell align="right">Toplam</TableCell>
                                                <TableCell>O gün en çok</TableCell>
                                                <TableCell align="right">Adet</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dailyAll.map((d) => (
                                                <TableRow key={d.date} sx={rowSX}>
                                                    <TableCell>{d.date}</TableCell>
                                                    <TableCell align="right">{d.HAFTA_GUNU}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" color="info" label={d.TOPLAM} sx={{ height: 22 }} />
                                                    </TableCell>
                                                    <TableCell>{d.PEAK_PROJE}</TableCell>
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
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Günlük — {selectedProject || "Proje seçiniz"}
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
                                        disabled={!selectedProject}
                                    >
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1, px: 1 }}>
                                    <Sparkline points={dailyForProject.map((d) => d.ADET)} />
                                </Box>
                                <Box sx={{ mt: 1, flex: 1, overflow: "auto" }}>
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
                                                    <TableCell>{d.date}</TableCell>
                                                    <TableCell align="right">{d.HAFTA_GUNU}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" color="info" label={d.ADET} sx={{ height: 22 }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {dailyForProject.length === 0 && (
                                                <TableRow sx={rowSX}>
                                                    <TableCell colSpan={3}>
                                                        <Typography sx={{ opacity: 0.7 }}>Kayıt yok.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Lokasyon panelleri */}
                    <Divider sx={{ my: 3, opacity: 0.2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Yükleme İl dağılımı (tümü) — TOP 15
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
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1.5, flex: 1, overflow: "auto" }}>
                                    <BarList rows={overallLoadCities} max={15} />
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Teslim İl dağılımı (tümü) — TOP 15
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
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1.5, flex: 1, overflow: "auto" }}>
                                    <BarList rows={overallDelivCities} max={15} />
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Seçili proje için lokasyonlar */}
                    <Grid container spacing={2} sx={{ mt: 0.5, pb: 4 }}>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        {selectedProject || "Proje"} — Yükleme İl — TOP 15
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
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1.5, flex: 1, overflow: "auto" }}>
                                    <BarList rows={projectLoadCities} max={15} />
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        {selectedProject || "Proje"} — Teslim İl — TOP 15
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
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1.5, flex: 1, overflow: "auto" }}>
                                    <BarList rows={projectDelivCities} max={15} />
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>
        </Box>
    );
}
