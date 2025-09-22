// src/aktifseferler/utils/format.js
import { allowedETA, allowedEditors, normalizeUser } from "../constants/permissions";

export const formatPhone = (raw = "") => {
    const d = ("" + raw).replace(/\D/g, "");
    if (d.length === 10) return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
    if (d.length === 11) return `${d.slice(0, 1)}${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
    return raw || "-";
};
export const ellipsize = (s = "", n = 60) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const inSetOrArray = (col, v) =>
    col && typeof col.has === "function" ? col.has(v) : Array.isArray(col) ? col.includes(v) : false;

export const userCanEdit = (u) => inSetOrArray(allowedEditors, normalizeUser(u || ""));
export const userCanSeeETA = (u) => inSetOrArray(allowedETA, normalizeUser(u || ""));
