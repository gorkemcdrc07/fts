// src/pages/AracDurumlari.jsx
import React, { useEffect, useMemo, useState, useLayoutEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
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
    Tooltip,
    Divider,
    Snackbar,
    Alert,
    Drawer,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Badge,
    Card,
    CardContent,
    LinearProgress,
    Chip,
    FormControlLabel,
    Switch,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import FilterListIcon from "@mui/icons-material/FilterList";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarQuickFilter,
    GridToolbarColumnsButton,
    GridToolbarDensitySelector,
    GridRowEditStopReasons,
    GridActionsCellItem,
} from "@mui/x-data-grid";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

dayjs.locale("tr");
dayjs.extend(customParseFormat);

/* ===================== Zoom'dan Bağımsız Ekrana Sığdırma ===================== */
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
                // MODERİNİZE ARKA PLAN STİLİ
                background:
                    "radial-gradient(1200px 500px at 10% -10%, rgba(34,211,238,0.12), transparent 40%)," +
                    "radial-gradient(900px 400px at 90% 0%, rgba(139,92,246,0.15), transparent 50%)," +
                    "linear-gradient(180deg, #02040C 0%, #08101E 100%)",
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

/* ===================== DataGrid TR ===================== */
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

    // Pagination TR
    footerRowSelected: (count) => (count !== 1 ? `${count.toLocaleString()} kayıt seçildi` : `${count.toLocaleString()} kayıt seçildi`),
    footerTotalVisibleRows: (visibleCount, totalCount) => `${visibleCount.toLocaleString()} / ${totalCount.toLocaleString()}`,
    footerPaginationRowsPerPage: "Sayfa başına satır:",
};

/* ===================== Tema (Daha Keskinleştirildi) ===================== */
const theme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: "#8B5CF6" }, // Mor
        secondary: { main: "#22D3EE" }, // Açık Mavi
        background: { default: "#02040C", paper: alpha("#0B1220", 0.9) },
        success: { main: "#10B981" }, // Yeşil
        error: { main: "#F43F5E" }, // Kırmızı
        warning: { main: "#FBBF24" }, // Sarı/Turuncu
        info: { main: "#3B82F6" }, // Mavi
    },
    shape: { borderRadius: 16 },
    typography: {
        fontFamily: 'Inter, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        button: { textTransform: "none", fontWeight: 700 },
    },
    components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
        MuiButton: {
            defaultProps: { variant: "contained" }, // Varsayılanı contained yapalım
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: "0 4px 12px rgba(139,92,246,0.25)", // Hafif gölge
                    transition: "all 0.3s ease",
                    ":hover": {
                        boxShadow: "0 6px 16px rgba(139,92,246,0.35)",
                        transform: 'translateY(-1px)',
                    },
                },
                outlined: {
                    background: alpha("#1E293B", 0.5), // Koyu arka plan
                    borderColor: "rgba(255,255,255,0.15)",
                    boxShadow: 'none',
                    ":hover": {
                        borderColor: "rgba(255,255,255,0.3)",
                        backgroundColor: alpha("#1E293B", 0.7),
                        transform: 'none',
                    }
                }
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    // Modern Dialog Stili
                    background: "linear-gradient(180deg, #0F172A 0%, #08101E 100%)",
                    boxShadow: "0 15px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 24,
                },
            },
        },
        MuiTextField: {
            defaultProps: { variant: "outlined" },
            styleOverrides: {
                root: {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: 12,
                        backgroundColor: alpha("#10172A", 0.7), // Hafif arka plan
                    },
                    "& .MuiInputLabel-root": {
                        color: alpha("#ffffff", 0.6)
                    }
                }
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    // KPI Kartları için Derinlik
                    boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
                    background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.9), rgba(10, 16, 28, 0.9))',
                    border: '1px solid rgba(255,255,255,0.1)',
                }
            }
        },
    },
});

/* ============= Toolbar ============= */
function CustomToolbar({ onRefresh, onExport, onFilters }) {
    return (
        <GridToolbarContainer
            sx={{
                px: 1,
                py: 1, // Biraz daha fazla padding
                gap: 1.5, // Daha fazla boşluk
                position: "sticky",
                top: 0,
                zIndex: 1,
                // DAHA ŞIK TOOLBAR ARKA PLANI
                background: "linear-gradient(180deg, rgba(10,16,30,0.95) 0%, rgba(10,16,30,0.8) 100%)",
                borderBottom: "2px solid rgba(139,92,246,0.2)", // Mor çizgi
                backdropFilter: "blur(8px)",
            }}
        >
            <GridToolbarColumnsButton />
            <GridToolbarDensitySelector />
            <Box sx={{ flexGrow: 1 }} />
            <GridToolbarQuickFilter debounceMs={300} size="small" />
            <Tooltip title="Detaylı Filtreler">
                <IconButton onClick={onFilters} color="primary" sx={{ border: '1px solid #8B5CF6' }}>
                    <FilterListIcon />
                </IconButton>
            </Tooltip>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExport} size="small">
                Excel
            </Button>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRefresh} size="small">
                Yenile
            </Button>
        </GridToolbarContainer>
    );
}

