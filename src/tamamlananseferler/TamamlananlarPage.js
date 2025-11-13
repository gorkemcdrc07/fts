import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

// GERÇEK SUPABASE İMPORT'U
import { supabase } from "../supabaseClient";

// YETKİ: tamamlanan_seferler için
import usePermissions from "../auth/usePermissions";

/* MUI */
import {
    Box, Paper, Stack, Typography, Button, Drawer, IconButton, Divider,
    Table, TableHead, TableRow, TableCell, TableBody,
    CircularProgress, TextField, Tooltip, useMediaQuery, useTheme,
    Select, MenuItem, InputLabel, FormControl,
    Grid,
    Dialog, DialogTitle, DialogContent, DialogActions
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
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { DataGrid, GridToolbarContainer, GridToolbarQuickFilter, GridToolbarColumnsButton } from "@mui/x-data-grid";

// =================================================================
// 2. DATE TIME HELPERS
// =================================================================

// datetime-local input için (offset'i sıfırlayarak) yardımcı
const fmtDate = (d) => {
    if (!d) return null;
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
};

// ---- Sabit Europe/Istanbul gösterimi ----
const TR_TZ = "Europe/Istanbul";

const fmtDateTimeTR = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "-";
    const date = new Intl.DateTimeFormat("tr-TR", {
        timeZone: TR_TZ,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(d);
    const time = new Intl.DateTimeFormat("tr-TR", {
        timeZone: TR_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(d);
    return `${date} ${time}`;
};

const fmtDateTR = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("tr-TR", {
        timeZone: TR_TZ,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(d);
};

// Tarihi ISO stringine çevirir veya null döndürür
const toISO = (d) => d instanceof Date && !isNaN(d) ? d.toISOString() : null;

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
                    <Box sx={{ minWidth: 150, textAlign: 'right' }}>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                            {statText}
                        </Typography>
                    </Box>

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
// 5. YENİ YARDIMCI BİLEŞEN: DetailTooltip
// =================================================================
function DetailTooltip({ dateISO, updater, updateDateISO, fmtDateTimeFixed }) {
    const mainText = fmtDateTimeFixed(dateISO); // dışarıdan fmtDateTimeTR gönderiyoruz
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

    // Düzenleme
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingSefer, setEditingSefer] = useState(null);
    const [editingDetails, setEditingDetails] = useState([]);

    const [analysis, setAnalysis] = useState({
        bySefer: {},
        summary: { early: 0, ontime: 0, late: 0, avgDelayMin: 0, avgEarlyMin: 0 },
        lateBuckets: [],
    });

    // ---- YETKİLER (Tamamlanan Seferler) ----
    const { loading: permLoading, canEdit, flags } = usePermissions("tamamlanan_seferler");
    const canEditCompleted = !!(flags?.tmam_can_edit_details || canEdit);

    // === ORTAK SORGU KURUCUSU (filtre + sıralama + tarih) ===
    const buildBaseQuery = useCallback(() => {
        let q = supabase.from("tamamlanan_seferler").select("*", { count: "exact" });

        if (dateStart) q = q.gte("sefer_tarihi", new Date(dateStart).toISOString());
        if (dateEnd) {
            const endIso = new Date(new Date(dateEnd).setHours(23, 59, 59, 999)).toISOString();
            q = q.lte("sefer_tarihi", endIso);
        }

        // Quick filter
        const qVals = filterModel?.quickFilterValues ?? [];
        if (qVals.length) {
            const qStr = qVals.join(" ").replace(/%/g, "");
            q = q.or([
                `sefer_no.ilike.%${qStr}%`,
                `plaka.ilike.%${qStr}%`,
                `surucu_ad_soyad.ilike.%${qStr}%`,
                `musteri_adi.ilike.%${qStr}%`,
                `hizmet_adi.ilike.%${qStr}%`,
                `proje_adi.ilike.%${qStr}%`,
                `yukleme_noktasi.ilike.%${qStr}%`,
                `teslim_noktasi.ilike.%${qStr}%`,
                `yukleme_ili.ilike.%${qStr}%`,
                `yukleme_ilcesi.ilike.%${qStr}%`,
                `teslim_ili.ilike.%${qStr}%`,
                `teslim_ilcesi.ilike.%${qStr}%`,
            ].join(","));
        }

        // Grid filtreleri
        for (const f of filterModel?.items || []) {
            const field = f.field, value = f.value;
            if (!field || value == null || value === "" || field === "status_display") continue;
            const op = f.operator ?? f.operatorValue ?? "contains";
            if (op === "is" || op === "equals") q = q.eq(field, value);
            else if (op === "startsWith") q = q.ilike(field, `${value}%`);
            else if (op === "endsWith") q = q.ilike(field, `%${value}`);
            else if (op === "isAnyOf" && Array.isArray(value) && value.length) q = q.in(field, value);
            else q = q.ilike(field, `%${value}%`);
        }

        if (sortModel?.length) {
            const s = sortModel[0];
            q = q.order(s.field, { ascending: s.sort !== "desc", nullsFirst: false });
        } else {
            q = q.order("sefer_tarihi", { ascending: false, nullsFirst: false });
        }

        return q;
    }, [dateStart, dateEnd, filterModel, sortModel]);

    // === TÜM KAYITLARI batch batch çeken helper ===
    const fetchAllMatchingRows = useCallback(async (batchSize = 1000) => {
        let all = [];
        let from = 0;

        while (true) {
            const base = buildBaseQuery(); // her turda yeniden kur
            const { data, error } = await base.range(from, from + batchSize - 1);
            if (error) throw error;

            const chunk = data || [];
            all = all.concat(chunk);

            if (chunk.length < batchSize) break; // bitti
            from += batchSize;
        }
        return all;
    }, [buildBaseQuery]);

    const fetchPage = useCallback(async () => {
        setLoading(true);

        try {
            // Tek merkezden aynı filtre/sıralama
            let query = buildBaseQuery();

            // Pagination aralığı
            const from = paginationModel.page * paginationModel.pageSize;
            const to = from + paginationModel.pageSize - 1;

            // Sadece 1 kez range çağrısı
            const { data, count, error } = await query.range(from, to);
            if (error) throw error;

            const currentRows = data || [];
            setRows(currentRows);
            setRowCount(count || 0);

            // ------- ETA analizi -------
            const seferNos = currentRows.map((r) => r.sefer_no);
            let maxTeslim = {};

            if (seferNos.length) {
                const { data: detailsData, error: detailsError } = await supabase
                    .from("tamamlanan_detaylar")
                    .select("sefer_no, teslim_varis, teslim_cikis")
                    .in("sefer_no", seferNos);

                if (!detailsError) {
                    (detailsData || []).forEach(d => {
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
                    status = "ONTIME"; ontime++;
                }

                bySefer[r.sefer_no] = {
                    etaISO: tETA ? tETA.toISOString() : null,
                    maxTeslimISO: tReal ? tReal.toISOString() : null,
                    status,
                    diffMin,
                };
                // Not: İstersen satıra status_display yazmak için burada currentRows üzerinde map de yapabilirsin.
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
        } catch (err) {
            console.error(err);
        }

        setLoading(false);
    }, [buildBaseQuery, paginationModel]);

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

        const { data, error } = await supabase
            .from("tamamlanan_detaylar")
            .select("*")
            .eq("sefer_no", row.sefer_no)
            .order("nokta_sirasi", { ascending: true });

        if (!error) setDetailRows(data || []);
        setDetailLoading(false);
    }, []);

    // Düzenleme modalını açar ve veriyi hazırlar (YETKİ KONTROLÜ EKLİ)
    const openEditModal = useCallback(async (seferRow) => {
        if (!canEditCompleted) {
            alert("Bu işlem için yetkiniz yok.");
            return;
        }

        setEditingSefer(seferRow);
        setDetailOpen(false);
        setEditModalOpen(true);

        const { data, error } = await supabase
            .from("tamamlanan_detaylar")
            .select("*")
            .eq("sefer_no", seferRow.sefer_no)
            .order("nokta_sirasi", { ascending: true });

        if (!error) {
            const parsedDetails = (data || []).map(d => ({
                ...d,
                _pk: `${d.sefer_no}#${d.nokta_sirasi}`, // UI benzersiz anahtar
                yukleme_varis: d.yukleme_varis ? new Date(d.yukleme_varis) : null,
                yukleme_cikis: d.yukleme_cikis ? new Date(d.yukleme_cikis) : null,
                teslim_varis: d.teslim_varis ? new Date(d.teslim_varis) : null,
                teslim_cikis: d.teslim_cikis ? new Date(d.teslim_cikis) : null,
            }));
            setEditingDetails(parsedDetails);
        } else {
            console.error("Detaylar çekilemedi:", error);
        }
    }, [canEditCompleted]);

    // Değişiklikleri Supabase'e kaydeder (YETKİ KONTROLÜ EKLİ)
    const handleSaveEdit = useCallback(async (updatedSefer, updatedDetails) => {
        if (!canEditCompleted) {
            alert("Bu işlem için yetkiniz yok.");
            return;
        }

        const { data: userData } = await supabase.auth.getUser();
        const guncelleyen = userData?.user?.email || "Unknown User";
        const nowISO = new Date().toISOString();
        let hasError = false;

        for (const detail of updatedDetails) {
            if (!detail?.sefer_no || typeof detail?.nokta_sirasi === "undefined") {
                console.error("Eksik PK bilgisi:", detail);
                hasError = true;
                continue;
            }

            const { error } = await supabase
                .from("tamamlanan_detaylar")
                .update({
                    yukleme_varis: toISO(detail.yukleme_varis),
                    yukleme_cikis: toISO(detail.yukleme_cikis),
                    teslim_varis: toISO(detail.teslim_varis),
                    teslim_cikis: toISO(detail.teslim_cikis),
                    // Manuel müdahale logları
                    yukleme_varis_guncelleyen: guncelleyen,
                    yukleme_varis_guncelleme_tarihi: nowISO,
                    yukleme_cikis_guncelleyen: guncelleyen,
                    yukleme_cikis_guncelleme_tarihi: nowISO,
                    teslim_varis_guncelleyen: guncelleyen,
                    teslim_varis_guncelleme_tarihi: nowISO,
                    teslim_cikis_guncelleyen: guncelleyen,
                    teslim_cikis_guncelleme_tarihi: nowISO,
                })
                .match({
                    sefer_no: detail.sefer_no,
                    nokta_sirasi: detail.nokta_sirasi,
                });

            if (error) {
                console.error("Detay güncelleme hatası:", error);
                hasError = true;
            }
        }

        if (hasError) {
            alert("Hata: Bazı veriler güncellenemedi.");
        } else {
            alert("Güncelleme başarılı!");
            setEditModalOpen(false);
            fetchPage();
        }
    }, [canEditCompleted, fetchPage]);

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
                            "&:hover": { background: 'transparent' }
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
                valueGetter: (v, row) => (row?.sefer_tarihi ? fmtDateTR(row.sefer_tarihi) : "-"),
            },

            {
                field: "status_display",
                headerName: "ETA Durum",
                width: 140,
                sortable: false,
                filterable: false,
                renderCell: (params) => {
                    const statusData = analysis.bySefer[params.row.sefer_no];
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
                        <Tooltip title={`ETA: ${fmtDateTimeTR(params.row.eta_varis)} | Reel: ${fmtDateTimeTR(statusData.maxTeslimISO)}`}>
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
                valueGetter: (v, row) => (row?.eta_varis ? fmtDateTimeTR(row.eta_varis) : "-"),
            },

            { field: "surucu_tckn", headerName: "TCKN", width: 120, hide: downMd },
            { field: "surucu_telefon", headerName: "Telefon", width: 140, hide: downMd },
            { field: "atama_yapan_kullanici", headerName: "Atayan", width: 160 },
            {
                field: "kayit_zamani",
                headerName: "Kayıt Zamanı",
                width: 180,
                valueGetter: (v, row) => (row?.kayit_zamani ? fmtDateTimeTR(row.kayit_zamani) : "-"),
            },
        ],
        [openDetails, analysis, theme, downMd]
    );

    // Export functions with ExcelJS
    const exportExcel = async () => {
        const allRows = await fetchAllMatchingRows();
        if (!allRows.length) return;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Tamamlanan Seferler");

        const cols = columns.filter(c => c.field !== 'status_display');
        worksheet.columns = cols.map(c => ({
            header: c.headerName,
            key: c.field,
            width: Math.max(12, Math.round((c.width || 140) / 8)),
            style: { numFmt: (c.field.includes('tarih') || c.field.includes('zamani')) ? 'dd.mm.yyyy hh:mm' : undefined }
        }));

        const dataToExport = allRows.map(r => {
            const row = {};
            cols.forEach(c => {
                if (c.field === 'sefer_tarihi' || c.field === 'eta_varis' || c.field === 'kayit_zamani') {
                    row[c.field] = r[c.field] ? new Date(r[c.field]) : null;
                } else if (c.valueGetter) {
                    row[c.field] = c.valueGetter(null, r);
                } else {
                    row[c.field] = r[c.field];
                }
            });
            return row;
        });

        worksheet.addRows(dataToExport);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const startStr = (fmtDate(dateStart)?.toISOString()?.slice(0, 10)) || "baslangic";
        const endStr = (fmtDate(dateEnd)?.toISOString()?.slice(0, 10)) || "bitis";
        saveAs(blob, `tamamlanan_seferler_${startStr}__${endStr}.xlsx`);
    };

    // YENİ: Tüm filtreye uyan ana kayıtları ve detayları export eder
    const exportExcelWithDetails = async () => {
        // 1) Filtre + sıralama + tarih aralığına uyan TÜM kayıtları çek
        const mainRows = await fetchAllMatchingRows();
        if (!mainRows.length) return;

        const workbook = new ExcelJS.Workbook();

        // === Sayfa 1: Ana Seferler ===
        const wsMain = workbook.addWorksheet("Ana Seferler");
        const mainCols = columns.filter(c => c.field !== 'status_display');
        wsMain.columns = mainCols.map(c => ({
            header: c.headerName,
            key: c.field,
            width: 18
        }));

        const mainData = mainRows.map(r => {
            const row = {};
            mainCols.forEach(c => {
                if (c.valueGetter) {
                    row[c.field] = c.valueGetter(null, r);
                } else if (c.field.includes('tarih') || c.field.includes('zamani')) {
                    row[c.field] = r[c.field] ? new Date(r[c.field]) : null;
                } else {
                    row[c.field] = r[c.field];
                }
            });
            return row;
        });
        wsMain.addRows(mainData);

        // === Sayfa 2: Detaylar (tamamlanan_detaylar) ===
        const wsDetay = workbook.addWorksheet("Detaylar");
        wsDetay.columns = [
            { header: "sefer_no", key: "sefer_no", width: 18 },
            { header: "nokta_sirasi", key: "nokta_sirasi", width: 12 },
            { header: "proje_adi", key: "proje_adi", width: 24 },
            { header: "yukleme_noktasi", key: "yukleme_noktasi", width: 24 },
            { header: "yukleme_varis", key: "yukleme_varis", width: 20 },
            { header: "yukleme_cikis", key: "yukleme_cikis", width: 20 },
            { header: "teslim_noktasi", key: "teslim_noktasi", width: 24 },
            { header: "teslim_varis", key: "teslim_varis", width: 20 },
            { header: "teslim_cikis", key: "teslim_cikis", width: 20 },
        ];

        const seferNos = mainRows.map(r => r.sefer_no).filter(Boolean);
        const chunkSize = 1000;
        let allDetails = [];

        for (let i = 0; i < seferNos.length; i += chunkSize) {
            const chunk = seferNos.slice(i, i + chunkSize);
            const { data, error } = await supabase
                .from("tamamlanan_detaylar")
                .select("sefer_no, nokta_sirasi, proje_adi, yukleme_noktasi, yukleme_varis, yukleme_cikis, teslim_noktasi, teslim_varis, teslim_cikis")
                .in("sefer_no", chunk)
                .order("sefer_no", { ascending: true })
                .order("nokta_sirasi", { ascending: true });

            if (error) throw error;
            allDetails = allDetails.concat(data || []);
        }

        wsDetay.addRows(allDetails.map(d => ({
            ...d,
            yukleme_varis: d.yukleme_varis ? new Date(d.yukleme_varis) : null,
            yukleme_cikis: d.yukleme_cikis ? new Date(d.yukleme_cikis) : null,
            teslim_varis: d.teslim_varis ? new Date(d.teslim_varis) : null,
            teslim_cikis: d.teslim_cikis ? new Date(d.teslim_cikis) : null,
        })));

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const startStr = (fmtDate(dateStart)?.toISOString()?.slice(0, 10)) || "baslangic";
        const endStr = (fmtDate(dateEnd)?.toISOString()?.slice(0, 10)) || "bitis";
        saveAs(blob, `tamamlanan_seferler_detayli_${startStr}__${endStr}.xlsx`);
    };

    // --------- EKLENDİ: statText ve handleDashboardFilter ----------
    const statText = useMemo(() => {
        const pageStart = paginationModel.page * paginationModel.pageSize + 1;
        const pageEnd = Math.min(rowCount, pageStart + paginationModel.pageSize - 1);
        return loading
            ? "Yükleniyor..."
            : rowCount === 0
                ? "Kayıt bulunamadı"
                : `${pageStart} — ${pageEnd} / ${rowCount} Kayıt`;
    }, [rowCount, paginationModel, loading]);

    const handleDashboardFilter = (type) => {
        // İleride API seviyesinde filtreleme / ek sorgular buraya eklenebilir
        console.warn(`Dashboard filtresi (${type}) API seviyesinde desteklenmiyor. Görsel amaçlı.`);
    };
    // ---------------------------------------------------------------

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

            {/* Header */}
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
                    `${(dateStart && new Date(dateStart).toLocaleDateString("tr-TR")) || "-"}  —  ${(dateEnd && new Date(dateEnd).toLocaleDateString("tr-TR")) || "-"}`
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

                    {selected && canEditCompleted && (
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<EditIcon sx={{ fontSize: 16 }} />}
                            onClick={() => openEditModal(selected)}
                            sx={{
                                borderRadius: 2,
                                background: theme.palette.warning.main,
                                '&:hover': { background: theme.palette.warning.dark }
                            }}
                        >
                            Düzenle
                        </Button>
                    )}

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
                                        detailRows.map((d) => (
                                            <TableRow
                                                key={`${d.sefer_no}#${d.nokta_sirasi}`}
                                                hover
                                                sx={{ "&:hover": { backgroundColor: alpha("#22D3EE", 0.05) } }}
                                            >
                                                <TableCell>{d.nokta_sirasi}</TableCell>
                                                <TableCell>{d.proje_adi}</TableCell>
                                                <TableCell>{d.yukleme_noktasi}</TableCell>

                                                {/* Yükleme Varış */}
                                                <TableCell>
                                                    <DetailTooltip
                                                        dateISO={d.yukleme_varis}
                                                        updater={d.yukleme_varis_guncelleyen}
                                                        updateDateISO={d.yukleme_varis_guncelleme_tarihi}
                                                        fmtDateTimeFixed={fmtDateTimeTR}
                                                    />
                                                </TableCell>

                                                {/* Yükleme Çıkış */}
                                                <TableCell>
                                                    <DetailTooltip
                                                        dateISO={d.yukleme_cikis}
                                                        updater={d.yukleme_cikis_guncelleyen}
                                                        updateDateISO={d.yukleme_cikis_guncelleme_tarihi}
                                                        fmtDateTimeFixed={fmtDateTimeTR}
                                                    />
                                                </TableCell>

                                                <TableCell>{d.teslim_noktasi}</TableCell>

                                                {/* Teslim Varış */}
                                                <TableCell>
                                                    <DetailTooltip
                                                        dateISO={d.teslim_varis}
                                                        updater={d.teslim_varis_guncelleyen}
                                                        updateDateISO={d.teslim_varis_guncelleme_tarihi}
                                                        fmtDateTimeFixed={fmtDateTimeTR}
                                                    />
                                                </TableCell>

                                                {/* Teslim Çıkış */}
                                                <TableCell>
                                                    <DetailTooltip
                                                        dateISO={d.teslim_cikis}
                                                        updater={d.teslim_cikis_guncelleyen}
                                                        updateDateISO={d.teslim_cikis_guncelleme_tarihi}
                                                        fmtDateTimeFixed={fmtDateTimeTR}
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

            {/* Edit Modal */}
            <EditModal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                sefer={editingSefer}
                details={editingDetails}
                onSave={handleSaveEdit}
                canEditCompleted={canEditCompleted}
            />
        </Box>
    );
}

// =================================================================
// 7. YENİ BİLEŞEN: EditModal
// =================================================================
function EditModal({ open, onClose, sefer, details, onSave, canEditCompleted }) {
    const theme = useTheme();
    // Local state'i Date objeleri olarak tutuyoruz.
    const [localSefer, setLocalSefer] = useState(sefer);
    const [localDetails, setLocalDetails] = useState(details);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocalSefer(sefer);
        if (details) setLocalDetails(details);
    }, [sefer, details]);

    if (!localSefer) return null;

    // Tarih/saat alanlarının değişimini yöneten fonksiyon
    const handleDetailChange = (pk, field, value) => {
        setLocalDetails(prev => prev.map(d =>
            d._pk === pk ? { ...d, [field]: value ? new Date(value) : null } : d
        ));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(localSefer, localDetails);
        setIsSaving(false);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    backgroundColor: alpha(theme.palette.background.paper, 0.95),
                    border: '1px solid rgba(255,255,255,0.1)',
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EditIcon />
                Sefer Düzenleme: <Box component="span" sx={{ color: theme.palette.warning.light }}>{localSefer.sefer_no}</Box>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ pt: 2, pb: 0, maxHeight: '80vh' }}>
                <Typography variant="h6" gutterBottom color="text.secondary">Detay Noktaları (Tarih/Saat Düzenleme)</Typography>
                <Box sx={{ overflowY: 'auto', pr: 1, pb: 1 }}>
                    {localDetails.map(detail => (
                        <Box key={detail._pk} sx={{ mb: 3, p: 2, border: '1px solid #334155', borderRadius: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600} mb={1} sx={{ color: theme.palette.info.light }}>
                                {detail.nokta_sirasi}. Durak: {detail.yukleme_noktasi || detail.teslim_noktasi}
                            </Typography>

                            <Grid container spacing={2}>
                                {/* Yükleme Varış */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Yükleme Varış (Tarih ve Saat)"
                                        type="datetime-local"
                                        size="small"
                                        value={
                                            detail.yukleme_varis
                                                ? fmtDate(detail.yukleme_varis).toISOString().slice(0, 16)
                                                : ""
                                        }
                                        onChange={(e) => handleDetailChange(detail._pk, 'yukleme_varis', e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ input: { color: 'white' } }}
                                    />
                                </Grid>
                                {/* Yükleme Çıkış */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Yükleme Çıkış (Tarih ve Saat)"
                                        type="datetime-local"
                                        size="small"
                                        value={
                                            detail.yukleme_cikis
                                                ? fmtDate(detail.yukleme_cikis).toISOString().slice(0, 16)
                                                : ""
                                        }
                                        onChange={(e) => handleDetailChange(detail._pk, 'yukleme_cikis', e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ input: { color: 'white' } }}
                                    />
                                </Grid>
                                {/* Teslim Varış */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Teslim Varış (Tarih ve Saat)"
                                        type="datetime-local"
                                        size="small"
                                        value={
                                            detail.teslim_varis
                                                ? fmtDate(detail.teslim_varis).toISOString().slice(0, 16)
                                                : ""
                                        }
                                        onChange={(e) => handleDetailChange(detail._pk, 'teslim_varis', e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ input: { color: 'white' } }}
                                    />
                                </Grid>
                                {/* Teslim Çıkış */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Teslim Çıkış (Tarih ve Saat)"
                                        type="datetime-local"
                                        size="small"
                                        value={
                                            detail.teslim_cikis
                                                ? fmtDate(detail.teslim_cikis).toISOString().slice(0, 16)
                                                : ""
                                        }
                                        onChange={(e) => handleDetailChange(detail._pk, 'teslim_cikis', e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ input: { color: 'white' } }}
                                    />
                                </Grid>
                            </Grid>
                        </Box>
                    ))}
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} disabled={isSaving}>İptal</Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    color="warning"
                    startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    disabled={isSaving || !canEditCompleted}
                >
                    Kaydet
                </Button>
            </DialogActions>
        </Dialog>
    );
}
