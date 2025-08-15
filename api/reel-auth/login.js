// pages/api/reel-auth/login.js
export default async function handler(req, res) {
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(200).end();
    }
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { userName, password } = req.body || {};
    if (!userName || !password) {
        return res.status(400).json({ error: "userName/password gerekli" });
    }

    const TMS_LOGIN_URL =
        process.env.TMS_LOGIN_URL ||
        "https://tms.odaklojistik.com.tr/api/auth/login";

    try {
        const up = await fetch(TMS_LOGIN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, password }),
        });

        const text = await up.text();
        let json;
        try { json = JSON.parse(text); } catch { json = { raw: text }; }

        res.status(up.status).json(json);
    } catch (e) {
        res.status(502).json({ error: "Upstream hata", detail: String(e) });
    }
}
