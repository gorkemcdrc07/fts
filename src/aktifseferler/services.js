// src/aktifseferler/services.js
import { supabase } from "../supabaseClient";
import { EXCLUDED_PLAKAS, normalizePlate } from "./utils/sefer";

const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

/* ---------------- Yardımcılar ---------------- */

function isNumericId(v) {
    // string "123" ya da number 123 ise true
    return (
        (typeof v === "number" && Number.isFinite(v)) ||
        (typeof v === "string" && /^\d+$/.test(v))
    );
}

/* ---------------- Seferler ---------------- */

/**
 * Ana sefer listesini çekerken, Data Grid'deki "Nokta Kayıt Bilgisi" sütunu için 
 * gerekli olan teslim giriş/çıkış (varış/çıkış) bilgilerini de seferler objesi içine çeker.
 */
export async function fetchSeferler(rangeMin, rangeMax) {
    const { data, error } = await supabase
        .from("seferler")
        .select(`
            *,
            noktalar:sefer_detaylari(
                nokta_sirasi, 
                yukleme_varis,   
                yukleme_cikis,   
                teslim_varis,    
                teslim_cikis     
            )
        `)
        .gte("sefer_tarihi", rangeMin)
        .lte("sefer_tarihi", rangeMax)
        .ilike("sefer_no", "SFR%")
        .order("sefer_tarihi", { ascending: false });

    if (error) {
        console.error("fetchSeferler Error (400 Hatası Muhtemelen İlişkili Sorgu):", error);
        throw error;
    }

    // Çekilen noktaları (noktalar array'ini) nokta sırasına göre sırala
    return (data || []).map(sefer => ({
        ...sefer,
        noktalar: (sefer.noktalar || []).sort((a, b) => a.nokta_sirasi - b.nokta_sirasi),
    }));
}

export async function fetchTamamlananNos(rangeMin, rangeMax) {
    const { data, error } = await supabase
        .from("tamamlanan_seferler")
        .select("sefer_no")
        .gte("sefer_tarihi", rangeMin)
        .lte("sefer_tarihi", rangeMax);

    if (error) {
        console.error("fetchTamamlananNos error:", error);
        return new Set();
    }

    return new Set(
        (data || [])
            .map((x) => (x.sefer_no ?? "").toString().trim())
            .filter(Boolean)
    );
}

/* ---------------- TMS Senkron ---------------- */

export async function syncFromTMS({ start, end }) {
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
            WorkingTypesId: [3, 4, 33],
        }),
    });

    if (!res.ok) {
        let msg = `API Hatası: ${res.status} ${res.statusText}`;
        try {
            const text = await res.text();
            console.error("❌ Backend error body:", text);
            if (text) msg += ` — ${text.slice(0, 400)}`;
        } catch { }
        throw new Error(msg);
    }

    const json = await res.json();
    return Array.isArray(json?.Data) ? json.Data : [];
}

export function filterIncoming(list) {
    // 🔧 Normalize fonksiyonu (Türkçe karakter + case + trim fix)
    const normalizeTip = (s) =>
        (s || "")
            .toUpperCase()
            .replace(/İ/g, "I")
            .replace(/İ/g, "I")
            .replace(/Ş/g, "S")
            .replace(/Ğ/g, "G")
            .replace(/Ü/g, "U")
            .replace(/Ö/g, "O")
            .replace(/Ç/g, "C")
            .trim();

    const allowed = [
        "FILO",
        "OZMAL",
        "HAYAT KIMYA KIRALIK"
    ];

    return list
        .filter((item) => {
            const tip = normalizeTip(item?.VehicleWorkingTypeName);
            return allowed.includes(tip);
        })
        .filter((item) =>
            (item?.DocumentNo || "").toUpperCase().startsWith("SFR")
        )
        .filter((item) =>
            !EXCLUDED_PLAKAS.has(normalizePlate(item?.PlateNumber))
        );
}
export async function upsertSeferler(rows) {
    if (!rows?.length) return;
    const { error } = await supabase
        .from("seferler")
        .upsert(rows, { onConflict: "sefer_no" })
        .select();
    if (error) throw error;
}

