// src/aktifseferler/EtaDialog.jsx
import React, { useMemo } from "react";
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
import LocationCityIcon from "@mui/icons-material/LocationCity"; // New Icon for City/District
import { makeGlam } from "./styles";
import { ETA_MESSAGES, ETA_STATUS } from "../utils/eta";

// --- NEW PROP: distanceInput and setDistanceInput (e.g., in kilometers) ---
// You will need to add this state management in the parent component that uses EtaDialog
// const [distanceInput, setDistanceInput] = useState("");
// const handleDistanceChange = (e) => setDistanceInput(e.target.value.replace(/[^0-9]/g, '')); // only allow numbers

export default function EtaDialog(props) {
    const {
        open, onClose, COLORS, etaRow, vehicleText, driverText, jobText, originText, destinationText, etaDistanceInfo,
        DateTimeOneField, BREAK_OPTIONS,
        driveHM, setDriveHM, breakSel, setBreakSel,
        computedETAISO, fromISOToCombined, copyETA, saveETA,
        mayOpenETA = false,
        canETA = false,
        /** YENİ: parent’tan gelen ilk yükleme çıkış (tek nokta veya çok noktanın ilki) */
        latestYuklemeCikis,
        // --- NEW PROPS FOR DISTANCE INPUT ---
        distanceInput,
        setDistanceInput,
        saveManualDistanceAndETA, // New function for saving distance and ETA
    } = props;

    const theme = useTheme();
    const glam = makeGlam(theme, COLORS);
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    // --- helpers ---
    const normalizeHM = (raw) => {
        const [h = "0", m = "0"] = String(raw || "").split(":");
        let H = parseInt(h, 10); if (Number.isNaN(H) || H < 0) H = 0;
        let M = parseInt(m, 10); if (Number.isNaN(M) || M < 0) M = 0;
        if (M >= 60) { H += Math.floor(M / 60); M = M % 60; }
        const hh = String(H).padStart(2, "0");
        const mm = String(M).padStart(2, "0");
        return `${hh}:${mm}`;
    };
    const handleHMBlur = (e) => setDriveHM(normalizeHM(e.target.value));

    const minToHM = (m) => {
        const n = Number(m) || 0;
        const hh = String(Math.floor(n / 60)).padStart(2, "0");
        const mm = String(n % 60).padStart(2, "0");
        return `${hh}:${mm}`;
    };

    const onCopy = () => { copyETA(); };

    // --- SADECE İLK NOKTA: Önce prop, yoksa etaRow içinden al ---
    const rawFirstYC =
        latestYuklemeCikis ??
        etaRow?.sefer_detaylari?.[0]?.yukleme_cikis ??
        null;

    // DateTimeOneField "YYYY-MM-DDTHH:mm" bekler
    const firstYCForInput = useMemo(() => {
        if (!rawFirstYC) return null;
        const d = (rawFirstYC instanceof Date) ? rawFirstYC : new Date(rawFirstYC);
        if (Number.isNaN(d.getTime())) return null;
        const pad = (n) => String(n).padStart(2, "0");
        const yyyy = d.getFullYear();
        const MM = pad(d.getMonth() + 1);
        const DD = pad(d.getDate());
        const hh = pad(d.getHours());
        const mm = pad(d.getMinutes());
        return `${yyyy}-${MM}-${DD}T${hh}:${mm}`;
    }, [rawFirstYC]);

    const firstYCKey = useMemo(() => String(firstYCForInput ?? "null"), [firstYCForInput]);
    const lackFirstYC = !firstYCForInput; // başlangıç yoksa ekranda uyarı gösteriyoruz

    // --- NEW LOGIC CHECK ---
    const isWaitingForDistance = computedETAISO === "__NEED_DISTANCE__";

    // --- YENİ DÜZENLEME: SADECE İLK YÜKLEME VE İLK TESLİMAT NOKTALARINI ALMA ---
    // Eğer data stringleri virgülle ayrılmışsa, sadece ilkini alır (SplitCell mantığına benzer).
    const splitFirst = (str) => (str || "").split(',')[0].trim() || "-";

    const yuklemeIli = splitFirst(etaRow?.yukleme_ili);
    const yuklemeIlcesi = splitFirst(etaRow?.yukleme_ilcesi);
    const teslimIli = splitFirst(etaRow?.teslim_ili);
    const teslimIlcesi = splitFirst(etaRow?.teslim_ilcesi);

    // Mesafe girişinin gerekli olduğu güzergah metni (Sadece ilk il/ilçeler)
    const distanceRouteText = `${yuklemeIli}/${yuklemeIlcesi} ➡️ ${teslimIli}/${teslimIlcesi}`;

    const canSaveDistance = isWaitingForDistance && distanceInput && Number(distanceInput) > 0;

    // The primary action for the Save/Kaydet button
    const handleSave = () => {
        if (isWaitingForDistance) {
            saveManualDistanceAndETA({
                distance: Number(distanceInput),
                // Kayıt için bu değişkenleri kullanıyoruz, böylece upsert işlemi sadece tekil il/ilçe çifti üzerinden yapılır.
                yukleme_il: yuklemeIli,
                yukleme_ilce: yuklemeIlcesi,
                teslim_il: teslimIli,
                teslim_ilce: teslimIlcesi,
            });
        } else if (canETA) {
            saveETA(); // Original ETA save for calculated ETA
        }
    };

    return (
        <Dialog
            open={open}
            onClose={isWaitingForDistance ? () => { } : onClose} // PREVENT CLOSING if waiting for distance
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
                    <Typography
                        component="span"
                        sx={glam.subtitle}
                        title={`${etaRow?.sefer_no || "-"} • ${etaRow?.plaka || "-"} • ${etaRow?.surucu_ad_soyad || "-"}`}
                    >
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

                    {/* Info cards (Driver, Job, Origin, Destination) */}
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
                                {/* Display City/District (SADECE İLK NOKTA) */}
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "flex", alignItems: "center" }}>
                                    <LocationCityIcon fontSize="inherit" sx={{ mr: 0.5 }} /> {yuklemeIli} / {yuklemeIlcesi}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box sx={glam.cardAccent}>
                                <Typography sx={glam.overline}>
                                    <FlagIcon sx={{ fontSize: 16, mr: .5, verticalAlign: "middle" }} /> Teslim
                                </Typography>
                                <Typography sx={{ ...glam.value, ...glam.clamp2 }} title={destinationText}>{destinationText}</Typography>
                                {/* Display City/District (SADECE İLK NOKTA) */}
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "flex", alignItems: "center" }}>
                                    <LocationCityIcon fontSize="inherit" sx={{ mr: 0.5 }} /> {teslimIli} / {teslimIlcesi}
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>

                    {/* KGM notu */}
                    <Box sx={glam.section}>
                        <Typography variant="caption" color="text.secondary">
                            Not: ETA KGM kuralına göre hesaplanır (4,5s + 45dk + 4,5s + 11s, 15+30 split destekli).
                        </Typography>
                        {etaDistanceInfo && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                {etaDistanceInfo}
                            </Typography>
                        )}
                    </Box>

                    {/* Form */}
                    <Box sx={[glam.formGroup, glam.killPillScope]}>
                        <Stack spacing={0}>
                            {/* Başlangıç (yalnızca ilk nokta; pasif) */}
                            <Box sx={{ p: { xs: 1, sm: 1.25 } }}>
                                <DateTimeOneField
                                    key={firstYCKey}
                                    label="Başlangıç (Yükleme Çıkış)"
                                    value={firstYCForInput || ""}      // controlled
                                    size="small"
                                    InputLabelProps={{ shrink: true }}
                                    sx={[glam.input]}
                                    fullWidth
                                    disabled                        // daima pasif
                                />
                            </Box>

                            <Divider />

                            {/* Kalan sürüş */}
                            <Box sx={{ p: { xs: 1, sm: 1.25 } }}>
                                <TextField
                                    label="Kalan Sürüş (ss:dd)"
                                    value={driveHM || minToHM(etaRow?.kalan_surus_dk)}
                                    onChange={(e) => setDriveHM(e.target.value)}
                                    onBlur={handleHMBlur}
                                    size="small"
                                    inputProps={{ maxLength: 5 }}
                                    InputLabelProps={{ shrink: true }}
                                    sx={[glam.input]}
                                    fullWidth
                                    disabled={!canETA && !isWaitingForDistance}
                                />
                            </Box>

                            <Divider />

                            {/* Başlangıçta mola */}
                            <Box sx={{ p: { xs: 1, sm: 1.25 } }}>
                                <TextField
                                    label="Başlangıçta mola"
                                    select
                                    size="small"
                                    value={
                                        typeof breakSel === "number" && !Number.isNaN(breakSel)
                                            ? breakSel
                                            : (etaRow?.eta_mola_dk ?? 0)
                                    }
                                    onChange={(e) => setBreakSel(Number(e.target.value) || 0)}
                                    helperText="Seçilen mola başlangıca eklenir"
                                    InputLabelProps={{ shrink: true }}
                                    sx={[glam.input]}
                                    fullWidth
                                    disabled={!canETA && !isWaitingForDistance}
                                >
                                    {BREAK_OPTIONS.map(o => (
                                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                    ))}
                                </TextField>
                            </Box>

                            {/* NEW: Manual Distance Input (shown when missing) */}
                            {isWaitingForDistance && (
                                <>
                                    <Divider />
                                    <Box sx={{ p: { xs: 1, sm: 1.25 }, backgroundColor: (t) => t.palette.warning.light + "20" }}>
                                        {/* YENİ EKLENEN METİN: Mesafe Giriş Güzergahı */}
                                        <Typography variant="body2" color="text.primary" sx={{ mb: 1, fontWeight: 600 }}>
                                            Manuel Mesafe Gerekiyor: <Box component="span" sx={{ color: (t) => t.palette.warning.dark }}>{distanceRouteText}</Box>
                                        </Typography>

                                        <TextField
                                            label="Manuel Mesafe (km)"
                                            value={distanceInput}
                                            onChange={(e) => setDistanceInput(e.target.value.replace(/[^0-9]/g, ''))} // only allow numbers
                                            size="small"
                                            InputLabelProps={{ shrink: true }}
                                            sx={[glam.input]}
                                            fullWidth
                                            required
                                            helperText="Lütfen mesafeyi kilometre cinsinden girin."
                                        />
                                    </Box>
                                </>
                            )}
                        </Stack>
                    </Box>

                    {/* ETA sonucu */}
                    <Box sx={glam.etaPanel}>
                        {lackFirstYC ? (
                            <Typography variant="body1"><b>ETA:</b> {ETA_MESSAGES[ETA_STATUS.WAITING_FIRST_YC]}</Typography>
                        ) : isWaitingForDistance ? ( // New check for waiting for distance
                            <Typography variant="body1" color="error">
                                <b>ETA:</b> {ETA_MESSAGES[ETA_STATUS.NEED_DISTANCE]} - Lütfen **manuel mesafe** girin.
                            </Typography>
                        ) : computedETAISO === "__WAITING__" ? (
                            <Typography variant="body1"><b>ETA:</b> {ETA_MESSAGES[ETA_STATUS.WAITING_FIRST_YC]}</Typography>
                        ) : (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body1" sx={{ fontWeight: 900 }}>
                                    ETA: {fromISOToCombined(computedETAISO) || "-"}
                                </Typography>
                                <Tooltip title="ETA'yı kopyala">
                                    <span>
                                        <IconButton size="small" onClick={() => onCopy()} disabled={lackFirstYC}>
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                    </span>
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
                {/* NEW: Kapat button is disabled if waiting for distance */}
                <Button onClick={onClose} disabled={isWaitingForDistance}>Kapat</Button>

                {mayOpenETA && (
                    <Button
                        variant="contained"
                        color={isWaitingForDistance ? "warning" : "success"} // Change color for manual input
                        disabled={isWaitingForDistance ? !canSaveDistance : !canETA} // Use new disable logic
                        onClick={handleSave} // Use combined save function
                        sx={{ fontWeight: 800, textTransform: "none" }}
                    >
                        {isWaitingForDistance ? "Mesafe Kaydet & Hesapla" : "Kaydet"}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
