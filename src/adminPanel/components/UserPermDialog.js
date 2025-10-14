import React, { useEffect, useState } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Stack, FormControl, FormLabel, ToggleButtonGroup, ToggleButton,
    Typography, CircularProgress
} from "@mui/material";
import { supabase } from "../../supabaseClient";

const PERMS = [
    { key: "can_sync", title: "Senkronize Et" },
    { key: "can_edit", title: "Düzenleme" },
    { key: "can_eta", title: "ETA Görüntüleme" },
    { key: "may_open_edit", title: "Editörü Açma" },
    { key: "may_open_eta", title: "ETA Panelini Açma" },
];

// value: "inherit" | "true" | "false"
const toValue = (v) => (v === null || typeof v === "undefined") ? "inherit" : (v ? "true" : "false");
const fromValue = (v) => v === "inherit" ? null : (v === "true");

export default function UserPermDialog({ open, onClose, user, roleDefaults }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [vals, setVals] = useState(() => Object.fromEntries(PERMS.map(p => [p.key, "inherit"])));

    const userId = user?.id;

    useEffect(() => {
        if (!open || !userId) return;
        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                const { data } = await supabase
                    .from("user_permissions")
                    .select("*")
                    .eq("user_id", userId)
                    .maybeSingle();
                if (!mounted) return;

                const next = {};
                for (const p of PERMS) next[p.key] = toValue(data ? data[p.key] : null);
                setVals(next);
            } finally {
                setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [open, userId]);

    const handleChange = (key) => (_, v) => {
        if (!v) return;
        setVals(prev => ({ ...prev, [key]: v }));
    };

    const save = async () => {
        if (!userId) return;
        setSaving(true);
        try {
            const payload = { user_id: userId };
            for (const p of PERMS) payload[p.key] = fromValue(vals[p.key]);

            // tümü inherit ise kaydı silmek isteyebilirsin. Şimdilik upsert:
            const { error } = await supabase
                .from("user_permissions")
                .upsert(payload, { onConflict: "user_id" });
            if (error) throw error;

            onClose(true);
        } catch (e) {
            console.error("user perm save error:", e);
            onClose(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="sm">
            <DialogTitle>Kullanıcı Yetkileri — {user?.kullanici || user?.kullaniciAdi || `#${userId}`}</DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
                        <CircularProgress size={20} />
                        <Typography>Yükleniyor…</Typography>
                    </Stack>
                ) : (
                    <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                        {PERMS.map((p) => (
                            <FormControl key={p.key}>
                                <FormLabel sx={{ mb: 0.75, fontWeight: 700 }}>{p.title}</FormLabel>
                                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                    <ToggleButtonGroup
                                        exclusive
                                        size="small"
                                        value={vals[p.key]}
                                        onChange={handleChange(p.key)}
                                    >
                                        <ToggleButton value="inherit">Miras</ToggleButton>
                                        <ToggleButton value="true">Açık</ToggleButton>
                                        <ToggleButton value="false">Kapalı</ToggleButton>
                                    </ToggleButtonGroup>

                                    {roleDefaults && (
                                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                            Rol varsayılanı: <b>{roleDefaults[p.key.replace("can_", "can").replace("may_", "may")] ? "Açık" : "Kapalı"}</b>
                                        </Typography>
                                    )}
                                </Stack>
                            </FormControl>
                        ))}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose(false)}>Kapat</Button>
                <Button onClick={save} variant="contained" disabled={saving}>
                    {saving ? "Kaydediliyor…" : "Kaydet"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