/* ===================== Helpers ===================== */

// params.row güvenli erişim
const safeRowVal = (params, key) => (params && params.row ? params.row[key] : undefined);

// Grid value objesi vs. gelirse değerini al
const safeGetVal = (arg) => (arg && typeof arg === "object" && "value" in arg ? arg.value : arg);

// --- Tarih parser (çok format + Excel seri no desteği) ---
const DATE_FORMATS = [
    "YYYY-MM-DD",
    "YYYY-M-D",
    "DD.MM.YYYY",
    "D.M.YYYY",
    "DD-MM-YYYY",
    "D-M-YYYY",
    "DD/MM/YYYY",
    "D/M/YYYY",
    "YYYY/MM/DD",
    "YYYY.MM.DD",
    "YYYY.M.DD",
];

const isExcelSerial = (n) => Number.isFinite(n) && n > 59 && n < 60000;

const excelSerialToDate = (serial) => {
    const epoch = new Date(Date.UTC(1899, 11, 30)); // Excel epoch
    const ms = serial * 86400000;
    return new Date(epoch.getTime() + ms);
};

const parseDate = (input) => {
    if (input == null || input === "") return null;

    if (typeof input === "number") {
        if (isExcelSerial(input)) return dayjs(excelSerialToDate(input));
        if (input > 10_000_000_000) return dayjs(new Date(input));
        return null;
    }

    const s = String(input).trim();

    const isoTry = dayjs(s);
    if (isoTry.isValid()) return isoTry;

    for (const fmt of DATE_FORMATS) {
        const d = dayjs(s, fmt, true);
        if (d.isValid()) return d;
    }

    const first10 = s.slice(0, 10);
    for (const fmt of DATE_FORMATS) {
        const d = dayjs(first10, fmt, true);
        if (d.isValid()) return d;
    }

    return null;
};

const safeDateValueGetter = (arg) => {
    const v = safeGetVal(arg);
    const d = parseDate(v);
    return d ? d.toDate() : null;
};

// Tarih yaklaşma şiddeti
const getDateSeverity = (dateStr) => {
    const d = parseDate(dateStr);
    if (!d) return { level: "none", days: null };
    const today = dayjs().startOf("day");
    const diff = d.diff(today, "day");
    if (diff < 0) return { level: "error", days: diff }; // Geçmiş
    if (diff === 0) return { level: "error", days: 0 }; // Bugün
    if (diff <= 7) return { level: "warning", days: diff };
    return { level: "success", days: diff };
};

/* === KEY NORMALIZE === */
const trMap = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
const normalizeKey = (k) =>
    String(k || "").toLowerCase().replace(/[çğıöşü]/g, (m) => trMap[m]).replace(/[^a-z0-9]+/g, "");

// ---- Alan sıralama yardımcıları ----
const choosePreferDateKey = (keys, base) => {
    const withDate = `${base}_date`;
    if (keys.includes(withDate)) return withDate;
    if (keys.includes(base)) return base;
    const found = keys.find((k) => normalizeKey(k) === normalizeKey(base));
    return found || null;
};

const reorderFieldsAfterModel = (fields) => {
    const keys = fields.map((f) => f.key);
    const targetsBase = ["cekici_muayene", "dorse_muayene", "trafik_sigorta"];
    const chosenKeys = targetsBase.map((base) => choosePreferDateKey(keys, base)).filter(Boolean);
    const anchorKey = fields.find((f) => normalizeKey(f.key) === normalizeKey("arac_model"))?.key;
    if (!anchorKey || chosenKeys.length === 0) return fields;

    const rest = fields.filter((f) => !chosenKeys.includes(f.key));
    const anchorIdx = rest.findIndex((f) => f.key === anchorKey);
    if (anchorIdx === -1) return fields;

    const before = rest.slice(0, anchorIdx + 1);
    const after = rest.slice(anchorIdx + 1);
    const chosenFieldObjs = chosenKeys.map((k) => fields.find((f) => f.key === k)).filter(Boolean);
    return [...before, ...chosenFieldObjs, ...after];
};

/* === ZORUNLU TARİH SÜTUNLARI === */
const FORCED_DATE_KEYS = new Set(["cekici muayene", "dorse muayene", "trafik sigorta"].map((s) => normalizeKey(s)));
const isForcedDateKey = (k) => FORCED_DATE_KEYS.has(normalizeKey(k));

// İsim bazlı tarih
const isDateKey = (k) => /(tarih|date|updated|created|muayene|sigorta|vize)/i.test(String(k)) || isForcedDateKey(k);

/* === YALNIZCA YIL OLAN ALANLAR === */
const YEAR_ONLY_KEYS = new Set(
    ["araç yıl", "arac yil", "araçyıl", "aracyil", "dorse yıl", "dorse yil", "dorsel yıl", "dorsel yil", "arac_yil", "dorse_yil"].map(
        (s) => normalizeKey(s)
    )
);
const isYearKey = (k) => YEAR_ONLY_KEYS.has(normalizeKey(k));

