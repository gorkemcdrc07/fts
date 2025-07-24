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
        const simdi = new Date().toISOString();

        if (yeniDurum === 'İşleme Alındı') {
            updateData.gorev_kabul_tarih = simdi;

            // 🔔 Bildirim gönder
            const gorev = gorevler.find(g => g.id === id);
            if (gorev) {
                await supabase.from('bildirimler').insert([
                    {
                        kullanici_id: gorev.atayanid,
                        mesaj: `${girisYapan.kullaniciAdi} "${gorev.baslik}" görevini kabul etti.`,
                    }
                ]);
            }
        }

        if (yeniDurum === 'Tamamlandı') {
            updateData.teslim_tarihi = simdi;
        }

        const { error } = await supabase
            .from('gorevler')
            .update(updateData)
            .eq('id', id);

        if (!error) {
            if (yeniDurum === 'Tamamlandı') {
                setGorevler(prev => prev.filter(g => g.id !== id));
            } else {
                setGorevler(prev =>
                    prev.map(g => g.id === id ? { ...g, durum: yeniDurum, ...updateData } : g)
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
                                        Kabul Et
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
