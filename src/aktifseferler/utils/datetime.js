// src/aktifseferler/utils/datetime.js
export const isDateComplete = (txt) => /^\d{2}\.\d{2}\.\d{4}$/.test(txt);
export const isTimeComplete = (txt) => /^\d{2}:\d{2}$/.test(txt);

const pad = (n) => String(n).padStart(2, "0");
export const toLocalISO = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const nowLocalISO = () => toLocalISO(new Date());

export const toISO = (dateTR, time) => {
    if (!(isDateComplete(dateTR) && isTimeComplete(time))) return "";
    const [dd, mm, yyyy] = dateTR.split(".");
    return `${yyyy}-${mm}-${dd}T${time}`;
};

export const fromISO = (raw) => {
    if (!raw) return { d: "", t: "" };
    const iso = raw instanceof Date ? toLocalISO(raw) : String(raw);
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
    if (!m) return { d: "", t: "" };
    const [, y, mo, dd, hh, mi] = m;
    return { d: `${dd}.${mo}.${y}`, t: hh && mi ? `${hh}:${mi}` : "" };
};
export const fromISOToCombined = (raw) => {
    const { d, t } = fromISO(raw);
    return d ? (t ? `${d} ${t}` : d) : "";
};

export const normalizeISO = (raw) => {
    if (!raw) return null;
    if (raw instanceof Date && !isNaN(raw)) return toLocalISO(raw);
    const s = String(raw).trim();
    const m = s.match(/\/Date\((\d+)\)\//);
    if (m) return toLocalISO(new Date(Number(m[1])));
    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(s)) return s.replace(" ", "T").slice(0, 16);
    const d = new Date(s);
    return isNaN(d) ? null : toLocalISO(d);
};

export const addMinutesISO = (iso, min = 0) => {
    const d = new Date(iso || nowLocalISO());
    return toLocalISO(new Date(d.getTime() + (Number(min) || 0) * 60000));
};
