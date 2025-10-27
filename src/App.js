import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// MUI Tema
import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "./theme";

// Guard
import { default as RequirePageAccess } from "./routes/guards/RequirePageAccess"; // Güvenli import

// Sayfalar (eager)
// Tüm eager importlar güvenli named import formatına çevrildi:
import { default as Login } from "./Login";
import { default as Anasayfa } from "./Anasayfa";
import { default as Planlama } from "./kullanıcıIslemleri/Planlama";
import { default as PlakaOnerisi } from "./kullanıcıIslemleri/PlakaOnerisi";
import { default as Siparisler } from "./kullanıcıIslemleri/Siparisler";
import { default as TamamlananlarPage } from "./tamamlananseferler/TamamlananlarPage";

// Araç Durumları
import { default as AracYonetimi } from "./aracDurum/AracYonetimi";
import { default as IzinGirisi } from "./aracDurum/IzinGirisi";
import { default as KesintiGirisi } from "./aracDurum/KesintiGirisi";
import { default as AracDurumlari } from "./aracDurum/AracDurumlari";

// Görevler
import { default as GorevAta } from "./views/Gorevler/GorevAta";
import { default as BenimGorevlerim } from "./views/Gorevler/BenimGorevlerim"; // Düzeltildi: BenimGoreVlerim -> BenimGorevlerim
import { default as TumGorevler } from "./views/Gorevler/TumGorevler";

// Hakediş
import { default as TedarikciMasraf } from "./Hakedisler/TedarikciMasraf";
import { default as AracCariVeFiyat } from "./Hakedisler/AracCariVeFiyat";
import { default as HakedisSeferleri } from "./Hakedisler/HakedisSeferleri";
import { default as Hamaliye } from "./Hakedisler/Hamaliye";

// KPI & RAPORLAR
import { default as KpiOlcumu } from "./raporlar/kpiOlcumu";
import { default as YuklemedeBekleme } from "./raporlar/yuklemedeBekleme";
import { default as ProjeLokasyonRaporlari } from "./raporlar/ProjeLokasyonRaporlari";
import { default as TeslimdeBekleme } from "./raporlar/TeslimdeBekleme";

// Layout
import { default as AppLayout } from "./layout/AppLayout";

// Lazy sayfalar (lazy import'lar bu sorunu yaşamaz, bu yüzden değiştirilmedi)
const ReelAtananSeferler = lazy(() => import("./aktifseferler/ReelAtananSeferler"));
const SiparisAnaliz = lazy(() => import("./kullanıcıIslemleri/planlamaDetay/SiparisAnaliz"));
const AdminPanel = lazy(() => import("./adminPanel/adminPanel"));
const GorunumDuzenle = lazy(() => import("./aktifseferler/GorunumDuzenle"));
const PagePermissionsPage = lazy(() => import("./adminPanel/PagePermissionsPage"));
const PivotTool = lazy(() => import("./raporlar/PivotTool"));
// ETA Uyumsuzluğu
const ETAUyumsuzlugu = lazy(() => import("./raporlar/ETAUyumsuzlugu"));
// ✅ Frigo Yakıt Hakediş (Hakedişler menüsü altında)
const FrigoYakitHakedis = lazy(() => import("./Hakedisler/FrigoYakitHakedis"));

// TEST VERİSİ
const TEST_VERILERI = {
    "Sefer Performansı": [
        { Yıl: 2024, Ay: "Ocak", Bölge: "A", Tutar: 1500, KM: 500 },
        { Yıl: 2024, Ay: "Ocak", Bölge: "B", Tutar: 2000, KM: 650 },
        { Yıl: 2024, Ay: "Şubat", Bölge: "A", Tutar: 1800, KM: 550 },
        { Yıl: 2024, Ay: "Şubat", Bölge: "C", Tutar: 3000, KM: 700 },
        { Yıl: 2024, Ay: "Mart", Bölge: "B", Tutar: 2200, KM: 600 },
    ],
    "Personel Satışları": [
        { Personel: "Ahmet", Yıl: 2024, Satış: 12000 },
        { Personel: "Ayşe", Yıl: 2024, Satış: 15000 },
        { Personel: "Ahmet", Yıl: 2023, Satış: 9000 },
    ],
};

