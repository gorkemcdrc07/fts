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
} from "@mui/material";
import { alpha } from "@mui/system";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FilterDramaIcon from "@mui/icons-material/FilterDrama";

/* ------------------------ Koyu Tema Renkleri ------------------------ */
const DARK = {
    surface: "#1E1E1E",
    surface2: "#2A2A2A",
    border: "#3A3A3A",
    text: "#E0E0E0",
    textMuted: "#A0A0A0",
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

/* ------------------------ Plaka KM Detay Listesi Bileşeni (YENİLENMİŞ) ------------------- */
// showCalculation: 1 -> Toplam KM (BOS+SFR ayrı), 2 -> Tahmini Tüketim (BOS, SFR, Toplam), 3 -> Fark ve Maliyet (Toplam KM, Toplam Yakıt, Fark, Maliyet)
const PlakaKmList = ({ kmMap, showCalculation = 1 }) => {
    if (!kmMap || Object.keys(kmMap).length === 0) return null;

    const kmList = Object.entries(kmMap).map(([plaka, data]) => ({ plaka, ...data }));

    const isStep2 = showCalculation === 2; // Tahmini Tüketim
    const isStep3 = showCalculation === 3; // Fark ve Maliyet

    // Sütun başlıkları ve genişlikleri ayarlanıyor
    let title = "Kilometre Dağılımı (KM)";
    let headers = [
        { label: "Plaka", key: "plaka", color: DARK.mint, xs: 3 },
        { label: "SEFER KM", key: "SFR_KM", color: DARK.mint, xs: 3 },
        { label: "BOŞ KM", key: "BOS_KM", color: DARK.mint, xs: 3 },
        { label: "TOPLAM KM", key: "TOPLAM_KM", color: DARK.text, xs: 3 },
    ];
    let showEmptyLitreColumns = false;

    if (isStep2) {
        title = "Plaka Bazlı Tahmini Tüketim (Litre)";
        headers = [
            { label: "Plaka", key: "plaka", color: DARK.mint, xs: 2.4 },
            { label: "TOPLAM KM", key: "TOPLAM_KM_H", color: DARK.text, xs: 2.4 },
            { label: "SFR Tüketim (L)", key: "SFR_TUKETIM", color: DARK.primary, xs: 2.4 },
            { label: "BOŞ Tüketim (L)", key: "BOS_TUKETIM", color: DARK.primary, xs: 2.4 },
            { label: "TOPLAM Tüketim (L)", key: "TOPLAM_TUKETIM", color: DARK.mint, xs: 2.4 },
        ];
    } else if (isStep3) {
        title = "KM / Yakıt Fark Analizi ve Düzeltme Maliyeti";
        headers = [
            { label: "Plaka", key: "plaka", color: DARK.mint, xs: 2.4 },
            { label: "TOPLAM KM", key: "TOPLAM_KM_H", color: DARK.textMuted, xs: 2.4 },
            { label: "TOPLAM YAKIT (L)", key: "TOPLAM_YAKIT_LITRESI", color: DARK.textMuted, xs: 2.4 },
            { label: "KM - LİTRE FARK", key: "TOPLAM_KM_VE_LITRE_FARKI", color: DARK.primary, xs: 2.4 },
            { label: "DÜZELTME MALİYETİ (TL)", key: "DUZELTME_MALIYETI", color: DARK.red, xs: 2.4 },
        ];
        showEmptyLitreColumns = true;
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
                    const costColor = data.DUZELTME_MALIYETI >= 0 ? DARK.mint : DARK.red;

                    return (
                        <Grid container key={data.plaka} spacing={1} sx={{ borderBottom: `1px dotted ${DARK.border}` }}>
                            {/* Plaka */}
                            <Grid item xs={headers[0].xs}><Typography variant="caption" color={DARK.text}>{data.plaka}</Typography></Grid>

                            {/* AŞAMA 2 - KM BÖLÜMÜ */}
                            {showCalculation === 1 && (
                                <>
                                    <Grid item xs={headers[1].xs}><Typography variant="caption" color={DARK.textMuted}>{formatNumber(data.SFR_KM)}</Typography></Grid>
                                    <Grid item xs={headers[2].xs}><Typography variant="caption" color={DARK.textMuted}>{formatNumber(data.BOS_KM)}</Typography></Grid>
                                    <Grid item xs={headers[3].xs}><Typography variant="caption" fontWeight={700} color={DARK.text}>{formatNumber(totalKm)}</Typography></Grid>
                                </>
                            )}

                            {/* AŞAMA 3 - TÜKETİM BÖLÜMÜ */}
                            {isStep2 && (
                                <>
                                    <Grid item xs={headers[1].xs}><Typography variant="caption" color={DARK.textMuted}>{formatNumber(totalKm)}</Typography></Grid>
                                    <Grid item xs={headers[2].xs}><Typography variant="caption" color={DARK.primary}>{formatNumber(data.SFR_TUKETIM)}</Typography></Grid>
                                    <Grid item xs={headers[3].xs}><Typography variant="caption" color={DARK.primary}>{formatNumber(data.BOS_TUKETIM)}</Typography></Grid>
                                    <Grid item xs={headers[4].xs}><Typography variant="caption" fontWeight={700} color={DARK.mint}>{formatNumber(data.TOPLAM_TUKETIM)}</Typography></Grid>
                                </>
                            )}

                            {/* AŞAMA 4 - FARK VE MALİYET BÖLÜMÜ */}
                            {isStep3 && (
                                <>
                                    <Grid item xs={headers[1].xs}><Typography variant="caption" color={DARK.textMuted}>{formatNumber(totalKm)}</Typography></Grid>
                                    <Grid item xs={headers[2].xs}><Typography variant="caption" color={DARK.textMuted}>{formatNumber(data.TOPLAM_YAKIT_LITRESI)}</Typography></Grid>
                                    <Grid item xs={headers[3].xs}>
                                        <Typography variant="caption" fontWeight={700} color={diffColor}>
                                            {formatNumber(diff)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={headers[4].xs}>
                                        <Typography variant="caption" fontWeight={700} color={costColor}>
                                            {formatCurrency(data.DUZELTME_MALIYETI)}
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


/* ------------------------ ANA HESAPLAMA BİLEŞENİ --------------------- */

/**
 * Frigo Yakıt Hakediş Hesaplama ve Sonuç Bileşeni
 */
export function FrigoHesaplama({ yakitInfo, seferInfo, setSnackbar, startTrigger, setStartTrigger }) {

    // Verileri allRows'dan (tüm veriden) al
    const seferRows = seferInfo?.allRows || seferInfo?.preview || [];
    const yakitRows = yakitInfo?.allRows || yakitInfo?.preview || [];

    const MAX_STEP = 4;
    const [currentStep, setCurrentStep] = useState(0);
    const [sonucData, setSonucData] = useState(null);
    const [kmData, setKmData] = useState(null);

    const hakedisVeriHazir = yakitInfo && seferInfo;

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

        setCurrentStep(1);
        setSonucData(null);
        setKmData(null);

        let totalSeferKm = 0;
        let kmMap = {};
        let totalUniquePlates = 0;
        let totalKm = 0;

        try {
            // AŞAMA 1: Geçici Veri Hazırlanıyor
            setCurrentStep(1);
            await new Promise(resolve => setTimeout(resolve, 500));

            if (!seferRows.length || !yakitRows.length) {
                throw new Error("Sefer ve/veya Yakıt verisi bulunamadı. Lütfen Excel dosyalarını yükleyiniz.");
            }

            // AŞAMA 2: Plaka Bazlı Kilometreleri Hesapla (BOS/SFR ayrımı ile)
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

            // AŞAMA 3: Plaka Bazlı Tahmini Tüketim Hesaplama
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
                tuketimMap[plaka].TOPLAM_KM_H = totalKm; // Sadece gösterim için

                toplamTahminiTuketim += toplamTuketim;
            });

            setKmData(prev => ({
                ...prev,
                kmMap: tuketimMap,
                toplamTahminiTuketim
            }));

            await new Promise(resolve => setTimeout(resolve, 1000));

            // AŞAMA 4: Plaka Bazlı Eşleştirme, Fark, Düzeltme Maliyeti ve Nihai Hakediş Hesaplama
            setCurrentStep(4);

            let toplamHakedisLitre = 0;
            let eslesenYakitKayitSayisi = 0;
            let genelToplamKmVeLitreFarki = 0;
            let genelToplamDuzeltmeMaliyeti = 0;

            // 4.1 Plaka bazlı Yakıt Litresi ve Fiyat Ortalamalarını hesaplayalım
            const yakitMap = yakitRows.reduce((acc, yakit) => {
                const plaka = yakit.plaka?.toUpperCase() || 'BILINMEYEN_YAKIT';
                const litre = yakit.yakit_litresi || 0;
                const birimFiyat = yakit.birim_fiyat || 0;
                const iskontosuzFiyat = yakit.iskontosuz_birim_fiyat || 0;

                if (plaka === 'BILINMEYEN_YAKIT' || litre === 0) return acc;

                if (!acc[plaka]) {
                    acc[plaka] = { totalLitre: 0, totalBirimFiyat: 0, totalIskontosuzFiyat: 0, count: 0 };
                }

                // Ortalama için toplam ve sayım yap
                acc[plaka].totalLitre += litre;
                acc[plaka].totalBirimFiyat += birimFiyat;
                acc[plaka].totalIskontosuzFiyat += iskontosuzFiyat;
                acc[plaka].count += 1;

                return acc;
            }, {});

            // Final yakıt map'ini oluştur: toplam litre ve ortalama fiyatlarla
            const finalYakitMap = Object.keys(yakitMap).reduce((acc, plaka) => {
                const data = yakitMap[plaka];
                acc[plaka] = {
                    toplamLitre: data.totalLitre,
                    // Eğer birden fazla yakıt kaydı varsa ortalama fiyatı kullanırız
                    avgBirimFiyat: data.totalBirimFiyat / data.count,
                    avgIskontosuzFiyat: data.totalIskontosuzFiyat / data.count,
                };
                return acc;
            }, {});

            // 4.2 Hakediş, KM-Litre Farkı ve Düzeltme Maliyeti Hesaplama
            const tuketimVeFarkMap = { ...tuketimMap };

            const tumPlakalar = Object.keys(tuketimVeFarkMap);

            tumPlakalar.forEach(plaka => {
                const data = tuketimVeFarkMap[plaka];
                const yakitData = finalYakitMap[plaka] || { toplamLitre: 0, avgBirimFiyat: 0, avgIskontosuzFiyat: 0 };

                const toplamYakit = yakitData.toplamLitre;
                const toplamKm = data.SFR_KM + data.BOS_KM;

                // KM - LİTRE FARKI HESAPLANIYOR (İstenen formül)
                const kmLitreFarki = toplamKm - toplamYakit;
                genelToplamKmVeLitreFarki += kmLitreFarki;

                // YENİ: DÜZELTME MALİYETİ HESAPLAMA
                let duzeltmeMaliyeti = 0;
                if (kmLitreFarki > 0) {
                    // Pozitif fark (KM Fazla): İskontolu fiyatla çarp (Performans primi/hakedişi)
                    duzeltmeMaliyeti = kmLitreFarki * yakitData.avgBirimFiyat;
                } else if (kmLitreFarki < 0) {
                    // Negatif fark (Yakıt Fazla): İskontosuz fiyatla çarp (Ceza/Maliyet)
                    duzeltmeMaliyeti = Math.abs(kmLitreFarki) * yakitData.avgIskontosuzFiyat;
                }

                genelToplamDuzeltmeMaliyeti += duzeltmeMaliyeti;

                // Sonuç haritasına ekle
                tuketimVeFarkMap[plaka].TOPLAM_YAKIT_LITRESI = toplamYakit;
                tuketimVeFarkMap[plaka].TOPLAM_KM_VE_LITRE_FARKI = kmLitreFarki;
                tuketimVeFarkMap[plaka].DUZELTME_MALIYETI = duzeltmeMaliyeti;

                // Hakediş Kuralı (Tüketim Bazlı Hakediş)
                if (toplamYakit > 0 && data.TOPLAM_TUKETIM > 0) {
                    const hakedisLitre = data.TOPLAM_TUKETIM * 0.90;
                    toplamHakedisLitre += hakedisLitre;

                    eslesenYakitKayitSayisi += (yakitRows.filter(y => y.plaka?.toUpperCase() === plaka).length || 1);
                }
            });

            // Yeni map'i state'e kaydet
            setKmData(prev => ({
                ...prev,
                kmMap: tuketimVeFarkMap,
                genelToplamKmVeLitreFarki: genelToplamKmVeLitreFarki,
                genelToplamDuzeltmeMaliyeti: genelToplamDuzeltmeMaliyeti
            }));

            // Nihai Hakediş TL'si (Eski mantıkla aynı kaldı)
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
                genelKmLitreFarki: genelToplamKmVeLitreFarki,
                genelDuzeltmeMaliyeti: genelToplamDuzeltmeMaliyeti
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
                        {/* YENİ: AŞAMA 2 BİTTİĞİNDE KM DETAYINI GÖSTER (SFR, BOS, TOPLAM KM) */}
                        {currentStep >= 2 && kmData && kmData.totalUniquePlates > 0 && (
                            <Box sx={{ ml: 4, my: 1, p: 1, bgcolor: DARK.surface2, borderRadius: 1 }}>
                                <Typography variant="caption" color={DARK.mint} fontWeight={700}>
                                    **Kilometre Özeti (Aşama 2):** {kmData.totalUniquePlates} benzersiz plaka için KM değerleri hesaplandı.
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

                        {/* YENİ: AŞAMA 3 BİTTİĞİNDE Tüketim Detayını Göster (TOPLAM KM, SFR Tüketim, BOŞ Tüketim, TOPLAM Tüketim) */}
                        {currentStep >= 3 && kmData && kmData.kmMap && Object.values(kmData.kmMap)[0]?.TOPLAM_TUKETIM != null && (
                            <Box sx={{ ml: 4, my: 1, p: 1, bgcolor: DARK.surface2, borderRadius: 1 }}>
                                <Typography variant="caption" color={DARK.primary} fontWeight={700}>
                                    **Tahmini Tüketim Özeti (Aşama 3):** Toplam Tahmini Tüketim: {formatNumber(kmData.toplamTahminiTuketim)} L
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

            {/* Plaka Bazlı KM/Litre Farkı ve Maliyet Gösterim Alanı (YENİLENMİŞ) */}
            {currentStep === MAX_STEP && kmData && kmData.kmMap && (
                <Paper
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 2, bgcolor: DARK.surface, borderColor: DARK.primary, mt: 3 }}
                >
                    <Typography variant="h6" fontWeight={700} color={DARK.text} mb={2}>
                        Plaka Bazlı KM/Yakıt Analizi ve Düzeltme Maliyeti 📊
                    </Typography>
                    <PlakaKmList kmMap={kmData.kmMap} showCalculation={3} />

                    {/* Genel Fark Maliyeti Özeti */}
                    {kmData.genelToplamDuzeltmeMaliyeti !== undefined && (
                        <Alert
                            severity={kmData.genelToplamKmVeLitreFarki >= 0 ? "success" : "warning"}
                            sx={{ mt: 2, bgcolor: alpha(DARK.primary, 0.1), color: DARK.text, border: `1px solid ${DARK.border}` }}
                        >
                            <Typography variant="body1" fontWeight={700}>
                                Genel KM - Litre Farkı: <span style={{ color: kmData.genelToplamKmVeLitreFarki >= 0 ? DARK.mint : DARK.red }}>{formatNumber(kmData.genelToplamKmVeLitreFarki)}</span>
                            </Typography>
                            <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
                                Genel Düzeltme Maliyeti: <span style={{ color: DARK.primary }}>{formatCurrency(kmData.genelToplamDuzeltmeMaliyeti)}</span>
                            </Typography>
                        </Alert>
                    )}
                </Paper>
            )}

            {/* Sonuç Alanı - Genel StatCard'lar */}
            {sonucData && (
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
                        <CheckCircleIcon sx={{ color: DARK.mint, fontSize: 24 }} />
                        <Typography variant="h6" fontWeight={800}>
                            Nihai Hakediş Sonuçları
                        </Typography>
                    </Stack>

                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={2.4}>
                            <StatCard label="Toplam Yakıt Kaydı" value={sonucData.toplamYakit} />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2.4}>
                            <StatCard label="Toplam Sefer Kaydı" value={sonucData.toplamSefer} />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2.4}>
                            <StatCard label="Toplam Sefer KM (Hakediş Bazı)" value={sonucData.toplamSeferKm} formatter={(v) => formatNumber(v) + " KM"} tone="success" />
                        </Grid>
                        {/* DÜZELTME MALİYETİ KARTI */}
                        <Grid item xs={12} sm={6} md={2.4}>
                            <StatCard
                                label="Genel Düzeltme Maliyeti (TL)"
                                value={sonucData.genelDuzeltmeMaliyeti}
                                formatter={formatCurrency}
                                tone="danger"
                            />
                        </Grid>
                        <Grid item xs={12} sm={12} md={2.4}>
                            <StatCard label="Toplam Hakediş (Litre)" value={sonucData.hakedisLitre} formatter={(v) => formatNumber(v) + " L"} />
                        </Grid>
                    </Grid>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={12} md={12}>
                            <StatCard label="Hesaplanan Nihai Hakediş Tutarı" value={sonucData.hakedisTL} tone="success" formatter={formatCurrency} />
                        </Grid>
                    </Grid>


                    <Stack direction="row" spacing={1.5} mt={2}>
                        <Button variant="contained" sx={{ bgcolor: DARK.primary, color: DARK.text }}>
                            Detaylı Karşılaştırma Tablosunu İndir
                        </Button>
                        <Button variant="outlined" onClick={handleHakedisStart} disabled={currentStep > 0 && currentStep < MAX_STEP} sx={{ borderColor: DARK.primary, color: DARK.primary }}>
                            Yeniden Hesapla
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
