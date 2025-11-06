// src/aktifseferler/dialogs/ETAEditor.js

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Stack,
    TextField,
    Grid,
    Divider,
    Box,
    CircularProgress,
    Paper,
    Chip,
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DriveEtaIcon from "@mui/icons-material/DriveEta";

import { fromISOToCombined } from "../utils/datetime";

/* küçük satır gösterimi */
const InfoRow = ({ icon: Icon, label, value }) => (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        {Icon && <Icon fontSize="small" color="inherit" style={{ opacity: 0.85 }} />}
        <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 86 }}>
            {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-word" }}>
            {value ?? "—"}
        </Typography>
    </Stack>
);

/* ';' ile ayrılmış bir stringden ilk dolu parçayı al */
const firstToken = (v) => {
    if (v == null) return null;
    if (typeof v !== "string") return v;
    const parts = v.split(";").map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts[0] : (v.trim() === "" ? null : v);
};

/* "A; B; C / X; Y; Z" gibi karmaşık konum ifadelerinden yalnızca ilk il / ilk ilçe al */
const firstLocation = (raw) => {
    if (!raw && raw !== "") return null;
    if (typeof raw !== "string") return firstToken(raw);
    if (raw.includes("/")) {
        const [left, right] = raw.split("/").map((s) => s.trim());
        const leftFirst = firstToken(left);
        const rightFirst = firstToken(right);
        if (leftFirst && rightFirst) return `${leftFirst} / ${rightFirst}`;
        if (leftFirst) return leftFirst;
        if (rightFirst) return rightFirst;
        return null;
    }
    return firstToken(raw);
};

/* normalize yardımcı: küçük-büyük harf, trim (TÜRKÇE DESTEKLİ) */
const norm = (s) => (s == null ? null : String(s).trim().toLocaleLowerCase('tr-TR')); // <-- DÜZELTME BURADA

/* distance table lookup
 - mesafeler: array of items like:
   { yukleme_il: "İZMİR", yukleme_ilce: "KONAK", teslim_il: "KOCAELI", teslim_ilce: "DERİNCE", mesafe_km: 123.4 }
 - strategy: try full match (il+ilce -> il+ilce), then il+ilce -> il (if dest ilce missing), then il->il,
   then symmetrical (swap src/dst? usually not needed), returns first found.
*/
const findDistance = (mesafeler = [], srcIl, srcIlce, dstIl, dstIlce) => {

    // HATA AYIKLAMA 1: mesafeler dizisi dolu mu?
    console.log("findDistance çağrıldı, mesafeler dizisi:", mesafeler);

    if (!mesafeler || !mesafeler.length) return null;

    const sIl = norm(srcIl);
    const sIlce = norm(srcIlce);
    const dIl = norm(dstIl);
    const dIlce = norm(dstIlce);

    // helper to compare possibly-null normalized strings
    const eq = (a, b) => {
        if (a == null || b == null) return false;
        return a === b;
    };

    // 1) full exact: il+ilce -> il+ilce
    for (const row of mesafeler) {
        if (
            eq(norm(row.yukleme_il), sIl) &&
            eq(norm(row.yukleme_ilce), sIlce) &&
            eq(norm(row.teslim_il), dIl) &&
            eq(norm(row.teslim_ilce), dIlce)
        ) {
            return row;
        }
    }

    // 2) src il+ilce -> dst il only
    for (const row of mesafeler) {
        if (
            eq(norm(row.yukleme_il), sIl) &&
            eq(norm(row.yukleme_ilce), sIlce) &&
            eq(norm(row.teslim_il), dIl) &&
            (!row.teslim_ilce || row.teslim_ilce === "" || !dIlce)
        ) {
            return row;
        }
    }

    // 3) il -> il (ignore ilce)
    for (const row of mesafeler) {
        if (eq(norm(row.yukleme_il), sIl) && eq(norm(row.teslim_il), dIl)) {
            return row;
        }
    }

    // 4) flipped match (maybe table stores reversed src/dst)
    for (const row of mesafeler) {
        if (
            eq(norm(row.yukleme_il), dIl) &&
            eq(norm(row.yukleme_ilce), dIlce) &&
            eq(norm(row.teslim_il), sIl) &&
            eq(norm(row.teslim_ilce), sIlce)
        ) {
            return row;
        }
    }

    // 5) partial fallback: match src il to any row where teslim_il matches dstIlce or dstIl
    for (const row of mesafeler) {
        if (eq(norm(row.yukleme_il), sIl) && (eq(norm(row.teslim_il), dIl) || eq(norm(row.teslim_ilce), dIlce))) {
            return row;
        }
    }

    return null;
};

