// src/layout/AppLayout.jsx
import React, { useState } from "react";
import { Box, Toolbar } from "@mui/material";
import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar";   // sende bu yol doğruysa bırak
import Navbar from "../Navbar";     // sende bu yol doğruysa bırak
import useCurrentUser from "../auth/useCurrentUser"; // sağ üstte isim için

export default function AppLayout() {
    const [open, setOpen] = useState(true);
    const { displayName } = useCurrentUser(); // localStorage'dan güvenli okuma

    return (
        <>
            {/* Üst sabit navbar */}
            <Navbar open={open} setOpen={setOpen} displayName={displayName} />

            {/* Yan yana düzen */}
            <Box sx={{ display: "flex", minHeight: "100vh" }}>
                {/* Drawer flex satırında yer kaplıyor, margin vermeye gerek yok */}
                <Sidebar open={open} setOpen={setOpen} />

                <Box
                    component="main"
                    sx={{
                        flexGrow: 1,
                        minHeight: "100vh",
                        // ❌ ml yok!
                        px: 2, // istersen padding
                        pb: 2,
                    }}
                >
                    {/* AppBar yüksekliği kadar boşluk (spacer) */}
                    <Toolbar />

                    {/* Sayfa içeriği */}
                    <Outlet />
                </Box>
            </Box>
        </>
    );
}
