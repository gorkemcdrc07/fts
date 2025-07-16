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

    // ✅ TAMAMLANMIŞ SEFERLERİ ÇEK
    const { data: tamamlananSeferler } = await supabase
        .from('tamamlanan_seferler')
        .select('sefer_no');

    const { data: tamamlananDetaylar } = await supabase
        .from('tamamlanan_detaylar')
        .select('sefer_no');

    // ✅ TAMAMLANMIŞ SEFERLERİ TEK BİR SET'TE BİRLEŞTİR
    const tamamlanmisSeferNoSet = new Set([
        ...(tamamlananSeferler || []).map(s => s.sefer_no),
        ...(tamamlananDetaylar || []).map(s => s.sefer_no)
    ]);

    // ✅ FİLTRELE: tamamlanmış olanları gösterme
    const temizVeri = (data || []).filter(sefer =>
        sefer?.id && !tamamlanmisSeferNoSet.has(sefer.sefer_no)
    );

    // ✅ SEFER DURUMUNU HESAPLA
    const yeniVeri = temizVeri.map((sefer) => {
        const detaylar = sefer.sefer_detaylari || [];

        const statuHesapla = () => {
            const tamam = detaylar.every((d) =>
                d.yukleme_varis && d.yukleme_cikis && d.teslim_varis && d.teslim_cikis
            );
            if (detaylar.length > 0 && tamam) return 'SEFER TAMAMLANDI';

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

/*deneme

