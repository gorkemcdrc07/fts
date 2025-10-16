// src/Hakedisler/TedarikciMasraf.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Animation
import { motion } from "framer-motion";

// Date & locale
import dayjs from "dayjs";
import "dayjs/locale/tr";

// 🧭 Eklendi: gezinme için
import { useNavigate } from "react-router-dom";

// MUI
import {
    Box,
    Container,
    Paper,
    Typography,
    Stack,
    Chip,
    CircularProgress,
    IconButton,
    Tooltip,
    TextField,
    InputAdornment,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    Grid,
    useMediaQuery,
    useTheme,
    Checkbox,
    Card,
    CardContent,
} from "@mui/material";
import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarQuickFilter,
    GridToolbarDensitySelector,
    GridToolbarExport,
} from "@mui/x-data-grid";
import { trTR as trGrid } from "@mui/x-data-grid/locales";
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Search as SearchIcon,
    Download as DownloadIcon,
    HomeOutlined as HomeIcon,
    TaskAlt as TaskAltIcon,
    DoneAll as DoneAllIcon,
    ErrorOutline as ErrorOutlineIcon,
} from "@mui/icons-material";

/* ---------- Yetkilendirme: bu ekranın anahtarı ---------- */
const SCREEN_KEY = "tedarikci_masraf";
// Onaylama kolonu
const APPROVE_COL = "tdm_approve";

/* ---------- Helpers ---------- */
const HOME_PATH = "/anasayfa";

const BOS_FORM = {
    tedarikci: "",
    tarih: "",
    neden: "",
    bedel: "",
    aciklama: "",
    sefer_no: "",
};

const TL = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
});
const formatTL = (v) => {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    return Number.isNaN(n) ? v : TL.format(n);
};
const formatDateTR = (v) => {
    if (!v) return "";
    const d = dayjs(v);
    return d.isValid() ? d.locale("tr").format("DD.MM.YYYY") : v;
};

// small debounce
function useDebounced(value, delay = 350) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setV(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return v;
}

