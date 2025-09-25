// src/panel/SeferDetayPanel.jsx
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Stack,
    Typography,
    IconButton,
    CircularProgress,
    Divider,
    Button,
    Chip,
    Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { DataGrid } from "@mui/x-data-grid";

/* Recharts */
import {
    ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell,
} from "recharts";

/* TR upper helper */
const toUpperTr = (s = "") =>
    String(s)
        .replace(/i/g, "İ")
        .replace(/ı/g, "I")
        .toUpperCase();

/* tarih format helper */
const formatDateTR = (val) => {
    if (!val) return "";
    try {
        const d = new Date(val);
        if (isNaN(d)) return String(val);
        return d.toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return String(val);
    }
};

/* İL -> BÖLGE haritası (kısaltılmadı; liste sende zaten var) */
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
    AKSARAY: "İç Anadolu Bölgesi",
};

/* Son nokta & Bölge normalizasyonu */
const normalizeSonNoktaAndRegion = (raw) => {
    const u = toUpperTr(raw || "");
    let son_nokta = raw || "";

    if (u === "ANTEP") son_nokta = "GAZİANTEP";
    if (u === "URFA") son_nokta = "ŞANLIURFA";
    if (u === "MARAŞ") son_nokta = "KAHRAMANMARAŞ";

    let bolge = "";
    if (u.includes("İSTANBUL AVRUPA")) bolge = "Marmara Bölgesi";
    else if (u.includes("İSTANBUL ANADOLU")) bolge = "Kocaeli Bölgesi";
    else if (u === "TRAKYA") bolge = "Trakya Bölgesi";
    else bolge = ilToBolgeMap[toUpperTr(son_nokta)] || "";

    return { son_nokta, bolge };
};

/* ; ile ayrılan listeden SON öğeyi al */
const lastAfterSemicolon = (s) =>
    String(s || "")
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean)
        .pop() || "";

/* Bu ay aralığı */
const getThisMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
};

