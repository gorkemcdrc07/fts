// src/tamamlananseferler/TamamlananlarPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

/* MUI */
import {
    Box, Paper, Stack, Typography, Button, Drawer, IconButton, Divider,
    Table, TableHead, TableRow, TableCell, TableBody,
    CircularProgress, TextField, Tooltip, useMediaQuery, useTheme
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SummarizeIcon from "@mui/icons-material/Summarize";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { DataGrid } from "@mui/x-data-grid";
import ToolbarLite from "./components/ToolbarLite";
// Diğer helper'ların doğru çalıştığını varsayıyoruz
import { fmtDate, fmtDateText, fmtDateTimeText } from "./utils/datetime";
import DashboardPanel from "./components/DashboardPanel"; // Bu bileşenin iç görünüşünü dışarıdan kontrol etmeliyiz.

const HOME_PATH = "/anasayfa";
const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

// =================================================================
// YENİ HELPER: GÖSTERİM AMAÇLI +3 SAAT DÜZELTME FONKSİYONLARI
// (Zaman hesaplama mantığı aynı kalıyor)
// =================================================================
const fmtDateTimeFixed = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "-";

    let y = d.getUTCFullYear();
    let mo = d.getUTCMonth() + 1;
    let dd = d.getUTCDate();
    let hh = d.getUTCHours();
    let mi = d.getUTCMinutes();

    let totalMinutes = (hh * 60) + mi + (3 * 60);

    const newHH = Math.floor(totalMinutes / 60) % 24;
    const newMI = totalMinutes % 60;
    const daysToAdd = Math.floor(totalMinutes / (24 * 60));

    if (daysToAdd > 0) {
        let tempDate = new Date(Date.UTC(y, mo - 1, dd, 0, 0, 0));
        tempDate.setUTCDate(tempDate.getUTCDate() + daysToAdd);

        y = tempDate.getUTCFullYear();
        mo = tempDate.getUTCMonth() + 1;
        dd = tempDate.getUTCDate();
    }

    const pad = (n) => String(n).padStart(2, "0");

    return `${pad(dd)}.${pad(mo)}.${y} ${pad(newHH)}:${pad(newMI)}`;
};

