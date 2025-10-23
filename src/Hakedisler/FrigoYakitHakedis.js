import React, { useState, useEffect, useCallback } from "react";
import {
    Box,
    Stack,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Alert,
    Grid,
    Divider,
    Chip,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
} from "@mui/material";
import { alpha } from "@mui/system";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FilterDramaIcon from "@mui/icons-material/FilterDrama";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

// =========================================================================================
// !!! GEREKLİ KÜTÜPHANE IMPORTLARI (Paketleri yüklediğiniz varsayılmıştır)
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// SUPABASE MOCK (GERÇEK BAĞLANTINIZLA DEĞİŞTİRİN)
const supabase = {
    from: (table) => ({
        delete: () => ({ neq: () => Promise.resolve({ error: null }) }),
        insert: (data) => Promise.resolve({ error: null }),
    }),
};
// =========================================================================================

/* ------------------------ Koyu Tema Renkleri ------------------------ */
const DARK = {
    pageBg: "#121212",
    surface: "#1E1E1E",
    surface2: "#2A2A2A",
    border: "#3A3A3A",
    text: "#E0E0E0",
    textMuted: "#A0A0A0",
    zebra: "#252525",
    primary: "#BB86FC", // Mor
    mint: "#03DAC6", // Mint/Cyan
    red: "#CF6679", // Kırmızı
};

/* ------------------------ Yardımcı Formatlayıcılar ------------------- */
const formatNumber = (value) =>
    new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
    }).format(value);

const formatCurrency = (value) =>
    new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
    }).format(value);

const roundToDecimal = (num, decimals = 4) => {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
};


const StatCard = ({ label, value, tone = "default", formatter = formatNumber }) => {
    const palette =
        tone === "success"
            ? { bg: alpha(DARK.mint, 0.15), fg: DARK.mint, bd: alpha(DARK.mint, 0.35) }
            : tone === "danger"
                ? { bg: alpha(DARK.red, 0.15), fg: DARK.red, bd: alpha(DARK.red, 0.35) }
                : { bg: DARK.surface2, fg: DARK.text, bd: DARK.border };

    return (
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                flex: 1,
                minWidth: 200,
                borderRadius: 2,
                bgcolor: palette.bg,
                color: palette.fg,
                borderColor: palette.bd,
            }}
        >
            <Typography variant="body2" color={DARK.textMuted} mb={0.5}>
                {label}
            </Typography>
            <Typography variant="h6" fontWeight={800} sx={{ color: palette.fg }}>
                {formatter(value)}
            </Typography>
        </Paper>
    );
};

/* ------------------------ İlerleme Durumu Bileşeni ------------------- */
const ProgressStep = ({ step, currentStep, description, icon }) => {
    const isActive = step === currentStep;
    const isCompleted = step < currentStep;

    const color = isCompleted ? DARK.mint : isActive ? DARK.primary : DARK.textMuted;
    const IconComponent = isCompleted ? CheckCircleIcon : isActive ? RotateRightIcon : icon;

    return (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ opacity: isCompleted || isActive ? 1 : 0.6 }}>
            <Box sx={{ position: 'relative', width: 24, height: 24 }}>
                {isActive ? (
                    <CircularProgress size={24} sx={{ color: color }} />
                ) : (
                    <IconComponent sx={{ color: color, fontSize: 24 }} />
                )}
            </Box>
            <Typography
                variant="body1"
                fontWeight={isActive ? 700 : 400}
                color={isActive ? DARK.text : isCompleted ? DARK.text : DARK.textMuted}
            >
                {description}
            </Typography>
        </Stack>
    );
};

