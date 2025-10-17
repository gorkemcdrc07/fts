import React, { useMemo } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Stack, Button, Typography, TextField, Grid, Card, CardContent, CardHeader,
    Tooltip, IconButton, InputAdornment
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadDoneIcon from "@mui/icons-material/FileDownloadDone";
import SaveIcon from "@mui/icons-material/Save";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";

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

// Orijinal fromISO mantığı (sadece parçalama yapar, kayma içermez)
export const fromISO = (raw) => {
    if (!raw) return { d: "", t: "" };

    const s = String(raw).trim().replace(" ", "T");

    // "2025-05-13T13:13" → parçala
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
// DateTimeSingleField: EndAdornment kullanmak için güncellendi
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
        // Ana tarih alanları fromISOToCombined ile formatlanır
        if (!value) { setText(""); return; }
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
            setText(fromISOToCombined(value));
        } else {
            setText(value);
        }
    }, [value]);

    function handleChange(e) {
        // ... (Değişiklik yönetimi mantığı)
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

            // Burada new Date(Y, M-1, D, H, M) ile yerel zaman objesi oluşturulur.
            const dt = new Date(yyyy, MM - 1, dd, HH, mm);
            if (!isNaN(dt.getTime())) {
                onChange(toLocalISOString(dt));
                return;
            }
        }
        onChange(masked);
    }

    const digs = normalizeFormattedToDigits(text);
    const complete = digs.length === 12;
    const { dd, MM, yyyy, HH, mm } = validateParts(
        digs.slice(0, 2), digs.slice(2, 4), digs.slice(4, 8), digs.slice(8, 10), digs.slice(10, 12)
    );
    const isValid = complete && !!dd && !!MM && !!yyyy && !!HH && !!mm;
    const showError = touched && !isValid && (required || digs.length > 0);

    // Ana bileşeni döndür
    return (
        <TextField
            label={label}
            size="small"
            value={text}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            placeholder="gg.aa.yyyy ss:dd"
            InputLabelProps={{ shrink: true }}
            inputProps={{ inputMode: "numeric", pattern: "\\d*", maxLength: 16 }}
            sx={baseInputSX || sx}
            disabled={disabled}
            error={showError}
            helperText={showError ? errorText : " "}
            // InputProps içine Adornment ekleniyor
            InputProps={EndAdornment ? {
                endAdornment: EndAdornment,
                sx: { pr: 1.5 } // Adornment için biraz sağ boşluk bırak
            } : undefined}
        />
    );
}


/* ----------------------------------------------------------------------------- 
    Dialog
----------------------------------------------------------------------------- */

/** * GÜNCELLEME ZAMANINA +3 saat kayması EKLEYEN fonksiyon (13:23 -> 16:23)
 * UTC saatini yerel saati olarak gösterir.
 */
function fromISOTooltipFixed(raw) {
    if (!raw) return "";

    const s = String(raw).trim().replace(" ", "T");
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return "";

    // Dize parçalarını al
    let [y, mo, dd, hh, mi] = m.map(Number).slice(1);

    // YALNIZCA BURADA 3 SAAT EKLEME YAPILIYOR (13:23 -> 16:23)
    let totalMinutes = (hh * 60) + mi + (3 * 60);

    // Yeni saat ve gün/saat kaymalarını hesapla
    const carryHours = Math.floor(totalMinutes / 60);
    const newHH = carryHours % 24;
    const newMI = totalMinutes % 60;

    const daysToAdd = Math.floor(carryHours / 24);

    // Gün kayması varsa, tarih parçalarını kullanarak günü ayarla
    if (daysToAdd > 0) {
        const tempDate = new Date(y, mo - 1, dd);
        tempDate.setDate(tempDate.getDate() + daysToAdd);

        y = tempDate.getFullYear();
        mo = tempDate.getMonth() + 1;
        dd = tempDate.getDate();
    }

    const pad = (n) => String(n).padStart(2, "0");

    // Sadece saat/dakika ve günü döndür (gg.aa formatında)
    return `${pad(newHH)}:${pad(newMI)} ${pad(dd)}.${pad(mo)}`;
}


/** * YENİ: Alan Altı için gerekli bilgiyi hazırlar ve JSX Adornment'ı döndürür
 * @param {object} row - Sefer detay satırı
 * @param {string} fieldName - Alan adı ('yukleme_varis' vb.)
 * @param {object} COLORS - Renk sabitleri
 */
