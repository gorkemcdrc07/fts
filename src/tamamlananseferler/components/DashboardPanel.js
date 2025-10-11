// src/tamamlananseferler/components/DashboardPanel.jsx
import React from "react";
import { Paper, Stack, Typography, Box, Divider, Chip, Tooltip } from "@mui/material";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar, XAxis, YAxis, Tooltip as RToolTip } from "recharts";

// Basit renkler (MUI temasıyla uyumlu, koyu arkaplanda hoş durur)
const COLORS = ["#4ade80", "#60a5fa", "#f87171"]; // Erken, Zamanında, Geç

/**
 * props:
 * - summary: { early: number, ontime: number, late: number, avgDelayMin: number, avgEarlyMin: number }
 * - lateBuckets: [{name:'0-30', value: 3}, ...]  // geç sefer dağılımı (dk)
 * - onFilter: (type: 'ALL'|'EARLY'|'ONTIME'|'LATE') => void
 * - dateRangeText: string
 * - totalCount: number
 */
export default function DashboardPanel({
    summary,
    lateBuckets,
    onFilter,
    dateRangeText,
    totalCount,
}) {
    const pieData = [
        { name: "Erken", value: summary?.early || 0 },
        { name: "Tam Zamanında", value: summary?.ontime || 0 },
        { name: "Geç", value: summary?.late || 0 },
    ];

    return (
        <Paper
            sx={{
                p: 1.5,
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
            }}
        >
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="stretch">
                {/* Sol: özet + chips */}
                <Stack spacing={1.25} sx={{ minWidth: 260 }}>
                    <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                        Tarih Aralığı
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>{dateRangeText}</Typography>

                    <Divider sx={{ my: 0.5, borderColor: "rgba(255,255,255,0.08)" }} />

                    <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                        Toplam Kayıt
                    </Typography>
                    <Typography variant="h5" fontWeight={800}>{totalCount}</Typography>

                    <Divider sx={{ my: 0.5, borderColor: "rgba(255,255,255,0.08)" }} />

                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                            label={`Erken: ${summary?.early || 0}`}
                            onClick={() => onFilter?.("EARLY")}
                            sx={{ bgcolor: "rgba(74,222,128,0.15)", color: "#4ade80" }}
                        />
                        <Chip
                            label={`Tam Zamanında: ${summary?.ontime || 0}`}
                            onClick={() => onFilter?.("ONTIME")}
                            sx={{ bgcolor: "rgba(96,165,250,0.15)", color: "#60a5fa" }}
                        />
                        <Chip
                            label={`Geç: ${summary?.late || 0}`}
                            onClick={() => onFilter?.("LATE")}
                            sx={{ bgcolor: "rgba(248,113,113,0.15)", color: "#f87171" }}
                        />
                        <Chip label="Tümü" onClick={() => onFilter?.("ALL")} />
                    </Stack>

                    <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                        <Tooltip title="Geç varışların dakika cinsinden ortalaması">
                            <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                Ortalama Gecikme: <b>{Math.round(summary?.avgDelayMin || 0)} dk</b>
                            </Typography>
                        </Tooltip>
                        <Tooltip title="Erken varışların dakika cinsinden ortalaması">
                            <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                Ortalama Erken Varış: <b>{Math.round(summary?.avgEarlyMin || 0)} dk</b>
                            </Typography>
                        </Tooltip>
                    </Stack>
                </Stack>

                {/* Orta: Pasta grafiği */}
                <Box sx={{ flex: 1, minWidth: 260, height: 220 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                onClick={(e) => {
                                    if (e?.name === "Erken") onFilter?.("EARLY");
                                    else if (e?.name === "Tam Zamanında") onFilter?.("ONTIME");
                                    else if (e?.name === "Geç") onFilter?.("LATE");
                                }}
                            >
                                {pieData.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Pie>
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </Box>

                {/* Sağ: Geç dağılım bar chart */}
                <Box sx={{ flex: 1, minWidth: 300, height: 220 }}>
                    <ResponsiveContainer>
                        <BarChart data={lateBuckets}>
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <RToolTip />
                            <Bar dataKey="value" onClick={() => onFilter?.("LATE")} />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            </Stack>
        </Paper>
    );
}
