import * as React from "react";
import {
    Box, Stack, Typography, Chip, Paper, TextField,
    Button, CircularProgress, Switch, FormControlLabel
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import TimelineIcon from "@mui/icons-material/Timeline";
import RefreshIcon from "@mui/icons-material/Refresh";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabase } from "../supabaseClient";

// =============================================================
// 🛠️ YARDIMCI FONKSİYONLAR
// =============================================================

const minToHM = (m) => {
    const mm = Math.max(0, Math.round(m || 0));
    const h = Math.floor(mm / 60);
    const r = mm % 60;

    const parts = [];
    if (h) parts.push(`${h} saat`);
    if (r || (!h && r === 0)) parts.push(`${r} dakika`);

    return parts.join(" ");
};

const calcFarkText = (etaIso, teslimIso) => {
    if (!etaIso || !teslimIso) return "-";

    const eta = new Date(etaIso);
    const teslim = new Date(teslimIso);

    if (Number.isNaN(eta.getTime()) || Number.isNaN(teslim.getTime())) return "-";

    const diffMin = Math.round((teslim.getTime() - eta.getTime()) / 60000);
    const abs = Math.abs(diffMin);

    if (diffMin > 0) return `Gecikti ${minToHM(abs)}`;
    if (diffMin < 0) return `Erken ${minToHM(abs)}`;
    return "Zamanında";
};

const fmt = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";

    const datePart = `${String(d.getDate()).padStart(2, "0")}.${String(
        d.getMonth() + 1
    ).padStart(2, "0")}.${d.getFullYear()}`;

    const timePart = `${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
    ).padStart(2, "0")}`;

    return `${datePart} ${timePart}`;
};

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const getDateRangeForDay = (dateStr) => {
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
};

const getRelevantDateIso = (raw, durum) => {
    if (!raw) return null;
    if (durum === "Tamamlandı") {
        return raw.eta_varis || raw.sefer_tarihi;
    } else {
        return raw.eta || raw.eta_varis || raw.sefer_tarihi;
    }
};

const getDateKey = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return iso.slice(0, 10);
};

// Yardımcı: array'i chunk'lara böl
const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

