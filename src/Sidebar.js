// src/Sidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
import { alpha, styled, useTheme } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";

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
import PivotTableChartIcon from "@mui/icons-material/PivotTableChart";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SpeedIcon from "@mui/icons-material/Speed";
import FactoryIcon from "@mui/icons-material/Factory";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HomeIcon from "@mui/icons-material/Home";

// ─── Sabitler ────────────────────────────────────────────────
export const DRAWER_WIDTH_OPEN = 280;
export const DRAWER_WIDTH_CLOSED = 68;

const C1 = "#6dd5ed";   // Cyan
const C2 = "#2193b0";   // Teal
const C3 = "#1a2535";   // Koyu zemin

// ─── Styled: NavItem ─────────────────────────────────────────
const NavItem = styled(ListItemButton)(({ theme, active, sidebaropen }) => ({
    margin: "2px 10px",
    borderRadius: "10px",
    minHeight: 42,
    padding: sidebaropen ? "9px 14px" : "9px 0",
    justifyContent: sidebaropen ? "flex-start" : "center",
    color: alpha("#fff", 0.7),
    position: "relative",
    overflow: "hidden",
    transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",

    "&::before": {
        content: '""',
        position: "absolute",
        left: 0, top: "20%", bottom: "20%",
        width: "3px",
        borderRadius: "0 3px 3px 0",
        background: `linear-gradient(180deg, ${C1}, ${C2})`,
        opacity: 0,
        transition: "opacity 0.2s",
    },

    "&:hover": {
        background: alpha(C1, 0.1),
        color: C1,
        paddingLeft: sidebaropen ? "18px" : undefined,
        "&::before": { opacity: 0.6 },
        "& .MuiListItemIcon-root": { color: C1 },
    },

    ...(active && {
        background: `linear-gradient(135deg, ${alpha(C1, 0.18)}, ${alpha(C2, 0.1)})`,
        color: "#fff",
        fontWeight: 700,
        border: `1px solid ${alpha(C1, 0.35)}`,
        boxShadow: `0 2px 12px ${alpha(C1, 0.2)}, inset 0 1px 0 ${alpha(C1, 0.1)}`,
        "&::before": { opacity: 1 },
        "&:hover": {
            background: `linear-gradient(135deg, ${alpha(C1, 0.22)}, ${alpha(C2, 0.14)})`,
            paddingLeft: sidebaropen ? "14px" : undefined,
        },
        "& .MuiListItemIcon-root": { color: C1 },
    }),
}));

// ─── Styled: Category ────────────────────────────────────────
const CategoryBtn = styled(ListItemButton)(({ theme, sidebaropen }) => ({
    margin: "6px 10px 2px",
    borderRadius: "10px",
    minHeight: 44,
    padding: sidebaropen ? "10px 14px" : "10px 0",
    justifyContent: sidebaropen ? "flex-start" : "center",
    background: alpha("#fff", 0.04),
    border: `1px solid ${alpha(C1, 0.12)}`,
    color: alpha("#fff", 0.9),
    transition: "all 0.22s ease",

    "&:hover": {
        background: alpha(C1, 0.1),
        border: `1px solid ${alpha(C1, 0.35)}`,
        boxShadow: `0 4px 16px ${alpha(C1, 0.15)}`,
        color: "#fff",
        "& .MuiListItemIcon-root": { color: C1 },
    },
}));

// ─── Yardımcılar ─────────────────────────────────────────────
const isActivePath = (path, location) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

