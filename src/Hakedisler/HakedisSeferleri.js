// src/Hakedisler/HakedisSeferleri.js
import React, { useCallback, useRef, useState, useEffect } from "react";
import "./HakedisSeferleri.css";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import { HomeOutlined as HomeIcon } from "@mui/icons-material";

/** Ekran anahtarı & izin anahtarı */
const SCREEN_KEY = "hakedis_seferleri";
const UPLOAD_COL = "arcdur_create"; // dosya ekleme izni için

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

// URL sabitleri (HakedisSeferleri.js)
const IS_PROD = process.env.NODE_ENV === "production";
const PROXY_BASE = IS_PROD ? "/api" : "/reel-api";

const TMS_LOGIN_URL = `${PROXY_BASE}${IS_PROD ? "/reel-auth/login" : "/api/auth/login"
    }`;
const TMS_ADD_EXPENSE_URL = `${PROXY_BASE}${IS_PROD
        ? "/tmsdespatchincomeexpenses/addexpense"
        : "/api/tmsdespatchincomeexpenses/addexpense"
    }`;

/** Yardımcılar */
const normalize = (s) =>
    String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Metni TR formatından sayıya çevirir (YUVARLAMA YOK) */
const toNumber = (v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = String(v).trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

/** API'ye gönderilecek ondalık (varsayılan 2 hane) değeri güvenli üretir */
const toApiDecimal2 = (v, digits = 2) => {
    const n = toNumber(v);
    if (n === null) return { number: 0, cents: 0, string: (0).toFixed(digits) };
    const factor = 10 ** digits;
    const cents = Math.round(n * factor);
    const fixed = (cents / factor).toFixed(digits);
    return { number: Number(fixed), cents, string: fixed };
};

/** API'ye gönderilecek ondalık değeri (digits hane) güvenli üretir (genel sürüm) */
const toApiDecimal = (v, digits = 2) => {
    const n = toNumber(v);
    const z = Number((0).toFixed(digits));
    if (n === null) return { number: z, scaled: 0, string: (0).toFixed(digits) };
    const factor = 10 ** digits;
    const scaled = Math.round(n * factor);
    const fixed = (scaled / factor).toFixed(digits);
    return { number: Number(fixed), scaled, string: fixed };
};

/** Yalnızca rakamları bırakır (ID alanları için) */
const toPlainDigits = (v) => {
    if (v === null || v === undefined) return "";
    return String(v).trim().replace(/[.,\s]/g, "");
};

/** KM gösterimi (binlik ayraç) */
const fmtKm = (v) =>
    v === null || v === undefined || v === ""
        ? "—"
        : typeof v === "number"
            ? v.toLocaleString("tr-TR")
            : String(v);

/** TRY para gösterimi — HER ZAMAN 4 ondalık */
const fmtTRY = (v) =>
    v === null || v === undefined || v === ""
        ? "—"
        : new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
        }).format(Number(v));

/** TR tarih gösterimi */
const fmtDateTR = (d) => {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("tr-TR");
};

/** ISO (yyyy-mm-dd) tarih üretimi */
const toISODate = (d) => {
    if (!d) return null;
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
};

/** İstenilen ondalık haneye yuvarlar (varsayılan 4) */
const roundN = (x, n = 4) => {
    if (x === null || x === undefined || x === "") return null;
    const num = Number(x);
    if (!Number.isFinite(num)) return null;
    const f = 10 ** n;
    return Math.round(num * f) / f;
};

/* ---------------------- TOKEN ÖNBELLEK / YENİLEME ---------------------- */
let tokenCache = { value: "", obtainedAt: 0 };
const TOKEN_MAX_AGE_MS = 4 * 60 * 1000;

