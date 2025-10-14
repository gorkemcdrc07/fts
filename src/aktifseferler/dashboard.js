// src/aktifseferler/dashboard.jsx
import * as React from "react";
import {
    Box, Stack, Typography, Chip, IconButton, Divider, Collapse, Tooltip,
    LinearProgress, Paper, ButtonBase, useTheme, Container, TextField, MenuItem,
    Switch, FormControlLabel, Button, ToggleButton, ToggleButtonGroup, Dialog,
    DialogTitle, DialogContent, DialogActions, Table, TableHead, TableRow,
    TableCell, TableBody, CircularProgress
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DirectionsCarFilledIcon from "@mui/icons-material/DirectionsCarFilled";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import TimelineIcon from "@mui/icons-material/Timeline";
import FilterListIcon from "@mui/icons-material/FilterList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import TableRowsIcon from "@mui/icons-material/TableRows";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { alpha } from "@mui/material/styles";
import { supabase } from "../supabaseClient";

/* ---------- Helpers ---------- */
const fmt = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm} ${hh}:${mi}`;
};
const isToday = (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};
const minToHM = (m) => {
    const mm = Math.max(0, Math.round(m || 0));
    const h = Math.floor(mm / 60);
    const r = mm % 60;
    if (h && r) return `${h} saat ${r} dakika`;
    if (h) return `${h} saat`;
    return `${r} dakika`;
};
const ON_TIME_TOL_MIN = 15;
function riskOfLate(minutesLate) {
    if (minutesLate >= 6 * 60) return { lvl: "kritik", color: "error" };
    if (minutesLate >= 60) return { lvl: "yüksek", color: "warning" };
    if (minutesLate >= 15) return { lvl: "orta", color: "secondary" };
    return { lvl: "düşük", color: "default" };
}
const statusPalette = (theme) => ({
    red: theme.palette.mode === "dark" ? "#ef4444" : "#dc2626",
    amber: theme.palette.mode === "dark" ? "#f59e0b" : "#d97706",
    blue: theme.palette.mode === "dark" ? "#3b82f6" : "#2563eb",
    mint: theme.palette.mode === "dark" ? "#10b981" : "#059669",
});

/* ---------- Bölüm başlığı ---------- */
function SectionHeader({ icon, title, count, expanded, onToggle, color = "inherit", hint, rightSlot }) {
    const theme = useTheme();
    return (
        <Box
            sx={{
                position: "relative",
                borderRadius: 2.5,
                overflow: "hidden",
                "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    background:
                        theme.palette.mode === "dark"
                            ? "linear-gradient(90deg, rgba(59,130,246,0.08), rgba(147,51,234,0.08))"
                            : "linear-gradient(90deg, rgba(59,130,246,0.08), rgba(16,185,129,0.08))",
                    pointerEvents: "none",
                },
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                backdropFilter: "blur(6px)",
            }}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.25, py: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                        sx={{
                            width: 26, height: 26, borderRadius: 1.5, display: "grid", placeItems: "center",
                            background: "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))",
                            border: `1px solid ${alpha(theme.palette.common.white, 0.18)}`,
                            boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.common.white, 0.12)}`
                        }}
                    >
                        {icon}
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, letterSpacing: 0.2, color }}>
                        {title}
                    </Typography>
                    <Chip
                        size="small"
                        label={count}
                        sx={{
                            fontWeight: 800, borderRadius: 1.25,
                            background: theme.palette.mode === "dark" ? alpha("#93c5fd", 0.12) : alpha(theme.palette.primary.main, 0.08),
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                        }}
                    />
                    {hint ? (
                        <Tooltip title={hint} arrow>
                            <Box sx={{ ml: 0.5, width: 10, height: 10, borderRadius: "50%", bgcolor: color, opacity: 0.6 }} />
                        </Tooltip>
                    ) : null}
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                    {rightSlot}
                    <IconButton size="small" onClick={onToggle}>
                        <ExpandMoreIcon sx={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "0.2s" }} />
                    </IconButton>
                </Stack>
            </Stack>
        </Box>
    );
}

