import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    Box, Typography, CircularProgress, Alert, Stack, Paper, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, InputAdornment
} from "@mui/material";
import { createTheme, ThemeProvider, useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import 'dayjs/locale/tr';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import GetAppIcon from '@mui/icons-material/GetApp';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import FilterListIcon from '@mui/icons-material/FilterList'; // Filtre İkonu
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('tr');

// --- Supabase Client ---
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

// --- Helper Fonksiyonlar ---
const formatDateTime = (timestamp) => {
    if (!timestamp) return '—';
    const d = dayjs(timestamp);
    return d.isValid() ? d.format('DD.MM.YYYY HH:mm') : '—';
};

/**
 * Aynı sefere ait birden fazla kaydı gruplayarak min/max tarih/saat değerlerini bulur.
 */
const aggregateSeferler = (data) => {
    if (!data || data.length === 0) return [];
    // ... (aggregateSeferler mantığı aynı kalır) ...
    const grouped = data.reduce((acc, current) => {
        const key = current.sefer_no;

        if (!acc[key]) {
            acc[key] = {
                ...current,
                yukleme_varis_min: current.yukleme_varis,
                yukleme_cikis_min: current.yukleme_cikis,
                teslim_varis_max: current.teslim_varis,
                teslim_cikis_max: current.teslim_cikis,
            };
            return acc;
        }

        const existing = acc[key];

        // --- Yükleme (En Erken - MIN) ---
        if (current.yukleme_varis) {
            if (!existing.yukleme_varis_min || dayjs(current.yukleme_varis).isSameOrBefore(dayjs(existing.yukleme_varis_min))) {
                existing.yukleme_varis_min = current.yukleme_varis;
            }
        }
        if (current.yukleme_cikis) {
            if (!existing.yukleme_cikis_min || dayjs(current.yukleme_cikis).isSameOrBefore(dayjs(existing.yukleme_cikis_min))) {
                existing.yukleme_cikis_min = current.yukleme_cikis;
            }
        }

        // --- Teslimat (En Geç - MAX) ---
        if (current.teslim_varis) {
            if (!existing.teslim_varis_max || dayjs(current.teslim_varis).isSameOrAfter(dayjs(existing.teslim_varis_max))) {
                existing.teslim_varis_max = current.teslim_varis;
            }
        }
        if (current.teslim_cikis) {
            if (!existing.teslim_cikis_max || dayjs(current.teslim_cikis).isSameOrAfter(dayjs(existing.teslim_cikis_max))) {
                existing.teslim_cikis_max = current.teslim_cikis;
            }
        }

        return acc;
    }, {});

    return Object.values(grouped).map(item => ({
        ...item,
        yukleme_varis: item.yukleme_varis_min,
        yukleme_cikis: item.yukleme_cikis_min,
        teslim_varis: item.teslim_varis_max,
        teslim_cikis: item.teslim_cikis_max
    }));
};


// --- Kolonlar ---
const headersConfig = [
    { key: 'sefer_tarihi', label: 'Tarih 📅', isDate: true },
    { key: 'sefer_no', label: 'Sefer No #️⃣' },
    { key: 'surucu_ad_soyad', label: 'Sürücü 👤' },
    { key: 'surucu_tckn', label: 'TCKN' },
    { key: 'surucu_telefon', label: 'Telefon 📱' },
    { key: 'plaka', label: 'Plaka 🚛' },
    { key: 'treyler', label: 'Treyler 🔗' },
    { key: 'musteri_adi', label: 'Müşteri 🤝' },

    { key: 'yukleme_noktasi', label: 'Yükleme Noktası 📍' },
    { key: 'yukleme_ili', label: 'Yükleme İl' },
    { key: 'yukleme_ilcesi', label: 'Yükleme İlçe' },

    { key: 'yukleme_varis', label: 'Yk. Varış (Min) ⏰', isDateTime: true },
    { key: 'yukleme_cikis', label: 'Yk. Çıkış (Min) 🚀', isDateTime: true },

    { key: 'teslim_alan_firma', label: 'Teslim Alan Firma 🏢' },
    { key: 'teslim_noktasi', label: 'Teslim Noktası 🏠' },
    { key: 'teslim_ili', label: 'Teslim İl' },
    { key: 'teslim_ilcesi', label: 'Teslim İlçe' },

    { key: 'teslim_varis', label: 'Ts. Varış (Max) ⏰', isDateTime: true },
    { key: 'teslim_cikis', label: 'Ts. Çıkış (Max) 🏁', isDateTime: true },
];

// --- Tema (Değişmedi) ---
const modernTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#4dabf5' },
        secondary: { main: '#ffb74d' },
        background: {
            default: '#121212',
            paper: '#181818'
        }
    },
    typography: { fontFamily: 'Inter, Arial, sans-serif' }
});

