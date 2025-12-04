// ===========================
// TeslimdeBekleme.jsx — FINAL
// ===========================

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
    MenuItem,
} from "@mui/material";

// DataGrid
import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarQuickFilter,
} from "@mui/x-data-grid";

// Icons
import {
    Refresh as RefreshIcon,
    InfoOutlined as InfoOutlinedIcon,
    Download as DownloadIcon,
} from "@mui/icons-material";

// Modal
import TripDetailModal from "./TripDetailModal";

// ===========================
dayjs.extend(duration);
dayjs.locale("tr");

const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";

const SUMMARY_COLS = [
    "id",
    "sefer_no",
    "plaka",
    "treyler",
    "surucu_ad_soyad",
    "surucu_tckn",
    "surucu_telefon",
    "sefer_tarihi",
    "yukleme_ili",
    "yukleme_ilcesi",
    "teslim_ili",
    "teslim_ilcesi",
    "musteri_adi",
    "yukleme_noktasi",
    "teslim_noktasi",
    "proje_adi",
].join(",");

const DETAIL_COLS = [
    "sefer_no",
    "nokta_sirasi",
    "yukleme_noktasi",
    "teslim_noktasi",
    "yukleme_varis",
    "yukleme_cikis",
    "teslim_varis",
    "teslim_cikis",
].join(",");

// ===========================
// Helper functions
// ===========================

const checkWeekend = (start, end) => {
    const s = parseDT(start);
    const e = parseDT(end);
    if (!s || !e) return "—";

    let cur = s.clone();
    let hasSaturday = false;
    let hasSunday = false;

    while (cur.isBefore(e) || cur.isSame(e, "day")) {
        const day = cur.day(); // 0 = Pazar, 6 = Cumartesi
        if (day === 6) hasSaturday = true;
        if (day === 0) hasSunday = true;
        cur = cur.add(1, "day");
    }

    if (hasSaturday && hasSunday) return "Cumartesi & Pazar Var";
    if (hasSaturday) return "Cumartesi Var";
    if (hasSunday) return "Pazar Var";

    return "—";
};