// =============================================================
// 🌐 VERİ ÇEKME FONKSİYONU
// =============================================================
async function fetchPerformanceData(selectedDate) {
    const { start, end } = getDateRangeForDay(selectedDate);
    console.log("DB TARİH ARALIĞI:", { start, end });

    const LIMIT = 5000;

    try {
        // ------------------ 1. AKTİF SEFERLER (JS Tarafında Filtre) ----------------------
        const activeSelect =
            "id, sefer_no, sefer_tarihi, plaka, eta, proje_adi, atama_yapan_kullanici, yukleme_noktasi, yukleme_ili, yukleme_ilcesi, teslim_noktasi, teslim_ili, teslim_ilcesi, eta_varis, sefer_detaylari:sefer_detaylari!sefer_id(yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis, nokta_sirasi)";

        const { data: active, error: activeError } = await supabase
            .from("seferler")
            .select(activeSelect)
            .limit(LIMIT);

        if (activeError) throw new Error("Aktif Seferler Hatası: " + activeError.message);
        console.log("AKTİF SEFER ADET (toplam):", active?.length || 0);

        // ---------------- 2. TAMAMLANAN SEFERLER (DB Tarafında Tarih Filtresi) ----------------
        const completedSelect =
            "id, sefer_no, sefer_tarihi, plaka, proje_adi, atama_yapan_kullanici, eta_varis, yukleme_noktasi, yukleme_ili, yukleme_ilcesi, teslim_noktasi, teslim_ili, teslim_ilcesi";

        const { data: completedHeaders, error: headersError } = await supabase
            .from("tamamlanan_seferler")
            .select(completedSelect)
            .gte("eta_varis", start)
            .lt("eta_varis", end)
            .limit(LIMIT);

        if (headersError) {
            throw new Error("Tamamlanan Seferler Ana Tablo Hatası: " + headersError.message);
        }

        console.log(
            "TAMAMLANAN SEFER ADET (DB filtresi sonrası):",
            completedHeaders?.length || 0
        );

        // ---------------- 3. TAMAMLANAN SEFERLER DETAYLARI (SADECE BU GÜNÜN SEFERLERİ) -------------------
        const seferNos = (completedHeaders || [])
            .map((s) => String(s.sefer_no))
            .filter(Boolean);

        let completedDetails = [];

        if (seferNos.length) {
            const chunks = chunkArray(seferNos, 500); // 500 güvenli bir boyut
            const all = [];

            for (const chunk of chunks) {
                const { data, error } = await supabase
                    .from("tamamlanan_detaylar")
                    .select("sefer_no, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis, nokta_sirasi")
                    .in("sefer_no", chunk);

                if (error) throw new Error("Tamamlanan Seferler Detay Hatası: " + error.message);
                all.push(...(data || []));
            }

            completedDetails = all;
        }

        console.log("TAMAMLANAN DETAY TOPLAM:", completedDetails.length);

        // ------------------ 4. BİRLEŞTİRME VE NORMALİZASYON ----------------------
        const detailsMap = (completedDetails || []).reduce((acc, detail) => {
            const seferNo = String(detail.sefer_no);
            if (!acc[seferNo]) acc[seferNo] = [];
            acc[seferNo].push(detail);
            return acc;
        }, {});

        const getFirstDetail = (detailsArray) => {
            return (detailsArray || [])
                .slice()
                .sort((a, b) => (a.nokta_sirasi ?? 0) - (b.nokta_sirasi ?? 0))[0] || {};
        };

        const rows = [];
        let tamamlananSayaci = 0;

        // ------------------ NORMALİZE: AKTİF ----------------------
        (active || []).forEach((s) => {
            const det = getFirstDetail(s.sefer_detaylari);

            const etaIsoActive = s.eta || s.eta_varis || null;
            const teslimIsoActive = det.teslim_varis || null;

            rows.push({
                id: `A-${s.id}`,
                sefer_no: s.sefer_no,
                plaka: s.plaka,
                proje_adi: s.proje_adi || "-",
                atama_yapan: s.atama_yapan_kullanici || "-",
                tarih: fmt(s.sefer_tarihi),
                yukleme: `${s.yukleme_noktasi || "-"} (${s.yukleme_ili || ""}/${s.yukleme_ilcesi || ""})`,
                teslim: `${s.teslim_noktasi || "-"} (${s.teslim_ili || ""}/${s.teslim_ilcesi || ""})`,

                yukleme_varis: fmt(det.yukleme_varis),
                yukleme_cikis: fmt(det.yukleme_cikis),
                teslim_varis: fmt(det.teslim_varis),
                teslim_cikis: fmt(det.teslim_cikis),

                eta: etaIsoActive ? fmt(etaIsoActive) : "ETA YOK",
                fark: calcFarkText(etaIsoActive, teslimIsoActive),
                durum: "Aktif",
                raw: s
            });
        });

        // --------------- NORMALİZE: TAMAMLANAN -------------------
        (completedHeaders || []).forEach((s) => {
            tamamlananSayaci++;

            const details = detailsMap[String(s.sefer_no)] || [];
            if (!details.length) {
                console.log("DETAY YOK -> sefer_no:", s.sefer_no);
            }
            const det = getFirstDetail(details);

            const etaIsoCompleted = s.eta_varis || null;
            const teslimIsoCompleted = det.teslim_varis || null;

            rows.push({
                id: `T-${s.id}`,
                sefer_no: s.sefer_no,
                plaka: s.plaka,
                proje_adi: s.proje_adi || "-",
                atama_yapan: s.atama_yapan_kullanici || "-",
                tarih: fmt(s.sefer_tarihi),
                yukleme: `${s.yukleme_noktasi || "-"} (${s.yukleme_ili || ""}/${s.yukleme_ilcesi || ""})`,
                teslim: `${s.teslim_noktasi || "-"} (${s.teslim_ili || ""}/${s.teslim_ilcesi || ""})`,

                yukleme_varis: fmt(det.yukleme_varis),
                yukleme_cikis: fmt(det.yukleme_cikis),
                teslim_varis: fmt(det.teslim_varis),
                teslim_cikis: fmt(det.teslim_cikis),

                eta: etaIsoCompleted ? fmt(etaIsoCompleted) : "ETA YOK",
                fark: calcFarkText(etaIsoCompleted, teslimIsoCompleted),
                durum: "Tamamlandı",
                raw: s
            });
        });

        console.log("NORMALİZASYON BİTTİ: Toplam Tamamlanan Sefer Sayısı:", tamamlananSayaci);
        console.log("ROWS DİZİSİNİN SON UZUNLUĞU:", rows.length);

        return rows;
    } catch (error) {
        console.error("Veri çekme/işleme sırasında kritik hata:", error);
        throw error;
    }
}

