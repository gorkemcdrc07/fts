// src/pages/AracYonetimiMUI.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// MUI
import {
    AppBar,
    Toolbar,
    Typography,
    IconButton,
    Button,
    Tabs,
    Tab,
    Box,
    Grid,
    Paper,
    Chip,
    TextField,
    Drawer,
    Divider,
    Tooltip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Snackbar,
    Alert,
    Stack,
    InputAdornment,
    CircularProgress,
    Badge,
    Container,
    ToggleButton,
    ToggleButtonGroup,
} from "@mui/material";

import { alpha, createTheme, ThemeProvider } from "@mui/material/styles";

import {
    Add as AddIcon,
    FilterList as FilterListIcon,
    Download as DownloadIcon,
    Info as InfoIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    Search as SearchIcon,
    ArrowBackIosNew as ArrowBackIcon,
    HomeOutlined as HomeIcon,
    Refresh as RefreshIcon,
    Clear as ClearIcon,
    DirectionsCarFilled as CarIcon,
    WarningAmber as WarningIcon,
    CheckCircle as CheckIcon,
    DoDisturb as RemovedIcon,
    ContentCopy as ContentCopyIcon,
    ViewCompact as CompactIcon,
    ViewComfy as ComfyIcon,
    TableChart as TableIcon,
    Undo as UndoIcon,
    GpsFixed as GpsIcon,
} from "@mui/icons-material";

import { DataGrid, GridToolbar, gridClasses } from "@mui/x-data-grid";
import dayjs from "dayjs";
import "dayjs/locale/tr";
dayjs.locale("tr");

/* ===================== Görsel Sabitler ===================== */
const HOME_PATH = "/anasayfa";
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;
const MAX_SCALE = Infinity;

const GRADIENT_BG =
    "radial-gradient(1200px 500px at 10% -10%, rgba(34,211,238,0.15), transparent 40%)," +
    "radial-gradient(900px 400px at 90% 0%, rgba(139,92,246,0.25), transparent 50%)," +
    "linear-gradient(180deg, #050816 0%, #0A1020 100%)";

const glass = (opacityTop = 0.92, opacityBottom = 0.75) => ({
    background: `linear-gradient(180deg, rgba(15,23,42,${opacityTop}) 0%, rgba(15,23,42,${opacityBottom}) 100%)`,
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
    borderRadius: 16,
});

const theme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: "#8B5CF6" },
        secondary: { main: "#22D3EE" },
        background: { default: "#02040C", paper: "#0F172A" },
        success: { main: "#10B981" },
        error: { main: "#F43F5E" },
        warning: { main: "#FBBF24" },
        info: { main: "#3B82F6" },
    },
    typography: {
        fontFamily: "Inter, sans-serif",
        button: { textTransform: "none", fontWeight: 800 },
    },
    components: {
        MuiButton: { styleOverrides: { root: { borderRadius: 12 } } },
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    },
});

/* ===================== Ölçekleme ===================== */
function useContainerScale(baseW = BASE_WIDTH, baseH = BASE_HEIGHT, maxScale = MAX_SCALE) {
    const ref = useRef(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const cr = entries[0].contentRect;
            const s = Math.min(cr.width / baseW, cr.height / baseH, maxScale);
            setScale(Number.isFinite(s) && s > 0 ? s : 1);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [baseW, baseH, maxScale]);

    return [ref, scale];
}

