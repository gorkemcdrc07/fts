// src/aracDurum/IzinGirisi.js
import React, { useEffect, useMemo, useState, useLayoutEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useNavigate } from "react-router-dom";

// MUI
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

// DataGrid & Date Pickers
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
dayjs.extend(customParseFormat);

/* ===================== Sabitler ve Yardımcılar ===================== */
const SCREEN_KEY = "izin_yonetimi";
const HOME_PATH = "/anasayfa";
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;
const MAX_SCALE = Infinity;

const BOS_FORM = {
    plaka_treyler: "", // ARTIK SADECE PLAKA TUTULUYOR
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

const FILTRE_BOS = {
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
};

const IZIN_TURLERI = ["İzin", "Bakım İzni", "Mazeret İzni"];

const getMevcutKullanici = () => localStorage.getItem("kullanici") || "Bilinmeyen Kullanıcı";

const hesaplaGunSayisi = (baslangicStr, bitisStr) => {
    if (!baslangicStr || !bitisStr) return 0;
    const d1 = dayjs(baslangicStr).startOf("day");
    const d2 = dayjs(bitisStr).startOf("day");
    const fark = d2.diff(d1, "day");
    return fark >= 0 ? fark + 1 : 0;
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

/* ===================== DataGrid TR ===================== */
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
        primary: { main: "#8B5CF6" },
        secondary: { main: "#22D3EE" },
        background: {
            default: "#0B1220",
            paper: alpha("#1E293B", 0.95),
        },
        success: { main: "#10B981" },
        error: { main: "#F43F5E" },
        info: { main: "#3B82F6" },
        warning: { main: "#F59E0B" },
    },
    shape: { borderRadius: 12 },
    typography: {
        fontFamily: 'Inter, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        button: { textTransform: "none", fontWeight: 600 },
        h4: { fontWeight: 800 },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                html: { scrollbarGutter: "stable" },
                "*::-webkit-scrollbar": { width: "8px", height: "8px" },
                "*::-webkit-scrollbar-thumb": {
                    backgroundColor: alpha("#8B5CF6", 0.5),
                    borderRadius: "10px",
                },
                "*::-webkit-scrollbar-track": { backgroundColor: alpha("#1E293B", 0.7) },
            },
        },
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: "0 10px 30px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05) inset",
                    backdropFilter: "blur(4px)",
                    backgroundColor: alpha("#1E293B", 0.9),
                },
            },
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
                },
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
                },
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
            },
        },
    },
});

