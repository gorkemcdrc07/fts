// src/adminPanel/tabs/SettingsTab.js
import React from "react";
import { Box, Typography } from "@mui/material";

export default function SettingsTab() {
    return (
        <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                Sistem Ayarları
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Genel ayarlar burada yönetilecek.
            </Typography>
        </Box>
    );
}
