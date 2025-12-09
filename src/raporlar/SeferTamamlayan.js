import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    Box, Typography, CircularProgress, Alert, Stack, Paper, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, InputAdornment, Grid
} from "@mui/material";
import { createTheme, ThemeProvider, useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import GetAppIcon from "@mui/icons-material/GetApp";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import EventIcon from "@mui/icons-material/Event";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import TollIcon from '@mui/icons-material/Toll';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// dayjs eklentileri ve locale
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale("tr");

// --- Supabase Client ---
// DİKKAT: Bu kısmı kendi gerçek değerlerinizle doldurun!
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL || "https://dummy.supabase.co",
    process.env.REACT_APP_SUPABASE_ANON_KEY || "dummy-anon-key"
);

// --- Helper Fonksiyonlar ---
const formatDateTime = (timestamp) => {
    if (!timestamp) return "—";
    const d = dayjs(timestamp);
    return d.isValid() ? d.format("DD.MM.YYYY HH:mm") : "—";
};

const formatDate = (timestamp) => {
    if (!timestamp) return "—";
    const d = dayjs(timestamp);
    return d.isValid() ? d.format("DD.MM.YYYY") : "—";
};

/**
 * İlişkisel sorgu (JOIN) sonucu gelen iç içe geçmiş veriyi (nested array)
 * tablo gösterimi için düzleştirir (flattens).
 */
const flattenData = (data) => {
    if (!data || data.length === 0) return [];

    return data.flatMap(sefer => {
        // İlişkili tablo adı 'tamamlanan_detaylar' olarak varsayılmıştır.
        const details = sefer.tamamlanan_detaylar;

        if (!details || details.length === 0) {
            // Detaysız seferleri de göster (detay alanları null/tanımsız olur)
            return [{ ...sefer, tamamlanan_detaylar: undefined }];
        }

        // Detaylar dizi halinde gelebilir. Her bir detayı ana sefer kaydıyla birleştirir.
        return details.map(detay => {
            return {
                ...sefer,
                ...detay, // Detay verilerini üst seviyeye taşı
                tamamlanan_detaylar: undefined // İlişki sonrası kalan detaylar objesini sil
            };
        });
    });
};


/**
 * Çoklu detay kaydı olan seferleri (örn: birden fazla yükleme/teslimat)
 * tek bir satırda toplamak ve tarihleri MIN/MAX olarak belirlemek için kullanılır.
 */
const aggregateSeferler = (data) => {
    if (!data || data.length === 0) return [];

    const grouped = data.reduce((acc, current) => {
        const key = current.sefer_no;

        if (!acc[key]) {
            acc[key] = {
                ...current,
                // Başlangıç değerleri olarak mevcut kaydın değerlerini ata
                yukleme_varis_min: current.yukleme_varis,
                yukleme_cikis_min: current.yukleme_cikis,
                teslim_varis_max: current.teslim_varis,
                teslim_cikis_max: current.teslim_cikis,
            };
            return acc;
        }

        const existing = acc[key];

        // En erken yükleme varış/çıkış tarihini bul
        if (current.yukleme_varis && (!existing.yukleme_varis_min || dayjs(current.yukleme_varis).isSameOrBefore(existing.yukleme_varis_min))) {
            existing.yukleme_varis_min = current.yukleme_varis;
        }
        if (current.yukleme_cikis && (!existing.yukleme_cikis_min || dayjs(current.yukleme_cikis).isSameOrBefore(existing.yukleme_cikis_min))) {
            existing.yukleme_cikis_min = current.yukleme_cikis;
        }

        // En geç teslim varış/çıkış tarihini bul
        if (current.teslim_varis && (!existing.teslim_varis_max || dayjs(current.teslim_varis).isSameOrAfter(existing.teslim_varis_max))) {
            existing.teslim_varis_max = current.teslim_varis;
        }
        if (current.teslim_cikis && (!existing.teslim_cikis_max || dayjs(current.teslim_cikis).isSameOrAfter(existing.teslim_cikis_max))) {
            existing.teslim_cikis_max = current.teslim_cikis;
        }

        return acc;
    }, {});

    return Object.values(grouped).map((item) => ({
        ...item,
        // En erken/en geç tarihleri ana alanlara atıyoruz
        yukleme_varis: item.yukleme_varis_min,
        yukleme_cikis: item.yukleme_cikis_min,
        teslim_varis: item.teslim_varis_max,
        teslim_cikis: item.teslim_cikis_max,
    }));
};

