import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// Dayjs
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import weekday from "dayjs/plugin/weekday";
import weekOfYear from "dayjs/plugin/weekOfYear";
import "dayjs/locale/tr";

// Excel
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// MUI
import {
    Box,
    Button,
    Chip,
    Container,
    IconButton,
    Paper,
    Stack,
    TextField,
    Tooltip,
    Typography,
    Alert,
    CircularProgress,
    LinearProgress,
    Grid,
    MenuItem,
} from "@mui/material";

import { alpha } from "@mui/material/styles";

// DataGrid
import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarQuickFilter,
} from "@mui/x-data-grid";

// ICONS
import {
    Refresh as RefreshIcon,
    InfoOutlined as InfoOutlinedIcon,
    Download as DownloadIcon,
    Summarize as SummarizeIcon,
    AvTimer as AvTimerIcon,
    WarningAmber as WarningIcon,
    AccessAlarm as AccessAlarmIcon,
} from "@mui/icons-material";

// Modal Component
import TripDetailModal from "./TripDetailModal";

// ===================== Dayjs Setup =====================
dayjs.extend(duration);
dayjs.extend(weekday);
dayjs.extend(weekOfYear);
dayjs.locale("tr");

/* ===================== Sabitler ===================== */
const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";
const TARGET_WAIT_MINUTES = 240;

const SUMMARY_COLS = [
    "id", "sefer_no", "plaka", "treyler", "surucu_ad_soyad", "surucu_tckn",
    "surucu_telefon", "sefer_tarihi", "yukleme_ili", "yukleme_ilcesi",
    "teslim_ili", "teslim_ilcesi", "musteri_adi", "yukleme_noktasi",
    "teslim_noktasi", "proje_adi",
].join(",");

const DETAIL_COLS = [
    "sefer_no", "nokta_sirasi", "yukleme_noktasi", "teslim_noktasi",
    "yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis",
    "yukleme_varis_guncelleyen", "yukleme_varis_guncelleme_tarihi",
    "yukleme_cikis_guncelleyen", "yukleme_cikis_guncelleme_tarihi",
    "teslim_varis_guncelleyen", "teslim_varis_guncelleme_tarihi",
    "teslim_cikis_guncelleyen", "teslim_cikis_guncelleme_tarihi",
].join(",");

/* ===================== Yardımcı Fonksiyonlar ===================== */
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

const minToHM = (m) => {
    const mm = Math.max(0, Math.round(m || 0));
    const h = Math.floor(mm / 60);
    const r = mm % 60;
    if (h && r) return `${h} sa ${r} dk`;
    if (h) return `${h} sa`;
    if (r) return `${r} dk`;
    return `0 dk`;
};

const fmtMinutes = (min) => {
    if (min === null || min === undefined) return "—";
    const n = Math.round(Number(min));
    return minToHM(n);
};

/* ===================== WaitChip ===================== */
const WaitChip = ({ minutes }) => {
    if (minutes === null) return <Chip label="—" size="small" variant="outlined" />;

    let color = "success";
    let label = fmtMinutes(minutes);
    if (minutes >= TARGET_WAIT_MINUTES) color = "error";
    else if (minutes >= TARGET_WAIT_MINUTES * 0.75) color = "warning";
    else if (minutes >= TARGET_WAIT_MINUTES * 0.5) color = "info";

    return (
        <Tooltip title={`${minutes} dakika bekleme`}>
            <Chip
                color={color}
                label={label}
                variant={minutes >= TARGET_WAIT_MINUTES * 0.75 ? "filled" : "outlined"}
                size="small"
                sx={{ fontWeight: 600 }}
            />
        </Tooltip>
    );
};

