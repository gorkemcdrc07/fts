import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './TedarikciMasraf.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const BOS_FORM = {
    tedarikci: '',
    tarih: '',
    neden: '',
    bedel: '',
    aciklama: '',
    sefer_no: '' // 🔹 Yeni alan
};

function TedarikciMasraf() {
    const kullanici = localStorage.getItem('kullanici') || '';
    const kullaniciRol = localStorage.getItem('rol') || '';

    const [form, setForm] = useState(BOS_FORM);
    const [masraflar, setMasraflar] = useState([]);
    const [filtre, setFiltre] = useState('');
    const [formGorunur, setFormGorunur] = useState(false);
    const [duzenlemeId, setDuzenlemeId] = useState(null);

    // ✅ REEL'e İşlendi checkbox'ları için geçici UI state
    const [reelDurum, setReelDurum] = useState({}); // { [id]: boolean }

    useEffect(() => {
        veriGetir();
    }, []);

    const veriGetir = async () => {
        const { data, error } = await supabase
            .from('tedarikci_masraflar')
            .select('*')
            .order('tarih', { ascending: false });
        if (!error) setMasraflar(data || []);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const kayit = {
            ...form,
            bedel: parseFloat(form.bedel),
            statu: 'ONAY BEKLİYOR',
            reel_islendi: false, // ✅ yeni alanı başlangıçta false
        };

        if (isNaN(kayit.bedel)) return alert('Geçerli bir bedel giriniz.');

        let sonuc;
        if (duzenlemeId) {
            sonuc = await supabase.from('tedarikci_masraflar').update(kayit).eq('id', duzenlemeId);
        } else {
            sonuc = await supabase.from('tedarikci_masraflar').insert([kayit]);

            // Bildirim gönder
            const bekir = await supabase
                .from('login')
                .select('id')
                .eq('kullanici', 'BEKİR AKCAGÖZ')
                .single();

            if (bekir.data?.id) {
                await supabase.from('bildirimler').insert([{
                    kullanici_id: bekir.data.id,
                    mesaj: `Yeni masraf: ${form.tedarikci} - ${form.neden}`,
                    okundu: false,
                    baslik: 'Masraf Onayı'
                }]);
            }
        }

        if (!sonuc.error) {
            setForm(BOS_FORM);
            setDuzenlemeId(null);
            setFormGorunur(false);
            veriGetir();
            toast.success("✅ Masraf başarıyla eklendi!");
        } else {
            toast.error("❌ Masraf kaydedilemedi.");
        }
    };

    const handleSil = async (id) => {
        if (kullaniciRol !== 'YÖNETİCİ') {
            toast.error('❌ Silme yetkiniz yok.');
            return;
        }

        if (!window.confirm("Silmek istiyor musunuz?")) return;

        const { error } = await supabase
            .from('tedarikci_masraflar')
            .delete()
            .eq('id', id);

        if (!error) {
            veriGetir();
            toast.info("🗑️ Masraf silindi.");
        } else {
            toast.error("❌ Silme işlemi başarısız.");
        }
    };

    const handleDuzenle = (kayit) => {
        setForm(kayit);
        setDuzenlemeId(kayit.id);
        setFormGorunur(true);
    };

    const handleOnayla = async (id) => {
        const { error } = await supabase
            .from('tedarikci_masraflar')
            .update({ statu: 'ONAYLANDI' })
            .eq('id', id);
        if (!error) {
            veriGetir();
            toast.success("✔️ Masraf onaylandı.");
        }
    };

    // ✅ REEL'e İşlendi: checkbox işaretleme
    const handleReelTick = (id, checked) => {
        setReelDurum(prev => ({ ...prev, [id]: checked }));
    };

    // ✅ REEL'e İşlendi: kaydet
    const handleReelKaydet = async (id) => {
        if (!reelDurum[id]) {
            toast.warn('Önce kutucuğu işaretleyin.');
            return;
        }
        const { error } = await supabase
            .from('tedarikci_masraflar')
            .update({ reel_islendi: true })
            .eq('id', id);

        if (!error) {
            setReelDurum(prev => {
                const kopya = { ...prev };
                delete kopya[id];
                return kopya;
            });
            await veriGetir();
            toast.success('📌 REEL’e işlendi olarak kaydedildi.');
        } else {
            toast.error('❌ Kaydedilemedi.');
        }
    };

    const exportToExcel = () => {
        const excelData = masraflar.map((m) => ({
            'Sefer No': m.sefer_no, // 🔹 Yeni sütun
            'Tedarikçi': m.tedarikci,
            'Tarih': m.tarih,
            'Masraf Nedeni': m.neden,
            'Bedel': m.bedel,
            'Açıklama': m.aciklama,
            'Statu': m.statu,
            "REEL'e İşlendi": m.reel_islendi ? 'Evet' : 'Hayır', // ✅ Excel'e ekle
        }));

        const sheet = XLSX.utils.json_to_sheet(excelData);
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, "Masraflar");

        const excelBuffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(blob, 'tedarikci_masraflari.xlsx');
    };

    // ✅ Filtreye sefer_no'yu da dahil ettik ve null güvenli yaptık
    const filtrelenmis = masraflar.filter(m => {
        const f = (filtre || '').toLowerCase();
        return (
            (m.tedarikci || '').toLowerCase().includes(f) ||
            (m.neden || '').toLowerCase().includes(f) ||
            (m.sefer_no || '').toLowerCase().includes(f)
        );
    });

    const onayVerebilir =
        kullaniciRol === 'YÖNETİCİ' &&
        kullanici?.trim().toUpperCase() === 'BEKİR AKCAGÖZ';

    return (
        <div className="masraf-modern-container">
            <div className="masraf-header">
                {!formGorunur && (
                    <>
                        <button className="ekle-btn" onClick={() => setFormGorunur(true)}>+ EKLE</button>
                        <input
                            className="filtre-input"
                            placeholder="Tedarikçi / Neden / Sefer No filtrele"
                            value={filtre}
                            onChange={(e) => setFiltre(e.target.value)}
                        />
                        <button className="excel-btn" onClick={exportToExcel}>Excel'e Aktar</button>
                    </>
                )}
            </div>

            {formGorunur && (
                <form onSubmit={handleSubmit} className="masraf-form">
                    <h2>{duzenlemeId ? 'Masraf Düzenle' : 'Yeni Masraf Girişi'}</h2>

                    <label>Sefer No</label>
                    <input
                        name="sefer_no"
                        value={form.sefer_no}
                        onChange={handleChange}
                    />

                    <label>Tedarikçi</label>
                    <input name="tedarikci" value={form.tedarikci} onChange={handleChange} required />

                    <label>Tarih</label>
                    <input type="date" name="tarih" value={form.tarih} onChange={handleChange} required />

                    <label>Masraf Nedeni</label>
                    <input name="neden" value={form.neden} onChange={handleChange} required />

                    <label>Bedel</label>
                    <input type="number" name="bedel" value={form.bedel} onChange={handleChange} required />

                    <label>Açıklama</label>
                    <textarea name="aciklama" value={form.aciklama} onChange={handleChange} />

                    <div className="form-btns">
                        <button type="submit">Kaydet</button>
                        <button
                            type="button"
                            className="iptal-btn"
                            onClick={() => {
                                setForm(BOS_FORM);
                                setDuzenlemeId(null);
                                setFormGorunur(false);
                            }}
                        >
                            Vazgeç
                        </button>
                    </div>
                </form>
            )}

            {!formGorunur && (
                <div className="masraf-table-wrapper">
                    <table className="masraf-table">
                        <thead>
                            <tr>
                                <th>Sefer No</th>
                                <th>Tedarikçi</th>
                                <th>Tarih</th>
                                <th>Neden</th>
                                <th>Bedel</th>
                                <th>Açıklama</th>
                                <th>Statu</th>
                                <th>İşlem</th>
                                <th>REEL’e İşlendi</th> {/* ✅ yeni sütun en sonda */}
                            </tr>
                        </thead>
                        <tbody>
                            {filtrelenmis.map((m) => (
                                <tr key={m.id}>
                                    <td>{m.sefer_no}</td>
                                    <td>{m.tedarikci}</td>
                                    <td>{m.tarih}</td>
                                    <td>{m.neden}</td>
                                    <td>{m.bedel}</td>
                                    <td>{m.aciklama}</td>
                                    <td>{m.statu}</td>
                                    <td>
                                        <button onClick={() => handleDuzenle(m)}>Düzenle</button>

                                        {(kullaniciRol === 'YÖNETİCİ') && (
                                            <button onClick={() => handleSil(m.id)}>Sil</button>
                                        )}

                                        {m.statu?.toUpperCase() === 'ONAY BEKLİYOR' && onayVerebilir && (
                                            <button onClick={() => handleOnayla(m.id)}>Onayla</button>
                                        )}
                                    </td>

                                    {/* ✅ REEL'e İşlendi hücresi */}
                                    <td>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input
                                                type="checkbox"
                                                checked={reelDurum[m.id] ?? !!m.reel_islendi}
                                                onChange={(e) => handleReelTick(m.id, e.target.checked)}
                                                disabled={!!m.reel_islendi} // kaydedilmişse kilitli
                                            />
                                            {(!m.reel_islendi && (reelDurum[m.id] ?? false)) && (
                                                <button onClick={() => handleReelKaydet(m.id)}>
                                                    Kaydet
                                                </button>
                                            )}
                                            {m.reel_islendi && <span>✔️</span>}
                                        </label>
                                    </td>
                                </tr>
                            ))}
                            {filtrelenmis.length === 0 && (
                                <>
                                    {/* 9 sütun */}
                                    <tr>
                                        <td colSpan="9">Kayıt bulunamadı</td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <ToastContainer position="bottom-right" autoClose={4000} />
        </div>
    );
}

export default TedarikciMasraf;
