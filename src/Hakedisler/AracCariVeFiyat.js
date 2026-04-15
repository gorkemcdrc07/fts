// src/Hakedisler/AracCariVeFiyat.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

import {
    Box,
    Button,
    Chip,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Drawer,
    Grid,
    IconButton,
    InputAdornment,
    LinearProgress,
    MenuItem,
    Paper,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
    CircularProgress,
    alpha,
    Alert,
    Snackbar,
    List,
    ListItem,
    ListItemText,
} from "@mui/material";

import {
    Add as AddIcon,
    ArrowBackIosNew as ArrowBackIcon,
    CheckCircle as CheckCircleIcon,
    ClearAll as ClearAllIcon,
    CloudUpload as CloudUploadIcon,
    Download as DownloadIcon,
    Edit as EditIcon,
    FilterAlt as FilterAltIcon,
    HomeOutlined as HomeIcon,
    Inventory2Outlined as Inventory2OutlinedIcon,
    LocalShippingOutlined as LocalShippingOutlinedIcon,
    Refresh as RefreshIcon,
    Search as SearchIcon,
    Tune as TuneIcon,
    UploadFile as UploadFileIcon,
    PlaylistAdd as PlaylistAddIcon,
    WarningAmber as WarningAmberIcon,
} from "@mui/icons-material";

import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/* ===================== Sabitler ===================== */
const HOME_PATH = "/anasayfa";
const SCREEN_KEY = "arac_cari_fiyat";

const emptyFilters = {
    plaka: "",
    cari_id: "",
    cari_adi: "",
    arac_sahip: "",
    odak_arac_calisma_tipi: "",
    aylik_kira_min: "",
    aylik_kira_max: "",
    aylik_surucu_min: "",
    aylik_surucu_max: "",
    toplam_min: "",
    toplam_max: "",
    calisma_gunu_min: "",
    calisma_gunu_max: "",
    pasif: "hepsi",
    aciklama: "",
    duzenleyen: "",
    tarih_from: "",
    tarih_to: "",
};

const emptyForm = {
    plaka: "",
    cari_id: "",
    cari_adi: "",
    arac_sahip: "",
    odak_arac_calisma_tipi: "",
    aylik_kira: "",
    aylik_surucu: "",
    anlasilan_yakma_orani: "",
    calisma_gunu: "",
    pasif: false,
    aciklama: "",
};
/* ===================== Helpers ===================== */
function formatTL(value) {
    if (value === null || value === undefined || value === "") return "—";
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    return num.toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2,
    });
}

