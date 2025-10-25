import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.1.0";

// ====================================================================
// GEREKLİ ANAHTARLAR (Lütfen en güncel Service Key ile değiştirin)
// ====================================================================
const SUPABASE_URL = 'https://feuqvkytwmmndrypqpyx.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldXF2a3l0d21tbmRyeXBxcHl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTIyOTg2MywiZXhwIjoyMDY0ODA1ODYzfQ.XCOPl2Etb8gcP2epN4aQZoId4yYNlW2PqR7k9K2RsOI';
// ====================================================================

// ====================================================================
// Sabitler
// ====================================================================
const AVG_SPEED_KMPH = 65;
const BLOCK_MIN = 4.5 * 60; // 270 dk
const BREAK1_MIN = 45;
const DAILY_DRIVE_LIMIT = 9 * 60; // 540 dk
const DAILY_REST_MIN = 11 * 60; // 660 dk

const ETA_STATUS = { WAITING_FIRST_YC: "WAITING_FIRST_YC", NEED_DISTANCE: "NEED_DISTANCE" };
const ETA_MESSAGES = { [ETA_STATUS.WAITING_FIRST_YC]: "Yükleme çıkış tarihi bekleniyor.", [ETA_STATUS.NEED_DISTANCE]: "Mesafe bulunamadı." };

// Türkiye sabit UTC+3 (DST yok)
const TRT_OFFSET_MIN = 180; // dakika
const MIN_TO_MS = 60000;

// ====================================================================
// Yardımcılar — TRT zaman hesabı (UTC+3 sabit)
// ====================================================================
function toLocalISO(date) {
    if (!(date instanceof Date)) return null;
    const pad = (n) => String(n).padStart(2, "0");
    // ISO'yu offset'siz (yerel) döndür.
    const dt = shiftToTRT(date);
    const y = dt.getUTCFullYear();
    const m = pad(dt.getUTCMonth() + 1);
    const d = pad(dt.getUTCDate());
    const h = pad(dt.getUTCHours());
    const min = pad(dt.getUTCMinutes());
    const s = pad(dt.getUTCSeconds());
    return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

function parseStartLocal(startISO) {
    if (!startISO) return null;
    try {
        // ISO string'e +03:00 ekle
        const localISOString = startISO.endsWith('Z') || startISO.includes('+') ? startISO : `${startISO}+03:00`;
        const d = new Date(localISOString);
        return Number.isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
}

function shiftToTRT(date) {
    // UTC zamanı TRT görünümüne kaydır (yalnızca alanları okumak için)
    return new Date(date.getTime() + TRT_OFFSET_MIN * MIN_TO_MS);
}
function shiftFromTRT(dateTrtView) {
    // TRT görünümünden UTC epoch'a geri dön
    return new Date(dateTrtView.getTime() - TRT_OFFSET_MIN * MIN_TO_MS);
}
function getTRTParts(date) {
    const d = shiftToTRT(date);
    return {
        day: d.getUTCDay(),
        year: d.getUTCFullYear(),
        month: d.getUTCMonth(), // 0-11
        date: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        second: d.getUTCSeconds(),
    };
}
function setTRTTime(date, hour, minute = 0, second = 0, ms = 0) {
    const trt = shiftToTRT(date);
    trt.setUTCHours(hour, minute, second, ms);
    return shiftFromTRT(trt);
}
function setTRTDateTime(date, { year, month, day, hour = 0, minute = 0, second = 0, ms = 0 }) {
    const trt = shiftToTRT(date);
    trt.setUTCFullYear(year);
    trt.setUTCMonth(month);
    trt.setUTCDate(day);
    trt.setUTCHours(hour, minute, second, ms);
    return shiftFromTRT(trt);
}
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * MIN_TO_MS);
}

// ====================================================================
// Kurallar
// ====================================================================
function applySaturdayStartRule(date) {
    const parts = getTRTParts(date);
    // Cumartesi (6) 12:00 ve sonrası → Pazartesi 08:00
    if (parts.day === 6 && (parts.hour > 11 || (parts.hour === 11 && parts.minute >= 60))) {
        // Pazartesi'ye atla
        // Cumartesi -> Pazar(+1) -> Pazartesi(+2)
        const trt = shiftToTRT(date);
        trt.setUTCDate(trt.getUTCDate() + 2);
        trt.setUTCHours(8, 0, 0, 0);
        return shiftFromTRT(trt);
    }
    return date;
}

