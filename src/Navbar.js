import React, { useEffect, useState } from "react";
import "./Navbar.css";
import { useNavigate } from "react-router-dom";

function Navbar() {
    const kullanici = localStorage.getItem("kullanici");
    const rol = localStorage.getItem("rol");
    const navigate = useNavigate();

    const [tema, setTema] = useState(localStorage.getItem("tema") || "dark");

    const cikisYap = () => {
        localStorage.clear();
        navigate("/");
    };

    const temaDegistir = () => {
        const yeniTema = tema === "dark" ? "light" : "dark";
        setTema(yeniTema);
        localStorage.setItem("tema", yeniTema);
    };

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", tema);
    }, [tema]);

    return (
        <div className="navbar">
            {/* Sol boşluk (isteğe bağlı) */}
            <div></div>

            {/* Kullanıcı bilgi alanı */}
            <div className="navbar-user">
                <span className="navbar-username">{kullanici?.toUpperCase()}</span>
                <span className="navbar-separator">|</span>
                <span className="navbar-role">{rol?.toUpperCase()}</span>

                {/* Tema butonu */}
                <div className="theme-toggle" onClick={temaDegistir}>
                    <div className={`icon-wrapper ${tema}`}>
                        {tema === "dark" ? "🌙" : "🌞"}
                    </div>
                </div>

                {/* Çıkış */}
                <button className="logout-btn" onClick={cikisYap}>
                    🚪 Çıkış
                </button>
            </div>
        </div>
    );
}

export default Navbar;
