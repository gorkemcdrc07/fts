// src/aktifseferler/utils/eta.js
export const AVG_SPEED_KMPH = 65;
export const BLOCK_MIN = 270;
export const BREAK1_MIN = 45;
export const DAILY_REST_MIN = 11 * 60;

export const parseHHMMtoMin = (txt) => {
    const [h = "0", m = "0"] = String(txt || "").split(":");
    return Math.max(0, (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0));
};

// "1.685,69" -> 1685.69
export const parseMesafeKm = (v) => {
    const s = String(v ?? "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
};

export function computeETAWithKGM(distanceKm, startISO, initialRemainMin = BLOCK_MIN, speedKmh = AVG_SPEED_KMPH) {
    const kmPerMin = speedKmh / 60;
    let remainingKm = Math.max(0, distanceKm);
    let t = new Date(startISO);
    let remainToBreak = Math.max(0, initialRemainMin);
    let blocksToday = 0;

    while (remainingKm > 0.01) {
        if (remainToBreak <= 0) {
            if (blocksToday === 1) t = new Date(t.getTime() + BREAK1_MIN * 60000);
            else if (blocksToday === 2) { t = new Date(t.getTime() + (BREAK1_MIN + DAILY_REST_MIN) * 60000); blocksToday = 0; }
            remainToBreak = BLOCK_MIN; continue;
        }
        const canDriveKm = remainToBreak * kmPerMin;
        const driveKm = Math.min(remainingKm, canDriveKm);
        const driveMin = Math.round(driveKm / kmPerMin);

        t = new Date(t.getTime() + driveMin * 60000);
        remainingKm -= driveKm; remainToBreak -= driveMin;

        if (remainingKm <= 0.01) break;
        blocksToday += 1;
        if (blocksToday === 1) t = new Date(t.getTime() + BREAK1_MIN * 60000);
        else if (blocksToday === 2) { t = new Date(t.getTime() + (BREAK1_MIN + DAILY_REST_MIN) * 60000); blocksToday = 0; }
        remainToBreak = BLOCK_MIN;
    }

    const pad = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

export const BREAK_OPTIONS = [
    { label: "Yok", value: 0 },
    { label: "45 dk", value: 45 },
    { label: "11 saat", value: 11 * 60 },
];
