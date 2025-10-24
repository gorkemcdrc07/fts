// src/aktifseferler/GorunumDuzenle.jsx
import React, { useMemo, useRef, useState } from "react";
import {
    Box, Stack, Paper, Typography, TextField, IconButton, Button,
    Chip, Switch, FormControlLabel, Tooltip, Divider, Snackbar, Alert
} from "@mui/material";
import { Helmet } from "react-helmet-async";
import { COLORS } from "./constants/colors";
import { useNavigate } from "react-router-dom";

import SearchIcon from "@mui/icons-material/Search";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import UndoIcon from "@mui/icons-material/Undo";
import ViewCompactIcon from "@mui/icons-material/ViewCompact";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import GridViewIcon from "@mui/icons-material/GridView";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";

/* Aynı anahtar sistemi */
const USERKEY = (localStorage.getItem("kullaniciAdi") || "GENERIC").toUpperCase();
const ORDER_KEY = `aktifseferler.columnOrder.${USERKEY}`;
const HIDDEN_KEY = `aktifseferler.hiddenColumns.${USERKEY}`;
const GENERIC_ORDER_KEY = `aktifseferler.columnOrder.GENERIC`;
const GENERIC_HIDDEN_KEY = `aktifseferler.hiddenColumns.GENERIC`;

/* columns.js ile uyumlu envanter */
const ALL_COLUMNS = [
    { id: "actions", label: "İşlem", lock: true },
    { id: "reel_durum", label: "Reel Durum" },
    { id: "nokta_sayisi", label: "Nokta" },
    { id: "sefer_no", label: "Sefer No" },
    { id: "statu", label: "Statü" },
    { id: "plaka", label: "Plaka" },
    { id: "musteri_adi", label: "Müşteri" },
    { id: "proje_adi", label: "Proje" },
    { id: "sefer_tarihi", label: "Sefer Tarihi" },
    { id: "atama_yapan_kullanici", label: "Atayan" },
    { id: "arac_statu", label: "Araç Statü" },
    { id: "yukleme_ili", label: "Yükleme İl" },
    { id: "yukleme_ilcesi", label: "Yükleme İlçe" },
    { id: "teslim_ili", label: "Teslim İl" },
    { id: "teslim_ilcesi", label: "Teslim İlçe" },
    { id: "treyler", label: "Treyler" },
    { id: "surucu_ad_soyad", label: "Sürücü" },
    { id: "surucu_tckn", label: "TC" },
    { id: "surucu_telefon", label: "Telefon" },
    { id: "musteri_siparis_no", label: "Sipariş No" },
    { id: "hizmet_adi", label: "Hizmet" },
    { id: "yukleme_noktasi", label: "Yükleme Noktası" },
    // Yeni eklenen sütunlar burada
    { id: "yukleme_kayit_zamani", label: "Yükleme Kayıt Zm." }, // Yeni
    { id: "nokta_kayit_bilgisi", label: "Nokta Kayıt Bilgisi" }, // <-- EKLENDİ
    { id: "teslim_noktasi", label: "Teslim Noktası" },
    { id: "teslim_kayit_zamani", label: "Teslim Kayıt Zm." },   // Yeni
    //
    { id: "irsaliye_no", label: "İrsaliye No" },
    { id: "kayit_zamani", label: "Kayıt Zamanı" },
    { id: "atama_tarihi", label: "Atama Tarihi" },
    { id: "eta_varis", label: "ETA" },
    { id: "kalan_surus_dk", label: "Kalan (dk)" },
    { id: "_note", label: "Açıklama Rozeti", lock: true },
];
const PRESET_MIN = [
    "actions", "reel_durum", "sefer_no", "plaka", "musteri_adi", "proje_adi",
    "sefer_tarihi", "eta_varis", "kalan_surus_dk", "_note"
];
const PRESET_PLAN = [
    "actions", "reel_durum", "nokta_sayisi", "sefer_no", "statu", "plaka", "musteri_adi", "nokta_kayit_bilgisi",
    "proje_adi", "yukleme_ili", "teslim_ili", "sefer_tarihi", "eta_varis", "kalan_surus_dk", "_note"
];
const PRESET_FULL = ALL_COLUMNS.map(c => c.id);

