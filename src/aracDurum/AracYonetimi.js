import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import {
    AppBar, Toolbar, Typography, IconButton, Button, Tabs, Tab,
    Box, Grid, Paper, Chip, TextField, Drawer, Divider, Tooltip,
    Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Alert,
    Stack, InputAdornment
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    Add as AddIcon, FilterList as FilterListIcon, Download as DownloadIcon,
    Info as InfoIcon, Edit as EditIcon, Delete as DeleteIcon,
    Close as CloseIcon, Search as SearchIcon,
    ArrowBackIosNew as ArrowBackIcon, HomeOutlined as HomeIcon    // 👈 EKLENDİ
} from "@mui/icons-material";

import { DataGrid, GridToolbar } from "@mui/x-data-grid";

/* ===================== Zoom'dan Bağımsız Ekrana Sığdırma ===================== */
// tüm importlar bitti
const HOME_PATH = "/anasayfa"; // sizde hangi rota ise: "/dashboard" vb.

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;
const MAX_SCALE = Infinity; // istersen 1.25 gibi sınırlayabilirsin

function useScaleToFit(baseW = BASE_WIDTH, baseH = BASE_HEIGHT, maxScale = MAX_SCALE) {
    const [scale, setScale] = useState(1);
    useEffect(() => {
        const compute = () => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const s = Math.min(vw / baseW, vh / baseH, maxScale);
            setScale(s);
        };
        compute();
        window.addEventListener("resize", compute);

        const mq = window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`);
        const onChange = () => compute();
        mq?.addEventListener?.("change", onChange);

        return () => {
            window.removeEventListener("resize", compute);
            mq?.removeEventListener?.("change", onChange);
        };
    }, [baseW, baseH, maxScale]);
    return scale;
}

function ScaleToFit({ children }: { children: React.ReactNode }) {
    const scale = useScaleToFit();

    return (
        <Box
            sx={{
                width: "100dvw",
                height: "100dvh",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                background:
                    "radial-gradient(1200px 500px at 10% -10%, rgba(34,211,238,0.15), transparent 40%)," +
                    "radial-gradient(900px 400px at 90% 0%, rgba(139,92,246,0.20), transparent 50%)," +
                    "linear-gradient(180deg, #050816 0%, #0B1220 100%)",
            }}
        >
            <Box
                sx={{
                    width: `${BASE_WIDTH}px`,
                    height: `${BASE_HEIGHT}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    overflow: "hidden",
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
/* ============================================================================ */

const BOS_FORM = {
    plaka: "", treyler: "", surucu_adi: "", surucu_telefon: "", surucu_tc: "",
    ikamet_adresi: "", cekici_ruhsat_no: "", dorse_ruhsat_no: "", tedarikci_isim: "",
    cekici_muayene: "", dorse_muayene: "", trafik_sigorta: "", arac_yil: "",
    dorse_yil: "", bolge: "", arac_tip: "", dorse_tip: "", liftmaster: "",
    gps_seri_no: "", gps_sim_kart_no: "", odak_k1: "",
};

const getMevcutKullanici = () => localStorage.getItem("kullanici") || "Bilinmeyen Kullanıcı";

const tespitEtDegisenAlanlar = (eski, yeni) => {
    const farklar = [];
    for (const key in yeni) if (eski[key] !== yeni[key]) farklar.push(key);
    return farklar.join(", ");
};

function turkiyeSaatISOString() {
    const turkiyeSaati = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return turkiyeSaati.toISOString();
}

export default function AracYonetimiMUI() {
    const navigate = useNavigate();

    const [tumAraclar, setTumAraclar] = useState([]);
    const [tab, setTab] = useState("aktif");
    const [globalSearch, setGlobalSearch] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [form, setForm] = useState(BOS_FORM);
    const [editId, setEditId] = useState(null);
    const [duzenleAcik, setDuzenleAcik] = useState(false);

    const [silModalAcik, setSilModalAcik] = useState(false);
    const [seciliAracId, setSeciliAracId] = useState(null);
    const [silmeSebebi, setSilmeSebebi] = useState("");
    const [silinmeTarihi, setSilinmeTarihi] = useState("");

    const [bilgiModalAcik, setBilgiModalAcik] = useState(false);
    const [bilgiArac, setBilgiArac] = useState(null);
    const [izinBilgisi, setIzinBilgisi] = useState(null);
    const [kesintiBilgisi, setKesintiBilgisi] = useState(null);

    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
    const openSnack = (msg, severity = "success") => setSnack({ open: true, msg, severity });

    useEffect(() => {
        const kullanici = localStorage.getItem("kullanici");
        if (!kullanici) navigate("/login");
    }, [navigate]);

    useEffect(() => { verileriGetir(); }, []);

    const verileriGetir = async () => {
        const { data, error } = await supabase.from("plakalar").select("*");
        if (error) return openSnack("Veriler alınamadı", "error");
        if (data) {
            const bugun = new Date();
            const guncelData = data.map((arac) => {
                if (arac.kesinti_bitis_tarihi) {
                    const bitis = new Date(arac.kesinti_bitis_tarihi);
                    if (bitis < bugun) {
                        const farkGun = Math.floor((bugun - bitis) / (1000 * 60 * 60 * 24));
                        return { ...arac, statu: `${farkGun} gün kesintiden yeni çıktı` };
                    }
                }
                return arac;
            });
            setTumAraclar(guncelData);
        }
    };

    const araclar = useMemo(() => {
        let liste = [...tumAraclar];
        if (tab === "aktif") liste = liste.filter((a) => a.statu !== "ÇIKARILDI");
        if (tab === "pasif") liste = liste.filter((a) => a.statu === "ÇIKARILDI");

        if (globalSearch.trim()) {
            const q = globalSearch.toLowerCase();
            liste = liste.filter((a) =>
                [
                    a.plaka, a.treyler, a.surucu_adi, a.surucu_telefon, a.surucu_tc,
                    a.ikamet_adresi, a.cekici_ruhsat_no, a.dorse_ruhsat_no, a.tedarikci_isim,
                    a.bolge, a.arac_tip, a.dorse_tip, a.liftmaster, a.gps_seri_no,
                    a.gps_sim_kart_no, a.odak_k1, a.statu,
                ]
                    .map((v) => (v || "").toString().toLowerCase())
                    .some((v) => v.includes(q))
            );
        }
        return liste;
    }, [tumAraclar, tab, globalSearch]);

    const aktifSayisi = tumAraclar.filter((a) => a.statu !== "ÇIKARILDI").length;
    const pasifSayisi = tumAraclar.filter((a) => a.statu === "ÇIKARILDI").length;

    const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

    const handleYeniEkle = () => { setForm(BOS_FORM); setEditId(null); setDuzenleAcik(true); };
    const temizleVeKapat = () => { setForm(BOS_FORM); setEditId(null); setDuzenleAcik(false); };

    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        const kullanici = getMevcutKullanici();
        if (editId) {
            const mevcut = tumAraclar.find((a) => a.id === editId) || {};
            const guncellenenAlanlar = tespitEtDegisenAlanlar(mevcut, form);
            const guncellemeTarihi = turkiyeSaatISOString();
            const { error } = await supabase
                .from("plakalar")
                .update({
                    ...form,
                    guncelleyen_kullanici: kullanici,
                    guncellenen_alanlar: guncellenenAlanlar,
                    guncelleme_tarihi: guncellemeTarihi,
                })
                .eq("id", editId);
            if (!error) { openSnack("Araç güncellendi"); temizleVeKapat(); verileriGetir(); }
            else openSnack("Güncelleme başarısız", "error");
        } else {
            const { error } = await supabase.from("plakalar").insert([{
                ...form, statu: "Aktif", ekleyen_kullanici: kullanici, eklenen_tarih: turkiyeSaatISOString(),
            }]);
            if (!error) { openSnack("Araç eklendi"); temizleVeKapat(); verileriGetir(); }
            else openSnack("Ekleme başarısız", "error");
        }
    };

    const handleDuzenle = (arac) => {
        if (!arac?.id) return openSnack("HATA: Bu aracın ID bilgisi eksik.", "error");
        setForm({
            plaka: arac.plaka || "", treyler: arac.treyler || "", surucu_adi: arac.surucu_adi || "",
            surucu_telefon: arac.surucu_telefon || "", surucu_tc: arac.surucu_tc || "",
            ikamet_adresi: arac.ikamet_adresi || "", cekici_ruhsat_no: arac.cekici_ruhsat_no || "",
            dorse_ruhsat_no: arac.dorse_ruhsat_no || "", tedarikci_isim: arac.tedarikci_isim || "",
            cekici_muayene: arac.cekici_muayene || "", dorse_muayene: arac.dorse_muayene || "",
            trafik_sigorta: arac.trafik_sigorta || "", arac_yil: arac.arac_yil || "",
            dorse_yil: arac.dorse_yil || "", bolge: arac.bolge || "", arac_tip: arac.arac_tip || "",
            dorse_tip: arac.dorse_tip || "", liftmaster: arac.liftmaster || "",
            gps_seri_no: arac.gps_seri_no || "", gps_sim_kart_no: arac.gps_sim_kart_no || "",
            odak_k1: arac.odak_k1 || "",
        });
        setEditId(arac.id);
        setDuzenleAcik(true);
    };

    const handleSilIstegi = (id) => {
        setSeciliAracId(id);
        setSilmeSebebi("");
        setSilinmeTarihi(turkiyeSaatISOString().slice(0, 16));
        setSilModalAcik(true);
    };

    const handleSilOnayla = async () => {
        if (!silmeSebebi.trim() || !silinmeTarihi) return;
        const kullanici = getMevcutKullanici();
        const { error } = await supabase
            .from("plakalar")
            .update({
                statu: "ÇIKARILDI",
                silme_sebebi: silmeSebebi,
                silinme_tarihi: silinmeTarihi,
                silen_kullanici: kullanici,
            })
            .eq("id", seciliAracId);
        if (!error) {
            openSnack("Araç statüsü ÇIKARILDI olarak güncellendi");
            setSilModalAcik(false);
            setSeciliAracId(null);
            verileriGetir();
        } else openSnack("Silme işlemi başarısız", "error");
    };

    const handleBilgiAc = async (arac) => {
        const plakaTreyler = `${arac.plaka} - ${arac.treyler}`;
        const { data: izinData } = await supabase
            .from("izinler").select("*")
            .eq("plaka_treyler", plakaTreyler).order("id", { ascending: false }).limit(1);
        setIzinBilgisi(izinData?.[0] || null);

        const { data: kesintiData } = await supabase
            .from("kesintiler").select("*")
            .eq("plaka_treyler", plakaTreyler).order("id", { ascending: false }).limit(1);
        if (kesintiData?.[0]) {
            setKesintiBilgisi(kesintiData[0]);
            const bitis = new Date(kesintiData[0].bitis_tarihi);
            const bugun = new Date();
            if (bitis < bugun) {
                const farkGun = Math.floor((bugun - bitis) / (1000 * 60 * 60 * 24));
                arac.statu = `${farkGun} gün kesintiden çıktı`;
            }
        } else setKesintiBilgisi(null);

        setBilgiArac(arac);
        setBilgiModalAcik(true);
    };

    const excelAktar = () => {
        const liste = araclar;
        if (!liste.length) return openSnack("Aktarılacak araç bulunamadı", "warning");
        const dataToExport = liste.map(
            ({ plaka, treyler, surucu_adi, surucu_telefon, surucu_tc, statu }) => ({
                Plaka: plaka,
                Treyler: treyler,
                "Sürücü Adı": surucu_adi,
                Telefon: surucu_telefon,
                TC: surucu_tc,
                Statü: statu,
            })
        );
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Araçlar");
        const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        saveAs(blob, `arac_listesi_${tab}.xlsx`);
    };

    const columns = useMemo(() => ([
        { field: "plaka", headerName: "Plaka", minWidth: 120, flex: 0.9 },
        { field: "treyler", headerName: "Treyler", minWidth: 120, flex: 0.9 },
        { field: "surucu_adi", headerName: "Sürücü", minWidth: 150, flex: 1 },
        { field: "surucu_telefon", headerName: "Telefon", minWidth: 140, flex: 0.9 },
        { field: "surucu_tc", headerName: "TC", minWidth: 140, flex: 0.9 },
        {
            field: "ikamet_adresi", headerName: "İkamet", minWidth: 220, flex: 1.4,
            renderCell: (p) => <Typography noWrap title={p.value || ""}>{p.value}</Typography>,
            sortable: false,
        },
        { field: "cekici_ruhsat_no", headerName: "Çekici Ruhsat", minWidth: 160, flex: 1 },
        { field: "dorse_ruhsat_no", headerName: "Dorse Ruhsat", minWidth: 160, flex: 1 },
        { field: "tedarikci_isim", headerName: "Tedarikçi", minWidth: 150, flex: 1 },
        { field: "cekici_muayene", headerName: "Çekici Muayene", minWidth: 150, flex: 1 },
        { field: "dorse_muayene", headerName: "Dorse Muayene", minWidth: 150, flex: 1 },
        { field: "trafik_sigorta", headerName: "Trafik Sigorta", minWidth: 150, flex: 1 },
        { field: "arac_yil", headerName: "Araç Yıl", minWidth: 110, flex: 0.7 },
        { field: "dorse_yil", headerName: "Dorse Yıl", minWidth: 110, flex: 0.7 },
        { field: "bolge", headerName: "Bölge", minWidth: 120, flex: 0.9 },
        { field: "arac_tip", headerName: "Araç Tip", minWidth: 130, flex: 0.9 },
        { field: "dorse_tip", headerName: "Dorse Tip", minWidth: 130, flex: 0.9 },
        { field: "liftmaster", headerName: "Liftmaster", minWidth: 120, flex: 0.9 },
        { field: "gps_seri_no", headerName: "GPS Seri", minWidth: 140, flex: 0.9 },
        { field: "gps_sim_kart_no", headerName: "GPS Sim", minWidth: 140, flex: 0.9 },
        { field: "odak_k1", headerName: "Odak K1", minWidth: 120, flex: 0.9 },
        {
            field: "silme_sebebi",
            headerName: "Silme Sebebi",
            minWidth: 180,
            flex: 1,
            hide: !(tab === "pasif" || tab === "tum"),
        },
        {
            field: "statu",
            headerName: "Statü",
            minWidth: 120,
            flex: 0.9,
            renderCell: ({ value }) => (
                <Chip
                    label={value || "Aktif"}
                    size="small"
                    color={value === "ÇIKARILDI" ? "error" : "default"}
                    variant={value === "ÇIKARILDI" ? "outlined" : "filled"}
                />
            ),
        },
        {
            field: "__actions",
            headerName: "İşlem",
            sortable: false,
            filterable: false,
            minWidth: 140,
            flex: 0.9,
            align: "right",
            renderCell: ({ row }) => (
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Bilgi">
                        <IconButton size="small" onClick={() => handleBilgiAc(row)}>
                            <InfoIcon fontSize="inherit" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Düzenle">
                        <IconButton size="small" onClick={() => handleDuzenle(row)}>
                            <EditIcon fontSize="inherit" />
                        </IconButton>
                    </Tooltip>
                    {row.statu !== "ÇIKARILDI" && (
                        <Tooltip title="Sil">
                            <IconButton size="small" color="error" onClick={() => handleSilIstegi(row.id)}>
                                <DeleteIcon fontSize="inherit" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Stack>
            ),
        },
    ]), [tab]);

    const rows = useMemo(
        () => araclar.map((a, i) => ({ id: a.id ?? `${a.plaka}-${a.treyler}-${i}`, ...a })),
        [araclar]
    );

    return (
        <ScaleToFit>
            <Helmet><title>ARAÇ YÖNETİMİ</title></Helmet>

            {/* APP BAR */}
            <AppBar
                position="static"
                color="transparent"
                elevation={0}
                sx={{
                    borderRadius: 2,
                    background: "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.75) 100%)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    mx: 1,
                    mt: 1,
                }}
            >
                <Toolbar>
                    <Typography
                        variant="h6"
                        sx={{
                            flexGrow: 1,
                            fontWeight: 800,
                            background: "linear-gradient(90deg,#E879F9,#22D3EE)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            letterSpacing: 0.3,
                        }}
                    >
                        Araç Yönetimi
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        {/* 👇 EKLENEN BUTONLAR */}
                        <Button
                            size="small"
                            variant="text"
                            startIcon={<ArrowBackIcon />}
                            onClick={() => navigate(-1)}
                        >
                            Geri
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            startIcon={<HomeIcon />}
                            onClick={() => navigate(HOME_PATH)}
                        >
                            Anasayfa
                        </Button>
                        <Tooltip title="Filtreler">
                            <IconButton onClick={() => setDrawerOpen(true)}>
                                <FilterListIcon />
                            </IconButton>
                        </Tooltip>
                        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={excelAktar}>
                            Excel'e Aktar
                        </Button>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={handleYeniEkle}>
                            Yeni Araç
                        </Button>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* KPI */}
            <Grid container spacing={2} sx={{ mt: 2, px: 1 }}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, borderRadius: 2, background: `linear-gradient(180deg, ${alpha("#ffffff", 0.05)} 0%, ${alpha("#ffffff", 0.02)} 100%)`, border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Typography variant="body2" color="text.secondary">AKTİF ARAÇLAR</Typography>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                            <Typography variant="h4">{aktifSayisi}</Typography>
                            <Chip label="Aktif" size="small" />
                        </Stack>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, borderRadius: 2, background: `linear-gradient(180deg, ${alpha("#ffffff", 0.05)} 0%, ${alpha("#ffffff", 0.02)} 100%)`, border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Typography variant="body2" color="text.secondary">ÇIKARILAN ARAÇLAR</Typography>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                            <Typography variant="h4">{pasifSayisi}</Typography>
                            <Chip label="Pasif" color="error" variant="outlined" size="small" />
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>

            {/* Sekmeler + dış arama */}
            <Paper
                sx={{
                    p: 2, mt: 2, mx: 1, borderRadius: 2,
                    background: `linear-gradient(180deg, ${alpha("#ffffff", 0.04)} 0%, ${alpha("#ffffff", 0.02)} 100%)`,
                    border: "1px solid rgba(255,255,255,0.08)",
                }}
            >
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <Tabs
                            value={tab}
                            onChange={(_, v) => setTab(v)}
                            sx={{
                                "& .MuiTab-root": { fontWeight: 700, minHeight: 40, borderRadius: 2, mr: 1 },
                                "& .Mui-selected": { backgroundColor: alpha("#ffffff", 0.06) },
                                "& .MuiTabs-indicator": { height: 3, borderRadius: 1 },
                            }}
                        >
                            <Tab value="aktif" label="Aktif" />
                            <Tab value="pasif" label="Çıkarılan" />
                            <Tab value="tum" label="Tümü" />
                        </Tabs>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                            placeholder="Genel arama: araç, sürücü, bölge…"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                "& .MuiInputBase-root": {
                                    borderRadius: 2,
                                    backgroundColor: alpha("#ffffff", 0.04),
                                },
                            }}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* GRID alanı */}
            <Box sx={{ mt: 2, px: 1 }}>
                <Paper
                    sx={{
                        height: "65vh",
                        borderRadius: 3,
                        overflow: "hidden",
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pb: 1 }}>
                        <DataGrid
                            rows={rows}
                            columns={columns}
                            getRowId={(r) => r.id}
                            density="compact"
                            disableRowSelectionOnClick
                            pagination={false}
                            hideFooter
                            slots={{ toolbar: GridToolbar }}
                            slotProps={{
                                toolbar: {
                                    showQuickFilter: true,
                                    quickFilterProps: { debounceMs: 300 },
                                    printOptions: { disableToolbarButton: true },
                                },
                            }}
                            sx={{
                                border: "none",
                                height: "100%",
                                "& .MuiDataGrid-columnHeaders": {
                                    background: "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.7) 100%)",
                                    color: "#C8D1E6",
                                    borderBottomColor: "rgba(255,255,255,0.10)",
                                    fontWeight: 700,
                                },
                                "& .MuiDataGrid-row:nth-of-type(2n) .MuiDataGrid-cell": {
                                    backgroundColor: "rgba(255,255,255,0.02)",
                                },
                                "& .MuiDataGrid-cell": {
                                    borderBottomColor: "rgba(255,255,255,0.06)",
                                    whiteSpace: "nowrap",
                                },
                                "& .MuiDataGrid-row:hover .MuiDataGrid-cell": {
                                    backgroundColor: "rgba(139,92,246,0.10)",
                                },
                            }}
                        />
                    </Box>
                </Paper>
            </Box>

            {/* Drawer */}
            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                slotProps={{
                    paper: {
                        sx: {
                            width: 380,
                            background: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.85) 100%)",
                            backdropFilter: "blur(8px)",
                            color: "text.primary",
                            borderLeft: "1px solid rgba(255,255,255,0.08)",
                        },
                    },
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="h6">Detaylı Filtreler</Typography>
                        <IconButton onClick={() => setDrawerOpen(false)}>
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                    <Divider sx={{ mb: 2, borderColor: "rgba(255,255,255,0.12)" }} />
                    <Typography variant="body2" color="text.secondary">
                        Not: Tablo araç çubuğundan (Quick filter / Columns / Filters / Density) anlık filtreleme yapabilirsiniz.
                    </Typography>
                </Box>
            </Drawer>

            {/* Dialog: Ekle / Düzenle */}
            <Dialog open={duzenleAcik} onClose={() => setDuzenleAcik(false)} maxWidth="md" fullWidth
                PaperProps={{ sx: { backgroundColor: "background.paper" } }}>
                <DialogTitle>{editId ? "Araç Bilgilerini Güncelle" : "Yeni Araç Bilgisi"}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0 }}>
                        <Grid item xs={12} md={4}><TextField fullWidth name="plaka" value={form.plaka} onChange={handleChange} label="Plaka" required /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="treyler" value={form.treyler} onChange={handleChange} label="Treyler" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="surucu_adi" value={form.surucu_adi} onChange={handleChange} label="Sürücü Adı" /></Grid>

                        <Grid item xs={12} md={4}><TextField fullWidth name="surucu_telefon" value={form.surucu_telefon} onChange={handleChange} label="Telefon" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="surucu_tc" value={form.surucu_tc} onChange={handleChange} label="TC" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="ikamet_adresi" value={form.ikamet_adresi} onChange={handleChange} label="İkamet Adresi" /></Grid>

                        <Grid item xs={12} md={4}><TextField fullWidth name="cekici_ruhsat_no" value={form.cekici_ruhsat_no} onChange={handleChange} label="Çekici Ruhsat No" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="dorse_ruhsat_no" value={form.dorse_ruhsat_no} onChange={handleChange} label="Dorse Ruhsat No" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="tedarikci_isim" value={form.tedarikci_isim} onChange={handleChange} label="Tedarikçi İsim" /></Grid>

                        <Grid item xs={12} md={4}><TextField fullWidth type="date" name="cekici_muayene" value={form.cekici_muayene} onChange={handleChange} label="Çekici Muayene" InputLabelProps={{ shrink: true }} required /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth type="date" name="dorse_muayene" value={form.dorse_muayene} onChange={handleChange} label="Dorse Muayene" InputLabelProps={{ shrink: true }} required /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth type="date" name="trafik_sigorta" value={form.trafik_sigorta} onChange={handleChange} label="Trafik Sigorta" InputLabelProps={{ shrink: true }} required /></Grid>

                        <Grid item xs={12} md={4}><TextField fullWidth type="number" name="arac_yil" value={form.arac_yil || ""} onChange={handleChange} label="Araç Yılı" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth type="number" name="dorse_yil" value={form.dorse_yil || ""} onChange={handleChange} label="Dorse Yılı" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="bolge" value={form.bolge} onChange={handleChange} label="Bölge" /></Grid>

                        <Grid item xs={12} md={4}><TextField fullWidth name="arac_tip" value={form.arac_tip} onChange={handleChange} label="Araç Tip" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="dorse_tip" value={form.dorse_tip} onChange={handleChange} label="Dorse Tip" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="liftmaster" value={form.liftmaster} onChange={handleChange} label="Liftmaster" /></Grid>

                        <Grid item xs={12} md={4}><TextField fullWidth name="gps_seri_no" value={form.gps_seri_no} onChange={handleChange} label="GPS Seri No" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="gps_sim_kart_no" value={form.gps_sim_kart_no} onChange={handleChange} label="GPS Sim Kart No" /></Grid>
                        <Grid item xs={12} md={4}><TextField fullWidth name="odak_k1" value={form.odak_k1} onChange={handleChange} label="Odak K1" /></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{
                    position: "sticky", bottom: 0,
                    background: "linear-gradient(180deg, rgba(10,16,30,0.9) 0%, rgba(10,16,30,0.95) 100%)",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                }}>
                    <Button onClick={handleSubmit} variant="contained" sx={{ px: 3, py: 1.1 }}>
                        {editId ? "Güncelle" : "Kaydet"}
                    </Button>
                    <Button onClick={temizleVeKapat} variant="text">İptal</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog: Silme */}
            <Dialog open={silModalAcik} onClose={() => setSilModalAcik(false)}
                PaperProps={{ sx: { backgroundColor: "background.paper" } }}>
                <DialogTitle>Araç Silme Bilgisi</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Silme sebebi" value={silmeSebebi} onChange={(e) => setSilmeSebebi(e.target.value)} fullWidth />
                        <TextField label="Tarih" type="datetime-local" value={silinmeTarihi} onChange={(e) => setSilinmeTarihi(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleSilOnayla} variant="contained">Onayla</Button>
                    <Button onClick={() => setSilModalAcik(false)}>İptal</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog: Bilgi */}
            <Dialog open={bilgiModalAcik} onClose={() => setBilgiModalAcik(false)} maxWidth="md" fullWidth
                PaperProps={{ sx: { backgroundColor: "background.paper" } }}>
                <DialogTitle>İşlem Bilgisi</DialogTitle>
                <DialogContent dividers>
                    {bilgiArac && (
                        <Stack spacing={2}>
                            <Typography><b>Statü:</b> {bilgiArac.statu}</Typography>
                            {bilgiArac.izin_baslangic_tarihi && (
                                <Typography><b>İzin Başlangıç:</b> {new Date(bilgiArac.izin_baslangic_tarihi).toLocaleDateString()}</Typography>
                            )}
                            {bilgiArac.izin_bitis_tarihi && (
                                <Typography><b>İzin Bitiş:</b> {new Date(bilgiArac.izin_bitis_tarihi).toLocaleDateString()}</Typography>
                            )}
                            {bilgiArac.kesinti_baslangic_tarihi && (
                                <Typography><b>Kesinti Başlangıç:</b> {new Date(bilgiArac.kesinti_baslangic_tarihi).toLocaleDateString()}</Typography>
                            )}
                            {bilgiArac.kesinti_bitis_tarihi && (
                                <Typography><b>Kesinti Bitiş:</b> {new Date(bilgiArac.kesinti_bitis_tarihi).toLocaleDateString()}</Typography>
                            )}

                            {bilgiArac.eklenme_tarihi && (
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <Typography><b>Eklenme Tarihi:</b> {new Date(bilgiArac.eklenme_tarihi).toLocaleString()}</Typography>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Typography><b>Araç Kaydını Ekleyen:</b> {bilgiArac.ekleyen_kullanici || "-"}</Typography>
                                    </Grid>
                                </Grid>
                            )}

                            {bilgiArac.izinden_cikisi && (
                                <Typography>
                                    <b>İzinden Çıkış:</b>{" "}
                                    {new Date(bilgiArac.izinden_cikisi).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                                </Typography>
                            )}

                            {bilgiArac.statu === "ÇIKARILDI" && (
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={4}><Typography><b>Silen:</b> {bilgiArac.silen_kullanici || "-"}</Typography></Grid>
                                    <Grid item xs={12} md={4}><Typography><b>Tarih:</b> {bilgiArac.silinme_tarihi ? new Date(bilgiArac.silinme_tarihi).toLocaleString() : "-"}</Typography></Grid>
                                    <Grid item xs={12} md={4}><Typography><b>Sebep:</b> {bilgiArac.silme_sebebi || "-"}</Typography></Grid>
                                </Grid>
                            )}

                            {bilgiArac.guncelleme_tarihi && (
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={4}><Typography><b>Güncelleyen:</b> {bilgiArac.guncelleyen_kullanici || "-"}</Typography></Grid>
                                    <Grid item xs={12} md={4}><Typography><b>Güncelleme Tarihi:</b> {new Date(bilgiArac.guncelleme_tarihi).toLocaleString()}</Typography></Grid>
                                    <Grid item xs={12} md={4}><Typography><b>Değiştirilen Alanlar:</b> {bilgiArac.guncellenen_alanlar || "-"}</Typography></Grid>
                                </Grid>
                            )}

                            {izinBilgisi && (
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle1" sx={{ mb: 1 }}>İzin Bilgisi</Typography>
                                    <Grid container spacing={1}>
                                        <Grid item xs={12} md={4}><Typography><b>İzin Türü:</b> {izinBilgisi.izin_turu}</Typography></Grid>
                                        <Grid item xs={12} md={4}><Typography><b>Başlangıç:</b> {izinBilgisi.baslangic_tarihi}</Typography></Grid>
                                        <Grid item xs={12} md={4}><Typography><b>Bitiş:</b> {izinBilgisi.bitis_tarihi}</Typography></Grid>
                                        <Grid item xs={12} md={4}><Typography><b>Gün Sayısı:</b> {izinBilgisi.gun_sayisi}</Typography></Grid>
                                        <Grid item xs={12} md={4}><Typography><b>Ekleyen:</b> {izinBilgisi.ekleyen_kullanici}</Typography></Grid>
                                        <Grid item xs={12}><Typography><b>Açıklama:</b> {izinBilgisi.aciklama || "-"}</Typography></Grid>
                                    </Grid>
                                </Paper>
                            )}

                            {kesintiBilgisi && (
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Kesinti Bilgisi</Typography>
                                    <Grid container spacing={1}>
                                        <Grid item xs={12} md={4}><Typography><b>Kesinti Türü:</b> {kesintiBilgisi.kesinti_turu}</Typography></Grid>
                                        <Grid item xs={12} md={4}><Typography><b>Başlangıç:</b> {kesintiBilgisi.baslangic_tarihi}</Typography></Grid>
                                        <Grid item xs={12} md={4}><Typography><b>Bitiş:</b> {kesintiBilgisi.bitis_tarihi}</Typography></Grid>
                                        <Grid item xs={12} md={4}><Typography><b>Gün Sayısı:</b> {kesintiBilgisi.gun_sayisi}</Typography></Grid>
                                        <Grid item xs={12} md={4}><Typography><b>Ekleyen:</b> {kesintiBilgisi.ekleyen_kullanici}</Typography></Grid>
                                        <Grid item xs={12}><Typography><b>Açıklama:</b> {kesintiBilgisi.aciklama || "-"}</Typography></Grid>
                                    </Grid>
                                </Paper>
                            )}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBilgiModalAcik(false)} variant="text">Kapat</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snack.open}
                autoHideDuration={2500}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    severity={snack.severity}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </ScaleToFit>
    );
}
