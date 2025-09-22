export const allowedEditors = new Set(["ADMIN", "SELIN", "BEKIRAKCAGOZ"]);
export const allowedETA = new Set([
    "MERT", "FERHATKARISLI", "BEKIRAKCAGOZ", "ADMIN", "SELCUK", "BUKETCIMENCI",
]);

export const normalizeUser = (s) =>
    (s || "")
        .toLocaleUpperCase("tr-TR")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, "");
