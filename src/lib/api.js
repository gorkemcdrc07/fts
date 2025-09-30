// src/lib/api.js
import { CONFIG } from "./config";

/* ---- yardımcılar ---- */
const norm = (json) => {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.Data)) return json.Data;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.items)) return json.items;
    if (json && typeof json === "object") return [json];
    return [];
};

const join = (base, path) => {
    if (!base) return path || "";
    if (!path) return base;
    return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
};

async function tryOnce({ url, method, token, payload }) {
    const u = new URL(url);
    const opt = { method, headers: {} };

    if (method === "GET") {
        u.search = new URLSearchParams({
            startDate: payload.startDate,
            endDate: payload.endDate,
            userId: String(payload.userId ?? 1),
        }).toString();
    } else {
        opt.headers["Content-Type"] = "application/json";
        if (token) opt.headers.Authorization = `Bearer ${token}`;
        opt.body = JSON.stringify(payload);
    }

    const res = await fetch(u.toString(), opt);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json().catch(() => ({}));
    return { rows: norm(json), hit: `${method} ${u.toString()}` };
}

/* ---- ODAK (tedarik-analiz-backend): /odak  ---- */
export async function fetchOdakSmart({ startDate, endDate, userId }) {
    const base = CONFIG.ODAK_BASE;
    const token = CONFIG.ODAK_TOKEN;
    const payload = { startDate, endDate, userId: Number(userId ?? 1) };

    const ends = ["odak", "api/odak", "v1/odak", "api/v1/odak"];
    const attempts = ends.map((e) => ({ method: "POST", url: join(base, e) }));

    const errors = [];
    for (const a of attempts) {
        try {
            const out = await tryOnce({ ...a, payload, token });
            return out; // ilk başarılı
        } catch (e) {
            errors.push(`${a.method} ${a.url} → ${e.message}`);
        }
    }
    const msg = `ODAK ulaşamadı. Denenen yollar:\n${errors.join("\n")}`;
    const err = new Error(msg);
    err._attempts = errors;
    throw err;
}

/* (İstersen ileride FİLO için benzeri yazılır)
export async function fetchFiloSomething(...) { ... }
*/
