import React from 'react';
import Select from 'react-select';
import './Filtreler.css';

function GelismisFiltreler({
    filtreler,
    setFiltreler,
    filtreleriTemizle,
    secenekler,
}) {
    const handleSelectChange = (field, selected) => {
        setFiltreler((prev) => ({
            ...prev,
            [field]: selected ? selected.value : '',
        }));
    };

    const handleInputChange = (field, value) => {
        setFiltreler((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    return (
        <div className="advanced-filters">
            {/* Her filtre bloğu */}
            <div className="filter-block">
                <label>ARAÇ STATÜ</label>
                <Select
                    options={secenekler.aracStatu}
                    value={filtreler.aracStatu ? { label: filtreler.aracStatu, value: filtreler.aracStatu } : null}
                    onChange={(e) => handleSelectChange('aracStatu', e)}
                    isClearable
                    isSearchable
                    placeholder="Araç statü seçin"
                    classNamePrefix="Select"
                />
            </div>

            <div className="filter-block">
                <label>NOKTA SAYISI</label>
                <input
                    type="number"
                    min="1"
                    placeholder="Örn: 2"
                    value={filtreler.noktaSayisi}
                    onChange={(e) => handleInputChange('noktaSayisi', e.target.value)}
                />
            </div>

            {/* Select filtreleri */}
            {[
                ['plaka', 'PLAKA'],
                ['musteriAdi', 'MÜŞTERİ ADI'],
                ['projeAdi', 'PROJE ADI'],
                ['yuklemeNoktasi', 'YÜKLEME NOKTASI'],
                ['yuklemeIl', 'YÜKLEME İLİ'],
                ['yuklemeIlce', 'YÜKLEME İLÇESİ'],
                ['teslimNoktasi', 'TESLİM NOKTASI'],
                ['teslimIl', 'TESLİM İLİ'],
                ['teslimIlce', 'TESLİM İLÇESİ'],
                ['atamaYapan', 'ATAMA YAPAN'],
            ].map(([field, label]) => (
                <div className="filter-block" key={field}>
                    <label>{label}</label>
                    <Select
                        options={secenekler[field]}
                        value={filtreler[field] ? { label: filtreler[field], value: filtreler[field] } : null}
                        onChange={(e) => handleSelectChange(field, e)}
                        isClearable
                        isSearchable
                        placeholder={`${label.toLowerCase()} seçin`}
                        classNamePrefix="Select"
                    />
                </div>
            ))}

            {/* Çoklu Seçim: Sefer No */}
            <div className="filter-block sefer-no-filter">
                <label>SEFER NO</label>
                <Select
                    options={secenekler.seferNo}
                    isMulti
                    placeholder="Sefer No seçin"
                    value={filtreler.secilenSeferler}
                    onChange={(selected) =>
                        setFiltreler((prev) => ({
                            ...prev,
                            secilenSeferler: selected,
                        }))
                    }
                    classNamePrefix="Select"
                    noOptionsMessage={() => '🔍 Sefer bulunamadı'}
                />
            </div>

            {/* Temizle Butonu */}
            <div className="filter-block clear-btn-container">
                <button
                    className="btn btn-clear"
                    onClick={filtreleriTemizle}
                >
                    🧹 Filtreleri Temizle
                </button>
            </div>
        </div>
    );
}

export default GelismisFiltreler;