async function loginToTMSWithLocalReelCreds() {
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
        j.token ||
        j.access_token ||
        j.accessToken ||
        j?.data?.token ||
        j?.result?.token ||
        j?.jwt;

    if (!token || typeof token !== "string") {
        throw new Error("TMS login yanıtında token bulunamadı.");
    }

    token = token.trim();
    if (token.toLowerCase().startsWith("bearer ")) {
        token = token.slice(7).trim();
    }
    return token;
}

async function fetchFreshToken() {
    const t = await loginToTMSWithLocalReelCreds();
    tokenCache = { value: t, obtainedAt: Date.now() };
    return t;
}

async function ensureValidToken() {
    const age = Date.now() - tokenCache.obtainedAt;
    if (!tokenCache.value || age > TOKEN_MAX_AGE_MS) {
        return await fetchFreshToken();
    }
    return tokenCache.value;
}

/* ---------------------- NETWORK DAYANIKLILIK ARAÇLARI ---------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, opts = {}, timeoutMs = 30000) {
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...opts, signal: ctl.signal });
        return res;
    } finally {
        clearTimeout(id);
    }
}

async function resilientPost(url, body, { maxRetries = 3, baseDelay = 200 } = {}) {
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

async function runWithConcurrencyLimit(jobs, limit, onProgress) {
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

/* ---------------------- YETKİLER ---------------------- */
function coalesceOverride(overrideVal, roleVal) {
    return overrideVal === true || overrideVal === false ? overrideVal : !!roleVal;
}