/* format sürüş süresi: km ve speed => "X saat Y dakika" */
const formatDuration = (distanceKm, speedKmh = 65) => {
    if (distanceKm == null || isNaN(distanceKm)) return null;
    const totalMinutes = Math.round((distanceKm / speedKmh) * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    if (hh <= 0) return `${mm} dk`;
    if (mm === 0) return `${hh} saat`;
    return `${hh} saat ${mm} dk`;
};

/**
 * ETAEditor
 * - ek prop: mesafeler (array) — mesafe tabloları
 * - speedKmh (opsiyonel) default 65
 */
export default function ETAEditor({
    open,
    onClose,
    sefer,
    ilkNokta,
    loading,
    mesafeler = [], // <-- parent bu prop'u vermeli
    speedKmh = 65,
}) {
    const [etaDatetime, setEtaDatetime] = useState("");
    const [etaNote, setEtaNote] = useState("");

    const effectiveIlkNokta = ilkNokta ?? (Array.isArray(sefer?.noktalar) ? sefer.noktalar[0] : null) ?? null;

    useEffect(() => {
        if (open) {
            console.log("ETAEditor opened. sefer:", sefer);
            console.log("prop ilkNokta:", ilkNokta);
            console.log("effectiveIlkNokta:", effectiveIlkNokta);
            if (effectiveIlkNokta) console.log("effectiveIlkNokta keys:", Object.keys(effectiveIlkNokta));
        }
    }, [open, sefer, ilkNokta, effectiveIlkNokta]);

    const pickSingle = (keys = []) => {
        const sources = [effectiveIlkNokta, sefer];
        for (const src of sources) {
            if (!src) continue;
            for (const k of keys) {
                const v = src[k];
                if (v != null && v !== "") return v;
            }
        }
        return null;
    };

    const renderContent = () => {
        if (loading) {
            return (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 240 }}>
                    <CircularProgress />
                </Box>
            );
        }

        const hasAny =
            effectiveIlkNokta ||
            pickSingle(["yukleme_noktasi", "teslim_noktasi", "yukleme_ili", "teslim_ili", "proje_adi"]);
        if (!hasAny) {
            return <Typography sx={{ p: 2, textAlign: "center" }}>Sefer detayları bulunamadı.</Typography>;
        }

        // PROJE
        const projeRaw = pickSingle(["proje_adi", "projeAdi", "project_name", "projectName", "proje", "project"]);
        const proje = firstToken(projeRaw);

        // Yükleme: il / ilçe
        const yuklemeIlFromNokta =
            effectiveIlkNokta?.yukleme_ili ?? effectiveIlkNokta?.il ?? effectiveIlkNokta?.city ?? null;
        const yuklemeIlceFromNokta =
            effectiveIlkNokta?.yukleme_ilcesi ?? effectiveIlkNokta?.ilce ?? effectiveIlkNokta?.district ?? null;

        const yuklemeIlFromSefer = sefer?.yukleme_ili ?? sefer?.yukleme_il ?? sefer?.yuklemeCity ?? null;
        const yuklemeIlceFromSefer = sefer?.yukleme_ilcesi ?? sefer?.yukleme_ilce ?? sefer?.yuklemeDistrict ?? null;

        const yuklemeNoktaRaw = pickSingle(["yukleme_noktasi", "yukleme_nokta", "nokta_adi", "name", "address"]);
        const yuklemeNokta = firstToken(yuklemeNoktaRaw);

        const yuklemeIl = yuklemeIlFromNokta ?? yuklemeIlFromSefer ?? firstToken(yuklemeNoktaRaw);
        const yuklemeIlce = yuklemeIlceFromNokta ?? yuklemeIlceFromSefer ?? null;
        const yuklemeKonum = firstLocation(yuklemeIl ? (yuklemeIlce ? `${yuklemeIl} / ${yuklemeIlce}` : yuklemeIl) : yuklemeNoktaRaw);

        const yuklemeVarisRaw = pickSingle(["yukleme_varis", "yukleme_varis_tarih", "yukleme_arrival", "varis", "arrival"]);
        const yuklemeCikisRaw = pickSingle(["yukleme_cikis", "yukleme_cikis_tarih", "yukleme_departure", "cikis", "departure"]);

        // Teslim: il / ilçe
        const teslimIlFromNokta =
            effectiveIlkNokta?.teslim_ili ?? effectiveIlkNokta?.il ?? effectiveIlkNokta?.city ?? null;
        const teslimIlceFromNokta =
            effectiveIlkNokta?.teslim_ilcesi ?? effectiveIlkNokta?.ilce ?? effectiveIlkNokta?.district ?? null;

        const teslimIlFromSefer = sefer?.teslim_ili ?? sefer?.teslim_il ?? sefer?.teslimCity ?? null;
        const teslimIlceFromSefer = sefer?.teslim_ilcesi ?? sefer?.teslim_ilce ?? sefer?.teslimDistrict ?? null;

        const teslimNoktaRaw = pickSingle(["teslim_noktasi", "teslim_nokta", "nokta_adi_teslim", "delivery_point"]);
        const teslimNokta = firstToken(teslimNoktaRaw);

        const teslimIl = teslimIlFromNokta ?? teslimIlFromSefer ?? firstToken(teslimNoktaRaw);
        const teslimIlce = teslimIlceFromNokta ?? teslimIlceFromSefer ?? null;
        const teslimKonum = firstLocation(teslimIl ? (teslimIlce ? `${teslimIl} / ${teslimIlce}` : teslimIl) : teslimNoktaRaw);

        const teslimVarisRaw = pickSingle(["teslim_varis", "teslim_varis_tarih", "teslim_arrival", "arrival"]);
        const teslimCikisRaw = pickSingle(["teslim_cikis", "teslim_cikis_tarih", "teslim_departure", "departure"]);

        // Mesafe arama

        // HATA AYIKLAMA 2: Fonksiyona hangi il/ilçe değerleri gidiyor?
        console.log("Mesafe Aranıyor:", { yuklemeIl, yuklemeIlce, teslimIl, teslimIlce });

        const found = findDistance(mesafeler, yuklemeIl, yuklemeIlce, teslimIl, teslimIlce);
        let mesafeKm = found ? (found.mesafe_km ?? found.mesafe ?? found.mesafeKm ?? null) : null;
        // bazen string gelebilir, normalize et
        if (mesafeKm != null && typeof mesafeKm === "string") {
            const parsed = parseFloat(mesafeKm.replace(",", ".").replace(/[^\d.-]/g, ""));
            mesafeKm = isNaN(parsed) ? null : parsed;
        }

        const sureStr = mesafeKm != null ? formatDuration(mesafeKm, speedKmh) : null;
        const mesafeLabel = mesafeKm != null ? `${mesafeKm} km` : "Mesafe bulunamadı";

        /* UI */
        return (
            <Stack spacing={2} sx={{ mt: 1 }}>
                <Paper elevation={0} sx={{ bgcolor: "background.paper", px: 2, py: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Stack spacing={0}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                ETA Düzenle: {sefer?.sefer_no ?? "—"}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <DriveEtaIcon fontSize="small" />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {sefer?.plaka ?? "—"}
                                </Typography>
                                <Chip label={sefer?.reel_durum ?? ""} size="small" sx={{ ml: 1 }} />
                            </Stack>
                        </Stack>

                        <Stack alignItems="flex-end">
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Kayıt: {fromISOToCombined(sefer?.kayit_zamani)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Atama: {sefer?.atama_yapan_kullanici ?? "—"}
                            </Typography>
                        </Stack>
                    </Stack>
                </Paper>

                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                        YÜKLEME
                                    </Typography>
                                </Stack>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    1. Nokta
                                </Typography>
                            </Stack>

                            <Divider sx={{ mb: 1 }} />

                            <InfoRow icon={CalendarMonthIcon} label="Proje" value={proje} />
                            <InfoRow icon={LocationOnIcon} label="Nokta" value={yuklemeNokta} />
                            <InfoRow icon={LocationOnIcon} label="Konum" value={yuklemeKonum} />

                            {/* Burada mesafe bilgisi gösteriliyor (sadece yükleme tarafında değil, genel) */}
                            <InfoRow
                                icon={DriveEtaIcon}
                                label="Mesafe"
                                value={mesafeKm != null ? `${mesafeKm} km — Tahmini sürüş süresi: ${sureStr} (≥ ${speedKmh} km/s)` : "Mesafe bulunamadı"}
                            />

                            <InfoRow icon={AccessTimeIcon} label="Giriş" value={fromISOToCombined(yuklemeVarisRaw)} />
                            <InfoRow icon={AccessTimeIcon} label="Çıkış" value={fromISOToCombined(yuklemeCikisRaw)} />
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                    TESLİM
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    Nokta
                                </Typography>
                            </Stack>

                            <Divider sx={{ mb: 1 }} />

                            <InfoRow icon={LocationOnIcon} label="Nokta" value={teslimNokta} />
                            <InfoRow icon={LocationOnIcon} label="Konum" value={teslimKonum} />
                            <InfoRow icon={AccessTimeIcon} label="Varış" value={fromISOToCombined(teslimVarisRaw)} />
                            <InfoRow icon={AccessTimeIcon} label="Çıkış" value={fromISOToCombined(teslimCikisRaw)} />
                        </Paper>
                    </Grid>
                </Grid>

                <Divider />

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                        Yeni ETA Girişi
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Yeni Tahmini Varış Zamanı"
                                type="datetime-local"
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                                value={etaDatetime}
                                onChange={(e) => setEtaDatetime(e.target.value)}
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Açıklama"
                                multiline
                                rows={2}
                                fullWidth
                                value={etaNote}
                                onChange={(e) => setEtaNote(e.target.value)}
                                size="small"
                            />
                        </Grid>
                    </Grid>
                </Paper>
            </Stack>
        );
    };

    const handleSave = () => {
        // parent'e callback ile kaydetme mantığı eklenebilir
        onClose && onClose();
    };

    return (
        <Dialog open={Boolean(open)} onClose={onClose} maxWidth="lg" fullWidth>
            {/* DialogTitle kaldırıldı çünkü başlık artık Paper içinde 
                (renderContent içinde) gösteriliyor. 
            */}
            <DialogContent>{renderContent()}</DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} variant="text">
                    Vazgeç
                </Button>
                <Button variant="contained" onClick={handleSave} disabled={loading}>
                    Kaydet
                </Button>
            </DialogActions>
        </Dialog>
    );
}