/* ------------------------ Plaka KM Detay Listesi Bileşeni ------------------- */
const PlakaKmList = ({ kmMap, showCalculation = 1 }) => {
    if (!kmMap || Object.keys(kmMap).length === 0) return null;

    const kmList = Object.entries(kmMap).map(([plaka, data]) => ({ plaka, ...data }));

    const isStep2 = showCalculation === 2; // Tahmini Tüketim
    const isStep3 = showCalculation === 3; // Fark ve Maliyet (YALNIZCA İSTENEN 4 SÜTUN)

    // Sütun başlıkları ve genişlikleri ayarlanıyor
    let title = "Kilometre Dağılımı (KM)";
    let headers = [
        { label: "Plaka", key: "plaka", color: DARK.mint, xs: 3 },
        { label: "SEFER KM", key: "SFR_KM", color: DARK.textMuted, xs: 3 },
        { label: "BOŞ KM", key: "BOS_KM", color: DARK.textMuted, xs: 3 },
        { label: "TOPLAM KM", key: "TOPLAM_KM", color: DARK.text, xs: 3 },
    ];

    if (isStep2) {
        title = "Plaka Bazlı Tahmini Tüketim (Litre)";
        headers = [
            { label: "Plaka", key: "plaka", color: DARK.mint, xs: 3 },
            { label: "SFR Tüketim (L)", key: "SFR_TUKETIM", color: DARK.primary, xs: 3 },
            { label: "BOŞ Tüketim (L)", key: "BOS_TUKETIM", color: DARK.primary, xs: 3 },
            { label: "TOPLAM Tüketim (L)", key: "TOPLAM_TUKETIM", color: DARK.mint, xs: 3 },
        ];
    } else if (isStep3) {
        title = "Plaka Bazlı Tahmini Tüketim / Gerçek Yakıt Fark Analizi";
        // Kullanıcının istediği 4 sütun
        headers = [
            { label: "Plaka", key: "plaka", color: DARK.mint, xs: 3 },
            { label: "TAHMİNİ TÜKETİM (L)", key: "TOPLAM_TUKETIM", color: DARK.mint, xs: 3 },
            { label: "TOPLAM YAKIT (L)", key: "TOPLAM_YAKIT_LITRESI", color: DARK.primary, xs: 3 },
            { label: "FARK (Tah. Tük. - Yakıt)", key: "TOPLAM_KM_VE_LITRE_FARKI", color: DARK.red, xs: 3 },
        ];
    }


    return (
        <Box
            sx={{
                mt: 1.5,
                maxHeight: 250,
                overflowY: 'auto',
                p: 1,
                bgcolor: DARK.surface,
                borderRadius: 1,
                border: `1px solid ${DARK.border}`
            }}
        >
            <Typography variant="body2" fontWeight={700} color={DARK.text} mb={1}>
                {title}:
            </Typography>
            <Grid container spacing={1} sx={{ bgcolor: DARK.surface2, p: 1, borderRadius: 1 }}>
                {headers.map((h) => (
                    <Grid item xs={h.xs} key={h.key}>
                        <Typography variant="caption" fontWeight={700} color={h.color}>
                            {h.label}
                        </Typography>
                    </Grid>
                ))}
            </Grid>
            <Stack spacing={0.5} mt={0.5}>
                {kmList.map((data) => {
                    const totalKm = data.SFR_KM + data.BOS_KM;
                    const diff = data.TOPLAM_KM_VE_LITRE_FARKI;
                    const diffColor = diff >= 0 ? DARK.mint : DARK.red;

                    return (
                        <Grid container key={data.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                            {/* Plaka (Her zaman ilk sütun) */}
                            <Grid item xs={headers[0].xs}><Typography variant="caption" color={DARK.text}>{data.plaka}</Typography></Grid>

                            {/* AŞAMA 1 - KM BÖLÜMÜ */}
                            {showCalculation === 1 && (
                                <>
                                    {/* SEFER KM */}
                                    <Grid item xs={headers[1].xs}><Typography variant="caption" color={DARK.textMuted}>{formatNumber(data.SFR_KM)}</Typography></Grid>
                                    {/* BOŞ KM */}
                                    <Grid item xs={headers[2].xs}><Typography variant="caption" color={DARK.textMuted}>{formatNumber(data.BOS_KM)}</Typography></Grid>
                                    {/* TOPLAM KM (Vurgulu) */}
                                    <Grid item xs={headers[3].xs}><Typography variant="caption" fontWeight={700} color={DARK.text}>{formatNumber(totalKm)}</Typography></Grid>
                                </>
                            )}

                            {/* AŞAMA 2 - TÜKETİM BÖLÜMÜ */}
                            {isStep2 && (
                                <>
                                    {/* SFR Tüketim */}
                                    <Grid item xs={headers[1].xs}><Typography variant="caption" color={DARK.primary}>{formatNumber(data.SFR_TUKETIM)}</Typography></Grid>
                                    {/* BOŞ Tüketim */}
                                    <Grid item xs={headers[2].xs}><Typography variant="caption" color={DARK.primary}>{formatNumber(data.BOS_TUKETIM)}</Typography></Grid>
                                    {/* TOPLAM Tüketim */}
                                    <Grid item xs={headers[3].xs}><Typography variant="caption" fontWeight={700} color={DARK.mint}>{formatNumber(data.TOPLAM_TUKETIM)}</Typography></Grid>
                                </>
                            )}

                            {/* AŞAMA 3 - FARK BÖLÜMÜ (YENİ 4 SÜTUN) */}
                            {isStep3 && (
                                <>
                                    {/* TAHMİNİ TÜKETİM (L) */}
                                    <Grid item xs={headers[1].xs}>
                                        <Typography variant="caption" fontWeight={700} color={DARK.mint}>
                                            {formatNumber(data.TOPLAM_TUKETIM)}
                                        </Typography>
                                    </Grid>

                                    {/* TOPLAM YAKIT (L) */}
                                    <Grid item xs={headers[2].xs}>
                                        <Typography variant="caption" color={DARK.primary}>
                                            {formatNumber(data.TOPLAM_YAKIT_LITRESI)}
                                        </Typography>
                                    </Grid>

                                    {/* FARK (Tah. Tük. - Yakıt) */}
                                    <Grid item xs={headers[3].xs}>
                                        <Typography variant="caption" fontWeight={700} color={diffColor}>
                                            {formatNumber(diff)}
                                        </Typography>
                                    </Grid>
                                </>
                            )}
                        </Grid>
                    );
                })}
            </Stack>
        </Box>
    );
};

/* ------------------------ Plaka Bazlı Düzeltme Maliyeti Listesi Bileşeni ------------------- */
const PlakaHakedisList = ({ kmMap }) => {
    if (!kmMap || Object.keys(kmMap).length === 0) return null;

    // Sadece DUZELTME_MALIYETI (Hakediş/Ceza) bilgisi olanları filtrele ve listeye çevir
    const hakedisList = Object.entries(kmMap)
        .filter(([, data]) => data.DUZELTME_MALIYETI !== undefined && data.DUZELTME_MALIYETI !== 0)
        .map(([plaka, data]) => ({
            plaka,
            DUZELTME_MALIYETI: data.DUZELTME_MALIYETI,
            TOPLAM_KM_VE_LITRE_FARKI: data.TOPLAM_KM_VE_LITRE_FARKI,
        }));

    if (hakedisList.length === 0) return (
        <Alert severity="info" sx={{ mt: 1, mb: 1, bgcolor: alpha(DARK.primary, 0.1), color: DARK.text }}>
            Düzeltme Maliyeti / Performans Hakedişi hesaplanan plaka bulunamadı.
        </Alert>
    );

    return (
        <Box
            sx={{
                mt: 1.5,
                maxHeight: 250,
                overflowY: 'auto',
                p: 1,
                bgcolor: DARK.surface,
                borderRadius: 1,
                border: `1px solid ${DARK.border}`
            }}
        >
            <Typography variant="body2" fontWeight={700} color={DARK.text} mb={1}>
                Plaka Bazlı Düzeltme Maliyeti / Hakediş Rakamları (TL) 💰:
            </Typography>
            <Grid container spacing={1} sx={{ bgcolor: DARK.surface2, p: 1, borderRadius: 1 }}>
                <Grid item xs={6}>
                    <Typography variant="caption" fontWeight={700} color={DARK.mint}>
                        Plaka
                    </Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" fontWeight={700} color={DARK.primary}>
                        Düzeltme Maliyeti / Hakediş (TL)
                    </Typography>
                </Grid>
            </Grid>
            <Stack spacing={0.5} mt={0.5}>
                {hakedisList.map((data) => {
                    const maliyet = data.DUZELTME_MALIYETI;
                    const diff = data.TOPLAM_KM_VE_LITRE_FARKI;

                    // fark > 0 ise Prim (Mint), fark < 0 ise Ceza/Maliyet (Red)
                    const listColor = diff >= 0 ? DARK.mint : DARK.red;
                    const label = diff >= 0 ? "PRİM Hakedişi" : "FAZLA YAKIT Maliyeti";

                    // Ceza durumunda (diff < 0), maliyeti negatif yaparak formatlayıcı ile eksi (-) işaretini gösteriyoruz.
                    const finalMaliyet = diff < 0 ? -maliyet : maliyet;
                    const formattedMaliyet = formatCurrency(finalMaliyet);

                    return (
                        <Grid container key={data.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                            <Grid item xs={6}>
                                <Typography variant="caption" fontWeight={700} color={listColor}>
                                    {data.plaka}
                                </Typography>
                            </Grid>
                            <Grid item xs={6} sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" fontWeight={700} color={listColor}>
                                    {formattedMaliyet} ({label})
                                </Typography>
                            </Grid>
                        </Grid>
                    );
                })}
            </Stack>
        </Box>
    );
};

/* ------------------------ Plaka Bazlı Sefer Hakedişleri Listesi ------------------- */
const SeferHakedisList = ({ kmMap, seferRows }) => {
    if (!kmMap || Object.keys(kmMap).length === 0 || !seferRows || seferRows.length === 0) return null;

    // 1. Düzeltme Maliyeti olan plakaları ve KM/TL oranlarını al
    const hakedisMap = Object.entries(kmMap)
        .filter(([, data]) => data.DUZELTME_MALIYETI !== undefined && data.DUZELTME_MALIYETI !== 0)
        .reduce((acc, [plaka, data]) => {
            const maliyet = data.TOPLAM_KM_VE_LITRE_FARKI < 0 ? -data.DUZELTME_MALIYETI : data.DUZELTME_MALIYETI;
            const toplamKm = data.SFR_KM + data.BOS_KM;
            // KM'ye bölünecek işaretli TL/KM değeri
            const rawMaliyetPerKm = toplamKm > 0 ? maliyet / toplamKm : 0;
            // HASSASİYET DÜZELTMESİ: Oranı 4 ondalık basamağa yuvarla
            const maliyetPerKm = roundToDecimal(rawMaliyetPerKm, 4);

            acc[plaka] = {
                maliyet: maliyet, // İşaretli Toplam Maliyet
                toplamKm: toplamKm,
                maliyetPerKm: maliyetPerKm // İşaretli TL/KM oranı
            };
            return acc;
        }, {});

    const finalHakedisList = Object.entries(hakedisMap)
        .map(([plaka, data]) => ({
            plaka,
            toplamKm: data.toplamKm,
            maliyet: data.maliyet,
            maliyetPerKm: data.maliyetPerKm,
        }))
        .filter(data => data.toplamKm > 0); // KM'si sıfır olanları hariç tut

    if (finalHakedisList.length === 0) return (
        <Alert severity="warning" sx={{ mt: 1, mb: 1, bgcolor: alpha(DARK.red, 0.1), color: DARK.text }}>
            Hakedişi olan plakalar için Sefer/KM kaydı bulunamadı.
        </Alert>
    );

    return (
        <Box
            sx={{
                mt: 1.5,
                maxHeight: 250,
                overflowY: 'auto',
                p: 1,
                bgcolor: DARK.surface,
                borderRadius: 1,
                border: `1px solid ${DARK.border}`
            }}
        >
            <Typography variant="body2" fontWeight={700} color={DARK.text} mb={1}>
                Plaka Bazlı Maliyet Dağılımı Oranı (TL/KM):
            </Typography>
            <Grid container spacing={1} sx={{ bgcolor: DARK.surface2, p: 1, borderRadius: 1 }}>
                <Grid item xs={3}>
                    <Typography variant="caption" fontWeight={700} color={DARK.mint}>Plaka</Typography>
                </Grid>
                <Grid item xs={3} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" fontWeight={700} color={DARK.textMuted}>Toplam KM</Typography>
                </Grid>
                <Grid item xs={3} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" fontWeight={700} color={DARK.primary}>Düzeltme Maliyeti (TL)</Typography>
                </Grid>
                <Grid item xs={3} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" fontWeight={700} color={DARK.mint}>Maliyet / KM (TL)</Typography>
                </Grid>
            </Grid>
            <Stack spacing={0.5} mt={0.5}>
                {finalHakedisList.map((data) => {
                    const isPositive = data.maliyet >= 0;
                    const color = isPositive ? DARK.mint : DARK.red;

                    return (
                        <Grid container key={data.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                            <Grid item xs={3}>
                                <Typography variant="caption" fontWeight={700} color={color}>
                                    {data.plaka}
                                </Typography>
                            </Grid>
                            <Grid item xs={3} sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" color={DARK.textMuted}>
                                    {formatNumber(data.toplamKm)}
                                </Typography>
                            </Grid>
                            <Grid item xs={3} sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" fontWeight={700} color={color}>
                                    {formatCurrency(data.maliyet)}
                                </Typography>
                            </Grid>
                            <Grid item xs={3} sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" fontWeight={700} color={color}>
                                    {formatCurrency(data.maliyetPerKm)}
                                </Typography>
                            </Grid>
                        </Grid>
                    );
                })}
            </Stack>
        </Box>
    );
};

/* ------------------------ Sefer Bazlı Maliyet Dağılımı Listesi ------------------- */
const SeferMaliyetDagilimi = ({ kmMap, seferRows }) => {
    if (!kmMap || Object.keys(kmMap).length === 0 || !seferRows || seferRows.length === 0) return null;

    // 1. Maliyet/KM değerlerini plakaya göre hazırla (4 ondalık basamağa yuvarlanmış)
    const maliyetPerKmMap = Object.entries(kmMap)
        .filter(([, data]) => data.DUZELTME_MALIYETI !== undefined && data.DUZELTME_MALIYETI !== 0)
        .reduce((acc, [plaka, data]) => {
            const maliyet = data.TOPLAM_KM_VE_LITRE_FARKI < 0 ? -data.DUZELTME_MALIYETI : data.DUZELTME_MALIYETI;
            const toplamKm = data.SFR_KM + data.BOS_KM;
            const maliyetPerKm = toplamKm > 0 ? roundToDecimal(maliyet / toplamKm, 4) : 0;
            acc[plaka] = maliyetPerKm; // İşaretli TL/KM değeri
            return acc;
        }, {});

    const relevantPlates = Object.keys(maliyetPerKmMap);

    if (relevantPlates.length === 0) return (
        <Alert severity="info" sx={{ mt: 1, mb: 1, bgcolor: alpha(DARK.primary, 0.1), color: DARK.text }}>
            Maliyet/Hakediş hesaplanan plaka bulunamadı. Seferlere dağıtım yapılamıyor.
        </Alert>
    );

    // 2. Her bir sefere maliyet/km değerini dağıt
    const seferMaliyetList = seferRows
        .map(row => {
            const plaka = row.plaka?.toUpperCase();
            const km = row.toplam_km || 0;
            const seferNo = row.sefer_no || 'TANIMSIZ_SEFER';

            const maliyetPerKm = maliyetPerKmMap[plaka] || 0;

            // Hesaplama: Sefer Maliyeti = Toplam KM * (Maliyet / KM)
            // HASSASİYET DÜZELTMESİ: Sonucu da 4 ondalık basamağa yuvarla
            const seferMaliyeti = roundToDecimal(km * maliyetPerKm, 4);

            if (seferMaliyeti === 0) return null; // Sıfır maliyetlileri gösterme

            return {
                seferNo,
                plaka,
                toplamKm: km,
                seferMaliyeti: seferMaliyeti,
            };
        })
        .filter(item => item !== null)
        .sort((a, b) => (b.seferMaliyeti - a.seferMaliyeti));

    if (seferMaliyetList.length === 0) return (
        <Alert severity="warning" sx={{ mt: 1, mb: 1, bgcolor: alpha(DARK.red, 0.1), color: DARK.text }}>
            Hiçbir sefere dağıtılacak Maliyet/Hakediş bulunamadı (KM kayıtları 0 olabilir).
        </Alert>
    );

    return (
        <Box
            sx={{
                mt: 1.5,
                maxHeight: 250,
                overflowY: 'auto',
                p: 1,
                bgcolor: DARK.surface,
                borderRadius: 1,
                border: `1px solid ${DARK.border}`
            }}
        >
            <Typography variant="body2" fontWeight={700} color={DARK.text} mb={1}>
                Sefer Bazlı Maliyet Dağılımı (Prim/Ceza):
            </Typography>
            <Grid container spacing={1} sx={{ bgcolor: DARK.surface2, p: 1, borderRadius: 1 }}>
                <Grid item xs={3}>
                    <Typography variant="caption" fontWeight={700} color={DARK.mint}>Sefer No</Typography>
                </Grid>
                <Grid item xs={3}>
                    <Typography variant="caption" fontWeight={700} color={DARK.textMuted}>Plaka (KM)</Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" fontWeight={700} color={DARK.primary}>Sefer Maliyeti (TL)</Typography>
                </Grid>
            </Grid>
            <Stack spacing={0.5} mt={0.5}>
                {seferMaliyetList.map((data, index) => {
                    const isPositive = data.seferMaliyeti >= 0;
                    const color = isPositive ? DARK.mint : DARK.red;
                    const label = isPositive ? "Prim" : "Ceza";

                    return (
                        <Grid container key={data.seferNo + index} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                            <Grid item xs={3}>
                                <Typography variant="caption" color={color} fontWeight={700}>
                                    {data.seferNo}
                                </Typography>
                            </Grid>
                            <Grid item xs={3}>
                                <Typography variant="caption" color={DARK.textMuted}>
                                    {/* KM değeri küsuratsız (tam sayı) olarak gösteriliyor. */}
                                    {data.plaka} ({Math.round(data.toplamKm)})
                                </Typography>
                            </Grid>
                            <Grid item xs={6} sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" fontWeight={700} color={color}>
                                    {formatCurrency(data.seferMaliyeti)} ({label})
                                </Typography>
                            </Grid>
                        </Grid>
                    );
                })}
            </Stack>
        </Box>
    );
};


/* ------------------------ Yardımcı Dönüştürücüler ------------------- */
const toIntOrNull = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const s = String(v).trim().replace(",", ".");
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
};

const toNumOrNull = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const s = String(v).trim().replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

const toStrOrNull = (v) => {
    const s = String(v ?? "").trim();
    return s || null;
};

/* ------------------------ Gerçek Excel Okuma (ExcelJS Kullanarak) ------------------------------- */
const readXlsxFile = async (file) => {
    if (!ExcelJS) throw new Error("ExcelJS kütüphanesi yüklenmemiş.");

    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    const rows = [];
    let rawHeaders = [];

    // 1. Başlıkları Oku (İlk Satır)
    const headerRow = worksheet.getRow(1);
    if (!headerRow) throw new Error("Dosya boş veya başlık satırı okunamadı.");

    headerRow.eachCell((cell) => {
        rawHeaders.push(String(cell.value ?? "").trim());
    });

    // İşleme için kullanılan küçük harfli, alt çizgi ile ayrılmış anahtarları oluştur
    const processedHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9_ğüşöçıİ]/g, '_'));

    // 2. Veri Satırlarını Oku (2. Satırdan Başlayarak)
    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const rowData = {};
        let isRowEmpty = true;

        rawHeaders.forEach((rawHeader, index) => {
            if (!rawHeader) return;

            const cell = row.getCell(index + 1);
            let value = cell.value;

            if (typeof value === 'object' && value !== null) {
                if (value.text) {
                    value = value.text;
                } else if (value instanceof Date) {
                    value = value.toISOString();
                } else if (value.result !== undefined) {
                    value = value.result;
                }
            }

            const processedKey = processedHeaders[index];

            rowData[processedKey] = value;

            if (value !== null && value !== undefined && String(value).trim() !== "") {
                isRowEmpty = false;
            }
        });

        if (!isRowEmpty) {
            rows.push(rowData);
        }
    }

    return { headers: processedHeaders, rows };
};


