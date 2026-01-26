import React, { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
    Box, Button, Container, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Snackbar, Alert, IconButton,
    Stepper, Step, StepLabel, Collapse, TextField
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';

const theme = {
    bg: '#020617',
    card: 'rgba(15, 23, 42, 0.9)',
    accent: '#38bdf8',
    secondary: '#818cf8',
    border: 'rgba(255, 255, 255, 0.08)',
    text: '#f8fafc',
    success: '#10b981'
};

const FilterHeaderCell = React.memo(({ title, colKey, section, value, onFilterChange, color }) => (
    <TableCell sx={{ bgcolor: '#0f172a', p: 1, minWidth: 120 }}>
        <Typography sx={{ color: color, fontSize: '0.7rem', fontWeight: 700, mb: 1 }}>{title}</Typography>
        <TextField
            size="small"
            variant="standard"
            placeholder="Ara..."
            fullWidth
            value={value || ''}
            onChange={(e) => onFilterChange(section, colKey, e.target.value)}
            autoComplete="off"
            sx={{
                input: { color: '#fff', fontSize: '0.65rem', py: 0.5 },
                '& .MuiInput-underline:before': { borderBottomColor: 'rgba(255,255,255,0.2)' }
            }}
            InputProps={{
                startAdornment: <SearchIcon sx={{ fontSize: 12, mr: 0.5, opacity: 0.5, color: '#fff' }} />
            }}
        />
    </TableCell>
));

export default function FiloHakedisWizard() {
    const [activeStep, setActiveStep] = useState(0);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [expandedPanel, setExpandedPanel] = useState('hakedis');

    const [excelData, setExcelData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [seferlerData, setSeferlerData] = useState([]);
    const [seferlerCols, setSeferlerCols] = useState([]);

    const [hakedisFilters, setHakedisFilters] = useState({});
    const [summaryFilters, setSummaryFilters] = useState({});
    const [seferlerFilters, setSeferlerFilters] = useState({});
    // ✅ Hakediş şablonu indir (boş excel)
    const downloadHakedisTemplate = useCallback(() => {
        const headers = [
            "Plate Number",
            "Invoice Current Account Id",
            "Invoice Current Account",
            "Iskontosuz Birim Fiyat",
            "Litre Farki",
        ];

        // Tamamen boş istiyorsan [] bırakıyoruz
        const ws = XLSX.utils.json_to_sheet([], { header: headers });
        XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A1" });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hakediş Şablonu");

        XLSX.writeFile(wb, "Hakedis_Sablon.xlsx");
    }, []);

    // ✅ Seferler şablonu indir (boş excel)
    const downloadSeferlerTemplate = useCallback(() => {
        const headers = [
            "Sefer Tarihi",
            "Sefer No",
            "TMSDespatchId",
            "Plaka",
            "Toplam KM",
        ];

        const ws = XLSX.utils.json_to_sheet([], { header: headers });
        XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A1" });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Seferler Şablonu");

        XLSX.writeFile(wb, "Seferler_Sablon.xlsx");
    }, []);




    // ✅ Yeni adım eklendi
    const steps = ['Hakediş Yükle', 'TL Hesapla', 'Seferler Yükle', 'KM Dağıt & Sağlama', 'Çıktı Al ve Sayfaya Yönlendir'];

    const toNumberTR = (v) => {
        if (v === null || v === undefined || v === "") return 0;
        if (typeof v === "number") return v;
        let s = String(v).trim().replace(/\s/g, "");
        const hasDot = s.includes(".");
        const hasComma = s.includes(",");
        if (hasDot && hasComma) s = s.replace(/\./g, "").replace(",", ".");
        else if (hasComma && !hasDot) s = s.replace(",", ".");
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    };

    const fmtTR = (n, dec = 4) =>
        Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

    const cleanPlate = (p) => String(p || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    // ✅ DÜZELTİLDİ: önce tam eşleşme, sonra includes
    const findColumn = (cols, keywords) => {
        if (!Array.isArray(cols) || !cols.length) return undefined;
        const lowered = keywords.map(k => String(k).toLowerCase().trim());

        const exact = cols.find(c => lowered.some(k => String(c.title).toLowerCase().trim() === k));
        if (exact) return exact;

        return cols.find(c => lowered.some(k => String(c.title).toLowerCase().includes(k)));
    };

    const handleFilterChange = useCallback((section, colKey, value) => {
        if (section === 'hakedis') setHakedisFilters(prev => ({ ...prev, [colKey]: value }));
        else if (section === 'summary') setSummaryFilters(prev => ({ ...prev, [colKey]: value }));
        else if (section === 'seferler') setSeferlerFilters(prev => ({ ...prev, [colKey]: value }));
    }, []);

    const downloadExcel = (data, fileName, sheetName = "Veriler") => {
        try {
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            XLSX.writeFile(workbook, `${fileName}.xlsx`);
        } catch (error) {
            setSnackbar({ open: true, message: 'Excel hatası: ' + error.message, severity: 'error' });
        }
    };

    const filteredHakedis = useMemo(() => {
        return excelData.filter(row => Object.keys(hakedisFilters).every(key =>
            !hakedisFilters[key] || String(row[key] || "").toLowerCase().includes(hakedisFilters[key].toLowerCase())
        ));
    }, [excelData, hakedisFilters]);

    const rawSummaryData = useMemo(() => {
        // seferler yüklendikten sonra özet üretilebilir
        if (activeStep < 3) return [];

        const hCol = findColumn(columns, ['plate number', 'plaka']);
        const sCol = findColumn(seferlerCols, ['plaka', 'plate']);
        const kCol = findColumn(seferlerCols, ['km', 'kilometre']);

        const summary = {};
        excelData.forEach(row => {
            const p = cleanPlate(row[hCol?.key]);
            if (!summary[p]) summary[p] = { Plaka: p, Sefer: 0, ToplamKM: 0, ToplamHakedis: 0 };
            summary[p].ToplamHakedis += (row.hakedisTL || 0);
        });

        seferlerData.forEach(row => {
            const p = cleanPlate(row[sCol?.key]);
            if (!summary[p]) summary[p] = { Plaka: p, Sefer: 0, ToplamKM: 0, ToplamHakedis: 0 };
            summary[p].Sefer += 1;
            summary[p].ToplamKM += toNumberTR(row[kCol?.key]);
        });

        return Object.values(summary).map(i => ({
            ...i,
            BirimMaliyet: i.ToplamKM > 0 ? i.ToplamHakedis / i.ToplamKM : 0
        }));
    }, [excelData, seferlerData, activeStep, columns, seferlerCols]);

    const filteredSummary = useMemo(() => {
        return rawSummaryData.filter(row => Object.keys(summaryFilters).every(key =>
            !summaryFilters[key] || String(row[key] || "").toLowerCase().includes(summaryFilters[key].toLowerCase())
        ));
    }, [rawSummaryData, summaryFilters]);

    const filteredSeferler = useMemo(() => {
        return seferlerData.filter(row => Object.keys(seferlerFilters).every(key =>
            !seferlerFilters[key] || String(row[key] || "").toLowerCase().includes(seferlerFilters[key].toLowerCase())
        ));
    }, [seferlerData, seferlerFilters]);

    const readExcel = (file, type) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            const headers = (json[0] || []).map((h, i) => ({ title: h || `Sütun ${i}`, key: `col${i}` }));
            const rows = json.slice(1).map((row, i) => {
                const obj = { id: i };
                row.forEach((cell, ci) => { obj[`col${ci}`] = cell; });
                return obj;
            });

            if (type === 'hakedis') {
                setColumns(headers);
                setExcelData(rows);
                setActiveStep(1);
            } else {
                setSeferlerCols(headers);
                setSeferlerData(rows);
                setActiveStep(3);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const calculateStep1 = () => {
        const uCol = findColumn(columns, ['birim fiyat', 'unit price']);
        const lCol = findColumn(columns, ['litre']);
        if (!uCol || !lCol) return setSnackbar({ open: true, message: 'Birim Fiyat veya Litre bulunamadı!', severity: 'error' });

        const newCols = [...columns];
        if (!newCols.find(c => c.key === 'hakedisTL')) newCols.push({ title: 'Hakediş TL', key: 'hakedisTL' });
        setColumns(newCols);

        setExcelData(prev => prev.map(row => ({
            ...row,
            hakedisTL: (toNumberTR(row[uCol.key]) / 1.12) * toNumberTR(row[lCol.key])
        })));

        setActiveStep(2);
    };

    // ✅ DAĞITIM
    const distributeHakedisByKM = () => {
        const hPlateCol = findColumn(columns, ['plate number', 'plaka']);
        const hCariIdCol = findColumn(columns, ['invoice current account id']);

        // Unvan: "invoice current account" var, "id" yok
        const hCariNameCol =
            columns.find(c => {
                const t = String(c.title || '').toLowerCase();
                return t.includes('invoice current account') && !t.includes('id');
            })
            || findColumn(columns, ['invoice current account']);

        const sPlateCol = findColumn(seferlerCols, ['plaka', 'plate']);
        const sKmCol = findColumn(seferlerCols, ['km', 'kilometre']);

        if (!hPlateCol || !sPlateCol || !sKmCol) {
            return setSnackbar({ open: true, message: 'Hata: plate number, plaka veya km sütunları bulunamadı!', severity: 'error' });
        }

        const lookupMap = {};
        excelData.forEach(r => {
            const p = cleanPlate(r[hPlateCol.key]);
            if (!lookupMap[p]) {
                lookupMap[p] = {
                    id: r[hCariIdCol?.key] ?? '-',
                    name: r[hCariNameCol?.key] ?? 'Bulunamadı',
                    hakedis: 0
                };
            }
            lookupMap[p].hakedis += (r.hakedisTL || 0);
        });

        const kMap = {};
        seferlerData.forEach(r => {
            const p = cleanPlate(r[sPlateCol.key]);
            kMap[p] = (kMap[p] || 0) + toNumberTR(r[sKmCol.key]);
        });

        const newCols = [...seferlerCols];
        if (!newCols.find(c => c.key === 'cariId')) newCols.push({ title: 'Cari ID', key: 'cariId' });
        if (!newCols.find(c => c.key === 'cariUnvan')) newCols.push({ title: 'Cari Unvan', key: 'cariUnvan' });
        if (!newCols.find(c => c.key === 'masrafAdi')) newCols.push({ title: 'Masraf Adı', key: 'masrafAdi' });
        if (!newCols.find(c => c.key === 'dagitilanHakedis')) newCols.push({ title: 'Dağıtılan Hakediş', key: 'dagitilanHakedis' });

        setSeferlerCols(newCols);

        setSeferlerData(prev => prev.map(r => {
            const p = cleanPlate(r[sPlateCol.key]);
            const info = lookupMap[p] || { id: '-', name: 'Bulunamadı', hakedis: 0 };
            const km = toNumberTR(r[sKmCol.key]);
            const pay = kMap[p] > 0 ? (info.hakedis / kMap[p]) * km : 0;

            return {
                ...r,
                dagitilanHakedis: pay,
                cariId: info.id,
                cariUnvan: info.name,
                masrafAdi: 'HAKEDİŞ FARKI'
            };
        }));

        setActiveStep(4); // ✅ Son adıma geç
        setExpandedPanel('seferler');
        setSnackbar({ open: true, message: 'Cari Unvanlar ve Dağıtım Başarıyla Güncellendi.', severity: 'success' });
    };

    // ✅ SON ADIM: ÇIKTI + YÖNLENDİR
    // ✅ SON ADIM: ÇIKTI + YÖNLENDİR + OTOMATİK DOSYA GÖNDER
    const exportAndRedirect = async () => {
        const despatchCol = findColumn(seferlerCols, ['tmsdespatchid', 'seferid', 'despatch']);
        if (!despatchCol) {
            return setSnackbar({ open: true, message: 'TMSDespatchId sütunu bulunamadı!', severity: 'error' });
        }

        const validRows = seferlerData.filter(r => {
            const v = String(r.cariId ?? '').trim();
            return v !== '' && v !== '-' && v.toLowerCase() !== 'bulunamadı';
        });

        if (validRows.length === 0) {
            return setSnackbar({ open: true, message: 'Cari ID dolu satır bulunamadı!', severity: 'warning' });
        }

        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const yyyy = prev.getFullYear();
        const mm = String(prev.getMonth() + 1).padStart(2, '0');
        const aciklama = `${yyyy}-${mm} HAKEDİŞ`;

        const output = validRows.map(r => ({
            "SeferID": r[despatchCol.key] ?? "",
            "Cari Unvan": r.cariUnvan ?? "",
            "Hesap Adı": "HAKEDİŞ FARKI",
            "Hizmet/Masraf": "",
            "Birim Fiyat": r.dagitilanHakedis ?? "",
            "Miktar": "",
            "KDV Oranı": "",
            "Tevkifat Oranı": "",
            "Açıklama": aciklama
        }));

        const fileName = `Gider_Cikti_${yyyy}${mm}`;
        const sheetName = "ŞABLON";

        try {
            // 1) Workbook oluştur
            const ws = XLSX.utils.json_to_sheet(output);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            // 2) İstersen dosyayı yine indir (kalsın)
            XLSX.writeFile(wb, `${fileName}.xlsx`);

            // 3) ArrayBuffer üret (postMessage için)
            const arrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });

            // 4) Hedef sayfayı aç (autoscan=1 => otomatik tarasın)
            const allowedOrigin = "https://tedarik-analiz.vercel.app";
            const targetUrl = `${allowedOrigin}/GelirGider/GiderEkleme?autoscan=1`;
            const child = window.open(targetUrl, "_blank", "noopener,noreferrer");

            if (!child) {
                return setSnackbar({ open: true, message: "Popup engellendi. Tarayıcıdan izin ver.", severity: "error" });
            }

            // 5) Dosyayı yeni sekmeye postMessage ile gönder
            const payload = {
                type: "AUTO_UPLOAD_EXCEL",
                fileName: `${fileName}.xlsx`,
                mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                buffer: arrayBuffer,
            };

            // Sekme tam yüklenmeden gönderirsen kaçabilir → birkaç kez dene
            let tries = 0;
            const maxTries = 20; // 20 * 250ms = 5sn
            const interval = setInterval(() => {
                tries++;
                try {
                    child.postMessage(payload, allowedOrigin);
                } catch (e) { /* ignore */ }

                if (tries >= maxTries) {
                    clearInterval(interval);
                }
            }, 250);

            setSnackbar({
                open: true,
                message: "Çıktı indirildi ve GiderEkleme’ye otomatik gönderiliyor…",
                severity: "success"
            });
        } catch (error) {
            setSnackbar({ open: true, message: "Çıktı üretme/gönderme hatası: " + error.message, severity: "error" });
        }
    };
    return (
        <Box sx={{ minHeight: '100vh', bgcolor: theme.bg, color: theme.text, py: 4 }}>
            <Container maxWidth="xl">
                <Paper sx={{ p: 2, mb: 3, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '15px' }}>
                    <Stepper activeStep={activeStep} alternativeLabel>
                        {steps.map(l => (
                            <Step key={l}>
                                <StepLabel>
                                    <Typography sx={{ color: '#fff', fontSize: '0.65rem' }}>{l}</Typography>
                                </StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                </Paper>

                <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, background: theme.card, borderRadius: '15px', border: `1px solid ${theme.border}` }}>
                    {activeStep === 0 && (
                        <>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={downloadHakedisTemplate}
                            >
                                Hakediş Şablonu İndir
                            </Button>

                            <Button component="label" variant="contained">
                                Hakediş Yükle
                                <input
                                    type="file"
                                    hidden
                                    onChange={(e) => readExcel(e.target.files?.[0], "hakedis")}
                                />
                            </Button>
                        </>
                    )}
                    {activeStep === 1 && <Button variant="contained" onClick={calculateStep1}>TL Hesapla</Button>}
                    {activeStep === 2 && (
                        <>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={downloadSeferlerTemplate}
                            >
                                Seferler Şablonu İndir
                            </Button>

                            <Button component="label" variant="contained">
                                Seferler Yükle
                                <input
                                    type="file"
                                    hidden
                                    onChange={(e) => readExcel(e.target.files?.[0], "seferler")}
                                />
                            </Button>
                        </>
                    )}
                    {activeStep === 3 && <Button variant="contained" color="success" onClick={distributeHakedisByKM}>Dağıtımı Başlat</Button>}

                    {/* ✅ Yeni buton */}
                    {activeStep === 4 && (
                        <Button variant="contained" color="success" onClick={exportAndRedirect}>
                            Çıktı Al ve Sayfaya Yönlendir
                        </Button>
                    )}

                    <IconButton onClick={() => window.location.reload()} sx={{ ml: 'auto', color: '#ef4444' }}>
                        <DeleteSweepIcon />
                    </IconButton>
                </Paper>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {excelData.length > 0 && (
                        <Paper sx={{ background: theme.card, border: `1px solid ${theme.border}`, overflow: 'hidden', borderRadius: '15px' }}>
                            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle2" onClick={() => setExpandedPanel('hakedis')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                                    1. HAKEDİŞ VERİLERİ ({filteredHakedis.length} / {excelData.length})
                                </Typography>
                                <Button size="small" startIcon={<DownloadIcon />} onClick={() => downloadExcel(filteredHakedis, "Hakedis_Listesi")}>İndir</Button>
                            </Box>
                            <Collapse in={expandedPanel === 'hakedis'}>
                                <TableContainer sx={{ maxHeight: '40vh' }}>
                                    <Table stickyHeader size="small">
                                        <TableHead>
                                            <TableRow>
                                                {columns.map(c => (
                                                    <FilterHeaderCell
                                                        key={c.key}
                                                        title={c.title}
                                                        colKey={c.key}
                                                        section="hakedis"
                                                        value={hakedisFilters[c.key]}
                                                        onFilterChange={handleFilterChange}
                                                        color={theme.accent}
                                                    />
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredHakedis.map((r, i) => (
                                                <TableRow key={i} hover>
                                                    {columns.map(c => (
                                                        <TableCell
                                                            key={c.key}
                                                            sx={{
                                                                color: c.key === 'hakedisTL' ? theme.success : '#cbd5e1',
                                                                fontSize: '0.7rem',
                                                                borderBottom: `1px solid ${theme.border}`
                                                            }}
                                                        >
                                                            {c.key === 'hakedisTL' ? fmtTR(r[c.key]) : r[c.key]}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Collapse>
                        </Paper>
                    )}

                    {rawSummaryData.length > 0 && (
                        <Paper sx={{ background: theme.card, border: `2px solid ${theme.accent}`, overflow: 'hidden', borderRadius: '15px' }}>
                            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(56, 189, 248, 0.05)' }}>
                                <Typography variant="subtitle2" onClick={() => setExpandedPanel('summary')} sx={{ cursor: 'pointer', fontWeight: 800 }}>
                                    2. PLAKA BAZLI MUTABAKAT
                                </Typography>
                                <Button size="small" color="success" variant="contained" startIcon={<DownloadIcon />} onClick={() => downloadExcel(filteredSummary, "Mutabakat_Ozet")}>
                                    Özeti İndir
                                </Button>
                            </Box>
                            <Collapse in={expandedPanel === 'summary'}>
                                <TableContainer sx={{ maxHeight: '40vh' }}>
                                    <Table stickyHeader size="small">
                                        <TableHead>
                                            <TableRow>
                                                {['Plaka', 'Sefer', 'ToplamKM', 'ToplamHakedis', 'BirimMaliyet'].map(k => (
                                                    <FilterHeaderCell
                                                        key={k}
                                                        title={k}
                                                        colKey={k}
                                                        section="summary"
                                                        value={summaryFilters[k]}
                                                        onFilterChange={handleFilterChange}
                                                        color="#fff"
                                                    />
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredSummary.map((r, i) => (
                                                <TableRow key={i} hover>
                                                    <TableCell sx={{ color: theme.accent, fontSize: '0.7rem', borderBottom: `1px solid ${theme.border}`, fontWeight: 700 }}>{r.Plaka}</TableCell>
                                                    <TableCell sx={{ color: '#fff', fontSize: '0.7rem', borderBottom: `1px solid ${theme.border}` }}>{r.Sefer}</TableCell>
                                                    <TableCell sx={{ color: '#fff', fontSize: '0.7rem', borderBottom: `1px solid ${theme.border}` }}>{fmtTR(r.ToplamKM, 2)}</TableCell>
                                                    <TableCell sx={{ color: theme.success, fontSize: '0.7rem', fontWeight: 700, borderBottom: `1px solid ${theme.border}` }}>{fmtTR(r.ToplamHakedis)}</TableCell>
                                                    <TableCell sx={{ color: theme.secondary, fontSize: '0.7rem', borderBottom: `1px solid ${theme.border}` }}>{fmtTR(r.BirimMaliyet, 6)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Collapse>
                        </Paper>
                    )}

                    {seferlerData.length > 0 && (
                        <Paper sx={{ background: theme.card, border: `1px solid ${theme.border}`, overflow: 'hidden', borderRadius: '15px' }}>
                            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle2" onClick={() => setExpandedPanel('seferler')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                                    3. SEFER BAZLI DAĞITIM DETAYI ({filteredSeferler.length} / {seferlerData.length})
                                </Typography>
                                <Button size="small" startIcon={<DownloadIcon />} onClick={() => downloadExcel(filteredSeferler, "Dagitim_Detay_Listesi")}>İndir</Button>
                            </Box>
                            <Collapse in={expandedPanel === 'seferler'}>
                                <TableContainer sx={{ maxHeight: '40vh' }}>
                                    <Table stickyHeader size="small">
                                        <TableHead>
                                            <TableRow>
                                                {seferlerCols.map(c => (
                                                    <FilterHeaderCell
                                                        key={c.key}
                                                        title={c.title}
                                                        colKey={c.key}
                                                        section="seferler"
                                                        value={seferlerFilters[c.key]}
                                                        onFilterChange={handleFilterChange}
                                                        color={theme.secondary}
                                                    />
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredSeferler.map((r, i) => (
                                                <TableRow key={i} hover>
                                                    {seferlerCols.map(c => (
                                                        <TableCell
                                                            key={c.key}
                                                            sx={{
                                                                color: (c.key === 'dagitilanHakedis' || c.key === 'cariId' || c.key === 'cariUnvan') ? theme.accent : '#cbd5e1',
                                                                fontSize: '0.7rem',
                                                                borderBottom: `1px solid ${theme.border}`,
                                                                fontWeight: (c.key === 'dagitilanHakedis' || c.key === 'masrafAdi' || c.key === 'cariUnvan') ? 700 : 400
                                                            }}
                                                        >
                                                            {c.key === 'dagitilanHakedis' ? fmtTR(r[c.key]) : r[c.key]}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Collapse>
                        </Paper>
                    )}
                </Box>

                <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                    <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
                </Snackbar>
            </Container>
        </Box>
    );
}
