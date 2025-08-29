// src/Hakedisler/AracCariVeFiyat.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// MUI
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
    IconButton,
    Tooltip,
    Chip,
    Stack,
    Checkbox,
    CircularProgress,
    Divider,
    Button,
} from "@mui/material";
import {
    ArrowUpward,
    ArrowDownward,
    ImportExport,
    Edit as EditIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Search as SearchIcon,
} from "@mui/icons-material";

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
// yardımcı
const toNumberOrNull = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
};

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

    useEffect(() => {
        let ignore = false;
        const fetchData = async () => {
            setLoading(true);
            setErr(null);
            const { data, error } = await supabase.from("arac_cari_ve_fiyat").select("*");
            if (!ignore) {
                if (error) setErr(error.message || "Veri çekilemedi");
                else setRows(data || []);
                setLoading(false);
            }
        };
        fetchData();
        return () => {
            ignore = true;
        };
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(
            (r) =>
                (r.plaka || "").toLowerCase().includes(q) ||
                (r.cari_adi || "").toLowerCase().includes(q) ||
                String(r.cari_id || "").toLowerCase().includes(q)
        );
    }, [rows, query]);

    const sorted = useMemo(() => {
        const copy = [...filtered];
        const { key, dir } = sortBy;
        copy.sort((a, b) => {
            const va = a?.[key];
            const vb = b?.[key];
            const numericKeys = new Set(["aylik_kira", "aylik_surucu", "calisma_gunu", "cari_id"]);
            if (numericKeys.has(key)) {
                const na = Number(va ?? 0);
                const nb = Number(vb ?? 0);
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
        const payload = {
            cari_id: parseTLToNumber(editData.cari_id),
            cari_adi: editData.cari_adi ?? null,
            aylik_kira: parseTLToNumber(editData.aylik_kira),
            aylik_surucu: parseTLToNumber(editData.aylik_surucu),
            calisma_gunu: parseTLToNumber(editData.calisma_gunu),
            pasif: !!editData.pasif,
            aciklama: editData.aciklama ?? null,
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
                    r.plaka === editingKey.plaka && r.cari_id === editingKey.cari_id ? { ...r, ...payload, plaka: r.plaka } : r
                )
            );
            cancelEdit();
        }
        setSavingId(null);
    };

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

    const SortIcon = ({ col }) => {
        if (sortBy.key !== col) return <ImportExport fontSize="inherit" sx={{ opacity: 0.6 }} />;
        return sortBy.dir === "asc" ? <ArrowUpward fontSize="inherit" /> : <ArrowDownward fontSize="inherit" />;
    };

    const headerCell = (label, key) => (
        <TableCell
            sx={{ whiteSpace: "nowrap", fontWeight: 700, cursor: "pointer" }}
            onClick={() => toggleSort(key)}
            title={`${label} - sırala`}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                <span>{label}</span>
                <SortIcon col={key} />
            </Stack>
        </TableCell>
    );

    return (
        <Box sx={{ bgcolor: (t) => t.palette.mode === "dark" ? "background.default" : "#f7f9fc", minHeight: "100dvh", py: 3 }}>
            <Container maxWidth="xl">
                <Paper elevation={6} sx={{ borderRadius: 3, overflow: "hidden" }}>
                    <Box sx={{ p: 2.5, pb: 1.5 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
                            <Typography variant="h6" fontWeight={800}>Araç Cari & Fiyat</Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                {loading && <Chip label="Yükleniyor…" color="info" variant="outlined" icon={<CircularProgress size={14} />} />}
                                {err && <Chip label={`Hata: ${err}`} color="error" variant="outlined" />}
                                {!loading && !err && <Chip label={`Toplam: ${sorted.length}`} variant="outlined" />}
                            </Stack>
                        </Stack>

                        <Box sx={{ mt: 2 }}>
                            <TextField
                                fullWidth
                                placeholder="Plaka, Cari Adı veya Cari ID ara…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ opacity: 0.7 }} />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Box>
                    </Box>

                    <Divider />

                    <TableContainer sx={{ maxHeight: "70vh" }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    {headerCell("Plaka", "plaka")}
                                    {headerCell("Cari ID", "cari_id")}
                                    {headerCell("Cari Adı", "cari_adi")}
                                    {headerCell("Aylık Kira", "aylik_kira")}
                                    {headerCell("Aylık Sürücü", "aylik_surucu")}
                                    {headerCell("Çalışma Günü", "calisma_gunu")}
                                    {headerCell("Pasif", "pasif")}
                                    {headerCell("Açıklama", "aciklama")}
                                    <TableCell>İşlem</TableCell>
                                    {headerCell("Düzenleyen", "duzenleme_yapan_kullanici")}
                                    {headerCell("Düzenleme Tarihi", "duzenleme_yapilan_tarih")}
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {sorted.map((r, i) => {
                                    const isEditing = editingId === `${r.plaka}-${r.cari_id}`;
                                    const rowKey = `${r.plaka}-${r.cari_id}-${i}`;

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
                                            {/* plaka */}
                                            <TableCell title={r.plaka} sx={{ fontWeight: 600 }}>
                                                {r.plaka}
                                            </TableCell>

                                            {/* cari_id */}
                                            <TableCell>
                                                {isEditing ? (
                                                    <TextField
                                                        value={editData.cari_id ?? ""}
                                                        onChange={(e) => setEditData((prev) => ({ ...prev, cari_id: e.target.value }))}
                                                        size="small"
                                                    />
                                                ) : (
                                                    r.cari_id
                                                )}
                                            </TableCell>

                                            {/* cari_adi */}
                                            <TableCell title={r.cari_adi} sx={{ maxWidth: 320 }}>
                                                {isEditing ? (
                                                    <TextField
                                                        value={editData.cari_adi ?? ""}
                                                        onChange={(e) => setEditData((prev) => ({ ...prev, cari_adi: e.target.value }))}
                                                        size="small"
                                                    />
                                                ) : (
                                                    <Typography noWrap>{r.cari_adi}</Typography>
                                                )}
                                            </TableCell>

                                            {/* aylik_kira */}
                                            <TableCell align="right" title={String(r.aylik_kira ?? "")}>
                                                {isEditing ? (
                                                    <TextField
                                                        value={editData.aylik_kira ?? ""}
                                                        onChange={(e) =>
                                                            setEditData((prev) => ({
                                                                ...prev,
                                                                aylik_kira: formatTLForTyping(e.target.value),
                                                            }))
                                                        }
                                                        inputMode="decimal"
                                                        placeholder="0,00"
                                                        size="small"
                                                    />
                                                ) : (
                                                    formatTL(r.aylik_kira)
                                                )}
                                            </TableCell>

                                            {/* aylik_surucu */}
                                            <TableCell align="right" title={String(r.aylik_surucu ?? "")}>
                                                {isEditing ? (
                                                    <TextField
                                                        value={editData.aylik_surucu ?? ""}
                                                        onChange={(e) =>
                                                            setEditData((prev) => ({
                                                                ...prev,
                                                                aylik_surucu: formatTLForTyping(e.target.value),
                                                            }))
                                                        }
                                                        inputMode="decimal"
                                                        placeholder="0,00"
                                                        size="small"
                                                    />
                                                ) : (
                                                    formatTL(r.aylik_surucu)
                                                )}
                                            </TableCell>

                                            {/* calisma_gunu */}
                                            <TableCell align="center" title={String(r.calisma_gunu ?? "")}>
                                                {isEditing ? (
                                                    <TextField
                                                        value={editData.calisma_gunu ?? ""}
                                                        onChange={(e) => setEditData((prev) => ({ ...prev, calisma_gunu: e.target.value }))}
                                                        size="small"
                                                    />
                                                ) : (
                                                    r.calisma_gunu ?? ""
                                                )}
                                            </TableCell>

                                            {/* pasif */}
                                            <TableCell align="center">
                                                <Checkbox
                                                    checked={isEditing ? !!editData.pasif : !!r.pasif}
                                                    onChange={(e) => isEditing && setEditData((prev) => ({ ...prev, pasif: e.target.checked }))}
                                                    disabled={!isEditing || savingId === `${r.plaka}-${r.cari_id}`}
                                                />
                                            </TableCell>

                                            {/* aciklama */}
                                            <TableCell title={r.aciklama ?? ""} sx={{ maxWidth: 340 }}>
                                                {isEditing ? (
                                                    <TextField
                                                        value={editData.aciklama ?? ""}
                                                        onChange={(e) => setEditData((prev) => ({ ...prev, aciklama: e.target.value }))}
                                                        size="small"
                                                    />
                                                ) : (
                                                    <Typography noWrap>{r.aciklama}</Typography>
                                                )}
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
                                                    <Tooltip title="Düzenle">
                                                        <IconButton onClick={() => startEdit(r)} size="small">
                                                            <EditIcon />
                                                        </IconButton>
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
                                        <TableCell colSpan={11} align="center" sx={{ py: 4, color: "text.secondary" }}>
                                            Kayıt bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Alt bar: hızlı ek aksiyon örneği (opsiyonel) */}
                    <Box sx={{ p: 1.5, display: "flex", justifyContent: "flex-end", gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                                setQuery("");
                            }}
                        >
                            Filtreyi Temizle
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
