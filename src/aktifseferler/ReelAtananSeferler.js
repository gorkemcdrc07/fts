import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import ExcelAktarim from "./butonlar/ExcelAktarım";



/* MUI */
import {
    Box, Paper, Stack, Button, Typography, TextField, Snackbar, Alert,
    Backdrop, CircularProgress, Chip, Switch, FormControlLabel
} from "@mui/material";
import { DataGrid, useGridApiRef } from "@mui/x-data-grid";

/* Icons */
import ListeleButton from "./butonlar/listele";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

/* Modüller */
import Filtreler from "./filtreler";
import SenkronizeEtButton from "./butonlar/senkronizeEt";
import { COLORS } from "./constants/colors";

/* sefer utils */
import {
    isExcludedPlate, splitCell, clean, detailFields, computeAracStatu
} from "./utils/sefer";

/* yardımcılar */
import buildColumns from "./columns";
import { fromISOToCombined } from "./utils/datetime";
import { fetchSeferler, fetchTamamlananNos, loadDetaylar, updateSefer, upsertDetaylar } from "./services";
import usePermissions from "../auth/usePermissions";

// ------------------ HELPER FONKSİYON ------------------
function isISODateTimeValid(isoString) {
    if (!isoString) return false;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoString)) return false;
    const d = new Date(isoString);
    return !isNaN(d.getTime());
}


// -------------- BÖLGE HARİTASI ----------------
const ilToBolgeMap = {
    ADANA: "Doğu Bölgesi", ADIYAMAN: "Doğu Bölgesi", AFYON: "İç Anadolu Bölgesi", AĞRI: "Doğu Bölgesi",
    AMASYA: "Karadeniz Bölgesi", ANKARA: "İç Anadolu Bölgesi", ANTALYA: "Ege Bölgesi", ARTVİN: "Karadeniz Bölgesi",
    AYDIN: "Ege Bölgesi", BALIKESİR: "Ege Bölgesi", BARTIN: "Karadeniz Bölgesi", BATMAN: "Doğu Bölgesi",
    BAYBURT: "Karadeniz Bölgesi", BİLECİK: "İç Anadolu Bölgesi", BİNGÖL: "Doğu Bölgesi", BİTLİS: "Doğu Bölgesi",
    BOLU: "Karadeniz Bölgesi", BURDUR: "Ege Bölgesi", BURSA: "Ege Bölgesi", ÇANAKKALE: "Trakya Bölgesi",
    ÇANKIRI: "İç Anadolu Bölgesi", ÇORUM: "İç Anadolu Bölgesi", DENİZLİ: "Ege Bölgesi", DİYARBAKIR: "Doğu Bölgesi",
    DÜZCE: "Karadeniz Bölgesi", EDİRNE: "Trakya Bölgesi", ELAZIĞ: "Doğu Bölgesi", ERZİNCAN: "Doğu Bölgesi",
    ERZURUM: "Doğu Bölgesi", ESKİŞEHİR: "İç Anadolu Bölgesi", GAZİANTEP: "Doğu Bölgesi", GİRESUN: "Karadeniz Bölgesi",
    GÜMÜŞHANE: "Karadeniz Bölgesi", HAKKARİ: "Doğu Bölgesi", HATAY: "Doğu Bölgesi", ISPARTA: "Ege Bölgesi",
    MERSİN: "Doğu Bölgesi", İSTANBUL: "Marmara Bölgesi", İZMİR: "Ege Bölgesi", KAHRAMANMARAŞ: "Doğu Bölgesi",
    KARABÜK: "Karadeniz Bölgesi", KARAMAN: "İç Anadolu Bölgesi", KARS: "Doğu Bölgesi", KASTAMONU: "Karadeniz Bölgesi",
    KAYSERİ: "İç Anadolu Bölgesi", KİLİS: "Doğu Bölgesi", KIRIKKALE: "İç Anadolu Bölgesi",
    KIRKLARELİ: "Trakya Bölgesi", KIRŞEHİR: "İç Anadolu Bölgesi", KOCAELİ: "Kocaeli Bölgesi",
    KONYA: "İç Anadolu Bölgesi", KÜTAHYA: "İç Anadolu Bölgesi", MALATYA: "Doğu Bölgesi", MANİSA: "Ege Bölgesi",
    MARDİN: "Doğu Bölgesi", MUĞLA: "Ege Bölgesi", MUŞ: "Doğu Bölgesi", NEVŞEHİR: "İç Anadolu Bölgesi",
    NİĞDE: "İç Anadolu Bölgesi", ORDU: "Karadeniz Bölgesi", OSMANİYE: "Doğu Bölgesi", RİZE: "Karadeniz Bölgesi",
    SAKARYA: "Kocaeli Bölgesi", SAMSUN: "Karadeniz Bölgesi", SİİRT: "Doğu Bölgesi", SİNOP: "Karadeniz Bölgesi",
    SİVAS: "İç Anadolu Bölgesi", ŞANLIURFA: "Doğu Bölgesi", ŞIRNAK: "Doğu Bölgesi", TEKİRDAĞ: "Trakya Bölgesi",
    TOKAT: "Karadeniz Bölgesi", TRABZON: "Karadeniz Bölgesi", TUNCELİ: "Doğu Bölgesi", UŞAK: "Ege Bölgesi",
    VAN: "Doğu Bölgesi", YALOVA: "Ege Bölgesi", YOZGAT: "İç Anadolu Bölgesi", ZONGULDAK: "Karadeniz Bölgesi",
    AKSARAY: "İç Anadolu Bölgesi",

    // İSTANBUL özel
    ADALAR: "Kocaeli Bölgesi", ATAŞEHİR: "Kocaeli Bölgesi", BEYKOZ: "Kocaeli Bölgesi",
    KADIKÖY: "Kocaeli Bölgesi", KARTAL: "Kocaeli Bölgesi", MALTEPE: "Kocaeli Bölgesi",
    PENDİK: "Kocaeli Bölgesi", SANCAKTEPE: "Kocaeli Bölgesi", SULTANBEYLİ: "Kocaeli Bölgesi",
    TUZLA: "Kocaeli Bölgesi", ÜMRANİYE: "Kocaeli Bölgesi", ÜSKÜDAR: "Kocaeli Bölgesi",

    ARNAVUTKÖY: "Marmara Bölgesi", AVCILAR: "Marmara Bölgesi", BAĞCILAR: "Marmara Bölgesi",
    BAHÇELİEVLER: "Marmara Bölgesi", BAKIRKÖY: "Marmara Bölgesi", BAŞAKŞEHİR: "Marmara Bölgesi",
    BAYRAMPAŞA: "Marmara Bölgesi", BEYLİKDÜZÜ: "Marmara Bölgesi", BEYOĞLU: "Marmara Bölgesi",
    BÜYÜKÇEKMECE: "Marmara Bölgesi", ÇATALCA: "Marmara Bölgesi", ESENLER: "Marmara Bölgesi",
    ESENYURT: "Marmara Bölgesi", EYÜPSULTAN: "Marmara Bölgesi", FATİH: "Marmara Bölgesi",
    SARIYER: "Marmara Bölgesi", ŞİŞLİ: "Marmara Bölgesi", ZEYTİNBURNU: "Marmara Bölgesi",
};

