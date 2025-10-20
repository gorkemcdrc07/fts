import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

// GERÇEK SUPABASE İMPORT'U (Projenizde bu dosyayı oluşturmalısınız)
import { supabase } from "../supabaseClient";

/* MUI */
import {
    Box, Paper, Stack, Typography, Button, Drawer, IconButton, Divider,
    Table, TableHead, TableRow, TableCell, TableBody,
    CircularProgress, TextField, Tooltip, useMediaQuery, useTheme,
    Select, MenuItem, InputLabel, FormControl,
    Grid
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SummarizeIcon from "@mui/icons-material/Summarize";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import ScheduleIcon from '@mui/icons-material/Schedule';

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { DataGrid, GridToolbarContainer, GridToolbarQuickFilter, GridToolbarColumnsButton } from "@mui/x-data-grid";


// =================================================================
// 2. DATE TIME HELPERS
// =================================================================

const fmtDate = (d) => {
    if (!d) return null;
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
}

// Fixed UTC+3 display helpers (Zorunlu UTC+3 gösterimi için)
const fmtDateTimeFixed = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "-";

    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
    const offsetTime = utcTime + (3 * 60 * 60 * 1000); // UTC+3
    const fixedDate = new Date(offsetTime);

    const y = fixedDate.getUTCFullYear();
    const mo = fixedDate.getUTCMonth() + 1;
    const dd = fixedDate.getUTCDate();
    const hh = fixedDate.getUTCHours();
    const mi = fixedDate.getUTCMinutes();

    const pad = (n) => String(n).padStart(2, "0");

    return `${pad(dd)}.${pad(mo)}.${y} ${pad(hh)}:${pad(mi)}`;
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


// =================================================================
// 3. TOOLBAR LITE COMPONENT
// =================================================================
function ToolbarLite(props) {
    const theme = useTheme();
    const { onExport, onExportWithDetails, statText } = props;

    return (
        <GridToolbarContainer sx={{ p: 1.5, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" width="100%" spacing={2}>
                {/* Left Controls */}
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <GridToolbarQuickFilter
                        debounceMs={500}
                        placeholder="Hızlı Ara..."
                        variant="outlined"
                        size="small"
                        sx={{
                            minWidth: 150,
                            '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14, color: 'white' },
                        }}
                    />
                    <GridToolbarColumnsButton />
                </Stack>

                {/* Right Controls and Stats */}
                <Stack direction="row" spacing={1.5} alignItems="center">
                    {/* Stat Text */}
                    <Box sx={{ minWidth: 150, textAlign: 'right' }}>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                            {statText}
                        </Typography>
                    </Box>

                    {/* Export Buttons */}
                    <Tooltip title="Ana Veriyi Excel'e Aktar">
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<FileDownloadIcon />}
                            onClick={onExport}
                            sx={{ borderRadius: 2 }}
                        >
                            Excel
                        </Button>
                    </Tooltip>

                    <Tooltip title="Detaylı Veriyi Excel'e Aktar (Tüm Detaylar)">
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<SummarizeIcon />}
                            onClick={onExportWithDetails}
                            sx={{
                                borderRadius: 2,
                                background: theme.palette.info.main,
                                '&:hover': { background: theme.palette.info.dark }
                            }}
                        >
                            Rapor
                        </Button>
                    </Tooltip>

                    {/* Page Size Selection */}
                    <FormControl size="small" variant="outlined" sx={{ minWidth: 100 }}>
                        <InputLabel id="page-size-label" sx={{ fontSize: 14, color: theme.palette.text.secondary }}>Satır</InputLabel>
                        <Select
                            labelId="page-size-label"
                            label="Satır"
                            value={props.pageSize}
                            onChange={(e) => props.onPageSizeChange(Number(e.target.value))}
                            sx={{ borderRadius: 2, fontSize: 14, color: 'white' }}
                        >
                            <MenuItem value={10}>10</MenuItem>
                            <MenuItem value={50}>50</MenuItem>
                            <MenuItem value={100}>100</MenuItem>
                            <MenuItem value={250}>250</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </Stack>
        </GridToolbarContainer>
    );
}


// =================================================================
// 4. DASHBOARD PANEL COMPONENT
// =================================================================
function DashboardPanel({ dateRangeText, totalCount, summary, lateBuckets, onFilter }) {
    const theme = useTheme();

    const stats = useMemo(() => [
        {
            label: "Toplam Sefer",
            value: totalCount,
            icon: <DirectionsRunIcon />,
            color: theme.palette.info.main,
            type: 'ALL',
        },
        {
            label: "Zamanında + Erken",
            value: summary.ontime + summary.early,
            icon: <ThumbUpIcon />,
            color: theme.palette.success.main,
            type: 'ONTIME',
            tooltip: `Zamanında (${summary.ontime}) ve Erken (${summary.early}) teslimatlar`,
        },
        {
            label: "Gecikmeli Teslimat",
            value: summary.late,
            icon: <ScheduleIcon />,
            color: theme.palette.error.main,
            type: 'LATE',
            tooltip: `Ortalama Gecikme: ${summary.avgDelayMin.toFixed(0)} dk`,
        },
        {
            label: "Ortalama Erken Varış",
            value: summary.avgEarlyMin > 0 ? `${summary.avgEarlyMin.toFixed(0)} dk` : '-',
            icon: <AccessTimeIcon />,
            color: theme.palette.warning.main,
            type: 'EARLY',
            tooltip: 'Erken teslim edilen seferlerin ortalama süresi',
        },
    ], [totalCount, summary, theme]);

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="h6" fontWeight={600} sx={{ color: theme.palette.info.light }}>
                    Performans Özeti
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {dateRangeText}
                </Typography>
            </Stack>

            <Grid container spacing={2}>
                {stats.map((stat, index) => (
                    <Grid item xs={6} md={3} key={index}>
                        <Tooltip title={stat.tooltip || stat.label}>
                            <Paper
                                elevation={2}
                                onClick={() => onFilter(stat.type)}
                                sx={{
                                    p: 2,
                                    borderRadius: 3,
                                    cursor: 'pointer',
                                    border: `1px solid ${alpha(stat.color, 0.3)}`,
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        boxShadow: `0 8px 20px ${alpha(stat.color, 0.1)}`,
                                    },
                                    background: alpha(theme.palette.background.paper, 0.8),
                                }}
                            >
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Box sx={{ color: stat.color, fontSize: 32 }}>{stat.icon}</Box>
                                    <Typography variant="h5" fontWeight={700} sx={{ color: 'white' }}>
                                        {stat.value}
                                    </Typography>
                                </Stack>
                                <Typography variant="caption" color="text.secondary" mt={0.5}>
                                    {stat.label}
                                </Typography>
                            </Paper>
                        </Tooltip>
                    </Grid>
                ))}
            </Grid>

            {/* Gecikme Sepetleri (Late Buckets) Bar Chart Mockup */}
            <Paper
                elevation={2}
                sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 3,
                    background: alpha(theme.palette.background.paper, 0.8),
                    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                }}
            >
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary" mb={1}>
                    Gecikme Süreleri Dağılımı (Adet)
                </Typography>
                <Grid container spacing={1}>
                    {lateBuckets.map((bucket, index) => {
                        const maxVal = Math.max(...lateBuckets.map(b => b.value), 1);
                        const widthPct = (bucket.value / maxVal) * 100;
                        return (
                            <Grid item xs={12} key={index}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography variant="caption" sx={{ width: '80px', flexShrink: 0, color: theme.palette.text.secondary }}>
                                        {bucket.name} dk:
                                    </Typography>
                                    <Box sx={{ flexGrow: 1, height: '16px', borderRadius: 0.5, backgroundColor: alpha(theme.palette.text.secondary, 0.1) }}>
                                        <Tooltip title={`${bucket.value} sefer`}>
                                            <Box
                                                sx={{
                                                    height: '100%',
                                                    width: `${widthPct}%`,
                                                    borderRadius: 0.5,
                                                    backgroundColor: bucket.value > 0 ? theme.palette.error.main : 'transparent',
                                                    transition: 'width 0.5s ease-out',
                                                    minWidth: bucket.value > 0 ? '5px' : '0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'flex-end',
                                                    pr: 0.5
                                                }}
                                            >
                                                {bucket.value > 0 &&
                                                    <Typography variant="caption" fontWeight={600} sx={{ color: 'white', fontSize: 10, textShadow: '0 0 2px #000' }}>
                                                        {bucket.value}
                                                    </Typography>
                                                }
                                            </Box>
                                        </Tooltip>
                                    </Box>
                                </Stack>
                            </Grid>
                        );
                    })}
                </Grid>
            </Paper>
        </Box>
    );
}

