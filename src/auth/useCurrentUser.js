// src/auth/useCurrentUser.js
import { useEffect, useState } from "react";

const norm = (s = "") => s.normalize("NFKC").trim();
const normRole = (s = "") =>
    s.normalize("NFKC").toLocaleUpperCase("tr-TR").replace(/\s+/g, "");

export default function useCurrentUser() {
    const read = () => {
        const giris = (() => {
            try { return JSON.parse(localStorage.getItem("girisYapanKullanici") || "null"); }
            catch { return null; }
        })();

        const kullaniciAdi = norm(localStorage.getItem("kullaniciAdi") || giris?.kullaniciAdi || "");
        const kullanici = norm(localStorage.getItem("kullanici") || giris?.kullanici || "");
        const rolRaw = localStorage.getItem("rol") || localStorage.getItem("roleKey") || giris?.rol || "";
        const rol = normRole(rolRaw);

        // Görünen ad için sağlam fallback zinciri
        const displayName = kullanici || kullaniciAdi || "Kullanıcı";

        return { kullaniciAdi, displayName, rol };
    };

    const [user, setUser] = useState(read);

    useEffect(() => {
        const onStorage = () => setUser(read());
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    return user; // { kullaniciAdi, displayName, rol }
}
