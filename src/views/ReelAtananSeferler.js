// src/kullanıcıIslemleri/ReelAtananSeferler.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

/* MUI */
import {
    Box, Paper, Stack, Button, Typography, TextField, MenuItem, Snackbar, Alert,
    Backdrop, CircularProgress, Chip, Dialog, DialogTitle, DialogContent,
    DialogActions, IconButton, Tooltip, Divider, Switch, FormControlLabel, Grid,
    Card, CardContent, CardHeader, FormControl, FormLabel,    // ✅ eklendi
} from "@mui/material";
import { alpha } from "@mui/material/styles"; // ✅ alpha buradan
import { DataGrid } from "@mui/x-data-grid";

/* Icons */
import SyncIcon from "@mui/icons-material/Sync";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/EditNote";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import FileDownloadDoneIcon from "@mui/icons-material/FileDownloadDone";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

/* ---------------- helpers ---------------- */
// nokta adlarını normalize et (UPPER + trim)
const normNokta = (s) => trUpper((s ?? "").toString().trim());

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const EXCLUDED_PLAKAS = new Set([
    "34NHF579", "34NHF636", "34NHF705", "34NHF757",
    "34NHF811", "34NHF868", "34NHF916", "34NHF964",
    "34NHG120", "34NHG208", "06CFZ391", "33ADV488",
    "54AEH576", "26ADN765", "06GD7290", "33ABF523",
    "33AIM809", "33AVC168", "33ACR730"
]);

// reel_km'den gelen "12,3" gibi metinleri güvenle sayıya çevir
const parseKmNumber = (v) => {
    const n = parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
};


const normalizePlate = (s) => (s ?? "").toString().toUpperCase().replace(/[\s-]/g, "");
const isExcludedPlate = (p) => EXCLUDED_PLAKAS.has(normalizePlate(p));

const splitCell = (v) => (v ?? "").toString().split(";").map((x) => x.trim()).filter((x) => x !== "");
const joinCell = (arr) => (arr || []).map((x) => (x ?? "").trim()).filter(Boolean).join("; ");
const clean = (v) => { const t = (v ?? "").toString().trim(); return !t || t === "-" || t === "---" ? null : t; };

const detailFields = [
    "proje_adi", "yukleme_noktasi", "yukleme_ili", "yukleme_ilcesi",
    "teslim_noktasi", "teslim_ili", "teslim_ilcesi",
    "yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis",
];

const computeAracStatu = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return "";
    const isFilled = (x) => x && x !== "-" && x.trim() !== "";
    let completed = 0;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const yv = isFilled(r.yukleme_varis);
        const yc = isFilled(r.yukleme_cikis);
        const tv = isFilled(r.teslim_varis);
        const tc = isFilled(r.teslim_cikis);
        if (!yv) return `${i + 1}.NOKTA BİLGİLERİ BEKLENİYOR`;
        if (!yc) return `${i + 1}.NOKTADA YÜKLEMEDE`;
        if (!tv) return `${i + 1}.NOKTADA YOLDA`;
        if (!tc) return `${i + 1}.NOKTADA BOŞALTMADA`;
        completed++;
    }
    if (completed === rows.length) return "SEFER TAMAMLANDI";
    return "";
};

/* --------- UI renkleri --------- */
const COLORS = {
    pageBg: "#0F172A",
    surface: "#111827",
    surface2: "#1F2937",
    border: "rgba(148,163,184,0.25)",
    text: "#E5E7EB",
    textMuted: "#C7D2FE",
    zebra: "rgba(148,163,184,0.06)",
};

/* ========= Tarih + Saat yardımcıları ========= */
const fmtDateDigits = (digits) => {
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    let s = d;
    if (digits.length > 2) s += "." + m;
    if (digits.length > 4) s += "." + y;
    return s;
};
const fmtTimeDigits = (digits) => {
    const h = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    return digits.length > 2 ? `${h}:${m}` : h;
};
const isDateComplete = (txt) => /^\d{2}\.\d{2}\.\d{4}$/.test(txt);
const isTimeComplete = (txt) => /^\d{2}:\d{2}$/.test(txt);
const toISO = (dateTR, time) => {
    if (!(isDateComplete(dateTR) && isTimeComplete(time))) return "";
    const [dd, mm, yyyy] = dateTR.split(".");
    return `${yyyy}-${mm}-${dd}T${time}`;
};
const fromISO = (iso) => {
    if (!iso) return { d: "", t: "" };
    const d = iso.slice(0, 10);
    const t = iso.slice(11, 16);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { d: "", t: "" };
    const [y, m, dd] = d.split("-");
    return { d: `${dd}.${m}.${y}`, t };
};
const isDateTimeComplete = (txt) => /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(txt);
const fmtDateTimeDigits = (digits) => {
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    const h = digits.slice(8, 10);
    const mi = digits.slice(10, 12);
    let s = d;
    if (digits.length > 2) s += "." + m;
    if (digits.length > 4) s += "." + y;
    if (digits.length > 8) s += " " + h;
    if (digits.length > 10) s += ":" + mi;
    return s;
};
const toISOFromCombined = (txt) => {
    if (!isDateTimeComplete(txt)) return "";
    const [dateTR, time] = txt.split(" ");
    return toISO(dateTR, time);
};
const fromISOToCombined = (iso) => {
    const { d, t } = fromISO(iso || "");
    return d && t ? `${d} ${t}` : "";
};
// ========= ETA hesaplama yardımcıları =========
const trUpper = (s) => (s || "").toLocaleUpperCase("tr-TR").trim();
const normIlce = (s) => trUpper(s) || "MERKEZ";

const parseHHMM = (txt) => {
    const [h = "0", m = "0"] = String(txt || "").split(":");
    return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
};

// 4,5 saatte bir 45 dk mola (tam 4,5 saatle bitiyorsa son molayı eklemeyiz)
const breakMinutesFor = (driveMin) => {
    let c = Math.floor(driveMin / 270);
    if (driveMin % 270 === 0 && c > 0) c -= 1;
    return c * 45;
};

const toLocalIso = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "YYYY-MM-DDTHH:MM" (veya "YYYY-MM-DD HH:MM") -> Date
const parseIsoMinute = (s) => {
    if (!s) return null;
    const str = String(s).replace(" ", "T").slice(0, 16);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
};

// ⬇️ yeni: ISO string’e dakika ekle
const addMinutesToIso = (iso, mins) => {
    const d = parseIsoMinute(iso);
    if (!d || !mins) return iso;
    d.setMinutes(d.getMinutes() + Number(mins));
    return toLocalIso(d);
};

// Cumartesi 08:00–17:00 aralığı kontrolü ve 1 gün ekleme
function isSaturdayBetween0800and1700(iso) {
    const d = parseIsoMinute(iso);           // "YYYY-MM-DDTHH:MM" -> Date (local)
    if (!d) return false;
    const day = d.getDay();                  // Cumartesi = 6
    const mins = d.getHours() * 60 + d.getMinutes();
    return day === 6 && mins >= 8 * 60 && mins <= 17 * 60;
}

function applySaturdayRule(iso) {
    if (!iso) return iso;
    const d = parseIsoMinute(iso);
    if (!d) return iso;
    if (isSaturdayBetween0800and1700(iso)) {
        d.setDate(d.getDate() + 1);          // +1 gün
    }
    return toLocalIso(d);                    // "YYYY-MM-DDTHH:MM"
}


// detailRows içinden en erken YÜKLEME ÇIKIŞ'ı al
const getEarliestYuklemeCikisIso = (rows) => {
    const times = (rows || [])
        .map((r) => parseIsoMinute(r?.yukleme_cikis))
        .filter(Boolean)
        .map((d) => d.getTime());
    if (!times.length) return null;
    const t = Math.min(...times);
    return toLocalIso(new Date(t)); // "YYYY-MM-DDTHH:MM"
};

