import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

/* MUI */
import {
    Box,
    Paper,
    Stack,
    Button,
    Typography,
    TextField,
    Snackbar,
    Alert,
    Backdrop,
    CircularProgress,
    Chip,
    Switch,
    FormControlLabel,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    Tooltip,
    Grid,
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
    isExcludedPlate,
    splitCell,
    clean,
    detailFields,
    computeAracStatu,
} from "./utils/sefer";

/* yardımcılar */
import buildColumns from "./columns";
import {
    nowLocalISO,
    fromISOToCombined,
    normalizeISO,
} from "./utils/datetime";
import { formatPhone, ellipsize } from "./utils/format";
import {
    AVG_SPEED_KMPH,
    parseMesafeKm,
    ETA_STATUS,
    ETA_MESSAGES,
} from "./utils/eta";
import {
    fetchSeferler,
    fetchTamamlananNos,
    loadDetaylar,
    updateSefer,
    upsertDetaylar,
    fetchMesafe,
} from "./services";

import usePermissions from "../auth/usePermissions";

/* Diyaloglar */
const EditorDialog = lazy(() => import("./dialogs/EditorDialog"));
// const EtaDialog = lazy(() => import("./dialogs/EtaDialog")); // Artık render edilmiyor

/* küçük inputlar */
function DateTimeOneField(props) {
    return <TextField type="datetime-local" size="small" InputLabelProps={{ shrink: true }} {...props} />;
}
function TimeHMField(props) {
    return <TextField type="time" size="small" inputProps={{ step: 60 }} InputLabelProps={{ shrink: true }} {...props} />;
}