function createFieldUpdateInfoText(row, fieldName, COLORS) {
    const userKey = `${fieldName}_guncelleyen`;
    const dateKey = `${fieldName}_guncelleme_tarihi`;

    const user = row[userKey];
    const dateISO = row[dateKey];

    if (user && dateISO) {
        const formattedDate = fromISOTooltipFixed(dateISO);
        const shortUser = user.split(' ')[0].slice(0, 1); // Kullanıcı adının sadece ilk harfi

        // Bilgiyi zarif bir EndAdornment içinde minimalist bir etiket olarak döndürürüz
        const infoJSX = (
            <InputAdornment position="end" sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                height: 'auto',
                pointerEvents: 'none',
            }}>
                <Tooltip title={`Güncelleyen: ${user} - Kayıt Zamanı: ${formattedDate.replace(' ', ' ')}`} placement="top" enterDelay={500}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        py: '2px',
                        px: '6px',
                        borderRadius: '4px',
                        bgcolor: alpha('#00e676', 0.1),
                        color: alpha(COLORS.text, 0.7),
                        fontSize: 10,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        pointerEvents: 'auto',
                        border: `1px solid ${alpha('#00e676', 0.3)}`,
                    }}>
                        <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700, color: COLORS.text }}>
                            {shortUser}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: 10, opacity: 0.8 }}>
                            {formattedDate.split(' ')[0]}
                        </Typography>
                    </Box>
                </Tooltip>
            </InputAdornment>
        );

        return infoJSX;
    }
    return null;
}

export default function EditorDialog(props) {
    const {
        open, onClose, COLORS, computeAracStatu, fromISOToCombined, baseInputSX,
        canEdit,
        editSefer, detailRows, seferTarihiYeni, setSeferTarihiYeni,
        addDetailRow, copyDetailRow, removeDetailRow, onDetailChange,
        onSaveClick, onMoveToCompleted
    } = props;

    // Tüm tarih alanlarının dolu olup olmadığını kontrol eden ana mantık
    const allDatesComplete = useMemo(() => {
        if (!isISODateTimeValid(seferTarihiYeni)) return false;

        const requiredFields = ["yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis"];

        const allValid = detailRows.every(row =>
            requiredFields.every(field =>
                isISODateTimeValid(row[field])
            )
        );

        return allValid;
    }, [seferTarihiYeni, detailRows]);

    // Kaydet butonu: Düzenleme izni varsa VE tüm tarihler henüz tamamlanmamışsa aktif
    const canSave = canEdit && !allDatesComplete;

    // Tamamlananlara Aktar butonu: Düzenleme izni varsa VE tüm tarihler TAMAMLANMIŞSA aktif
    const canMoveToCompleted = canEdit && allDatesComplete;

    return (
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

                                {/* Card Header (Başlık ve Aksiyonlar) */}
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
                                            <TextField key={k} label={l} size="small" value={r[k] ?? ""} onChange={(e) => onDetailChange(i, k, e.target.value)}
                                                InputLabelProps={{ shrink: true }} sx={baseInputSX} InputProps={{ readOnly: !canEdit }}
                                            />
                                        ))}

                                        {/* YENİ: Tarih/Saat Alanları ve Sürekli Görünür Güncelleme Bilgisi */}
                                        {[
                                            ["yukleme_varis", "Yükleme Giriş"],
                                            ["yukleme_cikis", "Yükleme Çıkış"],
                                            ["teslim_varis", "Teslim Giriş"],
                                            ["teslim_cikis", "Teslim Çıkış"],
                                        ].map(([k, l]) => {
                                            // COLORS prop'u createFieldUpdateInfoText'e iletiliyor
                                            const Adornment = canEdit ? createFieldUpdateInfoText(r, k, COLORS) : null;

                                            return (
                                                <Box key={k} sx={{ position: 'relative' }}>
                                                    <DateTimeSingleField
                                                        label={l}
                                                        value={r[k] || ""}
                                                        onChange={(v) => onDetailChange(i, k, v)}
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
                            onClick={onSaveClick}
                            disabled={!canSave} // KRİTİK: YENİ MANTIK UYGULANDI
                        >
                            Kaydet
                        </Button>

                        <Tooltip
                            title={!canMoveToCompleted ? "Tüm detay satırlarındaki 4 tarih/saat alanı (Giriş/Çıkış) ve Sefer Tarihi (Yeni) doldurulmalıdır." : ""}
                        >
                            <span>
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={<FileDownloadDoneIcon />}
                                    onClick={onMoveToCompleted}
                                    disabled={!canMoveToCompleted} // KRİTİK: YENİ MANTIK UYGULANDI
                                >
                                    Tamamlananlara Aktar
                                </Button>
                            </span>
                        </Tooltip>
                    </Stack>
                )}
            </DialogActions>
        </Dialog>
    );
}
