// src/kullanıcıIslemleri/Planlama-Deluxe.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback, Suspense, lazy } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

// MUI
import {
    Box,
    Stack,
    Paper,
    Button,
    Typography,
    TextField,
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
    Chip,
    Divider,
    Autocomplete,
    Drawer,
    LinearProgress,
    Fab,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/PlaylistAdd";
import SaveIcon from "@mui/icons-material/Save";
import TuneIcon from "@mui/icons-material/Tune";
import CheckCircleIcon from "@mui/icons-material/CheckCircle"; // export
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeIcon from "@mui/icons-material/Home";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import usePermissions from "../auth/usePermissions";


/* ---------------- Sefer Detay Panel (lazy) ---------------- */
const SeferDetayPanel = lazy(() => import("./planlamaDetay/SeferDetayPanel"));
const SiparisAnaliz = lazy(() => import("./planlamaDetay/SiparisAnaliz"));

/* ---------------- helpers ---------------- */

// TR uppercase
const toUpperTr = (s) => (s || "").toLocaleUpperCase("tr-TR").trim();
const getTodayISO = () => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
// "YYYY-MM-DD" → "GG.AA.YYYY" çevirir
const formatDateTR = (val) => {
    if (!val) return "";
    try {
        if (typeof val === "number" && XLSX?.SSF?.parse_date_code) {
            const d = XLSX.SSF.parse_date_code(val);
            const dt = new Date(d.y, (d.m || 1) - 1, d.d || 1);
            if (!isNaN(dt)) {
                return dt.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
            }
        }
        const d = new Date(val);
        if (isNaN(d)) return String(val);
        return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
        return String(val);
    }
};

// Plaka normalize (görsel)
const normPlaka = (s) => toUpperTr(String(s || "").trim().replace(/\s+/g, " "));
const primaryPlaka = (s) => normPlaka(String(s || "")).split("-")[0].trim();

// Karşılaştırma anahtarı
const plakaKey = (s) => toUpperTr(String(s || "")).replace(/[^A-Z0-9]/g, "");

// Debounce
const useDebounced = (value, delay = 250) => {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
};
const isKocaeli = (name) => toUpperTr(name).includes("KOCAELİ");

// SON NOKTA ve BÖLGE normalizasyonu
const normalizeSonNoktaAndRegion = (raw) => {
    const u = toUpperTr(raw || "");
    let son_nokta = raw || "";

    if (u === "ANTEP") son_nokta = "GAZİANTEP";
    if (u === "URFA") son_nokta = "ŞANLIURFA";
    if (u === "MARAŞ") son_nokta = "KAHRAMANMARAŞ";

    let bolge = "";
    if (u.includes("İSTANBUL AVRUPA")) {
        bolge = "Marmara Bölgesi";
    } else if (u.includes("İSTANBUL ANADOLU")) {
        bolge = "Kocaeli Bölgesi";
    } else if (u === "TRAKYA") {
        bolge = "Trakya Bölgesi";
    } else {
        bolge = ilToBolgeMap[toUpperTr(son_nokta)] || "";
    }

    return { son_nokta, bolge };
};

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
    ZEYTİNBURNU: "Marmara Bölgesi", AKSARAY: "İç Anadolu Bölgesi"
};

// Bölge renklendirme
const bolgeChip = (bolge) => {
    const map = {
        "Marmara Bölgesi": "primary",
        "Kocaeli Bölgesi": "info",
        "Ege Bölgesi": "success",
        "İç Anadolu Bölgesi": "warning",
        "Karadeniz Bölgesi": "secondary",
        "Doğu Bölgesi": "error",
        "Trakya Bölgesi": "default",
    };
    return map[bolge] || "default";
};

// Rol key map (UI rol → roles.key)
const ROLE_NAME_TO_KEY = {
    "YÖNETİCİ": "YONETICI",
    "OPERASYON": "OPERASYON",
    "TAKİP": "TAKIP",
};

function NoRowsOverlay() {
    return (
        <Stack height="100%" alignItems="center" justifyContent="center" spacing={1.25}>
            <Typography variant="h6" sx={{ opacity: 0.8 }}>Henüz kayıt yok</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Filtreleri temizleyin veya sağ alttaki ✚ ile ilk satırı ekleyin.
            </Typography>
            <SearchIcon sx={{ opacity: 0.35, fontSize: 42 }} />
        </Stack>
    );
}
function BusyOverlay() {
    return (
        <Stack height="100%" alignItems="center" justifyContent="center" spacing={1}>
            <CircularProgress size={28} />
            <Typography variant="body2">Yükleniyor…</Typography>
        </Stack>
    );
}

// Grid alanları
const alanlar = [
    "sefer_no", "sevk_no", "tarih", "plaka", "ad_soyad", "telefon", "tc",
    "varis_tarihi", "son_nokta", "fatura_musterisi",
    "yukleme_noktasi", "tahliye_noktasi", "tahliye_il",
    "tonaj", "bir_onceki_is", "bolge",
];

