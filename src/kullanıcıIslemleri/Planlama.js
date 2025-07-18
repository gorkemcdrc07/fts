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
        YALOVA: "Ege Bölgesi", YOZGAT: "İç Anadolu Bölgesi", ZONGULDAK: "Karadeniz Bölgesi",
        ADALAR: "Marmara Bölgesi", ATAŞEHİR: "Marmara Bölgesi", BAĞCILAR: "Marmara Bölgesi",
        BAHÇELİEVLER: "Marmara Bölgesi", BAKIRKÖY: "Marmara Bölgesi", BAŞAKŞEHİR: "Marmara Bölgesi",
        BAYRAMPAŞA: "Marmara Bölgesi", BEŞİKTAŞ: "Marmara Bölgesi", BEYLİKDÜZÜ: "Marmara Bölgesi",
        BEYOĞLU: "Marmara Bölgesi", BÜYÜKÇEKMECE: "Marmara Bölgesi", ÇATALCA: "Marmara Bölgesi",
        ESENLER: "Marmara Bölgesi", ESENYURT: "Marmara Bölgesi", EYÜP: "Marmara Bölgesi",
        FATİH: "Marmara Bölgesi", GAZİOSMANPAŞA: "Marmara Bölgesi", GÜNGÖREN: "Marmara Bölgesi",
        KADIKÖY: "Marmara Bölgesi", KAĞITHANE: "Marmara Bölgesi", KARTAL: "Marmara Bölgesi",
        KÜÇÜKÇEKMECE: "Marmara Bölgesi", MALTEPE: "Marmara Bölgesi", PENDİK: "Marmara Bölgesi",
        SANCAKTEPE: "Marmara Bölgesi", SARIYER: "Marmara Bölgesi", SİLİVRİ: "Marmara Bölgesi",
        SULTANBEYLİ: "Marmara Bölgesi", SULTANGAZİ: "Marmara Bölgesi", ŞİLE: "Marmara Bölgesi",
        ŞİŞLİ: "Marmara Bölgesi", TUZLA: "Marmara Bölgesi", ÜMRANİYE: "Marmara Bölgesi",
        ÜSKÜDAR: "Marmara Bölgesi", ZEYTİNBURNU: "Marmara Bölgesi"
    };

    useEffect(() => {
        veriGetir();
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
            const enriched = (data || []).map(v => {
                const il = (v.tahliye_il || '').toUpperCase().trim();
                const bolge = ilToBolgeMap[il] || '';
                return { ...v, bolge };
            });

            setVeriler(enriched);
            setPlakalar([...new Set(enriched.map(v => v.plaka).filter(Boolean))]);
            setBolgeler([...new Set(enriched.map(v => v.bolge).filter(Boolean))]);
        }
    };

    const filtreleVeriler = () => {
        let filtrelenmis = veriler;

        if (plakaFilter !== '') {
            filtrelenmis = filtrelenmis.filter(v => v.plaka === plakaFilter);
        }

        if (bolgeFilter !== '') {
            filtrelenmis = filtrelenmis.filter(v => v.bolge === bolgeFilter);
        }

        setFilteredVeriler(filtrelenmis);
    };

    const handleInputChange = (rowIndex, key, value) => {
        const updatedFiltered = [...filteredVeriler];
        updatedFiltered[rowIndex][key] = value;

        if (key === 'tahliye_il') {
            const il = value.toUpperCase().trim();
            const bolge = ilToBolgeMap[il] || '';
            updatedFiltered[rowIndex]['bolge'] = bolge;

            console.log(">>> Tahliye İl Değişti:");
            console.log("   - Girilen İl:", il);
            console.log("   - Hesaplanan Bölge:", bolge);
            console.log("   - Güncellenen Satır:", updatedFiltered[rowIndex]);
        }

        setFilteredVeriler(updatedFiltered);

        const updatedVeriler = [...veriler];
        const originalIndex = veriler.findIndex(v =>
            v.sefer_no === updatedFiltered[rowIndex].sefer_no
        );

        if (originalIndex !== -1) {
            updatedVeriler[originalIndex] = { ...updatedFiltered[rowIndex] };
            console.log("✅ veriler güncellendi (mevcut satır bulundu)");
        } else {
            console.log("ℹ️ veriler listesine ekleme yapılmadı (sefer_no yok)");
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
        const today = new Date();
        const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

        const bosSatir = Object.fromEntries(alanlar.map(a => [a, '']));
        bosSatir['tarih'] = formattedDate;

        console.log("Yeni satır eklendi:", bosSatir); // Test çıktısı

        setFilteredVeriler([bosSatir, ...filteredVeriler]);
    };

    const handleGuncelle = () => {
        const guncellenmis = filteredVeriler.map(item => {
            const il = (item.tahliye_il || '').toUpperCase().trim();
            const bolge = ilToBolgeMap[il] || '';
            return {
                ...item,
                bir_onceki_is: item.tahliye_noktasi || '',
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
    };

    const renderCell = (v, rowIndex, field) => {
        const key = `${rowIndex}-${field}`;
        if (!inputRefs.current[key]) inputRefs.current[key] = React.createRef();

        const readOnlyFields = ['plaka', 'ad_soyad', 'telefon', 'tc', 'bir_onceki_is'];

        // Eğer alan "bolge" ise input değil, düz text olarak göster
        if (field === 'bolge') {
            return (
                <td key={key}>
                    {v['bolge'] || ''} {/* ⚠️ Buraya dikkat */}
                </td>
            );
        }

        return (
            <td key={key}>
                <input
                    ref={inputRefs.current[key]}
                    value={v[field] || ''}
                    onChange={(e) => handleInputChange(rowIndex, field, e.target.value)}
                    onKeyDown={(e) => handleKeyNavigation(e, rowIndex, field)}
                    readOnly={readOnlyFields.includes(field)}
                />
            </td>
        );
    };

    return (
        <div className="planlama-sayfasi">
            <div className="butonlar">
                <button onClick={yeniSatirEkle}>+ YENİ SATIR</button>
                <button>KAYDET</button>
                <button onClick={handleGuncelle}>GÜNCELLE</button>
                <button>EXCELE AKTAR</button>
            </div>

            <div className="filtre-alani">
                <input
                    list="plaka-listesi"
                    placeholder="Plaka ara veya seç..."
                    value={plakaFilter}
                    onChange={(e) => setPlakaFilter(e.target.value)}
                />
                <datalist id="plaka-listesi">
                    {plakalar.map((p, i) => (
                        <option key={i} value={p} />
                    ))}
                </datalist>

                <select value={bolgeFilter} onChange={(e) => setBolgeFilter(e.target.value)}>
                    <option value="">Tüm Bölgeler</option>
                    {bolgeler.map((b, i) => (
                        <option key={i} value={b}>{b}</option>
                    ))}
                </select>
            </div>

            <div className="planlama-wrapper">
                <table className="planlama-tablo">
                    <thead>
                        <tr>
                            <th>Sefer No</th>
                            <th>Sevk No</th>
                            <th>Tarih</th>
                            <th>Plaka</th>
                            <th>Ad Soyad</th>
                            <th>Telefon</th>
                            <th>TC</th>
                            <th>Varış Tarihi</th>
                            <th>Son Nokta</th>
                            <th>Fatura Müşterisi</th>
                            <th>Yükleme Noktası</th>
                            <th>Tahliye Noktası</th>
                            <th>Tahliye İl</th>
                            <th>Tonaj</th>
                            <th>Bir Önceki İş</th>
                            <th>Bölge</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredVeriler.length === 0 ? (
                            <tr><td colSpan="16">Kayıt bulunamadı.</td></tr>
                        ) : (
                            filteredVeriler.map((v, rowIndex) => (
                                <tr key={`${v.sefer_no || 'yeni'}-${rowIndex}`}>
                                    {alanlar.map(field => renderCell(v, rowIndex, field))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Planlama;
