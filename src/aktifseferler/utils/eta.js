// src/aktifseferler/utils/eta.js
import { toLocalISO } from "./datetime";

// === Sabitler (default) ===
export const AVG_SPEED_KMPH = 65;      // Ortalama hız
export const BLOCK_MIN = 4.5 * 60;     // 4s30dk = 270dk
export const BREAK1_MIN = 45;          // 45dk tam mola
export const DAILY_REST_MIN = 11 * 60; // 11 saat günlük dinlenme
export const REDUCED_DAILY_REST_MIN = 9 * 60; // 9 saat (opsiyonel kullanım)

// Haftalık/iki haftalık yasal sınırlar (opsiyonel)
export const WEEKLY_LIMIT_MIN = 56 * 60;     // 56 saat
export const FORTNIGHT_LIMIT_MIN = 90 * 60;  // 90 saat (son 2 hafta)

// UI yardımcıları
export const parseHHMMtoMin = (txt) => {
    const [h = "0", m = "0"] = String(txt || "").split(":");
    let H = parseInt(h, 10) || 0;
    let M = parseInt(m, 10) || 0;
    if (M >= 60) { H += Math.floor(M / 60); M = M % 60; }
    if (H < 0 || M < 0) { H = Math.max(0, H); M = Math.max(0, M); }
    return H * 60 + M;
};

