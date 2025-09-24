// src/planlamaIslemleri/analiz.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    Box,
    Stack,
    Paper,
    Typography,
    LinearProgress,
    IconButton,
    Tooltip,
    Chip,
    Divider,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Button,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HomeIcon from "@mui/icons-material/Home";
import RefreshIcon from "@mui/icons-material/Refresh";
import { supabase } from "../supabaseClient";

// ===== ENV / SABİTLER =====
const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const API_TOKEN = process.env.REACT_APP_API_TOKEN || "";

// 1) Öncelik: backend proxy (services.js ile aynı)
//    /api/proxy/tmsdespatches -> POST + JSON
const PROXY_PATH = "/api/proxy/tmsdespatches";

// 2) Olmazsa: olası doğrudan TMS rotaları (case hassas!)
const DESPATCH_CANDIDATES = [
    { path: "/api/TMSDespatches/GetAll", method: "POST", bodyKind: "json" },
    { path: "/api/TmsDespatches/GetAll", method: "POST", bodyKind: "json" },
    { path: "/api/TMSDespatches/Search", method: "POST", bodyKind: "json" },
    { path: "/api/TmsDespatches/Search", method: "POST", bodyKind: "json" },
    { path: "/api/Despatches/GetAll", method: "POST", bodyKind: "json" },
    { path: "/api/Despatch/GetAll", method: "POST", bodyKind: "json" },

    { path: "/api/tmsdespatches/getall", method: "POST", bodyKind: "json" },
    { path: "/tmsdespatches/getall", method: "POST", bodyKind: "json" },

    { path: "/api/TMSDespatches/GetAll", method: "GET", bodyKind: "query" },
    { path: "/api/TmsDespatches/GetAll", method: "GET", bodyKind: "query" },
    { path: "/api/Despatches/GetAll", method: "GET", bodyKind: "query" },
    { path: "/api/tmsdespatches/getall", method: "GET", bodyKind: "query" },
    { path: "/tmsdespatches/getall", method: "GET", bodyKind: "query" },
];

// ===== YARDIMCILAR =====
const toISODate = (d) => d.toISOString().slice(0, 10);
const atStart = (iso) => `${iso}T00:00:00`;

function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

// Proxy/TMS yanıtını tablo alanlarına uyarla
function normalizeRows(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => {
        // İki olası şema:
        // A) Klasik: DespatchNo, DespatchDate, VehiclePlate, CustomerName, DriverName, LoadingCity/Location, UnloadingCity/Location
        // B) TMS: DocumentNo, DespatchDate, PlateNumber, FullName, CustomerFullTitle, Pickup*/Delivery*
        const hasTMSShape = x?.DocumentNo || x?.PlateNumber || x?.CustomerFullTitle;

        if (hasTMSShape) {
            const orders = Array.isArray(x?.TMSOrders) ? x.TMSOrders : [];
            const first = (k) => (orders.length ? (orders[0]?.[k] ?? "") : "");
            const last = (k) => (orders.length ? (orders[orders.length - 1]?.[k] ?? "") : "");

            return {
                // tablo sütunları için normalize
                DespatchDate: x?.DespatchDate ?? null,
                DespatchNo: (x?.DocumentNo || "").toString(),
                VehiclePlate: x?.PlateNumber ?? "",
                CustomerName: x?.CustomerFullTitle ?? "",
                DriverName: x?.FullName ?? "",
                LoadingCity: first("PickupCityName") || "",
                LoadingLocation: first("PickupAddressCode") || "",
                UnloadingCity: last("DeliveryCityName") || "",
                UnloadingLocation: last("DeliveryAddressCode") || "",
                // orijinal alanları da taşı (gerekirse)
                _raw: x,
            };
        }

        // zaten beklenen alanlardaysa dokunma
        return { ...x };
    });
}

