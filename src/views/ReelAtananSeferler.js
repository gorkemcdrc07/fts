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
import { Helmet } from 'react-helmet-async';


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
    const start = startDate || toDateString(new Date(new Date().setDate(new Date().getDate() - 6)));
    const end = endDate || toDateString(new Date());

    const body = {
      startDate: `${start}T00:00:00`,
      endDate: `${end}T23:59:59`,
      userId: 1,
    };

    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
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
      return;
    }

    const gelen = json.Data.filter((item) => item && typeof item === 'object');
    const filtreli = gelen.filter((item) => {
      const tip = (item?.VehicleWorkingTypeName || '').toString().trim().toUpperCase();
      return tip === 'FİLO' || tip === 'ÖZMAL';
    });

    if (filtreli.length === 0) {
      setVeriler([]);
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
        sefer_no: sefer?.DocumentNo?.trim() ?? '',
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
        arac_statu: sefer?.VehicleStatus ?? '',
      };
    });

    const { data: mevcutVeri, error } = await supabase
      .from('seferler')
      .select('*')
      .gte('sefer_tarihi', `${start}T00:00:00`)
      .lte('sefer_tarihi', `${end}T23:59:59`);

    if (error) {
      console.error('Supabase Hatası:', error);
      setVeriler([]);
      return;
    }

    const mevcutVeriSafe = mevcutVeri ?? [];
    const dbMap = new Map(mevcutVeriSafe.map((item) => [item.sefer_no?.trim(), item]));
    const gelenSeferNos = new Set(temizVeri.map((v) => v.sefer_no?.trim()).filter(Boolean));

const upsertList = [];
const yeniVeriler = [];

