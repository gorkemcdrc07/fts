// ===============================================
// TeslimdeBekleme.jsx — NIHAI SÜRÜM (Modern Görünüm + Sadece İhlal Export)
// ===============================================

import React, { useState, useCallback, useEffect } from "react";

// Supabase
import { supabase } from "../supabaseClient";

// DayJS
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";


// Excel Export Kütüphaneleri
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// MUI Bileşenleri
import {
    Container,
    Typography,
    Box,
    TextField,
    Button,
    Grid,
    CircularProgress,
    Alert,
    Paper,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Tooltip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    InputAdornment
} from "@mui/material";

// MUI İkonlar
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DateRangeIcon from '@mui/icons-material/DateRange';

import dayjs from "dayjs";
import "dayjs/locale/tr";

// DayJS Eklentileri
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);



// --------------------------------------------------
// SQL TABLO ALANLARI
// --------------------------------------------------
const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";

const SUMMARY_COLS = [
    "id",
    "sefer_no",
    "plaka",
    "treyler",
    "surucu_ad_soyad",
    "surucu_tckn",
    "surucu_telefon",
    "sefer_tarihi",
    "yukleme_ili",
    "yukleme_ilcesi",
    "teslim_ili",
    "teslim_ilcesi",
    "musteri_adi",
    "yukleme_noktasi",
    "teslim_noktasi",
    "proje_adi"
].join(",");

const DETAIL_COLS = [
    "sefer_no",
    "nokta_sirasi",
    "yukleme_noktasi",
    "teslim_noktasi",
    "yukleme_varis",
    "yukleme_cikis",
    "teslim_varis",
    "teslim_cikis"
].join(",");

// --------------------------------------------------
// Yardımcı Fonksiyonlar
// --------------------------------------------------
const parseDT = (v) => {
    const d = dayjs(v);
    return d.isValid() ? d : null;
};

const fmt = (v) => {
    const d = parseDT(v);
    return d ? d.format("DD.MM.YYYY HH:mm") : "—";
};

const minToHM = (m) => {
    const mm = Math.max(0, Math.round(m || 0));
    const h = Math.floor(mm / 60);
    const r = mm % 60;
    if (h && r) return `${h} sa ${r} dk`;
    if (h) return `${h} sa`;
    if (r) return `${r} dk`;
    return "0 dk";
};

// --------------------------------------------------
// ŞARTLI KURAL HESABI
// --------------------------------------------------
const calcRule = (varis, cikis) => {
    const v = parseDT(varis);
    const c = parseDT(cikis);

    // 1. Temel Kontrol: Veri Eksikliği
    if (!v || !c) return { appliedRule: 'None', compliant: null, delay: 0 };

    // --- Kural 3 Kontrolü: Cumartesi 17:00 ve sonrası (Pazartesi 08:30 Sınırı) ---
    const isSaturday = v.day() === 6;
    const isAfter1700 = v.hour() >= 17;

    if (isSaturday && isAfter1700) {
        // Hedef: Pazartesi 08:30 (Cumartesiden 2 gün sonrası)
        const deadline3 = v.clone().add(2, 'day').hour(8).minute(30).startOf('minute');

        if (c.isSameOrBefore(deadline3)) {
            return { appliedRule: 'Rule 3', compliant: true, delay: 0 };
        } else {
            return { appliedRule: 'Rule 3', compliant: false, delay: c.diff(deadline3, "minute") };
        }
    }


    // --- Kural 1 Kontrolü: Öğleden Önce Varış [08:30, 12:00) (17:00 Sınırı) ---
    const lower1 = v.clone().hour(8).minute(30);
    const upper1 = v.clone().hour(12).minute(0);
    const deadline1 = v.clone().hour(17).minute(0);
    const isApplicable1 = v.isSameOrAfter(lower1) && v.isBefore(upper1);

    if (isApplicable1) {
        if (c.isSameOrBefore(deadline1)) {
            return { appliedRule: 'Rule 1', compliant: true, delay: 0 };
        } else {
            return { appliedRule: 'Rule 1', compliant: false, delay: c.diff(deadline1, "minute") };
        }
    }

    // --- Kural 2 Kontrolü: Öğleden Sonra/Gece Varış [12:00, Sonrası] (Ertesi Gün 12:00 Sınırı) ---
    const lower2 = v.clone().hour(12).minute(0);
    const isApplicable2 = v.isSameOrAfter(lower2);

    // Kural 3 ve Kural 1 uygulanmadıysa, Kural 2'yi kontrol et
    if (isApplicable2) {
        const deadline2 = v.clone().add(1, 'day').hour(12).minute(0).startOf('minute');

        if (c.isSameOrBefore(deadline2)) {
            return { appliedRule: 'Rule 2', compliant: true, delay: 0 };
        } else {
            return { appliedRule: 'Rule 2', compliant: false, delay: c.diff(deadline2, "minute") };
        }
    }

    // --- Hiçbiri Uygulanmadı (Sabah 08:30'dan Önce Varış veya Pazar Günü Varış) ---
    return { appliedRule: 'None', compliant: true, delay: 0 };
};

