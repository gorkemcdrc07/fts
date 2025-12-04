import React, { useMemo } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Stack, Button, Typography, TextField, Grid, Card, CardContent, CardHeader,
    Tooltip, IconButton, InputAdornment, Alert, Divider
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadDoneIcon from "@mui/icons-material/FileDownloadDone";
import SaveIcon from "@mui/icons-material/Save";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import WarningIcon from "@mui/icons-material/Warning";

/* ----------------------------------------------------------------------------- 
    Yardımcılar (tarih alanı) 
----------------------------------------------------------------------------- */
function digitsOnly(s) {
    return (s || "").replace(/\D+/g, "");
}
function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
}
function validateParts(dd, MM, yyyy, HH, mm) {
    const toInt = (v) => (v ? parseInt(v, 10) : NaN);
    let d = toInt(dd);
    let m = toInt(MM);
    let y = toInt(yyyy);
    let h = toInt(HH);
    let mi = toInt(mm);

    if (!isNaN(d)) d = clamp(d, 1, 31);
    if (!isNaN(m)) m = clamp(m, 1, 12);
    if (!isNaN(y)) y = clamp(y, 1900, 2999);
    if (!isNaN(h)) h = clamp(h, 0, 23);
    if (!isNaN(mi)) mi = clamp(mi, 0, 59);

    const pad2 = (x) => (isNaN(x) ? "" : String(x).padStart(2, "0"));
    const padY = (x) => (isNaN(x) ? "" : String(x));
    return { dd: pad2(d), MM: pad2(m), yyyy: padY(y), HH: pad2(h), mm: pad2(mi) };
}
function formatFromDigits(digs) {
    const d = digs.slice(0, 2);
    const m = digs.slice(2, 4);
    const y = digs.slice(4, 8);
    const h = digs.slice(8, 10);
    const min = digs.slice(10, 12);

    let out = "";
    if (d) out += d;
    if (m) out += "." + m;
    if (y) out += "." + y;
    if (h) out += " " + h;
    if (min) out += ":" + min;
    return out;
}
function normalizeFormattedToDigits(v) {
    return digitsOnly(v).slice(0, 12);
}
function toLocalISOString(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
function isISODateTimeValid(isoString) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoString)) return false;
    const d = new Date(isoString);
    return !isNaN(d.getTime());
}

export const fromISO = (raw) => {
    if (!raw) return { d: "", t: "" };
    const s = String(raw).trim().replace(" ", "T");
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return { d: "", t: "" };
    const [, y, mo, dd, hh, mi] = m;
    return { d: `${dd}.${mo}.${y}`, t: `${hh}:${mi}` };
};

export const fromISOToCombined = (raw) => {
    const { d, t } = fromISO(raw);
    return d ? (t ? `${d} ${t}` : d) : "";
};


