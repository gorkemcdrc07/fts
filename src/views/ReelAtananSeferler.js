// src/kullanıcıIslemleri/ReelAtananSeferler.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

/* MUI */
import {
    Box, Paper, Stack, Button, Typography, TextField, MenuItem, Snackbar, Alert,
    Backdrop, CircularProgress, Chip, Dialog, DialogTitle, DialogContent,
    DialogActions, IconButton, Tooltip, Divider, Switch, FormControlLabel, Grid,
    Card, CardContent, CardHeader,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
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
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PersonIcon from "@mui/icons-material/Person";
import PlaceIcon from "@mui/icons-material/Place";
import FlagIcon from "@mui/icons-material/Flag";
import NumbersIcon from "@mui/icons-material/Numbers";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";


/* ---------------- helpers ---------------- */
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);


const EXCLUDED_PLAKAS = new Set([
    "34NHF579", "34NHF636", "34NHF705", "34NHF757",
    "34NHF811", "34NHF868", "34NHF916", "34NHF964",
    "34NHG120", "34NHG208", "06CFZ391", "33ADV488",
    "54AEH576", "26ADN765", "06GD7290", "33ABF523",
    "33AIM809", "33AVC168", "33ACR730"
]);

const normalizePlate = (s) => (s ?? "").toString().toUpperCase().replace(/[\s-]/g, "");
const isExcludedPlate = (p) => EXCLUDED_PLAKAS.has(normalizePlate(p));

