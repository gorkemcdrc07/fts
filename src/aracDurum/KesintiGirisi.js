import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './KesintiGirisi.css';
import * as XLSX from 'xlsx'; // En üste ekle

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

    useEffect(() => {
        verileriGetir();
        plakalarGetir();
    }, []);

    const verileriGetir = async () => {
        const { data } = await supabase.from('kesintiler').select('*').order('id', { ascending: false });
        setKesintiler(data || []);
    };

    const plakalarGetir = async () => {
        const { data } = await supabase.from('plakalar').select('plaka, treyler');
        if (data) setPlakalar(data);
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
            <div className="geri-btn-kapsayici">
                <button className="geri-btn" onClick={() => window.history.back()}>← Geri</button>
            </div>

            <form onSubmit={handleSubmit} className="kesinti-form">
                <h2>Kesinti Girişi</h2>

                <label>Plaka - Treyler</label>
                <select name="plaka_treyler" value={form.plaka_treyler} onChange={handleChange} required>
                    <option value="">Plaka Seçin</option>
                    {plakalar.map((p, idx) => (
                        <option key={idx} value={`${p.plaka} - ${p.treyler}`}>{p.plaka} - {p.treyler}</option>
                    ))}
                </select>

                <label>Kesinti Türü</label>
                <select name="kesinti_turu" value={form.kesinti_turu} onChange={handleChange} required>
                    <option value="">Tür Seçin</option>
                    <option value="Bakım">Bakım</option>
                    <option value="Servis">Servis</option>
                    <option value="Arıza">Arıza</option>
                    <option value="Kaza">Kaza</option>
                    <option value="Bölgede İş Yok">Bölgede İş Yok</option>

                </select>

                <label>Kesinti Nedeni</label>
                <select name="neden" value={form.neden} onChange={handleChange} required>
                    <option value="">Neden Seçin</option>
                    <option value="Tedarikçi Kaynaklı">Tedarikçi Kaynaklı</option>
                    <option value="Odak Kaynaklı">Odak Kaynaklı</option>
                </select>

                <label>Başlangıç Tarihi</label>
                <input type="date" name="baslangic_tarihi" value={form.baslangic_tarihi} onChange={handleChange} required />

                <label>Bitiş Tarihi</label>
                <input type="date" name="bitis_tarihi" value={form.bitis_tarihi} onChange={handleChange} required />

                <label>Toplam Gün</label>
                <input value={form.gun_sayisi} readOnly placeholder="Gün sayısı" />

                <label>Açıklama</label>
                <textarea name="aciklama" value={form.aciklama} onChange={handleChange} />

                <button type="submit">Kaydet</button>
            </form>

            <div className="kesinti-tablo-wrapper">
                <div className="excel-btn-wrapper">
                    <button className="excel-btn" onClick={handleExportExcel}>Excel'e Aktar</button>
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
                        {kesintiler.length === 0 ? (
                            <tr><td colSpan="9">Kayıt bulunamadı.</td></tr>
                        ) : (
                            kesintiler.map((k) => (
                                <tr key={k.id}>
                                    <td>{k.plaka_treyler}</td>
                                    <td>{k.kesinti_turu}</td>
                                    <td>{k.neden}</td>
                                    <td>{new Date(k.baslangic_tarihi).toLocaleDateString('tr-TR')}</td>
                                    <td>{new Date(k.bitis_tarihi).toLocaleDateString('tr-TR')}</td>
                                    <td>{k.gun_sayisi}</td>
                                    <td>{k.aciklama}</td>
                                    <td>{k.ekleyen_kullanici}</td>
                                    <td><button onClick={() => handleSil(k.id)}>Sil</button></td>
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