// --- Tablo kolonları ---
const headersConfig = [
    { key: "sefer_tarihi", label: "Tarih 📅", isDate: true, minWidth: 110 },
    { key: "sefer_no", label: "Sefer No", minWidth: 100 },
    { key: "surucu_ad_soyad", label: "Sürücü", minWidth: 150 },
    { key: "surucu_tckn", label: "TC", minWidth: 120 },
    { key: "surucu_telefon", label: "Telefon", minWidth: 140 },

    { key: "plaka", label: "Plaka", minWidth: 100 },
    { key: "treyler", label: "Treyler", minWidth: 120 },

    { key: "musteri_adi", label: "Müşteri", minWidth: 160 },

    { key: "yukleme_noktasi", label: "Yükleme Noktası", minWidth: 180 },
    { key: "yukleme_varis", label: "Yükleme Varış", isDateTime: true, minWidth: 150 },
    { key: "yukleme_cikis", label: "Yükleme Çıkış", isDateTime: true, minWidth: 150 },

    { key: "teslim_noktasi", label: "Teslim Noktası", minWidth: 180 },
    { key: "teslim_ili", label: "Teslim İl", minWidth: 150 },
    { key: "teslim_ilcesi", label: "Teslim İlçe", minWidth: 150 },
    { key: "teslim_varis", label: "Teslim Varış", isDateTime: true, minWidth: 150 },
    { key: "teslim_cikis", label: "Teslim Çıkış", isDateTime: true, minWidth: 150 },
];

// --- Tema (Ultra Modern Dark Mode) ---
const modernTheme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: "#ff5722" }, // Deep Orange
        secondary: { main: "#4caf50" }, // Yeşil (Success/Export)
        background: {
            default: "#0d1117", // Daha derin zemin
            paper: "#1a202c", // Kartlar için koyu metalik gri
        },
        text: {
            primary: "#ffffff",
            secondary: "#94a3b8",
        },
        divider: "#374151",
    },
    typography: {
        fontFamily: "Poppins, Inter, Arial, sans-serif",
        h4: { fontWeight: 700, fontSize: '1.75rem' },
        h6: { fontWeight: 600, fontSize: '1rem' },
        body1: { fontSize: "0.9rem" }
    },
    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
                },
            },
        },
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    textTransform: 'none',
                    fontWeight: 600,
                    transition: 'transform 0.2s',
                    '&:hover': {
                        transform: 'translateY(-1px)',
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: '#2d3748',
                    color: '#e2e8f0',
                    fontWeight: 700,
                    borderBottom: '3px solid #ff5722',
                    padding: '10px 14px',
                },
                body: {
                    fontSize: '0.85rem',
                    color: '#cbd5e1',
                    padding: '8px 14px',
                }
            }
        },
    }
});

// --- Dashboard Özet Kartı ---
function SummaryCard({ title, value, icon: Icon, color }) {
    return (
        <Paper elevation={4} sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 3,
            borderLeft: `5px solid ${color}`,
            bgcolor: '#1f2937'
        }}>
            <Box>
                <Typography variant="h6" color="text.secondary" sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                    {title}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: color }}>
                    {value}
                </Typography>
            </Box>
            <Icon sx={{ fontSize: 40, color: color, opacity: 0.7 }} />
        </Paper>
    );
}