// =============================================================
// 📊 DASHBOARD BİLEŞENİ
// =============================================================
export default function Dashboard() {
    const [rows, setRows] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedDate, setSelectedDate] = React.useState(getTodayDateString());
    const [onlyLate, setOnlyLate] = React.useState(false);

    const loadData = React.useCallback(async (dateStr) => {
        setLoading(true);
        try {
            const res = await fetchPerformanceData(dateStr);
            setRows(res);
        } catch (error) {
            console.error("Veri yüklenirken hata oluştu:", error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData(selectedDate);
    }, [loadData, selectedDate]);

    const filtered = React.useMemo(() => {
        console.log(`Filtreleme Başladı: Tarih=${selectedDate}, Sadece Gecikenler=${onlyLate}`);

        return rows.filter((r) => {
            const rawDateIso = getRelevantDateIso(r.raw, r.durum);
            const dateKey = getDateKey(rawDateIso);

            if (!dateKey) return false;
            if (dateKey !== selectedDate) return false;

            if (onlyLate && !String(r.fark || "").includes("Gecikti")) return false;

            return true;
        });
    }, [rows, selectedDate, onlyLate]);

    console.log("Filtre sonrası (filtered):", filtered.length);

    const columns = React.useMemo(() => [
        {
            field: "durum",
            headerName: "Durum",
            minWidth: 120,
            flex: 1,
            renderCell: (p) => (
                <Chip
                    label={p.value}
                    color={p.value === "Aktif" ? "warning" : "primary"}
                    size="small"
                    variant="outlined"
                />
            )
        },
        { field: "sefer_no", headerName: "Sefer No", minWidth: 120, flex: 1 },
        { field: "plaka", headerName: "Plaka", minWidth: 100, flex: 1 },
        { field: "proje_adi", headerName: "Proje Adı", minWidth: 180, flex: 2 },
        { field: "tarih", headerName: "Sefer Tarihi", minWidth: 150, flex: 1.5 },
        { field: "atama_yapan", headerName: "Atama Yapan", minWidth: 180, flex: 1.5 },

        { field: "yukleme", headerName: "Yükleme Noktası", minWidth: 250, flex: 2.5 },
        { field: "teslim", headerName: "Teslim Noktası", minWidth: 250, flex: 2.5 },

        { field: "yukleme_varis", headerName: "Yük. Varış", minWidth: 150, flex: 1.5 },
        { field: "yukleme_cikis", headerName: "Yük. Çıkış", minWidth: 150, flex: 1.5 },

        { field: "eta", headerName: "Tahmini Varış (ETA)", minWidth: 150, flex: 1.5 },
        { field: "teslim_varis", headerName: "Gerçek Varış", minWidth: 150, flex: 1.5 },
        { field: "teslim_cikis", headerName: "Teslim Çıkış", minWidth: 150, flex: 1.5 },

        {
            field: "fark",
            headerName: "Fark (Teslim - ETA)",
            minWidth: 180,
            flex: 2,
            renderCell: (p) => {
                const value = String(p.value || "");
                let color = "default";
                if (value.includes("Gecikti")) color = "error";
                else if (value.includes("Erken")) color = "success";
                else if (value.includes("Zamanında")) color = "info";

                return <Chip label={value} color={color} size="small" />;
            }
        }
    ], []);

    const exportExcel = async () => {
        try {
            const book = new ExcelJS.Workbook();
            const sheet = book.addWorksheet("ETA Performans");

            sheet.columns = [
                { header: "Durum", key: "durum", width: 14 },
                { header: "Sefer No", key: "sefer_no", width: 14 },
                { header: "Plaka", key: "plaka", width: 12 },
                { header: "Sefer Tarihi", key: "tarih", width: 18 },
                { header: "Yükleme Noktası", key: "yukleme", width: 40 },
                { header: "Teslim Noktası", key: "teslim", width: 40 },
                { header: "Yükleme Çıkış Tarihi", key: "yukleme_cikis", width: 20 },
                { header: "ETA", key: "eta", width: 18 },
                { header: "Teslim Varış Tarihi", key: "teslim_varis", width: 20 },
                { header: "Fark", key: "fark", width: 22 },
            ];

            const excelRows = filtered.map((r) => ({
                durum: r.durum,
                sefer_no: r.sefer_no,
                plaka: r.plaka,
                tarih: r.tarih,
                yukleme: r.yukleme,
                teslim: r.teslim,
                yukleme_cikis: r.yukleme_cikis,
                eta: r.eta,
                teslim_varis: r.teslim_varis,
                fark: r.fark,
            }));

            sheet.addRows(excelRows);
            sheet.getRow(1).font = { bold: true };

            const buffer = await book.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `eta_performans_raporu_${selectedDate}.xlsx`);
        } catch (error) {
            console.error("Excel dışa aktarma hatası:", error);
            alert("Excel dosyası oluşturulurken bir hata oluştu.");
        }
    };

    return (
        <Box sx={{ py: 4, px: 2 }}>
            {/* HEADER */}
            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <TimelineIcon color="primary" sx={{ fontSize: 34 }} />
                    <Typography variant="h5" fontWeight={700} color="primary">
                        ETA Performans Paneli
                    </Typography>
                </Stack>
            </Paper>

            {/* FILTERS & ACTIONS */}
            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={3}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    flexWrap="wrap"
                >
                    <TextField
                        type="date"
                        label="ETA Tarihi (Hedef Gün)"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        size="small"
                        sx={{ minWidth: 200 }}
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={onlyLate}
                                onChange={(e) => setOnlyLate(e.target.checked)}
                                color="error"
                            />
                        }
                        label="Sadece Gecikenleri Göster"
                    />

                    <Button
                        variant="contained"
                        onClick={() => loadData(selectedDate)}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                        sx={{ minWidth: 120 }}
                    >
                        {loading ? "Yükleniyor..." : "Yenile"}
                    </Button>

                    <Button
                        variant="outlined"
                        onClick={exportExcel}
                        disabled={!filtered.length || loading}
                        startIcon={<FileDownloadIcon />}
                        color="success"
                        sx={{ minWidth: 120 }}
                    >
                        Excel ({filtered.length})
                    </Button>
                </Stack>
            </Paper>

            {/* DATAGRID */}
            <Paper elevation={3} sx={{ height: 700, width: "100%", overflowX: "auto" }}>
                {loading ? (
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            height: "100%",
                            flexDirection: "column",
                            gap: 2
                        }}
                    >
                        <CircularProgress size={50} />
                        <Typography variant="subtitle1" color="text.secondary">
                            Veriler yükleniyor... Bu biraz zaman alabilir.
                        </Typography>
                    </Box>
                ) : (
                    <DataGrid
                        rows={filtered}
                        columns={columns}
                        getRowId={(r) => r.id}
                        disableRowSelectionOnClick
                        density="compact"
                        localeText={{ noRowsLabel: "Belirtilen tarihe ait sefer bulunamadı." }}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 100 } },
                            sorting: { sortModel: [{ field: "fark", sort: "asc" }] }
                        }}
                        pageSizeOptions={[50, 100, 200]}
                    />
                )}
            </Paper>
        </Box>
    );
}
