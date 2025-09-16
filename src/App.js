// src/App.js
import React from "react";
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
import ReelAtananSeferler from "./views/ReelAtananSeferler";
import Siparisler from "./kullanıcıIslemleri/Siparisler";
import Tamamlananlar from "./kullanıcıIslemleri/Tamamlananlar";

// Araç Durumları
import AracYonetimi from "./aracDurum/AracYonetimi";
import IzinGirisi from "./aracDurum/IzinGirisi";
import KesintiGirisi from "./aracDurum/KesintiGirisi";

// Görevler
import GorevAta from "./views/Gorevler/GorevAta";
import BenimGorevlerim from "./views/Gorevler/BenimGorevlerim";
import TumGorevler from "./views/Gorevler/TumGorevler";

// Hakediş
import TedarikciMasraf from "./Hakedisler/TedarikciMasraf";
import AracCariVeFiyat from "./Hakedisler/AracCariVeFiyat";
import HakedisSeferleri from "./Hakedisler/HakedisSeferleri";

// KPI & RAPORLAR
import KpiOlcumu from "./raporlar/kpiOlcumu";
import YuklemedeBekleme from "./raporlar/yuklemedeBekleme";
import ProjeLokasyonRaporlari from "./raporlar/ProjeLokasyonRaporlari"; // ✅ Eklendi
import Tools from "./raporlar/tools";
// Layout
import AppLayout from "./layout/AppLayout";

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
                            <Route path="planlama" element={<Planlama />} />
                            <Route path="plaka-onerisi" element={<PlakaOnerisi />} />
                            <Route path="seferler" element={<ReelAtananSeferler />} />
                            <Route path="siparisler" element={<Siparisler />} />
                            <Route path="tamamlanan-seferler" element={<Tamamlananlar />} />

                            {/* Araç Durumları */}
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

                            {/* KPI */}
                            <Route path="raporlar/kpi-olcumu" element={<KpiOlcumu />} />

                            {/* Raporlar */}
                            <Route path="raporlar/yuklemede-bekleme" element={<YuklemedeBekleme />} />
                            <Route path="raporlar/lokasyon-rapor" element={<ProjeLokasyonRaporlari />} /> {/* ✅ Yeni rota */}
                            <Route path="raporlar/tools" element={<div style={{ padding: 24 }}>ROUTE OK</div>} />
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
