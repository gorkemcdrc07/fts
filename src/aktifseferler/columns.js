// src/aktifseferler/columns.js
import { Chip, Stack, Button, Tooltip, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/EditNote";
import { fromISOToCombined } from "./utils/datetime";

export default function buildColumns({ canEdit, canSeeETA, openETA, openEditor, COLORS }) {
    const txt = (f, t, w = 170) => ({ field: f, headerName: t, width: w, sortable: true });

    const etaCol = {
        field: "eta_varis", headerName: "ETA", width: 190,
        renderCell: (p) => fromISOToCombined(p.row.eta_varis || ""),
        sortComparator: (a, b) => new Date(a) - new Date(b),
    };
    const kalanCol = { field: "kalan_surus_dk", headerName: "Kalan (dk)", width: 120, align: "center", headerAlign: "center" };

    const actionsCol = {
        field: "actions", headerName: "İşlem", width: 160, sortable: false, filterable: false,
        renderCell: (p) => (
            <Stack direction="row" spacing={0.5}>
                {canSeeETA && <Button size="small" variant="outlined" onClick={() => openETA(p.row)}>ETA</Button>}
                {canEdit && (
                    <Tooltip title="Detayları Düzenle">
                        <IconButton size="small" onClick={() => openEditor(p.row)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                )}
            </Stack>
        ),
    };

    let cols = [
        {
            field: "reel_durum", headerName: "REEL DURUM", width: 150,
            renderCell: (p) => {
                const v = (p.row.reel_durum || "-");
                const color = v === "YENİ" ? "info" : "default";
                return <Chip label={v} size="small" color={color} sx={{ fontWeight: 700 }} />;
            }
        },
        { field: "nokta_sayisi", headerName: "NOKTA", width: 100, align: "center", headerAlign: "center" },
        txt("sefer_no", "Sefer No", 160),
        txt("statu", "Statü", 160),
        txt("plaka", "Plaka", 130),
        txt("musteri_adi", "Müşteri", 240),
        txt("proje_adi", "Proje", 240),
        {
            field: "sefer_tarihi", headerName: "Sefer Tarihi", width: 190,
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
            field: "kayit_zamani", headerName: "Kayıt Zamanı", width: 190,
            renderCell: (p) => fromISOToCombined(p.row.kayit_zamani || ""),
            sortComparator: (a, b) => new Date(a) - new Date(b),
        },
        {
            field: "atama_tarihi", headerName: "Atama Tarihi", width: 190,
            renderCell: (p) => fromISOToCombined(p.row.atama_tarihi || ""),
            sortComparator: (a, b) => new Date(a) - new Date(b),
        },
    ];

    if (canEdit || canSeeETA) cols = [actionsCol, ...cols];
    cols = [...cols, etaCol, kalanCol];
    return cols;
}
