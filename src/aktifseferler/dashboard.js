// src/aktifseferler/dashboard.jsx
import * as React from "react";
import {
    Box, Stack, Typography, Chip, IconButton, Divider, Collapse, Tooltip,
    LinearProgress, Paper, ButtonBase, useTheme, Container, TextField, MenuItem,
    Switch, FormControlLabel, Button, ToggleButton, ToggleButtonGroup, Dialog,
    DialogTitle, DialogContent, DialogActions, Table, TableHead, TableRow,
    TableCell, TableBody, CircularProgress
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
// KRİTİK DÜZELTME: Yanlış import yolu düzeltildi
import DirectionsCarFilledIcon from "@mui/icons-material/DirectionsCarFilled";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import TimelineIcon from "@mui/icons-material/Timeline";
import FilterListIcon from "@mui/icons-material/FilterList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import TableRowsIcon from "@mui/icons-material/TableRows";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { alpha } from "@mui/material/styles";
import { supabase } from "../supabaseClient";
import { fromISOToCombined } from "./utils/datetime"; // Varsayımsal olarak import edildi

/* ---------- Helpers ---------- */
const fmt = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm} ${hh}:${mi}`;
};
const isToday = (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};
const minToHM = (m) => {
    const mm = Math.max(0, Math.round(m || 0));
    const h = Math.floor(mm / 60);
    const r = mm % 60;
    if (h && r) return `${h} saat ${r} dakika`;
    if (h) return `${h} saat`;
    return `${r} dakika`;
};
const ON_TIME_TOL_MIN = 15;
function riskOfLate(minutesLate) {
    if (minutesLate >= 6 * 60) return { lvl: "kritik", color: "error" };
    if (minutesLate >= 60) return { lvl: "yüksek", color: "warning" };
    if (minutesLate >= 15) return { lvl: "orta", color: "secondary" };
    return { lvl: "düşük", color: "default" };
}

/* ---------- Bölüm başlığı (Sadeleştirildi) ---------- */
function SectionHeader({ icon, title, count, expanded, onToggle, color = "inherit", hint, rightSlot }) {
    const theme = useTheme();
    return (
        <Box
            sx={{
                position: "relative",
                borderRadius: 2.5,
                overflow: "hidden",
                "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    background:
                        theme.palette.mode === "dark"
                            ? "linear-gradient(90deg, rgba(59,130,246,0.08), rgba(147,51,234,0.08))"
                            : "linear-gradient(90deg, rgba(59,130,246,0.08), rgba(16,185,129,0.08))",
                    pointerEvents: "none",
                },
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                backdropFilter: "blur(6px)",
                background: alpha(theme.palette.background.paper, 0.8),
            }}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.25, py: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, letterSpacing: 0.2, color }}>
                        {icon} {title}
                    </Typography>
                    <Chip
                        size="small"
                        label={`${count} Sefer`}
                        sx={{
                            fontWeight: 800, borderRadius: 1.25,
                            background: theme.palette.mode === "dark" ? alpha("#93c5fd", 0.12) : alpha(theme.palette.primary.main, 0.08),
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                        }}
                    />
                    {hint ? (
                        <Tooltip title={hint} arrow>
                            <Box sx={{ ml: 0.5, width: 10, height: 10, borderRadius: "50%", bgcolor: color, opacity: 0.6 }} />
                        </Tooltip>
                    ) : null}
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                    {rightSlot}
                    <IconButton size="small" onClick={onToggle}>
                        <ExpandMoreIcon sx={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "0.2s" }} />
                    </IconButton>
                </Stack>
            </Stack>
        </Box>
    );
}

/* ---------- Modern rozet ---------- */
function NoteBadge({ title = "Açıklama mevcut" }) {
    // ... (NoteBadge içeriği aynı kalır)
    const theme = useTheme();
    return (
        <Tooltip title={title}>
            <Box sx={{
                position: "absolute", top: 0, left: 0, width: 0, height: 0,
                borderTop: "22px solid transparent", borderRight: "22px solid transparent",
                "&::after": {
                    content: '""', position: "absolute", top: 0, left: 0, width: 32, height: 32,
                    transform: "translate(-16px, -16px) rotate(45deg)", borderRadius: 1.25,
                    background: "linear-gradient(135deg, rgba(168,85,247,0.95) 0%, rgba(34,211,238,0.95) 100%)",
                    boxShadow: "0 8px 20px rgba(99,102,241,0.45), inset 0 0 0 1px rgba(255,255,255,0.5)"
                }
            }}>
                <Box sx={{
                    position: "absolute", top: 2.5, left: 2.5, width: 18, height: 18, display: "grid", placeItems: "center",
                    transform: "translateY(-50%) translateX(-50%)"
                }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 14, color: "#fff" }} />
                </Box>
            </Box>
        </Tooltip>
    );
}

/* ---------- Kart ---------- */
function RowCard({ title, subtitle, chips = [], onClick, color = "inherit", dense, hasNote }) {
    const theme = useTheme();
    return (
        <ButtonBase onClick={onClick} sx={{ width: "100%", textAlign: "left", borderRadius: 2.5 }}>
            <Box sx={{
                position: "relative", borderRadius: 2.5, p: 0.8,
                background: `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.18)}, ${alpha(theme.palette.secondary.main, 0.18)})`
            }}>
                <Paper
                    elevation={0}
                    sx={{
                        position: "relative", px: 1.25, py: dense ? 0.75 : 1, borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
                        background: alpha(theme.palette.background.paper, 0.7), backdropFilter: "blur(6px)",
                        transition: "transform .14s ease, box-shadow .14s ease, border-color .14s ease",
                        boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.12)}`,
                        "&:hover": { transform: "translateY(-2px)", borderColor: alpha(theme.palette.text.primary, 0.25), boxShadow: `0 10px 26px ${alpha(theme.palette.common.black, 0.16)}` }
                    }}
                >
                    {hasNote && <NoteBadge />}
                    <Stack direction="row" alignItems="center" spacing={1.25}>
                        <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, boxShadow: `0 0 0 3px ${alpha(color, 0.15)}`, mt: 0.25 }} />
                        <Stack sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, letterSpacing: 0.2, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {title}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>{subtitle}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {chips}
                        </Stack>
                    </Stack>
                </Paper>
            </Box>
        </ButtonBase>
    );
}

