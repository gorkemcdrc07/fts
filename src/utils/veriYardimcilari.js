export const hucreAyir = (deger) => {
    return (deger ?? '')
        .toString()
        .split(';')
        .map(v => v.trim())
        .filter(v => v !== '');
};

export const sayacBilgisi = (veriler) => {
    const toplam = veriler.length;
    const bos = veriler.filter(v => (v.sefer_no || '').toUpperCase().startsWith('BOS')).length;
    const sfr = veriler.filter(v => (v.sefer_no || '').toUpperCase().startsWith('SFR')).length;
    return { toplam, bos, sfr };
};

export const toDateTimeLocal = (isoString) => {
    let d = isoString && isoString !== '-' ? new Date(isoString) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
};