// =================================================================
// 5. YENİ YARDIMCI BİLEŞEN: DetailTooltip (Güncelleyen bilgisini gösterir)
// =================================================================

function DetailTooltip({ dateISO, updater, updateDateISO, fmtDateTimeFixed }) {
    const mainText = fmtDateTimeFixed(dateISO);
    const theme = useTheme();

    const tooltipTitle = useMemo(() => {
        if (!updater || !updateDateISO) {
            return (
                <Stack spacing={0.5} sx={{ p: 0.5 }}>
                    <Typography variant="caption" fontWeight={600}>Güncelleme Kaydı</Typography>
                    <Typography variant="caption" color="text.secondary">Manuel güncelleme yapılmadı.</Typography>
                </Stack>
            );
        }

        return (
            <Stack spacing={0.5} sx={{ p: 0.5 }}>
                <Typography variant="caption" fontWeight={600}>Manuel Güncelleme:</Typography>
                <Typography variant="caption" sx={{ color: theme.palette.info.light }}>Güncelleyen: {updater}</Typography>
                <Typography variant="caption" sx={{ color: theme.palette.warning.light }}>Tarih: {fmtDateTimeFixed(updateDateISO)}</Typography>
            </Stack>
        );
    }, [updater, updateDateISO, fmtDateTimeFixed, theme]);

    return (
        <Tooltip title={tooltipTitle} placement="left" arrow>
            <Typography
                variant="body2"
                component="span"
                sx={{
                    fontWeight: 500,
                    cursor: 'help',
                    display: 'block',
                    minWidth: '100px',
                    color: mainText === '-' ? 'text.secondary' : (updater ? theme.palette.warning.light : 'white'),
                    transition: 'color 0.2s',
                    '&:hover': {
                        textDecoration: updater ? 'underline' : 'none',
                        color: updater ? theme.palette.info.main : 'white',
                    }
                }}
            >
                {mainText}
            </Typography>
        </Tooltip>
    );
}


