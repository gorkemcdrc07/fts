import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Box,
    Stack,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Alert,
    Grid,
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
    Chip,
    Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
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
import BusinessIcon from "@mui/icons-material/Business";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { supabase } from "../supabaseClient";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/* ------------------------ Tema ------------------------ */
const DARK = {
    pageBg: "#07111F",
    surface: "#0F1B2D",
    surface2: "#16263D",
    border: "#27476F",
    text: "#F5F9FF",
    textMuted: "#AFC4E6",
    zebra: "#102038",
    primary: "#005CB9",
    mint: "#7FDBFF",
    red: "#E32934",
};

/* ------------------------ Yardımcı Bileşenler ------------------------ */
const Glass = ({ children, sx }) => (
    <Paper
        variant="outlined"
        sx={{
            borderRadius: 3,
            borderColor: alpha(DARK.border, 0.9),
            bgcolor: alpha(DARK.surface, 0.78),
            backdropFilter: "blur(10px)",
            boxShadow: `0 12px 40px ${alpha("#000", 0.35)}`,
            ...sx,
        }}
    >
        {children}
    </Paper>
);

const SectionTitle = ({ icon, title, subtitle, right }) => (
    <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={1.5}
    >
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
                <Typography
                    variant="h5"
                    sx={{ fontWeight: 950, color: DARK.text, letterSpacing: 0.2 }}
                >
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

const KpiCard = ({ label, value, icon, tone = "default" }) => {
    const palette =
        tone === "success"
            ? { bg: alpha(DARK.mint, 0.12), bd: alpha(DARK.mint, 0.35), fg: DARK.mint }
            : tone === "danger"
                ? { bg: alpha(DARK.red, 0.12), bd: alpha(DARK.red, 0.35), fg: DARK.red }
                : { bg: alpha(DARK.primary, 0.1), bd: alpha(DARK.primary, 0.28), fg: DARK.text };

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
                    <Typography
                        variant="h6"
                        sx={{ fontWeight: 900, color: palette.fg, lineHeight: 1.15 }}
                    >
                        {value}
                    </Typography>
                </Box>
            </Stack>
        </Glass>
    );
};

const UploadCard = ({ title, icon, loaded, children }) => (
    <Glass
        sx={{
            p: 2,
            flex: 1,
            borderColor: loaded ? alpha(DARK.mint, 0.45) : alpha(DARK.border, 0.9),
        }}
    >
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
            <Stack direction="row" alignItems="center" spacing={1}>
                {icon}
                <Typography variant="h6" sx={{ color: DARK.text, fontWeight: 800 }}>
                    {title}
                </Typography>
            </Stack>
            {loaded ? <Chip label="Hazır" size="small" sx={{ bgcolor: DARK.mint }} /> : null}
        </Stack>
        {children}
    </Glass>
);