/* ===================== ExcelToolbar ===================== */
const ExcelToolbar = ({ onExport, onRefresh, disabled }) => (
    <GridToolbarContainer sx={{ p: 1 }}>
        <GridToolbarQuickFilter
            quickFilterParser={(v) => v.split(/\s+/).filter(Boolean)}
            debounceMs={300}
            placeholder="Tabloda Ara..."
            sx={{ flexGrow: 1 }}
        />

        <Stack direction="row" spacing={1}>
            <Tooltip title="Excel Raporu İndir">
                <span>
                    <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        variant="contained"
                        onClick={onExport}
                        disabled={disabled}
                    >
                        Excel İndir
                    </Button>
                </span>
            </Tooltip>

            <Tooltip title="Yenile">
                <span>
                    <IconButton onClick={onRefresh} disabled={disabled} color="primary">
                        <RefreshIcon />
                    </IconButton>
                </span>
            </Tooltip>
        </Stack>
    </GridToolbarContainer>
);

/* ===================== StatCard ===================== */
const StatCard = ({ title, value, icon, color = "primary.main" }) => (
    <Paper
        elevation={0}
        variant="outlined"
        sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2, borderRadius: 2 }}
    >
        <Box sx={(theme) => {
            const [pk, shade] = color.split(".");
            const resolvedColor =
                theme.palette[pk] && theme.palette[pk][shade]
                    ? theme.palette[pk][shade]
                    : color;
            return {
                p: 1.5,
                bgcolor: alpha(resolvedColor, 0.1),
                color,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
            };
        }}>
            {icon}
        </Box>

        <Box>
            <Typography variant="h6" fontWeight={700}>{value}</Typography>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
        </Box>
    </Paper>
);