for (const item of temizVeri) {
    const eski = dbMap.get(item.sefer_no);

    if (!eski) {
        const yeni = { ...item, reel_durum: 'YENİ' };
        yeniVeriler.push(yeni);
        upsertList.push(yeni); // ✅ reel_durum dahil
    } else {
        const degistiMi = Object.keys(item).some((key) => item[key] !== eski[key]);
        if (degistiMi) {
            const guncellenmis = { ...item, reel_durum: 'GÜNCELLENDİ' };
            yeniVeriler.push(guncellenmis);
            upsertList.push(guncellenmis); // ✅ reel_durum dahil
        } else {
            const ayni = { ...eski, reel_durum: 'EŞLEŞTİ' };
            yeniVeriler.push(ayni);
            upsertList.push(ayni); // ✅ bunu da ekliyoruz ki Supabase'e yazılsın
        }
    }
}

    const yeniSeferNos = new Set(yeniVeriler.map((v) => v.sefer_no?.trim()));

    const eksikVeriler = mevcutVeriSafe
      .filter((item) => item.sefer_no && !gelenSeferNos.has(item.sefer_no.trim()))
      .filter((item) => !yeniSeferNos.has(item.sefer_no.trim()))
      .map((item) => ({ ...item, reel_durum: 'EŞLEŞME YOK' }));

    const upsertEksikler = eksikVeriler.map(({ id, ...rest }) => ({
      ...rest,
      reel_durum: 'EŞLEŞME YOK',
    }));

    const upsertPayload = [...upsertList, ...upsertEksikler];

    console.log('Yeni:', yeniVeriler.length);
    console.log('Eksik:', eksikVeriler.length);
    console.log('Upsert toplam:', upsertPayload.length);

    if (upsertPayload.length > 0) {
      await supabase.from('seferler').upsert(upsertPayload, {
        onConflict: ['sefer_no'],
      });
    }

    setVeriler([...yeniVeriler, ...eksikVeriler]);
    setSuccessCount(upsertList.length);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 4000);
  } catch (err) {
    console.error('Senkronizasyon hatası:', err);
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
    const [genisletilenSatirlar, setGenisletilenSatirlar] = useState(new Set());
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [successCount, setSuccessCount] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);
    const [degisenSeferler, setDegisenSeferler] = useState(new Set());


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

        // ✅ Satırı "yeşil" göstermek için ekle deneme
        setDegisenSeferler((prev) => {
            const yeni = new Set(prev);
            yeni.add(seferNo);
            return yeni;
        });
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
    const filtreSecenekleri = useMemo(() => {
        if (!Array.isArray(veriler)) return {};

        const unique = (key) =>
            [...new Set(veriler.map((v) => v[key]).filter(Boolean))].map((val) => ({
                label: val,
                value: val,
            }));

        return {
            plaka: unique('plaka'),
            musteriAdi: unique('musteri_adi'),
            projeAdi: unique('proje_adi'),
            yuklemeNoktasi: unique('yukleme_noktasi'),
            yuklemeIl: unique('yukleme_ili'),
            yuklemeIlce: unique('yukleme_ilcesi'),
            teslimNoktasi: unique('teslim_noktasi'),
            teslimIl: unique('teslim_ili'),
            teslimIlce: unique('teslim_ilcesi'),
            atamaYapan: unique('atama_yapan_kullanici'),
            aracStatu: unique('arac_statu'),
            seferNo: veriler
                .filter((v) => v && typeof v === 'object' && v.sefer_no)
                .map((v) => ({
                    label: v.sefer_no,
                    value: v.sefer_no,
                })),
        };
    }, [veriler]); // ✅ useMemo düzgün kapatıldı

    const filtrelenmisVeri = useMemo(() => applyFilters(veriler), [veriler, filtreler]);

    const listeleTikla = async () => {
        const yeniVeri = await veriListele(filtreler);
        setVeriler(yeniVeri);

        if (yeniVeri.length > 0 && kolonlar.length === 0) {
    const varsayilanKolonlar = [
        'arac_statu',
        'sefer_tarihi',
        'sefer_no',
        'plaka',
        'treyler',
        'surucu_ad_soyad',
        'surucu_tckn',
        'surucu_telefon',
        'musteri_adi',
        'musteri_siparis_no',
        'hizmet_adi',
        'proje_adi',
        'yukleme_noktasi',
        'yukleme_ili',
        'yukleme_ilcesi',
        'teslim_alan_firma',
        'teslim_noktasi',
        'teslim_ili',
        'teslim_ilcesi',
        'irsaliye_no',
        'kayit_zamani',
        'atama_yapan_kullanici',
        'atama_tarihi',
        'reel_durum' // ✅ EKLENDİ
    ];
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
                const hucreleriTemizle = (dizi) =>
                    (dizi || []).map((v) => {
                        const trimmed = (v || '').trim();
                        return trimmed === '' || trimmed === '-' || trimmed === '---' ? null : trimmed;
                    });

                const splitMap = {
                    yukleme_varis: hucreAyir(sefer.yukleme_varis),
                    yukleme_cikis: hucreAyir(sefer.yukleme_cikis),
                    teslim_varis: hucreAyir(sefer.teslim_varis),
                    teslim_cikis: hucreAyir(sefer.teslim_cikis),
                    proje_adi: hucreAyir(sefer.proje_adi),
                    yukleme_noktasi: hucreAyir(sefer.yukleme_noktasi),
                    yukleme_ili: hucreAyir(sefer.yukleme_ili),
                    yukleme_ilcesi: hucreAyir(sefer.yukleme_ilcesi),
                    teslim_noktasi: hucreAyir(sefer.teslim_noktasi),
                    teslim_ili: hucreAyir(sefer.teslim_ili),
                    teslim_ilcesi: hucreAyir(sefer.teslim_ilcesi),
                };

                const max = Math.max(...Object.values(splitMap).map((d) => d.length));

                for (let i = 0; i < max; i++) {
                    detaylar.push({
                        sefer_id: sefer.id,
                        nokta_sirasi: i,
                        yukleme_varis: hucreleriTemizle(splitMap.yukleme_varis)[i] || null,
                        yukleme_cikis: hucreleriTemizle(splitMap.yukleme_cikis)[i] || null,
                        teslim_varis: hucreleriTemizle(splitMap.teslim_varis)[i] || null,
                        teslim_cikis: hucreleriTemizle(splitMap.teslim_cikis)[i] || null,
                        proje_adi: hucreleriTemizle(splitMap.proje_adi)[i] || null,
                        yukleme_noktasi: hucreleriTemizle(splitMap.yukleme_noktasi)[i] || null,
                        yukleme_ili: hucreleriTemizle(splitMap.yukleme_ili)[i] || null,
                        yukleme_ilcesi: hucreleriTemizle(splitMap.yukleme_ilcesi)[i] || null,
                        teslim_noktasi: hucreleriTemizle(splitMap.teslim_noktasi)[i] || null,
                        teslim_ili: hucreleriTemizle(splitMap.teslim_ili)[i] || null,
                        teslim_ilcesi: hucreleriTemizle(splitMap.teslim_ilcesi)[i] || null,
                        arac_statu: sefer.arac_statu || null,
                        kayit_zamani: new Date().toISOString(),
                    });
                }
            }

            console.log('Supabase’e gönderilecek detaylar:', detaylar);

            const { error } = await supabase.from('sefer_detaylari').upsert(detaylar, {
                onConflict: ['sefer_id', 'nokta_sirasi'],
            });

            if (!error) alert('🟢 Detaylar kaydedildi');
            else throw error;
        } catch (err) {
            console.error('Kayıt hatası:', err);
            alert('🔴 Kayıt hatası');
        } finally {
            setSaving(false);
        }
    };

    // ✅ Tamamlananları Aktar fonksiyonu
    const tamamlananlariAktarTikla = async () => {
        const tamamlananlar = veriler.filter(
            (v) => v.arac_statu?.toUpperCase().trim() === 'SEFER TAMAMLANDI'
        );

        if (tamamlananlar.length === 0) {
            alert('⚠️ Aktarılacak tamamlanan sefer yok.');
            return;
        }

        try {
            // ✅ Ana veriler
            const anaVeriler = tamamlananlar.map((v) => ({
                arac_statu: v.arac_statu ?? null,
                sefer_tarihi: v.sefer_tarihi ?? null,
                sefer_no: v.sefer_no ?? null,
                plaka: v.plaka ?? null,
                treyler: v.treyler ?? null,
                surucu_ad_soyad: v.surucu_ad_soyad ?? null,
                surucu_tckn: v.surucu_tckn ?? null,
                surucu_telefon: v.surucu_telefon ?? null,
                musteri_adi: v.musteri_adi ?? null,
                musteri_siparis_no: v.musteri_siparis_no ?? null,
                hizmet_adi: v.hizmet_adi ?? null,
                proje_adi: v.proje_adi ?? null,
                yukleme_noktasi: v.yukleme_noktasi ?? null,
                yukleme_ili: v.yukleme_ili ?? null,
                yukleme_ilcesi: v.yukleme_ilcesi ?? null,
                teslim_alan_firma: v.teslim_alan_firma ?? null,
                teslim_noktasi: v.teslim_noktasi ?? null,
                teslim_ili: v.teslim_ili ?? null,
                teslim_ilcesi: v.teslim_ilcesi ?? null,
                irsaliye_no: v.irsaliye_no ?? null,
                kayit_zamani: new Date().toISOString(),
                atama_yapan_kullanici: v.atama_yapan_kullanici ?? null,
                atama_tarihi: v.atama_tarihi ?? null,
            }));

            const { data: anaSonuc, error: anaError } = await supabase
                .from('tamamlanan_seferler')
                .upsert(anaVeriler, { onConflict: ['sefer_no'], returning: 'representation' });

            if (anaError) throw anaError;

            // ✅ Detay veriler
            const detaylar = [];

            for (const sefer of tamamlananlar) {
                const hucreAyikla = (val) => (val || '').split(';').map((v) => v.trim());

                const splitMap = {
                    proje_adi: hucreAyikla(sefer.proje_adi),
                    yukleme_noktasi: hucreAyikla(sefer.yukleme_noktasi),
                    yukleme_ili: hucreAyikla(sefer.yukleme_ili),
                    yukleme_ilcesi: hucreAyikla(sefer.yukleme_ilcesi),
                    teslim_noktasi: hucreAyikla(sefer.teslim_noktasi),
                    teslim_ili: hucreAyikla(sefer.teslim_ili),
                    teslim_ilcesi: hucreAyikla(sefer.teslim_ilcesi),
                    yukleme_varis: hucreAyikla(sefer.yukleme_varis),
                    yukleme_cikis: hucreAyikla(sefer.yukleme_cikis),
                    teslim_varis: hucreAyikla(sefer.teslim_varis),
                    teslim_cikis: hucreAyikla(sefer.teslim_cikis),
                };

                const max = Math.max(...Object.values(splitMap).map((dizi) => dizi.length));

                for (let i = 0; i < max; i++) {
                    detaylar.push({
                        sefer_no: sefer.sefer_no,
                        nokta_sirasi: i,
                        proje_adi: splitMap.proje_adi[i] ?? null,
                        yukleme_noktasi: splitMap.yukleme_noktasi[i] ?? null,
                        yukleme_ili: splitMap.yukleme_ili[i] ?? null,
                        yukleme_ilcesi: splitMap.yukleme_ilcesi[i] ?? null,
                        teslim_noktasi: splitMap.teslim_noktasi[i] ?? null,
                        teslim_ili: splitMap.teslim_ili[i] ?? null,
                        teslim_ilcesi: splitMap.teslim_ilcesi[i] ?? null,
                        yukleme_varis: splitMap.yukleme_varis[i] ?? null,
                        yukleme_cikis: splitMap.yukleme_cikis[i] ?? null,
                        teslim_varis: splitMap.teslim_varis[i] ?? null,
                        teslim_cikis: splitMap.teslim_cikis[i] ?? null,
                        kayit_zamani: new Date().toISOString(),
                        arac_statu: sefer.arac_statu ?? null,
                    });
                }
            }

            const { error: detayError } = await supabase
                .from('tamamlanan_detaylar')
                .upsert(detaylar, { onConflict: ['sefer_no', 'nokta_sirasi'] });

            if (detayError) throw detayError;

            // ✅ Aktardıktan sonra eski kayıtları sil
            const seferNos = tamamlananlar.map((v) => v.sefer_no);
            const seferIds = tamamlananlar.map((v) => v.id); // sefer_detaylari için

            await supabase.from('seferler').delete().in('sefer_no', seferNos);
            await supabase.from('sefer_detaylari').delete().in('sefer_id', seferIds);

            // ✅ UI'dan da temizle
            setVeriler((prev) => prev.filter((v) => !seferNos.includes(v.sefer_no)));

            alert(`✅ ${anaVeriler.length} sefer ve ${detaylar.length} detay aktarıldı ve silindi.`);
        } catch (err) {
            console.error('Aktarma hatası:', err);
            alert('❌ Aktarım sırasında hata oluştu.');
        }
    };



    return (
        <div className="reel-wrapper">
            <Helmet>
                <title>AKTİF SEFERLER</title>
            </Helmet>
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
                tamamlananlariAktarTikla={tamamlananlariAktarTikla} // ✅ BU SATIR YOKSA EKLE
                gelismisFiltreToggle={() => setShowAdvancedFilters((prev) => !prev)}
                gelismisFiltreAcik={showAdvancedFilters}
                kaydetmeDurumu={saving}
            />

            {showAdvancedFilters && (
                <GelismisFiltreler
                    filtreler={filtreler}
                    setFiltreler={setFiltreler}
                    filtreleriTemizle={filtreleriTemizle}
                    secenekler={filtreSecenekleri}
                />
            )}


            <SeferTablosu
                veriler={veriler}
                filtrelenmisVeriler={filtrelenmisVeri}
                kolonlar={kolonlar}
                suruklemeyiBaslat={suruklemeyiBaslat}
                suruklemeyeIzinVer={suruklemeyeIzinVer}
                birakildi={birakildi}
                genisletilenSatirlar={genisletilenSatirlar}
                setGenisletilenSatirlar={setGenisletilenSatirlar}
                handleDetailChange={handleDetailChange}
                degisenSeferler={degisenSeferler}

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