const ProgressStep = ({ step, currentStep, description, icon }) => {
    const isActive = step === currentStep;
    const isCompleted = step < currentStep;

    const color = isCompleted ? DARK.mint : isActive ? DARK.primary : DARK.textMuted;
    const IconComponent = isCompleted ? CheckCircleIcon : isActive ? RotateRightIcon : icon;

    return (
        <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ opacity: isCompleted || isActive ? 1 : 0.6 }}
        >
            <Box sx={{ position: "relative", width: 24, height: 24 }}>
                {isActive ? (
                    <CircularProgress size={24} sx={{ color }} />
                ) : (
                    <IconComponent sx={{ color, fontSize: 24 }} />
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

/* ------------------------ Yardımcı Formatlayıcılar ------------------------ */
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

const toBigIntStringOrNull = (v) => {
    if (v === null || v === undefined || v === "") return null;

    const s = String(v).trim();

    if (/e\+?/i.test(s)) {
        const n = Number(s);
        if (!Number.isFinite(n)) return null;
        return String(Math.trunc(n));
    }

    const digits = s.replace(/\D/g, "");
    return digits ? digits : null;
};

/* ===================== MÜŞTERİYE GÖRE ORAN (%38 / %37) ===================== */
const normalizeCompany = (s) =>
    String(s || "")
        .toLocaleUpperCase("tr-TR")
        .replace(/\s+/g, " ")
        .trim();

const SPECIAL_CUSTOMERS_38 = new Set([
    normalizeCompany("PEPSİ-COLA SERVİS VE DAĞITIM LİMİTED ŞİRKETİ"),
]);

const getRateByMusteri = (musteriAdi) => {
    const n = normalizeCompany(musteriAdi);
    return SPECIAL_CUSTOMERS_38.has(n) ? 0.38 : 0.37;
};
/* ========================================================================== */

/* ------------------------ Liste Bileşenleri ------------------------ */
const PlakaKmList = ({ kmMap, mode = "km" }) => {
    if (!kmMap || Object.keys(kmMap).length === 0) return null;

    const list = Object.entries(kmMap).map(([plaka, data]) => ({ plaka, ...data }));

    return (
        <Box
            sx={{
                mt: 1.5,
                maxHeight: 280,
                overflowY: "auto",
                p: 1,
                bgcolor: DARK.surface,
                borderRadius: 1,
                border: `1px solid ${DARK.border}`,
            }}
        >
            {mode === "km" && (
                <>
                    <Grid container spacing={1} sx={{ bgcolor: DARK.surface2, p: 1, borderRadius: 1 }}>
                        <Grid item xs={3}><Typography variant="caption" fontWeight={700} color={DARK.mint}>Plaka</Typography></Grid>
                        <Grid item xs={3}><Typography variant="caption" fontWeight={700} color={DARK.primary}>KM (%38)</Typography></Grid>
                        <Grid item xs={3}><Typography variant="caption" fontWeight={700} color={DARK.primary}>KM (%37)</Typography></Grid>
                        <Grid item xs={3}><Typography variant="caption" fontWeight={700} color={DARK.text}>Toplam KM</Typography></Grid>
                    </Grid>

                    <Stack spacing={0.5} mt={0.5}>
                        {list.map((d) => (
                            <Grid container key={d.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                                <Grid item xs={3}><Typography variant="caption" color={DARK.text}>{d.plaka}</Typography></Grid>
                                <Grid item xs={3}><Typography variant="caption" color={DARK.primary}>{formatNumber(d.KM_38)}</Typography></Grid>
                                <Grid item xs={3}><Typography variant="caption" color={DARK.primary}>{formatNumber(d.KM_37)}</Typography></Grid>
                                <Grid item xs={3}><Typography variant="caption" color={DARK.text} fontWeight={700}>{formatNumber(d.TOPLAM_KM)}</Typography></Grid>
                            </Grid>
                        ))}
                    </Stack>
                </>
            )}

            {mode === "tuketim" && (
                <>
                    <Grid container spacing={1} sx={{ bgcolor: DARK.surface2, p: 1, borderRadius: 1 }}>
                        <Grid item xs={4}><Typography variant="caption" fontWeight={700} color={DARK.mint}>Plaka</Typography></Grid>
                        <Grid item xs={4}><Typography variant="caption" fontWeight={700} color={DARK.textMuted}>Toplam KM</Typography></Grid>
                        <Grid item xs={4}><Typography variant="caption" fontWeight={700} color={DARK.primary}>Tahmini Tüketim</Typography></Grid>
                    </Grid>

                    <Stack spacing={0.5} mt={0.5}>
                        {list.map((d) => (
                            <Grid container key={d.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                                <Grid item xs={4}><Typography variant="caption" color={DARK.text}>{d.plaka}</Typography></Grid>
                                <Grid item xs={4}><Typography variant="caption" color={DARK.textMuted}>{formatNumber(d.TOPLAM_KM)}</Typography></Grid>
                                <Grid item xs={4}><Typography variant="caption" color={DARK.primary} fontWeight={700}>{formatNumber(d.TOPLAM_TUKETIM)}</Typography></Grid>
                            </Grid>
                        ))}
                    </Stack>
                </>
            )}

            {mode === "fark" && (
                <>
                    <Grid container spacing={1} sx={{ bgcolor: DARK.surface2, p: 1, borderRadius: 1 }}>
                        <Grid item xs={3}><Typography variant="caption" fontWeight={700} color={DARK.mint}>Plaka</Typography></Grid>
                        <Grid item xs={3}><Typography variant="caption" fontWeight={700} color={DARK.mint}>Tahmini</Typography></Grid>
                        <Grid item xs={3}><Typography variant="caption" fontWeight={700} color={DARK.primary}>Gerçek</Typography></Grid>
                        <Grid item xs={3}><Typography variant="caption" fontWeight={700} color={DARK.red}>Fark</Typography></Grid>
                    </Grid>

                    <Stack spacing={0.5} mt={0.5}>
                        {list.map((d) => {
                            const diff = Number(d.TOPLAM_KM_VE_LITRE_FARKI || 0);
                            const diffColor = diff >= 0 ? DARK.mint : DARK.red;
                            return (
                                <Grid container key={d.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                                    <Grid item xs={3}><Typography variant="caption" color={DARK.text}>{d.plaka}</Typography></Grid>
                                    <Grid item xs={3}><Typography variant="caption" color={DARK.mint} fontWeight={700}>{formatNumber(d.TOPLAM_TUKETIM)}</Typography></Grid>
                                    <Grid item xs={3}><Typography variant="caption" color={DARK.primary}>{formatNumber(d.TOPLAM_YAKIT_LITRESI)}</Typography></Grid>
                                    <Grid item xs={3}><Typography variant="caption" color={diffColor} fontWeight={700}>{formatNumber(d.TOPLAM_KM_VE_LITRE_FARKI)}</Typography></Grid>
                                </Grid>
                            );
                        })}
                    </Stack>
                </>
            )}
        </Box>
    );
};

const PlakaHakedisList = ({ kmMap }) => {
    if (!kmMap || Object.keys(kmMap).length === 0) return null;

    const list = Object.entries(kmMap)
        .filter(([, data]) => Number(data.DUZELTME_MALIYETI || 0) !== 0)
        .map(([plaka, data]) => ({
            plaka,
            DUZELTME_MALIYETI: Number(data.DUZELTME_MALIYETI || 0),
            TOPLAM_KM_VE_LITRE_FARKI: Number(data.TOPLAM_KM_VE_LITRE_FARKI || 0),
        }));

    if (!list.length) {
        return (
            <Alert severity="info" sx={{ mt: 1, bgcolor: alpha(DARK.primary, 0.1), color: DARK.text }}>
                Düzeltme maliyeti oluşan plaka bulunamadı.
            </Alert>
        );
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
            <Grid container spacing={1} sx={{ bgcolor: DARK.surface2, p: 1, borderRadius: 1 }}>
                <Grid item xs={6}><Typography variant="caption" fontWeight={700} color={DARK.mint}>Plaka</Typography></Grid>
                <Grid item xs={6} sx={{ textAlign: "right" }}><Typography variant="caption" fontWeight={700} color={DARK.primary}>Tutar</Typography></Grid>
            </Grid>

            <Stack spacing={0.5} mt={0.5}>
                {list.map((d) => {
                    const positive = d.TOPLAM_KM_VE_LITRE_FARKI >= 0;
                    const color = positive ? DARK.mint : DARK.red;
                    const finalAmount = positive ? d.DUZELTME_MALIYETI : -d.DUZELTME_MALIYETI;

                    return (
                        <Grid container key={d.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                            <Grid item xs={6}>
                                <Typography variant="caption" fontWeight={700} color={color}>
                                    {d.plaka}
                                </Typography>
                            </Grid>
                            <Grid item xs={6} sx={{ textAlign: "right" }}>
                                <Typography variant="caption" fontWeight={700} color={color}>
                                    {formatCurrency(finalAmount)}
                                </Typography>
                            </Grid>
                        </Grid>
                    );
                })}
            </Stack>
        </Box>
    );
};

/* ------------------------ Excel / DB Yardımcıları ------------------------ */
const readXlsxFile = async (file) => {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    const rows = [];
    const rawHeaders = [];

    const headerRow = worksheet.getRow(1);
    if (!headerRow) throw new Error("Dosya boş veya başlık satırı okunamadı.");

    headerRow.eachCell((cell) => {
        rawHeaders.push(String(cell.value ?? "").trim());
    });

    const processedHeaders = rawHeaders.map((h) =>
        h.toLowerCase().replace(/[^a-z0-9_ğüşöçıİ]/g, "_")
    );

    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const rowData = {};
        let isRowEmpty = true;

        rawHeaders.forEach((rawHeader, index) => {
            if (!rawHeader) return;

            const cell = row.getCell(index + 1);
            let value = cell.value;

            if (typeof value === "object" && value !== null) {
                if (value.text) value = value.text;
                else if (value instanceof Date) value = value.toISOString();
                else if (value.result !== undefined) value = value.result;
            }

            const processedKey = processedHeaders[index];
            rowData[processedKey] = value;

            if (value !== null && value !== undefined && String(value).trim() !== "") {
                isRowEmpty = false;
            }
        });

        if (!isRowEmpty) rows.push(rowData);
    }

    return { headers: processedHeaders, rows };
};

const insertBatched = async (table, rows, batchSize = 500) => {
    const keys = Object.keys(rows?.[0] || {});

    if (table === "frigo_yakit_tmp") {
        const allowed = new Set([
            "plaka",
            "cari_id",
            "cari_adi",
            "iskontosuz_birim_fiyat",
            "birim_fiyat",
            "yakit_litresi",
        ]);
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
            console.error(`Batch insert error for ${table}:`, error);
            errorCount++;
        }
    }

    if (errorCount > 0) {
        throw new Error(`${errorCount} batch'te kayıt hatası oluştu.`);
    }
};

const downloadXlsxTemplate = async (fileName, sheetName, headers, sampleRows) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = headers.map((h) => ({
        header: h,
        key: String(h).toLowerCase().replace(/[^a-z0-9_ğüşöçıİ]/g, "_"),
        width: 24,
    }));

    sampleRows.forEach((row) => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
        new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        fileName
    );
};

const downloadYakitTemplate = async () => {
    await downloadXlsxTemplate(
        "pepsi_yakit_sablon.xlsx",
        "Yakıt Şablonu",
        ["plaka", "cari_id", "cari_adi", "iskontosuz_birim_fiyat", "birim_fiyat", "yakit_litresi"],
        [
            ["34ABC34", 123456, "Örnek Cari", 45.0, 44.9123, 250.5555],
            ["41XYZ41", 222222, "Başka Cari", 44.0, 43.5678, 180.0],
        ]
    );
};

const downloadSeferTemplate = async () => {
    await downloadXlsxTemplate(
        "pepsi_sefer_sablon.xlsx",
        "Sefer Şablonu",
        ["musteri_adi", "sefer_no", "tms_despatch_id", "plaka", "toplam_km"],
        [
            ["PEPSİ-COLA SERVİS VE DAĞITIM LİMİTED ŞİRKETİ", "S1001", 987654321, "34ABC34", 860.3333],
            ["DİĞER MÜŞTERİ", "S1002", 987654322, "41XYZ41", 540.0],
            ["BAŞKA MÜŞTERİ", "S1003", 987654323, "34ABC34", 50.0],
        ]
    );
};

const fetchCariIdMapByPlates = async (plates, batchSize = 500) => {
    const map = {};
    const uniquePlates = Array.from(
        new Set((plates || []).map((p) => String(p || "").toUpperCase().trim()).filter(Boolean))
    );

    for (let i = 0; i < uniquePlates.length; i += batchSize) {
        const batch = uniquePlates.slice(i, i + batchSize);

        const { data, error } = await supabase
            .from("arac_cari_ve_fiyat")
            .select("plaka,cari_id")
            .in("plaka", batch);

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

const downloadSeferHakedisleri = async (kmMap, seferRows, setSnackbar) => {
    if (!kmMap || Object.keys(kmMap).length === 0 || !seferRows || seferRows.length === 0) {
        setSnackbar({
            open: true,
            message: "Hesaplama verisi bulunamadı.",
            severity: "warning",
        });
        return;
    }

    try {
        setSnackbar({
            open: true,
            message: "Sefer Hakedişleri Excel'i hazırlanıyor...",
            severity: "info",
        });

        const platesToLookup = seferRows
            .map((r) => (r.plaka ? String(r.plaka).toUpperCase().trim() : ""))
            .filter(Boolean);

        const cariIdMap = await fetchCariIdMapByPlates(platesToLookup);

        const plakaDataMap = Object.entries(kmMap)
            .filter(([, data]) => Number(data.DUZELTME_MALIYETI || 0) !== 0)
            .reduce((acc, [plaka, data]) => {
                const diff = Number(data.TOPLAM_KM_VE_LITRE_FARKI || 0);
                const toplamHakedis =
                    diff < 0
                        ? -Number(data.DUZELTME_MALIYETI || 0)
                        : Number(data.DUZELTME_MALIYETI || 0);

                const toplamKm = Number(data.TOPLAM_KM || 0);
                const maliyetPerKm = toplamKm > 0 ? toplamHakedis / toplamKm : 0;

                acc[plaka.toUpperCase()] = {
                    toplamHakedis,
                    maliyetPerKm,
                    _distributedTotal: 0,
                };
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

            dataForExcel.push({
                musteri_adi: row.musteri_adi ?? null,
                sefer_no: row.sefer_no,
                tms_despatch_id: row.tms_despatch_id,
                plaka: row.plaka,
                toplam_km: row.toplam_km,
                sefer_hakedisi_tl: seferMaliyeti,
                cari_unvan_id: cariIdMap[plaka] ?? null,
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("PEPSİ Sefer Hakediş Detayları");

        worksheet.columns = [
            { header: "MÜŞTERİ ADI", key: "musteri_adi", width: 40 },
            { header: "SEFER NO", key: "sefer_no", width: 15 },
            { header: "TMS DESPATCH ID", key: "tms_despatch_id", width: 18 },
            { header: "PLAKA", key: "plaka", width: 12 },
            { header: "TOPLAM KM", key: "toplam_km", width: 15, style: { numFmt: "0" } },
            {
                header: "SEFER HAKEDİŞİ (TL)",
                key: "sefer_hakedisi_tl",
                width: 25,
                style: { numFmt: '₺#,##0.0000;[Red]-₺#,##0.0000' },
            },
            { header: "Cari UnvanId", key: "cari_unvan_id", width: 16, style: { numFmt: "0" } },
        ];

        worksheet.addRows(dataForExcel);

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(
            new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
            "pepsi_sefer_hakedis_detaylari.xlsx"
        );

        setSnackbar({
            open: true,
            message: "Sefer Hakedişleri Excel dosyası indirildi.",
            severity: "success",
        });
    } catch (error) {
        console.error(error);
        setSnackbar({
            open: true,
            message: error.message || "Sefer Hakedişleri dosyası oluşturulurken hata oluştu.",
            severity: "error",
        });
    }
};

const downloadOzetData = async (kmMap, yakitRows, setSnackbar) => {
    if (!kmMap || Object.keys(kmMap).length === 0 || !yakitRows || yakitRows.length === 0) {
        setSnackbar({
            open: true,
            message: "Hesaplama verisi bulunamadı.",
            severity: "warning",
        });
        return;
    }

    try {
        setSnackbar({
            open: true,
            message: "Özet Data Excel'i hazırlanıyor...",
            severity: "info",
        });

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
                return {
                    plaka,
                    cari_id: yakitOzet.cari_id ?? null,
                    cari_adi: yakitOzet.cari_adi ?? "BİLİNMİYOR",
                    km_38: Number(d.KM_38) || 0,
                    km_37: Number(d.KM_37) || 0,
                    toplam_km: Number(d.TOPLAM_KM) || 0,
                    hakedis_litresi: Number(d.TOPLAM_TUKETIM) || 0,
                    yakit_alim_litresi: Number(d.TOPLAM_YAKIT_LITRESI) || 0,
                    yakit_fark_litre: Number(d.TOPLAM_KM_VE_LITRE_FARKI) || 0,
                    birim_fiyat: Number(yakitOzet.birim_fiyat) || 0,
                    iskontosuz_birim_fiyat: Number(yakitOzet.iskontosuz_birim_fiyat) || 0,
                    hakedis_tutar: Number(d.DUZELTME_MALIYETI) || 0,
                };
            })
            .filter(
                (d) =>
                    d.toplam_km !== 0 ||
                    d.hakedis_litresi !== 0 ||
                    d.yakit_alim_litresi !== 0 ||
                    d.yakit_fark_litre !== 0 ||
                    d.hakedis_tutar !== 0
            );

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("PEPSİ Özet Plaka Analiz");

        worksheet.columns = [
            { header: "PLAKA", key: "plaka", width: 12 },
            { header: "CARİ İD", key: "cari_id", width: 10 },
            { header: "CARİ ADI", key: "cari_adi", width: 30 },
            { header: "KM (%38)", key: "km_38", width: 16, style: { numFmt: "0.0000" } },
            { header: "KM (%37)", key: "km_37", width: 16, style: { numFmt: "0.0000" } },
            { header: "TOPLAM KM", key: "toplam_km", width: 16, style: { numFmt: "0.0000" } },
            { header: "HAKEDİŞ LİTRESİ", key: "hakedis_litresi", width: 20, style: { numFmt: "0.0000" } },
            { header: "YAKIT ALIM LİTRESİ", key: "yakit_alim_litresi", width: 20, style: { numFmt: "0.0000" } },
            { header: "YAKIT FARK LİTRE", key: "yakit_fark_litre", width: 20, style: { numFmt: "0.0000;[Red]-0.0000" } },
            { header: "BİRİM FİYAT", key: "birim_fiyat", width: 16, style: { numFmt: '₺#,##0.0000' } },
            { header: "İSKONTOSUZ BİRİM FİYAT", key: "iskontosuz_birim_fiyat", width: 24, style: { numFmt: '₺#,##0.0000' } },
            { header: "HAKEDİŞ TUTAR (TL)", key: "hakedis_tutar", width: 22, style: { numFmt: '₺#,##0.0000' } },
        ];

        worksheet.addRows(dataForExcel);

        const farkColIndex = worksheet.getColumn("yakit_fark_litre").number;
        const tutarColIndex = worksheet.getColumn("hakedis_tutar").number;

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return;

            const raw = row.getCell(farkColIndex).value;
            const farkValue =
                raw && typeof raw === "object" && raw.result != null
                    ? Number(raw.result)
                    : Number(raw);

            if (Number.isFinite(farkValue) && farkValue < 0) {
                const tutarCell = row.getCell(tutarColIndex);
                tutarCell.font = {
                    ...(tutarCell.font || {}),
                    color: { argb: "FFFF0000" },
                };
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(
            new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
            "pepsi_ozet_plaka_analiz.xlsx"
        );

        setSnackbar({
            open: true,
            message: "Özet Plaka Analiz Excel dosyası başarıyla indirildi.",
            severity: "success",
        });
    } catch (error) {
        console.error(error);
        setSnackbar({
            open: true,
            message: error.message || "Özet Data Excel dosyası oluşturulurken hata oluştu.",
            severity: "error",
        });
    }
};

/* ================================ ANA HESAPLAMA ================================ */
export function PepsiHesaplama({
    yakitInfo,
    seferInfo,
    setSnackbar,
    startTrigger,
    setStartTrigger,
}) {
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
            await new Promise((r) => setTimeout(r, 250));

            if (!seferRows.length || !yakitRows.length) {
                throw new Error("Sefer ve/veya Yakıt verisi bulunamadı. Lütfen Excel dosyalarını yükleyiniz.");
            }

            setCurrentStep(2);

            seferRows.forEach((row) => {
                const plaka = row.plaka?.toUpperCase() || "BILINMEYEN";
                const km = Number(row.toplam_km || 0);
                totalKm += km;

                if (plaka === "BILINMEYEN" || km === 0) return;

                if (!kmMap[plaka]) {
                    kmMap[plaka] = { KM_38: 0, KM_37: 0, TOPLAM_KM: 0, TOPLAM_TUKETIM: 0 };
                }

                const rate = getRateByMusteri(row.musteri_adi);
                if (rate === 0.38) kmMap[plaka].KM_38 += km;
                else kmMap[plaka].KM_37 += km;

                kmMap[plaka].TOPLAM_KM += km;
                kmMap[plaka].TOPLAM_TUKETIM += km * rate;
            });

            totalUniquePlates = Object.keys(kmMap).length;

            let toplamTahminiTuketim = 0;
            Object.keys(kmMap).forEach((p) => {
                toplamTahminiTuketim += Number(kmMap[p].TOPLAM_TUKETIM || 0);
            });

            Object.keys(kmMap).forEach((p) => {
                kmMap[p].KM_38 = roundToDecimal(kmMap[p].KM_38, 4);
                kmMap[p].KM_37 = roundToDecimal(kmMap[p].KM_37, 4);
                kmMap[p].TOPLAM_KM = roundToDecimal(kmMap[p].TOPLAM_KM, 4);
                kmMap[p].TOPLAM_TUKETIM = roundToDecimal(kmMap[p].TOPLAM_TUKETIM, 4);
            });

            setKmData({
                totalUniquePlates,
                totalKm,
                kmMap: { ...kmMap },
                toplamTahminiTuketim,
            });

            await new Promise((r) => setTimeout(r, 450));
            setCurrentStep(3);
            await new Promise((r) => setTimeout(r, 450));
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
                    acc[plaka] = {
                        totalLitre: 0,
                        totalBirimFiyat: 0,
                        totalIskontosuzFiyat: 0,
                        count: 0,
                    };
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

            Object.keys(tuketimVeFarkMap).forEach((plaka) => {
                const data = tuketimVeFarkMap[plaka];
                const yakitData = finalYakitMap[plaka] || {
                    toplamLitre: 0,
                    avgBirimFiyat: 0,
                    avgIskontosuzFiyat: 0,
                };

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
                    toplamHakedisLitre += tahminiTuketim * 0.9;
                    eslesenYakitKayitSayisi +=
                        yakitRows.filter((y) => y.plaka?.toUpperCase() === plaka).length || 1;
                }
            });

            setKmData((prev) => ({
                ...prev,
                kmMap: tuketimVeFarkMap,
                genelToplamKmVeLitreFarki: roundToDecimal(genelToplamTuketimVeLitreFarki, 4),
                genelToplamDuzeltmeMaliyeti: roundToDecimal(genelToplamDuzeltmeMaliyeti, 4),
            }));

            const nihaiHakedisTL = toplamHakedisLitre * 45.0;

            setSonucData({
                toplamYakit: yakitInfo.kayitSayisi,
                toplamSefer: seferInfo.kayitSayisi,
                eslesenKayit: eslesenYakitKayitSayisi,
                totalUniquePlates,
                toplamKm: totalKm,
                hakedisLitre: toplamHakedisLitre,
                hakedisTL: nihaiHakedisTL,
                genelKmLitreFarki: genelToplamTuketimVeLitreFarki,
                genelDuzeltmeMaliyeti: genelToplamDuzeltmeMaliyeti,
            });

            setCurrentStep(MAX_STEP);

            setSnackbar({
                open: true,
                message: "Hakediş hesaplaması başarıyla tamamlandı.",
                severity: "success",
            });
        } catch (error) {
            console.error(error);
            setCurrentStep(-1);
            setSonucData(null);
            setKmData(null);
            setSnackbar({
                open: true,
                message: error.message || "Hesaplama sırasında kritik hata oluştu.",
                severity: "error",
            });
        }
    }, [hakedisVeriHazir, seferRows, yakitRows, yakitInfo, seferInfo, setSnackbar]);

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
                {isLoading
                    ? `Hesaplanıyor... (Aşama ${currentStep}/${MAX_STEP})`
                    : done
                        ? "Yeniden Hesapla"
                        : "HESAPLAMAYI BAŞLAT"}
            </Button>
        );
    };

    return (
        <Box sx={{ mt: 3 }}>
            {currentStep === -1 && (
                <Alert severity="error" sx={{ bgcolor: alpha(DARK.red, 0.1), color: DARK.text }}>
                    Hesaplama işlemi durduruldu.
                    {renderActionButton()}
                </Alert>
            )}

            {hakedisVeriHazir && currentStep <= MAX_STEP && (
                <Glass sx={{ p: 3, borderRadius: 3, borderColor: alpha(DARK.border, 0.9) }}>
                    <Typography variant="h6" fontWeight={800} color={DARK.text} mb={2}>
                        3) Hakediş Hesaplama Süreci
                    </Typography>

                    <Stack spacing={2}>
                        <ProgressStep
                            step={1}
                            currentStep={currentStep}
                            icon={LocalGasStationIcon}
                            description={`Geçici veriler hazırlanıyor (${yakitInfo?.kayitSayisi} Yakıt, ${seferInfo?.kayitSayisi} Sefer)`}
                        />

                        <ProgressStep
                            step={2}
                            currentStep={currentStep}
                            icon={LocalShippingIcon}
                            description="Plaka bazlı KM toplamları hesaplanıyor (%38 / %37)"
                        />

                        {currentStep >= 2 && kmData && kmData.totalUniquePlates > 0 && (
                            <Box sx={{ ml: 4, my: 1, p: 1, bgcolor: DARK.surface2, borderRadius: 1 }}>
                                <Typography variant="caption" color={DARK.mint} fontWeight={700}>
                                    {kmData.totalUniquePlates} benzersiz plaka için KM değerleri hesaplandı.
                                </Typography>
                                <PlakaKmList kmMap={kmData.kmMap} mode="km" />
                            </Box>
                        )}

                        <ProgressStep
                            step={3}
                            currentStep={currentStep}
                            icon={FilterDramaIcon}
                            description="Plaka bazlı tahmini tüketim hesaplanıyor"
                        />

                        {currentStep >= 3 &&
                            kmData &&
                            kmData.kmMap &&
                            Object.values(kmData.kmMap)[0]?.TOPLAM_TUKETIM != null && (
                                <Box sx={{ ml: 4, my: 1, p: 1, bgcolor: DARK.surface2, borderRadius: 1 }}>
                                    <Typography variant="caption" color={DARK.primary} fontWeight={700}>
                                        Toplam Tahmini Tüketim: {formatNumber(kmData.toplamTahminiTuketim)} L
                                    </Typography>
                                    <PlakaKmList kmMap={kmData.kmMap} mode="tuketim" />
                                </Box>
                            )}

                        <ProgressStep
                            step={4}
                            currentStep={currentStep}
                            icon={AssessmentIcon}
                            description="Gerçek yakıt ile fark ve maliyet hesaplanıyor"
                        />
                    </Stack>

                    {renderActionButton()}
                </Glass>
            )}

            {currentStep === MAX_STEP && kmData?.kmMap && (
                <Glass sx={{ p: 2, borderRadius: 3, borderColor: alpha(DARK.primary, 0.5), mt: 3 }}>
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Plaka Bazlı Tahmini Tüketim / Gerçek Yakıt Fark Analizi
                    </Typography>

                    <PlakaKmList kmMap={kmData.kmMap} mode="fark" />

                    {kmData.genelToplamDuzeltmeMaliyeti !== undefined && (
                        <Alert
                            severity={kmData.genelToplamKmVeLitreFarki >= 0 ? "info" : "warning"}
                            sx={{ mt: 2, bgcolor: alpha(DARK.primary, 0.1), color: DARK.text }}
                        >
                            <Typography variant="body1" fontWeight={700}>
                                Genel Tahmini Tüketim - Yakıt Farkı:{" "}
                                <span
                                    style={{
                                        color:
                                            kmData.genelToplamKmVeLitreFarki >= 0
                                                ? DARK.mint
                                                : DARK.red,
                                    }}
                                >
                                    {formatNumber(kmData.genelToplamKmVeLitreFarki)} L
                                </span>
                            </Typography>
                            <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
                                Genel Düzeltme Maliyeti:{" "}
                                <span style={{ color: DARK.primary }}>
                                    {formatCurrency(kmData.genelToplamDuzeltmeMaliyeti)}
                                </span>
                            </Typography>
                        </Alert>
                    )}
                </Glass>
            )}

            {currentStep === MAX_STEP && kmData?.kmMap && (
                <Glass sx={{ p: 2, borderRadius: 3, borderColor: alpha(DARK.mint, 0.5), mt: 3 }}>
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Plaka Bazlı Hakediş / Ceza Detayı
                    </Typography>
                    <PlakaHakedisList kmMap={kmData.kmMap} />
                </Glass>
            )}

            {currentStep === MAX_STEP && kmData?.kmMap && seferInfo && yakitInfo && (
                <Glass sx={{ p: 2, borderRadius: 3, borderColor: alpha(DARK.mint, 0.55), mt: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                        <FileDownloadIcon sx={{ color: DARK.mint, fontSize: 24 }} />
                        <Typography variant="h6" fontWeight={800} color={DARK.text}>
                            Çıktı Alanı
                        </Typography>
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mt={2}>
                        <Button
                            variant="contained"
                            startIcon={<FileDownloadIcon />}
                            onClick={() =>
                                downloadSeferHakedisleri(kmData.kmMap, seferInfo.allRows, setSnackbar)
                            }
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
                </Glass>
            )}

            {!hakedisVeriHazir && (
                <Alert
                    severity="warning"
                    sx={{
                        mt: 2,
                        bgcolor: alpha(DARK.red, 0.1),
                        color: DARK.text,
                        border: `1px solid ${DARK.red}`,
                    }}
                >
                    3. adım beklemede. Lütfen Yakıtlar ve Seferler dosyalarını yükleyiniz.
                </Alert>
            )}

            {isCompleted && sonucData && (
                <Glass sx={{ p: 2, mt: 3 }}>
                    <Typography variant="h6" fontWeight={800} color={DARK.text} mb={2}>
                        Hesaplama Özeti
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                            <KpiCard
                                label="Toplam Plaka"
                                value={String(sonucData.totalUniquePlates || 0)}
                                icon={<DirectionsCarIcon sx={{ color: DARK.primary }} />}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <KpiCard
                                label="Toplam KM"
                                value={formatNumber(sonucData.toplamKm)}
                                icon={<LocalShippingIcon sx={{ color: DARK.primary }} />}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <KpiCard
                                label="Hakediş Litresi"
                                value={formatNumber(sonucData.hakedisLitre)}
                                icon={<LocalGasStationIcon sx={{ color: DARK.primary }} />}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <KpiCard
                                label="Hakediş Tutarı"
                                value={formatCurrency(sonucData.hakedisTL)}
                                icon={<FactCheckIcon sx={{ color: DARK.primary }} />}
                                tone="success"
                            />
                        </Grid>
                    </Grid>
                </Glass>
            )}
        </Box>
    );
}

/* ================================ ANA SAYFA ================================ */
export default function PepsiYakitHakedis() {
    const [yakitInfo, setYakitInfo] = useState(null);
    const [seferInfo, setSeferInfo] = useState(null);
    const [yakitPreviewOpen, setYakitPreviewOpen] = useState(false);
    const [startCalculation, setStartCalculation] = useState(false);

    const [loadingYakit, setLoadingYakit] = useState(false);
    const [loadingSefer, setLoadingSefer] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "info",
    });

    const accept = ".xlsx,.xls";
    const hakedisVeriHazir = !!(yakitInfo && seferInfo);

    const handleSnackbarClose = () =>
        setSnackbar((prev) => ({ ...prev, open: false }));

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

            const missing = expectedKeys.filter((key) => !headers.includes(key));
            if (missing.length) {
                const userFriendlyMissing = missing.map((m) => m.toUpperCase().replace(/_/g, " "));
                throw new Error(
                    "Şablon hatası: Eksik başlık(lar) var. Lütfen tam olarak: " +
                    userFriendlyMissing.join(", ")
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

            if (!clean.length) throw new Error("Dosyada geçerli satır bulunamadı.");

            const { error: deleteError } = await supabase
                .from("frigo_yakit_tmp")
                .delete()
                .neq("plaka", "__never__");

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
                message: `Yakıtlar dosyası başarıyla yüklendi. (${clean.length} kayıt)`,
                severity: "success",
            });
        } catch (error) {
            console.error(error);
            setSnackbar({
                open: true,
                message: error.message || "Yakıt yükleme hatası oluştu.",
                severity: "error",
            });
        } finally {
            setLoadingYakit(false);
        }
    }, []);

    const handleSeferUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        try {
            setLoadingSefer(true);
            setSeferInfo(null);
            setStartCalculation(false);

            const { headers, rows } = await readXlsxFile(file);

            const expectedKeys = [
                "musteri_adi",
                "sefer_no",
                "tms_despatch_id",
                "plaka",
                "toplam_km",
            ];

            const missing = expectedKeys.filter((key) => !headers.includes(key));
            if (missing.length) {
                const userFriendlyMissing = missing.map((m) => m.toUpperCase().replace(/_/g, " "));
                throw new Error(
                    "Şablon hatası: Eksik başlık(lar) var. Lütfen tam olarak: " +
                    userFriendlyMissing.join(", ")
                );
            }

            const payload = rows.map((r) => ({
                musteri_adi: toStrOrNull(r["musteri_adi"]),
                sefer_no: toStrOrNull(r["sefer_no"]),
                tms_despatch_id: toBigIntStringOrNull(r["tms_despatch_id"]),
                plaka: toStrOrNull(r["plaka"]),
                toplam_km: toNumOrNull(r["toplam_km"]),
            }));

            const clean = payload.filter(
                (p) =>
                    p.musteri_adi ||
                    p.sefer_no ||
                    p.tms_despatch_id !== null ||
                    p.plaka ||
                    p.toplam_km !== null
            );

            if (!clean.length) throw new Error("Dosyada geçerli satır bulunamadı.");

            const { error: deleteError } = await supabase
                .from("frigo_sefer_tmp")
                .delete()
                .neq("plaka", "__never__");

            if (deleteError) throw new Error("Önceki sefer kayıtları silinemedi.");

            await insertBatched("frigo_sefer_tmp", clean);

            setSeferInfo({
                fileName: file.name,
                kayitSayisi: clean.length,
                preview: clean.slice(0, 5),
                allRows: clean,
            });

            setSnackbar({
                open: true,
                message: `Seferler dosyası başarıyla yüklendi. (${clean.length} kayıt)`,
                severity: "success",
            });
        } catch (error) {
            console.error(error);
            setSnackbar({
                open: true,
                message: error.message || "Sefer yükleme hatası oluştu.",
                severity: "error",
            });
        } finally {
            setLoadingSefer(false);
        }
    }, []);

    const handleCleanTables = useCallback(async () => {
        try {
            setCleaning(true);

            const [yakitResp, seferResp] = await Promise.all([
                supabase.from("frigo_yakit_tmp").delete().neq("plaka", "__never__"),
                supabase.from("frigo_sefer_tmp").delete().neq("plaka", "__never__"),
            ]);

            if (yakitResp.error) throw yakitResp.error;
            if (seferResp.error) throw seferResp.error;

            setYakitInfo(null);
            setSeferInfo(null);
            setStartCalculation(false);

            setSnackbar({
                open: true,
                message: "Geçici tablolar temizlendi.",
                severity: "success",
            });
        } catch (error) {
            console.error(error);
            setSnackbar({
                open: true,
                message: error.message || "Temizleme sırasında hata oluştu.",
                severity: "error",
            });
        } finally {
            setCleaning(false);
        }
    }, []);

    const previewRows = useMemo(() => yakitInfo?.preview || [], [yakitInfo]);

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: DARK.pageBg,
                color: DARK.text,
                p: { xs: 2, md: 3 },
            }}
        >
            <Glass sx={{ p: 3, mb: 3 }}>
                <SectionTitle
                    icon={<BusinessIcon sx={{ color: DARK.primary }} />}
                    title="Pepsi Yakıt Hakediş"
                    subtitle="PEPSİ-COLA SERVİS VE DAĞITIM LİMİTED ŞİRKETİ için %38, diğer müşteriler için %37 oranı ile hesaplama yapar."
                    right={
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                                variant="outlined"
                                startIcon={<FileDownloadIcon />}
                                onClick={downloadYakitTemplate}
                                sx={{ borderColor: DARK.primary, color: DARK.primary }}
                            >
                                Yakıt Şablonu
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<FileDownloadIcon />}
                                onClick={downloadSeferTemplate}
                                sx={{ borderColor: DARK.primary, color: DARK.primary }}
                            >
                                Sefer Şablonu
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={
                                    cleaning ? (
                                        <CircularProgress size={16} color="inherit" />
                                    ) : (
                                        <DeleteSweepIcon />
                                    )
                                }
                                onClick={handleCleanTables}
                                disabled={cleaning}
                            >
                                {cleaning ? "Temizleniyor" : "Geçici Tabloları Temizle"}
                            </Button>
                        </Stack>
                    }
                />
            </Glass>

            <Grid container spacing={2} sx={{ mt: 0, mb: 3 }}>
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
                <UploadCard
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
                            startIcon={
                                loadingYakit ? (
                                    <CircularProgress size={18} color="inherit" />
                                ) : (
                                    <UploadFileIcon />
                                )
                            }
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
                </UploadCard>

                <UploadCard
                    title={
                        seferInfo
                            ? `Seferler: ${seferInfo.fileName} (${seferInfo.kayitSayisi} kayıt)`
                            : "2) Seferler Şablonu Yükle"
                    }
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
                </UploadCard>
            </Stack>

            <Glass
                sx={{
                    mb: 3,
                    p: 2,
                    borderColor: hakedisVeriHazir ? alpha(DARK.mint, 0.5) : alpha(DARK.border, 0.9),
                }}
            >
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    alignItems={{ xs: "flex-start", md: "center" }}
                    justifyContent="space-between"
                >
                    <Box>
                        <Typography variant="h6" sx={{ color: DARK.text, fontWeight: 800 }}>
                            3) Hesaplamayı Başlat
                        </Typography>
                        <Typography variant="body2" sx={{ color: DARK.textMuted }}>
                            Yakıt ve sefer dosyaları yüklendikten sonra hesaplama çalıştırılır.
                        </Typography>
                    </Box>

                    <Button
                        variant="contained"
                        onClick={() => setStartCalculation(true)}
                        disabled={!hakedisVeriHazir}
                        startIcon={<AssessmentIcon />}
                        sx={{
                            bgcolor: DARK.primary,
                            color: DARK.text,
                            fontWeight: 800,
                            "&:hover": { bgcolor: alpha(DARK.primary, 0.85) },
                        }}
                    >
                        Hesaplamayı Başlat
                    </Button>
                </Stack>
            </Glass>

            <PepsiHesaplama
                yakitInfo={yakitInfo}
                seferInfo={seferInfo}
                setSnackbar={setSnackbar}
                startTrigger={startCalculation}
                setStartTrigger={setStartCalculation}
            />

            <Dialog
                open={yakitPreviewOpen}
                onClose={() => setYakitPreviewOpen(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle>Yakıt Önizleme</DialogTitle>
                <DialogContent dividers>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Plaka</TableCell>
                                <TableCell>Cari ID</TableCell>
                                <TableCell>Cari Adı</TableCell>
                                <TableCell>Birim Fiyat</TableCell>
                                <TableCell>İskontosuz Birim Fiyat</TableCell>
                                <TableCell>Yakıt Litresi</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {previewRows.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell>{row.plaka}</TableCell>
                                    <TableCell>{row.cari_id}</TableCell>
                                    <TableCell>{row.cari_adi}</TableCell>
                                    <TableCell>{row.birim_fiyat}</TableCell>
                                    <TableCell>{row.iskontosuz_birim_fiyat}</TableCell>
                                    <TableCell>{row.yakit_litresi}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setYakitPreviewOpen(false)}>Kapat</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
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
