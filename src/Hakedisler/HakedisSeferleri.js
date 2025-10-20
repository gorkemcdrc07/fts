// src/Hakedisler/HakedisSeferleri.js
import React, { useCallback, useRef, useState, useEffect } from "react";
// import "./HakedisSeferleri.css"; // 👈 CSS dosyasını artık kullanmıyoruz
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

// MUI ve Iconlar
import {
    Box,
    Container,
    Paper,
    Typography,
    Button,
    Stack,
    LinearProgress,
    CircularProgress,
    Chip,
    Divider,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
} from "@mui/material";
import {
    HomeOutlined as HomeIcon,
    ArrowBackIosNew as ArrowBackIcon,
    FilePresent as FilePresentIcon,
    Download as DownloadIcon,
    CloudUpload as CloudUploadIcon,
    Calculate as CalculateIcon,
    Send as SendIcon,
    DeleteForever as DeleteForeverIcon,
} from "@mui/icons-material";

// XLSX importları (kodun orjinal haliyle korunur)
import * as XLSX from "xlsx";


/** Ekran anahtarı & izin anahtarı */
const SCREEN_KEY = "hakedis_seferleri";
const UPLOAD_COL = "hks_upload"; // dosya ekleme izni için DOĞRU kolon

/** Kullanıcı şablon başlıkları (Excel) */
const HOME_PATH = "/anasayfa";

const TEMPLATE_HEADERS = [
    "Sefer Tarihi",
    "Sefer No",
    "TMSDespatchId",
    "Plaka",
    "Toplam KM",
    "Açıklama",
];

/** Tabloda istenen SIRALI başlıklar */
const DISPLAY_HEADERS = [
    "Sefer Tarihi",
    "Sefer No",
    "TMSDespatchId",
    "Plaka",
    "Toplam KM",
    "Açıklama",
    "Cari ID",
    "Cari Firma",
    "Aylık Kira",
    "Aylık sürücü",
    "Hak Ediş Kira",
    "Hak Ediş Sürücü",
    "Sefer Kira Maliyeti",
    "Sefer Sürücü Maliyeti",
    "Çalışma Günü",
];

// TMS URL sabitleri (korunur)
const IS_PROD = process.env.NODE_ENV === "production";
const PROXY_BASE = IS_PROD ? "/api" : "/reel-api";
const TMS_LOGIN_URL = `${PROXY_BASE}${IS_PROD ? "/reel-auth/login" : "/api/auth/login"}`;
const TMS_ADD_EXPENSE_URL = `${PROXY_BASE}${IS_PROD ? "/tmsdespatchincomeexpenses/addexpense" : "/api/tmsdespatchincomeexpenses/addexpense"}`;


/** Yardımcılar (Korunur) */
const normalize = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const toNumber = (v) => { /* ... (fonksiyon içeriği korunur) ... */
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = String(v).trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};
const toApiDecimal2 = (v, digits = 2) => { /* ... (fonksiyon içeriği korunur) ... */
    const n = toNumber(v);
    if (n === null) return { number: 0, cents: 0, string: (0).toFixed(digits) };
    const factor = 10 ** digits;
    const cents = Math.round(n * factor);
    const fixed = (cents / factor).toFixed(digits);
    return { number: Number(fixed), cents, string: fixed };
};
const toApiDecimal = (v, digits = 2) => { /* ... (fonksiyon içeriği korunur) ... */
    const n = toNumber(v);
    const z = Number((0).toFixed(digits));
    if (n === null) return { number: z, scaled: 0, string: (0).toFixed(digits) };
    const factor = 10 ** digits;
    const scaled = Math.round(n * factor);
    const fixed = (scaled / factor).toFixed(digits);
    return { number: Number(fixed), scaled, string: fixed };
};
const toPlainDigits = (v) => { /* ... (fonksiyon içeriği korunur) ... */
    if (v === null || v === undefined) return "";
    return String(v).trim().replace(/[.,\s]/g, "");
};
const fmtKm = (v) => /* ... (fonksiyon içeriği korunur) ... */
    v === null || v === undefined || v === ""
        ? "—"
        : typeof v === "number"
            ? v.toLocaleString("tr-TR")
            : String(v);
const fmtTRY = (v) => /* ... (fonksiyon içeriği korunur) ... */
    v === null || v === undefined || v === ""
        ? "—"
        : new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
        }).format(Number(v));
const fmtDateTR = (d) => { /* ... (fonksiyon içeriği korunur) ... */
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("tr-TR");
};
const toISODate = (d) => { /* ... (fonksiyon içeriği korunur) ... */
    if (!d) return null;
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
};
const roundN = (x, n = 4) => { /* ... (fonksiyon içeriği korunur) ... */
    if (x === null || x === undefined || x === "") return null;
    const num = Number(x);
    if (!Number.isFinite(num)) return null;
    const f = 10 ** n;
    return Math.round(num * f) / f;
};

