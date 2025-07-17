import React from 'react';
import { hucreAyir } from '../../utils/veriYardimcilari';

function DetaySatirlari({ veri, handleDetailChange }) {
    const detayAlanlari = [
        'proje_adi',
        'yukleme_noktasi',
        'yukleme_ili',
        'yukleme_ilcesi',
        'teslim_noktasi',
        'teslim_ili',
        'teslim_ilcesi',
        'yukleme_varis',
        'yukleme_cikis',
        'teslim_varis',
        'teslim_cikis',
    ];

    const splitted = detayAlanlari.map((alan) => hucreAyir(veri[alan]));
    const maxSatir = Math.max(...splitted.map((dizi) => dizi.length));

    const handleAutoDateInput = (e, satirIndex, alan, sefer_no) => {
        const input = e.target;
        let val = input.value.trim();

        // Max 16 karakter (GG-AA-YYYY SS:dd)
        if (val.length > 16) {
            input.value = val.slice(0, 16);
            return;
        }

        // GG → otomatik tarih tamamlama
        const cleaned = val.replace(/[^\d]/g, '');
        if (cleaned.length === 2) {
            const now = new Date();
            const gun = cleaned;
            const ay = String(now.getMonth() + 1).padStart(2, '0');
            const yil = now.getFullYear();
            const yeni = `${gun}-${ay}-${yil} `;
            input.value = yeni;
            setTimeout(() => input.setSelectionRange(yeni.length, yeni.length), 0);
            return;
        }

        // GG-AA-YYYY SS → otomatik ":" ekle
        const saatRegex = /^(\d{2})-(\d{2})-(\d{4}) (\d{2})$/;
        const matchSaat = val.match(saatRegex);
        if (matchSaat) {
            const [, gg, aa, yyyy, ss] = matchSaat;
            const saatSayi = parseInt(ss, 10);
            if (saatSayi >= 0 && saatSayi <= 23) {
                const yeni = `${gg}-${aa}-${yyyy} ${ss}:`;
                input.value = yeni;
                setTimeout(() => input.setSelectionRange(yeni.length, yeni.length), 0);
                return;
            }
        }

        // GG-AA-YYYY SS:dd → saat ve dakika kontrolü
        const fullRegex = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/;
        const matchFull = val.match(fullRegex);
        if (matchFull) {
            const [, gg, aa, yyyy, ss, dd] = matchFull;
            const saatSayi = parseInt(ss, 10);
            const dakikaSayi = parseInt(dd, 10);

            if (
                saatSayi >= 0 && saatSayi <= 23 &&
                dakikaSayi >= 0 && dakikaSayi <= 59
            ) {
                const iso = `${yyyy}-${aa}-${gg}T${ss}:${dd}`;
                handleDetailChange(sefer_no, satirIndex, alan, iso);
                return;
            }
        }

        // Geçersizse temizle
        handleDetailChange(sefer_no, satirIndex, alan, '');
    };



    return (
        <tr className="detail-row">
            <td colSpan={Object.keys(veri).length + 1}>
                <div className="detail-container-rows">
                    {[...Array(maxSatir)].map((_, satirIndex) => {
                        const satirBos = splitted.every((col) => {
                            const cell = col[satirIndex];
                            return !cell || cell.trim() === '' || cell.trim() === '-';
                        });
                        if (satirBos) return null;

                        return (
                            <div
                                key={satirIndex}
                                className="detail-row-item"
                                style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}
                            >
                                {detayAlanlari.map((alan, alanIndex) => {
                                    const cell = splitted[alanIndex][satirIndex] || '';
                                    const saatli = [
                                        'yukleme_varis',
                                        'yukleme_cikis',
                                        'teslim_varis',
                                        'teslim_cikis',
                                    ].includes(alan);

                                    const gosterim = cell
                                        ? `${cell.substring(8, 10)}-${cell.substring(5, 7)}-${cell.substring(0, 4)} ${cell.substring(11, 16)}`
                                        : '';

                                    return (
                                        <div
                                            key={alanIndex}
                                            className="detail-item"
                                            style={{
                                                flex: '0 1 350px',
                                                maxWidth: '360px',
                                                minWidth: '200px',
                                                background: '#334155',
                                                borderRadius: '10px',
                                                padding: '8px 10px',
                                                boxShadow: '0 1px 4px rgba(30, 41, 59, 0.2)',
                                                color: '#e0e7ff',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                className="detail-key"
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: '20px',
                                                    marginBottom: '6px',
                                                    color: '#a5b4fc',
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {alan.replace(/_/g, ' ').toUpperCase()}
                                            </div>

                                            <div
                                                className="detail-value"
                                                style={{
                                                    fontSize: '20px',
                                                    fontWeight: 'bold',
                                                    color: '#cbd5e1',
                                                }}
                                            >
                                                {saatli ? (
                                                    <input
                                                        type="text"
                                                        placeholder="GG-AA-YYYY SS:dd"
                                                        defaultValue={gosterim}
                                                        maxLength={16}
                                                        onChange={(e) =>
                                                            handleAutoDateInput(e, satirIndex, alan, veri.sefer_no)
                                                        }
                                                        style={{
                                                            flex: '1 1 auto',
                                                            fontSize: '16px',
                                                            padding: '6px 8px',
                                                            backgroundColor: '#475569',
                                                            color: '#e0e7ff',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                        }}
                                                    />


                                                ) : (
                                                    cell || '-'
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </td>
        </tr>
    );
}

export default DetaySatirlari;