/* ---- yardımcı: UUID kontrolü ---- */
const isUUID = (v) =>
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

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
            (hiddenList || []).forEach((f) => {
                m[f] = false;
            });
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
        const onCustom = () => setViewBump(String(Date.now())); // yeni

        window.addEventListener("storage", onStorage);
        window.addEventListener("focus", onFocus);
        window.addEventListener("aktifseferler:view:changed", onCustom); // yeni
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("aktifseferler:view:changed", onCustom); // yeni
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
            hiddenList.forEach((f) => {
                m[f] = false;
            });
            setColumnVisibilityModel(m);
        } catch {
            /* ignore */
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewBump]);

    const navigate = useNavigate();
    // Yetkiler
    const { loading: permsLoading, flags = {} } = usePermissions("aktif_seferler");
    const {
        aktif_can_sync = false,
        aktif_can_edit = false,
        aktif_may_open_edit = false,
    } = flags;

    // Uyum için yerel alias'lar
    const canSync = aktif_can_sync;
    const canEdit = aktif_can_edit;
    const mayOpenEdit = aktif_may_open_edit;
    // ETA Kontrollerini UI'da kapatıyoruz (Arka plan odaklı çözüm)
    const canETA = false;
    const mayOpenETA = false;

    /* data */
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    /* filters */
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
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

    /* Dashboard visible (persisted) */
    const [dashOpen, setDashOpen] = useState(false);
    useEffect(() => {
        localStorage.setItem("aktifseferler.dash.open", dashOpen ? "1" : "0");
    }, [dashOpen]);

    /* dialog (Edit) */
    const [editOpen, setEditOpen] = useState(false);
    const [editSefer, setEditSefer] = useState(null);
    const [detailRows, setDetailRows] = useState([]);
    // detailRowsOrig: Orijinal değerleri tutar
    const [detailRowsOrig, setDetailRowsOrig] = useState([]);
    const [seferTarihiYeni, setSeferTarihiYeni] = useState("");

    // ETA dialog state (Kullanım dışı bırakılan state'ler)
    const [etaOpen, setEtaOpen] = useState(false);
    const [etaRow, setEtaRow] = useState(null);
    const [etaDetails, setEtaDetails] = useState([]);
    const [etaDistanceKm, setEtaDistanceKm] = useState(null);
    const [distanceInput, setDistanceInput] = useState(""); // Manuel mesafe

    // “Anlık ETA uymayan” kilidi
    const [etaLocked, setEtaLocked] = useState(false);

    /* === GECİKME SEBEBİ DİYALOĞU === */
    const [reasonOpen, setReasonOpen] = useState(false);
    const [reasonRow, setReasonRow] = useState(null);
    const [reasonCat, setReasonCat] = useState("");
    const [reasonNote, setReasonNote] = useState("");

    /* === AÇIKLAMA ROZETİ İÇİN set === */
    const [reasonNos, setReasonNos] = useState(() => new Set());

    const addLog = (entry) => {
        try {
            const all = JSON.parse(localStorage.getItem("aktifseferler.logs") || "[]");
            const user = localStorage.getItem("kullanici") || "-"; // log için eski anahtar kullanılmaya devam
            all.unshift({ ts: new Date().toISOString(), user, ...entry });
            localStorage.setItem("aktifseferler.logs", JSON.stringify(all.slice(0, 200)));
            setViewBump(String(Date.now()));
        } catch {
            /* ignore */
        }
    };

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

    /* ------- helpers ------- */
    const enrichRows = (list) =>
        list.map((s, idx) => {
            const maxLen = Math.max(0, ...detailFields.map((k) => splitCell(s[k]).length));
            return {
                ...s,
                _rid: s.id ?? s.sefer_no ?? `tmp-${Date.now()}-${idx}`,
                nokta_sayisi: maxLen || 0,
                reel_durum: s.reel_durum || "-",
            };
        });
    const formatDuration = (minutes) => {
        if (minutes == null) return "-";
        const m = Math.max(0, Math.round(minutes));
        const h = Math.floor(m / 60);
        const r = m % 60;
        if (h === 0) return `${r} dk`;
        if (r === 0) return `${h} saat`;
        return `${h} saat ${r} dk`;
    };

    const isAnlikEtaUyumsuz = (row) => {
        const v = (row?.reel_durum || "")
            .normalize("NFKC")
            .toLocaleUpperCase("tr-TR");
        return v.includes("ANLIK") && v.includes("ETA") && (v.includes("UYM") || v.includes("UYMUYOR") || v.includes("UYUMSUZ"));
    };

    const getSeferIdByNo = async (row) => {
        let id = row?.id ?? null;
        if (!id && row?.sefer_no) {
            const { data: s } = await supabase.from("seferler").select("id").eq("sefer_no", row.sefer_no).maybeSingle();
            id = s?.id ?? null;
        }
        return id != null ? String(id) : null;
    };

    const getFirstLegStartISO = (arr = []) => normalizeISO(arr[0]?.yukleme_cikis) || null;

    const pickFirstLegOD = (row, detay = []) => {
        const first = (arr) => (arr.length ? arr[0] : "");
        const yIl = first(splitCell(row.yukleme_ili || "")) || first(splitCell(detay[0]?.yukleme_ili || ""));
        const yIlce = first(splitCell(row.yukleme_ilcesi || "")) || first(splitCell(detay[0]?.yukleme_ilcesi || ""));
        const tIl = first(splitCell(row.teslim_ili || "")) || first(splitCell(detay[0]?.teslim_ili || ""));
        const tIlce = first(splitCell(row.teslim_ilcesi || "")) || first(splitCell(detay[0]?.teslim_ilcesi || ""));
        return { yIl, yIlce, tIl, tIlce };
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

    useEffect(() => {
        listData();
    }, [listData]);

    /* Bu tarih aralığında açıklama girilmiş seferleri getir → rozet için */
    const refreshReasonNos = useCallback(async () => {
        try {
            const rangeMin = `${startDate || ""}T00:00:00`;
            const rangeMax = `${endDate || ""}T23:59:59`;
            const { data, error } = await supabase
                .from("eta_gecikme_nedenleri")
                .select("sefer_no,kayit_zamani")
                .gte("kayit_zamani", rangeMin)
                .lte("kayit_zamani", rangeMax);

            if (error) throw error;
            const set = new Set((data || []).map((d) => (d?.sefer_no || "").toString().trim()).filter(Boolean));
            setReasonNos(set);
        } catch (e) {
            console.warn("refreshReasonNos error:", e?.message || e);
            setReasonNos(new Set());
        }
    }, [startDate, endDate]);

    useEffect(() => {
        refreshReasonNos();
    }, [refreshReasonNos, rows.length]);

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
                // Yeni kolonlar başlangıçta boş
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

    // GÜNCELLENMİŞ saveDetails: ARKA PLAN TETİKLEYİCİSİ EKLENDİ
    const saveDetails = useCallback(async () => {
        if (!editSefer) return false;
        setSaving(true);

        const currentUserName = (localStorage.getItem("kullanici") || "GENERIC").toUpperCase();
        const currentTimestamp = new Date().toISOString();
        const timeFields = ["yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis"];

        let successfullyUpdatedRows = [];
        let errorOccurred = false;

        try {
            const upserts = detailRows.map((d, i) => {
                const original = detailRowsOrig[i] || {};

                const cleaned_d = {};
                for (const key in d) {
                    cleaned_d[key] = clean(d[key]) || null;
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
                };

                timeFields.forEach((field) => {
                    const currentValue = cleaned_d[field];
                    const originalValue = clean(original[field]) || null;

                    if (currentValue !== originalValue) {
                        updatedRow[`${field}_guncelleyen`] = currentUserName;
                        updatedRow[`${field}_guncelleme_tarihi`] = currentTimestamp;
                    } else {
                        const originalUser = original[`${field}_guncelleyen`] ?? null;
                        const originalDate = clean(original[`${field}_guncelleme_tarihi`]) || null;

                        updatedRow[`${field}_guncelleyen`] = originalUser;
                        updatedRow[`${field}_guncelleme_tarihi`] = originalDate;
                    }
                });

                successfullyUpdatedRows.push({ ...d, ...updatedRow });
                return updatedRow;
            });

            const upsertResult = await upsertDetaylar(upserts);
            if (upsertResult && upsertResult.error) {
                throw upsertResult.error;
            }

            setDetailRows(successfullyUpdatedRows);
            setDetailRowsOrig(successfullyUpdatedRows);

            try {
                // ETA Durum Kontrolü ve Arka Plan Tetiklemesi
                const firstStart = getFirstLegStartISO(successfullyUpdatedRows);
                if (editSefer?.id) {
                    const { yIl, yIlce, tIl, tIlce } = pickFirstLegOD(editSefer || {}, successfullyUpdatedRows);

                    // Sadece mesafe sorgusu yapılır (caching için)
                    const mesafeRaw = await fetchMesafe({ yIl, yIlce, tIl, tIlce });
                    const km = parseMesafeKm(mesafeRaw);
                    const hasKm = km && km > 0;
                    const hasYC = Boolean(firstStart);

                    const shouldTriggerBackend = hasKm && hasYC; // BU MANTIĞIN TRUE OLMASI GEREKİR

                    let newNote = null;
                    if (!hasYC) {
                        newNote = ETA_MESSAGES[ETA_STATUS.WAITING_FIRST_YC];
                    } else if (!hasKm) {
                        newNote = ETA_MESSAGES[ETA_STATUS.NEED_DISTANCE];
                    }

                    // 🔥 KRİTİK DÜZELTME YERİ
                    // YENİ NOT: Sizin kodunuzdaki bu kısım zaten doğru görünüyordu,
                    // ancak bir önceki dağıtımda kodun doğru çalışmasını garanti edelim:
                    await updateSefer(editSefer.id, {
                        mesafe: km,
                        eta_varis: null,
                        eta_note: newNote,
                        eta_gerekli_mi: shouldTriggerBackend, // 🔥 BU DEĞER ARTIK KESİNLİKLE TRUE OLMALI
                        kayit_zamani: new Date().toISOString(),
                    });

                    // Frontend listesini güncelle
                    setRows((prev) =>
                        prev.map((r) =>
                            r.id === editSefer.id ? { ...r, mesafe: km, eta_varis: null, eta_note: newNote, eta_gerekli_mi: shouldTriggerBackend } : r
                        )
                    );
                }
            } catch (e) {
                console.error("Detay kaydetme sonrası ETA durum güncelleme hatası:", e);
                // Hata durumunda bile bayrağı TRUE olarak güncellemeye zorlamak için (opsiyonel ama güvenli)
                await updateSefer(editSefer.id, { eta_gerekli_mi: true });
            }

            setSnack({ open: true, msg: "Detaylar kaydedildi. ETA arka planda güncelleniyor.", severity: "success" });
        } catch (e) {
            errorOccurred = true;
            console.error(e);
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
                eta_varis: seferAna.eta_varis ?? null,
                kalan_surus_dk: seferAna.kalan_surus_dk ?? null,
                eta_mola_dk: seferAna.eta_mola_dk ?? null,
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

    /* ===== ETA PANELİ FONKSİYONLARI: DEVRE DIŞI BIRAKILDI (Ancak varlığı korunuyor) ===== */
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

            const mapDetay = (d) => ({
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

                yukleme_varis_guncelleyen: d.yukleme_varis_guncelleyen ?? "",
                yukleme_varis_guncelleme_tarihi: d.yukleme_varis_guncelleme_tarihi ?? "",
                yukleme_cikis_guncelleyen: d.yukleme_cikis_guncelleyen ?? "",
                yukleme_cikis_guncelleme_tarihi: d.yukleme_cikis_guncelleme_tarihi ?? "",
                teslim_varis_guncelleyen: d.teslim_varis_guncelleyen ?? "",
                teslim_varis_guncelleme_tarihi: d.teslim_varis_guncelleme_tarihi ?? "",
                teslim_cikis_guncelleyen: d.teslim_cikis_guncelleyen ?? "",
                teslim_cikis_guncelleme_tarihi: d.teslim_cikis_guncelleme_tarihi ?? "",
            });

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

    // KULLANICI İNTERAKSİYONUNU KESEN BOŞ FONKSİYON
    const openETA = useCallback(
        async (row) => {
            setSnack({ open: true, msg: "ETA hesaplaması otomatiktir.", severity: "info" });
        },
        []
    );

    // DİĞER KULLANIM DIŞI FONKSİYONLAR BOŞ BIRAKILDI
    const copyETA = useCallback(async () => {
        setSnack({ open: true, msg: "ETA paneli devre dışı.", severity: "warning" });
    }, []);
    const saveETA = useCallback(async () => {
        setSnack({ open: true, msg: "ETA kaydetme devre dışı.", severity: "warning" });
    }, []);

    const saveManualDistanceAndETA = useCallback(
        async ({ distance, yukleme_il, yukleme_ilce, teslim_il, teslim_ilce }) => {
            if (!etaRow || !etaRow.id) return;
            if (distance <= 0 || !yukleme_il || !teslim_il) {
                setSnack({ open: true, msg: "Geçerli bir mesafe (km) girmelisiniz.", severity: "error" });
                return;
            }

            setSaving(true);

            try {
                const mesafePayload = {
                    yukleme_il,
                    yukleme_ilce,
                    teslim_il,
                    teslim_ilce,
                    mesafe: distance,
                    kaydeden: USERKEY,
                    kayit_zamani: new Date().toISOString(),
                };

                // 1. Mesafeyi mesafeler tablosuna kaydet
                const { error: upsertError } = await supabase
                    .from("mesafeler")
                    .upsert([mesafePayload], { onConflict: "yukleme_il,yukleme_ilce,teslim_il,teslim_ilce" });

                if (upsertError) throw upsertError;

                const newNote = null; // Mesafe artık bulundu
                // 2. Sefer kaydındaki mesafe alanını ve arka plan tetikleme bayrağını güncelle
                await updateSefer(etaRow.id, {
                    mesafe: distance,
                    eta_varis: null,
                    eta_note: newNote,
                    eta_gerekli_mi: true, // ARKA PLAN TETİKLEME BAYRAĞI
                    kayit_zamani: new Date().toISOString(),
                });

                // 3. Frontend listesini güncelle
                setRows((prev) =>
                    prev.map((r) =>
                        r.id === etaRow.id ? { ...r, mesafe: distance, eta_varis: null, eta_note: newNote, eta_gerekli_mi: true } : r
                    )
                );

                setEtaDistanceKm(distance);
                setDistanceInput("");

                setSnack({ open: true, msg: "Mesafe kaydedildi. ETA arka planda hesaplanıyor.", severity: "success" });
                setEtaOpen(false); // Diyalogu kapat

            } catch (e) {
                console.error("saveManualDistanceAndETA FAILED:", e);
                setSnack({ open: true, msg: `Mesafe kaydedilemedi: ${e?.message || e}`, severity: "error" });
            } finally {
                setSaving(false);
            }
        },
        [etaRow, USERKEY]
    );

    // KULLANIM DIŞI KALAN ANCAK MEVCUT OLMASI GEREKEN DEĞİŞKENLER
    const computedETAISO = '';
    const firstLegStartISO = ''; // Değerler burada tanımlanmadığı için boş bırakıldı

    // UI Propları (render edilmeseler bile)
    const etaStartISO = '';
    const driveHM = '';
    const breakSel = 0;
    const etaDistanceInfo = '';
    const originText = '';
    const destinationText = '';
    const driverText = '';
    const vehicleText = '';
    const jobText = '';


    /* grid columns (+ açıklama ikonu) */
    const columns = useMemo(() => {
        // Kolon sıralaması için kullanıcı ayarlarını oku
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

        // Kolon oluşturma fonksiyonunu çağır ve tüm ayarları ilet
        let cols = buildColumns({
            openETA,
            openEditor,
            COLORS,
            perms: { loading: permsLoading, mayOpenETA, canETA, mayOpenEdit, canEdit },
            userOrder: userOrder,
            hasUserOrder: hasUserOrder,
            reasonNos: reasonNos,
        });

        return cols;
    }, [
        permsLoading,
        mayOpenETA,
        canETA,
        mayOpenEdit,
        canEdit,
        openETA,
        openEditor,
        viewBump,
        reasonNos,
    ]);

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

    /* === GECİKME SEBEBİ KAYDET === */
    const saveLateReason = async () => {
        if (!reasonRow) return;
        const kategori = reasonCat || "";
        if (!kategori) {
            setSnack({ open: true, msg: "Lütfen bir sebep seçin.", severity: "warning" });
            return;
        }
        const aciklama = reasonNote || "";
        setSaving(true);
        try {
            const sefer_id_raw = await getSeferIdByNo(reasonRow);
            const sefer_id = isUUID(sefer_id_raw) ? sefer_id_raw : null;

            const sefer_no = (reasonRow?.sefer_no || "").toString().trim() || null;
            const kaydeden = localStorage.getItem("kullanici") || "-";

            const sefer_tarihi = reasonRow?.sefer_tarihi || null;
            const eta_varis = reasonRow?.eta_varis || reasonRow?.eta || null;

            let gecikme_suresi_dk = null;
            if (eta_varis) {
                const etaMs = new Date(eta_varis).getTime();
                if (!Number.isNaN(etaMs)) {
                    const diff = Date.now() - etaMs;
                    gecikme_suresi_dk = Math.max(0, Math.round(diff / 60000));
                }
            }

            const today = new Date();
            const pad = (n) => String(n).padStart(2, "0");
            const y = today.getFullYear();
            const m = pad(today.getMonth() + 1);
            const d = pad(today.getDate());
            const tMin = `${y}-${m}-${d}T00:00:00`;
            const tMax = `${y}-${m}-${d}T23:59:59`;

            const { data: existing, error: exErr } = await supabase
                .from("eta_gecikme_nedenleri")
                .select("id")
                .eq("sefer_no", sefer_no)
                .gte("kayit_zamani", tMin)
                .lte("kayit_zamani", tMax)
                .limit(1);

            if (exErr) throw exErr;
            if ((existing || []).length > 0) {
                setSnack({ open: true, msg: "Bu sefere bugün zaten açıklama girilmiş.", severity: "warning" });
                return;
            }

            const payload = {
                ...(sefer_id ? { sefer_id } : {}),
                sefer_no,
                plaka: reasonRow?.plaka || null,
                surucu_ad_soyad: reasonRow?.surucu_ad_soyad || null,
                kategori,
                aciklama,
                kaydeden,
                kayit_zamani: new Date().toISOString(),
                sefer_tarihi,
                eta_varis,
                gecikme_suresi_dk,
            };

            const { error } = await supabase.from("eta_gecikme_nedenleri").insert(payload);
            if (error) throw error;

            addLog({ action: "Gecikme sebebi kaydedildi", sefer_no, fields: [kategori] });

            if (sefer_no) {
                setReasonNos((prev) => {
                    const n = new Set(prev);
                    n.add(sefer_no);
                    return n;
                });
            }

            setSnack({ open: true, msg: "Gecikme sebebi kaydedildi.", severity: "success" });
            setReasonOpen(false);
            setReasonRow(null);
            setReasonCat("");
            setReasonNote("");
        } catch (e) {
            console.error("saveLateReason error:", e?.message || e);
            setSnack({ open: true, msg: `Kaydedilemedi: ${e?.message || e}`, severity: "error" });
        } finally {
            setSaving(false);
        }
    };

    /* --------------- RENDER --------------- */
    return (
        <Box
            sx={{
                height: "100dvh",
                overflow: "hidden",
                display: "grid",
                gridTemplateRows: "auto auto auto 1fr", // Ana Box düzeni
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
                    <Button size="small" variant="text" startIcon={<ArrowBackIosNewIcon />} onClick={() => navigate(-1)}>
                        Geri
                    </Button>
                    <Button size="small" variant="text" startIcon={<HomeOutlinedIcon />} onClick={() => navigate("/anasayfa")}>
                        Anasayfa
                    </Button>

                    <FormControlLabel control={<Switch checked={dense} onChange={() => setDense((v) => !v)} size="small" />} label="Sıkı satırlar" sx={{ color: COLORS.textMuted }} />

                    <Chip label={`SFR: ${sfrCount}`} size="small" color="info" sx={{ fontWeight: 800 }} />

                    <Button size="small" variant="outlined" onClick={() => navigate("/aktifseferler/gorunum")}>
                        Görünümü Düzenle
                    </Button>

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
                </Stack>
            </Stack>

            {/* Filtreler */}
            <Filtreler
                COLORS={COLORS}
                baseInputSX={baseInputSX}
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
                    flexGrow: 1, // Kalan alanı kaplaması için
                    height: '1000px', // Kalan alanı doldurması için
                    overflow: "hidden",
                }}
            >
                <DataGrid
                    /* Sürükle-bırak & görünürlük kaydı */
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
                                apiRef.current.exportState?.().columns?.orderedFields
                                || apiRef.current?.state?.columns?.orderedFields
                                || [];
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
                        "& .MuiDataGrid-virtualScroller": { backgroundColor: COLORS.surface },
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
                        "& .MuiDataGrid-row:nth-of-type(2n) .MuiDataGrid-cell": { backgroundColor: COLORS.zebra },
                        "& .MuiDataGrid-row:hover": {
                            // Hover stilini buraya ekleyin
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
                <Box
                    sx={{
                        position: "fixed",
                        top: 16,
                        right: 16,
                        bgcolor: "success.main",
                        color: "#fff",
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        boxShadow: 3,
                        fontWeight: 700,
                        zIndex: 1300,
                    }}
                >
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
                        baseInputSX={baseInputSX}
                        editSefer={editSefer}
                        detailRows={detailRows}
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
                                if (!success) {
                                    return;
                                }

                                setRows((prev) =>
                                    prev.map((r) =>
                                        r.id === editSefer?.id
                                            ? { ...r, sefer_tarihi: yeniST || r.sefer_tarihi }
                                            : r
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

                                setSnack({ open: true, msg: "Kaydedildi. ETA arka planda güncelleniyor.", severity: "success" });
                            } catch (e) {
                                console.error(e);
                                setSnack({ open: true, msg: "Kaydetme sırasında hata oluştu.", severity: "error" });
                            }
                        }}
                        onMoveToCompleted={moveToCompleted}
                    />
                </Suspense>
            )}

            {/* GECİKME SEBEBİ DİYALOĞU */}
            <Dialog open={reasonOpen} onClose={() => setReasonOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Gecikme nedeni</DialogTitle>
                <DialogContent sx={{ pt: 1.5 }}>
                    <Stack spacing={1.5}>
                        <Typography variant="body2" sx={{ opacity: 0.8 }}>
                            Sefer: <b>{reasonRow?.sefer_no || "-"}</b>
                        </Typography>

                        <FormControl fullWidth size="small">
                            <InputLabel id="gecikme-kategori-label">Sebep</InputLabel>
                            <Select
                                labelId="gecikme-kategori-label"
                                label="Sebep"
                                value={reasonCat}
                                onChange={(e) => setReasonCat(e.target.value)}
                            >
                                <MenuItem value="müşteriden dolayı">müşteriden dolayı</MenuItem>
                                <MenuItem value="şoförden dolayı">şoförden dolayı</MenuItem>
                                <MenuItem value="odaktan dolayı">odaktan dolayı</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            label="Açıklama"
                            fullWidth
                            size="small"
                            multiline
                            minRows={2}
                            value={reasonNote}
                            onChange={(e) => setReasonNote(e.target.value)}
                        />

                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                                Sefer tarihi: <b>{reasonRow?.sefer_tarihi ? fromISOToCombined(reasonRow.sefer_tarihi) : "-"}</b>
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                                Kayıtlı ETA: <b>{reasonRow?.eta_varis ? fromISOToCombined(reasonRow.eta_varis) : (reasonRow?.eta ? fromISOToCombined(reasonRow.eta) : "-")}</b>
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                                Tahmini gecikme:{" "}
                                <b>{
                                    (() => {
                                        const iso = reasonRow?.eta_varis || reasonRow?.eta;
                                        if (!iso) return "-";
                                        const ms = new Date(iso).getTime();
                                        if (Number.isNaN(ms)) return "-";
                                        const diffMin = Math.max(0, Math.round((Date.now() - ms) / 60000));
                                        return formatDuration(diffMin);
                                    })()
                                }</b>
                            </Typography>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReasonOpen(false)}>Vazgeç</Button>
                    <Button onClick={saveLateReason} variant="contained">Kaydet</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
