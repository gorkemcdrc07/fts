import React from "react";
import { Button } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import * as XLSX from "xlsx";

/*
 * ExcelAktarim component
 * Kullanım:
 * <ExcelAktarim rows={filtered} filename="aktif_seferler.xlsx" />
 */
export default function ExcelAktarim({ rows = [], filename = "aktif_seferler.xlsx" }) {
    const exportToExcel = () => {
        try {
            if (!rows.length) {
                alert("Aktarılacak veri bulunamadı.");
                return;
            }

            // --- JSON -> Worksheet ---
            const ws = XLSX.utils.json_to_sheet(rows);

            // --- Workbook oluştur ---
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Seferler");

            // --- Kaydet ---
            XLSX.writeFile(wb, filename);
        } catch (err) {
            console.error("Excel aktarım hatası:", err);
            alert("Excel aktarımında hata oluştu.");
        }
    };

    return (
        <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={exportToExcel}
        >
            Excel'e Aktar
        </Button>
    );
}