/* ------------------------ Gerçek Supabase Batch Insert ------------------- */
const insertBatched = async (table, rows, batchSize = 500) => {
    let errorCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const { error } = await supabase
            .from(table)
            .insert(batch);

        if (error) {
            console.error(`Batch insert error for table ${table} (Batch ${i / batchSize}):`, error);
            errorCount++;
        }
    }

    if (errorCount > 0) {
        throw new Error(`${errorCount} batch'te kayıt hatası oluştu. Konsolu ve Sunucu loglarını kontrol edin.`);
    }
};


/* ------------------------ Şablon İndiriciler ------------------------ */
const downloadXlsxTemplate = async (fileName, sheetName, headers, sampleRows) => {
    if (!ExcelJS || !saveAs) return console.error("ExcelJS veya file-saver kütüphanesi yüklenmemiş.");
    console.log(`Downloading template: ${fileName}`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // DEĞİŞTİ: Başlıkları dosyaya küçük harf olarak yaz (TR duyarlı)
    worksheet.columns = headers.map(h => {
        const headerLower = String(h).toLocaleLowerCase('tr-TR');            // <-- küçük harfe zorlama
        return {
            header: headerLower,                                             // <-- dosyaya yazılan başlık
            key: headerLower.replace(/[^a-z0-9_ğüşöçıö]/gi, '_'),            // <-- key de uyumlu
            width: 22
        };
    });

    sampleRows.forEach(r => worksheet.addRow(r));

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
};

// =========================================================================================
// YAKIT ŞABLONU İNDİR (İstenen sıra ve Büyük Harf ile güncellendi)
// =========================================================================================
const downloadYakitTemplate = async () => {
    await downloadXlsxTemplate(
        "frigo_yakit_sablon.xlsx",
        "Yakıt Şablonu",
        [
            "plaka",
            "cari_id",
            "cari_adi",
            "iskontosuz_birim_fiyat",
            "birim_fiyat",
            "yakit_litresi",
        ],
        [
            ["34ABC34", 123456, "Örnek Cari", 45.0000, 44.9123, 250.5555],
            ["41XYZ41", 222222, "Başka Cari", 44.0000, 43.5678, 180.0000],
        ]
    );
};

// =========================================================================================
// SEFER ŞABLONU İNDİR (İstenen sıra ve Büyük Harf ile güncellendi)
// =========================================================================================
const downloadSeferTemplate = async () => {
    await downloadXlsxTemplate(
        "frigo_sefer_sablon.xlsx",
        "Sefer Şablonu",
        ["sefer_no", "tms_despatch_id", "plaka", "toplam_km"],
        [
            ["S1001", 987654321, "34ABC34", 860.3333],
            ["S1002", 987654322, "41XYZ41", 540.0000],
            ["BOS1003", 987654323, "34ABC34", 50.0000],
        ]
    );
};

// =========================================================================================
// MEVCUT EXCEL İNDİRME FONKSİYONU: SEFER HAKEDİŞ DETAYLARI
// =========================================================================================
const downloadSeferHakedisleri = async (kmMap, seferRows, setSnackbar) => {
    if (!ExcelJS || !saveAs) {
        setSnackbar({ open: true, message: "ExcelJS veya file-saver kütüphanesi yüklenmemiş.", severity: "error" });
        return;
    }
    if (!kmMap || Object.keys(kmMap).length === 0 || !seferRows || seferRows.length === 0) {
        setSnackbar({ open: true, message: "Hesaplama verisi bulunamadı. Lütfen hesaplamayı tamamlayın.", severity: "warning" });
        return;
    }

    try {
        setSnackbar({ open: true, message: "Sefer Hakedişleri Excel'i hazırlanıyor...", severity: "info" });

        // 1. Maliyet/KM değerlerini plakaya göre hazırla (4 ondalık basamağa yuvarlanmış)
        const maliyetPerKmMap = Object.entries(kmMap)
            .filter(([, data]) => data.DUZELTME_MALIYETI !== undefined && data.DUZELTME_MALIYETI !== 0)
            .reduce((acc, [plaka, data]) => {
                const maliyet = data.TOPLAM_KM_VE_LITRE_FARKI < 0 ? -data.DUZELTME_MALIYETI : data.DUZELTME_MALIYETI;
                const toplamKm = data.SFR_KM + data.BOS_KM;
                const maliyetPerKm = toplamKm > 0 ? roundToDecimal(maliyet / toplamKm, 4) : 0;
                acc[plaka] = maliyetPerKm;
                return acc;
            }, {});

        // 2. Her bir sefere maliyet/km değerini dağıt ve nihai listeyi oluştur
        const dataForExcel = seferRows.map(row => {
            const plaka = row.plaka?.toUpperCase();
            const km = row.toplam_km || 0;
            const maliyetPerKm = maliyetPerKmMap[plaka] || 0;

            // Hesaplama: Sefer Maliyeti = Toplam KM * (Maliyet / KM)
            const seferMaliyeti = roundToDecimal(km * maliyetPerKm, 4);

            return {
                sefer_no: row.sefer_no,
                tms_despatch_id: row.tms_despatch_id,
                plaka: row.plaka,
                toplam_km: row.toplam_km,
                sefer_hakedisi_tl: seferMaliyeti, // YENİ SÜTUN: SEFER HAKEDİŞİ
            };
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sefer Hakediş Detayları');

        // Başlıkları ayarla 
        worksheet.columns = [
            { header: 'SEFER NO', key: 'sefer_no', width: 15 },
            { header: 'TMS DESPATCH ID', key: 'tms_despatch_id', width: 18 },
            { header: 'PLAKA', key: 'plaka', width: 12 },
            { header: 'TOPLAM KM', key: 'toplam_km', width: 15, style: { numFmt: '0.0000' } },
            { header: 'SEFER HAKEDİŞİ (TL)', key: 'sefer_hakedisi_tl', width: 25, style: { numFmt: '₺#,##0.0000;[Red]-₺#,##0.0000' } },
        ];

        // Veri satırlarını ekle
        worksheet.addRows(dataForExcel);

        // İndirme işlemi
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'sefer_hakedis_detaylari.xlsx');

        setSnackbar({ open: true, message: "Sefer Hakedişleri Excel dosyası başarıyla indirildi.", severity: "success" });

    } catch (error) {
        console.error("Excel indirme hatası:", error);
        setSnackbar({ open: true, message: error.message || "Excel dosyası oluşturulurken hata oluştu.", severity: "error" });
    }
};

// =========================================================================================
// YENİ EXCEL İNDİRME FONKSİYONU: ÖZET DATA
// =========================================================================================
const downloadOzetData = async (kmMap, yakitRows, setSnackbar) => {
    if (!ExcelJS || !saveAs) {
        setSnackbar({ open: true, message: "ExcelJS veya file-saver kütüphanesi yüklenmemiş.", severity: "error" });
        return;
    }
    if (!kmMap || Object.keys(kmMap).length === 0 || !yakitRows || yakitRows.length === 0) {
        setSnackbar({ open: true, message: "Hesaplama verisi bulunamadı. Lütfen hesaplamayı tamamlayın.", severity: "warning" });
        return;
    }

    try {
        setSnackbar({ open: true, message: "Özet Data Excel'i hazırlanıyor...", severity: "info" });

        // 1. Plaka bazlı cari bilgilerini yakitRows'tan al (İlk kaydı baz al)
        const yakitOzetMap = yakitRows.reduce((acc, row) => {
            const plaka = row.plaka?.toUpperCase();
            if (!plaka) return acc;

            if (!acc[plaka]) {
                acc[plaka] = {
                    cari_id: row.cari_id,
                    cari_adi: row.cari_adi,
                };
            }
            return acc;
        }, {});

        // 2. Nihai veriyi oluştur
        const dataForExcel = Object.entries(kmMap).map(([plaka, kmData]) => {
            const yakitOzet = yakitOzetMap[plaka] || {};

            // Verileri al
            const tahminiTuketimLitre = kmData.TOPLAM_TUKETIM || 0; // HAKEDİŞ LİTRESİ (Tahmini Tüketim Litre)
            const gercekYakitLitre = kmData.TOPLAM_YAKIT_LITRESI || 0; // YAKIT ALIM LİTRESİ (Gerçek Yakıt Litre)
            const yakitFarkLitre = kmData.TOPLAM_KM_VE_LITRE_FARKI || 0; // YAKIT FARK LİTRE (Tah. Tük. - Yakıt)

            return {
                plaka: plaka,
                cari_id: yakitOzet.cari_id || null,
                cari_adi: yakitOzet.cari_adi || 'BİLİNMİYOR',
                hakedis_litresi: tahminiTuketimLitre,
                yakit_alim_litresi: gercekYakitLitre,
                yakit_fark_litre: yakitFarkLitre,
            };
        }).filter(data => data.hakedis_litresi !== 0 || data.yakit_alim_litresi !== 0);


        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Özet Plaka Analiz');

        // Başlıkları ayarla 
        worksheet.columns = [
            { header: 'PLAKA', key: 'plaka', width: 12 },
            { header: 'CARİ İD', key: 'cari_id', width: 10 },
            { header: 'CARİ ADI', key: 'cari_adi', width: 30 },
            { header: 'HAKEDİŞ LİTRESİ', key: 'hakedis_litresi', width: 20, style: { numFmt: '0.0000' } },
            { header: 'YAKIT ALIM LİTRESİ', key: 'yakit_alim_litresi', width: 20, style: { numFmt: '0.0000' } },
            // Yakıt farkı, pozitif/negatif gösterimi ile.
            { header: 'YAKIT FARK LİTRE', key: 'yakit_fark_litre', width: 20, style: { numFmt: '0.0000;[Red]-0.0000' } },
        ];

        // Veri satırlarını ekle
        worksheet.addRows(dataForExcel);

        // İndirme işlemi
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'ozet_plaka_analiz.xlsx');

        setSnackbar({ open: true, message: "Özet Plaka Analiz Excel dosyası başarıyla indirildi.", severity: "success" });

    } catch (error) {
        console.error("Özet Data indirme hatası:", error);
        setSnackbar({ open: true, message: error.message || "Özet Data Excel dosyası oluşturulurken hata oluştu.", severity: "error" });
    }
};


/* ------------------------ ANA HESAPLAMA BİLEŞENİ --------------------- */
/**
 * Frigo Yakıt Hakediş Hesaplama ve Sonuç Bileşeni
 */
export function FrigoHesaplama({ yakitInfo, seferInfo, setSnackbar, startTrigger, setStartTrigger }) {

    const seferRows = seferInfo?.allRows || [];
    const yakitRows = yakitInfo?.allRows || [];

    const MAX_STEP = 4;
    const [currentStep, setCurrentStep] = useState(0);
    const [sonucData, setSonucData] = useState(null); // Tutuldu, ancak UI'da artık gösterilmiyor
    const [kmData, setKmData] = useState(null);

    const hakedisVeriHazir = yakitInfo && seferInfo;
    const isCompleted = currentStep === MAX_STEP;


    useEffect(() => {
        if (startTrigger && hakedisVeriHazir) {
            handleHakedisStart();
            setStartTrigger(false);
        } else if (!hakedisVeriHazir) {
            setCurrentStep(0);
            setSonucData(null);
            setKmData(null);
        }
    }, [startTrigger, yakitInfo, seferInfo, hakedisVeriHazir, setStartTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleHakedisStart = useCallback(async () => {
        if (!hakedisVeriHazir) return;

        // Hesaplama mantığı olduğu gibi kalır...
        setCurrentStep(1);
        setSonucData(null);
        setKmData(null);

        let totalSeferKm = 0;
        let kmMap = {};
        let totalUniquePlates = 0;
        let totalKm = 0;

        try {
            // AŞAMA 1, 2, 3 hesaplamaları... (Kısaltıldı)
            setCurrentStep(1);
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!seferRows.length || !yakitRows.length) {
                throw new Error("Sefer ve/veya Yakıt verisi bulunamadı. Lütfen Excel dosyalarını yükleyiniz.");
            }
            setCurrentStep(2);
            seferRows.forEach((row) => {
                const plaka = row.plaka?.toUpperCase() || 'BILINMEYEN';
                const seferNo = (row.sefer_no || '').toUpperCase();
                const km = row.toplam_km || 0;
                totalKm += km;
                if (plaka === 'BILINMEYEN' || km === 0) return;
                if (!kmMap[plaka]) {
                    kmMap[plaka] = { BOS_KM: 0, SFR_KM: 0 };
                }
                if (seferNo.startsWith('BOS')) {
                    kmMap[plaka].BOS_KM += km;
                } else {
                    kmMap[plaka].SFR_KM += km;
                    totalSeferKm += km;
                }
            });
            totalUniquePlates = Object.keys(kmMap).length;
            setKmData({ totalUniquePlates, totalKm, kmMap: { ...kmMap } });
            await new Promise(resolve => setTimeout(resolve, 1000));
            setCurrentStep(3);
            const TUKETIM_SABITLERI = { SFR: 0.37, BOS: 0.30 };
            let toplamTahminiTuketim = 0;
            const tuketimMap = { ...kmMap };
            Object.keys(tuketimMap).forEach(plaka => {
                const km = tuketimMap[plaka];
                const sfrTuketim = km.SFR_KM * TUKETIM_SABITLERI.SFR;
                const bosTuketim = km.BOS_KM * TUKETIM_SABITLERI.BOS;
                const toplamTuketim = sfrTuketim + bosTuketim;
                const totalKm = km.SFR_KM + km.BOS_KM;
                tuketimMap[plaka].SFR_TUKETIM = sfrTuketim;
                tuketimMap[plaka].BOS_TUKETIM = bosTuketim;
                tuketimMap[plaka].TOPLAM_TUKETIM = toplamTuketim;
                tuketimMap[plaka].TOPLAM_KM_H = totalKm;
                toplamTahminiTuketim += toplamTuketim;
            });
            setKmData(prev => ({
                ...prev,
                kmMap: tuketimMap,
                toplamTahminiTuketim
            }));
            await new Promise(resolve => setTimeout(resolve, 1000));
            // AŞAMA 4 hesaplamaları...
            setCurrentStep(4);
            let toplamHakedisLitre = 0;
            let eslesenYakitKayitSayisi = 0;
            let genelToplamTuketimVeLitreFarki = 0;
            let genelToplamDuzeltmeMaliyeti = 0;
            const yakitMap = yakitRows.reduce((acc, yakit) => {
                const plaka = yakit.plaka?.toUpperCase() || 'BILINMEYEN_YAKIT';
                const litre = yakit.yakit_litresi || 0;
                const birimFiyat = yakit.birim_fiyat || 0;
                const iskontosuzFiyat = yakit.iskontosuz_birim_fiyat || 0;
                if (plaka === 'BILINMEYEN_YAKIT' || litre === 0) return acc;
                if (!acc[plaka]) {
                    acc[plaka] = { totalLitre: 0, totalBirimFiyat: 0, totalIskontosuzFiyat: 0, count: 0 };
                }
                acc[plaka].totalLitre += litre;
                acc[plaka].totalBirimFiyat += birimFiyat;
                acc[plaka].totalIskontosuzFiyat += iskontosuzFiyat;
                acc[plaka].count += 1;
                return acc;
            }, {});
            const finalYakitMap = Object.keys(yakitMap).reduce((acc, plaka) => {
                const data = yakitMap[plaka];
                acc[plaka] = {
                    toplamLitre: data.totalLitre,
                    avgBirimFiyat: data.count > 0 ? data.totalBirimFiyat / data.count : 0,
                    avgIskontosuzFiyat: data.count > 0 ? data.totalIskontosuzFiyat / data.count : 0,
                };
                return acc;
            }, {});
            const tuketimVeFarkMap = { ...tuketimMap };
            const tumPlakalar = Object.keys(tuketimVeFarkMap);
            tumPlakalar.forEach(plaka => {
                const data = tuketimVeFarkMap[plaka];
                const yakitData = finalYakitMap[plaka] || { toplamLitre: 0, avgBirimFiyat: 0, avgIskontosuzFiyat: 0 };
                const toplamYakit = yakitData.toplamLitre;
                const tahminiTuketim = data.TOPLAM_TUKETIM;
                const tuketimLitreFarki = tahminiTuketim - toplamYakit;
                genelToplamTuketimVeLitreFarki += tuketimLitreFarki;
                let duzeltmeMaliyeti = 0;
                if (tuketimLitreFarki > 0) {
                    duzeltmeMaliyeti = tuketimLitreFarki * yakitData.avgBirimFiyat;
                } else if (tuketimLitreFarki < 0) {
                    duzeltmeMaliyeti = Math.abs(tuketimLitreFarki) * yakitData.avgIskontosuzFiyat;
                }
                genelToplamDuzeltmeMaliyeti += duzeltmeMaliyeti;
                tuketimVeFarkMap[plaka].TOPLAM_YAKIT_LITRESI = toplamYakit;
                tuketimVeFarkMap[plaka].TOPLAM_KM_VE_LITRE_FARKI = tuketimLitreFarki;
                tuketimVeFarkMap[plaka].DUZELTME_MALIYETI = duzeltmeMaliyeti;
                if (toplamYakit > 0 && data.TOPLAM_TUKETIM > 0) {
                    const hakedisLitre = data.TOPLAM_TUKETIM * 0.90;
                    toplamHakedisLitre += hakedisLitre;
                    eslesenYakitKayitSayisi += (yakitRows.filter(y => y.plaka?.toUpperCase() === plaka).length || 1);
                }
            });
            setKmData(prev => ({
                ...prev,
                kmMap: tuketimVeFarkMap,
                genelToplamKmVeLitreFarki: genelToplamTuketimVeLitreFarki,
                genelToplamDuzeltmeMaliyeti: genelToplamDuzeltmeMaliyeti
            }));
            const nihaiHakedisTL = toplamHakedisLitre * 45.0000;
            await new Promise(resolve => setTimeout(resolve, 500));
            setSonucData({
                toplamYakit: yakitInfo.kayitSayisi,
                toplamSefer: seferInfo.kayitSayisi,
                eslesenKayit: eslesenYakitKayitSayisi,
                totalUniquePlates: totalUniquePlates,
                toplamSeferKm: totalSeferKm,
                hakedisLitre: toplamHakedisLitre,
                hakedisTL: nihaiHakedisTL,
                genelKmLitreFarki: genelToplamTuketimVeLitreFarki,
                genelDuzeltmeMaliyeti: genelToplamDuzeltmeMaliyeti
            });
            setCurrentStep(MAX_STEP);
            setSnackbar({
                open: true,
                message: "Hakediş hesaplaması başarıyla tamamlandı. Sonuçlar aşağıdadır.",
                severity: "success",
            });
            // Hata yakalama kısmı
        } catch (error) {
            console.error("Hakediş hesaplama hatası:", error);
            setCurrentStep(-1);
            setSonucData(null);
            setKmData(null);
            setSnackbar({
                open: true,
                message: error.message || "Hesaplama sırasında kritik hata oluştu.",
                severity: "error",
            });
        }
    }, [yakitInfo, seferInfo, setSnackbar, hakedisVeriHazir, seferRows, yakitRows]);


    const renderActionButton = () => {
        const isLoading = currentStep > 0 && currentStep < MAX_STEP;
        const isCompleted = currentStep === MAX_STEP;

        return (
            <Button
                variant="outlined"
                onClick={handleHakedisStart}
                disabled={!hakedisVeriHazir || isLoading}
                startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
                sx={{
                    borderColor: DARK.primary,
                    color: DARK.primary,
                    mt: 2
                }}
            >
                {isLoading
                    ? `Hesaplanıyor... (Aşama ${currentStep}/${MAX_STEP})`
                    : isCompleted
                        ? "Yeniden Hesapla"
                        : "HESAPLAMAYI BAŞLAT"
                }
            </Button>
        );
    };

    return (
        <Box sx={{ mt: 3 }}>

            {/* Hata Durumu */}
            {currentStep === -1 && (
                <Alert severity="error" sx={{ bgcolor: alpha(DARK.red, 0.1), color: DARK.text, border: `1px solid ${DARK.red}` }}>
                    <Box fontWeight={700}>**HATA:** Hesaplama işlemi durduruldu.</Box> Lütfen console'a bakınız veya yukarıdaki uyarı mesajını kontrol ediniz.
                    {renderActionButton()}
                </Alert>
            )}

            {/* Hesaplama Akış Paneli */}
            {hakedisVeriHazir && (currentStep < MAX_STEP || currentStep === MAX_STEP) && (
                <Paper
                    variant="outlined"
                    sx={{
                        p: 3,
                        borderRadius: 2,
                        bgcolor: DARK.surface,
                        borderColor: currentStep > 0 ? DARK.mint : DARK.border,
                        transition: 'border-color 0.3s'
                    }}
                >
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        3) Hakediş Hesaplama Süreci
                    </Typography>

                    <Stack spacing={2}>
                        <ProgressStep
                            step={1}
                            currentStep={currentStep}
                            icon={LocalGasStationIcon}
                            description={`Geçici Yakıt ve Sefer Verileri Hazırlanıyor (${yakitInfo?.kayitSayisi} Yakıt, ${seferInfo?.kayitSayisi} Sefer)`}
                        />
                        <ProgressStep
                            step={2}
                            currentStep={currentStep}
                            icon={LocalShippingIcon}
                            description={`Plaka Bazlı KM Toplamları Hesaplama (BOŞ/SFR ayrımı)`}
                        />
                        {/* AŞAMA 2 BİTTİĞİNDE KM DETAYINI GÖSTER (SFR, BOS, TOPLAM KM) */}
                        {currentStep >= 2 && kmData && kmData.totalUniquePlates > 0 && (
                            <Box sx={{ ml: 4, my: 1, p: 1, bgcolor: DARK.surface2, borderRadius: 1 }}>
                                <Typography variant="caption" color={DARK.mint} fontWeight={700}>
                                    **Kilometre Özeti (Adım 1):** {kmData.totalUniquePlates} benzersiz plaka için KM değerleri hesaplandı.
                                </Typography>
                                <PlakaKmList kmMap={kmData.kmMap} showCalculation={1} />
                            </Box>
                        )}

                        <ProgressStep
                            step={3}
                            currentStep={currentStep}
                            icon={FilterDramaIcon}
                            description={`Plaka Bazlı Tahmini Tüketim Hesaplama (SFR x 0.37, BOŞ x 0.30)`}
                        />

                        {/* AŞAMA 3 BİTTİĞİNDE Tüketim Detayını Göster (YENİ SÜTUNLAR) */}
                        {currentStep >= 3 && kmData && kmData.kmMap && Object.values(kmData.kmMap)[0]?.TOPLAM_TUKETIM != null && (
                            <Box sx={{ ml: 4, my: 1, p: 1, bgcolor: DARK.surface2, borderRadius: 1 }}>
                                <Typography variant="caption" color={DARK.primary} fontWeight={700}>
                                    **Tahmini Tüketim Özeti (Adım 2):** Toplam Tahmini Tüketim: {formatNumber(kmData.toplamTahminiTuketim)} L
                                </Typography>
                                <PlakaKmList kmMap={kmData.kmMap} showCalculation={2} />
                            </Box>
                        )}

                        <ProgressStep
                            step={4}
                            currentStep={currentStep}
                            icon={AssessmentIcon}
                            description={`Nihai Eşleştirme, Fark Maliyeti ve Hakediş Rakamının Oluşturulması`}
                        />
                    </Stack>

                    {renderActionButton()}
                </Paper>
            )}

            {/* Plaka Bazlı KM/Litre Farkı ve Maliyet Gösterim Alanı (MEVCUT ADIM) */}
            {currentStep === MAX_STEP && kmData && kmData.kmMap && (
                <Paper
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 2, bgcolor: DARK.surface, borderColor: DARK.primary, mt: 3 }}
                >
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Plaka Bazlı Tahmini Tüketim / Gerçek Yakıt Fark Analizi 📊
                    </Typography>

                    {/* ADIM 3: YALNIZCA İSTENEN 4 SÜTUN GÖSTERİLİYOR */}
                    <PlakaKmList kmMap={kmData.kmMap} showCalculation={3} />

                    {/* Genel Fark Maliyeti Özeti (Bu alan sabit kalmalı, genel sonuçtur) */}
                    {kmData.genelToplamDuzeltmeMaliyeti !== undefined && (
                        <Alert
                            severity={kmData.genelToplamKmVeLitreFarki >= 0 ? "info" : "warning"}
                            sx={{ mt: 2, bgcolor: alpha(DARK.primary, 0.1), color: DARK.text, border: `1px solid ${DARK.border}` }}
                        >
                            <Typography variant="body1" fontWeight={700}>
                                Genel Tahmini Tüketim - Yakıt Farkı: <span style={{ color: kmData.genelToplamKmVeLitreFarki >= 0 ? DARK.mint : DARK.red }}>{formatNumber(kmData.genelToplamKmVeLitreFarki)} L</span>
                            </Typography>
                            <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
                                Genel Düzeltme Maliyeti: <span style={{ color: DARK.primary }}>{formatCurrency(kmData.genelToplamDuzeltmeMaliyeti)}</span>
                            </Typography>
                        </Alert>
                    )}
                </Paper>
            )}

            {/* Plaka Bazlı Düzeltme Maliyeti Paneli (1. Eklenen Yeni Adım) */}
            {currentStep === MAX_STEP && kmData && kmData.kmMap && (
                <Paper
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 2, bgcolor: DARK.surface, borderColor: DARK.mint, mt: 3 }}
                >
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Plaka Bazlı Hakediş / Ceza Detayı 💰
                    </Typography>
                    <PlakaHakedisList kmMap={kmData.kmMap} />
                </Paper>
            )}

            {/* Sefer Hakedişleri (Maliyet / KM) Paneli (2. Eklenen Yeni Adım) */}
            {currentStep === MAX_STEP && kmData && kmData.kmMap && seferInfo && (
                <Paper
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 2, bgcolor: DARK.surface, borderColor: DARK.primary, mt: 3 }}
                >
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Plaka Bazlı Maliyet Dağılımı Oranı (TL/KM) 📈
                    </Typography>
                    <SeferHakedisList kmMap={kmData.kmMap} seferRows={seferInfo.allRows} />
                </Paper>
            )}

            {/* Sefer Bazlı Maliyet Dağılımı Paneli (3. Eklenen Yeni Adım) */}
            {currentStep === MAX_STEP && kmData && kmData.kmMap && seferInfo && (
                <Paper
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 2, bgcolor: DARK.surface, borderColor: DARK.red, mt: 3 }}
                >
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Sefer Bazlı Maliyet Dağılımı (Sefer No'ya Göre) 💸
                    </Typography>
                    <SeferMaliyetDagilimi kmMap={kmData.kmMap} seferRows={seferInfo.allRows} />
                </Paper>
            )}


            {/* Nihai Çıktı Paneli (YENİ SADELEŞTİRİLMİŞ SONUÇ ALANI) */}
            {isCompleted && kmData && seferInfo && yakitInfo && (
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: DARK.surface,
                        borderColor: DARK.mint,
                        mt: 3
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                        <FileDownloadIcon sx={{ color: DARK.mint, fontSize: 24 }} />
                        <Typography variant="h6" fontWeight={800}>
                            Çıktıları İndireceğiniz Alan
                        </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1.5} mt={2}>
                        <Button
                            variant="contained"
                            startIcon={<FileDownloadIcon />}
                            onClick={() => downloadSeferHakedisleri(kmData.kmMap, seferInfo.allRows, setSnackbar)}
                            sx={{
                                bgcolor: DARK.mint,
                                color: DARK.surface2,
                                fontWeight: 700,
                                "&:hover": { bgcolor: alpha(DARK.mint, 0.85) },
                            }}
                        >
                            Sefer Hakedişleri Raporunu İndir
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<FileDownloadIcon />}
                            onClick={() => downloadOzetData(kmData.kmMap, yakitInfo.allRows, setSnackbar)}
                            sx={{
                                bgcolor: DARK.primary,
                                color: DARK.text,
                                fontWeight: 700,
                                "&:hover": { bgcolor: alpha(DARK.primary, 0.85) },
                            }}
                        >
                            Özet Data İndir
                        </Button>
                    </Stack>
                </Paper>
            )}

            {/* Veri Eksik Uyarısı */}
            {!hakedisVeriHazir && (
                <Alert severity="warning" sx={{ mt: 2, bgcolor: alpha(DARK.red, 0.1), color: DARK.text, border: `1px solid ${DARK.red}` }}>
                    **3. Adım beklemede.** Lütfen Yakıtlar ve Seferler dosyalarını yükleyiniz.
                </Alert>
            )}
        </Box>
    );
}


