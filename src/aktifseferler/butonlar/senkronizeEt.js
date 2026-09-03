// src/aktifseferler/butonlar/senkronizeEt.js
import React, { useCallback, memo } from "react";
import Button from "@mui/material/Button";
import SyncIcon from "@mui/icons-material/Sync";

import {
    syncFromTMS,
    fetchTamamlananNos,
    filterIncoming,
    upsertSeferler,
} from "../services"; // <— butonlar/../services (doğru seviye)

function SenkronizeEtButton({
    startDate,
    endDate,
    canSync,
    setLoading,
    setSuccessCount,
    setShowSuccess,
    setRows,
    setSnack,
    enrichRows,
}) {
    const onSync = useCallback(async () => {
        setLoading(true);
        try {
            const start = `${startDate || ""}T00:00:00`;

            const end = `${endDate || ""}T23:59:59`;

            const [incoming, completedSet] = await Promise.all([
                syncFromTMS({ start, end }),
                fetchTamamlananNos(start, end),
            ]);

            const filtreli = filterIncoming(incoming).filter(
                (item) => !completedSet.has((item?.DocumentNo ?? "").toString().trim())
            );

            const mapOrders = (orders, field) =>
                Array.isArray(orders)
                    ? orders
                        .filter((o) => o && typeof o === "object")
                        .map((o) => o[field] ?? "")
                        .filter(Boolean)
                        .join("; ")
                    : "";

            const temiz = filtreli.map((s) => {
                const tmsOrders = Array.isArray(s.TMSOrders) ? s.TMSOrders : [];
                return {
                    sefer_no: s?.DocumentNo?.trim() ?? "",
                    arac_statu: s?.VehicleStatus ?? "",
                    plaka: s?.PlateNumber ?? "",
                    treyler: s?.TrailerPlateNumber ?? "",
                    surucu_ad_soyad: s?.FullName ?? "",
                    surucu_tckn: s?.CitizenNumber ?? "",
                    surucu_telefon: s?.PhoneNumber ?? "",
                    musteri_adi: s?.CustomerFullTitle ?? "",
                    musteri_siparis_no: s?.CustomerOrderNumber ?? "",
                    hizmet_adi: s?.ServiceName ?? "",
                    proje_adi: mapOrders(tmsOrders, "ProjectName"),
                    yukleme_noktasi: mapOrders(tmsOrders, "PickupAddressCode"),
                    yukleme_ili: mapOrders(tmsOrders, "PickupCityName"),
                    yukleme_ilcesi: mapOrders(tmsOrders, "PickupCountyName"),
                    teslim_alan_firma: mapOrders(tmsOrders, "DeliveryCurrentAccountName"),
                    teslim_noktasi: mapOrders(tmsOrders, "DeliveryAddressCode"),
                    teslim_ili: mapOrders(tmsOrders, "DeliveryCityName"),
                    teslim_ilcesi: mapOrders(tmsOrders, "DeliveryCountyName"),
                    irsaliye_no: s?.TMSDespatchWaybillNumber ?? "",
                    sefer_tarihi: s?.DespatchDate ?? null,
                    atama_yapan_kullanici: s?.TMSDespatchCreatedBy ?? "",
                    atama_tarihi: s?.TMSDespatchCreatedDate ?? null,
                    kayit_zamani: new Date().toISOString(),
                    reel_durum: "YENİ",
                };
            });

            await upsertSeferler(temiz);

            setSuccessCount(temiz.length);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3500);

            setRows(enrichRows(temiz));
        } catch (e) {
            console.error(e);
            setSnack({ open: true, msg: "Senkronizasyon hatası.", severity: "error" });
        } finally {
            setLoading(false);
        }
    }, [
        startDate,
        endDate,
        setLoading,
        setSuccessCount,
        setShowSuccess,
        setRows,
        setSnack,
        enrichRows,
    ]);

    return (
        <Button
            variant="contained"
            startIcon={<SyncIcon />}
            onClick={onSync}
            disabled={!canSync}
        >
            Senkronize Et
        </Button>
    );
}

export default memo(SenkronizeEtButton);
