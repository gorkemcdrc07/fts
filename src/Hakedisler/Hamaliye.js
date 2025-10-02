// src/Hakedisler/Hamaliye.js
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
    Box, Card, CardContent, CardHeader, Typography, Button, TextField,
    Select, MenuItem, InputLabel, FormControl, Dialog, DialogTitle, DialogContent,
    DialogActions, Chip, Table, TableHead, TableRow, TableCell, TableBody,
    Stack, IconButton, Pagination, Tooltip, CircularProgress, Alert
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
    { key: "created_at", label: "OLUŞTURULMA" },
    { key: "gelir_gider", label: "PRİM/HAMALİYE" },
    { key: "sefer_no", label: "SEFER NO" },
    { key: "plaka", label: "PLAKA" },
    { key: "treyler", label: "TREYLER" },
    { key: "tarih", label: "TARİH" },
    { key: "surucu", label: "SÜRÜCÜ" },
    { key: "yukleme_musteri", label: "YÜKLEME MÜŞTERİ" },
    { key: "fatura_musteri", label: "FATURA MÜŞTERİ" },
    { key: "bolge_palet_sayisi", label: "BÖLGE PALET", numeric: true },
    { key: "odenen_tutar", label: "ÖDENEN TUTAR", numeric: true },
    { key: "palet_sayisi", label: "PALET SAYISI", numeric: true },
    { key: "donem", label: "DÖNEM" },
    { key: "kullanici_adi", label: "KULLANICI ADI" },
];