/* Grup sayacı */
const countBy = (arr, keyFn) => {
    const m = new Map();
    for (const it of arr) {
        const k = keyFn(it);
        if (!k) continue;
        m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
};

/* Recharts renkleri */
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#8dd1e1", "#a4de6c", "#d0ed57", "#8884d8"];

export default function SeferDetayPanel({ open, onClose, plaka }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    // Dashboard
    const [stats, setStats] = useState({ total: 0, topProjects: [], topRegions: [], label: "" });

    // “Tüm seferleri gör” toggle
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        if (!plaka) return;
        let alive = true;
        (async () => {
            setLoading(true);

            const selectFields =
                "sefer_tarihi,sefer_no,plaka,proje_adi,yukleme_noktasi,yukleme_ili,yukleme_ilcesi,teslim_noktasi,teslim_ili,teslim_ilcesi,eta";

            // GRID verisi
            const seferlerQ = supabase
                .from("seferler")
                .select(selectFields)
                .or(`plaka.eq.${plaka},plaka.ilike.${plaka}-%`)
                .not("sefer_no", "ilike", "BOS%")
                .order("sefer_tarihi", { ascending: false });

            let tamamlananQ = supabase
                .from("tamamlanan_seferler")
                .select(selectFields)
                .eq("plaka", plaka)
                .order("sefer_tarihi", { ascending: false });

            if (!showAll) tamamlananQ = tamamlananQ.limit(4);

            const [a, b] = await Promise.all([seferlerQ, tamamlananQ]);
            if (!alive) return;

            const gridErr = a.error || b.error;
            if (gridErr) {
                console.error(gridErr);
                setRows([]);
            } else {
                const dataSeferler = a.data || [];
                const dataTamamlanan = b.data || [];
                const combinedGrid = [...dataSeferler, ...dataTamamlanan].map((r, i) => {
                    const lastIl = lastAfterSemicolon(r.teslim_ili);
                    const { bolge } = normalizeSonNoktaAndRegion(lastIl);
                    return { ...r, _id: i, bolge };
                });
                setRows(combinedGrid);
            }

            /* DASHBOARD HESAPLAMA
               - showAll = true  => Tablo görünümüne göre (tüm seferler) hesapla
               - showAll = false => Bu AY için sunucudan gerçek toplam + dağılımlar
            */
            if (showAll) {
                // 1) Tüm seferler görünümü: doğrudan rows (yeni combinedGrid) üzerinden
                const all = (a.data || [])
                    .concat(b.data || [])
                    .map((r) => {
                        const lastIl = lastAfterSemicolon(r.teslim_ili);
                        const { bolge } = normalizeSonNoktaAndRegion(lastIl);
                        return { ...r, bolge };
                    });

                const total = all.length;
                const topProjects = countBy(all, (r) => r.proje_adi).slice(0, 10);
                const topRegions = countBy(all, (r) => r.bolge).slice(0, 10);

                setStats({
                    total,
                    topProjects,
                    topRegions,
                    label: "Tüm seferler (tablodaki görünüm)",
                });
            } else {
                // 2) Bu AY için gerçek toplamlar ve dağılımlar (COUNT + tam ay verisi)
                const { start, end } = getThisMonthRange();
                const startISO = start.toISOString();
                const endISO = end.toISOString();
                const monthLabel = start.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

                const [countA, countB] = await Promise.all([
                    supabase
                        .from("seferler")
                        .select("sefer_no", { count: "exact", head: true })
                        .or(`plaka.eq.${plaka},plaka.ilike.${plaka}-%`)
                        .gte("sefer_tarihi", startISO)
                        .lt("sefer_tarihi", endISO),
                    supabase
                        .from("tamamlanan_seferler")
                        .select("sefer_no", { count: "exact", head: true })
                        .eq("plaka", plaka)
                        .gte("sefer_tarihi", startISO)
                        .lt("sefer_tarihi", endISO),
                ]);

                const totalThisMonth = (countA.count || 0) + (countB.count || 0);

                const [monthA, monthB] = await Promise.all([
                    supabase
                        .from("seferler")
                        .select("proje_adi,teslim_ili,sefer_tarihi")
                        .or(`plaka.eq.${plaka},plaka.ilike.${plaka}-%`)
                        .gte("sefer_tarihi", startISO)
                        .lt("sefer_tarihi", endISO),
                    supabase
                        .from("tamamlanan_seferler")
                        .select("proje_adi,teslim_ili,sefer_tarihi")
                        .eq("plaka", plaka)
                        .gte("sefer_tarihi", startISO)
                        .lt("sefer_tarihi", endISO),
                ]);

                if (monthA.error || monthB.error) {
                    console.error(monthA.error || monthB.error);
                    setStats({ total: totalThisMonth, topProjects: [], topRegions: [], label: monthLabel });
                } else {
                    const monthCombined = [...(monthA.data || []), ...(monthB.data || [])].map((r) => {
                        const lastIl = lastAfterSemicolon(r.teslim_ili);
                        const { bolge } = normalizeSonNoktaAndRegion(lastIl);
                        return { ...r, bolge };
                    });

                    const topProjects = countBy(monthCombined, (r) => r.proje_adi).slice(0, 6);
                    const topRegions = countBy(monthCombined, (r) => r.bolge).slice(0, 6);

                    setStats({
                        total: totalThisMonth,
                        topProjects,
                        topRegions,
                        label: monthLabel,
                    });
                }
            }

            setLoading(false);
        })();

        return () => {
            alive = false;
        };
    }, [plaka, showAll]);

    const columns = useMemo(
        () => [
            {
                field: "sefer_tarihi",
                headerName: "Sefer Tarihi",
                width: 130,
                renderCell: (p) => <>{formatDateTR(p.row?.sefer_tarihi)}</>,
            },
            { field: "sefer_no", headerName: "Sefer No", width: 140 },
            { field: "plaka", headerName: "Plaka", width: 120 },
            { field: "proje_adi", headerName: "Proje Adı", width: 180 },
            { field: "yukleme_noktasi", headerName: "Yükleme Noktası", width: 200 },
            { field: "yukleme_ili", headerName: "Yükleme İli", width: 140 },
            { field: "yukleme_ilcesi", headerName: "Yükleme İlçesi", width: 160 },
            { field: "teslim_noktasi", headerName: "Teslim Noktası", width: 200 },
            { field: "teslim_ili", headerName: "Teslim İli", width: 140 },
            { field: "teslim_ilcesi", headerName: "Teslim İlçesi", width: 160 },
            {
                field: "eta",
                headerName: "ETA",
                width: 130,
                renderCell: (p) => <>{formatDateTR(p.row?.eta)}</>,
            },
            { field: "bolge", headerName: "Bölge", width: 160 },
        ],
        []
    );

    const projectChartData = stats.topProjects.map((x) => ({ name: x.name || "—", count: x.count }));
    const regionChartData = stats.topRegions.map((x) => ({ name: x.name || "—", value: x.count }));

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h6" fontWeight={800}>Sefer Geçmişi</Typography>
                        {plaka ? <Chip size="small" label={plaka} /> : null}
                    </Stack>

                    {/* ÜST SAĞ: Tüm seferleri gör / Kısalt */}
                    <Stack direction="row" spacing={1}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setShowAll((s) => !s)}
                        >
                            {showAll ? "Kısalt (son 4 tamamlanan)" : "Tüm seferleri gör"}
                        </Button>
                        <IconButton onClick={onClose}><CloseIcon /></IconButton>
                    </Stack>
                </Stack>
            </DialogTitle>

            <Divider />
            <DialogContent sx={{ p: 2 }}>
                {loading ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                        <CircularProgress />
                        <Typography sx={{ mt: 1 }}>Yükleniyor…</Typography>
                    </Stack>
                ) : rows.length === 0 ? (
                    <Stack alignItems="center" sx={{ py: 4, opacity: 0.8 }}>
                        <Typography>Bu plakaya ait sefer bulunamadı.</Typography>
                    </Stack>
                ) : (
                    <>
                        <Box sx={{ height: 520 }}>
                            <DataGrid
                                rows={rows}
                                getRowId={(r) => r._id}
                                columns={columns}
                                density="compact"
                                disableRowSelectionOnClick
                            />
                        </Box>

                        {/* ---- Dashboard ---- */}
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }}>
                            {/* KPI */}
                            <Paper
                                elevation={0}
                                sx={{
                                    flex: 1,
                                    p: 2,
                                    borderRadius: 3,
                                    background: "linear-gradient(135deg, rgba(136,132,216,0.15), rgba(130,202,157,0.15))",
                                    border: "1px solid",
                                    borderColor: "divider",
                                }}
                            >
                                <Typography variant="overline" sx={{ opacity: 0.7 }}>
                                    {stats.label}
                                </Typography>
                                <Typography variant="h5" fontWeight={800}>
                                    {showAll ? "Toplam Sefer (tüm zaman)" : "Bu Ay Toplam Sefer"}
                                </Typography>
                                <Typography variant="h2" fontWeight={900} sx={{ lineHeight: 1 }}>
                                    {stats.total}
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                                    {showAll
                                        ? "seferler + tamamlanan_seferler (tam tablo görünümü)"
                                        : "seferler + tamamlanan_seferler (ay içi tüm kayıtlar)"}
                                </Typography>
                            </Paper>

                            {/* Projeler */}
                            <Paper variant="outlined" sx={{ flex: 2, p: 2, borderRadius: 3, minHeight: 220 }}>
                                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                    {showAll ? "En Çok Gidilen Projeler (tüm zaman)" : "Bu Ay En Çok Gidilen Projeler"}
                                </Typography>
                                {projectChartData.length === 0 ? (
                                    <Typography sx={{ opacity: 0.7 }}>Kayıt yok</Typography>
                                ) : (
                                    <Box sx={{ width: "100%", height: 220 }}>
                                        <ResponsiveContainer>
                                            <BarChart data={projectChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={50} angle={-15} textAnchor="end" />
                                                <YAxis allowDecimals={false} />
                                                <Tooltip formatter={(v) => [`${v} sefer`, "Adet"]} />
                                                <Bar dataKey="count" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Box>
                                )}
                            </Paper>

                            {/* Bölgeler */}
                            <Paper variant="outlined" sx={{ flex: 2, p: 2, borderRadius: 3, minHeight: 220 }}>
                                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                    {showAll ? "En Çok Gidilen Bölgeler (tüm zaman)" : "Bu Ay En Çok Gidilen Bölgeler"}
                                </Typography>
                                {regionChartData.length === 0 ? (
                                    <Typography sx={{ opacity: 0.7 }}>Kayıt yok</Typography>
                                ) : (
                                    <Box sx={{ width: "100%", height: 220 }}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Tooltip formatter={(v, n) => [`${v} sefer`, n]} />
                                                <Pie
                                                    data={regionChartData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    innerRadius={45}
                                                    outerRadius={75}
                                                    paddingAngle={2}
                                                    strokeWidth={1}
                                                >
                                                    {regionChartData.map((_, i) => (
                                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </Box>
                                )}
                            </Paper>
                        </Stack>
                    </>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Kapat</Button>
            </DialogActions>
        </Dialog>
    );
}
