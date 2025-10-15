// src/routes/pages.js
// Uygulamadaki sayfa başlıklarını ve URL path'lerini burada tanımlıyoruz.
// Path'ler Türkçe karakterleri "slug" yapacak şekilde normalize ediliyor.

const trMap = { ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", I: "i", İ: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u", "&": " ve " };
function toSlug(s) {
    return String(s || "")
        .replace(/[çÇğĞıİöÖşŞüÜ&]/g, (m) => trMap[m] ?? m)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")       // aksan temizliği
        .replace(/[^a-z0-9\s-]/g, " ")         // harf-rakam dışını boşluk yap
        .replace(/\s+/g, "-")                  // boşlukları -
        .replace(/-+/g, "-")                   // fazla - temizle
        .replace(/^-|-$/g, "");                // baş/son - temizle
}

const TITLES = [
    "Ana Sayfa",
    "Planlama",
    "Plaka Önerisi",
    "Aktif Seferler",
    "Tamamlanan Seferler",
    "Araç Durumları",
    "Araç Yönetimi",
    "İzin Girişi",
    "Kesinti Girişi",
    "Görev Atama",
    "Görevlerim",
    "Tüm Görevler",
    "Tedarikçi Masraf",
    "Araç Cari & Fiyat",
    "Hakediş Seferleri",
    "Hamaliye",
    "KPI Ölçümü",
    "Yüklemede Bekleme",
    "Lokasyon Raporları",
    "Yönetim Paneli",
];

// NOT: "Ana Sayfa" için path'i istersen "/" yapabilirsin.
// Aşağıda varsayılan olarak "/ana-sayfa" veriyorum; landing'in "/" ise onu "/" yap.
export const APP_PAGES = TITLES.map((title) => ({
    title,
    path: `/${toSlug(title)}`,
}));

// İstersen "Ana Sayfa"yı "/" yap:
const idxHome = APP_PAGES.findIndex((p) => p.title === "Ana Sayfa");
if (idxHome >= 0) APP_PAGES[idxHome].path = "/";

// İstersen "Yönetim Paneli" sadece adminlere açılsın diye ayrı bir bayrak koy:
export const ADMIN_ONLY_PATHS = new Set([
    "/yonetim-paneli",
]);

export default APP_PAGES;
