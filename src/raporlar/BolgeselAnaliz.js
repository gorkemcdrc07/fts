// src/raporlar/BolgeselAnaliz.js
import React, { useCallback, useMemo, useState } from "react";
import {
    Box,
    Card,
    CardContent,
    CardHeader,
    Stack,
    Button,
    Typography,
    Divider,
    Snackbar,
    Alert,
    Chip,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Avatar,
    Grid,
    Paper,
    LinearProgress,
    Collapse,
    IconButton,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import ExcelJS from "exceljs";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import NumbersIcon from "@mui/icons-material/Numbers";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { DataGrid } from "@mui/x-data-grid";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { supabase } from "../supabaseClient";

// helpers
const fmt = (d) => (d ? dayjs(d).format("YYYY-MM-DD") : "");
const toPgTs = (d) => (d ? dayjs(d).format("YYYY-MM-DD HH:mm:ss") : "");
const getUyumRengi = (oran) => {
    if (oran >= 95) return "success";
    if (oran > 80) return "warning";
    return "error";
};

// ----------------------------------------------------------------------
// Mevcut Sezon Bilgisi
// ----------------------------------------------------------------------
const getMevcutSezonInfo = () => {
    const currentMonth = dayjs().month();
    const kisAylari = [8, 9, 10, 11, 0, 1, 2];
    if (kisAylari.includes(currentMonth)) {
        return { season: "kış", title: "KIŞ SEZONU ANALİZİ", icon: <AcUnitIcon />, color: "info" };
    }
    return { season: "yaz", title: "YAZ SEZONU ANALİZİ", icon: <WbSunnyIcon />, color: "warning" };
};

// ----------------------------------------------------------------------
// SABİT BÖLGE HEDEFLERİ
// ----------------------------------------------------------------------
const KIS_SEZONU_HEDEFLER = [
    { bolge: "EGE", beklenen: 6 },
    { bolge: "ÇUKUROVA+DOĞU", beklenen: 7 },
    { bolge: "İÇ ANADOLU", beklenen: 2 },
    { bolge: "TRAKYA+AVRUPA", beklenen: 6 },
    { bolge: "GEBZE+DERİNCE", beklenen: 10 },
];
const YAZ_SEZONU_HEDEFLER = [
    { bolge: "EGE", beklenen: 9 },
    { bolge: "ÇUKUROVA+DOĞU", beklenen: 8 },
    { bolge: "İÇ ANADOLU", beklenen: 2 },
    { bolge: "TRAKYA+AVRUPA", beklenen: 8 },
    { bolge: "GEBZE+DERİNCE", beklenen: 13 },
];

// ----------------------------------------------------------------------
// BİLEŞEN: KpiKarti
// ----------------------------------------------------------------------
const KpiKarti = ({ title, value, icon, color = "primary.main" }) => (
    <Paper
        elevation={4}
        sx={{
            p: 2.5,
            borderRadius: 4,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            height: "100%",
            bgcolor: "background.paper",
        }}
    >
        <Avatar sx={{ bgcolor: color, width: 48, height: 48, mr: 2 }}>{icon}</Avatar>
        <Box>
            <Typography variant="body2" color="text.secondary" noWrap>
                {title}
            </Typography>
            <Typography variant="h5" fontWeight={700} color="text.primary" noWrap>
                {value}
            </Typography>
        </Box>
    </Paper>
);

// ----------------------------------------------------------------------
// BİLEŞEN: GenelUyumKarti
// ----------------------------------------------------------------------
const GenelUyumKarti = ({ title, subheader, value }) => {
    const renk = getUyumRengi(value);
    return (
        <Card elevation={4} sx={{ borderRadius: 4, height: "100%", p: 1, bgcolor: "background.paper" }}>
            <CardHeader
                title={
                    <Typography variant="h6" fontWeight={700}>
                        {title}
                    </Typography>
                }
                subheader={subheader}
                sx={{ pb: 0 }}
            />
            <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "center", pt: 2 }}>
                <Box sx={{ position: "relative", display: "inline-flex" }}>
                    <CircularProgress
                        variant="determinate"
                        value={100}
                        size={120}
                        thickness={2}
                        sx={{ color: "action.disabledBackground" }}
                    />
                    <CircularProgress
                        variant="determinate"
                        value={value}
                        size={120}
                        thickness={4}
                        color={renk}
                        sx={{
                            position: "absolute",
                            left: 0,
                            ["& .MuiCircularProgress-circle"]: { strokeLinecap: "round" },
                        }}
                    />
                    <Box
                        sx={{
                            top: 0,
                            left: 0,
                            bottom: 0,
                            right: 0,
                            position: "absolute",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "column",
                        }}
                    >
                        <Typography variant="h4" fontWeight={800} color={`${renk}.main`}>
                            {value.toFixed(1)}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Genel Uyum
                        </Typography>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

// ----------------------------------------------------------------------
// YENİ BİLEŞEN: BolgeDetayRow (Genişletilebilir satır)
// ----------------------------------------------------------------------
function BolgeDetayRow(props) {
    const { row, regionTrips, allColumns, gunSayisi } = props;
    const [open, setOpen] = useState(false);

    const gs = Number.isFinite(gunSayisi) && gunSayisi > 0 ? gunSayisi : 1;
    const beklenenDonem = row.beklenen * gs;
    const farkToplam = row.planlanan_toplam - beklenenDonem;
    const uyumOrani = row.uyum_orani || 0;
    const renk = getUyumRengi(uyumOrani);

    return (
        <React.Fragment>
            {/* Ana Veri Satırı */}
            <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
                <TableCell sx={{ width: "50px", py: 0.5, pl: 1 }}>
                    <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
                <TableCell sx={{ pl: 1 }}>
                    <Typography variant="body1" fontWeight={600}>
                        {row.bolge}
                    </Typography>
                </TableCell>
                <TableCell align="right">
                    <Typography variant="body1" color="text.secondary">
                        {row.beklenen}
                    </Typography>
                </TableCell>
                <TableCell align="right">
                    <Typography variant="body1" fontWeight={600}>
                        {row.planlanan_toplam}
                    </Typography>
                </TableCell>
                <TableCell align="right">
                    <Typography
                        variant="body1"
                        fontWeight={700}
                        color={farkToplam >= 0 ? "success.main" : "error.main"}
                    >
                        {farkToplam > 0 ? `+${farkToplam.toFixed(0)}` : farkToplam.toFixed(0)}
                    </Typography>
                </TableCell>
                <TableCell align="left" sx={{ minWidth: 200, pl: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={2} justifyContent="flex-start">
                        <Box sx={{ width: "60%" }}>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(uyumOrani, 100)}
                                color={renk}
                                sx={{ height: 8, borderRadius: 4, bgcolor: "action.disabledBackground" }}
                            />
                        </Box>
                        <Chip
                            label={`${uyumOrani.toFixed(1)}%`}
                            color={renk}
                            variant="filled"
                            size="small"
                            sx={{ fontWeight: 600, minWidth: "65px" }}
                        />
                    </Stack>
                </TableCell>
            </TableRow>

            {/* Genişletilmiş Detay Satırı (DataGrid içerir) */}
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1, p: 2, bgcolor: "action.hover", borderRadius: 2 }}>
                            <Typography variant="h6" gutterBottom component="div" sx={{ mb: 2 }}>
                                {row.bolge} Bölgesi - Detaylı Seferler ({regionTrips.length} Adet)
                            </Typography>
                            <Box sx={{ height: 400, width: "100%" }}>
                                <DataGrid
                                    rows={regionTrips}
                                    columns={allColumns}
                                    getRowId={(r) => r.id}
                                    disableRowSelectionOnClick
                                    density="compact"
                                    pageSizeOptions={[10, 25, 50]}
                                    initialState={{
                                        pagination: { paginationModel: { pageSize: 10 } },
                                    }}
                                    localeText={{
                                        noRowsLabel: "Bu bölge için sefer bulunamadı",
                                        MuiTablePagination: { labelRowsPerPage: "Satır:" },
                                    }}
                                    sx={{ bgcolor: "background.paper" }}
                                />
                            </Box>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </React.Fragment>
    );
}

