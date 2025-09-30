// src/kullanıcıIslemleri/Tamamlananlar.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

import {
    Box,
    Paper,
    Stack,
    Typography,
    Button,
    Drawer,
    IconButton,
    Divider,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    CircularProgress,
    Select,
    MenuItem,
    TextField,
    Tooltip,
    useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SummarizeIcon from "@mui/icons-material/Summarize";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import {
    DataGrid,
    GridToolbar,                 // ✅ built-in toolbar
    GridToolbarContainer,
    GridToolbarColumnsButton,
    GridToolbarFilterButton,
    GridToolbarDensitySelector,
    GridToolbarQuickFilter,
} from "@mui/x-data-grid";

/* ---------------- helpers ---------------- */
const HOME_PATH = "/anasayfa";

const fmtDate = (v) => (v ? new Date(v) : null);
const fmtDateText = (v) => (v ? new Date(v).toLocaleDateString("tr-TR") : "-");
const fmtDateTimeText = (v) => (v ? new Date(v).toLocaleString("tr-TR") : "-");
const ms = (a, b) => (a && b ? new Date(b) - new Date(a) : 0);
const humanDur = (millis) => {
    if (!millis || millis < 0) return "-";
    const totalM = Math.floor(millis / 60000);
    const d = Math.floor(totalM / (60 * 24));
    const h = Math.floor((totalM % (60 * 24)) / 60);
    const m = totalM % 60;
    return [d ? `${d}g` : null, h ? `${h}s` : null, m ? `${m}d` : null]
        .filter(Boolean)
        .join(" ") || "0d";
};

// Ortalama hız (km/s)
const KM_HIZ = 65;
// KGM / AETR benzeri sürüş kuralları
const BREAK_EVERY_H = 4.5;
const BREAK_MIN = 45;
const DAILY_DRIVE_LIMIT_H = 9;
const DAILY_REST_H = 11;

// "1.685,69" -> 1685.69
const toNumberFromTr = (txt) => {
    if (txt == null) return null;
    const s = String(txt).trim();
    if (!s) return null;
    const normalized = s.replace(/\./g, "").replace(",", ".");
    const val = Number(normalized);
    return Number.isFinite(val) ? val : null;
};

// "A; B ;C" -> ["A","B","C"]
const splitList = (txt) =>
    (txt ? String(txt).split(";").map((s) => s.trim()).filter(Boolean) : []) || [];

/* ---------------- toolbar (custom) ---------------- */
function Toolbar({ onExport, pageSize, onPageSizeChange, statText, onExportWithDetails }) {
    return (
        <GridToolbarContainer
            sx={{ p: 0.75, gap: 0.75, flexWrap: "wrap", overflowX: "auto" }}
        >
            {/* MUI built-in toolbar (kolon/filtre/yoğunluk/hızlı arama) */}
            <GridToolbar />
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" sx={{ ml: 1, opacity: 0.8 }}>
                {statText}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Sayfa boyutu
                </Typography>
                <Select
                    size="small"
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                >
                    {[25, 50, 100, 200].map((s) => (
                        <MenuItem key={s} value={s}>
                            {s}
                        </MenuItem>
                    ))}
                </Select>
            </Stack>

            <Tooltip title="Görünen sayfayı Excel'e aktar">
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileDownloadIcon />}
                    onClick={onExport}
                    sx={{ ml: 1 }}
                >
                    Excel
                </Button>
            </Tooltip>
            <Tooltip title="Sayfa + detaylarla aktar">
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SummarizeIcon />}
                    onClick={onExportWithDetails}
                >
                    Excel (Detay)
                </Button>
            </Tooltip>
        </GridToolbarContainer>
    );
}

/* ---------------- quick ranges ---------------- */
const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

/* ---------------- Mesafe & ETA ---------------- */
const distanceCache = new Map();
const distanceKey = (a, b, c, d) =>
    `${(a || "").toUpperCase()}|${(b || "").toUpperCase()}__${(c || "").toUpperCase()}|${(d || "").toUpperCase()}`;

async function fetchDistanceKmFromTable({ fromIl, fromIlce, toIl, toIlce }) {
    const key = distanceKey(fromIl, fromIlce, toIl, toIlce);
    if (distanceCache.has(key)) return distanceCache.get(key);

    const { data, error } = await supabase
        .from("mesafeler")
        .select("mesafe")
        .eq("yukleme_il", fromIl ?? "")
        .eq("yukleme_ilce", fromIlce ?? "")
        .eq("teslim_il", toIl ?? "")
        .eq("teslim_ilce", toIlce ?? "")
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Mesafe sorgu hatası:", error);
        distanceCache.set(key, null);
        return null;
    }

    const km = toNumberFromTr(data?.mesafe);
    distanceCache.set(key, km);
    return km;
}

const pickOrigin = (row) => {
    const ils = splitList(row?.yukleme_ili);
    const ilces = splitList(row?.yukleme_ilcesi);
    const il = (ils[0] || row?.yukleme_ili || "").toUpperCase();
    const ilce = (ilces[0] || row?.yukleme_ilcesi || "").toUpperCase();
    return { il, ilce };
};

