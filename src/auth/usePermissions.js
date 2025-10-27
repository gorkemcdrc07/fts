import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

/** Ekran -> kolon eşlemesi (user_permissions & role_permissions’ta bulunan GERÇEK kolon isimleri) */
const MAP_BY_SCREEN = {
    aktif_seferler: [
        "aktif_can_sync",
        "aktif_can_edit",
        "aktif_can_eta",
        "aktif_may_open_edit",
        "aktif_may_open_eta",
        "aktif_can_delete",
    ],
    /** Tamamlanan Seferler: sadece detay düzenleme butonu */
    tamamlanan_seferler: [
        "tmam_can_edit_details",
    ],
    planlama: ["pln_update", "pln_save", "pln_export_excel", "pln_import_excel"],
    arac_durumlari: ["adur_create", "adur_edit", "adur_delete"],
    arac_yonetimi: ["ayon_create", "ayon_edit", "ayon_delete"],
    kesinti_yonetimi: ["kes_create", "kes_edit", "kes_delete"],
    tedarikci_masraf: ["tdm_create", "tdm_edit", "tdm_delete", "tdm_may_open_edit"],
    arac_cari_fiyat: [
        "acf_create", "acf_edit", "acf_delete",
        // alan-bazlı edit anahtarları:
        "acf_edit_cari_id",
        "acf_edit_cari_adi",
        "acf_edit_arac_sahibi",
        "acf_edit_odak_tipi",
        "acf_edit_aylik_kira",
        "acf_edit_aylik_surucu",
        "acf_edit_calisma_gunu",
        "acf_edit_pasif",
    ],
    hakedis_seferleri: ["hks_upload"],
    izin_yonetimi: ["izin_create", "izin_edit", "izin_delete"],
};

/** Rol adı -> role.key normalize */
const ROLE_NAME_TO_KEY = {
    "YÖNETİCİ": "YONETICI",
    "OPERASYON": "OPERASYON",
    "TAKİP": "TAKIP",
};

const looksLikeUUID = (s) =>
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

/** Bir satırda olası birkaç anahtardan ilk boolean olanı döndür (esnek şema toleransı) */
const pickFirstBool = (row, keys) => {
    if (!row) return undefined;
    for (const k of keys) {
        if (k in row && (row[k] === true || row[k] === false)) return row[k];
    }
    return undefined;
};

/** override (kullanıcı) null değilse onu kullan, değilse rol değerini miras al */
const coalesceOverride = (overrideVal, roleVal) =>
    (overrideVal === true || overrideVal === false) ? overrideVal : !!roleVal;

/** create/edit/delete için ekran bazında muhtemel anahtar listeleri */
const CANDIDATES = {
    create: ["izin_create", "ayon_create", "adur_create", "kes_create", "tdm_create", "acf_create", "hks_upload"],
    edit: [
        "izin_edit", "ayon_edit", "adur_edit", "kes_edit", "tdm_edit", "acf_edit",
        // arac_cari_fiyat alan-bazlı edit anahtarları da genel canEdit hesabına girsin:
        "acf_edit_cari_id",
        "acf_edit_cari_adi",
        "acf_edit_arac_sahibi",
        "acf_edit_odak_tipi",
        "acf_edit_aylik_kira",
        "acf_edit_aylik_surucu",
        "acf_edit_calisma_gunu",
        "acf_edit_pasif",
        // Tamamlanan seferler: sadece bu anahtar edit kabul edilsin
        "tmam_can_edit_details",
    ],
    delete: [
        "aktif_can_delete", // Aktif sefer silme yetkisi
        "izin_delete",
        "ayon_delete",
        "adur_delete",
        "kes_delete",
        "tdm_delete",
        "acf_delete",
    ],
};

/**
 * usePermissions(screenKey)
 * {
 *   loading: boolean,
 *   canCreate: boolean,
 *   canEdit: boolean,
 *   canDelete: boolean,
 *   flags: { [permKey:boolean] }
 * }
 */
export default function usePermissions(screenKey) {
    const [state, setState] = useState({
        loading: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        flags: {},
    });

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                setState((s) => ({ ...s, loading: true }));

                const userId = parseInt(localStorage.getItem("kullaniciId") || "", 10);
                if (!userId) {
                    if (!cancelled) setState({ loading: false, canCreate: false, canEdit: false, canDelete: false, flags: {} });
                    return;
                }

                // 1) login -> rol bilgisi
                const { data: userRow, error: eUser } = await supabase
                    .from("login")
                    .select("id, rol, kullanici")
                    .eq("id", userId)
                    .maybeSingle();
                if (eUser) throw eUser;

                // 2) roleId bul (UUID ise direkt; değilse roles.key ile)
                let roleId = null;
                if (userRow?.rol) {
                    if (looksLikeUUID(userRow.rol)) {
                        roleId = userRow.rol;
                    } else {
                        const roleKey =
                            ROLE_NAME_TO_KEY[String(userRow.rol || "").toUpperCase()] ||
                            String(userRow.rol || "").toUpperCase();
                        const { data: roleRow, error: eR } = await supabase
                            .from("roles")
                            .select("id,key")
                            .eq("key", roleKey)
                            .maybeSingle();
                        if (eR) throw eR;
                        roleId = roleRow?.id || null;
                    }
                }

                // 3) role_permissions (önce screen_key ile; yoksa fallback tek satır)
                let rolePerm = {};
                if (roleId) {
                    let rp = null;
                    let eRP = null;
                    ({ data: rp, error: eRP } = await supabase
                        .from("role_permissions")
                        .select("*")
                        .eq("screen_key", screenKey)
                        .eq("role_id", roleId)
                        .maybeSingle());
                    if (eRP) throw eRP;

                    if (!rp) {
                        const res = await supabase
                            .from("role_permissions")
                            .select("*")
                            .eq("role_id", roleId)
                            .maybeSingle();
                        rp = res.data || {};
                    }
                    rolePerm = rp || {};
                }

                // 4) user_permissions (tek satır)
                const { data: up, error: eUP } = await supabase
                    .from("user_permissions")
                    .select("*")
                    .eq("user_id", userId)
                    .maybeSingle();
                if (eUP) throw eUP;

                // 5) ekranın beklenen anahtarları
                const screenKeys = MAP_BY_SCREEN[screenKey] || [];

                // 6) her anahtar için user override + role mirası
                const flags = {};
                for (const key of screenKeys) {
                    const userVal = pickFirstBool(up, [key]);
                    const roleVal = pickFirstBool(rolePerm, [key]); // isimler artık birebir
                    flags[key] = coalesceOverride(userVal, roleVal) === true;
                }

                // 7) kolay erişim alanları (create/edit/delete varsa)
                const findFirstTrue = (candidates) => {
                    for (const k of candidates) {
                        if (screenKeys.includes(k) && flags[k] === true) return true;
                    }
                    return false;
                };

                const canCreate = findFirstTrue(CANDIDATES.create);
                const canEdit = findFirstTrue(CANDIDATES.edit);
                const canDelete = findFirstTrue(CANDIDATES.delete);

                if (!cancelled) {
                    setState({
                        loading: false,
                        canCreate,
                        canEdit,
                        canDelete,
                        flags,
                    });
                }
            } catch (e) {
                console.error("usePermissions load error:", e);
                if (!cancelled) {
                    setState({ loading: false, canCreate: false, canEdit: false, canDelete: false, flags: {} });
                }
            }
        })();

        return () => { cancelled = true; };
    }, [screenKey]);

    return state;
}
