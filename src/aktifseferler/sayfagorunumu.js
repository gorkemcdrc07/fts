// src/aktifseferler/sayfagorunumu.js
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import {
    Box, Paper, Stack, Typography, Button,
    List, ListItem, ListItemIcon, ListItemText,
    Checkbox, Divider, Snackbar, Alert, IconButton, Tooltip, TextField
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import RestoreIcon from "@mui/icons-material/Restore";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

import buildColumns from "./columns";
import { COLORS } from "./constants/colors";
import { userCanEdit, userCanSeeETA } from "./utils/format";

// --- Kişi bazlı + GENERIC anahtarlar
const USERNAME = (localStorage.getItem("kullaniciAdi") || "GENERIC").toUpperCase();
const ORDER_KEY = `aktifseferler.columnOrder.${USERNAME}`;
const HIDDEN_KEY = `aktifseferler.hiddenColumns.${USERNAME}`;
const GENERIC_ORDER_KEY = `aktifseferler.columnOrder.GENERIC`;
const GENERIC_HIDDEN_KEY = `aktifseferler.hiddenColumns.GENERIC`;
const VIEW_BUMP_KEY = "aktifseferler.view.bump";

const noop = () => { };

export default function SayfaGorunumu() {
    const navigate = useNavigate();
    const canEdit = userCanEdit(localStorage.getItem("kullaniciAdi"));
    const canSeeETA = userCanSeeETA(localStorage.getItem("kullaniciAdi"));

    // Tüm kolon tanımları (sadece field ve başlık)
    const allColumns = useMemo(() => {
        const cols = buildColumns({ canEdit, canSeeETA, openETA: noop, openEditor: noop, COLORS }) || [];
        return cols
            .filter((c) => !!c.field)
            .map((c) => ({ field: c.field, headerName: c.headerName || c.field }));
    }, [canEdit, canSeeETA]);

    const defaultOrder = useMemo(() => allColumns.map((c) => c.field), [allColumns]);

    // State
    const [order, setOrder] = useState(defaultOrder);
    const [hidden, setHidden] = useState(new Set());
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
    const [query, setQuery] = useState("");

    // Storage'dan yükleme (kullanıcı -> yoksa GENERIC)
    useEffect(() => {
        try {
            // order
            const savedOrderUser = JSON.parse(localStorage.getItem(ORDER_KEY) || "null");
            const savedOrderGeneric = JSON.parse(localStorage.getItem(GENERIC_ORDER_KEY) || "null");
            const savedOrder = Array.isArray(savedOrderUser) && savedOrderUser.length
                ? savedOrderUser
                : (Array.isArray(savedOrderGeneric) ? savedOrderGeneric : null);

            // hidden
            const savedHiddenUser = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "null");
            const savedHiddenGeneric = JSON.parse(localStorage.getItem(GENERIC_HIDDEN_KEY) || "null");
            const savedHiddenArr = Array.isArray(savedHiddenUser)
                ? savedHiddenUser
                : (Array.isArray(savedHiddenGeneric) ? savedHiddenGeneric : null);

            // order'ı bugünkü kolonlara uydur
            let finalOrder = defaultOrder;
            if (Array.isArray(savedOrder) && savedOrder.length) {
                const currentSet = new Set(defaultOrder);
                const filteredSaved = savedOrder.filter((f) => currentSet.has(f));
                const newOnes = defaultOrder.filter((f) => !filteredSaved.includes(f));
                finalOrder = [...filteredSaved, ...newOnes];
            }
            setOrder(finalOrder);

            // hidden set
            if (Array.isArray(savedHiddenArr)) {
                const valid = savedHiddenArr.filter((f) => finalOrder.includes(f));
                setHidden(new Set(valid));
            } else {
                setHidden(new Set());
            }
        } catch {
            setOrder(defaultOrder);
            setHidden(new Set());
        }
    }, [defaultOrder]);

    // field -> kolon meta
    const byField = useMemo(() => {
        const m = new Map();
        allColumns.forEach((c) => m.set(c.field, c));
        return m;
    }, [allColumns]);

    // Filtreli listeler
    const visibleFields = useMemo(
        () =>
            order
                .filter((f) => !hidden.has(f))
                .filter((f) => {
                    if (!query.trim()) return true;
                    const h = (byField.get(f)?.headerName || f).toLowerCase();
                    return h.includes(query.toLowerCase());
                }),
        [order, hidden, byField, query]
    );

    const hiddenFields = useMemo(
        () =>
            order
                .filter((f) => hidden.has(f))
                .filter((f) => {
                    if (!query.trim()) return true;
                    const h = (byField.get(f)?.headerName || f).toLowerCase();
                    return h.includes(query.toLowerCase());
                }),
        [order, hidden, byField, query]
    );

    // --------- Drag & Drop (native) ----------
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const onDragStart = (index) => (e) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
    };
    const onDragOverRow = (index) => (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverIndex(index);
    };
    const onDropRow = (index) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        const from = dragIndex ?? Number(e.dataTransfer.getData("text/plain"));
        const to = index;
        if (from === null || Number.isNaN(from) || from === to) {
            setDragIndex(null);
            setDragOverIndex(null);
            return;
        }

        const visSet = new Set(visibleFields);
        const other = order.filter((f) => !visSet.has(f));
        const vis = order.filter((f) => visSet.has(f));

        const moved = [...vis];
        const [item] = moved.splice(from, 1);
        moved.splice(to, 0, item);

        setOrder([...moved, ...other]);
        setDragIndex(null);
        setDragOverIndex(null);
    };
    const onDragEnd = () => {
        setDragIndex(null);
        setDragOverIndex(null);
    };

    // Göster/Gizle
    const toggleHidden = (field) => () => {
        const h = new Set(hidden);
        if (h.has(field)) h.delete(field);
        else h.add(field);
        setHidden(h);
    };

    // Kaydet
    const onSaveClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const arrHidden = Array.from(hidden);

            // Kullanıcı anahtarları
            localStorage.setItem(ORDER_KEY, JSON.stringify(order));
            localStorage.setItem(HIDDEN_KEY, JSON.stringify(arrHidden));

            // GENERIC fallback anahtarları (liste oku fallback’i için)
            localStorage.setItem(GENERIC_ORDER_KEY, JSON.stringify(order));
            localStorage.setItem(GENERIC_HIDDEN_KEY, JSON.stringify(arrHidden));

            // Liste ekrana sinyal
            localStorage.setItem(VIEW_BUMP_KEY, String(Date.now()));

            setSnack({ open: true, msg: "Görünüm kaydedildi.", severity: "success" });
            setTimeout(() => navigate("/seferler"), 200);
        } catch {
            setSnack({ open: true, msg: "Kaydedilemedi.", severity: "error" });
        }
    };

    // Sıfırla
    const reset = () => {
        setOrder(defaultOrder);
        setHidden(new Set());
        try {
            localStorage.removeItem(ORDER_KEY);
            localStorage.removeItem(HIDDEN_KEY);
            localStorage.removeItem(GENERIC_ORDER_KEY);
            localStorage.removeItem(GENERIC_HIDDEN_KEY);
            setSnack({ open: true, msg: "Varsayılan görünüme dönüldü.", severity: "info" });
        } catch { }
    };

    return (
        <Box sx={{ p: 2, background: COLORS.pageBg, minHeight: "100dvh", color: COLORS.text }}>
            <Helmet><title>Sayfa Görünümü • Aktif Seferler</title></Helmet>

            {/* Başlık ve aksiyonlar */}
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1} sx={{ mb: 2 }}>
                <Stack spacing={0.25}>
                    <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1.1, background: "linear-gradient(90deg,#34D399,#60A5FA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        Sayfa Görünümü
                    </Typography>
                    <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                        Sütunları sürükleyip sırayı değiştirin; kutucukla göster/gizle yapın. Kaydet’ten sonra listeye döner.
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Button size="small" variant="text" startIcon={<ArrowBackIosNewIcon />} onClick={() => navigate(-1)}>Geri</Button>
                    <Button size="small" variant="text" startIcon={<HomeOutlinedIcon />} onClick={() => navigate("/anasayfa")}>Anasayfa</Button>
                    <Tooltip title="Varsayılanı yükle"><span><IconButton onClick={reset}><RestoreIcon /></IconButton></span></Tooltip>
                    <Button type="button" variant="contained" startIcon={<SaveIcon />} onClick={onSaveClick}>Kaydet</Button>
                </Stack>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ userSelect: "none" }}>
                {/* Görünür sütunlar */}
                <Paper sx={{ flex: 1, p: 2, border: `1px solid ${COLORS.border}`, background: COLORS.surface, borderRadius: 3 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" fontWeight={800}>Görünür Sütunlar</Typography>
                        <TextField
                            size="small"
                            placeholder="Sütun ara…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            sx={{
                                width: 220,
                                "& .MuiInputBase-root": { background: COLORS.surface2, color: COLORS.text, borderRadius: 1.2, border: `1px solid ${COLORS.border}`, fontSize: 14 }
                            }}
                        />
                    </Stack>
                    <Divider sx={{ mb: 1 }} />
                    <List dense>
                        {visibleFields.map((field, idx) => {
                            const c = byField.get(field);
                            const title = c?.headerName || field;
                            const dragging = idx === dragOverIndex;
                            return (
                                <ListItem
                                    key={field}
                                    disableGutters
                                    draggable
                                    onDragStart={onDragStart(idx)}
                                    onDragOver={onDragOverRow(idx)}
                                    onDrop={onDropRow(idx)}
                                    onDragEnd={onDragEnd}
                                    sx={{
                                        border: `1px dashed ${dragging ? COLORS.primary || "#3b82f6" : COLORS.border}`,
                                        borderRadius: 1.2, mb: 0.8, background: COLORS.surface2, pl: 0.75, pr: 1,
                                        cursor: "grab"
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                        <DragIndicatorIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primaryTypographyProps={{ fontSize: 14, fontWeight: 700 }}
                                        primary={title}
                                        secondaryTypographyProps={{ fontSize: 11, color: COLORS.textMuted }}
                                        secondary={field}
                                    />
                                    <Checkbox
                                        edge="end"
                                        onChange={toggleHidden(field)}
                                        checked={false} // görünür: işaretli değil
                                        inputProps={{ "aria-label": "Gizle" }}
                                    />
                                </ListItem>
                            );
                        })}
                        {!visibleFields.length && (
                            <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                                Görünür sütun yok. Sağdaki kutucuklarla sütunları geri açabilirsiniz.
                            </Typography>
                        )}
                    </List>
                </Paper>

                {/* Gizli sütunlar */}
                <Paper sx={{ width: { xs: "100%", md: 360 }, p: 2, border: `1px solid ${COLORS.border}`, background: COLORS.surface, borderRadius: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Gizli Sütunlar</Typography>
                    <Divider sx={{ mb: 1 }} />
                    <List dense>
                        {hiddenFields.map((field) => {
                            const c = byField.get(field);
                            const title = c?.headerName || field;
                            return (
                                <ListItem
                                    key={field}
                                    disableGutters
                                    sx={{
                                        border: `1px solid ${COLORS.border}`,
                                        borderRadius: 1.2,
                                        mb: 0.8,
                                        background: COLORS.surface2,
                                        pl: 0.75,
                                        pr: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between"
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center" }}>
                                        <ListItemIcon sx={{ minWidth: 28 }} />
                                        <ListItemText
                                            primaryTypographyProps={{ fontSize: 14, fontWeight: 700 }}
                                            primary={title}
                                            secondaryTypographyProps={{ fontSize: 11, color: COLORS.textMuted }}
                                            secondary={field}
                                        />
                                    </Box>
                                    <Checkbox
                                        edge="end"
                                        onChange={toggleHidden(field)}
                                        checked={true} // gizli: işaretli
                                        inputProps={{ "aria-label": "Göster" }}
                                    />
                                </ListItem>
                            );
                        })}
                        {!hiddenFields.length && (
                            <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                                Gizli sütun yok.
                            </Typography>
                        )}
                    </List>
                </Paper>
            </Stack>

            <Snackbar
                open={snack.open}
                autoHideDuration={2200}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
