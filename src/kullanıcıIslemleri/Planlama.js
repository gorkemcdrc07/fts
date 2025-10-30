import React, { useEffect, useMemo, useRef, useState, useCallback, Suspense, lazy } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabase } from "../supabaseClient";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

import dayjs from "dayjs";
import "dayjs/locale/tr";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

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
    Select,
    MenuItem,
    FormControl,
    InputLabel,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
// gridClasses, koşullu satır stilini uygulamak için gereklidir
import { DataGrid, gridClasses } from "@mui/x-data-grid";

// MUI Icons - Import yolu düzeltildi
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import TuneIcon from "@mui/icons-material/Tune";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EditNoteIcon from "@mui/icons-material/EditNote";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import BoltIcon from "@mui/icons-material/Bolt";

import usePermissions from "../auth/usePermissions";

/* ---------------- Sefer Detay Panel (lazy) ---------------- */
const SeferDetayPanel = lazy(() => import("./planlamaDetay/SeferDetayPanel"));
const SiparisAnaliz = lazy(() => import("./planlamaDetay/SiparisAnaliz"));


// Dayjs eklentileri (Import'lar bittikten sonra buraya taşındı)
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);


/* ---------------- helpers ---------------- */

// TR uppercase
const toUpperTr = (s) => (s || "").toLocaleUpperCase("tr-TR").trim();
const getTodayISO = () => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

// Plaka normalize: Sadece harf ve rakamları alır. (DB eşleşmesi için kritik)
const plakaKey = (s) => toUpperTr(String(s || "")).replace(/[^A-Z0-9]/g, "");
const primaryPlaka = (s) => toUpperTr(String(s || "")).split("-")[0].trim();

// ... Diğer helpers
const STATU_LISTESI = [
    "Planlandı",
    "Yolda",
    "Yüklemede",
    "Tahliyede",
    "Tamamlandı",
    "İptal",
];

const statuRenkMap = (statu) => {
    // Statü değerini büyük harfe çevirerek eşleştirme
    const normalizedStatu = toUpperTr(statu);
    switch (normalizedStatu) {
        case "PLANLANDI":
            return { color: "warning", hex: "#FCD34D" }; // Sarı
        case "YOLDA":
            return { color: "info", hex: "#22D3EE" }; // Mavi
        case "YÜKLEMEDE":
            return { color: "primary", hex: "#E879F9" }; // Mor
        case "TAHLİYEDE":
            return { color: "secondary", hex: "#818CF8" }; // Açık Mavi
        case "TAMAMLANDI":
            return { color: "success", hex: "#4ADE80" }; // Yeşil
        case "İPTAL":
            return { color: "error", hex: "#EF4444" }; // Kırmızı
        default:
            return { color: "default", hex: "#C8D1E6" };
    }
};

// "YYYY-MM-DD" → "GG.AA.YYYY"
const formatDateTR = (val) => {
    if (!val) return "";
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        const [y, m, d] = val.split("T")[0].split("-");
        return `${d}.${m}.${y}`;
    }
    try {
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return String(val);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const g = String(d.getDate()).padStart(2, "0");
        return `${g}.${m}.${y}`;
    } catch {
        return String(val);
    }
};

const useDebounced = (value, delay = 250) => {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
};
const isKocaeli = (name) => toUpperTr(name).includes("KOCAELİ");

const ilToBolgeMap = {
    ADANA: "Doğu Bölgesi", ADIYAMAN: "Doğu Bölgesi", AFYON: "İç Anadolu Bölgesi", AĞRI: "Doğu Bölgesi", AMASYA: "Karadeniz Bölgesi", ANKARA: "İç Anadolu Bölgesi", ANTALYA: "Ege Bölgesi", ARTVİN: "Karadeniz Bölgesi", AYDIN: "Ege Bölgesi", BALIKESİR: "Ege Bölgesi", BARTIN: "Karadeniz Bölgesi", BATMAN: "Doğu Bölgesi", BAYBURT: "Karadeniz Bölgesi", BİLECİK: "İç Anadolu Bölgesi", BİNGÖL: "Doğu Bölgesi", BİTLİS: "Doğu Bölgesi", BOLU: "Karadeniz Bölgesi", BURDUR: "Ege Bölgesi", BURSA: "Ege Bölgesi", ÇANAKKALE: "Trakya Bölgesi", ÇANKIRI: "İç Anadolu Bölgesi", ÇORUM: "İç Anadolu Bölgesi", DENİZLİ: "Ege Bölgesi", DİYARBAKIR: "Doğu Bölgesi", DÜZCE: "Karadeniz Bölgesi", EDİRNE: "Trakya Bölgesi", ELAZIĞ: "Doğu Bölgesi", ERZİNCAN: "Doğu Bölgesi", ERZURUM: "Doğu Bölgesi", ESKİŞEHİR: "İç Anadolu Bölgesi", GAZİANTEP: "Doğu Bölgesi", GİRESUN: "Karadeniz Bölgesi", GÜMÜŞHANE: "Karadeniz Bölgesi", HAKKARİ: "Doğu Bölgesi", HATAY: "Doğu Bölgesi", ISPARTA: "Ege Bölgesi", MERSİN: "Doğu Bölgesi", İSTANBUL: "Marmara Bölgesi", İZMİR: "Ege Bölgesi", KAHRAMANMARAŞ: "Doğu Bölgesi", KARABÜK: "Karadeniz Bölgesi", KARAMAN: "İç Anadolu Bölgesi", KARS: "Doğu Bölgesi", KASTAMONU: "Karadeniz Bölgesi", KAYSERİ: "İç Anadolu Bölgesi", KİLİS: "Doğu Bölgesi", KIRIKKALE: "İç Anadolu Bölgesi", KIRKLARELİ: "Trakya Bölgesi", KIRŞEHİR: "İç Anadolu Bölgesi", KOCAELİ: "Kocaeli Bölgesi", KONYA: "İç Anadolu Bölgesi", KÜTAHYA: "İç Anadolu Bölgesi", MALATYA: "Doğu Bölgesi", MANİSA: "Ege Bölgesi", MARDİN: "Doğu Bölgesi", MUĞLA: "Ege Bölgesi", MUŞ: "Doğu Bölgesi", NEVŞEHİR: "İç Anadolu Bölgesi", NİĞDE: "İç Anadolu Bölgesi", ORDU: "Karadeniz Bölgesi", OSMANİYE: "Doğu Bölgesi", RİZE: "Karadeniz Bölgesi", SAKARYA: "Kocaeli Bölgesi", SAMSUN: "Karadeniz Bölgesi", SİİRT: "Doğu Bölgesi", SİNOP: "Karadeniz Bölgesi", SİVAS: "İç Anadolu Bölgesi", ŞANLIURFA: "Doğu Bölgesi", ŞIRNAK: "Doğu Bölgesi", TEKİRDAĞ: "Trakya Bölgesi", TOKAT: "Karadeniz Bölgesi", TRABZON: "Karadeniz Bölgesi", TUNCELİ: "Doğu Bölgesi", UŞAK: "Ege Bölgesi", VAN: "Doğu Bölgesi", YALOVA: "Ege Bölgesi", YOZGAT: "İç Anadolu Bölgesi", ZONGULDAK: "Karadeniz Bölgesi", AKSARAY: "İç Anadolu Bölgesi",
    // İstanbul Anadolu Yakası için özel bölgeler, hepsi Kocaeli Bölgesi olarak normalize ediliyor.
    ADALAR: "Kocaeli Bölgesi", ATAŞEHİR: "Kocaeli Bölgesi", BEYKOZ: "Kocaeli Bölgesi", ÖMERLİ: "Kocaeli Bölgesi", KADIKÖY: "Kocaeli Bölgesi", KARTAL: "Kocaeli Bölgesi", MALTEPE: "Kocaeli Bölgesi", PENDİK: "Kocaeli Bölgesi", SANCAKTEPE: "Kocaeli Bölgesi", SULTANBEYLİ: "Kocaeli Bölgesi", ŞİLE: "Kocaeli Bölgesi", TUZLA: "Kocaeli Bölgesi", ÜMRANİYE: "Kocaeli Bölgesi", ÜSKÜDAR: "Kocaeli Bölgesi",
    // İstanbul Avrupa Yakası için özel bölgeler, hepsi Marmara Bölgesi olarak normalize ediliyor.
    ARNAVUTKÖY: "Marmara Bölgesi", AVCILAR: "Marmara Bölgesi", BAĞCILAR: "Marmara Bölgesi", BAHÇELİEVLER: "Marmara Bölgesi", BAKIRKÖY: "Marmara Bölgesi", BAŞAKŞEHİR: "Marmara Bölgesi", BAYRAMPAŞA: "Marmara Bölgesi", BEŞİKTAŞ: "Marmara Bölgesi", BEYLİKDÜZÜ: "Marmara Bölgesi", BEYOĞLU: "Marmara Bölgesi", BÜYÜKÇEKMECE: "Marmara Bölgesi", ÇATALCA: "Marmara Bölgesi", ESENLER: "Marmara Bölgesi", ESENYURT: "Marmara Bölgesi", EYÜP: "Marmara Bölgesi", FATİH: "Marmara Bölgesi", GAZİOSMANPAŞA: "Marmara Bölgesi", GÜNGÖREN: "Marmara Bölgesi", KAĞITHANE: "Marmara Bölgesi", KÜÇÜKÇEKMECE: "Marmara Bölgesi", SARIYER: "Marmara Bölgesi", SİLİVRİ: "Marmara Bölgesi", SULTANGAZİ: "Marmara Bölgesi", ŞİŞLİ: "Marmara Bölgesi", ZEYTİNBURNU: "Marmara Bölgesi",
};

