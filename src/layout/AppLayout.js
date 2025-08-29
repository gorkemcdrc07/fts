import React, { useState } from "react";
import { Box, Toolbar } from "@mui/material";
import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar"; // yolu sende böyleyse bırak
import Navbar from "../Navbar";   // navbar yolu da böyleyse bırak

export default function AppLayout() {
    const [open, setOpen] = useState(true);

    return (
        <>
            {/* Üst sabit navbar */}
            <Navbar open={open} setOpen={setOpen} />

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
