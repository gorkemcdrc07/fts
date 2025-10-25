// src/tamamlananseferler/components/DashboardPanel.jsx
import React from "react";
// ÖNEMLİ DÜZELTME: Grid bileşeni buraya eklendi.
import { Paper, Stack, Typography, Box, Divider, Chip, Tooltip, useTheme, Grid } from "@mui/material";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar, XAxis, YAxis, Tooltip as RToolTip, CartesianGrid } from "recharts";
import { QueryStats, AccessTimeFilled, TrendingUp, TrendingDown, HourglassEmpty, DirectionsRun } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";

// Renkler - Daha canlı, koyu temada öne çıkan palet
const CHART_COLORS = ["#22d3ee", "#f59e0b", "#ef4444"];

// =================================================================
// CUSTOM COMPONENTS
// =================================================================

// Özelleştirilmiş Recharts Tooltip Component
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <Box sx={{ p: 1, backgroundColor: 'rgba(30, 41, 59, 0.9)', border: '1px solid #475569', borderRadius: 1, boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                <Typography variant="caption" color="#e2e8f0">{label}:</Typography>
                <Typography variant="body1" fontWeight={700} color={payload[0].color}>
                    {payload[0].value} Adet
                </Typography>
            </Box>
        );
    }
    return null;
};

