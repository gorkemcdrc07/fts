// src/Hakedisler/Hamaliye.js
import React, { useMemo, useState, useEffect } from "react";
import {
    Box, Card, CardContent, CardHeader, Typography, Button, TextField,
    Select, MenuItem, InputLabel, FormControl, Dialog, DialogTitle, DialogContent,
    DialogActions, Chip, Table, TableHead, TableRow, TableCell, TableBody,
    Stack, IconButton, Pagination, Tooltip
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CloseIcon from "@mui/icons-material/Close";

const COLUMNS = [
    { key: "created_at", label: "created_at" },
    { key: "gelir_gider", label: "prim_hamaliye" },
    { key: "sefer_no", label: "sefer_no" },
    { key: "tarih", label: "tarih" },
    { key: "surucu", label: "surucu" },
    { key: "yukleme_musteri", label: "yukleme_musteri" },
    { key: "fatura_musteri", label: "fatura_musteri" },
    { key: "bolge_palet_sayisi", label: "bolge_palet_sayisi", numeric: true },
    { key: "odenen_tutar", label: "odenen_tutar", numeric: true },
    { key: "palet_sayisi", label: "palet_sayisi", numeric: true },
    { key: "donem", label: "donem" },
    { key: "kullanici_adi", label: "kullanici_adi" },
];

function currencyTRY(v) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
    }).format(v ?? 0);
}

