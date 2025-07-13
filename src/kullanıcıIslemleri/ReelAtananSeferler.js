import React, { useState, useEffect, useMemo } from 'react';import Select from 'react-select';
import { supabase } from '../supabaseClient';
import './ReelAtananSeferler.css';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';




function ReelAtananSeferler() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [veriler, setVeriler] = useState([]);
  const [tumSeferler, setTumSeferler] = useState([]);
  const [secilenSeferler, setSecilenSeferler] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [expandedRows, setExpandedRows] = useState(new Set());
    const [saving, setSaving] = useState(false);
    const [aracStatu, setAracStatu] = useState('');
    const [plaka, setPlaka] = useState('');
    const [musteriAdi, setMusteriAdi] = useState('');
    const [projeAdi, setProjeAdi] = useState('');
    const [yuklemeNoktasi, setYuklemeNoktasi] = useState('');
    const [yuklemeIl, setYuklemeIl] = useState('');
    const [yuklemeIlce, setYuklemeIlce] = useState('');
    const [teslimNoktasi, setTeslimNoktasi] = useState('');
    const [teslimIl, setTeslimIl] = useState('');
    const [teslimIlce, setTeslimIlce] = useState('');
    const [atamaYapan, setAtamaYapan] = useState('');
    const [noktaSayisi, setNoktaSayisi] = useState('');
    const [columns, setColumns] = useState([]);
    const navigate = useNavigate();
    const [seferNoTipi, setSeferNoTipi] = useState(''); // '', 'BOS', 'SFR'
    const kullaniciAdi = localStorage.getItem('kullaniciAdi')?.toUpperCase();
    const senkronizeYetkili = kullaniciAdi === 'ADMIN' || kullaniciAdi === 'SELİN';




    const [draggedColumn, setDraggedColumn] = useState(null);
    useEffect(() => {
        const fetchUserView = async () => {
            const kullaniciId = parseInt(localStorage.getItem('kullaniciId'));
            if (!kullaniciId) return;

            const { data, error } = await supabase
                .from('kullanici_gorunumleri')
                .select('gorunum')
                .eq('kullanici_id', kullaniciId)
                .single();

            if (!error && data?.gorunum) {
                setColumns(data.gorunum);
            }
        };

        fetchUserView();
    }, []);


const handleDragStart = (col) => {
  setDraggedColumn(col);
};

const handleDrop = (targetCol) => {
  if (!draggedColumn || draggedColumn === targetCol) return;

  const updated = [...columns];
  const fromIndex = updated.indexOf(draggedColumn);
  const toIndex = updated.indexOf(targetCol);

  updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, draggedColumn);

  setColumns(updated);
  setDraggedColumn(null);
};

const allowDrop = (e) => e.preventDefault();



    const filtreleriTemizle = () => {
        setAracStatu('');
        setNoktaSayisi('');
        setPlaka('');
        setMusteriAdi('');
        setProjeAdi('');
        setYuklemeNoktasi('');
        setYuklemeIl('');
        setYuklemeIlce('');
        setTeslimNoktasi('');
        setTeslimIl('');
        setTeslimIlce('');
        setAtamaYapan('');
        setSecilenSeferler([]);
    };



    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const plakaOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.plaka).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);

const musteriOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.musteri_adi).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);

const projeOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.proje_adi).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);

const yuklemeNoktasiOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.yukleme_noktasi).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);

const yuklemeIlOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.yukleme_ili).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);

const yuklemeIlceOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.yukleme_ilcesi).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);

const teslimNoktasiOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.teslim_noktasi).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);

const teslimIlOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.teslim_ili).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);

const teslimIlceOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.teslim_ilcesi).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);

const atamaYapanOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.atama_yapan_kullanici).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);

