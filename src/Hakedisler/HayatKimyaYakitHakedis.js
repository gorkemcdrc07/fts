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
import { supabase } from "../supabaseClient";

import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/* ------------------------ Koyu Tema Renkleri ------------------------ */
const DARK = {
    pageBg: "#121212",
    surface: "#1E1E1E",
    surface2: "#2A2A2A",
    border: "#3A3A3A",
    text: "#E0E0E0",
    textMuted: "#A0A0A0",
    zebra: "#252525",
    primary: "#BB86FC",
    mint: "#03DAC6",
    red: "#CF6679",
};

/* ------------------------ UI ONLY: Yeni Dashboard Görünüm Yardımcıları ------------------------ */
const Glass = ({ children, sx }) => (
    <Paper
        variant="outlined"
        sx={{
            borderRadius: 3,
            borderColor: alpha(DARK.border, 0.9),
            bgcolor: alpha(DARK.surface, 0.72),
            backdropFilter: "blur(10px)",
            boxShadow: `0 12px 40px ${alpha("#000", 0.35)}`,
            ...sx,
        }}
    >
        {children}
    </Paper>
);

const KpiCard = ({ label, value, icon, tone = "default" }) => {
    const palette =
        tone === "success"
            ? { bg: alpha(DARK.mint, 0.12), bd: alpha(DARK.mint, 0.35), fg: DARK.mint }
            : tone === "danger"
                ? { bg: alpha(DARK.red, 0.12), bd: alpha(DARK.red, 0.35), fg: DARK.red }
                : { bg: alpha(DARK.primary, 0.10), bd: alpha(DARK.primary, 0.28), fg: DARK.text };

    return (
        <Glass
            sx={{
                p: 2,
                borderColor: palette.bd,
                bgcolor: palette.bg,
                height: "100%",
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                    sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: alpha(DARK.surface2, 0.65),
                        border: `1px solid ${alpha(DARK.border, 0.9)}`,
                    }}
                >
                    {icon}
                </Box>

                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: DARK.textMuted }}>
                        {label}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: palette.fg, lineHeight: 1.15 }}>
                        {value}
                    </Typography>
                </Box>
            </Stack>
        </Glass>
    );
};

const SectionTitle = ({ icon, title, subtitle, right }) => (
    <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
            <Box
                sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 3,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: alpha(DARK.primary, 0.14),
                    border: `1px solid ${alpha(DARK.primary, 0.25)}`,
                }}
            >
                {icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 950, color: DARK.text, letterSpacing: 0.2 }}>
                    {title}
                </Typography>
                {subtitle ? (
                    <Typography variant="body2" sx={{ color: DARK.textMuted }}>
                        {subtitle}
                    </Typography>
                ) : null}
            </Box>
        </Stack>
        <Box sx={{ ml: "auto", width: { xs: "100%", md: "auto" } }}>{right}</Box>
    </Stack>
);

/* ------------------------ Yardımcı Formatlayıcılar ------------------- */
const formatNumber = (value) =>
    new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
    }).format(Number(value || 0));

const formatCurrency = (value) =>
    new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
    }).format(Number(value || 0));

const roundToDecimal = (num, decimals = 4) => {
    const factor = Math.pow(10, decimals);
    return Math.round((Number(num || 0) * factor)) / factor;
};

/* ===================== MÜŞTERİYE GÖRE ORAN (%36 / %37) ===================== */
const normalizeCompany = (s) =>
    String(s || "")
        .toLocaleUpperCase("tr-TR")
        .replace(/\s+/g, " ")
        .trim();

const SPECIAL_CUSTOMERS_36 = new Set([
    normalizeCompany("HAYAT KİMYA SANAYİ ANONİM ŞİRKETİ"),
    normalizeCompany("ODAK TEDARİK ZİNCİRİ VE LOJİSTİK ANONİM ŞİRKETİ"),
]);

const getRateByMusteri = (musteriAdi) => {
    const n = normalizeCompany(musteriAdi);
    return SPECIAL_CUSTOMERS_36.has(n) ? 0.36 : 0.37;
};
/* ========================================================================== */

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
            <Box sx={{ position: "relative", width: 24, height: 24 }}>
                {isActive ? <CircularProgress size={24} sx={{ color }} /> : <IconComponent sx={{ color, fontSize: 24 }} />}
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

