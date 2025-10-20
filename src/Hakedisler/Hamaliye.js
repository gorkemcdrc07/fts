// src/Hakedisler/Hamaliye.js
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
    Box, Card, CardContent, CardHeader, Typography, Button, TextField,
    Select, MenuItem, InputLabel, FormControl, Dialog, DialogTitle, DialogContent,
    DialogActions, Chip, Table, TableHead, TableRow, TableCell, TableBody,
    Stack, IconButton, Pagination, Tooltip, CircularProgress, Alert, Grid,
    Container, Paper, TableContainer // <-- Eksik olan bileşenler eklendi
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import FilterListIcon from "@mui/icons-material/FilterList";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { supabase } from "../supabaseClient";

// plakalar için dönen alanlar
const PLATE_FIELDS = "id, plaka, treyler, surucu_adi";

const COLUMNS = [
    { key: "created_at", label: "OLUŞTURULMA TAR.", minWidth: 150 },
    { key: "gelir_gider", label: "PRİM/HAMALİYE", minWidth: 120 },
    { key: "sefer_no", label: "SEFER NO", minWidth: 100 },
    { key: "plaka", label: "PLAKA", minWidth: 100 },
    { key: "treyler", label: "TREYLER", minWidth: 100 },
    { key: "tarih", label: "TARİH", minWidth: 100 },
    { key: "surucu", label: "SÜRÜCÜ", minWidth: 120 },
    { key: "yukleme_musteri", label: "YÜKLEME MÜŞTERİ", minWidth: 180 },
    { key: "fatura_musteri", label: "FATURA MÜŞTERİ", minWidth: 180 },
    { key: "bolge_palet_sayisi", label: "BÖLGE PALET", numeric: true, minWidth: 100 },
    { key: "odenen_tutar", label: "ÖDENEN TUTAR", numeric: true, minWidth: 120 },
    { key: "palet_sayisi", label: "PALET SAYISI", numeric: true, minWidth: 100 },
    { key: "donem", label: "DÖNEM", minWidth: 100 },
    { key: "kullanici_adi", label: "KULLANICI ADI", minWidth: 120 },
];

function formatTRYInput(val) {
    const digits = String(val ?? "").replace(/[^\d]/g, ""); // Sadece rakamları al
    const num = digits ? Number(digits) : 0;
    const text = digits
        ? new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(num)
        : "";
    return { num, text };
}

function currencyTRY(v) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
    }).format(v ?? 0);
}

function normalizePlates(raw) {
    const arr = Array.isArray(raw) ? raw : (raw?.data ?? []);
    return arr.map((x) => {
        const plaka = x.plaka ?? "";
        const treyler = x.treyler ?? "";
        const surucu_adi = x.surucu_adi ?? "";
        const id = x.id ?? `${plaka}-${treyler}-${surucu_adi}`;
        return {
            id: String(id),
            plaka: String(plaka || "").toUpperCase(),
            treyler: String(treyler || ""),
            surucu_adi: String(surucu_adi || ""),
        };
    });
}

const getChipColor = (gelirGider) => {
    return gelirGider === "Prim" ? { color: "success", variant: "filled" } : { color: "primary", variant: "filled" };
};

