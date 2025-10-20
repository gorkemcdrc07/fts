// src/Hakedisler/AracCariVeFiyat.js
import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

// MUI - Bileşenler
import {
    Box,
    Container,
    Paper,
    Typography,
    TextField,
    InputAdornment,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableContainer,
    TableFooter,
    IconButton,
    Tooltip,
    Chip,
    Stack,
    Checkbox,
    CircularProgress,
    Divider,
    Button,
    Badge,
    Drawer,
    ToggleButtonGroup,
    ToggleButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
} from "@mui/material";

// MUI - Iconlar
import {
    ArrowUpward,
    ArrowDownward,
    ImportExport,
    Edit as EditIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Search as SearchIcon,
    Download as DownloadIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    ClearAll as ClearAllIcon,
    Tune as TuneIcon,
    HomeOutlined as HomeIcon,
    ArrowBackIosNew as ArrowBackIcon,
} from "@mui/icons-material";

import { utils as XLSXUtils, writeFile as XLSXWriteFile } from "xlsx";

/* ===================== Sabitler & Yetkilendirme ===================== */
const HOME_PATH = "/anasayfa";
const SCREEN_KEY = "arac_cari_fiyat"; // 👈 bu ekranın anahtarı (RolesTab / UserOverridesTab'ta da aynı olmalı)

/* Kullanıcı -> Rol -> Rol İzni + Kullanıcı Override birleştirme */
function coalesceOverride(overrideVal, roleVal) {
    return overrideVal === true || overrideVal === false ? overrideVal : !!roleVal;
}