// --- Excel Toolbar ---
function CustomToolbar({ rows }) {
    const theme = useTheme();

    const handleExportExcel = () => {
        if (!rows || rows.length === 0) return;

        const exportColumns = [
            { key: "sefer_tarihi", label: "Tarih" },
            { key: "sefer_no", label: "Sefer No" },
            { key: "surucu_ad_soyad", label: "Sürücü" },
            { key: "surucu_tckn", label: "TC" },
            { key: "surucu_telefon", label: "Telefon" },
            { key: "plaka", label: "Plaka" },
            { key: "treyler", label: "Treyler" },
            { key: "musteri_adi", label: "Müşteri" },

            { key: "yukleme_noktasi", label: "Yükleme Noktası" },
            { key: "yukleme_varis", label: "Yükleme Varış" },
            { key: "yukleme_cikis", label: "Yükleme Çıkış" },

            { key: "teslim_noktasi", label: "Teslim Noktası" },
            { key: "teslim_ili", label: "Teslim İl" },
            { key: "teslim_ilcesi", label: "Teslim İlçe" },
            { key: "teslim_varis", label: "Teslim Varış" },
            { key: "teslim_cikis", label: "Teslim Çıkış" },
        ];

        const dataToExport = rows.map((row) => {
            const obj = {};

            exportColumns.forEach((col) => {
                let value = row[col.key] ?? "";

                if (col.key === "sefer_tarihi") value = formatDate(value);

                if ([
                    "yukleme_varis",
                    "yukleme_cikis",
                    "teslim_varis",
                    "teslim_cikis"
                ].includes(col.key)) {
                    value = formatDateTime(value);
                }

                obj[col.label] = value;
            });

            return obj;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Seferler");

        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buffer], { type: "application/octet-stream" });

        saveAs(blob, `Seferler_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`);
    };


    return (
        <Box
            sx={{
                p: 2,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                bgcolor: theme.palette.background.paper,
                borderTop: `1px solid ${theme.palette.divider}`
            }}
        >
            <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 600 }}>
                Gösterilen Kayıt: **{rows.length}**
            </Typography>
            <Button
                startIcon={<GetAppIcon />}
                color="secondary"
                variant="contained"
                onClick={handleExportExcel}
            >
                Excel İndir
            </Button>
        </Box>
    );
}