// =================================================================
// 6. ANA BİLEŞEN: TamamlananlarPage
// =================================================================

const HOME_PATH = "/anasayfa";
const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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

        // Sorgu 1: Ana veriyi 'tamamlanan_seferler' tablosundan çek
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
            else if (field === 'status_display') continue;
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

        // --- GERÇEK VERİ ÇEKİMİ BAŞLANGIÇ ---
        const { data, count, error } = await query.range(from, to);
        // --- GERÇEK VERİ ÇEKİMİ SONU ---

        if (!error) {
            const currentRows = data || [];
            setRows(currentRows);
            setRowCount(count || 0);

            const seferNos = currentRows.map((r) => r.sefer_no);
            let maxTeslim = {};

            if (seferNos.length) {
                // Sorgu 2: ETA analizi için 'tamamlanan_detaylar' tablosundan son teslimat verisini çek
                // ******************************************************************************
                // DİKKAT: Yeni 8 sütunun çekilmesi için select("*") kullanıldığından emin olun.
                // Kodda zaten select("*") var, yani yeni sütunlar çekiliyor:
                // .select("sefer_no, teslim_varis") yerine .select("sefer_no, teslim_varis, teslim_cikis") kullanılması daha doğru olur.
                // Ancak bu alanda sadece ETA analizi yapıldığından `teslim_varis` yeterli olabilir.
                // openDetails fonksiyonunda tüm detaylar çekiliyor.
                // ******************************************************************************

                const { data: detailsData, error: detailsError } = await supabase
                    .from("tamamlanan_detaylar")
                    .select("sefer_no, teslim_varis, teslim_cikis")
                    .in("sefer_no", seferNos);

                if (detailsError) {
                    console.error("Error fetching detail data for ETA analysis:", detailsError);
                } else {
                    (detailsData || []).forEach(d => {
                        // Max Teslimat Zamanı olarak en son teslim varış veya teslim çıkış zamanını al
                        let currentTeslim = null;
                        if (d.teslim_varis && !Number.isNaN(new Date(d.teslim_varis).getTime())) {
                            currentTeslim = new Date(d.teslim_varis);
                        }
                        if (d.teslim_cikis && !Number.isNaN(new Date(d.teslim_cikis).getTime())) {
                            const tCikis = new Date(d.teslim_cikis);
                            if (!currentTeslim || tCikis > currentTeslim) {
                                currentTeslim = tCikis;
                            }
                        }

                        if (currentTeslim) {
                            if (!maxTeslim[d.sefer_no] || currentTeslim > maxTeslim[d.sefer_no]) {
                                maxTeslim[d.sefer_no] = currentTeslim;
                            }
                        }
                    });
                }

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

                for (const r of currentRows) {
                    const tETA = r?.eta_varis ? new Date(r.eta_varis) : null;
                    const tReal = maxTeslim[r.sefer_no] || null;

                    let status = "ONTIME";
                    let diffMin = 0;

                    if (tETA && tReal) {
                        diffMin = Math.round((tReal - tETA) / 60000);
                        if (diffMin > 5) { // 5 dakikadan fazla gecikme
                            status = "LATE"; late++;
                            delayAcc += diffMin; delayCnt++;
                            const abs = diffMin;
                            if (abs <= 30) lateBuckets[0].value++;
                            else if (abs <= 60) lateBuckets[1].value++;
                            else if (abs <= 120) lateBuckets[2].value++;
                            else if (abs <= 240) lateBuckets[3].value++;
                            else if (abs <= 480) lateBuckets[4].value++;
                            else lateBuckets[5].value++;
                        } else if (diffMin < -5) { // 5 dakikadan fazla erken
                            status = "EARLY"; early++;
                            earlyAcc += Math.abs(diffMin); earlyCnt++;
                        } else {
                            status = "ONTIME"; ontime++;
                        }
                    } else {
                        status = "ONTIME"; ontime++; // ETA veya Reel Varış yoksa şimdilik zamanında kabul et
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

        // Sorgu: 'tamamlanan_detaylar' tablosundan seçilen seferin tüm detaylarını çek
        // select("*") kullanıldığı için eklenen 8 sütun da (guncelleyen/tarih) otomatik olarak çekilecektir.
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
                    <Button
                        size="small"
                        onClick={() => openDetails(params.row)}
                        sx={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: theme.palette.info.light,
                            textDecoration: "underline",
                            "&:hover": {
                                background: 'transparent'
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
                sortable: false,
                filterable: false,
                renderCell: (params) => {
                    const statusData = analysis.bySefer[params.row.sefer_no];
                    // eta_varis boşsa durumu gösteremeyiz.
                    if (!statusData || !params.row.eta_varis || !statusData.maxTeslimISO) return <Typography variant="caption" color="text.secondary">-</Typography>;

                    const status = statusData.status;
                    const diffMin = statusData.diffMin;
                    const isLate = status === "LATE";
                    const isEarly = status === "EARLY";

                    let color = theme.palette.success.main;
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
        [openDetails, analysis, theme, downMd]
    );

    // Export functions with ExcelJS
    const exportExcel = async () => {
        if (!rows.length) return;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Tamamlanan Seferler");

        const cols = columns.filter(c => c.field !== 'status_display');

        worksheet.columns = cols.map(c => ({
            header: c.headerName,
            key: c.field,
            width: c.width / 8,
            style: { numFmt: c.field.includes('tarih') || c.field.includes('zamani') ? 'dd.mm.yyyy hh:mm' : undefined }
        }));

        const dataToExport = rows.map(r => {
            const row = {};
            cols.forEach(c => {
                let value = r[c.field];
                if (c.field === 'sefer_tarihi' || c.field === 'eta_varis' || c.field === 'kayit_zamani') {
                    row[c.field] = value ? new Date(value) : null;
                } else if (c.valueGetter) {
                    row[c.field] = c.valueGetter(null, r);
                } else {
                    row[c.field] = value;
                }
            });
            return row;
        });

        worksheet.addRows(dataToExport);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        saveAs(blob, `tamamlanan_seferler_${fmtDate(dateStart).toISOString().slice(0, 10)}.xlsx`);
    };

    const exportExcelWithDetails = async () => {
        if (!rows.length) return;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Ana Seferler");

        const mainCols = columns.filter(c => c.field !== 'status_display');
        worksheet.columns = mainCols.map(c => ({ header: c.headerName, key: c.field, width: 18 }));

        const mainData = rows.map(r => {
            const row = {};
            mainCols.forEach(c => {
                row[c.field] = r[c.field];
                if (c.field.includes('tarih') || c.field.includes('zamani')) {
                    row[c.field] = r[c.field] ? new Date(r[c.field]) : null;
                } else if (c.valueGetter) {
                    row[c.field] = c.valueGetter(null, r);
                }
            });
            return row;
        });
        worksheet.addRows(mainData);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        saveAs(blob, `tamamlanan_seferler_detayli_${fmtDate(dateStart).toISOString().slice(0, 10)}.xlsx`);
    };

    const statText = useMemo(() => {
        const pageStart = paginationModel.page * paginationModel.pageSize + 1;
        const pageEnd = Math.min(rowCount, pageStart + paginationModel.pageSize - 1);
        return loading
            ? `Yükleniyor...`
            : rowCount === 0
                ? "Kayıt bulunamadı"
                : `${pageStart} — ${pageEnd} / ${rowCount} Kayıt`;
    }, [rowCount, paginationModel, loading]);

    const handleDashboardFilter = (type) => {
        console.warn(`Dashboard filtresi (${type}) API seviyesinde desteklenmemektedir. Görsel gösterim için kullanılacaktır.`);
    };

    return (
        <Box
            sx={{
                height: "100dvh",
                display: "grid",
                gridTemplateRows: "auto auto auto 1fr",
                gap: 3,
                px: { xs: 1, md: 3 },
                pt: 3,
                pb: 2,
                background:
                    "radial-gradient(1200px 500px at 10% -10%, rgba(34,211,238,0.12), transparent 40%)," +
                    "radial-gradient(900px 400px at 90% 0%, rgba(139,92,246,0.15), transparent 50%)," +
                    "linear-gradient(180deg, #02040C 0%, #08101E 100%)",
            }}
        >
            <Helmet><title>OPERASYON ANALİZİ</title></Helmet>

            {/* Header (Title and Navigation) */}
            <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
                spacing={2}
            >
                <Stack spacing={0.5}>
                    <Typography
                        variant="h4"
                        fontWeight={700}
                        sx={{
                            lineHeight: 1.1,
                            background: "linear-gradient(90deg,#F59E0B,#A78BFA)",
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

                {/* Right Navigation Buttons */}
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

            {/* ACTIONS & FILTERS CARD */}
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    background: alpha(theme.palette.background.paper, 0.4),
                    border: "1px solid rgba(255,255,255,0.08)",
                    backdropFilter: "blur(6px)",
                    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
                    flexWrap: "wrap",
                }}
            >
                <Typography variant="subtitle2" sx={{ color: "text.secondary", pr: 1 }}>
                    Sefer Tarih Aralığı:
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                        type="date" size="small"
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

            {/* DataGrid - MAIN TABLE */}
            <Paper
                elevation={0}
                sx={{
                    borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.12)",
                    overflow: "hidden",
                    display: "grid",
                    gridTemplateRows: "1fr",
                    minHeight: 0,
                    boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.15)}`,
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
                    density="comfortable"
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
                        fontSize: 14,
                        "& .MuiDataGrid-toolbarContainer": {
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            background: "rgba(10,20,38,0.95)",
                            backdropFilter: "blur(6px)",
                            borderBottom: "1px solid rgba(255,255,255,0.1)",
                        },
                        "& .MuiDataGrid-columnHeaders": {
                            background: "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.9) 100%)",
                            color: "#E2E8F0",
                            borderBottom: `2px solid ${theme.palette.info.main}`,
                            fontWeight: 700,
                        },
                        "& .MuiDataGrid-cell": {
                            borderBottomColor: "rgba(255,255,255,0.06)",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                        },
                        "& .MuiDataGrid-row:nth-of-type(2n)": {
                            backgroundColor: "rgba(255,255,255,0.01)",
                        },
                        "& .MuiDataGrid-row:hover": {
                            backgroundColor: "rgba(34,211,238,0.1) !important",
                            transition: "background-color 0.3s ease",
                        },
                    }}
                />
            </Paper>

            {/* Detail Drawer */}
            <Drawer
                anchor="right"
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                PaperProps={{
                    sx: {
                        width: { xs: "100%", md: 860 },
                        backgroundColor: "#08101E",
                        color: "text.primary",
                        p: 3,
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
                            background: alpha("#10172A", 0.7)
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
                                        {/* GÜNCELLENEN BAŞLIKLAR: Tooltip ekledik */}
                                        <Tooltip title="Bu saate manuel müdahale yapıldıysa kimin yaptığını gösterir." arrow>
                                            <TableCell>Yükleme Varış</TableCell>
                                        </Tooltip>
                                        <Tooltip title="Bu saate manuel müdahale yapıldıysa kimin yaptığını gösterir." arrow>
                                            <TableCell>Yükleme Çıkış</TableCell>
                                        </Tooltip>
                                        <TableCell>Teslim Noktası</TableCell>
                                        <Tooltip title="Bu saate manuel müdahale yapıldıysa kimin yaptığını gösterir." arrow>
                                            <TableCell>Teslim Varış</TableCell>
                                        </Tooltip>
                                        <Tooltip title="Bu saate manuel müdahale yapıldıysa kimin yaptığını gösterir." arrow>
                                            <TableCell>Teslim Çıkış</TableCell>
                                        </Tooltip>
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
                                                sx={{ "&:hover": { backgroundColor: alpha("#22D3EE", 0.05) } }}
                                            >
                                                <TableCell>{d.nokta_sirasi}</TableCell>
                                                <TableCell>{d.proje_adi}</TableCell>
                                                <TableCell>{d.yukleme_noktasi}</TableCell>

                                                {/* Yükleme Varış - TOOLTIP EKLENDİ */}
                                                <TableCell>
                                                    <DetailTooltip
                                                        dateISO={d.yukleme_varis}
                                                        updater={d.yukleme_varis_guncelleyen}
                                                        updateDateISO={d.yukleme_varis_guncelleme_tarihi}
                                                        fmtDateTimeFixed={fmtDateTimeFixed}
                                                    />
                                                </TableCell>

                                                {/* Yükleme Çıkış - TOOLTIP EKLENDİ */}
                                                <TableCell>
                                                    <DetailTooltip
                                                        dateISO={d.yukleme_cikis}
                                                        updater={d.yukleme_cikis_guncelleyen}
                                                        updateDateISO={d.yukleme_cikis_guncelleme_tarihi}
                                                        fmtDateTimeFixed={fmtDateTimeFixed}
                                                    />
                                                </TableCell>

                                                <TableCell>{d.teslim_noktasi}</TableCell>

                                                {/* Teslim Varış - TOOLTIP EKLENDİ */}
                                                <TableCell>
                                                    <DetailTooltip
                                                        dateISO={d.teslim_varis}
                                                        updater={d.teslim_varis_guncelleyen}
                                                        updateDateISO={d.teslim_varis_guncelleme_tarihi}
                                                        fmtDateTimeFixed={fmtDateTimeFixed}
                                                    />
                                                </TableCell>

                                                {/* Teslim Çıkış - TOOLTIP EKLENDİ */}
                                                <TableCell>
                                                    <DetailTooltip
                                                        dateISO={d.teslim_cikis}
                                                        updater={d.teslim_cikis_guncelleyen}
                                                        updateDateISO={d.teslim_cikis_guncelleme_tarihi}
                                                        fmtDateTimeFixed={fmtDateTimeFixed}
                                                    />
                                                </TableCell>

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
