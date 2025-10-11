import React, { useMemo } from "react";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// Dayjs setup
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Dashboard (üst bilgi/özet alanı)
 *
 * Kullanım:
 *  <Dashboard
 *    seferler={rowsFromAPI}
 *    nowTz="Europe/Istanbul"
 *    getKapandi={(s) => Boolean(s.kapandi || s.kapanis_tarihi)}
 *    etaField="eta_cikis" // (opsiyonel; default: 'eta_cikis')
 *    detayAccessor={(s) => s.sefer_detaylari}
 *    onFilterStage={(stage) => setLocalFilter(stage)} // (opsiyonel)
 *  />
 *
 * Beklenen alanlar (örn.):
 *  - eta_cikis: ISO string veya "DD.MM.YYYY HH:mm" gibi parse edilebilir tarih
 *  - sefer_detaylari: { yukleme_varis?, yukleme_cikis?, teslim_varis?, teslim_cikis? }
 *  - kapandi/kapanis_tarihi vb.: seferin kapanıp kapanmadığı
 */

function parseDateFlex(value, tz = "Europe/Istanbul") {
    if (!value) return null;
    // dayjs, ISO'yu zaten parse ediyor; TR formatlarını da deneyelim
    const tryFormats = [
        "DD.MM.YYYY HH:mm",
        "DD.MM.YYYY H:mm",
        "YYYY-MM-DD HH:mm",
        "YYYY-MM-DDTHH:mm",
        "YYYY-MM-DDTHH:mm:ssZ",
        "YYYY-MM-DDTHH:mm:ss.SSSZ",
    ];
    let d = dayjs.tz(value, tz);
    if (d.isValid()) return d;
    for (const f of tryFormats) {
        d = dayjs.tz(dayjs(value, f), tz);
        if (d.isValid()) return d;
    }
    return null;
}

function computeStage(detay = {}) {
    // Aşamayı belirle (en ileriden geri doğru):
    if (detay.teslim_cikis) return "COMPLETED"; // teslimat çıkışı yapılmış -> iş tamam
    if (detay.teslim_varis) return "DELIVERY_ARRIVED"; // teslimata varılmış
    if (detay.yukleme_cikis) return "IN_TRANSIT"; // yüklemeden çıkılmış -> yolda
    if (detay.yukleme_varis) return "PICKUP_ARRIVED"; // yüklemeye varılmış
    return "ASSIGNED"; // henüz ilerleme yok
}

function stageMeta(stage) {
    switch (stage) {
        case "COMPLETED":
            return { label: "Tamamlandı", badge: "bg-emerald-100 text-emerald-800", row: "bg-emerald-50" };
        case "DELIVERY_ARRIVED":
            return { label: "Teslim Varış", badge: "bg-sky-100 text-sky-800", row: "bg-sky-50" };
        case "IN_TRANSIT":
            return { label: "Yolda", badge: "bg-amber-100 text-amber-800", row: "bg-amber-50" };
        case "PICKUP_ARRIVED":
            return { label: "Yükleme Varış", badge: "bg-indigo-100 text-indigo-800", row: "bg-indigo-50" };
        default:
            return { label: "Atandı", badge: "bg-zinc-100 text-zinc-800", row: "bg-white" };
    }
}

function isDelayed(sefer, opts) {
    const { tz = "Europe/Istanbul", etaField = "eta_cikis", getKapandi } = opts;
    const eta = parseDateFlex(sefer?.[etaField], tz);
    if (!eta) return false;
    const kapandi = typeof getKapandi === "function" ? getKapandi(sefer) : Boolean(sefer?.kapandi || sefer?.kapanis || sefer?.kapanis_tarihi || sefer?.kapandi_mi);
    return !kapandi && eta.isBefore(dayjs.tz(tz));
}

export function getRowClass(sefer, opts = {}) {
    const detay = (typeof opts.detayAccessor === "function" ? opts.detayAccessor(sefer) : sefer?.sefer_detaylari) || {};
    const stage = computeStage(detay);
    const meta = stageMeta(stage);
    const delayed = isDelayed(sefer, opts);
    return [
        meta.row,
        delayed ? "ring-2 ring-red-400" : "",
    ]
        .filter(Boolean)
        .join(" ");
}

