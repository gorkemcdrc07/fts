import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import './Planlama.css';

function Planlama() {
    const [veriler, setVeriler] = useState([]);
    const [filteredVeriler, setFilteredVeriler] = useState([]);
    const [plakaFilter, setPlakaFilter] = useState('');
    const [bolgeFilter, setBolgeFilter] = useState('');
    const [plakalar, setPlakalar] = useState([]);
    const [bolgeler, setBolgeler] = useState([]);
    const inputRefs = useRef({});
    const [duzenlemeModuSatirId, setDuzenlemeModuSatirId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showGuncelleModal, setShowGuncelleModal] = useState(false);
    const [showPlakaModal, setShowPlakaModal] = useState(false);
    const [yeniPlaka, setYeniPlaka] = useState({
        plaka: '',
        ad_soyad: '',
        telefon: '',
        tc: ''
    });





    const alanlar = [
        'sefer_no', 'sevk_no', 'tarih', 'plaka', 'ad_soyad', 'telefon', 'tc',
        'varis_tarihi', 'son_nokta', 'fatura_musterisi',
        'yukleme_noktasi', 'tahliye_noktasi', 'tahliye_il',
        'tonaj', 'bir_onceki_is', 'bolge'
    ];

    const ilToBolgeMap = {
        ADANA: "Doğu Bölgesi", ADIYAMAN: "Doğu Bölgesi", AFYON: "İç Anadolu Bölgesi",
        AĞRI: "Doğu Bölgesi", AMASYA: "Karadeniz Bölgesi", ANKARA: "İç Anadolu Bölgesi",
        ANTALYA: "Ege Bölgesi", ARTVİN: "Karadeniz Bölgesi", AYDIN: "Ege Bölgesi",
        BALIKESİR: "Ege Bölgesi", BARTIN: "Karadeniz Bölgesi", BATMAN: "Doğu Bölgesi",
        BAYBURT: "Karadeniz Bölgesi", BİLECİK: "İç Anadolu Bölgesi", BİNGÖL: "Doğu Bölgesi",
        BİTLİS: "Doğu Bölgesi", BOLU: "Karadeniz Bölgesi", BURDUR: "Ege Bölgesi",
        BURSA: "Ege Bölgesi", ÇANAKKALE: "Trakya Bölgesi", ÇANKIRI: "İç Anadolu Bölgesi",
        ÇORUM: "İç Anadolu Bölgesi", DENİZLİ: "Ege Bölgesi", DİYARBAKIR: "Doğu Bölgesi",
        DÜZCE: "Karadeniz Bölgesi", EDİRNE: "Trakya Bölgesi", ELAZIĞ: "Doğu Bölgesi",
        ERZİNCAN: "Doğu Bölgesi", ERZURUM: "Doğu Bölgesi", ESKİŞEHİR: "İç Anadolu Bölgesi",
        GAZİANTEP: "Doğu Bölgesi", GİRESUN: "Karadeniz Bölgesi", GÜMÜŞHANE: "Karadeniz Bölgesi",
        HAKKARİ: "Doğu Bölgesi", HATAY: "Doğu Bölgesi", ISPARTA: "Ege Bölgesi",
        MERSİN: "Doğu Bölgesi", İSTANBUL: "Marmara Bölgesi", İZMİR: "Ege Bölgesi",
        KAHRAMANMARAŞ: "Doğu Bölgesi", KARABÜK: "Karadeniz Bölgesi", KARAMAN: "İç Anadolu Bölgesi",
        KARS: "Doğu Bölgesi", KASTAMONU: "Karadeniz Bölgesi", KAYSERİ: "İç Anadolu Bölgesi",
        KİLİS: "Doğu Bölgesi", KIRIKKALE: "İç Anadolu Bölgesi", KIRKLARELİ: "Trakya Bölgesi",
        KIRŞEHİR: "İç Anadolu Bölgesi", KOCAELİ: "Kocaeli Bölgesi", KONYA: "İç Anadolu Bölgesi",
        KÜTAHYA: "İç Anadolu Bölgesi", MALATYA: "Doğu Bölgesi", MANİSA: "Ege Bölgesi",
        MARDİN: "Doğu Bölgesi", MUĞLA: "Ege Bölgesi", MUŞ: "Doğu Bölgesi",
        NEVŞEHİR: "İç Anadolu Bölgesi", NİĞDE: "İç Anadolu Bölgesi", ORDU: "Karadeniz Bölgesi",
        OSMANİYE: "Doğu Bölgesi", RİZE: "Karadeniz Bölgesi", SAKARYA: "Kocaeli Bölgesi",
        SAMSUN: "Karadeniz Bölgesi", SİİRT: "Doğu Bölgesi", SİNOP: "Karadeniz Bölgesi",
        SİVAS: "İç Anadolu Bölgesi", ŞANLIURFA: "Doğu Bölgesi", ŞIRNAK: "Doğu Bölgesi",
        TEKİRDAĞ: "Trakya Bölgesi", TOKAT: "Karadeniz Bölgesi", TRABZON: "Karadeniz Bölgesi",
        TUNCELİ: "Doğu Bölgesi", UŞAK: "Ege Bölgesi", VAN: "Doğu Bölgesi",
        YALOVA: "Ege Bölgesi", YOZGAT: "İç Anadolu Bölgesi", ZONGULDAK: "Karadeniz Bölgesi", ADALAR: "Kocaeli Bölgesi",
        ATAŞEHİR: "Kocaeli Bölgesi",
        BEYKOZ: "Kocaeli Bölgesi",
        ÖMERLİ: "Kocaeli Bölgesi",
        KADIKÖY: "Kocaeli Bölgesi",
        KARTAL: "Kocaeli Bölgesi",
        MALTEPE: "Kocaeli Bölgesi",
        PENDİK: "Kocaeli Bölgesi",
        SANCAKTEPE: "Kocaeli Bölgesi",
        SULTANBEYLİ: "Kocaeli Bölgesi",
        ŞİLE: "Kocaeli Bölgesi",
        TUZLA: "Kocaeli Bölgesi",
        ÜMRANİYE: "Kocaeli Bölgesi",
        ÜSKÜDAR: "Kocaeli Bölgesi",
        ARNAVUTKÖY: "Marmara Bölgesi",
        AVCILAR: "Marmara Bölgesi",
        BAĞCILAR: "Marmara Bölgesi",
        BAHÇELİEVLER: "Marmara Bölgesi",
        BAKIRKÖY: "Marmara Bölgesi",
        BAŞAKŞEHİR: "Marmara Bölgesi",
        BAYRAMPAŞA: "Marmara Bölgesi",
        BEŞİKTAŞ: "Marmara Bölgesi",
        BEYLİKDÜZÜ: "Marmara Bölgesi",
        BEYOĞLU: "Marmara Bölgesi",
        BÜYÜKÇEKMECE: "Marmara Bölgesi",
        ÇATALCA: "Marmara Bölgesi",
        ESENLER: "Marmara Bölgesi",
        ESENYURT: "Marmara Bölgesi",
        EYÜP: "Marmara Bölgesi",
        FATİH: "Marmara Bölgesi",
        GAZİOSMANPAŞA: "Marmara Bölgesi",
        GÜNGÖREN: "Marmara Bölgesi",
        KAĞITHANE: "Marmara Bölgesi",
        KÜÇÜKÇEKMECE: "Marmara Bölgesi",
        SARIYER: "Marmara Bölgesi",
        SİLİVRİ: "Marmara Bölgesi",
        SULTANGAZİ: "Marmara Bölgesi",
        ŞİŞLİ: "Marmara Bölgesi",
        ZEYTİNBURNU: "Marmara Bölgesi",
    };

    const convertDateToInputFormat = (value) => {
        if (!value || typeof value !== 'string') return '';
        const parts = value.split('.');
        if (parts.length !== 3) return '';
        const [gun, ay, yil] = parts;
        return `${yil}-${ay?.padStart(2, '0')}-${gun?.padStart(2, '0')}`;
    };
    const convertInputToDateFormat = (value) => {
        if (!value || typeof value !== 'string') return '';
        const parts = value.split('-');
        if (parts.length !== 3) return '';
        const [yil, ay, gun] = parts;
        return `${gun?.padStart(2, '0')}.${ay?.padStart(2, '0')}.${yil}`;
    };

    const getToday = () => {
        const today = new Date();
        return today.toISOString().split('T')[0]; // "2025-07-18"
    };

    useEffect(() => {
        veriGetir();
        plakalarGetir();
    }, []);

    useEffect(() => {
        filtreleVeriler();
    }, [plakaFilter, bolgeFilter, veriler]);

    const veriGetir = async () => {
        const { data, error } = await supabase
            .from('planlama')
            .select('*')
            .order('sefer_no', { ascending: false });

        if (!error) {
            const enriched = (data || []).map((v, index) => {
                const il = (v.son_nokta || '').toLocaleUpperCase('tr-TR').trim();
                const bolge = ilToBolgeMap[il] || v.bolge || ''; // 🔥 BURASI DEĞİŞTİ
                const tarih = v.tarih || getToday();
                const id = v.sefer_no || `tmp-${Date.now()}-${index}`;
                return { ...v, bolge, tarih, _rowId: id };
            });

            setVeriler(enriched);
            setBolgeler([...new Set(enriched.map(v => v.bolge).filter(Boolean))]);
            setFilteredVeriler(enriched);
        }
    };
    const plakalarGetir = async () => {
        const { data } = await supabase.from('plakalar').select('plaka');
        if (data) setPlakalar(data.map(d => d.plaka));
    };

    const filtreleVeriler = () => {
        let filtrelenmis = [...veriler];
        if (plakaFilter) filtrelenmis = filtrelenmis.filter(v => v.plaka === plakaFilter);
        if (bolgeFilter) filtrelenmis = filtrelenmis.filter(v => v.bolge === bolgeFilter);
        setFilteredVeriler(filtrelenmis);
    };

    const handleInputChange = (rowIndex, key, value) => {
        const updatedFiltered = [...filteredVeriler];
        updatedFiltered[rowIndex][key] = value;

        if (key === 'son_nokta') {
            const il = (value || '').toLocaleUpperCase('tr-TR').trim();
            const bolge = ilToBolgeMap[il] || '';
            updatedFiltered[rowIndex]['bolge'] = bolge;
        }

        setFilteredVeriler(updatedFiltered);

        const updatedVeriler = [...veriler];
        const originalIndex = veriler.findIndex(v => v._rowId === updatedFiltered[rowIndex]._rowId);
        if (originalIndex !== -1) {
            updatedVeriler[originalIndex] = { ...updatedFiltered[rowIndex] };
        }
        setVeriler(updatedVeriler);
    };

    const handleKeyNavigation = (e, rowIndex, field) => {
        const colIndex = alanlar.indexOf(field);
        let nextRow = rowIndex;
        let nextCol = colIndex;

        switch (e.key) {
            case 'ArrowRight': nextCol++; break;
            case 'ArrowLeft': nextCol--; break;
            case 'ArrowDown': nextRow++; break;
            case 'ArrowUp': nextRow--; break;
            default: return;
        }

        const nextField = alanlar[nextCol];
        const nextRef = inputRefs.current[`${nextRow}-${nextField}`];
        if (nextRef?.current) {
            nextRef.current.focus();
            e.preventDefault();
        }
    };

    const yeniSatirEkle = () => {
        const bosSatir = Object.fromEntries(alanlar.map(a => [a, '']));
        bosSatir['tarih'] = getToday();
        bosSatir['_rowId'] = `tmp-${Date.now()}`; // 🔥 BURASI YENİ
        setFilteredVeriler([bosSatir, ...filteredVeriler]);
    };

    const handleGuncelleClick = () => {
        setShowGuncelleModal(true);
    };


    const handleGuncelle = () => {
        const guncellenmis = filteredVeriler.map(item => {
            const il = (item.tahliye_il || '').toLocaleUpperCase('tr-TR').trim();
            const bolge = ilToBolgeMap[il] || '';

            const bir_onceki_is = [
                item.fatura_musterisi,
                item.yukleme_noktasi,
                item.tahliye_noktasi
            ].filter(Boolean).join(' / ');

            return {
                ...item,
                bir_onceki_is,
                son_nokta: item.tahliye_il || '',
                fatura_musterisi: '',
                yukleme_noktasi: '',
                tahliye_noktasi: '',
                tahliye_il: '',
                tonaj: '',
                bolge
            };
        });

        setFilteredVeriler(guncellenmis);

        const updatedVeriler = veriler.map(v => {
            const match = guncellenmis.find(g => g._rowId === v._rowId);
            return match ? { ...match } : v;
        });

        setVeriler(updatedVeriler);
        setShowGuncelleModal(false); // Modal'ı kapat
    };



    const renderCell = (v, rowIndex, field) => {
        const satirId = v._rowId;
        const key = `${satirId}-${field}`;
        if (!inputRefs.current[key]) inputRefs.current[key] = React.createRef();

        const readOnlyFields = ['ad_soyad', 'plaka', 'telefon', 'tc', 'bir_onceki_is', 'tarih'];
        const isDateInput = field === 'varis_tarihi';

        if (field === 'bolge') return <td key={key}>{v.bolge || ''}</td>;

        return (
            <td key={key}>
                <input
                    ref={inputRefs.current[key]}
                    type={isDateInput ? 'date' : 'text'}
                    value={
                        isDateInput && typeof v[field] === 'string'
                            ? convertDateToInputFormat(v[field])
                            : (v[field] ?? (field === 'tarih' ? getToday() : ''))
                    }
                    onChange={(e) =>
                        handleInputChange(rowIndex, field,
                            isDateInput
                                ? convertInputToDateFormat(e.target.value)
                                : e.target.value)
                    }
                    onKeyDown={(e) => handleKeyNavigation(e, rowIndex, field)}
                    readOnly={
                        readOnlyFields.includes(field) && duzenlemeModuSatirId !== v._rowId
                    }
                />
            </td>
        );
    };
    const handleKaydet = async () => {
        setIsSaving(true); // 🔥 Ekranı kilitle

        for (const item of filteredVeriler) {
            const { _rowId, duzenleme_tarihi, ...veri } = item;

            const today = getToday();

            if (!veri.tarih) veri.tarih = today;
            if (!veri.varis_tarihi) veri.varis_tarihi = today;

            const ilHam = veri.son_nokta || '';
            const il = ilHam.trim().toLocaleUpperCase('tr-TR');
            veri.bolge = ilToBolgeMap[il] || veri.bolge || null;

            ['tarih', 'varis_tarihi'].forEach(key => {
                if (veri[key] && typeof veri[key] === 'string' && veri[key].includes('.')) {
                    const [g, a, y] = veri[key].split('.');
                    veri[key] = `${y}-${a.padStart(2, '0')}-${g.padStart(2, '0')}`;
                }
            });

            for (const key in veri) {
                if (veri[key] === undefined || veri[key] === '') {
                    veri[key] = null;
                }
            }

            try {
                if (veri.id) {
                    const { error } = await supabase
                        .from('planlama')
                        .update(veri)
                        .eq('id', veri.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from('planlama')
                        .insert(veri);
                    if (error) throw error;
                }
            } catch (err) {
                console.error('HATA:', err.message, veri);
            }
        }

        await veriGetir();
        setIsSaving(false); // 🔥 Ekranı serbest bırak
    };
    const handlePlakaEkle = () => {
        setYeniPlaka({ plaka: '', ad_soyad: '', telefon: '', tc: '' });
        setShowPlakaModal(true);
    };

    const handleYeniPlakaKaydet = async () => {
        const { plaka, ad_soyad, telefon, tc } = yeniPlaka;

        if (!plaka || !ad_soyad || !telefon || !tc) {
            alert("Tüm alanları doldurmalısınız.");
            return;
        }

        const yeniKayit = {
            sefer_no: '',
            sevk_no: '',
            tarih: null,           // "2025-07-18" gibi uygun format
            varis_tarihi: null,
            son_nokta: '',
            fatura_musterisi: '',
            yukleme_noktasi: '',
            tahliye_noktasi: '',
            tahliye_il: '',
            tonaj: '',
            bir_onceki_is: '',
            bolge: '',
            plaka,
            ad_soyad,
            telefon,
            tc,
        };

        try {
            const { data, error } = await supabase.from('planlama').insert([yeniKayit]);

            if (error) {
                console.error("Plaka ekleme hatası:", error.message);
                alert("Veritabanına ekleme başarısız oldu.");
                return;
            }

            const _rowId = `tmp-${Date.now()}`;
            setFilteredVeriler([{ ...yeniKayit, _rowId }, ...filteredVeriler]);
            setVeriler([{ ...yeniKayit, _rowId }, ...veriler]);
            setShowPlakaModal(false);
        } catch (err) {
            console.error("Plaka ekleme sırasında hata:", err.message);
            alert("Beklenmeyen bir hata oluştu.");
        }
    };


    const handleSil = async (_rowId) => {
        const satir = veriler.find(v => v._rowId === _rowId);
        if (!satir) return;

        const onay = window.confirm("Bu satırı silmek istediğinize emin misiniz?");
        if (!onay) return;

        // Eğer veritabanında varsa sil
        if (satir.id) {
            try {
                const { error } = await supabase
                    .from('planlama')
                    .delete()
                    .eq('id', satir.id);
                if (error) throw error;
            } catch (err) {
                console.error("Silme hatası:", err.message);
                alert("Kayıt silinemedi.");
                return;
            }
        }

        // Ekrandaki verileri anında güncelle
        setFilteredVeriler(prev => prev.filter(v => v._rowId !== _rowId));
        setVeriler(prev => prev.filter(v => v._rowId !== _rowId));
    };










    return (
        <div className="planlama-sayfasi">
            <div className="butonlar">
                <button onClick={handleKaydet}>KAYDET</button>
                <button onClick={handleGuncelleClick}>GÜNCELLE</button>
            </div>

            <div className="filtre-alani">
                <input
                    list="plaka-listesi"
                    placeholder="Plaka ara veya seç..."
                    value={plakaFilter}
                    onChange={(e) => setPlakaFilter(e.target.value)}
                />
                <datalist id="plaka-listesi">
                    {plakalar.map((p, i) => <option key={i} value={p} />)}
                </datalist>

                <select value={bolgeFilter} onChange={(e) => setBolgeFilter(e.target.value)}>
                    <option value="">Tüm Bölgeler</option>
                    {bolgeler.map((b, i) => <option key={i} value={b}>{b}</option>)}
                </select>
            </div>

            <div className="planlama-wrapper">
                <table className="planlama-tablo">
                    <thead>
                        <tr>
                            {alanlar.map((a, i) => <th key={i}>{a.replace(/_/g, ' ').toUpperCase()}</th>)}
                            <th>İŞLEM</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredVeriler.length === 0 ? (
                            <tr><td colSpan={alanlar.length + 1}>Kayıt bulunamadı.</td></tr>
                        ) : (
                            filteredVeriler.map((v, rowIndex) => (
                                <tr key={rowIndex}>
                                    {alanlar.map(field => renderCell(v, rowIndex, field))}
                                    <td>
                                        <button
                                            onClick={() =>
                                                setDuzenlemeModuSatirId(
                                                    duzenlemeModuSatirId === v._rowId ? null : v._rowId
                                                )
                                            }
                                        >
                                            {duzenlemeModuSatirId === v._rowId ? '✔️ Bitir' : '✏️ Düzenle'}
                                        </button>
                                        <button onClick={() => handleSil(v._rowId)} style={{ marginLeft: 6, color: 'red' }}>
                                            🗑️ Sil
                                        </button>
                                    </td>

                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 🔄 Kaydetme sırasında ekranı kilitle */}
            {isSaving && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <p>Kaydediliyor...</p>
                </div>
            )}
            {showPlakaModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Yeni Plaka Ekle</h3>
                        <input
                            type="text"
                            placeholder="Plaka"
                            value={yeniPlaka.plaka}
                            onChange={(e) => setYeniPlaka({ ...yeniPlaka, plaka: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Ad Soyad"
                            value={yeniPlaka.ad_soyad}
                            onChange={(e) => setYeniPlaka({ ...yeniPlaka, ad_soyad: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Telefon"
                            value={yeniPlaka.telefon}
                            onChange={(e) => setYeniPlaka({ ...yeniPlaka, telefon: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="TC"
                            value={yeniPlaka.tc}
                            onChange={(e) => setYeniPlaka({ ...yeniPlaka, tc: e.target.value })}
                        />
                        <div className="modal-buttons">
                            <button onClick={handleYeniPlakaKaydet}>Kaydet</button>
                            <button onClick={() => setShowPlakaModal(false)}>İptal</button>
                        </div>
                    </div>
                </div>
            )}


            {/* ✅ GÜNCELLE onay modali */}
            {showGuncelleModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Güncelleme Onayı</h3>
                        <p>Tüm kayıtlar güncellenecek. Devam etmek istiyor musunuz?</p>
                        <div className="modal-buttons">
                            <button onClick={handleGuncelle}>Evet, Güncelle</button>
                            <button onClick={() => setShowGuncelleModal(false)}>İptal</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );


}

export default Planlama;
