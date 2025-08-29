// src/theme.js
import { createTheme } from "@mui/material/styles";

export const getDesignTokens = () => ({
    palette: {
        mode: "dark",
        primary: { main: "#3B82F6" },
        secondary: { main: "#64748B" },
        background: {
            default: "#0B1220", // sayfa kökü
            paper: "#111827",   // kart/kağıt
        },
        text: {
            primary: "#E5E7EB",
            secondary: "#9CA3AF",
        },
        divider: "rgba(255,255,255,0.12)",
    },
    shape: { borderRadius: 12 },
    typography: {
        fontFamily: `"Inter","Segoe UI","Roboto","Helvetica","Arial",sans-serif`,
        h6: { fontWeight: 700 },
        body2: { letterSpacing: 0.2 },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: { backgroundColor: "#0B1220" },
                "*::-webkit-scrollbar": { width: 10, height: 10 },
                "*::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.18)", borderRadius: 8 },
                "*::-webkit-scrollbar-track": { background: "transparent" },
            },
        },

        MuiPaper: {
            styleOverrides: {
                root: { backgroundImage: "none", backgroundColor: "#111827" },
            },
        },

        MuiCard: {
            styleOverrides: { root: { backgroundColor: "#111827" } },
        },

        // ----- TABLE -----
        MuiTableHead: {
            styleOverrides: {
                root: {
                    "& th": {
                        fontWeight: 700,
                        color: "#9CA3AF",
                        backgroundColor: "#0F172A",
                        borderBottomColor: "rgba(255,255,255,0.12)",
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    backgroundColor: "transparent",           // <- beyaz kalma sorununu çözer
                    color: "#E5E7EB",
                    borderColor: "rgba(255,255,255,0.12)",
                },
                head: {
                    backgroundColor: "#0F172A",
                    color: "#9CA3AF",
                    fontWeight: 700,
                },
                stickyHeader: {
                    backgroundColor: "#0F172A",
                },
            },
        },

        // (MUI X) DataGrid kullanıyorsan:
        MuiDataGrid: {
            styleOverrides: {
                root: {
                    backgroundColor: "#111827",
                    color: "#E5E7EB",
                    borderColor: "rgba(255,255,255,0.12)",
                },
                columnHeaders: {
                    backgroundColor: "#0F172A",
                    color: "#9CA3AF",
                    borderBottomColor: "rgba(255,255,255,0.12)",
                },
                row: {
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" },
                },
                cell: {
                    borderBottomColor: "rgba(255,255,255,0.08)",
                },
            },
        },

        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: { textTransform: "none", borderRadius: 12, fontWeight: 600 },
            },
        },

        MuiChip: {
            styleOverrides: {
                root: { borderRadius: 10, fontWeight: 600, letterSpacing: 0.3 },
            },
        },

        MuiTabs: {
            styleOverrides: {
                root: { minHeight: 44 },
                indicator: { height: 3, borderRadius: 2, backgroundColor: "#3B82F6" },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: { textTransform: "none", minHeight: 44, fontWeight: 600 },
            },
        },

        MuiAppBar: {
            styleOverrides: {
                colorPrimary: { backgroundColor: "#0F172A" },
            },
        },

        MuiDrawer: {
            styleOverrides: {
                paper: { backgroundColor: "#0F172A" },
            },
        },

        MuiOutlinedInput: {
            styleOverrides: {
                notchedOutline: { borderColor: "rgba(255,255,255,0.18)" },
                root: {
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(255,255,255,0.28)",
                    },
                },
            },
        },

        MuiSelect: {
            styleOverrides: { icon: { color: "#E5E7EB" } },
        },
    },
});

export const buildTheme = () => createTheme(getDesignTokens());
const theme = buildTheme();
export default theme;
