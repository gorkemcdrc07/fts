// src/raporlar/supabase-diagnostics.js
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function pickEnv(nameList) {
    for (const name of nameList) {
        const v =
            (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[name]) ||
            process.env?.[name];
        if (v) return v;
    }
    return undefined;
}

const URL_ENV_KEYS = ["VITE_SUPABASE_URL", "REACT_APP_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"];
const KEY_ENV_KEYS = ["VITE_SUPABASE_ANON_KEY", "REACT_APP_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

export default function SupabaseDiagnostics() {
    const [out, setOut] = useState("Çalıştırılıyor...");

    useEffect(() => {
        (async () => {
            const url = pickEnv(URL_ENV_KEYS);
            const key = pickEnv(KEY_ENV_KEYS);

            let log = [];
            log.push(`URL env: ${url || "(yok)"}`);
            log.push(`KEY env: ${key ? "(var)" : "(yok)"}`);

            if (!url || !key) {
                setOut(log.concat([
                    "",
                    "❌ Env eksik. .env dosyanızda bu anahtarlar olmalı:",
                    "Vite: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY",
                    "CRA:  REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY",
                    "Next: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
                ]).join("\n"));
                return;
            }

            if (!url.startsWith("https://")) {
                setOut(log.concat(["", "❌ URL 'https://' ile başlamalı."]).join("\n"));
                return;
            }

            // 1) /rest/v1 köküne çıplak fetch (çoğu zaman 404 JSON döner)
            try {
                const r1 = await fetch(`${url}/rest/v1/`, { headers: { apikey: key } });
                const t1 = await r1.text();
                log.push("", `REST probe: ${url}/rest/v1/`);
                log.push(`→ status: ${r1.status}`);
                log.push(`→ body: ${t1.slice(0, 400)}`);
            } catch (e) {
                log.push("", "REST probe hata:", String(e));
            }

            // 2) /auth/v1 köküne fetch (genellikle 404 veya JSON)
            try {
                const r2 = await fetch(`${url}/auth/v1/`, { headers: { apikey: key } });
                const t2 = await r2.text();
                log.push("", `AUTH probe: ${url}/auth/v1/`);
                log.push(`→ status: ${r2.status}`);
                log.push(`→ body: ${t2.slice(0, 400)}`);
            } catch (e) {
                log.push("", "AUTH probe hata:", String(e));
            }

            // 3) Gerçek tabloya min sorgu (var olan bir tablo adıyla deneyin)
            const supabase = createClient(url, key);
            const { data, error } = await supabase.from("seferler").select("id").limit(1);
            log.push("", "Tablo testi: from('seferler').select('id').limit(1)");
            log.push(`→ error: ${error ? error.message : "(yok)"}`);
            log.push(`→ data: ${data ? JSON.stringify(data).slice(0, 200) : "(yok)"}`);

            setOut(log.join("\n"));
        })();
    }, []);

    return (
        <pre style={{ whiteSpace: "pre-wrap", background: "#0b1020", color: "#d7e3ff", padding: 12, borderRadius: 8, fontSize: 13 }}>
            {out}
        </pre>
    );
}
