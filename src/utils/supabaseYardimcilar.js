import { supabase } from '../supabaseClient';

export const veriListele = async (filtreler) => {
    const { startDate, endDate, secilenSeferler } = filtreler;

    if (!startDate || !endDate) {
        alert('❗ Lütfen başlangıç ve bitiş tarihlerini seçin.');
        return [];
    }

    const start = startDate;
    const end = endDate;

    let query = supabase
        .from('seferler')
        .select(`
            id,
            sefer_no,
            plaka,
            treyler,
            surucu_ad_soyad,
            surucu_tckn,
            surucu_telefon,
            musteri_adi,
            musteri_siparis_no,
            hizmet_adi,
            proje_adi,
            yukleme_noktasi,
            yukleme_ili,
            yukleme_ilcesi,
            teslim_alan_firma,
            teslim_noktasi,
            teslim_ili,
            teslim_ilcesi,
            irsaliye_no,
            arac_statu,
            sefer_tarihi,
            atama_yapan_kullanici,
            atama_tarihi,
            kayit_zamani,
            reel_durum,
            sefer_detaylari (
                id,
                sefer_id,
                nokta_sirasi,
                yukleme_varis,
                yukleme_cikis,
                teslim_varis,
                teslim_cikis
            )
        `)
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

    const { data: tamamlananSeferler } = await supabase
        .from('tamamlanan_seferler')
        .select('sefer_no');

    const { data: tamamlananDetaylar } = await supabase
        .from('tamamlanan_detaylar')
        .select('sefer_no');

    const tamamlanmisSeferNoSet = new Set([
        ...(tamamlananSeferler || []).map(s => s.sefer_no),
        ...(tamamlananDetaylar || []).map(s => s.sefer_no)
    ]);

    const temizVeri = (data || []).filter(sefer =>
        sefer?.id && !tamamlanmisSeferNoSet.has(sefer.sefer_no)
    );

    const yeniVeri = temizVeri.map((sefer) => {
        const detaylar = sefer.sefer_detaylari || [];

        const statuHesapla = () => {
            if (detaylar.length === 0) return 'PLAKA ATANDI';

            const tumuTamamlandi = detaylar.every(d =>
                d.yukleme_varis && d.yukleme_cikis && d.teslim_varis && d.teslim_cikis
            );
            if (tumuTamamlandi) return 'SEFER TAMAMLANDI';

            const oncelik = ['teslim_cikis', 'teslim_varis', 'yukleme_cikis', 'yukleme_varis'];
            const etiket = {
                teslim_cikis: 'TAMAMLANDI',
                teslim_varis: 'BOŞALTMADA',
                yukleme_cikis: 'YOLDA',
                yukleme_varis: 'YÜKLEMEDE'
            };

            const ilk = detaylar[0];
            const ilkTamam = ilk.yukleme_varis && ilk.yukleme_cikis && ilk.teslim_varis && ilk.teslim_cikis;

            if (!ilkTamam) {
                for (const alan of oncelik) {
                    if (ilk[alan]) return `1.NOKTADA ${etiket[alan]}`;
                }
                return '1.NOKTADA PLAKA ATANDI';
            }

            // Tüm noktalarda, en ileri olan alanı bul
            for (let i = detaylar.length - 1; i >= 1; i--) {
                const d = detaylar[i];
                for (const alan of oncelik) {
                    if (d[alan]) {
                        return `${i + 1}.NOKTADA ${etiket[alan]}`;
                    }
                }
            }

            // Eğer sadece ilk nokta tamamlanmışsa ve diğerleri boşsa:
            return '1.NOKTADA TAMAMLANDI';
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
