// src/lib/hedefSpotService.js
import { supabase } from "../supabaseClient";
import { toUpperTr, normalizeDoc, normalizeTitle } from "./textUtils";
import { fetchOdakSmart } from "./api"; // ← mevcut çalışan API wrapper'ını kullan

const HEDEF = "HEDEF TÜKETİM ÜRÜNLERİ SANAYİ VE DIŞ TİCARET ANONİM ŞİRKETİ";

const atStart = (iso) => `${iso}T00:00:00`;
const atEnd = (iso) => `${iso}T23:59:59`;

/** Verilen tarih aralığı için mevcut wrapper ile veri çek */
async function fetchOrdersByRange({ startISO, endISO, userId = 1 }) {
    const body = {
        startDate: atStart(startISO),
        endDate: atEnd(endISO),
        userId,
        CustomerId: 0,
        SupplierId: 0,
        DriverId: 0,
        TMSDespatchId: 0,
        VehicleId: 0,
        DocumentPrint: "0",
        WorkingTypesId: [],
    };

    // fetchOdakSmart backend yolunu, methodunu, tokenını zaten doğru ayarlıyor
    const res = await fetchOdakSmart(body);
    const rows = Array.isArray(res?.rows) ? res.rows : Array.isArray(res) ? res : [];
    return rows;
}

/** HEDEF + SPOT + Pickup=KOCAELİ filtresi */
export function applyFilter(rows) {
    return rows.filter(
        (r) =>
            normalizeTitle(r?.CustomerFullTitle) === HEDEF &&
            toUpperTr(r?.VehicleWorkingTypeName) === "SPOT" &&
            toUpperTr(r?.PickupCityName) === "KOCAELİ"
    );
}

/** DeliveryCityName'e göre sayım → ilk 3 */
export function top3ByDelivery(rows) {
    const m = new Map();
    for (const r of rows) {
        const city = toUpperTr(r?.DeliveryCityName || "ŞEHİR YOK");
        m.set(city, (m.get(city) || 0) + 1);
    }
    return [...m.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
        .slice(0, 3)
        .map(([city, count]) => ({ city, count }));
}

/** Supabase’e upsert (cache) */
export async function upsertRows(rows) {
    if (!rows?.length) return;

    const payload = rows
        .map((r) => ({
            tms_doc_norm: normalizeDoc(r?.TMSVehicleRequestDocumentNo),
            delivery_city: toUpperTr(r?.DeliveryCityName || "ŞEHİR YOK"),
            pickup_city: toUpperTr(r?.PickupCityName || ""),
            vehicle_working_type: toUpperTr(r?.VehicleWorkingTypeName || ""),
            customer_title: normalizeTitle(r?.CustomerFullTitle || ""),
            raw: r,
        }))
        .filter((x) => x.tms_doc_norm);

    if (!payload.length) return;

    const { error } = await supabase
        .from("hedef_spot_cache")
        .upsert(payload, {
            onConflict: "tms_doc_norm,delivery_city,pickup_city",
            ignoreDuplicates: true,
            returning: "minimal",
        });

    if (error) throw error;
}

/** Orkestrasyon: aralık + filtre + upsert + top3 */
export async function fetchFilterPersistAndSummarizeRange({ startISO, endISO, userId = 1 }) {
    const all = await fetchOrdersByRange({ startISO, endISO, userId });
    const filtered = applyFilter(all);
    await upsertRows(filtered);
    const top3 = top3ByDelivery(filtered);
    return { filtered, top3 };
}

/** Son 30 gün için kolay çağrı (opsiyonel) */
export async function fetchFilterPersistAndSummarizeLast30({ userId = 1 } = {}) {
    const today = new Date();
    const endISO = today.toISOString().slice(0, 10);
    const d30 = new Date(today);
    d30.setDate(d30.getDate() - 30);
    const startISO = d30.toISOString().slice(0, 10);
    return fetchFilterPersistAndSummarizeRange({ startISO, endISO, userId });
}
