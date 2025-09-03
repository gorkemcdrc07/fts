// src/Hakedisler/AracCariVeFiyat.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

// MUI - Bileşenler
import {
    Box,
    Container,
    Paper,
    Typography,
    TextField,
    InputAdornment,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableContainer,
    TableFooter,
    IconButton,
    Tooltip,
    Chip,
    Stack,
    Checkbox,
    CircularProgress,
    Divider,
    Button,
    Collapse,
    Alert,
} from "@mui/material";

// MUI - Iconlar (tek blok)
import {
    ArrowUpward,
    ArrowDownward,
    ImportExport,
    Edit as EditIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Search as SearchIcon,
    Download as DownloadIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
} from "@mui/icons-material";
// FilterAltIcon'u ayrı default import edin (hata buradan çıkıyordu)
import FilterAltIcon from "@mui/icons-material/FilterAlt";

import ArrowBackIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeIcon from "@mui/icons-material/HomeOutlined";

import { utils as XLSXUtils, writeFile as XLSXWriteFile } from "xlsx";

/* ===================== Helpers ===================== */
function formatTL(value) {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return num.toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2,
    });
}
function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString("tr-TR");
}
// 1.234,56 / 1234.56 -> Number
function toNumberLoose(v) {
    if (v === "" || v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    const s = String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
}
function parseTLToNumber(v) {
    if (v === "" || v === null || v === undefined) return null;
    const s = String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
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
function addThousandDots(intStr) {
    const normalized = intStr.replace(/^0+(?=\d)/, "");
    return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* ===================== Component ===================== */
export default function AracCariVeFiyat() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [savingId, setSavingId] = useState(null);

    const [editingId, setEditingId] = useState(null); // "PLAKA-CARIID"
    const [editingKey, setEditingKey] = useState(null); // { plaka, cari_id }
    const [editData, setEditData] = useState({});

    const [query, setQuery] = useState("");
    const [sortBy, setSortBy] = useState({ key: "plaka", dir: "asc" });
    const [onlyActive, setOnlyActive] = useState(false);

    // Yeni kayıt formu
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({
        plaka: "",
        cari_id: "",
        cari_adi: "",
        arac_sahip: "",
        aylik_kira: "",
        aylik_surucu: "",
        calisma_gunu: "",
        pasif: false,
        aciklama: "",
    });
    const [addError, setAddError] = useState(null);
    const [adding, setAdding] = useState(false);

    const navigate = useNavigate();

    const refetch = async () => {
        setLoading(true);
        setErr(null);
        const { data, error } = await supabase.from("arac_cari_ve_fiyat").select("*");
        if (error) setErr(error.message || "Veri çekilemedi");
        else setRows(data || []);
        setLoading(false);
    };

    useEffect(() => {
        let ignore = false;
        const run = async () => {
            setLoading(true);
            setErr(null);
            const { data, error } = await supabase.from("arac_cari_ve_fiyat").select("*");
            if (!ignore) {
                if (error) setErr(error.message || "Veri çekilemedi");
                else setRows(data || []);
                setLoading(false);
            }
        };
        run();
        return () => {
            ignore = true;
        };
    }, []);

    /* --------- Filter / Sort --------- */
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = rows;
        if (q) {
            list = list.filter(
                (r) =>
                    (r.plaka || "").toLowerCase().includes(q) ||
                    (r.cari_adi || "").toLowerCase().includes(q) ||
                    (r.arac_sahip || "").toLowerCase().includes(q) ||
                    String(r.cari_id || "").toLowerCase().includes(q)
            );
        }
        if (onlyActive) {
            list = list.filter((r) => !r.pasif);
        }
        return list;
    }, [rows, query, onlyActive]);

    const sorted = useMemo(() => {
        const copy = [...filtered];
        const { key, dir } = sortBy;
        copy.sort((a, b) => {
            const va = a?.[key];
            const vb = b?.[key];

            const numericKeys = new Set([
                "aylik_kira",
                "aylik_surucu",
                "calisma_gunu",
                "cari_id",
                "toplam_tutar",
            ]);

            if (key === "toplam_tutar") {
                const na = toNumberLoose(a?.aylik_kira) + toNumberLoose(a?.aylik_surucu);
                const nb = toNumberLoose(b?.aylik_kira) + toNumberLoose(b?.aylik_surucu);
                return dir === "asc" ? na - nb : nb - na;
            }

            if (numericKeys.has(key)) {
                const na = Number(toNumberLoose(va));
                const nb = Number(toNumberLoose(vb));
                return dir === "asc" ? na - nb : nb - na;
            }

            if (key === "duzenleme_yapilan_tarih") {
                const da = va ? new Date(va).getTime() : 0;
                const db = vb ? new Date(vb).getTime() : 0;
                return dir === "asc" ? da - db : db - da;
            }

            const sa = (va ?? "").toString().toLowerCase();
            const sb = (vb ?? "").toString().toLowerCase();
            if (sa < sb) return dir === "asc" ? -1 : 1;
            if (sa > sb) return dir === "asc" ? 1 : -1;
            return 0;
        });
        return copy;
    }, [filtered, sortBy]);

    const toggleSort = (key) => {
        setSortBy((prev) =>
            prev.key !== key ? { key, dir: "asc" } : { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        );
    };

    /* --------- Totals (footer) --------- */
    const totals = useMemo(() => {
        const sumKira = sorted.reduce((acc, r) => acc + toNumberLoose(r.aylik_kira), 0);
        const sumSurucu = sorted.reduce((acc, r) => acc + toNumberLoose(r.aylik_surucu), 0);
        return {
            kira: sumKira,
            surucu: sumSurucu,
            toplam: sumKira + sumSurucu,
        };
    }, [sorted]);

    /* --------- Edit Handlers --------- */
    const startEdit = (row) => {
        setEditingId(`${row.plaka}-${row.cari_id}`);
        setEditingKey({ plaka: row.plaka, cari_id: row.cari_id });
        setEditData({ ...row });
    };
    const cancelEdit = () => {
        setEditingId(null);
        setEditingKey(null);
        setEditData({});
    };

    // Yalnızca ÇALIŞMA_GÜNÜ güncellenir (diğerleri kilitli)
    const saveEdit = async () => {
        const payload = {
            calisma_gunu: parseTLToNumber(editData.calisma_gunu),
            duzenleme_yapan_kullanici: "Admin",
            duzenleme_yapilan_tarih: new Date().toISOString(),
        };
        setSavingId(editingId);
        const { error } = await supabase
            .from("arac_cari_ve_fiyat")
            .update(payload)
            .eq("plaka", editingKey.plaka)
            .eq("cari_id", editingKey.cari_id);

        if (error) {
            alert("Kaydetme hatası: " + error.message);
        } else {
            setRows((prev) =>
                prev.map((r) =>
                    r.plaka === editingKey.plaka && r.cari_id === editingKey.cari_id
                        ? { ...r, ...payload, plaka: r.plaka }
                        : r
                )
            );
            cancelEdit();
        }
        setSavingId(null);
    };

    /* --------- Yeni Kayıt Ekle --------- */
    const handleAddChange = (key, value) => {
        setAddForm((p) => ({ ...p, [key]: value }));
    };
    const addNew = async () => {
        setAddError(null);

        if (!addForm.plaka?.trim()) return setAddError("Plaka zorunludur.");
        if (!addForm.cari_id?.trim()) return setAddError("Cari ID zorunludur.");

        const payload = {
            plaka: addForm.plaka.trim(),
            cari_id: parseTLToNumber(addForm.cari_id),
            cari_adi: addForm.cari_adi?.trim() || null,
            arac_sahip: addForm.arac_sahip?.trim() || null,
            aylik_kira: parseTLToNumber(addForm.aylik_kira),
            aylik_surucu: parseTLToNumber(addForm.aylik_surucu),
            calisma_gunu: parseTLToNumber(addForm.calisma_gunu),
            pasif: !!addForm.pasif,
            aciklama: addForm.aciklama?.trim() || null,
            duzenleme_yapan_kullanici: "Admin",
            duzenleme_yapilan_tarih: new Date().toISOString(),
        };

        setAdding(true);
        const { error } = await supabase.from("arac_cari_ve_fiyat").insert([payload]);
        setAdding(false);

        if (error) {
            setAddError(error.message || "Kayıt eklenemedi.");
            return;
        }

        setAddForm({
            plaka: "",
            cari_id: "",
            cari_adi: "",
            arac_sahip: "",
            aylik_kira: "",
            aylik_surucu: "",
            calisma_gunu: "",
            pasif: false,
            aciklama: "",
        });
        await refetch();
        setShowAdd(false);
    };

    /* --------- Excel Export --------- */
    const exportToExcel = () => {
        const data = sorted.map((r) => ({
            Plaka: r.plaka ?? "",
            "Cari ID": r.cari_id ?? "",
            "Cari Adı": r.cari_adi ?? "",
            "Araç Sahibi": r.arac_sahip ?? "",
            "Aylık Kira": toNumberLoose(r.aylik_kira),
            "Aylık Sürücü": toNumberLoose(r.aylik_surucu),
            "Toplam Tutar": toNumberLoose(r.aylik_kira) + toNumberLoose(r.aylik_surucu),
            "Çalışma Günü": r.calisma_gunu ?? "",
            Pasif: r.pasif ? "Evet" : "Hayır",
            Açıklama: r.aciklama ?? "",
            Düzenleyen: r.duzenleme_yapan_kullanici ?? "",
            "Düzenleme Tarihi": r.duzenleme_yapilan_tarih ? formatDate(r.duzenleme_yapilan_tarih) : "",
        }));

        data.push({});
        data.push({
            Plaka: "TOPLAM (filtrelenmiş):",
            "Cari ID": "",
            "Cari Adı": "",
            "Araç Sahibi": "",
            "Aylık Kira": totals.kira,
            "Aylık Sürücü": totals.surucu,
            "Toplam Tutar": totals.toplam,
            "Çalışma Günü": "",
            Pasif: "",
            Açıklama: "",
            Düzenleyen: "",
            "Düzenleme Tarihi": "",
        });

        const ws = XLSXUtils.json_to_sheet(data, { skipHeader: false });
        ws["!cols"] = [
            { wch: 12 },
            { wch: 10 },
            { wch: 28 },
            { wch: 20 },
            { wch: 14 },
            { wch: 14 },
            { wch: 14 },
            { wch: 14 },
            { wch: 8 },
            { wch: 30 },
            { wch: 14 },
            { wch: 20 },
        ];
        const wb = XLSXUtils.book_new();
        XLSXUtils.book_append_sheet(wb, ws, "AraçCariFiyat");
        XLSXWriteFile(wb, `arac_cari_fiyat_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    /* --------- UI bits --------- */
    const SortIcon = ({ col }) => {
        if (sortBy.key !== col) return <ImportExport fontSize="inherit" sx={{ opacity: 0.6 }} />;
        return sortBy.dir === "asc" ? <ArrowUpward fontSize="inherit" /> : <ArrowDownward fontSize="inherit" />;
    };

    const headerCell = (label, key, props = {}) => (
        <TableCell
            sx={{ whiteSpace: "nowrap", fontWeight: 800, cursor: "pointer" }}
            onClick={() => toggleSort(key)}
            title={`${label} - sırala`}
            {...props}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                <span>{label}</span>
                <SortIcon col={key} />
            </Stack>
        </TableCell>
    );

    return (
        <Box
            sx={{
                minHeight: "100dvh",
                py: 4,
                px: { xs: 1, md: 2 },
                background: (t) =>
                    t.palette.mode === "dark"
                        ? `linear-gradient(180deg, ${t.palette.background.default} 0%, ${t.palette.background.paper} 100%)`
                        : "linear-gradient(180deg, #f5f7fb 0%, #ffffff 100%)",
            }}
        >
            <Container maxWidth="xl">
                <Paper
                    elevation={8}
                    sx={{
                        borderRadius: 4,
                        overflow: "hidden",
                        backdropFilter: "blur(6px)",
                        border: (t) => `1px solid ${t.palette.divider}`,
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            p: 3,
                            background: (t) =>
                                t.palette.mode === "dark"
                                    ? t.palette.background.default
                                    : "linear-gradient(135deg, #eef3ff 0%, #ffffff 60%)",
                        }}
                    >
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            alignItems={{ xs: "start", sm: "center" }}
                            justifyContent="space-between"
                            spacing={2}
                        >
                            <Stack spacing={0.5}>
                                <Typography variant="h5" fontWeight={900}>
                                    Araç Cari & Fiyat
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                    {loading && (
                                        <Chip
                                            label="Yükleniyor…"
                                            color="info"
                                            variant="outlined"
                                            icon={<CircularProgress size={14} />}
                                        />
                                    )}
                                    {err && <Chip label={`Hata: ${err}`} color="error" variant="outlined" />}
                                    {!loading && !err && <Chip label={`Toplam: ${sorted.length}`} variant="outlined" />}
                                    {onlyActive && <Chip color="success" label="Sadece Aktif" size="small" />}
                                </Stack>
                            </Stack>

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <TextField
                                    size="small"
                                    placeholder="Plaka, Araç Sahibi, Cari Adı veya Cari ID ara…"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    sx={{ minWidth: { xs: "100%", sm: 340 } }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ opacity: 0.7 }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <Button
                                    variant={onlyActive ? "contained" : "outlined"}
                                    color="success"
                                    startIcon={<FilterAltIcon />}
                                    onClick={() => setOnlyActive((v) => !v)}
                                >
                                    Aktif
                                </Button>
                                <Button variant="outlined" color="primary" startIcon={<RefreshIcon />} onClick={refetch}>
                                    Yenile
                                </Button>
                                <Button variant="contained" color="primary" startIcon={<DownloadIcon />} onClick={exportToExcel}>
                                    Excel’e Aktar
                                </Button>
                                <Button
                                    variant={showAdd ? "contained" : "outlined"}
                                    color="secondary"
                                    startIcon={<AddIcon />}
                                    onClick={() => setShowAdd((v) => !v)}
                                >
                                    Yeni Kayıt
                                </Button>
                                <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
                                    Geri
                                </Button>
                                <Button variant="text" startIcon={<HomeIcon />} onClick={() => navigate("/")}>
                                    Anasayfa
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>

                    {/* Yeni Kayıt Formu */}
                    <Collapse in={showAdd}>
                        <Divider />
                        <Box sx={{ px: 3, py: 2, bgcolor: (t) => (t.palette.mode === "dark" ? "background.default" : "#f8faff") }}>
                            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                                Yeni Kayıt Ekle
                            </Typography>

                            <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap">
                                <TextField
                                    label="Plaka *"
                                    value={addForm.plaka}
                                    onChange={(e) => handleAddChange("plaka", e.target.value.toUpperCase())}
                                    size="small"
                                />
                                <TextField
                                    label="Cari ID *"
                                    value={addForm.cari_id}
                                    onChange={(e) => handleAddChange("cari_id", e.target.value)}
                                    size="small"
                                    inputMode="numeric"
                                />
                                <TextField
                                    label="Cari Adı"
                                    value={addForm.cari_adi}
                                    onChange={(e) => handleAddChange("cari_adi", e.target.value)}
                                    size="small"
                                    sx={{ minWidth: 220 }}
                                />
                                <TextField
                                    label="Araç Sahibi"
                                    value={addForm.arac_sahip}
                                    onChange={(e) => handleAddChange("arac_sahip", e.target.value)}
                                    size="small"
                                    sx={{ minWidth: 200 }}
                                />
                                <TextField
                                    label="Aylık Kira"
                                    value={addForm.aylik_kira}
                                    onChange={(e) => handleAddChange("aylik_kira", formatTLForTyping(e.target.value))}
                                    size="small"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                />
                                <TextField
                                    label="Aylık Sürücü"
                                    value={addForm.aylik_surucu}
                                    onChange={(e) => handleAddChange("aylik_surucu", formatTLForTyping(e.target.value))}
                                    size="small"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                />
                                <TextField
                                    label="Çalışma Günü"
                                    value={addForm.calisma_gunu}
                                    onChange={(e) => handleAddChange("calisma_gunu", e.target.value)}
                                    size="small"
                                    inputMode="numeric"
                                />
                                <TextField
                                    label="Açıklama"
                                    value={addForm.aciklama}
                                    onChange={(e) => handleAddChange("aciklama", e.target.value)}
                                    size="small"
                                    sx={{ minWidth: 240 }}
                                />
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Checkbox
                                        checked={addForm.pasif}
                                        onChange={(e) => handleAddChange("pasif", e.target.checked)}
                                    />
                                    <Typography>Pasif</Typography>
                                </Stack>
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    startIcon={<AddIcon />}
                                    onClick={addNew}
                                    disabled={adding}
                                >
                                    {adding ? "Ekleniyor..." : "Ekle"}
                                </Button>
                            </Stack>

                            {addError && (
                                <Alert severity="error" sx={{ mt: 2 }}>
                                    {addError}
                                </Alert>
                            )}
                        </Box>
                    </Collapse>

                    <Divider />

                    {/* Table */}
                    <TableContainer
                        sx={{
                            maxHeight: "70vh",
                            "& .MuiTableCell-root": { borderBottomColor: "divider" },
                        }}
                    >
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow
                                    sx={{
                                        "& th": {
                                            bgcolor: (t) => (t.palette.mode === "dark" ? t.palette.background.default : "#f7f9ff"),
                                        },
                                    }}
                                >
                                    {headerCell("Plaka", "plaka")}
                                    {headerCell("Cari ID", "cari_id")}
                                    {headerCell("Cari Adı", "cari_adi")}
                                    {headerCell("Araç Sahibi", "arac_sahip")}
                                    {headerCell("Aylık Kira", "aylik_kira", { align: "right" })}
                                    {headerCell("Aylık Sürücü", "aylik_surucu", { align: "right" })}
                                    {headerCell("Toplam Tutar", "toplam_tutar", { align: "right" })}
                                    {headerCell("Çalışma Günü", "calisma_gunu", { align: "center" })}
                                    {headerCell("Pasif", "pasif", { align: "center" })}
                                    {headerCell("Açıklama", "aciklama")}
                                    <TableCell sx={{ fontWeight: 800 }}>İşlem</TableCell>
                                    {headerCell("Düzenleyen", "duzenleme_yapan_kullanici")}
                                    {headerCell("Düzenleme Tarihi", "duzenleme_yapilan_tarih")}
                                </TableRow>
                            </TableHead>

                            <TableBody
                                sx={{
                                    "& tr:nth-of-type(odd)": {
                                        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#fafbff"),
                                    },
                                }}
                            >
                                {sorted.map((r, i) => {
                                    const isEditing = editingId === `${r.plaka}-${r.cari_id}`;
                                    const rowKey = `${r.plaka}-${r.cari_id}-${i}`;
                                    const toplamTutar = toNumberLoose(r.aylik_kira) + toNumberLoose(r.aylik_surucu);

                                    return (
                                        <TableRow
                                            key={rowKey}
                                            hover
                                            selected={isEditing}
                                            sx={{
                                                "&.Mui-selected": {
                                                    backgroundColor: (t) => t.palette.action.selected,
                                                },
                                            }}
                                        >
                                            {/* plaka - KİLİT */}
                                            <TableCell title={r.plaka} sx={{ fontWeight: 700 }}>
                                                {r.plaka}
                                            </TableCell>

                                            {/* cari_id - KİLİT */}
                                            <TableCell>{r.cari_id}</TableCell>

                                            {/* cari_adi - KİLİT */}
                                            <TableCell title={r.cari_adi} sx={{ maxWidth: 320 }}>
                                                <Typography noWrap>{r.cari_adi}</Typography>
                                            </TableCell>

                                            {/* arac_sahip - KİLİT */}
                                            <TableCell title={r.arac_sahip ?? ""} sx={{ maxWidth: 240 }}>
                                                <Typography noWrap>{r.arac_sahip}</Typography>
                                            </TableCell>

                                            {/* aylik_kira - KİLİT */}
                                            <TableCell align="right" title={String(r.aylik_kira ?? "")}>
                                                {formatTL(toNumberLoose(r.aylik_kira))}
                                            </TableCell>

                                            {/* aylik_surucu - KİLİT */}
                                            <TableCell align="right" title={String(r.aylik_surucu ?? "")}>
                                                {formatTL(toNumberLoose(r.aylik_surucu))}
                                            </TableCell>

                                            {/* toplam_tutar (hesap) */}
                                            <TableCell align="right" title={String(toplamTutar)}>
                                                {formatTL(toplamTutar)}
                                            </TableCell>

                                            {/* calisma_gunu - TEK DÜZENLENEBİLEN */}
                                            <TableCell align="center" title={String(r.calisma_gunu ?? "")}>
                                                {isEditing ? (
                                                    <TextField
                                                        value={editData.calisma_gunu ?? ""}
                                                        onChange={(e) => setEditData((prev) => ({ ...prev, calisma_gunu: e.target.value }))}
                                                        size="small"
                                                        inputMode="numeric"
                                                        sx={{ width: 90 }}
                                                    />
                                                ) : (
                                                    r.calisma_gunu ?? ""
                                                )}
                                            </TableCell>

                                            {/* pasif - KİLİT */}
                                            <TableCell align="center">
                                                <Checkbox checked={!!r.pasif} disabled />
                                            </TableCell>

                                            {/* aciklama - KİLİT */}
                                            <TableCell title={r.aciklama ?? ""} sx={{ maxWidth: 340 }}>
                                                <Typography noWrap>{r.aciklama}</Typography>
                                            </TableCell>

                                            {/* işlem */}
                                            <TableCell>
                                                {isEditing ? (
                                                    <Stack direction="row" spacing={1}>
                                                        <Tooltip title="Kaydet">
                                                            <span>
                                                                <IconButton
                                                                    color="primary"
                                                                    onClick={saveEdit}
                                                                    disabled={savingId === editingId}
                                                                    size="small"
                                                                >
                                                                    <CheckIcon />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                        <Tooltip title="İptal">
                                                            <span>
                                                                <IconButton
                                                                    color="inherit"
                                                                    onClick={cancelEdit}
                                                                    disabled={savingId === editingId}
                                                                    size="small"
                                                                >
                                                                    <CloseIcon />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    </Stack>
                                                ) : (
                                                    <Tooltip title="Sadece Çalışma Günü düzenlenebilir">
                                                        <span>
                                                            <IconButton onClick={() => startEdit(r)} size="small">
                                                                <EditIcon />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                )}
                                            </TableCell>

                                            {/* düzenleyen / tarih */}
                                            <TableCell title={r.duzenleme_yapan_kullanici ?? ""}>
                                                {r.duzenleme_yapan_kullanici}
                                            </TableCell>
                                            <TableCell title={formatDate(r.duzenleme_yapilan_tarih)}>
                                                {formatDate(r.duzenleme_yapilan_tarih)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}

                                {!loading && !err && sorted.length === 0 && (
                                    <TableRow>
                                        {/* 13 kolon */}
                                        <TableCell colSpan={13} align="center" sx={{ py: 4, color: "text.secondary" }}>
                                            Kayıt bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>

                            {/* ---- FOOTER TOTALS ---- */}
                            <TableFooter>
                                <TableRow
                                    sx={{
                                        "& td": {
                                            fontWeight: 800,
                                            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#f0f4ff"),
                                            borderTop: (t) => `2px solid ${t.palette.divider}`,
                                        },
                                    }}
                                >
                                    <TableCell colSpan={4}>Toplam (filtrelenmiş veride)</TableCell>
                                    <TableCell align="right">{formatTL(totals.kira)}</TableCell>
                                    <TableCell align="right">{formatTL(totals.surucu)}</TableCell>
                                    <TableCell align="right">{formatTL(totals.toplam)}</TableCell>
                                    <TableCell align="center">—</TableCell>
                                    <TableCell align="center">—</TableCell>
                                    <TableCell colSpan={4}> </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </TableContainer>
                </Paper>
            </Container>
        </Box>
    );
}
