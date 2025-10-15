import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
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
    Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeIcon from "@mui/icons-material/HomeOutlined";

// DataGrid
import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarQuickFilter,
    GridToolbarColumnsButton,
    GridToolbarDensitySelector,
} from "@mui/x-data-grid";

// Date
import dayjs from "dayjs";
import "dayjs/locale/tr";
dayjs.locale("tr");

/* ===================== Yetkilendirme (şemaya uygun) ===================== */
/* Bu ekran araç durumu mantığına denk geliyor; şemanda var olan arcdur_* kolonlarını kullanıyoruz */
const SCREEN_KEY = "arac_durumlari"; // user_permissions & role_permissions içinde var: arcdur_create/edit/delete

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

/* ===================== Tema ===================== */
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
        button: { textTransform: "none", fontWeight: 700 },
    },
    components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
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
                },
            },
        },
        MuiTextField: {
            defaultProps: { variant: "outlined" },
            styleOverrides: { root: { "& .MuiOutlinedInput-root": { borderRadius: 12 } } },
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
};

const getMevcutKullanici = () =>
    localStorage.getItem("kullanici") || "Bilinmeyen Kullanıcı";

const hesaplaGun = (start, end) => {
    if (!start || !end) return "";
    const d1 = new Date(start);
    const d2 = new Date(end);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const fark = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
    return fark >= 0 ? fark : 0;
};

const safeDateValueGetter = (arg) => {
    const v = arg?.value ?? arg;
    if (!v) return null;
    const s = String(v).slice(0, 10);
    const d = dayjs(s);
    return d.isValid() ? d.toDate() : null;
};
const safeDateValueFormatter = (arg) => {
    const v = arg?.value ?? arg;
    if (!v) return "-";
    const d = dayjs(v);
    return d.isValid() ? d.format("DD.MM.YYYY") : "-";
};

