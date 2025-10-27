import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.1.0";

// ====================================================================
// GEREKLİ ANAHTARLAR (Lütfen en güncel Service Key ile değiştirin)
// ====================================================================
const SUPABASE_URL = "https://feuqvkytwmmndrypqpyx.supabase.co";
const SERVICE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldXF2a3l0d21tbmRyeXBxcHl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTIyOTg2MywiZXhwIjoyMDY0ODA1ODYzfQ.XCOPl2Etb8gcP2epN4aQZoId4yYNlW2PqR7k9K2RsOI";
// ====================================================================

// ====================================================================
// Sabitler
// ====================================================================
const AVG_SPEED_KMPH = 65;
const BLOCK_MIN = 4.5 * 60; // 270 dk
const BREAK1_MIN = 45;
const DAILY_DRIVE_LIMIT = 9 * 60; // 540 dk (bilgilendirme)
const DAILY_REST_MIN = 11 * 60; // 660 dk

const ETA_STATUS = {
    WAITING_FIRST_YC: "WAITING_FIRST_YC",
    NEED_DISTANCE: "NEED_DISTANCE",
} as const;
const ETA_MESSAGES = {
    [ETA_STATUS.WAITING_FIRST_YC]: "Yükleme çıkış tarihi bekleniyor.",
    [ETA_STATUS.NEED_DISTANCE]: "Mesafe bulunamadı.",
};

// Türkiye sabit UTC+3 (DST yok)
const TRT_OFFSET_MIN = 180; // dakika
const MIN_TO_MS = 60000;

// ====================================================================
// Yardımcılar — TRT zaman hesabı (UTC+3 sabit)
// ====================================================================
function toLocalISO(date: Date | null) {
    if (!(date instanceof Date)) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    const dt = shiftToTRT(date);
    const y = dt.getUTCFullYear();
    const m = pad(dt.getUTCMonth() + 1);
    const d = pad(dt.getUTCDate());
    const h = pad(dt.getUTCHours());
    const min = pad(dt.getUTCMinutes());
    const s = pad(dt.getUTCSeconds());
    return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

function parseStartLocal(startISO?: string | null) {
    if (!startISO) return null;
    try {
        const localISOString =
            startISO.endsWith("Z") || startISO.includes("+") ? startISO : `${startISO}+03:00`;
        const d = new Date(localISOString);
        return Number.isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
}

function shiftToTRT(date: Date) {
    return new Date(date.getTime() + TRT_OFFSET_MIN * MIN_TO_MS);
}
function shiftFromTRT(dateTrtView: Date) {
    return new Date(dateTrtView.getTime() - TRT_OFFSET_MIN * MIN_TO_MS);
}
function getTRTParts(date: Date) {
    const d = shiftToTRT(date);
    return {
        day: d.getUTCDay(), // 0=Sun .. 6=Sat
        year: d.getUTCFullYear(),
        month: d.getUTCMonth(), // 0-11
        date: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        second: d.getUTCSeconds(),
    };
}
function setTRTTime(date: Date, hour: number, minute = 0, second = 0, ms = 0) {
    const trt = shiftToTRT(date);
    trt.setUTCHours(hour, minute, second, ms);
    return shiftFromTRT(trt);
}
function setTRTDateTime(
    date: Date,
    {
        year,
        month,
        day,
        hour = 0,
        minute = 0,
        second = 0,
        ms = 0,
    }: {
        year: number;
        month: number;
        day: number;
        hour?: number;
        minute?: number;
        second?: number;
        ms?: number;
    },
) {
    const trt = shiftToTRT(date);
    trt.setUTCFullYear(year);
    trt.setUTCMonth(month);
    trt.setUTCDate(day);
    trt.setUTCHours(hour, minute, second, ms);
    return shiftFromTRT(trt);
}
function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * MIN_TO_MS);
}

