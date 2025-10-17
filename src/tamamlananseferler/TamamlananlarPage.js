// src/tamamlananseferler/TamamlananlarPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

/* MUI */
import {
    Box, Paper, Stack, Typography, Button, Drawer, IconButton, Divider,
    Table, TableHead, TableRow, TableCell, TableBody,
    CircularProgress, TextField, Tooltip, useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SummarizeIcon from "@mui/icons-material/Summarize";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { DataGrid } from "@mui/x-data-grid";
import ToolbarLite from "./components/ToolbarLite";
import { fmtDate, fmtDateText, fmtDateTimeText } from "./utils/datetime";
import DashboardPanel from "./components/DashboardPanel";

const HOME_PATH = "/anasayfa";
const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

// =================================================================
// YENİ HELPER: GÖSTERİM AMAÇLI +3 SAAT DÜZELTME FONKSİYONLARI
// Supabase'den gelen UTC dizesini Yerel Saat (TR saati) olarak gösterir.
// =================================================================
const fmtDateTimeFixed = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "-";

    // 1. UTC Değerlerini alıyoruz.
    let y = d.getUTCFullYear();
    let mo = d.getUTCMonth() + 1;
    let dd = d.getUTCDate();
    let hh = d.getUTCHours();
    let mi = d.getUTCMinutes();

    // 2. SADECE 3 SAAT EKLEME İŞLEMİ (TR Saati)
    let totalMinutes = (hh * 60) + mi + (3 * 60);

    const newHH = Math.floor(totalMinutes / 60) % 24;
    const newMI = totalMinutes % 60;
    const daysToAdd = Math.floor(totalMinutes / (24 * 60));

    // 3. Gün kayması varsa, tarih parçalarını kullanarak günü ayarla
    if (daysToAdd > 0) {
        let tempDate = new Date(Date.UTC(y, mo - 1, dd, 0, 0, 0));
        tempDate.setUTCDate(tempDate.getUTCDate() + daysToAdd);

        y = tempDate.getUTCFullYear();
        mo = tempDate.getUTCMonth() + 1;
        dd = tempDate.getUTCDate();
    }

    const pad = (n) => String(n).padStart(2, "0");

    // 4. Sonucu formatla
    return `${pad(dd)}.${pad(mo)}.${y} ${pad(newHH)}:${pad(newMI)}`;
};

