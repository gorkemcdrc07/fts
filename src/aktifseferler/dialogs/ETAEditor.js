// src/aktifseferler/dialogs/ETAEditor.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Stack,
    TextField,
    Grid,
    Divider,
    Box,
    CircularProgress,
    Paper,
    Chip,
    Tooltip,
    Snackbar,
    Alert,
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DriveEtaIcon from "@mui/icons-material/DriveEta";
import RouteIcon from "@mui/icons-material/Route";
import HotelIcon from "@mui/icons-material/Hotel";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import { fromISOToCombined } from "../utils/datetime";
import { supabase } from "../../supabaseClient";

/* -------------------- DISTANCE CACHE (local) -------------------- */
const DIST_TTL_MS = 1000 * 60 * 60 * 12; // 12 saat
const DIST_MAX_ENTRIES = 500;
const DIST_CACHE = new Map();

const keyOf = (yIl, yIlce, tIl, tIlce) =>
    [yIl ?? "", yIlce ?? "", tIl ?? "", tIlce ?? ""]
        .map((s) => String(s).trim().toLowerCase())
        .join("|");

function cacheGet(yIl, yIlce, tIl, tIlce) {
    const key = keyOf(yIl, yIlce, tIl, tIlce);
    const hit = DIST_CACHE.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > DIST_TTL_MS) {
        DIST_CACHE.delete(key);
        return null;
    }
    return { ...hit, source: "cache" };
}
function cacheSet(yIl, yIlce, tIl, tIlce, km) {
    const key = keyOf(yIl, yIlce, tIl, tIlce);
    if (DIST_CACHE.size >= DIST_MAX_ENTRIES) {
        const firstKey = DIST_CACHE.keys().next().value;
        if (firstKey) DIST_CACHE.delete(firstKey);
    }
    DIST_CACHE.set(key, { km, ts: Date.now(), source: "live" });
}

/* -------------------- küçük yardımcılar -------------------- */
const InfoRow = ({ icon: Icon, label, value }) => (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        {Icon && <Icon fontSize="small" style={{ opacity: 0.85 }} />}
        <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 86 }}>
            {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-word" }}>
            {value ?? "—"}
        </Typography>
    </Stack>
);

const firstToken = (v) => {
    if (v == null) return null;
    if (typeof v !== "string") return String(v);
    const parts = v.split(";").map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts[0] : v.trim() === "" ? null : v;
};

const firstLocation = (raw) => {
    if (!raw && raw !== "") return null;
    if (typeof raw !== "string") return firstToken(raw);
    if (raw.includes("/")) {
        const [l, r] = raw.split("/").map((s) => s.trim());
        const lf = firstToken(l), rf = firstToken(r);
        if (lf && rf) return `${lf} / ${rf}`;
        return lf || rf || null;
    }
    return firstToken(raw);
};

const formatDuration = (km, kmh = 65) => {
    if (km == null || isNaN(km)) return null;
    const total = Math.round((km / kmh) * 60);
    const h = Math.floor(total / 60), m = total % 60;
    if (h <= 0) return `${m} dk`;
    if (m === 0) return `${h} saat`;
    return `${h} saat ${m} dk`;
};

const addHours = (date, hoursFloat) => {
    const ms = Math.round(hoursFloat * 60 * 60 * 1000);
    return new Date(date.getTime() + ms);
};

const fmtDT = (d) =>
    d instanceof Date
        ? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "—";

/** "3", "3.5", "2:30", "02:05" -> saat (float) */
const parseHoursInput = (s) => {
    if (!s && s !== 0) return null;
    const str = String(s).trim();
    if (!str) return null;
    if (str.includes(":")) {
        const [hh, mm = "0"] = str.split(":");
        const h = Number(hh);
        const m = Number(mm);
        if (Number.isFinite(h) && Number.isFinite(m)) return h + m / 60;
        return null;
    }
    const num = Number(str.replace(",", "."));
    return Number.isFinite(num) ? num : null;
};

