// src/kullanıcıIslemleri/ReelAtananSeferler.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../supabaseClient";

/* MUI */
import {
    Box, Paper, Stack, Button, Typography, TextField, MenuItem, Snackbar, Alert,
    Backdrop, CircularProgress, Chip, alpha, Dialog, DialogTitle, DialogContent,
    DialogActions, IconButton, Tooltip, Divider, Switch, FormControlLabel, Grid,
    Card, CardContent, CardHeader,
} from "@mui/material";
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

/* ---------------- helpers ---------------- */
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
// Senkronizasyon sırasında hariç tutulacak plakalar
const EXCLUDED_PLAKAS = new Set([
    "34NHF579", "34NHF636", "34NHF705", "34NHF757",
    "34NHF811", "34NHF868", "34NHF916", "34NHF964", "34NHG120",
]);

// Plakayı normalize et (boşluk/çizgi sil, büyük harf)
const normalizePlate = (s) => (s ?? "").toString().toUpperCase().replace(/[\s-]/g, "");


const splitCell = (v) =>
    (v ?? "").toString().split(";").map((x) => x.trim()).filter((x) => x !== "");

const joinCell = (arr) => (arr || []).map((x) => (x ?? "").trim()).filter(Boolean).join("; ");

const clean = (v) => {
    const t = (v ?? "").toString().trim();
    if (!t || t === "-" || t === "---") return null;
    return t;
};

const detailFields = [
    "proje_adi", "yukleme_noktasi", "yukleme_ili", "yukleme_ilcesi",
    "teslim_noktasi", "teslim_ili", "teslim_ilcesi",
    "yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis",
];

/** detaylardan araç statüsü üret */
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

/* --------- yüksek-kontrast renkler --------- */
const COLORS = {
    pageBg: "#0F172A",
    surface: "#111827",
    surface2: "#1F2937",
    border: "rgba(148,163,184,0.25)",
    text: "#E5E7EB",
    textMuted: "#C7D2FE",
    zebra: "rgba(148,163,184,0.06)",
};

/* ========= Tarih + Saat (maskeli) ========= */
/** "13052025" -> "13.05.2025" */
const fmtDateDigits = (digits) => {
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    let s = d;
    if (digits.length > 2) s += "." + m;
    if (digits.length > 4) s += "." + y;
    return s;
};
/** "1234" -> "12:34" */
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
    const d = iso.slice(0, 10); // yyyy-mm-dd
    const t = iso.slice(11, 16);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { d: "", t: "" };
    const [y, m, dd] = d.split("-");
    return { d: `${dd}.${m}.${y}`, t };
};

/** Maskeli tarih + saat; tarih tamamlanınca saate odaklanır */
function DateTimeCell({ label, value, onChange, sx }) {
    const [dateText, setDateText] = useState("");
    const [timeText, setTimeText] = useState("");
    const timeRef = useRef(null);

    useEffect(() => {
        const { d, t } = fromISO(value || "");
        setDateText(d);
        setTimeText(t);
    }, [value]);

    const emit = (d, t) => onChange(toISO(d, t));

    const onDateChange = (e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
        const formatted = fmtDateDigits(digits);
        setDateText(formatted);
        if (formatted.length === 10) {
            // dd.MM.yyyy tamamlandıktan SONRA saate geç
            setTimeout(() => timeRef.current?.focus(), 0);
        }
        emit(formatted, timeText);
    };

    const onTimeChange = (e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
        const formatted = fmtTimeDigits(digits);
        setTimeText(formatted);
        emit(dateText, formatted);
    };

    return (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 0.8fr", gap: 0.75 }}>
            <TextField
                label={label}
                placeholder="gg.aa.yyyy"
                value={dateText}
                onChange={onDateChange}
                size="small"
                inputProps={{ inputMode: "numeric", maxLength: 10 }}
                InputLabelProps={{ shrink: true }}
                sx={sx}
            />
            <TextField
                label="Saat"
                placeholder="--:--"
                value={timeText}
                onChange={onTimeChange}
                size="small"
                inputRef={timeRef}
                inputProps={{ inputMode: "numeric", maxLength: 5 }}
                InputLabelProps={{ shrink: true }}
                sx={sx}
            />
        </Box>
    );
}

