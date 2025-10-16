// src/aktifseferler/ETAHesabi.js
import React, { useMemo, useState } from "react";
import { BREAK_OPTIONS, computeRowETA, parseHHMMtoMin, ETA_STATUS, ETA_MESSAGES } from "./utils/eta";
import EtaDialog from "./EtaDialog";

/**
 * Props:
 * - open: boolean
 * - onClose: fn()
 * - row: sefer satırı (içinde sefer_detaylari[0].yukleme_cikis, mesafe_km vs. olabilir)
 * - onSave: fn(payload)  -> DB'ye yazmayı sen burada yaparsın
 * - mayOpenETA: boolean  -> izin
 * - canETA: boolean      -> izin
 * - COLORS, DateTimeOneField, makeGlam vs. mevcut projendeki gibi forward edebilirsin
 */
export default function ETAHesabi({
    open,
    onClose,
    row: etaRow,
    onSave,
    mayOpenETA = true,
    canETA = true,
    COLORS,
    DateTimeOneField,
}) {
    // Kullanıcı girişleri
    const [driveHM, setDriveHM] = useState("04:30"); // kalansürüş default
    const [breakSel, setBreakSel] = useState(0);     // başlangıç molası

    // Görseller/başlıklar
    const vehicleText = useMemo(() => {
        const plak = etaRow?.plaka || "-";
        const trey = etaRow?.treyler ? ` • Treyler: ${etaRow.treyler}` : "";
        return `${plak}${trey}`;
    }, [etaRow]);

    const driverText = useMemo(() => etaRow?.surucu_ad_soyad || "-", [etaRow]);
    const jobText = useMemo(() => etaRow?.is_ozeti || etaRow?.musteri_adi || "-", [etaRow]);
    const originText = useMemo(() => etaRow?.yukleme_yeri || etaRow?.yukleme_adresi || "-", [etaRow]);
    const destinationText = useMemo(() => etaRow?.teslim_yeri || etaRow?.teslim_adresi || "-", [etaRow]);

    // Mesafe bilgisini bilgi notu olarak göster
    const etaDistanceInfo = useMemo(() => {
        const km = etaRow?.mesafe_km ?? etaRow?.mesafe_km_num;
        if (!km) return null;
        const safMin = Math.round((Number(km) / 65) * 60);
        const h = Math.floor(safMin / 60), m = safMin % 60;
        return `${km} km • saf sürüş ~ ${h} saat ${String(m).padStart(2, "0")} dk @ 65 km/s`;
    }, [etaRow]);

    // Hesap
    const computedETAISO = useMemo(() => {
        const remainMin = parseHHMMtoMin(driveHM || "04:30");
        const res = computeRowETA(etaRow, {
            distanceKm: parseFloat(etaRow?.mesafe_km_num ?? etaRow?.mesafe_km) || undefined,
            startBreakMin: breakSel || 0,
            initialRemainMin: remainMin,
            speedKmh: 65,
        });

        if (res.status === ETA_STATUS.WAITING_FIRST_YC) return "__WAITING__";
        if (res.status === ETA_STATUS.NEED_DISTANCE) return "__NEED_DISTANCE__";
        if (res.status !== ETA_STATUS.OK) return null;
        return res.etaISO;
    }, [etaRow, driveHM, breakSel]);

    const fromISOToCombined = (iso) => {
        if (!iso || typeof iso !== "string") return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        const pad = (n) => String(n).padStart(2, "0");
        const dd = pad(d.getDate());
        const MM = pad(d.getMonth() + 1);
        const yyyy = d.getFullYear();
        const hh = pad(d.getHours());
        const mm = pad(d.getMinutes());
        return `${dd}.${MM}.${yyyy} ${hh}:${mm}`;
    };

    // ETA metin kopyalama
    const copyETA = () => {
        const text =
            computedETAISO === "__WAITING__"
                ? ETA_MESSAGES[ETA_STATUS.WAITING_FIRST_YC]
                : computedETAISO === "__NEED_DISTANCE__"
                    ? ETA_MESSAGES[ETA_STATUS.NEED_DISTANCE]
                    : fromISOToCombined(computedETAISO) || "-";
        navigator.clipboard?.writeText(text).catch(() => { });
    };

    // Kaydet – DB'ye yazmayı parent'a bırakıyoruz
    const saveETA = () => {
        const remainMin = parseHHMMtoMin(driveHM || "04:30");

        const waitingFirstYC = computedETAISO === "__WAITING__";
        const needDistance = computedETAISO === "__NEED_DISTANCE__";

        const payload = {
            // hesap girdileri
            kalan_surus_dk: remainMin,
            eta_mola_dk: breakSel || 0,

            // çıktı / durum
            eta_iso: waitingFirstYC || needDistance ? null : computedETAISO,
            eta_status: waitingFirstYC
                ? ETA_STATUS.WAITING_FIRST_YC
                : needDistance
                    ? ETA_STATUS.NEED_DISTANCE
                    : ETA_STATUS.OK,
            eta_note: waitingFirstYC
                ? ETA_MESSAGES[ETA_STATUS.WAITING_FIRST_YC]
                : needDistance
                    ? ETA_MESSAGES[ETA_STATUS.NEED_DISTANCE]
                    : null,

            // istersen burada sefer_id gibi kimlik alanlarını da geçir
            sefer_id: etaRow?.id ?? null,
        };

        onSave?.(payload);
    };

    // YENİ: İlk noktanın yukleme_cikis değerini prop olarak çıkar
    const latestYuklemeCikis =
        etaRow?.sefer_detaylari?.[0]?.yukleme_cikis ?? null;

    return (
        <EtaDialog
            open={open}
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
            driveHM={driveHM}
            setDriveHM={setDriveHM}
            breakSel={breakSel}
            setBreakSel={setBreakSel}
            computedETAISO={computedETAISO}
            fromISOToCombined={fromISOToCombined}
            copyETA={copyETA}
            saveETA={saveETA}
            mayOpenETA={mayOpenETA}
            canETA={canETA}
            latestYuklemeCikis={latestYuklemeCikis}
        />
    );
}
