// src/aktifseferler/butonlar/listele.js
import React, { useCallback, memo } from "react";
import Button from "@mui/material/Button";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { fetchSeferler, fetchTamamlananNos } from "../services"; // butonlar/../services
import { isExcludedPlate } from "../utils/sefer";                 // butonlar/../utils/sefer

function ListeleButton({
    startDate,
    endDate,
    setLoading,
    setRows,
    setSnack,
    enrichRows,
}) {
    const onList = useCallback(async () => {
        setLoading(true);
        try {
            const rangeMin = `${startDate || ""}T00:00:00`;
            const rangeMax = `${endDate || ""}T23:59:59`;

            const [data, completedSet] = await Promise.all([
                fetchSeferler(rangeMin, rangeMax),
                fetchTamamlananNos(rangeMin, rangeMax),
            ]);

            const visible = (data || [])
                .filter((s) =>
                    (s.sefer_no || "").toString().trim().toUpperCase().startsWith("SFR")
                )
                .filter(
                    (s) => !completedSet.has((s.sefer_no ?? "").toString().trim())
                )
                .filter((s) => !isExcludedPlate(s.plaka));

            setRows(enrichRows(visible));
        } catch (e) {
            console.error(e);
            setSnack({
                open: true,
                msg: "Veri çekilirken hata oluştu.",
                severity: "error",
            });
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, setLoading, setRows, setSnack, enrichRows]);

    return (
        <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={onList}>
            Listele
        </Button>
    );
}

export default memo(ListeleButton);
