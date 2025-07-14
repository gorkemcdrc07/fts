import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

import useFiltre from '../hooks/filtreKancasi';
import useKolonSirala from '../hooks/kolonSiralaKancasi';

import TemelFiltreler from '../components/Filters/TemelFiltreler';
import GelismisFiltreler from '../components/Filters/GelismisFiltreler';
import SeferTablosu from '../components/Tablolar/SeferTablosu';
import DetaySatirlari from '../components/Tablolar/DetaySatirlari';

import { hucreAyir } from '../utils/veriYardimcilari';
import { veriListele } from '../utils/supabaseYardimcilar';

const senkronizeEt = async (
    setVeriler,
    setIsLoading,
    setSuccessCount,
    setShowSuccess,
    startDate,
    endDate
) => {
    setIsLoading(true);

    try {
        const toDateString = (date) => date.toISOString().split('T')[0];

        const start = startDate
            ? startDate
            : toDateString(new Date(new Date().setDate(new Date().getDate() - 6)));
        const end = endDate ? endDate : toDateString(new Date());

        const body = {
            startDate: `${start}T00:00:00`,
            endDate: `${end}T23:59:59`,
            userId: 1,
        };

        // Burada URL'yi sabit olarak değiştiriyoruz
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'; // ✅
        const response = await fetch(`${API_BASE_URL}/api/proxy/tmsdespatches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`API Hatası: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();

        if (!json || !Array.isArray(json.Data)) {
            setVeriler([]);
            setIsLoading(false);
            return;
        }

        const gelen = json.Data.filter((item) => item && typeof item === 'object');

        const filtreli = gelen.filter((item) => {
            const tip = (item?.VehicleWorkingTypeName || '').toString().trim().toUpperCase();
            return tip === 'FİLO' || tip === 'ÖZMAL';
        });

        if (filtreli.length === 0) {
            setVeriler([]);
            setIsLoading(false);
            return;
        }

        const ordersMap = (orders, field) => {
            if (!Array.isArray(orders)) return '';
            return orders
                .filter((o) => o && typeof o === 'object')
                .map((o) => o[field] ?? '')
                .filter(Boolean)
                .join('; ');
        };

        const temizVeri = filtreli.map((sefer) => {
            const tmsOrders = Array.isArray(sefer.TMSOrders) ? sefer.TMSOrders : [];
            return {
                sefer_no: sefer?.DocumentNo ?? '',
                arac_statu: sefer?.VehicleStatus ?? '',
                plaka: sefer?.PlateNumber ?? '',
                treyler: sefer?.TrailerPlateNumber ?? '',
                surucu_ad_soyad: sefer?.FullName ?? '',
                surucu_tckn: sefer?.CitizenNumber ?? '',
                surucu_telefon: sefer?.PhoneNumber ?? '',
                musteri_adi: sefer?.CustomerFullTitle ?? '',
                musteri_siparis_no: sefer?.CustomerOrderNumber ?? '',
                hizmet_adi: sefer?.ServiceName ?? '',
                proje_adi: ordersMap(tmsOrders, 'ProjectName'),
                yukleme_noktasi: ordersMap(tmsOrders, 'PickupAddressCode'),
                yukleme_ili: ordersMap(tmsOrders, 'PickupCityName'),
                yukleme_ilcesi: ordersMap(tmsOrders, 'PickupCountyName'),
                teslim_alan_firma: ordersMap(tmsOrders, 'DeliveryCurrentAccountName'),
                teslim_noktasi: ordersMap(tmsOrders, 'DeliveryAddressCode'),
                teslim_ili: ordersMap(tmsOrders, 'DeliveryCityName'),
                teslim_ilcesi: ordersMap(tmsOrders, 'DeliveryCountyName'),
                irsaliye_no: sefer?.TMSDespatchWaybillNumber ?? '',
                sefer_tarihi: sefer?.DespatchDate ?? null,
                atama_yapan_kullanici: sefer?.TMSDespatchCreatedBy ?? '',
                atama_tarihi: sefer?.TMSDespatchCreatedDate ?? null,
                kayit_zamani: new Date().toISOString(),
            };
        });

        const { data: mevcutVeri, error } = await supabase
            .from('seferler')
            .select('*')
            .gte('sefer_tarihi', `${start}T00:00:00`)
            .lte('sefer_tarihi', `${end}T23:59:59`);

        if (error) {
            setVeriler([]);
            setIsLoading(false);
            return;
        }

        const mevcutVeriSafe = mevcutVeri ?? [];
        const dbMap = new Map(mevcutVeriSafe.map((item) => [item.sefer_no, item]));
        const gelenSeferNos = new Set(temizVeri.map((v) => v.sefer_no));

        const yeniVeriler = temizVeri.map((item) => ({
            ...item,
            reel_durum: dbMap.has(item.sefer_no) ? 'EŞLEŞTİ' : 'YENİ',
        }));

        const eksikVeriler = mevcutVeriSafe
            .filter((item) => !gelenSeferNos.has(item.sefer_no))
            .map((item) => ({ ...item, reel_durum: 'EŞLEŞME YOK' }));

        const { data: upsertSonucu, error: upsertError } = await supabase
            .from('seferler')
            .upsert(yeniVeriler, {
                onConflict: ['sefer_no'],
                returning: 'representation',
            });

        if (upsertError) {
            setVeriler([]);
            setIsLoading(false);
            return;
        }

        const upsertSonucuSafe = upsertSonucu ?? [];
        const guncellenmisVeriler = upsertSonucuSafe.map((item) => ({
            ...item,
            reel_durum: dbMap.has(item.sefer_no) ? 'EŞLEŞTİ' : 'YENİ',
        }));

        const eksikVerilerFinal = mevcutVeriSafe
            .filter((item) => !guncellenmisVeriler.some((v) => v.sefer_no === item.sefer_no))
            .map((item) => ({ ...item, reel_durum: 'EŞLEŞME YOK' }));

        setVeriler([...guncellenmisVeriler, ...eksikVerilerFinal]);
        setSuccessCount(guncellenmisVeriler.length);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 4000);
    } catch {
        setVeriler([]);
    } finally {
        setIsLoading(false);
    }
};

