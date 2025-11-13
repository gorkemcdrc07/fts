import React, { useMemo } from "react";
import {
    Drawer, Typography, Stack, Chip, Box, IconButton, Divider,
    Tooltip, Grid, Button
} from "@mui/material";
import {
    Close as CloseIcon,
    Person as PersonIcon,
    LocalShipping as LocalShippingIcon,
    AccessTime as AccessTimeIcon,
    FileUpload as FileUploadIcon,
    FileDownload as FileDownloadIcon,
    MoreTime as MoreTimeIcon,
    LocationOn as LocationOnIcon,
    EditNote as EditNoteIcon,
    Flag as FlagIcon,
    WatchLater as WatchLaterIcon,
    Phone as PhoneIcon,
    Business as BusinessIcon,
    RouteOutlined as RouteIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { keyframes } from "@mui/system";
import { alpha } from "@mui/material/styles";

// ===================== ANİMASYON =====================
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ===================== YARDIMCI BİLEŞENLER =====================

const InfoItem = ({ icon, label, value, dense = false }) => (
    <Stack
        direction="row"
        spacing={1}
        alignItems={dense ? "flex-start" : "center"}
    >
        <Box sx={{ color: dense ? "text.secondary" : "inherit", mt: dense ? 0.5 : 0 }}>
            {React.cloneElement(icon, { sx: { fontSize: dense ? "1.1rem" : "1.3rem" } })}
        </Box>
        <Stack>
            <Typography
                variant="caption"
                lineHeight={1.2}
                sx={{ opacity: 0.8 }}
            >
                {label}
            </Typography>
            <Typography
                variant={dense ? "body2" : "body1"}
                fontWeight={600}
                noWrap
            >
                {value || "—"}
            </Typography>
        </Stack>
    </Stack>
);

const UpdateInfo = ({ user, date, fmt, type }) => {
    if (!user) return null;
    return (
        <Tooltip title={`${type} Güncelleyen: ${user}\nTarih: ${fmt.dateTR(date)}`}>
            <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
                <EditNoteIcon sx={{ fontSize: "1rem" }} />
                <Typography variant="caption" noWrap>
                    {`${type}: ${user}`}
                </Typography>
            </Stack>
        </Tooltip>
    );
};

const TimelineStep = ({ event, fmt, isLast }) => {
    const isSeyahat = event.type === "Seyahat";

    let Icon, color;
    if (event.type === "Yükleme") {
        Icon = FileUploadIcon;
        color = "primary.main";
    } else if (event.type === "Teslim") {
        Icon = FileDownloadIcon;
        color = "success.main";
    } else {
        Icon = MoreTimeIcon;
        color = "grey.500";
    }

    const resolveColor = (theme, colorString) => {
        const [paletteKey, shade] = colorString.split(".");
        const resolved =
            theme.palette[paletteKey] && theme.palette[paletteKey][shade]
                ? theme.palette[paletteKey][shade]
                : colorString;
        return resolved;
    };

    return (
        <Stack
            direction="row"
            spacing={2}
            sx={{ animation: `${fadeIn} 0.4s ease-out both` }}
        >
            {/* SOL TARAF: İKON VE ÇİZGİ */}
            <Stack alignItems="center" sx={{ minWidth: 32 }}>
                <Box
                    sx={(theme) => ({
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        bgcolor: alpha(resolveColor(theme, color), 0.1),
                        color: color,
                        display: "grid",
                        placeItems: "center",
                    })}
                >
                    <Icon sx={{ fontSize: "1rem" }} />
                </Box>
                {!isLast && (
                    <Box
                        sx={{
                            flex: 1,
                            width: "2px",
                            bgcolor: "divider",
                            my: 0.5,
                        }}
                    />
                )}
            </Stack>

            {/* SAĞ TARAF: İÇERİK */}
            <Box sx={{ pb: isLast ? 0 : 3, pt: 0.5, width: "100%" }}>
                {isSeyahat ? (
                    // Seyahat içeriği
                    <Stack>
                        <Typography variant="body1" fontWeight={600}>
                            Yüklemeye Seyahat
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Tahmini Süre: {fmt.minutes(event.travel_dk)}
                        </Typography>
                    </Stack>
                ) : (
                    // Yükleme / Teslim içeriği
                    <Stack spacing={2}>
                        <Box>
                            <Chip
                                label={`${event.type} (Durak ${event.sira})`}
                                size="small"
                                sx={(theme) => ({
                                    bgcolor: alpha(resolveColor(theme, color), 0.1),
                                    color: color,
                                    fontWeight: 600,
                                    mb: 0.5,
                                })}
                            />
                            <Typography variant="h6" fontWeight={700}>
                                {event.nokta || "Lokasyon Belirtilmemiş"}
                            </Typography>
                        </Box>

                        <Divider />

                        <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={5}>
                                <InfoItem
                                    dense
                                    icon={<AccessTimeIcon />}
                                    label="Varış"
                                    value={fmt.dateTR(event.varis)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={5}>
                                <InfoItem
                                    dense
                                    icon={<AccessTimeIcon />}
                                    label="Çıkış"
                                    value={fmt.dateTR(event.cikis)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={2}>
                                <InfoItem
                                    dense
                                    icon={<WatchLaterIcon />}
                                    label="Bekleme"
                                    value={fmt.minutes(event.bekleme_dk)}
                                />
                            </Grid>
                        </Grid>

                        {(event.varis_guncelleyen || event.cikis_guncelleyen) && (
                            <>
                                <Divider />
                                <Stack
                                    direction="row"
                                    spacing={3}
                                    sx={{ opacity: 0.8 }}
                                >
                                    <UpdateInfo
                                        user={event.varis_guncelleyen}
                                        date={event.varis_guncelleme_tarihi}
                                        fmt={fmt}
                                        type="Varış"
                                    />
                                    <UpdateInfo
                                        user={event.cikis_guncelleyen}
                                        date={event.cikis_guncelleme_tarihi}
                                        fmt={fmt}
                                        type="Çıkış"
                                    />
                                </Stack>
                            </>
                        )}
                    </Stack>
                )}
            </Box>
        </Stack>
    );
};

// ===================== ANA MODAL BİLEŞENİ =====================

const TripDetailModal = ({ trip, stopRows, open, onClose, fmt }) => {
    const { processedEvents, summary } = useMemo(() => {
        const events = [];
        let totalWaitMinutes = 0;

        if (!stopRows || stopRows.length === 0) {
            return {
                processedEvents: [],
                summary: { totalWaitMinutes: 0, totalStops: 0 },
            };
        }

        // 1) GEÇERLİ YÜKLEME DURAKLARINI AL
        const rawLoadingStops = stopRows
            .filter((stop) => stop.yukleme_noktasi || stop.yukleme_varis)
            .sort(
                (a, b) =>
                    (a.nokta_sirasi ?? 999) - (b.nokta_sirasi ?? 999)
            );

        // 2) AYNI NOKTA + AYNI VARIŞ + AYNI ÇIKIŞ OLAN DURAKLARI TEKİLLE
        const seen = new Set();
        const loadingStops = rawLoadingStops.filter((stop) => {
            const key = [
                stop.yukleme_noktasi ?? "",
                stop.yukleme_varis ?? "",
                stop.yukleme_cikis ?? "",
            ].join("|");

            if (seen.has(key)) {
                // duplicate => listeye ekleme, toplam beklemeye de katma
                return false;
            }
            seen.add(key);
            return true;
        });

        const totalStops = loadingStops.length;

        if (totalStops === 0) {
            return {
                processedEvents: [],
                summary: { totalWaitMinutes: 0, totalStops: 0 },
            };
        }

        loadingStops.forEach((stop, index) => {
            // YÜKLEME OLAYI
            events.push({
                id: `${stop.id}-load`,
                type: "Yükleme",
                sira: stop.sira,
                nokta: stop.yukleme_noktasi,
                varis: stop.yukleme_varis,
                cikis: stop.yukleme_cikis,
                bekleme_dk: stop.yukleme_bekleme_dk,
                varis_guncelleyen: stop.yukleme_varis_guncelleyen,
                varis_guncelleme_tarihi: stop.yukleme_varis_guncelleme_tarihi,
                cikis_guncelleyen: stop.yukleme_cikis_guncelleyen,
                cikis_guncelleme_tarihi: stop.yukleme_cikis_guncelleme_tarihi,
            });

            // BEKLEME TOPLAMI (ARTIK TEKİL DURAKLAR ÜZERİNDEN)
            totalWaitMinutes += stop.yukleme_bekleme_dk || 0;

            // SONRAKİ YÜKLEMEYE SEYAHAT
            const lastDepartureTime = stop.yukleme_cikis;
            const nextLoadingStop = loadingStops[index + 1];

            if (nextLoadingStop && lastDepartureTime) {
                const nextArrivalTime = nextLoadingStop.yukleme_varis;
                if (nextArrivalTime) {
                    const travel_dk = dayjs(nextArrivalTime).diff(
                        dayjs(lastDepartureTime),
                        "minute"
                    );
                    if (travel_dk > 0) {
                        events.push({
                            id: `${stop.id}-travel`,
                            type: "Seyahat",
                            travel_dk: travel_dk,
                        });
                    }
                }
            }
        });

        const summaryData = { totalWaitMinutes, totalStops };
        return { processedEvents: events, summary: summaryData };
    }, [stopRows]);

    if (!trip) return null;

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: { xs: "100%", md: 600, lg: 700 },
                    borderTopLeftRadius: 16,
                    borderBottomLeftRadius: 16,
                },
            }}
        >
            {/* HEADER */}
            <Box
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    bgcolor: "grey.900",
                    color: "white",
                    p: 2.5,
                }}
            >
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2.5}
                >
                    <Typography variant="h6" fontWeight={700}>
                        Yükleme Akışı: {trip.sefer_no}
                    </Typography>
                    <IconButton
                        onClick={onClose}
                        sx={{ color: "white" }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Stack>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <InfoItem
                            icon={<PersonIcon />}
                            label="Şoför"
                            value={trip.surucu_ad_soyad}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <InfoItem
                            icon={<LocalShippingIcon />}
                            label="Plaka"
                            value={trip.plaka}
                        />
                    </Grid>
                </Grid>
            </Box>

            {/* İÇERİK */}
            <Box sx={{ p: 3, overflowY: "auto" }}>
                <Stack spacing={0}>
                    {processedEvents.length > 0 ? (
                        processedEvents.map((event, index) => (
                            <TimelineStep
                                key={event.id}
                                event={event}
                                fmt={fmt}
                                isLast={index === processedEvents.length - 1}
                            />
                        ))
                    ) : (
                        <Typography
                            color="text.secondary"
                            sx={{ p: 3, textAlign: "center" }}
                        >
                            Bu sefere ait geçerli bir yükleme durağı
                            bulunamadı.
                        </Typography>
                    )}
                </Stack>
            </Box>

            {/* FOOTER ÖZET */}
            <Box
                sx={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 1,
                    bgcolor: "white",
                    p: 2.5,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 -4px 12px rgba(0,0,0,0.05)",
                }}
            >
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Stack>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                        >
                            Toplam Yükleme Durağı
                        </Typography>
                        <Typography variant="h5" fontWeight={700}>
                            {summary.totalStops}
                        </Typography>
                    </Stack>
                    <Stack>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                        >
                            Toplam Yükleme Bekleme
                        </Typography>
                        <Typography
                            variant="h5"
                            fontWeight={700}
                            color="warning.main"
                        >
                            {fmt.minutes(summary.totalWaitMinutes)}
                        </Typography>
                    </Stack>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        size="large"
                    >
                        Kapat
                    </Button>
                </Stack>
            </Box>
        </Drawer>
    );
};

export default TripDetailModal;
