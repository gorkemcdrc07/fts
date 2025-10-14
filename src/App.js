// src/App.js
import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// MUI Tema
import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "./theme";

// Sayfalar
import Login from "./Login";
import Anasayfa from "./Anasayfa";
import Planlama from "./kullanıcıIslemleri/Planlama";
import PlakaOnerisi from "./kullanıcıIslemleri/PlakaOnerisi";
import Siparisler from "./kullanıcıIslemleri/Siparisler";
// ❌ ESKİ: import Tamamlananlar from "./kullanıcıIslemleri/Tamamlananlar";
// ✅ YENİ:
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

// Hakediş
import TedarikciMasraf from "./Hakedisler/TedarikciMasraf";
import AracCariVeFiyat from "./Hakedisler/AracCariVeFiyat";
import HakedisSeferleri from "./Hakedisler/HakedisSeferleri";
import Hamaliye from "./Hakedisler/Hamaliye";

// KPI & RAPORLAR
import KpiOlcumu from "./raporlar/kpiOlcumu";
import YuklemedeBekleme from "./raporlar/yuklemedeBekleme";
import ProjeLokasyonRaporlari from "./raporlar/ProjeLokasyonRaporlari";

// Layout
import AppLayout from "./layout/AppLayout";

// Lazy sayfalar
const ReelAtananSeferler = lazy(() => import("./aktifseferler/ReelAtananSeferler"));
const SiparisAnaliz = lazy(() => import("./kullanıcıIslemleri/planlamaDetay/SiparisAnaliz"));
const AdminPanel = lazy(() => import("./adminPanel/adminPanel"));
function App() {
    return (
        <HelmetProvider>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Router>
                    <Routes>
                        {/* Giriş */}
                        <Route path="/" element={<Login />} />

                        {/* App Layout içinde tüm sayfalar */}
                        <Route element={<AppLayout />}>
                            <Route path="anasayfa" element={<Anasayfa />} />

                            {/* Planlama */}
                            <Route path="planlama" element={<Planlama />} />

                            <Route path="plaka-onerisi" element={<PlakaOnerisi />} />

                            {/* ReelAtananSeferler (lazy) */}
                            <Route
                                path="seferler"
                                element={
                                    <Suspense fallback={<div style={{ padding: 24 }}>Yükleniyor...</div>}>
                                        <ReelAtananSeferler />
                                    </Suspense>
                                }
                            />

                            <Route path="siparisler" element={<Siparisler />} />

                            {/* ❌ ESKİ: <Route path="tamamlanan-seferler" element={<Tamamlananlar />} /> */}
                            {/* ✅ YENİ: */}
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

                            {/* KPI */}
                            <Route path="raporlar/kpi-olcumu" element={<KpiOlcumu />} />

                            {/* Raporlar */}
                            <Route path="raporlar/yuklemede-bekleme" element={<YuklemedeBekleme />} />
                            <Route path="raporlar/lokasyon-rapor" element={<ProjeLokasyonRaporlari />} />
                            <Route path="raporlar/tools" element={<div style={{ padding: 24 }}>ROUTE OK</div>} />

                            {/* KOCAELİ kartı için hedef route */}
                            <Route
                                path="siparis-analiz"
                                element={
                                    <Suspense fallback={<div style={{ padding: 24 }}>Yükleniyor...</div>}>
                                        <SiparisAnaliz />
                                    </Suspense>
                                }
                            />

                            {/* Admin Panel */}
                            <Route
                                path="admin"
                                element={
                                    <Suspense fallback={<div style={{ padding: 24 }}>Yükleniyor...</div>}>
                                        <AdminPanel />
                                    </Suspense>
                                }
                            />

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
