import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './Tamamlananlar.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Helmet } from 'react-helmet-async';

const Tamamlananlar = () => {
    const [seferler, setSeferler] = useState([]);
    const [detaylar, setDetaylar] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [filtre, setFiltre] = useState({
        seferNo: '',
        plaka: '',
        baslangic: '',
        bitis: '',
    });
    const [filtreliSeferler, setFiltreliSeferler] = useState([]);
    const [columns, setColumns] = useState([
        { key: 'sefer_no', label: 'Sefer No' },
        { key: 'plaka', label: 'Plaka' },
        { key: 'treyler', label: 'Treyler' },
        { key: 'surucu_ad_soyad', label: 'Şoför' },
        { key: 'surucu_tckn', label: 'TCKN' },
        { key: 'surucu_telefon', label: 'Tel' },
        { key: 'musteri_adi', label: 'Müşteri' },
        { key: 'musteri_siparis_no', label: 'Sipariş No' },
        { key: 'hizmet_adi', label: 'Hizmet' },
        { key: 'proje_adi', label: 'Proje' },
        { key: 'yukleme_noktasi', label: 'Yükleme Noktası' },
        { key: 'il_ilce', label: 'İl/İlçe' },
        { key: 'teslim_noktasi', label: 'Teslim Noktası' },
        { key: 'teslim_il_ilce', label: 'İl/İlçe' },
        { key: 'irsaliye_no', label: 'İrsaliye' },
        { key: 'atama_yapan_kullanici', label: 'Atayan' },
        { key: 'atama_tarihi', label: 'Atama Tarihi' },
        { key: 'sefer_tarihi', label: 'Sefer Tarihi' },
        { key: 'arac_statu', label: 'Durum' },
    ]);
    const GORUNUM_SAYFA_ADI = 'tamamlananlar';

    useEffect(() => {
        const kullaniciId = parseInt(localStorage.getItem('kullaniciId'));
        if (!kullaniciId) return;

        supabase
            .from('kullanici_tamamlanan_gorunumleri')  // BURADA TABLO ADINI DEĞİŞTİR
            .select('gorunum')
            .eq('kullanici_id', kullaniciId)
            .eq('sayfa', GORUNUM_SAYFA_ADI)
            .single()
            .then(({ data }) => {
                if (data?.gorunum) {
                    setColumns(data.gorunum);
                }
            });
    }, []);
    const gorunumuKaydet = async () => {
        const kullaniciId = parseInt(localStorage.getItem('kullaniciId'));
        if (!kullaniciId) return alert('❌ Kullanıcı bulunamadı!');

        const { error } = await supabase
            .from('kullanici_tamamlanan_gorunumleri')  // BURADA TABLO ADINI DEĞİŞTİR
            .upsert(
                {
                    kullanici_id: kullaniciId,
                    sayfa: GORUNUM_SAYFA_ADI,
                    gorunum: columns,
                },
                {
                    onConflict: ['kullanici_id', 'sayfa'],
                }
            );

        if (error) {
            console.error('Kaydetme hatası:', error);
            alert('❌ Kaydetme hatası oluştu.');
        } else {
            alert('✅ Görünüm kaydedildi.');
        }
    };



    useEffect(() => {
        const fetchData = async () => {
            const { data: seferData } = await supabase
                .from('tamamlanan_seferler')
                .select('*')
                .order('sefer_tarihi', { ascending: false });

            const { data: detayData } = await supabase
                .from('tamamlanan_detaylar')
                .select('*')
                .order('nokta_sirasi', { ascending: true });

            setSeferler(seferData || []);
            setDetaylar(detayData || []);
        };

        fetchData();
    }, []);

    const toggleExpand = (seferNo) => {
        setExpanded((prev) => ({
            ...prev,
            [seferNo]: !prev[seferNo],
        }));
    };

    const getDetaylarForSefer = (seferNo) =>
        detaylar.filter((d) => d.sefer_no === seferNo);

    const handleFiltrele = () => {
        const { baslangic, bitis, seferNo, plaka } = filtre;

        if (!baslangic || !bitis) {
            alert("Lütfen başlangıç ve bitiş tarihlerini seçiniz.");
            setFiltreliSeferler([]);
            return;
        }

        const filtered = seferler.filter((s) => {
            const seferTarihi = s.sefer_tarihi?.toString().slice(0, 10);
            const tarihMatch = seferTarihi >= baslangic && seferTarihi <= bitis;
            const seferNoMatch = s.sefer_no?.toLowerCase().includes(seferNo.toLowerCase());
            const plakaMatch = s.plaka?.toLowerCase().includes(plaka.toLowerCase());
            return tarihMatch && seferNoMatch && plakaMatch;
        });

        setFiltreliSeferler(filtered);
    };

    const handleTemizle = () => {
        setFiltre({
            seferNo: '',
            plaka: '',
            baslangic: '',
            bitis: '',
        });
        setFiltreliSeferler([]);
    };

    const handleExcelExport = () => {
        if (filtreliSeferler.length === 0) {
            alert("Aktarılacak veri yok.");
            return;
        }

        const sheetData = [];

        // Başlıklar
        const seferHeader = [
            "Tür", "Sefer No", "Plaka", "Treyler", "Şoför", "TCKN", "Tel", "Müşteri",
            "Sipariş No", "Hizmet", "Proje", "Yükleme Noktası", "Yükleme İl/İlçe",
            "Teslim Noktası", "Teslim İl/İlçe", "İrsaliye", "Atayan",
            "Atama Tarihi", "Sefer Tarihi", "Durum", "Nokta"
        ];
        const detayHeader = [
            "", "", "Detay Proje", "Detay Yükleme Noktası", "Detay Yükleme İl", "Detay Yükleme İlçe",
            "Detay Yükleme Varış", "Detay Yükleme Çıkış", "Detay Teslim Noktası", "Detay Teslim İl",
            "Detay Teslim İlçe", "Detay Teslim Varış", "Detay Teslim Çıkış"
        ];

        sheetData.push(seferHeader);
        sheetData.push(detayHeader);

        filtreliSeferler.forEach(sefer => {
            sheetData.push([
                "SEFER",
                sefer.sefer_no,
                sefer.plaka,
                sefer.treyler,
                sefer.surucu_ad_soyad,
                sefer.surucu_tckn,
                sefer.surucu_telefon,
                sefer.musteri_adi,
                sefer.musteri_siparis_no,
                sefer.hizmet_adi,
                sefer.proje_adi,
                sefer.yukleme_noktasi,
                `${sefer.yukleme_ili} / ${sefer.yukleme_ilcesi}`,
                sefer.teslim_noktasi,
                `${sefer.teslim_ili} / ${sefer.teslim_ilcesi}`,
                sefer.irsaliye_no,
                sefer.atama_yapan_kullanici,
                new Date(sefer.atama_tarihi).toLocaleString(),
                new Date(sefer.sefer_tarihi).toLocaleDateString(),
                sefer.arac_statu,
                ""
            ]);

            const ilgiliDetaylar = detaylar.filter(d => d.sefer_no === sefer.sefer_no);
            ilgiliDetaylar.forEach(d => {
                sheetData.push([
                    "→ DETAY",
                    sefer.sefer_no,
                    d.proje_adi,
                    d.yukleme_noktasi,
                    d.yukleme_ili,
                    d.yukleme_ilcesi,
                    formatTarihSaat(d.yukleme_varis),
                    formatTarihSaat(d.yukleme_cikis),
                    d.teslim_noktasi,
                    d.teslim_ili,
                    d.teslim_ilcesi,
                    formatTarihSaat(d.teslim_varis),
                    formatTarihSaat(d.teslim_cikis)
                ]);
            });

            sheetData.push([]);
        });

        // Excel sayfası
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

        // Otomatik sütun genişliği
        worksheet["!cols"] = sheetData[0].map(() => ({ wch: 22 }));

        // Stil uygulama (manuel cell.styling)
        const headerStyle = {
            font: { bold: true },
            fill: { fgColor: { rgb: "BDD7EE" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
            },
        };

        const seferStyle = {
            font: { bold: true },
            fill: { fgColor: { rgb: "FCE4D6" } },
            border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
            },
        };

        const detayStyle = {
            font: { italic: true },
            fill: { fgColor: { rgb: "E2EFDA" } },
            border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
            },
        };

        // Stil uygulama
        const totalRows = sheetData.length;
        for (let row = 0; row < totalRows; row++) {
            const rowData = sheetData[row];
            for (let col = 0; col < rowData.length; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
                const cell = worksheet[cellRef];
                if (!cell) continue;

                // Başlıklar
                if (row === 0 || row === 1) {
                    cell.s = headerStyle;
                }
                // SEFER
                else if (rowData[0] === "SEFER") {
                    cell.s = seferStyle;
                }
                // DETAY
                else if (rowData[0] === "→ DETAY") {
                    cell.s = detayStyle;
                }
            }
        }

        // Workbook oluştur ve kaydet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Tamamlanan Seferler");

        const excelBuffer = XLSX.write(workbook, {
            bookType: "xlsx",
            type: "array",
            cellStyles: true,
        });

        const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
        saveAs(blob, "tamamlanan_seferler_stilli.xlsx");
    };

    const formatTarihSaat = (tarihStr) => {
        if (!tarihStr) return '-';
        const tarih = new Date(tarihStr);
        if (isNaN(tarih)) return '-';
        const gun = String(tarih.getDate()).padStart(2, '0');
        const ay = String(tarih.getMonth() + 1).padStart(2, '0');
        const yil = tarih.getFullYear();
        const saat = String(tarih.getHours()).padStart(2, '0');
        const dakika = String(tarih.getMinutes()).padStart(2, '0');
        return `${gun}.${ay}.${yil} ${saat}:${dakika}`;
    };

    const handleDragStart = (e, index) => {
        e.dataTransfer.setData('dragIndex', index);
    };

    const handleDrop = (e, dropIndex) => {
        const dragIndex = e.dataTransfer.getData('dragIndex');
        if (dragIndex === dropIndex) return;

        const newCols = [...columns];
        const [dragged] = newCols.splice(dragIndex, 1);
        newCols.splice(dropIndex, 0, dragged);
        setColumns(newCols);
    };

    const allowDrop = (e) => e.preventDefault();


    return (
        <div className="tamamlananlar-wrapper">
            <Helmet>
                <title>TAMAMLANAN SEFERLER</title>
            </Helmet>
            {/* 🔍 Filtre Paneli */}
            <div className="filtre-panel">
                <input
                    type="date"
                    value={filtre.baslangic}
                    onChange={(e) => setFiltre({ ...filtre, baslangic: e.target.value })}
                />
                <input
                    type="date"
                    value={filtre.bitis}
                    onChange={(e) => setFiltre({ ...filtre, bitis: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Sefer No"
                    value={filtre.seferNo}
                    onChange={(e) => setFiltre({ ...filtre, seferNo: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Plaka"
                    value={filtre.plaka}
                    onChange={(e) => setFiltre({ ...filtre, plaka: e.target.value })}
                />
                <button className="filtrele-btn" onClick={handleFiltrele}>Filtrele</button>
                <button
                    onClick={gorunumuKaydet}
                    style={{ marginLeft: 8, backgroundColor: 'red', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Görünümü Kaydet
                </button>


                <button className="temizle-btn" onClick={handleTemizle}>Temizle</button>
                <button className="excel-btn" onClick={handleExcelExport}>Excel'e Aktar</button>
            </div>

            {/* 📋 Tablolar */}
            <div className="tamamlananlar-table-wrapper">
            <table className="tamamlananlar-table">
                    <thead>
                        <tr>
                            <th></th>
                            {columns.map((col, index) => (
                                <th
                                    key={col.key}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={allowDrop}
                                    onDrop={(e) => handleDrop(e, index)}
                                    style={{ cursor: 'move' }}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>

                <tbody>
                    {filtreliSeferler.map((sefer) => (
                        <React.Fragment key={sefer.sefer_no}>
                            <tr>
                                <td>
                                    <button onClick={() => toggleExpand(sefer.sefer_no)}>
                                        {expanded[sefer.sefer_no] ? '−' : '+'}
                                    </button>
                                </td>
                                {columns.map((col) => {
                                    let value = sefer[col.key];

                                    if (col.key === 'il_ilce') {
                                        value = `${sefer.yukleme_ili} / ${sefer.yukleme_ilcesi}`;
                                    }
                                    if (col.key === 'teslim_il_ilce') {
                                        value = `${sefer.teslim_ili} / ${sefer.teslim_ilcesi}`;
                                    }
                                    if (col.key === 'atama_tarihi') {
                                        value = new Date(sefer.atama_tarihi).toLocaleString();
                                    }
                                    if (col.key === 'sefer_tarihi') {
                                        value = new Date(sefer.sefer_tarihi).toLocaleDateString();
                                    }

                                    return <td key={col.key}>{value}</td>;
                                })}

                            </tr>
                            {expanded[sefer.sefer_no] && (
                                <tr>
                                    <td colSpan="20">
                                        <table className="detaylar-subtable">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Proje</th>
                                                    <th>Yükleme Noktası</th>
                                                    <th>Yükleme İli</th>
                                                    <th>Yükleme İlçesi</th>
                                                    <th>Yükleme Varış</th>
                                                    <th>Yükleme Çıkış</th>
                                                    <th>Teslim Noktası</th>
                                                    <th>Teslim İli</th>
                                                    <th>Teslim İlçesi</th>
                                                    <th>Teslim Varış</th>
                                                    <th>Teslim Çıkış</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getDetaylarForSefer(sefer.sefer_no).map((d, i) => (
                                                    <tr key={i}>
                                                        <td>{d.nokta_sirasi}</td>
                                                        <td>{d.proje_adi}</td>
                                                        <td>{d.yukleme_noktasi}</td>
                                                        <td>{d.yukleme_ili}</td>
                                                        <td>{d.yukleme_ilcesi}</td>
                                                        <td>{formatTarihSaat(d.yukleme_varis)}</td>
                                                        <td>{formatTarihSaat(d.yukleme_cikis)}</td>
                                                        <td>{d.teslim_noktasi}</td>
                                                        <td>{d.teslim_ili}</td>
                                                        <td>{d.teslim_ilcesi}</td>
                                                        <td>{formatTarihSaat(d.teslim_varis)}</td>
                                                        <td>{formatTarihSaat(d.teslim_cikis)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
    );
};

export default Tamamlananlar;
