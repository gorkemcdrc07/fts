import { supabase } from '../supabaseClient';

export const veriListele = async (filtreler) => {
    const { startDate, endDate, secilenSeferler } = filtreler;

    if (!startDate || !endDate) {
        alert('❗ Lütfen başlangıç ve bitiş tarihlerini seçin.');
        return [];
    }

    // Tarih formatlarının doğruluğunu kontrol edin (YYYY-MM-DD)
    const start = startDate;
    const end = endDate;

    let query = supabase
        .from('seferler')
        .select('*, sefer_detaylari(*)')
        .gte('sefer_tarihi', `${start}T00:00:00`)
        .lte('sefer_tarihi', `${end}T23:59:59`)
        .order('sefer_tarihi', { ascending: false });

    if (secilenSeferler?.length > 0) {
        const seferListesi = secilenSeferler.map((s) => s.value.trim());
        query = query.in('sefer_no', seferListesi);
    }

    const { data, error } = await query;

    if (error) {
        console.error('❌ Sefer veri çekme hatası:', error);
        return [];
    }

    // Sefer detaylarını ve durumu hesapla
    const yeniVeri = data.map((sefer) => {
        const detaylar = sefer.sefer_detaylari || [];

        const statuHesapla = () => {
            const tamam = detaylar.every((d) =>
                d.yukleme_varis && d.yukleme_cikis && d.teslim_varis && d.teslim_cikis
            );
            if (tamam && detaylar.length > 0) return 'SEFER TAMAMLANDI';

            return detaylar
                .map((d, i) => {
                    if (d.teslim_cikis) return `${i + 1}.NOKTADA TAMAMLANDI`;
                    if (d.teslim_varis) return `${i + 1}.NOKTADA BOŞALTMADA`;
                    if (d.yukleme_cikis) return `${i + 1}.NOKTADA YOLDA`;
                    if (d.yukleme_varis) return `${i + 1}.NOKTADA YÜKLEMEDE`;
                    return `${i + 1}.NOKTADA PLAKA ATANDI`;
                })
                .filter(Boolean)
                .join('; ');
        };

        return {
            ...sefer,
            arac_statu: statuHesapla(),
            nokta_sayisi: detaylar.length,
            yukleme_varis: detaylar.map((d) => d.yukleme_varis || '-').join('; '),
            yukleme_cikis: detaylar.map((d) => d.yukleme_cikis || '-').join('; '),
            teslim_varis: detaylar.map((d) => d.teslim_varis || '-').join('; '),
            teslim_cikis: detaylar.map((d) => d.teslim_cikis || '-').join('; '),
        };
    });

    return yeniVeri;
};
