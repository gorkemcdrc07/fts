import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { useNavigate } from "react-router-dom";

import {
    ThemeProvider,
    createTheme,
    CssBaseline,
    Container,
    Paper,
    Grid,
    Stack,
    Typography,
    Button,
    IconButton,
    TextField,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Chip,
    Tooltip,
    Divider,
    Snackbar,
    Alert,
    Drawer,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Autocomplete,
    Box,
    alpha,
    Card,
    CardContent,
    Badge,
    LinearProgress,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import FilterListIcon from "@mui/icons-material/FilterList";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import DensityMediumIcon from "@mui/icons-material/DensityMedium";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeIcon from "@mui/icons-material/HomeOutlined";

import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarQuickFilter,
    GridToolbarColumnsButton,
    GridToolbarDensitySelector,
} from "@mui/x-data-grid";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

dayjs.locale("tr");

/* ===================== (YENİ) Ekrana Sığdırma Sarmalayıcısı ===================== */
const BASE_WIDTH = 1750;
const BASE_HEIGHT = 960;
function useScaleToFit(baseW = BASE_WIDTH, baseH = BASE_HEIGHT, maxScale = 1.25) {
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
                }}
            >
                {children}
            </Box>
        </Box>
    );
}

/* ===================== Türkçe grid metinleri ===================== */
const GRID_TR = {
    noRowsLabel: "Kayıt bulunmuyor",
    noResultsOverlayLabel: "Sonuç bulunamadı",
    errorOverlayDefaultLabel: "Bir hata oluştu.",
    toolbarColumns: "Sütunlar",
    toolbarFilters: "Filtreler",
    toolbarDensity: "Sıklık",
    toolbarDensityCompact: "Sıkı",
    toolbarDensityStandard: "Standart",
    toolbarDensityComfortable: "Rahat",
    toolbarExport: "Dışa aktar",
    toolbarQuickFilterPlaceholder: "Ara…",
    columnMenuLabel: "Menü",
    columnMenuShowColumns: "Sütunları göster",
    columnMenuFilter: "Filtrele",
    columnMenuHideColumn: "Sütunu gizle",
    columnMenuUnsort: "Sıralamayı kaldır",
    columnMenuSortAsc: "Artan sırala",
    columnMenuSortDesc: "Azalan sırala",
    columnsPanelTextFieldLabel: "Sütun ara",
    columnsPanelShowAllButton: "Hepsini göster",
    columnsPanelHideAllButton: "Hepsini gizle",
};

/* ===================== Helpers ===================== */
const BOS_FORM = {
    plaka_treyler: "",
    surucu_adi: "",
    surucu_telefon: "",
    surucu_tc: "",
    izin_turu: "",
    baslangic_tarihi: "",
    bitis_tarihi: "",
    gun_sayisi: "",
    is_basi_tarihi: "",
    yukleme_tarihi: "",
    aciklama: "",
};
const IZIN_TURLERI = ["İzin", "Bakım İzni", "Mazeret İzni"];
const getMevcutKullanici = () =>
    localStorage.getItem("kullanici") || "Bilinmeyen Kullanıcı";

const hesaplaGunSayisi = (baslangicStr, bitisStr) => {
    if (!baslangicStr || !bitisStr) return 0;
    const d1 = new Date(baslangicStr);
    const d2 = new Date(bitisStr);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const fark = (d2 - d1) / (1000 * 60 * 60 * 24);
    return fark > 0 ? fark : 0;
};
// DataGrid güvenli yardımcılar
const safeGetVal = (arg) =>
    arg && typeof arg === "object" && "value" in arg ? arg.value : arg;
const safeDateValueGetter = (arg) => {
    const v = safeGetVal(arg);
    if (!v) return null;
    const s = String(v).slice(0, 10);
    const d = dayjs(s);
    return d.isValid() ? d.toDate() : null;
};
const safeDateValueFormatter = (arg) => {
    const v = safeGetVal(arg);
    if (!v) return "-";
    const d = dayjs(v);
    return d.isValid() ? d.format("DD.MM.YYYY") : "-";
};

/* ===================== Tema (gelişmiş, modern) ===================== */
const theme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: "#8B5CF6" },
        secondary: { main: "#22D3EE" },
        background: { default: "#050816", paper: alpha("#0B1220", 0.9) },
        success: { main: "#22C55E" },
        error: { main: "#EF4444" },
    },
    shape: { borderRadius: 16 },
    typography: {
        fontFamily:
            'Inter, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        h4: { fontWeight: 800, letterSpacing: 0.2 },
        button: { textTransform: "none", fontWeight: 700 },
    },
    components: {
        MuiPaper: {
            styleOverrides: { root: { backgroundImage: "none" } },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: "0 6px 20px rgba(139,92,246,0.25)",
                    ":hover": { boxShadow: "0 8px 24px rgba(139,92,246,0.35)" },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    background:
                        "linear-gradient(180deg, rgba(10,16,30,0.95) 0%, rgba(10,16,30,0.85) 100%)",
                    boxShadow:
                        "0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    maxHeight: "90dvh",
                },
            },
        },
        MuiTextField: {
            defaultProps: { variant: "outlined" },
            styleOverrides: { root: { "& .MuiOutlinedInput-root": { borderRadius: 12 } } },
        },
    },
});

