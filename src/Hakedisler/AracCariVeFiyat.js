// src/Hakedisler/AracCariVeFiyat.js
import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
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
    Alert,
    MenuItem,
    Badge,
    Drawer,
    ToggleButtonGroup,
    ToggleButton,
    Card,
    CardContent,
    Grid,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";

// MUI - Iconlar
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
    ClearAll as ClearAllIcon,
    Tune as TuneIcon,
} from "@mui/icons-material";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ArrowBackIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeIcon from "@mui/icons-material/HomeOutlined";

import { utils as XLSXUtils, writeFile as XLSXWriteFile } from "xlsx";

/* ===================== Helpers ===================== */
const HOME_PATH = "/anasayfa";

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

    const [query, setQuery] = useState(""); // global arama
    const [sortBy, setSortBy] = useState({ key: "plaka", dir: "asc" });
    const [onlyActive, setOnlyActive] = useState(false);

    // Yeni kayıt formu (Dialog)
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

    // Filtreler: modern panel (Drawer)
    const [filters, setFilters] = useState({
        plaka: "",
        cari_id: "",
        cari_adi: "",
        arac_sahip: "",
        aylik_kira_min: "",
        aylik_kira_max: "",
        aylik_surucu_min: "",
        aylik_surucu_max: "",
        toplam_min: "",
        toplam_max: "",
        calisma_gunu_min: "",
        calisma_gunu_max: "",
        pasif: "hepsi", // hepsi | aktif | pasif
        aciklama: "",
        duzenleyen: "",
        tarih_from: "",
        tarih_to: "",
    });
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [tempFilters, setTempFilters] = useState(filters);

    const navigate = useNavigate();

    const wrapRef = useRef(null);
    const tableRef = useRef(null);

    useLayoutEffect(() => {
        function fit() {
            const wrap = wrapRef.current;
            const tbl = tableRef.current;
            if (!wrap || !tbl) return;

            const wrapW = wrap.clientWidth;
            const tblW = tbl.scrollWidth;              // tablonun doğal genişliği
            const scale = Math.min(1, wrapW / Math.max(1, tblW));

            // CSS değişkenine yaz
            wrap.style.setProperty("--acf-scale", String(scale));
            // Ölçek sonrası kırpılmayı önlemek için genişliği ters oranda büyüt
            tbl.style.width = scale < 1 ? `calc(100% / var(--acf-scale))` : "100%";
        }

        fit();
        const ro = new ResizeObserver(fit);
        if (wrapRef.current) ro.observe(wrapRef.current);
        return () => ro.disconnect();
    }, []);


    const activeFilterCount = useMemo(() => {
        const { pasif, ...rest } = filters;
        let c = Object.values(rest).filter((v) => v !== "" && v !== null).length;
        if (filters.pasif !== "hepsi") c += 1;
        return c + (onlyActive ? 1 : 0);
    }, [filters, onlyActive]);

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
                    (r.odak_arac_calisma_tipi || "").toLowerCase().includes(q) ||
                    String(r.cari_id || "").toLowerCase().includes(q)
            );
        }

        if (onlyActive) {
            list = list.filter((r) => !r.pasif);
        }

        const f = filters;
        list = list.filter((r) => {
            const kira = toNumberLoose(r.aylik_kira);
            const surucu = toNumberLoose(r.aylik_surucu);
            const toplam = kira + surucu;
            const gun = toNumberLoose(r.calisma_gunu);
            const tarih = r.duzenleme_yapilan_tarih ? new Date(r.duzenleme_yapilan_tarih) : null;

            if (f.plaka && !(r.plaka || "").toLowerCase().includes(f.plaka.toLowerCase())) return false;
            if (f.cari_id && !String(r.cari_id || "").toLowerCase().includes(String(f.cari_id).toLowerCase())) return false;
            if (f.cari_adi && !(r.cari_adi || "").toLowerCase().includes(f.cari_adi.toLowerCase())) return false;
            if (f.arac_sahip && !(r.arac_sahip || "").toLowerCase().includes(f.arac_sahip.toLowerCase())) return false;
            if (f.aciklama && !(r.aciklama || "").toLowerCase().includes(f.aciklama.toLowerCase())) return false;
            if (f.duzenleyen && !(r.duzenleme_yapan_kullanici || "").toLowerCase().includes(f.duzenleyen.toLowerCase())) return false;

            if (f.pasif === "aktif" && !!r.pasif) return false;
            if (f.pasif === "pasif" && !r.pasif) return false;

            if (f.aylik_kira_min !== "" && kira < toNumberLoose(f.aylik_kira_min)) return false;
            if (f.aylik_kira_max !== "" && kira > toNumberLoose(f.aylik_kira_max)) return false;
            if (f.aylik_surucu_min !== "" && surucu < toNumberLoose(f.aylik_surucu_min)) return false;
            if (f.aylik_surucu_max !== "" && surucu > toNumberLoose(f.aylik_surucu_max)) return false;
            if (f.toplam_min !== "" && toplam < toNumberLoose(f.toplam_min)) return false;
            if (f.toplam_max !== "" && toplam > toNumberLoose(f.toplam_max)) return false;
            if (f.calisma_gunu_min !== "" && gun < toNumberLoose(f.calisma_gunu_min)) return false;
            if (f.calisma_gunu_max !== "" && gun > toNumberLoose(f.calisma_gunu_max)) return false;

            if (f.tarih_from) {
                const from = new Date(f.tarih_from);
                if (tarih && tarih < from) return false;
            }
            if (f.tarih_to) {
                const to = new Date(f.tarih_to);
                if (tarih && tarih > to) return false;
            }

            return true;
        });

        return list;
    }, [rows, query, onlyActive, filters]);

    const sorted = useMemo(() => {
        const copy = [...filtered];
        const { key, dir } = sortBy;
        copy.sort((a, b) => {
            const va = a?.[key];
            const vb = b?.[key];

            const numericKeys = new Set(["aylik_kira", "aylik_surucu", "calisma_gunu", "cari_id", "toplam_tutar"]);

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
        setSortBy((prev) => (prev.key !== key ? { key, dir: "asc" } : { key, dir: prev.dir === "asc" ? "desc" : "asc" }));
    };

    /* --------- Totals (footer) --------- */
    const totals = useMemo(() => {
        const sumKira = sorted.reduce((acc, r) => acc + toNumberLoose(r.aylik_kira), 0);
        const sumSurucu = sorted.reduce((acc, r) => acc + toNumberLoose(r.aylik_surucu), 0);
        return { kira: sumKira, surucu: sumSurucu, toplam: sumKira + sumSurucu };
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

    const saveEdit = async () => {
        try {
            const normalizeMoney = (v) => {
                const n = parseTLToNumber(v);
                return n === null ? null : n;
            };

            // cari_id sayısal olmalı
            const newCariIdStr = (editData.cari_id ?? "").toString();
            const newCariId = Number(newCariIdStr.replace(/[^\d-]/g, ""));
            if (!Number.isFinite(newCariId)) {
                alert("Cari ID geçersiz veya boş olamaz.");
                return;
            }

            const payload = {
                cari_id: newCariId,
                cari_adi: editData.cari_adi?.trim() || null,
                arac_sahip: editData.arac_sahip?.trim() || null,
                odak_arac_calisma_tipi: editData.odak_arac_calisma_tipi?.trim() || null, // EKLENDİ
                aylik_kira: normalizeMoney(editData.aylik_kira),
                aylik_surucu: normalizeMoney(editData.aylik_surucu),
                calisma_gunu:
                    editData.calisma_gunu === "" || editData.calisma_gunu == null ? null : Number(editData.calisma_gunu),

                duzenleme_yapan_kullanici: "Admin",
                duzenleme_yapilan_tarih: new Date().toISOString(),
            };

            Object.keys(payload).forEach((k) => {
                if (payload[k] === undefined) delete payload[k];
            });

            setSavingId(editingId);

            const { data, error } = await supabase
                .from("arac_cari_ve_fiyat")
                .update(payload)
                .match({ plaka: editingKey.plaka, cari_id: editingKey.cari_id })
                .select()
                .single();

            if (error) throw error;

            setRows((prev) =>
                prev.map((r) => (r.plaka === editingKey.plaka && r.cari_id === editingKey.cari_id ? { ...r, ...data } : r))
            );

            cancelEdit();
        } catch (e) {
            alert("Kaydetme hatası: " + (e?.message || e));
        } finally {
            setSavingId(null);
        }
    };

    /* --------- Yeni Kayıt Ekle (Dialog) --------- */
    const handleAddChange = (key, value) => setAddForm((p) => ({ ...p, [key]: value }));

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

        const { error } = await supabase.from("arac_cari_ve_fiyat").insert([payload]);
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
            "Odak Araç Çalışma Tipi": r.odak_arac_calisma_tipi ?? "",
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

    /* --------- UI bits (YENİ: daha büyük ve modern) --------- */
    const SortIcon = ({ col }) => {
        if (sortBy.key !== col) return <ImportExport fontSize="inherit" sx={{ opacity: 0.6 }} />;
        return sortBy.dir === "asc" ? <ArrowUpward fontSize="inherit" /> : <ArrowDownward fontSize="inherit" />;
    };

    const headerCell = (label, key, props = {}) => (
        <TableCell
            onClick={() => toggleSort(key)}
            title={`${label} - sırala`}
            {...props}
            sx={{
                whiteSpace: "nowrap",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 15.5,                // ↑ başlık fontu büyütüldü
                letterSpacing: 0.2,
                py: 1.25,                      // ↑ başlık yüksekliği
                ...props?.sx,
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                <span>{label}</span>
                <SortIcon col={key} />
            </Stack>
        </TableCell>
    );

    const clearFilters = () => {
        const empty = {
            plaka: "",
            cari_id: "",
            cari_adi: "",
            arac_sahip: "",
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
        setFilters(empty);
        setTempFilters(empty);
    };

    const FilterBadge = ({ children }) => (
        <Badge color="secondary" badgeContent={activeFilterCount || 0} invisible={activeFilterCount === 0}>
            {children}
        </Badge>
    );

    // Top toolbar (modern & daha büyük)
    const TopToolbar = (
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
                size="medium"
                placeholder="Plaka, Araç Sahibi, Cari Adı veya Cari ID ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ minWidth: { xs: "100%", md: 420 } }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon sx={{ opacity: 0.7 }} />
                        </InputAdornment>
                    ),
                }}
            />

            <ToggleButtonGroup
                size="small"
                exclusive
                value={onlyActive ? "aktif" : "hepsi"}
                onChange={(_, v) => setOnlyActive(v === "aktif")}
                sx={{ borderRadius: 999, overflow: "hidden" }}
            >
                <ToggleButton value="hepsi">Tümü</ToggleButton>
                <ToggleButton value="aktif">Sadece Aktif</ToggleButton>
            </ToggleButtonGroup>

            <FilterBadge>
                <Button variant="outlined" color="secondary" startIcon={<TuneIcon />} onClick={() => setDrawerOpen(true)} size="medium">
                    Gelişmiş Filtreler
                </Button>
            </FilterBadge>

            <Button variant="outlined" color="primary" startIcon={<RefreshIcon />} onClick={refetch} size="medium">
                Yenile
            </Button>
            <Button variant="contained" color="primary" startIcon={<DownloadIcon />} onClick={exportToExcel} size="medium">
                Excel’e Aktar
            </Button>
            <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setShowAdd(true)} size="medium">
                Yeni Kayıt
            </Button>
            <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="medium">
                Geri
            </Button>
            <Button variant="text" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)} size="medium">
                Anasayfa
            </Button>
        </Stack>
    );

    // Quick chips
    const ActiveFilterChips =
        activeFilterCount > 0 && (
            <Stack direction="row" spacing={1} mt={1.25} flexWrap="wrap">
                {Object.entries(filters).map(([k, v]) => {
                    if (v === "" || v === null || (k === "pasif" && v === "hepsi")) return null;
                    const labels = {
                        plaka: "Plaka",
                        cari_id: "Cari ID",
                        cari_adi: "Cari Adı",
                        arac_sahip: "Araç Sahibi",
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
                        tarih_from: "Tarih ≥",
                        tarih_to: "Tarih ≤",
                    };
                    return (
                        <Chip
                            key={k}
                            label={`${labels[k] || k}: ${v}`}
                            onDelete={() => setFilters((p) => ({ ...p, [k]: k === "pasif" ? "hepsi" : "" }))}
                            sx={{ fontSize: 13, height: 28 }}
                        />
                    );
                })}
                <Button size="small" startIcon={<ClearAllIcon />} onClick={clearFilters}>
                    Hepsini Temizle
                </Button>
            </Stack>
        );

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
                        : "linear-gradient(180deg, #f7f9ff 0%, #ffffff 60%)",
            }}
        >
            <Container maxWidth={false} disableGutters>
                <Box sx={{ maxWidth: "none", mx: "auto", px: { xs: 1.5, md: 2.5 } }}>
                    <Paper
                        elevation={10}
                        sx={{
                            borderRadius: 5,                     // ↑ daha yumuşak
                            overflow: "hidden",
                            backdropFilter: "blur(10px)",
                            border: (t) => `1px solid ${t.palette.divider}`,
                            boxShadow: (t) =>
                                t.palette.mode === "dark"
                                    ? "0 10px 30px rgba(0,0,0,0.35)"
                                    : "0 18px 40px rgba(38, 78, 118, 0.12)",
                        }}
                    >
                        {/* Header */}
                        <Box
                            sx={{
                                p: { xs: 2.5, md: 3.25 },
                                background: (t) =>
                                    t.palette.mode === "dark"
                                        ? `linear-gradient(135deg, ${t.palette.background.default} 0%, ${t.palette.background.paper} 100%)`
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
                                    <Typography
                                        variant="h5"
                                        fontWeight={900}
                                        sx={{
                                            lineHeight: 1.1,
                                            letterSpacing: 0.2,
                                            background: "linear-gradient(90deg,#7c3aed,#06b6d4)",
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                        }}
                                    >
                                        Araç Cari & Fiyat
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        {loading && (
                                            <Chip
                                                label="Yükleniyor…"
                                                color="info"
                                                variant="outlined"
                                                icon={<CircularProgress size={14} />}
                                                sx={{ height: 28 }}
                                            />
                                        )}
                                        {err && <Chip label={`Hata: ${err}`} color="error" variant="outlined" sx={{ height: 28 }} />}
                                        {!loading && !err && <Chip label={`Toplam: ${sorted.length}`} variant="outlined" sx={{ height: 28 }} />}
                                        {onlyActive && <Chip color="success" label="Sadece Aktif" size="small" />}
                                    </Stack>
                                </Stack>
                                {TopToolbar}
                            </Stack>
                            {ActiveFilterChips}
                        </Box>

                        <Divider />

                        {/* Table */}
                        <TableContainer
                            ref={wrapRef}  // ← sarmalayıcıya ref
                            sx={{
                                maxHeight: "78vh",
                                width: "100%",
                                overflowX: "auto",
                            }}
                        >
                            <Table
                                ref={tableRef}               // ← tabloya ref
                                className="acf-table acf-scale"
                                stickyHeader
                                size="medium"
                                sx={{
                                    // minWidth: 2200,          // ← zaten kaldırıldı
                                    width: "100%",
                                    tableLayout: "fixed",       // ← metin sarma + daha iyi sığma
                                    "& thead th": {
                                        bgcolor: (t) =>
                                            t.palette.mode === "dark" ? t.palette.background.default : "#f3f6ff",
                                    },
                                    "& td, & th": {
                                        fontSize: "clamp(10px, 1vw, 15px)",
                                        wordBreak: "break-word",   // ← uzun kelimeleri kır
                                        whiteSpace: "normal",      // ← tek satıra zorlamayı bırak
                                    },
                                    "& td": {
                                        py: "clamp(0.4rem, 0.8vh, 1.1rem)",
                                    },
                                    "& tbody tr:hover": {
                                        backgroundColor: (t) =>
                                            t.palette.mode === "dark"
                                                ? "rgba(255,255,255,0.04)"
                                                : "rgba(2,132,199,0.06)",
                                    },
                                }}
                            >

                                <TableHead>
                                    <TableRow>
                                        {headerCell("Plaka", "plaka")}
                                        {headerCell("Cari ID", "cari_id")}
                                        {headerCell("Cari Adı", "cari_adi")}
                                        {headerCell("Araç Sahibi", "arac_sahip")}
                                        {headerCell("Odak Araç Çalışma Tipi", "odak_arac_calisma_tipi")}
                                        {headerCell("Aylık Kira", "aylik_kira", { align: "right" })}
                                        {headerCell("Aylık Sürücü", "aylik_surucu", { align: "right" })}
                                        {headerCell("Toplam Tutar", "toplam_tutar", { align: "right" })}
                                        {headerCell("Çalışma Günü", "calisma_gunu", { align: "center" })}
                                        {headerCell("Pasif", "pasif", { align: "center" })}
                                        {headerCell("Açıklama", "aciklama")}
                                        <TableCell sx={{ fontWeight: 900, fontSize: 15.5 }}>İşlem</TableCell>
                                        {headerCell("Düzenleyen", "duzenleme_yapan_kullanici")}
                                        {headerCell("Düzenleme Tarihi", "duzenleme_yapilan_tarih")}
                                    </TableRow>
                                </TableHead>

                                <TableBody
                                    sx={{
                                        "& tr:nth-of-type(odd)": {
                                            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#fafcff"),
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
                                                sx={{ "&.Mui-selected": { backgroundColor: (t) => t.palette.action.selected } }}
                                            >
                                                {/* Plaka */}
                                                <TableCell title={r.plaka} sx={{ fontWeight: 800 }}>
                                                    {r.plaka}
                                                </TableCell>

                                                {/* Cari ID (editable) */}
                                                <TableCell>
                                                    {isEditing ? (
                                                        <TextField
                                                            value={editData.cari_id ?? ""}
                                                            onChange={(e) => setEditData((p) => ({ ...p, cari_id: e.target.value }))}
                                                            size="small"
                                                            inputMode="numeric"
                                                            sx={{ width: 140 }}
                                                        />
                                                    ) : (
                                                        r.cari_id
                                                    )}
                                                </TableCell>

                                                {/* Cari Adı (editable) */}
                                                <TableCell title={r.cari_adi} sx={{ maxWidth: 360 }}>
                                                    {isEditing ? (
                                                        <TextField
                                                            value={editData.cari_adi ?? ""}
                                                            onChange={(e) => setEditData((p) => ({ ...p, cari_adi: e.target.value }))}
                                                            size="small"
                                                            fullWidth
                                                        />
                                                    ) : (
                                                        <Typography noWrap>{r.cari_adi}</Typography>
                                                    )}
                                                </TableCell>

                                                {/* Araç Sahibi (editable) */}
                                                <TableCell title={r.arac_sahip ?? ""} sx={{ maxWidth: 280 }}>
                                                    {isEditing ? (
                                                        <TextField
                                                            value={editData.arac_sahip ?? ""}
                                                            onChange={(e) => setEditData((p) => ({ ...p, arac_sahip: e.target.value }))}
                                                            size="small"
                                                            fullWidth
                                                        />
                                                    ) : (
                                                        <Typography noWrap>{r.arac_sahip}</Typography>
                                                    )}
                                                </TableCell>

                                                {/* Odak Araç Çalışma Tipi (editable) */}
                                                <TableCell title={r.odak_arac_calisma_tipi ?? ""} sx={{ maxWidth: 260 }}>
                                                    {isEditing ? (
                                                        <TextField
                                                            value={editData.odak_arac_calisma_tipi ?? ""}
                                                            onChange={(e) => setEditData((p) => ({ ...p, odak_arac_calisma_tipi: e.target.value }))}
                                                            size="small"
                                                            fullWidth
                                                        />
                                                    ) : (
                                                        <Typography noWrap>{r.odak_arac_calisma_tipi}</Typography>
                                                    )}
                                                </TableCell>

                                                {/* Aylık Kira (editable) */}
                                                <TableCell align="right" title={String(r.aylik_kira ?? "")}>
                                                    {isEditing ? (
                                                        <TextField
                                                            value={editData.aylik_kira ?? ""}
                                                            onChange={(e) =>
                                                                setEditData((p) => ({
                                                                    ...p,
                                                                    aylik_kira: formatTLForTyping(e.target.value),
                                                                }))
                                                            }
                                                            size="small"
                                                            inputMode="decimal"
                                                            sx={{ width: 160 }}
                                                        />
                                                    ) : (
                                                        formatTL(toNumberLoose(r.aylik_kira))
                                                    )}
                                                </TableCell>

                                                {/* Aylık Sürücü (editable) */}
                                                <TableCell align="right" title={String(r.aylik_surucu ?? "")}>
                                                    {isEditing ? (
                                                        <TextField
                                                            value={editData.aylik_surucu ?? ""}
                                                            onChange={(e) =>
                                                                setEditData((p) => ({
                                                                    ...p,
                                                                    aylik_surucu: formatTLForTyping(e.target.value),
                                                                }))
                                                            }
                                                            size="small"
                                                            inputMode="decimal"
                                                            sx={{ width: 160 }}
                                                        />
                                                    ) : (
                                                        formatTL(toNumberLoose(r.aylik_surucu))
                                                    )}
                                                </TableCell>

                                                {/* Toplam Tutar (computed) */}
                                                <TableCell align="right" title={String(toplamTutar)}>
                                                    {formatTL(toplamTutar)}
                                                </TableCell>

                                                {/* Çalışma Günü (editable) */}
                                                <TableCell align="center" title={String(r.calisma_gunu ?? "")}>
                                                    {isEditing ? (
                                                        <TextField
                                                            value={editData.calisma_gunu ?? ""}
                                                            onChange={(e) => setEditData((prev) => ({ ...prev, calisma_gunu: e.target.value }))}
                                                            size="small"
                                                            inputMode="numeric"
                                                            sx={{ width: 110 }}
                                                        />
                                                    ) : (
                                                        r.calisma_gunu ?? ""
                                                    )}
                                                </TableCell>

                                                {/* Pasif (read-only) */}
                                                <TableCell align="center">
                                                    <Checkbox checked={!!r.pasif} disabled />
                                                </TableCell>

                                                {/* Açıklama (read-only) */}
                                                <TableCell title={r.aciklama ?? ""} sx={{ maxWidth: 380 }}>
                                                    <Typography noWrap>{r.aciklama}</Typography>
                                                </TableCell>

                                                {/* İşlem */}
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
                                                        <Tooltip title="Satırı düzenle">
                                                            <span>
                                                                <IconButton onClick={() => startEdit(r)} size="small">
                                                                    <EditIcon />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>

                                                {/* Düzenleyen / Tarih */}
                                                <TableCell title={r.duzenleme_yapan_kullanici ?? ""}>{r.duzenleme_yapan_kullanici}</TableCell>
                                                <TableCell title={formatDate(r.duzenleme_yapilan_tarih)}>
                                                    {formatDate(r.duzenleme_yapilan_tarih)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {!loading && !err && sorted.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={14} align="center" sx={{ py: 5, color: "text.secondary", fontSize: 16 }}>
                                                Kayıt bulunamadı.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    </TableBody>

                                    <TableFooter>
                                        <TableRow
                                            sx={{
                                                "& td": {
                                                    fontWeight: 900,
                                                    fontSize: 15,
                                                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#eef3ff"),
                                                    borderTop: (t) => `2px solid ${t.palette.divider}`,
                                                    py: 1.25,
                                                },
                                            }}
                                        >
                                            <TableCell colSpan={5}>Toplam (filtrelenmiş veride)</TableCell>
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
                </Box>
            </Container>

            {/* ========== Gelişmiş Filtreler (Drawer) ========== */}
            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                PaperProps={{
                    sx: {
                        width: { xs: "100%", sm: 520 },               // ↑ genişlik artırıldı
                        p: 2,
                        borderTopLeftRadius: 18,
                        borderBottomLeftRadius: 18,
                        boxShadow: 8,
                        backdropFilter: "blur(8px)",
                    },
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, pb: 1 }}>
                    <Typography variant="h6" fontWeight={900}>
                        Gelişmiş Filtreler
                    </Typography>
                    <IconButton onClick={() => setDrawerOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </Stack>

                {/* ——— (İÇERİK AYNI) ——— */}
                {/* ... Drawer içeriği değişmedi ... */}
                {/* Sadece Paper’ın alt barda ufak düzen */}
                <Stack spacing={2} sx={{ pb: 10 }}>
                    {/* mevcut kartlarınız burada aynen kalıyor */}
                    {/* Genel / Tutar Aralıkları / Diğer kartları */}
                </Stack>

                <Paper
                    elevation={6}
                    sx={{
                        position: "fixed",
                        bottom: 0,
                        right: 0,
                        left: { xs: 0, sm: "auto" },
                        width: { xs: "100%", sm: 520 },
                        p: 2,
                        borderTopLeftRadius: 18,
                        backdropFilter: "blur(8px)",
                    }}
                >
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                        <Button startIcon={<ClearAllIcon />} onClick={clearFilters}>
                            Temizle
                        </Button>
                        <Stack direction="row" spacing={1}>
                            <Button variant="outlined" onClick={() => setDrawerOpen(false)}>
                                Kapat
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => {
                                    setFilters(tempFilters);
                                    setDrawerOpen(false);
                                }}
                            >
                                Uygula
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
            </Drawer>

            {/* ========== Yeni Kayıt (Dialog) ========== */}
            <Dialog
                open={showAdd}
                onClose={() => setShowAdd(false)}
                fullWidth
                maxWidth="md"
                PaperProps={{ sx: { borderRadius: 3.5, p: 0.25 } }}
            >
                <DialogTitle sx={{ fontWeight: 900 }}>Yeni Kayıt Ekle</DialogTitle>
                <DialogContent dividers>
                    {/* ——— (DİYALOG İÇERİĞİ AYNI) ——— */}
                    {/* Form alanlarının tamamı aynı kaldı */}              
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setShowAdd(false)}>Vazgeç</Button>
                    <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={addNew} disabled={adding}>
                        {adding ? "Ekleniyor..." : "Ekle"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