// --------------------------------------------------
// Excel Export (SADECE UYUMSUZ SATIRLAR İÇİN GÜNCELLENDİ)
// --------------------------------------------------
const exportExcel = async (rows) => {
    if (!rows.length) return;

    // Kuralı hesapla ve sadece ihlal (compliant: false) olanları filtrele
    const filteredRows = rows.filter(r => {
        // Not: rows dizisi zaten Ana Komponentte (fetchAll içinde) 'rule' alanına sahip olduğu için 
        // ek bir calcRule çağrısına gerek yoktur. 
        // Ancak güvenlik için, r.rule.compliant kontrolü yapmak yeterlidir.
        const rule = r.rule || calcRule(r.teslim_varis, r.teslim_cikis);
        r.rule = rule; // Eğer r.rule yoksa, hesaplanan rule'u ekleyelim

        return rule.compliant === false && rule.delay > 0;
    });

    if (!filteredRows.length) {
        alert("Seçilen tarihte kural ihlali olan kayıt bulunamadı.");
        return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Teslimde Bekleme - İHLAL");

    ws.columns = [
        { header: "Sefer No", key: "sefer_no", width: 15 },
        { header: "Plaka", key: "plaka", width: 12 },
        { header: "Proje", key: "proje_adi", width: 20 },
        { header: "Teslim Noktası", key: "teslim_noktasi", width: 20 },
        { header: "Varış", key: "teslim_varis", width: 20 },
        { header: "Çıkış", key: "teslim_cikis", width: 20 },
        { header: "Uygulanan Kural", key: "rule_name", width: 25 },
        { header: "Kurala Uygun", key: "kural", width: 18 },
        { header: "Şartlı Bekleme (İhlal Süresi)", key: "delay", width: 25 }
    ];

    filteredRows.forEach((r) => {
        const rule = r.rule;

        let ruleName = '';
        let kuralText;

        // Sadece ihlal durumlarına göre metin oluşturuluyor
        if (rule.appliedRule === 'Rule 1') {
            ruleName = 'Kural 1: [08:30 - 12:00) Varış';
            kuralText = `Hayır (17:00 sonrası)`;
        } else if (rule.appliedRule === 'Rule 2') {
            ruleName = 'Kural 2: [12:00 - Sonrası] Varış';
            kuralText = `Hayır (Ertesi Gün 12:00 sonrası)`;
        } else if (rule.appliedRule === 'Rule 3') {
            ruleName = 'Kural 3: [Cmt 17:00 - Sonrası] Varış';
            kuralText = `Hayır (Pzt 08:30 sonrası)`;
        }

        ws.addRow({
            sefer_no: r.sefer_no,
            plaka: r.plaka,
            proje_adi: r.proje_adi,
            teslim_noktasi: r.teslim_noktasi,
            teslim_varis: fmt(r.teslim_varis),
            teslim_cikis: fmt(r.teslim_cikis),
            rule_name: ruleName,
            kural: kuralText,
            delay: minToHM(rule.delay)
        });
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `teslimde_bekleme_IHLAL_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
};

// --------------------------------------------------
// ANA KOMPONENT
// --------------------------------------------------
export default function TeslimdeBekleme() {
    const [rows, setRows] = useState([]);
    const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ------------------ VERİ ÇEK ------------------
    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        setRows([]);

        try {
            const start = dayjs(date).startOf("day").toISOString();
            const end = dayjs(date).endOf("day").toISOString();

            const { data: detail, error: e1 } = await supabase
                .from(DETAIL_TABLE)
                .select(DETAIL_COLS)
                .gte("teslim_varis", start)
                .lte("teslim_varis", end);

            if (e1) throw e1;

            const filtered = detail.filter((d) =>
                dayjs(d.teslim_varis).isSame(date, "day")
            );

            if (!filtered.length) {
                setRows([]);
                setLoading(false);
                return;
            }

            const seferNos = [...new Set(filtered.map((x) => x.sefer_no))];
            const { data: summary, error: e2 } = await supabase
                .from(SUMMARY_TABLE)
                .select(SUMMARY_COLS)
                .in("sefer_no", seferNos);

            if (e2) throw e2;

            const final = filtered.map((d) => {
                const s = summary.find((x) => x.sefer_no === d.sefer_no);
                if (!s) return null;

                const rule = calcRule(d.teslim_varis, d.teslim_cikis);
                return {
                    ...s,
                    teslim_varis: d.teslim_varis,
                    teslim_cikis: d.teslim_cikis,
                    teslim_noktasi: d.teslim_noktasi,
                    rule, // Kural bilgisi satıra ekleniyor
                };
            }).filter(Boolean);

            setRows(final);
        } catch (err) {
            setError("Veri çekerken hata oluştu: " + err.message);
        }

        setLoading(false);
    }, [date]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // --------------------------------------------------
    // TABLO KOLONLARI (Kural Render Fonksiyonu - Büyük Metin)
    // --------------------------------------------------
    const columns = [
        { header: "Sefer No", render: (r) => r.sefer_no, width: 100 },
        { header: "Plaka", render: (r) => r.plaka, width: 80 },
        { header: "Proje", render: (r) => r.proje_adi, width: 150 },
        { header: "Teslim Noktası", render: (r) => r.teslim_noktasi, width: 150 },
        { header: "Varış Zamanı", render: (r) => fmt(r.teslim_varis), width: 130 },
        { header: "Çıkış Zamanı", render: (r) => fmt(r.teslim_cikis), width: 130 },

        {
            header: "Kural Uygunluğu",
            width: 250,
            render: (r) => {
                const varisSaati = r.teslim_varis ? parseDT(r.teslim_varis).format('HH:mm') : '—';
                const cikisSaati = r.teslim_cikis ? parseDT(r.teslim_cikis).format('HH:mm') : '—';
                const rule = r.rule;

                // Yardımcı bileşen: Daha büyük ve kalın metin için Typography variant="subtitle2" kullanıldı
                const Text = ({ children, color, icon, tooltipTitle }) => (
                    <Tooltip title={tooltipTitle}>
                        <Box sx={{ color: color, display: "flex", alignItems: "center" }}>
                            {icon}
                            <Typography variant="subtitle2" sx={{ ml: 1, fontWeight: 'bold' }}>
                                {children}
                            </Typography>
                        </Box>
                    </Tooltip>
                );


                // 1. Eksik Veri
                if (rule.compliant === null)
                    return (
                        <Text
                            color="warning.main"
                            icon={<ErrorOutlineIcon fontSize="small" />}
                            tooltipTitle="Teslim Varış veya Çıkış tarih/saati eksik veya geçersiz."
                        >
                            Eksik Veri
                        </Text>
                    );

                // 2. Kural 3 (Cumartesi 17:00 sonrası)
                if (rule.appliedRule === 'Rule 3') {
                    const deadline = parseDT(r.teslim_varis).add(2, 'day').hour(8).minute(30);
                    const deadlineFmt = deadline.format('DD.MM HH:mm');

                    if (rule.compliant)
                        return (
                            // UYUMSUZ kayıtlara odaklandığımız için, uygun olanları göstermeye gerek yok
                            <Text
                                color="success.main"
                                icon={<CheckCircleIcon fontSize="small" />}
                                tooltipTitle={`[Kural 3 - Cmt Varış ${varisSaati}] Çıkış saati (${cikisSaati}) Pzt ${deadlineFmt}'dan önce.`}
                            >
                                UYGUN (Kural 3)
                            </Text>
                        );

                    return (
                        <Text
                            color="error.main"
                            icon={<AccessTimeFilledIcon fontSize="small" />}
                            tooltipTitle={`[Kural 3 İhlali] Çıkış saati (${cikisSaati}), Pzt ${deadlineFmt}'ı aştı. Gecikme: ${minToHM(rule.delay)}`}
                        >
                            GEÇ KALDI (Kural 3)
                        </Text>
                    );
                }


                // 3. Kural 1 (08:30 - 12:00)
                if (rule.appliedRule === 'Rule 1') {
                    const deadline = parseDT(r.teslim_varis).hour(17).minute(0).format('HH:mm');

                    if (rule.compliant)
                        return (
                            // UYUMSUZ kayıtlara odaklandığımız için, uygun olanları göstermeye gerek yok
                            <Text
                                color="success.main"
                                icon={<CheckCircleIcon fontSize="small" />}
                                tooltipTitle={`[Kural 1 - Varış ${varisSaati}] Çıkış saati (${cikisSaati}) ${deadline}'dan önce.`}
                            >
                                UYGUN (Kural 1)
                            </Text>
                        );

                    return (
                        <Text
                            color="error.main"
                            icon={<AccessTimeFilledIcon fontSize="small" />}
                            tooltipTitle={`[Kural 1 İhlali] Çıkış saati (${cikisSaati}), ${deadline}'ı aştı. Gecikme: ${minToHM(rule.delay)}`}
                        >
                            GEÇ KALDI (Kural 1)
                        </Text>
                    );
                }

                // 4. Kural 2 (12:00 sonrası)
                if (rule.appliedRule === 'Rule 2') {
                    const deadline = parseDT(r.teslim_varis).add(1, 'day').hour(12).minute(0);
                    const deadlineFmt = deadline.format('DD.MM HH:mm');

                    if (rule.compliant)
                        return (
                            // UYUMSUZ kayıtlara odaklandığımız için, uygun olanları göstermeye gerek yok
                            <Text
                                color="success.main"
                                icon={<CheckCircleIcon fontSize="small" />}
                                tooltipTitle={`[Kural 2 - Varış ${varisSaati}] Çıkış saati (${cikisSaati}) ertesi gün ${deadlineFmt}'dan önce.`}
                            >
                                UYGUN (Kural 2)
                            </Text>
                        );

                    return (
                        <Text
                            color="error.main"
                            icon={<AccessTimeFilledIcon fontSize="small" />}
                            tooltipTitle={`[Kural 2 İhlali] Çıkış saati (${cikisSaati}), ertesi gün ${deadlineFmt}'ı aştı. Gecikme: ${minToHM(rule.delay)}`}
                        >
                            GEÇ KALDI (Kural 2)
                        </Text>
                    );
                }

                // 5. Uygulanmadı (08:30 Öncesi veya Pazar)
                return (
                    <Text
                        color="grey.600"
                        icon={<CloseIcon fontSize="small" />}
                        tooltipTitle={`Kural dışı varış. Varış saati (${varisSaati}) kural aralıklarının dışında (08:30 öncesi veya Pazar günü).`}>
                        Uygulanmadı
                    </Text>
                );
            }
        },

        {
            header: "Şartlı Bekleme Süresi",
            width: 150,
            render: (r) => {
                const color = r.rule.delay > 0 ? "error.dark" : "text.primary";
                return (
                    <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: r.rule.delay > 0 ? 'bold' : 'normal', color: color }}
                    >
                        {minToHM(r.rule.delay)}
                    </Typography>
                );
            }
        }
    ];

    // --------------------------------------------------
    // UI RENDER 
    // --------------------------------------------------
    return (
        <Container maxWidth="xl" sx={{ py: 5 }}>
            <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold", color: "primary.main" }}>
                🚚 Teslimde Bekleme Raporu
            </Typography>

            {/* Kural Tanımları - Accordion */}
            <Accordion elevation={2} sx={{ mb: 3, borderRadius: 1, border: '1px solid #eee' }}>
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                >
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>
                        📊 Kural Tanımları ve Bekleme Süresi Hesaplama Mantığı
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        <li>**Kural 1 (ÖÖ Varış):** Varış **08:30 (Dahil) - 12:00 (Hariç)**. Sınır: Aynı Gün **17:00**. Bu saatten sonraki çıkış süresi bekleme olarak hesaplanır.</li>
                        <li>**Kural 2 (ÖS Varış):** Varış **12:00 (Dahil) ve sonrası**. Sınır: **Ertesi Gün 12:00**. Bu saatten sonraki çıkış süresi bekleme olarak hesaplanır.</li>
                        <li>**Kural 3 (Hafta Sonu):** Varış **Cumartesi 17:00 (Dahil) ve sonrası**. Sınır: **Pazartesi 08:30**. Bu saatten sonraki çıkış süresi bekleme olarak hesaplanır.</li>
                    </ul>
                </AccordionDetails>
            </Accordion>


            {/* Filtreleme ve Butonlar */}
            <Paper elevation={8} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
                <Grid container spacing={3} alignItems="center">
                    <Grid item>
                        <TextField
                            type="date"
                            label="Varış Tarihi"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            variant="outlined"
                            size="medium"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <DateRangeIcon color="primary" />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>

                    <Grid item>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                            onClick={fetchAll}
                            disabled={loading}
                        >
                            Verileri Getir
                        </Button>
                    </Grid>

                    <Grid item>
                        <Button
                            variant="outlined"
                            color="success"
                            size="large"
                            startIcon={<FileDownloadIcon />}
                            onClick={() => exportExcel(rows)}
                            disabled={!rows.length}
                        >
                            Excel'e Aktar (Sadece İhlaller)
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Sonuç Tablosu */}
            <Paper elevation={8} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: "70vh", overflow: "auto" }}>
                    <Table stickyHeader sx={{ minWidth: 1400 }} size="medium">
                        <TableHead>
                            <TableRow>
                                {columns.map((c, i) => (
                                    <TableCell
                                        key={i}
                                        sx={{
                                            backgroundColor: "primary.main",
                                            color: "white",
                                            fontWeight: "bold",
                                            minWidth: c.width || 100,
                                            py: 1.5
                                        }}
                                    >
                                        {c.header}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length}>
                                        <Box sx={{ p: 5, textAlign: "center" }}>
                                            <CircularProgress size={30} />
                                            <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
                                                Veriler yükleniyor...
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : rows.length ? (
                                // SADECE UYUMSUZ (compliant: false) ve EKSİK VERİ (compliant: null) OLANLARI GÖSTER
                                rows
                                    .filter(r => r.rule.compliant === false || r.rule.compliant === null)
                                    .map((r, idx) => (
                                        <TableRow
                                            key={r.sefer_no + idx}
                                            hover
                                            sx={{
                                                backgroundColor:
                                                    r.rule.compliant === false
                                                        ? "rgba(255, 0, 0, 0.08)"
                                                        : r.rule.compliant === null
                                                            ? "rgba(255, 193, 7, 0.15)"
                                                            : "inherit",
                                                '&:last-child td, &:last-child th': { border: 0 },
                                            }}
                                        >
                                            {columns.map((c, i) => (
                                                <TableCell key={i}>{c.render(r)}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length}>
                                        <Box sx={{ p: 5, textAlign: "center", color: "text.secondary" }}>
                                            <Typography variant="h6">
                                                🔍 Bu tarihte gösterilecek bir kayıt bulunamadı.
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Container>
    );
}