/**
 * Sefer detaylarını güvenli şekilde yükler.
 * - Numeric id gelirse doğrudan sefer_detaylari.sefer_id ile çeker.
 * - "SFR..." (sefer_no) gelirse önce seferler'den id'yi bulur, sonra detayları çeker.
 *
 * @param {number|string} seferRef id (number | "123") veya sefer_no ("SFR...")
 * @returns {Promise<Array>} sefer_detaylari satırları
 */
export async function loadDetaylar(seferRef) {
    try {
        // 1) Numeric id ise direkt kullan
        if (isNumericId(seferRef)) {
            const id = Number(seferRef);
            const { data, error } = await supabase
                .from("sefer_detaylari")
                .select("*")
                .eq("sefer_id", id)
                .order("nokta_sirasi", { ascending: true });

            if (error) throw error;
            return data || [];
        }

        // 2) "SFR..." gibi alfanümerik sefer_no ise önce id'yi bul
        const seferNo = String(seferRef ?? "").trim();
        if (!seferNo) return [];

        const { data: s, error: e1 } = await supabase
            .from("seferler")
            .select("id")
            .eq("sefer_no", seferNo)
            .maybeSingle();

        if (e1) throw e1;
        if (!s?.id) {
            console.warn("loadDetaylar: sefer bulunamadı:", seferNo);
            return [];
        }

        const { data, error } = await supabase
            .from("sefer_detaylari")
            .select("*")
            .eq("sefer_id", s.id) // bigint'e doğru değer
            .order("nokta_sirasi", { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error("loadDetaylar error:", err);
        return [];
    }
}

export async function updateSefer(id, payload) {
    const { error } = await supabase.from("seferler").update(payload).eq("id", id);
    if (error) throw error;
}

export async function upsertDetaylar(rows) {
    if (!rows?.length) return;
    const { error } = await supabase
        .from("sefer_detaylari")
        .upsert(rows, { onConflict: "sefer_id,nokta_sirasi" });
    if (error) throw error;
}

export async function moveToCompleted({ ana, detay }) {
    // ana: tamamlanan_seferler satırı (id, sefer_no, sefer_tarihi, ...)
    const { error: e1 } = await supabase
        .from("tamamlanan_seferler")
        .upsert(ana, { onConflict: "sefer_no" });
    if (e1) throw e1;

    if (detay?.length) {
        const { error: e2 } = await supabase
            .from("tamamlanan_detaylar")
            .upsert(detay, { onConflict: "sefer_no,nokta_sirasi" });
        if (e2) throw e2;
    }

    // Ardından aktif tablolardan sil
    await supabase.from("sefer_detaylari").delete().eq("sefer_id", ana.id);
    await supabase.from("seferler").delete().eq("id", ana.id);
}

/* ---------------- Mesafe Sorgusu ---------------- */

/**
 * Jokerli ILIKE kullanımı + boş/undefined değerleri sorguya eklememe
 * Örn. NEVŞEHİR / ACIGÖL / KIRKLARELİ / LÜLEBURGAZ gibi değerlerde 500 hatasını önler.
 */
export async function fetchMesafe({ yIl, yIlce, tIl, tIlce }) {
    const pat = (s) => `%${String(s ?? "").trim()}%`;

    let q = supabase.from("mesafeler").select("mesafe").limit(1);

    if (yIl) q = q.ilike("yukleme_il", pat(yIl));
    if (yIlce) q = q.ilike("yukleme_ilce", pat(yIlce));
    if (tIl) q = q.ilike("teslim_il", pat(tIl));
    if (tIlce) q = q.ilike("teslim_ilce", pat(tIlce));

    const { data, error } = await q.maybeSingle();

    if (error) {
        console.error("Supabase mesafeler error:", error);
        return null;
    }
    return data?.mesafe ?? null;
}