const aracStatuOptions = useMemo(() => {
  const unique = [...new Set(veriler.map(item => item.arac_statu).filter(Boolean))];
  return unique.map(v => ({ label: v, value: v }));
}, [veriler]);





  useEffect(() => {
    const fetchSeferNos = async () => {
      const { data, error } = await supabase
        .from('seferler')
        .select('sefer_no')
        .order('sefer_no', { ascending: true });

      if (error) {
        console.error('Sefer no çekme hatası:', error);
        return;
      }

      const options = data
        .map(item => item.sefer_no?.trim())
        .filter(no => no)
        .filter((no, index, self) => self.indexOf(no) === index)
        .map(no => ({ value: no, label: no }));

      setTumSeferler(options);
    };

    fetchSeferNos();
  }, []);



    const fetchFromDB = async () => {
        if (!startDate || !endDate) return;

        let query = supabase
            .from('seferler')
            .select('*, sefer_detaylari(*)')
            .gte('sefer_tarihi', `${startDate}T00:00:00`)
            .lte('sefer_tarihi', `${endDate}T23:59:59`)
            .order('sefer_tarihi', { ascending: false });

        if (secilenSeferler.length > 0) {
            const seferNoList = secilenSeferler.map(item => item.value.trim());
            query = query.in('sefer_no', seferNoList);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Veri çekme hatası:', error);
            return;
        }

        const birlesmis = data.map(sefer => {
            const detaylar = sefer.sefer_detaylari || [];

            const statuHesapla = () => {
                // Eğer tüm noktalar tamamen doluysa, "SEFER TAMAMLANDI" yaz
                const tumNoktalarTamam = detaylar.length > 0 && detaylar.every(d =>
                    d.yukleme_varis &&
                    d.yukleme_cikis &&
                    d.teslim_varis &&
                    d.teslim_cikis
                );

                if (tumNoktalarTamam) {
                    return 'SEFER TAMAMLANDI';
                }

                // Aksi halde nokta bazlı durumlar
                return detaylar
                    .map((d, index) => {
                        const tamamenBos = !d.yukleme_varis && !d.yukleme_cikis && !d.teslim_varis && !d.teslim_cikis;
                        if (tamamenBos) return null;

                        if (d.teslim_cikis) return `${index + 1}.NOKTADA TAMAMLANDI`;
                        if (d.teslim_varis) return `${index + 1}.NOKTADA BOŞALTMADA`;
                        if (d.yukleme_cikis) return `${index + 1}.NOKTADA YOLDA`;
                        if (d.yukleme_varis) return `${index + 1}.NOKTADA YÜKLEMEDE`;

                        return `${index + 1}.NOKTADA PLAKA ATANDI`;
                    })
                    .filter(Boolean)
                    .join('; ');
            };

            return {
                ...sefer,
                arac_statu: statuHesapla(),
                nokta_sayisi: detaylar.filter(d =>
                    Object.values(d).some(v => v !== null && v !== '' && v !== '-')
                ).length,
                yukleme_varis: detaylar.map(d => d.yukleme_varis || '-').join('; '),
                yukleme_cikis: detaylar.map(d => d.yukleme_cikis || '-').join('; '),
                teslim_varis: detaylar.map(d => d.teslim_varis || '-').join('; '),
                teslim_cikis: detaylar.map(d => d.teslim_cikis || '-').join('; ')
            };
        });



        setVeriler(birlesmis);

        // 🔹 Kolon sıralamasını sadece Supabase görünümü gelmediyse uygula
        if (birlesmis.length > 0 && columns.length === 0) {
            const defaultCols = Object.keys(birlesmis[0])
                .filter(key =>
                    key !== 'reel_durum' &&
                    key !== 'sefer_detaylari' &&
                    !['yukleme_varis', 'yukleme_cikis', 'teslim_varis', 'teslim_cikis'].includes(key)
                );

            setColumns(defaultCols);
        }
    }



    const sayacBilgisi = (data) => {
        const toplam = data.length;
        const bosSayisi = data.filter(d => (d.sefer_no || '').toUpperCase().startsWith('BOS')).length;
        const sfrSayisi = data.filter(d => (d.sefer_no || '').toUpperCase().startsWith('SFR')).length;

        return { toplam, bosSayisi, sfrSayisi };
    };









    const senkronizeEt = async () => {
        setIsLoading(true);

        try {
            const today = new Date();
            const startDateAuto = new Date(today);
            startDateAuto.setDate(today.getDate() - 6);

            const start = new Date('2025-06-23T00:00:00').toISOString();
            const end = new Date('2025-06-23T23:59:59').toISOString();

            const response = await fetch('https://fts-backend-onx4.onrender.com/api/seferler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDate: start, endDate: end, userId: 1 }),
            });

            const json = await response.json();
            console.log("🔍 Backend yanıtı:", json);

            if (!json || !Array.isArray(json.Data)) {
                console.error('❌ API yanıtı beklenen formatta değil:', json);
                setVeriler([]);
                return;
            }

            const gelen = json.Data.filter(item => item && typeof item === 'object');

            const filtreli = gelen.filter(item => {
                const tip = (item?.VehicleWorkingTypeName || '').toString().trim().toLocaleUpperCase('tr-TR');
                return tip === 'FİLO' || tip === 'ÖZMAL';
            });

            const ordersMap = (orders, field) => {
                try {
                    if (!Array.isArray(orders)) return '';
                    return orders.map(o => (o?.[field] ?? '')).filter(Boolean).join('; ');
                } catch (e) {
                    console.warn(`⚠ ordersMap hatası (${field}):`, e);
                    return '';
                }
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
                .gte('sefer_tarihi', start)
                .lte('sefer_tarihi', end);

            if (error) {
                console.error('Veritabanı veri çekme hatası:', error);
                return;
            }

            if (!Array.isArray(mevcutVeri)) {
                console.warn('mevcutVeri null veya dizi değil!');
                return;
            }

            const dbMap = new Map(mevcutVeri.map(item => [item.sefer_no, item]));
            const gelenSeferNos = new Set(temizVeri.map(v => v.sefer_no));

            const yeniVeriler = temizVeri.map(item => ({
                ...item,
                reel_durum: dbMap.has(item.sefer_no) ? 'EŞLEŞTİ' : 'YENİ',
            }));

            const eksikVeriler = mevcutVeri
                .filter(item => !gelenSeferNos.has(item.sefer_no))
                .map(item => ({ ...item, reel_durum: 'EŞLEŞME YOK' }));

            const { data: upsertSonucu, error: upsertError } = await supabase
                .from('seferler')
                .upsert(yeniVeriler, {
                    onConflict: ['sefer_no'],
                    returning: 'representation',
                });

            if (upsertError) {
                console.error('Supabase kayıt hatası:', upsertError);
            } else {
                const guncellenmisVeriler = upsertSonucu.map(item => ({
                    ...item,
                    reel_durum: dbMap.has(item.sefer_no) ? 'EŞLEŞTİ' : 'YENİ',
                }));

                const eksikVeriler = mevcutVeri
                    .filter(item => !guncellenmisVeriler.some(v => v.sefer_no === item.sefer_no))
                    .map(item => ({ ...item, reel_durum: 'EŞLEŞME YOK' }));

                setVeriler([...guncellenmisVeriler, ...eksikVeriler]);
                setSuccessCount(guncellenmisVeriler.length);
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 4000);
            }

        } catch (e) {
            console.error('❌ Senkronizasyon hatası:', e);
            setVeriler([]);
        } finally {
            setIsLoading(false);
        }
    };


    const applyFilters = (data) => {
        const icindeVar = (deger, filtre) =>
            filtre.trim() === '' || (deger || '').toLowerCase().includes(filtre.trim().toLowerCase());

        const esitMi = (deger, filtre) =>
            filtre.trim() === '' || (deger || '').toLowerCase() === filtre.trim().toLowerCase();

        const sayiUyarla = (deger) => {
            const num = parseInt(deger);
            return isNaN(num) ? null : num;
        };

        return data.filter((item) =>
            icindeVar(item.plaka, plaka) &&
            icindeVar(item.musteri_adi, musteriAdi) &&
            icindeVar(item.proje_adi, projeAdi) &&
            icindeVar(item.yukleme_noktasi, yuklemeNoktasi) &&
            icindeVar(item.yukleme_ili, yuklemeIl) &&
            icindeVar(item.yukleme_ilcesi, yuklemeIlce) &&
            icindeVar(item.teslim_noktasi, teslimNoktasi) &&
            icindeVar(item.teslim_ili, teslimIl) &&
            icindeVar(item.teslim_ilcesi, teslimIlce) &&
            icindeVar(item.atama_yapan_kullanici, atamaYapan) &&
            esitMi(item.arac_statu, aracStatu) &&
            (sayiUyarla(noktaSayisi) === null || item.nokta_sayisi === sayiUyarla(noktaSayisi)) &&
            (seferNoTipi === '' || (item.sefer_no || '').toUpperCase().startsWith(seferNoTipi))
        );
    };