// Pasta Grafiğinin Ortasındaki Toplam Sefer Sayısı
const PieCenterLabel = ({ totalCount }) => {
    const theme = useTheme();
    return (
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle">
            <tspan x="50%" dy="-0.5em" fill="#E2E8F0" fontSize="24" fontWeight="bold">
                {totalCount}
            </tspan>
            <tspan x="50%" dy="1.5em" fill="#94a3b8" fontSize="12">
                Toplam Sefer
            </tspan>
        </text>
    );
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

    // Pasta Grafiği verisi (fill renkleri yukarıdaki CHART_COLORS'tan alınıyor)
    const pieData = [
        { name: "Erken", value: summary?.early || 0, fill: CHART_COLORS[0] },
        { name: "Tam Zamanında", value: summary?.ontime || 0, fill: CHART_COLORS[1] },
        { name: "Geç", value: summary?.late || 0, fill: CHART_COLORS[2] },
    ];

    // Geç Dağılım grafiği için renk, gecikme arttıkça kırmızıya yaklaşacak
    const barColor = (index) => {
        if (index === 0) return "#facc15";
        if (index < 3) return "#fb923c";
        return "#f43f5e";
    };

    // SummaryCard bileşeni - Hover efekti ve renklendirme geliştirildi
    const SummaryCard = ({ title, value, subValue, icon, color, tooltip, onClick }) => {
        const primaryColor = color;
        return (
            <Tooltip title={tooltip}>
                <Paper
                    onClick={onClick}
                    sx={{
                        p: 2,
                        borderRadius: 2.5,
                        cursor: onClick ? 'pointer' : 'default',
                        flexGrow: 1,
                        minWidth: 150,
                        transition: 'all 0.3s ease',
                        border: `1px solid ${alpha(primaryColor, 0.5)}`,
                        background: `linear-gradient(135deg, rgba(17, 24, 39, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)`,
                        boxShadow: `0 6px 18px ${alpha(primaryColor, 0.2)}`,
                        '&:hover': {
                            transform: onClick ? 'translateY(-4px)' : 'none',
                            // Vurgu hover efekti
                            boxShadow: onClick ? `0 12px 30px ${alpha(primaryColor, 0.5)}, inset 0 0 15px ${alpha(primaryColor, 0.1)}` : 'inherit',
                            background: `linear-gradient(135deg, ${alpha(primaryColor, 0.1)} 0%, rgba(30, 41, 59, 0.8) 100%)`,
                        }
                    }}
                >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box sx={{ color: primaryColor, fontSize: 32 }}>
                            {React.cloneElement(icon, { sx: { fontSize: 32 } })}
                        </Box>
                        <Typography variant="h4" fontWeight={800} sx={{ color: 'white' }}>
                            {value}
                        </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                        {title}
                    </Typography>
                    {subValue && (
                        <Typography variant="caption" fontWeight={600} sx={{ color: alpha(primaryColor, 0.9) }}>
                            {subValue}
                        </Typography>
                    )}
                </Paper>
            </Tooltip>
        );
    };

    return (
        <Paper
            sx={{
                p: 3,
                borderRadius: 4,
                // GÜÇLÜ GLASSMORPHISM EFEKTİ
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(10, 18, 35, 0.65)",
                backdropFilter: "blur(12px)",
                boxShadow: `0 15px 40px rgba(0,0,0,0.6)`,
            }}
        >
            {/* Üst Kısım: Başlık ve Toplam Chip */}
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} mb={3}>
                <Box>
                    <Typography variant="h5" fontWeight={700} sx={{ color: '#E2E8F0' }}>
                        Operasyonel Performans Analizi
                    </Typography>
                    <Typography variant="subtitle2" color="#94a3b8">
                        {dateRangeText} aralığındaki sonuçlar
                    </Typography>
                </Box>
                <Chip
                    label={`Toplam Sefer: ${totalCount}`}
                    icon={<DirectionsRun />}
                    onClick={() => onFilter?.("ALL")}
                    sx={{
                        mt: { xs: 1.5, sm: 0 },
                        bgcolor: alpha(theme.palette.info.main, 0.2),
                        color: theme.palette.info.light,
                        fontWeight: 700,
                        border: `1px solid ${alpha(theme.palette.info.main, 0.4)}`,
                        '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.3) }
                    }}
                />
            </Stack>

            <Divider sx={{ mb: 3, borderColor: "rgba(255,255,255,0.1)" }} />

            <Grid container spacing={3}>
                {/* Sol Kolon (Kartlar) */}
                <Grid item xs={12} lg={4}>
                    <Stack spacing={2}>
                        <SummaryCard
                            title="Toplam Erken Varış"
                            value={summary?.early || 0}
                            subValue={`Ort. ${Math.round(summary?.avgEarlyMin || 0)} dk erken`}
                            icon={<TrendingUp />}
                            color={CHART_COLORS[0]}
                            tooltip="Erken teslim edilen seferlerin sayısı"
                            onClick={() => onFilter?.("EARLY")}
                        />
                        <SummaryCard
                            title="Tam Zamanında"
                            value={summary?.ontime || 0}
                            subValue="ETA'dan +/- 5 dk içinde"
                            icon={<AccessTimeFilled />}
                            color={CHART_COLORS[1]}
                            tooltip="Tam zamanında teslim edilen seferlerin sayısı"
                            onClick={() => onFilter?.("ONTIME")}
                        />
                        <SummaryCard
                            title="Toplam Geç Varış"
                            value={summary?.late || 0}
                            subValue={`Ort. ${Math.round(summary?.avgDelayMin || 0)} dk gecikme`}
                            icon={<TrendingDown />}
                            color={CHART_COLORS[2]}
                            tooltip="Geç teslim edilen seferlerin sayısı"
                            onClick={() => onFilter?.("LATE")}
                        />
                        <SummaryCard
                            title="Ortalama Gecikme"
                            value={`${Math.round(summary?.avgDelayMin || 0)} dk`}
                            subValue="Geç teslimat yapan seferlerin ortalaması"
                            icon={<HourglassEmpty />}
                            color={theme.palette.warning.light}
                            tooltip="Geç teslimat yapan seferlerin ortalama gecikme süresi"
                            onClick={null}
                        />
                    </Stack>
                </Grid>

                {/* Sağ Kolon (Grafikler) */}
                <Grid item xs={12} lg={8}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="stretch">

                        {/* 2. Pasta Grafiği (ETA Durum Dağılımı) */}
                        <Box sx={{ flex: 1, minWidth: 260, height: 350, p: 1, borderRadius: 2, background: alpha(theme.palette.background.default, 0.4), border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2)' }}>
                            <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'center', mb: 1, color: '#94a3b8' }}>ETA Durum Dağılımı (Adet)</Typography>
                            <ResponsiveContainer width="100%" height="90%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={3}
                                        // Merkezi etiketi ekle
                                        label={totalCount > 0 ? <PieCenterLabel totalCount={totalCount} /> : null}
                                        labelLine={false}
                                        onClick={(e) => {
                                            if (e?.name === "Erken") onFilter?.("EARLY");
                                            else if (e?.name === "Tam Zamanında") onFilter?.("ONTIME");
                                            else if (e?.name === "Geç") onFilter?.("LATE");
                                        }}
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell
                                                key={`cell-${i}`}
                                                fill={entry.fill}
                                                stroke={alpha(theme.palette.background.default, 0.5)}
                                                strokeWidth={4}
                                            />
                                        ))}
                                    </Pie>
                                    <Legend
                                        layout="horizontal"
                                        verticalAlign="bottom"
                                        align="center"
                                        iconType="circle"
                                        wrapperStyle={{ color: '#E2E8F0', fontSize: 12, paddingTop: '10px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </Box>

                        {/* 3. Bar Grafiği (Geç Varış Dağılımı) */}
                        <Box sx={{ flex: 1, minWidth: 300, height: 350, p: 1, borderRadius: 2, background: alpha(theme.palette.background.default, 0.4), border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2)' }}>
                            <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'center', mb: 1, color: '#94a3b8' }}>Geç Varış Dağılımı (Dakika)</Typography>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart data={lateBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={alpha("#475569", 0.3)} vertical={false} />
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
                                        radius={[4, 4, 0, 0]}
                                    >
                                        {lateBuckets.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={barColor(index)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Stack>
                </Grid>
            </Grid>
        </Paper>
    );
}