// Mesai devretme: 08:00–17:00 (TRT) dışında kalanı bir sonraki iş gününe taşı
function calculateNextStartTime(date) {
    const parts = getTRTParts(date);
    const minutes = parts.hour * 60 + parts.minute;
    const MESAI_BASLANGIC_MIN = 8 * 60; // 08:00
    const MESAI_BITIS_MIN = 17 * 60; // 17:00

    // Hafta içi 08:00 öncesi → 08:00'e çek
    if (parts.day >= 1 && parts.day <= 6 && minutes < MESAI_BASLANGIC_MIN) {
        return setTRTTime(date, 8, 0, 0, 0);
    }

    // Pazar tamamen kapalı; Cumartesi mesai 08:00–17:00, sonrasında devret
    const isWorkday = parts.day >= 1 && parts.day <= 6; // 1=Mon .. 6=Sat

    if ((isWorkday && minutes >= MESAI_BITIS_MIN) || parts.day === 0) {
        let target = date;
        let minutesToCarryOver = 0;

        // 17:00 sonrası aşan süreyi devret
        if (isWorkday && minutes > MESAI_BITIS_MIN) {
            minutesToCarryOver = minutes - MESAI_BITIS_MIN;
            target = setTRTTime(target, 17, 0, 0, 0);
        }

        // Bir sonraki mesai başlangıcını bul
        const trt = shiftToTRT(target);
        let daysToAdd = 1; // default ertesi gün
        const day = trt.getUTCDay();
        if (day === 5) daysToAdd = 3; // Cuma -> Pazartesi
        if (day === 6) daysToAdd = 2; // Cumartesi -> Pazartesi
        if (day === 0) daysToAdd = 1; // Pazar -> Pazartesi

        trt.setUTCDate(trt.getUTCDate() + daysToAdd);
        trt.setUTCHours(8, 0, 0, 0);
        target = shiftFromTRT(trt);

        if (minutesToCarryOver > 0) {
            target = addMinutes(target, minutesToCarryOver);
            // Zincirleme taşma olursa yeniden kontrol et
            return calculateNextStartTime(target);
        }
        return target;
    }

    // Mesai içindeyse dokunma
    return date;
}

