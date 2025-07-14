import React from 'react';
import './YukleniyorGosterge.css';
function YukleniyorGosterge({ mesaj = 'Yükleniyor...' }) {
    return (
        <div className="loading-indicator">
            ⏳ {mesaj}
        </div>
    );
}

export default YukleniyorGosterge;
