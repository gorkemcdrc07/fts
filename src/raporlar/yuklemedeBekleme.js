import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// Dayjs
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import "dayjs/locale/tr";

// Excel
import * as XLSX from "xlsx";

// MUI
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Divider,
    Drawer,
    Grid,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Stack,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

// DataGrid
import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarQuickFilter,
} from "@mui/x-data-grid";

// Icons
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";

// ===================== Dayjs Setup =====================
dayjs.extend(duration);
dayjs.locale("tr");

/*
============================================================
  AMAÇ
  - Mevcut dosyayı daha anlaşılır bir yapıya kavuşturmak
  - SORU: "Burası çok anlaşılmıyor" → ÇÖZÜM:
    * Net isimlendirme
    * Yardımcı fonksiyonları grupla
    * UI parçalarını küçük bileşenlere böl
    * Veri toplama (fetch) akışını sadeleştir
    * Yorumlar ile niyet belirt
============================================================
*/

/* ===================== Sabitler / Şemalar ===================== */
const DETAIL_TABLES = [
    { table: "sefer_detaylari", label: "sefer_detaylari" },
    { table: "tamamlanan_detaylar", label: "tamamlanan_detaylar" },
];

const SUMMARY_TABLES = [
    { table: "seferler", label: "seferler", group: "aktif" },
    { table: "tamamlanan_seferler", label: "tamamlanan_seferler", group: "tamamlanan" },
];

/* ===================== Yardımcılar ===================== */
const parseDT = (v) => {
    if (!v && v !== 0) return null;
    const d = dayjs(v);
    return d.isValid() ? d : null;
};

const diffMinutes = (start, end) => {
    const s = parseDT(start);
    const e = parseDT(end);
    if (!s || !e) return null;
    const m = e.diff(s, "minute");
    return Number.isFinite(m) && m >= 0 ? m : null;
};

const fmtDateTR = (v) => {
    const d = parseDT(v);
    return d ? d.format("DD.MM.YYYY HH:mm") : "—";
};

const fmtMinutes = (min) => {
    if (min === null || min === undefined) return "—";
    const h = Math.floor(min / 60);
    const m = Math.floor(min % 60);
    if (h <= 0) return `${m} dk`;
    return `${h} sa ${m.toString().padStart(2, "0")} dk`;
};

const firstOf = (obj, keys) => {
    for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null && v !== "") return v;
    }
    return null;
};

const prettyKey = (k) =>
    String(k)
        .replace(/_/g, " ")
        .replace(/(\b\w)/g, (m) => m.toUpperCase());

const waitSeverity = (min) => {
    if (min == null) return { level: "none", label: "—" };
    if (min >= 240) return { level: "critical", label: "Çok Uzun" };
    if (min >= 120) return { level: "high", label: "Uzun" };
    if (min >= 60) return { level: "mid", label: "Orta" };
    return { level: "low", label: "Kısa" };
};

const extractDriver = (r, fallback = {}) => {
    const sofor_ad =
        firstOf(r, [
            "surucu_ad_so",
            "surucu_ad_soyad",
            "surucu_adi",
            "surucu",
            "sofor",
            "sofor_ad",
        ]) ?? firstOf(fallback, ["surucu_ad_so", "surucu_adi", "surucu", "sofor", "sofor_ad"]);

    const sofor_tel =
        firstOf(r, [
            "surucu_telefo",
            "surucu_telefon",
            "surucu_tel",
            "driver_phone",
            "gsm",
            "telefon",
        ]) ?? firstOf(fallback, ["surucu_telefo", "surucu_telefon", "surucu_tel", "driver_phone", "gsm", "telefon"]);

    const tasiyici_firma =
        firstOf(r, ["tasiyici_firma", "tasiyici", "tasiyici_adi", "carrier", "firma"]) ??
        firstOf(fallback, ["tasiyici_firma", "tasiyici", "tasiyici_adi", "carrier", "firma"]);

    return { sofor_ad: sofor_ad || null, sofor_tel: sofor_tel || null, tasiyici_firma: tasiyici_firma || null };
};

/* ===================== Küçük UI Bileşenleri ===================== */
const WaitChip = ({ minutes }) => {
    const sev = waitSeverity(minutes);
    const chipProps = { size: "small", label: fmtMinutes(minutes), variant: "outlined" };
    if (sev.level === "critical") return <Chip color="error" {...chipProps} />;
    if (sev.level === "high") return <Chip color="warning" {...chipProps} />;
    if (sev.level === "mid") return <Chip color="default" {...chipProps} />;
    return <Chip {...chipProps} />;
};

