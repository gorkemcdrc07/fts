import React from "react";
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

export default function EditorDialog(props) {
    const {
        open, onClose, COLORS, computeAracStatu, fromISOToCombined, baseInputSX,
        canEdit, editSefer, detailRows, seferTarihiYeni, setSeferTarihiYeni,
        addDetailRow, copyDetailRow, removeDetailRow, onDetailChange,
        DateTimeOneField, onSaveClick, onMoveToCompleted
    } = props;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl"
            PaperProps={{ sx: { backgroundColor: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}` } }}>
            <DialogTitle sx={{ fontWeight: 900 }}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    {editSefer?.sefer_no || "-"} • {editSefer?.plaka || "-"} • {editSefer?.musteri_adi || "-"}
                </Typography>
                <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                    {computeAracStatu(detailRows) || "—"}
                </Typography>
            </DialogTitle>

            <DialogContent dividers sx={{ backgroundColor: alpha("#fff", 0.01) }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 1, mb: 1.2 }}>
                    <TextField label="Sefer Tarihi (Eski)" size="small"
                        value={fromISOToCombined(editSefer?.sefer_tarihi || "")}
                        InputProps={{ readOnly: true }} InputLabelProps={{ shrink: true }} sx={baseInputSX} />
                    <DateTimeOneField label="Sefer Tarihi (Yeni)" value={seferTarihiYeni || ""}
                        onChange={(v) => setSeferTarihiYeni(v)} sx={baseInputSX} />
                </Box>

                {canEdit && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Button startIcon={<AddIcon />} onClick={addDetailRow} color="info" variant="contained">Satır Ekle</Button>
                        <Typography variant="body2" sx={{ color: COLORS.textMuted }}>
                            gg.aa.yyyy ss:dd (ör: 13.05.2025 09:35)
                        </Typography>
                    </Stack>
                )}

                <Grid container spacing={1.2}>
                    {detailRows.map((r, i) => (
                        <Grid item xs={12} key={i}>
                            <Card variant="outlined" sx={{ borderColor: COLORS.border, background: COLORS.surface2, borderRadius: 2 }}>
                                <CardHeader
                                    sx={{ "& .MuiCardHeader-title": { fontWeight: 800, fontSize: 16 }, "& .MuiCardHeader-subheader": { color: COLORS.textMuted }, pb: 0.5 }}
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
                                <CardContent sx={{ pt: 1.5 }}>
                                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 1 }}>
                                        {[
                                            ["proje_adi", "Proje Adı"], ["yukleme_noktasi", "Yükleme Noktası"], ["yukleme_ili", "Yükleme İl"],
                                            ["yukleme_ilcesi", "Yükleme İlçe"], ["teslim_noktasi", "Teslim Noktası"], ["teslim_ili", "Teslim İl"], ["teslim_ilcesi", "Teslim İlçe"],
                                        ].map(([k, l]) => (
                                            <TextField key={k} label={l} size="small" value={r[k] ?? ""} onChange={(e) => onDetailChange(i, k, e.target.value)}
                                                InputLabelProps={{ shrink: true }} sx={baseInputSX} />
                                        ))}

                                        <DateTimeOneField label="Yükleme Varış" value={r.yukleme_varis || ""} onChange={(v) => onDetailChange(i, "yukleme_varis", v)} sx={baseInputSX} />
                                        <DateTimeOneField label="Yükleme Çıkış" value={r.yukleme_cikis || ""} onChange={(v) => onDetailChange(i, "yukleme_cikis", v)} sx={baseInputSX} />
                                        <DateTimeOneField label="Teslim Varış" value={r.teslim_varis || ""} onChange={(v) => onDetailChange(i, "teslim_varis", v)} sx={baseInputSX} />
                                        <DateTimeOneField label="Teslim Çıkış" value={r.teslim_cikis || ""} onChange={(v) => onDetailChange(i, "teslim_cikis", v)} sx={baseInputSX} />
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
                        <Button variant="outlined" color="secondary" startIcon={<SaveIcon />} onClick={onSaveClick}>Kaydet</Button>
                        <Button variant="contained" color="success" startIcon={<FileDownloadDoneIcon />} onClick={onMoveToCompleted}>Tamamlananlara Aktar</Button>
                    </Stack>
                )}
            </DialogActions>
        </Dialog>
    );
}
