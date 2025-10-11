// src/lib/planlamaViewStore.js
import { supabase } from "../supabaseClient";

const TABLE = "kullanici_planlama_gorunumleri";
const PAGE = "planlama";

/** Görünümü getir (tek satır) */
export async function getPlanlamaView(kullaniciId) {
    const { data, error } = await supabase
        .from(TABLE)
        .select("gorunum")
        .eq("kullanici_id", kullaniciId)
        .eq("sayfa", PAGE)
        .maybeSingle(); // varsa tek satır, yoksa null

    if (error) throw error;
    return data?.gorunum ?? null; // yoksa null döner
}

/** Görünümü kaydet (insert/update — upsert) */
export async function upsertPlanlamaView(kullaniciId, gorunumObj) {
    const row = {
        kullanici_id: kullaniciId,
        sayfa: PAGE,
        gorunum: gorunumObj ?? {},
    };

    const { error } = await supabase
        .from(TABLE)
        .upsert(row, { onConflict: "kullanici_id,sayfa" });

    if (error) throw error;
    return true;
}