export default function PlanlamaDeluxe() {
    const navigate = useNavigate();

    /* ---------- state ---------- */
    const [rows, setRows] = useState([]);
    const [filteredRows, setFilteredRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // permissions (planlama) — usePermissions ile
    const {
        loading: permsLoading,
        pln_update = false,
        pln_save = false,
        pln_export_excel = false,
        pln_import_excel = false,
    } = usePermissions('planlama');

    // Sayfa içinde mevcut "perms.xxx" kullanımlarını bozmamak için aynı yapıyı memo’layalım
    const perms = useMemo(() => ({
        loaded: !permsLoading,
        pln_update,
        pln_save,
        pln_export_excel,
        pln_import_excel,
    }), [permsLoading, pln_update, pln_save, pln_export_excel, pln_import_excel]);

    // görünüm (kolon sırası)
    const [columnOrder, setColumnOrder] = useState([...alanlar]);

    // snackbar
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success", action: null });

    // dialog: yeni plaka
    const [plakaDialogOpen, setPlakaDialogOpen] = useState(false);
    const [yeniPlaka, setYeniPlaka] = useState({ plaka: "", ad_soyad: "", telefon: "", tc: "" });

    // dialog: toplu güncelle onayı
    const [guncelleDialogOpen, setGuncelleDialogOpen] = useState(false);

    // sağ çekmece: hızlı düzenleme
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeEditRow, setActiveEditRow] = useState(null);

    // Sefer Detay Panel state
    const [detayOpen, setDetayOpen] = useState(false);
    const [detayContext, setDetayContext] = useState(null);

    // Sipariş Analiz panel state
    const [analizOpen, setAnalizOpen] = useState(false);
    const [analizContext, setAnalizContext] = useState(null);

    // değişiklik takibi (sticky kaydet barı)
    const lastSavedSnapshot = useRef("[]");
    const isDirty = useMemo(() => lastSavedSnapshot.current !== JSON.stringify(rows), [rows]);

    // drag & drop
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);
    const acceptedExts = [".xlsx", ".xls", ".csv"];

    const normalizeHeader = (s = "") => toUpperTr(String(s)).replace(/\s+/g, " ").replace(/\./g, "").trim();

    // filtreler
    const [plakalar, setPlakalar] = useState([]);
    const [bolgeler, setBolgeler] = useState([]);
    const [plakaFilter, setPlakaFilter] = useState([]);
    const [bolgeFilter, setBolgeFilter] = useState([]);

    // Autocomplete input metinleri
    const [plakaInput, setPlakaInput] = useState("");
    const [bolgeInput, setBolgeInput] = useState("");

    // Arama kutusu
    const [search, setSearch] = useState("");
    const searchRef = useRef(null);
    const debouncedSearch = useDebounced(search, 300);

    // Excel başlığı → alan eşleme
    const headerMap = {
        "SEFER NO": "sefer_no",
        "SEVK NO": "sevk_no",
        "TARİH": "tarih",
        "PLAKA": "plaka",
        "SÜRÜCÜ": "ad_soyad",
        "TELEFON": "telefon",
        "TC KİMLİK NO": "tc",
        "SON NOKTA": "son_nokta",
        "FATURA MÜŞTERİSİ": "fatura_musterisi",
        "YÜKLEYEN MÜŞTERİ": "yukleyen_musteri__tmp",
        "YÜKLEME İL": "yukleme_il__tmp",
        "YÜKLEME İLÇE": "yukleme_ilce__tmp",
        "TONAJ": "tonaj",
        "TAHLİYE MÜŞTERİ": "tahliye_musteri__tmp",
        "TAHLİYE İL": "tahliye_il",
        "TAHLİYE İLÇE": "tahliye_ilce__tmp",
        "NOKTA SAYISI": "nokta_sayisi__tmp",
        "FİYAT": "fiyat__tmp",
    };

    const parseDateLike = (v) => {
        if (!v) return null;
        if (typeof v === "string" && v.includes(".")) {
            const [g, a, y] = v.split(".");
            if (y && a && g) return `${y}-${a.padStart(2, "0")}-${g.padStart(2, "0")}`;
        }
        if (typeof v === "number") {
            const dec = XLSX?.SSF?.parse_date_code ? XLSX.SSF.parse_date_code(v) : null;
            if (dec) {
                const y = String(dec.y).padStart(4, "0");
                const m = String(dec.m).padStart(2, "0");
                const d = String(dec.d).padStart(2, "0");
                return `${y}-${m}-${d}`;
            }
        }
        try {
            const d = new Date(v);
            if (!isNaN(d)) return d.toISOString().slice(0, 10);
        } catch { }
        return null;
    };

    const toNumber = (v) => {
        if (v === null || v === undefined || v === "") return null;
        const n = parseFloat(String(v).replace(",", "."));
        return isNaN(n) ? null : n;
    };


    /* ---------- keyboard shortcuts ---------- */
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                if (perms.pln_save) {
                    e.preventDefault();
                    handleKaydet();
                }
            }
            if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "f") {
                if (document.activeElement?.tagName !== "INPUT") {
                    e.preventDefault();
                    searchRef.current?.focus();
                }
            }
            if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "n") {
                if (document.activeElement?.tagName !== "INPUT") {
                    e.preventDefault();
                    openPlakaDialog();
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [perms.pln_save]);

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
            const { son_nokta, bolge } = normalizeSonNoktaAndRegion(v.son_nokta);
            const tarih = v.tarih || getTodayISO();
            const varis_tarihi = v.varis_tarihi || v.tarih || tarih;
            const _rowId = v.id ?? v.sefer_no ?? `tmp-${Date.now()}-${index}`;
            return { ...v, son_nokta, bolge: bolge || v.bolge || "", tarih, varis_tarihi, _rowId };
        });

        setRows(enriched);
        setFilteredRows(enriched);
        setBolgeler([...new Set(enriched.map((r) => r.bolge).filter(Boolean))]);

        const plakalarFromRows = Array.from(
            new Map(
                enriched
                    .filter((r) => r?.plaka)
                    .map((r) => [plakaKey(r.plaka), r.plaka])
            ).values()
        );
        setPlakalar(plakalarFromRows);

        lastSavedSnapshot.current = JSON.stringify(enriched);
        setLoading(false);
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

    // rows → plaka seçenekleri ve seçili plaka tutarlılığı
    useEffect(() => {
        const opts = Array.from(
            new Map(
                (rows || [])
                    .filter((r) => r?.plaka)
                    .map((r) => [plakaKey(r.plaka), r.plaka])
            ).values()
        );
        setPlakalar(opts);

        setPlakaFilter((prev) =>
            (prev || []).filter((v) => opts.some((o) => plakaKey(o) === plakaKey(v)))
        );
    }, [rows]);

    /* ---------- filtering ---------- */
    useEffect(() => {
        let r = [...rows];
        if (plakaFilter?.length) {
            const secimler = new Set(plakaFilter.map(plakaKey));
            r = r.filter((x) => secimler.has(plakaKey(x.plaka)));
        }
        if (bolgeFilter?.length) r = r.filter((x) => bolgeFilter.includes(x.bolge || ""));
        if (debouncedSearch) {
            const s = debouncedSearch.toLowerCase();
            r = r.filter((x) =>
                Object.values(x || {}).some((v) => String(v ?? "").toLowerCase().includes(s))
            );
        }
        setFilteredRows(r);
    }, [rows, plakaFilter, bolgeFilter, debouncedSearch]);

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

    const buildRowFromExcel = (obj) => {
        const tarih = parseDateLike(obj.tarih ?? obj["TARİH"] ?? obj["Tarih"]);
        const varis_tarihi =
            parseDateLike(
                obj.varis_tarihi ??
                obj["VARIŞ TARİHİ"] ??
                obj["VARIS TARIHI"] ??
                obj["VARİŞ TARİH"] ??
                obj["TARİH_2"]
            ) || null;

        const yukleme_noktasi_parts = [
            obj.yukleyen_musteri__tmp,
            obj.yukleme_il__tmp,
            obj.yukleme_ilce__tmp,
        ].filter(Boolean);

        const tahliye_noktasi_parts = [
            obj.tahliye_musteri__tmp,
            obj.tahliye_ilce__tmp,
        ].filter(Boolean);

        const rawSon = obj.tahliye_il || obj.son_nokta || "";
        const { son_nokta, bolge } = normalizeSonNoktaAndRegion(rawSon);

        const base = {
            sefer_no: obj.sefer_no ?? "",
            sevk_no: obj.sevk_no ?? "",
            tarih: tarih || getTodayISO(),
            varis_tarihi: varis_tarihi || tarih || getTodayISO(),
            plaka: obj.plaka ?? "",
            ad_soyad: obj.ad_soyad ?? "",
            telefon: obj.telefon ?? "",
            tc: obj.tc ?? "",
            son_nokta,
            fatura_musterisi: obj.fatura_musterisi ?? "",
            yukleme_noktasi: yukleme_noktasi_parts.join(" / "),
            tahliye_noktasi: tahliye_noktasi_parts.join(" / "),
            tahliye_il: obj.tahliye_il ?? "",
            tonaj: toNumber(obj.tonaj)?.toString() ?? "",
            bir_onceki_is: "",
            bolge,
        };

        Object.keys(base).forEach((k) => (base[k] === "" ? (base[k] = null) : null));

        return {
            ...base,
            _rowId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        };
    };

    const parseWorkbookToRows = (wb) => {
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
        if (!aoa.length) return [];

        const headersRaw = (aoa[0] || []).map((h) => normalizeHeader(h));
        let tarihCount = 0;

        const headerKeys = headersRaw.map((h) => {
            if (h === "TARİH") {
                tarihCount += 1;
                return tarihCount === 1 ? "tarih" : "TARİH_2";
            }
            return headerMap[h] || null;
        });

        const body = aoa.slice(1);
        const tempObjects = body
            .filter((row) => row.some((c) => c !== null && c !== undefined && String(c).trim() !== ""))
            .map((row) => {
                const obj = {};
                headerKeys.forEach((k, idx) => {
                    if (!k) return;
                    obj[k] = row[idx];
                });
                if (obj["TARİH_2"] && !obj.varis_tarihi) obj.varis_tarihi = obj["TARİH_2"];
                if (obj["TC KİMLİK NO"] && !obj.tc) obj.tc = obj["TC KİMLİK NO"];
                return obj;
            });

        return tempObjects.map(buildRowFromExcel);
    };

    /* ---------- dosya içe aktar ---------- */
    const handleFiles = async (files) => {
        if (!perms.pln_import_excel) {
            setSnack({ open: true, msg: "Dosya içe aktarma yetkiniz yok.", severity: "warning" });
            return;
        }

        const file = files?.[0];
        if (!file) return;

        const ext = "." + file.name.split(".").pop().toLowerCase();
        if (!acceptedExts.includes(ext)) {
            setSnack({ open: true, msg: "Desteklenmeyen dosya türü.", severity: "warning" });
            return;
        }

        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: "array" });
            const importedRows = parseWorkbookToRows(wb);

            if (!importedRows.length) {
                setSnack({ open: true, msg: "Dosyada veri bulunamadı.", severity: "info" });
                return;
            }

            setRows(importedRows);
            setFilteredRows(importedRows);

            const yeniBolgeler = [...new Set(importedRows.map((r) => r.bolge).filter(Boolean))];
            const yeniPlakalar = Array.from(
                new Map(
                    importedRows
                        .filter((r) => r.plaka)
                        .map((r) => [plakaKey(r.plaka), r.plaka])
                ).values()
            );
            setPlakalar(yeniPlakalar);
            setBolgeler(yeniBolgeler);

            setPlakaFilter([]);
            setBolgeFilter([]);
            setSearch("");

            setSnack({
                open: true,
                msg: `${yeniPlakalar.length} plaka değeri getirildi. (Toplam ${importedRows.length} satır)`,
                severity: "success",
            });
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "İçe aktarma sırasında hata oluştu.", severity: "error" });
        } finally {
            setDragActive(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); if (!dragActive) setDragActive(true); };
    const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
    const onDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const files = e.dataTransfer?.files;
        if (files?.length) handleFiles(files);
    };

    /* ---------- kaydet (insert/update) ---------- */
    const handleKaydet = async () => {
        if (!perms.pln_save) {
            setSnack({ open: true, msg: "Kaydet yetkiniz yok.", severity: "warning" });
            return;
        }
        setSaving(true);

        const { error: delErr } = await supabase
            .from("planlama")
            .delete()
            .not("id", "is", null);
        if (delErr) {
            console.error(delErr);
            setSaving(false);
            setSnack({ open: true, msg: "Silme sırasında hata oluştu.", severity: "error" });
            return;
        }

        const normalizeRow = (item) => {
            const payload = { ...item };
            delete payload._rowId;
            delete payload.id;

            ["tarih", "varis_tarihi"].forEach((k) => {
                if (!payload[k]) payload[k] = getTodayISO();
                if (typeof payload[k] === "string" && payload[k].includes(".")) {
                    const [g, a, y] = payload[k].split(".");
                    payload[k] = `${y}-${a.padStart(2, "0")}-${g.padStart(2, "0")}`;
                }
            });

            const { son_nokta, bolge } = normalizeSonNoktaAndRegion(payload.son_nokta);
            payload.son_nokta = son_nokta;
            payload.bolge = bolge || payload.bolge || null;

            Object.keys(payload).forEach((k) => {
                if (payload[k] === undefined || payload[k] === "") payload[k] = null;
            });
            return payload;
        };

        const map = new Map();
        for (const r of filteredRows) {
            const p = normalizeRow(r);
            const key = `${p.plaka ?? ""}|${p.tarih ?? ""}`;
            map.set(key, p);
        }
        const payloads = Array.from(map.values());
        const dropped = filteredRows.length - payloads.length;

        const chunkSize = 500;
        try {
            for (let i = 0; i < payloads.length; i += chunkSize) {
                const slice = payloads.slice(i, i + chunkSize);
                const { error: upErr } = await supabase
                    .from("planlama")
                    .upsert(slice, { onConflict: "plaka,tarih" });
                if (upErr) throw upErr;
            }
        } catch (e) {
            console.error("Upsert hatası:", e?.message);
            setSaving(false);
            setSnack({ open: true, msg: "Yazma sırasında hata oluştu.", severity: "error" });
            return;
        }

        await fetchData();
        setSaving(false);
        setSnack({
            open: true,
            msg:
                dropped > 0
                    ? `Tablo ekrandakiyle değiştirildi. ${dropped} yinelenen (plaka,tarih) atlandı.`
                    : "Tablo ekrandakiyle değiştirildi.",
            severity: "success",
        });
    };

    /* ---------- Excel Aktar ---------- */
    const handleExportExcel = () => {
        if (!perms.pln_export_excel) {
            setSnack({ open: true, msg: "Excel aktarım yetkiniz yok.", severity: "warning" });
            return;
        }
        const exportRows = filteredRows.map((r) => ({
            "Sefer No": r.sefer_no ?? "",
            "Sevk No": r.sevk_no ?? "",
            "Tarih": r.tarih ?? "",
            "Varış Tarihi": r.varis_tarihi ?? "",
            "Plaka": r.plaka ?? "",
            "Ad Soyad": r.ad_soyad ?? "",
            "Telefon": r.telefon ?? "",
            "TC": r.tc ?? "",
            "Son Nokta": r.son_nokta ?? "",
            "Fatura Müşterisi": r.fatura_musterisi ?? "",
            "Yükleme Noktası": r.yukleme_noktasi ?? "",
            "Tahliye Noktası": r.tahliye_noktasi ?? "",
            "Tahliye İl": r.tahliye_il ?? "",
            "Tonaj": r.tonaj ?? "",
            "Bir Önceki İş": r.bir_onceki_is ?? "",
            "Bölge": r.bolge ?? "",
        }));
        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Planlama");
        XLSX.writeFile(wb, `planlama_${getTodayISO()}.xlsx`);
    };

    /* ---------- geri al ---------- */
    const revertRows = () => {
        try {
            const snap = JSON.parse(lastSavedSnapshot.current || "[]");
            setRows(snap);
            setSnack({ open: true, msg: "Yerel değişiklikler geri alındı.", severity: "info" });
        } catch { }
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

    const saveYeniPlaka = () => {
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
        setRows((prev) => [{ ...yeni, _rowId }, ...prev]);
        setPlakaDialogOpen(false);
        setSnack({ open: true, msg: "Yeni satır eklendi (lokal). Kaydet ile yazılır.", severity: "success" });
    };

    /* ---------- Sefer Detay Panelini aç ---------- */
    const openSeferDetay = useCallback((row) => {
        setDetayContext(row);
        setDetayOpen(true);
    }, []);

    /* ---------- Sipariş Analiz panelini aç ---------- */
    const openSiparisAnaliz = useCallback((row) => {
        setAnalizContext(row);
        setAnalizOpen(true);
    }, []);

    /* ---------- bölge sayıları ---------- */
    const bolgeCounts = useMemo(() => {
        const m = {};
        for (const r of filteredRows) {
            const b = r.bolge || "—";
            m[b] = (m[b] || 0) + 1;
        }
        return m;
    }, [filteredRows]);

    const toggleBolgeFilter = (b) => {
        setBolgeFilter((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
    };

    /* ---------- tamamlama yüzdesi ---------- */
    const completenessOf = (row) => {
        const keys = [
            "sefer_no", "tarih", "plaka", "ad_soyad", "telefon", "tc",
            "varis_tarihi", "son_nokta", "tahliye_il", "tonaj",
        ];
        const filled = keys.filter((k) => !!(row?.[k] ?? "")).length;
        return Math.round((filled / keys.length) * 100);
    };

    /* ---------- DataGrid kolonları ---------- */
    const columns = useMemo(() => {
        const textCol = (field, headerName, width = 160, editable = true, extra = {}) => ({
            field,
            headerName,
            width,
            editable,
            ...extra,
        }); // <-- burada bitecek ve ; gelecek

        return [
            {
                field: "actions",
                headerName: "İşlem",
                width: 200,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Detay">
                            <IconButton size="small" onClick={() => openSiparisAnaliz(params.row)}>
                                <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Sil (Del)">
                            <IconButton size="small" onClick={() => handleSil(params.row._rowId)}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                ),
            },
            textCol("sefer_no", "Sefer No", 140),
            textCol("sevk_no", "Sevk No", 140),
            textCol("tarih", "Tarih", 120, true, {
                renderCell: (params) => <>{formatDateTR(params.row?.tarih)}</>,
                valueGetter: (_, row) => row?.tarih ?? null,
            }),
            textCol("plaka", "Plaka", 120, false),
            textCol("ad_soyad", "Ad Soyad", 160, false),
            textCol("telefon", "Telefon", 140, false),
            textCol("tc", "TC", 120, false),
            textCol("varis_tarihi", "Varış Tarihi", 120, true, {
                renderCell: (params) => <>{formatDateTR(params.row?.varis_tarihi)}</>,
                valueGetter: (_, row) => row?.varis_tarihi ?? null,
            }),
            textCol("son_nokta", "Son Nokta", 160),
            textCol("fatura_musterisi", "Fatura Müşterisi", 180),
            textCol("yukleme_noktasi", "Yükleme Noktası", 200),
            textCol("tahliye_noktasi", "Tahliye Noktası", 200),
            textCol("tahliye_il", "Tahliye İl", 140),
            textCol("tonaj", "Tonaj", 100, true, { align: "right", headerAlign: "right" }),
            textCol("bir_onceki_is", "Bir Önceki İş", 220, false),
            {
                field: "bolge",
                headerName: "Bölge",
                width: 170,
                editable: false,
                valueGetter: (value, row) => row?.bolge ?? "",
                renderCell: (params) =>
                    params.value ? (
                        <Chip size="small" label={params.value} color={bolgeChip(params.value)} variant="filled" />
                    ) : (
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>—</Typography>
                    ),
            },
            {
                field: "tamam",
                headerName: "Doluluk",
                width: 120,
                sortable: false,
                filterable: false,
                valueGetter: (value, row) => completenessOf(row),
                renderCell: (params) => (
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <CircularProgress variant="determinate" size={20} value={params.value} />
                        <Typography variant="caption">%{params.value}</Typography>
                    </Stack>
                ),
            },
        ];
    }, [openSeferDetay, openSiparisAnaliz]);

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
        const { son_nokta, bolge } = normalizeSonNoktaAndRegion(newRow.son_nokta);
        newRow.son_nokta = son_nokta;
        newRow.bolge = bolge;
    }

    ["tarih", "varis_tarihi"].forEach((k) => {
        const val = newRow?.[k];
        if (typeof val === "string" && /\b\d{1,2}\.\d{1,2}\.\d{4}\b/.test(val)) {
            const iso = parseDateLike(val);
            if (iso) newRow[k] = iso;
        }
    });

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

// Filtreleri temizle
const clearFilters = () => {
    setPlakaFilter([]);
    setBolgeFilter([]);
    setPlakaInput("");
    setBolgeInput("");
    setSearch("");
};

// Drawer helpers
const openDrawer = (row) => {
    setActiveEditRow(row);
    setDrawerOpen(true);
};
const applyDrawerChanges = () => {
    if (!activeEditRow) return;
    setRows((prev) => prev.map((r) => (r._rowId === activeEditRow._rowId ? activeEditRow : r)));
    setDrawerOpen(false);
    setSnack({ open: true, msg: "Değişiklikler uygulandı (lokal)", severity: "success" });
};

return (
    <Box
        onDragOver={perms.pln_import_excel ? onDragOver : undefined}
        onDragLeave={perms.pln_import_excel ? onDragLeave : undefined}
        onDrop={perms.pln_import_excel ? onDrop : undefined}
        sx={{
            height: "100dvh",
            display: "grid",
            gridTemplateRows: "auto auto auto 1fr auto",
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
                </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap">
                <Tooltip title={perms.pln_save ? "Kaydet" : "Yetkiniz yok"}>
                    <span>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleKaydet}
                            disabled={!perms.pln_save}
                        >
                            Kaydet
                        </Button>
                    </span>
                </Tooltip>

                <Tooltip title={perms.pln_update ? "Güncelle" : "Yetkiniz yok"}>
                    <span>
                        <Button
                            variant="outlined"
                            startIcon={<TuneIcon />}
                            onClick={() => (perms.pln_update ? setGuncelleDialogOpen(true) : null)}
                            disabled={!perms.pln_update}
                        >
                            Güncelle
                        </Button>
                    </span>
                </Tooltip>

                <Tooltip title={perms.pln_export_excel ? "Excel Aktar" : "Yetkiniz yok"}>
                    <span>
                        <Button
                            variant="outlined"
                            startIcon={<CheckCircleIcon />}
                            onClick={handleExportExcel}
                            disabled={!perms.pln_export_excel}
                        >
                            Excel Aktar
                        </Button>
                    </span>
                </Tooltip>
            </Stack>
        </Stack>

        {/* Bölge panelleri */}
        <Box sx={{ overflowX: "auto", pb: 1 }}>
            <Stack direction="row" spacing={1.25} sx={{ minWidth: 560 }}>
                {Object.entries(bolgeCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([b, count]) => (
                        <Paper
                            key={b}
                            onClick={() => {
                                if (isKocaeli(b)) {
                                    setAnalizContext({ bolge: b });
                                    setAnalizOpen(true);
                                } else {
                                    toggleBolgeFilter?.(b);
                                }
                            }}
                            sx={{
                                p: 1.25,
                                minWidth: 220,
                                borderRadius: 2,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1,
                                cursor: "pointer",
                                background: `linear-gradient(180deg, ${alpha("#ffffff", 0.06)} 0%, ${alpha("#ffffff", 0.03)} 100%)`,
                                border: "1px solid rgba(255,255,255,0.06)",
                                boxShadow: `inset 0 1px 0 ${alpha("#fff", 0.08)}`,
                                transition: "transform .12s ease",
                                "&:hover": { transform: "translateY(-2px)" },
                            }}
                        >
                            <Stack sx={{ minWidth: 0 }}>
                                <Typography variant="overline" sx={{ opacity: 0.7 }}>
                                    Bölge
                                </Typography>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={800}
                                    noWrap
                                    title={b}
                                    sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                                >
                                    {b}
                                    <Chip
                                        size="small"
                                        label="filtrele"
                                        color={bolgeChip(b)}
                                        variant="outlined"
                                        sx={{ ml: 0.5 }}
                                    />
                                </Typography>
                            </Stack>
                            <Stack alignItems="flex-end">
                                <Typography variant="overline" sx={{ opacity: 0.7 }}>
                                    Adet
                                </Typography>
                                <Typography variant="h5" fontWeight={800}>
                                    {count}
                                </Typography>
                            </Stack>
                        </Paper>
                    ))}
            </Stack>
        </Box>

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
            <Autocomplete
                multiple
                options={(plakalar || []).filter(Boolean)}
                value={(plakaFilter || []).filter(Boolean)}
                onChange={(_, v) => setPlakaFilter((v || []).filter(Boolean))}
                inputValue={plakaInput}
                onInputChange={(_, v) => setPlakaInput(v ?? "")}
                getOptionLabel={(opt) => String(opt ?? "")}
                isOptionEqualToValue={(opt, val) => {
                    if (opt == null || val == null) return opt === val;
                    return plakaKey(opt) === plakaKey(val);
                }}
                size="small"
                renderInput={(params) => (
                    <TextField {...params} label="Plaka" placeholder="Seçin" sx={{ minWidth: 220 }} />
                )}
            />

            <Autocomplete
                multiple
                options={(bolgeler || []).filter(Boolean)}
                value={(bolgeFilter || []).filter(Boolean)}
                onChange={(_, v) => setBolgeFilter((v || []).filter(Boolean))}
                inputValue={bolgeInput}
                onInputChange={(_, v) => setBolgeInput(v ?? "")}
                getOptionLabel={(opt) => String(opt ?? "")}
                isOptionEqualToValue={(opt, val) => opt === val}
                size="small"
                renderInput={(params) => (
                    <TextField {...params} label="Bölge" placeholder="Seçin" sx={{ minWidth: 220 }} />
                )}
            />

            <Chip label={`${filteredRows.length} kayıt`} color="default" variant="outlined" sx={{ ml: 0.5 }} />

            <Box sx={{ flex: 1 }} />

            <TextField
                inputRef={searchRef}
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ara… (kısayol: F)"
                sx={{ minWidth: 260 }}
            />

            <Tooltip title="Filtreleri temizle">
                <span>
                    <Button
                        onClick={clearFilters}
                        variant="outlined"
                        startIcon={<CleaningServicesIcon />}
                        disabled={!plakaFilter.length && !bolgeFilter.length && !search}
                    >
                        Temizle
                    </Button>
                </span>
            </Tooltip>

            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => handleFiles(e.target.files)}
                disabled={!perms.pln_import_excel}
            />
            <Tooltip title={perms.pln_import_excel ? "Dosya İçe Aktar" : "Yetkiniz yok"}>
                <span>
                    <Button
                        variant="outlined"
                        onClick={() => perms.pln_import_excel ? fileInputRef.current?.click() : null}
                        disabled={!perms.pln_import_excel}
                    >
                        Dosya İçe Aktar
                    </Button>
                </span>
            </Tooltip>
        </Paper>

        {/* DataGrid */}
        <Paper
            sx={{
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,0.06)",
                overflow: "hidden",
                minHeight: 0,
                display: "grid",
                position: "relative",
            }}
        >
            {loading && <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0 }} />}
            <DataGrid
                rows={filteredRows}
                columns={orderedColumns}
                getRowId={(r) => r._rowId}
                loading={loading}
                disableRowSelectionOnClick
                density="compact"
                rowHeight={42}
                columnHeaderHeight={44}
                checkboxSelection={false}
                editMode="row"
                processRowUpdate={processRowUpdate}
                onProcessRowUpdateError={(e) => {
                    console.error(e);
                    setSnack({ open: true, msg: "Satır güncellenemedi.", severity: "error" });
                }}
                onRowUpdateCommit={handleRowUpdateCommit}
                onRowDoubleClick={(p) => openDrawer(p.row)}
                disableColumnMenu={false}
                columnReorder
                disableColumnReorder={false}
                onColumnOrderChange={onColumnOrderChange}
                getRowClassName={(params) => {
                    const c = (params.row.bolge || "").toString();
                    if (c.includes("Doğu")) return "row-east";
                    if (c.includes("Ege")) return "row-aegean";
                    if (c.includes("Marmara") || c.includes("Kocaeli")) return "row-marmara";
                    if (c.includes("Karadeniz")) return "row-blacksea";
                    if (c.includes("İç Anadolu")) return "row-central";
                    return "";
                }}
                components={{
                    NoRowsOverlay: NoRowsOverlay,
                    LoadingOverlay: BusyOverlay,
                }}
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
                    "& .MuiDataGrid-row:hover .MuiDataGrid-cell": {
                        backgroundColor: alpha("#22D3EE", 0.06),
                    },
                    "& .row-east .MuiDataGrid-cell": { boxShadow: `inset 3px 0 0 ${alpha("#ef4444", 0.9)}` },
                    "& .row-aegean .MuiDataGrid-cell": { boxShadow: `inset 3px 0 0 ${alpha("#22c55e", 0.9)}` },
                    "& .row-marmara .MuiDataGrid-cell": { boxShadow: `inset 3px 0 0 ${alpha("#3b82f6", 0.9)}` },
                    "& .row-blacksea .MuiDataGrid-cell": { boxShadow: `inset 3px 0 0 ${alpha("#8b5cf6", 0.9)}` },
                    "& .row-central .MuiDataGrid-cell": { boxShadow: `inset 3px 0 0 ${alpha("#f59e0b", 0.9)}` },
                }}
            />
        </Paper>

        {/* Sticky Save Bar */}
        {isDirty && (
            <Paper
                elevation={0}
                sx={{
                    position: "sticky",
                    bottom: 0,
                    p: 1,
                    borderRadius: 2,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: `linear-gradient(180deg, ${alpha("#0ea5e9", 0.16)} 0%, ${alpha("#0ea5e9", 0.08)} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontWeight={700}>Kaydedilmemiş değişiklikler var</Typography>
                    <Chip size="small" label={`${rows.length} satır`} />
                </Stack>
                <Stack direction="row" spacing={1}>
                    <Button onClick={revertRows}>Geri Al</Button>
                    <Tooltip title={perms.pln_save ? "Kaydet" : "Yetkiniz yok"}>
                        <span>
                            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleKaydet} disabled={!perms.pln_save}>
                                Kaydet
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
            </Paper>
        )}

        {/* Sağ alt hızlı ekleme (FAB) */}
        <Fab
            color="primary"
            onClick={openPlakaDialog}
            sx={{ position: "fixed", right: 24, bottom: 24, boxShadow: 6 }}
            aria-label="yeni satır"
        >
            <AddIcon />
        </Fab>

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
                        placeholder="05xx xxx xx xx"
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
                <Button
                    variant="contained"
                    onClick={() => {
                        if (!perms.pln_update) {
                            setSnack({ open: true, msg: "Güncelle yetkiniz yok.", severity: "warning" });
                            return;
                        }
                        const guncellenmis = filteredRows.map((item) => {
                            const { son_nokta, bolge } = normalizeSonNoktaAndRegion(item.tahliye_il || "");
                            const bir_onceki_is = [item.fatura_musterisi, item.yukleme_noktasi, item.tahliye_noktasi]
                                .filter(Boolean)
                                .join(" / ");
                            return {
                                ...item,
                                bir_onceki_is,
                                son_nokta,
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
                    }}
                >
                    Evet, Güncelle
                </Button>
            </DialogActions>
        </Dialog>

        {/* Hızlı Düzenleme Çekmecesi */}
        <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}
            PaperProps={{ sx: { width: 420, p: 2, gap: 1 } }}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" fontWeight={800}>Hızlı Düzenle</Typography>
                <IconButton onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton>
            </Stack>
            <Divider sx={{ my: 1 }} />
            {activeEditRow ? (
                <Stack spacing={1.25}>
                    {[
                        ["sefer_no", "Sefer No"],
                        ["sevk_no", "Sevk No"],
                        ["tarih", "Tarih"],
                        ["varis_tarihi", "Varış Tarihi"],
                        ["plaka", "Plaka"],
                        ["ad_soyad", "Ad Soyad"],
                        ["telefon", "Telefon"],
                        ["tc", "TC"],
                        ["son_nokta", "Son Nokta"],
                        ["tahliye_il", "Tahliye İl"],
                        ["fatura_musterisi", "Fatura Müşterisi"],
                        ["yukleme_noktasi", "Yükleme Noktası"],
                        ["tahliye_noktasi", "Tahliye Noktası"],
                        ["tonaj", "Tonaj"],
                        ["bir_onceki_is", "Bir Önceki İş"],
                    ].map(([k, label]) => (
                        <TextField
                            key={k}
                            label={label}
                            value={activeEditRow?.[k] ?? ""}
                            onChange={(e) => {
                                const val = e.target.value;
                                setActiveEditRow((r) => {
                                    const next = { ...r, [k]: val };
                                    if (k === "son_nokta") {
                                        const { son_nokta, bolge } = normalizeSonNoktaAndRegion(val);
                                        next.son_nokta = son_nokta;
                                        next.bolge = bolge;
                                    }
                                    return next;
                                });
                            }}
                            size="small"
                        />
                    ))}

                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>Doluluk:</Typography>
                        <CircularProgress variant="determinate" value={completenessOf(activeEditRow)} size={22} />
                        <Typography variant="caption">%{completenessOf(activeEditRow)}</Typography>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                        <Button onClick={() => setDrawerOpen(false)}>Kapat</Button>
                        <Button variant="contained" onClick={applyDrawerChanges}>Uygula</Button>
                    </Stack>
                </Stack>
            ) : (
                <Typography>Bir satır seçin…</Typography>
            )}
        </Drawer>

        {/* Sefer Detay Panel (lazy) */}
        <Suspense fallback={null}>
            {detayOpen && (
                <SeferDetayPanel
                    open={detayOpen}
                    onClose={() => setDetayOpen(false)}
                    sefer={detayContext}
                    row={detayContext}
                    data={detayContext}
                    plaka={primaryPlaka(detayContext?.plaka)}
                />
            )}
        </Suspense>

        {/* Sipariş Analiz — Merkezde Modern Modal */}
        <Dialog
            open={analizOpen}
            onClose={() => setAnalizOpen(false)}
            fullWidth
            maxWidth="lg"
            PaperProps={{
                sx: (t) => ({
                    borderRadius: 3,
                    overflow: "hidden",
                    backdropFilter: "blur(8px)",
                    background:
                        "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(2,6,23,0.96) 100%)",
                    boxShadow: `0 24px 64px ${alpha("#000", 0.55)}`,
                    border: "1px solid rgba(255,255,255,0.06)",
                }),
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                    px: 2,
                    py: 1.25,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    background:
                        "linear-gradient(180deg, rgba(34,211,238,0.08) 0%, rgba(34,211,238,0.02) 100%)",
                }}
            >
                <Typography variant="h6" fontWeight={800}>
                    {`Sipariş Analiz${analizContext?.bolge ? " — " + analizContext.bolge : ""}`}
                </Typography>
                <IconButton onClick={() => setAnalizOpen(false)} size="small">
                    <CloseIcon />
                </IconButton>
            </Stack>

            <Box sx={{ p: 2.25 }}>
                <Suspense
                    fallback={
                        <Box sx={{ p: 3, textAlign: "center" }}>
                            <CircularProgress size={26} />
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Yükleniyor…
                            </Typography>
                        </Box>
                    }
                >
                    <SiparisAnaliz
                        open={analizOpen}
                        onClose={() => setAnalizOpen(false)}
                        sefer={analizContext}
                        row={analizContext}
                        data={analizContext}
                        plaka={primaryPlaka(analizContext?.plaka)}
                    />
                </Suspense>
            </Box>
        </Dialog>

        {/* Drag & Drop Overlay */}
        {dragActive && perms.pln_import_excel && (
            <Box
                sx={{
                    position: "fixed",
                    inset: 0,
                    zIndex: (t) => t.zIndex.modal + 1,
                    backgroundColor: alpha("#000", 0.5),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "3px dashed rgba(255,255,255,0.5)",
                }}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <Stack spacing={1} alignItems="center">
                    <Typography variant="h6" fontWeight={800}>Dosyayı buraya bırak</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        .xlsx, .xls veya .csv desteklenir
                    </Typography>
                </Stack>
            </Box>
        )}

        {/* Snackbar */}
        <Snackbar
            open={snack.open}
            autoHideDuration={3000}
            onClose={() => setSnack((s) => ({ ...s, open: false, action: null }))}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
            <Alert
                onClose={() => setSnack((s) => ({ ...s, open: false, action: null }))}
                severity={snack.severity}
                variant="filled"
                sx={{ width: "100%" }}
                action={snack.action}
            >
                {snack.msg}
            </Alert>
        </Snackbar>
    </Box>
);
}