function ScaleToFit({ children }) {
    const [ref, scale] = useContainerScale();
    return (
        <Box
            ref={ref}
            sx={{
                width: "100dvw",
                height: "100dvh",
                overflow: "hidden",
                display: "grid",
                justifyItems: "start",
                alignItems: "start",
                background: GRADIENT_BG,
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
                <Container maxWidth={false} disableGutters sx={{ width: BASE_WIDTH, height: BASE_HEIGHT, p: 2, boxSizing: "border-box" }}>
                    {children}
                </Container>
            </Box>
        </Box>
    );
}

/* ===================== Helpers ===================== */
const BOS_FORM = {
    plaka: "",
    surucu_adi: "",
    surucu_telefon: "",
    surucu_tc: "",
    ikamet_adresi: "",
    cekici_ruhsat_no: "",
    dorse_ruhsat_no: "",
    tedarikci_isim: "",
    kira: "",
    yakit: "",
    izin_gun_sayisi: "",
    cekici_muayene: "",
    dorse_muayene: "",
    trafik_sigorta: "",
    arac_yil: "",
    dorse_yil: "",
    yakit_alim_firmasi: "",
    bolge: "",
    arac_tip: "",
    is_basi_tarih: "",
    dorse_tip: "",
    dorse_yukseklik: "",
    liftmaster: "",
    sozlesme_durumu: "",
    dingil: "",
    gps_durum: "", // eğer DB'de yoksa, ekranda gps_seri_no'ya göre hesaplanır
    gps_seri_no: "",
    gps_sim_kart_no: "",
    odak_k1: "",
};

const safeLower = (v) => (v ?? "").toString().toLowerCase();
const getMevcutKullanici = () => localStorage.getItem("kullanici") || "Bilinmeyen Kullanıcı";

function turkiyeSaatISOString() {
    const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return tr.toISOString();
}

function useDebounced(value, delay = 250) {
    const [d, setD] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setD(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return d;
}

function SubtleDivider({ sx, orientation = "horizontal", flexItem = false }) {
    return (
        <Divider
            orientation={orientation}
            flexItem={flexItem}
            sx={{ my: orientation === "horizontal" ? 1.5 : 0, borderColor: "rgba(255,255,255,0.08)", ...sx }}
        />
    );
}

function Section({ title, right, children }) {
    return (
        <Paper sx={{ p: 2, borderRadius: 2, ...glass(0.10, 0.03) }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ letterSpacing: 0.35, opacity: 0.95, fontWeight: 900 }}>
                    {title}
                </Typography>
                {right}
            </Stack>
            {children}
        </Paper>
    );
}

function EmptyState({ title = "Kayıt bulunamadı", caption = "Filtreleri değiştirerek tekrar deneyin." }) {
    return (
        <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", py: 6 }}>
            <Box
                sx={{
                    width: 86,
                    height: 86,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: alpha("#22D3EE", 0.10),
                    border: "1px solid " + alpha("#22D3EE", 0.30),
                    mb: 2,
                }}
            >
                <CarIcon />
            </Box>
            <Typography variant="h6" sx={{ opacity: 0.95, mb: 0.5, fontWeight: 900 }}>
                {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {caption}
            </Typography>
        </Stack>
    );
}

/* ===================== Yetki ===================== */
const SCREEN_KEY = "arac_yonetimi";
const ROLE_NAME_TO_KEY = { YÖNETİCİ: "YONETICI", OPERASYON: "OPERASYON", TAKİP: "TAKIP" };

async function fetchAracPerms() {
    const kullaniciId = parseInt(localStorage.getItem("kullaniciId"));
    if (!kullaniciId) return { canCreate: false, canEdit: false, canDelete: false };

    const { data: up } = await supabase
        .from("user_permissions")
        .select("ayon_create, ayon_edit, ayon_delete")
        .eq("user_id", kullaniciId)
        .maybeSingle();

    const userHasAny =
        up &&
        (typeof up?.ayon_create === "boolean" || typeof up?.ayon_edit === "boolean" || typeof up?.ayon_delete === "boolean");

    if (userHasAny) return { canCreate: !!up?.ayon_create, canEdit: !!up?.ayon_edit, canDelete: !!up?.ayon_delete };

    const { data: u } = await supabase.from("login").select("rol").eq("id", kullaniciId).maybeSingle();
    const roleKey = ROLE_NAME_TO_KEY[String(u?.rol || "").toUpperCase()] || String(u?.rol || "").toUpperCase();
    if (!roleKey) return { canCreate: false, canEdit: false, canDelete: false };

    const { data: role } = await supabase.from("roles").select("id").eq("key", roleKey).maybeSingle();
    if (!role?.id) return { canCreate: false, canEdit: false, canDelete: false };

    const { data: rp } = await supabase
        .from("role_permissions")
        .select("arcdur_create, arcdur_edit, arcdur_delete")
        .eq("role_id", role.id)
        .eq("screen_key", SCREEN_KEY)
        .maybeSingle();

    if (rp) return { canCreate: !!rp.arcdur_create, canEdit: !!rp.arcdur_edit, canDelete: !!rp.arcdur_delete };

    const { data: rp2 } = await supabase
        .from("role_permissions")
        .select("arcdur_create, arcdur_edit, arcdur_delete")
        .eq("role_id", role.id)
        .maybeSingle();

    return { canCreate: !!rp2?.arcdur_create, canEdit: !!rp2?.arcdur_edit, canDelete: !!rp2?.arcdur_delete };
}

/* ===================== Ana Bileşen ===================== */
export default function AracYonetimiMUI() {
    const navigate = useNavigate();
    const currentTheme = theme;

    const [tumAraclar, setTumAraclar] = useState([]);
    const [loading, setLoading] = useState(false);

    const [tab, setTab] = useState("aktif");
    const [globalSearch, setGlobalSearch] = useState("");
    const debouncedSearch = useDebounced(globalSearch, 250);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [filters, setFilters] = useState({ bolge: "", plaka: "", surucu: "" });

    const [density, setDensity] = useState("compact");

    const [form, setForm] = useState(BOS_FORM);
    const [formErrors, setFormErrors] = useState({});
    const [editId, setEditId] = useState(null);
    const [duzenleAcik, setDuzenleAcik] = useState(false);

    const [silModalAcik, setSilModalAcik] = useState(false);
    const [seciliAracId, setSeciliAracId] = useState(null);
    const [silmeSebebi, setSilmeSebebi] = useState("");
    const [silinmeTarihi, setSilinmeTarihi] = useState("");

    const [bilgiModalAcik, setBilgiModalAcik] = useState(false);
    const [bilgiArac, setBilgiArac] = useState(null);

    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
    const openSnack = useCallback((msg, severity = "success") => setSnack({ open: true, msg, severity }), []);

    const [canCreate, setCanCreate] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [canDelete, setCanDelete] = useState(false);

    const fmtDate = (v) => (v ? dayjs(v).format("DD.MM.YYYY") : "-");

    /* ===================== Data Fetch ===================== */
    const verileriGetir = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from("plakalar").select("*").order("id", { ascending: false });
            if (error) throw error;

            const bugun = new Date();

            const guncelData = (data || []).map((arac) => {
                let statu_ui = arac?.statu || "Aktif";
                if (arac?.statu !== "ÇIKARILDI" && arac?.kesinti_bitis_tarihi) {
                    const bitis = new Date(arac.kesinti_bitis_tarihi);
                    if (bitis < bugun) {
                        const farkGun = Math.floor((+bugun - +bitis) / (1000 * 60 * 60 * 24));
                        statu_ui = `${farkGun} gün kesintiden yeni çıktı`;
                    }
                }

                // gps_durum: DB'de varsa onu kullan, yoksa seri no'ya göre hesapla
                const gps_durum = arac?.gps_durum || (arac?.gps_seri_no ? "AKTİF" : "YOK");

                return {
                    ...arac,
                    statu_ui,
                    gps_durum,
                };
            });

            setTumAraclar(guncelData);
        } catch (err) {
            openSnack(`Veriler alınamadı: ${err?.message || err}`, "error");
            setTumAraclar([]);
        } finally {
            setLoading(false);
        }
    }, [openSnack]);

    /* ===================== Effects ===================== */
    useEffect(() => {
        const kullanici = localStorage.getItem("kullanici");
        if (!kullanici) navigate("/login");
    }, [navigate]);

    useEffect(() => {
        verileriGetir();
        (async () => {
            try {
                const perms = await fetchAracPerms();
                setCanCreate(perms.canCreate);
                setCanEdit(perms.canEdit);
                setCanDelete(perms.canDelete);
            } catch {
                setCanCreate(false);
                setCanEdit(false);
                setCanDelete(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ===================== CRUD Helpers ===================== */
    const temizleVeKapat = useCallback(() => {
        setForm(BOS_FORM);
        setFormErrors({});
        setEditId(null);
        setDuzenleAcik(false);
    }, []);

    const validateForm = useCallback((f) => {
        const errs = {};
        if (!f.plaka?.trim()) errs.plaka = "Plaka zorunludur.";
        if (f.surucu_telefon && !/^\+?\d[\d\s-]{7,}$/.test(f.surucu_telefon)) errs.surucu_telefon = "Telefon formatını kontrol edin.";
        return errs;
    }, []);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: value }));
    }, []);

    const handleYeniEkle = useCallback(() => {
        if (!canCreate) return openSnack("Yeni araç ekleme yetkiniz yok.", "warning");
        setForm(BOS_FORM);
        setFormErrors({});
        setEditId(null);
        setDuzenleAcik(true);
    }, [canCreate, openSnack]);

    const handleDuzenle = useCallback(
        (arac) => {
            if (!canEdit) return openSnack("Düzenleme yetkiniz yok.", "warning");
            if (!arac?.id || typeof arac.id !== "number") return openSnack("HATA: Bu kaydın DB ID'si yok. Düzenlenemez.", "error");

            setForm({
                ...BOS_FORM,
                ...arac,
                cekici_muayene: arac.cekici_muayene ? String(arac.cekici_muayene).slice(0, 10) : "",
                dorse_muayene: arac.dorse_muayene ? String(arac.dorse_muayene).slice(0, 10) : "",
                trafik_sigorta: arac.trafik_sigorta ? String(arac.trafik_sigorta).slice(0, 10) : "",
                is_basi_tarih: arac.is_basi_tarih ? String(arac.is_basi_tarih).slice(0, 10) : "",
                arac_yil: arac.arac_yil ?? "",
                dorse_yil: arac.dorse_yil ?? "",
            });

            setFormErrors({});
            setEditId(arac.id);
            setDuzenleAcik(true);
        },
        [canEdit, openSnack]
    );

    const handleKopyala = useCallback(
        (arac) => {
            if (!canCreate) return openSnack("Yeni araç ekleme yetkiniz yok.", "warning");
            if (!arac?.id || typeof arac.id !== "number") return openSnack("Bu kaydın DB ID'si yok. Kopyalama güvenli değil.", "warning");

            setForm({
                ...BOS_FORM,
                ...arac,
                plaka: "",
                cekici_ruhsat_no: "",
                dorse_ruhsat_no: "",
                gps_seri_no: "",
                gps_sim_kart_no: "",
                cekici_muayene: arac.cekici_muayene ? String(arac.cekici_muayene).slice(0, 10) : "",
                dorse_muayene: arac.dorse_muayene ? String(arac.dorse_muayene).slice(0, 10) : "",
                trafik_sigorta: arac.trafik_sigorta ? String(arac.trafik_sigorta).slice(0, 10) : "",
                is_basi_tarih: arac.is_basi_tarih ? String(arac.is_basi_tarih).slice(0, 10) : "",
            });

            setFormErrors({});
            setEditId(null);
            setDuzenleAcik(true);
        },
        [canCreate, openSnack]
    );

    const handleSubmit = useCallback(
        async (e) => {
            e?.preventDefault?.();
            const errs = validateForm(form);
            setFormErrors(errs);
            if (Object.keys(errs).length) return openSnack("Lütfen zorunlu alanları doldurun.", "warning");

            const kullanici = getMevcutKullanici();

            try {
                if (editId) {
                    const { error } = await supabase
                        .from("plakalar")
                        .update({
                            ...form,
                            guncelleyen_kullanici: kullanici,
                            guncellenen_alanlar: "güncellendi",
                            guncelleme_tarihi: turkiyeSaatISOString(),
                        })
                        .eq("id", editId);
                    if (error) throw error;
                    openSnack("Araç güncellendi");
                } else {
                    const { error } = await supabase.from("plakalar").insert([
                        { ...form, statu: "Aktif", ekleyen_kullanici: kullanici, eklenen_tarih: turkiyeSaatISOString() },
                    ]);
                    if (error) throw error;
                    openSnack("Araç eklendi");
                }

                temizleVeKapat();
                verileriGetir();
            } catch (err) {
                openSnack(err?.message || "İşlem başarısız", "error");
            }
        },
        [editId, form, openSnack, temizleVeKapat, verileriGetir, validateForm]
    );

    const handleSilIstegi = useCallback(
        (id) => {
            if (!canDelete) return openSnack("Silme yetkiniz yok.", "warning");
            if (!id || typeof id !== "number") return openSnack("Bu kaydın DB ID'si yok. Silinemez.", "error");

            setSeciliAracId(id);
            setSilmeSebebi("");
            setSilinmeTarihi(dayjs().format("YYYY-MM-DDTHH:mm"));
            setSilModalAcik(true);
        },
        [canDelete, openSnack]
    );

    const handleSilOnayla = useCallback(async () => {
        if (!canDelete) return openSnack("Silme yetkiniz yok.", "warning");
        if (!seciliAracId || typeof seciliAracId !== "number") return openSnack("Geçersiz ID. Silme iptal.", "error");
        if (!(silmeSebebi || "").trim() || !silinmeTarihi) return openSnack("Sebep ve tarih girin.", "warning");

        const kullanici = getMevcutKullanici();

        try {
            const { data, error } = await supabase
                .from("plakalar")
                .update({
                    statu: "ÇIKARILDI",
                    silme_sebebi: silmeSebebi,
                    silinme_tarihi: silinmeTarihi,
                    silen_kullanici: kullanici,
                })
                .eq("id", seciliAracId)
                .select();
            if (error) throw error;

            if (!data || data.length === 0) openSnack("Silme DB'de güncelleme yapmadı (policy/ID kontrol edin).", "warning");
            else openSnack("Araç çıkarıldı");

            setSilModalAcik(false);
            setSeciliAracId(null);
            verileriGetir();
        } catch (err) {
            openSnack(err?.message || "Silme işlemi başarısız", "error");
        }
    }, [canDelete, openSnack, seciliAracId, silinmeTarihi, silmeSebebi, verileriGetir]);

    const handleGeriAl = useCallback(
        async (id) => {
            if (!canEdit) return openSnack("Geri alma yetkiniz yok.", "warning");
            if (!id || typeof id !== "number") return openSnack("Geçersiz ID.", "error");

            const kullanici = getMevcutKullanici();

            try {
                const { data, error } = await supabase
                    .from("plakalar")
                    .update({
                        statu: "Aktif",
                        silme_sebebi: null,
                        silinme_tarihi: null,
                        silen_kullanici: null,
                        guncelleyen_kullanici: kullanici,
                        guncelleme_tarihi: turkiyeSaatISOString(),
                        guncellenen_alanlar: "çıkarılandan geri alındı",
                    })
                    .eq("id", id)
                    .select();

                if (error) throw error;

                if (!data || data.length === 0) openSnack("Geri alma DB'de güncelleme yapmadı (policy/ID kontrol edin).", "warning");
                else {
                    openSnack("Araç tekrar aktife alındı ✅");
                    setTab("aktif");
                }

                verileriGetir();
            } catch (err) {
                openSnack(err?.message || "Geri alma başarısız", "error");
            }
        },
        [canEdit, openSnack, verileriGetir]
    );

    const handleBilgiAc = useCallback((arac) => {
        setBilgiArac(arac);
        setBilgiModalAcik(true);
    }, []);

    /* ===================== Derived Lists ===================== */
    const araclar = useMemo(() => {
        let liste = [...tumAraclar];

        if (tab === "aktif") liste = liste.filter((a) => a.statu !== "ÇIKARILDI");
        if (tab === "pasif") liste = liste.filter((a) => a.statu === "ÇIKARILDI");

        const fBolge = safeLower(filters.bolge).trim();
        const fPlaka = safeLower(filters.plaka).trim();
        const fSurucu = safeLower(filters.surucu).trim();

        if (fBolge) liste = liste.filter((a) => safeLower(a.bolge).includes(fBolge));
        if (fPlaka) liste = liste.filter((a) => safeLower(a.plaka).includes(fPlaka));
        if (fSurucu) liste = liste.filter((a) => safeLower(a.surucu_adi).includes(fSurucu));

        const q = safeLower(debouncedSearch).trim();
        if (q) {
            liste = liste.filter((a) =>
                [
                    a.plaka,
                    a.surucu_adi,
                    a.surucu_telefon,
                    a.surucu_tc,
                    a.ikamet_adresi,
                    a.cekici_ruhsat_no,
                    a.dorse_ruhsat_no,
                    a.tedarikci_isim,
                    a.kira,
                    a.yakit,
                    a.izin_gun_sayisi,
                    a.cekici_muayene,
                    a.dorse_muayene,
                    a.trafik_sigorta,
                    a.arac_yil,
                    a.dorse_yil,
                    a.yakit_alim_firmasi,
                    a.bolge,
                    a.arac_tip,
                    a.is_basi_tarih,
                    a.dorse_tip,
                    a.dorse_yukseklik,
                    a.liftmaster,
                    a.sozlesme_durumu,
                    a.dingil,
                    a.gps_durum,
                    a.gps_sim_kart_no,
                    a.odak_k1,
                    a.gps_seri_no,
                    a.statu,
                    a.statu_ui,
                ]
                    .map((v) => safeLower(v))
                    .some((v) => v.includes(q))
            );
        }

        return liste;
    }, [tumAraclar, tab, debouncedSearch, filters]);

    const aktifSayisi = useMemo(() => tumAraclar.filter((a) => a.statu !== "ÇIKARILDI").length, [tumAraclar]);
    const pasifSayisi = useMemo(() => tumAraclar.filter((a) => a.statu === "ÇIKARILDI").length, [tumAraclar]);

    const rows = useMemo(() => araclar.map((a) => ({ id: a.id, ...a })), [araclar]);

    /* ===================== Excel ===================== */
    const excelAktar = useCallback(async () => {
        if (!araclar.length) return openSnack("Aktarılacak araç bulunamadı", "warning");

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${tab} Araçlar`);

        const headerMap = {
            plaka: "Plaka",
            surucu_adi: "Sürücü Adı",
            surucu_telefon: "Telefon",
            surucu_tc: "TC",
            ikamet_adresi: "İkamet Adresi",
            cekici_ruhsat_no: "Çekici Ruhsat No",
            dorse_ruhsat_no: "Dorse Ruhsat No",
            tedarikci_isim: "Tedarikçi",
            kira: "Kira",
            yakit: "Yakıt",
            izin_gun_sayisi: "İzin Gün Sayısı",
            cekici_muayene: "Çekici Muayene",
            dorse_muayene: "Dorse Muayene",
            trafik_sigorta: "Trafik Sigorta",
            arac_yil: "Araç Yıl",
            dorse_yil: "Dorse Yıl",
            yakit_alim_firmasi: "Yakıt Alım Firması",
            bolge: "Bölge",
            arac_tip: "Araç Tip",
            is_basi_tarih: "İş Başı Tarih",
            dorse_tip: "Dorse Tip",
            dorse_yukseklik: "Dorse Yükseklik",
            liftmaster: "Liftmaster",
            sozlesme_durumu: "Sözleşme Durumu",
            dingil: "Dingil",
            gps_durum: "GPS Durum",
            gps_sim_kart_no: "GPS Sim Kart No",
            odak_k1: "Odak K1",
            statu_export: "Statü",
        };

        worksheet.columns = Object.entries(headerMap).map(([key, header]) => ({
            header,
            key,
            width:
                ["ikamet_adresi", "yakit_alim_firmasi"].includes(key) ? 28 : key.includes("muayene") || key.includes("sigorta") ? 18 : 16,
        }));

        worksheet.addRows(
            araclar.map((a) => ({
                plaka: a.plaka ?? "",
                surucu_adi: a.surucu_adi ?? "",
                surucu_telefon: a.surucu_telefon ?? "",
                surucu_tc: a.surucu_tc ?? "",
                ikamet_adresi: a.ikamet_adresi ?? "",
                cekici_ruhsat_no: a.cekici_ruhsat_no ?? "",
                dorse_ruhsat_no: a.dorse_ruhsat_no ?? "",
                tedarikci_isim: a.tedarikci_isim ?? "",
                kira: a.kira ?? "",
                yakit: a.yakit ?? "",
                izin_gun_sayisi: a.izin_gun_sayisi ?? "",
                cekici_muayene: a.cekici_muayene ?? "",
                dorse_muayene: a.dorse_muayene ?? "",
                trafik_sigorta: a.trafik_sigorta ?? "",
                arac_yil: a.arac_yil ?? "",
                dorse_yil: a.dorse_yil ?? "",
                yakit_alim_firmasi: a.yakit_alim_firmasi ?? "",
                bolge: a.bolge ?? "",
                arac_tip: a.arac_tip ?? "",
                is_basi_tarih: a.is_basi_tarih ?? "",
                dorse_tip: a.dorse_tip ?? "",
                dorse_yukseklik: a.dorse_yukseklik ?? "",
                liftmaster: a.liftmaster ?? "",
                sozlesme_durumu: a.sozlesme_durumu ?? "",
                dingil: a.dingil ?? "",
                gps_durum: a.gps_durum ?? (a.gps_seri_no ? "AKTİF" : "YOK"),
                gps_sim_kart_no: a.gps_sim_kart_no ?? "",
                odak_k1: a.odak_k1 ?? "",
                statu_export: a.statu === "ÇIKARILDI" ? "ÇIKARILDI" : a.statu_ui || a.statu || "Aktif",
            }))
        );

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        saveAs(blob, `arac_listesi_${tab}.xlsx`);
    }, [araclar, openSnack, tab]);

    /* ===================== Columns (SENİN SIRAN) ===================== */
    const actionCol = useMemo(
        () => ({
            field: "__actions",
            headerName: "İşlem",
            sortable: false,
            filterable: false,
            width: 240,
            align: "right",
            renderCell: ({ row }) => {
                const hasDbId = !!row?.id && typeof row.id === "number";
                const isRemoved = row?.statu === "ÇIKARILDI";

                return (
                    <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ width: "100%" }}>
                        <Tooltip title="Bilgi">
                            <IconButton size="small" onClick={() => handleBilgiAc(row)}>
                                <InfoIcon fontSize="inherit" />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={canCreate ? "Kopyala" : "Yetkiniz yok"}>
                            <span>
                                <IconButton size="small" color="secondary" onClick={() => handleKopyala(row)} disabled={!canCreate || !hasDbId}>
                                    <ContentCopyIcon fontSize="inherit" />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Tooltip title={canEdit ? "Düzenle" : "Yetkiniz yok"}>
                            <span>
                                <IconButton size="small" onClick={() => handleDuzenle(row)} disabled={!canEdit || !hasDbId}>
                                    <EditIcon fontSize="inherit" />
                                </IconButton>
                            </span>
                        </Tooltip>

                        {isRemoved && (
                            <Tooltip title={canEdit ? "İşe Geri Al" : "Yetkiniz yok"}>
                                <span>
                                    <IconButton size="small" color="success" onClick={() => handleGeriAl(row.id)} disabled={!canEdit || !hasDbId}>
                                        <UndoIcon fontSize="inherit" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}

                        {!isRemoved && (
                            <Tooltip title={canDelete ? "Sil" : "Yetkiniz yok"}>
                                <span>
                                    <IconButton size="small" color="error" onClick={() => handleSilIstegi(row.id)} disabled={!canDelete || !hasDbId}>
                                        <DeleteIcon fontSize="inherit" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                    </Stack>
                );
            },
        }),
        [handleBilgiAc, handleDuzenle, handleKopyala, handleSilIstegi, handleGeriAl, canCreate, canEdit, canDelete]
    );

    const columns = useMemo(() => {
        const cols = [
            { field: "plaka", headerName: "Plaka", width: 130 },

            { field: "surucu_adi", headerName: "Sürücü", minWidth: 170, flex: 1 },
            { field: "surucu_telefon", headerName: "Telefon", width: 150 },
            { field: "surucu_tc", headerName: "TC", width: 140 },

            {
                field: "ikamet_adresi",
                headerName: "İkamet Adresi",
                minWidth: 240,
                flex: 1.3,
                renderCell: ({ value }) => (
                    <Tooltip title={value || ""} placement="top" arrow>
                        <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{value || "-"}</Box>
                    </Tooltip>
                ),
            },

            { field: "cekici_ruhsat_no", headerName: "Çekici Ruhsat", width: 160 },
            { field: "dorse_ruhsat_no", headerName: "Dorse Ruhsat", width: 160 },
            { field: "tedarikci_isim", headerName: "Tedarikçi", minWidth: 170, flex: 1 },

            { field: "kira", headerName: "Kira", width: 110 },
            { field: "yakit", headerName: "Yakıt", width: 110 },
            { field: "izin_gun_sayisi", headerName: "İzin Gün", width: 110 },

            { field: "cekici_muayene", headerName: "Çekici Muayene", width: 160, valueFormatter: (v) => fmtDate(v) },
            { field: "dorse_muayene", headerName: "Dorse Muayene", width: 160, valueFormatter: (v) => fmtDate(v) },
            { field: "trafik_sigorta", headerName: "Trafik Sigorta", width: 160, valueFormatter: (v) => fmtDate(v) },

            { field: "arac_yil", headerName: "Araç Yıl", width: 110 },
            { field: "dorse_yil", headerName: "Dorse Yıl", width: 110 },

            { field: "yakit_alim_firmasi", headerName: "Yakıt Alım Firması", minWidth: 200, flex: 1 },

            { field: "bolge", headerName: "Bölge", width: 130 },
            { field: "arac_tip", headerName: "Araç Tip", width: 140 },

            { field: "is_basi_tarih", headerName: "İş Başı Tarih", width: 150, valueFormatter: (v) => fmtDate(v) },

            { field: "dorse_tip", headerName: "Dorse Tip", width: 140 },
            { field: "dorse_yukseklik", headerName: "Dorse Yükseklik", width: 160 },
            { field: "liftmaster", headerName: "Liftmaster", width: 140 },

            { field: "sozlesme_durumu", headerName: "Sözleşme", width: 160 },
            { field: "dingil", headerName: "Dingil", width: 110 },

            {
                field: "gps_durum",
                headerName: "GPS Durum",
                width: 140,
                renderCell: ({ row }) => {
                    const isOk = (row?.gps_durum || (row?.gps_seri_no ? "AKTİF" : "YOK")) === "AKTİF";
                    return (
                        <Chip
                            size="small"
                            icon={<GpsIcon sx={{ fontSize: 16 }} />}
                            label={isOk ? "AKTİF" : "YOK"}
                            color={isOk ? "success" : "error"}
                            variant={isOk ? "filled" : "outlined"}
                            sx={{ fontWeight: 900 }}
                        />
                    );
                },
            },

            { field: "gps_sim_kart_no", headerName: "GPS Sim Kart No", width: 160 },

            { field: "odak_k1", headerName: "Odak K1", width: 140 },

            // İstersen statüyü de göstermek için aç:
            // { field: "statu_ui", headerName: "Statü", width: 220 },
        ];

        cols.push(actionCol);
        return cols;
    }, [actionCol]);

    /* ===================== UI ===================== */
    const clearFilters = () => setFilters({ bolge: "", plaka: "", surucu: "" });

    const activeFilterChips = useMemo(() => {
        const chips = [];
        if (filters.bolge) chips.push({ k: "bolge", label: `Bölge: ${filters.bolge}` });
        if (filters.plaka) chips.push({ k: "plaka", label: `Plaka: ${filters.plaka}` });
        if (filters.surucu) chips.push({ k: "surucu", label: `Sürücü: ${filters.surucu}` });
        return chips;
    }, [filters]);

    return (
        <ThemeProvider theme={theme}>
            <ScaleToFit>
                <Helmet>
                    <title>ARAÇ YÖNETİMİ</title>
                </Helmet>

                <Stack spacing={2} sx={{ height: "100%" }}>
                    {/* APP BAR */}
                    <AppBar
                        position="static"
                        color="transparent"
                        elevation={0}
                        sx={{
                            borderRadius: 3,
                            ...glass(0.95, 0.82),
                            backgroundImage: "linear-gradient(90deg, rgba(139,92,246,0.24), rgba(34,211,238,0.20))",
                            borderBottom: "2px solid rgba(139,92,246,0.25)",
                        }}
                    >
                        <Toolbar disableGutters sx={{ px: 2 }}>
                            <Typography
                                variant="h5"
                                sx={{
                                    flexGrow: 1,
                                    fontWeight: 950,
                                    background: "linear-gradient(90deg,#E879F9,#22D3EE)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    letterSpacing: 0.4,
                                    userSelect: "none",
                                }}
                            >
                                🚚 Araç Filosu Yönetimi
                            </Typography>

                            <Stack direction="row" spacing={1} alignItems="center">
                                <Tooltip title="Yenile">
                                    <span>
                                        <IconButton onClick={verileriGetir} disabled={loading} color="secondary">
                                            {loading ? <CircularProgress size={20} color="secondary" /> : <RefreshIcon />}
                                        </IconButton>
                                    </span>
                                </Tooltip>

                                <Button onClick={() => setDrawerOpen(true)} variant="outlined" startIcon={<FilterListIcon />} size="small" color="secondary">
                                    Filtre
                                </Button>

                                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={excelAktar} size="small">
                                    Excel
                                </Button>

                                <Tooltip title={canCreate ? "Yeni araç" : "Yetkiniz yok"}>
                                    <span>
                                        <Button
                                            variant="contained"
                                            startIcon={<AddIcon />}
                                            onClick={handleYeniEkle}
                                            disabled={!canCreate}
                                            size="small"
                                            color="success"
                                            sx={{ boxShadow: "0 10px 22px rgba(16,185,129,0.22)" }}
                                        >
                                            Yeni
                                        </Button>
                                    </span>
                                </Tooltip>

                                <SubtleDivider orientation="vertical" flexItem sx={{ mx: 1, height: 28 }} />

                                <Tooltip title="Geri">
                                    <IconButton size="small" onClick={() => navigate(-1)}>
                                        <ArrowBackIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Anasayfa">
                                    <IconButton size="small" onClick={() => navigate(HOME_PATH)}>
                                        <HomeIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Toolbar>
                    </AppBar>

                    {/* KPI */}
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Section title="AKTİF ARAÇLAR" right={<Chip icon={<CheckIcon />} label="Aktif" size="small" color="success" />}>
                                <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 950, color: currentTheme.palette.success.light }}>
                                    {aktifSayisi}
                                </Typography>
                            </Section>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Section title="ÇIKARILAN ARAÇLAR" right={<Chip icon={<RemovedIcon />} label="Pasif" color="error" variant="outlined" size="small" />}>
                                <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 950, color: currentTheme.palette.error.light }}>
                                    {pasifSayisi}
                                </Typography>
                            </Section>
                        </Grid>
                    </Grid>

                    {/* Kontroller */}
                    <Paper
                        sx={{
                            p: 2,
                            borderRadius: 3,
                            ...glass(0.12, 0.05),
                            border: "1px solid rgba(255,255,255,0.10)",
                            boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
                        }}
                    >
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={6}>
                                <Tabs
                                    value={tab}
                                    onChange={(_, v) => setTab(v)}
                                    sx={{
                                        "& .MuiTab-root": { fontWeight: 950, minHeight: 40, borderRadius: 2, mr: 1, px: 2, transition: "all .2s" },
                                        "& .Mui-selected": { backgroundColor: alpha("#ffffff", 0.08), color: currentTheme.palette.primary.light },
                                        "& .MuiTabs-indicator": { height: 3, borderRadius: 1, bgcolor: currentTheme.palette.primary.main },
                                    }}
                                >
                                    <Tab
                                        value="aktif"
                                        label={
                                            <Badge color="success" variant="dot" invisible={aktifSayisi === 0}>
                                                <Box sx={{ px: 0.5 }}>Aktif</Box>
                                            </Badge>
                                        }
                                    />
                                    <Tab
                                        value="pasif"
                                        label={
                                            <Badge color="error" variant="dot" invisible={pasifSayisi === 0}>
                                                <Box sx={{ px: 0.5 }}>Çıkarılan</Box>
                                            </Badge>
                                        }
                                    />
                                    <Tab value="tum" label="Tümü" />
                                </Tabs>

                                <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
                                    <ToggleButtonGroup size="small" value={density} exclusive onChange={(_, v) => v && setDensity(v)}>
                                        <ToggleButton value="compact">
                                            <CompactIcon sx={{ fontSize: 18, mr: 0.6 }} /> Sıkı
                                        </ToggleButton>
                                        <ToggleButton value="standard">
                                            <ComfyIcon sx={{ fontSize: 18, mr: 0.6 }} /> Rahat
                                        </ToggleButton>
                                    </ToggleButtonGroup>

                                    <Chip
                                        icon={<TableIcon />}
                                        size="small"
                                        label="Kolon sırası: Güncel"
                                        variant="outlined"
                                        sx={{ opacity: 0.85, borderColor: alpha("#ffffff", 0.18) }}
                                    />
                                </Stack>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    value={globalSearch}
                                    onChange={(e) => setGlobalSearch(e.target.value)}
                                    placeholder="Genel arama: plaka, sürücü, ruhsat, tedarikçi, GPS..."
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon color="secondary" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: globalSearch ? (
                                            <InputAdornment position="end">
                                                <IconButton onClick={() => setGlobalSearch("")} size="small">
                                                    <ClearIcon fontSize="small" />
                                                </IconButton>
                                            </InputAdornment>
                                        ) : null,
                                        sx: {
                                            borderRadius: 2,
                                            backgroundColor: alpha("#ffffff", 0.04),
                                            border: "1px solid " + alpha("#ffffff", 0.08),
                                        },
                                    }}
                                />

                                {activeFilterChips.length > 0 && (
                                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                                        {activeFilterChips.map((c) => (
                                            <Chip
                                                key={c.k}
                                                label={c.label}
                                                onDelete={() => setFilters((f) => ({ ...f, [c.k]: "" }))}
                                                variant="filled"
                                                size="small"
                                                color="primary"
                                                sx={{ opacity: 0.9, bgcolor: alpha(currentTheme.palette.primary.main, 0.16), fontWeight: 900 }}
                                            />
                                        ))}
                                        <Button size="small" onClick={clearFilters} startIcon={<ClearIcon />} sx={{ color: currentTheme.palette.error.light, fontWeight: 900 }}>
                                            Temizle
                                        </Button>
                                    </Stack>
                                )}
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* GRID */}
                    <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                        <Paper
                            sx={{
                                height: "100%",
                                borderRadius: 3,
                                overflow: "hidden",
                                background: "transparent",
                                border: "1px solid rgba(255,255,255,0.08)",
                                display: "flex",
                                flexDirection: "column",
                                boxShadow: "0 22px 60px rgba(0,0,0,0.35)",
                            }}
                        >
                            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                                <Box sx={{ minWidth: 2600, height: "100%" }}>
                                    <DataGrid
                                        rows={rows}
                                        columns={columns}
                                        getRowId={(r) => r.id}
                                        density={density}
                                        rowHeight={density === "compact" ? 42 : 52}
                                        columnHeaderHeight={50}
                                        disableRowSelectionOnClick
                                        pagination={false}
                                        hideFooter
                                        loading={loading}
                                        slots={{
                                            toolbar: GridToolbar,
                                            noRowsOverlay: () => <EmptyState />,
                                            noResultsOverlay: () => <EmptyState title="Sonuç yok" caption="Arama/filtreleri kontrol edin." />,
                                            loadingOverlay: () => (
                                                <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
                                                    <CircularProgress />
                                                </Stack>
                                            ),
                                        }}
                                        slotProps={{
                                            toolbar: {
                                                showQuickFilter: true,
                                                quickFilterProps: { debounceMs: 300 },
                                                printOptions: { disableToolbarButton: true },
                                            },
                                        }}
                                        getRowClassName={(params) => {
                                            const isRemoved = params.row?.statu === "ÇIKARILDI";
                                            const label = params.row?.statu_ui || params.row?.statu || "";
                                            if (isRemoved) return "row-removed";
                                            if (/kesintiden/.test(label)) return "row-warning";
                                            return "";
                                        }}
                                        sx={{
                                            border: "none",
                                            height: "100%",
                                            fontSize: 14,

                                            "& .MuiDataGrid-virtualScroller": { background: "rgba(255,255,255,0.015)" },
                                            "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": { outline: "none" },

                                            [`& .${gridClasses.columnHeaders}`]: {
                                                position: "sticky",
                                                top: 0,
                                                zIndex: 1,
                                                background: "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.72) 100%)",
                                                borderBottomColor: "rgba(255,255,255,0.10)",
                                                fontWeight: 950,
                                                fontSize: 15,
                                            },

                                            "& .MuiDataGrid-toolbarContainer": {
                                                px: 1.5,
                                                py: 1,
                                                borderBottom: "1px solid rgba(255,255,255,0.08)",
                                                background: "rgba(255,255,255,0.02)",
                                                backdropFilter: "blur(10px)",
                                            },

                                            "& .MuiDataGrid-row:nth-of-type(2n) .MuiDataGrid-cell": { backgroundColor: "rgba(255,255,255,0.02)" },
                                            "& .MuiDataGrid-row:hover .MuiDataGrid-cell": {
                                                backgroundColor: alpha(currentTheme.palette.primary.main, 0.14),
                                                transition: "background-color 120ms ease",
                                            },

                                            "& .MuiDataGrid-cell": { borderBottomColor: "rgba(255,255,255,0.06)", py: 0.5 },
                                            "& .row-removed .MuiDataGrid-cell": { backgroundColor: alpha("#ef4444", 0.08) },
                                            "& .row-warning .MuiDataGrid-cell": { backgroundColor: alpha("#f59e0b", 0.08) },
                                        }}
                                    />
                                </Box>
                            </Box>
                        </Paper>
                    </Box>
                </Stack>

                {/* Drawer: Filtre */}
                <Drawer
                    anchor="right"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    PaperProps={{
                        sx: {
                            width: 380,
                            background: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.85) 100%)",
                            backdropFilter: "blur(8px)",
                            borderLeft: "1px solid rgba(255,255,255,0.08)",
                            p: 2.5,
                        },
                    }}
                >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="h5" fontWeight={950}>
                            Detaylı Filtreler
                        </Typography>
                        <IconButton onClick={() => setDrawerOpen(false)} color="secondary">
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                    <SubtleDivider />
                    <Stack spacing={2.5}>
                        <TextField label="Bölge" value={filters.bolge} onChange={(e) => setFilters((f) => ({ ...f, bolge: e.target.value }))} size="small" />
                        <TextField label="Plaka" value={filters.plaka} onChange={(e) => setFilters((f) => ({ ...f, plaka: e.target.value }))} size="small" />
                        <TextField label="Sürücü" value={filters.surucu} onChange={(e) => setFilters((f) => ({ ...f, surucu: e.target.value }))} size="small" />
                        <Stack direction="row" spacing={1}>
                            <Button variant="outlined" startIcon={<ClearIcon />} onClick={clearFilters} color="error" fullWidth>
                                Temizle
                            </Button>
                            <Button variant="contained" onClick={() => setDrawerOpen(false)} color="secondary" fullWidth>
                                Uygula
                            </Button>
                        </Stack>
                    </Stack>
                </Drawer>

                {/* Drawer: Ekle/Düzenle */}
                <Drawer
                    anchor="right"
                    open={duzenleAcik}
                    onClose={temizleVeKapat}
                    PaperProps={{ sx: { width: { xs: "90%", md: 980 }, ...glass(0.95, 0.92), p: 3, borderLeft: "1px solid rgba(255,255,255,0.10)" } }}
                >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="h6" fontWeight={950}>
                            {editId ? "Araç Güncelle" : "Yeni Araç"}
                        </Typography>
                        <IconButton onClick={temizleVeKapat} color="secondary">
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                    <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.10)" }} />

                    <Box component="form" id="arac-form" onSubmit={handleSubmit} sx={{ flexGrow: 1, overflowY: "auto", pr: 1 }}>
                        <Grid container spacing={2.5}>
                            {[
                                { name: "plaka", label: "Plaka", required: true, err: formErrors.plaka },
                                { name: "surucu_adi", label: "Sürücü" },
                                { name: "surucu_telefon", label: "Telefon", err: formErrors.surucu_telefon },
                                { name: "surucu_tc", label: "TC" },
                                { name: "ikamet_adresi", label: "İkamet Adresi" },
                                { name: "cekici_ruhsat_no", label: "Çekici Ruhsat No" },
                                { name: "dorse_ruhsat_no", label: "Dorse Ruhsat No" },
                                { name: "tedarikci_isim", label: "Tedarikçi" },
                                { name: "kira", label: "Kira" },
                                { name: "yakit", label: "Yakıt" },
                                { name: "izin_gun_sayisi", label: "İzin Gün Sayısı", type: "number" },
                            ].map((f) => (
                                <Grid key={f.name} item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        name={f.name}
                                        value={form[f.name] ?? ""}
                                        onChange={handleChange}
                                        label={f.label}
                                        required={!!f.required}
                                        error={!!f.err}
                                        helperText={f.err || " "}
                                        type={f.type}
                                        size="small"
                                    />
                                </Grid>
                            ))}

                            {[
                                { name: "cekici_muayene", label: "Çekici Muayene", type: "date" },
                                { name: "dorse_muayene", label: "Dorse Muayene", type: "date" },
                                { name: "trafik_sigorta", label: "Trafik Sigorta", type: "date" },
                                { name: "is_basi_tarih", label: "İş Başı Tarih", type: "date" },
                            ].map((f) => (
                                <Grid key={f.name} item xs={12} md={3}>
                                    <TextField
                                        fullWidth
                                        type={f.type}
                                        name={f.name}
                                        value={form[f.name] ?? ""}
                                        onChange={handleChange}
                                        label={f.label}
                                        InputLabelProps={{ shrink: true }}
                                        size="small"
                                    />
                                </Grid>
                            ))}

                            {[
                                { name: "arac_yil", label: "Araç Yıl", type: "number" },
                                { name: "dorse_yil", label: "Dorse Yıl", type: "number" },
                                { name: "yakit_alim_firmasi", label: "Yakıt Alım Firması" },
                                { name: "bolge", label: "Bölge" },
                                { name: "arac_tip", label: "Araç Tip" },
                                { name: "dorse_tip", label: "Dorse Tip" },
                                { name: "dorse_yukseklik", label: "Dorse Yükseklik" },
                                { name: "liftmaster", label: "Liftmaster" },
                                { name: "sozlesme_durumu", label: "Sözleşme Durumu" },
                                { name: "dingil", label: "Dingil" },
                                { name: "gps_durum", label: "GPS Durum" },
                                { name: "gps_seri_no", label: "GPS Seri No" },
                                { name: "gps_sim_kart_no", label: "GPS Sim Kart No" },
                                { name: "odak_k1", label: "Odak K1" },
                            ].map((f) => (
                                <Grid key={f.name} item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        name={f.name}
                                        value={form[f.name] ?? ""}
                                        onChange={handleChange}
                                        label={f.label}
                                        type={f.type}
                                        InputLabelProps={f.type === "date" ? { shrink: true } : undefined}
                                        size="small"
                                    />
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    <Box sx={{ pt: 2, mt: 2, display: "flex", justifyContent: "flex-end", gap: 1.5, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                        <Button onClick={temizleVeKapat} variant="outlined" size="large">
                            İptal
                        </Button>
                        <Button type="submit" form="arac-form" variant="contained" size="large" color={editId ? "primary" : "success"} sx={{ px: 4, py: 1.2, fontWeight: 950 }}>
                            {editId ? "Güncelle" : "Kaydet"}
                        </Button>
                    </Box>
                </Drawer>

                {/* Sil Modal */}
                <Dialog open={silModalAcik} onClose={() => setSilModalAcik(false)}>
                    <DialogTitle sx={{ color: currentTheme.palette.error.main, fontWeight: 950 }}>⚠️ Araç Çıkarılıyor</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField label="Silme sebebi (Zorunlu)" value={silmeSebebi} onChange={(e) => setSilmeSebebi(e.target.value)} fullWidth multiline rows={2} required />
                            <TextField label="Çıkarılma Tarihi" type="datetime-local" value={silinmeTarihi} onChange={(e) => setSilinmeTarihi(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} required />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleSilOnayla} variant="contained" color="error" disabled={!(silmeSebebi || "").trim()}>
                            Onayla
                        </Button>
                        <Button onClick={() => setSilModalAcik(false)} variant="text">
                            İptal
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Bilgi Modal */}
                <Dialog open={bilgiModalAcik} onClose={() => setBilgiModalAcik(false)} maxWidth="md" fullWidth>
                    <DialogTitle>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="h6" fontWeight={950}>
                                Araç Detay
                            </Typography>
                            <IconButton onClick={() => setBilgiModalAcik(false)} color="secondary">
                                <CloseIcon />
                            </IconButton>
                        </Stack>
                    </DialogTitle>
                    <DialogContent dividers>
                        {bilgiArac ? (
                            <Grid container spacing={2}>
                                {[
                                    ["Plaka", bilgiArac.plaka],
                                    ["Sürücü", bilgiArac.surucu_adi || "-"],
                                    ["Telefon", bilgiArac.surucu_telefon || "-"],
                                    ["TC", bilgiArac.surucu_tc || "-"],
                                    ["İkamet", bilgiArac.ikamet_adresi || "-"],
                                    ["Tedarikçi", bilgiArac.tedarikci_isim || "-"],
                                    ["Bölge", bilgiArac.bolge || "-"],
                                    ["Araç Tip", bilgiArac.arac_tip || "-"],
                                    ["GPS Durum", bilgiArac.gps_durum || (bilgiArac.gps_seri_no ? "AKTİF" : "YOK")],
                                    ["Statü", bilgiArac.statu === "ÇIKARILDI" ? "ÇIKARILDI" : bilgiArac.statu_ui || bilgiArac.statu || "-"],
                                ].map(([k, v]) => (
                                    <Grid key={k} item xs={12} md={4}>
                                        <Typography variant="body2">
                                            <b>{k}:</b> {v}
                                        </Typography>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Typography>Bilgi yok</Typography>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setBilgiModalAcik(false)} variant="contained" color="secondary">
                            Kapat
                        </Button>
                    </DialogActions>
                </Dialog>

                <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                    <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ width: "100%", borderRadius: 2 }}>
                        {snack.msg}
                    </Alert>
                </Snackbar>
            </ScaleToFit>
        </ThemeProvider>
    );
}