// Tek nokta için km çek
async function getDistanceKmForRow(r) {
    // 1) Tam eşleşme
    let { data, error } = await supabase
        .from("mesafeler")
        .select("mesafe")
        .match({
            yukleme_il: trUpper(r.yukleme_ili),
            yukleme_ilce: normIlce(r.yukleme_ilcesi),
            teslim_il: trUpper(r.teslim_ili),
            teslim_ilce: normIlce(r.teslim_ilcesi),
        })
        .limit(1)
        .maybeSingle();

    // 2) Hata yok ama kayıt bulunmadıysa birkaç basit fallback dene
    if (!error && !data) {
        const yIlce = normIlce(r.yukleme_ilcesi);
        const tIlce = normIlce(r.teslim_ilcesi);
        if (yIlce !== "MERKEZ" || tIlce !== "MERKEZ") {
            const f1 = await supabase
                .from("mesafeler")
                .select("mesafe")
                .match({
                    yukleme_il: trUpper(r.yukleme_ili),
                    yukleme_ilce: "MERKEZ",
                    teslim_il: trUpper(r.teslim_ili),
                    teslim_ilce: "MERKEZ",
                })
                .limit(1)
                .maybeSingle();
            if (!f1.error && f1.data) { data = f1.data; }
        }
    }

    // 3) Hâlâ yoksa uyarı bas ve 0 dön
    if (error) {
        console.error("mesafe sorgu hatası:", error);
        return 0;
    }
    if (!data) {
        console.warn("Mesafe bulunamadı (ETA hesaplanamaz):", {
            yukleme_il: trUpper(r.yukleme_ili),
            yukleme_ilce: normIlce(r.yukleme_ilcesi),
            teslim_il: trUpper(r.teslim_ili),
            teslim_ilce: normIlce(r.teslim_ilcesi),
        });
        return 0;
    }
    const km = parseFloat(String(data.mesafe ?? "0").replace(",", "."));
    return Number.isFinite(km) ? km : 0;
}

// reel_km tablosundan aynı (yukleme_noktasi, teslim_noktasi) eşleşmesini bulup km döndür
async function getReelKmByNokta(yukleme_noktasi, teslim_noktasi) {
    const y = normNokta(yukleme_noktasi);
    const t = normNokta(teslim_noktasi);
    if (!y || !t) return "";

    // Önce birebir eşleşme (normalize değerlerle)
    let { data, error } = await supabase
        .from("reel_km")
        .select("km, kayit_zamani")
        .eq("yukleme_noktasi", y)
        .eq("teslim_noktasi", t)
        .order("kayit_zamani", { ascending: false })
        .limit(1)
        .maybeSingle();

    // Hâlâ yoksa case-insensitive fallback (veriniz normalize değilse)
    if (!error && !data) {
        const f = await supabase
            .from("reel_km")
            .select("km, kayit_zamani")
            .ilike("yukleme_noktasi", y)
            .ilike("teslim_noktasi", t)
            .order("kayit_zamani", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!f.error && f.data) data = f.data;
    }

    if (error) {
        console.warn("reel_km (nokta) sorgu hatası:", error);
        return "";
    }
    const km = parseKmNumber(data?.km);
    return km > 0 ? String(Math.round(km)) : "";
}


// Çok nokta toplam km
async function computeTotalDistanceKm(detailRows) {
    const arr = await Promise.all((detailRows || []).map((r) => getDistanceKmForRow(r)));
    return arr.reduce((a, b) => a + b, 0);
}

// km + kalan_sürüş (bugünkü) ile molalar ve günlük dinlenmeyle ETA üret
// km + "bir sonraki 45 dk molaya kadar kalan sürüş" + 9s/11s kuralları ile ETA üret
function computeEtaIsoFrom(totalKm, remainingHHMM, baseStartIso) {
    if (!totalKm || !baseStartIso) return "";

    const AVG_SPEED_KMH = 65;           // ortalama hız
    const CHUNK = 4.5 * 60;             // 4,5 saat (dk)
    const CHUNK_BREAK = 45;             // 45 dk mola
    const DAY_CAP = 9 * 60;             // günlük azami sürüş (dk)
    const DAILY_REST = 11 * 60;         // günlük dinlenme (dk)

    // Gerekli toplam sürüş (dk)
    let remainingDriveMin = Math.ceil((totalKm / AVG_SPEED_KMH) * 60);

    // Başlangıç zamanı
    const base = parseIsoMinute(baseStartIso);
    if (!base) return "";

    // "Kalan sürüş": şu anki 4,5 saatlik blokta molaya kadar kalan dakika
    let timeUntilBreak = parseHHMM(remainingHHMM || "");
    if (!Number.isFinite(timeUntilBreak) || timeUntilBreak <= 0) timeUntilBreak = CHUNK;

    // Bugünkü kalan sürüş hakkı (9 saat)
    let dailyRemaining = DAY_CAP;

    // Toplam geçen süre (dk)
    let totalElapsed = 0;

    while (remainingDriveMin > 0) {
        // Şu an sürülebilecek maksimum dakika
        const driveNow = Math.min(remainingDriveMin, timeUntilBreak, dailyRemaining);

        totalElapsed += driveNow;
        remainingDriveMin -= driveNow;
        timeUntilBreak -= driveNow;
        dailyRemaining -= driveNow;

        // Varış anı: ek mola/dinlenme yok
        if (remainingDriveMin <= 0) break;

        // Günlük 9 saat dolduysa: 11 saat dinlenme; yeni güne geç
        if (dailyRemaining === 0) {
            totalElapsed += DAILY_REST;
            dailyRemaining = DAY_CAP;
            timeUntilBreak = CHUNK; // yeni günde 4,5 saatlik sayaç tazelenir
            continue;
        }

        // 4,5 saatlik blok dolduysa: 45 dk mola; aynı günde devam
        if (timeUntilBreak === 0) {
            totalElapsed += CHUNK_BREAK;
            timeUntilBreak = CHUNK; // mola sonrası yeni 4,5 saatlik blok
            // dailyRemaining aynı kalır (günlük sınır azalttıkça devam)
            continue;
        }
    }

    const etaDate = new Date(base.getTime() + totalElapsed * 60000);
    return toLocalIso(etaDate); // "YYYY-MM-DDTHH:MM"
}


function DateTimeOneField({ label, value, onChange, sx }) {
    const [text, setText] = useState("");
    useEffect(() => { setText(fromISOToCombined(value || "")); }, [value]);

    const handleChange = (e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
        const formatted = fmtDateTimeDigits(digits);
        setText(formatted);
        onChange(toISOFromCombined(formatted));
    };

    return (
        <TextField
            label={label}
            placeholder="gg.aa.yyyy ss:dd"
            value={text}
            onChange={handleChange}
            size="small"
            inputProps={{ inputMode: "numeric", maxLength: 16 }}
            InputLabelProps={{ shrink: true }}
            sx={sx}
        />
    );
}

// Tek alanda ss.dd gösterir; 2 hane sonra otomatik nokta (ss.)
// 0-1-2 hane: state -> "H" veya "HH" (pad yok)
// 3 hane: state -> "HH:M"  (dakikada pad yok)
// 4 hane: state -> "HH:MM" (dakika 0-59 clamp + pad)
function TimeHMField({ label, value, onChange, sx }) {
    const [text, setText] = useState("");

    useEffect(() => {
        const v = (value || "").toString();
        setText(v ? v.replace(":", ".") : ""); // başlangıçta boş
    }, [value]);

    const handleChange = (e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 4); // ssdd
        const hh = digits.slice(0, 2);
        const m1 = digits.slice(2, 3); // tek dakika hanesi
        const mm = digits.slice(2, 4); // iki dakika hanesi

        // ekranda gösterim
        let display = hh;
        if (digits.length === 2) {
            display = `${hh}.`;            // 2 hane olunca dakikaya geç
        } else if (digits.length === 3) {
            display = `${hh}.${m1}`;
        } else if (digits.length === 4) {
            display = `${hh}.${mm}`;
        }
        setText(display);

        // dışarıya değer (state)
        if (digits.length === 0) {
            onChange("");                   // boş
        } else if (digits.length <= 2) {
            onChange(hh);                   // "H" ya da "HH" (pad yok)
        } else if (digits.length === 3) {
            onChange(`${hh}:${m1}`);        // "HH:M" (pad yok)
        } else {
            // 4 hane olduğunda dakika clamp + pad
            const mmNumRaw = parseInt(mm || "0", 10);
            const mmNum = isNaN(mmNumRaw) ? 0 : Math.min(59, mmNumRaw);
            const mmClamped = String(mmNum).padStart(2, "0");
            onChange(`${hh}:${mmClamped}`); // "HH:MM"
        }
    };

    return (
        <TextField
            label={label}
            placeholder="ss.dd"
            value={text}
            onChange={handleChange}
            size="small"
            inputProps={{ inputMode: "numeric", maxLength: 5 }}
            InputLabelProps={{ shrink: true }}
            sx={sx}
        />
    );
}




