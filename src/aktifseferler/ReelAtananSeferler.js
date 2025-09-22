// src/aktifseferler/ReelAtananSeferler.js
import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient"; // sadece id lookup için küçük kullanım
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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

/* Icons */
import ListeleButton from "./butonlar/listele";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

import Filtreler from "./filtreler";
import SenkronizeEtButton from "./butonlar/senkronizeEt";

/* constants */
import { COLORS } from "./constants/colors";

/* sefer utils (mevcutta var) */
import {
    isExcludedPlate,
    splitCell,
    clean,
    detailFields,
    computeAracStatu,
} from "./utils/sefer";

/* yeni: yardımcılar */
import buildColumns from "./columns";
import {
    nowLocalISO,
    fromISOToCombined,
    addMinutesISO,
    normalizeISO,
} from "./utils/datetime";
import { formatPhone, ellipsize, userCanEdit, userCanSeeETA } from "./utils/format";
import {
    AVG_SPEED_KMPH,
    BLOCK_MIN,
    parseHHMMtoMin,
    parseMesafeKm,
    computeETAWithKGM,
    BREAK_OPTIONS,
} from "./utils/eta";
import {
    fetchSeferler,
    fetchTamamlananNos,
    // syncFromTMS  -> BUTON DOSYASINA TAŞINDI
    // filterIncoming -> BUTON DOSYASINA TAŞINDI
    // upsertSeferler -> BUTON DOSYASINA TAŞINDI
    loadDetaylar,
    updateSefer,
    upsertDetaylar,
    fetchMesafe,
} from "./services";

// kişi bazlı görünüm anahtarları
const USERNAME = (localStorage.getItem("kullaniciAdi") || "GENERIC").toUpperCase();
const ORDER_KEY = `aktifseferler.columnOrder.${USERNAME}`;
const HIDDEN_KEY = `aktifseferler.hiddenColumns.${USERNAME}`;
const VIEW_BUMP_KEY = "aktifseferler.view.bump";

// 👇 GENERIC fallback anahtarları
const GENERIC_ORDER_KEY = `aktifseferler.columnOrder.GENERIC`;
const GENERIC_HIDDEN_KEY = `aktifseferler.hiddenColumns.GENERIC`;

// 👇 ROUTE sabitle (kendi gerçek rotana göre AYARLA!)
const LIST_PATH = "/aktifseferler";        // sende liste hangi path'teyse onu yaz
const VIEW_PATH = `${LIST_PATH}/gorunum`;  // görünüm sayfası


/* Diyaloglar (mevcutta var) */
const EditorDialog = lazy(() => import("./dialogs/EditorDialog"));
const EtaDialog = lazy(() => import("./dialogs/EtaDialog"));

/* küçük inputlar */
function DateTimeOneField(props) {
    return <TextField type="datetime-local" size="small" InputLabelProps={{ shrink: true }} {...props} />;
}
function TimeHMField(props) {
    return <TextField type="time" size="small" inputProps={{ step: 60 }} InputLabelProps={{ shrink: true }} {...props} />;
}

const canEdit = userCanEdit(localStorage.getItem("kullaniciAdi"));
const canSeeETA = userCanSeeETA(localStorage.getItem("kullaniciAdi"));

