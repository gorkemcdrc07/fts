import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './TumGorevler.css';

function TumGorevler() {
    const [gorevler, setGorevler] = useState([]);
    const [loading, setLoading] = useState(true);

    const kullaniciId = localStorage.getItem('kullaniciId');
    const kullaniciRol = localStorage.getItem('rol');

    useEffect(() => {
        const fetchGorevler = async () => {
            setLoading(true);

            const sorgu = supabase
                .from('gorevler')
                .select(`
                    *,
                    atayan:login!fk_atayan(kullaniciAdi),
                    atanan:login!fk_atanan(kullaniciAdi)
                `)
                .order('created_at', { ascending: false });

            if (kullaniciRol !== 'YÖNETİCİ') {
                sorgu.eq('atananid', kullaniciId);
            }

            const { data, error } = await sorgu;

            if (error) {
                console.error('Görevler alınamadı:', error.message);
            } else {
                setGorevler(data || []);
            }

            setLoading(false);
        };

        fetchGorevler();
    }, [kullaniciId, kullaniciRol]);

    return (
        <div className="container">
            <h2>Tüm Görevler</h2>

            {loading ? (
                <p>Yükleniyor...</p>
            ) : gorevler.length === 0 ? (
                <p className="info-text">Görev bulunamadı.</p>
            ) : (
                <ul>
                    {gorevler.map(g => (
                        <li className="gorev-karti" key={g.id}>
                            <div className="gorev-ust">
                                <strong>{g.baslik}</strong>
                                <span className={`durum ${g.durum.toLowerCase()}`}>{g.durum}</span>
                            </div>
                            <div className="gorev-detay">
                                <p><b>Görev Veren:</b> {g.atayan?.kullaniciAdi || '-'}</p>
                                <p><b>Görev Alan:</b> {g.atanan?.kullaniciAdi || '-'}</p>
                                {g.aciklama && <p><b>Açıklama:</b> {g.aciklama}</p>}
                                <p><b>Son Teslim Tarihi:</b> {g.duedate || '-'}</p>
                                <p><b>Teslim Edildiği Tarih:</b> {g.teslim_tarihi || '-'}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default TumGorevler;
