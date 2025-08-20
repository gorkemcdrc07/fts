// src/Hakedisler/AracCariVeFiyat.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import "./AracCariVeFiyat.css";

function formatTL(value) {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return num.toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2,
    });
}
function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString("tr-TR");
}
// yardımcı: sayı alanlarını normalize et
const toNumberOrNull = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
};

export default function AracCariVeFiyat() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [savingId, setSavingId] = useState(null);

    const [editingId, setEditingId] = useState(null);       // "PLAKA-CARIID" string
    const [editingKey, setEditingKey] = useState(null);     // { plaka, cari_id } — eski anahtar
    const [editData, setEditData] = useState({});

    const [query, setQuery] = useState("");
    const [sortBy, setSortBy] = useState({ key: "plaka", dir: "asc" });

    useEffect(() => {
        let ignore = false;
        const fetchData = async () => {
            setLoading(true);
            setErr(null);
            const { data, error } = await supabase
                .from("arac_cari_ve_fiyat")
                .select("*");
            if (!ignore) {
                if (error) setErr(error.message || "Veri çekilemedi");
                else setRows(data || []);
                setLoading(false);
            }
        };
        fetchData();
        return () => { ignore = true; };
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(
            (r) =>
                (r.plaka || "").toLowerCase().includes(q) ||
                (r.cari_adi || "").toLowerCase().includes(q) ||
                String(r.cari_id || "").toLowerCase().includes(q)
        );
    }, [rows, query]);

    const sorted = useMemo(() => {
        const copy = [...filtered];
        const { key, dir } = sortBy;
        copy.sort((a, b) => {
            const va = a?.[key];
            const vb = b?.[key];
            const numericKeys = new Set(["aylik_kira", "aylik_surucu", "calisma_gunu", "cari_id"]);
            if (numericKeys.has(key)) {
                const na = Number(va ?? 0);
                const nb = Number(vb ?? 0);
                return dir === "asc" ? na - nb : nb - na;
            }
            if (key === "duzenleme_yapilan_tarih") {
                const da = va ? new Date(va).getTime() : 0;
                const db = vb ? new Date(vb).getTime() : 0;
                return dir === "asc" ? da - db : db - da;
            }
            const sa = (va ?? "").toString().toLowerCase();
            const sb = (vb ?? "").toString().toLowerCase();
            if (sa < sb) return dir === "asc" ? -1 : 1;
            if (sa > sb) return dir === "asc" ? 1 : -1;
            return 0;
        });
        return copy;
    }, [filtered, sortBy]);

    const toggleSort = (key) => {
        setSortBy((prev) => (prev.key !== key ? { key, dir: "asc" } : { key, dir: prev.dir === "asc" ? "desc" : "asc" }));
    };

    // Düzenlemeyi başlat
    const startEdit = (row) => {
        setEditingId(`${row.plaka}-${row.cari_id}`);
        setEditingKey({ plaka: row.plaka, cari_id: row.cari_id }); // eski anahtar tutulur
        setEditData({ ...row });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingKey(null);
        setEditData({});
    };

    // Kaydet (yalnızca düzenle modunda)
    const saveEdit = async () => {
        const payload = {
            cari_id: parseTLToNumber(editData.cari_id),
            cari_adi: editData.cari_adi ?? null,
            aylik_kira: parseTLToNumber(editData.aylik_kira),      // <<< güncellendi
            aylik_surucu: parseTLToNumber(editData.aylik_surucu),  // <<< güncellendi
            calisma_gunu: parseTLToNumber(editData.calisma_gunu),
            pasif: !!editData.pasif,
            aciklama: editData.aciklama ?? null,
            duzenleme_yapan_kullanici: "Admin",
            duzenleme_yapilan_tarih: new Date().toISOString(),
        };
        setSavingId(editingId);
        const { error } = await supabase
            .from("arac_cari_ve_fiyat")
            .update(payload)
            .eq("plaka", editingKey.plaka)        // eski anahtara göre hedefle
            .eq("cari_id", editingKey.cari_id);

        if (error) {
            alert("Kaydetme hatası: " + error.message);
        } else {
            // State'i güncelle — yeni değerlerle
            setRows((prev) =>
                prev.map((r) =>
                    r.plaka === editingKey.plaka && r.cari_id === editingKey.cari_id
                        ? { ...r, ...payload, plaka: r.plaka } // plaka sabit
                        : r
                )
            );
            cancelEdit();
        }
        setSavingId(null);
    };
    // "₺12.345,67" gibi metni Number'a çevirir
    function parseTLToNumber(v) {
        if (v === "" || v === null || v === undefined) return null;
        const s = String(v)
            .replace(/[^\d,.-]/g, "") // rakam, virgül, nokta, eksi dışını at
            .replace(/\./g, "")       // binlik noktaları at
            .replace(",", ".");       // ondalığı '.' yap
        const n = Number(s);
        return Number.isNaN(n) ? null : n;
    }

    // Yazarken input'u "12.345,67" şeklinde canlı formatlar
    function formatTLForTyping(input) {
        if (input === "" || input === null || input === undefined) return "";
        // yalnızca rakam ve virgüle izin ver (eksi istenirse eklenebilir)
        let s = String(input).replace(/[^\d,]/g, "");

        // birden fazla virgül varsa ilkini koru
        const firstComma = s.indexOf(",");
        if (firstComma !== -1) {
            const before = s.slice(0, firstComma);
            const after = s.slice(firstComma + 1).replace(/,/g, "");
            return addThousandDots(before) + "," + after;
        }
        return addThousandDots(s);
    }

    // Binlik noktaları ekler (sadece tam kısmı alır)
    function addThousandDots(intStr) {
        // baştaki sıfırları sadeleştir (tek sıfırı koru)
        const normalized = intStr.replace(/^0+(?=\d)/, "");
        return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }


    return (
        <div className="acf-page">
            <div className="acf-card">
                <h1 className="acf-title">Araç Cari & Fiyat</h1>

                <div className="acf-toolbar">
                    <input
                        className="acf-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Plaka, Cari Adı veya Cari ID ara…"
                    />
                    <div className="acf-meta">
                        {loading && "Yükleniyor…"}
                        {err && <span style={{ color: "crimson" }}>Hata: {err}</span>}
                        {!loading && !err && `Toplam: ${sorted.length}`}
                    </div>
                </div>

                <div className="acf-table-wrap">
                    <table className="acf-table">
                        <thead>
                            <tr>
                                <th className="acf-th-sortable" onClick={() => toggleSort("plaka")}>Plaka</th>
                                <th className="acf-th-sortable" onClick={() => toggleSort("cari_id")}>Cari ID</th>
                                <th className="acf-th-sortable" onClick={() => toggleSort("cari_adi")}>Cari Adı</th>
                                <th className="acf-th-sortable" onClick={() => toggleSort("aylik_kira")}>Aylık Kira</th>
                                <th className="acf-th-sortable" onClick={() => toggleSort("aylik_surucu")}>Aylık Sürücü</th>
                                <th className="acf-th-sortable" onClick={() => toggleSort("calisma_gunu")}>Çalışma Günü</th>
                                <th className="acf-th-sortable" onClick={() => toggleSort("pasif")}>Pasif</th>
                                <th className="acf-th-sortable" onClick={() => toggleSort("aciklama")}>Açıklama</th>
                                <th>Düzenle</th>
                                <th className="acf-th-sortable" onClick={() => toggleSort("duzenleme_yapan_kullanici")}>Düzenleyen</th>
                                <th className="acf-th-sortable" onClick={() => toggleSort("duzenleme_yapilan_tarih")}>Düzenleme Tarihi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((r, i) => {
                                const isEditing = editingId === `${r.plaka}-${r.cari_id}`;
                                return (
                                    <tr key={`${r.plaka}-${r.cari_id}-${i}`}>
                                        {/* plaka sabit */}
                                        <td title={r.plaka}>{r.plaka}</td>

                                        {/* cari_id */}
                                        <td>
                                            {isEditing ? (
                                                <input
                                                    value={editData.cari_id ?? ""}
                                                    onChange={(e) =>
                                                        setEditData((prev) => ({ ...prev, cari_id: e.target.value }))
                                                    }
                                                />
                                            ) : (
                                                r.cari_id
                                            )}
                                        </td>

                                        {/* cari_adi */}
                                        <td className="acf-ellipsis" title={r.cari_adi}>
                                            {isEditing ? (
                                                <input
                                                    value={editData.cari_adi ?? ""}
                                                    onChange={(e) =>
                                                        setEditData((prev) => ({ ...prev, cari_adi: e.target.value }))
                                                    }
                                                />
                                            ) : (
                                                r.cari_adi
                                            )}
                                        </td>

                                        {/* aylik_kira */}
                                        {/* aylik_kira */}
                                        <td className="acf-num" title={String(r.aylik_kira ?? "")}>
                                            {isEditing ? (
                                                <input
                                                    value={editData.aylik_kira ?? ""}
                                                    onChange={(e) =>
                                                        setEditData((prev) => ({
                                                            ...prev,
                                                            aylik_kira: formatTLForTyping(e.target.value),
                                                        }))
                                                    }
                                                    inputMode="decimal"
                                                    placeholder="0,00"
                                                />
                                            ) : (
                                                formatTL(r.aylik_kira)
                                            )}
                                        </td>
                                        {/* aylik_surucu */}
                                        <td className="acf-num" title={String(r.aylik_surucu ?? "")}>
                                            {isEditing ? (
                                                <input
                                                    value={editData.aylik_surucu ?? ""}
                                                    onChange={(e) =>
                                                        setEditData((prev) => ({
                                                            ...prev,
                                                            // yazdıkça TL formatına çevir
                                                            aylik_surucu: formatTLForTyping(e.target.value),
                                                        }))
                                                    }
                                                    inputMode="decimal"
                                                    placeholder="0,00"
                                                />
                                            ) : (
                                                formatTL(r.aylik_surucu)
                                            )}
                                        </td>

                                        {/* calisma_gunu */}
                                        <td className="acf-center" title={String(r.calisma_gunu ?? "")}>
                                            {isEditing ? (
                                                <input
                                                    value={editData.calisma_gunu ?? ""}
                                                    onChange={(e) =>
                                                        setEditData((prev) => ({ ...prev, calisma_gunu: e.target.value }))
                                                    }
                                                />
                                            ) : (
                                                r.calisma_gunu ?? ""
                                            )}
                                        </td>

                                        {/* pasif — SADECE DÜZENLE MODUNDA DEĞİŞTİRİLEBİLİR */}
                                        <td className="acf-center">
                                            <input
                                                type="checkbox"
                                                checked={isEditing ? !!editData.pasif : !!r.pasif}
                                                onChange={(e) =>
                                                    isEditing &&
                                                    setEditData((prev) => ({ ...prev, pasif: e.target.checked }))
                                                }
                                                disabled={!isEditing || savingId === `${r.plaka}-${r.cari_id}`}
                                            />
                                        </td>

                                        {/* aciklama */}
                                        <td className="acf-ellipsis" title={r.aciklama ?? ""}>
                                            {isEditing ? (
                                                <input
                                                    value={editData.aciklama ?? ""}
                                                    onChange={(e) =>
                                                        setEditData((prev) => ({ ...prev, aciklama: e.target.value }))
                                                    }
                                                />
                                            ) : (
                                                r.aciklama
                                            )}
                                        </td>

                                        {/* düzenle / kaydet-iptal */}
                                        <td>
                                            {isEditing ? (
                                                <>
                                                    <button onClick={saveEdit} disabled={savingId === editingId}>✅</button>
                                                    <button onClick={cancelEdit} disabled={savingId === editingId}>❌</button>
                                                </>
                                            ) : (
                                                <button onClick={() => startEdit(r)}>Düzenle</button>
                                            )}
                                        </td>

                                        {/* düzenleyen / tarih (salt-okunur) */}
                                        <td title={r.duzenleme_yapan_kullanici ?? ""}>
                                            {r.duzenleme_yapan_kullanici}
                                        </td>
                                        <td title={formatDate(r.duzenleme_yapilan_tarih)}>
                                            {formatDate(r.duzenleme_yapilan_tarih)}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && !err && sorted.length === 0 && (
                                <tr>
                                    <td colSpan={11} style={{ padding: 16, textAlign: "center" }}>
                                        Kayıt bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
