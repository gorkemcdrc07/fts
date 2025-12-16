import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
    Container,
    Paper,
    Box,
    Typography,
    TextField,
    Button,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Chip,
    Alert,
    Grid,
    IconButton,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import GarageIcon from "@mui/icons-material/Garage";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import DownloadIcon from "@mui/icons-material/Download";
import SpeedIcon from "@mui/icons-material/Speed";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import { DataGrid, gridClasses } from "@mui/x-data-grid";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient"; // Supabase bağlantınızın doğru olduğunu varsayıyorum

// --- SABİTLER ---
const ALLOWED_PLATES = new Set([
    "01ZD675", "06DT2389", "06GD4362", "08AAF813", "10PL271", "10Y5842", "19ABN664", "19UA950",
    "27AHD540", "27AHF527", "27AHK380", "27AKM071", "27AKN029", "27ARR605", "27AST52", "27BAP320", "27BAP323", "27VY319",
    "33DPG10", "63AJZ670", "34FTT352", "34FVM656", "34GYS996", "34GZC690", "34JC9913", "34UL1543", "41AHA664", "42ADS122",
    "42CBF05", "42FEL27", "52ACU130", "59AJV436", "61K9561", "63AAL762", "63AEC491", "63AEV854", "63AGM653", "63AHC364",
    "63AHE634", "63AHZ463", "63AIG414", "63AIR237", "63AJJ164", "63AK700", "27AZD488", "63L1587", "63LD155", "68BN379",
    "80ABA630", "80AFC178", "80AGY940", "80AHC048", "63L5666", "27ABZ991", "27AZY628", "06FM7195", "63AKD683", "63AID818",
    "63AJY226", "06BEB617", "63AN873", "63AHA130", "33DKH12", "33DKH10", "63AEF220", "63AAU841", "63AKR927", "68AT223",
    "63AKD681", "21ADY149", "34MSM641", "33NNG84", "27AZP206", "34KYF437", "59ZB106", "63AGV699", "34MVG855"
]);

const TABLE_TAMAMLANAN_SEFERLER = "tamamlanan_seferler";
const TABLE_TAMAMLANAN_DETAYLAR = "tamamlanan_detaylar";
const TABLE_SEFERLER = "seferler";
const TABLE_SEFER_DETAY = "sefer_detaylari";
const TABLE_IZINLER = "izinler";
const IZIN_PLAKA_COL = "plaka_treyler";
const IZIN_START_COL = "baslangic_tarihi";
const IZIN_END_COL = "bitis_tarihi";

// --- KOYU TEMA RENK PALETİ ---
const THEME_COLORS = {
    BACKGROUND: "#121212",      // En koyu arka plan
    SURFACE: "#1e1e1e",         // Panel, Kart, Tablo Arka Planı
    PRIMARY_ACCENT: "#81c784",  // Ana Vurgu Rengi (Mint Yeşili)
    SECONDARY_ACCENT: "#b3e5fc",// İkincil Vurgu Rengi (Açık Mavi/Cyan)
    HEADER: "#212121",          // Başlık/Tablo Başlık Arka Planı
    TEXT_MAIN: "#ffffffde",     // Ana metin rengi
    TEXT_SECONDARY: "#ffffff99",// İkincil metin rengi
    SUCCESS: "#66bb6a",         // Yeşil
    DANGER: "#ef5350",          // Kırmızı
    WARNING: "#ffb300",         // Turuncu
};

// Snapshot anındaki Durum Rengi
const getStatusColor = (durum) => {
    switch (durum) {
        case "DOLU-YÜKLEME":
            return THEME_COLORS.WARNING; // Turuncu
        case "DOLU-YOLDA":
            return THEME_COLORS.DANGER; // Kırmızı
        case "DOLU-BOŞALTMA":
            return "#ce93d8"; // Açık Mor (Koyu temada farklı bir renk)
        case "İZİNLİ":
            return THEME_COLORS.WARNING;
        case "BOŞTA":
            return THEME_COLORS.SUCCESS; // Yeşil
        default:
            return "#90a4ae"; // Soluk Gri
    }
};

const durumLabelToChip = (durum) => {
    if (durum === "DOLU-YÜKLEME") return "YÜKLEME NOKTASINDA";
    if (durum === "DOLU-YOLDA") return "YOLDA";
    if (durum === "DOLU-BOŞALTMA") return "BOŞALTMA NOKTASINDA";
    return durum;
};

