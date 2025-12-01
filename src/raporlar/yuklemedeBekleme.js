import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// Dayjs
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
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

// Modal Component (default export)
import TripDetailModal from "./TripDetailModal";

// ===================== Dayjs Setup =====================
dayjs.extend(duration);
dayjs.locale("tr");

/* ===================== Sabitler / Şemalar ===================== */
const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";
const TARGET_WAIT_MINUTES = 240;
const TODAY_DATE_ISO = dayjs().format("YYYY-MM-DD");

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

// WaitChip
const WaitChip = ({ minutes }) => {
    if (minutes === null) return <Chip label="—" size="small" variant="outlined" />;
    let color = "success";
    let label = fmtMinutes(minutes);
    if (minutes >= TARGET_WAIT_MINUTES) { color = "error"; }
    else if (minutes >= TARGET_WAIT_MINUTES * 0.75) { color = "warning"; }
    else if (minutes >= TARGET_WAIT_MINUTES * 0.5) { color = "info"; }
    const isHigh = minutes >= TARGET_WAIT_MINUTES * 0.75;
    return (
        <Tooltip title={`${minutes} dakika bekleme`}>
            <Chip
                color={color}
                label={label}
                variant={isHigh ? "filled" : "outlined"}
                size="small"
                sx={{ fontWeight: isHigh ? 700 : 500 }}
            />
        </Tooltip>
    );
};

// ExcelToolbar
const ExcelToolbar = ({ onExport, onRefresh, disabled }) => (
    <GridToolbarContainer sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <GridToolbarQuickFilter
            quickFilterParser={(v) => v.split(/\s+/).filter(Boolean)}
            debounceMs={300}
            placeholder="Tabloda Ara..."
            sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 'auto' } }}
        />
        <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }} />
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

// StatCard
const StatCard = ({ title, value, icon, color = "primary.main" }) => (
    <Paper
        elevation={0}
        variant="outlined"
        sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 2 }}
    >
        <Box sx={(theme) => {
            const [paletteKey, shade] = color.split('.');
            const resolvedColor =
                theme.palette[paletteKey] && theme.palette[paletteKey][shade]
                    ? theme.palette[paletteKey][shade]
                    : color;
            return {
                p: 1.5,
                bgcolor: alpha(resolvedColor, 0.1),
                color: color,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center'
            };
        }}>
            {icon}
        </Box>
        <Box>
            <Typography variant="h6" fontWeight={700} noWrap>{value}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{title}</Typography>
        </Box>
    </Paper>
);