// =================================================================
// DateTimeSingleField
// =================================================================
// =================================================================
// DateTimeSingleField
// =================================================================
function DateTimeSingleField({
    label,
    value,
    onChange,
    sx,
    baseInputSX = {},
    disabled = false,
    required = false,
    errorText = "Geçersiz tarih/saat",
    EndAdornment = null,
}) {
    const [text, setText] = React.useState("");
    const [touched, setTouched] = React.useState(false);

    React.useEffect(() => {
        if (!value) { setText(""); return; }
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
            setText(fromISOToCombined(value));
        } else {
            setText(value);
        }
    }, [value]);

    function handleChange(e) {
        const raw = e.target.value;
        const digs = normalizeFormattedToDigits(raw);
        const masked = formatFromDigits(digs);
        setText(masked);

        if (digs.length === 12) {
            const dd = parseInt(digs.slice(0, 2), 10);
            const MM = parseInt(digs.slice(2, 4), 10);
            const yyyy = parseInt(digs.slice(4, 8), 10);
            const HH = parseInt(digs.slice(8, 10), 10);
            const mm = parseInt(digs.slice(10, 12), 10);

            const dt = new Date(yyyy, MM - 1, dd, HH, mm);
            if (!isNaN(dt.getTime())) {
                onChange(toLocalISOString(dt));
                return;
            }
        }
        onChange(masked);
    }

    // >>> YENİ: Boşken tıklandığında / focus olduğunda o anki tarih-saatle doldur
    function handleAutoFillNow() {
        if (disabled) return;

        const digs = normalizeFormattedToDigits(text);
        // İçerikte zaten bir şey varsa dokunma
        if (digs.length > 0) return;

        const now = new Date();

        const pad = (n) => String(n).padStart(2, "0");
        const dd = pad(now.getDate());
        const MM = pad(now.getMonth() + 1);
        const yyyy = now.getFullYear();

        // SADECE TARİH (kullanıcı saati kendisi girecek)
        const masked = `${dd}.${MM}.${yyyy}`;

        // Inputta sadece tarihi göster
        setText(masked);

        // Parent'a da sadece tarihi gönder (ISO DEĞİL!)
        onChange(masked);
    }
    // <<< YENİ

    const digs = normalizeFormattedToDigits(text);
    const complete = digs.length === 12;
    const { dd, MM, yyyy, HH, mm } = validateParts(
        digs.slice(0, 2), digs.slice(2, 4), digs.slice(4, 8), digs.slice(8, 10), digs.slice(10, 12)
    );
    const isValid = complete && !!dd && !!MM && !!yyyy && !!HH && !!mm;
    const showError = touched && !isValid && (required || digs.length > 0);

    return (
        <TextField
            label={label}
            size="small"
            value={text}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            // YENİ: focus veya tıklamada otomatik doldur
            onFocus={handleAutoFillNow}
            onClick={handleAutoFillNow}
            placeholder="gg.aa.yyyy ss:dd"
            InputLabelProps={{ shrink: true }}
            inputProps={{ inputMode: "numeric", pattern: "\\d*", maxLength: 16 }}
            sx={baseInputSX || sx}
            disabled={disabled}
            error={showError}
            helperText={showError ? errorText : " "}
            InputProps={EndAdornment ? {
                endAdornment: EndAdornment,
                sx: { pr: 1.5 }
            } : undefined}
        />
    );
}


/* ----------------------------------------------------------------------------- 
    Dialog Yardımcıları 
----------------------------------------------------------------------------- */

/** * GÜNCELLEME ZAMANINA +3 saat kayması EKLEYEN fonksiyon (13:23 -> 16:23)
 * UTC saatini yerel saati olarak gösterir.
 */
function fromISOTooltipFixed(raw) {
    if (!raw) return "";

    const s = String(raw).trim().replace(" ", "T");
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return "";

    let [y, mo, dd, hh, mi] = m.map(Number).slice(1);

    // YALNIZCA BURADA 3 SAAT EKLEME YAPILIYOR (13:23 -> 16:23)
    let totalMinutes = (hh * 60) + mi + (3 * 60);

    const carryHours = Math.floor(totalMinutes / 60);
    const newHH = carryHours % 24;
    const newMI = totalMinutes % 60;
    const daysToAdd = Math.floor(carryHours / 24);

    if (daysToAdd > 0) {
        const tempDate = new Date(y, mo - 1, dd);
        tempDate.setDate(tempDate.getDate() + daysToAdd);

        y = tempDate.getFullYear();
        mo = tempDate.getMonth() + 1;
        dd = tempDate.getDate();
    }

    const pad = (n) => String(n).padStart(2, "0");

    return `${pad(newHH)}:${pad(newMI)} ${pad(dd)}.${pad(mo)}`;
}


/** * Alan Altı için gerekli bilgiyi hazırlar ve JSX Adornment'ı döndürür */
function createFieldUpdateInfoText(row, fieldName, COLORS) {
    const logsKey = `${fieldName}_logs`;
    const logs = row[logsKey];

    // Log yoksa görünmesin
    if (!Array.isArray(logs) || logs.length === 0) return null;

    return (
        <InputAdornment
            position="end"
            sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                pointerEvents: 'auto'
            }}
        >
            <Tooltip
                title={
                    <Box sx={{ p: 0.5 }}>
                        {logs.map((item, i) => (
                            <Box key={i} sx={{ mb: 1 }}>
                                <strong>{item.user}</strong> <br />
                                {fromISOTooltipFixed(item.time)}
                                {item.old || item.new ? (
                                    <Typography sx={{ fontSize: 10, mt: 0.3, opacity: 0.7 }}>
                                        {item.old && <>Eski: {fromISOToCombined(item.old)}<br /></>}
                                        {item.new && <>Yeni: {fromISOToCombined(item.new)}</>}
                                    </Typography>
                                ) : null}
                            </Box>
                        ))}
                    </Box>
                }
                placement="top"
            >
                <Box sx={{
                    bgcolor: alpha('#00e676', 0.15),
                    border: `1px solid ${alpha('#00e676', 0.25)}`,
                    px: 0.6,
                    py: 0.2,
                    borderRadius: 1,
                    fontSize: 10,
                    fontWeight: 700,
                    color: COLORS.text,
                    cursor: "pointer"
                }}>
                    {logs.length} kayıt
                </Box>
            </Tooltip>
        </InputAdornment>
    );
}

