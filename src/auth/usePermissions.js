// src/auth/usePermissions.js
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const mapByScreen = {
    aktif_seferler: [
        "aktif_can_sync",
        "aktif_can_edit",
        "aktif_can_eta",
        "aktif_may_open_edit",
        "aktif_may_open_eta",
    ],
    planlama: ["pln_update", "pln_save", "pln_export_excel", "pln_import_excel"],
    arac_durumlari: ["adur_create", "adur_edit", "adur_delete"],
    arac_yonetimi: ["ayon_create", "ayon_edit", "ayon_delete"],
    kesinti_yonetimi: ["kes_create", "kes_edit", "kes_delete"],
    tedarikci_masraf: ["tdm_create", "tdm_edit", "tdm_delete", "tdm_may_open_edit"],
    arac_cari_fiyat: ["acf_create", "acf_edit", "acf_delete"],
    hakedis_seferleri: ["hks_upload"],
};

export default function usePermissions(screenKey) {
    const [state, setState] = useState({ loading: true });

    useEffect(() => {
        (async () => {
            try {
                const userId = parseInt(localStorage.getItem("kullaniciId"), 10);
                if (!userId) return setState({ loading: false });

                // Tek satır / kullanıcı
                const { data, error } = await supabase
                    .from("user_permissions")
                    .select("*")
                    .eq("user_id", userId)
                    .maybeSingle();

                if (error) throw error;

                const keys = mapByScreen[screenKey] || [];
                const perms = { loading: false, roleKey: null };

                keys.forEach((k) => { perms[k] = data ? data[k] === true : false; });

                setState(perms);
            } catch (e) {
                console.error("usePermissions load error:", e);
                setState({ loading: false });
            }
        })();
    }, [screenKey]);

    return state;
}