const splitCell = (v) => (v ?? "").toString().split(";").map((x) => x.trim()).filter((x) => x !== "");
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
const isDateComplete = (txt) => /^\d{2}\.\d{2}\.\d{4}$/.test(txt);
const isTimeComplete = (txt) => /^\d{2}:\d{2}$/.test(txt);
const toISO = (dateTR, time) => {
    if (!(isDateComplete(dateTR) && isTimeComplete(time))) return "";
    const [dd, mm, yyyy] = dateTR.split(".");
    return `${yyyy}-${mm}-${dd}T${time}`;
};
const fromISO = (raw) => {
    if (!raw) return { d: "", t: "" };
    const iso = raw instanceof Date ? toLocalISO(raw) : String(raw); // toISOString yerine yerel
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
    if (!m) return { d: "", t: "" };
    const [, y, mo, dd, hh, mi] = m;
    const d = `${dd}.${mo}.${y}`;
    const t = (hh && mi) ? `${hh}:${mi}` : "";
    return { d, t };
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
const fromISOToCombined = (raw) => {
    const { d, t } = fromISO(raw);
    return d ? (t ? `${d} ${t}` : d) : "";
};
// Yerel ISO üret (YYYY-MM-DDTHH:MM)
const toLocalISO = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const nowLocalISO = () => toLocalISO(new Date());


// API’den gelen çeşitli tarih formatlarını güvenli ISO’ya çevir
const normalizeISO = (raw) => {
    if (!raw) return null;
    if (raw instanceof Date && !isNaN(raw)) return toLocalISO(raw); // yerel
    const s = String(raw).trim();
    const m = s.match(/\/Date\((\d+)\)\//);           // /Date(…)/ -> epoch
    if (m) return toLocalISO(new Date(Number(m[1])));
    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(s)) // zaten ISO benzeri
        return s.replace(" ", "T").slice(0, 16);      // TZ ekleme, saniyeyi at
    const d = new Date(s);
    return isNaN(d) ? null : toLocalISO(d);
};

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

/* === Zaman alanı (ss.dd) ve süre dönüştürücü yardımcılar === */
function TimeHMField({ label, value, onChange, sx }) {
    const [text, setText] = useState("");

    useEffect(() => {
        const v = (value || "").toString();
        setText(v ? v.replace(":", ".") : ""); // ekranda ss.dd
    }, [value]);

    const handleChange = (e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 4); // ssdd
        const hh = digits.slice(0, 2);
        const m1 = digits.slice(2, 3);
        const mm = digits.slice(2, 4);

        let display = hh;
        if (digits.length === 2) display = `${hh}.`;
        else if (digits.length === 3) display = `${hh}.${m1}`;
        else if (digits.length === 4) display = `${hh}.${mm}`;

        setText(display);

        if (digits.length === 0) onChange("");
        else if (digits.length <= 2) onChange(hh);
        else if (digits.length === 3) onChange(`${hh}:${m1}`);
        else {
            const mmNum = Math.min(59, Math.max(0, parseInt(mm || "0", 10) || 0));
            onChange(`${hh}:${String(mmNum).padStart(2, "0")}`);
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

// "HH:MM" -> toplam dakika
function parseHHMMtoMin(txt) {
    const [h = "0", m = "0"] = String(txt || "").split(":");
    const hh = parseInt(h, 10) || 0;
    const mm = parseInt(m, 10) || 0;
    return Math.max(0, hh * 60 + mm);
}

// ETA için en güncel "yukleme_cikis"
const getLatestYuklemeCikisISO = (arr = []) => {
    const ts = arr.map(d => normalizeISO(d?.yukleme_cikis)).filter(Boolean).sort();
    return ts.length ? ts[ts.length - 1] : null;
};

// ==== KGM + Mesafe ETA yardımcıları ====
const AVG_SPEED_KMPH = 65;           // tır ortalama hız
const BLOCK_MIN = 270;               // 4.5 saat
const BREAK1_MIN = 45;               // 45 dk mola
const DAILY_REST_MIN = 11 * 60;      // 11 saat

// "1.685,69" -> 1685.69 (km)
const parseMesafeKm = (v) => {
    const s = String(v ?? "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
};

// Mesafe(km) + KGM: 4.5s -> 45dk -> 4.5s -> 45dk + 11s -> ...
function computeETAWithKGM(distanceKm, startISO, initialRemainMin = BLOCK_MIN, speedKmh = AVG_SPEED_KMPH) {
    const kmPerMin = speedKmh / 60;
    let remainingKm = Math.max(0, distanceKm);
    let t = new Date(startISO);
    let remainToBreak = Math.max(0, initialRemainMin);
    let blocksToday = 0;

    while (remainingKm > 0.01) {
        if (remainToBreak <= 0) {
            if (blocksToday === 1) t = new Date(t.getTime() + BREAK1_MIN * 60000);
            else if (blocksToday === 2) { t = new Date(t.getTime() + (BREAK1_MIN + DAILY_REST_MIN) * 60000); blocksToday = 0; }
            remainToBreak = BLOCK_MIN;
            continue;
        }
        const canDriveKm = remainToBreak * kmPerMin;
        const driveKm = Math.min(remainingKm, canDriveKm);
        const driveMin = Math.round(driveKm / kmPerMin);

        t = new Date(t.getTime() + driveMin * 60000);
        remainingKm -= driveKm;
        remainToBreak -= driveMin;

        if (remainingKm <= 0.01) break; // vardık

        // blok bitti -> zorunlu mola/istirahat
        blocksToday += 1;
        if (blocksToday === 1) t = new Date(t.getTime() + BREAK1_MIN * 60000);
        else if (blocksToday === 2) { t = new Date(t.getTime() + (BREAK1_MIN + DAILY_REST_MIN) * 60000); blocksToday = 0; }
        remainToBreak = BLOCK_MIN;
    }

    const pad = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

// mola seçenekleri + başlangıca dakika ekleme
const BREAK_OPTIONS = [
    { label: "Yok", value: 0 },
    { label: "45 dk", value: 45 },
    { label: "11 saat", value: 11 * 60 },
];

const addMinutesISO = (iso, min = 0) => {
    const d = new Date(iso || nowLocalISO());
    return toLocalISO(new Date(d.getTime() + (Number(min) || 0) * 60000));
};


// ilk/son il-ilçe’yi çıkar
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
    const [driveHM, setDriveHM] = useState("");          // ilk mola öncesi kalan sürüş
    const [etaDetails, setEtaDetails] = useState([]);
    const [etaDistanceKm, setEtaDistanceKm] = useState(null);   // mesafeler tablosundan km
    const [etaDistanceInfo, setEtaDistanceInfo] = useState(""); // UI bilgi
    const [breakSel, setBreakSel] = useState(0); // başlangıçta mola: 0 / 45 / 660
    // breakSel artık kullanılmıyor (silebilirsin)

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

    /* listele */
    const listData = useCallback(async () => {
        setLoading(true);
        try {
            const rangeMin = (startDate || daysAgoISO(6)) + "T00:00:00";
            const rangeMax = (endDate || todayISO()) + "T23:59:59";

            const { data, error } = await supabase
                .from("seferler").select("*")
                .gte("sefer_tarihi", rangeMin)
                .lte("sefer_tarihi", rangeMax)
                .ilike("sefer_no", "SFR%")
                .order("sefer_tarihi", { ascending: false });
            if (error) throw error;

            const { data: tamamlananNos } = await supabase
                .from("tamamlanan_seferler")
                .select("sefer_no")
                .gte("sefer_tarihi", rangeMin)
                .lte("sefer_tarihi", rangeMax);

            const COMPLETED_NOS = new Set(
                (tamamlananNos || [])
                    .map(x => (x.sefer_no ?? "").toString().trim())
                    .filter(v => v.length > 0)
            );

            const visible = (data || [])
                .filter(s => (s.sefer_no || '').toString().trim().toUpperCase().startsWith('SFR'))
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

            const res = await fetch(`${API_BASE_URL}/api/proxy/tmsdespatches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: start,
                    endDate: end,
                    userId: 1,
                    CustomerId: 0,
                    SupplierId: 0,
                    DriverId: 0,
                    TMSDespatchId: 0,
                    VehicleId: 0,
                    DocumentPrint: "",
                    WorkingTypesId: [3, 4],
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
                .gte("sefer_tarihi", start)
                .lte("sefer_tarihi", end);

            const COMPLETED_NOS = new Set(
                (tamamlananNos || [])
                    .map((x) => (x.sefer_no ?? "").toString().trim())
                    .filter((v) => v.length > 0)
            );

            const gelen = json.Data.filter((x) => x && typeof x === "object");
            const filtreli = gelen
                .filter((item) => {
                    const tip = (item?.VehicleWorkingTypeName || "").toString().trim().toUpperCase();
                    return tip === "FİLO" || tip === "ÖZMAL";
                })
                .filter((item) => {
                    const docNo = (item?.DocumentNo || "").toString().trim().toUpperCase();
                    return docNo.startsWith("SFR");
                })
                .filter((item) => !EXCLUDED_PLAKAS.has(normalizePlate(item?.PlateNumber)))
                .filter((item) => !COMPLETED_NOS.has((item?.DocumentNo ?? "").toString().trim()));

            const mapOrders = (orders, field) =>
                Array.isArray(orders)
                    ? orders
                        .filter((o) => o && typeof o === "object")
                        .map((o) => o[field] ?? "")
                        .filter(Boolean)
                        .join("; ")
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

            // Var olanları çekip eşle
            const { data: mevcut } = await supabase
                .from("seferler")
                .select("id,sefer_no")
                .gte("sefer_tarihi", start)
                .lte("sefer_tarihi", end);

            const mapDb = new Map((mevcut || []).map((r) => [r.sefer_no?.trim(), r]));

            const seenNew = [];
            const upsert = [];

            const stripId = (obj) => {
                const { id, _rid, ...rest } = obj || {};
                return rest;
            };

            for (const item of temiz) {
                const key = (item.sefer_no ?? "").trim();
                const eski = mapDb.get(key);

                if (!eski) {
                    const yeni = { ...item, reel_durum: "YENİ" };
                    const temizYeni = stripId(yeni);
                    seenNew.push(temizYeni);
                    upsert.push(temizYeni);
                } else {
                    const merged = stripId({ ...item, reel_durum: "ESKİ" });
                    seenNew.push(merged);
                    upsert.push(merged);
                }
            }

            if (upsert.length) {
                const { error: upErr } = await supabase
                    .from("seferler")
                    .upsert(upsert, { onConflict: "sefer_no" })
                    .select();
                if (upErr) throw upErr;
            }

            setSuccessCount(upsert.length);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3500);

            const enriched = seenNew.map((s, idx) => {
                const maxLen = Math.max(0, ...detailFields.map((k) => splitCell(s[k]).length));
                return { ...s, _rid: s.sefer_no ?? `tmp-${Date.now()}-${idx}`, nokta_sayisi: maxLen || 0 };
            });
            setRows(enriched);
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Senkronizasyon hatası.", severity: "error" });
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => { listData(); }, [listData]);

    const filtered = useMemo(() => {
        let r = [...rows].filter(x => (x.reel_durum || "") !== "EŞLEŞME YOK");
        if (seferNoTipi) r = r.filter((x) => (x.sefer_no || "").toUpperCase().startsWith(seferNoTipi));
        if (plaka) r = r.filter((x) => (x.plaka || "").toLowerCase().includes(plaka.toLowerCase()));
        if (musteri) r = r.filter((x) => (x.musteri_adi || "").toLowerCase().includes(musteri.toLowerCase()));
        if (proje) r = r.filter((x) => (x.proje_adi || "").toLowerCase().includes(proje.toLowerCase()));
        if (yuklemeIl) r = r.filter((x) => (x.yukleme_ili || "") === yuklemeIl);
        if (teslimIl) r = r.filter((x) => (x.teslim_ili || "") === teslimIl);
        if (aracStatu) r = r.filter((x) => (x.arac_statu || "") === aracStatu);
        // ↓↓↓ EKLE
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
        // ↓↓↓ dependency listesine 'surucu' ekle
    }, [rows, seferNoTipi, plaka, musteri, proje, yuklemeIl, teslimIl, aracStatu, noktaSayisi, quick, surucu]);

    const sfrCount = useMemo(
        () => filtered.reduce((n, x) => n + ((x.sefer_no || "").toUpperCase().startsWith("SFR") ? 1 : 0), 0),
        [filtered]
    );

    /* ======= YETKİLER ======= */
    const normalizeUser = (s) =>
        (s || "")
            .toLocaleUpperCase("tr-TR")
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/\s+/g, "");

    const allowedEditors = new Set(["ADMIN", "SELIN", "BEKIRAKCAGOZ"]);
    const canEdit = allowedEditors.has(normalizeUser(localStorage.getItem("kullaniciAdi")));

    const allowedETA = new Set(["MERT", "FERHATKARISLI", "BEKIRAKCAGOZ", "ADMIN", "SELCUK", "BUKETCIMENCI"]);
    const canSeeETA = allowedETA.has(normalizeUser(localStorage.getItem("kullaniciAdi")));

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
                proje_adi: "", yukleme_noktasi: "", yukleme_ili: "", yukleme_ilcesi: "",
                teslim_noktasi: "", teslim_ili: "", teslim_ilcesi: "",
                yukleme_varis: "", yukleme_cikis: "", teslim_varis: "", teslim_cikis: "",
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

    // ESKİSİNİ SİL → AYNISINI BU BLOKLA DEĞİŞTİR
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

            const { error: detErr } = await supabase
                .from("sefer_detaylari")
                .upsert(upserts, { onConflict: "sefer_id,nokta_sirasi" });
            if (detErr) throw detErr;

            // ⬇️⬇️⬇️ BURASI YENİ: Detaylar kaydedildi -> ETA otomatik güncelle
            try {
                // Son "yukleme_cikis" yakala
                const latest = getLatestYuklemeCikisISO(detailRows);
                if (editSefer?.id && latest) {
                    // Mesafe çek (ilk/son il-ilçe)
                    const { yIl, yIlce, tIl, tIlce } = pickOD(editSefer || {}, detailRows);
                    const { data: rec } = await supabase
                        .from("mesafeler")
                        .select("mesafe")
                        .ilike("yukleme_il", yIl)
                        .ilike("yukleme_ilce", yIlce)
                        .ilike("teslim_il", tIl)
                        .ilike("teslim_ilce", tIlce)
                        .maybeSingle();

                    const km = parseMesafeKm(rec?.mesafe);
                    if (km) {
                        // Kullanıcının daha önce girdiği kalan sürüş varsa al
                        const { data: srow } = await supabase
                            .from("seferler")
                            .select("kalan_surus_dk")
                            .eq("id", editSefer.id)
                            .maybeSingle();
                        const remain = Number(srow?.kalan_surus_dk) || BLOCK_MIN;

                        const newETA = computeETAWithKGM(km, latest, remain);
                        const { error: eUp } = await supabase
                            .from("seferler")
                            .update({ eta_varis: newETA, kayit_zamani: new Date().toISOString() })
                            .eq("id", editSefer.id);
                        if (eUp) console.error("ETA update error:", eUp);

                        setRows(prev =>
                            prev.map(r => (r.id === editSefer.id ? { ...r, eta_varis: newETA } : r))
                        );
                    }
                }
            } catch (e) {
                console.error("Auto ETA hesaplama hatası:", e);
            }
            // ⬆️⬆️⬆️ YENİ BLOK SONU

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
    }, [detailRows, editSefer]);

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

                kayit_zamani: new Date().toISOString(),
                arac_statu: seferAna.arac_statu ?? null,
            }));
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
        } finally { setSaving(false); }
    }, [detailRows, editSefer, rows, seferTarihiYeni, closeEditor]);

    // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    // EKSİK OLAN FONKSİYON GERİ EKLENDİ
    const openEditor = useCallback(async (row, aktarModu = false) => {
        if (!canEdit) {
            setSnack({ open: true, msg: "Bu işlemi yapma yetkiniz yok.", severity: "warning" });
            return;
        }

        setEditSefer(row);
        setEditOpen(true);

        let id = row?.id ?? null;
        if (!id && row?.sefer_no) {
            const { data: s } = await supabase
                .from("seferler").select("id").eq("sefer_no", row.sefer_no).maybeSingle();
            id = s?.id ?? null;
        }
        if (id) setEditSefer((prev) => ({ ...(prev || row), id }));

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

        setDetailRows(detay.map((d) => ({
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
        })));

        setSeferTarihiYeni(row?.sefer_tarihi || "");

        if (aktarModu) {
            setSnack({
                open: true,
                msg: "Detayları kontrol edip 'Tamamlananlara Aktar' ile işlemi bitirin.",
                severity: "info",
            });
        }
    }, [canEdit]);
    // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    /* ===== ETA PANELİ ===== */
    const openETA = useCallback(async (row) => {
        if (!canSeeETA) {
            setSnack({ open: true, msg: "ETA panelini görüntüleme yetkiniz yok.", severity: "warning" });
            return;
        }
        setEtaRow(row);
        setDriveHM("");
        setEtaDetails([]);
        setEtaDistanceKm(null);
        setEtaDistanceInfo("");
        setBreakSel(row?.eta_mola_dk ?? 0); // kayıt varsa al, yoksa 0
        setEtaOpen(true);

        try {
            let id = row?.id ?? null;
            if (!id && row?.sefer_no) {
                const { data: s } = await supabase
                    .from("seferler").select("id").eq("sefer_no", row.sefer_no).maybeSingle();
                id = s?.id ?? null;
            }

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

            // --- MESAFE: mesafeler tablosundan çek ---
            try {
                const { yIl, yIlce, tIl, tIlce } = pickOD(row, detay);

                const { data: rec } = await supabase
                    .from("mesafeler")
                    .select("mesafe")
                    .ilike("yukleme_il", yIl)
                    .ilike("yukleme_ilce", yIlce)
                    .ilike("teslim_il", tIl)
                    .ilike("teslim_ilce", tIlce)
                    .maybeSingle();

                const km = parseMesafeKm(rec?.mesafe);
                if (km) {
                    setEtaDistanceKm(km);
                    const safMin = Math.round((km / AVG_SPEED_KMPH) * 60);
                    setEtaDistanceInfo(`${km.toFixed(0)} km • saf sürüş ~ ${Math.floor(safMin / 60)}s ${String(safMin % 60).padStart(2, "0")}d @ ${AVG_SPEED_KMPH} km/s`);
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
    }, [canSeeETA]);

    // kullanışlı: son yukleme_cikis'i memoize edelim
    // --- Yükleme (origin) ve Şoför özetleri ---
    const originText = useMemo(() => {
        if (!etaRow) return "-";
        const first = (arr) => (arr.length ? arr[0] : "");
        const yuklemeIl = first(splitCell(etaRow.yukleme_ili || ""));
        const yuklemeIlce = first(splitCell(etaRow.yukleme_ilcesi || ""));
        const yuklemeNokta = first(splitCell(etaRow.yukleme_noktasi || ""));
        return [yuklemeNokta, yuklemeIlce, yuklemeIl].filter(Boolean).join(" • ");
    }, [etaRow]);

    const formatPhone = (s = "") => {
        const d = String(s).replace(/\D/g, "");
        if (d.length < 10) return s || "-";
        // ör: 5437819538 -> 543 781 95 38
        return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
    };

    const ellipsize = (txt, max = 60) => {
        const s = String(txt || "");
        return s.length > max ? s.slice(0, max - 1) + "…" : s;
    };


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
        const plaka = etaRow.plaka || "-";
        const treyler = etaRow.treyler ? ` • Treyler: ${etaRow.treyler}` : "";
        return `${plaka}${treyler}`;
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
            const base = addMinutesISO(base0, Number(breakSel) || 0); // seçilen mola başlangıca eklenir
            const initialRemain = parseHHMMtoMin(driveHM) || BLOCK_MIN; // ilk mola öncesi kalan sürüş
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

            let id = etaRow?.id ?? null;
            if (!id && etaRow?.sefer_no) {
                const { data: s, error: idErr } = await supabase
                    .from("seferler")
                    .select("id")
                    .eq("sefer_no", etaRow.sefer_no)
                    .maybeSingle();
                if (idErr) console.error("ID sorgu hatası:", idErr);
                id = s?.id ?? null;
            }
            if (!id) throw new Error("Sefer kaydı bulunamadı.");

            // Hesaplanabilir mi?
            const latest = getLatestYuklemeCikisISO(etaDetails);
            const canCompute = !!(etaDistanceKm && (etaStartISO || latest));

            // Baz (başlangıç) ve parametreler
            const base0 = etaStartISO || latest || nowLocalISO();
            const base = addMinutesISO(base0, Number(breakSel) || 0);
            const initialRemain = parseHHMMtoMin(driveHM) || BLOCK_MIN;

            const newETA = canCompute
                ? computeETAWithKGM(etaDistanceKm, base, initialRemain)
                : null;

            const payload = {
                eta_varis: newETA,                          // hesaplanamadıysa null kaydedilir
                kalan_surus_dk: Number(initialRemain) || null,
                kayit_zamani: new Date().toISOString(),
            };

            const { error } = await supabase.from("seferler").update(payload).eq("id", id).select("id");
            if (error) throw error;

            setRows(prev => prev.map(r => (r.id === id ? { ...r, ...payload } : r)));
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

    /* grid columns — aksiyon sütunu: Edit ve/veya ETA */
    /* grid columns — aksiyon sütunu: Edit ve/veya ETA */
    const columns = useMemo(() => {
        const txt = (f, t, w = 170) => ({ field: f, headerName: t, width: w, sortable: true });

        // ETA & Kalan sütunlarını ayrı tanımlıyoruz (yerini dinamik ayarlayacağız)
        const etaCol = {
            field: "eta_varis",
            headerName: "ETA",
            width: 190,
            renderCell: (p) => fromISOToCombined(p.row.eta_varis || ""),
            sortComparator: (a, b) => new Date(a) - new Date(b),
        };
        const kalanCol = {
            field: "kalan_surus_dk",
            headerName: "Kalan (dk)",
            width: 120,
            align: "center",
            headerAlign: "center",
        };

        // “baz” kolonlar (ETA ve Kalan hariç)
        const baseCols = [
            {
                field: "reel_durum",
                headerName: "REEL DURUM",
                width: 150,
                renderCell: (p) => {
                    const raw = p.row.reel_durum || "-";
                    const v = raw === "EŞLEŞTİ" || raw === "GÜNCELLENDİ" ? "ESKİ" : raw;
                    const color = v === "YENİ" ? "info" : "default";
                    return <Chip label={v} size="small" color={color} sx={{ fontWeight: 700 }} />;
                },
            },
            { field: "nokta_sayisi", headerName: "NOKTA", width: 100, align: "center", headerAlign: "center" },
            txt("sefer_no", "Sefer No", 160),
            txt("statu", "Statü", 160),
            txt("plaka", "Plaka", 130),
            txt("musteri_adi", "Müşteri", 240),
            txt("proje_adi", "Proje", 240),
            {
                field: "sefer_tarihi",
                headerName: "Sefer Tarihi",
                width: 190,
                renderCell: (p) => fromISOToCombined(p.row.sefer_tarihi || ""),
                sortComparator: (a, b) => new Date(a) - new Date(b),
            },
            txt("atama_yapan_kullanici", "Atayan", 170),
            txt("arac_statu", "Araç Statü", 210),
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
            txt("irsaliye_no", "İrsaliye No", 170),
            {
                field: "kayit_zamani",
                headerName: "Kayıt Zamanı",
                width: 190,
                renderCell: (p) => fromISOToCombined(p.row.kayit_zamani || ""),
                sortComparator: (a, b) => new Date(a) - new Date(b),
            },
            {
                field: "atama_tarihi",
                headerName: "Atama Tarihi",
                width: 190,
                renderCell: (p) => fromISOToCombined(p.row.atama_tarihi || ""),
                sortComparator: (a, b) => new Date(a) - new Date(b),
            },
            // DİKKAT: ETA ve Kalan burada YOK; yeri aşağıda koşullu eklenecek
        ];

        const showActions = canEdit || canSeeETA;

        const actionsCol = {
            field: "actions",
            headerName: "İşlem",
            width: 160,
            sortable: false,
            filterable: false,
            renderCell: (p) => (
                <Stack direction="row" spacing={0.5}>
                    {canSeeETA && (
                        <Button size="small" variant="outlined" onClick={() => openETA(p.row)}>
                            ETA
                        </Button>
                    )}
                    {canEdit && (
                        <Tooltip title="Detayları Düzenle">
                            <IconButton size="small" onClick={() => openEditor(p.row)}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Stack>
            ),
        };

        // Hedef kullanıcı: buketcimenci
        const isBuket = normalizeUser(localStorage.getItem("kullaniciAdi")) === "BUKETCIMENCI";

        let cols = [...baseCols];

        if (showActions) {
            // “İşlem”i başa ekle
            cols = [actionsCol, ...cols];
        }

        if (isBuket && showActions) {
            // “REEL DURUM”dan hemen sonra ETA ve Kalan (dk) ekle
            const rdIdx = cols.findIndex((c) => c.field === "reel_durum");
            if (rdIdx !== -1) {
                cols = [
                    ...cols.slice(0, rdIdx + 1),
                    etaCol,
                    kalanCol,
                    ...cols.slice(rdIdx + 1),
                ];
            } else {
                // emniyet: bulunamazsa başa yakın ekleyelim
                cols = [cols[0], etaCol, kalanCol, ...cols.slice(1)];
            }
        } else {
            // Diğer kullanıcılar için mevcut davranış: ETA & Kalan sonda kalsın
            cols = [...cols, etaCol, kalanCol];
        }

        return cols;
    }, [openEditor, openETA, canEdit, canSeeETA]);

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
        const name = (localStorage.getItem("kullaniciAdi") || "").toUpperCase();
        return name === "ADMIN" || name === "SELİN";
    })();

    /* --------------- RENDER --------------- */
    return (
        <Box
            sx={{
                height: "100dvh",
                overflow: "hidden",                 // 👈 dış (body) scroll’u kapat
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
                <style>{`
    html, body { height: 100%; overflow: hidden; } /* tarayıcı scroll’u kapalı */
    #root { height: 100%; }
  `}</style>
            </Helmet>

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
                        onClick={() => navigate("/anasayfa")}
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
                p: 1.2,
                borderRadius: 2,
                display: "grid",
                gridTemplateColumns: "repeat(12, 1fr)",
                gap: 1,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
            }}>
                <TextField
                    label="Başlangıç"
                    type="date"
                    size="small"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                />
                <TextField
                    label="Bitiş"
                    type="date"
                    size="small"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                />
                <TextField
                    label="Sefer No Tipi"
                    select
                    size="small"
                    value={seferNoTipi}
                    onChange={(e) => setSeferNoTipi(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                >
                    <MenuItem value="">Tümü</MenuItem>
                    <MenuItem value="BOS">BOS…</MenuItem>
                    <MenuItem value="SFR">SFR…</MenuItem>
                </TextField>

                <TextField
                    label="Plaka"
                    select
                    size="small"
                    value={plaka}
                    onChange={(e) => setPlaka(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                >
                    <MenuItem value="">Tümü</MenuItem>
                    {options.plaka.map((v) => (
                        <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                </TextField>

                {/* >>> EKLENDİ: Sürücü filtresi */}
                <TextField
                    label="Sürücü"
                    select
                    size="small"
                    value={surucu}
                    onChange={(e) => setSurucu(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                >
                    <MenuItem value="">Tümü</MenuItem>
                    {options.surucu_ad_soyad.map((v) => (
                        <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                </TextField>
                {/* <<< EKLENDİ */}

                <TextField
                    label="Müşteri"
                    select
                    size="small"
                    value={musteri}
                    onChange={(e) => setMusteri(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                >
                    <MenuItem value="">Tümü</MenuItem>
                    {options.musteri_adi.map((v) => (
                        <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                </TextField>

                <TextField
                    label="Proje"
                    select
                    size="small"
                    value={proje}
                    onChange={(e) => setProje(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                >
                    <MenuItem value="">Tümü</MenuItem>
                    {options.proje_adi.map((v) => (
                        <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                </TextField>

                <TextField
                    label="Yükleme İl"
                    select
                    size="small"
                    value={yuklemeIl}
                    onChange={(e) => setYuklemeIl(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                >
                    <MenuItem value="">Tümü</MenuItem>
                    {options.yukleme_ili.map((v) => (
                        <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                </TextField>

                <TextField
                    label="Teslim İl"
                    select
                    size="small"
                    value={teslimIl}
                    onChange={(e) => setTeslimIl(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                >
                    <MenuItem value="">Tümü</MenuItem>
                    {options.teslim_ili.map((v) => (
                        <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                </TextField>

                <TextField
                    label="Araç Statü"
                    select
                    size="small"
                    value={aracStatu}
                    onChange={(e) => setAracStatu(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                >
                    <MenuItem value="">Tümü</MenuItem>
                    {options.arac_statu.map((v) => (
                        <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                </TextField>

                <TextField
                    label="Nokta"
                    type="number"
                    size="small"
                    value={noktaSayisi}
                    onChange={(e) => setNoktaSayisi(e.target.value)}
                    sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
                />

                <TextField
                    label="Ara (metin)"
                    size="small"
                    value={quick}
                    onChange={(e) => setQuick(e.target.value)}
                    placeholder="metin ara…"
                    sx={{ gridColumn: { xs: "span 12", md: "span 2" }, ...baseInputSX }}
                />
            </Paper>


            {/* Liste */}
            <Paper sx={{
                    borderRadius: 3,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    // tablo daha kısa görünsün:
                    height: { xs: 40, md: "70vh" },
                    overflow: "hidden",
                    }}>
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

                    {/* Satır ekle butonu ve ipucu */}
                    {canEdit && (
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Button startIcon={<AddIcon />} onClick={addDetailRow} color="info" variant="contained">
                                Satır Ekle
                            </Button>
                            <Typography variant="body2" sx={{ color: COLORS.textMuted }}>
                                Tarih ve saati tek alana yazın: <b>gg.aa.yyyy ss:dd</b> (ör: 13.05.2025 09:35)
                            </Typography>
                        </Stack>
                    )}

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
                                        action={canEdit && (
                                            <Stack direction="row" spacing={0.5}>
                                                <Tooltip title="Bu satırı kopyala">
                                                    <span>
                                                        <IconButton onClick={() => copyDetailRow(i)} size="small" color="info">
                                                            <ContentCopyIcon fontSize="inherit" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title="Satırı sil">
                                                    <span>
                                                        <IconButton onClick={() => removeDetailRow(i)} size="small" color="error">
                                                            <DeleteIcon fontSize="inherit" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </Stack>
                                        )}
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
                                                    value={r[key] ?? ""}
                                                    onChange={(e) => onDetailChange(i, key, e.target.value)}
                                                    InputLabelProps={{ shrink: true }}
                                                    sx={baseInputSX}
                                                />
                                            ))}

                                            <DateTimeOneField
                                                label="Yükleme Varış"
                                                value={r.yukleme_varis || ""}
                                                onChange={(val) => onDetailChange(i, "yukleme_varis", val)}
                                                sx={baseInputSX}
                                            />
                                            <DateTimeOneField
                                                label="Yükleme Çıkış"
                                                value={r.yukleme_cikis || ""}
                                                onChange={(val) => onDetailChange(i, "yukleme_cikis", val)}
                                                sx={baseInputSX}
                                            />
                                            <DateTimeOneField
                                                label="Teslim Varış"
                                                value={r.teslim_varis || ""}
                                                onChange={(val) => onDetailChange(i, "teslim_varis", val)}
                                                sx={baseInputSX}
                                            />
                                            <DateTimeOneField
                                                label="Teslim Çıkış"
                                                value={r.teslim_cikis || ""}
                                                onChange={(val) => onDetailChange(i, "teslim_cikis", val)}
                                                sx={baseInputSX}
                                            />
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </DialogContent>

                <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
                    <Button onClick={closeEditor} startIcon={<ArrowBackIosNewIcon />}>
                        Kapat
                    </Button>

                    {canEdit && (
                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="outlined"
                                color="secondary"
                                startIcon={<SaveIcon />}
                                onClick={async () => {
                                    try {
                                        setSaving(true);
                                        if (editSefer?.id && (seferTarihiYeni || "") !== (editSefer?.sefer_tarihi || "")) {
                                            const { error: upErr } = await supabase
                                                .from("seferler")
                                                .update({ sefer_tarihi: seferTarihiYeni || null })
                                                .eq("id", editSefer.id);
                                            if (upErr) throw upErr;
                                        }
                                        await saveDetails();
                                        setRows((prev) =>
                                            prev.map((r) =>
                                                r.id === editSefer?.id
                                                    ? { ...r, sefer_tarihi: seferTarihiYeni || r.sefer_tarihi }
                                                    : r
                                            )
                                        );
                                    } catch (e) {
                                        console.error(e);
                                        setSnack({
                                            open: true,
                                            msg: "Kaydetme sırasında hata oluştu.",
                                            severity: "error",
                                        });
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                Kaydet
                            </Button>

                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<FileDownloadDoneIcon />}
                                onClick={moveToCompleted}
                            >
                                Tamamlananlara Aktar
                            </Button>
                        </Stack>
                    )}
                </DialogActions>
            </Dialog>

            {/* ETA DİYALOGU */}
            <Dialog
                open={etaOpen}
                onClose={() => setEtaOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { backgroundColor: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}` } }}
            >
                <DialogTitle sx={{ fontWeight: 900 }}>
                    ETA Hesabı • {etaRow?.sefer_no || "-"} • {etaRow?.plaka || "-"} • {etaRow?.surucu_ad_soyad || "-"}
                </DialogTitle>

                <DialogContent dividers sx={{ backgroundColor: alpha("#fff", 0.01) }}>
                    <Stack spacing={1.2}>
                        <Card
                            variant="outlined"
                            sx={{
                                borderColor: COLORS.border,
                                background: COLORS.surface2,
                                borderRadius: 2,
                                mb: 1
                            }}
                        >
                            <CardContent sx={{ py: 1 }}>
                                {/* üstte küçük “çip” başlıklar */}
                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 0.5 }}>
                                    <Chip size="small" icon={<NumbersIcon />} label={etaRow?.sefer_no || "-"} />
                                    <Chip size="small" icon={<LocalShippingIcon />} label={vehicleText} />
                                </Stack>

                                {/* iki sütunlu sade bilgi listesi */}
                                <Grid container spacing={1}>
                                    <Grid item xs={12} md={6}>
                                        <Stack spacing={0.4}>
                                            <Typography variant="overline" sx={{ color: COLORS.textMuted, lineHeight: 1 }}>
                                                <PersonIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                                                Şoför
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{driverText}</Typography>
                                        </Stack>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <Stack spacing={0.4}>
                                            <Typography variant="overline" sx={{ color: COLORS.textMuted, lineHeight: 1 }}>
                                                <WorkOutlineIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                                                İş
                                            </Typography>
                                            <Typography variant="body2" title={jobText} sx={{ fontWeight: 700 }}>
                                                {jobText}
                                            </Typography>
                                        </Stack>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <Box
                                            sx={{
                                                p: 1,
                                                borderRadius: 1.5,
                                                border: `1px solid ${COLORS.border}`,
                                                background: COLORS.surface,
                                            }}
                                        >
                                            <Typography
                                                variant="overline"
                                                sx={{ color: COLORS.textMuted, display: "block" }}
                                            >
                                                <PlaceIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                                                YÜKLEME
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                title={originText}
                                                sx={{ fontWeight: 800, whiteSpace: "normal", wordBreak: "break-word" }}
                                            >
                                                {originText}
                                            </Typography>
                                        </Box>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <Box
                                            sx={{
                                                p: 1,
                                                borderRadius: 1.5,
                                                border: `1px solid ${COLORS.border}`,
                                                background: COLORS.surface,
                                            }}
                                        >
                                            <Typography
                                                variant="overline"
                                                sx={{ color: COLORS.textMuted, display: "block" }}
                                            >
                                                <FlagIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                                                TESLİM
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                title={destinationText}
                                                sx={{ fontWeight: 800, whiteSpace: "normal", wordBreak: "break-word" }}
                                            >
                                                {destinationText}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                {/* altta çok küçük notlar */}
                                <Stack spacing={0.2} sx={{ mt: 0.75 }}>
                                    <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                                        Not: ETA KGM kuralına göre hesaplanır (4,5s + 45dk + 4,5s + 45dk + 11s).
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                                        {etaDistanceInfo}
                                    </Typography>
                                    </Stack>
                                </Grid>
                            </CardContent>
                        </Card>


                        {/* >>> değişen kısım: etiket ve fallback */}
                        <DateTimeOneField
                            label="Başlangıç (Yükleme Çıkış / Şimdi)"
                            value={etaStartISO || latestYuklemeCikis || nowLocalISO()}
                            onChange={(val) => setEtaStartISO(val || latestYuklemeCikis || nowLocalISO())}
                            sx={baseInputSX}
                        />

                        <TimeHMField
                            label="Kalan Sürüş (ss.dd)"
                            value={driveHM}
                            onChange={(val) => setDriveHM(val)}
                            sx={baseInputSX}
                        />

                        <TextField
                            label="Başlangıçta mola"
                            select
                            size="small"
                            value={breakSel}
                            onChange={(e) => setBreakSel(Number(e.target.value))}
                            helperText="Seçilen mola başlangıca eklenir"
                            InputLabelProps={{ shrink: true }}
                            sx={baseInputSX}
                        >
                            {BREAK_OPTIONS.map(o => (
                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                            ))}
                        </TextField>

                        <Divider />

                        <Box
                            sx={{
                                p: 1.2,
                                borderRadius: 2,
                                border: `1px solid ${COLORS.border}`,
                                background: COLORS.surface2,
                            }}
                        >
                            {computedETAISO === "__NEED_DISTANCE__" ? (
                                <Typography variant="body1">
                                    ETA: <b>Bekleniyor</b> — Mesafe bulunamadı.
                                </Typography>
                            ) : computedETAISO === "__WAITING__" ? (
                                <Typography variant="body1">
                                    ETA: <b>Bekleniyor</b> — “Yükleme Çıkış” bilgisi girilmemiş.
                                </Typography>
                            ) : (
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Typography variant="body1">
                                                ETA: <b>{fromISOToCombined(computedETAISO) || "-"}</b>
                                            </Typography>
                                            <Tooltip title="ETA'yı kopyala">
                                                <span>
                                                    <IconButton size="small" onClick={copyETA}>
                                                        <ContentCopyIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </Stack>
                            )}
                        </Box>
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ px: 2.5, py: 1.2 }}>
                    <Stack direction="row" spacing={1}>
                        <Button onClick={() => setEtaOpen(false)}>Kapat</Button>
                        <Button
                            variant="contained"
                            color="success"
                            onClick={saveETA}
                        >
                            Kaydet
                        </Button>
                    </Stack>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