const parseDT = (v) => {
    if (!v) return null;
    const d = dayjs(v);
    return d.isValid() ? d : null;
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

const diffMinutes = (start, end) => {
    const s = parseDT(start);
    const e = parseDT(end);
    if (!s || !e) return null;
    return e.diff(s, "minute");
};

const deliveryDeadline = (teslim_varis) => {
    const v = parseDT(teslim_varis);
    if (!v) return null;

    const noon = v.hour(12).minute(0).second(0);
    if (v.isBefore(noon)) {
        return v.hour(17).minute(0).second(0);
    }
    return v.add(1, "day").hour(12).minute(0).second(0);
};

const getStatusProps = (lateMin) => {
    if (lateMin === null || lateMin <= 0) return { label: "Zamanında", color: "success" };
    if (lateMin <= 60) return { label: "1 Saat Altı", color: "info" };
    if (lateMin <= 4 * 60) return { label: "Hafif Gecikme", color: "warning" };
    return { label: "Önemli Gecikme", color: "error" };
};

// Toolbar
const ExcelToolbar = ({ onExport, onRefresh, disabled }) => (
    <GridToolbarContainer sx={{ p: 1, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <GridToolbarQuickFilter
            debounceMs={300}
            placeholder="Tabloda Ara..."
            sx={{ flexGrow: 1 }}
        />

        <Stack direction="row" spacing={1}>
            <Button
                size="small"
                startIcon={<DownloadIcon />}
                variant="contained"
                onClick={onExport}
                disabled={disabled}
            >
                Excel İndir
            </Button>

            <IconButton onClick={onRefresh} disabled={disabled} color="primary">
                <RefreshIcon />
            </IconButton>
        </Stack>
    </GridToolbarContainer>
);

// ===========================
// Main Component
// ===========================
export default function TeslimdeBekleme() {
    const [rows, setRows] = useState([]);
    const [detailByNo, setDetailByNo] = useState(new Map());
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const [filterMode, setFilterMode] = useState("gun");
    const [baseDate, setBaseDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [rangeStart, setRangeStart] = useState(dayjs().format("YYYY-MM-DD"));
    const [rangeEnd, setRangeEnd] = useState(dayjs().format("YYYY-MM-DD"));

    const [minLateMin, setMinLateMin] = useState("");
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

    // ===========================
    // Fetch Function — teslim_varis'e göre filtreleme
    // ===========================
    const fetchAll = useCallback(async () => {
        setLoading(true);
        setFetchError(null);

        let startDate, endDate;

        if (filterMode === "gun") {
            startDate = dayjs(baseDate).startOf("day").toISOString();
            endDate = dayjs(baseDate).endOf("day").toISOString();
        }
        if (filterMode === "hafta") {
            startDate = dayjs(baseDate).startOf("week").toISOString();
            endDate = dayjs(baseDate).endOf("week").toISOString();
        }
        if (filterMode === "ay") {
            startDate = dayjs(baseDate).startOf("month").toISOString();
            endDate = dayjs(baseDate).endOf("month").toISOString();
        }
        if (filterMode === "aralik") {
            startDate = dayjs(rangeStart).startOf("day").toISOString();
            endDate = dayjs(rangeEnd).endOf("day").toISOString();
        }

        // 1) DETAY TABLOSUNDAN teslim_varis'e göre filtrele
        const { data: detailData, error: detailError } = await supabase
            .from(DETAIL_TABLE)
            .select(DETAIL_COLS)
            .gte("teslim_varis", startDate)
            .lte("teslim_varis", endDate);

        if (detailError) {
            setFetchError("Detay sorgu hatası: " + detailError.message);
            setLoading(false);
            return;
        }

        const details = detailData || [];

        if (details.length === 0) {
            setRows([]);
            setDetailByNo(new Map());
            setLoading(false);
            return;
        }

        const seferNos = [...new Set(details.map((x) => x.sefer_no))];

        // 2) SUMMARY tablosundan bu sefer_no'ları çek
        const { data: summaryData, error: summaryError } = await supabase
            .from(SUMMARY_TABLE)
            .select(SUMMARY_COLS)
            .in("sefer_no", seferNos);

        if (summaryError) {
            setFetchError("Summary sorgu hatası: " + summaryError.message);
            setLoading(false);
            return;
        }

        const summary = summaryData || [];

        // eşleştirme
        const byNo = new Map();
        seferNos.forEach((no) => {
            byNo.set(no, details.filter((d) => d.sefer_no === no));
        });

        const computed = summary.map((r, i) => {
            const detList = byNo.get(r.sefer_no) || [];
            const d = detList.find((x) => x.teslim_varis && x.teslim_cikis);

            const teslim_varis = d?.teslim_varis ?? null;
            const teslim_cikis = d?.teslim_cikis ?? null;
            const deadline = teslim_varis ? deliveryDeadline(teslim_varis) : null;

            let gecikme_dk = null;
            if (deadline && teslim_cikis) {
                const diff = diffMinutes(deadline, teslim_cikis);
                gecikme_dk = diff !== null ? Math.max(0, diff) : null;
            }

            return {
                id: `${r.id}-${i}`,
                ...r,
                teslim_varis,
                teslim_cikis,
                deadline: deadline ? deadline.toISOString() : null,
                gecikme_dk,
            };
        });

        const cleaned = computed.filter(
            (x) => x.teslim_varis !== null && x.teslim_cikis !== null
        );

        setDetailByNo(byNo);
        setRows(cleaned);
        setLoading(false);
    }, [filterMode, baseDate, rangeStart, rangeEnd]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // ===========================
    // Filtrelenmiş tablo
    // ===========================
    const filtered = useMemo(() => {
        const minLate = Number(minLateMin) || 0;
        return rows
            .filter((r) => (r.gecikme_dk ?? 0) >= minLate)
            .sort((a, b) => (b.gecikme_dk ?? 0) - (a.gecikme_dk ?? 0));
    }, [rows, minLateMin]);

    // ===========================
    // Excel Export
    // ===========================
    const handleExport = async () => {
        if (!filtered.length) return;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Teslimde Bekleme");

        // ================================
        // EXCEL VERİ MAP
        // ================================
        const dataToExport = filtered.map((r) => ({
            "Sefer No": r.sefer_no,
            "Plaka": r.plaka,
            "Treyler": r.treyler,
            "Şoför": r.surucu_ad_soyad,
            "Proje Adı": r.proje_adi,
            "Yükleme Noktası": r.yukleme_noktasi,
            "Yükleme İli": r.yukleme_ili,
            "Teslim Noktası": r.teslim_noktasi,
            "Teslim İli": r.teslim_ili,
            "Varış Zamanı": r.teslim_varis
                ? dayjs(r.teslim_varis).format("DD.MM.YYYY HH:mm")
                : "—",
            "Çıkış Zamanı": r.teslim_cikis
                ? dayjs(r.teslim_cikis).format("DD.MM.YYYY HH:mm")
                : "—",
            "Bekleme Süresi":
                r.teslim_varis && r.teslim_cikis
                    ? minToHM(diffMinutes(r.teslim_varis, r.teslim_cikis))
                    : "—",
            "Hafta Sonu": checkWeekend(r.teslim_varis, r.teslim_cikis),

        }));

        // ================================
        // SÜTUN BAŞLIKLARI
        // ================================
        worksheet.columns = [
            { header: "Sefer No", key: "Sefer No", width: 14 },
            { header: "Plaka", key: "Plaka", width: 14 },
            { header: "Treyler", key: "Treyler", width: 18 },
            { header: "Şoför", key: "Şoför", width: 22 },
            { header: "Proje Adı", key: "Proje Adı", width: 22 },
            { header: "Yükleme Noktası", key: "Yükleme Noktası", width: 28 },
            { header: "Yükleme İli", key: "Yükleme İli", width: 18 },
            { header: "Teslim Noktası", key: "Teslim Noktası", width: 28 },
            { header: "Teslim İli", key: "Teslim İli", width: 18 },
            { header: "Varış Zamanı", key: "Varış Zamanı", width: 20 },
            { header: "Çıkış Zamanı", key: "Çıkış Zamanı", width: 20 },
            { header: "Bekleme Süresi", key: "Bekleme Süresi", width: 16 },
            { header: "Hafta Sonu", key: "Hafta Sonu", width: 20 },

        ];

        // ================================
        // VERİYİ EXCEL’E EKLE
        // ================================
        worksheet.addRows(dataToExport);

        // ================================
        // DOSYA KAYDET
        // ================================
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const filename = `teslimde_bekleme_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`;
        saveAs(blob, filename);
    };

    // ===========================
    // StopRows (modal için)
    // ===========================
    const stopRows = useMemo(() => {
        if (!selectedRow) return [];
        const det = detailByNo.get(selectedRow.sefer_no) || [];

        return det.map((rec, idx) => ({
            id: `${selectedRow.sefer_no}-${idx}`,
            ...rec,
            teslim_bekleme_dk: diffMinutes(rec.teslim_varis, rec.teslim_cikis),
        }));
    }, [selectedRow, detailByNo]);

    // ===========================
    // DataGrid Columns
    // ===========================
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
                    >
                        {p.value}
                    </Button>
                ),
            },
            { field: "plaka", headerName: "Plaka", width: 120 },
            { field: "proje_adi", headerName: "Proje", width: 160 },
            {
                field: "teslim_varis",
                headerName: "Teslim Varış",
                width: 180,
                renderCell: (p) => fmtDateTR(p.row.teslim_varis),
            },
            {
                field: "teslim_cikis",
                headerName: "Teslim Çıkış",
                width: 180,
                renderCell: (p) => fmtDateTR(p.row.teslim_cikis),
            },
            {
                field: "deadline",
                headerName: "Deadline",
                width: 180,
                renderCell: (p) => fmtDateTR(p.row.deadline),
            },
            {
                field: "gecikme_dk",
                headerName: "Gecikme",
                width: 160,
                renderCell: (p) => {
                    const v = p.value ?? 0;
                    const { color } = getStatusProps(v);
                    return (
                        <Chip
                            label={v > 0 ? minToHM(v) : "Zamanında"}
                            color={color}
                            size="small"
                        />
                    );
                },
            },
        ],
        []
    );

    // ===========================
    // UI
    // ===========================
    return (
        <Box sx={{ bgcolor: "#121212", minHeight: "100vh", py: 3 }}>
            <Container maxWidth="xl">
                <Paper sx={{ bgcolor: "#1e1e1e", p: 3, borderRadius: 3 }}>
                    {/* Header */}
                    <Stack spacing={1} mb={3}>
                        <Typography variant="h5" color="white" fontWeight={700}>
                            Teslimat Gecikme Raporu
                        </Typography>
                        <Typography variant="body2" color="gray">
                            Teslim varışı seçilen tarih aralığında olan seferler görüntülenir.
                        </Typography>
                    </Stack>

                    {/* Filters */}
                    <Stack direction="row" spacing={2} mb={3}>
                        {/* Filtre Türü */}
                        <TextField
                            select
                            label="Filtre"
                            value={filterMode}
                            onChange={(e) => setFilterMode(e.target.value)}
                            size="small"
                            sx={{ minWidth: 150 }}
                            InputLabelProps={{ sx: { color: "white" } }}
                            InputProps={{ sx: { color: "white" } }}
                        >
                            <MenuItem value="gun">Günlük</MenuItem>
                            <MenuItem value="hafta">Haftalık</MenuItem>
                            <MenuItem value="ay">Aylık</MenuItem>
                            <MenuItem value="aralik">Tarih Aralığı</MenuItem>
                        </TextField>

                        {/* Gün / Hafta / Ay */}
                        {filterMode !== "aralik" && (
                            <TextField
                                label="Tarih"
                                type="date"
                                value={baseDate}
                                onChange={(e) => setBaseDate(e.target.value)}
                                size="small"
                                InputLabelProps={{ sx: { color: "white" } }}
                                InputProps={{ sx: { color: "white" } }}
                            />
                        )}

                        {/* Aralık */}
                        {filterMode === "aralik" && (
                            <>
                                <TextField
                                    label="Başlangıç"
                                    type="date"
                                    value={rangeStart}
                                    onChange={(e) => setRangeStart(e.target.value)}
                                    size="small"
                                    InputLabelProps={{ sx: { color: "white" } }}
                                    InputProps={{ sx: { color: "white" } }}
                                />
                                <TextField
                                    label="Bitiş"
                                    type="date"
                                    value={rangeEnd}
                                    onChange={(e) => setRangeEnd(e.target.value)}
                                    size="small"
                                    InputLabelProps={{ sx: { color: "white" } }}
                                    InputProps={{ sx: { color: "white" } }}
                                />
                            </>
                        )}

                        {/* Minimum Gecikme */}
                        <TextField
                            label="Min. Gecikme (dk)"
                            type="number"
                            size="small"
                            value={minLateMin}
                            onChange={(e) => setMinLateMin(e.target.value)}
                            InputLabelProps={{ sx: { color: "white" } }}
                            InputProps={{ sx: { color: "white" } }}
                        />

                        {/* Yenile */}
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={fetchAll}
                            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                        >
                            Yenile
                        </Button>
                    </Stack>

                    {/* Table */}
                    <Box sx={{ height: "70vh" }}>
                        {loading && <LinearProgress />}
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
                            sx={{
                                color: "white",
                                borderColor: "rgba(255,255,255,0.1)",
                                "& .MuiDataGrid-columnHeaders": {
                                    backgroundColor: "#2c2c2c",
                                },
                                "& .MuiDataGrid-row": {
                                    backgroundColor: "#1e1e1e",
                                },
                            }}
                        />
                    </Box>

                    {/* Error */}
                    {fetchError && (
                        <Alert sx={{ mt: 2 }} severity="error">
                            {fetchError}
                        </Alert>
                    )}
                </Paper>
            </Container>

            {/* Modal */}
            <TripDetailModal
                open={isDetailModalOpen}
                onClose={closeDetail}
                trip={selectedRow}
                stopRows={stopRows}
                fmt={{ minutes: minToHM, dateTR: fmtDateTR }}
            />
        </Box>
    );
}
