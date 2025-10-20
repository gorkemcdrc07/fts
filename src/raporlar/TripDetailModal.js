import React, { useMemo } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid,
    Typography, Stack, Chip, Box, Card, CardContent, IconButton, Divider
} from "@mui/material";
import {
    Close as CloseIcon, RouteOutlined as RouteIcon, Person as PersonIcon,
    LocalShipping as LocalShippingIcon, RvHookup as RvHookupIcon,
    Badge as BadgeIcon, Phone as PhoneIcon, FmdGood as FmdGoodIcon,
    AccessTime as AccessTimeIcon, ArrowDownward as ArrowDownwardIcon,
    FileUpload as FileUploadIcon, FileDownload as FileDownloadIcon,
    MoreTime as MoreTimeIcon, LocationOn as LocationOnIcon, Edit as EditIcon
} from "@mui/icons-material";
import { keyframes } from '@mui/system';
import dayjs from "dayjs"; // dayjs'i burada da kullanacağız

// ===================== ANİMASYONLAR =====================
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ===================== YARDIMCI BİLEŞENLER =====================

const fmtMinutes = (min) => {
    if (min === null || min === undefined || min < 0) return "—";
    const n = Math.round(Number(min));
    if (!Number.isFinite(n)) return "—";
    const h = Math.floor(n / 60);
    const m = Math.floor(n % 60);
    if (h <= 0) return `${m} dk`;
    return `${h} sa ${m.toString().padStart(2, "0")} dk`;
};

const InfoLine = ({ icon, label, value, direction = 'column' }) => (
    <Stack direction={direction === 'row' ? 'row' : 'column'} spacing={direction === 'row' ? 1.5 : 0.5} alignItems={direction === 'row' ? 'center' : 'flex-start'}>
        <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
            {icon}
            <Typography variant="caption">{label}</Typography>
        </Stack>
        <Typography fontWeight={600} pl={direction === 'row' ? 0 : 3.5}>{value || "—"}</Typography>
    </Stack>
);

const StatCard = ({ icon, label, value, color }) => (
    <Card variant="outlined" sx={{ flex: 1, borderRadius: 3, textAlign: 'center' }}>
        <CardContent>
            <Box color={color || 'text.primary'}>{icon}</Box>
            <Typography variant="h5" fontWeight={800} mt={1}>{value}</Typography>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
        </CardContent>
    </Card>
);

const UpdateInfo = ({ user, date, fmt }) => {
    if (!user) return <Typography variant="body2" color="text.secondary">—</Typography>;
    return (
        <Stack>
            <Typography variant="body2" sx={{ lineHeight: 1.2, fontWeight: 500 }}>{user}</Typography>
            <Typography variant="caption" color="text.secondary">{fmt.dateTR(date)}</Typography>
        </Stack>
    );
};

// Her bir durak panelinin içindeki Yükleme veya Teslimat bölümü
const StopActionSection = ({ type, stop, fmt }) => {
    const isYukleme = type === 'Yükleme';
    const nokta = isYukleme ? stop.yukleme_noktasi : stop.teslim_noktasi;
    if (!nokta && !(isYukleme ? stop.yukleme_varis : stop.teslim_varis)) {
        return <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 150, color: 'text.disabled' }}><Typography><i>{type} bilgisi yok</i></Typography></Box>;
    }

    const il = isYukleme ? stop.yukleme_ili : stop.teslim_ili;
    const ilce = isYukleme ? stop.yukleme_ilcesi : stop.teslim_ilcesi;
    const varis = isYukleme ? stop.yukleme_varis : stop.teslim_varis;
    const cikis = isYukleme ? stop.yukleme_cikis : stop.teslim_cikis;
    const bekleme_dk = isYukleme ? stop.yukleme_bekleme_dk : stop.teslim_bekleme_dk;

    const varis_guncelleyen = isYukleme ? stop.yukleme_varis_guncelleyen : stop.teslim_varis_guncelleyen;
    const varis_guncelleme_tarihi = isYukleme ? stop.yukleme_varis_guncelleme_tarihi : stop.teslim_varis_guncelleme_tarihi;
    const cikis_guncelleyen = isYukleme ? stop.yukleme_cikis_guncelleyen : stop.teslim_cikis_guncelleyen;
    const cikis_guncelleme_tarihi = isYukleme ? stop.yukleme_cikis_guncelleme_tarihi : stop.teslim_cikis_guncelleme_tarihi;

    return (
        <Stack spacing={2} p={2}>
            <Chip
                icon={isYukleme ? <FileUploadIcon /> : <FileDownloadIcon />}
                label={type}
                color={isYukleme ? 'primary' : 'secondary'}
                sx={{ fontWeight: 600, alignSelf: 'flex-start' }}
            />
            <Typography variant="h6" fontWeight={700}>{nokta || "Nokta Adı Belirtilmemiş"}</Typography>
            <InfoLine icon={<LocationOnIcon fontSize="small" />} label="Lokasyon" value={[il, ilce].filter(Boolean).join(" / ")} />
            <InfoLine icon={<AccessTimeIcon fontSize="small" />} label="Varış -> Çıkış" value={`${fmt.dateTR(varis)} -> ${fmt.dateTR(cikis)}`} />
            <Box>
                <Typography variant="caption" color="text.secondary">BEKLEME SÜRESİ</Typography>
                <Typography variant="h5" fontWeight={700} color={bekleme_dk >= 240 ? 'error.main' : 'text.primary'}>{fmtMinutes(bekleme_dk)}</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
                    <EditIcon fontSize="small" />
                    <Typography variant="caption" fontWeight={600}>GÜNCELLEME KAYITLARI</Typography>
                </Stack>
                <Grid container spacing={2} pl={3.5}>
                    <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Varış</Typography>
                        <UpdateInfo user={varis_guncelleyen} date={varis_guncelleme_tarihi} fmt={fmt} />
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Çıkış</Typography>
                        <UpdateInfo user={cikis_guncelleyen} date={cikis_guncelleme_tarihi} fmt={fmt} />
                    </Grid>
                </Grid>
            </Stack>
        </Stack>
    )
}

