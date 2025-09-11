// src/Sidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// MUI
import {
    Drawer,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Collapse,
    Box,
    Divider,
    IconButton,
    Tooltip,
    Badge,
    Typography,
    Snackbar,
    Alert,
    Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

// Icons
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AssessmentIcon from "@mui/icons-material/Assessment";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import PaidIcon from "@mui/icons-material/Paid";
import MapIcon from "@mui/icons-material/Map";
import ScheduleIcon from "@mui/icons-material/Schedule";
import AvTimerIcon from "@mui/icons-material/AvTimer";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import AirportShuttleIcon from "@mui/icons-material/AirportShuttle";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import AddTaskIcon from "@mui/icons-material/AddTask";
import PushPinIcon from "@mui/icons-material/PushPin";
import AssignmentIcon from "@mui/icons-material/Assignment";
import DirectionsBusFilledIcon from "@mui/icons-material/DirectionsBusFilled";
import AirportShuttleOutlinedIcon from "@mui/icons-material/AirportShuttleOutlined";

export const DRAWER_WIDTH_OPEN = 260;
export const DRAWER_WIDTH_CLOSED = 72;

export default function Sidebar(props) {
    const { open: controlledOpen, setOpen: setControlledOpen } = props || {};
    const [internalOpen, setInternalOpen] = useState(true);
    const isControlled =
        typeof controlledOpen === "boolean" && typeof setControlledOpen === "function";
    const open = isControlled ? controlledOpen : internalOpen;
    const toggle = () => {
        if (isControlled) setControlledOpen((p) => !p);
        else setInternalOpen((p) => !p);
    };

    useEffect(() => {
        const w = open ? DRAWER_WIDTH_OPEN : DRAWER_WIDTH_CLOSED;
        document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
    }, [open]);

    const navigate = useNavigate();
    const location = useLocation();

    // Kategori states
    const [kullaniciMenuAcik, setKullaniciMenuAcik] = useState(false);
    const [raporMenuAcik, setRaporMenuAcik] = useState(false);
    const [aracMenuAcik, setAracMenuAcik] = useState(false);
    const [gorevMenuAcik, setGorevMenuAcik] = useState(false);
    const [afyonMenuAcik, setAfyonMenuAcik] = useState(false);
    const [hakedisMenuAcik, setHakedisMenuAcik] = useState(false);

    // Counters / user (şimdilik placeholder)
    const [okunmamisGorevSayisi, setOkunmamisGorevSayisi] = useState(0);
    const [bildirimSayisi, setBildirimSayisi] = useState(0);
    const [gorevBildirimSayisi, setGorevBildirimSayisi] = useState(0);
    const [kullaniciIdState, setKullaniciIdState] = useState(null);
    const kullaniciRol = localStorage.getItem("rol") || "";

    // Popup
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "info" });
    const showPopup = (msg, severity = "info") =>
        setSnack({ open: true, msg, severity });

    useEffect(() => {
        const id = parseInt(localStorage.getItem("kullaniciId"), 10);
        if (id) setKullaniciIdState(id);
    }, []);

    // Aktif route’a göre ilgili kategoriyi otomatik aç
    useEffect(() => {
        const p = location.pathname || "";
        const anyStartsWith = (arr) => arr.some((x) => p === x || p.startsWith(x + "/"));

        setKullaniciMenuAcik(
            anyStartsWith([
                "/planlama",
                "/plaka-onerisi",
                "/seferler",
                "/tamamlanan-seferler",
            ])
        );
        setAracMenuAcik(
            anyStartsWith(["/arac/yonetim", "/arac/izin-girisi", "/arac/kesinti-girisi"])
        );
        setRaporMenuAcik(
            anyStartsWith([
                "/raporlar/kpi-olcumu",
                "/raporlar/lokasyon-rapor", // 🔗 Proje & Lokasyon Bazlı Raporlar
                "/raporlar/yuklemede-bekleme",
                "/raporlar/teslimde-bekleme",
                "/raporlar/yuklemede-gecikme",
                "/raporlar/teslimde-gecikme",
                "/raporlar/sefer-sureleri",
                "/raporlar/plaka-bazli",
            ])
        );
        setHakedisMenuAcik(
            anyStartsWith([
                "/hakedis/tedarikci-masraf",
                "/hakedis/arac-cari-ve-fiyat",
                "/hakedis/hakedis-seferleri",
            ])
        );
        setAfyonMenuAcik(anyStartsWith(["/afyon/seferler", "/afyon/araclar"]));
        setGorevMenuAcik(
            anyStartsWith(["/gorevler/tum", "/gorevler/ata", "/gorevler/benim"])
        );
    }, [location.pathname]);

    // Menü tanımları
    const kullaniciAltMenuler = useMemo(
        () => [
            { ad: "Planlama", yol: "/planlama", ikon: <CalendarMonthIcon /> },
            { ad: "Plaka Önerisi", yol: "/plaka-onerisi", ikon: <AssignmentIcon /> },
            { ad: "Aktif Seferler", yol: "/seferler", ikon: <LocalShippingIcon /> },
            { ad: "Tamamlanan Seferler", yol: "/tamamlanan-seferler", ikon: <CheckCircleIcon /> },
        ],
        []
    );

    const aracAltMenuler = useMemo(
        () => [
            { ad: "Araç Yönetimi", yol: "/arac/yonetim", ikon: <DirectionsCarIcon /> },
            { ad: "İzin Girişi", yol: "/arac/izin-girisi", ikon: <CalendarMonthIcon /> },
            { ad: "Kesinti Girişi", yol: "/arac/kesinti-girisi", ikon: <ContentCutIcon /> },
        ],
        []
    );

    const raporAltMenuler = useMemo(
        () => [
            { ad: "KPI Ölçümü", yol: "/raporlar/kpi-olcumu", ikon: <AssessmentIcon /> },
            {
                ad: "Proje & Lokasyon Bazlı Raporlar",
                yol: "/raporlar/lokasyon-rapor", // 🔗 App.jsx’te ProjeLokasyonRaporlari ile eşleyin
                ikon: <MapIcon />,
            },
            { ad: "Yüklemede Bekleme", yol: "/raporlar/yuklemede-bekleme", ikon: <ScheduleIcon /> },
            { ad: "Teslimde Bekleme", yol: "/raporlar/teslimde-bekleme", ikon: <AvTimerIcon /> },
            { ad: "Yüklemede Gecikme", yol: "/raporlar/yuklemede-gecikme", ikon: <QueryStatsIcon /> },
            { ad: "Teslimde Gecikme", yol: "/raporlar/teslimde-gecikme", ikon: <QueryStatsIcon /> },
            { ad: "Sefer Süreleri", yol: "/raporlar/sefer-sureleri", ikon: <AirportShuttleIcon /> },
            { ad: "Plaka Bazlı Raporlar", yol: "/raporlar/plaka-bazli", ikon: <AirportShuttleOutlinedIcon /> },
        ],
        []
    );

    const hakedisAltMenuler = useMemo(
        () => [
            { ad: "Tedarikçi Masraf", yol: "/hakedis/tedarikci-masraf", ikon: <PaidIcon /> },
            { ad: "Araç Cari & Fiyat", yol: "/hakedis/arac-cari-ve-fiyat", ikon: <CreditCardIcon /> },
            { ad: "Hakediş Seferleri", yol: "/hakedis/hakedis-seferleri", ikon: <ReceiptLongIcon /> },
        ],
        []
    );

    const gorevAltMenuler = useMemo(
        () => [
            { ad: "Tüm Görevler", yol: "/gorevler/tum", ikon: <AssignmentIcon /> },
            { ad: "Görev Ata", yol: "/gorevler/ata", ikon: <AddTaskIcon />, sadeceRol: "YÖNETİCİ" },
            { ad: "Benim Görevlerim", yol: "/gorevler/benim", ikon: <PushPinIcon /> },
        ],
        []
    );

    // aktiflik kontrolü (alt route’ları da yakalar)
    const isActivePath = (path) =>
        location.pathname === path || location.pathname.startsWith(path + "/");

    const NavItem = ({ label, to, icon, active, onClick, badge }) => (
        <ListItemButton
            onClick={onClick}
            selected={active}
            sx={{
                mx: 1,
                my: 0.5,
                borderRadius: 2,
                px: open ? 2 : 1.25,
                minHeight: 42,
                "&.Mui-selected": {
                    bgcolor: alpha("#8B5CF6", 0.18),
                    color: "#fff",
                    ":hover": { bgcolor: alpha("#8B5CF6", 0.24) },
                },
                ":hover": { bgcolor: alpha("#ffffff", 0.06) },
            }}
        >
            <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
                {badge ? (
                    <Badge color="error" badgeContent={badge} max={99}>
                        {icon}
                    </Badge>
                ) : (
                    icon
                )}
            </ListItemIcon>
            {open && <ListItemText primary={label} />}
        </ListItemButton>
    );

    const Category = ({ icon, label, openState, setOpenState, endAdornment }) => (
        <ListItemButton
            onClick={() => setOpenState((p) => !p)}
            sx={{
                mx: 1,
                mt: 1,
                borderRadius: 2,
                px: open ? 2 : 1.25,
                minHeight: 44,
                bgcolor: alpha("#8B5CF6", 0.15),
                ":hover": { bgcolor: alpha("#8B5CF6", 0.25) },
                color: "#E0E0E0",
                fontWeight: 600,
            }}
        >
            <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>{icon}</ListItemIcon>
            {open && (
                <>
                    <ListItemText
                        primary={
                            <Box display="flex" alignItems="center" gap={1}>
                                <span>{label}</span>
                                {endAdornment}
                            </Box>
                        }
                    />
                    <Typography sx={{ opacity: 0.7 }}>{openState ? "▾" : "▸"}</Typography>
                </>
            )}
        </ListItemButton>
    );

    const go = (path) => navigate(path);

    return (
        <>
            <Drawer
                variant="permanent"
                open={open}
                sx={{
                    width: open ? DRAWER_WIDTH_OPEN : DRAWER_WIDTH_CLOSED,
                    flexShrink: 0,
                    transition: (theme) =>
                        theme.transitions.create("width", {
                            duration: theme.transitions.duration.shorter,
                            easing: theme.transitions.easing.sharp,
                        }),
                    "& .MuiDrawer-paper": {
                        width: open ? DRAWER_WIDTH_OPEN : DRAWER_WIDTH_CLOSED,
                        boxSizing: "border-box",
                        borderRight: "1px solid rgba(255,255,255,0.08)",
                        background:
                            "linear-gradient(180deg, rgba(5,8,22,0.96) 0%, rgba(11,18,32,0.92) 100%)",
                        backdropFilter: "blur(8px)",
                        transition: (theme) =>
                            theme.transitions.create("width", {
                                duration: theme.transitions.duration.shorter,
                                easing: theme.transitions.easing.sharp,
                            }),
                    },
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        justifyContent: open ? "space-between" : "center",
                        px: 1,
                        py: 1,
                        minHeight: 56,
                    }}
                >
                    {open ? (
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 800,
                                letterSpacing: 0.5,
                                background: "linear-gradient(90deg,#E879F9,#22D3EE)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                ml: 1,
                            }}
                        >
                            FTSWeb
                        </Typography>
                    ) : (
                        <Box
                            sx={{
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                background: "linear-gradient(90deg,#E879F9,#22D3EE)",
                            }}
                        />
                    )}

                    <Tooltip title={open ? "Daralt" : "Genişlet"}>
                        <IconButton onClick={toggle} size="small" sx={{ color: "text.primary" }}>
                            {open ? <MenuOpenIcon /> : <MenuIcon />}
                        </IconButton>
                    </Tooltip>
                </Box>

                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

                <List disablePadding>
                    {/* Kullanıcı İşlemleri */}
                    <Category
                        icon={<PeopleAltIcon />}
                        label="KULLANICI İŞLEMLERİ"
                        openState={kullaniciMenuAcik}
                        setOpenState={setKullaniciMenuAcik}
                    />
                    <Collapse in={kullaniciMenuAcik} timeout="auto" unmountOnExit>
                        {kullaniciAltMenuler.map((m) => (
                            <NavItem
                                key={m.yol}
                                label={m.ad}
                                icon={m.ikon}
                                active={isActivePath(m.yol)}
                                onClick={() => go(m.yol)}
                            />
                        ))}
                    </Collapse>

                    {/* Araç Durumları */}
                    <Category
                        icon={<DirectionsCarIcon />}
                        label="ARAÇ DURUMLARI"
                        openState={aracMenuAcik}
                        setOpenState={setAracMenuAcik}
                    />
                    <Collapse in={aracMenuAcik} timeout="auto" unmountOnExit>
                        {aracAltMenuler.map((m) => (
                            <NavItem
                                key={m.yol}
                                label={m.ad}
                                icon={m.ikon}
                                active={isActivePath(m.yol)}
                                onClick={() => go(m.yol)}
                            />
                        ))}
                    </Collapse>

                    {/* Raporlar */}
                    <Category
                        icon={<AssessmentIcon />}
                        label="RAPORLAR"
                        openState={raporMenuAcik}
                        setOpenState={setRaporMenuAcik}
                    />
                    <Collapse in={raporMenuAcik} timeout="auto" unmountOnExit>
                        {raporAltMenuler.map((m) => (
                            <NavItem
                                key={m.yol}
                                label={m.ad}
                                icon={m.ikon}
                                active={isActivePath(m.yol)}
                                onClick={() => go(m.yol)}
                                badge={m.ad === "Tüm Görevler" ? gorevBildirimSayisi : 0}
                            />
                        ))}
                    </Collapse>

                    {/* Hakedişler */}
                    <Category
                        icon={<BusinessCenterIcon />}
                        label="HAKEDİŞLER"
                        openState={hakedisMenuAcik}
                        setOpenState={setHakedisMenuAcik}
                        endAdornment={
                            bildirimSayisi > 0 ? (
                                <Chip
                                    size="small"
                                    color="error"
                                    label={bildirimSayisi}
                                    sx={{ height: 20, fontWeight: 700 }}
                                />
                            ) : null
                        }
                    />
                    <Collapse in={hakedisMenuAcik} timeout="auto" unmountOnExit>
                        {hakedisAltMenuler.map((m) => (
                            <NavItem
                                key={m.yol}
                                label={m.ad}
                                icon={m.ikon}
                                active={isActivePath(m.yol)}
                                onClick={() => go(m.yol)}
                            />
                        ))}
                    </Collapse>

                    {/* AFYON */}
                    <Category
                        icon={<MapIcon />}
                        label="AFYON"
                        openState={afyonMenuAcik}
                        setOpenState={setAfyonMenuAcik}
                    />
                    <Collapse in={afyonMenuAcik} timeout="auto" unmountOnExit>
                        {[
                            { ad: "Seferler", yol: "/afyon/seferler", ikon: <DirectionsBusFilledIcon /> },
                            { ad: "Araçlar", yol: "/afyon/araclar", ikon: <AirportShuttleIcon /> },
                        ].map((m) => (
                            <NavItem
                                key={m.yol}
                                label={m.ad}
                                icon={m.ikon}
                                active={isActivePath(m.yol)}
                                onClick={() => go(m.yol)}
                            />
                        ))}
                    </Collapse>

                    {/* Görevler */}
                    <Category
                        icon={<TaskAltIcon />}
                        label="GÖREVLER"
                        openState={gorevMenuAcik}
                        setOpenState={setGorevMenuAcik}
                        endAdornment={
                            okunmamisGorevSayisi > 0 ? (
                                <Chip
                                    size="small"
                                    color="error"
                                    label={okunmamisGorevSayisi}
                                    sx={{ height: 20, fontWeight: 700 }}
                                />
                            ) : null
                        }
                    />
                    <Collapse in={gorevMenuAcik} timeout="auto" unmountOnExit>
                        {gorevAltMenuler
                            .filter((m) => !m.sadeceRol || m.sadeceRol === kullaniciRol)
                            .map((m) => (
                                <NavItem
                                    key={m.yol}
                                    label={m.ad}
                                    icon={m.ikon}
                                    active={isActivePath(m.yol)}
                                    badge={m.ad === "Tüm Görevler" ? gorevBildirimSayisi : 0}
                                    onClick={() => go(m.yol)}
                                />
                            ))}
                    </Collapse>
                </List>
            </Drawer>

            {/* Snackbar Popup */}
            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
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