export default function Dashboard({
    seferler = [],
    nowTz = "Europe/Istanbul",
    etaField = "eta_cikis",
    getKapandi,
    detayAccessor,
    onFilterStage,
}) {
    const now = dayjs.tz(nowTz);

    const stats = useMemo(() => {
        const base = {
            total: 0,
            delayed: 0,
            byStage: {
                ASSIGNED: 0,
                PICKUP_ARRIVED: 0,
                IN_TRANSIT: 0,
                DELIVERY_ARRIVED: 0,
                COMPLETED: 0,
            },
        };

        const items = seferler.map((s) => {
            const detay = (typeof detayAccessor === "function" ? detayAccessor(s) : s?.sefer_detaylari) || {};
            const stage = computeStage(detay);
            const delayed = isDelayed(s, { tz: nowTz, etaField, getKapandi });
            return { sefer: s, stage, delayed, detay };
        });

        for (const it of items) {
            base.total += 1;
            base.byStage[it.stage] += 1;
            if (it.delayed) base.delayed += 1;
        }

        return { ...base, items };
    }, [seferler, nowTz, etaField, getKapandi, detayAccessor]);

    const cards = [
        {
            key: "total",
            title: "Toplam Sefer",
            value: stats.total,
            desc: "Aktif atamalar",
        },
        {
            key: "delayed",
            title: "Gecikme",
            value: stats.delayed,
            desc: "ETA'sı geçti / kapanmadı",
            emphasis: true,
        },
    ];

    const stageOrder = [
        "ASSIGNED",
        "PICKUP_ARRIVED",
        "IN_TRANSIT",
        "DELIVERY_ARRIVED",
        "COMPLETED",
    ];

    return (
        <div className="w-full space-y-5">
            {/* Üst sayaçlar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {cards.map((c, i) => (
                    <motion.div
                        key={c.key}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`rounded-2xl border p-4 shadow-sm ${c.emphasis ? "bg-red-50 border-red-200" : "bg-white"}`}
                    >
                        <div className="text-sm text-zinc-500">{c.title}</div>
                        <div className={`mt-1 text-2xl font-semibold ${c.emphasis ? "text-red-700" : "text-zinc-900"}`}>{c.value}</div>
                        <div className="text-xs text-zinc-500 mt-1">{c.desc}</div>
                    </motion.div>
                ))}
                {stageOrder.map((sKey, i) => {
                    const meta = stageMeta(sKey);
                    return (
                        <motion.div
                            key={sKey}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: (i + cards.length) * 0.05 }}
                            className="rounded-2xl border p-4 shadow-sm bg-white"
                        >
                            <div className="text-sm text-zinc-500">{meta.label}</div>
                            <div className="mt-1 text-2xl font-semibold text-zinc-900">{stats.byStage[sKey]}</div>
                            <div className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${meta.badge}`}>{sKey}</div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Geciken seferler kısa liste */}
            {stats.delayed > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl border border-red-200 bg-red-50 p-4"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-semibold text-red-700">Geciken Seferler</div>
                            <div className="text-xs text-red-700/80">Şu an itibarıyla: {now.format("DD.MM.YYYY HH:mm")}</div>
                        </div>
                        {typeof onFilterStage === "function" && (
                            <button
                                onClick={() => onFilterStage("DELAYED")}
                                className="text-xs rounded-lg border border-red-400 px-2 py-1 text-red-700 hover:bg-red-100"
                            >
                                Tabloyu Gecikmelere Filtrele
                            </button>
                        )}
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {stats.items
                            .filter((it) => it.delayed)
                            .slice(0, 6)
                            .map((it, idx) => (
                                <div key={idx} className="rounded-xl bg-white/60 backdrop-blur border border-red-200 p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium text-zinc-800">Sefer #{it.sefer?.id ?? it.sefer?.sefer_no ?? idx + 1}</div>
                                        <span className="text-xs text-red-700">ETA geçti</span>
                                    </div>
                                    <div className="text-xs text-zinc-600 mt-1">
                                        ETA Çıkış: {parseDateFlex(it.sefer?.[etaField])?.format("DD.MM.YYYY HH:mm") || "-"}
                                    </div>
                                </div>
                            ))}
                    </div>
                </motion.div>
            )}

            {/* Aşama lejandı */}
            <div className="rounded-2xl border p-4 bg-white">
                <div className="text-sm font-semibold text-zinc-800">Aşama Renkleri</div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                    {stageOrder.map((sKey) => {
                        const meta = stageMeta(sKey);
                        return (
                            <div key={sKey} className={`rounded-xl border p-3 ${meta.row}`}>
                                <div className="font-medium text-zinc-800">{meta.label}</div>
                                <div className="text-zinc-600 mt-1">Satır arkaplanı: <span className={`px-2 py-0.5 rounded ${meta.badge}`}>{sKey}</span></div>
                            </div>
                        );
                    })}
                    <div className="rounded-xl border p-3 bg-white ring-2 ring-red-400">
                        <div className="font-medium text-zinc-800">Gecikme</div>
                        <div className="text-zinc-600 mt-1">ETA geçti & kapatılmadı → kırmızı halka</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Yardımcı: tablodaki satıra className uygulamak için.
 * Örnek kullanım (ReelAtananSeferler.js içinde):
 *
 *   <tr className={getRowClass(row, {
 *     tz: 'Europe/Istanbul',
 *     etaField: 'eta_cikis',
 *     getKapandi: (s) => Boolean(s.kapandi || s.kapanis_tarihi),
 *     detayAccessor: (s) => s.sefer_detaylari,
 *   })}>
 */
