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
import { alpha, styled, useTheme } from "@mui/material/styles";

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
import ScheduleIcon from "@mui/icons-material/Schedule"; // ETA Uyumsuzluğu
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
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation"; // ✅ Frigo Yakıt Hakediş

export const DRAWER_WIDTH_OPEN = 280;
export const DRAWER_WIDTH_CLOSED = 72;

// --- STİL SABİTLERİ ---
const NEON_COLOR_1 = "#20B2AA";
const NEON_COLOR_2 = "#8A2BE2";
const HOVER_BG_ALPHA = 0.1;

const StyledNavItem = styled(ListItemButton)(({ theme, active, open }) => ({
    margin: theme.spacing(0.75, 1.2),
    borderRadius: "12px",
    minHeight: 48,
    padding: open ? theme.spacing(1.2, 2.5) : theme.spacing(1.25),
    color: theme.palette.text.primary,
    "&:hover": {
        backgroundColor: alpha(NEON_COLOR_1, HOVER_BG_ALPHA),
        transform: open ? "translateX(5px) scale(1.02)" : "scale(1.1)",
        boxShadow: `0 4px 15px ${alpha(theme.palette.common.black, 0.4)}`,
        transition: "all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
        color: NEON_COLOR_1,
    },
    ...(active && {
        background: `linear-gradient(90deg, ${alpha(
            NEON_COLOR_2,
            0.3
        )}, ${alpha(NEON_COLOR_1, 0.15)})`,
        color: theme.palette.common.white,
        fontWeight: 700,
        boxShadow: `0 0 15px ${alpha(NEON_COLOR_2, 0.6)}, inset 0 0 8px ${alpha(
            NEON_COLOR_1,
            0.3
        )}`,
        transform: "translateY(-1px)",
        border: `1px solid ${alpha(NEON_COLOR_1, 0.5)}`,
        "&:hover": {
            backgroundColor: "transparent",
            boxShadow: `0 0 20px ${alpha(
                NEON_COLOR_2,
                0.8
            )}, inset 0 0 10px ${alpha(NEON_COLOR_1, 0.5)}`,
            transform: "translateY(-2px)",
        },
    }),
}));

const StyledCategory = styled(ListItemButton)(({ theme, open }) => ({
    margin: theme.spacing(1.5, 1),
    borderRadius: "8px",
    minHeight: 52,
    padding: open ? theme.spacing(1.2, 2.5) : theme.spacing(1.25),
    backgroundColor: alpha(NEON_COLOR_2, 0.1),
    color: theme.palette.text.primary,
    fontWeight: 600,
    transition: theme.transitions.create(
        ["background-color", "transform", "box-shadow"],
        {
            duration: theme.transitions.duration.short,
        }
    ),
    border: `1px solid ${alpha(NEON_COLOR_2, 0.2)}`,
    "&:hover": {
        backgroundColor: alpha(NEON_COLOR_2, 0.2),
        transform: "translateY(-3px)",
        boxShadow: `0 6px 15px ${alpha(NEON_COLOR_2, 0.5)}`,
    },
}));