function formatTLCompact(value) {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    return num.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatPercent(value) {
    if (value === null || value === undefined || value === "") return "—";
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);

    return `%${num.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString("tr-TR");
}

function toNumberLoose(v) {
    if (v === "" || v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    const s = String(v)
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
}

function parseTLToNumber(v) {
    if (v === "" || v === null || v === undefined) return null;

    // Excel hücresi zaten sayıysa direkt dön
    if (typeof v === "number") {
        return Number.isFinite(v) ? v : null;
    }

    // ExcelJS bazen obje döndürebilir
    if (typeof v === "object") {
        if (typeof v.result === "number") {
            return Number.isFinite(v.result) ? v.result : null;
        }
        if (typeof v.text === "string") {
            v = v.text;
        } else {
            v = String(v);
        }
    }

    let s = String(v).trim();

    // Para sembolü ve boşlukları temizle
    s = s.replace(/[₺\s]/g, "");

    // TR format: 252.126,56 -> 252126.56
    if (s.includes(".") && s.includes(",")) {
        s = s.replace(/\./g, "").replace(",", ".");
    }
    // 252126,56 -> 252126.56
    else if (s.includes(",")) {
        s = s.replace(",", ".");
    }
    // 252126.56 ise olduğu gibi bırak

    const n = Number(s);
    return Number.isNaN(n) ? null : n;
}
function addThousandDots(intStr) {
    const normalized = String(intStr || "").replace(/^0+(?=\d)/, "");
    return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatTLForTyping(input) {
    if (input === "" || input === null || input === undefined) return "";
    let s = String(input).replace(/[^\d,]/g, "");
    const firstComma = s.indexOf(",");
    if (firstComma !== -1) {
        const before = s.slice(0, firstComma);
        const after = s.slice(firstComma + 1).replace(/,/g, "");
        return addThousandDots(before) + "," + after;
    }
    return addThousandDots(s);
}

function parsePasif(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "boolean") return v;
    const s = String(v).trim().toLowerCase();
    if (s === "") return null;
    if (["evet", "true", "1", "pasif"].includes(s)) return true;
    if (["hayır", "hayir", "false", "0", "aktif"].includes(s)) return false;
    return null;
}

function normalizePlate(v) {
    return String(v || "")
        .toLocaleUpperCase("tr-TR")
        .replace(/\s+/g, "")
        .trim();
}

function chunkArray(arr, size = 200) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

function isSameValue(a, b) {
    if (a === b) return true;
    if ((a === null || a === undefined || a === "") && (b === null || b === undefined || b === "")) return true;
    return false;
}

function toCellText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
        if (value.text) return String(value.text);
        if (value.richText) return value.richText.map((x) => x.text).join("");
        if (value.result !== undefined) return String(value.result);
        if (value.hyperlink) return String(value.text || value.hyperlink);
        if (value.formula && value.result !== undefined) return String(value.result);
    }
    return String(value);
}

function getExcelNumericValue(cell) {
    const v = cell?.value;

    if (v === null || v === undefined || v === "") return null;

    if (typeof v === "number") return v;

    if (typeof v === "object") {
        if (typeof v.result === "number") return v.result;
        if (typeof v.text === "string") return v.text;
    }

    return String(v);
}

const normalizeHeader = (v) =>
    String(v || "")
        .toLocaleLowerCase("tr-TR")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

const headerAliases = {
    plaka: ["plaka"],
    cari_id: ["cari id", "cari_id", "cariid", "cari ıd"],
    cari_adi: ["cari adı", "cari adi", "cari_adi"],
    arac_sahip: ["sahibi", "arac sahibi", "araç sahibi", "arac_sahip"],
    odak_arac_calisma_tipi: [
        "çalışma tipi",
        "calisma tipi",
        "odak çalışma tipi",
        "odak_arac_calisma_tipi",
    ],
    aylik_kira: ["aylık kira", "aylik kira", "aylik_kira"],
    aylik_surucu: [
        "aylık sürücü",
        "aylik surucu",
        "aylık surucu",
        "aylik sürücü",
        "aylik_surucu",
    ],
    anlasilan_yakma_orani: [
        "anlaşılan yakma oranı",
        "anlasilan yakma orani",
        "anlaşılan yakma oran",
        "anlasilan yakma oran",
        "yakma oranı",
        "yakma orani",
        "anlasilan_yakma_orani",
    ],
    calisma_gunu: [
        "gün",
        "gun",
        "çalışma günü",
        "calisma gunu",
        "çalışma gunu",
        "calisma_gunu",
    ],
    pasif: ["pasif", "durum"],
    aciklama: ["açıklama", "aciklama"],
};
const getHeaderColumnMap = (worksheet) => {
    const map = {};
    const headerRow = worksheet.getRow(1);

    headerRow.eachCell((cell, colNumber) => {
        const normalized = normalizeHeader(cell.value);

        Object.entries(headerAliases).forEach(([field, aliases]) => {
            if (aliases.includes(normalized) && !map[field]) {
                map[field] = colNumber;
            }
        });
    });

    return map;
};

/* ===================== Küçük UI Parçaları ===================== */
function GlassCard({ children, sx = {} }) {
    return (
        <Paper
            elevation={0}
            sx={{
                borderRadius: 4,
                border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                background: (theme) =>
                    theme.palette.mode === "dark"
                        ? `linear-gradient(180deg, ${alpha("#172033", 0.76)} 0%, ${alpha("#0f172a", 0.92)} 100%)`
                        : `linear-gradient(180deg, ${alpha("#ffffff", 0.98)} 0%, ${alpha("#f8fbff", 0.98)} 100%)`,
                boxShadow: (theme) =>
                    theme.palette.mode === "dark"
                        ? "0 18px 42px rgba(0,0,0,.28)"
                        : "0 16px 36px rgba(15,23,42,.08)",
                backdropFilter: "blur(10px)",
                ...sx,
            }}
        >
            {children}
        </Paper>
    );
}

function StatCard({ title, value, subtitle, tone = "primary", icon }) {
    const tones = {
        primary: { bg: "primary.main", soft: (t) => alpha(t.palette.primary.main, 0.12) },
        success: { bg: "success.main", soft: (t) => alpha(t.palette.success.main, 0.12) },
        warning: { bg: "warning.main", soft: (t) => alpha(t.palette.warning.main, 0.12) },
        info: { bg: "info.main", soft: (t) => alpha(t.palette.info.main, 0.12) },
    };
    const selected = tones[tone] || tones.primary;

    return (
        <GlassCard sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 3,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: selected.soft,
                        color: selected.bg,
                    }}
                >
                    {icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                        {title}
                    </Typography>
                    <Typography variant="h6" fontWeight={900}>
                        {value}
                    </Typography>
                    {subtitle ? (
                        <Typography variant="caption" color="text.secondary">
                            {subtitle}
                        </Typography>
                    ) : null}
                </Box>
            </Stack>
        </GlassCard>
    );
}

function SectionCard({ title, subtitle, right, children }) {
    return (
        <GlassCard sx={{ overflow: "hidden" }}>
            <Box sx={{ px: 2.2, py: 1.8 }}>
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.2}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                >
                    <Box>
                        <Typography variant="h6" fontWeight={900}>
                            {title}
                        </Typography>
                        {subtitle ? (
                            <Typography variant="body2" color="text.secondary">
                                {subtitle}
                            </Typography>
                        ) : null}
                    </Box>
                    {right}
                </Stack>
            </Box>
            <Divider />
            {children}
        </GlassCard>
    );
}

function ActionGroup({ title, children }) {
    return (
        <GlassCard sx={{ p: 1.5, height: "100%" }}>
            <Stack spacing={1.1}>
                <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.4, opacity: 0.75 }}>
                    {title}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {children}
                </Stack>
            </Stack>
        </GlassCard>
    );
}

function LogDialog({ open, onClose, title, progress }) {
    const isRunning = progress.status === "reading" || progress.status === "processing";
    return (
        <Dialog open={open} onClose={isRunning ? undefined : onClose} fullWidth maxWidth="md">
            <DialogTitle>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box>
                        <Typography variant="h6" fontWeight={900}>
                            {title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Dosya: {progress.fileName || "—"}
                        </Typography>
                    </Box>
                    <Chip
                        label={
                            progress.status === "done"
                                ? "Tamamlandı"
                                : progress.status === "error"
                                    ? "Hata"
                                    : progress.status === "processing"
                                        ? "İşleniyor"
                                        : "Hazırlanıyor"
                        }
                        color={
                            progress.status === "done"
                                ? "success"
                                : progress.status === "error"
                                    ? "error"
                                    : "info"
                        }
                        sx={{ borderRadius: 999, fontWeight: 800 }}
                    />
                </Stack>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2}>
                    <Grid container spacing={1.2}>
                        <Grid item xs={6} md={3}>
                            <GlassCard sx={{ p: 1.5 }}>
                                <Typography variant="caption" color="text.secondary">Toplam</Typography>
                                <Typography variant="h6" fontWeight={900}>{progress.totalRows || 0}</Typography>
                            </GlassCard>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <GlassCard sx={{ p: 1.5 }}>
                                <Typography variant="caption" color="text.secondary">İşlenen</Typography>
                                <Typography variant="h6" fontWeight={900}>{progress.processed || 0}</Typography>
                            </GlassCard>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <GlassCard sx={{ p: 1.5 }}>
                                <Typography variant="caption" color="text.secondary">Başarılı</Typography>
                                <Typography variant="h6" fontWeight={900} color="success.main">{progress.success || 0}</Typography>
                            </GlassCard>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <GlassCard sx={{ p: 1.5 }}>
                                <Typography variant="caption" color="text.secondary">Atlanan/Hatalı</Typography>
                                <Typography variant="h6" fontWeight={900} color="warning.main">
                                    {(progress.fail || 0) + (progress.skipped || 0)}
                                </Typography>
                            </GlassCard>
                        </Grid>
                    </Grid>

                    <Box>
                        <Stack direction="row" justifyContent="space-between" mb={0.8}>
                            <Typography variant="body2" fontWeight={700}>
                                İlerleme
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                %{progress.percent || 0}
                            </Typography>
                        </Stack>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, Math.max(0, progress.percent || 0))}
                            sx={{ height: 10, borderRadius: 999 }}
                        />
                    </Box>

                    {progress.currentPlate ? (
                        <Alert severity="info" sx={{ borderRadius: 3 }}>
                            İşlenen son plaka: <strong>{progress.currentPlate}</strong>
                        </Alert>
                    ) : null}

                    <GlassCard sx={{ p: 1, maxHeight: 320, overflow: "auto" }}>
                        <List dense>
                            {(progress.logs || []).map((log, idx) => (
                                <ListItem key={`${log}-${idx}`} sx={{ py: 0.4 }}>
                                    <ListItemText
                                        primary={log}
                                        primaryTypographyProps={{ variant: "body2" }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </GlassCard>
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={isRunning}>
                    Kapat
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/* ===================== Component ===================== */
export default function AracCariVeFiyat() {
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);

    const [query, setQuery] = useState("");
    const [onlyActive, setOnlyActive] = useState(false);

    const [filters, setFilters] = useState(emptyFilters);
    const [tempFilters, setTempFilters] = useState(emptyFilters);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [editOpen, setEditOpen] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [editOriginalKey, setEditOriginalKey] = useState(null);
    const [editForm, setEditForm] = useState({ ...emptyForm });

    const [showAdd, setShowAdd] = useState(false);
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState(null);
    const [addForm, setAddForm] = useState({ ...emptyForm });

    const [isMatchingDays, setIsMatchingDays] = useState(false);
    const fileInputRef = useRef(null);

    const bulkExcelInputRef = useRef(null);
    const bulkImportInputRef = useRef(null);

    const [bulkExcelWorking, setBulkExcelWorking] = useState(false);
    const [bulkImportWorking, setBulkImportWorking] = useState(false);

    const [bulkProgressOpen, setBulkProgressOpen] = useState(false);
    const [bulkProgressTitle, setBulkProgressTitle] = useState("Toplu İşlem");
    const [bulkProgress, setBulkProgress] = useState({
        fileName: "",
        totalRows: 0,
        processed: 0,
        success: 0,
        fail: 0,
        skipped: 0,
        percent: 0,
        status: "idle",
        currentPlate: "",
        logs: [],
    });

    const [permLoading, setPermLoading] = useState(true);
    const [perms, setPerms] = useState({
        canCreate: false,
        canEditAny: false,
        fields: {
            cari_id: false,
            cari_adi: false,
            arac_sahibi: false,
            odak_arac_calisma_tipi: false,
            aylik_kira: false,
            aylik_surucu: false,
            calisma_gunu: false,
            pasif: false,
        },
    });

    const [snack, setSnack] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    const showSnack = (message, severity = "success") => {
        setSnack({ open: true, message, severity });
    };

    async function loadPermissions() {
        try {
            setPermLoading(true);
            const userId = parseInt(localStorage.getItem("kullaniciId") || "", 10);

            const looksLikeUUID = (s) =>
                typeof s === "string" &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

            const { data: userRow, error: eU } = await supabase
                .from("login")
                .select("id, rol, kullanici")
                .eq("id", userId)
                .maybeSingle();
            if (eU) throw eU;

            let roleId = null;
            if (userRow?.rol) {
                if (looksLikeUUID(userRow.rol)) {
                    roleId = userRow.rol;
                } else {
                    const roleKey = String(userRow.rol || "").toUpperCase();
                    const { data: roleRow, error: eR } = await supabase
                        .from("roles")
                        .select("id,key")
                        .eq("key", roleKey)
                        .maybeSingle();
                    if (eR) throw eR;
                    roleId = roleRow?.id || null;
                }
            }

            let rolePerm = {};
            if (roleId) {
                const { data: rp, error: eRP } = await supabase
                    .from("role_permissions")
                    .select(`
                        acf_create, acf_edit, acf_delete,
                        acf_edit_cari_id, acf_edit_cari_adi, acf_edit_arac_sahibi,
                        acf_edit_odak_tipi, acf_edit_aylik_kira, acf_edit_aylik_surucu,
                        acf_edit_calisma_gunu, acf_edit_pasif
                    `)
                    .eq("screen_key", SCREEN_KEY)
                    .eq("role_id", roleId)
                    .maybeSingle();
                if (eRP) throw eRP;
                rolePerm = rp || {};
            }

            const { data: up, error: eUP } = await supabase
                .from("user_permissions")
                .select(`
                    acf_create, acf_edit, acf_delete,
                    acf_edit_cari_id, acf_edit_cari_adi, acf_edit_arac_sahibi,
                    acf_edit_odak_tipi, acf_edit_aylik_kira, acf_edit_aylik_surucu,
                    acf_edit_calisma_gunu, acf_edit_pasif
                `)
                .eq("user_id", userRow?.id)
                .maybeSingle();
            if (eUP) throw eUP;

            const coalesce = (ovr, role) => (ovr === true || ovr === false ? ovr : !!role);

            const canCreate = coalesce(up?.acf_create, rolePerm?.acf_create);
            const fields = {
                cari_id: coalesce(up?.acf_edit_cari_id, rolePerm?.acf_edit_cari_id),
                cari_adi: coalesce(up?.acf_edit_cari_adi, rolePerm?.acf_edit_cari_adi),
                arac_sahibi: coalesce(up?.acf_edit_arac_sahibi, rolePerm?.acf_edit_arac_sahibi),
                odak_arac_calisma_tipi: coalesce(up?.acf_edit_odak_tipi, rolePerm?.acf_edit_odak_tipi),
                aylik_kira: coalesce(up?.acf_edit_aylik_kira, rolePerm?.acf_edit_aylik_kira),
                aylik_surucu: coalesce(up?.acf_edit_aylik_surucu, rolePerm?.acf_edit_aylik_surucu),
                calisma_gunu: coalesce(up?.acf_edit_calisma_gunu, rolePerm?.acf_edit_calisma_gunu),
                pasif: coalesce(up?.acf_edit_pasif, rolePerm?.acf_edit_pasif),
            };

            const generalEdit = coalesce(up?.acf_edit, rolePerm?.acf_edit);
            const canEditAny = !!generalEdit || Object.values(fields).some(Boolean);

            setPerms({ canCreate, canEditAny, fields });
        } catch (e) {
            console.error("Permission load error:", e);
            setPerms({
                canCreate: false,
                canEditAny: false,
                fields: {
                    cari_id: false,
                    cari_adi: false,
                    arac_sahibi: false,
                    odak_arac_calisma_tipi: false,
                    aylik_kira: false,
                    aylik_surucu: false,
                    calisma_gunu: false,
                    pasif: false,
                },
            });
        } finally {
            setPermLoading(false);
        }
    }

    const refetch = async () => {
        setLoading(true);
        setErr(null);
        const { data, error } = await supabase.from("arac_cari_ve_fiyat").select("*");
        if (error) setErr(error.message || "Veri çekilemedi");
        else setRows(data || []);
        setLoading(false);
    };

    useEffect(() => {
        refetch();
        loadPermissions();
    }, []);

    const activeFilterCount = useMemo(() => {
        const { pasif, ...rest } = filters;
        let c = Object.values(rest).filter((v) => v !== "" && v !== null).length;
        if (pasif !== "hepsi") c += 1;
        if (onlyActive && pasif === "hepsi") c += 1;
        return c;
    }, [filters, onlyActive]);

    const filteredRowsRaw = useMemo(() => {
        const q = query.trim().toLowerCase();

        return rows.filter((r) => {
            const kira = toNumberLoose(r.aylik_kira);
            const surucu = toNumberLoose(r.aylik_surucu);
            const toplam = kira + surucu;
            const gun = toNumberLoose(r.calisma_gunu);
            const tarih = r.duzenleme_yapilan_tarih ? new Date(r.duzenleme_yapilan_tarih) : null;

            if (q) {
                const haystack = [
                    r.plaka,
                    r.cari_id,
                    r.cari_adi,
                    r.arac_sahip,
                    r.odak_arac_calisma_tipi,
                    r.aciklama,
                    r.duzenleme_yapan_kullanici,
                ]
                    .map((x) => String(x || "").toLowerCase())
                    .join(" ");

                if (!haystack.includes(q)) return false;
            }

            if (onlyActive && !!r.pasif) return false;

            if (filters.plaka && !String(r.plaka || "").toLowerCase().includes(filters.plaka.toLowerCase())) return false;
            if (filters.cari_id && !String(r.cari_id || "").toLowerCase().includes(filters.cari_id.toLowerCase())) return false;
            if (filters.cari_adi && !String(r.cari_adi || "").toLowerCase().includes(filters.cari_adi.toLowerCase())) return false;
            if (filters.arac_sahip && !String(r.arac_sahip || "").toLowerCase().includes(filters.arac_sahip.toLowerCase())) return false;
            if (
                filters.odak_arac_calisma_tipi &&
                !String(r.odak_arac_calisma_tipi || "").toLowerCase().includes(filters.odak_arac_calisma_tipi.toLowerCase())
            ) {
                return false;
            }
            if (filters.aciklama && !String(r.aciklama || "").toLowerCase().includes(filters.aciklama.toLowerCase())) return false;
            if (
                filters.duzenleyen &&
                !String(r.duzenleme_yapan_kullanici || "").toLowerCase().includes(filters.duzenleyen.toLowerCase())
            ) {
                return false;
            }

            if (!onlyActive) {
                if (filters.pasif === "aktif" && !!r.pasif) return false;
                if (filters.pasif === "pasif" && !r.pasif) return false;
            }

            if (filters.aylik_kira_min !== "" && kira < toNumberLoose(filters.aylik_kira_min)) return false;
            if (filters.aylik_kira_max !== "" && kira > toNumberLoose(filters.aylik_kira_max)) return false;
            if (filters.aylik_surucu_min !== "" && surucu < toNumberLoose(filters.aylik_surucu_min)) return false;
            if (filters.aylik_surucu_max !== "" && surucu > toNumberLoose(filters.aylik_surucu_max)) return false;
            if (filters.toplam_min !== "" && toplam < toNumberLoose(filters.toplam_min)) return false;
            if (filters.toplam_max !== "" && toplam > toNumberLoose(filters.toplam_max)) return false;
            if (filters.calisma_gunu_min !== "" && gun < toNumberLoose(filters.calisma_gunu_min)) return false;
            if (filters.calisma_gunu_max !== "" && gun > toNumberLoose(filters.calisma_gunu_max)) return false;

            if (filters.tarih_from) {
                const from = new Date(filters.tarih_from);
                if (tarih && tarih < from) return false;
            }
            if (filters.tarih_to) {
                const to = new Date(filters.tarih_to);
                to.setHours(23, 59, 59, 999);
                if (tarih && tarih > to) return false;
            }

            return true;
        });
    }, [rows, query, onlyActive, filters]);

    const totals = useMemo(() => {
        const kira = filteredRowsRaw.reduce((acc, r) => acc + toNumberLoose(r.aylik_kira), 0);
        const surucu = filteredRowsRaw.reduce((acc, r) => acc + toNumberLoose(r.aylik_surucu), 0);
        return {
            kira,
            surucu,
            toplam: kira + surucu,
        };
    }, [filteredRowsRaw]);

    const gridRows = useMemo(() => {
        return filteredRowsRaw.map((r, i) => ({
            id: `${normalizePlate(r.plaka)}-${r.cari_id}-${i}`,
            ...r,
            toplam_tutar: toNumberLoose(r.aylik_kira) + toNumberLoose(r.aylik_surucu),
        }));
    }, [filteredRowsRaw]);

    const existingPlateSet = useMemo(() => {
        return new Set(rows.map((r) => normalizePlate(r.plaka)));
    }, [rows]);

    const handleOpenEdit = (row) => {
        if (permLoading || !perms.canEditAny) return;

        setEditOriginalKey({ plaka: row.plaka, cari_id: row.cari_id });
        setEditForm({
            plaka: row.plaka || "",
            cari_id: row.cari_id ?? "",
            cari_adi: row.cari_adi || "",
            arac_sahip: row.arac_sahip || "",
            odak_arac_calisma_tipi: row.odak_arac_calisma_tipi || "",
            aylik_kira: formatTLCompact(row.aylik_kira),
            aylik_surucu: formatTLCompact(row.aylik_surucu),
            anlasilan_yakma_orani: row.anlasilan_yakma_orani ?? "",
            calisma_gunu: row.calisma_gunu ?? "",
            pasif: !!row.pasif,
            aciklama: row.aciklama || "",
        });
        setEditOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!perms.canEditAny || !editOriginalKey) return;

        try {
            setEditLoading(true);

            const payload = {};

            if (perms.fields.cari_id) {
                const parsedCariId = Number(String(editForm.cari_id).replace(/[^\d-]/g, ""));
                if (!Number.isFinite(parsedCariId)) {
                    showSnack("Cari ID geçersiz.", "error");
                    return;
                }
                payload.cari_id = parsedCariId;
            }

            if (perms.fields.cari_adi) payload.cari_adi = editForm.cari_adi?.trim() || null;
            if (perms.fields.arac_sahibi) payload.arac_sahip = editForm.arac_sahip?.trim() || null;
            if (perms.fields.odak_arac_calisma_tipi)
                payload.odak_arac_calisma_tipi = editForm.odak_arac_calisma_tipi?.trim() || null;
            if (perms.fields.aylik_kira) payload.aylik_kira = parseTLToNumber(editForm.aylik_kira);
            if (perms.fields.aylik_surucu) payload.aylik_surucu = parseTLToNumber(editForm.aylik_surucu);

            payload.anlasilan_yakma_orani =
                editForm.anlasilan_yakma_orani === "" || editForm.anlasilan_yakma_orani == null
                    ? null
                    : Number(
                        String(editForm.anlasilan_yakma_orani)
                            .replace("%", "")
                            .replace(/\./g, "")
                            .replace(",", ".")
                    );

            if (perms.fields.calisma_gunu)
                payload.calisma_gunu =
                    editForm.calisma_gunu === "" || editForm.calisma_gunu == null ? null : Number(editForm.calisma_gunu);
            if (perms.fields.pasif) payload.pasif = !!editForm.pasif;
            payload.aciklama = editForm.aciklama?.trim() || null;
            payload.duzenleme_yapan_kullanici = localStorage.getItem("kullanici") || "Admin";
            payload.duzenleme_yapilan_tarih = new Date().toISOString();

            const { error } = await supabase
                .from("arac_cari_ve_fiyat")
                .update(payload)
                .match({ plaka: editOriginalKey.plaka, cari_id: editOriginalKey.cari_id });

            if (error) throw error;

            setEditOpen(false);
            setEditOriginalKey(null);
            await refetch();
            showSnack("Kayıt başarıyla güncellendi.");
        } catch (e) {
            showSnack("Kaydetme hatası: " + (e?.message || e), "error");
        } finally {
            setEditLoading(false);
        }
    };

    const handleAddChange = (key, value) => setAddForm((p) => ({ ...p, [key]: value }));
    const handleEditChange = (key, value) => setEditForm((p) => ({ ...p, [key]: value }));

    const addNew = async () => {
        if (!perms.canCreate) {
            setAddError("Yeni kayıt ekleme yetkiniz yok.");
            return;
        }

        setAddError(null);

        const normalizedPlate = normalizePlate(addForm.plaka);
        if (!normalizedPlate) return setAddError("Plaka zorunludur.");
        if (!addForm.cari_id?.toString().trim()) return setAddError("Cari ID zorunludur.");

        if (existingPlateSet.has(normalizedPlate)) {
            setAddError("Bu plaka zaten kayıtlı.");
            showSnack("Bu plaka zaten kayıtlı.", "warning");
            return;
        }

        try {
            setAdding(true);

            const payload = {
                plaka: normalizedPlate,
                cari_id: Number(String(addForm.cari_id).replace(/[^\d-]/g, "")),
                cari_adi: addForm.cari_adi?.trim() || null,
                arac_sahip: addForm.arac_sahip?.trim() || null,
                odak_arac_calisma_tipi: addForm.odak_arac_calisma_tipi?.trim() || null,
                aylik_kira: parseTLToNumber(addForm.aylik_kira),
                aylik_surucu: parseTLToNumber(addForm.aylik_surucu),
                anlasilan_yakma_orani:
                    addForm.anlasilan_yakma_orani === "" || addForm.anlasilan_yakma_orani == null
                        ? null
                        : Number(
                            String(addForm.anlasilan_yakma_orani)
                                .replace("%", "")
                                .replace(/\./g, "")
                                .replace(",", ".")
                        ),
                calisma_gunu: parseTLToNumber(addForm.calisma_gunu),
                pasif: !!addForm.pasif,
                aciklama: addForm.aciklama?.trim() || null,
                duzenleme_yapan_kullanici: localStorage.getItem("kullanici") || "Admin",
                duzenleme_yapilan_tarih: new Date().toISOString(),
            };
            const { error } = await supabase.from("arac_cari_ve_fiyat").insert([payload]);
            if (error) throw error;

            setAddForm({ ...emptyForm });
            setShowAdd(false);
            await refetch();
            showSnack("Yeni kayıt eklendi.");
        } catch (e) {
            setAddError(e?.message || "Kayıt eklenemedi.");
            showSnack(e?.message || "Kayıt eklenemedi.", "error");
        } finally {
            setAdding(false);
        }
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Araç Cari ve Fiyat");

        worksheet.columns = [
            { header: "Plaka", key: "plaka", width: 14 },
            { header: "Cari ID", key: "cari_id", width: 12 },
            { header: "Cari Adı", key: "cari_adi", width: 28 },
            { header: "Araç Sahibi", key: "arac_sahip", width: 22 },
            { header: "Odak Araç Çalışma Tipi", key: "odak_arac_calisma_tipi", width: 24 },
            { header: "Aylık Kira", key: "aylik_kira", width: 16 },
            { header: "Aylık Sürücü", key: "aylik_surucu", width: 16 },
            { header: "Anlaşılan Yakma Oranı", key: "anlasilan_yakma_orani", width: 20 },
            { header: "Toplam Tutar", key: "toplam_tutar", width: 16 },
            { header: "Çalışma Günü", key: "calisma_gunu", width: 14 },
            { header: "Pasif", key: "pasif", width: 10 },
            { header: "Açıklama", key: "aciklama", width: 30 },
            { header: "Düzenleyen", key: "duzenleyen", width: 18 },
            { header: "Düzenleme Tarihi", key: "duzenleme_yapilan_tarih", width: 24 },
        ];
        worksheet.getRow(1).font = { bold: true };

        gridRows.forEach((r) => {
            worksheet.addRow({
                plaka: r.plaka ?? "",
                cari_id: r.cari_id ?? "",
                cari_adi: r.cari_adi ?? "",
                arac_sahip: r.arac_sahip ?? "",
                odak_arac_calisma_tipi: r.odak_arac_calisma_tipi ?? "",
                aylik_kira: toNumberLoose(r.aylik_kira),
                aylik_surucu: toNumberLoose(r.aylik_surucu),
                anlasilan_yakma_orani:
                    r.anlasilan_yakma_orani === null || r.anlasilan_yakma_orani === undefined
                        ? ""
                        : Number(r.anlasilan_yakma_orani) / 100,
                toplam_tutar: toNumberLoose(r.toplam_tutar),
                calisma_gunu: r.calisma_gunu ?? "",
                pasif: r.pasif ? "Evet" : "Hayır",
                aciklama: r.aciklama ?? "",
                duzenleyen: r.duzenleme_yapan_kullanici ?? "",
                duzenleme_yapilan_tarih: formatDate(r.duzenleme_yapilan_tarih),
            });
        });

        worksheet.addRow({});
        const totalRow = worksheet.addRow({
            plaka: "TOPLAM",
            aylik_kira: totals.kira,
            aylik_surucu: totals.surucu,
            toplam_tutar: totals.toplam,
        });
        totalRow.font = { bold: true };

        [6, 7].forEach((idx) => {
            worksheet.getColumn(idx).numFmt = '#,##0.00 [$₺-tr-TR]';
        });

        worksheet.getColumn(8).numFmt = '0.00%';
        worksheet.getColumn(9).numFmt = '#,##0.00 [$₺-tr-TR]';
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(
            new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
            `arac_cari_ve_fiyat_${new Date().toISOString().slice(0, 10)}.xlsx`
        );
    };

    const downloadBulkTemplate = async () => {
        const workbook = new ExcelJS.Workbook();

        const ws1 = workbook.addWorksheet("TopluGuncelle_Sablon");
        ws1.addRow([
            "plaka",
            "cari id",
            "cari adı",
            "sahibi",
            "çalışma tipi",
            "aylık kira",
            "aylık sürücü",
            "anlaşılan yakma oranı",
            "gün",
            "pasif",
            "açıklama",
        ]);
        ws1.getRow(1).font = { bold: true };
        ws1.addRow([
            "34ABC123",
            12345,
            "Örnek Cari A.Ş.",
            "Ahmet Yılmaz",
            "ODAK",
            "10.000,00",
            "6.500,00",
            "12,50",
            26,
            "Hayır",
            "Toplu güncelleme örneği",
        ]);

        const ws2 = workbook.addWorksheet("TopluAktarim_Sablon");
        ws2.addRow([
            "plaka",
            "cari id",
            "cari adı",
            "sahibi",
            "çalışma tipi",
            "aylık kira",
            "aylık sürücü",
            "anlaşılan yakma oranı",
            "gün",
            "pasif",
            "açıklama",
        ]);
        ws2.getRow(1).font = { bold: true };
        ws2.addRow([
            "34XYZ789",
            67890,
            "Yeni Cari Ltd.",
            "Mehmet Kaya",
            "GÜNLÜK",
            "15.000,00",
            "8.000,00",
            "10,75",
            30,
            "Hayır",
            "Toplu aktarım örneği",
        ]);
        workbook.worksheets.forEach((ws) => {
            ws.columns.forEach((c) => {
                c.width = 22;
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(
            new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
            `arac_cari_fiyat_toplu_sablon_${new Date().toISOString().slice(0, 10)}.xlsx`
        );
    };

    const readExcelRows = async (file) => {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());

        const ws = workbook.worksheets[0];
        if (!ws) throw new Error("Excel sayfası bulunamadı.");

        const headerMap = getHeaderColumnMap(ws);
        if (!headerMap.plaka) {
            throw new Error("Excel'de 'plaka' sütunu bulunamadı.");
        }

        const records = [];
        const duplicatedInExcel = new Set();
        const seen = new Set();

        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const rawPlate = headerMap.plaka ? toCellText(row.getCell(headerMap.plaka).value) : "";
            const plaka = normalizePlate(rawPlate);

            if (!plaka) return;

            if (seen.has(plaka)) duplicatedInExcel.add(plaka);
            seen.add(plaka);

            const record = {
                plaka,
                cari_id: headerMap.cari_id ? toCellText(row.getCell(headerMap.cari_id).value) : undefined,
                cari_adi: headerMap.cari_adi ? toCellText(row.getCell(headerMap.cari_adi).value) : undefined,
                arac_sahip: headerMap.arac_sahip ? toCellText(row.getCell(headerMap.arac_sahip).value) : undefined,
                odak_arac_calisma_tipi: headerMap.odak_arac_calisma_tipi
                    ? toCellText(row.getCell(headerMap.odak_arac_calisma_tipi).value)
                    : undefined,
                aylik_kira: headerMap.aylik_kira ? getExcelNumericValue(row.getCell(headerMap.aylik_kira)) : undefined,
                aylik_surucu: headerMap.aylik_surucu ? getExcelNumericValue(row.getCell(headerMap.aylik_surucu)) : undefined,
                anlasilan_yakma_orani: headerMap.anlasilan_yakma_orani
                    ? getExcelNumericValue(row.getCell(headerMap.anlasilan_yakma_orani))
                    : undefined,
                calisma_gunu: headerMap.calisma_gunu ? row.getCell(headerMap.calisma_gunu).value : undefined,
                pasif: headerMap.pasif ? row.getCell(headerMap.pasif).value : undefined,
                aciklama: headerMap.aciklama ? toCellText(row.getCell(headerMap.aciklama).value) : undefined,
            };
            records.push(record);
        });

        return { records, duplicatedInExcel: Array.from(duplicatedInExcel) };
    };

    const fetchExistingRecordsByPlate = async (plates) => {
        const chunks = chunkArray(plates, 200);
        let all = [];

        for (const part of chunks) {
            const { data, error } = await supabase
                .from("arac_cari_ve_fiyat")
                .select("*")
                .in("plaka", part);

            if (error) throw error;
            all = all.concat(data || []);
        }

        return all;
    };

    const buildUpdatePayload = (excelRow, dbRow) => {
        const payload = {};
        const changedFields = [];

        if (perms.fields.cari_id && excelRow.cari_id !== undefined && excelRow.cari_id !== "") {
            const newVal = Number(String(excelRow.cari_id).replace(/[^\d-]/g, ""));
            if (Number.isFinite(newVal) && !isSameValue(newVal, dbRow.cari_id)) {
                payload.cari_id = newVal;
                changedFields.push("cari_id");
            }
        }

        if (perms.fields.cari_adi && excelRow.cari_adi !== undefined) {
            const newVal = String(excelRow.cari_adi || "").trim() || null;
            if (!isSameValue(newVal, dbRow.cari_adi)) {
                payload.cari_adi = newVal;
                changedFields.push("cari_adi");
            }
        }

        if (perms.fields.arac_sahibi && excelRow.arac_sahip !== undefined) {
            const newVal = String(excelRow.arac_sahip || "").trim() || null;
            if (!isSameValue(newVal, dbRow.arac_sahip)) {
                payload.arac_sahip = newVal;
                changedFields.push("arac_sahip");
            }
        }

        if (perms.fields.odak_arac_calisma_tipi && excelRow.odak_arac_calisma_tipi !== undefined) {
            const newVal = String(excelRow.odak_arac_calisma_tipi || "").trim() || null;
            if (!isSameValue(newVal, dbRow.odak_arac_calisma_tipi)) {
                payload.odak_arac_calisma_tipi = newVal;
                changedFields.push("odak_arac_calisma_tipi");
            }
        }

        if (perms.fields.aylik_kira && excelRow.aylik_kira !== undefined) {
            const newVal = parseTLToNumber(excelRow.aylik_kira);
            if (!isSameValue(newVal, dbRow.aylik_kira)) {
                payload.aylik_kira = newVal;
                changedFields.push("aylik_kira");
            }
        }

        if (perms.fields.aylik_surucu && excelRow.aylik_surucu !== undefined) {
            const newVal = parseTLToNumber(excelRow.aylik_surucu);
            if (!isSameValue(newVal, dbRow.aylik_surucu)) {
                payload.aylik_surucu = newVal;
                changedFields.push("aylik_surucu");
            }
        }

        if (excelRow.anlasilan_yakma_orani !== undefined) {
            const raw = excelRow.anlasilan_yakma_orani;
            const newVal =
                raw === "" || raw === null || raw === undefined
                    ? null
                    : Number(
                        String(raw)
                            .replace("%", "")
                            .replace(/\./g, "")
                            .replace(",", ".")
                    );

            const normalizedNewVal = Number.isFinite(newVal) ? newVal : null;

            if (!isSameValue(normalizedNewVal, dbRow.anlasilan_yakma_orani)) {
                payload.anlasilan_yakma_orani = normalizedNewVal;
                changedFields.push("anlasilan_yakma_orani");
            }
        }

        if (perms.fields.calisma_gunu && excelRow.calisma_gunu !== undefined) {
            const raw = excelRow.calisma_gunu;
            const newVal =
                raw === "" || raw === null || raw === undefined
                    ? null
                    : Number(raw);
            const normalizedNewVal = Number.isFinite(newVal) ? newVal : null;

            if (!isSameValue(normalizedNewVal, dbRow.calisma_gunu)) {
                payload.calisma_gunu = normalizedNewVal;
                changedFields.push("calisma_gunu");
            }
        }

        if (perms.fields.pasif && excelRow.pasif !== undefined) {
            const newVal = parsePasif(excelRow.pasif);
            if (newVal !== null && !isSameValue(newVal, !!dbRow.pasif)) {
                payload.pasif = newVal;
                changedFields.push("pasif");
            }
        }

        if (excelRow.aciklama !== undefined) {
            const newVal = String(excelRow.aciklama || "").trim() || null;
            if (!isSameValue(newVal, dbRow.aciklama)) {
                payload.aciklama = newVal;
                changedFields.push("aciklama");
            }
        }

        return { payload, changedFields };
    };
    const startProgress = (title, fileName) => {
        setBulkProgressTitle(title);
        setBulkProgressOpen(true);
        setBulkProgress({
            fileName: fileName || "",
            totalRows: 0,
            processed: 0,
            success: 0,
            fail: 0,
            skipped: 0,
            percent: 0,
            status: "reading",
            currentPlate: "",
            logs: ["Excel dosyası okunuyor..."],
        });
    };

    const processBulkExcelAndUpdate = async (file) => {
        if (permLoading) return;
        if (!perms.canEditAny) {
            showSnack("Toplu güncelleme için düzenleme yetkiniz yok.", "error");
            return;
        }

        setBulkExcelWorking(true);
        startProgress("Toplu Güncelleme Durumu", file?.name);

        try {
            const { records, duplicatedInExcel } = await readExcelRows(file);

            if (!records.length) {
                throw new Error("Excel'de güncellenecek satır bulunamadı.");
            }

            const uniqueByPlate = new Map();
            for (const row of records) {
                uniqueByPlate.set(row.plaka, row);
            }
            const uniqueRows = Array.from(uniqueByPlate.values());

            setBulkProgress((prev) => ({
                ...prev,
                totalRows: uniqueRows.length,
                status: "processing",
                logs: [
                    `${uniqueRows.length} benzersiz plaka bulundu.`,
                    ...(duplicatedInExcel.length ? [`Excel içinde tekrar eden plakalar: ${duplicatedInExcel.join(", ")}`] : []),
                    ...prev.logs,
                ].slice(0, 30),
            }));

            const plates = uniqueRows.map((x) => x.plaka);
            const existingRows = await fetchExistingRecordsByPlate(plates);
            const existingMap = new Map(existingRows.map((r) => [normalizePlate(r.plaka), r]));

            const user = localStorage.getItem("kullanici") || "Admin";
            let processed = 0;
            let success = 0;
            let fail = 0;
            let skipped = 0;

            for (const row of uniqueRows) {
                const dbRow = existingMap.get(row.plaka);

                if (!dbRow) {
                    processed += 1;
                    skipped += 1;
                    setBulkProgress((prev) => ({
                        ...prev,
                        processed,
                        skipped,
                        currentPlate: row.plaka,
                        percent: Math.round((processed / uniqueRows.length) * 100),
                        logs: [`⚠️ ${row.plaka} tabloda bulunamadı, atlandı.`, ...prev.logs].slice(0, 30),
                    }));
                    continue;
                }

                const { payload, changedFields } = buildUpdatePayload(row, dbRow);

                if (Object.keys(payload).length === 0) {
                    processed += 1;
                    skipped += 1;
                    setBulkProgress((prev) => ({
                        ...prev,
                        processed,
                        skipped,
                        currentPlate: row.plaka,
                        percent: Math.round((processed / uniqueRows.length) * 100),
                        logs: [`➖ ${row.plaka} için değişiklik yok, atlandı.`, ...prev.logs].slice(0, 30),
                    }));
                    continue;
                }

                payload.duzenleme_yapan_kullanici = user;
                payload.duzenleme_yapilan_tarih = new Date().toISOString();

                const { error } = await supabase
                    .from("arac_cari_ve_fiyat")
                    .update(payload)
                    .eq("plaka", row.plaka);

                processed += 1;

                if (error) {
                    fail += 1;
                    setBulkProgress((prev) => ({
                        ...prev,
                        processed,
                        fail,
                        currentPlate: row.plaka,
                        percent: Math.round((processed / uniqueRows.length) * 100),
                        logs: [`❌ ${row.plaka} güncellenemedi: ${error.message}`, ...prev.logs].slice(0, 30),
                    }));
                } else {
                    success += 1;
                    setBulkProgress((prev) => ({
                        ...prev,
                        processed,
                        success,
                        currentPlate: row.plaka,
                        percent: Math.round((processed / uniqueRows.length) * 100),
                        logs: [`✅ ${row.plaka} güncellendi (${changedFields.join(", ")})`, ...prev.logs].slice(0, 30),
                    }));
                }
            }

            await refetch();

            setBulkProgress((prev) => ({
                ...prev,
                status: "done",
                processed,
                success,
                fail,
                skipped,
                percent: 100,
                logs: [
                    `İşlem tamamlandı. Başarılı: ${success}, Atlanan: ${skipped}, Hatalı: ${fail}`,
                    ...prev.logs,
                ].slice(0, 30),
            }));

            showSnack(`Toplu güncelleme tamamlandı. Başarılı: ${success}, Atlanan: ${skipped}, Hatalı: ${fail}`);
        } catch (e) {
            console.error("Excel toplu güncelleme hatası:", e);

            setBulkProgress((prev) => ({
                ...prev,
                status: "error",
                logs: [`❌ Hata: ${e?.message || e}`, ...prev.logs].slice(0, 30),
            }));

            showSnack("Hata: " + (e?.message || e), "error");
        } finally {
            setBulkExcelWorking(false);
        }
    };

    const processBulkExcelAndInsert = async (file) => {
        if (permLoading) return;
        if (!perms.canCreate) {
            showSnack("Toplu aktarım için yeni kayıt ekleme yetkiniz yok.", "error");
            return;
        }

        setBulkImportWorking(true);
        startProgress("Toplu Aktarım Durumu", file?.name);

        try {
            const { records, duplicatedInExcel } = await readExcelRows(file);

            if (!records.length) {
                throw new Error("Excel'de aktarılacak satır bulunamadı.");
            }

            const uniqueByPlate = new Map();
            for (const row of records) {
                if (!uniqueByPlate.has(row.plaka)) {
                    uniqueByPlate.set(row.plaka, row);
                }
            }
            const uniqueRows = Array.from(uniqueByPlate.values());

            setBulkProgress((prev) => ({
                ...prev,
                totalRows: uniqueRows.length,
                status: "processing",
                logs: [
                    `${uniqueRows.length} benzersiz plaka bulundu.`,
                    ...(duplicatedInExcel.length ? [`Excel içinde tekrar eden plakalar: ${duplicatedInExcel.join(", ")}`] : []),
                    ...prev.logs,
                ].slice(0, 30),
            }));

            const plates = uniqueRows.map((x) => x.plaka);
            const existingRows = await fetchExistingRecordsByPlate(plates);
            const existingPlateMap = new Map(existingRows.map((r) => [normalizePlate(r.plaka), r]));

            let processed = 0;
            let success = 0;
            let fail = 0;
            let skipped = 0;

            const user = localStorage.getItem("kullanici") || "Admin";

            for (const row of uniqueRows) {
                if (existingPlateMap.has(row.plaka)) {
                    processed += 1;
                    skipped += 1;

                    setBulkProgress((prev) => ({
                        ...prev,
                        processed,
                        skipped,
                        currentPlate: row.plaka,
                        percent: Math.round((processed / uniqueRows.length) * 100),
                        logs: [`⚠️ ${row.plaka} zaten kayıtlı, eklenmedi.`, ...prev.logs].slice(0, 30),
                    }));
                    continue;
                }

                const parsedCariId = Number(String(row.cari_id || "").replace(/[^\d-]/g, ""));
                if (!Number.isFinite(parsedCariId)) {
                    processed += 1;
                    fail += 1;
                    setBulkProgress((prev) => ({
                        ...prev,
                        processed,
                        fail,
                        currentPlate: row.plaka,
                        percent: Math.round((processed / uniqueRows.length) * 100),
                        logs: [`❌ ${row.plaka} için cari_id geçersiz, eklenemedi.`, ...prev.logs].slice(0, 30),
                    }));
                    continue;
                }

                const payload = {
                    plaka: row.plaka,
                    cari_id: parsedCariId,
                    cari_adi: row.cari_adi !== undefined ? (String(row.cari_adi || "").trim() || null) : null,
                    arac_sahip: row.arac_sahip !== undefined ? (String(row.arac_sahip || "").trim() || null) : null,
                    odak_arac_calisma_tipi:
                        row.odak_arac_calisma_tipi !== undefined
                            ? (String(row.odak_arac_calisma_tipi || "").trim() || null)
                            : null,
                    aylik_kira: row.aylik_kira !== undefined ? parseTLToNumber(row.aylik_kira) : null,
                    aylik_surucu: row.aylik_surucu !== undefined ? parseTLToNumber(row.aylik_surucu) : null,
                    anlasilan_yakma_orani:
                        row.anlasilan_yakma_orani === "" || row.anlasilan_yakma_orani === null || row.anlasilan_yakma_orani === undefined
                            ? null
                            : Number(
                                String(row.anlasilan_yakma_orani)
                                    .replace("%", "")
                                    .replace(/\./g, "")
                                    .replace(",", ".")
                            ),
                    calisma_gunu:
                        row.calisma_gunu === "" || row.calisma_gunu === null || row.calisma_gunu === undefined
                            ? null
                            : Number(row.calisma_gunu),
                    pasif: parsePasif(row.pasif) ?? false,
                    aciklama: row.aciklama !== undefined ? (String(row.aciklama || "").trim() || null) : null,
                    duzenleme_yapan_kullanici: user,
                    duzenleme_yapilan_tarih: new Date().toISOString(),
                };
                const { error } = await supabase.from("arac_cari_ve_fiyat").insert([payload]);

                processed += 1;

                if (error) {
                    fail += 1;
                    setBulkProgress((prev) => ({
                        ...prev,
                        processed,
                        fail,
                        currentPlate: row.plaka,
                        percent: Math.round((processed / uniqueRows.length) * 100),
                        logs: [`❌ ${row.plaka} eklenemedi: ${error.message}`, ...prev.logs].slice(0, 30),
                    }));
                } else {
                    success += 1;
                    setBulkProgress((prev) => ({
                        ...prev,
                        processed,
                        success,
                        currentPlate: row.plaka,
                        percent: Math.round((processed / uniqueRows.length) * 100),
                        logs: [`✅ ${row.plaka} yeni kayıt olarak eklendi.`, ...prev.logs].slice(0, 30),
                    }));
                }
            }

            await refetch();

            setBulkProgress((prev) => ({
                ...prev,
                status: "done",
                processed,
                success,
                fail,
                skipped,
                percent: 100,
                logs: [
                    `Aktarım tamamlandı. Eklenen: ${success}, Atlanan: ${skipped}, Hatalı: ${fail}`,
                    ...prev.logs,
                ].slice(0, 30),
            }));

            showSnack(`Toplu aktarım tamamlandı. Eklenen: ${success}, Atlanan: ${skipped}, Hatalı: ${fail}`);
        } catch (e) {
            console.error("Excel toplu aktarım hatası:", e);

            setBulkProgress((prev) => ({
                ...prev,
                status: "error",
                logs: [`❌ Hata: ${e?.message || e}`, ...prev.logs].slice(0, 30),
            }));

            showSnack("Hata: " + (e?.message || e), "error");
        } finally {
            setBulkImportWorking(false);
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (file) processExcelAndUpdate(file);
        if (fileInputRef.current) fileInputRef.current.value = null;
    };

    const processExcelAndUpdate = async (file) => {
        if (permLoading || !perms.fields.calisma_gunu) {
            showSnack("'Çalışma Günü' alanını düzenleme yetkiniz yok.", "error");
            return;
        }

        setIsMatchingDays(true);
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());

            const worksheet = workbook.worksheets[0];
            if (!worksheet) throw new Error("Excel sayfası bulunamadı.");

            let plakaCol = -1;
            let gunCol = -1;

            worksheet.getRow(1).eachCell((cell, colNumber) => {
                const val = normalizeHeader(cell.value);
                if (val === "plaka") plakaCol = colNumber;
                if (val === "gün" || val === "gun" || val === "calisma gunu" || val === "çalışma günü") gunCol = colNumber;
            });

            if (plakaCol === -1 || gunCol === -1) {
                throw new Error("Excel dosyasında 'plaka' ve 'gün' başlıkları bulunamadı.");
            }

            const dataToUpdate = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const plaka = normalizePlate(toCellText(row.getCell(plakaCol).value));
                const gunValue = row.getCell(gunCol).value;
                const calisma_gunu =
                    gunValue === null || gunValue === undefined || isNaN(Number(gunValue))
                        ? null
                        : Number(gunValue);

                if (plaka && calisma_gunu !== null) {
                    dataToUpdate.push({ plaka, calisma_gunu });
                }
            });

            if (!dataToUpdate.length) {
                throw new Error("Excel'den güncellenecek geçerli veri bulunamadı.");
            }

            let successfulUpdates = 0;
            let errorCount = 0;
            let skipped = 0;
            const user = localStorage.getItem("kullanici") || "Admin";
            const timestamp = new Date().toISOString();

            for (const item of dataToUpdate) {
                const existing = rows.find((r) => normalizePlate(r.plaka) === item.plaka);
                if (!existing) {
                    skipped += 1;
                    continue;
                }

                const { error } = await supabase
                    .from("arac_cari_ve_fiyat")
                    .update({
                        calisma_gunu: item.calisma_gunu,
                        duzenleme_yapan_kullanici: user,
                        duzenleme_yapilan_tarih: timestamp,
                    })
                    .eq("plaka", item.plaka);

                if (error) {
                    console.error(`Hata [${item.plaka}]:`, error.message);
                    errorCount += 1;
                } else {
                    successfulUpdates += 1;
                }
            }

            await refetch();
            showSnack(
                `Gün güncelleme tamamlandı. Başarılı: ${successfulUpdates}, Atlanan: ${skipped}, Hatalı: ${errorCount}`
            );
        } catch (e) {
            showSnack("Hata: " + (e?.message || e), "error");
        } finally {
            setIsMatchingDays(false);
        }
    };

    const clearFilters = () => {
        setFilters(emptyFilters);
        setTempFilters(emptyFilters);
        setOnlyActive(false);
    };

    const applyFilters = () => {
        setFilters({ ...tempFilters });
        setDrawerOpen(false);
    };

    const activeFilterLabels = {
        plaka: "Plaka",
        cari_id: "Cari ID",
        cari_adi: "Cari Adı",
        arac_sahip: "Araç Sahibi",
        odak_arac_calisma_tipi: "Çalışma Tipi",
        aylik_kira_min: "Kira ≥",
        aylik_kira_max: "Kira ≤",
        aylik_surucu_min: "Sürücü ≥",
        aylik_surucu_max: "Sürücü ≤",
        toplam_min: "Toplam ≥",
        toplam_max: "Toplam ≤",
        calisma_gunu_min: "Gün ≥",
        calisma_gunu_max: "Gün ≤",
        pasif: "Durum",
        aciklama: "Açıklama",
        duzenleyen: "Düzenleyen",
        tarih_from: "Tarih Başlangıç",
        tarih_to: "Tarih Bitiş",
    };

    const columns = useMemo(() => {
        return [
            {
                field: "plaka",
                headerName: "Plaka",
                minWidth: 120,
                flex: 0.8,
                renderCell: (params) => (
                    <Typography fontWeight={800}>{params.value || "—"}</Typography>
                ),
            },
            {
                field: "cari_id",
                headerName: "Cari ID",
                minWidth: 110,
                flex: 0.7,
            },
            {
                field: "cari_adi",
                headerName: "Cari Adı",
                minWidth: 220,
                flex: 1.5,
            },
            {
                field: "arac_sahip",
                headerName: "Araç Sahibi",
                minWidth: 160,
                flex: 1,
            },
            {
                field: "odak_arac_calisma_tipi",
                headerName: "Çalışma Tipi",
                minWidth: 140,
                flex: 0.9,
                renderCell: (params) =>
                    params.value ? (
                        <Chip
                            size="small"
                            label={params.value}
                            variant="outlined"
                            sx={{ borderRadius: 999 }}
                        />
                    ) : (
                        "—"
                    ),
            },
            {
                field: "aylik_kira",
                headerName: "Aylık Kira",
                type: "number",
                minWidth: 150,
                flex: 0.9,
                valueGetter: (_, row) => toNumberLoose(row.aylik_kira),
                renderCell: (params) => (
                    <Typography fontWeight={700}>{formatTL(params.value)}</Typography>
                ),
            },
            {
                field: "aylik_surucu",
                headerName: "Aylık Sürücü",
                type: "number",
                minWidth: 155,
                flex: 0.9,
                valueGetter: (_, row) => toNumberLoose(row.aylik_surucu),
                renderCell: (params) => (
                    <Typography fontWeight={700}>{formatTL(params.value)}</Typography>
                ),
            },
            {
                field: "anlasilan_yakma_orani",
                headerName: "Anlaşılan Yakma Oranı",
                type: "number",
                minWidth: 180,
                flex: 0.9,
                valueGetter: (_, row) =>
                    row.anlasilan_yakma_orani === null || row.anlasilan_yakma_orani === undefined
                        ? null
                        : Number(row.anlasilan_yakma_orani),
                renderCell: (params) => (
                    <Typography fontWeight={700}>
                        {formatPercent(params.value)}
                    </Typography>
                ),
            },
            {
                field: "toplam_tutar",
                headerName: "Toplam Tutar",
                type: "number",
                minWidth: 160,
                flex: 1,
                valueGetter: (_, row) => toNumberLoose(row.aylik_kira) + toNumberLoose(row.aylik_surucu),
                renderCell: (params) => (
                    <Typography fontWeight={900} color="primary.main">
                        {formatTL(params.value)}
                    </Typography>
                ),
            },
            {
                field: "calisma_gunu",
                headerName: "Çalışma Günü",
                type: "number",
                minWidth: 120,
                flex: 0.7,
                align: "center",
                headerAlign: "center",
            },
            {
                field: "pasif",
                headerName: "Durum",
                minWidth: 110,
                flex: 0.7,
                align: "center",
                headerAlign: "center",
                renderCell: (params) =>
                    params.value ? (
                        <Chip size="small" label="Pasif" color="warning" sx={{ borderRadius: 999 }} />
                    ) : (
                        <Chip size="small" label="Aktif" color="success" sx={{ borderRadius: 999 }} />
                    ),
            },
            {
                field: "aciklama",
                headerName: "Açıklama",
                minWidth: 220,
                flex: 1.5,
            },
            {
                field: "duzenleme_yapan_kullanici",
                headerName: "Düzenleyen",
                minWidth: 160,
                flex: 0.9,
            },
            {
                field: "duzenleme_yapilan_tarih",
                headerName: "Düzenleme Tarihi",
                minWidth: 180,
                flex: 1,
                renderCell: (params) => formatDate(params.value),
            },
            {
                field: "actions",
                headerName: "İşlem",
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                minWidth: 90,
                flex: 0.6,
                align: "center",
                headerAlign: "center",
                renderCell: (params) => (
                    <Tooltip title={perms.canEditAny ? "Düzenle" : "Düzenleme yetkiniz yok"}>
                        <span>
                            <IconButton
                                size="small"
                                color="primary"
                                disabled={!perms.canEditAny || permLoading}
                                onClick={() => handleOpenEdit(params.row)}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                ),
            },
        ];
    }, [perms.canEditAny, permLoading]);
    return (
        <Container maxWidth={false} sx={{ py: 2.5 }}>
            <Stack spacing={2}>
                <GlassCard sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2.25}>
                        <Stack
                            direction={{ xs: "column", xl: "row" }}
                            spacing={2}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", xl: "center" }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={1}>
                                    <Chip
                                        icon={<LocalShippingOutlinedIcon />}
                                        label="Hakedişler"
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        sx={{ borderRadius: 999 }}
                                    />
                                    <Chip
                                        icon={<Inventory2OutlinedIcon />}
                                        label="Araç Cari & Fiyat"
                                        size="small"
                                        color="secondary"
                                        variant="outlined"
                                        sx={{ borderRadius: 999 }}
                                    />
                                </Stack>

                                <Typography
                                    variant="h4"
                                    sx={{
                                        fontWeight: 950,
                                        letterSpacing: -0.5,
                                        lineHeight: 1.05,
                                        fontSize: { xs: "1.8rem", md: "2.5rem" },
                                        background: "linear-gradient(90deg, #2563eb, #7c3aed)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                    }}
                                >
                                    ARAÇ CARİ & FİYAT YÖNETİM EKRANI
                                </Typography>

                                <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 980 }}>
                                    Kayıtları modern grid üzerinde görüntüleyin, hızlı arama yapın, gelişmiş filtreleri
                                    kullanın, Excel ile toplu güncelleme yapın, plaka bazlı toplu aktarım uygulayın ve
                                    çakışan plakaları kullanıcıya net şekilde gösterin.
                                </Typography>
                            </Box>

                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip
                                    label={loading ? "Yükleniyor" : `Toplam Kayıt: ${rows.length}`}
                                    color="primary"
                                    variant="outlined"
                                    sx={{ borderRadius: 999, fontWeight: 800 }}
                                />
                                <Chip
                                    label={`Listelenen: ${gridRows.length}`}
                                    color="secondary"
                                    variant="outlined"
                                    sx={{ borderRadius: 999, fontWeight: 800 }}
                                />
                                {!permLoading && !perms.canCreate && (
                                    <Chip
                                        label="Yeni Kayıt Kapalı"
                                        color="warning"
                                        variant="outlined"
                                        sx={{ borderRadius: 999, fontWeight: 800 }}
                                    />
                                )}
                                {!permLoading && !perms.canEditAny && (
                                    <Chip
                                        label="Düzenleme Kapalı"
                                        color="warning"
                                        variant="outlined"
                                        sx={{ borderRadius: 999, fontWeight: 800 }}
                                    />
                                )}
                            </Stack>
                        </Stack>

                        <Divider />

                        <Stack
                            direction={{ xs: "column", xl: "row" }}
                            spacing={1.2}
                            alignItems={{ xs: "stretch", xl: "center" }}
                        >
                            <TextField
                                placeholder="Plaka, cari adı, araç sahibi, açıklama ile ara..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                fullWidth
                                sx={{
                                    maxWidth: { xs: "100%", xl: 420 },
                                    "& .MuiOutlinedInput-root": { borderRadius: 999 },
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ opacity: 0.7 }} />
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <GlassCard sx={{ px: 1.3, py: 0.8 }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="body2" fontWeight={700}>
                                        Sadece Aktif
                                    </Typography>
                                    <Switch checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
                                </Stack>
                            </GlassCard>

                            <Button
                                variant="contained"
                                startIcon={<TuneIcon />}
                                onClick={() => setDrawerOpen(true)}
                                sx={{
                                    ml: { xl: "auto" },
                                    borderRadius: 999,
                                    textTransform: "none",
                                    fontWeight: 800,
                                }}
                            >
                                Filtre Paneli {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
                            </Button>
                        </Stack>
                    </Stack>
                </GlassCard>

                {err ? (
                    <Alert severity="error" sx={{ borderRadius: 3 }}>
                        {err}
                    </Alert>
                ) : null}

                <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                        <StatCard
                            title="Aylık Kira Toplamı"
                            value={formatTL(totals.kira)}
                            subtitle="Filtrelenmiş veriye göre"
                            tone="primary"
                            icon={<Inventory2OutlinedIcon />}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <StatCard
                            title="Aylık Sürücü Toplamı"
                            value={formatTL(totals.surucu)}
                            subtitle="Filtrelenmiş veriye göre"
                            tone="info"
                            icon={<LocalShippingOutlinedIcon />}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <StatCard
                            title="Genel Toplam"
                            value={formatTL(totals.toplam)}
                            subtitle={`${gridRows.length} kayıt`}
                            tone="success"
                            icon={<CheckCircleIcon />}
                        />
                    </Grid>
                </Grid>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", lg: "1fr 1.35fr 1fr" },
                        gap: 2,
                    }}
                >
                    <ActionGroup title="LİSTE İŞLEMLERİ">
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={refetch}
                            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
                        >
                            Yenile
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<DownloadIcon />}
                            onClick={exportToExcel}
                            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                        >
                            Excel’e Aktar
                        </Button>
                    </ActionGroup>

                    <ActionGroup title="EXCEL & TOPLU İŞLEMLER">
                        <Button
                            variant="outlined"
                            color="info"
                            startIcon={<DownloadIcon />}
                            onClick={downloadBulkTemplate}
                            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
                        >
                            Toplu Şablon İndir
                        </Button>

                        <Tooltip title={!perms.canEditAny ? "Toplu güncelleme yetkiniz yok" : "Excel ile plaka bazlı toplu güncelle"}>
                            <span>
                                <Button
                                    variant="contained"
                                    color="info"
                                    startIcon={bulkExcelWorking ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
                                    onClick={() => bulkExcelInputRef.current?.click()}
                                    disabled={bulkExcelWorking || bulkImportWorking || loading || permLoading || !perms.canEditAny}
                                    sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                                >
                                    {bulkExcelWorking ? "İşleniyor..." : "Toplu Güncelle"}
                                </Button>
                            </span>
                        </Tooltip>

                        <Tooltip title={!perms.canCreate ? "Toplu aktarım yetkiniz yok" : "Excel ile yeni kayıt ekle"}>
                            <span>
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={bulkImportWorking ? <CircularProgress size={16} color="inherit" /> : <PlaylistAddIcon />}
                                    onClick={() => bulkImportInputRef.current?.click()}
                                    disabled={bulkImportWorking || bulkExcelWorking || loading || permLoading || !perms.canCreate}
                                    sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                                >
                                    {bulkImportWorking ? "İşleniyor..." : "Toplu Aktarım"}
                                </Button>
                            </span>
                        </Tooltip>

                        <Tooltip
                            title={
                                permLoading
                                    ? "Yetkiler yükleniyor..."
                                    : !perms.fields.calisma_gunu
                                        ? "Çalışma günü düzenleme yetkiniz yok"
                                        : "Excel’den çalışma günü güncelle"
                            }
                        >
                            <span>
                                <Button
                                    variant="contained"
                                    color="warning"
                                    startIcon={isMatchingDays ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isMatchingDays || bulkExcelWorking || bulkImportWorking || loading || permLoading || !perms.fields.calisma_gunu}
                                    sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                                >
                                    {isMatchingDays ? "İşleniyor..." : "Gün Güncelle"}
                                </Button>
                            </span>
                        </Tooltip>

                        <input
                            type="file"
                            ref={bulkExcelInputRef}
                            accept=".xlsx,.xls"
                            style={{ display: "none" }}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) processBulkExcelAndUpdate(file);
                                if (bulkExcelInputRef.current) bulkExcelInputRef.current.value = null;
                            }}
                        />

                        <input
                            type="file"
                            ref={bulkImportInputRef}
                            accept=".xlsx,.xls"
                            style={{ display: "none" }}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) processBulkExcelAndInsert(file);
                                if (bulkImportInputRef.current) bulkImportInputRef.current.value = null;
                            }}
                        />

                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".xlsx,.xls"
                            style={{ display: "none" }}
                            onChange={handleFileChange}
                        />
                    </ActionGroup>

                    <ActionGroup title="KAYIT İŞLEMLERİ">
                        <Tooltip title={perms.canCreate ? "" : "Yeni kayıt ekleme yetkiniz yok"}>
                            <span>
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={<AddIcon />}
                                    onClick={() => perms.canCreate && setShowAdd(true)}
                                    disabled={!perms.canCreate || permLoading}
                                    sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                                >
                                    Yeni Kayıt
                                </Button>
                            </span>
                        </Tooltip>

                        <Button
                            variant="text"
                            startIcon={<ArrowBackIcon />}
                            onClick={() => navigate(-1)}
                            sx={{ textTransform: "none" }}
                        >
                            Geri
                        </Button>

                        <Button
                            variant="text"
                            startIcon={<HomeIcon />}
                            onClick={() => navigate(HOME_PATH)}
                            sx={{ textTransform: "none" }}
                        >
                            Anasayfa
                        </Button>
                    </ActionGroup>
                </Box>

                <Alert
                    severity="info"
                    icon={<WarningAmberIcon />}
                    sx={{ borderRadius: 3 }}
                >
                    Toplu güncelleme plaka ile mevcut satırı bulur ve yalnızca değişen alanları günceller.
                    Toplu aktarım ise yine plaka kontrolü yapar; aynı plaka varsa kayıt eklemez ve kullanıcıya bilgi verir.
                </Alert>

                {activeFilterCount > 0 && (
                    <GlassCard sx={{ p: 1.5 }}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                            <Typography variant="body2" fontWeight={700} sx={{ opacity: 0.8 }}>
                                Aktif Filtreler:
                            </Typography>

                            {onlyActive && filters.pasif === "hepsi" && (
                                <Chip
                                    label="Sadece Aktif"
                                    onDelete={() => setOnlyActive(false)}
                                    color="secondary"
                                    size="small"
                                    sx={{ borderRadius: 999 }}
                                />
                            )}

                            {Object.entries(filters).map(([k, v]) => {
                                if (v === "" || v === null || (k === "pasif" && v === "hepsi")) return null;
                                return (
                                    <Chip
                                        key={k}
                                        label={`${activeFilterLabels[k] || k}: ${String(v)}`}
                                        size="small"
                                        sx={{ borderRadius: 999 }}
                                    />
                                );
                            })}

                            <Button
                                size="small"
                                variant="text"
                                color="error"
                                startIcon={<ClearAllIcon />}
                                onClick={clearFilters}
                                sx={{ ml: "auto", textTransform: "none", fontWeight: 800 }}
                            >
                                Filtreleri Temizle
                            </Button>
                        </Stack>
                    </GlassCard>
                )}

                <SectionCard
                    title="Modern Grid Görünümü"
                    subtitle="Satıra çift tıklayarak düzenleme penceresini açabilirsin."
                    right={
                        <Chip
                            label={loading ? "Yükleniyor..." : `${gridRows.length} sonuç`}
                            color={loading ? "warning" : "primary"}
                            variant="outlined"
                            sx={{ borderRadius: 999, fontWeight: 800 }}
                        />
                    }
                >
                    <Box sx={{ height: 680, width: "100%" }}>
                        <DataGrid
                            rows={gridRows}
                            columns={columns}
                            loading={loading}
                            disableRowSelectionOnClick
                            pagination
                            pageSizeOptions={[10, 25, 50, 100]}
                            initialState={{
                                pagination: { paginationModel: { pageSize: 25, page: 0 } },
                                sorting: {
                                    sortModel: [{ field: "plaka", sort: "asc" }],
                                },
                            }}
                            slots={{
                                toolbar: GridToolbar,
                            }}
                            slotProps={{
                                toolbar: {
                                    showQuickFilter: false,
                                    csvOptions: { disableToolbarButton: true },
                                    printOptions: { disableToolbarButton: true },
                                },
                            }}
                            onRowDoubleClick={(params) => handleOpenEdit(params.row)}
                            getRowHeight={() => 58}
                            sx={{
                                border: 0,
                                "& .MuiDataGrid-columnHeaders": {
                                    bgcolor: (theme) =>
                                        theme.palette.mode === "dark"
                                            ? alpha(theme.palette.primary.main, 0.08)
                                            : alpha(theme.palette.primary.main, 0.05),
                                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                                },
                                "& .MuiDataGrid-columnHeaderTitle": {
                                    fontWeight: 900,
                                },
                                "& .MuiDataGrid-cell": {
                                    borderColor: (theme) => alpha(theme.palette.divider, 0.7),
                                },
                                "& .MuiDataGrid-row": {
                                    transition: "background-color .18s ease, transform .18s ease",
                                },
                                "& .MuiDataGrid-row:hover": {
                                    bgcolor: (theme) =>
                                        theme.palette.mode === "dark"
                                            ? alpha(theme.palette.primary.main, 0.08)
                                            : alpha(theme.palette.primary.main, 0.04),
                                },
                                "& .MuiDataGrid-toolbarContainer": {
                                    px: 1.2,
                                    py: 1,
                                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                                    bgcolor: (theme) =>
                                        theme.palette.mode === "dark"
                                            ? alpha(theme.palette.common.white, 0.02)
                                            : alpha(theme.palette.common.black, 0.01),
                                },
                                "& .MuiButton-root": {
                                    textTransform: "none",
                                    borderRadius: 999,
                                },
                            }}
                        />
                    </Box>
                </SectionCard>
            </Stack>

            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                PaperProps={{
                    sx: { width: { xs: "100%", sm: 430 }, p: 2.2 },
                }}
            >
                <Stack spacing={2}>
                    <Box>
                        <Typography variant="h6" fontWeight={900}>
                            Gelişmiş Filtreler
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Detaylı arama ve aralık filtreleri
                        </Typography>
                    </Box>

                    <Divider />

                    <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Plaka"
                                fullWidth
                                size="small"
                                value={tempFilters.plaka}
                                onChange={(e) => setTempFilters((p) => ({ ...p, plaka: e.target.value }))}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Cari ID"
                                fullWidth
                                size="small"
                                value={tempFilters.cari_id}
                                onChange={(e) => setTempFilters((p) => ({ ...p, cari_id: e.target.value }))}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Cari Adı"
                                fullWidth
                                size="small"
                                value={tempFilters.cari_adi}
                                onChange={(e) => setTempFilters((p) => ({ ...p, cari_adi: e.target.value }))}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Araç Sahibi"
                                fullWidth
                                size="small"
                                value={tempFilters.arac_sahip}
                                onChange={(e) => setTempFilters((p) => ({ ...p, arac_sahip: e.target.value }))}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Çalışma Tipi"
                                fullWidth
                                size="small"
                                value={tempFilters.odak_arac_calisma_tipi}
                                onChange={(e) =>
                                    setTempFilters((p) => ({ ...p, odak_arac_calisma_tipi: e.target.value }))
                                }
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                label="Kira Min"
                                fullWidth
                                size="small"
                                value={tempFilters.aylik_kira_min}
                                onChange={(e) => setTempFilters((p) => ({ ...p, aylik_kira_min: e.target.value }))}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Kira Max"
                                fullWidth
                                size="small"
                                value={tempFilters.aylik_kira_max}
                                onChange={(e) => setTempFilters((p) => ({ ...p, aylik_kira_max: e.target.value }))}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                label="Sürücü Min"
                                fullWidth
                                size="small"
                                value={tempFilters.aylik_surucu_min}
                                onChange={(e) => setTempFilters((p) => ({ ...p, aylik_surucu_min: e.target.value }))}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Sürücü Max"
                                fullWidth
                                size="small"
                                value={tempFilters.aylik_surucu_max}
                                onChange={(e) => setTempFilters((p) => ({ ...p, aylik_surucu_max: e.target.value }))}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                label="Toplam Min"
                                fullWidth
                                size="small"
                                value={tempFilters.toplam_min}
                                onChange={(e) => setTempFilters((p) => ({ ...p, toplam_min: e.target.value }))}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Toplam Max"
                                fullWidth
                                size="small"
                                value={tempFilters.toplam_max}
                                onChange={(e) => setTempFilters((p) => ({ ...p, toplam_max: e.target.value }))}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                label="Gün Min"
                                fullWidth
                                size="small"
                                value={tempFilters.calisma_gunu_min}
                                onChange={(e) => setTempFilters((p) => ({ ...p, calisma_gunu_min: e.target.value }))}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Gün Max"
                                fullWidth
                                size="small"
                                value={tempFilters.calisma_gunu_max}
                                onChange={(e) => setTempFilters((p) => ({ ...p, calisma_gunu_max: e.target.value }))}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                select
                                label="Durum"
                                fullWidth
                                size="small"
                                value={tempFilters.pasif}
                                onChange={(e) => setTempFilters((p) => ({ ...p, pasif: e.target.value }))}
                            >
                                <MenuItem value="hepsi">Hepsi</MenuItem>
                                <MenuItem value="aktif">Aktif</MenuItem>
                                <MenuItem value="pasif">Pasif</MenuItem>
                            </TextField>
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Açıklama"
                                fullWidth
                                size="small"
                                value={tempFilters.aciklama}
                                onChange={(e) => setTempFilters((p) => ({ ...p, aciklama: e.target.value }))}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Düzenleyen"
                                fullWidth
                                size="small"
                                value={tempFilters.duzenleyen}
                                onChange={(e) => setTempFilters((p) => ({ ...p, duzenleyen: e.target.value }))}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                label="Tarih Başlangıç"
                                type="date"
                                size="small"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={tempFilters.tarih_from}
                                onChange={(e) => setTempFilters((p) => ({ ...p, tarih_from: e.target.value }))}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                label="Tarih Bitiş"
                                type="date"
                                size="small"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={tempFilters.tarih_to}
                                onChange={(e) => setTempFilters((p) => ({ ...p, tarih_to: e.target.value }))}
                            />
                        </Grid>
                    </Grid>

                    <Divider />

                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Button
                            color="inherit"
                            startIcon={<ClearAllIcon />}
                            onClick={() => setTempFilters(emptyFilters)}
                        >
                            Sıfırla
                        </Button>

                        <Stack direction="row" spacing={1}>
                            <Button variant="outlined" onClick={() => setDrawerOpen(false)}>
                                Kapat
                            </Button>
                            <Button variant="contained" startIcon={<FilterAltIcon />} onClick={applyFilters}>
                                Uygula
                            </Button>
                        </Stack>
                    </Stack>
                </Stack>
            </Drawer>

            <Dialog open={showAdd} onClose={() => !adding && setShowAdd(false)} fullWidth maxWidth="md">
                <DialogTitle>
                    <Typography variant="h6" fontWeight={900}>
                        Yeni Kayıt Ekle
                    </Typography>
                </DialogTitle>

                <DialogContent dividers>
                    <Stack spacing={2} mt={0.5}>
                        {addError && (
                            <Alert severity="error" sx={{ borderRadius: 3 }}>
                                {addError}
                            </Alert>
                        )}

                        {normalizePlate(addForm.plaka) && existingPlateSet.has(normalizePlate(addForm.plaka)) && (
                            <Alert severity="warning" sx={{ borderRadius: 3 }}>
                                Bu plaka zaten kayıtlı.
                            </Alert>
                        )}

                        <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Plaka *"
                                    fullWidth
                                    size="small"
                                    value={addForm.plaka}
                                    onChange={(e) => handleAddChange("plaka", normalizePlate(e.target.value))}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Cari ID *"
                                    fullWidth
                                    size="small"
                                    value={addForm.cari_id}
                                    onChange={(e) => handleAddChange("cari_id", e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    label="Cari Adı"
                                    fullWidth
                                    size="small"
                                    value={addForm.cari_adi}
                                    onChange={(e) => handleAddChange("cari_adi", e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Araç Sahibi"
                                    fullWidth
                                    size="small"
                                    value={addForm.arac_sahip}
                                    onChange={(e) => handleAddChange("arac_sahip", e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Çalışma Tipi"
                                    fullWidth
                                    size="small"
                                    value={addForm.odak_arac_calisma_tipi}
                                    onChange={(e) => handleAddChange("odak_arac_calisma_tipi", e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="Aylık Kira"
                                    fullWidth
                                    size="small"
                                    value={addForm.aylik_kira}
                                    onChange={(e) => handleAddChange("aylik_kira", formatTLForTyping(e.target.value))}
                                />
                            </Grid>

                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="Aylık Sürücü"
                                    fullWidth
                                    size="small"
                                    value={addForm.aylik_surucu}
                                    onChange={(e) => handleAddChange("aylik_surucu", formatTLForTyping(e.target.value))}
                                />
                            </Grid>

                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="Çalışma Günü"
                                    fullWidth
                                    size="small"
                                    value={addForm.calisma_gunu}
                                    onChange={(e) => handleAddChange("calisma_gunu", e.target.value.replace(/[^\d]/g, ""))}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    select
                                    label="Durum"
                                    fullWidth
                                    size="small"
                                    value={addForm.pasif ? "pasif" : "aktif"}
                                    onChange={(e) => handleAddChange("pasif", e.target.value === "pasif")}
                                >
                                    <MenuItem value="aktif">Aktif</MenuItem>
                                    <MenuItem value="pasif">Pasif</MenuItem>
                                </TextField>
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    label="Açıklama"
                                    fullWidth
                                    size="small"
                                    multiline
                                    minRows={3}
                                    value={addForm.aciklama}
                                    onChange={(e) => handleAddChange("aciklama", e.target.value)}
                                />
                            </Grid>
                        </Grid>
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setShowAdd(false)} disabled={adding}>
                        Vazgeç
                    </Button>
                    <Button
                        variant="contained"
                        onClick={addNew}
                        disabled={adding || existingPlateSet.has(normalizePlate(addForm.plaka))}
                        startIcon={adding ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                    >
                        {adding ? "Kaydediliyor..." : "Kaydet"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={editOpen} onClose={() => !editLoading && setEditOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>
                    <Typography variant="h6" fontWeight={900}>
                        Kayıt Düzenle
                    </Typography>
                </DialogTitle>

                <DialogContent dividers>
                    <Stack spacing={2} mt={0.5}>
                        <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Plaka"
                                    fullWidth
                                    size="small"
                                    value={editForm.plaka}
                                    disabled
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Cari ID"
                                    fullWidth
                                    size="small"
                                    value={editForm.cari_id}
                                    disabled={!perms.fields.cari_id}
                                    onChange={(e) => handleEditChange("cari_id", e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    label="Cari Adı"
                                    fullWidth
                                    size="small"
                                    value={editForm.cari_adi}
                                    disabled={!perms.fields.cari_adi}
                                    onChange={(e) => handleEditChange("cari_adi", e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Araç Sahibi"
                                    fullWidth
                                    size="small"
                                    value={editForm.arac_sahip}
                                    disabled={!perms.fields.arac_sahibi}
                                    onChange={(e) => handleEditChange("arac_sahip", e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Çalışma Tipi"
                                    fullWidth
                                    size="small"
                                    value={editForm.odak_arac_calisma_tipi}
                                    disabled={!perms.fields.odak_arac_calisma_tipi}
                                    onChange={(e) => handleEditChange("odak_arac_calisma_tipi", e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="Aylık Kira"
                                    fullWidth
                                    size="small"
                                    value={editForm.aylik_kira}
                                    disabled={!perms.fields.aylik_kira}
                                    onChange={(e) => handleEditChange("aylik_kira", formatTLForTyping(e.target.value))}
                                />
                            </Grid>

                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="Aylık Sürücü"
                                    fullWidth
                                    size="small"
                                    value={editForm.aylik_surucu}
                                    disabled={!perms.fields.aylik_surucu}
                                    onChange={(e) => handleEditChange("aylik_surucu", formatTLForTyping(e.target.value))}
                                />
                            </Grid>

                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="Çalışma Günü"
                                    fullWidth
                                    size="small"
                                    value={editForm.calisma_gunu}
                                    disabled={!perms.fields.calisma_gunu}
                                    onChange={(e) => handleEditChange("calisma_gunu", e.target.value.replace(/[^\d]/g, ""))}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    select
                                    label="Durum"
                                    fullWidth
                                    size="small"
                                    value={editForm.pasif ? "pasif" : "aktif"}
                                    disabled={!perms.fields.pasif}
                                    onChange={(e) => handleEditChange("pasif", e.target.value === "pasif")}
                                >
                                    <MenuItem value="aktif">Aktif</MenuItem>
                                    <MenuItem value="pasif">Pasif</MenuItem>
                                </TextField>
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    label="Açıklama"
                                    fullWidth
                                    size="small"
                                    multiline
                                    minRows={3}
                                    value={editForm.aciklama}
                                    onChange={(e) => handleEditChange("aciklama", e.target.value)}
                                />
                            </Grid>
                        </Grid>
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setEditOpen(false)} disabled={editLoading}>
                        Vazgeç
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveEdit}
                        disabled={editLoading}
                        startIcon={editLoading ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
                    >
                        {editLoading ? "Kaydediliyor..." : "Güncelle"}
                    </Button>
                </DialogActions>
            </Dialog>

            <LogDialog
                open={bulkProgressOpen}
                onClose={() => setBulkProgressOpen(false)}
                title={bulkProgressTitle}
                progress={bulkProgress}
            />

            <Snackbar
                open={snack.open}
                autoHideDuration={3500}
                onClose={() => setSnack((p) => ({ ...p, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert
                    severity={snack.severity}
                    onClose={() => setSnack((p) => ({ ...p, open: false }))}
                    sx={{ width: "100%" }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>
        </Container>
    );
}
