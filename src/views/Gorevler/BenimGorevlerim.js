import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './BenimGorevlerim.css';

function BenimGorevlerim() {
    const [gorevler, setGorevler] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bildirimler, setBildirimler] = useState([]);

    const girisYapan = JSON.parse(localStorage.getItem('girisYapanKullanici'));
    const kullaniciId = girisYapan?.id;

    useEffect(() => {
        if (!kullaniciId) return;

        // Görevleri çek
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

        // Okunmamış görevleri okundu olarak işaretle
        const isaretleOkundu = async () => {
            await supabase
                .from('gorevler')
                .update({ okundu: true })
                .eq('atananid', kullaniciId)
                .eq('okundu', false);
        };

        fetchGorevler();
        isaretleOkundu();

        // Realtime bildirim aboneliği
        const subscription = supabase
            .from(`bildirimler:kullanici_id=eq.${kullaniciId}`)
            .on('INSERT', payload => {
                setBildirimler(prev => [...prev, payload.new]);
                alert(`Yeni Bildirim: ${payload.new.mesaj}`);
            })
            .subscribe();

        return () => {
            supabase.removeSubscription(subscription);
        };
    }, [kullaniciId]);

    // Tarih saat formatlama fonksiyonu
    function formatTarihSaat(tarihStr, saatFarki = 0, saatSifirla = false) {
        if (!tarihStr) return '-';

        const tarih = new Date(tarihStr);
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

    const guncelleDurum = async (id, yeniDurum) => {
        const updateData = { durum: yeniDurum };
        const simdi = new Date().toISOString();

        if (yeniDurum === 'İşleme Alındı') {
            updateData.gorev_kabul_tarih = simdi;

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
            const aciklama = prompt("Görevi tamamlamak için açıklama girin:");

            if (!aciklama || aciklama.trim() === "") {
                alert("Açıklama girilmeden görev tamamlanamaz.");
                return;
            }

            updateData.teslim_tarihi = simdi;
            updateData.kullanici_aciklama = aciklama;

            const gorev = gorevler.find(g => g.id === id);
            if (gorev) {
                await supabase.from('bildirimler').insert([
                    {
                        kullanici_id: gorev.atayanid,
                        mesaj: `${girisYapan.kullaniciAdi} "${gorev.baslik}" görevini tamamladı.`,
                    }
                ]);
            }
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
                                    <span className={`durum ${g.durum.toLowerCase()}`}>
                                        {g.durum}
                                    </span>
                                </div>

                                {g.aciklama && <p><b>Açıklama:</b> {g.aciklama}</p>}

                                <p>
                                    <b>Teslim Tarihi:</b>{' '}
                                    <span>{formatTarihSaat(g.duedate, 3, true)}</span>
                                </p>

                                {g.gorev_kabul_tarih && (
                                    <p>
                                        <b>Görev Kabul Tarihi:</b>{' '}
                                        <span>{formatTarihSaat(g.gorev_kabul_tarih, 0, false)}</span>
                                    </p>
                                )}

                                {g.kullanici_aciklama && (
                                    <p className="kullanici-aciklama">
                                        <b>Kullanıcı Açıklaması:</b> {g.kullanici_aciklama}
                                    </p>
                                )}

                                {g.durum === 'Beklemede' && (
                                    <button
                                        className="tamamla-btn"
                                        onClick={() => guncelleDurum(g.id, 'İşleme Alındı')}
                                    >
                                        Kabul Et
                                    </button>
                                )}

                                {g.durum === 'İşleme Alındı' && (
                                    <button
                                        className="tamamla-btn"
                                        onClick={() => guncelleDurum(g.id, 'Tamamlandı')}
                                    >
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