/* ------------------------ Plaka Liste Bileşeni ------------------- */
const PlakaKmList = ({ kmMap, showCalculation = 1 }) => {
    if (!kmMap || Object.keys(kmMap).length === 0) return null;

    const list = Object.entries(kmMap).map(([plaka, data]) => ({ plaka, ...data }));

    const isStep1 = showCalculation === 1; // KM kırılımı
    const isStep2 = showCalculation === 2; // Tahmini tüketim
    const isStep3 = showCalculation === 3; // Fark analizi (4 sütun)

    let title = "Plaka Bazlı KM Dağılımı";
    let headers = [
        { label: "Plaka", key: "plaka", color: DARK.mint, xs: 3 },
        { label: "KM (%36)", key: "KM_36", color: DARK.primary, xs: 3 },
        { label: "KM (%37)", key: "KM_37", color: DARK.primary, xs: 3 },
        { label: "TOPLAM KM", key: "TOPLAM_KM", color: DARK.text, xs: 3 },
    ];

    if (isStep2) {
        title = "Plaka Bazlı Tahmini Tüketim (Litre)";
        headers = [
            { label: "Plaka", key: "plaka", color: DARK.mint, xs: 4 },
            { label: "TOPLAM KM", key: "TOPLAM_KM", color: DARK.textMuted, xs: 4 },
            { label: "TAHMİNİ TÜKETİM (L)", key: "TOPLAM_TUKETIM", color: DARK.mint, xs: 4 },
        ];
    } else if (isStep3) {
        title = "Plaka Bazlı Tahmini Tüketim / Gerçek Yakıt Fark Analizi";
        headers = [
            { label: "Plaka", key: "plaka", color: DARK.mint, xs: 3 },
            { label: "TAHMİNİ TÜKETİM (L)", key: "TOPLAM_TUKETIM", color: DARK.mint, xs: 3 },
            { label: "TOPLAM YAKIT (L)", key: "TOPLAM_YAKIT_LITRESI", color: DARK.primary, xs: 3 },
            { label: "FARK (Tah. - Yakıt)", key: "TOPLAM_KM_VE_LITRE_FARKI", color: DARK.red, xs: 3 },
        ];
    }

    return (
        <Box
            sx={{
                mt: 1.5,
                maxHeight: 260,
                overflowY: "auto",
                p: 1,
                bgcolor: DARK.surface,
                borderRadius: 1,
                border: `1px solid ${DARK.border}`,
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
                {list.map((d) => {
                    const diff = Number(d.TOPLAM_KM_VE_LITRE_FARKI || 0);
                    const diffColor = diff >= 0 ? DARK.mint : DARK.red;

                    return (
                        <Grid container key={d.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                            {/* Plaka */}
                            <Grid item xs={headers[0].xs}>
                                <Typography variant="caption" color={DARK.text}>
                                    {d.plaka}
                                </Typography>
                            </Grid>

                            {isStep1 && (
                                <>
                                    <Grid item xs={headers[1].xs}>
                                        <Typography variant="caption" color={DARK.primary}>
                                            {formatNumber(d.KM_36)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={headers[2].xs}>
                                        <Typography variant="caption" color={DARK.primary}>
                                            {formatNumber(d.KM_37)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={headers[3].xs}>
                                        <Typography variant="caption" fontWeight={700} color={DARK.text}>
                                            {formatNumber(d.TOPLAM_KM)}
                                        </Typography>
                                    </Grid>
                                </>
                            )}

                            {isStep2 && (
                                <>
                                    <Grid item xs={headers[1].xs}>
                                        <Typography variant="caption" color={DARK.textMuted}>
                                            {formatNumber(d.TOPLAM_KM)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={headers[2].xs}>
                                        <Typography variant="caption" fontWeight={700} color={DARK.mint}>
                                            {formatNumber(d.TOPLAM_TUKETIM)}
                                        </Typography>
                                    </Grid>
                                </>
                            )}

                            {isStep3 && (
                                <>
                                    <Grid item xs={headers[1].xs}>
                                        <Typography variant="caption" fontWeight={700} color={DARK.mint}>
                                            {formatNumber(d.TOPLAM_TUKETIM)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={headers[2].xs}>
                                        <Typography variant="caption" color={DARK.primary}>
                                            {formatNumber(d.TOPLAM_YAKIT_LITRESI)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={headers[3].xs}>
                                        <Typography variant="caption" fontWeight={700} color={diffColor}>
                                            {formatNumber(d.TOPLAM_KM_VE_LITRE_FARKI)}
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

/* ------------------------ Plaka Bazlı Düzeltme Maliyeti Listesi ------------------- */
const PlakaHakedisList = ({ kmMap }) => {
    if (!kmMap || Object.keys(kmMap).length === 0) return null;

    const list = Object.entries(kmMap)
        .filter(([, data]) => data.DUZELTME_MALIYETI !== undefined && data.DUZELTME_MALIYETI !== 0)
        .map(([plaka, data]) => ({
            plaka,
            DUZELTME_MALIYETI: data.DUZELTME_MALIYETI,
            TOPLAM_KM_VE_LITRE_FARKI: data.TOPLAM_KM_VE_LITRE_FARKI,
        }));

    if (list.length === 0)
        return (
            <Alert severity="info" sx={{ mt: 1, mb: 1, bgcolor: alpha(DARK.primary, 0.1), color: DARK.text }}>
                Düzeltme Maliyeti / Performans Hakedişi hesaplanan plaka bulunamadı.
            </Alert>
        );

    return (
        <Box
            sx={{
                mt: 1.5,
                maxHeight: 250,
                overflowY: "auto",
                p: 1,
                bgcolor: DARK.surface,
                borderRadius: 1,
                border: `1px solid ${DARK.border}`,
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
                <Grid item xs={6} sx={{ textAlign: "right" }}>
                    <Typography variant="caption" fontWeight={700} color={DARK.primary}>
                        Düzeltme Maliyeti / Hakediş (TL)
                    </Typography>
                </Grid>
            </Grid>

            <Stack spacing={0.5} mt={0.5}>
                {list.map((d) => {
                    const maliyet = Number(d.DUZELTME_MALIYETI || 0);
                    const diff = Number(d.TOPLAM_KM_VE_LITRE_FARKI || 0);

                    const listColor = diff >= 0 ? DARK.mint : DARK.red;
                    const label = diff >= 0 ? "PRİM Hakedişi" : "FAZLA YAKIT Maliyeti";

                    const finalMaliyet = diff < 0 ? -maliyet : maliyet;
                    return (
                        <Grid container key={d.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                            <Grid item xs={6}>
                                <Typography variant="caption" fontWeight={700} color={listColor}>
                                    {d.plaka}
                                </Typography>
                            </Grid>
                            <Grid item xs={6} sx={{ textAlign: "right" }}>
                                <Typography variant="caption" fontWeight={700} color={listColor}>
                                    {formatCurrency(finalMaliyet)} ({label})
                                </Typography>
                            </Grid>
                        </Grid>
                    );
                })}
            </Stack>
        </Box>
    );
};

/* ------------------------ Plaka Bazlı Maliyet Dağılımı Oranı (TL/KM) ------------------- */
const SeferHakedisList = ({ kmMap, seferRows }) => {
    if (!kmMap || Object.keys(kmMap).length === 0 || !seferRows || seferRows.length === 0) return null;

    const hakedisMap = Object.entries(kmMap)
        .filter(([, data]) => data.DUZELTME_MALIYETI !== undefined && data.DUZELTME_MALIYETI !== 0)
        .reduce((acc, [plaka, data]) => {
            const diff = Number(data.TOPLAM_KM_VE_LITRE_FARKI || 0);
            const maliyetSigned = diff < 0 ? -Number(data.DUZELTME_MALIYETI || 0) : Number(data.DUZELTME_MALIYETI || 0);
            const toplamKm = Number(data.TOPLAM_KM || 0);
            const maliyetPerKm = toplamKm > 0 ? roundToDecimal(maliyetSigned / toplamKm, 4) : 0;

            acc[plaka] = { maliyet: maliyetSigned, toplamKm, maliyetPerKm };
            return acc;
        }, {});

    const list = Object.entries(hakedisMap)
        .map(([plaka, data]) => ({ plaka, ...data }))
        .filter((d) => d.toplamKm > 0);

    if (list.length === 0)
        return (
            <Alert severity="warning" sx={{ mt: 1, mb: 1, bgcolor: alpha(DARK.red, 0.1), color: DARK.text }}>
                Hakedişi olan plakalar için KM kaydı bulunamadı.
            </Alert>
        );

    return (
        <Box
            sx={{
                mt: 1.5,
                maxHeight: 250,
                overflowY: "auto",
                p: 1,
                bgcolor: DARK.surface,
                borderRadius: 1,
                border: `1px solid ${DARK.border}`,
            }}
        >
            <Typography variant="body2" fontWeight={700} color={DARK.text} mb={1}>
                Plaka Bazlı Maliyet Dağılımı Oranı (TL/KM):
            </Typography>

            <Grid container spacing={1} sx={{ bgcolor: DARK.surface2, p: 1, borderRadius: 1 }}>
                <Grid item xs={3}>
                    <Typography variant="caption" fontWeight={700} color={DARK.mint}>
                        Plaka
                    </Typography>
                </Grid>
                <Grid item xs={3} sx={{ textAlign: "right" }}>
                    <Typography variant="caption" fontWeight={700} color={DARK.textMuted}>
                        Toplam KM
                    </Typography>
                </Grid>
                <Grid item xs={3} sx={{ textAlign: "right" }}>
                    <Typography variant="caption" fontWeight={700} color={DARK.primary}>
                        Düzeltme (TL)
                    </Typography>
                </Grid>
                <Grid item xs={3} sx={{ textAlign: "right" }}>
                    <Typography variant="caption" fontWeight={700} color={DARK.mint}>
                        TL / KM
                    </Typography>
                </Grid>
            </Grid>

            <Stack spacing={0.5} mt={0.5}>
                {list.map((d) => {
                    const isPositive = d.maliyet >= 0;
                    const color = isPositive ? DARK.mint : DARK.red;

                    return (
                        <Grid container key={d.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                            <Grid item xs={3}>
                                <Typography variant="caption" fontWeight={700} color={color}>
                                    {d.plaka}
                                </Typography>
                            </Grid>
                            <Grid item xs={3} sx={{ textAlign: "right" }}>
                                <Typography variant="caption" color={DARK.textMuted}>
                                    {formatNumber(d.toplamKm)}
                                </Typography>
                            </Grid>
                            <Grid item xs={3} sx={{ textAlign: "right" }}>
                                <Typography variant="caption" fontWeight={700} color={color}>
                                    {formatCurrency(d.maliyet)}
                                </Typography>
                            </Grid>
                            <Grid item xs={3} sx={{ textAlign: "right" }}>
                                <Typography variant="caption" fontWeight={700} color={color}>
                                    {formatCurrency(d.maliyetPerKm)}
                                </Typography>
                            </Grid>
                        </Grid>
                    );
                })}
            </Stack>
        </Box>
    );
};

/* ------------------------ Sefer Bazlı Maliyet Dağılımı ------------------- */
const SeferMaliyetDagilimi = ({ kmMap, seferRows }) => {
    if (!kmMap || Object.keys(kmMap).length === 0 || !seferRows || seferRows.length === 0) return null;

    const maliyetPerKmMap = Object.entries(kmMap)
        .filter(([, data]) => data.DUZELTME_MALIYETI !== undefined && data.DUZELTME_MALIYETI !== 0)
        .reduce((acc, [plaka, data]) => {
            const diff = Number(data.TOPLAM_KM_VE_LITRE_FARKI || 0);
            const maliyetSigned = diff < 0 ? -Number(data.DUZELTME_MALIYETI || 0) : Number(data.DUZELTME_MALIYETI || 0);
            const toplamKm = Number(data.TOPLAM_KM || 0);
            const maliyetPerKm = toplamKm > 0 ? roundToDecimal(maliyetSigned / toplamKm, 4) : 0;
            acc[plaka] = maliyetPerKm;
            return acc;
        }, {});

    const relevantPlates = Object.keys(maliyetPerKmMap);
    if (relevantPlates.length === 0)
        return (
            <Alert severity="info" sx={{ mt: 1, mb: 1, bgcolor: alpha(DARK.primary, 0.1), color: DARK.text }}>
                Maliyet/Hakediş hesaplanan plaka bulunamadı. Seferlere dağıtım yapılamıyor.
            </Alert>
        );

    const list = seferRows
        .map((row) => {
            const plaka = row.plaka?.toUpperCase();
            const km = Number(row.toplam_km || 0);
            const seferNo = row.sefer_no || "TANIMSIZ_SEFER";

            const mpk = maliyetPerKmMap[plaka] || 0;
            const seferMaliyeti = roundToDecimal(km * mpk, 4);
            if (seferMaliyeti === 0) return null;

            return { seferNo, plaka, toplamKm: km, seferMaliyeti };
        })
        .filter(Boolean)
        .sort((a, b) => b.seferMaliyeti - a.seferMaliyeti);

    if (list.length === 0)
        return (
            <Alert severity="warning" sx={{ mt: 1, mb: 1, bgcolor: alpha(DARK.red, 0.1), color: DARK.text }}>
                Hiçbir sefere dağıtılacak Maliyet/Hakediş bulunamadı (KM kayıtları 0 olabilir).
            </Alert>
        );

    return (
        <Box
            sx={{
                mt: 1.5,
                maxHeight: 250,
                overflowY: "auto",
                p: 1,
                bgcolor: DARK.surface,
                borderRadius: 1,
                border: `1px solid ${DARK.border}`,
            }}
        >
            <Typography variant="body2" fontWeight={700} color={DARK.text} mb={1}>
                Sefer Bazlı Maliyet Dağılımı (Prim/Ceza):
            </Typography>

            <Grid container spacing={1} sx={{ bgcolor: DARK.surface2, p: 1, borderRadius: 1 }}>
                <Grid item xs={3}>
                    <Typography variant="caption" fontWeight={700} color={DARK.mint}>
                        Sefer No
                    </Typography>
                </Grid>
                <Grid item xs={3}>
                    <Typography variant="caption" fontWeight={700} color={DARK.textMuted}>
                        Plaka (KM)
                    </Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: "right" }}>
                    <Typography variant="caption" fontWeight={700} color={DARK.primary}>
                        Sefer Maliyeti (TL)
                    </Typography>
                </Grid>
            </Grid>

            <Stack spacing={0.5} mt={0.5}>
                {list.map((d, idx) => {
                    const isPositive = d.seferMaliyeti >= 0;
                    const color = isPositive ? DARK.mint : DARK.red;
                    const label = isPositive ? "Prim" : "Ceza";
                    return (
                        <Grid container key={d.seferNo + idx} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                            <Grid item xs={3}>
                                <Typography variant="caption" color={color} fontWeight={700}>
                                    {d.seferNo}
                                </Typography>
                            </Grid>
                            <Grid item xs={3}>
                                <Typography variant="caption" color={DARK.textMuted}>
                                    {d.plaka} ({Math.round(d.toplamKm)})
                                </Typography>
                            </Grid>
                            <Grid item xs={6} sx={{ textAlign: "right" }}>
                                <Typography variant="caption" fontWeight={700} color={color}>
                                    {formatCurrency(d.seferMaliyeti)} ({label})
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

// ✅ BIGINT güvenli: tms_despatch_id için
const toBigIntStringOrNull = (v) => {
    if (v === null || v === undefined || v === "") return null;

    const s = String(v).trim();

    // 1.23E+17 gibi bilimsel gösterim gelirse
    if (/e\+?/i.test(s)) {
        const n = Number(s);
        if (!Number.isFinite(n)) return null;
        return String(Math.trunc(n));
    }

    // sadece rakamları al
    const digits = s.replace(/\D/g, "");
    return digits ? digits : null;
};

/* ------------------------ Excel Okuma (XLSX) ------------------------------- */
const readXlsxFile = async (file) => {
    const buffer = await file.arrayBuffer();

    let workbook;

    try {
        workbook = XLSX.read(buffer, {
            type: "array",
        });
    } catch (err) {
        console.error("Excel parse hatası:", err);

        throw new Error(
            "Excel dosyası okunamadı. Dosya bozuk olabilir veya gerçek .xlsx değildir."
        );
    }

    const sheetName = workbook.SheetNames?.[0];

    if (!sheetName) {
        throw new Error("Excel içinde sheet bulunamadı.");
    }

    const worksheet = workbook.Sheets[sheetName];

    const jsonRows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false,
    });

    if (!jsonRows.length) {
        throw new Error("Excel dosyası boş.");
    }

    const rawHeaders = jsonRows[0].map((h) =>
        String(h ?? "").trim()
    );

    const processedHeaders = rawHeaders.map((h) =>
        h
            .toLocaleLowerCase("tr-TR")
            .replace(/[^a-z0-9_ğüşöçıİ]/g, "_")
    );

    const rows = jsonRows
        .slice(1)
        .map((row) => {
            const obj = {};

            rawHeaders.forEach((rawHeader, index) => {
                if (!rawHeader) return;

                obj[processedHeaders[index]] = row[index];
            });

            return obj;
        })
        .filter((row) =>
            Object.values(row).some(
                (v) => String(v ?? "").trim() !== ""
            )
        );

    return {
        headers: processedHeaders,
        rows,
    };
};
/* ------------------------ Supabase Batch Insert ------------------- */
const insertBatched = async (table, rows, batchSize = 500) => {
    // ✅ basit kolon guard
    const keys = Object.keys(rows?.[0] || {});
    if (table === "frigo_yakit_tmp") {
        const allowed = new Set(["plaka", "cari_id", "cari_adi", "iskontosuz_birim_fiyat", "birim_fiyat", "yakit_litresi"]);
        const bad = keys.filter((k) => !allowed.has(k));
        if (bad.length) throw new Error(`Yakıt tablosuna yanlış kolon gönderiliyor: ${bad.join(", ")}`);
    }
    if (table === "frigo_sefer_tmp") {
        const allowed = new Set(["musteri_adi", "sefer_no", "tms_despatch_id", "plaka", "toplam_km"]);
        const bad = keys.filter((k) => !allowed.has(k));
        if (bad.length) throw new Error(`Sefer tablosuna yanlış kolon gönderiliyor: ${bad.join(", ")}`);
    }

    let errorCount = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from(table).insert(batch);

        if (error) {
            console.error(`Batch insert error for table ${table} (Batch ${i / batchSize}):`, error);
            console.error("PostgREST message:", error.message);
            console.error("PostgREST details:", error.details);
            console.error("PostgREST hint:", error.hint);
            console.error("PostgREST code:", error.code);
            console.error("Sample row (first):", batch[0]);
            console.error("Sample row (last):", batch[batch.length - 1]);
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = headers.map((h) => {
        const headerLower = String(h).toLocaleLowerCase("tr-TR");
        return {
            header: headerLower,
            key: headerLower.replace(/[^a-z0-9_ğüşöçıö]/gi, "_"),
            width: 22,
        };
    });

    sampleRows.forEach((r) => worksheet.addRow(r));

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
};

const downloadYakitTemplate = async () => {
    await downloadXlsxTemplate(
        "hayat_kimya_yakit_sablon.xlsx",
        "Yakıt Şablonu",
        ["plaka", "cari_id", "cari_adi", "iskontosuz_birim_fiyat", "birim_fiyat", "yakit_litresi"],
        [
            ["34ABC34", 123456, "Örnek Cari", 45.0, 44.9123, 250.5555],
            ["41XYZ41", 222222, "Başka Cari", 44.0, 43.5678, 180.0],
        ]
    );
};

// ✅ Güncel: Sefer şablonu musteri_adi başta
const downloadSeferTemplate = async () => {
    await downloadXlsxTemplate(
        "hayat_kimya_sefer_sablon.xlsx",
        "Sefer Şablonu",
        ["musteri_adi", "sefer_no", "tms_despatch_id", "plaka", "toplam_km"],
        [
            ["HAYAT KİMYA SANAYİ ANONİM ŞİRKETİ", "S1001", 987654321, "34ABC34", 860.3333],
            ["ODAK TEDARİK ZİNCİRİ VE LOJİSTİK ANONİM ŞİRKETİ", "S1002", 987654322, "41XYZ41", 540.0],
            ["DİĞER MÜŞTERİ", "S1003", 987654323, "34ABC34", 50.0],
        ]
    );
};

// Plaka -> cari_id map'i supabase'den toplu çek
const fetchCariIdMapByPlates = async (plates, batchSize = 500) => {
    const map = {};
    const uniquePlates = Array.from(new Set((plates || []).map((p) => String(p || "").toUpperCase().trim()).filter(Boolean)));

    for (let i = 0; i < uniquePlates.length; i += batchSize) {
        const batch = uniquePlates.slice(i, i + batchSize);

        const { data, error } = await supabase.from("arac_cari_ve_fiyat").select("plaka,cari_id").in("plaka", batch);

        if (error) {
            throw new Error("Cari UnvanId çekilirken hata oluştu: " + (error.message || "Bilinmeyen hata"));
        }

        (data || []).forEach((row) => {
            const plaka = String(row.plaka || "").toUpperCase().trim();
            if (!plaka) return;
            map[plaka] = row.cari_id ?? null;
        });
    }

    return map;
};

/* ------------------------ Excel İndir: Sefer Hakediş Detayları (+ Cari UnvanId) ------------------- */
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
        setSnackbar({ open: true, message: "Sefer Hakedişleri Excel'i hazırlanıyor (Cari UnvanId ekleniyor)...", severity: "info" });

        const platesToLookup = seferRows.map((r) => (r.plaka ? String(r.plaka).toUpperCase().trim() : "")).filter(Boolean);
        const cariIdMap = await fetchCariIdMapByPlates(platesToLookup);

        // plaka -> (toplamHakedis, maliyetPerKm, _distributedTotal)
        const plakaDataMap = Object.entries(kmMap)
            .filter(([, data]) => data.DUZELTME_MALIYETI !== undefined && data.DUZELTME_MALIYETI !== 0)
            .reduce((acc, [plaka, data]) => {
                const diff = Number(data.TOPLAM_KM_VE_LITRE_FARKI || 0);
                const toplamHakedis = diff < 0 ? -(Number(data.DUZELTME_MALIYETI || 0)) : Number(data.DUZELTME_MALIYETI || 0);
                const toplamKm = Number(data.TOPLAM_KM || 0);
                const maliyetPerKm = toplamKm > 0 ? toplamHakedis / toplamKm : 0;

                acc[plaka.toUpperCase()] = { toplamHakedis, maliyetPerKm, _distributedTotal: 0 };
                return acc;
            }, {});

        const sortedSeferRows = [...seferRows].sort((a, b) => {
            const plakaA = a.plaka?.toUpperCase() || "ZZZ";
            const plakaB = b.plaka?.toUpperCase() || "ZZZ";
            if (plakaA < plakaB) return -1;
            if (plakaA > plakaB) return 1;
            return (a.sefer_no || "").localeCompare(b.sefer_no || "");
        });

        const dataForExcel = [];

        for (let i = 0; i < sortedSeferRows.length; i++) {
            const row = sortedSeferRows[i];
            const plaka = row.plaka?.toUpperCase();

            const nextRow = sortedSeferRows[i + 1];
            const nextPlaka = nextRow ? nextRow.plaka?.toUpperCase() : null;
            const isLastTripForPlaka = plaka !== nextPlaka;

            const plakaData = plakaDataMap[plaka];
            const km = Number(row.toplam_km || 0);

            let seferMaliyeti = 0;

            if (plakaData) {
                if (isLastTripForPlaka) {
                    seferMaliyeti = plakaData.toplamHakedis - plakaData._distributedTotal;
                    seferMaliyeti = roundToDecimal(seferMaliyeti, 4);
                } else {
                    seferMaliyeti = roundToDecimal(km * plakaData.maliyetPerKm, 4);
                    plakaData._distributedTotal += seferMaliyeti;
                }
            }

            const cariUnvanId = cariIdMap[plaka] ?? null;

            dataForExcel.push({
                musteri_adi: row.musteri_adi ?? null,
                sefer_no: row.sefer_no,
                tms_despatch_id: row.tms_despatch_id,
                plaka: row.plaka,
                toplam_km: row.toplam_km,
                sefer_hakedisi_tl: seferMaliyeti,
                cari_unvan_id: cariUnvanId,
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("HAYAT KİMYA Sefer Hakediş Detayları");

        worksheet.columns = [
            { header: "MÜŞTERİ ADI", key: "musteri_adi", width: 40 },
            { header: "SEFER NO", key: "sefer_no", width: 15 },
            { header: "TMS DESPATCH ID", key: "tms_despatch_id", width: 18 },
            { header: "PLAKA", key: "plaka", width: 12 },
            { header: "TOPLAM KM", key: "toplam_km", width: 15, style: { numFmt: "0" } },
            { header: "SEFER HAKEDİŞİ (TL)", key: "sefer_hakedisi_tl", width: 25, style: { numFmt: "₺#,##0.0000;[Red]-₺#,##0.0000" } },
            { header: "Cari UnvanId", key: "cari_unvan_id", width: 16, style: { numFmt: "0" } },
        ];

        worksheet.addRows(dataForExcel);

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "hayat_kimya_sefer_hakedis_detaylari.xlsx");

        setSnackbar({ open: true, message: "Sefer Hakedişleri Excel dosyası (Cari UnvanId ile) indirildi.", severity: "success" });
    } catch (error) {
        console.error("Excel indirme hatası:", error);
        setSnackbar({ open: true, message: error.message || "Excel dosyası oluşturulurken hata oluştu.", severity: "error" });
    }
};

/* ------------------------ Excel İndir: Özet Data (KM_36 / KM_37) ------------------- */
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
        setSnackbar({ open: true, message: "Özet Data Excel'i hazırlanıyor (Müşteri oranlı %36/%37)...", severity: "info" });

        const yakitOzetMap = yakitRows.reduce((acc, row) => {
            const plaka = row.plaka?.toUpperCase();
            if (!plaka) return acc;

            if (!acc[plaka]) {
                acc[plaka] = {
                    cari_id: row.cari_id ?? null,
                    cari_adi: row.cari_adi ?? null,
                    _sum_birim: 0,
                    _sum_iskontosuz: 0,
                    _cnt: 0,
                };
            }
            const birim = Number(row.birim_fiyat) || 0;
            const isk = Number(row.iskontosuz_birim_fiyat) || 0;

            acc[plaka]._sum_birim += birim;
            acc[plaka]._sum_iskontosuz += isk;
            acc[plaka]._cnt += 1;

            return acc;
        }, {});

        Object.keys(yakitOzetMap).forEach((plaka) => {
            const o = yakitOzetMap[plaka];
            const cnt = o._cnt || 0;
            o.birim_fiyat = cnt > 0 ? o._sum_birim / cnt : 0;
            o.iskontosuz_birim_fiyat = cnt > 0 ? o._sum_iskontosuz / cnt : 0;
            delete o._sum_birim;
            delete o._sum_iskontosuz;
            delete o._cnt;
        });

        const dataForExcel = Object.entries(kmMap)
            .map(([plaka, d]) => {
                const yakitOzet = yakitOzetMap[plaka] || {};

                const km36 = Number(d.KM_36) || 0;
                const km37 = Number(d.KM_37) || 0;
                const toplamKm = Number(d.TOPLAM_KM) || 0;

                const tahminiTuketim = Number(d.TOPLAM_TUKETIM) || 0;
                const gercekYakit = Number(d.TOPLAM_YAKIT_LITRESI) || 0;
                const farkLitre = Number(d.TOPLAM_KM_VE_LITRE_FARKI) || 0;

                const birimFiyat = Number(yakitOzet.birim_fiyat) || 0;
                const iskontosuzBirimFiyat = Number(yakitOzet.iskontosuz_birim_fiyat) || 0;

                const hakedisTutar = Number(d.DUZELTME_MALIYETI) || 0;

                return {
                    plaka,
                    cari_id: yakitOzet.cari_id ?? null,
                    cari_adi: yakitOzet.cari_adi ?? "BİLİNMİYOR",

                    km_36: km36,
                    km_37: km37,
                    toplam_km: toplamKm,

                    hakedis_litresi: tahminiTuketim,
                    yakit_alim_litresi: gercekYakit,
                    yakit_fark_litre: farkLitre,
                    birim_fiyat: birimFiyat,
                    iskontosuz_birim_fiyat: iskontosuzBirimFiyat,
                    hakedis_tutar: hakedisTutar,
                };
            })
            .filter((d) => d.toplam_km !== 0 || d.hakedis_litresi !== 0 || d.yakit_alim_litresi !== 0 || d.yakit_fark_litre !== 0 || d.hakedis_tutar !== 0);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("HAYAT KİMYA Özet Plaka Analiz");

        worksheet.columns = [
            { header: "PLAKA", key: "plaka", width: 12 },
            { header: "CARİ İD", key: "cari_id", width: 10 },
            { header: "CARİ ADI", key: "cari_adi", width: 30 },

            { header: "KM (%36)", key: "km_36", width: 16, style: { numFmt: "0.0000" } },
            { header: "KM (%37)", key: "km_37", width: 16, style: { numFmt: "0.0000" } },
            { header: "TOPLAM KM", key: "toplam_km", width: 16, style: { numFmt: "0.0000" } },

            { header: "HAKEDİŞ LİTRESİ", key: "hakedis_litresi", width: 20, style: { numFmt: "0.0000" } },
            { header: "YAKIT ALIM LİTRESİ", key: "yakit_alim_litresi", width: 20, style: { numFmt: "0.0000" } },
            { header: "YAKIT FARK LİTRE", key: "yakit_fark_litre", width: 20, style: { numFmt: "0.0000;[Red]-0.0000" } },
            { header: "BİRİM FİYAT", key: "birim_fiyat", width: 16, style: { numFmt: "₺#,##0.0000" } },
            { header: "İSKONTOSUZ BİRİM FİYAT", key: "iskontosuz_birim_fiyat", width: 24, style: { numFmt: "₺#,##0.0000" } },
            { header: "HAKEDİŞ TUTAR (TL)", key: "hakedis_tutar", width: 22, style: { numFmt: "₺#,##0.0000" } },
        ];

        worksheet.addRows(dataForExcel);

        // fark < 0 ise HAKEDİŞ TUTAR kırmızı
        {
            const farkColIndex = worksheet.getColumn("yakit_fark_litre").number;
            const tutarColIndex = worksheet.getColumn("hakedis_tutar").number;

            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber === 1) return;

                const raw = row.getCell(farkColIndex).value;
                const farkValue = raw && typeof raw === "object" && raw.result != null ? Number(raw.result) : Number(raw);

                if (Number.isFinite(farkValue) && farkValue < 0) {
                    const tutarCell = row.getCell(tutarColIndex);
                    tutarCell.font = { ...(tutarCell.font || {}), color: { argb: "FFFF0000" } };
                }
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "hayat_kimya_ozet_plaka_analiz.xlsx");

        setSnackbar({ open: true, message: "Özet Plaka Analiz Excel dosyası başarıyla indirildi.", severity: "success" });
    } catch (error) {
        console.error("Özet Data indirme hatası:", error);
        setSnackbar({ open: true, message: error.message || "Özet Data Excel dosyası oluşturulurken hata oluştu.", severity: "error" });
    }
};

/* ================================ ANA HESAPLAMA ================================ */
export function HayatKimyaHesaplama({ yakitInfo, seferInfo, setSnackbar, startTrigger, setStartTrigger }) {
    const seferRows = seferInfo?.allRows || [];
    const yakitRows = yakitInfo?.allRows || [];

    const MAX_STEP = 4;
    const [currentStep, setCurrentStep] = useState(0);
    const [sonucData, setSonucData] = useState(null);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startTrigger, yakitInfo, seferInfo, hakedisVeriHazir, setStartTrigger]);

    const handleHakedisStart = useCallback(async () => {
        if (!hakedisVeriHazir) return;

        setCurrentStep(1);
        setSonucData(null);
        setKmData(null);

        let kmMap = {};
        let totalUniquePlates = 0;
        let totalKm = 0;

        try {
            setCurrentStep(1);
            await new Promise((r) => setTimeout(r, 350));

            if (!seferRows.length || !yakitRows.length) {
                throw new Error("Sefer ve/veya Yakıt verisi bulunamadı. Lütfen Excel dosyalarını yükleyiniz.");
            }

            // ADIM 2: plaka bazlı km + km_36 / km_37 + tahmini tüketim
            setCurrentStep(2);

            seferRows.forEach((row) => {
                const plaka = row.plaka?.toUpperCase() || "BILINMEYEN";
                const km = Number(row.toplam_km || 0);
                totalKm += km;

                if (plaka === "BILINMEYEN" || km === 0) return;

                if (!kmMap[plaka]) {
                    kmMap[plaka] = { KM_36: 0, KM_37: 0, TOPLAM_KM: 0, TOPLAM_TUKETIM: 0 };
                }

                const rate = getRateByMusteri(row.musteri_adi);
                if (rate === 0.36) kmMap[plaka].KM_36 += km;
                else kmMap[plaka].KM_37 += km;

                kmMap[plaka].TOPLAM_KM += km;
                kmMap[plaka].TOPLAM_TUKETIM += km * rate; // ✅ müşteri adına göre oran
            });

            totalUniquePlates = Object.keys(kmMap).length;

            // toplam tahmini tüketim
            let toplamTahminiTuketim = 0;
            Object.keys(kmMap).forEach((p) => (toplamTahminiTuketim += Number(kmMap[p].TOPLAM_TUKETIM || 0)));

            // yuvarlama
            Object.keys(kmMap).forEach((p) => {
                kmMap[p].KM_36 = roundToDecimal(kmMap[p].KM_36, 4);
                kmMap[p].KM_37 = roundToDecimal(kmMap[p].KM_37, 4);
                kmMap[p].TOPLAM_KM = roundToDecimal(kmMap[p].TOPLAM_KM, 4);
                kmMap[p].TOPLAM_TUKETIM = roundToDecimal(kmMap[p].TOPLAM_TUKETIM, 4);
            });

            setKmData({ totalUniquePlates, totalKm, kmMap: { ...kmMap }, toplamTahminiTuketim });
            await new Promise((r) => setTimeout(r, 650));

            // ADIM 3: burada sadece “gösterim” akışı (zaten tüketim hesaplandı)
            setCurrentStep(3);
            await new Promise((r) => setTimeout(r, 650));

            // ADIM 4: yakıt eşleştirme + fark + maliyet
            setCurrentStep(4);

            let toplamHakedisLitre = 0;
            let eslesenYakitKayitSayisi = 0;
            let genelToplamTuketimVeLitreFarki = 0;
            let genelToplamDuzeltmeMaliyeti = 0;

            const yakitMap = yakitRows.reduce((acc, yakit) => {
                const plaka = yakit.plaka?.toUpperCase() || "BILINMEYEN_YAKIT";
                const litre = Number(yakit.yakit_litresi || 0);
                const birimFiyat = Number(yakit.birim_fiyat || 0);
                const iskontosuzFiyat = Number(yakit.iskontosuz_birim_fiyat || 0);

                if (plaka === "BILINMEYEN_YAKIT" || litre === 0) return acc;

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

            const tuketimVeFarkMap = { ...kmMap };
            const tumPlakalar = Object.keys(tuketimVeFarkMap);

            tumPlakalar.forEach((plaka) => {
                const data = tuketimVeFarkMap[plaka];
                const yakitData = finalYakitMap[plaka] || { toplamLitre: 0, avgBirimFiyat: 0, avgIskontosuzFiyat: 0 };

                const toplamYakit = Number(yakitData.toplamLitre || 0);
                const tahminiTuketim = Number(data.TOPLAM_TUKETIM || 0);

                const tuketimLitreFarki = tahminiTuketim - toplamYakit;
                genelToplamTuketimVeLitreFarki += tuketimLitreFarki;

                let duzeltmeMaliyeti = 0;
                if (tuketimLitreFarki > 0) {
                    duzeltmeMaliyeti = tuketimLitreFarki * Number(yakitData.avgBirimFiyat || 0);
                } else if (tuketimLitreFarki < 0) {
                    duzeltmeMaliyeti = Math.abs(tuketimLitreFarki) * Number(yakitData.avgIskontosuzFiyat || 0);
                }
                genelToplamDuzeltmeMaliyeti += duzeltmeMaliyeti;

                tuketimVeFarkMap[plaka].TOPLAM_YAKIT_LITRESI = roundToDecimal(toplamYakit, 4);
                tuketimVeFarkMap[plaka].TOPLAM_KM_VE_LITRE_FARKI = roundToDecimal(tuketimLitreFarki, 4);
                tuketimVeFarkMap[plaka].DUZELTME_MALIYETI = roundToDecimal(duzeltmeMaliyeti, 4);

                if (toplamYakit > 0 && tahminiTuketim > 0) {
                    const hakedisLitre = tahminiTuketim * 0.9;
                    toplamHakedisLitre += hakedisLitre;

                    eslesenYakitKayitSayisi += yakitRows.filter((y) => y.plaka?.toUpperCase() === plaka).length || 1;
                }
            });

            setKmData((prev) => ({
                ...prev,
                kmMap: tuketimVeFarkMap,
                genelToplamKmVeLitreFarki: roundToDecimal(genelToplamTuketimVeLitreFarki, 4),
                genelToplamDuzeltmeMaliyeti: roundToDecimal(genelToplamDuzeltmeMaliyeti, 4),
            }));

            const nihaiHakedisTL = toplamHakedisLitre * 45.0;

            await new Promise((r) => setTimeout(r, 350));

            setSonucData({
                toplamYakit: yakitInfo.kayitSayisi,
                toplamSefer: seferInfo.kayitSayisi,
                eslesenKayit: eslesenYakitKayitSayisi,
                totalUniquePlates: totalUniquePlates,
                toplamKm: totalKm,
                hakedisLitre: toplamHakedisLitre,
                hakedisTL: nihaiHakedisTL,
                genelKmLitreFarki: genelToplamTuketimVeLitreFarki,
                genelDuzeltmeMaliyeti: genelToplamDuzeltmeMaliyeti,
            });

            setCurrentStep(MAX_STEP);

            setSnackbar({
                open: true,
                message: "Hakediş hesaplaması başarıyla tamamlandı. Sonuçlar aşağıdadır.",
                severity: "success",
            });
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
        const done = currentStep === MAX_STEP;

        return (
            <Button
                variant="outlined"
                onClick={handleHakedisStart}
                disabled={!hakedisVeriHazir || isLoading}
                startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
                sx={{ borderColor: DARK.primary, color: DARK.primary, mt: 2 }}
            >
                {isLoading ? `Hesaplanıyor... (Aşama ${currentStep}/${MAX_STEP})` : done ? "Yeniden Hesapla" : "HESAPLAMAYI BAŞLAT"}
            </Button>
        );
    };

    return (
        <Box sx={{ mt: 3 }}>
            {currentStep === -1 && (
                <Alert severity="error" sx={{ bgcolor: alpha(DARK.red, 0.1), color: DARK.text, border: `1px solid ${DARK.red}` }}>
                    <Box fontWeight={700}>**HATA:** Hesaplama işlemi durduruldu.</Box> Lütfen console'a bakınız veya yukarıdaki uyarı mesajını kontrol ediniz.
                    {renderActionButton()}
                </Alert>
            )}

            {hakedisVeriHazir && (currentStep < MAX_STEP || currentStep === MAX_STEP) && (
                <Glass
                    sx={{
                        p: 3,
                        borderRadius: 3,
                        borderColor: currentStep > 0 ? alpha(DARK.mint, 0.55) : alpha(DARK.border, 0.9),
                        transition: "border-color 0.3s",
                    }}
                >
                    <Typography variant="h6" fontWeight={800} color={DARK.text} mb={2}>
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
                            description={`Plaka Bazlı KM Toplamları Hesaplama (Müşteri bazlı %36/%37 kırılımı)`}
                        />

                        {currentStep >= 2 && kmData && kmData.totalUniquePlates > 0 && (
                            <Box sx={{ ml: 4, my: 1, p: 1, bgcolor: DARK.surface2, borderRadius: 1 }}>
                                <Typography variant="caption" color={DARK.mint} fontWeight={700}>
                                    **KM Özeti (Adım 1):** {kmData.totalUniquePlates} benzersiz plaka için KM değerleri hesaplandı.
                                </Typography>
                                <PlakaKmList kmMap={kmData.kmMap} showCalculation={1} />
                            </Box>
                        )}

                        <ProgressStep
                            step={3}
                            currentStep={currentStep}
                            icon={FilterDramaIcon}
                            description={`Plaka Bazlı Tahmini Tüketim Hesaplama (musteri_adi → %36/%37)`}
                        />

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
                </Glass>
            )}

            {currentStep === MAX_STEP && kmData && kmData.kmMap && (
                <Glass sx={{ p: 2, borderRadius: 3, borderColor: alpha(DARK.primary, 0.5), mt: 3 }}>
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Plaka Bazlı Tahmini Tüketim / Gerçek Yakıt Fark Analizi 📊
                    </Typography>

                    <PlakaKmList kmMap={kmData.kmMap} showCalculation={3} />

                    {kmData.genelToplamDuzeltmeMaliyeti !== undefined && (
                        <Alert
                            severity={kmData.genelToplamKmVeLitreFarki >= 0 ? "info" : "warning"}
                            sx={{ mt: 2, bgcolor: alpha(DARK.primary, 0.1), color: DARK.text, border: `1px solid ${DARK.border}` }}
                        >
                            <Typography variant="body1" fontWeight={700}>
                                Genel Tahmini Tüketim - Yakıt Farkı:{" "}
                                <span style={{ color: kmData.genelToplamKmVeLitreFarki >= 0 ? DARK.mint : DARK.red }}>
                                    {formatNumber(kmData.genelToplamKmVeLitreFarki)} L
                                </span>
                            </Typography>
                            <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
                                Genel Düzeltme Maliyeti: <span style={{ color: DARK.primary }}>{formatCurrency(kmData.genelToplamDuzeltmeMaliyeti)}</span>
                            </Typography>
                        </Alert>
                    )}
                </Glass>
            )}

            {currentStep === MAX_STEP && kmData && kmData.kmMap && (
                <Glass sx={{ p: 2, borderRadius: 3, borderColor: alpha(DARK.mint, 0.5), mt: 3 }}>
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Plaka Bazlı Hakediş / Ceza Detayı 💰
                    </Typography>
                    <PlakaHakedisList kmMap={kmData.kmMap} />
                </Glass>
            )}

            {currentStep === MAX_STEP && kmData && kmData.kmMap && seferInfo && (
                <Glass sx={{ p: 2, borderRadius: 3, borderColor: alpha(DARK.primary, 0.5), mt: 3 }}>
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Plaka Bazlı Maliyet Dağılımı Oranı (TL/KM) 📈
                    </Typography>
                    <SeferHakedisList kmMap={kmData.kmMap} seferRows={seferInfo.allRows} />
                </Glass>
            )}

            {currentStep === MAX_STEP && kmData && kmData.kmMap && seferInfo && (
                <Glass sx={{ p: 2, borderRadius: 3, borderColor: alpha(DARK.red, 0.55), mt: 3 }}>
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Sefer Bazlı Maliyet Dağılımı (Sefer No'ya Göre) 💸
                    </Typography>
                    <SeferMaliyetDagilimi kmMap={kmData.kmMap} seferRows={seferInfo.allRows} />
                </Glass>
            )}

            {isCompleted && kmData && seferInfo && yakitInfo && (
                <Glass sx={{ p: 2, borderRadius: 3, borderColor: alpha(DARK.mint, 0.55), mt: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                        <FileDownloadIcon sx={{ color: DARK.mint, fontSize: 24 }} />
                        <Typography variant="h6" fontWeight={800}>
                            Çıktıları İndireceğiniz Alan
                        </Typography>
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mt={2}>
                        <Button
                            variant="contained"
                            startIcon={<FileDownloadIcon />}
                            onClick={() => downloadSeferHakedisleri(kmData.kmMap, seferInfo.allRows, setSnackbar)}
                            sx={{ bgcolor: DARK.mint, color: DARK.surface2, fontWeight: 700, "&:hover": { bgcolor: alpha(DARK.mint, 0.85) } }}
                        >
                            Sefer Hakedişleri Raporunu İndir
                        </Button>

                        <Button
                            variant="contained"
                            startIcon={<FileDownloadIcon />}
                            onClick={() => downloadOzetData(kmData.kmMap, yakitInfo.allRows, setSnackbar)}
                            sx={{ bgcolor: DARK.primary, color: DARK.text, fontWeight: 700, "&:hover": { bgcolor: alpha(DARK.primary, 0.85) } }}
                        >
                            Özet Data İndir
                        </Button>
                    </Stack>
                </Glass>
            )}

            {!hakedisVeriHazir && (
                <Alert severity="warning" sx={{ mt: 2, bgcolor: alpha(DARK.red, 0.1), color: DARK.text, border: `1px solid ${DARK.red}` }}>
                    **3. Adım beklemede.** Lütfen Yakıtlar ve Seferler dosyalarını yükleyiniz.
                </Alert>
            )}
        </Box>
    );
}

/* ================================ ANA SAYFA ================================ */
export default function HayatKimyaYakitHakedis() {
    const [yakitInfo, setYakitInfo] = useState(null);
    const [seferInfo, setSeferInfo] = useState(null);
    const [yakitPreviewOpen, setYakitPreviewOpen] = useState(false);

    const [startCalculation, setStartCalculation] = useState(false);

    const [loadingYakit, setLoadingYakit] = useState(false);
    const [loadingSefer, setLoadingSefer] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

    const accept = ".xlsx";

    const handleSnackbarClose = () => setSnackbar({ ...snackbar, open: false });

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

            // ✅ Yakıt şablonunun zorunlu kolonları
            const expectedKeys = ["plaka", "cari_id", "cari_adi", "iskontosuz_birim_fiyat", "birim_fiyat", "yakit_litresi"];

            const missing = expectedKeys.filter((key) => !headers.includes(key));
            if (missing.length) {
                const userFriendlyMissing = missing.map((m) => m.toUpperCase().replace(/_/g, " "));
                throw new Error(
                    "Şablon hatası: Eksik başlık(lar) var. Lütfen tam olarak: " + userFriendlyMissing.join(", ") + " başlıklarını kullanın."
                );
            }

            // ✅ Yakıt payload (SADECE yakıt kolonları!)
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

            if (!clean.length) throw new Error("Dosyada geçerli satır bulunamadı.");

            // ✅ geçici tabloyu temizle
            const { error: deleteError } = await supabase.from("frigo_yakit_tmp").delete().neq("plaka", "__never__");
            if (deleteError) throw new Error("Önceki kayıtlar silinemedi.");

            // ✅ insert (insertBatched zaten kolon guard içeriyor)
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

            // ✅ Güncel: musteri_adi zorunlu
            const expectedKeys = ["musteri_adi", "sefer_no", "tms_despatch_id", "plaka", "toplam_km"];
            const missing = expectedKeys.filter((key) => !headers.includes(key));

            if (missing.length) {
                const userFriendlyMissing = missing.map((m) => m.toUpperCase().replace(/_/g, " "));
                throw new Error(
                    "Şablon hatası: Eksik başlık(lar) var. Lütfen tam olarak: " + userFriendlyMissing.join(", ") + " başlıklarını kullanın."
                );
            }

            const payload = rows.map((r) => ({
                musteri_adi: toStrOrNull(r["musteri_adi"]),
                sefer_no: toStrOrNull(r["sefer_no"]),
                // ✅ bigint-safe
                tms_despatch_id: toBigIntStringOrNull(r["tms_despatch_id"]),
                plaka: toStrOrNull(r["plaka"]),
                toplam_km: toNumOrNull(r["toplam_km"]),
            }));

            const clean = payload.filter((p) => p.musteri_adi || p.sefer_no || p.tms_despatch_id !== null || p.plaka || p.toplam_km !== null);
            if (!clean.length) throw new Error("Dosyada geçerli satır bulunamadı.");

            const { error: deleteError } = await supabase.from("frigo_sefer_tmp").delete().neq("plaka", "__never__");
            if (deleteError) throw new Error("Önceki kayıtlar silinemedi.");

            await insertBatched("frigo_sefer_tmp", clean);
            setSeferInfo({ fileName: file.name, kayitSayisi: clean.length, preview: clean.slice(0, 5), allRows: clean });

            setSnackbar({ open: true, message: `Seferler dosyası başarıyla yüklendi. ${clean.length} kayıt işlendi.`, severity: "success" });
        } catch (err) {
            console.error("Sefer yükleme hatası:", err);
            setSnackbar({ open: true, message: err.message || "Seferler yüklenemedi: Bilinmeyen hata", severity: "error" });
        } finally {
            setLoadingSefer(false);
        }
    }, []);

    /* ------------------ Temizle (Geçici Tabloları Sil) -------------- */
    const handleTemizle = useCallback(async () => {
        if (!window.confirm("Geçici tabloları temizlemek istediğinizden emin misiniz?")) return;

        try {
            setCleaning(true);
            const { error: yakitError } = await supabase.from("frigo_yakit_tmp").delete().neq("plaka", "__never__");
            const { error: seferError } = await supabase.from("frigo_sefer_tmp").delete().neq("plaka", "__never__");

            if (yakitError || seferError) throw new Error("Tablolar silinirken Supabase hatası oluştu.");

            setYakitInfo(null);
            setSeferInfo(null);
            setStartCalculation(false);

            setSnackbar({ open: true, message: "Geçici tablolar başarıyla temizlendi. Lütfen yeni dosyaları yükleyin.", severity: "info" });
        } catch (err) {
            console.error("Temizleme hatası:", err);
            setSnackbar({ open: true, message: "Tablolar temizlenemedi: " + (err?.message || "bilinmeyen hata"), severity: "error" });
        } finally {
            setCleaning(false);
        }
    }, []);

    const Card = ({ title, icon, children, loaded }) => (
        <Paper
            variant="outlined"
            sx={{
                p: 2.25,
                flex: 1,
                minWidth: 320,
                borderRadius: 3,
                bgcolor: alpha(DARK.surface, 0.72),
                backdropFilter: "blur(10px)",
                borderColor: loaded ? alpha(DARK.mint, 0.5) : alpha(DARK.border, 0.9),
                boxShadow: loaded ? `0 10px 34px ${alpha(DARK.mint, 0.08)}` : `0 10px 34px ${alpha("#000", 0.25)}`,
                transition: "all .25s ease",
                "&:hover": {
                    transform: "translateY(-2px)",
                    borderColor: loaded ? alpha(DARK.mint, 0.65) : alpha(DARK.primary, 0.4),
                },
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
                        sx={{ ml: "auto", bgcolor: alpha(DARK.mint, 0.15), color: DARK.mint, border: `1px solid ${alpha(DARK.mint, 0.35)}` }}
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
        <Box
            sx={{
                p: { xs: 2, md: 3 },
                color: DARK.text,
                minHeight: "100vh",
                bgcolor: DARK.pageBg,
                backgroundImage: `
          radial-gradient(1200px 600px at 10% -10%, ${alpha(DARK.primary, 0.22)} 0%, transparent 55%),
          radial-gradient(900px 500px at 95% 0%, ${alpha(DARK.mint, 0.18)} 0%, transparent 55%),
          linear-gradient(180deg, ${DARK.pageBg} 0%, ${alpha("#000", 0.35)} 100%)
        `,
                position: "relative",
                overflow: "hidden",
                "&:before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `linear-gradient(${alpha("#fff", 0.04)} 1px, transparent 1px),
                           linear-gradient(90deg, ${alpha("#fff", 0.04)} 1px, transparent 1px)`,
                    backgroundSize: "32px 32px",
                    opacity: 0.45,
                    pointerEvents: "none",
                },
            }}
        >
            <Box sx={{ position: "relative", zIndex: 1 }}>
                <SectionTitle
                    icon={<AssessmentIcon sx={{ color: DARK.primary, fontSize: 28 }} />}
                    title="Hayat Kimya Yakıt Hakediş"
                    subtitle="Hayat Kimya ve Odak Lojistik carileri için %36; diğer tüm müşteri carilerine ait seferler için ise %37 yakma oranı uygulanacak şekilde hesaplama yapılmaktadır."
                    right={
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={downloadYakitTemplate}
                                sx={{ borderColor: DARK.primary, color: DARK.primary }}
                            >
                                Yakıt Şablonu
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={downloadSeferTemplate}
                                sx={{ borderColor: DARK.primary, color: DARK.primary }}
                            >
                                Sefer Şablonu
                            </Button>
                            <Button
                                size="small"
                                variant="contained"
                                startIcon={cleaning ? <CircularProgress size={16} color="inherit" /> : <DeleteSweepIcon />}
                                onClick={handleTemizle}
                                disabled={cleaning}
                                sx={{ bgcolor: DARK.red, color: DARK.text, "&:hover": { bgcolor: alpha(DARK.red, 0.82) } }}
                            >
                                {cleaning ? "Temizleniyor" : "Geçici Tabloları Temizle"}
                            </Button>
                        </Stack>
                    }
                />

                <Grid container spacing={2} sx={{ mt: 2, mb: 3 }}>
                    <Grid item xs={12} md={4}>
                        <KpiCard
                            label="Yakıt kayıtları"
                            value={yakitInfo ? `${yakitInfo.kayitSayisi}` : "—"}
                            icon={<LocalGasStationIcon sx={{ color: DARK.primary }} />}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <KpiCard
                            label="Sefer kayıtları"
                            value={seferInfo ? `${seferInfo.kayitSayisi}` : "—"}
                            icon={<LocalShippingIcon sx={{ color: DARK.primary }} />}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <KpiCard
                            label="Hazırlık durumu"
                            value={hakedisVeriHazir ? "Hazır" : "Bekleniyor"}
                            icon={<CheckCircleIcon sx={{ color: hakedisVeriHazir ? DARK.mint : DARK.textMuted }} />}
                            tone={hakedisVeriHazir ? "success" : "default"}
                        />
                    </Grid>
                </Grid>

                <Stack direction={{ xs: "column", md: "row" }} spacing={3} mb={3}>
                    <Card
                        title={yakitInfo ? `Yakıtlar: ${yakitInfo.fileName} (${yakitInfo.kayitSayisi} kayıt)` : "1) Yakıtlar Şablonu Yükle"}
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
                                sx={{ bgcolor: DARK.primary, color: DARK.text, "&:hover": { bgcolor: alpha(DARK.primary, 0.8) } }}
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

                    <Card
                        title={seferInfo ? `Seferler: ${seferInfo.fileName} (${seferInfo.kayitSayisi} kayıt)` : "2) Seferler Şablonu Yükle"}
                        icon={<LocalShippingIcon sx={{ color: DARK.primary, fontSize: 24 }} />}
                        loaded={!!seferInfo}
                    >
                        <Typography variant="body2" color={DARK.textMuted} mb={1}>
                            musteri_adi, sefer no, tms id, plaka ve toplam km bilgilerini içeren Excel dosyasını yükleyin.
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

                <Glass
                    sx={{
                        mb: 3,
                        p: 2,
                        borderColor: hakedisVeriHazir ? alpha(DARK.mint, 0.55) : alpha(DARK.border, 0.9),
                        backgroundImage: `linear-gradient(90deg, ${alpha(DARK.mint, 0.08)} 0%, transparent 45%, ${alpha(DARK.primary, 0.10)} 100%)`,
                    }}
                >
                    <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "stretch", md: "center" }} spacing={2}>
                        <Button
                            variant="contained"
                            onClick={() => setStartCalculation(true)}
                            disabled={!hakedisVeriHazir || isCalculationStarting}
                            startIcon={isCalculationStarting ? <CircularProgress size={20} color="inherit" /> : <AssessmentIcon />}
                            sx={{
                                bgcolor: DARK.mint,
                                color: DARK.surface2,
                                fontWeight: 900,
                                borderRadius: 2.5,
                                py: 1.2,
                                "&:disabled": { bgcolor: alpha(DARK.mint, 0.25), color: alpha(DARK.text, 0.45) },
                                "&:hover": { bgcolor: alpha(DARK.mint, 0.85) },
                            }}
                        >
                            {isCalculationStarting ? "Hesaplama Başlatılıyor..." : "Hakedişi Başlat ve Sonuçları Gör"}
                        </Button>

                        <Divider orientation="vertical" flexItem sx={{ borderColor: DARK.border, display: { xs: "none", md: "block" } }} />

                        <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ color: DARK.textMuted }}>
                                Her iki dosya yüklendikten sonra işlemi başlatın. Tüketim oranı <b>musteri_adi</b>&apos;ye göre <b>%36 / %37</b> olarak hesaplanır.
                            </Typography>
                        </Box>
                    </Stack>
                </Glass>

                <HayatKimyaHesaplama
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
                        sx: { borderRadius: 3, bgcolor: DARK.surface, color: DARK.text, border: `1px solid ${DARK.border}` },
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
                                        {["#", "PLAKA", "CARİ_ID", "CARİ_ADI", "İSKONTOSUZ BİRİM FİYAT", "BİRİM FİYAT", "YAKIT LİTRESİ"].map((h) => (
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
                            sx={{ bgcolor: DARK.primary, color: DARK.text, "&:hover": { bgcolor: alpha(DARK.primary, 0.8) } }}
                        >
                            Onayla ve Kapat
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Snackbar Bildirimleri */}
                <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
                    <Alert onClose={handleSnackbarClose} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </Box>
    );
}
