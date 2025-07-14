import React from 'react';
import DurumEtiketi from '../Ortak/DurumEtiketi';
import DetaySatirlari from './DetaySatirlari';
import { sayacBilgisi } from '../../utils/veriYardimcilari';
import { hucreFormatla } from '../../utils/formatlayicilar';
import './SeferTablosu.css';

function SeferTablosu({
    veriler,
    filtrelenmisVeriler,
    kolonlar,
    suruklemeyiBaslat,
    suruklemeyeIzinVer,
    birakildi,
    genisletilenSatirlar,
    setGenisletilenSatirlar,
    handleDetailChange,  // BURAYI EKLEDİK
}) {
    const satirTikla = (seferNo) => {
        setGenisletilenSatirlar((prev) => {
            const yeni = new Set(prev);
            yeni.has(seferNo) ? yeni.delete(seferNo) : yeni.add(seferNo);
            return yeni;
        });
    };

    return (
        <div className="reel-table-container">
            <table className="reel-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>REEL DURUM</th>
                        <th>NOKTA SAYISI</th>
                        {kolonlar.map((key) => (
                            <th
                                key={key}
                                draggable
                                onDragStart={() => suruklemeyiBaslat(key)}
                                onDragOver={suruklemeyeIzinVer}
                                onDrop={() => birakildi(key)}
                                style={{ cursor: 'move' }}
                            >
                                {key.replace(/_/g, ' ').toUpperCase()}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {filtrelenmisVeriler.map((v) => {
                        const genisletildi = genisletilenSatirlar.has(v.sefer_no);
                        return (
                            <React.Fragment key={v.sefer_no}>
                                <tr>
                                    <td
                                        className="expand-toggle-cell"
                                        onClick={() => satirTikla(v.sefer_no)}
                                        aria-label={genisletildi ? 'Satırı kapat' : 'Satırı aç'}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ' ') satirTikla(v.sefer_no);
                                        }}
                                    >
                                        {genisletildi ? '−' : '+'}
                                    </td>
                                    <td><DurumEtiketi durum={v.reel_durum} /></td>
                                    <td>{v.nokta_sayisi}</td>
                                    {kolonlar.map(k => (
                                        <td key={k}>{hucreFormatla(v[k])}</td>
                                    ))}
                                </tr>

                                {genisletildi && (
                                    <DetaySatirlari
                                        veri={v}
                                        handleDetailChange={handleDetailChange}  // BURADA GEÇİYORUZ
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>

            {filtrelenmisVeriler.length > 0 && (
                <div className="sabit-sayac">
                    {(() => {
                        const { toplam, bos, sfr } = sayacBilgisi(filtrelenmisVeriler);
                        return (
                            <div className="sayac-icerik">
                                🔢 Toplam: {toplam} satır |
                                <span style={{ marginLeft: '12px' }}>🅱 BOS: {bos}</span> |
                                <span style={{ marginLeft: '12px' }}>🆔 SFR: {sfr}</span>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

export default SeferTablosu;
