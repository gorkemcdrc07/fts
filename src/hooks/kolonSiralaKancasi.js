import { useState } from 'react';

export default function useKolonSirala(baslangicKolonlar = []) {
    const [kolonlar, setKolonlar] = useState(baslangicKolonlar);
    const [suruklenenKolon, setSuruklenenKolon] = useState(null);

    const suruklemeyiBaslat = (kolon) => setSuruklenenKolon(kolon);
    const suruklemeyeIzinVer = (e) => e.preventDefault();

    const birakildi = (hedefKolon) => {
        if (!suruklenenKolon || suruklenenKolon === hedefKolon) return;
        const guncel = [...kolonlar];
        const eskiIndex = guncel.indexOf(suruklenenKolon);
        const yeniIndex = guncel.indexOf(hedefKolon);
        guncel.splice(eskiIndex, 1);
        guncel.splice(yeniIndex, 0, suruklenenKolon);
        setKolonlar(guncel);
        setSuruklenenKolon(null);
    };

    return { kolonlar, setKolonlar, suruklemeyiBaslat, suruklemeyeIzinVer, birakildi };
}
