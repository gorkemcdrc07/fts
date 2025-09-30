// src/kullanıcıIslemleri/planlamaDetay/SiparisAnaliz.js
import React, { useEffect, useState } from "react";
import { fetchOdakSmart } from "../../lib/api";

/** ---- YALNIZCA BU SÜTUNLAR GÖSTERİLECEK ---- */
const COLUMNS = [
    { key: "CurrentAccountTitle", label: "CurrentAccountTitle" },
    { key: "ProjectName", label: "ProjectName" },
    { key: "VehicleWorkingName", label: "VehicleWorkingName" },
    { key: "OrderDate", label: "OrderDate" },
    { key: "PickupAddressCode", label: "PickupAddressCode" },
    { key: "PickupCityName", label: "PickupCityName" },
    { key: "PickupCountyName", label: "PickupCountyName" },
    { key: "DeliveryAddressCode", label: "DeliveryAddressCode" },
    { key: "DeliveryCityName", label: "DeliveryCityName" },
    { key: "DeliveryCountyName", label: "DeliveryCountyName" },
];

/** ---- API farklı isimlerle dökerse yedek anahtarlar ---- */
const ALIASES = {
    CurrentAccountTitle: ["CurrentAccountTitle", "Cari", "AccountTitle", "CurrentAccount", "Current_Account_Title"],
    ProjectName: ["ProjectName", "Project_Name", "PROJE_ADI"],
    VehicleWorkingName: ["VehicleWorkingName", "VehicleWorking", "Vehicle_Working_Name"],
    // OrderDate yoksa PickupDate'e düş
    OrderDate: ["OrderDate", "Order_Date", "OrderDateTime", "PickupDate"],
    PickupAddressCode: ["PickupAddressCode", "PickupAddress_Code", "PickupAddress"],
    PickupCityName: ["PickupCityName", "PickupCity", "Pickup_City_Name"],
    PickupCountyName: ["PickupCountyName", "PickupCounty", "Pickup_Town_Name", "PickupTownName"],
    DeliveryAddressCode: ["DeliveryAddressCode", "DeliveryAddress_Code", "DeliveryAddress"],
    DeliveryCityName: ["DeliveryCityName", "DeliveryCity", "Delivery_City_Name"],
    DeliveryCountyName: ["DeliveryCountyName", "DeliveryCounty", "Delivery_Town_Name", "DeliveryTownName"],
};

function firstDefined(obj, keys) {
    for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null) return v;
    }
    return undefined;
}

function fmtDateMaybe(v) {
    if (!v) return "-";
    // ISO ya da "YYYY-MM-DDTHH:mm:ss" benzeri ise biçimle
    const s = String(v);
    const d = new Date(s);
    if (isNaN(d.getTime())) return s; // tanınmıyorsa olduğu gibi göster
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

export default function SiparisAnaliz() {
    const today = new Date().toISOString().slice(0, 10);
    const [startDate, setStartDate] = useState(`${today}T00:00:00`);
    const [endDate, setEndDate] = useState(`${today}T23:59:59`);
    const [userId, setUserId] = useState(1);

    const [rows, setRows] = useState([]);
    const [hit, setHit] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true); setErr(""); setRows([]);
        try {
            const { rows, hit } = await fetchOdakSmart({ startDate, endDate, userId });
            setRows(Array.isArray(rows) ? rows : []);
            setHit(hit);
        } catch (e) {
            setErr(e.message || "Hata");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []); // ilk yüklemede çek

    return (
        <div style={{ padding: 16 }}>
            <h2>Sipariş Analiz (ODAK)</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12 }}>Başlangıç</label>
                <input
                    type="datetime-local"
                    value={startDate.slice(0, 16)}
                    onChange={(e) => setStartDate(e.target.value + ":00")}
                />
                <label style={{ fontSize: 12 }}>Bitiş</label>
                <input
                    type="datetime-local"
                    value={endDate.slice(0, 16)}
                    onChange={(e) => setEndDate(e.target.value + ":59")}
                />
                <label style={{ fontSize: 12 }}>UserId</label>
                <input type="number" value={userId} onChange={e => setUserId(+e.target.value || 1)} />
                <button onClick={load} disabled={loading}>{loading ? "Yükleniyor..." : "Yenile"}</button>
            </div>

            {hit && <div style={{ fontSize: 12, opacity: .8, marginBottom: 8 }}>Hit: {hit}</div>}
            {err && <pre style={{ color: "#c00", whiteSpace: "pre-wrap" }}>{err}</pre>}

            <div style={{ overflow: "auto", border: "1px solid #ddd" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead>
                        <tr>
                            {COLUMNS.map(c => (
                                <th key={c.key} style={{ textAlign: "left", padding: "6px 8px", position: "sticky", top: 0, background: "#fafafa", borderBottom: "1px solid #eee" }}>
                                    {c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && rows.length === 0 && (
                            <tr><td colSpan={COLUMNS.length} style={{ padding: 8 }}>Kayıt yok</td></tr>
                        )}
                        {rows.map((r, i) => (
                            <tr key={i}>
                                {COLUMNS.map((c) => {
                                    let raw = firstDefined(r, ALIASES[c.key] || [c.key]);
                                    if (c.key === "OrderDate") raw = fmtDateMaybe(raw);
                                    if (raw === undefined || raw === null || raw === "") raw = "-";
                                    if (typeof raw === "object") raw = JSON.stringify(raw);
                                    return (
                                        <td key={c.key} style={{ padding: "6px 8px", borderTop: "1px solid #eee", whiteSpace: "nowrap" }}>
                                            {String(raw)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
