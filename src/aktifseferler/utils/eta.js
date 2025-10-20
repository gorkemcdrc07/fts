// src/aktifseferler/utils/eta.js
// ==============================

/** Date -> "YYYY-MM-DDTHH:mm:ss" (naive local ISO) */
export function toLocalISO(date) {
    if (!(date instanceof Date)) return null;
    const pad = (n) => String(n).padStart(2, "0");
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

// === Sabitler ===
export const AVG_SPEED_KMPH = 65;
export const BLOCK_MIN = 4.5 * 60; // 270 dk
export const BREAK1_MIN = 45;
export const DAILY_REST_MIN = 11 * 60;
export const REDUCED_DAILY_REST_MIN = 9 * 60;
export const WEEKLY_LIMIT_MIN = 56 * 60;
export const FORTNIGHT_LIMIT_MIN = 90 * 60;

// === ETA Durum Sabitleri & Mesajları ===
export const ETA_STATUS = {
    OK: "OK",
    WAITING_FIRST_YC: "WAITING_FIRST_YC",
    NEED_DISTANCE: "NEED_DISTANCE",
    INVALID_START: "INVALID_START",
};

export const ETA_MESSAGES = {
    [ETA_STATUS.WAITING_FIRST_YC]: "Yükleme çıkış tarihi bekleniyor.",
    [ETA_STATUS.NEED_DISTANCE]: "Mesafe bulunamadı.",
    [ETA_STATUS.INVALID_START]: "Başlangıç tarihi geçersiz.",
};

// === Yardımcılar ===
export const parseHHMMtoMin = (txt) => {
    const [h = "0", m = "0"] = String(txt || "").split(":");
    let H = parseInt(h, 10) || 0;
    let M = parseInt(m, 10) || 0;
    if (M >= 60) { H += Math.floor(M / 60); M = M % 60; }
    if (H < 0 || M < 0) { H = Math.max(0, H); M = Math.max(0, M); }
    return H * 60 + M;
};

export const parseMesafeKm = (v) => {
    const s = String(v ?? "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
};

const minToMs = (m) => m * 60000;
function makeSplitState() {
    return { pendingSecondPart30: false, minutesDrivenSince15: 0 };
}

/** Cumartesi 12:00 sonrası +1 gün kuralı */
function applySaturdayRule(date) {
    const d = new Date(date);
    if (d.getDay() === 6) { // 6 = Cumartesi
        const minutes = d.getHours() * 60 + d.getMinutes();
        if (minutes >= 12 * 60) {
            // 12:00 veya sonrası → ertesi güne at
            d.setDate(d.getDate() + 1);
        }
    }
    return d;
}

/** startISO parse:
 * - "YYYY-MM-DDTHH:mm[:ss][±TZ]" -> Date
 * - "DD.MM.YYYY HH:mm" (yerel)  -> Date
 */
function parseStartLocal(startISO) {
    if (!startISO) return null;

    if (/^\d{4}-\d{2}-\d{2}T/.test(startISO)) {
        const d = new Date(startISO);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const m = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/.exec(String(startISO));
    if (m) {
        const [, dd, MM, yyyy, hh, mm] = m.map(Number);
        const d = new Date(yyyy, MM - 1, dd, hh, mm, 0, 0);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(startISO);
    return Number.isNaN(d.getTime()) ? null : d;
}

export const defaultRegOptions = {
    speedKmh: AVG_SPEED_KMPH,
    initialRemainMin: BLOCK_MIN,
    allowSplitBreak: true,
    dailyDriveLimitMin: 9 * 60,
    allowExtendedDailyDrive: true,
    useExtendedToday: false,
    dailyRestMin: 11 * 60,
    allowReducedDailyRest: true,
    useReducedRestToday: false,
    enforceWeeklyLimits: false,
    weeklyLimitMin: WEEKLY_LIMIT_MIN,
    fortnightLimitMin: FORTNIGHT_LIMIT_MIN,
    currentWeekDrivenMin: 0,
    currentFortnightDrivenMin: 0,
    startBreakMin: 0,
};

// 🟢 YENİ YARDIMCI FONKSİYON: 17:00 Kuralını Uygula
/**
 * @param {Date} date - Hesaplanan ETA tarihi
 * @param {number} totalBreakMin - Toplam mola dakikası (meta verisi için)
 * @param {number} totalRestMin - Toplam dinlenme dakikası (meta verisi için)
 * @returns {{ date: Date, totalBreakMin: number, totalRestMin: number }}
 */
function apply1700Rule(date, totalBreakMin, totalRestMin) {
    const d = new Date(date);
    const hour = d.getHours();
    const dayOfWeek = d.getDay(); // 0=Pazar, 6=Cumartesi

    // 1. Kural: Eğer saat 17:00 veya sonrası ise (17:00 ve sonrası, yani saat 17)
    if (hour >= 17) {
        // Pazar'a denk gelirse (yarın Pazartesi 08:00) veya Cumartesi ise (yarın Pazar, sonraki Pazartesi 08:00)

        let newDate = new Date(d);
        let minutesToWait = 0;

        // Saat farkını hesapla: 17:00'den o günün 00:00'ına (7 saat) + 8 saat
        // Veya daha basit:
        // Mevcut zamanı sıfırla (00:00'a al) ve 1 gün + 8 saat ekle

        // Önce saati 00:00'a ayarla (yani yarının 00:00'ı)
        newDate.setDate(newDate.getDate() + 1);
        newDate.setHours(0, 0, 0, 0);

        // Şimdi 08:00'ı ekle
        newDate.setHours(8);

        // Pazar'dan (0) Pazartesi'ye (1) atlama kontrolü (bu zaten yukarıdaki setDate ile halledildi)
        // Ancak Cumartesi (6) ise, Pazar'ı atlayıp Pazartesi'ye gitmeli.

        if (dayOfWeek === 6) { // Cumartesi (17:00 ve sonrası) ise
            // Pazartesi'ye atla (Pazar'ı atla)
            newDate.setDate(newDate.getDate() + 1);
            // Total mola/dinlenmeye ekleme yapmamız gerekir (15 saat mola)
            minutesToWait = 24 * 60 - (hour * 60 + d.getMinutes()) + 8 * 60;
        } else if (dayOfWeek === 5 && hour >= 17) { // Cuma 17:00 sonrası ise
            // Cumartesi'yi atla, Pazartesi'ye git
            newDate.setDate(newDate.getDate() + 2);
            minutesToWait = 24 * 60 + 8 * 60 - (hour * 60 + d.getMinutes());
        }

        // Yukarıdaki mantık biraz karmaşıklaştı, basitleştirelim:
        // Her zaman 1 gün sonrasının 08:00'ına at, sonra hafta sonu kontrolü yap.

        // Yeni tarihi belirle: Ertesi gün 08:00
        let targetDate = new Date(d);
        targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(8, 0, 0, 0); // Ertesi gün 08:00

        // Hedef gün Pazar (0) veya Cumartesi (6) ise, Pazartesi'ye (1) atla
        while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        // Geçen zamanı dinlenmeye ekleyebiliriz. (Sadece meta için, hesaplamayı etkilemez)
        minutesToWait = Math.round((targetDate.getTime() - d.getTime()) / minToMs(1));

        return {
            date: targetDate,
            totalBreakMin: totalBreakMin, // Buraya dinlenme süresini ekleyebilirsiniz
            totalRestMin: totalRestMin + minutesToWait,
        };
    }

    return { date: d, totalBreakMin, totalRestMin };
}


/** KGM kurallarıyla ETA simülasyonu */
export function computeETAWithKGMPlus(distanceKm, startISO, options = {}) {
    if (!distanceKm || !startISO) return { etaISO: null, meta: null };

    const opt = { ...defaultRegOptions, ...options };

    let start = parseStartLocal(startISO);
    if (!start) return { etaISO: null, meta: null };

    // ✅ Cumartesi 12:00 sonrası kuralını uygula
    start = applySaturdayRule(start);

    const kmPerMin = opt.speedKmh / 60;
    let remainingKm = Math.max(0, distanceKm);

    let t = new Date(start);
    let remainToBreak = Math.max(1, Number(opt.initialRemainMin) || BLOCK_MIN);

    // Başlangıç molası (yalnızca tek blokta bitiremiyorsak uygula)
    const startBreakMin = Math.max(0, Number(opt.startBreakMin) || 0);
    if (startBreakMin > 0) {
        const totalNeededMin = Math.round((Math.max(0, distanceKm) / opt.speedKmh) * 60);
        if (totalNeededMin > remainToBreak) {
            t = new Date(t.getTime() + minToMs(startBreakMin));
            remainToBreak = BLOCK_MIN;
        }
    }

    let drivenTodayMin = 0;
    let dayExtendedUsed = false;
    let split = makeSplitState();

    let totalDriveMin = 0;
    let totalBreakMin = startBreakMin;
    let totalRestMin = 0;

    const addMinutes = (date, m) => new Date(date.getTime() + minToMs(m));
    const canExtendToday = () =>
        opt.allowExtendedDailyDrive && !dayExtendedUsed && opt.useExtendedToday;
    const todayLimit = () =>
        canExtendToday() ? 10 * 60 : opt.dailyDriveLimitMin;
    const todayRest = () =>
        opt.allowReducedDailyRest && opt.useReducedRestToday
            ? REDUCED_DAILY_REST_MIN
            : opt.dailyRestMin;

    const needSecondPartNow = () =>
        opt.allowSplitBreak &&
        split.pendingSecondPart30 &&
        split.minutesDrivenSince15 >= BLOCK_MIN;

    while (remainingKm > 0.01) {
        // ... (Haftalık/İki Haftalık Kural Ekleme Noktası 1 buraya gelebilir)

        const remainInDay = todayLimit() - drivenTodayMin;
        if (remainInDay <= 0) {
            const restMin = todayRest();
            t = addMinutes(t, restMin);
            totalRestMin += restMin;
            drivenTodayMin = 0;
            dayExtendedUsed = dayExtendedUsed || opt.useExtendedToday;
            remainToBreak = BLOCK_MIN;
            split = makeSplitState();
            continue;
        }

        if (remainToBreak <= 0) {
            if (opt.allowSplitBreak && !split.pendingSecondPart30) {
                t = addMinutes(t, 15);
                totalBreakMin += 15;
                split.pendingSecondPart30 = true;
                split.minutesDrivenSince15 = 0;
                remainToBreak = BLOCK_MIN;
                continue;
            }
            const breakMin = split.pendingSecondPart30 ? 30 : BREAK1_MIN;
            t = addMinutes(t, breakMin);
            totalBreakMin += breakMin;
            split.pendingSecondPart30 = false;
            split.minutesDrivenSince15 = 0;
            remainToBreak = BLOCK_MIN;
            continue;
        }

        if (needSecondPartNow()) {
            t = addMinutes(t, 30);
            totalBreakMin += 30;
            split.pendingSecondPart30 = false;
            split.minutesDrivenSince15 = 0;
            remainToBreak = BLOCK_MIN;
            continue;
        }

        const canDriveMin = Math.min(remainToBreak, remainInDay);
        const canDriveKm = canDriveMin * kmPerMin;
        const driveKm = Math.min(remainingKm, canDriveKm);
        const driveMin = Math.max(1, Math.round(driveKm / kmPerMin));

        t = addMinutes(t, driveMin);
        remainingKm -= driveKm;

        drivenTodayMin += driveMin;
        totalDriveMin += driveMin;
        remainToBreak -= driveMin;

        if (split.pendingSecondPart30) split.minutesDrivenSince15 += driveMin;
        if (drivenTodayMin > opt.dailyDriveLimitMin && canExtendToday() && !dayExtendedUsed)
            dayExtendedUsed = true;

        if (remainingKm <= 0.01) break;
    }

    // 🟢 YENİ KURAL UYGULAMASI: 17:00 Kuralı
    const ruleResult = apply1700Rule(t, totalBreakMin, totalRestMin);
    t = ruleResult.date;
    totalBreakMin = ruleResult.totalBreakMin;
    totalRestMin = ruleResult.totalRestMin;


    return {
        etaISO: toLocalISO(t),
        meta: { totalDriveMin, totalBreakMin, totalRestMin, usedExtendedToday: dayExtendedUsed },
    };
}

/** Eski uyumlu */
export function computeETAWithKGM(distanceKm, startISO, initialRemainMin = BLOCK_MIN, speedKmh = AVG_SPEED_KMPH) {
    const { etaISO } = computeETAWithKGMPlus(distanceKm, startISO, {
        initialRemainMin,
        speedKmh,
        allowSplitBreak: true,
        allowExtendedDailyDrive: false,
        useExtendedToday: false,
        allowReducedDailyRest: false,
        useReducedRestToday: false,
        enforceWeeklyLimits: false,
    });
    return etaISO;
}

/* ===========================
    YENİ: Güvenli yardımcılar denemeleri
    =========================== */
export function getFirstYuklemeCikis(etaRow) {
    return etaRow?.sefer_detaylari?.[0]?.yukleme_cikis ?? null;
}

export function computeRowETA(
    etaRow,
    {
        distanceKm,
        startBreakMin = 0,
        initialRemainMin = BLOCK_MIN,
        speedKmh = AVG_SPEED_KMPH,
        useExtendedToday = false,
    } = {}
) {
    const firstYC = getFirstYuklemeCikis(etaRow);
    if (!firstYC) return { status: ETA_STATUS.WAITING_FIRST_YC };

    const dist = distanceKm ?? parseMesafeKm(etaRow?.mesafe_km);
    if (!dist) return { status: ETA_STATUS.NEED_DISTANCE };

    const { etaISO, meta } = computeETAWithKGMPlus(dist, firstYC, {
        startBreakMin,
        initialRemainMin,
        speedKmh,
        useExtendedToday,
    });

    if (!etaISO) return { status: ETA_STATUS.INVALID_START };
    return { status: ETA_STATUS.OK, etaISO, meta };
}

export const BREAK_OPTIONS = [
    { label: "Yok", value: 0 },
    { label: "45 dk", value: 45 },
    { label: "11 saat", value: 11 * 60 },
];