export default function Hamaliye() {
    // tablo state
    const [rows, setRows] = useState([]);
    const [rowsLoading, setRowsLoading] = useState(false);
    const [rowsErr, setRowsErr] = useState("");

    const [globalQuery, setGlobalQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [gelirGider, setGelirGider] = useState("Hepsi");
    const [donem, setDonem] = useState("Hepsi");
    const [sortKey, setSortKey] = useState("tarih");
    const [sortDir, setSortDir] = useState("desc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // localStorage kullanıcı adı
    const [localUserName, setLocalUserName] = useState("");

    // plakalar
    const [plakalar, setPlakalar] = useState([]);
    const [plakalarLoading, setPlakalarLoading] = useState(false);
    const [plateSearch, setPlateSearch] = useState("");
    const [plateErr, setPlateErr] = useState("");

    // dialog & form
    const [dialogOpen, setDialogOpen] = useState(false);
    const [formMode, setFormMode] = useState("create"); // "create" | "edit"
    const [editingId, setEditingId] = useState(null);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");

    const initialFormState = {
        tarih: now.toISOString().slice(0, 10),
        gelir_gider: "Prim",
        kullanici_adi: "",
        plaka: "",
        treyler: "",
        surucu: "",
        donem: `${yyyy}-${mm}`,
        odenen_tutar: 0,
        odenen_tutar_str: "",
        sefer_no: "",
        yukleme_musteri: "",
        fatura_musteri: "",
        bolge_palet_sayisi: 0,
        palet_sayisi: 0,
    };
    const [form, setForm] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [actionErr, setActionErr] = useState(""); // insert/update/delete hataları

    // kullanıcı adını çek
    useEffect(() => {
        const keys = ["kullanici_adi", "kullaniciAdi", "username", "adSoyad"];
        let name = "";
        for (const k of keys) {
            const v = localStorage.getItem(k);
            if (v && v.trim()) { name = v.trim(); break; }
        }
        setLocalUserName(name);
        setForm((f) => ({ ...f, kullanici_adi: name }));
    }, []);

    // --- SUPABASE: hamaliye liste ---
    const fetchRows = useCallback(async () => {
        setRowsLoading(true);
        setRowsErr("");
        try {
            // Tüm kayıtları çek (ihtiyaca göre sayfalama eklenebilir)
            const { data, error } = await supabase
                .from("hamaliye")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setRows(data || []);
        } catch (e) {
            console.error("Hamaliye fetch hatası:", e);
            setRowsErr(String(e.message || e));
            setRows([]);
        } finally {
            setRowsLoading(false);
        }
    }, []);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    // --- SUPABASE: plakalar liste ---
    const loadPlates = useCallback(async (query = "") => {
        setPlakalarLoading(true);
        setPlateErr("");
        try {
            const search = (query.startsWith("?search=") ? decodeURIComponent(query.slice(8)) : "").trim();
            let q = supabase.from("plakalar").select(PLATE_FIELDS).order("id", { ascending: false }).limit(1000);
            if (search.length >= 1) {
                const s = search.replaceAll(",", " ").trim();
                q = q.or(`plaka.ilike.%${s}%,treyler.ilike.%${s}%,surucu_adi.ilike.%${s}%`);
            }
            const { data, error } = await q;
            if (error) throw error;
            const normalized = normalizePlates(data);
            setPlakalar(normalized);
            localStorage.setItem("plakaCache", JSON.stringify(normalized.slice(0, 2000)));
        } catch (e) {
            console.error("Plaka fetch hatası:", e);
            const cached = localStorage.getItem("plakaCache");
            if (cached) {
                try {
                    const list = JSON.parse(cached);
                    if (Array.isArray(list) && list.length) {
                        setPlakalar(list);
                        setPlateErr("Canlı API erişilemedi. Önbellekten gösteriliyor.");
                        return;
                    }
                } catch { }
            }
            setPlateErr(String(e.message || e));
            setPlakalar([]);
        } finally {
            setPlakalarLoading(false);
        }
    }, []);

    // Dialog açılınca plakaları yükle
    useEffect(() => {
        if (!dialogOpen) return;
        loadPlates("");
    }, [dialogOpen, loadPlates]);

    // filtre + sıralama (UI)
    const filtered = useMemo(() => {
        let data = [...rows];
        if (globalQuery.trim()) {
            const q = globalQuery.toLowerCase();
            data = data.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
        }
        if (dateFrom) data = data.filter((r) => r.tarih >= dateFrom);
        if (dateTo) data = data.filter((r) => r.tarih <= dateTo);
        if (gelirGider !== "Hepsi") data = data.filter((r) => r.gelir_gider === gelirGider);
        if (donem !== "Hepsi") data = data.filter((r) => r.donem === donem);

        data.sort((a, b) => {
            const va = a[sortKey], vb = b[sortKey];
            if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
            return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
        return data;
    }, [rows, globalQuery, dateFrom, dateTo, gelirGider, donem, sortKey, sortDir]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    function toggleSort(k) {
        if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(k); setSortDir("asc"); }
    }

    function resetFilters() {
        setGlobalQuery(""); setDateFrom(""); setDateTo("");
        setGelirGider("Hepsi"); setDonem("Hepsi"); setPage(1);
    }

    function validateForm(values) {
        const e = {};
        const required = [
            "gelir_gider", "sefer_no", "plaka", "treyler", "tarih", "surucu",
            "yukleme_musteri", "fatura_musteri", "odenen_tutar", "palet_sayisi",
            "donem", "kullanici_adi",
        ];
        for (const k of required) if (values[k] === undefined || values[k] === "" || values[k] === null) e[k] = "Zorunlu alan";
        if (values.odenen_tutar != null && Number(values.odenen_tutar) < 0) e.odenen_tutar = "+ olmalı";
        if (values.palet_sayisi != null && Number(values.palet_sayisi) < 0) e.palet_sayisi = "+ olmalı";
        return e;
    }

    // Düzenle formunu hazırla
    function handleEditRow(r) {
        setFormMode("edit");
        setEditingId(r.id);
        const formDate = r.tarih || new Date().toISOString().slice(0, 10);
        const formDonem = r.donem || (() => {
            const d = new Date(formDate);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            return `${y}-${m}`;
        })();

        setForm({
            tarih: formDate,
            gelir_gider: r.gelir_gider || "Prim",
            kullanici_adi: r.kullanici_adi || localUserName || "",
            plaka: r.plaka || "",
            treyler: r.treyler || "",
            surucu: r.surucu || "",
            sefer_no: r.sefer_no || "",
            yukleme_musteri: r.yukleme_musteri || "",
            fatura_musteri: r.fatura_musteri || "",
            bolge_palet_sayisi: r.bolge_palet_sayisi ?? 0,
            palet_sayisi: r.palet_sayisi ?? 0,
            donem: formDonem,
            odenen_tutar: r.odenen_tutar ?? 0,
            odenen_tutar_str: r.odenen_tutar ? formatTRYInput(r.odenen_tutar).text : "",
        });
        setDialogOpen(true);
    }

    // Yeni kayıt için formu sıfırla
    function handleNewRecord() {
        setFormMode("create");
        setEditingId(null);
        setErrors({});
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        setForm({ ...initialFormState, donem: `${y}-${m}`, kullanici_adi: localUserName, tarih: d.toISOString().slice(0, 10) });
        setPlateSearch("");
        setDialogOpen(true);
    }

    async function handleDeleteRow(r) {
        setActionErr("");
        try {
            if (!window.confirm(`${r.plaka} plakalı kaydı silmek istediğinize emin misiniz?`)) return;
            const { error } = await supabase.from("hamaliye").delete().eq("id", r.id);
            if (error) throw error;
            setRows((rs) => rs.filter((x) => x.id !== r.id));
        } catch (e) {
            console.error("Silme hatası:", e);
            setActionErr(`Silme hatası: ${String(e.message || e)}`);
        }
    }

    async function handleSave() {
        setActionErr("");
        const e = validateForm(form);
        setErrors(e);
        if (Object.keys(e).length) return;

        const payload = {
            gelir_gider: form.gelir_gider || "Prim",
            sefer_no: String(form.sefer_no || ""),
            plaka: String(form.plaka || ""),
            treyler: String(form.treyler || ""),
            tarih: String(form.tarih || new Date().toISOString().slice(0, 10)),
            surucu: String(form.surucu || ""),
            yukleme_musteri: String(form.yukleme_musteri || ""),
            fatura_musteri: String(form.fatura_musteri || ""),
            bolge_palet_sayisi: Number(form.bolge_palet_sayisi || 0),
            odenen_tutar: Number(form.odenen_tutar || 0),
            palet_sayisi: Number(form.palet_sayisi || 0),
            donem: String(form.donem || ""),
            kullanici_adi: String(form.kullanici_adi || localUserName || ""),
        };

        try {
            let data;
            if (formMode === "edit" && editingId) {
                const { data: updatedData, error } = await supabase
                    .from("hamaliye")
                    .update(payload)
                    .eq("id", editingId)
                    .select()
                    .single();
                if (error) throw error;
                data = updatedData;
                setRows((rs) => rs.map((r) => (r.id === editingId ? { ...r, ...data } : r)));
            } else {
                const { data: newRowData, error } = await supabase
                    .from("hamaliye")
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                data = newRowData;
                setRows((r) => [data, ...r]);
            }

            // Kapat & sıfırla (Formu temizle)
            setDialogOpen(false);
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            setForm({ ...initialFormState, donem: `${y}-${m}`, kullanici_adi: localUserName, tarih: d.toISOString().slice(0, 10) });
            setPlateSearch("");
            setEditingId(null);
            setFormMode("create");
            setErrors({});

        } catch (err) {
            console.error("Kaydet/Güncelle hatası:", err);
            setActionErr(`Kaydet/Güncelle hatası: ${String(err.message || err)}`);
        }
    }

    function exportCSV() {
        const header = COLUMNS.map((c) => c.label).join(",");
        const body = filtered.map((r) =>
            [
                r.created_at ? new Date(r.created_at).toLocaleString("tr-TR") : "",
                r.gelir_gider, r.sefer_no, (r.plaka || "").toUpperCase(), r.treyler,
                r.tarih, r.surucu, r.yukleme_musteri, r.fatura_musteri,
                r.bolge_palet_sayisi, r.odenen_tutar, r.palet_sayisi,
                r.donem, r.kullanici_adi,
            ].map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`).join(",")
        ).join("\n");
        const csv = "\ufeff" + header + "\n" + body; // UTF-8 BOM eklenir
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `hamaliye_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    }

    // Seçilen Plaka/Treyler nesnesi (Autocomplete için)
    const selectedPlateObj =
        plakalar.find(
            (p) =>
                (p.plaka || "").toUpperCase() === (form.plaka || "").toUpperCase() &&
                String(p.treyler || "") === String(form.treyler || "")
        ) || null;

    // Ay seçimi için dönem listesi
    const monthOptions = Array.from({ length: 12 }, (_, i) => {
        const mo = String(i + 1).padStart(2, "0");
        return { value: mo, label: mo };
    });

    const getMonthFromDonem = form.donem ? form.donem.slice(5, 7) : mm;


    return (
        <Box
            sx={{
                minHeight: "100dvh",
                py: 4,
                px: { xs: 1.5, md: 2.5 },
                background: (t) =>
                    t.palette.mode === "dark"
                        ? `radial-gradient(1200px 600px at 10% -10%, rgba(120,119,198,0.18), transparent 60%),
                           radial-gradient(900px 500px at 100% 0%, rgba(56,189,248,0.12), transparent 60%),
                           ${t.palette.background.default}`
                        : "linear-gradient(180deg, #f0f4f9 0%, #ffffff 60%)",
            }}
        >
            <Container maxWidth="xl" disableGutters>
                {/* Üst Başlık ve Aksiyonlar */}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                    <Box>
                        <Typography
                            variant="h4"
                            fontWeight={900}
                            sx={{
                                background: "linear-gradient(90deg, #6d28d9, #0ea5e9)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            Hamaliye & Prim Yönetimi 💸
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Kayıtları listele, filtrele ve yönet.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1.5}>
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={exportCSV}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                            CSV Dışa Aktar
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<AddIcon />}
                            onClick={handleNewRecord}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                            Yeni Kayıt
                        </Button>
                    </Stack>
                </Stack>

                {/* Hata Mesajları */}
                {rowsErr && <Alert severity="error" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{rowsErr}</Alert>}
                {actionErr && <Alert severity="error" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{actionErr}</Alert>}

                <Paper elevation={16} sx={{ borderRadius: 4, overflow: "hidden" }}>

                    {/* Filtreler Alanı */}
                    <CardHeader
                        title={<Stack direction="row" alignItems="center" spacing={1}><FilterListIcon color="primary" /><Typography variant="h6" fontWeight={700} color="primary.main">Veri Filtreleme</Typography></Stack>}
                        sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'primary.dark' : 'primary.lightest', p: 2, borderBottom: '1px solid', borderColor: 'divider' }}
                    />
                    <CardContent sx={{ p: 2 }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={4} lg={3}>
                                <TextField
                                    fullWidth size="small" placeholder="Genel Arama (Plaka, Sefer No, Müşteri...)"
                                    value={globalQuery}
                                    onChange={(e) => { setGlobalQuery(e.target.value); setPage(1); }}
                                    InputProps={{
                                        startAdornment: <SearchIcon sx={{ mr: 1, opacity: 0.7 }} />,
                                        endAdornment: globalQuery ? (
                                            <Tooltip title="Temizle"><IconButton size="small" onClick={() => setGlobalQuery("")}><CloseIcon fontSize="small" /></IconButton></Tooltip>
                                        ) : null,
                                    }}
                                />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2} lg={1}>
                                <TextField label="Başlangıç" type="date" size="small" fullWidth value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2} lg={1}>
                                <TextField label="Bitiş" type="date" size="small" fullWidth value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2} lg={2}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel id="gg-label">Prim/Hamaliye</InputLabel>
                                    <Select labelId="gg-label" label="Prim/Hamaliye" value={gelirGider} onChange={(e) => { setGelirGider(e.target.value); setPage(1); }}>
                                        <MenuItem value="Hepsi">Hepsi</MenuItem>
                                        <MenuItem value="Prim">Prim</MenuItem>
                                        <MenuItem value="Hamaliye">Hamaliye</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={6} sm={4} md={2} lg={2}>
                                <TextField label="Dönem (YYYY-AA)" size="small" fullWidth value={donem === "Hepsi" ? "" : donem} onChange={(e) => { setDonem(e.target.value || "Hepsi"); setPage(1); }} />
                            </Grid>
                            <Grid item xs={12} sm={4} md={2} lg={1}>
                                <Button variant="outlined" onClick={resetFilters} startIcon={<CloseIcon />}>Sıfırla</Button>
                            </Grid>
                        </Grid>
                    </CardContent>

                    {/* Tablo Alanı */}
                    <CardHeader
                        title={
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="h6" fontWeight={700}>Kayıt Listesi</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    {rowsLoading && <CircularProgress size={18} color="secondary" />}
                                    <Chip label={`${total} Toplam Kayıt`} size="medium" color="secondary" variant="outlined" />
                                </Stack>
                            </Stack>
                        }
                        sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'secondary.dark' : 'secondary.lightest', p: 2, borderTop: '1px solid', borderColor: 'divider' }}
                    />

                    <TableContainer sx={{ maxHeight: 600, borderTop: "1px solid", borderColor: "divider" }}>
                        <Table size="small" stickyHeader sx={{ minWidth: 1400 }}>
                            <TableHead>
                                <TableRow>
                                    {COLUMNS.map((c) => (
                                        <TableCell
                                            key={c.key}
                                            align={c.numeric ? "right" : "left"}
                                            sx={{
                                                bgcolor: 'background.paper',
                                                fontWeight: 700,
                                                fontSize: 12,
                                                whiteSpace: 'nowrap',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => toggleSort(c.key)}
                                        >
                                            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={c.numeric ? "flex-end" : "flex-start"}>
                                                {c.label}
                                                {sortKey === c.key ? (sortDir === "asc" ? <ArrowUpwardIcon fontSize="inherit" /> : <ArrowDownwardIcon fontSize="inherit" />) : <ArrowUpwardIcon fontSize="inherit" sx={{ opacity: 0 }} />}
                                            </Stack>
                                        </TableCell>
                                    ))}
                                    <TableCell align="right" sx={{ bgcolor: 'background.paper', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', width: 90 }}>
                                        İşlemler
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paged.length === 0 && (
                                    <TableRow><TableCell colSpan={COLUMNS.length + 1} align="center" sx={{ py: 6, color: "text.secondary" }}>
                                        {rowsLoading ? <CircularProgress size={24} /> : "Kayıt bulunamadı."}
                                    </TableCell></TableRow>
                                )}
                                {paged.map((r, i) => (
                                    <TableRow key={r.id} hover sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}>
                                        <TableCell sx={{ color: "text.secondary", fontSize: 11 }}>
                                            {r.created_at ? new Date(r.created_at).toLocaleString("tr-TR") : "-"}
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={r.gelir_gider}
                                                size="small"
                                                {...getChipColor(r.gelir_gider)}
                                            />
                                        </TableCell>

                                        <TableCell sx={{ fontSize: 12 }}>{r.sefer_no}</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{(r.plaka || "").toUpperCase()}</TableCell>
                                        <TableCell sx={{ fontSize: 12 }}>{r.treyler || "—"}</TableCell>
                                        <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.tarih}</TableCell>
                                        <TableCell sx={{ fontSize: 12 }}>{r.surucu}</TableCell>
                                        <TableCell sx={{ fontSize: 12 }}>{r.yukleme_musteri}</TableCell>
                                        <TableCell sx={{ fontSize: 12 }}>{r.fatura_musteri}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{r.bolge_palet_sayisi}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: 'error.main' }}>{currencyTRY(r.odenen_tutar)}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{r.palet_sayisi}</TableCell>
                                        <TableCell sx={{ fontSize: 12 }}>{r.donem}</TableCell>
                                        <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{r.kullanici_adi}</TableCell>
                                        <TableCell align="right" sx={{ width: 90 }}>
                                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                <Tooltip title="Düzenle">
                                                    <IconButton size="small" color="primary" onClick={() => handleEditRow(r)}><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                <Tooltip title="Sil">
                                                    <IconButton size="small" color="error" onClick={() => handleDeleteRow(r)}><DeleteIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Sayfalama */}
                    <CardContent sx={{ pt: 2, pb: 2 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" spacing={2}>
                            <Typography variant="caption" color="text.secondary">
                                Toplam **{total}** kayıttan **{((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)}** arası gösteriliyor.
                            </Typography>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel id="psize">Sayfa Boyutu</InputLabel>
                                    <Select labelId="psize" label="Sayfa Boyutu" value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                                        {[10, 25, 50, 100].map((n) => (<MenuItem key={n} value={String(n)}>{n} / sayfa</MenuItem>))}
                                    </Select>
                                </FormControl>
                                <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} shape="rounded" size="medium" showFirstButton showLastButton color="primary" />
                            </Stack>
                        </Stack>
                    </CardContent>

                </Paper>


                {/* Yeni Kayıt / Düzenle Dialog */}
                <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
                    <DialogTitle sx={{ fontWeight: 800, color: 'primary.main', pb: 1.5 }}>
                        {formMode === "edit" ? "Kaydı Düzenle 📝" : "Yeni Hamaliye Kaydı ➕"}
                    </DialogTitle>
                    <DialogContent dividers>
                        {plateErr && <Alert severity="warning" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{plateErr}</Alert>}

                        {/* Plaka Yenileme Aksiyonu */}
                        <Box sx={{ mb: 2, textAlign: 'right' }}>
                            <Button size="small" onClick={() => loadPlates("")} startIcon={<CircularProgress size={12} color="inherit" sx={{ visibility: plakalarLoading ? 'visible' : 'hidden' }} />}>
                                Plaka listesini yenile
                            </Button>
                        </Box>

                        <Grid container spacing={3}>
                            {/* Sol Kolon */}
                            <Grid item xs={12} md={6}>
                                <Stack spacing={2}>
                                    <TextField
                                        label="Sefer No"
                                        value={form.sefer_no || ""}
                                        onChange={(e) => setForm({ ...form, sefer_no: e.target.value })}
                                        error={!!errors.sefer_no}
                                        helperText={errors.sefer_no}
                                        fullWidth
                                    />

                                    {/* Plaka - Treyler - Sürücü (Autocomplete) */}
                                    <Autocomplete
                                        options={plakalar}
                                        loading={plakalarLoading}
                                        openOnFocus
                                        value={selectedPlateObj}
                                        onChange={(_, val) => {
                                            if (val) {
                                                setForm((f) => ({
                                                    ...f, plaka: (val.plaka || "").toUpperCase(), treyler: val.treyler || "", surucu: val.surucu_adi || "",
                                                }));
                                            } else {
                                                setForm((f) => ({ ...f, plaka: "", treyler: "", surucu: "" }));
                                            }
                                        }}
                                        inputValue={plateSearch}
                                        onInputChange={(_, v) => setPlateSearch(v)}
                                        getOptionLabel={(opt) => opt ? `${(opt.plaka || "").toUpperCase()}${opt.treyler ? " - " + opt.treyler : ""}` : ""}
                                        isOptionEqualToValue={(o, v) => (o?.plaka || "").toUpperCase() === (v?.plaka || "").toUpperCase() && String(o?.treyler || "") === String(v?.treyler || "")}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Plaka - Treyler"
                                                placeholder="Örn: 34ABC123"
                                                error={!!errors.plaka || !!errors.treyler}
                                                helperText={plateErr || errors.plaka || errors.treyler || "Seçince sürücü otomatik dolar"}
                                            />
                                        )}
                                    />

                                    <TextField
                                        label="Tarih"
                                        type="date"
                                        value={form.tarih || ""}
                                        onChange={(e) => setForm({ ...form, tarih: e.target.value })}
                                        InputLabelProps={{ shrink: true }}
                                        error={!!errors.tarih}
                                        helperText={errors.tarih}
                                    />

                                    <FormControl error={!!errors.gelir_gider}>
                                        <InputLabel id="gg-dialog">Prim/Hamaliye</InputLabel>
                                        <Select
                                            labelId="gg-dialog"
                                            label="Prim/Hamaliye"
                                            value={form.gelir_gider || "Prim"}
                                            onChange={(e) => setForm({ ...form, gelir_gider: e.target.value })}
                                        >
                                            <MenuItem value="Prim">Prim</MenuItem>
                                            <MenuItem value="Hamaliye">Hamaliye</MenuItem>
                                        </Select>
                                        {errors.gelir_gider && <Typography variant="caption" color="error">{errors.gelir_gider}</Typography>}
                                    </FormControl>

                                    {/* Ödenen Tutar - canlı ₺ */}
                                    <TextField
                                        label="Ödenen Tutar (₺)"
                                        value={form.odenen_tutar_str ?? ""}
                                        onChange={(e) => {
                                            const { num, text } = formatTRYInput(e.target.value);
                                            setForm({ ...form, odenen_tutar: num, odenen_tutar_str: text });
                                        }}
                                        placeholder="₺0"
                                        error={!!errors.odenen_tutar}
                                        helperText={errors.odenen_tutar}
                                        inputMode="numeric"
                                    />
                                </Stack>
                            </Grid>

                            {/* Sağ Kolon */}
                            <Grid item xs={12} md={6}>
                                <Stack spacing={2}>
                                    <TextField
                                        label="Sürücü"
                                        value={form.surucu || ""}
                                        onChange={(e) => setForm({ ...form, surucu: e.target.value })}
                                        error={!!errors.surucu}
                                        helperText={errors.surucu || "Plaka seçildiğinde otomatik doldurulur"}
                                        InputProps={{ readOnly: selectedPlateObj, endAdornment: selectedPlateObj ? <Chip label="Otomatik" size="small" /> : null }}
                                    />
                                    <TextField
                                        label="Yükleme Müşteri"
                                        value={form.yukleme_musteri || ""}
                                        onChange={(e) => setForm({ ...form, yukleme_musteri: e.target.value })}
                                        error={!!errors.yukleme_musteri}
                                        helperText={errors.yukleme_musteri}
                                    />
                                    <TextField
                                        label="Fatura Müşteri"
                                        value={form.fatura_musteri || ""}
                                        onChange={(e) => setForm({ ...form, fatura_musteri: e.target.value })}
                                        error={!!errors.fatura_musteri}
                                        helperText={errors.fatura_musteri}
                                    />
                                    <Stack direction="row" spacing={2}>
                                        <TextField
                                            label="Bölge Palet"
                                            type="number"
                                            value={form.bolge_palet_sayisi ?? ""}
                                            onChange={(e) => setForm({ ...form, bolge_palet_sayisi: Number(e.target.value) })}
                                            sx={{ flex: 1 }}
                                            InputProps={{ inputProps: { min: 0 } }}
                                        />
                                        <TextField
                                            label="Palet Sayısı"
                                            type="number"
                                            value={form.palet_sayisi ?? ""}
                                            onChange={(e) => setForm({ ...form, palet_sayisi: Number(e.target.value) })}
                                            error={!!errors.palet_sayisi}
                                            helperText={errors.palet_sayisi}
                                            sx={{ flex: 1 }}
                                            InputProps={{ inputProps: { min: 0 } }}
                                        />
                                    </Stack>

                                    {/* Dönem: ay seç, yıl otomatik */}
                                    <Stack direction="row" spacing={2} alignItems="flex-start">
                                        <FormControl sx={{ flex: 1 }} error={!!errors.donem}>
                                            <InputLabel id="donem-label">Dönem (Ay)</InputLabel>
                                            <Select
                                                labelId="donem-label"
                                                label="Dönem (Ay)"
                                                value={getMonthFromDonem}
                                                onChange={(e) => {
                                                    const month = String(e.target.value).padStart(2, "0");
                                                    const year = form.tarih ? new Date(form.tarih).getFullYear() : new Date().getFullYear();
                                                    setForm({ ...form, donem: `${year}-${month}` });
                                                }}
                                            >
                                                {monthOptions.map(mo => (
                                                    <MenuItem key={mo.value} value={mo.value}>{mo.value}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <Box sx={{ flex: 1, pt: 1 }}>
                                            <Typography variant="caption" display="block" color="text.secondary">
                                                Seçilen Dönem:
                                            </Typography>
                                            <Chip
                                                label={form.donem || `${yyyy}-${mm}`}
                                                color="info"
                                                variant="outlined"
                                                size="small"
                                                sx={{ fontWeight: 700 }}
                                            />
                                        </Box>
                                    </Stack>


                                    <TextField
                                        label="Kullanıcı Adı"
                                        value={form.kullanici_adi || ""}
                                        onChange={(e) => setForm({ ...form, kullanici_adi: e.target.value })}
                                        InputProps={{ readOnly: !!localUserName, endAdornment: !!localUserName ? <Chip label="Oto." size="small" /> : null }}
                                        error={!!errors.kullanici_adi}
                                        helperText={localUserName ? "LocalStorage'dan otomatik dolduruldu." : (errors.kullanici_adi || "")}
                                    />
                                </Stack>
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button variant="outlined" onClick={() => setDialogOpen(false)} startIcon={<CloseIcon />}>Vazgeç</Button>
                        <Button variant="contained" color="success" onClick={handleSave} startIcon={formMode === "edit" ? <EditIcon /> : <AddIcon />}>
                            {formMode === "edit" ? "Güncelle" : "Kaydet"}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