// ====================================================================
// ETA Hesabı
// ====================================================================
function parseMesafeKm(v) {
    const s = String(v ?? "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

function computeETAWithKGMPlus(distanceKm, startISO, options = {}) {
    if (!distanceKm || !startISO) return { etaISO: null };

    const opt = {
        speedKmh: AVG_SPEED_KMPH,
        startBreakMin: options.startBreakMin || 0,
        dailyRestMin: DAILY_REST_MIN,
    };

    let t = parseStartLocal(startISO);
    if (!t) return { etaISO: null };

    // KULLANICI KURALI: Sürüş ve molalar normal akışla hesaplanır;
    // mesai devri SADECE finalde uygulanır.

    const kmPerMin = opt.speedKmh / 60;
    const processedDistanceKm = Math.round(distanceKm * 100) / 100;
    let remainingKm = Math.max(0, processedDistanceKm);

    // Opsiyonel başlangıç molası
    const startBreakMin = Math.max(0, Number(opt.startBreakMin) || 0);
    if (startBreakMin > 0 && remainingKm > 0) {
        t = addMinutes(t, startBreakMin);
    }

    // Gün kuralı: 4.5 saat sürüş → 45 dk mola → 4.5 saat sürüş → 11 saat dinlenme
    while (remainingKm > 0.0001) {
        // --- 1. BLOK (4.5 saat veya varışa kadar) ---
        let needMin = Math.ceil(remainingKm / kmPerMin);
        let drive1 = Math.min(BLOCK_MIN, needMin);
        t = addMinutes(t, drive1);
        remainingKm -= drive1 * kmPerMin;
        if (remainingKm <= 0.0001) break; // varış

        // --- ZORUNLU MOLA (45 dk) ---
        t = addMinutes(t, BREAK1_MIN);

        // --- 2. BLOK (4.5 saat veya varışa kadar) ---
        needMin = Math.ceil(remainingKm / kmPerMin);
        let drive2 = Math.min(BLOCK_MIN, needMin);
        t = addMinutes(t, drive2);
        remainingKm -= drive2 * kmPerMin;
        if (remainingKm <= 0.0001) break; // varış

        // --- GÜNLÜK DİNLENME (11 saat) ---
        t = addMinutes(t, opt.dailyRestMin);
    }

    // FINAL: Mesai/hafta sonu devri yalnızca burada uygulanır
    t = calculateNextStartTime(t);
    return { etaISO: toLocalISO(t) };
}

// ====================================================================
// Supabase İşleyici
// ====================================================================
async function runEtaProcessor(supabaseClient) {
    console.log("[ETA Processor] Çalışıyor...");
    try {
        const { data: seferler, error } = await supabaseClient
            .from("seferler")
            .select(`id, sefer_no, mesafe, kalan_surus_dk, eta_mola_dk, eta_varis, eta_note, noktalar:sefer_detaylari(nokta_sirasi, yukleme_cikis)`) // ilişkisel
            .eq("eta_gerekli_mi", true)
            .limit(20);

        if (error) { console.error("[ETA Processor] Veri çekme hatası:", error); return; }
        if (!seferler || seferler.length === 0) { console.log("[ETA Processor] Hesaplama gerektiren sefer yok."); return; }
        console.log(`[ETA Processor] ${seferler.length} adet sefer işleniyor...`);

        const updates = [];
        for (const sefer of seferler) {
            const rowId = sefer.id;
            const km = parseMesafeKm(sefer.mesafe);

            const noktalarSorted = (sefer.noktalar || []).sort((a, b) => a.nokta_sirasi - b.nokta_sirasi);
            const firstYC = noktalarSorted.find(n => n?.yukleme_cikis)?.yukleme_cikis;

            let ycISO = null;
            if (firstYC) {
                const parsedDate = parseStartLocal(firstYC);
                if (parsedDate && !isNaN(parsedDate.getTime())) ycISO = parsedDate;
            }

            let newETA = null;
            let newNote = null;
            const hasKm = km && km > 0;
            const hasYC = Boolean(ycISO);

            if (!hasYC) {
                newNote = ETA_MESSAGES[ETA_STATUS.WAITING_FIRST_YC];
            } else if (!hasKm) {
                newNote = ETA_MESSAGES[ETA_STATUS.NEED_DISTANCE];
            } else {
                try {
                    const initialRemain = Number(sefer.kalan_surus_dk) || DAILY_DRIVE_LIMIT;
                    const startBreakMin = Number(sefer.eta_mola_dk) || 0;

                    const realDistanceKm = Number(km);
                    console.log(`[DEBUG] Sefer ID: ${rowId} - Mesafe: ${realDistanceKm} km, Başlangıç: ${firstYC}`);

                    const { etaISO } = computeETAWithKGMPlus(realDistanceKm, firstYC, {
                        initialRemainMin: initialRemain,
                        startBreakMin: startBreakMin,
                    });

                    newETA = etaISO || null; newNote = null;
                } catch (e) {
                    console.error(`[ETA Processor] Hesaplama hatası (Sefer ID: ${rowId}):`, e);
                    newNote = "Hesaplama Hatası: " + (e.message || 'Bilinmiyor').substring(0, 50);
                }
            }

            updates.push({
                id: rowId,
                eta_varis: newETA,
                eta_note: newNote,
                eta_gerekli_mi: false, // işlendi
                kayit_zamani: new Date().toISOString(),
            });
        }

        if (updates.length > 0) {
            const { error: updateError } = await supabaseClient.from("seferler").upsert(updates, { onConflict: 'id' });
            if (updateError) {
                console.error("[ETA Processor] Toplu güncelleme hatası:", updateError);
            } else {
                console.log(`[ETA Processor] ${updates.length} adet sefer güncellendi.`);
            }
        }

        console.log("[ETA Processor] Tamamlandı.");
    } catch (globalError) {
        console.error("KRİTİK HATA: Cron İşleyici başarısız oldu:", globalError);
    }
}

// ====================================================================
// 3. ANA EDGE FUNCTION İŞLEYİCİSİ (Deno Runtime için)
// ====================================================================
serve(async (_req) => {
    try {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        await runEtaProcessor(supabase);

        return new Response(JSON.stringify({ message: "ETA Processor successfully completed." }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("ETA Processor Error:", error);
        return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
});