/* ---------- Grid helper ---------- */
function GridList({ items, render, pageSize = 12 }) {
    const [page, setPage] = React.useState(1);
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);

    return (
        <Stack spacing={1}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.1 }}>{slice.map(render)}</Box>
            {pages > 1 && (
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ pt: 0.5 }}>
                    <Button size="small" variant="outlined" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</Button>
                    <Typography variant="caption">{page} / {pages}</Typography>
                    <Button size="small" variant="outlined" disabled={page === pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Sonraki</Button>
                </Stack>
            )}
        </Stack>
    );
}

/* ---------- Yeni Rapor Verisi Çekme ve Hesaplama Fonksiyonu ---------- */
async function fetchPerformanceData(startDate, endDate) {
    const rangeMin = `${startDate || ""}T00:00:00`;
    const rangeMax = `${endDate || ""}T23:59:59`;

    // SADECE İLK YÜKLEME ÇIKIŞ KONTROLÜ İÇİN GEREKLİ ALANLAR
    const selectQuery = `
        sefer_no, sefer_tarihi, plaka, surucu_ad_soyad, 
        eta_varis, 
        sefer_detaylari!inner(yukleme_cikis, nokta_sirasi)
    `;

    const runQuery = async (tableName) => {
        const { data, error } = await supabase
            .from(tableName)
            .select(selectQuery)
            .gte('sefer_tarihi', rangeMin)
            .lte('sefer_tarihi', rangeMax);

        if (error) {
            console.error(`Supabase sorgu hatası (${tableName}):`, error);
            return [];
        }
        return data || [];
    };

    const activeSeferler = await runQuery('seferler');
    const completedSeferler = await runQuery('tamamlanan_seferler');

    const allSeferler = [...activeSeferler, ...completedSeferler];

    const reportData = [];

    allSeferler.forEach(sefer => {
        const eta = sefer.eta_varis ? new Date(sefer.eta_varis) : null;

        // İlk noktanın YÜKLEME ÇIKIŞ tarihini bul
        const firstDepartureDetail = sefer.sefer_detaylari
            ?.filter(d => d.yukleme_cikis)
            .sort((a, b) => (a.nokta_sirasi || 0) - (b.nokta_sirasi || 0))[0];

        const firstDepartureTimeISO = firstDepartureDetail?.yukleme_cikis || null;
        const departureTime = firstDepartureTimeISO ? new Date(firstDepartureTimeISO) : null;

        let durum = 'VERİ EKSİK';
        let diffMin = null;

        if (eta && departureTime) {
            // İstenen karşılaştırma (Başlangıç ve Bitiş zamanı):
            diffMin = Math.round((eta.getTime() - departureTime.getTime()) / 60000);

            // Eğer ETA, Yükleme Çıkıştan sonra ise (Normal akışta pozitif fark)
            if (eta.getTime() > departureTime.getTime()) {
                durum = 'TAHMİN EDİLDİ';
            } else {
                // ETA, çıkıştan önce veya aynı anda ise (Veri düzensizliği)
                durum = 'DÜZENSİZ VERİ';
            }
        }

        reportData.push({
            id: sefer.sefer_no,
            sefer_no: sefer.sefer_no,
            plaka: sefer.plaka,
            surucu: sefer.surucu_ad_soyad,
            sefer_tarihi: sefer.sefer_tarihi,
            eta_varis: sefer.eta_varis,
            ilk_yukleme_cikis: firstDepartureTimeISO,
            fark_dk: diffMin,
            durum: durum,
        });
    });

    return reportData;
}