const pickDeliveries = (row) => {
    const ils = splitList(row?.teslim_ili).map((s) => s.toUpperCase());
    const ilces = splitList(row?.teslim_ilcesi).map((s) => s.toUpperCase());
    const n = Math.min(ils.length, ilces.length);
    const arr = [];
    for (let i = 0; i < n; i++) arr.push({ il: ils[i], ilce: ilces[i] });
    if (!arr.length && (row?.teslim_ili || row?.teslim_ilcesi)) {
        arr.push({
            il: String(row?.teslim_ili || "").toUpperCase(),
            ilce: String(row?.teslim_ilcesi || "").toUpperCase(),
        });
    }
    return arr;
};

const sameLeg = (from, to) => from.il === to.il && from.ilce === to.ilce;

async function computeMultiLegKm(row) {
    const origin = pickOrigin(row);
    const deliveries = pickDeliveries(row);
    if (!origin.il || !origin.ilce || deliveries.length === 0) return null;

    let total = 0;
    let from = origin;

    for (const to of deliveries) {
        if (sameLeg(from, to)) {
            from = to;
            continue;
        }

        const km = await fetchDistanceKmFromTable({
            fromIl: from.il,
            fromIlce: from.ilce,
            toIl: to.il,
            toIlce: to.ilce,
        });

        if (km == null) return null;
        total += km;
        from = to;
    }
    return total;
}

async function pickStartTime(row) {
    const direct = row?.yukleme_cikis || row?.yukleme_cikis_tarihi;
    if (direct) {
        const t = new Date(direct);
        if (!isNaN(t)) return t;
    }
    const { data: detaylar, error } = await supabase
        .from("tamamlanan_detaylar")
        .select("yukleme_cikis")
        .eq("sefer_no", row.sefer_no);

    if (error) {
        console.error("Detay sorgu hatası:", error);
        return null;
    }

    const times = (detaylar ?? [])
        .map((d) => d.yukleme_cikis && new Date(d.yukleme_cikis))
        .filter((d) => d && !isNaN(d));

    if (!times.length) return null;
    return new Date(Math.min(...times.map((t) => t.getTime())));
}

async function pickLatestTeslimVaris(row) {
    try {
        const { data, error } = await supabase
            .from("tamamlanan_detaylar")
            .select("teslim_varis")
            .eq("sefer_no", row.sefer_no);

        if (error) {
            console.error("Detay teslim_varis sorgu hatası:", error);
            return null;
        }

        const times = (data || [])
            .map((d) => d?.teslim_varis && new Date(d.teslim_varis))
            .filter((d) => d && !isNaN(d));

        if (!times.length) return null;
        return new Date(Math.max(...times.map((t) => t.getTime()))).toISOString();
    } catch (e) {
        console.error(e);
        return null;
    }
}

function etaWithKGMRules(startDate, totalKm) {
    if (!startDate || !Number.isFinite(totalKm) || totalKm <= 0) return null;

    let t = new Date(startDate).getTime();
    let remainingDriveH = totalKm / KM_HIZ;
    let sinceBreakH = 0;
    let sinceDailyStartH = 0;

    const H = 3600000;
    const M = 60000;

    while (remainingDriveH > 1e-6) {
        if (sinceDailyStartH >= DAILY_DRIVE_LIMIT_H) {
            t += DAILY_REST_H * H;
            sinceDailyStartH = 0;
            sinceBreakH = 0;
            continue;
        }
        const untilBreak = BREAK_EVERY_H - sinceBreakH;
        const untilDaily = DAILY_DRIVE_LIMIT_H - sinceDailyStartH;
        const canDriveNow = Math.max(0, Math.min(remainingDriveH, untilBreak, untilDaily));
        if (canDriveNow > 0) {
            t += canDriveNow * H;
            remainingDriveH -= canDriveNow;
            sinceBreakH += canDriveNow;
            sinceDailyStartH += canDriveNow;
            if (remainingDriveH <= 1e-6) break;
        }
        if (sinceBreakH >= BREAK_EVERY_H && sinceDailyStartH < DAILY_DRIVE_LIMIT_H) {
            t += BREAK_MIN * M;
            sinceBreakH = 0;
            continue;
        }
        if (sinceDailyStartH >= DAILY_DRIVE_LIMIT_H) {
            t += DAILY_REST_H * H;
            sinceDailyStartH = 0;
            sinceBreakH = 0;
            continue;
        }
    }
    return new Date(t);
}

