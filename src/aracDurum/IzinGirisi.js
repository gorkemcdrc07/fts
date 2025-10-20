import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { useNavigate } from "react-router-dom";

// MUI Components & Styling
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
    Badge,
    Card,
    CardContent,
    LinearProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

// MUI Icons
import AddIcon from "@mui/icons-material/AddOutlined";
import DownloadIcon from "@mui/icons-material/DownloadOutlined";
import FilterListIcon from "@mui/icons-material/FilterListOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import RefreshIcon from "@mui/icons-material/RefreshOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBackIosNewOutlined";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutline";
import WarningIcon from "@mui/icons-material/WarningAmberOutlined";

// DataGrid Components & Date Pickers
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

/* ===================== Sabitler ve Yardımcılar ===================== */
const SCREEN_KEY = "izin_yonetimi";
const HOME_PATH = "/anasayfa";
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;
const MAX_SCALE = Infinity;

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

const getMevcutKullanici = () => localStorage.getItem("kullanici") || "Bilinmeyen Kullanıcı";

const hesaplaGunSayisi = (baslangicStr, bitisStr) => {
    if (!baslangicStr || !bitisStr) return 0;
    const d1 = dayjs(baslangicStr).startOf('day');
    const d2 = dayjs(bitisStr).startOf('day');
    const fark = d2.diff(d1, 'day');
    return fark >= 0 ? fark + 1 : 0; // İzin günleri dahil (başlangıç ve bitiş dahil)
};

// DataGrid güvenli yardımcılar
const safeGetVal = (arg) => (arg && typeof arg === "object" && "value" in arg ? arg.value : arg);
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

/* ===================== DataGrid TR (Hata Düzeltildi) ===================== */
const GRID_TR = {
    noRowsLabel: "Kayıt bulunmuyor",
    noResultsOverlayLabel: "Aranan sonuç bulunamadı",
    errorOverlayDefaultLabel: "Bir hata oluştu.",
    toolbarColumns: "Sütunlar",
    toolbarFilters: "Filtreler",
    toolbarDensity: "Sıklık",
    toolbarDensityCompact: "Sıkı",
    toolbarDensityStandard: "Standart",
    toolbarDensityComfortable: "Rahat",
    toolbarExport: "Dışa aktar",
    toolbarQuickFilterPlaceholder: "Hızlı Ara...",
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

/* ===================== Tema Tanımı (Modern) ===================== */
const theme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: "#8B5CF6" }, // Mor (Vibrant Purple)
        secondary: { main: "#22D3EE" }, // Turkuaz (Cyan)
        background: {
            default: "#0B1220", // Koyu mavi/lacivert arka plan
            paper: alpha("#1E293B", 0.95), // Hafif daha açık, kadifemsi bir paper rengi
        },
        success: { main: "#10B981" }, // Zümrüt Yeşili
        error: { main: "#F43F5E" }, // Gül Kırmızısı
        info: { main: "#3B82F6" },
        warning: { main: "#F59E0B" },
    },
    shape: { borderRadius: 12 }, // Hafif yuvarlak köşeler
    typography: {
        fontFamily: 'Inter, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        button: { textTransform: "none", fontWeight: 600 },
        h4: { fontWeight: 800 },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                // Scrollbar stilini iyileştir
                "html": { scrollbarGutter: "stable" },
                "*::-webkit-scrollbar": { width: "8px", height: "8px" },
                "*::-webkit-scrollbar-thumb": {
                    backgroundColor: alpha("#8B5CF6", 0.5),
                    borderRadius: "10px",
                },
                "*::-webkit-scrollbar-track": { backgroundColor: alpha("#1E293B", 0.7) },
            }
        },
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: "0 10px 30px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05) inset",
                    backdropFilter: "blur(4px)",
                    backgroundColor: alpha("#1E293B", 0.9),
                }
            }
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    boxShadow: "0 4px 15px rgba(139,92,246,0.2)",
                    transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
                    ":hover": { boxShadow: "0 6px 20px rgba(139,92,246,0.3)" },
                },
                outlined: {
                    border: "1px solid rgba(255,255,255,0.12)",
                }
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    background: "linear-gradient(180deg, #1E293B 0%, #171E2D 100%)",
                    boxShadow: "0 15px 45px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                },
            },
        },
        MuiTextField: {
            defaultProps: { variant: "outlined" },
            styleOverrides: {
                root: {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: 10,
                        backgroundColor: alpha("#1E293B", 0.7),
                        "&:hover fieldset": { borderColor: `${alpha("#8B5CF6", 0.7)} !important` },
                    },
                    "& .MuiInputLabel-root.Mui-focused": { color: "#8B5CF6" },
                }
            },
        },
        MuiDataGrid: {
            styleOverrides: {
                root: {
                    border: "none",
                    borderRadius: 12,
                    "& .MuiDataGrid-columnHeaders": {
                        backgroundColor: "#171E2D",
                        borderBottom: "1px solid rgba(255,255,255,0.12)",
                    },
                    "& .MuiDataGrid-cell": {
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                    },
                    "& .MuiDataGrid-row:nth-of-type(odd)": {
                        backgroundColor: alpha("#1E293B", 0.7),
                    },
                    "& .MuiDataGrid-row:hover": {
                        backgroundColor: alpha("#8B5CF6", 0.15),
                    },
                },
            }
        },
    },
});

