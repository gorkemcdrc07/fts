import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.1.0";

// ====================================================================
// GEREKLİ ANAHTARLAR (Doğrudan Koda Gömmek)
// ====================================================================
// NOT: Bu anahtarlar, önceki mesajlarınızdan aldığım değerlerdir.
const SUPABASE_URL = 'https://feuqvkytwmmndrypqpyx.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldXF2a3l0d21tbmRyeXBxcHl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTIyOTg2MywiZXhwIjoyMDY0ODA1ODYzfQ.XCOPl2Etb8gcP2epN4aQZoId4yYNlW2PqR7k9K2RsOI';
// ====================================================================

const AVG_SPEED_KMPH = 65;
const BLOCK_MIN = 4.5 * 60;
const BREAK1_MIN = 45;
const DAILY_DRIVE_LIMIT = 9 * 60;
const DAILY_REST_MIN = 11 * 60;

const ETA_STATUS = { WAITING_FIRST_YC: "WAITING_FIRST_YC", NEED_DISTANCE: "NEED_DISTANCE" };
const ETA_MESSAGES = { [ETA_STATUS.WAITING_FIRST_YC]: "Yükleme çıkış tarihi bekleniyor.", [ETA_STATUS.NEED_DISTANCE]: "Mesafe bulunamadı." };