export default function ReelAtananSeferler() {
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
            // Bu aralık, tamamlananları da süzmek için kullanılacak
            const rangeMin = (startDate || daysAgoISO(6)) + "T00:00:00";
            const rangeMax = (endDate || todayISO()) + "T23:59:59";
            const { data, error } = await supabase
                .from("seferler")
                .select("*")
                .gte("sefer_tarihi", rangeMin)
                .lte("sefer_tarihi", rangeMax)
                .order("sefer_tarihi", { ascending: false });
            if (error) throw error;

            // Aynı aralıkta tamamlanan sefer_no'ları çek
            const { data: tamamlananNos } = await supabase
                .from("tamamlanan_seferler")
                .select("sefer_no")
                .gte("sefer_tarihi", rangeMin)
                .lte("sefer_tarihi", rangeMax)

            const COMPLETED_NOS = new Set((tamamlananNos || []).map(x => (x.sefer_no ?? "").trim()));

            // Ekrana hiç getirme
            const onlyActive = (data || []).filter(
                s => !COMPLETED_NOS.has((s.sefer_no ?? "").toString().trim())
            );

            const enriched = onlyActive.map((s, idx) => {
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
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    /* senkronize */
    const syncData = useCallback(async () => {
        setLoading(true);
        try {
            const start = (startDate || daysAgoISO(6)) + "T00:00:00";
            const end = (endDate || todayISO()) + "T23:59:59";
            const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
            // Bu aralık, tamamlananları da süzmek için kullanılacak
            const min = (startDate || daysAgoISO(6)) + "T00:00:00";
            const max = (endDate || todayISO()) + "T23:59:59";

            const res = await fetch(`${API_BASE_URL}/api/proxy/tmsdespatches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startDate: start, endDate: end, userId: 1 }),
            });
            if (!res.ok) throw new Error(`API Hatası: ${res.status} ${res.statusText}`);
            const json = await res.json();

            if (!json || !Array.isArray(json.Data)) {
                setSnack({ open: true, msg: "API veri yok.", severity: "warning" });
                return;
            }

            // Bu aralıkta daha önce tamamlanan sefer_no'ları çek
            const { data: tamamlananNos } = await supabase
                .from("tamamlanan_seferler")
                .select("sefer_no")
                .gte("sefer_tarihi", min)
                .lte("sefer_tarihi", max)
            const COMPLETED_NOS = new Set((tamamlananNos || []).map(x => (x.sefer_no ?? "").trim()));

            const gelen = json.Data.filter((x) => x && typeof x === "object");
            const filtreli = gelen
                .filter((item) => {
                    const tip = (item?.VehicleWorkingTypeName || "").toString().trim().toUpperCase();
                    return tip === "FİLO" || tip === "ÖZMAL";
                })
                .filter((item) => !EXCLUDED_PLAKAS.has(normalizePlate(item?.PlateNumber)))
                // TMS DocumentNo (sefer_no) tamamlananlarda varsa dahil etme
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

            const { data: mevcut } = await supabase
                .from("seferler")
                .select("*")
                .gte("sefer_tarihi", min)
                .lte("sefer_tarihi", max);

            const mapDb = new Map((mevcut || []).map((r) => [r.sefer_no?.trim(), r]));
            const seenNew = [];
            const upsert = [];

            for (const item of temiz) {
                const eski = mapDb.get(item.sefer_no?.trim());
                if (!eski) {
                    const yeni = { ...item, reel_durum: "YENİ" };
                    seenNew.push(yeni);
                    upsert.push(yeni);
                } else {
                    const changed = Object.keys(item).some((k) => (item[k] ?? null) !== (eski[k] ?? null));
                    const merged = changed ? { ...item } : { ...eski }; // değiştiyse taze değerleri yaz
                    const eskiKayit = { ...merged, reel_durum: "ESKİ" };
                    seenNew.push(eskiKayit);
                    upsert.push(eskiKayit);
                }
            }

            const payload = [...upsert]; // EŞLEŞME YOK eklenmez
            if (payload.length) {
                await supabase.from("seferler").upsert(payload, { onConflict: ["sefer_no"] });
            }

            setSuccessCount(upsert.length);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3500);

            const enriched = [...seenNew].map((s, idx) => {
                const maxLen = Math.max(0, ...detailFields.map((k) => splitCell(s[k]).length));
                return {
                    ...s,
                    _rid: s.id ?? s.sefer_no ?? `tmp-${Date.now()}-${idx}`,
                    nokta_sayisi: maxLen || 0,
                };
            });

            setRows(enriched);
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Senkronizasyon hatası.", severity: "error" });
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    /* mount */
    useEffect(() => {
        listData();
    }, [listData]);


    /* filtrelenmiş */
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
            r = r.filter((x) =>
                Object.values(x).some((v) => String(v ?? "").toLowerCase().includes(q))
            );
        }
        return r;
    }, [rows, seferNoTipi, plaka, musteri, proje, yuklemeIl, teslimIl, aracStatu, noktaSayisi, quick]);

    /* SFR sayacı */
    const sfrCount = useMemo(
        () =>
            filtered.reduce(
                (n, x) => n + ((x.sefer_no || "").toUpperCase().startsWith("SFR") ? 1 : 0),
                0
            ),
        [filtered]
    );

    /* list grid columns */
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
                            <IconButton size="small" color="success" onClick={() => openEditor(p.row, true)}>
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
                    const v = (raw === "EŞLEŞTİ" || raw === "GÜNCELLENDİ") ? "ESKİ" : raw;
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
            txt("sefer_tarihi", "Sefer Tarihi", 190),
            txt("atama_yapan_kullanici", "Atayan", 170),
            txt("arac_statu", "Araç Statü", 210),
            txt("yukleme_ili", "Yükleme İl", 160),
            txt("teslim_ili", "Teslim İl", 160),
            txt("treyler", "Treyler", 160),
            txt("surucu_ad_soyad", "Sürücü", 200),
            txt("surucu_tckn", "TC", 150),
            txt("surucu_telefon", "Telefon", 170),
            txt("musteri_siparis_no", "Sipariş No", 190),
            txt("hizmet_adi", "Hizmet", 190),
            txt("yukleme_noktasi", "Yükleme Noktası", 280),
            txt("teslim_noktasi", "Teslim Noktası", 280),
            txt("irsaliye_no", "İrsaliye No", 170),
            txt("kayit_zamani", "Kayıt Zamanı", 190),
            txt("atama_tarihi", "Atama Tarihi", 190),
        ];
    }, []);

    /* editor aç */
    const openEditor = async (row, aktarModu = false) => {
        setEditSefer(row);
        setEditOpen(true);

        // 1) id yoksa sefer_no ile çöz
        let id = row?.id ?? null;
        if (!id && row?.sefer_no) {
            const { data: s } = await supabase
                .from("seferler")
                .select("id")
                .eq("sefer_no", row.sefer_no)
                .maybeSingle();
            id = s?.id ?? null;
        }

        // 2) Önce detay tablosunu dene
        let detay = [];
        if (id) {
            const { data } = await supabase
                .from("sefer_detaylari")
                .select("*")
                .eq("sefer_id", id)
                .order("nokta_sirasi", { ascending: true });
            detay = data || [];
        }

        // 3) Detay bulunamadıysa, seferler tablosundaki alanlardan satır türet
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

        // 4) Formu doldur
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

        if (aktarModu) {
            setSnack({
                open: true,
                msg: "Detayları kontrol edip 'Tamamlananlara Aktar' ile işlemi bitirin.",
                severity: "info",
            });
        }
    };


    const closeEditor = () => {
        setEditOpen(false);
        setEditSefer(null);
        setDetailRows([]);
    };

    const addDetailRow = () => {
        setDetailRows((prev) => [...prev, {
            sefer_id: editSefer.id, nokta_sirasi: prev.length,
            proje_adi: "", yukleme_noktasi: "", yukleme_ili: "", yukleme_ilcesi: "",
            teslim_noktasi: "", teslim_ili: "", teslim_ilcesi: "",
            yukleme_varis: "", yukleme_cikis: "", teslim_varis: "", teslim_cikis: "",
        }]);
    };

    const copyDetailRow = (idx) => {
        const r = detailRows[idx];
        const c = { ...r, nokta_sirasi: detailRows.length };
        setDetailRows((prev) => [...prev, c]);
    };

    const removeDetailRow = (idx) => {
        setDetailRows((prev) => {
            const arr = prev.filter((_, i) => i !== idx);
            return arr.map((x, i) => ({ ...x, nokta_sirasi: i }));
        });
    };

    const onDetailChange = (idx, key, value) => {
        setDetailRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
    };

    const saveDetails = async () => {
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

            const { error } = await supabase
                .from("sefer_detaylari")
                .upsert(upserts, { onConflict: ["sefer_id", "nokta_sirasi"] });
            if (error) throw error;

            const joined = Object.fromEntries(
                detailFields.map((k) => [k, joinCell(detailRows.map((x) => x[k] || ""))])
            );
            const yeniAracStatu = computeAracStatu(detailRows);
            await supabase
                .from("seferler")
                .update({ ...joined, arac_statu: yeniAracStatu, nokta_sayisi: detailRows.length })
                .eq("id", editSefer.id);

            setRows((prev) =>
                prev.map((r) =>
                    r.id === editSefer.id
                        ? { ...r, ...joined, arac_statu: yeniAracStatu, nokta_sayisi: detailRows.length }
                        : r
                )
            );

            setSnack({ open: true, msg: "Detaylar kaydedildi.", severity: "success" });
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Kaydetme hatası.", severity: "error" });
        } finally {
            setSaving(false);
        }
    };

    const moveToCompleted = async () => {
        if (!editSefer) return;
        if (!window.confirm("Bu sefer tamamlananlara aktarılacak. Devam edilsin mi?")) return;
        setSaving(true);
        try {
            const seferAna = rows.find((r) => r.id === editSefer.id) || editSefer;
            const anaPayload = {
                arac_statu: seferAna.arac_statu ?? null,
                sefer_tarihi: seferAna.sefer_tarihi ?? null,
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
                .upsert(anaPayload, { onConflict: ["sefer_no"] });
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
                    .upsert(detPayload, { onConflict: ["sefer_no", "nokta_sirasi"] });
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
    };

    const canSync = (() => {
        const name = (localStorage.getItem("kullaniciAdi") || "").toUpperCase();
        return name === "ADMIN" || name === "SELİN";
    })();

    /* --------------- render --------------- */
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
            {/* Başlık + aksiyonlar */}
            <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
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
                        Net, okunabilir ve hızlı veri girişi için optimize edildi
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <FormControlLabel
                        control={<Switch checked={dense} onChange={() => setDense(v => !v)} size="small" />}
                        label="Sıkı satırlar"
                        sx={{ color: COLORS.textMuted }}
                    />

                    {/* SFR sayacı */}
                    <Chip
                        label={`SFR: ${sfrCount}`}
                        size="small"
                        color="info"
                        sx={{ fontWeight: 800 }}
                    />

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
            <Dialog open={editOpen} onClose={closeEditor} fullWidth maxWidth="xl"
                PaperProps={{ sx: { backgroundColor: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}` } }}>
                <DialogTitle sx={{ fontWeight: 900 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {editSefer?.sefer_no || "-"} • {editSefer?.plaka || "-"} • {editSefer?.musteri_adi || "-"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
                        {computeAracStatu(detailRows) || "—"}
                    </Typography>
                </DialogTitle>

                <DialogContent dividers sx={{ backgroundColor: alpha("#fff", 0.01) }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Button startIcon={<AddIcon />} onClick={addDetailRow} color="info" variant="contained">Satır Ekle</Button>
                        <Typography variant="body2" sx={{ color: COLORS.textMuted }}>
                            Tarihi **gg.aa.yyyy** olarak yaz; tamamlandığında saat alanına otomatik geçer.
                        </Typography>
                    </Stack>

                    <Grid container spacing={1.2}>
                        {detailRows.map((r, i) => (
                            <Grid item xs={12} key={i}>
                                <Card variant="outlined" sx={{ borderColor: COLORS.border, background: COLORS.surface2, borderRadius: 2 }}>
                                    <CardHeader
                                        sx={{
                                            "& .MuiCardHeader-title": { fontWeight: 800, fontSize: 16 },
                                            "& .MuiCardHeader-subheader": { color: COLORS.textMuted }, pb: 0.5,
                                        }}
                                        title={`${i + 1}. Nokta`}
                                        subheader={r.yukleme_ili || r.teslim_ili ? `${r.yukleme_ili ?? ""} → ${r.teslim_ili ?? ""}` : ""}
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
                                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1 }}>
                                            {[
                                                ["proje_adi", "Proje Adı"],
                                                ["yukleme_noktasi", "Yükleme Noktası"],
                                                ["yukleme_ili", "Yükleme İl"],
                                                ["yukleme_ilcesi", "Yükleme İlçe"],
                                                ["teslim_noktasi", "Teslim Noktası"],
                                                ["teslim_ili", "Teslim İl"],
                                                ["teslim_ilcesi", "Teslim İlçe"],
                                            ].map(([key, label]) => (
                                                <TextField key={key} label={label} size="small" value={r[key]}
                                                    onChange={(e) => onDetailChange(i, key, e.target.value)} sx={baseInputSX} />
                                            ))}

                                            {[
                                                ["yukleme_varis", "Yükleme Varış"],
                                                ["yukleme_cikis", "Yükleme Çıkış"],
                                                ["teslim_varis", "Teslim Varış"],
                                                ["teslim_cikis", "Teslim Çıkış"],
                                            ].map(([key, label]) => (
                                                <DateTimeCell
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
                                <Paper variant="outlined" sx={{ p: 2, textAlign: "center", color: COLORS.textMuted, borderColor: COLORS.border, background: COLORS.surface2 }}>
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
