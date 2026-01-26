// src/App.js (veya App.jsx - sende hangisiyse aynı dosya)
// ✅ KM Kayıt route'u eklendi + lazy import eklendi
import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// MUI Tema
import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "./theme";

// Guard
import RequirePageAccess from "./routes/guards/RequirePageAccess";

// Sayfalar (eager)
import Login from "./Login";
import Anasayfa from "./Anasayfa";
import Planlama from "./kullanıcıIslemleri/Planlama";
import PlakaOnerisi from "./kullanıcıIslemleri/PlakaOnerisi";
import Siparisler from "./kullanıcıIslemleri/Siparisler";
import TamamlananlarPage from "./tamamlananseferler/TamamlananlarPage";

// Araç Durumları
import AracYonetimi from "./aracDurum/AracYonetimi";
import IzinGirisi from "./aracDurum/IzinGirisi";
import KesintiGirisi from "./aracDurum/KesintiGirisi";
import AracDurumlari from "./aracDurum/AracDurumlari";

// Görevler
import GorevAta from "./views/Gorevler/GorevAta";
import BenimGorevlerim from "./views/Gorevler/BenimGorevlerim";
import TumGorevler from "./views/Gorevler/TumGorevler";

// Hakediş (eager)
import TedarikciMasraf from "./Hakedisler/TedarikciMasraf";
import AracCariVeFiyat from "./Hakedisler/AracCariVeFiyat";
import HakedisSeferleri from "./Hakedisler/HakedisSeferleri";
import Hamaliye from "./Hakedisler/Hamaliye";

// KPI & RAPORLAR (eager)
import KpiOlcumu from "./raporlar/kpiOlcumu";
import YuklemedeBekleme from "./raporlar/yuklemedeBekleme";
import ProjeLokasyonRaporlari from "./raporlar/ProjeLokasyonRaporlari";
import TeslimdeBekleme from "./raporlar/TeslimdeBekleme";
import BostaArac from "./raporlar/BostaArac";
import AracEtalari from "./raporlar/AracEtalari";

// Layout
import AppLayout from "./layout/AppLayout";

// Lazy sayfalar
const ReelAtananSeferler = lazy(() => import("./aktifseferler/ReelAtananSeferler"));
const SiparisAnaliz = lazy(() => import("./kullanıcıIslemleri/planlamaDetay/SiparisAnaliz"));
const AdminPanel = lazy(() => import("./adminPanel/adminPanel"));
const GorunumDuzenle = lazy(() => import("./aktifseferler/GorunumDuzenle"));
const PagePermissionsPage = lazy(() => import("./adminPanel/PagePermissionsPage"));
const PivotTool = lazy(() => import("./raporlar/PivotTool"));
const ETAUyumsuzlugu = lazy(() => import("./raporlar/ETAUyumsuzlugu"));
const FrigoYakitHakedis = lazy(() => import("./Hakedisler/FrigoYakitHakedis"));

// ✔ Yeni lazy import – DOĞRU HALİ
const FiloIskontoluHakedis = lazy(() => import("./Hakedisler/FiloIskontoluHakedis"));

const SeferTamamlayan = lazy(() => import("./raporlar/SeferTamamlayan"));
const BolgeselAnaliz = lazy(() => import("./raporlar/BolgeselAnaliz"));

// ✅ YENİ: KM Kayıt (Kayıt İşlemleri)
const KmKayit = lazy(() => import("./kayit-islemleri/km-kayit"));