export default function Hamaliye() {
    // tablo state
    const [rows, setRows] = useState([]); // boş başlangıç
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

    // dialog & form
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState({
        tarih: new Date().toISOString().slice(0, 10),
        gelir_gider: "Prim",
        kullanici_adi: "",
    });
    const [errors, setErrors] = useState({});

    // localStorage'dan kullanıcı adını otomatik al
    useEffect(() => {
        const keys = ["kullanici_adi", "kullaniciAdi", "username", "adSoyad"];
        let name = "";
        for (const k of keys) {
            const v = localStorage.getItem(k);
            if (v && v.trim()) {
                name = v.trim();
                break;
            }
        }
        setLocalUserName(name);
        setForm((f) => ({ ...f, kullanici_adi: name }));
    }, []);

    // filtre + sıralama
    const filtered = useMemo(() => {
        let data = [...rows];

        if (globalQuery.trim()) {
            const q = globalQuery.toLowerCase();
            data = data.filter((r) =>
                Object.values(r).some((v) => String(v).toLowerCase().includes(q))
            );
        }
        if (dateFrom) data = data.filter((r) => r.tarih >= dateFrom);
        if (dateTo) data = data.filter((r) => r.tarih <= dateTo);
        if (gelirGider !== "Hepsi") data = data.filter((r) => r.gelir_gider === gelirGider);
        if (donem !== "Hepsi") data = data.filter((r) => r.donem === donem);

        data.sort((a, b) => {
            const va = a[sortKey];
            const vb = b[sortKey];
            if (typeof va === "number" && typeof vb === "number")
                return sortDir === "asc" ? va - vb : vb - va;
            return sortDir === "asc"
                ? String(va).localeCompare(String(vb))
                : String(vb).localeCompare(String(va));
        });
        return data;
    }, [rows, globalQuery, dateFrom, dateTo, gelirGider, donem, sortKey, sortDir]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    function toggleSort(k) {
        if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortKey(k);
            setSortDir("asc");
        }
    }

    function resetFilters() {
        setGlobalQuery("");
        setDateFrom("");
        setDateTo("");
        setGelirGider("Hepsi");
        setDonem("Hepsi");
        setPage(1);
    }

    function validateForm(values) {
        const e = {};
        const required = [
            "gelir_gider",
            "sefer_no",
            "tarih",
            "surucu",
            "yukleme_musteri",
            "fatura_musteri",
            "odenen_tutar",
            "palet_sayisi",
            "donem",
            "kullanici_adi",
        ];
        for (const k of required) {
            if (values[k] === undefined || values[k] === "") e[k] = "Zorunlu alan";
        }
        if (values.odenen_tutar != null && Number(values.odenen_tutar) < 0)
            e.odenen_tutar = "+ olmalı";
        if (values.palet_sayisi != null && Number(values.palet_sayisi) < 0)
            e.palet_sayisi = "+ olmalı";
        return e;
    }

    function handleCreate() {
        const e = validateForm(form);
        setErrors(e);
        if (Object.keys(e).length) return;

        const newRow = {
            id: Math.random().toString(36).slice(2),
            created_at: new Date().toISOString(),
            gelir_gider: form.gelir_gider || "Prim",
            sefer_no: String(form.sefer_no || ""),
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

        // TODO: API POST (başarılı dönüşte server kaydını kullanın)
        setRows((r) => [newRow, ...r]);
        setDialogOpen(false);
        setForm({
            tarih: new Date().toISOString().slice(0, 10),
            gelir_gider: "Prim",
            kullanici_adi: localUserName,
        });
    }

    function exportCSV() {
        const header = COLUMNS.map((c) => c.label).join(",");
        const body = filtered
            .map((r) =>
                [
                    r.created_at,
                    r.gelir_gider,
                    r.sefer_no,
                    r.tarih,
                    r.surucu,
                    r.yukleme_musteri,
                    r.fatura_musteri,
                    r.bolge_palet_sayisi,
                    r.odenen_tutar,
                    r.palet_sayisi,
                    r.donem,
                    r.kullanici_adi,
                ]
                    .map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`)
                    .join(",")
            )
            .join("\n");
        const csv = header + "\n" + body;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hamaliye_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Başlık ve üst aksiyonlar */}
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
            >
                <Box>
                    <Typography variant="h5" fontWeight={700}>
                        Hamaliye
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Kayıtlarınızı modern bir tablo üzerinde yönetin, filtreleyin ve
                        yeni kayıt ekleyin.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCSV}>
                        CSV Dışa Aktar
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                        Yeni Kayıt
                    </Button>
                </Stack>
            </Stack>

            {/* Filtreler */}
            <Card variant="outlined" sx={{ mb: 2 }}>
                <CardHeader
                    title={
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <FilterListIcon fontSize="small" />
                            <Typography variant="subtitle1">Filtreler</Typography>
                        </Stack>
                    }
                    sx={{ pb: 0.5 }}
                />
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <Box sx={{ position: "relative", flex: 1 }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Tabloda ara (tüm alanlar)"
                                value={globalQuery}
                                onChange={(e) => {
                                    setGlobalQuery(e.target.value);
                                    setPage(1);
                                }}
                                InputProps={{
                                    startAdornment: <SearchIcon sx={{ mr: 1, opacity: 0.7 }} />,
                                    endAdornment: globalQuery ? (
                                        <Tooltip title="Temizle">
                                            <IconButton size="small" onClick={() => setGlobalQuery("")}>
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    ) : null,
                                }}
                            />
                        </Box>

                        <TextField
                            label="Başlangıç"
                            type="date"
                            size="small"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                setPage(1);
                            }}
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            label="Bitiş"
                            type="date"
                            size="small"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                setPage(1);
                            }}
                            InputLabelProps={{ shrink: true }}
                        />

                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel id="gg-label">Prim/Hamaliye</InputLabel>
                            <Select
                                labelId="gg-label"
                                label="Prim/Hamaliye"
                                value={gelirGider}
                                onChange={(e) => {
                                    setGelirGider(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <MenuItem value="Hepsi">Hepsi</MenuItem>
                                <MenuItem value="Prim">Prim</MenuItem>
                                <MenuItem value="Hamaliye">Hamaliye</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            label="Dönem (YYYY-AA)"
                            size="small"
                            value={donem === "Hepsi" ? "" : donem}
                            onChange={(e) => {
                                setDonem(e.target.value || "Hepsi");
                                setPage(1);
                            }}
                        />

                        <Button variant="text" onClick={resetFilters}>
                            Sıfırla
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            {/* Tablo */}
            <Card>
                <CardHeader
                    title={
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="subtitle1">Kayıtlar</Typography>
                            <Chip label={`${total} kayıt`} size="small" />
                        </Stack>
                    }
                    sx={{ pb: 0 }}
                />
                <CardContent>
                    <Box
                        sx={{
                            width: "100%",
                            overflow: "auto",
                            borderRadius: 2,
                            border: "1px solid",
                            borderColor: "divider",
                        }}
                    >
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    {COLUMNS.map((c) => (
                                        <TableCell key={c.key} align={c.numeric ? "right" : "left"}>
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={() => toggleSort(c.key)}
                                                endIcon={
                                                    sortKey === c.key
                                                        ? sortDir === "asc"
                                                            ? <ArrowUpwardIcon fontSize="inherit" />
                                                            : <ArrowDownwardIcon fontSize="inherit" />
                                                        : null
                                                }
                                            >
                                                {c.label}
                                            </Button>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paged.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 6, color: "text.secondary" }}>
                                            Kayıt bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {paged.map((r) => (
                                    <TableRow key={r.id} hover>
                                        <TableCell sx={{ color: "text.secondary" }}>
                                            {new Date(r.created_at).toLocaleString("tr-TR")}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={r.gelir_gider}
                                                size="small"
                                                color={r.gelir_gider === "Prim" ? "success" : "primary"} // Prim→yeşil, Hamaliye→mavi
                                                variant="filled"
                                            />
                                        </TableCell>
                                        <TableCell>{r.sefer_no}</TableCell>
                                        <TableCell>{r.tarih}</TableCell>
                                        <TableCell>{r.surucu}</TableCell>
                                        <TableCell>{r.yukleme_musteri}</TableCell>
                                        <TableCell>{r.fatura_musteri}</TableCell>
                                        <TableCell align="right">{r.bolge_palet_sayisi}</TableCell>
                                        <TableCell align="right">{currencyTRY(r.odenen_tutar)}</TableCell>
                                        <TableCell align="right">{r.palet_sayisi}</TableCell>
                                        <TableCell>{r.donem}</TableCell>
                                        <TableCell>{r.kullanici_adi}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>

                    {/* Sayfalama */}
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mt: 2 }}
                        spacing={2}
                    >
                        <Typography variant="caption" color="text.secondary">
                            Toplam <b>{total}</b> kayıttan {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} arası
                            gösteriliyor.
                        </Typography>

                        <Stack direction="row" spacing={2} alignItems="center">
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel id="psize">Sayfa Boyutu</InputLabel>
                                <Select
                                    labelId="psize"
                                    label="Sayfa Boyutu"
                                    value={String(pageSize)}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setPage(1);
                                    }}
                                >
                                    {[10, 25, 50, 100].map((n) => (
                                        <MenuItem key={n} value={String(n)}>{n} / sayfa</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Pagination
                                count={totalPages}
                                page={page}
                                onChange={(_, v) => setPage(v)}
                                shape="rounded"
                                size="small"
                                showFirstButton
                                showLastButton
                            />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            {/* Yeni Kayıt Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Yeni Hamaliye Kaydı</DialogTitle>
                <DialogContent dividers>
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
                            <TextField
                                label="Ödenen Tutar (₺)"
                                type="number"
                                value={form.odenen_tutar ?? ""}
                                onChange={(e) => setForm({ ...form, odenen_tutar: Number(e.target.value) })}
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
                                helperText={errors.surucu}
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
                            <TextField
                                label="Dönem (YYYY-AA)"
                                value={form.donem || ""}
                                onChange={(e) => setForm({ ...form, donem: e.target.value })}
                                error={!!errors.donem}
                                helperText={errors.donem}
                            />
                            <TextField
                                label="Kullanıcı Adı"
                                value={form.kullanici_adi || ""}
                                onChange={(e) => setForm({ ...form, kullanici_adi: e.target.value })}
                                InputProps={{ readOnly: !!localUserName }} // localStorage’dan geldiyse düzenlemeyi kilitle
                                error={!!errors.kullanici_adi}
                                helperText={localUserName ? "Otomatik dolduruldu (localStorage)" : (errors.kullanici_adi || "")}
                            />
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Vazgeç</Button>
                    <Button variant="contained" onClick={handleCreate}>Kaydet</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
