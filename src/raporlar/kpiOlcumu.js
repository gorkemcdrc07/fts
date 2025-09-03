// src/raporlar/kpiOlcumu.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";

// MUI
import {
    Box,
    Container,
    Stack,
    Typography,
    Grid,
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
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";

// ---------- Helpers ----------
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => new Date().toISOString().slice(0, 10);
const shiftDays = (iso, delta) => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d + delta);
    return dt.toISOString().slice(0, 10);
};
const startOfMonthISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
const endOfMonthISO = (d = new Date()) => {
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}`;
};
const monthKey = (isoDate) => {
    if (!isoDate) return null;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; // 2025-03
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
    // güvenlik: 120 günü aşmasın
    let cur = startIso;
    const out = [cur];
    for (let i = 0; i < cap && cur < endIso; i++) {
        cur = shiftDays(cur, 1);
        out.push(cur);
        if (cur === endIso) break;
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

// --- İzinler / Kesintiler: ekleyen ve tarih tespiti ---
const getAdder = (r) =>
    (r?.ekleyen_kullanici || r?.ekleyen || r?.created_by || "—").toString().trim();
const getAddDate = (r) => {
    const raw = r?.eklenme_tarihi || r?.kayit_zamani || r?.created_at || r?.tarih;
    const s = String(raw || "");
    return s.length >= 10 ? s.slice(0, 10) : "";
};

// Sayfalamalı güvenli çekiş (tüm veriyi çeker)
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

// Basit bar-list
function BarList({ rows = [], max = 10, height = 18 }) {
    const data = rows.slice(0, max);
    const maxVal = Math.max(1, ...data.map((d) => d.value));
    return (
        <Stack spacing={1}>
            {data.map((d, i) => (
                <Stack key={d.key || i} direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ width: 28, opacity: 0.6 }}>{i + 1}.</Typography>
                    <Box sx={{ flex: 1 }}>
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

// CSV export
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

// ---------- Page ----------
export default function KpiOlcumu() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [seferler, setSeferler] = useState([]);
    const [tamamlanan, setTamamlanan] = useState([]);
    // İzinler & Kesintiler
    const [izinler, setIzinler] = useState([]);
    const [kesintiler, setKesintiler] = useState([]);

    // Görünüm modu
    const [mode, setMode] = useState("MONTH"); // 'MONTH' | 'RANGE'
    const [month, setMonth] = useState(monthKey(todayISO()));
    const [startDate, setStartDate] = useState(startOfMonthISO());
    const [endDate, setEndDate] = useState(todayISO());

    // Kullanıcı seçimi
    const [selectedUser, setSelectedUser] = useState("");

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setErr("");
            const a = await fetchAllRows("seferler");
            const b = await fetchAllRows("tamamlanan_seferler");
            const c = await fetchAllRows("izinler");
            const d = await fetchAllRows("kesintiler");
            const warns = [a.warn, b.warn, c.warn, d.warn].filter(Boolean);
            if (warns.length) setErr(warns.join("  "));
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

    // Sadece bu kullanıcılar gösterilsin
    const ALLOWED_USERS = useMemo(
        () => new Set(["SELÇUK OLGUN", "FERHAT KARIŞLI", "MERT ULUTAŞ"]),
        []
    );

    // Tüm aylardan liste
    const allMonths = useMemo(() => {
        const s = new Set();
        for (const r of unified) {
            const mk = monthKey(getAssignDate(r));
            if (mk) s.add(mk);
        }
        return Array.from(s).sort().reverse();
    }, [unified]);

    // FİLTRE: görünüm moduna göre veriyi daralt (tarih)
    const filteredRowsBase = useMemo(() => {
        if (mode === "MONTH") {
            if (!month) return [];
            return unified.filter((r) => monthKey(getAssignDate(r)) === month);
        }
        // RANGE
        const s = startDate;
        const e = endDate;
        if (!s || !e) return [];
        return unified.filter((r) => {
            const d = getAssignDate(r);
            return d && d >= s && d <= e;
        });
    }, [unified, mode, month, startDate, endDate]);

    // İzin/Kesinti için tarih filtresi
    const addedRowsBase = useMemo(() => {
        if (!unifiedAdded.length) return [];
        if (mode === "MONTH") {
            if (!month) return [];
            return unifiedAdded.filter((r) => monthKey(getAddDate(r)) === month);
        }
        const s = startDate;
        const e = endDate;
        if (!s || !e) return [];
        return unifiedAdded.filter((r) => {
            const d = getAddDate(r);
            return d && d >= s && d <= e;
        });
    }, [unifiedAdded, mode, month, startDate, endDate]);

    // FİLTRE: sadece izinli kullanıcılar (sefer açan)
    const filteredRows = useMemo(
        () => filteredRowsBase.filter((r) => ALLOWED_USERS.has(normTR(getUser(r)))),
        [filteredRowsBase, ALLOWED_USERS]
    );
    // FİLTRE: sadece izinli ekleyenler (izin/kesinti ekleyen)
    const addedFilteredRows = useMemo(
        () => addedRowsBase.filter((r) => ALLOWED_USERS.has(normTR(getAdder(r)))),
        [addedRowsBase, ALLOWED_USERS]
    );

    // Kullanıcı listesi (sadece izinli ve filtrelenmiş)
    const users = useMemo(() => {
        const m = new Map();
        for (const r of filteredRows) {
            const u = getUser(r) || "—";
            m.set(u, (m.get(u) || 0) + 1);
        }
        return Array.from(m.entries())
            .map(([user, count]) => ({ user, count }))
            .sort((a, b) => b.count - a.count || a.user.localeCompare(b.user, "tr"));
    }, [filteredRows]);

    useEffect(() => {
        if (!selectedUser && users.length) setSelectedUser(users[0].user);
    }, [users, selectedUser]);

    // Kullanıcı bazlı BOS/SFR sayıları (filtreye göre)
    const userAgg = useMemo(() => {
        const m = new Map();
        for (const r of filteredRows) {
            const u = getUser(r) || "—";
            const p = getPrefix(r);
            if (!m.has(u)) m.set(u, { BOS: 0, SFR: 0, DİĞER: 0, TOPLAM: 0 });
            const row = m.get(u);
            row[p] = (row[p] || 0) + 1;
            row.TOPLAM += 1;
        }
        const arr = Array.from(m.entries()).map(([user, counts]) => ({ user, ...counts }));
        arr.sort((a, b) => b.TOPLAM - a.TOPLAM || a.user.localeCompare(b.user, "tr"));
        return arr;
    }, [filteredRows]);

    // Özet
    const summary = useMemo(() => {
        let BOS = 0,
            SFR = 0,
            DIG = 0;
        for (const r of filteredRows) {
            const p = getPrefix(r);
            if (p === "BOS") BOS++;
            else if (p === "SFR") SFR++;
            else DIG++;
        }
        return { BOS, SFR, DIG, TOPLAM: filteredRows.length, KULLANICI: userAgg.length };
    }, [filteredRows, userAgg.length]);

    const topUsers = useMemo(
        () => userAgg.map((x) => ({ key: x.user, value: x.TOPLAM })),
        [userAgg]
    );

    // Ekleyen kullanıcı agregasyonu (izinler + kesintiler)
    const addedAgg = useMemo(() => {
        const m = new Map(); // user -> { IZIN: n, KES: n, TOPLAM: n }
        for (const r of addedFilteredRows) {
            const u = getAdder(r) || "—";
            // kaba ayrım: izin tablosu varsayılan bazı alan adlarıyla; yoksa kesinti say
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
        arr.sort((a, b) => b.TOPLAM - a.TOPLAM || a.user.localeCompare(b.user, "tr"));
        return arr;
    }, [addedFilteredRows]);

    const topAdders = useMemo(
        () => addedAgg.map((x) => ({ key: x.user, value: x.TOPLAM })),
        [addedAgg]
    );

    // Tarih aralığı: ay modundaysa ayın başlangıç-bitişini kullan
    const effectiveRange = useMemo(() => {
        if (mode === "MONTH") {
            const { start, end } = monthStartEndByKey(month);
            return { start, end };
        }
        return { start: startDate, end: endDate };
    }, [mode, month, startDate, endDate]);

    // Günlük toplam (tüm kullanıcılar)
    const dailyAll = useMemo(() => {
        const days = enumerateDates(effectiveRange.start, effectiveRange.end, 120);
        const map = new Map(days.map((d) => [d, { date: d, BOS: 0, SFR: 0, TOPLAM: 0 }]));
        for (const r of filteredRows) {
            const d = getAssignDate(r);
            if (!map.has(d)) continue;
            const p = getPrefix(r);
            const row = map.get(d);
            if (p === "BOS") row.BOS++;
            else if (p === "SFR") row.SFR++;
            row.TOPLAM++;
        }
        return Array.from(map.values());
    }, [effectiveRange, filteredRows]);

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
        return Array.from(map.values());
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

    // Quick actions
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
                <title>KPI Ölçümü</title>
            </Helmet>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {/* ÜST BAR / FİLTRELER */}
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
                                    Kullanıcı KPI (BOS / SFR)
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                                    <Chip
                                        size="small"
                                        color={mode === "MONTH" ? "info" : "default"}
                                        variant={mode === "MONTH" ? "filled" : "outlined"}
                                        label={mode === "MONTH" ? humanMonth(month) : "Özel Aralık"}
                                    />
                                    <Chip size="small" variant="outlined" label={`Son güncelleme: ${lastUpdated}`} />
                                    {err && <Chip size="small" color="error" label="Uyarı / Eksik tablo" />}
                                </Stack>
                            </Box>

                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                {/* Görünüm kısayolları */}
                                <Button size="small" onClick={setToday}>Bugün</Button>
                                <Button size="small" onClick={setLast7}>Son 7 Gün</Button>
                                <Button size="small" onClick={setLast30}>Son 30 Gün</Button>
                                <Button size="small" onClick={setThisMonth}>Bu Ay</Button>
                                <Button size="small" onClick={setPrevMonth}>Geçen Ay</Button>

                                {/* Ay seçimi (MONTH modunda) */}
                                <FormControl size="small" sx={{ minWidth: 180, display: mode === "MONTH" ? "block" : "none" }}>
                                    <InputLabel>Ay</InputLabel>
                                    <Select label="Ay" value={month || ""} onChange={(e) => setMonth(e.target.value)}>
                                        {allMonths.map((m) => (
                                            <MenuItem key={m} value={m}>
                                                {humanMonth(m)}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* Özel aralık (RANGE modunda) */}
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{ display: mode === "RANGE" ? "flex" : "none", alignItems: "center" }}
                                >
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

                                {/* Kullanıcı seçimi */}
                                <FormControl size="small" sx={{ minWidth: 220 }}>
                                    <InputLabel>Kullanıcı</InputLabel>
                                    <Select
                                        label="Kullanıcı"
                                        value={selectedUser || ""}
                                        onChange={(e) => setSelectedUser(e.target.value)}
                                    >
                                        {users.map((u) => (
                                            <MenuItem key={u.user} value={u.user}>
                                                {u.user} &nbsp;—&nbsp; {u.count}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

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

                {/* İÇERİK */}
                <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, maxWidth: "1600px", py: 2 }}>
                    {err && (
                        <Paper sx={{ ...panelSX, mb: 2 }}>
                            <Typography color="error">{err}</Typography>
                        </Paper>
                    )}

                    {/* ÖZET KARTLAR */}
                    <Grid container spacing={2.4}>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <Paper elevation={6} sx={cardSX}>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                                    Toplam (filtreye göre)
                                </Typography>
                                <Typography variant="h4" fontWeight={900} sx={{ mt: 0.25 }}>
                                    {summary.TOPLAM}
                                </Typography>
                                <Chip size="small" variant="outlined" label={`${summary.KULLANICI} kullanıcı`} sx={{ mt: 1 }} />
                            </Paper>
                        </Grid>

                        <Grid size={{ xs: 12, md: 3 }}>
                            <Paper elevation={6} sx={cardSX}>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                                    BOS
                                </Typography>
                                <Typography variant="h4" fontWeight={900} sx={{ mt: 0.25 }}>
                                    {summary.BOS}
                                </Typography>
                                <Chip size="small" label="BOS" color="info" sx={{ mt: 1 }} />
                            </Paper>
                        </Grid>

                        <Grid size={{ xs: 12, md: 3 }}>
                            <Paper elevation={6} sx={cardSX}>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                                    SFR
                                </Typography>
                                <Typography variant="h4" fontWeight={900} sx={{ mt: 0.25 }}>
                                    {summary.SFR}
                                </Typography>
                                <Chip size="small" label="SFR" color="success" sx={{ mt: 1 }} />
                            </Paper>
                        </Grid>

                        <Grid size={{ xs: 12, md: 3 }}>
                            <Paper elevation={6} sx={cardSX}>
                                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                                    Diğer
                                </Typography>
                                <Typography variant="h4" fontWeight={900} sx={{ mt: 0.25 }}>
                                    {summary.DIG}
                                </Typography>
                                <Chip size="small" variant="outlined" label="DİĞER" sx={{ mt: 1 }} />
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* TOP KULLANICILAR + AYLIK TABLO */}
                    <Grid container spacing={2.4} sx={{ mt: 0.5 }}>
                        {/* EN ÇOK SEFER AÇANLAR (bar) */}
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        En çok sefer açan kullanıcılar (TOP 10)
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `kpi_top_kullanicilar.csv`,
                                                topUsers.map((x) => ({ kullanici: x.key, toplam: x.value })),
                                                [
                                                    { key: "kullanici", label: "Kullanıcı" },
                                                    { key: "toplam", label: "Toplam" },
                                                ]
                                            )
                                        }
                                    >
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1.5, flex: 1, overflow: "auto" }}>
                                    <BarList rows={topUsers} />
                                </Box>
                            </Paper>
                        </Grid>

                        {/* KULLANICI BAZI TABLO */}
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Kullanıcı başına BOS / SFR
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `kpi_kullanici_ozet.csv`,
                                                userAgg.map((x) => ({
                                                    kullanici: x.user,
                                                    BOS: x.BOS,
                                                    SFR: x.SFR,
                                                    DIGER: x["DİĞER"],
                                                    TOPLAM: x.TOPLAM,
                                                })),
                                                [
                                                    { key: "kullanici", label: "Kullanıcı" },
                                                    { key: "BOS", label: "BOS" },
                                                    { key: "SFR", label: "SFR" },
                                                    { key: "DIGER", label: "Diğer" },
                                                    { key: "TOPLAM", label: "Toplam" },
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
                                                <TableCell>Kullanıcı</TableCell>
                                                <TableCell align="right">BOS</TableCell>
                                                <TableCell align="right">SFR</TableCell>
                                                <TableCell align="right">Diğer</TableCell>
                                                <TableCell align="right">Toplam</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {userAgg.map((r, i) => (
                                                <TableRow
                                                    key={r.user || i}
                                                    hover
                                                    sx={rowSX}
                                                    onClick={() => setSelectedUser(r.user)}
                                                    selected={selectedUser === r.user}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <TableCell width={32}>{i + 1}</TableCell>
                                                    <TableCell sx={nameCellSX}>{r.user || "—"}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" label={r.BOS} sx={{ height: 22 }} />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" color="success" label={r.SFR} sx={{ height: 22 }} />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" variant="outlined" label={r["DİĞER"]} sx={{ height: 22 }} />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" color="info" label={r.TOPLAM} sx={{ height: 22 }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {userAgg.length === 0 && (
                                                <TableRow sx={rowSX}>
                                                    <TableCell colSpan={6}>
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

                    {/* EKLEYEN KULLANICI PANELLERİ (İzinler + Kesintiler) */}
                    <Divider sx={{ my: 3, opacity: 0.2 }} />
                    <Grid container spacing={2.4}>
                        {/* Ekleyen — TOP 10 */}
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Ekleyen kullanıcılar (İzinler + Kesintiler) — TOP 10
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `kpi_ekleyen_top10.csv`,
                                                topAdders.map((x) => ({ kullanici: x.key, toplam: x.value })),
                                                [
                                                    { key: "kullanici", label: "Kullanıcı" },
                                                    { key: "toplam", label: "Toplam" },
                                                ]
                                            )
                                        }
                                        disabled={!topAdders.length}
                                    >
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1.5, flex: 1, overflow: "auto" }}>
                                    <BarList rows={topAdders} />
                                </Box>
                            </Paper>
                        </Grid>

                        {/* Ekleyen — Detay tablo */}
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Ekleyen kullanıcı başına İzin / Kesinti
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `kpi_ekleyen_ozet.csv`,
                                                addedAgg.map((x) => ({
                                                    kullanici: x.user,
                                                    IZIN: x.IZIN,
                                                    KESINTI: x.KES,
                                                    TOPLAM: x.TOPLAM,
                                                })),
                                                [
                                                    { key: "kullanici", label: "Kullanıcı" },
                                                    { key: "IZIN", label: "İzin" },
                                                    { key: "KESINTI", label: "Kesinti" },
                                                    { key: "TOPLAM", label: "Toplam" },
                                                ]
                                            )
                                        }
                                        disabled={!addedAgg.length}
                                    >
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1, flex: 1, overflow: "auto" }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow sx={rowSX}>
                                                <TableCell>#</TableCell>
                                                <TableCell>Kullanıcı</TableCell>
                                                <TableCell align="right">İzin</TableCell>
                                                <TableCell align="right">Kesinti</TableCell>
                                                <TableCell align="right">Toplam</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {addedAgg.map((r, i) => (
                                                <TableRow key={r.user || i} sx={rowSX}>
                                                    <TableCell width={32}>{i + 1}</TableCell>
                                                    <TableCell sx={nameCellSX}>{r.user || "—"}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" label={r.IZIN} sx={{ height: 22 }} />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" label={r.KES} sx={{ height: 22 }} />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" color="info" label={r.TOPLAM} sx={{ height: 22 }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {!addedAgg.length && (
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
                    </Grid>

                    {/* GÜNLÜK PANELLER */}
                    <Divider sx={{ my: 3, opacity: 0.2 }} />
                    <Grid container spacing={2.4}>
                        {/* Günlük — Tüm kullanıcılar */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Günlük — Tüm kullanıcılar
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `kpi_gunluk_tum.csv`,
                                                dailyAll.map((d) => ({ tarih: d.date, BOS: d.BOS, SFR: d.SFR, TOPLAM: d.TOPLAM })),
                                                [
                                                    { key: "tarih", label: "Tarih" },
                                                    { key: "BOS", label: "BOS" },
                                                    { key: "SFR", label: "SFR" },
                                                    { key: "TOPLAM", label: "Toplam" },
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
                                                <TableCell>Tarih</TableCell>
                                                <TableCell align="right">BOS</TableCell>
                                                <TableCell align="right">SFR</TableCell>
                                                <TableCell align="right">Toplam</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dailyAll.map((d) => (
                                                <TableRow key={d.date} sx={rowSX}>
                                                    <TableCell>{d.date}</TableCell>
                                                    <TableCell align="right">{d.BOS}</TableCell>
                                                    <TableCell align="right">{d.SFR}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" color="info" label={d.TOPLAM} sx={{ height: 22 }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {dailyAll.length === 0 && (
                                                <TableRow sx={rowSX}>
                                                    <TableCell colSpan={4}>
                                                        <Typography sx={{ opacity: 0.7 }}>Kayıt yok.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Box>
                            </Paper>
                        </Grid>

                        {/* Günlük — Seçili kullanıcı */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Paper elevation={0} sx={{ ...panelSX, height: 420, display: "flex", flexDirection: "column" }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Günlük — {selectedUser || "Kullanıcı seçiniz"}
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() =>
                                            downloadCSV(
                                                `kpi_gunluk_${(selectedUser || "kullanici").replace(/\s+/g, "_")}.csv`,
                                                dailyForUser.map((d) => ({ tarih: d.date, BOS: d.BOS, SFR: d.SFR, TOPLAM: d.TOPLAM })),
                                                [
                                                    { key: "tarih", label: "Tarih" },
                                                    { key: "BOS", label: "BOS" },
                                                    { key: "SFR", label: "SFR" },
                                                    { key: "TOPLAM", label: "Toplam" },
                                                ]
                                            )
                                        }
                                        disabled={!selectedUser}
                                    >
                                        CSV
                                    </Button>
                                </Stack>
                                <Box sx={{ mt: 1, flex: 1, overflow: "auto" }}>
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
                                                <TableRow key={d.date} sx={rowSX}>
                                                    <TableCell>{d.date}</TableCell>
                                                    <TableCell align="right">{d.BOS}</TableCell>
                                                    <TableCell align="right">{d.SFR}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" color="info" label={d.TOPLAM} sx={{ height: 22 }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {dailyForUser.length === 0 && (
                                                <TableRow sx={rowSX}>
                                                    <TableCell colSpan={4}>
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
                </Container>
            </Box>
        </Box>
    );
}
