// src/raporlar/tools.js
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import PivotTool from "./PivotTool"; // Dosya: src/raporlar/PivotTool.jsx (aşağıda)

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// helpers
const num = (v) => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
};
const toISO = (d) => {
    if (!d) return undefined;
    try {
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return String(d);
        return dt.toISOString().slice(0, 10);
    } catch { return String(d); }
};

export default function Tools() {
    const [datasets, setDatasets] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                // 2) izinler
                const { data: izinlerRaw, error: e2 } = await supabase
                    .from("izinler")
                    .select("id, plaka_treyler, surucu_adi, surucu_telefon, surucu_tc, izin_turu, baslangic_tarihi, bitis_tarihi, gun_sayisi, aciklama, ekleyen_kullanici, eklenme_tarihi, is_basi_tarihi, yukleme_tarihi")
                    .limit(100000);
                if (e2) throw e2;
                const izinler = (izinlerRaw || []).map((r) => ({
                    ...r,
                    baslangic_tarihi: toISO(r.baslangic_tarihi),
                    bitis_tarihi: toISO(r.bitis_tarihi),
                    is_basi_tarihi: toISO(r.is_basi_tarihi),
                    yukleme_tarihi: toISO(r.yukleme_tarihi),
                    gun_sayisi: num(r.gun_sayisi),
                }));

                // 3) kesintiler
                const { data: kesintilerRaw, error: e3 } = await supabase
                    .from("kesintiler")
                    .select("id, plaka_treyler, kesinti_turu, baslangic_tarihi, bitis_tarihi, gun_sayisi, aciklama, ekleyen_kullanici, eklenme_tarihi, neden")
                    .limit(100000);
                if (e3) throw e3;
                const kesintiler = (kesintilerRaw || []).map((r) => ({
                    ...r,
                    baslangic_tarihi: toISO(r.baslangic_tarihi),
                    bitis_tarihi: toISO(r.bitis_tarihi),
                    gun_sayisi: num(r.gun_sayisi),
                }));

                // 4) planlama
                const { data: planlamaRaw, error: e4 } = await supabase
                    .from("planlama")
                    .select("id, sefer_no, sevk_no, tarih, plaka, ad_soyad, telefon, tc, varis_tarihi, son_nokta, fatura_musteri, yukleme_noktasi, tahliye_noktasi, tahliye_il, tonaj, bir_onceki_is, duzenleyen, duzenleme_tarihi, bolge")
                    .limit(100000);
                if (e4) throw e4;
                const planlama = (planlamaRaw || []).map((r) => ({
                    ...r,
                    tarih: toISO(r.tarih),
                    varis_tarihi: toISO(r.varis_tarihi),
                    tonaj: num(r.tonaj),
                }));

                // 5) sefer_detaylari
                const { data: detayRaw, error: e5 } = await supabase
                    .from("sefer_detaylari")
                    .select("id, sefer_id, proje_adi, yukleme_noktasi, yukleme_ili, yukleme_ilcesi, teslim_noktasi, teslim_ili, teslim_ilcesi, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis, kayit_zamani, arac_statu, nokta_sirasi, kalan_surus_s, eta, kayitli_km, yeni_km, km_aciklama")
                    .limit(200000);
                if (e5) throw e5;
                const sefer_detaylari = (detayRaw || []).map((r) => ({
                    ...r,
                    yukleme_varis: r.yukleme_varis ? new Date(r.yukleme_varis).toISOString() : undefined,
                    yukleme_cikis: r.yukleme_cikis ? new Date(r.yukleme_cikis).toISOString() : undefined,
                    teslim_varis: r.teslim_varis ? new Date(r.teslim_varis).toISOString() : undefined,
                    teslim_cikis: r.teslim_cikis ? new Date(r.teslim_cikis).toISOString() : undefined,
                    kayit_zamani: r.kayit_zamani ? new Date(r.kayit_zamani).toISOString() : undefined,
                    eta: r.eta ? new Date(r.eta).toISOString() : undefined,
                    nokta_sirasi: num(r.nokta_sirasi),
                    kayitli_km: num(r.kayitli_km),
                    yeni_km: num(r.yeni_km),
                }));

                // 6) seferler
                const { data: seferlerRaw, error: e6 } = await supabase
                    .from("seferler")
                    .select("id, arac_statu, sefer_tarihi, sefer_no, plaka, treyler, surucu_ad_soyad, surucu_tckn, surucu_telefon, musteri_adi, hizmet_adi, proje_adi, yukleme_noktasi, yukleme_ili, yukleme_ilcesi, teslim_noktasi, teslim_ili, teslim_ilcesi, irsaliye_no, kayit_zamani, atama_yapan, atama_tarihi, reel_durum, kalan_surus_s, eta, kayitli_km, yeni_km, km_aciklama")
                    .limit(200000);
                if (e6) throw e6;
                const seferler = (seferlerRaw || []).map((r) => ({
                    ...r,
                    sefer_tarihi: r.sefer_tarihi ? new Date(r.sefer_tarihi).toISOString() : undefined,
                    kayit_zamani: r.kayit_zamani ? new Date(r.kayit_zamani).toISOString() : undefined,
                    atama_tarihi: r.atama_tarihi ? new Date(r.atama_tarihi).toISOString() : undefined,
                    eta: r.eta ? new Date(r.eta).toISOString() : undefined,
                    kayitli_km: num(r.kayitli_km),
                    yeni_km: num(r.yeni_km),
                }));

                // 7) tamamlanan_detaylar
                const { data: tamamDetayRaw, error: e7 } = await supabase
                    .from("tamamlanan_detaylar")
                    .select("sefer_no, nokta_sirasi, proje_adi, yukleme_noktasi, yukleme_ili, yukleme_ilcesi, teslim_noktasi, teslim_ili, teslim_ilcesi, yukleme_varis, yukleme_cikis, teslim_varis, teslim_cikis, kayit_zamani, arac_statu, kayitli_km, yeni_km, km_aciklama")
                    .limit(200000);
                if (e7) throw e7;
                const tamamlanan_detaylar = (tamamDetayRaw || []).map((r) => ({
                    ...r,
                    nokta_sirasi: num(r.nokta_sirasi),
                    yukleme_varis: r.yukleme_varis ? new Date(r.yukleme_varis).toISOString() : undefined,
                    yukleme_cikis: r.yukleme_cikis ? new Date(r.yukleme_cikis).toISOString() : undefined,
                    teslim_varis: r.teslim_varis ? new Date(r.teslim_varis).toISOString() : undefined,
                    teslim_cikis: r.teslim_cikis ? new Date(r.teslim_cikis).toISOString() : undefined,
                    kayit_zamani: r.kayit_zamani ? new Date(r.kayit_zamani).toISOString() : undefined,
                    kayitli_km: num(r.kayitli_km),
                    yeni_km: num(r.yeni_km),
                }));

                // 8) tamamlanan_seferler
                const { data: tamSeferRaw, error: e8 } = await supabase
                    .from("tamamlanan_seferler")
                    .select("id, sefer_no, plaka, treyler, surucu_ad_soyad, surucu_tckn, surucu_telefon, musteri_adi, hizmet_adi, proje_adi, yukleme_noktasi, yukleme_ili, yukleme_ilcesi, teslim_noktasi, teslim_ili, teslim_ilcesi, irsaliye_no, sefer_tarihi, atama_yapan, atama_tarihi, kayit_zamani, arac_statu, kayitli_km, yeni_km, km_aciklama")
                    .limit(200000);
                if (e8) throw e8;
                const tamamlanan_seferler = (tamSeferRaw || []).map((r) => ({
                    ...r,
                    sefer_tarihi: r.sefer_tarihi ? new Date(r.sefer_tarihi).toISOString() : undefined,
                    kayit_zamani: r.kayit_zamani ? new Date(r.kayit_zamani).toISOString() : undefined,
                    atama_tarihi: r.atama_tarihi ? new Date(r.atama_tarihi).toISOString() : undefined,
                    kayitli_km: num(r.kayitli_km),
                    yeni_km: num(r.yeni_km),
                }));

                setDatasets({
                    izinler,
                    kesintiler,
                    planlama,
                    sefer_detaylari,
                    seferler,
                    tamamlanan_detaylar,
                    tamamlanan_seferler,
                });
            } catch (err) {
                console.error(err);
                setError(err.message || String(err));
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const defaultDataset = useMemo(
        () => (datasets.seferler ? "seferler" : Object.keys(datasets)[0]),
        [datasets]
    );

    if (loading) return <div style={{ padding: 16 }}>Veriler yükleniyor…</div>;
    if (error) return <div style={{ padding: 16, color: "crimson" }}>Hata: {error}</div>;

    return <PivotTool datasets={datasets} defaultDataset={defaultDataset} />;
}
