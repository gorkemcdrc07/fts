// src/Hakedisler/HakedisSeferleri.js
import React, { useCallback, useRef, useState } from "react";
import "./HakedisSeferleri.css";
import { supabase } from "../supabaseClient"; // ← yolunu düzenle
// import { authorizedJson } from "../auth/tokenManager"; // ← Artık kullanılmıyor (TMS'e doğrudan login)

/** Kullanıcı şablon başlıkları (Excel) */
const TEMPLATE_HEADERS = [
    "Sefer Tarihi",
    "Sefer No",
    "TMSDespatchId",
    "Plaka",
    "Toplam KM",
    "Açıklama"
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
    "Çalışma Günü"
];

// URL sabitleri (HakedisSeferleri.js)
const IS_PROD = process.env.NODE_ENV === "production";
const PROXY_BASE = IS_PROD ? "/api" : "/reel-api";

const TMS_LOGIN_URL = `${PROXY_BASE}${IS_PROD ? "/reel-auth/login" : "/api/auth/login"}`;
const TMS_ADD_EXPENSE_URL = `${PROXY_BASE}${IS_PROD ? "/tmsdespatchincomeexpenses/addexpense" : "/api/tmsdespatchincomeexpenses/addexpense"}`;
/** Yardımcılar */
/** Yardımcılar */
const normalize = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Metni TR formatından sayıya çevirir (YUVARLAMA YOK) */
const toNumber = (v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null; // yuvarlama yok
    const s = String(v).trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null; // yuvarlama yok
};

/** API'ye gönderilecek ondalık (varsayılan 2 hane) değeri güvenli üretir */
const toApiDecimal2 = (v, digits = 2) => {
    const n = toNumber(v);
    if (n === null) return { number: 0, cents: 0, string: (0).toFixed(digits) };
    const factor = 10 ** digits;
    const cents = Math.round(n * factor);            // ölçekli tam sayı (digits=2 ise kuruş)
    const fixed = (cents / factor).toFixed(digits);  // "123.45" veya "123.4567"
    return { number: Number(fixed), cents, string: fixed };
};

/** API'ye gönderilecek ondalık değeri (digits hane) güvenli üretir (genel sürüm) */
const toApiDecimal = (v, digits = 2) => {
    const n = toNumber(v);
    const z = Number((0).toFixed(digits));
    if (n === null) return { number: z, scaled: 0, string: (0).toFixed(digits) };
    const factor = 10 ** digits;
    const scaled = Math.round(n * factor);
    const fixed = (scaled / factor).toFixed(digits); // "123.4567" gibi
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
        : (typeof v === "number" ? v.toLocaleString("tr-TR") : String(v));

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



/** localStorage'dan REEL bilgileriyle TMS'e login olup token döner */
async function loginToTMSWithLocalReelCreds() {
    const userName = (localStorage.getItem("Reel-kullanici") || "").trim();
    const password = localStorage.getItem("Reel-sifre") || "";
    if (!userName || !password) {
        throw new Error("Reel-kullanici / Reel-sifre localStorage’da bulunamadı.");
    }

    const res = await fetch(TMS_LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName, password })
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`TMS login başarısız: ${res.status} ${txt}`);
    }
    const j = await res.json().catch(() => ({}));
    const token =
        j.token || j.access_token || j.accessToken || j?.data?.token || j?.result?.token || j?.jwt;
    if (!token) {
        throw new Error("TMS login yanıtında token bulunamadı.");
    }
    return token;
}

