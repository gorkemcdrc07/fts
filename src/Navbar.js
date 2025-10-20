import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Navbar.css";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

function Navbar() {
    // ✔ Görünen ad için daha sağlam okuma
    const rawKullanici = (localStorage.getItem("kullanici") || "").trim();
    const rawKullaniciAdi = (localStorage.getItem("kullaniciAdi") || "").trim();
    const displayName = rawKullanici || rawKullaniciAdi || "Kullanıcı";

    // Rol
    const rol = (localStorage.getItem("rol") || "Rol").toString();

    // Admin izni: sadece admin ve yagiz
    const usernameForAdminCheck = (rawKullaniciAdi || rawKullanici).toLowerCase();
    const isAdmin = usernameForAdminCheck === "admin" || usernameForAdminCheck === "yagiz";

    const kullaniciIdRaw = localStorage.getItem("kullaniciId");
    const kullaniciId = kullaniciIdRaw ? Number(kullaniciIdRaw) : null;

    const navigate = useNavigate();

    // Tema/Profil/Paneller
    const [tema, setTema] = useState(localStorage.getItem("tema") || "dark");
    const [profilModalAcik, setProfilModalAcik] = useState(false);
    const [profilResim, setProfilResim] = useState(
        localStorage.getItem("profilFotograf") || null
    );
    const [selectedFile, setSelectedFile] = useState(null);
    const [email, setEmail] = useState("");
    const [sifrePanelAcik, setSifrePanelAcik] = useState(false);
    // Not: Kullanıcı adı sadece şifre değiştirme için kullanıldığından,
    // input için local state tutulur, ancak güncel displayName dışarıdan alınır.
    const [kullaniciAdi, setKullaniciAdi] = useState("");
    const [yeniSifre, setYeniSifre] = useState("");
    const [okunmamisGorevSayisi, setOkunmamisGorevSayisi] = useState(0);
    const [bildirimGoster, setBildirimGoster] = useState(false);
    const [kaydediliyor, setKaydediliyor] = useState(false);

    // Tema uygulama
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", tema);
    }, [tema]);

    const temaDegistir = () => {
        const yeniTema = tema === "dark" ? "light" : "dark";
        setTema(yeniTema);
        localStorage.setItem("tema", yeniTema);
    };

    // Modal açılınca son değerleri doldur
    useEffect(() => {
        if (profilModalAcik) {
            setEmail(localStorage.getItem("email") || "");
            // Kullanıcı adı alanını doldurmak için
            setKullaniciAdi(rawKullaniciAdi || rawKullanici || "");
        }
    }, [profilModalAcik, rawKullanici, rawKullaniciAdi]);

    // Okunmamış görevler
    const fetchOkunmamisGorevler = async () => {
        if (!kullaniciId) return;

        const { data, error } = await supabase
            .from("gorevler")
            .select("id")
            .eq("atananid", kullaniciId)
            .eq("okundu", false)
            .neq("durum", "Tamamlandı");

        if (!error && data) {
            const sayi = data.length;
            setOkunmamisGorevSayisi(sayi);
            if (sayi > 0) {
                setBildirimGoster(true);
                setTimeout(() => setBildirimGoster(false), 5000);
            }
        }
    };

    useEffect(() => {
        fetchOkunmamisGorevler();
    }, [kullaniciId]);

    // Realtime dinleme
    useEffect(() => {
        if (!kullaniciId) return;

        const kanal = supabase
            .channel("gorev-bildirim-kanali")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "gorevler",
                    filter: `atananid=eq.${kullaniciId}`,
                },
                () => fetchOkunmamisGorevler()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(kanal);
        };
    }, [kullaniciId]);

    const cikisYap = () => {
        localStorage.clear();
        navigate("/");
    };

    // Profil resmi seçme + önizleme
    const prevObjectUrlRef = useRef(null);
    const handleResimSec = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);

        if (prevObjectUrlRef.current) {
            URL.revokeObjectURL(prevObjectUrlRef.current);
            prevObjectUrlRef.current = null;
        }
        const previewUrl = URL.createObjectURL(file);
        prevObjectUrlRef.current = previewUrl;
        setProfilResim(previewUrl);
    };

    useEffect(() => {
        return () => {
            if (prevObjectUrlRef.current) {
                URL.revokeObjectURL(prevObjectUrlRef.current);
                prevObjectUrlRef.current = null;
            }
        };
    }, []);

    // Güvenli fallback avatar harfi
    const avatarHarf = useMemo(
        () => (displayName?.trim()?.[0] || "K").toUpperCase(),
        [displayName]
    );

    const handleProfilKaydet = async () => {
        try {
            if (!kullaniciId) throw new Error("Kullanıcı oturumu bulunamadı.");
            setKaydediliyor(true);

            let fotoUrl = profilResim;
            const path = `${kullaniciId}/profil.jpg`;

            if (selectedFile) {
                const { error: uploadError } = await supabase.storage
                    .from("profil-fotograflari")
                    .upload(path, selectedFile, { upsert: true });

                if (uploadError) {
                    console.error("Storage upload error:", uploadError);
                    alert("Fotoğraf yükleme hatası: " + uploadError.message);
                    setKaydediliyor(false);
                    return;
                }

                const { data: publicUrlData, error: publicUrlError } = supabase.storage
                    .from("profil-fotograflari")
                    .getPublicUrl(path);

                if (publicUrlError) {
                    console.error("Public URL alma hatası:", publicUrlError);
                    alert("Fotoğraf URL alınırken hata oluştu.");
                    setKaydediliyor(false);
                    return;
                }

                fotoUrl = publicUrlData.publicUrl;
            }

            const { error: updateError } = await supabase
                .from("login")
                .update({ profil_fotograf: fotoUrl, email })
                .eq("id", kullaniciId);

            if (updateError) {
                console.error("Veritabanı güncelleme hatası:", updateError);
                alert("Profil güncelleme hatası: " + updateError.message);
                setKaydediliyor(false);
                return;
            }

            localStorage.setItem("profilFotograf", fotoUrl || "");
            localStorage.setItem("email", email);
            // Not: Kullanıcı adı inputu değişse bile, sadece şifre paneli açıksa şifre ile birlikte güncellenecek.
            // Burada kullanıcı adını local storage'a kaydetme mantığınız karmaşık, ama varsayılanı tutalım.
            localStorage.setItem("kullaniciAdi", kullaniciAdi);

            if (yeniSifre && kullaniciAdi === (rawKullanici || rawKullaniciAdi)) {
                // Şifre güncelleme (Supabase Auth yerine login tablosu kullanıldığı varsayılıyor)
                const { error: sifreGuncelleHatasi } = await supabase
                    .from("login")
                    .update({ sifre: yeniSifre })
                    .eq("kullaniciAdi", kullaniciAdi);

                if (sifreGuncelleHatasi) {
                    console.error("Şifre güncelleme hatası:", sifreGuncelleHatasi);
                    alert("Şifre güncelleme hatası: " + sifreGuncelleHatasi.message);
                    setKaydediliyor(false);
                    return;
                }
            }

            alert("Profil güncellendi.");
            setProfilModalAcik(false);
            setSelectedFile(null);
            // Sayfayı yeniden yükleyerek displayName'in güncellenmesini sağlamak gerekebilir,
            // veya displayName'i state'e alıp burada güncellemek daha temizdir.
            window.location.reload();
        } catch (err) {
            console.error("handleProfilKaydet hata:", err);
            alert("Hata: " + err.message);
        } finally {
            setKaydediliyor(false);
        }
    };

    // Modal ESC ile kapatma
    useEffect(() => {
        if (!profilModalAcik) return;
        const onKey = (e) => {
            if (e.key === "Escape") setProfilModalAcik(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [profilModalAcik]);

    return (
        <>
            {/* Toast: okunmamış görev bildirimi */}
            {bildirimGoster && (
                <div className="gorev-bildirimi" role="status" aria-live="polite">
                    <span className="gorev-bildirimi-ikon">📝</span>
                    <span>
                        Size atanmış <strong>{okunmamisGorevSayisi}</strong> yeni göreviniz var!
                    </span>
                </div>
            )}

            {/* NAVBAR */}
            <header className="navbar" role="banner">
                <div className="navbar-left">
                    <div className="brand">
                        <span className="brand-icon">🚀</span>
                        <span>BRAND</span>
                    </div>
                </div>

                <div className="navbar-right">
                    {/* Tema düğmesi */}
                    <button
                        className="icon-btn"
                        onClick={temaDegistir}
                        title={tema === "dark" ? "Açık tema" : "Koyu tema"}
                        aria-label="Tema değiştir"
                    >
                        {tema === "dark" ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5"></circle>
                                <line x1="12" y1="1" x2="12" y2="3"></line>
                                <line x1="12" y1="21" x2="12" y2="23"></line>
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                <line x1="1" y1="12" x2="3" y2="12"></line>
                                <line x1="21" y1="12" x2="23" y2="12"></line>
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                            </svg>
                        )}
                    </button>

                    {/* Bildirim */}
                    <div className="notif" aria-label="Bildirimler">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        {okunmamisGorevSayisi > 0 && (
                            <span className="notif-badge" aria-label="Okunmamış görev sayısı">
                                {okunmamisGorevSayisi}
                            </span>
                        )}
                    </div>

                    {isAdmin && (
                        <button
                            className="admin-btn"
                            onClick={() => navigate("/admin")}
                            aria-label="Yönetim Paneli"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L7 6v6c0 5 3.5 9 7 10 3.5-1 7-5 7-10V6l-5-4z"></path>
                                <polyline points="9 12 12 15 15 12"></polyline>
                            </svg>
                            <span className="admin-label">YÖNETİM</span>
                        </button>
                    )}

                    {/* Avatar + kullanıcı */}
                    <button
                        className="navbar-avatar"
                        onClick={() => setProfilModalAcik(true)}
                        title="Profil"
                        aria-haspopup="dialog"
                        aria-expanded={profilModalAcik}
                    >
                        {/* Hata durumunda fallback span görünür */}
                        <img
                            src={profilResim || "/profil.png"}
                            alt=""
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.nextElementSibling.style.display = "flex";
                            }}
                        />
                        <span className="avatar-fallback" aria-hidden="true" style={{ display: profilResim ? 'none' : 'flex' }}>
                            {avatarHarf}
                        </span>
                    </button>

                    <div className="navbar-id">
                        <span className="navbar-username" title={displayName}>
                            {displayName.toUpperCase()}
                        </span>
                        <span className="navbar-role" title={rol}>
                            {rol.toUpperCase()}
                        </span>
                    </div>

                    {/* Çıkış */}
                    <button className="logout-btn" onClick={cikisYap}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span>ÇIKIŞ</span>
                    </button>
                </div>
            </header>

            {/* İÇERİK KAYMASINI ENGELLEMEK İÇİN YER TUTUCU (Placeholder) */}
            <div className="navbar-placeholder" aria-hidden="true" />

            {/* PROFİL MODALI */}
            {profilModalAcik && (
                <div
                    className="modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Profil ayarları"
                    onMouseDown={(e) => {
                        if (e.target.classList.contains("modal-overlay")) {
                            setProfilModalAcik(false);
                        }
                    }}
                >
                    <div
                        className="modal-panel"
                        role="document"
                    >
                        <div className="modal-head">
                            <h2>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="feather feather-user">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                Profil
                            </h2>
                            <button
                                className="icon-btn"
                                aria-label="Kapat"
                                onClick={() => setProfilModalAcik(false)}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div className="profil-avatar-container">
                            <label htmlFor="profilResmiInput" className="avatar-label">
                                <div className="avatar-circle">
                                    {/* Profil Resmi önizlemesi */}
                                    {profilResim ? (
                                        <img src={profilResim} alt="Profil önizleme" />
                                    ) : (
                                        <span className="avatar-initial">{avatarHarf}</span>
                                    )}
                                    {/* Kamera ikonu */}
                                    <span className="avatar-camera" title="Fotoğraf yükle">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"></path>
                                            <circle cx="12" cy="13" r="4"></circle>
                                        </svg>
                                    </span>
                                </div>
                            </label>
                            <input
                                type="file"
                                id="profilResmiInput"
                                accept="image/*"
                                onChange={handleResimSec}
                                style={{ display: "none" }}
                            />
                        </div>

                        <div className="form-row">
                            <label>E-posta</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="mail@example.com"
                            />
                        </div>

                        <button
                            className="toggle-password-panel"
                            onClick={() => setSifrePanelAcik((prev) => !prev)}
                            aria-expanded={sifrePanelAcik}
                        >
                            {sifrePanelAcik ? (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="feather feather-eye-off">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.06 18.06 0 0 1 4.38-5.32"></path>
                                        <path d="M1 1l22 22"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                    Şifre Panelini Gizle
                                </>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="feather feather-lock">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                    Şifre Değiştir
                                </>
                            )}
                        </button>

                        <div className="password-panel">
                            <div className="form-row">
                                <label>Kullanıcı Adı</label>
                                <input
                                    type="text"
                                    value={kullaniciAdi}
                                    onChange={(e) => setKullaniciAdi(e.target.value)}
                                    placeholder="Kullanıcı adınızı girin"
                                />
                            </div>
                            <div className="form-row">
                                <label>Yeni Şifre</label>
                                <input
                                    type="password"
                                    value={yeniSifre}
                                    onChange={(e) => setYeniSifre(e.target.value)}
                                    placeholder="Yeni şifre"
                                />
                            </div>
                        </div>

                        <div className="modal-buttons">
                            <button onClick={() => setProfilModalAcik(false)} className="kapat-btn" disabled={kaydediliyor}>
                                Kapat
                            </button>
                            <button
                                onClick={handleProfilKaydet}
                                className="kaydet-btn"
                                disabled={kaydediliyor}
                            >
                                {kaydediliyor ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Navbar;
