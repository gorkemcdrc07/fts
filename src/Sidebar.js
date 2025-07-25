import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './Sidebar.css';
import { supabase } from "./supabaseClient";

function Sidebar() {
    const [acik, setAcik] = useState(true);
    const [kullaniciMenuAcik, setKullaniciMenuAcik] = useState(false);
    const [raporMenuAcik, setRaporMenuAcik] = useState(false);
    const [aracMenuAcik, setAracMenuAcik] = useState(false);
    const [gorevMenuAcik, setGorevMenuAcik] = useState(false);

    const location = useLocation();
    const [okunmamisGorevSayisi, setOkunmamisGorevSayisi] = useState(0);
    const kullaniciId = parseInt(localStorage.getItem('kullaniciId'));
    const kullaniciRol = localStorage.getItem('rol') || '';

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

    const gorevAltMenuler = [
        { ad: 'Tüm Görevler', yol: '/gorevler/tum', ikon: '📋' },
        { ad: 'Görev Ata', yol: '/gorevler/ata', ikon: '➕', sadeceRol: 'YÖNETİCİ' },
        { ad: 'Benim Görevlerim', yol: '/gorevler/benim', ikon: '📌' },
    ];

    useEffect(() => {
        document.body.classList.toggle("sidebar-kapali", !acik);
    }, [acik]);

    // 🔔 Sayfa yüklendiğinde okunmamış görevleri al
    useEffect(() => {
        const fetchOkunmamis = async () => {
            if (!kullaniciId) return;

            try {
                let query;

                if (kullaniciRol === "YÖNETİCİ") {
                    query = supabase
                        .from("gorevler")
                        .select("id")
                        .eq("okundu", false)
                        .eq("durum", "Tamamlandı");
                } else {
                    query = supabase
                        .from("gorevler")
                        .select("id")
                        .eq("atananid", kullaniciId)
                        .eq("okundu", false)
                        .neq("durum", "Tamamlandı");
                }

                const { data, error } = await query;

                if (error) throw error;
                setOkunmamisGorevSayisi(data.length);
            } catch (error) {
                console.error("❌ Okunmamış görevler alınamadı:", error.message);
            }
        };

        fetchOkunmamis();
    }, [kullaniciId, kullaniciRol]);

    // 🔄 Realtime güncellemesi ile dinleme
    useEffect(() => {
        const rol = localStorage.getItem('rol');
        if (rol !== 'YÖNETİCİ') return;

        const channel = supabase
            .channel('gorev-tamamlandi')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'gorevler'
            }, async (payload) => {
                console.log("🟢 GÖREV GÜNCELLENDİ:", payload);

                const yeniGorev = payload.new;

                if (yeniGorev.durum === "Tamamlandı" && !yeniGorev.okundu) {
                    let kullaniciAd = 'Bir kullanıcı';

                    if (yeniGorev.tamamlayanid) {
                        const { data, error } = await supabase
                            .from('kullanicilar')
                            .select('ad')
                            .eq('id', yeniGorev.tamamlayanid)
                            .single();

                        if (!error && data?.ad) {
                            kullaniciAd = data.ad;
                        }
                    }

                    showPopup(`${kullaniciAd} görevi tamamladı.`);
                    setOkunmamisGorevSayisi(prev => prev + 1);
                }
            })
            .subscribe((status) => {
                console.log("📡 Kanal durumu:", status); // SUBSCRIBED beklenir
            });

        return () => {
            channel.unsubscribe();
        };
    }, []);

    // 🔄 Görev kabul edildiğinde atayana bildirim gönder
    useEffect(() => {
        const channel = supabase
            .channel('gorev-kabul')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'gorevler',
            }, (payload) => {
                const g = payload.new;
                const benimId = parseInt(localStorage.getItem('kullaniciId'));

                console.log("📦 GÜNCELLENEN GÖREV:", g);
                console.log("👤 BENİM ID:", benimId);
                console.log("🎯 GÖREVİN ATAYANI:", g.atayanid);

                if (
                    g.durum === "Kabul Edildi" &&
                    parseInt(g.atayanid) === benimId
                ) {
                    console.log("✅ BİLDİRİM GÖSTERİLİYOR");
                    showPopup('📬 Atadığınız görev kabul edildi!');
                }
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [kullaniciId]);

    // 🔔 Popup kutusu
    const showPopup = (mesaj) => {
        const popup = document.createElement('div');
        popup.className = 'popup-bildirim';
        popup.innerText = mesaj;
        document.body.appendChild(popup);
        setTimeout(() => {
            popup.classList.add('show');
        }, 10);
        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 300);
        }, 5000);
    };

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
                    className={`sidebar-submenu ${kullaniciMenuAcik ? 'acik' : 'kapali'}`}
                    style={{ maxHeight: kullaniciMenuAcik ? `${kullaniciAltMenuler.length * 48}px` : '0' }}
                >
                    {kullaniciAltMenuler.map((m) => {
                        const yeniSekme = ['/seferler', '/tamamlanan-seferler'].includes(m.yol);
                        const handleClick = () => {
                            yeniSekme
                                ? openInNewTab(m.yol)
                                : window.location.href = m.yol;
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
                    className={`sidebar-submenu ${aracMenuAcik ? 'acik' : 'kapali'}`}
                    style={{ maxHeight: aracMenuAcik ? `${aracAltMenuler.length * 48}px` : '0' }}
                >
                    {aracAltMenuler.map((m) => (
                        <div
                            key={m.yol}
                            className={`sidebar-item ${location.pathname === m.yol ? 'aktif' : ''}`}
                            onClick={() => window.location.href = m.yol}
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
                    className={`sidebar-submenu ${raporMenuAcik ? 'acik' : 'kapali'}`}
                    style={{ maxHeight: raporMenuAcik ? `${raporAltMenuler.length * 48}px` : '0' }}
                >
                    {raporAltMenuler.map((m) => (
                        <div
                            key={m.yol}
                            className={`sidebar-item ${location.pathname === m.yol ? 'aktif' : ''}`}
                            onClick={() => window.location.href = m.yol}
                        >
                            <span className="ikon">{m.ikon}</span>
                            {acik && <span>{m.ad}</span>}
                        </div>
                    ))}
                </div>

                {/* Görevler */}
                <div className="sidebar-category" onClick={() => setGorevMenuAcik(!gorevMenuAcik)}>
                    <span className="ikon">📝</span>
                    {acik && (
                        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            GÖREVLER
                            {okunmamisGorevSayisi > 0 && (
                                <span
                                    style={{
                                        backgroundColor: "#dc2626",
                                        color: "white",
                                        borderRadius: "12px",
                                        padding: "2px 8px",
                                        fontSize: "12px",
                                        fontWeight: "bold",
                                        minWidth: "20px",
                                        textAlign: "center"
                                    }}
                                >
                                    {okunmamisGorevSayisi}
                                </span>
                            )}
                        </span>
                    )}
                    {acik && <span className="arrow">{gorevMenuAcik ? '▾' : '▸'}</span>}
                </div>
                <div
                    className={`sidebar-submenu ${gorevMenuAcik ? 'acik' : 'kapali'}`}
                    style={{ maxHeight: gorevMenuAcik ? `${gorevAltMenuler.length * 48}px` : '0' }}
                >
                    {gorevAltMenuler
                        .filter((m) => !m.sadeceRol || m.sadeceRol === kullaniciRol)
                        .map((m) => (
                            <div
                                key={m.yol}
                                className={`sidebar-item ${location.pathname === m.yol ? 'aktif' : ''}`}
                                onClick={() => window.location.href = m.yol}
                            >
                                <span className="ikon">{m.ikon}</span>
                                {acik && (
                                    <span>
                                        {m.ad}
                                        {m.ad === 'Benim Görevlerim' && okunmamisGorevSayisi > 0 && (
                                            <span className="badge">{okunmamisGorevSayisi}</span>
                                        )}
                                    </span>
                                )}
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