// ===== ANA BİLEŞEN =====
export default function Analiz() {
    const nav = useNavigate();
    const q = useQuery();
    const seciliTarih = q.get("tarih");

    const baseDate = useMemo(() => {
        const d = seciliTarih ? new Date(`${seciliTarih}T00:00:00`) : new Date();
        return isNaN(d.getTime()) ? new Date() : d;
    }, [seciliTarih]);

    const [loading, setLoading] = useState(false);
    const [ham, setHam] = useState([]); // API ham veri (normalize öncesi değil, normalize sonrası ama isim eski)
    const [filtreli, setFiltreli] = useState([]); // planlama tarihleriyle eşleşenler
    const [planlamaTarihSet, setPlanlamaTarihSet] = useState(new Set());

    // Dün–Bugün–Yarın aralığı
    const { startDate, endDate, etiket } = useMemo(() => {
        const d0 = new Date(baseDate);
        const dPrev = new Date(baseDate);
        dPrev.setDate(dPrev.getDate() - 1);
        const dNext = new Date(baseDate);
        dNext.setDate(dNext.getDate() + 1);
        return {
            startDate: atStart(toISODate(dPrev)),
            endDate: atStart(toISODate(dNext)),
            etiket: `${toISODate(dPrev)} – ${toISODate(d0)} – ${toISODate(dNext)}`,
        };
    }, [baseDate]);

    const fetchPlanlamaTarihleri = async () => {
        const { data, error } = await supabase.from("planlama").select("tarih");
        if (error) throw error;
        const set = new Set(
            (data || [])
                .map((r) => (r?.tarih ? String(r.tarih).slice(0, 10) : null))
                .filter(Boolean)
        );
        return set;
    };

    const buildHeaders = () => {
        const headers = {};
        if (API_TOKEN) {
            headers["Authorization"] = `Bearer ${API_TOKEN}`;
            headers["x-api-key"] = API_TOKEN; // API'nizden yalnız biri bile yeterli olabilir
        }
        return headers;
    };

    const fetchDespatches = async () => {
        // Not: services.js’de WorkingTypesId [3,4] idi; burada planlamadaki kullanım [2,3] idi.
        // İhtiyaca göre değiştirin; şimdilik [2,3] bırakıyorum:
        const payload = {
            startDate,
            endDate,
            userId: 1,
            CustomerId: 0,
            SupplierId: 0,
            DriverId: 0,
            TMSDespatchId: 0,
            VehicleId: 0,
            DocumentPrint: "0",
            WorkingTypesId: [2, 3],
        };

        const headersBase = buildHeaders();
        let lastErr = null;

        // 1) Önce backend proxy’yi dene (önerilen yol)
        try {
            const proxyUrl = `${API_BASE}${PROXY_PATH}`;
            const res = await fetch(proxyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...headersBase },
                body: JSON.stringify({
                    // proxy arayüzü services.js ile birebir olsun diye:
                    startDate: payload.startDate,
                    endDate: payload.endDate,
                    userId: payload.userId,
                    CustomerId: payload.CustomerId,
                    SupplierId: payload.SupplierId,
                    DriverId: payload.DriverId,
                    TMSDespatchId: payload.TMSDespatchId,
                    VehicleId: payload.VehicleId,
                    DocumentPrint: payload.DocumentPrint === "0" ? "" : payload.DocumentPrint,
                    // proxy’de [3,4] kullanıyorsanız burayı değiştirin:
                    WorkingTypesId: payload.WorkingTypesId,
                }),
            });
            const text = await res.text().catch(() => "");

            if (res.ok) {
                let json = null;
                try { json = JSON.parse(text); } catch { }
                const arr = Array.isArray(json?.Data) ? json.Data : (Array.isArray(json) ? json : (json?.data ?? []));
                const normalized = normalizeRows(arr);
                console.info("[API] Kullanılan rota: PROXY POST", proxyUrl);
                return normalized;
            } else if (res.status !== 404 && res.status !== 405) {
                // 404/405 dışındaki hatalarda fallbacks’a geçmeden önce hatayı sakla
                lastErr = new Error(`API hata: ${res.status} ${res.statusText}\nURL: ${res.url}\nYanıt: ${text?.slice(0, 300)}`);
            }
            // 404/405 ise aşağıdaki adaylara düşeceğiz
        } catch (e) {
            lastErr = e;
        }

        // 2) Doğrudan TMS rotalarını sırayla dene
        for (const c of DESPATCH_CANDIDATES) {
            try {
                const url = new URL(`${API_BASE}${c.path}`);
                const opts = { method: c.method, headers: { ...headersBase } };

                if (c.method === "GET" && c.bodyKind === "query") {
                    url.searchParams.set("startDate", payload.startDate);
                    url.searchParams.set("endDate", payload.endDate);
                    url.searchParams.set("userId", String(payload.userId));
                    url.searchParams.set("CustomerId", String(payload.CustomerId));
                    url.searchParams.set("SupplierId", String(payload.SupplierId));
                    url.searchParams.set("DriverId", String(payload.DriverId));
                    url.searchParams.set("TMSDespatchId", String(payload.TMSDespatchId));
                    url.searchParams.set("VehicleId", String(payload.VehicleId));
                    url.searchParams.set("DocumentPrint", payload.DocumentPrint);
                    payload.WorkingTypesId.forEach((v) =>
                        url.searchParams.append("WorkingTypesId", String(v))
                    );
                } else if (c.method === "POST" && c.bodyKind === "json") {
                    opts.headers["Content-Type"] = "application/json";
                    opts.body = JSON.stringify(payload);
                }

                const res = await fetch(url.toString(), opts);
                const text = await res.text().catch(() => "");

                if (res.ok) {
                    let json = null;
                    try { json = JSON.parse(text); } catch { }
                    const arr = Array.isArray(json) ? json : (json?.Data ?? json?.data ?? []);
                    const normalized = normalizeRows(arr);
                    console.info("[API] Kullanılan rota:", c.method, url.toString());
                    return normalized;
                }

                console.warn(`[API] ${res.status} ${res.statusText} (${c.method} ${url})`);
                lastErr = new Error(
                    `API hata: ${res.status} ${res.statusText}\nURL: ${url}\nYanıt: ${text?.slice(0, 300)}`
                );
            } catch (e) {
                console.warn("[API] deneme hatası:", e?.message);
                lastErr = e;
            }
        }

        throw lastErr ?? new Error("Uygun endpoint bulunamadı.");
    };

    const run = async () => {
        setLoading(true);
        try {
            const [planSet, apiRows] = await Promise.all([
                fetchPlanlamaTarihleri(),
                fetchDespatches(),
            ]);

            setPlanlamaTarihSet(planSet);
            setHam(apiRows);

            // DespatchDate “YYYY-MM-DD” → planlama setinde olanları süz
            const onlyPlannedDates = (apiRows || []).filter((it) => {
                const d = it?.DespatchDate ? String(it.DespatchDate).slice(0, 10) : null;
                return d && planSet.has(d);
            });

            setFiltreli(onlyPlannedDates);
        } catch (e) {
            console.error(e);
            alert(e?.message || "Beklenmedik bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate]);

    return (
        <Box sx={{ p: 2, display: "grid", gridTemplateRows: "auto auto 1fr", gap: 1.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Tooltip title="Geri">
                        <IconButton onClick={() => nav(-1)} sx={{ border: "1px solid rgba(255,255,255,0.12)" }} size="small">
                            <ArrowBackIosNewIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Anasayfa">
                        <IconButton onClick={() => nav("/anasayfa")} sx={{ border: "1px solid rgba(255,255,255,0.12)" }} size="small">
                            <HomeIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="h6" fontWeight={800}>Analiz</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={`Aralık: ${etiket}`} variant="outlined" />
                    <Chip label={`Planlama tarihleri: ${planlamaTarihSet.size}`} variant="outlined" />
                    <Chip label={`API toplam: ${ham.length}`} variant="outlined" />
                    <Chip color="primary" label={`Eşleşen: ${filtreli.length}`} />
                    <Button startIcon={<RefreshIcon />} onClick={run} disabled={loading} variant="outlined">
                        Yenile
                    </Button>
                </Stack>
            </Stack>

            {loading && <LinearProgress />}

            <Paper sx={{ p: 1, borderRadius: 2, border: "1px solid rgba(255,255,255,0.06)" }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    DespatchDate’i planlama tarihleriyle eşleşen sevkiyatlar
                </Typography>
                <Divider sx={{ mb: 1 }} />
                <Box sx={{ overflow: "auto" }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>DespatchDate</TableCell>
                                <TableCell>DespatchNo</TableCell>
                                <TableCell>VehiclePlate</TableCell>
                                <TableCell>Customer</TableCell>
                                <TableCell>Driver</TableCell>
                                <TableCell>From → To</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtreli.map((row, idx) => (
                                <TableRow key={row?.Id ?? row?.DespatchNo ?? idx}>
                                    <TableCell>{String(row?.DespatchDate ?? "").slice(0, 10)}</TableCell>
                                    <TableCell>{row?.DespatchNo ?? "-"}</TableCell>
                                    <TableCell>{row?.VehiclePlate ?? "-"}</TableCell>
                                    <TableCell>{row?.CustomerName ?? "-"}</TableCell>
                                    <TableCell>{row?.DriverName ?? "-"}</TableCell>
                                    <TableCell>
                                        {(row?.LoadingCity || row?.LoadingLocation) ?? "-"} → {(row?.UnloadingCity || row?.UnloadingLocation) ?? "-"}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!filtreli.length && !loading && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Typography variant="body2" sx={{ opacity: 0.75 }}>
                                            Eşleşen kayıt bulunamadı.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Box>
            </Paper>
        </Box>
    );
}
