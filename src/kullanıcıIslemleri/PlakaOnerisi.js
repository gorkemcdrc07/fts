import React, { useEffect, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import HaritaPopupMulti from "../components/HaritaPopupMulti";
import "./PlakaOnerisi.css";

/* ---------------- helpers ---------------- */
const haversine = (lat1, lon1, lat2, lon2) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
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
            name: `${city} - ${county}`,
        };
    }
    return null;
};

/* ---------------- component ---------------- */
export default function PlakaOnerisi() {
    const [il, setIl] = useState("");
    const [ilce, setIlce] = useState("");
    const [yuklemeNoktasi, setYuklemeNoktasi] = useState(null);
    const [araclar, setAraclar] = useState([]);
    const [enYakinAraclar, setEnYakinAraclar] = useState([]);
    const [haritaAcik, setHaritaAcik] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const navigate = useNavigate();

    // yerel saklama
    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem("plaka-oneri"));
        if (saved) {
            setIl(saved.il || "");
            setIlce(saved.ilce || "");
        }
    }, []);
    useEffect(() => {
        localStorage.setItem("plaka-oneri", JSON.stringify({ il, ilce }));
    }, [il, ilce]);

    const handleOneriAl = async () => {
        setErrorMsg("");
        if (!il || !ilce) {
            setErrorMsg("Lütfen il ve ilçe giriniz.");
            return;
        }
        setLoading(true);
        try {
            // 1) Konum çöz
            const konum = await geocode(il, ilce);
            if (!konum) {
                setErrorMsg("Yükleme konumu bulunamadı.");
                setLoading(false);
                return;
            }
            setYuklemeNoktasi(konum);

            // 2) Mobiliz çağrısı (CORS/tokene takılabilir)
            let aracListesi = [];
            try {
                const resp = await axios.get(
                    "https://ng.mobiliz.com.tr/su7/api/integrations/activity/last",
                    {
                        headers: {
                            "Content-Type": "application/json",
                            "Mobiliz-Token":
                                "dcbf43bb4015717c6d77420be787f6275e48840622519f2a149ba564099d4538",
                        },
                    }
                );
                aracListesi = resp?.data?.result || [];
            } catch (mobErr) {
                console.error("Mobiliz API hatası:", mobErr);
                setErrorMsg(
                    "Araç konumları alınamadı (CORS/token). Konum çözüldü, harita açılacak."
                );
                aracListesi = [];
            }

            // 3) Mesafe/süre hesapla
            if (Array.isArray(aracListesi) && aracListesi.length) {
                const enriched = aracListesi.map((a) => {
                    const distance = haversine(
                        konum.latitude,
                        konum.longitude,
                        a.latitude,
                        a.longitude
                    );
                    const averageSpeed = 65;
                    const durationMinutes = Math.round((distance / averageSpeed) * 60);
                    return {
                        ...a,
                        distance: parseFloat(distance.toFixed(2)),
                        durationMinutes,
                    };
                });
                const yakinlar = [...enriched]
                    .sort((x, y) => x.distance - y.distance)
                    .slice(0, 5);
                setAraclar(enriched);
                setEnYakinAraclar(yakinlar);
            } else {
                setAraclar([]);
                setEnYakinAraclar([]);
            }

            setHaritaAcik(true);
        } catch (err) {
            console.error(err);
            setErrorMsg("Beklenmeyen bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="plaka-page" style={{ marginLeft: "var(--sidebar-w, 72px)" }}>
            <Helmet>
                <title>PLAKA ÖNERİSİ</title>
            </Helmet>

            {/* Üst şerit */}
            <div className="plaka-topbar">
                <h2>Plaka Önerisi</h2>
                <div className="top-actions">
                    <button className="ghost" onClick={() => navigate(-1)}>
                        ← Geri
                    </button>
                    <button className="ghost" onClick={() => navigate("/anasayfa")}>
                        🏠 Anasayfa
                    </button>
                </div>
            </div>

            {/* Kart */}
            <div className="plaka-shell">
                <div className="plaka-card">
                    <div className="card-head">
                        <h3>Yükleme konumunu yaz, en yakın araçları bulalım.</h3>
                        <p>İl ve ilçe ile konumu çözüp araçlara olan mesafeyi hesaplarız.</p>
                    </div>

                    <div className="field">
                        <label>📍 Yükleme İl</label>
                        <input
                            type="text"
                            placeholder="Örn: Ankara"
                            value={il}
                            onChange={(e) => setIl(e.target.value)}
                        />
                    </div>

                    <div className="field">
                        <label>🏷️ Yükleme İlçe</label>
                        <input
                            type="text"
                            placeholder="Örn: Çankaya"
                            value={ilce}
                            onChange={(e) => setIlce(e.target.value)}
                        />
                    </div>

                    <button
                        className="primary"
                        type="button"
                        onClick={handleOneriAl}
                        disabled={loading}
                    >
                        {loading ? "Hesaplanıyor…" : "🚚 Öneri Al"}
                    </button>

                    {errorMsg && <div className="error-box">{errorMsg}</div>}

                    <div className="hint">
                        İpucu: Bu sayfa, sol menü genişliğine <code>--sidebar-w</code> değişkeni
                        üzerinden otomatik uyum sağlar.
                    </div>
                </div>
            </div>

            {/* Harita popup */}
            {haritaAcik && (
                <HaritaPopupMulti
                    open={haritaAcik}
                    onClose={() => setHaritaAcik(false)}
                    araclar={araclar}
                    yuklemeNoktasi={yuklemeNoktasi}
                    enYakinAraclar={enYakinAraclar}
                    onAracSec={(plaka) => console.log("Seçilen plaka:", plaka)}
                />
            )}
        </div>
    );
}