async function computeEtaForRow(row) {
    try {
        const start = await pickStartTime(row);
        if (!start) {
            return { tahmini_varis: null, mesafe_km: null, baslangic: null };
        }
        const totalKm = await computeMultiLegKm(row);

        if (!totalKm || totalKm <= 0) {
            return {
                tahmini_varis: null,
                mesafe_km: totalKm ?? null,
                baslangic: start.toISOString(),
            };
        }

        let etaStart = new Date(start);
        if (etaStart.getDay() === 6) {
            etaStart = new Date(etaStart.getTime() + 24 * 3600000);
        }

        const etaDate = etaWithKGMRules(etaStart, totalKm);
        return {
            tahmini_varis: etaDate ? etaDate.toISOString() : null,
            mesafe_km: totalKm,
            baslangic: start.toISOString(),
        };
    } catch (e) {
        console.error(e);
        return { tahmini_varis: null, mesafe_km: null, baslangic: null };
    }
}

/* ---------------- component ---------------- */
export default function Tamamlananlar() {
    const theme = useTheme();
    const downMd = useMediaQuery(theme.breakpoints.down("md"));
    const downSm = useMediaQuery(theme.breakpoints.down("sm"));
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [rowCount, setRowCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [dateStart, setDateStart] = useState(startOfMonth);
    const [dateEnd, setDateEnd] = useState(now);

    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 50 });
    const [sortModel, setSortModel] = useState([]);
    const [filterModel, setFilterModel] = useState({ items: [] });

    const [columnVisibilityModel, setColumnVisibilityModel] = useState({});

    const [enrichedRows, setEnrichedRows] = useState([]);
    const fetchSeqRef = useRef(0);

    const pageInsights = useMemo(() => {
        const dataSrc = enrichedRows.length ? enrichedRows : rows;
        const uniquePlates = new Set(dataSrc.map((r) => r.plaka)).size;
        const byCustomer = dataSrc.reduce((acc, r) => {
            acc[r.musteri_adi || "-"] = (acc[r.musteri_adi || "-"] || 0) + 1;
            return acc;
        }, {});
        const topCustomer = Object.entries(byCustomer).sort((a, b) => b[1] - a[1])[0] || ["-", 0];
        return { uniquePlates, topCustomerName: topCustomer[0], topCustomerCount: topCustomer[1] };
    }, [rows, enrichedRows]);

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailRows, setDetailRows] = useState([]);
    const [selected, setSelected] = useState(null);

    const fetchPage = async ({
        page = paginationModel.page,
        pageSize = paginationModel.pageSize,
        sort = sortModel,
        filter = filterModel,
        sDate = dateStart,
        eDate = dateEnd,
    } = {}) => {
        setLoading(true);

        let query = supabase.from("tamamlanan_seferler").select("*", { count: "exact" });
        if (sDate) query = query.gte("sefer_tarihi", new Date(sDate).toISOString());
        if (eDate) {
            const endIso = new Date(new Date(eDate).setHours(23, 59, 59, 999)).toISOString();
            query = query.lte("sefer_tarihi", endIso);
        }

        const qVals = filter?.quickFilterValues ?? [];
        if (qVals.length) {
            const q = qVals.join(" ").replace(/%/g, "");
            query = query.or(
                [
                    `sefer_no.ilike.%${q}%`,
                    `plaka.ilike.%${q}%`,
                    `surucu_ad_soyad.ilike.%${q}%`,
                    `musteri_adi.ilike.%${q}%`,
                    `hizmet_adi.ilike.%${q}%`,
                    `proje_adi.ilike.%${q}%`,
                    `yukleme_noktasi.ilike.%${q}%`,
                    `teslim_noktasi.ilike.%${q}%`,
                    `yukleme_ili.ilike.%${q}%`,
                    `yukleme_ilcesi.ilike.%${q}%`,
                    `teslim_ili.ilike.%${q}%`,
                    `teslim_ilcesi.ilike.%${q}%`,
                ].join(",")
            );
        }

        for (const f of filter?.items || []) {
            const field = f.field;
            const value = f.value;
            if (!field || value == null || value === "") continue;

            const op = f.operator ?? f.operatorValue ?? "contains";
            if (op === "is" || op === "equals") {
                query = query.eq(field, value);
            } else if (op === "startsWith") {
                query = query.ilike(field, `${value}%`);
            } else if (op === "endsWith") {
                query = query.ilike(field, `%${value}`);
            } else if (op === "isAnyOf" && Array.isArray(value) && value.length) {
                query = query.in(field, value);
            } else {
                query = query.ilike(field, `%${value}%`);
            }
        }

        if (sort?.length) {
            const s = sort[0];
            query = query.order(s.field, { ascending: s.sort !== "desc" });
        } else {
            query = query.order("sefer_tarihi", { ascending: false });
        }

        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error } = await query.range(from, to);

        if (!error) {
            setRows(data || []);
            setRowCount(count || 0);

            const mySeq = ++fetchSeqRef.current;
            (async () => {
                const base = data || [];
                const results = await Promise.all(
                    base.map(async (r) => {
                        const { tahmini_varis, mesafe_km, baslangic } = await computeEtaForRow(r);
                        const latest_teslim_varis = await pickLatestTeslimVaris(r);

                        let tamamlama_durumu = "-";
                        let tamamlama_fark_ms = null;

                        if (tahmini_varis && latest_teslim_varis) {
                            const eta = new Date(tahmini_varis).getTime();
                            const gercek = new Date(latest_teslim_varis).getTime();
                            tamamlama_fark_ms = gercek - eta;

                            if (gercek < eta) tamamlama_durumu = "Erken";
                            else if (gercek > eta) tamamlama_durumu = "Geç";
                            else tamamlama_durumu = "Tam Zamanında";
                        }

                        let sure_plan_ms = null;
                        let sure_gercek_ms = null;
                        if (baslangic && tahmini_varis) {
                            sure_plan_ms = new Date(tahmini_varis).getTime() - new Date(baslangic).getTime();
                        }
                        if (baslangic && latest_teslim_varis) {
                            sure_gercek_ms =
                                new Date(latest_teslim_varis).getTime() - new Date(baslangic).getTime();
                        }
                        const sure_fark_ms =
                            sure_gercek_ms != null && sure_plan_ms != null
                                ? sure_gercek_ms - sure_plan_ms
                                : null;

                        return {
                            ...r,
                            tahmini_varis,
                            mesafe_km,
                            tahmini_varis_baslangic: baslangic,
                            latest_teslim_varis,
                            tamamlama_durumu,
                            tamamlama_fark_ms,
                            sure_plan_ms,
                            sure_gercek_ms,
                            sure_fark_ms,
                        };
                    })
                );
                if (fetchSeqRef.current === mySeq) setEnrichedRows(results);
            })();
        } else {
            console.error(error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPage({ page: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchPage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paginationModel, sortModel, filterModel, dateStart, dateEnd]);

    useEffect(() => {
        if (downSm) {
            setColumnVisibilityModel({
                treyler: false,
                proje_adi: false,
                yukleme_il_ilce: false,
                teslim_il_ilce: false,
                atama_yapan_kullanici: false,
                atama_tarihi: false,
            });
        } else if (downMd) {
            setColumnVisibilityModel({
                treyler: false,
                proje_adi: false,
                atama_tarihi: false,
            });
        } else {
            setColumnVisibilityModel({});
        }
    }, [downMd, downSm]);

    const openDetails = useCallback(async (row) => {
        setSelected(row);
        setDetailOpen(true);
        setDetailLoading(true);

        const { data, error } = await supabase
            .from("tamamlanan_detaylar")
            .select("*")
            .eq("sefer_no", row.sefer_no)
            .order("nokta_sirasi", { ascending: true });

        if (!error) setDetailRows(data || []);
        setDetailLoading(false);
    }, []);

    const columns = useMemo(
        () => [
            {
                field: "sefer_no",
                headerName: "Sefer No",
                width: 140,
                renderCell: (params) => (
                    <Button size="small" onClick={() => openDetails(params.row)}>
                        {params.value}
                    </Button>
                ),
            },
            { field: "plaka", headerName: "Plaka", width: 120 },
            { field: "treyler", headerName: "Treyler", width: 120 },
            { field: "surucu_ad_soyad", headerName: "Şoför", width: 160 },
            { field: "musteri_adi", headerName: "Müşteri", width: 180 },
            { field: "hizmet_adi", headerName: "Hizmet", width: 160 },
            { field: "proje_adi", headerName: "Proje", width: 180 },
            { field: "yukleme_noktasi", headerName: "Yükleme Noktası", width: 200 },
            {
                field: "yukleme_il_ilce",
                headerName: "Yükleme İl/İlçe",
                width: 170,
                valueGetter: (value, row) => `${row?.yukleme_ili ?? ""} / ${row?.yukleme_ilcesi ?? ""}`,
            },
            {
                field: "teslim_il_ilce",
                headerName: "Teslim İl/İlçe",
                width: 170,
                valueGetter: (value, row) => `${row?.teslim_ili ?? ""} / ${row?.teslim_ilcesi ?? ""}`,
            },
            {
                field: "atama_tarihi",
                headerName: "Atama Tarihi",
                width: 170,
                valueGetter: (value, row) => fmtDateTimeText(row?.atama_tarihi),
            },
            {
                field: "sefer_tarihi",
                headerName: "Sefer Tarihi",
                width: 140,
                valueGetter: (value, row) => fmtDateText(row?.sefer_tarihi),
            },
            {
                field: "mesafe_km",
                headerName: "Mesafe (km)",
                width: 120,
                valueGetter: (v, row) => (row?.mesafe_km != null ? Math.round(row.mesafe_km) : null),
            },
            {
                field: "tahmini_varis_baslangic",
                headerName: "Yükleme Çıkış",
                width: 180,
                valueGetter: (v, row) =>
                    row?.tahmini_varis_baslangic ? fmtDateTimeText(row.tahmini_varis_baslangic) : "-",
            },
            {
                field: "tahmini_varis",
                headerName: "Tahmini Varış",
                width: 220,
                renderCell: ({ row }) => (
                    <Stack sx={{ lineHeight: 1 }}>
                        <Typography variant="body2">
                            {row?.tahmini_varis ? fmtDateTimeText(row.tahmini_varis) : "-"}
                        </Typography>
                        {row?.tahmini_varis_baslangic && (
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                                Başlangıç: {fmtDateTimeText(row.tahmini_varis_baslangic)}
                            </Typography>
                        )}
                    </Stack>
                ),
            },
            {
                field: "latest_teslim_varis",
                headerName: "Teslim Varış (En Geç)",
                width: 220,
                valueGetter: (v, row) =>
                    row?.latest_teslim_varis ? fmtDateTimeText(row.latest_teslim_varis) : "-",
            },
            {
                field: "tamamlama_durumu",
                headerName: "Durum (ETA Karşılaştırma)",
                width: 180,
                renderCell: ({ row }) => {
                    const val = row?.tamamlama_durumu;
                    let color = "inherit";
                    if (val === "Erken") color = "lightgreen";
                    if (val === "Geç") color = "salmon";
                    if (val === "Tam Zamanında") color = "lightblue";
                    return (
                        <Typography variant="body2" sx={{ fontWeight: 600, color }}>
                            {val || "-"}
                        </Typography>
                    );
                },
            },
            {
                field: "sure_plan",
                headerName: "Planlanan Süre (ETA)",
                width: 170,
                valueGetter: (v, row) =>
                    row?.sure_plan_ms != null ? humanDur(row.sure_plan_ms) : "-",
            },
            {
                field: "sure_gercek",
                headerName: "Gerçek Süre",
                width: 150,
                valueGetter: (v, row) =>
                    row?.sure_gercek_ms != null ? humanDur(row.sure_gercek_ms) : "-",
            },
            {
                field: "sure_fark",
                headerName: "Süre Farkı",
                width: 140,
                valueGetter: (v, row) => {
                    const diff = row?.sure_fark_ms;
                    if (diff == null) return "-";
                    const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
                    const abs = Math.abs(diff);
                    const totalM = Math.floor(abs / 60000);
                    const d = Math.floor(totalM / (60 * 24));
                    const h = Math.floor((totalM % (60 * 24)) / 60);
                    const m = totalM % 60;
                    const parts = [];
                    if (d) parts.push(`${d}g`);
                    if (h) parts.push(`${h}s`);
                    if (m || (!d && !h)) parts.push(`${m}d`);
                    return `${sign}${parts.join(" ")}`;
                },
                renderCell: ({ value }) => {
                    let color = "inherit";
                    if (typeof value === "string") {
                        if (value.startsWith("+")) color = "salmon";
                        else if (value.startsWith("-")) color = "lightgreen";
                        else color = "lightblue";
                    }
                    return (
                        <Typography variant="body2" sx={{ fontWeight: 600, color }}>
                            {value}
                        </Typography>
                    );
                },
            },
        ],
        [openDetails]
    );

    const detailMetrics = useMemo(() => {
        if (!detailRows?.length) return null;
        const first = detailRows[0];
        const last = detailRows[detailRows.length - 1];
        const totalCycle = ms(first?.yukleme_varis, last?.teslim_cikis);

        const parts = detailRows.map((d) => ({
            sira: d.nokta_sirasi,
            yuklemeIslem: ms(d.yukleme_varis, d.yukleme_cikis),
            transit: ms(d.yukleme_cikis, d.teslim_varis),
            teslimIslem: ms(d.teslim_varis, d.teslim_cikis),
        }));

        const sum = (k) => parts.reduce((a, b) => a + (b[k] || 0), 0);

        return {
            totalCycle,
            toplamYukleme: sum("yuklemeIslem"),
            toplamTransit: sum("transit"),
            toplamTeslim: sum("teslimIslem"),
            parts,
        };
    }, [detailRows]);

    /* ----------- export ----------- */
    const exportExcel = () => {
        const src = enrichedRows.length ? enrichedRows : rows;
        if (!src.length) return alert("Aktarılacak veri yok.");
        const sheet = src.map((s) => ({
            SeferNo: s.sefer_no,
            Plaka: s.plaka,
            Treyler: s.treyler,
            Sofor: s.surucu_ad_soyad,
            Musteri: s.musteri_adi,
            Hizmet: s.hizmet_adi,
            Proje: s.proje_adi,
            YuklemeNoktasi: s.yukleme_noktasi,
            YuklemeIlce: `${s.yukleme_ili ?? ""} / ${s.yukleme_ilcesi ?? ""}`,
            TeslimNoktasi: s.teslim_noktasi,
            TeslimIlce: `${s.teslim_ili ?? ""} / ${s.teslim_ilcesi ?? ""}`,
            Atayan: s.atama_yapan_kullanici,
            AtamaTarihi: fmtDateTimeText(s.atama_tarihi),
            SeferTarihi: fmtDateText(s.sefer_tarihi),
            Durum: s.arac_statu,
            MesafeKm: s.mesafe_km ?? "",
            TahminiVaris: s.tahmini_varis ? fmtDateTimeText(s.tahmini_varis) : "",
            TahminiVarisBaslangic: s.tahmini_varis_baslangic
                ? fmtDateTimeText(s.tahmini_varis_baslangic)
                : "",
            TeslimVarisEnGec: s.latest_teslim_varis ? fmtDateTimeText(s.latest_teslim_varis) : "",
        }));
        const ws = XLSX.utils.json_to_sheet(sheet);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Seferler");
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        saveAs(new Blob([buf], { type: "application/octet-stream" }), "tamamlanan_seferler.xlsx");
    };

    const exportExcelWithDetails = async () => {
        const src = enrichedRows.length ? enrichedRows : rows;
        if (!src.length) return alert("Aktarılacak veri yok.");
        const all = [];
        for (const s of src) {
            const { data } = await supabase
                .from("tamamlanan_detaylar")
                .select("*")
                .eq("sefer_no", s.sefer_no)
                .order("nokta_sirasi", { ascending: true });

            if (!data || !data.length) {
                all.push({
                    SeferNo: s.sefer_no,
                    Plaka: s.plaka,
                    Musteri: s.musteri_adi,
                    Proje: s.proje_adi,
                    Asama: "Detay yok",
                    MesafeKm: s.mesafe_km ?? "",
                    TahminiVaris: s.tahmini_varis ? fmtDateTimeText(s.tahmini_varis) : "",
                    TahminiVarisBaslangic: s.tahmini_varis_baslangic
                        ? fmtDateTimeText(s.tahmini_varis_baslangic)
                        : "",
                    TeslimVarisEnGec: s.latest_teslim_varis ? fmtDateTimeText(s.latest_teslim_varis) : "",
                });
                continue;
            }

            const first = data[0];
            const last = data[data.length - 1];
            const toplamSure = ms(first?.yukleme_varis, last?.teslim_cikis);

            for (const d of data) {
                all.push({
                    SeferNo: s.sefer_no,
                    Plaka: s.plaka,
                    Musteri: s.musteri_adi,
                    Proje: d.proje_adi,
                    Sira: d.nokta_sirasi,
                    YuklemeNoktasi: d.yukleme_noktasi,
                    YuklemeVaris: fmtDateTimeText(d.yukleme_varis),
                    YuklemeCikis: fmtDateTimeText(d.yukleme_cikis),
                    TeslimNoktasi: d.teslim_noktasi,
                    TeslimVaris: fmtDateTimeText(d.teslim_varis),
                    TeslimCikis: fmtDateTimeText(d.teslim_cikis),
                    Sure_Yukleme: humanDur(ms(d.yukleme_varis, d.yukleme_cikis)),
                    Sure_Transit: humanDur(ms(d.yukleme_cikis, d.teslim_varis)),
                    Sure_Teslim: humanDur(ms(d.teslim_varis, d.teslim_cikis)),
                    ToplamSure: humanDur(toplamSure),
                    MesafeKm: s.mesafe_km ?? "",
                    TahminiVaris: s.tahmini_varis ? fmtDateTimeText(s.tahmini_varis) : "",
                    TeslimVarisEnGec: s.latest_teslim_varis ? fmtDateTimeText(s.latest_teslim_varis) : "",
                });
            }
        }
        const ws = XLSX.utils.json_to_sheet(all);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sefer+Detay");
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        saveAs(new Blob([buf], { type: "application/octet-stream" }), "tamamlanan_seferler_detayli.xlsx");
    };

    const statText = useMemo(() => {
        if (!rowCount) return "Kayıt yok";
        const first = paginationModel.page * paginationModel.pageSize + 1;
        const last = Math.min((paginationModel.page + 1) * paginationModel.pageSize, rowCount);
        return `${first} - ${last} / ${rowCount}`;
    }, [rowCount, paginationModel]);

    return (
        <Box
            sx={{
                height: "100dvh",
                display: "grid",
                gridTemplateRows: "auto auto 1fr",
                gap: 2,
                px: 2,
                pt: 2,
                pb: 1,
                background:
                    "radial-gradient(1200px 500px at 10% -10%, rgba(34,211,238,0.10), transparent 40%)," +
                    "radial-gradient(900px 400px at 90% 0%, rgba(139,92,246,0.12), transparent 50%)," +
                    "linear-gradient(180deg, #050816 0%, #0B1220 100%)",
            }}
        >
            <Helmet><title>TAMAMLANAN SEFERLER</title></Helmet>

            {/* Header */}
            <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
                spacing={1}
            >
                <Stack spacing={0.25}>
                    <Typography
                        variant="h5"
                        fontWeight={800}
                        sx={{
                            lineHeight: 1.1,
                            background: "linear-gradient(90deg,#E879F9,#22D3EE)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        Tamamlanan Seferler
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Raporlar • tarih aralığı • detay metrikleri • ETA (65 km/s)
                    </Typography>
                </Stack>

                {/* Sağ aksiyonlar + ✅ Yedek Excel butonları */}
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Button size="small" variant="text" startIcon={<ArrowBackIosNewIcon />} onClick={() => navigate(-1)}>
                        Geri
                    </Button>
                    <Button size="small" variant="text" startIcon={<HomeOutlinedIcon />} onClick={() => navigate(HOME_PATH)}>
                        Anasayfa
                    </Button>

                    <Paper
                        sx={{
                            p: 1,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            background: `linear-gradient(180deg, ${alpha("#ffffff", 0.04)} 0%, ${alpha("#ffffff", 0.02)} 100%)`,
                            border: "1px solid rgba(255,255,255,0.06)",
                            flexWrap: "wrap",
                        }}
                    >
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                            Tarih (Sefer Tarihi)
                        </Typography>
                        <TextField
                            type="date"
                            size="small"
                            value={(dateStart && fmtDate(dateStart)?.toISOString()?.slice(0, 10)) || ""}
                            onChange={(e) => {
                                setPaginationModel((p) => ({ ...p, page: 0 }));
                                setDateStart(e.target.value ? new Date(e.target.value) : null);
                            }}
                            InputLabelProps={{ shrink: true }}
                        />
                        <Typography variant="body2" sx={{ opacity: 0.7 }}>—</Typography>
                        <TextField
                            type="date"
                            size="small"
                            value={(dateEnd && fmtDate(dateEnd)?.toISOString()?.slice(0, 10)) || ""}
                            onChange={(e) => {
                                setPaginationModel((p) => ({ ...p, page: 0 }));
                                setDateEnd(e.target.value ? new Date(e.target.value) : null);
                            }}
                            InputLabelProps={{ shrink: true }}
                        />

                        {/* ✅ Grid çalışmasa bile her zaman görünen Excel butonları */}
                        <Tooltip title="Görünen sayfayı Excel'e aktar">
                            <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportExcel}>
                                Excel
                            </Button>
                        </Tooltip>
                        <Tooltip title="Sayfa + detaylarla aktar">
                            <Button size="small" variant="outlined" startIcon={<SummarizeIcon />} onClick={exportExcelWithDetails}>
                                Excel (Detay)
                            </Button>
                        </Tooltip>
                    </Paper>
                </Stack>
            </Stack>

            {/* Üst özet */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <Paper sx={{ p: 1.25, borderRadius: 2, flex: 1, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <Typography variant="caption" color="text.secondary">Toplam Kayıt (filtreli)</Typography>
                    <Typography variant="h6" fontWeight={800}>{rowCount}</Typography>
                </Paper>
                <Paper sx={{ p: 1.25, borderRadius: 2, flex: 1, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <Typography variant="caption" color="text.secondary">Benzersiz Plaka (sayfa)</Typography>
                    <Typography variant="h6" fontWeight={800}>{pageInsights.uniquePlates}</Typography>
                </Paper>
                <Paper sx={{ p: 1.25, borderRadius: 2, flex: 1.6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <Typography variant="caption" color="text.secondary">En çok sefer (sayfa)</Typography>
                    <Typography variant="h6" fontWeight={800}>
                        {pageInsights.topCustomerName}{" "}
                        <Typography component="span" variant="body2" sx={{ opacity: 0.7 }}>
                            ({pageInsights.topCustomerCount})
                        </Typography>
                    </Typography>
                </Paper>
            </Stack>

            {/* DataGrid */}
            <Paper
                sx={{
                    borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.06)",
                    overflow: "hidden",
                    display: "grid",
                    gridTemplateRows: "1fr",
                    minHeight: 0,
                }}
            >
                <DataGrid
                    rows={enrichedRows.length ? enrichedRows : rows}
                    columns={columns}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={setColumnVisibilityModel}
                    getRowId={(r) => r.sefer_no}
                    loading={loading}
                    disableRowSelectionOnClick
                    density="compact"
                    rowHeight={36}
                    headerHeight={44}
                    pagination
                    paginationMode="server"
                    rowCount={rowCount}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    sortingMode="server"
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    filterMode="server"
                    filterModel={filterModel}
                    onFilterModelChange={setFilterModel}
                    // v6
                    slots={{ toolbar: Toolbar }}
                    slotProps={{
                        toolbar: {
                            onExport: exportExcel,
                            onExportWithDetails: exportExcelWithDetails,
                            pageSize: paginationModel.pageSize,
                            onPageSizeChange: (v) => setPaginationModel((p) => ({ ...p, page: 0, pageSize: v })),
                            statText,
                        },
                    }}
                    // v5
                    components={{ Toolbar: Toolbar }}
                    componentsProps={{
                        toolbar: {
                            onExport: exportExcel,
                            onExportWithDetails: exportExcelWithDetails,
                            pageSize: paginationModel.pageSize,
                            onPageSizeChange: (v) => setPaginationModel((p) => ({ ...p, page: 0, pageSize: v })),
                            statText,
                        },
                    }}
                    sx={{
                        height: "100%",
                        border: "none",
                        fontSize: 13,
                        "& .MuiDataGrid-toolbarContainer": {
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            background: "rgba(15,23,42,0.92)",
                            backdropFilter: "blur(4px)",
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                            overflowX: "auto",
                            flexWrap: "wrap",
                        },
                        "& .MuiDataGrid-columnHeaders": {
                            background:
                                "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.7) 100%)",
                            color: "#C8D1E6",
                            borderBottomColor: "rgba(255,255,255,0.08)",
                            fontWeight: 700,
                        },
                        "& .MuiDataGrid-cell": {
                            borderBottomColor: "rgba(255,255,255,0.06)",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                        },
                        "& .MuiDataGrid-row:nth-of-type(2n) .MuiDataGrid-cell": {
                            backgroundColor: "rgba(255,255,255,0.02)",
                        },
                    }}
                />
            </Paper>

            {/* Detay Drawer */}
            <Drawer
                anchor="right"
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                PaperProps={{
                    sx: {
                        width: { xs: "100%", md: 860 },
                        backgroundColor: "#0F172A",
                        color: "text.primary",
                        p: 2,
                        borderLeft: "1px solid rgba(255,255,255,0.06)",
                    },
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="h6">Detaylar — {selected?.sefer_no ?? "-"}</Typography>
                    <IconButton onClick={() => setDetailOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </Stack>
                <Divider sx={{ mb: 2, borderColor: "rgba(255,255,255,0.08)" }} />

                {detailMetrics && (
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ mb: 2 }}>
                        <Paper sx={{ p: 1.25, borderRadius: 2, flex: 1 }} variant="outlined">
                            <Typography variant="caption" color="text.secondary">Toplam Süre</Typography>
                            <Typography variant="h6" fontWeight={800}>{humanDur(detailMetrics.totalCycle)}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1.25, borderRadius: 2, flex: 1 }} variant="outlined">
                            <Typography variant="caption" color="text.secondary">Yükleme İşlemleri (toplam)</Typography>
                            <Typography variant="h6" fontWeight={800}>{humanDur(detailMetrics.toplamYukleme)}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1.25, borderRadius: 2, flex: 1 }} variant="outlined">
                            <Typography variant="caption" color="text.secondary">Transit (toplam)</Typography>
                            <Typography variant="h6" fontWeight={800}>{humanDur(detailMetrics.toplamTransit)}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1.25, borderRadius: 2, flex: 1 }} variant="outlined">
                            <Typography variant="caption" color="text.secondary">Teslim İşlemleri (toplam)</Typography>
                            <Typography variant="h6" fontWeight={800}>{humanDur(detailMetrics.toplamTeslim)}</Typography>
                        </Paper>
                    </Stack>
                )}

                {detailLoading ? (
                    <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
                        <CircularProgress size={26} />
                    </Box>
                ) : (
                    <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <Box sx={{ maxHeight: "calc(100dvh - 220px)", overflow: "auto" }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow
                                        sx={{
                                            "& th": {
                                                background: alpha("#ffffff", 0.04),
                                                fontWeight: 700,
                                                whiteSpace: "nowrap",
                                            },
                                        }}
                                    >
                                        <TableCell>#</TableCell>
                                        <TableCell>Proje</TableCell>
                                        <TableCell>Yükleme Noktası</TableCell>
                                        <TableCell>Yükleme Varış</TableCell>
                                        <TableCell>Yükleme Çıkış</TableCell>
                                        <TableCell>Yükleme Süre</TableCell>
                                        <TableCell>Teslim Noktası</TableCell>
                                        <TableCell>Teslim Varış</TableCell>
                                        <TableCell>Teslim Çıkış</TableCell>
                                        <TableCell>Teslim Süre</TableCell>
                                        <TableCell>Transit Süre</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {detailRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={11} sx={{ py: 2, textAlign: "center", opacity: 0.8 }}>
                                                Detay bulunamadı.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        detailRows.map((d, i) => (
                                            <TableRow key={`${selected?.sefer_no}-${i}`} hover>
                                                <TableCell>{d.nokta_sirasi}</TableCell>
                                                <TableCell>{d.proje_adi}</TableCell>
                                                <TableCell>{d.yukleme_noktasi}</TableCell>
                                                <TableCell>{fmtDateTimeText(d.yukleme_varis)}</TableCell>
                                                <TableCell>{fmtDateTimeText(d.yukleme_cikis)}</TableCell>
                                                <TableCell>{humanDur(ms(d.yukleme_varis, d.yukleme_cikis))}</TableCell>
                                                <TableCell>{d.teslim_noktasi}</TableCell>
                                                <TableCell>{fmtDateTimeText(d.teslim_varis)}</TableCell>
                                                <TableCell>{fmtDateTimeText(d.teslim_cikis)}</TableCell>
                                                <TableCell>{humanDur(ms(d.teslim_varis, d.teslim_cikis))}</TableCell>
                                                <TableCell>{humanDur(ms(d.yukleme_cikis, d.teslim_varis))}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Box>
                    </Paper>
                )}
            </Drawer>
        </Box>
    );
}