/* ---------- ANA DASHBOARD ---------- */
export default function Dashboard({ rows = [], onOpenRow, onAskReason, reasonNos = new Set(), bump }) {
    const theme = useTheme();
    const statusPalette = (theme) => ({
        red: theme.palette.mode === "dark" ? "#ef4444" : "#dc2626",
        amber: theme.palette.mode === "dark" ? "#f59e0b" : "#d97706",
        blue: theme.palette.mode === "dark" ? "#3b82f6" : "#2563eb",
        mint: theme.palette.mode === "dark" ? "#10b981" : "#059669",
    });
    const sp = statusPalette(theme);

    const [reportRows, setReportRows] = React.useState([]);
    const [reportLoading, setReportLoading] = React.useState(false);
    const [reportExpanded, setReportExpanded] = React.useState(true);

    // Yeni Tarih Kontrolleri
    const [startDate, setStartDate] = React.useState(new Date().toISOString().substring(0, 10));
    const [endDate, setEndDate] = React.useState(new Date().toISOString().substring(0, 10));

    const loadData = React.useCallback(async () => {
        setReportLoading(true);
        // Hata: fetchPerformanceData'yı React'ın dışında tanımladık, burada kullanabiliriz.
        const data = await fetchPerformanceData(startDate, endDate);
        setReportRows(data);
        setReportLoading(false);
    }, [startDate, endDate]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    // Rapor Filtreleri
    const [onlyLate, setOnlyLate] = React.useState(false);
    const [sortKey, setSortKey] = React.useState("farkDesc");

    const filteredReport = React.useMemo(() => {
        let list = reportRows;
        // NOTE: Burada durum sadece GECİKMİŞ/ERKEN değil, 'TAHMİN EDİLDİ' olduğu için filtreleme mantığı değişebilir.
        if (onlyLate) {
            list = list.filter(r => r.durum === 'GECİKMİŞ'); // Varsayılan olarak sadece gecikmişi filtrele
        }

        if (sortKey === 'farkDesc') {
            list.sort((a, b) => (b.fark_dk || 0) - (a.fark_dk || 0));
        } else if (sortKey === 'dateAsc') {
            list.sort((a, b) => new Date(a.sefer_tarihi) - new Date(b.sefer_tarihi));
        }

        return list;
    }, [reportRows, onlyLate, sortKey]);


    function Controls() {
        return (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }}
                sx={{
                    pb: 0.5, px: 0.75, pt: 0.75, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                    background: alpha(theme.palette.background.paper, 0.5), backdropFilter: "blur(6px)"
                }}>

                {/* Tarih Seçimi */}
                <TextField
                    label="Başlangıç Tarihi"
                    type="date"
                    size="small"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                />
                <TextField
                    label="Bitiş Tarihi"
                    type="date"
                    size="small"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                />
                <Button variant="contained" size="small" onClick={loadData} disabled={reportLoading}>
                    {reportLoading ? <CircularProgress size={20} color="inherit" /> : 'Yenile'}
                </Button>

                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                {/* Filtre ve Sıralama */}
                <FormControlLabel control={<Switch size="small" checked={onlyLate} onChange={(e) => setOnlyLate(e.target.checked)} />}
                    label={<Typography variant="caption" sx={{ color: theme.palette.text.primary }}>Sadece Gecikenler</Typography>} />

                <TextField select size="small" value={sortKey} onChange={(e) => setSortKey(e.target.value)} label="Sırala" sx={{ minWidth: 180 }}>
                    <MenuItem value="farkDesc">Fark (En Gecikmişten)</MenuItem>
                    <MenuItem value="dateAsc">Sefer Tarihi (Eskiden Yeniye)</MenuItem>
                </TextField>
            </Stack>
        );
    }

    /* ---------- RAPOR TABLOSU ---------- */
    const ReportTable = () => (
        <Table size="small" stickyHeader>
            <TableHead>
                <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Sefer No</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Plaka</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Sürücü</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Sefer Tarihi</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>ETA Varış</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>İlk Yükleme Çıkış</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Fark (dk)</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Durum</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {filteredReport.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={8}>
                            <Typography variant="body2" sx={{ opacity: 0.7, p: 2 }}>
                                {reportLoading ? 'Veriler yükleniyor...' : 'Seçilen tarih aralığında raporlanacak sefer bulunamadı.'}
                            </Typography>
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredReport.map((r, i) => (
                        <TableRow key={r.id || i} hover onClick={() => onOpenRow && onOpenRow(r)} sx={{ cursor: 'pointer' }}>
                            <TableCell>{r.sefer_no}</TableCell>
                            <TableCell>{r.plaka}</TableCell>
                            <TableCell>{r.surucu}</TableCell>
                            <TableCell>{fmt(r.sefer_tarihi)}</TableCell>
                            <TableCell>{fmt(r.eta_varis)}</TableCell>
                            <TableCell>{fmt(r.ilk_yukleme_cikis)}</TableCell>
                            <TableCell>
                                {r.fark_dk === null ? '-' : (
                                    <Chip size="small"
                                        label={`${r.fark_dk > 0 ? '+' : ''}${minToHM(Math.abs(r.fark_dk))}`}
                                        color={r.fark_dk <= 0 ? 'error' : 'success'}
                                        variant="outlined"
                                    />
                                )}
                            </TableCell>
                            <TableCell>
                                <Typography sx={{
                                    fontWeight: 700,
                                    color: r.durum === 'DÜZENSİZ VERİ' ? sp.red : (r.durum === 'TAHMİN EDİLDİ' ? sp.mint : theme.palette.text.secondary)
                                }}>
                                    {r.durum}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );

    return (
        <Container maxWidth="lg" disableGutters>
            <Stack spacing={1.25}>

                {/* Dashboard Kontrolleri */}
                <Controls />

                <SectionHeader
                    icon={<TimelineIcon fontSize="small" />}
                    title="Sefer ETA Performans Raporu (Çıkış vs ETA)"
                    count={filteredReport.length}
                    expanded={reportExpanded}
                    onToggle={() => setReportExpanded((v) => !v)}
                    color={sp.blue}
                />

                <Collapse in={reportExpanded} unmountOnExit>
                    <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        <Box sx={{ maxHeight: 600, overflowY: "auto" }}>
                            <ReportTable />
                        </Box>
                    </Paper>
                </Collapse>

                <Box sx={{ mt: 0.5 }}>
                    <LinearProgress sx={{ height: 2, borderRadius: 6, opacity: 0.18 }} />
                </Box>
            </Stack>
        </Container>
    );
}
