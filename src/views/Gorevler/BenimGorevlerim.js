import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './BenimGorevlerim.css';

function BenimGorevlerim() {
    const [gorevler, setGorevler] = useState([]);
    const [loading, setLoading] = useState(true);

    const girisYapan = JSON.parse(localStorage.getItem('girisYapanKullanici'));
    const kullaniciId = girisYapan?.id;

useEffect(() => {
    if (!kullaniciId) return;

    const fetchGorevler = async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from('gorevler')
            .select('*')
            .eq('atananid', kullaniciId)
            .neq('durum', 'Tamamlandı')
            .order('duedate', { ascending: true });

        if (error) {
            console.error('Görev alınamadı:', error.message);
        } else {
            setGorevler(data || []);
        }

        setLoading(false);
    };

    const isaretleOkundu = async () => {
        await supabase
            .from('gorevler')
            .update({ okundu: true })
            .eq('atananid', kullaniciId)
            .eq('okundu', false);
    };

    fetchGorevler();
    isaretleOkundu();
}, [kullaniciId]);

    const guncelleDurum = async (id, yeniDurum) => {
        const updateData = { durum: yeniDurum };

        // Eğer tamamlandıysa teslim_tarihi ekle
        if (yeniDurum === 'Tamamlandı') {
            const bugun = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            updateData.teslim_tarihi = bugun;
        }

        const { error } = await supabase
            .from('gorevler')
            .update(updateData)
            .eq('id', id);

        if (!error) {
            // Görev listesi güncelle
            if (yeniDurum === 'Tamamlandı') {
                setGorevler(prev => prev.filter(g => g.id !== id));
            } else {
                setGorevler(prev =>
                    prev.map(g => g.id === id ? { ...g, durum: yeniDurum } : g)
                );
            }
        } else {
            console.error('Durum güncellenemedi:', error.message);
        }
    };

    return (
        <div className="container">
            <h2>Benim Aktif Görevlerim</h2>

            {loading ? (
                <p>Yükleniyor...</p>
            ) : gorevler.length === 0 ? (
                <p>Size atanmış aktif görev bulunmamaktadır.</p>
            ) : (
                <ul>
                    {gorevler.map(g => (
                        <li key={g.id} className="gorev-item">
                            <div className="gorev-karti">
                                <div className="gorev-ust">
                                    <strong>{g.baslik}</strong>
                                    <span className={`durum ${g.durum.toLowerCase()}`}>{g.durum}</span>
                                </div>
                                {g.aciklama && <p>{g.aciklama}</p>}
                                <div>Teslim Tarihi: <b>{g.duedate}</b></div>

                                {g.durum === 'Beklemede' && (
                                    <button className="tamamla-btn" onClick={() => guncelleDurum(g.id, 'İşleme Alındı')}>
                                        İşe Başla
                                    </button>
                                )}

                                {g.durum === 'İşleme Alındı' && (
                                    <button className="tamamla-btn" onClick={() => guncelleDurum(g.id, 'Tamamlandı')}>
                                        Tamamla
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default BenimGorevlerim;