export default function HakedisSeferleri({ onFileReady }) {
    const [dragActive, setDragActive] = useState(false);
    const [fileError, setFileError] = useState("");
    const [file, setFile] = useState(null);
    const [rows, setRows] = useState([]); // final satırlar (DISPLAY_HEADERS ile uyumlu)
    const [parsing, setParsing] = useState(false);
    const [summary, setSummary] = useState(null); // Hesapla sonucu
    const [exporting, setExporting] = useState(false);
    const [exportMsg, setExportMsg] = useState("");
    const inputRef = useRef(null);

    const ACCEPT = [
        ".csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ].join(",");

    const resetState = () => {
        setFile(null);
        setFileError("");
        setRows([]);
        setSummary(null);
        setExportMsg("");
    };

    // Excel (.xlsx) şablon indir
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
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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
        if (!(isCsv || isXlsx || isXls)) return "Sadece CSV veya Excel dosyaları yükleyebilirsiniz (.csv, .xlsx, .xls).";
        const MAX = 20 * 1024 * 1024;
        if (f.size > MAX) return "Dosya boyutu 20MB'ı aşmamalı.";
        return "";
    };

    const handleFiles = useCallback((files) => {
        const f = files?.[0];
        const err = validateFile(f);
        if (err) { setFile(null); setFileError(err); return; }
        setFileError("");
        setFile(f);
        setRows([]);
        setSummary(null);
        setExportMsg("");
    }, []);

    const onDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
    const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
    const onDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setDragActive(false);
        const dt = e.dataTransfer;
        if (dt?.files?.length) handleFiles(dt.files);
    };

    const openFileDialog = () => inputRef.current?.click();
    const onInputChange = (e) => handleFiles(e.target.files);

    // Supabase: plakalara göre toplu çek
    const fetchSupabaseByPlates = async (plates) => {
        if (!supabase) throw new Error("Supabase ayarları eksik. .env’i kontrol edin ve dev server’ı yeniden başlatın.");
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
        if (!file) { setFileError("Önce bir dosya seçiniz."); return; }
        setParsing(true);
        setFileError("");

        try {
            const mod = await import("xlsx");
            const XLSX = mod.default ?? mod;
            const isCsv = file.name.toLowerCase().endsWith(".csv");

            // Dosya oku
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error("Dosya okunamadı"));
                if (isCsv) reader.readAsText(file, "utf-8"); else reader.readAsArrayBuffer(file);
            });

            // Workbook
            const wb = isCsv ? XLSX.read(data, { type: "string" }) : XLSX.read(data, { type: "array" });
            const sheetName = wb.SheetNames?.[0];
            if (!sheetName) throw new Error("Çalışma sayfası bulunamadı.");
            const sheet = wb.Sheets[sheetName];

            // Header + satırlar
            const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            if (!aoa.length) { setRows([]); return; }
            const headerRow = (aoa[0] || []).map((c) => String(c).trim());

            // Header kontrol
            const missing = TEMPLATE_HEADERS.filter((h) => !headerRow.some((x) => normalize(x) === normalize(h)));
            if (missing.length) throw new Error(`Eksik sütun(lar): ${missing.join(", ")}`);

            const idx = TEMPLATE_HEADERS.map((h) => headerRow.findIndex((x) => normalize(x) === normalize(h)));

            // Excel tarih serisini Date'e çevir
            const excelSerialToDate = (n) => {
                try {
                    const d = (mod.default ?? mod).SSF?.parse_date_code?.(Number(n));
                    if (!d) return null;
                    return new Date(Date.UTC(d.y, (d.m || 1) - 1, d.d || 1, d.H || 0, d.M || 0, d.S || 0));
                } catch { return null; }
            };
            const parseDateCell = (v) => {
                if (v === null || v === undefined || v === "") return null;
                if (typeof v === "number") {
                    const dt = excelSerialToDate(v);
                    return dt || null;
                }
                const s = String(v).trim();
                if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const dt = new Date(s); return Number.isNaN(dt.getTime()) ? null : dt; }
                const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
                if (m) { const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]); const dt = new Date(y, mo - 1, d); return Number.isNaN(dt.getTime()) ? null : dt; }
                const dt = new Date(s); return Number.isNaN(dt.getTime()) ? null : dt;
            };

            // Satırları oku
            const baseRows = [];
            for (let i = 1; i < aoa.length; i++) {
                const r = aoa[i] || [];
                if (r.every((c) => String(c ?? "").trim() === "")) continue; // boş satırları atla
                const obj = {};
                TEMPLATE_HEADERS.forEach((h, j) => {
                    const k = idx[j];
                    let val = k >= 0 ? (r[k] ?? "") : "";
                    if (h === "Sefer Tarihi") {
                        val = parseDateCell(val); // -> Date veya null
                    } else if (h === "Toplam KM") {
                        const num = toNumber(val);
                        if (num !== null) val = num;
                    } else if (h === "TMSDespatchId") {
                        val = toPlainDigits(val); // plain digits
                    }
                    obj[h] = val;
                });
                baseRows.push(obj);
            }

            // Supabase eşlemesi
            const plateList = baseRows.map((r) => r["Plaka"]).filter(Boolean);
            const supaMap = await fetchSupabaseByPlates(plateList);

            // Türetilmiş alanlar + son tablo satırı formatı
            const finals = baseRows.map((r) => {
                const m = supaMap.get(normalize(r["Plaka"]));
                const aylikKira = toNumber(m?.aylik_kira);
                const aylikSurucu = toNumber(m?.aylik_surucu);
                const calismaGunu = toNumber(m?.calisma_gunu);

                return {
                    "Sefer Tarihi": r["Sefer Tarihi"],
                    "Sefer No": r["Sefer No"],
                    "TMSDespatchId": r["TMSDespatchId"],
                    "Plaka": r["Plaka"],
                    "Toplam KM": r["Toplam KM"],
                    "Açıklama": r["Açıklama"],
                    "Cari ID": toPlainDigits(m?.cari_id ?? ""),
                    "Cari Firma": m?.cari_adi ?? "",
                    "Aylık Kira": aylikKira,
                    "Aylık sürücü": aylikSurucu,
                    "Hak Ediş Kira": null,              // boş bırak
                    "Hak Ediş Sürücü": null,            // boş bırak
                    "Sefer Kira Maliyeti": null,        // boş bırak
                    "Sefer Sürücü Maliyeti": null,      // boş bırak
                    "Çalışma Günü": calismaGunu
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
            setFileError(err?.message || "Dosya işlenirken bir hata oluştu. Lütfen şablon ve Supabase ayarlarını kontrol edin.");
        } finally {
            setParsing(false);
        }
    };

    const handleCalculate = () => {
        if (!rows.length) return;

        // 1) Plaka bazında Toplam KM topla
        const plateKmTotals = rows.reduce((map, r) => {
            const plaka = String(r["Plaka"] || "").trim();
            const km = toNumber(r["Toplam KM"]) ?? 0;
            if (!plaka) return map;
            map.set(plaka, (map.get(plaka) ?? 0) + km);
            return map;
        }, new Map());

        // 2) Satır bazlı hesaplar
        const updatedRows = rows.map((r) => {
            const aylikKira = toNumber(r["Aylık Kira"]);
            const aylikSurucu = toNumber(r["Aylık sürücü"]);
            const calismaGunu = toNumber(r["Çalışma Günü"]);
            const satirKm = toNumber(r["Toplam KM"]);
            const plaka = String(r["Plaka"] || "").trim();
            const plakaToplamKm = plateKmTotals.get(plaka) ?? null;

            // Hak Edişler (ay/30 * çalışma günü)
            const hakEdisKira =
                aylikKira !== null && calismaGunu !== null
                    ? (aylikKira / 30) * calismaGunu
                    : null;

            const hakEdisSurucu =
                aylikSurucu !== null && calismaGunu !== null
                    ? (aylikSurucu / 30) * calismaGunu
                    : null;

            // Sefer Kira Maliyeti
            const seferKiraMaliyeti =
                hakEdisKira !== null &&
                    plakaToplamKm !== null &&
                    plakaToplamKm > 0 &&
                    satirKm !== null
                    ? (hakEdisKira / plakaToplamKm) * satirKm
                    : null;

            // Sefer Sürücü Maliyeti
            const seferSurucuMaliyeti =
                hakEdisSurucu !== null &&
                    plakaToplamKm !== null &&
                    plakaToplamKm > 0 &&
                    satirKm !== null
                    ? (hakEdisSurucu / plakaToplamKm) * satirKm
                    : null;

            return {
                ...r,
                "Hak Ediş Kira": seferKiraMaliyeti === null && seferSurucuMaliyeti === null ? hakEdisKira : hakEdisKira, // aynı kalsın
                "Hak Ediş Sürücü": hakEdisSurucu,
                "Sefer Kira Maliyeti": seferKiraMaliyeti,
                "Sefer Sürücü Maliyeti": seferSurucuMaliyeti
            };
        });

        setRows(updatedRows);

        // 3) Özet (2 ondalığa yuvarla)
        const round2 = (x) => Math.round(x * 100) / 100;
        const sum = (key) => updatedRows.reduce((acc, row) => acc + (toNumber(row[key]) ?? 0), 0);

        const s = {
            toplamKm: round2(updatedRows.reduce((acc, row) => acc + (toNumber(row["Toplam KM"]) ?? 0), 0)),
            aylikKira: round2(sum("Aylık Kira")),
            aylikSurucu: round2(sum("Aylık sürücü")),
            hakEdisKira: round2(sum("Hak Ediş Kira")),
            hakEdisSurucu: round2(sum("Hak Ediş Sürücü")),
            seferKira: round2(sum("Sefer Kira Maliyeti")),
            seferSurucu: round2(sum("Sefer Sürücü Maliyeti")),
            kayit: updatedRows.length
        };

        setSummary(s);
    };



    /** REEL’E AKTAR: TMS API'ye iki kalem gönder (kira=30, sürücü=32; sürücü 0 ise gönderme) */
    const handleExportReel = async () => {
        if (!rows.length) return;

        setExporting(true);
        setExportMsg("Gönderiliyor…");
        setFileError("");

        // Sabitler
        const lineMovementType = 3;
        const quantity = 1;
        const isFreight = false;

        // 4 ondalık ayarı
        const DECIMAL_DIGITS = 4;
        // 4 haneyi tam (ör. "12.3400") korumak istiyorsan true kalsın.
        // API sadece number kabul ediyorsa false yap: o zaman 12.34 olarak gider.
        const SEND_DECIMALS_AS_STRING = true;

        let sent = 0, skipped = 0, failed = 0;
        let firstError = null;

        // 1) TMS'e login → token
        let token = "";
        try {
            token = await loginToTMSWithLocalReelCreds();
        } catch (e) {
            setExportMsg("");
            setExporting(false);
            setFileError(e?.message || "TMS login başarısız.");
            return;
        }

        // 2) Tek POST yardımcısı
        const postOne = async (body) => {
            try {
                const res = await fetch(TMS_ADD_EXPENSE_URL, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const txt = await res.text().catch(() => "");
                    throw new Error(`${res.status} ${txt}`);
                }
                sent += 1;
            } catch (e) {
                failed += 1;
                if (!firstError) firstError = e?.message || String(e);
                console.error("REEL aktarım hatası:", e, body);
            }
        };

        // 3) Satırları dolaş ve iki kalem gönder
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];

            // Zorunlu alanlar
            const tmsDespatchId = Number(toPlainDigits(r["TMSDespatchId"]));
            const currentAccountId = Number(toPlainDigits(r["Cari ID"]));

            if (!Number.isFinite(tmsDespatchId) || tmsDespatchId <= 0 ||
                !Number.isFinite(currentAccountId) || currentAccountId <= 0) {
                failed += 1;
                if (!firstError) firstError = `Satır ${i + 1}: TMSDespatchId/Cari ID eksik veya geçersiz.`;
                continue;
            }

            const description = String(r["Açıklama"] || "");

            // 4 hane için yardımcıyı 4 ile çağır
            const decKira = toApiDecimal2(r["Sefer Kira Maliyeti"], DECIMAL_DIGITS);
            const decSurucu = toApiDecimal2(r["Sefer Sürücü Maliyeti"], DECIMAL_DIGITS);

            // 3.a) Sefer Kira Maliyeti — lineMovementId: 30 (0 olsa da gönderilecek)
            await postOne({
                tmsDespatchId,
                currentAccountId,
                lineMovementType,
                lineMovementId: 30,
                unitPrice: SEND_DECIMALS_AS_STRING ? decKira.string : decKira.number,
                quantity,
                vatRate: 0.2,         // 20%
                withholdingRate: 0,   // kira için 0
                description,
                isFreight
            });

            // 3.b) Sefer Sürücü Maliyeti — lineMovementId: 32 (SIFIR veya boş ise GÖNDERME)
            if (decSurucu.cents > 0) { // toApiDecimal2 4 hane için de 'cents' (ölçekli) döndürür
                await postOne({
                    tmsDespatchId,
                    currentAccountId,
                    lineMovementType,
                    lineMovementId: 32,
                    unitPrice: SEND_DECIMALS_AS_STRING ? decSurucu.string : decSurucu.number,
                    quantity,
                    vatRate: 0.2,        // 20%
                    withholdingRate: 0.90, // her zaman 0,90
                    description,
                    isFreight
                });
            } else {
                skipped += 1;
            }
        }

        // ... for (let i = 0; i < rows.length; i++) { ... } biter

        const msg =
            `✅ İşlem tamam: ${sent} kayıt gönderildi, ${skipped} atlandı(Sefer Sürücü Maliyetinde Tutar Yok), ${failed} hata.(Sefer Kira Maliyetinde ve Sefer Sürücü Maliyetinde Tutar Yok)` +
            (firstError ? ` İlk hata: ${firstError}` : "");

        // ⬇️ EKSİK OLANLAR
        setExportMsg(msg);
        setExporting(false);
    }; // <-- handleExportReel burada kapanıyor


    return (
        <div className="hs-card fade-in">
            {/* Üst Bar */}
            <div className="hs-header">
                <h1 className="hs-title">Hakediş Seferleri</h1>
                <button type="button" onClick={handleDownloadTemplate} className="btn btn-primary" aria-label="Şablon indir">
                    <span className="pill">⬇️</span> Şablon indir
                </button>
            </div>

            {/* Yükleme Alanı */}
            <div
                className={`hs-dropzone ${dragActive ? "is-dragover" : ""}`}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); const dt = e.dataTransfer; if (dt?.files?.length) handleFiles(dt.files); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
                aria-label="Dosya sürükleyip bırakın veya seçin"
            >
                <input ref={inputRef} type="file" accept={ACCEPT} className="hs-file-input" onChange={(e) => handleFiles(e.target.files)} id="hs-file" />
                <div className="hs-dz-icon">📄</div>
                <div className="hs-dz-title">Dosyanı sürükleyip bırak</div>
                <div className="hs-dz-hint">CSV, XLSX, XLS — max 20MB</div>
                <div className="hs-or">veya</div>
                <div className="hs-filepicker">
                    <label htmlFor="hs-file" className="btn btn-ghost">Belgelerden yükle</label>
                </div>
            </div>

            {/* Seçilen Dosya Bilgisi + Yükle + (Hesapla / Reel’e Aktar) */}
            <div className="mt-4">
                {fileError ? (
                    <p className="text-sm" style={{ color: "rgb(239, 68, 68)" }}>{fileError}</p>
                ) : file ? (
                    <div className="hs-file-row">
                        <div className="hs-file-info">
                            <div className="hs-file-badge">📄</div>
                            <div>
                                <div className="hs-file-name">{file.name}</div>
                                <div className="hs-file-meta">{(file.size / 1024).toFixed(1)} KB · {file.type || "bilinmeyen tür"}</div>
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

                            {/* Bu iki buton her zaman görünür; veriler gelmeden disabled */}
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
                                    <th>Toplam KM</th><td>{fmtKm(summary.toplamKm)}</td>
                                    <th>Aylık Kira</th><td>{fmtTRY(summary.aylikKira)}</td>
                                    <th>Aylık sürücü</th><td>{fmtTRY(summary.aylikSurucu)}</td>
                                </tr>
                                <tr>
                                    <th>Hak Ediş Kira</th><td>{fmtTRY(summary.hakEdisKira)}</td>
                                    <th>Hak Ediş Sürücü</th><td>{fmtTRY(summary.hakEdisSurucu)}</td>
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
                                    {DISPLAY_HEADERS.map((h) => <th key={h}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={i}>
                                        {DISPLAY_HEADERS.map((h) => {
                                            const v = r[h];
                                            if (h === "Sefer Tarihi") return <td key={h + i}>{fmtDateTR(v)}</td>;
                                            if (h === "TMSDespatchId" || h === "Cari ID") return <td key={h + i}>{toPlainDigits(v)}</td>;
                                            if (["Aylık Kira", "Aylık sürücü", "Hak Ediş Kira", "Hak Ediş Sürücü", "Sefer Kira Maliyeti", "Sefer Sürücü Maliyeti"].includes(h))
                                                return <td key={h + i}>{fmtTRY(v)}</td>;
                                            if (h === "Toplam KM" || h === "Çalışma Günü") return <td key={h + i}>{fmtKm(v)}</td>;
                                            return <td key={h + i}>{(v ?? "") === "" ? "—" : String(v)}</td>;
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