// Test Data
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
                        <Route path="/" element={<Login />} />

                        <Route element={<AppLayout />}>
                            <Route path="anasayfa" element={<Anasayfa />} />

                            <Route
                                element={
                                    <RequirePageAccess>
                                        <Outlet />
                                    </RequirePageAccess>
                                }
                            >
                                {/* Kullanıcı İşlemleri */}
                                <Route path="planlama" element={<Planlama />} />
                                <Route path="plaka-onerisi" element={<PlakaOnerisi />} />
                                <Route
                                    path="seferler"
                                    element={
                                        <Suspense fallback={<div>Yükleniyor...</div>}>
                                            <ReelAtananSeferler />
                                        </Suspense>
                                    }
                                />
                                <Route
                                    path="aktifseferler/gorunum"
                                    element={
                                        <Suspense fallback={<div>Yükleniyor...</div>}>
                                            <GorunumDuzenle />
                                        </Suspense>
                                    }
                                />
                                <Route path="siparisler" element={<Siparisler />} />
                                <Route path="tamamlanan-seferler" element={<TamamlananlarPage />} />

                                {/* Araç Yönetimi */}
                                <Route path="arac/durumlari" element={<AracDurumlari />} />
                                <Route path="arac/yonetim" element={<AracYonetimi />} />
                                <Route path="arac/izin-girisi" element={<IzinGirisi />} />
                                <Route path="arac/kesinti-girisi" element={<KesintiGirisi />} />

                                {/* Görevler */}
                                <Route path="gorevler/ata" element={<GorevAta />} />
                                <Route path="gorevler/benim" element={<BenimGorevlerim />} />
                                <Route path="gorevler/tum" element={<TumGorevler />} />

                                {/* Hakediş */}
                                <Route
                                    path="hakedis/frigo-yakit-hakedis"
                                    element={
                                        <Suspense fallback={<div>Frigo Yakıt Hakediş yükleniyor...</div>}>
                                            <FrigoYakitHakedis />
                                        </Suspense>
                                    }
                                />
                                <Route path="hakedis/tedarikci-masraf" element={<TedarikciMasraf />} />
                                <Route path="hakedis/arac-cari-ve-fiyat" element={<AracCariVeFiyat />} />
                                <Route path="hakedis/hakedis-seferleri" element={<HakedisSeferleri />} />
                                <Route path="hakedis/hamaliye" element={<Hamaliye />} />

                                {/* ✔ EKLENEN YENİ SAYFA */}
                                <Route
                                    path="hakedis/FiloIskontoluHakedis"
                                    element={
                                        <Suspense fallback={<div>Filo İskontolu Hakediş yükleniyor...</div>}>
                                            <FiloIskontoluHakedis />
                                        </Suspense>
                                    }
                                />

                                {/* Raporlar */}
                                <Route path="raporlar/kpi-olcumu" element={<KpiOlcumu />} />
                                <Route path="raporlar/yuklemede-bekleme" element={<YuklemedeBekleme />} />
                                <Route path="raporlar/teslimde-bekleme" element={<TeslimdeBekleme />} />
                                <Route path="raporlar/lokasyon-rapor" element={<ProjeLokasyonRaporlari />} />
                                <Route
                                    path="raporlar/eta-uyumsuz"
                                    element={
                                        <Suspense fallback={<div>ETA Uyumsuzluğu yükleniyor...</div>}>
                                            <ETAUyumsuzlugu />
                                        </Suspense>
                                    }
                                />
                                <Route path="raporlar/bosta-arac" element={<BostaArac />} />
                                <Route
                                    path="raporlar/tools"
                                    element={
                                        <Suspense fallback={<div>Pivot Yükleniyor...</div>}>
                                            <PivotTool datasets={TEST_VERILERI} defaultDataset="Sefer Performansı" />
                                        </Suspense>
                                    }
                                />
                                <Route
                                    path="raporlar/sefer-tamamlayan"
                                    element={
                                        <Suspense fallback={<div>Sefer Tamamlayan yükleniyor...</div>}>
                                            <SeferTamamlayan />
                                        </Suspense>
                                    }
                                />
                                <Route
                                    path="raporlar/bolgesel-analiz"
                                    element={
                                        <Suspense fallback={<div>Bölgesel Analiz yükleniyor...</div>}>
                                            <BolgeselAnaliz />
                                        </Suspense>
                                    }
                                />
                                <Route
                                    path="raporlar/arac-etalari"
                                    element={
                                        <Suspense fallback={<div>Araç ETAları yükleniyor...</div>}>
                                            <AracEtalari />
                                        </Suspense>
                                    }
                                />

                                {/* Sipariş Analiz */}
                                <Route
                                    path="siparis-analiz"
                                    element={
                                        <Suspense fallback={<div>Yükleniyor...</div>}>
                                            <SiparisAnaliz />
                                        </Suspense>
                                    }
                                />

                                {/* ✅ YENİ: Kayıt İşlemleri -> KM Kayıt */}
                                <Route
                                    path="kayit-islemleri/km-kayit"
                                    element={
                                        <Suspense fallback={<div>KM Kayıt yükleniyor...</div>}>
                                            <KmKayit />
                                        </Suspense>
                                    }
                                />

                                {/* Admin */}
                                <Route
                                    path="admin"
                                    element={
                                        <Suspense fallback={<div>Yükleniyor...</div>}>
                                            <AdminPanel />
                                        </Suspense>
                                    }
                                />
                                <Route
                                    path="admin/permissions"
                                    element={
                                        <Suspense fallback={<div>Yükleniyor...</div>}>
                                            <PagePermissionsPage />
                                        </Suspense>
                                    }
                                />
                            </Route>

                            {/* ✅ ÖNEMLİ:
                  Sidebar'da sen /kayit-islemleri/km-kayit şeklinde ABSOLUTE (başında / var) navigate ediyorsun.
                  Route path'leri burada relative ("kayit-islemleri/km-kayit") olduğu için bu doğru çalışır.
                  Yine de biri /kayit-islemleri yazarsa anasayfaya atmasın diye ekstra güvenlik:
              */}
                            <Route path="kayit-islemleri" element={<Navigate to="/kayit-islemleri/km-kayit" replace />} />

                            {/* catch-all */}
                            <Route path="*" element={<Navigate to="/anasayfa" replace />} />
                        </Route>
                    </Routes>
                </Router>
            </ThemeProvider>
        </HelmetProvider>
    );
}

export default App;