// Zaman çizelgesindeki seyahat bölümünü gösterir
const TravelSegment = ({ durationMinutes, fmt }) => (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ my: 1, pl: '4px' }}>
        <ArrowDownwardIcon sx={{ color: 'text.secondary' }} />
        <Chip
            icon={<MoreTimeIcon />}
            label={`Seyahat: ${fmtMinutes(durationMinutes)}`}
            variant="outlined"
            size="small"
        />
    </Stack>
);

// ===================== ANA MODAL BİLEŞENİ =====================

export const TripDetailModal = ({ trip, stopRows, open, onClose, fmt }) => {

    const processedStops = useMemo(() => {
        if (!stopRows) return [];
        return stopRows.map((stop, index) => {
            const nextStop = stopRows[index + 1];
            if (!nextStop) return stop;

            const departureTime = stop.teslim_cikis || stop.yukleme_cikis;
            const arrivalTime = nextStop.yukleme_varis || nextStop.teslim_varis;

            if (!departureTime || !arrivalTime) return stop;

            const travelTimeToNext_dk = dayjs(arrivalTime).diff(dayjs(departureTime), 'minute');

            return { ...stop, travelTimeToNext_dk };
        });
    }, [stopRows]);

    const summary = useMemo(() => {
        if (!processedStops) return { totalStops: 0, totalWaitMinutes: 0 };
        const totalStops = processedStops.length;
        const totalWaitMinutes = processedStops.reduce((acc, stop) => acc + (stop.yukleme_bekleme_dk || 0) + (stop.teslim_bekleme_dk || 0), 0);
        return { totalStops, totalWaitMinutes };
    }, [processedStops]);

    if (!trip) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 4, height: '90vh' } }}>
            <DialogTitle sx={{ fontWeight: 800, p: 2, m: 0 }}>
                Sefer Detayı: {trip.sefer_no}
                <IconButton aria-label="close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8, color: (t) => t.palette.grey[500] }}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: { xs: 1.5, md: 3 } }}>
                <Stack spacing={3}>
                    {/* ÖZET PANELİ */}
                    <Card variant="outlined" sx={{ borderRadius: 3, p: 1, animation: `${fadeIn} 0.3s ease-out` }}>
                        <CardContent>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={5}><Stack spacing={2}><InfoLine icon={<LocalShippingIcon />} label="Plaka / Treyler" value={`${trip.plaka} / ${trip.treyler || '—'}`} direction="row" /><InfoLine icon={<PersonIcon />} label="Sürücü" value={`${trip.surucu_ad_soyad}`} direction="row" /><InfoLine icon={<RouteIcon />} label="Proje" value={trip.proje_adi} direction="row" /></Stack></Grid>
                                <Grid item xs={12} md={7}><Stack direction="row" spacing={2} height="100%"><StatCard icon={<FmdGoodIcon fontSize="large" />} label="Toplam Durak" value={summary.totalStops} /><StatCard icon={<AccessTimeIcon fontSize="large" />} label="Toplam Bekleme" value={fmtMinutes(summary.totalWaitMinutes)} color="warning.main" /></Stack></Grid>
                            </Grid>
                        </CardContent>
                    </Card>

                    {/* ZAMAN ÇİZELGESİ */}
                    <Typography variant="h6" gutterBottom fontWeight={700} sx={{ pt: 1 }}>Sefer Akışı</Typography>
                    <Box>
                        {processedStops && processedStops.length > 0 ? (
                            <Box>
                                {processedStops.map((stop, index) => (
                                    <Box key={stop.id} sx={{ animation: `${fadeIn} 0.5s ease-out ${index * 0.2}s both` }}>
                                        <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                            <Grid container>
                                                <Grid item xs={12} md={6}><StopActionSection type="Yükleme" stop={stop} fmt={fmt} /></Grid>
                                                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
                                                <Grid item xs={12} sx={{ display: { xs: 'block', md: 'none' } }}><Divider /></Grid>
                                                <Grid item xs={12} md={6}><StopActionSection type="Teslim" stop={stop} fmt={fmt} /></Grid>
                                            </Grid>
                                        </Card>
                                        {stop.travelTimeToNext_dk > 0 && (
                                            <TravelSegment durationMinutes={stop.travelTimeToNext_dk} fmt={fmt} />
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        ) : (
                            <Typography sx={{ mt: 2 }} color="text.secondary">Bu sefere ait durak bilgisi bulunamadı.</Typography>
                        )}
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} variant="outlined">Kapat</Button>
            </DialogActions>
        </Dialog>
    );
};
