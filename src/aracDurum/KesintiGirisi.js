import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './KesintiGirisi.css';
import * as XLSX from 'xlsx'; // En üste ekle
import { Helmet } from 'react-helmet-async';


const BOS_FORM = {
    plaka_treyler: '',
    kesinti_turu: '',
    neden: '',
    baslangic_tarihi: '',
    bitis_tarihi: '',
    gun_sayisi: '',
    aciklama: '',
};


const getMevcutKullanici = () => localStorage.getItem('kullanici') || 'Bilinmeyen Kullanıcı';

const hesaplaGun = (start, end) => {
    const d1 = new Date(start);
    const d2 = new Date(end);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const fark = (d2 - d1) / (1000 * 60 * 60 * 24);
    return fark >= 0 ? fark : 0; // Başlangıç dahil edilmiyor
};

function KesintiGirisi() {
    const [form, setForm] = useState(BOS_FORM);
    const [kesintiler, setKesintiler] = useState([]);
    const [plakalar, setPlakalar] = useState([]);
    const [formGorunur, setFormGorunur] = useState(false); // ✅ BURASI EKLENDİ
    const [filtreler, setFiltreler] = useState({
        plaka_treyler: '',
        kesinti_turu: '',
        neden: '',
        baslangic_tarihi: '',
        bitis_tarihi: '',
        gun_sayisi: '',
        aciklama: '',
        ekleyen_kullanici: ''
    });

    const filtrelenmisKesintiler = kesintiler.filter((k) =>
        Object.entries(filtreler).every(([key, deger]) => {
            if (!deger) return true;
            return String(k[key] || '').toLowerCase().includes(deger.toLowerCase());
        })
    );



    useEffect(() => {
        verileriGetir();
        plakalarGetir();
    }, []);

    const verileriGetir = async () => {
        const { data } = await supabase.from('kesintiler').select('*').order('id', { ascending: false });
        setKesintiler(data || []);
    };

    const plakalarGetir = async () => {
        const { data, error } = await supabase
            .from('plakalar')
            .select('plaka, treyler') // sadece ihtiyacın olan kolonlar
            .or('statu.is.null,statu.neq.ÇIKARILDI') // "ÇIKARILDI" olanları liste dışı bırak

        if (!error && data) setPlakalar(data);
    };


    const handleChange = (e) => {
        const { name, value } = e.target;
        const yeniForm = { ...form, [name]: value };

        if (name === 'baslangic_tarihi' || name === 'bitis_tarihi') {
            const gun = hesaplaGun(yeniForm.baslangic_tarihi, yeniForm.bitis_tarihi);
            yeniForm.gun_sayisi = gun;
        }

        setForm(yeniForm);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { plaka_treyler, baslangic_tarihi, bitis_tarihi, kesinti_turu, neden, gun_sayisi, aciklama } = form;

        if (!plaka_treyler || !baslangic_tarihi || !bitis_tarihi || !kesinti_turu || !neden) {
            alert("Lütfen tüm gerekli alanları doldurun.");
            return;
        }

        const kullanici = getMevcutKullanici();
        const bugun = new Date().toISOString().split("T")[0];

        const { error } = await supabase.from('kesintiler').insert([{
            plaka_treyler,
            kesinti_turu,
            neden,
            baslangic_tarihi,
            bitis_tarihi,
            gun_sayisi,
            aciklama,
            ekleyen_kullanici: kullanici,
            eklenme_tarihi: new Date().toISOString()
        }]);

        if (error) {
            alert("Kesinti eklenemedi.");
            return;
        }

        const [plaka, treyler] = plaka_treyler.split(' - ');
        if (bitis_tarihi >= bugun) {
            await supabase.from('plakalar')
                .update({
                    statu: 'KESİNTİDE',
                    kesinti_baslangic_tarihi: baslangic_tarihi,
                    kesinti_bitis_tarihi: bitis_tarihi
                })
                .eq('plaka', plaka.trim())
                .eq('treyler', treyler.trim());
        }

        setForm(BOS_FORM);
        verileriGetir();
    };

    const handleSil = async (id) => {
        const onay = window.confirm("Kesinti kaydı silinsin mi?");
        if (!onay) return;

        const { data: silinecek } = await supabase.from('kesintiler').select('*').eq('id', id).single();
        if (!silinecek) return alert("Kayıt bulunamadı.");

        await supabase.from('kesintiler').delete().eq('id', id);

        const [plaka, treyler] = silinecek.plaka_treyler.split(' - ');
        await supabase.from('plakalar')
            .update({
                statu: 'Aktif',
                kesinti_baslangic_tarihi: null,
                kesinti_bitis_tarihi: null
            })
            .eq('plaka', plaka.trim())
            .eq('treyler', treyler.trim());

        verileriGetir();
    };
    const handleExportExcel = () => {
        if (kesintiler.length === 0) {
            alert("Aktarılacak kayıt bulunamadı.");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(kesintiler.map(k => ({
            Plaka: k.plaka_treyler,
            Tür: k.kesinti_turu,
            Neden: k.neden,
            Başlangıç: new Date(k.baslangic_tarihi).toLocaleDateString('tr-TR'),
            Bitiş: new Date(k.bitis_tarihi).toLocaleDateString('tr-TR'),
            Gün: k.gun_sayisi,
            Açıklama: k.aciklama,
            Ekleyen: k.ekleyen_kullanici,
            Eklenme_Tarihi: new Date(k.eklenme_tarihi).toLocaleString('tr-TR'),
        })));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Kesinti Kayıtları");

        XLSX.writeFile(workbook, "kesinti_kayitlari.xlsx");
    };

    return (
        <div className="kesinti-container">
            <Helmet>
                <title>KESİNTİ GİRİŞLERİ</title>
            </Helmet>

            {/* ÜSTTE: Geri ve + Kesinti Ekle Butonu */}
            <div className="sayfa-ust-butonlar">
                <button className="geri-btn" onClick={() => window.history.back()}>
                    ← Geri
                </button>

                {!formGorunur && (
                    <button type="button" className="ekle-btn" onClick={() => setFormGorunur(true)}>
                        + EKLE
                    </button>
                )}
            </div>

            {/* FORM PANELİ */}
            {formGorunur && (
                <form onSubmit={handleSubmit} className="kesinti-form">
                    <h2>Kesinti Girişi</h2>

                    <label>Plaka - Treyler</label>
                    <input
                        list="plaka-treyler-list"
                        name="plaka_treyler"
                        value={form.plaka_treyler}
                        onChange={handleChange}
                        placeholder="Örn: 34 ABC 123 - T123"
                        required
                    />
                    <datalist id="plaka-treyler-list">
                        {plakalar.map((p, idx) => (
                            <option key={idx} value={`${p.plaka} - ${p.treyler}`} />
                        ))}
                    </datalist>


                    <label>Kesinti Türü</label>
                    <select
                        name="kesinti_turu"
                        value={form.kesinti_turu}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Tür Seçin</option>
                        <option value="Bakım">Bakım</option>
                        <option value="Servis">Servis</option>
                        <option value="Arıza">Arıza</option>
                        <option value="Kaza">Kaza</option>
                        <option value="Bölgede İş Yok">Bölgede İş Yok</option>
                        <option value="İş Başı">İş Başı</option>   {/* ✅ Yeni */}
                        <option value="İş Sonu">İş Sonu</option>   {/* ✅ Yeni */}
                    </select>

                    <label>Kesinti Nedeni</label>
                    <select name="neden" value={form.neden} onChange={handleChange} required>
                        <option value="">Neden Seçin</option>
                        <option value="Tedarikçi Kaynaklı">Tedarikçi Kaynaklı</option>
                        <option value="Odak Kaynaklı">Odak Kaynaklı</option>
                    </select>

                    <label>Başlangıç Tarihi</label>
                    <input
                        type="date"
                        name="baslangic_tarihi"
                        value={form.baslangic_tarihi}
                        onChange={handleChange}
                        required
                    />

                    <label>Bitiş Tarihi</label>
                    <input
                        type="date"
                        name="bitis_tarihi"
                        value={form.bitis_tarihi}
                        onChange={handleChange}
                        required
                    />

                    <label>Toplam Gün</label>
                    <input value={form.gun_sayisi} readOnly placeholder="Gün sayısı" />

                    <label>Açıklama</label>
                    <textarea name="aciklama" value={form.aciklama} onChange={handleChange} />

                    <div className="form-butons">
                        <button type="submit">Kaydet</button>
                        <button
                            type="button"
                            className="vazgec-btn"
                            onClick={() => {
                                setFormGorunur(false);
                                setForm(BOS_FORM);
                            }}
                        >
                            Vazgeç
                        </button>
                    </div>
                </form>
            )}

            {/* FİLTRE PANELİ: Sadece form kapalıyken göster */}
            {!formGorunur && (
                <div className="filtre-paneli-modern">
                    <div className="filtre-baslik">
                        <h3>Filtreler</h3>
                        <button
                            className="temizle-btn"
                            onClick={() =>
                                setFiltreler({
                                    plaka_treyler: '',
                                    kesinti_turu: '',
                                    neden: '',
                                    baslangic_tarihi: '',
                                    bitis_tarihi: '',
                                    gun_sayisi: '',
                                    aciklama: '',
                                    ekleyen_kullanici: ''
                                })
                            }
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="filtre-grid">
                        {/* Dropdown + yazılabilir filtreler */}
                        <div className="filtre-grup">
                            <label>Plaka</label>
                            <input
                                list="plaka-list"
                                value={filtreler.plaka_treyler}
                                onChange={(e) => setFiltreler((prev) => ({ ...prev, plaka_treyler: e.target.value }))}
                                placeholder="Plaka ara/seç"
                            />
                            <datalist id="plaka-list">
                                {plakalar.map((p, idx) => (
                                    <option key={idx} value={`${p.plaka} - ${p.treyler}`} />
                                ))}
                            </datalist>
                        </div>

                        <div className="filtre-grup">
                            <label>Tür</label>
                            <input
                                list="tur-list"
                                value={filtreler.kesinti_turu}
                                onChange={(e) => setFiltreler((prev) => ({ ...prev, kesinti_turu: e.target.value }))}
                                placeholder="Tür ara/seç"
                            />
                            <datalist id="tur-list">
                                <option value="Bakım" />
                                <option value="Servis" />
                                <option value="Arıza" />
                                <option value="Kaza" />
                                <option value="Bölgede İş Yok" />
                            </datalist>
                        </div>

                        <div className="filtre-grup">
                            <label>Neden</label>
                            <input
                                list="neden-list"
                                value={filtreler.neden}
                                onChange={(e) => setFiltreler((prev) => ({ ...prev, neden: e.target.value }))}
                                placeholder="Neden ara/seç"
                            />
                            <datalist id="neden-list">
                                <option value="Tedarikçi Kaynaklı" />
                                <option value="Odak Kaynaklı" />
                            </datalist>
                        </div>

                        {/* Açıklama ve Ekleyen metin filtreleri */}
                        <div className="filtre-grup">
                            <label>Açıklama</label>
                            <input
                                type="text"
                                value={filtreler.aciklama}
                                onChange={(e) => setFiltreler((prev) => ({ ...prev, aciklama: e.target.value }))}
                                placeholder="Açıklama ara"
                            />
                        </div>

                        <div className="filtre-grup">
                            <label>Ekleyen</label>
                            <input
                                type="text"
                                value={filtreler.ekleyen_kullanici}
                                onChange={(e) => setFiltreler((prev) => ({ ...prev, ekleyen_kullanici: e.target.value }))}
                                placeholder="Ekleyen ara"
                            />
                        </div>

                        {/* Tarih filtreleri */}
                        <div className="filtre-grup">
                            <label>Başlangıç</label>
                            <input
                                type="date"
                                value={filtreler.baslangic_tarihi}
                                onChange={(e) => setFiltreler((prev) => ({ ...prev, baslangic_tarihi: e.target.value }))}
                            />
                        </div>

                        <div className="filtre-grup">
                            <label>Bitiş</label>
                            <input
                                type="date"
                                value={filtreler.bitis_tarihi}
                                onChange={(e) => setFiltreler((prev) => ({ ...prev, bitis_tarihi: e.target.value }))}
                            />
                        </div>

                        {/* Gün */}
                        <div className="filtre-grup">
                            <label>Gün</label>
                            <input
                                type="number"
                                value={filtreler.gun_sayisi}
                                onChange={(e) => setFiltreler((prev) => ({ ...prev, gun_sayisi: e.target.value }))}
                                placeholder="Gün sayısı"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* TABLO */}
            <div className="kesinti-tablo-wrapper">
                <div className="excel-btn-wrapper">
                    <button className="excel-btn" onClick={handleExportExcel}>
                        Excel'e Aktar
                    </button>
                </div>

                <h3>Kesinti Kayıtları</h3>

                <table className="kesinti-tablo">
                    <thead>
                        <tr>
                            <th>Plaka</th>
                            <th>Tür</th>
                            <th>Neden</th>
                            <th>Başlangıç</th>
                            <th>Bitiş</th>
                            <th>Gün</th>
                            <th>Açıklama</th>
                            <th>Ekleyen</th>
                            <th>İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtrelenmisKesintiler.length === 0 ? (
                            <tr>
                                <td colSpan="9">Kayıt bulunamadı.</td>
                            </tr>
                        ) : (
                            filtrelenmisKesintiler.map((k) => (
                                <tr key={k.id}>
                                    <td>{k.plaka_treyler}</td>
                                    <td>{k.kesinti_turu}</td>
                                    <td>{k.neden}</td>
                                    <td>{new Date(k.baslangic_tarihi).toLocaleDateString('tr-TR')}</td>
                                    <td>{new Date(k.bitis_tarihi).toLocaleDateString('tr-TR')}</td>
                                    <td>{k.gun_sayisi}</td>
                                    <td>{k.aciklama}</td>
                                    <td>{k.ekleyen_kullanici}</td>
                                    <td>
                                        <button onClick={() => handleSil(k.id)}>Sil</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );


}

export default KesintiGirisi;