const ReelAtananSeferler = () => {
    const { filtreler, setFiltreler, filtreleriTemizle } = useFiltre({
        secilenSeferler: [],
        plaka: '',
        musteriAdi: '',
        projeAdi: '',
        yuklemeNoktasi: '',
        yuklemeIl: '',
        yuklemeIlce: '',
        teslimNoktasi: '',
        teslimIl: '',
        teslimIlce: '',
        atamaYapan: '',
        aracStatu: '',
        noktaSayisi: '',
        seferNoTipi: '',
        startDate: '',
        endDate: '',
    });

    const { kolonlar, setKolonlar, suruklemeyiBaslat, birakildi, suruklemeyeIzinVer } = useKolonSirala([]);

    const [veriler, setVeriler] = useState([]);
    const [tumSeferler, setTumSeferler] = useState([]);
    const [genisSatirlar, setGenisSatirlar] = useState(new Set());
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [successCount, setSuccessCount] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);

    const navigate = useNavigate();
    const kullaniciAdi = localStorage.getItem('kullaniciAdi')?.toUpperCase();
    const senkronizeYetkili = kullaniciAdi === 'ADMIN' || kullaniciAdi === 'SELİN';

    const handleDetailChange = (seferNo, satirIndex, alan, newValue) => {
        setVeriler((prevVeriler) =>
            prevVeriler.map((sefer) => {
                if (sefer.sefer_no !== seferNo) return sefer;
                const hucreleri = hucreAyir(sefer[alan] || '');
                hucreleri[satirIndex] = newValue;
                return {
                    ...sefer,
                    [alan]: hucreleri.join('; '),
                };
            })
        );
    };

    useEffect(() => {
        supabase
            .from('seferler')
            .select('sefer_no')
            .order('sefer_no', { ascending: true })
            .then(({ data }) => {
                const secenekler =
                    data
                        ?.map((d) => d.sefer_no?.trim())
                        .filter(Boolean)
                        .filter((v, i, arr) => arr.indexOf(v) === i)
                        .map((v) => ({ label: v, value: v })) || [];
                setTumSeferler(secenekler);
            });
    }, []);

    useEffect(() => {
        const kullaniciId = parseInt(localStorage.getItem('kullaniciId'));
        if (!kullaniciId) return;

        supabase
            .from('kullanici_gorunumleri')
            .select('gorunum')
            .eq('kullanici_id', kullaniciId)
            .single()
            .then(({ data }) => {
                if (data?.gorunum) {
                    setKolonlar(data.gorunum);
                }
            });
    }, []);

    const applyFilters = (data) => {
        const icindeVar = (deger, filtre) =>
            filtre.trim() === '' || (deger?.toString().toLowerCase() ?? '').includes(filtre.trim().toLowerCase());
        const esitMi = (deger, filtre) =>
            filtre.trim() === '' || (deger?.toString().toLowerCase() ?? '') === filtre.trim().toLowerCase();
        const sayiUyarla = (deger) => {
            const num = parseInt(deger);
            return isNaN(num) ? null : num;
        };

        return data.filter(
            (item) =>
                icindeVar(item.plaka, filtreler.plaka) &&
                icindeVar(item.musteri_adi, filtreler.musteriAdi) &&
                icindeVar(item.proje_adi, filtreler.projeAdi) &&
                icindeVar(item.yukleme_noktasi, filtreler.yuklemeNoktasi) &&
                icindeVar(item.yukleme_ili, filtreler.yuklemeIl) &&
                icindeVar(item.yukleme_ilcesi, filtreler.yuklemeIlce) &&
                icindeVar(item.teslim_noktasi, filtreler.teslimNoktasi) &&
                icindeVar(item.teslim_ili, filtreler.teslimIl) &&
                icindeVar(item.teslim_ilcesi, filtreler.teslimIlce) &&
                icindeVar(item.atama_yapan_kullanici, filtreler.atamaYapan) &&
                esitMi(item.arac_statu, filtreler.aracStatu) &&
                (sayiUyarla(filtreler.noktaSayisi) === null || item.nokta_sayisi === sayiUyarla(filtreler.noktaSayisi)) &&
                (filtreler.seferNoTipi === '' || (item.sefer_no ?? '').toUpperCase().startsWith(filtreler.seferNoTipi)) &&
                (!filtreler.secilenSeferler ||
                    filtreler.secilenSeferler.length === 0 ||
                    filtreler.secilenSeferler.some((s) => s.value === item.sefer_no))
        );
    };

    const filtrelenmisVeri = useMemo(() => applyFilters(veriler), [veriler, filtreler]);

    const listeleTikla = async () => {
        const yeniVeri = await veriListele(filtreler);
        setVeriler(yeniVeri);

        if (yeniVeri.length > 0 && kolonlar.length === 0) {
            const varsayilanKolonlar = Object.keys(yeniVeri[0]).filter(
                (k) =>
                    ![
                        'sefer_detaylari',
                        'reel_durum',
                        'yukleme_varis',
                        'yukleme_cikis',
                        'teslim_varis',
                        'teslim_cikis',
                    ].includes(k)
            );
            setKolonlar(varsayilanKolonlar);
        }
    };

    const senkronizeTikla = async () => {
        await senkronizeEt(setVeriler, setIsLoading, setSuccessCount, setShowSuccess, filtreler.startDate, filtreler.endDate);
        listeleTikla();
    };

    const gorunumKaydet = async () => {
        const kullaniciId = parseInt(localStorage.getItem('kullaniciId'));
        if (!kullaniciId) return alert('❌ Kullanıcı bulunamadı!');
        const { error } = await supabase.from('kullanici_gorunumleri').upsert({
            kullanici_id: kullaniciId,
            gorunum: kolonlar,
        });
        if (!error) alert('✅ Görünüm kaydedildi.');
        else alert('❌ Hata oluştu.');
    };

    const detaylariKaydet = async () => {
        setSaving(true);
        try {
            const detaylar = [];

            for (const sefer of veriler) {
                const splitMap = {
                    yukleme_varis: hucreAyir(sefer.yukleme_varis),
                    yukleme_cikis: hucreAyir(sefer.yukleme_cikis),
                    teslim_varis: hucreAyir(sefer.teslim_varis),
                    teslim_cikis: hucreAyir(sefer.teslim_cikis),
                };

                const max = Math.max(...Object.values(splitMap).map((d) => d.length));

                for (let i = 0; i < max; i++) {
                    detaylar.push({
                        sefer_id: sefer.id,
                        nokta_sirasi: i,
                        yukleme_varis: splitMap.yukleme_varis[i] || null,
                        yukleme_cikis: splitMap.yukleme_cikis[i] || null,
                        teslim_varis: splitMap.teslim_varis[i] || null,
                        teslim_cikis: splitMap.teslim_cikis[i] || null,
                    });
                }
            }

            const { error } = await supabase.from('sefer_detaylari').upsert(detaylar, {
                onConflict: ['sefer_id', 'nokta_sirasi'],
            });

            if (!error) alert('🟢 Detaylar kaydedildi');
        } catch (err) {
            alert('🔴 Kayıt hatası');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="reel-wrapper">
            <button className="geri-buton" onClick={() => navigate(-1)}>
                ← Geri
            </button>

            <TemelFiltreler
                filtreler={filtreler}
                setFiltreler={setFiltreler}
                senkronizeYetkili={senkronizeYetkili}
                listeleTikla={listeleTikla}
                senkronizeTikla={senkronizeTikla}
                detayKaydetTikla={detaylariKaydet}
                gorunumKaydetTikla={gorunumKaydet}
                gelismisFiltreToggle={() => setShowAdvancedFilters((prev) => !prev)}
                gelismisFiltreAcik={showAdvancedFilters}
                kaydetmeDurumu={saving}
            />

            {showAdvancedFilters && (
                <GelismisFiltreler
                    filtreler={filtreler}
                    setFiltreler={setFiltreler}
                    filtreleriTemizle={filtreleriTemizle}
                    secenekler={{
                        plaka: [],
                        musteriAdi: [],
                        projeAdi: [],
                        yuklemeNoktasi: [],
                        yuklemeIl: [],
                        yuklemeIlce: [],
                        teslimNoktasi: [],
                        teslimIl: [],
                        teslimIlce: [],
                        atamaYapan: [],
                        aracStatu: [],
                        seferNo: tumSeferler,
                    }}
                />
            )}

            <SeferTablosu
                veriler={veriler}
                filtrelenmisVeriler={filtrelenmisVeri}
                kolonlar={kolonlar}
                suruklemeyiBaslat={suruklemeyiBaslat}
                suruklemeyeIzinVer={suruklemeyeIzinVer}
                birakildi={birakildi}
                genisletilenSatirlar={genisSatirlar}
                setGenisletilenSatirlar={setGenisSatirlar}
                handleDetailChange={handleDetailChange}  // Buraya ekledik
            />

            {isLoading && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(255,255,255,0.7)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9999,
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#228be6',
                    }}
                >
                    Senkronize ediliyor...
                </div>
            )}

            {showSuccess && (
                <div
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        backgroundColor: '#38a169',
                        color: '#fff',
                        padding: '1rem 1.5rem',
                        borderRadius: '12px',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
                        zIndex: 10000,
                        fontWeight: '600',
                    }}
                >
                    {successCount} kayıt başarıyla güncellendi.
                </div>
            )}
        </div>
    );
};

export default ReelAtananSeferler;