/* ============= Özelleştirilmiş Toolbar ============= */
function CustomToolbar({ onRefresh, onExport, onFilters }) {
    return (
        <GridToolbarContainer
            sx={{
                px: 1,
                py: 0.5,
                gap: 1,
                position: "sticky",
                top: 0,
                zIndex: 1,
                background:
                    "linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.6) 100%)",
                backdropFilter: "blur(6px)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            <GridToolbarColumnsButton startIcon={<ViewWeekIcon />} />
            <GridToolbarDensitySelector startIcon={<DensityMediumIcon />} />
            <Box sx={{ flexGrow: 1 }} />
            <GridToolbarQuickFilter
                debounceMs={300}
                quickFilterParser={(v) =>
                    v
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                }
                sx={{
                    "& .MuiInputBase-root": {
                        borderRadius: 2,
                        backgroundColor: alpha("#ffffff", 0.04),
                    },
                }}
            />
            <Tooltip title="Filtreler">
                <IconButton onClick={onFilters}>
                    <FilterListIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title="Yenile">
                <IconButton onClick={onRefresh}>
                    <RefreshIcon />
                </IconButton>
            </Tooltip>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExport}>
                Excel
            </Button>
        </GridToolbarContainer>
    );
}

/* ===================== Component ===================== */
export default function IzinGirisiModern() {
    const navigate = useNavigate();

    // data
    const [izinler, setIzinler] = useState([]);
    const [plakaListesi, setPlakaListesi] = useState([]);

    // ui
    const [loading, setLoading] = useState(false);
    const [snack, setSnack] = useState({
        open: false,
        msg: "",
        severity: "success",
    });
    const [filtreDrawer, setFiltreDrawer] = useState(false);

    // form
    const [form, setForm] = useState(BOS_FORM);
    const [formOpen, setFormOpen] = useState(false);
    const [duzenlemeId, setDuzenlemeId] = useState(null);

    // kesinti dialog
    const [kesintiOpen, setKesintiOpen] = useState(false);
    const [kesintiBilgisi, setKesintiBilgisi] = useState({ neden: "", tur: "" });
    const [formSubmitBekliyor, setFormSubmitBekliyor] = useState(false);

    // filtreler
    const [filtreler, setFiltreler] = useState({
        plaka_treyler: "",
        surucu_adi: "",
        izin_turu: "",
        baslangic_tarihi: "",
        bitis_tarihi: "",
        is_basi_tarihi: "",
        yukleme_tarihi: "",
        gun_sayisi: "",
        aciklama: "",
        ekleyen_kullanici: "",
        eklenme_tarihi: "",
    });

    const [mevcutAylar, setMevcutAylar] = useState([]);

    const openSnack = (msg, severity = "success") =>
        setSnack({ open: true, msg, severity });

    /* ===================== Effects ===================== */
    useEffect(() => {
        verileriGetir();
        plakalariGetir();
    }, []);

    useEffect(() => {
        const uniq = new Set(
            izinler
                .filter((i) => i.baslangic_tarihi)
                .map((i) => dayjs(i.baslangic_tarihi).format("YYYY-MM"))
        );
        const list = Array.from(uniq).map((ym) => ({
            value: ym,
            label: dayjs(ym + "-01").format("MMMM YYYY"),
        }));
        setMevcutAylar(list);
    }, [izinler]);

    useEffect(() => {
        if (formSubmitBekliyor) {
            setFormSubmitBekliyor(false);
            handleSubmit();
        }
    }, [formSubmitBekliyor]);

    /* ===================== Derived UI Counts ===================== */
    const toplamKayit = izinler.length;
    const eksikKayit = izinler.filter(
        (r) => !r.yukleme_tarihi || !r.is_basi_tarihi
    ).length;
    const buAy = izinler.filter(
        (r) => r.baslangic_tarihi && dayjs(r.baslangic_tarihi).isSame(dayjs(), "month")
    ).length;

    /* ===================== Data ===================== */
    const verileriGetir = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("izinler")
            .select("*")
            .order("id", { ascending: false });
        if (!error) {
            const cleaned = (data || []).map((r) => ({
                ...r,
                baslangic_tarihi: r["baslangic_tarihi"]
                    ? String(r["baslangic_tarihi"]).slice(0, 10)
                    : null,
                bitis_tarihi: r["bitis_tarihi"]
                    ? String(r["bitis_tarihi"]).slice(0, 10)
                    : null,
                is_basi_tarihi: r["is_basi_tarihi"]
                    ? String(r["is_basi_tarihi"]).slice(0, 10)
                    : null,
                yukleme_tarihi: r["yukleme_tarihi"]
                    ? String(r["yukleme_tarihi"]).slice(0, 10)
                    : null,
                eklenme_tarihi: r["eklenme_tarihi"]
                    ? String(r["eklenme_tarihi"]).slice(0, 10)
                    : null,
            }));
            setIzinler(cleaned);
        } else {
            openSnack("İzinler alınamadı.", "error");
        }
        setLoading(false);
    };

    const plakalariGetir = async () => {
        const { data, error } = await supabase
            .from("plakalar")
            .select("*")
            .or("statu.is.null,statu.neq.ÇIKARILDI");
        if (!error && data) setPlakaListesi(data);
    };

    /* ===================== Handlers ===================== */
    const handleFormChange = (name, value) => {
        const next = { ...form, [name]: value };

        if (name === "baslangic_tarihi" || name === "bitis_tarihi") {
            const { baslangic_tarihi, bitis_tarihi } = next;
            if (baslangic_tarihi && bitis_tarihi) {
                const farkGun = hesaplaGunSayisi(baslangic_tarihi, bitis_tarihi);
                next.gun_sayisi = farkGun > 0 ? farkGun : 0;

                const bitis = new Date(bitis_tarihi);
                bitis.setDate(bitis.getDate() + 1); // iş başı ertesi gün
                next.is_basi_tarihi = bitis.toISOString().split("T")[0];
            }
        }

        setForm(next);
    };

    const handlePlakaSecimi = (value) => {
        const secilen = plakaListesi.find(
            (p) => `${p.plaka} - ${p.treyler}` === value
        );

        if (secilen) {
            setForm((prev) => ({
                ...prev,
                plaka_treyler: value,
                surucu_adi: secilen.surucu_adi || "",
                surucu_telefon: secilen.surucu_telefon || "",
                surucu_tc: secilen.surucu_tc || "",
            }));
        } else {
            setForm((prev) => ({ ...prev, plaka_treyler: value || "" }));
        }
    };

    const handleYeniIzin = () => {
        setForm(BOS_FORM);
        setDuzenlemeId(null);
        setFormOpen(true);
    };

    const handleDuzenle = (row) => {
        setForm({
            plaka_treyler: row.plaka_treyler || "",
            surucu_adi: row.surucu_adi || "",
            surucu_telefon: row.surucu_telefon || "",
            surucu_tc: row.surucu_tc || "",
            izin_turu: row.izin_turu || "",
            baslangic_tarihi: row.baslangic_tarihi || "",
            bitis_tarihi: row["bitis_tarihi"] || "",
            gun_sayisi: Number(row.gun_sayisi) || 0,
            is_basi_tarihi: row.is_basi_tarihi || "",
            yukleme_tarihi: row.yukleme_tarihi || "",
            aciklama: row.aciklama || "",
        });
        setDuzenlemeId(row.id);
        setFormOpen(true);
    };

    const handleSil = async (id) => {
        if (!window.confirm("Silmek istediğinize emin misiniz?")) return;

        const { data: izinKaydi } = await supabase
            .from("izinler")
            .select("*")
            .eq("id", id)
            .single();

        if (!izinKaydi) {
            openSnack("Silinecek kayıt bulunamadı.", "warning");
            return;
        }

        const { error: silErr } = await supabase.from("izinler").delete().eq("id", id);
        if (silErr) {
            openSnack("Silme sırasında hata oluştu.", "error");
            return;
        }

        const [plaka, treyler] = (izinKaydi.plaka_treyler || "").split(" - ");
        if (plaka && treyler) {
            await supabase
                .from("plakalar")
                .update({
                    statu: "İZİNDEN ÇIKTI",
                    izin_baslangic_tarihi: null,
                    izin_bitis_tarihi: null,
                    izinden_cikisi: new Date().toISOString(),
                })
                .eq("plaka", plaka)
                .eq("treyler", treyler);
        }

        openSnack("Kayıt silindi.");
        verileriGetir();
    };

    const kesintiGerekirMi = () => {
        const yukleme = form.yukleme_tarihi ? new Date(form.yukleme_tarihi) : null;
        const isBasi = form.is_basi_tarihi ? new Date(form.is_basi_tarihi) : null;
        if (!yukleme || !isBasi) return false;
        const farkGun = Math.ceil((yukleme - isBasi) / (1000 * 60 * 60 * 24));
        return farkGun > 0;
    };

    // >>> GÜNCELLENDİ: gün/aylık izin sınırı kontrolleri kaldırıldı
    const handleSubmit = async () => {
        const kullanici = getMevcutKullanici();

        // Eğer yükleme tarihi iş başından sonra ise, kesinti diyalogunu göster
        if (kesintiGerekirMi() && !formSubmitBekliyor) {
            setKesintiOpen(true);
            return;
        }

        const payload = {
            ...form,
            gun_sayisi: Number(form.gun_sayisi) || 0,
            is_basi_tarihi: form.is_basi_tarihi || null,
            yukleme_tarihi: form.yukleme_tarihi || null,
            ekleyen_kullanici: kullanici,
            eklenme_tarihi: new Date().toISOString(),
        };

        let result;
        if (duzenlemeId) {
            result = await supabase.from("izinler").update(payload).eq("id", duzenlemeId);
        } else {
            result = await supabase.from("izinler").insert([payload]);
        }

        if (result.error) {
            openSnack("Kayıt sırasında bir hata oluştu.", "error");
            return;
        }

        // Kesinti kaydı gerekiyorsa oluştur
        const yukleme = form.yukleme_tarihi ? new Date(form.yukleme_tarihi) : null;
        const isBasi = form.is_basi_tarihi ? new Date(form.is_basi_tarihi) : null;
        if (kesintiBilgisi.neden && kesintiBilgisi.tur && isBasi && yukleme) {
            const kesintiGunSayisi = Math.max(
                0,
                Math.ceil((yukleme - isBasi) / (1000 * 60 * 60 * 24))
            );

            await supabase
                .from("kesintiler")
                .delete()
                .eq("plaka_treyler", form.plaka_treyler)
                .eq("baslangic_tarihi", form.is_basi_tarihi)
                .eq("bitis_tarihi", form.yukleme_tarihi);

            await supabase.from("kesintiler").insert([
                {
                    plaka_treyler: form.plaka_treyler,
                    kesinti_turu: kesintiBilgisi.tur,
                    neden: kesintiBilgisi.neden,
                    baslangic_tarihi: form.is_basi_tarihi,
                    bitis_tarihi: form.yukleme_tarihi,
                    gun_sayisi: kesintiGunSayisi,
                    aciklama: form.aciklama || "",
                    ekleyen_kullanici: kullanici,
                    eklenme_tarihi: new Date().toISOString(),
                },
            ]);
        }

        openSnack(duzenlemeId ? "Kayıt güncellendi." : "Kayıt eklendi.");
        setForm(BOS_FORM);
        setDuzenlemeId(null);
        setKesintiBilgisi({ neden: "", tur: "" });
        setKesintiOpen(false);
        setFormOpen(false);
        verileriGetir();
    };

    const handleKesintiDevam = () => {
        setKesintiOpen(false);
        setFormSubmitBekliyor(true);
    };

    const exportToExcel = () => {
        const worksheetData = izinler.map((i) => ({
            PLAKA: i.plaka_treyler,
            SÜRÜCÜ: i.surucu_adi,
            "İZİN TÜRÜ": i.izin_turu,
            BAŞLANGIÇ: i.baslangic_tarihi
                ? dayjs(i.baslangic_tarihi).format("DD.MM.YYYY")
                : "-",
            BİTİŞ: i["bitis_tarihi"]
                ? dayjs(i["bitis_tarihi"]).format("DD.MM.YYYY")
                : "-",
            "İŞ BAŞI TARİHİ": i.is_basi_tarihi
                ? dayjs(i.is_basi_tarihi).format("DD.MM.YYYY")
                : "-",
            "YÜKLEME TARİHİ": i.yukleme_tarihi
                ? dayjs(i.yukleme_tarihi).format("DD.MM.YYYY")
                : "-",
            "TOPLAM GÜN": i.gun_sayisi,
            AÇIKLAMA: i.aciklama,
            "İZİN VEREN": i.ekleyen_kullanici,
            "İZİN VERİLEN TARİH": i.eklenme_tarihi
                ? dayjs(i.eklenme_tarihi).format("DD.MM.YYYY")
                : "-",
        }));

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Izinler");
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([buf], { type: "application/octet-stream" }), "izin_kayitlari.xlsx");
    };

    /* ===================== Filtering ===================== */
    const filtrelenmisIzinler = useMemo(() => {
        const matches = (item, key, val) =>
            val === "" ||
            String(item[key] || "").toLowerCase().includes(String(val).toLowerCase());

        return izinler.filter((i) => {
            const ayOk =
                !filtreler.baslangic_tarihi ||
                (i.baslangic_tarihi &&
                    dayjs(i.baslangic_tarihi).format("YYYY-MM") ===
                    filtreler.baslangic_tarihi);

            const diger =
                matches(i, "plaka_treyler", filtreler.plaka_treyler) &&
                matches(i, "surucu_adi", filtreler.surucu_adi) &&
                matches(i, "izin_turu", filtreler.izin_turu) &&
                matches(i, "bitis_tarihi", filtreler.bitis_tarihi) &&
                matches(i, "is_basi_tarihi", filtreler.is_basi_tarihi) &&
                matches(i, "yukleme_tarihi", filtreler.yukleme_tarihi) &&
                (filtreler.gun_sayisi === "" ||
                    Number(i.gun_sayisi) === Number(filtreler.gun_sayisi)) &&
                matches(i, "aciklama", filtreler.aciklama) &&
                matches(i, "ekleyen_kullanici", filtreler.ekleyen_kullanici) &&
                matches(i, "eklenme_tarihi", filtreler.eklenme_tarihi);

            return ayOk && diger;
        });
    }, [izinler, filtreler]);

    /* ===================== Columns ===================== */
    const columns = [
        { field: "plaka_treyler", headerName: "PLAKA", flex: 1, minWidth: 160 },
        { field: "surucu_adi", headerName: "SÜRÜCÜ", flex: 1, minWidth: 140 },
        { field: "surucu_telefon", headerName: "TELEFON", flex: 1, minWidth: 140 },
        { field: "surucu_tc", headerName: "TC", flex: 1, minWidth: 140 },
        { field: "izin_turu", headerName: "İZİN TÜRÜ", flex: 0.9, minWidth: 140 },
        {
            field: "baslangic_tarihi",
            headerName: "BAŞLANGIÇ",
            type: "date",
            flex: 0.9,
            minWidth: 130,
            valueGetter: safeDateValueGetter,
            valueFormatter: safeDateValueFormatter,
        },
        {
            field: "bitis_tarihi",
            headerName: "BİTİŞ",
            type: "date",
            flex: 0.9,
            minWidth: 130,
            valueGetter: safeDateValueGetter,
            valueFormatter: safeDateValueFormatter,
        },
        {
            field: "is_basi_tarihi",
            headerName: "İŞ BAŞI",
            type: "date",
            flex: 0.9,
            minWidth: 120,
            valueGetter: safeDateValueGetter,
            valueFormatter: safeDateValueFormatter,
        },
        {
            field: "yukleme_tarihi",
            headerName: "YÜKLEME",
            type: "date",
            flex: 0.9,
            minWidth: 120,
            valueGetter: safeDateValueGetter,
            valueFormatter: safeDateValueFormatter,
        },
        { field: "gun_sayisi", headerName: "GÜN", width: 90 },
        { field: "aciklama", headerName: "AÇIKLAMA", flex: 1.2, minWidth: 220 },
        { field: "ekleyen_kullanici", headerName: "İZİN VEREN", flex: 1, minWidth: 150 },
        {
            field: "durum",
            headerName: "DURUM",
            flex: 0.7,
            minWidth: 110,
            renderCell: (params) => {
                const eksik = !params.row.yukleme_tarihi || !params.row.is_basi_tarihi;
                return eksik ? (
                    <Tooltip title="Eksik: İş Başı ve/veya Yükleme yok">
                        <Chip size="small" color="error" variant="outlined" label="Eksik" />
                    </Tooltip>
                ) : (
                    <Chip size="small" color="success" label="Tam" />
                );
            },
        },
        {
            field: "actions",
            headerName: "İŞLEM",
            width: 130,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Düzenle">
                        <IconButton size="small" onClick={() => handleDuzenle(params.row)}>
                            <EditIcon fontSize="inherit" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Sil">
                        <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleSil(params.row.id)}
                        >
                            <DeleteIcon fontSize="inherit" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            ),
        },
    ];

    /* ===================== Render ===================== */
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <ScaleToFit>
                    <Helmet>
                        <title>İZİN GİRİŞLERİ</title>
                    </Helmet>

                    <Container
                        maxWidth={false}
                        disableGutters
                        sx={{
                            height: "100%",
                            p: 2,
                            boxSizing: "border-box",
                            background: "transparent",
                            display: "flex",
                            flexDirection: "column",
                            minHeight: 0,
                        }}
                    >
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            alignItems={{ xs: "flex-start", md: "center" }}
                            justifyContent="space-between"
                            gap={2}
                            sx={{ flexShrink: 0 }}
                        >
                            <Stack>
                                <Typography
                                    variant="h4"
                                    fontWeight={800}
                                    sx={{
                                        background: "linear-gradient(90deg,#E879F9,#22D3EE)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                    }}
                                >
                                    İzin Girişleri
                                </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                                {/* EKLENDİ: Geri & Anasayfa */}
                                <Button
                                    variant="text"
                                    startIcon={<ArrowBackIcon />}
                                    onClick={() => navigate(-1)}
                                >
                                    Geri
                                </Button>
                                <Button
                                    variant="text"
                                    startIcon={<HomeIcon />}
                                    onClick={() => navigate("/")}
                                >
                                    Anasayfa
                                </Button>

                                <Button
                                    variant="outlined"
                                    startIcon={<FilterListIcon />}
                                    onClick={() => setFiltreDrawer(true)}
                                >
                                    Filtreler
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    onClick={exportToExcel}
                                >
                                    Excel'e Aktar
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={handleYeniIzin}
                                >
                                    Yeni İzin
                                </Button>
                            </Stack>
                        </Stack>

                        <Grid container spacing={2} sx={{ flexShrink: 0, mt: 1 }}>
                            {[
                                { label: "Toplam Kayıt", value: toplamKayit, color: "primary" },
                                { label: "Bu Ay", value: buAy, color: "secondary" },
                                { label: "Eksik Bilgili", value: eksikKayit, color: "error" },
                            ].map((kpi, idx) => (
                                <Grid item xs={12} sm={6} md={4} key={idx}>
                                    <Card
                                        sx={{
                                            borderRadius: 3,
                                            minWidth: 220,
                                            background: `linear-gradient(180deg, ${alpha(
                                                "#ffffff",
                                                0.04
                                            )} 0%, ${alpha("#ffffff", 0.02)} 100%)`,
                                            border: "1px solid rgba(255,255,255,0.06)",
                                        }}
                                    >
                                        <CardContent>
                                            <Stack
                                                direction="row"
                                                alignItems="center"
                                                justifyContent="space-between"
                                            >
                                                <Typography variant="subtitle2" color="text.secondary">
                                                    {kpi.label}
                                                </Typography>
                                                <Badge color={kpi.color} variant="dot" overlap="circular" />
                                            </Stack>
                                            <Typography variant="h4" mt={0.5} fontWeight={800}>
                                                {kpi.value}
                                            </Typography>
                                            <LinearProgress
                                                sx={{ mt: 2, height: 6, borderRadius: 3 }}
                                                color={kpi.color}
                                                variant="determinate"
                                                value={100}
                                            />
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>

                        <Box sx={{ flexShrink: 0, mt: 2 }}>
                            <Paper
                                sx={{
                                    height: "65vh",
                                    borderRadius: 3,
                                    overflow: "hidden",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                {loading && <LinearProgress />}
                                <DataGrid
                                    style={{ height: "100%" }}
                                    rows={filtrelenmisIzinler}
                                    columns={columns}
                                    getRowId={(r) => r.id}
                                    loading={loading}
                                    disableRowSelectionOnClick
                                    pagination={false}
                                    hideFooter
                                    density="compact"
                                    rowHeight={44}
                                    columnHeaderHeight={44}
                                    localeText={GRID_TR}
                                    slots={{
                                        toolbar: () => (
                                            <CustomToolbar
                                                onRefresh={verileriGetir}
                                                onExport={exportToExcel}
                                                onFilters={() => setFiltreDrawer(true)}
                                            />
                                        ),
                                    }}
                                    sx={{
                                        border: "none",
                                        "& .MuiDataGrid-columnHeaders": {
                                            background:
                                                "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.7) 100%)",
                                            color: "#C8D1E6",
                                            borderBottomColor: "rgba(255,255,255,0.08)",
                                            fontWeight: 700,
                                        },
                                        "& .MuiDataGrid-row:nth-of-type(2n) .MuiDataGrid-cell": {
                                            backgroundColor: "rgba(255,255,255,0.02)",
                                        },
                                        "& .MuiDataGrid-cell": {
                                            borderBottomColor: "rgba(255,255,255,0.06)",
                                        },
                                        "& .MuiDataGrid-row:hover .MuiDataGrid-cell": {
                                            backgroundColor: "rgba(139,92,246,0.10)",
                                        },
                                    }}
                                />
                            </Paper>
                        </Box>

                        <Drawer
                            anchor="right"
                            open={filtreDrawer}
                            onClose={() => setFiltreDrawer(false)}
                            slotProps={{
                                paper: {
                                    sx: {
                                        width: 420,
                                        backgroundColor: "#0F172A",
                                        color: "text.primary",
                                        p: 2,
                                        borderLeft: "1px solid rgba(255,255,255,0.06)",
                                    },
                                },
                            }}
                        >
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                            >
                                <Typography variant="h6">Detaylı Filtreler</Typography>
                                <IconButton onClick={() => setFiltreDrawer(false)}>
                                    <CloseIcon />
                                </IconButton>
                            </Stack>
                            <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.12)" }} />

                            <Stack spacing={2}>
                                <Autocomplete
                                    freeSolo
                                    options={plakaListesi.map((p) => `${p.plaka} - ${p.treyler}`)}
                                    value={filtreler.plaka_treyler}
                                    onChange={(_, v) =>
                                        setFiltreler((p) => ({ ...p, plaka_treyler: v || "" }))
                                    }
                                    onInputChange={(_, v) =>
                                        setFiltreler((p) => ({ ...p, plaka_treyler: v || "" }))
                                    }
                                    renderInput={(params) => (
                                        <TextField {...params} label="Plaka - Treyler" fullWidth />
                                    )}
                                />

                                <TextField
                                    label="Sürücü"
                                    value={filtreler.surucu_adi}
                                    onChange={(e) =>
                                        setFiltreler((p) => ({ ...p, surucu_adi: e.target.value }))
                                    }
                                    fullWidth
                                />

                                <Autocomplete
                                    freeSolo
                                    options={IZIN_TURLERI}
                                    value={filtreler.izin_turu}
                                    onChange={(_, v) =>
                                        setFiltreler((p) => ({ ...p, izin_turu: v || "" }))
                                    }
                                    onInputChange={(_, v) =>
                                        setFiltreler((p) => ({ ...p, izin_turu: v || "" }))
                                    }
                                    renderInput={(params) => (
                                        <TextField {...params} label="İzin Türü" fullWidth />
                                    )}
                                />

                                <FormControl fullWidth>
                                    <InputLabel>Başlangıç (Ay)</InputLabel>
                                    <Select
                                        label="Başlangıç (Ay)"
                                        value={filtreler.baslangic_tarihi}
                                        onChange={(e) =>
                                            setFiltreler((p) => ({
                                                ...p,
                                                baslangic_tarihi: e.target.value,
                                            }))
                                        }
                                    >
                                        <MenuItem value="">(Hepsi)</MenuItem>
                                        {mevcutAylar
                                            .sort((a, b) => a.value.localeCompare(b.value))
                                            .map((ay, idx) => (
                                                <MenuItem key={idx} value={ay.value}>
                                                    {ay.label}
                                                </MenuItem>
                                            ))}
                                    </Select>
                                </FormControl>

                                <DatePicker
                                    label="Bitiş Tarihi"
                                    value={filtreler.bitis_tarihi ? dayjs(filtreler.bitis_tarihi) : null}
                                    onChange={(d) =>
                                        setFiltreler((p) => ({
                                            ...p,
                                            bitis_tarihi: d ? dayjs(d).format("YYYY-MM-DD") : "",
                                        }))
                                    }
                                    slotProps={{ textField: { fullWidth: true } }}
                                />

                                <DatePicker
                                    label="İş Başı Tarihi"
                                    value={
                                        filtreler.is_basi_tarihi ? dayjs(filtreler.is_basi_tarihi) : null
                                    }
                                    onChange={(d) =>
                                        setFiltreler((p) => ({
                                            ...p,
                                            is_basi_tarihi: d ? dayjs(d).format("YYYY-MM-DD") : "",
                                        }))
                                    }
                                    slotProps={{ textField: { fullWidth: true } }}
                                />

                                <DatePicker
                                    label="Yükleme Tarihi"
                                    value={
                                        filtreler.yukleme_tarihi ? dayjs(filtreler.yukleme_tarihi) : null
                                    }
                                    onChange={(d) =>
                                        setFiltreler((p) => ({
                                            ...p,
                                            yukleme_tarihi: d ? dayjs(d).format("YYYY-MM-DD") : "",
                                        }))
                                    }
                                    slotProps={{ textField: { fullWidth: true } }}
                                />

                                <TextField
                                    label="Toplam Gün"
                                    type="number"
                                    value={filtreler.gun_sayisi}
                                    onChange={(e) =>
                                        setFiltreler((p) => ({ ...p, gun_sayisi: e.target.value }))
                                    }
                                    fullWidth
                                />
                                <TextField
                                    label="Açıklama"
                                    value={filtreler.aciklama}
                                    onChange={(e) =>
                                        setFiltreler((p) => ({ ...p, aciklama: e.target.value }))
                                    }
                                    fullWidth
                                />
                                <TextField
                                    label="İzin Veren"
                                    value={filtreler.ekleyen_kullanici}
                                    onChange={(e) =>
                                        setFiltreler((p) => ({
                                            ...p,
                                            ekleyen_kullanici: e.target.value,
                                        }))
                                    }
                                    fullWidth
                                />

                                <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        color="error"
                                        onClick={() =>
                                            setFiltreler({
                                                plaka_treyler: "",
                                                surucu_adi: "",
                                                izin_turu: "",
                                                baslangic_tarihi: "",
                                                bitis_tarihi: "",
                                                is_basi_tarihi: "",
                                                yukleme_tarihi: "",
                                                gun_sayisi: "",
                                                aciklama: "",
                                                ekleyen_kullanici: "",
                                                eklenme_tarihi: "",
                                            })
                                        }
                                    >
                                        Temizle
                                    </Button>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        onClick={() => setFiltreDrawer(false)}
                                    >
                                        Uygula
                                    </Button>
                                </Stack>
                            </Stack>
                        </Drawer>

                        <Dialog
                            open={formOpen}
                            onClose={() => setFormOpen(false)}
                            maxWidth="md"
                            fullWidth
                        >
                            <DialogTitle sx={{ pb: 0 }}>
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                >
                                    <Stack>
                                        <Typography variant="h6" fontWeight={800}>
                                            {duzenlemeId ? "Kaydı Düzenle" : "Yeni İzin"}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                            Lütfen zorunlu alanları doldurun. ( * )
                                        </Typography>
                                    </Stack>
                                    <IconButton onClick={() => setFormOpen(false)}>
                                        <CloseIcon />
                                    </IconButton>
                                </Stack>
                            </DialogTitle>

                            <DialogContent
                                dividers
                                sx={{
                                    mt: 1,
                                    borderTop: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <Grid container spacing={2.2}>
                                    <Grid item xs={12} md={6}>
                                        <Autocomplete
                                            size="small"
                                            freeSolo
                                            autoSelect
                                            options={plakaListesi.map((p) => `${p.plaka} - ${p.treyler}`)}
                                            value={form.plaka_treyler}
                                            onChange={(_, v) => handlePlakaSecimi(v || "")}
                                            onInputChange={(_, v) => handlePlakaSecimi(v || "")}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Plaka - Treyler"
                                                    fullWidth
                                                    required
                                                    helperText="Araç plaka ve treyler"
                                                />
                                            )}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            size="small"
                                            label="Sürücü Adı"
                                            placeholder="Ad Soyad"
                                            value={form.surucu_adi}
                                            onChange={(e) => handleFormChange("surucu_adi", e.target.value)}
                                            fullWidth
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={4}>
                                        <Autocomplete
                                            size="small"
                                            freeSolo
                                            options={IZIN_TURLERI}
                                            value={form.izin_turu}
                                            onChange={(_, v) => handleFormChange("izin_turu", v || "")}
                                            onInputChange={(_, v) => handleFormChange("izin_turu", v || "")}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="İzin Türü"
                                                    required
                                                    fullWidth
                                                    helperText="İzin, Bakım İzni, Mazeret"
                                                />
                                            )}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={4}>
                                        <DatePicker
                                            label="Başlangıç *"
                                            value={form.baslangic_tarihi ? dayjs(form.baslangic_tarihi) : null}
                                            onChange={(d) =>
                                                handleFormChange(
                                                    "baslangic_tarihi",
                                                    d ? dayjs(d).format("YYYY-MM-DD") : ""
                                                )
                                            }
                                            slotProps={{
                                                textField: {
                                                    fullWidth: true,
                                                    required: true,
                                                    size: "small",
                                                    helperText: "İzin başlangıç tarihi",
                                                },
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={4}>
                                        <DatePicker
                                            label="Bitiş *"
                                            value={form.bitis_tarihi ? dayjs(form.bitis_tarihi) : null}
                                            onChange={(d) =>
                                                handleFormChange(
                                                    "bitis_tarihi",
                                                    d ? dayjs(d).format("YYYY-MM-DD") : ""
                                                )
                                            }
                                            slotProps={{
                                                textField: {
                                                    fullWidth: true,
                                                    required: true,
                                                    size: "small",
                                                    helperText: "İzin bitiş tarihi",
                                                },
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={4}>
                                        <DatePicker
                                            label="İş Başı"
                                            value={form.is_basi_tarihi ? dayjs(form.is_basi_tarihi) : null}
                                            onChange={(d) =>
                                                handleFormChange(
                                                    "is_basi_tarihi",
                                                    d ? dayjs(d).format("YYYY-MM-DD") : ""
                                                )
                                            }
                                            slotProps={{
                                                textField: {
                                                    fullWidth: true,
                                                    size: "small",
                                                    helperText: "Otomatik: bitiş + 1 gün",
                                                },
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={4}>
                                        <DatePicker
                                            label="Yükleme"
                                            value={form.yukleme_tarihi ? dayjs(form.yukleme_tarihi) : null}
                                            onChange={(d) =>
                                                handleFormChange(
                                                    "yukleme_tarihi",
                                                    d ? dayjs(d).format("YYYY-MM-DD") : ""
                                                )
                                            }
                                            slotProps={{
                                                textField: {
                                                    fullWidth: true,
                                                    size: "small",
                                                    helperText: "Opsiyonel",
                                                },
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            size="small"
                                            label="Gün Sayısı"
                                            value={form.gun_sayisi || ""}
                                            fullWidth
                                            disabled
                                            helperText="Başlangıç ve bitişten hesaplanır"
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <TextField
                                            size="small"
                                            label="Açıklama"
                                            value={form.aciklama}
                                            onChange={(e) => handleFormChange("aciklama", e.target.value)}
                                            fullWidth
                                            multiline
                                            minRows={3}
                                            placeholder="Gerekçe ve notlar..."
                                        />
                                    </Grid>
                                </Grid>
                            </DialogContent>

                            <DialogActions
                                sx={{
                                    position: "sticky",
                                    bottom: 0,
                                    background:
                                        "linear-gradient(180deg, rgba(10,16,30,0.9) 0%, rgba(10,16,30,0.95) 100%)",
                                    borderTop: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <Button
                                    variant="contained"
                                    onClick={handleSubmit}
                                    sx={{ px: 3, py: 1.2 }}
                                >
                                    {duzenlemeId ? "Güncelle" : "Kaydet"}
                                </Button>
                                <Button variant="text" onClick={() => setFormOpen(false)}>
                                    Kapat
                                </Button>
                            </DialogActions>
                        </Dialog>

                        <Dialog open={kesintiOpen} onClose={() => setKesintiOpen(false)}>
                            <DialogTitle>Kesinti Tespiti</DialogTitle>
                            <DialogContent dividers>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth>
                                            <InputLabel>Kesinti Nedeni</InputLabel>
                                            <Select
                                                label="Kesinti Nedeni"
                                                value={kesintiBilgisi.neden}
                                                onChange={(e) =>
                                                    setKesintiBilgisi((p) => ({ ...p, neden: e.target.value }))
                                                }
                                            >
                                                <MenuItem value="Tedarikçi Kaynaklı">Tedarikçi Kaynaklı</MenuItem>
                                                <MenuItem value="Odak Kaynaklı">Odak Kaynaklı</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth>
                                            <InputLabel>Kesinti Türü</InputLabel>
                                            <Select
                                                label="Kesinti Türü"
                                                value={kesintiBilgisi.tur}
                                                onChange={(e) =>
                                                    setKesintiBilgisi((p) => ({ ...p, tur: e.target.value }))
                                                }
                                            >
                                                <MenuItem value="Bakım">Bakım</MenuItem>
                                                <MenuItem value="Servis">Servis</MenuItem>
                                                <MenuItem value="Arıza">Arıza</MenuItem>
                                                <MenuItem value="Kaza">Kaza</MenuItem>
                                                <MenuItem value="Bölgede İş Yok">Bölgede İş Yok</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Plaka - Treyler"
                                            value={form.plaka_treyler}
                                            fullWidth
                                            disabled
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="Başlangıç"
                                            value={form.is_basi_tarihi || ""}
                                            fullWidth
                                            disabled
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="Bitiş"
                                            value={form.yukleme_tarihi || ""}
                                            fullWidth
                                            disabled
                                        />
                                    </Grid>
                                </Grid>
                            </DialogContent>
                            <DialogActions>
                                <Button
                                    variant="contained"
                                    disabled={!kesintiBilgisi.neden || !kesintiBilgisi.tur}
                                    onClick={handleKesintiDevam}
                                >
                                    Devam Et
                                </Button>
                                <Button variant="text" onClick={() => setKesintiOpen(false)}>
                                    Vazgeç
                                </Button>
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
                    </Container>
                </ScaleToFit>
            </LocalizationProvider>
        </ThemeProvider>
    );
}
