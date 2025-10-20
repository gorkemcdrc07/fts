// src/raporlar/kpiOlcumu.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";

// MUI
import {
    Box, Container, Stack, Typography, Grid, Paper, Chip, Divider,
    IconButton, Tooltip, Button, MenuItem, Select,
    FormControl, InputLabel, Table, TableHead, TableRow, TableCell,
    TableBody, TextField, useTheme, LinearProgress, CircularProgress
} from "@mui/material";
// Icons
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import AnalyticsIcon from '@mui/icons-material/Analytics';
import WeekendIcon from "@mui/icons-material/Weekend";
import FlashOnIcon from '@mui/icons-material/FlashOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PercentIcon from '@mui/icons-material/Percent';
import BadgeIcon from '@mui/icons-material/Badge';
import InsightsIcon from '@mui/icons-material/Insights';


// ---------- Helpers (Yardımcı Fonksiyonlar) ----------

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
const humanMonth = (k) => {
    if (!k) return "-";
    const [y, m] = k.split("-");
    const dt = new Date(Number(y), Number(m) - 1, 1);
    return dt.toLocaleDateString("tr-TR", { year: "numeric", month: "long" });
};
const enumerateDates = (startIso, endIso, cap = 120) => {
    let cur = startIso;
    const out = [];
    const maxDays = Math.min(cap, Math.ceil((new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60 * 60 * 24)) + 1);
    for (let i = 0; i < maxDays && cur <= endIso; i++) {
        out.push(cur);
        cur = shiftDays(cur, 1);
    }
    return out;
};
const getAssignDate = (r) => {
    const raw =
        r?.atama_tarihi || r?.sefer_tarihi || r?.kayit_zamani || r?.created_at || r?.tarih;
    const s = String(raw || "");
    return s.length >= 10 ? s.slice(0, 10) : "";
};
const getUser = (r) =>
    (r?.atama_yapan_kullanici || r?.TMSDespatchCreatedBy || "—").toString().trim();
const getPrefix = (r) => {
    const s = (r?.sefer_no || "").toString().trim().toUpperCase();
    if (s.startsWith("BOS")) return "BOS";
    if (s.startsWith("SFR")) return "SFR";
    return "DİĞER";
};
// TR büyük/küçük duyarlı normalize
const normTR = (s) => (s || "").toString().trim().toLocaleUpperCase("tr-TR");

const getAdder = (r) =>
    (r?.ekleyen_kullanici || r?.ekleyen || r?.created_by || "—").toString().trim();
const getAddDate = (r) => {
    const raw = r?.eklenme_tarihi || r?.kayit_zamani || r?.created_at || r?.tarih;
    const s = String(raw || "");
    return s.length >= 10 ? s.slice(0, 10) : "";
};

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

function BarList({ rows = [], max = 10, onItemClick, selectedItem, valueLabel = 'Toplam' }) {
    const theme = useTheme();
    const data = rows.slice(0, max);
    const maxVal = Math.max(1, ...data.map((d) => d.value));
    return (
        <Stack spacing={1} sx={{ mt: 1 }}>
            {data.map((d, i) => (
                <Paper
                    key={d.key || i}
                    elevation={selectedItem === d.key ? 6 : 0}
                    onClick={() => onItemClick(d.key)}
                    sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        borderRadius: 2,
                        transition: 'all 0.3s ease-out, box-shadow 0.3s',
                        bgcolor: selectedItem === d.key ? (theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200]) : 'transparent',
                        '&:hover': {
                            bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100],
                        }
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography sx={{ width: 20, opacity: 0.8, fontSize: 13, fontWeight: 700 }}>{i + 1}.</Typography>
                        <Box sx={{ flex: 1 }}>
                            <Typography noWrap title={d.key} sx={{ fontWeight: 600, fontSize: 14, color: 'text.primary' }}>
                                {d.key || "—"}
                            </Typography>
                            {/* Ek Detaylar */}
                            {d.subValue !== undefined && d.subLabel && (
                                <Typography variant="caption" sx={{ opacity: 0.7, color: d.subColor || theme.palette.text.secondary }}>
                                    {d.subLabel}: {d.subValue}
                                </Typography>
                            )}
                        </Box>
                        <Tooltip title={valueLabel}>
                            <Chip size="small" label={d.value} color="primary" variant="filled" sx={{ fontWeight: 700, fontSize: 12, minWidth: 40 }} />
                        </Tooltip>
                    </Stack>
                    <LinearProgress
                        variant="determinate"
                        value={(d.value / maxVal) * 100}
                        color="primary"
                        sx={{ height: 6, mt: 1, borderRadius: 3, transition: 'width 0.5s' }}
                    />
                </Paper>
            ))}
        </Stack>
    );
}

