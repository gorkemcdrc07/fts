// src/aktifseferler/columns.js
import { Chip, Stack, Button, Tooltip, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/EditNote";
import { fromISOToCombined } from "./utils/datetime";

/**
 * buildColumns({ openETA, openEditor, COLORS, perms })
 * perms: { loading, mayOpenETA, canETA, mayOpenEdit, canEdit }
 */
export default function buildColumns({ openETA, openEditor, COLORS, perms }) {
    const {
        loading = false,
        mayOpenETA = false,
        canETA = false,
        mayOpenEdit = false,
        canEdit = false,
    } = perms || {};

    // Standart metin sütunu tanımı yardımcı fonksiyonu
    const txt = (f, t, w = 170) => ({ field: f, headerName: t, width: w, sortable: true });

    // ETA Sütunu
    const etaCol = {
        field: "eta_varis",
        headerName: "ETA",
        width: 190,
        renderCell: (p) => p.row.eta_note || fromISOToCombined(p.row.eta_varis || ""),
        sortComparator: (a, b) => new Date(a) - new Date(b),
    };

    // Kalan Süre Sütunu
    const kalanCol = {
        field: "kalan_surus_dk",
        headerName: "Kalan (dk)",
        width: 120,
        align: "center",
        headerAlign: "center",
    };

    // İşlem (Actions) Sütunu
    const actionsCol = {
        field: "actions",
        headerName: "İşlem",
        width: 190,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
            <Stack direction="row" spacing={0.5} alignItems="center">
                {(loading || mayOpenETA) && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openETA(p.row)}
                        disabled={loading || !canETA}
                    >
                        ETA
                    </Button>
                )}

                {(loading || mayOpenEdit) && (
                    <Tooltip title={loading ? "Yükleniyor..." : (canEdit ? "Detayları Düzenle" : "Düzenleme yetkiniz yok")}>
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => openEditor(p.row)}
                                disabled={loading || !canEdit}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}
            </Stack>
        ),
    };

    // YENİ EKLENEN SÜTUN: Nokta Kayıt Bilgisi
    const noktaKayitBilgisiCol = {
        field: "nokta_kayit_bilgisi",
        headerName: "Nokta Kayıt Bilgisi",
        width: 350, // Yeterli genişlik
        sortable: false,
        filterable: false,
        renderCell: (p) => {
            // DİKKAT: Burada p.row.noktalar alanının, görseldeki gibi tüm nokta detaylarını
            // (teslim_giris, teslim_cikis) içeren bir dizi olduğu varsayılmıştır.
            const noktalar = p.row.noktalar || [];

            if (noktalar.length === 0) {
                return <Chip label="Nokta bilgisi yok" size="small" color="default" />;
            }

            return (
                <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto', paddingY: 0.5 }}>
                    {noktalar.map((nokta, index) => {
                        // Not: Alan adları görseldeki 'Teslim Giriş/Çıkış' alanlarına karşılık gelmelidir.
                        const girisDolu = !!nokta.teslim_giris;
                        const cikisDolu = !!nokta.teslim_cikis;
                        
                        let label = `${index + 1}.N: `;
                        let color = "success";
                        let title = "";

                        if (girisDolu && cikisDolu) {
                            label += "Tamamlandı";
                            title = `Nokta ${index + 1}: Giriş ve Çıkış tamamlandı.`;
                        } else if (girisDolu && !cikisDolu) {
                            label += "Çıkış Eksik";
                            color = "warning";
                            title = `Nokta ${index + 1}: Giriş var, Çıkış eksik.`;
                        } else if (!girisDolu && cikisDolu) {
                            label += "Giriş Eksik"; // Mantıksal olarak beklenmez ama
                            color = "error";
                            title = `Nokta ${index + 1}: Çıkış var, Giriş eksik.`;
                        } else {
                            label += "Kayıt Yok";
                            color = "error";
                            title = `Nokta ${index + 1}: Giriş ve Çıkış eksik.`;
                        }

                        return (
                            <Tooltip key={index} title={title}>
                                <Chip 
                                    label={label} 
                                    size="small" 
                                    color={color} 
                                    variant={color === "success" ? "filled" : "outlined"}
                                    sx={{ fontWeight: 700, minWidth: '90px' }}
                                />
                            </Tooltip>
                        );
                    })}
                </Stack>
            );
        },
    };

    let cols = [
        {
            field: "reel_durum",
            headerName: "REEL DURUM",
            width: 150,
            renderCell: (p) => {
                const v = p.row.reel_durum || "-";
                const color = v === "YENİ" ? "info" : "default";
                return <Chip label={v} size="small" color={color} sx={{ fontWeight: 700 }} />;
            },
        },
        { field: "nokta_sayisi", headerName: "NOKTA", width: 100, align: "center", headerAlign: "center" },
        // Yeni sütunu buraya ekledik.
        noktaKayitBilgisiCol, 
        
        txt("sefer_no", "Sefer No", 160),
        txt("statu", "Statü", 160),
        txt("plaka", "Plaka", 130),
        txt("musteri_adi", "Müşteri", 240),
        txt("proje_adi", "Proje", 240),
        {
            field: "sefer_tarihi",
            headerName: "Sefer Tarihi",
            width: 190,
            renderCell: (p) => fromISOToCombined(p.row.sefer_tarihi || ""),
            sortComparator: (a, b) => new Date(a) - new Date(b),
        },
        txt("atama_yapan_kullanici", "Atayan", 170),
        txt("arac_statu", "Araç Statü", 210),
        txt("yukleme_ili", "Yükleme İl", 160),
        txt("yukleme_ilcesi", "Yükleme İlçe", 160),
        txt("teslim_ili", "Teslim İl", 160),
        txt("teslim_ilcesi", "Teslim İlçe", 160),
        txt("treyler", "Treyler", 160),
        txt("surucu_ad_soyad", "Sürücü", 200),
        txt("surucu_tckn", "TC", 150),
        txt("surucu_telefon", "Telefon", 170),
        txt("musteri_siparis_no", "Sipariş No", 190),
        txt("hizmet_adi", "Hizmet", 190),
        txt("yukleme_noktasi", "Yükleme Noktası", 280),
        txt("teslim_noktasi", "Teslim Noktası", 280),
        txt("irsaliye_no", "İrsaliye No", 170),
        {
            field: "kayit_zamani",
            headerName: "Kayıt Zamanı",
            width: 190,
            renderCell: (p) => fromISOToCombined(p.row.kayit_zamani || ""),
            sortComparator: (a, b) => new Date(a) - new Date(b),
        },
        {
            field: "atama_tarihi",
            headerName: "Atama Tarihi",
            width: 190,
            renderCell: (p) => fromISOToCombined(p.row.atama_tarihi || ""),
            sortComparator: (a, b) => new Date(a) - new Date(b),
        },
    ];

    // İşlem başa, ETA/Kalan sona
    cols = [actionsCol, ...cols, etaCol, kalanCol];

    return cols;
}