// Değerden güvenli yıl çıkar
const toYearString = (val) => {
    if (val == null || val === "") return "";
    const d = parseDate(val);
    if (d) return String(d.year());
    const m = String(val).match(/\b(19\d{2}|20\d{2}|21\d{2})\b/);
    return m ? m[0] : "";
};

/* === SEÇMELİ SÜTUN TANIMLARI === */
const SELECT_ALL_OPTS = ["EKSİK VAR", "VAR", "YOK", "SORUN YOK", "ARIZALI", "SORUNLU"];
const YES_NO_OPTS = ["VAR", "YOK"];

const GENERIC_SELECT_KEYS = new Set(
    [
        "DORSE YAN TENTE",
        "DORSE UST TENTE",
        "DORSE CITALARI",
        "DORSE ARKA KAPAK",
        "STANGA SPANZET",
        "DORSE TABAN",
        "LIFTMASTER",
        "DORSE LASTIK",
        "CEKICI LASTIK",
        "STANGA",
        "SPANZET",
    ].map((s) => normalizeKey(s))
);

const YESNO_SELECT_KEYS = new Set(["PSIKOTEKNIK", "SRC"].map((s) => normalizeKey(s)));

const isGenericSelectKey = (k) => GENERIC_SELECT_KEYS.has(normalizeKey(k));
const isYesNoSelectKey = (k) => YESNO_SELECT_KEYS.has(normalizeKey(k));

const selectColor = (val) => {
    const v = String(val || "").trim().toLowerCase();
    if (v === "var" || v === "sorun yok") return "success";
    if (v === "eksik var") return "warning";
    if (v === "yok") return "error";
    if (v === "arızalı" || v === "arizali") return "primary";
    if (v === "sorunlu") return "info";
    return "default";
};

// İlk 50 kayda bak; parsable oranı >= %60 ise 'date' sütunu say
const looksLikeDateColumn = (key, rows) => {
    const sample = rows.slice(0, 50).map((r) => r?.[key]).filter((v) => v !== "" && v != null);
    if (sample.length === 0) return false;
    const hits = sample.reduce((acc, v) => acc + (parseDate(v) ? 1 : 0), 0);
    return hits / sample.length >= 0.6;
};

/* ===================== ►►► YETKİ ◄◄◄ ===================== */
const SCREEN_KEY = "arac_durumlari";
const ROLE_NAME_TO_KEY = { "YÖNETİCİ": "YONETICI", "OPERASYON": "OPERASYON", "TAKİP": "TAKIP" };

async function fetchPerms() {
    const kullaniciId = parseInt(localStorage.getItem("kullaniciId"));
    if (!kullaniciId) return { create: false, edit: false, delete: false };

    // 1) User override (user_permissions: adur_* kolonları, screen_key yok)
    const { data: up } = await supabase
        .from("user_permissions")
        .select("adur_create, adur_edit, adur_delete")
        .eq("user_id", kullaniciId)
        .maybeSingle();

    if (up && Object.values(up).some((v) => typeof v === "boolean")) {
        return {
            create: !!up.adur_create,
            edit: !!up.adur_edit,
            delete: !!up.adur_delete,
        };
    }

    // 2) Rol -> role_permissions (arcdur_* + screen_key)
    const { data: u } = await supabase.from("login").select("rol").eq("id", kullaniciId).maybeSingle();
    const roleKey = ROLE_NAME_TO_KEY[String(u?.rol || "").toUpperCase()] || String(u?.rol || "").toUpperCase();
    if (!roleKey) return { create: false, edit: false, delete: false };

    const { data: role } = await supabase.from("roles").select("id").eq("key", roleKey).maybeSingle();
    if (!role?.id) return { create: false, edit: false, delete: false };

    const { data: rp } = await supabase
        .from("role_permissions")
        .select("arcdur_create, arcdur_edit, arcdur_delete")
        .eq("role_id", role.id)
        .eq("screen_key", SCREEN_KEY)
        .maybeSingle();

    if (rp && Object.values(rp).some((v) => typeof v === "boolean")) {
        return {
            create: !!rp.arcdur_create,
            edit: !!rp.arcdur_edit,
            delete: !!rp.arcdur_delete,
        };
    }

    // Eski şema fallback (screen_key olmadan)
    const { data: rp2 } = await supabase
        .from("role_permissions")
        .select("arcdur_create, arcdur_edit, arcdur_delete")
        .eq("role_id", role.id)
        .maybeSingle();

    return {
        create: !!rp2?.arcdur_create,
        edit: !!rp2?.arcdur_edit,
        delete: !!rp2?.arcdur_delete,
    };
}