// --- UI: Detay Table (Şık ve Koyu Tema) ---
const DetailTable = ({ title, data, isCompleted, extraColumns }) => (
    <Box mt={3}>
        <Typography
            variant="h6"
            sx={{
                color: THEME_COLORS.TEXT_MAIN,
                borderLeft: `5px solid ${isCompleted ? THEME_COLORS.SUCCESS : THEME_COLORS.DANGER}`,
                pl: 1.5,
                pb: 0.5,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                mb: 1
            }}
        >
            {title}{" "}
            <Chip
                label={`${data.length} Kayıt`}
                size="small"
                color={isCompleted ? "success" : "error"}
                variant="outlined"
                sx={{ ml: 1, fontWeight: 900, color: THEME_COLORS.TEXT_MAIN }}
            />
        </Typography>

        {data.length === 0 ? (
            <Alert
                severity="info"
                variant="filled"
                sx={{ mt: 1, backgroundColor: THEME_COLORS.HEADER, color: THEME_COLORS.TEXT_MAIN, borderLeft: `4px solid ${THEME_COLORS.SECONDARY_ACCENT}` }}
            >
                Bu hafta için bu araçta {isCompleted ? 'tamamlanmış' : 'aktif'} bir sefer kaydı bulunamadı.
            </Alert>
        ) : (
            <TableContainer component={Paper} elevation={6} sx={{ mt: 1, borderRadius: 2, backgroundColor: THEME_COLORS.SURFACE }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: THEME_COLORS.HEADER }}>
                            <TableCell sx={{ fontWeight: 900, color: THEME_COLORS.PRIMARY_ACCENT }}>Sefer No / ID</TableCell>
                            <TableCell sx={{ fontWeight: 900, color: THEME_COLORS.PRIMARY_ACCENT }}>Yükleme Noktası</TableCell>
                            <TableCell sx={{ fontWeight: 900, color: THEME_COLORS.PRIMARY_ACCENT }}>Teslim Noktası</TableCell>
                            <TableCell sx={{ fontWeight: 900, color: THEME_COLORS.PRIMARY_ACCENT }} align="center">Snapshot Aşama</TableCell>
                            {extraColumns.map((c) => (
                                <TableCell key={c.field} sx={{ fontWeight: 900, color: THEME_COLORS.PRIMARY_ACCENT }}>
                                    {c.headerName}
                                </TableCell>
                            ))}
                            <TableCell sx={{ fontWeight: 900, color: THEME_COLORS.PRIMARY_ACCENT }}>Durum</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.map((row, idx) => (
                            <TableRow
                                key={`${row.sefer_no || row.sefer_id || "X"}-${idx}`}
                                hover
                                sx={{
                                    '&:nth-of-type(odd)': { backgroundColor: THEME_COLORS.SURFACE },
                                    '&:nth-of-type(even)': { backgroundColor: '#262626' },
                                    '&:hover': { backgroundColor: '#333333 !important' }
                                }}
                            >
                                <TableCell sx={{ color: THEME_COLORS.TEXT_MAIN }}>{row.sefer_no || row.sefer_id || "-"}</TableCell>
                                <TableCell sx={{ color: THEME_COLORS.TEXT_MAIN }}>{row.yukleme_noktasi || "-"}</TableCell>
                                <TableCell sx={{ color: THEME_COLORS.TEXT_MAIN }}>{row.teslim_noktasi || "-"}</TableCell>
                                <TableCell align="center">
                                    <Chip
                                        label={row.snapshot_stage || "Aktif Değil"}
                                        size="small"
                                        color={row.snapshot_stage && row.snapshot_stage !== "AKTİF DEĞİL" ? "primary" : "default"}
                                        variant="outlined"
                                        sx={{ fontWeight: 800, color: THEME_COLORS.TEXT_MAIN }}
                                    />
                                </TableCell>
                                {extraColumns.map((c) => (
                                    <TableCell key={c.field} sx={{ color: THEME_COLORS.TEXT_SECONDARY }}>
                                        {row?.[c.field] ? dayjs(row[c.field]).format("DD.MM.YYYY HH:mm") : "-"}
                                    </TableCell>
                                ))}
                                <TableCell>
                                    <Chip
                                        label={row.durum || "Bilinmiyor"}
                                        size="small"
                                        color={isCompleted ? "success" : "error"}
                                        variant="filled"
                                        sx={{ fontWeight: 800 }}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        )}
    </Box>
);

// --- UI: Status Cards (Şık Koyu Tema) ---
const StatusSummaryCard = ({ status, count, currentFilter, setFilter, icon: Icon, color, label }) => (
    <Paper
        elevation={currentFilter === status ? 12 : 6}
        onClick={() => setFilter(status)}
        sx={{
            p: 3,
            display: "flex",
            alignItems: "center",
            gap: 2,
            cursor: "pointer",
            transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
            border: currentFilter === status ? `2px solid ${color}` : `1px solid ${THEME_COLORS.SURFACE}`,
            borderRadius: 3,
            backgroundColor: currentFilter === status ? `${color}33` : THEME_COLORS.SURFACE,
            "&:hover": {
                backgroundColor: `${color}44`,
                transform: 'translateY(-2px)'
            },
        }}
    >
        <Box sx={{ p: 1.5, borderRadius: '50%', backgroundColor: `${color}30` }}>
            <Icon sx={{ color, fontSize: 36 }} />
        </Box>
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, color: THEME_COLORS.TEXT_MAIN }}>
                {count}
            </Typography>
            <Typography variant="body2" sx={{ color: THEME_COLORS.TEXT_SECONDARY, fontWeight: 600 }}>
                {label}
            </Typography>
        </Box>
    </Paper>
);

