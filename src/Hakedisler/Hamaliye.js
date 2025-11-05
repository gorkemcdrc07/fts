// src/Hakedisler/Hamaliye.js
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
    Box, Card, CardContent, CardHeader, Typography, Button, TextField,
    Select, MenuItem, InputLabel, FormControl, Dialog, DialogTitle, DialogContent,
    DialogActions, Chip, Table, TableHead, TableRow, TableCell, TableBody,
    Stack, IconButton, Pagination, Tooltip, CircularProgress, Alert, Grid,
    Container, Paper, TableContainer
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import FilterListIcon from "@mui/icons-material/FilterList";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from '@mui/icons-material/UploadFile'; // <-- İçeri aktarma için eklendi
import { supabase } from "../supabaseClient";
import * as XLSX from 'xlsx'; // <-- Excel için eklendi

// plakalar için dönen alanlar
const PLATE_FIELDS = "id, plaka, treyler, surucu_adi";

const COLUMNS = [
    { key: "created_at", label: "OLUŞTURULMA TAR.", minWidth: 150 },
    { key: "gelir_gider", label: "PRİM/HAMALİYE", minWidth: 120 },
    { key: "sefer_no", label: "SEFER NO", minWidth: 100 },
    { key: "plaka", label: "PLAKA", minWidth: 100 },
    { key: "treyler", label: "TREYLER", minWidth: 100 },
    { key: "tarih", label: "TARİH", minWidth: 100 },
    { key: "surucu", label: "SÜRÜCÜ", minWidth: 120 },
    { key: "telefon_numarasi", label: "TELEFON NO", minWidth: 120 },
    { key: "yukleme_musteri", label: "YÜKLEME MÜŞTERİ", minWidth: 180 },
    { key: "fatura_musteri", label: "FATURA MÜŞTERİ", minWidth: 180 },
    { key: "bolge_palet_sayisi", label: "BÖLGE PALET", numeric: true, minWidth: 100 },
    { key: "odenen_tutar", label: "ÖDENEN TUTAR", numeric: true, minWidth: 120 },
    { key: "palet_sayisi", label: "PALET SAYISI", numeric: true, minWidth: 100 },
    { key: "donem", label: "DÖNEM", minWidth: 100 },
    { key: "kullanici_adi", label: "KULLANICI ADI", minWidth: 120 },
];

function formatTRYInput(val) {
    const digits = String(val ?? "").replace(/[^\d]/g, ""); // Sadece rakamları al
    const num = digits ? Number(digits) : 0;
    const text = digits
        ? new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(num)
        : "";
    return { num, text };
}

function currencyTRY(v) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
    }).format(v ?? 0);
}

function normalizePlates(raw) {
    const arr = Array.isArray(raw) ? raw : (raw?.data ?? []);
    return arr.map((x) => {
        const plaka = x.plaka ?? "";
        const treyler = x.treyler ?? "";
        const surucu_adi = x.surucu_adi ?? "";
        const id = x.id ?? `${plaka}-${treyler}-${surucu_adi}`;
        return {
            id: String(id),
            plaka: String(plaka || "").toUpperCase(),
            treyler: String(treyler || ""),
            surucu_adi: String(surucu_adi || ""),
        };
    });
}

const getChipColor = (gelirGider) => {
    return gelirGider === "Prim" ? { color: "success", variant: "filled" } : { color: "primary", variant: "filled" };
};

