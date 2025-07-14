import React, { useRef } from 'react';
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

    const inputRefs = useRef({});

    const setInputRef = (satirIndex, alanIndex, el) => {
        if (!inputRefs.current[satirIndex]) inputRefs.current[satirIndex] = {};
        inputRefs.current[satirIndex][alanIndex] = el;
    };

    // GG-AA-YYYY formatında geçerlilik kontrolü
    const isValidDate = (dateStr) => {
        if (!/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return false;

        const [dayStr, monthStr, yearStr] = dateStr.split('-');
        const day = parseInt(dayStr, 10);
        const month = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);

        const date = new Date(year, month - 1, day);
        return (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        );
    };

    const handleDateChange = (e, satirIndex, alanIndex, alan, eskiCell, sefer_no) => {
        let val = e.target.value;

        // Sadece rakam ve '-' kabul et
        val = val.replace(/[^0-9-]/g, '');

        // Maksimum 10 karakter (GG-AA-YYYY)
        if (val.length > 10) val = val.slice(0, 10);

        const parts = val.split('-');

        if (parts.length === 1 && parts[0].length <= 2) {
            // Sadece gün yazılmış
            const dayStr = parts[0];
            if (dayStr.length === 2) {
                const dayNum = parseInt(dayStr, 10);
                if (dayNum >= 1 && dayNum <= 31) {
                    // Gün geçerli, otomatik ay ve yıl ekle
                    const currentDate = new Date();
                    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                    const year = currentDate.getFullYear();
                    val = `${dayStr}-${month}-${year}`;
                    e.target.value = val;

                    const yeniDeger = `${year}-${month}-${dayStr}T${eskiCell?.split('T')[1] || '00:00'}`;
                    handleDetailChange(sefer_no, satirIndex, alan, yeniDeger);

                    // Saate focus yap
                    const saatInput = inputRefs.current?.[satirIndex]?.[alanIndex];
                    if (saatInput) {
                        setTimeout(() => {
                            saatInput.focus();
                        }, 0);
                    }
                    return;
                }
            }
        } else if (parts.length === 3) {
            // GG-AA-YYYY formatında olabilir, kontrol et
            if (isValidDate(val)) {
                e.target.value = val;
                const [day, month, year] = parts;
                const yeniDeger = `${year}-${month}-${day}T${eskiCell?.split('T')[1] || '00:00'}`;
                handleDetailChange(sefer_no, satirIndex, alan, yeniDeger);
                return;
            }
        }

        // Diğer durumlarda input güncellenir ama handleDetailChange boş gönderilir
        e.target.value = val;
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
                                                style={{ fontSize: '20px', fontWeight: 'bold', color: '#cbd5e1' }}
                                            >
                                                {saatli ? (
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            gap: '8px',
                                                            alignItems: 'center',
                                                            justifyContent: 'flex-start',
                                                        }}
                                                    >
                                                        <input
                                                            type="text"
                                                            maxLength={10}
                                                            placeholder="GG-AA-YYYY"
                                                            defaultValue={
                                                                cell
                                                                    ? `${cell.substring(8, 10)}-${cell.substring(5, 7)}-${cell.substring(0, 4)}`
                                                                    : ''
                                                            }
                                                            onChange={(e) =>
                                                                handleDateChange(
                                                                    e,
                                                                    satirIndex,
                                                                    alanIndex,
                                                                    alan,
                                                                    cell,
                                                                    veri.sefer_no
                                                                )
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
                                                        <input
                                                            ref={(el) => setInputRef(satirIndex, alanIndex, el)}
                                                            type="time"
                                                            value={cell ? cell.split('T')[1] || '00:00' : '00:00'}
                                                            onChange={(e) => {
                                                                const datePart = cell?.split('T')[0] || new Date().toISOString().split('T')[0];
                                                                const newValue = `${datePart}T${e.target.value}`;
                                                                handleDetailChange(veri.sefer_no, satirIndex, alan, newValue);
                                                            }}
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
                                                    </div>
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