/* ===================== ANA BİLEŞEN ===================== */
export default function YuklemedeBekleme() {
    const [rows, setRows] = useState([]);
    const [detailByNo, setDetailByNo] = useState(new Map());
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const [minDakika, setMinDakika] = useState(240);

    // ⭐ Yeni filtre türü
    const [filterType, setFilterType] = useState("day"); // day | week | month | range

    const [dateFilter, setDateFilter] = useState(dayjs().format("YYYY-MM-DD"));
    const [dateStart, setDateStart] = useState(dayjs().format("YYYY-MM-DD"));
    const [dateEnd, setDateEnd] = useState(dayjs().format("YYYY-MM-DD"));

    const [selectedRow, setSelectedRow] = useState(null);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);

    const openDetail = (row) => {
        setSelectedRow(row);
        setDetailModalOpen(true);
    };
    const closeDetail = () => {
        setDetailModalOpen(false);
        setSelectedRow(null);
    };

    /* ===================== FETCH ALL ===================== */
    const fetchAll = useCallback(async () => {
        setLoading(true);
        setFetchError(null);

        let startDate, endDate;

        /** ⭐ Filtre türüne göre tarih aralığı belirle */
        if (filterType === "day") {
            startDate = dayjs(dateFilter).startOf("day").toISOString();
            endDate = dayjs(dateFilter).endOf("day").toISOString();

        } else if (filterType === "week") {
            startDate = dayjs(dateFilter).startOf("week").toISOString();
            endDate = dayjs(dateFilter).endOf("week").toISOString();

        } else if (filterType === "month") {
            startDate = dayjs(dateFilter).startOf("month").toISOString();
            endDate = dayjs(dateFilter).endOf("month").toISOString();

        } else {
            // RANGE
            startDate = dayjs(dateStart).startOf("day").toISOString();
            endDate = dayjs(dateEnd).endOf("day").toISOString();
        }

        /* === SUMMARY === */
        const { data: summaryData, error: summaryError } = await supabase
            .from(SUMMARY_TABLE)
            .select(SUMMARY_COLS)
            .gte("sefer_tarihi", startDate)
            .lte("sefer_tarihi", endDate);

        if (summaryError) {
            setFetchError(summaryError.message);
            setLoading(false);
            return;
        }

        const summaryResult = summaryData || [];
        if (summaryResult.length === 0) {
            setRows([]);
            setDetailByNo(new Map());
            setLoading(false);
            return;
        }

        const seferNos = summaryResult.map((s) => s.sefer_no).filter(Boolean);

        const { data: detailData, error: detailError } = await supabase
            .from(DETAIL_TABLE)
            .select(DETAIL_COLS)
            .in("sefer_no", seferNos);

        if (detailError) {
            setFetchError(detailError.message);
        }

        const detailResult = detailData || [];
        const byNo = new Map();
        const finalGridRows = [];

        for (const summaryRow of summaryResult) {
            const sefer_no = summaryRow.sefer_no;

            const detailsForSefer = detailResult
                .filter((d) => d.sefer_no === sefer_no)
                .sort((a, b) => (a.nokta_sirasi ?? 999) - (b.nokta_sirasi ?? 999));

            byNo.set(sefer_no, detailsForSefer);

            const validLoadsRaw = detailsForSefer.filter(
                (d) => d.yukleme_varis && d.yukleme_cikis && d.yukleme_noktasi
            );
            if (validLoadsRaw.length === 0) continue;

            // Aynı nokta+varış+çıkış tekilleştirme
            const seenKeys = new Set();
            const validLoads = validLoadsRaw.filter((d) => {
                const key = `${d.yukleme_noktasi}|${d.yukleme_varis}|${d.yukleme_cikis}`;
                if (seenKeys.has(key)) return false;
                seenKeys.add(key);
                return true;
            });

            // Lokasyona göre gruplama
            const grouped = validLoads.reduce((acc, stop) => {
                if (!acc[stop.yukleme_noktasi]) acc[stop.yukleme_noktasi] = [];
                acc[stop.yukleme_noktasi].push(stop);
                return acc;
            }, {});

            for (const loc in grouped) {
                const stops = grouped[loc];

                const totalWait = stops.reduce((s, st) => {
                    const m = diffMinutes(st.yukleme_varis, st.yukleme_cikis);
                    return s + (m || 0);
                }, 0);

                if (totalWait === 0) continue;

                finalGridRows.push({
                    ...summaryRow,
                    id: `${sefer_no}-${loc}`,
                    yukleme_noktasi: loc,
                    bekleme_dk: totalWait,
                    yukleme_varis: stops[0].yukleme_varis,
                    yukleme_cikis: stops[0].yukleme_cikis,
                });
            }
        }

        setDetailByNo(byNo);
        setRows(finalGridRows);
        setLoading(false);
    }, [filterType, dateFilter, dateStart, dateEnd]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    /* ===================== FİLTRELİ VERİ ===================== */
    const filtered = useMemo(() => {
        const minTime = Number(minDakika) || 0;
        return rows
            .filter((r) => (r.bekleme_dk ?? -1) >= minTime)
            .sort((a, b) => (b.bekleme_dk ?? 0) - (a.bekleme_dk ?? 0));
    }, [rows, minDakika]);

    /* ===================== İSTATİSTİKLER ===================== */
    const stats = useMemo(() => {
        if (!filtered.length) return { total: 0, avg: "0 dk", problematic: 0, totalExcess: "0 dk" };

        const total = filtered.length;
        const sum = filtered.reduce((a, r) => a + (r.bekleme_dk || 0), 0);
        const avg = sum / total;

        const problematic = filtered.filter((r) => r.bekleme_dk >= TARGET_WAIT_MINUTES).length;

        const totalExcess = filtered.reduce((a, r) => {
            const exc = r.bekleme_dk - TARGET_WAIT_MINUTES;
            return exc > 0 ? a + exc : a;
        }, 0);

        return {
            total,
            avg: minToHM(avg),
            problematic,
            totalExcess: minToHM(totalExcess),
        };
    }, [filtered]);

    /* ===================== EXCEL ===================== */
    const handleExport = async () => {
        if (!filtered.length) return;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Bekleme Analizi");

        const data = filtered.map((r) => ({
            "Sefer No": r.sefer_no,
            Plaka: r.plaka,
            Treyler: r.treyler,
            Şoför: r.surucu_ad_soyad,
            "Proje Adı": r.proje_adi,
            "Yükleme Noktası": r.yukleme_noktasi,
            "Yükleme İl": r.yukleme_ili,
            "Yükleme İlçe": r.yukleme_ilcesi,
            "Yükleme Varış": fmtDateTR(r.yukleme_varis),
            "Yükleme Çıkış": fmtDateTR(r.yukleme_cikis),
            "Bekleme (dk)": r.bekleme_dk,
            "Bekleme Süresi": minToHM(r.bekleme_dk),
        }));

        sheet.columns = Object.keys(data[0]).map((k) => ({
            header: k,
            key: k,
            width: 22,
        }));

        sheet.addRows(data);

        const buf = await workbook.xlsx.writeBuffer();
        saveAs(
            new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
            `bekleme_rapor_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`
        );
    };

    /* ===================== SEÇİLEN SEFERİN DETAY DURAKLARI ===================== */
    const stopRows = useMemo(() => {
        if (!selectedRow) return [];
        const det = detailByNo.get(selectedRow.sefer_no) || [];

        const seen = new Set();
        const result = [];

        det.forEach((rec, idx) => {
            const key = `${rec.yukleme_noktasi}|${rec.yukleme_varis}|${rec.yukleme_cikis}`;
            if (seen.has(key)) return;
            seen.add(key);

            result.push({
                id: `${selectedRow.sefer_no}-d-${idx}`,
                sira: rec.nokta_sirasi,
                yukleme_noktasi: rec.yukleme_noktasi,
                yukleme_varis: rec.yukleme_varis,
                yukleme_cikis: rec.yukleme_cikis,
                yukleme_bekleme_dk: diffMinutes(rec.yukleme_varis, rec.yukleme_cikis),
                teslim_noktasi: rec.teslim_noktasi,
                teslim_varis: rec.teslim_varis,
                teslim_cikis: rec.teslim_cikis,
                teslim_bekleme_dk: diffMinutes(rec.teslim_varis, rec.teslim_cikis),
            });
        });

        return result;
    }, [selectedRow, detailByNo]);

    /* ===================== TABLO KOLONLARI ===================== */
    const columns = useMemo(
        () => [
            {
                field: "sefer_no",
                headerName: "Sefer No",
                width: 150,
                renderCell: (p) => (
                    <Button
                        size="small"
                        startIcon={<InfoOutlinedIcon />}
                        onClick={() => openDetail(p.row)}
                        sx={{ fontWeight: 600, textTransform: "none" }}
                    >
                        {p.value}
                    </Button>
                ),
            },
            { field: "plaka", headerName: "Plaka", width: 100 },

            {
                field: "yukleme_noktasi",
                headerName: "Yükleme Noktası",
                width: 250,
                renderCell: (p) => (
                    <Tooltip title={p.value}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.value}
                        </span>
                    </Tooltip>
                ),
            },

            {
                field: "yukleme_varis",
                headerName: "Varış (Yükleme)",
                width: 180,
                valueGetter: (p) => fmtDateTR(p?.row?.yukleme_varis ?? null),
            },
            {
                field: "yukleme_cikis",
                headerName: "Çıkış (Yükleme)",
                width: 180,
                valueGetter: (p) => fmtDateTR(p?.row?.yukleme_cikis ?? null),
            },

            { field: "surucu_ad_soyad", headerName: "Şoför", width: 180 },
            { field: "proje_adi", headerName: "Proje Adı", width: 150 },

            {
                field: "bekleme_dk",
                headerName: "Toplam Bekleme",
                width: 180,
                renderCell: (p) => <WaitChip minutes={p.value} />,
                sortComparator: (a, b) => (a ?? 0) - (b ?? 0),
            },
        ],
        []
    );

    /* ===================== RETURN ===================== */
    return (
        <Box sx={{ width: "100%", py: 4 }}>
            <Container maxWidth="xl">
                <Stack spacing={3}>
                    <Typography variant="h4" fontWeight={700}>
                        Yüklemede Bekleme Analizi
                    </Typography>

                    {/* ===================== FİLTRELER ===================== */}
                    <Paper sx={{ p: 3 }} variant="outlined">
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={4} lg={3}>
                                <Stack spacing={2}>
                                    <TextField
                                        label="Filtre Türü"
                                        select
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value)}
                                        size="small"
                                    >
                                        <MenuItem value="day">Günlük</MenuItem>
                                        <MenuItem value="week">Haftalık</MenuItem>
                                        <MenuItem value="month">Aylık</MenuItem>
                                        <MenuItem value="range">Tarih Aralığı</MenuItem>
                                    </TextField>

                                    {(filterType === "day" ||
                                        filterType === "week" ||
                                        filterType === "month") && (
                                            <TextField
                                                label="Tarih"
                                                type="date"
                                                value={dateFilter}
                                                onChange={(e) => setDateFilter(e.target.value)}
                                                InputLabelProps={{ shrink: true }}
                                                size="small"
                                            />
                                        )}

                                    {filterType === "range" && (
                                        <>
                                            <TextField
                                                label="Başlangıç Tarihi"
                                                type="date"
                                                value={dateStart}
                                                onChange={(e) => setDateStart(e.target.value)}
                                                InputLabelProps={{ shrink: true }}
                                                size="small"
                                            />
                                            <TextField
                                                label="Bitiş Tarihi"
                                                type="date"
                                                value={dateEnd}
                                                onChange={(e) => setDateEnd(e.target.value)}
                                                InputLabelProps={{ shrink: true }}
                                                size="small"
                                            />
                                        </>
                                    )}

                                    <TextField
                                        label="Min. Bekleme (dk)"
                                        type="number"
                                        value={minDakika}
                                        onChange={(e) => setMinDakika(e.target.value)}
                                        size="small"
                                    />

                                    <Button
                                        onClick={fetchAll}
                                        variant="contained"
                                        color="primary"
                                        startIcon={
                                            loading ? (
                                                <CircularProgress size={16} color="inherit" />
                                            ) : (
                                                <RefreshIcon />
                                            )
                                        }
                                    >
                                        Getir & Yenile
                                    </Button>
                                </Stack>
                            </Grid>

                            {/* İSTATİSTİKLER */}
                            <Grid item xs={12} md={8} lg={9}>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6} lg={3}>
                                        <StatCard
                                            title="Toplam Konum"
                                            value={stats.total}
                                            icon={<SummarizeIcon />}
                                            color="primary.main"
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} lg={3}>
                                        <StatCard
                                            title="Ortalama Bekleme"
                                            value={stats.avg}
                                            icon={<AvTimerIcon />}
                                            color="info.main"
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} lg={3}>
                                        <StatCard
                                            title="Limit Aşan Konum"
                                            value={stats.problematic}
                                            icon={<WarningIcon />}
                                            color="warning.main"
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} lg={3}>
                                        <StatCard
                                            title="Toplam Aşım Süresi"
                                            value={stats.totalExcess}
                                            icon={<AccessAlarmIcon />}
                                            color="error.main"
                                        />
                                    </Grid>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* ===================== DATA GRID ===================== */}
                    <Paper sx={{ height: "70vh", position: "relative" }} elevation={3}>
                        {loading && (
                            <LinearProgress
                                sx={{ position: "absolute", top: 0, width: "100%", zIndex: 2 }}
                            />
                        )}

                        <DataGrid
                            rows={filtered}
                            columns={columns}
                            loading={loading}
                            slots={{ toolbar: ExcelToolbar }}
                            slotProps={{
                                toolbar: {
                                    onExport: handleExport,
                                    onRefresh: fetchAll,
                                    disabled: loading || !filtered.length,
                                },
                            }}
                            initialState={{
                                pagination: { paginationModel: { pageSize: 25 } },
                            }}
                            pageSizeOptions={[10, 25, 50]}
                            sx={{
                                border: "none",
                                "& .MuiDataGrid-columnHeaders": {
                                    bgcolor: "grey.100",
                                },
                            }}
                        />
                    </Paper>

                    {fetchError && (
                        <Alert severity="error">Veri Hatası: {fetchError}</Alert>
                    )}
                </Stack>
            </Container>

            <TripDetailModal
                open={isDetailModalOpen}
                onClose={closeDetail}
                trip={selectedRow}
                stopRows={stopRows}
                fmt={{ minutes: fmtMinutes, dateTR: fmtDateTR }}
            />
        </Box>
    );
}
