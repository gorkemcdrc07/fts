import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Navbar.css";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

function Navbar() {
    const rawKullanici = (localStorage.getItem("kullanici") || "").trim();
    const rawKullaniciAdi = (localStorage.getItem("kullaniciAdi") || "").trim();
    const displayName = rawKullanici || rawKullaniciAdi || "Kullanıcı";
    const rol = (localStorage.getItem("rol") || "Rol").toString();

    const usernameForAdminCheck = (rawKullaniciAdi || rawKullanici).toLowerCase();
    const isAdmin = usernameForAdminCheck === "admin" || usernameForAdminCheck === "yagiz";

    const kullaniciIdRaw = localStorage.getItem("kullaniciId");
    const kullaniciId = kullaniciIdRaw ? Number(kullaniciIdRaw) : null;

    const navigate = useNavigate();

    const [tema, setTema] = useState(localStorage.getItem("tema") || "dark");
    const [profilModalAcik, setProfilModalAcik] = useState(false);
    const [profilResim, setProfilResim] = useState(localStorage.getItem("profilFotograf") || null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [email, setEmail] = useState("");
    const [sifrePanelAcik, setSifrePanelAcik] = useState(false);
    const [kullaniciAdi, setKullaniciAdi] = useState("");
    const [yeniSifre, setYeniSifre] = useState("");
    const [okunmamisSayisi, setOkunmamisSayisi] = useState(0);
    const [bildirimGoster, setBildirimGoster] = useState(false);
    const [kaydediliyor, setKaydediliyor] = useState(false);
    const [userMenuAcik, setUserMenuAcik] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", tema);
    }, [tema]);

    const temaDegistir = () => {
        const t = tema === "dark" ? "light" : "dark";
        setTema(t);
        localStorage.setItem("tema", t);
    };

    useEffect(() => {
        if (profilModalAcik) {
            setEmail(localStorage.getItem("email") || "");
            setKullaniciAdi(rawKullaniciAdi || rawKullanici || "");
        }
    }, [profilModalAcik, rawKullanici, rawKullaniciAdi]);

    const fetchGorevler = async () => {
        if (!kullaniciId) return;
        const { data, error } = await supabase
            .from("gorevler")
            .select("id")
            .eq("atananid", kullaniciId)
            .eq("okundu", false)
            .neq("durum", "Tamamlandı");
        if (!error && data) {
            const sayi = data.length;
            setOkunmamisSayisi(sayi);
            if (sayi > 0) { setBildirimGoster(true); setTimeout(() => setBildirimGoster(false), 5000); }
        }
    };

    useEffect(() => { fetchGorevler(); }, [kullaniciId]);

    useEffect(() => {
        if (!kullaniciId) return;
        const kanal = supabase.channel("gorev-kanal")
            .on("postgres_changes", { event: "*", schema: "public", table: "gorevler", filter: `atananid=eq.${kullaniciId}` }, fetchGorevler)
            .subscribe();
        return () => supabase.removeChannel(kanal);
    }, [kullaniciId]);

    const cikisYap = () => { localStorage.clear(); navigate("/"); };

    const prevUrlRef = useRef(null);
    const handleResimSec = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        const url = URL.createObjectURL(file);
        prevUrlRef.current = url;
        setProfilResim(url);
    };
    useEffect(() => () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); }, []);

    const avatarHarf = useMemo(() => (displayName?.trim()?.[0] || "K").toUpperCase(), [displayName]);

    const handleProfilKaydet = async () => {
        try {
            if (!kullaniciId) throw new Error("Kullanıcı oturumu bulunamadı.");
            setKaydediliyor(true);
            let fotoUrl = profilResim;
            const path = `${kullaniciId}/profil.jpg`;

            if (selectedFile) {
                const { error: upErr } = await supabase.storage.from("profil-fotograflari").upload(path, selectedFile, { upsert: true });
                if (upErr) { alert("Fotoğraf yükleme hatası: " + upErr.message); return; }
                const { data: pub } = supabase.storage.from("profil-fotograflari").getPublicUrl(path);
                fotoUrl = pub.publicUrl;
            }

            const { error: upd } = await supabase.from("login").update({ profil_fotograf: fotoUrl, email }).eq("id", kullaniciId);
            if (upd) { alert("Güncelleme hatası: " + upd.message); return; }

            localStorage.setItem("profilFotograf", fotoUrl || "");
            localStorage.setItem("email", email);
            localStorage.setItem("kullaniciAdi", kullaniciAdi);

            if (yeniSifre) {
                const { error: sErr } = await supabase.from("login").update({ sifre: yeniSifre }).eq("kullaniciAdi", kullaniciAdi);
                if (sErr) { alert("Şifre hatası: " + sErr.message); return; }
            }

            setProfilModalAcik(false);
            setSelectedFile(null);
            window.location.reload();
        } catch (err) {
            alert("Hata: " + err.message);
        } finally {
            setKaydediliyor(false);
        }
    };

    useEffect(() => {
        if (!profilModalAcik) return;
        const onKey = (e) => { if (e.key === "Escape") setProfilModalAcik(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [profilModalAcik]);

    // Dışarı tıkla — user menu kapat
    useEffect(() => {
        if (!userMenuAcik) return;
        const onDoc = (e) => { if (!e.target.closest(".navbar-user-area")) setUserMenuAcik(false); };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [userMenuAcik]);

    return (
        <>
            {/* ── Toast Bildirimi ── */}
            <div className={`toast-bildirim ${bildirimGoster ? "toast-bildirim--show" : ""}`} role="status">
                <div className="toast-bildirim__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                </div>
                <div className="toast-bildirim__body">
                    <span className="toast-bildirim__title">Yeni Görev</span>
                    <span className="toast-bildirim__text"><strong>{okunmamisSayisi}</strong> okunmamış göreviniz var.</span>
                </div>
                <button className="toast-bildirim__close" onClick={() => setBildirimGoster(false)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
            </div>

            {/* ── NAVBAR ── */}
            <header className="navbar" role="banner">

                {/* Sol: Logo */}
                <div className="navbar-left">
                    <div className="navbar-brand">
                        <div className="navbar-brand__icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h4l3 5v3h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                            </svg>
                        </div>
                        <span className="navbar-brand__text">FTSWeb</span>
                        <span className="navbar-brand__version">v1.3</span>
                    </div>
                </div>

                {/* Sağ: Aksiyonlar */}
                <div className="navbar-right">

                    {/* Tema Butonu */}
                    <button className="nb-icon-btn" onClick={temaDegistir} title={tema === "dark" ? "Açık tema" : "Koyu tema"} aria-label="Tema değiştir">
                        {tema === "dark" ? (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>

                    {/* Bildirim Butonu */}
                    <button className="nb-icon-btn nb-notif" onClick={() => navigate("/gorevler/benim")} aria-label="Bildirimler">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        {okunmamisSayisi > 0 && (
                            <span className="nb-badge">{okunmamisSayisi > 99 ? "99+" : okunmamisSayisi}</span>
                        )}
                    </button>

                    {/* Admin Butonu */}
                    {isAdmin && (
                        <button className="nb-admin-btn" onClick={() => navigate("/admin")} aria-label="Yönetim Paneli">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L7 6v6c0 5 3.5 9 7 10 3.5-1 7-5 7-10V6l-5-4z" />
                            </svg>
                            <span>Yönetim</span>
                        </button>
                    )}

                    <div className="nb-divider" />

                    {/* Kullanıcı Alanı */}
                    <div className="navbar-user-area" onClick={() => setUserMenuAcik(p => !p)}>
                        <div className="nb-avatar">
                            {profilResim ? (
                                <img src={profilResim} alt="" onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling.style.display = "flex"; }} />
                            ) : null}
                            <span className="nb-avatar__fallback" style={{ display: profilResim ? "none" : "flex" }}>{avatarHarf}</span>
                            <span className="nb-avatar__status" />
                        </div>

                        <div className="nb-user-info">
                            <span className="nb-user-info__name">{displayName.toUpperCase()}</span>
                            <span className="nb-user-info__role">{rol}</span>
                        </div>

                        <svg className={`nb-chevron ${userMenuAcik ? "nb-chevron--open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>

                        {/* Dropdown Menü */}
                        <div className={`nb-dropdown ${userMenuAcik ? "nb-dropdown--open" : ""}`} onClick={e => e.stopPropagation()}>
                            <div className="nb-dropdown__header">
                                <div className="nb-dropdown__avatar">
                                    {profilResim
                                        ? <img src={profilResim} alt="" />
                                        : <span>{avatarHarf}</span>}
                                </div>
                                <div>
                                    <p className="nb-dropdown__name">{displayName}</p>
                                    <p className="nb-dropdown__role">{rol}</p>
                                </div>
                            </div>
                            <div className="nb-dropdown__divider" />
                            <button className="nb-dropdown__item" onClick={() => { setUserMenuAcik(false); setProfilModalAcik(true); }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                Profil Ayarları
                            </button>
                            <button className="nb-dropdown__item" onClick={() => { setUserMenuAcik(false); navigate("/gorevler/benim"); }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                                Görevlerim
                                {okunmamisSayisi > 0 && <span className="nb-dropdown__badge">{okunmamisSayisi}</span>}
                            </button>
                            <div className="nb-dropdown__divider" />
                            <button className="nb-dropdown__item nb-dropdown__item--danger" onClick={cikisYap}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                Çıkış Yap
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="navbar-spacer" aria-hidden="true" />

            {/* ── PROFİL MODALI ── */}
            {profilModalAcik && (
                <div className="modal-overlay" role="dialog" aria-modal="true"
                    onMouseDown={e => { if (e.target.classList.contains("modal-overlay")) setProfilModalAcik(false); }}>
                    <div className="modal-panel">

                        {/* Modal Başlık */}
                        <div className="modal-head">
                            <div className="modal-head__left">
                                <div className="modal-head__icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                </div>
                                <div>
                                    <h2 className="modal-head__title">Profil Ayarları</h2>
                                    <p className="modal-head__sub">Hesap bilgilerinizi güncelleyin</p>
                                </div>
                            </div>
                            <button className="modal-close-btn" onClick={() => setProfilModalAcik(false)} aria-label="Kapat">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        {/* Avatar */}
                        <div className="modal-avatar-wrap">
                            <label htmlFor="profilResmiInput" className="modal-avatar-label">
                                <div className="modal-avatar-circle">
                                    {profilResim
                                        ? <img src={profilResim} alt="Profil önizleme" />
                                        : <span className="modal-avatar-harf">{avatarHarf}</span>}
                                    <div className="modal-avatar-overlay">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                        <span>Fotoğraf Değiştir</span>
                                    </div>
                                </div>
                            </label>
                            <input type="file" id="profilResmiInput" accept="image/*" onChange={handleResimSec} style={{ display: "none" }} />
                            <div className="modal-user-tag">
                                <span className="modal-user-tag__name">{displayName}</span>
                                <span className="modal-user-tag__role">{rol}</span>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="modal-form">
                            <div className="modal-field">
                                <label className="modal-field__label">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                    E-posta Adresi
                                </label>
                                <input className="modal-field__input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mail@example.com" />
                            </div>

                            {/* Şifre Toggle */}
                            <button className="modal-password-toggle" onClick={() => setSifrePanelAcik(p => !p)} aria-expanded={sifrePanelAcik}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                {sifrePanelAcik ? "Şifre Panelini Gizle" : "Şifre Değiştir"}
                                <svg className={`modal-password-toggle__arrow ${sifrePanelAcik ? "modal-password-toggle__arrow--open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                            </button>

                            <div className={`modal-password-panel ${sifrePanelAcik ? "modal-password-panel--open" : ""}`}>
                                <div className="modal-field">
                                    <label className="modal-field__label">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                        Kullanıcı Adı
                                    </label>
                                    <input className="modal-field__input" type="text" value={kullaniciAdi} onChange={e => setKullaniciAdi(e.target.value)} placeholder="Kullanıcı adı" />
                                </div>
                                <div className="modal-field">
                                    <label className="modal-field__label">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                        Yeni Şifre
                                    </label>
                                    <input className="modal-field__input" type="password" value={yeniSifre} onChange={e => setYeniSifre(e.target.value)} placeholder="••••••••" />
                                </div>
                            </div>
                        </div>

                        {/* Butonlar */}
                        <div className="modal-footer">
                            <button className="modal-footer__cancel" onClick={() => setProfilModalAcik(false)} disabled={kaydediliyor}>İptal</button>
                            <button className="modal-footer__save" onClick={handleProfilKaydet} disabled={kaydediliyor}>
                                {kaydediliyor ? (
                                    <>
                                        <span className="modal-footer__spinner" />
                                        Kaydediliyor...
                                    </>
                                ) : (
                                    <>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                                        Kaydet
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Navbar;
