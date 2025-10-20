// src/raporlar/PivotTool.jsx

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient"; // Supabase istemcisi
import {
    Box, Card, CardContent, FormControl, InputLabel, Select, MenuItem,
    Button, Chip, Stack, Typography, Divider, useTheme, Container, Alert, Tooltip, CircularProgress
} from "@mui/material";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend,
    LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import {
    TableChart, Timeline, BarChart as BarChartIcon, PieChart as PieChartIcon,
    Settings as SettingsIcon, Dataset as DatasetIcon, GridView as GridViewIcon,
    ArrowCircleRight as ArrowCircleRightIcon, Refresh as RefreshIcon
} from "@mui/icons-material";

// --- küçük yardımcılar ---
const unique = (arr) => Array.from(new Set(arr));
const aggregators = {
    sum: (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0),
    count: (arr) => arr.length,
    avg: (arr) => (arr.length ? arr.reduce((a, b) => a + (Number(b) || 0), 0) / arr.length : 0),
};

function inferFields(rows) {
    if (!rows || !rows.length) return [];
    // Tarih, ID gibi veritabanı alanları hariç, sadece pivot için uygun alanları al
    const excludedFields = ['created_at', 'updated_at', 'id', 'user_id'];
    return Object.keys(rows[0]).filter(f => !excludedFields.includes(f));
}

function inferNumericFields(rows, fields) {
    if (!rows?.length) return [];
    return fields.filter((f) => rows.some((r) => typeof r[f] === "number" && Number.isFinite(r[f])));
}

function pivot({ rows, rowDims, colDims, measure, agg }) {
    if (!rows?.length || !measure) {
        return { table: [], rowKeys: [], colKeys: [] };
    }
    const aggFn = aggregators[agg] || aggregators.sum;

    const rowKeys = unique(rows.map((r) => rowDims.map((d) => r[d] ?? "(boş)").join(" | "))).sort();
    const colKeys = unique(
        rows.map((r) => (colDims.length ? colDims.map((d) => r[d] ?? "(boş)").join(" | ") : "Toplam"))
    ).sort();

    const cube = {};
    rows.forEach((r) => {
        const rk = rowDims.map((d) => r[d] ?? "(boş)").join(" | ");
        const ck = colDims.length ? colDims.map((d) => r[d] ?? "(boş)").join(" | ") : "Toplam";
        const key = `${rk}__${ck}`;
        if (!cube[key]) cube[key] = [];
        // Sadece sayısal ölçüyü toplama için ekle
        cube[key].push(r[measure]);
    });

    const table = rowKeys.map((rk) => {
        const row = { __rowKey: rk };
        colKeys.forEach((ck) => {
            const key = `${rk}__${ck}`;
            row[ck] = aggFn(cube[key] || []);
        });
        return row;
    });

    return { table, rowKeys, colKeys };
}

// Supabase'den çekilmesi gereken TABLOLAR ve View'ler
const AVAILABLE_TABLES = [
    // Birleşik View'ler (Supabase'de CREATE VIEW ile oluşturulmalıdır)
    { name: "sefer_view", display: "Seferler + Detayları (VIEW)", isView: true },
    { name: "tamamlanan_view", display: "Tamamlanan + Detayları (VIEW)", isView: true },
    // Tek Tablolar
    { name: "plakalar", display: "Plakalar (Tek Tablo)" },
    { name: "izinler", display: "İzinler (Tek Tablo)" },
    { name: "kesintiler", display: "Kesintiler (Tek Tablo)" },
    { name: "planlama", display: "Planlama (Tek Tablo)" },
    { name: "hamaliye", display: "Hamaliye (Tek Tablo)" },
    { name: "gorevler", display: "Görevler (Tek Tablo)" },
];


