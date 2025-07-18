import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Layout from './Layout';



// Sayfalar
import Anasayfa from './Anasayfa';
import ReelAtananSeferler from './views/ReelAtananSeferler';
import Siparisler from './kullanıcıIslemleri/Siparisler';
import Tamamlananlar from './kullanıcıIslemleri/Tamamlananlar';
import PlakaOnerisi from './kullanıcıIslemleri/PlakaOnerisi';
import Planlama from './kullanıcıIslemleri/Planlama';

// Araç Durumları
import AracYonetimi from './aracDurum/AracYonetimi';
import IzinGirisi from './aracDurum/IzinGirisi';
import KesintiGirisi from './aracDurum/KesintiGirisi';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />

                <Route path="/*" element={
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
                            <Route path="*" element={<Navigate to="/anasayfa" replace />} />
                        </Routes>
                    </Layout>
                } />
            </Routes>
        </Router>
    );
}

export default App;
