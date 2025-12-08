/**  MODERN DARK UI – GÜNCELLENMİŞ DÜZENLENMİŞ SÜRÜM  **/
import React, { useCallback, useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import {
    FiCalendar,
    FiRefreshCw,
    FiDownload,
    FiAlertTriangle,
    FiClock,
    FiTruck,
    FiUser,
    FiArrowUp,
    FiArrowDown
} from "react-icons/fi";

/* ============================================================
   SABİTLER
============================================================ */
const DETAIL_TABLE = "tamamlanan_detaylar";
const SUMMARY_TABLE = "tamamlanan_seferler";
const MINIMUM_WAIT_TIME_MINUTES = 240;

const SUMMARY_COLS = [
    "id", "sefer_no", "plaka", "treyler", "surucu_ad_soyad", "surucu_tckn",
    "surucu_telefon", "sefer_tarihi", "yukleme_ili", "yukleme_ilcesi",
    "teslim_ili", "teslim_ilcesi", "musteri_adi", "yukleme_noktasi",
    "teslim_noktasi", "proje_adi"
].join(",");

const DETAIL_COLS = [
    "sefer_no", "nokta_sirasi", "yukleme_noktasi", "teslim_noktasi",
    "yukleme_varis", "yukleme_cikis", "teslim_varis", "teslim_cikis"
].join(",");

/* ============================================================
   YARDIMCI FONKSIYONLAR
============================================================ */
const parseDT = (v) => {
    const d = dayjs(v);
    return d.isValid() ? d : null;
};

const fmtDateTR = (v) => {
    const d = parseDT(v);
    return d ? d.format("DD.MM.YYYY HH:mm") : "—";
};

const minToHM = (m) => {
    const mm = Math.max(0, Math.round(m || 0));
    const h = Math.floor(mm / 60);
    const r = mm % 60;
    if (h && r) return `${h} sa ${r} dk`;
    if (h) return `${h} sa`;
    if (r) return `${r} dk`;
    return `0 dk`;
};

const diffMinutes = (start, end) => {
    const s = parseDT(start);
    const e = parseDT(end);
    if (!s || !e) return null;
    return Math.max(0, e.diff(s, "minute"));
};

/* ============================================================
   ANA KOMPONENT
============================================================ */
export default function CleanFetcher() {

    /* ========== STATE ========== */
    const [rows, setRows] = useState([]);
    const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [loading, setLoading] = useState(false);
    const [columnFilters, setColumnFilters] = useState({});

    const [sortKey, setSortKey] = useState("toplam_bekleme_dk");
    const [sortDirection, setSortDirection] = useState("desc");

    /* ============================================================
       SÜTUN FİLTRELERİ
    ============================================================ */
    const handleFilterChange = (key, value) => {
        setColumnFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleSort = (key) => {
        if (key === sortKey) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    /* ============================================================
       VERİ ÇEKME
    ============================================================ */
    const fetchAll = useCallback(async (dateString) => {
        setLoading(true);
        setRows([]);
        setColumnFilters({});

        const dayStart = dayjs(dateString).startOf("day").toISOString();
        const dayEnd = dayjs(dateString).endOf("day").toISOString();

        try {
            const { data: details, error: e1 } = await supabase
                .from(DETAIL_TABLE)
                .select(DETAIL_COLS)
                .gte("yukleme_varis", dayStart)
                .lte("yukleme_varis", dayEnd);

            if (e1) throw e1;

            if (!details?.length) {
                setRows([]);
                setLoading(false);
                return;
            }

            const seferNos = [...new Set(details.map(x => x.sefer_no))];

            const { data: summary, error: e2 } = await supabase
                .from(SUMMARY_TABLE)
                .select(SUMMARY_COLS)
                .in("sefer_no", seferNos);

            if (e2) throw e2;

            const finalRows = [];

            summary.forEach((summaryRow) => {
                const group = details.filter(d => d.sefer_no === summaryRow.sefer_no);

                const uniqueNoktalar = new Set();
                const uniqueProjeler = new Set();

                let firstArrival = null;
                let lastLeave = null;

                group.forEach(rec => {
                    const v = parseDT(rec.yukleme_varis);
                    const c = parseDT(rec.yukleme_cikis);

                    if (v && (!firstArrival || v.isBefore(firstArrival)))
                        firstArrival = v;

                    if (c && (!lastLeave || c.isAfter(lastLeave)))
                        lastLeave = c;

                    if (summaryRow.yukleme_noktasi) uniqueNoktalar.add(summaryRow.yukleme_noktasi);
                    if (summaryRow.proje_adi) uniqueProjeler.add(summaryRow.proje_adi);
                });

                // ✅ Gerçek bekleme süresi: son çıkış - ilk varış
                let total = null;

                if (firstArrival && lastLeave) {
                    total = diffMinutes(firstArrival, lastLeave);
                }


                if (total >= MINIMUM_WAIT_TIME_MINUTES) {
                    finalRows.push({
                        ...summaryRow,
                        yukleme_noktalari_birlesik: [...uniqueNoktalar].join(" ; "),
                        proje_adlari_birlesik: [...uniqueProjeler].join(" ; "),
                        toplam_bekleme_dk: total,
                        ilk_yukleme_varis: firstArrival?.toISOString(),
                        son_yukleme_cikis: lastLeave?.toISOString(),
                    });
                }
            });

            setRows(finalRows);
        } catch (err) {
            console.error("Veri çekme hatası:", err.message);
        }

        setLoading(false);
    }, []);

    /* ============================================================
       FİLTRELENMİŞ + SIRALANMIŞ VERİ
    ============================================================ */
    const filteredAndSortedRows = useMemo(() => {
        let temp = [...rows];

        Object.keys(columnFilters).forEach(key => {
            const filter = columnFilters[key]?.toLowerCase() ?? "";
            if (filter.trim() === "") return;

            temp = temp.filter(row => {
                let val = row[key];
                if (!val) val = "";

                if (key === "toplam_bekleme_dk") val = minToHM(val).toLowerCase();
                else if (key.includes("varis") || key.includes("cikis")) val = fmtDateTR(val).toLowerCase();
                else val = String(val).toLowerCase();

                return val.includes(filter);
            });
        });

        if (sortKey) {
            temp.sort((a, b) => {
                const av = a[sortKey];
                const bv = b[sortKey];

                if (typeof av === "number") {
                    return sortDirection === "asc" ? av - bv : bv - av;
                }

                return sortDirection === "asc"
                    ? String(av).localeCompare(String(bv))
                    : String(bv).localeCompare(String(av));
            });
        }

        return temp;
    }, [rows, columnFilters, sortKey, sortDirection]);

    /* ============================================================
       OTOMATİK VERİ ÇEK
    ============================================================ */
    useEffect(() => {
        fetchAll(selectedDate);
    }, [selectedDate, fetchAll]);

    /* ============================================================
       EXCEL EXPORT
    ============================================================ */
    const exportExcel = async () => {
        if (!filteredAndSortedRows.length) return;

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Uzun Bekleme Raporu");

        const data = filteredAndSortedRows.map(r => ({
            "Sefer No": r.sefer_no,
            "Plaka": r.plaka,
            "Şoför": r.surucu_ad_soyad,
            "Proje": r.proje_adlari_birlesik,
            "Yükleme Noktası": r.yukleme_noktalari_birlesik,
            "İlk Varış": fmtDateTR(r.ilk_yukleme_varis),
            "Son Çıkış": fmtDateTR(r.son_yukleme_cikis),
            "Bekleme Süresi": minToHM(r.toplam_bekleme_dk),
        }));

        ws.columns = Object.keys(data[0]).map(k => ({
            header: k,
            key: k,
            width: 25
        }));

        ws.addRows(data);

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf]), `bekleme_raporu_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
    };

    /* ============================================================
       UI RENKLERİ
    ============================================================ */
    const UI = {
        darkBg: "#121212",
        cardBg: "#1e1e1e",
        tableBg: "#262626",
        border: "1px solid #333",
        text: "#fff",
        primary: "#4a90e2",
        danger: "#ff6b6b",
        hover: "#333"
    };

    const headers = [
        { key: "sefer_no", label: "Sefer No", icon: FiTruck, sortable: true },
        { key: "plaka", label: "Plaka", icon: FiTruck, sortable: true },
        { key: "surucu_ad_soyad", label: "Şoför", icon: FiUser, sortable: true },
        { key: "proje_adlari_birlesik", label: "Proje Adı", icon: FiClock, sortable: true },
        { key: "yukleme_noktalari_birlesik", label: "Yükleme Noktası", icon: FiClock, sortable: true },
        { key: "ilk_yukleme_varis", label: "İlk Varış", icon: FiCalendar, sortable: true },
        { key: "son_yukleme_cikis", label: "Son Çıkış", icon: FiCalendar, sortable: true },
        { key: "toplam_bekleme_dk", label: "Bekleme Süresi", icon: FiAlertTriangle, sortable: true }
    ];

    /* ============================================================
       RENDER
    ============================================================ */
    return (
        <div style={{
            background: UI.darkBg,
            minHeight: "100vh",
            padding: 40,
            color: UI.text,
            fontFamily: "Inter, sans-serif"
        }}>

            {/* BAŞLIK */}
            <h1 style={{
                fontSize: 28,
                fontWeight: 800,
                borderLeft: `5px solid ${UI.danger}`,
                paddingLeft: 15,
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 35,
                color: UI.danger
            }}>
                <FiAlertTriangle size={28} /> YÜKSEK BEKLEME ANALİZİ
            </h1>

            {/* KONTROLLER */}
            <div style={{
                background: UI.cardBg,
                padding: 20,
                borderRadius: 10,
                border: UI.border,
                marginBottom: 30,
                display: "flex",
                alignItems: "center",
                gap: 25,
                flexWrap: "wrap"
            }}>
                {/* TARİH */}
                <div>
                    <label style={{ fontSize: 14, marginBottom: 6, display: "block" }}>
                        <FiCalendar /> Tarih
                    </label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{
                            padding: "10px 15px",
                            background: "#2c2c2c",
                            color: UI.text,
                            borderRadius: 6,
                            border: UI.border
                        }}
                    />
                </div>

                {/* BİLGİ ÇİPİ */}
                <div style={{
                    padding: "10px 15px",
                    background: "rgba(255, 107, 107, 0.25)",
                    color: UI.danger,
                    borderRadius: 6,
                    fontWeight: 600
                }}>
                    <FiClock /> Yalnızca **4 saat ve üzeri** beklemeler gösterilir.
                </div>

                {/* BUTONLAR */}
                <div style={{ marginLeft: "auto", display: "flex", gap: 15 }}>
                    <button
                        onClick={() => fetchAll(selectedDate)}
                        disabled={loading}
                        style={{
                            padding: "12px 25px",
                            background: UI.primary,
                            borderRadius: 8,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color: "#fff",
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        <FiRefreshCw className={loading ? "spin" : ""} />
                        Yenile
                    </button>

                    <button
                        onClick={exportExcel}
                        disabled={!filteredAndSortedRows.length}
                        style={{
                            padding: "12px 25px",
                            background: "#2ecc71",
                            borderRadius: 8,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color: "#fff",
                            opacity: !filteredAndSortedRows.length ? 0.6 : 1
                        }}
                    >
                        <FiDownload /> Excel ({filteredAndSortedRows.length})
                    </button>
                </div>
            </div>

            {/* YÜKLENİYOR */}
            {loading && (
                <p style={{ fontSize: 20, color: UI.primary }}>
                    <FiRefreshCw className="spin" /> Veriler getiriliyor...
                </p>
            )}

            {/* KAYIT YOK */}
            {!loading && rows.length === 0 && (
                <p style={{
                    background: "rgba(255,0,0,0.15)",
                    padding: 15,
                    borderRadius: 8,
                    fontWeight: 600,
                    color: UI.danger
                }}>
                    <FiAlertTriangle /> Seçilen tarihte uzun bekleme kaydı bulunamadı.
                </p>
            )}

            {/* TABLO */}
            {!loading && rows.length > 0 && (
                <div style={{
                    background: UI.cardBg,
                    padding: 10,
                    borderRadius: 10,
                    border: UI.border,
                    overflowX: "auto",
                    maxHeight: "70vh"
                }}>
                    <table style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        color: UI.text
                    }}>
                        {/* BAŞLIK */}
                        <thead>
                            <tr>
                                {headers.map(h => (
                                    <th key={h.key} style={{
                                        padding: 12,
                                        background: "#2f2f2f",
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 5,
                                        textAlign: "left",
                                        borderBottom: "2px solid #444"
                                    }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                cursor: h.sortable ? "pointer" : "default"
                                            }}
                                            onClick={() => h.sortable && handleSort(h.key)}
                                        >
                                            <h.icon size={16} color={UI.primary} />
                                            {h.label}
                                            {sortKey === h.key && (
                                                sortDirection === "asc"
                                                    ? <FiArrowUp />
                                                    : <FiArrowDown />
                                            )}
                                        </div>

                                        <input
                                            type="text"
                                            placeholder="Filtrele..."
                                            value={columnFilters[h.key] || ""}
                                            onChange={(e) => handleFilterChange(h.key, e.target.value)}
                                            style={{
                                                width: "100%",
                                                marginTop: 8,
                                                padding: 6,
                                                background: "#222",
                                                border: "1px solid #444",
                                                borderRadius: 6,
                                                color: "#fff"
                                            }}
                                        />
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        {/* İÇERİK */}
                        <tbody>
                            {filteredAndSortedRows.map((r, idx) => (
                                <tr key={idx} style={{ background: idx % 2 ? "#1b1b1b" : "transparent" }}>
                                    <td style={{ padding: 12 }}>{r.sefer_no}</td>
                                    <td style={{ padding: 12, color: UI.primary }}>{r.plaka}</td>
                                    <td style={{ padding: 12 }}>{r.surucu_ad_soyad}</td>

                                    <td style={{ padding: 12 }}>
                                        <span style={{
                                            background: "rgba(74,144,226,0.2)",
                                            padding: "4px 8px",
                                            borderRadius: 6
                                        }}>
                                            {r.proje_adlari_birlesik}
                                        </span>
                                    </td>

                                    <td style={{ padding: 12 }}>{r.yukleme_noktalari_birlesik}</td>

                                    <td style={{ padding: 12 }}>
                                        <FiCalendar size={14} style={{ marginRight: 6 }} />
                                        {fmtDateTR(r.ilk_yukleme_varis)}
                                    </td>

                                    <td style={{ padding: 12 }}>
                                        <FiCalendar size={14} style={{ marginRight: 6 }} />
                                        {fmtDateTR(r.son_yukleme_cikis)}
                                    </td>

                                    <td style={{
                                        padding: 12,
                                        fontWeight: 700,
                                        color: UI.danger
                                    }}>
                                        {minToHM(r.toplam_bekleme_dk)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <p style={{ marginTop: 10, textAlign: "right", color: "#aaa" }}>
                        Toplam {rows.length} seferden {filteredAndSortedRows.length} tanesi gösteriliyor.
                    </p>
                </div>
            )}
        </div>
    );
}
