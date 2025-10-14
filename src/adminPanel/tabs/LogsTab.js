// src/adminPanel/tabs/LogsTab.js
import React from "react";
import { Box, Typography } from "@mui/material";

export default function LogsTab() {
    return (
        <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                Uygulama Logları
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Log görüntüleme/filtreleme burada olacak.
            </Typography>
        </Box>
    );
}