export default function GorunumDuzenle() {
    const navigate = useNavigate();
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

    // local storage’dan yükle
    const initialOrder = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem(ORDER_KEY) ||
                localStorage.getItem(GENERIC_ORDER_KEY) ||
                "[]") || [];
        } catch { return []; }
    }, []);
    const initialHidden = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem(HIDDEN_KEY) ||
                localStorage.getItem(GENERIC_HIDDEN_KEY) ||
                "[]") || [];
        } catch { return []; }
    }, []);

    // çalışma state’i
    const [order, setOrder] = useState(() => {
        const known = new Set(ALL_COLUMNS.map(c => c.id));
        const cleaned = initialOrder.filter(id => known.has(id));
        const missing = ALL_COLUMNS.map(c => c.id).filter(id => !cleaned.includes(id));
        return [...cleaned, ...missing];
    });
    const [hidden, setHidden] = useState(new Set(initialHidden));
    const [query, setQuery] = useState("");
    const [compactList, setCompactList] = useState(false);

    // drag state
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // görünür sütunların sıralı listesi
    const visibleOrdered = useMemo(() => order.filter(id => !hidden.has(id)), [order, hidden]);

    // filtreli görünüm listesi
    const list = useMemo(() => {
        const m = new Map(ALL_COLUMNS.map(c => [c.id, c]));
        return order
            .map(id => m.get(id))
            .filter(Boolean)
            .filter(c => c.label.toLowerCase().includes(query.trim().toLowerCase()));
    }, [order, query]);

    const indexOfInOrder = (id) => visibleOrdered.indexOf(id); // -1 ise gizli

    const toggleVisibility = (id) => {
        setHidden(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const setPreset = (ids) => {
        const known = new Set(ALL_COLUMNS.map(c => c.id));
        const ord = ids.filter(id => known.has(id));
        const missing = ALL_COLUMNS.map(c => c.id).filter(id => !ord.includes(id));
        setOrder([...ord, ...missing]);
        setHidden(new Set(ALL_COLUMNS.map(c => c.id).filter(id => !ids.includes(id))));
    };

    const resetDefaults = () => setPreset(PRESET_PLAN);

    const undoChanges = () => {
        const known = new Set(ALL_COLUMNS.map(c => c.id));
        const cleaned = initialOrder.filter(id => known.has(id));
        const missing = ALL_COLUMNS.map(c => c.id).filter(id => !cleaned.includes(id));
        setOrder([...cleaned, ...missing]);
        setHidden(new Set(initialHidden));
    };

    const save = () => {
        try {
            localStorage.setItem(ORDER_KEY, JSON.stringify(order));
            localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
            localStorage.setItem("aktifseferler.view.bump", String(Date.now()));
            // aynı sekmede storage event tetiklenmediği için manuel event yayınla
            window.dispatchEvent(new Event("aktifseferler:view:changed"));

            setSnack({ open: true, severity: "success", msg: "Görünüm kaydedildi." });
        } catch (e) {
            setSnack({ open: true, severity: "error", msg: "Kaydedilemedi." });
        }
    };

    // drag & drop
    const onDragStart = (index) => () => { dragItem.current = index; };
    const onDragEnter = (index) => () => { dragOverItem.current = index; };
    const onDragEnd = () => {
        const from = dragItem.current;
        const to = dragOverItem.current;
        dragItem.current = null;
        dragOverItem.current = null;
        if (from === null || to === null || from === to) return;

        setOrder((prev) => {
            // filtreli listeden kimlerden bahsettiğimizi tespit et
            const idFrom = list[from].id;
            const idTo = list[to].id;

            // kilitli kolonlar yer değiştirmesin
            const lock = new Set(ALL_COLUMNS.filter(x => x.lock).map(x => x.id));
            if (lock.has(idFrom) || lock.has(idTo)) return prev;

            const working = [...prev];
            const a = working.indexOf(idFrom);
            const b = working.indexOf(idTo);
            if (a < 0 || b < 0) return prev;

            const tmp = working[a];
            working[a] = working[b];
            working[b] = tmp;
            return working;
        });
    };

    const toggleAll = (show) => {
        if (show) setHidden(new Set()); else setHidden(new Set(ALL_COLUMNS.map(c => c.id)));
    };

    return (
        <Box sx={{ p: 2, height: "100dvh", background: COLORS.pageBg, color: COLORS.text }}>
            <Helmet><title>Görünümü Düzenle • Aktif Seferler</title></Helmet>

            {/* Header */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 1.5 }}>
                <Stack spacing={0.2}>
                    <Typography variant="h5" fontWeight={900} sx={{
                        lineHeight: 1.1,
                        background: "linear-gradient(90deg,#a78bfa,#60a5fa)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}>
                        Görünümü Düzenle
                    </Typography>
                    <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                        Sürükleyip bırakın. Numaralara bakarak **ekrandaki gerçek sıralamayı** görün.
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Button size="small" variant="text" startIcon={<ArrowBackIosNewIcon />} onClick={() => navigate(-1)}>Geri</Button>
                    <Button size="small" variant="text" startIcon={<HomeOutlinedIcon />} onClick={() => navigate("/anasayfa")}>Anasayfa</Button>
                    <FormControlLabel
                        control={<Switch checked={compactList} onChange={() => setCompactList(v => !v)} size="small" />}
                        label="Kompakt liste"
                        sx={{ color: COLORS.textMuted }}
                    />
                </Stack>
            </Stack>

            {/* Üst Aksiyonlar */}
            <Paper sx={{ p: 1.25, mb: 1, borderRadius: 3, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                        <SearchIcon sx={{ opacity: 0.6 }} />
                        <TextField
                            placeholder="Sütun ara..."
                            size="small"
                            fullWidth
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            sx={{
                                "& .MuiInputBase-root": {
                                    background: COLORS.surface2, color: COLORS.text, borderRadius: 1.2, border: `1px solid ${COLORS.border}`,
                                }
                            }}
                        />
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
                        <Tooltip title="Minimal (hafif görünüm)"><Button size="small" startIcon={<ViewCompactIcon />} onClick={() => setPreset(PRESET_MIN)}>Minimal</Button></Tooltip>
                        <Tooltip title="Planlama (önerilen)"><Button size="small" startIcon={<ViewWeekIcon />} onClick={() => setPreset(PRESET_PLAN)}>Planlama</Button></Tooltip>
                        <Tooltip title="Tümü görünür"><Button size="small" startIcon={<GridViewIcon />} onClick={() => setPreset(PRESET_FULL)}>Tam</Button></Tooltip>

                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: COLORS.border }} />

                        <Button size="small" startIcon={<UndoIcon />} onClick={undoChanges}>Geri Al</Button>
                        <Button size="small" startIcon={<RestartAltIcon />} onClick={resetDefaults}>Varsayılan</Button>

                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: COLORS.border }} />

                        <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={save}>Kaydet</Button>
                    </Stack>
                </Stack>

                {/* Sayaçlar */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    <Chip size="small" label={`Toplam: ${ALL_COLUMNS.length}`} />
                    <Chip size="small" color="success" label={`Görünen: ${visibleOrdered.length}`} />
                    <Chip size="small" color="warning" label={`Gizli: ${ALL_COLUMNS.length - visibleOrdered.length}`} />
                    <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
                        <Button size="small" onClick={() => toggleAll(true)}>Tümünü Göster</Button>
                        <Button size="small" onClick={() => toggleAll(false)}>Tümünü Gizle</Button>
                    </Stack>
                </Stack>
            </Paper>

            {/* CANLI ÖNİZLEME: Görünen sütunlar sırasıyla */}
            <Paper sx={{ p: 1, mb: 1.25, borderRadius: 3, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                <Typography variant="caption" sx={{ color: COLORS.textMuted, display: "block", mb: 0.5 }}>
                    Canlı Önizleme (Ekrandaki görünür sütun sırası):
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                    {visibleOrdered.map((id, i) => {
                        const meta = ALL_COLUMNS.find(c => c.id === id);
                        return (
                            <Chip
                                key={id}
                                label={`${i + 1}. ${meta?.label || id}`}
                                size="small"
                                sx={{ fontWeight: 700 }}
                            />
                        );
                    })}
                    {visibleOrdered.length === 0 && (
                        <Chip size="small" label="(Hiç görünür sütun yok)" />
                    )}
                </Stack>
            </Paper>

            {/* LİSTE: Numara + isim + toggle */}
            <Paper sx={{
                borderRadius: 3, border: `1px solid ${COLORS.border}`, background: COLORS.surface,
                p: 1, height: "calc(100dvh - 270px)", overflow: "auto"
            }}>
                <Box
                    component="ul"
                    sx={{
                        listStyle: "none", m: 0, p: 0,
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        gap: 0.75
                    }}
                >
                    {list.map((col, idx) => {
                        const isHidden = hidden.has(col.id);
                        const pos = indexOfInOrder(col.id);  // görünür sırası (-1 ise gizli)
                        const posBadge = pos >= 0 ? (pos + 1) : "—";
                        return (
                            <Box
                                key={col.id}
                                component="li"
                                draggable={!col.lock}
                                onDragStart={onDragStart(idx)}
                                onDragEnter={onDragEnter(idx)}
                                onDragEnd={onDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                sx={{
                                    userSelect: "none",
                                    border: `1px solid ${COLORS.border}`,
                                    background: isHidden ? COLORS.surface2 : COLORS.surface,
                                    borderRadius: 2,
                                    px: 1, py: compactList ? 0.5 : 1,
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
                                    "&:hover": { background: COLORS.surface2 }
                                }}
                            >
                                <Stack direction="row" spacing={1} alignItems="center">
                                    {/* sıra numarası rozeti */}
                                    <Box
                                        sx={{
                                            width: 26, height: 26, borderRadius: "9999px",
                                            display: "grid", placeItems: "center",
                                            fontSize: 12, fontWeight: 800,
                                            border: `1px solid ${COLORS.border}`,
                                            background: isHidden ? "transparent" : COLORS.surface,
                                            color: isHidden ? COLORS.textMuted : COLORS.text
                                        }}
                                        title={isHidden ? "Gizli sütun" : `Sıra: ${posBadge}`}
                                    >
                                        {posBadge}
                                    </Box>

                                    <DragIndicatorIcon
                                        sx={{ opacity: col.lock ? 0.25 : 0.9, cursor: col.lock ? "not-allowed" : "grab" }}
                                    />
                                    <Typography fontWeight={700} sx={{ fontSize: compactList ? 13 : 14.5 }}>
                                        {col.label}
                                    </Typography>
                                    {col.lock && (
                                        <Tooltip title="Bu sütun sabit (sürüklenemez)">
                                            <Chip size="small" label="Kilitli" sx={{ ml: 0.5 }} />
                                        </Tooltip>
                                    )}
                                </Stack>

                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                                        {col.id}
                                    </Typography>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                size="small"
                                                checked={!isHidden}
                                                onChange={() => toggleVisibility(col.id)}
                                            />
                                        }
                                        label={isHidden ? "Gizli" : "Görünür"}
                                        sx={{ m: 0, ml: 1, ".MuiFormControlLabel-label": { fontSize: 13 } }}
                                    />
                                </Stack>
                            </Box>
                        );
                    })}
                </Box>
            </Paper>

            <Snackbar
                open={snack.open}
                autoHideDuration={2600}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
