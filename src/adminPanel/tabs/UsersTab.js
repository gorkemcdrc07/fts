// src/adminPanel/tabs/UsersTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import {
    Box,
    Paper,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    CircularProgress,
    TableContainer,
    Toolbar,
    TextField,
    InputAdornment,
    Chip,
    Avatar,
    IconButton,
    Tooltip,
    Divider,
    Stack,
    MenuItem,
    Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

const ROLE_COLORS = {
    "YÖNETİCİ": "error",
    "OPERASYON": "info",
    "TAKİP": "success",
};

const ROLE_OPTIONS = ["YÖNETİCİ", "OPERASYON", "TAKİP"];

const getInitials = (name = "") =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("") || "U";

const norm = (s) =>
    (s ?? "")
        .toString()
        .normalize("NFKC")
        .trim();

export default function UsersTab() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");

    // edit state
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState({});
    const [showPw, setShowPw] = useState({});
    const [adding, setAdding] = useState(false);
    const [newUser, setNewUser] = useState({
        kullanici: "",
        kullaniciAdi: "",
        sifre: "",
        rol: "OPERASYON",
        email: "",
        Reel_kullanici: "",
        Reel_sifre: "",
    });
    const [showNewPw, setShowNewPw] = useState({ sifre: false, reel: false });

    const load = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("login")
            .select("*")
            .order("id", { ascending: true });
        if (!error && data) setRows(data);
        setLoading(false);
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return rows;
        return rows.filter((r) =>
            [
                r.id,
                r.kullaniciAdi,
                r.kullanici,
                r.rol,
                r.email,
                r.Reel_kullanici ?? r.reel_kullanici,
                r.Reel_sifre ?? r.reel_sifre,
            ]
                .map((v) => String(v ?? "").toLowerCase())
                .some((s) => s.includes(needle))
        );
    }, [rows, q]);

    const copy = async (txt) => {
        try {
            await navigator.clipboard.writeText(String(txt ?? ""));
        } catch { /* no-op */ }
    };

    const beginEdit = (row) => {
        setEditingId(row.id);
        setDraft({
            id: row.id,
            kullanici: row.kullanici || "",
            kullaniciAdi: row.kullaniciAdi || "",
            sifre: row.sifre || "",
            rol: (row.rol || "OPERASYON").toUpperCase(),
            email: row.email || "",
            Reel_kullanici: row.Reel_kullanici ?? row.reel_kullanici ?? "",
            Reel_sifre: row.Reel_sifre ?? row.reel_sifre ?? "",
        });
        setShowPw((p) => ({ ...p, [row.id]: { sifre: false, reel: false } }));
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraft({});
    };

    const saveEdit = async () => {
        const id = editingId;
        if (!id) return;

        // güncellenecek payload: mevcut kolon isimleriyle tutarlı kalsın
        const payload = {
            kullanici: norm(draft.kullanici),
            kullaniciAdi: norm(draft.kullaniciAdi),
            sifre: draft.sifre ?? "",
            rol: norm(draft.rol),
            email: norm(draft.email),
            Reel_kullanici: norm(draft.Reel_kullanici),
            Reel_sifre: draft.Reel_sifre ?? "",
        };

        const { error } = await supabase.from("login").update(payload).eq("id", id);
        if (error) {
            alert("Kaydedilemedi: " + error.message);
            return;
        }
        await load();
        cancelEdit();
    };

    const addUser = async () => {
        // basit validasyon
        if (!newUser.kullaniciAdi || !newUser.sifre || !newUser.kullanici) {
            alert("Kullanıcı, KullanıcıAdı ve Şifre zorunludur.");
            return;
        }
        const payload = {
            kullanici: norm(newUser.kullanici),
            kullaniciAdi: norm(newUser.kullaniciAdi),
            sifre: newUser.sifre,
            rol: norm(newUser.rol || "OPERASYON"),
            email: norm(newUser.email),
            Reel_kullanici: norm(newUser.Reel_kullanici),
            Reel_sifre: newUser.Reel_sifre ?? "",
            profil_fotograf: null,
        };
        const { error } = await supabase.from("login").insert(payload);
        if (error) {
            alert("Ekleme hatası: " + error.message);
            return;
        }
        setNewUser({
            kullanici: "",
            kullaniciAdi: "",
            sifre: "",
            rol: "OPERASYON",
            email: "",
            Reel_kullanici: "",
            Reel_sifre: "",
        });
        setAdding(false);
        await load();
    };

    return (
        <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
            {/* Üst şerit */}
            <Toolbar
                sx={{
                    gap: 1,
                    px: 2,
                    py: 1.5,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                }}
            >
                <Typography variant="subtitle1" fontWeight={800} sx={{ mr: "auto" }}>
                    Kullanıcılar (login)
                </Typography>

                <TextField
                    size="small"
                    placeholder="Ara: ad, kullanıcı adı, rol, mail…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ width: 300 }}
                />

                <Tooltip title="Yenile">
                    <span>
                        <IconButton onClick={load} disabled={loading}>
                            {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                        </IconButton>
                    </span>
                </Tooltip>

                <Button
                    startIcon={<AddIcon />}
                    onClick={() => setAdding((v) => !v)}
                    variant={adding ? "contained" : "outlined"}
                    size="small"
                    sx={{ ml: 1 }}
                >
                    Yeni Kullanıcı
                </Button>
            </Toolbar>

            {/* Toplam & filtre */}
            <Box sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                <Chip size="small" label={`Toplam: ${rows.length}`} />
                <Chip
                    size="small"
                    color={q ? "primary" : "default"}
                    variant={q ? "filled" : "outlined"}
                    label={`Görünen: ${filtered.length}`}
                />
            </Box>

            {/* Ekleme paneli */}
            {adding && (
                <>
                    <Divider />
                    <Box sx={{ px: 2, py: 1.5 }}>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                            <TextField
                                label="Ad Soyad"
                                size="small"
                                value={newUser.kullanici}
                                onChange={(e) => setNewUser((p) => ({ ...p, kullanici: e.target.value }))}
                            />
                            <TextField
                                label="Kullanıcı Adı"
                                size="small"
                                value={newUser.kullaniciAdi}
                                onChange={(e) => setNewUser((p) => ({ ...p, kullaniciAdi: e.target.value }))}
                            />
                            <TextField
                                label="Şifre"
                                size="small"
                                type={showNewPw.sifre ? "text" : "password"}
                                value={newUser.sifre}
                                onChange={(e) => setNewUser((p) => ({ ...p, sifre: e.target.value }))}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => setShowNewPw((pr) => ({ ...pr, sifre: !pr.sifre }))}>
                                                {showNewPw.sifre ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <TextField
                                select
                                label="Rol"
                                size="small"
                                value={newUser.rol}
                                onChange={(e) => setNewUser((p) => ({ ...p, rol: e.target.value }))}
                                sx={{ minWidth: 160 }}
                            >
                                {ROLE_OPTIONS.map((r) => (
                                    <MenuItem key={r} value={r}>
                                        {r}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                label="E-posta"
                                size="small"
                                value={newUser.email}
                                onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                            />
                            <TextField
                                label="Reel Kullanıcı"
                                size="small"
                                value={newUser.Reel_kullanici}
                                onChange={(e) => setNewUser((p) => ({ ...p, Reel_kullanici: e.target.value }))}
                            />
                            <TextField
                                label="Reel Şifre"
                                size="small"
                                type={showNewPw.reel ? "text" : "password"}
                                value={newUser.Reel_sifre}
                                onChange={(e) => setNewUser((p) => ({ ...p, Reel_sifre: e.target.value }))}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => setShowNewPw((pr) => ({ ...pr, reel: !pr.reel }))}>
                                                {showNewPw.reel ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <Button startIcon={<SaveIcon />} onClick={addUser} variant="contained" sx={{ px: 2 }}>
                                Kaydet
                            </Button>
                        </Stack>
                    </Box>
                </>
            )}

            <Divider />

            {/* Tablo */}
            <TableContainer sx={{ maxHeight: 520, "& .MuiTableCell-root": { fontSize: 13.5 } }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 76 }}>ID</TableCell>
                            <TableCell>Kullanıcı</TableCell>
                            <TableCell>Kullanıcı Adı</TableCell>
                            <TableCell>Şifre</TableCell>
                            <TableCell>Rol</TableCell>
                            <TableCell>E-posta</TableCell>
                            <TableCell>Reel Kullanıcı</TableCell>
                            <TableCell>Reel Şifre</TableCell>
                            <TableCell align="right" sx={{ width: 120 }}>İşlem</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={9}>
                                    <Box sx={{ py: 3, display: "flex", gap: 1, alignItems: "center", justifyContent: "center" }}>
                                        <CircularProgress size={20} />
                                        <Typography>Yükleniyor…</Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9}>
                                    <Box sx={{ py: 4, textAlign: "center", opacity: 0.7 }}>Sonuç yok.</Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((r) => {
                                const isEdit = editingId === r.id;
                                const color = ROLE_COLORS[(r.rol || "").toUpperCase()] || "default";
                                const avatarSrc = r.profil_fotograf || "";
                                const reelUser = r.Reel_kullanici ?? r.reel_kullanici ?? "";
                                const reelPass = r.Reel_sifre ?? r.reel_sifre ?? "";
                                const show = showPw[r.id] || { sifre: false, reel: false };

                                return (
                                    <TableRow
                                        key={r.id}
                                        sx={{
                                            "&:nth-of-type(2n) td": {
                                                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"),
                                            },
                                        }}
                                    >
                                        <TableCell>
                                            <Chip label={r.id} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                                        </TableCell>

                                        {/* Ad Soyad + avatar */}
                                        <TableCell>
                                            {isEdit ? (
                                                <TextField
                                                    size="small"
                                                    value={draft.kullanici}
                                                    onChange={(e) => setDraft((p) => ({ ...p, kullanici: e.target.value }))}
                                                    fullWidth
                                                />
                                            ) : (
                                                <Stack direction="row" alignItems="center" spacing={1.25}>
                                                    <Avatar
                                                        src={avatarSrc}
                                                        alt={r.kullanici || r.kullaniciAdi}
                                                        sx={{ width: 30, height: 30, fontSize: 13, fontWeight: 800 }}
                                                    >
                                                        {getInitials(r.kullanici || r.kullaniciAdi)}
                                                    </Avatar>
                                                    <Box sx={{ minWidth: 120 }}>
                                                        <Typography fontWeight={700} lineHeight={1.1}>{r.kullanici || "-"}</Typography>
                                                    </Box>
                                                </Stack>
                                            )}
                                        </TableCell>

                                        {/* Kullanıcı Adı */}
                                        <TableCell>
                                            {isEdit ? (
                                                <TextField
                                                    size="small"
                                                    value={draft.kullaniciAdi}
                                                    onChange={(e) => setDraft((p) => ({ ...p, kullaniciAdi: e.target.value }))}
                                                    fullWidth
                                                />
                                            ) : (
                                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                                    <Typography variant="body2" sx={{ mr: 0.5 }}>{r.kullaniciAdi || "-"}</Typography>
                                                    {r.kullaniciAdi && (
                                                        <Tooltip title="Kullanıcı adını kopyala">
                                                            <IconButton size="small" onClick={() => copy(r.kullaniciAdi)}>
                                                                <ContentCopyIcon fontSize="inherit" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Stack>
                                            )}
                                        </TableCell>

                                        {/* Şifre */}
                                        <TableCell>
                                            {isEdit ? (
                                                <TextField
                                                    size="small"
                                                    type={show.sifre ? "text" : "password"}
                                                    value={draft.sifre}
                                                    onChange={(e) => setDraft((p) => ({ ...p, sifre: e.target.value }))}
                                                    fullWidth
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() =>
                                                                        setShowPw((prev) => ({
                                                                            ...prev,
                                                                            [r.id]: { ...(prev[r.id] || {}), sifre: !show.sifre },
                                                                        }))
                                                                    }
                                                                >
                                                                    {show.sifre ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                                </IconButton>
                                                            </InputAdornment>
                                                        ),
                                                    }}
                                                />
                                            ) : (
                                                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                                    {r.sifre ? "••••••••" : "-"}
                                                </Typography>
                                            )}
                                        </TableCell>

                                        {/* Rol */}
                                        <TableCell>
                                            {isEdit ? (
                                                <TextField
                                                    select
                                                    size="small"
                                                    value={draft.rol}
                                                    onChange={(e) => setDraft((p) => ({ ...p, rol: e.target.value }))}
                                                    sx={{ minWidth: 140 }}
                                                >
                                                    {ROLE_OPTIONS.map((opt) => (
                                                        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                                    ))}
                                                </TextField>
                                            ) : (
                                                <Chip
                                                    label={r.rol || "-"}
                                                    size="small"
                                                    color={color}
                                                    variant={color === "default" ? "outlined" : "filled"}
                                                    sx={{ fontWeight: 800 }}
                                                />
                                            )}
                                        </TableCell>

                                        {/* Email */}
                                        <TableCell>
                                            {isEdit ? (
                                                <TextField
                                                    size="small"
                                                    value={draft.email}
                                                    onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                                                    fullWidth
                                                />
                                            ) : (
                                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                                    <Typography variant="body2" sx={{ mr: 0.5 }}>{r.email || "-"}</Typography>
                                                    {r.email && (
                                                        <Tooltip title="E-postayı kopyala">
                                                            <IconButton size="small" onClick={() => copy(r.email)}>
                                                                <ContentCopyIcon fontSize="inherit" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Stack>
                                            )}
                                        </TableCell>

                                        {/* Reel Kullanıcı */}
                                        <TableCell>
                                            {isEdit ? (
                                                <TextField
                                                    size="small"
                                                    value={draft.Reel_kullanici}
                                                    onChange={(e) => setDraft((p) => ({ ...p, Reel_kullanici: e.target.value }))}
                                                    fullWidth
                                                />
                                            ) : (
                                                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                                                    {reelUser || "-"}
                                                </Typography>
                                            )}
                                        </TableCell>

                                        {/* Reel Şifre */}
                                        <TableCell>
                                            {isEdit ? (
                                                <TextField
                                                    size="small"
                                                    type={show.reel ? "text" : "password"}
                                                    value={draft.Reel_sifre}
                                                    onChange={(e) => setDraft((p) => ({ ...p, Reel_sifre: e.target.value }))}
                                                    fullWidth
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() =>
                                                                        setShowPw((prev) => ({
                                                                            ...prev,
                                                                            [r.id]: { ...(prev[r.id] || {}), reel: !show.reel },
                                                                        }))
                                                                    }
                                                                >
                                                                    {show.reel ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                                </IconButton>
                                                            </InputAdornment>
                                                        ),
                                                    }}
                                                />
                                            ) : (
                                                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                                    {reelPass ? "••••••••" : "-"}
                                                </Typography>
                                            )}
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell align="right">
                                            {isEdit ? (
                                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                    <Button
                                                        startIcon={<SaveIcon />}
                                                        onClick={saveEdit}
                                                        size="small"
                                                        variant="contained"
                                                    >
                                                        Kaydet
                                                    </Button>
                                                    <Button
                                                        startIcon={<CloseIcon />}
                                                        onClick={cancelEdit}
                                                        size="small"
                                                        variant="outlined"
                                                        color="inherit"
                                                    >
                                                        Vazgeç
                                                    </Button>
                                                </Stack>
                                            ) : (
                                                <Tooltip title="Düzenle">
                                                    <IconButton size="small" onClick={() => beginEdit(r)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}
