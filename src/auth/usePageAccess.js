// src/auth/usePageAccess.js
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { APP_PAGES } from "../routes/pages";

// .env: REACT_APP_ADMIN_USERS=admin,administrator
const ADMIN_USERS = new Set(
    String(process.env.REACT_APP_ADMIN_USERS || "admin")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
);

/* ===================== Helpers ===================== */
function getLocalUsername() {
    try {
        const a = (localStorage.getItem("kullaniciAdi") || "").trim();
        const b = (localStorage.getItem("kullanici") || "").trim();
        const c = JSON.parse(localStorage.getItem("girisYapanKullanici") || "{}")?.kullaniciAdi || "";
        const pick = (a || b || c || "").toLowerCase();
        return pick.includes("@") ? pick.split("@")[0] : pick;
    } catch {
        return "";
    }
}

function getLocalLoginId() {
    const candidates = ["loginId", "user_id", "userid", "kullaniciId", "girisYapanKullanici"];
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
    const s = normalizePath(path).replace(/^\//, "");
    const core = s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return "p_" + (core || "anasayfa");
}

/* ============ Alias ve APP_PAGES tabanlı map ============ */
const PATH_ALIASES = {
    "/raporlar/eta-uyumsuz": "/raporlar/eta-uyumsuzlugu",

    // ✅ UYGULAMADAKİ GERÇEK ROUTE -> APP_PAGES ROUTE
    "/hakedis/filoiskontoluhakedis": "/hakedis/filo-iskontolu-hakedis",
};

const PAGE_MAP = new Map(APP_PAGES.map((p) => [normalizePath(p.path), pathToColumn(p.path)]));

/* ===================== Hook ===================== */
export default function usePageAccess() {
    const [row, setRow] = useState(null);
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
                    if (mounted) setRow({});
                    return;
                }

                let userId = getLocalLoginId();
                let loginRow = null;

                if (!userId) {
                    const raw = getLocalUsername();
                    if (!raw) {
                        if (mounted) setRow(null);
                        return;
                    }

                    const like = `%${raw.replace(/[%_]/g, "")}%`;

                    const { data, error } = await supabase
                        .from("login")
                        .select("id, kullaniciAdi, kullanici")
                        .or(`kullaniciAdi.ilike.${like},kullanici.ilike.${like}`)
                        .order("id", { ascending: true })
                        .limit(1);

                    if (error) throw error;

                    loginRow = Array.isArray(data) ? data[0] : null;
                    userId = loginRow?.id ? Number(loginRow.id) : null;
                }

                if (!userId) {
                    console.warn("[access] userId bulunamadı. me:", me);
                    if (mounted) setRow(null);
                    return;
                }

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
                    message: e?.message,
                    code: e?.code,
                    details: e?.details,
                    hint: e?.hint,
                    error: e,
                });
                if (mounted) setRow(null);
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [isAdmin, me]);

    const whitelist = useMemo(() => new Set(["/", "/anasayfa"]), []);

    const hasAccess = useCallback(
        (path) => {
            let p = normalizePath(path);
            if (PATH_ALIASES[p]) p = PATH_ALIASES[p];

            if (isAdmin) return true;
            if (whitelist.has(p)) return true;
            if (!row) return false;

            const col = PAGE_MAP.get(p) || pathToColumn(p);
            const ok = row[col] === true;

            console.log("[access] CHECK", { rawPath: path, normalized: p, col, val: row[col], ok });
            if (!ok) console.log("[access] BLOCK:", { path: p, col, row });

            return ok;
        },
        [row, whitelist, isAdmin]
    );

    return { loading, hasAccess };
}
