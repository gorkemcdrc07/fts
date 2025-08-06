import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import './Login.css';
import bg from './images/login.png'; // Arka plan görseli

function Login() {
    const [kullaniciAdi, setKullaniciAdi] = useState('');
    const [sifre, setSifre] = useState('');
    const [hata, setHata] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setHata('');

        const { data, error } = await supabase
            .from('login')
            .select('*')
            .eq('kullaniciAdi', kullaniciAdi)
            .eq('sifre', sifre)
            .single();

        if (error || !data) {
            setHata('Kullanıcı adı veya şifre hatalı.');
        } else {
            localStorage.setItem('kullaniciAdi', data.kullaniciAdi);
            localStorage.setItem('kullanici', data.kullanici);
            localStorage.setItem('rol', data.rol);
            localStorage.setItem('kullaniciId', data.id); // 🔥 GÖRÜNÜM İÇİN GEREKLİ
            localStorage.setItem('girisYapanKullanici', JSON.stringify(data)); // (İsteğe bağlı)
            localStorage.setItem("profilFotograf", data.profil_fotograf || ""); // BURAYA EKLEDİK

            navigate('/anasayfa');
        }

    };

    return (
        <div
            className="login-bg"
            style={{
                backgroundImage: `url(${bg})`,
            }}
        >
            <div className="login-panel">
                <h2>Giriş Yap</h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Kullanıcı Adı"
                        value={kullaniciAdi}
                        onChange={(e) => setKullaniciAdi(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Şifre"
                        value={sifre}
                        onChange={(e) => setSifre(e.target.value)}
                        required
                    />
                    {hata && <p style={{ color: 'red', fontSize: '13px' }}>{hata}</p>}
                    <button type="submit">Giriş</button>
                </form>
            </div>
        </div>
    );
}

export default Login;
