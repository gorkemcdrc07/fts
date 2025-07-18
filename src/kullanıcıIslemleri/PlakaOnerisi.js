import React, { useState, useEffect } from 'react';
import axios from 'axios';
import HaritaPopupMulti from '../components/HaritaPopupMulti';
import './PlakaOnerisi.css'; // CSS dosyası aşağıda
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';


function PlakaOnerisi() {
    const [il, setIl] = useState('');
    const [ilce, setIlce] = useState('');
    const [yuklemeNoktasi, setYuklemeNoktasi] = useState(null);
    const [araclar, setAraclar] = useState([]);
    const [enYakinAraclar, setEnYakinAraclar] = useState([]);
    const [haritaAcik, setHaritaAcik] = useState(false);
    const navigate = useNavigate();


    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('plaka-oneri'));
        if (saved) {
            setIl(saved.il);
            setIlce(saved.ilce);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('plaka-oneri', JSON.stringify({ il, ilce }));
    }, [il, ilce]);

    const haversineDistance = (lat1, lon1, lat2, lon2) => {
        const toRad = (x) => (x * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const geocode = async (city, county) => {
        const address = encodeURIComponent(`${city} ${county}, Turkey`);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${address}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) {
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon),
                name: `${city} - ${county}`
            };
        }
        return null;
    };

    const handleOneriAl = async () => {
        if (!il || !ilce) {
            alert('Lütfen il ve ilçe giriniz.');
            return;
        }

        try {
            const konum = await geocode(il, ilce);
            if (!konum) {
                alert('Yükleme konumu bulunamadı.');
                return;
            }
            setYuklemeNoktasi(konum);

            const response = await axios.get('https://ng.mobiliz.com.tr/su7/api/integrations/activity/last', {
                headers: {
                    'Content-Type': 'application/json',
                    'Mobiliz-Token': 'dcbf43bb4015717c6d77420be787f6275e48840622519f2a149ba564099d4538'
                }
            });

            let aracListesi = response.data.result || [];

            aracListesi = aracListesi.map(arac => {
                const distance = haversineDistance(
                    konum.latitude, konum.longitude,
                    arac.latitude, arac.longitude
                );
                const averageSpeed = 65;
                const durationMinutes = Math.round((distance / averageSpeed) * 60);
                return {
                    ...arac,
                    distance: parseFloat(distance.toFixed(2)),
                    durationMinutes
                };
            });

            const yakinlar = [...aracListesi].sort((a, b) => a.distance - b.distance).slice(0, 5);
            setAraclar(aracListesi);
            setEnYakinAraclar(yakinlar);
            setHaritaAcik(true);

        } catch (err) {
            console.error('Mobiliz API hatası:', err);
            alert('Araç konumları alınırken hata oluştu.');
        }
    };

    return (
        <div className="plaka-container">

            <Helmet>
                <title>PLAKA ÖNERİSİ</title>
            </Helmet>


            {/* Geri Butonu - Sol Üst */}
            <div className="geri-buton-container">
                <button className="geri-buton" onClick={() => navigate(-1)}>
                    ← Geri
                </button>
            </div>

            <div className="plaka-card">
                <h1 className="plaka-title">Plaka Önerisi</h1>
                <p className="plaka-desc">Yükleme il ve ilçesini girin, en yakın araçları önerelim.</p>

                <div className="plaka-input-group">
                    <label>Yükleme İl</label>
                    <input
                        type="text"
                        value={il}
                        onChange={(e) => setIl(e.target.value)}
                        placeholder="Örn: Ankara"
                    />
                </div>

                <div className="plaka-input-group">
                    <label>Yükleme İlçe</label>
                    <input
                        type="text"
                        value={ilce}
                        onChange={(e) => setIlce(e.target.value)}
                        placeholder="Örn: Çankaya"
                    />
                </div>

                <button className="plaka-button" onClick={handleOneriAl}>
                    🚚 Öneri Al
                </button>
            </div>

            {haritaAcik && (
                <HaritaPopupMulti
                    open={haritaAcik}
                    onClose={() => setHaritaAcik(false)}
                    araclar={araclar}
                    yuklemeNoktasi={yuklemeNoktasi}
                    enYakinAraclar={enYakinAraclar}
                    onAracSec={(plaka) => console.log('Seçilen plaka:', plaka)}
                />
            )}
        </div>
    );

}

export default PlakaOnerisi;
