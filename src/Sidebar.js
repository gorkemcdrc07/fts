import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './Sidebar.css';

function Sidebar() {
    const [acik, setAcik] = useState(true);
    const [kullaniciMenuAcik, setKullaniciMenuAcik] = useState(false);
    const [raporMenuAcik, setRaporMenuAcik] = useState(false);
    const [aracMenuAcik, setAracMenuAcik] = useState(false);

    const location = useLocation();

    const kullaniciAltMenuler = [
        { ad: 'PLANLAMA', yol: '/planlama', ikon: '🗓️' },
        { ad: 'PLAKA ÖNERİSİ', yol: '/plaka-onerisi', ikon: '📋' },
        { ad: 'AKTİF SEFERLER', yol: '/seferler', ikon: '🚛' },
        { ad: 'TAMAMLANAN SEFERLER', yol: '/tamamlanan-seferler', ikon: '✅' },
    ];

    const aracAltMenuler = [
        { ad: 'Araç Yönetimi', yol: '/arac/yonetim', ikon: '🚗' },
        { ad: 'İzin Girişi', yol: '/arac/izin-girisi', ikon: '📅' },
        { ad: 'Kesinti Girişi', yol: '/arac/kesinti-girisi', ikon: '✂️' },
    ];

    const raporAltMenuler = [
        { ad: 'Kullanıcı KPI', yol: '/raporlar/kullanici-kpi', ikon: '📈' },
        { ad: 'Proje & Lokasyon Bazlı Raporlar', yol: '/raporlar/lokasyon-rapor', ikon: '🗺️' },
        { ad: 'Yüklemede Bekleme', yol: '/raporlar/yuklemede-bekleme', ikon: '⏳' },
        { ad: 'Teslimde Bekleme', yol: '/raporlar/teslimde-bekleme', ikon: '🕓' },
        { ad: 'Yüklemede Gecikme', yol: '/raporlar/yuklemede-gecikme', ikon: '🕐' },
        { ad: 'Teslimde Gecikme', yol: '/raporlar/teslimde-gecikme', ikon: '🕔' },
        { ad: 'Sefer Süreleri', yol: '/raporlar/sefer-sureleri', ikon: '🚚' },
        { ad: 'Plaka Bazlı Raporlar', yol: '/raporlar/plaka-bazli', ikon: '🚛' },
    ];

    useEffect(() => {
        document.body.classList.toggle("sidebar-kapali", !acik);
    }, [acik]);

    // Yeni sekmede açmak için fonksiyon
    const openInNewTab = (path) => {
        const baseUrl = window.location.origin;
        window.open(baseUrl + path, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className={`sidebar ${acik ? 'acik' : 'kapali'}`}>
            <div className="sidebar-header">
                {acik && <span className="logo">FTSWeb</span>}
                <button className="toggle-btn" onClick={() => setAcik(!acik)}>
                    {acik ? '←' : '☰'}
                </button>
            </div>

            <div className="sidebar-menu">
                {/* Kullanıcı İşlemleri */}
                <div className="sidebar-category" onClick={() => setKullaniciMenuAcik(!kullaniciMenuAcik)}>
                    <span className="ikon">👥</span>
                    {acik && <span>KULLANICI İŞLEMLERİ</span>}
                    {acik && <span className="arrow">{kullaniciMenuAcik ? '▾' : '▸'}</span>}
                </div>
                <div
                    key={`kullanici-${kullaniciMenuAcik ? 'open' : 'closed'}`}
                    className={`sidebar-submenu ${kullaniciMenuAcik ? 'acik' : 'kapali'}`}
                    style={{ maxHeight: kullaniciMenuAcik ? `${kullaniciAltMenuler.length * 48}px` : '0' }}
                >
                    {kullaniciAltMenuler.map((m) => {
                        const sadeceYeniSekmede = ['/seferler', '/tamamlanan-seferler'].includes(m.yol);

                        const handleClick = () => {
                            if (sadeceYeniSekmede) {
                                const baseUrl = window.location.origin;
                                window.open(baseUrl + m.yol, '_blank', 'noopener,noreferrer'); // yeni sekmede aç
                            } else {
                                window.location.href = m.yol; // aynı sekmede aç
                            }
                        };

                        return (
                            <div
                                key={m.yol}
                                className={`sidebar-item ${location.pathname === m.yol ? 'aktif' : ''}`}
                                onClick={handleClick}
                            >
                                <span className="ikon">{m.ikon}</span>
                                {acik && <span>{m.ad}</span>}
                            </div>
                        );
                    })}


                </div>

                {/* Araç Durumu */}
                <div className="sidebar-category" onClick={() => setAracMenuAcik(!aracMenuAcik)}>
                    <span className="ikon">🚗</span>
                    {acik && <span>ARAÇ DURUMLARI</span>}
                    {acik && <span className="arrow">{aracMenuAcik ? '▾' : '▸'}</span>}
                </div>
                <div
                    key={`arac-${aracMenuAcik ? 'open' : 'closed'}`}
                    className={`sidebar-submenu ${aracMenuAcik ? 'acik' : 'kapali'}`}
                    style={{ maxHeight: aracMenuAcik ? `${aracAltMenuler.length * 48}px` : '0' }}
                >
                    {aracAltMenuler.map((m) => (
                        <div
                            key={m.yol}
                            className={`sidebar-item ${location.pathname === m.yol ? 'aktif' : ''}`}
                            onClick={() => window.location.href = m.yol} // aynı sekmede aç
                        >
                            <span className="ikon">{m.ikon}</span>
                            {acik && <span>{m.ad}</span>}
                        </div>
                    ))}

                </div>

                {/* Raporlar */}
                <div className="sidebar-category" onClick={() => setRaporMenuAcik(!raporMenuAcik)}>
                    <span className="ikon">📑</span>
                    {acik && <span>RAPORLAR</span>}
                    {acik && <span className="arrow">{raporMenuAcik ? '▾' : '▸'}</span>}
                </div>
                <div
                    key={`rapor-${raporMenuAcik ? 'open' : 'closed'}`}
                    className={`sidebar-submenu ${raporMenuAcik ? 'acik' : 'kapali'}`}
                    style={{ maxHeight: raporMenuAcik ? `${raporAltMenuler.length * 48}px` : '0' }}
                >
                    {raporAltMenuler.map((m) => (
                        <div
                            key={m.yol}
                            className={`sidebar-item ${location.pathname === m.yol ? 'aktif' : ''}`}
                            onClick={() => window.location.href = m.yol} // aynı sekmede aç
                        >
                            <span className="ikon">{m.ikon}</span>
                            {acik && <span>{m.ad}</span>}
                        </div>
                    ))}

                </div>
            </div>
        </div>
    );
}

export default Sidebar;
