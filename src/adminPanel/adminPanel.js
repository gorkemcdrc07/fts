import React, { useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
import {
    Box, Paper, Tabs, Tab, Typography, Alert, Stack,
    IconButton, Collapse,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import UsersTab from "./tabs/UsersTab";
import RolesTab from "./tabs/RolesTab";
import UserOverridesTab from "./tabs/UserOverridesTab";
import PagePermissionsTab from "./tabs/PagePermissionsTab";
import LogsTab from "./tabs/LogsTab";
import SettingsTab from "./tabs/SettingsTab";

function normalizeRole(s = "") {
    return s.normalize("NFKC").toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
}
function safeGetUsername() {
    const k1 = (localStorage.getItem("kullaniciAdi") || "").trim();
    const k2 = (localStorage.getItem("kullanici") || "").trim();
    let k3 = "";
    try { k3 = JSON.parse(localStorage.getItem("girisYapanKullanici") || "{}")?.kullaniciAdi || ""; } catch { }
    const pick = (k1 || k2 || k3 || "").toLowerCase();
    return pick.includes("@") ? pick.split("@")[0] : pick;
}
function resolveRole() {
    const r1 = localStorage.getItem("rol") || "";
    const r2 = localStorage.getItem("roleKey") || "";
    const n1 = normalizeRole(r1);
    const n2 = normalizeRole(r2);
    return n1 || n2 || "";
}
function isAdminUser(u) {
    const allow = new Set(["admin", "yagiz"]);
    return allow.has((u || "").toLowerCase());
}
function canUseAdminResolved() {
    const u = safeGetUsername();
    const role = resolveRole();
    const byUser = isAdminUser(u);
    const byRole = role === "YÖNETİCİ" || role === "YONETICI";
    return { allowed: !!(byUser || byRole), u, role, byUser, byRole };
}

export default function AdminPanel() {
    // const navigate = useNavigate();
    const [tab, setTab] = useState(0);
    const [dbgOpen, setDbgOpen] = useState(false);

    const gate = useMemo(() => canUseAdminResolved(), []);
    const { allowed } = gate;

    return (
        <Box sx={{ p: 3 }}>
            <Paper
                elevation={0}
                sx={{
                    p: 2.5,
                    borderRadius: 3,
                    border: (t) => `1px solid ${t.palette.divider}`,
                    bgcolor: (t) => t.palette.background.paper
                }}
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                >
                    <Typography variant="h6" fontWeight={800}>Yönetim Paneli</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                        {/* "Sayfa Erişimleri" butonu kaldırıldı */}
                        <IconButton
                            size="small"
                            onClick={() => setDbgOpen((v) => !v)}
                            aria-label="debug"
                            title="Debug"
                        >
                            <ExpandMoreIcon
                                sx={{
                                    transform: dbgOpen ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "0.2s"
                                }}
                            />
                        </IconButton>
                    </Stack>
                </Stack>

                <Collapse in={dbgOpen} unmountOnExit>
                    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, borderRadius: 2 }}>
                        <Typography variant="caption" sx={{ display: "block", opacity: 0.8 }}>
                            <b>Debug</b> – Admin guard hangi değerleri okuyor?
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block" }}>
                            username (resolved): <b>{gate.u || "(boş)"} </b>
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block" }}>
                            role (resolved): <b>{gate.role || "(boş)"} </b>
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block" }}>
                            byUser(admin|yagiz): <b>{String(gate.byUser)}</b> • byRole(YÖNETİCİ): <b>{String(gate.byRole)}</b>
                        </Typography>
                    </Paper>
                </Collapse>

                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{ mb: 2 }}
                >
                    <Tab label="Kullanıcılar" />
                    {/* "Roller & Yetkiler" sekmesi kaldırıldı. Diğer sekmeler kaydırıldı. */}
                    <Tab label="Kullanıcı Yetkileri" />
                    <Tab label="Kullanıcı Ekranları" />
                    <Tab label="Loglar" />
                    <Tab label="Ayarlar" />
                </Tabs>

                {!allowed ? (
                    <Alert severity="warning" variant="filled" sx={{ borderRadius: 2 }}>
                        Bu alanı görüntüleme yetkiniz yok.
                    </Alert>
                ) : (
                    <>
                        {tab === 0 && <UsersTab />}
                        {/* tab === 1 artık Kullanıcı Yetkileri (eski tab 2) */}
                        {tab === 1 && <UserOverridesTab />}
                        {/* tab === 2 artık Kullanıcı Ekranları (eski tab 3) */}
                        {tab === 2 && <PagePermissionsTab />}
                        {/* tab === 3 artık Loglar (eski tab 4) */}
                        {tab === 3 && <LogsTab />}
                        {/* tab === 4 artık Ayarlar (eski tab 5) */}
                        {tab === 4 && <SettingsTab />}
                        {/* Not: Eski tab 1 (RolesTab) kaldırıldı. */}
                    </>
                )}

                <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
                    <Typography variant="caption" sx={{ opacity: 0.65 }}>
                        Oturum: <b>{gate.u || "-"}</b> • Rol: <b>{(localStorage.getItem("rol") || localStorage.getItem("roleKey") || "-").toString()}</b>
                    </Typography>
                </Stack>
            </Paper>
        </Box>
    );
}
