// src/kayit-islemleri/km-kayit.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
    Box, Paper, Typography, Stack, TextField, Button, Divider,
    Snackbar, Alert, InputAdornment, Tooltip, IconButton, Fade
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import SpeedIcon from "@mui/icons-material/Speed";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import { DataGrid } from "@mui/x-data-grid";
import { supabase } from "../supabaseClient";

// --- MODERN TASARIM BİLEŞENLERİ ---
const PRIMARY_NEON = "#00f2fe"; // Daha canlı bir cyan
const SECONDARY_NEON = "#4facfe";
const ACCENT_PURPLE = "#7000ff";
const DARK_BG = "#0b0f1a";

const StyledDataGrid = styled(DataGrid)(({ theme }) => ({
    border: "none",
    fontFamily: "'Inter', sans-serif",
    "& .MuiDataGrid-columnHeaders": {
        backgroundColor: alpha("#161d31", 0.8),
        color: alpha("#fff", 0.6),
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "1px",
        textTransform: "uppercase",
        borderBottom: `1px solid ${alpha(PRIMARY_NEON, 0.2)}`,
    },
    "& .MuiDataGrid-row": {
        backgroundColor: "transparent",
        transition: "all 0.2s ease",
        "&:hover": {
            backgroundColor: alpha(PRIMARY_NEON, 0.05),
            boxShadow: `inset 4px 0 0 ${PRIMARY_NEON}`,
        },
    },
    "& .MuiDataGrid-cell": {
        borderBottom: `1px solid ${alpha("#fff", 0.05)}`,
        color: "#e2e8f0",
        display: "flex",
        alignItems: "center",
    },
    "& .MuiDataGrid-editInputCell": {
        backgroundColor: alpha("#000", 0.3),
        color: PRIMARY_NEON,
        borderRadius: "8px",
        "& input": { textAlign: "center", fontWeight: "bold" }
    }
}));

const ActionCard = styled(Paper)(({ theme }) => ({
    padding: "24px",
    borderRadius: "24px",
    backgroundColor: alpha("#161d31", 0.6),
    border: `1px solid ${alpha("#fff", 0.08)}`,
    backdropFilter: "blur(20px)",
    boxShadow: `0 8px 32px 0 ${alpha("#000", 0.8)}`,
}));

// --- YARDIMCI FONKSİYONLAR (Mevcut mantık korundu) ---
function toCSV(rows) {
    if (!rows?.length) return "";
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadCSV(filename, csv) {
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function fetchAll(builderFactory, pageSize = 1000) {
    const all = [];
    let from = 0;
    while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await builderFactory().range(from, to);
        if (error) throw error;
        const chunk = data || [];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
    }
    return all;
}

function cleanStr(v) { const s = String(v ?? "").trim(); return s.length ? s : null; }
function formatDateTR(v) {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}
function dateKey(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); }
function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < (arr?.length || 0); i += size) out.push(arr.slice(i, i + size));
    return out;
}

function normSemi(v) {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const parts = s.split(";").map(x => x.trim()).filter(Boolean).map(x => x.toLowerCase());
    parts.sort((a, b) => a.localeCompare(b, "tr"));
    return parts.join(";");
}

function buildSignature(obj) {
    return [
        normSemi(obj?.musteri_adi), normSemi(obj?.proje_adi), normSemi(obj?.yukleme_noktasi),
        normSemi(obj?.yukleme_ili), normSemi(obj?.yukleme_ilcesi), normSemi(obj?.teslim_noktasi),
        normSemi(obj?.teslim_ili), normSemi(obj?.teslim_ilcesi),
    ].join("|");
}