export default function ReelAtananSeferler() {
    const [viewBump, setViewBump] = useState(localStorage.getItem(VIEW_BUMP_KEY) || "0");

    useEffect(() => {
        const onStorage = (e) => {
            if (!e) return;
            if ([VIEW_BUMP_KEY, ORDER_KEY, HIDDEN_KEY].includes(e.key)) {
                // görünüm değişti → kolonları yeniden kurdur
                setViewBump(String(Date.now()));
            }
        };
        const onFocus = () => setViewBump(String(Date.now())); // sayfaya geri dönünce de tazele

        window.addEventListener("storage", onStorage);
        window.addEventListener("focus", onFocus);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("focus", onFocus);
        };
    }, []);

    const navigate = useNavigate();

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

    /* dialog (Edit) */
    const [editOpen, setEditOpen] = useState(false);
    const [editSefer, setEditSefer] = useState(null);
    const [detailRows, setDetailRows] = useState([]);
    const [seferTarihiYeni, setSeferTarihiYeni] = useState("");

    // ETA dialog state
    const [etaOpen, setEtaOpen] = useState(false);
    const [etaRow, setEtaRow] = useState(null);
    const [etaStartISO, setEtaStartISO] = useState("");
    const [driveHM, setDriveHM] = useState(""); // ilk mola öncesi kalan sürüş
    const [etaDetails, setEtaDetails] = useState([]);
    const [etaDistanceKm, setEtaDistanceKm] = useState(null); // mesafeler tablosundan km
    const [etaDistanceInfo, setEtaDistanceInfo] = useState(""); // UI bilgi
    const [breakSel, setBreakSel] = useState(0);

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

    const getSeferIdByNo = async (row) => {
        let id = row?.id ?? null;
        if (!id && row?.sefer_no) {
            const { data: s } = await supabase.from("seferler").select("id").eq("sefer_no", row.sefer_no).maybeSingle();
            id = s?.id ?? null;
        }
        return id;
    };

    const getLatestYuklemeCikisISO = (arr = []) => {
        const ts = arr.map((d) => normalizeISO(d?.yukleme_cikis)).filter(Boolean).sort();
        return ts.length ? ts[ts.length - 1] : null;
    };

    // ilk/son il-ilçe’yi çıkar (mesafe tablosu için)
    const pickOD = (row, detay) => {
        const first = (arr) => (arr.length ? arr[0] : "");
        const last = (arr) => (arr.length ? arr[arr.length - 1] : "");
        const yIl = first(splitCell(row.yukleme_ili || ""));
        const yIlce = first(splitCell(row.yukleme_ilcesi || ""));
        const tIl = last(splitCell(row.teslim_ili || ""));
        const tIlce = last(splitCell(row.teslim_ilcesi || ""));
        const dFirst = detay?.[0] || {};
        const dLast = detay?.[detay.length - 1] || {};
        return {
            yIl: yIl || dFirst.yukleme_ili || "",
            yIlce: yIlce || dFirst.yukleme_ilcesi || "",
            tIl: tIl || dLast.teslim_ili || "",
            tIlce: tIlce || dLast.teslim_ilcesi || "",
        };
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
        if (surucu) r = r.filter((x) => (x.surucu_ad_soyad || "") === surucu);

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

    const saveDetails = useCallback(async () => {
        if (!editSefer) return;
        setSaving(true);

        try {
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

                arac_statu: computeAracStatu(detailRows) || null,
                kayit_zamani: new Date().toISOString(),
            }));

            await upsertDetaylar(upserts);

            // Detaylar kaydedildi -> ETA otomatik güncelle
            try {
                const latest = getLatestYuklemeCikisISO(detailRows);
                if (editSefer?.id && latest) {
                    const { yIl, yIlce, tIl, tIlce } = pickOD(editSefer || {}, detailRows);
                    const mesafeRaw = await fetchMesafe({ yIl, yIlce, tIl, tIlce });
                    const km = parseMesafeKm(mesafeRaw);
                    if (km) {
                        // mevcut kayıtta kalan_surus_dk oku
                        const { data: srow } = await supabase
                            .from("seferler")
                            .select("kalan_surus_dk")
                            .eq("id", editSefer.id)
                            .maybeSingle();
                        const remain = Number(srow?.kalan_surus_dk) || BLOCK_MIN;

                        const newETA = computeETAWithKGM(km, latest, remain);
                        await updateSefer(editSefer.id, { eta_varis: newETA, kayit_zamani: new Date().toISOString() });
                        setRows((prev) => prev.map((r) => (r.id === editSefer.id ? { ...r, eta_varis: newETA } : r)));
                    }
                }
            } catch (e) {
                console.error("Auto ETA hesaplama hatası:", e);
            }

            setSnack({ open: true, msg: "Detaylar kaydedildi.", severity: "success" });
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: `Kaydetme hatası: ${e?.message || e}`, severity: "error" });
        } finally {
            setSaving(false);
        }
    }, [detailRows, editSefer]);

    const moveToCompleted = useCallback(async () => {
        if (!editSefer) return;
        if (!window.confirm("Bu sefer tamamlananlara aktarılacak. Devam edilsin mi?")) return;
        setSaving(true);
        try {
            const seferAna = rows.find((r) => r.id === editSefer.id) || editSefer;
            const seferTarihiFinal = seferTarihiYeni || seferAna.sefer_tarihi || null;

            // tamamlanan_* tablolarına aktarma (manuel payload)
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

            // detay payload
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
                kayit_zamani: new Date().toISOString(),
                arac_statu: seferAna.arac_statu ?? null,
            }));

            // doğrudan supabase ile (services’e taşımadıysak):
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
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Aktarım hatası.", severity: "error" });
        } finally {
            setSaving(false);
        }
    }, [detailRows, editSefer, rows, seferTarihiYeni, closeEditor]);

    /* ===== ETA PANELİ ===== */
    const openEditor = useCallback(
        async (row, aktarModu = false) => {
            if (!canEdit) {
                setSnack({ open: true, msg: "Bu işlemi yapma yetkiniz yok.", severity: "warning" });
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

            setDetailRows(
                detay.map((d) => ({
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
                }))
            );

            setSeferTarihiYeni(row?.sefer_tarihi || "");

            if (aktarModu) {
                setSnack({
                    open: true,
                    msg: "Detayları kontrol edip 'Tamamlananlara Aktar' ile işlemi bitirin.",
                    severity: "info",
                });
            }
        },
        [canEdit]
    );

    const openETA = useCallback(
        async (row) => {
            if (!canSeeETA) {
                setSnack({ open: true, msg: "ETA panelini görüntüleme yetkiniz yok.", severity: "warning" });
                return;
            }
            setEtaRow(row);
            setDriveHM("");
            setEtaDetails([]);
            setEtaDistanceKm(null);
            setEtaDistanceInfo("");
            setBreakSel(row?.eta_mola_dk ?? 0);
            setEtaOpen(true);

            try {
                const id = await getSeferIdByNo(row);

                let detay = [];
                if (id) detay = await loadDetaylar(id);

                if (!detay.length) {
                    const arrs = Object.fromEntries(detailFields.map((k) => [k, splitCell(row[k])]));
                    const len = Math.max(1, ...detailFields.map((k) => arrs[k].length));
                    const pick = (k, i) => arrs[k][i] ?? "";
                    detay = Array.from({ length: len }, (_, i) => ({
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

                setEtaDetails(detay);
                const latest = getLatestYuklemeCikisISO(detay);
                setEtaStartISO(latest || nowLocalISO());

                // MESAFE
                try {
                    const { yIl, yIlce, tIl, tIlce } = pickOD(row, detay);
                    const mesafeRaw = await fetchMesafe({ yIl, yIlce, tIl, tIlce });
                    const km = parseMesafeKm(mesafeRaw);
                    if (km) {
                        setEtaDistanceKm(km);
                        const safMin = Math.round((km / AVG_SPEED_KMPH) * 60);
                        setEtaDistanceInfo(
                            `${km.toFixed(0)} km • saf sürüş ~ ${Math.floor(safMin / 60)}s ${String(safMin % 60).padStart(2, "0")}d @ ${AVG_SPEED_KMPH} km/s`
                        );
                    } else {
                        setEtaDistanceKm(null);
                        setEtaDistanceInfo("Mesafe bulunamadı.");
                    }
                } catch {
                    setEtaDistanceKm(null);
                    setEtaDistanceInfo("Mesafe sorgusunda hata.");
                }
            } catch (e) {
                console.error(e);
                setEtaDetails([]);
                setEtaStartISO(nowLocalISO());
            }
        },
        [canSeeETA]
    );

    // Özet metinleri
    const originText = useMemo(() => {
        if (!etaRow) return "-";
        const first = (arr) => (arr.length ? arr[0] : "");
        const yuklemeIl = first(splitCell(etaRow.yukleme_ili || ""));
        const yuklemeIlce = first(splitCell(etaRow.yukleme_ilcesi || ""));
        const yuklemeNokta = first(splitCell(etaRow.yukleme_noktasi || ""));
        return [yuklemeNokta, yuklemeIlce, yuklemeIl].filter(Boolean).join(" • ");
    }, [etaRow]);

    const driverText = useMemo(() => {
        if (!etaRow) return "-";
        const ad = etaRow.surucu_ad_soyad || "-";
        const tel = formatPhone(etaRow.surucu_telefon || "");
        const tckn = (etaRow.surucu_tckn || "").toString();
        const tcknMasked = tckn ? `${tckn.slice(0, 3)}****${tckn.slice(-2)}` : "-";
        return `${ad} — ${tel} — ${tcknMasked}`;
    }, [etaRow]);

    const vehicleText = useMemo(() => {
        if (!etaRow) return "-";
        const p = etaRow.plaka || "-";
        const t = etaRow.treyler ? ` • Treyler: ${etaRow.treyler}` : "";
        return `${p}${t}`;
    }, [etaRow]);

    const jobText = useMemo(() => {
        if (!etaRow) return "-";
        const musteri = etaRow.musteri_adi || "-";
        const proje = etaRow.proje_adi || "-";
        return `${ellipsize(musteri, 50)} • ${ellipsize(proje, 50)}`;
    }, [etaRow]);

    const latestYuklemeCikis = useMemo(() => getLatestYuklemeCikisISO(etaDetails), [etaDetails]);

    const computedETAISO = useMemo(() => {
        try {
            const latest = getLatestYuklemeCikisISO(etaDetails);
            if (!latest) return "__WAITING__";
            if (!etaDistanceKm) return "__NEED_DISTANCE__";

            const base0 = etaStartISO || latest;
            const base = addMinutesISO(base0, Number(breakSel) || 0);
            const initialRemain = parseHHMMtoMin(driveHM) || BLOCK_MIN;
            return computeETAWithKGM(etaDistanceKm, base, initialRemain);
        } catch {
            return "";
        }
    }, [etaStartISO, driveHM, etaDetails, etaDistanceKm, breakSel]);

    const destinationText = useMemo(() => {
        if (!etaRow) return "-";
        const last = (arr) => (arr.length ? arr[arr.length - 1] : "");
        const teslimIl = last(splitCell(etaRow.teslim_ili || ""));
        const teslimIlce = last(splitCell(etaRow.teslim_ilcesi || ""));
        const teslimNokta = last(splitCell(etaRow.teslim_noktasi || ""));
        return [teslimNokta, teslimIlce, teslimIl].filter(Boolean).join(" • ");
    }, [etaRow]);

    const copyETA = useCallback(async () => {
        if (computedETAISO === "__WAITING__" || computedETAISO === "__NEED_DISTANCE__") return;
        const txt = fromISOToCombined(computedETAISO || "") || "-";
        try {
            await navigator.clipboard.writeText(txt);
            setSnack({ open: true, msg: `ETA kopyalandı: ${txt}`, severity: "success" });
        } catch {
            setSnack({ open: true, msg: "Kopyalanamadı.", severity: "error" });
        }
    }, [computedETAISO]);

    const saveETA = useCallback(async () => {
        try {
            setSaving(true);

            const id = await getSeferIdByNo(etaRow);
            if (!id) throw new Error("Sefer kaydı bulunamadı.");

            const latest = getLatestYuklemeCikisISO(etaDetails);
            const canCompute = !!(etaDistanceKm && (etaStartISO || latest));

            const base0 = etaStartISO || latest || nowLocalISO();
            const base = addMinutesISO(base0, Number(breakSel) || 0);
            const initialRemain = parseHHMMtoMin(driveHM) || BLOCK_MIN;

            const newETA = canCompute ? computeETAWithKGM(etaDistanceKm, base, initialRemain) : null;

            const payload = {
                eta_varis: newETA,
                kalan_surus_dk: Number(initialRemain) || null,
                kayit_zamani: new Date().toISOString(),
            };

            await updateSefer(id, payload);

            setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...payload } : r)));
            setSnack({
                open: true,
                msg: newETA
                    ? "ETA kaydedildi."
                    : "Bilgiler kaydedildi. Detaylarda 'Yükleme Çıkış' veya mesafe gelince ETA otomatik hesaplanacak.",
                severity: "success",
            });
        } catch (e) {
            console.error("Kaydetme exception:", e?.message, e);
            setSnack({ open: true, msg: `Kaydedilemedi: ${e?.message || e}`, severity: "error" });
        } finally {
            setSaving(false);
        }
    }, [etaRow, etaStartISO, driveHM, etaDetails, etaDistanceKm, breakSel]);

    /* grid columns (kullanıcı görünümü uygula) */
    const columns = useMemo(() => {
        let cols = buildColumns({ canEdit, canSeeETA, openETA, openEditor, COLORS });

        let userOrder = [];
        let hiddenIds = [];

        try {
            userOrder =
                JSON.parse(
                    localStorage.getItem(ORDER_KEY) ||
                    localStorage.getItem(GENERIC_ORDER_KEY) ||
                    "[]"
                ) || [];
        } catch { }

        try {
            hiddenIds =
                JSON.parse(
                    localStorage.getItem(HIDDEN_KEY) ||
                    localStorage.getItem(GENERIC_HIDDEN_KEY) ||
                    "[]"
                ) || [];
        } catch { }

        // Gizlileri at
        if (hiddenIds.length) {
            const hidden = new Set(hiddenIds);
            cols = cols.filter((c) => !hidden.has(c.field));
        }

        // Kullanıcı sırası
        if (userOrder.length) {
            const idx = new Map(userOrder.map((k, i) => [k, i]));
            cols = [...cols].sort((a, b) => {
                const ai = idx.has(a.field) ? idx.get(a.field) : Number.POSITIVE_INFINITY;
                const bi = idx.has(b.field) ? idx.get(b.field) : Number.POSITIVE_INFINITY;
                return ai - bi;
            });
        }

        // === BURADAN İTİBAREN ZORUNLU YERLEŞTİRME ===
        const lowerTR = (s) => String(s || "").toLocaleLowerCase("tr-TR");
        const getHeader = (c) => c.headerName || c.header || "";

        // buildColumns'taki field adlarına göre aday listeleri:
        // (Gerekiyorsa bu dizilerdeki field adlarını kendi projene göre güncelle.)
        const findCol = (preferFields = [], headerNeedle = "") => {
            let c = cols.find((col) => preferFields.includes(col.field));
            if (c) return c;
            if (headerNeedle)
                c = cols.find((col) => lowerTR(getHeader(col)).includes(lowerTR(headerNeedle)));
            return c;
        };

        const islem = findCol(["islem", "actions", "_actions"], "işlem"); // İşlem
        const reel = findCol(["reel_durum"], "reel");                     // REEL DURUM
        const eta = findCol(["eta_varis", "eta"], "eta");                // ETA
        const kalan = findCol(["kalan_surus_dk", "kalan", "kalan_dk"], "kalan"); // Kalan (dk)

        if (islem && reel && (eta || kalan)) {
            // Mevcut listeden ETA ve Kalan'ı (varsa) çıkar
            const rest = cols.filter(
                (c) => c.field !== eta?.field && c.field !== kalan?.field
            );

            // "İşlem" ve "REEL DURUM"un en sondakinden sonra ekleme yapacağız
            const idxIslem = rest.findIndex((c) => c.field === islem.field);
            const idxReel = rest.findIndex((c) => c.field === reel.field);
            const insertAt = Math.max(idxIslem, idxReel) + 1;

            const toInsert = [eta, kalan].filter(Boolean); // sırası: ETA sonra Kalan
            cols = [
                ...rest.slice(0, insertAt),
                ...toInsert,
                ...rest.slice(insertAt),
            ];
        }
        // === ZORUNLU YERLEŞTİRME BİTTİ ===

        return cols;
        // viewBump zaten dependency'de
    }, [canEdit, canSeeETA, openETA, openEditor, viewBump]);

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

    // Senkronizasyon yetkisi (basit kural)
    const canSync = (() => {
        const name = (localStorage.getItem("kullaniciAdi") || "").toUpperCase();
        return name === "ADMIN" || name === "SELİN";
    })();

    /* --------------- RENDER --------------- */
    return (
        <Box
            sx={{
                height: "100dvh",
                overflow: "hidden",
                display: "grid",
                gridTemplateRows: "auto auto 1fr",
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

                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(VIEW_PATH)}
                    >
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

                    {/* Senkronizasyon butonu (taşındı) */}
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
                    height: { xs: 40, md: "70vh" },
                    overflow: "hidden",
                }}
            >
                <DataGrid
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

            {/* Detay Editör (lazy) */}
            {editOpen && (
                <Suspense fallback={null}>
                    <EditorDialog
                        open={editOpen}
                        onClose={closeEditor}
                        canEdit={canEdit}
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
                                setSaving(true);
                                if (editSefer?.id && (seferTarihiYeni || "") !== (editSefer?.sefer_tarihi || "")) {
                                    await updateSefer(editSefer.id, { sefer_tarihi: seferTarihiYeni || null });
                                }
                                await saveDetails();
                                setRows((prev) =>
                                    prev.map((r) => (r.id === editSefer?.id ? { ...r, sefer_tarihi: seferTarihiYeni || r.sefer_tarihi } : r))
                                );
                            } catch (e) {
                                console.error(e);
                                setSnack({ open: true, msg: "Kaydetme sırasında hata oluştu.", severity: "error" });
                            } finally {
                                setSaving(false);
                            }
                        }}
                        onMoveToCompleted={moveToCompleted}
                    />
                </Suspense>
            )}

            {etaOpen && (
                <Suspense fallback={null}>
                    <EtaDialog
                        open={etaOpen}
                        onClose={() => setEtaOpen(false)}
                        COLORS={COLORS}
                        etaRow={etaRow}
                        vehicleText={vehicleText}
                        driverText={driverText}
                        jobText={jobText}
                        originText={originText}
                        destinationText={destinationText}
                        etaDistanceInfo={etaDistanceInfo}
                        DateTimeOneField={DateTimeOneField}
                        TimeHMField={TimeHMField}
                        BREAK_OPTIONS={BREAK_OPTIONS}
                        latestYuklemeCikis={latestYuklemeCikis}
                        nowLocalISO={nowLocalISO}
                        baseInputSX={baseInputSX}
                        etaStartISO={etaStartISO}
                        setEtaStartISO={setEtaStartISO}
                        driveHM={driveHM}
                        setDriveHM={setDriveHM}
                        breakSel={breakSel}
                        setBreakSel={setBreakSel}
                        computedETAISO={computedETAISO}
                        fromISOToCombined={fromISOToCombined}
                        copyETA={copyETA}
                        saveETA={saveETA}
                    />
                </Suspense>
            )}
        </Box>
    );
}