function formatTRYInput(val) {
    const digits = String(val ?? "").replace(/\D/g, "");
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

    const [form, setForm] = useState({
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
    });
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
        for (const k of required) if (values[k] === undefined || values[k] === "") e[k] = "Zorunlu alan";
        if (values.odenen_tutar != null && Number(values.odenen_tutar) < 0) e.odenen_tutar = "+ olmalı";
        if (values.palet_sayisi != null && Number(values.palet_sayisi) < 0) e.palet_sayisi = "+ olmalı";
        return e;
    }

    function handleEditRow(r) {
        setFormMode("edit");
        setEditingId(r.id);
        setForm({
            tarih: r.tarih || new Date().toISOString().slice(0, 10),
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
            donem: r.donem || (() => {
                const d = new Date();
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                return `${y}-${m}`;
            })(),
            odenen_tutar: r.odenen_tutar ?? 0,
            odenen_tutar_str: r.odenen_tutar ? currencyTRY(r.odenen_tutar) : "",
        });
        setDialogOpen(true);
    }

    async function handleDeleteRow(r) {
        setActionErr("");
        try {
            if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
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
            if (formMode === "edit" && editingId) {
                const { data, error } = await supabase
                    .from("hamaliye")
                    .update(payload)
                    .eq("id", editingId)
                    .select()
                    .single();
                if (error) throw error;

                // state’i güncelle
                setRows((rs) => rs.map((r) => (r.id === editingId ? { ...r, ...data } : r)));
            } else {
                // insert → DB id ve created_at döndürsün
                const { data, error } = await supabase
                    .from("hamaliye")
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;

                setRows((r) => [data, ...r]);
            }

            // kapat & sıfırla
            setDialogOpen(false);
            setFormMode("create");
            setEditingId(null);
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            setForm({
                tarih: d.toISOString().slice(0, 10),
                gelir_gider: "Prim",
                kullanici_adi: localUserName,
                plaka: "",
                treyler: "",
                surucu: "",
                donem: `${y}-${m}`,
                odenen_tutar: 0,
                odenen_tutar_str: "",
                sefer_no: "",
                yukleme_musteri: "",
                fatura_musteri: "",
                bolge_palet_sayisi: 0,
                palet_sayisi: 0,
            });
            setPlateSearch("");
        } catch (err) {
            console.error("Kaydet/Güncelle hatası:", err);
            setActionErr(`Kaydet/Güncelle hatası: ${String(err.message || err)}`);
        }
    }

    function exportCSV() {
        const header = COLUMNS.map((c) => c.label).join(",");
        const body = filtered.map((r) =>
            [
                r.created_at, r.gelir_gider, r.sefer_no, r.plaka, r.treyler,
                r.tarih, r.surucu, r.yukleme_musteri, r.fatura_musteri,
                r.bolge_palet_sayisi, r.odenen_tutar, r.palet_sayisi,
                r.donem, r.kullanici_adi,
            ].map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`).join(",")
        ).join("\n");
        const csv = header + "\n" + body;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `hamaliye_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    }

    const selectedPlateObj =
        plakalar.find(
            (p) =>
                (p.plaka || "").toUpperCase() === (form.plaka || "").toUpperCase() &&
                String(p.treyler || "") === String(form.treyler || "")
        ) || null;

    return (
        <Box sx={{ p: 3 }}>
            {/* Üst */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Hamaliye</Typography>
                    <Typography variant="body2" color="text.secondary">Kayıtlarınızı yönetin, filtreleyin, yeni kayıt ekleyin.</Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCSV}>CSV Dışa Aktar</Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => {
                            setFormMode("create");
                            setEditingId(null);
                            setDialogOpen(true);
                        }}
                    >
                        Yeni Kayıt
                    </Button>
                </Stack>
            </Stack>

            {rowsErr && <Alert severity="error" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{rowsErr}</Alert>}
            {actionErr && <Alert severity="error" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{actionErr}</Alert>}

            {/* Filtreler */}
            <Card variant="outlined" sx={{ mb: 2 }}>
                <CardHeader
                    title={<Stack direction="row" alignItems="center" spacing={1}><FilterListIcon fontSize="small" /><Typography variant="subtitle1">Filtreler</Typography></Stack>}
                    sx={{ pb: 0.5 }}
                />
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <Box sx={{ position: "relative", flex: 1 }}>
                            <TextField
                                fullWidth size="small" placeholder="Tabloda ara (tüm alanlar)"
                                value={globalQuery}
                                onChange={(e) => { setGlobalQuery(e.target.value); setPage(1); }}
                                InputProps={{
                                    startAdornment: <SearchIcon sx={{ mr: 1, opacity: 0.7 }} />,
                                    endAdornment: globalQuery ? (
                                        <Tooltip title="Temizle">
                                            <IconButton size="small" onClick={() => setGlobalQuery("")}><CloseIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                    ) : null,
                                }}
                            />
                        </Box>

                        <TextField label="Başlangıç" type="date" size="small" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
                        <TextField label="Bitiş" type="date" size="small" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />

                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel id="gg-label">Prim/Hamaliye</InputLabel>
                            <Select labelId="gg-label" label="Prim/Hamaliye" value={gelirGider} onChange={(e) => { setGelirGider(e.target.value); setPage(1); }}>
                                <MenuItem value="Hepsi">Hepsi</MenuItem>
                                <MenuItem value="Prim">Prim</MenuItem>
                                <MenuItem value="Hamaliye">Hamaliye</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField label="Dönem (YYYY-AA)" size="small" value={donem === "Hepsi" ? "" : donem} onChange={(e) => { setDonem(e.target.value || "Hepsi"); setPage(1); }} />

                        <Button variant="text" onClick={resetFilters}>Sıfırla</Button>
                    </Stack>
                </CardContent>
            </Card>

            {/* Tablo */}
            <Card>
                <CardHeader
                    title={
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="subtitle1">Kayıtlar</Typography>
                            <Stack direction="row" spacing={2} alignItems="center">
                                {rowsLoading && <CircularProgress size={18} />}
                                <Chip label={`${total} kayıt`} size="small" />
                            </Stack>
                        </Stack>}
                    sx={{ pb: 0 }}
                />
                <CardContent>
                    <Box sx={{ width: "100%", overflow: "auto", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    {COLUMNS.map((c) => (
                                        <TableCell key={c.key} align={c.numeric ? "right" : "left"}>
                                            <Button size="small" variant="text" onClick={() => toggleSort(c.key)}
                                                endIcon={sortKey === c.key ? (sortDir === "asc" ? <ArrowUpwardIcon fontSize="inherit" /> : <ArrowDownwardIcon fontSize="inherit" />) : null}>
                                                {c.label}
                                            </Button>
                                        </TableCell>
                                    ))}
                                    <TableCell align="right">İşlemler</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paged.length === 0 && (
                                    <TableRow><TableCell colSpan={COLUMNS.length + 1} align="center" sx={{ py: 6, color: "text.secondary" }}>
                                        {rowsLoading ? "Yükleniyor…" : "Kayıt bulunamadı."}
                                    </TableCell></TableRow>
                                )}
                                {paged.map((r) => (
                                    <TableRow key={r.id} hover>
                                        <TableCell sx={{ color: "text.secondary" }}>
                                            {r.created_at ? new Date(r.created_at).toLocaleString("tr-TR") : "-"}
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={r.gelir_gider}
                                                size="small"
                                                color={r.gelir_gider === "Prim" ? "success" : "primary"}
                                                variant="filled"
                                            />
                                        </TableCell>

                                        <TableCell>{r.sefer_no}</TableCell>
                                        <TableCell>{(r.plaka || "").toUpperCase()}</TableCell>
                                        <TableCell>{r.treyler || ""}</TableCell>
                                        <TableCell>{r.tarih}</TableCell>
                                        <TableCell>{r.surucu}</TableCell>
                                        <TableCell>{r.yukleme_musteri}</TableCell>
                                        <TableCell>{r.fatura_musteri}</TableCell>
                                        <TableCell align="right">{r.bolge_palet_sayisi}</TableCell>
                                        <TableCell align="right">{currencyTRY(r.odenen_tutar)}</TableCell>
                                        <TableCell align="right">{r.palet_sayisi}</TableCell>
                                        <TableCell>{r.donem}</TableCell>
                                        <TableCell>{r.kullanici_adi}</TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <IconButton size="small" onClick={() => handleEditRow(r)}><EditIcon fontSize="small" /></IconButton>
                                                <IconButton size="small" color="error" onClick={() => handleDeleteRow(r)}><DeleteIcon fontSize="small" /></IconButton>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>

                    {/* Sayfalama */}
                    <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" sx={{ mt: 2 }} spacing={2}>
                        <Typography variant="caption" color="text.secondary">Toplam <b>{total}</b> kayıttan {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} arası gösteriliyor.</Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel id="psize">Sayfa Boyutu</InputLabel>
                                <Select labelId="psize" label="Sayfa Boyutu" value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                                    {[10, 25, 50, 100].map((n) => (<MenuItem key={n} value={String(n)}>{n} / sayfa</MenuItem>))}
                                </Select>
                            </FormControl>
                            <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} shape="rounded" size="small" showFirstButton showLastButton />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            {/* Yeni Kayıt / Düzenle Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>{formMode === "edit" ? "Kaydı Düzenle" : "Yeni Hamaliye Kaydı"}</DialogTitle>
                <DialogContent dividers>
                    {plateErr && <Alert severity="error" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{plateErr}</Alert>}

                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <Button size="small" onClick={() => loadPlates("")}>Plaka listesini yenile</Button>
                    </Stack>

                    <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mt: 1 }}>
                        {/* Sol */}
                        <Stack spacing={2} sx={{ flex: 1 }}>
                            <TextField
                                label="Sefer No"
                                value={form.sefer_no || ""}
                                onChange={(e) => setForm({ ...form, sefer_no: e.target.value })}
                                error={!!errors.sefer_no}
                                helperText={errors.sefer_no}
                            />

                            {/* Plaka - Treyler */}
                            <Autocomplete
                                options={plakalar}
                                loading={plakalarLoading}
                                openOnFocus
                                filterOptions={(options, { inputValue }) => {
                                    const v = (inputValue || "").toLowerCase().trim();
                                    if (!v) return options;
                                    return options.filter(o => {
                                        const p = (o.plaka || "").toLowerCase();
                                        const t = (o.treyler || "").toLowerCase();
                                        const s = (o.surucu_adi || "").toLowerCase();
                                        return p.includes(v) || t.includes(v) || s.includes(v);
                                    });
                                }}
                                value={selectedPlateObj}
                                onChange={(_, val) => {
                                    if (val) {
                                        setForm((f) => ({
                                            ...f,
                                            plaka: (val.plaka || "").toUpperCase(),
                                            treyler: val.treyler || "",
                                            surucu: val.surucu_adi || "",
                                        }));
                                    } else {
                                        setForm((f) => ({ ...f, plaka: "", treyler: "", surucu: "" }));
                                    }
                                }}
                                inputValue={plateSearch}
                                onInputChange={(_, v) => setPlateSearch(v)}
                                getOptionLabel={(opt) =>
                                    opt ? `${(opt.plaka || "").toUpperCase()}${opt.treyler ? " - " + opt.treyler : ""}` : ""
                                }
                                isOptionEqualToValue={(o, v) =>
                                    (o?.plaka || "").toUpperCase() === (v?.plaka || "").toUpperCase() &&
                                    String(o?.treyler || "") === String(v?.treyler || "")
                                }
                                loadingText="Yükleniyor…"
                                noOptionsText="Sonuç bulunamadı"
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Plaka - Treyler"
                                        placeholder="Örn: 34ABC123 veya TR-01"
                                        error={!!errors.plaka || !!errors.treyler}
                                        helperText={plateErr || errors.plaka || errors.treyler || "Seçince sürücü otomatik dolar"}
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {plakalarLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
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
                            <FormControl>
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
                            </FormControl>

                            {/* Ödenen Tutar - canlı ₺ */}
                            <TextField
                                label="Ödenen Tutar"
                                value={form.odenen_tutar_str ?? ""}
                                onChange={(e) => {
                                    const { num, text } = formatTRYInput(e.target.value);
                                    setForm({ ...form, odenen_tutar: num, odenen_tutar_str: text });
                                }}
                                placeholder="₺0"
                                error={!!errors.odenen_tutar}
                                helperText={errors.odenen_tutar}
                            />
                        </Stack>

                        {/* Sağ */}
                        <Stack spacing={2} sx={{ flex: 1 }}>
                            <TextField
                                label="Sürücü"
                                value={form.surucu || ""}
                                onChange={(e) => setForm({ ...form, surucu: e.target.value })}
                                error={!!errors.surucu}
                                helperText={errors.surucu || "Plaka seçildiğinde otomatik doldurulur"}
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
                                />
                                <TextField
                                    label="Palet Sayısı"
                                    type="number"
                                    value={form.palet_sayisi ?? ""}
                                    onChange={(e) => setForm({ ...form, palet_sayisi: Number(e.target.value) })}
                                    error={!!errors.palet_sayisi}
                                    helperText={errors.palet_sayisi}
                                    sx={{ flex: 1 }}
                                />
                            </Stack>

                            {/* Dönem: ay seç, yıl otomatik */}
                            <FormControl>
                                <InputLabel id="donem-label">Dönem (Ay)</InputLabel>
                                <Select
                                    labelId="donem-label"
                                    label="Dönem (Ay)"
                                    value={form.donem ? form.donem.slice(5, 7) : mm}
                                    onChange={(e) => {
                                        const month = String(e.target.value).padStart(2, "0");
                                        const year = new Date().getFullYear();
                                        setForm({ ...form, donem: `${year}-${month}` });
                                    }}
                                >
                                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(mo => (
                                        <MenuItem key={mo} value={mo}>{mo}</MenuItem>
                                    ))}
                                </Select>
                                <Typography variant="caption" sx={{ mt: 0.5 }}>
                                    Seçilen: {form.donem || `${yyyy}-${mm}`}
                                </Typography>
                            </FormControl>

                            <TextField
                                label="Kullanıcı Adı"
                                value={form.kullanici_adi || ""}
                                onChange={(e) => setForm({ ...form, kullanici_adi: e.target.value })}
                                InputProps={{ readOnly: !!localUserName }}
                                error={!!errors.kullanici_adi}
                                helperText={localUserName ? "Otomatik dolduruldu (localStorage)" : (errors.kullanici_adi || "")}
                            />
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Vazgeç</Button>
                    <Button variant="contained" onClick={handleSave}>
                        {formMode === "edit" ? "Güncelle" : "Kaydet"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