/* ===================== Ana Bileşen ===================== */
export default function YuklemedeBekleme() {
    const [rows, setRows] = useState([]);
    const [detailByNo, setDetailByNo] = useState(new Map());
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [minDakika, setMinDakika] = useState(TARGET_WAIT_MINUTES);
    const [dateFilter, setDateFilter] = useState(TODAY_DATE_ISO);
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

    // fetchAll (Lokasyon bazlı gruplama + aynı nokta/varış/çıkış tekilleştirme)
    const fetchAll = useCallback(async () => {
        setLoading(true);
        setFetchError(null);

        const startDate = dayjs(dateFilter).startOf("day").toISOString();
        const endDate = dayjs(dateFilter).add(1, "day").startOf("day").toISOString();

        const { data: summaryData, error: summaryError } = await supabase
            .from(SUMMARY_TABLE)
            .select(SUMMARY_COLS)
            .gte("sefer_tarihi", startDate)
            .lt("sefer_tarihi", endDate);

        if (summaryError) {
            setFetchError(`Veritabanı Hatası: ${summaryError.message}`);
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

        const seferNos = summaryResult.map((r) => r.sefer_no).filter(Boolean);
        const { data: detailData, error: detailError } = await supabase
            .from(DETAIL_TABLE)
            .select(DETAIL_COLS)
            .in("sefer_no", seferNos);

        if (detailError) {
            console.error("Detay tablosu alınamadı:", detailError.message);
            setFetchError(`Detay verisi alınamadı: ${detailError.message}`);
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

            // 1) Önce geçerli yükleme kayıtlarını al
            const validLoadsRaw = detailsForSefer.filter(
                (d) => d.yukleme_varis && d.yukleme_cikis && d.yukleme_noktasi
            );

            if (validLoadsRaw.length === 0) continue;

            // 2) Aynı nokta + aynı varış + aynı çıkış kombinasyonlarını tekilleştir
            const seenKeys = new Set();
            const validLoads = validLoadsRaw.filter((d) => {
                const key = [
                    d.yukleme_noktasi ?? "",
                    d.yukleme_varis ?? "",
                    d.yukleme_cikis ?? "",
                ].join("|");
                if (seenKeys.has(key)) return false;
                seenKeys.add(key);
                return true;
            });

            // 3) Lokasyona göre grupla
            const groupedByLocation = validLoads.reduce((acc, stop) => {
                const location = stop.yukleme_noktasi;
                if (!acc[location]) acc[location] = [];
                acc[location].push(stop);
                return acc;
            }, {});

            // 4) Her lokasyon için toplam beklemeyi hesapla
            for (const locationName in groupedByLocation) {
                const stopsForLocation = groupedByLocation[locationName];

                const totalWaitAtLocation_dk = stopsForLocation.reduce((sum, stop) => {
                    const wait = diffMinutes(stop.yukleme_varis, stop.yukleme_cikis);
                    return sum + (wait || 0);
                }, 0);

                if (totalWaitAtLocation_dk === 0) continue;

                const firstStopAtLocation = stopsForLocation[0];

                finalGridRows.push({
                    ...summaryRow,
                    id: `${sefer_no}-${locationName}`,
                    yukleme_noktasi: locationName,
                    yukleme_varis: firstStopAtLocation.yukleme_varis,
                    yukleme_cikis: firstStopAtLocation.yukleme_cikis,
                    bekleme_dk: totalWaitAtLocation_dk,
                });
            }
        }

        setDetailByNo(byNo);
        setRows(finalGridRows);
        setLoading(false);
    }, [dateFilter]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const filtered = useMemo(() => {
        const minTime = Number(minDakika) || 0;
        return rows
            .filter((r) => (r.bekleme_dk ?? -1) >= minTime)
            .sort((a, b) => (b.bekleme_dk ?? 0) - (a.bekleme_dk ?? 0));
    }, [rows, minDakika]);

    const stats = useMemo(() => {
        if (!filtered.length) {
            return { total: 0, avg: 0, problematic: 0, totalExcess: 0 };
        }
        const total = filtered.length;
        const sum = filtered.reduce((acc, r) => acc + (r.bekleme_dk ?? 0), 0);
        const avg = total > 0 ? Math.round(sum / total) : 0;
        const problematic = filtered.filter(
            (r) => (r.bekleme_dk ?? 0) >= TARGET_WAIT_MINUTES
        ).length;
        const totalExcess = filtered.reduce((acc, r) => {
            const excess = (r.bekleme_dk ?? 0) - TARGET_WAIT_MINUTES;
            return excess > 0 ? acc + excess : acc;
        }, 0);
        return {
            total,
            avg: minToHM(avg),
            problematic,
            totalExcess: minToHM(totalExcess),
        };
    }, [filtered]);

    // EXCEL EXPORT
    const handleExport = async () => {
        if (!filtered.length) return;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Bekleme Analiz Raporu");

        const dataToExport = filtered.map((r) => ({
            "Sefer No": r.sefer_no,
            Plaka: r.plaka,
            Treyler: r.treyler,
            "Şoför": r.surucu_ad_soyad,
            "Proje Adı": r.proje_adi,
            "Yükleme Noktası": r.yukleme_noktasi,
            "Yükleme İl": r.yukleme_ili,
            "Yükleme İlçe": r.yukleme_ilcesi,
            "Yükleme Varış": fmtDateTR(r.yukleme_varis),
            "Yükleme Çıkış": fmtDateTR(r.yukleme_cikis),
            "Teslim Noktası": r.teslim_noktasi,
            "Teslim İl": r.teslim_ili,
            "Teslim İlçe": r.teslim_ilcesi,
            "Lokasyon Bekleme (dk)": r.bekleme_dk,
            "Lokasyon Bekleme Süresi": minToHM(r.bekleme_dk),
        }));

        worksheet.columns = [
            { header: "Sefer No", key: "Sefer No", width: 14 },
            { header: "Plaka", key: "Plaka", width: 10 },
            { header: "Treyler", key: "Treyler", width: 10 },
            { header: "Şoför", key: "Şoför", width: 20 },
            { header: "Proje Adı", key: "Proje Adı", width: 20 },
            { header: "Yükleme Noktası", key: "Yükleme Noktası", width: 30 },
            { header: "Yükleme İl", key: "Yükleme İl", width: 30 },
            { header: "Yükleme İlçe", key: "Yükleme İlçe", width: 30 },

            // ⭐ ZORUNLU EKLENECEK ALANLAR ⭐
            { header: "Yükleme Varış", key: "Yükleme Varış", width: 22 },
            { header: "Yükleme Çıkış", key: "Yükleme Çıkış", width: 22 },

            { header: "Teslim Noktası", key: "Teslim Noktası", width: 30 },
            { header: "Teslim İl", key: "Teslim İl", width: 18 },
            { header: "Teslim İlçe", key: "Teslim İlçe", width: 18 },
            { header: "Lokasyon Bekleme (dk)", key: "Lokasyon Bekleme (dk)", width: 18 },
            { header: "Lokasyon Bekleme Süresi", key: "Lokasyon Bekleme Süresi", width: 18 },
        ];

        worksheet.addRows(dataToExport);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const filename = `yuklemede_bekleme_gruplu_${dayjs(dateFilter).format("YYYYMMDD")}.xlsx`;
        saveAs(blob, filename);
    };

    // stopRows (aynı nokta+varış+çıkış burada da tekilleştiriliyor)
    const stopRows = useMemo(() => {
        if (!selectedRow) return [];
        const det = detailByNo.get(selectedRow.sefer_no) || [];

        const seen = new Set();
        const result = [];

        det.forEach((rec, idx) => {
            const key = [
                rec.yukleme_noktasi ?? "",
                rec.yukleme_varis ?? "",
                rec.yukleme_cikis ?? "",
            ].join("|");
            if (seen.has(key)) return;
            seen.add(key);

            result.push({
                id: `${selectedRow.sefer_no}-durak-${idx}`,
                sira: rec.nokta_sirasi,
                yukleme_noktasi: rec.yukleme_noktasi,
                yukleme_ili: selectedRow.yukleme_ili,
                yukleme_ilcesi: selectedRow.yukleme_ilcesi,
                yukleme_varis: rec.yukleme_varis,
                yukleme_cikis: rec.yukleme_cikis,
                yukleme_bekleme_dk: diffMinutes(rec.yukleme_varis, rec.yukleme_cikis),
                yukleme_varis_guncelleyen: rec.yukleme_varis_guncelleyen,
                yukleme_varis_guncelleme_tarihi: rec.yukleme_varis_guncelleme_tarihi,
                yukleme_cikis_guncelleyen: rec.yukleme_cikis_guncelleyen,
                yukleme_cikis_guncelleme_tarihi: rec.yukleme_cikis_guncelleme_tarihi,
                teslim_noktasi: rec.teslim_noktasi,
                teslim_ili: selectedRow.teslim_ili,
                teslim_ilcesi: selectedRow.teslim_ilcesi,
                teslim_varis: rec.teslim_varis,
                teslim_cikis: rec.teslim_cikis,
                teslim_bekleme_dk: diffMinutes(rec.teslim_varis, rec.teslim_cikis),
                teslim_varis_guncelleyen: rec.teslim_varis_guncelleyen,
                teslim_varis_guncelleme_tarihi: rec.teslim_varis_guncelleme_tarihi,
                teslim_cikis_guncelleyen: rec.teslim_cikis_guncelleyen,
                teslim_cikis_guncelleme_tarihi: rec.teslim_cikis_guncelleme_tarihi,
            });
        });

        return result;
    }, [selectedRow, detailByNo]);

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
                        sx={{
                            fontWeight: 600,
                            textTransform: "none",
                            px: 1,
                            py: 0.5,
                        }}
                    >
                        {p.value || "—"}
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
                        <span
                            style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {p.value}
                        </span>
                    </Tooltip>
                ),
            },

            // 🔥 YENİ KOLONLAR — NULL SAFE
            {
                field: "yukleme_varis",
                headerName: "Varış (Yükleme)",
                width: 180,
                valueGetter: (p) => fmtDateTR(p.row?.yukleme_varis),
            },
            {
                field: "yukleme_cikis",
                headerName: "Çıkış (Yükleme)",
                width: 180,
                valueGetter: (p) => fmtDateTR(p.row?.yukleme_cikis),
            },

            { field: "surucu_ad_soyad", headerName: "Şoför", width: 180 },
            { field: "proje_adi", headerName: "Proje Adı", width: 150 },

            {
                field: "bekleme_dk",
                headerName: "Konumdaki Toplam Bekleme",
                width: 220,
                renderCell: (p) => <WaitChip minutes={p.value} />,
                sortComparator: (a, b) => (a ?? 0) - (b ?? 0),
            },
        ],
        []
    );

    // Return
    return (
        <Box
            sx={{
                width: "100%",
                py: { xs: 2, md: 4 },
                bgcolor: (t) =>
                    t.palette.mode === "dark" ? "#121212" : "grey.50",
            }}
        >
            <Container
                maxWidth={false}
                sx={{ maxWidth: "1680px", px: { xs: 2, md: 4 } }}
            >
                <Stack spacing={3}>
                    <Stack>
                        <Typography variant="h4" fontWeight={700}>
                            Yüklemede Bekleme Analizi ⏳
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            **{dayjs(dateFilter).format("DD MMMM YYYY")}**
                            tarihli seferlerdeki **yükleme konumlarına** göre
                            toplam beklemeler.
                        </Typography>
                    </Stack>

                    <Paper
                        variant="outlined"
                        sx={{
                            p: { xs: 2, md: 3 },
                            borderRadius: 3,
                            borderColor: "divider",
                        }}
                    >
                        <Grid container spacing={3} alignItems="flex-end">
                            <Grid item xs={12} md={4} lg={3}>
                                <Stack spacing={2}>
                                    <TextField
                                        label="Tarih Seçin"
                                        type="date"
                                        InputLabelProps={{ shrink: true }}
                                        value={dateFilter}
                                        onChange={(e) =>
                                            setDateFilter(e.target.value)
                                        }
                                        size="small"
                                        fullWidth
                                    />
                                    <TextField
                                        label="Min. Bekleme (dk)"
                                        type="number"
                                        value={minDakika}
                                        onChange={(e) =>
                                            setMinDakika(e.target.value)
                                        }
                                        size="small"
                                        fullWidth
                                    />
                                    <Button
                                        onClick={fetchAll}
                                        variant="contained"
                                        color="primary"
                                        disabled={loading}
                                        startIcon={
                                            loading ? (
                                                <CircularProgress
                                                    size={16}
                                                    color="inherit"
                                                />
                                            ) : (
                                                <RefreshIcon />
                                            )
                                        }
                                    >
                                        Filtrele & Yenile
                                    </Button>
                                </Stack>
                            </Grid>

                            <Grid item xs={12} md={8} lg={9}>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6} lg={3}>
                                        <StatCard
                                            title="Toplam Bekleme Konumu"
                                            value={stats.total.toLocaleString()}
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
                                            value={stats.problematic.toLocaleString()}
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

                    <Paper
                        elevation={3}
                        sx={{
                            borderRadius: 3,
                            overflow: "hidden",
                            height: "70vh",
                            position: "relative",
                        }}
                    >
                        {loading && (
                            <LinearProgress
                                sx={{
                                    position: "absolute",
                                    top: 0,
                                    width: "100%",
                                    zIndex: 1,
                                }}
                                color="primary"
                            />
                        )}
                        <DataGrid
                            rows={filtered}
                            columns={columns}
                            loading={loading}
                            density="comfortable"
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
                                    fontWeight: 700,
                                },
                            }}
                        />
                    </Paper>

                    {fetchError && (
                        <Alert severity="error" sx={{ m: 0 }}>
                            **Veri Yükleme Hatası:** {fetchError}
                        </Alert>
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
