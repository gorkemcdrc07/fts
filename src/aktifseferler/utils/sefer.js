export const EXCLUDED_PLAKAS = new Set([
    "34NHF579", "34NHF636", "34NHF705", "34NHF757",
    "34NHF811", "34NHF868", "34NHF916", "34NHF964",
    "34NHG120", "34NHG208", "06CFZ391", "33ADV488",
    "54AEH576", "26ADN765", "06GD7290", "33ABF523",
    "33AIM809", "33AVC168", "33ACR730", "34EYJ582",
]);

export const normalizePlate = (s) => (s ?? "").toString().toUpperCase().replace(/[\s-]/g, "");
export const isExcludedPlate = (p) => EXCLUDED_PLAKAS.has(normalizePlate(p));

export const splitCell = (v) =>
    (v ?? "").toString().split(";").map((x) => x.trim()).filter((x) => x !== "");

export const clean = (v) => {
    const t = (v ?? "").toString().trim();
    return !t || t === "-" || t === "---" ? null : t;
};

export const detailFields = [
    "proje_adi", "yukleme_noktasi", "yukleme_ili", "yukleme_ilcesi",
    "teslim_noktasi", "teslim_ili", "teslim_ilcesi",
    "yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis",
];

export const computeAracStatu = (rows = []) => {
    if (!rows.length) return "";
    const isFilled = (x) => x && x !== "-" && x.trim() !== "";
    let completed = 0;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const yv = isFilled(r.yukleme_varis);
        const yc = isFilled(r.yukleme_cikis);
        const tv = isFilled(r.teslim_varis);
        const tc = isFilled(r.teslim_cikis);
        if (!yv) return `${i + 1}.NOKTA BİLGİLERİ BEKLENİYOR`;
        if (!yc) return `${i + 1}.NOKTADA YÜKLEMEDE`;
        if (!tv) return `${i + 1}.NOKTADA YOLDA`;
        if (!tc) return `${i + 1}.NOKTADA BOŞALTMADA`;
        completed++;
    }
    return completed === rows.length ? "SEFER TAMAMLANDI" : "";
};

export const pickOD = (row, detay = []) => {
    const first = (arr) => (arr.length ? arr[0] : "");
    const last = (arr) => (arr.length ? arr[arr.length - 1] : "");
    const yIl = first(splitCell(row.yukleme_ili || ""));
    const yIlce = first(splitCell(row.yukleme_ilcesi || ""));
    const tIl = last(splitCell(row.teslim_ili || ""));
    const tIlce = last(splitCell(row.teslim_ilcesi || ""));
    const dFirst = detay?.[0] || {};
    const dLast = detay?.[detay.length - 1] || {};
    return {
        yIl: yIl || dFirst.yukleme_ili || "",
        yIlce: yIlce || dFirst.yukleme_ilcesi || "",
        tIl: tIl || dLast.teslim_ili || "",
        tIlce: tIlce || dLast.teslim_ilcesi || "",
    };
};