// --- ANA BİLEŞEN ---
export default function BostaArac() {
    const [selectedDateTime, setSelectedDateTime] = useState(dayjs().format("YYYY-MM-DDTHH:mm"));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);
    const [statusFilter, setStatusFilter] = useState("HEPSI");

    const [openDetail, setOpenDetail] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [popupData, setPopupData] = useState({
        plaka: "",
        izin: null,
        tamamlanan: [],
        aktif: [],
    });

    // ... (normalizePlaka, snapT, weekStart, weekEnd, zamanExtraColumns, stageAt, getIzinMapForDay, fetchWeekData fonksiyonları AYNI KALDI)
    // Sadece Dark Theme uyumluluğu için `getIzinMapForDay` ve `fetchWeekData`'yı koydum.

    const normalizePlaka = useCallback((p) => {
        if (!p) return "";
        let s = String(p).trim().toUpperCase();
        s = s.replace(/\s+/g, " ").trim();
        if (s.includes("-")) s = s.split("-")[0].trim();
        if (s.includes("/")) s = s.split("/")[0].trim();
        if (s.includes(" ")) s = s.split(" ")[0].trim();
        return s;
    }, []);

    const snapT = useMemo(() => dayjs(selectedDateTime), [selectedDateTime]);
    const selectedDateStr = useMemo(() => snapT.format("YYYY-MM-DD"), [snapT]);
    const weekStart = useMemo(() => dayjs(selectedDateStr).subtract(6, "day").startOf("day"), [selectedDateStr]);
    const weekEnd = useMemo(() => dayjs(selectedDateStr).add(1, "day").startOf("day"), [selectedDateStr]);

    const zamanExtraColumns = useMemo(
        () => [
            { field: "yukleme_varis", headerName: "Yükleme Varış" },
            { field: "yukleme_cikis", headerName: "Yükleme Çıkış" },
            { field: "teslim_varis", headerName: "Teslim Varış" },
            { field: "teslim_cikis", headerName: "Teslim Çıkış" },
        ],
        []
    );

    const stageAt = useCallback((d, t) => {
        const yv = d?.yukleme_varis ? dayjs(d.yukleme_varis) : null;
        const yc = d?.yukleme_cikis ? dayjs(d.yukleme_cikis) : null;
        const tv = d?.teslim_varis ? dayjs(d.teslim_varis) : null;
        const tc = d?.teslim_cikis ? dayjs(d.teslim_cikis) : null;

        if (!yv) return null;
        if (t.isBefore(yv)) return null;

        if (tc && (t.isSame(tc) || t.isAfter(tc))) return null;

        if (!yc || t.isBefore(yc)) return "YÜKLEME NOKTASINDA";
        if (!tv || t.isBefore(tv)) return "YOLDA";
        if (!tc || t.isBefore(tc)) return "BOŞALTMA NOKTASINDA";

        return null;
    }, []);

    const getIzinMapForDay = useCallback(
        async (dateStr) => {
            const { data, error } = await supabase
                .from(TABLE_IZINLER)
                .select(`${IZIN_PLAKA_COL}, ${IZIN_START_COL}, ${IZIN_END_COL}, izin_turu, aciklama`)
                .lte(IZIN_START_COL, dateStr)
                .gte(IZIN_END_COL, dateStr);

            if (error) throw new Error(error.message);

            const map = new Map();
            (data || []).forEach((r) => {
                const plaka = normalizePlaka(r?.[IZIN_PLAKA_COL]);
                if (!plaka) return;
                map.set(plaka, {
                    start: r?.[IZIN_START_COL] || null,
                    end: r?.[IZIN_END_COL] || null,
                    izin_turu: r?.izin_turu || null,
                    aciklama: r?.aciklama || null,
                });
            });
            return map;
        },
        [normalizePlaka]
    );

    const fetchWeekData = useCallback(async () => {
        const allowed = Array.from(ALLOWED_PLATES.values()).map(normalizePlaka);

        const { data: activeSeferler, error: aErr } = await supabase
            .from(TABLE_SEFERLER)
            .select("id, plaka")
            .in("plaka", allowed);
        if (aErr) throw new Error(`seferler hata: ${aErr.message}`);
        const activeIds = (activeSeferler || []).map((x) => x.id).filter(Boolean);

        let activeDetails = [];
        if (activeIds.length) {
            const { data: d, error: dErr } = await supabase
                .from(TABLE_SEFER_DETAY)
                .select("sefer_id, yukleme_noktasi, teslim_noktasi, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis")
                .in("sefer_id", activeIds)
                .lt("yukleme_varis", weekEnd.toISOString())
                .or(`teslim_cikis.is.null,teslim_cikis.gte.${weekStart.toISOString()}`)
                .order("yukleme_varis", { ascending: true });
            if (dErr) throw new Error(`sefer_detaylari hata: ${dErr.message}`);
            activeDetails = d || [];
        }

        const { data: completedSeferler, error: cErr } = await supabase
            .from(TABLE_TAMAMLANAN_SEFERLER)
            .select("plaka, sefer_no, sefer_tarihi")
            .in("plaka", allowed)
            .gte("sefer_tarihi", weekStart.toISOString())
            .lt("sefer_tarihi", weekEnd.toISOString());
        if (cErr) throw new Error(`tamamlanan_seferler hata: ${cErr.message}`);
        const seferNos = Array.from(new Set((completedSeferler || []).map((x) => x.sefer_no).filter(Boolean)));

        let completedDetails = [];
        if (seferNos.length) {
            const { data: cd, error: cdErr } = await supabase
                .from(TABLE_TAMAMLANAN_DETAYLAR)
                .select("sefer_no, yukleme_noktasi, teslim_noktasi, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis")
                .in("sefer_no", seferNos);
            if (cdErr) throw new Error(`tamamlanan_detaylar hata: ${cdErr.message}`);
            completedDetails = cd || [];
        }

        return {
            activeSeferler: activeSeferler || [],
            activeDetails,
            completedSeferler: completedSeferler || [],
            completedDetails,
        };
    }, [normalizePlaka, weekStart, weekEnd]);


    // Snapshot durumu üretimi (loadData) ve Detay pop-up (loadPlakaDetails) fonksiyonları da koyu temaya uygun olarak güncellendi.
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setRows([]);
        try {
            const izinMap = await getIzinMapForDay(selectedDateStr);
            const weekData = await fetchWeekData();
            const seferNoToPlate = new Map();
            (weekData.completedSeferler || []).forEach((s) => {
                const p = normalizePlaka(s.plaka);
                if (p) seferNoToPlate.set(s.sefer_no, p);
            });
            const seferIdToPlate = new Map();
            (weekData.activeSeferler || []).forEach((s) => {
                const p = normalizePlaka(s.plaka);
                if (p) seferIdToPlate.set(s.id, p);
            });
            const candidatesByPlate = new Map();
            for (const d of weekData.activeDetails || []) {
                const p = seferIdToPlate.get(d.sefer_id);
                if (p) {
                    if (!candidatesByPlate.has(p)) candidatesByPlate.set(p, []);
                    candidatesByPlate.get(p).push({ ...d, __src: "AKTIF", sefer_id: d.sefer_id });
                }
            }
            for (const d of weekData.completedDetails || []) {
                const p = seferNoToPlate.get(d.sefer_no);
                if (p) {
                    if (!candidatesByPlate.has(p)) candidatesByPlate.set(p, []);
                    candidatesByPlate.get(p).push({ ...d, __src: "TAMAMLANAN", sefer_no: d.sefer_no });
                }
            }
            const final = [];
            const allowedPlates = Array.from(ALLOWED_PLATES.values()).map(normalizePlaka);
            for (const plaka of allowedPlates) {
                const izin = izinMap.get(plaka);
                if (izin) {
                    final.push({
                        id: `${plaka}-${selectedDateTime}`,
                        plaka,
                        durum: "İZİNLİ",
                        sefer_no: "-",
                        snapshot_stage: "İZİNLİ",
                        aciklama: `İzin${izin.izin_turu ? ` (${izin.izin_turu})` : ""}: ${izin.start ? dayjs(izin.start).format("DD.MM.YYYY") : "?"} → ${izin.end ? dayjs(izin.end).format("DD.MM.YYYY") : "?"}${izin.aciklama ? ` | ${izin.aciklama}` : ""}`,
                    });
                    continue;
                }
                const list = candidatesByPlate.get(plaka) || [];
                let best = null;
                for (const d of list) {
                    const yv = d?.yukleme_varis ? dayjs(d.yukleme_varis) : null;
                    if (!yv || snapT.isBefore(yv)) continue;
                    const tc = d?.teslim_cikis ? dayjs(d.teslim_cikis) : null;
                    if (tc && (snapT.isSame(tc) || snapT.isAfter(tc))) continue;
                    const st = stageAt(d, snapT);
                    if (!st) continue;
                    if (!best) best = { d, st };
                    else {
                        const bestYV = dayjs(best.d.yukleme_varis);
                        if (yv.isAfter(bestYV)) best = { d, st };
                    }
                }
                if (best) {
                    const st = best.st;
                    const durum =
                        st === "YÜKLEME NOKTASINDA"
                            ? "DOLU-YÜKLEME"
                            : st === "YOLDA"
                                ? "DOLU-YOLDA"
                                : "DOLU-BOŞALTMA";
                    final.push({
                        id: `${plaka}-${selectedDateTime}`,
                        plaka,
                        durum,
                        snapshot_stage: st,
                        sefer_no: best.d.sefer_no || best.d.sefer_id || "-",
                        aciklama: `${st} (Başlangıç: ${dayjs(best.d.yukleme_varis).format("DD.MM. HH:mm")})`,
                    });
                } else {
                    final.push({
                        id: `${plaka}-${selectedDateTime}`,
                        plaka,
                        durum: "BOŞTA",
                        snapshot_stage: "AKTİF DEĞİL",
                        sefer_no: "-",
                        aciklama: `Snapshot anında (${snapT.format("DD.MM.YYYY HH:mm")}) aktif iş veya izin yok`,
                    });
                }
            }
            setRows(final);
        } catch (e) {
            console.error(e);
            setError(e?.message || "Veri yüklenirken kritik hata oluştu.");
        } finally {
            setLoading(false);
        }
    }, [
        selectedDateTime,
        selectedDateStr,
        getIzinMapForDay,
        fetchWeekData,
        normalizePlaka,
        snapT,
        stageAt,
    ]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const loadPlakaDetails = useCallback(
        async (plakaRaw) => {
            const plaka = normalizePlaka(plakaRaw);
            if (!ALLOWED_PLATES.has(plaka)) return;
            setOpenDetail(true);
            setDetailLoading(true);
            setPopupData({ plaka, izin: null, tamamlanan: [], aktif: [] });
            try {
                const izinMap = await getIzinMapForDay(selectedDateStr);
                const izin = izinMap.get(plaka) || null;
                const { data: seferler, error: sErr } = await supabase.from(TABLE_SEFERLER).select("id").eq("plaka", plaka);
                if (sErr) throw new Error(sErr.message);
                const seferIds = (seferler || []).map((x) => x.id).filter(Boolean);
                let aktif = [];
                if (seferIds.length) {
                    const { data, error: dErr } = await supabase
                        .from(TABLE_SEFER_DETAY)
                        .select("sefer_id, yukleme_noktasi, teslim_noktasi, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis")
                        .in("sefer_id", seferIds)
                        .lt("yukleme_varis", weekEnd.toISOString())
                        .or(`teslim_cikis.is.null,teslim_cikis.gte.${weekStart.toISOString()}`)
                        .order("yukleme_varis", { ascending: true });
                    if (dErr) throw new Error(dErr.message);
                    aktif = (data || []).map((x) => {
                        const st = stageAt(x, snapT) || "AKTİF DEĞİL";
                        return { ...x, durum: "AKTİF", snapshot_stage: st };
                    });
                }
                const { data: completedSeferler, error: cErr } = await supabase
                    .from(TABLE_TAMAMLANAN_SEFERLER)
                    .select("sefer_no, sefer_tarihi")
                    .eq("plaka", plaka)
                    .gte("sefer_tarihi", weekStart.toISOString())
                    .lt("sefer_tarihi", weekEnd.toISOString())
                    .order("sefer_tarihi", { ascending: false });
                if (cErr) throw new Error(cErr.message);
                const seferNos = Array.from(new Set((completedSeferler || []).map((x) => x.sefer_no).filter(Boolean)));
                let tamamlanan = [];
                if (seferNos.length) {
                    const { data, error: tdErr } = await supabase
                        .from(TABLE_TAMAMLANAN_DETAYLAR)
                        .select("sefer_no, yukleme_noktasi, teslim_noktasi, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis")
                        .in("sefer_no", seferNos)
                        .order("yukleme_varis", { ascending: true });
                    if (tdErr) throw new Error(tdErr.message);
                    tamamlanan = (data || []).map((x) => {
                        const st = stageAt(x, snapT) || "AKTİF DEĞİL";
                        return { ...x, durum: "TAMAMLANDI", snapshot_stage: st };
                    });
                }
                setPopupData({ plaka, izin, aktif, tamamlanan });
            } catch (e) {
                console.error(e);
                setPopupData((p) => ({ ...p, izin: p.izin || null, aktif: [], tamamlanan: [] }));
            } finally {
                setDetailLoading(false);
            }
        },
        [normalizePlaka, selectedDateStr, getIzinMapForDay, weekStart, weekEnd, stageAt, snapT]
    );

    const exportToExcel = useCallback(
        (dataToExport) => {
            const safe = (v) => (v === null || v === undefined ? "" : v);
            const excelRows = (dataToExport || []).map((r) => ({
                Plaka: safe(r.plaka),
                Durum: safe(durumLabelToChip(r.durum)),
                "Snapshot Aşama": safe(r.snapshot_stage || ""),
                "Sefer No/ID": safe(r.sefer_no),
                Açıklama: safe(r.aciklama),
                Snapshot: snapT.format("YYYY-MM-DD HH:mm"),
            }));

            const ws = XLSX.utils.json_to_sheet(excelRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Rapor");
            XLSX.writeFile(wb, `Arac_Durum_${snapT.format("YYYY-MM-DD_HHmm")}.xlsx`);
        },
        [snapT]
    );


    const filteredRows = useMemo(() => {
        if (statusFilter === "HEPSI") return rows;
        if (statusFilter === "BOS") return rows.filter((r) => r.durum === "BOŞTA");
        if (statusFilter === "IZINLI") return rows.filter((r) => r.durum === "İZİNLİ");
        if (statusFilter === "DOLU") return rows.filter((r) => r.durum.startsWith("DOLU-"));
        return rows;
    }, [rows, statusFilter]);

    const counts = useMemo(() => {
        const c = { HEPSI: rows.length, DOLU: 0, BOS: 0, IZINLI: 0 };
        rows.forEach((r) => {
            if (r.durum === "BOŞTA") c.BOS++;
            else if (r.durum === "İZİNLİ") c.IZINLI++;
            else if (r.durum.startsWith("DOLU-")) c.DOLU++;
        });
        return c;
    }, [rows]);

    const columns = useMemo(
        () => [
            {
                field: "plaka",
                headerName: "Plaka",
                width: 150,
                renderCell: (p) => (
                    <Button
                        variant="text"
                        size="small"
                        onClick={() => loadPlakaDetails(p.value)}
                        sx={{ fontWeight: 900, color: THEME_COLORS.SECONDARY_ACCENT }}
                    >
                        {p.value}
                    </Button>
                ),
            },
            { field: "sefer_no", headerName: "Sefer No/ID", width: 170 },
            {
                field: "durum",
                headerName: "Anlık Durum",
                width: 220,
                renderCell: (p) => (
                    <Chip
                        label={durumLabelToChip(p.value)}
                        variant="filled"
                        sx={{ fontWeight: 900, color: "black", backgroundColor: getStatusColor(p.value) }}
                    />
                ),
            },
            {
                field: "snapshot_stage",
                headerName: "Snapshot Aşama",
                width: 220,
                renderCell: (p) => (
                    <Chip
                        label={p.value || "AKTİF DEĞİL"}
                        variant="outlined"
                        color={p.value && p.value !== "AKTİF DEĞİL" ? "primary" : "default"}
                        sx={{ fontWeight: 800, color: THEME_COLORS.TEXT_MAIN, borderColor: THEME_COLORS.TEXT_SECONDARY }}
                    />
                ),
            },
            { field: "aciklama", headerName: "Açıklama / Not", flex: 1, minWidth: 320 },
        ],
        [loadPlakaDetails]
    );

    // --- RENDER BÖLÜMÜ ---
    return (
        <Container maxWidth="xl" sx={{ py: 4, px: 2, backgroundColor: THEME_COLORS.BACKGROUND, minHeight: '100vh' }}>
            {/* Kontrol Paneli */}
            <Paper elevation={12} sx={{ p: 4, mb: 4, borderRadius: 3, backgroundColor: THEME_COLORS.SURFACE }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 900, color: THEME_COLORS.PRIMARY_ACCENT, display: 'flex', alignItems: 'center' }}>
                    <SpeedIcon sx={{ mr: 1, fontSize: 36, color: THEME_COLORS.PRIMARY_ACCENT }} />
                    Araç Durum Merkezi <span style={{ color: THEME_COLORS.TEXT_SECONDARY, marginLeft: '8px' }}>// Snapshot Raporlama</span>
                </Typography>

                <Box display="flex" gap={3} alignItems="flex-end" flexWrap="wrap" mt={3}>
                    <TextField
                        label="Snapshot Anı (Tarih + Saat)"
                        type="datetime-local"
                        InputLabelProps={{ shrink: true, sx: { color: THEME_COLORS.TEXT_SECONDARY } }}
                        InputProps={{
                            startAdornment: <CalendarTodayIcon sx={{ mr: 1, color: THEME_COLORS.PRIMARY_ACCENT }} />,
                            sx: { color: THEME_COLORS.TEXT_MAIN, backgroundColor: THEME_COLORS.HEADER, borderRadius: 1 }
                        }}
                        value={selectedDateTime}
                        onChange={(e) => setSelectedDateTime(e.target.value)}
                        size="small"
                        sx={{ minWidth: 280 }}
                    />

                    <Typography
                        variant="body1"
                        sx={{ fontWeight: 700, color: THEME_COLORS.SECONDARY_ACCENT, display: 'flex', alignItems: 'center' }}
                    >
                        <AccessTimeIcon sx={{ mr: 0.5 }} />
                        Seçilen An: {snapT.format("DD.MM.YYYY HH:mm")}
                    </Typography>

                    <Button
                        variant="contained"
                        onClick={loadData}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                        sx={{ height: 40, fontWeight: 900, backgroundColor: THEME_COLORS.PRIMARY_ACCENT, color: THEME_COLORS.HEADER, '&:hover': { backgroundColor: '#689f38' } }}
                    >
                        {loading ? "Rapor Hazırlanıyor..." : "Anlık Durumu Güncelle"}
                    </Button>

                    <Button
                        variant="outlined"
                        onClick={() => exportToExcel(filteredRows)}
                        disabled={loading || filteredRows.length === 0}
                        startIcon={<DownloadIcon />}
                        sx={{ height: 40, fontWeight: 700, color: THEME_COLORS.PRIMARY_ACCENT, borderColor: THEME_COLORS.PRIMARY_ACCENT, '&:hover': { backgroundColor: THEME_COLORS.PRIMARY_ACCENT + '20' } }}
                    >
                        Excel'e Aktar ({filteredRows.length} Kayıt)
                    </Button>
                </Box>
            </Paper>

            {/* Durum Özet Kartları */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatusSummaryCard
                        status="HEPSI"
                        count={counts.HEPSI}
                        currentFilter={statusFilter}
                        setFilter={setStatusFilter}
                        icon={AllInclusiveIcon}
                        color={THEME_COLORS.TEXT_MAIN}
                        label="Toplam Araç Sayısı"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatusSummaryCard
                        status="DOLU"
                        count={counts.DOLU}
                        currentFilter={statusFilter}
                        setFilter={setStatusFilter}
                        icon={LocalShippingIcon}
                        color={THEME_COLORS.DANGER}
                        label="Dolu (Aktif İş Var)"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatusSummaryCard
                        status="BOS"
                        count={counts.BOS}
                        currentFilter={statusFilter}
                        setFilter={setStatusFilter}
                        icon={GarageIcon}
                        color={THEME_COLORS.SUCCESS}
                        label="Boşta (İşsiz)"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatusSummaryCard
                        status="IZINLI"
                        count={counts.IZINLI}
                        currentFilter={statusFilter}
                        setFilter={setStatusFilter}
                        icon={DirectionsRunIcon}
                        color={THEME_COLORS.WARNING}
                        label="İzinli / Serviste"
                    />
                </Grid>
            </Grid>

            {error && (
                <Alert severity="error" variant="filled" sx={{ mb: 3, fontWeight: 700, backgroundColor: THEME_COLORS.DANGER }}>
                    <strong>Kritik Hata:</strong> {error}
                </Alert>
            )}

            {/* Ana DataGrid */}
            <Paper elevation={12} sx={{ height: "calc(100vh - 380px)", width: "100%", mb: 2, borderRadius: 3, overflow: 'hidden', backgroundColor: THEME_COLORS.SURFACE }}>
                <DataGrid
                    rows={filteredRows}
                    columns={columns}
                    disableRowSelectionOnClick
                    hideFooterPagination
                    loading={loading}
                    sx={{
                        [`& .${gridClasses.columnHeaders}`]: {
                            backgroundColor: THEME_COLORS.HEADER,
                            color: THEME_COLORS.PRIMARY_ACCENT,
                            fontSize: 14,
                            fontWeight: 900
                        },
                        '& .MuiDataGrid-cell': {
                            color: THEME_COLORS.TEXT_MAIN,
                        },
                        '& .MuiDataGrid-row': {
                            '&:nth-of-type(odd)': {
                                backgroundColor: THEME_COLORS.SURFACE,
                            },
                            '&:nth-of-type(even)': {
                                backgroundColor: '#262626', // Hafif koyu satır
                            },
                            '&:hover': {
                                backgroundColor: '#333333 !important',
                            },
                        },
                        border: "none",
                        backgroundColor: THEME_COLORS.SURFACE,
                    }}
                    localeText={{ noRowsLabel: "Filtrelenen kritere uygun araç kaydı yok." }}
                />
            </Paper>

            {/* DETAY POPUP (Koyu Tema) */}
            <Dialog open={openDetail} onClose={() => setOpenDetail(false)} maxWidth="lg" fullWidth>
                <DialogTitle
                    sx={{
                        backgroundColor: THEME_COLORS.HEADER,
                        color: THEME_COLORS.PRIMARY_ACCENT,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        p: 2,
                    }}
                >
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        {popupData.plaka} - Detaylı Sefer Geçmişi
                    </Typography>
                    <IconButton onClick={() => setOpenDetail(false)} sx={{ color: THEME_COLORS.PRIMARY_ACCENT }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent dividers sx={{ p: 4, backgroundColor: THEME_COLORS.BACKGROUND }}>
                    {detailLoading ? (
                        <Box display="flex" justifyContent="center" py={6}>
                            <CircularProgress size={60} sx={{ color: THEME_COLORS.PRIMARY_ACCENT }} />
                        </Box>
                    ) : (
                        <Box>
                            {popupData.izin && (
                                <Alert
                                    severity="warning"
                                    variant="outlined"
                                    sx={{ mb: 3, borderLeft: `4px solid ${THEME_COLORS.WARNING}`, fontWeight: 600, backgroundColor: THEME_COLORS.SURFACE, color: THEME_COLORS.TEXT_MAIN }}
                                >
                                    <Typography fontWeight={900} color={THEME_COLORS.WARNING}>
                                        📅 İZİNLİ BİLGİSİ (Snapshot Anında Geçerli)
                                    </Typography>
                                    <Typography variant="body2" color={THEME_COLORS.TEXT_SECONDARY}>
                                        **Tip:** {popupData.izin.izin_turu || "Belirtilmemiş"} |
                                        **Tarih Aralığı:** {popupData.izin.start ? dayjs(popupData.izin.start).format("DD.MM.YYYY") : "?"} → {popupData.izin.end ? dayjs(popupData.izin.end).format("DD.MM.YYYY") : "?"}
                                        {popupData.izin.aciklama ? ` | **Açıklama:** ${popupData.izin.aciklama}` : ""}
                                    </Typography>
                                </Alert>
                            )}

                            <Paper elevation={4} sx={{ p: 2, mb: 3, backgroundColor: THEME_COLORS.SURFACE, borderRadius: 2 }}>
                                <Typography variant="body1" sx={{ color: THEME_COLORS.TEXT_MAIN, fontWeight: 700 }}>
                                    🎯 Referans Anı: <span style={{ color: THEME_COLORS.PRIMARY_ACCENT }}>{snapT.format("DD.MM.YYYY HH:mm")}</span>
                                    <Typography variant="body2" color={THEME_COLORS.TEXT_SECONDARY}>
                                        Aşağıdaki tablolar, aracın seçilen anı da kapsayan son 7 gün içindeki seferlerini göstermektedir.
                                    </Typography>
                                </Typography>
                            </Paper>

                            <DetailTable
                                title="Aktif Devam Eden Seferler"
                                data={popupData.aktif}
                                isCompleted={false}
                                extraColumns={zamanExtraColumns}
                            />

                            <DetailTable
                                title="Tamamlanmış Seferler (Son 7 Gün)"
                                data={popupData.tamamlanan}
                                isCompleted={true}
                                extraColumns={zamanExtraColumns}
                            />
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Container>
    );
}