/* ---------- Modern rozet ---------- */
function NoteBadge({ title = "Açıklama mevcut" }) {
    return (
        <Tooltip title={title}>
            <Box sx={{
                position: "absolute", top: 0, left: 0, width: 0, height: 0,
                borderTop: "22px solid transparent", borderRight: "22px solid transparent",
                "&::after": {
                    content: '""', position: "absolute", top: 0, left: 0, width: 32, height: 32,
                    transform: "translate(-16px, -16px) rotate(45deg)", borderRadius: 1.25,
                    background: "linear-gradient(135deg, rgba(168,85,247,0.95) 0%, rgba(34,211,238,0.95) 100%)",
                    boxShadow: "0 8px 20px rgba(99,102,241,0.45), inset 0 0 0 1px rgba(255,255,255,0.5)"
                }
            }}>
                <Box sx={{
                    position: "absolute", top: 2.5, left: 2.5, width: 18, height: 18, display: "grid", placeItems: "center",
                    transform: "translateY(-50%) translateX(-50%)"
                }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 14, color: "#fff" }} />
                </Box>
            </Box>
        </Tooltip>
    );
}

/* ---------- Kart ---------- */
function RowCard({ title, subtitle, chips = [], onClick, color = "inherit", dense, hasNote }) {
    const theme = useTheme();
    return (
        <ButtonBase onClick={onClick} sx={{ width: "100%", textAlign: "left", borderRadius: 2.5 }}>
            <Box sx={{
                position: "relative", borderRadius: 2.5, p: 0.8,
                background: `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.18)}, ${alpha(theme.palette.secondary.main, 0.18)})`
            }}>
                <Paper
                    elevation={0}
                    sx={{
                        position: "relative", px: 1.25, py: dense ? 0.75 : 1, borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
                        background: alpha(theme.palette.background.paper, 0.7), backdropFilter: "blur(6px)",
                        transition: "transform .14s ease, box-shadow .14s ease, border-color .14s ease",
                        boxShadow: `0 4px 18px ${alpha(theme.palette.common.black, 0.12)}`,
                        "&:hover": { transform: "translateY(-2px)", borderColor: alpha(theme.palette.text.primary, 0.25), boxShadow: `0 10px 26px ${alpha(theme.palette.common.black, 0.16)}` }
                    }}
                >
                    {hasNote && <NoteBadge />}
                    <Stack direction="row" alignItems="center" spacing={1.25}>
                        <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, boxShadow: `0 0 0 3px ${alpha(color, 0.15)}`, mt: 0.25 }} />
                        <Stack sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, letterSpacing: 0.2, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {title}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>{subtitle}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {chips}
                        </Stack>
                    </Stack>
                </Paper>
            </Box>
        </ButtonBase>
    );
}

/* ---------- Grid helper ---------- */
function GridList({ items, render, pageSize = 12 }) {
    const [page, setPage] = React.useState(1);
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);

    return (
        <Stack spacing={1}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.1 }}>{slice.map(render)}</Box>
            {pages > 1 && (
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ pt: 0.5 }}>
                    <Button size="small" variant="outlined" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</Button>
                    <Typography variant="caption">{page} / {pages}</Typography>
                    <Button size="small" variant="outlined" disabled={page === pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Sonraki</Button>
                </Stack>
            )}
        </Stack>
    );
}

