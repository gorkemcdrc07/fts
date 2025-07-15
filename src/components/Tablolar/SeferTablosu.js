import React, { useRef } from 'react';
import DurumEtiketi from '../Ortak/DurumEtiketi';
import DetaySatirlari from './DetaySatirlari';
import { sayacBilgisi } from '../../utils/veriYardimcilari';
import './SeferTablosu.css';

// 📅 Tarih biçimlendirme
function formatTarih(deger) {
    if (!deger) return '';
    const tarih = new Date(deger);
    if (isNaN(tarih)) return deger;
    const gun = String(tarih.getDate()).padStart(2, '0');
    const ay = String(tarih.getMonth() + 1).padStart(2, '0');
    const yil = tarih.getFullYear();
    return `${gun}.${ay}.${yil}`;
}

// 📦 Hücre formatlama
function hucreFormatla(deger, kolon) {
    const tarihAlanlari = ['sefer_tarihi', 'kayit_zamani', 'atama_tarihi'];
    if (tarihAlanlari.includes(kolon)) return formatTarih(deger);
    return deger ?? '';
}

// ✅ TESLİM NOKTASI'na göre nokta sayısını hesapla (esnek anahtar bulur)
function hesaplaNoktaSayisi(veri) {
    const entry = Object.entries(veri).find(
        ([key]) => key.toLowerCase().includes('teslim') && key.toLowerCase().includes('nokta')
    );

    if (!entry) return 1;

    const deger = entry[1];

    if (typeof deger !== 'string' || deger.trim() === '') return 1;

    return deger.split(';').length;
}

function SeferTablosu({
    veriler,
    filtrelenmisVeriler,
    kolonlar,
    suruklemeyiBaslat,
    suruklemeyeIzinVer,
    birakildi,
    genisletilenSatirlar,
    setGenisletilenSatirlar,
    handleDetailChange,
}) {
    const kolonRefs = useRef({});

    const baslatResize = (e, key) => {
        e.preventDefault();
        e.stopPropagation();

        const th = kolonRefs.current[key];
        const startX = e.clientX;
        const startWidth = th.offsetWidth;

        const onMouseMove = (e) => {
            const yeniGenislik = startWidth + (e.clientX - startX);
            th.style.width = `${yeniGenislik}px`;
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

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
                    <tr className="reel-tr">
                        <th className="reel-th"></th>
                        <th className="reel-th">REEL DURUM</th>
                        <th className="reel-th">NOKTA SAYISI</th>
                        {kolonlar.map((key) => (
                            <th
                                key={key}
                                className="reel-th resizable-th"
                                draggable
                                onDragStart={() => suruklemeyiBaslat(key)}
                                onDragOver={suruklemeyeIzinVer}
                                onDrop={() => birakildi(key)}
                                ref={(el) => (kolonRefs.current[key] = el)}
                            >
                                {key.replace(/_/g, ' ').toUpperCase()}
                                <div
                                    className="resize-handle"
                                    onMouseDown={(e) => baslatResize(e, key)}
                                />
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {filtrelenmisVeriler.map((v) => {
                        const genisletildi = genisletilenSatirlar?.has?.(v.sefer_no);
                        return (
                            <React.Fragment key={v.sefer_no}>
                                <tr className="reel-tr">
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
                                    <td>{hesaplaNoktaSayisi(v)}</td>
                                    {kolonlar.map(k => (
                                        <td key={k} className="reel-td">
                                            {hucreFormatla(v[k], k)}
                                        </td>
                                    ))}
                                </tr>

                                {genisletildi && (
                                    <DetaySatirlari
                                        veri={v}
                                        handleDetailChange={handleDetailChange}
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