const ExcelToolbar = ({ onExport, onRefresh, disabled }) => (
    <GridToolbarContainer sx={{ p: 1 }}>
        <GridToolbarQuickFilter
            quickFilterParser={(v) => v.split(/\s+/).filter(Boolean)}
            debounceMs={300}
            placeholder="Sefer / plaka / şoför / il içinde ara…"
        />
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="CSV/Excel">
            <span>
                <Button size="small" startIcon={<DownloadIcon />} variant="outlined" onClick={onExport}>
                    Excel
                </Button>
            </span>
        </Tooltip>
        <Tooltip title="Yenile">
            <span>
                <IconButton onClick={onRefresh} disabled={disabled}>
                    <RefreshIcon />
                </IconButton>
            </span>
        </Tooltip>
    </GridToolbarContainer>
);

/* ===================== Ana Bileşen ===================== */
export default function YuklemedeBekleme() {
    // --- State ---
    const [rows, setRows] = useState([]);
    const [detailByNo, setDetailByNo] = useState(new Map()); // sefer_no -> detay[]
    const [loading, setLoading] = useState(true);

    // Filtreler
    const [q, setQ] = useState("");
    const [kaynak, setKaynak] = useState("");
    const [minDakika, setMinDakika] = useState("");
    const [dateFrom, setDateFrom] = useState(""); // yyyy-mm-dd
    const [dateTo, setDateTo] = useState("");
    const [sekme, setSekme] = useState("aktif"); // aktif | tamamlanan | tum
    const [gorunum, setGorunum] = useState("liste"); // liste | ozet

    // Detay drawer
    const [openDrawer, setOpenDrawer] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    const openDetail = (row) => {
        setSelectedRow(row);
        setOpenDrawer(true);
    };
    const closeDetail = () => {
        setOpenDrawer(false);
        setSelectedRow(null);
    };

    // --- Data Fetch ---
    const fetchAll = useCallback(async () => {
        setLoading(true);

        // Detay tablolarını paralelde çek
        const detailPromises = DETAIL_TABLES.map((t) =>
            supabase.from(t.table).select("*").then(({ data, error }) => ({ t, data: data || [], error }))
        );

        const summaryPromises = SUMMARY_TABLES.map((t) =>
            supabase.from(t.table).select("*").then(({ data, error }) => ({ t, data: data || [], error }))
        );

        const [detailResults, summaryResults] = await Promise.all([
            Promise.all(detailPromises),
            Promise.all(summaryPromises),
        ]);

        // 1) Detayları sefer_no -> [] map'ine koy
        const byNo = new Map();
        detailResults.forEach(({ t, data, error }) => {
            if (error) {
                console.warn(`${t.table} alınamadı:`, error.message);
                return;
            }
            data.forEach((r) => {
                const sefer_no = firstOf(r, ["sefer_no", "SeferNo", "seferNo"]) || null;
                if (!sefer_no) return;
                if (!byNo.has(sefer_no)) byNo.set(sefer_no, []);
                byNo.get(sefer_no).push({ kaynak: t.label, ...r });
            });
        });

        // Nokta sırasına göre sırala
        for (const [, arr] of byNo.entries()) {
            arr.sort((a, b) => (a.nokta_sirasi ?? 999) - (b.nokta_sirasi ?? 999));
        }

        // 2) Özet tablolardan satırları üret
        const all = [];
        summaryResults.forEach(({ t, data, error }) => {
            if (error) {
                console.warn(`${t.table} alınamadı:`, error.message);
                return;
            }

            (data || []).forEach((r, i) => {
                const sefer_no = firstOf(r, ["sefer_no"]) || `NO-${t.label}-${r.id ?? i}`;
                const detList = byNo.get(sefer_no) || [];
                const firstDet = detList[0] || {};

                // zamanlar sadece detayda -> 1. noktanın varış/çıkışını kullan
                const yukleme_varis = firstOf(firstDet, ["yukleme_varis"]) ?? null;
                const yukleme_cikis = firstOf(firstDet, ["yukleme_cikis"]) ?? null;
                const bekleme_dk = diffMinutes(yukleme_varis, yukleme_cikis);

                // lokasyon
                const yukleme_il = firstOf(r, ["yukleme_ili"]) ?? firstOf(firstDet, ["yukleme_ili", "yukleme_il"]);
                const yukleme_ilce = firstOf(r, ["yukleme_ilcesi"]) ?? firstOf(firstDet, ["yukleme_ilcesi", "yukleme_ilce"]);
                const teslim_il = firstOf(r, ["teslim_ili"]) ?? firstOf(firstDet, ["teslim_ili", "teslim_il"]);
                const teslim_ilce = firstOf(r, ["teslim_ilcesi"]) ?? firstOf(firstDet, ["teslim_ilcesi", "teslim_ilce"]);

                const yukleme_nokta = firstOf(r, ["yukleme_nokl", "yukleme_nokta"]) ?? firstOf(firstDet, ["yukleme_nokta", "yukleme_nokl"]);
                const teslim_nokta = firstOf(r, ["teslim_noktas"]) ?? firstOf(firstDet, ["teslim_noktas", "teslim_nokta"]);

                const gecikme_nedeni = firstOf(r, ["gecikme_nedeni", "gecikme"]) ?? firstOf(firstDet, ["gecikme_nedeni", "gecikme"]);

                const { sofor_ad, sofor_tel, tasiyici_firma } = extractDriver(r, firstDet);

                all.push({
                    id: `${t.label}-${r.id ?? i}`,
                    kaynak: t.label,
                    grup: t.group, // aktif | tamamlanan
                    orijinal_id: r.id ?? null,
                    sefer_no,
                    plaka: firstOf(r, ["plaka"]) ?? null,
                    sofor_ad,
                    sofor_tel,
                    tasiyici_firma,
                    yukleme_varis,
                    yukleme_cikis,
                    bekleme_dk,
                    yukleme_il,
                    yukleme_ilce,
                    teslim_il,
                    teslim_ilce,
                    yukleme_nokta,
                    teslim_nokta,
                    gecikme_nedeni,
                    _raw: r,
                });
            });
        });

        // 3) Temizlik + dedup (aynı sefer_no için en uzun bekleme)
        const cleaned = all.filter((x) => x.bekleme_dk !== null);
        const dedup = Object.values(
            cleaned.reduce((acc, r) => {
                const key = r.sefer_no || r.id;
                if (!acc[key] || (acc[key].bekleme_dk ?? 0) < (r.bekleme_dk ?? 0)) acc[key] = r;
                return acc;
            }, {})
        );

        setDetailByNo(byNo);
        setRows(dedup);
        setLoading(false);
    }, []);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            await fetchAll();
            if (!isMounted) return;
        })();
        return () => {
            isMounted = false;
        };
    }, [fetchAll]);

    // --- Filtrelenmiş satırlar ---
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();

        return rows
            .filter((r) => {
                if (sekme !== "tum" && r.grup !== sekme) return false;
                if (kaynak && r.kaynak !== kaynak) return false;
                if (minDakika && Number(r.bekleme_dk) < Number(minDakika)) return false;

                if (dateFrom) {
                    const rv = parseDT(r.yukleme_varis);
                    if (!rv || rv.isBefore(dayjs(dateFrom).startOf("day"))) return false;
                }
                if (dateTo) {
                    const rv = parseDT(r.yukleme_varis);
                    if (!rv || rv.isAfter(dayjs(dateTo).endOf("day"))) return false;
                }

                if (!term) return true;
                const hit =
                    String(r.sefer_no || "").toLowerCase().includes(term) ||
                    String(r.plaka || "").toLowerCase().includes(term) ||
                    String(r.sofor_ad || "").toLowerCase().includes(term) ||
                    String(r.sofor_tel || "").toLowerCase().includes(term) ||
                    String(r.kaynak || "").toLowerCase().includes(term) ||
                    String(r.yukleme_il || "").toLowerCase().includes(term) ||
                    String(r.teslim_il || "").toLowerCase().includes(term) ||
                    String(r.tasiyici_firma || "").toLowerCase().includes(term);
                return hit;
            })
            .sort((a, b) => (b.bekleme_dk ?? 0) - (a.bekleme_dk ?? 0));
    }, [rows, q, kaynak, minDakika, dateFrom, dateTo, sekme]);

    // --- KPI'lar ---
    const stats = useMemo(() => {
        const n = filtered.length;
        if (!n) return { adet: 0, ort_dk: 0, medyan_dk: 0, max_dk: 0 };
        const ary = filtered.map((r) => r.bekleme_dk).sort((a, b) => a - b);
        const sum = ary.reduce((a, c) => a + c, 0);
        const ort = Math.round((sum / n) * 100) / 100;
        const medyan = n % 2 === 1 ? ary[(n - 1) / 2] : Math.round(((ary[n / 2 - 1] + ary[n / 2]) / 2) * 100) / 100;
        const max = ary[ary.length - 1];
        return { adet: n, ort_dk: ort, medyan_dk: medyan, max_dk: max };
    }, [filtered]);

    // --- Özetler (Plaka/Şoför) ---
    const { byPlaka, bySofor } = useMemo(() => {
        const group = (key) => {
            const map = new Map();
            filtered.forEach((r) => {
                const k = (r[key] || "Bilinmiyor").toString();
                if (!map.has(k)) map.set(k, []);
                map.get(k).push(r);
            });
            const arr = Array.from(map.entries()).map(([k, list]) => {
                const minutes = list.map((x) => x.bekleme_dk).sort((a, b) => a - b);
                const toplam = minutes.reduce((a, c) => a + c, 0);
                const ort = Math.round((toplam / minutes.length) * 100) / 100;
                const medyan =
                    minutes.length % 2 === 1
                        ? minutes[(minutes.length - 1) / 2]
                        : Math.round(((minutes[minutes.length / 2 - 1] + minutes[minutes.length / 2]) / 2) * 100) / 100;
                const max = minutes[minutes.length - 1] ?? 0;
                const last = list
                    .slice()
                    .sort((a, b) => dayjs(b.yukleme_varis).valueOf() - dayjs(a.yukleme_varis).valueOf())[0];
                return {
                    id: k,
                    key: k,
                    adet: list.length,
                    toplam_dk: toplam,
                    ort_dk: ort,
                    medyan_dk: medyan,
                    max_dk: max,
                    son_varis: last?.yukleme_varis || null,
                    ornek_sefer: last?.sefer_no || "",
                };
            });
            arr.sort((a, b) => b.toplam_dk - a.toplam_dk);
            return arr;
        };

        return { byPlaka: group("plaka"), bySofor: group("sofor_ad") };
    }, [filtered]);

    /* ===================== Kolonlar ===================== */
    const columns = [
        {
            field: "grup",
            headerName: "Durum",
            width: 110,
            renderCell: (p) => (
                <Chip
                    size="small"
                    label={p.value === "tamamlanan" ? "Tamamlanan" : "Aktif"}
                    color={p.value === "tamamlanan" ? "success" : "info"}
                    variant="outlined"
                />
            ),
            sortable: false,
        },
        {
            field: "sefer_no",
            headerName: "Sefer No",
            width: 160,
            renderCell: (p) => (
                <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={() => openDetail(p.row)}>
                    {p.value || "—"}
                </Button>
            ),
        },
        {
            field: "plaka",
            headerName: "Plaka",
            width: 140,
            renderCell: (p) => (
                <Stack direction="row" spacing={0.75} alignItems="center">
                    <LocalShippingIcon sx={{ opacity: 0.7 }} fontSize="small" />
                    <Typography>{p.value || "—"}</Typography>
                </Stack>
            ),
        },
        {
            field: "sofor_ad",
            headerName: "Şoför",
            width: 190,
            renderCell: (p) => (
                <Stack direction="row" spacing={0.75} alignItems="center">
                    <PersonOutlineIcon sx={{ opacity: 0.7 }} fontSize="small" />
                    <Typography>{p.value || "—"}</Typography>
                </Stack>
            ),
        },
        { field: "sofor_tel", headerName: "Telefon", width: 150 },
        { field: "tasiyici_firma", headerName: "Taşıyıcı", width: 180 },
        { field: "kaynak", headerName: "Kaynak", width: 170 },
        { field: "yukleme_varis", headerName: "Yükleme Varış", width: 170, valueFormatter: (p) => fmtDateTR(p.value) },
        { field: "yukleme_cikis", headerName: "Yükleme Çıkış", width: 170, valueFormatter: (p) => fmtDateTR(p.value) },
        {
            field: "bekleme_dk",
            headerName: "Bekleme",
            width: 160,
            sortComparator: (a, b) => (a ?? -1) - (b ?? -1),
            renderCell: (p) => <WaitChip minutes={p.value} />,
        },
        {
            field: "yukleme_il_ilce",
            headerName: "Yükleme İl/İlçe",
            width: 190,
            valueGetter: (p) => {
                const r = p?.row ?? {};
                const t = [r.yukleme_il || r.yukleme_ili, r.yukleme_ilce || r.yukleme_ilcesi].filter(Boolean).join(" / ");
                return t || "—";
            },
            sortable: false,
        },
        {
            field: "teslim_il_ilce",
            headerName: "Teslim İl/İlçe",
            width: 190,
            valueGetter: (p) => {
                const r = p?.row ?? {};
                const t = [r.teslim_il || r.teslim_ili, r.teslim_ilce || r.teslim_ilcesi].filter(Boolean).join(" / ");
                return t || "—";
            },
            sortable: false,
        },
        { field: "yukleme_nokta", headerName: "Yükleme Noktası", width: 220 },
        { field: "teslim_nokta", headerName: "Teslim Noktası", width: 220 },
        { field: "gecikme_nedeni", headerName: "Gecikme Nedeni", width: 220 },
    ];

    const sumColsCommon = [
        { field: "key", headerName: "Anahtar", width: 200 },
        { field: "adet", headerName: "Adet", width: 90, type: "number" },
        { field: "toplam_dk", headerName: "Toplam Bekleme", width: 170, type: "number", valueFormatter: (p) => fmtMinutes(p.value) },
        { field: "ort_dk", headerName: "Ortalama", width: 140, type: "number", valueFormatter: (p) => fmtMinutes(Math.round(p.value)) },
        { field: "medyan_dk", headerName: "Medyan", width: 140, type: "number", valueFormatter: (p) => fmtMinutes(Math.round(p.value)) },
        {
            field: "max_dk",
            headerName: "Maks",
            width: 130,
            type: "number",
            valueFormatter: (p) => fmtMinutes(p.value),
            renderCell: (p) => <WaitChip minutes={p.row.max_dk} />,
        },
        { field: "son_varis", headerName: "Son Varış", width: 170, valueFormatter: (p) => fmtDateTR(p.value) },
        { field: "ornek_sefer", headerName: "Örnek Sefer", width: 160 },
        {
            field: "action",
            headerName: "Detaya Git",
            width: 140,
            sortable: false,
            renderCell: (p) => (
                <Button size="small" onClick={() => { setQ(p.row.key); setGorunum("liste"); }}>
                    Listeyi Filtrele
                </Button>
            ),
        },
    ];
    const sumColsPlaka = [{ field: "key", headerName: "Plaka", width: 160 }, ...sumColsCommon.slice(1)];
    const sumColsSofor = [{ field: "key", headerName: "Şoför", width: 200 }, ...sumColsCommon.slice(1)];

    /* ===================== Excel Export ===================== */
    const handleExport = () => {
        if (!filtered.length) return;
        const data = filtered.map((r) => ({
            Durum: r.grup === "tamamlanan" ? "Tamamlanan" : "Aktif",
            Kaynak: r.kaynak,
            ID: r.orijinal_id ?? "",
            "Sefer No": r.sefer_no ?? "",
            Plaka: r.plaka ?? "",
            "Şoför": r.sofor_ad ?? "",
            "Şoför GSM": r.sofor_tel ?? "",
            "Taşıyıcı": r.tasiyici_firma ?? "",
            "Yükleme Varış": fmtDateTR(r.yukleme_varis),
            "Yükleme Çıkış": fmtDateTR(r.yukleme_cikis),
            "Bekleme (dk)": r.bekleme_dk ?? "",
            "Bekleme (formatlı)": fmtMinutes(r.bekleme_dk),
            "Yükleme İl": r.yukleme_il || r.yukleme_ili || "",
            "Yükleme İlçe": r.yukleme_ilce || r.yukleme_ilcesi || "",
            "Yükleme Noktası": r.yukleme_nokta ?? "",
            "Teslim İl": r.teslim_il || r.teslim_ili || "",
            "Teslim İlçe": r.teslim_ilce || r.teslim_ilcesi || "",
            "Teslim Noktası": r.teslim_nokta ?? "",
            "Gecikme Nedeni": r.gecikme_nedeni ?? "",
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "YuklemedeBekleme");
        XLSX.writeFile(wb, `yuklemede_bekleme_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
    };

    /* ===================== Zaman Çizelgesi (Drawer) ===================== */
    const timelineItems = useMemo(() => {
        if (!selectedRow) return [];
        const list = [];

        [["Yükleme Varış", selectedRow.yukleme_varis], ["Yükleme Çıkış", selectedRow.yukleme_cikis]].forEach(([label, val]) => {
            const d = parseDT(val);
            if (d) list.push({ label, key: label, dt: d.toISOString() });
        });

        const det = detailByNo.get(selectedRow.sefer_no) || [];
        det.forEach((rec) => {
            Object.entries(rec).forEach(([k, v]) => {
                const d = parseDT(v);
                if (!d) return;
                list.push({ label: prettyKey(k), key: k, dt: d.toISOString() });
            });
        });

        const uniq = Object.values(
            list.reduce((acc, x) => {
                const key = `${x.key}-${x.dt}`;
                if (!acc[key]) acc[key] = x;
                return acc;
            }, {})
        ).sort((a, b) => dayjs(a.dt).valueOf() - dayjs(b.dt).valueOf());

        return uniq.map((x, i) => ({ ...x, delta: i > 0 ? dayjs(x.dt).diff(dayjs(uniq[i - 1].dt), "minute") : null }));
    }, [selectedRow, detailByNo]);

    /* ===================== Render ===================== */
    return (
        <Box
            sx={{
                minHeight: "100dvh",
                py: { xs: 2, md: 4 },
                background: (t) =>
                    t.palette.mode === "dark"
                        ? "linear-gradient(180deg,#0b1020,#0e1428)"
                        : "linear-gradient(180deg,#f6f9ff,#f4f7ff)",
            }}
        >
            <Container maxWidth={false} sx={{ maxWidth: "1680px", px: { xs: 2, md: 4 } }}>
                <Paper
                    elevation={6}
                    sx={{
                        borderRadius: 4,
                        overflow: "hidden",
                        backdropFilter: "saturate(140%) blur(10px)",
                        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
                        border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                    }}
                >
                    {/* Üst şerit */}
                    <Box
                        sx={{
                            px: { xs: 2, md: 3 },
                            py: { xs: 1.5, md: 2.25 },
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 2,
                            flexWrap: "wrap",
                        }}
                    >
                        <Typography variant="h6" fontWeight={800}>
                            Yüklemede Bekleme Süreleri
                        </Typography>

                        <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                            <Chip variant="outlined" label={`Kayıt: ${filtered.length}`} />
                            <Chip variant="outlined" label={`Ort.: ${fmtMinutes(Math.round(stats.ort_dk))}`} />
                            <Chip variant="outlined" label={`Medyan: ${fmtMinutes(Math.round(stats.medyan_dk))}`} />
                            <Chip color="warning" variant="outlined" label={`Maks.: ${fmtMinutes(stats.max_dk)}`} />
                        </Stack>
                    </Box>

                    {/* Sekmeler */}
                    <Box sx={{ px: { xs: 2, md: 3 } }}>
                        <Tabs value={sekme} onChange={(_, v) => setSekme(v)} sx={{ mb: 1 }}>
                            <Tab value="aktif" label="Aktif" />
                            <Tab value="tamamlanan" label="Tamamlanan" />
                            <Tab value="tum" label="Tümü" />
                        </Tabs>
                    </Box>

                    {/* Filtre bar */}
                    <Box
                        sx={{
                            px: { xs: 2, md: 3 },
                            pb: { xs: 1.5, md: 2 },
                            display: "grid",
                            gap: 1.25,
                            gridTemplateColumns: "repeat(12, 1fr)",
                            alignItems: "center",
                        }}
                    >
                        <TextField
                            label="Ara (sefer / plaka / şoför / il)"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            size="small"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ opacity: 0.7 }} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ gridColumn: { xs: "1 / -1", md: "1 / span 4" } }}
                        />

                        <TextField
                            select
                            label="Kaynak"
                            value={kaynak}
                            onChange={(e) => setKaynak(e.target.value)}
                            size="small"
                            sx={{ gridColumn: { xs: "1 / span 6", md: "5 / span 2" } }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <FilterAltIcon sx={{ opacity: 0.7 }} />
                                    </InputAdornment>
                                ),
                            }}
                        >
                            <MenuItem value="">(Hepsi)</MenuItem>
                            <MenuItem value="seferler">seferler</MenuItem>
                            <MenuItem value="tamamlanan_seferler">tamamlanan_seferler</MenuItem>
                        </TextField>

                        <TextField
                            label="Min. Bekleme (dk)"
                            type="number"
                            value={minDakika}
                            onChange={(e) => setMinDakika(e.target.value)}
                            size="small"
                            sx={{ gridColumn: { xs: "7 / span 6", md: "7 / span 2" } }}
                        />

                        <TextField
                            label="Başlangıç (Varış tarihi)"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            size="small"
                            sx={{ gridColumn: { xs: "1 / span 6", md: "9 / span 2" } }}
                        />

                        <TextField
                            label="Bitiş (Varış tarihi)"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            size="small"
                            sx={{ gridColumn: { xs: "7 / span 6", md: "11 / span 2" } }}
                        />
                    </Box>

                    {/* KPI kutuları */}
                    <Box sx={{ px: { xs: 2, md: 3 }, pb: 1 }}>
                        <Grid container spacing={1.5}>
                            {[
                                { label: "Kayıt", value: filtered.length },
                                { label: "Ortalama Bekleme", value: fmtMinutes(Math.round(stats.ort_dk)) },
                                { label: "Medyan Bekleme", value: fmtMinutes(Math.round(stats.medyan_dk)) },
                                { label: "Maksimum Bekleme", value: fmtMinutes(stats.max_dk) },
                            ].map((k, i) => (
                                <Grid item xs={12} sm={6} md={3} key={i}>
                                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                        <CardContent>
                                            <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                                {k.label}
                                            </Typography>
                                            <Typography variant="h5" fontWeight={800}>
                                                {k.value}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    {/* Görünüm sekmeleri */}
                    <Box sx={{ px: { xs: 2, md: 3 } }}>
                        <Tabs value={gorunum} onChange={(_, v) => setGorunum(v)} sx={{ mb: 1 }}>
                            <Tab value="liste" label="Liste" />
                            <Tab value="ozet" label="Kim bekleme yapmış? (Özet)" />
                        </Tabs>
                    </Box>

                    {/* LİSTE */}
                    {gorunum === "liste" ? (
                        <Box sx={{ height: "66vh", px: { xs: 1, md: 2 }, pb: 2 }}>
                            <DataGrid
                                rows={filtered}
                                columns={columns}
                                disableRowSelectionOnClick
                                loading={loading}
                                density="compact"
                                pageSizeOptions={[10, 25, 50, 100]}
                                initialState={{
                                    pagination: { paginationModel: { page: 0, pageSize: 25 } },
                                    sorting: { sortModel: [{ field: "bekleme_dk", sort: "desc" }] },
                                    columns: {
                                        columnVisibilityModel: { sofor_tel: true, tasiyici_firma: true },
                                    },
                                    pinnedColumns: { left: ["sefer_no", "plaka", "sofor_ad"] },
                                }}
                                slots={{
                                    toolbar: () => (
                                        <ExcelToolbar onExport={handleExport} onRefresh={fetchAll} disabled={loading} />
                                    )
                                }}
                                sx={{
                                    border: 0,
                                    "& .MuiDataGrid-columnHeaders": {
                                        position: "sticky",
                                        top: 0,
                                        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
                                        backdropFilter: "blur(6px)",
                                        zIndex: 1,
                                    },
                                }}
                            />
                        </Box>
                    ) : (
                        // ÖZET
                        <Box sx={{ px: { xs: 1, md: 2 }, pb: 2 }}>
                            <Grid container spacing={1.5}>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined" sx={{ borderRadius: 3, height: "64vh" }}>
                                        <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                                            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                                Plaka Bazlı Özet
                                            </Typography>
                                            <Box sx={{ flex: 1 }}>
                                                <DataGrid
                                                    rows={byPlaka}
                                                    columns={sumColsPlaka}
                                                    density="compact"
                                                    disableRowSelectionOnClick
                                                    pageSizeOptions={[10, 25, 50]}
                                                    initialState={{
                                                        pagination: { paginationModel: { page: 0, pageSize: 10 } },
                                                        sorting: { sortModel: [{ field: "toplam_dk", sort: "desc" }] },
                                                    }}
                                                    sx={{ border: 0 }}
                                                />
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined" sx={{ borderRadius: 3, height: "64vh" }}>
                                        <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                                            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                                Şoför Bazlı Özet
                                            </Typography>
                                            <Box sx={{ flex: 1 }}>
                                                <DataGrid
                                                    rows={bySofor}
                                                    columns={sumColsSofor}
                                                    density="compact"
                                                    disableRowSelectionOnClick
                                                    pageSizeOptions={[10, 25, 50]}
                                                    initialState={{
                                                        pagination: { paginationModel: { page: 0, pageSize: 10 } },
                                                        sorting: { sortModel: [{ field: "toplam_dk", sort: "desc" }] },
                                                    }}
                                                    sx={{ border: 0 }}
                                                />
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    )}
                </Paper>
            </Container>

            {/* Detay çekmecesi */}
            <Drawer anchor="right" open={openDrawer} onClose={closeDetail} PaperProps={{ sx: { width: { xs: "100%", md: 520 } } }}>
                <Box sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6" fontWeight={800}>
                            Sefer Detayı
                        </Typography>
                        <Button onClick={closeDetail}>Kapat</Button>
                    </Stack>

                    <Divider sx={{ my: 1.5 }} />

                    {selectedRow ? (
                        <Stack spacing={1.25}>
                            <Typography variant="subtitle2" sx={{ opacity: 0.75 }}>
                                Sefer No
                            </Typography>
                            <Typography variant="h6">{selectedRow.sefer_no}</Typography>

                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                <Chip label={`Plaka: ${selectedRow.plaka || "—"}`} />
                                <Chip label={`Şoför: ${selectedRow.sofor_ad || "—"}`} />
                                {selectedRow.sofor_tel ? <Chip label={`GSM: ${selectedRow.sofor_tel}`} /> : null}
                                {selectedRow.tasiyici_firma ? <Chip label={`Taşıyıcı: ${selectedRow.tasiyici_firma}`} /> : null}
                                <Chip
                                    label={selectedRow.grup === "tamamlanan" ? "Tamamlanan" : "Aktif"}
                                    color={selectedRow.grup === "tamamlanan" ? "success" : "info"}
                                    variant="outlined"
                                />
                                <Chip color="warning" label={`Bekleme: ${fmtMinutes(selectedRow.bekleme_dk)}`} />
                            </Stack>

                            <Divider sx={{ my: 1 }} />

                            <Typography variant="subtitle2" sx={{ opacity: 0.75 }}>
                                Yükleme / Teslim
                            </Typography>
                            <Typography>
                                <b>Yükleme:</b> {selectedRow.yukleme_nokta || "—"} ({[(selectedRow.yukleme_il || selectedRow.yukleme_ili), (selectedRow.yukleme_ilce || selectedRow.yukleme_ilcesi)].filter(Boolean).join(" / ") || "—"})
                            </Typography>
                            <Typography>
                                <b>Teslim:</b> {selectedRow.teslim_nokta || "—"} ({[(selectedRow.teslim_il || selectedRow.teslim_ili), (selectedRow.teslim_ilce || selectedRow.teslim_ilcesi)].filter(Boolean).join(" / ") || "—"})
                            </Typography>
                            <Typography>
                                <b>Gecikme Nedeni:</b> {selectedRow.gecikme_nedeni || "—"}
                            </Typography>

                            <Divider sx={{ my: 1 }} />

                            <Typography variant="subtitle2" sx={{ opacity: 0.75 }}>
                                Zaman Çizelgesi
                            </Typography>
                            <Stack spacing={0.75}>
                                {timelineItems.length ? (
                                    timelineItems.map((it, idx) => (
                                        <Box key={`${it.key}-${it.dt}-${idx}`} sx={{ p: 1, borderRadius: 1.5, bgcolor: "action.hover" }}>
                                            <Typography fontWeight={600}>{it.label}</Typography>
                                            <Typography variant="body2">
                                                {fmtDateTR(it.dt)} {typeof it.delta === "number" && idx > 0 ? ` • Öncekine göre +${fmtMinutes(it.delta)}` : ""}
                                            </Typography>
                                        </Box>
                                    ))
                                ) : (
                                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                        Bu sefere ait zaman detayları bulunamadı.
                                    </Typography>
                                )}
                            </Stack>
                        </Stack>
                    ) : null}
                </Box>
            </Drawer>
        </Box>
    );
}
