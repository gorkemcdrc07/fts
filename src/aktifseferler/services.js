// src/aktifseferler/services.js
import { supabase } from "../supabaseClient";
import { EXCLUDED_PLAKAS, normalizePlate } from "./utils/sefer";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export async function fetchSeferler(rangeMin, rangeMax) {
    const { data, error } = await supabase
        .from("seferler")
        .select("*")
        .gte("sefer_tarihi", rangeMin)
        .lte("sefer_tarihi", rangeMax)
        .ilike("sefer_no", "SFR%")
        .order("sefer_tarihi", { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function fetchTamamlananNos(rangeMin, rangeMax) {
    const { data } = await supabase
        .from("tamamlanan_seferler")
        .select("sefer_no")
        .gte("sefer_tarihi", rangeMin)
        .lte("sefer_tarihi", rangeMax);
    return new Set((data || []).map(x => (x.sefer_no ?? "").toString().trim()).filter(Boolean));
}

export async function syncFromTMS({ start, end }) {
    const res = await fetch(`${API_BASE_URL}/api/proxy/tmsdespatches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            startDate: start, endDate: end, userId: 1,
            CustomerId: 0, SupplierId: 0, DriverId: 0, TMSDespatchId: 0, VehicleId: 0,
            DocumentPrint: "", WorkingTypesId: [3, 4],
        }),
    });
    if (!res.ok) throw new Error(`API Hatası: ${res.status} ${res.statusText}`);
    const json = await res.json();
    return Array.isArray(json?.Data) ? json.Data : [];
}

export function filterIncoming(list) {
    return list
        .filter(item => {
            const tip = (item?.VehicleWorkingTypeName || "").toUpperCase().trim();
            return tip === "FİLO" || tip === "ÖZMAL";
        })
        .filter(item => (item?.DocumentNo || "").toUpperCase().startsWith("SFR"))
        .filter(item => !EXCLUDED_PLAKAS.has(normalizePlate(item?.PlateNumber)));
}

export async function upsertSeferler(rows) {
    if (!rows?.length) return;
    const { error } = await supabase.from("seferler").upsert(rows, { onConflict: "sefer_no" }).select();
    if (error) throw error;
}

export async function loadDetaylar(seferId) {
    const { data } = await supabase
        .from("sefer_detaylari")
        .select("*")
        .eq("sefer_id", seferId)
        .order("nokta_sirasi", { ascending: true });
    return data || [];
}

export async function updateSefer(id, payload) {
    const { error } = await supabase.from("seferler").update(payload).eq("id", id);
    if (error) throw error;
}

export async function upsertDetaylar(rows) {
    if (!rows?.length) return;
    const { error } = await supabase
        .from("sefer_detaylari")
        .upsert(rows, { onConflict: "sefer_id,nokta_sirasi" });
    if (error) throw error;
}

export async function moveToCompleted({ ana, detay }) {
    const { error: e1 } = await supabase
        .from("tamamlanan_seferler")
        .upsert(ana, { onConflict: "sefer_no" });
    if (e1) throw e1;

    if (detay?.length) {
        const { error: e2 } = await supabase
            .from("tamamlanan_detaylar")
            .upsert(detay, { onConflict: "sefer_no,nokta_sirasi" });
        if (e2) throw e2;
    }
    await supabase.from("sefer_detaylari").delete().eq("sefer_id", ana.id);
    await supabase.from("seferler").delete().eq("id", ana.id);
}

export async function fetchMesafe({ yIl, yIlce, tIl, tIlce }) {
    const { data } = await supabase
        .from("mesafeler")
        .select("mesafe")
        .ilike("yukleme_il", yIl)
        .ilike("yukleme_ilce", yIlce)
        .ilike("teslim_il", tIl)
        .ilike("teslim_ilce", tIlce)
        .maybeSingle();
    return data?.mesafe ?? null;
}
