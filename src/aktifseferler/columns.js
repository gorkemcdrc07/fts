import {
    Chip,
    Stack,
    Button,
    Tooltip,
    IconButton,
    Box,
    Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/EditNote";
import { fromISOToCombined } from "./utils/datetime";

/**
 * buildColumns({ openETA, openEditor, COLORS, perms, userOrder, hasUserOrder })
 * perms: { loading, mayOpenETA, canETA, mayOpenEdit, canEdit }
 */
export default function buildColumns({
    openETA,
    openEditor,
    COLORS,
    perms,
    userOrder = [],
    hasUserOrder = false,
}) {
    const {
        loading = false,
        mayOpenETA = false,
        canETA = false,
        mayOpenEdit = false,
        canEdit = false,
    } = perms || {};

    // Basit metin kolonu helper
    const txt = (f, t, w = 170) => ({ field: f, headerName: t, width: w, sortable: true });

    // ETA
    const etaCol = {
        field: "eta_varis",
        headerName: "ETA",
        width: 190,
        renderCell: (p) => p.row.eta_note || fromISOToCombined(p.row.eta_varis || ""),
        sortComparator: (a, b) => new Date(a) - new Date(b),
    };

    // Kalan sürüş
    const kalanCol = {
        field: "kalan_surus_dk",
        headerName: "Kalan (dk)",
        width: 120,
        align: "center",
        headerAlign: "center",
    };

    // İşlem
    const actionsCol = {
        field: "actions",
        headerName: "İşlem",
        width: 160,
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
                    <Tooltip title={loading ? "Yükleniyor..." : canEdit ? "Detayları Düzenle" : "Düzenleme yetkiniz yok"}>
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

    // Durum hesaplama
    const calcStatus = (enter, exit) => {
        if (enter && exit) return { borderColor: "success.main", hint: "Giriş & Çıkış hazır" };
        if (enter && !exit) return { borderColor: "warning.main", hint: "Çıkış eksik" };
        if (!enter && exit) return { borderColor: "error.main", hint: "Giriş eksik" };
        return { borderColor: "error.main", hint: "Kayıt yok" };
    };

    // Daha anlaşılır: 1 G✓ Ç– biçiminde kapsüller
    const noktaKayitBilgisiCol = {
        field: "nokta_kayit_bilgisi",
        headerName: "Nokta Kayıt Bilgisi",
        width: 460,
        sortable: false,
        filterable: false,
        renderCell: (p) => {
            const noktalar = p.row.noktalar || [];
            const ozet = p.row.nokta_ozet || { total: noktalar.length, completed: 0 };

            if (noktalar.length === 0) {
                return <Chip label="Nokta bilgisi yok" size="small" color="default" />;
            }

            return (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        minWidth: 0,
                        width: "100%",
                    }}
                >
                    {/* sayaç */}
                    <Typography variant="caption" sx={{ fontWeight: 800, flex: "0 0 auto" }}>
                        {ozet.completed}/{ozet.total}
                    </Typography>

                    {/* kapsüller: tek satır ve yatay kaydırılabilir */}
                    <Box
                        sx={{
                            display: "flex",
                            gap: 0.5,
                            overflowX: "auto",
                            overflowY: "hidden",
                            flex: "1 1 auto",
                        }}
                    >
                        {noktalar.map((n, i) => {
                            const enter = Boolean(n.teslim_varis);
                            const exit = Boolean(n.teslim_cikis);
                            const { borderColor, hint } = calcStatus(enter, exit);

                            const title = [
                                `Nokta ${i + 1} • ${hint}`,
                                `Giriş: ${enter ? fromISOToCombined(n.teslim_varis) : "—"}`,
                                `Çıkış: ${exit ? fromISOToCombined(n.teslim_cikis) : "—"}`,
                            ].join(" • ");

                            return (
                                <Tooltip key={i} title={title}>
                                    <Box
                                        sx={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 0.75,
                                            border: "1px solid",
                                            borderColor,
                                            borderRadius: 1.25,
                                            px: 0.75,
                                            py: 0.25,
                                            bgcolor: "transparent",
                                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                        }}
                                    >
                                        <Typography sx={{ fontSize: 11, fontWeight: 800 }}>{i + 1}</Typography>
                                        <Stack direction="row" spacing={1}>
                                            <Typography sx={{ fontSize: 11 }}>G{enter ? "✓" : "–"}</Typography>
                                            <Typography sx={{ fontSize: 11 }}>Ç{exit ? "✓" : "–"}</Typography>
                                        </Stack>
                                    </Box>
                                </Tooltip>
                            );
                        })}
                    </Box>
                </Box>
            );
        },
    };

    // Çekirdek kolonlar
    let baseCols = [
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

        // Yeni görünüm
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

        // (Varsa) kayıt zamanları
        {
            field: "yukleme_kayit_zamani",
            headerName: "Yükleme Kayıt Zm.",
            width: 190,
            renderCell: (p) => fromISOToCombined(p.row.yukleme_kayit_zamani || ""),
            sortComparator: (a, b) => new Date(a) - new Date(b),
        },
        {
            field: "teslim_kayit_zamani",
            headerName: "Teslim Kayıt Zm.",
            width: 190,
            renderCell: (p) => fromISOToCombined(p.row.teslim_kayit_zamani || ""),
            sortComparator: (a, b) => new Date(a) - new Date(b),
        },

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

    // Tüm kolonlar
    let all = [actionsCol, ...baseCols, etaCol, kalanCol];

    // Kullanıcı sırası varsa uygula
    if (hasUserOrder && Array.isArray(userOrder) && userOrder.length) {
        const byId = new Map(all.map((c) => [c.field, c]));
        const picked = [];
        userOrder.forEach((id) => {
            const col = byId.get(id);
            if (col) {
                picked.push(col);
                byId.delete(id);
            }
        });
        all = [...picked, ...Array.from(byId.values())];
    }

    return all;
}
