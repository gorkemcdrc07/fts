import React, { useEffect, useState } from "react";
import "./Navbar.css";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

function Navbar() {
    const kullanici = localStorage.getItem("kullanici") || "Kullanıcı";
    const rol = localStorage.getItem("rol") || "Rol";
    const kullaniciIdRaw = localStorage.getItem("kullaniciId");
    const kullaniciId = kullaniciIdRaw ? Number(kullaniciIdRaw) : null;
    const navigate = useNavigate();

    const [tema, setTema] = useState(localStorage.getItem("tema") || "dark");
    const [profilModalAcik, setProfilModalAcik] = useState(false);
    // Profil resmi URL'si veya boş
    const [profilResim, setProfilResim] = useState(localStorage.getItem("profilFotograf") || null);

    // Yeni seçilen dosya (File objesi)
    const [selectedFile, setSelectedFile] = useState(null);

    const [email, setEmail] = useState("");
    const [sifrePanelAcik, setSifrePanelAcik] = useState(false);
    const [kullaniciAdi, setKullaniciAdi] = useState("");
    const [yeniSifre, setYeniSifre] = useState("");

    const [okunmamisGorevSayisi, setOkunmamisGorevSayisi] = useState(0);
    const [bildirimGoster, setBildirimGoster] = useState(false);

    const temaDegistir = () => {
        const yeniTema = tema === "dark" ? "light" : "dark";
        setTema(yeniTema);
        localStorage.setItem("tema", yeniTema);
    };

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", tema);
    }, [tema]);

    // Modal açıldığında e-posta ve kullanıcı adı bilgilerini set et
    useEffect(() => {
        if (profilModalAcik) {
            const storedEmail = localStorage.getItem("email") || "";
            const storedKullaniciAdi = localStorage.getItem("kullaniciAdi") || "";
            setEmail(storedEmail);
            setKullaniciAdi(storedKullaniciAdi);
        }
    }, [profilModalAcik]);

    // Görevleri kontrol eden fonksiyon
    const fetchOkunmamisGorevler = async () => {
        if (!kullaniciId) return;

        const { data, error } = await supabase
            .from("gorevler")
            .select("id")
            .eq("atananid", kullaniciId)
            .eq("okundu", false)
            .neq("durum", "Tamamlandı");

        if (!error) {
            setOkunmamisGorevSayisi(data.length);
            if (data.length > 0) {
                setBildirimGoster(true);
                setTimeout(() => setBildirimGoster(false), 5000);
            }
        }
    };

    useEffect(() => {
        fetchOkunmamisGorevler();
    }, [kullaniciId]);

    // Supabase Realtime bildirim kanalı
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
                () => {
                    fetchOkunmamisGorevler();
                }
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

    // Fotoğraf seçildiğinde File objesini al ve state'e kaydet
    const handleResimSec = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            // Önizleme için URL oluştur ve state'e kaydet
            const previewUrl = URL.createObjectURL(file);
            setProfilResim(previewUrl);
        }
    };

    // Profil kaydetme fonksiyonu
    const handleProfilKaydet = async () => {
        try {
            if (!kullaniciId) throw new Error("Kullanıcı oturumu bulunamadı.");

            let fotoUrl = profilResim; // Varsayılan olarak mevcut URL

            const path = `${kullaniciId}/profil.jpg`;

            if (selectedFile) {
                // Dosya varsa Storage'a yükle
                const { error: uploadError } = await supabase.storage
                    .from("profil-fotograflari")
                    .upload(path, selectedFile, { upsert: true });

                if (uploadError) {
                    console.error("Storage upload error:", uploadError);
                    alert("Fotoğraf yükleme hatası: " + uploadError.message);
                    return;
                }

                // Public URL al
                const { data: publicUrlData, error: publicUrlError } = supabase.storage
                    .from("profil-fotograflari")
                    .getPublicUrl(path);

                if (publicUrlError) {
                    console.error("Public URL alma hatası:", publicUrlError);
                    alert("Fotoğraf URL alınırken hata oluştu.");
                    return;
                }

                fotoUrl = publicUrlData.publicUrl;
            }

            // Veritabanını güncelle
            const { error: updateError } = await supabase
                .from("login")
                .update({ profil_fotograf: fotoUrl, email })
                .eq("id", kullaniciId);

            if (updateError) {
                console.error("Veritabanı güncelleme hatası:", updateError);
                alert("Profil güncelleme hatası: " + updateError.message);
                return;
            }

            localStorage.setItem("profilFotograf", fotoUrl);
            localStorage.setItem("email", email);
            localStorage.setItem("kullaniciAdi", kullaniciAdi);

            // Şifre değişikliği varsa
            if (yeniSifre && kullaniciAdi === kullanici) {
                const { error: sifreGuncelleHatasi } = await supabase
                    .from("login")
                    .update({ sifre: yeniSifre })
                    .eq("kullaniciAdi", kullaniciAdi);

                if (sifreGuncelleHatasi) {
                    console.error("Şifre güncelleme hatası:", sifreGuncelleHatasi);
                    alert("Şifre güncelleme hatası: " + sifreGuncelleHatasi.message);
                    return;
                }
            }

            alert("Profil güncellendi.");
            setProfilModalAcik(false);
            setSelectedFile(null);
        } catch (err) {
            console.error("handleProfilKaydet hata:", err);
            alert("Hata: " + err.message);
        }
    };

    return (
        <>
            {bildirimGoster && (
                <div className="gorev-bildirimi">
                    📝 Size atanmış {okunmamisGorevSayisi} yeni göreviniz var!
                </div>
            )}

            <div className="navbar">
                <div></div>
                <div className="navbar-user">
                    <div
                        className="navbar-avatar"
                        onClick={() => setProfilModalAcik(true)}
                        title="Profil"
                    >
                        <img
                            src={profilResim || "/profil.png"}
                            alt="Profil"
                            onError={(e) => (e.target.style.display = "none")}
                        />
                        <span className="avatar-fallback">{kullanici[0].toUpperCase()}</span>
                    </div>

                    <span className="navbar-username">{kullanici.toUpperCase()}</span>
                    <span className="navbar-separator">|</span>
                    <span className="navbar-role">{rol.toUpperCase()}</span>

                    <div className="theme-toggle" onClick={temaDegistir}>
                        <div className={`icon-wrapper ${tema}`}>
                            {tema === "dark" ? "🌙" : "🌞"}
                        </div>
                    </div>

                    <button className="logout-btn" onClick={cikisYap}>
                        ÇIKIŞ
                    </button>
                </div>
            </div>

            {profilModalAcik && (
                <div className="modal-overlay">
                    <div className="modal-panel">
                        <h2>👤 Profil</h2>

                        <div className="profil-avatar-container">
                            <label htmlFor="profilResmiInput" className="avatar-label">
                                <div className="avatar-circle">
                                    {profilResim ? (
                                        <img src={profilResim} alt="Profil" />
                                    ) : (
                                        <span className="avatar-initial">{kullanici[0].toUpperCase()}</span>
                                    )}
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

                        <div className="modal-email">
                            <label>E-posta:</label>
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
                        >
                            {sifrePanelAcik ? "Şifre Panelini Gizle" : "🔐 Şifre Değiştir"}
                        </button>

                        {sifrePanelAcik && (
                            <>
                                <div className="modal-email">
                                    <label>Kullanıcı Adı:</label>
                                    <input
                                        type="text"
                                        value={kullaniciAdi}
                                        onChange={(e) => setKullaniciAdi(e.target.value)}
                                        placeholder="Kullanıcı adınızı girin"
                                    />
                                </div>
                                <div className="modal-email">
                                    <label>Yeni Şifre:</label>
                                    <input
                                        type="password"
                                        value={yeniSifre}
                                        onChange={(e) => setYeniSifre(e.target.value)}
                                        placeholder="Yeni şifre"
                                    />
                                </div>
                            </>
                        )}

                        <div className="modal-buttons">
                            <button
                                onClick={() => setProfilModalAcik(false)}
                                className="kapat-btn"
                            >
                                Kapat
                            </button>
                            <button onClick={handleProfilKaydet} className="kaydet-btn">
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Navbar;
