import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

/** "YÖNETİCİ" -> "YONETICI" gibi normalize eden yardımcı */
const normalizeKey = (s = "") =>
    s
        .normalize("NFKC")
        .toLocaleUpperCase("tr-TR")
        .replaceAll("İ", "I")
        .replace(/[^\w]/g, ""); // boşluk/diakritik temizle

/** Tip güvenliği: "false"/"0" stringleri vs. için sağlam boolean çevirici */
const toBool = (v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        return s === "true" || s === "1" || s === "t" || s === "yes";
    }
    return false;
};

export default function usePermissions() {
    const [state, setState] = useState({
        loading: true,
        roleKey: "",
        // etkili (merge edilmiş) yetkiler:
        canSync: false,
        canEdit: false,
        canETA: false,
        mayOpenEdit: false,
        mayOpenETA: false,
        // ham veriler:
        _role: null,
        _rolePerm: null,
        _userPerm: null,
    });

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                // LocalStorage’dan bilgileri al
                const rawRole =
                    localStorage.getItem("roleKey") ||
                    localStorage.getItem("rol") ||
                    "";
                const roleKey = normalizeKey(rawRole); // "YONETICI" / "OPERASYON" / "TAKIP"
                const userId = Number(localStorage.getItem("kullaniciId") || "0") || null;

                // 1) roles tablosundan id’yi çek
                let role = null;
                {
                    const { data, error } = await supabase
                        .from("roles")
                        .select("id,key,name")
                        .eq("key", roleKey)
                        .maybeSingle();
                    if (error) throw error;
                    role = data || null;
                }

                // 2) role_permissions (role default)
                let rolePerm = null;
                if (role?.id) {
                    const { data, error } = await supabase
                        .from("role_permissions")
                        .select(
                            "role_id, can_sync, can_edit, can_eta, may_open_edit, may_open_eta"
                        )
                        .eq("role_id", role.id)
                        .maybeSingle();
                    if (error) throw error;
                    rolePerm =
                        data || {
                            role_id: role.id,
                            can_sync: false,
                            can_edit: false,
                            can_eta: false,
                            may_open_edit: false,
                            may_open_eta: false,
                        };
                }

                // 3) user_permissions override (nullable bool)
                let userPerm = null;
                if (userId) {
                    const { data, error } = await supabase
                        .from("user_permissions")
                        .select(
                            "user_id, can_sync, can_edit, can_eta, may_open_edit, may_open_eta"
                        )
                        .eq("user_id", userId)
                        .maybeSingle();
                    if (error) throw error;
                    userPerm = data || null;
                }

                // 4) Merge: user override NULL değilse onu kullan, yoksa role default
                const effRaw = (k) =>
                    userPerm && userPerm[k] != null ? userPerm[k] : rolePerm?.[k];

                const next = {
                    loading: false,
                    roleKey,
                    canSync: toBool(effRaw("can_sync")),
                    canEdit: toBool(effRaw("can_edit")),
                    canETA: toBool(effRaw("can_eta")),
                    mayOpenEdit: toBool(effRaw("may_open_edit")),
                    mayOpenETA: toBool(effRaw("may_open_eta")),
                    _role: role,
                    _rolePerm: rolePerm,
                    _userPerm: userPerm,
                };

                if (alive) setState(next);

                // === Teşhis için konsol log (gerekirse açık bırak) ===
                // if (alive) {
                //   console.table({
                //     roleKey: next.roleKey,
                //     canSync: next.canSync,
                //     canEdit: next.canEdit,
                //     canETA: next.canETA,
                //     mayOpenEdit: next.mayOpenEdit,
                //     mayOpenETA: next.mayOpenETA,
                //     _role: next._role?.key,
                //     _rolePerm: next._rolePerm,
                //     _userPerm: next._userPerm,
                //   });
                // }
            } catch (e) {
                console.error("usePermissions load error:", e);
                if (alive) {
                    setState((p) => ({ ...p, loading: false }));
                }
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    return state;
}