const detaylariKaydet = async () => {
  setSaving(true);

  const normalizeTimestamp = (val) => (val && val !== '-' ? val : null);

  try {
    const upsertList = [];

    const tumSatirlar = [];

    for (const sefer of veriler) {
      const detayKeys = [
        'proje_adi', 'yukleme_noktasi', 'yukleme_ili', 'yukleme_ilcesi',
        'teslim_noktasi', 'teslim_ili', 'teslim_ilcesi',
        'yukleme_varis', 'yukleme_cikis', 'teslim_varis', 'teslim_cikis'
      ];

      const splitMap = {};
      detayKeys.forEach((key) => {
        splitMap[key] = splitCell(sefer[key]);
      });

      const maxLength = Math.max(...detayKeys.map((k) => splitMap[k].length));

      for (let index = 0; index < maxLength; index++) {
        const satirDoluMu = detayKeys.some(key => {
          const val = splitMap[key]?.[index];
          return val && val.trim() !== '' && val.trim() !== '-';
        });

        if (!satirDoluMu) continue;

        tumSatirlar.push({
          sefer_id: sefer.id,
          nokta_sirasi: index,
          arac_statu: sefer.arac_statu || null,
          proje_adi: splitMap['proje_adi'][index] || null,
          yukleme_noktasi: splitMap['yukleme_noktasi'][index] || null,
          yukleme_ili: splitMap['yukleme_ili'][index] || null,
          yukleme_ilcesi: splitMap['yukleme_ilcesi'][index] || null,
          teslim_noktasi: splitMap['teslim_noktasi'][index] || null,
          teslim_ili: splitMap['teslim_ili'][index] || null,
          teslim_ilcesi: splitMap['teslim_ilcesi'][index] || null,
          yukleme_varis: normalizeTimestamp(splitMap['yukleme_varis'][index]),
          yukleme_cikis: normalizeTimestamp(splitMap['yukleme_cikis'][index]),
          teslim_varis: normalizeTimestamp(splitMap['teslim_varis'][index]),
          teslim_cikis: normalizeTimestamp(splitMap['teslim_cikis'][index]),
        });
      }
    }

    // 🔍 Tüm mevcut kayıtları tek sorguda çek
    const ids = tumSatirlar.map(row => `(${row.sefer_id}, ${row.nokta_sirasi})`);
    const { data: mevcutlar, error: mevcutHata } = await supabase
      .from('sefer_detaylari')
      .select('sefer_id, nokta_sirasi, kayit_zamani');

    if (mevcutHata) throw mevcutHata;

    const mevcutMap = new Map(
      (mevcutlar || []).map(d => [`${d.sefer_id}_${d.nokta_sirasi}`, d.kayit_zamani])
    );

    // ⏱ sadece yeni olanlara kayit_zamani ekle
    for (const satir of tumSatirlar) {
      const key = `${satir.sefer_id}_${satir.nokta_sirasi}`;
      if (!mevcutMap.has(key)) {
        satir.kayit_zamani = new Date().toISOString();
      }
      upsertList.push(satir);
    }

    // 🔁 Tek seferde upsert
    const { error: upsertHata } = await supabase
      .from('sefer_detaylari')
      .upsert(upsertList, {
        onConflict: ['sefer_id', 'nokta_sirasi'],
        returning: 'minimal',
      });

    if (upsertHata) throw upsertHata;

    alert('🟢 Tüm detaylar başarıyla güncellendi.');
  } catch (error) {
    console.error('Detay kaydetme hatası:', error);
    alert('🔴 Kayıt sırasında bir hata oluştu.');
  } finally {
    setSaving(false);
  }
};


    const formatDate = (d) => {
        if (!d) return '-';
        return new Date(d).toLocaleString('tr-TR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleDetailChange = (sefer_no, rowIndex, key, newValue) => {
        setVeriler(prevVeriler => {
            return prevVeriler.map(item => {
                if (item.sefer_no !== sefer_no) return item;

                const updated = { ...item };
                const values = splitCell(updated[key]);
                values[rowIndex] = newValue;
                updated[key] = values.join('; ');

                const detayKeys = [
                    'proje_adi',
                    'yukleme_noktasi',
                    'yukleme_ili',
                    'yukleme_ilcesi',
                    'teslim_noktasi',
                    'teslim_ili',
                    'teslim_ilcesi',
                    'yukleme_varis',
                    'yukleme_cikis',
                    'teslim_varis',
                    'teslim_cikis',
                ];

                const splitMap = {};
                detayKeys.forEach((key) => {
                    splitMap[key] = splitCell(updated[key] ?? '');
                });

                const noktaSayisi = Math.max(...detayKeys.map(k => splitMap[k].length));
                const temiz = val => val && val !== '-' && val.trim() !== '';
                const parseDate = val => {
                    try {
                        return val ? new Date(val) : null;
                    } catch {
                        return null;
                    }
                };

                let statu = '';

                // 🔍 Zaman sıralaması kontrolü
                for (let i = 0; i < noktaSayisi; i++) {
                    const yuklemeVaris = parseDate(splitMap['yukleme_varis'][i]);
                    const yuklemeCikis = parseDate(splitMap['yukleme_cikis'][i]);
                    const teslimVaris = parseDate(splitMap['teslim_varis'][i]);
                    const teslimCikis = parseDate(splitMap['teslim_cikis'][i]);

                    const zamanHatali =
                        (teslimCikis && teslimVaris && teslimCikis <= teslimVaris) ||
                        (teslimVaris && yuklemeCikis && teslimVaris <= yuklemeCikis) ||
                        (yuklemeCikis && yuklemeVaris && yuklemeCikis <= yuklemeVaris);

                   
                }

                // ✅ Statü hesaplama
                let tamamlananNoktaSayisi = 0;

                for (let i = 0; i < noktaSayisi; i++) {
                    const varis = temiz(splitMap['yukleme_varis'][i]);
                    const cikis = temiz(splitMap['yukleme_cikis'][i]);
                    const teslimVaris = temiz(splitMap['teslim_varis'][i]);
                    const teslimCikis = temiz(splitMap['teslim_cikis'][i]);

                    if (!varis) {
                        statu = `${i + 1}.NOKTA BİLGİLERİ BEKLENİYOR`;
                        break;
                    } else if (!cikis) {
                        statu = `${i + 1}.NOKTADA YÜKLEMEDE`;
                        break;
                    } else if (!teslimVaris) {
                        statu = `${i + 1}.NOKTADA YOLDA`;
                        break;
                    } else if (!teslimCikis) {
                        statu = `${i + 1}.NOKTADA BOŞALTMADA`;
                        break;
                    } else {
                        tamamlananNoktaSayisi++;
                        statu = `${i + 1}.NOKTA TAMAMLANDI`;
                    }
                }

                if (tamamlananNoktaSayisi === noktaSayisi && noktaSayisi > 0) {
                    statu = 'SEFER TAMAMLANDI';
                }

                updated.arac_statu = statu;
                return updated;
            });
        });
    };














  // Tarih formatlama
  const formatCell = (value, showTime = false) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return showTime ? value.replace('T', ' ').substring(0, 16) : value.split('T')[0];
    }
    return value ?? '-';
  };

  // Durum etiketi renkleri
  const durumEtiketi = (durum) => {
    const renk = {
      'EŞLEŞTİ': 'reel-durum-eslesti',
      'YENİ': 'reel-durum-yeni',
      'EŞLEŞME YOK': 'reel-durum-yok',
    };
    return <span className={`reel-durum-badge ${renk[durum] || 'reel-durum-default'}`}>{durum}</span>;
  };

  // Satır aç/kapa
  const toggleRow = (sefer_no) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sefer_no)) newSet.delete(sefer_no);
      else newSet.add(sefer_no);
      return newSet;
    });
  };

  // ; ile ayrılanları diziye çevir
