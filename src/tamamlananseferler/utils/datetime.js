// Zaman formatları: Ekranda UTC'ye sabit gösterim (veritabanı UTC geliyorsa kayma olmaz)
export const fmtDate = (v) => (v ? new Date(v) : null);

export const fmtDateText = (v) =>
    v
        ? new Intl.DateTimeFormat("tr-TR", {
            timeZone: "UTC",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date(v))
        : "-";

export const fmtDateTimeText = (v) =>
    v
        ? new Intl.DateTimeFormat("tr-TR", {
            timeZone: "UTC",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).format(new Date(v))
        : "-";

export const ms = (a, b) => (a && b ? new Date(b) - new Date(a) : 0);

export const humanDur = (millis) => {
    if (!millis || millis < 0) return "-";
    const totalM = Math.floor(millis / 60000);
    const d = Math.floor(totalM / (60 * 24));
    const h = Math.floor((totalM % (60 * 24)) / 60);
    const m = totalM % 60;
    return [d ? `${d}g` : null, h ? `${h}s` : null, m ? `${m}d` : null]
        .filter(Boolean)
        .join(" ") || "0d";
};
