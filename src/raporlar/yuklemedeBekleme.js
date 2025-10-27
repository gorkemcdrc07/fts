// src/raporlar/yuklemedeBekleme.js
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
    Card,
    CardContent,
    Chip,
    Container,
    Grid,
    IconButton,
    InputAdornment,
    Paper,
    Stack,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
    Alert,
    CircularProgress,
} from "@mui/material";

// DataGrid
import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarQuickFilter,
} from "@mui/x-data-grid";

// ICONS IMPORT
import {
    Refresh as RefreshIcon,
    InfoOutlined as InfoOutlinedIcon,
    CalendarToday as CalendarTodayIcon,
    HourglassEmpty as HourglassEmptyIcon,
    Download as DownloadIcon,
} from "@mui/icons-material";

// Modal Component
import { TripDetailModal } from "./TripDetailModal";

// ===================== Dayjs Setup =====================
dayjs.extend(duration);
dayjs.locale("tr");

/* ===================== Sabitler / Şemalar ===================== */
const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";
const TARGET_WAIT_MINUTES = 240;
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

// ✅ DÜZELTME: sefer_id yerine sefer_no kullanılıyor
const DETAIL_COLS = [
    "sefer_no", // <-- Anahtar
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

/* ===================== Yardımcılar ===================== */
const safeVF = (fn) => (p) => (fn ? fn(p.value) : p.value);

const firstOf = (obj, keys) => {
    for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null && v !== "") return v;
    }
    return null;
};

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
    return `${r} dk`;
};

const fmtMinutes = (min) => {
    if (min === null || min === undefined) return "—";
    const n = Math.round(Number(min));
    return minToHM(n);
};

function calcETAFromDistance() {
    return null;
}

/* ===================== Küçük UI Bileşenleri ===================== */
const WaitChip = ({ minutes }) => {
    let color = "default";
    if (minutes >= 240) color = "error";
    else if (minutes >= 180) color = "warning";
    else if (minutes >= 120) color = "info";
    return (
        <Chip
            color={color}
            label={fmtMinutes(minutes)}
            variant="outlined"
            size="small"
        />
    );
};