const normalizeSonNoktaAndRegion = (raw) => {
    const u = toUpperTr(raw || "");
    let son_nokta = raw || "";

    if (u === "ANTEP") son_nokta = "GAZİANTEP";
    else if (u === "URFA") son_nokta = "ŞANLIURFA";
    else if (u === "MARAŞ") son_nokta = "KAHRAMANMARAŞ";
    else {
        // Tam il adını bulmaya çalış
        const exactMatch = Object.keys(ilToBolgeMap).find(il => toUpperTr(il) === u);
        if (exactMatch) son_nokta = exactMatch;
    }

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

function NoRowsOverlay() {
    return (
        <Stack height="100%" alignItems="center" justifyContent="center" spacing={1.25}>
            <Typography variant="h6" sx={{ opacity: 0.8 }}>
                Henüz kayıt yok
            </Typography>
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
    "statü", "sefer_no", "sevk_no", "tarih", "plaka", "ad_soyad", "telefon", "tc", "varis_tarihi",
    "son_nokta", "fatura_musterisi", "yukleme_noktasi", "tahliye_noktasi", "tahliye_il",
    "tonaj", "bir_onceki_is", "bolge",
];

// Excel Başlıklarını Veritabanı Alanlarına Eşleştirme Haritası (Genişletilmiş)
const headerMap = {
    // Statü ile ilgili olabilecek başlıklar
    "STATÜ": "statü", "DURUM": "statü", "STATUS": "statü",
    // Diğerleri
    "SEFER NO": "sefer_no", "SEVK NO": "sevk_no",
    "TARİH": "tarih", "TARİH_1": "tarih",
    "VARİŞ TARİHİ": "varis_tarihi", "VARIS TARIHI": "varis_tarihi", "VARİŞ TARİH": "varis_tarihi", "TARİH_2": "varis_tarihi",
    "PLAKA": "plaka", "SÜRÜCÜ PLAKA": "plaka",
    "SÜRÜCÜ": "ad_soyad", "AD SOYAD": "ad_soyad",
    "TELEFON": "telefon", "TEL": "telefon",
    "TC KİMLİK NO": "tc", "TC": "tc",
    "SON NOKTA": "son_nokta",
    "FATURA MÜŞTERİSİ": "fatura_musterisi",
    "YÜKLEME NOKTASI": "yukleme_noktasi",
    "TAHLİYE NOKTASI": "tahliye_noktasi",
    "TAHLİYE İL": "tahliye_il",
    "TONAJ": "tonaj", "KG/TON": "tonaj",
    // Bu alanlar şimdilik geçici olarak kullanılıp birleştirilebilir, ama temel alanları önceliyoruz.
    "YÜKLEYEN MÜŞTERİ": "yukleyen_musteri__tmp", "YÜKLEME İL": "yukleme_il__tmp", "YÜKLEME İLÇE": "yukleme_ilce__tmp",
    "TAHLİYE MÜŞTERİ": "tahliye_musteri__tmp", "TAHLİYE İLÇE": "tahliye_ilce__tmp",
};


const parseDateLike = (v) => {
    if (!v) return null;

    // 1. Excel JS sayı (seri gün) olarak döndüğünde
    if (typeof v === 'number' && v > 1) {
        try {
            // Excel'deki seri günü doğru şekilde DayJS'e aktar
            return dayjs('1899-12-30').add(v, 'day').format('YYYY-MM-DD');
        } catch (e) {
            console.error("Number Date Parse Error:", e);
            return null;
        }
    }

    // 2. DD.MM.YYYY formatında string (Kullanıcı girişi veya bazı Excel formatları)
    if (typeof v === "string" && /\b\d{1,2}\.\d{1,2}\.\d{4}\b/.test(v)) {
        const [g, a, y] = v.split(".");
        if (y && a && g) return `${y}-${a.padStart(2, "0")}-${g.padStart(2, "0")}`;
    }

    // 3. Standart ISO veya Date string formatları için
    try {
        const d = dayjs(v);
        // Date nesnesi geçerliyse formatla
        if (d.isValid()) return d.format('YYYY-MM-DD');
    } catch { }

    return null;
};

const toNumber = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? null : n;
};

// Yeni Yardımcı Fonksiyon: Excel Dosyasını Okuma
const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
        // 🔥 DÜZELTME: 'const const' yerine sadece 'const' kullanıldı.
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(e.target.result);
                const worksheet = workbook.getWorksheet(1);

                if (!worksheet) {
                    return resolve([]);
                }

                const rows = [];
                let headers = [];
                let dataRowIndex = 0; // Excel'den okunan veri satırı sayısı (başlık hariç)

                worksheet.eachRow((row, rowNumber) => {
                    const rowData = {};
                    const values = row.values;

                    // İlk satırı başlık olarak al
                    if (rowNumber === 1) {
                        // ExcelJS values array'i boş bir ilk element içerebilir, bu yüzden filtreliyoruz
                        headers = values.map(h => toUpperTr(h)).filter(h => h && h.length > 0);
                        return;
                    }

                    // Başlık sayısı ile sütun sayısını eşleştirerek veriyi işle
                    headers.forEach((header, index) => {
                        const cellValue = values[index + 1]; // ExcelJS 1-tabanlı dizinleme
                        const dbField = headerMap[header];
                        if (dbField) {
                            // Değeri metin veya direk değer olarak al
                            rowData[dbField] = cellValue?.result || cellValue?.text || cellValue;
                        }
                    });

                    // Satırda anlamlı bir veri varsa (örneğin plaka varsa) ekle
                    // En azından sefer no veya plaka varsa kabul et.
                    if (Object.keys(rowData).length > 0 && (rowData.plaka || rowData.sefer_no)) {
                        dataRowIndex++;
                        // Excel sırasını korumak için index ekleniyor (Yerel Sıralama için kullanılır)
                        rowData.excel_sira = dataRowIndex;
                        rows.push(rowData);
                    }
                });

                resolve(rows);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);

        reader.readAsArrayBuffer(file);
    });
};


/* -------------------- PLANLAMA COMPONENT ------------------- */