export default function Hamaliye() {
    // tablo state
    const [rows, setRows] = useState([]);
    const [rowsLoading, setRowsLoading] = useState(false);
    const [rowsErr, setRowsErr] = useState("");

    const [globalQuery, setGlobalQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [gelirGider, setGelirGider] = useState("Hepsi");
    const [donem, setDonem] = useState("Hepsi");
    const [sortKey, setSortKey] = useState("tarih");
    const [sortDir, setSortDir] = useState("desc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // localStorage kullanıcı adı
    const [localUserName, setLocalUserName] = useState("");

    // plakalar
    const [plakalar, setPlakalar] = useState([]);
    const [plakalarLoading, setPlakalarLoading] = useState(false);
    const [plateSearch, setPlateSearch] = useState("");
    const [plateErr, setPlateErr] = useState("");

    // dialog & form
    const [dialogOpen, setDialogOpen] = useState(false);
    const [formMode, setFormMode] = useState("create"); // "create" | "edit"
    const [editingId, setEditingId] = useState(null);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");

    const initialFormState = {
        tarih: now.toISOString().slice(0, 10),
        gelir_gider: "Prim",
        kullanici_adi: "",
        plaka: "",
        treyler: "",
        surucu: "",
        donem: `${yyyy}-${mm}`,
        odenen_tutar: 0,
        odenen_tutar_str: "",
        sefer_no: "",
        yukleme_musteri: "",
        fatura_musteri: "",
        bolge_palet_sayisi: 0,
        palet_sayisi: 0,
    };
    const [form, setForm] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [actionErr, setActionErr] = useState(""); // insert/update/delete hataları
    const [importLoading, setImportLoading] = useState(false); // <-- İçeri aktarma için eklendi

    // kullanıcı adını çek
    useEffect(() => {
        const keys = ["kullanici_adi", "kullaniciAdi", "username", "adSoyad"];
        let name = "";
        for (const k of keys) {
            const v = localStorage.getItem(k);
            if (v && v.trim()) { name = v.trim(); break; }
        }
        setLocalUserName(name);
        setForm((f) => ({ ...f, kullanici_adi: name }));
    }, []);

    // --- SUPABASE: hamaliye liste ---
    const fetchRows = useCallback(async () => {
        setRowsLoading(true);
        setRowsErr("");
        try {
            // Tüm kayıtları çek (ihtiyaca göre sayfalama eklenebilir)
            const { data, error } = await supabase
                .from("hamaliye")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setRows(data || []);
        } catch (e) {
            console.error("Hamaliye fetch hatası:", e);
            setRowsErr(String(e.message || e));
            setRows([]);
        } finally {
            setRowsLoading(false);
        }
    }, []);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    // --- SUPABASE: plakalar liste ---
    const loadPlates = useCallback(async (query = "") => {
        setPlakalarLoading(true);
        setPlateErr("");
        try {
            const search = (query.startsWith("?search=") ? decodeURIComponent(query.slice(8)) : "").trim();
            let q = supabase.from("plakalar").select(PLATE_FIELDS).order("id", { ascending: false }).limit(1000);
            if (search.length >= 1) {
                const s = search.replaceAll(",", " ").trim();
                q = q.or(`plaka.ilike.%${s}%,treyler.ilike.%${s}%,surucu_adi.ilike.%${s}%`);
            }
            const { data, error } = await q;
            if (error) throw error;
            const normalized = normalizePlates(data);
            setPlakalar(normalized);
            localStorage.setItem("plakaCache", JSON.stringify(normalized.slice(0, 2000)));
        } catch (e) {
            console.error("Plaka fetch hatası:", e);
            const cached = localStorage.getItem("plakaCache");
            if (cached) {
                try {
                    const list = JSON.parse(cached);
                    if (Array.isArray(list) && list.length) {
                        setPlakalar(list);
                        setPlateErr("Canlı API erişilemedi. Önbellekten gösteriliyor.");
                        return;
                    }
                } catch { }
            }
            setPlateErr(String(e.message || e));
            setPlakalar([]);
        } finally {
            setPlakalarLoading(false);
        }
    }, []);

    // Dialog açılınca plakaları yükle
    useEffect(() => {
        if (!dialogOpen) return;
        loadPlates("");
    }, [dialogOpen, loadPlates]);

    // filtre + sıralama (UI)
    const filtered = useMemo(() => {
        let data = [...rows];
        if (globalQuery.trim()) {
            const q = globalQuery.toLowerCase();
            data = data.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
        }
        if (dateFrom) data = data.filter((r) => r.tarih >= dateFrom);
        if (dateTo) data = data.filter((r) => r.tarih <= dateTo);
        if (gelirGider !== "Hepsi") data = data.filter((r) => r.gelir_gider === gelirGider);
        if (donem !== "Hepsi") data = data.filter((r) => r.donem === donem);

        data.sort((a, b) => {
            const va = a[sortKey], vb = b[sortKey];
            if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
            return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
        return data;
    }, [rows, globalQuery, dateFrom, dateTo, gelirGider, donem, sortKey, sortDir]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    function toggleSort(k) {
        if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(k); setSortDir("asc"); }
    }

    function resetFilters() {
        setGlobalQuery(""); setDateFrom(""); setDateTo("");
        setGelirGider("Hepsi"); setDonem("Hepsi"); setPage(1);
    }

    function validateForm(values) {
        const e = {};
        const required = [
            "gelir_gider", "sefer_no", "plaka", "tarih", "surucu", // 'treyler' zorunlu değil
            "yukleme_musteri", "fatura_musteri", "odenen_tutar", "palet_sayisi",
            "donem", "kullanici_adi",
        ];
        // 'treyler' isteğe bağlı olduğu için zorunlu alanlardan çıkarıldı
        for (const k of required) if (values[k] === undefined || values[k] === "" || values[k] === null) e[k] = "Zorunlu alan";
        if (values.odenen_tutar != null && Number(values.odenen_tutar) < 0) e.odenen_tutar = "+ olmalı";
        if (values.palet_sayisi != null && Number(values.palet_sayisi) < 0) e.palet_sayisi = "+ olmalı";

        // Treyler için validasyon (plaka varsa zorunlu olabilir, ama formda ayrı girilmiyor)
        // Şimdilik plaka varsa treyler'in de girildiğini varsayıyoruz (Autocomplete'dan geliyor)
        // Manuel girişte sorun olabilir, ancak Autocomplete'u zorunlu kılmak daha iyi olur.
        // Hata mesajı için 'plaka' kontrolü yeterli.
        if (!values.plaka) e.plaka = "Zorunlu alan";

        return e;
    }

    // Düzenle formunu hazırla
    function handleEditRow(r) {
        setFormMode("edit");
        setEditingId(r.id);
        const formDate = r.tarih || new Date().toISOString().slice(0, 10);
        const formDonem = r.donem || (() => {
            const d = new Date(formDate);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            return `${y}-${m}`;
        })();

        setForm({
            tarih: formDate,
            gelir_gider: r.gelir_gider || "Prim",
            kullanici_adi: r.kullanici_adi || localUserName || "",
            plaka: r.plaka || "",
            treyler: r.treyler || "",
            surucu: r.surucu || "",
            sefer_no: r.sefer_no || "",
            yukleme_musteri: r.yukleme_musteri || "",
            fatura_musteri: r.fatura_musteri || "",
            bolge_palet_sayisi: r.bolge_palet_sayisi ?? 0,
            palet_sayisi: r.palet_sayisi ?? 0,
            donem: formDonem,
            odenen_tutar: r.odenen_tutar ?? 0,
            odenen_tutar_str: r.odenen_tutar ? formatTRYInput(r.odenen_tutar).text : "",
        });
        setDialogOpen(true);
    }

    // Yeni kayıt için formu sıfırla
    function handleNewRecord() {
        setFormMode("create");
        setEditingId(null);
        setErrors({});
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        setForm({ ...initialFormState, donem: `${y}-${m}`, kullanici_adi: localUserName, tarih: d.toISOString().slice(0, 10) });
        setPlateSearch("");
        setDialogOpen(true);
    }

    async function handleDeleteRow(r) {
        setActionErr("");
        try {
            if (!window.confirm(`${r.plaka} plakalı kaydı silmek istediğinize emin misiniz?`)) return;
            const { error } = await supabase.from("hamaliye").delete().eq("id", r.id);
            if (error) throw error;
            setRows((rs) => rs.filter((x) => x.id !== r.id));
        } catch (e) {
            console.error("Silme hatası:", e);
            setActionErr(`Silme hatası: ${String(e.message || e)}`);
        }
    }

    async function handleSave() {
        setActionErr("");
        // Validasyonu güncelleyelim, treyler artık zorunlu değil
        const e = validateForm(form);
        setErrors(e);
        if (Object.keys(e).length) return;

        const payload = {
            gelir_gider: form.gelir_gider || "Prim",
            sefer_no: String(form.sefer_no || ""),
            plaka: String(form.plaka || ""),
            treyler: String(form.treyler || ""), // treyler isteğe bağlı
            tarih: String(form.tarih || new Date().toISOString().slice(0, 10)),
            surucu: String(form.surucu || ""),
            yukleme_musteri: String(form.yukleme_musteri || ""),
            fatura_musteri: String(form.fatura_musteri || ""),
            bolge_palet_sayisi: Number(form.bolge_palet_sayisi || 0),
            odenen_tutar: Number(form.odenen_tutar || 0),
            palet_sayisi: Number(form.palet_sayisi || 0),
            donem: String(form.donem || ""),
            kullanici_adi: String(form.kullanici_adi || localUserName || ""),
        };

        try {
            let data;
            if (formMode === "edit" && editingId) {
                const { data: updatedData, error } = await supabase
                    .from("hamaliye")
                    .update(payload)
                    .eq("id", editingId)
                    .select()
                    .single();
                if (error) throw error;
                data = updatedData;
                setRows((rs) => rs.map((r) => (r.id === editingId ? { ...r, ...data } : r)));
            } else {
                const { data: newRowData, error } = await supabase
                    .from("hamaliye")
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                data = newRowData;
                setRows((r) => [data, ...r]);
            }

            // Kapat & sıfırla (Formu temizle)
            setDialogOpen(false);
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            setForm({ ...initialFormState, donem: `${y}-${m}`, kullanici_adi: localUserName, tarih: d.toISOString().slice(0, 10) });
            setPlateSearch("");
            setEditingId(null);
            setFormMode("create");
            setErrors({});

        } catch (err) {
            console.error("Kaydet/Güncelle hatası:", err);
            setActionErr(`Kaydet/Güncelle hatası: ${String(err.message || err)}`);
        }
    }

    // --- EXCEL DIŞA AKTARMA FONKSİYONU ---
    function exportExcel() {
        try {
            // 1. Veriyi hazırla
            const dataToExport = filtered.map(r => ({
                [COLUMNS[0].label]: r.created_at ? new Date(r.created_at).toLocaleString("tr-TR") : "", // OLUŞTURULMA TAR.
                [COLUMNS[1].label]: r.gelir_gider, // PRİM/HAMALİYE
                [COLUMNS[2].label]: r.sefer_no, // SEFER NO
                [COLUMNS[3].label]: (r.plaka || "").toUpperCase(), // PLAKA
                [COLUMNS[4].label]: r.treyler, // TREYLER
                [COLUMNS[5].label]: r.tarih, // TARİH
                [COLUMNS[6].label]: r.surucu, // SÜRÜCÜ
                [COLUMNS[7].label]: r.telefon_numarasi, // TELEFON NO
                [COLUMNS[7].label]: r.yukleme_musteri, // YÜKLEME MÜŞTERİ
                [COLUMNS[8].label]: r.fatura_musteri, // FATURA MÜŞTERİ
                [COLUMNS[9].label]: r.bolge_palet_sayisi ?? 0, // BÖLGE PALET (Sayı olarak)
                [COLUMNS[10].label]: r.odenen_tutar ?? 0, // ÖDENEN TUTAR (Sayı olarak)
                [COLUMNS[11].label]: r.palet_sayisi ?? 0, // PALET SAYISI (Sayı olarak)
                [COLUMNS[12].label]: r.donem, // DÖNEM
                [COLUMNS[13].label]: r.kullanici_adi, // KULLANICI ADI
            }));

            // 2. Çalışma sayfası (Worksheet) oluştur
            const ws = XLSX.utils.json_to_sheet(dataToExport);

            // 3. (İsteğe bağlı) Sütun genişliklerini ayarla
            ws["!cols"] = COLUMNS.map(c => ({
                wch: Math.max(c.label.length, c.minWidth / 8)
            }));

            // Ödenen Tutar sütununu para birimi olarak formatla
            const tutarColIndex = 10; // 'ÖDENEN TUTAR' COLUMNS dizisindeki 10. index
            const tutarColLetter = XLSX.utils.encode_col(tutarColIndex);

            for (let i = 2; i <= dataToExport.length + 1; i++) {
                const cellRef = `${tutarColLetter}${i}`;
                if (ws[cellRef]) {
                    ws[cellRef].t = 'n'; // type: number
                    ws[cellRef].z = '#,##0 ₺'; // format: 1.234 ₺
                }
            }

            // 4. Çalışma kitabı (Workbook) oluştur ve sayfayı ekle
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Hamaliye Raporu"); // Sayfa adı

            // 5. Dosyayı indir
            const fileName = `hamaliye_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);

        } catch (err) {
            console.error("Excel dışa aktarma hatası:", err);
            setActionErr(`Excel dosyası oluşturulurken bir hata oluştu: ${String(err.message || err)}`);
        }
    }
    // --- EXCEL DIŞA AKTARMA BİTİŞİ ---


    // --- EXCEL İÇERİ AKTARMA FONKSİYONLARI ---

    // Excel'den gelen tarihi (JS Date, string veya seri no) YYYY-MM-DD formatına çevirir
    function formatImportDate(val) {
        if (!val) return null;
        try {
            // Eğer xlsx kütüphanesi bunu zaten bir JS Date nesnesine çevirdiyse
            if (val instanceof Date) {
                return val.toISOString().slice(0, 10);
            }
            // Eğer "25.10.2025" veya "25/10/2025" formatında bir string ise
            if (typeof val === 'string' && (val.includes('.') || val.includes('/'))) {
                const parts = val.split(/[.\/]/);
                if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    const year = parts[2];
                    // DD.MM.YYYY formatı
                    if (year.length === 4) return `${year}-${month}-${day}`;
                    // YYYY.MM.DD formatı (ilk kısım yıl ise)
                    if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
                }
            }
            // Eğer zaten "2025-10-25" formatında ise
            if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return val;
            }
            // Eğer Excel seri numarası ise (1970-01-01 = 25569)
            if (typeof val === 'number' && val > 25569) {
                // Zaman dilimi sorunlarını önlemek için UTC olarak hesapla
                const d = new Date((val - 25569) * 86400 * 1000 + (new Date().getTimezoneOffset() * 60 * 1000));
                return d.toISOString().slice(0, 10);
            }

            console.warn("Tanınmayan tarih formatı, olduğu gibi alınıyor:", val);
            return String(val).slice(0, 10); // Son çare
        } catch (e) {
            console.error("Tarih ayrıştırma hatası:", e);
            return null;
        }
    }

    // ... (Dosyanın geri kalanı aynı)

    // --- handleFileUpload: tam, güncel (donem -> YYYY-MM dönüştürme dahil) ---
    // Eğer henüz eklemediysen (Supabase SQL):
    // ALTER TABLE hamaliye ADD COLUMN telefon_numarasi text;

    const handleFileUpload = async (e) => {
        const file = e.target?.files?.[0];
        if (!file) return;

        setImportLoading(true);
        setActionErr("");

        const HEADER_MAP = {
            'PRİM/HAMALİYE': 'gelir_gider',
            'GELİR/GİDER': 'gelir_gider',
            'SEFER NO': 'sefer_no',
            'TARİH': 'tarih',
            'PLAKA': 'plaka',
            'TREYLER': 'treyler',
            'AD/SOYAD': 'surucu',
            'SÜRÜCÜ': 'surucu',
            'TELEFON NUMARASI': 'telefon_numarasi', // <-- eklendi
            'YÜKLEME MÜŞTERİ': 'yukleme_musteri',
            'FATURA MÜŞTERİ': 'fatura_musteri',
            'BÖLGE VE PALET SAYISI': 'bolge_palet_sayisi',
            'BÖLGE PALET': 'bolge_palet_sayisi',
            'ÖDENEN TUTAR': 'odenen_tutar',
            'PALET SAYISI': 'palet_sayisi',
            'DÖNEM': 'donem',
            'KULLANICI ADI': 'kullanici_adi',
            'KULLANICI': 'kullanici_adi',
            'SİSTEM GİRİŞİ YAPILDI': 'sistem_giris_yapildi',
            'SISTEM GIRISI YAPILDI': 'sistem_giris_yapildi'
        };

        // normalize helper
        const normalize = (s) => {
            if (s == null) return "";
            return String(s)
                .replace(/\u00A0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
        };

        // tarih çevirici
        const formatImportDate = (raw) => {
            if (raw == null || raw === "") return null;
            if (!isNaN(raw) && Number(raw) > 0) {
                const serial = Number(raw);
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000).toISOString();
            }
            const s = String(raw).trim();
            const dm = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
            if (dm) {
                let dd = dm[1].padStart(2, '0'), mm = dm[2].padStart(2, '0'), yy = dm[3];
                if (yy.length === 2) yy = '20' + yy;
                const iso = `${yy}-${mm}-${dd}T00:00:00.000Z`;
                const d = new Date(iso);
                if (!isNaN(d.getTime())) return d.toISOString();
            }
            const d2 = new Date(s);
            if (!isNaN(d2.getTime())) return d2.toISOString();
            return null;
        };

        // Dönem formatlayıcı: "Apr-25" / "Nis.25" -> "2025-04"
        const formatDonemCell = (raw) => {
            if (!raw && raw !== 0) return "";
            let s = String(raw).trim();
            s = s.replace(/\./g, '').replace(/\s+/g, ' ');
            const monthMap = {
                JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
                JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
                OCA: 1, SUB: 2, ŞUB: 2, MAR: 3, NIS: 4, NİS: 4,
                MAY: 5, HAZ: 6, TEM: 7, AGU: 8, AĞU: 8,
                EYL: 9, EKI: 10, EKİ: 10, KAS: 11, ARA: 12
            };
            const m = s.match(/^([A-Za-zÇĞİÖŞÜçğıöşü]{3,4})[-\s\/]?'?(\d{2,4})$/i);
            if (m) {
                let mon = m[1].toUpperCase().replace(/\./g, '').replace('İ', 'I').replace('Ş', 'S').replace('Ğ', 'G').replace('Ç', 'C').replace('Ü', 'U').replace('Ö', 'O');
                mon = mon.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                let yy = m[2];
                if (yy.length === 2) yy = '20' + yy;
                const monthNum = monthMap[mon];
                if (!monthNum) return s;
                return `${yy}-${String(monthNum).padStart(2, '0')}`; // YYYY-MM
            }
            if (/^\d{4}[-\/]\d{1,2}$/.test(s)) {
                return s.replace('/', '-');
            }
            return s;
        };

        // parse para / sayı
        const parseNumberSafe = (val) => {
            if (val == null) return 0;
            let s = String(val).trim();
            if (s === "") return 0;
            s = s.replace(/[^\d,.\-]/g, '');
            const commaCount = (s.match(/,/g) || []).length;
            const dotCount = (s.match(/\./g) || []).length;
            if (commaCount === 1 && dotCount === 0) s = s.replace(',', '.');
            else if (commaCount > 0 && dotCount > 0 && s.indexOf('.') < s.indexOf(',')) s = s.replace(/\./g, '').replace(',', '.');
            else s = s.replace(/,/g, '');
            const n = parseFloat(s);
            return Number.isFinite(n) ? n : 0;
        };

        // palet parse (isteğe bağlı)
        const parsePalet = (val) => {
            if (val == null) return { raw: null };
            const s = String(val).trim();
            const range = s.match(/(\d+)\s*-\s*(\d+)/);
            if (range) return { min: Number(range[1]), max: Number(range[2]), raw: s };
            const single = s.match(/(\d+)/);
            if (single) return { min: Number(single[1]), max: Number(single[1]), raw: s };
            return { raw: s };
        };

        // heuristic: uzun açıklamalar veya belirli kelimeler sistem notu olabilir
        const looksLikeSystemNote = (val) => {
            if (val == null) return false;
            const s = String(val).trim();
            if (s.length > 40) return true;
            const keywords = ['MÜŞTERİ', 'ALINMAMIŞ', 'ESKİ', 'ÖDENMEYECEK', 'NOT', 'AÇIKLAMA'];
            const up = s.toUpperCase();
            for (const k of keywords) if (up.includes(k)) return true;
            const wordCount = s.split(/\s+/).length;
            if (wordCount >= 4) return true;
            return false;
        };

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
                if (!jsonData || jsonData.length === 0) throw new Error("Excel dosyası boş veya okunamadı.");

                // başlıkları al ve normalize et
                const firstRow = jsonData[0] || {};
                const fileHeaders = Object.keys(firstRow).map(h => ({ original: h, normalized: normalize(h) })).filter(h => h.normalized.length > 0);
                console.info("Excel fileHeaders:", fileHeaders);
                const normalizedToOriginal = {};
                for (const fh of fileHeaders) normalizedToOriginal[fh.normalized] = fh.original;

                // aliaslar ve eşleştirme
                const ALIASES = {
                    'BOLGE PALET': 'BÖLGE VE PALET SAYISI',
                    'BÖLGE PALET': 'BÖLGE VE PALET SAYISI',
                    'BOLGE VE PALET': 'BÖLGE VE PALET SAYISI',
                    'ODENEN TUTAR': 'ÖDENEN TUTAR',
                    'OEDENEN TUTAR': 'ÖDENEN TUTAR'
                };

                const optionalDbKeys = new Set(['surucu', 'kullanici_adi', 'sistem_giris_yapildi', 'telefon_numarasi']);
                const dbKeyToFileHeader = {};

                for (const [rawHeader, dbKey] of Object.entries(HEADER_MAP)) {
                    const targetNorm = normalize(rawHeader);
                    let match = normalizedToOriginal[targetNorm];

                    // alias kontrolü
                    if (!match) {
                        for (const [alias, target] of Object.entries(ALIASES)) {
                            if (normalize(target) === targetNorm) {
                                const aliasNorm = normalize(alias);
                                if (normalizedToOriginal[aliasNorm]) { match = normalizedToOriginal[aliasNorm]; break; }
                            }
                        }
                    }

                    // token-overlap tolerant match
                    if (!match) {
                        const tokens = targetNorm.split(/\s+/).filter(Boolean);
                        let best = null, bestScore = 0;
                        for (const fh of fileHeaders) {
                            let matched = 0;
                            for (const t of tokens) if (fh.normalized.includes(t)) matched++;
                            const score = tokens.length ? (matched / tokens.length) : 0;
                            if (score > bestScore) { bestScore = score; best = fh; }
                        }
                        if (best && (bestScore >= 0.5 || (tokens.length === 1 && bestScore > 0))) {
                            match = best.original;
                        }
                    }

                    // özel: kullanici_adi iki ayrı sütunda gelebilir
                    if (!match && dbKey === 'kullanici_adi') {
                        const candUser = fileHeaders.find(fh => fh.normalized.includes(normalize('KULLANICI')));
                        const candSystem = fileHeaders.find(fh => {
                            const n = fh.normalized;
                            return n.includes(normalize('SISTEM')) || n.includes(normalize('GIRIS')) || n.includes(normalize('GIRIŞ')) || n.includes(normalize('GİRİŞİ'));
                        });
                        const parts = [];
                        if (candUser) parts.push(candUser.original);
                        if (candSystem && candSystem.original !== candUser?.original) parts.push(candSystem.original);
                        if (parts.length) { dbKeyToFileHeader[dbKey] = parts; continue; }
                    }

                    if (!match) {
                        if (optionalDbKeys.has(dbKey)) continue;
                        console.warn(`Beklenen başlık bulunamadı: ${rawHeader}`);
                        continue;
                    }

                    dbKeyToFileHeader[dbKey] = match;
                }

                // hücre okuma
                const getCell = (dbKey, row) => {
                    const headerOrHeaders = dbKeyToFileHeader[dbKey];
                    if (!headerOrHeaders) return undefined;
                    if (typeof headerOrHeaders === 'string') return row[headerOrHeaders];
                    for (const h of headerOrHeaders) {
                        const v = row[h];
                        if (v != null && String(v).trim() !== "") return v;
                    }
                    return undefined;
                };

                const payloads = [];
                for (const row of jsonData) {
                    // plaka/treyler: öncelik ayrı TREYLER sütunu, yoksa PLAKA içinden split
                    const plakaCell = getCell('plaka', row);
                    const treylerCell = getCell('treyler', row);

                    let plakaVal = plakaCell != null ? String(plakaCell).trim().toUpperCase() : "";
                    let treylerVal = treylerCell != null ? String(treylerCell).trim() : "";

                    if ((!treylerVal || treylerVal === "") && plakaVal) {
                        const parts = plakaVal.split(/\s*[-–—]\s*/);
                        if (parts.length > 1) {
                            plakaVal = (parts[0] || "").trim().toUpperCase();
                            treylerVal = parts.slice(1).join(' - ').trim();
                        }
                    }

                    const seferNo = String(getCell('sefer_no', row) ?? "").trim();
                    if (!plakaVal && !seferNo) continue;

                    const formattedDate = formatImportDate(getCell('tarih', row));
                    const bolgePaletRaw = getCell('bolge_palet_sayisi', row);
                    const odenenNum = parseNumberSafe(getCell('odenen_tutar', row));
                    const paletRaw = getCell('palet_sayisi', row);
                    const donemRaw = getCell('donem', row);

                    // kullanıcı / sistem notu ayrımı
                    let kullaniciVal = getCell('kullanici_adi', row);
                    let sistemNoteVal = getCell('sistem_giris_yapildi', row);

                    if (kullaniciVal != null) kullaniciVal = String(kullaniciVal).trim();
                    if (sistemNoteVal != null) sistemNoteVal = String(sistemNoteVal).trim();

                    if ((!sistemNoteVal || sistemNoteVal === "") && kullaniciVal && looksLikeSystemNote(kullaniciVal)) {
                        sistemNoteVal = kullaniciVal;
                        kullaniciVal = localUserName ?? "";
                    }

                    if ((!kullaniciVal || kullaniciVal === "") && sistemNoteVal && !looksLikeSystemNote(sistemNoteVal)) {
                        kullaniciVal = sistemNoteVal;
                        sistemNoteVal = "";
                    }

                    if (!kullaniciVal) kullaniciVal = localUserName ?? "";

                    // TELEFON NUMARASI
                    const telefonRaw = getCell('telefon_numarasi', row);
                    const telefonNormalized = telefonRaw != null ? String(telefonRaw).trim() : "";

                    const newRow = {
                        gelir_gider: String(getCell('gelir_gider', row) ?? "Prim"),
                        sefer_no: seferNo,
                        tarih: formattedDate,
                        plaka: plakaVal,
                        treyler: treylerVal,
                        surucu: String(getCell('surucu', row) ?? ""),
                        telefon_numarasi: telefonNormalized, // <-- eklendi
                        yukleme_musteri: String(getCell('yukleme_musteri', row) ?? ""),
                        fatura_musteri: String(getCell('fatura_musteri', row) ?? ""),
                        bolge_palet_sayisi: bolgePaletRaw != null ? String(bolgePaletRaw) : "",
                        odenen_tutar: odenenNum,
                        palet_sayisi: paletRaw != null ? String(paletRaw) : "",
                        donem: formatDonemCell(donemRaw),
                        kullanici_adi: String(kullaniciVal ?? localUserName ?? ""),
                        sistem_giris_yapildi: String(sistemNoteVal ?? "")
                    };

                    payloads.push(newRow);
                }

                if (payloads.length === 0) throw new Error("Excel'den içe aktarılacak geçerli veri bulunamadı.");

                // Supabase insert
                const { data: insertedData, error } = await supabase.from("hamaliye").insert(payloads).select();
                if (error) throw error;

                setRows((cur) => [...insertedData, ...cur]);
                setActionErr(`${insertedData.length} kayıt başarıyla içeri aktarıldı!`);
            } catch (err) {
                console.error("Excel import error:", err);
                setActionErr(`İçe aktarma hatası: ${err?.message ?? err}`);
            } finally {
                setImportLoading(false);
                if (e.target) e.target.value = null;
            }
        };

        reader.readAsArrayBuffer(file);
    };



    // Seçilen Plaka/Treyler nesnesi (Autocomplete için)
    const selectedPlateObj =
        plakalar.find(
            (p) =>
                (p.plaka || "").toUpperCase() === (form.plaka || "").toUpperCase() &&
                String(p.treyler || "") === String(form.treyler || "")
        ) || null;

    // Ay seçimi için dönem listesi
    const monthOptions = Array.from({ length: 12 }, (_, i) => {
        const mo = String(i + 1).padStart(2, "0");
        return { value: mo, label: mo };
    });

    const getMonthFromDonem = form.donem ? form.donem.slice(5, 7) : mm;


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
            <Container maxWidth="xl" disableGutters>
                {/* Üst Başlık ve Aksiyonlar */}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                    <Box>
                        <Typography
                            variant="h4"
                            fontWeight={900}
                            sx={{
                                background: "linear-gradient(90deg, #6d28d9, #0ea5e9)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            Hamaliye & Prim Yönetimi 💸
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Kayıtları listele, filtrele ve yönet.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1.5}>
                        {/* --- YENİ İÇERİ AKTAR BUTONU --- */}
                        <Button
                            component="label" // input'u tetiklemesi için
                            variant="outlined"
                            color="secondary"
                            startIcon={importLoading ? <CircularProgress size={20} color="inherit" /> : <UploadFileIcon />}
                            disabled={importLoading}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                            Excel İçeri Aktar
                            <input
                                type="file"
                                hidden
                                accept=".xlsx, .xls" // Sadece Excel dosyaları
                                onChange={handleFileUpload} // Dosya seçildiğinde tetikle
                            />
                        </Button>
                        {/* --- DÜZELTİLMİŞ EXCEL DIŞA AKTAR BUTONU --- */}
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={exportExcel}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                            Excel Dışa Aktar
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<AddIcon />}
                            onClick={handleNewRecord}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                            Yeni Kayıt
                        </Button>
                    </Stack>
                </Stack>

                {/* Hata Mesajları */}
                {rowsErr && <Alert severity="error" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{rowsErr}</Alert>}
                {/* --- GÜNCELLENMİŞ HATA/BAŞARI MESAJI --- */}
                {actionErr && <Alert severity={actionErr.includes("başarıyla") ? "success" : "error"} sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{actionErr}</Alert>}


                <Paper elevation={16} sx={{ borderRadius: 4, overflow: "hidden" }}>

                    {/* Filtreler Alanı */}
                    <CardHeader
                        title={<Stack direction="row" alignItems="center" spacing={1}><FilterListIcon color="primary" /><Typography variant="h6" fontWeight={700} color="primary.main">Veri Filtreleme</Typography></Stack>}
                        sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'primary.dark' : 'primary.lightest', p: 2, borderBottom: '1px solid', borderColor: 'divider' }}
                    />
                    <CardContent sx={{ p: 2 }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={4} lg={3}>
                                <TextField
                                    fullWidth size="small" placeholder="Genel Arama (Plaka, Sefer No, Müşteri...)"
                                    value={globalQuery}
                                    onChange={(e) => { setGlobalQuery(e.target.value); setPage(1); }}
                                    InputProps={{
                                        startAdornment: <SearchIcon sx={{ mr: 1, opacity: 0.7 }} />,
                                        endAdornment: globalQuery ? (
                                            <Tooltip title="Temizle"><IconButton size="small" onClick={() => setGlobalQuery("")}><CloseIcon fontSize="small" /></IconButton></Tooltip>
                                        ) : null,
                                    }}
                                />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2} lg={1}>
                                <TextField label="Başlangıç" type="date" size="small" fullWidth value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2} lg={1}>
                                <TextField label="Bitiş" type="date" size="small" fullWidth value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2} lg={2}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel id="gg-label">Prim/Hamaliye</InputLabel>
                                    <Select labelId="gg-label" label="Prim/Hamaliye" value={gelirGider} onChange={(e) => { setGelirGider(e.target.value); setPage(1); }}>
                                        <MenuItem value="Hepsi">Hepsi</MenuItem>
                                        <MenuItem value="Prim">Prim</MenuItem>
                                        <MenuItem value="Hamaliye">Hamaliye</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={6} sm={4} md={2} lg={2}>
                                <TextField label="Dönem (YYYY-AA)" size="small" fullWidth value={donem === "Hepsi" ? "" : donem} onChange={(e) => { setDonem(e.target.value || "Hepsi"); setPage(1); }} />
                            </Grid>
                            <Grid item xs={12} sm={4} md={2} lg={1}>
                                <Button variant="outlined" onClick={resetFilters} startIcon={<CloseIcon />}>Sıfırla</Button>
                            </Grid>
                        </Grid>
                    </CardContent>

                    {/* Tablo Alanı */}
                    <CardHeader
                        title={
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="h6" fontWeight={700}>Kayıt Listesi</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    {rowsLoading && <CircularProgress size={18} color="secondary" />}
                                    <Chip label={`${total} Toplam Kayıt`} size="medium" color="secondary" variant="outlined" />
                                </Stack>
                            </Stack>
                        }
                        sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'secondary.dark' : 'secondary.lightest', p: 2, borderTop: '1px solid', borderColor: 'divider' }}
                    />

                    <TableContainer sx={{ maxHeight: 600, borderTop: "1px solid", borderColor: "divider" }}>
                        <Table size="small" stickyHeader sx={{ minWidth: 1400 }}>
                            <TableHead>
                                <TableRow>
                                    {COLUMNS.map((c) => (
                                        <TableCell
                                            key={c.key}
                                            align={c.numeric ? "right" : "left"}
                                            sx={{
                                                bgcolor: 'background.paper',
                                                fontWeight: 700,
                                                fontSize: 12,
                                                whiteSpace: 'nowrap',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => toggleSort(c.key)}
                                        >
                                            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={c.numeric ? "flex-end" : "flex-start"}>
                                                {c.label}
                                                {sortKey === c.key ? (sortDir === "asc" ? <ArrowUpwardIcon fontSize="inherit" /> : <ArrowDownwardIcon fontSize="inherit" />) : <ArrowUpwardIcon fontSize="inherit" sx={{ opacity: 0 }} />}
                                            </Stack>
                                        </TableCell>
                                    ))}
                                    <TableCell align="right" sx={{ bgcolor: 'background.paper', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', width: 90 }}>
                                        İşlemler
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paged.length === 0 && (
                                    <TableRow><TableCell colSpan={COLUMNS.length + 1} align="center" sx={{ py: 6, color: "text.secondary" }}>
                                        {rowsLoading ? <CircularProgress size={24} /> : "Kayıt bulunamadı."}
                                    </TableCell></TableRow>
                                )}
                                {paged.map((r, i) => (
                                    <TableRow key={r.id} hover sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}>
                                        <TableCell sx={{ color: "text.secondary", fontSize: 11 }}>
                                            {r.created_at ? new Date(r.created_at).toLocaleString("tr-TR") : "-"}
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={r.gelir_gider}
                                                size="small"
                                                {...getChipColor(r.gelir_gider)}
                                            />
                                        </TableCell>

                                        <TableCell sx={{ fontSize: 12 }}>{r.sefer_no}</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{(r.plaka || "").toUpperCase()}</TableCell>
                                        <TableCell sx={{ fontSize: 12 }}>{r.treyler || "—"}</TableCell>
                                        <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.tarih}</TableCell>
                                        <TableCell sx={{ fontSize: 12 }}>{r.surucu}</TableCell>
                                        <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.telefon_numarasi || "—"}</TableCell>
                                        <TableCell sx={{ fontSize: 12 }}>{r.yukleme_musteri}</TableCell>
                                        <TableCell sx={{ fontSize: 12 }}>{r.fatura_musteri}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{r.bolge_palet_sayisi}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: 'error.main' }}>{currencyTRY(r.odenen_tutar)}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{r.palet_sayisi}</TableCell>
                                        <TableCell sx={{ fontSize: 12 }}>{r.donem}</TableCell>
                                        <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{r.kullanici_adi}</TableCell>
                                        <TableCell align="right" sx={{ width: 90 }}>
                                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                <Tooltip title="Düzenle">
                                                    <IconButton size="small" color="primary" onClick={() => handleEditRow(r)}><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                <Tooltip title="Sil">
                                                    <IconButton size="small" color="error" onClick={() => handleDeleteRow(r)}><DeleteIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Sayfalama */}
                    <CardContent sx={{ pt: 2, pb: 2 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" spacing={2}>
                            <Typography variant="caption" color="text.secondary">
                                Toplam **{total}** kayıttan **{((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)}** arası gösteriliyor.
                            </Typography>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel id="psize">Sayfa Boyutu</InputLabel>
                                    <Select labelId="psize" label="Sayfa Boyutu" value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                                        {[10, 25, 50, 100].map((n) => (<MenuItem key={n} value={String(n)}>{n} / sayfa</MenuItem>))}
                                    </Select>
                                </FormControl>
                                <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} shape="rounded" size="medium" showFirstButton showLastButton color="primary" />
                            </Stack>
                        </Stack>
                    </CardContent>

                </Paper>


                {/* Yeni Kayıt / Düzenle Dialog */}
                <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
                    <DialogTitle sx={{ fontWeight: 800, color: 'primary.main', pb: 1.5 }}>
                        {formMode === "edit" ? "Kaydı Düzenle 📝" : "Yeni Hamaliye Kaydı ➕"}
                    </DialogTitle>
                    <DialogContent dividers>
                        {plateErr && <Alert severity="warning" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{plateErr}</Alert>}

                        {/* Plaka Yenileme Aksiyonu */}
                        <Box sx={{ mb: 2, textAlign: 'right' }}>
                            <Button size="small" onClick={() => loadPlates("")} startIcon={<CircularProgress size={12} color="inherit" sx={{ visibility: plakalarLoading ? 'visible' : 'hidden' }} />}>
                                Plaka listesini yenile
                            </Button>
                        </Box>

                        <Grid container spacing={3}>
                            {/* Sol Kolon */}
                            <Grid item xs={12} md={6}>
                                <Stack spacing={2}>
                                    <TextField
                                        label="Sefer No"
                                        value={form.sefer_no || ""}
                                        onChange={(e) => setForm({ ...form, sefer_no: e.target.value })}
                                        error={!!errors.sefer_no}
                                        helperText={errors.sefer_no}
                                        fullWidth
                                    />

                                    {/* Plaka - Treyler - Sürücü (Autocomplete) */}
                                    <Autocomplete
                                        options={plakalar}
                                        loading={plakalarLoading}
                                        openOnFocus
                                        value={selectedPlateObj}
                                        onChange={(_, val) => {
                                            if (val) {
                                                setForm((f) => ({
                                                    ...f, plaka: (val.plaka || "").toUpperCase(), treyler: val.treyler || "", surucu: val.surucu_adi || "",
                                                }));
                                            } else {
                                                setForm((f) => ({ ...f, plaka: "", treyler: "", surucu: "" }));
                                            }
                                        }}
                                        inputValue={plateSearch}
                                        onInputChange={(_, v) => setPlateSearch(v)}
                                        getOptionLabel={(opt) => opt ? `${(opt.plaka || "").toUpperCase()}${opt.treyler ? " - " + opt.treyler : ""}` : ""}
                                        isOptionEqualToValue={(o, v) => (o?.plaka || "").toUpperCase() === (v?.plaka || "").toUpperCase() && String(o?.treyler || "") === String(v?.treyler || "")}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Plaka - Treyler"
                                                placeholder="Örn: 34ABC123"
                                                error={!!errors.plaka} // 'treyler' hatasını kaldırdık
                                                helperText={plateErr || errors.plaka || "Seçince sürücü otomatik dolar"}
                                            />
                                        )}
                                    />

                                    <TextField
                                        label="Tarih"
                                        type="date"
                                        value={form.tarih || ""}
                                        onChange={(e) => setForm({ ...form, tarih: e.target.value })}
                                        InputLabelProps={{ shrink: true }}
                                        error={!!errors.tarih}
                                        helperText={errors.tarih}
                                    />

                                    <FormControl error={!!errors.gelir_gider}>
                                        <InputLabel id="gg-dialog">Prim/Hamaliye</InputLabel>
                                        <Select
                                            labelId="gg-dialog"
                                            label="Prim/Hamaliye"
                                            value={form.gelir_gider || "Prim"}
                                            onChange={(e) => setForm({ ...form, gelir_gider: e.target.value })}
                                        >
                                            <MenuItem value="Prim">Prim</MenuItem>
                                            <MenuItem value="Hamaliye">Hamaliye</MenuItem>
                                        </Select>
                                        {errors.gelir_gider && <Typography variant="caption" color="error">{errors.gelir_gider}</Typography>}
                                    </FormControl>

                                    {/* Ödenen Tutar - canlı ₺ */}
                                    <TextField
                                        label="Ödenen Tutar (₺)"
                                        value={form.odenen_tutar_str ?? ""}
                                        onChange={(e) => {
                                            const { num, text } = formatTRYInput(e.target.value);
                                            setForm({ ...form, odenen_tutar: num, odenen_tutar_str: text });
                                        }}
                                        placeholder="₺0"
                                        error={!!errors.odenen_tutar}
                                        helperText={errors.odenen_tutar}
                                        inputMode="numeric"
                                    />
                                </Stack>
                            </Grid>

                            {/* Sağ Kolon */}
                            <Grid item xs={12} md={6}>
                                <Stack spacing={2}>
                                    <TextField
                                        label="Sürücü"
                                        value={form.surucu || ""}
                                        onChange={(e) => setForm({ ...form, surucu: e.target.value })}
                                        error={!!errors.surucu}
                                        helperText={errors.surucu || "Plaka seçildiğinde otomatik doldurulur"}
                                        InputProps={{ readOnly: selectedPlateObj, endAdornment: selectedPlateObj ? <Chip label="Otomatik" size="small" /> : null }}
                                    />
                                    <TextField
                                        label="Yükleme Müşteri"
                                        value={form.yukleme_musteri || ""}
                                        onChange={(e) => setForm({ ...form, yukleme_musteri: e.target.value })}
                                        error={!!errors.yukleme_musteri}
                                        helperText={errors.yukleme_musteri}
                                    />
                                    <TextField
                                        label="Fatura Müşteri"
                                        value={form.fatura_musteri || ""}
                                        onChange={(e) => setForm({ ...form, fatura_musteri: e.target.value })}
                                        error={!!errors.fatura_musteri}
                                        helperText={errors.fatura_musteri}
                                    />
                                    <Stack direction="row" spacing={2}>
                                        <TextField
                                            label="Bölge Palet"
                                            type="number"
                                            value={form.bolge_palet_sayisi ?? ""}
                                            onChange={(e) => setForm({ ...form, bolge_palet_sayisi: Number(e.target.value) })}
                                            sx={{ flex: 1 }}
                                            InputProps={{ inputProps: { min: 0 } }}
                                        />
                                        <TextField
                                            label="Palet Sayısı"
                                            type="number"
                                            value={form.palet_sayisi ?? ""}
                                            onChange={(e) => setForm({ ...form, palet_sayisi: Number(e.target.value) })}
                                            error={!!errors.palet_sayisi}
                                            helperText={errors.palet_sayisi}
                                            sx={{ flex: 1 }}
                                            InputProps={{ inputProps: { min: 0 } }}
                                        />
                                    </Stack>

                                    {/* Dönem: ay seç, yıl otomatik */}
                                    <Stack direction="row" spacing={2} alignItems="flex-start">
                                        <FormControl sx={{ flex: 1 }} error={!!errors.donem}>
                                            <InputLabel id="donem-label">Dönem (Ay)</InputLabel>
                                            <Select
                                                labelId="donem-label"
                                                label="Dönem (Ay)"
                                                value={getMonthFromDonem}
                                                onChange={(e) => {
                                                    const month = String(e.target.value).padStart(2, "0");
                                                    const year = form.tarih ? new Date(form.tarih).getFullYear() : new Date().getFullYear();
                                                    setForm({ ...form, donem: `${year}-${month}` });
                                                }}
                                            >
                                                {monthOptions.map(mo => (
                                                    <MenuItem key={mo.value} value={mo.value}>{mo.value}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <Box sx={{ flex: 1, pt: 1 }}>
                                            <Typography variant="caption" display="block" color="text.secondary">
                                                Seçilen Dönem:
                                            </Typography>
                                            <Chip
                                                label={form.donem || `${yyyy}-${mm}`}
                                                color="info"
                                                variant="outlined"
                                                size="small"
                                                sx={{ fontWeight: 700 }}
                                            />
                                        </Box>
                                    </Stack>


                                    <TextField
                                        label="Kullanıcı Adı"
                                        value={form.kullanici_adi || ""}
                                        onChange={(e) => setForm({ ...form, kullanici_adi: e.target.value })}
                                        InputProps={{ readOnly: !!localUserName, endAdornment: !!localUserName ? <Chip label="Oto." size="small" /> : null }}
                                        error={!!errors.kullanici_adi}
                                        helperText={localUserName ? "LocalStorage'dan otomatik dolduruldu." : (errors.kullanici_adi || "")}
                                    />
                                </Stack>
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button variant="outlined" onClick={() => setDialogOpen(false)} startIcon={<CloseIcon />}>Vazgeç</Button>
                        <Button variant="contained" color="success" onClick={handleSave} startIcon={formMode === "edit" ? <EditIcon /> : <AddIcon />}>
                            {formMode === "edit" ? "Güncelle" : "Kaydet"}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