async function runPool(tasks, concurrency = 6) {
    const results = [];
    let i = 0;
    async function worker() {
        while (i < tasks.length) {
            const idx = i++;
            results[idx] = await tasks[idx]();
        }
    }
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

function buildRowsGrouped(seferler, detaylar, reelMaps) {
    const seferMap = {};
    (seferler || []).forEach((s) => { if (s?.sefer_no) seferMap[s.sefer_no] = s; });
    const dMap = {};
    (detaylar || []).forEach((d) => {
        const key = d?.sefer_no; if (!key) return;
        if (!dMap[key]) dMap[key] = [];
        dMap[key].push(d);
    });

    const uniqueJoin = (arr) => {
        const list = (arr || []).map(cleanStr).filter(Boolean);
        const uniq = Array.from(new Set(list));
        return uniq.length === 0 ? "-" : (uniq.length === 1 ? uniq[0] : uniq.join(" ; "));
    };

    const pickOne = (arr, fallback = "-") => (arr || []).map(cleanStr).find(Boolean) ?? fallback;

    const applyReelOverride = (row) => {
        const byNo = reelMaps?.byNo || {};
        const bySig = reelMaps?.bySig || {};
        const ov = byNo?.[row?.sefer_no] || bySig?.[buildSignature(row)];
        if (!ov) return row;
        return {
            ...row,
            musteri_adi: cleanStr(ov.musteri_adi) ?? row.musteri_adi ?? "-",
            proje_adi: cleanStr(ov.proje_adi) ?? row.proje_adi ?? "-",
            yukleme_noktasi: cleanStr(ov.yukleme_noktasi) ?? row.yukleme_noktasi ?? "-",
            yukleme_ili: cleanStr(ov.yukleme_ili) ?? row.yukleme_ili ?? "-",
            yukleme_ilcesi: cleanStr(ov.yukleme_ilcesi) ?? row.yukleme_ilcesi ?? "-",
            teslim_noktasi: cleanStr(ov.teslim_noktasi) ?? row.teslim_noktasi ?? "-",
            teslim_ili: cleanStr(ov.teslim_ili) ?? row.teslim_ili ?? "-",
            teslim_ilcesi: cleanStr(ov.teslim_ilcesi) ?? row.teslim_ilcesi ?? "-",
            reel_km: cleanStr(ov.sefer_km) ?? row.reel_km ?? "-",
        };
    };

    const rows = Object.keys(dMap).map((seferNo) => {
        const s = seferMap[seferNo] || null;
        const list = dMap[seferNo] || [];
        const baseRow = {
            id: seferNo, sefer_no: seferNo,
            sefer_tarihi_raw: s?.sefer_tarihi ?? null,
            sefer_tarihi: formatDateTR(s?.sefer_tarihi),
            musteri_adi: s?.musteri_adi ?? "-",
            proje_adi: uniqueJoin([...list.map((x) => x?.proje_adi), s?.proje_adi]),
            yukleme_noktasi: uniqueJoin([...list.map((x) => x?.yukleme_noktasi), s?.yukleme_noktasi]),
            yukleme_ili: uniqueJoin([...list.map((x) => x?.yukleme_ili), s?.yukleme_ili]),
            yukleme_ilcesi: uniqueJoin([...list.map((x) => x?.yukleme_ilcesi), s?.yukleme_ilcesi]),
            teslim_noktasi: uniqueJoin([...list.map((x) => x?.teslim_noktasi), s?.teslim_noktasi]),
            teslim_ili: uniqueJoin([...list.map((x) => x?.teslim_ili), s?.teslim_ili]),
            teslim_ilcesi: uniqueJoin([...list.map((x) => x?.teslim_ilcesi), s?.teslim_ilcesi]),
            reel_km: pickOne(list.map((x) => x?.kayitli_km), cleanStr(s?.kayitli_km) ?? "-"),
            manuel_km: pickOne([s?.yeni_km, ...list.map((x) => x?.yeni_km)], "-"),
        };
        return applyReelOverride(baseRow);
    });

    (seferler || []).forEach((s) => {
        if (!s?.sefer_no || dMap[s.sefer_no]) return;
        const baseRow = {
            id: s.sefer_no, sefer_no: s.sefer_no,
            sefer_tarihi_raw: s?.sefer_tarihi ?? null,
            sefer_tarihi: formatDateTR(s?.sefer_tarihi),
            musteri_adi: s?.musteri_adi ?? "-",
            proje_adi: cleanStr(s?.proje_adi) ?? "-",
            yukleme_noktasi: cleanStr(s?.yukleme_noktasi) ?? "-",
            yukleme_ili: cleanStr(s?.yukleme_ili) ?? "-",
            yukleme_ilcesi: cleanStr(s?.yukleme_ilcesi) ?? "-",
            teslim_noktasi: cleanStr(s?.teslim_noktasi) ?? "-",
            teslim_ili: cleanStr(s?.teslim_ili) ?? "-",
            teslim_ilcesi: cleanStr(s?.teslim_ilcesi) ?? "-",
            reel_km: cleanStr(s?.kayitli_km) ?? "-",
            manuel_km: cleanStr(s?.yeni_km) ?? "-",
        };
        rows.push(applyReelOverride(baseRow));
    });

    return rows.sort((a, b) => dateKey(b.sefer_tarihi_raw) - dateKey(a.sefer_tarihi_raw));
}

// --- ANA BİLEŞEN ---
export default function KmKayit() {
    const [loading, setLoading] = useState(true);
    const [seferler, setSeferler] = useState([]);
    const [detaylar, setDetaylar] = useState([]);
    const [q, setQ] = useState("");
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 10);
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "info" });
    const [reelMaps, setReelMaps] = useState({ byNo: {}, bySig: {} });
    const [reelLoading, setReelLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const seferAll = await fetchAll(() =>
                supabase.from("tamamlanan_seferler").select("*")
                    .gte("sefer_tarihi", `${dateFrom}T00:00:00`)
                    .lte("sefer_tarihi", `${dateTo}T23:59:59`)
                    .order("sefer_tarihi", { ascending: false })
            );
            const detayAll = await fetchAll(() => supabase.from("tamamlanan_detaylar").select("*"));
            setSeferler(seferAll);
            setDetaylar(detayAll);
        } catch (e) {
            setSnack({ open: true, msg: "Hata oluştu.", severity: "error" });
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const rows = useMemo(() => buildRowsGrouped(seferler, detaylar, reelMaps), [seferler, detaylar, reelMaps]);
    const filteredRows = useMemo(() => {
        const term = q.toLowerCase().trim();
        if (!term) return rows;
        return rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(term)));
    }, [rows, q]);

    const saveManuelKmToSupabase = useCallback(async (sefer_no, yeni_km_raw) => {
        const val = cleanStr(yeni_km_raw);
        await supabase.from("tamamlanan_seferler").update({ yeni_km: val }).eq("sefer_no", sefer_no);
        await supabase.from("tamamlanan_detaylar").update({ yeni_km: val }).eq("sefer_no", sefer_no);

        setSeferler(prev => prev.map(s => s.sefer_no === sefer_no ? { ...s, yeni_km: val } : s));
        setDetaylar(prev => prev.map(d => d.sefer_no === sefer_no ? { ...d, yeni_km: val } : d));
        return val;
    }, []);

    const fetchReelKmValues = async () => {
        try {
            setReelLoading(true);
            const seferNos = Array.from(new Set((filteredRows || []).map(r => cleanStr(r?.sefer_no)).filter(Boolean)));
            if (!seferNos.length) {
                setSnack({ open: true, msg: "Sorgulanacak sefer bulunamadı.", severity: "warning" });
                return;
            }
            const chunks = chunkArray(seferNos, 900);
            const tasks = chunks.map(part => async () => {
                const { data } = await supabase.from("reel_km").select("*").in("sefer_no", part);
                return data || [];
            });
            const results = await runPool(tasks, 6);
            const flat = results.flat();
            const mapByNo = {}; const mapBySig = {};
            flat.forEach(r => {
                if (r.sefer_no) mapByNo[r.sefer_no] = r;
                const sig = buildSignature(r);
                if (sig) mapBySig[sig] = r;
            });
            setReelMaps({ byNo: mapByNo, bySig: mapBySig });
            setSnack({ open: true, msg: `KM güncellendi: ${flat.length} kayıt.`, severity: "success" });
        } catch (e) {
            setSnack({ open: true, msg: "Hata oluştu.", severity: "error" });
        } finally { setReelLoading(false); }
    };

    const columns = [
        {
            field: "sefer_no",
            headerName: "Sefer No",
            width: 140,
            renderCell: (p) => (
                <Typography sx={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: PRIMARY_NEON,
                    fontWeight: 700,
                    fontSize: "0.85rem"
                }}>
                    #{p.value}
                </Typography>
            ),
        },
        {
            field: "sefer_tarihi",
            headerName: "Tarih",
            width: 130,
            renderCell: (p) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <CalendarMonthIcon sx={{ fontSize: 16, opacity: 0.5 }} />
                    <Typography sx={{ fontSize: "0.85rem" }}>{p.value}</Typography>
                </Stack>
            )
        },
        {
            field: "musteri_adi",
            headerName: "Müşteri",
            flex: 1,
            minWidth: 180,
            renderCell: (p) => (
                <Tooltip title={p.value}>
                    <Typography noWrap sx={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.value}</Typography>
                </Tooltip>
            )
        },
        { field: "yukleme_ili", headerName: "Yükleme", width: 120 },
        { field: "teslim_ili", headerName: "Teslim", width: 120 },
        {
            field: "reel_km",
            headerName: "Reel KM",
            width: 110,
            align: "center",
            headerAlign: "center",
            renderCell: (p) => (
                <Box sx={{
                    px: 1.5, py: 0.5, borderRadius: "6px",
                    bgcolor: alpha(PRIMARY_NEON, 0.1),
                    border: `1px solid ${alpha(PRIMARY_NEON, 0.3)}`,
                    color: PRIMARY_NEON, fontWeight: "bold"
                }}>
                    {p.value}
                </Box>
            )
        },
        {
            field: "manuel_km",
            headerName: "Manuel KM",
            width: 120,
            editable: true,
            type: "number",
            align: "center",
            headerAlign: "center",
            renderCell: (p) => (
                <Box sx={{
                    px: 1.5, py: 0.5, borderRadius: "6px",
                    bgcolor: alpha("#fff", 0.05),
                    border: `1px solid ${alpha("#fff", 0.1)}`,
                    fontWeight: "bold"
                }}>
                    {p.value === "-" ? "Düzenle" : p.value}
                </Box>
            )
        },
    ];

    return (
        <Box sx={{
            p: { xs: 2, md: 4 }, minHeight: "100vh", bgcolor: DARK_BG,
            backgroundImage: `radial-gradient(circle at 2% 2%, ${alpha(SECONDARY_NEON, 0.15)} 0%, transparent 40%), 
                             radial-gradient(circle at 98% 98%, ${alpha(ACCENT_PURPLE, 0.15)} 0%, transparent 40%)`
        }}>
            <Fade in timeout={800}>
                <Box>
                    {/* Üst Başlık ve İstatistikler */}
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box sx={{
                                p: 1.5, borderRadius: "16px",
                                background: `linear-gradient(135deg, ${PRIMARY_NEON}, ${SECONDARY_NEON})`,
                                boxShadow: `0 0 20px ${alpha(PRIMARY_NEON, 0.4)}`
                            }}>
                                <SpeedIcon sx={{ color: DARK_BG, fontSize: 32 }} />
                            </Box>
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
                                    KM Yönetim Paneli
                                </Typography>
                                <Typography variant="body2" sx={{ color: alpha("#fff", 0.5) }}>
                                    Sistemde toplam <b>{filteredRows.length}</b> kayıt listeleniyor
                                </Typography>
                            </Box>
                        </Stack>

                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={() => downloadCSV(`KM_Raporu.csv`, toCSV(filteredRows))}
                            sx={{
                                borderRadius: "12px", color: "#fff", borderColor: alpha("#fff", 0.2),
                                textTransform: "none", backdropFilter: "blur(10px)",
                                "&:hover": { borderColor: PRIMARY_NEON, color: PRIMARY_NEON }
                            }}
                        >
                            Dışa Aktar (.csv)
                        </Button>
                    </Stack>

                    {/* Filtreleme Alanı */}
                    <ActionCard sx={{ mb: 3 }}>
                        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="center">
                            <TextField
                                fullWidth
                                placeholder="Plaka, Müşteri veya Şehir ara..."
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: PRIMARY_NEON }} /></InputAdornment>,
                                }}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "12px", bgcolor: alpha("#000", 0.2), border: "none"
                                    }
                                }}
                            />

                            <Stack direction="row" spacing={2} sx={{ width: { xs: "100%", lg: "auto" } }}>
                                <TextField
                                    type="date"
                                    size="small"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    sx={{ bgcolor: alpha("#000", 0.2), borderRadius: "10px", "& input": { color: "#fff" } }}
                                />
                                <TextField
                                    type="date"
                                    size="small"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    sx={{ bgcolor: alpha("#000", 0.2), borderRadius: "10px", "& input": { color: "#fff" } }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={fetchData}
                                    disabled={loading}
                                    sx={{
                                        minWidth: "120px", borderRadius: "10px", fontWeight: "bold",
                                        background: `linear-gradient(to right, ${SECONDARY_NEON}, ${ACCENT_PURPLE})`,
                                    }}
                                >
                                    Sorgula
                                </Button>
                            </Stack>

                            <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", lg: "block" }, mx: 1, borderColor: alpha("#fff", 0.1) }} />

                            <Button
                                fullWidth={false}
                                variant="outlined"
                                onClick={fetchReelKmValues}
                                disabled={reelLoading || loading}
                                startIcon={<FilterAltIcon />}
                                sx={{
                                    whiteSpace: "nowrap", borderRadius: "10px", px: 3,
                                    color: PRIMARY_NEON, borderColor: alpha(PRIMARY_NEON, 0.4),
                                    "&:hover": { borderColor: PRIMARY_NEON, bgcolor: alpha(PRIMARY_NEON, 0.1) }
                                }}
                            >
                                {reelLoading ? "Hesaplanıyor..." : "Reel KM Eşleştir"}
                            </Button>
                        </Stack>
                    </ActionCard>

                    {/* Veri Tablosu */}
                    <Box sx={{
                        height: "65vh", width: "100%", borderRadius: "24px", overflow: "hidden",
                        boxShadow: `0 20px 50px ${alpha("#000", 0.5)}`,
                        bgcolor: alpha("#161d31", 0.4), backdropFilter: "blur(10px)",
                        border: `1px solid ${alpha("#fff", 0.05)}`
                    }}>
                        <StyledDataGrid
                            rows={filteredRows}
                            columns={columns}
                            loading={loading || reelLoading}
                            rowHeight={70}
                            processRowUpdate={async (n, o) => {
                                await saveManuelKmToSupabase(n.sefer_no, n.manuel_km);
                                setSnack({ open: true, msg: "KM Güncellendi", severity: "success" });
                                return n;
                            }}
                            onProcessRowUpdateError={(err) => setSnack({ open: true, msg: "Hata!", severity: "error" })}
                            disableRowSelectionOnClick
                        />
                    </Box>
                </Box>
            </Fade>

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: "12px", fontWeight: "bold" }}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
