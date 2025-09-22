export const isDateComplete = (txt) => /^\d{2}\.\d{2}\.\d{4}$/.test(txt);
export const isTimeComplete = (txt) => /^\d{2}:\d{2}$/.test(txt);

const pad = (n) => String(n).padStart(2, "0");

// Local ISO format (UTC kaymasını engellemek için)
export const toLocalISO = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

export const nowLocalISO = () => toLocalISO(new Date());

export const toISO = (dateTR, time) => {
    if (!(isDateComplete(dateTR) && isTimeComplete(time))) return "";
    const [dd, mm, yyyy] = dateTR.split(".");
    return `${yyyy}-${mm}-${dd}T${time}:00`;
};

// ISO string → ekranda gösterilecek format
export const fromISO = (raw) => {
    if (!raw) return { d: "", t: "" };

    const s = String(raw).trim().replace(" ", "T");

    // "2025-05-13T13:13" → parçala
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return { d: "", t: "" };

    const [, y, mo, dd, hh, mi] = m;
    return { d: `${dd}.${mo}.${y}`, t: `${hh}:${mi}` };
};

export const fromISOToCombined = (raw) => {
    const { d, t } = fromISO(raw);
    return d ? (t ? `${d} ${t}` : d) : "";
};

// normalize ederken new Date kullanma → local ISO string döndür
export const normalizeISO = (raw) => {
    if (!raw) return null;
    if (raw instanceof Date && !isNaN(raw)) return toLocalISO(raw);

    const s = String(raw).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`;

    return null;
};

export const addMinutesISO = (iso, min = 0) => {
    const s = String(iso).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return iso;

    let [y, mo, d, hh, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
    const base = new Date(y, mo - 1, d, hh, mi);
    const newDate = new Date(base.getTime() + (Number(min) || 0) * 60000);
    return toLocalISO(newDate);
};