/* ---------------------- TOKEN ÖNBELLEK / YENİLEME (Korunur) ---------------------- */
let tokenCache = { value: "", obtainedAt: 0 };
const TOKEN_MAX_AGE_MS = 4 * 60 * 1000;
async function loginToTMSWithLocalReelCreds() { /* ... (fonksiyon içeriği korunur) ... */
    const userName = (localStorage.getItem("Reel-kullanici") || "").trim();
    const password = localStorage.getItem("Reel-sifre") || "";
    if (!userName || !password) {
        throw new Error("Reel-kullanici / Reel-sifre localStorage’da bulunamadı.");
    }

    const res = await fetch(TMS_LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName, password }),
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`TMS login başarısız: ${res.status} ${txt}`);
    }
    const j = await res.json().catch(() => ({}));
    let token =
        j.token || j.access_token || j.accessToken || j?.data?.token || j?.result?.token || j?.jwt;

    if (!token || typeof token !== "string") {
        throw new Error("TMS login yanıtında token bulunamadı.");
    }

    token = token.trim();
    if (token.toLowerCase().startsWith("bearer ")) {
        token = token.slice(7).trim();
    }
    return token;
}
async function fetchFreshToken() { /* ... (fonksiyon içeriği korunur) ... */
    const t = await loginToTMSWithLocalReelCreds();
    tokenCache = { value: t, obtainedAt: Date.now() };
    return t;
}
async function ensureValidToken() { /* ... (fonksiyon içeriği korunur) ... */
    const age = Date.now() - tokenCache.obtainedAt;
    if (!tokenCache.value || age > TOKEN_MAX_AGE_MS) {
        return await fetchFreshToken();
    }
    return tokenCache.value;
}

/* ---------------------- NETWORK DAYANIKLILIK ARAÇLARI (Korunur) ---------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchWithTimeout(url, opts = {}, timeoutMs = 30000) { /* ... (fonksiyon içeriği korunur) ... */
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...opts, signal: ctl.signal });
        return res;
    } finally {
        clearTimeout(id);
    }
}
async function resilientPost(url, body, { maxRetries = 3, baseDelay = 200 } = {}) { /* ... (fonksiyon içeriği korunur) ... */
    let attempt = 0;
    let lastErr;
    while (attempt <= maxRetries) {
        try {
            const tkn = await ensureValidToken();
            let res = await fetchWithTimeout(
                url,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tkn}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),
                },
                30000
            );

            if (res.status === 401) {
                const fresh = await fetchFreshToken();
                res = await fetchWithTimeout(
                    url,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${fresh}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(body),
                    },
                    30000
                );
            }

            if (!res.ok) {
                if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
                    const text = await res.text().catch(() => "");
                    lastErr = new Error(`${res.status} ${text}`);
                } else {
                    const text = await res.text().catch(() => "");
                    throw new Error(`${res.status} ${text}`);
                }
            } else {
                return;
            }
        } catch (e) {
            lastErr = e;
        }

        attempt += 1;
        if (attempt > maxRetries) break;
        const jitter = Math.random() * 100;
        const delay = baseDelay * 2 ** (attempt - 1) + jitter;
        await sleep(delay);
    }
    throw lastErr || new Error("Bilinmeyen hata");
}
async function runWithConcurrencyLimit(jobs, limit, onProgress) { /* ... (fonksiyon içeriği korunur) ... */
    let idx = 0;
    let done = 0;
    const errors = [];

    async function worker() {
        while (true) {
            const i = idx++;
            if (i >= jobs.length) break;
            try {
                await jobs[i]();
            } catch (e) {
                errors[i] = e;
            } finally {
                done++;
                onProgress?.(done, jobs.length);
            }
        }
    }

    const workers = Array.from({ length: Math.min(limit, jobs.length) }, () => worker());
    await Promise.all(workers);
    return { errors };
}

/* ---------------------- YETKİLER (Korunur) ---------------------- */
function coalesceOverride(overrideVal, roleVal) {
    return overrideVal === true || overrideVal === false ? overrideVal : !!roleVal;
}
const looksLikeUUID = (s) =>
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
async function loadUploadPermission(kullanici) { /* ... (fonksiyon içeriği korunur) ... */
    const { data: userRow, error: eU } = await supabase.from("login").select("id, kullanici, rol").eq("kullanici", kullanici).maybeSingle();
    if (eU) throw eU;

    if (!userRow) return { canUpload: false };

    let roleId = null;
    if (userRow.rol) {
        if (looksLikeUUID(userRow.rol)) {
            roleId = userRow.rol;
        } else {
            const roleKey = String(userRow.rol).toUpperCase();
            const { data: roleRow, error: eR } = await supabase.from("roles").select("id,key").eq("key", roleKey).maybeSingle();
            if (eR) throw eR;
            roleId = roleRow?.id || null;
        }
    }

    let rolePerm = {};
    if (roleId) {
        const { data: rp, error: eRP } = await supabase
            .from("role_permissions")
            .select("*")
            .eq("screen_key", SCREEN_KEY)
            .eq("role_id", roleId)
            .maybeSingle();
        if (eRP) throw eRP;
        rolePerm = rp || {};
    }

    const { data: up, error: eUP } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", userRow.id)
        .maybeSingle();
    if (eUP) throw eUP;
    const canUpload = coalesceOverride(up?.[UPLOAD_COL], rolePerm?.[UPLOAD_COL]);
    return { canUpload: !!canUpload };
}