const parseMesafeKm = (v) => {
    const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", "."));
    if (typeof n === "number" && n > 1000 && Number.isInteger(n)) return n / 100;
    return Number.isFinite(n) ? n : null;
};
function toLocalISO(date) {
    if (!(date instanceof Date)) return null;
    const pad = (n) => String(n).padStart(2, "0");
    const y = date.getFullYear(); const m = pad(date.getMonth() + 1); const d = pad(date.getDate());
    const h = pad(date.getHours()); const min = pad(date.getMinutes()); const s = pad(date.getSeconds());
    return `${y}-${m}-${d}T${h}:${min}:${s}`;
}
function parseStartLocal(startISO) {
    if (!startISO) return null;
    try {
        const d = new Date(startISO);
        return Number.isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
}
function applySaturdayRule(date) {
    const d = new Date(date);
    if (d.getDay() === 6) {
        const minutes = d.getHours() * 60 + d.getMinutes();
        if (minutes >= 12 * 60) {
            d.setDate(d.getDate() + 1);
            d.setHours(0, 0, 0, 0);
        }
    }
    return d;
}
function calculateNextStartTime(date) {
    const d = new Date(date); const day = d.getDay(); const hour = d.getHours(); const minToMs = (m) => m * 60000;
    if (day === 0) { let targetDate = new Date(d); targetDate.setDate(targetDate.getDate() + 1); targetDate.setHours(8, 0, 0, 0); return targetDate; }
    if (day === 6) { if (hour >= 17) { let targetDate = new Date(d); targetDate.setTime(d.getTime() + minToMs(1) - (d.getHours() * 60 + d.getMinutes()) * 60000); targetDate.setDate(targetDate.getDate() + 2); targetDate.setHours(8, 0, 0, 0); return targetDate; } if (hour < 8) { let targetDate = new Date(d); targetDate.setHours(8, 0, 0, 0); return targetDate; } return d; }
    if (day >= 1 && day <= 5) { if (hour >= 17) { let targetDate = new Date(d); targetDate.setDate(targetDate.getDate() + 1); targetDate.setHours(8, 0, 0, 0); return targetDate; } if (hour < 8) { let targetDate = new Date(d); targetDate.setHours(8, 0, 0, 0); return targetDate; } return d; } return d;
}
function computeETAWithKGMPlus(distanceKm, startISO, options = {}) {
    if (!distanceKm || !startISO) return { etaISO: null };
    const opt = { speedKmh: AVG_SPEED_KMPH, initialRemainMin: options.initialRemainMin || DAILY_DRIVE_LIMIT, startBreakMin: options.startBreakMin || 0, dailyDriveLimitMin: DAILY_DRIVE_LIMIT, dailyRestMin: 11 * 60, allowSplitBreak: true, };
    let start = parseStartLocal(startISO); if (!start) return { etaISO: null };
    start = applySaturdayRule(start); const kmPerMin = opt.speedKmh / 60; let remainingKm = Math.max(0, distanceKm); let t = new Date(start); let remainInDay = opt.initialRemainMin; let remainToBlockBreak = 4.5 * 60;
    const minToMs = (m) => m * 60000; const addMinutes = (date, m) => new Date(date.getTime() + minToMs(m)); const todayRest = () => opt.dailyRestMin; let split = { pendingSecondPart30: false, minutesDrivenSince15: 0 };
    const startBreakMin = Math.max(0, Number(opt.startBreakMin) || 0);
    if (startBreakMin > 0 && remainingKm > 0) { t = addMinutes(t, startBreakMin); remainInDay = opt.dailyDriveLimitMin; remainToBlockBreak = 4.5 * 60; }
    while (remainingKm > 0.01) {
        if (remainInDay <= 0) { const restMin = todayRest(); let potentialNextStart = addMinutes(t, restMin); let actualNextStart = calculateNextStartTime(potentialNextStart); t = actualNextStart; remainInDay = opt.dailyDriveLimitMin; remainToBlockBreak = 4.5 * 60; split = { pendingSecondPart30: false, minutesDrivenSince15: 0 }; continue; }
        if (remainToBlockBreak <= 0) { if (opt.allowSplitBreak && !split.pendingSecondPart30) { t = addMinutes(t, 15); split.pendingSecondPart30 = true; split.minutesDrivenSince15 = 0; remainToBlockBreak = 4.5 * 60; continue; } const breakMin = split.pendingSecondPart30 ? 30 : 45; t = addMinutes(t, breakMin); split.pendingSecondPart30 = false; split.minutesDrivenSince15 = 0; remainToBlockBreak = 4.5 * 60; continue; }
        if (opt.allowSplitBreak && split.pendingSecondPart30 && split.minutesDrivenSince15 >= 4.5 * 60) { t = addMinutes(t, 30); split.pendingSecondPart30 = false; split.minutesDrivenSince15 = 0; remainToBlockBreak = 4.5 * 60; continue; }
        const canDriveMin = Math.min(remainToBlockBreak, remainInDay); const canDriveKm = canDriveMin * kmPerMin; const driveKm = Math.min(remainingKm, canDriveKm); const driveMin = Math.max(1, Math.round(driveKm / kmPerMin));
        t = addMinutes(t, driveMin); remainingKm -= driveKm; remainToBlockBreak -= driveMin; remainInDay -= driveMin; if (split.pendingSecondPart30) split.minutesDrivenSince15 += driveMin; if (remainingKm <= 0.01) break;
    }
    t = calculateNextStartTime(t); return { etaISO: toLocalISO(t) };
}
async function runEtaProcessor(supabaseClient) {
    console.log("[ETA Processor] Çalışıyor...");
    try {
        const { data: seferler, error } = await supabaseClient.from("seferler")
            .select(`id, sefer_no, mesafe, kalan_surus_dk, eta_mola_dk, eta_varis, eta_note, noktalar:sefer_detaylari(nokta_sirasi, yukleme_cikis)`)
            .eq("eta_gerekli_mi", true)
            .ilike("sefer_no", "SFR%") // 🔥 SADECE SFR SEFERLERİNİ İŞLE
            .limit(20);

        if (error) { console.error("[ETA Processor] Veri çekme hatası:", error); return; }
        if (!seferler || seferler.length === 0) { console.log("[ETA Processor] Hesaplama gerektiren SFR seferi yok."); return; }
        console.log(`[ETA Processor] ${seferler.length} adet SFR seferi işleniyor...`);

        const updates = [];
        for (const sefer of seferler) {
            const rowId = sefer.id; const km = parseMesafeKm(sefer.mesafe);
            const noktalarSorted = (sefer.noktalar || []).sort((a, b) => a.nokta_sirasi - b.nokta_sirasi);
            const firstYC = noktalarSorted.find(n => n?.yukleme_cikis)?.yukleme_cikis;
            let ycISO = null;
            if (firstYC) {
                const parsedDate = parseStartLocal(firstYC);
                if (parsedDate && !isNaN(parsedDate.getTime())) ycISO = parsedDate;
            }
            let newETA = null; let newNote = null;
            const hasKm = km && km > 0; const hasYC = Boolean(ycISO);

            if (!hasYC) { newNote = ETA_MESSAGES[ETA_STATUS.WAITING_FIRST_YC]; }
            else if (!hasKm) { newNote = ETA_MESSAGES[ETA_STATUS.NEED_DISTANCE]; }
            else {
                // Her iki veri de var, ETA'yı hesapla
                try {
                    const initialRemain = Number(sefer.kalan_surus_dk) || 9 * 60; const startBreakMin = Number(sefer.eta_mola_dk) || 0;
                    const { etaISO } = computeETAWithKGMPlus(km, ycISO.toISOString(), { initialRemainMin: initialRemain, startBreakMin: startBreakMin, });
                    newETA = etaISO || null; newNote = null;
                } catch (e) {
                    console.error(`[ETA Processor] Hesaplama hatası (Sefer ID: ${rowId}):`, e);
                    newNote = "Hesaplama Hatası: " + (e.message || 'Bilinmiyor').substring(0, 50);
                }
            }

            // 🔥 GÜNCELLEME PAKETİ: Sadece ETA ile ilgili 4 alanı gönder (arac_statu hatası çözüldü)
            updates.push({
                id: rowId,
                eta_varis: newETA,
                eta_note: newNote,
                eta_gerekli_mi: false, // İşlendi
                kayit_zamani: new Date().toISOString(),
            });
        }
        if (updates.length > 0) {
            const { error: updateError } = await supabaseClient.from("seferler").upsert(updates, { onConflict: 'id' });
            if (updateError) {
                console.error("[ETA Processor] Toplu güncelleme hatası:", updateError);
            }
            else { console.log(`[ETA Processor] ${updates.length} adet sefer güncellendi.`); }
        }
        console.log("[ETA Processor] Tamamlandı.");
    } catch (globalError) {
        console.error("KRİTİK HATA: Cron İşleyici başarısız oldu:", globalError);
    }
}
// ====================================================================
// 3. ANA EDGE FUNCTION İŞLEYİCİSİ (Deno Runtime için)
// ====================================================================

serve(async (req) => {
    try {
        // Supabase client'ı Service Key ile oluşturulur (Doğrudan sabitler kullanılır)
        const supabase = createClient(
            SUPABASE_URL,
            SERVICE_KEY
        );

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