// Alan seçici bileşeni
function FieldList({ fields, onSelect, numericFields, allUsedDimensions, currentMeasure }) {
    const theme = useTheme();
    return (
        <Stack spacing={1.5} sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50], borderRadius: 3, maxHeight: 250, overflowY: 'auto' }}>
            <Typography variant="overline" fontWeight={700} color="text.primary">
                Sürükle-Bırak Alanları (Tıklayın)
            </Typography>
            {fields.length === 0 ? (
                <Typography variant="caption" sx={{ opacity: 0.7 }}>Seçili veri setinde alan bulunamadı.</Typography>
            ) : (
                fields.map((f) => {
                    const isNumeric = numericFields.includes(f);
                    const isUsed = allUsedDimensions.includes(f) || f === currentMeasure;

                    let chipColor = isNumeric ? 'success' : 'primary';
                    let labelText = f;

                    if (f === currentMeasure && isNumeric) {
                        labelText = `${f} (ÖLÇÜ - ${currentMeasure.toUpperCase()})`;
                    }

                    return (
                        <Chip
                            key={f}
                            label={labelText}
                            onClick={() => onSelect(f)}
                            color={chipColor}
                            variant={isUsed && f !== currentMeasure ? 'outlined' : 'filled'}
                            size="small"
                            sx={{
                                justifyContent: 'flex-start',
                                cursor: 'pointer',
                                transition: 'opacity 0.2s',
                                fontWeight: 500,
                                opacity: isUsed && !isNumeric ? 0.6 : 1,
                            }}
                            icon={isNumeric ? <ArrowCircleRightIcon fontSize="small" /> : undefined}
                            title={isNumeric ? "Tıklayın: Ölçü Alanı olarak ayarla" : "Tıklayın: Satır Boyutu olarak ata/kaldır"}
                        />
                    );
                })
            )}
        </Stack>
    );
}