// ====================================================================
// Mesai devretme: 09:00–17:00 (TRT) dışında kalanı bir sonraki iş gününe taşı
// (Final adımda uygulanır; Cumartesi/Pazar özel kuralı sürüş döngüsü içinde ele alınır.)
// ====================================================================
function calculateNextStartTime(date: Date) {
    const parts = getTRTParts(date);
    const minutes = parts.hour * 60 + parts.minute;
    const MESAI_BASLANGIC_MIN = 9 * 60; // 09:00
    const MESAI_BITIS_MIN = 17 * 60; // 17:00

    // Hafta içi 09:00 öncesi → 09:00'a çek
    if (parts.day >= 1 && parts.day <= 6 && minutes < MESAI_BASLANGIC_MIN) {
        return setTRTTime(date, 9, 0, 0, 0);
    }

    // Pazar tamamen kapalı; Cumartesi mesai 09:00–17:00, sonrasında devret
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
        trt.setUTCHours(9, 0, 0, 0); // 09:00
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
// Cumartesi/Pazar kuralı yardımcıları
// ====================================================================
function minutesUntil(dateA: Date, dateB: Date) {
    return Math.floor((dateB.getTime() - dateA.getTime()) / MIN_TO_MS);
}

// Pazar sürüş yok → bir sonraki Pazartesi 09:00’a atla
function moveToNextMonday0900(base: Date) {
    const trt = shiftToTRT(base);
    const day = trt.getUTCDay(); // 0=Sun, 6=Sat
    let add = 0;
    if (day === 6) add = 2;      // Cumartesi → +2 gün
    else if (day === 0) add = 1; // Pazar → +1 gün
    else add = ((8 - day) % 7);  // emniyet: başka günse de bir sonraki Pazartesi
    trt.setUTCDate(trt.getUTCDate() + add);
    trt.setUTCHours(9, 0, 0, 0);
    return shiftFromTRT(trt);
}

// ====================================================================
// ETA Hesabı
// ====================================================================
function parseMesafeKm(v: unknown) {
    const s = String(v ?? "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

/**
 * Cumartesi/Pazar kuralı:
 * - Eğer başlangıç Pazar ise: direkt Pazartesi 09:00’da başla.
 * - Eğer başlangıç Cumartesi >= 17:00 ise: direkt Pazartesi 09:00’a atla.
 * - Eğer Cumartesi < 17:00’de başlarsa: 17:00’a kadar sür (mola/dinlenme dahil),
 *   17:00’da **Pazartesi 09:00**’a zıpla, sonra kalan yola devam.
 * Not: Bu atlama, 4.5s/45dk/11s kurallarından üstündür; 17:00’a gelindiği anda uygulanır.
 */
function computeETAWithKGMPlus(
    distanceKm: number,
    startISO: string,
    options: { startBreakMin?: number; dailyRestMin?: number } = {},
) {
    if (!distanceKm || !startISO) return { etaISO: null };

    const opt = {
        speedKmh: AVG_SPEED_KMPH,
        startBreakMin: options.startBreakMin || 0,
        dailyRestMin: options.dailyRestMin || DAILY_REST_MIN,
    };

    let t = parseStartLocal(startISO);
    if (!t) return { etaISO: null };

    // Başlangıç Pazar ise: Pazartesi 09:00’da başla
    if (getTRTParts(t).day === 0) {
        t = moveToNextMonday0900(t);
    }

    const kmPerMin = opt.speedKmh / 60;
    const processedDistanceKm = Math.round(distanceKm * 100) / 100;
    let remainingKm = Math.max(0, processedDistanceKm);

    // --- CUMARTESİ KURALI: Başlangıç anına göre ön-ayarlama ---
    let saturdayCutoff: Date | null = null;
    const startParts = getTRTParts(t);
    if (startParts.day === 6) {
        const saturday1700 = setTRTTime(t, 17, 0, 0, 0);
        if (t >= saturday1700) {
            // Pazar sürüş yok → direkt Pazartesi 09:00
            t = moveToNextMonday0900(t);
        } else {
            saturdayCutoff = saturday1700;
        }
    }

    // Opsiyonel başlangıç molası (Cumartesi bariyeriyle etkileşimli)
    const startBreakMin = Math.max(0, Number(opt.startBreakMin) || 0);
    if (startBreakMin > 0 && remainingKm > 0) {
        if (saturdayCutoff) {
            const untilCut = minutesUntil(t, saturdayCutoff);
            if (startBreakMin >= untilCut) {
                // Mola 17:00'ı aşıyor -> 17:00'da Pazartesi 09:00’a atla
                t = saturdayCutoff;
                t = moveToNextMonday0900(t);
                saturdayCutoff = null;
            } else {
                t = addMinutes(t, startBreakMin);
            }
        } else {
            t = addMinutes(t, startBreakMin);
        }
    }

    // Artışları Cumartesi 17:00 bariyeriyle güvenli uygula
    function applyIncrementWithSaturdayGuard(incrementMin: number, reducesKm: boolean) {
        if (incrementMin <= 0) return { cutApplied: false };

        if (saturdayCutoff) {
            const untilCut = minutesUntil(t, saturdayCutoff);
            if (untilCut <= 0) {
                // 17:00’a vurdu → Pazartesi 09:00’a atla
                t = moveToNextMonday0900(t);
                saturdayCutoff = null;
                return { cutApplied: true };
            }
            if (incrementMin > untilCut) {
                // Bariyeri aşacak → 17:00’a kadar uygula, sonra Pazartesi 09:00
                if (reducesKm) {
                    remainingKm -= untilCut * kmPerMin;
                }
                t = saturdayCutoff;             // 17:00'a gel
                t = moveToNextMonday0900(t);    // Pazar sürüş yok
                saturdayCutoff = null;
                return { cutApplied: true };
            }
        }

        if (reducesKm) {
            remainingKm -= incrementMin * kmPerMin;
        }
        t = addMinutes(t, incrementMin);
        return { cutApplied: false };
    }

    // Gün kuralı: 4.5 saat sürüş → 45 dk mola → 4.5 saat sürüş → 11 saat dinlenme
    while (remainingKm > 0.0001) {
        // --- 1. BLOK ---
        let needMin = Math.ceil(remainingKm / kmPerMin);
        let drive1 = Math.min(BLOCK_MIN, needMin);

        let res = applyIncrementWithSaturdayGuard(drive1, true);
        if (remainingKm <= 0.0001) break;
        if (res.cutApplied) continue;

        // --- ZORUNLU MOLA ---
        res = applyIncrementWithSaturdayGuard(BREAK1_MIN, false);
        if (remainingKm <= 0.0001) break;
        if (res.cutApplied) continue;

        // --- 2. BLOK ---
        needMin = Math.ceil(remainingKm / kmPerMin);
        let drive2 = Math.min(BLOCK_MIN, needMin);
        res = applyIncrementWithSaturdayGuard(drive2, true);
        if (remainingKm <= 0.0001) break;
        if (res.cutApplied) continue;

        // --- GÜNLÜK DİNLENME ---
        res = applyIncrementWithSaturdayGuard(opt.dailyRestMin, false);
        if (res.cutApplied) continue;
    }

    // FINAL: Mesai/hafta sonu devrini yalnızca sonda uygula
    t = calculateNextStartTime(t);
    return { etaISO: toLocalISO(t) };
}

// ====================================================================
// Supabase İşleyici
// ====================================================================
async function runEtaProcessor(supabaseClient: ReturnType<typeof createClient>) {
    console.log("[ETA Processor] Çalışıyor...");
    try {
        const { data: seferler, error } = await supabaseClient
            .from("seferler")
            .select(
                `
        id,
        sefer_no,
        mesafe,
        kalan_surus_dk,
        eta_mola_dk,
        eta_varis,
        eta_note,
        noktalar:sefer_detaylari(nokta_sirasi, yukleme_cikis)
      `,
            )
            .eq("eta_gerekli_mi", true)
            .limit(20);

        if (error) {
            console.error("[ETA Processor] Veri çekme hatası:", error);
            return;
        }
        if (!seferler || seferler.length === 0) {
            console.log("[ETA Processor] Hesaplama gerektiren sefer yok.");
            return;
        }
        console.log(`[ETA Processor] ${seferler.length} adet sefer işleniyor...`);

        const updates: Array<Record<string, unknown>> = [];
        for (const sefer of seferler as any[]) {
            const rowId = sefer.id;
            const km = parseMesafeKm(sefer.mesafe);

            const noktalarSorted = (sefer.noktalar || []).sort(
                (a: any, b: any) => a.nokta_sirasi - b.nokta_sirasi,
            );
            const firstYC = noktalarSorted.find((n: any) => n?.yukleme_cikis)?.yukleme_cikis;

            let ycISO: Date | null = null;
            if (firstYC) {
                const parsedDate = parseStartLocal(firstYC);
                if (parsedDate && !isNaN(parsedDate.getTime())) ycISO = parsedDate;
            }

            let newETA: string | null = null;
            let newNote: string | null = null;
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
                    console.log(
                        `[DEBUG] Sefer ID: ${rowId} - Mesafe: ${realDistanceKm} km, Başlangıç: ${firstYC}`,
                    );

                    const { etaISO } = computeETAWithKGMPlus(realDistanceKm, firstYC, {
                        // Not: initialRemainMin kullanılmıyor; günlük kural sabit 4.5/45/4.5/11
                        startBreakMin,
                    });

                    newETA = etaISO || null;
                    newNote = null;
                } catch (e: any) {
                    console.error(
                        `[ETA Processor] Hesaplama hatası (Sefer ID: ${rowId}):`,
                        e,
                    );
                    newNote =
                        "Hesaplama Hatası: " + (e?.message || "Bilinmiyor").substring(0, 50);
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
            const { error: updateError } = await supabaseClient
                .from("seferler")
                .upsert(updates, { onConflict: "id" });
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
// ANA EDGE FUNCTION İŞLEYİCİSİ (Deno Runtime için)
// ====================================================================
serve(async (_req) => {
    try {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        await runEtaProcessor(supabase);

        return new Response(
            JSON.stringify({ message: "ETA Processor successfully completed." }),
            {
                headers: { "Content-Type": "application/json" },
                status: 200,
            },
        );
    } catch (error: any) {
        console.error("ETA Processor Error:", error);
        return new Response(
            JSON.stringify({ error: error?.message || "Internal Server Error" }),
            {
                headers: { "Content-Type": "application/json" },
                status: 500,
            },
        );
    }
});
