import React, { useEffect, useState } from "react";
import {
    Table, TableHead, TableRow, TableCell,
    TableBody, Paper, CircularProgress, Typography, Chip
} from "@mui/material";
import { supabase } from "../supabaseClient";
import dayjs from "dayjs";

export default function AracEtalari() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);

        // 1) Aktif seferler (TAMAMLANDI olmayanlar)
        const { data: seferler, error } = await supabase
            .from("seferler")
            .select("*")
            .not("arac_statu", "eq", "TAMAMLANDI");

        if (error) {
            console.error("Seferler hatası:", error);
            setLoading(false);
            return;
        }

        // Her sefer için sefer_detaylari verisini çek
        const mergedRows = await Promise.all(
            seferler.map(async (row) => {
                const { data: detay } = await supabase
                    .from("sefer_detaylari")
                    .select("kalan_surus_suresi")
                    .eq("sefer_no", row.sefer_no)
                    .maybeSingle();

                return {
                    ...row,
                    kalan_surus_suresi: detay?.kalan_surus_suresi ?? null,
                };
            })
        );

        // 3) Plaka bazlı en son seferi seç
        const latestByPlaka = {};

        mergedRows.forEach((row) => {
            const plaka = row.plaka;
            if (!plaka) return;

            const tarih =
                row.sefer_tarihi ||
                row.yukleme_cikis ||
                row.yukleme_varis ||
                row.teslim_varis ||
                row.teslim_cikis;

            if (!tarih) return;

            if (!latestByPlaka[plaka]) {
                latestByPlaka[plaka] = row;
            } else {
                const prevTime = dayjs(latestByPlaka[plaka].sefer_tarihi);
                const newTime = dayjs(tarih);
                if (newTime.isAfter(prevTime)) {
                    latestByPlaka[plaka] = row;
                }
            }
        });

        setRows(Object.values(latestByPlaka));
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Aktif Araç ETAları — En Son Sefer + Kalan Sürüş Süresi
            </Typography>

            {loading ? (
                <CircularProgress />
            ) : (
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell><b>Plaka</b></TableCell>
                            <TableCell>Sefer No</TableCell>
                            <TableCell>Yükleme Noktası</TableCell>
                            <TableCell>Teslim Noktası</TableCell>
                            <TableCell>Kalan Sürüş (dk)</TableCell>
                            <TableCell>Durum</TableCell>
                            <TableCell>Son Tarih</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {rows.map((r, i) => (
                            <TableRow key={i}>
                                <TableCell>{r.plaka}</TableCell>
                                <TableCell>{r.sefer_no}</TableCell>
                                <TableCell>{r.yukleme_noktasi}</TableCell>
                                <TableCell>{r.teslim_noktasi}</TableCell>

                                {/* Kalan Sürüş Süresi (sefer_detaylari) */}
                                <TableCell>
                                    {r.kalan_surus_suresi != null ? (
                                        <Chip
                                            label={`${r.kalan_surus_suresi} dk`}
                                            color="primary"
                                            size="small"
                                        />
                                    ) : (
                                        "-"
                                    )}
                                </TableCell>

                                <TableCell>{r.arac_statu}</TableCell>

                                <TableCell>
                                    {dayjs(
                                        r.sefer_tarihi ||
                                        r.yukleme_cikis ||
                                        r.yukleme_varis ||
                                        r.teslim_varis ||
                                        r.teslim_cikis
                                    ).format("DD.MM.YYYY HH:mm")}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </Paper>
    );
}
