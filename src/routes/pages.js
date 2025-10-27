// src/routes/pages.js
// Ekran başlıkları ve Router ile birebir uyumlu path listesi

export const APP_PAGES = [
    { title: "Ana Sayfa", path: "/anasayfa" },

    // Planlama
    { title: "Planlama", path: "/planlama" },
    { title: "Plaka Önerisi", path: "/plaka-onerisi" },
    { title: "Siparişler", path: "/siparisler" },
    { title: "Sipariş Analiz", path: "/siparis-analiz" },

    // Aktif seferler
    { title: "Aktif Seferler", path: "/seferler" },
    { title: "Görünüm Düzenle", path: "/aktifseferler/gorunum" },

    // Tamamlanan seferler
    { title: "Tamamlanan Seferler", path: "/tamamlanan-seferler" },

    // Araç durumları
    { title: "Araç Durumları", path: "/arac/durumlari" },
    { title: "Araç Yönetimi", path: "/arac/yonetim" },
    { title: "İzin Girişi", path: "/arac/izin-girisi" },
    { title: "Kesinti Girişi", path: "/arac/kesinti-girisi" },

    // Görevler
    { title: "Görev Atama", path: "/gorevler/ata" },
    { title: "Görevlerim", path: "/gorevler/benim" },
    { title: "Tüm Görevler", path: "/gorevler/tum" },

    // Hakediş
    { title: "Tedarikçi Masraf", path: "/hakedis/tedarikci-masraf" },
    { title: "Araç Cari & Fiyat", path: "/hakedis/arac-cari-ve-fiyat" },
    { title: "Hakediş Seferleri", path: "/hakedis/hakedis-seferleri" },
    { title: "Hamaliye", path: "/hakedis/hamaliye" },
    { title: "Frigo Yakıt Hakediş", path: "/hakedis/frigo-yakit-hakedis" },

    // KPI & Raporlar
    { title: "KPI Ölçümü", path: "/raporlar/kpi-olcumu" },
    { title: "Yüklemede Bekleme", path: "/raporlar/yuklemede-bekleme" },
    { title: "Teslimde Bekleme", path: "/raporlar/teslimde-bekleme" }, // ✅ YENİ EKRAN EKLENDİ
    { title: "Lokasyon Raporları", path: "/raporlar/lokasyon-rapor" },
    { title: "ETA Uyumsuzluğu", path: "/raporlar/eta-uyumsuzlugu" },

    // Yönetim
    { title: "Yönetim Paneli", path: "/admin" },
    { title: "Kullanıcı Ekranları", path: "/admin/permissions" },
];

// Sadece adminlerin erişeceği path’ler (guard içinde istersen kullan)
export const ADMIN_ONLY_PATHS = new Set([
    "/admin",
    "/admin/permissions",
]);

export default APP_PAGES;