/* ===================== Zoom'dan Bağımsız Ekrana Sığdırma (Scaled Container) ===================== */
function useContainerScale(baseW = BASE_WIDTH, baseH = BASE_HEIGHT, maxScale = MAX_SCALE) {
    const ref = useRef(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const cr = entries[0].contentRect;
            const availW = Math.max(0, cr.width);
            const availH = Math.max(0, cr.height);
            const s = Math.min(availW / baseW, availH / baseH, maxScale);
            setScale(Number.isFinite(s) && s > 0 ? s : 1);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [baseW, baseH, maxScale]);

    return [ref, scale];
}

function ScaleToFit({ children }) {
    const [ref, scale] = useContainerScale(BASE_WIDTH, BASE_HEIGHT, MAX_SCALE);

    return (
        <Box
            ref={ref}
            sx={{
                width: "100%",
                height: "100dvh",
                overflow: "hidden",
                display: "grid",
                justifyItems: "start",
                alignItems: "start",
                background:
                    "radial-gradient(1200px 500px at 10% -10%, rgba(34,211,238,0.25), transparent 60%)," +
                    "radial-gradient(900px 400px at 90% 0%, rgba(139,92,246,0.30), transparent 70%)," +
                    "linear-gradient(180deg, #0B1220 0%, #050816 100%)",
            }}
        >
            <Box
                sx={{
                    width: `${BASE_WIDTH}px`,
                    height: `${BASE_HEIGHT}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    overflow: "hidden",
                    transition: "transform 150ms",
                }}
            >
                {children}
            </Box>
        </Box>
    );
}

/* ============= Custom Toolbar ============= */
function CustomToolbar({ onRefresh, onExport, onFilters }) {
    return (
        <GridToolbarContainer
            sx={{
                px: 2,
                py: 1,
                gap: 1.5,
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: "linear-gradient(180deg, #171E2D 0%, #171E2D 100%)",
                borderBottom: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
            }}
        >
            <GridToolbarColumnsButton />
            <GridToolbarDensitySelector />
            <Box sx={{ flexGrow: 1 }} />
            <GridToolbarQuickFilter debounceMs={300} />
            <Tooltip title="Detaylı Filtreler">
                <IconButton color="primary" onClick={onFilters}>
                    <FilterListIcon />
                </IconButton>
            </Tooltip>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExport} size="small">
                Excel'e Aktar
            </Button>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRefresh} size="small">
                Yenile
            </Button>
        </GridToolbarContainer>
    );
}

/* ===================== Ana Bileşen ===================== */
export default function IzinGirisiModern() {
    const navigate = useNavigate();

    // Data State
    const [izinler, setIzinler] = useState([]);
    const [plakaListesi, setPlakaListesi] = useState([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
    const [filtreDrawer, setFiltreDrawer] = useState(false);

    // Form State
    const [form, setForm] = useState({ ...BOS_FORM });
    const [formOpen, setFormOpen] = useState(false);
    const [duzenlemeId, setDuzenlemeId] = useState(null);

    // Kesinti Dialog State
    const [kesintiOpen, setKesintiOpen] = useState(false);
    const [kesintiBilgisi, setKesintiBilgisi] = useState({ neden: "", tur: "" });
    const [formSubmitBekliyor, setFormSubmitBekliyor] = useState(false);

    // Filtre State
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

    // Yetki State
    const [permLoading, setPermLoading] = useState(true);
    const [perms, setPerms] = useState({
        canCreate: false,
        canEdit: false,
        canDelete: false,
    });

    const openSnack = (msg, severity = "success") => setSnack({ open: true, msg, severity });

    /* ===================== Effects ===================== */
    useEffect(() => {
        verileriGetir();
        plakalariGetir();
        loadPermissions().catch((e) => {
            console.error("perm load error:", e);
            setPerms({ canCreate: false, canEdit: false, canDelete: false });
        });
    }, []);

    useEffect(() => {
        if (formSubmitBekliyor) {
            setFormSubmitBekliyor(false);
            handleSubmit();
        }
    }, [formSubmitBekliyor]);

    /* ===================== KPI Hesaplama ===================== */
    const toplamKayit = izinler.length;
    const buAy = izinler.filter(
        (r) => r.baslangic_tarihi && dayjs(r.baslangic_tarihi).isSame(dayjs(), "month")
    ).length;

    /* ===================== Permissions Loader ===================== */
    async function loadPermissions() {
        try {
            setPermLoading(true);

            // 1) Kullanıcı
            const ad = getMevcutKullanici();
            const { data: userRow, error: eU } = await supabase
                .from("login")
                .select("id, rol, kullanici")
                .eq("kullanici", ad)
                .maybeSingle();
            if (eU) throw eU;
            if (!userRow) {
                setPerms({ canCreate: false, canEdit: false, canDelete: false });
                return;
            }

            // 2) Rol ID
            const ROLE_NAME_TO_KEY = { YÖNETİCİ: "YONETICI", OPERASYON: "OPERASYON", TAKİP: "TAKIP" };
            const looksLikeUUID = (s) =>
                typeof s === "string" &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

            let roleId = null;
            if (userRow.rol) {
                if (looksLikeUUID(userRow.rol)) {
                    roleId = userRow.rol;
                } else {
                    const roleKey =
                        ROLE_NAME_TO_KEY[String(userRow.rol || "").toUpperCase()] ||
                        String(userRow.rol || "").toUpperCase();
                    const { data: roleRow } = await supabase
                        .from("roles")
                        .select("id,key")
                        .eq("key", roleKey)
                        .maybeSingle();
                    roleId = roleRow?.id || null;
                }
            }

            // 3) Rol izinleri (role_permissions)
            let roleCreate = false,
                roleEdit = false,
                roleDelete = false;
            if (roleId) {
                const { data: rp } = await supabase
                    .from("role_permissions")
                    .select("izin_create, izin_edit, izin_delete")
                    .eq("screen_key", SCREEN_KEY)
                    .eq("role_id", roleId)
                    .maybeSingle();
                roleCreate = !!rp?.izin_create;
                roleEdit = !!rp?.izin_edit;
                roleDelete = !!rp?.izin_delete;
            }

            // 4) Kullanıcı override (user_permissions)
            const { data: up } = await supabase
                .from("user_permissions")
                .select("izin_create, izin_edit, izin_delete")
                .eq("user_id", userRow.id)
                .maybeSingle();

            // 5) Etkin izin
            const coalesce = (u, r) => (typeof u === "boolean" ? u : !!r);
            const canCreate = coalesce(up?.izin_create, roleCreate);
            const canEdit = coalesce(up?.izin_edit, roleEdit);
            const canDelete = coalesce(up?.izin_delete, roleDelete);

            setPerms({ canCreate, canEdit, canDelete });
        } finally {
            setPermLoading(false);
        }
    }

    /* ===================== Veri İşlemleri ===================== */
    const verileriGetir = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("izinler")
            .select("*")
            .order("id", { ascending: false });
        if (!error) {
            // Tarihleri temizle ve 10 karakter formatına dönüştür
            const cleaned = (data || []).map((r) => ({
                ...r,
                baslangic_tarihi: r["baslangic_tarihi"] ? String(r["baslangic_tarihi"]).slice(0, 10) : null,
                bitis_tarihi: r["bitis_tarihi"] ? String(r["bitis_tarihi"]).slice(0, 10) : null,
                is_basi_tarihi: r["is_basi_tarihi"] ? String(r["is_basi_tarihi"]).slice(0, 10) : null,
                yukleme_tarihi: r["yukleme_tarihi"] ? String(r["yukleme_tarihi"]).slice(0, 10) : null,
                eklenme_tarihi: r["eklenme_tarihi"] ? String(r["eklenme_tarihi"]).slice(0, 10) : null,
            }));
            setIzinler(cleaned);
        } else {
            openSnack("İzinler alınamadı: " + error.message, "error");
        }
        setLoading(false);
    };

    const plakalariGetir = async () => {
        const { data, error } = await supabase
            .from("plakalar")
            .select("plaka, treyler, surucu_adi, surucu_telefon, surucu_tc")
            .or("statu.is.null,statu.neq.ÇIKARILDI");
        if (!error && data) setPlakaListesi(data);
    };

    /* ===================== Handler Fonksiyonları ===================== */
    const handleFormChange = (name, value) => {
        const next = { ...form, [name]: value };

        if (name === "baslangic_tarihi" || name === "bitis_tarihi") {
            const { baslangic_tarihi, bitis_tarihi } = next;
            if (baslangic_tarihi && bitis_tarihi) {
                const farkGun = hesaplaGunSayisi(baslangic_tarihi, bitis_tarihi);
                next.gun_sayisi = farkGun > 0 ? farkGun : 0;

                // İş başı tarihi: bitiş tarihinin ertesi günü
                const bitis = dayjs(bitis_tarihi);
                const isBasi = bitis.add(1, 'day');
                next.is_basi_tarihi = isBasi.isValid() ? isBasi.format("YYYY-MM-DD") : null;
            } else {
                next.gun_sayisi = 0;
                next.is_basi_tarihi = null;
            }
        }

        setForm(next);
    };

    const handlePlakaSecimi = (value) => {
        const secilen = plakaListesi.find((p) => `${p.plaka} - ${p.treyler}` === value);

        if (secilen) {
            setForm((prev) => ({
                ...prev,
                plaka_treyler: value || "",
                surucu_adi: secilen.surucu_adi || "",
                surucu_telefon: secilen.surucu_telefon || "",
                surucu_tc: secilen.surucu_tc || "",
            }));
        } else {
            setForm((prev) => ({ ...prev, plaka_treyler: value || "", surucu_adi: "", surucu_telefon: "", surucu_tc: "" }));
        }
    };

    const handleYeniIzin = () => {
        if (!perms.canCreate) {
            openSnack("Yeni kayıt ekleme yetkiniz yok.", "warning");
            return;
        }
        setForm({ ...BOS_FORM });
        setDuzenlemeId(null);
        setFormOpen(true);
        setKesintiBilgisi({ neden: "", tur: "" });
    };

    const handleDuzenle = (row) => {
        if (!perms.canEdit) {
            openSnack("Düzenleme yetkiniz yok.", "warning");
            return;
        }
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
        setKesintiBilgisi({ neden: "", tur: "" });
    };

    const handleSil = async (id) => {
        if (!perms.canDelete) {
            openSnack("Silme yetkiniz yok.", "warning");
            return;
        }
        if (!window.confirm("Bu izni kalıcı olarak silmek istediğinizden emin misiniz?")) return;

        // 1. İzin kaydını al
        const { data: izinKaydi, error: fetchErr } = await supabase.from("izinler").select("plaka_treyler, is_basi_tarihi, yukleme_tarihi").eq("id", id).maybeSingle();

        if (fetchErr || !izinKaydi) {
            openSnack("Silinecek kayıt bulunamadı veya bir hata oluştu.", "error");
            return;
        }

        // 2. İzin kaydını sil
        const { error: silErr } = await supabase.from("izinler").delete().eq("id", id);
        if (silErr) {
            openSnack("İzin kaydı silinirken hata oluştu: " + silErr.message, "error");
            return;
        }

        // 3. İlgili kesintiyi sil (varsa)
        if (izinKaydi.is_basi_tarihi && izinKaydi.yukleme_tarihi && izinKaydi.plaka_treyler) {
            // Sadece eşleşen Kesintiyi sil: Plaka, Başlangıç ve Bitiş tarihleri aynı olan
            await supabase
                .from("kesintiler")
                .delete()
                .eq("plaka_treyler", izinKaydi.plaka_treyler)
                .eq("baslangic_tarihi", izinKaydi.is_basi_tarihi)
                .eq("bitis_tarihi", izinKaydi.yukleme_tarihi);
        }

        // 4. Plaka statüsünü güncelle (basitleştirilmiş)
        const [plaka, treyler] = (izinKaydi.plaka_treyler || "").split(" - ");
        if (plaka && treyler) {
            // Plaka statüsünü "İZİNDEN ÇIKTI" olarak güncelle
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

        openSnack("Kayıt başarıyla silindi.", "info");
        verileriGetir();
    };


    const kesintiGerekirMi = () => {
        const yukleme = form.yukleme_tarihi ? dayjs(form.yukleme_tarihi) : null;
        const isBasi = form.is_basi_tarihi ? dayjs(form.is_basi_tarihi) : null;

        // Yükleme tarihi, iş başı tarihinden kesinlikle sonra mı?
        if (!yukleme || !isBasi) return false;

        // Yükleme tarihi, iş başı tarihinden sonra ise kesinti gerekir.
        const farkGun = yukleme.diff(isBasi, 'day');
        return farkGun > 0;
    };

    const handleSubmit = async () => {
        // Validation: Zorunlu alanlar
        if (!form.plaka_treyler || !form.izin_turu || !form.baslangic_tarihi || !form.bitis_tarihi) {
            openSnack("Lütfen zorunlu alanları (Plaka, İzin Türü, Başlangıç/Bitiş) doldurun.", "error");
            return;
        }

        // Permission check
        if (!duzenlemeId && !perms.canCreate) {
            openSnack("Yeni kayıt ekleme yetkiniz yok.", "warning");
            return;
        }
        if (duzenlemeId && !perms.canEdit) {
            openSnack("Düzenleme yetkiniz yok.", "warning");
            return;
        }

        // Kesinti kontrolü: Form henüz gönderilmediyse ve kesinti gerekiyorsa diyaloğu aç
        if (kesintiGerekirMi() && !formSubmitBekliyor) {
            setKesintiOpen(true);
            return;
        }

        const kullanici = getMevcutKullanici();

        const payload = {
            ...form,
            gun_sayisi: Number(form.gun_sayisi) || 0,
            is_basi_tarihi: form.is_basi_tarihi || null,
            yukleme_tarihi: form.yukleme_tarihi || null,
            ekleyen_kullanici: kullanici,
            eklenme_tarihi: new Date().toISOString().slice(0, 10), // Sadece tarih tutuluyor
        };

        let result;
        if (duzenlemeId) {
            result = await supabase.from("izinler").update(payload).eq("id", duzenlemeId);
        } else {
            // Yeni kayıt eklenirken eklenme_tarihi ayarlanır
            result = await supabase.from("izinler").insert([payload]);
        }

        if (result.error) {
            openSnack("Kayıt sırasında bir hata oluştu: " + result.error.message, "error");
            setFormSubmitBekliyor(false); // Hata durumunda bekleme durumunu sıfırla
            return;
        }

        // Kesinti kaydı oluştur (kesinti diyaloğu üzerinden gelindiyse)
        if (kesintiBilgisi.neden && kesintiBilgisi.tur && kesintiGerekirMi()) {
            const isBasiDayjs = dayjs(form.is_basi_tarihi);
            const yuklemeDayjs = dayjs(form.yukleme_tarihi);

            const kesintiGunSayisi = Math.max(
                0,
                yuklemeDayjs.diff(isBasiDayjs, 'day') // Gün farkı
            );

            // Önce mevcut kesintiyi (eğer varsa ve aynı tarih aralığındaysa) temizle
            await supabase
                .from("kesintiler")
                .delete()
                .eq("plaka_treyler", form.plaka_treyler)
                .eq("baslangic_tarihi", form.is_basi_tarihi)
                .eq("bitis_tarihi", form.yukleme_tarihi);

            // Yeni kesintiyi kaydet
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
                    eklenme_tarihi: new Date().toISOString().slice(0, 10),
                },
            ]);
        }

        openSnack(duzenlemeId ? "Kayıt başarıyla güncellendi. ✅" : "Yeni izin kaydı eklendi. 🎉");
        setForm({ ...BOS_FORM });
        setDuzenlemeId(null);
        setKesintiBilgisi({ neden: "", tur: "" });
        setKesintiOpen(false);
        setFormOpen(false);
        setFormSubmitBekliyor(false);
        verileriGetir();
    };

    const handleKesintiDevam = () => {
        if (!kesintiBilgisi.neden || !kesintiBilgisi.tur) {
            openSnack("Lütfen kesinti nedeni ve türünü seçin.", "error");
            return;
        }
        setKesintiOpen(false);
        setFormSubmitBekliyor(true); // handleSubmit'i tetikle
    };

    const exportToExcel = () => {
        if (filtrelenmisIzinler.length === 0) {
            openSnack("Dışa aktarılacak veri bulunmuyor.", "info");
            return;
        }

        const worksheetData = filtrelenmisIzinler.map((i) => ({
            PLAKA: i.plaka_treyler,
            SÜRÜCÜ: i.surucu_adi,
            "SÜRÜCÜ TELEFON": i.surucu_telefon,
            "SÜRÜCÜ TC": i.surucu_tc,
            "İZİN TÜRÜ": i.izin_turu,
            BAŞLANGIÇ: i.baslangic_tarihi ? dayjs(i.baslangic_tarihi).format("DD.MM.YYYY") : "-",
            BİTİŞ: i["bitis_tarihi"] ? dayjs(i["bitis_tarihi"]).format("DD.MM.YYYY") : "-",
            "İŞ BAŞI TARİHİ": i.is_basi_tarihi ? dayjs(i.is_basi_tarihi).format("DD.MM.YYYY") : "-",
            "YÜKLEME TARİHİ": i.yukleme_tarihi ? dayjs(i.yukleme_tarihi).format("DD.MM.YYYY") : "-",
            "TOPLAM GÜN": i.gun_sayisi,
            AÇIKLAMA: i.aciklama,
            "İZİN VEREN": i.ekleyen_kullanici,
            "İZİN VERİLEN TARİH": i.eklenme_tarihi ? dayjs(i.eklenme_tarihi).format("DD.MM.YYYY") : "-",
        }));

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Izinler");
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([buf], { type: "application/octet-stream" }), `izin_kayitlari_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
    };

    /* ===================== Filtreleme Logiği ===================== */
    const filtrelenmisIzinler = useMemo(() => {
        const matches = (item, key, val) =>
            val === "" || String(item[key] || "").toLowerCase().includes(String(val).toLowerCase());

        return izinler.filter((i) => {
            // Başlangıç Ay/Yıl Filtresi
            const ayOk =
                !filtreler.baslangic_tarihi ||
                (i.baslangic_tarihi &&
                    dayjs(i.baslangic_tarihi).format("YYYY-MM") === filtreler.baslangic_tarihi);

            // Diğer alanlar
            const diger =
                matches(i, "plaka_treyler", filtreler.plaka_treyler) &&
                matches(i, "surucu_adi", filtreler.surucu_adi) &&
                matches(i, "izin_turu", filtreler.izin_turu) &&
                (filtreler.bitis_tarihi === "" || i.bitis_tarihi === filtreler.bitis_tarihi) &&
                (filtreler.is_basi_tarihi === "" || i.is_basi_tarihi === filtreler.is_basi_tarihi) &&
                (filtreler.yukleme_tarihi === "" || i.yukleme_tarihi === filtreler.yukleme_tarihi) &&
                (filtreler.gun_sayisi === "" || Number(i.gun_sayisi) === Number(filtreler.gun_sayisi)) &&
                matches(i, "aciklama", filtreler.aciklama) &&
                matches(i, "ekleyen_kullanici", filtreler.ekleyen_kullanici) &&
                (filtreler.eklenme_tarihi === "" || i.eklenme_tarihi === filtreler.eklenme_tarihi);


            return ayOk && diger;
        });
    }, [izinler, filtreler]);

    /* ===================== DataGrid Kolonları ===================== */
    const columns = [
        { field: "plaka_treyler", headerName: "PLAKA", flex: 1, minWidth: 160 },
        { field: "surucu_adi", headerName: "SÜRÜCÜ", flex: 1, minWidth: 140 },
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
        { field: "gun_sayisi", headerName: "GÜN", width: 90, type: 'number' },
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
                    <Tooltip title="İş Başı ve/veya Yükleme tarihi eksik">
                        <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="Eksik"
                            icon={<WarningIcon fontSize="small" />}
                        />
                    </Tooltip>
                ) : (
                    <Chip
                        size="small"
                        color="success"
                        variant="filled"
                        label="Tamam"
                        icon={<CheckCircleIcon fontSize="small" />}
                    />
                );
            },
        },
        {
            field: "actions",
            headerName: "İŞLEM",
            width: 130,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => (
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title={perms.canEdit ? "Düzenle" : "Yetkiniz yok"}>
                        <span>
                            <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleDuzenle(params.row)}
                                disabled={!perms.canEdit}
                            >
                                <EditIcon fontSize="inherit" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={perms.canDelete ? "Sil" : "Yetkiniz yok"}>
                        <span>
                            <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleSil(params.row.id)}
                                disabled={!perms.canDelete}
                            >
                                <DeleteIcon fontSize="inherit" />
                            </IconButton>
                        </span>
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
                    <Container
                        maxWidth={false}
                        disableGutters
                        sx={{ width: 1920, height: 1080, mx: "auto", p: 3, boxSizing: "border-box" }}
                    >
                        <Helmet>
                            <title>İZİN KAYITLARI YÖNETİMİ | ODYSSEY</title>
                        </Helmet>

                        <Stack spacing={3} sx={{ height: "100%", minHeight: 0 }}>
                            {/* Header + Actions */}
                            <Stack
                                direction={{ xs: "column", md: "row" }}
                                alignItems={{ xs: "flex-start", md: "center" }}
                                justifyContent="space-between"
                                gap={2}
                                sx={{ mb: 1 }}
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
                                        İZİN KAYITLARI YÖNETİMİ
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                        Personel ve araç izin girişlerini yönetin.
                                    </Typography>
                                </Stack>

                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="small">
                                        Geri
                                    </Button>
                                    <Button variant="text" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)} size="small">
                                        Anasayfa
                                    </Button>
                                    <Tooltip title={perms.canCreate ? "Yeni İzin Kaydı Ekle" : "Yetkiniz yok"}>
                                        <span>
                                            <Button
                                                variant="contained"
                                                startIcon={<AddIcon />}
                                                onClick={handleYeniIzin}
                                                disabled={!perms.canCreate || permLoading}
                                                size="small"
                                                sx={{ height: 40, px: 2.5 }}
                                            >
                                                Yeni İzin
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Stack>

                            {/* KPI Cards */}
                            <Grid container spacing={3}>
                                {[
                                    { label: "Toplam Kayıt", value: toplamKayit, color: "primary" },
                                    { label: `Bu Ay İzin`, value: buAy, color: "secondary" },
                                    { label: "Filtrelenmiş Kayıt", value: filtrelenmisIzinler.length, color: "success" },
                                    { label: "Yetki Durumu", value: permLoading ? "Yükleniyor..." : "Tamam", color: permLoading ? "warning" : "info" },
                                ].map((kpi, idx) => (
                                    <Grid item xs={12} sm={6} md={3} key={idx}>
                                        <Card sx={{ borderRadius: 3, height: "100%", minWidth: 200 }}>
                                            <CardContent>
                                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                                                        {kpi.label}
                                                    </Typography>
                                                    <Badge color={kpi.color} variant="dot" overlap="circular" sx={{ '& .MuiBadge-dot': { width: 10, height: 10, borderRadius: '50%' } }} />
                                                </Stack>
                                                <Typography variant="h4" mt={0.5} fontWeight={800} color={`${kpi.color}.main`}>
                                                    {kpi.value}
                                                </Typography>
                                                <LinearProgress sx={{ mt: 2, height: 6, borderRadius: 3 }} color={kpi.color} variant="determinate" value={100} />
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>

                            {/* Grid */}
                            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                <Paper
                                    sx={{
                                        height: 750,
                                        borderRadius: 3,
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        overflow: 'hidden',
                                    }}
                                >
                                    {(loading || permLoading) && <LinearProgress color="secondary" />}

                                    <Box sx={{ height: "100%", width: "100%", minHeight: 0 }}>
                                        <DataGrid
                                            rows={filtrelenmisIzinler}
                                            columns={columns}
                                            getRowId={(r) => r.id}
                                            loading={loading || permLoading}
                                            disableRowSelectionOnClick
                                            pagination={false}
                                            hideFooter
                                            density="compact"
                                            rowHeight={40}
                                            columnHeaderHeight={48}
                                            localeText={GRID_TR}
                                            slots={{
                                                toolbar: () => (
                                                    <CustomToolbar
                                                        onFilters={() => setFiltreDrawer(true)}
                                                        onExport={exportToExcel}
                                                        onRefresh={() => {
                                                            verileriGetir();
                                                            loadPermissions().catch(() => { });
                                                        }}
                                                    />
                                                ),
                                            }}
                                            sx={{
                                                border: "none",
                                                '& .MuiDataGrid-virtualScroller': {
                                                    overflowX: 'auto',
                                                },
                                            }}
                                        />
                                    </Box>
                                </Paper>
                            </Box>
                        </Stack>

                        {/* Filtre Drawer */}
                        <Drawer
                            anchor="right"
                            open={filtreDrawer}
                            onClose={() => setFiltreDrawer(false)}
                            slotProps={{
                                paper: {
                                    sx: {
                                        width: 420,
                                        backgroundColor: "#171E2D",
                                        color: "text.primary",
                                        p: 3,
                                        borderLeft: "1px solid rgba(255,255,255,0.1)",
                                    },
                                },
                            }}
                        >
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                                <Typography variant="h5" fontWeight={700} color="secondary.main">Detaylı Filtreler</Typography>
                                <IconButton onClick={() => setFiltreDrawer(false)}>
                                    <CloseIcon />
                                </IconButton>
                            </Stack>
                            <Divider sx={{ mb: 3, borderColor: "rgba(255,255,255,0.12)" }} />

                            <Stack spacing={2.5}>
                                <Autocomplete
                                    size="small"
                                    freeSolo
                                    options={plakaListesi.map((p) => `${p.plaka} - ${p.treyler}`)}
                                    value={filtreler.plaka_treyler}
                                    onChange={(_, v) => setFiltreler((p) => ({ ...p, plaka_treyler: v || "" }))}
                                    onInputChange={(_, v) => setFiltreler((p) => ({ ...p, plaka_treyler: v || "" }))}
                                    renderInput={(params) => <TextField {...params} label="Plaka - Treyler" fullWidth />}
                                />

                                <TextField
                                    size="small"
                                    label="Sürücü Adı"
                                    value={filtreler.surucu_adi}
                                    onChange={(e) => setFiltreler((p) => ({ ...p, surucu_adi: e.target.value }))}
                                    fullWidth
                                />

                                <Autocomplete
                                    size="small"
                                    freeSolo
                                    options={IZIN_TURLERI}
                                    value={filtreler.izin_turu}
                                    onChange={(_, v) => setFiltreler((p) => ({ ...p, izin_turu: v || "" }))}
                                    onInputChange={(_, v) => setFiltreler((p) => ({ ...p, izin_turu: v || "" }))}
                                    renderInput={(params) => <TextField {...params} label="İzin Türü" fullWidth />}
                                />

                                <DatePicker
                                    label="Başlangıç Ay/Yıl"
                                    views={["year", "month"]}
                                    format="MM/YYYY"
                                    value={filtreler.baslangic_tarihi ? dayjs(filtreler.baslangic_tarihi) : null}
                                    onChange={(d) =>
                                        setFiltreler((p) => ({
                                            ...p,
                                            baslangic_tarihi: d ? dayjs(d).format("YYYY-MM") : "",
                                        }))
                                    }
                                    slotProps={{ textField: { fullWidth: true, size: "small" } }}
                                />

                                <DatePicker
                                    label="Bitiş Tarihi"
                                    value={filtreler.bitis_tarihi ? dayjs(filtreler.bitis_tarihi) : null}
                                    onChange={(d) =>
                                        setFiltreler((p) => ({
                                            ...p,
                                            bitis_tarihi: d ? dayjs(d).format("YYYY-MM-DD") : "",
                                        }))
                                    }
                                    slotProps={{ textField: { fullWidth: true, size: "small" } }}
                                />

                                <TextField
                                    size="small"
                                    label="Toplam Gün"
                                    type="number"
                                    value={filtreler.gun_sayisi}
                                    onChange={(e) => setFiltreler((p) => ({ ...p, gun_sayisi: e.target.value }))}
                                    fullWidth
                                />
                                <TextField
                                    size="small"
                                    label="Açıklama"
                                    value={filtreler.aciklama}
                                    onChange={(e) => setFiltreler((p) => ({ ...p, aciklama: e.target.value }))}
                                    fullWidth
                                />
                                <TextField
                                    size="small"
                                    label="İzin Veren Kullanıcı"
                                    value={filtreler.ekleyen_kullanici}
                                    onChange={(e) =>
                                        setFiltreler((p) => ({
                                            ...p,
                                            ekleyen_kullanici: e.target.value,
                                        }))
                                    }
                                    fullWidth
                                />

                                <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        color="error"
                                        size="large"
                                        onClick={() =>
                                            setFiltreler({ ...BOS_FORM, ekleyen_kullanici: "", eklenme_tarihi: "" })
                                        }
                                    >
                                        Temizle
                                    </Button>
                                    <Button fullWidth variant="contained" color="primary" size="large" onClick={() => setFiltreDrawer(false)}>
                                        Uygula
                                    </Button>
                                </Stack>
                            </Stack>
                        </Drawer>

                        {/* Form Dialog */}
                        <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="lg" fullWidth>
                            <DialogTitle sx={{ pb: 0, pt: 3, px: 3 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack>
                                        <Typography variant="h5" fontWeight={800} color="primary.light">
                                            {duzenlemeId ? "İzin Kaydını Düzenle 📝" : "Yeni İzin Kaydı Girişi ➕"}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                            Lütfen zorunlu alanları (*) eksiksiz doldurun.
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
                                    mt: 2,
                                    borderTop: "1px solid rgba(255,255,255,0.1)",
                                    display: "grid",
                                    gap: 3,
                                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                                    p: 3,
                                }}
                            >
                                {/* Plaka - Treyler */}
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
                                            label="Plaka - Treyler *"
                                            fullWidth
                                            required
                                            helperText="Araç plaka ve treyler bilgisini seçin"
                                        />
                                    )}
                                    sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}
                                />

                                {/* İzin Türü */}
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
                                            label="İzin Türü *"
                                            required
                                            fullWidth
                                            helperText="İzin, Bakım İzni, Mazeret vb."
                                        />
                                    )}
                                />

                                {/* Sürücü Adı */}
                                <TextField
                                    size="small"
                                    label="Sürücü Adı"
                                    placeholder="Ad Soyad"
                                    value={form.surucu_adi}
                                    onChange={(e) => handleFormChange("surucu_adi", e.target.value)}
                                    fullWidth
                                    helperText="Plaka seçiminde otomatik dolar"
                                />
                                {/* Sürücü Telefon */}
                                <TextField
                                    size="small"
                                    label="Sürücü Telefon"
                                    value={form.surucu_telefon}
                                    onChange={(e) => handleFormChange("surucu_telefon", e.target.value)}
                                    fullWidth
                                    helperText="Plaka seçiminde otomatik dolar"
                                />
                                {/* Sürücü TC */}
                                <TextField
                                    size="small"
                                    label="Sürücü TC"
                                    value={form.surucu_tc}
                                    onChange={(e) => handleFormChange("surucu_tc", e.target.value)}
                                    fullWidth
                                    helperText="Plaka seçiminde otomatik dolar"
                                />


                                {/* Başlangıç Tarihi */}
                                <DatePicker
                                    label="Başlangıç Tarihi *"
                                    value={form.baslangic_tarihi ? dayjs(form.baslangic_tarihi) : null}
                                    onChange={(d) => handleFormChange("baslangic_tarihi", d ? dayjs(d).format("YYYY-MM-DD") : "")}
                                    slotProps={{
                                        textField: { fullWidth: true, required: true, size: "small", helperText: "İzinin başladığı gün" },
                                    }}
                                />

                                {/* Bitiş Tarihi */}
                                <DatePicker
                                    label="Bitiş Tarihi *"
                                    value={form.bitis_tarihi ? dayjs(form.bitis_tarihi) : null}
                                    onChange={(d) => handleFormChange("bitis_tarihi", d ? dayjs(d).format("YYYY-MM-DD") : "")}
                                    slotProps={{
                                        textField: { fullWidth: true, required: true, size: "small", helperText: "İzinin sona erdiği gün" },
                                    }}
                                />

                                {/* İş Başı Tarihi */}
                                <DatePicker
                                    label="İş Başı Tarihi"
                                    value={form.is_basi_tarihi ? dayjs(form.is_basi_tarihi) : null}
                                    onChange={(d) => handleFormChange("is_basi_tarihi", d ? dayjs(d).format("YYYY-MM-DD") : "")}
                                    slotProps={{
                                        textField: { fullWidth: true, size: "small", helperText: "Otomatik hesaplanır (Bitiş + 1)" },
                                    }}
                                    disabled
                                />

                                {/* Yükleme Tarihi */}
                                <DatePicker
                                    label="Yükleme Tarihi"
                                    value={form.yukleme_tarihi ? dayjs(form.yukleme_tarihi) : null}
                                    onChange={(d) => handleFormChange("yukleme_tarihi", d ? dayjs(d).format("YYYY-MM-DD") : "")}
                                    slotProps={{
                                        textField: { fullWidth: true, size: "small", helperText: "İş başı sonrası ilk yükleme tarihi (Opsiyonel)" },
                                    }}
                                />

                                {/* Gün Sayısı (Disabled) */}
                                <TextField
                                    size="small"
                                    label="Toplam Gün"
                                    value={form.gun_sayisi || 0}
                                    fullWidth
                                    disabled
                                    helperText="Başlangıç ve bitiş dahil gün sayısı"
                                />

                                <Box sx={{ gridColumn: { xs: "1", md: "1 / -1" } }} />

                                {/* Açıklama (Geniş alan) */}
                                <TextField
                                    size="small"
                                    label="Açıklama / Notlar"
                                    value={form.aciklama}
                                    onChange={(e) => handleFormChange("aciklama", e.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={4}
                                    placeholder="Gerekçe, ek notlar veya kesinti açıklaması..."
                                    sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}
                                />
                            </DialogContent>

                            <DialogActions
                                sx={{
                                    p: 3,
                                    justifyContent: 'flex-end',
                                    borderTop: "1px solid rgba(255,255,255,0.1)",
                                }}
                            >
                                <Button variant="text" onClick={() => setFormOpen(false)} size="large">
                                    Kapat
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={handleSubmit}
                                    size="large"
                                    color="primary"
                                    disabled={!form.plaka_treyler || !form.izin_turu || !form.baslangic_tarihi || !form.bitis_tarihi}
                                    sx={{ px: 4, py: 1.5 }}
                                >
                                    {duzenlemeId ? "GÜNCELLE" : "KAYDET"}
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Kesinti Diyaloğu */}
                        <Dialog open={kesintiOpen} onClose={() => setKesintiOpen(false)} maxWidth="sm" fullWidth>
                            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
                                <WarningIcon /> Kesinti Tespiti
                            </DialogTitle>
                            <DialogContent dividers>
                                <Typography sx={{ mb: 2 }}>
                                    **İş Başı Tarihi** ({safeDateValueFormatter({ value: form.is_basi_tarihi })}) ile **Yükleme Tarihi** ({safeDateValueFormatter({ value: form.yukleme_tarihi })}) arasında **{Math.max(0, dayjs(form.yukleme_tarihi).diff(dayjs(form.is_basi_tarihi), 'day'))} gün** fark tespit edildi. Bu durum için bir **kesinti kaydı** oluşturulmalıdır.
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Kesinti Nedeni *</InputLabel>
                                            <Select
                                                label="Kesinti Nedeni *"
                                                value={kesintiBilgisi.neden}
                                                onChange={(e) => setKesintiBilgisi((p) => ({ ...p, neden: e.target.value }))}
                                            >
                                                <MenuItem value="Tedarikçi Kaynaklı">Tedarikçi Kaynaklı</MenuItem>
                                                <MenuItem value="Odak Kaynaklı">Odak Kaynaklı</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Kesinti Türü *</InputLabel>
                                            <Select
                                                label="Kesinti Türü *"
                                                value={kesintiBilgisi.tur}
                                                onChange={(e) => setKesintiBilgisi((p) => ({ ...p, tur: e.target.value }))}
                                            >
                                                <MenuItem value="Bakım">Bakım</MenuItem>
                                                <MenuItem value="Servis">Servis</MenuItem>
                                                <MenuItem value="Arıza">Arıza</MenuItem>
                                                <MenuItem value="Kaza">Kaza</MenuItem>
                                                <MenuItem value="Bölgede İş Yok">Bölgede İş Yok</MenuItem>
                                                <MenuItem value="Diğer">Diğer</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <Grid item xs={12}>
                                        <TextField size="small" label="Plaka - Treyler" value={form.plaka_treyler} fullWidth disabled />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField size="small" label="Başlangıç (İş Başı)" value={safeDateValueFormatter({ value: form.is_basi_tarihi })} fullWidth disabled />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField size="small" label="Bitiş (Yükleme)" value={safeDateValueFormatter({ value: form.yukleme_tarihi })} fullWidth disabled />
                                    </Grid>
                                </Grid>
                            </DialogContent>
                            <DialogActions sx={{ p: 2 }}>
                                <Button variant="text" onClick={() => setKesintiOpen(false)}>
                                    Vazgeç
                                </Button>
                                <Button
                                    variant="contained"
                                    color="warning"
                                    disabled={!kesintiBilgisi.neden || !kesintiBilgisi.tur}
                                    onClick={handleKesintiDevam}
                                >
                                    Kesintiyi Kaydet ve Devam Et
                                </Button>
                            </DialogActions>
                        </Dialog>

                        <Snackbar
                            open={snack.open}
                            autoHideDuration={3000}
                            onClose={() => setSnack((s) => ({ ...s, open: false }))}
                            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                        >
                            <Alert
                                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                                severity={snack.severity}
                                variant="filled"
                                sx={{ width: "100%", borderRadius: 2 }}
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
