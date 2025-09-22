// MUI v5
import { alpha } from "@mui/material/styles";

export const makeGlam = (theme, COLORS = {}) => {
    const divider = theme.palette.divider;
    const paper = theme.palette.background.paper;

    return {
        // Dialog kağıdı
        paper: {
            backgroundColor: paper,
            border: `1px solid ${divider}`,
            borderRadius: 12,
            boxShadow: theme.shadows[3],
        },

        // Header (sticky)
        headerBar: {
            px: { xs: 1.25, sm: 2 },
            py: { xs: 1, sm: 1.25 },
            borderBottom: `1px solid ${divider}`,
            backgroundColor: paper,
        },
        title: { fontWeight: 800, letterSpacing: 0.2, fontSize: 18 },
        subtitle: { ml: "auto", opacity: 0.8, fontSize: 12.5 },

        // Meta chip'ler
        chip: {
            borderRadius: 8,
            border: `1px solid ${divider}`,
            height: 28,
            backgroundColor: alpha(theme.palette.action.hover, 0.25),
            "& .MuiChip-label": { fontWeight: 700, fontSize: 11.5 },
        },

        // Bilgi kartları — sol renk şeritli, modern
        cardAccent: {
            p: { xs: 1, sm: 1.1 },
            borderRadius: 10,
            border: `1px solid ${divider}`,
            backgroundColor: COLORS.surface2 ?? paper,
            position: "relative",
            overflow: "hidden",
            "&::before": {
                content: '""',
                position: "absolute",
                left: 0, top: 0, bottom: 0, width: 4,
                background: theme.palette.mode === "dark"
                    ? alpha(theme.palette.primary.main, 0.7)
                    : theme.palette.primary.main,
            },
        },

        // Nötr bölüm kutuları
        section: {
            p: { xs: 1, sm: 1.25 },
            borderRadius: 10,
            border: `1px solid ${divider}`,
            backgroundColor: COLORS.surface ?? paper,
        },

        /* ----------------- PİLL KALDIRMA (esas nokta) ----------------- */

        // Form alanlarının DIŞ sarmalayıcısı: hiçbir border/radius yok => dıştaki elips biter
        noPillContainer: {
            border: "none !important",
            borderRadius: "0 !important",
            background: "transparent !important",
            boxShadow: "none !important",
        },

        // İçerideki tüm MUI input varyantlarını düzleştir (yüksek özgülük)
        killPillScope: {
            "&& .MuiFormControl-root": {
                borderRadius: "8px !important",
                background: "transparent !important",
            },
            "&& .MuiInputBase-root": {
                borderRadius: "8px !important",
                background: "transparent !important",
                boxShadow: "none !important",
            },
            "&& .MuiOutlinedInput-root": {
                borderRadius: "8px !important",
                background: "transparent !important",
                boxShadow: "none !important",
            },
            "&& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
                borderRadius: "8px !important",
                borderColor: alpha(divider, 0.9),
            },
            "&& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: theme.palette.primary.main,
            },
            "&& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: alpha(divider, 1),
            },
            "&& .MuiInput-underline:before, && .MuiInput-underline:after": {
                borderBottom: "0 !important",
            },
            "&& .MuiInputLabel-root": { color: theme.palette.text.secondary },
            "&& .MuiInputBase-input": { color: theme.palette.text.primary },
        },

        // Form spacing (ayrı ayrı kutular, aralarında boşluk)
        formStack: {
            display: "grid",
            rowGap: 12,
        },

        // Dense input ölçüleri
        input: {
            "& .MuiOutlinedInput-root": { height: 40 },
            "& .MuiInputLabel-root": { fontSize: 12.5, letterSpacing: 0.2 },
        },

        // Tipografi
        overline: {
            fontSize: 11,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
            fontWeight: 700,
            mb: 0.25,
        },
        value: { fontSize: 14, fontWeight: 800, lineHeight: 1.35 },

        // ETA panel
        etaPanel: {
            p: { xs: 0.75, sm: 1 },
            borderRadius: 10,
            border: `1px solid ${divider}`,
            backgroundColor:
                theme.palette.mode === "dark" ? "rgba(76,175,80,.08)" : "rgba(76,175,80,.06)",
        },

        // Uzun metinleri 2 satırda kes
        clamp2: {
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
        },
    };
};
