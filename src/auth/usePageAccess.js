// src/auth/usePageAccess.js
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

// .env: REACT_APP_ADMIN_USERS=admin,administrator
const ADMIN_USERS = new Set(
    String(process.env.REACT_APP_ADMIN_USERS || "admin")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
);

// ---- helpers -------------------------------------------------
function getLocalUsername() {
    try {
        const a = (localStorage.getItem("kullaniciAdi") || "").trim();
        const b = (localStorage.getItem("kullanici") || "").trim();
        const c = JSON.parse(localStorage.getItem("girisYapanKullanici") || "{}")?.kullaniciAdi || "";
        const pick = (a || b || c || "").toLowerCase();
        return pick.includes("@") ? pick.split("@")[0] : pick;
    } catch { return ""; }
}

function getLocalLoginId() {
    // Oturum açarken id’yi localStorage’a yazıyorsan buradan yakala
    // Projende farklı anahtarlar varsa ekle:
    const candidates = [
        "loginId", "user_id", "userid", "kullaniciId",
        "girisYapanKullanici", // {id: ...}
    ];
    for (const key of candidates) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
            if (key === "girisYapanKullanici") {
                const obj = JSON.parse(raw);
                if (obj && obj.id) return Number(obj.id);
            } else {
                const n = Number(raw);
                if (Number.isFinite(n)) return n;
            }
        } catch { }
    }
    return null;
}

function normalizePath(path) {
    if (!path) return "/";
    let s = String(path).trim().toLowerCase();
    if (!s.startsWith("/")) s = "/" + s;
    s = s.replace(/\/+$/g, "");
    if (s === "") s = "/";
    return s;
}

function pathToColumn(path) {
    // "/hakedis/arac-cari-ve-fiyat" -> "p_hakedis_arac_cari_ve_fiyat"
    const s = normalizePath(path).replace(/^\//, "");
    const core = s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return "p_" + (core || "anasayfa");
}

// --------------------------------------------------------------

export default function usePageAccess() {
    const [row, setRow] = useState(null); // user_page_access tek satır
    const [loading, setLoading] = useState(true);

    const me = useMemo(() => getLocalUsername(), []);
    const isAdmin = useMemo(() => ADMIN_USERS.has(me), [me]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                if (isAdmin) {
                    console.log("[access] admin bypass:", me);
                    if (mounted) setRow({}); // admin her şeye erişsin
                    return;
                }

                // 1) user_id’yi localStorage’dan yakalamayı dene
                let userId = getLocalLoginId();
                let loginRow = null;

                // 2) yoksa login tablosundan ara (kullaniciAdi / kullanici, case-insensitive)
                if (!userId) {
                    const raw = getLocalUsername();
                    if (!raw) { if (mounted) setRow(null); return; }

                    const like = raw.replace(/[%_]/g, ""); // joker kaçır
                    const { data, error } = await supabase
                        .from("login")
                        .select("id, kullaniciAdi, kullanici")
                        .or(`kullaniciAdi.ilike.${like},kullanici.ilike.${like}`) // tam eşleşme istiyorsan: `.or(\`kullaniciAdi.eq.${raw},kullanici.eq.${raw}\`)`
                        .maybeSingle();

                    if (error) throw error;
                    loginRow = data || null;
                    userId = loginRow?.id ? Number(loginRow.id) : null;
                }

                if (!userId) {
                    console.warn("[access] userId bulunamadı. me:", me);
                    if (mounted) setRow(null);
                    return;
                }

                // 3) user_page_access satırını çek
                const { data: upa, error: e2 } = await supabase
                    .from("user_page_access")
                    .select("*")
                    .eq("user_id", Number(userId))
                    .maybeSingle();

                if (e2) throw e2;

                console.log("[access] resolved user:", { me, userId, loginRow, upaRow: upa });
                if (mounted) setRow(upa || null);
            } catch (e) {
                console.error("usePageAccess error:", {
                    message: e?.message, code: e?.code, details: e?.details, hint: e?.hint, error: e
                });
                if (mounted) setRow(null);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [isAdmin, me]);

    const whitelist = useMemo(() => new Set(["/", "/anasayfa"]), []);

    const hasAccess = useCallback((path) => {
        const p = normalizePath(path);
        if (isAdmin) return true;
        if (whitelist.has(p)) return true;
        if (!row) return false;
        const col = pathToColumn(p);
        const ok = row[col] === true;
        // debug
        if (!ok) console.log("[access] BLOCK:", { path: p, col, row });
        return ok;
    }, [row, whitelist, isAdmin]);

    return { loading, hasAccess };
}
