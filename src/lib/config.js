// src/lib/config.js
export const CONFIG = {
    ODAK_BASE: (process.env.REACT_APP_ODAK_BASE_URL || "https://tedarik-analiz-backend.onrender.com").replace(/\/+$/, ""),
    ODAK_TOKEN: process.env.REACT_APP_ODAK_API_KEY || "",

};
