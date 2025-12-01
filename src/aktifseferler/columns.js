import {
    Chip,
    Stack,
    Tooltip,
    IconButton,
    Box,
    Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/EditNote";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle"; // <<< EKLENDİ
import { fromISOToCombined } from "./utils/datetime";

export default function buildColumns({
    openEtaEditor,
    openEditor,
    onDeleteRow,
    COLORS,
    perms,
    userOrder = [],
}) {
    const { loading = false, mayOpenEdit = false, canEdit = false, canDelete = false } = perms || {};

    const txt = (f, t, w = 170) => ({
        field: f,
        headerName: t,
        width: w,
        sortable: true,
    });

    const actionsCol = {
        field: "actions",
        headerName: "İşlem",
        width: 230, // biraz genişlettim (ikon eklendi)
        sortable: false,
        filterable: false,
        renderCell: (p) => {
            const etaKalan = p.row?.eta_kalan_surus;
            const hasEtaKalan =
                etaKalan !== null &&
                etaKalan !== undefined &&
                !Number.isNaN(Number(etaKalan));

            return (
                <Stack direction="row" spacing={0.5} alignItems="center">
                    {/* ETA girildi rozeti */}
                    {hasEtaKalan && (
                        <Tooltip title={`ETA girildi • Kalan sürüş: ${Number(etaKalan).toFixed(2)} saat`}>
                            <CheckCircleIcon fontSize="small" color="success" />
                        </Tooltip>
                    )}

                    <Tooltip title="ETA Düzenle">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => {
                                    openEtaEditor && openEtaEditor(p.row);
                                }}
                                disabled={loading || !canEdit}
                            >
                                <AccessTimeIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>

                    {(mayOpenEdit || canEdit || loading) && (
                        <Tooltip
                            title={
                                loading ? "Yükleniyor..." : canEdit ? "Detayları Düzenle" : "Düzenleme yetkiniz yok"
                            }
                        >
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={() => openEditor && openEditor(p.row)}
                                    disabled={loading || !canEdit}
                                >
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    )}

                    <Tooltip title={loading ? "Yükleniyor..." : canDelete ? "Kaydı Sil" : "Silme yetkiniz yok"}>
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => onDeleteRow && onDeleteRow(p.row)}
                                disabled={loading || !canDelete}
                            >
                                <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            );
        },
    };

    const calcStatus = (enter, exit) => {
        if (enter && exit) return { borderColor: "success.main", hint: "Giriş & Çıkış hazır" };
        if (enter && !exit) return { borderColor: "warning.main", hint: "Çıkış eksik" };
        if (!enter && exit) return { borderColor: "error.main", hint: "Giriş eksik" };
        return { borderColor: "error.main", hint: "Kayıt yok" };
    };

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
                    <Typography variant="caption" sx={{ fontWeight: 800, flex: "0 0 auto" }}>
                        {ozet.completed}/{ozet.total}
                    </Typography>

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
                            const enter = Boolean(n.teslim_varis ?? n.yukleme_varis ?? n.varis);
                            const exit = Boolean(n.teslim_cikis ?? n.yukleme_cikis ?? n.cikis);
                            const { borderColor, hint } = calcStatus(enter, exit);

                            const giris = n.teslim_varis ?? n.yukleme_varis ?? n.varis ?? null;
                            const cikis = n.teslim_cikis ?? n.yukleme_cikis ?? n.cikis ?? null;

                            const title = [
                                `Nokta ${i + 1} • ${hint}`,
                                `Giriş: ${giris ? fromISOToCombined(giris) : "—"}`,
                                `Çıkış: ${cikis ? fromISOToCombined(cikis) : "—"}`,
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

                                        <Stack direction="row" spacing={1} alignItems="center">
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

    const ilkNoktaKmCol = {
        field: "ilk_nokta_km",
        headerName: "İlk Noktanın KM",
        width: 150,
        renderCell: (p) => p.row.ilk_nokta_km ?? "",
    };

    const noteCol = {
        field: "_note",
        headerName: "Açıklama Rozeti",
        width: 140,
        renderCell: () => <Chip size="small" label="—" />,
    };

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
        noktaKayitBilgisiCol,
        ilkNoktaKmCol,
        actionsCol,
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
        txt("bolge", "Bölge", 160),


        // >>> ETA VARIŞ SÜTUNU
        {
            field: "eta_varis",
            headerName: "ETA Varış",
            width: 210,
            renderCell: (p) => {
                const v = p.row.eta_varis;
                if (typeof v === "string" && v.toLowerCase().includes("yükleme çıkış")) {
                    return <Chip color="warning" size="small" label={v} sx={{ fontWeight: 700 }} />;
                }
                return fromISOToCombined(v || "") || "—";
            },
            sortComparator: (a, b) => new Date(a) - new Date(b),
        },

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
        noteCol,
    ];

    // Kullanıcı özel sıralaması varsa uygula
    let all = [...baseCols];
    if (Array.isArray(userOrder) && userOrder.length) {
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
