import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Navbar.css";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

function Navbar() {
    // LS okumaları
    const kullanici = localStorage.getItem("kullanici") || "Kullanıcı";
    const rol = localStorage.getItem("rol") || "Rol";
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
            setKullaniciAdi(localStorage.getItem("kullaniciAdi") || "");
        }
    }, [profilModalAcik]);

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

        // önceki blob URL'yi serbest bırak
        if (prevObjectUrlRef.current) {
            URL.revokeObjectURL(prevObjectUrlRef.current);
            prevObjectUrlRef.current = null;
        }
        const previewUrl = URL.createObjectURL(file);
        prevObjectUrlRef.current = previewUrl;
        setProfilResim(previewUrl);
    };

    // component unmount olduğunda olası blob URL sızıntısını temizle
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
        () => (kullanici?.trim()?.[0] || "K").toUpperCase(),
        [kullanici]
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
            localStorage.setItem("kullaniciAdi", kullaniciAdi);

            if (yeniSifre && kullaniciAdi === kullanici) {
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
                        Size atanmış <strong>{okunmamisGorevSayisi}</strong> yeni göreviniz
                        var!
                    </span>
                </div>
            )}

            {/* NAVBAR */}
            <header className="navbar" role="banner">
                <div className="navbar-left">
                    {/* Yer tutucu veya marka */}
                    <div className="brand">
                        <span className="brand-dot" />
                        <span className="brand-text">Görev Paneli</span>
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
                            /* Sun icon */
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                    d="M12 4V2M12 22v-2M4.93 4.93 3.51 3.51M20.49 20.49l-1.42-1.42M4 12H2m20 0h-2M4.93 19.07l-1.42 1.42M20.49 3.51l-1.42 1.42M12 8a4 4 0 100 8 4 4 0 000-8z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        ) : (
                            /* Moon icon */
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                    d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                    </button>

                    {/* Bildirim ikonu + sayı */}
                    <div className="notif" aria-label="Bildirimler">
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        {okunmamisGorevSayisi > 0 && (
                            <span className="notif-badge" aria-label="Okunmamış görev sayısı">
                                {okunmamisGorevSayisi}
                            </span>
                        )}
                    </div>

                    {/* Avatar + kullanıcı */}
                    <button
                        className="navbar-avatar"
                        onClick={() => setProfilModalAcik(true)}
                        title="Profil"
                        aria-haspopup="dialog"
                        aria-expanded={profilModalAcik}
                    >
                        <img
                            src={profilResim || "/profil.png"}
                            alt=""
                            onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                        <span className="avatar-fallback" aria-hidden="true">
                            {avatarHarf}
                        </span>
                    </button>

                    <div className="navbar-id">
                        <span className="navbar-username" title={kullanici}>
                            {kullanici.toUpperCase()}
                        </span>
                        <span className="navbar-role" title={rol}>
                            {rol.toUpperCase()}
                        </span>
                    </div>

                    {/* Çıkış */}
                    <button className="logout-btn" onClick={cikisYap}>
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span>ÇIKIŞ</span>
                    </button>
                </div>
            </header>

            {/* PROFİL MODALI */}
            {profilModalAcik && (
                <div
                    className="modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Profil ayarları"
                    onMouseDown={(e) => {
                        // panel dışına tıklayınca kapat
                        if (e.target.classList.contains("modal-overlay")) {
                            setProfilModalAcik(false);
                        }
                    }}
                >
                    <div className="modal-panel" role="document">
                        <div className="modal-head">
                            <h2>👤 Profil</h2>
                            <button
                                className="icon-btn"
                                aria-label="Kapat"
                                onClick={() => setProfilModalAcik(false)}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                        d="M18 6L6 18M6 6l12 12"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>

                        <div className="profil-avatar-container">
                            <label htmlFor="profilResmiInput" className="avatar-label">
                                <div className="avatar-circle">
                                    {profilResim ? (
                                        <img src={profilResim} alt="Profil önizleme" />
                                    ) : (
                                        <span className="avatar-initial">{avatarHarf}</span>
                                    )}
                                    <span className="avatar-camera" title="Fotoğraf yükle">
                                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                            <path
                                                d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2v11zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                fill="none"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
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
                            {sifrePanelAcik ? "Şifre Panelini Gizle" : "🔐 Şifre Değiştir"}
                        </button>

                        {sifrePanelAcik && (
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
                        )}

                        <div className="modal-buttons">
                            <button onClick={() => setProfilModalAcik(false)} className="kapat-btn">
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
