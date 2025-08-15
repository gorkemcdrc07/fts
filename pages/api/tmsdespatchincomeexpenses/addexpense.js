export default async function handler(req, res) {
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(200).end();
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const TMS_URL = process.env.TMS_ADD_EXPENSE_URL
        || "https://tms.odaklojistik.com.tr/api/tmsdespatchincomeexpenses/addexpense";

    try {
        const up = await fetch(TMS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Bearer'ı TMS'e aynen ilet
                "Authorization": req.headers.authorization || "",
            },
            body: JSON.stringify(req.body || {}),
        });
        const text = await up.text();
        let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
        res.status(up.status).json(json);
    } catch (e) {
        res.status(502).json({ error: "Upstream hata", detail: String(e) });
    }
}