/* ===================== Helpers ===================== */
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
function toNumberLoose(v) {
    if (v === "" || v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    const s = String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
}
function parseTLToNumber(v) {
    if (v === "" || v === null || v === undefined) return null;
    const s = String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
}
function formatTLForTyping(input) {
    if (input === "" || input === null || input === undefined) return "";
    let s = String(input).replace(/[^\d,]/g, "");
    const firstComma = s.indexOf(",");
    if (firstComma !== -1) {
        const before = s.slice(0, firstComma);
        const after = s.slice(firstComma + 1).replace(/,/g, "");
        return addThousandDots(before) + "," + after;
    }
    return addThousandDots(s);
}
function addThousandDots(intStr) {
    const normalized = intStr.replace(/^0+(?=\d)/, "");
    return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* ===================== Component ===================== */
export default function AracCariVeFiyat() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [savingId, setSavingId] = useState(null);

    const [editingId, setEditingId] = useState(null); // "PLAKA-CARIID"
    const [editingKey, setEditingKey] = useState(null); // { plaka, cari_id }
    const [editData, setEditData] = useState({});

    const [query, setQuery] = useState(""); // global arama
    const [sortBy, setSortBy] = useState({ key: "plaka", dir: "asc" });
    const [onlyActive, setOnlyActive] = useState(false);

    // Yeni kayıt formu (Dialog)
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({
        plaka: "",
        cari_id: "",
        cari_adi: "",
        arac_sahip: "",
        aylik_kira: "",
        aylik_surucu: "",
        calisma_gunu: "",
        pasif: false,
        aciklama: "",
    });
    const [addError, setAddError] = useState(null);
    const [adding, setAdding] = useState(false);

    // Filtreler
    const [filters, setFilters] = useState({
        plaka: "",
        cari_id: "",
        cari_adi: "",
        arac_sahip: "",
        aylik_kira_min: "",
        aylik_kira_max: "",
        aylik_surucu_min: "",
        aylik_surucu_max: "",
        toplam_min: "",
        toplam_max: "",
        calisma_gunu_min: "",
        calisma_gunu_max: "",
        pasif: "hepsi",
        aciklama: "",
        duzenleyen: "",
        tarih_from: "",
        tarih_to: "",
    });
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [tempFilters, setTempFilters] = useState(filters);

    const navigate = useNavigate();

    const wrapRef = useRef(null);
    const tableRef = useRef(null);

    /* --------- Yetkilendirme Durumu --------- */
    const [permLoading, setPermLoading] = useState(true);
    const [perms, setPerms] = useState({
        canCreate: false,
        canEditAny: false,
        fields: {
            cari_id: false,
            cari_adi: false,
            arac_sahibi: false,
            odak_arac_calisma_tipi: false,
            aylik_kira: false,
            aylik_surucu: false,
            calisma_gunu: false,
            pasif: false,
        },
    });

    // Yetki yükleme fonksiyonu (Değişmedi)
    async function loadPermissions() {
        try {
            setPermLoading(true);
            const userId = parseInt(localStorage.getItem("kullaniciId") || "", 10);
            const looksLikeUUID = (s) =>
                typeof s === "string" &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
            const { data: userRow, error: eU } = await supabase.from("login").select("id, rol, kullanici").eq("id", userId).maybeSingle();
            if (eU) throw eU;
            let roleId = null;
            if (userRow?.rol) {
                if (looksLikeUUID(userRow.rol)) {
                    roleId = userRow.rol;
                } else {
                    const roleKey = String(userRow.rol || "").toUpperCase();
                    const { data: roleRow, error: eR } = await supabase.from("roles").select("id,key").eq("key", roleKey).maybeSingle();
                    if (eR) throw eR;
                    roleId = roleRow?.id || null;
                }
            }
            let rolePerm = {};
            if (roleId) {
                const { data: rp, error: eRP } = await supabase
                    .from("role_permissions")
                    .select(`acf_create, acf_edit, acf_delete, acf_edit_cari_id, acf_edit_cari_adi, acf_edit_arac_sahibi, acf_edit_odak_tipi, acf_edit_aylik_kira, acf_edit_aylik_surucu, acf_edit_calisma_gunu, acf_edit_pasif`)
                    .eq("screen_key", "arac_cari_fiyat")
                    .eq("role_id", roleId)
                    .maybeSingle();
                if (eRP) throw eRP;
                rolePerm = rp || {};
            }
            const { data: up, error: eUP } = await supabase
                .from("user_permissions")
                .select(`acf_create, acf_edit, acf_delete, acf_edit_cari_id, acf_edit_cari_adi, acf_edit_arac_sahibi, acf_edit_odak_tipi, acf_edit_aylik_kira, acf_edit_aylik_surucu, acf_edit_calisma_gunu, acf_edit_pasif`)
                .eq("user_id", userRow?.id)
                .maybeSingle();
            if (eUP) throw eUP;

            const coalesce = (ovr, role) => (ovr === true || ovr === false) ? ovr : !!role;

            const canCreate = coalesce(up?.acf_create, rolePerm?.acf_create);
            const fields = {
                cari_id: coalesce(up?.acf_edit_cari_id, rolePerm?.acf_edit_cari_id),
                cari_adi: coalesce(up?.acf_edit_cari_adi, rolePerm?.acf_edit_cari_adi),
                arac_sahibi: coalesce(up?.acf_edit_arac_sahibi, rolePerm?.acf_edit_arac_sahibi),
                odak_arac_calisma_tipi: coalesce(up?.acf_edit_odak_tipi, rolePerm?.acf_edit_odak_tipi),
                aylik_kira: coalesce(up?.acf_edit_aylik_kira, rolePerm?.acf_edit_aylik_kira),
                aylik_surucu: coalesce(up?.acf_edit_aylik_surucu, rolePerm?.acf_edit_aylik_surucu),
                calisma_gunu: coalesce(up?.acf_edit_calisma_gunu, rolePerm?.acf_edit_calisma_gunu),
                pasif: coalesce(up?.acf_edit_pasif, rolePerm?.acf_edit_pasif),
            };
            const generalEdit = coalesce(up?.acf_edit, rolePerm?.acf_edit);
            const canEditAny = !!generalEdit || Object.values(fields).some(Boolean);
            setPerms({ canCreate, canEditAny, fields });
        } catch (e) {
            console.error("perm load error:", e);
            setPerms({
                canCreate: false, canEditAny: false,
                fields: { cari_id: false, cari_adi: false, arac_sahibi: false, odak_arac_calisma_tipi: false, aylik_kira: false, aylik_surucu: false, calisma_gunu: false, pasif: false }
            });
        } finally {
            setPermLoading(false);
        }
    }


    /* --------- Ölçekleme (Aynı kalır) --------- */
    useLayoutEffect(() => {
        function fit() {
            const wrap = wrapRef.current;
            const tbl = tableRef.current;
            if (!wrap || !tbl) return;

            const wrapW = wrap.clientWidth;
            const tblW = tbl.scrollWidth;
            const scale = Math.min(1, wrapW / Math.max(1, tblW));

            wrap.style.setProperty("--acf-scale", String(scale));
            tbl.style.width = scale < 1 ? `calc(100% / var(--acf-scale))` : "100%";
        }

        fit();
        const ro = new ResizeObserver(fit);
        if (wrapRef.current) ro.observe(wrapRef.current);
        return () => ro.disconnect();
    }, []);

    const activeFilterCount = useMemo(() => {
        const { pasif, ...rest } = filters;
        let c = Object.values(rest).filter((v) => v !== "" && v !== null).length;
        if (filters.pasif !== "hepsi") c += 1;
        return c + (onlyActive && filters.pasif === "hepsi" ? 1 : 0);
    }, [filters, onlyActive]);

    // Veri çekme fonksiyonu (Değişmedi)
    const refetch = async () => {
        setLoading(true);
        setErr(null);
        const { data, error } = await supabase.from("arac_cari_ve_fiyat").select("*");
        if (error) setErr(error.message || "Veri çekilemedi");
        else setRows(data || []);
        setLoading(false);
    };

    useEffect(() => {
        let ignore = false;
        const run = async () => {
            setLoading(true);
            setErr(null);
            const { data, error } = await supabase.from("arac_cari_ve_fiyat").select("*");
            if (!ignore) {
                if (error) setErr(error.message || "Veri çekilemedi");
                else setRows(data || []);
                setLoading(false);
            }
        };
        run();
        loadPermissions();
        return () => {
            ignore = true;
        };
    }, []);

    /* --------- Filter / Sort (Aynı kalır) --------- */
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = rows;
        if (q) {
            list = list.filter((r) =>
                (r.plaka || "").toLowerCase().includes(q) ||
                (r.cari_adi || "").toLowerCase().includes(q) ||
                (r.arac_sahip || "").toLowerCase().includes(q) ||
                (r.odak_arac_calisma_tipi || "").toLowerCase().includes(q) ||
                String(r.cari_id || "").toLowerCase().includes(q)
            );
        }
        if (onlyActive) {
            list = list.filter((r) => !r.pasif);
        }
        const f = filters;
        list = list.filter((r) => {
            const kira = toNumberLoose(r.aylik_kira);
            const surucu = toNumberLoose(r.aylik_surucu);
            const toplam = kira + surucu;
            const gun = toNumberLoose(r.calisma_gunu);
            const tarih = r.duzenleme_yapilan_tarih ? new Date(r.duzenleme_yapilan_tarih) : null;
            if (f.plaka && !(r.plaka || "").toLowerCase().includes(f.plaka.toLowerCase())) return false;
            if (f.cari_id && !String(r.cari_id || "").toLowerCase().includes(String(f.cari_id).toLowerCase())) return false;
            if (f.cari_adi && !(r.cari_adi || "").toLowerCase().includes(f.cari_adi.toLowerCase())) return false;
            if (f.arac_sahip && !(r.arac_sahip || "").toLowerCase().includes(f.arac_sahip.toLowerCase())) return false;
            if (f.aciklama && !(r.aciklama || "").toLowerCase().includes(f.aciklama.toLowerCase())) return false;
            if (f.duzenleyen && !(r.duzenleme_yapan_kullanici || "").toLowerCase().includes(f.duzenleyen.toLowerCase())) return false;
            if (!onlyActive) {
                if (f.pasif === "aktif" && !!r.pasif) return false;
                if (f.pasif === "pasif" && !r.pasif) return false;
            }
            if (f.aylik_kira_min !== "" && kira < toNumberLoose(f.aylik_kira_min)) return false;
            if (f.aylik_kira_max !== "" && kira > toNumberLoose(f.aylik_kira_max)) return false;
            if (f.aylik_surucu_min !== "" && surucu < toNumberLoose(f.aylik_surucu_min)) return false;
            if (f.aylik_surucu_max !== "" && surucu > toNumberLoose(f.aylik_surucu_max)) return false;
            if (f.toplam_min !== "" && toplam < toNumberLoose(f.toplam_min)) return false;
            if (f.toplam_max !== "" && toplam > toNumberLoose(f.toplam_max)) return false;
            if (f.calisma_gunu_min !== "" && gun < toNumberLoose(f.calisma_gunu_min)) return false;
            if (f.calisma_gunu_max !== "" && gun > toNumberLoose(f.calisma_gunu_max)) return false;
            if (f.tarih_from) {
                const from = new Date(f.tarih_from);
                if (tarih && tarih < from) return false;
            }
            if (f.tarih_to) {
                const to = new Date(f.tarih_to);
                if (tarih && tarih > to) return false;
            }
            return true;
        });
        return list;
    }, [rows, query, onlyActive, filters]);

    const sorted = useMemo(() => {
        const copy = [...filtered];
        const { key, dir } = sortBy;
        copy.sort((a, b) => {
            const va = a?.[key];
            const vb = b?.[key];
            const numericKeys = new Set(["aylik_kira", "aylik_surucu", "calisma_gunu", "cari_id", "toplam_tutar"]);

            if (key === "toplam_tutar") {
                const na = toNumberLoose(a?.aylik_kira) + toNumberLoose(a?.aylik_surucu);
                const nb = toNumberLoose(b?.aylik_kira) + toNumberLoose(b?.aylik_surucu);
                return dir === "asc" ? na - nb : nb - na;
            }
            if (numericKeys.has(key)) {
                const na = Number(toNumberLoose(va));
                const nb = Number(toNumberLoose(vb));
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

    /* --------- Totals (footer) (Aynı kalır) --------- */
    const totals = useMemo(() => {
        const sumKira = sorted.reduce((acc, r) => acc + toNumberLoose(r.aylik_kira), 0);
        const sumSurucu = sorted.reduce((acc, r) => acc + toNumberLoose(r.aylik_surucu), 0);
        return { kira: sumKira, surucu: sumSurucu, toplam: sumKira + sumSurucu };
    }, [sorted]);

    /* --------- Edit Handlers (Aynı kalır) --------- */
    const startEdit = (row) => {
        if (permLoading) return;
        if (!perms.canEditAny) {
            alert("Düzenleme yetkiniz yok.");
            return;
        }
        setEditingId(`${row.plaka}-${row.cari_id}`);
        setEditingKey({ plaka: row.plaka, cari_id: row.cari_id });
        setEditData({ ...row });
    };
    const cancelEdit = () => {
        setEditingId(null);
        setEditingKey(null);
        setEditData({});
    };

    const saveEdit = async () => {
        if (!perms.canEditAny) {
            alert("Düzenleme yetkiniz yok.");
            return;
        }
        try {
            const normalizeMoney = (v) => {
                const n = parseTLToNumber(v);
                return n === null ? null : n;
            };

            const payload = {};

            if (perms.fields.cari_id && editData.cari_id != null) {
                const newCariIdStr = (editData.cari_id ?? "").toString();
                const newCariId = Number(newCariIdStr.replace(/[^\d-]/g, ""));
                if (!Number.isFinite(newCariId)) {
                    alert("Cari ID geçersiz veya boş olamaz.");
                    return;
                }
                payload.cari_id = newCariId;
            }
            if (perms.fields.cari_adi) payload.cari_adi = editData.cari_adi?.trim() || null;
            if (perms.fields.arac_sahibi) payload.arac_sahip = editData.arac_sahip?.trim() || null;
            if (perms.fields.odak_arac_calisma_tipi) payload.odak_arac_calisma_tipi = editData.odak_arac_calisma_tipi?.trim() || null;
            if (perms.fields.aylik_kira) payload.aylik_kira = normalizeMoney(editData.aylik_kira);
            if (perms.fields.aylik_surucu) payload.aylik_surucu = normalizeMoney(editData.aylik_surucu);
            if (perms.fields.calisma_gunu) {
                payload.calisma_gunu =
                    editData.calisma_gunu === "" || editData.calisma_gunu == null ? null : Number(editData.calisma_gunu);
            }
            if (perms.fields.pasif) payload.pasif = !!editData.pasif;

            payload.duzenleme_yapan_kullanici = localStorage.getItem("kullanici") || "Admin";
            payload.duzenleme_yapilan_tarih = new Date().toISOString();

            if (Object.keys(payload).length <= 2) {
                alert("Değişiklik yok ya da yetkisiz alanlar.");
                return;
            }

            setSavingId(editingId);

            const { data, error } = await supabase
                .from("arac_cari_ve_fiyat")
                .update(payload)
                .match({ plaka: editingKey.plaka, cari_id: editingKey.cari_id })
                .select()
                .single();

            if (error) throw error;

            setRows((prev) =>
                prev.map((r) =>
                    r.plaka === editingKey.plaka && r.cari_id === editingKey.cari_id ? { ...r, ...data } : r
                )
            );

            cancelEdit();
        } catch (e) {
            alert("Kaydetme hatası: " + (e?.message || e));
        } finally {
            setSavingId(null);
        }
    };

    /* --------- Yeni Kayıt Ekle (Dialog) (Aynı kalır) --------- */
    const handleAddChange = (key, value) => setAddForm((p) => ({ ...p, [key]: value }));

    const addNew = async () => {
        if (!perms.canCreate) {
            setAddError("Yeni kayıt ekleme yetkiniz yok.");
            return;
        }
        setAddError(null);
        if (!addForm.plaka?.trim()) return setAddError("Plaka zorunludur.");
        if (!addForm.cari_id?.trim()) return setAddError("Cari ID zorunludur.");
        setAdding(true);
        try {
            const payload = {
                plaka: addForm.plaka.trim(),
                cari_id: Number(String(addForm.cari_id).replace(/[^\d-]/g, "")),
                cari_adi: addForm.cari_adi?.trim() || null,
                arac_sahip: addForm.arac_sahip?.trim() || null,
                aylik_kira: parseTLToNumber(addForm.aylik_kira),
                aylik_surucu: parseTLToNumber(addForm.aylik_surucu),
                calisma_gunu: parseTLToNumber(addForm.calisma_gunu),
                pasif: !!addForm.pasif,
                aciklama: addForm.aciklama?.trim() || null,
                duzenleme_yapan_kullanici: localStorage.getItem("kullanici") || "Admin",
                duzenleme_yapilan_tarih: new Date().toISOString(),
            };

            const { error } = await supabase.from("arac_cari_ve_fiyat").insert([payload]);
            if (error) throw error;
            setAddForm({
                plaka: "", cari_id: "", cari_adi: "", arac_sahip: "",
                aylik_kira: "", aylik_surucu: "", calisma_gunu: "", pasif: false, aciklama: "",
            });
            await refetch();
            setShowAdd(false);
        } catch (e) {
            setAddError(e?.message || "Kayıt eklenemedi.");
        } finally {
            setAdding(false);
        }
    };

    /* --------- Excel Export (Aynı kalır) --------- */
    const exportToExcel = () => {
        const data = sorted.map((r) => ({
            Plaka: r.plaka ?? "", "Cari ID": r.cari_id ?? "", "Cari Adı": r.cari_adi ?? "",
            "Araç Sahibi": r.arac_sahip ?? "", "Odak Araç Çalışma Tipi": r.odak_arac_calisma_tipi ?? "",
            "Aylık Kira": toNumberLoose(r.aylik_kira), "Aylık Sürücü": toNumberLoose(r.aylik_surucu),
            "Toplam Tutar": toNumberLoose(r.aylik_kira) + toNumberLoose(r.aylik_surucu),
            "Çalışma Günü": r.calisma_gunu ?? "", Pasif: r.pasif ? "Evet" : "Hayır",
            Açıklama: r.aciklama ?? "", Düzenleyen: r.duzenleme_yapan_kullanici ?? "",
            "Düzenleme Tarihi": r.duzenleme_yapilan_tarih ? formatDate(r.duzenleme_yapilan_tarih) : "",
        }));

        data.push({});
        data.push({
            Plaka: "TOPLAM (filtrelenmiş):", "Cari ID": "", "Cari Adı": "", "Araç Sahibi": "",
            "Aylık Kira": totals.kira, "Aylık Sürücü": totals.surucu, "Toplam Tutar": totals.toplam,
            "Çalışma Günü": "", Pasif: "", Açıklama: "", Düzenleyen: "", "Düzenleme Tarihi": "",
        });

        const ws = XLSXUtils.json_to_sheet(data, { skipHeader: false });
        ws["!cols"] = [
            { wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 14 },
            { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 30 }, { wch: 14 }, { wch: 20 },
        ];
        const wb = XLSXUtils.book_new();
        XLSXUtils.book_append_sheet(wb, ws, "AraçCariFiyat");
        XLSXWriteFile(wb, `arac_cari_fiyat_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    /* ---------------------------------------------------- */
    /* ----------------- YENİLENEN UI BÖLÜMÜ ----------------- */
    /* ---------------------------------------------------- */

    const SortIcon = ({ col }) => {
        if (sortBy.key !== col) return <ImportExport fontSize="inherit" sx={{ opacity: 0.5, transform: "scale(0.8)" }} />;
        return sortBy.dir === "asc" ? <ArrowUpward fontSize="inherit" /> : <ArrowDownward fontSize="inherit" />;
    };

    const headerCell = (label, key, props = {}) => (
        <TableCell
            onClick={() => toggleSort(key)}
            title={`${label} - sırala`}
            {...props}
            sx={{
                whiteSpace: "nowrap",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 13, // DAHA KÜÇÜK YAZI
                letterSpacing: 0.1,
                py: 1, // DAHA KISA SATIR YÜKSEKLİĞİ
                color: "text.primary",
                ...props?.sx,
            }}
        >
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={props.align === "right" ? "flex-end" : "flex-start"}>
                <span>{label}</span>
                <SortIcon col={key} />
            </Stack>
        </TableCell>
    );

    const clearFilters = () => {
        const empty = {
            plaka: "", cari_id: "", cari_adi: "", arac_sahip: "",
            aylik_kira_min: "", aylik_kira_max: "", aylik_surucu_min: "", aylik_surucu_max: "",
            toplam_min: "", toplam_max: "", calisma_gunu_min: "", calisma_gunu_max: "",
            pasif: "hepsi", aciklama: "", duzenleyen: "", tarih_from: "", tarih_to: "",
        };
        setFilters(empty);
        setTempFilters(empty);
        setOnlyActive(false);
    };

    const FilterBadge = ({ children }) => (
        <Badge
            color="secondary"
            badgeContent={activeFilterCount || 0}
            invisible={activeFilterCount === 0}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{
                "& .MuiBadge-badge": {
                    right: 4, top: 4, padding: '0 4px', height: 18, minWidth: 18, fontSize: 10,
                }
            }}
        >
            {children}
        </Badge>
    );

    // Top toolbar (Değişmedi)
    const TopToolbar = (
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }} flexWrap="wrap">
            <TextField
                size="small"
                variant="outlined"
                placeholder="Genel Ara..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ minWidth: { xs: "100%", md: 280 } }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon sx={{ opacity: 0.7 }} />
                        </InputAdornment>
                    ),
                }}
            />

            <ToggleButtonGroup
                size="small"
                exclusive
                value={onlyActive ? "aktif" : "hepsi"}
                onChange={(_, v) => setOnlyActive(v === "aktif")}
                color="primary"
                sx={{ borderRadius: 999, overflow: "hidden" }}
            >
                <ToggleButton value="hepsi" sx={{ fontSize: 12 }}>Tümü</ToggleButton>
                <ToggleButton value="aktif" sx={{ fontSize: 12 }}>Sadece Aktif</ToggleButton>
            </ToggleButtonGroup>

            <FilterBadge>
                <Button variant="contained" color="primary" startIcon={<TuneIcon />} onClick={() => setDrawerOpen(true)} size="small" sx={{ textTransform: 'none', fontWeight: 600 }}>
                    Filtreler
                </Button>
            </FilterBadge>

            <Button variant="outlined" color="primary" startIcon={<RefreshIcon />} onClick={refetch} size="small" sx={{ textTransform: 'none' }}>
                Yenile
            </Button>
            <Button variant="contained" color="secondary" startIcon={<DownloadIcon />} onClick={exportToExcel} size="small" sx={{ textTransform: 'none', fontWeight: 600 }}>
                Excel
            </Button>

            <Tooltip title={perms.canCreate ? "" : "Yeni kayıt ekleme yetkiniz yok"}>
                <span>
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<AddIcon />}
                        onClick={() => {
                            if (!perms.canCreate) return;
                            setShowAdd(true);
                        }}
                        size="small"
                        disabled={!perms.canCreate || permLoading}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        Yeni Kayıt
                    </Button>
                </span>
            </Tooltip>
        </Stack>
    );

    // Quick chips (Değişmedi)
    const ActiveFilterChips =
        activeFilterCount > 0 && (
            <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" alignItems="center">
                <Typography variant="body2" fontWeight={600} sx={{ opacity: 0.8 }}>Aktif Filtreler:</Typography>
                {onlyActive && filters.pasif === "hepsi" && (
                    <Chip
                        key="onlyActive"
                        label="Sadece Aktif"
                        onDelete={() => setOnlyActive(false)}
                        sx={{ fontSize: 11, height: 24, bgcolor: 'secondary.light', color: 'secondary.contrastText' }}
                    />
                )}
                {Object.entries(filters).map(([k, v]) => {
                    if (v === "" || v === null || (k === "pasif" && v === "hepsi")) return null;
                    const labels = {
                        plaka: "Plaka", cari_id: "Cari ID", cari_adi: "Cari Adı", arac_sahip: "Araç Sahibi",
                        aylik_kira_min: "Kira ≥", aylik_kira_max: "Kira ≤", aylik_surucu_min: "Sürücü ≥", aylik_surucu_max: "Sürücü ≤",
                        toplam_min: "Toplam ≥", toplam_max: "Toplam ≤", calisma_gunu_min: "Gün ≥", calisma_gunu_max: "Gün ≤",
                        pasif: "Durum", aciklama: "Açıklama", duzenleyen: "Düzenleyen",
                        tarih_from: "Tarih ≥", tarih_to: "Tarih ≤",
                    };
                    const displayValue = k.includes("tarih") ? new Date(v).toLocaleDateString("tr-TR") : v;
                    return (
                        <Chip
                            key={k}
                            label={`${labels[k] || k}: ${displayValue}`}
                            onDelete={() => setFilters((p) => ({ ...p, [k]: k === "pasif" ? "hepsi" : "" }))}
                            size="small"
                            sx={{ fontSize: 11, height: 24, bgcolor: 'info.light', color: 'info.contrastText' }}
                        />
                    );
                })}
                <Button
                    size="small"
                    startIcon={<ClearAllIcon />}
                    onClick={clearFilters}
                    sx={{ textTransform: 'none', fontSize: 12, ml: 1, color: 'text.secondary' }}
                >
                    Hepsini Temizle
                </Button>
            </Stack>
        );

    // Ana bileşen render'ı
    return (
        <Box
            sx={{
                minHeight: "100dvh",
                py: 4,
                px: { xs: 1.5, md: 2.5 },
                background: (t) =>
                    t.palette.mode === "dark"
                        ? `radial-gradient(1200px 600px at 10% -10%, rgba(120,119,198,0.18), transparent 60%),
                           radial-gradient(900px 500px at 100% 0%, rgba(56,189,248,0.12), transparent 60%),
                           ${t.palette.background.default}`
                        : "linear-gradient(180deg, #f0f4f9 0%, #ffffff 60%)",
            }}
        >
            <Container maxWidth={false} disableGutters>
                <Box sx={{ maxWidth: "none", mx: "auto", px: { xs: 1.5, md: 2.5 } }}>
                    <Paper
                        elevation={16}
                        sx={{
                            borderRadius: 4,
                            overflow: "hidden",
                            backdropFilter: "blur(12px)",
                            border: (t) => `1px solid ${t.palette.divider}`,
                            boxShadow: (t) =>
                                t.palette.mode === "dark"
                                    ? "0 20px 60px rgba(0,0,0,0.5)"
                                    : "0 25px 50px rgba(38, 78, 118, 0.15)",
                        }}
                    >
                        {/* Header */}
                        <Box
                            sx={{
                                p: { xs: 2, md: 3 },
                                background: (t) =>
                                    t.palette.mode === "dark"
                                        ? `linear-gradient(135deg, ${t.palette.background.default} 0%, ${t.palette.background.paper} 100%)`
                                        : "linear-gradient(135deg, #e5f1ff 0%, #ffffff 60%)",
                            }}
                        >
                            <Stack
                                direction={{ xs: "column", lg: "row" }}
                                alignItems={{ xs: "start", lg: "center" }}
                                justifyContent="space-between"
                                spacing={2}
                            >
                                <Stack spacing={1}>
                                    <Typography
                                        variant="h5"
                                        fontWeight={900}
                                        sx={{
                                            lineHeight: 1.1,
                                            letterSpacing: 0.2,
                                            background: "linear-gradient(90deg, #6d28d9, #0ea5e9)",
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                        }}
                                    >
                                        ARAÇ CARİ & FİYAT YÖNETİMİ 🚀
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        {loading && (
                                            <Chip
                                                label="Yükleniyor..."
                                                color="info"
                                                variant="outlined"
                                                icon={<CircularProgress size={14} color="info" />}
                                                sx={{ height: 26, fontSize: 12 }}
                                            />
                                        )}
                                        {err && <Chip label={`Hata: ${err}`} color="error" variant="outlined" sx={{ height: 26, fontSize: 12 }} />}
                                        {!loading && !err && <Chip label={`Toplam Kayıt: ${sorted.length}`} variant="outlined" sx={{ height: 26, fontSize: 12 }} />}

                                        {permLoading ? (
                                            <Chip size="small" variant="outlined" label="Yetkiler yükleniyor..." sx={{ height: 26, fontSize: 12 }} />
                                        ) : (
                                            <>
                                                {!perms.canCreate && (<Chip size="small" variant="outlined" label="Yeni Kayıt Kapalı" color="warning" sx={{ height: 26, fontSize: 12 }} />)}
                                                {!perms.canEditAny && (<Chip size="small" variant="outlined" label="Düzenleme Kapalı" color="warning" sx={{ height: 26, fontSize: 12 }} />)}
                                            </>
                                        )}
                                    </Stack>
                                </Stack>
                                <Box sx={{ flexShrink: 0 }}>
                                    {TopToolbar}
                                </Box>
                            </Stack>
                            {ActiveFilterChips}
                            <Stack direction="row" spacing={1.5} justifyContent="flex-end" mt={2} flexWrap="wrap">
                                <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="small" sx={{ textTransform: 'none', color: 'text.secondary' }}>Geri</Button>
                                <Button variant="text" startIcon={<HomeIcon />} onClick={() => navigate(HOME_PATH)} size="small" sx={{ textTransform: 'none', color: 'text.secondary' }}>Anasayfa</Button>
                            </Stack>
                        </Box>

                        <Divider />

                        {/* Table */}
                        <TableContainer
                            ref={wrapRef}
                            sx={{
                                maxHeight: "70vh",
                                width: "100%",
                                overflowX: "auto",
                                "& .acf-table": {
                                    transformOrigin: "left center",
                                    transform: "scale(var(--acf-scale))",
                                },
                            }}
                        >
                            <Table
                                ref={tableRef}
                                className="acf-table acf-scale"
                                stickyHeader
                                size="small"
                                sx={{
                                    // ⚡️ Değişiklik 1: tableLayout: "fixed" geri getirildi
                                    width: "100%",
                                    tableLayout: "fixed",
                                    "& thead th": {
                                        bgcolor: (t) => t.palette.mode === "dark" ? t.palette.background.default : "#eef4ff",
                                        borderBottom: (t) => `2px solid ${t.palette.divider}`,
                                    },
                                    "& td, & th": {
                                        // ⚡️ Değişiklik 2: Daha küçük font ve padding
                                        fontSize: 13,
                                        wordBreak: "break-word",
                                        whiteSpace: "normal",
                                        borderColor: (t) => t.palette.divider,
                                    },
                                    "& td": {
                                        py: 0.5, // Dikey boşluğu azalt
                                    },
                                    "& tbody tr:hover": {
                                        backgroundColor: (t) =>
                                            t.palette.mode === "dark"
                                                ? "rgba(109,40,249,0.06)"
                                                : "rgba(109,40,249,0.04)",
                                    },
                                }}
                            >
                                <TableHead>
                                    <TableRow>
                                        {/* ⚡️ Değişiklik 3: Sütun Genişlikleri Daraltıldı (minWidth yerine doğrudan width) */}
                                        <TableCell sx={{ fontWeight: 900, fontSize: 13, width: "70px" }}>Plaka</TableCell>
                                        {headerCell("Cari ID", "cari_id", { sx: { width: "80px" } })}
                                        {headerCell("Cari Adı", "cari_adi", { sx: { width: "150px" } })}
                                        {headerCell("Sahibi", "arac_sahip", { sx: { width: "120px" } })}
                                        {/* Sütun adı kısaltıldı */}
                                        {headerCell("Çalışma Tipi", "odak_arac_calisma_tipi", { sx: { width: "120px" } })}
                                        {headerCell("Aylık Kira", "aylik_kira", { align: "right", sx: { width: "100px" } })}
                                        {headerCell("Aylık Sürücü", "aylik_surucu", { align: "right", sx: { width: "100px" } })}
                                        {headerCell("Toplam Tutar", "toplam_tutar", { align: "right", sx: { width: "110px" } })}
                                        {headerCell("Gün", "calisma_gunu", { align: "center", sx: { width: "50px" } })}
                                        {headerCell("Pasif", "pasif", { align: "center", sx: { width: "50px" } })}
                                        {headerCell("Açıklama", "aciklama", { sx: { width: "200px" } })}
                                        <TableCell sx={{ fontWeight: 900, fontSize: 13, width: "70px" }}>İşlem</TableCell>
                                        {headerCell("Düzenleyen", "duzenleme_yapan_kullanici", { sx: { width: "90px" } })}
                                        {headerCell("Düzenleme Tarihi", "duzenleme_yapilan_tarih", { sx: { width: "140px" } })}
                                    </TableRow>
                                </TableHead>

                                <TableBody
                                    sx={{
                                        "& tr:nth-of-type(odd)": {
                                            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#f9fcfd"),
                                        },
                                    }}
                                >
                                    {sorted.map((r, i) => {
                                        const isEditing = editingId === `${r.plaka}-${r.cari_id}`;
                                        const rowKey = `${r.plaka}-${r.cari_id}-${i}`;
                                        const toplamTutar = toNumberLoose(r.aylik_kira) + toNumberLoose(r.aylik_surucu);

                                        return (
                                            <TableRow
                                                key={rowKey}
                                                hover
                                                selected={isEditing}
                                                sx={{ "&.Mui-selected": { backgroundColor: (t) => t.palette.secondary.light + "22" } }}
                                            >
                                                {/* Plaka */}
                                                <TableCell title={r.plaka} sx={{ fontWeight: 800 }}>
                                                    {r.plaka}
                                                </TableCell>

                                                {/* Cari ID (editable) */}
                                                <TableCell>
                                                    {isEditing && perms.fields.cari_id ? (
                                                        <TextField
                                                            value={editData.cari_id ?? ""}
                                                            onChange={(e) => setEditData((p) => ({ ...p, cari_id: e.target.value }))}
                                                            size="small"
                                                            inputMode="numeric"
                                                            fullWidth
                                                            disabled={!perms.fields.cari_id}
                                                        />
                                                    ) : (
                                                        r.cari_id
                                                    )}
                                                </TableCell>

                                                {/* Cari Adı (editable) */}
                                                <TableCell title={r.cari_adi}>
                                                    {isEditing && perms.fields.cari_adi ? (
                                                        <TextField
                                                            value={editData.cari_adi ?? ""}
                                                            onChange={(e) => setEditData((p) => ({ ...p, cari_adi: e.target.value }))}
                                                            size="small"
                                                            fullWidth
                                                            disabled={!perms.fields.cari_adi}
                                                        />
                                                    ) : (
                                                        <Typography noWrap>{r.cari_adi}</Typography>
                                                    )}
                                                </TableCell>

                                                {/* Araç Sahibi (editable) */}
                                                <TableCell title={r.arac_sahip ?? ""}>
                                                    {isEditing && perms.fields.arac_sahibi ? (
                                                        <TextField
                                                            value={editData.arac_sahip ?? ""}
                                                            onChange={(e) => setEditData((p) => ({ ...p, arac_sahip: e.target.value }))}
                                                            size="small"
                                                            fullWidth
                                                            disabled={!perms.fields.arac_sahibi}
                                                        />
                                                    ) : (
                                                        <Typography noWrap>{r.arac_sahip}</Typography>
                                                    )}
                                                </TableCell>

                                                {/* Odak Araç Çalışma Tipi (editable) */}
                                                <TableCell title={r.odak_arac_calisma_tipi ?? ""}>
                                                    {isEditing && perms.fields.odak_arac_calisma_tipi ? (
                                                        <TextField
                                                            value={editData.odak_arac_calisma_tipi ?? ""}
                                                            onChange={(e) => setEditData((p) => ({ ...p, odak_arac_calisma_tipi: e.target.value }))}
                                                            size="small"
                                                            fullWidth
                                                            disabled={!perms.fields.odak_arac_calisma_tipi}
                                                        />
                                                    ) : (
                                                        <Typography noWrap>{r.odak_arac_calisma_tipi}</Typography>
                                                    )}
                                                </TableCell>

                                                {/* Aylık Kira (editable) */}
                                                <TableCell align="right" title={String(r.aylik_kira ?? "")} sx={{ fontWeight: 600, color: 'primary.main' }}>
                                                    {isEditing && perms.fields.aylik_kira ? (
                                                        <TextField
                                                            value={editData.aylik_kira ?? ""}
                                                            onChange={(e) =>
                                                                setEditData((p) => ({ ...p, aylik_kira: formatTLForTyping(e.target.value) }))
                                                            }
                                                            size="small"
                                                            inputMode="decimal"
                                                            sx={{ width: 90 }}
                                                            disabled={!perms.fields.aylik_kira}
                                                        />
                                                    ) : (
                                                        formatTL(toNumberLoose(r.aylik_kira))
                                                    )}
                                                </TableCell>

                                                {/* Aylık Sürücü (editable) */}
                                                <TableCell align="right" title={String(r.aylik_surucu ?? "")} sx={{ fontWeight: 600, color: 'primary.main' }}>
                                                    {isEditing && perms.fields.aylik_surucu ? (
                                                        <TextField
                                                            value={editData.aylik_surucu ?? ""}
                                                            onChange={(e) =>
                                                                setEditData((p) => ({ ...p, aylik_surucu: formatTLForTyping(e.target.value) }))
                                                            }
                                                            size="small"
                                                            inputMode="decimal"
                                                            sx={{ width: 90 }}
                                                            disabled={!perms.fields.aylik_surucu}
                                                        />
                                                    ) : (
                                                        formatTL(toNumberLoose(r.aylik_surucu))
                                                    )}
                                                </TableCell>

                                                {/* Toplam Tutar (computed) */}
                                                <TableCell align="right" title={String(toplamTutar)} sx={{ fontWeight: 800, color: 'secondary.main' }}>
                                                    {formatTL(toplamTutar)}
                                                </TableCell>

                                                {/* Çalışma Günü (editable) */}
                                                <TableCell align="center" title={String(r.calisma_gunu ?? "")}>
                                                    {isEditing && perms.fields.calisma_gunu ? (
                                                        <TextField
                                                            value={editData.calisma_gunu ?? ""}
                                                            onChange={(e) => setEditData((prev) => ({ ...prev, calisma_gunu: e.target.value }))}
                                                            size="small"
                                                            inputMode="numeric"
                                                            sx={{ width: 40 }}
                                                            disabled={!perms.fields.calisma_gunu}
                                                        />
                                                    ) : (
                                                        r.calisma_gunu ?? ""
                                                    )}
                                                </TableCell>

                                                {/* Pasif (read-only) */}
                                                <TableCell align="center">
                                                    {isEditing && perms.fields.pasif ? (
                                                        <Checkbox
                                                            checked={!!editData.pasif}
                                                            onChange={(e) => setEditData((p) => ({ ...p, pasif: e.target.checked }))}
                                                            disabled={!perms.fields.pasif}
                                                            size="small"
                                                        />
                                                    ) : (
                                                        <Checkbox checked={!!r.pasif} disabled size="small" color={!!r.pasif ? "error" : "success"} />
                                                    )}
                                                </TableCell>

                                                {/* Açıklama (read-only) */}
                                                <TableCell title={r.aciklama ?? ""}>
                                                    <Typography noWrap sx={{ fontSize: 12 }}>{r.aciklama}</Typography>
                                                </TableCell>

                                                {/* İşlem — Yetki kontrollü */}
                                                <TableCell>
                                                    {isEditing ? (
                                                        <Stack direction="row" spacing={0.5}>
                                                            <Tooltip title="Kaydet">
                                                                <span>
                                                                    <IconButton
                                                                        color="primary"
                                                                        onClick={saveEdit}
                                                                        disabled={savingId === editingId || !perms.canEditAny || permLoading}
                                                                        size="small"
                                                                    >
                                                                        {savingId === editingId ? <CircularProgress size={16} /> : <CheckIcon />}
                                                                    </IconButton>
                                                                </span>
                                                            </Tooltip>
                                                            <Tooltip title="İptal">
                                                                <span>
                                                                    <IconButton
                                                                        color="inherit"
                                                                        onClick={cancelEdit}
                                                                        disabled={savingId === editingId}
                                                                        size="small"
                                                                    >
                                                                        <CloseIcon />
                                                                    </IconButton>
                                                                </span>
                                                            </Tooltip>
                                                        </Stack>
                                                    ) : (
                                                        <Tooltip title={perms.canEditAny ? "Satırı düzenle" : "Düzenleme yetkiniz yok"}>
                                                            <span>
                                                                <IconButton
                                                                    onClick={() => startEdit(r)}
                                                                    size="small"
                                                                    disabled={!perms.canEditAny || permLoading}
                                                                    color="secondary"
                                                                >
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>

                                                {/* Düzenleyen / Tarih */}
                                                <TableCell title={r.duzenleme_yapan_kullanici ?? ""} sx={{ fontSize: 12 }}>{r.duzenleme_yapan_kullanici}</TableCell>
                                                <TableCell title={formatDate(r.duzenleme_yapilan_tarih)} sx={{ fontSize: 12, color: 'text.secondary' }}>
                                                    {formatDate(r.duzenleme_yapilan_tarih)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {!loading && !err && sorted.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={14} align="center" sx={{ py: 5, color: "text.secondary", fontSize: 16 }}>
                                                🔍 Kriterlerinize uygun kayıt bulunamadı. Lütfen filtreleri kontrol edin.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>

                                <TableFooter>
                                    <TableRow
                                        sx={{
                                            "& td": {
                                                fontWeight: 800,
                                                fontSize: 14,
                                                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#eef1f9"),
                                                borderTop: (t) => `2px solid ${t.palette.divider}`,
                                                py: 1.5,
                                                color: 'secondary.dark',
                                            },
                                        }}
                                    >
                                        <TableCell colSpan={5}>TOPLAM (Filtrelenmiş Veri)</TableCell>
                                        <TableCell align="right">{formatTL(totals.kira)}</TableCell>
                                        <TableCell align="right">{formatTL(totals.surucu)}</TableCell>
                                        <TableCell align="right">{formatTL(totals.toplam)}</TableCell>
                                        <TableCell align="center">—</TableCell>
                                        <TableCell align="center">—</TableCell>
                                        <TableCell colSpan={4}> </TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Box>
            </Container>

            {/* ========== Gelişmiş Filtreler (Drawer) - (Aynı kalır) ========== */}
            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => { setFilters(tempFilters); setDrawerOpen(false); }}
                PaperProps={{
                    sx: {
                        width: { xs: "100%", sm: 480 },
                        p: 3,
                        borderTopLeftRadius: 20,
                        borderBottomLeftRadius: 20,
                        boxShadow: 8,
                        backdropFilter: "blur(12px)",
                        background: (t) => t.palette.mode === "dark" ? t.palette.background.paper : "#fcfdfe",
                    },
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pb: 2 }}>
                    <Typography variant="h6" fontWeight={900} sx={{ color: 'primary.main' }}>
                        Gelişmiş Filtreler ⚙️
                    </Typography>
                    <IconButton onClick={() => setDrawerOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </Stack>

                <Divider sx={{ mb: 3 }} />

                <Box sx={{ overflowY: 'auto', maxHeight: 'calc(100vh - 180px)', pr: 1 }}>
                    <Grid container spacing={2}>
                        {/* Plaka, Cari ID, Cari Adı, Araç Sahibi */}
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Plaka" size="small" value={tempFilters.plaka} onChange={(e) => setTempFilters(p => ({ ...p, plaka: e.target.value }))} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Cari ID" size="small" value={tempFilters.cari_id} onChange={(e) => setTempFilters(p => ({ ...p, cari_id: e.target.value }))} inputMode="numeric" />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Cari Adı" size="small" value={tempFilters.cari_adi} onChange={(e) => setTempFilters(p => ({ ...p, cari_adi: e.target.value }))} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Araç Sahibi" size="small" value={tempFilters.arac_sahip} onChange={(e) => setTempFilters(p => ({ ...p, arac_sahip: e.target.value }))} />
                        </Grid>

                        {/* Durum */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" sx={{ mb: 1, mt: 1, opacity: 0.7 }}>Durum</Typography>
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={tempFilters.pasif}
                                onChange={(_, v) => v && setTempFilters(p => ({ ...p, pasif: v }))}
                                color="secondary"
                                fullWidth
                            >
                                <ToggleButton value="hepsi">Hepsi</ToggleButton>
                                <ToggleButton value="aktif">Aktif</ToggleButton>
                                <ToggleButton value="pasif">Pasif</ToggleButton>
                            </ToggleButtonGroup>
                        </Grid>

                        {/* Aylık Kira Aralığı */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" sx={{ mb: 1, mt: 1, opacity: 0.7 }}>Aylık Kira (₺)</Typography>
                            <Stack direction="row" spacing={1}>
                                <TextField fullWidth label="Min" size="small" value={tempFilters.aylik_kira_min} onChange={(e) => setTempFilters(p => ({ ...p, aylik_kira_min: formatTLForTyping(e.target.value) }))} inputMode="decimal" />
                                <TextField fullWidth label="Max" size="small" value={tempFilters.aylik_kira_max} onChange={(e) => setTempFilters(p => ({ ...p, aylik_kira_max: formatTLForTyping(e.target.value) }))} inputMode="decimal" />
                            </Stack>
                        </Grid>

                        {/* Aylık Sürücü Aralığı */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" sx={{ mb: 1, mt: 1, opacity: 0.7 }}>Aylık Sürücü (₺)</Typography>
                            <Stack direction="row" spacing={1}>
                                <TextField fullWidth label="Min" size="small" value={tempFilters.aylik_surucu_min} onChange={(e) => setTempFilters(p => ({ ...p, aylik_surucu_min: formatTLForTyping(e.target.value) }))} inputMode="decimal" />
                                <TextField fullWidth label="Max" size="small" value={tempFilters.aylik_surucu_max} onChange={(e) => setTempFilters(p => ({ ...p, aylik_surucu_max: formatTLForTyping(e.target.value) }))} inputMode="decimal" />
                            </Stack>
                        </Grid>

                        {/* Toplam Tutar Aralığı */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" sx={{ mb: 1, mt: 1, opacity: 0.7 }}>Toplam Tutar (₺)</Typography>
                            <Stack direction="row" spacing={1}>
                                <TextField fullWidth label="Min" size="small" value={tempFilters.toplam_min} onChange={(e) => setTempFilters(p => ({ ...p, toplam_min: formatTLForTyping(e.target.value) }))} inputMode="decimal" />
                                <TextField fullWidth label="Max" size="small" value={tempFilters.toplam_max} onChange={(e) => setTempFilters(p => ({ ...p, toplam_max: formatTLForTyping(e.target.value) }))} inputMode="decimal" />
                            </Stack>
                        </Grid>

                        {/* Çalışma Günü Aralığı */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" sx={{ mb: 1, mt: 1, opacity: 0.7 }}>Çalışma Günü</Typography>
                            <Stack direction="row" spacing={1}>
                                <TextField fullWidth label="Min" size="small" value={tempFilters.calisma_gunu_min} onChange={(e) => setTempFilters(p => ({ ...p, calisma_gunu_min: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" />
                                <TextField fullWidth label="Max" size="small" value={tempFilters.calisma_gunu_max} onChange={(e) => setTempFilters(p => ({ ...p, calisma_gunu_max: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" />
                            </Stack>
                        </Grid>

                        {/* Açıklama ve Düzenleyen */}
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Açıklama (içerir)" size="small" value={tempFilters.aciklama} onChange={(e) => setTempFilters(p => ({ ...p, aciklama: e.target.value }))} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Düzenleyen" size="small" value={tempFilters.duzenleyen} onChange={(e) => setTempFilters(p => ({ ...p, duzenleyen: e.target.value }))} />
                        </Grid>

                        {/* Tarih Aralığı */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" sx={{ mb: 1, mt: 1, opacity: 0.7 }}>Düzenleme Tarihi</Typography>
                            <Stack direction="row" spacing={1}>
                                <TextField
                                    fullWidth
                                    label="Başlangıç Tarihi"
                                    size="small"
                                    type="date"
                                    value={tempFilters.tarih_from}
                                    onChange={(e) => setTempFilters(p => ({ ...p, tarih_from: e.target.value }))}
                                    InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                    fullWidth
                                    label="Bitiş Tarihi"
                                    size="small"
                                    type="date"
                                    value={tempFilters.tarih_to}
                                    onChange={(e) => setTempFilters(p => ({ ...p, tarih_to: e.target.value }))}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Stack>
                        </Grid>

                    </Grid>
                </Box>


                <Paper
                    elevation={10}
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        left: { xs: 0, sm: "auto" },
                        width: { xs: "100%", sm: 480 },
                        p: 2,
                        borderTopLeftRadius: 18,
                        backdropFilter: "blur(8px)",
                        borderTop: (t) => `1px solid ${t.palette.divider}`,
                        bgcolor: (t) => t.palette.background.paper,
                    }}
                >
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                        <Button startIcon={<ClearAllIcon />} onClick={clearFilters} color="error">
                            Temizle
                        </Button>
                        <Stack direction="row" spacing={1}>
                            <Button variant="outlined" onClick={() => { setTempFilters(filters); setDrawerOpen(false); }}>
                                İptal
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => {
                                    setFilters(tempFilters);
                                    setDrawerOpen(false);
                                }}
                                color="primary"
                            >
                                Uygula ({activeFilterCount})
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
            </Drawer>

            {/* ========== Yeni Kayıt (Dialog) (Aynı kalır) ========== */}
            <Dialog
                open={showAdd}
                onClose={() => setShowAdd(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { borderRadius: 4, p: 1, boxShadow: 20 } }}
            >
                <DialogTitle sx={{ fontWeight: 900, color: 'secondary.main' }}>Yeni Kayıt Ekle ➕</DialogTitle>
                <DialogContent dividers>
                    {addError && (
                        <Box sx={{ mb: 2 }}>
                            <Chip color="error" variant="filled" label={addError} sx={{ height: 32, fontSize: 13 }} />
                        </Box>
                    )}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Plaka" value={addForm.plaka} onChange={(e) => handleAddChange("plaka", e.target.value)} required fullWidth size="small" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Cari ID" value={addForm.cari_id} onChange={(e) => handleAddChange("cari_id", e.target.value)} required fullWidth inputMode="numeric" size="small" />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField label="Cari Adı" value={addForm.cari_adi} onChange={(e) => handleAddChange("cari_adi", e.target.value)} fullWidth size="small" />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField label="Araç Sahibi" value={addForm.arac_sahip} onChange={(e) => handleAddChange("arac_sahip", e.target.value)} fullWidth size="small" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Aylık Kira (₺)" value={addForm.aylik_kira} onChange={(e) => handleAddChange("aylik_kira", formatTLForTyping(e.target.value))} fullWidth inputMode="decimal" size="small" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Aylık Sürücü (₺)" value={addForm.aylik_surucu} onChange={(e) => handleAddChange("aylik_surucu", formatTLForTyping(e.target.value))} fullWidth inputMode="decimal" size="small" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Çalışma Günü" value={addForm.calisma_gunu} onChange={(e) => handleAddChange("calisma_gunu", e.target.value)} fullWidth inputMode="numeric" size="small" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Stack direction="row" alignItems="center" height="100%" sx={{ pt: 1, pl: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                                <Checkbox checked={!!addForm.pasif} onChange={(e) => handleAddChange("pasif", e.target.checked)} color="error" />
                                <Typography>Pasif Kayıt</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Açıklama"
                                value={addForm.aciklama}
                                onChange={(e) => handleAddChange("aciklama", e.target.value)}
                                fullWidth
                                multiline
                                minRows={2}
                                size="small"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setShowAdd(false)} color="inherit" disabled={adding}>Vazgeç</Button>
                    <Tooltip title={perms.canCreate ? "" : "Yeni kayıt ekleme yetkiniz yok"}>
                        <span>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={adding ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                                onClick={addNew}
                                disabled={adding || !perms.canCreate || permLoading}
                            >
                                {adding ? "Ekleniyor..." : "Ekle"}
                            </Button>
                        </span>
                    </Tooltip>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
