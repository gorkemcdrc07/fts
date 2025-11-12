import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// MUI Tema
import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "./theme";

// Guard
import { default as RequirePageAccess } from "./routes/guards/RequirePageAccess";

// Sayfalar (eager)
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
import { default as BenimGorevlerim } from "./views/Gorevler/BenimGorevlerim";
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

// Lazy sayfalar
const ReelAtananSeferler = lazy(() => import("./aktifseferler/ReelAtananSeferler"));
const SiparisAnaliz = lazy(() => import("./kullanıcıIslemleri/planlamaDetay/SiparisAnaliz"));
const AdminPanel = lazy(() => import("./adminPanel/adminPanel"));
const GorunumDuzenle = lazy(() => import("./aktifseferler/GorunumDuzenle"));
const PagePermissionsPage = lazy(() => import("./adminPanel/PagePermissionsPage"));
const PivotTool = lazy(() => import("./raporlar/PivotTool"));
const ETAUyumsuzlugu = lazy(() => import("./raporlar/ETAUyumsuzlugu"));
const FrigoYakitHakedis = lazy(() => import("./Hakedisler/FrigoYakitHakedis"));

// Yeni: Sefer Tamamlayan Raporu
const SeferTamamlayan = lazy(() => import("./raporlar/SeferTamamlayan"));

// Yeni: Bölgesel Analiz Raporu
const BolgeselAnaliz = lazy(() => import("./raporlar/BolgeselAnaliz"));

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
                        {/* Public */}
                        <Route path="/" element={<Login />} />

                        {/* App Layout */}
                        <Route element={<AppLayout />}>
                            <Route path="anasayfa" element={<Anasayfa />} />

                            {/* Guard */}
                            <Route element={<RequirePageAccess><Outlet /></RequirePageAccess>}>
                                <Route path="planlama" element={<Planlama />} />
                                <Route path="plaka-onerisi" element={<PlakaOnerisi />} />
                                <Route path="seferler" element={<Suspense fallback={<div>Yükleniyor...</div>}><ReelAtananSeferler /></Suspense>} />
                                <Route path="aktifseferler/gorunum" element={<Suspense fallback={<div>Yükleniyor...</div>}><GorunumDuzenle /></Suspense>} />
                                <Route path="siparisler" element={<Siparisler />} />
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
                                <Route path="hakedis/frigo-yakit-hakedis" element={<Suspense fallback={<div>Frigo Yakıt Hakediş yükleniyor...</div>}><FrigoYakitHakedis /></Suspense>} />
                                <Route path="hakedis/tedarikci-masraf" element={<TedarikciMasraf />} />
                                <Route path="hakedis/arac-cari-ve-fiyat" element={<AracCariVeFiyat />} />
                                <Route path="hakedis/hakedis-seferleri" element={<HakedisSeferleri />} />
                                <Route path="hakedis/hamaliye" element={<Hamaliye />} />

                                {/* KPI & Raporlar */}
                                <Route path="raporlar/kpi-olcumu" element={<KpiOlcumu />} />
                                <Route path="raporlar/yuklemede-bekleme" element={<YuklemedeBekleme />} />
                                <Route path="raporlar/teslimde-bekleme" element={<TeslimdeBekleme />} />
                                <Route path="raporlar/lokasyon-rapor" element={<ProjeLokasyonRaporlari />} />
                                <Route path="raporlar/eta-uyumsuz" element={<Suspense fallback={<div>ETA Uyumsuzluğu yükleniyor...</div>}><ETAUyumsuzlugu /></Suspense>} />
                                <Route path="raporlar/tools" element={<Suspense fallback={<div>Pivot Rapor Yükleniyor...</div>}><PivotTool datasets={TEST_VERILERI} defaultDataset="Sefer Performansı" /></Suspense>} />
                                <Route path="raporlar/sefer-tamamlayan" element={<Suspense fallback={<div>Sefer Tamamlayan yükleniyor...</div>}><SeferTamamlayan /></Suspense>} />
                                <Route path="raporlar/bolgesel-analiz" element={<Suspense fallback={<div>Bölgesel Analiz yükleniyor...</div>}><BolgeselAnaliz /></Suspense>} />

                                {/* KOCAELİ kartı */}
                                <Route path="siparis-analiz" element={<Suspense fallback={<div>Yükleniyor...</div>}><SiparisAnaliz /></Suspense>} />

                                {/* Admin */}
                                <Route path="admin" element={<Suspense fallback={<div>Yükleniyor...</div>}><AdminPanel /></Suspense>} />
                                <Route path="admin/permissions" element={<Suspense fallback={<div>Yükleniyor...</div>}><PagePermissionsPage /></Suspense>} />
                            </Route>

                            {/* Default */}
                            <Route path="*" element={<Navigate to="/anasayfa" replace />} />
                        </Route>
                    </Routes>
                </Router>
            </ThemeProvider>
        </HelmetProvider>
    );
}

export default App;