export default function Sidebar(props) {
    const theme = useTheme();
    theme.palette.text.primary = theme.palette.text.primary || "#E0E0E0";
    theme.palette.common.white = theme.palette.common.white || "#FFFFFF";

    const { open: controlledOpen, setOpen: setControlledOpen } = props || {};
    const [internalOpen, setInternalOpen] = useState(true);

    const isControlled =
        typeof controlledOpen === "boolean" &&
        typeof setControlledOpen === "function";
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

    // Bildirim sayacı örnekleri
    const [okunmamisGorevSayisi, setOkunmamisGorevSayisi] = useState(3);
    const [gorevBildirimSayisi, setGorevBildirimSayisi] = useState(5);
    const [bildirimSayisi, setBildirimSayisi] = useState(1);

    const readMyTasks = () => setOkunmamisGorevSayisi(0);
    const readAllTasks = () => setGorevBildirimSayisi(0);
    const readHakedis = () => setBildirimSayisi(0);

    const kullaniciRol = localStorage.getItem("rol") || "YÖNETİCİ";

    // Popup
    const [snack, setSnack] = useState({
        open: false,
        msg: "",
        severity: "info",
    });
    const handleCloseSnack = () =>
        setSnack((s) => ({ ...s, open: false }));
    const showPopup = (msg, severity = "info") =>
        setSnack({ open: true, msg, severity });

    // Aktif route’a göre ilgili kategoriyi otomatik aç
    useEffect(() => {
        const p = location.pathname || "";
        const anyStartsWith = (arr) =>
            arr.some((x) => p === x || p.startsWith(x + "/"));

        setKullaniciMenuAcik(
            anyStartsWith([
                "/planlama",
                "/plaka-onerisi",
                "/seferler",
                "/tamamlanan-seferler",
            ])
        );
        setAracMenuAcik(
            anyStartsWith([
                "/arac/yonetim",
                "/arac/izin-girisi",
                "/arac/kesinti-girisi",
                "/arac/durumlari",
            ])
        );

        // RAPORLAR (Yüklemede Gecikme path'i kaldırıldı)
        setRaporMenuAcik(
            anyStartsWith([
                "/raporlar/kpi-olcumu",
                "/raporlar/lokasyon-rapor",
                "/raporlar/yuklemede-bekleme",
                "/raporlar/teslimde-bekleme",
                // "/raporlar/yuklemede-gecikme", <-- KALDIRILDI
                "/raporlar/sefer-sureleri",
                "/raporlar/plaka-bazli",
                "/raporlar/tools",
                "/raporlar/eta-uyumsuz",
                "/raporlar/sefer-tamamlayan",
            ])
        );

        // HAKEDİŞLER: Frigo burada ✅
        setHakedisMenuAcik(
            anyStartsWith([
                "/hakedis/tedarikci-masraf",
                "/hakedis/arac-cari-ve-fiyat",
                "/hakedis/hakedis-seferleri",
                "/hakedis/hamaliye",
                "/hakedis/frigo-yakit-hakedis", // ✅ yeni yol
            ])
        );

        setAfyonMenuAcik(anyStartsWith(["/afyon/seferler", "/afyon/araclar"]));
        setGorevMenuAcik(anyStartsWith(["/gorevler/tum", "/gorevler/ata", "/gorevler/benim"]));
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
            { ad: "Araç Durumları", yol: "/arac/durumlari", ikon: <DirectionsCarIcon /> },
            { ad: "Araç Yönetimi", yol: "/arac/yonetim", ikon: <DirectionsCarIcon /> },
            { ad: "İzin Girişi", yol: "/arac/izin-girisi", ikon: <CalendarMonthIcon /> },
            { ad: "Kesinti Girişi", yol: "/arac/kesinti-girisi", ikon: <ContentCutIcon /> },
        ],
        []
    );

    const raporAltMenuler = useMemo(
        () => [
            { ad: "Analiz Araçları", yol: "/raporlar/tools", ikon: <PivotTableChartIcon /> },
            { ad: "KPI Ölçümü", yol: "/raporlar/kpi-olcumu", ikon: <AssessmentIcon /> },
            { ad: "Lokasyon Raporları", yol: "/raporlar/lokasyon-rapor", ikon: <MapIcon /> },
            { ad: "ETA Uyumsuzluğu", yol: "/raporlar/eta-uyumsuz", ikon: <ScheduleIcon /> },
            { ad: "Yüklemede Bekleme", yol: "/raporlar/yuklemede-bekleme", ikon: <ScheduleIcon /> },
            { ad: "Teslimde Bekleme", yol: "/raporlar/teslimde-bekleme", ikon: <AvTimerIcon /> },
            // { ad: "Yüklemede Gecikme", yol: "/raporlar/yuklemede-gecikme", ikon: <QueryStatsIcon /> }, <-- KALDIRILDI
            { ad: "Sefer Süreleri", yol: "/raporlar/sefer-sureleri", ikon: <AirportShuttleIcon /> },
            { ad: "Plaka Bazlı", yol: "/raporlar/plaka-bazli", ikon: <AirportShuttleOutlinedIcon /> },
            { ad: "Sefer Tamamlayan", yol: "/raporlar/sefer-tamamlayan", ikon: <TaskAltIcon /> },
        ],
        []
    );

    // ✅ Frigo Yakıt Hakediş HAKEDİŞLER altında
    const hakedisAltMenuler = useMemo(
        () => [
            { ad: "Frigo Yakıt Hakediş", yol: "/hakedis/frigo-yakit-hakedis", ikon: <LocalGasStationIcon /> }, // ✅ yeni
            { ad: "Tedarikçi Masraf", yol: "/hakedis/tedarikci-masraf", ikon: <PaidIcon /> },
            { ad: "Araç Cari & Fiyat", yol: "/hakedis/arac-cari-ve-fiyat", ikon: <CreditCardIcon /> },
            { ad: "Hakediş Seferleri", yol: "/hakedis/hakedis-seferleri", ikon: <ReceiptLongIcon /> },
            { ad: "Hamaliye", yol: "/hakedis/hamaliye", ikon: <PaidIcon /> },
        ],
        []
    );

    const gorevAltMenuler = useMemo(
        () => [
            { ad: "Tüm Görevler", yol: "/gorevler/tum", ikon: <AssignmentIcon />, badge: gorevBildirimSayisi, onRead: readAllTasks },
            { ad: "Görev Ata", yol: "/gorevler/ata", ikon: <AddTaskIcon />, sadeceRol: "YÖNETİCİ" },
            { ad: "Benim Görevlerim", yol: "/gorevler/benim", ikon: <PushPinIcon />, badge: okunmamisGorevSayisi, onRead: readMyTasks },
        ],
        [okunmamisGorevSayisi, gorevBildirimSayisi]
    );

    const isActivePath = (path) =>
        location.pathname === path || location.pathname.startsWith(path + "/");

    const NavItem = ({ label, to, icon, onClick, badge, onRead }) => {
        const active = isActivePath(to);
        const handleClick = () => {
            onClick(to);
            if (badge > 0 && onRead) onRead();
        };
        return (
            <Tooltip title={!open ? label : null} placement="right" arrow>
                <StyledNavItem onClick={handleClick} active={active ? 1 : 0} open={open ? 1 : 0}>
                    <ListItemIcon
                        sx={{
                            minWidth: 36,
                            color: active ? theme.palette.common.white : alpha(theme.palette.common.white, 0.6),
                            transition: "color 0.25s",
                        }}
                    >
                        {badge > 0 ? (
                            <Badge color="error" badgeContent={badge} max={99}>
                                {icon}
                            </Badge>
                        ) : (
                            icon
                        )}
                    </ListItemIcon>
                    {open && (
                        <ListItemText
                            primary={label}
                            primaryTypographyProps={{
                                noWrap: true,
                                sx: {
                                    fontWeight: active ? 700 : 500,
                                    color: active ? theme.palette.common.white : theme.palette.text.primary,
                                    fontSize: "15px",
                                },
                            }}
                        />
                    )}
                </StyledNavItem>
            </Tooltip>
        );
    };

    const Category = ({ icon, label, openState, setOpenState, endAdornment }) => (
        <Tooltip title={!open ? label : null} placement="right" arrow>
            <StyledCategory
                onClick={() => {
                    setOpenState((p) => !p);
                    if (!openState && label === "HAKEDİŞLER" && bildirimSayisi > 0) {
                        readHakedis();
                    }
                }}
                open={open ? 1 : 0}
            >
                <ListItemIcon sx={{ minWidth: 36, color: NEON_COLOR_1 }}>{icon}</ListItemIcon>
                {open && (
                    <>
                        <ListItemText
                            primary={
                                <Box display="flex" alignItems="center" gap={1}>
                                    <span
                                        style={{
                                            fontSize: "14px",
                                            textTransform: "uppercase",
                                            fontWeight: 700,
                                            color: theme.palette.text.primary,
                                        }}
                                    >
                                        {label}
                                    </span>
                                    {endAdornment}
                                </Box>
                            }
                        />
                        <Typography
                            sx={{
                                transform: openState ? "rotate(90deg)" : "rotate(0deg)",
                                transition: "transform 0.25s",
                                fontSize: "20px",
                                fontWeight: 300,
                                color: alpha(theme.palette.common.white, 0.7),
                            }}
                        >
                            ›
                        </Typography>
                    </>
                )}
            </StyledCategory>
        </Tooltip>
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
                            "linear-gradient(180deg, rgba(15, 20, 26, 0.98) 0%, rgba(25, 30, 40, 0.95) 100%)",
                        backdropFilter: "blur(16px)",
                        boxShadow: `8px 0 30px ${alpha(theme.palette.common.black, 0.8)}`,
                        transition: (theme) =>
                            theme.transitions.create("width", {
                                duration: theme.transitions.duration.shorter,
                                easing: theme.transitions.easing.sharp,
                            }),
                        color: theme.palette.common.white,
                    },
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: open ? "space-between" : "center",
                        px: 1,
                        py: 1,
                        minHeight: 60,
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                    }}
                >
                    {open ? (
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 900,
                                letterSpacing: 1.5,
                                background: `linear-gradient(90deg, ${NEON_COLOR_2}, ${NEON_COLOR_1})`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                ml: 1,
                                textShadow: `0 0 5px ${alpha(NEON_COLOR_1, 0.5)}`,
                            }}
                        >
                            FTSWeb
                        </Typography>
                    ) : (
                        <Box
                            sx={{
                                width: 14,
                                height: 14,
                                borderRadius: "50%",
                                background: `linear-gradient(90deg, ${NEON_COLOR_2}, ${NEON_COLOR_1})`,
                                boxShadow: `0 0 8px ${alpha(NEON_COLOR_1, 0.8)}`,
                            }}
                        />
                    )}

                    <Tooltip title={open ? "Daralt" : "Genişlet"}>
                        <IconButton
                            onClick={toggle}
                            size="small"
                            sx={{
                                color: NEON_COLOR_1,
                                "&:hover": {
                                    bgcolor: alpha(NEON_COLOR_1, 0.1),
                                    transform: "scale(1.1) rotate(180deg)",
                                    boxShadow: `0 0 5px ${alpha(NEON_COLOR_1, 0.8)}`,
                                },
                                transition: "all 0.3s",
                                transform: open ? "none" : "rotate(180deg)",
                            }}
                        >
                            {open ? <MenuOpenIcon /> : <MenuIcon />}
                        </IconButton>
                    </Tooltip>
                </Box>

                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

                {/* Navigasyon Listesi */}
                <List sx={{ pt: 1, pb: 2, overflowY: "auto", flexGrow: 1 }}>
                    {/* KULLANICI İŞLEMLERİ */}
                    <Category
                        icon={<PeopleAltIcon />}
                        label="KULLANICI İŞLEMLERİ"
                        openState={kullaniciMenuAcik}
                        setOpenState={setKullaniciMenuAcik}
                    />
                    <Collapse in={kullaniciMenuAcik} timeout="auto" unmountOnExit>
                        {kullaniciAltMenuler.map((m) => (
                            <NavItem key={m.yol} label={m.ad} icon={m.ikon} to={m.yol} onClick={go} />
                        ))}
                    </Collapse>

                    {/* ARAÇ YÖNETİM */}
                    <Category
                        icon={<DirectionsCarIcon />}
                        label="ARAÇ YÖNETİM"
                        openState={aracMenuAcik}
                        setOpenState={setAracMenuAcik}
                    />
                    <Collapse in={aracMenuAcik} timeout="auto" unmountOnExit>
                        {aracAltMenuler.map((m) => (
                            <NavItem key={m.yol} label={m.ad} icon={m.ikon} to={m.yol} onClick={go} />
                        ))}
                    </Collapse>

                    {/* RAPORLAR */}
                    <Category
                        icon={<AssessmentIcon />}
                        label="RAPORLAR"
                        openState={raporMenuAcik}
                        setOpenState={setRaporMenuAcik}
                    />
                    <Collapse in={raporMenuAcik} timeout="auto" unmountOnExit>
                        {raporAltMenuler.map((m) => (
                            <NavItem key={m.yol} label={m.ad} icon={m.ikon} to={m.yol} onClick={go} />
                        ))}
                    </Collapse>

                    {/* HAKEDİŞLER */}
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
                            <NavItem key={m.yol} label={m.ad} icon={m.ikon} to={m.yol} onClick={go} />
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
                            <NavItem key={m.yol} label={m.ad} icon={m.ikon} to={m.yol} onClick={go} />
                        ))}
                    </Collapse>

                    {/* GÖREVLER */}
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
                                    to={m.yol}
                                    onClick={go}
                                    badge={m.badge}
                                    onRead={m.onRead}
                                />
                            ))}
                    </Collapse>
                </List>

                {/* Alt Kısım */}
                <Box
                    sx={{
                        p: 2,
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                        transition: "opacity 0.3s",
                        opacity: open ? 1 : 0,
                        textAlign: "center",
                    }}
                >
                    {open && (
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                            v1.3.37 | FTS Solutions
                        </Typography>
                    )}
                </Box>
            </Drawer>

            {/* Snackbar */}
            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={handleCloseSnack}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert
                    onClose={handleCloseSnack}
                    severity={snack.severity}
                    variant="filled"
                    sx={{
                        width: "100%",
                        borderRadius: "10px",
                        boxShadow: `0 4px 15px ${alpha(NEON_COLOR_2, 0.5)}`,
                        fontWeight: 600,
                    }}
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </>
    );
}