/* ===================== Toolbar ===================== */
function CustomToolbar({ onFilters, onExport, onRefresh }) {
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
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(6px)",
            }}
        >
            <GridToolbarColumnsButton />
            <GridToolbarDensitySelector />
            <Box sx={{ flexGrow: 1 }} />
            <GridToolbarQuickFilter debounceMs={300} />
            <Tooltip title="Filtreler">
                <IconButton onClick={onFilters}>
                    <FilterListIcon />
                </IconButton>
            </Tooltip>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExport}>
                Excel
            </Button>
            <Button variant="outlined" onClick={onRefresh}>
                Yenile
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

    // form modu ve düzenlenen id
    const [formMode, setFormMode] = useState("create"); // 'create' | 'edit'
    const [editingId, setEditingId] = useState(null);

    const [filtreler, setFiltreler] = useState({
        plaka_treyler: "",
        kesinti_turu: "",
        neden: "",
        baslangic_tarihi: "",
        bitis_tarihi: "",
        gun_sayisi: "",
        aciklama: "",
        ekleyen_kullanici: "",
        ay: "",
    });

    // ==== YETKİ DURUMU ====
    const [permLoading, setPermLoading] = useState(true);
    const [perms, setPerms] = useState({
        canCreate: false,
        canEdit: false,
        canDelete: false,
    });

    // KPI
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

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        verileriGetir();
        plakalarGetir();
        loadPermissions().catch((e) => {
            console.error("perm load error:", e);
            setPerms({ canCreate: false, canEdit: false, canDelete: false });
        });
    }, []);

    /* ===================== Permissions Loader ===================== */
    function coalesceOverride(overrideVal, roleVal) {
        // override true/false ise onu kullan; null/undefined ise rol değeri
        return (overrideVal === true || overrideVal === false) ? overrideVal : !!roleVal;
    }

    const looksLikeUUID = (s) =>
        typeof s === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

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
            let roleId = null;
            if (userRow.rol) {
                if (looksLikeUUID(userRow.rol)) {
                    roleId = userRow.rol;
                } else {
                    const roleKey = String(userRow.rol).toUpperCase();
                    const { data: roleRow, error: eR } = await supabase
                        .from("roles")
                        .select("id,key")
                        .eq("key", roleKey)
                        .maybeSingle();
                    if (eR) throw eR;
                    roleId = roleRow?.id || null;
                }
            }

            // 3) Rol izinleri (arac_durumlari)
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

            // 4) Kullanıcı override (arac_durumlari)
            const { data: up, error: eUP } = await supabase
                .from("user_permissions")
                .select("*")
                .eq("screen_key", SCREEN_KEY)
                .eq("user_id", userRow.id)
                .maybeSingle();
            if (eUP) throw eUP;

            // 5) Etkin izinler — arcdur_* alanları
            const canCreate = coalesceOverride(up?.arcdur_create, rolePerm?.arcdur_create);
            const canEdit = coalesceOverride(up?.arcdur_edit, rolePerm?.arcdur_edit);
            const canDelete = coalesceOverride(up?.arcdur_delete, rolePerm?.arcdur_delete);

            setPerms({ canCreate, canEdit, canDelete });
        } finally {
            setPermLoading(false);
        }
    }

    /* ===================== Data ===================== */
    const verileriGetir = async () => {
        setLoading(true);
        const { data } = await supabase.from("kesintiler").select("*").order("id", { ascending: false });
        setKesintiler(data || []);
        setLoading(false);
    };

    const plakalarGetir = async () => {
        const { data, error } = await supabase
            .from("plakalar")
            .select("plaka, treyler")
            .or("statu.is.null,statu.neq.ÇIKARILDI");
        if (!error && data) setPlakalar(data);
    };

    // Plaka seçenekleri
    const plakaOptions = useMemo(
        () =>
            (plakalar || [])
                .map((p) => ({ label: `${(p.plaka || "").trim()} - ${(p.treyler || "").trim()}` }))
                .filter((o) => o.label.trim() !== "-"),
        [plakalar]
    );
    const plakaOptionsSet = useMemo(() => new Set(plakaOptions.map((o) => o.label)), [plakaOptions]);

    const handleChange = (name, value) => {
        const next = { ...form, [name]: value };
        if (name === "baslangic_tarihi" || name === "bitis_tarihi") {
            next.gun_sayisi = hesaplaGun(next.baslangic_tarihi, next.bitis_tarihi);
        }
        setForm(next);
    };

    /* ===================== CRUD Handlers (Yetki guard'lı) ===================== */
    const handleSubmit = async (e) => {
        e.preventDefault();

        // create vs edit guard
        if (formMode === "create" && !perms.canCreate) {
            alert("Yeni kesinti ekleme yetkiniz yok.");
            return;
        }
        if (formMode === "edit" && !perms.canEdit) {
            alert("Düzenleme yetkiniz yok.");
            return;
        }

        const {
            plaka_treyler,
            baslangic_tarihi,
            bitis_tarihi,
            kesinti_turu,
            neden,
            gun_sayisi,
            aciklama,
        } = form;

        if (!plaka_treyler || !baslangic_tarihi || !bitis_tarihi || !kesinti_turu || !neden) {
            alert("Lütfen tüm gerekli alanları doldurun.");
            return;
        }

        if (!plakaOptionsSet.has(plaka_treyler)) {
            alert("Lütfen plaka/treyler değerini listeden seçin.");
            return;
        }

        const kullanici = getMevcutKullanici();
        const bugun = new Date().toISOString().split("T")[0];

        let error = null;

        if (formMode === "create") {
            ({ error } = await supabase.from("kesintiler").insert([
                {
                    plaka_treyler,
                    kesinti_turu,
                    neden,
                    baslangic_tarihi,
                    bitis_tarihi,
                    gun_sayisi,
                    aciklama,
                    ekleyen_kullanici: kullanici,
                    eklenme_tarihi: new Date().toISOString(),
                },
            ]));
        } else {
            ({ error } = await supabase
                .from("kesintiler")
                .update({
                    plaka_treyler,
                    kesinti_turu,
                    neden,
                    baslangic_tarihi,
                    bitis_tarihi,
                    gun_sayisi,
                    aciklama,
                })
                .eq("id", editingId));
        }

        if (error) {
            alert("İşlem gerçekleştirilemedi.");
            return;
        }

        // Plaka statüsünü güncelle
        const [plaka, treyler] = plaka_treyler.split(" - ");
        await supabase
            .from("plakalar")
            .update(
                bitis_tarihi >= bugun
                    ? {
                        statu: "KESİNTİDE",
                        kesinti_baslangic_tarihi: baslangic_tarihi,
                        kesinti_bitis_tarihi: bitis_tarihi,
                    }
                    : {
                        statu: "Aktif",
                        kesinti_baslangic_tarihi: null,
                        kesinti_bitis_tarihi: null,
                    }
            )
            .eq("plaka", (plaka || "").trim())
            .eq("treyler", (treyler || "").trim());

        setForm(BOS_FORM);
        setEditingId(null);
        setFormMode("create");
        setFormOpen(false);
        verileriGetir();
    };

    const handleSil = async (id) => {
        if (!perms.canDelete) {
            alert("Silme yetkiniz yok.");
            return;
        }
        if (!window.confirm("Kesinti kaydı silinsin mi?")) return;

        const { data: silinecek } = await supabase.from("kesintiler").select("*").eq("id", id).single();
        if (!silinecek) {
            alert("Kayıt bulunamadı.");
            return;
        }

        await supabase.from("kesintiler").delete().eq("id", id);

        const [plaka, treyler] = (silinecek.plaka_treyler || "").split(" - ");
        await supabase
            .from("plakalar")
            .update({
                statu: "Aktif",
                kesinti_baslangic_tarihi: null,
                kesinti_bitis_tarihi: null,
            })
            .eq("plaka", (plaka || "").trim())
            .eq("treyler", (treyler || "").trim());

        verileriGetir();
    };

    const handleExportExcel = () => {
        if (kesintiler.length === 0) {
            alert("Aktarılacak kayıt bulunamadı.");
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(
            kesintiler.map((k) => ({
                Plaka: k.plaka_treyler,
                Tür: k.kesinti_turu,
                Neden: k.neden,
                Başlangıç: new Date(k.baslangic_tarihi).toLocaleDateString("tr-TR"),
                Bitiş: new Date(k.bitis_tarihi).toLocaleDateString("tr-TR"),
                Gün: k.gun_sayisi,
                Açıklama: k.aciklama,
                Ekleyen: k.ekleyen_kullanici,
                Eklenme_Tarihi: new Date(k.eklenme_tarihi).toLocaleString("tr-TR"),
            }))
        );
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Kesinti Kayıtları");
        XLSX.writeFile(workbook, "kesinti_kayitlari.xlsx");
    };

    /* ===================== Columns ===================== */
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
        { field: "gun_sayisi", headerName: "GÜN", width: 90 },
        { field: "aciklama", headerName: "AÇIKLAMA", flex: 1.2, minWidth: 220 },
        { field: "ekleyen_kullanici", headerName: "EKLEYEN", flex: 1, minWidth: 140 },
        {
            field: "actions",
            headerName: "İŞLEM",
            width: 130,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <Stack direction="row" spacing={1}>
                    <Tooltip title={perms.canEdit ? "Düzenle" : "Yetkiniz yok"}>
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => {
                                    if (!perms.canEdit) return;
                                    setForm({
                                        plaka_treyler: params.row.plaka_treyler || "",
                                        kesinti_turu: params.row.kesinti_turu || "",
                                        neden: params.row.neden || "",
                                        baslangic_tarihi: (params.row.baslangic_tarihi || "").slice(0, 10),
                                        bitis_tarihi: (params.row.bitis_tarihi || "").slice(0, 10),
                                        gun_sayisi:
                                            params.row.gun_sayisi ||
                                            hesaplaGun(params.row.baslangic_tarihi, params.row.bitis_tarihi),
                                        aciklama: params.row.aciklama || "",
                                    });
                                    setEditingId(params.row.id);
                                    setFormMode("edit");
                                    setFormOpen(true);
                                }}
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
                                onClick={() => perms.canDelete && handleSil(params.row.id)}
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

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <ScaleToFit>
                <Container
                    maxWidth={false}
                    disableGutters
                    sx={{ width: 1920, height: 1080, mx: "auto", p: 2, boxSizing: "border-box" }}
                >
                    <Helmet>
                        <title>KESİNTİ GİRİŞLERİ</title>
                    </Helmet>

                    <Stack spacing={2} sx={{ height: "100%", minHeight: 0 }}>
                        {/* Header + Actions */}
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            alignItems={{ xs: "flex-start", md: "center" }}
                            justifyContent="space-between"
                            gap={2}
                            sx={{ mb: 1.5 }}
                        >
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography
                                    variant="h4"
                                    fontWeight={800}
                                    sx={{
                                        background: "linear-gradient(90deg,#E879F9,#22D3EE)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                    }}
                                >
                                    Kesinti Girişleri
                                </Typography>
                                {/* bilgi çipi: yetki özeti */}
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label={
                                        permLoading
                                            ? "Yetkiler yükleniyor…"
                                            : `Yetkiler: ${perms.canCreate ? "E" : "H"}/${perms.canEdit ? "E" : "H"}/${perms.canDelete ? "E" : "H"}`
                                    }
                                />
                            </Stack>

                            <Stack direction="row" spacing={1}>
                                <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
                                    Geri
                                </Button>
                                <Button size="small" variant="text" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)}>
                                    Anasayfa
                                </Button>

                                <Button variant="outlined" startIcon={<FilterListIcon />} onClick={() => setFiltreDrawer(true)}>
                                    Filtreler
                                </Button>
                                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportExcel}>
                                    Excel'e Aktar
                                </Button>
                                <Tooltip title={perms.canCreate ? "" : "Yetkiniz yok"}>
                                    <span>
                                        <Button
                                            variant="contained"
                                            startIcon={<AddIcon />}
                                            onClick={() => {
                                                if (!perms.canCreate) return;
                                                setForm(BOS_FORM);
                                                setFormMode("create");
                                                setEditingId(null);
                                                setFormOpen(true);
                                            }}
                                            disabled={!perms.canCreate || permLoading}
                                        >
                                            Yeni Kesinti
                                        </Button>
                                    </span>
                                </Tooltip>
                            </Stack>
                        </Stack>

                        {/* KPI Cards */}
                        <Grid container spacing={2}>
                            {[
                                { label: "Toplam Kayıt", value: toplam, color: "primary" },
                                { label: "Bu Ay", value: buAy, color: "secondary" },
                            ].map((kpi, idx) => (
                                <Grid item xs={12} sm={6} md={3} key={idx}>
                                    <Card
                                        sx={{
                                            borderRadius: 3,
                                            background: `linear-gradient(180deg, ${alpha("#ffffff", 0.04)} 0%, ${alpha(
                                                "#ffffff",
                                                0.02
                                            )} 100%)`,
                                            border: "1px solid rgba(255,255,255,0.06)",
                                            height: "100%",
                                            minWidth: 220,
                                        }}
                                    >
                                        <CardContent>
                                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                <Typography variant="subtitle2" color="text.secondary">
                                                    {kpi.label}
                                                </Typography>
                                                <Badge color={kpi.color} variant="dot" overlap="circular" />
                                            </Stack>
                                            <Typography variant="h4" mt={0.5} fontWeight={800}>
                                                {kpi.value}
                                            </Typography>
                                            <LinearProgress sx={{ mt: 2, height: 6, borderRadius: 3 }} color={kpi.color} variant="determinate" value={100} />
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>

                        {/* Grid */}
                        <Box sx={{ mt: 2 }}>
                            <Paper
                                sx={{
                                    height: 710,
                                    borderRadius: 3,
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                {(loading || permLoading) && <LinearProgress />}

                                <Box sx={{ height: "100%", overflow: "auto", pb: 1 }}>
                                    <DataGrid
                                        style={{ height: "100%" }}
                                        rows={filtrelenmisKesintiler}
                                        columns={columns}
                                        getRowId={(r) => r.id}
                                        loading={loading || permLoading}
                                        disableRowSelectionOnClick
                                        pagination={false}
                                        hideFooter
                                        density="compact"
                                        rowHeight={44}
                                        columnHeaderHeight={86}
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
                                                />
                                            ),
                                        }}
                                        sx={{
                                            border: "none",
                                            pb: 0.5,
                                            "& .MuiDataGrid-columnHeaders": {
                                                background:
                                                    "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.7) 100%)",
                                                color: "#C8D1E6",
                                                borderBottomColor: "rgba(255,255,255,0.08)",
                                                fontWeight: 700,
                                                alignItems: "stretch",
                                            },
                                            "& .MuiDataGrid-columnHeader": { py: 0.5 },
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
                                    backgroundColor: "#0F172A",
                                    color: "text.primary",
                                    p: 2,
                                    borderLeft: "1px solid rgba(255,255,255,0.06)",
                                },
                            },
                        }}
                    >
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="h6">Detaylı Filtreler</Typography>
                            <IconButton onClick={() => setFiltreDrawer(false)}>
                                <CloseIcon />
                            </IconButton>
                        </Stack>

                        <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
                            <Autocomplete
                                options={plakaOptions}
                                value={
                                    filtreler.plaka_treyler && plakaOptionsSet.has(filtreler.plaka_treyler)
                                        ? { label: filtreler.plaka_treyler }
                                        : null
                                }
                                onChange={(_, val) =>
                                    setFiltreler((p) => ({ ...p, plaka_treyler: val?.label || "" }))
                                }
                                renderInput={(params) => <TextField {...params} label="Plaka - Treyler" fullWidth />}
                                clearOnEscape
                                autoHighlight
                                disableClearable={false}
                                disablePortal
                                ListboxProps={{ style: { maxHeight: 320 } }}
                                isOptionEqualToValue={(o, v) => o.label === v.label}
                            />

                            <FormControl fullWidth>
                                <InputLabel>Tür</InputLabel>
                                <Select
                                    label="Tür"
                                    value={filtreler.kesinti_turu}
                                    onChange={(e) =>
                                        setFiltreler((p) => ({ ...p, kesinti_turu: e.target.value }))
                                    }
                                >
                                    <MenuItem value="">(Hepsi)</MenuItem>
                                    <MenuItem value="Bakım">Bakım</MenuItem>
                                    <MenuItem value="Servis">Servis</MenuItem>
                                    <MenuItem value="Arıza">Arıza</MenuItem>
                                    <MenuItem value="Kaza">Kaza</MenuItem>
                                    <MenuItem value="Bölgede İş Yok">Bölgede İş Yok</MenuItem>
                                    <MenuItem value="İş Başı">İş Başı</MenuItem>
                                    <MenuItem value="İş Sonu">İş Sonu</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControl fullWidth>
                                <InputLabel>Neden</InputLabel>
                                <Select
                                    label="Neden"
                                    value={filtreler.neden}
                                    onChange={(e) => setFiltreler((p) => ({ ...p, neden: e.target.value }))}
                                >
                                    <MenuItem value="">(Hepsi)</MenuItem>
                                    <MenuItem value="Tedarikçi Kaynaklı">Tedarikçi Kaynaklı</MenuItem>
                                    <MenuItem value="Odak Kaynaklı">Odak Kaynaklı</MenuItem>
                                </Select>
                            </FormControl>

                            <TextField
                                label="Açıklama"
                                value={filtreler.aciklama}
                                onChange={(e) => setFiltreler((p) => ({ ...p, aciklama: e.target.value }))}
                                fullWidth
                            />

                            <TextField
                                label="Ekleyen"
                                value={filtreler.ekleyen_kullanici}
                                onChange={(e) =>
                                    setFiltreler((p) => ({ ...p, ekleyen_kullanici: e.target.value }))
                                }
                                fullWidth
                            />

                            <TextField
                                type="date"
                                label="Başlangıç"
                                InputLabelProps={{ shrink: true }}
                                value={filtreler.baslangic_tarihi}
                                onChange={(e) =>
                                    setFiltreler((p) => ({ ...p, baslangic_tarihi: e.target.value }))
                                }
                                fullWidth
                            />

                            <TextField
                                type="date"
                                label="Bitiş"
                                InputLabelProps={{ shrink: true }}
                                value={filtreler.bitis_tarihi}
                                onChange={(e) => setFiltreler((p) => ({ ...p, bitis_tarihi: e.target.value }))}
                                fullWidth
                            />
                            <TextField
                                type="month"
                                label="Ay (Başlangıç)"
                                InputLabelProps={{ shrink: true }}
                                value={filtreler.ay}
                                onChange={(e) => setFiltreler((p) => ({ ...p, ay: e.target.value }))}
                                fullWidth
                            />

                            <Stack direction="row" spacing={1}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => setFiltreler((p) => ({ ...p, ay: dayjs().format("YYYY-MM") }))}
                                >
                                    Bu Ay
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() =>
                                        setFiltreler((p) => ({ ...p, ay: dayjs().subtract(1, "month").format("YYYY-MM") }))
                                    }
                                >
                                    Geçen Ay
                                </Button>
                            </Stack>

                            <TextField
                                type="number"
                                label="Gün"
                                value={filtreler.gun_sayisi}
                                onChange={(e) => setFiltreler((p) => ({ ...p, gun_sayisi: e.target.value }))}
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
                                            kesinti_turu: "",
                                            neden: "",
                                            baslangic_tarihi: "",
                                            bitis_tarihi: "",
                                            gun_sayisi: "",
                                            aciklama: "",
                                            ekleyen_kullanici: "",
                                            ay: "",
                                        })
                                    }
                                >
                                    Temizle
                                </Button>
                                <Button fullWidth variant="contained" onClick={() => setFiltreDrawer(false)}>
                                    Uygula
                                </Button>
                            </Stack>
                        </Box>
                    </Drawer>

                    {/* Form Dialog */}
                    <Dialog
                        open={formOpen}
                        onClose={() => {
                            setFormOpen(false);
                            setFormMode("create");
                            setEditingId(null);
                        }}
                        maxWidth="xl"
                        fullWidth
                    >
                        <DialogTitle sx={{ pb: 0 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Stack>
                                    <Typography variant="h6" fontWeight={800}>
                                        {formMode === "edit" ? "Kesinti Düzenle" : "Yeni Kesinti"}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                        Lütfen zorunlu alanları doldurun. ( * )
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
                                borderTop: "1px solid rgba(255,255,255,0.06)",
                                display: "grid",
                                gap: 3,
                                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                                p: 3,
                            }}
                        >
                            <Autocomplete
                                options={plakaOptions}
                                value={form.plaka_treyler ? { label: form.plaka_treyler } : null}
                                onChange={(_, val) => handleChange("plaka_treyler", val?.label || "")}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Plaka - Treyler *"
                                        placeholder="Örn: 34 ABC 123 - T123"
                                        required
                                        fullWidth
                                    />
                                )}
                                autoHighlight
                                openOnFocus
                                disableClearable={false}
                                disablePortal
                                ListboxProps={{ style: { maxHeight: 320 } }}
                                isOptionEqualToValue={(o, v) => o.label === v.label}
                                sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}
                            />

                            <FormControl required fullWidth>
                                <InputLabel>Kesinti Türü *</InputLabel>
                                <Select
                                    label="Kesinti Türü *"
                                    value={form.kesinti_turu}
                                    onChange={(e) => handleChange("kesinti_turu", e.target.value)}
                                >
                                    <MenuItem value="Bakım">Bakım</MenuItem>
                                    <MenuItem value="Servis">Servis</MenuItem>
                                    <MenuItem value="Arıza">Arıza</MenuItem>
                                    <MenuItem value="Kaza">Kaza</MenuItem>
                                    <MenuItem value="Bölgede İş Yok">Bölgede İş Yok</MenuItem>
                                    <MenuItem value="İş Başı">İş Başı</MenuItem>
                                    <MenuItem value="İş Sonu">İş Sonu</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControl required fullWidth>
                                <InputLabel>Kesinti Nedeni *</InputLabel>
                                <Select
                                    label="Kesinti Nedeni *"
                                    value={form.neden}
                                    onChange={(e) => handleChange("neden", e.target.value)}
                                >
                                    <MenuItem value="Tedarikçi Kaynaklı">Tedarikçi Kaynaklı</MenuItem>
                                    <MenuItem value="Odak Kaynaklı">Odak Kaynaklı</MenuItem>
                                </Select>
                            </FormControl>

                            <TextField
                                type="date"
                                label="Başlangıç *"
                                InputLabelProps={{ shrink: true }}
                                value={form.baslangic_tarihi}
                                onChange={(e) => handleChange("baslangic_tarihi", e.target.value)}
                                fullWidth
                                required
                            />

                            <TextField
                                type="date"
                                label="Bitiş *"
                                InputLabelProps={{ shrink: true }}
                                value={form.bitis_tarihi}
                                onChange={(e) => handleChange("bitis_tarihi", e.target.value)}
                                fullWidth
                                required
                            />

                            <TextField label="Gün Sayısı" value={form.gun_sayisi || ""} fullWidth disabled />

                            <TextField
                                label="Açıklama"
                                value={form.aciklama}
                                onChange={(e) => handleChange("aciklama", e.target.value)}
                                fullWidth
                                multiline
                                minRows={6}
                                placeholder="Gerekçe ve notlar..."
                                sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}
                            />
                        </DialogContent>

                        <DialogActions
                            sx={{
                                p: 3,
                                position: "sticky",
                                bottom: 0,
                                background:
                                    "linear-gradient(180deg, rgba(10,16,30,0.9) 0%, rgba(10,16,30,0.95) 100%)",
                                borderTop: "1px solid rgba(255,255,255,0.06)",
                            }}
                        >
                            <Button variant="contained" onClick={handleSubmit} size="large" sx={{ px: 4, py: 1.5 }}>
                                {formMode === "edit" ? "Güncelle" : "Kaydet"}
                            </Button>
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
                        </DialogActions>
                    </Dialog>
                </Container>
            </ScaleToFit>
        </ThemeProvider>
    );
}