/* ---------------------- ANA BİLEŞEN ---------------------- */
export default function HakedisSeferleri({ onFileReady }) {
    const [dragActive, setDragActive] = useState(false);
    const [fileError, setFileError] = useState("");
    const [file, setFile] = useState(null);
    const [rows, setRows] = useState([]);
    const [parsing, setParsing] = useState(false);
    const [summary, setSummary] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [exportMsg, setExportMsg] = useState("");
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const [permLoading, setPermLoading] = useState(true);
    const [perms, setPerms] = useState({ canUpload: false });

    const inputRef = useRef(null);
    const navigate = useNavigate();

    const ACCEPT = [".csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].join(",");

    // YETKİYİ YÜKLE (Korunur)
    useEffect(() => {
        (async () => {
            try {
                setPermLoading(true);
                const kullanici = localStorage.getItem("kullanici") || "";
                const p = await loadUploadPermission(kullanici);
                setPerms(p);
            } catch (e) {
                console.error("perm load error:", e);
                setPerms({ canUpload: false });
            } finally {
                setPermLoading(false);
            }
        })();
    }, []);

    const resetState = () => {
        setFile(null);
        setFileError("");
        setRows([]);
        setSummary(null);
        setExportMsg("");
    };

    // Excel (.xlsx) şablon indir (Korunur)
    const handleDownloadTemplate = async () => {
        const mod = XLSX;
        const aoa = [TEMPLATE_HEADERS];
        const ws = mod.utils.aoa_to_sheet(aoa);
        ws["!autofilter"] = { ref: "A1:F1" };
        ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
        const wb = mod.utils.book_new();
        mod.utils.book_append_sheet(wb, ws, "Sefer Şablon");
        const wbout = mod.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "hakedis_seferleri_sablon.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const validateFile = (f) => {
        if (!f) return "Geçersiz dosya.";
        const isCsv = f.name.toLowerCase().endsWith(".csv");
        const isXlsx = f.name.toLowerCase().endsWith(".xlsx");
        const isXls = f.name.toLowerCase().endsWith(".xls");
        if (!(isCsv || isXlsx || isXls))
            return "Sadece CSV veya Excel dosyaları yükleyebilirsiniz (.csv, .xlsx, .xls).";
        const MAX = 20 * 1024 * 1024;
        if (f.size > MAX) return "Dosya boyutu 20MB'ı aşmamalı.";
        return "";
    };

    // Dosya İşleme (Korunur)
    const handleFiles = useCallback((files) => {
        if (!perms.canUpload) {
            setFile(null);
            setFileError("Dosya yükleme yetkiniz yok.");
            return;
        }
        const f = files?.[0];
        const err = validateFile(f);
        if (err) {
            setFile(null);
            setFileError(err);
            return;
        }
        setFileError("");
        setFile(f);
        setRows([]);
        setSummary(null);
        setExportMsg("");
    }, [perms.canUpload]);

    // Drag & Drop İşlemleri (MUI stillerine uyum için güncellenir)
    const onDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!perms.canUpload) return;
        setDragActive(true);
    };
    const onDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const onDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };
    const onDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (!perms.canUpload) return;
        const dt = e.dataTransfer;
        if (dt?.files?.length) handleFiles(dt.files);
    };
    const openFileDialog = () => {
        if (!perms.canUpload) return;
        inputRef.current?.click();
    };
    const onInputChange = (e) => handleFiles(e.target.files);

    // Supabase: plakalara göre toplu çek (Korunur)
    const fetchSupabaseByPlates = async (plates) => { /* ... (fonksiyon içeriği korunur) ... */
        if (!supabase)
            throw new Error(
                "Supabase ayarları eksik. .env’i kontrol edin ve dev server’ı yeniden başlatın."
            );
        if (!plates.length) return new Map();

        const set = new Set();
        plates.forEach((p) => {
            if (!p) return;
            const t = String(p).trim();
            set.add(t);
            set.add(t.toUpperCase());
        });
        const all = Array.from(set);

        const chunkSize = 100;
        const map = new Map();
        for (let i = 0; i < all.length; i += chunkSize) {
            const chunk = all.slice(i, i + chunkSize);
            const { data, error } = await supabase
                .from("arac_cari_ve_fiyat")
                .select("plaka,cari_id,cari_adi,aylik_kira,aylik_surucu,calisma_gunu")
                .in("plaka", chunk);

            if (error) throw error;
            (data || []).forEach((d) => {
                const key = normalize(d.plaka);
                if (!map.has(key)) map.set(key, d);
            });
        }
        return map;
    };

    // Dosyayı oku -> Supabase ile eşleştir -> türet -> tabloya yaz (Korunur)
    const parseSelectedFile = async () => { /* ... (fonksiyon içeriği korunur) ... */
        if (!file) {
            setFileError("Önce bir dosya seçiniz.");
            return;
        }
        setParsing(true);
        setFileError("");

        try {
            const mod = XLSX;
            const isCsv = file.name.toLowerCase().endsWith(".csv");

            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error("Dosya okunamadı"));
                if (isCsv) reader.readAsText(file, "utf-8");
                else reader.readAsArrayBuffer(file);
            });

            const wb = isCsv ? mod.read(data, { type: "string" }) : mod.read(data, { type: "array" });
            const sheetName = wb.SheetNames?.[0];
            if (!sheetName) throw new Error("Çalışma sayfası bulunamadı.");
            const sheet = wb.Sheets[sheetName];

            const aoa = mod.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            if (!aoa.length) {
                setRows([]);
                return;
            }
            const headerRow = (aoa[0] || []).map((c) => String(c).trim());

            const missing = TEMPLATE_HEADERS.filter(
                (h) => !headerRow.some((x) => normalize(x) === normalize(h))
            );
            if (missing.length) throw new Error(`Eksik sütun(lar): ${missing.join(", ")}`);

            const idx = TEMPLATE_HEADERS.map((h) =>
                headerRow.findIndex((x) => normalize(x) === normalize(h))
            );

            const excelSerialToDate = (n) => {
                try {
                    const d = (mod.SSF)?.parse_date_code?.(Number(n));
                    if (!d) return null;
                    return new Date(
                        Date.UTC(d.y, (d.m || 1) - 1, d.d || 1, d.H || 0, d.M || 0, d.S || 0)
                    );
                } catch {
                    return null;
                }
            };
            const parseDateCell = (v) => {
                if (v === null || v === undefined || v === "") return null;
                if (typeof v === "number") {
                    const dt = excelSerialToDate(v);
                    return dt || null;
                }
                const s = String(v).trim();
                if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
                    const dt = new Date(s);
                    return Number.isNaN(dt.getTime()) ? null : dt;
                }
                const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
                if (m) {
                    const d = Number(m[1]),
                        mo = Number(m[2]),
                        y = Number(m[3]);
                    const dt = new Date(y, mo - 1, d);
                    return Number.isNaN(dt.getTime()) ? null : dt;
                }
                const dt = new Date(s);
                return Number.isNaN(dt.getTime()) ? null : dt;
            };

            const baseRows = [];
            for (let i = 1; i < aoa.length; i++) {
                const r = aoa[i] || [];
                if (r.every((c) => String(c ?? "").trim() === "")) continue;
                const obj = {};
                TEMPLATE_HEADERS.forEach((h, j) => {
                    const k = idx[j];
                    let val = k >= 0 ? r[k] ?? "" : "";
                    if (h === "Sefer Tarihi") {
                        val = parseDateCell(val);
                    } else if (h === "Toplam KM") {
                        const num = toNumber(val);
                        if (num !== null) val = num;
                    } else if (h === "TMSDespatchId") {
                        val = toPlainDigits(val);
                    }
                    obj[h] = val;
                });
                baseRows.push(obj);
            }

            const plateList = baseRows.map((r) => r["Plaka"]).filter(Boolean);
            const supaMap = await fetchSupabaseByPlates(plateList);

            const finals = baseRows.map((r) => {
                const m = supaMap.get(normalize(r["Plaka"]));
                const aylikKira = toNumber(m?.aylik_kira);
                const aylikSurucu = toNumber(m?.aylik_surucu);
                const calismaGunu = toNumber(m?.calisma_gunu);

                return {
                    "Sefer Tarihi": r["Sefer Tarihi"],
                    "Sefer No": r["Sefer No"],
                    "TMSDespatchId": r["TMSDespatchId"],
                    Plaka: r["Plaka"],
                    "Toplam KM": r["Toplam KM"],
                    Açıklama: r["Açıklama"],
                    "Cari ID": toPlainDigits(m?.cari_id ?? ""),
                    "Cari Firma": m?.cari_adi ?? "",
                    "Aylık Kira": aylikKira,
                    "Aylık sürücü": aylikSurucu,
                    "Hak Ediş Kira": null,
                    "Hak Ediş Sürücü": null,
                    "Sefer Kira Maliyeti": null,
                    "Sefer Sürücü Maliyeti": null,
                    "Çalışma Günü": calismaGunu,
                };
            });
            setRows(finals);
            setSummary(null);
            setExportMsg("");
            if (typeof onFileReady === "function") onFileReady(file);
        } catch (err) {
            console.error(err);
            setRows([]);
            setSummary(null);
            setExportMsg("");
            setFileError(
                err?.message ||
                "Dosya işlenirken bir hata oluştu. Lütfen şablon ve Supabase ayarlarını kontrol edin."
            );
        } finally {
            setParsing(false);
        }
    };

    // Hesaplama (Korunur)
    const handleCalculate = () => { /* ... (fonksiyon içeriği korunur) ... */
        if (!rows.length) return;

        const plateKmTotals = rows.reduce((map, r) => {
            const plaka = String(r["Plaka"] || "").trim();
            const km = toNumber(r["Toplam KM"]) ?? 0;
            if (!plaka) return map;
            map.set(plaka, (map.get(plaka) ?? 0) + km);
            return map;
        }, new Map());

        const updatedRows = rows.map((r) => {
            const aylikKira = toNumber(r["Aylık Kira"]);
            const aylikSurucu = toNumber(r["Aylık sürücü"]);
            const calismaGunu = toNumber(r["Çalışma Günü"]);
            const satirKm = toNumber(r["Toplam KM"]);
            const plaka = String(r["Plaka"] || "").trim();
            const plakaToplamKm = plateKmTotals.get(plaka) ?? null;

            const hakEdisKira =
                aylikKira !== null && calismaGunu !== null ? (aylikKira / 30) * calismaGunu : null;

            const hakEdisSurucu =
                aylikSurucu !== null && calismaGunu !== null ? (aylikSurucu / 30) * calismaGunu : null;

            const seferKiraMaliyeti =
                hakEdisKira !== null && plakaToplamKm !== null && plakaToplamKm > 0 && satirKm !== null
                    ? (hakEdisKira / plakaToplamKm) * satirKm
                    : null;

            const seferSurucuMaliyeti =
                hakEdisSurucu !== null && plakaToplamKm !== null && plakaToplamKm > 0 && satirKm !== null
                    ? (hakEdisSurucu / plakaToplamKm) * satirKm
                    : null;

            return {
                ...r,
                "Hak Ediş Kira": seferKiraMaliyeti === null && seferSurucuMaliyeti === null ? hakEdisKira : hakEdisKira,
                "Hak Ediş Sürücü": hakEdisSurucu,
                "Sefer Kira Maliyeti": seferKiraMaliyeti,
                "Sefer Sürücü Maliyeti": seferSurucuMaliyeti,
            };
        });

        setRows(updatedRows);

        const round2 = (x) => Math.round(x * 100) / 100;
        const sum = (key) => updatedRows.reduce((acc, row) => acc + (toNumber(row[key]) ?? 0), 0);

        const s = {
            toplamKm: round2(
                updatedRows.reduce((acc, row) => acc + (toNumber(row["Toplam KM"]) ?? 0), 0)
            ),
            aylikKira: round2(sum("Aylık Kira")),
            aylikSurucu: round2(sum("Aylık sürücü")),
            hakEdisKira: round2(sum("Hak Ediş Kira")),
            hakEdisSurucu: round2(sum("Hak Ediş Sürücü")),
            seferKira: round2(sum("Sefer Kira Maliyeti")),
            seferSurucu: round2(sum("Sefer Sürücü Maliyeti")),
            kayit: updatedRows.length,
        };

        setSummary(s);
    };

    /** REEL’E AKTAR (Korunur) */
    const handleExportReel = async () => { /* ... (fonksiyon içeriği korunur) ... */
        if (!rows.length) return;

        setExporting(true);
        setExportMsg("Gönderiliyor…");
        setFileError("");

        try {
            await fetchFreshToken();
        } catch (e) {
            setExporting(false);
            setExportMsg("");
            setFileError(e?.message || "TMS login başarısız.");
            return;
        }

        const validRows = rows.filter((r) => {
            const tmsDespatchId = Number(toPlainDigits(r["TMSDespatchId"]));
            const currentAccountId = Number(toPlainDigits(r["Cari ID"]));
            return (
                Number.isFinite(tmsDespatchId) &&
                tmsDespatchId > 0 &&
                Number.isFinite(currentAccountId) &&
                currentAccountId > 0
            );
        });

        const DECIMAL_DIGITS = 4;
        const lineMovementType = 3;
        const quantity = 1;
        const isFreight = false;

        let sent = 0,
            skippedKira = 0,
            skippedSurucu = 0,
            failed = 0;
        let firstError = null;

        const jobs = [];
        for (const r of validRows) {
            const tmsDespatchId = Number(toPlainDigits(r["TMSDespatchId"]));
            const currentAccountId = Number(toPlainDigits(r["Cari ID"]));
            const description = String(r["Açıklama"] || "");

            const decKira = toApiDecimal2(r["Sefer Kira Maliyeti"], DECIMAL_DIGITS);
            const decSurucu = toApiDecimal2(r["Sefer Sürücü Maliyeti"], DECIMAL_DIGITS);

            if (decKira.cents > 0) {
                const body = {
                    tmsDespatchId,
                    currentAccountId,
                    lineMovementType,
                    lineMovementId: 30,
                    unitPrice: decKira.number,
                    quantity,
                    vatRate: 0.2,
                    withholdingRate: 0,
                    description,
                    isFreight,
                };
                jobs.push(async () => {
                    await resilientPost(TMS_ADD_EXPENSE_URL, body, {
                        maxRetries: 3,
                        baseDelay: 200,
                    });
                    sent += 1;
                });
            } else {
                skippedKira += 1;
            }

            if (decSurucu.cents > 0) {
                const body = {
                    tmsDespatchId,
                    currentAccountId,
                    lineMovementType,
                    lineMovementId: 32,
                    unitPrice: decSurucu.number,
                    quantity,
                    vatRate: 0.2,
                    withholdingRate: 0.9,
                    description,
                    isFreight,
                };
                jobs.push(async () => {
                    await resilientPost(TMS_ADD_EXPENSE_URL, body, {
                        maxRetries: 3,
                        baseDelay: 200,
                    });
                    sent += 1;
                });
            } else {
                skippedSurucu += 1;
            }
        }

        setProgress({ current: 0, total: jobs.length });

        try {
            const { errors } = await runWithConcurrencyLimit(jobs, 5, (done, total) =>
                setProgress({ current: done, total })
            );
            failed = errors.filter(Boolean).length;
            if (failed && !firstError) firstError = String(errors.find(Boolean));
        } catch (e) {
            failed += 1;
            if (!firstError) firstError = e?.message || String(e);
        } finally {
            const msg =
                `✅ İşlem tamam: ${sent} kayıt gönderildi, ` +
                `${skippedKira} atlandı (Kira=0), ` +
                `${skippedSurucu} atlandı (Sürücü=0), ` +
                `${failed} hata.` +
                (firstError ? ` İlk hata: ${firstError}` : "");
            setExportMsg(msg);
            setExporting(false);
            setProgress({ current: jobs.length, total: jobs.length });
        }
    };

    // Excel'e Aktar (Korunur)
    const handleExportExcel = async () => { /* ... (fonksiyon içeriği korunur) ... */
        if (!rows.length) return;
        const mod = XLSX;

        const aoa = [DISPLAY_HEADERS];
        rows.forEach((r) => {
            aoa.push(
                DISPLAY_HEADERS.map((h) => {
                    const v = r[h];
                    if (h === "Sefer Tarihi") return v instanceof Date ? toISODate(v) : String(v ?? "");
                    if (h === "TMSDespatchId" || h === "Cari ID") return toPlainDigits(v);
                    if (
                        [
                            "Aylık Kira", "Aylık sürücü", "Hak Ediş Kira", "Hak Ediş Sürücü",
                            "Sefer Kira Maliyeti", "Sefer Sürücü Maliyeti",
                        ].includes(h)
                    )
                        return Number(v ?? 0);
                    if (h === "Toplam KM" || h === "Çalışma Günü") return Number(v ?? 0);
                    return v ?? "";
                })
            );
        });

        const ws = mod.utils.aoa_to_sheet(aoa);
        ws["!autofilter"] = { ref: `A1:${String.fromCharCode(65 + DISPLAY_HEADERS.length - 1)}1` };
        ws["!cols"] = DISPLAY_HEADERS.map(() => ({ wch: 16 }));

        const wb = mod.utils.book_new();
        mod.utils.book_append_sheet(wb, ws, "Hakediş Seferleri");
        const wbout = mod.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "hakedis_seferleri.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const dropzoneDisabled = permLoading || !perms.canUpload;

    return (
        <Box
            sx={{
                minHeight: "100dvh",
                py: 4,
                px: { xs: 1.5, md: 2.5 },
                background: (t) =>
                    t.palette.mode === "dark"
                        ? `radial-gradient(1200px 600px at 10% -10%, rgba(120,119,198,0.18), transparent 60%),
                           radial-gradient(900px 500px at 100% 0%, rgba(56,189,248,0.12), transparent 60%),
                           ${t.palette.background.default}`
                        : "linear-gradient(180deg, #f0f4f9 0%, #ffffff 60%)",
            }}
        >
            <Container maxWidth="xl" disableGutters>
                <Paper
                    elevation={16}
                    sx={{
                        borderRadius: 4,
                        overflow: "hidden",
                        backdropFilter: "blur(12px)",
                        border: (t) => `1px solid ${t.palette.divider}`,
                        boxShadow: (t) =>
                            t.palette.mode === "dark"
                                ? "0 20px 60px rgba(0,0,0,0.5)"
                                : "0 25px 50px rgba(38, 78, 118, 0.15)",
                        p: { xs: 2, md: 4 },
                    }}
                >
                    {/* HEDER VE NAVİGASYON */}
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        alignItems={{ xs: "start", sm: "center" }}
                        justifyContent="space-between"
                        spacing={2}
                        pb={3}
                    >
                        <Typography
                            variant="h4"
                            fontWeight={900}
                            sx={{
                                background: "linear-gradient(90deg, #6d28d9, #0ea5e9)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            Hakediş Seferleri Yükleme 📂
                        </Typography>
                        <Stack direction="row" spacing={1} flexShrink={0}>
                            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
                                Geri
                            </Button>
                            <Button variant="outlined" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)}>
                                Anasayfa
                            </Button>
                        </Stack>
                    </Stack>

                    <Divider sx={{ mb: 3 }} />

                    {/* ŞABLON VE YETKİ ALANI */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" spacing={2}>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<DownloadIcon />}
                            onClick={handleDownloadTemplate}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                            Excel Şablon İndir
                        </Button>
                        <Chip
                            label={permLoading ? "Yetkiler yükleniyor..." : perms.canUpload ? "Yükleme Yetkisi: Var" : "Yükleme Yetkisi: Yok"}
                            color={permLoading ? "default" : perms.canUpload ? "success" : "error"}
                            variant="outlined"
                        />
                    </Stack>

                    {/* YÜKLEME ALANI (Drag & Drop) */}
                    <Box
                        onDragEnter={onDragEnter}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={openFileDialog}
                        sx={{
                            border: `2px dashed ${dragActive ? 'primary.main' : 'divider'}`,
                            borderRadius: 2,
                            p: 6,
                            textAlign: 'center',
                            cursor: dropzoneDisabled ? 'not-allowed' : 'pointer',
                            opacity: dropzoneDisabled ? 0.6 : 1,
                            transition: 'all 0.3s',
                            bgcolor: dragActive ? 'primary.light' : 'background.default',
                            boxShadow: dragActive ? 4 : 0,
                        }}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept={ACCEPT}
                            onChange={onInputChange}
                            style={{ display: 'none' }}
                            disabled={dropzoneDisabled}
                        />
                        <FilePresentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1.5 }} />
                        <Typography variant="h6" fontWeight={700}>
                            Dosyanı Buraya Sürükle veya Tıkla
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            CSV, XLSX, XLS formatları desteklenir. (Max 20MB)
                        </Typography>
                        {fileError && (
                            <Chip
                                label={fileError}
                                color="error"
                                sx={{ mt: 2, bgcolor: 'error.main', color: 'error.contrastText' }}
                            />
                        )}
                        {file && !fileError && (
                            <Chip
                                label={`Seçilen Dosya: ${file.name} (Tıkla/Sürükle ile Değiştir)`}
                                color="info"
                                sx={{ mt: 2 }}
                            />
                        )}
                    </Box>

                    {/* İŞLEM BUTONLARI */}
                    {file && !fileError && (
                        <Stack direction="row" spacing={1.5} mt={3} flexWrap="wrap">
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={parsing ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
                                onClick={parseSelectedFile}
                                disabled={parsing}
                                sx={{ textTransform: 'none', fontWeight: 600 }}
                            >
                                {parsing ? "Veriler İşleniyor..." : "1. Yükle ve Eşleştir"}
                            </Button>

                            <Button
                                variant="contained"
                                color="info"
                                startIcon={<CalculateIcon />}
                                onClick={handleCalculate}
                                disabled={!rows.length || exporting}
                                sx={{ textTransform: 'none', fontWeight: 600 }}
                            >
                                2. Hesapla
                            </Button>

                            <Button
                                variant="contained"
                                color="success"
                                startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                                onClick={handleExportReel}
                                disabled={!rows.length || exporting}
                                sx={{ textTransform: 'none', fontWeight: 600 }}
                            >
                                3. Reel'e Aktar
                            </Button>

                            <Button
                                variant="outlined"
                                color="secondary"
                                startIcon={<DownloadIcon />}
                                onClick={handleExportExcel}
                                disabled={!rows.length || exporting}
                                sx={{ textTransform: 'none', fontWeight: 600 }}
                            >
                                Excel'e Aktar
                            </Button>

                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteForeverIcon />}
                                onClick={resetState}
                                sx={{ textTransform: 'none' }}
                            >
                                Kaldır
                            </Button>
                        </Stack>
                    )}

                    {/* AKTARIM DURUM VE İLERLEME */}
                    {exporting && (
                        <Paper elevation={4} sx={{ mt: 3, p: 2, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                            <Typography variant="subtitle1" fontWeight={700} mb={1}>
                                TMS'e Aktarım Devam Ediyor...
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={2}>
                                <LinearProgress
                                    variant="determinate"
                                    value={progress.total ? (progress.current / progress.total) * 100 : 0}
                                    sx={{ flexGrow: 1, height: 10, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.5)' }}
                                    color="inherit"
                                />
                                <Typography variant="body2" fontWeight={700}>
                                    {progress.current}/{progress.total}
                                </Typography>
                            </Stack>
                        </Paper>
                    )}

                    {/* AKTARIM SONUCU / ÖZET */}
                    {(summary || exportMsg) && (
                        <Paper elevation={4} sx={{ mt: 3, p: 3, bgcolor: 'grey.50' }}>
                            {/* Aktarım Mesajı */}
                            {!!exportMsg && (
                                <Chip
                                    label={exportMsg}
                                    color={exportMsg.includes("hata") || exportMsg.includes("başarısız") ? "error" : "success"}
                                    sx={{ mb: 2, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 1 } }}
                                />
                            )}
                            {/* Özet Tablo */}
                            {summary && (
                                <Box>
                                    <Typography variant="h6" fontWeight={700} color="secondary.main" mb={1}>
                                        Hesaplama Özeti ({summary.kayit} Kayıt)
                                    </Typography>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap>
                                        <DetailCard title="Toplam KM" value={fmtKm(summary.toplamKm)} icon="🛣️" />
                                        <DetailCard title="Toplam Hak Ediş Kira" value={fmtTRY(summary.hakEdisKira)} icon="🏠" />
                                        <DetailCard title="Toplam Hak Ediş Sürücü" value={fmtTRY(summary.hakEdisSurucu)} icon="👨‍💻" />
                                        <DetailCard title="Toplam Sefer Maliyeti" value={fmtTRY(summary.seferKira + summary.seferSurucu)} icon="💸" highlight />
                                    </Stack>
                                </Box>
                            )}
                        </Paper>
                    )}

                    {/* DETAY TABLO */}
                    {rows.length > 0 && (
                        <Box sx={{ mt: 4 }}>
                            <Typography variant="h6" fontWeight={700} mb={2}>
                                Yüklenen ve Hesaplanan Detaylar
                            </Typography>
                            <TableContainer
                                component={Paper}
                                elevation={2}
                                sx={{ maxHeight: '60vh' }}
                            >
                                <Table stickyHeader size="small" sx={{ minWidth: 1500 }}>
                                    <TableHead>
                                        <TableRow>
                                            {DISPLAY_HEADERS.map((h) => (
                                                <TableCell
                                                    key={h}
                                                    sx={{
                                                        bgcolor: 'primary.light',
                                                        color: 'primary.contrastText',
                                                        fontWeight: 700,
                                                        whiteSpace: 'nowrap',
                                                        fontSize: 12,
                                                        py: 1,
                                                    }}
                                                    align={
                                                        ["Aylık Kira", "Aylık sürücü", "Hak Ediş Kira", "Hak Ediş Sürücü", "Sefer Kira Maliyeti", "Sefer Sürücü Maliyeti"].includes(h)
                                                            ? 'right' : ['Toplam KM', 'Çalışma Günü'].includes(h) ? 'center' : 'left'
                                                    }
                                                >
                                                    {h}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rows.map((r, i) => (
                                            <TableRow
                                                key={i}
                                                sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}
                                            >
                                                {DISPLAY_HEADERS.map((h) => {
                                                    const v = r[h];
                                                    let content;
                                                    let isMoney = ["Aylık Kira", "Aylık sürücü", "Hak Ediş Kira", "Hak Ediş Sürücü", "Sefer Kira Maliyeti", "Sefer Sürücü Maliyeti"].includes(h);

                                                    if (h === "Sefer Tarihi") content = fmtDateTR(v);
                                                    else if (h === "TMSDespatchId" || h === "Cari ID") content = toPlainDigits(v);
                                                    else if (isMoney) content = fmtTRY(v);
                                                    else if (h === "Toplam KM" || h === "Çalışma Günü") content = fmtKm(v);
                                                    else content = (v ?? "") === "" ? "—" : String(v);

                                                    return (
                                                        <TableCell
                                                            key={h + i}
                                                            align={
                                                                isMoney
                                                                    ? 'right'
                                                                    : ['Toplam KM', 'Çalışma Günü'].includes(h) ? 'center' : 'left'
                                                            }
                                                            sx={{
                                                                fontSize: 11,
                                                                py: 0.8,
                                                                fontWeight: isMoney ? 600 : 400,
                                                                color: isMoney ? 'success.dark' : 'text.primary',
                                                                whiteSpace: h === "Açıklama" ? 'normal' : 'nowrap',
                                                            }}
                                                        >
                                                            {content}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </Paper>
            </Container>
        </Box>
    );
}

// Yeni Özet Kart Bileşeni
const DetailCard = ({ title, value, icon, highlight = false }) => (
    <Paper
        variant="outlined"
        sx={{
            p: 1.5,
            borderRadius: 2,
            minWidth: 150,
            flexGrow: 1,
            textAlign: 'center',
            bgcolor: highlight ? 'secondary.main' : 'background.paper',
            color: highlight ? 'secondary.contrastText' : 'text.primary',
        }}
    >
        <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1 }}>
            {icon} {value}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
            {title}
        </Typography>
    </Paper>
);
