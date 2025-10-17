import React, { useMemo } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Stack, Button, Typography, TextField, Grid, Card, CardContent, CardHeader,
    Tooltip, IconButton
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadDoneIcon from "@mui/icons-material/FileDownloadDone";
import SaveIcon from "@mui/icons-material/Save";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";

/* ----------------------------------------------------------------------------- 
    Yardımcılar (tarih alanı) - (Bu kısım değişmedi, olduğu gibi duruyor)
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
// Bu fonksiyon, bir tarih dizesinin geçerli bir ISO tarih/saat dizesi olup olmadığını kontrol etmek için kullanılır.
// (Örn: "2025-10-17T14:55:00" formatında olmalı ve geçerli bir tarih oluşturmalı)
function isISODateTimeValid(isoString) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoString)) return false;
    const d = new Date(isoString);
    return !isNaN(d.getTime());
}

function DateTimeSingleField({
    label,
    value,
    onChange,
    sx,
    baseInputSX = {},
    disabled = false,
    required = false,
    errorText = "Geçersiz tarih/saat",
}) {
    const [text, setText] = React.useState("");
    const [touched, setTouched] = React.useState(false);

    React.useEffect(() => {
        if (!value) { setText(""); return; }
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                const pad = (n) => String(n).padStart(2, "0");
                setText(`${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`);
            } else {
                setText("");
            }
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
            placeholder="gg.aa.yyyy ss:dd"
            InputLabelProps={{ shrink: true }}
            inputProps={{ inputMode: "numeric", pattern: "\\d*", maxLength: 16 }}
            sx={baseInputSX || sx}
            disabled={disabled}
            error={showError}
            helperText={showError ? errorText : " "}
        />
    );
}

/* ----------------------------------------------------------------------------- 
    Dialog
----------------------------------------------------------------------------- */
export default function EditorDialog(props) {
    const {
        open, onClose, COLORS, computeAracStatu, fromISOToCombined, baseInputSX,
        canEdit,
        editSefer, detailRows, seferTarihiYeni, setSeferTarihiYeni,
        addDetailRow, copyDetailRow, removeDetailRow, onDetailChange,
        onSaveClick, onMoveToCompleted
    } = props;

    // YENİ MANTIK: Tüm gerekli tarihlerin girilip girilmediğini kontrol et
    const canMoveToCompleted = useMemo(() => {
        // Düzenleme izni yoksa butonu pasif tut
        if (!canEdit) return false;

        // Sefer Tarihi (Yeni) alanı da zorunlu ise kontrol et
        if (!isISODateTimeValid(seferTarihiYeni)) return false;

        // Detay satırlarını kontrol et
        const requiredFields = ["yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis"];

        // Tüm satırların tüm zorunlu alanları dolu ve geçerli olmalı
        const allDatesAreValid = detailRows.every(row =>
            requiredFields.every(field =>
                isISODateTimeValid(row[field])
            )
        );

        return allDatesAreValid;
    }, [canEdit, seferTarihiYeni, detailRows]);
    // Eğer detailRows prop'u çok büyükse veya sık değişiyorsa performans için dikkatli olunmalıdır.
    // Ancak bu senaryoda UI'daki kilitlenme mantığı için doğru bağımlılıktır.

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
                                                <span>
                                                    <IconButton onClick={() => copyDetailRow(i)} size="small" color="info">
                                                        <ContentCopyIcon fontSize="inherit" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="Satırı sil">
                                                <span>
                                                    <IconButton onClick={() => removeDetailRow(i)} size="small" color="error">
                                                        <DeleteIcon fontSize="inherit" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </Stack>
                                    )}
                                />
                                <CardContent sx={{ pt: 1.5 }}>
                                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 1 }}>
                                        {[
                                            ["proje_adi", "Proje Adı"],
                                            ["yukleme_noktasi", "Yükleme Noktası"],
                                            ["yukleme_ili", "Yükleme İl"],
                                            ["yukleme_ilcesi", "Yükleme İlçe"],
                                            ["teslim_noktasi", "Teslim Noktası"],
                                            ["teslim_ili", "Teslim İl"],
                                            ["teslim_ilcesi", "Teslim İlçe"],
                                        ].map(([k, l]) => (
                                            <TextField
                                                key={k}
                                                label={l}
                                                size="small"
                                                value={r[k] ?? ""}
                                                onChange={(e) => onDetailChange(i, k, e.target.value)}
                                                InputLabelProps={{ shrink: true }}
                                                sx={baseInputSX}
                                                InputProps={{ readOnly: !canEdit }}
                                            />
                                        ))}

                                        {/* Tarih/Saat alanları */}
                                        <DateTimeSingleField
                                            label="Yükleme Giriş"
                                            value={r.yukleme_varis || ""}
                                            onChange={(v) => onDetailChange(i, "yukleme_varis", v)}
                                            baseInputSX={baseInputSX}
                                            disabled={!canEdit}
                                        />
                                        <DateTimeSingleField
                                            label="Yükleme Çıkış"
                                            value={r.yukleme_cikis || ""}
                                            onChange={(v) => onDetailChange(i, "yukleme_cikis", v)}
                                            baseInputSX={baseInputSX}
                                            disabled={!canEdit}
                                        />
                                        <DateTimeSingleField
                                            label="Teslim Giriş"
                                            value={r.teslim_varis || ""}
                                            onChange={(v) => onDetailChange(i, "teslim_varis", v)}
                                            baseInputSX={baseInputSX}
                                            disabled={!canEdit}
                                        />
                                        <DateTimeSingleField
                                            label="Teslim Çıkış"
                                            value={r.teslim_cikis || ""}
                                            onChange={(v) => onDetailChange(i, "teslim_cikis", v)}
                                            baseInputSX={baseInputSX}
                                            disabled={!canEdit}
                                        />
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
                        {/* Kaydet butonu rengi değiştirildi */}
                        <Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={onSaveClick}>Kaydet</Button>

                        <Tooltip
                            title={!canMoveToCompleted ? "Tüm detay satırlarındaki 4 tarih/saat alanı (Giriş/Çıkış) doldurulmalıdır." : ""}
                        >
                            <span>
                                {/* Tamamlananlara Aktar butonu pasif hale getirildi */}
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={<FileDownloadDoneIcon />}
                                    onClick={onMoveToCompleted}
                                    disabled={!canMoveToCompleted} // Pasiflik şartı uygulandı
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
