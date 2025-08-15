// server/index.js
const express = require("express");
const cors = require("cors");

// Node 18+ 'fetch' globaldir. 16 ise node-fetch fallback:
const fetchFn = global.fetch
    ? global.fetch
    : (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const app = express();
const PORT = process.env.PORT || 3001;
const TMS_BASE = "https://tms.odaklojistik.com.tr";

app.use(cors());
app.use(express.json());

// 1) Login -> TMS /api/auth/login
app.post("/reel-auth/api/auth/login", async (req, res) => {
    const { userName, password } = req.body || {};
    if (!userName || !password) {
        return res.status(400).json({ error: "userName/password gerekli" });
    }
    try {
        const up = await fetchFn(`${TMS_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, password }),
        });
        const text = await up.text();
        let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
        return res.status(up.status).json(json);
    } catch (e) {
        return res.status(502).json({ error: "Upstream hata", detail: String(e) });
    }
});

// 2) Gider ekleme -> TMS /api/tmsdespatchincomeexpenses/addexpense
app.post("/tmsdespatchincomeexpenses/addexpense", async (req, res) => {
    try {
        const up = await fetchFn(`${TMS_BASE}/api/tmsdespatchincomeexpenses/addexpense`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Frontend'den gelen Bearer'ı aynen TMS'e geçir
                "Authorization": req.headers.authorization || "",
            },
            body: JSON.stringify(req.body || {}),
        });
        const text = await up.text();
        let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
        return res.status(up.status).json(json);
    } catch (e) {
        return res.status(502).json({ error: "Upstream hata", detail: String(e) });
    }
});

app.listen(PORT, () => {
    console.log(`[reel-auth] server http://localhost:${PORT}`);
});
