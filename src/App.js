import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import Login from './Login';
import Layout from './Layout';

// Sayfalar
import Anasayfa from './Anasayfa';
import Planlama from './kullanıcıIslemleri/Planlama';
import PlakaOnerisi from './kullanıcıIslemleri/PlakaOnerisi';
import ReelAtananSeferler from './views/ReelAtananSeferler';
import Siparisler from './kullanıcıIslemleri/Siparisler';
import Tamamlananlar from './kullanıcıIslemleri/Tamamlananlar';

// Araç Durumları
import AracYonetimi from './aracDurum/AracYonetimi';
import IzinGirisi from './aracDurum/IzinGirisi';
import KesintiGirisi from './aracDurum/KesintiGirisi';

// 🔽 Görev Sayfaları (yeni eklenenler)
import GorevAta from './views/Gorevler/GorevAta';
import BenimGorevlerim from './views/Gorevler/BenimGorevlerim';
import TumGorevler from './views/Gorevler/TumGorevler';

import TedarikciMasraf from './Hakedisler/TedarikciMasraf';


function App() {
    return (
        <HelmetProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Login />} />

                    <Route
                        path="/*"
                        element={
                            <Layout>
                                <Routes>
                                    <Route path="/anasayfa" element={<Anasayfa />} />
                                    <Route path="/planlama" element={<Planlama />} />
                                    <Route path="/plaka-onerisi" element={<PlakaOnerisi />} />
                                    <Route path="/seferler" element={<ReelAtananSeferler />} />
                                    <Route path="/siparisler" element={<Siparisler />} />
                                    <Route path="/tamamlanan-seferler" element={<Tamamlananlar />} />
                                    <Route path="/arac/yonetim" element={<AracYonetimi />} />
                                    <Route path="/arac/izin-girisi" element={<IzinGirisi />} />
                                    <Route path="/arac/kesinti-girisi" element={<KesintiGirisi />} />

                                    {/* Görevler */}
                                    <Route path="/gorevler/ata" element={<GorevAta />} />
                                    <Route path="/gorevler/benim" element={<BenimGorevlerim />} />
                                    <Route path="/gorevler/tum" element={<TumGorevler />} />

                                    {/* Hakedis */}
                                    <Route path="/hakedis/tedarikci-masraf" element={<TedarikciMasraf />} />

                                    {/* Varsayılan */}
                                    <Route path="*" element={<Navigate to="/anasayfa" replace />} />
                                </Routes>

                            </Layout>
                        }
                    />
                </Routes>
            </Router>
        </HelmetProvider>
    );
}

export default App;