export default function PlanlamaDeluxe() {
    const navigate = useNavigate();

    /* ---------- state, perms, refs ---------- */
    const [rows, setRows] = useState([]);
    const [filteredRows, setFilteredRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [columnOrder, setColumnOrder] = useState([...alanlar]);

    const { loading: permsLoading, flags = {} } = usePermissions("planlama");
    const { pln_update = false, pln_save = false, pln_export_excel = false, pln_import_excel = false } = flags;
    const perms = useMemo(() => ({ loaded: !permsLoading, pln_update, pln_save, pln_export_excel, pln_import_excel }),
        [permsLoading, pln_update, pln_save, pln_export_excel, pln_import_excel]
    );

    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success", action: null });
    const [plakaDialogOpen, setPlakaDialogOpen] = useState(false);
    const [yeniPlaka, setYeniPlaka] = useState({ plaka: "", ad_soyad: "", telefon: "", tc: "" });
    const [guncelleDialogOpen, setGuncelleDialogOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeEditRow, setActiveEditRow] = useState(null);
    const [analizOpen, setAnalizOpen] = useState(false);
    const [analizContext, setAnalizContext] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const lastSavedSnapshot = useRef("[]");
    const isDirty = useMemo(() => lastSavedSnapshot.current !== JSON.stringify(rows), [rows]);

    const [plakalar, setPlakalar] = useState([]);
    const [bolgeler, setBolgeler] = useState([]);
    const [plakaFilter, setPlakaFilter] = useState([]);
    const [bolgeFilter, setBolgeFilter] = useState([]);
    const [plakaInput, setPlakaInput] = useState("");
    const [bolgeInput, setBolgeInput] = useState("");
    const [search, setSearch] = useState("");
    const searchRef = useRef(null);
    const debouncedSearch = useDebounced(search, 300);

    // const normalizeHeader = (s = "") => toUpperTr(String(s)).replace(/\s+/g, " ").replace(/\./g, "").trim();


    /* ---------- data fetch helpers (TDZ'den kaçınmak için erken tanımlanmıştır) ---------- */

    // Tamamlama Yüzdesi
    const completenessOf = useCallback((row) => {
        const keys = [
            "statü", "sefer_no", "tarih", "plaka", "ad_soyad", "telefon", "tc", "varis_tarihi",
            "son_nokta", "tahliye_il", "tonaj",
        ];
        // Hem statü hem de statu alanlarını kontrol edin (DB'den gelen veri için)
        const statuValue = row?.statü || row?.statu;
        const filled = keys.filter((k) => {
            if (k === "statü") return !!statuValue;
            return !!(row?.[k] ?? "");
        }).length;
        return Math.round((filled / keys.length) * 100);
    }, []);

    // Satır Silme
    const handleSil = useCallback(async (_rowId) => {
        const satir = rows.find((r) => r._rowId === _rowId);
        if (!satir) return;
        if (!window.confirm("Bu satırı silmek istiyor musunuz?")) return;

        // EĞER ID VARSA SUPABASE'DEN SİL
        if (satir.id) {
            const { error } = await supabase.from("planlama").delete().eq("id", satir.id);
            if (error) {
                setSnack({ open: true, msg: "Kayıt silinemedi. Lütfen tekrar deneyin.", severity: "error" });
                return;
            }
        }

        // Yerelden sil
        const r = rows.filter((x) => x._rowId !== _rowId);
        setRows(r);
        setSnack({ open: true, msg: "Satır silindi (lokal). Kaydet ile kalıcı olur.", severity: "info" });
    }, [rows]);

    // Hızlı Düzenle Çekmecesini açma
    const openDrawer = useCallback((row) => {
        setActiveEditRow(row);
        setDrawerOpen(true);
    }, []);

    // Sipariş Analiz panelini açma
    const openSiparisAnaliz = useCallback((row) => {
        setAnalizContext(row);
        setAnalizOpen(true);
    }, []);

    // DataGrid Row Update 
    const processRowUpdate = useCallback((incomingNewRow, oldRow) => {
        const newRow = { ...incomingNewRow };

        // Son nokta değiştiyse bölgeyi tekrar hesapla
        if (newRow.son_nokta !== oldRow.son_nokta) {
            const { son_nokta, bolge } = normalizeSonNoktaAndRegion(newRow.son_nokta);
            newRow.son_nokta = son_nokta;
            newRow.bolge = bolge;
        }

        // Tarih formatlarını temizle ve ISO'ya çevir
        ["tarih", "varis_tarihi"].forEach((k) => {
            const val = newRow?.[k];
            // Eğer DD.MM.YYYY formatında girilmişse ISO'ya çevir
            if (typeof val === "string" && /\b\d{1,2}\.\d{1,2}\.\d{4}\b/.test(val)) {
                const iso = parseDateLike(val);
                if (iso) {
                    newRow[k] = iso;
                } else {
                    newRow[k] = oldRow[k] || null; // Geçersiz formatı geri al
                }
            } else if (val === "") {
                newRow[k] = null;
            }
        });

        // Tonaj alanını sayıya çevir
        newRow.tonaj = toNumber(newRow.tonaj);


        // Rows state'ini güncelle
        setRows((prev) => prev.map((r) => (r._rowId === newRow._rowId ? newRow : r)));
        return newRow;
    }, []);


    /* -------------------- DataGrid Kolonları -------------------- */
    const columns = useMemo(() => {
        const textCol = (field, headerName, width = 160, editable = true, extra = {}) => ({
            field,
            headerName,
            width,
            editable: perms.pln_update ? editable : false,
            // Sütun Başlıkları için Fütüristik Stil
            renderHeader: (params) => (
                <Typography
                    variant="body2"
                    sx={{
                        color: '#22D3EE', // Turkuaz/Mavi tonu vurgusu
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 1.5, // Harf aralığı
                        textShadow: '0 0 5px rgba(34, 211, 238, 0.5)', // Neon ışık efekti
                    }}
                >
                    {params.colDef.headerName}
                </Typography>
            ),
            ...extra,
        });

        const allCols = [
            {
                field: "actions",
                headerName: <BoltIcon sx={{ color: '#E879F9', fontSize: 18, filter: 'drop-shadow(0 0 4px #E879F9)' }} />,
                width: 130,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Tooltip title="Hızlı Düzenle">
                            <IconButton size="small" onClick={() => openDrawer(params.row)} sx={{ '&:hover': { color: '#E879F9' } }}>
                                <EditNoteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Analiz">
                            <IconButton size="small" onClick={() => openSiparisAnaliz(params.row)} sx={{ '&:hover': { color: '#22D3EE' } }}>
                                <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Satırı Kaldır (Kaydet ile kalıcı olur)">
                            <IconButton size="small" onClick={() => handleSil(params.row._rowId)} sx={{ '&:hover': { color: '#EF4444' } }}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                ),
            },
            // STATÜ SÜTUNU 
            {
                field: "statü",
                headerName: "STATÜ",
                width: 150,
                editable: perms.pln_update,
                type: 'singleSelect',
                // Boş statü opsiyonu eklendi
                valueOptions: ["", ...STATU_LISTESI],
                renderCell: (params) => {
                    const status = params.value || "— Boş —";
                    const { color, hex } = statuRenkMap(status);
                    return (
                        <Chip
                            size="small"
                            label={status}
                            color={color}
                            sx={{
                                fontWeight: 700,
                                backgroundColor: alpha(hex, 0.15),
                                color: hex,
                                border: `1px solid ${alpha(hex, 0.5)}`,
                                textShadow: `0 0 4px ${alpha(hex, 0.4)}`,
                            }}
                        />
                    );
                },
                renderEditCell: (params) => (
                    <FormControl fullWidth size="small">
                        <Select
                            value={params.value || ""}
                            onChange={(e) => params.api.setEditCellValue({ id: params.id, field: params.field, value: e.target.value })}
                            inputProps={{ sx: { py: 0.5, px: 1, color: statuRenkMap(params.value).hex, fontWeight: 700 } }}
                            sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none !important' } }}
                        >
                            {/* Boş statü opsiyonu eklenmeli */}
                            {[...new Set(["", ...STATU_LISTESI, params.value || ""])].filter(statu => statu !== null).map((statu) => (
                                <MenuItem key={statu} value={statu} sx={{ color: statuRenkMap(statu).hex, fontWeight: 700 }}>
                                    {statu || "— Boş —"}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ),

            },
            // STATÜ SÜTUNU BİTİŞ
            textCol("sefer_no", "SEFER NO", 140),
            textCol("sevk_no", "SEVK NO", 140),
            textCol("tarih", "TARİH", 120, true, {
                renderCell: (params) => <Typography variant="body2" fontWeight={500} sx={{ color: '#FCD34D', textShadow: '0 0 4px rgba(252, 211, 77, 0.2)' }}>{formatDateTR(params.row?.tarih)}</Typography>,
                valueGetter: (_, row) => row?.tarih ?? null,
            }),
            textCol("plaka", "PLAKA", 120, true, {
                renderCell: (params) => <Typography variant="body2" fontWeight={700} sx={{ color: "#22D3EE", textShadow: '0 0 4px rgba(34, 211, 238, 0.2)' }}>{params.row?.plaka}</Typography>,
                valueGetter: (_, row) => row?.plaka ?? null,
            }),
            textCol("ad_soyad", "AD SOYAD", 160, true),
            textCol("telefon", "TELEFON", 140, true),
            textCol("tc", "TC", 120, true),
            textCol("varis_tarihi", "VARIŞ TARİHİ", 120, true, {
                renderCell: (params) => <Typography variant="body2" fontWeight={500} sx={{ color: '#FCD34D', textShadow: '0 0 4px rgba(252, 211, 77, 0.2)' }}>{formatDateTR(params.row?.varis_tarihi)}</Typography>,
                valueGetter: (_, row) => row?.varis_tarihi ?? null,
            }),
            textCol("son_nokta", "SON NOKTA", 160),
            textCol("fatura_musterisi", "FATURA MÜŞTERİSİ", 180),
            textCol("yukleme_noktasi", "YÜKLEME NOKTASI", 200),
            textCol("tahliye_noktasi", "TAHLİYE NOKTASI", 200),
            textCol("tahliye_il", "TAHLİYE İL", 140),
            textCol("tonaj", "TONAJ", 100, true, {
                align: "right",
                headerAlign: "right",
                renderCell: (params) => <Typography variant="body2">{toNumber(params.value)?.toFixed(2) || ''}</Typography>
            }),
            textCol("bir_onceki_is", "BİR ÖNCEKİ İŞ", 220, false),
            {
                field: "bolge",
                headerName: "BÖLGE",
                width: 170,
                editable: false,
                valueGetter: (value, row) => row?.bolge ?? "",
                renderCell: (params) =>
                    params.value ? (
                        <Chip
                            size="small"
                            label={params.value}
                            color={bolgeChip(params.value)}
                            variant="outlined"
                            sx={{
                                backgroundColor: alpha(params.value === "Kocaeli Bölgesi" ? '#22D3EE' : '#fff', 0.08),
                                border: '1px solid',
                                borderColor: alpha(params.value === "Kocaeli Bölgesi" ? '#22D3EE' : '#fff', 0.3),
                                fontWeight: 600,
                            }}
                        />
                    ) : (
                        <Typography variant="body2" sx={{ color: "text.secondary", opacity: 0.6 }}>
                            —
                        </Typography>
                    ),
            },
            {
                field: "tamam",
                headerName: "DOLULUK",
                width: 140,
                sortable: true,
                filterable: false,
                valueGetter: (value, row) => completenessOf(row),
                renderCell: (params) => (
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <CircularProgress
                            variant="determinate"
                            size={24}
                            value={params.value}
                            sx={{
                                color: params.value > 90 ? '#4ADE80' : params.value > 60 ? '#FCD34D' : '#EF4444',
                                filter: 'drop-shadow(0 0 4px rgba(34, 211, 238, 0.6))',
                            }}
                        />
                        <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{
                                color: params.value > 90 ? '#4ADE80' : params.value > 60 ? '#FCD34D' : '#E8EAF9',
                                textShadow: '0 0 5px rgba(232, 234, 249, 0.3)',
                            }}>
                            %{params.value}
                        </Typography>
                    </Stack>
                ),
            },
        ];
        return allCols;
    }, [perms.pln_update, openDrawer, openSiparisAnaliz, handleSil, completenessOf]);

    const orderedColumns = useMemo(() => {
        const map = Object.fromEntries(columns.map((c) => [c.field, c]));
        // 'excel_sira' DB'den kaldırıldığı için sadece 'actions' başta kalır.
        const orderWithoutActions = columnOrder.filter(f => f !== 'actions');

        const ordered = orderWithoutActions.map((f) => map[f]).filter(Boolean);

        const orderedFields = new Set(['actions', ...ordered.map(c => c.field)]);
        const rest = columns.filter((c) => !orderedFields.has(c.field));

        return [map['actions'], ...ordered, ...rest].filter(Boolean);
    }, [columns, columnOrder]);


    /* -------------------- Data Fetch & Actions -------------------- */

    /* ---------- data fetch ---------- */
    const fetchData = useCallback(async () => {
        setLoading(true);
        // DB'de olmayan excel_sira sıralaması kaldırıldı, sadece sefer_no'ya göre sıralanır.
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
            // Benzersiz anahtar olarak veritabanı ID'si (varsa) veya geçici ID kullan
            const _rowId = v.id ?? v.sefer_no ?? `tmp-${Date.now()}-${index}`;

            // Boş (null) gelirse boş olarak tutulur.
            const statu = v.statü || v.statu || "";

            return {
                ...v,
                statü: statu,
                son_nokta,
                bolge: bolge || v.bolge || "",
                tarih,
                varis_tarihi,
                _rowId,
            };
        });

        // Veriyi çekme sırasına göre sıralamayı kabul ediyoruz (eğer DB kuralı yeterliyse)

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
            setColumnOrder(valid);
        }
    }, []);

    // Yeni Plaka Diyaloğu açma
    const openPlakaDialog = useCallback(() => {
        setYeniPlaka({ plaka: "", ad_soyad: "", telefon: "", tc: "" });
        setPlakaDialogOpen(true);
    }, []);

    // Geri Al fonksiyonu
    const revertRows = useCallback(() => {
        try {
            const snap = JSON.parse(lastSavedSnapshot.current || "[]");
            setRows(snap);
            setSnack({ open: true, msg: "Yerel değişiklikler geri alındı.", severity: "info" });
        } catch { }
    }, []);

    // Filtreleri temizleme
    const clearFilters = useCallback(() => {
        setPlakaFilter([]);
        setBolgeFilter([]);
        setPlakaInput("");
        setBolgeInput("");
        setSearch("");
    }, []);

    // Drawer değişikliklerini uygulama
    const applyDrawerChanges = useCallback(() => {
        if (!activeEditRow) return;

        // Drawer'dan gelen veriyi DataGrid'deki gibi normalize et
        const tempRow = { ...activeEditRow };

        ["tarih", "varis_tarihi"].forEach((k) => {
            const iso = parseDateLike(tempRow[k]);
            tempRow[k] = iso;
        });

        const { son_nokta, bolge } = normalizeSonNoktaAndRegion(tempRow.son_nokta);
        tempRow.son_nokta = son_nokta;
        tempRow.bolge = bolge;
        tempRow.tonaj = toNumber(tempRow.tonaj);

        // Rows state'ini güncelle
        setRows((prev) => prev.map((r) => (r._rowId === tempRow._rowId ? tempRow : r)));

        setDrawerOpen(false);
        setSnack({ open: true, msg: "Değişiklikler uygulandı (lokal)", severity: "success" });
    }, [activeEditRow]);


    // Yeni Plaka Satırı Ekleme
    const saveYeniPlaka = useCallback(() => {
        const { plaka, ad_soyad, telefon, tc } = yeniPlaka;
        if (!plaka || !ad_soyad || !telefon || !tc) {
            setSnack({ open: true, msg: "Tüm alanlar zorunlu.", severity: "warning" });
            return;
        }

        // _rowId ile yeni bir satır oluştur
        const _rowId = `tmp-${Date.now()}`;

        const yeni = {
            _rowId,
            id: null, // Supabase'e yeni kayıt olarak gitmeli
            statü: "", // Statü boş bırakıldı
            sefer_no: "", sevk_no: "", tarih: getTodayISO(), varis_tarihi: getTodayISO(), son_nokta: "",
            fatura_musterisi: "", yukleme_noktasi: "", tahliye_noktasi: "", tahliye_il: "", tonaj: null, // tonaj null olmalı
            bir_onceki_is: "", bolge: "", plaka: toUpperTr(plaka), ad_soyad: toUpperTr(ad_soyad), telefon, tc,
        };

        // En üste ekle
        setRows((prev) => [yeni, ...prev]);
        setPlakaDialogOpen(false);
        setSnack({ open: true, msg: "Yeni satır eklendi (lokal). Kaydet ile yazılır.", severity: "success" });
    }, [yeniPlaka]);

    // Görünüm Kaydetme
    const saveView = useCallback(async () => {
        const kullaniciId = parseInt(localStorage.getItem("kullaniciId"));
        if (!kullaniciId) {
            setSnack({ open: true, msg: "Kullanıcı bulunamadı.", severity: "warning" });
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from("kullanici_planlama_gorunumleri")
                // columnOrder'dan aksiyon alanlarını hariç tuttuk
                .upsert({ kullanici_id: kullaniciId, sayfa: "planlama", gorunum: columnOrder.filter(c => c !== 'actions') }, { onConflict: ["kullanici_id", "sayfa"] });
            if (error) {
                setSnack({ open: true, msg: "Görünüm kaydedilemedi.", severity: "error" });
            } else {
                setSnack({ open: true, msg: "Görünüm kaydedildi.", severity: "success" });
            }
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Kaydetme sırasında hata oluştu.", severity: "error" });
        } finally {
            setSaving(false);
        }
    }, [columnOrder]);

    // DataGrid Sütun Sırası Değişikliği
    const onColumnOrderChange = useCallback((params) => {
        setColumnOrder((prev) => {
            const f = params.column?.field;
            // aksiyonlar sütununu sıralama dışı tut
            if (!f || !alanlar.includes(f) || f === 'actions') return prev;

            const filterablePrev = prev.filter(x => x !== 'actions');
            const arr = filterablePrev.filter((x) => x !== f);

            // params.targetIndex düzeltmesi, actions sütunu baştaysa çalışır.
            const targetIndexAdjusted = params.targetIndex > 0 ? params.targetIndex - 1 : 0;

            arr.splice(targetIndexAdjusted, 0, f);
            // actions her zaman başta
            return ['actions', ...arr];
        });
    }, []);

    // Excel Dosya İşleme (İçe Aktar)
    const handleFiles = useCallback(async (files) => {
        if (!perms.pln_import_excel) {
            setSnack({ open: true, msg: "Dosya içe aktarma yetkiniz yok.", severity: "warning" });
            return;
        }

        const file = files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const rawObjects = await readExcelFile(file); // Excel dosyasını oku ve nesne dizisine çevir

            if (!rawObjects.length) {
                setSnack({ open: true, msg: "Dosyada okunabilir veri bulunamadı veya başlıklar eşleşmedi.", severity: "info" });
                return;
            }

            const built = rawObjects.map((v) => {
                // Tarih normalization'ı için parseDateLike kullanıldı
                const tarih = parseDateLike(v.tarih) || getTodayISO();
                const varis_tarihi = parseDateLike(v.varis_tarihi) || tarih;

                // Normalizasyon için tahliye il'i kullan
                const { son_nokta, bolge } = normalizeSonNoktaAndRegion(v.tahliye_il || v.son_nokta);
                const tonaj = toNumber(v.tonaj);

                // Veri doğrulama ve zenginleştirme
                const processedRow = {
                    ...v,
                    _rowId: `excel-imp-${Date.now()}-${v.excel_sira}`, // excel_sira ile benzersizliği koru
                    id: null, // Yeni kayıt olmasını sağlamak için id'yi temizle

                    // Zorunlu alanları dönüştür
                    tarih: tarih,
                    varis_tarihi: varis_tarihi,
                    tonaj: tonaj,
                    plaka: toUpperTr(v.plaka), // Plaka normalizasyonu
                    ad_soyad: v.ad_soyad ? toUpperTr(v.ad_soyad) : '',

                    // Statü boşsa boş kalsın.
                    statü: toUpperTr(v.statü) || "",

                    // Tahliye ili varsa son nokta ve bölgeyi ona göre ayarla
                    son_nokta: son_nokta || v.son_nokta || '',
                    bolge: bolge || v.bolge || '',

                    // Önceki iş bilgisini geçici alanlardan oluştur
                    bir_onceki_is: [v.fatura_musterisi, v.yukleme_noktasi, v.tahliye_noktasi].filter(Boolean).join(" / "),

                    // excel_sira yerel sıralama için kullanılır
                    excel_sira: v.excel_sira,
                };

                return processedRow;
            });

            // Veriyi Excel sırasına göre sırala.
            const sortedBuilt = built.sort((a, b) => (a.excel_sira || Infinity) - (b.excel_sira || Infinity));


            // Yeni aktarılanları yüklüyoruz.
            setRows(sortedBuilt);
            setFilteredRows(sortedBuilt);

            // Plakaları ve Bölgeleri Güncelleme
            setBolgeler([...new Set(sortedBuilt.map((r) => r.bolge).filter(Boolean))]);
            setPlakalar(Array.from(new Map(sortedBuilt.filter((r) => r?.plaka).map((r) => [plakaKey(r.plaka), r.plaka])).values()));

            // Kaydetmeyi zorlamak için snapshot'ı kasıtlı olarak güncellemiyoruz, böylece isDirty=true kalır.
            setSnack({ open: true, msg: `${sortedBuilt.length} satır içe aktarıldı ve sıralandı. Kaydetmeyi unutmayın.`, severity: "success" });
        } catch (e) {
            console.error("İçe aktarma sırasında hata oluştu:", e);
            setSnack({ open: true, msg: `İçe aktarma sırasında hata oluştu: ${e.message || "Bilinmeyen bir hata"}`, severity: "error" });
        } finally {
            setLoading(false);
            setDragActive(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [perms.pln_import_excel]);

    // Kaydet (Insert/Update)
    const handleKaydet = useCallback(async () => {
        if (!perms.pln_save) {
            setSnack({ open: true, msg: "Kaydet yetkiniz yok.", severity: "warning" });
            return;
        }
        if (!isDirty) {
            setSnack({ open: true, msg: "Kaydedilecek değişiklik yok.", severity: "info" });
            return;
        }

        setSaving(true);

        // Supabase'e gönderilecek veriyi temizle ve sadece DB'deki alanları dahil et
        const rowsToSave = rows.map(row => {

            // Plaka ve Tarih DB'ye göndermeden önce kesinlikle normalize edilmeli
            const normalizedPlaka = toUpperTr(row.plaka);
            const normalizedTarih = parseDateLike(row.tarih);

            // Sadece veritabanı şemasına uygun alanları manuel olarak tanımlayın.
            const dbReadyRow = {
                // ID varsa (güncelleme) ekle, yoksa (yeni kayıt) HİÇ EKLEME.
                ...((row.id && { id: row.id }) || {}),

                // Statü boşsa null gönder.
                statu: row.statü || row.statu || null,

                sefer_no: row.sefer_no || null,
                sevk_no: row.sevk_no || null,
                // Tarih normalize edilmiş hali gönderilir
                tarih: normalizedTarih || null,
                // Plaka normalize edilmiş hali gönderilir (onConflict için önemli)
                plaka: normalizedPlaka || null,

                ad_soyad: toUpperTr(row.ad_soyad) || null,
                telefon: row.telefon || null,
                tc: row.tc || null,
                varis_tarihi: row.varis_tarihi || null,
                son_nokta: row.son_nokta || null,
                fatura_musterisi: row.fatura_musterisi || null,
                yukleme_noktasi: row.yukleme_noktasi || null,
                tahliye_noktasi: row.tahliye_noktasi || null,
                tahliye_il: row.tahliye_il || null,
                tonaj: toNumber(row.tonaj),
                bir_onceki_is: row.bir_onceki_is || null,
                bolge: row.bolge || null,
                // 'excel_sira' DB'de olmadığı için gönderilmez.
            };
            return dbReadyRow;
        });

        // onConflict kuralı 'plaka,tarih' olarak kaldı. Bu, aynı plaka ve tarih çakışmasını güncelleme olarak ele alır.
        const { error: upsertError } = await supabase
            .from("planlama")
            .upsert(rowsToSave, {
                onConflict: 'plaka,tarih',
                ignoreDuplicates: false
            });

        if (upsertError) {
            console.error("Toplu Kayıt Hatası:", upsertError);
            setSnack({
                open: true,
                msg: `Kaydedilirken hata oluştu: ${upsertError.message || 'Bilinmeyen bir sunucu hatası.'}`,
                severity: "error"
            });
            setSaving(false);
            return;
        }

        // Başarılı kayıttan sonra veriyi tekrar çek (Yeni ID'leri ve güncel durumu almak için)
        await fetchData();

        setSaving(false);
        setSnack({
            open: true,
            msg: "Tüm değişiklikler başarıyla kaydedildi.",
            severity: "success",
        });
    }, [perms.pln_save, rows, isDirty, fetchData]);

    // Excel Aktar
    const handleExportExcel = useCallback(async () => {

        if (!perms.pln_export_excel) {
            setSnack({ open: true, msg: "Excel aktarım yetkiniz yok.", severity: "warning" });
            return;
        }
        if (!filteredRows.length) {
            setSnack({ open: true, msg: "Aktarılacak veri bulunmuyor.", severity: "info" });
            return;
        }

        const map = Object.fromEntries(columns.map((c) => [c.field, c]));
        const orderWithoutActions = columnOrder.filter(f => f !== 'actions');
        const ordered = orderWithoutActions.map((f) => map[f]).filter(Boolean);
        const orderedFields = new Set(['actions', ...ordered.map(c => c.field)]);
        const rest = columns.filter((c) => !orderedFields.has(c.field));

        const finalExportColumns = [map['actions'], ...ordered, ...rest].filter(Boolean).filter(c => c.field !== 'actions' && c.field !== 'tamam');

        // EXCELJS ile dışa aktarma mantığı
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Planlama");

            const headers = finalExportColumns.map(c => c.headerName);
            worksheet.addRow(headers);

            // Sütun başlıklarını kalın yap
            worksheet.getRow(1).font = { bold: true };

            filteredRows.forEach((row) => {
                const dataRow = finalExportColumns.map(c => {
                    const value = row[c.field];
                    if (c.field === 'tarih' || c.field === 'varis_tarihi') {
                        return formatDateTR(value); // TR formatında göster
                    }
                    if (c.field === 'tonaj') {
                        return toNumber(value); // Sayı olarak gönder
                    }
                    return value;
                });
                worksheet.addRow(dataRow);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Planlama_Deluxe_Export_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);

            setSnack({ open: true, msg: "Veriler Excel olarak indirildi.", severity: "success" });
        } catch (e) {
            console.error("Excel Export Error:", e);
            setSnack({ open: true, msg: "Excel oluşturulurken bir hata oluştu.", severity: "error" });
        }

    }, [perms.pln_export_excel, filteredRows, columns, columnOrder]);


    const handleRowUpdateCommit = useCallback(() => {
        // processRowUpdate zaten setRows'u çağırdığı için bu fonksiyon sadece DataGrid'e sinyal verir.
    }, []);

    /* ---------- useEffect'ler ---------- */
    useEffect(() => {
        const onKey = (e) => {
            const isMac = navigator.platform.toUpperCase().includes("MAC");
            const metaK = (isMac && e.metaKey && e.key.toLowerCase() === "k") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "k");
            if (metaK) { e.preventDefault(); const el = document.getElementById("global-search-input"); el?.focus(); el?.select(); }
            if (e.key.toLowerCase() === "n") perms.pln_update && openPlakaDialog();
            if (e.key.toLowerCase() === "r") fetchData();
            if (e.key === "/") { const quick = document.querySelector('input[placeholder*="Quick filter"]'); quick?.focus(); e.preventDefault(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [fetchData, openPlakaDialog, perms.pln_update]);

    useEffect(() => {
        fetchData();
        loadView();
    }, [fetchData, loadView]);

    useEffect(() => {
        // rows → plaka seçenekleri ve seçili plaka tutarlılığı
        const opts = Array.from(
            new Map((rows || []).filter((r) => r?.plaka).map((r) => [plakaKey(r.plaka), r.plaka])).values()
        );
        setPlakalar(opts);
        setPlakaFilter((prev) =>
            (prev || []).filter((v) => opts.some((o) => plakaKey(o) === plakaKey(v)))
        );
    }, [rows]);

    useEffect(() => {
        // filtering
        let r = [...rows];
        if (plakaFilter?.length) {
            const secimler = new Set(plakaFilter.map(plakaKey));
            r = r.filter((x) => secimler.has(plakaKey(x.plaka)));
        }
        if (bolgeFilter?.length) r = r.filter((x) => bolgeFilter.includes(x.bolge || ""));
        if (debouncedSearch) {
            const s = debouncedSearch.toLowerCase();
            r = r.filter((x) => Object.values(x || {}).some((v) => String(v ?? "").toLowerCase().includes(s)));
        }

        // Excel'den yeni eklenenler (id: null olanlar) için yerel sıralamayı koru
        const currentRowsWithOrder = r.map(row => ({
            ...row,
            // excel_sira geçici bir alan olduğundan onu kullanıyoruz
            _sortOrder: row.id === null ? row.excel_sira : Infinity
        }));

        const sortedR = currentRowsWithOrder.sort((a, b) => {
            // Yeni eklenenleri excel_sira'ya göre sırala
            if (a._sortOrder !== Infinity || b._sortOrder !== Infinity) {
                return (a._sortOrder || Infinity) - (b._sortOrder || Infinity);
            }
            // Diğerlerini varsayılan sıralamaya bırak
            return 0;
        });


        setFilteredRows(sortedR);
    }, [rows, plakaFilter, bolgeFilter, debouncedSearch]);


    /* -------------------- RENDER BÖLÜMÜ -------------------- */

    // Bölge Sayıları
    const bolgeCounts = useMemo(() => {
        const m = {};
        for (const r of filteredRows) {
            const b = r.bolge || "—";
            m[b] = (m[b] || 0) + 1;
        }
        return m;
    }, [filteredRows]);

    // Bölge Filtreleme Toggle
    const toggleBolgeFilter = useCallback((b) => {
        setBolgeFilter((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
    }, []);

    // Koşullu Satır Sınıfı
    const getRowClassName = useCallback((params) => {
        if (params.row.bolge === "Kocaeli Bölgesi") {
            return 'super-highlighted-row';
        }
        if (toUpperTr(params.row.statü) === "İPTAL") {
            return 'canceled-row';
        }
        return '';
    }, []);


    return (
        <Box
            onDragOver={perms.pln_import_excel ? (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); } : undefined}
            onDragLeave={perms.pln_import_excel ? (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); } : undefined}
            onDrop={perms.pln_import_excel ? (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); const files = e.dataTransfer?.files; if (files?.length) handleFiles(files); } : undefined}
            sx={{
                height: "100dvh",
                overflow: "hidden",
                display: "grid",
                gridTemplateRows: "auto auto auto 1fr auto",
                gap: 1.5,
                p: 2,
                // DERİNLEŞTİRİLMİŞ FÜTÜRİSTİK ARKA PLAN
                background: "linear-gradient(180deg, #070B14 0%, #1A2033 100%)",
                color: "#E8EAF9",
                // KRİTİK SATIR VURGUSU
                [`& .super-highlighted-row`]: {
                    backgroundColor: alpha('#22D3EE', 0.08),
                    boxShadow: `0 0 8px ${alpha('#22D3EE', 0.2)}`,
                    transition: 'box-shadow 0.2s',
                    '&:hover': {
                        backgroundColor: alpha('#22D3EE', 0.15) + ' !important',
                        boxShadow: `0 0 12px ${alpha('#22D3EE', 0.4)}`,
                        cursor: 'crosshair', // Fütüristik imleç
                    },
                },
                [`& .canceled-row`]: {
                    opacity: 0.6,
                    fontStyle: 'italic',
                    textDecoration: 'line-through 1px',
                    backgroundColor: alpha('#EF4444', 0.05),
                },
            }}
        >
            <Helmet>
                <title>PLANLAMA</title>
                <style>{`html, body, #root { height: 100%; overflow: hidden; }`}</style>
            </Helmet>

            {/* Başlık + Aksiyonlar (Minimalist) */}
            <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
                spacing={1}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Tooltip title="Geri">
                        <IconButton
                            onClick={() => navigate(-1)}
                            sx={{ border: "1px solid rgba(255,255,255,0.08)", mr: 0.5 }}
                            size="small"
                        >
                            <ArrowBackIosNewIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Typography
                        variant="h4"
                        fontWeight={900}
                        sx={{
                            lineHeight: 1.1,
                            background: "linear-gradient(90deg,#E879F9,#22D3EE)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            ml: 1,
                            letterSpacing: 2,
                            textShadow: '0 0 8px rgba(232, 121, 249, 0.4)', // Başlığa neon parlaklık
                        }}
                    >
                        PLANLAMA DELUXE
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Tooltip title={perms.pln_save ? "Tüm veriyi kaydeder" : "Yetkiniz yok"}>
                        <span>
                            <Button
                                variant="contained"
                                startIcon={<SaveIcon />}
                                onClick={handleKaydet}
                                // Kaydet yetkisi yoksa VEYA kaydetme devam ediyorsa VEYA değişiklik yapılmadıysa pasif
                                disabled={!perms.pln_save || saving || !isDirty}
                                size="small"
                                sx={{
                                    background: 'linear-gradient(45deg, #E879F9 30%, #22D3EE 90%)', // Mor-Mavi degrade buton
                                    boxShadow: '0 3px 5px 2px rgba(34, 211, 238, .3)',
                                    color: '#0B1220',
                                    fontWeight: 700
                                }}
                            >
                                Kaydet
                            </Button>
                        </span>
                    </Tooltip>
                    <Tooltip title={perms.pln_update ? "Toplu alan temizliği ve doldurma" : "Yetkiniz yok"}>
                        <span><Button variant="outlined" startIcon={<TuneIcon />} onClick={() => setGuncelleDialogOpen(true)} disabled={!perms.pln_update} size="small">Toplu Güncelle</Button></span>
                    </Tooltip>
                    <Tooltip title={perms.pln_export_excel ? "Filtrelenmiş veriyi dışa aktarır" : "Yetkiniz yok"}>
                        <span><Button variant="outlined" startIcon={<CheckCircleIcon />} onClick={handleExportExcel} disabled={!perms.pln_export_excel} size="small">Excel Aktar</Button></span>
                    </Tooltip>
                    <Tooltip title={"Kolonların sırasını kaydet"}>
                        <span><Button variant="outlined" startIcon={<SaveIcon />} onClick={saveView} size="small" disabled={saving}>Görünüm Kaydet</Button></span>
                    </Tooltip>
                </Stack>
            </Stack>

            {/* Bölge Panelleri (Chip Vurgulu) */}
            <Box sx={{ overflowX: "auto", pb: 0.5, pr: 0.5 }}>
                <Stack direction="row" spacing={1} sx={{ minWidth: 'max-content' }}>
                    {Object.entries(bolgeCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([b, count]) => (
                            <Paper
                                key={b}
                                onClick={() => {
                                    if (isKocaeli(b)) { setAnalizContext({ bolge: b }); setAnalizOpen(true); }
                                    else { toggleBolgeFilter?.(b); }
                                }}
                                sx={{
                                    p: 1, minWidth: 160, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, cursor: "pointer",
                                    // Fütüristik Panel Stili - Geliştirilmiş
                                    backgroundColor: alpha("#fff", 0.05),
                                    // Kocaeli için daha belirgin border ve glow
                                    border: isKocaeli(b)
                                        ? `2px solid ${alpha("#E879F9", 0.8)}` // Kocaeli'ye Mor/Pembe parlaklık
                                        : bolgeFilter.includes(b)
                                            ? `1px solid ${alpha("#22D3EE", 0.5)}`
                                            : "rgba(255,255,255,0.06)",
                                    boxShadow: isKocaeli(b)
                                        ? `0 0 15px ${alpha("#E879F9", 0.6)}` // Kocaeli'ye güçlü glow
                                        : bolgeFilter.includes(b)
                                            ? `0 0 10px ${alpha("#22D3EE", 0.3)}`
                                            : `inset 0 1px 0 ${alpha("#fff", 0.04)}`,
                                    transition: "all .15s ease",
                                    "&:hover": { transform: "scale(1.02)", backgroundColor: alpha("#fff", 0.07) },
                                }}
                            >
                                <Stack sx={{ minWidth: 0 }}>
                                    <Typography variant="overline" sx={{ opacity: 0.7, lineHeight: 1 }}>BÖLGE</Typography>
                                    <Typography variant="subtitle2" fontWeight={700} noWrap title={b}>
                                        {b}
                                    </Typography>
                                </Stack>
                                <Chip
                                    label={count}
                                    size="small"
                                    sx={{
                                        fontWeight: 800,
                                        backgroundColor: bolgeFilter.includes(b) ? '#22D3EE' : alpha('#fff', 0.15),
                                        color: bolgeFilter.includes(b) ? '#0B1220' : '#E8EAF9',
                                    }}
                                />
                            </Paper>
                        ))}
                </Stack>
            </Box>

            {/* Filtreler ve Arama Çubuğu */}
            <Paper
                sx={{
                    p: 1,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                    // Filtre alanı daha şeffaf ve cam gibi
                    backgroundColor: alpha("#0B1220", 0.8),
                    border: "1px solid #334466",
                    backdropFilter: "blur(2px)",
                }}
            >
                <Autocomplete
                    multiple
                    options={plakalar.filter(Boolean)}
                    value={plakaFilter.filter(Boolean)}
                    onChange={(_, v) => setPlakaFilter(v.filter(Boolean))}
                    inputValue={plakaInput}
                    onInputChange={(_, v) => setPlakaInput(v ?? "")}
                    getOptionLabel={(opt) => String(opt ?? "")}
                    isOptionEqualToValue={(opt, val) => plakaKey(opt) === plakaKey(val)}
                    size="small"
                    renderInput={(params) => <TextField {...params} label="Plaka" placeholder="Seçin" sx={{ minWidth: 200 }} />}
                />

                <Autocomplete
                    multiple
                    options={bolgeler.filter(Boolean)}
                    value={bolgeFilter.filter(Boolean)}
                    onChange={(_, v) => setBolgeFilter(v.filter(Boolean))}
                    inputValue={bolgeInput}
                    onInputChange={(_, v) => setBolgeInput(v ?? "")}
                    getOptionLabel={(opt) => String(opt ?? "")}
                    isOptionEqualToValue={(opt, val) => opt === val}
                    size="small"
                    renderInput={(params) => <TextField {...params} label="Bölge" placeholder="Seçin" sx={{ minWidth: 200 }} />}
                />

                <Chip label={`${filteredRows.length} kayıt`} color="default" variant="filled" sx={{ ml: 0.5, backgroundColor: alpha('#22D3EE', 0.15), fontWeight: 700 }} />

                <Box sx={{ flex: 1 }} />

                <TextField
                    id="global-search-input"
                    inputRef={searchRef}
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ara… (Ctrl/Cmd+K)"
                    sx={{ minWidth: 240 }}
                    InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: "#22D3EE" }} />,
                        endAdornment: search ? (
                            <IconButton size="small" onClick={() => setSearch("")} edge="end">
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        ) : null,
                    }}
                />

                <Tooltip title="Tüm filtreleri temizle">
                    <span>
                        <Button onClick={clearFilters} variant="outlined" startIcon={<CleaningServicesIcon />} disabled={!plakaFilter.length && !bolgeFilter.length && !search} size="small">
                            Temizle
                        </Button>
                    </span>
                </Tooltip>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    hidden
                    onChange={(e) => handleFiles(e.target.files)}
                    disabled={!perms.pln_import_excel}
                />
                <Tooltip title={perms.pln_import_excel ? "Dosya İçe Aktar (.xlsx, .csv)" : "Yetkiniz yok"}>
                    <span>
                        <Button
                            variant="outlined"
                            startIcon={<UploadFileIcon />}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!perms.pln_import_excel}
                            size="small"
                        >
                            Dosya Aktar
                        </Button>
                    </span>
                </Tooltip>
            </Paper>

            {/* DataGrid Kapsayıcısı (Fütüristik Görünüm) */}
            <Paper
                elevation={6}
                sx={{
                    flexGrow: 1, minHeight: 0, height: "calc(100% - 60px)", borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.1)",
                    overflow: "hidden", display: "grid", position: "relative",
                    backdropFilter: "blur(6px)",
                    backgroundColor: alpha("#070B14", 0.7),
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
                }}
            >
                {loading && <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 4 }} />}
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
                    disableColumnMenu={false}
                    disableColumnReorder={false}
                    onColumnOrderChange={onColumnOrderChange}
                    getRowClassName={getRowClassName}
                    slots={{ noRowsOverlay: NoRowsOverlay, loadingOverlay: BusyOverlay }}
                    sx={{
                        border: "none",
                        height: "100%",
                        color: "#E8EAF9",
                        "& .MuiDataGrid-virtualScroller": { overflowX: "auto" },

                        // SIFIR ÇİZGİLİ GÖRÜNÜM İÇİN TÜM BORDERLAR KALDIRILDI
                        "& .MuiDataGrid-columnSeparator": { display: 'none' },
                        "& .MuiDataGrid-columnHeaderTitleContainer": { padding: 0 },
                        "& .MuiDataGrid-columnHeader": { borderRight: 'none' },
                        // Satır Ayracı: Mor Neon Kesikli Çizgi
                        "& .MuiDataGrid-cell": {
                            borderRight: 'none',
                            borderBottom: `1px dashed ${alpha("#E879F9", 0.1)}`, // Daha fütüristik alt çizgi
                        },

                        "& .MuiDataGrid-columnHeaders": {
                            background: "linear-gradient(180deg, #1A2033 0%, #070B14 100%)",
                            color: "#C8D1E6",
                            borderBottom: '1px solid rgba(255,255,255,0.15)',
                            fontWeight: 700,
                            fontSize: 12,
                        },
                        // Şeritli Satırlar (Daha az kontrastlı)
                        [`& .${gridClasses.row}:nth-of-type(odd)`]: {
                            backgroundColor: alpha("#fff", 0.03),
                        },
                        [`& .${gridClasses.row}:nth-of-type(even)`]: {
                            backgroundColor: 'transparent',
                        },
                        // HOVER EFECT (Daha keskin, fütüristik hover)
                        "& .MuiDataGrid-row:hover": {
                            backgroundColor: alpha("#22D3EE", 0.15) + ' !important',
                            boxShadow: `0 0 10px ${alpha("#22D3EE", 0.4)} inset`,
                            cursor: 'crosshair', // Fütüristik imleç efekti
                        },
                        "& .MuiDataGrid-row--editing": {
                            backgroundColor: alpha("#E879F9", 0.1) + ' !important',
                            boxShadow: `inset 0 0 0 1px ${alpha("#E879F9", 0.8)}`,
                        }
                    }}
                />
            </Paper>

            {/* Sticky Save Bar */}
            {isDirty && (
                <Paper
                    elevation={0}
                    sx={{
                        p: 1, borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)",
                        background: `linear-gradient(90deg, ${alpha("#E879F9", 0.16)} 0%, ${alpha("#22D3EE", 0.08)} 100%)`,
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1,
                        boxShadow: `0 -4px 20px ${alpha("#000", 0.4)}`,
                        gridColumn: "1 / -1", zIndex: 10, mt: 1,
                    }}
                >
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={700} variant="body2" color="#E879F9">
                            Kaydedilmemiş değişiklikler var
                        </Typography>
                        <Chip size="small" label={`${rows.length} satır`} sx={{ backgroundColor: alpha("#fff", 0.1), fontWeight: 700 }} />
                    </Stack>
                    <Stack direction="row" spacing={1}>
                        <Button onClick={revertRows} size="small" color="inherit">Geri Al</Button>
                        <Tooltip title={perms.pln_save ? "Kaydet" : "Yetkiniz yok"}>
                            <span>
                                <Button
                                    variant="contained"
                                    startIcon={<SaveIcon />}
                                    onClick={handleKaydet}
                                    disabled={!perms.pln_save} // isDirty bu alanda zaten kontrol edildi
                                    size="small"
                                    sx={{
                                        background: 'linear-gradient(45deg, #E879F9 30%, #22D3EE 90%)',
                                        boxShadow: '0 3px 5px 2px rgba(34, 211, 238, .3)',
                                        color: '#0B1220',
                                        fontWeight: 700
                                    }}
                                >
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
                onClick={() => setPlakaDialogOpen(true)}
                sx={{
                    position: "fixed",
                    right: 20,
                    bottom: isDirty ? 80 : 20,
                    boxShadow: 6,
                    zIndex: 1200,
                    transition: 'bottom 0.3s ease-in-out',
                    background: 'linear-gradient(135deg, #E879F9 30%, #22D3EE 90%)', // Fütüristik FAB degrade
                }}
                aria-label="yeni satır">
                <AddIcon />
            </Fab>

            {/* Kaydetme sırasında bloklayıcı */}
            <Backdrop open={saving} sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 1 }}>
                <CircularProgress color="inherit" />
                <Typography sx={{ ml: 2 }}>Kaydediliyor…</Typography>
            </Backdrop>

            {/* Yeni Plaka Dialog */}
            <Dialog
                open={plakaDialogOpen}
                onClose={() => setPlakaDialogOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: {
                        background: "linear-gradient(180deg, #1A2036 0%, #070B14 100%)",
                        border: "1px solid #334466",
                    }
                }}
            >
                <DialogTitle sx={{ color: '#E879F9', borderBottom: '1px solid #E879F91A' }}>Yeni Plaka Ekle</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                        <TextField label="Plaka" value={yeniPlaka.plaka} onChange={(e) => setYeniPlaka((p) => ({ ...p, plaka: e.target.value }))} autoFocus size="small" />
                        <TextField label="Ad Soyad" value={yeniPlaka.ad_soyad} onChange={(e) => setYeniPlaka((p) => ({ ...p, ad_soyad: e.target.value }))} size="small" />
                        <TextField label="Telefon" value={yeniPlaka.telefon} onChange={(e) => setYeniPlaka((p) => ({ ...p, telefon: e.target.value }))} placeholder="05xx xxx xx xx" size="small" />
                        <TextField label="TC" value={yeniPlaka.tc} onChange={(e) => setYeniPlaka((p) => ({ ...p, tc: e.target.value }))} size="small" />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPlakaDialogOpen(false)} size="small">İptal</Button>
                    <Button variant="contained" onClick={saveYeniPlaka} size="small">Kaydet</Button>
                </DialogActions>
            </Dialog>

            {/* Toplu Güncelle Onay */}
            <Dialog open={guncelleDialogOpen} onClose={() => setGuncelleDialogOpen(false)}>
                <DialogTitle>Güncelleme Onayı</DialogTitle>
                <DialogContent><Typography>Tüm filtrelenmiş kayıtlar güncellenecek. Devam etmek istiyor musunuz?</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={() => setGuncelleDialogOpen(false)} size="small">İptal</Button>
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
                                    // Sadece Tahliye İl'den Son Nokta/Bölge tekrar hesaplanır
                                    son_nokta,
                                    bolge,
                                    // Bu alanlar 'Bir Önceki İş'e taşındığı için temizlenir
                                    fatura_musterisi: "",
                                    yukleme_noktasi: "",
                                    tahliye_noktasi: "",
                                    tahliye_il: "",
                                    tonaj: null, // Temizle
                                };
                            });
                            // Güncellenmiş satırları ana rows state'i içinde bulup değiştirme
                            const updated = rows.map((r) => guncellenmis.find((g) => g._rowId === r._rowId) || r);
                            setRows(updated);
                            setGuncelleDialogOpen(false);
                            setSnack({ open: true, msg: `${guncellenmis.length} satır güncellendi (lokal). Kaydet ile yazılır.`, severity: "success" });
                        }}
                        size="small"
                    >
                        Evet, Güncelle
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Hızlı Düzenleme Çekmecesi */}
            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                PaperProps={{
                    sx: {
                        width: 380, p: 2, gap: 1,
                        backgroundColor: "#1A2036",
                        borderLeft: "2px solid #E879F980" // Fütüristik yan çizgi
                    }
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#22D3EE' }}>Hızlı Düzenle</Typography>
                    <IconButton onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton>
                </Stack>
                <Divider sx={{ my: 1, borderColor: alpha('#fff', 0.1) }} />
                {activeEditRow ? (
                    <Stack spacing={1.25}>
                        {/* Statü Select Alanı */}
                        <FormControl fullWidth size="small">
                            <InputLabel id="statu-select-label">Statü</InputLabel>
                            <Select
                                labelId="statu-select-label"
                                label="Statü"
                                value={activeEditRow?.statü || ""}
                                onChange={(e) => setActiveEditRow((r) => ({ ...r, statü: e.target.value }))}
                            >
                                {/* Boş opsiyon */}
                                <MenuItem value="">
                                    — Boş —
                                </MenuItem>
                                {STATU_LISTESI.map((statu) => (
                                    <MenuItem key={statu} value={statu} sx={{ color: statuRenkMap(statu).hex, fontWeight: 700 }}>
                                        {statu}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {[
                            ["sefer_no", "Sefer No"], ["sevk_no", "Sevk No"], ["tarih", "Tarih"], ["varis_tarihi", "Varış Tarihi"],
                            ["plaka", "Plaka"], ["ad_soyad", "Ad Soyad"], ["telefon", "Telefon"], ["tc", "TC"],
                            ["son_nokta", "Son Nokta"], ["tahliye_il", "Tahliye İl"], ["fatura_musterisi", "Fatura Müşterisi"],
                            ["yukleme_noktasi", "Yükleme Noktası"], ["tahliye_noktasi", "Tahliye Noktası"],
                            ["tonaj", "Tonaj"], ["bir_onceki_is", "Bir Önceki İş"],
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
                                // Tarih alanları için type="date" kullanılması önerilir.
                                type={(k === "tarih" || k === "varis_tarihi") ? "text" : "text"} // Type text bırakıldı
                                // Sayısal alanlar için type="number"
                                inputProps={{
                                    step: k === "tonaj" ? "0.01" : undefined
                                }}
                            />
                        ))}
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>Doluluk:</Typography>
                            <CircularProgress variant="determinate" value={completenessOf(activeEditRow)} size={22} sx={{ color: completenessOf(activeEditRow) > 90 ? '#4ADE80' : '#E8EAF9' }} />
                            <Typography variant="caption">%{completenessOf(activeEditRow)}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} pt={1}>
                            <Button onClick={() => setDrawerOpen(false)} size="small">Kapat</Button>
                            <Button variant="contained" onClick={applyDrawerChanges} size="small">Uygula</Button>
                        </Stack>
                    </Stack>
                ) : (
                    <Typography>Bir satır seçin…</Typography>
                )}
            </Drawer>

            {/* Sipariş Analiz — Modal */}
            <Dialog
                open={analizOpen}
                onClose={() => setAnalizOpen(false)}
                fullWidth
                maxWidth="lg"
                PaperProps={{
                    sx: (t) => ({
                        borderRadius: 3, overflow: "hidden", backdropFilter: "blur(8px)",
                        background: "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(2,6,23,0.96) 100%)",
                        // Düzeltilmiş Satır
                        boxShadow: `0 24px 64px ${alpha("#000", 0.55)}`, border: "1px solid rgba(255,255,255,0.06)",
                    }),
                }}
            >
                <Stack
                    direction="row" alignItems="center" justifyContent="space-between"
                    sx={{ px: 2, py: 1.25, borderBottom: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(34,211,238,0.08) 0%, rgba(34,211,238,0.02) 100%)", }}
                >
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#22D3EE' }}>{`Sipariş Analiz${analizContext?.bolge ? " — " + analizContext.bolge : ""}`}</Typography>
                    <IconButton onClick={() => setAnalizOpen(false)} size="small"><CloseIcon /></IconButton>
                </Stack>
                <Box sx={{ p: 2.25 }}>
                    <Suspense
                        fallback={<Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={26} /><Typography variant="body2" sx={{ mt: 1 }}>Yükleniyor…</Typography></Box>}
                    >
                        <SiparisAnaliz
                            open={analizOpen} onClose={() => setAnalizOpen(false)} sefer={analizContext} row={analizContext}
                            data={analizContext} plaka={primaryPlaka(analizContext?.plaka)}
                        />
                    </Suspense>
                </Box>
            </Dialog>

            {/* Drag & Drop Overlay */}
            {dragActive && perms.pln_import_excel && (
                <Box
                    sx={{
                        position: "fixed", inset: 0, zIndex: (t) => t.zIndex.modal + 1,
                        backgroundColor: alpha("#000", 0.7), display: "flex", alignItems: "center", justifyContent: "center",
                        border: "3px dashed #22D3EE",
                    }}
                >
                    <Stack spacing={1} alignItems="center">
                        <Typography variant="h4" fontWeight={800} sx={{ color: '#22D3EE', textShadow: '0 0 10px rgba(34, 211, 238, 0.5)' }}>
                            DOSYAYI BURAYA BIRAKIN
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.8 }}>.xlsx veya .csv desteklenir</Typography>
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