function getBolge(il, ilce) {
    if (!il) return "—";

    // İlk parçayı al (örn: "GAZİANTEP; GAZİANTEP")
    const parsePart = (v) => {
        if (!v) return null;
        return String(v).split(";")[0].trim().toLocaleUpperCase("tr-TR");
    };

    const normIl = parsePart(il);
    const normIlce = parsePart(ilce);

    // Önce ilçe eşleşmesi önemli
    if (normIlce && ilToBolgeMap[normIlce]) {
        return ilToBolgeMap[normIlce];
    }

    // İl üzerinden bölgeyi bul
    return ilToBolgeMap[normIl] || "—";
}


/* Diyaloglar */
const EditorDialog = lazy(() => import("./dialogs/EditorDialog"));
const ETAEditor = lazy(() => import("./dialogs/ETAEditor"));

/* küçük inputlar */
function DateTimeOneField(props) {
    return <TextField type="datetime-local" size="small" InputLabelProps={{ shrink: true }} {...props} />;
}

export default function ReelAtananSeferler() {
    /* DataGrid apiRef + kullanıcı anahtarları */
    const apiRef = useGridApiRef();

    // *** DÜZENLEYİCİYLE AYNI ANAHTAR ***
    const USERKEY = (localStorage.getItem("kullaniciAdi") || "GENERIC").toUpperCase();
    const ORDER_KEY = `aktifseferler.columnOrder.${USERKEY}`;
    const HIDDEN_KEY = `aktifseferler.hiddenColumns.${USERKEY}`;
    const GENERIC_ORDER_KEY = `aktifseferler.columnOrder.GENERIC`;
    const GENERIC_HIDDEN_KEY = `aktifseferler.hiddenColumns.GENERIC`;

    // gizli kolon modelini yükle
    const [columnVisibilityModel, setColumnVisibilityModel] = useState(() => {
        try {
            const hiddenList = JSON.parse(
                localStorage.getItem(HIDDEN_KEY) ||
                localStorage.getItem(GENERIC_HIDDEN_KEY) ||
                "[]"
            );
            const m = {};
            (hiddenList || []).forEach((f) => { m[f] = false; });
            return m;
        } catch {
            return {};
        }
    });

    const [viewBump, setViewBump] = useState(localStorage.getItem("aktifseferler.view.bump") || "0");

    // *** BUMP/FOCUS ile yeniden yükle ***
    useEffect(() => {
        const onStorage = (e) => {
            if (!e) return;
            if (["aktifseferler.view.bump", ORDER_KEY, HIDDEN_KEY].includes(e.key)) {
                setViewBump(String(Date.now()));
            }
        };
        const onFocus = () => setViewBump(String(Date.now()));
        const onCustom = () => setViewBump(String(Date.now()));

        window.addEventListener("storage", onStorage);
        window.addEventListener("focus", onFocus);
        window.addEventListener("aktifseferler:view:changed", onCustom);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("aktifseferler:view:changed", onCustom);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // *** GİZLİ KOLON MODELİNİ viewBump DEĞİŞİNCE TEKRAR OKU ***
    useEffect(() => {
        try {
            const hiddenList = JSON.parse(
                localStorage.getItem(HIDDEN_KEY) ||
                localStorage.getItem(GENERIC_HIDDEN_KEY) ||
                "[]"
            ) || [];
            const m = {};
            hiddenList.forEach((f) => { m[f] = false; });
            setColumnVisibilityModel(m);
        } catch { /* ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewBump]);

    const navigate = useNavigate();
    // Yetkiler
    const { loading: permsLoading, flags = {} } = usePermissions("aktif_seferler");

    // FLAGS
    const {
        aktif_can_sync = false, aktif_can_edit = false, aktif_may_open_edit = false, aktif_can_delete = false,
        aktif_seferler_can_sync = false, aktif_seferler_can_edit = false, aktif_seferler_may_open_edit = false, aktif_seferler_can_delete = false,
        admin = false, is_admin = false, role = "",
    } = flags;

    const toBool = (v) => {
        if (typeof v === "boolean") return v;
        if (typeof v === "number") return v === 1;
        if (v == null) return false;
        const s = String(v).trim().toLowerCase();
        return s === "true" || s === "1" || s === "yes" || s === "y" || s === "on";
    };

    const isAdminBypass =
        toBool(admin) ||
        toBool(is_admin) ||
        String(role).toLowerCase() === "admin" ||
        toBool(localStorage.getItem("isAdmin")) ||
        toBool(localStorage.getItem("admin"));

    const rawCanSync = (aktif_can_sync ?? aktif_seferler_can_sync ?? false);
    const rawCanEdit = (aktif_can_edit ?? aktif_seferler_can_edit ?? false);
    const rawMayOpen = (aktif_may_open_edit ?? aktif_seferler_may_open_edit ?? false);
    const rawCanDelete = (aktif_can_delete ?? aktif_seferler_can_delete ?? aktif_can_edit ?? aktif_seferler_can_edit ?? false);

    const canSync = isAdminBypass || toBool(rawCanSync);
    const canEdit = isAdminBypass || toBool(rawCanEdit);
    const mayOpenEdit = isAdminBypass || toBool(rawMayOpen);
    const canDelete = isAdminBypass || toBool(rawCanDelete);

    /* data */
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    /* filters */
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 6);
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    });
    const [seferNoTipi, setSeferNoTipi] = useState("");
    const [quick, setQuick] = useState("");
    const [plaka, setPlaka] = useState("");
    const [musteri, setMusteri] = useState("");
    const [proje, setProje] = useState("");
    const [yuklemeIl, setYuklemeIl] = useState("");
    const [teslimIl, setTeslimIl] = useState("");
    const [aracStatu, setAracStatu] = useState("");
    const [noktaSayisi, setNoktaSayisi] = useState("");
    const [surucu, setSurucu] = useState("");

    /* UI */
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
    const [saving, setSaving] = useState(false);
    const [successCount, setSuccessCount] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);
    const [dense, setDense] = useState(false);

    /* dialog (Edit) */
    const [editOpen, setEditOpen] = useState(false);
    const [editSefer, setEditSefer] = useState(null);
    const [detailRows, setDetailRows] = useState([]);
    const [detailRowsOrig, setDetailRowsOrig] = useState([]);
    const areAllTimesSaved = useMemo(() => {
        if (!detailRows.length || !detailRowsOrig.length) return false;

        return detailRows.every((d, i) => {
            const o = detailRowsOrig[i];

            return (
                isISODateTimeValid(d.yukleme_varis) &&
                isISODateTimeValid(d.yukleme_cikis) &&
                isISODateTimeValid(d.teslim_varis) &&
                isISODateTimeValid(d.teslim_cikis) &&

                // Ayrıca KAYDEDİLMİŞ olması gerekiyor → orig ile bire bir aynı olmalı
                d.yukleme_varis === o.yukleme_varis &&
                d.yukleme_cikis === o.yukleme_cikis &&
                d.teslim_varis === o.teslim_varis &&
                d.teslim_cikis === o.teslim_cikis
            );
        });
    }, [detailRows, detailRowsOrig]);

    const [seferTarihiYeni, setSeferTarihiYeni] = useState("");

    // ETA Dialog
    const [etaEditorOpen, setEtaEditorOpen] = useState(false);
    const [etaSefer, setEtaSefer] = useState(null);

    // --- MESAFE: Supabase 'mesafeler' tablosundan km çek ---
    const fetchDistance = useCallback(async ({ from, to, timeoutMs = 8000 }) => {
        const first = (v) => {
            if (v == null) return null;
            const s = String(v).trim();
            const p = s.split(";").map((x) => x.trim()).filter(Boolean);
            return p.length ? p[0] : (s || null);
        };
        const normU = (v) => v == null ? null : String(v).trim().toLocaleUpperCase("tr-TR");

        const yIl = normU(first(from?.il));
        const yIlce = normU(first(from?.ilce));
        const tIl = normU(first(to?.il));
        const tIlce = normU(first(to?.ilce));

        const withTimeout = (promise, ms) =>
            new Promise((resolve, reject) => {
                const id = setTimeout(() => reject(new Error("timeout")), ms);
                promise.then((v) => { clearTimeout(id); resolve(v); })
                    .catch((e) => { clearTimeout(id); reject(e); });
            });

        try {
            let q = supabase
                .from("mesafeler")
                .select("mesafe")
                .eq("yukleme_il", yIl || "")
                .eq("teslim_il", tIl || "")
                .limit(1);

            // ilçe verilmişse birebir filtrele; verilmemişse hiç filtreleme (tüm ilçelerden biri eşleşebilir)
            if (yIlce) q = q.eq("yukleme_ilce", yIlce);
            if (tIlce) q = q.eq("teslim_ilce", tIlce);

            const { data, error } = await withTimeout(q, timeoutMs);
            if (error) {
                console.warn("mesafeler sorgu hatası:", error);
                return { km: 0 };
            }

            const row = data?.[0] || null;
            if (!row) {
                console.warn("mesafeler: kayıt bulunamadı", { yIl, yIlce, tIl, tIlce });
                return { km: 0 };
            }

            // güvenli parse: "532", "532.4", "532,4", "532 km"
            const raw = row.mesafe;
            let km = 0;
            if (typeof raw === "number") km = raw;
            else if (raw != null) {
                const cleaned = String(raw).replace(/[^\d.,-]/g, "").replace(",", ".");
                const parsed = parseFloat(cleaned);
                km = Number.isFinite(parsed) ? parsed : 0;
            }

            return { km };
        } catch (e) {
            console.warn("mesafeler timeout/err:", e);
            return { km: 0 };
        }
    }, []);

    const addLog = useCallback((entry) => {
        try {
            const all = JSON.parse(localStorage.getItem("aktifseferler.logs") || "[]");
            const user = localStorage.getItem("kullaniciAdi") || "-";   // ✅ DOĞRUSU BU
            all.unshift({ ts: new Date().toISOString(), user, ...entry });
            localStorage.setItem("aktifseferler.logs", JSON.stringify(all.slice(0, 200)));
            setViewBump(String(Date.now()));
        } catch { /* ignore */ }
    }, []);

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
            surucu_ad_soyad: uniq("surucu_ad_soyad"),
        };
    }, [rows]);

    /* helpers */
    const enrichRows = (list) =>
        list.map((s, idx) => {
            const maxLen = Math.max(0, ...detailFields.map((k) => splitCell(s[k]).length));
            return {
                ...s,
                _rid: s.id ?? s.sefer_no ?? `tmp-${Date.now()}-${idx}`,
                nokta_sayisi: maxLen || 0,
                reel_durum: s.reel_durum || "-",
                bolge: getBolge(s.yukleme_ili, s.yukleme_ilcesi),
            };
        });

    const getSeferIdByNo = async (row) => {
        let id = row?.id ?? null;
        if (!id && row?.sefer_no) {
            const { data: s } = await supabase.from("seferler").select("id").eq("sefer_no", row.sefer_no).maybeSingle();
            id = s?.id ?? null;
        }
        return id != null ? String(id) : null;
    };

    /* listele */
    const listData = useCallback(async () => {
        setLoading(true);
        try {
            const rangeMin = `${startDate || ""}T00:00:00`;
            const rangeMax = `${endDate || ""}T23:59:59`;

            const [data, completedSet] = await Promise.all([
                fetchSeferler(rangeMin, rangeMax),
                fetchTamamlananNos(rangeMin, rangeMax),
            ]);

            const visible = (data || [])
                .filter((s) => (s.sefer_no || "").toString().trim().toUpperCase().startsWith("SFR"))
                .filter((s) => !completedSet.has((s.sefer_no ?? "").toString().trim()))
                .filter((s) => !isExcludedPlate(s.plaka));

            setRows(enrichRows(visible));
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Veri çekilirken hata oluştu.", severity: "error" });
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => { listData(); }, [listData]);

    const filtered = useMemo(() => {
        let r = [...rows].filter((x) => (x.reel_durum || "") !== "EŞLEŞME YOK");
        if (seferNoTipi) r = r.filter((x) => (x.sefer_no || "").toUpperCase().startsWith(seferNoTipi));
        if (plaka) r = r.filter((x) => (x.plaka || "").toLowerCase().includes(plaka.toLowerCase()));
        if (musteri) r = r.filter((x) => (x.musteri_adi || "").toLowerCase().includes(musteri.toLowerCase()));
        if (proje) r = r.filter((x) => (x.proje_adi || "").toLowerCase().includes(proje.toLowerCase()));
        if (yuklemeIl) r = r.filter((x) => (x.yukleme_ili || "") === yuklemeIl);
        if (teslimIl) r = r.filter((x) => (x.teslim_ili || "") === teslimIl);
        if (aracStatu) r = r.filter((x) => (x.arac_statu || "") === aracStatu);
        if (surucu) r = r.filter((x) => (x.surucu_ad_soyad || "").toLowerCase().includes(surucu.toLowerCase()));

        if (noktaSayisi) {
            const n = parseInt(noktaSayisi, 10);
            if (!Number.isNaN(n)) r = r.filter((x) => (x.nokta_sayisi || 0) === n);
        }
        if (quick) {
            const q = quick.toLowerCase();
            r = r.filter((x) => Object.values(x).some((v) => String(v ?? "").toLowerCase().includes(q)));
        }
        return r;
    }, [rows, seferNoTipi, plaka, musteri, proje, yuklemeIl, teslimIl, aracStatu, noktaSayisi, quick, surucu]);

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
        setDetailRowsOrig([]);
    }, []);

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
                yukleme_varis_guncelleyen: "",
                yukleme_varis_guncelleme_tarihi: "",
                yukleme_cikis_guncelleyen: "",
                yukleme_cikis_guncelleme_tarihi: "",
                teslim_varis_guncelleyen: "",
                teslim_varis_guncelleme_tarihi: "",
                teslim_cikis_guncelleyen: "",
                teslim_cikis_guncelleme_tarihi: "",
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

    const onDetailChange = useCallback((idx, key, value) => {
        setDetailRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
    }, []);

    function normalizeISO(v) {
        if (!v) return null;
        const d = new Date(v);
        if (isNaN(d)) return null;
        return d.getTime(); // sadece milisaniye karşılaştırması yapıyoruz
    }


    const saveDetails = useCallback(async () => {
        if (!editSefer) return false;
        setSaving(true);

        const currentUserName = (localStorage.getItem("kullaniciAdi") || "GENERIC").toUpperCase();
        const currentTimestamp = new Date().toISOString();
        const timeFields = ["yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis"];

        let errorOccurred = false;

        try {
            const upserts = await Promise.all(
                detailRows.map(async (d, i) => {
                    const original = detailRowsOrig[i] || {};

                    const cleaned_d = {};
                    for (const key in d) {
                        const v = clean(d[key]);
                        cleaned_d[key] = (v === "" ? null : v);
                    }

                    const updatedRow = {
                        sefer_id: cleaned_d.sefer_id,
                        nokta_sirasi: cleaned_d.nokta_sirasi,
                        proje_adi: cleaned_d.proje_adi,
                        yukleme_noktasi: cleaned_d.yukleme_noktasi,
                        yukleme_ili: cleaned_d.yukleme_ili,
                        yukleme_ilcesi: cleaned_d.yukleme_ilcesi,
                        teslim_noktasi: cleaned_d.teslim_noktasi,
                        teslim_ili: cleaned_d.teslim_ili,
                        teslim_ilcesi: cleaned_d.teslim_ilcesi,
                        yukleme_varis: cleaned_d.yukleme_varis,
                        yukleme_cikis: cleaned_d.yukleme_cikis,
                        teslim_varis: cleaned_d.teslim_varis,
                        teslim_cikis: cleaned_d.teslim_cikis,
                        arac_statu: computeAracStatu(detailRows) || null,
                        kayit_zamani: new Date().toISOString(),

                        // Eski tekli alanlar (UI hala kullanıyor)
                        yukleme_varis_guncelleyen:
                            normalizeISO(cleaned_d.yukleme_varis) !== normalizeISO(original.yukleme_varis)
                                ? currentUserName
                                : original.yukleme_varis_guncelleyen,

                        yukleme_varis_guncelleme_tarihi:
                            normalizeISO(cleaned_d.yukleme_varis) !== normalizeISO(original.yukleme_varis)
                                ? currentTimestamp
                                : original.yukleme_varis_guncelleme_tarihi,

                        yukleme_cikis_guncelleyen:
                            normalizeISO(cleaned_d.yukleme_cikis) !== normalizeISO(original.yukleme_cikis)
                                ? currentUserName
                                : original.yukleme_cikis_guncelleyen,

                        yukleme_cikis_guncelleme_tarihi:
                            normalizeISO(cleaned_d.yukleme_cikis) !== normalizeISO(original.yukleme_cikis)
                                ? currentTimestamp
                                : original.yukleme_cikis_guncelleme_tarihi,

                        teslim_varis_guncelleyen:
                            normalizeISO(cleaned_d.teslim_varis) !== normalizeISO(original.teslim_varis)
                                ? currentUserName
                                : original.teslim_varis_guncelleyen,

                        teslim_varis_guncelleme_tarihi:
                            normalizeISO(cleaned_d.teslim_varis) !== normalizeISO(original.teslim_varis)
                                ? currentTimestamp
                                : original.teslim_varis_guncelleme_tarihi,

                        teslim_cikis_guncelleyen:
                            normalizeISO(cleaned_d.teslim_cikis) !== normalizeISO(original.teslim_cikis)
                                ? currentUserName
                                : original.teslim_cikis_guncelleyen,

                        teslim_cikis_guncelleme_tarihi:
                            normalizeISO(cleaned_d.teslim_cikis) !== normalizeISO(original.teslim_cikis)
                                ? currentTimestamp
                                : original.teslim_cikis_guncelleme_tarihi,
                    };

                    /* =======================================
                       🆕 ÇOKLU LOG KAYDI SİSTEMİ
                       ======================================= */
                    for (const key of timeFields) {
                        const oldVal = original[key] || null;
                        const newVal = cleaned_d[key] || null;
                        const logsKey = `${key}_logs`;

                        const previousLogs = Array.isArray(original[logsKey])
                            ? original[logsKey]
                            : [];

                        if (normalizeISO(oldVal) === normalizeISO(newVal)) {
                            updatedRow[logsKey] = previousLogs;
                            continue;
                        }

                        // Yeni log kaydı
                        const newLog = {
                            user: currentUserName,
                            time: currentTimestamp,
                            old: oldVal,
                            new: newVal,
                        };

                        updatedRow[logsKey] = [...previousLogs, newLog];
                    }

                    /* ETA Hesapla */
                    if (cleaned_d.yukleme_cikis && cleaned_d.eta) {
                        const { km } = await fetchDistance({
                            from: { il: cleaned_d.yukleme_ili, ilce: cleaned_d.yukleme_ilcesi },
                            to: { il: cleaned_d.teslim_ili, ilce: cleaned_d.teslim_ilcesi }
                        });

                        if (km > 0) {
                            const start = new Date(cleaned_d.yukleme_cikis);
                            const hours = km / 70;
                            start.setHours(start.getHours() + hours);
                            updatedRow.eta = start.toISOString();
                        }
                    }

                    return updatedRow;
                })
            );

            const upsertResult = await upsertDetaylar(upserts);
            if (upsertResult && upsertResult.error) throw upsertResult.error;

            setDetailRows(detailRows);
            setDetailRowsOrig(detailRows);
            setSnack({ open: true, msg: "Detaylar kaydedildi.", severity: "success" });

        } catch (e) {
            console.error(e);
            errorOccurred = true;
            setSnack({ open: true, msg: `Kaydetme hatası: ${e?.message || e}`, severity: "error" });
        } finally {
            setSaving(false);
        }

        return !errorOccurred;
    }, [editSefer, detailRows, detailRowsOrig]);

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

                // 🆕 ETA TAM BURAYA EKLENECEK
                eta_varis: seferAna.eta_varis ?? null,
            };
            const detPayload = detailRows.map((d, i) => ({
                sefer_no: seferAna.sefer_no,
                nokta_sirasi: i,
                proje_adi: clean(d.proje_adi) || null,
                yukleme_noktasi: clean(d.yukleme_noktasi) || null,
                yukleme_ili: clean(d.yukleme_ili) || null,
                yukleme_ilcesi: clean(d.yukleme_ilcesi) || null,
                teslim_noktasi: clean(d.teslim_noktasi) || null,
                teslim_ili: clean(d.teslim_ili) || null,
                teslim_ilcesi: clean(d.teslim_ilcesi) || null,
                yukleme_varis: clean(d.yukleme_varis) || null,
                yukleme_cikis: clean(d.yukleme_cikis) || null,
                teslim_varis: clean(d.teslim_varis) || null,
                teslim_cikis: clean(d.teslim_cikis) || null,
                kayit_zamani: new Date().toISOString(),
                arac_statu: seferAna.arac_statu ?? null,

                // 🆕 BURAYA ETA EKLENİYOR
                eta: clean(d.eta) || seferAna.eta_varis || null,

                yukleme_varis_guncelleyen: d.yukleme_varis_guncelleyen || null,
                yukleme_varis_guncelleme_tarihi: clean(d.yukleme_varis_guncelleme_tarihi) || null,
                yukleme_cikis_guncelleyen: d.yukleme_cikis_guncelleyen || null,
                yukleme_cikis_guncelleme_tarihi: clean(d.yukleme_cikis_guncelleme_tarihi) || null,
                teslim_varis_guncelleyen: d.teslim_varis_guncelleyen || null,
                teslim_varis_guncelleme_tarihi: clean(d.teslim_varis_guncelleme_tarihi) || null,
                teslim_cikis_guncelleyen: d.teslim_cikis_guncelleyen || null,
                teslim_cikis_guncelleme_tarihi: clean(d.teslim_cikis_guncelleme_tarihi) || null,
            }));
            const { error: e1 } = await supabase
                .from("tamamlanan_seferler")
                .upsert(anaPayload, { onConflict: "sefer_no" });
            if (e1) throw e1;

            if (detPayload.length) {
                const { error: e2 } = await supabase
                    .from("tamamlanan_detaylar")
                    .upsert(detPayload, { onConflict: "sefer_no,nokta_sirasi" });
                if (e2) throw e2;
            }

            await supabase.from("sefer_detaylari").delete().eq("sefer_id", seferAna.id);
            await supabase.from("seferler").delete().eq("id", seferAna.id);

            setRows((prev) => prev.filter((r) => r.id !== seferAna.id));
            closeEditor();

            setSnack({ open: true, msg: "Tamamlananlara aktarıldı.", severity: "success" });
            addLog({ action: "Sefer tamamlananlara aktarıldı", sefer_no: editSefer?.sefer_no || "-", fields: ["aktarim"] });
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Aktarım hatası.", severity: "error" });
        } finally {
            setSaving(false);
        }
    }, [detailRows, editSefer, rows, seferTarihiYeni, closeEditor, addLog]);

    const deleteSefer = useCallback(async (row) => {
        if (!canDelete) {
            setSnack({ open: true, msg: "Silme yetkiniz yok.", severity: "warning" });
            return;
        }

        const id = await getSeferIdByNo(row);
        if (!id) {
            setSnack({ open: true, msg: "Sefer ID bulunamadı.", severity: "error" });
            return;
        }
        if (!window.confirm(`${row?.sefer_no || id} kaydı silinecek. Devam edilsin mi?`)) return;

        setSaving(true);
        try {
            await supabase.from("sefer_detaylari").delete().eq("sefer_id", id);
            await supabase.from("seferler").delete().eq("id", id);

            setRows((prev) => prev.filter((r) => String(r.id) !== String(id)));
            addLog({ action: "Sefer silindi", sefer_no: row?.sefer_no || "-", fields: ["delete"] });
            setSnack({ open: true, msg: "Sefer silindi.", severity: "success" });
        } catch (e) {
            console.error("deleteSefer error:", e);
            setSnack({ open: true, msg: "Silme işleminde hata oluştu.", severity: "error" });
        } finally {
            setSaving(false);
        }
    }, [canDelete, addLog]);

    const openEditor = useCallback(
        async (row, aktarModu = false) => {
            if (!mayOpenEdit) {
                setSnack({ open: true, msg: "Düzenleyi açma yetkiniz yok.", severity: "warning" });
                return;
            }
            setEditSefer(row);
            setEditOpen(true);

            const id = await getSeferIdByNo(row);
            if (id) setEditSefer((prev) => ({ ...(prev || row), id }));

            let detay = [];
            if (id) detay = await loadDetaylar(id);

            if (!detay.length) {
                const arrs = Object.fromEntries(detailFields.map((k) => [k, splitCell(row[k])]));
                const len = Math.max(1, ...detailFields.map((k) => arrs[k].length));
                const pick = (k, i) => arrs[k][i] ?? "";
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

            const mapDetay = (d) => {
                const fix = (v) => {
                    if (v === "" || v === null || v === undefined) return null;
                    return v;
                };
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

                    yukleme_varis_guncelleyen: fix(d.yukleme_varis_guncelleyen),
                    yukleme_varis_guncelleme_tarihi: fix(d.yukleme_varis_guncelleme_tarihi),

                    yukleme_cikis_guncelleyen: fix(d.yukleme_cikis_guncelleyen),
                    yukleme_cikis_guncelleme_tarihi: fix(d.yukleme_cikis_guncelleme_tarihi),

                    teslim_varis_guncelleyen: fix(d.teslim_varis_guncelleyen),
                    teslim_varis_guncelleme_tarihi: fix(d.teslim_varis_guncelleme_tarihi),

                    teslim_cikis_guncelleyen: fix(d.teslim_cikis_guncelleyen),
                    teslim_cikis_guncelleme_tarihi: fix(d.teslim_cikis_guncelleme_tarihi),
                };
            };

            const initialDetails = detay.map(mapDetay);
            setDetailRows(initialDetails);
            setDetailRowsOrig(initialDetails);
            setSeferTarihiYeni(row?.sefer_tarihi || "");

            if (aktarModu) {
                setSnack({
                    open: true,
                    msg: "Detayları kontrol edip 'Tamamlananlara Aktar' ile işlemi bitirin.",
                    severity: "info",
                });
            }
        },
        [mayOpenEdit]
    );

    const openEtaEditor = useCallback((row) => {
        setEtaSefer(row);
        setEtaEditorOpen(true);
    }, []);

    const closeEtaEditor = useCallback(() => {
        setEtaEditorOpen(false);
        setEtaSefer(null);
    }, []);

    /* grid columns */
    const columns = useMemo(() => {
        let userOrder = [];
        let hasUserOrder = false;
        try {
            userOrder = JSON.parse(
                localStorage.getItem(ORDER_KEY) ||
                localStorage.getItem(GENERIC_ORDER_KEY) ||
                "[]"
            ) || [];
            hasUserOrder = userOrder.length > 0;
        } catch { }

        let cols = buildColumns({
            openEditor,
            openEtaEditor, // ETA butonu buradan çağrılır
            onDeleteRow: deleteSefer,
            COLORS,
            perms: { loading: permsLoading, mayOpenEdit, canEdit, canDelete },
            userOrder,
            hasUserOrder,
        });

        return cols;
    }, [permsLoading, mayOpenEdit, canEdit, canDelete, openEditor, openEtaEditor, deleteSefer, viewBump, ORDER_KEY, GENERIC_ORDER_KEY]);

    /* --------------- RENDER --------------- */
    return (
        <Box
            sx={{
                height: "100dvh",
                overflow: "hidden",
                display: "grid",
                gridTemplateRows: "auto auto auto 1fr",
                gap: 1.5,
                p: 2,
                background: COLORS.pageBg,
                color: COLORS.text,
            }}
        >
            <Helmet>
                <title>AKTİF SEFERLER</title>
                <style>{`html, body { height: 100%; overflow: hidden; } #root { height: 100%; }`}</style>
            </Helmet>

            {/* Başlık + aksiyonlar */}
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1}>
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
                            return eskiST !== yeniST ? `Sefer Tarihi (Eski/Yeni): ${eskiST} / ${yeniST} • ${st}` : `Sefer Tarihi: ${eskiST} • ${st}`;
                        })()}
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Button size="small" variant="text" startIcon={<ArrowBackIosNewIcon />} onClick={() => navigate(-1)}>Geri</Button>
                    <Button size="small" variant="text" startIcon={<HomeOutlinedIcon />} onClick={() => navigate("/anasayfa")}>Anasayfa</Button>
                    <FormControlLabel control={<Switch checked={dense} onChange={() => setDense((v) => !v)} size="small" />} label="Sıkı satırlar" sx={{ color: COLORS.textMuted }} />
                    <Chip label={`SFR: ${sfrCount}`} size="small" color="info" sx={{ fontWeight: 800 }} />
                    <Button size="small" variant="outlined" onClick={() => navigate("/aktifseferler/gorunum")}>Görünümü Düzenle</Button>

                    <ListeleButton
                        startDate={startDate}
                        endDate={endDate}
                        setLoading={setLoading}
                        setRows={setRows}
                        setSnack={setSnack}
                        enrichRows={enrichRows}
                    />

                    {canSync && (
                        <SenkronizeEtButton
                            startDate={startDate}
                            endDate={endDate}
                            canSync={canSync}
                            setLoading={setLoading}
                            setSuccessCount={setSuccessCount}
                            setShowSuccess={setShowSuccess}
                            setRows={setRows}
                            setSnack={setSnack}
                            enrichRows={enrichRows}
                        />
                    )}

                    {/* 🔥 Excel Aktarım Butonu — eklenmesi gereken yer burası */}
                    <ExcelAktarim rows={filtered} filename="aktif_seferler.xlsx" />

                </Stack>
            </Stack>

            {/* Filtreler */}
            <Filtreler
                COLORS={COLORS}
                baseInputSX={{
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
                }}
                options={options}
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                seferNoTipi={seferNoTipi} setSeferNoTipi={setSeferNoTipi}
                plaka={plaka} setPlaka={setPlaka}
                musteri={musteri} setMusteri={setMusteri}
                proje={proje} setProje={setProje}
                yuklemeIl={yuklemeIl} setYuklemeIl={setYuklemeIl}
                teslimIl={teslimIl} setTeslimIl={setTeslimIl}
                aracStatu={aracStatu} setAracStatu={setAracStatu}
                noktaSayisi={noktaSayisi} setNoktaSayisi={setNoktaSayisi}
                quick={quick} setQuick={setQuick}
                surucu={surucu} setSurucu={setSurucu}
            />

            {/* Liste */}
            <Paper
                sx={{
                    borderRadius: 3,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    flexGrow: 1,
                    height: "1000px",
                    overflow: "hidden",
                }}
            >
                <DataGrid
                    apiRef={apiRef}
                    disableColumnReorder={false}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={(model) => {
                        setColumnVisibilityModel(model);
                        try {
                            const hiddenList = Object.keys(model).filter((k) => model[k] === false);
                            localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenList));
                            localStorage.setItem("aktifseferler.view.bump", String(Date.now()));
                        } catch { }
                    }}
                    onColumnOrderChange={() => {
                        try {
                            const ordered =
                                apiRef.current.exportState?.().columns?.orderedFields ||
                                apiRef.current?.state?.columns?.orderedFields ||
                                [];
                            localStorage.setItem(ORDER_KEY, JSON.stringify(ordered));
                            localStorage.setItem("aktifseferler.view.bump", String(Date.now()));
                        } catch { }
                    }}
                    onStateChange={(state) => {
                        try {
                            const ordered = state?.columns?.orderedFields || [];
                            if (ordered.length) {
                                localStorage.setItem(ORDER_KEY, JSON.stringify(ordered));
                                localStorage.setItem("aktifseferler.view.bump", String(Date.now()));
                            }
                        } catch { }
                    }}
                    rows={filtered}
                    columns={columns}
                    getRowId={(r) => r._rid}
                    loading={loading}
                    disableRowSelectionOnClick
                    hideFooter
                    density={dense ? "compact" : "standard"}
                    rowHeight={dense ? 34 : 40}
                    columnHeaderHeight={dense ? 40 : 46}
                    sx={{
                        border: "none",
                        color: COLORS.text,

                        /* ===== SUPER THICK ULTRA MODERN SCROLLBAR ===== */
                        "& .MuiDataGrid-virtualScroller": {
                            backgroundColor: COLORS.surface,

                            // Scrollbar boyutu
                            "&::-webkit-scrollbar": {
                                width: 20,
                                height: 20,
                            },

                            "&::-webkit-scrollbar-track": {
                                background: "rgba(255,255,255,0.05)",
                                borderRadius: 30,
                                margin: "4px", // track ile kenar arasında boşluk
                            },

                            "&::-webkit-scrollbar-thumb": {
                                background: "linear-gradient(135deg, #6b8cff, #3a53e3)",
                                borderRadius: 30,
                                border: "5px solid rgba(255,255,255,0.15)", // iç boşluk / cam efekti
                                backgroundClip: "padding-box",
                                boxShadow: "0 0 12px rgba(82,110,255,0.7)",
                                transition: "0.25s",
                            },

                            "&::-webkit-scrollbar-thumb:hover": {
                                background: "linear-gradient(135deg, #8aa0ff, #5f76ff)",
                                border: "5px solid rgba(255,255,255,0.25)",
                                boxShadow: "0 0 18px rgba(82,110,255,1)",
                            },

                            "&::-webkit-scrollbar-corner": { background: "transparent" },

                            // Firefox
                            scrollbarWidth: "auto",
                            scrollbarColor: "#6b8cff rgba(255,255,255,0.05)",
                        },
                        /* ================================================== */

                        "& .MuiDataGrid-columnHeaders": {
                            background: COLORS.surface2,
                            color: COLORS.text,
                            borderBottom: `1px solid ${COLORS.border}`,
                            fontWeight: 800,
                            fontSize: 14.5,
                        },
                        "& .MuiDataGrid-cell": {
                            borderBottom: `1px solid ${COLORS.border}`,
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            fontSize: 14.5,
                        },
                        "& .MuiDataGrid-row:nth-of-type(2n) .MuiDataGrid-cell": {
                            backgroundColor: COLORS.zebra,
                        },
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
                    position: "fixed", top: 16, right: 16, bgcolor: "success.main", color: "#fff",
                    px: 2, py: 1, borderRadius: 2, boxShadow: 3, fontWeight: 700, zIndex: 1300
                }}>
                    {successCount} kayıt güncellendi.
                </Box>
            )}

            {/* Snackbar */}
            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
                    {snack.msg}
                </Alert>
            </Snackbar>

            {/* Detay Editör */}
            {editOpen && (
                <Suspense fallback={null}>
                    <EditorDialog
                        open={editOpen}
                        onClose={closeEditor}
                        canEdit={canEdit}
                        mayOpenEdit={mayOpenEdit}
                        COLORS={COLORS}
                        baseInputSX={{
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
                        }}
                        editSefer={editSefer}
                        detailRows={detailRows}
                        allSavedTimesFilled={areAllTimesSaved}
                        computeAracStatu={computeAracStatu}
                        fromISOToCombined={fromISOToCombined}
                        DateTimeOneField={DateTimeOneField}
                        seferTarihiYeni={seferTarihiYeni}
                        setSeferTarihiYeni={setSeferTarihiYeni}
                        addDetailRow={addDetailRow}
                        copyDetailRow={copyDetailRow}
                        removeDetailRow={removeDetailRow}
                        onDetailChange={onDetailChange}
                        onSaveClick={async () => {
                            try {
                                let tarihDegisti = false;
                                const eskiST = editSefer?.sefer_tarihi || "";
                                const yeniST = seferTarihiYeni || "";

                                if (editSefer?.id && (yeniST !== eskiST)) {
                                    await updateSefer(editSefer.id, { sefer_tarihi: yeniST || null });
                                    tarihDegisti = true;
                                }

                                const success = await saveDetails();
                                if (!success) return;

                                setRows((prev) =>
                                    prev.map((r) =>
                                        r.id === editSefer?.id ? { ...r, sefer_tarihi: yeniST || r.sefer_tarihi } : r
                                    )
                                );

                                const timeKeys = ["yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis"];
                                const changedFields = [];
                                const detailedChanges = {};

                                detailRows.forEach((row, idx) => {
                                    const orig = detailRowsOrig[idx] || {};
                                    timeKeys.forEach((k) => {
                                        const beforeVal = String(clean(orig?.[k] ?? ""));
                                        const afterVal = String(clean(row?.[k] ?? ""));
                                        if (beforeVal !== afterVal) {
                                            const tag = `${k}[${idx + 1}]`;
                                            changedFields.push(tag);
                                            detailedChanges[tag] = { old: beforeVal || "-", new: afterVal || "-" };
                                        }
                                    });
                                });

                                if (tarihDegisti) {
                                    changedFields.push("sefer_tarihi");
                                    detailedChanges["sefer_tarihi"] = { old: eskiST || "-", new: yeniST || "-" };
                                }

                                if (changedFields.length) {
                                    addLog({ action: "Düzenleme kaydedildi", sefer_no: editSefer?.sefer_no || "-", fields: changedFields, changes: detailedChanges });
                                } else {
                                    addLog({ action: "Düzenleme (değişiklik yok)", sefer_no: editSefer?.sefer_no || "-", fields: [] });
                                }

                                setSnack({ open: true, msg: "Kaydedildi.", severity: "success" });
                            } catch (e) {
                                console.error(e);
                                setSnack({ open: true, msg: "Kaydetme sırasında hata oluştu.", severity: "error" });
                            }
                        }}
                        onMoveToCompleted={moveToCompleted}
                    />
                </Suspense>
            )}

            {/* ETA Editör (sadece o sefer için mesafe hesaplar) */}
            {etaEditorOpen && (
                <Suspense
                    fallback={
                        <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
                            <CircularProgress />
                        </Box>
                    }
                >
                    <ETAEditor
                        open={etaEditorOpen}
                        onClose={closeEtaEditor}
                        sefer={etaSefer}
                        loading={loading}
                        fetchDistance={fetchDistance}
                    />
                </Suspense>
            )}
        </Box>
    );
}
