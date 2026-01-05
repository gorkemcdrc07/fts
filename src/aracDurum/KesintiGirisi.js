import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import * as ExcelJS from "exceljs";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

// MUI
import {
    ThemeProvider,
    createTheme,
    CssBaseline,
    Container,
    Stack,
    Box,
    Grid,
    Paper,
    Button,
    IconButton,
    Typography,
    TextField,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Badge,
    Card,
    CardContent,
    LinearProgress,
    Drawer,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tooltip,
    Autocomplete,
    Snackbar,
    Alert,
    Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

// MUI Icons
import AddIcon from "@mui/icons-material/AddOutlined";
import DownloadIcon from "@mui/icons-material/DownloadOutlined";
import FilterListIcon from "@mui/icons-material/FilterListOutlined";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBackIosNewOutlined";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import RefreshIcon from "@mui/icons-material/RefreshOutlined";
import WarningIcon from "@mui/icons-material/WarningAmberOutlined";

// DataGrid
import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarQuickFilter,
    GridToolbarColumnsButton,
    GridToolbarDensitySelector,
} from "@mui/x-data-grid";

// Date & Localization
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import "dayjs/locale/tr";
dayjs.locale("tr");

/* ===================== Yetkilendirme ve Sabitler ===================== */
const SCREEN_KEY = "kesinti_yonetimi";
const USER_KEYS = { create: "kes_create", edit: "kes_edit", delete: "kes_delete" };

/* ===================== Zoom’dan Bağımsız Ekrana Sığdırma ===================== */
const HOME_PATH = "/anasayfa";
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;
const MAX_SCALE = Infinity;

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

/* ===================== Grid TR ===================== */
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
    toolbarQuickFilterPlaceholder: "Hızlı Ara…",
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

/* ===================== Tema ===================== */
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
            defaultProps: { size: "small" },
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    boxShadow: "0 4px 15px rgba(139,92,246,0.2)",
                    transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
                    ":hover": { boxShadow: "0 6px 20px rgba(139,92,246,0.3)" },
                },
                outlined: { border: "1px solid rgba(255,255,255,0.12)" },
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
            defaultProps: { variant: "outlined", size: "small" },
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

/* ===================== Helpers ===================== */
const BOS_FORM = {
    plaka_treyler: "",
    kesinti_turu: "",
    neden: "",
    baslangic_tarihi: "",
    bitis_tarihi: "",
    gun_sayisi: "",
    aciklama: "",
    ucret_tutari: 0, // sadece Köprü/Feribot/Diğer seçilince kullanılacak
};

const BOS_FILTRE = {
    plaka_treyler: "",
    kesinti_turu: "",
    neden: "",
    baslangic_tarihi: "",
    bitis_tarihi: "",
    gun_sayisi: "",
    aciklama: "",
    ekleyen_kullanici: "",
    ay: "",
};

const KESINTI_TURLERI = ["Bakım", "Servis", "Arıza", "Kaza", "Bölgede İş Yok", "İş Başı", "İş Sonu", "Köprü", "Feribot", "Diğer"];
const UCRET_TURLERI = ["Köprü", "Feribot", "Diğer"];
const isUcretTuru = (tur) => UCRET_TURLERI.includes(tur);

const KESINTI_NEDENLERI = ["Tedarikçi Kaynaklı", "Odak Kaynaklı"];

const getMevcutKullanici = () => localStorage.getItem("kullanici") || "Bilinmeyen Kullanıcı";

const hesaplaGun = (start, end) => {
    if (!start || !end) return "";
    const d1 = dayjs(start).startOf("day");
    const d2 = dayjs(end).startOf("day");
    const fark = d2.diff(d1, "day");
    return fark >= 0 ? fark + 1 : 0;
};

const asMoney = (v) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
};

const safeDateValueGetter = (arg) => {
    const v = arg?.value ?? arg;
    if (!v) return null;
    const s = String(v).slice(0, 10);
    const parts = s.split("-");
    if (parts.length !== 3) {
        const d = dayjs(s);
        return d.isValid() ? d.toDate() : null;
    }
    const utcDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    if (isNaN(utcDate.getTime())) return null;
    return utcDate;
};

const safeDateValueFormatter = (arg) => {
    const v = arg?.value ?? arg;
    if (!v) return "-";
    const d = dayjs(v);
    return d.isValid() ? d.format("DD.MM.YYYY") : "-";
};

const getRowFiyat = (row) => {
    if (!row) return 0;
    if (row.kesinti_turu === "Köprü") return row.kopru_ucreti ?? 0;
    if (row.kesinti_turu === "Feribot") return row.feribot_ucreti ?? 0;
    if (row.kesinti_turu === "Diğer") return row.diger_ucreti ?? 0;
    return 0;
};

