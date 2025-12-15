import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
    Container, Paper, Box, Typography, TextField, Button,
    CircularProgress, Dialog, DialogTitle, DialogContent,
    TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
    Chip, Alert, Grid, IconButton,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import GarageIcon from "@mui/icons-material/Garage";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import DownloadIcon from "@mui/icons-material/Download";

import { DataGrid, gridClasses } from "@mui/x-data-grid";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";

/* ========= SADECE BU PLAKALAR ========= */
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

/* ========= TABLOLAR ========= */
const TABLE_TAMAMLANAN_SEFERLER = "tamamlanan_seferler";
const TABLE_TAMAMLANAN_DETAYLAR = "tamamlanan_detaylar";
const TABLE_SEFERLER = "seferler";
const TABLE_SEFER_DETAY = "sefer_detaylari";
const TABLE_IZINLER = "izinler";

/* ========= İZİN KOLONLARI ========= */
const IZIN_PLAKA_COL = "plaka_treyler";
const IZIN_START_COL = "baslangic_tarihi";
const IZIN_END_COL = "bitis_tarihi";

/* ========= UI: Detay Table ========= */
const DetailTable = ({ title, data, isCompleted, extraColumns }) => (
    <Box mt={3}>
        <Typography
            variant="h6"
            sx={{
                color: isCompleted ? "#00796b" : "#e64a19",
                borderBottom: `2px solid ${isCompleted ? "#00796b" : "#e64a19"}`,
                pb: 0.5,
                fontWeight: 800,
            }}
        >
            {title}{" "}
            <Chip
                label={`${data.length} Kayıt`}
                size="small"
                color={isCompleted ? "success" : "error"}
                sx={{ ml: 1, fontWeight: 900 }}
            />
        </Typography>

        {data.length === 0 ? (
            <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
                Kayıt yok.
            </Alert>
        ) : (
            <TableContainer component={Paper} elevation={1} sx={{ mt: 1 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: isCompleted ? "#e0f2f1" : "#ffe0b2" }}>
                            <TableCell sx={{ fontWeight: 900 }}>Sefer No / ID</TableCell>
                            <TableCell sx={{ fontWeight: 900 }}>Yükleme Noktası</TableCell>
                            <TableCell sx={{ fontWeight: 900 }}>Teslim Noktası</TableCell>

                            {/* Snapshot Aşama */}
                            <TableCell sx={{ fontWeight: 900 }}>Snapshot Aşama</TableCell>

                            {extraColumns.map((c) => (
                                <TableCell key={c.field} sx={{ fontWeight: 900 }}>
                                    {c.headerName}
                                </TableCell>
                            ))}
                            <TableCell sx={{ fontWeight: 900 }}>Durum</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {data.map((row, idx) => (
                            <TableRow key={`${row.sefer_no || row.sefer_id || "X"}-${idx}`} hover>
                                <TableCell>{row.sefer_no || row.sefer_id || "-"}</TableCell>
                                <TableCell>{row.yukleme_noktasi || "-"}</TableCell>
                                <TableCell>{row.teslim_noktasi || "-"}</TableCell>

                                <TableCell>
                                    <Chip
                                        label={row.snapshot_stage || "Aktif değil"}
                                        size="small"
                                        variant="outlined"
                                        color={row.snapshot_stage && row.snapshot_stage !== "AKTİF DEĞİL" ? "primary" : "default"}
                                        sx={{ fontWeight: 900 }}
                                    />
                                </TableCell>

                                {extraColumns.map((c) => (
                                    <TableCell key={c.field}>
                                        {row?.[c.field] ? dayjs(row[c.field]).format("DD.MM.YYYY HH:mm") : "-"}
                                    </TableCell>
                                ))}

                                <TableCell>
                                    <Chip
                                        label={row.durum || "Bilinmiyor"}
                                        size="small"
                                        color={isCompleted ? "success" : "error"}
                                        variant="outlined"
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

/* ========= UI: Status Cards ========= */
const StatusSummaryCard = ({ status, count, currentFilter, setFilter, icon: Icon, color, label }) => (
    <Paper
        elevation={currentFilter === status ? 8 : 2}
        onClick={() => setFilter(status)}
        sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            gap: 2,
            cursor: "pointer",
            transition: "all 0.25s",
            borderLeft: `5px solid ${color}`,
            backgroundColor: currentFilter === status ? `${color}10` : "white",
            "&:hover": { backgroundColor: `${color}20` },
        }}
    >
        <Icon sx={{ color, fontSize: 36 }} />
        <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: "#37474f" }}>
                {count}
            </Typography>
            <Typography variant="body2" sx={{ color: "#546e7a" }}>
                {label}
            </Typography>
        </Box>
    </Paper>
);

export default function BostaArac() {
    // ✅ datetime-local format: YYYY-MM-DDTHH:mm
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

    const normalizePlaka = useCallback((p) => {
        if (!p) return "";
        let s = String(p).trim().toUpperCase();
        s = s.replace(/\s+/g, " ").trim();
        if (s.includes("-")) s = s.split("-")[0].trim();
        if (s.includes("/")) s = s.split("/")[0].trim();
        if (s.includes(" ")) s = s.split(" ")[0].trim();
        return s;
    }, []);

    // ✅ snapshot zamanı: seçilen tarih+saat
    const snapT = useMemo(() => dayjs(selectedDateTime), [selectedDateTime]);

    // ✅ izin sorgusu / haftalık pencere için tarih kısmı
    const selectedDateStr = useMemo(() => snapT.format("YYYY-MM-DD"), [snapT]);

    // ✅ 1 haftalık pencere (seçilen gün -6 … seçilen gün +0)
    const weekStart = useMemo(() => dayjs(selectedDateStr).subtract(6, "day").startOf("day"), [selectedDateStr]);
    const weekEnd = useMemo(() => dayjs(selectedDateStr).add(1, "day").startOf("day"), [selectedDateStr]);

    const zamanExtraColumns = useMemo(() => [
        { field: "yukleme_varis", headerName: "Yükleme Varış" },
        { field: "yukleme_cikis", headerName: "Yükleme Çıkış" },
        { field: "teslim_varis", headerName: "Teslim Varış" },
        { field: "teslim_cikis", headerName: "Teslim Çıkış" },
    ], []);

    /* ========= DURUM HESABI =========
       snapshot anında (snapT) hangi aşamada?
    */
    const stageAt = useCallback((d, t) => {
        const yv = d?.yukleme_varis ? dayjs(d.yukleme_varis) : null;
        const yc = d?.yukleme_cikis ? dayjs(d.yukleme_cikis) : null;
        const tv = d?.teslim_varis ? dayjs(d.teslim_varis) : null;
        const tc = d?.teslim_cikis ? dayjs(d.teslim_cikis) : null;

        // sefer başlamadıysa
        if (!yv || t.isBefore(yv)) return null;

        // teslim çıkış geçmişse artık o an aktif değil
        if (tc && (t.isAfter(tc) || t.isSame(tc))) return null;

        // ✅ aşamalar
        if (yv && !yc) return "YÜKLEME NOKTASINDA";
        if (yv && yc && !tv) return "YOLDA";
        if (yv && yc && tv && !tc) return "BOŞALTMA NOKTASINDA";

        // edge-case: veri karışık ise
        if (yv && yc && tv && tc && t.isBefore(tc)) return "BOŞALTMA NOKTASINDA";
        return null;
    }, []);

    const getStatusColor = (durum) => {
        switch (durum) {
            case "DOLU-YÜKLEME": return "#ff9800";
            case "DOLU-YOLDA": return "#e64a19";
            case "DOLU-BOŞALTMA": return "#9c27b0";
            case "İZİNLİ": return "#ffa000";
            case "BOŞTA": return "#4caf50";
            default: return "#607d8b";
        }
    };

    const durumLabelToChip = (durum) => {
        if (durum === "DOLU-YÜKLEME") return "YÜKLEME NOKTASINDA";
        if (durum === "DOLU-YOLDA") return "YOLDA";
        if (durum === "DOLU-BOŞALTMA") return "BOŞALTMA NOKTASINDA";
        return durum;
    };

    /* ========= İZİN: seçilen gün içinde mi? (gün bazlı) ========= */
    const getIzinMapForDay = useCallback(async (dateStr) => {
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
    }, [normalizePlaka]);

    /* ========= 1 haftalık veriyi topluca çek ========= */
    const fetchWeekData = useCallback(async () => {
        const allowed = Array.from(ALLOWED_PLATES.values()).map(normalizePlaka);

        // 1) aktif seferler (şu an)
        const { data: activeSeferler, error: aErr } = await supabase
            .from(TABLE_SEFERLER)
            .select("id, plaka")
            .in("plaka", allowed);

        if (aErr) throw new Error(`seferler hata: ${aErr.message}`);

        const activeIds = (activeSeferler || []).map((x) => x.id).filter(Boolean);

        // 2) aktif sefer detayları (bu hafta aralığında bir hareketi olanlar)
        let activeDetails = [];
        if (activeIds.length) {
            const { data: d, error: dErr } = await supabase
                .from(TABLE_SEFER_DETAY)
                .select("sefer_id, yukleme_noktasi, teslim_noktasi, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis")
                .in("sefer_id", activeIds)
                .gte("yukleme_varis", weekStart.toISOString())
                .lt("yukleme_varis", weekEnd.toISOString());

            if (dErr) throw new Error(`sefer_detaylari hata: ${dErr.message}`);
            activeDetails = d || [];
        }

        // 3) tamamlanan seferler (bu hafta içinde sefer_tarihi olanlar)
        const { data: completedSeferler, error: cErr } = await supabase
            .from(TABLE_TAMAMLANAN_SEFERLER)
            .select("plaka, sefer_no, sefer_tarihi")
            .in("plaka", allowed)
            .gte("sefer_tarihi", weekStart.toISOString())
            .lt("sefer_tarihi", weekEnd.toISOString());

        if (cErr) throw new Error(`tamamlanan_seferler hata: ${cErr.message}`);

        const seferNos = Array.from(new Set((completedSeferler || []).map((x) => x.sefer_no).filter(Boolean)));

        // 4) tamamlanan detaylar (bu sefer_no’lar)
        let completedDetails = [];
        if (seferNos.length) {
            const { data: cd, error: cdErr } = await supabase
                .from(TABLE_TAMAMLANAN_DETAYLAR)
                .select("sefer_no, yukleme_noktasi, teslim_noktasi, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis")
                .in("sefer_no", seferNos);

            if (cdErr) throw new Error(`tamamlanan_detaylar hata: ${cdErr.message}`);
            completedDetails = cd || [];
        }

        return { activeSeferler: activeSeferler || [], activeDetails, completedSeferler: completedSeferler || [], completedDetails };
    }, [normalizePlaka, weekStart, weekEnd]);

    /* ========= seçilen snapshot için durumları üret ========= */
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setRows([]);

        try {
            const izinMap = await getIzinMapForDay(selectedDateStr);
            const weekData = await fetchWeekData();

            // completed sefer_no -> plaka map
            const seferNoToPlate = new Map();
            (weekData.completedSeferler || []).forEach((s) => {
                const p = normalizePlaka(s.plaka);
                if (!p) return;
                seferNoToPlate.set(s.sefer_no, p);
            });

            // aktif sefer_id -> plaka map
            const seferIdToPlate = new Map();
            (weekData.activeSeferler || []).forEach((s) => {
                const p = normalizePlaka(s.plaka);
                if (!p) return;
                seferIdToPlate.set(s.id, p);
            });

            // plaka -> detail list
            const candidatesByPlate = new Map();

            // aktif detayları ekle
            for (const d of (weekData.activeDetails || [])) {
                const p = seferIdToPlate.get(d.sefer_id);
                if (!p) continue;
                if (!candidatesByPlate.has(p)) candidatesByPlate.set(p, []);
                candidatesByPlate.get(p).push({ ...d, __src: "AKTIF", sefer_id: d.sefer_id });
            }

            // tamamlanan detayları ekle
            for (const d of (weekData.completedDetails || [])) {
                const p = seferNoToPlate.get(d.sefer_no);
                if (!p) continue;
                if (!candidatesByPlate.has(p)) candidatesByPlate.set(p, []);
                candidatesByPlate.get(p).push({ ...d, __src: "TAMAMLANAN", sefer_no: d.sefer_no });
            }

            const final = [];
            const allowedPlates = Array.from(ALLOWED_PLATES.values()).map(normalizePlaka);

            for (const plaka of allowedPlates) {
                // 1) izin öncelik
                const izin = izinMap.get(plaka);
                if (izin) {
                    final.push({
                        id: `${plaka}-${selectedDateTime}`,
                        plaka,
                        durum: "İZİNLİ",
                        sefer_no: "-",
                        snapshot_stage: "İZİNLİ",
                        aciklama:
                            `İzin${izin.izin_turu ? ` (${izin.izin_turu})` : ""}: ` +
                            `${izin.start ? dayjs(izin.start).format("DD.MM.YYYY") : "?"} → ` +
                            `${izin.end ? dayjs(izin.end).format("DD.MM.YYYY") : "?"}` +
                            `${izin.aciklama ? ` | ${izin.aciklama}` : ""}`,
                    });
                    continue;
                }

                // 2) snapshot’ta aktif bir iş var mı?
                const list = candidatesByPlate.get(plaka) || [];

                // snapshot’ta hangi detail geçerli?
                let best = null;
                for (const d of list) {
                    const yv = d?.yukleme_varis ? dayjs(d.yukleme_varis) : null;
                    if (!yv) continue;
                    if (snapT.isBefore(yv)) continue;

                    const tc = d?.teslim_cikis ? dayjs(d.teslim_cikis) : null;
                    if (tc && (snapT.isAfter(tc) || snapT.isSame(tc))) continue;

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
                        st === "YÜKLEME NOKTASINDA" ? "DOLU-YÜKLEME" :
                            st === "YOLDA" ? "DOLU-YOLDA" :
                                "DOLU-BOŞALTMA";

                    final.push({
                        id: `${plaka}-${selectedDateTime}`,
                        plaka,
                        durum,
                        snapshot_stage: st,
                        sefer_no: best.d.sefer_no || best.d.sefer_id || "-",
                        aciklama: `${st} (snapshot: ${snapT.format("DD.MM.YYYY HH:mm")})`,
                    });
                } else {
                    // 3) o an işi yok -> BOŞTA
                    final.push({
                        id: `${plaka}-${selectedDateTime}`,
                        plaka,
                        durum: "BOŞTA",
                        snapshot_stage: "AKTİF DEĞİL",
                        sefer_no: "-",
                        aciklama: `Snapshot anında (${snapT.format("DD.MM.YYYY HH:mm")}) aktif iş yok`,
                    });
                }
            }

            setRows(final);
        } catch (e) {
            console.error(e);
            setError(e.message || "Hata oluştu");
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
        stageAt
    ]);

    useEffect(() => { loadData(); }, [loadData]);

    /* ========= detay popup ========= */
    const loadPlakaDetails = useCallback(async (plakaRaw) => {
        const plaka = normalizePlaka(plakaRaw);
        if (!ALLOWED_PLATES.has(plaka)) return;

        setOpenDetail(true);
        setDetailLoading(true);
        setPopupData({ plaka, izin: null, tamamlanan: [], aktif: [] });

        try {
            const izinMap = await getIzinMapForDay(selectedDateStr);
            const izin = izinMap.get(plaka) || null;

            // aktif sefer id’leri
            const { data: seferler } = await supabase
                .from(TABLE_SEFERLER)
                .select("id")
                .eq("plaka", plaka);

            const seferIds = (seferler || []).map((x) => x.id).filter(Boolean);

            // aktif detaylar
            let aktif = [];
            if (seferIds.length) {
                const { data } = await supabase
                    .from(TABLE_SEFER_DETAY)
                    .select("sefer_id, yukleme_noktasi, teslim_noktasi, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis")
                    .in("sefer_id", seferIds)
                    .order("yukleme_varis", { ascending: true });

                aktif = (data || []).map((x) => {
                    const st = stageAt(x, snapT) || "AKTİF DEĞİL";
                    return { ...x, durum: "AKTİF", snapshot_stage: st };
                });
            }

            // tamamlanan seferler (1 hafta)
            const { data: completedSeferler } = await supabase
                .from(TABLE_TAMAMLANAN_SEFERLER)
                .select("sefer_no, sefer_tarihi")
                .eq("plaka", plaka)
                .gte("sefer_tarihi", weekStart.toISOString())
                .lt("sefer_tarihi", weekEnd.toISOString())
                .order("sefer_tarihi", { ascending: false });

            const seferNos = Array.from(new Set((completedSeferler || []).map((x) => x.sefer_no).filter(Boolean)));

            let tamamlanan = [];
            if (seferNos.length) {
                const { data } = await supabase
                    .from(TABLE_TAMAMLANAN_DETAYLAR)
                    .select("sefer_no, yukleme_noktasi, teslim_noktasi, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis")
                    .in("sefer_no", seferNos)
                    .order("yukleme_varis", { ascending: true });

                tamamlanan = (data || []).map((x) => {
                    const st = stageAt(x, snapT) || "AKTİF DEĞİL";
                    return { ...x, durum: "TAMAMLANDI", snapshot_stage: st };
                });
            }

            setPopupData({ plaka, izin, aktif, tamamlanan });
        } finally {
            setDetailLoading(false);
        }
    }, [
        normalizePlaka,
        selectedDateStr,
        getIzinMapForDay,
        weekStart,
        weekEnd,
        stageAt,
        snapT
    ]);

    /* ========= excel ========= */
    const exportToExcel = useCallback((dataToExport) => {
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
    }, [snapT]);

    /* ========= filtre ========= */
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

    const columns = useMemo(() => [
        {
            field: "plaka",
            headerName: "Plaka",
            width: 150,
            renderCell: (p) => (
                <Button
                    variant="text"
                    size="small"
                    onClick={() => loadPlakaDetails(p.value)}
                    sx={{ fontWeight: 900, color: "#3f51b5" }}
                >
                    {p.value}
                </Button>
            ),
            headerClassName: "super-app-theme--header",
        },
        { field: "sefer_no", headerName: "Sefer No/ID", width: 170, headerClassName: "super-app-theme--header" },
        {
            field: "durum",
            headerName: "Durum",
            width: 220,
            headerClassName: "super-app-theme--header",
            renderCell: (p) => (
                <Chip
                    label={durumLabelToChip(p.value)}
                    variant="filled"
                    sx={{ fontWeight: 900, color: "white", backgroundColor: getStatusColor(p.value) }}
                />
            ),
        },
        {
            field: "snapshot_stage",
            headerName: "Snapshot Aşama",
            width: 220,
            headerClassName: "super-app-theme--header",
            renderCell: (p) => (
                <Chip
                    label={p.value || "AKTİF DEĞİL"}
                    variant="outlined"
                    sx={{ fontWeight: 900 }}
                />
            ),
        },
        { field: "aciklama", headerName: "Açıklama", flex: 1, minWidth: 320, headerClassName: "super-app-theme--header" },
    ], [loadPlakaDetails]);

    return (
        <Container maxWidth="xl" sx={{ py: 3, px: 2 }}>
            <Paper elevation={4} sx={{ p: 4, mb: 3, borderRadius: 2, backgroundColor: "#f5f7fa" }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 900, color: "#2c3e50" }}>
                    🚚 Araç Durum Paneli
                </Typography>

                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Snapshot: <b>{snapT.format("DD.MM.YYYY HH:mm")}</b>
                </Typography>

                <Box display="flex" gap={2} alignItems="flex-end" flexWrap="wrap">
                    <TextField
                        label="Snapshot (Tarih + Saat)"
                        type="datetime-local"
                        InputLabelProps={{ shrink: true }}
                        InputProps={{ startAdornment: <CalendarTodayIcon sx={{ mr: 1, color: "action.active" }} /> }}
                        value={selectedDateTime}
                        onChange={(e) => setSelectedDateTime(e.target.value)}
                        size="small"
                        sx={{ minWidth: 260 }}
                    />

                    <Button
                        variant="contained"
                        onClick={loadData}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                        sx={{ height: 40, fontWeight: 900 }}
                    >
                        {loading ? "Yükleniyor..." : "Raporu Güncelle"}
                    </Button>

                    <Button
                        variant="outlined"
                        onClick={() => exportToExcel(filteredRows)}
                        disabled={loading || filteredRows.length === 0}
                        startIcon={<DownloadIcon />}
                        sx={{ height: 40, fontWeight: 900 }}
                    >
                        Excel'e Aktar
                    </Button>
                </Box>
            </Paper>

            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatusSummaryCard
                        status="HEPSI"
                        count={counts.HEPSI}
                        currentFilter={statusFilter}
                        setFilter={setStatusFilter}
                        icon={AllInclusiveIcon}
                        color="#3f51b5"
                        label="Tüm Araçlar"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatusSummaryCard
                        status="DOLU"
                        count={counts.DOLU}
                        currentFilter={statusFilter}
                        setFilter={setStatusFilter}
                        icon={LocalShippingIcon}
                        color="#e64a19"
                        label="Dolu (İş Var)"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatusSummaryCard
                        status="BOS"
                        count={counts.BOS}
                        currentFilter={statusFilter}
                        setFilter={setStatusFilter}
                        icon={GarageIcon}
                        color="#4caf50"
                        label="Boşta"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatusSummaryCard
                        status="IZINLI"
                        count={counts.IZINLI}
                        currentFilter={statusFilter}
                        setFilter={setStatusFilter}
                        icon={DirectionsRunIcon}
                        color="#ffa000"
                        label="İzinli"
                    />
                </Grid>
            </Grid>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    <strong>Hata:</strong> {error}
                </Alert>
            )}

            <Paper elevation={4} sx={{ height: "calc(100vh - 430px)", width: "100%", mb: 2, borderRadius: 2 }}>
                <DataGrid
                    rows={filteredRows}
                    columns={columns}
                    disableRowSelectionOnClick
                    hideFooterPagination
                    loading={loading}
                    sx={{
                        [`& .${gridClasses.columnHeaders}`]: { backgroundColor: "#34495e", color: "white", fontSize: 14 },
                        "& .super-app-theme--header": { backgroundColor: "#34495e", color: "white", fontWeight: 900 },
                        border: "none",
                    }}
                    localeText={{ noRowsLabel: "Kayıt yok." }}
                />
            </Paper>

            {/* ========= DETAY POPUP ========= */}
            <Dialog open={openDetail} onClose={() => setOpenDetail(false)} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ backgroundColor: "#34495e", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>{popupData.plaka}</Typography>
                    <IconButton onClick={() => setOpenDetail(false)} sx={{ color: "white" }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent dividers sx={{ p: 3 }}>
                    {detailLoading ? (
                        <Box display="flex" justifyContent="center" py={6}><CircularProgress size={60} /></Box>
                    ) : (
                        <Box>
                            {popupData.izin && (
                                <Alert severity="warning" variant="filled" sx={{ mb: 2 }}>
                                    <Typography fontWeight={900}>İzinli</Typography>
                                    <Typography variant="body2">
                                        {popupData.izin.start ? dayjs(popupData.izin.start).format("DD.MM.YYYY") : "?"} -{" "}
                                        {popupData.izin.end ? dayjs(popupData.izin.end).format("DD.MM.YYYY") : "?"}
                                        {popupData.izin.izin_turu ? ` (${popupData.izin.izin_turu})` : ""}
                                        {popupData.izin.aciklama ? ` | ${popupData.izin.aciklama}` : ""}
                                    </Typography>
                                </Alert>
                            )}

                            <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
                                Snapshot zamanı: <b>{snapT.format("DD.MM.YYYY HH:mm")}</b>
                            </Typography>

                            <DetailTable title="Aktif Sefer Detayları" data={popupData.aktif} isCompleted={false} extraColumns={zamanExtraColumns} />
                            <DetailTable title="Tamamlanan Sefer Detayları (1 hafta)" data={popupData.tamamlanan} isCompleted={true} extraColumns={zamanExtraColumns} />
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Container>
    );
}
