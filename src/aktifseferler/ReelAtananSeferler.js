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
// ETA ile ilgili import'lar kaldırıldı
import {
    fetchSeferler,
    fetchTamamlananNos,
    loadDetaylar,
    updateSefer,
    upsertDetaylar,
    // fetchMesafe kaldırıldı
} from "./services";

import usePermissions from "../auth/usePermissions";

// YENİ EKLENDİ (Blok 1/4) - Diyalog Importları
/* Diyaloglar */
const EditorDialog = lazy(() => import("./dialogs/EditorDialog"));
const ETAEditor = lazy(() => import("./dialogs/ETAEditor"));


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

    // FLAGS: olası alternatif anahtar isimlerini de destekle
    const {
        // birincil isimler
        aktif_can_sync = false,
        aktif_can_edit = false,
        aktif_may_open_edit = false,
        aktif_can_delete = false,

        // muhtemel alternatif isimler (backend farklı isimle gönderiyorsa)
        aktif_seferler_can_sync = false,
        aktif_seferler_can_edit = false,
        aktif_seferler_may_open_edit = false,
        aktif_seferler_can_delete = false,

        // admin sinyalleri
        admin = false,
        is_admin = false,
        role = "",
    } = flags;

    // string/number → bool
    const toBool = (v) => {
        if (typeof v === "boolean") return v;
        if (typeof v === "number") return v === 1;
        if (v == null) return false;
        const s = String(v).trim().toLowerCase();
        return s === "true" || s === "1" || s === "yes" || s === "y" || s === "on";
    };

    // admin bypass
    const isAdminBypass =
        toBool(admin) ||
        toBool(is_admin) ||
        String(role).toLowerCase() === "admin" ||
        toBool(localStorage.getItem("isAdmin")) ||
        toBool(localStorage.getItem("admin"));

    // önce birincil, yoksa alternatif → yoksa edit yetkisine düş
    const rawCanSync = (aktif_can_sync ?? aktif_seferler_can_sync ?? false);
    const rawCanEdit = (aktif_can_edit ?? aktif_seferler_can_edit ?? false);
    const rawMayOpen = (aktif_may_open_edit ?? aktif_seferler_may_open_edit ?? false);
    const rawCanDelete = (
        aktif_can_delete ??
        aktif_seferler_can_delete ??
        aktif_can_edit ??
        aktif_seferler_can_edit ??
        false
    );

    const canSync = isAdminBypass || toBool(rawCanSync);
    const canEdit = isAdminBypass || toBool(rawCanEdit);
    const mayOpenEdit = isAdminBypass || toBool(rawMayOpen);
    const canDelete = isAdminBypass || toBool(rawCanDelete);

    console.debug("[perms:raw]", {
        aktif_can_delete, aktif_seferler_can_delete,
        aktif_can_edit, aktif_seferler_can_edit,
        rawCanDelete, canDelete, isAdminBypass
    });

    // (isteğe bağlı) görünür debug
    useEffect(() => {
        console.debug("[perms]", {
            flags,
            isAdminBypass,
            canSync,
            canEdit,
            mayOpenEdit,
            canDelete,
        });
        window.__perms = { flags, isAdminBypass, canSync, canEdit, mayOpenEdit, canDelete };
    }, [flags, isAdminBypass, canSync, canEdit, mayOpenEdit, canDelete]);

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
    const [detailRowsOrig, setDetailRowsOrig] = useState([]);
    const [seferTarihiYeni, setSeferTarihiYeni] = useState("");

    // YENİ EKLENDİ (Blok 2/4) - ETA Diyalog State'leri
    const [etaEditorOpen, setEtaEditorOpen] = useState(false);
    const [etaSefer, setEtaSefer] = useState(null);


    const addLog = (entry) => {
        try {
            const all = JSON.parse(localStorage.getItem("aktifseferler.logs") || "[]");
            const user = localStorage.getItem("kullanici") || "-";
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

    useEffect(() => {
        listData();
    }, [listData]);

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

    // saveDetails: Arka plan ETA tetikleyicisi kaldırıldı
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

            setSnack({ open: true, msg: "Detaylar kaydedildi.", severity: "success" });
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

    const deleteSefer = useCallback(async (row) => {
        if (!canDelete) {
            console.debug("[delete] blocked", {
                flags,
                isAdminBypass,
                rawCanDelete: flags?.aktif_can_delete ?? flags?.aktif_seferler_can_delete,
                canDelete
            });
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
    }, [canDelete, flags, isAdminBypass, setSaving, setRows]);


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

    // YENİ EKLENDİ (Blok 3/4) - ETA Diyalog Fonksiyonları
    const openEtaEditor = useCallback((row) => {
        setEtaSefer(row);
        setEtaEditorOpen(true);
    }, []);

    const closeEtaEditor = useCallback(() => {
        setEtaEditorOpen(false);
        setEtaSefer(null);
    }, []);


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
            openEditor,
            openEtaEditor: openEtaEditor, // YENİ EKLENDİ
            onDeleteRow: deleteSefer,
            COLORS,
            perms: { loading: permsLoading, mayOpenEdit, canEdit, canDelete },
            userOrder: userOrder,
            hasUserOrder: hasUserOrder,
        });

        return cols;
    }, [
        permsLoading,
        mayOpenEdit,
        canEdit,
        canDelete,
        openEditor,
        openEtaEditor, // YENİ EKLENDİ
        deleteSefer,
        viewBump,
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
                        section-separator
                        fromISOToCombined={fromISOToCombined}
                        DateTimeOneField={DateTimeOneField}
                        seferTarihiYeni={seferTarihiYeni}
                        setSeferTarihiYeni={setSeferTarihiYeni}
                        addDetailRow={addDetailRow}
                        copyDetailRow={copyDetailRow}
                        _ removeDetailRow={removeDetailRow}
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

            {/* YENİ EKLENDİ (Blok 4/4) - ETA Editör Render */}
            {etaEditorOpen && (
                <Suspense fallback={null}>
                    <ETAEditor
                        open={etaEditorOpen}
                        onClose={closeEtaEditor}
                        sefer={etaSefer}
                    />
                </Suspense>
            )}

        </Box>
    );
}