/* ---------- ANA DASHBOARD ---------- */
export default function Dashboard({ rows = [], onOpenRow, onAskReason, reasonNos = new Set(), bump }) {
    const theme = useTheme();
    const sp = statusPalette(theme);

    const byId = React.useMemo(() => {
        const m = new Map();
        rows.forEach((r) => m.set(r.id ?? r.sefer_no, r));
        return m;
    }, [rows]);

    const bySeferNo = React.useMemo(() => {
        const m = new Map();
        rows.forEach((r) => {
            const k = (r.sefer_no || "").toString().trim();
            if (k) m.set(k, r);
        });
        return m;
    }, [rows]);

    const deliveredCompare = React.useMemo(() => {
        const out = [];
        rows.forEach((r) => {
            const eta = r?.eta ? new Date(r.eta) : null;
            const teslimVarisISO = r?.detay?.teslim_varis || null;
            const tv = teslimVarisISO ? new Date(teslimVarisISO) : null;
            if (!eta || !tv) return;
            const diffMin = Math.round((tv - eta) / 60000);
            let durum = "zamanında";
            if (diffMin > ON_TIME_TOL_MIN) durum = "gecikme";
            else if (diffMin < -ON_TIME_TOL_MIN) durum = "erken";
            out.push({ ...r, teslim_varis: teslimVarisISO, eta_diff_min: diffMin, durum });
        });
        return out;
    }, [rows]);
    const deliveredNotOnEta = React.useMemo(() => deliveredCompare.filter((x) => x.durum !== "zamanında"), [deliveredCompare]);

    // === ŞU AN GEÇ GÖRÜNENLER (ilk bacak kuralı) ===
    const liveLate = React.useMemo(() => {
        const now = Date.now();
        return rows
            .filter((r) => !!r?.eta)
            .map((r) => ({ ...r, etaDate: new Date(r.eta) }))
            .filter((r) => !Number.isNaN(r.etaDate.getTime()))
            .filter((r) => {
                // ETA aşılmış olmalı
                if (r.etaDate.getTime() >= now) return false;

                // hızlı bayrak: EditorDialog’daki 1.nokta teslim_varis doluysa gösterme
                if (r?.first_has_teslim_varis === true) return false;

                // detay üzerinden emniyetli kontrol (geriye dönük alan adları dahil)
                const d = r?.detay ?? {};
                const firstTV =
                    d.first_teslim_varis ??
                    d.first_teslim_giris ??  // alias
                    d.ilk_teslim_varis ??    // eski ad olasılığı
                    "";
                return String(firstTV || "").trim().length === 0;
            });
    }, [rows]);
    const etaMissingToday = React.useMemo(
        () => rows.filter((r) => !r?.eta && r?.sefer_tarihi && isToday(r.sefer_tarihi)),
        [rows]
    );

    /* --------- LOG GÖRÜNÜRLÜĞÜ: sadece kendi logunu gör --------- */
    const normalizeUser = (s = "") =>
        s.normalize("NFKC").toLocaleLowerCase("tr-TR").replace(/\s+/g, "");
    const meRaw = localStorage.getItem("kullaniciAdi") || "-";
    const me = normalizeUser(meRaw);
    // tüm logları görme yetkisi olan kullanıcılar
    const ALL_VIEWERS = new Set(["admin", "bekirakcagoz"]);
    const isAllViewer = ALL_VIEWERS.has(me);

    const recentLogs = React.useMemo(() => {
        try {
            const all = JSON.parse(localStorage.getItem("aktifseferler.logs") || "[]");
            const todays = all.filter((x) => isToday(x.ts));
            const visible = isAllViewer
                ? todays
                : todays.filter((l) => normalizeUser(l.user || "-") === me);
            return visible.slice(0, 10);
        } catch {
            return [];
        }
    }, [rows.length, bump, isAllViewer, me]);

    const [openDelivered, setOpenDelivered] = React.useState(false);
    const [openLive, setOpenLive] = React.useState(false);
    const [openMissing, setOpenMissing] = React.useState(false);
    const [openLogs, setOpenLogs] = React.useState(false);

    const [onlyHigh, setOnlyHigh] = React.useState(false);
    const [sortKey, setSortKey] = React.useState("lateDesc");
    const [dense, setDense] = React.useState(true);
    const [view, setView] = React.useState("grid");

    const hasNote = React.useCallback(
        (sefer_no) => {
            const sn = (sefer_no || "").toString().trim();
            return sn && reasonNos.has(sn);
        },
        [reasonNos]
    );

    const prepare = React.useCallback(
        (arr, kind) => {
            let list = [...arr];
            if (kind === "live") {
                list = list.map((r) => {
                    const lateMin = Math.max(0, Math.round((Date.now() - r.etaDate.getTime()) / 60000));
                    const rk = riskOfLate(lateMin);
                    return { ...r, __lateMin: lateMin, __risk: rk };
                });
                if (onlyHigh) list = list.filter((x) => ["yüksek", "kritik"].includes(x.__risk.lvl));
                if (sortKey === "lateDesc") list.sort((a, b) => b.__lateMin - a.__lateMin);
                if (sortKey === "etaAsc") list.sort((a, b) => a.etaDate - b.etaDate);
                if (sortKey === "codeAsc") list.sort((a, b) => String(a.sefer_no).localeCompare(String(b.sefer_no)));
            }
            if (kind === "delivered") {
                list = list.map((r) => {
                    const lateMin = Math.abs(r.eta_diff_min);
                    const overdue = r.eta_diff_min > 0 ? lateMin : 0;
                    const rk = riskOfLate(overdue);
                    return { ...r, __lateMin: overdue, __risk: rk };
                });
                if (onlyHigh) list = list.filter((x) => ["yüksek", "kritik"].includes(x.__risk.lvl));
                if (sortKey === "lateDesc") list.sort((a, b) => b.__lateMin - a.__lateMin);
                if (sortKey === "etaAsc") list.sort((a, b) => new Date(a.teslim_varis) - new Date(b.teslim_varis));
                if (sortKey === "codeAsc") list.sort((a, b) => String(a.sefer_no).localeCompare(String(b.sefer_no)));
            }
            return list;
        },
        [onlyHigh, sortKey]
    );

    /* ---------- RAPOR PANELİ ---------- */
    const [reportOpen, setReportOpen] = React.useState(false);
    const [reportTitle, setReportTitle] = React.useState("");
    const [reportKind, setReportKind] = React.useState(null); // "live" | "delivered"
    const [reportRows, setReportRows] = React.useState([]);
    const [reportLoading, setReportLoading] = React.useState(false);

    const openReport = async (kind) => {
        if (kind === "live") {
            const list = prepare(liveLate, "live");
            const nos = Array.from(new Set(list.map((r) => (r.sefer_no || "").toString().trim()).filter(Boolean)));

            setReportTitle("Rapor • Şu an geç görünenler");
            setReportKind("live");
            setReportOpen(true);
            setReportLoading(true);
            try {
                let rowsOut = [];
                if (nos.length) {
                    const { data, error } = await supabase
                        .from("eta_gecikme_nedenleri")
                        .select("sefer_no,kategori,aciklama,kaydeden,kayit_zamani,sefer_tarihi,eta_varis,gecikme_suresi_dk")
                        .in("sefer_no", nos)
                        .order("kayit_zamani", { ascending: false });

                    if (error) throw error;

                    rowsOut = (data || []).map((r) => {
                        const base = bySeferNo.get((r.sefer_no || "").toString().trim()) || {};
                        return {
                            sefer_no: r.sefer_no,
                            plaka: base.plaka || "-",
                            surucu: base.surucu_ad_soyad || "-",
                            kategori: r.kategori || "-",
                            aciklama: r.aciklama || "-",
                            kaydeden: r.kaydeden || "-",
                            kayit_zamani: r.kayit_zamani || null,
                            sefer_tarihi: r.sefer_tarihi || null,
                            eta: r.eta_varis || null,
                            gecikme_dk: typeof r.gecikme_suresi_dk === "number" ? r.gecikme_suresi_dk : null,
                        };
                    });
                }
                setReportRows(rowsOut);
            } catch (e) {
                setReportRows([]);
                console.error("Rapor (live) fetch error:", e?.message || e);
            } finally {
                setReportLoading(false);
            }
            return;
        }

        if (kind === "delivered") {
            const list = prepare(deliveredNotOnEta, "delivered");
            const mapped = list.map((r) => ({
                sefer_no: r.sefer_no,
                plaka: r.plaka || "-",
                surucu: r.surucu_ad_soyad || "-",
                eta: r.eta,
                teslim_varis: r.teslim_varis,
                fark_dk: r.eta_diff_min,
                durum: r.durum,
                risk: riskOfLate(r.eta_diff_min > 0 ? Math.abs(r.eta_diff_min) : 0).lvl,
            }));
            setReportRows(mapped);
            setReportTitle("Rapor • Teslim varış ≠ ETA");
            setReportKind("delivered");
            setReportOpen(true);
        }
    };

    /* ---------- Excel (CSV) aktar ---------- */
    const csvEscape = (val) => {
        const s = String(val ?? "");
        if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    const downloadCSV = (filename, headers, rows) => {
        const sep = ";";
        const headerLine = headers.map(csvEscape).join(sep);
        const lines = rows.map((r) => r.map(csvEscape).join(sep));
        const csv = [headerLine, ...lines].join("\r\n");
        const bom = "\uFEFF";
        const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    };
    const exportToExcel = () => {
        if (!reportRows.length || !reportKind) return;
        const pad = (n) => String(n).padStart(2, "0");
        const ts = new Date();
        if (reportKind === "live") {
            const headers = ["Sefer No", "Plaka", "Şoför", "Kategori", "Açıklama", "ETA", "Gecikme (saat/dk)", "Kaydeden", "Kayıt Zamanı"];
            const rows = reportRows.map((r) => [
                r.sefer_no || "-", r.plaka || "-", r.surucu || "-", r.kategori || "-",
                r.aciklama || "-", fmt(r.eta), minToHM(r.gecikme_dk ?? 0), r.kaydeden || "-", fmt(r.kayit_zamani)
            ]);
            const name = `rapor_gec_gorunenler_${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}`;
            downloadCSV(name, headers, rows);
        } else {
            const headers = ["Sefer No", "Plaka", "Şoför", "ETA", "Teslim Varış", "Fark (saat/dk)", "Durum", "Risk"];
            const rows = reportRows.map((r) => [
                r.sefer_no || "-", r.plaka || "-", r.surucu || "-", fmt(r.eta), fmt(r.teslim_varis),
                minToHM(Math.abs(r.fark_dk ?? 0)), (r.durum || "-").toString().toUpperCase(), r.risk || "-"
            ]);
            const name = `rapor_teslim_eta_fark_${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}`;
            downloadCSV(name, headers, rows);
        }
    };

    /* ---------- UI ---------- */
    function Controls() {
        return (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }}
                sx={{
                    pb: 0.5, px: 0.75, pt: 0.75, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                    background: alpha(theme.palette.background.paper, 0.5), backdropFilter: "blur(6px)"
                }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <FilterListIcon fontSize="small" />
                    <FormControlLabel control={<Switch size="small" checked={onlyHigh} onChange={(e) => setOnlyHigh(e.target.checked)} />}
                        label={<Typography variant="caption">Sadece yüksek/kritik</Typography>} />
                </Stack>

                <TextField select size="small" value={sortKey} onChange={(e) => setSortKey(e.target.value)} label="Sırala" sx={{ minWidth: 180 }}>
                    <MenuItem value="lateDesc">Gecikme (azalan)</MenuItem>
                    <MenuItem value="etaAsc">ETA / Teslim (artan)</MenuItem>
                    <MenuItem value="codeAsc">Sefer No (A→Z)</MenuItem>
                </TextField>

                <FormControlLabel control={<Switch size="small" checked={dense} onChange={(e) => setDense(e.target.checked)} />}
                    label={<Typography variant="caption">Sıkı görünüm</Typography>} />

                <Box sx={{ flex: 1 }} />

                <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}
                    sx={{ background: alpha(theme.palette.background.paper, 0.6), border: `1px solid ${alpha(theme.palette.divider, 0.8)}`, borderRadius: 2 }}>
                    <ToggleButton value="grid" sx={{ px: 1.2 }}><ViewModuleIcon fontSize="small" /></ToggleButton>
                    <ToggleButton value="list" sx={{ px: 1.2 }}><TableRowsIcon fontSize="small" /></ToggleButton>
                </ToggleButtonGroup>
            </Stack>
        );
    }

    return (
        <Container maxWidth="lg" disableGutters>
            <Stack spacing={1.25}>
                <SectionHeader
                    icon={<AccessTimeIcon fontSize="small" />}
                    title="Şu an geç görünenler"
                    count={liveLate.length}
                    expanded={openLive}
                    onToggle={() => setOpenLive((v) => !v)}
                    color={sp.amber}
                    rightSlot={<Button size="small" variant="outlined" onClick={() => openReport("live")}>Raporla</Button>}
                />
                <Collapse in={openLive} unmountOnExit>
                    <Controls />
                    {(() => {
                        const list = prepare(liveLate, "live");
                        const renderItem = (r) => {
                            const chips = [
                                <Chip key="risk" size="small" label={`Risk: ${r.__risk.lvl}`} color={r.__risk.color}
                                    variant={r.__risk.color === "default" ? "outlined" : "filled"} />,
                                <Chip key="late" size="small" label={`+${minToHM(r.__lateMin)}`} variant="outlined" color="warning" />,
                            ];
                            const full = byId.get(r.id ?? r.sefer_no) || r;
                            return (
                                <RowCard key={r.id ?? r.sefer_no} title={r.sefer_no || "-"} subtitle={`ETA: ${fmt(r.eta)}`}
                                    chips={chips} color={sp.amber} dense={dense} hasNote={hasNote(r.sefer_no)}
                                    onClick={() => { onOpenRow && onOpenRow(full, { readOnly: true }); onAskReason && onAskReason(full); }} />
                            );
                        };
                        return view === "grid" ? <GridList items={list} render={renderItem} pageSize={12} /> : <Stack spacing={0.9}>{list.map(renderItem)}</Stack>;
                    })()}
                </Collapse>

                <Divider sx={{ opacity: 0.08 }} />

                <SectionHeader
                    icon={<CheckCircleOutlineIcon fontSize="small" />}
                    title="Teslim varış ≠ ETA"
                    count={deliveredNotOnEta.length}
                    expanded={openDelivered}
                    onToggle={() => setOpenDelivered((v) => !v)}
                    color={sp.red}
                    hint="Gerçek teslim zamanı ile kayıtlı ETA farkı"
                    rightSlot={<Button size="small" variant="outlined" color="error" onClick={() => openReport("delivered")}>Raporla</Button>}
                />
                <Collapse in={openDelivered} unmountOnExit>
                    <Controls />
                    {(() => {
                        const list = prepare(deliveredNotOnEta, "delivered");
                        const renderItem = (r) => {
                            const chips = [
                                <Chip key="state" size="small" label={r.durum.toUpperCase()} color={r.durum === "gecikme" ? "error" : "success"} />,
                                <Chip key="risk" size="small" label={`Risk: ${r.__risk.lvl}`} color={r.__risk.color}
                                    variant={r.__risk.color === "default" ? "outlined" : "filled"} />,
                                <Chip key="diff" size="small" variant="outlined" label={`${r.eta_diff_min > 0 ? "+" : ""}${minToHM(Math.abs(r.eta_diff_min))}`} />,
                            ];
                            return (
                                <RowCard key={r.id ?? r.sefer_no}
                                    title={r.sefer_no || "-"} subtitle={`ETA: ${fmt(r.eta)} • Teslim: ${fmt(r.teslim_varis)}`}
                                    chips={chips} color={sp.red} dense={dense} hasNote={hasNote(r.sefer_no)}
                                    onClick={() => onOpenRow && onOpenRow(byId.get(r.id ?? r.sefer_no) || r)} />
                            );
                        };
                        return view === "grid" ? <GridList items={list} render={renderItem} pageSize={12} /> : <Stack spacing={0.9}>{list.map(renderItem)}</Stack>;
                    })()}
                </Collapse>

                <Divider sx={{ opacity: 0.08 }} />

                <SectionHeader
                    icon={<DirectionsCarFilledIcon fontSize="small" />}
                    title="ETA eksik (bugün)"
                    count={etaMissingToday.length}
                    expanded={openMissing}
                    onToggle={() => setOpenMissing((v) => !v)}
                    color={sp.blue}
                />
                <Collapse in={openMissing} unmountOnExit>
                    {etaMissingToday.length === 0 ? (
                        <Typography variant="caption" sx={{ opacity: 0.7, px: 0.5 }}>Bugün için eksik ETA yok.</Typography>
                    ) : (
                        <GridList
                            items={etaMissingToday}
                            render={(r) => (
                                <RowCard key={r.id ?? r.sefer_no} title={r.sefer_no || "-"} subtitle={`Sefer Tarihi: ${fmt(r.sefer_tarihi)}`}
                                    chips={[<Chip key="tag" size="small" label="ETA YOK" variant="outlined" />]}
                                    color={sp.blue} dense={dense} hasNote={hasNote(r.sefer_no)}
                                    onClick={() => onOpenRow && onOpenRow(byId.get(r.id ?? r.sefer_no) || r)} />
                            )}
                            pageSize={12}
                        />
                    )}
                </Collapse>

                <Divider sx={{ opacity: 0.08 }} />

                <SectionHeader
                    icon={<TimelineIcon fontSize="small" />}
                    title="Bugün güncellenen alanlar (son 10)"
                    count={recentLogs.length}
                    expanded={openLogs}
                    onToggle={() => setOpenLogs((v) => !v)}
                    color={sp.mint}
                />
                <Collapse in={openLogs} unmountOnExit>
                    {recentLogs.length === 0 ? (
                        <Typography variant="caption" sx={{ opacity: 0.7, px: 0.5 }}>Bugün için log kaydı yok.</Typography>
                    ) : (
                        <GridList
                            items={recentLogs}
                            render={(l, i) => (
                                <RowCard key={`${l.ts}-${i}`} title={l.sefer_no || "-"}
                                    subtitle={`${l.user} • ${fmt(l.ts)} • ${l.action}${l.fields?.length ? ` [${l.fields.join(", ")}]` : ""}`}
                                    chips={[]} color={sp.mint} dense={dense} hasNote={hasNote(l.sefer_no)}
                                    onClick={() => {
                                        const found = rows.find((r) => (r.sefer_no || "").toString() === (l.sefer_no || "").toString()) || null;
                                        if (found && onOpenRow) onOpenRow(found);
                                    }} />
                            )}
                            pageSize={12}
                        />
                    )}
                </Collapse>

                <Box sx={{ mt: 0.5 }}>
                    <LinearProgress sx={{ height: 2, borderRadius: 6, opacity: 0.18 }} />
                </Box>
            </Stack>

            {/* ---------- RAPOR DİYALOĞU ---------- */}
            <Dialog open={reportOpen} onClose={() => setReportOpen(false)} fullWidth maxWidth="lg"
                PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
                <DialogTitle sx={{ fontWeight: 900, display: "flex", alignItems: "center", gap: 1 }}>
                    {reportTitle}
                    {reportLoading && <CircularProgress size={16} sx={{ ml: 0.5 }} />}
                </DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    <Box sx={{ maxHeight: 560, overflow: "auto" }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 800 }}>Sefer No</TableCell>
                                    <TableCell sx={{ fontWeight: 800 }}>Plaka</TableCell>
                                    <TableCell sx={{ fontWeight: 800 }}>Şoför</TableCell>
                                    {reportKind === "live" ? <TableCell sx={{ fontWeight: 800 }}>Kategori</TableCell> : null}
                                    {reportKind === "live" ? <TableCell sx={{ fontWeight: 800 }}>Açıklama</TableCell> : null}
                                    <TableCell sx={{ fontWeight: 800 }}>ETA</TableCell>
                                    {reportKind === "delivered" ? <TableCell sx={{ fontWeight: 800 }}>Teslim Varış</TableCell> : null}
                                    <TableCell sx={{ fontWeight: 800 }}>{reportKind === "delivered" ? "Fark (saat/dk)" : "Gecikme (saat/dk)"}</TableCell>
                                    {reportKind === "delivered" ? <TableCell sx={{ fontWeight: 800 }}>Durum</TableCell> : null}
                                    <TableCell sx={{ fontWeight: 800 }}>{reportKind === "live" ? "Kaydeden" : "Risk"}</TableCell>
                                    {reportKind === "live" ? <TableCell sx={{ fontWeight: 800 }}>Kayıt Zamanı</TableCell> : null}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {reportRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9}>
                                            <Typography variant="body2" sx={{ opacity: 0.7, p: 2 }}>
                                                Kayıt bulunamadı.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    reportRows.map((r, i) => (
                                        <TableRow key={`${r.sefer_no}-${i}`} hover>
                                            <TableCell>{r.sefer_no}</TableCell>
                                            <TableCell>{r.plaka || "-"}</TableCell>
                                            <TableCell>{r.surucu || "-"}</TableCell>
                                            {reportKind === "live" ? <TableCell>{r.kategori}</TableCell> : null}
                                            {reportKind === "live" ? <TableCell>{r.aciklama}</TableCell> : null}
                                            <TableCell>{fmt(r.eta)}</TableCell>
                                            {reportKind === "delivered" ? <TableCell>{fmt(r.teslim_varis)}</TableCell> : null}
                                            <TableCell>{reportKind === "delivered" ? minToHM(Math.abs(r.fark_dk ?? 0)) : minToHM(r.gecikme_dk ?? 0)}</TableCell>
                                            {reportKind === "delivered" ? <TableCell>{r.durum?.toUpperCase?.() || "-"}</TableCell> : null}
                                            <TableCell>{reportKind === "live" ? r.kaydeden : r.risk}</TableCell>
                                            {reportKind === "live" ? <TableCell>{fmt(r.kayit_zamani)}</TableCell> : null}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={exportToExcel} variant="contained" disabled={!reportRows.length}>
                        Excel’e aktar
                    </Button>
                    <Button onClick={() => setReportOpen(false)}>Kapat</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}