export default function ReelAtananSeferler() {
    const navigate = useNavigate();

    /* data */
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    /* filters */
    const [startDate, setStartDate] = useState(daysAgoISO(6));
    const [endDate, setEndDate] = useState(todayISO());
    const [seferNoTipi, setSeferNoTipi] = useState("");
    const [quick, setQuick] = useState("");
    const [plaka, setPlaka] = useState("");
    const [musteri, setMusteri] = useState("");
    const [proje, setProje] = useState("");
    const [yuklemeIl, setYuklemeIl] = useState("");
    const [teslimIl, setTeslimIl] = useState("");
    const [aracStatu, setAracStatu] = useState("");
    const [noktaSayisi, setNoktaSayisi] = useState("");

    /* UI */
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
    const [saving, setSaving] = useState(false);
    const [successCount, setSuccessCount] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);
    const [dense, setDense] = useState(false);

    /* dialog */
    const [editOpen, setEditOpen] = useState(false);
    const [editSefer, setEditSefer] = useState(null);
    const [detailRows, setDetailRows] = useState([]);
    const [seferTarihiYeni, setSeferTarihiYeni] = useState("");
    const [kalanSuresi, setKalanSuresi] = useState(""); // "HH:MM" ya da boş
    const [etaGlobal, setEtaGlobal] = useState("");     // ISO "yyyy-mm-ddThh:mm" ya da boş
    const [mola, setMola] = useState("");               // "", "45" (dk), "660" (11 saat)
    // ...
    const [totalKm, setTotalKm] = useState(0);
    const [kayitliKm, setKayitliKm] = useState("");   // ✅ genel
    const [yeniKm, setYeniKm] = useState("");         // ✅ genel
    const [kmAciklama, setKmAciklama] = useState(""); // ✅ genel
    // ...



    /* options */
    const options = useMemo(() => {
        const uniq = (key) =>
            [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort((a, b) =>
                String(a).localeCompare(String(b), "tr")
            );
        return {
            sefer_no: uniq("sefer_no"),
            plaka: uniq("plaka"),
            musteri_adi: uniq("musteri_adi"),
            proje_adi: uniq("proje_adi"),
            yukleme_ili: uniq("yukleme_ili"),
            teslim_ili: uniq("teslim_ili"),
            arac_statu: uniq("arac_statu"),
        };
    }, [rows]);

    /* listele */
    const listData = useCallback(async () => {
        setLoading(true);
        try {
            const rangeMin = (startDate || daysAgoISO(6)) + "T00:00:00";
            const rangeMax = (endDate || todayISO()) + "T23:59:59";
            const { data, error } = await supabase
                .from("seferler").select("*")
                .gte("sefer_tarihi", rangeMin).lte("sefer_tarihi", rangeMax)
                .order("sefer_tarihi", { ascending: false });
            if (error) throw error;

            const { data: tamamlananNos } = await supabase
                .from("tamamlanan_seferler")
                .select("sefer_no")
                .gte("sefer_tarihi", rangeMin)
                .lte("sefer_tarihi", rangeMax);

            const COMPLETED_NOS = new Set((tamamlananNos || []).map(x => (x.sefer_no ?? "").trim()));

            const visible = (data || [])
                .filter(s => !COMPLETED_NOS.has((s.sefer_no ?? "").toString().trim()))
                .filter(s => !isExcludedPlate(s.plaka));

            const enriched = visible.map((s, idx) => {
                const maxLen = Math.max(0, ...detailFields.map((k) => splitCell(s[k]).length));
                return {
                    ...s,
                    _rid: s.id ?? s.sefer_no ?? `tmp-${Date.now()}-${idx}`,
                    nokta_sayisi: maxLen || 0,
                    reel_durum: s.reel_durum || "-",
                };
            });

            setRows(enriched);
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Veri çekilirken hata oluştu.", severity: "error" });
            setRows([]);
        } finally { setLoading(false); }
    }, [startDate, endDate]);

    /* senkronize */
    const syncData = useCallback(async () => {
        setLoading(true);
        try {
            const start = (startDate || daysAgoISO(6)) + "T00:00:00";
            const end = (endDate || todayISO()) + "T23:59:59";
            const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
            const min = start, max = end;

            const res = await fetch(`${API_BASE_URL}/api/proxy/tmsdespatches`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: start,        // örn: 2025-09-11T00:00:00
                    endDate: end,            // örn: 2025-09-11T23:59:59
                    userId: 1,
                    CustomerId: 0,
                    SupplierId: 0,
                    DriverId: 0,
                    TMSDespatchId: 0,
                    VehicleId: 0,
                    DocumentPrint: "",
                    WorkingTypesId: [3,4]
                }),
            });
            if (!res.ok) throw new Error(`API Hatası: ${res.status} ${res.statusText}`);
            const json = await res.json();

            if (!json || !Array.isArray(json.Data)) {
                setSnack({ open: true, msg: "API veri yok.", severity: "warning" });
                return;
            }

            const { data: tamamlananNos } = await supabase
                .from("tamamlanan_seferler")
                .select("sefer_no")
                .gte("sefer_tarihi", min)
                .lte("sefer_tarihi", max);
            const COMPLETED_NOS = new Set((tamamlananNos || []).map(x => (x.sefer_no ?? "").trim()));

            const gelen = json.Data.filter((x) => x && typeof x === "object");
            const filtreli = gelen
                .filter((item) => {
                    const tip = (item?.VehicleWorkingTypeName || "").toString().trim().toUpperCase();
                    return tip === "FİLO" || tip === "ÖZMAL";
                })
                .filter((item) => !EXCLUDED_PLAKAS.has(normalizePlate(item?.PlateNumber)))
                .filter((item) => !COMPLETED_NOS.has((item?.DocumentNo ?? "").toString().trim()));

            const mapOrders = (orders, field) =>
                Array.isArray(orders)
                    ? orders.filter(o => o && typeof o === "object")
                        .map(o => o[field] ?? "").filter(Boolean).join("; ")
                    : "";

            const temiz = filtreli.map((s) => {
                const tmsOrders = Array.isArray(s.TMSOrders) ? s.TMSOrders : [];
                return {
                    sefer_no: s?.DocumentNo?.trim() ?? "",
                    arac_statu: s?.VehicleStatus ?? "",
                    plaka: s?.PlateNumber ?? "",
                    treyler: s?.TrailerPlateNumber ?? "",
                    surucu_ad_soyad: s?.FullName ?? "",
                    surucu_tckn: s?.CitizenNumber ?? "",
                    surucu_telefon: s?.PhoneNumber ?? "",
                    musteri_adi: s?.CustomerFullTitle ?? "",
                    musteri_siparis_no: s?.CustomerOrderNumber ?? "",
                    hizmet_adi: s?.ServiceName ?? "",
                    proje_adi: mapOrders(tmsOrders, "ProjectName"),
                    yukleme_noktasi: mapOrders(tmsOrders, "PickupAddressCode"),
                    yukleme_ili: mapOrders(tmsOrders, "PickupCityName"),
                    yukleme_ilcesi: mapOrders(tmsOrders, "PickupCountyName"),
                    teslim_alan_firma: mapOrders(tmsOrders, "DeliveryCurrentAccountName"),
                    teslim_noktasi: mapOrders(tmsOrders, "DeliveryAddressCode"),
                    teslim_ili: mapOrders(tmsOrders, "DeliveryCityName"),
                    teslim_ilcesi: mapOrders(tmsOrders, "DeliveryCountyName"),
                    irsaliye_no: s?.TMSDespatchWaybillNumber ?? "",
                    sefer_tarihi: s?.DespatchDate ?? null,
                    atama_yapan_kullanici: s?.TMSDespatchCreatedBy ?? "",
                    atama_tarihi: s?.TMSDespatchCreatedDate ?? null,
                    kayit_zamani: new Date().toISOString(),
                    reel_durum: "YENİ",
                };
            });

            const { data: mevcut } = await supabase
                .from("seferler")
                .select("*")
                .gte("sefer_tarihi", min)
                .lte("sefer_tarihi", max);

            const mapDb = new Map((mevcut || []).map((r) => [r.sefer_no?.trim(), r]));
            const seenNew = [];
            const upsert = [];

            for (const item of temiz) {
                const key = (item.sefer_no ?? "").trim();
                const eski = mapDb.get(key);

                if (!eski) {
                    const yeni = { ...item, reel_durum: "YENİ" };
                    seenNew.push(yeni);
                    upsert.push(yeni);
                } else {
                    // mevcut kayıttaki (kullanıcıdan gelen) alanları koru,
                    // API'den gelenlerle güncelle. Böylece eta/kalan_surus_suresi kaybolmaz.
                    const merged = { ...eski, ...item, reel_durum: "ESKİ" };
                    seenNew.push(merged);
                    upsert.push(merged);
                }
            }

            if (upsert.length) {
                await supabase.from("seferler").upsert(upsert, { onConflict: "sefer_no" });
            }

            setSuccessCount(upsert.length);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3500);

            const enriched = [...seenNew].map((s, idx) => {
                const maxLen = Math.max(0, ...detailFields.map((k) => splitCell(s[k]).length));
                return { ...s, _rid: s.id ?? s.sefer_no ?? `tmp-${Date.now()}-${idx}`, nokta_sayisi: maxLen || 0 };
            });
            setRows(enriched);
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Senkronizasyon hatası.", severity: "error" });
        } finally { setLoading(false); }
    }, [startDate, endDate]);

    /* mount */
    /* mount */
    useEffect(() => { listData(); }, [listData]);

    /* 1) Noktalar değişince TOPLAM KM'yi hesapla */
    /* 1) Noktalar değişince TOPLAM KM'yi hesapla */
    useEffect(() => {
        if (!editOpen) return;
        let cancel = false;

        (async () => {
            try {
                const km = await computeTotalDistanceKm(detailRows);
                if (!cancel) setTotalKm(km);
            } catch (e) {
                console.error("KM hesaplama hatası:", e);
                if (!cancel) setTotalKm(0);
            }
        })();

        return () => { cancel = true; };
    }, [editOpen, detailRows]);

    // ETA'yı anında güncelle: kalan sürüş, km, sefer tarihi veya yükleme_çıkış değişince
    useEffect(() => {
        if (!editOpen) return;

        const baseIsoRaw =
            getEarliestYuklemeCikisIso(detailRows) ||
            (seferTarihiYeni || editSefer?.sefer_tarihi) ||
            toLocalIso(new Date());

        // Cumartesi 08:00–17:00 ise +1 gün uygula
        // Cumartesi 08:00–17:00 ise +1 gün uygula
        let baseIso = applySaturdayRule(baseIsoRaw);

        // ⬇️ yeni: sürüşe başlamadan önce seçili mola varsa uygula
        if (mola === "45") baseIso = addMinutesToIso(baseIso, 45);
        else if (mola === "660") baseIso = addMinutesToIso(baseIso, 660);

        const kalan = (kalanSuresi || "").toString().trim();

        if (totalKm > 0 && kalan) {
            setEtaGlobal(computeEtaIsoFrom(totalKm, kalan, baseIso));
        } else {
            setEtaGlobal("");
        }
    }, [editOpen, detailRows, seferTarihiYeni, editSefer, totalKm, kalanSuresi, mola]); // ⬅️ mola eklendi


    // editörde ETA veya Kalan Sürüş değiştikçe ana tabloda anında göster
    useEffect(() => {
        if (!editOpen || !editSefer) return;
        setRows(prev =>
            prev.map(r =>
                r.sefer_no === editSefer.sefer_no || r.id === editSefer.id
                    ? { ...r, eta: etaGlobal, kalan_surus_suresi: kalanSuresi }
                    : r
            )
        );
    }, [etaGlobal, kalanSuresi, editOpen, editSefer]);
    const filtered = useMemo(() => {
        let r = [...rows].filter(x => (x.reel_durum || "") !== "EŞLEŞME YOK");
        if (seferNoTipi) r = r.filter((x) => (x.sefer_no || "").toUpperCase().startsWith(seferNoTipi));
        if (plaka) r = r.filter((x) => (x.plaka || "").toLowerCase().includes(plaka.toLowerCase()));
        if (musteri) r = r.filter((x) => (x.musteri_adi || "").toLowerCase().includes(musteri.toLowerCase()));
        if (proje) r = r.filter((x) => (x.proje_adi || "").toLowerCase().includes(proje.toLowerCase()));
        if (yuklemeIl) r = r.filter((x) => (x.yukleme_ili || "") === yuklemeIl);
        if (teslimIl) r = r.filter((x) => (x.teslim_ili || "") === teslimIl);
        if (aracStatu) r = r.filter((x) => (x.arac_statu || "") === aracStatu);
        if (noktaSayisi) {
            const n = parseInt(noktaSayisi, 10);
            if (!Number.isNaN(n)) r = r.filter((x) => (x.nokta_sayisi || 0) === n);
        }
        if (quick) {
            const q = quick.toLowerCase();
            r = r.filter((x) => Object.values(x).some((v) => String(v ?? "").toLowerCase().includes(q)));
        }
        return r;
    }, [rows, seferNoTipi, plaka, musteri, proje, yuklemeIl, teslimIl, aracStatu, noktaSayisi, quick]);

    const sfrCount = useMemo(
        () => filtered.reduce((n, x) => n + ((x.sefer_no || "").toUpperCase().startsWith("SFR") ? 1 : 0), 0),
        [filtered]
    );

    /* ------- editor helper'ları ------- */
    const closeEditor = useCallback(() => {
        setEditOpen(false);
        setEditSefer(null);
        setDetailRows([]);
        setSeferTarihiYeni("");
        setMola("");
        setKayitliKm("");   // ⬅️ eklendi
        setYeniKm("");      // ⬅️ eklendi
        setKmAciklama("");  // ⬅️ eklendi
    }, []);

    // --- reel_km tablosundan kayıtlı km'leri oku (öncelik sefer_no, yoksa sefer_id)
    // --- reel_km tablosundan kayıtlı km'leri oku (öncelik sefer_no, yoksa sefer_id)

    const addDetailRow = useCallback(() => {
        setDetailRows((prev) => [
            ...prev,
            {
                sefer_id: editSefer?.id ?? null,
                nokta_sirasi: prev.length,
                proje_adi: "",
                yukleme_noktasi: "",
                yukleme_ili: "",
                yukleme_ilcesi: "",
                teslim_noktasi: "",
                teslim_ili: "",
                teslim_ilcesi: "",
                yukleme_varis: "",
                yukleme_cikis: "",
                teslim_varis: "",
                teslim_cikis: "",
            },
        ]);
    }, [editSefer]);

    const copyDetailRow = useCallback((idx) => {
        setDetailRows((prev) => {
            const r = prev[idx];
            const c = { ...r, nokta_sirasi: prev.length };
            return [...prev, c];
        });
    }, []);

    const removeDetailRow = useCallback((idx) => {
        setDetailRows((prev) => {
            const arr = prev.filter((_, i) => i !== idx);
            return arr.map((x, i) => ({ ...x, nokta_sirasi: i }));
        });
    }, []);

    const onDetailChange = useCallback(async (idx, key, value) => {
        // Önce değeri yaz
        setDetailRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

        // Nokta alanları değiştiyse reel_km'den km çekip kayitli_km'yi doldur (yeni_km girildiyse dokunma)
        if (key === "yukleme_noktasi" || key === "teslim_noktasi") {
            // Güncel satır değerlerini oku
            let current;
            setDetailRows(prev => {
                current = { ...prev[idx], [key]: value };
                return prev;
            });

            const hasUserKm = current?.yeni_km && String(current.yeni_km).trim() !== "";
            if (!hasUserKm) {
                const km = await getReelKmByNokta(current?.yukleme_noktasi, current?.teslim_noktasi);
                if (km) {
                    setDetailRows(prev => {
                        const next = prev.map((r, i) => i === idx ? { ...r, kayitli_km: km } : r);
                        // toplam kayitliKm'yi güncelle
                        const sum = next.reduce((a, rr) => a + parseKmNumber(rr.kayitli_km), 0);
                        setKayitliKm(sum > 0 ? String(Math.round(sum)) : "");
                        // 🔥 Ana grid satırına da yansıt
                            setRows(prevRows =>
                                prevRows.map(r =>
                                     r.sefer_no === (editSefer?.sefer_no) || r.id === (editSefer?.id)
                                        ? { ...r, kayitli_km: sum > 0 ? String(Math.round(sum)) : null }
                                    : r
                                    )
                                );
                        return next;
                    });
                }
            }
        }
    }, []);



    const saveDetails = useCallback(async () => {
        if (!editSefer) return;
        setSaving(true);

        try {
            // 1) sefer_detaylari upsert
            const upserts = detailRows.map((d, i) => ({
                sefer_id: editSefer.id,
                nokta_sirasi: i,
                proje_adi: clean(d.proje_adi),
                yukleme_noktasi: clean(d.yukleme_noktasi),
                yukleme_ili: clean(d.yukleme_ili),
                yukleme_ilcesi: clean(d.yukleme_ilcesi),
                teslim_noktasi: clean(d.teslim_noktasi),
                teslim_ili: clean(d.teslim_ili),
                teslim_ilcesi: clean(d.teslim_ilcesi),
                yukleme_varis: clean(d.yukleme_varis),
                yukleme_cikis: clean(d.yukleme_cikis),
                teslim_varis: clean(d.teslim_varis),
                teslim_cikis: clean(d.teslim_cikis),

                kayitli_km: clean(d.kayitli_km),
                yeni_km: clean(d.yeni_km),
                km_aciklama: clean(d.km_aciklama),

                // genel alanları satıra da yazıyoruz (isteğe bağlı)
                kalan_surus_suresi: clean(kalanSuresi),
                eta: clean(etaGlobal),

                arac_statu: computeAracStatu(detailRows) || null,
                kayit_zamani: new Date().toISOString(),
            }));

            const { error: detErr } = await supabase
                .from("sefer_detaylari")
                .upsert(upserts, { onConflict: "sefer_id,nokta_sirasi" });

            if (detErr) throw detErr;


                const kmRows = detailRows.map((d, i) => ({
                sefer_id: editSefer.id ?? null,
                    sefer_no: editSefer.sefer_no ?? null,
                    nokta_sirasi: i,
                    yukleme_noktasi: clean(d.yukleme_noktasi),
                    yukleme_ili: clean(d.yukleme_ili),
                    yukleme_ilcesi: clean(d.yukleme_ilcesi),
                    teslim_noktasi: clean(d.teslim_noktasi),
                    teslim_ili: clean(d.teslim_ili),
                    teslim_ilcesi: clean(d.teslim_ilcesi),
                    km: clean(d.yeni_km) || clean(d.kayitli_km) || null,
                    kayit_zamani: new Date().toISOString(),
                }));

            const { error: kmErr } = await supabase
                .from("reel_km")
                .upsert(kmRows, { onConflict: "sefer_no,nokta_sirasi" });

            if (kmErr) throw kmErr;

            // Upsert sonrası genel "Kayıtlı KM" toplamını güncelle
            const yeniToplam = (kmRows || []).reduce((acc, r) => acc + parseKmNumber(r.km), 0);
            setKayitliKm(yeniToplam > 0 ? String(Math.round(yeniToplam)) : "");


            // 2) seferler: SADECE eta ve kalan_surus_suresi
            // saniye ekleyip DB’ye öyle gönder
            const etaForDb = etaGlobal
                ? (etaGlobal.length === 16 ? `${etaGlobal}:00` : etaGlobal) // "YYYY-MM-DDTHH:MM" -> "...:SS"
                : null;

            const payload = {
                kalan_surus_suresi: clean(kalanSuresi),
                eta: clean(etaForDb),
                kayitli_km: yeniToplam > 0 ? String(Math.round(yeniToplam)) : null,
            };

            let mainErr = null;
            if (editSefer?.sefer_no) {
                const { error } = await supabase
                    .from("seferler")
                    .update(payload)
                    .eq("sefer_no", editSefer.sefer_no);
                mainErr = error;
            } else if (editSefer?.id) {
                const { error } = await supabase
                    .from("seferler")
                    .update(payload)
                    .eq("id", editSefer.id);
                mainErr = error;
            } else {
                throw new Error("Güncellenecek kayıt için id/sefer_no bulunamadı.");
            }
            if (mainErr) throw mainErr;

            // 3) UI state'ini güncelle
            setRows((prev) =>
                prev.map((r) =>
                    r.sefer_no === editSefer.sefer_no || r.id === editSefer.id
                        ? { ...r, ...payload, kayitli_km: payload.kayitli_km }
                        : r
                )
            );

            setSnack({ open: true, msg: "Detaylar kaydedildi.", severity: "success" });
        } catch (e) {
            console.error(e);
            setSnack({
                open: true,
                msg: `Kaydetme hatası: ${e?.message || e}`,
                severity: "error",
            });
        } finally {
            setSaving(false);
        }
    }, [detailRows, editSefer, kalanSuresi, etaGlobal]);

    const moveToCompleted = useCallback(async () => {
        if (!editSefer) return;
        if (!window.confirm("Bu sefer tamamlananlara aktarılacak. Devam edilsin mi?")) return;
        setSaving(true);
        try {
            const seferAna = rows.find((r) => r.id === editSefer.id) || editSefer;
            const seferTarihiFinal = seferTarihiYeni || seferAna.sefer_tarihi || null;

            const anaPayload = {
                arac_statu: seferAna.arac_statu ?? null,
                sefer_tarihi: seferTarihiFinal,
                sefer_no: seferAna.sefer_no ?? null,
                plaka: seferAna.plaka ?? null,
                treyler: seferAna.treyler ?? null,
                surucu_ad_soyad: seferAna.surucu_ad_soyad ?? null,
                surucu_tckn: seferAna.surucu_tckn ?? null,
                surucu_telefon: seferAna.surucu_telefon ?? null,
                musteri_adi: seferAna.musteri_adi ?? null,
                musteri_siparis_no: seferAna.musteri_siparis_no ?? null,
                hizmet_adi: seferAna.hizmet_adi ?? null,
                proje_adi: seferAna.proje_adi ?? null,
                yukleme_noktasi: seferAna.yukleme_noktasi ?? null,
                yukleme_ili: seferAna.yukleme_ili ?? null,
                yukleme_ilcesi: seferAna.yukleme_ilcesi ?? null,
                teslim_alan_firma: seferAna.teslim_alan_firma ?? null,
                teslim_noktasi: seferAna.teslim_noktasi ?? null,
                teslim_ili: seferAna.teslim_ili ?? null,
                teslim_ilcesi: seferAna.teslim_ilcesi ?? null,
                irsaliye_no: seferAna.irsaliye_no ?? null,
                kayit_zamani: new Date().toISOString(),
                atama_yapan_kullanici: seferAna.atama_yapan_kullanici ?? null,
                atama_tarihi: seferAna.atama_tarihi ?? null,
                // 🌟 Global alanlar ana kayıtta
                kalan_surus_suresi: clean(kalanSuresi || seferAna.kalan_surus_suresi),
                eta: clean(etaGlobal || seferAna.eta),
            };
            const { error: e1 } = await supabase
                .from("tamamlanan_seferler")
                .upsert(anaPayload, { onConflict: "sefer_no" });

            if (e1) throw e1;

            const detPayload = detailRows.map((d, i) => ({
                sefer_no: seferAna.sefer_no,
                nokta_sirasi: i,
                proje_adi: clean(d.proje_adi),
                yukleme_noktasi: clean(d.yukleme_noktasi),
                yukleme_ili: clean(d.yukleme_ili),
                yukleme_ilcesi: clean(d.yukleme_ilcesi),
                teslim_noktasi: clean(d.teslim_noktasi),
                teslim_ili: clean(d.teslim_ili),
                teslim_ilcesi: clean(d.teslim_ilcesi),
                yukleme_varis: clean(d.yukleme_varis),
                yukleme_cikis: clean(d.yukleme_cikis),
                teslim_varis: clean(d.teslim_varis),
                teslim_cikis: clean(d.teslim_cikis),

                kayitli_km: clean(d.kayitli_km),
                yeni_km: clean(d.yeni_km),
                km_aciklama: clean(d.km_aciklama),

                // 🌟 global değerler detaylara da
                kalan_surus_suresi: clean(kalanSuresi || seferAna.kalan_surus_suresi),
                eta: clean(etaGlobal || seferAna.eta),

                kayit_zamani: new Date().toISOString(),
                arac_statu: seferAna.arac_statu ?? null,
            }));
            if (detPayload.length) {
                const { error: e2 } = await supabase
                    .from("tamamlanan_detaylar")
                    .upsert(detPayload, { onConflict: "sefer_no,nokta_sirasi" });

                if (e2) throw e2;
            }

            // reel_km upsert (tamamlanan)
                const kmRowsCompleted = detailRows.map((d, i) => ({
                sefer_id: seferAna.id ?? null,
                    sefer_no: seferAna.sefer_no ?? null,
                    nokta_sirasi: i,
                    yukleme_noktasi: clean(d.yukleme_noktasi),
                    yukleme_ili: clean(d.yukleme_ili),
                    yukleme_ilcesi: clean(d.yukleme_ilcesi),
                    teslim_noktasi: clean(d.teslim_noktasi),
                    teslim_ili: clean(d.teslim_ili),
                    teslim_ilcesi: clean(d.teslim_ilcesi),
                    km: clean(d.yeni_km) || clean(d.kayitli_km) || null,
                    kayit_zamani: new Date().toISOString(),
                    }));
            const { error: kmDoneErr } = await supabase
                .from("reel_km")
                .upsert(kmRowsCompleted, { onConflict: "sefer_no,nokta_sirasi" });

                if (kmDoneErr) throw kmDoneErr;


            await supabase.from("sefer_detaylari").delete().eq("sefer_id", seferAna.id);
            await supabase.from("seferler").delete().eq("id", seferAna.id);

            setRows((prev) => prev.filter((r) => r.id !== seferAna.id));
            closeEditor();

            setSnack({ open: true, msg: "Tamamlananlara aktarıldı.", severity: "success" });
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Aktarım hatası.", severity: "error" });
        } finally { setSaving(false); }
    }, [detailRows, editSefer, rows, seferTarihiYeni, kalanSuresi, etaGlobal, closeEditor]);

    /* editor aç */
    const openEditor = useCallback(async (row, aktarModu = false) => {
        setEditSefer(row);
        setEditOpen(true);

        // id yoksa sefer_no ile çöz
        let id = row?.id ?? null;
        if (!id && row?.sefer_no) {
            const { data: s } = await supabase
                .from("seferler").select("id").eq("sefer_no", row.sefer_no).maybeSingle();
            id = s?.id ?? null;
        }
        if (id) setEditSefer((prev) => ({ ...(prev || row), id }));

        // detayları çek
        let detay = [];
        if (id) {
            const { data } = await supabase
                .from("sefer_detaylari")
                .select("*")
                .eq("sefer_id", id)
                .order("nokta_sirasi", { ascending: true });
            detay = data || [];
        }

        if (!detay.length) {
            const arrs = Object.fromEntries(detailFields.map((k) => [k, splitCell(row[k])]));
            const len = Math.max(1, ...detailFields.map((k) => arrs[k].length));
            const pick = (k, i) => (arrs[k][i] ?? "");
            detay = Array.from({ length: len }, (_, i) => ({
                sefer_id: id ?? null,
                nokta_sirasi: i,
                proje_adi: pick("proje_adi", i),
                yukleme_noktasi: pick("yukleme_noktasi", i),
                yukleme_ili: pick("yukleme_ili", i),
                yukleme_ilcesi: pick("yukleme_ilcesi", i),
                teslim_noktasi: pick("teslim_noktasi", i),
                teslim_ili: pick("teslim_ili", i),
                teslim_ilcesi: pick("teslim_ilcesi", i),
                yukleme_varis: pick("yukleme_varis", i),
                yukleme_cikis: pick("yukleme_cikis", i),
                teslim_varis: pick("teslim_varis", i),
                teslim_cikis: pick("teslim_cikis", i),
            }));
        }

        // --- reel_km: mevcut kayıtları çek (önce sefer_no, yoksa sefer_id)
        let rkRows = [];
        if (row?.sefer_no) {
            const { data: rk1, error: err1 } = await supabase
                .from("reel_km")
                .select("nokta_sirasi, km")
                .eq("sefer_no", row.sefer_no)
                .order("nokta_sirasi", { ascending: true });
            if (!err1 && rk1) rkRows = rk1;
        }
        if (!rkRows.length && id) {
            const { data: rk2, error: err2 } = await supabase
                .from("reel_km")
                .select("nokta_sirasi, km")
                .eq("sefer_id", id)
                .order("nokta_sirasi", { ascending: true });
            if (!err2 && rk2) rkRows = rk2;
        }

        // nokta_sirasi -> km map'i
        // nokta_sirasi -> km map'i
        const kmByIndex = new Map(rkRows.map(r => [r.nokta_sirasi, r.km]));

        // 1) reel_km (nokta eşleşmesi) önerilerini topla
        const noktaKmArr = await Promise.all(
            detay.map((d) => getReelKmByNokta(d.yukleme_noktasi, d.teslim_noktasi))
        );

        // 2) detailRows'u km önceliğiyle kur:
        //    a) satırın kendi kayitli_km'si
        //    b) sefer_no/nokta_sirasi eşleşmesi (kmByIndex)
        //    c) reel_km (yukleme_noktasi+teslim_noktasi) eşleşmesi
        //    d) ""
        const hydratedRows = detay.map((d) => {
            const idx = d.nokta_sirasi;
            const fromIndex = kmByIndex.get(idx);
            const fromNokta = noktaKmArr[idx];
            const kayitli =
                (d.kayitli_km && String(d.kayitli_km).trim() !== "") ? d.kayitli_km
                    : (fromIndex && String(fromIndex).trim() !== "") ? fromIndex
                        : (fromNokta && String(fromNokta).trim() !== "") ? fromNokta
                            : "";

            return {
                ...d,
                proje_adi: d.proje_adi ?? "",
                yukleme_noktasi: d.yukleme_noktasi ?? "",
                yukleme_ili: d.yukleme_ili ?? "",
                yukleme_ilcesi: d.yukleme_ilcesi ?? "",
                teslim_noktasi: d.teslim_noktasi ?? "",
                teslim_ili: d.teslim_ili ?? "",
                teslim_ilcesi: d.teslim_ilcesi ?? "",
                yukleme_varis: d.yukleme_varis ?? "",
                yukleme_cikis: d.yukleme_cikis ?? "",
                teslim_varis: d.teslim_varis ?? "",
                teslim_cikis: d.teslim_cikis ?? "",

                kayitli_km: kayitli,
                yeni_km: d.yeni_km ?? "",
                km_aciklama: d.km_aciklama ?? "",
            };
        });

        setDetailRows(hydratedRows);

        // Genel "Kayıtlı KM" toplamını (satır bazlı) güncelle
        const toplamKayitli = hydratedRows.reduce((acc, r) => acc + parseKmNumber(r.kayitli_km), 0);
        setKayitliKm(toplamKayitli > 0 ? String(Math.round(toplamKayitli)) : "");

        // 🔥 Ana grid satırına anında yansıt (Kaydet'e basmadan da görünür)
            setRows(prev =>
                 prev.map(r =>
                    r.sefer_no === (row?.sefer_no ?? editSefer?.sefer_no) || r.id === (row?.id ?? editSefer?.id)
                        ? { ...r, kayitli_km: toplamKayitli > 0 ? String(Math.round(toplamKayitli)) : null }
                    : r
                    )
                );
        /* 🔥 EDITÖR AÇILIR AÇILMAZ: TOPLAM KM + İLK ETA */
        try {
            const km = await computeTotalDistanceKm(detay);
            setTotalKm(km);

            const baseIsoRaw =
                getEarliestYuklemeCikisIso(detay)
                || (row?.sefer_tarihi || seferTarihiYeni)
                || toLocalIso(new Date());

            // ✅ Cumartesi 08:00–17:00 ise +1 gün uygula
            let baseIso = applySaturdayRule(baseIsoRaw);

            // ⬇️ yeni: editör ilk açıldığında seçili mola varsa uygula
            if (mola === "45") baseIso = addMinutesToIso(baseIso, 45);
            else if (mola === "660") baseIso = addMinutesToIso(baseIso, 660);

            const kalan = (row?.kalan_surus_suresi || "").toString().trim();
            if (km > 0 && kalan) {
                setEtaGlobal(computeEtaIsoFrom(km, kalan, baseIso));
            }
        } catch (e) {
            console.error("openEditor km/eta:", e);
            setTotalKm(0);
        }

        if (aktarModu) {
            setSnack({
                open: true,
                msg: "Detayları kontrol edip 'Tamamlananlara Aktar' ile işlemi bitirin.",
                severity: "info",
            });
        }
    }, []); // <-- useCallback kapanışı

    const formatEta = (val) => {
        if (!val) return "";
        const s = String(val).replace(" ", "T");   // "YYYY-MM-DD HH:MM" gelirse normalize et
        const d = s.slice(0, 10);                  // YYYY-MM-DD
        const t = s.slice(11, 16);                 // HH:MM
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) {
            // tanınmazsa ham hâliyle göster
            return String(val);
        }
        const [y, m, dd] = d.split("-");
        return `${dd}.${m}.${y} ${t}`;             // "gg.aa.yyyy ss:dd"
    };



    /* grid columns */
    /* grid columns */
    const columns = useMemo(() => {
        const txt = (f, t, w = 170) => ({ field: f, headerName: t, width: w, sortable: true });

        return [
            {
                field: "actions",
                headerName: "İşlem",
                width: 140,
                sortable: false,
                filterable: false,
                renderCell: (p) => (
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Detayları Düzenle">
                            <IconButton size="small" onClick={() => openEditor(p.row)}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Tamamlananlara Aktar">
                            <IconButton
                                size="small"
                                color="success"
                                onClick={() => openEditor(p.row, true)}
                            >
                                <FileDownloadDoneIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                ),
            },
            {
                field: "reel_durum",
                headerName: "REEL DURUM",
                width: 150,
                renderCell: (p) => {
                    const raw = p.row.reel_durum || "-";
                    const v = raw === "EŞLEŞTİ" || raw === "GÜNCELLENDİ" ? "ESKİ" : raw;
                    const color = v === "YENİ" ? "info" : "default";
                    return (
                        <Chip label={v} size="small" color={color} sx={{ fontWeight: 700 }} />
                    );
                },
            },
            { field: "nokta_sayisi", headerName: "NOKTA", width: 100, align: "center", headerAlign: "center" },
            txt("sefer_no", "Sefer No", 160),
            txt("statu", "Statü", 160),
            txt("plaka", "Plaka", 130),
            txt("musteri_adi", "Müşteri", 240),
            txt("proje_adi", "Proje", 240),

            // ✅ YENİ: ETA ve Kalan Sürüş Süresi sütunları
            {
                field: "eta",
                headerName: "ETA",
                width: 190,
                sortable: true,
                renderCell: (p) => formatEta(p.row?.eta),
            },
            txt("kalan_surus_suresi", "Kalan Sürüş (ss:dd)", 170),

            txt("sefer_tarihi", "Sefer Tarihi", 190),
            txt("atama_yapan_kullanici", "Atayan", 170),
            txt("arac_statu", "Araç Statü", 210),

            // 🔽 Eklenen sütunlar
            txt("yukleme_ili", "Yükleme İl", 160),
            txt("yukleme_ilcesi", "Yükleme İlçe", 160),
            txt("teslim_ili", "Teslim İl", 160),
            txt("teslim_ilcesi", "Teslim İlçe", 160),

            txt("treyler", "Treyler", 160),
            txt("surucu_ad_soyad", "Sürücü", 200),
            txt("surucu_tckn", "TC", 150),
            txt("surucu_telefon", "Telefon", 170),
            txt("musteri_siparis_no", "Sipariş No", 190),
            txt("hizmet_adi", "Hizmet", 190),
            txt("yukleme_noktasi", "Yükleme Noktası", 280),
            txt("teslim_noktasi", "Teslim Noktası", 280),
            txt("kayitli_km", "Kayıtlı KM", 130),
            txt("yeni_km", "Yeni KM", 130),
            txt("km_aciklama", "KM Açıklama", 220),
            txt("irsaliye_no", "İrsaliye No", 170),
            txt("kayit_zamani", "Kayıt Zamanı", 190),
            txt("atama_tarihi", "Atama Tarihi", 190),
        ];
    }, [openEditor]);



    /* sabit UI config */
    const baseInputSX = {
        "& .MuiInputBase-root": {
            backgroundColor: COLORS.surface2,
            color: COLORS.text,
            borderRadius: 1.2,
            border: `1px solid ${COLORS.border}`,
            fontSize: 14,
        },
        "& .MuiInputBase-input": { py: 1.05 },
        "& .MuiInputLabel-root": { color: COLORS.textMuted },
        "& .MuiFormLabel-root.Mui-focused": { color: COLORS.textMuted },
    };

    const canSync = (() => {
        const allowed = new Set(["admin", "selin", "bekirakcagoz","buketcimenci"]);
        const name = (localStorage.getItem("kullaniciAdi") || "")
            .toLocaleLowerCase("tr-TR"); // Türkçe duyarlı

        return allowed.has(name);
    })();

    /* --------------- RENDER --------------- */
    return (
        <Box
            sx={{
                height: "100dvh",
                display: "grid",
                gridTemplateRows: "auto auto 1fr",
                gap: 1.5,
                p: 2,
                background: COLORS.pageBg,
                color: COLORS.text,
            }}
        >
            <Helmet><title>AKTİF SEFERLER</title></Helmet>

            {/* Başlık + aksiyonlar */}
            <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                spacing={1}
            >
                <Stack spacing={0.25}>
                    <Typography
                        variant="h5"
                        fontWeight={900}
                        sx={{
                            lineHeight: 1.1,
                            background: "linear-gradient(90deg,#F472B6,#38BDF8)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        Aktif Seferler
                    </Typography>
                    <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                        {(() => {
                            const eskiST = fromISOToCombined(editSefer?.sefer_tarihi || "") || "-";
                            const yeniST = fromISOToCombined(seferTarihiYeni || "") || "-";
                            const st = computeAracStatu(detailRows) || "—";
                            return (eskiST !== yeniST)
                                ? `Sefer Tarihi (Eski/Yeni): ${eskiST} / ${yeniST} • ${st}`
                                : `Sefer Tarihi: ${eskiST} • ${st}`;
                        })()}
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    {/* ✅ Geri & Anasayfa */}
                    <Button
                        size="small"
                        variant="text"
                        startIcon={<ArrowBackIosNewIcon />}
                        onClick={() => navigate(-1)}
                    >
                        Geri
                    </Button>
                    <Button
                        size="small"
                        variant="text"
                        startIcon={<HomeOutlinedIcon />}
                        onClick={() => navigate("/anasayfa")}   // <-- değişiklik
                    >
                        Anasayfa
                    </Button>

                    <FormControlLabel
                        control={<Switch checked={dense} onChange={() => setDense(v => !v)} size="small" />}
                        label="Sıkı satırlar"
                        sx={{ color: COLORS.textMuted }}
                    />

                    <Chip label={`SFR: ${sfrCount}`} size="small" color="info" sx={{ fontWeight: 800 }} />

                    <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={listData}>
                        Listele
                    </Button>
                    <Button variant="contained" startIcon={<SyncIcon />} onClick={syncData} disabled={!canSync}>
                        Senkronize Et
                    </Button>
                </Stack>
            </Stack>

            {/* Filtreler */}
            <Paper sx={{
                p: 1.2, borderRadius: 2, display: "grid", gridTemplateColumns: "repeat(12, 1fr)",
                gap: 1, background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            }}>
                <TextField label="Başlangıç" type="date" size="small" value={startDate}
                    onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }} />
                <TextField label="Bitiş" type="date" size="small" value={endDate}
                    onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }} />
                <TextField label="Sefer No Tipi" select size="small" value={seferNoTipi}
                    onChange={(e) => setSeferNoTipi(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}>
                    <MenuItem value="">Tümü</MenuItem>
                    <MenuItem value="BOS">BOS…</MenuItem>
                    <MenuItem value="SFR">SFR…</MenuItem>
                </TextField>

                <TextField label="Plaka" select size="small" value={plaka}
                    onChange={(e) => setPlaka(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}>
                    <MenuItem value="">Tümü</MenuItem>
                    {options.plaka.map((v) => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField>

                <TextField label="Müşteri" select size="small" value={musteri}
                    onChange={(e) => setMusteri(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}>
                    <MenuItem value="">Tümü</MenuItem>
                    {options.musteri_adi.map((v) => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField>

                <TextField label="Proje" select size="small" value={proje}
                    onChange={(e) => setProje(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}>
                    <MenuItem value="">Tümü</MenuItem>
                    {options.proje_adi.map((v) => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField>

                <TextField label="Yükleme İl" select size="small" value={yuklemeIl}
                    onChange={(e) => setYuklemeIl(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}>
                    <MenuItem value="">Tümü</MenuItem>
                    {options.yukleme_ili.map((v) => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField>

                <TextField label="Teslim İl" select size="small" value={teslimIl}
                    onChange={(e) => setTeslimIl(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}>
                    <MenuItem value="">Tümü</MenuItem>
                    {options.teslim_ili.map((v) => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField>

                <TextField label="Araç Statü" select size="small" value={aracStatu}
                    onChange={(e) => setAracStatu(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}>
                    <MenuItem value="">Tümü</MenuItem>
                    {options.arac_statu.map((v) => (<MenuItem key={v} value={v}>{v}</MenuItem>))}
                </TextField>

                <TextField label="Nokta" type="number" size="small" value={noktaSayisi}
                    onChange={(e) => setNoktaSayisi(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }} />

                <TextField label="Ara (metin)" size="small" value={quick}
                    onChange={(e) => setQuick(e.target.value)} placeholder="metin ara…"
                    sx={{ gridColumn: { xs: "span 12", md: "span 2" }, ...baseInputSX }} />
            </Paper>

            {/* Liste */}
            <Paper sx={{
                borderRadius: 3, border: `1px solid ${COLORS.border}`, overflow: "hidden",
                minHeight: 0, display: "grid", background: COLORS.surface,
            }}>
                <DataGrid
                    rows={filtered}
                    columns={columns}
                    getRowId={(r) => r._rid}
                    loading={loading}
                    disableRowSelectionOnClick
                    hideFooter
                    density={dense ? "compact" : "standard"}
                    rowHeight={dense ? 40 : 46}
                    columnHeaderHeight={dense ? 46 : 52}
                    sx={{
                        border: "none",
                        color: COLORS.text,
                        "& .MuiDataGrid-virtualScroller": { backgroundColor: COLORS.surface },
                        "& .MuiDataGrid-columnHeaders": {
                            background: COLORS.surface2, color: COLORS.text,
                            borderBottom: `1px solid ${COLORS.border}`, fontWeight: 800, fontSize: 14.5,
                        },
                        "& .MuiDataGrid-cell": {
                            borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap",
                            textOverflow: "ellipsis", overflow: "hidden", fontSize: 14.5,
                        },
                        "& .MuiDataGrid-row:nth-of-type(2n) .MuiDataGrid-cell": { backgroundColor: COLORS.zebra },
                    }}
                />
            </Paper>

            {/* Kaydet/Sync overlay */}
            <Backdrop open={saving} sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 1 }}>
                <CircularProgress color="inherit" />
                <Typography sx={{ ml: 2 }}>İşleniyor…</Typography>
            </Backdrop>

            {/* Sync success toast */}
            {showSuccess && (
                <Box sx={{
                    position: "fixed", top: 16, right: 16, bgcolor: "success.main",
                    color: "#fff", px: 2, py: 1, borderRadius: 2, boxShadow: 3, fontWeight: 700, zIndex: 1300,
                }}>
                    {successCount} kayıt güncellendi.
                </Box>
            )}

            {/* Snackbar */}
            <Snackbar open={snack.open} autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
                <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
                    {snack.msg}
                </Alert>
            </Snackbar>

            {/* Detay Editör */}
            <Dialog
                open={editOpen}
                onClose={closeEditor}
                fullWidth
                maxWidth="xl"
                PaperProps={{ sx: { backgroundColor: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}` } }}
            >
                <DialogTitle sx={{ fontWeight: 900 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {editSefer?.sefer_no || "-"} • {editSefer?.plaka || "-"} • {editSefer?.musteri_adi || "-"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                        {computeAracStatu(detailRows) || "—"}
                    </Typography>
                </DialogTitle>

                <DialogContent dividers sx={{ backgroundColor: alpha("#fff", 0.01) }}>
                    {/* Sefer tarihi eski / yeni */}
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 1,
                            mb: 1.2,
                        }}
                    >
                        <TextField
                            label="Sefer Tarihi (Eski)"
                            size="small"
                            value={fromISOToCombined(editSefer?.sefer_tarihi || "")}
                            InputProps={{ readOnly: true }}
                            InputLabelProps={{ shrink: true }}
                            sx={baseInputSX}
                        />
                        <DateTimeOneField
                            label="Sefer Tarihi (Yeni)"
                            value={seferTarihiYeni || ""}
                            onChange={(val) => setSeferTarihiYeni(val)}
                            sx={baseInputSX}
                        />
                    </Box>

                    {/* ✅ GENEL ALANLAR: sadece 1 kez */}
                    <Card
                        variant="outlined"
                        sx={{ borderColor: COLORS.border, background: COLORS.surface2, borderRadius: 2, mb: 1.2 }}
                    >
                        <CardHeader
                            title="Genel Alanlar"
                            sx={{
                                "& .MuiCardHeader-title": { fontWeight: 800, fontSize: 16 },
                                pb: 0.5,
                            }}
                        />
                        <CardContent sx={{ pt: 1.5 }}>
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                    gap: 1,
                                }}
                            >
                                <TimeHMField
                                    label="Kalan Sürüş Süresi (ss.dd)"
                                    value={kalanSuresi}
                                    onChange={(val) => setKalanSuresi(val)}
                                    sx={baseInputSX}
                                />

                                {/* ⬇️ yeni: Mola seçimi */}
                                <TextField
                                    select
                                    label="Mola"
                                    value={mola}
                                    onChange={(e) => setMola(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={baseInputSX}
                                >
                                    <MenuItem value="">Yok</MenuItem>
                                    <MenuItem value="45">45 dakika</MenuItem>
                                    <MenuItem value="660">11 saat</MenuItem>
                                </TextField>

                                <TextField
                                    label="ETA (otomatik)"
                                    value={etaGlobal ? fromISOToCombined(etaGlobal) : ""}
                                    InputProps={{ readOnly: true }}
                                    InputLabelProps={{ shrink: true }}
                                    sx={baseInputSX}
                                />

                                <TextField
                                    label="Kayıtlı KM"
                                    value={kayitliKm}
                                    InputProps={{ readOnly: true }}
                                    InputLabelProps={{ shrink: true }}
                                    sx={baseInputSX}
                                />


                                <TextField
                                    label="Yeni KM"
                                    value={yeniKm}
                                    onChange={(e) => setYeniKm(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={baseInputSX}
                                />

                                <TextField
                                    label="KM Açıklama"
                                    value={kmAciklama}
                                    onChange={(e) => setKmAciklama(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={baseInputSX}
                                />

                                <Typography variant="caption" sx={{ color: COLORS.textMuted, alignSelf: "center" }}>
                                    {totalKm > 0
                                        ? `Toplam km: ${Math.round(totalKm)} • Kalan sürüş: ${kalanSuresi || "—"}`
                                        : 'Mesafe kaydı bulunamadığı için ETA hesaplanamadı'}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Satır ekle butonu ve ipucu */}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Button startIcon={<AddIcon />} onClick={addDetailRow} color="info" variant="contained">
                            Satır Ekle
                        </Button>
                        <Typography variant="body2" sx={{ color: COLORS.textMuted }}>
                            Tarih ve saati tek alana yazın: <b>gg.aa.yyyy ss:dd</b> (ör: 13.05.2025 09:35)
                        </Typography>
                    </Stack>

                    {/* Nokta kartları */}
                    <Grid container spacing={1.2}>
                        {detailRows.map((r, i) => (
                            <Grid item xs={12} key={i}>
                                <Card
                                    variant="outlined"
                                    sx={{ borderColor: COLORS.border, background: COLORS.surface2, borderRadius: 2 }}
                                >
                                    <CardHeader
                                        sx={{
                                            "& .MuiCardHeader-title": { fontWeight: 800, fontSize: 16 },
                                            "& .MuiCardHeader-subheader": { color: COLORS.textMuted },
                                            pb: 0.5,
                                        }}
                                        title={`${i + 1}. Nokta`}
                                        subheader={
                                            r.yukleme_ili || r.teslim_ili ? `${r.yukleme_ili ?? ""} → ${r.teslim_ili ?? ""}` : ""
                                        }
                                        action={
                                            <Stack direction="row" spacing={0.5}>
                                                <Tooltip title="Bu satırı kopyala">
                                                    <IconButton onClick={() => copyDetailRow(i)} size="small" color="info">
                                                        <ContentCopyIcon fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Satırı sil">
                                                    <IconButton onClick={() => removeDetailRow(i)} size="small" color="error">
                                                        <DeleteIcon fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        }
                                    />
                                    <CardContent sx={{ pt: 1.5 }}>
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                                gap: 1,
                                            }}
                                        >
                                            {[
                                                ["proje_adi", "Proje Adı"],
                                                ["yukleme_noktasi", "Yükleme Noktası"],
                                                ["yukleme_ili", "Yükleme İl"],
                                                ["yukleme_ilcesi", "Yükleme İlçe"],
                                                ["teslim_noktasi", "Teslim Noktası"],
                                                ["teslim_ili", "Teslim İl"],
                                                ["teslim_ilcesi", "Teslim İlçe"],
                                            ].map(([key, label]) => (
                                                <TextField
                                                    key={key}
                                                    label={label}
                                                    size="small"
                                                    value={r[key]}
                                                    onChange={(e) => onDetailChange(i, key, e.target.value)}
                                                    sx={baseInputSX}
                                                />
                                            ))}

                                            {[
                                                ["yukleme_varis", "Yükleme Varış"],
                                                ["yukleme_cikis", "Yükleme Çıkış"],
                                                ["teslim_varis", "Teslim Varış"],
                                                ["teslim_cikis", "Teslim Çıkış"],
                                            ].map(([key, label]) => (
                                                <DateTimeOneField
                                                    key={key}
                                                    label={label}
                                                    value={r[key] || ""}
                                                    onChange={(val) => onDetailChange(i, key, val)}
                                                    sx={baseInputSX}
                                                />
                                            ))}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}

                        {detailRows.length === 0 && (
                            <Grid item xs={12}>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        textAlign: "center",
                                        color: COLORS.textMuted,
                                        borderColor: COLORS.border,
                                        background: COLORS.surface2,
                                    }}
                                >
                                    Detay satırı yok. “Satır Ekle” ile başlayın.
                                </Paper>
                            </Grid>
                        )}
                    </Grid>

                    <Divider sx={{ my: 1.5, borderColor: COLORS.border }} />
                    <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                        İpucu: Satır başındaki <b>kopyala</b> ile seri veri girişi çok hızlanır.
                    </Typography>
                </DialogContent>


                <DialogActions sx={{ p: 2 }}>
                    <Button startIcon={<SaveIcon />} onClick={saveDetails} variant="outlined">Kaydet</Button>
                    <Button startIcon={<FileDownloadDoneIcon />} color="success" variant="contained" onClick={moveToCompleted}>
                        Tamamlananlara Aktar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
