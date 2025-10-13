// src/aktifseferler/utils/eta.js
// ==============================

// UTC → Lokal ISO formatında döndürür
export function toLocalISO(date) {
    if (!(date instanceof Date)) return null;
    // timezone offset (dk)
    const tzOffset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - tzOffset * 60000);
    const pad = (n) => String(n).padStart(2, "0");
    const y = local.getFullYear();
    const m = pad(local.getMonth() + 1);
    const d = pad(local.getDate());
    const h = pad(local.getHours());
    const min = pad(local.getMinutes());
    const s = pad(local.getSeconds());
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

// Yardımcılar
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

export const defaultRegOptions = {
    speedKmh: AVG_SPEED_KMPH,
    initialRemainMin: BLOCK_MIN,
    allowSplitBreak: true,
    dailyDriveLimitMin: 9 * 60,
    allowExtendedDailyDrive: true,
    useExtendedToday: false,
    dailyRestMin: DAILY_REST_MIN,
    allowReducedDailyRest: true,
    useReducedRestToday: false,
    enforceWeeklyLimits: false,
    weeklyLimitMin: WEEKLY_LIMIT_MIN,
    fortnightLimitMin: FORTNIGHT_LIMIT_MIN,
    currentWeekDrivenMin: 0,
    currentFortnightDrivenMin: 0,
};

export function computeETAWithKGMPlus(distanceKm, startISO, options = {}) {
    if (!distanceKm || !startISO) return { etaISO: null, meta: null };

    const opt = { ...defaultRegOptions, ...options };
    // Başlangıcı UTC kabul et
    const start = new Date(startISO + "Z");
    if (Number.isNaN(start.getTime())) return { etaISO: null, meta: null };

    const kmPerMin = opt.speedKmh / 60;
    let remainingKm = Math.max(0, distanceKm);

    let t = new Date(start);
    let remainToBreak = opt.initialRemainMin;
    let drivenTodayMin = 0;
    let dayExtendedUsed = false;
    let split = makeSplitState();

    let weekDriven = opt.currentWeekDrivenMin || 0;
    let fortnightDriven = opt.currentFortnightDrivenMin || 0;

    let totalDriveMin = 0;
    let totalBreakMin = 0;
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

        let canDriveMin = Math.min(remainToBreak, remainInDay);
        const canDriveKm = canDriveMin * kmPerMin;
        const driveKm = Math.min(remainingKm, canDriveKm);
        const driveMin = Math.max(1, Math.ceil(driveKm / kmPerMin));

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

    return {
        etaISO: toLocalISO(t),
        meta: { totalDriveMin, totalBreakMin, totalRestMin, usedExtendedToday: dayExtendedUsed },
    };
}

// Eski uyumlu fonksiyon
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

export const BREAK_OPTIONS = [
    { label: "Yok", value: 0 },
    { label: "45 dk", value: 45 },
    { label: "11 saat", value: 11 * 60 },
];