/* ===================== Zoom'dan Bağımsız Ekrana Sığdırma ===================== */
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
                background: "linear-gradient(180deg, rgba(10,16,30,0.95) 0%, rgba(10,16,30,0.8) 100%)",
                borderBottom: "2px solid rgba(139,92,246,0.2)",
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
    const [plakaListesi, setPlakaListesi] = useState([]); // plakalar tablosundan gelen liste

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
    const [filtreler, setFiltreler] = useState({ ...FILTRE_BOS });

    // Yetki State
    const [permLoading, setPermLoading] = useState(true);
    const [perms, setPerms] = useState({
        canCreate: false,
        canEdit: false,
        canDelete: false,
    });

    const openSnack = (msg, severity = "success") => setSnack({ open: true, msg, severity });

    const kesintiGerekirMi = () => {
        const yukleme = form.yukleme_tarihi ? dayjs(form.yukleme_tarihi) : null;
        const isBasi = form.is_basi_tarihi ? dayjs(form.is_basi_tarihi) : null;
        if (!yukleme || !isBasi) return false;
        const farkGun = yukleme.diff(isBasi, "day");
        return farkGun > 0;
    };

    const verileriGetir = async () => {
        setLoading(true);
        const { data, error } = await supabase.from("izinler").select("*").order("id", { ascending: false });

        if (!error) {
            const cleaned = (data || []).map((r) => ({
                ...r,
                baslangic_tarihi: r.baslangic_tarihi ? String(r.baslangic_tarihi).slice(0, 10) : null,
                bitis_tarihi: r.bitis_tarihi ? String(r.bitis_tarihi).slice(0, 10) : null,
                is_basi_tarihi: r.is_basi_tarihi ? String(r.is_basi_tarihi).slice(0, 10) : null,
                yukleme_tarihi: r.yukleme_tarihi ? String(r.yukleme_tarihi).slice(0, 10) : null,
                eklenme_tarihi: r.eklenme_tarihi ? String(r.eklenme_tarihi).slice(0, 10) : null,
            }));
            setIzinler(cleaned);
        } else {
            console.error("SUPABASE READ ERROR:", error);
            openSnack("İzinler alınamadı: " + error.message, "error");
        }
        setLoading(false);
    };

    const plakalariGetir = async () => {
        // ⚠️ TREYLER YOK. SADECE PLAKA + SÜRÜCÜ ALIYORUZ.
        const selectCols = "plaka, surucu_adi, surucu_telefon, surucu_tc";

        const q1 = await supabase.from("plakalar").select(selectCols).is("statu", null);
        const q2 = await supabase.from("plakalar").select(selectCols).neq("statu", "ÇIKARILDI");

        const error = q1.error || q2.error;
        if (error) {
            console.error("SUPABASE PLAKALAR ERROR:", error);
            openSnack("Plakalar alınamadı: " + error.message, "error");
            return;
        }

        const merged = [...(q1.data || []), ...(q2.data || [])];

        // plaka bazlı tekilleştir
        const map = new Map();
        for (const r of merged) {
            const key = String(r.plaka ?? "").trim();
            if (key) map.set(key, { ...r, plaka: key });
        }
        setPlakaListesi([...map.values()]);
    };

    const handleSubmit = useCallback(async () => {
        // Zorunlu alanlar
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

        // Kesinti kontrolü
        if (kesintiGerekirMi() && !formSubmitBekliyor) {
            setKesintiOpen(true);
            return;
        }

        const kullanici = getMevcutKullanici();

        // ✅ TREYLER YOK: plaka_treyler alanına artık SADECE PLAKA yazıyoruz.
        // ✅ Boş string yerine NULL
        const payload = {
            plaka_treyler: form.plaka_treyler?.trim() || null,
            surucu_adi: form.surucu_adi?.trim() || null,
            surucu_telefon: form.surucu_telefon?.trim() || null,
            surucu_tc: form.surucu_tc?.trim() || null,
            izin_turu: form.izin_turu?.trim() || null,

            baslangic_tarihi: form.baslangic_tarihi || null,
            bitis_tarihi: form.bitis_tarihi || null,
            gun_sayisi: Number(form.gun_sayisi) || 0,
            is_basi_tarihi: form.is_basi_tarihi || null,
            yukleme_tarihi: form.yukleme_tarihi || null,

            aciklama: form.aciklama?.trim() || null,
            ekleyen_kullanici: kullanici,
            eklenme_tarihi: new Date().toISOString().slice(0, 10),
        };

        let result;
        if (duzenlemeId) {
            result = await supabase.from("izinler").update(payload).eq("id", duzenlemeId);
        } else {
            result = await supabase.from("izinler").insert([payload]);
        }

        if (result.error) {
            console.error("SUPABASE ERROR:", result.error);
            openSnack("Kayıt sırasında bir hata oluştu: " + result.error.message, "error");
            setFormSubmitBekliyor(false);
            return;
        }

        // Kesinti kaydı oluştur
        if (kesintiBilgisi.neden && kesintiBilgisi.tur && kesintiGerekirMi()) {
            const isBasiDayjs = dayjs(form.is_basi_tarihi);
            const yuklemeDayjs = dayjs(form.yukleme_tarihi);

            const kesintiGunSayisi = Math.max(0, yuklemeDayjs.diff(isBasiDayjs, "day"));

            // önce varsa sil
            await supabase
                .from("kesintiler")
                .delete()
                .eq("plaka_treyler", form.plaka_treyler?.trim() || "")
                .eq("baslangic_tarihi", form.is_basi_tarihi)
                .eq("bitis_tarihi", form.yukleme_tarihi);

            // yeni kesinti
            await supabase.from("kesintiler").insert([
                {
                    plaka_treyler: form.plaka_treyler?.trim() || "",
                    kesinti_turu: kesintiBilgisi.tur,
                    neden: kesintiBilgisi.neden,
                    baslangic_tarihi: form.is_basi_tarihi,
                    bitis_tarihi: form.yukleme_tarihi,
                    gun_sayisi: kesintiGunSayisi,
                    aciklama: form.aciklama?.trim() || "",
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
    }, [form, duzenlemeId, perms.canCreate, perms.canEdit, formSubmitBekliyor, kesintiBilgisi]);

    /* ===================== Effects ===================== */
    useEffect(() => {
        verileriGetir();
        plakalariGetir();
        loadPermissions().catch((e) => {
            console.error("perm load error:", e);
            setPerms({ canCreate: false, canEdit: false, canDelete: false });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (formSubmitBekliyor) {
            setFormSubmitBekliyor(false);
            handleSubmit();
        }
    }, [formSubmitBekliyor, handleSubmit]);

    /* ===================== KPI ===================== */
    const toplamKayit = izinler.length;
    const buAy = izinler.filter((r) => r.baslangic_tarihi && dayjs(r.baslangic_tarihi).isSame(dayjs(), "month")).length;

    /* ===================== Permissions Loader ===================== */
    async function loadPermissions() {
        try {
            setPermLoading(true);

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

            const ROLE_NAME_TO_KEY = { YÖNETİCİ: "YONETICI", OPERASYON: "OPERASYON", TAKİP: "TAKIP" };
            const looksLikeUUID = (s) =>
                typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

            let roleId = null;
            if (userRow.rol) {
                if (looksLikeUUID(userRow.rol)) {
                    roleId = userRow.rol;
                } else {
                    const roleKey =
                        ROLE_NAME_TO_KEY[String(userRow.rol || "").toUpperCase()] || String(userRow.rol || "").toUpperCase();
                    const { data: roleRow } = await supabase.from("roles").select("id,key").eq("key", roleKey).maybeSingle();
                    roleId = roleRow?.id || null;
                }
            }

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

            const { data: up } = await supabase
                .from("user_permissions")
                .select("izin_create, izin_edit, izin_delete")
                .eq("user_id", userRow.id)
                .maybeSingle();

            const coalesce = (u, r) => (typeof u === "boolean" ? u : !!r);
            const canCreate = coalesce(up?.izin_create, roleCreate);
            const canEdit = coalesce(up?.izin_edit, roleEdit);
            const canDelete = coalesce(up?.izin_delete, roleDelete);

            setPerms({ canCreate, canEdit, canDelete });
        } finally {
            setPermLoading(false);
        }
    }

    /* ===================== Handler Fonksiyonları ===================== */
    const handleFormChange = (name, value) => {
        const next = { ...form, [name]: value };

        if (name === "baslangic_tarihi" || name === "bitis_tarihi") {
            const { baslangic_tarihi, bitis_tarihi } = next;
            if (baslangic_tarihi && bitis_tarihi) {
                const farkGun = hesaplaGunSayisi(baslangic_tarihi, bitis_tarihi);
                next.gun_sayisi = farkGun > 0 ? farkGun : 0;

                const bitis = dayjs(bitis_tarihi);
                const isBasi = bitis.add(1, "day");
                next.is_basi_tarihi = isBasi.isValid() ? isBasi.format("YYYY-MM-DD") : null;
            } else {
                next.gun_sayisi = 0;
                next.is_basi_tarihi = null;
            }
        }

        setForm(next);
    };

    const handlePlakaSecimi = (value) => {
        const v = String(value || "").trim();
        const secilen = plakaListesi.find((p) => String(p.plaka) === v);

        if (secilen) {
            setForm((prev) => ({
                ...prev,
                plaka_treyler: v, // SADECE PLAKA
                surucu_adi: secilen.surucu_adi || "",
                surucu_telefon: secilen.surucu_telefon || "",
                surucu_tc: secilen.surucu_tc || "",
            }));
        } else {
            setForm((prev) => ({
                ...prev,
                plaka_treyler: v,
                surucu_adi: "",
                surucu_telefon: "",
                surucu_tc: "",
            }));
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
            bitis_tarihi: row.bitis_tarihi || "",
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

        // 1) izin kaydı
        const { data: izinKaydi, error: fetchErr } = await supabase
            .from("izinler")
            .select("plaka_treyler, is_basi_tarihi, yukleme_tarihi")
            .eq("id", id)
            .maybeSingle();

        if (fetchErr || !izinKaydi) {
            console.error("SUPABASE FETCH DELETE TARGET ERROR:", fetchErr);
            openSnack("Silinecek kayıt bulunamadı veya bir hata oluştu.", "error");
            return;
        }

        // 2) izin sil
        const { error: silErr } = await supabase.from("izinler").delete().eq("id", id);
        if (silErr) {
            console.error("SUPABASE DELETE ERROR:", silErr);
            openSnack("İzin kaydı silinirken hata oluştu: " + silErr.message, "error");
            return;
        }

        // 3) kesinti sil (varsa)
        if (izinKaydi.is_basi_tarihi && izinKaydi.yukleme_tarihi && izinKaydi.plaka_treyler) {
            await supabase
                .from("kesintiler")
                .delete()
                .eq("plaka_treyler", izinKaydi.plaka_treyler)
                .eq("baslangic_tarihi", izinKaydi.is_basi_tarihi)
                .eq("bitis_tarihi", izinKaydi.yukleme_tarihi);
        }

        // 4) plakalar statu update (SADECE PLAKA)
        const plaka = String(izinKaydi.plaka_treyler || "").trim();
        if (plaka) {
            await supabase
                .from("plakalar")
                .update({
                    statu: "İZİNDEN ÇIKTI",
                    izin_baslangic_tarihi: null,
                    izin_bitis_tarihi: null,
                    izinden_cikisi: new Date().toISOString(),
                })
                .eq("plaka", plaka);
        }

        openSnack("Kayıt başarıyla silindi.", "info");
        verileriGetir();
    };

    const handleKesintiDevam = () => {
        if (!kesintiBilgisi.neden || !kesintiBilgisi.tur) {
            openSnack("Lütfen kesinti nedeni ve türünü seçin.", "error");
            return;
        }
        setKesintiOpen(false);
        setFormSubmitBekliyor(true);
    };

    /* ===================== Excel Export ===================== */
    const filtrelenmisIzinler = useMemo(() => {
        const matches = (item, key, val) =>
            val === "" || String(item[key] || "").toLowerCase().includes(String(val).toLowerCase());

        return izinler.filter((i) => {
            const ayOk =
                !filtreler.baslangic_tarihi ||
                (i.baslangic_tarihi && dayjs(i.baslangic_tarihi).format("YYYY-MM") === filtreler.baslangic_tarihi);

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

    const exportToExcel = async () => {
        if (filtrelenmisIzinler.length === 0) {
            openSnack("Dışa aktarılacak veri bulunmuyor.", "info");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Izinler");

        const headerMap = [
            "plaka_treyler",
            "surucu_adi",
            "surucu_telefon",
            "surucu_tc",
            "izin_turu",
            "baslangic_tarihi",
            "bitis_tarihi",
            "gun_sayisi",
            "is_basi_tarihi",
            "yukleme_tarihi",
            "aciklama",
            "ekleyen_kullanici",
            "eklenme_tarihi",
        ];

        worksheet.columns = headerMap.map((key) => {
            const isDate = key.includes("tarih");
            return {
                header: key.replace(/_/g, " ").toUpperCase(),
                key,
                width: key === "aciklama" ? 30 : 15,
                style: { numFmt: isDate ? "dd.mm.yyyy" : undefined },
            };
        });

        const dataToExport = filtrelenmisIzinler.map((i) => {
            const row = {};
            headerMap.forEach((key) => {
                const value = i[key];
                if (key.includes("tarih") && value) {
                    const d = dayjs(value);
                    row[key] = d.isValid() ? d.toDate() : value;
                } else {
                    row[key] = value;
                }
            });
            return row;
        });

        worksheet.addRows(dataToExport);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        saveAs(blob, `izin_kayitlari_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
    };

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
        { field: "gun_sayisi", headerName: "GÜN", width: 90, type: "number" },
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
                        <Chip size="small" color="warning" variant="outlined" label="Eksik" icon={<WarningIcon fontSize="small" />} />
                    </Tooltip>
                ) : (
                    <Chip size="small" color="success" variant="filled" label="Tamam" icon={<CheckCircleIcon fontSize="small" />} />
                );
            },
        },
        {
            field: "actions",
            headerName: "İŞLEM",
            width: 130,
            sortable: false,
            filterable: false,
            align: "center",
            headerAlign: "center",
            renderCell: (params) => (
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title={perms.canEdit ? "Düzenle" : "Yetkiniz yok"}>
                        <span>
                            <IconButton size="small" color="primary" onClick={() => handleDuzenle(params.row)} disabled={!perms.canEdit}>
                                <EditIcon fontSize="inherit" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={perms.canDelete ? "Sil" : "Yetkiniz yok"}>
                        <span>
                            <IconButton size="small" color="error" onClick={() => handleSil(params.row.id)} disabled={!perms.canDelete}>
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
                    <Container maxWidth={false} disableGutters sx={{ width: 1920, height: 1080, mx: "auto", p: 3, boxSizing: "border-box" }}>
                        <Helmet>
                            <title>İZİN KAYITLARI YÖNETİMİ | ODYSSEY</title>
                        </Helmet>

                        <Stack spacing={3} sx={{ height: "100%", minHeight: 0 }}>
                            {/* Header */}
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
                                                color="success"
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
                                                    <Badge
                                                        color={kpi.color}
                                                        variant="dot"
                                                        overlap="circular"
                                                        sx={{ "& .MuiBadge-dot": { width: 10, height: 10, borderRadius: "50%" } }}
                                                    />
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
                                        overflow: "hidden",
                                    }}
                                >
                                    {(loading || permLoading) && <LinearProgress color="secondary" />}

                                    <Box sx={{ height: "100%", width: "100%", minHeight: 0, pt: loading || permLoading ? 0 : 1 }}>
                                        <DataGrid
                                            rows={filtrelenmisIzinler}
                                            columns={columns}
                                            getRowId={(r) => r.id}
                                            loading={loading || permLoading}
                                            disableRowSelectionOnClick
                                            hideFooter
                                            density="compact"
                                            rowHeight={40}
                                            columnHeaderHeight={48}
                                            localeText={GRID_TR}
                                            slots={{
                                                toolbar: () => (
                                                    <CustomToolbar onFilters={() => setFiltreDrawer(true)} onExport={exportToExcel} onRefresh={verileriGetir} />
                                                ),
                                            }}
                                            sx={{
                                                border: "none",
                                                height: "100%",
                                                fontSize: 14,
                                                "& .MuiDataGrid-virtualScroller": { overflowX: "auto" },
                                                "& .MuiDataGrid-columnHeaders": {
                                                    backgroundColor: "#171E2D",
                                                    color: "#C8D1E6",
                                                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                                                },
                                                "& .MuiDataGrid-row:nth-of-type(odd)": {
                                                    backgroundColor: alpha("#1E293B", 0.7),
                                                },
                                                "& .MuiDataGrid-row:hover": {
                                                    backgroundColor: alpha("#8B5CF6", 0.15),
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
                            PaperProps={{
                                sx: {
                                    width: 420,
                                    backgroundColor: "#171E2D",
                                    color: "text.primary",
                                    borderLeft: "1px solid rgba(255,255,255,0.1)",
                                    p: 3,
                                },
                            }}
                        >
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                                <Typography variant="h5" fontWeight={700} color="secondary.main">
                                    Detaylı Filtreler
                                </Typography>
                                <IconButton onClick={() => setFiltreDrawer(false)}>
                                    <CloseIcon />
                                </IconButton>
                            </Stack>
                            <Divider sx={{ mb: 3, borderColor: "rgba(255,255,255,0.12)" }} />

                            <Stack spacing={2.5}>
                                <Autocomplete
                                    size="small"
                                    freeSolo
                                    autoSelect
                                    options={plakaListesi.map((p) => String(p.plaka))}
                                    value={filtreler.plaka_treyler}
                                    onChange={(_, v) => setFiltreler((p) => ({ ...p, plaka_treyler: v || "" }))}
                                    onInputChange={(_, v) => setFiltreler((p) => ({ ...p, plaka_treyler: v || "" }))}
                                    renderInput={(params) => <TextField {...params} label="Plaka" fullWidth />}
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
                                    onChange={(d) => setFiltreler((p) => ({ ...p, bitis_tarihi: d ? dayjs(d).format("YYYY-MM-DD") : "" }))}
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
                                    onChange={(e) => setFiltreler((p) => ({ ...p, ekleyen_kullanici: e.target.value }))}
                                    fullWidth
                                />

                                <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        color="error"
                                        size="large"
                                        onClick={() => setFiltreler({ ...FILTRE_BOS })}
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
                                {/* Plaka */}
                                <Autocomplete
                                    size="small"
                                    freeSolo
                                    autoSelect
                                    options={plakaListesi.map((p) => String(p.plaka))}
                                    value={form.plaka_treyler}
                                    onChange={(_, v) => handlePlakaSecimi(v || "")}
                                    onInputChange={(_, v) => handlePlakaSecimi(v || "")}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Plaka *" fullWidth required helperText="Araç plaka bilgisini seçin" />
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
                                        <TextField {...params} label="İzin Türü *" required fullWidth helperText="İzin, Bakım İzni, Mazeret vb." />
                                    )}
                                />

                                <TextField
                                    size="small"
                                    label="Sürücü Adı"
                                    placeholder="Ad Soyad"
                                    value={form.surucu_adi}
                                    onChange={(e) => handleFormChange("surucu_adi", e.target.value)}
                                    fullWidth
                                    helperText="Plaka seçiminde otomatik dolar"
                                />
                                <TextField
                                    size="small"
                                    label="Sürücü Telefon"
                                    value={form.surucu_telefon}
                                    onChange={(e) => handleFormChange("surucu_telefon", e.target.value)}
                                    fullWidth
                                    helperText="Plaka seçiminde otomatik dolar"
                                />
                                <TextField
                                    size="small"
                                    label="Sürücü TC"
                                    value={form.surucu_tc}
                                    onChange={(e) => handleFormChange("surucu_tc", e.target.value)}
                                    fullWidth
                                    helperText="Plaka seçiminde otomatik dolar"
                                />

                                <DatePicker
                                    label="Başlangıç Tarihi *"
                                    value={form.baslangic_tarihi ? dayjs(form.baslangic_tarihi) : null}
                                    onChange={(d) => handleFormChange("baslangic_tarihi", d ? dayjs(d).format("YYYY-MM-DD") : "")}
                                    slotProps={{
                                        textField: { fullWidth: true, required: true, size: "small", helperText: "İzinin başladığı gün" },
                                    }}
                                />

                                <DatePicker
                                    label="Bitiş Tarihi *"
                                    value={form.bitis_tarihi ? dayjs(form.bitis_tarihi) : null}
                                    onChange={(d) => handleFormChange("bitis_tarihi", d ? dayjs(d).format("YYYY-MM-DD") : "")}
                                    slotProps={{
                                        textField: { fullWidth: true, required: true, size: "small", helperText: "İzinin sona erdiği gün" },
                                    }}
                                />

                                <DatePicker
                                    label="İş Başı Tarihi"
                                    value={form.is_basi_tarihi ? dayjs(form.is_basi_tarihi) : null}
                                    onChange={(d) => handleFormChange("is_basi_tarihi", d ? dayjs(d).format("YYYY-MM-DD") : "")}
                                    slotProps={{
                                        textField: { fullWidth: true, size: "small", helperText: "Otomatik hesaplanır (Bitiş + 1)" },
                                    }}
                                    disabled
                                />

                                <DatePicker
                                    label="Yükleme Tarihi"
                                    value={form.yukleme_tarihi ? dayjs(form.yukleme_tarihi) : null}
                                    onChange={(d) => handleFormChange("yukleme_tarihi", d ? dayjs(d).format("YYYY-MM-DD") : "")}
                                    slotProps={{
                                        textField: { fullWidth: true, size: "small", helperText: "İş başı sonrası ilk yükleme tarihi (Opsiyonel)" },
                                    }}
                                />

                                <TextField size="small" label="Toplam Gün" value={form.gun_sayisi || 0} fullWidth disabled helperText="Başlangıç ve bitiş dahil gün sayısı" />

                                <Box sx={{ gridColumn: { xs: "1", md: "1 / -1" } }} />

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

                            <DialogActions sx={{ p: 3, justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
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
                            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: "warning.main" }}>
                                <WarningIcon /> Kesinti Tespiti
                            </DialogTitle>
                            <DialogContent dividers>
                                <Typography sx={{ mb: 2 }}>
                                    <b>İş Başı Tarihi</b> ({safeDateValueFormatter({ value: form.is_basi_tarihi })}) ile <b>Yükleme Tarihi</b> (
                                    {safeDateValueFormatter({ value: form.yukleme_tarihi })}) arasında{" "}
                                    <b>{Math.max(0, dayjs(form.yukleme_tarihi).diff(dayjs(form.is_basi_tarihi), "day"))} gün</b> fark tespit edildi.
                                    Bu durum için bir <b>kesinti kaydı</b> oluşturulmalıdır.
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
                                        <TextField size="small" label="Plaka" value={form.plaka_treyler} fullWidth disabled />
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