const fmtDateFixed = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "-";

    // Sadece tarih gösterimi için, saati gün ortasına alıp yerel tarihini alırız.
    // Bu, fmtDateTimeFixed'in tarih kısmını kullanmaktan daha güvenlidir.

    // NOT: Harici fmtDateText'in doğru çalıştığını varsayarak onu kullanmak en iyisidir.
    // Ancak o 3 saat geride gösteriyorsa, biz UTC'den alalım.
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
                    // NOT: Teslim varışı alırken 3 saat ekleme yapılmamalı, 
                    // çünkü karşılaştırmada UTC/UTC kullanılır.
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
                    // tETA UTC'de olmalı
                    const tETA = r?.eta_varis ? new Date(r.eta_varis) : null;
                    // tReal UTC'de olmalı
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

    useEffect(() => {
        if (downSm) {
            setColumnVisibilityModel({
                treyler: false,
                proje_adi: false,
                yukleme_il_ilce: false,
                teslim_il_ilce: false,
                atama_yapan_kullanici: false,
                atama_tarihi: false,
            });
        } else if (downMd) {
            setColumnVisibilityModel({
                treyler: false,
                proje_adi: false,
                atama_tarihi: false,
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
                    <Button size="small" onClick={() => openDetails(params.row)}>
                        {params.value}
                    </Button>
                ),
            },
            { field: "plaka", headerName: "Plaka", width: 120 },
            { field: "treyler", headerName: "Treyler", width: 120 },

            { field: "surucu_ad_soyad", headerName: "Şoför", width: 160 },
            { field: "surucu_tckn", headerName: "TCKN", width: 120 },
            { field: "surucu_telefon", headerName: "Telefon", width: 140 },

            { field: "musteri_adi", headerName: "Müşteri", width: 180 },
            { field: "musteri_siparis_no", headerName: "Müşteri Sipariş No", width: 180 },
            { field: "hizmet_adi", headerName: "Hizmet", width: 160 },
            { field: "proje_adi", headerName: "Proje", width: 180 },

            { field: "yukleme_noktasi", headerName: "Yükleme Noktası", width: 200 },
            { field: "yukleme_ili", headerName: "Yükleme İl", width: 140 },
            { field: "yukleme_ilcesi", headerName: "Yükleme İlçe", width: 140 },

            { field: "teslim_alan_firma", headerName: "Teslim Alan Firma", width: 200 },
            { field: "teslim_noktasi", headerName: "Teslim Noktası", width: 200 },
            { field: "teslim_ili", headerName: "Teslim İl", width: 140 },
            { field: "teslim_ilcesi", headerName: "Teslim İlçe", width: 140 },

            { field: "irsaliye_no", headerName: "İrsaliye No", width: 160 },

            { field: "atama_yapan_kullanici", headerName: "Atayan", width: 160 },
            {
                field: "atama_tarihi",
                headerName: "Atama Tarihi",
                width: 170,
                // DÜZELTME: Kendi +3 saat ekleyen helper'ımızı kullanıyoruz
                valueGetter: (v, row) => (row?.atama_tarihi ? fmtDateTimeFixed(row.atama_tarihi) : "-"),
            },

            {
                field: "sefer_tarihi",
                headerName: "Sefer Tarihi",
                width: 140,
                // DÜZELTME: Kendi +3 saat ekleyen helper'ımızı kullanıyoruz
                valueGetter: (v, row) => (row?.sefer_tarihi ? fmtDateFixed(row.sefer_tarihi) : "-"),
            },

            { field: "arac_statu", headerName: "Araç Statü", width: 140 },

            {
                field: "eta_varis",
                headerName: "ETA Varış",
                width: 180,
                // DÜZELTME: Kendi +3 saat ekleyen helper'ımızı kullanıyoruz
                valueGetter: (v, row) => (row?.eta_varis ? fmtDateTimeFixed(row.eta_varis) : "-"),
            },
            {
                field: "kayit_zamani",
                headerName: "Kayıt Zamanı",
                width: 180,
                // DÜZELTME: Kendi +3 saat ekleyen helper'ımızı kullanıyoruz
                valueGetter: (v, row) => (row?.kayit_zamani ? fmtDateTimeFixed(row.kayit_zamani) : "-"),
            },
        ],
        [openDetails]
    );

    const exportExcel = () => {
        if (!rows.length) return alert("Aktarılacak veri yok.");
        const sheet = rows.map((s) => ({
            SeferNo: s.sefer_no,
            Plaka: s.plaka,
            Treyler: s.treyler,
            Sofor: s.surucu_ad_soyad,
            Musteri: s.musteri_adi,
            Hizmet: s.hizmet_adi,
            Proje: s.proje_adi,
            YuklemeNoktasi: s.yukleme_noktasi,
            YuklemeIlce: `${s.yukleme_ili ?? ""} / ${s.yukleme_ilcesi ?? ""}`,
            TeslimNoktasi: s.teslim_noktasi,
            TeslimIlce: `${s.teslim_ili ?? ""} / ${s.teslim_ilcesi ?? ""}`,
            Atayan: s.atama_yapan_kullanici,
            // DÜZELTME: Kendi helper'ımızı kullanıyoruz
            AtamaTarihi: s.atama_tarihi ? fmtDateTimeFixed(s.atama_tarihi) : "-",
            SeferTarihi: s.sefer_tarihi ? fmtDateFixed(s.sefer_tarihi) : "-",
            Durum: s.arac_statu,
            ETA_Varis: s.eta_varis ? fmtDateTimeFixed(s.eta_varis) : "",
            KayitZamani: s.kayit_zamani ? fmtDateTimeFixed(s.kayit_zamani) : "",
        }));
        const ws = XLSX.utils.json_to_sheet(sheet);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Seferler");
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        saveAs(new Blob([buf], { type: "application/octet-stream" }), "tamamlanan_seferler.xlsx");
    };

    const exportExcelWithDetails = async () => {
        if (!rows.length) return alert("Aktarılacak veri yok.");
        const all = [];
        for (const s of rows) {
            const { data } = await supabase
                .from("tamamlanan_detaylar")
                .select("*")
                .eq("sefer_no", s.sefer_no)
                .order("nokta_sirasi", { ascending: true });

            if (!data || !data.length) {
                all.push({
                    SeferNo: s.sefer_no,
                    Plaka: s.plaka,
                    Musteri: s.musteri_adi,
                    Proje: s.proje_adi,
                    Asama: "Detay yok",
                    ETA_Varis: s.eta_varis ? fmtDateTimeFixed(s.eta_varis) : "",
                    KayitZamani: s.kayit_zamani ? fmtDateTimeFixed(s.kayit_zamani) : "",
                });
                continue;
            }

            for (const d of data) {
                all.push({
                    SeferNo: s.sefer_no,
                    Plaka: s.plaka,
                    Musteri: s.musteri_adi,
                    Proje: d.proje_adi,
                    Sira: d.nokta_sirasi,
                    YuklemeNoktasi: d.yukleme_noktasi,
                    // DÜZELTME: Kendi helper'ımızı kullanıyoruz
                    YuklemeVaris: fmtDateTimeFixed(d.yukleme_varis),
                    YuklemeCikis: fmtDateTimeFixed(d.yukleme_cikis),
                    TeslimNoktasi: d.teslim_noktasi,
                    TeslimVaris: fmtDateTimeFixed(d.teslim_varis),
                    TeslimCikis: fmtDateTimeFixed(d.teslim_cikis),
                    ETA_Varis: s.eta_varis ? fmtDateTimeFixed(s.eta_varis) : "",
                    KayitZamani: s.kayit_zamani ? fmtDateTimeFixed(s.kayit_zamani) : "",
                });
            }
        }
        const ws = XLSX.utils.json_to_sheet(all);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sefer+Detay");
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        saveAs(new Blob([buf], { type: "application/octet-stream" }), "tamamlanan_seferler_detayli.xlsx");
    };

    const statText = useMemo(() => {
        if (!rowCount) return "Kayıt yok";
        const first = paginationModel.page * paginationModel.pageSize + 1;
        const last = Math.min((paginationModel.page + 1) * paginationModel.pageSize, rowCount);
        return `${first} - ${last} / ${rowCount}`;
    }, [rowCount, paginationModel]);

    const handleDashboardFilter = (type) => {
        if (type === "ALL") {
            setFilterModel((m) => ({
                ...m,
                items: (m.items || []).filter((it) => it.field !== "sefer_no"),
            }));
            return;
        }
        const matchStatus = { EARLY: "EARLY", ONTIME: "ONTIME", LATE: "LATE" }[type];
        const seferList = Object.entries(analysis.bySefer)
            .filter(([, v]) => v.status === matchStatus)
            .map(([k]) => k);

        setFilterModel((m) => ({
            ...m,
            items: [
                ...(m.items || []).filter((it) => it.field !== "sefer_no"),
                {
                    id: "status-filter",
                    field: "sefer_no",
                    operator: "isAnyOf",
                    value: seferList,
                },
            ],
        }));
    };

    return (
        <Box
            sx={{
                height: "100dvh",
                display: "grid",
                gridTemplateRows: "auto auto auto 1fr",
                gap: 2,
                px: 2,
                pt: 2,
                pb: 1,
                background:
                    "radial-gradient(1200px 500px at 10% -10%, rgba(34,211,238,0.10), transparent 40%)," +
                    "radial-gradient(900px 400px at 90% 0%, rgba(139,92,246,0.12), transparent 50%)," +
                    "linear-gradient(180deg, #050816 0%, #0B1220 100%)",
            }}
        >
            <Helmet><title>TAMAMLANAN SEFERLER</title></Helmet>

            {/* Header */}
            <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" spacing={1}>
                <Stack spacing={0.25}>
                    <Typography
                        variant="h5"
                        fontWeight={800}
                        sx={{
                            lineHeight: 1.1,
                            background: "linear-gradient(90deg,#E879F9,#22D3EE)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        Tamamlanan Seferler
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Raporlar • tarih aralığı • teslim-ETA karşılaştırma
                    </Typography>
                </Stack>

                {/* Sağ aksiyonlar */}
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Button size="small" variant="text" startIcon={<ArrowBackIosNewIcon />} onClick={() => navigate(-1)}>
                        Geri
                    </Button>
                    <Button size="small" variant="text" startIcon={<HomeOutlinedIcon />} onClick={() => navigate(HOME_PATH)}>
                        Anasayfa
                    </Button>

                    <Paper
                        sx={{
                            p: 1, borderRadius: 2, display: "flex", alignItems: "center", gap: 1,
                            background: `linear-gradient(180deg, ${alpha("#ffffff", 0.04)} 0%, ${alpha("#ffffff", 0.02)} 100%)`,
                            border: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap",
                        }}
                    >
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                            Tarih (Sefer Tarihi)
                        </Typography>
                        <TextField
                            type="date" size="small"
                            value={(dateStart && fmtDate(dateStart)?.toISOString()?.slice(0, 10)) || ""}
                            onChange={(e) => {
                                setPaginationModel((p) => ({ ...p, page: 0 }));
                                setDateStart(e.target.value ? new Date(e.target.value) : null);
                            }}
                            InputLabelProps={{ shrink: true }}
                        />
                        <Typography variant="body2" sx={{ opacity: 0.7 }}>—</Typography>
                        <TextField
                            type="date" size="small"
                            value={(dateEnd && fmtDate(dateEnd)?.toISOString()?.slice(0, 10)) || ""}
                            onChange={(e) => {
                                setPaginationModel((p) => ({ ...p, page: 0 }));
                                setDateEnd(e.target.value ? new Date(e.target.value) : null);
                            }}
                            InputLabelProps={{ shrink: true }}
                        />

                        <Tooltip title="Görünen sayfayı Excel'e aktar">
                            <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportExcel}>
                                Excel
                            </Button>
                        </Tooltip>
                        <Tooltip title="Sayfa + detaylarla aktar">
                            <Button size="small" variant="outlined" startIcon={<SummarizeIcon />} onClick={exportExcelWithDetails}>
                                Excel (Detay)
                            </Button>
                        </Tooltip>
                    </Paper>
                </Stack>
            </Stack>

            {/* Dashboard Panel */}
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

            {/* DataGrid */}
            <Paper
                sx={{
                    borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.06)",
                    overflow: "hidden",
                    display: "grid",
                    gridTemplateRows: "1fr",
                    minHeight: 0,
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
                    density="compact"
                    rowHeight={36}
                    headerHeight={44}
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
                        fontSize: 13,
                        "& .MuiDataGrid-toolbarContainer": {
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            background: "rgba(15,23,42,0.92)",
                            backdropFilter: "blur(4px)",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            overflowX: "auto",
                            flexWrap: "wrap",
                        },
                        "& .MuiDataGrid-columnHeaders": {
                            background: "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.7) 100%)",
                            color: "#C8D1E6",
                            borderBottomColor: "rgba(255,255,255,0.08)",
                            fontWeight: 700,
                        },
                        "& .MuiDataGrid-cell": {
                            borderBottomColor: "rgba(255,255,255,0.06)",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                        },
                        "& .MuiDataGrid-row:nth-of-type(2n) .MuiDataGrid-cell": {
                            backgroundColor: "rgba(255,255,255,0.02)",
                        },
                    }}
                />
            </Paper>

            {/* Detay Drawer */}
            <Drawer
                anchor="right"
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                PaperProps={{
                    sx: {
                        width: { xs: "100%", md: 860 },
                        backgroundColor: "#0F172A",
                        color: "text.primary",
                        p: 2,
                        borderLeft: "1px solid rgba(255,255,255,0.06)",
                    },
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="h6">Detaylar — {selected?.sefer_no ?? "-"}</Typography>
                    <IconButton onClick={() => setDetailOpen(false)}><CloseIcon /></IconButton>
                </Stack>
                <Divider sx={{ mb: 2, borderColor: "rgba(255,255,255,0.08)" }} />

                {detailLoading ? (
                    <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
                        <CircularProgress size={26} />
                    </Box>
                ) : (
                    <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <Box sx={{ maxHeight: "calc(100dvh - 220px)", overflow: "auto" }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow
                                        sx={{ "& th": { background: alpha("#ffffff", 0.04), fontWeight: 700, whiteSpace: "nowrap" } }}
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
                                            <TableCell colSpan={8} sx={{ py: 2, textAlign: "center", opacity: 0.8 }}>
                                                Detay bulunamadı.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        detailRows.map((d, i) => (
                                            <TableRow key={`${selected?.sefer_no}-${i}`} hover>
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