const splitCell = (value) => {
  return (value ?? '')
    .toString()
    .split(';')
    .map(v => v.trim())
    .filter(v => v !== '');
};
    const toDateTimeLocal = (isoString) => {
        // Eğer cellValue boşsa veya geçersizse bugünün tarihi ver
        let d = isoString && isoString !== '-' ? new Date(isoString) : new Date();

        if (isNaN(d.getTime())) d = new Date();

        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    };





    return (
        <div className="reel-wrapper">
            {/* ← Geri Butonu */}
            <div className="geri-buton-container">
                <button
                    className="geri-buton"
                    onClick={() => navigate(-1)}
                >
                    ← Geri
                </button>
            </div>


            {isLoading && (
                <div className="loading-overlay">
                    <div className="loading-box">
                        <div className="spinner" />
                        <span>Veriler senkronize ediliyor...</span>
                    </div>
                </div>
            )}

            {showSuccess && (
                <div className="success-toast">
                    <div className="success-icon">✔</div>
                    <div className="success-message">
                        {successCount} sefer başarıyla senkronize edildi.
                    </div>
                </div>
            )}


            <div className="reel-filters">
                {/* TEMEL ALANLAR */}
                <div className="filter-block">
                    <label>Başlangıç Tarihi</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>

                <div className="filter-block">
                    <label>Bitiş Tarihi</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div className="filter-block">
                    <label>SEFER NO TİPİ</label>
                    <Select
                        options={[
                            { label: 'Tümü', value: '' },
                            { label: 'BOS ile Başlayan', value: 'BOS' },
                            { label: 'SFR ile Başlayan', value: 'SFR' },
                        ]}
                        value={{ label: seferNoTipi || 'Tümü', value: seferNoTipi }}
                        onChange={e => setSeferNoTipi(e?.value || '')}
                        isClearable={false}
                        classNamePrefix="Select"
                    />
                </div>


              <div className="filter-buttons">
  <div className="left-buttons">
    <button className="btn btn-list" onClick={fetchFromDB}>
      📥 Listele
    </button>
                        {senkronizeYetkili && (
                            <button className="btn btn-sync" onClick={senkronizeEt}>
                                🔄 Senkronize Et
                            </button>
                        )}
    <button className="btn btn-save" disabled={saving} onClick={detaylariKaydet}>
      💾 {saving ? 'Kaydediliyor...' : 'Detayları Kaydet'}
    </button>

    {/* 💾 Görünüm Kaydet Butonu */}
                        <button
                            className="btn btn-clear"
                            onClick={async () => {
                                const kullaniciId = parseInt(localStorage.getItem('kullaniciId'));
                                if (!kullaniciId) {
                                    alert('❌ Kullanıcı bilgisi bulunamadı!');
                                    return;
                                }

                                const { error } = await supabase
                                    .from('kullanici_gorunumleri')
                                    .upsert({ kullanici_id: kullaniciId, gorunum: columns });

                                if (!error) {
                                    alert('✅ Görünüm kaydedildi!');
                                } else {
                                    console.error('Görünüm kayıt hatası:', error);
                                    alert('❌ Görünüm kaydedilemedi.');
                                }
                            }}
                        >
                            💾 Görünüm Kaydet
                        </button>
  </div>

  <button
    className="toggle-advanced toggle-button"
    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
  >
    {showAdvancedFilters ? '🔼 Gelişmiş Filtreleri Gizle' : '🔽 Gelişmiş Filtreleri Göster'}
  </button>
</div>


            </div>

{showAdvancedFilters && (
  <div className="advanced-filters">
    <div className="filter-block">
      <label>ARAÇ STATÜ</label>
      <Select
        options={aracStatuOptions}
        value={aracStatu ? { label: aracStatu, value: aracStatu } : null}
        onChange={e => setAracStatu(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Araç statü seçin"
        classNamePrefix="Select"
      />
    </div>
        <div className="filter-block">
      <label>NOKTA SAYISI</label>
      <input
        type="number"
        min="1"
        placeholder="Örn: 2"
        value={noktaSayisi}
        onChange={(e) => setNoktaSayisi(e.target.value)}
      />
    </div>


    <div className="filter-block">
      <label>PLAKA</label>
      <Select
        options={plakaOptions}
        value={plaka ? { label: plaka, value: plaka } : null}
        onChange={e => setPlaka(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Plaka seçin"
        classNamePrefix="Select"
      />
    </div>

    <div className="filter-block">
      <label>MÜŞTERİ ADI</label>
      <Select
        options={musteriOptions}
        value={musteriAdi ? { label: musteriAdi, value: musteriAdi } : null}
        onChange={e => setMusteriAdi(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Müşteri seçin"
        classNamePrefix="Select"
      />
    </div>

    <div className="filter-block">
      <label>PROJE ADI</label>
      <Select
        options={projeOptions}
        value={projeAdi ? { label: projeAdi, value: projeAdi } : null}
        onChange={e => setProjeAdi(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Proje seçin"
        classNamePrefix="Select"
      />
    </div>

    <div className="filter-block">
      <label>YÜKLEME NOKTASI</label>
      <Select
        options={yuklemeNoktasiOptions}
        value={yuklemeNoktasi ? { label: yuklemeNoktasi, value: yuklemeNoktasi } : null}
        onChange={e => setYuklemeNoktasi(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Yükleme noktası seçin"
        classNamePrefix="Select"
      />
    </div>

    <div className="filter-block">
      <label>YÜKLEME İLİ</label>
      <Select
        options={yuklemeIlOptions}
        value={yuklemeIl ? { label: yuklemeIl, value: yuklemeIl } : null}
        onChange={e => setYuklemeIl(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Yükleme ili seçin"
        classNamePrefix="Select"
      />
    </div>

    <div className="filter-block">
      <label>YÜKLEME İLÇESİ</label>
      <Select
        options={yuklemeIlceOptions}
        value={yuklemeIlce ? { label: yuklemeIlce, value: yuklemeIlce } : null}
        onChange={e => setYuklemeIlce(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Yükleme ilçesi seçin"
        classNamePrefix="Select"
      />
    </div>

    <div className="filter-block">
      <label>TESLİM NOKTASI</label>
      <Select
        options={teslimNoktasiOptions}
        value={teslimNoktasi ? { label: teslimNoktasi, value: teslimNoktasi } : null}
        onChange={e => setTeslimNoktasi(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Teslim noktası seçin"
        classNamePrefix="Select"
      />
    </div>

    <div className="filter-block">
      <label>TESLİM İLİ</label>
      <Select
        options={teslimIlOptions}
        value={teslimIl ? { label: teslimIl, value: teslimIl } : null}
        onChange={e => setTeslimIl(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Teslim ili seçin"
        classNamePrefix="Select"
      />
    </div>

    <div className="filter-block">
      <label>TESLİM İLÇESİ</label>
      <Select
        options={teslimIlceOptions}
        value={teslimIlce ? { label: teslimIlce, value: teslimIlce } : null}
        onChange={e => setTeslimIlce(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Teslim ilçesi seçin"
        classNamePrefix="Select"
      />
    </div>

    <div className="filter-block">
      <label>ATAMA YAPAN</label>
      <Select
        options={atamaYapanOptions}
        value={atamaYapan ? { label: atamaYapan, value: atamaYapan } : null}
        onChange={e => setAtamaYapan(e?.value || '')}
        isClearable
        isSearchable
        placeholder="Atama yapanı seçin"
        classNamePrefix="Select"
      />
    </div>

    <div className="filter-block full-width">
      <label>Sefer No</label>
      <Select
        options={tumSeferler}
        isMulti
        placeholder="Sefer No seçin"
        value={secilenSeferler}
        onChange={setSecilenSeferler}
        classNamePrefix="Select"
        noOptionsMessage={() => '🔍 Sefer bulunamadı'}
      />
                    </div>
                    <div className="filter-block full-width" style={{ textAlign: 'right', marginTop: '8px' }}>
                        <button
                            className="btn btn-clear"
                            onClick={filtreleriTemizle}
                            style={{
                                background: '#f87171',
                                color: '#fff',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer',
                            }}
                        >
                            🧹 Filtreleri Temizle
                        </button>
                    </div>

  </div>
)}
{applyFilters(veriler).length > 0 ? (
        <div className="reel-table-container">
          <table className="reel-table">
            <thead>
              <tr>
                <th className="reel-th"></th>
                <th className="reel-th">REEL DURUM</th>
                    <th className="reel-th">NOKTA SAYISI</th>


                             {columns.map((key) => (
  <th
    key={key}
    className="reel-th"
    draggable
    onDragStart={() => handleDragStart(key)}
    onDragOver={allowDrop}
    onDrop={() => handleDrop(key)}
    style={{ cursor: 'move' }}
  >
    {key.replace(/_/g, ' ').toUpperCase()}
  </th>
))}

              </tr>
            </thead>
            <tbody>
{applyFilters(veriler).map((v, i) => {
  const isExpanded = expandedRows.has(v.sefer_no);

  return (
    <React.Fragment key={i}>
      <tr>
        <td
          className="reel-td"
          style={{ cursor: 'pointer', textAlign: 'center', fontWeight: 'bold' }}
          onClick={() => toggleRow(v.sefer_no)}
        >
          {isExpanded ? '−' : '+'}
        </td>
        <td className="reel-td">{durumEtiketi(v.reel_durum)}</td>
        <td className="reel-td">{v.nokta_sayisi}</td>

             {columns.map((key, idx) => (
  <td key={idx} className="reel-td">{formatCell(v[key])}</td>
))}

      </tr>

      {isExpanded && (() => {
     const detailKeys = [
  'proje_adi',
  'yukleme_noktasi',
  'yukleme_ili',
  'yukleme_ilcesi',
  'teslim_noktasi',
  'teslim_ili',
  'teslim_ilcesi',
  'yukleme_varis',
  'yukleme_cikis',
  'teslim_varis',
  'teslim_cikis',
];

const splittedColumns = detailKeys.map(key => splitCell(v[key]));

// 🔥 maxRows artık sadece gerçek alanlara bakıyor
const maxRows = Math.max(...splittedColumns.map(col => col.length));



        return (
          <tr className="detail-row">
            <td colSpan={Object.keys(v).length + 1}>
              <div className="detail-container-rows">
                    {[...Array(maxRows)].map((_, rowIndex) => {
                      const satirBosMu = splittedColumns.every(col => {
                        const cell = col[rowIndex];
                        return !cell || cell.trim() === '' || cell.trim() === '-';
                      });

                      if (satirBosMu) return null;

              return (
                <div
                  key={rowIndex}
                  className="detail-row-item"
                  style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}
                >
                  {detailKeys.map((key, colIndex) => {
                    const showTime = ['yukleme_varis', 'yukleme_cikis', 'teslim_varis', 'teslim_cikis'].includes(key);
                    const cellValue = splittedColumns[colIndex][rowIndex] || '';

                    return (
                        <div
                            key={colIndex}
                            className="detail-item"
                            style={{
                                flex: '0 1 350px',
                                maxWidth: '360px',
                                minWidth: '200px',
                                background: '#334155',
                                borderRadius: '10px',
                                padding: '8px 10px',
                                boxShadow: '0 1px 4px rgba(30, 41, 59, 0.2)',
                                color: '#e0e7ff',
                                overflow: 'hidden',          // <-- taşmayı engeller
                            }}



                        >

                        <div
                          className="detail-key"
                          style={{
                            fontWeight: 700,
                            fontSize: '20px',
                            marginBottom: '6px',
                            color: '#a5b4fc',
                            textTransform: 'uppercase',
                          }}
                        >
                          {key.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div
                          className="detail-value"
                          style={{ fontSize: '20px',fontWeight: 'bold', lineHeight: 1.3, color: '#cbd5e1' }}
                        >
                                {showTime ? (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <input
                                            type="date"
                                            value={cellValue?.split('T')[0] || ''}
                                            onChange={(e) => {
                                                const datePart = e.target.value;
                                                const timePart = cellValue?.split('T')[1] || '00:00';
                                                handleDetailChange(v.sefer_no, rowIndex, key, `${datePart}T${timePart}`);
                                            }}
                                            style={{
                                                flex: 1,
                                                fontSize: '16px',
                                                padding: '4px 6px',
                                                backgroundColor: '#475569',
                                                color: '#e0e7ff',
                                                border: 'none',
                                                borderRadius: '4px',
                                            }}
                                        />
                                        <input
                                            type="time"
                                            value={cellValue?.split('T')[1] || '00:00'}
                                            onChange={(e) => {
                                                const timePart = e.target.value;
                                                const datePart = cellValue?.split('T')[0] || new Date().toISOString().split('T')[0];
                                                handleDetailChange(v.sefer_no, rowIndex, key, `${datePart}T${timePart}`);
                                            }}
                                            style={{
                                                flex: 1,
                                                fontSize: '16px',
                                                padding: '4px 6px',
                                                backgroundColor: '#475569',
                                                color: '#e0e7ff',
                                                border: 'none',
                                                borderRadius: '4px',
                                            }}
                                        />
                                    </div>
                                ) : (
                                    formatCell(cellValue, showTime) || '-'
                                )}




                        </div>
                      </div>
                    );
                  })}
                </div>
              );
                    })}
              </div>
            </td>
          </tr>
        );
      })()}
    </React.Fragment>
  );
})}

            </tbody>
                    </table>
                    {applyFilters(veriler).length > 0 && (
                        <div className="sabit-sayac">
                            {(() => {
                                const filtered = applyFilters(veriler);
                                const { toplam, bosSayisi, sfrSayisi } = sayacBilgisi(filtered);
                                return (
                                    <div className="sayac-icerik">
                                        🔢 Toplam: {toplam} satır |
                                        <span style={{ marginLeft: '12px' }}>🅱 BOS ile başlayan: {bosSayisi}</span> |
                                        <span style={{ marginLeft: '12px' }}>🆔 SFR ile başlayan: {sfrSayisi}</span>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

        </div>
      ) : (
        <p>🔎 Tarih aralığı ve gerekirse Sefer No seçin, sonra listeleyin.</p>
      )}
    </div>
  );
}

export default ReelAtananSeferler;