/* ===================== Bileşen ===================== */
export default function AracDurumlari() {
    const navigate = useNavigate();

    // data
    const [kayitlar, setKayitlar] = useState([]);
    const [yukleniyor, setYukleniyor] = useState(false);
    const [kaydediyor, setKaydediyor] = useState(false);

    // dynamic schema
    const [alanlar, setAlanlar] = useState([]); // [{ key, type }]

    // ui
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
    const [filtreDrawer, setFiltreDrawer] = useState(false);
    const [kolonlariTespitEt, setKolonlariTespitEt] = useState(true);

    // form
    const [formOpen, setFormOpen] = useState(false);
    const [duzenlemeId, setDuzenlemeId] = useState(null);
    const [form, setForm] = useState({});

    // ► izinler
    const [canCreate, setCanCreate] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [canDelete, setCanDelete] = useState(false);

    const openSnack = (msg, severity = "success") => setSnack({ open: true, msg, severity });

    /* ===================== Veriler ===================== */
    const verileriGetir = useCallback(async () => {
        setYukleniyor(true);
        const { data, error } = await supabase.from("aracdurum").select("*").order("id", { ascending: false });

        if (error) {
            openSnack("Araç durumları alınamadı.", "error");
            setYukleniyor(false);
            return;
        }

        // Gelen veriyi normalize et
        const temiz = (data || []).map((r) => {
            const c = { ...r };
            Object.keys(c).forEach((k) => {
                if (isYearKey(k)) {
                    c[k] = toYearString(c[k]);
                } else if (isDateKey(k) && c[k] != null && c[k] !== "") {
                    const d = parseDate(c[k]);
                    // Supabase'e geri göndermek için dayjs objesi yerine standart YYYY-MM-DD string'i kullanalım
                    c[k] = d ? d.format("YYYY-MM-DD") : String(c[k]).trim();
                }
            });
            return c;
        });

        setKayitlar(temiz);

        if (kolonlariTespitEt) {
            const first = temiz[0] || {};
            const keys = Object.keys(first);

            const fields = keys.map((k) => {
                if (isYearKey(k)) return { key: k, type: "year" };

                const isDateByName = isDateKey(k);
                const isDateByData = !isDateByName && looksLikeDateColumn(k, temiz);

                const type =
                    isDateByName || isDateByData
                        ? "date"
                        : isGenericSelectKey(k)
                            ? "genericSelect"
                            : isYesNoSelectKey(k)
                                ? "yesnoSelect"
                                : "text";

                return { key: k, type };
            });

            const ordered = reorderFieldsAfterModel(fields);
            setAlanlar(ordered);
        }

        setYukleniyor(false);
    }, [kolonlariTespitEt]);

    useEffect(() => {
        verileriGetir();
        (async () => {
            try {
                const p = await fetchPerms();
                setCanCreate(!!p.create);
                setCanEdit(!!p.edit);
                setCanDelete(!!p.delete);
            } catch {
                setCanCreate(false);
                setCanEdit(false);
                setCanDelete(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ===================== KPI (Kaldırıldı) ===================== */
    const toplamKayit = kayitlar.length;
    const aktifSayisi = useMemo(() => {
        const hasDurum = kayitlar[0] && Object.keys(kayitlar[0]).includes("durum");
        if (!hasDurum) return 0;
        return kayitlar.filter((r) => String(r.durum || "").toLowerCase().includes("aktif")).length;
    }, [kayitlar]);

    /* ===================== Excel ===================== */
    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(kayitlar);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "AracDurumlari");
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([buf], { type: "application/octet-stream" }), "arac_durumlari.xlsx");
    };

    /* ===================== Filtreler (Dinamik) ===================== */
    const [filtreler, setFiltreler] = useState({});

    const filtrelenmis = useMemo(() => {
        const keys = Object.keys(filtreler).filter((k) => filtreler[k] !== "" && filtreler[k] != null);
        if (keys.length === 0) return kayitlar;
        return kayitlar.filter((row) =>
            keys.every((k) => {
                const v = row[k];
                const f = filtreler[k];
                if (!f) return true;
                return String(v ?? "").toLowerCase().includes(String(f).toLowerCase());
            })
        );
    }, [kayitlar, filtreler]);

    /* ===================== INLINE KAYDETME ===================== */
    const processRowUpdate = async (newRow, oldRow) => {
        // edit izni yoksa engelle
        if (!canEdit) {
            openSnack("Düzenleme yetkiniz yok.", "warning");
            return oldRow;
        }

        const diff = {};
        Object.keys(newRow).forEach((k) => {
            if (k === "id") return;
            if (newRow[k] !== oldRow[k]) diff[k] = newRow[k];
        });
        if (Object.keys(diff).length === 0) return newRow;
        setKaydediyor(true);
        const { error } = await supabase.from("aracdurum").update(diff).eq("id", newRow.id);
        setKaydediyor(false);
        if (error) {
            openSnack("Güncelleme başarısız.", "error");
            throw error;
        }
        openSnack("Kayıt güncellendi.");
        return newRow;
    };

    const handleRowEditStop = (params, event) => {
        if (params.reason === GridRowEditStopReasons.rowFocusOut) {
            event.defaultMuiPrevented = true;
        }
    };

    /* ===================== Kolonlar (Dinamik) ===================== */
    const columns = useMemo(() => {
        if (alanlar.length === 0) return [];
        const dynamicCols = alanlar
            .filter((a) => a.key !== "id")
            .map((a) => {
                const header = a.key.replace(/_/g, " ").toUpperCase();

                // YEAR
                if (a.type === "year") {
                    return {
                        field: a.key,
                        headerName: header,
                        type: "number",
                        editable: canEdit,
                        flex: 0.6,
                        minWidth: 120,
                        valueGetter: (params) => {
                            const raw = safeRowVal(params, a.key);
                            const y = toYearString(raw);
                            return y ? Number(y) : null;
                        },
                        valueFormatter: (params) => (params && params.value ? String(params.value) : "-"),
                        renderCell: (params) => {
                            const raw = safeRowVal(params, a.key);
                            const y = toYearString(raw);
                            return <Typography variant="body2" fontWeight={600} color={theme.palette.info.light}>{y || "-"}</Typography>;
                        },
                    };
                }

                // DATE
                const thisIsDate = a.type === "date" || isForcedDateKey(a.key);
                if (thisIsDate) {
                    return {
                        field: a.key,
                        headerName: header,
                        type: "date",
                        editable: false,
                        flex: 1,
                        minWidth: 160,
                        valueGetter: safeDateValueGetter,
                        renderCell: (params) => {
                            const raw = safeRowVal(params, a.key);
                            const d = parseDate(raw);
                            const label = d ? d.format("DD.MM.YYYY") : "-";
                            const { level, days } = getDateSeverity(raw);

                            const colorMap = {
                                success: theme.palette.success.main,
                                warning: theme.palette.warning.main,
                                error: theme.palette.error.main,
                                none: theme.palette.divider,
                            };
                            const bgColorMap = {
                                success: alpha(theme.palette.success.main, 0.1),
                                warning: alpha(theme.palette.warning.main, 0.1),
                                error: alpha(theme.palette.error.main, 0.1),
                                none: 'transparent',
                            };
                            const tooltipText =
                                level === "success" ? `Rahat (${days} gün var)` :
                                    level === "warning" ? `Yaklaşıyor (${days} gün kaldı)` :
                                        level === "error" ? (days === 0 ? "Bugün Son Gün!" : `Geçmiş (${Math.abs(days)} gün)`) :
                                            "Tarih yok";

                            return (
                                <Tooltip title={tooltipText} placement="left">
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        spacing={1}
                                        sx={{
                                            width: "100%",
                                            p: 0.5,
                                            borderRadius: 1,
                                            bgcolor: bgColorMap[level],
                                            borderLeft: `3px solid ${colorMap[level]}`,
                                            fontWeight: 600
                                        }}
                                    >
                                        <Box
                                            component={level === 'error' ? ErrorOutlineIcon : level === 'warning' ? WarningAmberIcon : CheckCircleOutlineIcon}
                                            sx={{ fontSize: 14, color: colorMap[level] }}
                                        />
                                        <Typography variant="body2" color={level === 'none' ? 'text.secondary' : 'inherit'}>
                                            {label}
                                        </Typography>
                                    </Stack>
                                </Tooltip>
                            );
                        },
                    };
                }

                // SELECT
                if (a.type === "genericSelect" || a.type === "yesnoSelect") {
                    const options = a.type === "genericSelect" ? SELECT_ALL_OPTS : YES_NO_OPTS;
                    return {
                        field: a.key,
                        headerName: header,
                        flex: 1,
                        minWidth: 180,
                        type: "singleSelect",
                        editable: canEdit,
                        valueOptions: options,
                        renderCell: (params) => {
                            const val = safeRowVal(params, a.key);
                            const color = selectColor(val);
                            return (
                                <Chip
                                    size="small"
                                    color={color === "default" ? undefined : color}
                                    label={val || "-"}
                                    variant={color === "default" ? "outlined" : "filled"}
                                    sx={{
                                        borderRadius: 1.5,
                                        fontWeight: 600,
                                        // Özel renk geçişleri
                                        bgcolor: color === "default" ? undefined : alpha(theme.palette[color].main, 0.15),
                                        color: color === "default" ? undefined : theme.palette[color].main,
                                    }}
                                />
                            );
                        },
                    };
                }

                // TEXT
                return {
                    field: a.key,
                    headerName: header,
                    flex: 1,
                    minWidth: 140,
                    editable: canEdit,
                    renderCell: (params) => {
                        const val = safeRowVal(params, a.key);
                        return <Typography variant="body2">{val ?? "-"}</Typography>;
                    },
                };
            });

        // Actions: izinlere göre oluştur
        const actionItems = [];
        if (canEdit) {
            actionItems.push((params) => (
                <GridActionsCellItem
                    icon={<EditIcon fontSize="inherit" />}
                    label="Düzenle"
                    onClick={() => handleDuzenle(params.row)}
                    showInMenu
                />
            ));
        }
        if (canDelete) {
            actionItems.push((params) => (
                <GridActionsCellItem
                    icon={<DeleteIcon fontSize="inherit" />}
                    label="Sil"
                    onClick={() => handleSil(params.row.id)}
                    showInMenu
                />
            ));
        }

        const actionCol =
            actionItems.length > 0
                ? [
                    {
                        field: "actions",
                        type: "actions",
                        headerName: "İŞLEM",
                        width: 130,
                        getActions: (params) => actionItems.map((fn) => fn(params)),
                    },
                ]
                : [];

        return [
            ...dynamicCols,
            {
                field: "durum_badge",
                headerName: "DURUM",
                width: 120,
                sortable: false,
                filterable: false,
                renderCell: (params) => {
                    const hasDurum = params && params.row && "durum" in params.row;
                    if (!hasDurum) return <Chip size="small" label="-" variant="outlined" />;
                    const val = String(params.row.durum || "").toLowerCase();
                    const color =
                        val.includes("aktif")
                            ? "success"
                            : val.includes("bekle") || val.includes("servis")
                                ? "warning"
                                : val.includes("pasif") || val.includes("ariza")
                                    ? "error"
                                    : "default";
                    return (
                        <Chip
                            size="small"
                            color={color === "default" ? undefined : color}
                            label={params.row.durum}
                            variant={color === "default" ? "outlined" : "filled"}
                            sx={{
                                borderRadius: 1.5,
                                fontWeight: 600,
                                bgcolor: color === "default" ? undefined : alpha(theme.palette[color].main, 0.15),
                                color: color === "default" ? undefined : theme.palette[color].main,
                            }}
                        />
                    );
                },
            },
            ...actionCol,
        ];
    }, [alanlar, canEdit, canDelete, theme.palette]);

    /* ===================== CRUD ===================== */
    const handleYeni = () => {
        if (!canCreate) {
            openSnack("Yeni kayıt oluşturmaya yetkiniz yok.", "warning");
            return;
        }
        const empty = Object.fromEntries(alanlar.filter((a) => a.key !== "id").map((a) => [a.key, ""]));
        setForm(empty);
        setDuzenlemeId(null);
        setFormOpen(true);
    };

    const handleDuzenle = (row) => {
        if (!canEdit) {
            openSnack("Düzenleme yetkiniz yok.", "warning");
            return;
        }
        const editable = Object.fromEntries(Object.entries(row).filter(([k]) => k !== "id"));
        setForm(editable);
        setDuzenlemeId(row.id);
        setFormOpen(true);
    };

    const handleSil = async (id) => {
        if (!canDelete) {
            openSnack("Silme yetkiniz yok.", "warning");
            return;
        }
        if (!window.confirm("Silmek istediğinize emin misiniz?")) return;
        const { error } = await supabase.from("aracdurum").delete().eq("id", id);
        if (error) return openSnack("Silme sırasında hata oluştu.", "error");
        openSnack("Kayıt silindi.");
        verileriGetir();
    };

    const handleSubmit = async () => {
        let result;
        if (duzenlemeId) {
            if (!canEdit) {
                openSnack("Düzenleme yetkiniz yok.", "warning");
                return;
            }
            // Formu temizle ve Supabase'e uygun hale getir
            const cleanForm = Object.fromEntries(
                Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
            );

            result = await supabase.from("aracdurum").update(cleanForm).eq("id", duzenlemeId);
        } else {
            if (!canCreate) {
                openSnack("Kayıt ekleme yetkiniz yok.", "warning");
                return;
            }
            const cleanForm = Object.fromEntries(
                Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
            );
            result = await supabase.from("aracdurum").insert([cleanForm]);
        }
        if (result.error) return openSnack("Kayıt sırasında hata oluştu. " + result.error.message, "error");
        openSnack(duzenlemeId ? "Kayıt güncellendi." : "Kayıt eklendi.");
        setFormOpen(false);
        setDuzenlemeId(null);
        verileriGetir();
    };

    /* ===================== Render ===================== */
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <ScaleToFit>
                    <Container maxWidth={false} disableGutters sx={{ width: 1920, height: 1080, mx: "auto", p: 4, boxSizing: "border-box" }}>
                        <Helmet>
                            <title>ARAÇ DURUMLARI</title>
                        </Helmet>

                        <Stack spacing={3} sx={{ height: "100%", minHeight: 0 }}>
                            {/* Header + Actions */}
                            <Stack
                                direction={{ xs: "column", md: "row" }}
                                alignItems={{ xs: "flex-start", md: "center" }}
                                justifyContent="space-between"
                                gap={3}
                            >
                                <Stack>
                                    <Typography
                                        variant="h3" // Daha büyük ve etkileyici başlık
                                        fontWeight={800}
                                        sx={{
                                            background: "linear-gradient(90deg,#F59E0B,#A78BFA)", // Daha canlı gradyan
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                        }}
                                    >
                                        Araç Durumları Yönetimi
                                    </Typography>
                                    <Typography variant="body1" sx={{ color: alpha("#E2E8F0", 0.7) }}>
                                        Dinamik envanter takibi ve denetimi.
                                    </Typography>
                                </Stack>

                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="large">
                                        Geri
                                    </Button>
                                    <Button variant="text" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)} size="large">
                                        Anasayfa
                                    </Button>
                                    <Tooltip title={canCreate ? "Yeni kayıt oluştur" : "Yetkiniz yok"}>
                                        <span>
                                            <Button
                                                variant="contained"
                                                startIcon={<AddIcon />}
                                                onClick={handleYeni}
                                                disabled={!canCreate || alanlar.length === 0}
                                                size="large"
                                                color="success"
                                                sx={{
                                                    boxShadow: '0 6px 15px rgba(34,197,94,0.4)',
                                                    ":hover": { boxShadow: '0 8px 20px rgba(34,197,94,0.6)' }
                                                }}
                                            >
                                                Yeni Kayıt
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Stack>

                            {/* Grid */}
                            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                <Paper
                                    sx={{
                                        height: '100%',
                                        borderRadius: 4,
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        overflow: "hidden",
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                    }}
                                >
                                    {(yukleniyor || kaydediyor) && <LinearProgress sx={{ height: 6 }} />}

                                    <Box sx={{ height: 'calc(100% - 6px)', overflow: "auto" }}>
                                        <DataGrid
                                            rows={filtrelenmis}
                                            columns={columns}
                                            getRowId={(r) => r.id}
                                            loading={yukleniyor}
                                            disableRowSelectionOnClick
                                            // Sayfalandırma ile tablo uzunluğu kontrol altında
                                            initialState={{
                                                pagination: { paginationModel: { pageSize: 50 } }, // Varsayılan 50 satır
                                            }}
                                            pageSizeOptions={[25, 50, 100]} // Sayfa boyutu seçenekleri
                                            density="compact"
                                            rowHeight={48} // Ferah satırlar
                                            columnHeaderHeight={64} // Daha kalın başlık alanı
                                            localeText={GRID_TR}
                                            editMode="row"
                                            processRowUpdate={processRowUpdate}
                                            onProcessRowUpdateError={(e) => console.error(e)}
                                            onRowEditStop={handleRowEditStop}
                                            slots={{
                                                toolbar: () => (
                                                    <CustomToolbar onFilters={() => setFiltreDrawer(true)} onExport={exportToExcel} onRefresh={verileriGetir} />
                                                ),
                                            }}
                                            sx={{
                                                border: "none",
                                                fontSize: 14,
                                                "& .MuiDataGrid-columnHeaders": {
                                                    // DataGrid başlık stili iyileştirme
                                                    background: "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.85) 100%)",
                                                    color: "#C8D1E6",
                                                    borderBottom: `2px solid ${theme.palette.secondary.main}`, // Açık mavi çizgi
                                                    fontWeight: 700,
                                                    fontSize: 16,
                                                    padding: '0 10px'
                                                },
                                                "& .MuiDataGrid-columnHeaderTitle": { whiteSpace: "normal", lineHeight: 1.2 },
                                                "& .MuiDataGrid-row:nth-of-type(2n) .MuiDataGrid-cell": {
                                                    backgroundColor: "rgba(255,255,255,0.015)",
                                                },
                                                "& .MuiDataGrid-cell": {
                                                    borderBottomColor: "rgba(255,255,255,0.08)",
                                                },
                                                "& .MuiDataGrid-row:hover .MuiDataGrid-cell": {
                                                    backgroundColor: alpha(theme.palette.primary.main, 0.15), // Mor vurgu
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
                                        width: 460, // Daha geniş filtre çekmecesi
                                        backgroundColor: "#0F172A",
                                        color: "text.primary",
                                        p: 3,
                                        borderLeft: "1px solid rgba(255,255,255,0.1)",
                                        boxShadow: '0 0 25px rgba(0,0,0,0.8)',
                                    },
                                },
                            }}
                        >
                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                <Typography variant="h5" fontWeight={700}>Detaylı Filtreler</Typography>
                                <IconButton onClick={() => setFiltreDrawer(false)} color="primary">
                                    <CloseIcon />
                                </IconButton>
                            </Stack>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Metin alanları için arama yapın, seçmeli alanlar için değer seçin.
                            </Typography>
                            <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.12)" }} />

                            <Stack spacing={3}>
                                {alanlar
                                    .filter((a) => a.key !== "id")
                                    .map((a) => {
                                        const label = a.key.replace(/_/g, " ").toUpperCase();
                                        const isSelect = a.type === "genericSelect" || a.type === "yesnoSelect";
                                        const options = isSelect ? (a.type === "genericSelect" ? SELECT_ALL_OPTS : YES_NO_OPTS) : [];

                                        // Filtre bileşeni
                                        const FilterComponent = isSelect ? (
                                            <FormControl key={a.key} fullWidth size="small">
                                                <InputLabel>{label}</InputLabel>
                                                <Select
                                                    label={label}
                                                    value={filtreler[a.key] || ""}
                                                    onChange={(e) => setFiltreler((p) => ({ ...p, [a.key]: e.target.value }))}
                                                >
                                                    <MenuItem value=""><em>Hepsi</em></MenuItem>
                                                    {options.map((opt) => (<MenuItem key={opt} value={opt}>{opt}</MenuItem>))}
                                                </Select>
                                            </FormControl>
                                        ) : (
                                            <TextField
                                                key={a.key}
                                                label={label}
                                                value={filtreler[a.key] || ""}
                                                onChange={(e) => setFiltreler((p) => ({ ...p, [a.key]: e.target.value }))}
                                                fullWidth
                                                size="small"
                                            />
                                        );

                                        return FilterComponent;
                                    })}

                                <Stack direction="row" spacing={2} sx={{ pt: 2 }}>
                                    <Button fullWidth variant="outlined" color="error" onClick={() => setFiltreler({})} size="large">
                                        Temizle
                                    </Button>
                                    <Button fullWidth variant="contained" onClick={() => setFiltreDrawer(false)} size="large">
                                        Uygula
                                    </Button>
                                </Stack>

                                <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,0.12)" }} />
                                <FormControlLabel
                                    control={<Switch checked={kolonlariTespitEt} onChange={(e) => setKolonlariTespitEt(e.target.checked)} color="secondary" />}
                                    label={<Typography variant="body2" color="text.secondary">Kolonları otomatik tespit et (Yenileme gerekir)</Typography>}
                                />
                            </Stack>
                        </Drawer>

                        {/* Form Dialog */}
                        <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
                            <DialogTitle sx={{ p: 3 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack>
                                        <Typography variant="h5" fontWeight={700}>
                                            {duzenlemeId ? "Kaydı Düzenle" : "Yeni Kayıt Oluştur"}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                            Lütfen tüm alanları doğru formatta doldurunuz.
                                        </Typography>
                                    </Stack>
                                    <IconButton onClick={() => setFormOpen(false)} color="primary">
                                        <CloseIcon />
                                    </IconButton>
                                </Stack>
                            </DialogTitle>

                            <DialogContent
                                dividers
                                sx={{
                                    borderTop: "1px solid rgba(255,255,255,0.08)",
                                    display: "grid",
                                    gap: 3,
                                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" }, // Daha dinamik kolon sayısı
                                    p: 3,
                                }}
                            >
                                {alanlar
                                    .filter((a) => a.key !== "id")
                                    .map((a) => {
                                        const label = a.key.replace(/_/g, " ").toUpperCase();
                                        const isYear = a.type === "year";
                                        const isDate = a.type === "date" || isForcedDateKey(a.key);
                                        const isSelect = a.type === "genericSelect" || a.type === "yesnoSelect";
                                        const options = isSelect ? (a.type === "genericSelect" ? SELECT_ALL_OPTS : YES_NO_OPTS) : [];

                                        if (isYear) {
                                            const val = toYearString(form[a.key]);
                                            return (
                                                <DatePicker
                                                    key={a.key}
                                                    label={label}
                                                    views={["year"]}
                                                    openTo="year"
                                                    value={val ? dayjs(val, "YYYY", true) : null}
                                                    onChange={(d) =>
                                                        setForm((p) => ({
                                                            ...p,
                                                            [a.key]: d ? dayjs(d).format("YYYY") : "",
                                                        }))
                                                    }
                                                    slotProps={{ textField: { fullWidth: true, size: "small" } }}
                                                />
                                            );
                                        }

                                        if (isDate) {
                                            return (
                                                <DatePicker
                                                    key={a.key}
                                                    label={label}
                                                    value={form[a.key] ? parseDate(form[a.key]) : null}
                                                    onChange={(d) =>
                                                        setForm((p) => ({
                                                            ...p,
                                                            [a.key]: d ? dayjs(d).format("YYYY-MM-DD") : "",
                                                        }))
                                                    }
                                                    slotProps={{ textField: { fullWidth: true, size: "small" } }}
                                                />
                                            );
                                        }

                                        if (isSelect) {
                                            return (
                                                <FormControl key={a.key} fullWidth size="small">
                                                    <InputLabel>{label}</InputLabel>
                                                    <Select label={label} value={form[a.key] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [a.key]: e.target.value }))}>
                                                        {options.map((opt) => (
                                                            <MenuItem key={opt} value={opt}>
                                                                {opt}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            );
                                        }

                                        return (
                                            <TextField
                                                key={a.key}
                                                size="small"
                                                label={label}
                                                value={form[a.key] ?? ""}
                                                onChange={(e) => setForm((p) => ({ ...p, [a.key]: e.target.value }))}
                                                fullWidth
                                            />
                                        );
                                    })}
                            </DialogContent>

                            <DialogActions sx={{ p: 3 }}>
                                <Button variant="contained" onClick={handleSubmit} size="large" sx={{ px: 5, py: 1.5 }} color={duzenlemeId ? "primary" : "success"}>
                                    {duzenlemeId ? "Güncelle" : "Kaydet"}
                                </Button>
                                <Button variant="outlined" onClick={() => setFormOpen(false)} size="large">
                                    Kapat
                                </Button>
                            </DialogActions>
                        </Dialog>

                        <Snackbar
                            open={snack.open}
                            autoHideDuration={3000} // Süre biraz uzatıldı
                            onClose={() => setSnack((s) => ({ ...s, open: false }))}
                            anchorOrigin={{ vertical: "top", horizontal: "right" }} // Konum değiştirildi
                        >
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