/* ----------------------------------------------------------------------------- 
    YENİ DOĞRULAMA YARDIMCILARI 
----------------------------------------------------------------------------- */

/**
 * ISO tarih/saat dizesini (örn: "2025-05-13T13:13") karşılaştırma için milisaniye cinsinden sayıya çevirir.
 * Geçersizse NaN döndürür.
 */
function toMoment(isoString) {
    if (!isISODateTimeValid(isoString)) return NaN;
    // Yıl, ay, gün, saat, dakika
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return NaN;
    const [, y, m, d, h, mi] = match.map(Number);
    // Date objesi oluştururken yerel saat dilimini kullanır
    return new Date(y, m - 1, d, h, mi).getTime();
}

/**
 * Detay satırlarındaki sıralamayı ve yıl kısıtlamasını kontrol eder.
 * @returns {Array<{type: 'sequence'|'old_year', row: number, message: string}>} Hata listesi
 */
function getValidationErrors(detailRows) {
    const errors = [];
    // Anlık yılı alıyoruz.
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < detailRows.length; i++) {
        const row = detailRows[i];
        const moments = {
            yukleme_varis: toMoment(row.yukleme_varis),
            yukleme_cikis: toMoment(row.yukleme_cikis),
            teslim_varis: toMoment(row.teslim_varis),
            teslim_cikis: toMoment(row.teslim_cikis),
        };
        const fields = ["yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis"];
        const fieldLabels = {
            yukleme_varis: "Yükleme Giriş",
            yukleme_cikis: "Yükleme Çıkış",
            teslim_varis: "Teslim Giriş",
            teslim_cikis: "Teslim Çıkış",
        };

        // 1. Sıralama Kısıtlamaları (Bir alan kendisinden önce gelenden küçük olamaz)
        for (let j = 1; j < fields.length; j++) {
            const currentField = fields[j];
            const prevField = fields[j - 1];

            const currentMoment = moments[currentField];
            const prevMoment = moments[prevField];

            // Her iki alan da doluysa ve sıralama bozuksa
            if (!isNaN(currentMoment) && !isNaN(prevMoment) && currentMoment < prevMoment) {
                errors.push({
                    type: "sequence",
                    row: i + 1,
                    message: `${i + 1}. Satır: **${fieldLabels[currentField]}** tarihi **${fieldLabels[prevField]}** tarihinden küçük olamaz.`,
                });
                // Bir satırda birden fazla sıralama hatası olabilir ama bir tane bulduğumuzda uyarmak yeterli.
                // Ancak, biz tüm sıralama hatalarını kontrol etmek istiyoruz, bu yüzden break'i kaldırıyorum.
                // Bu kodda her alan bir öncekini kontrol ettiğinden, döngüyü tamamen kırmadan devam edelim.
                // Eğer "Yükleme Çıkış" < "Yükleme Giriş" ise, döngü sonuna kadar devam etsin.
            }
        }

        // 2. Yıl Kısıtlaması (Girilen yıl mevcut yıldan küçük olamaz)
        fields.forEach(field => {
            const isoString = row[field];
            if (isISODateTimeValid(isoString)) {
                const yearMatch = isoString.match(/^(\d{4})/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[1], 10);
                    if (year < currentYear) {
                        errors.push({
                            type: "old_year",
                            row: i + 1,
                            field: fieldLabels[field],
                            message: `${i + 1}. Satır: **${fieldLabels[field]}** yılı (${year}) mevcut yıl (${currentYear}) veya daha büyük olmalıdır.`,
                        });
                    }
                }
            }
        });
    }

    return errors;
}

