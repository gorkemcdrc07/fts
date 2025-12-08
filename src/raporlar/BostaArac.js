// =============================================================
// BOSTA ARAÇ RAPORU – KAYIT_ZAMANI İLE ÇALIŞAN VERSİYON
// =============================================================

import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import dayjs from "dayjs";
import { supabase } from "../supabaseClient";

const today = () => dayjs().format("YYYY-MM-DD");

// Tekrarlayan tablo yapısını çıkarmak için yardımcı bileşen
const DetailTable = ({ title, data, timeField, plaka, isCompleted }) => (
    <Box mt={3}>
        <Typography variant="h6" sx={{ mb: 1, borderBottom: '1px solid #ddd' }}>
            {title} ({data.length})
        </Typography>
        {data.length === 0 ? (
            <Typography>Kayıt bulunamadı.</Typography>
        ) : (
            <TableContainer component={Paper} elevation={1}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#4a4a4a', '& th': { color: 'white' } }}>
                            <TableCell>Sefer No</TableCell>
                            {!isCompleted && <TableCell>Plaka</TableCell>}
                            <TableCell>Yükleme Noktası</TableCell>
                            <TableCell>Teslim Noktası</TableCell>
                            <TableCell>{timeField} Tarihi</TableCell>
                            <TableCell>Durum</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.map((row, index) => (
                            <TableRow
                                key={row.sefer_no + index}
                                hover
                                sx={!isCompleted ? {
                                    backgroundColor: 'rgba(255, 0, 0, 0.05)'
                                } : {}}
                            >
                                <TableCell>{row.sefer_no}</TableCell>
                                {!isCompleted && <TableCell>{row.plaka || plaka}</TableCell>}
                                <TableCell>{row.yukleme_noktasi || '-'}</TableCell>
                                <TableCell>{row.teslim_noktasi || '-'}</TableCell>
                                <TableCell>
                                    {row[timeField] ? dayjs(row[timeField]).format("DD.MM.YYYY HH:mm") : '-'}
                                </TableCell>
                                <TableCell>{row.arac_statu || row.reel_durum || '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        )}
    </Box>
);


export default function BostaArac() {
    const [selectedDate, setSelectedDate] = useState(today());
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const [openDetail, setOpenDetail] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [popupData, setPopupData] = useState({
        plaka: "",
        tamamlanan: [],
        aktif: [],
    });

    // Filtre sütunu, hata vermediği teyit edilen "kayit_zamani" olarak ayarlandı.
    const COMPLETED_TIME_COLUMN = "kayit_zamani";
    const ACTIVE_TIME_COLUMN = "sefer_tarihi";

    // =============================================================
    // ANA TABLOYU YÜKLE
    // =============================================================
    const loadData = async () => {
        setLoading(true);
        setRows([]);

        const start = `${selectedDate}T00:00:00`;
        const end = `${selectedDate}T23:59:59`;

        // 1) O gün tamamlanan seferler (kayit_zamani ile filtrelenir)
        const { data: tamamlanan, error: tErr } = await supabase
            .from("tamamlanan_seferler")
            .select("*")
            .gte(COMPLETED_TIME_COLUMN, start)
            .lte(COMPLETED_TIME_COLUMN, end);

        if (tErr) {
            console.error("Tamamlanan sefer hata:", tErr);
            alert(`Kritik Hata: ${tErr.message}. Supabase Hata Kodu: ${tErr.code}. Lütfen "${COMPLETED_TIME_COLUMN}" sütununun gerçekten var, TIMESTAMP türünde ve RLS ayarlarının doğru olduğundan emin olun.`);
            setLoading(false);
            return;
        }

        if (!tamamlanan?.length) {
            setRows([]);
            setLoading(false);
            return;
        }

        const plakalar = Array.from(new Set(
            tamamlanan.map((t) => t.plaka).filter(Boolean)
        ));

        // 2) Aktif sefer var mı? (sadece plaka kontrolü)
        const { data: aktifSeferler } = await supabase
            .from("seferler")
            .select("plaka")
            .in("plaka", plakalar)
            .not("arac_statu", "eq", "TAMAMLANDI");


        const latestCompletions = tamamlanan.reduce((acc, current) => {
            // En son kaydı bulmak için COMPLETED_TIME_COLUMN kullanılır
            if (!acc[current.plaka] || dayjs(current[COMPLETED_TIME_COLUMN]).isAfter(dayjs(acc[current.plaka][COMPLETED_TIME_COLUMN]))) {
                acc[current.plaka] = current;
            }
            return acc;
        }, {});


        const final = Object.values(latestCompletions).map((t, index) => {
            const aktifMi = aktifSeferler?.some((a) => a.plaka === t.plaka);

            return {
                id: t.sefer_no + t.plaka + index,
                plaka: t.plaka,
                sefer_no: t.sefer_no,
                // Ana tablo için gösterilecek tarih
                teslim_tarihi: t[COMPLETED_TIME_COLUMN]
                    ? dayjs(t[COMPLETED_TIME_COLUMN]).format("DD.MM.YYYY HH:mm")
                    : "-",
                aktif: aktifMi ? "EVET" : "HAYIR",
            };
        });

        setRows(final);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // =============================================================
    // PLAKAYA TIKLANINCA DETAY YÜKLE
    // =============================================================
    const loadPlakaDetails = async (plaka) => {
        setDetailLoading(true);
        setOpenDetail(true);

        setPopupData({ plaka, tamamlanan: [], aktif: [] });

        const start = `${selectedDate}T00:00:00`;
        const end = `${selectedDate}T23:59:59`;

        // 1. TAMAMLANAN SEFERLER (kayit_zamani'na göre filtre)
        const { data: tamamlanan } = await supabase
            .from("tamamlanan_seferler")
            .select("*")
            .eq("plaka", plaka)
            .gte(COMPLETED_TIME_COLUMN, start)
            .lte(COMPLETED_TIME_COLUMN, end);

        // 2. AKTİF SEFERLER (Çoklu tarih filtresi + BOS seferleri hariç tutma)
        let query = supabase
            .from("seferler")
            .select("*")
            .eq("plaka", plaka)
            .not("arac_statu", "eq", "TAMAMLANDI")
            .not("sefer_no", "ilike", "BOS%")
            .or(`and(yukleme_varis.gte.${start},yukleme_varis.lte.${end}),and(yukleme_cikis.gte.${start},yukleme_cikis.lte.${end}),and(sefer_tarihi.gte.${start},sefer_tarihi.lte.${end})`);

        const { data: aktif, error: aktifErr } = await query;

        if (aktifErr) {
            console.error("Aktif sefer OR sorgu hatası:", aktifErr);
            alert("Aktif seferler sorgusunda hata oluştu. Veritabanı sütun adlarını kontrol edin.");
        }

        setPopupData({
            plaka,
            tamamlanan: tamamlanan || [],
            aktif: aktif || [],
        });

        setDetailLoading(false);
    };

    // =============================================================
    // TABLO KOLONLARI
    // =============================================================
    const columns = [
        {
            field: "plaka",
            headerName: "Plaka",
            flex: 1,
            renderCell: (p) => (
                <Button variant="text" onClick={() => loadPlakaDetails(p.value)}>
                    {p.value}
                </Button>
            ),
        },
        { field: "sefer_no", headerName: "Son Sefer No", flex: 1 },
        {
            field: "teslim_tarihi",
            headerName: `Son Kayıt (${COMPLETED_TIME_COLUMN})`,
            flex: 1
        },
        {
            field: "aktif",
            headerName: "Aktif İş?",
            flex: 1,
            renderCell: (p) => (
                <strong style={{ color: p.value === "EVET" ? "#c0392b" : "#27ae60" }}>
                    {p.value}
                </strong>
            ),
        },
    ];

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* TARİH FİLTRESİ */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5">🚚 Bosta Araç Analizi</Typography>

                <Box display="flex" gap={2} mt={2}>
                    <TextField
                        label="Tarih"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />

                    <Button variant="contained" onClick={loadData} disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : "Yenile"}
                    </Button>
                </Box>
            </Paper>

            <Box mb={2}>
                <Typography variant="subtitle1" color="textSecondary">
                    **Filtreleme Bilgisi:** Tamamlanan Seferler, hatalardan kaçınmak için **{COMPLETED_TIME_COLUMN}**'a göre filtrelenmiştir. Aktif seferler **(yukleme\_varis VEYA yukleme\_cikis VEYA sefer\_tarihi)** tarihe göre filtrelenir ve BOS seferleri hariç tutulur.
                </Typography>
                <Typography variant="body2" color="error">
                    **Not:** `teslim_cikis` sütunu, büyük olasılıkla `TEXT` türünde olduğu veya RLS kısıtlaması nedeniyle kullanılamamaktadır. Veritabanı yöneticinizle görüşerek bu sütunun türünü **TIMESTAMP** olarak değiştirmeyi düşünebilirsiniz.
                </Typography>
            </Box>

            {/* ANA TABLO */}
            <Paper sx={{ height: 550 }}>
                {loading ? (
                    <Box height="100%" display="flex" justifyContent="center" alignItems="center">
                        <CircularProgress />
                    </Box>
                ) : (
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        disableRowSelectionOnClick
                        pageSizeOptions={[10, 25, 50]}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 10 } },
                        }}
                        localeText={{ noRowsLabel: "Belirtilen tarihte tamamlanan sefer bulunmamaktadır." }}
                    />
                )}
            </Paper>

            {/* DETAY POPUP */}
            <Dialog open={openDetail} onClose={() => setOpenDetail(false)} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ backgroundColor: '#2c3e50', color: 'white' }}>
                    {popupData.plaka} – Sefer Detayları
                </DialogTitle>
                <DialogContent dividers>
                    {detailLoading ? (
                        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
                    ) : (
                        <Box>
                            <DetailTable
                                title={`Tamamlanan Seferler (${COMPLETED_TIME_COLUMN} Tarihine Göre)`}
                                data={popupData.tamamlanan}
                                timeField={COMPLETED_TIME_COLUMN}
                                plaka={popupData.plaka}
                                isCompleted={true}
                            />

                            <DetailTable
                                title={`Aktif Seferler (Çoklu Zaman Filtresi: ${ACTIVE_TIME_COLUMN} gösterilir)`}
                                data={popupData.aktif}
                                timeField={ACTIVE_TIME_COLUMN}
                                plaka={popupData.plaka}
                                isCompleted={false}
                            />
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Container>
    );
}
