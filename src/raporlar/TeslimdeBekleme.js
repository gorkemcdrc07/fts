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
    CircularProgress, // Yeni: Yüklenme göstergesi
    LinearProgress, // Yeni: Yüklenme çubuğu
} from "@mui/material";

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
    AccessTimeFilled as AccessTimeFilledIcon, // Yeni: Gecikme ikonu
} from "@mui/icons-material";

// Modal Component
import { TripDetailModal } from "./TripDetailModal";

// ===================== Dayjs Setup =====================
dayjs.extend(duration);
dayjs.locale("tr");

/* ===================== Sabitler (Değişmedi) ===================== */
const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";
const TODAY_DATE_ISO = dayjs().format("YYYY-MM-DD");

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
    "yukleme_varis_guncelleyen",
    "yukleme_varis_guncelleme_tarihi",
    "yukleme_cikis_guncelleyen",
    "yukleme_cikis_guncelleme_tarihi",
    "teslim_varis_guncelleyen",
    "teslim_varis_guncelleme_tarihi",
    "teslim_cikis_guncelleyen",
    "teslim_cikis_guncelleme_tarihi",
].join(",");

/* ===================== Yardımcılar (Kısmen Güncellendi) ===================== */
const safeVF = (fn) => (p) => (fn ? fn(p.value) : p.value);

const parseDT = (v) => {
    if (!v && v !== 0) return null;
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
    const m = e.diff(s, "minute");
    return Number.isFinite(m) ? m : null;
};

/** Teslim deadline kuralı: */
const deliveryDeadline = (teslim_varis) => {
    const v = parseDT(teslim_varis);
    if (!v) return null;
    const noon = v.hour(12).minute(0).second(0).millisecond(0);
    if (v.isBefore(noon)) {
        return v.hour(17).minute(0).second(0).millisecond(0); // aynı gün 17:00
    }
    return v.add(1, "day").hour(12).minute(0).second(0).millisecond(0); // ertesi gün 12:00
};

// Renk kodlaması daha modern bir yaklaşımla güncellendi
const getStatusProps = (lateMin) => {
    if (lateMin === null || lateMin <= 0) {
        return { label: "Zamanında", color: "success" };
    }
    if (lateMin <= 60) {
        return { label: "1 Saat Altı", color: "info" };
    }
    if (lateMin <= 4 * 60) {
        return { label: "Hafif Gecikme", color: "warning" };
    }
    return { label: "Önemli Gecikme", color: "error" };
};


/* ==== Toolbar (Küçük Kozmetik Dokunuş) ==== */
const ExcelToolbar = ({ onExport, onRefresh, disabled }) => (
    <GridToolbarContainer sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <GridToolbarQuickFilter
            quickFilterParser={(v) => v.split(/\s+/).filter(Boolean)}
            debounceMs={300}
            placeholder="Tabloda Ara..."
            sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 'auto' } }}
        />
        <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }} /> {/* Küçük ekranlarda yer açmak */}
        <Stack direction="row" spacing={1}>
            <Tooltip title="Excel Raporu İndir">
                <span>
                    <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        variant="contained" // Daha belirgin
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

