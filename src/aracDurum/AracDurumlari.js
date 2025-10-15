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
        warning: { main: "#F59E0B" },
        info: { main: "#38BDF8" },
    },
    shape: { borderRadius: 16 },
    typography: {
        fontFamily: 'Inter, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
                    background: "linear-gradient(180deg, rgba(10,16,30,0.95) 0%, rgba(10,16,30,0.85) 100%)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
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

/* ============= Toolbar ============= */
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
                background: "linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.6) 100%)",
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
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRefresh}>
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
    if (diff <= 0) return { level: "error", days: diff };
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
const SCREEN_KEY = "arac_durumlari"; // role_permissions için screen_key
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

    /* ===================== KPI ===================== */
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
                        editable: canEdit, // sadece izin varsa
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
                            return <Typography variant="body2">{y || "-"}</Typography>;
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
                        editable: false, // tarih hücresi formdan değişsin
                        flex: 1,
                        minWidth: 160,
                        valueGetter: safeDateValueGetter,
                        renderCell: (params) => {
                            const raw = safeRowVal(params, a.key);
                            const d = parseDate(raw);
                            const label = d ? d.format("DD.MM.YYYY") : "-";
                            const { level, days } = getDateSeverity(raw);
                            const colorMap = {
                                success: (theme) => theme.palette.success.main,
                                warning: (theme) => theme.palette.warning.main,
                                error: (theme) => theme.palette.error.main,
                                none: (theme) => theme.palette.divider,
                            };
                            return (
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
                                    <Box
                                        sx={(theme) => ({
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: colorMap[level](theme),
                                        })}
                                        title={
                                            level === "success"
                                                ? `Rahat (${days} gün var)`
                                                : level === "warning"
                                                    ? `Yaklaşıyor (${days} gün kaldı)`
                                                    : level === "error"
                                                        ? days === 0
                                                            ? "Bugün"
                                                            : `Geçmiş (${Math.abs(days)} gün)`
                                                        : "Tarih yok"
                                        }
                                    />
                                    <Typography variant="body2">{label}</Typography>
                                </Stack>
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
                        editable: canEdit, // izin kontrolü
                        valueOptions: options,
                        renderCell: (params) => {
                            const val = safeRowVal(params, a.key);
                            const color = selectColor(val);
                            return (
                                <Chip
                                    size="small"
                                    color={color === "default" ? undefined : color}
                                    label={val || "-"}
                                    variant={color === "default" ? "outlined" : undefined}
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
                    editable: canEdit, // izin kontrolü
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
                            variant={color === "default" ? "outlined" : undefined}
                        />
                    );
                },
            },
            ...actionCol,
        ];
    }, [alanlar, canEdit, canDelete]); // eslint-disable-line react-hooks/exhaustive-deps

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
            result = await supabase.from("aracdurum").update(form).eq("id", duzenlemeId);
        } else {
            if (!canCreate) {
                openSnack("Kayıt ekleme yetkiniz yok.", "warning");
                return;
            }
            result = await supabase.from("aracdurum").insert([form]);
        }
        if (result.error) return openSnack("Kayıt sırasında hata oluştu.", "error");
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
                    <Container maxWidth={false} disableGutters sx={{ width: 1920, height: 1080, mx: "auto", p: 2, boxSizing: "border-box" }}>
                        <Helmet>
                            <title>ARAÇ DURUMLARI</title>
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
                                        Araç Durumları
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                        Filtreleyin, düzenleyin ve dışa aktarın.
                                    </Typography>
                                </Stack>

                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
                                        Geri
                                    </Button>
                                    <Button variant="text" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)}>
                                        Anasayfa
                                    </Button>
                                    <Button variant="outlined" startIcon={<FilterListIcon />} onClick={() => setFiltreDrawer(true)}>
                                        Filtreler
                                    </Button>
                                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportToExcel}>
                                        Excel'e Aktar
                                    </Button>
                                    <Tooltip title={canCreate ? "Yeni kayıt oluştur" : "Yetkiniz yok"}>
                                        <span>
                                            <Button variant="contained" startIcon={<AddIcon />} onClick={handleYeni} disabled={!canCreate || alanlar.length === 0}>
                                                Yeni Kayıt
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Stack>

                            {/* KPI Cards */}
                            <Grid container spacing={2}>
                                {[
                                    { label: "Toplam Kayıt", value: toplamKayit, color: "primary" },
                                    { label: "Aktif (tahmini)", value: aktifSayisi, color: "secondary" },
                                ].map((kpi, idx) => (
                                    <Grid item xs={12} sm={6} md={3} key={idx}>
                                        <Card
                                            sx={{
                                                borderRadius: 3,
                                                background: `linear-gradient(180deg, ${alpha("#ffffff", 0.04)} 0%, ${alpha("#ffffff", 0.02)} 100%)`,
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
                                                {(yukleniyor || kaydediyor) && <LinearProgress sx={{ mt: 2, height: 6, borderRadius: 3 }} color={kpi.color} />}
                                                {!(yukleniyor || kaydediyor) && (
                                                    <LinearProgress sx={{ mt: 2, height: 6, borderRadius: 3 }} color={kpi.color} variant="determinate" value={100} />
                                                )}
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
                                    {(yukleniyor || kaydediyor) && <LinearProgress />}

                                    <Box sx={{ height: "100%", overflow: "auto", pb: 1 }}>
                                        <DataGrid
                                            style={{ height: "100%" }}
                                            rows={filtrelenmis}
                                            columns={columns}
                                            getRowId={(r) => r.id}
                                            loading={yukleniyor}
                                            disableRowSelectionOnClick
                                            pagination={false}
                                            hideFooter
                                            density="compact"
                                            rowHeight={44}
                                            columnHeaderHeight={86}
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
                                                pb: 0.5,
                                                "& .MuiDataGrid-columnHeaders": {
                                                    background: "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.7) 100%)",
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
                            <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.12)" }} />

                            <Stack spacing={2}>
                                {alanlar
                                    .filter((a) => a.key !== "id")
                                    .map((a) => {
                                        const label = a.key.replace(/_/g, " ").toUpperCase();

                                        if (a.type === "year") {
                                            return (
                                                <TextField
                                                    key={a.key}
                                                    label={label}
                                                    value={filtreler[a.key] || ""}
                                                    onChange={(e) => setFiltreler((p) => ({ ...p, [a.key]: e.target.value }))}
                                                    fullWidth
                                                />
                                            );
                                        }

                                        if (a.type === "date" || isForcedDateKey(a.key)) {
                                            return (
                                                <TextField
                                                    key={a.key}
                                                    label={label}
                                                    value={filtreler[a.key] || ""}
                                                    onChange={(e) => setFiltreler((p) => ({ ...p, [a.key]: e.target.value }))}
                                                    fullWidth
                                                />
                                            );
                                        }

                                        if (a.type === "genericSelect" || a.type === "yesnoSelect") {
                                            const options = a.type === "genericSelect" ? SELECT_ALL_OPTS : YES_NO_OPTS;
                                            return (
                                                <FormControl key={a.key} fullWidth size="small">
                                                    <InputLabel>{label}</InputLabel>
                                                    <Select
                                                        label={label}
                                                        value={filtreler[a.key] || ""}
                                                        onChange={(e) => setFiltreler((p) => ({ ...p, [a.key]: e.target.value }))}
                                                        displayEmpty
                                                    >
                                                        <MenuItem value="">
                                                            <em>Hepsi</em>
                                                        </MenuItem>
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
                                                label={label}
                                                value={filtreler[a.key] || ""}
                                                onChange={(e) => setFiltreler((p) => ({ ...p, [a.key]: e.target.value }))}
                                                fullWidth
                                            />
                                        );
                                    })}

                                <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                                    <Button fullWidth variant="outlined" color="error" onClick={() => setFiltreler({})}>
                                        Temizle
                                    </Button>
                                    <Button fullWidth variant="contained" onClick={() => setFiltreDrawer(false)}>
                                        Uygula
                                    </Button>
                                </Stack>

                                <Divider sx={{ my: 1 }} />
                                <FormControlLabel
                                    control={<Switch checked={kolonlariTespitEt} onChange={(e) => setKolonlariTespitEt(e.target.checked)} />}
                                    label="Kolonları otomatik tespit et"
                                />
                            </Stack>
                        </Drawer>

                        {/* Form Dialog */}
                        <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="lg" fullWidth>
                            <DialogTitle sx={{ pb: 0 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack>
                                        <Typography variant="h6" fontWeight={800}>
                                            {duzenlemeId ? "Kaydı Düzenle" : "Yeni Kayıt"}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                            Tarih alanlarını YYYY-MM-DD giriniz. Seçmeli alanlar listeden seçilir.
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
                                    borderTop: "1px solid rgba(255,255,255,0.06)",
                                    display: "grid",
                                    gap: 2,
                                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                                    p: 3,
                                }}
                            >
                                {alanlar
                                    .filter((a) => a.key !== "id")
                                    .map((a) => {
                                        const label = a.key.replace(/_/g, " ").toUpperCase();

                                        if (a.type === "year") {
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

                                        if (a.type === "date" || isForcedDateKey(a.key)) {
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

                                        if (a.type === "genericSelect" || a.type === "yesnoSelect") {
                                            const options = a.type === "genericSelect" ? SELECT_ALL_OPTS : YES_NO_OPTS;
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
                                <Button variant="contained" onClick={handleSubmit} size="large" sx={{ px: 4, py: 1.5 }}>
                                    {duzenlemeId ? "Güncelle" : "Kaydet"}
                                </Button>
                                <Button variant="text" onClick={() => setFormOpen(false)} size="large">
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
                            <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
                                {snack.msg}
                            </Alert>
                        </Snackbar>
                    </Container>
                </ScaleToFit>
            </LocalizationProvider>
        </ThemeProvider>
    );
}
