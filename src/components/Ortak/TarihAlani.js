import React from 'react';
import './TarihAlani.css';
function TarihAlani({ etiket, deger, onDegisim }) {
    return (
        <div className="filter-block">
            <label>{etiket}</label>
            <input
                type="date"
                value={deger}
                onChange={(e) => onDegisim(e.target.value)}
            />
        </div>
    );
}

export default TarihAlani;