async function loadUploadPermission(kullanici) {
    // 1) kullanıcıyı bul
    const { data: userRow, error: eU } = await supabase
        .from("login")
        .select("id, kullanici, rol")
        .eq("kullanici", kullanici)
        .maybeSingle();
    if (eU) throw eU;

    // 2) rol id al
    const roleKey = (userRow?.rol || "").toUpperCase();
    const { data: roleRow, error: eR } = await supabase
        .from("roles")
        .select("id,key")
        .eq("key", roleKey)
        .maybeSingle();
    if (eR) throw eR;

    // 3) role_permissions (bu ekran)
    let rolePerm = {};
    if (roleRow?.id) {
        const { data: rp, error: eRP } = await supabase
            .from("role_permissions")
            .select("*")
            .eq("screen_key", SCREEN_KEY)
            .eq("role_id", roleRow.id)
            .maybeSingle();
        if (eRP) throw eRP;
        rolePerm = rp || {};
    }

    // 4) user_permissions override (bu ekran)
    const { data: up, error: eUP } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("screen_key", SCREEN_KEY)
        .eq("user_id", userRow?.id)
        .maybeSingle();
    if (eUP) throw eUP;

    // 5) etkin izin
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

    const ACCEPT = [
        ".csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ].join(",");

    // YETKİYİ YÜKLE
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

    // Excel (.xlsx) şablon indir — izin gerektirmez
    const handleDownloadTemplate = async () => {
        const mod = await import("xlsx");
        const XLSX = mod.default ?? mod;
        const aoa = [TEMPLATE_HEADERS];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!autofilter"] = { ref: "A1:F1" };
        ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sefer Şablon");
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
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

    const handleFiles = useCallback(
        (files) => {
            // İZİN YOKSA ÇIK
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
        },
        [perms.canUpload]
    );

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

    // Supabase: plakalara göre toplu çek
    const fetchSupabaseByPlates = async (plates) => {
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

    // Dosyayı oku -> Supabase ile eşleştir -> türet -> tabloya yaz
    const parseSelectedFile = async () => {
        if (!file) {
            setFileError("Önce bir dosya seçiniz.");
            return;
        }
        setParsing(true);
        setFileError("");

        try {
            const mod = await import("xlsx");
            const XLSX = mod.default ?? mod;
            const isCsv = file.name.toLowerCase().endsWith(".csv");

            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error("Dosya okunamadı"));
                if (isCsv) reader.readAsText(file, "utf-8");
                else reader.readAsArrayBuffer(file);
            });

            const wb = isCsv ? XLSX.read(data, { type: "string" }) : XLSX.read(data, { type: "array" });
            const sheetName = wb.SheetNames?.[0];
            if (!sheetName) throw new Error("Çalışma sayfası bulunamadı.");
            const sheet = wb.Sheets[sheetName];

            const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
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
                    const d = (mod.default ?? mod).SSF?.parse_date_code?.(Number(n));
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

    const handleCalculate = () => {
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
                aylikKira !== null && calismaGunu !== null
                    ? (aylikKira / 30) * calismaGunu
                    : null;

            const hakEdisSurucu =
                aylikSurucu !== null && calismaGunu !== null
                    ? (aylikSurucu / 30) * calismaGunu
                    : null;

            const seferKiraMaliyeti =
                hakEdisKira !== null &&
                    plakaToplamKm !== null &&
                    plakaToplamKm > 0 &&
                    satirKm !== null
                    ? (hakEdisKira / plakaToplamKm) * satirKm
                    : null;

            const seferSurucuMaliyeti =
                hakEdisSurucu !== null &&
                    plakaToplamKm !== null &&
                    plakaToplamKm > 0 &&
                    satirKm !== null
                    ? (hakEdisSurucu / plakaToplamKm) * satirKm
                    : null;

            return {
                ...r,
                "Hak Ediş Kira":
                    seferKiraMaliyeti === null && seferSurucuMaliyeti === null
                        ? hakEdisKira
                        : hakEdisKira,
                "Hak Ediş Sürücü": hakEdisSurucu,
                "Sefer Kira Maliyeti": seferKiraMaliyeti,
                "Sefer Sürücü Maliyeti": seferSurucuMaliyeti,
            };
        });

        setRows(updatedRows);

        const round2 = (x) => Math.round(x * 100) / 100;
        const sum = (key) =>
            updatedRows.reduce((acc, row) => acc + (toNumber(row[key]) ?? 0), 0);

        const s = {
            toplamKm: round2(
                updatedRows.reduce(
                    (acc, row) => acc + (toNumber(row["Toplam KM"]) ?? 0),
                    0
                )
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

    /** REEL’E AKTAR (güncel): Havuz + backoff + timeout ile dayanıklı gönderim */
    const handleExportReel = async () => {
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
            const { errors } = await runWithConcurrencyLimit(
                jobs,
                5,
                (done, total) => setProgress({ current: done, total })
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

    // Excel'e Aktar
    const handleExportExcel = async () => {
        if (!rows.length) return;
        const mod = await import("xlsx");
        const XLSX = mod.default ?? mod;

        const aoa = [DISPLAY_HEADERS];
        rows.forEach((r) => {
            aoa.push(
                DISPLAY_HEADERS.map((h) => {
                    const v = r[h];
                    if (h === "Sefer Tarihi") return v instanceof Date ? toISODate(v) : String(v ?? "");
                    if (h === "TMSDespatchId" || h === "Cari ID") return toPlainDigits(v);
                    if (
                        [
                            "Aylık Kira",
                            "Aylık sürücü",
                            "Hak Ediş Kira",
                            "Hak Ediş Sürücü",
                            "Sefer Kira Maliyeti",
                            "Sefer Sürücü Maliyeti",
                        ].includes(h)
                    )
                        return Number(v ?? 0);
                    if (h === "Toplam KM" || h === "Çalışma Günü") return Number(v ?? 0);
                    return v ?? "";
                })
            );
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!autofilter"] = { ref: `A1:${String.fromCharCode(65 + DISPLAY_HEADERS.length - 1)}1` };
        ws["!cols"] = DISPLAY_HEADERS.map(() => ({ wch: 16 }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hakediş Seferleri");
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
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
        <div className="hs-card fade-in">
            {/* Üst Bar */}
            <div className="hs-header">
                <h1 className="hs-title">Hakediş Seferleri</h1>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                        type="button"
                        className="btn"
                        onClick={() => navigate(-1)}
                        aria-label="Geri dön"
                        title="Geri"
                    >
                        ← Geri
                    </button>
                    <Button size="small" variant="text" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)}>
                        Anasayfa
                    </Button>
                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="btn btn-primary"
                        aria-label="Şablon indir"
                    >
                        <span className="pill">⬇️</span> Şablon indir
                    </button>
                </div>
            </div>

            {/* Yetki uyarısı */}
            {dropzoneDisabled && (
                <div
                    className="hs-card"
                    style={{
                        marginTop: 8,
                        background: "rgba(239,68,68,0.07)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        color: "#991b1b",
                        fontWeight: 600,
                    }}
                >
                    {permLoading ? "Yetkiler yükleniyor…" : "Dosya yükleme yetkiniz yok."}
                </div>
            )}

            {/* Yükleme Alanı */}
            <div
                className={`hs-dropzone ${dragActive ? "is-dragover" : ""} ${dropzoneDisabled ? "is-disabled" : ""}`}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openFileDialog();
                }}
                aria-label="Dosya sürükleyip bırakın veya seçin"
                style={dropzoneDisabled ? { pointerEvents: "none", opacity: 0.6 } : undefined}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT}
                    className="hs-file-input"
                    onChange={onInputChange}
                    id="hs-file"
                    disabled={dropzoneDisabled}
                />
                <div className="hs-dz-icon">📄</div>
                <div className="hs-dz-title">Dosyanı sürükleyip bırak</div>
                <div className="hs-dz-hint">CSV, XLSX, XLS — max 20MB</div>
                <div className="hs-or">veya</div>
                <div className="hs-filepicker">
                    <label
                        htmlFor="hs-file"
                        className={`btn btn-ghost ${dropzoneDisabled ? "is-disabled" : ""}`}
                        onClick={(e) => {
                            if (dropzoneDisabled) e.preventDefault();
                        }}
                        title={dropzoneDisabled ? "Dosya yükleme yetkiniz yok" : "Belgelerden yükle"}
                    >
                        Belgelerden yükle
                    </label>
                </div>
            </div>

            {/* Seçilen Dosya Bilgisi + Yükle + (Hesapla / Reel’e Aktar) */}
            <div className="mt-4">
                {fileError ? (
                    <p className="text-sm" style={{ color: "rgb(239, 68, 68)" }}>
                        {fileError}
                    </p>
                ) : file ? (
                    <div className="hs-file-row">
                        <div className="hs-file-info">
                            <div className="hs-file-badge">📄</div>
                            <div>
                                <div className="hs-file-name">{file.name}</div>
                                <div className="hs-file-meta">
                                    {(file.size / 1024).toFixed(1)} KB · {file.type || "bilinmeyen tür"}
                                </div>
                            </div>
                        </div>
                        <div className="hs-row-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                            <button
                                type="button"
                                onClick={parseSelectedFile}
                                className="btn-upload"
                                disabled={parsing}
                            >
                                {parsing ? "İşleniyor..." : "Yükle"}
                            </button>

                            <button
                                type="button"
                                onClick={handleCalculate}
                                className="btn"
                                disabled={!rows.length}
                                title={!rows.length ? "Önce Yükle ile verileri getir" : "Toplamları hesapla"}
                            >
                                Hesapla
                            </button>

                            <button
                                type="button"
                                onClick={handleExportReel}
                                className="btn btn-primary"
                                disabled={!rows.length || exporting}
                                title={!rows.length ? "Önce Yükle ile verileri getir" : "Reel’e aktar"}
                            >
                                {exporting ? "Aktarılıyor..." : "Reel’e Aktar"}
                            </button>

                            <button
                                type="button"
                                onClick={handleExportExcel}
                                className="btn btn-secondary"
                                disabled={!rows.length}
                                title="Excel'e aktar"
                            >
                                Excel'e Aktar
                            </button>

                            <button type="button" onClick={resetState} className="btn-remove">
                                Kaldır
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Hesapla özeti */}
            {summary && (
                <div className="hs-card" style={{ marginTop: 12 }}>
                    <div className="hs-table-header">
                        <div className="hs-table-title">Özet</div>
                        <div className="hs-table-meta">{summary.kayit} satır</div>
                    </div>
                    <div className="hs-table-scroll" style={{ overflow: "visible", border: "0", borderRadius: 0 }}>
                        <table className="hs-table" style={{ minWidth: 0 }}>
                            <tbody>
                                <tr>
                                    <th>Toplam KM</th>
                                    <td>{fmtKm(summary.toplamKm)}</td>
                                    <th>Aylık Kira</th>
                                    <td>{fmtTRY(summary.aylikKira)}</td>
                                    <th>Aylık sürücü</th>
                                    <td>{fmtTRY(summary.aylikSurucu)}</td>
                                </tr>
                                <tr>
                                    <th>Hak Ediş Kira</th>
                                    <td>{fmtTRY(summary.hakEdisKira)}</td>
                                    <th>Hak Ediş Sürücü</th>
                                    <td>{fmtTRY(summary.hakEdisSurucu)}</td>
                                    <th>Sefer Maliyetleri</th>
                                    <td>
                                        {fmtTRY(summary.seferKira)} (Kira) + {fmtTRY(summary.seferSurucu)} (Sürücü)
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Progress Overlay */}
            {exporting && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            background: "#111827",
                            color: "#fff",
                            padding: "16px 20px",
                            borderRadius: 12,
                            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                            minWidth: 260,
                            textAlign: "center",
                            fontWeight: 600,
                        }}
                    >
                        <div style={{ fontSize: 16, marginBottom: 8 }}>Gönderiliyor…</div>
                        <div style={{ fontSize: 24 }}>
                            {progress.current}/{progress.total}
                        </div>
                        <div
                            style={{
                                marginTop: 12,
                                height: 8,
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.15)",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                                    height: "100%",
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Aktarım mesajı */}
            {!!exportMsg && (
                <div className="hs-card" style={{ marginTop: 12 }}>
                    <div className="hs-table-meta">{exportMsg}</div>
                </div>
            )}

            {/* Tablo */}
            {rows.length > 0 && (
                <div className="hs-table-wrap">
                    <div className="hs-table-header">
                        <div className="hs-table-title">Yüklenen Kayıtlar</div>
                        <div className="hs-table-meta">{rows.length} satır</div>
                    </div>
                    <div className="hs-table-scroll">
                        <table className="hs-table">
                            <thead>
                                <tr>
                                    {DISPLAY_HEADERS.map((h) => (
                                        <th key={h}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={i}>
                                        {DISPLAY_HEADERS.map((h) => {
                                            const v = r[h];
                                            if (h === "Sefer Tarihi") return <td key={h + i}>{fmtDateTR(v)}</td>;
                                            if (h === "TMSDespatchId" || h === "Cari ID")
                                                return <td key={h + i}>{toPlainDigits(v)}</td>;
                                            if (
                                                [
                                                    "Aylık Kira",
                                                    "Aylık sürücü",
                                                    "Hak Ediş Kira",
                                                    "Hak Ediş Sürücü",
                                                    "Sefer Kira Maliyeti",
                                                    "Sefer Sürücü Maliyeti",
                                                ].includes(h)
                                            )
                                                return <td key={h + i}>{fmtTRY(v)}</td>;
                                            if (h === "Toplam KM" || h === "Çalışma Günü")
                                                return <td key={h + i}>{fmtKm(v)}</td>;
                                            return <td key={h + i}>{(v ?? "") === "" ? "—" : String(v)}</td>;
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: 16, textAlign: "right" }}>
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            className="btn btn-primary"
                            style={{ minWidth: 160 }}
                        >
                            Excel’e Aktar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