function App() {
    return (
        <HelmetProvider>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Router>
                    <Routes>
                        {/* Public: Login */}
                        <Route path="/" element={<Login />} />

                        {/* App Layout içinde tüm sayfalar */}
                        <Route element={<AppLayout />}>
                            {/* Whitelist (usePageAccess içinde serbest): /anasayfa */}
                            <Route path="anasayfa" element={<Anasayfa />} />

                            {/* <<< BURADAN SONRASI GUARD ALTINDA >>> */}
                            <Route
                                element={
                                    <RequirePageAccess>
                                        <Outlet />
                                    </RequirePageAccess>
                                }
                            >
                                {/* Planlama */}
                                <Route path="planlama" element={<Planlama />} />
                                <Route path="plaka-onerisi" element={<PlakaOnerisi />} />

                                {/* Reel Atanan Seferler (lazy) */}
                                <Route
                                    path="seferler"
                                    element={
                                        <Suspense fallback={<div style={{ padding: 24 }}>Yükleniyor...</div>}>
                                            <ReelAtananSeferler />
                                        </Suspense>
                                    }
                                />

                                {/* Görünüm Düzenle (lazy) */}
                                <Route
                                    path="aktifseferler/gorunum"
                                    element={
                                        <Suspense fallback={<div style={{ padding: 24 }}>Yükleniyor...</div>}>
                                            <GorunumDuzenle />
                                        </Suspense>
                                    }
                                />

                                <Route path="siparisler" element={<Siparisler />} />

                                {/* Tamamlanan Seferler */}
                                <Route path="tamamlanan-seferler" element={<TamamlananlarPage />} />

                                {/* Araç Durumları */}
                                <Route path="arac/durumlari" element={<AracDurumlari />} />
                                <Route path="arac/yonetim" element={<AracYonetimi />} />
                                <Route path="arac/izin-girisi" element={<IzinGirisi />} />
                                <Route path="arac/kesinti-girisi" element={<KesintiGirisi />} />

                                {/* Görevler */}
                                <Route path="gorevler/ata" element={<GorevAta />} />
                                <Route path="gorevler/benim" element={<BenimGorevlerim />} />
                                <Route path="gorevler/tum" element={<TumGorevler />} />

                                {/* Hakediş */}
                                <Route path="hakedis/tedarikci-masraf" element={<TedarikciMasraf />} />
                                <Route path="hakedis/arac-cari-ve-fiyat" element={<AracCariVeFiyat />} />
                                <Route path="hakedis/hakedis-seferleri" element={<HakedisSeferleri />} />
                                <Route path="hakedis/hamaliye" element={<Hamaliye />} />
                                {/* ✅ Frigo Yakıt Hakediş */}
                                <Route
                                    path="hakedis/frigo-yakit-hakedis"
                                    element={
                                        <Suspense fallback={<div style={{ padding: 24 }}>Frigo Yakıt Hakediş yükleniyor...</div>}>
                                            <FrigoYakitHakedis />
                                        </Suspense>
                                    }
                                />

                                {/* KPI & Raporlar */}
                                <Route path="raporlar/kpi-olcumu" element={<KpiOlcumu />} />
                                <Route path="raporlar/yuklemede-bekleme" element={<YuklemedeBekleme />} />
                                <Route path="raporlar/teslimde-bekleme" element={<TeslimdeBekleme />} />
                                <Route path="raporlar/lokasyon-rapor" element={<ProjeLokasyonRaporlari />} />

                                {/* ETA Uyumsuzluğu */}
                                <Route
                                    path="raporlar/eta-uyumsuz"
                                    element={
                                        <Suspense fallback={<div style={{ padding: 24 }}>ETA Uyumsuzluğu Raporu Yükleniyor...</div>}>
                                            <ETAUyumsuzlugu />
                                        </Suspense>
                                    }
                                />

                                {/* Pivot Tool */}
                                <Route
                                    path="raporlar/tools"
                                    element={
                                        <Suspense fallback={<div style={{ padding: 24 }}>Pivot Rapor Yükleniyor...</div>}>
                                            <PivotTool datasets={TEST_VERILERI} defaultDataset="Sefer Performansı" />
                                        </Suspense>
                                    }
                                />

                                {/* KOCAELİ kartı */}
                                <Route
                                    path="siparis-analiz"
                                    element={
                                        <Suspense fallback={<div style={{ padding: 24 }}>Yükleniyor...</div>}>
                                            <SiparisAnaliz />
                                        </Suspense>
                                    }
                                />

                                {/* Admin */}
                                <Route
                                    path="admin"
                                    element={
                                        <Suspense fallback={<div style={{ padding: 24 }}>Yükleniyor...</div>}>
                                            <AdminPanel />
                                        </Suspense>
                                    }
                                />
                                {/* Kullanıcı Ekranları (izin yönetimi) */}
                                <Route
                                    path="admin/permissions"
                                    element={
                                        <Suspense fallback={<div style={{ padding: 24 }}>Yükleniyor...</div>}>
                                            <PagePermissionsPage />
                                        </Suspense>
                                    }
                                />
                            </Route>
                            {/* <<< GUARD BLOĞU BİTTİ >>> */}

                            {/* Varsayılan */}
                            <Route path="*" element={<Navigate to="/anasayfa" replace />} />
                        </Route>
                    </Routes>
                </Router>
            </ThemeProvider>
        </HelmetProvider>
    );
}

export default App;
