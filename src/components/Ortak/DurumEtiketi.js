import React from 'react';

function DurumEtiketi({ durum }) {
    const renk = (() => {
        if (!durum) return '#6b7280'; // gray-500
        const d = durum.toLowerCase();
        if (d.includes('tamamlandı')) return '#2f855a'; // green-600
        if (d.includes('boşaltma')) return '#3182ce'; // blue-600
        if (d.includes('yolda')) return '#dd6b20'; // orange-600
        if (d.includes('yükleme')) return '#6b46c1'; // purple-700
        if (d.includes('plaka')) return '#d69e2e'; // yellow-600
        return '#6b7280'; // gray-500
    })();

    // Sarı arka plan için koyu metin, diğerleri için beyaz metin
    const metinRengi = renk === '#d69e2e' ? '#1a202c' : '#fff';

    const stil = {
        display: 'inline-block',
        padding: '4px 10px',
        fontSize: '13px',
        fontWeight: '700',
        borderRadius: '12px',
        backgroundColor: renk,
        color: metinRengi,
        textTransform: 'uppercase',
        userSelect: 'none',
        whiteSpace: 'nowrap',
    };

    return <span style={stil}>{durum || '-'}</span>;
}

export default DurumEtiketi;
