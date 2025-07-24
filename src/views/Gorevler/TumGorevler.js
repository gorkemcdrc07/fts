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

    // saatFarki pozitifse saate ekler, negatifse çıkarır
    function formatTarihSaat(tarihStr, saatFarki = 0, saatSifirla = false) {
        if (!tarihStr) return '-';

        const tarih = new Date(tarihStr);

        if (saatFarki < 0) {
            let utcSaat = tarih.getUTCHours() + saatFarki;
            let gun = tarih.getUTCDate();
            let ay = tarih.getUTCMonth() + 1;
            let yil = tarih.getUTCFullYear();

            if (utcSaat < 0) {
                utcSaat += 24;
                gun -= 1;
                if (gun < 1) {
                    ay -= 1;
                    if (ay < 1) {
                        ay = 12;
                        yil -= 1;
                    }
                    gun = 30; // Basit yaklaşım; ay sonu daha detaylı kontrol edilebilir
                }
            }

            const saatStr = saatSifirla ? '00' : String(utcSaat).padStart(2, '0');
            const dakikaStr = saatSifirla ? '00' : String(tarih.getUTCMinutes()).padStart(2, '0');
            const gunStr = String(gun).padStart(2, '0');
            const ayStr = String(ay).padStart(2, '0');

            return `${gunStr}.${ayStr}.${yil} ${saatStr}:${dakikaStr}`;
        } else {
            tarih.setHours(tarih.getHours() + saatFarki);

            const saat = saatSifirla ? 0 : tarih.getHours();
            const dakika = saatSifirla ? 0 : tarih.getMinutes();
            const gun = tarih.getDate();
            const ay = tarih.getMonth() + 1;
            const yil = tarih.getFullYear();

            const saatStr = String(saat).padStart(2, '0');
            const dakikaStr = String(dakika).padStart(2, '0');
            const gunStr = String(gun).padStart(2, '0');
            const ayStr = String(ay).padStart(2, '0');

            return `${gunStr}.${ayStr}.${yil} ${saatStr}:${dakikaStr}`;
        }
    }

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
                                <p><b>Görev Verilen Tarih:</b> {formatTarihSaat(g.gorev_verilen_tarih)}</p>

                                <p><b>Görev Alan:</b> {g.atanan?.kullaniciAdi || '-'}</p>
                                {g.aciklama && <p><b>Açıklama:</b> {g.aciklama}</p>}

                                <p><b>Son Teslim Tarihi:</b> {formatTarihSaat(g.duedate)}</p>
                                <p><b>Görev Kabul Tarihi:</b> {formatTarihSaat(g.gorev_kabul_tarih, -3)}</p>

                                <p className="tamamlanma-tarihi">
                                    <b>Tamamlanma Tarihi:</b> {formatTarihSaat(g.teslim_tarihi, +3)}
                                </p>

                                {g.kullanici_aciklama && (
                                    <p className="kullanici-aciklama">
                                        <b>Kullanıcı Açıklaması:</b> {g.kullanici_aciklama}
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default TumGorevler;
