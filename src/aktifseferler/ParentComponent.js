// src/aktifseferler/ParentComponent.jsx

import React, { useState, useMemo, useCallback } from 'react';
import { Button, Box, Alert, Typography } from '@mui/material';
import EtaDialog from './EtaDialog'; // EtaDialog dosya yolunuzu kontrol edin

// Varsayımsal yardımcı fonksiyonlar ve sabitler (Bunları kendi utils/eta dosyanızdan almalısınız)
const ETA_STATUS = { WAITING_FIRST_YC: 0, NEED_DISTANCE: 1, READY: 2 };
const ETA_MESSAGES = { 0: "Başlangıç bekleniyor", 1: "Mesafe bilgisi gerekiyor", 2: "Hazır" };
const COLORS = { primary: "#1976d2", success: "#4caf50" };

// Simülasyon: Tarih formatlama fonksiyonu
const fromISOToCombined = (isoString) => {
    if (!isoString || isoString.startsWith("__")) return "-";
    // Gerçek uygulamada daha sofistike bir tarih formatlama olacaktır.
    const d = new Date(isoString);
    return d.toLocaleDateString("tr-TR", {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
};

// BREAK_OPTIONS (Örnek Molalar)
const BREAK_OPTIONS = [
    { value: 0, label: "Mola Yok" },
    { value: 15, label: "15 dakika" },
    { value: 30, label: "30 dakika" },
    { value: 45, label: "45 dakika (Standart)" },
    { value: 540, label: "9 saat (Günlük Dinlenme)" }
];

// DateTimeOneField Simülasyonu
// Bu, genellikle bir date picker bileşeni olacaktır.
const DateTimeOneField = (props) => (
    <TextField
        type="datetime-local"
        {...props}
    />
);


// Supabase Client'ınızın Varsayımsal Tanımı
// Gerçek uygulamada bunu bir yerde başlatıp import etmelisiniz.
const supabase = {
    from: (tableName) => ({
        upsert: async (data) => {
            console.log(`[SUPABASE MOCK] 'mesafeler' tablosuna kayıt denemesi:`, data[0]);
            // Burada gerçek Supabase API çağrısı olurdu.
            await new Promise(resolve => setTimeout(resolve, 500)); // Simülasyon gecikmesi
            // Hata yoksa:
            return { data: data, error: null };
            // Hata varsa:
            // return { data: null, error: { message: "Veritabanı hatası" } };
        }
    })
};


// --- Ana Parent Component ---

export default function ParentComponent() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [driveHM, setDriveHM] = useState("00:00");
    const [breakSel, setBreakSel] = useState(0);
    const [distanceInput, setDistanceInput] = useState("");
    const [isCalculating, setIsCalculating] = useState(false); // Hesaplama durumu

    // Simülasyon: ETA Hesaplama sonucu
    // Başlangıçta mesafe bilgisi eksikmiş gibi simüle edelim
    const [computedETAISO, setComputedETAISO] = useState("__NEED_DISTANCE__");
    // const [computedETAISO, setComputedETAISO] = useState("2025-10-21T10:30:00"); // Mesafe varsa

    // Simülasyon: Sefer verisi
    const etaRow = useMemo(() => ({
        sefer_no: "TR-2025-500",
        plaka: "34 ABC 123",
        surucu_ad_soyad: "Ahmet Yılmaz",
        kalan_surus_dk: 900, // 15 saat
        eta_mola_dk: 0,
        yukleme_ili: "İSTANBUL",
        yukleme_ilcesi: "TUZLA",
        teslim_ili: "İZMİR",
        teslim_ilcesi: "KONAK",
        // İlk yükleme çıkışı: (Örnek: 1 saat önce yola çıktı)
        sefer_detaylari: [{ yukleme_cikis: new Date(Date.now() - 3600000).toISOString() }],
    }), []);

    // Simülasyon: Display Text'ler
    const vehicleText = `${etaRow.plaka} / Çekici`;
    const driverText = etaRow.surucu_ad_soyad;
    const jobText = "Elektronik Malzeme Taşımacılığı";
    const originText = "Tuzla Limanı Depo";
    const destinationText = "İzmir Serbest Bölge";
    const etaDistanceInfo = "Tahmini rota mesafesi: ~500 km";


    // --- Fonksiyonlar ---

    const openDialog = () => {
        // Dialog açılırken state'leri resetle
        setDriveHM("00:00");
        setBreakSel(etaRow?.eta_mola_dk ?? 0);
        setDistanceInput("");
        // Gerçek uygulamada, mevcut ETA durumunu buraya set etmelisiniz
        // setComputedETAISO(calculateInitialETA(etaRow)); 
        setIsDialogOpen(true);
    };

    const onClose = useCallback(() => {
        setIsDialogOpen(false);
        setIsCalculating(false);
    }, []);

    const copyETA = useCallback(() => {
        const etaText = fromISOToCombined(computedETAISO);
        navigator.clipboard.writeText(etaText);
        console.log(`ETA Kopyalandı: ${etaText}`);
        // Normalde burada bir Toast/Snackbar gösterilir.
    }, [computedETAISO]);

    const saveETA = useCallback(() => {
        // Normal ETA kaydetme işlemi (Eğer ETA hesaplandıysa)
        console.log(`ETA kaydedildi: ${fromISOToCombined(computedETAISO)}`);
        onClose();
    }, [computedETAISO, onClose]);

    /**
     * @param {{distance: number, yukleme_il: string, yukleme_ilce: string, teslim_il: string, teslim_ilce: string}} params
     */
    const saveManualDistanceAndETA = useCallback(async (params) => {
        if (isCalculating) return;

        setIsCalculating(true);

        console.log("Adım 1: Mesafeyi Supabase'e kaydet.");
        const { error: distanceError } = await supabase
            .from('mesafeler')
            .upsert([{
                yukleme_il: params.yukleme_il,
                yukleme_ilce: params.yukleme_ilce,
                teslim_il: params.teslim_il,
                teslim_ilce: params.teslim_ilce,
                mesafe: params.distance, // Burada km olarak kaydedilir
            }]);

        if (distanceError) {
            console.error("Supabase mesafe kaydetme hatası:", distanceError);
            setIsCalculating(false);
            alert("Mesafe kaydedilirken hata oluştu: " + distanceError.message);
            return;
        }

        console.log(`Adım 2: Mesafe kaydedildi (${params.distance} km). Şimdi yeni ETA hesaplanacak.`);

        // Simülasyon: Yeni mesafeyle ETA'yı tekrar hesapla
        // Gerçek uygulamada burada yeni mesafe ile ETA hesaplama API'nizi çağıracaksınız.
        // Başlangıçta "__NEED_DISTANCE__" olan değeri, bir tarih ISO string'ine çevirelim.

        // Örnek simülasyon: (Saniyeler içinde hesaplandığını varsayalım)
        await new Promise(resolve => setTimeout(resolve, 1500));
        const newETA = new Date(Date.now() + (params.distance * 1000 * 60) / 80).toISOString(); // Çok basit bir hesaplama
        setComputedETAISO(newETA);

        // Yeni ETA hesaplandıktan sonra otomatik kaydetme
        console.log(`Adım 3: Yeni ETA hesaplandı: ${fromISOToCombined(newETA)}. Kaydediliyor...`);
        saveETA();

        // State'leri sıfırla ve kapat (saveETA zaten kapatmayı çağırıyor, ama emin olalım)
        setDistanceInput("");
        setIsCalculating(false);
        // onClose(); // saveETA içinde zaten çağrılıyor

    }, [isCalculating, saveETA]);

    // canETA ve mayOpenETA (Basit koşullar)
    const canETA = computedETAISO !== "__NEED_DISTANCE__" && computedETAISO !== "__WAITING__" && !isCalculating;
    const mayOpenETA = true;


    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>ETA Dialog Parent Component</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                Bu component, Supabase entegrasyonu ve tüm state yönetimini simüle eder.
                Şu anki ETA durumu:
                <Chip label={isCalculating ? "Hesaplanıyor..." : ETA_MESSAGES[computedETAISO === "__NEED_DISTANCE__" ? 1 : computedETAISO === "__WAITING__" ? 0 : 2]}
                    color={canETA ? "success" : "warning"} size="small" sx={{ ml: 1 }} />
            </Alert>

            <Button variant="contained" onClick={openDialog}>
                ETA Hesapla / Düzenle
            </Button>

            <EtaDialog
                open={isDialogOpen}
                onClose={onClose}
                COLORS={COLORS}
                etaRow={etaRow}
                vehicleText={vehicleText}
                driverText={driverText}
                jobText={jobText}
                originText={originText}
                destinationText={destinationText}
                etaDistanceInfo={etaDistanceInfo}
                DateTimeOneField={DateTimeOneField}
                BREAK_OPTIONS={BREAK_OPTIONS}

                // State'ler
                driveHM={driveHM}
                setDriveHM={setDriveHM}
                breakSel={breakSel}
                setBreakSel={setBreakSel}
                distanceInput={distanceInput} // YENİ: Manuel mesafe input değeri
                setDistanceInput={setDistanceInput} // YENİ: Manuel mesafe input setter

                // Hesaplanan Değerler
                computedETAISO={computedETAISO}
                fromISOToCombined={fromISOToCombined}

                // Aksiyonlar
                copyETA={copyETA}
                saveETA={saveETA}
                saveManualDistanceAndETA={saveManualDistanceAndETA} // YENİ: Mesafe kaydetme fonksiyonu

                // Yetkiler
                mayOpenETA={mayOpenETA}
                canETA={canETA}

                // Ekstra Bilgiler
                latestYuklemeCikis={etaRow?.sefer_detaylari?.[0]?.yukleme_cikis}
            />
        </Box>
    );
}