// =================================================================
// Hata Uyarı Diyaloğu (Modal/Panel)
// =================================================================
function ValidationAlert({ open, onClose, errors }) {
    if (!open) return null;

    // Hata türlerine göre grupla
    const sequenceErrors = errors.filter(e => e.type === 'sequence');
    const oldYearErrors = errors.filter(e => e.type === 'old_year');

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', bgcolor: 'error.main', color: 'white', fontWeight: 700 }}>
                <WarningIcon sx={{ mr: 1 }} />
                Doğrulama Hatası
            </DialogTitle>
            <DialogContent dividers>
                <Alert severity="error" sx={{ mb: 2, fontWeight: 600 }}>
                    Lütfen aşağıdaki tarih/saat girişlerindeki hataları düzeltin.
                </Alert>

                {(sequenceErrors.length > 0) && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700} color="error.dark">Tarih Sıralaması Hataları:</Typography>
                        <ul>
                            {sequenceErrors.map((e, index) => (
                                <Typography component="li" key={index} variant="body2" sx={{ my: 0.5 }}>
                                    {/* HTML bolds are simulated with strong */}
                                    <span dangerouslySetInnerHTML={{ __html: e.message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                </Typography>
                            ))}
                        </ul>
                    </Box>
                )}

                {(sequenceErrors.length > 0 && oldYearErrors.length > 0) && <Divider sx={{ my: 2 }} />}

                {(oldYearErrors.length > 0) && (
                    <Box>
                        <Typography variant="subtitle1" fontWeight={700} color="error.dark">Eski Yıl Girişi Hataları:</Typography>
                        <ul>
                            {oldYearErrors.map((e, index) => (
                                <Typography component="li" key={index} variant="body2" sx={{ my: 0.5 }}>
                                    <span dangerouslySetInnerHTML={{ __html: e.message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                </Typography>
                            ))}
                        </ul>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary" variant="contained">Tamam</Button>
            </DialogActions>
        </Dialog>
    );
}


/* ----------------------------------------------------------------------------- 
    Ana Bileşen: EditorDialog
----------------------------------------------------------------------------- */

export default function EditorDialog(props) {
    const {
        open, onClose, COLORS, computeAracStatu, fromISOToCombined, baseInputSX,
        canEdit,
        editSefer, detailRows, seferTarihiYeni, setSeferTarihiYeni,
        addDetailRow, copyDetailRow, removeDetailRow, onDetailChange,
        onSaveClick, onMoveToCompleted
    } = props;

    // --- Hata Yönetimi State'i ve Uyarı Diyaloğu ---
    const [validationModalOpen, setValidationModalOpen] = React.useState(false);

    // Yeni sefer tarihi doğrulama
    const isSeferTarihiValid = isISODateTimeValid(seferTarihiYeni);

    // Kısıtlama Kontrolü (Sıralama ve Yıl)
    const errors = useMemo(() => {
        // Sefer tarihi kontrolü
        const seferTarihiErrors = [];
        const currentYear = new Date().getFullYear();
        if (isISODateTimeValid(seferTarihiYeni)) {
            const yearMatch = seferTarihiYeni.match(/^(\d{4})/);
            if (yearMatch) {
                const year = parseInt(yearMatch[1], 10);
                if (year < currentYear) {
                    seferTarihiErrors.push({
                        type: "old_year",
                        row: 0,
                        field: "Sefer Tarihi (Yeni)",
                        message: `**Sefer Tarihi (Yeni)** yılı (${yearMatch[1]}) mevcut yıl (${currentYear}) veya daha büyük olmalıdır.`,
                    });
                }
            }
        }

        return [...seferTarihiErrors, ...getValidationErrors(detailRows)];
    }, [seferTarihiYeni, detailRows]);
    const handleDetailChange = (rowIndex, field, newValue) => {
        // Önce asıl değişikliği yap
        onDetailChange(rowIndex, field, newValue);

        const firstRow = detailRows[0];
        if (!firstRow) return;

        // 1) İlk satırın yukleme_varis / yukleme_cikis'i değişirse,
        //    aynı yukleme_noktasi'na sahip tüm satırlara yay
        if (rowIndex === 0 && (field === "yukleme_varis" || field === "yukleme_cikis")) {
            detailRows.forEach((row, idx) => {
                if (idx === 0) return; // ilk satırı tekrar güncelleme
                if (row.yukleme_noktasi && row.yukleme_noktasi === firstRow.yukleme_noktasi) {
                    onDetailChange(idx, field, newValue);
                }
            });
        }

        // 2) Başka bir satırın yukleme_noktasi değeri,
        //    ilk satırın noktasına eşit olursa: ilk satırdaki saatleri kopyala
        if (field === "yukleme_noktasi" && rowIndex > 0) {
            if (newValue && newValue === firstRow.yukleme_noktasi) {
                if (firstRow.yukleme_varis) {
                    onDetailChange(rowIndex, "yukleme_varis", firstRow.yukleme_varis);
                }
                if (firstRow.yukleme_cikis) {
                    onDetailChange(rowIndex, "yukleme_cikis", firstRow.yukleme_cikis);
                }
            }
        }
    };


    const hasValidationError = errors.length > 0;

    // Tüm tarih alanlarının dolu olup olmadığını kontrol eden ana mantık
    const allDatesComplete = useMemo(() => {
        if (!isSeferTarihiValid) return false;

        const requiredFields = ["yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis"];

        const allValid = detailRows.every(row =>
            requiredFields.every(field =>
                isISODateTimeValid(row[field])
            )
        );

        return allValid;
    }, [isSeferTarihiValid, detailRows]);

    // Kaydet butonu: Düzenleme izni varsa VE tüm tarihler tamamlanmamışsa aktif. (Hata kontrolü tıklama ile yapılır)
    const canSave = canEdit && !allDatesComplete;

    // Tamamlananlara Aktar butonu: Düzenleme izni varsa VE tüm tarihler TAMAMLANMIŞSA VE hata yoksa aktif
    const canMoveToCompleted = canEdit && allDatesComplete && !hasValidationError;

    // Buton tıklama işleyici
    const handleActionClick = (action) => {
        if (hasValidationError) {
            // Hata varsa, uyarı diyaloğunu açar.
            setValidationModalOpen(true);
            return;
        }

        if (action === 'save' && onSaveClick) {
            onSaveClick();
        } else if (action === 'complete' && onMoveToCompleted) {
            onMoveToCompleted();
        }
    };


    return (
        <>
            {/* Doğrulama Hataları Paneli (Ekranın Ortasında) */}
            <ValidationAlert
                open={validationModalOpen}
                onClose={() => setValidationModalOpen(false)}
                errors={errors}
            />

            <Dialog
                open={open}
                onClose={onClose}
                fullWidth
                maxWidth="xl"
                PaperProps={{
                    sx: {
                        backgroundColor: COLORS.surface,
                        color: COLORS.text,
                        border: `1px solid ${COLORS.border}`
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 900 }}>
                    <Typography variant="h6" component="span" sx={{ fontWeight: 900 }}>
                        {editSefer?.sefer_no || "-"} • {editSefer?.plaka || "-"} • {editSefer?.musteri_adi || "-"}
                    </Typography>
                    <Typography variant="caption" component="span" sx={{ color: COLORS.textMuted, ml: 1 }}>
                        {computeAracStatu(detailRows) || "—"}
                    </Typography>
                </DialogTitle>

                <DialogContent dividers sx={{ backgroundColor: alpha("#fff", 0.01) }}>

                    {/* Hata Uyarısı Alanı (Butonlara basmadan önce görünür) */}
                    {canEdit && hasValidationError && (
                        <Alert
                            severity="error"
                            icon={<WarningIcon />}
                            sx={{ mb: 2, fontWeight: 600 }}
                        >
                            Tarih/saat girişlerinde **{errors.length} adet doğrulama hatası** bulunmaktadır. Kaydetmek/Aktarmak için önce hataları düzeltin.
                        </Alert>
                    )}

                    {/* Sefer Tarihi Alanları */}
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 1, mb: 1.2 }}>
                        <TextField
                            label="Sefer Tarihi (Eski)"
                            size="small"
                            value={fromISOToCombined(editSefer?.sefer_tarihi || "")}
                            InputProps={{ readOnly: true }}
                            InputLabelProps={{ shrink: true }}
                            sx={baseInputSX}
                        />

                        <DateTimeSingleField
                            label="Sefer Tarihi (Yeni)"
                            value={seferTarihiYeni || ""}
                            onChange={(v) => setSeferTarihiYeni(v)}
                            baseInputSX={baseInputSX}
                            required
                            disabled={!canEdit}
                        />
                    </Box>

                    {/* Satır Ekle Butonu */}
                    {canEdit && (
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Button startIcon={<AddIcon />} onClick={addDetailRow} color="info" variant="contained">
                                Satır Ekle
                            </Button>
                            <Typography variant="body2" sx={{ color: COLORS.textMuted }}>
                                Format: gg.aa.yyyy ss:dd (ör: 13.05.2025 09:35)
                            </Typography>
                        </Stack>
                    )}

                    {/* Detay Satırları */}
                    <Grid container spacing={1.2}>
                        {detailRows.map((r, i) => (
                            <Grid item xs={12} key={i}>
                                <Card variant="outlined" sx={{ borderColor: COLORS.border, background: COLORS.surface2, borderRadius: 2 }}>

                                    <CardHeader
                                        sx={{
                                            "& .MuiCardHeader-title": { fontWeight: 800, fontSize: 16 },
                                            "& .MuiCardHeader-subheader": { color: COLORS.textMuted },
                                            pb: 0.5
                                        }}
                                        title={`${i + 1}. Nokta`}
                                        subheader={r.yukleme_ili || r.teslim_ili ? `${r.yukleme_ili ?? ""} → ${r.teslim_ili ?? ""}` : ""}
                                        action={canEdit && (
                                            <Stack direction="row" spacing={0.5}>
                                                <Tooltip title="Bu satırı kopyala">
                                                    <span><IconButton onClick={() => copyDetailRow(i)} size="small" color="info"><ContentCopyIcon fontSize="inherit" /></IconButton></span>
                                                </Tooltip>
                                                <Tooltip title="Satırı sil">
                                                    <span><IconButton onClick={() => removeDetailRow(i)} size="small" color="error"><DeleteIcon fontSize="inherit" /></IconButton></span>
                                                </Tooltip>
                                            </Stack>
                                        )}
                                    />

                                    <CardContent sx={{ pt: 1.5, pb: 2 }}>
                                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 1 }}>
                                            {/* Metin Alanları (Değişmedi) */}
                                            {[
                                                ["proje_adi", "Proje Adı"], ["yukleme_noktasi", "Yükleme Noktası"], ["yukleme_ili", "Yükleme İl"],
                                                ["yukleme_ilcesi", "Yükleme İlçe"], ["teslim_noktasi", "Teslim Noktası"], ["teslim_ili", "Teslim İl"],
                                                ["teslim_ilcesi", "Teslim İlçe"],
                                            ].map(([k, l]) => (
                                                <TextField
                                                    key={k}
                                                    label={l}
                                                    size="small"
                                                    value={r[k] ?? ""}
                                                    onChange={(e) => handleDetailChange(i, k, e.target.value)}
                                                    InputLabelProps={{ shrink: true }}
                                                    sx={baseInputSX}
                                                    InputProps={{ readOnly: !canEdit }}
                                                />

                                            ))}

                                            {/* Tarih/Saat Alanları ve Sürekli Görünür Güncelleme Bilgisi */}
                                            {[
                                                ["yukleme_varis", "Yükleme Giriş"],
                                                ["yukleme_cikis", "Yükleme Çıkış"],
                                                ["teslim_varis", "Teslim Giriş"],
                                                ["teslim_cikis", "Teslim Çıkış"],
                                            ].map(([k, l]) => {
                                                const Adornment = canEdit ? createFieldUpdateInfoText(r, k, COLORS) : null;

                                                return (
                                                    <Box key={k} sx={{ position: 'relative' }}>
                                                        <DateTimeSingleField
                                                            label={l}
                                                            value={r[k] || ""}
                                                            onChange={(v) => handleDetailChange(i, k, v)}
                                                            baseInputSX={baseInputSX}
                                                            disabled={!canEdit}
                                                            EndAdornment={Adornment}
                                                        />

                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </DialogContent>

                <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
                    <Button onClick={onClose} startIcon={<ArrowBackIosNewIcon />}>Kapat</Button>
                    {canEdit && (
                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<SaveIcon />}
                                onClick={() => handleActionClick('save')}
                                // canSave = canEdit && !allDatesComplete
                                // Hata olsa bile Kaydet'e tıklanıp modalın açılmasına izin veriyoruz.
                                // Sadece düzenleme izni yoksa devre dışı bırakıyoruz.
                                disabled={!canEdit}
                            >
                                Kaydet
                            </Button>

                            <Tooltip
                                title={!canMoveToCompleted ? (hasValidationError ? "Önce Doğrulama Hatalarını Düzeltin" : "Tüm detay satırlarındaki 4 tarih/saat alanı (Giriş/Çıkış) ve Sefer Tarihi (Yeni) doldurulmalıdır.") : ""}
                            >
                                <span>
                                    <Button
                                        variant="contained"
                                        color="success"
                                        startIcon={<FileDownloadDoneIcon />}
                                        onClick={() => handleActionClick('complete')}
                                        disabled={!canMoveToCompleted}
                                    >
                                        Tamamlananlara Aktar
                                    </Button>
                                </span>
                            </Tooltip>
                        </Stack>
                    )}
                </DialogActions>
            </Dialog>
        </>
    );
}
