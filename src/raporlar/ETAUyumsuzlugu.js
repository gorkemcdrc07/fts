import * as React from "react";
import {
    Box, Stack, Typography, Chip, Paper, TextField,
    Button, CircularProgress, IconButton, Switch, FormControlLabel
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

/**
 * İki ISO tarih/saat damgası arasındaki farkı hesaplar ve metin olarak döndürür.
 * @param {string | null} etaIso - Tahmini varış zamanı (ISO 8601).
 * @param {string | null} teslimIso - Gerçek teslim varış zamanı (ISO 8601).
 * @returns {string} Fark metni (örn: "Gecikti 1 saat 30 dakika", "Zamanında").
 */
const calcFarkText = (etaIso, teslimIso) => {
    if (!etaIso || !teslimIso) return "-";

    const eta = new Date(etaIso);
    const teslim = new Date(teslimIso);

    // Geçersiz tarih kontrolü
    if (Number.isNaN(eta.getTime()) || Number.isNaN(teslim.getTime())) {
        return "-";
    }

    const diffMin = Math.round((teslim.getTime() - eta.getTime()) / 60000); // dakika cinsinden fark
    const abs = Math.abs(diffMin);

    if (diffMin > 0) return `Gecikti ${minToHM(abs)}`;
    if (diffMin < 0) return `Erken ${minToHM(abs)}`;
    return "Zamanında";
};

/**
 * ISO tarih/saat damgasını GG.AA.YYYY SS:DD formatına dönüştürür.
 * @param {string | null} iso - ISO 8601 tarih/saat damgası.
 * @returns {string} Formatlanmış tarih metni veya "-".
 */
const fmt = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    // Tarih formatı: GG.AA.YYYY SS:DD
    const datePart = `${String(d.getDate()).padStart(2, "0")}.${String(
        d.getMonth() + 1
    ).padStart(2, "0")}.${d.getFullYear()}`;
    const timePart = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${datePart} ${timePart}`;
};

/**
 * Dakika cinsinden süreyi saat ve dakika metnine dönüştürür.
 * @param {number} m - Toplam dakika.
 * @returns {string} Saat ve dakika metni (örn: "2 saat 15 dakika").
 */
const minToHM = (m) => {
    const mm = Math.max(0, Math.round(m || 0));
    const h = Math.floor(mm / 60);
    const r = mm % 60;
    
    const parts = [];
    if (h) parts.push(`${h} saat`);
    if (r || (!h && r === 0)) parts.push(`${r} dakika`);
    
    return parts.join(" ");
};

/**
 * Bugünün tarihini YYYY-MM-DD formatında döndürür.
 * @returns {string}
 */
const getTodayDateString = () => new Date().toISOString().slice(0, 10);

/**
 * Seçili gün için [start, end) ISO aralığı üretir.
 * Örn: "2025-12-09" -> start: 2025-12-09T00:00:00.000Z, end: 2025-12-10T00:00:00.000Z
 * @param {string} dateStr - YYYY-MM-DD formatında tarih.
 * @returns {{start: string, end: string}}
 */
const getDateRangeForDay = (dateStr) => {
    const start = new Date(`${dateStr}T00:00:00.000Z`); // UTC başlangıcı olarak ele al
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
        start: start.toISOString(),
        end: end.toISOString()
    };
};

/**
 * Ham veri nesnesinden (Aktif/Tamamlanan) filtreleme için kullanılacak tarih alanını bulur.
 * Bu, DataGrid'deki filtreleme mantığıyla uyumlu olmak için önemlidir.
 * @param {object} raw - Ham sefer verisi (r.raw).
 * @param {string} durum - "Aktif" veya "Tamamlandı".
 * @returns {string | null} Filtreleme için kullanılacak ISO tarih stringi.
 */
const getRelevantDateIso = (raw, durum) => {
    if (!raw) return null;
    if (durum === "Tamamlandı") {
        // Tamamlananlarda: ETA VARİŞ, yoksa SEFER TARİHİ
        return raw.eta_varis || raw.sefer_tarihi;
    } else {
        // Aktiflerde: ETA → ETA VARİŞ → SEFER TARİHİ
        return raw.eta || raw.eta_varis || raw.sefer_tarihi;
    }
};

/**
 * Bir ISO tarih/saat damgasını yerel saat dilimine göre YYYY-MM-DD formatına çevirir.
 * @param {string | null} iso - ISO 8601 tarih/saat damgası.
 * @returns {string | null} YYYY-MM-DD formatında tarih veya null.
 */
const getDateKey = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;

    // Yerel saati kullanmak yerine, orijinal kodun mantığına uygun olarak
    // (ki bu genelde ISO string'in tarih kısmını alır) bu şekilde bırakılmıştır.
    // Ancak daha doğru bir filtreleme için zaman dilimi dikkate alınabilir.
    // Şu an için sadece tarih kısmını alalım:
    return iso.slice(0, 10);
};


// =============================================================
// 🌐 VERİ ÇEKME FONKSİYONU
// =============================================================
async function fetchPerformanceData(selectedDate) {
    const { start, end } = getDateRangeForDay(selectedDate);
    console.log("DB TARİH ARALIĞI:", { start, end });
    const LIMIT = 5000; // Veri çekme limiti

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
        // Tarih filtresi burada DB tarafında uygulanır (eta_varis'e göre)
        const completedSelect =
            "id, sefer_no, sefer_tarihi, plaka, proje_adi, atama_yapan_kullanici, eta_varis, yukleme_noktasi, yukleme_ili, yukleme_ilcesi, teslim_noktasi, teslim_ili, teslim_ilcesi";

        const { data: completedHeaders, error: headersError } = await supabase
            .from("tamamlanan_seferler")
            .select(completedSelect)
            .gte("eta_varis", start)
            .lt("eta_varis", end)
            .limit(LIMIT);

        if (headersError)
            throw new Error("Tamamlanan Seferler Ana Tablo Hatası: " + headersError.message);
        console.log(
            "TAMAMLANAN SEFER ADET (DB filtresi sonrası):",
            completedHeaders?.length || 0
        );

        // ---------------- 3. TAMAMLANAN SEFERLER DETAYLARI -------------------
        // Buradaki detayların tamamı çekilir ve daha sonra eşleştirilir.
        const { data: completedDetails, error: detailsError } = await supabase
            .from("tamamlanan_detaylar")
            .select(
                "sefer_no, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis, nokta_sirasi"
            )
            .limit(20000);

        if (detailsError) throw new Error("Tamamlanan Seferler Detay Hatası: " + detailsError.message);

        // ------------------ 4. BİRLEŞTİRME VE NORMALİZASYON ----------------------
        const detailsMap = (completedDetails || []).reduce((acc, detail) => {
            const seferNo = detail.sefer_no;
            if (!acc[seferNo]) acc[seferNo] = [];
            acc[seferNo].push(detail);
            return acc;
        }, {});

        const rows = [];
        let tamamlananSayaci = 0;

        // Yardımcı fonksiyon: En düşük nokta sırasına sahip detayı bul
        const getFirstDetail = (detailsArray) => {
             return (detailsArray || [])
                .sort((a, b) => (a.nokta_sirasi ?? 0) - (b.nokta_sirasi ?? 0))[0] || {};
        }

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

            const details = detailsMap[s.sefer_no] || [];
            const det = getFirstDetail(details);
            
            // Orjinal kodun mantığı: Tamamlananlarda farkı hesaplamak için eta_varis ve teslim_varis kullanılır.
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
        throw error; // Hatanın bileşene iletilmesini sağlar
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

    // Veri Yükleme Fonksiyonu
    const loadData = React.useCallback(async (dateStr) => {
        setLoading(true);
        try {
            const res = await fetchPerformanceData(dateStr);
            setRows(res);
        } catch (error) {
            console.error("Veri yüklenirken hata oluştu:", error);
            setRows([]); // Hata durumunda tabloyu temizle
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData(selectedDate);
    }, [loadData, selectedDate]); // Başlangıçta ve selectedDate değiştiğinde yükle

    // -------------------------------------------------------------
    // FİLTRELER
    // -------------------------------------------------------------
    const filtered = React.useMemo(() => {
        console.log(`Filtreleme Başladı: Tarih=${selectedDate}, Sadece Gecikenler=${onlyLate}`);

        return rows.filter((r) => {
            const rawDateIso = getRelevantDateIso(r.raw, r.durum);
            const dateKey = getDateKey(rawDateIso);

            if (!dateKey) return false;

            // Tarih filtresi
            if (dateKey !== selectedDate) return false;

            // Sadece gecikenler filtresi
            if (onlyLate && !String(r.fark || "").includes("Gecikti")) {
                return false;
            }

            return true;
        });
    }, [rows, selectedDate, onlyLate]);
    
    console.log("Filtre sonrası (filtered):", filtered.length);


    // -------------------------------------------------------------
    // KOLONLAR (Memoize edilmiş)
    // -------------------------------------------------------------
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

                return (
                    <Chip
                        label={value}
                        color={color}
                        size="small"
                    />
                );
            }
        }
    ], []);

    // -------------------------------------------------------------
    // EXCEL EXPORT
    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // EXCEL EXPORT (İstenen kolonlarla)
    // -------------------------------------------------------------
    const exportExcel = async () => {
        try {
            const book = new ExcelJS.Workbook();
            const sheet = book.addWorksheet("ETA Performans");

            // 1) Excel kolon şeması (istenen sırayla)
            sheet.columns = [
                { header: "Durum", key: "durum", width: 14 },
                { header: "Sefer No", key: "sefer_no", width: 14 },
                { header: "Plaka", key: "plaka", width: 12 },
                { header: "Sefer Tarihi", key: "tarih", width: 18 },

                { header: "Yükleme Noktası", key: "yukleme", width: 40 },
                { header: "Teslim Noktası", key: "teslim", width: 40 },

                { header: "Yükleme Çıkış Tarihi", key: "yukleme_cikis", width: 20 },
                { header: "ETA", key: "eta", width: 18 },
                { header: "Teslim Varış", key: "teslim_varis", width: 18 },
                { header: "Fark", key: "fark", width: 22 },

                { header: "Açıklama", key: "aciklama", width: 35 },
            ];

            // 2) Satırlar (filtered içinden istenen alanları seç + açıklama üret)
            const excelRows = filtered.map((r) => {
                let aciklama = "-";
                const farkStr = String(r.fark || "");

                if (farkStr.includes("Gecikti")) aciklama = "Teslimat gecikmiş";
                else if (farkStr.includes("Erken")) aciklama = "Teslimat erken yapılmış";
                else if (farkStr.includes("Zamanında")) aciklama = "Teslimat zamanında";
                else if (farkStr === "-" || farkStr.trim() === "") aciklama = "Fark hesaplanamadı";

                return {
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
                    aciklama,
                };
            });

            sheet.addRows(excelRows);

            // (İsteğe bağlı) başlık satırını kalın yap
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
                    {/* Tarih Seçimi */}
                    <TextField
                        type="date"
                        label="ETA Tarihi (Hedef Gün)"
                        value={selectedDate}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSelectedDate(val);
                            loadData(val); // Yeni tarih için DB'den yeniden çek
                        }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        size="small"
                        sx={{ minWidth: 200 }}
                    />

                    {/* Sadece Gecikenler Filtresi */}
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

                    {/* Yenile Butonu */}
                    <Button
                        variant="contained"
                        onClick={() => loadData(selectedDate)}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                        sx={{ minWidth: 120 }}
                    >
                        {loading ? "Yükleniyor..." : "Yenile"}
                    </Button>

                    {/* Excel Export Butonu */}
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
                        localeText={{
                            noRowsLabel: "Belirtilen tarihe ait sefer bulunamadı."
                        }}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 100 } },
                            sorting: { sortModel: [{ field: 'fark', sort: 'asc' }] }
                        }}
                        pageSizeOptions={[50, 100, 200]}
                        // Orjinal kodda minWidth: 2000 olduğu için autoHeight kullanmıyoruz
                        // columnVisibilityModel={{
                        //     // Kolonları gizleme/gösterme için örnek
                        //     yukleme_cikis: false,
                        //     teslim_cikis: false,
                        // }}
                    />
                )}
            </Paper>
        </Box>
    );
}
