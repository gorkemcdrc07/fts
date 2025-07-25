import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './GorevAta.css';

function GorevAta() {
    const [kullanicilar, setKullanicilar] = useState([]);
    const [form, setForm] = useState({
        baslik: '',
        aciklama: '',
        duedate: '',
        atananid: '',
    });
    const [hata, setHata] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchKullanicilar = async () => {
            const { data, error } = await supabase
                .from('login')
                .select('id, kullanici, rol');
            if (!error) setKullanicilar(data);
            else console.error('Kullanıcılar alınamadı:', error.message);
        };
        fetchKullanicilar();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setHata('');

        const { baslik, aciklama, duedate, atananid } = form;
        const atayanid = Number(localStorage.getItem('kullaniciId'));

        if (!baslik || !duedate || !atananid) {
            setHata('Lütfen tüm alanları doldurun.');
            return;
        }

        const tarih = new Date(duedate);
        const tarihUTC = new Date(Date.UTC(tarih.getFullYear(), tarih.getMonth(), tarih.getDate()));
        const duzgunTarihStr = tarihUTC.toISOString();

        const { error } = await supabase.from('gorevler').insert([{
            baslik,
            aciklama,
            duedate: duzgunTarihStr,
            atayanid,
            atananid: Number(atananid),
            durum: 'Beklemede',
            okundu: false,
        }]);

        if (error) {
            console.error(error.message);
            setHata('Görev oluşturulamadı.');
        } else {
            navigate('/gorevler/tum');
        }
    };

    return (
        <div className="container">
            <h2>Görev Ata</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Görev Başlığı"
                    value={form.baslik}
                    onChange={(e) => setForm({ ...form, baslik: e.target.value })}
                    required
                />
                <textarea
                    placeholder="Açıklama"
                    value={form.aciklama}
                    onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
                />
                <input
                    type="date"
                    value={form.duedate}
                    onChange={(e) => setForm({ ...form, duedate: e.target.value })}
                    required
                />
                <select
                    value={form.atananid}
                    onChange={(e) => setForm({ ...form, atananid: e.target.value })}
                    required
                >
                    <option value="">Kullanıcı Seç</option>
                    {kullanicilar.map(k => (
                        <option key={k.id} value={k.id}>
                            {k.kullanici} ({k.rol})
                        </option>
                    ))}
                </select>
                {hata && <p style={{ color: 'red' }}>{hata}</p>}
                <button type="submit">Görev Oluştur</button>
            </form>
        </div>
    );
}

export default GorevAta;
