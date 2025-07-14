import { useState } from 'react';

export default function useFiltre() {
    const [filtreler, setFiltreler] = useState({
        plaka: '',
        musteriAdi: '',
        projeAdi: '',
        yuklemeNoktasi: '',
        yuklemeIl: '',
        yuklemeIlce: '',
        teslimNoktasi: '',
        teslimIl: '',
        teslimIlce: '',
        atamaYapan: '',
        aracStatu: '',
        noktaSayisi: '',
        seferNoTipi: '',
        secilenSeferler: [],
    });

    const filtreleriTemizle = () => {
        setFiltreler({
            plaka: '',
            musteriAdi: '',
            projeAdi: '',
            yuklemeNoktasi: '',
            yuklemeIl: '',
            yuklemeIlce: '',
            teslimNoktasi: '',
            teslimIl: '',
            teslimIlce: '',
            atamaYapan: '',
            aracStatu: '',
            noktaSayisi: '',
            seferNoTipi: '',
            secilenSeferler: [],
        });
    };

    return { filtreler, setFiltreler, filtreleriTemizle };
}