// ─── Bileşen: Tek NavItem ─────────────────────────────────────
function SidebarNavItem({ label, to, icon, onClick, badge, onRead, sidebaropen }) {
    const location = useLocation();
    const active = isActivePath(to, location);

    const handleClick = () => {
        onClick(to);
        if (badge > 0 && onRead) onRead();
    };

    const item = (
        <NavItem onClick={handleClick} active={active ? 1 : 0} sidebaropen={sidebaropen ? 1 : 0}>
            <ListItemIcon
                sx={{
                    minWidth: sidebaropen ? 36 : "100%",
                    justifyContent: "center",
                    color: active ? C1 : alpha("#fff", 0.55),
                    transition: "color 0.2s",
                    "& svg": { fontSize: 20 },
                }}
            >
                {badge > 0 ? (
                    <Badge
                        color="error"
                        badgeContent={badge}
                        max={99}
                        sx={{ "& .MuiBadge-badge": { fontSize: 10, minWidth: 16, height: 16 } }}
                    >
                        {icon}
                    </Badge>
                ) : icon}
            </ListItemIcon>

            {sidebaropen && (
                <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                        noWrap: true,
                        sx: {
                            fontSize: "13.5px",
                            fontWeight: active ? 600 : 400,
                            color: active ? "#fff" : alpha("#fff", 0.75),
                            letterSpacing: "0.01em",
                        },
                    }}
                />
            )}
        </NavItem>
    );

    return sidebaropen ? item : (
        <Tooltip title={label} placement="right" arrow
            componentsProps={{ tooltip: { sx: { bgcolor: C3, color: "#fff", fontSize: 12, border: `1px solid ${alpha(C1, 0.3)}` } } }}
        >
            {item}
        </Tooltip>
    );
}

// ─── Bileşen: Kategori Başlığı ────────────────────────────────
function SidebarCategory({ icon, label, openState, setOpenState, endAdornment, sidebaropen }) {
    const btn = (
        <CategoryBtn
            onClick={() => setOpenState(p => !p)}
            sidebaropen={sidebaropen ? 1 : 0}
        >
            <ListItemIcon sx={{
                minWidth: sidebaropen ? 36 : "100%",
                justifyContent: "center",
                color: C1,
                "& svg": { fontSize: 18 },
            }}>
                {icon}
            </ListItemIcon>

            {sidebaropen && (
                <>
                    <ListItemText
                        primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: alpha("#fff", 0.9) }}>
                                    {label}
                                </Typography>
                                {endAdornment}
                            </Box>
                        }
                    />
                    <ExpandMoreIcon sx={{
                        fontSize: 18,
                        color: alpha("#fff", 0.5),
                        transform: openState ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.25s ease",
                        flexShrink: 0,
                    }} />
                </>
            )}
        </CategoryBtn>
    );

    return sidebaropen ? btn : (
        <Tooltip title={label} placement="right" arrow
            componentsProps={{ tooltip: { sx: { bgcolor: C3, color: "#fff", fontSize: 12, border: `1px solid ${alpha(C1, 0.3)}` } } }}
        >
            {btn}
        </Tooltip>
    );
}

