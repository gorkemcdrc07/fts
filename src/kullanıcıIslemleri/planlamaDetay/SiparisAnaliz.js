// src/kullanıcıIslemleri/planlamaDetay/SiparisAnaliz.js
import React, { useEffect, useMemo, useState } from "react";
import { fetchOdakSmart } from "../../lib/api";
import {
    Box,
    Stack,
    Typography,
    CircularProgress,
    Paper,
    Divider,
    Chip,
    LinearProgress,
    Tooltip,
} from "@mui/material";
import { fetchFilterPersistAndSummarizeRange } from "../../lib/hedefSpotService";
import { toUpperTr, normalizeTitle, normalizeDoc } from "../../lib/textUtils";

/** Kocaeli pickup filtresi */
const isKocaeliPickup = (row) => toUpperTr(row?.PickupCityName) === "KOCAELİ";

/** Donut grafik */
function Donut({ percent = 30, size = 140, stroke = 14, label }) {
    const p = Math.max(0, Math.min(100, percent));
    const r = (size - stroke) / 2;
    const C = 2 * Math.PI * r;
    const dash = (p / 100) * C;
    return (
        <Box sx={{ position: "relative", width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        fill="none"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth={stroke}
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        fill="none"
                        stroke="url(#g)"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${C - dash}`}
                    />
                    <defs>
                        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#22D3EE" />
                            <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                    </defs>
                </g>
            </svg>
            <Stack
                alignItems="center"
                justifyContent="center"
                sx={{ position: "absolute", inset: 0, textAlign: "center", pointerEvents: "none" }}
            >
                <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1 }}>
                    {label ?? `%${percent}`}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    Filo Önerisi
                </Typography>
            </Stack>
        </Box>
    );
}

/** Ana bileşen */
export default function SiparisAnaliz() {
    const today = new Date().toISOString().slice(0, 10);
    const [userId] = useState(1);

    // bugünkü zaman dilimi
    const [startDate] = useState(`${today}T00:00:00`);
    const [endDate] = useState(`${today}T23:59:59`);

    // son 30 gün etiketi
    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    const last30Start = d30.toISOString().slice(0, 10);

    // Panel 1 için state
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    // Panel 2 Top-3 için
    const [top3HedefCities, setTop3HedefCities] = useState([]);
    const [loadingTop3, setLoadingTop3] = useState(false);

    /** Panel 1: bugünkü veriyi çek */
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const { rows: fetchedRows } = await fetchOdakSmart({
                    startDate,
                    endDate,
                    userId,
                });
                setRows(Array.isArray(fetchedRows) ? fetchedRows : []);
            } catch (e) {
                console.error("Panel 1 veri çekme hatası:", e);
                setRows([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [startDate, endDate, userId]);

    /** Panel 2: filtre + Top-3 çek, Supabase’e upsert et */
    useEffect(() => {
        (async () => {
            setLoadingTop3(true);
            try {
                const { top3 } = await fetchFilterPersistAndSummarizeRange({
                    startISO: last30Start,
                    endISO: today,
                    userId,
                });
                setTop3HedefCities(top3);
            } catch (e) {
                console.error("Panel 2 veri çekme hatası:", e);
                setTop3HedefCities([]);
            } finally {
                setLoadingTop3(false);
            }
        })();
    }, [last30Start, today, userId]);

    /** ARKAS + Kocaeli hesaplamaları (Panel 1 içindeki alt filtre) */
    const kocaeliRows = useMemo(() => rows.filter(isKocaeliPickup), [rows]);
    const ARKAS = "ARKAS LOJİSTİK ANONİM ŞİRKETİ";

    const arkasRows = useMemo(
        () => kocaeliRows.filter((r) => normalizeTitle(r?.CurrentAccountTitle) === ARKAS),
        [kocaeliRows]
    );

    const arkasUniqueCount = useMemo(() => {
        const s = new Set();
        for (const r of arkasRows) {
            const key = normalizeDoc(r?.TMSVehicleRequestDocumentNo);
            if (key) s.add(key);
        }
        return s.size;
    }, [arkasRows]);

    const FILO_YUZDE = 30;
    const filoAdet = useMemo(
        () => (arkasUniqueCount > 0 ? Math.ceil((arkasUniqueCount * FILO_YUZDE) / 100) : 0),
        [arkasUniqueCount]
    );

    return (
        <Box
            sx={{
                p: { xs: 2, md: 3 },
                color: "#E6EAF2",
                background:
                    "radial-gradient(1000px 500px at 15% -10%, rgba(33,150,243,.18), transparent), radial-gradient(900px 450px at 90% 120%, rgba(0,188,212,.14), transparent), #0b1220",
                minHeight: "70vh",
            }}
        >
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                ARKAS Talep Şartı
            </Typography>

            {loading ? (
                <Stack direction="row" spacing={2} alignItems="center">
                    <CircularProgress size={22} />
                    <Typography>Yükleniyor…</Typography>
                </Stack>
            ) : (
                <>
                    {/* Panel 1 */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2,
                            mb: 2.5,
                            borderRadius: 2.5,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                        }}
                    >
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                            <Donut percent={FILO_YUZDE} label={`%${FILO_YUZDE}`} />
                            <Box sx={{ flex: 1 }}>
                                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.5 }}>
                                    <Typography variant="subtitle1" fontWeight={800}>ARKAS Sipariş Sayısı</Typography>
                                    <Typography variant="h6" fontWeight={900}>{arkasUniqueCount}</Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                                    <Typography component="span" variant="h6" fontWeight={900} sx={{ lineHeight: 1, mr: 0.5 }}>
                                        {filoAdet}
                                    </Typography>
                                    adedinin <b>filoya verilmesi</b> önerilir.
                                </Typography>
                                {arkasUniqueCount === 0 && (
                                    <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.7 }}>
                                        ARKAS’a ait benzersiz talep bulunamadı.
                                    </Typography>
                                )}
                            </Box>
                        </Stack>
                    </Paper>

                    {/* Panel 2: Top-3 Teslim Şehirleri */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                        }}
                    >
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight={800}>
                                HEDEF (SPOT) – Pickup=KOCAELİ → Teslim Şehri Top 3
                            </Typography>
                            <Chip
                                label="Env API + Supabase Upsert"
                                size="small"
                                sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "inherit" }}
                            />
                        </Stack>

                        {loadingTop3 ? (
                            <Stack direction="row" spacing={2} alignItems="center">
                                <CircularProgress size={20} />
                                <Typography>Veri çekiliyor…</Typography>
                            </Stack>
                        ) : top3HedefCities.length === 0 ? (
                            <Typography variant="body2" sx={{ opacity: 0.75 }}>
                                Kriterlere uygun teslimat bulunamadı.
                            </Typography>
                        ) : (
                            <>
                                <Divider sx={{ mb: 1.25, borderColor: "rgba(255,255,255,0.08)" }} />
                                <Stack spacing={1.25}>
                                    {top3HedefCities.map(({ city, count }, idx) => {
                                        const max = top3HedefCities[0]?.count || 0;
                                        const pct = max ? Math.round((count / max) * 100) : 0;
                                        return (
                                            <Box
                                                key={`${city}-${idx}`}
                                                sx={{
                                                    p: 1,
                                                    borderRadius: 1.5,
                                                    background: "rgba(255,255,255,0.03)",
                                                    border: "1px solid rgba(255,255,255,0.06)",
                                                }}
                                            >
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <Chip
                                                        label={idx + 1}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: "rgba(59,130,246,0.25)",
                                                            color: "#E6EAF2",
                                                            minWidth: 30,
                                                        }}
                                                    />
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.25 }}>
                                                            <Typography
                                                                variant="body1"
                                                                fontWeight={700}
                                                                sx={{
                                                                    mr: 1,
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                {city}
                                                            </Typography>
                                                            <Tooltip title="Adet">
                                                                <Chip
                                                                    label={count}
                                                                    size="small"
                                                                    sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "inherit" }}
                                                                />
                                                            </Tooltip>
                                                        </Stack>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={pct}
                                                            sx={{
                                                                height: 8,
                                                                borderRadius: 999,
                                                                backgroundColor: "rgba(255,255,255,0.06)",
                                                                "& .MuiLinearProgress-bar": {
                                                                    borderRadius: 999,
                                                                    background:
                                                                        "linear-gradient(90deg, rgba(34,211,238,0.95), rgba(59,130,246,0.95))",
                                                                },
                                                            }}
                                                        />
                                                    </Box>
                                                </Stack>
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            </>
                        )}
                    </Paper>
                </>
            )}
        </Box>
    );
}