// --- Custom Toolbar (Excel İndirme) ---
function CustomToolbar({ rows }) {
    const theme = useTheme();

    const handleExportExcel = () => {
        if (!rows || rows.length === 0) return;

        const dataToExport = rows.map(row => {
            const obj = {};
            headersConfig.forEach(h => {
                let value = row[h.key] || '';
                if (h.isDate) value = dayjs(value).format('DD.MM.YYYY');
                if (h.isDateTime) value = formatDateTime(value);
                obj[h.label] = value;
            });
            return obj;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Seferler');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(blob, `Seferler_${dayjs().format('YYYYMMDD')}.xlsx`);
    };

    return (
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Button
                startIcon={<GetAppIcon />}
                color="secondary"
                variant="contained"
                onClick={handleExportExcel}
                sx={{ borderRadius: 2 }}
            >
                Excel Olarak İndir ({rows.length})
            </Button>
        </Box>
    );
}

// --- Ana Bileşen ---
function SeferTamamlayanContent() {
    const [allRows, setAllRows] = useState([]);
    const [filters, setFilters] = useState({}); // Yeni: Sütun filtrelerini tutar (örn: { plaka: '42ABC', surucu: 'mehmet' })
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const theme = useTheme();

    const fetchData = useCallback(async (date) => {
        setLoading(true);
        setError(null);
        const filterDate = date.format("YYYY-MM-DD");

        const { data, error } = await supabase
            .from('tamamlanan_detaylar_view')
            .select('*')
            .eq('sefer_tarihi', filterDate)
            .order('sefer_no', { ascending: false });

        if (error) {
            setError(`⚠️ Veri çekilirken bir sorun oluştu: ${error.message}`);
            setAllRows([]);
        } else {
            const aggregatedData = aggregateSeferler(data || []);
            setAllRows(aggregatedData);
            setError(null);
            // Tarih değiştiğinde filtreleri sıfırla
            setFilters({});
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData(selectedDate);
    }, [fetchData, selectedDate]);

    const handleDateChange = (event) => {
        const newDate = dayjs(event.target.value, 'YYYY-MM-DD');
        if (newDate.isValid()) setSelectedDate(newDate);
    };

    // Yeni: Filtre değerini güncelleyen fonksiyon
    const handleFilterChange = (key, value) => {
        setFilters(prevFilters => ({
            ...prevFilters,
            [key]: value
        }));
    };

    // Filtrelenmiş satırları hesaplamak için useMemo kullan
    const filteredRows = useMemo(() => {
        let currentRows = allRows;

        // Aktif olan her bir filtreyi döngüye al
        Object.entries(filters).forEach(([key, filterValue]) => {
            const trimmedFilter = String(filterValue).toLowerCase().trim();
            if (trimmedFilter) {
                // Filtrenin ait olduğu sütun yapılandırmasını bul
                const header = headersConfig.find(h => h.key === key);

                currentRows = currentRows.filter(row => {
                    let cellValue = row[key];

                    // Hücre değerini filtreleme için hazırlama (Tarih/Saat formatı dahil)
                    if (header.isDate) {
                        cellValue = row[key] ? dayjs(row[key]).format('DD.MM.YYYY') : '';
                    } else if (header.isDateTime) {
                        cellValue = formatDateTime(row[key]);
                    }

                    cellValue = String(cellValue || '').toLowerCase();

                    return cellValue.includes(trimmedFilter);
                });
            }
        });

        return currentRows;

    }, [allRows, filters]); // allRows veya filters değiştiğinde yeniden hesapla


    return (
        <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <Paper elevation={4} sx={{ p: { xs: 2, md: 4 }, mb: 3, borderRadius: 3 }}>
                <Typography variant="h4" component="h1" sx={{ color: 'primary.main', mb: 3 }}>
                    <LocalShippingIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: '2rem' }} />
                    **Tamamlanan Seferler Yönetim Paneli**
                </Typography>

                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', lg: 'center' }} justifyContent="space-between">

                    {/* Tarih Seçimi ve Bugün Butonu */}
                    <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                            label="Sefer Tarihi"
                            type="date"
                            value={selectedDate.format('YYYY-MM-DD')}
                            onChange={handleDateChange}
                            InputLabelProps={{ style: { color: theme.palette.text.primary } }}
                            InputProps={{ startAdornment: <CalendarTodayIcon sx={{ color: theme.palette.primary.main, mr: 1 }} /> }}
                            sx={{ width: { xs: '100%', sm: 250 } }}
                        />
                        <Button variant="outlined" onClick={() => setSelectedDate(dayjs())} color="secondary">Bugün</Button>
                    </Stack>

                    {/* Sefer Sayısı Bilgisi */}
                    <Paper sx={{ p: 2, bgcolor: theme.palette.secondary.dark, color: '#fff', borderRadius: 2, minWidth: 200, textAlign: 'center', fontWeight: 'bold' }}>
                        <Typography variant="body2" sx={{ opacity: 0.8 }}>Görüntülenen Sefer Sayısı:</Typography>
                        <Typography variant="h5" sx={{ mt: 0.5 }}>{loading ? <CircularProgress size={20} color="secondary" /> : filteredRows.length}</Typography>
                    </Paper>
                </Stack>

                {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error}</Alert>}
            </Paper>

            <Paper elevation={4} sx={{ flexGrow: 1, minHeight: '50vh', borderRadius: 3, overflow: 'auto', maxWidth: '100%' }}>
                <CustomToolbar rows={filteredRows} />

                {loading ? (
                    <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                        <CircularProgress size={50} color="primary" />
                        <Typography sx={{ mt: 2, color: 'text.secondary' }}>Veriler Yükleniyor...</Typography>
                    </Box>
                ) : (
                    <TableContainer sx={{ maxHeight: 'calc(100% - 60px)', overflowX: 'auto', width: '100%' }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                {/* Birinci Satır: Sütun Başlıkları */}
                                <TableRow>
                                    {headersConfig.map(h => (
                                        <TableCell key={`head-${h.key}`} sx={{
                                            fontWeight: 'bold',
                                            whiteSpace: 'nowrap',
                                            px: 1,
                                            py: 0.5,
                                            maxWidth: h.isDateTime ? 160 : 200,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            color: theme.palette.primary.light
                                        }}>
                                            {h.label}
                                        </TableCell>
                                    ))}
                                </TableRow>

                                {/* İkinci Satır: Filtre Inputları */}
                                <TableRow>
                                    {headersConfig.map(h => (
                                        <TableCell key={`filter-${h.key}`} sx={{ px: 0.5, py: 0.5, maxWidth: h.isDateTime ? 160 : 200, bgcolor: theme.palette.background.paper }}>
                                            <TextField
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                                placeholder={`Filtrele...`}
                                                value={filters[h.key] || ''}
                                                onChange={(e) => handleFilterChange(h.key, e.target.value)}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <FilterListIcon sx={{ fontSize: '1rem', color: theme.palette.text.secondary }} />
                                                        </InputAdornment>
                                                    ),
                                                    sx: { fontSize: '0.8rem', height: 35 }
                                                }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                                                    }
                                                }}
                                            />
                                        </TableCell>
                                    ))}
                                </TableRow>

                            </TableHead>
                            <TableBody>
                                {filteredRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={headersConfig.length} sx={{ textAlign: 'center', py: 5 }}>
                                            <Typography variant="body1" color="text.secondary">
                                                Filtreleme kriterlerine uygun veri bulunamadı.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRows.map((row, idx) => (
                                        <TableRow key={idx} hover sx={{ '&:hover': { bgcolor: theme.palette.action.hover } }}>
                                            {headersConfig.map((head) => {
                                                let cellContent = row[head.key] || '—';
                                                if (head.isDate) cellContent = row[head.key] ? dayjs(row[head.key]).format('DD.MM.YYYY') : '—';
                                                if (head.isDateTime) cellContent = formatDateTime(row[head.key]);
                                                return (
                                                    <TableCell key={head.key} sx={{ whiteSpace: 'nowrap', px: 1, py: 0.5, maxWidth: head.isDateTime ? 160 : 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {cellContent}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
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
