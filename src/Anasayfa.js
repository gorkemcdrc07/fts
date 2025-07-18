import React from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Helmet } from 'react-helmet-async';
import './Anasayfa.css';

function Anasayfa() {
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
                    <p>Buraya dashboard içeriği gelecek.</p>
                </div>
            </div>
        </div>
    );
}

export default Anasayfa;
