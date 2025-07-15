import React from 'react';
import Select from 'react-select';
import './Filtreler.css';

function TemelFiltreler({
    filtreler,
    setFiltreler,
    senkronizeYetkili,
    listeleTikla,
    senkronizeTikla,
    detayKaydetTikla,
    gorunumKaydetTikla,
    tamamlananlariAktarTikla, // ✅ EKLENDİ
    gelismisFiltreToggle,
    gelismisFiltreAcik,
    kaydetmeDurumu,
}) {
    return (
        <div className="reel-filters">
            {/* TEMEL TARİHLER */}
            <div className="filter-block">
                <label>Başlangıç Tarihi</label>
                <input
                    type="date"
                    value={filtreler.startDate ?? ''}
                    onChange={(e) =>
                        setFiltreler((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                />
            </div>

            <div className="filter-block">
                <label>Bitiş Tarihi</label>
                <input
                    type="date"
                    value={filtreler.endDate ?? ''}
                    onChange={(e) =>
                        setFiltreler((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                />
            </div>

            {/* SEFER NO TİPİ */}
            <div className="filter-block">
                <label>SEFER NO TİPİ</label>
                <Select
                    options={[
                        { label: 'Tümü', value: '' },
                        { label: 'BOS ile Başlayan', value: 'BOS' },
                        { label: 'SFR ile Başlayan', value: 'SFR' },
                    ]}
                    value={{
                        label: filtreler.seferNoTipi || 'Tümü',
                        value: filtreler.seferNoTipi,
                    }}
                    onChange={(e) =>
                        setFiltreler((prev) => ({ ...prev, seferNoTipi: e?.value || '' }))
                    }
                    isClearable={false}
                    classNamePrefix="Select"
                />
            </div>

            {/* BUTONLAR */}
            <div className="filter-buttons">
                <div className="left-buttons">
                    <button className="btn btn-list" onClick={listeleTikla}>
                        📥 Listele
                    </button>

                    {senkronizeYetkili && (
                        <button className="btn btn-sync" onClick={senkronizeTikla}>
                            🔄 Senkronize Et
                        </button>
                    )}

                    <button className="btn btn-save" disabled={kaydetmeDurumu} onClick={detayKaydetTikla}>
                        💾 {kaydetmeDurumu ? 'Kaydediliyor...' : 'Detayları Kaydet'}
                    </button>

                    <button className="btn btn-clear" onClick={gorunumKaydetTikla}>
                        💾 Görünüm Kaydet
                    </button>

                    {/* ✅ Yeni Buton */}
                    <button className="btn btn-complete" onClick={tamamlananlariAktarTikla}>
                        ✅ Tamamlanan Seferleri Aktar
                    </button>
                </div>

                <button className="toggle-advanced toggle-button" onClick={gelismisFiltreToggle}>
                    {gelismisFiltreAcik
                        ? '🔼 Gelişmiş Filtreleri Gizle'
                        : '🔽 Gelişmiş Filtreleri Göster'}
                </button>
            </div>
        </div>
    );
}

export default TemelFiltreler;