// "1.685,69" -> 1685.69
export const parseMesafeKm = (v) => {
    const s = String(v ?? "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
};

// Format yardımcıları (internal)
const minToMs = (m) => m * 60000;
const ceilDiv = (a, b) => Math.ceil(a / b);

// === Opsiyonlar ===
// Bu yapı ile gerçek hayattaki toleransları açıp/kapayabiliyoruz:
export const defaultRegOptions = {
    speedKmh: AVG_SPEED_KMPH,

    // Başlangıçta ilk molaya kadar kalan sürüş (dk) – ör: takograf “kalan sürüş” bilgisi
    initialRemainMin: BLOCK_MIN,

    // 45dk molayı 15 + 30 şeklinde bölmeye izin ver
    allowSplitBreak: true,

    // Günlük sürüş limiti (dk). 9h standart, extendedDailyDrive ile 10h yapılabilir
    dailyDriveLimitMin: 9 * 60,
    allowExtendedDailyDrive: true, // o gün bir defa 10 saate uzat
    useExtendedToday: false,       // çağrı bazında “bugün uzat” işareti

    // Günlük dinlenme
    dailyRestMin: DAILY_REST_MIN,
    allowReducedDailyRest: true,   // 9h’a düşürülebilir mi?
    useReducedRestToday: false,    // çağrı bazında “bugün kısalt” işareti

    // Haftalık / iki haftalık limitleri takip etmek istersen aç
    enforceWeeklyLimits: false,
    weeklyLimitMin: WEEKLY_LIMIT_MIN,
    fortnightLimitMin: FORTNIGHT_LIMIT_MIN,
    // Bu ikisini doğru saymak için dışarıdan mevcut haftalık/2 haftalık sürüş toplamlarını (dk) geçebilirsin
    currentWeekDrivenMin: 0,
    currentFortnightDrivenMin: 0,
};

// Split break durum takibi için küçük bir state
function makeSplitState() {
    return {
        // 45 dakikayı 15+30 bölüyorsak, önce 15 verilip “kalan 30” zorunluluğunu işaretleriz
        pendingSecondPart30: false,     // 30dk ikinci parça gerekiyor mu?
        minutesDrivenSince15: 0,        // 15'likten sonra kaç dk sürüldü (maks 4.5h içinde 30 alınmalı)
    };
}

/**
 * computeETAWithKGMPlus:
 * - 4.5h sürüş -> 45dk mola -> 4.5h sürüş -> 11h günlük dinlenme (temel)
 * - Opsiyonlarla: 45dk split (15+30), günlük sürüşü 10h’a uzatma, günlük dinlenmeyi 9h’a düşürme
 * - İsteğe bağlı haftalık/2 haftalık limit kontrolü
 *
 * distanceKm:   Toplam mesafe (km)
 * startISO:     Başlangıç (ISO)
 * options:      defaultRegOptions + bayraklar
 *
 * DÖNÜŞ: { etaISO, meta }
 *  - etaISO: Varış zamanı ISO (YEREL)  ← 🔴 Artık toLocalISO ile döner
 *  - meta: simülasyon bilgisi (toplam sürüş dk, mola/dinlenme dk, kaç kez uzatma vs.)
 */
export function computeETAWithKGMPlus(distanceKm, startISO, options = {}) {
    if (!distanceKm || !startISO) return { etaISO: null, meta: null };

    const opt = { ...defaultRegOptions, ...options };
    const start = new Date(startISO);
    if (Number.isNaN(start.getTime())) return { etaISO: null, meta: null };

    // hız ve km/dk
    const kmPerMin = opt.speedKmh / 60;
    let remainingKm = Math.max(0, distanceKm);

    // zaman ve sayaçlar
    let t = new Date(start);
    let remainToBreak = Math.max(0, opt.initialRemainMin); // ilk mola öncesi kalan
    let drivenTodayMin = 0;        // bugünkü sürüş (gün içi)
    let dayExtendedUsed = false;   // bugünde 10h uzatma kullanıldı mı
    let split = makeSplitState();  // split break izleme

    // haftalık limitler (opsiyonel)
    let weekDriven = opt.currentWeekDrivenMin || 0;
    let fortnightDriven = opt.currentFortnightDrivenMin || 0;

    // rapor
    let totalDriveMin = 0;
    let totalBreakMin = 0;
    let totalRestMin = 0;

    // küçük yardımcılar
    const addMinutes = (date, m) => new Date(date.getTime() + minToMs(m));
    const canExtendToday = () => opt.allowExtendedDailyDrive && !dayExtendedUsed && opt.useExtendedToday;
    const todayLimit = () => (canExtendToday() ? 10 * 60 : opt.dailyDriveLimitMin);
    const todayRest = () => (opt.allowReducedDailyRest && opt.useReducedRestToday ? REDUCED_DAILY_REST_MIN : opt.dailyRestMin);

    // Haftalık limit kısıtına takılıyorsak, erişilebilir maksimum dakika:
    const clampByWeekly = (driveMin) => {
        if (!opt.enforceWeeklyLimits) return driveMin;
        const weekRemain = Math.max(0, opt.weeklyLimitMin - weekDriven);
        const fnRemain = Math.max(0, opt.fortnightLimitMin - fortnightDriven);
        return Math.max(0, Math.min(driveMin, weekRemain, fnRemain));
    };

    // Split break gereği 15dk aldıktan sonra (pendingSecondPart30 = true) 4.5h içinde 30dk daha aldır
    const needSecondPartNow = () => {
        if (!opt.allowSplitBreak) return false;
        if (!split.pendingSecondPart30) return false;
        // 15'likten sonra süre 4.5h (270dk) içinde bir noktada 30 alınmalı.
        // Basit model: “bir sonraki mola ihtiyacında 30’u uygula”; 4.5h dolduysa kesin uygula.
        return split.minutesDrivenSince15 >= BLOCK_MIN;
    };

    while (remainingKm > 0.01) {
        // Günlük sürüş üstüne çıkma
        const remainInDay = todayLimit() - drivenTodayMin;
        if (remainInDay <= 0) {
            // Günlük dinlenme
            const restMin = todayRest();
            t = addMinutes(t, restMin);
            totalRestMin += restMin;

            // yeni gün
            drivenTodayMin = 0;
            dayExtendedUsed = dayExtendedUsed || opt.useExtendedToday; // o gün uzatma kullanıldıysa işaret kalır
            remainToBreak = BLOCK_MIN;
            split = makeSplitState();
            continue;
        }

        // Mola kontrolü: kırılma anı
        if (remainToBreak <= 0) {
            // Eğer split break kullanılıyorsa:
            if (opt.allowSplitBreak && !split.pendingSecondPart30) {
                // Önce 15dk al, ikinci parça borcunu işaretle
                t = addMinutes(t, 15);
                totalBreakMin += 15;
                split.pendingSecondPart30 = true;
                split.minutesDrivenSince15 = 0;
                remainToBreak = BLOCK_MIN; // 15'ten sonra sayaç sıfırlanır
                continue;
            }

            // Eğer ikinci parça (30dk) zorunlu hale geldiyse veya split yoksa 45dk tam mola ver
            const breakMin = split.pendingSecondPart30 ? 30 : BREAK1_MIN;
            t = addMinutes(t, breakMin);
            totalBreakMin += breakMin;

            if (split.pendingSecondPart30) {
                // 30'luk ikinci parçayı tamamladık
                split.pendingSecondPart30 = false;
                split.minutesDrivenSince15 = 0;
            }

            // Moladan sonra sayaç sıfır
            remainToBreak = BLOCK_MIN;
            continue;
        }

        // Gerekiyorsa ikinci parça 30'u zorla
        if (needSecondPartNow()) {
            t = addMinutes(t, 30);
            totalBreakMin += 30;
            split.pendingSecondPart30 = false;
            split.minutesDrivenSince15 = 0;
            remainToBreak = BLOCK_MIN;
            continue;
        }

        // Bu dakika aralığında sürülebilecek teorik süre
        let canDriveMin = Math.min(remainToBreak, remainInDay);

        // Haftalık limit daraltması
        canDriveMin = clampByWeekly(canDriveMin);
        if (canDriveMin <= 0) {
            // Haftalık limit dolmuşsa gün kapanışı gibi davranıp dinlenme uygula (basit model)
            const restMin = todayRest();
            t = addMinutes(t, restMin);
            totalRestMin += restMin;
            drivenTodayMin = 0;
            remainToBreak = BLOCK_MIN;
            split = makeSplitState();
            continue;
        }

        // Bu aralıkta gidilebilecek km
        const canDriveKm = canDriveMin * kmPerMin;
        const driveKm = Math.min(remainingKm, canDriveKm);

        // Süre (dakika) – km/dk ile orantılı, “erken bitirmeyelim” için ceil
        const driveMin = Math.max(1, Math.ceil(driveKm / kmPerMin));

        // Sürüşü uygula
        t = addMinutes(t, driveMin);
        remainingKm -= driveKm;

        drivenTodayMin += driveMin;
        totalDriveMin += driveMin;
        remainToBreak -= driveMin;
        if (split.pendingSecondPart30) {
            split.minutesDrivenSince15 += driveMin;
        }

        // Gün limiti geçilip geçilmediğine bak; (tam eşitlikte dinlenme sonraki turda alınır)
        if (drivenTodayMin > opt.dailyDriveLimitMin && canExtendToday() && !dayExtendedUsed) {
            // İlk kez 9h’ı geçtik -> bugüne 10h hakkını kullandık
            dayExtendedUsed = true;
        }

        // Haftalık sayaçlar
        if (opt.enforceWeeklyLimits) {
            weekDriven += driveMin;
            fortnightDriven += driveMin;
        }

        // Varış tamamlandıysa çık
        if (remainingKm <= 0.01) break;
    }

    return {
        // 🔴 ÖNEMLİ: Artık yerel ISO döndürüyoruz (UTC kayması yok)
        etaISO: toLocalISO(t),
        meta: {
            totalDriveMin,
            totalBreakMin,
            totalRestMin,
            usedExtendedToday: dayExtendedUsed,
            usedReducedRestToday: opt.allowReducedDailyRest && opt.useReducedRestToday,
            weeklyDrivenMin: opt.enforceWeeklyLimits ? weekDriven : undefined,
            fortnightDrivenMin: opt.enforceWeeklyLimits ? fortnightDriven : undefined,
        },
    };
}


// === Geriye dönük uyum: önceki adı kullanan yerler için basit sarmalayıcı ===
// (Eski computeETAWithKGM çağrılarını bozmadan çalıştırır)
export function computeETAWithKGM(distanceKm, startISO, initialRemainMin = BLOCK_MIN, speedKmh = AVG_SPEED_KMPH) {
    const { etaISO } = computeETAWithKGMPlus(distanceKm, startISO, {
        initialRemainMin,
        speedKmh,
        // daha önceki davranışa yakın (split açık, uzatma/azaltma bayrakları kapalı)
        allowSplitBreak: true,
        allowExtendedDailyDrive: false,
        useExtendedToday: false,
        allowReducedDailyRest: false,
        useReducedRestToday: false,
        enforceWeeklyLimits: false,
    });
    return etaISO;
}

// UI'da başlangıca eklenecek ek mola seçenekleri (değişmedi)
export const BREAK_OPTIONS = [
    { label: "Yok", value: 0 },
    { label: "45 dk", value: 45 },
    { label: "11 saat", value: 11 * 60 },
];