/* ===================== Toolbar ===================== */
function CustomToolbar({ onFilters, onExport, onRefresh, onReport }) {
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
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExport}>
                Excel'e Aktar
            </Button>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRefresh}>
                Yenile
            </Button>
            <Button variant="outlined" startIcon={<WarningIcon />} onClick={onReport}>
                Rapor
            </Button>
        </GridToolbarContainer>
    );
}

/* ===================== Component ===================== */
export default function KesintiGirisi() {
    const navigate = useNavigate();

    const [form, setForm] = useState(BOS_FORM);
    const [kesintiler, setKesintiler] = useState([]);
    const [plakalar, setPlakalar] = useState([]);
    const [formOpen, setFormOpen] = useState(false);
    const [filtreDrawer, setFiltreDrawer] = useState(false);
    const [raporOpen, setRaporOpen] = useState(false);

    const [raporForm, setRaporForm] = useState({ ay: "", plaka_treyler: "" });
    const [raporSonuc, setRaporSonuc] = useState({ toplamGun: 0, kesintiliGunler: [], tumGunler: [] });

    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

    const [formMode, setFormMode] = useState("create");
    const [editingId, setEditingId] = useState(null);

    const [filtreler, setFiltreler] = useState(BOS_FILTRE);

    const [permLoading, setPermLoading] = useState(true);
    const [perms, setPerms] = useState({ canCreate: false, canEdit: false, canDelete: false });
    const [loading, setLoading] = useState(false);

    const openSnack = (msg, severity = "success") => setSnack({ open: true, msg, severity });

    useEffect(() => {
        verileriGetir();
        plakalarGetir();
        loadPermissions().catch((e) => {
            console.error("perm load error:", e);
            setPerms({ canCreate: false, canEdit: false, canDelete: false });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function coalesceOverride(overrideVal, roleVal) {
        return overrideVal === true || overrideVal === false ? overrideVal : !!roleVal;
    }

    const looksLikeUUID = (s) =>
        typeof s === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

    async function loadPermissions() {
        try {
            setPermLoading(true);

            const ad = getMevcutKullanici();
            const { data: userRow, error: eU } = await supabase.from("login").select("id, rol, kullanici").eq("kullanici", ad).maybeSingle();
            if (eU) throw eU;
            if (!userRow) {
                setPerms({ canCreate: false, canEdit: false, canDelete: false });
                return;
            }

            let roleId = null;
            if (userRow.rol) {
                if (looksLikeUUID(userRow.rol)) {
                    roleId = userRow.rol;
                } else {
                    const roleKey = String(userRow.rol).toUpperCase();
                    const { data: roleRow, error: eR } = await supabase.from("roles").select("id,key").eq("key", roleKey).maybeSingle();
                    if (eR) throw eR;
                    roleId = roleRow?.id || null;
                }
            }

            let rolePerm = {};
            if (roleId) {
                const { data: rp, error: eRP } = await supabase
                    .from("role_permissions")
                    .select("*")
                    .eq("screen_key", SCREEN_KEY)
                    .eq("role_id", roleId)
                    .maybeSingle();
                if (eRP) throw eRP;
                rolePerm = rp || {};
            }

            const { data: up, error: eUP } = await supabase.from("user_permissions").select("*").eq("user_id", userRow.id).maybeSingle();
            if (eUP) throw eUP;

            const canCreate = coalesceOverride(up?.[USER_KEYS.create], rolePerm?.[USER_KEYS.create]);
            const canEdit = coalesceOverride(up?.[USER_KEYS.edit], rolePerm?.[USER_KEYS.edit]);
            const canDelete = coalesceOverride(up?.[USER_KEYS.delete], rolePerm?.[USER_KEYS.delete]);

            setPerms({ canCreate, canEdit, canDelete });
        } finally {
            setPermLoading(false);
        }
    }

    const verileriGetir = async () => {
        setLoading(true);
        const { data, error } = await supabase.from("kesintiler").select("*").order("id", { ascending: false });
        if (error) {
            openSnack("Veriler alınamadı.", "error");
            console.error(error);
        } else {
            setKesintiler(data || []);
        }
        setLoading(false);
    };

    const plakalarGetir = async () => {
        const { data, error } = await supabase.from("plakalar").select("plaka").or("statu.is.null,statu.neq.ÇIKARILDI");
        if (error) {
            console.error("Plakalar alınamadı:", error);
            openSnack("Plakalar alınamadı: " + error.message, "error");
        } else {
            setPlakalar(data || []);
        }
    };

    const plakaOptions = useMemo(
        () => (plakalar || []).map((p) => ({ label: `${(p.plaka || "").trim()}` })).filter((o) => o.label.trim() !== ""),
        [plakalar]
    );
    const plakaOptionsSet = useMemo(() => new Set(plakaOptions.map((o) => o.label)), [plakaOptions]);

    /* ===================== KPI & Filtreleme ===================== */
    const toplam = kesintiler.length;
    const buAy = useMemo(() => {
        const ym = dayjs().format("YYYY-MM");
        return kesintiler.filter((k) => String(k.baslangic_tarihi || "").startsWith(ym)).length;
    }, [kesintiler]);

    const filtrelenmisKesintiler = useMemo(() => {
        return kesintiler.filter((k) => {
            const metinlerTamam = Object.entries(filtreler).every(([key, deger]) => {
                if (!deger) return true;
                if (key === "ay") return true;
                if (key === "gun_sayisi") return String(k[key] || "") === String(deger);
                return String(k[key] ?? "").toLowerCase().includes(String(deger).toLowerCase());
            });
            if (!metinlerTamam) return false;

            if (filtreler.ay) {
                const ym = String(k.baslangic_tarihi || "").slice(0, 7);
                if (ym !== filtreler.ay) return false;
            }

            return true;
        });
    }, [kesintiler, filtreler]);

    /* ===================== Form & CRUD ===================== */
    const handleChange = (name, value) => {
        const next = { ...form, [name]: value };

        if (name === "baslangic_tarihi" || name === "bitis_tarihi") {
            const gunSayisi = hesaplaGun(next.baslangic_tarihi, next.bitis_tarihi);
            next.gun_sayisi = gunSayisi === "" ? "" : Number(gunSayisi);
        }

        if (name === "kesinti_turu") {
            if (!isUcretTuru(value)) {
                next.ucret_tutari = 0;
            }
        }

        setForm(next);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        if (formMode === "create" && !perms.canCreate) {
            openSnack("Yeni kesinti ekleme yetkiniz yok.", "warning");
            return;
        }
        if (formMode === "edit" && !perms.canEdit) {
            openSnack("Düzenleme yetkiniz yok.", "warning");
            return;
        }

        const { plaka_treyler, baslangic_tarihi, bitis_tarihi, kesinti_turu, neden, gun_sayisi, aciklama } = form;
        const ucretliTur = isUcretTuru(kesinti_turu);

        if (!plaka_treyler || !kesinti_turu || !neden) {
            openSnack("Lütfen tüm gerekli (*) alanları doldurun.", "error");
            return;
        }

        // ücretli değilse tarih zorunlu
        if (!ucretliTur) {
            if (!baslangic_tarihi || !bitis_tarihi) {
                openSnack("Lütfen başlangıç ve bitiş tarihini girin.", "error");
                return;
            }
        }

        if (!plakaOptionsSet.has(plaka_treyler)) {
            openSnack("Plaka değeri listeden seçilmelidir.", "error");
            return;
        }

        if (baslangic_tarihi && bitis_tarihi && dayjs(baslangic_tarihi).isAfter(dayjs(bitis_tarihi))) {
            openSnack("Başlangıç tarihi bitiş tarihinden sonra olamaz.", "error");
            return;
        }

        // Köprü/Feribot/Diğer seçilirse: fiyat + açıklama zorunlu
        if (ucretliTur) {
            if (asMoney(form.ucret_tutari) <= 0) {
                openSnack(`${kesinti_turu} için fiyat girilmelidir.`, "error");
                return;
            }
            if (!String(aciklama || "").trim()) {
                openSnack(`${kesinti_turu} için açıklama zorunludur.`, "error");
                return;
            }
        }

        const kullanici = getMevcutKullanici();
        const bugun = dayjs().format("YYYY-MM-DD");

        const payload = {
            plaka_treyler: String(plaka_treyler).trim(),
            kesinti_turu,
            neden,

            // ücretli türlerde opsiyonel
            baslangic_tarihi: baslangic_tarihi || null,
            bitis_tarihi: bitis_tarihi || null,
            gun_sayisi: baslangic_tarihi && bitis_tarihi ? Number(gun_sayisi || 0) : 0,

            aciklama: String(aciklama || "").trim(),

            kopru_ucreti: 0,
            kopru_aciklama: "",
            feribot_ucreti: 0,
            feribot_aciklama: "",
            diger_ucreti: 0,
            diger_aciklama: "",
        };

        if (kesinti_turu === "Köprü") {
            payload.kopru_ucreti = asMoney(form.ucret_tutari);
            payload.kopru_aciklama = payload.aciklama;
        } else if (kesinti_turu === "Feribot") {
            payload.feribot_ucreti = asMoney(form.ucret_tutari);
            payload.feribot_aciklama = payload.aciklama;
        } else if (kesinti_turu === "Diğer") {
            payload.diger_ucreti = asMoney(form.ucret_tutari);
            payload.diger_aciklama = payload.aciklama;
        }

        let error = null;

        if (formMode === "create") {
            ({ error } = await supabase.from("kesintiler").insert([
                {
                    ...payload,
                    ekleyen_kullanici: kullanici,
                    eklenme_tarihi: new Date().toISOString(),
                },
            ]));
        } else {
            ({ error } = await supabase.from("kesintiler").update(payload).eq("id", editingId));
        }

        if (error) {
            openSnack(`İşlem gerçekleştirilemedi: ${error.message}`, "error");
            return;
        }

        // plaka statüsü sadece tarih doluysa güncelle
        const plaka = String(plaka_treyler || "").trim();
        if (baslangic_tarihi && bitis_tarihi) {
            const isCurrentOrFuture = dayjs(bitis_tarihi).isSameOrAfter(bugun, "day");

            await supabase
                .from("plakalar")
                .update(
                    isCurrentOrFuture
                        ? { statu: "KESİNTİDE", kesinti_baslangic_tarihi: baslangic_tarihi, kesinti_bitis_tarihi: bitis_tarihi }
                        : { statu: "Aktif", kesinti_baslangic_tarihi: null, kesinti_bitis_tarihi: null }
                )
                .eq("plaka", plaka);
        }

        openSnack(formMode === "edit" ? "Kayıt güncellendi." : "Yeni kayıt eklendi.", "success");
        setForm(BOS_FORM);
        setEditingId(null);
        setFormMode("create");
        setFormOpen(false);
        verileriGetir();
    };

    const handleDuzenle = (row) => {
        if (!perms.canEdit) {
            openSnack("Düzenleme yetkiniz yok.", "warning");
            return;
        }

        setForm({
            plaka_treyler: row.plaka_treyler || "",
            kesinti_turu: row.kesinti_turu || "",
            neden: row.neden || "",
            baslangic_tarihi: (row.baslangic_tarihi || "").slice(0, 10),
            bitis_tarihi: (row.bitis_tarihi || "").slice(0, 10),
            gun_sayisi: row.gun_sayisi || hesaplaGun(row.baslangic_tarihi, row.bitis_tarihi),
            aciklama: row.aciklama || "",
            ucret_tutari: getRowFiyat(row),
        });

        setEditingId(row.id);
        setFormMode("edit");
        setFormOpen(true);
    };

    const handleSil = async (id) => {
        if (!perms.canDelete) {
            openSnack("Silme yetkiniz yok.", "warning");
            return;
        }
        if (!window.confirm("Kesinti kaydı silinsin mi? Bu işlem geri alınamaz.")) return;

        const { data: silinecek } = await supabase.from("kesintiler").select("plaka_treyler").eq("id", id).maybeSingle();
        if (!silinecek) {
            openSnack("Kayıt bulunamadı.", "error");
            return;
        }

        const { error } = await supabase.from("kesintiler").delete().eq("id", id);
        if (error) {
            openSnack("Silme sırasında hata oluştu: " + error.message, "error");
            return;
        }

        const plaka = String(silinecek.plaka_treyler || "").trim();
        await supabase
            .from("plakalar")
            .update({ statu: "Aktif", kesinti_baslangic_tarihi: null, kesinti_bitis_tarihi: null })
            .eq("plaka", plaka);

        openSnack("Kayıt başarıyla silindi.", "info");
        verileriGetir();
    };

    /* ===================== Excel Export (tek Fiyat sütunu) ===================== */
    const handleExportExcel = async () => {
        if (filtrelenmisKesintiler.length === 0) {
            openSnack("Aktarılacak filtrelenmiş kayıt bulunamadı.", "warning");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = getMevcutKullanici();
        workbook.lastModifiedBy = getMevcutKullanici();
        workbook.created = new Date();
        workbook.modified = new Date();
        workbook.properties.date1904 = true;

        const worksheet = workbook.addWorksheet("Kesinti Kayıtları");

        worksheet.columns = [
            { header: "Plaka", key: "plaka", width: 18 },
            { header: "Tür", key: "tur", width: 15 },
            { header: "Neden", key: "neden", width: 18 },
            { header: "Başlangıç", key: "baslangic", width: 15, style: { numFmt: "dd.mm.yyyy" } },
            { header: "Bitiş", key: "bitis", width: 15, style: { numFmt: "dd.mm.yyyy" } },
            { header: "Gün", key: "gun", width: 10 },
            { header: "Fiyat (₺)", key: "fiyat", width: 14 },
            { header: "Açıklama", key: "aciklama", width: 40 },
            { header: "Ekleyen", key: "ekleyen", width: 15 },
            { header: "Eklenme Tarihi", key: "eklenme_tarihi", width: 22, style: { numFmt: "dd.mm.yyyy hh:mm" } },
        ];

        worksheet.addRows(
            filtrelenmisKesintiler.map((k) => ({
                plaka: k.plaka_treyler || "-",
                tur: k.kesinti_turu || "-",
                neden: k.neden || "-",
                baslangic: safeDateValueGetter(k.baslangic_tarihi),
                bitis: safeDateValueGetter(k.bitis_tarihi),
                gun: k.gun_sayisi || 0,
                fiyat: getRowFiyat(k),
                aciklama: k.aciklama || "-",
                ekleyen: k.ekleyen_kullanici || "-",
                eklenme_tarihi: safeDateValueGetter(k.eklenme_tarihi),
            }))
        );

        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B5CF6" } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kesinti_kayitlari_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);

        openSnack("Excel aktarımı başarılı.", "success");
    };

    /* ===================== DataGrid Columns (valueGetter YOK -> renderCell var) ===================== */
    const columns = [
        { field: "plaka_treyler", headerName: "PLAKA", flex: 1, minWidth: 160 },
        { field: "kesinti_turu", headerName: "TÜR", flex: 0.8, minWidth: 120 },
        { field: "neden", headerName: "NEDEN", flex: 1, minWidth: 140 },
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
        { field: "gun_sayisi", headerName: "GÜN", width: 90, type: "number" },

        // ✅ FİYAT: renderCell ile hesaplanıyor (runtime error biter)
        {
            field: "fiyat",
            headerName: "FİYAT (₺)",
            width: 120,
            sortable: false,
            filterable: false,
            renderCell: (params) => {
                const r = params?.row;
                const fiyat = getRowFiyat(r);
                return <span>{Number(fiyat || 0).toLocaleString("tr-TR")}</span>;
            },
        },

        { field: "aciklama", headerName: "AÇIKLAMA", flex: 1.4, minWidth: 260 },
        { field: "ekleyen_kullanici", headerName: "EKLEYEN", flex: 1, minWidth: 140 },
        {
            field: "actions",
            headerName: "İŞLEM",
            width: 120,
            sortable: false,
            filterable: false,
            align: "center",
            headerAlign: "center",
            renderCell: (params) => (
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title={perms.canEdit ? "Düzenle" : "Yetkiniz yok"}>
                        <span>
                            <IconButton size="small" color="primary" onClick={() => handleDuzenle(params.row)} disabled={!perms.canEdit}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={perms.canDelete ? "Sil" : "Yetkiniz yok"}>
                        <span>
                            <IconButton size="small" color="error" onClick={() => handleSil(params.row.id)} disabled={!perms.canDelete}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            ),
        },
    ];

    /* ===================== Rapor Excel (tek Fiyat sütunu) ===================== */
    const handleRaporExcel = async () => {
        if (!raporForm.ay || !raporForm.plaka_treyler) {
            openSnack("Lütfen ay ve plaka seçin.", "warning");
            return;
        }

        const hedefAy = raporForm.ay;
        const hedefPlaka = raporForm.plaka_treyler;

        const liste = kesintiler.filter((k) => String(k.baslangic_tarihi || "").substring(0, 7) === hedefAy && k.plaka_treyler === hedefPlaka);

        if (liste.length === 0) {
            openSnack("Bu ay için kayıt bulunamadı.", "info");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Aylık Rapor");

        sheet.columns = [
            { header: "Plaka", key: "plaka", width: 25 },
            { header: "Tür", key: "tur", width: 18 },
            { header: "Neden", key: "neden", width: 20 },
            { header: "Gün", key: "gun", width: 10 },
            { header: "Fiyat (₺)", key: "fiyat", width: 14 },
            { header: "Açıklama", key: "aciklama", width: 45 },
            { header: "Ekleyen", key: "ekleyen", width: 20 },
            { header: "Başlangıç", key: "bas", width: 15, style: { numFmt: "dd.mm.yyyy" } },
            { header: "Bitiş", key: "bit", width: 15, style: { numFmt: "dd.mm.yyyy" } },
        ];

        liste.forEach((k) =>
            sheet.addRow({
                plaka: k.plaka_treyler || "-",
                tur: k.kesinti_turu || "-",
                neden: k.neden || "-",
                gun: k.gun_sayisi || 0,
                fiyat: getRowFiyat(k),
                aciklama: k.aciklama || "-",
                ekleyen: k.ekleyen_kullanici || "-",
                bas: safeDateValueGetter(k.baslangic_tarihi),
                bit: safeDateValueGetter(k.bitis_tarihi),
            })
        );

        sheet.getRow(1).eachCell((c) => {
            c.font = { bold: true, color: { argb: "FFFFFFFF" } };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B5CF6" } };
            c.alignment = { horizontal: "center" };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Rapor_${hedefPlaka}_${hedefAy}.xlsx`;
        a.click();

        openSnack("Rapor başarıyla oluşturuldu.", "success");
    };

    /* ===================== Render ===================== */
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <ScaleToFit>
                    <Container maxWidth={false} disableGutters sx={{ width: 1920, height: 1080, mx: "auto", p: 3, boxSizing: "border-box" }}>
                        <Helmet>
                            <title>KESİNTİ GİRİŞLERİ | ODYSSEY</title>
                        </Helmet>

                        <Stack spacing={3} sx={{ height: "100%", minHeight: 0 }}>
                            {/* Header + Actions */}
                            <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" gap={2}>
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
                                        KESİNTİ KAYITLARI YÖNETİMİ
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                        Araçların aktif çalışmadığı günleri (bakım, arıza, iş yok vb.) yönetin.
                                    </Typography>
                                </Stack>

                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
                                        Geri
                                    </Button>
                                    <Button variant="text" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)}>
                                        Anasayfa
                                    </Button>

                                    <Tooltip title={perms.canCreate ? "Yeni Kesinti Kaydı Ekle" : "Yetkiniz yok"}>
                                        <span>
                                            <Button
                                                variant="contained"
                                                startIcon={<AddIcon />}
                                                onClick={() => {
                                                    if (!perms.canCreate) {
                                                        openSnack("Yeni kayıt ekleme yetkiniz yok.", "warning");
                                                        return;
                                                    }
                                                    setForm(BOS_FORM);
                                                    setFormMode("create");
                                                    setEditingId(null);
                                                    setFormOpen(true);
                                                }}
                                                disabled={!perms.canCreate || permLoading}
                                                sx={{ height: 40, px: 2.5 }}
                                            >
                                                Yeni Kesinti
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Stack>

                            {/* KPI Cards */}
                            <Grid container spacing={3}>
                                {[
                                    { label: "Toplam Kesinti Kaydı", value: toplam, color: "primary" },
                                    { label: `Bu Ay Kesinti (Kayıt)`, value: buAy, color: "secondary" },
                                    { label: "Gösterilen Kayıt", value: filtrelenmisKesintiler.length, color: "success" },
                                    { label: "Yetki Durumu", value: permLoading ? "Yükleniyor..." : "Tamam", color: permLoading ? "warning" : "info" },
                                ].map((kpi, idx) => (
                                    <Grid item xs={12} sm={6} md={3} key={idx}>
                                        <Card sx={{ borderRadius: 3, height: "100%", minWidth: 200 }}>
                                            <CardContent>
                                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                                                        {kpi.label}
                                                    </Typography>
                                                    <Badge color={kpi.color} variant="dot" overlap="circular" sx={{ "& .MuiBadge-dot": { width: 10, height: 10, borderRadius: "50%" } }} />
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
                                <Paper sx={{ height: 750, borderRadius: 3, border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden" }}>
                                    {(loading || permLoading) && <LinearProgress color="secondary" />}

                                    <Box sx={{ height: "100%", width: "100%", minHeight: 0 }}>
                                        <DataGrid
                                            rows={filtrelenmisKesintiler}
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
                                                    <CustomToolbar
                                                        onFilters={() => setFiltreDrawer(true)}
                                                        onExport={handleExportExcel}
                                                        onRefresh={() => {
                                                            verileriGetir();
                                                            loadPermissions().catch(() => { });
                                                        }}
                                                        onReport={() => setRaporOpen(true)}
                                                    />
                                                ),
                                            }}
                                            sx={{
                                                border: "none",
                                                "& .MuiDataGrid-virtualScroller": { overflowX: "auto" },
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
                                    options={plakaOptions}
                                    value={filtreler.plaka_treyler && plakaOptionsSet.has(filtreler.plaka_treyler) ? { label: filtreler.plaka_treyler } : null}
                                    onChange={(_, val) => setFiltreler((p) => ({ ...p, plaka_treyler: val?.label || "" }))}
                                    renderInput={(params) => <TextField {...params} label="Plaka" fullWidth />}
                                    autoHighlight
                                    disablePortal
                                    isOptionEqualToValue={(o, v) => o.label === v.label}
                                />

                                <FormControl fullWidth size="small">
                                    <InputLabel>Tür</InputLabel>
                                    <Select label="Tür" value={filtreler.kesinti_turu} onChange={(e) => setFiltreler((p) => ({ ...p, kesinti_turu: e.target.value }))}>
                                        <MenuItem value="">(Hepsi)</MenuItem>
                                        {KESINTI_TURLERI.map((t) => (
                                            <MenuItem key={t} value={t}>
                                                {t}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl fullWidth size="small">
                                    <InputLabel>Neden</InputLabel>
                                    <Select label="Neden" value={filtreler.neden} onChange={(e) => setFiltreler((p) => ({ ...p, neden: e.target.value }))}>
                                        <MenuItem value="">(Hepsi)</MenuItem>
                                        {KESINTI_NEDENLERI.map((n) => (
                                            <MenuItem key={n} value={n}>
                                                {n}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <TextField label="Açıklama İçerik" value={filtreler.aciklama} onChange={(e) => setFiltreler((p) => ({ ...p, aciklama: e.target.value }))} fullWidth />

                                <TextField
                                    label="Ekleyen Kullanıcı"
                                    value={filtreler.ekleyen_kullanici}
                                    onChange={(e) => setFiltreler((p) => ({ ...p, ekleyen_kullanici: e.target.value }))}
                                    fullWidth
                                />

                                <DatePicker
                                    label="Başlangıç Tarihi"
                                    value={filtreler.baslangic_tarihi ? dayjs(filtreler.baslangic_tarihi) : null}
                                    onChange={(d) => setFiltreler((p) => ({ ...p, baslangic_tarihi: d ? d.format("YYYY-MM-DD") : "" }))}
                                    slotProps={{ textField: { fullWidth: true, size: "small" } }}
                                />

                                <DatePicker
                                    label="Bitiş Tarihi"
                                    value={filtreler.bitis_tarihi ? dayjs(filtreler.bitis_tarihi) : null}
                                    onChange={(d) => setFiltreler((p) => ({ ...p, bitis_tarihi: d ? d.format("YYYY-MM-DD") : "" }))}
                                    slotProps={{ textField: { fullWidth: true, size: "small" } }}
                                />

                                <DatePicker
                                    label="Ay (Başlangıç Ayı)"
                                    views={["month", "year"]}
                                    format="MM/YYYY"
                                    value={filtreler.ay ? dayjs(filtreler.ay) : null}
                                    onChange={(d) => setFiltreler((p) => ({ ...p, ay: d ? d.format("YYYY-MM") : "" }))}
                                    slotProps={{ textField: { fullWidth: true, size: "small", helperText: "Başlangıç tarihinin ayına göre filtreler" } }}
                                />

                                <TextField type="number" label="Gün Sayısı" value={filtreler.gun_sayisi} onChange={(e) => setFiltreler((p) => ({ ...p, gun_sayisi: e.target.value }))} fullWidth />

                                <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
                                    <Button fullWidth variant="outlined" color="error" size="large" onClick={() => setFiltreler(BOS_FILTRE)}>
                                        Temizle
                                    </Button>
                                    <Button fullWidth variant="contained" color="primary" size="large" onClick={() => setFiltreDrawer(false)}>
                                        Uygula
                                    </Button>
                                </Stack>
                            </Stack>
                        </Drawer>

                        {/* Rapor Drawer */}
                        <Drawer
                            anchor="right"
                            open={raporOpen}
                            onClose={() => setRaporOpen(false)}
                            slotProps={{
                                paper: {
                                    sx: {
                                        width: 500,
                                        backgroundColor: "#171E2D",
                                        color: "text.primary",
                                        p: 3,
                                    },
                                },
                            }}
                        >
                            <Typography variant="h5" fontWeight={700} color="secondary.main">
                                Kesinti Raporu
                            </Typography>

                            <Divider sx={{ my: 2 }} />

                            <DatePicker
                                label="Ay Seç"
                                views={["month", "year"]}
                                value={raporForm.ay ? dayjs(raporForm.ay) : null}
                                onChange={(d) => setRaporForm((p) => ({ ...p, ay: d ? d.format("YYYY-MM") : "" }))}
                                slotProps={{ textField: { fullWidth: true, size: "small" } }}
                            />

                            <Autocomplete
                                options={plakaOptions}
                                value={raporForm.plaka_treyler ? { label: raporForm.plaka_treyler } : null}
                                onChange={(_, v) => setRaporForm((p) => ({ ...p, plaka_treyler: v?.label || "" }))}
                                renderInput={(params) => <TextField {...params} label="Plaka" fullWidth />}
                                sx={{ mt: 2 }}
                                isOptionEqualToValue={(o, v) => o.label === v.label}
                            />

                            <Button fullWidth variant="contained" sx={{ mt: 3 }} onClick={handleRaporExcel}>
                                Rapor Oluştur
                            </Button>
                        </Drawer>

                        {/* Form Dialog */}
                        <Dialog
                            open={formOpen}
                            onClose={() => {
                                setFormOpen(false);
                                setFormMode("create");
                                setEditingId(null);
                            }}
                            maxWidth="lg"
                            fullWidth
                        >
                            <DialogTitle sx={{ pb: 0, pt: 3, px: 3 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack>
                                        <Typography variant="h5" fontWeight={800} color="primary.light">
                                            {formMode === "edit" ? "Kesinti Kaydını Düzenle 📝" : "Yeni Kesinti Kaydı Girişi ➕"}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                            Lütfen zorunlu alanları (*) eksiksiz doldurun.
                                        </Typography>
                                    </Stack>
                                    <IconButton
                                        onClick={() => {
                                            setFormOpen(false);
                                            setFormMode("create");
                                            setEditingId(null);
                                        }}
                                    >
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
                                    options={plakaOptions}
                                    value={form.plaka_treyler ? { label: form.plaka_treyler } : null}
                                    onChange={(_, val) => handleChange("plaka_treyler", val?.label || "")}
                                    renderInput={(params) => <TextField {...params} label="Plaka *" placeholder="Örn: 34ABC123" required fullWidth />}
                                    autoHighlight
                                    openOnFocus
                                    disablePortal
                                    isOptionEqualToValue={(o, v) => o.label === v.label}
                                    sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}
                                />

                                {/* Kesinti Türü */}
                                <FormControl required fullWidth>
                                    <InputLabel>Kesinti Türü *</InputLabel>
                                    <Select label="Kesinti Türü *" value={form.kesinti_turu} onChange={(e) => handleChange("kesinti_turu", e.target.value)} size="small">
                                        {KESINTI_TURLERI.map((t) => (
                                            <MenuItem key={t} value={t}>
                                                {t}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* Kesinti Nedeni */}
                                <FormControl required fullWidth>
                                    <InputLabel>Kesinti Nedeni *</InputLabel>
                                    <Select label="Kesinti Nedeni *" value={form.neden} onChange={(e) => handleChange("neden", e.target.value)} size="small">
                                        {KESINTI_NEDENLERI.map((n) => (
                                            <MenuItem key={n} value={n}>
                                                {n}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* Başlangıç */}
                                <TextField
                                    type="date"
                                    label={isUcretTuru(form.kesinti_turu) ? "Başlangıç" : "Başlangıç *"}
                                    InputLabelProps={{ shrink: true }}
                                    value={form.baslangic_tarihi}
                                    onChange={(e) => handleChange("baslangic_tarihi", e.target.value)}
                                    fullWidth
                                    required={!isUcretTuru(form.kesinti_turu)}
                                />

                                {/* Bitiş */}
                                <TextField
                                    type="date"
                                    label={isUcretTuru(form.kesinti_turu) ? "Bitiş" : "Bitiş *"}
                                    InputLabelProps={{ shrink: true }}
                                    value={form.bitis_tarihi}
                                    onChange={(e) => handleChange("bitis_tarihi", e.target.value)}
                                    fullWidth
                                    required={!isUcretTuru(form.kesinti_turu)}
                                />

                                {/* Gün Sayısı */}
                                <TextField label="Gün Sayısı" value={form.gun_sayisi || 0} fullWidth disabled />

                                {/* Fiyat (sadece Köprü/Feribot/Diğer) */}
                                {isUcretTuru(form.kesinti_turu) && (
                                    <TextField
                                        label="Fiyat (₺) *"
                                        type="number"
                                        value={form.ucret_tutari}
                                        onChange={(e) => handleChange("ucret_tutari", e.target.value)}
                                        fullWidth
                                        inputProps={{ step: "0.01", min: 0 }}
                                    />
                                )}

                                {/* Açıklama (ortak) */}
                                <TextField
                                    label={isUcretTuru(form.kesinti_turu) ? "Açıklama *" : "Açıklama"}
                                    value={form.aciklama}
                                    onChange={(e) => handleChange("aciklama", e.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={6}
                                    placeholder="Gerekçe ve notlar..."
                                    required={isUcretTuru(form.kesinti_turu)}
                                    sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}
                                />
                            </DialogContent>

                            <DialogActions sx={{ p: 3, justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                                <Button
                                    variant="text"
                                    onClick={() => {
                                        setFormOpen(false);
                                        setFormMode("create");
                                        setEditingId(null);
                                    }}
                                    size="large"
                                >
                                    Kapat
                                </Button>
                                <Button variant="contained" onClick={handleFormSubmit} size="large" color="primary" sx={{ px: 4, py: 1.5 }}>
                                    {formMode === "edit" ? "GÜNCELLE" : "KAYDET"}
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Snackbar */}
                        <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                            <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ width: "100%", borderRadius: 2 }}>
                                {snack.msg}
                            </Alert>
                        </Snackbar>
                    </Container>
                </ScaleToFit>
            </LocalizationProvider>
        </ThemeProvider>
    );
}