/* ---------- Reusable ---------- */
function Toolbar({ onExcel }) {
    return (
        <GridToolbarContainer
            sx={{
                p: 1.25,
                gap: 1.25,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                <GridToolbarQuickFilter
                    placeholder="Grid içinde ara…"
                    quickFilterParser={(v) => v.split(/\s+/).filter(Boolean)}
                />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
                <GridToolbarDensitySelector />
                <GridToolbarExport printOptions={{ disableToolbarButton: true }} />
                <Button size="small" startIcon={<DownloadIcon />} onClick={onExcel} variant="outlined">
                    Excel
                </Button>
            </Stack>
        </GridToolbarContainer>
    );
}

function ConfirmDialog({ open, title, subtitle, onCancel, onConfirm, loading }) {
    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
            <DialogContent dividers>
                <Typography>{subtitle}</Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button startIcon={<CloseIcon />} onClick={onCancel} disabled={loading}>
                    Vazgeç
                </Button>
                <Button
                    startIcon={<DeleteIcon />}
                    onClick={onConfirm}
                    color="error"
                    variant="contained"
                    disabled={loading}
                >
                    Sil
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function EmptyState({ onCreate, createDisabled }) {
    return (
        <Stack alignItems="center" justifyContent="center" sx={{ height: "52vh", py: 6 }} spacing={2}>
            <ErrorOutlineIcon sx={{ fontSize: 56, opacity: 0.6 }} />
            <Typography variant="h6" fontWeight={700} sx={{ opacity: 0.8 }}>
                Henüz kayıt yok
            </Typography>
            <Typography sx={{ opacity: 0.7 }}>Yeni bir masraf ekleyerek başlayın.</Typography>
            <span>
                <Tooltip title={createDisabled ? "Yeni ekleme yetkiniz yok" : ""}>
                    <span>
                        <Button startIcon={<AddIcon />} variant="contained" onClick={onCreate} disabled={createDisabled}>
                            Yeni Masraf
                        </Button>
                    </span>
                </Tooltip>
            </span>
        </Stack>
    );
}

/* ---------- Component ---------- */
export default function TedarikciMasraf() {
    const theme = useTheme();
    const downSm = useMediaQuery(theme.breakpoints.down("sm"));
    dayjs.locale("tr");

    const navigate = useNavigate();

    const kullanici = localStorage.getItem("kullanici") || "";
    const kullaniciRol = localStorage.getItem("rol") || "";

    const [form, setForm] = useState(BOS_FORM);
    const [masraflar, setMasraflar] = useState([]);
    const [filtre, setFiltre] = useState("");
    const filtreDebounced = useDebounced(filtre);
    const [formGorunur, setFormGorunur] = useState(false);
    const [duzenlemeId, setDuzenlemeId] = useState(null);

    const [reelDurum, setReelDurum] = useState({});
    const [yukleniyor, setYukleniyor] = useState(true);
    const [hata, setHata] = useState(null);
    const [silDialog, setSilDialog] = useState({ open: false, id: null, loading: false });

    /* ---------- YETKİ: rol + kullanıcı override ---------- */
    const [permLoading, setPermLoading] = useState(true);
    const [perms, setPerms] = useState({
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
    });

    function coalesceOverride(overrideVal, roleVal) {
        return overrideVal === true || overrideVal === false ? overrideVal : !!roleVal;
    }

    async function loadPermissions() {
        try {
            setPermLoading(true);
            // 1) Kullanıcı
            const { data: userRow, error: eU } = await supabase
                .from("login")
                .select("id, kullanici, rol")
                .eq("kullanici", kullanici)
                .maybeSingle();
            if (eU) throw eU;

            // Rol key'i (roles.key büyük harf)
            const roleKey = (userRow?.rol || "").toUpperCase();
            const { data: roleRow, error: eR } = await supabase
                .from("roles")
                .select("id,key")
                .eq("key", roleKey)
                .maybeSingle();
            if (eR) throw eR;

            // 2) Rol izinleri (screen_key yok; role_id yeterli)
            let rolePerm = {};
            if (roleRow?.id) {
                const { data: rp, error: eRP } = await supabase
                    .from("role_permissions")
                    .select("tdm_create, tdm_edit, tdm_delete, tdm_approve, tdm_may_open_edit")
                    .eq("role_id", roleRow.id)
                    .maybeSingle();
                if (eRP) throw eRP;
                rolePerm = rp || {};
            }

            // 3) Kullanıcı override (screen_key yok; user_id yeterli)
            const { data: up, error: eUP } = await supabase
                .from("user_permissions")
                .select("tdm_create, tdm_edit, tdm_delete, tdm_approve, tdm_may_open_edit")
                .eq("user_id", userRow?.id)
                .maybeSingle();
            if (eUP) throw eUP;

            const canCreate = coalesceOverride(up?.tdm_create, rolePerm?.tdm_create);
            const canEdit = coalesceOverride(up?.tdm_edit, rolePerm?.tdm_edit);
            const canDelete = coalesceOverride(up?.tdm_delete, rolePerm?.tdm_delete);
            const canApprove = coalesceOverride(up?.[APPROVE_COL], rolePerm?.[APPROVE_COL]);
            // gerekirse UI’de kullanmak için:
            // const mayOpenEdit = coalesceOverride(up?.tdm_may_open_edit, rolePerm?.tdm_may_open_edit);

            setPerms({ canCreate, canEdit, canDelete, canApprove });
        } catch (err) {
            console.error("perm load error:", err);
            setPerms({ canCreate: false, canEdit: false, canDelete: false, canApprove: false });
        } finally {
            setPermLoading(false);
        }
    }

    const veriGetir = useCallback(async () => {
        setYukleniyor(true);
        setHata(null);
        const { data, error } = await supabase
            .from("tedarikci_masraflar")
            .select("*")
            .order("tarih", { ascending: false });
        if (error) setHata(error.message || "Veri çekilemedi");
        else setMasraflar(data || []);
        setYukleniyor(false);
    }, []);

    useEffect(() => {
        veriGetir();
        loadPermissions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [veriGetir]);

    const handleOpenYeni = () => {
        if (!perms.canCreate) {
            toast.warn("Yeni ekleme yetkiniz yok.");
            return;
        }
        setForm(BOS_FORM);
        setDuzenlemeId(null);
        setFormGorunur(true);
    };
    const handleCloseForm = () => {
        setForm(BOS_FORM);
        setDuzenlemeId(null);
        setFormGorunur(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // create vs edit kontrolü
        if (!duzenlemeId && !perms.canCreate) {
            toast.warn("Yeni ekleme yetkiniz yok.");
            return;
        }
        if (duzenlemeId && !perms.canEdit) {
            toast.warn("Düzenleme yetkiniz yok.");
            return;
        }

        const bedelParsed = parseFloat(String(form.bedel).replace(",", "."));
        if (Number.isNaN(bedelParsed)) {
            toast.error("Geçerli bir bedel giriniz.");
            return;
        }
        const kayit = {
            ...form,
            bedel: bedelParsed,
            // insert'te statü ve reel_islendi set edilsin, edit'te dokunma
            ...(duzenlemeId ? {} : { statu: "ONAY BEKLİYOR", reel_islendi: false }),
        };

        let sonuc;
        if (duzenlemeId) {
            sonuc = await supabase.from("tedarikci_masraflar").update(kayit).eq("id", duzenlemeId);
        } else {
            sonuc = await supabase.from("tedarikci_masraflar").insert([kayit]);

            // İsteğe bağlı: Bekir'e bildirim (mevcut davranış)
            try {
                const bekir = await supabase
                    .from("login")
                    .select("id")
                    .eq("kullanici", "BEKİR AKCAGÖZ")
                    .single();
                if (bekir.data?.id) {
                    await supabase.from("bildirimler").insert([
                        {
                            kullanici_id: bekir.data.id,
                            mesaj: `Yeni masraf: ${form.tedarikci} - ${form.neden}`,
                            okundu: false,
                            baslik: "Masraf Onayı",
                        },
                    ]);
                }
            } catch {
                /* silent */
            }
        }

        if (!sonuc.error) {
            handleCloseForm();
            await veriGetir();
            toast.success("✅ Masraf kaydedildi.");
        } else {
            toast.error("❌ Masraf kaydedilemedi.");
        }
    };

    const confirmSil = (id) => setSilDialog({ open: true, id, loading: false });

    const handleSil = async () => {
        const { id } = silDialog;
        if (!id) return setSilDialog({ open: false, id: null, loading: false });

        if (!perms.canDelete) {
            toast.error("❌ Silme yetkiniz yok.");
            return setSilDialog({ open: false, id: null, loading: false });
        }

        setSilDialog((p) => ({ ...p, loading: true }));
        const { error } = await supabase.from("tedarikci_masraflar").delete().eq("id", id);
        if (!error) {
            await veriGetir();
            toast.info("🗑️ Masraf silindi.");
        } else {
            toast.error("❌ Silme işlemi başarısız.");
        }
        setSilDialog({ open: false, id: null, loading: false });
    };

    const handleDuzenle = (kayit) => {
        if (!perms.canEdit) {
            toast.warn("Düzenleme yetkiniz yok.");
            return;
        }
        setForm({
            id: kayit.id,
            sefer_no: kayit.sefer_no || "",
            tedarikci: kayit.tedarikci || "",
            tarih: kayit.tarih || "",
            neden: kayit.neden || "",
            bedel: kayit.bedel ?? "",
            aciklama: kayit.aciklama || "",
        });
        setDuzenlemeId(kayit.id);
        setFormGorunur(true);
    };

    const handleOnayla = async (id) => {
        if (!perms.canApprove) {
            toast.warn("Onaylama yetkiniz yok.");
            return;
        }
        const { error } = await supabase.from("tedarikci_masraflar").update({ statu: "ONAYLANDI" }).eq("id", id);
        if (!error) {
            await veriGetir();
            toast.success("✔️ Masraf onaylandı.");
        } else {
            toast.error("❌ Onaylama sırasında hata oluştu.");
        }
    };

    const handleReelTick = (id, checked) => {
        setReelDurum((prev) => ({ ...prev, [id]: checked }));
    };
    const handleReelKaydet = async (id) => {
        if (!reelDurum[id]) {
            toast.warn("Önce kutucuğu işaretleyin.");
            return;
        }
        const { error } = await supabase.from("tedarikci_masraflar").update({ reel_islendi: true }).eq("id", id);
        if (!error) {
            setReelDurum((prev) => {
                const k = { ...prev };
                delete k[id];
                return k;
            });
            await veriGetir();
            toast.success("📌 REEL’e işlendi olarak kaydedildi.");
        } else {
            toast.error("❌ Kaydedilemedi.");
        }
    };

    // Dış filtre
    const filtrelenmis = useMemo(() => {
        const f = (filtreDebounced || "").toLowerCase();
        if (!f) return masraflar;
        return (masraflar || []).filter((m) => {
            const t1 = (m.tedarikci || "").toLowerCase();
            const t2 = (m.neden || "").toLowerCase();
            const t3 = (m.sefer_no || "").toLowerCase();
            return t1.includes(f) || t2.includes(f) || t3.includes(f);
        });
    }, [masraflar, filtreDebounced]);

    const toplamBedel = useMemo(
        () =>
            filtrelenmis.reduce((acc, m) => {
                const n = Number(m?.bedel ?? 0);
                return acc + (Number.isFinite(n) ? n : 0);
            }, 0),
        [filtrelenmis]
    );

    const sayilar = useMemo(() => {
        const toplam = filtrelenmis.length;
        const onayBekleyen = filtrelenmis.filter((m) => (m.statu || "").toUpperCase() === "ONAY BEKLİYOR").length;
        const onaylanan = filtrelenmis.filter((m) => (m.statu || "").toUpperCase() === "ONAYLANDI").length;
        const reel = filtrelenmis.filter((m) => !!m.reel_islendi).length;
        return { toplam, onayBekleyen, onaylanan, reel };
    }, [filtrelenmis]);

    const gridRows = useMemo(() => (filtrelenmis || []).map((m, i) => ({ id: m.id ?? `row-${i}`, ...m })), [filtrelenmis]);

    const exportToExcel = () => {
        const excelData = (filtrelenmis || []).map((m) => ({
            "Sefer No": m.sefer_no,
            Tedarikçi: m.tedarikci,
            Tarih: formatDateTR(m.tarih),
            "Masraf Nedeni": m.neden,
            Bedel: Number(m.bedel ?? 0),
            Açıklama: m.aciklama,
            Statu: m.statu,
            "REEL'e İşlendi": m.reel_islendi ? "Evet" : "Hayır",
        }));
        const sheet = XLSX.utils.json_to_sheet(excelData);

        // Autofit
        const cols = Object.keys(excelData[0] || {}).map((k) => ({ wch: Math.max(12, k.length + 2) }));
        const rowsAuto = excelData.map((row) => Object.values(row).map((v) => (v ? String(v).length + 2 : 10)));
        if (rowsAuto.length) {
            rowsAuto[0].forEach((_, i) => {
                cols[i].wch = Math.max(cols[i].wch, Math.min(40, Math.max(...rowsAuto.map((r) => r[i] || 10))));
            });
        }
        sheet["!cols"] = cols;

        // Currency format for Bedel (index 4 — zero-based)
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const C = 4;
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = sheet[cellRef];
            if (cell && typeof cell.v === "number") {
                cell.t = "n";
                cell.z = "#,##0.00 [$₺-tr-TR]";
            }
        }

        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, "Masraflar");
        const excelBuffer = XLSX.write(book, { bookType: "xlsx", type: "array" });
        const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
        saveAs(blob, `tedarikci_masraflari_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
    };

    const columns = useMemo(
        () => [
            { field: "sefer_no", headerName: "Sefer No", minWidth: 140, flex: 0.7 },
            { field: "tedarikci", headerName: "Tedarikçi", minWidth: 200, flex: 1.1 },
            {
                field: "tarih",
                headerName: "Tarih",
                minWidth: 140,
                flex: 0.7,
                renderCell: (params) => <Typography title={formatDateTR(params.row?.tarih)}>{formatDateTR(params.row?.tarih)}</Typography>,
            },
            { field: "neden", headerName: "Neden", minWidth: 200, flex: 1.1 },
            {
                field: "bedel",
                headerName: "Bedel",
                minWidth: 140,
                flex: 0.8,
                align: "right",
                headerAlign: "right",
                renderCell: (params) => (
                    <Typography title={formatTL(params.row?.bedel)} sx={{ width: "100%", textAlign: "right" }}>
                        {formatTL(params.row?.bedel)}
                    </Typography>
                ),
            },
            {
                field: "aciklama",
                headerName: "Açıklama",
                minWidth: 260,
                flex: 1.4,
                renderCell: (params) => (
                    <Typography noWrap title={params.value ?? ""}>
                        {params.value}
                    </Typography>
                ),
            },
            {
                field: "statu",
                headerName: "Statu",
                minWidth: 170,
                flex: 0.8,
                renderCell: (params) => {
                    const v = (params.value || "").toString().toUpperCase();
                    const color = v === "ONAYLANDI" ? "success" : v === "ONAY BEKLİYOR" ? "warning" : "default";
                    return (
                        <Chip
                            size="small"
                            color={color}
                            variant="outlined"
                            icon={v === "ONAYLANDI" ? <TaskAltIcon /> : undefined}
                            label={params.value}
                        />
                    );
                },
            },
            {
                field: "reel_islendi",
                headerName: "REEL’e İşlendi",
                minWidth: 220,
                flex: 0.9,
                sortable: false,
                renderCell: (params) => {
                    const already = !!params.value;
                    const id = params.row.id;
                    const checked = already ? true : !!reelDurum[id];
                    return (
                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <Checkbox size="small" checked={checked} onChange={(e) => handleReelTick(id, e.target.checked)} disabled={already} />
                            {!already && checked ? (
                                <Button size="small" variant="contained" onClick={() => handleReelKaydet(id)}>
                                    Kaydet
                                </Button>
                            ) : already ? (
                                <Chip size="small" color="success" variant="outlined" label="İşlendi" />
                            ) : null}
                        </Stack>
                    );
                },
            },
            {
                field: "actions",
                headerName: "İşlem",
                minWidth: 260,
                flex: 1,
                sortable: false,
                renderCell: (params) => {
                    const row = params.row;
                    const gosterOnay = (row.statu || "").toString().toUpperCase() === "ONAY BEKLİYOR" && perms.canApprove;

                    return (
                        <Stack direction="row" spacing={1}>
                            <Tooltip title={perms.canEdit ? "Düzenle" : "Düzenleme yetkiniz yok"}>
                                <span>
                                    <IconButton size="small" onClick={() => handleDuzenle(row)} disabled={!perms.canEdit || permLoading}>
                                        <EditIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                            <Tooltip title={perms.canDelete ? "Sil" : "Silme yetkiniz yok"}>
                                <span>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => confirmSil(row.id)}
                                        disabled={!perms.canDelete || permLoading}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                            <Tooltip title={gosterOnay ? "Onayla" : "Onaylama yetkiniz yok veya durum uygun değil"}>
                                <span>
                                    <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={() => handleOnayla(row.id)}
                                        disabled={!gosterOnay || permLoading}
                                    >
                                        <CheckIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Stack>
                    );
                },
            },
        ],
        [perms, permLoading, reelDurum]
    );

    return (
        <Box
            component={motion.div}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            sx={{
                minHeight: "100dvh",
                py: { xs: 2, md: 4 },
                background: (t) =>
                    t.palette.mode === "dark" ? "linear-gradient(180deg,#0b1020,#0e1428)" : "linear-gradient(180deg,#f6f9ff,#f4f7ff)",
            }}
        >
            <Container maxWidth={false} sx={{ maxWidth: "1680px", px: { xs: 2, md: 4 } }}>
                <Paper
                    elevation={6}
                    sx={{
                        mx: "auto",
                        width: "100%",
                        borderRadius: 4,
                        overflow: "hidden",
                        backdropFilter: "saturate(140%) blur(10px)",
                        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)"),
                        border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                    }}
                >
                    {/* Üst şerit */}
                    <Box
                        sx={{
                            px: { xs: 2, md: 3 },
                            py: { xs: 1.5, md: 2.25 },
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <Typography variant="h6" fontWeight={800}>
                            Tedarikçi Masrafları
                        </Typography>

                        <Stack direction="row" spacing={1.25} alignItems="center">
                            {yukleniyor && (
                                <Chip label="Yükleniyor…" color="info" variant="outlined" icon={<CircularProgress size={14} />} />
                            )}
                            {hata && <Chip label={`Hata: ${hata}`} color="error" variant="outlined" />}
                            {!yukleniyor && !hata && (
                                <>
                                    <Chip variant="outlined" label={`Kayıt: ${filtrelenmis.length}`} />
                                    <Chip variant="outlined" label={`Toplam: ${formatTL(toplamBedel)}`} />
                                </>
                            )}

                            {/* Perm durum göstergesi (isteğe bağlı) */}
                            {permLoading ? (
                                <Chip size="small" variant="outlined" label="Yetkiler yükleniyor…" />
                            ) : null}

                            {/* 🧭 Geri / Anasayfa / Yeni */}
                            <Button size="small" variant="outlined" onClick={() => navigate(-1)} title="Geri">
                                Geri
                            </Button>
                            <Button size="small" variant="text" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)}>
                                Anasayfa
                            </Button>

                            <Tooltip title={perms.canCreate ? "" : "Yeni ekleme yetkiniz yok"}>
                                <span>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={handleOpenYeni}
                                        disabled={!perms.canCreate || permLoading}
                                    >
                                        Yeni
                                    </Button>
                                </span>
                            </Tooltip>
                        </Stack>
                    </Box>

                    {/* Hızlı istatistikler */}
                    <Box sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
                        <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                    <CardContent>
                                        <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                            Toplam Kayıt
                                        </Typography>
                                        <Typography variant="h5" fontWeight={800}>
                                            {sayilar.toplam}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                    <CardContent>
                                        <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                            Onay Bekleyen
                                        </Typography>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Typography variant="h5" fontWeight={800}>
                                                {sayilar.onayBekleyen}
                                            </Typography>
                                            <Chip size="small" color="warning" label="Bekliyor" />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                    <CardContent>
                                        <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                            Onaylanan
                                        </Typography>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Typography variant="h5" fontWeight={800}>
                                                {sayilar.onaylanan}
                                            </Typography>
                                            <Chip size="small" color="success" icon={<DoneAllIcon />} label="Onaylandı" />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                    <CardContent>
                                        <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                            REEL'e İşlenen
                                        </Typography>
                                        <Typography variant="h5" fontWeight={800}>
                                            {sayilar.reel}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Box>

                    {/* Dış arama + Export */}
                    <Box
                        sx={{
                            px: { xs: 2, md: 3 },
                            pb: { xs: 1.5, md: 2 },
                            display: "flex",
                            gap: 1.5,
                            flexWrap: "wrap",
                        }}
                    >
                        <TextField
                            placeholder="Tedarikçi / Neden / Sefer No filtrele"
                            value={filtre}
                            onChange={(e) => setFiltre(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ opacity: 0.7 }} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ flex: "1 1 520px" }}
                            size="medium"
                        />
                        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportToExcel}>
                            Excel'e Aktar
                        </Button>
                        <Button variant="outlined" onClick={() => { veriGetir(); loadPermissions(); }}>
                            Yenile
                        </Button>
                    </Box>

                    <Divider />

                    {/* GRID */}
                    <Box sx={{ height: "68vh", width: "100%" }}>
                        {gridRows.length === 0 && !yukleniyor ? (
                            <EmptyState onCreate={handleOpenYeni} createDisabled={!perms.canCreate || permLoading} />
                        ) : (
                            <DataGrid
                                rows={gridRows}
                                columns={columns}
                                disableColumnMenu
                                disableRowSelectionOnClick
                                loading={yukleniyor}
                                    slots={{ toolbar: Toolbar }}
                                    slotProps={{ toolbar: { onExcel: exportToExcel } }}
                                initialState={{
                                    pagination: { paginationModel: { page: 0, pageSize: 25 } },
                                    density: "standard",
                                }}
                                pageSizeOptions={[10, 25, 50, 100]}
                                rowHeight={48}
                                columnHeaderHeight={52}
                                localeText={trGrid.components.MuiDataGrid.defaultProps.localeText}
                                sx={{
                                    border: 0,
                                    "& .MuiDataGrid-columnHeaders": {
                                        position: "sticky",
                                        top: 0,
                                        background: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.9)"),
                                        backdropFilter: "blur(6px)",
                                    },
                                    "& .MuiDataGrid-cell": { py: 1.25, fontSize: 14.5 },
                                }}
                            />
                        )}
                    </Box>
                </Paper>
            </Container>

            {/* Form Dialog */}
            <Dialog
                open={formGorunur}
                onClose={handleCloseForm}
                maxWidth="md"
                fullWidth
                fullScreen={downSm}
                PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 } } }}
            >
                <form onSubmit={handleSubmit}>
                    <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
                        {duzenlemeId ? "Masraf Düzenle" : "Yeni Masraf Girişi"}
                    </DialogTitle>
                    <DialogContent dividers sx={{ pt: 2 }}>
                        <Grid container spacing={2.5}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Sefer No"
                                    name="sefer_no"
                                    value={form.sefer_no}
                                    onChange={(e) => setForm((p) => ({ ...p, sefer_no: e.target.value }))}
                                    fullWidth
                                    size="medium"
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Tedarikçi"
                                    name="tedarikci"
                                    value={form.tedarikci}
                                    onChange={(e) => setForm((p) => ({ ...p, tedarikci: e.target.value }))}
                                    fullWidth
                                    required
                                    size="medium"
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Tarih"
                                    type="date"
                                    name="tarih"
                                    value={form.tarih}
                                    onChange={(e) => setForm((p) => ({ ...p, tarih: e.target.value }))}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                    required
                                    size="medium"
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Masraf Nedeni"
                                    name="neden"
                                    value={form.neden}
                                    onChange={(e) => setForm((p) => ({ ...p, neden: e.target.value }))}
                                    fullWidth
                                    required
                                    size="medium"
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Bedel"
                                    type="number"
                                    name="bedel"
                                    value={form.bedel}
                                    onChange={(e) => setForm((p) => ({ ...p, bedel: e.target.value }))}
                                    fullWidth
                                    required
                                    inputProps={{ step: "0.01" }}
                                    size="medium"
                                />
                            </Grid>

                            <Grid item xs={12} md={12}>
                                <TextField
                                    label="Açıklama"
                                    name="aciklama"
                                    value={form.aciklama}
                                    onChange={(e) => setForm((p) => ({ ...p, aciklama: e.target.value }))}
                                    fullWidth
                                    multiline
                                    minRows={3}
                                    size="medium"
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>

                    <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
                        <Button startIcon={<CloseIcon />} onClick={handleCloseForm} variant="text">
                            Vazgeç
                        </Button>
                        <Tooltip
                            title={
                                duzenlemeId
                                    ? perms.canEdit
                                        ? ""
                                        : "Düzenleme yetkiniz yok"
                                    : perms.canCreate
                                        ? ""
                                        : "Yeni ekleme yetkiniz yok"
                            }
                        >
                            <span>
                                <Button
                                    type="submit"
                                    startIcon={<CheckIcon />}
                                    variant="contained"
                                    disabled={permLoading || (!duzenlemeId && !perms.canCreate) || (duzenlemeId && !perms.canEdit)}
                                >
                                    Kaydet
                                </Button>
                            </span>
                        </Tooltip>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Silme onayı */}
            <ConfirmDialog
                open={silDialog.open}
                title="Silme Onayı"
                subtitle="Bu masrafı silmek istediğinize emin misiniz?"
                onCancel={() => setSilDialog({ open: false, id: null, loading: false })}
                onConfirm={handleSil}
                loading={silDialog.loading}
            />

            <ToastContainer position="bottom-right" autoClose={4000} />
        </Box>
    );
}