const IntensityCell = ({ value, max, theme }) => {
    const intensity = max > 0 ? value / max : 0;
    let bgcolor = theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100];
    let color = theme.palette.text.primary;

    if (value > 0) {
        const alpha = 0.3 + intensity * 0.6;
        bgcolor = `rgba(3, 169, 244, ${alpha})`;
        color = intensity > 0.5 && theme.palette.mode === 'dark' ? 'white' : theme.palette.text.primary;
    }

    return (
        <TableCell align="center" sx={{
            bgcolor: bgcolor,
            color: value > 0 ? color : theme.palette.text.disabled,
            fontWeight: 700,
            transition: 'background-color 0.3s',
            minWidth: 50,
            fontSize: 13,
            p: 1,
        }}>
            {value > 0 ? value : '-'}
        </TableCell>
    );
};


function downloadCSV(filename, rows, headers) {
    const headerLine = headers.map((h) => `"${h.label}"`).join(",");
    const lines = rows.map((r) =>
        headers
            .map((h) => `"${String(r[h.key] ?? "").replace(/"/g, '""')}"`)
            .join(",")
    );
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

// ---------- Styles ----------
const cardSX = {
    borderRadius: 3,
    p: 2,
    transition: 'transform 0.3s ease-out, box-shadow 0.3s',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: (t) => t.shadows[10],
    },
    bgcolor: (t) => (t.palette.mode === "dark" ? t.palette.background.paper : "white"),
    border: (t) => `1px solid ${t.palette.mode === "dark" ? t.palette.grey[800] : t.palette.grey[200]}`,
};
const panelSX = {
    p: 2,
    borderRadius: 3,
    bgcolor: (t) => (t.palette.mode === "dark" ? t.palette.background.paper : "white"),
    border: (t) => `1px solid ${t.palette.mode === "dark" ? t.palette.grey[800] : t.palette.grey[200]}`,
};
const rowSX = {
    height: 48,
    "& td, & th": {
        borderBottomColor: (t) => t.palette.divider,
        verticalAlign: "middle",
        padding: '8px 10px',
        lineHeight: 1.4,
    },
};
const nameCellSX = { whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" };

// ---------- Page Component ----------
export default function KpiOlcumu() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const theme = useTheme();

    // Veriler
    const [seferler, setSeferler] = useState([]);
    const [tamamlanan, setTamamlanan] = useState([]);
    const [izinler, setIzinler] = useState([]);
    const [kesintiler, setKesintiler] = useState([]);

    // Filtreler
    const [mode, setMode] = useState("MONTH");
    const [month, setMonth] = useState(monthKey(todayISO()));
    const [startDate, setStartDate] = useState(startOfMonthISO());
    const [endDate, setEndDate] = useState(todayISO());

    const [selectedUser, setSelectedUser] = useState("");

    // --- Veri Çekme İşlevi ---
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setErr("");
            const a = await fetchAllRows("seferler");
            const b = await fetchAllRows("tamamlanan_seferler");
            const c = await fetchAllRows("izinler");
            const d = await fetchAllRows("kesintiler");

            const warns = [a.warn, b.warn, c.warn, d.warn].filter(Boolean);
            if (warns.length) setErr(warns.join(" — "));

            setSeferler(a.rows || []);
            setTamamlanan(b.rows || []);
            setIzinler(c.rows || []);
            setKesintiler(d.rows || []);
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
    const unifiedAdded = useMemo(() => [...izinler, ...kesintiler], [izinler, kesintiler]);

    const ALLOWED_USERS = useMemo(
        () => new Set(["SELÇUK OLGUN", "FERHAT KARIŞLI", "MERT ULUTAŞ", "BUKET ÇİMENCİ"]),
        []
    );

    // --- Filtreleme ve Hesaplamalar ---

    const allMonths = useMemo(() => {
        const s = new Set();
        for (const r of unified) {
            const mk = monthKey(getAssignDate(r));
            if (mk) s.add(mk);
        }
        return Array.from(s).sort().reverse();
    }, [unified]);

    const effectiveRange = useMemo(() => {
        if (mode === "MONTH") {
            const { start, end } = monthStartEndByKey(month);
            return { start, end };
        }
        return { start: startDate, end: endDate };
    }, [mode, month, startDate, endDate]);

    const filteredRowsBase = useMemo(() => {
        const s = effectiveRange.start;
        const e = effectiveRange.end;
        if (!s || !e) return [];

        return unified.filter((r) => {
            const d = getAssignDate(r);
            return d && d >= s && d <= e;
        });
    }, [unified, effectiveRange]);

    const addedRowsBase = useMemo(() => {
        const s = effectiveRange.start;
        const e = effectiveRange.end;
        if (!s || !e) return [];

        return unifiedAdded.filter((r) => {
            const d = getAddDate(r);
            return d && d >= s && d <= e;
        });
    }, [unifiedAdded, effectiveRange]);

    const filteredRows = useMemo(
        () => filteredRowsBase.filter((r) => ALLOWED_USERS.has(normTR(getUser(r)))),
        [filteredRowsBase, ALLOWED_USERS]
    );

    const addedFilteredRows = useMemo(
        () => addedRowsBase.filter((r) => ALLOWED_USERS.has(normTR(getAdder(r)))),
        [addedRowsBase, ALLOWED_USERS]
    );

    // Ana Agregasyon: Kullanıcı bazlı BOS/SFR/Günler
    const userAgg = useMemo(() => {
        const m = new Map();
        for (const r of filteredRows) {
            const u = getUser(r) || "—";
            const p = getPrefix(r);
            const d = getAssignDate(r);

            if (!m.has(u)) m.set(u, { BOS: 0, SFR: 0, DİĞER: 0, TOPLAM: 0, DAYS: new Set(), WEEKEND_DAYS: 0 });

            const row = m.get(u);
            row[p] = (row[p] || 0) + 1;
            row.TOPLAM += 1;

            if (d && !row.DAYS.has(d)) {
                row.DAYS.add(d);
                const dayIndex = new Date(d).getDay();
                if (dayIndex === 0 || dayIndex === 6) { // 0: Pazar, 6: Cumartesi
                    row.WEEKEND_DAYS += 1;
                }
            }
        }

        const arr = Array.from(m.entries()).map(([user, counts]) => ({
            user,
            BOS: counts.BOS,
            SFR: counts.SFR,
            'DİĞER': counts["DİĞER"],
            TOPLAM: counts.TOPLAM,
            CALISILAN_GUN: counts.DAYS.size,
            WEEKEND_DAYS: counts.WEEKEND_DAYS,
        }));

        arr.sort((a, b) => b.TOPLAM - a.TOPLAM || a.user.localeCompare(b.user, "tr"));
        return arr;
    }, [filteredRows]);

    // Ekleyen Agregasyonu: Kullanıcı bazlı İzin/Kesinti
    const addedAgg = useMemo(() => {
        const m = new Map();
        for (const r of addedFilteredRows) {
            const u = getAdder(r) || "—";
            const isIzin =
                Object.prototype.hasOwnProperty.call(r, "izin_turu") ||
                Object.prototype.hasOwnProperty.call(r, "izin_tarihi") ||
                String(r?.tablo_adi || "").toLowerCase().includes("izin");
            const key = isIzin ? "IZIN" : "KES";
            if (!m.has(u)) m.set(u, { IZIN: 0, KES: 0, TOPLAM: 0 });
            const row = m.get(u);
            row[key] += 1;
            row.TOPLAM += 1;
        }
        const arr = Array.from(m.entries()).map(([user, counts]) => ({ user, ...counts }));
        return arr.sort((a, b) => b.TOPLAM - a.TOPLAM || a.user.localeCompare(b.user, "tr"));
    }, [addedFilteredRows]);


    // Kullanıcı listesi
    const users = useMemo(() => userAgg.map(u => ({ user: u.user, count: u.TOPLAM })), [userAgg]);
    useEffect(() => {
        if (!selectedUser && users.length) setSelectedUser(users[0].user);
    }, [users, selectedUser]);

    // Seçili Kullanıcı İstatistikleri
    const selectedUserStats = useMemo(() => {
        if (!selectedUser) return {};

        const stats = userAgg.find(u => u.user === selectedUser);
        const addedStats = addedAgg.find(u => u.user === selectedUser) || { IZIN: 0, KES: 0, TOPLAM: 0 };

        if (!stats) return {};

        const avgDaily = stats.TOPLAM / Math.max(1, stats.CALISILAN_GUN);
        const sfrRatio = (stats.SFR / Math.max(1, stats.TOPLAM)) * 100;
        const kesintiRatio = (addedStats.KES / Math.max(1, stats.TOPLAM)) * 100;
        const weekendRatio = (stats.WEEKEND_DAYS / Math.max(1, stats.CALISILAN_GUN)) * 100;
        const sfrSpeed = (stats.SFR / Math.max(1, stats.CALISILAN_GUN));

        return {
            ...stats,
            IZIN: addedStats.IZIN,
            KES: addedStats.KES,
            avgDaily: avgDaily,
            sfrRatio: sfrRatio,
            kesintiRatio: kesintiRatio,
            weekendRatio: weekendRatio,
            sfrSpeed: sfrSpeed,
        };
    }, [selectedUser, userAgg, addedAgg]);

    // Genel Ortalama İstatistikler
    const globalStats = useMemo(() => {
        const totalSefer = filteredRows.length;
        const totalSFR = filteredRows.filter(r => getPrefix(r) === 'SFR').length;
        const totalWorkingDays = Array.from(new Set(filteredRows.map(getAssignDate).filter(Boolean))).length;

        const sfrRatioGlobal = (totalSefer > 0) ? (totalSFR / totalSefer) * 100 : 0;
        const avgDailyGlobal = (totalWorkingDays > 0) ? totalSefer / totalWorkingDays : 0;


        return {
            totalSefer,
            sfrRatioGlobal,
            totalWorkingDays,
            avgDailyGlobal
        };
    }, [filteredRows]);


    // Haftanın Günü Analizi (Yoğunluk Haritası için)
    const dailyOfWeekAgg = useMemo(() => {
        const daysOfWeekTR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
        const dayMap = new Map();

        for (const r of filteredRows) {
            const date = getAssignDate(r);
            const user = getUser(r) || "—";
            if (!date) continue;

            const dayIndex = new Date(date).getDay();
            const dayName = daysOfWeekTR[(dayIndex + 6) % 7];

            if (!dayMap.has(user)) dayMap.set(user, { TOPLAM: 0 });

            const userRow = dayMap.get(user);
            userRow[dayName] = (userRow[dayName] || 0) + 1;
            userRow.TOPLAM += 1;
        }

        const table = Array.from(dayMap.entries()).map(([user, counts]) => {
            const row = { Kullanıcı: user, TOPLAM: counts.TOPLAM };
            daysOfWeekTR.forEach(day => {
                row[day] = counts[day] || 0;
            });
            return row;
        });

        const maxVal = Math.max(1, ...table.flatMap(r => daysOfWeekTR.map(d => r[d])));

        return { table: table.sort((a, b) => b.TOPLAM - a.TOPLAM), maxVal };

    }, [filteredRows]);

    // Seçili kullanıcı — günlük dağılım
    const dailyForUser = useMemo(() => {
        if (!selectedUser) return [];
        const days = enumerateDates(effectiveRange.start, effectiveRange.end, 120);
        const map = new Map(days.map((d) => [d, { date: d, BOS: 0, SFR: 0, TOPLAM: 0 }]));
        for (const r of filteredRows) {
            if (getUser(r) !== selectedUser) continue;
            const d = getAssignDate(r);
            if (!map.has(d)) continue;
            const p = getPrefix(r);
            const row = map.get(d);
            if (p === "BOS") row.BOS++;
            else if (p === "SFR") row.SFR++;
            row.TOPLAM++;
        }
        return Array.from(map.values()).reverse();
    }, [effectiveRange, filteredRows, selectedUser]);


    const lastUpdated = useMemo(
        () =>
            new Date().toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            }),
        [filteredRows.length]
    );

    // --- Quick Actions (Kısayollar) ---
    const setToday = () => {
        const t = todayISO(); setMode("RANGE"); setStartDate(t); setEndDate(t);
    };
    const setLast7 = () => {
        const e = todayISO(); const s = shiftDays(e, -6); setMode("RANGE"); setStartDate(s); setEndDate(e);
    };
    const setLast30 = () => {
        const e = todayISO(); const s = shiftDays(e, -29); setMode("RANGE"); setStartDate(s); setEndDate(e);
    };
    const setThisMonth = () => {
        setMode("MONTH"); setMonth(monthKey(todayISO()));
    };
    const setPrevMonth = () => {
        setMode("MONTH"); setMonth(prevMonthKey(monthKey(todayISO())));
    };

    const topUsers = useMemo(() => userAgg.map(x => ({ key: x.user, value: x.TOPLAM, subLabel: 'SFR', subValue: x.SFR })), [userAgg]);

    const topAdders = useMemo(() => addedAgg.map(x => ({
        key: x.user,
        value: x.TOPLAM,
        subLabel: 'Kesinti',
        subValue: x.KES,
        subColor: theme.palette.error.main
    })), [addedAgg, theme]);

    // SFR Dağılım Tablosu verisi
    const sfrDistributionAgg = useMemo(() => userAgg.map(r => ({
        user: r.user,
        sfr: r.SFR,
        bos: r.BOS,
        total: r.TOPLAM,
        sfrRatio: (r.SFR / Math.max(1, r.TOPLAM)) * 100,
        sfrSpeed: r.SFR / Math.max(1, r.CALISILAN_GUN),
    })).sort((a, b) => b.sfrRatio - a.sfrRatio), [userAgg]);


    return (
        <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: theme.palette.mode === "dark" ? "#0b1020" : theme.palette.grey[50] }}>
            <Helmet>
                <title>KPI Ölçümü</title>
            </Helmet>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {/* ÜST BAR / FİLTRELER */}
                <Box
                    sx={{
                        py: { xs: 2, md: 3 },
                        background: (t) =>
                            t.palette.mode === "dark"
                                ? "linear-gradient(180deg,#0e1428,#0b1020)"
                                : "linear-gradient(180deg,#ffffff,#f6f9ff)",
                        borderBottom: (t) => `1px solid ${t.palette.divider}`,
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
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
                                    Kullanıcı KPI Performans Dashboard <AnalyticsIcon sx={{ color: 'primary.main', ml: 0.5 }} />
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                                    <Chip size="small" variant="outlined" label={`Son güncelleme: ${lastUpdated}`} />
                                    {err && <Chip size="small" color="error" label="UYARI: Veri Eksik/Hatalı" />}
                                </Stack>
                            </Box>

                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                {/* Kısayollar ve Filtreler */}
                                <Button size="small" onClick={setToday}>Bugün</Button>
                                <Button size="small" onClick={setLast7}>Son 7 Gün</Button>
                                <Button size="small" onClick={setLast30}>Son 30 Gün</Button>
                                <Button size="small" onClick={setThisMonth}>Bu Ay</Button>
                                <Button size="small" onClick={setPrevMonth}>Geçen Ay</Button>

                                {/* Ay/Aralık Seçimi */}
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>{mode === "MONTH" ? "Ay Seç" : "Mod"}</InputLabel>
                                    <Select label={mode === "MONTH" ? "Ay Seç" : "Mod"} value={mode === "MONTH" ? month || '' : mode} onChange={(e) => {
                                        if (e.target.value === 'RANGE' || e.target.value === 'MONTH') setMode(e.target.value);
                                        else setMonth(e.target.value);
                                    }}>
                                        <MenuItem value="MONTH">AYLIK MOD</MenuItem>
                                        <MenuItem value="RANGE">ARALIK MODU</MenuItem>
                                        <Divider />
                                        {allMonths.map((m) => (<MenuItem key={m} value={m} disabled={mode === 'RANGE'}>{humanMonth(m)}</MenuItem>))}
                                    </Select>
                                </FormControl>

                                <Tooltip title="Verileri Supabase'den Yenile">
                                    <IconButton onClick={fetchData} disabled={loading} color="primary">
                                        {loading ? <CircularProgress size={18} /> : <RefreshIcon />}
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    </Container>
                </Box>

                {/* İÇERİK - GÜNCELLENMİŞ 2 SATIRLI ANA BÖLÜM (lg=4, lg=4, lg=4 ve lg=12) */}
                <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, maxWidth: "1600px", py: 3, flex: 1, minHeight: 0 }}>
                    <Grid container spacing={3} sx={{ height: '100%', minHeight: 0 }}>

                        {/* ==================================================== */}
                        {/* SATIR 1: ÜST KISIM (lg=4, lg=4, lg=4) - Dikey Hizalama için flex eklendi. */}
                        {/* ==================================================== */}

                        {/* SÜTUN 1 (lg=4): GENEL KPI KARTLARI + TOP 10 SEFER */}
                        <Grid item xs={12} lg={4} sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Stack spacing={3} sx={{ flex: 1 }}>

                                {/* 1.1: Genel KPI Kartları (Sabit Yükseklik) */}
                                <Typography variant="h6" fontWeight={800} sx={{ color: 'text.secondary', flexShrink: 0 }}>Genel & Yeni Metrikler</Typography>
                                <Grid container spacing={2} sx={{ flexShrink: 0 }}>
                                    <Grid item xs={6} sm={6}>
                                        <Paper elevation={6} sx={cardSX}><Stack direction="row" alignItems="center" spacing={1}><PercentIcon color="success" /><Typography variant="subtitle2" sx={{ opacity: 0.7 }}>Genel SFR Oranı</Typography></Stack>
                                            <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, color: 'success.main' }}>% {globalStats.sfrRatioGlobal.toFixed(1)}</Typography>
                                            <Typography variant="caption">{globalStats.totalSefer} Toplam Sefer</Typography>
                                        </Paper>
                                    </Grid>
                                    <Grid item xs={6} sm={6}>
                                        <Paper elevation={6} sx={cardSX}><Stack direction="row" alignItems="center" spacing={1}><AccessTimeIcon color="primary" /><Typography variant="subtitle2" sx={{ opacity: 0.7 }}>Günlük Ort. (Genel)</Typography></Stack>
                                            <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, color: 'primary.main' }}>{globalStats.avgDailyGlobal.toFixed(1)}</Typography>
                                            <Typography variant="caption">{globalStats.totalWorkingDays} Aktif Gün</Typography>
                                        </Paper>
                                    </Grid>
                                    <Grid item xs={6} sm={6}>
                                        <Paper elevation={6} sx={cardSX}><Stack direction="row" alignItems="center" spacing={1}><FlashOnIcon color="warning" /><Typography variant="subtitle2" sx={{ opacity: 0.7 }}>SFR Hızı (Odak)</Typography></Stack>
                                            <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, color: 'warning.main' }}>{(selectedUserStats?.sfrSpeed || 0).toFixed(1)}</Typography>
                                            <Typography variant="caption">SFR / Çalışılan Gün</Typography>
                                        </Paper>
                                    </Grid>
                                    <Grid item xs={6} sm={6}>
                                        <Paper elevation={6} sx={cardSX}><Stack direction="row" alignItems="center" spacing={1}><WeekendIcon color="secondary" /><Typography variant="subtitle2" sx={{ opacity: 0.7 }}>Hafta Sonu Aktivitesi</Typography></Stack>
                                            <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, color: 'secondary.main' }}>% {(selectedUserStats?.weekendRatio || 0).toFixed(1)}</Typography>
                                            <Typography variant="caption">HW Gün: {selectedUserStats?.WEEKEND_DAYS || 0}</Typography>
                                        </Paper>
                                    </Grid>
                                </Grid>

                                <Divider sx={{ flexShrink: 0 }} />

                                {/* 1.2: En Yüksek Toplam Sefer Açanlar (Bar List) - Kalan Alanı Doldurur */}
                                <Paper elevation={0} sx={{ ...panelSX, height: 'auto', flex: 1, minHeight: 250 }}>
                                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                        TOP 10: En Yüksek Toplam Sefer
                                    </Typography>
                                    <Box sx={{ overflowY: 'auto', maxHeight: '100%' }}>
                                        <BarList
                                            rows={topUsers}
                                            max={10}
                                            onItemClick={setSelectedUser}
                                            selectedItem={selectedUser}
                                            valueLabel="Toplam Sefer"
                                        />
                                    </Box>
                                </Paper>
                            </Stack>
                        </Grid>

                        {/* SÜTUN 2 (lg=4): HAFTALIK YOĞUNLUK HARİTASI (Orta) */}
                        <Grid item xs={12} lg={4} sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Stack spacing={3} sx={{ flex: 1 }}>

                                {/* 2.1: Haftalık Yoğunluk Haritası - YÜKSEKLİĞİ SÜTUN 1 VE SÜTUN 3'E HİZALANDI */}
                                <Paper elevation={0} sx={{ ...panelSX, flex: 1, display: "flex", flexDirection: "column", minHeight: 620 }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                                        <Typography variant="subtitle1" fontWeight={700}>Haftalık Aktivite Yoğunluğu</Typography>
                                        <Button size="small" startIcon={<DownloadIcon />} onClick={() => downloadCSV(`kpi_haftalik_dagilim.csv`, dailyOfWeekAgg.table, [{ key: "Kullanıcı", label: "Kullanıcı" }, { key: "Pazartesi", label: "Pzt" }, { key: "Salı", label: "Salı" }, { key: "Çarşamba", label: "Çar" }, { key: "Perşembe", label: "Per" }, { key: "Cuma", label: "Cuma" }, { key: "Cumartesi", label: "Cmt" }, { key: "Pazar", label: "Paz" }, { key: "TOPLAM", label: "TOPLAM" }])}>
                                            CSV
                                        </Button>
                                    </Stack>
                                    <Box sx={{ overflowX: "auto", flex: 1, minHeight: 0 }}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow sx={rowSX}>
                                                    <TableCell sx={{ fontWeight: 700, minWidth: 150, zIndex: 3, position: 'sticky', left: 0, bgcolor: theme.palette.background.paper }}>Kullanıcı</TableCell>
                                                    {["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"].map(day => (
                                                        <TableCell key={day} align="center" sx={{ fontWeight: 700 }}>{day.slice(0, 3)}</TableCell>
                                                    ))}
                                                    <TableCell align="center" sx={{ fontWeight: 700, minWidth: 80, bgcolor: theme.palette.secondary.main, color: 'white' }}>TOPLAM</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {dailyOfWeekAgg.table.map((r, i) => (
                                                    <TableRow key={r.Kullanıcı || i} hover sx={rowSX}>
                                                        <TableCell sx={{ ...nameCellSX, position: 'sticky', left: 0, zIndex: 2, bgcolor: theme.palette.background.paper }} onClick={() => setSelectedUser(r.Kullanıcı)} style={{ cursor: 'pointer', fontWeight: selectedUser === r.Kullanıcı ? 900 : 600 }}>{r.Kullanıcı || "—"}</TableCell>
                                                        {["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"].map(day => (
                                                            <IntensityCell key={day} value={r[day]} max={dailyOfWeekAgg.maxVal} theme={theme} />
                                                        ))}
                                                        <TableCell align="center" sx={{ fontWeight: 700, bgcolor: theme.palette.secondary.light, color: theme.palette.secondary.dark }}><Chip size="small" color="secondary" label={r.TOPLAM} sx={{ height: 22 }} /></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                </Paper>

                            </Stack>
                        </Grid>

                        {/* SÜTUN 3 (lg=4): KULLANICI ODAKLI KPI'LAR + TOP 10 KESİNTİ */}
                        <Grid item xs={12} lg={4} sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Stack spacing={3} sx={{ flex: 1 }}>

                                {/* 3.1: Seçili Kullanıcı Metrik Kartları (Sabit Yükseklik) */}
                                <Paper elevation={6} sx={{ ...panelSX, p: 3, minHeight: 280, flexShrink: 0 }}>
                                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                        <BadgeIcon color="secondary" />
                                        <Typography variant="h6" fontWeight={800}>Odak Kullanıcı: {selectedUser || 'Kullanıcı Seçin'}</Typography>
                                    </Stack>

                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'success.light', borderRadius: 2 }}>
                                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>SFR Oranı</Typography>
                                                <Typography variant="h5" fontWeight={900} sx={{ mt: 0.2, color: 'success.main' }}>% {(selectedUserStats?.sfrRatio || 0).toFixed(1)}</Typography>
                                                <Typography variant="caption" color={(selectedUserStats?.sfrRatio || 0) >= globalStats.sfrRatioGlobal ? "success.main" : "error.main"}>Genel Ort: %{globalStats.sfrRatioGlobal.toFixed(1)}</Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'primary.light', borderRadius: 2 }}>
                                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>Ort. Sefer/Gün</Typography>
                                                <Typography variant="h5" fontWeight={900} sx={{ mt: 0.2, color: 'primary.main' }}>{(selectedUserStats?.avgDaily || 0).toFixed(1)}</Typography>
                                                <Typography variant="caption">Çalışılan Gün: {selectedUserStats?.CALISILAN_GUN || 0}</Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'error.light', borderRadius: 2 }}>
                                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>Eklenen Kesinti</Typography>
                                                <Typography variant="h5" fontWeight={900} sx={{ mt: 0.2, color: 'error.main' }}>{selectedUserStats?.KES || 0}</Typography>
                                                <Typography variant="caption" color="error.main">Oran: %{(selectedUserStats?.kesintiRatio || 0).toFixed(2)}</Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'warning.light', borderRadius: 2 }}>
                                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>Toplam Sefer</Typography>
                                                <Typography variant="h5" fontWeight={900} sx={{ mt: 0.2, color: 'warning.main' }}>{selectedUserStats?.TOPLAM || 0}</Typography>
                                                <Typography variant="caption">BOS:{selectedUserStats?.BOS || 0} / SFR:{selectedUserStats?.SFR || 0}</Typography>
                                            </Paper>
                                        </Grid>
                                    </Grid>
                                </Paper>

                                <Divider sx={{ flexShrink: 0 }} />

                                {/* 3.2: Ekleyen Kullanıcı/Kesinti Sayıları (Bar List) - Kalan Alanı Doldurur */}
                                <Paper elevation={0} sx={{ ...panelSX, height: 'auto', flex: 1, minHeight: 250 }}>
                                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                        TOP 10: Ekleyen Kullanıcı (Kesinti)
                                    </Typography>
                                    <Box sx={{ overflowY: 'auto', maxHeight: '100%' }}>
                                        <BarList
                                            rows={topAdders}
                                            max={10}
                                            onItemClick={() => { }}
                                            valueLabel="Toplam Kayıt"
                                        />
                                    </Box>
                                </Paper>
                            </Stack>
                        </Grid>

                        {/* ==================================================== */}
                        {/* SATIR 2: ALT KISIM (lg=12) - SFR ve GÜNLÜK YAN YANA (İstenilen hiza için minHeight ayarlandı) */}
                        {/* ==================================================== */}

                        <Grid item xs={12} lg={12}>
                            <Grid container spacing={3}>

                                {/* 4.1: SFR Dağılım Tablosu (Alt Satır, Sol - lg=6) */}
                                <Grid item xs={12} lg={6}>
                                    {/* minHeight, üstteki bar listesi paneliyle hizalanması için ayarlandı */}
                                    <Paper elevation={0} sx={{ ...panelSX, display: "flex", flexDirection: "column", minHeight: 450 }}>
                                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                                            <Typography variant="subtitle1" fontWeight={700}>SFR Dağılımı ve Başarı Hızı</Typography>
                                            <Button size="small" startIcon={<DownloadIcon />} onClick={() => downloadCSV(`kpi_sfr_dagilimi.csv`, sfrDistributionAgg.map(r => ({ ...r, sfrRatio: r.sfrRatio.toFixed(1), sfrSpeed: r.sfrSpeed.toFixed(1) })), [{ key: "user", label: "Kullanıcı" }, { key: "sfr", label: "SFR" }, { key: "bos", label: "BOS" }, { key: "sfrRatio", label: "SFR Oranı (%)" }, { key: "sfrSpeed", label: "SFR Hızı (Günlük)" }])}>
                                                CSV
                                            </Button>
                                        </Stack>

                                        <Box sx={{ mt: 1, flex: 1, overflow: "auto" }}>
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow sx={rowSX}>
                                                        <TableCell sx={{ minWidth: 100 }}>Kullanıcı</TableCell>
                                                        <TableCell align="right">SFR</TableCell>
                                                        <TableCell align="right">BOS</TableCell>
                                                        <TableCell align="right">SFR Oranı (%)</TableCell>
                                                        <TableCell align="right">SFR Hızı</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {sfrDistributionAgg.map((r, i) => (
                                                        <TableRow
                                                            key={r.user || i} hover sx={rowSX}
                                                            onClick={() => setSelectedUser(r.user)}
                                                            selected={selectedUser === r.user}
                                                            style={{ cursor: "pointer" }}
                                                        >
                                                            <TableCell sx={nameCellSX}><Typography fontWeight={selectedUser === r.user ? 700 : 500} fontSize={13}>{r.user || "—"}</Typography></TableCell>
                                                            <TableCell align="right"><Chip size="small" color="success" label={r.sfr} sx={{ height: 22 }} /></TableCell>
                                                            <TableCell align="right">{r.bos}</TableCell>
                                                            <TableCell align="right"><Chip size="small" label={`${r.sfrRatio.toFixed(1)}%`} color="secondary" sx={{ height: 22 }} /></TableCell>
                                                            <TableCell align="right">{r.sfrSpeed.toFixed(1)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {sfrDistributionAgg.length === 0 && (<TableRow sx={rowSX}><TableCell colSpan={5}><Typography sx={{ opacity: 0.7 }}>Kayıt yok.</Typography></TableCell></TableRow>)}
                                                </TableBody>
                                            </Table>
                                        </Box>
                                    </Paper>
                                </Grid>


                                {/* 4.2: Günlük Sefer Dağılımı (Alt Satır, Sağ - lg=6) */}
                                <Grid item xs={12} lg={6}>
                                    {/* minHeight, soldaki SFR dağılımı ile hizalı olması için ayarlandı */}
                                    <Paper elevation={0} sx={{ ...panelSX, display: "flex", flexDirection: "column", minHeight: 450 }}>
                                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                            Günlük Sefer Dağılımı ({selectedUser || 'Seçiniz'})
                                        </Typography>
                                        <Box sx={{ flex: 1, overflowY: "auto" }}>
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow sx={rowSX}>
                                                        <TableCell>Tarih</TableCell>
                                                        <TableCell align="right">BOS</TableCell>
                                                        <TableCell align="right">SFR</TableCell>
                                                        <TableCell align="right">Toplam</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {dailyForUser.map((d) => (
                                                        <TableRow key={d.date} sx={rowSX} hover>
                                                            <TableCell><Typography fontSize={13} fontWeight={500}>{d.date.slice(5)}</Typography></TableCell>
                                                            <TableCell align="right">{d.BOS}</TableCell>
                                                            <TableCell align="right">{d.SFR}</TableCell>
                                                            <TableCell align="right"><Chip size="small" color="primary" label={d.TOPLAM} sx={{ height: 22 }} /></TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {dailyForUser.length === 0 && (<TableRow sx={rowSX}><TableCell colSpan={4}><Typography sx={{ opacity: 0.7 }}>Kayıt yok.</Typography></TableCell></TableRow>)}
                                                </TableBody>
                                            </Table>
                                        </Box>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>
                </Container>
            </Box>
        </Box>
    );
}