/* ------------------------ Ana Sayfa Bileşeni ------------------------------- */
export default function FrigoYakitHakedis() {
    const [yakitInfo, setYakitInfo] = useState(null);
    const [seferInfo, setSeferInfo] = useState(null);
    const [yakitPreviewOpen, setYakitPreviewOpen] = useState(false);

    const [startCalculation, setStartCalculation] = useState(false);

    const [loadingYakit, setLoadingYakit] = useState(false);
    const [loadingSefer, setLoadingSefer] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

    const accept = ".xlsx,.xls";

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    /* ------------------ YAKIT UPLOAD ------------------- */
    const handleYakitUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        try {
            setLoadingYakit(true);
            setYakitInfo(null);
            setStartCalculation(false);

            const { headers, rows } = await readXlsxFile(file);

            const expectedKeys = [
                "plaka",
                "cari_id",
                "cari_adi",
                "iskontosuz_birim_fiyat",
                "birim_fiyat",
                "yakit_litresi",
            ];

            const missing = expectedKeys.filter(key => !headers.includes(key));

            if (missing.length) {
                const userFriendlyMissing = missing.map(m => m.toUpperCase().replace(/_/g, ' '));
                throw new Error(
                    "Şablon hatası: Eksik başlık(lar) var. Lütfen tam olarak: " + userFriendlyMissing.join(", ") + " başlıklarını kullanın."
                );
            }

            const payload = rows.map((r) => ({
                plaka: toStrOrNull(r["plaka"]),
                cari_adi: toStrOrNull(r["cari_adi"]),
                cari_id: toIntOrNull(r["cari_id"]),
                yakit_litresi: toNumOrNull(r["yakit_litresi"]),
                birim_fiyat: toNumOrNull(r["birim_fiyat"]),
                iskontosuz_birim_fiyat: toNumOrNull(r["iskontosuz_birim_fiyat"]),
            }));

            const clean = payload.filter(
                (p) =>
                    p.plaka ||
                    p.cari_adi ||
                    p.cari_id !== null ||
                    p.yakit_litresi !== null ||
                    p.birim_fiyat !== null ||
                    p.iskontosuz_birim_fiyat !== null
            );

            if (!clean.length) {
                throw new Error("Dosyada geçerli satır bulunamadı.");
            }

            const { error: deleteError } = await supabase.from("frigo_yakit_tmp").delete().neq("plaka", "__never__");
            if (deleteError) throw new Error("Önceki kayıtlar silinemedi.");

            await insertBatched("frigo_yakit_tmp", clean);

            setYakitInfo({
                fileName: file.name,
                kayitSayisi: clean.length,
                preview: clean.slice(0, 5),
                allRows: clean,
            });
            setSnackbar({
                open: true,
                message: `Yakıtlar dosyası başarıyla yüklendi. ${clean.length} kayıt işlendi.`,
                severity: "success",
            });
        } catch (err) {
            console.error("Yakıt yükleme hatası:", err);
            setSnackbar({
                open: true,
                message: err.message || "Yakıtlar yüklenemedi: Bilinmeyen hata",
                severity: "error",
            });
        } finally {
            setLoadingYakit(false);
        }
    }, []);

    /* ------------------ SEFER UPLOAD ------------------- */
    const handleSeferUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        try {
            setLoadingSefer(true);
            setSeferInfo(null);
            setStartCalculation(false);

            const { headers, rows } = await readXlsxFile(file);

            // Beklenen küçük harf anahtarlar
            const expectedKeys = ["sefer_no", "tms_despatch_id", "plaka", "toplam_km"];
            const missing = expectedKeys.filter(key => !headers.includes(key));

            if (missing.length) {
                const userFriendlyMissing = missing.map(m => m.toUpperCase().replace(/_/g, ' '));
                throw new Error(
                    "Şablon hatası: Eksik başlık(lar) var. Lütfen tam olarak: " + userFriendlyMissing.join(", ") + " başlıklarını kullanın."
                );
            }

            const payload = rows.map((r) => ({
                sefer_no: toStrOrNull(r["sefer_no"]),
                tms_despatch_id: toIntOrNull(r["tms_despatch_id"]),
                plaka: toStrOrNull(r["plaka"]),
                toplam_km: toNumOrNull(r["toplam_km"]),
            }));

            const clean = payload.filter(
                (p) => p.sefer_no || p.tms_despatch_id !== null || p.plaka || p.toplam_km !== null
            );

            if (!clean.length) {
                throw new Error("Dosyada geçerli satır bulunamadı.");
            }

            const { error: deleteError } = await supabase.from("frigo_sefer_tmp").delete().neq("plaka", "__never__");
            if (deleteError) throw new Error("Önceki kayıtlar silinemedi.");

            await insertBatched("frigo_sefer_tmp", clean);

            setSeferInfo({
                fileName: file.name,
                kayitSayisi: clean.length,
                preview: clean.slice(0, 5),
                allRows: clean,
            });
            setSnackbar({
                open: true,
                message: `Seferler dosyası başarıyla yüklendi. ${clean.length} kayıt işlendi.`,
                severity: "success",
            });
        } catch (err) {
            console.error("Sefer yükleme hatası:", err);
            setSnackbar({
                open: true,
                message: err.message || "Seferler yüklenemedi: Bilinmeyen hata",
                severity: "error",
            });
        } finally {
            setLoadingSefer(false);
        }
    }, []);

    /* ------------------ Temizle (Geçici Tabloları Sil) -------------- */
    const handleTemizle = useCallback(async () => {
        if (!window.confirm("Geçici tabloları temizlemek istediğinizden emin misiniz?")) {
            return;
        }
        try {
            setCleaning(true);
            const { error: yakitError } = await supabase.from("frigo_yakit_tmp").delete().neq("plaka", "__never__");
            const { error: seferError } = await supabase.from("frigo_sefer_tmp").delete().neq("plaka", "__never__");

            if (yakitError || seferError) {
                throw new Error("Tablolar silinirken Supabase hatası oluştu.");
            }

            setYakitInfo(null);
            setSeferInfo(null);
            setStartCalculation(false);
            setSnackbar({
                open: true,
                message: "Geçici tablolar başarıyla temizlendi. Lütfen yeni dosyaları yükleyin.",
                severity: "info",
            });
        } catch (err) {
            console.error("Temizleme hatası:", err);
            setSnackbar({
                open: true,
                message: "Tablolar temizlenemedi: " + (err?.message || "bilinmeyen hata"),
                severity: "error",
            });
        } finally {
            setCleaning(false);
        }
    }, []);

    /* ------------------ UI Yardımcı Kart Bileşenleri ---------------- */
    const Card = ({ title, icon, children, loaded }) => (
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                flex: 1,
                minWidth: 320,
                borderRadius: 2,
                bgcolor: loaded ? alpha(DARK.surface, 0.5) : DARK.surface,
                borderColor: loaded ? DARK.mint : DARK.border,
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                {React.cloneElement(icon, { color: loaded ? "inherit" : "primary" })}
                <Typography variant="subtitle1" fontWeight={700} color={DARK.text}>
                    {title}
                </Typography>
                {loaded && (
                    <Chip
                        size="small"
                        label="Yüklendi"
                        icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                        sx={{
                            ml: "auto",
                            bgcolor: alpha(DARK.mint, 0.15),
                            color: DARK.mint,
                            border: `1px solid ${alpha(DARK.mint, 0.35)}`,
                        }}
                        variant="outlined"
                    />
                )}
            </Stack>
            {children}
        </Paper>
    );

    const hakedisVeriHazir = yakitInfo && seferInfo;
    const isCalculationStarting = startCalculation;


    return (
        <Box sx={{ p: { xs: 2, md: 3 }, color: DARK.text, bgcolor: DARK.pageBg, minHeight: '100vh' }}>
            {/* Başlık ve Aksiyonlar */}
            <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                <AssessmentIcon sx={{ color: DARK.primary, fontSize: 32 }} />
                <Typography variant="h4" fontWeight={800}>
                    Frigo Yakıt Hakediş
                </Typography>
                <Chip
                    size="small"
                    label="Beta"
                    sx={{ ml: 1, bgcolor: alpha(DARK.primary, 0.15), color: DARK.primary, border: `1px solid ${alpha(DARK.primary, 0.35)}`, }}
                    variant="outlined"
                />
                <Box sx={{ ml: "auto" }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={downloadYakitTemplate}
                            sx={{ borderColor: DARK.primary, color: DARK.primary }}
                        >
                            Yakıt Şablonu İndir
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={downloadSeferTemplate}
                            sx={{ borderColor: DARK.primary, color: DARK.primary }}
                        >
                            Sefer Şablonu İndir
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={cleaning ? <CircularProgress size={16} color="inherit" /> : <DeleteSweepIcon />}
                            onClick={handleTemizle}
                            disabled={cleaning}
                            sx={{
                                bgcolor: DARK.red,
                                color: DARK.text,
                                '&:hover': { bgcolor: alpha(DARK.red, 0.8) }
                            }}
                        >
                            {cleaning ? "Temizleniyor" : "Geçici Tabloları Temizle"}
                        </Button>
                    </Stack>
                </Box>
            </Stack>

            {/* Yükleme Kartları */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={3} mb={3}>
                {/* ... Yakıt Card ... */}
                <Card
                    title={
                        yakitInfo
                            ? `Yakıtlar: ${yakitInfo.fileName} (${yakitInfo.kayitSayisi} kayıt)`
                            : "1) Yakıtlar Şablonu Yükle"
                    }
                    icon={<LocalGasStationIcon sx={{ color: DARK.primary, fontSize: 24 }} />}
                    loaded={!!yakitInfo}
                >
                    <Typography variant="body2" color={DARK.textMuted} mb={1}>
                        Plaka, cari, yakıt litresi ve fiyat bilgilerini içeren Excel dosyasını yükleyin.
                    </Typography>

                    <Stack direction="row" alignItems="center" spacing={1}>
                        <Button
                            variant="contained"
                            component="label"
                            startIcon={loadingYakit ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />}
                            sx={{
                                bgcolor: DARK.primary,
                                color: DARK.text,
                                "&:hover": { bgcolor: alpha(DARK.primary, 0.8) },
                            }}
                            disabled={loadingYakit}
                        >
                            {yakitInfo ? "Dosyayı Değiştir" : "Dosya Seç"}
                            <input type="file" hidden onChange={handleYakitUpload} accept={accept} />
                        </Button>

                        {yakitInfo && (
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<VisibilityIcon />}
                                onClick={() => setYakitPreviewOpen(true)}
                                sx={{ borderColor: DARK.mint, color: DARK.mint }}
                            >
                                Önizle ({yakitInfo.preview.length} satır)
                            </Button>
                        )}
                    </Stack>
                </Card>

                {/* ... Sefer Card ... */}
                <Card
                    title={
                        seferInfo
                            ? `Seferler: ${seferInfo.fileName} (${seferInfo.kayitSayisi} kayıt)`
                            : "2) Seferler Şablonu Yükle"
                    }
                    icon={<LocalShippingIcon sx={{ color: DARK.primary, fontSize: 24 }} />}
                    loaded={!!seferInfo}
                >
                    <Typography variant="body2" color={DARK.textMuted} mb={1}>
                        Sefer no, tms id, plaka ve toplam km bilgilerini içeren Excel dosyasını yükleyin.
                    </Typography>

                    <Stack direction="row" alignItems="center" spacing={1}>
                        <Button
                            variant="outlined"
                            component="label"
                            startIcon={loadingSefer ? <CircularProgress size={18} /> : <UploadFileIcon />}
                            sx={{ borderColor: DARK.primary, color: DARK.primary }}
                            disabled={loadingSefer}
                        >
                            {seferInfo ? "Dosyayı Değiştir" : "Dosya Seç"}
                            <input type="file" hidden onChange={handleSeferUpload} accept={accept} />
                        </Button>
                        {seferInfo && (
                            <Typography variant="caption" color={DARK.textMuted}>
                                ({seferInfo.kayitSayisi} kayıt yüklendi)
                            </Typography>
                        )}
                    </Stack>
                </Card>
            </Stack>

            {/* Hesaplama Aksiyonu/Bileşeni */}
            <Paper
                variant="outlined"
                sx={{
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: DARK.surface,
                    borderColor: hakedisVeriHazir ? DARK.mint : DARK.border,
                }}
            >
                <Stack direction="row" alignItems="center" spacing={2}>
                    <Button
                        variant="contained"
                        onClick={() => setStartCalculation(true)}
                        disabled={!hakedisVeriHazir || isCalculationStarting}
                        startIcon={isCalculationStarting ? <CircularProgress size={20} color="inherit" /> : <AssessmentIcon />}
                        sx={{
                            bgcolor: DARK.mint,
                            color: DARK.surface2,
                            fontWeight: 700,
                            "&:disabled": {
                                bgcolor: alpha(DARK.mint, 0.3),
                                color: alpha(DARK.text, 0.5),
                            },
                            "&:hover": { bgcolor: alpha(DARK.mint, 0.85) },
                        }}
                    >
                        {isCalculationStarting
                            ? "Hesaplama Başlatılıyor..."
                            : "3) Hakedişi Başlat ve Sonuçları Gör"
                        }
                    </Button>

                    <Divider orientation="vertical" flexItem sx={{ borderColor: DARK.border }} />
                    <Typography variant="body2" color={DARK.textMuted}>
                        Her iki dosya yüklendikten sonra işlemi başlatın. Kilometre hesaplaması otomatik olarak başlayacaktır.
                    </Typography>
                </Stack>
            </Paper>


            {/* **HESAPLAMA VE SONUÇ BİLEŞENİ** */}
            <FrigoHesaplama
                yakitInfo={yakitInfo}
                seferInfo={seferInfo}
                setSnackbar={setSnackbar}
                startTrigger={startCalculation}
                setStartTrigger={setStartCalculation}
            />

            {/* Yakıt Önizleme Modal */}
            <Dialog
                open={yakitPreviewOpen && !!yakitInfo}
                onClose={() => setYakitPreviewOpen(false)}
                fullWidth
                maxWidth="md"
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        bgcolor: DARK.surface,
                        color: DARK.text,
                        border: `1px solid ${DARK.border}`,
                    },
                }}
            >
                <DialogTitle sx={{ bgcolor: DARK.surface2 }}>
                    <Typography variant="h6" fontWeight={800}>
                        Yakıtlar Şablonu Önizlemesi
                    </Typography>
                    <Typography variant="caption" color={DARK.textMuted}>
                        Dosya: {yakitInfo?.fileName} · Toplam **{yakitInfo?.kayitSayisi}** kayıt (İlk 5 gösteriliyor)
                    </Typography>
                </DialogTitle>
                <DialogContent dividers sx={{ borderColor: DARK.border }}>
                    <Box sx={{ width: "100%", overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow
                                    sx={{
                                        "& th": {
                                            bgcolor: DARK.surface2,
                                            color: DARK.textMuted,
                                            borderColor: DARK.border,
                                            fontWeight: 700,
                                        },
                                    }}
                                >
                                    {[
                                        "#",
                                        "PLAKA",
                                        "CARİ_ID",
                                        "CARİ_ADI",
                                        "İSKONTOSUZ BİRİM FİYAT", // Başlıklar büyük harf ve boşluklu gösteriliyor
                                        "BİRİM FİYAT",
                                        "YAKIT LİTRESİ",
                                    ].map((h) => (
                                        <TableCell key={h}>{h}</TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {yakitInfo?.preview?.map((it, idx) => (
                                    <TableRow
                                        key={idx}
                                        sx={{
                                            bgcolor: idx % 2 === 0 ? DARK.surface : DARK.zebra,
                                            "& td": { borderColor: DARK.border },
                                        }}
                                    >
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell>{it.plaka}</TableCell>
                                        <TableCell>{it.cari_id}</TableCell>
                                        <TableCell>{it.cari_adi}</TableCell>
                                        <TableCell>{formatNumber(it.iskontosuz_birim_fiyat)}</TableCell>
                                        <TableCell>{formatNumber(it.birim_fiyat)}</TableCell>
                                        <TableCell>{formatNumber(it.yakit_litresi)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ bgcolor: DARK.surface2 }}>
                    <Button onClick={() => setYakitPreviewOpen(false)} sx={{ color: DARK.textMuted }}>
                        Kapat
                    </Button>
                    <Button
                        onClick={() => setYakitPreviewOpen(false)}
                        variant="contained"
                        sx={{
                            bgcolor: DARK.primary,
                            color: DARK.text,
                            "&:hover": { bgcolor: alpha(DARK.primary, 0.8) },
                        }}
                    >
                        Onayla ve Kapat
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar Bildirimleri */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
            >
                <Alert
                    onClose={handleSnackbarClose}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
