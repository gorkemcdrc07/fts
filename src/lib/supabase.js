// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

// ----- ODAK (tedarik-analiz-backend) ayarları -----
export const CONFIG = {
    // yalnızca ODAK kullanılacak
    ODAK_BASE: (process.env.REACT_APP_API_BASE_URL || "https://tedarik-analiz-backend.onrender.com").replace(/\/+$/, ""),
    // token .env'den (REACT_APP_ODAK_API_KEY veya API_TOKEN)
    ODAK_TOKEN: process.env.REACT_APP_ODAK_API_KEY || process.env.API_TOKEN || "",
};

// ----- (opsiyonel) Supabase; gerekmezse env'leri boş bırak -----
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 10 } } })
    : null;

// küçük bir log (isteğe bağlı)
if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("CONFIG.ODAK_BASE =", CONFIG.ODAK_BASE, "TOKEN?", !!CONFIG.ODAK_TOKEN);
}