export default function PivotTool() {
    const theme = useTheme();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [datasetName, setDatasetName] = useState("");

    // Veri setinden elde edilen alanlar
    const fields = useMemo(() => inferFields(rows), [rows]);
    const numericFields = useMemo(() => inferNumericFields(rows, fields), [rows, fields]);

    const [rowDims, setRowDims] = useState([]);
    const [colDims, setColDims] = useState([]);
    const [measure, setMeasure] = useState("");
    const [agg, setAgg] = useState("sum");
    const [chartType, setChartType] = useState("bar");

    // Supabase'den veri çekme işlevi (View entegrasyonu yapıldı)
    const fetchTableData = useCallback(async (tableName) => {
        if (!tableName) return;

        setLoading(true);
        setError(null);
        setRows([]);
        // Alanları temizle
        setRowDims([]); setColDims([]); setMeasure("");

        const tableInfo = AVAILABLE_TABLES.find(t => t.name === tableName);
        if (!tableInfo) return setError("Tanımlanamayan tablo adı.");

        try {
            // Supabase'den tablo/View adı ile çekiyoruz
            let query = supabase.from(tableName).select('*');

            // Limit uygulanır (Büyük veri setlerinde performans için)
            query = query.limit(2000);

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            setRows(data || []);

        } catch (err) {
            console.error("Supabase veri çekme hatası:", err);
            // Hata mesajını daha anlaşılır hale getirdik (Orijinal kodunuzdan)
            let userError = `Veri çekilemedi. Tablo/View adı ("${tableName}") doğru değil veya bağlantı hatası var.`;
            if (err.message && err.message.includes('relation') && err.message.includes('does not exist')) {
                userError = `HATA: '${tableName}' tablosu/View'i Supabase'de bulunamadı. Lütfen View'i oluşturun.`;
            } else if (err.message) {
                userError = `Veri çekme hatası: ${err.message}`;
            }
            setError(userError);
        } finally {
            setLoading(false);
        }
    }, []); // useCallback bağımlılıkları boş bırakıldı

    // Tablo adı değiştiğinde veriyi otomatik çek
    useEffect(() => {
        if (datasetName) {
            fetchTableData(datasetName);
        }
    }, [datasetName, fetchTableData]);


    // Alanlar yüklendikten sonra ilk varsayılanları ayarla
    useEffect(() => {
        if (fields.length > 0) {
            const newMeasure = numericFields[0] || "";
            setMeasure(newMeasure);

            // Sayısal olmayan ilk alanı satır boyutu olarak ayarla
            const firstDim = fields.find(f => f !== newMeasure && !numericFields.includes(f));
            setRowDims(firstDim ? [firstDim] : []);
        }
    }, [fields, numericFields]);


    const { table, colKeys } = useMemo(
        () => pivot({ rows, rowDims, colDims, measure, agg }),
        [rows, rowDims, colDims, measure, agg]
    );

    const chartData = useMemo(() => {
        if (chartType === 'pie') {
            if (colKeys.length > 1 || table.length === 0) return [];
            return table.map((r) => ({ name: r.__rowKey, value: r[colKeys[0]] }));
        }

        if (table.length === 0) return [];
        return table.map((r) => {
            const o = { group: r.__rowKey };
            colKeys.forEach((ck) => (o[ck] = r[ck]));
            return o;
        });
    }, [table, colKeys, chartType]);

    // Renk paleti oluştur
    const COLORS = [theme.palette.primary.main, theme.palette.secondary.main, theme.palette.error.main, theme.palette.warning.main, theme.palette.info.main, theme.palette.success.main];
    const getChartColor = (index) => COLORS[index % COLORS.length];

    // Alan seçme/sürükle-bırak simülasyon mantığı
    const handleFieldSelect = (field) => {
        if (loading || rows.length === 0) return;

        if (numericFields.includes(field)) {
            // Sayısal alan ise measure olarak ayarla (ve boyutlardan temizle)
            setMeasure(field);
            setRowDims(r => r.filter(d => d !== field));
            setColDims(c => c.filter(d => d !== field));
        } else {
            // Boyut alanı ise: Satır Dim'de yoksa ekle, varsa kaldır
            setRowDims(r => {
                if (r.includes(field)) {
                    // Satırda varsa kaldır
                    return r.filter(x => x !== field);
                } else {
                    // Kolonlarda varsa oradan al (taşıma simülasyonu)
                    if (colDims.includes(field)) {
                        setColDims(c => c.filter(x => x !== field));
                    }
                    // Satırda yoksa ekle
                    return [...r, field];
                }
            });
            // Ölçü alanında kalmasını engelle
            if (measure === field) setMeasure(numericFields[0] || "");
        }
    };

    // Sütun Boyutu çipinin tıklanma mantığı (Satır/Sütun arasında geçiş)
    const handleDimChipClick = (dim, currentList, setList, otherList, setOtherList) => {
        if (currentList.includes(dim)) {
            // Mevcut listeden çıkar
            setList(currentList.filter(x => x !== dim));
        } else {
            // Diğer listeden çıkar ve mevcut listeye ekle
            setOtherList(otherList.filter(x => x !== dim));
            setList([...currentList, dim]);
        }
    };


    // Kullanılan tüm boyut alanlarını topla (sadece boyutları)
    const allUsedDimensions = useMemo(() => [...rowDims, ...colDims], [rowDims, colDims]);

    // Pie Chart kısıtlaması için uyarı
    const pieWarning = chartType === 'pie' && colKeys.length > 1;


    return (
        <Box
            sx={{
                minHeight: "100dvh",
                py: { xs: 2, md: 4 },
                // Tema ayarlarından gelen arka plan gradyanı
                background: (t) =>
                    t.palette.mode === "dark"
                        ? "radial-gradient(1200px 600px at 10% -10%, rgba(56,189,248,0.18), transparent 60%), linear-gradient(180deg,#0b1020,#0e1428)"
                        : "radial-gradient(1200px 600px at 90% 110%, rgba(109,40,249,0.08), transparent 60%), linear-gradient(180deg,#f6f9ff,#f4f7ff)",
            }}
        >
            <Container maxWidth={false} sx={{ maxWidth: '1800px', p: 0 }}>
                <Box sx={{ display: "flex", gap: { xs: 2, md: 3 }, p: { xs: 2, md: 3 }, flexDirection: { xs: 'column', lg: 'row' } }}>

                    {/* Sol: KONTROL PANELİ */}
                    <Card
                        elevation={12}
                        sx={{
                            width: { xs: '100%', lg: 380 },
                            flexShrink: 0,
                            borderRadius: 4,
                            bgcolor: (t) => (t.palette.mode === 'dark' ? 'background.paper' : 'white')
                        }}
                    >
                        <CardContent>
                            <Typography
                                variant="h5"
                                fontWeight={900}
                                color="primary.main"
                                sx={{
                                    mb: 2, display: 'flex', alignItems: 'center', gap: 1,
                                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}
                            >
                                <SettingsIcon /> PIVOT ANALİZ ARACI
                            </Typography>

                            <Divider sx={{ mb: 2 }} />

                            {/* 1. TABLO SEÇİMİ (Supabase'den dinamik isimler) */}
                            <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <DatasetIcon fontSize="small" color="error" /> Kaynak Tablo ({rows.length} Kayıt)
                                <Tooltip title="Veriyi yeniden çek" placement="top">
                                    <Button onClick={() => fetchTableData(datasetName)} disabled={loading || !datasetName} size="small" sx={{ minWidth: 'auto', p: 0, ml: 'auto' }}>
                                        {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                                    </Button>
                                </Tooltip>
                            </Typography>

                            <FormControl fullWidth size="small" sx={{ mb: 3 }} disabled={loading}>
                                <InputLabel>Tablo Seçin</InputLabel>
                                <Select
                                    label="Tablo Seçin"
                                    value={datasetName || ''}
                                    onChange={(e) => setDatasetName(e.target.value)}
                                >
                                    {AVAILABLE_TABLES.map((t) => (
                                        <MenuItem key={t.name} value={t.name}>{t.display}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {error && <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>{error}</Alert>}

                            <Divider sx={{ my: 2 }} />

                            {/* 2. Alanlar ve Sürükle-Bırak Simülasyonu */}
                            <FieldList
                                fields={fields}
                                onSelect={handleFieldSelect}
                                numericFields={numericFields}
                                allUsedDimensions={allUsedDimensions}
                                currentMeasure={measure}
                            />

                            <Divider sx={{ my: 2 }} />

                            {/* 3. Satır/Sütun Atama Kontrolleri (Çip Atama) */}
                            <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <GridViewIcon fontSize="small" color="secondary" /> Boyut Atamaları
                            </Typography>

                            {/* Satır Boyutları Yöneticisi */}
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block', color: theme.palette.text.secondary }}>
                                    SATIR BOYUTLARI (Y Ekseni - {rowDims.length})
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ border: '2px dashed', borderColor: 'primary.light', p: 1, borderRadius: 1.5, minHeight: 45, bgcolor: 'primary.lightest' }}>
                                    {rowDims.map((d) => (
                                        <Chip
                                            key={d}
                                            label={d}
                                            // Tıklayınca Sütun boyutuna taşır. Silme tuşu ile tamamen kaldırır
                                            onClick={() => handleDimChipClick(d, rowDims, setRowDims, colDims, setColDims)}
                                            onDelete={() => setRowDims(r => r.filter(x => x !== d))}
                                            color="primary"
                                            variant="filled"
                                            size="small"
                                            title="Tıklayın: Sütun boyutuna taşı. X: Kaldır."
                                        />
                                    ))}
                                    {rowDims.length === 0 && <Typography variant="caption" sx={{ opacity: 0.6, p: 0.5 }}>Satır boyutu eklemek için soldan tıklayın</Typography>}
                                </Stack>
                            </Box>

                            {/* Sütun Boyutları Yöneticisi */}
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block', color: theme.palette.text.secondary }}>
                                    SÜTUN BOYUTLARI (Seri - {colDims.length})
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ border: '2px dashed', borderColor: 'secondary.light', p: 1, borderRadius: 1.5, minHeight: 45, bgcolor: 'secondary.lightest' }}>
                                    {colDims.map((d) => (
                                        <Chip
                                            key={d}
                                            label={d}
                                            // Tıklayınca Satır boyutuna taşır. Silme tuşu ile tamamen kaldırır
                                            onClick={() => handleDimChipClick(d, colDims, setColDims, rowDims, setRowDims)}
                                            onDelete={() => setColDims(c => c.filter(x => x !== d))}
                                            color="secondary"
                                            variant="filled"
                                            size="small"
                                            title="Tıklayın: Satır boyutuna taşı. X: Kaldır."
                                        />
                                    ))}
                                    {colDims.length === 0 && <Typography variant="caption" sx={{ opacity: 0.6, p: 0.5 }}>Sütun boyutu eklemek için tıklayın</Typography>}
                                </Stack>
                            </Box>

                            <Divider sx={{ my: 3 }} />

                            {/* 4. Ölçü ve Agregasyon Kontrolleri */}
                            <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
                                Ölçüm ve Agregasyon
                            </Typography>
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block', color: theme.palette.text.secondary }}>
                                    ÖLÇÜ ALANI (Measure)
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ border: '2px dashed', borderColor: 'success.light', p: 1, borderRadius: 1.5, minHeight: 45, bgcolor: 'success.lightest' }}>
                                    {measure ? (
                                        <Chip
                                            label={measure}
                                            color="success"
                                            variant="filled"
                                            size="small"
                                            onDelete={() => setMeasure(numericFields[0] || "")}
                                        />
                                    ) : (
                                        <Typography variant="caption" sx={{ opacity: 0.6, p: 0.5 }}>Ölçü alanını seçmek için soldan tıklayın</Typography>
                                    )}
                                </Stack>
                            </Box>


                            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                <InputLabel>Agregasyon Tipi</InputLabel>
                                <Select
                                    label="Agregasyon Tipi"
                                    value={agg}
                                    onChange={(e) => setAgg(e.target.value)}
                                >
                                    {Object.keys(aggregators).map((a) => (
                                        <MenuItem key={a} value={a}>{a.toUpperCase()}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Divider sx={{ my: 3 }} />

                            {/* 5. Grafik Tipi Seçimi */}
                            <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
                                Görselleştirme Tipi
                            </Typography>
                            {pieWarning && (
                                <Alert severity="warning" sx={{ mb: 1.5, py: 0.5, fontSize: 12 }}>
                                    Pasta grafiği için sütun boyutu (seri) seçilemez.
                                </Alert>
                            )}
                            <Stack direction="row" spacing={1}>
                                <Button
                                    variant={chartType === "bar" ? "contained" : "outlined"}
                                    onClick={() => setChartType("bar")}
                                    size="small"
                                    startIcon={<BarChartIcon />}
                                    color="secondary"
                                >
                                    Çubuk
                                </Button>
                                <Button
                                    variant={chartType === "line" ? "contained" : "outlined"}
                                    onClick={() => setChartType("line")}
                                    size="small"
                                    startIcon={<Timeline />}
                                    color="secondary"
                                >
                                    Çizgi
                                </Button>
                                <Button
                                    variant={chartType === "pie" ? "contained" : "outlined"}
                                    onClick={() => {
                                        setChartType("pie");
                                        if (colDims.length > 0) setColDims([]); // Pie seçilince sütun boyutunu sıfırla
                                    }}
                                    size="small"
                                    startIcon={<PieChartIcon />}
                                    color="secondary"
                                    disabled={colDims.length > 0} // Pie, Column Dim kullanıyorsa devre dışı
                                >
                                    Pasta
                                </Button>
                            </Stack>

                        </CardContent>
                    </Card>

                    {/* Sağ: PIVOT TABLO + GRAFİK */}
                    <Box sx={{
                        flex: 1,
                        display: "grid",
                        gridTemplateRows: { xs: 'auto', lg: 'minmax(240px, 40vh) 50vh' },
                        gap: { xs: 2, md: 3 },
                    }}>

                        {/* Pivot Tablo Görünümü */}
                        <Card elevation={12} sx={{ borderRadius: 4, height: '100%', minHeight: 250 }}>
                            <CardContent>
                                <Typography
                                    variant="h6"
                                    fontWeight={700}
                                    color="text.primary"
                                    sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <TableChart color="primary" /> Özet Tablo ({agg.toUpperCase()}: {measure || 'Seçilmedi'})
                                    <Chip label={datasetName || 'TABLO SEÇİN'} size="small" color="default" variant="outlined" sx={{ ml: 1, fontWeight: 600 }} />
                                </Typography>
                                <Box sx={{
                                    overflow: "auto",
                                    borderRadius: 1,
                                    border: "1px solid",
                                    borderColor: 'divider',
                                    maxHeight: { xs: 300, lg: 'calc(40vh - 80px)' }
                                }}>
                                    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", minWidth: 600 }}>
                                        <thead>
                                            <tr style={{ background: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.primary.lightest }}>
                                                <th style={{ textAlign: "left", padding: 10, fontWeight: 700, borderBottom: `2px solid ${theme.palette.divider}`, minWidth: 150, position: 'sticky', left: 0, zIndex: 2, background: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.primary.lightest }}>
                                                    {rowDims.length ? rowDims.join(" · ") : "Grup (Satır)"}
                                                </th>
                                                {colKeys.map((ck) => (
                                                    <th
                                                        key={ck}
                                                        style={{
                                                            textAlign: "right",
                                                            padding: 10,
                                                            fontWeight: 700,
                                                            borderLeft: `1px solid ${theme.palette.divider}`,
                                                            borderBottom: `2px solid ${theme.palette.divider}`,
                                                            minWidth: 100,
                                                        }}
                                                    >
                                                        {ck}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {table.map((r, i) => (
                                                <tr
                                                    key={i}
                                                    style={{
                                                        background: i % 2 === 0 ? (theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50]) : 'transparent',
                                                    }}
                                                >
                                                    <td style={{ padding: 10, borderTop: "1px solid #eee", fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, background: i % 2 === 0 ? (theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50]) : (theme.palette.mode === 'dark' ? theme.palette.background.paper : 'white') }}>
                                                        {r.__rowKey}
                                                    </td>
                                                    {colKeys.map((ck) => (
                                                        <td
                                                            key={ck}
                                                            style={{
                                                                padding: 10,
                                                                textAlign: "right",
                                                                borderTop: "1px solid #eee",
                                                                borderLeft: "1px solid #f5f5f5",
                                                                fontWeight: 500,
                                                                color: theme.palette.success.dark
                                                            }}
                                                        >
                                                            {/* Sayı formatını koru */}
                                                            {Number.isFinite(r[ck]) ? r[ck].toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : "-"}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {!datasetName && (
                                                <tr>
                                                    <td colSpan={colKeys.length + 1} style={{ textAlign: 'center', padding: 20, color: theme.palette.text.secondary }}>
                                                        Analiz etmek için lütfen sol panelden bir kaynak tablo seçiniz.
                                                    </td>
                                                </tr>
                                            )}
                                            {datasetName && rows.length === 0 && !loading && (
                                                <tr>
                                                    <td colSpan={colKeys.length + 1} style={{ textAlign: 'center', padding: 20, color: theme.palette.text.secondary }}>
                                                        Seçilen '{datasetName}' tablosunda veri bulunamadı.
                                                    </td>
                                                </tr>
                                            )}
                                            {loading && (
                                                <tr>
                                                    <td colSpan={colKeys.length + 1} style={{ textAlign: 'center', padding: 20, color: theme.palette.text.secondary }}>
                                                        <CircularProgress size={24} /> Veriler yükleniyor...
                                                    </td>
                                                </tr>
                                            )}
                                            {datasetName && rows.length > 0 && table.length === 0 && !loading && (
                                                <tr>
                                                    <td colSpan={colKeys.length + 1} style={{ textAlign: 'center', padding: 20, color: theme.palette.text.secondary }}>
                                                        Pivot tablo oluşturmak için lütfen boyutları ve ölçü alanını seçiniz.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Grafik Görünümü */}
                        <Card elevation={12} sx={{ borderRadius: 4, minHeight: 350 }}>
                            <CardContent>
                                <Typography
                                    variant="h6"
                                    fontWeight={700}
                                    color="text.primary"
                                    sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    {chartType === 'bar' && <BarChartIcon color="primary" />}
                                    {chartType === 'line' && <Timeline color="primary" />}
                                    {chartType === 'pie' && <PieChartIcon color="primary" />}
                                    {chartType.toUpperCase()} GÖRSELLEŞTİRME
                                </Typography>
                                <Divider sx={{ mb: 2 }} />

                                <Box sx={{ width: "100%", height: 320 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        {chartData.length === 0 ? (
                                            <Box display="flex" justifyContent="center" alignItems="center" height="100%" sx={{ opacity: 0.6 }}>
                                                <Typography>Grafik oluşturmak için yeterli veri yok.</Typography>
                                            </Box>
                                        ) : (
                                            <>
                                                {chartType === "bar" && (
                                                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                                        <XAxis dataKey="group" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} height={40} tickLine={false} axisLine={false} />
                                                        <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} tickLine={false} axisLine={false} />
                                                        <RechartsTooltip contentStyle={{ borderRadius: 8, background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }} />
                                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                                        {colKeys.map((ck, idx) => (
                                                            <Bar key={ck} dataKey={ck} fill={getChartColor(idx)} radius={[4, 4, 0, 0]} />
                                                        ))}
                                                    </BarChart>
                                                )}
                                                {chartType === "line" && (
                                                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                                        <XAxis dataKey="group" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} height={40} tickLine={false} axisLine={false} />
                                                        <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} tickLine={false} axisLine={false} />
                                                        <RechartsTooltip contentStyle={{ borderRadius: 8, background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }} />
                                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                                        {colKeys.map((ck, idx) => (
                                                            <Line key={ck} type="monotone" dataKey={ck} stroke={getChartColor(idx)} dot={{ r: 4 }} activeDot={{ r: 8 }} strokeWidth={2} />
                                                        ))}
                                                    </LineChart>
                                                )}
                                                {chartType === "pie" && (
                                                    <PieChart>
                                                        <RechartsTooltip formatter={(value) => value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} />
                                                        <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="bottom" align="center" layout="horizontal" />
                                                        <Pie
                                                            data={chartData}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            outerRadius={100}
                                                            labelLine={true}
                                                            label={(entry) => entry.name.length > 20 ? entry.name.substring(0, 20) + '...' : entry.name}
                                                            paddingAngle={3}
                                                            cx="50%"
                                                            cy="50%"

                                                        >
                                                            {chartData.map((_, idx) => (
                                                                <Cell key={`cell-${idx}`} fill={getChartColor(idx)} />
                                                            ))}
                                                        </Pie>
                                                    </PieChart>
                                                )}
                                            </>
                                        )}
                                    </ResponsiveContainer>
                                </Box>
                            </CardContent>
                        </Card>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
