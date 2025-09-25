// src/panel/SeferDetayPanel.jsx
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Stack,
    Typography,
    IconButton,
    CircularProgress,
    Divider,
    Button,
    Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { DataGrid } from "@mui/x-data-grid";

/* tarih format helper */
const formatDateTR = (val) => {
    if (!val) return "";
    try {
        const d = new Date(val);
        if (isNaN(d)) return String(val);
        return d.toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return String(val);
    }
};

export default function SeferDetayPanel({ open, onClose, plaka }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!plaka) return;
        let alive = true;
        (async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from("seferler")
                .select(
                    "sefer_tarihi,sefer_no,plaka,proje_adi,yukleme_noktasi,yukleme_ili,yukleme_ilcesi,teslim_noktasi,teslim_ili,teslim_ilcesi,eta"
                )
                .or(`plaka.eq.${plaka},plaka.ilike.${plaka}-%`)
                .not("sefer_no", "ilike", "BOS%")
                .order("sefer_tarihi", { ascending: false });

            if (!alive) return;
            if (error) {
                console.error(error);
                setRows([]);
            } else {
                setRows((data || []).map((r, i) => ({ ...r, _id: i })));
            }
            setLoading(false);
        })();
        return () => {
            alive = false;
        };
    }, [plaka]);

    const columns = useMemo(
        () => [
            {
                field: "sefer_tarihi",
                headerName: "Sefer Tarihi",
                width: 130,
                renderCell: (p) => <>{formatDateTR(p.row?.sefer_tarihi)}</>,
            },
            { field: "sefer_no", headerName: "Sefer No", width: 140 },
            { field: "plaka", headerName: "Plaka", width: 120 },
            { field: "proje_adi", headerName: "Proje Adı", width: 180 },
            { field: "yukleme_noktasi", headerName: "Yükleme Noktası", width: 200 },
            { field: "yukleme_ili", headerName: "Yükleme İli", width: 140 },
            { field: "yukleme_ilcesi", headerName: "Yükleme İlçesi", width: 160 },
            { field: "teslim_noktasi", headerName: "Teslim Noktası", width: 200 },
            { field: "teslim_ili", headerName: "Teslim İli", width: 140 },
            { field: "teslim_ilcesi", headerName: "Teslim İlçesi", width: 160 },
            {
                field: "eta",
                headerName: "ETA",
                width: 130,
                renderCell: (p) => <>{formatDateTR(p.row?.eta)}</>,
            },
        ],
        []
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                >
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h6" fontWeight={800}>
                            Sefer Geçmişi
                        </Typography>
                        {plaka ? <Chip size="small" label={plaka} /> : null}
                    </Stack>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 2 }}>
                {loading ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                        <CircularProgress />
                        <Typography sx={{ mt: 1 }}>Yükleniyor…</Typography>
                    </Stack>
                ) : rows.length === 0 ? (
                    <Stack alignItems="center" sx={{ py: 4, opacity: 0.8 }}>
                        <Typography>Bu plakaya ait sefer bulunamadı.</Typography>
                    </Stack>
                ) : (
                    <Box sx={{ height: 520 }}>
                        <DataGrid
                            rows={rows}
                            getRowId={(r) => r._id}
                            columns={columns}
                            density="compact"
                            disableRowSelectionOnClick
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Kapat</Button>
            </DialogActions>
        </Dialog>
    );
}
