import React, { useEffect, useState, useCallback } from "react";
import {
    Box, Typography, CircularProgress, Alert, Stack, Paper, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField
} from "@mui/material";
import { createTheme, ThemeProvider, useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import 'dayjs/locale/tr';
import GetAppIcon from '@mui/icons-material/GetApp';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

dayjs.locale('tr');

// --- Supabase Client ---
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

// --- Helper Fonksiyon ---
const formatDateTime = (timestamp) => {
    if (!timestamp) return '—';
    const d = dayjs(timestamp);
    return d.isValid() ? d.format('DD.MM.YYYY HH:mm') : '—';
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

    { key: 'yukleme_varis', label: 'Yk. Varış ⏰', isDateTime: true },
    { key: 'yukleme_cikis', label: 'Yk. Çıkış 🚀', isDateTime: true },

    { key: 'teslim_alan_firma', label: 'Teslim Alan Firma 🏢' },
    { key: 'teslim_noktasi', label: 'Teslim Noktası 🏠' },
    { key: 'teslim_ili', label: 'Teslim İl' },
    { key: 'teslim_ilcesi', label: 'Teslim İlçe' },

    { key: 'teslim_varis', label: 'Ts. Varış ⏰', isDateTime: true },
    { key: 'teslim_cikis', label: 'Ts. Çıkış 🏁', isDateTime: true },
];

// --- Tema ---
// Panellerin (Paper) arka plan rengi #1d1d1d'den #181818'e güncellendi.
const modernTheme = createTheme({
    palette: {
        mode: 'dark', // Koyu tema
        primary: { main: '#4dabf5' }, // Belirgin Mavi
        secondary: { main: '#ffb74d' }, // Turuncu Vurgu
        background: {
            default: '#121212', // En koyu arka plan
            paper: '#181818'   // Paneller için daha koyu bir gri tonu (eski: #1d1d1d)
        }
    },
    typography: { fontFamily: 'Inter, Arial, sans-serif' } // Modern font
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
                Excel Olarak İndir
            </Button>
        </Box>
    );
}

// --- Ana Bileşen ---
function SeferTamamlayanContent() {
    const [rows, setRows] = useState([]);
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
            setRows([]);
        } else {
            setRows(data || []);
            setError(null);
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

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <Paper elevation={4} sx={{ p: { xs: 2, md: 4 }, mb: 3, borderRadius: 3 }}>
                <Typography variant="h4" component="h1" sx={{ color: 'primary.main', mb: 3 }}>
                    <LocalShippingIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: '2rem' }} />
                    Tamamlanan Seferler Yönetim Paneli
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }}>
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

                    <Paper sx={{ p: 2, bgcolor: theme.palette.secondary.dark, color: '#fff', borderRadius: 2, minWidth: 200, textAlign: 'center', fontWeight: 'bold' }}>
                        <Typography variant="body2" sx={{ opacity: 0.8 }}>Seçilen Tarihte Görüntülenen Sefer:</Typography>
                        <Typography variant="h5" sx={{ mt: 0.5 }}>{loading ? <CircularProgress size={20} color="secondary" /> : rows.length}</Typography>
                    </Paper>
                </Stack>

                {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error}</Alert>}
            </Paper>

            <Paper elevation={4} sx={{ flexGrow: 1, minHeight: '50vh', borderRadius: 3, overflow: 'auto', maxWidth: '100%' }}>
                <CustomToolbar rows={rows} />

                {loading ? (
                    <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                        <CircularProgress size={50} color="primary" />
                        <Typography sx={{ mt: 2, color: 'text.secondary' }}>Veriler Yükleniyor...</Typography>
                    </Box>
                ) : (
                    <TableContainer sx={{ maxHeight: 'calc(100% - 60px)', overflowX: 'auto', width: '100%' }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    {headersConfig.map(h => (
                                        <TableCell key={h.key} sx={{
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
                            </TableHead>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={headersConfig.length} sx={{ textAlign: 'center', py: 5 }}>
                                            <Typography variant="body1" color="text.secondary">
                                                Seçilen tarihte tamamlanan sefer bulunamadı. Lütfen farklı bir tarih seçin.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row, idx) => (
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
