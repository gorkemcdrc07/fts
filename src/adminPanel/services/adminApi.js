// src/adminPanel/services/adminApi.js
import { supabase } from "../../supabaseClient";

// Alan adlarını kendi tablolarına göre güncelle
export async function listUsers() {
    const { data, error } = await supabase
        .from("login")
        .select("id, ad, email, role_key, aktif")
        .order("kayit_zamani", { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function upsertUser(payload) {
    const { error } = await supabase.from("kullanicilar").upsert(payload, { onConflict: "email" });
    if (error) throw error;
}

export async function listRoles() {
    const { data, error } = await supabase
        .from("roller")
        .select("key, canSync, canEdit, canETA, mayOpenEdit, mayOpenETA")
        .order("key");
    if (error) throw error;
    return data || [];
}

export async function upsertRole(payload) {
    const { error } = await supabase.from("roller").upsert(payload, { onConflict: "key" });
    if (error) throw error;
}