// ══════════════════════════════════════════════════════════════
// ANA BİLEŞEN
// ══════════════════════════════════════════════════════════════
export default function Sidebar(props) {
    const { open: controlledOpen, setOpen: setControlledOpen } = props || {};
    const [internalOpen, setInternalOpen] = useState(true);

    const isControlled = typeof controlledOpen === "boolean" && typeof setControlledOpen === "function";
    const open = isControlled ? controlledOpen : internalOpen;
    const toggle = () => isControlled ? setControlledOpen(p => !p) : setInternalOpen(p => !p);

    useEffect(() => {
        const w = open ? DRAWER_WIDTH_OPEN : DRAWER_WIDTH_CLOSED;
        document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
    }, [open]);

    const navigate = useNavigate();
    const location = useLocation();
    const go = (path) => navigate(path);

    // Kategori açık/kapalı durumları
    const [kullaniciMenuAcik, setKullaniciMenuAcik] = useState(false);
    const [raporMenuAcik, setRaporMenuAcik] = useState(false);
    const [aracMenuAcik, setAracMenuAcik] = useState(false);
    const [gorevMenuAcik, setGorevMenuAcik] = useState(false);
    const [afyonMenuAcik, setAfyonMenuAcik] = useState(false);
    const [hakedisMenuAcik, setHakedisMenuAcik] = useState(false);
    const [kayitMenuAcik, setKayitMenuAcik] = useState(false);

    const [okunmamisGorev, setOkunmamisGorev] = useState(3);
    const [gorevBildirim, setGorevBildirim] = useState(5);
    const [bildirimSayisi, setBildirimSayisi] = useState(1);

    const kullaniciRol = localStorage.getItem("rol") || "YÖNETİCİ";

    const [snack, setSnack] = useState({ open: false, msg: "", severity: "info" });
    const closeSnack = () => setSnack(s => ({ ...s, open: false }));

    // Aktif route'a göre kategori aç
    useEffect(() => {
        const p = location.pathname;
        const sw = (arr) => arr.some(x => p === x || p.startsWith(x + "/"));

        setKullaniciMenuAcik(sw(["/planlama", "/plaka-onerisi", "/seferler", "/tamamlanan-seferler"]));
        setAracMenuAcik(sw(["/arac/yonetim", "/arac/izin-girisi", "/arac/kesinti-girisi", "/arac/durumlari"]));
        setRaporMenuAcik(sw(["/raporlar"]));
        setHakedisMenuAcik(sw(["/hakedis"]));
        setAfyonMenuAcik(sw(["/afyon"]));
        setGorevMenuAcik(sw(["/gorevler"]));
        setKayitMenuAcik(sw(["/kayit-islemleri"]));
    }, [location.pathname]);

    // Menü tanımları
    const kullaniciAltMenuler = useMemo(() => [
        { ad: "Planlama", yol: "/planlama", ikon: <CalendarMonthIcon /> },
        { ad: "Plaka Önerisi", yol: "/plaka-onerisi", ikon: <AssignmentIcon /> },
        { ad: "Aktif Seferler", yol: "/seferler", ikon: <LocalShippingIcon /> },
        { ad: "Tamamlanan Seferler", yol: "/tamamlanan-seferler", ikon: <CheckCircleIcon /> },
    ], []);

    const aracAltMenuler = useMemo(() => [
        { ad: "Araç Durumları", yol: "/arac/durumlari", ikon: <DirectionsCarIcon /> },
        { ad: "Araç Yönetimi", yol: "/arac/yonetim", ikon: <DirectionsCarIcon /> },
        { ad: "İzin Girişi", yol: "/arac/izin-girisi", ikon: <CalendarMonthIcon /> },
        { ad: "Kesinti Girişi", yol: "/arac/kesinti-girisi", ikon: <ContentCutIcon /> },
    ], []);

    const raporAltMenuler = useMemo(() => [
        { ad: "Analiz Araçları", yol: "/raporlar/tools", ikon: <PivotTableChartIcon /> },
        { ad: "KPI Ölçümü", yol: "/raporlar/kpi-olcumu", ikon: <AssessmentIcon /> },
        { ad: "Lokasyon Raporları", yol: "/raporlar/lokasyon-rapor", ikon: <MapIcon /> },
        { ad: "ETA Uyumsuzluğu", yol: "/raporlar/eta-uyumsuz", ikon: <ScheduleIcon /> },
        { ad: "Yüklemede Bekleme", yol: "/raporlar/yuklemede-bekleme", ikon: <ScheduleIcon /> },
        { ad: "Teslimde Bekleme", yol: "/raporlar/teslimde-bekleme", ikon: <AvTimerIcon /> },
        { ad: "Boşta Araç", yol: "/raporlar/bosta-arac", ikon: <DirectionsCarIcon /> },
        { ad: "Sefer Süreleri", yol: "/raporlar/sefer-sureleri", ikon: <AirportShuttleIcon /> },
        { ad: "Plaka Bazlı", yol: "/raporlar/plaka-bazli", ikon: <AirportShuttleOutlinedIcon /> },
        { ad: "Araç ETAları", yol: "/raporlar/arac-etalari", ikon: <AccessTimeIcon /> },
        { ad: "Sefer Tamamlayan", yol: "/raporlar/sefer-tamamlayan", ikon: <TaskAltIcon /> },
        { ad: "Bölgesel Analiz", yol: "/raporlar/bolgesel-analiz", ikon: <QueryStatsIcon /> },
    ], []);

    const hakedisAltMenuler = useMemo(() => [
        { ad: "Hayat Kimya YHH", yol: "/hakedis/hayat-kimya-yhh", ikon: <FactoryIcon /> },
        { ad: "Pepsi YHH", yol: "/hakedis/pepsi-yakit-hakedis", ikon: <FactoryIcon /> },
        { ad: "Frigo YHH", yol: "/hakedis/frigo-yakit-hakedis", ikon: <LocalGasStationIcon /> },
        { ad: "Sefer Kira & Sürücü Hakediş", yol: "/hakedis/hakedis-seferleri", ikon: <ReceiptLongIcon /> },
        { ad: "Plaka | Kira & Sürücü Tutarları", yol: "/hakedis/arac-cari-ve-fiyat", ikon: <CreditCardIcon /> },
        { ad: "Filo %12 İskontolu Yakıt", yol: "/hakedis/FiloIskontoluHakedis", ikon: <PaidIcon /> },
        { ad: "Tedarikçi Masraf", yol: "/hakedis/tedarikci-masraf", ikon: <PaidIcon /> },
        { ad: "Hamaliye", yol: "/hakedis/hamaliye", ikon: <PaidIcon /> },
    ], []);

    const gorevAltMenuler = useMemo(() => [
        { ad: "Tüm Görevler", yol: "/gorevler/tum", ikon: <AssignmentIcon />, badge: gorevBildirim, onRead: () => setGorevBildirim(0) },
        { ad: "Görev Ata", yol: "/gorevler/ata", ikon: <AddTaskIcon />, sadeceRol: "YÖNETİCİ" },
        { ad: "Benim Görevlerim", yol: "/gorevler/benim", ikon: <PushPinIcon />, badge: okunmamisGorev, onRead: () => setOkunmamisGorev(0) },
    ], [gorevBildirim, okunmamisGorev]);

    const kayitAltMenuler = useMemo(() => [
        { ad: "KM Kayıt", yol: "/kayit-islemleri/km-kayit", ikon: <SpeedIcon /> },
    ], []);

    const drawerWidth = open ? DRAWER_WIDTH_OPEN : DRAWER_WIDTH_CLOSED;

    return (
        <>
            <Drawer
                variant="permanent"
                open={open}
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    transition: t => t.transitions.create("width", {
                        duration: t.transitions.duration.shorter,
                        easing: t.transitions.easing.sharp,
                    }),
                    "& .MuiDrawer-paper": {
                        width: drawerWidth,
                        boxSizing: "border-box",
                        overflowX: "hidden",
                        border: "none",
                        borderRight: `1px solid ${alpha(C1, 0.1)}`,
                        // Koyu, derin arka plan
                        background: `
                            linear-gradient(180deg,
                                #0b1120 0%,
                                #0d1627 40%,
                                #0b1120 100%
                            )
                        `,
                        backdropFilter: "blur(20px)",
                        boxShadow: `4px 0 30px rgba(0,0,0,0.6), inset -1px 0 0 ${alpha(C1, 0.08)}`,
                        transition: t => t.transitions.create("width", {
                            duration: t.transitions.duration.shorter,
                            easing: t.transitions.easing.sharp,
                        }),
                        display: "flex",
                        flexDirection: "column",
                    },
                }}
            >
                {/* ── Header ── */}
                <Box sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: open ? "space-between" : "center",
                    px: open ? 2 : 1,
                    minHeight: 60,
                    borderBottom: `1px solid ${alpha(C1, 0.1)}`,
                    flexShrink: 0,
                    position: "relative",
                    "&::after": {
                        content: '""',
                        position: "absolute",
                        bottom: 0, left: "10%", right: "10%",
                        height: "1px",
                        background: `linear-gradient(90deg, transparent, ${alpha(C1, 0.4)}, transparent)`,
                    },
                }}>
                    {open && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            {/* Logo Nokta */}
                            <Box sx={{
                                width: 28, height: 28,
                                borderRadius: "8px",
                                background: `linear-gradient(135deg, ${C1}, ${C2})`,
                                boxShadow: `0 0 12px ${alpha(C1, 0.5)}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                            }}>
                                <LocalShippingIcon sx={{ fontSize: 16, color: "#fff" }} />
                            </Box>
                            <Typography sx={{
                                fontWeight: 900,
                                fontSize: "17px",
                                letterSpacing: "0.06em",
                                background: `linear-gradient(90deg, ${C1} 0%, #fff 100%)`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}>
                                FTSWeb
                            </Typography>
                        </Box>
                    )}

                    {!open && (
                        <Box sx={{
                            width: 32, height: 32,
                            borderRadius: "9px",
                            background: `linear-gradient(135deg, ${C1}, ${C2})`,
                            boxShadow: `0 0 14px ${alpha(C1, 0.5)}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <LocalShippingIcon sx={{ fontSize: 18, color: "#fff" }} />
                        </Box>
                    )}

                    <Tooltip title={open ? "Daralt" : "Genişlet"} placement="right">
                        <IconButton
                            onClick={toggle}
                            size="small"
                            sx={{
                                color: alpha(C1, 0.8),
                                width: 32, height: 32,
                                border: `1px solid ${alpha(C1, 0.2)}`,
                                borderRadius: "8px",
                                "&:hover": {
                                    bgcolor: alpha(C1, 0.12),
                                    color: C1,
                                    borderColor: C1,
                                    boxShadow: `0 0 10px ${alpha(C1, 0.3)}`,
                                },
                                transition: "all 0.2s ease",
                            }}
                        >
                            {open ? <MenuOpenIcon sx={{ fontSize: 18 }} /> : <MenuIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* ── Ana Menü Linki ── */}
                <Box sx={{ px: 1, pt: 1.5, flexShrink: 0 }}>
                    <SidebarNavItem
                        label="Ana Sayfa"
                        to="/"
                        icon={<HomeIcon />}
                        onClick={go}
                        sidebaropen={open}
                    />
                </Box>

                <Divider sx={{ borderColor: alpha(C1, 0.08), mx: 1, my: 0.5 }} />

                {/* ── Navigasyon Listesi ── */}
                <List sx={{
                    pt: 0.5, pb: 2, overflowY: "auto", overflowX: "hidden", flexGrow: 1,
                    "&::-webkit-scrollbar": { width: "4px" },
                    "&::-webkit-scrollbar-track": { background: "transparent" },
                    "&::-webkit-scrollbar-thumb": { background: alpha(C1, 0.25), borderRadius: "4px" },
                    "&::-webkit-scrollbar-thumb:hover": { background: alpha(C1, 0.5) },
                }}>

                    {/* KULLANICI İŞLEMLERİ */}
                    <SidebarCategory icon={<PeopleAltIcon />} label="KULLANICI İŞLEMLERİ"
                        openState={kullaniciMenuAcik} setOpenState={setKullaniciMenuAcik} sidebaropen={open} />
                    <Collapse in={kullaniciMenuAcik} timeout="auto" unmountOnExit>
                        <Box sx={{ pl: open ? 1 : 0 }}>
                            {kullaniciAltMenuler.map(m => (
                                <SidebarNavItem key={m.yol} label={m.ad} to={m.yol} icon={m.ikon} onClick={go} sidebaropen={open} />
                            ))}
                        </Box>
                    </Collapse>

                    {/* ARAÇ YÖNETİM */}
                    <SidebarCategory icon={<DirectionsCarIcon />} label="ARAÇ YÖNETİM"
                        openState={aracMenuAcik} setOpenState={setAracMenuAcik} sidebaropen={open} />
                    <Collapse in={aracMenuAcik} timeout="auto" unmountOnExit>
                        <Box sx={{ pl: open ? 1 : 0 }}>
                            {aracAltMenuler.map(m => (
                                <SidebarNavItem key={m.yol} label={m.ad} to={m.yol} icon={m.ikon} onClick={go} sidebaropen={open} />
                            ))}
                        </Box>
                    </Collapse>

                    {/* RAPORLAR */}
                    <SidebarCategory icon={<AssessmentIcon />} label="RAPORLAR"
                        openState={raporMenuAcik} setOpenState={setRaporMenuAcik} sidebaropen={open} />
                    <Collapse in={raporMenuAcik} timeout="auto" unmountOnExit>
                        <Box sx={{ pl: open ? 1 : 0 }}>
                            {raporAltMenuler.map(m => (
                                <SidebarNavItem key={m.yol} label={m.ad} to={m.yol} icon={m.ikon} onClick={go} sidebaropen={open} />
                            ))}
                        </Box>
                    </Collapse>

                    {/* HAKEDİŞLER */}
                    <SidebarCategory
                        icon={<BusinessCenterIcon />} label="HAKEDİŞLER"
                        openState={hakedisMenuAcik} setOpenState={setHakedisMenuAcik} sidebaropen={open}
                        endAdornment={bildirimSayisi > 0 ? (
                            <Chip size="small" color="error" label={bildirimSayisi}
                                sx={{ height: 18, fontSize: 10, fontWeight: 700, "& .MuiChip-label": { px: 0.75 } }} />
                        ) : null}
                    />
                    <Collapse in={hakedisMenuAcik} timeout="auto" unmountOnExit>
                        <Box sx={{ pl: open ? 1 : 0 }}>
                            {hakedisAltMenuler.map(m => (
                                <SidebarNavItem key={m.yol} label={m.ad} to={m.yol} icon={m.ikon} onClick={go} sidebaropen={open} />
                            ))}
                        </Box>
                    </Collapse>

                    {/* KAYIT İŞLEMLERİ */}
                    <SidebarCategory icon={<AssignmentIcon />} label="KAYIT İŞLEMLERİ"
                        openState={kayitMenuAcik} setOpenState={setKayitMenuAcik} sidebaropen={open} />
                    <Collapse in={kayitMenuAcik} timeout="auto" unmountOnExit>
                        <Box sx={{ pl: open ? 1 : 0 }}>
                            {kayitAltMenuler.map(m => (
                                <SidebarNavItem key={m.yol} label={m.ad} to={m.yol} icon={m.ikon} onClick={go} sidebaropen={open} />
                            ))}
                        </Box>
                    </Collapse>

                    {/* AFYON */}
                    <SidebarCategory icon={<MapIcon />} label="AFYON"
                        openState={afyonMenuAcik} setOpenState={setAfyonMenuAcik} sidebaropen={open} />
                    <Collapse in={afyonMenuAcik} timeout="auto" unmountOnExit>
                        <Box sx={{ pl: open ? 1 : 0 }}>
                            {[
                                { ad: "Seferler", yol: "/afyon/seferler", ikon: <DirectionsBusFilledIcon /> },
                                { ad: "Araçlar", yol: "/afyon/araclar", ikon: <AirportShuttleIcon /> },
                            ].map(m => (
                                <SidebarNavItem key={m.yol} label={m.ad} to={m.yol} icon={m.ikon} onClick={go} sidebaropen={open} />
                            ))}
                        </Box>
                    </Collapse>

                    {/* GÖREVLER */}
                    <SidebarCategory
                        icon={<TaskAltIcon />} label="GÖREVLER"
                        openState={gorevMenuAcik} setOpenState={setGorevMenuAcik} sidebaropen={open}
                        endAdornment={okunmamisGorev > 0 ? (
                            <Chip size="small" color="error" label={okunmamisGorev}
                                sx={{ height: 18, fontSize: 10, fontWeight: 700, "& .MuiChip-label": { px: 0.75 } }} />
                        ) : null}
                    />
                    <Collapse in={gorevMenuAcik} timeout="auto" unmountOnExit>
                        <Box sx={{ pl: open ? 1 : 0 }}>
                            {gorevAltMenuler
                                .filter(m => !m.sadeceRol || m.sadeceRol === kullaniciRol)
                                .map(m => (
                                    <SidebarNavItem
                                        key={m.yol} label={m.ad} to={m.yol} icon={m.ikon}
                                        onClick={go} badge={m.badge} onRead={m.onRead} sidebaropen={open}
                                    />
                                ))}
                        </Box>
                    </Collapse>
                </List>

                {/* ── Footer ── */}
                <Box sx={{
                    p: open ? 2 : 1,
                    borderTop: `1px solid ${alpha(C1, 0.1)}`,
                    flexShrink: 0,
                    position: "relative",
                    "&::before": {
                        content: '""',
                        position: "absolute",
                        top: 0, left: "10%", right: "10%",
                        height: "1px",
                        background: `linear-gradient(90deg, transparent, ${alpha(C1, 0.35)}, transparent)`,
                    },
                }}>
                    {open ? (
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Typography variant="caption" sx={{ color: alpha("#fff", 0.3), fontSize: 11 }}>
                                v1.3.37
                            </Typography>
                            <Typography variant="caption" sx={{
                                color: alpha(C1, 0.6),
                                fontSize: 11,
                                fontWeight: 600,
                            }}>
                                FTS Solutions
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{
                            width: 8, height: 8,
                            borderRadius: "50%",
                            background: C1,
                            boxShadow: `0 0 8px ${C1}`,
                            mx: "auto",
                        }} />
                    )}
                </Box>
            </Drawer>

            {/* Snackbar */}
            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={closeSnack}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert onClose={closeSnack} severity={snack.severity} variant="filled"
                    sx={{ borderRadius: "10px", fontWeight: 600 }}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </>
    );
}
