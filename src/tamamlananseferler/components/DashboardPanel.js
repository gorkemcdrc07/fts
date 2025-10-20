// src/tamamlananseferler/components/DashboardPanel.jsx
import React from "react";
import { Paper, Stack, Typography, Box, Divider, Chip, Tooltip, useTheme } from "@mui/material";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar, XAxis, YAxis, Tooltip as RToolTip, CartesianGrid } from "recharts";
import { QueryStats, AccessTimeFilled, TrendingUp, TrendingDown } from "@mui/icons-material";

// Renkler - Yeni, daha derin ve uyumlu bir palet
const COLORS = ["#10b981", "#3b82f6", "#f43f5e"]; // Yeşil (Başarılı), Mavi (On Time), Kırmızı (Geç)

// Özelleştirilmiş Recharts Tooltip Component
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <Box sx={{ p: 1, backgroundColor: 'rgba(30, 41, 59, 0.9)', border: '1px solid #475569', borderRadius: 1 }}>
                <Typography variant="body2" color="#e2e8f0">{label}:</Typography>
                <Typography variant="body1" fontWeight={600} color={payload[0].fill || payload[0].color}>
                    {payload[0].value} Adet
                </Typography>
            </Box>
        );
    }
    return null;
};

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
    const theme = useTheme();
    const pieData = [
        { name: "Erken", value: summary?.early || 0 },
        { name: "Tam Zamanında", value: summary?.ontime || 0 },
        { name: "Geç", value: summary?.late || 0 },
    ];

    // Geç Dağılım grafiği için renk, gecikme arttıkça kırmızıya yaklaşacak
    const barColor = (index) => {
        if (index === 0) return "#facc15"; // 0-30 dk için sarımsı
        if (index < 3) return "#fb923c"; // Orta gecikme için turuncu
        return "#f43f5e"; // Yüksek gecikme için kırmızı
    };

    const SummaryCard = ({ title, value, icon, color, tooltip, onClick }) => (
        <Tooltip title={tooltip}>
            <Paper
                onClick={onClick}
                sx={{
                    p: 2,
                    borderRadius: 2.5,
                    cursor: onClick ? 'pointer' : 'default',
                    flexGrow: 1,
                    minWidth: 150,
                    transition: '0.3s',
                    border: `1px solid ${color}`,
                    background: `linear-gradient(145deg, ${theme.palette.background.paper} 0%, rgba(20, 20, 40, 0.6) 100%)`,
                    boxShadow: `0 4px 15px rgba(0,0,0,0.3), 0 0 10px ${color}1A`,
                    '&:hover': {
                        transform: onClick ? 'translateY(-2px)' : 'none',
                        boxShadow: onClick ? `0 6px 20px ${color}40` : 'inherit',
                    }
                }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">{title}</Typography>
                    {React.cloneElement(icon, { sx: { color: color, fontSize: 24 } })}
                </Stack>
                <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                    {value}
                </Typography>
            </Paper>
        </Tooltip>
    );

    return (
        <Paper
            sx={{
                p: 3, // Daha fazla padding
                borderRadius: 4, // Daha yuvarlak köşeler
                // Derinlik ve Işık Efekti
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(10, 18, 35, 0.7)",
                backdropFilter: "blur(8px)",
                boxShadow: `0 10px 30px rgba(0,0,0,0.5)`,
            }}
        >
            {/* Üst Kısım: Tarih Aralığı ve Genel Özet */}
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} mb={3}>
                <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#E2E8F0' }}>
                        Performans Paneli
                    </Typography>
                    <Typography variant="subtitle2" color="text.secondary">
                        {dateRangeText} aralığındaki operasyonel sonuçlar
                    </Typography>
                </Box>
                <Chip
                    label={`Toplam Sefer: ${totalCount}`}
                    icon={<QueryStats />}
                    onClick={() => onFilter?.("ALL")}
                    sx={{
                        mt: { xs: 1.5, sm: 0 },
                        bgcolor: '#1e293b',
                        color: '#94a3b8',
                        fontWeight: 600
                    }}
                />
            </Stack>

            <Divider sx={{ mb: 3, borderColor: "rgba(255,255,255,0.1)" }} />

            <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="stretch">

                {/* 1. Özet Kartları ve Ortalamalar (Sol Kolon) */}
                <Stack spacing={2} sx={{ minWidth: 300, flex: 1 }}>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap">
                        <SummaryCard
                            title="Erken Varış"
                            value={summary?.early || 0}
                            icon={<TrendingUp />}
                            color={COLORS[0]}
                            tooltip={`Ortalama ${Math.round(summary?.avgEarlyMin || 0)} dk erken`}
                            onClick={() => onFilter?.("EARLY")}
                        />
                        <SummaryCard
                            title="Tam Zamanında"
                            value={summary?.ontime || 0}
                            icon={<AccessTimeFilled />}
                            color={COLORS[1]}
                            tooltip="ETA'dan +/- 5 dk içinde tamamlanan seferler"
                            onClick={() => onFilter?.("ONTIME")}
                        />
                        <SummaryCard
                            title="Geç Varış"
                            value={summary?.late || 0}
                            icon={<TrendingDown />}
                            color={COLORS[2]}
                            tooltip={`Ortalama ${Math.round(summary?.avgDelayMin || 0)} dk gecikme`}
                            onClick={() => onFilter?.("LATE")}
                        />
                    </Stack>

                    {/* Gecikme Ortalamaları */}
                    <Box sx={{ p: 2, borderRadius: 2, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <Typography variant="body1" fontWeight={600} mb={1} sx={{ color: '#A78BFA' }}>
                            Performans Özet Ortalamaları
                        </Typography>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Ort. Gecikme (Geç Seferler)</Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ color: COLORS[2] }}>
                                {Math.round(summary?.avgDelayMin || 0)} dk
                            </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Ort. Erken Varış (Erken Seferler)</Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ color: COLORS[0] }}>
                                {Math.round(summary?.avgEarlyMin || 0)} dk
                            </Typography>
                        </Stack>
                    </Box>

                </Stack>

                {/* 2. Pasta Grafiği (Orta Kolon) */}
                <Paper elevation={0} sx={{ flex: 1, minWidth: 260, height: 300, p: 1, borderRadius: 2, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'center', mb: 1, color: '#94a3b8' }}>ETA Durum Dağılımı</Typography>
                    <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={60} // Kalın halka efekti
                                outerRadius={90}
                                paddingAngle={3}
                                onClick={(e) => {
                                    if (e?.name === "Erken") onFilter?.("EARLY");
                                    else if (e?.name === "Tam Zamanında") onFilter?.("ONTIME");
                                    else if (e?.name === "Geç") onFilter?.("LATE");
                                }}
                            >
                                {pieData.map((_, i) => (
                                    <Cell
                                        key={i}
                                        fill={COLORS[i % COLORS.length]}
                                        stroke={theme.palette.background.default} // Koyu temada hücre ayırıcı
                                        strokeWidth={2}
                                    />
                                ))}
                            </Pie>
                            <Legend
                                layout="horizontal"
                                verticalAlign="bottom"
                                align="center"
                                iconType="circle"
                                wrapperStyle={{ color: '#E2E8F0' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </Paper>

                {/* 3. Bar Grafiği (Sağ Kolon) */}
                <Paper elevation={0} sx={{ flex: 1, minWidth: 300, height: 300, p: 1, borderRadius: 2, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'center', mb: 1, color: '#94a3b8' }}>Geç Varış Dağılımı (Dakika)</Typography>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={lateBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} style={{ fontSize: 10 }} />
                            <YAxis
                                allowDecimals={false}
                                stroke="#94a3b8"
                                tickLine={false}
                                style={{ fontSize: 10 }}
                            />
                            <RToolTip content={<CustomTooltip />} />
                            <Bar
                                dataKey="value"
                                onClick={() => onFilter?.("LATE")}
                                radius={[4, 4, 0, 0]} // Yuvarlatılmış üst köşeler
                            >
                                {lateBuckets.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={barColor(index)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Paper>

            </Stack>
        </Paper>
    );
}
