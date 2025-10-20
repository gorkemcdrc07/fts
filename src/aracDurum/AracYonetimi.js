// src/pages/AracYonetimiMUI.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
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
    useTheme,
    ThemeProvider,
    createTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
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
} from "@mui/icons-material";

import { DataGrid, GridToolbar, gridClasses } from "@mui/x-data-grid";

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

// Karanlık Tema Tanımı
const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#8B5CF6' }, // Mor
        secondary: { main: '#22D3EE' }, // Açık Mavi
        background: { default: '#02040C', paper: '#0F172A' },
        success: { main: '#10B981' },
        error: { main: '#F43F5E' },
        warning: { main: '#FBBF24' },
    },
    typography: {
        fontFamily: 'Inter, sans-serif',
        button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    ...glass(0.9, 0.8),
                    borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.1)',
                },
            },
        },
    },
});

/* ===================== Ölçekleme: Zoom'dan Bağımsız ===================== */
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

function ScaleToFit({ children }) {
    const scale = useScaleToFit();

    return (
        <Box
            sx={{
                width: "100dvw",
                height: "100dvh",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
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

/* ===================== Util Fonksiyonlar ===================== */
const BOS_FORM = {
    plaka: "",
    treyler: "",
    surucu_adi: "",
    surucu_telefon: "",
    surucu_tc: "",
    ikamet_adresi: "",
    cekici_ruhsat_no: "",
    dorse_ruhsat_no: "",
    tedarikci_isim: "",
    cekici_muayene: "",
    dorse_muayene: "",
    trafik_sigorta: "",
    arac_yil: "",
    dorse_yil: "",
    bolge: "",
    arac_tip: "",
    dorse_tip: "",
    liftmaster: "",
    gps_seri_no: "",
    gps_sim_kart_no: "",
    odak_k1: "",
};

const getMevcutKullanici = () => localStorage.getItem("kullanici") || "Bilinmeyen Kullanıcı";

const tespitEtDegisenAlanlar = (eski, yeni) => {
    const farklar = [];
    for (const key in yeni) {
        if ((eski && eski[key]) !== (yeni && yeni[key])) farklar.push(key);
    }
    return farklar.join(", ");
};

function turkiyeSaatISOString() {
    const turkiyeSaati = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return turkiyeSaati.toISOString();
}

function safeLower(v) {
    return (v ?? "").toString().toLowerCase();
}

// localStorage helper
function useLocalStorage(key, initial) {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : initial;
        } catch {
            return initial;
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch { }
    }, [key, value]);
    return [value, setValue];
}

// debounce hook
function useDebounced(value, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

/* ===================== ►►► YETKİ ◄◄◄ ===================== */
const SCREEN_KEY = "arac_yonetimi"; // Bu sayfa için screen_key
const ROLE_NAME_TO_KEY = { "YÖNETİCİ": "YONETICI", "OPERASYON": "OPERASYON", "TAKİP": "TAKIP" };

/** create/edit/delete için bool döndürür */
async function fetchAracPerms() {
    const kullaniciId = parseInt(localStorage.getItem("kullaniciId"));
    if (!kullaniciId) return { canCreate: false, canEdit: false, canDelete: false };

    // 1) USER OVERRIDE (user_permissions: AYON_* kolonları, screen_key YOK)
    const { data: up } = await supabase
        .from("user_permissions")
        .select("ayon_create, ayon_edit, ayon_delete")
        .eq("user_id", kullaniciId)
        .maybeSingle();

    const userHasAny =
        up && (typeof up?.ayon_create === "boolean" || typeof up?.ayon_edit === "boolean" || typeof up?.ayon_delete === "boolean");

    if (userHasAny) {
        return {
            canCreate: !!up?.ayon_create,
            canEdit: !!up?.ayon_edit,
            canDelete: !!up?.ayon_delete,
        };
    }

    // 2) ROLE INHERIT (role_permissions: generic ARCDUR_* kolonları + screen_key='arac_yonetimi')
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

    if (rp && (typeof rp.arcdur_create === "boolean" || typeof rp.arcdur_edit === "boolean" || typeof rp.arcdur_delete === "boolean")) {
        return {
            canCreate: !!rp?.arcdur_create,
            canEdit: !!rp?.arcdur_edit,
            canDelete: !!rp?.arcdur_delete,
        };
    }

    // Eski şema fallback (screen_key olmadan)
    const { data: rp2 } = await supabase
        .from("role_permissions")
        .select("arcdur_create, arcdur_edit, arcdur_delete")
        .eq("role_id", role.id)
        .maybeSingle();

    return {
        canCreate: !!rp2?.arcdur_create,
        canEdit: !!rp2?.arcdur_edit,
        canDelete: !!rp2?.arcdur_delete,
    };
}

/* ===================== Yardımcı Bileşenler ===================== */
function SubtleDivider({ sx, orientation = 'horizontal', flexItem = false }) {
    return <Divider orientation={orientation} flexItem={flexItem} sx={{ my: orientation === 'horizontal' ? 1.5 : 0, borderColor: "rgba(255,255,255,0.08)", ...sx }} />;
}

function EmptyState({ title = "Kayıt bulunamadı", caption = "Filtreleri değiştirerek tekrar deneyin." }) {
    return (
        <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", py: 6 }}>
            <Box
                sx={{
                    width: 84,
                    height: 84,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: alpha("#22D3EE", 0.1),
                    border: "1px solid " + alpha("#22D3EE", 0.3),
                    mb: 2,
                }}
            >
                <CarIcon />
            </Box>
            <Typography variant="h6" sx={{ opacity: 0.9, mb: 0.5 }}>
                {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {caption}
            </Typography>
        </Stack>
    );
}

function Section({ title, right, sx, children }) {
    return (
        <Paper sx={{ p: 2, borderRadius: 2, ...glass(0.08, 0.02), ...sx }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ letterSpacing: 0.3, opacity: 0.85 }}>
                    {title}
                </Typography>
                {right}
            </Stack>
            {children}
        </Paper>
    );
}

/* ===================== Ana Bileşen ===================== */
export default function AracYonetimiMUI() {
    const navigate = useNavigate();
    const currentTheme = useTheme(); // Temayı kullanmak için

    const [tumAraclar, setTumAraclar] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useLocalStorage("aracTab", "aktif");
    const [globalSearch, setGlobalSearch] = useLocalStorage("aracSearch", "");
    const debouncedSearch = useDebounced(globalSearch, 250);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // DataGrid kalıcılık
    const [density, setDensity] = useLocalStorage("aracGridDensity", "compact"); // compact/standard/comfortable
    const [colVis, setColVis] = useLocalStorage("aracColVis", {});
    const [pinnedCols, setPinnedCols] = useLocalStorage("aracPinned", { left: ["plaka", "treyler", "surucu_adi"], right: ["__actions"] });

    // Detaylı filtreler
    const FILTER_DEFAULTS = { bolge: "", plaka: "", surucu: "" };
    const [filters, setFilters] = useLocalStorage("aracFilters", FILTER_DEFAULTS);
    useEffect(() => {
        setFilters((f) => ({ ...FILTER_DEFAULTS, ...(f || {}) }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const clearFilters = () => setFilters(FILTER_DEFAULTS);

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
    const [izinBilgisi, setIzinBilgisi] = useState(null);
    const [kesintiBilgisi, setKesintiBilgisi] = useState(null);

    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
    const openSnack = useCallback((msg, severity = "success") => setSnack({ open: true, msg, severity }), []);
    const mountedRef = useRef(true);
    useEffect(() => () => { mountedRef.current = false; }, []);

    // ► YETKİ
    const [canCreate, setCanCreate] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [canDelete, setCanDelete] = useState(false);

    // =============================================================
    // FONKSİYON TANIMLARI (TÜM useEffect ve Diğer Fonksiyonlardan önce)
    // =============================================================

    const verileriGetir = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from("plakalar").select("*").order("id", { ascending: false });

            const bugun = new Date();
            const guncelData = (data || []).map((arac) => {
                if (arac.kesinti_bitis_tarihi) {
                    const bitis = new Date(arac.kesinti_bitis_tarihi);
                    if (bitis < bugun) {
                        const farkGun = Math.floor((+bugun - +bitis) / (1000 * 60 * 60 * 24));
                        return { ...arac, statu: `${farkGun} gün kesintiden yeni çıktı` };
                    }
                }
                return arac;
            });

            setTumAraclar(guncelData);
        } catch (err) {
            openSnack(`Veriler alınamadı: ${err?.message || err}`, "error");
            setTumAraclar([]);
        } finally {
            setLoading(false);
        }
    }, [openSnack]);

    const temizleVeKapat = useCallback(() => {
        setForm(BOS_FORM);
        setFormErrors({});
        setEditId(null);
        setDuzenleAcik(false);
    }, []);

    const handleYeniEkle = useCallback(() => {
        if (!canCreate) {
            openSnack("Yeni araç ekleme yetkiniz yok.", "warning");
            return;
        }
        setForm(BOS_FORM);
        setFormErrors({});
        setEditId(null);
        setDuzenleAcik(true);
    }, [canCreate, openSnack]);

    const validateForm = useCallback((f) => {
        const errs = {};
        if (!f.plaka?.trim()) errs.plaka = "Plaka zorunludur.";
        if (!f.cekici_muayene) errs.cekici_muayene = "Tarih gerekli";
        if (!f.dorse_muayene) errs.dorse_muayene = "Tarih gerekli";
        if (!f.trafik_sigorta) errs.trafik_sigorta = "Tarih gerekli";
        if (f.surucu_telefon && !/^\+?\d[\d\s-]{7,}$/.test(f.surucu_telefon)) {
            errs.surucu_telefon = "Telefon formatını kontrol edin.";
        }
        return errs;
    }, []);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: value }));
    }, []);

    const handleSubmit = useCallback(
        async (e) => {
            e?.preventDefault?.();
            const kullanici = getMevcutKullanici();

            const errs = validateForm(form);
            setFormErrors(errs);
            if (Object.keys(errs).length) {
                openSnack("Lütfen zorunlu alanları doldurun.", "warning");
                return;
            }

            if (editId) {
                if (!canEdit) {
                    openSnack("Düzenleme yetkiniz yok.", "warning");
                    return;
                }
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

                if (!error) {
                    openSnack("Araç güncellendi");
                    temizleVeKapat();
                    verileriGetir();
                } else openSnack("Güncelleme başarısız", "error");
            } else {
                if (!canCreate) {
                    openSnack("Yeni araç ekleme yetkiniz yok.", "warning");
                    return;
                }
                const { error } = await supabase.from("plakalar").insert([
                    {
                        ...form,
                        statu: "Aktif",
                        ekleyen_kullanici: kullanici,
                        eklenen_tarih: turkiyeSaatISOString(),
                    },
                ]);
                if (!error) {
                    openSnack("Araç eklendi");
                    temizleVeKapat();
                    verileriGetir();
                } else openSnack("Ekleme başarısız", "error");
            }
        },
        [editId, form, openSnack, temizleVeKapat, tumAraclar, verileriGetir, validateForm, canCreate, canEdit]
    );

    // =============================================================
    // USEEFFECT HOOKLARI (Tüm fonksiyon tanımlarından sonra)
    // =============================================================

    // Login kontrolü
    useEffect(() => {
        const kullanici = localStorage.getItem("kullanici");
        if (!kullanici) navigate("/login");
    }, [navigate]);

    // İlk yükleme: veri + yetkiler
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

    // Klavye kısayolları
    useEffect(() => {
        const onKey = (e) => {
            const isMac = navigator.platform.toUpperCase().includes("MAC");
            const metaK = (isMac && e.metaKey && e.key.toLowerCase() === "k") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "k");
            if (metaK) {
                e.preventDefault();
                const el = document.getElementById("global-search-input");
                el?.focus();
                el?.select();
            }
            if (e.key.toLowerCase() === "n") canCreate && handleYeniEkle(); // ARTIK ERİŞİLEBİLİR
            if (e.key.toLowerCase() === "r") verileriGetir();
            if (e.key === "/") {
                const quick = document.querySelector('input[placeholder*="Quick filter"]');
                quick?.focus();
                e.preventDefault();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [canCreate, verileriGetir, handleYeniEkle]);

    // =============================================================
    // KALAN KISIMLAR
    // =============================================================


    // Filtrelenmiş liste
    const araclar = useMemo(() => {
        let liste = [...tumAraclar];

        if (tab === "aktif") liste = liste.filter((a) => a.statu !== "ÇIKARILDI");
        if (tab === "pasif") liste = liste.filter((a) => a.statu === "ÇIKARILDI");

        const fBolge = safeLower(filters?.bolge).trim();
        const fPlaka = safeLower(filters?.plaka).trim();
        const fSurucu = safeLower(filters?.surucu).trim();

        if (fBolge) liste = liste.filter((a) => safeLower(a.bolge).includes(fBolge));
        if (fPlaka) liste = liste.filter((a) => safeLower(a.plaka).includes(fPlaka));
        if (fSurucu) liste = liste.filter((a) => safeLower(a.surucu_adi).includes(fSurucu));

        const q = safeLower(debouncedSearch).trim();
        if (q) {
            liste = liste.filter((a) =>
                [
                    a.plaka,
                    a.treyler,
                    a.surucu_adi,
                    a.surucu_telefon,
                    a.surucu_tc,
                    a.ikamet_adresi,
                    a.cekici_ruhsat_no,
                    a.dorse_ruhsat_no,
                    a.tedarikci_isim,
                    a.bolge,
                    a.arac_tip,
                    a.dorse_tip,
                    a.liftmaster,
                    a.gps_seri_no,
                    a.gps_sim_kart_no,
                    a.odak_k1,
                    a.statu,
                ]
                    .map((v) => safeLower(v))
                    .some((v) => v.includes(q))
            );
        }
        return liste;
    }, [tumAraclar, tab, debouncedSearch, filters]);

    const aktifSayisi = useMemo(() => tumAraclar.filter((a) => a.statu !== "ÇIKARILDI").length, [tumAraclar]);
    const pasifSayisi = useMemo(() => tumAraclar.filter((a) => a.statu === "ÇIKARILDI").length, [tumAraclar]);

    const handleDuzenle = useCallback(
        (arac) => {
            if (!canEdit) {
                openSnack("Düzenleme yetkiniz yok.", "warning");
                return;
            }
            if (!arac?.id) return openSnack("HATA: Bu aracın ID bilgisi eksik.", "error");
            setForm({
                plaka: arac.plaka || "",
                treyler: arac.treyler || "",
                surucu_adi: arac.surucu_adi || "",
                surucu_telefon: arac.surucu_telefon || "",
                surucu_tc: arac.surucu_tc || "",
                ikamet_adresi: arac.ikamet_adresi || "",
                cekici_ruhsat_no: arac.cekici_ruhsat_no || "",
                dorse_ruhsat_no: arac.dorse_ruhsat_no || "",
                tedarikci_isim: arac.tedarikci_isim || "",
                cekici_muayene: arac.cekici_muayene || "",
                dorse_muayene: arac.dorse_muayene || "",
                trafik_sigorta: arac.trafik_sigorta || "",
                arac_yil: arac.arac_yil || "",
                dorse_yil: arac.dorse_yil || "",
                bolge: arac.bolge || "",
                arac_tip: arac.arac_tip || "",
                dorse_tip: arac.dorse_tip || "",
                liftmaster: arac.liftmaster || "",
                gps_seri_no: arac.gps_seri_no || "",
                gps_sim_kart_no: arac.gps_sim_kart_no || "",
                odak_k1: arac.odak_k1 || "",
            });
            setFormErrors({});
            setEditId(arac.id);
            setDuzenleAcik(true);
        },
        [openSnack, canEdit]
    );

    const handleSilIstegi = useCallback(
        (id) => {
            if (!canDelete) {
                openSnack("Silme yetkiniz yok.", "warning");
                return;
            }
            setSeciliAracId(id);
            setSilmeSebebi("");
            setSilinmeTarihi(turkiyeSaatISOString().slice(0, 16));
            setSilModalAcik(true);
        },
        [canDelete, openSnack]
    );

    const handleSilOnayla = useCallback(async () => {
        if (!canDelete) {
            openSnack("Silme yetkiniz yok.", "warning");
            return;
        }
        if (!(silmeSebebi || "").trim() || !silinmeTarihi) {
            openSnack("Lütfen silme sebebini ve tarihini girin.", "warning");
            return;
        }
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
    }, [seciliAracId, silinmeTarihi, silmeSebebi, openSnack, verileriGetir, canDelete]);

    const handleBilgiAc = useCallback(async (arac) => {
        const plakaTreyler = `${arac.plaka} - ${arac.treyler}`;

        const { data: izinData } = await supabase.from("izinler").select("*").eq("plaka_treyler", plakaTreyler).order("id", { ascending: false }).limit(1);
        setIzinBilgisi(izinData?.[0] || null);

        const { data: kesintiData } = await supabase.from("kesintiler").select("*").eq("plaka_treyler", plakaTreyler).order("id", { ascending: false }).limit(1);

        let gosterilecek = { ...arac };
        if (kesintiData?.[0]) {
            setKesintiBilgisi(kesintiData[0]);
            const bitis = new Date(kesintiData[0].bitis_tarihi);
            const bugun = new Date();
            if (bitis < bugun) {
                const farkGun = Math.floor((+bugun - +bitis) / (1000 * 60 * 60 * 24));
                gosterilecek = { ...gosterilecek, statu: `${farkGun} gün kesintiden çıktı` };
            }
        } else setKesintiBilgisi(null);

        setBilgiArac(gosterilecek);
        setBilgiModalAcik(true);
    }, []);

    const excelAktar = useCallback(() => {
        const liste = araclar;
        if (!liste.length) return openSnack("Aktarılacak araç bulunamadı", "warning");
        const dataToExport = liste.map(({ plaka, treyler, surucu_adi, surucu_telefon, surucu_tc, statu }) => ({
            Plaka: plaka,
            Treyler: treyler,
            "Sürücü Adı": surucu_adi,
            Telefon: surucu_telefon,
            TC: surucu_tc,
            Statü: statu,
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Araçlar");
        const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        saveAs(blob, `arac_listesi_${tab}.xlsx`);
    }, [araclar, openSnack, tab]);

    // GRID sütunları
    const columns = useMemo(
        () => [
            { field: "plaka", headerName: "Plaka", minWidth: 120, flex: 0.9 },
            { field: "treyler", headerName: "Treyler", minWidth: 120, flex: 0.9 },
            { field: "surucu_adi", headerName: "Sürücü", minWidth: 150, flex: 1 },
            { field: "surucu_telefon", headerName: "Telefon", minWidth: 140, flex: 0.9 },
            { field: "surucu_tc", headerName: "TC", minWidth: 140, flex: 0.9 },
            {
                field: "ikamet_adresi",
                headerName: "İkamet",
                minWidth: 220,
                flex: 1.4,
                renderCell: (p) => (
                    <Typography noWrap title={p.value || ""} sx={{ maxWidth: "100%" }}>
                        {p.value}
                    </Typography>
                ),
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
                minWidth: 200,
                flex: 1,
                hide: !(tab === "pasif" || tab === "tum"),
            },
            {
                field: "statu",
                headerName: "Statü",
                minWidth: 160,
                flex: 0.9,
                renderCell: ({ value }) => {
                    const label = value || "Aktif";
                    const isRemoved = label === "ÇIKARILDI";
                    const isWarning = /kesintiden/.test(label || "");
                    const icon = isRemoved ? (
                        <RemovedIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    ) : isWarning ? (
                        <WarningIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    ) : (
                        <CheckIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    );
                    return (
                        <Chip
                            label={
                                <Box sx={{ display: "flex", alignItems: "center" }}>
                                    {icon}
                                    {label}
                                </Box>
                            }
                            size="small"
                            color={isRemoved ? "error" : isWarning ? "warning" : "success"}
                            variant={isRemoved ? "outlined" : "filled"}
                            sx={{
                                fontWeight: 600,
                                // Özel renk geçişleri
                                bgcolor: isRemoved ? alpha(currentTheme.palette.error.main, 0.1) : isWarning ? alpha(currentTheme.palette.warning.main, 0.1) : alpha(currentTheme.palette.success.main, 0.1),
                                color: isRemoved ? currentTheme.palette.error.main : isWarning ? currentTheme.palette.warning.main : currentTheme.palette.success.main,
                                border: 'none',
                            }}
                        />
                    );
                },
            },
            {
                field: "__actions",
                headerName: "İşlem",
                sortable: false,
                filterable: false,
                minWidth: 190,
                flex: 0.95,
                align: "right",
                renderCell: ({ row }) => (
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Bilgi">
                            <IconButton size="small" onClick={() => handleBilgiAc(row)}>
                                <InfoIcon fontSize="inherit" />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={canEdit ? "Düzenle" : "Yetkiniz yok"}>
                            <span>
                                <IconButton size="small" onClick={() => handleDuzenle(row)} disabled={!canEdit}>
                                    <EditIcon fontSize="inherit" />
                                </IconButton>
                            </span>
                        </Tooltip>

                        {row.statu !== "ÇIKARILDI" && (
                            <Tooltip title={canDelete ? "Sil" : "Yetkiniz yok"}>
                                <span>
                                    <IconButton size="small" color="error" onClick={() => handleSilIstegi(row.id)} disabled={!canDelete}>
                                        <DeleteIcon fontSize="inherit" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                    </Stack>
                ),
            },
        ],
        [tab, handleBilgiAc, handleDuzenle, handleSilIstegi, canEdit, canDelete, currentTheme.palette.error.main, currentTheme.palette.warning.main, currentTheme.palette.success.main]
    );

    const rows = useMemo(() => araclar.map((a, i) => ({ id: a.id ?? `${a.plaka}-${a.treyler}-${i}`, ...a })), [araclar]);

    // Aktif filtre rozetleri
    const activeFilterChips = useMemo(() => {
        const chips = [];
        if (filters?.bolge) chips.push({ k: "bolge", label: `Bölge: ${filters.bolge}` });
        if (filters?.plaka) chips.push({ k: "plaka", label: `Plaka: ${filters.plaka}` });
        if (filters?.surucu) chips.push({ k: "surucu", label: `Sürücü: ${filters.surucu}` });
        return chips;
    }, [filters]);

    return (
        <ThemeProvider theme={theme}>
            <ScaleToFit>
                <Helmet>
                    <title>ARAÇ YÖNETİMİ</title>
                </Helmet>

                <Stack spacing={2} sx={{ height: '100%' }}>

                    {/* APP BAR */}
                    <AppBar
                        position="static"
                        color="transparent"
                        elevation={0}
                        sx={{
                            borderRadius: 3, // Daha yuvarlak hatlar
                            ...glass(0.95, 0.8),
                            mx: 0,
                            mt: 0,
                            backgroundImage: "linear-gradient(90deg, rgba(139,92,246,0.2), rgba(34,211,238,0.2))", // Daha belirgin gradient
                            borderBottom: '2px solid rgba(139,92,246,0.3)',
                        }}
                    >
                        <Toolbar disableGutters sx={{ px: 2 }}>
                            <Typography
                                variant="h5"
                                sx={{
                                    flexGrow: 1,
                                    fontWeight: 800,
                                    background: "linear-gradient(90deg,#E879F9,#22D3EE)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    letterSpacing: 0.5,
                                    userSelect: "none",
                                }}
                            >
                                🚚 Araç Filosu Yönetimi
                            </Typography>

                            <Stack direction="row" spacing={1} alignItems="center">
                                {/* Yenile */}
                                <Tooltip title="Verileri Yenile (R)">
                                    <span>
                                        <IconButton onClick={verileriGetir} disabled={loading} color="secondary">
                                            {loading ? <CircularProgress size={20} color="secondary" /> : <RefreshIcon />}
                                        </IconButton>
                                    </span>
                                </Tooltip>

                                {/* Filtreler */}
                                <Tooltip title="Detaylı Filtreler">
                                    <Button onClick={() => setDrawerOpen(true)} variant="outlined" startIcon={<FilterListIcon />} size="small" color="secondary" sx={{ py: 1 }}>
                                        Filtre
                                    </Button>
                                </Tooltip>

                                {/* Excel */}
                                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={excelAktar} size="small" sx={{ py: 1 }}>
                                    Excel Aktar
                                </Button>

                                {/* Yeni */}
                                <Tooltip title={canCreate ? "Yeni araç ekle (N)" : "Yetkiniz yok"}>
                                    <span>
                                        <Button variant="contained" startIcon={<AddIcon />} onClick={handleYeniEkle} disabled={!canCreate} size="small" color="success" sx={{ boxShadow: '0 4px 10px rgba(16, 185, 129, 0.4)', py: 1 }}>
                                            Yeni Araç
                                        </Button>
                                    </span>
                                </Tooltip>

                                <SubtleDivider orientation="vertical" flexItem sx={{ mx: 1, height: 28 }} />

                                {/* Geri & Anasayfa */}
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

                    {/* KPI Kartları */}
                    <Grid container spacing={2} sx={{ px: 0 }}>
                        <Grid item xs={12} md={6}>
                            <Section title="AKTİF ARAÇLAR" right={<Chip icon={<CheckIcon />} label="Aktif" size="small" color="success" />}>
                                <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700, color: currentTheme.palette.success.light }}>
                                    {aktifSayisi}
                                </Typography>
                            </Section>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Section title="ÇIKARILAN ARAÇLAR" right={<Chip icon={<RemovedIcon />} label="Pasif" color="error" variant="outlined" size="small" />}>
                                <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700, color: currentTheme.palette.error.light }}>
                                    {pasifSayisi}
                                </Typography>
                            </Section>
                        </Grid>
                    </Grid>

                    {/* Sekmeler + Global Arama + Aktif Filtre Rozetleri */}
                    <Paper sx={{ p: 2, mx: 0, borderRadius: 3, ...glass(0.06, 0.03), border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={6}>
                                <Tabs
                                    value={tab}
                                    onChange={(_, v) => setTab(v)}
                                    sx={{
                                        "& .MuiTab-root": { fontWeight: 700, minHeight: 40, borderRadius: 2, mr: 1, px: 2, transition: 'all 0.2s' },
                                        "& .Mui-selected": { backgroundColor: alpha("#ffffff", 0.08), color: currentTheme.palette.primary.light },
                                        "& .MuiTabs-indicator": { height: 3, borderRadius: 1, bgcolor: currentTheme.palette.primary.main },
                                    }}
                                >
                                    <Tab value="aktif" label={<Badge color="success" variant="dot" invisible={aktifSayisi === 0} sx={{ '& .MuiBadge-badge': { top: 6, right: 6 } }}><Box sx={{ px: 0.5 }}>Aktif</Box></Badge>} />
                                    <Tab value="pasif" label={<Badge color="error" variant="dot" invisible={pasifSayisi === 0} sx={{ '& .MuiBadge-badge': { top: 6, right: 6 } }}><Box sx={{ px: 0.5 }}>Çıkarılan</Box></Badge>} />
                                    <Tab value="tum" label="Tümü" />
                                </Tabs>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    id="global-search-input"
                                    fullWidth
                                    size="small"
                                    value={globalSearch ?? ""}
                                    onChange={(e) => setGlobalSearch(e.target.value)}
                                    placeholder="Genel arama (⌘/Ctrl + K): plaka, sürücü, ruhsat..."
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon color="secondary" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (globalSearch?.length ?? 0) > 0 ? (
                                            <InputAdornment position="end">
                                                <IconButton aria-label="temizle" edge="end" onClick={() => setGlobalSearch("")} size="small">
                                                    <ClearIcon fontSize="small" />
                                                </IconButton>
                                            </InputAdornment>
                                        ) : null,
                                        sx: { borderRadius: 2, backgroundColor: alpha("#ffffff", 0.04) }
                                    }}
                                />
                            </Grid>

                            {/* Aktif filtre rozetleri */}
                            {activeFilterChips.length > 0 && (
                                <Grid item xs={12}>
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                        {activeFilterChips.map((c) => (
                                            <Chip
                                                key={c.k}
                                                label={c.label}
                                                onDelete={() => setFilters((f) => ({ ...(f || {}), [c.k]: "" }))}
                                                variant="filled"
                                                size="small"
                                                color="primary"
                                                sx={{ opacity: 0.8, bgcolor: alpha(currentTheme.palette.primary.main, 0.15) }}
                                            />
                                        ))}
                                        <Button size="small" onClick={clearFilters} startIcon={<ClearIcon />} sx={{ ml: 0.5, color: currentTheme.palette.error.light }}>
                                            Filtreleri temizle
                                        </Button>
                                    </Stack>
                                </Grid>
                            )}
                        </Grid>
                    </Paper>

                    {/* GRID alanı */}
                    <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                        <Paper
                            sx={{
                                height: "100%", // Kalan tüm dikey alanı kapla
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
                                    density={density}
                                    onDensityChange={(d) => setDensity(d)}
                                    disableRowSelectionOnClick
                                    pagination={false}
                                    hideFooter
                                    loading={loading}
                                    columnVisibilityModel={colVis}
                                    onColumnVisibilityModelChange={(m) => setColVis(m)}
                                    pinnedColumns={pinnedCols}
                                    onPinnedColumnsChange={(m) => setPinnedCols(m)}
                                    slots={{
                                        toolbar: GridToolbar,
                                        noRowsOverlay: () => <EmptyState />,
                                        noResultsOverlay: () => <EmptyState title="Sonuç bulunamadı" caption="Arama & filtreleri kontrol edin." />,
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
                                        const s = params.row?.statu || "";
                                        if (s === "ÇIKARILDI") return "row-removed";
                                        if (/kesintiden/.test(s)) return "row-warning";
                                        return "";
                                    }}
                                    sx={{
                                        border: "none",
                                        height: "100%",
                                        [`& .${gridClasses.columnHeaders}`]: {
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
                                            backgroundColor: alpha(currentTheme.palette.primary.main, 0.1),
                                            transition: "background-color 120ms ease",
                                        },
                                        "& .row-removed .MuiDataGrid-cell": {
                                            backgroundColor: alpha("#ef4444", 0.08),
                                        },
                                        "& .row-warning .MuiDataGrid-cell": {
                                            backgroundColor: alpha("#f59e0b", 0.08),
                                        },
                                        "& .MuiDataGrid-overlayWrapper": {
                                            background: "transparent",
                                        },
                                    }}
                                />
                            </Box>
                        </Paper>
                    </Box>
                </Stack>

                {/* Drawer */}
                <Drawer
                    anchor="right"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    PaperProps={{
                        sx: {
                            width: 380,
                            background: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.85) 100%)",
                            backdropFilter: "blur(8px)",
                            color: "text.primary",
                            borderLeft: "1px solid rgba(255,255,255,0.08)",
                        },
                    }}
                >
                    <Box sx={{ p: 3 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                            <Typography variant="h5" fontWeight={700}>Detaylı Filtreler</Typography>
                            <IconButton onClick={() => setDrawerOpen(false)} color="secondary">
                                <CloseIcon />
                            </IconButton>
                        </Stack>
                        <SubtleDivider />

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            İpucu: Tablo araç çubuğundan (Quick filter / Columns / Filters / Density) hızla filtreleme yapabilirsiniz.
                        </Typography>

                        {/* FİLTRE KONTROLLERİ */}
                        <Stack spacing={3}>
                            <TextField label="Bölge" value={filters?.bolge ?? ""} onChange={(e) => setFilters((f) => ({ ...(f || {}), bolge: e.target.value }))} fullWidth size="small" />
                            <TextField label="Plaka" value={filters?.plaka ?? ""} onChange={(e) => setFilters((f) => ({ ...(f || {}), plaka: e.target.value }))} fullWidth size="small" />
                            <TextField label="Sürücü" value={filters?.surucu ?? ""} onChange={(e) => setFilters((f) => ({ ...(f || {}), surucu: e.target.value }))} fullWidth size="small" />

                            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                                <Button variant="outlined" startIcon={<ClearIcon />} onClick={clearFilters} color="error">
                                    Temizle
                                </Button>
                                <Box sx={{ flexGrow: 1 }} />
                                <Button variant="contained" onClick={() => setDrawerOpen(false)} color="secondary">
                                    Uygula
                                </Button>
                            </Stack>
                        </Stack>

                        <SubtleDivider sx={{ mt: 3 }} />

                        {/* Statü efsanesi */}
                        <Stack spacing={1}>
                            <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                                Statü Renkleri
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                <Chip size="small" color="success" label="Aktif" sx={{ bgcolor: alpha(currentTheme.palette.success.main, 0.1), color: currentTheme.palette.success.main, border: 'none' }} />
                                <Chip size="small" color="warning" label="Kesinti sonrası" sx={{ bgcolor: alpha(currentTheme.palette.warning.main, 0.1), color: currentTheme.palette.warning.main, border: 'none' }} />
                                <Chip size="small" color="error" variant="outlined" label="Çıkarıldı" sx={{ bgcolor: alpha(currentTheme.palette.error.main, 0.1), color: currentTheme.palette.error.main }} />
                            </Stack>
                        </Stack>
                    </Box>
                </Drawer>

                {/* Dialog: Ekle / Düzenle */}
                <Dialog open={duzenleAcik} onClose={() => setDuzenleAcik(false)} maxWidth="md" fullWidth>
                    <DialogTitle>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="h6" fontWeight={700}>{editId ? "Araç Bilgilerini Güncelle" : "Yeni Araç Bilgisi"}</Typography>
                            <IconButton onClick={temizleVeKapat} color="secondary"><CloseIcon /></IconButton>
                        </Stack>
                    </DialogTitle>
                    <DialogContent dividers>
                        <Grid container spacing={3} sx={{ mt: 0 }}> {/* Spacing artırıldı */}
                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth
                                    name="plaka"
                                    value={form.plaka}
                                    onChange={handleChange}
                                    label="Plaka"
                                    required
                                    error={!!formErrors.plaka}
                                    helperText={formErrors.plaka || "Zorunlu Alan"}
                                    size="small"
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="treyler" value={form.treyler} onChange={handleChange} label="Treyler" size="small" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="surucu_adi" value={form.surucu_adi} onChange={handleChange} label="Sürücü Adı" size="small" />
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth
                                    name="surucu_telefon"
                                    value={form.surucu_telefon}
                                    onChange={handleChange}
                                    label="Telefon"
                                    error={!!formErrors.surucu_telefon}
                                    helperText={formErrors.surucu_telefon || "Örn: 5xx xxx xx xx"}
                                    size="small"
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="surucu_tc" value={form.surucu_tc} onChange={handleChange} label="TC" size="small" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="ikamet_adresi" value={form.ikamet_adresi} onChange={handleChange} label="İkamet Adresi" size="small" />
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="cekici_ruhsat_no" value={form.cekici_ruhsat_no} onChange={handleChange} label="Çekici Ruhsat No" size="small" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="dorse_ruhsat_no" value={form.dorse_ruhsat_no} onChange={handleChange} label="Dorse Ruhsat No" size="small" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="tedarikci_isim" value={form.tedarikci_isim} onChange={handleChange} label="Tedarikçi İsim" size="small" />
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    name="cekici_muayene"
                                    value={form.cekici_muayene}
                                    onChange={handleChange}
                                    label="Çekici Muayene Bitiş"
                                    InputLabelProps={{ shrink: true }}
                                    required
                                    error={!!formErrors.cekici_muayene}
                                    helperText={formErrors.cekici_muayene || "Zorunlu Tarih"}
                                    size="small"
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    name="dorse_muayene"
                                    value={form.dorse_muayene}
                                    onChange={handleChange}
                                    label="Dorse Muayene Bitiş"
                                    InputLabelProps={{ shrink: true }}
                                    required
                                    error={!!formErrors.dorse_muayene}
                                    helperText={formErrors.dorse_muayene || "Zorunlu Tarih"}
                                    size="small"
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    name="trafik_sigorta"
                                    value={form.trafik_sigorta}
                                    onChange={handleChange}
                                    label="Trafik Sigorta Bitiş"
                                    InputLabelProps={{ shrink: true }}
                                    required
                                    error={!!formErrors.trafik_sigorta}
                                    helperText={formErrors.trafik_sigorta || "Zorunlu Tarih"}
                                    size="small"
                                />
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <TextField fullWidth type="number" name="arac_yil" value={form.arac_yil || ""} onChange={handleChange} label="Araç Yılı" size="small" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth type="number" name="dorse_yil" value={form.dorse_yil || ""} onChange={handleChange} label="Dorse Yılı" size="small" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="bolge" value={form.bolge} onChange={handleChange} label="Bölge" size="small" />
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="arac_tip" value={form.arac_tip} onChange={handleChange} label="Araç Tip" size="small" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="dorse_tip" value={form.dorse_tip} onChange={handleChange} label="Dorse Tip" size="small" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="liftmaster" value={form.liftmaster} onChange={handleChange} label="Liftmaster" size="small" />
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="gps_seri_no" value={form.gps_seri_no} onChange={handleChange} label="GPS Seri No" size="small" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="gps_sim_kart_no" value={form.gps_sim_kart_no} onChange={handleChange} label="GPS Sim Kart No" size="small" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField fullWidth name="odak_k1" value={form.odak_k1} onChange={handleChange} label="Odak K1" size="small" />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions
                        sx={{
                            position: "sticky",
                            bottom: 0,
                            background: "linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.95) 100%)",
                            borderTop: "1px solid rgba(255,255,255,0.06)",
                        }}
                    >
                        <Button onClick={handleSubmit} variant="contained" size="large" color={editId ? "primary" : "success"} sx={{ px: 4, py: 1.2, fontWeight: 700 }}>
                            {editId ? "Güncelle" : "Kaydet"}
                        </Button>
                        <Button onClick={temizleVeKapat} variant="outlined" size="large">
                            İptal
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Dialog: Silme */}
                <Dialog open={silModalAcik} onClose={() => setSilModalAcik(false)}>
                    <DialogTitle sx={{ color: currentTheme.palette.error.main, fontWeight: 700 }}>⚠️ Araç Kalıcı Olarak Çıkarılıyor</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={3} sx={{ mt: 1 }}>
                            <TextField
                                label="Silme sebebi (Zorunlu)"
                                value={silmeSebebi}
                                onChange={(e) => setSilmeSebebi(e.target.value)}
                                fullWidth
                                multiline
                                rows={2}
                                required
                                error={!(silmeSebebi || "").trim()}
                                helperText={!(silmeSebebi || "").trim() ? "Silme sebebini girmek zorunludur." : ""}
                            />
                            <TextField
                                label="Çıkarılma Tarihi"
                                type="datetime-local"
                                value={silinmeTarihi}
                                onChange={(e) => setSilinmeTarihi(e.target.value)}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                required
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={handleSilOnayla}
                            variant="contained"
                            color="error"
                            disabled={!(silmeSebebi || "").trim()}
                        >
                            Çıkarılma İşlemini Onayla
                        </Button>
                        <Button onClick={() => setSilModalAcik(false)} variant="text">İptal</Button>
                    </DialogActions>
                </Dialog>

                {/* Dialog: Bilgi */}
                <Dialog
                    open={bilgiModalAcik}
                    onClose={() => setBilgiModalAcik(false)}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="h6" fontWeight={700}>Araç Detay & İşlem Bilgileri</Typography>
                            <IconButton onClick={() => setBilgiModalAcik(false)} color="secondary"><CloseIcon /></IconButton>
                        </Stack>
                    </DialogTitle>
                    <DialogContent dividers>
                        {bilgiArac && (
                            <Grid container spacing={3}>
                                {/* Genel Bilgiler */}
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ color: currentTheme.palette.secondary.main }}>Genel Durum</Typography>
                                    <SubtleDivider />
                                </Grid>
                                <Grid item xs={12} md={4}><Typography variant="body2"><b>Plaka:</b> {bilgiArac.plaka}</Typography></Grid>
                                <Grid item xs={12} md={4}><Typography variant="body2"><b>Treyler:</b> {bilgiArac.treyler || '-'}</Typography></Grid>
                                <Grid item xs={12} md={4}><Typography variant="body2"><b>Statü:</b> {bilgiArac.statu}</Typography></Grid>

                                {/* İzin / Kesinti */}
                                {(izinBilgisi || kesintiBilgisi) && (
                                    <Grid item xs={12}>
                                        <Typography variant="h6" sx={{ mt: 2, color: currentTheme.palette.primary.main }}>İzin & Kesinti</Typography>
                                        <SubtleDivider />
                                    </Grid>
                                )}

                                {izinBilgisi && (
                                    <Grid item xs={12}>
                                        <Paper variant="outlined" sx={{ p: 2, borderColor: alpha(currentTheme.palette.secondary.main, 0.5), background: alpha(currentTheme.palette.secondary.main, 0.05) }}>
                                            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, color: currentTheme.palette.secondary.light }}>İzin Kaydı (Son)</Typography>
                                            <Grid container spacing={1}>
                                                <Grid item xs={12} md={4}><Typography variant="body2"><b>Tür:</b> {izinBilgisi.izin_turu}</Typography></Grid>
                                                <Grid item xs={12} md={4}><Typography variant="body2"><b>Başlangıç:</b> {new Date(izinBilgisi.baslangic_tarihi).toLocaleDateString()}</Typography></Grid>
                                                <Grid item xs={12} md={4}><Typography variant="body2"><b>Bitiş:</b> {new Date(izinBilgisi.bitis_tarihi).toLocaleDateString()}</Typography></Grid>
                                                <Grid item xs={12}><Typography variant="body2"><b>Açıklama:</b> {izinBilgisi.aciklama || "-"}</Typography></Grid>
                                            </Grid>
                                        </Paper>
                                    </Grid>
                                )}

                                {kesintiBilgisi && (
                                    <Grid item xs={12}>
                                        <Paper variant="outlined" sx={{ p: 2, borderColor: alpha(currentTheme.palette.warning.main, 0.5), background: alpha(currentTheme.palette.warning.main, 0.05) }}>
                                            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, color: currentTheme.palette.warning.light }}>Kesinti Kaydı (Son)</Typography>
                                            <Grid container spacing={1}>
                                                <Grid item xs={12} md={4}><Typography variant="body2"><b>Tür:</b> {kesintiBilgisi.kesinti_turu}</Typography></Grid>
                                                <Grid item xs={12} md={4}><Typography variant="body2"><b>Başlangıç:</b> {new Date(kesintiBilgisi.baslangic_tarihi).toLocaleDateString()}</Typography></Grid>
                                                <Grid item xs={12} md={4}><Typography variant="body2"><b>Bitiş:</b> {new Date(kesintiBilgisi.bitis_tarihi).toLocaleDateString()}</Typography></Grid>
                                                <Grid item xs={12}><Typography variant="body2"><b>Açıklama:</b> {kesintiBilgisi.aciklama || "-"}</Typography></Grid>
                                            </Grid>
                                        </Paper>
                                    </Grid>
                                )}

                                {/* Audit Bilgileri */}
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ mt: 2, color: currentTheme.palette.info.main }}>Sistem Kayıtları</Typography>
                                    <SubtleDivider />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="body2">
                                        <b>Ekleyen:</b> {bilgiArac.ekleyen_kullanici || "-"}
                                    </Typography>
                                    <Typography variant="body2">
                                        <b>Eklenme Tarihi:</b> {bilgiArac.eklenen_tarih ? new Date(bilgiArac.eklenen_tarih).toLocaleString() : "-"}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="body2">
                                        <b>Son Güncelleyen:</b> {bilgiArac.guncelleyen_kullanici || "-"}
                                    </Typography>
                                    <Typography variant="body2">
                                        <b>Son Güncelleme:</b> {bilgiArac.guncelleme_tarihi ? new Date(bilgiArac.guncelleme_tarihi).toLocaleString() : "-"}
                                    </Typography>
                                    {bilgiArac.guncellenen_alanlar && <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>Değişen Alanlar: {bilgiArac.guncellenen_alanlar}</Typography>}
                                </Grid>

                            </Grid>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setBilgiModalAcik(false)} variant="contained" color="secondary" size="large">
                            Kapat
                        </Button>
                    </DialogActions>
                </Dialog>

                <Snackbar
                    open={snack.open}
                    autoHideDuration={2500}
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ width: "100%", borderRadius: 1 }}>
                        {snack.msg}
                    </Alert>
                </Snackbar>
            </ScaleToFit>
        </ThemeProvider>
    );
}
