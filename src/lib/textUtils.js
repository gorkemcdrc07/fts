// src/lib/textUtils.js
export const toUpperTr = (s) => (s || "").toLocaleUpperCase("tr-TR").trim();
export const normalizeTitle = (s) => toUpperTr(s).replace(/\s+/g, " ");
export const normalizeDoc = (s) =>
    toUpperTr(String(s ?? ""))
        .replace(/\s+/g, "")
        .replace(/[^A-Z0-9]/g, "");