/** Date -> "YYYY-MM-DDTHH:mm:ss+03:00" (yerel offset ile) */
const toLocalOffsetISO = (d) => {
    if (!(d instanceof Date)) return null;
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    const tz = -d.getTimezoneOffset();
    const sign = tz >= 0 ? "+" : "-";
    const tzh = pad(Math.floor(Math.abs(tz) / 60));
    const tzm = pad(Math.abs(tz) % 60);
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}${sign}${tzh}:${tzm}`;
};

/* === Mesai bandı 08:30–17:00 === */
const adjustForWorkHours = (eta) => {
    if (!(eta instanceof Date)) return eta;
    const d = new Date(eta);
    const h = d.getHours(), m = d.getMinutes();
    const inBand = (h > 8 && h < 17) || (h === 8 && m >= 30) || (h === 17 && m === 0);
    if (inBand) return d;
    const set0830 = (base) => { const t = new Date(base); t.setHours(8, 30, 0, 0); return t; };
    if (h > 17 || (h === 17 && m > 0)) {
        const nextDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        return set0830(nextDay);
    }
    return set0830(d);
};

/* === Cumartesi yardımcıları === */
const isSaturday = (d) => d instanceof Date && d.getDay() === 6;
const isAfterOrEqual = (d, hh, mm = 0) => {
    if (!(d instanceof Date)) return false;
    const h = d.getHours(), m = d.getMinutes();
    return h > hh || (h === hh && m >= mm);
};
const isBefore = (d, hh, mm = 0) => {
    if (!(d instanceof Date)) return false;
    const h = d.getHours(), m = d.getMinutes();
    return h < hh || (h === hh && m < mm);
};

/* === İlçe normalize === */
const normalizeIlceForDistance = (ilce) => {
    if (ilce == null) return ilce;
    const s = String(ilce).trim();
    if (!s) return ilce;
    const up = s.toLocaleUpperCase("tr-TR");
    if (up === "İKİTELLİ" || up.includes("İKİTELLİ")) return "Başakşehir";
    return ilce;
};

/* -------------------- görselleştirme -------------------- */
const stepStyle = (kind) => {
    switch (kind) {
        case "Sürüş": return { borderLeftColor: "#60a5fa", icon: <RouteIcon fontSize="small" />, chip: { label: "Sürüş", color: "primary" } };
        case "Mola": return { borderLeftColor: "#f59e0b", icon: <LocalCafeIcon fontSize="small" />, chip: { label: "45 dk mola", color: "warning" } };
        case "Günlük Dinlenme": return { borderLeftColor: "#22c55e", icon: <HotelIcon fontSize="small" />, chip: { label: "11 saat dinlenme", color: "success" } };
        case "Hafta Sonu Bekleme": return { borderLeftColor: "#a855f7", icon: <HotelIcon fontSize="small" />, chip: { label: "Hafta Sonu Bekleme", color: "secondary" } };
        case "Mesai Dışı Bekleme": return { borderLeftColor: "#64748b", icon: <HotelIcon fontSize="small" />, chip: { label: "Mesai Dışı Bekleme", color: "default" } };
        default: return { borderLeftColor: "#94a3b8", icon: null, chip: { label: kind, color: "default" } };
    }
};

const StepCard = ({ step }) => {
    const s = stepStyle(step.kind);
    const totalMin = Math.round(step.hours * 60);
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    const durTxt = hh <= 0 ? `${mm} dk` : mm === 0 ? `${hh} saat` : `${hh} saat ${mm} dk`;
    return (
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, borderLeft: `4px solid ${s.borderLeftColor}`, background: "linear-gradient(90deg, rgba(99,102,241,0.06), rgba(59,130,246,0.06))" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                {s.icon}
                <Chip size="small" label={s.chip.label} color={s.chip.color} />
                <Typography variant="body2" sx={{ fontWeight: 700, ml: 0.5 }}>{durTxt}</Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {fmtDT(step.from)} → {fmtDT(step.to)}
            </Typography>
        </Paper>
    );
};

/* -------------------- BİLEŞEN -------------------- */
export default function ETAEditor({
    open,
    onClose,
    sefer,
    ilkNokta,
    loading,
    // signature: async ({ from: { il, ilce }, to: { il, ilce }, timeoutMs }) => ({ km })
    fetchDistance,
    speedKmh = 65,
}) {
    const autoSavedRef = useRef(false);

    const [mesafeKm, setMesafeKm] = useState(null);
    const [distanceStatus, setDistanceStatus] = useState("idle"); // idle|loading|ok|fail
    const [kalanSurusStr, setKalanSurusStr] = useState(""); // HH:MM veya sayı (saat)
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

    // Kalan sürüş persist/lock
    const [kalanSaved, setKalanSaved] = useState(false);
    const [initialKalanHours, setInitialKalanHours] = useState(null);
    const [kalanColumnMissing, setKalanColumnMissing] = useState(false);

    const effectiveIlkNokta = useMemo(
        () => ilkNokta ?? (Array.isArray(sefer?.noktalar) ? sefer.noktalar[0] : null) ?? null,
        [ilkNokta, sefer]
    );

    const pickSingle = (keys = []) => {
        const sources = [effectiveIlkNokta, sefer];
        for (const src of sources) {
            if (!src) continue;
            for (const k of keys) {
                const v = src[k];
                if (v != null && v !== "") return v;
            }
        }
        return null;
    };

    // konumları çıkar
    const {
        yuklemeIl,
        yuklemeIlce,
        teslimIl,
        teslimIlce,
        proje,
        yuklemeNokta,
        yuklemeKonum,
        teslimNokta,
        teslimKonum,
        yuklemeVarisRaw,
        yuklemeCikisRaw,
        teslimVarisRaw,
        teslimCikisRaw,
    } = useMemo(() => {
        const prjRaw = pickSingle(["proje_adi", "projeAdi", "project_name", "projectName", "proje", "project"]);
        const prj = firstToken(prjRaw);

        const yIlFromNokta = effectiveIlkNokta?.yukleme_ili ?? effectiveIlkNokta?.il ?? effectiveIlkNokta?.city ?? null;
        const yIlceFromNokta = effectiveIlkNokta?.yukleme_ilce ?? effectiveIlkNokta?.ilce ?? effectiveIlkNokta?.district ?? null;
        const yIlFromSefer = sefer?.yukleme_ili ?? sefer?.yukleme_il ?? sefer?.yuklemeCity ?? null;
        const yIlceFromSefer = sefer?.yukleme_ilcesi ?? sefer?.yukleme_ilce ?? sefer?.yuklemeDistrict ?? null;
        const yNoktaRaw = pickSingle(["yukleme_noktasi", "yukleme_nokta", "nokta_adi", "name", "address"]);

        const yNokta = firstToken(yNoktaRaw);
        const yIl = firstToken(yIlFromNokta) ?? firstToken(yIlFromSefer) ?? firstToken(yNoktaRaw);
        const yIlce = firstToken(yIlceFromNokta) ?? firstToken(yIlceFromSefer) ?? null;
        const yKonum = firstLocation(yIl ? (yIlce ? `${yIl} / ${yIlce}` : yIl) : yNoktaRaw);

        const tIlFromNokta = effectiveIlkNokta?.teslim_ili ?? effectiveIlkNokta?.il ?? effectiveIlkNokta?.city ?? null;
        const tIlceFromNokta = effectiveIlkNokta?.teslim_ilcesi ?? effectiveIlkNokta?.ilce ?? effectiveIlkNokta?.district ?? null;
        const tIlFromSefer = sefer?.teslim_ili ?? sefer?.teslim_il ?? sefer?.teslimCity ?? null;
        const tIlceFromSefer = sefer?.teslim_ilcesi ?? sefer?.teslim_ilce ?? sefer?.teslimDistrict ?? null;
        const tNoktaRaw = pickSingle(["teslim_noktasi", "teslim_nokta", "nokta_adi_teslim", "delivery_point"]);

        const tNokta = firstToken(tNoktaRaw);
        const tIl = firstToken(tIlFromNokta) ?? firstToken(tIlFromSefer) ?? firstToken(tNoktaRaw);
        const tIlce = firstToken(tIlceFromNokta) ?? firstToken(tIlceFromSefer) ?? null;
        const tKonum = firstLocation(tIl ? (tIlce ? `${tIl} / ${tIlce}` : tIl) : tNoktaRaw);

        const yV = pickSingle(["yukleme_varis", "yukleme_varis_tarih", "yukleme_arrival", "varis", "arrival"]);
        const yC = pickSingle(["yukleme_cikis", "yukleme_cikis_tarih", "yukleme_departure", "cikis", "departure"]);
        const tV = pickSingle(["teslim_varis", "teslim_varis_tarih", "teslim_arrival", "arrival"]);
        const tC = pickSingle(["teslim_cikis", "teslim_cikis_tarih", "teslim_departure", "departure"]);

        return {
            yuklemeIl: yIl,
            yuklemeIlce: yIlce,
            teslimIl: tIl,
            teslimIlce: tIlce,
            proje: prj,
            yuklemeNokta: yNokta,
            yuklemeKonum: yKonum,
            teslimNokta: tNokta,
            teslimKonum: tKonum,
            yuklemeVarisRaw: yV,
            yuklemeCikisRaw: yC,
            teslimVarisRaw: tV,
            teslimCikisRaw: tC,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveIlkNokta, sefer, open]);

    /* -------------------- MESAFE -------------------- */
    const ensureDistanceLocal = useCallback(async ({ timeoutMs = 8000, retries = 1 } = {}) => {
        const yIlceEff = normalizeIlceForDistance(yuklemeIlce);
        const tIlceEff = normalizeIlceForDistance(teslimIlce);
        const cached = cacheGet(yuklemeIl, yIlceEff, teslimIl, tIlceEff);
        if (cached?.km != null) {
            setMesafeKm(Number(cached.km));
            return { ...cached, status: "ok" };
        }
        if (!fetchDistance) return { status: "fail" };

        const withTimeout = (p, ms) =>
            new Promise((resolve, reject) => {
                const id = setTimeout(() => reject(new Error("timeout")), ms);
                p.then((v) => { clearTimeout(id); resolve(v); })
                    .catch((e) => { clearTimeout(id); reject(e); });
            });

        let lastErr = null;
        for (let i = 0; i < 1 + (retries ?? 0); i++) {
            try {
                const res = await withTimeout(
                    fetchDistance({ from: { il: yuklemeIl, ilce: yIlceEff }, to: { il: teslimIl, ilce: tIlceEff }, timeoutMs }),
                    timeoutMs
                );
                const km = res?.km ?? res?.mesafe_km;
                if (km != null && !Number.isNaN(Number(km))) {
                    cacheSet(yuklemeIl, yIlceEff, teslimIl, tIlceEff, Number(km));
                    setMesafeKm(Number(km));
                    return { km: Number(km), ts: Date.now(), source: "live", status: "ok" };
                }
                lastErr = new Error("invalid distance response");
            } catch (e) { lastErr = e; }
        }
        console.warn("ensureDistanceLocal fail:", lastErr);
        return { status: "fail", error: lastErr };
    }, [yuklemeIl, yuklemeIlce, teslimIl, teslimIlce, fetchDistance]);

    useEffect(() => {
        if (!open) return;
        const yIlceEff = normalizeIlceForDistance(yuklemeIlce);
        const tIlceEff = normalizeIlceForDistance(teslimIlce);
        const cached = cacheGet(yuklemeIl, yIlceEff, teslimIl, tIlceEff);
        if (cached?.km != null) {
            setMesafeKm(Number(cached.km));
            setDistanceStatus("ok");
            return;
        }
        let alive = true;
        (async () => {
            setDistanceStatus("loading");
            const val = await ensureDistanceLocal({ timeoutMs: 8000, retries: 1 });
            if (!alive) return;
            if (val.status === "ok" && val.km != null) setDistanceStatus("ok");
            else setDistanceStatus("fail");
        })();
        return () => { alive = false; };
    }, [open, yuklemeIl, yuklemeIlce, teslimIl, teslimIlce, ensureDistanceLocal]);

    /* -------------------- KALAN SÜRÜŞÜ YÜKLE -------------------- */
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!open) return;
            try {
                const hasId = !!sefer?.id;
                const hasSeferNo = !!sefer?.sefer_no;
                if (!hasId && !hasSeferNo) return;

                let q = supabase.from("seferler").select("eta_kalan_surus");
                if (hasId) q = q.eq("id", String(sefer.id)).maybeSingle();
                else q = q.eq("sefer_no", sefer.sefer_no).maybeSingle();

                const { data, error } = await q;

                if (error) {
                    if (error.code === "42703") { // column does not exist
                        setKalanColumnMissing(true);
                        setInitialKalanHours(null);
                        setKalanSurusStr("");
                        setKalanSaved(false);
                        return;
                    }
                    throw error;
                }

                const hours = data?.eta_kalan_surus;
                if (!cancelled && hours != null && Number.isFinite(Number(hours))) {
                    const val = Number(hours);
                    setInitialKalanHours(val);
                    const mmTotal = Math.round(val * 60);
                    const hh = Math.floor(mmTotal / 60);
                    const mm = mmTotal % 60;
                    setKalanSurusStr(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
                    setKalanSaved(true);
                } else if (!cancelled) {
                    setInitialKalanHours(null);
                    setKalanSurusStr("");
                    setKalanSaved(false);
                }
            } catch (e) {
                console.error("eta_kalan_surus load error:", e);
                setInitialKalanHours(null);
                setKalanSurusStr("");
                setKalanSaved(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [open, sefer?.id, sefer?.sefer_no]);

    /* -------------------- SÜRÜŞ PLANI -------------------- */
    const hasDistance = distanceStatus === "ok";
    const plan = useMemo(() => {
        if (!hasDistance || !mesafeKm || !Number.isFinite(Number(mesafeKm))) return null;

        const requiredDriveHours = mesafeKm / speedKmh;
        const userRemaining = Math.min(9, Math.max(0, parseHoursInput(kalanSurusStr) ?? 0));

        const rawStart =
            (yuklemeCikisRaw && new Date(yuklemeCikisRaw)) ||
            (yuklemeVarisRaw && new Date(yuklemeVarisRaw)) ||
            new Date();

        let startBase = new Date(rawStart.getTime());
        const steps = [];

        if (isSaturday(startBase) && isAfterOrEqual(startBase, 12, 0)) {
            const from = new Date(startBase);
            const to = addHours(startBase, 24);
            steps.push({ kind: "Hafta Sonu Bekleme", hours: 24, from, to: new Date(to) });
            startBase = to;
        }

        let t = new Date(startBase.getTime());
        let remaining = requiredDriveHours;

        const pushStep = (kind, hours) => {
            const before = new Date(t.getTime());
            t = addHours(t, hours);
            steps.push({ kind, hours, from: before, to: new Date(t.getTime()) });
        };

        if (remaining <= userRemaining + 1e-9) {
            pushStep("Sürüş", remaining);
            let eta = adjustForWorkHours(new Date(t.getTime()));
            if (isSaturday(rawStart) && isBefore(rawStart, 12, 0)) {
                const eh = eta.getHours() + eta.getMinutes() / 60;
                if (eh > 22) {
                    const waitFrom = new Date(eta);
                    const waitTo = addHours(eta, 24);
                    steps.push({ kind: "Hafta Sonu Bekleme", hours: 24, from: waitFrom, to: waitTo });
                    eta = waitTo;
                }
            }
            return { steps, eta, requiredDriveHours, usedFirstDay: remaining, startBase };
        }

        let dayRemainingDrive = userRemaining;
        let dayAccum = 0;

        const driveChunk = (maxHours) => {
            const chunk = Math.min(4.5, maxHours, remaining);
            pushStep("Sürüş", chunk);
            remaining -= chunk;
            dayAccum += chunk;
            return chunk;
        };

        while (remaining > 1e-9 && dayRemainingDrive > 1e-9) {
            const went = driveChunk(dayRemainingDrive);
            dayRemainingDrive -= went;

            if (remaining <= 1e-9) break;

            const blocks = Math.round(dayAccum / 4.5);
            const reached45Block = Math.abs(dayAccum - blocks * 4.5) < 1e-9 && blocks > 0;
            if (reached45Block && dayRemainingDrive > 1e-9) pushStep("Mola", 0.75);

            if (dayAccum >= 9 - 1e-9 || dayRemainingDrive <= 1e-9) {
                pushStep("Günlük Dinlenme", 11);
                dayAccum = 0;
                dayRemainingDrive = 9;
            }
        }

        while (remaining > 1e-9) {
            if (remaining <= 4.5 + 1e-9) { pushStep("Sürüş", remaining); break; }
            pushStep("Sürüş", 4.5); remaining -= 4.5;

            if (remaining > 1e-9) pushStep("Mola", 0.75);

            if (remaining <= 4.5 + 1e-9) { pushStep("Sürüş", remaining); break; }
            pushStep("Sürüş", 4.5); remaining -= 4.5;

            if (remaining > 1e-9) pushStep("Günlük Dinlenme", 11);
        }

        let eta = adjustForWorkHours(new Date(t.getTime()));
        if (isSaturday(rawStart) && isBefore(rawStart, 12, 0)) {
            const eh = eta.getHours() + eta.getMinutes() / 60;
            if (eh > 22) {
                const waitFrom = new Date(eta);
                const waitTo = addHours(eta, 24);
                steps.push({ kind: "Hafta Sonu Bekleme", hours: 24, from: waitFrom, to: waitTo });
                eta = waitTo;
            }
        }

        return { steps, eta, requiredDriveHours, usedFirstDay: userRemaining, startBase };
    }, [hasDistance, mesafeKm, speedKmh, kalanSurusStr, yuklemeCikisRaw, yuklemeVarisRaw]);

    /* -------------------- AUTO-SAVE ETA (opsiyonel) -------------------- */
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!open || autoSavedRef.current) return;
            if (!yuklemeCikisRaw) return;
            if (distanceStatus !== "ok") {
                const res = await ensureDistanceLocal({ timeoutMs: 8000, retries: 1 });
                if (cancelled) return;
                if (res?.status !== "ok") return;
            }
            if (!plan?.eta) return;

            try {
                const hasId = !!sefer?.id;
                const hasSeferNo = !!sefer?.sefer_no;
                if (!hasId && !hasSeferNo) return;

                const etaLocal = toLocalOffsetISO(plan.eta);
                let q = supabase.from("seferler").update({ eta_varis: etaLocal, eta_note: null });
                if (hasId) q = q.eq("id", String(sefer.id));
                else q = q.eq("sefer_no", sefer.sefer_no);

                const { error } = await q;
                if (!cancelled && !error) {
                    autoSavedRef.current = true;
                    setSnack({ open: true, severity: "success", msg: "Yükleme çıkışı geldi, ETA otomatik güncellendi." });
                }
            } catch (e) {
                if (!cancelled) {
                    setSnack({ open: true, severity: "warning", msg: `Otomatik ETA kaydı başarısız: ${e.message || e}` });
                }
            }
        };
        run();
        return () => { cancelled = true; };
    }, [open, yuklemeCikisRaw, distanceStatus, plan?.eta, sefer?.id, sefer?.sefer_no, ensureDistanceLocal]);

    useEffect(() => { autoSavedRef.current = false; }, [sefer?.id, sefer?.sefer_no, yuklemeCikisRaw]);

    /* -------------------- TEK "KAYDET" (HEPSİ BİR ARADA) -------------------- */
    const handleSaveAll = async () => {
        try {
            const hasId = !!sefer?.id;
            const hasSeferNo = !!sefer?.sefer_no;
            if (!hasId && !hasSeferNo) throw new Error("Sefer kimliği bulunamadı.");

            // Ne kaydedilebilir?
            const parsedKalan = parseHoursInput(kalanSurusStr);
            const canSaveKalan =
                !kalanColumnMissing &&
                !kalanSaved &&
                parsedKalan != null &&
                parsedKalan >= 0 &&
                parsedKalan <= 9;

            // ETA: çıkış yoksa sadece not; çıkış varsa mesafe+plan şart
            const canSaveEtaNote = !yuklemeCikisRaw; // not yazar
            const canSaveEtaVaris = Boolean(yuklemeCikisRaw && hasDistance && plan?.eta);

            if (!canSaveKalan && !canSaveEtaNote && !canSaveEtaVaris) {
                setSnack({ open: true, severity: "info", msg: "Kaydedilecek bir değişiklik yok." });
                return;
            }

            const payload = {};
            if (canSaveKalan) payload.eta_kalan_surus = parsedKalan;
            if (canSaveEtaNote) {
                payload.eta_varis = null;
                payload.eta_note = "Yükleme çıkış tarihi bekleniyor";
            } else if (canSaveEtaVaris) {
                payload.eta_varis = toLocalOffsetISO(plan.eta);
                payload.eta_note = null;
            }

            let q = supabase.from("seferler").update(payload);
            if (hasId) q = q.eq("id", String(sefer.id));
            else q = q.eq("sefer_no", sefer.sefer_no);

            const { error } = await q;
            if (error) {
                // Kolon yoksa kullanıcıya net mesaj
                if (error.code === "42703") {
                    setKalanColumnMissing(true);
                    setSnack({ open: true, severity: "warning", msg: "eta_kalan_surus kolonu mevcut değil. Migration uygulayın." });
                } else {
                    throw error;
                }
            } else {
                if (canSaveKalan) {
                    setInitialKalanHours(parsedKalan);
                    setKalanSaved(true);
                }
                const pieces = [
                    canSaveKalan ? "Kalan sürüş" : null,
                    canSaveEtaNote ? "ETA notu" : null,
                    canSaveEtaVaris ? "ETA varış tarihi" : null,
                ].filter(Boolean).join(", ");
                setSnack({ open: true, severity: "success", msg: `${pieces} kaydedildi.` });
                onClose && onClose();
            }
        } catch (e) {
            setSnack({ open: true, severity: "error", msg: `Kaydetme hatası: ${e.message || e}` });
        }
    };

    /* -------------------- RENDER -------------------- */
    const renderPlan = () => {
        if (!plan) return null;
        return (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
                    Planlanan Adımlar
                </Typography>
                <Stack spacing={1}>
                    {plan.steps.map((s, i) => (<StepCard key={i} step={s} />))}
                    <Divider sx={{ my: 0.5 }} />
                    <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, background: "linear-gradient(90deg,#22c55e22,#16a34a22)", border: "1px solid #16a34a55" }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <DriveEtaIcon fontSize="small" />
                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                ETA: {fmtDT(plan.eta)}
                            </Typography>
                            {yuklemeCikisRaw ? (
                                <Chip size="small" color="success" label="Yükleme çıkış mevcut" />
                            ) : (
                                <Chip size="small" color="warning" label="Yükleme çıkış eksik" />
                            )}
                        </Stack>
                        {sefer?.eta_note && (
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                                {sefer.eta_note}
                            </Typography>
                        )}
                    </Paper>
                </Stack>
            </Paper>
        );
    };

    // Alttaki tek “Kaydet” için dinamik enable/tooltip
    const parsedKalan = parseHoursInput(kalanSurusStr);
    const canSaveKalan =
        !kalanColumnMissing &&
        !kalanSaved &&
        parsedKalan != null &&
        parsedKalan >= 0 &&
        parsedKalan <= 9;

    const canSaveEtaNote = !yuklemeCikisRaw; // çıkış yoksa not yazabiliriz
    const canSaveEtaVaris = Boolean(yuklemeCikisRaw && hasDistance && plan?.eta);

    const bottomSaveEnabled = canSaveKalan || canSaveEtaNote || canSaveEtaVaris;
    const bottomTooltip = bottomSaveEnabled
        ? ""
        : (yuklemeCikisRaw && !hasDistance)
            ? "Mesafe hazır değil; ETA varışı için mesafe gerekli."
            : "Kaydedilecek bir değişiklik yok.";

    const renderContent = () => {
        if (loading) {
            return (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 240 }}>
                    <CircularProgress />
                </Box>
            );
        }

        return (
            <Stack spacing={2} sx={{ mt: 1 }}>
                <Paper elevation={0} sx={{ px: 2, py: 1.25, borderRadius: 2, background: "linear-gradient(90deg,#F472B633,#38BDF833)" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Stack spacing={0}>
                            <Typography variant="h6" sx={{ fontWeight: 900 }}>
                                ETA Düzenle: {sefer?.sefer_no ?? "—"}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <DriveEtaIcon fontSize="small" />
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                    {sefer?.plaka ?? "—"}
                                </Typography>
                                <Chip label={sefer?.reel_durum ?? ""} size="small" sx={{ ml: 1 }} />
                            </Stack>
                        </Stack>
                        <Stack alignItems="flex-end">
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Kayıt: {fromISOToCombined(sefer?.kayit_zamani)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Atama: {sefer?.atama_yapan_kullanici ?? "—"}
                            </Typography>
                        </Stack>
                    </Stack>
                </Paper>

                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                    YÜKLEME
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    1. Nokta
                                </Typography>
                            </Stack>
                            <Divider sx={{ mb: 1 }} />
                            <InfoRow icon={CalendarMonthIcon} label="Proje" value={proje} />
                            <InfoRow icon={LocationOnIcon} label="Nokta" value={yuklemeNokta} />
                            <InfoRow icon={LocationOnIcon} label="Konum" value={yuklemeKonum} />
                            <InfoRow
                                icon={DriveEtaIcon}
                                label="Mesafe"
                                value={
                                    distanceStatus === "loading"
                                        ? "Hesaplanıyor…"
                                        : hasDistance
                                            ? `${mesafeKm} km — Tahmini sürüş: ${formatDuration(mesafeKm, speedKmh)} (≥ ${speedKmh} km/s)`
                                            : "Mesafe bulunamadı"
                                }
                            />
                            <InfoRow icon={AccessTimeIcon} label="Giriş" value={fromISOToCombined(yuklemeVarisRaw)} />
                            <InfoRow icon={AccessTimeIcon} label="Çıkış" value={fromISOToCombined(yuklemeCikisRaw)} />
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                    TESLİM
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    Nokta
                                </Typography>
                            </Stack>
                            <Divider sx={{ mb: 1 }} />
                            <InfoRow icon={LocationOnIcon} label="Nokta" value={teslimNokta} />
                            <InfoRow icon={LocationOnIcon} label="Konum" value={teslimKonum} />
                            <InfoRow icon={AccessTimeIcon} label="Varış" value={fromISOToCombined(teslimVarisRaw)} />
                            <InfoRow icon={AccessTimeIcon} label="Çıkış" value={fromISOToCombined(teslimCikisRaw)} />
                        </Paper>
                    </Grid>
                </Grid>

                {!hasDistance && (
                    <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "warning.light", color: "warning.contrastText", border: (t) => `1px solid ${t.palette.warning.main}` }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                            Mesafe bulunmadan ETA varış kaydı yapılamaz. (Not kaydı yapılabilir.)
                        </Typography>
                        <Typography variant="caption">
                            {distanceStatus === "loading" ? "Mesafe hesaplanıyor…" : "Hesaplama başarısız. Tekrar deneyin veya konumları kontrol edin."}
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined"
                            sx={{ mt: 1 }}
                            onClick={async () => {
                                setDistanceStatus("loading");
                                const val = await ensureDistanceLocal({ timeoutMs: 8000, retries: 1 });
                                if (val?.status === "ok" && val?.km != null) setDistanceStatus("ok");
                                else setDistanceStatus("fail");
                            }}
                        >
                            Tekrar dene
                        </Button>
                    </Box>
                )}

                {/* ---- Kalan sürüş alanı + görsel plan ---- */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
                        Kalan Sürüş
                    </Typography>

                    {kalanColumnMissing && (
                        <Alert severity="warning" sx={{ mb: 1 }}>
                            Bu özellik için <strong>seferler.eta_kalan_surus</strong> kolonu gerekiyor (migration gerekli).
                        </Alert>
                    )}

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-end">
                        <TextField
                            label="Kalan Sürüş (saat:dakika)"
                            placeholder="örn: 2:00 veya 2.5"
                            size="small"
                            value={kalanSurusStr}
                            onChange={(e) => setKalanSurusStr(e.target.value)}
                            disabled={kalanSaved || kalanColumnMissing}
                            helperText="Maksimum 9 saat. Örn: 1:45, 4.5, 03:00"
                            error={
                                Boolean(kalanSurusStr) &&
                                !(
                                    parseHoursInput(kalanSurusStr) != null &&
                                    parseHoursInput(kalanSurusStr) >= 0 &&
                                    parseHoursInput(kalanSurusStr) <= 9
                                )
                            }
                        />
                    </Stack>

                    {kalanSaved && (
                        <Typography variant="caption" sx={{ mt: 1, color: "text.secondary", display: "block" }}>
                            Bu sefer için kalan sürüş değeri kaydedildi ve kilitlendi.
                        </Typography>
                    )}
                </Paper>

                {kalanSurusStr && plan && renderPlan()}
            </Stack>
        );
    };

    return (
        <>
            <Dialog open={Boolean(open)} onClose={onClose} maxWidth="lg" fullWidth>
                <DialogContent>{renderContent()}</DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={onClose} variant="text">Vazgeç</Button>
                    <Tooltip title={bottomTooltip}>
                        <span>
                            <Button
                                variant="contained"
                                onClick={handleSaveAll}
                                disabled={!bottomSaveEnabled}
                            >
                                Kaydet
                            </Button>
                        </span>
                    </Tooltip>
                </DialogActions>
            </Dialog>
            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    severity={snack.severity}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </>
    );
}
