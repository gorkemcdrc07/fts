// src/aktifseferler/dialogs/ETAEditor.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
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
    const parts = v
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
    return parts.length ? parts[0] : v.trim() === "" ? null : v;
};

const firstLocation = (raw) => {
    if (!raw && raw !== "") return null;
    if (typeof raw !== "string") return firstToken(raw);
    if (raw.includes("/")) {
        const [l, r] = raw.split("/").map((s) => s.trim());
        const lf = firstToken(l),
            rf = firstToken(r);
        if (lf && rf) return `${lf} / ${rf}`;
        return lf || rf || null;
    }
    return firstToken(raw);
};

const formatDuration = (km, kmh = 65) => {
    if (km == null || isNaN(km)) return null;
    const total = Math.round((km / kmh) * 60);
    const h = Math.floor(total / 60),
        m = total % 60;
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
    const tz = -d.getTimezoneOffset(); // minutes
    const sign = tz >= 0 ? "+" : "-";
    const tzh = pad(Math.floor(Math.abs(tz) / 60));
    const tzm = pad(Math.abs(tz) % 60);
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}${sign}${tzh}:${tzm}`;
};

/* === Mesai bandı 08:30–17:00: band dışındaysa yakın 08:30’a sabitle === */
const adjustForWorkHours = (eta) => {
    if (!(eta instanceof Date)) return eta;

    const d = new Date(eta);
    const h = d.getHours();
    const m = d.getMinutes();

    // 08:30–17:00 içindeyse (17:00 dahil) dokunma
    const inBand =
        (h > 8 && h < 17) ||
        (h === 8 && m >= 30) ||
        (h === 17 && m === 0);
    if (inBand) return d;

    const set0830 = (base) => {
        const t = new Date(base);
        t.setHours(8, 30, 0, 0);
        return t;
    };

    // 17:00 ve sonrası → ertesi gün 08:30
    if (h > 17 || (h === 17 && m > 0)) {
        const nextDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        return set0830(nextDay);
    }

    // 08:30’dan önce → bugün 08:30
    return set0830(d);
};

/* === Cumartesi yardımcıları === */
const isSaturday = (d) => d instanceof Date && d.getDay() === 6; // 6 = Cumartesi
const isAfterOrEqual = (d, hh, mm = 0) => {
    if (!(d instanceof Date)) return false;
    const h = d.getHours();
    const m = d.getMinutes();
    return h > hh || (h === hh && m >= mm);
};
const isBefore = (d, hh, mm = 0) => {
    if (!(d instanceof Date)) return false;
    const h = d.getHours();
    const m = d.getMinutes();
    return h < hh || (h === hh && m < mm);
};

/* -------------------- görselleştirme yardımcıları -------------------- */
const stepStyle = (kind) => {
    switch (kind) {
        case "Sürüş":
            return { borderLeftColor: "#60a5fa", icon: <RouteIcon fontSize="small" />, chip: { label: "Sürüş", color: "primary" } };
        case "Mola":
            return { borderLeftColor: "#f59e0b", icon: <LocalCafeIcon fontSize="small" />, chip: { label: "45 dk mola", color: "warning" } };
        case "Günlük Dinlenme":
            return { borderLeftColor: "#22c55e", icon: <HotelIcon fontSize="small" />, chip: { label: "11 saat dinlenme", color: "success" } };
        case "Hafta Sonu Bekleme":
            return { borderLeftColor: "#a855f7", icon: <HotelIcon fontSize="small" />, chip: { label: "Hafta Sonu Bekleme", color: "secondary" } };
        case "Mesai Dışı Bekleme":
            return { borderLeftColor: "#64748b", icon: <HotelIcon fontSize="small" />, chip: { label: "Mesai Dışı Bekleme", color: "default" } };
        default:
            return { borderLeftColor: "#94a3b8", icon: null, chip: { label: kind, color: "default" } };
    }
};

const StepCard = ({ step }) => {
    const s = stepStyle(step.kind);
    const totalMin = Math.round(step.hours * 60);
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    const durTxt = hh <= 0 ? `${mm} dk` : mm === 0 ? `${hh} saat` : `${hh} saat ${mm} dk`;

    return (
        <Paper
            variant="outlined"
            sx={{
                p: 1.25,
                borderRadius: 2,
                borderLeft: `4px solid ${s.borderLeftColor}`,
                background: "linear-gradient(90deg, rgba(99,102,241,0.06), rgba(59,130,246,0.06))",
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                {s.icon}
                <Chip size="small" label={s.chip.label} color={s.chip.color} />
                <Typography variant="body2" sx={{ fontWeight: 700, ml: 0.5 }}>
                    {durTxt}
                </Typography>
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

    // distance getir
    async function ensureDistanceLocal({ timeoutMs = 8000, retries = 1 } = {}) {
        const cached = cacheGet(yuklemeIl, yuklemeIlce, teslimIl, teslimIlce);
        if (cached?.km != null) {
            setMesafeKm(Number(cached.km));
            return { ...cached, status: "ok" };
        }
        if (!fetchDistance) return { status: "fail" };

        const withTimeout = (p, ms) =>
            new Promise((resolve, reject) => {
                const id = setTimeout(() => reject(new Error("timeout")), ms);
                p.then((v) => {
                    clearTimeout(id);
                    resolve(v);
                }).catch((e) => {
                    clearTimeout(id);
                    reject(e);
                });
            });

        let lastErr = null;
        for (let i = 0; i < 1 + (retries ?? 0); i++) {
            try {
                const res = await withTimeout(
                    fetchDistance({
                        from: { il: yuklemeIl, ilce: yuklemeIlce },
                        to: { il: teslimIl, ilce: teslimIlce },
                        timeoutMs,
                    }),
                    timeoutMs
                );
                const km = res?.km ?? res?.mesafe_km;
                if (km != null && !Number.isNaN(Number(km))) {
                    cacheSet(yuklemeIl, yuklemeIlce, teslimIl, teslimIlce, Number(km));
                    setMesafeKm(Number(km));
                    return { km: Number(km), ts: Date.now(), source: "live", status: "ok" };
                }
                lastErr = new Error("invalid distance response");
            } catch (e) {
                lastErr = e;
            }
        }
        console.warn("ensureDistanceLocal fail:", lastErr);
        return { status: "fail", error: lastErr };
    }

    useEffect(() => {
        if (!open) return;

        const cached = cacheGet(yuklemeIl, yuklemeIlce, teslimIl, teslimIlce);
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

        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, yuklemeIl, yuklemeIlce, teslimIl, teslimIlce]);

    const sureStr = useMemo(() => formatDuration(mesafeKm, speedKmh), [mesafeKm, speedKmh]);
    const hasDistance = distanceStatus === "ok";
    const blocked = loading || !hasDistance;

    /* -------------------- SÜRÜŞ PLANI HESABI -------------------- */
    const plan = useMemo(() => {
        if (!hasDistance || !mesafeKm || !Number.isFinite(Number(mesafeKm))) return null;

        const requiredDriveHours = mesafeKm / speedKmh; // saf sürüş
        const userRemaining = Math.min(9, Math.max(0, parseHoursInput(kalanSurusStr) ?? 0));

        // başlangıç zamanı: yükleme çıkış -> yoksa yükleme varış -> yoksa "şimdi"
        const rawStart =
            (yuklemeCikisRaw && new Date(yuklemeCikisRaw)) ||
            (yuklemeVarisRaw && new Date(yuklemeVarisRaw)) ||
            new Date();

        let startBase = new Date(rawStart.getTime());

        // Adımlar
        const steps = [];

        // Cumartesi başlama kuralı
        if (isSaturday(startBase)) {
            if (isAfterOrEqual(startBase, 12, 0)) {
                // Cumartesi 12:00 ve sonrası → +24 saat bekleme
                const from = new Date(startBase);
                const to = addHours(startBase, 24);
                steps.push({ kind: "Hafta Sonu Bekleme", hours: 24, from, to: new Date(to) });
                startBase = to;
            }
        }

        let t = new Date(startBase.getTime());
        let remaining = requiredDriveHours;

        const pushStep = (kind, hours) => {
            const before = new Date(t.getTime());
            t = addHours(t, hours);
            steps.push({
                kind,
                hours,
                from: before,
                to: new Date(t.getTime()),
            });
        };

        // Kullanıcının kalan hakkı yeterliyse tek günde bitir
        if (remaining <= userRemaining + 1e-9) {
            pushStep("Sürüş", remaining);
            // Mesai bandı ayarı
            let eta = adjustForWorkHours(new Date(t.getTime()));

            // Cumartesi < 12:00 başlangıç olup ETA 22:00'ı aştıysa → +24 bekleme
            if (isSaturday(rawStart) && isBefore(rawStart, 12, 0)) {
                const eh = eta.getHours() + eta.getMinutes() / 60;
                if (eh > 22) {
                    const waitFrom = new Date(eta);
                    const waitTo = addHours(eta, 24);
                    steps.push({ kind: "Hafta Sonu Bekleme", hours: 24, from: waitFrom, to: waitTo });
                    eta = waitTo;
                }
            }

            return {
                steps,
                eta,
                requiredDriveHours,
                usedFirstDay: remaining,
                startBase,
            };
        }

        // Aksi halde bloklar halinde sürüş + molalar + günlük dinlenmeler
        let dayRemainingDrive = userRemaining; // ilk gün
        let dayAccum = 0;

        const driveChunk = (maxHours) => {
            const chunk = Math.min(4.5, maxHours, remaining);
            pushStep("Sürüş", chunk);
            remaining -= chunk;
            dayAccum += chunk;
            return chunk;
        };

        // İlk gün: kullanıcının kalan sürüşünü tüket
        while (remaining > 1e-9 && dayRemainingDrive > 1e-9) {
            const went = driveChunk(dayRemainingDrive);
            dayRemainingDrive -= went;

            if (remaining <= 1e-9) break;

            // 4.5 saat tamamlandıysa ve aynı gün devam edeceksen 45 dk mola
            const blocks = Math.round(dayAccum / 4.5);
            const reached45Block = Math.abs(dayAccum - blocks * 4.5) < 1e-9 && blocks > 0;
            if (reached45Block && dayRemainingDrive > 1e-9) {
                pushStep("Mola", 0.75);
            }

            // 9 saat dolduysa veya kalan sıfırlandıysa günlük dinlenme
            if (dayAccum >= 9 - 1e-9 || dayRemainingDrive <= 1e-9) {
                pushStep("Günlük Dinlenme", 11);
                dayAccum = 0;
                dayRemainingDrive = 9; // sonraki gün tam hak
            }
        }

        // Sonraki günler
        while (remaining > 1e-9) {
            // 1. 4.5 sürüş
            if (remaining <= 4.5 + 1e-9) {
                pushStep("Sürüş", remaining);
                break;
            } else {
                pushStep("Sürüş", 4.5);
                remaining -= 4.5;
            }

            if (remaining > 1e-9) pushStep("Mola", 0.75);

            // 2. 4.5 sürüş
            if (remaining <= 4.5 + 1e-9) {
                pushStep("Sürüş", remaining);
                break;
            } else {
                pushStep("Sürüş", 4.5);
                remaining -= 4.5;
            }

            if (remaining > 1e-9) pushStep("Günlük Dinlenme", 11);
        }

        // Mesai bandı ayarı
        let eta = adjustForWorkHours(new Date(t.getTime()));

        // Cumartesi < 12:00 başlangıç olup ETA 22:00'ı aştıysa → +24 bekleme
        if (isSaturday(rawStart) && isBefore(rawStart, 12, 0)) {
            const eh = eta.getHours() + eta.getMinutes() / 60;
            if (eh > 22) {
                const waitFrom = new Date(eta);
                const waitTo = addHours(eta, 24);
                steps.push({ kind: "Hafta Sonu Bekleme", hours: 24, from: waitFrom, to: waitTo });
                eta = waitTo;
            }
        }

        return {
            steps,
            eta,
            requiredDriveHours,
            usedFirstDay: userRemaining,
            startBase,
        };
    }, [hasDistance, mesafeKm, speedKmh, kalanSurusStr, yuklemeCikisRaw, yuklemeVarisRaw]);

    /* -------------------- AUTO-SAVE: yükleme çıkışı gelince otomatik ETA kaydı -------------------- */
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!open || autoSavedRef.current) return;      // dialog kapalıysa veya daha önce kaydedildiyse bırak
            if (!yuklemeCikisRaw) return;                   // çıkış yoksa bekle
            // mesafe hazır değilse bir dene
            if (distanceStatus !== "ok") {
                const res = await ensureDistanceLocal({ timeoutMs: 8000, retries: 1 });
                if (cancelled) return;
                if (res?.status !== "ok") return;           // mesafe yoksa vazgeç
            }
            if (!plan?.eta) return;                         // plan henüz hazır değilse çık

            try {
                const id = sefer?.id;
                const keyFilter = id ? { by: "id", value: id } : { by: "sefer_no", value: sefer?.sefer_no };
                if (!keyFilter.value) return;

                const etaLocal = toLocalOffsetISO(plan.eta);
                const q = supabase.from("seferler").update({
                    eta_varis: etaLocal,
                    eta_note: null, // tarih geldiyse notu temizle
                });
                if (keyFilter.by === "id") q.eq("id", keyFilter.value);
                else q.eq("sefer_no", keyFilter.value);

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
        // plan?.eta'ya bağımlılık veriyoruz ki hesap hazır olur olmaz çalışsın
    }, [open, yuklemeCikisRaw, distanceStatus, plan?.eta, sefer?.id, sefer?.sefer_no]);

    // Sefer veya çıkış tarihi değişirse otomatik-kayıt kilidini sıfırla
    useEffect(() => { autoSavedRef.current = false; }, [sefer?.id, sefer?.sefer_no, yuklemeCikisRaw]);

    /* -------------------- save (eta_varis / eta_note) -------------------- */
    const handleSave = async () => {
        if (blocked) return;

        try {
            const id = sefer?.id;
            const keyFilter = id ? { by: "id", value: id } : { by: "sefer_no", value: sefer?.sefer_no };
            if (!keyFilter.value) throw new Error("Sefer kimliği bulunamadı.");

            let payload;
            if (!yuklemeCikisRaw) {
                // Çıkış tarihi yok -> sadece notu yaz, tarih alanını boş bırak
                payload = {
                    eta_varis: null,
                    eta_note: "Yükleme çıkış tarihi bekleniyor",
                };
            } else {
                if (!plan?.eta) throw new Error("ETA hesaplanamadı.");
                const etaLocal = toLocalOffsetISO(plan.eta);
                payload = {
                    eta_varis: etaLocal,
                    eta_note: null,
                };
            }

            const q = supabase.from("seferler").update(payload);
            if (keyFilter.by === "id") q.eq("id", keyFilter.value);
            else q.eq("sefer_no", keyFilter.value);

            const { error } = await q;
            if (error) throw error;

            setSnack({ open: true, severity: "success", msg: "ETA kaydedildi." });
            onClose && onClose();
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
                    {plan.steps.map((s, i) => (
                        <StepCard key={i} step={s} />
                    ))}
                    <Divider sx={{ my: 0.5 }} />
                    <Paper
                        elevation={0}
                        sx={{
                            p: 1.25,
                            borderRadius: 2,
                            background: "linear-gradient(90deg,#22c55e22,#16a34a22)",
                            border: "1px solid #16a34a55",
                        }}
                    >
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
                        {/* eta_note varsa bilgi olarak göster */}
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
                <Paper
                    elevation={0}
                    sx={{
                        px: 2,
                        py: 1.25,
                        borderRadius: 2,
                        background: "linear-gradient(90deg,#F472B633,#38BDF833)",
                    }}
                >
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
                                            ? `${mesafeKm} km — Tahmini sürüş: ${sureStr} (≥ ${speedKmh} km/s)`
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
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            bgcolor: "warning.light",
                            color: "warning.contrastText",
                            border: (t) => `1px solid ${t.palette.warning.main}`,
                        }}
                    >
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                            Mesafe bulunmadan işlem yapılamaz.
                        </Typography>
                        <Typography variant="caption">
                            {distanceStatus === "loading"
                                ? "Mesafe hesaplanıyor…"
                                : "Hesaplama başarısız. Tekrar deneyin veya konumları kontrol edin."}
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
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="lex-end">
                        <TextField
                            label="Kalan Sürüş (saat:dakika)"
                            placeholder="örn: 2:00 veya 2.5"
                            size="small"
                            value={kalanSurusStr}
                            onChange={(e) => setKalanSurusStr(e.target.value)}
                            disabled={blocked}
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
                    <Button onClick={onClose} variant="text">
                        Vazgeç
                    </Button>
                    <Tooltip title={blocked ? "Mesafe hesaplanmadan kaydedemezsiniz." : ""}>
                        <span>
                            <Button variant="contained" onClick={handleSave} disabled={blocked}>
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
