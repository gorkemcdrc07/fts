// =============================================================
// MODERN DASHBOARD - FULL VERSION (TESLİM VARIŞ ZORUNLU)
// DataGrid + Supabase + Mesafe Popup + Excel Export
// =============================================================

import * as React from "react";
import {
    Box,
    Stack,
    Typography,
    Chip,
    Paper,
    Container,
    TextField,
    MenuItem,
    Switch,
    FormControlLabel,
    Button,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import TimelineIcon from "@mui/icons-material/Timeline";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabase } from "../supabaseClient";


// =============================================================
// DARK THEME COLORS
// =============================================================
const DARK_COLORS = {
    pageBg: "#0E0E0E",
    surface: "#1B1B1B",
    surface2: "#232323",
    border: "#3A3A3A",
    text: "#F1F1F1",
    textMuted: "#8E8E8E",
    primary: "#BB86FC",
    neonGreen: "#03DAC6",
    neonRed: "#CF6679",
    zebra: "#272727"
};


// =============================================================
// HELPERS
// =============================================================
const fmt = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return `${String(d.getDate()).padStart(2, "0")}.${String(
        d.getMonth() + 1
    ).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(
        2,
        "0"
    )}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const minToHM = (m) => {
    const mm = Math.max(0, Math.round(m || 0));
    const h = Math.floor(mm / 60);
    const r = mm % 60;
    if (h && r) return `${h} saat ${r} dakika`;
    if (h) return `${h} saat`;
    return `${r} dakika`;
};

const getTodayDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
};

function calcETAFromDistance({ distanceKm, startIso, avgKmh = 65 }) {
    if (!distanceKm || !startIso) return null;
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) return null;

    const driveHours = distanceKm / avgKmh;
    const driveMs = driveHours * 60 * 60 * 1000;
    const blocks = Math.floor(driveHours / 4.5);
    const breakMs = blocks * 45 * 60 * 1000;
    return new Date(start.getTime() + driveMs + breakMs);
}


// =============================================================
// FETCH PERFORMANCE DATA (TESLİM VARIŞ OLMAYANLARI ATAR)
// =============================================================
async function fetchPerformanceData(start, end) {
    const rangeMin = `${start}T00:00:00`;
    const rangeMax = `${end}T23:59:59`;

    const selectQuery = `
        id,sefer_no,sefer_tarihi,plaka,surucu_ad_soyad,eta_varis,eta_note,
        sefer_detaylari(
            teslim_varis,yukleme_cikis,nokta_sirasi,
            yukleme_ili,yukleme_ilcesi,
            teslim_ili,teslim_ilcesi,
            yukleme_noktasi,teslim_noktasi
        )
    `;

    const { data, error } = await supabase
        .from("seferler")
        .select(selectQuery)
        .gte("sefer_tarihi", rangeMin)
        .lte("sefer_tarihi", rangeMax);

    if (error) console.error("Supabase Error:", error);

    const result = [];

    (data || []).forEach((s) => {
        const ordered = (s.sefer_detaylari || []).sort(
            (a, b) => (a.nokta_sirasi || 0) - (b.nokta_sirasi || 0)
        )[0];

        // ❗ TESLİM VARIŞ YOK → LİSTEYE EKLEME
        const teslimISO = ordered?.teslim_varis || null;
        if (!teslimISO) return;

        const yuklemeISO = ordered?.yukleme_cikis || null;
        const teslim = new Date(teslimISO);
        const eta = s.eta_varis ? new Date(s.eta_varis) : null;

        let durum = "KULLANICI GİRİŞİ BEKLENİYOR";
        let fark_signed = null;
        let fark = null;

        if (teslim && eta) {
            fark_signed = Math.round((teslim - eta) / 60000);
            fark = Math.abs(fark_signed);

            durum =
                fark_signed > 5
                    ? "GECİKMİŞ"
                    : fark_signed < -5
                        ? "ERKEN"
                        : "ZAMANINDA";
        } else if (s.eta_note) {
            durum = "VERİ EKSİK";
        }

        let eta_display = s.eta_varis ? fmt(s.eta_varis) : s.eta_note || "-";
        if ((s.eta_note || "").toLowerCase().includes("mesafe"))
            eta_display = "Mesafe bulunamadı";

        result.push({
            id: s.id,
            sefer_no: s.sefer_no,
            plaka: s.plaka,
            tarih: fmt(s.sefer_tarihi),
            yukleme: ordered?.yukleme_noktasi || "-",
            teslim: ordered?.teslim_noktasi || "-",
            yukleme_cikis: fmt(yuklemeISO),
            eta: eta_display,
            teslim_varis: fmt(teslimISO),
            fark:
                fark !== null
                    ? `${fark_signed > 0 ? "Gecikti" : "Erken"} ${minToHM(fark)}`
                    : "-",
            durum,
            raw: s
        });
    });

    return result;
}


// =============================================================
// MESAFE DİYALOĞU
// =============================================================
function DistanceInputDialog({ open, onClose, seferData, onSaved }) {
    const [distance, setDistance] = React.useState("");
    const [status, setStatus] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [canInput, setCanInput] = React.useState(false);

    const det = seferData?.raw?.sefer_detaylari?.[0] || {};

    React.useEffect(() => {
        if (open && seferData) {
            lookup();
        }
    }, [open]);

    const lookup = async () => {
        setLoading(true);
        setStatus("Mesafe sorgulanıyor...");

        const { data } = await supabase
            .from("mesafeler")
            .select("mesafe")
            .eq("yukleme_il", det.yukleme_ili)
            .eq("yukleme_ilce", det.yukleme_ilcesi)
            .eq("teslim_il", det.teslim_ili)
            .eq("teslim_ilce", det.teslim_ilcesi)
            .maybeSingle();

        setLoading(false);

        if (data?.mesafe) {
            setDistance(String(data.mesafe));
            setCanInput(true);
            setStatus(`Mesafe bulundu: ${data.mesafe} km`);
        } else {
            setCanInput(true);
            setStatus("Mesafe yok, manuel girin");
        }
    };

    const save = async () => {
        if (!distance || isNaN(Number(distance))) return alert("Geçerli mesafe girin");

        setLoading(true);

        await supabase.from("mesafeler").upsert({
            yukleme_il: det.yukleme_ili,
            yukleme_ilce: det.yukleme_ilcesi,
            teslim_il: det.teslim_ili,
            teslim_ilce: det.teslim_ilcesi,
            mesafe: Number(distance)
        });

        const eta = calcETAFromDistance({
            distanceKm: Number(distance),
            startIso: seferData.raw.sefer_tarihi
        });

        if (eta) {
            await supabase
                .from("seferler")
                .update({ eta_varis: eta.toISOString(), eta_note: null })
                .eq("id", seferData.id);
        }

        setLoading(false);
        onSaved?.();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                Mesafe Girişi – Sefer #{seferData?.sefer_no}
            </DialogTitle>

            <DialogContent>
                <Typography>Kalkış: {det.yukleme_ili} / {det.yukleme_ilcesi}</Typography>
                <Typography>Varış: {det.teslim_ili} / {det.teslim_ilcesi}</Typography>

                <Box mt={2}>
                    {loading ? <CircularProgress size={24} /> : status}
                </Box>

                {canInput && (
                    <TextField
                        fullWidth
                        type="number"
                        label="Mesafe (km)"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        sx={{ mt: 2 }}
                    />
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Kapat</Button>
                {canInput && (
                    <Button variant="contained" onClick={save} disabled={loading}>
                        Kaydet
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}


// =============================================================
// MAIN DASHBOARD COMPONENT
// =============================================================
export default function Dashboard() {
    const [rows, setRows] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    const [start, setStart] = React.useState(getTodayDateString());
    const [end, setEnd] = React.useState(getTodayDateString());

    const [onlyLate, setOnlyLate] = React.useState(false);
    const [sortKey, setSortKey] = React.useState("farkDesc");

    const [distanceModal, setDistanceModal] = React.useState(false);
    const [selected, setSelected] = React.useState(null);

    const loadData = async () => {
        setLoading(true);
        const r = await fetchPerformanceData(start, end);
        setRows(r);
        setLoading(false);
    };

    React.useEffect(() => {
        loadData();
    }, []);

    const filtered = rows
        .filter((r) => {
            if (!onlyLate) return true;
            return r.durum === "GECİKMİŞ";
        })
        .sort((a, b) => {
            if (sortKey === "farkDesc") {
                const av = a.fark.includes("Gecikti") ? parseInt(a.fark) : -9999;
                const bv = b.fark.includes("Gecikti") ? parseInt(b.fark) : -9999;
                return bv - av;
            }
            return new Date(a.raw?.sefer_tarihi) - new Date(b.raw?.sefer_tarihi);
        });

    const columns = [
        { field: "sefer_no", headerName: "Sefer No", flex: 1 },
        { field: "plaka", headerName: "Plaka", flex: 1 },
        { field: "tarih", headerName: "Tarih", flex: 1 },
        { field: "yukleme", headerName: "Yükleme", flex: 1 },
        { field: "teslim", headerName: "Teslim", flex: 1 },
        { field: "yukleme_cikis", headerName: "Yükleme Çıkış", flex: 1 },
        {
            field: "eta",
            headerName: "ETA",
            flex: 1,
            renderCell: (p) => (
                <Typography
                    sx={{
                        cursor: p.value === "Mesafe bulunamadı" ? "pointer" : "default",
                        color:
                            p.value === "Mesafe bulunamadı"
                                ? DARK_COLORS.neonRed
                                : DARK_COLORS.text
                    }}
                    onClick={() => {
                        if (p.value === "Mesafe bulunamadı") {
                            setSelected(p.row);
                            setDistanceModal(true);
                        }
                    }}
                >
                    {p.value}
                </Typography>
            )
        },
        { field: "teslim_varis", headerName: "Teslim Varış", flex: 1 },
        { field: "fark", headerName: "Fark", flex: 1 },
        {
            field: "durum",
            headerName: "Durum",
            flex: 1,
            renderCell: (p) => (
                <Chip
                    label={p.value}
                    color={
                        p.value === "GECİKMİŞ"
                            ? "error"
                            : p.value === "ERKEN"
                                ? "success"
                                : "default"
                    }
                />
            )
        }
    ];

    const exportExcel = async () => {
        const book = new ExcelJS.Workbook();
        const sheet = book.addWorksheet("ETA");

        sheet.columns = columns.map((c) => ({
            header: c.headerName,
            key: c.field,
            width: 25
        }));

        sheet.addRows(filtered);

        const buffer = await book.xlsx.writeBuffer();
        saveAs(
            new Blob([buffer]),
            `eta_rapor_${start}_${end}.xlsx`
        );
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4, color: DARK_COLORS.text }}>
            {/* HEADER */}
            <Paper
                sx={{
                    p: 3,
                    mb: 3,
                    borderRadius: 3,
                    bgcolor: DARK_COLORS.surface
                }}
            >
                <Stack direction="row" spacing={2} alignItems="center">
                    <TimelineIcon sx={{ fontSize: 34, color: DARK_COLORS.primary }} />
                    <Typography variant="h5" fontWeight={700}>
                        ETA Performans Paneli (Modern)
                    </Typography>
                </Stack>
            </Paper>

            {/* FILTERS */}
            <Paper
                sx={{
                    p: 3,
                    mb: 3,
                    borderRadius: 3,
                    bgcolor: DARK_COLORS.surface
                }}
            >
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                        type="date"
                        label="Başlangıç"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        type="date"
                        label="Bitiş"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />

                    <Button
                        variant="contained"
                        onClick={loadData}
                        sx={{ bgcolor: DARK_COLORS.primary, px: 3 }}
                    >
                        Yenile
                    </Button>

                    <Button variant="outlined" onClick={exportExcel}>
                        Excel'e Aktar
                    </Button>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={onlyLate}
                                onChange={(e) => setOnlyLate(e.target.checked)}
                            />
                        }
                        label="Sadece Gecikmeli"
                    />

                    <TextField
                        select
                        label="Sırala"
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value)}
                    >
                        <MenuItem value="farkDesc">Gecikme (Büyükten)</MenuItem>
                        <MenuItem value="dateAsc">Tarih (Eskiden)</MenuItem>
                    </TextField>
                </Stack>
            </Paper>

            {/* DATAGRID TABLE */}
            <Paper
                sx={{
                    height: 650,
                    borderRadius: 3,
                    bgcolor: DARK_COLORS.surface
                }}
            >
                {loading ? (
                    <Box
                        height="100%"
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                    >
                        <CircularProgress size={40} />
                    </Box>
                ) : (
                    <DataGrid
                        rows={filtered}
                        columns={columns}
                        disableRowSelectionOnClick
                        sx={{
                            color: DARK_COLORS.text,
                            border: "none",
                            "& .MuiDataGrid-columnHeaders": {
                                bgcolor: DARK_COLORS.surface2,
                                fontWeight: 700
                            },
                            "& .MuiDataGrid-row:nth-of-type(odd)": {
                                bgcolor: DARK_COLORS.zebra
                            }
                        }}
                    />
                )}
            </Paper>

            {/* MESAFE POPUP */}
            <DistanceInputDialog
                open={distanceModal}
                onClose={() => setDistanceModal(false)}
                seferData={selected}
                onSaved={() => {
                    setDistanceModal(false);
                    loadData();
                }}
            />
        </Container>
    );
}
