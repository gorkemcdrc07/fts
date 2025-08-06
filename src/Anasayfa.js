import React from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Helmet } from 'react-helmet-async';
import './Anasayfa.css';

function Anasayfa() {
    // Örnek dashboard verileri
    const dashboardData = {
        completedTrips: 42,
        pendingTasks: 7,
        activeVehicles: 15
    };

    return (
        <div style={{ display: 'flex' }}>
            <Helmet>
                <title>ANA SAYFA</title>
            </Helmet>
            <Sidebar />
            <div className="content-area">
                <Navbar />
                <div className="main-content">
                    <h1>Ana Menü</h1>
                    <div className="dashboard-cards">
                        <div className="card">
                            <h3>Tamamlanan Seferler</h3>
                            <p>{dashboardData.completedTrips}</p>
                        </div>
                        <div className="card">
                            <h3>Bekleyen Görevler</h3>
                            <p>{dashboardData.pendingTasks}</p>
                        </div>
                        <div className="card">
                            <h3>Aktif Araçlar</h3>
                            <p>{dashboardData.activeVehicles}</p>
                        </div>
                    </div>
                    <p>Buraya ileride grafik ve detaylı içerik gelecek.</p>
                </div>
            </div>
        </div>
    );
}

export default Anasayfa;