/* ===================== Ana Bileşen ===================== */
export default function TeslimdeBekleme() {
    const [rows, setRows] = useState([]);
    const [detailByNo, setDetailByNo] = useState(new Map());
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [dateFilter, setDateFilter] = useState(TODAY_DATE_ISO);
    const [minLateMin, setMinLateMin] = useState(""); // boş string ile tümünü gösterme

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


    const fetchAll = useCallback(async () => {
        setLoading(true);
        setFetchError(null);

        const startDate = dayjs(dateFilter).startOf("day").toISOString();
        const endDate = dayjs(dateFilter).add(1, "day").startOf("day").toISOString();

        // Veri çekme ve hesaplama mantığı aynı kalır.
        // ... (Kodun bu kısmı orijinal haliyle korunmuştur) ...
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

        const summary = summaryData || [];
        if (summary.length === 0) {
            setRows([]);
            setDetailByNo(new Map());
            setLoading(false);
            return;
        }

        const seferNos = summary.map((r) => r.sefer_no).filter(Boolean);

        const { data: detailData, error: detailError } = await supabase
            .from(DETAIL_TABLE)
            .select(DETAIL_COLS)
            .in("sefer_no", seferNos);

        if (detailError) {
            setFetchError(`Detay verisi alınamadı: ${detailError.message}`);
        }

        const details = detailData || [];
        const byNo = new Map();

        summary.forEach((s) => {
            const detList = details
                .filter((d) => d.sefer_no === s.sefer_no)
                .sort((a, b) => (a.nokta_sirasi ?? 999) - (b.nokta_sirasi ?? 999));
            byNo.set(s.sefer_no, detList);
        });

        const computed = summary.map((r, i) => {
            const detList = byNo.get(r.sefer_no) || [];
            const firstValid = detList.find((d) => d.teslim_varis && d.teslim_cikis) || null;

            const teslim_varis = firstValid?.teslim_varis ?? null;
            const teslim_cikis = firstValid?.teslim_cikis ?? null;
            const deadline = teslim_varis ? deliveryDeadline(teslim_varis) : null;

            let gecikme_dk = null;
            if (deadline && teslim_cikis) {
                const diff = diffMinutes(deadline, teslim_cikis);
                gecikme_dk = diff !== null ? Math.max(0, diff) : null;
            }

            return {
                id: `${SUMMARY_TABLE}-${r.id ?? i}`,
                ...r,
                teslim_varis,
                teslim_cikis,
                deadline: deadline ? deadline.toISOString() : null,
                gecikme_dk,
            };
        });

        const cleaned = computed.filter((x) => x.deadline !== null && x.teslim_cikis !== null);

        setDetailByNo(byNo);
        setRows(cleaned);
        setLoading(false);
    }, [dateFilter]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const filtered = useMemo(() => {
        const minLate = Number(minLateMin) || 0;
        return rows
            .filter((r) => (r.gecikme_dk ?? 0) >= minLate)
            .sort((a, b) => (b.gecikme_dk ?? 0) - (a.gecikme_dk ?? 0));
    }, [rows, minLateMin]);

    /* ===== Excel Export (Değişmedi) ===== */
    const handleExport = async () => {
        if (!filtered.length) return;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Teslimde Bekleme Raporu");

        const dataToExport = filtered.map((r) => ({
            "Sefer No": r.sefer_no,
            Plaka: r.plaka,
            "Proje Adı": r.proje_adi,
            "Teslim Noktası": r.teslim_noktasi,
            "Teslim İli": r.teslim_ili,
            "Teslim İlçesi": r.teslim_ilcesi,
            "Teslim Varış": r.teslim_varis ? dayjs(r.teslim_varis).toDate() : null,
            "Teslim Çıkış": r.teslim_cikis ? dayjs(r.teslim_cikis).toDate() : null,
            "Deadline": r.deadline ? dayjs(r.deadline).toDate() : null,
            "Gecikme (dk)": r.gecikme_dk ?? 0,
            "Gecikme Süresi": minToHM(r.gecikme_dk ?? 0),
            "Kural": r.teslim_varis &&
                (dayjs(r.teslim_varis).hour() < 12 ||
                    (dayjs(r.teslim_varis).hour() === 12 &&
                        dayjs(r.teslim_varis).minute() === 0))
                ? "Varış < 12:00 ⇒ aynı gün 17:00"
                : "Varış ≥ 12:00 ⇒ ertesi gün 12:00",
        }));

        worksheet.columns = [
            { header: "Sefer No", key: "Sefer No", width: 14 },
            { header: "Plaka", key: "Plaka", width: 12 },
            { header: "Proje Adı", key: "Proje Adı", width: 22 },
            { header: "Teslim Noktası", key: "Teslim Noktası", width: 26 },
            { header: "Teslim İli", key: "Teslim İli", width: 16 },
            { header: "Teslim İlçesi", key: "Teslim İlçesi", width: 16 },
            { header: "Teslim Varış", key: "Teslim Varış", width: 20, style: { numFmt: "dd.mm.yyyy hh:mm" } },
            { header: "Teslim Çıkış", key: "Teslim Çıkış", width: 20, style: { numFmt: "dd.mm.yyyy hh:mm" } },
            { header: "Deadline", key: "Deadline", width: 20, style: { numFmt: "dd.mm.yyyy hh:mm" } },
            { header: "Gecikme (dk)", key: "Gecikme (dk)", width: 14 },
            { header: "Gecikme Süresi", key: "Gecikme Süresi", width: 18 },
            { header: "Kural", key: "Kural", width: 28 },
        ];

        worksheet.addRows(dataToExport);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const filename = `teslimde_bekleme_${dayjs(dateFilter).format(
            "YYYYMMDD"
        )}.xlsx`;
        saveAs(blob, filename);
    };

    // Detay modalı için durak verisi hazırlama (Değişmedi)
    const stopRows = useMemo(() => {
        if (!selectedRow) return [];
        const det = detailByNo.get(selectedRow.sefer_no) || [];
        return det.map((rec, idx) => ({
            id: `${selectedRow.sefer_no}-durak-${idx}`,
            sira: rec.nokta_sirasi,
            // Yükleme Bilgileri
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
            // Teslim Bilgileri
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
        }));
    }, [selectedRow, detailByNo]);

    /* ===== DataGrid Sütunları (Gecikme renderCell Güncellendi) ===== */
    const columns = useMemo(() => [
        {
            field: "sefer_no",
            headerName: "Sefer No",
            width: 150,
            renderCell: (p) => (
                <Button
                    size="small"
                    startIcon={<InfoOutlinedIcon />}
                    onClick={() => openDetail(p.row)}
                    sx={{ fontWeight: 600, textTransform: 'none', px: 1, py: 0.5 }} // Daha şık buton
                >
                    {p.value || "—"}
                </Button>
            ),
        },
        { field: "plaka", headerName: "Plaka", width: 120 },
        { field: "proje_adi", headerName: "Proje Adı", width: 160 },
        {
            field: "teslim_varis",
            headerName: "Teslim Varış",
            width: 180,
            valueFormatter: safeVF(fmtDateTR),
        },
        {
            field: "teslim_cikis",
            headerName: "Teslim Çıkış",
            width: 180,
            valueFormatter: safeVF(fmtDateTR),
        },
        {
            field: "deadline",
            headerName: "Deadline",
            width: 180,
            valueFormatter: safeVF(fmtDateTR),
            cellClassName: 'deadline-column', // Görsel vurgu için yeni class
        },
        {
            field: "gecikme_dk",
            headerName: "Gecikme Süresi",
            width: 180,
            renderCell: (p) => {
                const gecikme = p.value ?? 0;
                const { color, label } = getStatusProps(gecikme);
                const isLate = gecikme > 0;

                return (
                    <Tooltip title={isLate ? `${minToHM(gecikme)} Gecikme` : "Zamanında/Erken Çıkış"}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            {isLate && (
                                <AccessTimeFilledIcon color={color} sx={{ fontSize: 16 }} />
                            )}
                            <Chip
                                color={color}
                                variant={isLate ? "filled" : "outlined"} // Gecikme varsa daha dikkat çekici
                                size="small"
                                label={isLate ? minToHM(gecikme) : "Zamanında"}
                                sx={{
                                    fontWeight: isLate ? 700 : 500,
                                }}
                            />
                        </Stack>
                    </Tooltip>
                );
            },
            sortComparator: (a, b) => (a ?? 0) - (b ?? 0),
        },
    ], []);

    return (
        <Box
            sx={{
                minHeight: "100dvh",
                py: { xs: 2, md: 4 },
                bgcolor: (t) => (t.palette.mode === "dark" ? "#121212" : "grey.50"), // Açık renkli daha modern zemin
            }}
        >
            <Container maxWidth={false} sx={{ maxWidth: "1680px", px: { xs: 2, md: 4 } }}>
                <Paper elevation={6} sx={{ borderRadius: 3, overflow: "hidden", p: 0 }}> {/* Daha yüksek gölge */}
                    {/* Başlık ve Filtre Alanı */}
                    <Box
                        sx={{
                            p: 3,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: { xs: 'flex-start', md: 'center' },
                            flexWrap: "wrap",
                            gap: 2,
                            bgcolor: 'primary.main', // Başlık için vurgu rengi
                            color: 'primary.contrastText',
                        }}
                    >
                        <Stack>
                            <Typography variant="h5" fontWeight={700}>
                                Teslimat Gecikme Raporu ⏱️
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                **{dayjs(dateFilter).format("DD MMMM YYYY")}** tarihli tamamlanan seferlerin teslimat gecikme analizi
                            </Typography>
                        </Stack>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                            <TextField
                                label="Tarih Seçin"
                                type="date"
                                InputLabelProps={{ shrink: true, sx: { color: 'primary.contrastText' } }}
                                InputProps={{ sx: { color: 'primary.contrastText' } }}
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                size="small"
                                variant="outlined" // Şık görünüm
                                sx={{
                                    minWidth: 150,
                                    '& .MuiOutlinedInput-root': {
                                        '& fieldset': { borderColor: 'primary.light' },
                                        '&:hover fieldset': { borderColor: 'white' },
                                        '&.Mui-focused fieldset': { borderColor: 'white' },
                                    }
                                }}
                            />
                            <TextField
                                label="Min. Gecikme (dk)"
                                type="number"
                                value={minLateMin}
                                onChange={(e) => setMinLateMin(e.target.value)}
                                size="small"
                                variant="outlined"
                                sx={{
                                    minWidth: 150,
                                    '& .MuiOutlinedInput-root': {
                                        '& fieldset': { borderColor: 'primary.light' },
                                        '&:hover fieldset': { borderColor: 'white' },
                                        '&.Mui-focused fieldset': { borderColor: 'white' },
                                    },
                                    '& .MuiInputLabel-root': { color: 'primary.contrastText' },
                                    '& .MuiInputBase-input': { color: 'primary.contrastText' },
                                }}
                            />
                            <Tooltip title="Verileri Güncelle">
                                <span>
                                    <Button
                                        onClick={fetchAll}
                                        variant="outlined" // Daha hafif bir buton
                                        disabled={loading}
                                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                                        sx={{ height: '40px', color: 'primary.contrastText', borderColor: 'primary.light', '&:hover': { borderColor: 'white' } }}
                                    >
                                        Yenile
                                    </Button>
                                </span>
                            </Tooltip>
                        </Stack>
                    </Box>

                    {/* Veri Alanı */}
                    <Box sx={{ height: "70vh", position: 'relative' }}>
                        {loading && (
                            <LinearProgress sx={{ position: 'absolute', top: 0, width: '100%', zIndex: 1 }} />
                        )}
                        <DataGrid
                            rows={filtered}
                            columns={columns}
                            loading={loading}
                            density="comfortable" // Daha okunaklı satırlar
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
                                '& .MuiDataGrid-columnHeaders': {
                                    bgcolor: 'grey.100', // Başlık arka planı
                                    fontWeight: 700,
                                },
                                '& .deadline-column': { // Deadline sütununu vurgula
                                    bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255, 205, 0, 0.1)' : 'rgba(255, 230, 100, 0.4)'),
                                },
                            }}
                        />
                    </Box>

                    {/* Hata Bildirimi */}
                    {fetchError && (
                        <Alert severity="error" sx={{ m: 2 }}>
                            **Veri Yükleme Hatası:** {fetchError}
                        </Alert>
                    )}
                </Paper>
            </Container>

            {/* Detay Modal Bileşeni */}
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