const ExcelToolbar = ({ onExport, onRefresh, disabled }) => (
    <GridToolbarContainer sx={{ p: 1 }}>
        <GridToolbarQuickFilter
            quickFilterParser={(v) => v.split(/\s+/).filter(Boolean)}
            debounceMs={300}
            placeholder="Ara..."
        />
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Excel Raporu İndir">
            <span>
                <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    variant="outlined"
                    onClick={onExport}
                    disabled={disabled}
                >
                    Excel İndir
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
    };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setFetchError(null);

        const startDate = dayjs(dateFilter).startOf("day").toISOString();
        const endDate = dayjs(dateFilter).add(1, "day").startOf("day").toISOString();

        // 1) Özet verileri çek
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

        // 2) Detayları sefer_no'ya göre çek
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

        // 3) Verileri eşleştir
        summaryResult.forEach((s) => {
            const detailsForSefer = detailResult
                .filter((d) => d.sefer_no === s.sefer_no)
                .sort(
                    (a, b) => (a.nokta_sirasi ?? 999) - (b.nokta_sirasi ?? 999)
                );
            byNo.set(s.sefer_no, detailsForSefer);
        });

        // 4) Bekleme dakikasını yalnızca varış & çıkış dolu olan ilk yükleme kaydından hesapla
        const all = summaryResult.map((r, i) => {
            const sefer_no = firstOf(r, ["sefer_no"]) || `NO-${r.id ?? i}`;
            const detList = byNo.get(sefer_no) || [];

            const firstValidLoad =
                detList.find((d) => d.yukleme_varis && d.yukleme_cikis) || null;

            const yukleme_varis = firstValidLoad ? firstValidLoad.yukleme_varis : null;
            const yukleme_cikis = firstValidLoad ? firstValidLoad.yukleme_cikis : null;
            const bekleme_dk = diffMinutes(yukleme_varis, yukleme_cikis);

            return {
                id: `${SUMMARY_TABLE}-${r.id ?? i}`,
                sefer_no,
                ...r,
                yukleme_varis,
                yukleme_cikis,
                bekleme_dk,
            };
        });

        // 5) Sadece geçerli bekleme süresi olanları tut
        const cleaned = all.filter((x) => x.bekleme_dk !== null);

        // (Opsiyonel) Aynı sefer_no gelirse, beklemesi büyük olanı tut
        const dedup = Object.values(
            cleaned.reduce((acc, r) => {
                const key = r.sefer_no || r.id;
                if (
                    !acc[key] ||
                    (acc[key].bekleme_dk ?? 0) < (r.bekleme_dk ?? 0)
                ) {
                    acc[key] = r;
                }
                return acc;
            }, {})
        );

        setDetailByNo(byNo);
        setRows(dedup);
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

    // 🛑 EXCEL EXPORT
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
            "Yükleme İli": r.yukleme_ili,
            "Teslim Noktası": r.teslim_noktasi,
            "Teslim İli": r.teslim_ili,
            "Varış Zamanı": r.yukleme_varis ? dayjs(r.yukleme_varis).toDate() : null,
            "Çıkış Zamanı": r.yukleme_cikis ? dayjs(r.yukleme_cikis).toDate() : null,
            "Bekleme (dk)": r.bekleme_dk,
            "Bekleme Süresi": minToHM(r.bekleme_dk),
        }));

        worksheet.columns = [
            { header: "Sefer No", key: "Sefer No", width: 14 },
            { header: "Plaka", key: "Plaka", width: 10 },
            { header: "Treyler", key: "Treyler", width: 10 },
            { header: "Şoför", key: "Şoför", width: 20 },
            { header: "Proje Adı", key: "Proje Adı", width: 20 },
            { header: "Yükleme Noktası", key: "Yükleme Noktası", width: 25 },
            { header: "Yükleme İli", key: "Yükleme İli", width: 15 },
            { header: "Teslim Noktası", key: "Teslim Noktası", width: 25 },
            { header: "Teslim İli", key: "Teslim İli", width: 15 },
            {
                header: "Varış Zamanı",
                key: "Varış Zamanı",
                width: 20,
                style: { numFmt: "dd.mm.yyyy hh:mm" },
            },
            {
                header: "Çıkış Zamanı",
                key: "Çıkış Zamanı",
                width: 20,
                style: { numFmt: "dd.mm.yyyy hh:mm" },
            },
            { header: "Bekleme (dk)", key: "Bekleme (dk)", width: 12 },
            { header: "Bekleme Süresi", key: "Bekleme Süresi", width: 18 },
        ];

        worksheet.addRows(dataToExport);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const filename = `yuklemede_bekleme_${dayjs(dateFilter).format(
            "YYYYMMDD"
        )}.xlsx`;
        saveAs(blob, filename);
    };

    const stopRows = useMemo(() => {
        if (!selectedRow) return [];
        const det = detailByNo.get(selectedRow.sefer_no) || [];
        return det.map((rec, idx) => ({
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
        }));
    }, [selectedRow, detailByNo]);

    const columns = [
        {
            field: "sefer_no",
            headerName: "Sefer No",
            width: 150,
            renderCell: (p) => (
                <Button
                    size="small"
                    startIcon={<InfoOutlinedIcon />}
                    onClick={() => openDetail(p.row)}
                    sx={{ fontWeight: 600 }}
                >
                    {p.value || "—"}
                </Button>
            ),
        },
        { field: "plaka", headerName: "Plaka", width: 120 },
        { field: "surucu_ad_soyad", headerName: "Şoför", width: 180 },
        { field: "proje_adi", headerName: "Proje Adı", width: 150 },
        {
            field: "yukleme_varis",
            headerName: "Varış Zm.",
            width: 180,
            valueFormatter: safeVF(fmtDateTR),
        },
        {
            field: "yukleme_cikis",
            headerName: "Çıkış Zm.",
            width: 180,
            valueFormatter: safeVF(fmtDateTR),
        },
        {
            field: "bekleme_dk",
            headerName: "Bekleme Süresi",
            width: 160,
            renderCell: (p) => <WaitChip minutes={p.value} />,
        },
    ];

    return (
        <Box
            sx={{
                minHeight: "100dvh",
                py: { xs: 2, md: 4 },
                bgcolor: (t) => (t.palette.mode === "dark" ? "#121212" : "grey.100"),
            }}
        >
            <Container
                maxWidth={false}
                sx={{ maxWidth: "1680px", px: { xs: 2, md: 4 } }}
            >
                <Paper elevation={3} sx={{ borderRadius: 4, overflow: "hidden" }}>
                    <Box
                        sx={{
                            p: 2,
                            display: "flex",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 2,
                        }}
                    >
                        <Stack>
                            <Typography variant="h6" fontWeight={700}>
                                Yüklemede Bekleme Süreleri
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {dayjs(dateFilter).format("DD MMMM YYYY")}
                            </Typography>
                        </Stack>

                        {/* ==== Üst Aksiyonlar ==== */}
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <TextField
                                label="Min. Bekleme (dk)"
                                type="number"
                                value={minDakika}
                                onChange={(e) => setMinDakika(e.target.value)}
                                size="small"
                            />
                            <TextField
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                size="small"
                            />

                            {/* Excele Aktar */}
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={handleExport}
                                disabled={loading || !filtered.length}
                            >
                                Excele Aktar
                            </Button>

                            <Button
                                onClick={fetchAll}
                                variant="contained"
                                disabled={loading}
                                startIcon={<RefreshIcon />}
                            >
                                Yenile
                            </Button>
                        </Stack>
                    </Box>

                    <Box sx={{ height: "70vh" }}>
                        {/* v5 uyumlu API */}
                        <DataGrid
                            rows={filtered}
                            columns={columns}
                            loading={loading}
                            density="compact"
                            components={{
                                Toolbar: ExcelToolbar,
                            }}
                            componentsProps={{
                                toolbar: {
                                    onExport: handleExport,
                                    onRefresh: fetchAll,
                                    disabled: loading || !filtered.length,
                                },
                            }}
                        />
                    </Box>

                    {fetchError && (
                        <Alert severity="warning" sx={{ m: 2 }}>
                            {fetchError}
                        </Alert>
                    )}
                </Paper>
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
