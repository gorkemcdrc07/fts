// src/kullanıcıIslemleri/Planlama.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom"; // ⬅️ eklendi

// MUI
import {
    Box,
    Stack,
    Paper,
    Button,
    Typography,
    TextField,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert,
    IconButton,
    Tooltip,
    Backdrop,
    CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/PlaylistAdd";
import SaveIcon from "@mui/icons-material/Save";
import TuneIcon from "@mui/icons-material/Tune";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew"; // ⬅️ eklendi
import HomeIcon from "@mui/icons-material/Home"; // ⬅️ eklendi

// XLSX
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/* ---------------- helpers ---------------- */
const getTodayISO = () => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
const toUpperTr = (s) => (s || "").toLocaleUpperCase("tr-TR").trim();

const ilToBolgeMap = {
    ADANA: "Doğu Bölgesi", ADIYAMAN: "Doğu Bölgesi", AFYON: "İç Anadolu Bölgesi",
    AĞRI: "Doğu Bölgesi", AMASYA: "Karadeniz Bölgesi", ANKARA: "İç Anadolu Bölgesi",
    ANTALYA: "Ege Bölgesi", ARTVİN: "Karadeniz Bölgesi", AYDIN: "Ege Bölgesi",
    BALIKESİR: "Ege Bölgesi", BARTIN: "Karadeniz Bölgesi", BATMAN: "Doğu Bölgesi",
    BAYBURT: "Karadeniz Bölgesi", BİLECİK: "İç Anadolu Bölgesi", BİNGÖL: "Doğu Bölgesi",
    BİTLİS: "Doğu Bölgesi", BOLU: "Karadeniz Bölgesi", BURDUR: "Ege Bölgesi",
    BURSA: "Ege Bölgesi", ÇANAKKALE: "Trakya Bölgesi", ÇANKIRI: "İç Anadolu Bölgesi",
    ÇORUM: "İç Anadolu Bölgesi", DENİZLİ: "Ege Bölgesi", DİYARBAKIR: "Doğu Bölgesi",
    DÜZCE: "Karadeniz Bölgesi", EDİRNE: "Trakya Bölgesi", ELAZIĞ: "Doğu Bölgesi",
    ERZİNCAN: "Doğu Bölgesi", ERZURUM: "Doğu Bölgesi", ESKİŞEHİR: "İç Anadolu Bölgesi",
    GAZİANTEP: "Doğu Bölgesi", GİRESUN: "Karadeniz Bölgesi", GÜMÜŞHANE: "Karadeniz Bölgesi",
    HAKKARİ: "Doğu Bölgesi", HATAY: "Doğu Bölgesi", ISPARTA: "Ege Bölgesi",
    MERSİN: "Doğu Bölgesi", İSTANBUL: "Marmara Bölgesi", İZMİR: "Ege Bölgesi",
    KAHRAMANMARAŞ: "Doğu Bölgesi", KARABÜK: "Karadeniz Bölgesi", KARAMAN: "İç Anadolu Bölgesi",
    KARS: "Doğu Bölgesi", KASTAMONU: "Karadeniz Bölgesi", KAYSERİ: "İç Anadolu Bölgesi",
    KİLİS: "Doğu Bölgesi", KIRIKKALE: "İç Anadolu Bölgesi", KIRKLARELİ: "Trakya Bölgesi",
    KIRŞEHİR: "İç Anadolu Bölgesi", KOCAELİ: "Kocaeli Bölgesi", KONYA: "İç Anadolu Bölgesi",
    KÜTAHYA: "İç Anadolu Bölgesi", MALATYA: "Doğu Bölgesi", MANİSA: "Ege Bölgesi",
    MARDİN: "Doğu Bölgesi", MUĞLA: "Ege Bölgesi", MUŞ: "Doğu Bölgesi",
    NEVŞEHİR: "İç Anadolu Bölgesi", NİĞDE: "İç Anadolu Bölgesi", ORDU: "Karadeniz Bölgesi",
    OSMANİYE: "Doğu Bölgesi", RİZE: "Karadeniz Bölgesi", SAKARYA: "Kocaeli Bölgesi",
    SAMSUN: "Karadeniz Bölgesi", SİİRT: "Doğu Bölgesi", SİNOP: "Karadeniz Bölgesi",
    SİVAS: "İç Anadolu Bölgesi", ŞANLIURFA: "Doğu Bölgesi", ŞIRNAK: "Doğu Bölgesi",
    TEKİRDAĞ: "Trakya Bölgesi", TOKAT: "Karadeniz Bölgesi", TRABZON: "Karadeniz Bölgesi",
    TUNCELİ: "Doğu Bölgesi", UŞAK: "Ege Bölgesi", VAN: "Doğu Bölgesi",
    YALOVA: "Ege Bölgesi", YOZGAT: "İç Anadolu Bölgesi", ZONGULDAK: "Karadeniz Bölgesi",
    ADALAR: "Kocaeli Bölgesi", ATAŞEHİR: "Kocaeli Bölgesi", BEYKOZ: "Kocaeli Bölgesi",
    ÖMERLİ: "Kocaeli Bölgesi", KADIKÖY: "Kocaeli Bölgesi", KARTAL: "Kocaeli Bölgesi",
    MALTEPE: "Kocaeli Bölgesi", PENDİK: "Kocaeli Bölgesi", SANCAKTEPE: "Kocaeli Bölgesi",
    SULTANBEYLİ: "Kocaeli Bölgesi", ŞİLE: "Kocaeli Bölgesi", TUZLA: "Kocaeli Bölgesi",
    ÜMRANİYE: "Kocaeli Bölgesi", ÜSKÜDAR: "Kocaeli Bölgesi",
    ARNAVUTKÖY: "Marmara Bölgesi", AVCILAR: "Marmara Bölgesi", BAĞCILAR: "Marmara Bölgesi",
    BAHÇELİEVLER: "Marmara Bölgesi", BAKIRKÖY: "Marmara Bölgesi", BAŞAKŞEHİR: "Marmara Bölgesi",
    BAYRAMPAŞA: "Marmara Bölgesi", BEŞİKTAŞ: "Marmara Bölgesi", BEYLİKDÜZÜ: "Marmara Bölgesi",
    BEYOĞLU: "Marmara Bölgesi", BÜYÜKÇEKMECE: "Marmara Bölgesi", ÇATALCA: "Marmara Bölgesi",
    ESENLER: "Marmara Bölgesi", ESENYURT: "Marmara Bölgesi", EYÜP: "Marmara Bölgesi",
    FATİH: "Marmara Bölgesi", GAZİOSMANPAŞA: "Marmara Bölgesi", GÜNGÖREN: "Marmara Bölgesi",
    KAĞITHANE: "Marmara Bölgesi", KÜÇÜKÇEKMECE: "Marmara Bölgesi", SARIYER: "Marmara Bölgesi",
    SİLİVRİ: "Marmara Bölgesi", SULTANGAZİ: "Marmara Bölgesi", ŞİŞLİ: "Marmara Bölgesi",
    ZEYTİNBURNU: "Marmara Bölgesi",
};

// Grid alanları
const alanlar = [
    "sefer_no", "sevk_no", "tarih", "plaka", "ad_soyad", "telefon", "tc",
    "varis_tarihi", "son_nokta", "fatura_musterisi",
    "yukleme_noktasi", "tahliye_noktasi", "tahliye_il",
    "tonaj", "bir_onceki_is", "bolge",
];

export default function Planlama() {
    const navigate = useNavigate(); // ⬅️ eklendi

    /* ---------- state ---------- */
    const [rows, setRows] = useState([]);
    const [filteredRows, setFilteredRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // filtreler
    const [plakalar, setPlakalar] = useState([]);
    const [bolgeler, setBolgeler] = useState([]);
    const [plakaFilter, setPlakaFilter] = useState("");
    const [bolgeFilter, setBolgeFilter] = useState("");
    const [search, setSearch] = useState("");

    // görünüm (kolon sırası)
    const [columnOrder, setColumnOrder] = useState([...alanlar]);

    // snackbar
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

    // dialog: yeni plaka
    const [plakaDialogOpen, setPlakaDialogOpen] = useState(false);
    const [yeniPlaka, setYeniPlaka] = useState({ plaka: "", ad_soyad: "", telefon: "", tc: "" });

    // dialog: toplu güncelle onayı
    const [guncelleDialogOpen, setGuncelleDialogOpen] = useState(false);

    /* ---------- data fetch ---------- */
    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("planlama")
            .select("*")
            .order("sefer_no", { ascending: false });

        if (error) {
            console.error(error);
            setSnack({ open: true, msg: "Veri çekilirken hata oluştu.", severity: "error" });
            setLoading(false);
            return;
        }

        const enriched = (data || []).map((v, index) => {
            const ilUpper = toUpperTr(v.son_nokta);
            const bolge = ilToBolgeMap[ilUpper] || v.bolge || "";
            const tarih = v.tarih || getTodayISO();
            const _rowId = v.id ?? v.sefer_no ?? `tmp-${Date.now()}-${index}`;
            return { ...v, bolge, tarih, _rowId };
        });

        setRows(enriched);
        setFilteredRows(enriched);
        setBolgeler([...new Set(enriched.map((r) => r.bolge).filter(Boolean))]);
        setLoading(false);

        const { data: plakaData } = await supabase.from("plakalar").select("plaka");
        if (plakaData) setPlakalar(plakaData.map((d) => d.plaka));
    }, []);

    const loadView = useCallback(async () => {
        const kullaniciId = parseInt(localStorage.getItem("kullaniciId"));
        if (!kullaniciId) return;
        const { data } = await supabase
            .from("kullanici_planlama_gorunumleri")
            .select("gorunum")
            .eq("kullanici_id", kullaniciId)
            .eq("sayfa", "planlama")
            .maybeSingle();

        if (data?.gorunum && Array.isArray(data.gorunum) && data.gorunum.length) {
            const valid = data.gorunum.filter((c) => alanlar.includes(c));
            if (valid.length) setColumnOrder(valid);
        }
    }, []);

    useEffect(() => {
        fetchData();
        loadView();
    }, [fetchData, loadView]);

    /* ---------- filtering ---------- */
    useEffect(() => {
        let r = [...rows];
        if (plakaFilter) r = r.filter((x) => (x.plaka || "") === plakaFilter);
        if (bolgeFilter) r = r.filter((x) => (x.bolge || "") === bolgeFilter);
        if (search) {
            const s = search.toLowerCase();
            r = r.filter((x) =>
                Object.values(x || {}).some((v) => String(v || "").toLowerCase().includes(s))
            );
        }
        setFilteredRows(r);
    }, [rows, plakaFilter, bolgeFilter, search]);

    /* ---------- görünümü kaydet ---------- */
    const saveView = useCallback(async () => {
        const kullaniciId = parseInt(localStorage.getItem("kullaniciId"));
        if (!kullaniciId) {
            setSnack({ open: true, msg: "Kullanıcı bulunamadı.", severity: "warning" });
            return;
        }
        const { error } = await supabase
            .from("kullanici_planlama_gorunumleri")
            .upsert(
                { kullanici_id: kullaniciId, sayfa: "planlama", gorunum: columnOrder },
                { onConflict: ["kullanici_id", "sayfa"] }
            );
        if (error) {
            setSnack({ open: true, msg: "Görünüm kaydedilemedi.", severity: "error" });
        } else {
            setSnack({ open: true, msg: "Görünüm kaydedildi.", severity: "success" });
        }
    }, [columnOrder]);

    /* ---------- excel export ---------- */
    const exportExcel = () => {
        if (!filteredRows.length) {
            setSnack({ open: true, msg: "Aktarılacak veri yok.", severity: "info" });
            return;
        }
        const sheet = filteredRows.map((s) => ({
            SeferNo: s.sefer_no,
            SevkNo: s.sevk_no,
            Tarih: s.tarih,
            Plaka: s.plaka,
            AdSoyad: s.ad_soyad,
            Telefon: s.telefon,
            TC: s.tc,
            VarisTarihi: s.varis_tarihi,
            SonNokta: s.son_nokta,
            FaturaMusterisi: s.fatura_musterisi,
            YuklemeNoktasi: s.yukleme_noktasi,
            TahliyeNoktasi: s.tahliye_noktasi,
            TahliyeIl: s.tahliye_il,
            Tonaj: s.tonaj,
            BirOncekiIs: s.bir_onceki_is,
            Bolge: s.bolge,
        }));
        const ws = XLSX.utils.json_to_sheet(sheet);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Planlama");
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        saveAs(new Blob([buf], { type: "application/octet-stream" }), "planlama.xlsx");
    };

    /* ---------- toplu güncelle ---------- */
    const handleTopluGuncelle = () => setGuncelleDialogOpen(true);
    const confirmTopluGuncelle = () => {
        const guncellenmis = filteredRows.map((item) => {
            const il = toUpperTr(item.tahliye_il);
            const bolge = ilToBolgeMap[il] || "";
            const bir_onceki_is = [item.fatura_musterisi, item.yukleme_noktasi, item.tahliye_noktasi]
                .filter(Boolean)
                .join(" / ");
            return {
                ...item,
                bir_onceki_is,
                son_nokta: item.tahliye_il || "",
                fatura_musterisi: "",
                yukleme_noktasi: "",
                tahliye_noktasi: "",
                tahliye_il: "",
                tonaj: "",
                bolge,
            };
        });
        const updated = rows.map((r) => guncellenmis.find((g) => g._rowId === r._rowId) || r);
        setRows(updated);
        setGuncelleDialogOpen(false);
        setSnack({ open: true, msg: "Satırlar güncellendi (lokal). Kaydet ile yazılır.", severity: "success" });
    };

    /* ---------- kaydet (insert/update) ---------- */
    const handleKaydet = async () => {
        setSaving(true);

        for (const item of rows) {
            const payload = { ...item };
            delete payload._rowId;

            ["tarih", "varis_tarihi"].forEach((k) => {
                if (!payload[k]) payload[k] = getTodayISO();
                if (typeof payload[k] === "string" && payload[k].includes(".")) {
                    const [g, a, y] = payload[k].split(".");
                    payload[k] = `${y}-${a.padStart(2, "0")}-${g.padStart(2, "0")}`;
                }
            });

            const il = toUpperTr(payload.son_nokta);
            payload.bolge = ilToBolgeMap[il] || payload.bolge || null;

            Object.keys(payload).forEach((k) => {
                if (payload[k] === undefined || payload[k] === "") payload[k] = null;
            });

            try {
                if (payload.id) {
                    const { error } = await supabase.from("planlama").update(payload).eq("id", payload.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from("planlama").insert(payload);
                    if (error) throw error;
                }
            } catch (err) {
                console.error("Kaydet hatası:", err.message, payload);
            }
        }

        await fetchData();
        setSaving(false);
        setSnack({ open: true, msg: "Değişiklikler kaydedildi.", severity: "success" });
    };

    /* ---------- satır sil ---------- */
    const handleSil = async (_rowId) => {
        const satir = rows.find((r) => r._rowId === _rowId);
        if (!satir) return;
        if (!window.confirm("Bu satırı silmek istiyor musunuz?")) return;

        if (satir.id) {
            const { error } = await supabase.from("planlama").delete().eq("id", satir.id);
            if (error) {
                setSnack({ open: true, msg: "Kayıt silinemedi.", severity: "error" });
                return;
            }
        }
        const r = rows.filter((x) => x._rowId !== _rowId);
        setRows(r);
        setSnack({ open: true, msg: "Satır silindi (lokal). Kaydet ile kalıcı olur.", severity: "info" });
    };

    /* ---------- yeni plaka satırı ekle ---------- */
    const openPlakaDialog = () => {
        setYeniPlaka({ plaka: "", ad_soyad: "", telefon: "", tc: "" });
        setPlakaDialogOpen(true);
    };
    const saveYeniPlaka = async () => {
        const { plaka, ad_soyad, telefon, tc } = yeniPlaka;
        if (!plaka || !ad_soyad || !telefon || !tc) {
            setSnack({ open: true, msg: "Tüm alanlar zorunlu.", severity: "warning" });
            return;
        }
        const yeni = {
            sefer_no: "",
            sevk_no: "",
            tarih: getTodayISO(),
            varis_tarihi: getTodayISO(),
            son_nokta: "",
            fatura_musterisi: "",
            yukleme_noktasi: "",
            tahliye_noktasi: "",
            tahliye_il: "",
            tonaj: "",
            bir_onceki_is: "",
            bolge: "",
            plaka,
            ad_soyad,
            telefon,
            tc,
        };
        const _rowId = `tmp-${Date.now()}`;
        setRows([{ ...yeni, _rowId }, ...rows]);
        setPlakaDialogOpen(false);
        setSnack({ open: true, msg: "Yeni satır eklendi (lokal). Kaydet ile yazılır.", severity: "success" });
    };

    /* ---------- DataGrid kolonları ---------- */
    const columns = useMemo(() => {
        const textCol = (field, headerName, width = 160, editable = true) => ({
            field,
            headerName,
            width,
            editable,
        });

        return [
            {
                field: "actions",
                headerName: "İşlem",
                width: 110,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Sil">
                            <IconButton size="small" onClick={() => handleSil(params.row._rowId)}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                ),
            },
            textCol("sefer_no", "Sefer No", 140),
            textCol("sevk_no", "Sevk No", 140),
            textCol("tarih", "Tarih", 120),
            textCol("plaka", "Plaka", 120, false),
            textCol("ad_soyad", "Ad Soyad", 160, false),
            textCol("telefon", "Telefon", 140, false),
            textCol("tc", "TC", 120, false),
            textCol("varis_tarihi", "Varış Tarihi", 120),
            textCol("son_nokta", "Son Nokta", 160),
            textCol("fatura_musterisi", "Fatura Müşterisi", 180),
            textCol("yukleme_noktasi", "Yükleme Noktası", 200),
            textCol("tahliye_noktasi", "Tahliye Noktası", 200),
            textCol("tahliye_il", "Tahliye İl", 140),
            textCol("tonaj", "Tonaj", 100),
            textCol("bir_onceki_is", "Bir Önceki İş", 220, false),
            {
                field: "bolge",
                headerName: "Bölge",
                width: 150,
                editable: false,
                valueGetter: (value, row) => row?.bolge ?? "",
            },
        ];
    }, [handleSil]);

    // Kolon sırası
    const orderedColumns = useMemo(() => {
        const map = Object.fromEntries(columns.map((c) => [c.field, c]));
        const ordered = ["actions", ...columnOrder].map((f) => map[f]).filter(Boolean);
        const rest = columns.filter((c) => !ordered.includes(c));
        return [...ordered, ...rest];
    }, [columns, columnOrder]);

    /* ---------- DataGrid edit akışı ---------- */
    const processRowUpdate = useCallback((newRow, oldRow) => {
        if (newRow.son_nokta !== oldRow.son_nokta) {
            const il = toUpperTr(newRow.son_nokta);
            newRow.bolge = ilToBolgeMap[il] || "";
        }
        return newRow;
    }, []);

    const handleRowUpdateCommit = useCallback((updatedRow) => {
        setRows((prev) => prev.map((r) => (r._rowId === updatedRow._rowId ? updatedRow : r)));
    }, []);

    const onColumnOrderChange = useCallback((params) => {
        setColumnOrder((prev) => {
            const f = params.column?.field;
            if (!f || !alanlar.includes(f)) return prev;
            const arr = prev.filter((x) => x !== f);
            arr.splice(params.targetIndex, 0, f);
            return arr;
        });
    }, []);

    return (
        <Box
            sx={{
                height: "100dvh",
                display: "grid",
                gridTemplateRows: "auto auto 1fr",
                gap: 1.5,
                p: 2,
                background:
                    "radial-gradient(1200px 500px at 10% -10%, rgba(34,211,238,0.10), transparent 40%)," +
                    "radial-gradient(900px 400px at 90% 0%, rgba(139,92,246,0.12), transparent 50%)," +
                    "linear-gradient(180deg, #050816 0%, #0B1220 100%)",
            }}
        >
            <Helmet>
                <title>PLANLAMA</title>
            </Helmet>

            {/* Başlık + Aksiyonlar */}
            <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
                spacing={1}
            >
                <Stack direction="row" alignItems="center" spacing={1.25}>
                    {/* ⬇️ Navigasyon butonları */}
                    <Tooltip title="Geri">
                        <IconButton
                            onClick={() => navigate(-1)}
                            sx={{ border: "1px solid rgba(255,255,255,0.12)", mr: 0.5 }}
                            size="small"
                        >
                            <ArrowBackIosNewIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Anasayfa">
                        <IconButton
                            onClick={() => navigate("/anasayfa")}
                            sx={{ border: "1px solid rgba(255,255,255,0.12)" }}
                            size="small"
                        >
                            <HomeIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

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
                            Planlama
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            Canlı düzenleme • kolon sürükle-bırak • filtreler • Excel aktarım
                        </Typography>
                    </Stack>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button variant="contained" startIcon={<SaveIcon />} onClick={handleKaydet}>
                        Kaydet
                    </Button>
                    <Button variant="outlined" startIcon={<TuneIcon />} onClick={handleTopluGuncelle}>
                        Güncelle
                    </Button>
                    <Button variant="outlined" startIcon={<CheckCircleIcon />} onClick={saveView}>
                        Görünümü Kaydet
                    </Button>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportExcel}>
                        Excel
                    </Button>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={openPlakaDialog}>
                        Yeni Plaka
                    </Button>
                </Stack>
            </Stack>

            {/* Filtreler */}
            <Paper
                sx={{
                    p: 1,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                    background: `linear-gradient(180deg, ${alpha("#ffffff", 0.04)} 0%, ${alpha("#ffffff", 0.02)} 100%)`,
                    border: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                <TextField
                    label="Plaka"
                    select
                    size="small"
                    value={plakaFilter}
                    onChange={(e) => setPlakaFilter(e.target.value)}
                    sx={{ minWidth: 160 }}
                >
                    <MenuItem value="">Tümü</MenuItem>
                    {plakalar.map((p) => (
                        <MenuItem key={p} value={p}>
                            {p}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    label="Bölge"
                    select
                    size="small"
                    value={bolgeFilter}
                    onChange={(e) => setBolgeFilter(e.target.value)}
                    sx={{ minWidth: 160 }}
                >
                    <MenuItem value="">Tümü</MenuItem>
                    {bolgeler.map((b) => (
                        <MenuItem key={b} value={b}>
                            {b}
                        </MenuItem>
                    ))}
                </TextField>

                <Box sx={{ flex: 1 }} />

                {/* GridToolbarQuickFilter yerine normal arama kutusu */}
                <TextField
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ara…"
                    sx={{ minWidth: 220 }}
                />
            </Paper>

            {/* DataGrid */}
            <Paper
                sx={{
                    borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.06)",
                    overflow: "hidden",
                    minHeight: 0,
                    display: "grid",
                }}
            >
                <DataGrid
                    rows={filteredRows}
                    columns={orderedColumns}
                    getRowId={(r) => r._rowId}
                    loading={loading}
                    disableRowSelectionOnClick
                    density="compact"
                    rowHeight={40}
                    columnHeaderHeight={44}
                    checkboxSelection={false}
                    editMode="row"
                    processRowUpdate={processRowUpdate}
                    onProcessRowUpdateError={(e) => {
                        console.error(e);
                        setSnack({ open: true, msg: "Satır güncellenemedi.", severity: "error" });
                    }}
                    onRowUpdateCommit={handleRowUpdateCommit}
                    disableColumnMenu={false}
                    columnReorder
                    onColumnOrderChange={onColumnOrderChange}
                    sx={{
                        border: "none",
                        "& .MuiDataGrid-columnHeaders": {
                            background: "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.7) 100%)",
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

            {/* Kaydetme sırasında bloklayıcı */}
            <Backdrop open={saving} sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 1 }}>
                <CircularProgress color="inherit" />
                <Typography sx={{ ml: 2 }}>Kaydediliyor…</Typography>
            </Backdrop>

            {/* Yeni Plaka Dialog */}
            <Dialog open={plakaDialogOpen} onClose={() => setPlakaDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Yeni Plaka Ekle</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                        <TextField
                            label="Plaka"
                            value={yeniPlaka.plaka}
                            onChange={(e) => setYeniPlaka((p) => ({ ...p, plaka: e.target.value }))}
                            autoFocus
                        />
                        <TextField
                            label="Ad Soyad"
                            value={yeniPlaka.ad_soyad}
                            onChange={(e) => setYeniPlaka((p) => ({ ...p, ad_soyad: e.target.value }))}
                        />
                        <TextField
                            label="Telefon"
                            value={yeniPlaka.telefon}
                            onChange={(e) => setYeniPlaka((p) => ({ ...p, telefon: e.target.value }))}
                        />
                        <TextField
                            label="TC"
                            value={yeniPlaka.tc}
                            onChange={(e) => setYeniPlaka((p) => ({ ...p, tc: e.target.value }))}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPlakaDialogOpen(false)}>İptal</Button>
                    <Button variant="contained" onClick={saveYeniPlaka}>
                        Kaydet
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Toplu Güncelle Onay */}
            <Dialog open={guncelleDialogOpen} onClose={() => setGuncelleDialogOpen(false)}>
                <DialogTitle>Güncelleme Onayı</DialogTitle>
                <DialogContent>
                    <Typography>Tüm kayıtlar güncellenecek. Devam etmek istiyor musunuz?</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setGuncelleDialogOpen(false)}>İptal</Button>
                    <Button variant="contained" onClick={confirmTopluGuncelle}>
                        Evet, Güncelle
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    severity={snack.severity}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