// ----------------------------------------------------------------------
// BİLEŞEN: BolgeDetayTablosu
// ----------------------------------------------------------------------
const BolgeDetayTablosu = ({
    title,
    subheader,
    icon,
    data,
    color = "primary",
    gunSayisi,
    allColumns,
    groupedTrips,
}) => {
    const list = Array.isArray(data) ? data : [];

    return (
        <Card elevation={4} sx={{ borderRadius: 4, height: "100%", bgcolor: "background.paper" }}>
            <CardHeader
                avatar={<Avatar sx={{ bgcolor: `${color}.main` }}>{icon}</Avatar>}
                title={
                    <Typography variant="h6" fontWeight={700}>
                        {title}
                    </Typography>
                }
                subheader={subheader}
                sx={{ pb: 1 }}
            />
            <Divider />
            <TableContainer>
                <Table aria-label={`${title} analiz tablosu`}>
                    <TableHead>
                        <TableRow
                            sx={{
                                "& .MuiTableCell-root": {
                                    fontWeight: "bold",
                                    bgcolor: "action.hover",
                                    color: "text.primary",
                                    textTransform: "uppercase",
                                    fontSize: "0.8rem",
                                    py: 1.5,
                                    borderBottom: "1px solid",
                                    borderColor: "divider",
                                },
                            }}
                        >
                            <TableCell sx={{ width: "50px", pl: 1 }} />
                            <TableCell sx={{ pl: 1 }}>Bölge</TableCell>
                            <TableCell align="right">İstenen (Günlük)</TableCell>
                            <TableCell align="right">Gerçekleşen (Toplam)</TableCell>
                            <TableCell align="right">Fark (Toplam)</TableCell>
                            <TableCell align="left" sx={{ minWidth: 200, pl: 3 }}>
                                Uyum Oranı (Dönem)
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {list.map((row) => (
                            <BolgeDetayRow
                                key={row.bolge}
                                row={row}
                                regionTrips={groupedTrips[row.bolge] || []}
                                allColumns={allColumns}
                                gunSayisi={gunSayisi}
                            />
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Card>
    );
};

// ----------------------------------------------------------------------
// ANA BİLEŞEN: BolgeselAnaliz
// ----------------------------------------------------------------------
export default function BolgeselAnaliz() {
    dayjs.locale("tr");

    const mevcutSezon = useMemo(() => getMevcutSezonInfo(), []);

    const [rows, setRows] = useState([]);
    const [analizData, setAnalizData] = useState(null);
    const [kpiData, setKpiData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "info" });
    const [selectedDate, setSelectedDate] = useState(dayjs());

    // DataGrid Sütunları
    const columns = useMemo(
        () => [
            { field: "id", headerName: "ID", width: 100 },
            { field: "sefer_no", headerName: "Sefer No", width: 120 },
            { field: "plaka", headerName: "Plaka", width: 110 },
            { field: "treyler", headerName: "Treyler", width: 110 },
            { field: "surucu_ad_soyad", headerName: "Sürücü", flex: 1, minWidth: 150 },
            { field: "musteri_adi", headerName: "Müşteri", flex: 1, minWidth: 150 },
            { field: "yukleme_noktasi", headerName: "Yükleme Noktası", flex: 1, minWidth: 160 },
            { field: "teslim_noktasi", headerName: "Teslim Noktası", flex: 1, minWidth: 160 },
            { field: "yukleme_ili", headerName: "Yükleme İl", flex: 0.5, minWidth: 110 },
            { field: "yukleme_ilcesi", headerName: "Yükleme İlçe", flex: 0.5, minWidth: 110 },
            { field: "teslim_ili", headerName: "Teslim İl", flex: 0.5, minWidth: 110 },
            { field: "teslim_ilcesi", headerName: "Teslim İlçe", flex: 0.5, minWidth: 110 },
            {
                field: "sefer_tarihi",
                headerName: "Sefer Tarihi",
                width: 170,
                valueFormatter: (p) =>
                    p && p.value ? dayjs(p.value).format("YYYY-MM-DD HH:mm") : "",
            },
            { field: "arac_statu", headerName: "Durum", width: 120 },
            { field: "kaynak", headerName: "Kaynak", width: 140 },
        ],
        []
    );

    // İl → Bölge map'i
    const ilToBolgeMap = {
        ADANA: "Doğu Bölgesi",
        ADIYAMAN: "Doğu Bölgesi",
        AFYON: "İç Anadolu Bölgesi",
        AĞRI: "Doğu Bölgesi",
        AMASYA: "Karadeniz Bölgesi",
        ANKARA: "İç Anadolu Bölgesi",
        ANTALYA: "Ege Bölgesi",
        ARTVİN: "Karadeniz Bölgesi",
        AYDIN: "Ege Bölgesi",
        BALIKESİR: "Ege Bölgesi",
        BARTIN: "Karadeniz Bölgesi",
        BATMAN: "Doğu Bölgesi",
        BAYBURT: "Karadeniz Bölgesi",
        BİLECİK: "İç Anadolu Bölgesi",
        BİNGÖL: "Doğu Bölgesi",
        BİTLİS: "Doğu Bölgesi",
        BOLU: "Karadeniz Bölgesi",
        BURDUR: "Ege Bölgesi",
        BURSA: "Ege Bölgesi",
        ÇANAKKALE: "Trakya Bölgesi",
        ÇANKIRI: "İç Anadolu Bölgesi",
        ÇORUM: "İç Anadolu Bölgesi",
        DENİZLİ: "Ege Bölgesi",
        DİYARBAKIR: "Doğu Bölgesi",
        DÜZCE: "Karadeniz Bölgesi",
        EDİRNE: "Trakya Bölgesi",
        ELAZIĞ: "Doğu Bölgesi",
        ERZİNCAN: "Doğu Bölgesi",
        ERZURUM: "Doğu Bölgesi",
        ESKİŞEHİR: "İç Anadolu Bölgesi",
        GAZİANTEP: "Doğu Bölgesi",
        GİRESUN: "Karadeniz Bölgesi",
        GÜMÜŞHANE: "Karadeniz Bölgesi",
        HAKKARİ: "Doğu Bölgesi",
        HATAY: "Doğu Bölgesi",
        ISPARTA: "Ege Bölgesi",
        MERSİN: "Doğu Bölgesi",
        İSTANBUL: "Marmara Bölgesi",
        İZMİR: "Ege Bölgesi",
        KAHRAMANMARAŞ: "Doğu Bölgesi",
        KARABÜK: "Karadeniz Bölgesi",
        KARAMAN: "İç Anadolu Bölgesi",
        KARS: "Doğu Bölgesi",
        KASTAMONU: "Karadeniz Bölgesi",
        KAYSERİ: "İç Anadolu Bölgesi",
        KİLİS: "Doğu Bölgesi",
        KIRIKKALE: "İç Anadolu Bölgesi",
        KIRKLARELİ: "Trakya Bölgesi",
        KIRŞEHİR: "İç Anadolu Bölgesi",
        KOCAELİ: "Kocaeli Bölgesi",
        KONYA: "İç Anadolu Bölgesi",
        KÜTAHYA: "İç Anadolu Bölgesi",
        MALATYA: "Doğu Bölgesi",
        MANİSA: "Ege Bölgesi",
        MARDİN: "Doğu Bölgesi",
        MUĞLA: "Ege Bölgesi",
        MUŞ: "Doğu Bölgesi",
        NEVŞEHİR: "İç Anadolu Bölgesi",
        NİĞDE: "İç Anadolu Bölgesi",
        ORDU: "Karadeniz Bölgesi",
        OSMANİYE: "Doğu Bölgesi",
        RİZE: "Karadeniz Bölgesi",
        SAKARYA: "Kocaeli Bölgesi",
        SAMSUN: "Karadeniz Bölgesi",
        SİİRT: "Doğu Bölgesi",
        SİNOP: "Karadeniz Bölgesi",
        SİVAS: "İç Anadolu Bölgesi",
        ŞANLIURFA: "Doğu Bölgesi",
        ŞIRNAK: "Doğu Bölgesi",
        TEKİRDAĞ: "Trakya Bölgesi",
        TOKAT: "Karadeniz Bölgesi",
        TRABZON: "Karadeniz Bölgesi",
        TUNCELİ: "Doğu Bölgesi",
        UŞAK: "Ege Bölgesi",
        VAN: "Doğu Bölgesi",
        YALOVA: "Ege Bölgesi",
        YOZGAT: "İç Anadolu Bölgesi",
        ZONGULDAK: "Karadeniz Bölgesi",
        AKSARAY: "İç Anadolu Bölgesi",
        ADALAR: "Kocaeli Bölgesi",
        ATAŞEHİR: "Kocaeli Bölgesi",
        BEYKOZ: "Kocaeli Bölgesi",
        ÖMERLİ: "Kocaeli Bölgesi",
        KADIKÖY: "Kocaeli Bölgesi",
        KARTAL: "Kocaeli Bölgesi",
        MALTEPE: "Kocaeli Bölgesi",
        PENDİK: "Kocaeli Bölgesi",
        SANCAKTEPE: "Kocaeli Bölgesi",
        SULTANBEYLİ: "Kocaeli Bölgesi",
        ŞİLE: "Kocaeli Bölgesi",
        TUZLA: "Kocaeli Bölgesi",
        ÜMRANİYE: "Kocaeli Bölgesi",
        ÜSKÜDAR: "Kocaeli Bölgesi",
        ÇEKMEKÖY: "Kocaeli Bölgesi",
        ARNAVUTKÖY: "Marmara Bölgesi",
        AVCILAR: "Marmara Bölgesi",
        BAĞCILAR: "Marmara Bölgesi",
        BAHÇELİEVLER: "Marmara Bölgesi",
        BAKIRKÖY: "Marmara Bölgesi",
        BAŞAKŞEHİR: "Marmara Bölgesi",
        BAYRAMPAŞA: "Marmara Bölgesi",
        BEŞİKTAŞ: "Marmara Bölgesi",
        BEYLİKDÜZÜ: "Marmara Bölgesi",
        BEYOĞLU: "Marmara Bölgesi",
        BÜYÜKÇEKMECE: "Marmara Bölgesi",
        ÇATALCA: "Marmara Bölgesi",
        ESENLER: "Marmara Bölgesi",
        ESENYURT: "Marmara Bölgesi",
        EYÜP: "Marmara Bölgesi",
        FATİH: "Marmara Bölgesi",
        GAZİOSMANPAŞA: "Marmara Bölgesi",
        GÜNGÖREN: "Marmara Bölgesi",
        KAĞITHANE: "Marmara Bölgesi",
        KÜÇÜKÇEKMECE: "Marmara Bölgesi",
        SARIYER: "Marmara Bölgesi",
        SİLİVRİ: "Marmara Bölgesi",
        SULTANGAZİ: "Marmara Bölgesi",
        ŞİŞLİ: "Marmara Bölgesi",
        ZEYTİNBURNU: "Marmara Bölgesi",
    };

    const getBolgeFromSefer = (sefer) => {
        const il = sefer.yukleme_ili
            ? String(sefer.yukleme_ili).split(";")[0].toLocaleUpperCase("tr").trim()
            : "";
        const ilce = sefer.yukleme_ilcesi
            ? String(sefer.yukleme_ilcesi).split(";")[0].toLocaleUpperCase("tr").trim()
            : "";
        if (ilce && ilToBolgeMap[ilce]) return ilToBolgeMap[ilce];
        if (il && ilToBolgeMap[il]) return ilToBolgeMap[il];
        return "Bilinmeyen";
    };

    // Analiz + sefer gruplama
    const calculateAnalysisAndGroupTrips = (fetchedData, selectedSeasonInfo, gunSayisi) => {
        const rawBolgeCounts = {};
        const rawGroupedTrips = {
            "Ege Bölgesi": [],
            "Doğu Bölgesi": [],
            "İç Anadolu Bölgesi": [],
            "Trakya Bölgesi": [],
            "Marmara Bölgesi": [],
            "Kocaeli Bölgesi": [],
            "Karadeniz Bölgesi": [],
            "Bilinmeyen": [],
        };

        for (const sefer of fetchedData) {
            const rawBolge = getBolgeFromSefer(sefer);

            rawBolgeCounts[rawBolge] = (rawBolgeCounts[rawBolge] || 0) + 1;

            if (rawGroupedTrips[rawBolge]) {
                rawGroupedTrips[rawBolge].push(sefer);
            } else {
                rawGroupedTrips["Bilinmeyen"].push(sefer);
            }
        }

        const planlananToplamSayilar = {
            EGE: rawBolgeCounts["Ege Bölgesi"] || 0,
            "ÇUKUROVA+DOĞU": rawBolgeCounts["Doğu Bölgesi"] || 0,
            "İÇ ANADOLU": rawBolgeCounts["İç Anadolu Bölgesi"] || 0,
            "TRAKYA+AVRUPA":
                (rawBolgeCounts["Trakya Bölgesi"] || 0) +
                (rawBolgeCounts["Marmara Bölgesi"] || 0),
            "GEBZE+DERİNCE": rawBolgeCounts["Kocaeli Bölgesi"] || 0,
        };

        const finalGroupedTrips = {
            EGE: rawGroupedTrips["Ege Bölgesi"] || [],
            "ÇUKUROVA+DOĞU": rawGroupedTrips["Doğu Bölgesi"] || [],
            "İÇ ANADOLU": rawGroupedTrips["İç Anadolu Bölgesi"] || [],
            "TRAKYA+AVRUPA": [
                ...(rawGroupedTrips["Trakya Bölgesi"] || []),
                ...(rawGroupedTrips["Marmara Bölgesi"] || []),
            ],
            "GEBZE+DERİNCE": rawGroupedTrips["Kocaeli Bölgesi"] || [],
        };

        const hedefSet =
            selectedSeasonInfo.season === "kış" ? KIS_SEZONU_HEDEFLER : YAZ_SEZONU_HEDEFLER;

        const analizSonucu = hedefSet.map((hedef) => {
            const bolgeAdi = hedef.bolge;
            const toplamPlanlananSefer = planlananToplamSayilar[bolgeAdi] || 0;
            const beklenenDonem = hedef.beklenen * (gunSayisi > 0 ? gunSayisi : 1);
            const uyumOraniHam =
                beklenenDonem > 0 ? (toplamPlanlananSefer / beklenenDonem) * 100 : 0;
            const uyumOrani = Math.min(uyumOraniHam, 100); // 100'ü geçmesin

            return {
                bolge: bolgeAdi,
                beklenen: hedef.beklenen,
                planlanan_toplam: toplamPlanlananSefer,
                uyum_orani: uyumOrani,
            };
        });

        return { analizSonucu, groupedTrips: finalGroupedTrips };
    };

    // Supabase veri çekme
    const fetchSupabaseData = useCallback(async (start, end) => {
        const startStr = toPgTs(dayjs(start).startOf("day"));
        const endStr = toPgTs(dayjs(end).endOf("day"));
        const selectQuery = "*, yukleme_ili, yukleme_ilcesi";
        const { data: seferler, error: err1 } = await supabase
            .from("seferler")
            .select(selectQuery)
            .gte("sefer_tarihi", startStr)
            .lte("sefer_tarihi", endStr);
        const { data: tamamlanan, error: err2 } = await supabase
            .from("tamamlanan_seferler")
            .select(selectQuery)
            .gte("sefer_tarihi", startStr)
            .lte("sefer_tarihi", endStr);
        if (err1 || err2) throw new Error(err1?.message || err2?.message || "Bilinmeyen Supabase hatası");
        return {
            seferler: (seferler || []).map((x) => ({ ...x, kaynak: "seferler" })),
            tamamlanan: (tamamlanan || []).map((x) => ({ ...x, kaynak: "tamamlanan_seferler" })),
        };
    }, []);

    // getData
    const getData = async () => {
        const start = selectedDate.startOf("day");
        const end = selectedDate.endOf("day");
        const gunSayisi = 1;

        setLoading(true);
        setAnalizData(null);
        setKpiData(null);
        setRows([]);
        try {
            const { seferler, tamamlanan } = await fetchSupabaseData(start, end);
            const all = [...seferler, ...tamamlanan]
                .filter(Boolean)
                .sort((a, b) => new Date(b.sefer_tarihi) - new Date(a.sefer_tarihi));
            setRows(all);

            const { analizSonucu, groupedTrips } = calculateAnalysisAndGroupTrips(
                all,
                mevcutSezon,
                gunSayisi
            );

            const toplamBeklenenDonem = analizSonucu.reduce(
                (acc, r) => acc + r.beklenen * gunSayisi,
                0
            );
            const toplamPlanlananDonem = analizSonucu.reduce(
                (acc, r) => acc + r.planlanan_toplam,
                0
            );
            let genelUyum =
                toplamBeklenenDonem > 0
                    ? (toplamPlanlananDonem / toplamBeklenenDonem) * 100
                    : 0;

            genelUyum = Math.min(genelUyum, 100); // max 100

            const analizWithFark = analizSonucu.map((r) => {
                const beklenenDonem = r.beklenen * (gunSayisi > 0 ? gunSayisi : 1);
                const mutlakFark = Math.abs(r.planlanan_toplam - beklenenDonem);
                return { ...r, mutlak_fark: mutlakFark };
            });

            const siraliAnalizYeni = [...analizWithFark].sort(
                (a, b) => a.mutlak_fark - b.mutlak_fark
            );

            const enBasarili = siraliAnalizYeni[0];
            const enZayif = siraliAnalizYeni[siraliAnalizYeni.length - 1];

            setKpiData({
                toplamSefer: all.length,
                genelUyum: genelUyum,
                enBasarili: enBasarili.bolge,
                enZayif: enZayif.bolge,
            });

            setAnalizData({
                gunSayisi,
                satirlar: analizSonucu,
                analizTarihi: selectedDate,
                groupedTrips: groupedTrips,
            });

            setSnack({
                open: true,
                msg: `${all.length} kayıt yüklendi. ${selectedDate.format(
                    "DD.MM.YYYY"
                )} tarihi için ${mevcutSezon.title} analizi yapıldı.`,
                severity: "success",
            });
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: `Veri çekilemedi: ${e.message}`, severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    // clearAll
    const clearAll = () => {
        setRows([]);
        setAnalizData(null);
        setKpiData(null);
        setSelectedDate(dayjs());
    };

    // Detay DataGrid için CSV Export
    const exportCsv = () => {
        const csvEscape = (val) => {
            if (val === null || val === undefined) return "";
            const s = String(val).replace(/"/g, '""');
            return `"${s}"`;
        };
        const headers = columns.map((c) => `"${c.field}"`).join(",");
        const body = rows
            .map((r) => columns.map((c) => csvEscape(r[c.field])).join(","))
            .join("\n");
        const csv = `${headers}\n${body}`;
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bolgesel_analiz_${fmt(selectedDate)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Bölgesel analiz (üst tablo) için gerçek Excel (.xlsx) export - exceljs ile
    const exportBolgeAnalizExcel = async () => {
        if (!analizData || !analizData.satirlar || !analizData.satirlar.length) return;

        const gunSayisi =
            analizData.gunSayisi && analizData.gunSayisi > 0 ? analizData.gunSayisi : 1;

        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("Bölgesel Analiz");

            sheet.columns = [
                { header: "Bölge", key: "bolge", width: 20 },
                { header: "İstenen (Günlük)", key: "istenen_gunluk", width: 18 },
                { header: "Gerçekleşen (Toplam)", key: "gerceklesen", width: 22 },
                { header: "Fark (Toplam)", key: "fark_toplam", width: 16 },
                { header: "Uyum Oranı (%)", key: "uyum_orani", width: 18 },
            ];

            analizData.satirlar.forEach((r) => {
                const beklenenDonem = r.beklenen * gunSayisi;
                const farkToplam = r.planlanan_toplam - beklenenDonem;

                sheet.addRow({
                    bolge: r.bolge,
                    istenen_gunluk: r.beklenen,
                    gerceklesen: r.planlanan_toplam,
                    beklenen_donem: beklenenDonem,
                    fark_toplam: farkToplam,
                    uyum_orani: Number(r.uyum_orani?.toFixed(2) ?? 0),
                });
            });

            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.alignment = { vertical: "middle", horizontal: "center" };
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFE5E5E5" },
                };
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bolgesel_analiz_ozet_${fmt(selectedDate)}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Excel export error:", err);
            setSnack({
                open: true,
                severity: "error",
                msg: "Excel dosyası oluşturulurken hata oluştu: " + err.message,
            });
        }
    };

    // -----------------------------------------------------------------
    // EKRAN YERLEŞİMİ (RENDER)
    // -----------------------------------------------------------------
    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="tr">
            <Stack spacing={3} sx={{ p: { xs: 1, md: 3 } }}>
                {/* KONTROL PANELİ */}
                <Card elevation={3} sx={{ borderRadius: 4, bgcolor: "background.paper" }}>
                    <CardHeader
                        title={<Typography variant="h6" fontWeight={700}>Bölgesel Analiz Raporu</Typography>}
                        subheader="Seçilen tarihe göre günlük analiz oluşturun"
                    />
                    <Divider />
                    <CardContent>
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            alignItems={{ xs: "stretch", md: "center" }}
                            justifyContent="space-between"
                        >
                            <DatePicker
                                label="Analiz Tarihi"
                                value={selectedDate}
                                onChange={(newValue) => setSelectedDate(newValue)}
                                format="DD.MM.YYYY"
                                slotProps={{ textField: { variant: "outlined", size: "small" } }}
                                sx={{ width: { xs: "100%", md: 240 } }}
                            />
                            <Stack
                                direction="row"
                                spacing={1.5}
                                sx={{ width: { xs: "100%", md: "auto" } }}
                            >
                                <Button
                                    variant="outlined"
                                    startIcon={<RestartAltIcon />}
                                    onClick={clearAll}
                                    disabled={loading}
                                    sx={{ flexGrow: { xs: 1, md: 0 } }}
                                >
                                    Temizle
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<SearchIcon />}
                                    onClick={getData}
                                    disabled={loading || !selectedDate}
                                    sx={{ minWidth: 180, flexGrow: { xs: 1, md: 0 } }}
                                >
                                    {loading ? (
                                        <CircularProgress size={24} color="inherit" />
                                    ) : (
                                        "Analiz Raporu Oluştur"
                                    )}
                                </Button>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>

                {/* YÜKLENİYOR... */}
                {loading && (
                    <Card
                        sx={{
                            p: 4,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            borderRadius: 3,
                            minHeight: 300,
                            justifyContent: "center",
                            bgcolor: "background.paper",
                        }}
                    >
                        <CircularProgress size={40} />
                        <Typography variant="h6" color="text.secondary">
                            Rapor Oluşturuluyor...
                        </Typography>
                    </Card>
                )}

                {/* BAŞLANGIÇ EKRANI */}
                {!loading && !analizData && (
                    <Card
                        sx={{
                            p: 4,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            borderRadius: 3,
                            minHeight: 300,
                            justifyContent: "center",
                            bgcolor: "background.default",
                            boxShadow: "none",
                            border: "2px dashed",
                            borderColor: "divider",
                        }}
                    >
                        <InfoOutlinedIcon sx={{ fontSize: 40, color: "text.disabled" }} />
                        <Typography variant="h6" color="text.secondary" textAlign="center">
                            Analiz sonuçlarını görmek için <br />
                            bir tarih seçip "Analiz Raporu Oluştur" butonuna basın.
                        </Typography>
                    </Card>
                )}

                {/* SONUÇ EKRANI */}
                {!loading && analizData && kpiData && (
                    <Stack spacing={3}>
                        {/* KPI Paneli */}
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={5}>
                                <GenelUyumKarti
                                    title="Analiz Raporu"
                                    subheader={`Genel Durum (${analizData.analizTarihi.format(
                                        "DD.MM.YYYY"
                                    )} / ${mevcutSezon.season} sezonu)`}
                                    value={kpiData.genelUyum}
                                />
                            </Grid>
                            <Grid item xs={12} md={7}>
                                <Stack
                                    spacing={3}
                                    height="100%"
                                    justifyContent="space-between"
                                >
                                    <KpiKarti
                                        title={`Toplam Sefer (${analizData.analizTarihi.format(
                                            "DD.MM.YYYY"
                                        )})`}
                                        value={kpiData.toplamSefer}
                                        icon={<NumbersIcon />}
                                        color="primary.main"
                                    />
                                    <Grid container spacing={3}>
                                        <Grid item xs={12} sm={6}>
                                            <KpiKarti
                                                title="En Başarılı Bölge"
                                                value={kpiData.enBasarili}
                                                icon={<TrendingUpIcon />}
                                                color="success.main"
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <KpiKarti
                                                title="Dikkat Gereken Bölge"
                                                value={kpiData.enZayif}
                                                icon={<TrendingDownIcon />}
                                                color="error.main"
                                            />
                                        </Grid>
                                    </Grid>
                                </Stack>
                            </Grid>
                        </Grid>

                        {/* Bölge Detay Tablosu + Excel Aktarım Butonu */}
                        <Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    mb: 1,
                                }}
                            >
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    onClick={exportBolgeAnalizExcel}
                                    disabled={!analizData?.satirlar?.length}
                                >
                                    Bölge Analizini Excel&apos;e Aktar
                                </Button>
                            </Box>

                            <BolgeDetayTablosu
                                title={mevcutSezon.title}
                                subheader={`Bölge bazlı ${analizData.analizTarihi.format(
                                    "DD.MM.YYYY"
                                )} hedef ve gerçekleşenleri (Detay için [+]'ya basın)`}
                                icon={mevcutSezon.icon}
                                data={analizData.satirlar}
                                color={mevcutSezon.color}
                                gunSayisi={analizData.gunSayisi}
                                allColumns={columns}
                                groupedTrips={analizData.groupedTrips || {}}
                            />
                        </Box>

                        {/* Tüm Seferler DataGrid (Akordiyon) */}
                        <Accordion
                            elevation={3}
                            sx={{
                                borderRadius: 3,
                                "&:before": { display: "none" },
                                bgcolor: "background.paper",
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{
                                    borderRadius: 3,
                                    borderBottomLeftRadius: 0,
                                    borderBottomRightRadius: 0,
                                    bgcolor: "action.hover",
                                    "&.Mui-expanded": {
                                        borderBottom: "1px solid",
                                        borderColor: "divider",
                                    },
                                }}
                            >
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <AssessmentIcon color="action" />
                                    <Typography fontWeight={600}>
                                        Tüm Sefer Detaylarını Göster/Gizle (Toplam)
                                    </Typography>
                                    <Chip
                                        size="small"
                                        label={`${rows.length} Kayıt Bulundu`}
                                        color="primary"
                                        variant="outlined"
                                    />
                                </Stack>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 2 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    onClick={exportCsv}
                                    disabled={!rows.length}
                                    sx={{ mb: 2 }}
                                >
                                    Detaylı CSV İndir
                                </Button>
                                <Box sx={{ height: 500, width: "100%" }}>
                                    <DataGrid
                                        rows={rows}
                                        columns={columns}
                                        getRowId={(r) => r.id}
                                        disableRowSelectionOnClick
                                        density="compact"
                                        pageSizeOptions={[25, 50, 100]}
                                        initialState={{
                                            pagination: {
                                                paginationModel: { pageSize: 25 },
                                            },
                                        }}
                                        localeText={{
                                            noRowsLabel: "Kayıt bulunamadı",
                                            MuiTablePagination: {
                                                labelRowsPerPage: "Sayfa başına satır:",
                                            },
                                        }}
                                    />
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    </Stack>
                )}

                {/* Snackbar */}
                <Snackbar
                    open={snack.open}
                    autoHideDuration={4000}
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    anchorOrigin={{ vertical: "top", horizontal: "center" }}
                >
                    <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: 2 }}>
                        {snack.msg}
                    </Alert>
                </Snackbar>
            </Stack>
        </LocalizationProvider>
    );
}

// Supabase RPC Yedek Fonksiyonu
/*
const getData_RPC_Yedek = async () => { ... };
*/