// --- ANA BİLEŞEN ---
function SeferTamamlayanContent() {
    const [allRows, setAllRows] = useState([]);
    const [filters, setFilters] = useState({});
    const [globalSearch, setGlobalSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const today = dayjs().format("YYYY-MM-DD");
    const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format("YYYY-MM-DD"));
    const [endDate, setEndDate] = useState(today);

    const theme = useTheme();

    // --- Veri Çekme (DÜZELTİLMİŞ İLİŞKİSEL SORGULAMA) ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Supabase sorgusu: tamamlanan_seferler'den çek, tamamlanan_detaylar'ı JOIN et
            const { data, error } = await supabase
                .from("tamamlanan_seferler") // Ana tablo
                .select(`
                    *,
                    tamamlanan_detaylar (
                        yukleme_noktasi,
                        yukleme_varis,
                        yukleme_cikis,
                        teslim_noktasi,
                        teslim_ili,
                        teslim_ilcesi,
                        teslim_varis,
                        teslim_cikis
                    )
                `) // DİKKAT: Yorumlar ve hatalı format kaldırıldı!
                .gte("sefer_tarihi", startDate)
                .lte("sefer_tarihi", endDate)
                .order("sefer_no", { ascending: false })
                .range(0, 50000); // güvenli limit

            if (error) {
                // Hata mesajını daha anlaşılır hale getirelim
                const errMsg = error.message.includes('parse select parameter')
                    ? 'Supabase SELECT sorgu formatı hatası (imla, boşluk, yorumları kontrol edin).'
                    : error.message;

                throw new Error(errMsg);
            }

            // 1. İlişkisel veriyi tek bir düz dizi haline getir
            const flatData = flattenData(data || []);

            // 2. Aynı sefer no'lu kayıtları tarihlerine göre topla (min/max)
            const aggregatedData = aggregateSeferler(flatData);

            setAllRows(aggregatedData);
            setFilters({});

        } catch (err) {
            setError(`⚠️ Veri çekilirken hata oluştu. Hata: ${err.message}`);
            setAllRows([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Filtreleme ---
    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleGlobalSearchChange = (value) => {
        setGlobalSearch(value);
    };

    // Filtrelenmiş satırları hesaplamak için useMemo
    const filteredRows = useMemo(() => {
        let rows = allRows;

        // 1. Global Arama
        const globalValue = globalSearch.trim().toLowerCase();
        if (globalValue) {
            rows = rows.filter((row) => {
                return headersConfig.some(h => {
                    let cell = row[h.key];
                    if (h.isDate) cell = formatDate(cell);
                    if (h.isDateTime) cell = formatDateTime(cell);
                    return String(cell || "").toLowerCase().includes(globalValue);
                });
            });
        }

        // 2. Sütun Filtreleri
        Object.entries(filters).forEach(([key, filterValue]) => {
            const value = filterValue.trim().toLowerCase();
            if (!value) return;

            const header = headersConfig.find((h) => h.key === key);

            rows = rows.filter((row) => {
                let cell = row[key];
                // Tarih/Saat formatlarını filtrelerken kullan
                if (header.isDate) cell = formatDate(cell);
                if (header.isDateTime) cell = formatDateTime(cell);

                return String(cell || "").toLowerCase().includes(value);
            });
        });

        return rows;
    }, [allRows, filters, globalSearch]);

    // --- Özet Veriler (Dummy) ---
    const summaryData = useMemo(() => ({
        totalTrips: filteredRows.length,
        totalKilometers: (filteredRows.length * 534).toLocaleString('tr-TR'), // Örnek Hesaplama
        avgDuration: `${Math.round(filteredRows.length > 0 ? (filteredRows.length * 15) / filteredRows.length : 0)} saat`, // Örnek Hesaplama
    }), [filteredRows]);


    // --- UI Render ---
    return (
        <Box sx={{ p: 4, minHeight: "100vh", bgcolor: "background.default" }}>

            {/* --- Başlık ve Kontrol Paneli Kartı --- */}
            <Paper elevation={8} sx={{ p: 2, mb: 2, borderRadius: 4, borderLeft: `5px solid ${theme.palette.primary.main}` }}>
                <Typography variant="h4" sx={{ color: "text.primary", mb: 3 }}>
                    <LocalShippingIcon sx={{ mr: 1, fontSize: "1.2em", color: theme.palette.primary.main }} />
                    Tamamlanan Seferler Yönetim Dashboard'u
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Grid container spacing={3} alignItems="flex-end">
                    {/* Tarih Filtreleri */}
                    <Grid item xs={12} sm={6} md={2.5}>
                        <TextField
                            label="Başlangıç Tarihi"
                            type="date"
                            variant="outlined"
                            size="small"
                            fullWidth
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            InputProps={{
                                startAdornment: (<InputAdornment position="start"><EventIcon color="primary" /></InputAdornment>),
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={2.5}>
                        <TextField
                            label="Bitiş Tarihi"
                            type="date"
                            variant="outlined"
                            size="small"
                            fullWidth
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            InputProps={{
                                startAdornment: (<InputAdornment position="start"><EventIcon color="primary" /></InputAdornment>),
                            }}
                        />
                    </Grid>

                    {/* Sorgula ve Bugün Butonları */}
                    <Grid item xs={12} sm={6} md={3}>
                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={fetchData}
                                startIcon={<SearchIcon />}
                                disabled={loading}
                                fullWidth
                            >
                                {loading ? <CircularProgress size={20} color="inherit" /> : 'Sorgula'}
                            </Button>
                            <Button
                                variant="outlined"
                                color="primary"
                                onClick={() => {
                                    setStartDate(today);
                                    setEndDate(today);
                                }}
                                disabled={loading}
                            >
                                Bugün
                            </Button>
                        </Stack>
                    </Grid>

                    {/* Global Arama */}
                    <Grid item xs={12} sm={6} md={4}>
                        <TextField
                            label="Hızlı Arama (Tüm Sütunlar)"
                            variant="outlined"
                            size="small"
                            fullWidth
                            value={globalSearch}
                            onChange={(e) => handleGlobalSearchChange(e.target.value)}
                            InputProps={{
                                startAdornment: (<InputAdornment position="start"><SearchIcon color="secondary" /></InputAdornment>),
                            }}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* --- Özet Dashboard Kartları --- */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={4}>
                    <SummaryCard
                        title="Toplam Sefer Sayısı"
                        value={summaryData.totalTrips}
                        icon={LocalShippingIcon}
                        color={theme.palette.primary.main}
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <SummaryCard
                        title="Tahmini Toplam KM"
                        value={`${summaryData.totalKilometers} km`}
                        icon={TollIcon}
                        color={theme.palette.text.secondary}
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <SummaryCard
                        title="Ort. Sefer Süresi"
                        value={summaryData.avgDuration}
                        icon={AccessTimeIcon}
                        color={theme.palette.secondary.main}
                    />
                </Grid>
            </Grid>

            {/* --- Ana Tablo Kartı --- */}
            <Paper elevation={8} sx={{ flexGrow: 1, borderRadius: 4, overflow: "hidden" }}>

                {loading ? (
                    <Box sx={{ textAlign: "center", p: 8 }}>
                        <CircularProgress color="primary" size={60} />
                        <Typography sx={{ mt: 2 }} color="text.secondary">Veriler yükleniyor...</Typography>
                    </Box>
                ) : (
                    <>
                        <TableContainer>
                            <Table stickyHeader size="medium">
                                <TableHead>
                                    {/* Kolon Başlıkları */}
                                    <TableRow>
                                        {headersConfig.map((h) => (
                                            <TableCell
                                                key={h.key}
                                                style={{ minWidth: h.minWidth || 80 }}
                                            >
                                                {h.label}
                                            </TableCell>
                                        ))}
                                    </TableRow>

                                    {/* Filtre Satırı */}
                                    <TableRow sx={{ bgcolor: '#2d3748' }}>
                                        {headersConfig.map((h) => (
                                            <TableCell key={`filter-${h.key}`} sx={{ p: '6px 14px' }}>
                                                <TextField
                                                    size="small"
                                                    variant="standard"
                                                    placeholder="Filtrele..."
                                                    fullWidth
                                                    value={filters[h.key] || ""}
                                                    onChange={(e) => handleFilterChange(h.key, e.target.value)}
                                                    InputProps={{
                                                        disableUnderline: true,
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <FilterListIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                                                            </InputAdornment>
                                                        ),
                                                        sx: { color: 'white', bgcolor: '#374151', borderRadius: 1, p: '4px 8px' }
                                                    }}
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {filteredRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={headersConfig.length} sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
                                                Veri bulunamadı.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredRows.map((row, index) => (
                                            <TableRow
                                                key={index}
                                                hover
                                                sx={{
                                                    bgcolor: index % 2 === 0 ? '#1a202c' : '#1f2937',
                                                    transition: 'background-color 0.3s'
                                                }}
                                            >
                                                {headersConfig.map((h) => (
                                                    <TableCell key={h.key} sx={{ color: h.key === 'sefer_no' ? theme.palette.primary.main : 'inherit' }}>
                                                        {h.isDate
                                                            ? formatDate(row[h.key])
                                                            : h.isDateTime
                                                                ? formatDateTime(row[h.key])
                                                                : row[h.key] || "—"}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <CustomToolbar rows={filteredRows} />
                    </>
                )}
            </Paper>
        </Box>
    );
}

export default function SeferTamamlayan() {
    return (
        <ThemeProvider theme={modernTheme}>
            <SeferTamamlayanContent />
        </ThemeProvider>
    );
}
