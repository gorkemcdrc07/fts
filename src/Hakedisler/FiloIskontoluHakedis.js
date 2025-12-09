import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
    Box,
    Button,
    Container,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Alert,
    Snackbar
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CalculateIcon from '@mui/icons-material/Calculate';

// --- STİLLER ---
const paperStyle = {
    padding: 3,
    marginBottom: 4,
    borderRadius: 2,
    boxShadow: 3,
};

const VisuallyHiddenInput = ({ onChange, accept }) => (
    <input
        type="file"
        accept={accept}
        onChange={onChange}
        style={{
            clip: 'rect(0 0 0 0)',
            clipPath: 'inset(50%)',
            height: 1,
            overflow: 'hidden',
            position: 'absolute',
            whiteSpace: 'nowrap',
            width: 1,
        }}
    />
);

export default function FiloIskontoluHakedis() {
    const [excelData, setExcelData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const readExcel = (file) => {
        setLoading(true);
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                // Header: 1, veriyi dizi dizisi olarak alır.
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length === 0 || json.length === 1 && json[0].length === 0) {
                    setExcelData([]);
                    setColumns([]);
                    setSnackbarMessage("Yüklenen Excel dosyası boş.");
                    setSnackbarOpen(true);
                    setLoading(false);
                    return;
                }

                const headers = json[0];
                const cols = headers.map((h, index) => ({
                    title: h,
                    dataIndex: `col${index}`,
                    key: `col${index}`,
                }));

                const dataRows = json.slice(1).map((row, rowIndex) => {
                    const rowObject = { id: rowIndex }; // MUI Table için 'id' kullanılır
                    row.forEach((cell, cellIndex) => {
                        rowObject[`col${cellIndex}`] = cell;
                    });
                    return rowObject;
                });

                setColumns(cols);
                setExcelData(dataRows);
                setLoading(false);

            } catch (error) {
                console.error("Excel okuma hatası:", error);
                setSnackbarMessage("Dosya okunurken bir hata oluştu.");
                setSnackbarOpen(true);
                setExcelData([]);
                setColumns([]);
                setLoading(false);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            readExcel(file);
        }
    };

    const handleCalculate = () => {
        if (excelData.length === 0) {
            setSnackbarMessage("Lütfen hesaplama için önce bir Excel dosyası yükleyin.");
            setSnackbarOpen(true);
            return;
        }
        // HESAPLAMA MANTIĞI BURAYA GELECEK
        console.log("Hesaplama başlatıldı. Yüklü veri:", excelData);
        setSnackbarMessage(`Hesaplama başlatıldı! ${excelData.length} satır işleniyor...`);
        setSnackbarOpen(true);
    };

    const handleSnackbarClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbarOpen(false);
    };

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center">
                🚛 Filo İskontolu Hakediş
            </Typography>

            {/* 1. Yükleme ve Hesaplama Alanı */}
            <Paper sx={paperStyle}>
                <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    gap={2}
                    flexWrap="wrap"
                >
                    <Box>
                        <Button
                            component="label"
                            role={undefined}
                            variant="contained"
                            tabIndex={-1}
                            startIcon={<CloudUploadIcon />}
                            disabled={loading}
                            sx={{ mr: 2 }}
                        >
                            Excel Yükle
                            <VisuallyHiddenInput onChange={handleFileChange} accept=".xlsx, .xls" />
                        </Button>

                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<CalculateIcon />}
                            onClick={handleCalculate}
                            disabled={excelData.length === 0 || loading}
                        >
                            Hesapla
                        </Button>
                    </Box>

                    {fileName && (
                        <Alert severity="info" sx={{ minWidth: '200px' }}>
                            Yüklenen Dosya: **{fileName}** ({excelData.length} Satır)
                        </Alert>
                    )}
                </Box>
            </Paper>

            {/* 2. Önizleme Alanı */}
            <Paper sx={paperStyle}>
                <Typography variant="h6" gutterBottom>
                    Veri Önizleme
                </Typography>

                {loading ? (
                    <Box display="flex" justifyContent="center" py={5}>
                        <CircularProgress />
                        <Typography ml={2}>Dosya okunuyor...</Typography>
                    </Box>
                ) : excelData.length > 0 ? (
                    <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                        <Table stickyHeader aria-label="excel preview table" size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                    {columns.map((column) => (
                                        <TableCell key={column.key} sx={{ fontWeight: 'bold' }}>
                                            {column.title}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {excelData.map((row) => (
                                    <TableRow key={row.id} hover>
                                        {columns.map((column) => (
                                            <TableCell key={column.key}>
                                                {row[column.dataIndex]}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Box sx={{ p: 5, textAlign: 'center', backgroundColor: '#fafafa', borderRadius: 1 }}>
                        <Typography color="text.secondary">
                            Lütfen Excel dosyanızı yukarıdaki düğmeyi kullanarak yükleyin. Önizleme burada görünecektir.
                        </Typography>
                    </Box>
                )}
            </Paper>

            {/* Bildirim (Snackbar) */}
            <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
                <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Container>
    );
}
