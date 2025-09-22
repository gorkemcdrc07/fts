import React from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Stack, Button, Typography, TextField, Grid, Chip, Box, Tooltip, IconButton, Divider, MenuItem
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import NumbersIcon from "@mui/icons-material/Numbers";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PersonIcon from "@mui/icons-material/Person";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import PlaceIcon from "@mui/icons-material/Place";
import FlagIcon from "@mui/icons-material/Flag";
import { makeGlam } from "./styles";

export default function EtaDialog(props) {
    const {
        open, onClose, COLORS, etaRow, vehicleText, driverText, jobText, originText, destinationText, etaDistanceInfo,
        DateTimeOneField, TimeHMField, BREAK_OPTIONS, latestYuklemeCikis, nowLocalISO, baseInputSX,
        etaStartISO, setEtaStartISO, driveHM, setDriveHM, breakSel, setBreakSel, computedETAISO, fromISOToCombined, copyETA, saveETA
    } = props;

    const theme = useTheme();
    const glam = makeGlam(theme, COLORS);
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    const normalizeHM = (raw) => {
        const [h = "", m = ""] = String(raw || "").split(":");
        const hh = String(parseInt(h || "0", 10)).padStart(2, "0");
        const mm = String(parseInt(m || "0", 10)).padStart(2, "0");
        return `${hh}:${mm}`;
    };
    const handleHMBlur = (e) => setDriveHM(normalizeHM(e.target.value));
    const onCopy = async () => { await Promise.resolve(copyETA()); };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            fullScreen={fullScreen}
            scroll="paper"
            PaperProps={{
                sx: {
                    ...glam.paper,
                    m: { xs: 1, sm: 2 },
                    width: "calc(100% - 16px)",
                    maxHeight: "92vh",
                    borderRadius: { xs: 2, sm: 3 },
                }
            }}
        >
            {/* Sticky Header */}
            <Box sx={{ ...glam.headerBar, position: "sticky", top: 0, zIndex: 1 }}>
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, p: 0, ...glam.title }}>
                    ETA Hesabı
                    <Typography component="span" sx={glam.subtitle}>
                        {etaRow?.sefer_no || "-"} • {etaRow?.plaka || "-"} • {etaRow?.surucu_ad_soyad || "-"}
                    </Typography>
                </DialogTitle>
            </Box>

            {/* Scrollable Content */}
            <DialogContent dividers sx={{ p: { xs: 1.25, sm: 2 }, overflowY: "auto" }}>
                <Stack spacing={1.25}>

                    {/* Meta chips */}
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip size="small" icon={<NumbersIcon />} label={etaRow?.sefer_no || "-"} sx={glam.chip} />
                        <Chip size="small" icon={<LocalShippingIcon />} label={vehicleText} sx={glam.chip} />
                    </Stack>

                    {/* Info cards */}
                    <Grid container spacing={1}>
                        <Grid item xs={12} md={6}>
                            <Box sx={glam.cardAccent}>
                                <Typography sx={glam.overline}>
                                    <PersonIcon sx={{ fontSize: 16, mr: .5, verticalAlign: "middle" }} /> Şoför
                                </Typography>
                                <Typography sx={{ ...glam.value, ...glam.clamp2 }} title={driverText}>{driverText}</Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box sx={glam.cardAccent}>
                                <Typography sx={glam.overline}>
                                    <WorkOutlineIcon sx={{ fontSize: 16, mr: .5, verticalAlign: "middle" }} /> İş
                                </Typography>
                                <Typography sx={{ ...glam.value, ...glam.clamp2 }} title={jobText}>{jobText}</Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box sx={glam.cardAccent}>
                                <Typography sx={glam.overline}>
                                    <PlaceIcon sx={{ fontSize: 16, mr: .5, verticalAlign: "middle" }} /> Yükleme
                                </Typography>
                                <Typography sx={{ ...glam.value, ...glam.clamp2 }} title={originText}>{originText}</Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box sx={glam.cardAccent}>
                                <Typography sx={glam.overline}>
                                    <FlagIcon sx={{ fontSize: 16, mr: .5, verticalAlign: "middle" }} /> Teslim
                                </Typography>
                                <Typography sx={{ ...glam.value, ...glam.clamp2 }} title={destinationText}>{destinationText}</Typography>
                            </Box>
                        </Grid>
                    </Grid>

                    {/* KGM notu */}
                    <Box sx={glam.section}>
                        <Typography variant="caption" color="text.secondary">
                            Not: ETA KGM kuralına göre hesaplanır (4,5s + 45dk + 4,5s + 45dk + 11s).
                        </Typography>
                        {etaDistanceInfo && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                {etaDistanceInfo}
                            </Typography>
                        )}
                    </Box>

                    {/* Form — kill pill scope ile elips tamamen kalkar */}
                    <Box sx={[glam.formGroup, glam.killPillScope]}>
                        <Stack spacing={0}>
                            <Box sx={{ p: { xs: 1, sm: 1.25 } }}>
                                <DateTimeOneField
                                    label="Başlangıç (Yükleme Çıkış / Şimdi)"
                                    value={etaStartISO || latestYuklemeCikis || nowLocalISO()}
                                    onChange={(e) => setEtaStartISO(e.target.value || latestYuklemeCikis || nowLocalISO())}
                                    size="small"
                                    InputLabelProps={{ shrink: true }}
                                    sx={[glam.input]}
                                    fullWidth
                                />
                            </Box>

                            <Divider />

                            <Box sx={{ p: { xs: 1, sm: 1.25 } }}>
                                <TimeHMField
                                    label="Kalan Sürüş (ss:dd)"
                                    value={driveHM}
                                    onChange={(e) => setDriveHM(e.target.value)}
                                    onBlur={handleHMBlur}
                                    size="small"
                                    inputProps={{ maxLength: 5 }}
                                    InputLabelProps={{ shrink: true }}
                                    sx={[glam.input]}
                                    fullWidth
                                />
                            </Box>

                            <Divider />

                            <Box sx={{ p: { xs: 1, sm: 1.25 } }}>
                                <TextField
                                    label="Başlangıçta mola"
                                    select
                                    size="small"
                                    value={breakSel}
                                    onChange={(e) => setBreakSel(Number(e.target.value))}
                                    helperText="Seçilen mola başlangıca eklenir"
                                    InputLabelProps={{ shrink: true }}
                                    sx={[glam.input]}
                                    fullWidth
                                >
                                    {BREAK_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                                </TextField>
                            </Box>
                        </Stack>
                    </Box>

                    {/* ETA */}
                    <Box sx={glam.etaPanel}>
                        {computedETAISO === "__NEED_DISTANCE__" ? (
                            <Typography variant="body1"><b>ETA:</b> Bekleniyor — Mesafe bulunamadı.</Typography>
                        ) : computedETAISO === "__WAITING__" ? (
                            <Typography variant="body1"><b>ETA:</b> Bekleniyor — “Yükleme Çıkış” bilgisi girilmemiş.</Typography>
                        ) : (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body1" sx={{ fontWeight: 900 }}>
                                    ETA: {fromISOToCombined(computedETAISO) || "-"}
                                </Typography>
                                <Tooltip title="ETA'yı kopyala">
                                    <span><IconButton size="small" onClick={onCopy}><ContentCopyIcon fontSize="small" /></IconButton></span>
                                </Tooltip>
                            </Stack>
                        )}
                    </Box>

                </Stack>
            </DialogContent>

            {/* Sticky Actions */}
            <DialogActions
                sx={{
                    px: { xs: 1.25, sm: 2 },
                    py: 1,
                    position: "sticky",
                    bottom: 0,
                    zIndex: 1,
                    backgroundColor: (t) => t.palette.background.paper,
                    borderTop: (t) => `1px solid ${t.palette.divider}`,
                }}
            >
                <Button onClick={onClose}>Kapat</Button>
                <Button
                    variant="contained"
                    color="success"
                    onClick={saveETA}
                    sx={{ fontWeight: 800, textTransform: "none" }}
                >
                    Kaydet
                </Button>
            </DialogActions>
        </Dialog>
    );
}