const fmtDateFixed = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "-";

    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();

    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(dd)}.${pad(mo)}.${y}`;
};


export default function TamamlananlarPage() {
    const theme = useTheme();
    const downMd = useMediaQuery(theme.breakpoints.down("md"));
    const downSm = useMediaQuery(theme.breakpoints.down("sm"));
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [rowCount, setRowCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [dateStart, setDateStart] = useState(startOfMonth);
    const [dateEnd, setDateEnd] = useState(now);

    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 50 });
    const [sortModel, setSortModel] = useState([]);
    const [filterModel, setFilterModel] = useState({ items: [] });

    const [columnVisibilityModel, setColumnVisibilityModel] = useState({});

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailRows, setDetailRows] = useState([]);
    const [selected, setSelected] = useState(null);

    const [analysis, setAnalysis] = useState({
        bySefer: {},
        summary: { early: 0, ontime: 0, late: 0, avgDelayMin: 0, avgEarlyMin: 0 },
        lateBuckets: [],
    });

    const fetchPage = useCallback(async () => {
        setLoading(true);

        let query = supabase.from("tamamlanan_seferler").select("*", { count: "exact" });
        if (dateStart) query = query.gte("sefer_tarihi", new Date(dateStart).toISOString());
        if (dateEnd) {
            const endIso = new Date(new Date(dateEnd).setHours(23, 59, 59, 999)).toISOString();
            query = query.lte("sefer_tarihi", endIso);
        }

        const qVals = filterModel?.quickFilterValues ?? [];
        if (qVals.length) {
            const q = qVals.join(" ").replace(/%/g, "");
            query = query.or(
                [
                    `sefer_no.ilike.%${q}%`,
                    `plaka.ilike.%${q}%`,
                    `surucu_ad_soyad.ilike.%${q}%`,
                    `musteri_adi.ilike.%${q}%`,
                    `hizmet_adi.ilike.%${q}%`,
                    `proje_adi.ilike.%${q}%`,
                    `yukleme_noktasi.ilike.%${q}%`,
                    `teslim_noktasi.ilike.%${q}%`,
                    `yukleme_ili.ilike.%${q}%`,
                    `yukleme_ilcesi.ilike.%${q}%`,
                    `teslim_ili.ilike.%${q}%`,
                    `teslim_ilcesi.ilike.%${q}%`,
                ].join(",")
            );
        }

        for (const f of filterModel?.items || []) {
            const field = f.field, value = f.value;
            if (!field || value == null || value === "") continue;
            const op = f.operator ?? f.operatorValue ?? "contains";
            if (op === "is" || op === "equals") query = query.eq(field, value);
            else if (op === "startsWith") query = query.ilike(field, `${value}%`);
            else if (op === "endsWith") query = query.ilike(field, `%${value}`);
            else if (op === "isAnyOf" && Array.isArray(value) && value.length) query = query.in(field, value);
            else query = query.ilike(field, `%${value}%`);
        }

        if (sortModel?.length) {
            const s = sortModel[0];
            query = query.order(s.field, { ascending: s.sort !== "desc" });
        } else {
            query = query.order("sefer_tarihi", { ascending: false });
        }

        const from = paginationModel.page * paginationModel.pageSize;
        const to = from + paginationModel.pageSize - 1;
        const { data, count, error } = await query.range(from, to);

        if (!error) {
            setRows(data || []);
            setRowCount(count || 0);

            const seferNos = (data || []).map((r) => r.sefer_no);
            if (seferNos.length) {
                const { data: det } = await supabase
                    .from("tamamlanan_detaylar")
                    .select("sefer_no, teslim_varis")
                    .in("sefer_no", seferNos);

                const maxTeslim = {};
                (det || []).forEach((d) => {
                    if (!d?.sefer_no || !d?.teslim_varis) return;
                    const t = new Date(d.teslim_varis);
                    if (!maxTeslim[d.sefer_no] || t > maxTeslim[d.sefer_no]) {
                        maxTeslim[d.sefer_no] = t;
                    }
                });

                const bySefer = {};
                let early = 0, ontime = 0, late = 0;
                let delayAcc = 0, delayCnt = 0;
                let earlyAcc = 0, earlyCnt = 0;

                const lateBuckets = [
                    { name: "0-30", value: 0 },
                    { name: "31-60", value: 0 },
                    { name: "61-120", value: 0 },
                    { name: "121-240", value: 0 },
                    { name: "241-480", value: 0 },
                    { name: "480+", value: 0 },
                ];

                for (const r of data || []) {
                    const tETA = r?.eta_varis ? new Date(r.eta_varis) : null;
                    const tReal = maxTeslim[r.sefer_no] || null;

                    let status = "ONTIME";
                    let diffMin = 0;

                    if (tETA && tReal) {
                        diffMin = Math.round((tReal - tETA) / 60000);
                        if (diffMin > 5) {
                            status = "LATE"; late++;
                            delayAcc += diffMin; delayCnt++;
                            const abs = diffMin;
                            if (abs <= 30) lateBuckets[0].value++;
                            else if (abs <= 60) lateBuckets[1].value++;
                            else if (abs <= 120) lateBuckets[2].value++;
                            else if (abs <= 240) lateBuckets[3].value++;
                            else if (abs <= 480) lateBuckets[4].value++;
                            else lateBuckets[5].value++;
                        } else if (diffMin < -5) {
                            status = "EARLY"; early++;
                            earlyAcc += Math.abs(diffMin); earlyCnt++;
                        } else {
                            status = "ONTIME"; ontime++;
                        }
                    } else {
                        ontime++;
                    }

                    bySefer[r.sefer_no] = {
                        etaISO: tETA ? tETA.toISOString() : null,
                        maxTeslimISO: tReal ? tReal.toISOString() : null,
                        status,
                        diffMin,
                    };
                }

                setAnalysis({
                    bySefer,
                    summary: {
                        early, ontime, late,
                        avgDelayMin: delayCnt ? delayAcc / delayCnt : 0,
                        avgEarlyMin: earlyCnt ? earlyAcc / earlyCnt : 0,
                    },
                    lateBuckets,
                });
            } else {
                setAnalysis({
                    bySefer: {},
                    summary: { early: 0, ontime: 0, late: 0, avgDelayMin: 0, avgEarlyMin: 0 },
                    lateBuckets: [],
                });
            }
        } else {
            console.error(error);
        }
        setLoading(false);
    }, [dateStart, dateEnd, paginationModel, sortModel, filterModel]);

    useEffect(() => { fetchPage(); }, [fetchPage]);

    // ... (column visibility logic remains the same)
    useEffect(() => {
        if (downSm) {
            setColumnVisibilityModel({
                treyler: false,
                proje_adi: false,
                yukleme_ili: false,
                yukleme_ilcesi: false,
                teslim_ili: false,
                teslim_ilcesi: false,
                atama_yapan_kullanici: false,
                atama_tarihi: false,
                surucu_tckn: false,
                surucu_telefon: false,
            });
        } else if (downMd) {
            setColumnVisibilityModel({
                treyler: false,
                proje_adi: false,
                atama_tarihi: false,
                surucu_tckn: false,
                surucu_telefon: false,
            });
        } else {
            setColumnVisibilityModel({});
        }
    }, [downMd, downSm]);


    const openDetails = useCallback(async (row) => {
        setSelected(row);
        setDetailOpen(true);
        setDetailLoading(true);

        const { data, error } = await supabase
            .from("tamamlanan_detaylar")
            .select("*")
            .eq("sefer_no", row.sefer_no)
            .order("nokta_sirasi", { ascending: true });

        if (!error) setDetailRows(data || []);
        setDetailLoading(false);
    }, []);

    const columns = useMemo(
        () => [
            {
                field: "sefer_no",
                headerName: "Sefer No",
                width: 140,
                renderCell: (params) => (
                    // Daha belirgin ve güzel buton stili
                    <Button
                        size="small"
                        onClick={() => openDetails(params.row)}
                        sx={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: theme.palette.info.light, // Mavi/Açık Mavi
                            textDecoration: "underline",
                            "&:hover": {
                                background: 'transparent' // Hover'da sade kalsın
                            }
                        }}
                    >
                        {params.value}
                    </Button>
                ),
            },
            { field: "plaka", headerName: "Plaka", width: 120 },
            { field: "treyler", headerName: "Treyler", width: 120 },

            { field: "surucu_ad_soyad", headerName: "Şoför", width: 160 },
            { field: "musteri_adi", headerName: "Müşteri", width: 180 },
            { field: "proje_adi", headerName: "Proje", width: 180 },

            { field: "yukleme_noktasi", headerName: "Yükleme Noktası", width: 200 },
            {
                field: "yukleme_il_ilce",
                headerName: "Yükleme İl/İlçe",
                width: 180,
                valueGetter: (v, row) => `${row.yukleme_ili ?? ""} / ${row.yukleme_ilcesi ?? ""}`,
            },

            { field: "teslim_noktasi", headerName: "Teslim Noktası", width: 200 },
            {
                field: "teslim_il_ilce",
                headerName: "Teslim İl/İlçe",
                width: 180,
                valueGetter: (v, row) => `${row.teslim_ili ?? ""} / ${row.teslim_ilcesi ?? ""}`,
            },

            {
                field: "sefer_tarihi",
                headerName: "Sefer Tarihi",
                width: 140,
                valueGetter: (v, row) => (row?.sefer_tarihi ? fmtDateFixed(row.sefer_tarihi) : "-"),
            },

            // Yeni Durum Sütunu (Analiz sonucunu gösteren)
            {
                field: "status_display",
                headerName: "ETA Durum",
                width: 140,
                sortable: false, // Analiz sonucu olduğu için sıralama yok
                filterable: false, // Filtreleme yok (Dashboard panelden filtreleme var)
                renderCell: (params) => {
                    const statusData = analysis.bySefer[params.row.sefer_no];
                    if (!statusData) return <Typography variant="caption" color="text.secondary">-</Typography>;

                    const status = statusData.status;
                    const diffMin = statusData.diffMin;
                    const isLate = status === "LATE";
                    const isEarly = status === "EARLY";

                    let color = theme.palette.success.main; // ONTIME
                    let text = "Zamanında";

                    if (isLate) {
                        color = theme.palette.error.main;
                        text = `GEÇ (${diffMin} dk)`;
                    } else if (isEarly) {
                        color = theme.palette.warning.main;
                        text = `ERKEN (${Math.abs(diffMin)} dk)`;
                    }

                    return (
                        <Tooltip title={`ETA: ${fmtDateTimeFixed(params.row.eta_varis)} | Reel: ${fmtDateTimeFixed(statusData.maxTeslimISO)}`}>
                            <Box sx={{
                                backgroundColor: alpha(color, 0.1),
                                color: color,
                                px: 1, py: 0.5,
                                borderRadius: 1,
                                fontWeight: 600,
                                fontSize: 12,
                                display: 'inline-block',
                            }}>
                                {text}
                            </Box>
                        </Tooltip>
                    );
                },
            },

            {
                field: "eta_varis",
                headerName: "ETA Varış",
                width: 180,
                valueGetter: (v, row) => (row?.eta_varis ? fmtDateTimeFixed(row.eta_varis) : "-"),
            },

            // Diğer daha az önemli sütunlar
            { field: "surucu_tckn", headerName: "TCKN", width: 120, hide: downMd },
            { field: "surucu_telefon", headerName: "Telefon", width: 140, hide: downMd },
            { field: "atama_yapan_kullanici", headerName: "Atayan", width: 160 },
            {
                field: "kayit_zamani",
                headerName: "Kayıt Zamanı",
                width: 180,
                valueGetter: (v, row) => (row?.kayit_zamani ? fmtDateTimeFixed(row.kayit_zamani) : "-"),
            },
        ],
        [openDetails, analysis, theme.palette.success.main, theme.palette.error.main, theme.palette.warning.main, theme.palette.info.light]
    );

    // Export fonksiyonları aynı kalır...
    const exportExcel = () => { /* ... */ };
    const exportExcelWithDetails = async () => { /* ... */ };
    const statText = useMemo(() => { /* ... */ }, [rowCount, paginationModel]);
    const handleDashboardFilter = (type) => { /* ... */ };
    // ...

    return (
        <Box
            sx={{
                height: "100dvh",
                display: "grid",
                // Grid yapısı: Header, Aksiyonlar, Dashboard, DataGrid
                gridTemplateRows: "auto auto auto 1fr",
                gap: 3, // Daha fazla boşluk
                px: { xs: 1, md: 3 },
                pt: 3,
                pb: 2,
                // DAHA DRAMATİK ARKA PLAN
                background:
                    "radial-gradient(1200px 500px at 10% -10%, rgba(34,211,238,0.12), transparent 40%)," +
                    "radial-gradient(900px 400px at 90% 0%, rgba(139,92,246,0.15), transparent 50%)," +
                    "linear-gradient(180deg, #02040C 0%, #08101E 100%)",
            }}
        >
            <Helmet><title>TAMAMLANAN SEFERLER</title></Helmet>

            {/* Header (Başlık ve Navigasyon) */}
            <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
                spacing={2} // Daha fazla dikey boşluk
            >
                <Stack spacing={0.5}>
                    <Typography
                        variant="h4" // Daha büyük başlık
                        fontWeight={700}
                        sx={{
                            lineHeight: 1.1,
                            background: "linear-gradient(90deg,#F59E0B,#A78BFA)", // Daha sıcak bir gradyan
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        OPERASYON ANALİZİ
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.info.light }}>
                        Tamamlanan Seferler ve Performans Özetleri
                    </Typography>
                </Stack>

                {/* Sağ Navigasyon Butonları */}
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Button
                        size="medium"
                        variant="outlined"
                        startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 16 }} />}
                        onClick={() => navigate(-1)}
                        sx={{ borderRadius: 2 }}
                    >
                        Geri
                    </Button>
                    <Button
                        size="medium"
                        variant="outlined"
                        startIcon={<HomeOutlinedIcon sx={{ fontSize: 16 }} />}
                        onClick={() => navigate(HOME_PATH)}
                        sx={{ borderRadius: 2 }}
                    >
                        Anasayfa
                    </Button>
                </Stack>
            </Stack>

            {/* AKSIYONLAR & FİLTRELER KARTI */}
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    // KARTA GÖLGELİ, HAFİF ARKA PLAN
                    background: alpha(theme.palette.background.paper, 0.4),
                    border: "1px solid rgba(255,255,255,0.08)",
                    flexWrap: "wrap",
                    backdropFilter: "blur(6px)",
                    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
            >
                <Typography variant="subtitle2" sx={{ color: "text.secondary", pr: 1 }}>
                    Sefer Tarih Aralığı:
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                        type="date" size="small"
                        // DAHA MODERN INPUT STİLİ İÇİN:
                        InputProps={{ sx: { borderRadius: 1.5, fontSize: 14 } }}
                        value={(dateStart && fmtDate(dateStart)?.toISOString()?.slice(0, 10)) || ""}
                        onChange={(e) => {
                            setPaginationModel((p) => ({ ...p, page: 0 }));
                            setDateStart(e.target.value ? new Date(e.target.value) : null);
                        }}
                    />
                    <Typography variant="body2" sx={{ opacity: 0.7 }}>—</Typography>
                    <TextField
                        type="date" size="small"
                        InputProps={{ sx: { borderRadius: 1.5, fontSize: 14 } }}
                        value={(dateEnd && fmtDate(dateEnd)?.toISOString()?.slice(0, 10)) || ""}
                        onChange={(e) => {
                            setPaginationModel((p) => ({ ...p, page: 0 }));
                            setDateEnd(e.target.value ? new Date(e.target.value) : null);
                        }}
                    />
                </Stack>
            </Paper>

            {/* Dashboard Panel - DAHA ÇARPICI */}
            <DashboardPanel
                dateRangeText={
                    `${(dateStart && new Date(dateStart).toLocaleDateString("tr-TR")) || "-"}  —  ` +
                    `${(dateEnd && new Date(dateEnd).toLocaleDateString("tr-TR")) || "-"}`
                }
                totalCount={rowCount}
                summary={analysis.summary}
                lateBuckets={analysis.lateBuckets}
                onFilter={handleDashboardFilter}
            />

            {/* DataGrid - ANA TABLO */}
            <Paper
                sx={{
                    borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.12)", // Daha belirgin kenarlık
                    overflow: "hidden",
                    display: "grid",
                    gridTemplateRows: "1fr",
                    minHeight: 0,
                    boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.15)}`, // Derin gölge
                }}
            >
                <DataGrid
                    rows={rows}
                    columns={columns}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={setColumnVisibilityModel}
                    getRowId={(r) => r.sefer_no}
                    loading={loading}
                    disableRowSelectionOnClick
                    density="comfortable" // Biraz daha ferah satırlar
                    rowHeight={40}
                    headerHeight={48}
                    pagination
                    paginationMode="server"
                    rowCount={rowCount}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    sortingMode="server"
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    filterMode="server"
                    filterModel={filterModel}
                    onFilterModelChange={setFilterModel}
                    slots={{ toolbar: ToolbarLite }}
                    slotProps={{
                        toolbar: {
                            onExport: exportExcel,
                            onExportWithDetails: exportExcelWithDetails,
                            pageSize: paginationModel.pageSize,
                            onPageSizeChange: (v) => setPaginationModel((p) => ({ ...p, page: 0, pageSize: v })),
                            statText,
                        },
                    }}
                    sx={{
                        height: "100%",
                        border: "none",
                        fontSize: 14, // Yazı tipi boyutu artırıldı
                        "& .MuiDataGrid-toolbarContainer": {
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            background: "rgba(10,20,38,0.95)", // Daha koyu, daha şık toolbar
                            backdropFilter: "blur(6px)",
                            borderBottom: "1px solid rgba(255,255,255,0.1)",
                            overflowX: "auto",
                            flexWrap: "wrap",
                        },
                        "& .MuiDataGrid-columnHeaders": {
                            background: "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.9) 100%)",
                            color: "#E2E8F0", // Başlık rengi
                            borderBottom: `2px solid ${theme.palette.info.main}`, // Renkli, kalın çizgi
                            fontWeight: 700,
                        },
                        "& .MuiDataGrid-cell": {
                            borderBottomColor: "rgba(255,255,255,0.06)",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                        },
                        "& .MuiDataGrid-row:nth-of-type(2n)": {
                            backgroundColor: "rgba(255,255,255,0.01)", // Çok hafif zebra
                        },
                        "& .MuiDataGrid-row:hover": {
                            backgroundColor: "rgba(34,211,238,0.1) !important", // Mavi vurgu
                            transition: "background-color 0.3s ease",
                        },
                    }}
                />
            </Paper>

            {/* Detay Drawer (Stili minimal iyileştirildi) */}
            <Drawer
                anchor="right"
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                PaperProps={{
                    sx: {
                        width: { xs: "100%", md: 860 },
                        backgroundColor: "#08101E", // Daha koyu çekmece arkaplanı
                        color: "text.primary",
                        p: 3, // Daha fazla padding
                        borderLeft: "1px solid rgba(255,255,255,0.1)",
                        boxShadow: `0 0 20px ${alpha("#000000", 0.8)}`,
                    },
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="h5" sx={{ color: theme.palette.info.light }}>Detaylar — {selected?.sefer_no ?? "-"}</Typography>
                    <IconButton onClick={() => setDetailOpen(false)} color="primary"><CloseIcon /></IconButton>
                </Stack>
                <Divider sx={{ mb: 3, borderColor: "rgba(255,255,255,0.1)" }} />

                {detailLoading ? (
                    <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
                        <CircularProgress size={30} color="info" />
                    </Box>
                ) : (
                    <Paper
                        variant="outlined"
                        sx={{
                            borderRadius: 3,
                            borderColor: "rgba(255,255,255,0.1)",
                            overflow: "hidden",
                            background: alpha("#10172A", 0.7) // İç kart daha açık
                        }}
                    >
                        <Box sx={{ maxHeight: "calc(100dvh - 220px)", overflow: "auto" }}>
                            <Table size="medium" stickyHeader>
                                <TableHead>
                                    <TableRow
                                        sx={{ "& th": { background: alpha("#ffffff", 0.08), fontWeight: 700, whiteSpace: "nowrap", color: "#A0AEC0", borderBottom: `1px solid ${alpha("#ffffff", 0.1)}` } }}
                                    >
                                        <TableCell>#</TableCell>
                                        <TableCell>Proje</TableCell>
                                        <TableCell>Yükleme Noktası</TableCell>
                                        <TableCell>Yükleme Varış</TableCell>
                                        <TableCell>Yükleme Çıkış</TableCell>
                                        <TableCell>Teslim Noktası</TableCell>
                                        <TableCell>Teslim Varış</TableCell>
                                        <TableCell>Teslim Çıkış</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {detailRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} sx={{ py: 3, textAlign: "center", opacity: 0.7 }}>
                                                Detay bulunamadı.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        detailRows.map((d, i) => (
                                            <TableRow
                                                key={`${selected?.sefer_no}-${i}`}
                                                hover
                                                sx={{ "&:hover": { backgroundColor: alpha("#22D3EE", 0.05) } }} // Detay satır hover efekti
                                            >
                                                <TableCell>{d.nokta_sirasi}</TableCell>
                                                <TableCell>{d.proje_adi}</TableCell>
                                                <TableCell>{d.yukleme_noktasi}</TableCell>
                                                <TableCell>{fmtDateTimeFixed(d.yukleme_varis)}</TableCell>
                                                <TableCell>{fmtDateTimeFixed(d.yukleme_cikis)}</TableCell>
                                                <TableCell>{d.teslim_noktasi}</TableCell>
                                                <TableCell>{fmtDateTimeFixed(d.teslim_varis)}</TableCell>
                                                <TableCell>{fmtDateTimeFixed(d.teslim_cikis)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Box>
                    </Paper>
                )}
            </Drawer>
        </Box>
    );
}
