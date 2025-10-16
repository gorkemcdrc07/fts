// src/routes/guards/RequirePageAccess.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
    Box,
    Typography,
    Paper,
    Button,
    Stack,
    CircularProgress,   // ✅ Eksik import eklendi!
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import usePageAccess from "../../auth/usePageAccess";

export default function RequirePageAccess({ children, path }) {
    const location = useLocation();
    const targetPath = path || location.pathname;
    const { loading, hasAccess } = usePageAccess();

    if (loading) {
        return (
            <Box
                sx={{
                    p: 6,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                }}
            >
                <CircularProgress />
                <Typography variant="body1" color="text.secondary">
                    Sayfa erişim kontrolü yapılıyor…
                </Typography>
            </Box>
        );
    }

    if (!hasAccess(targetPath)) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "80vh",
                    p: 3,
                }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        p: 4,
                        maxWidth: 480,
                        textAlign: "center",
                        borderRadius: 4,
                    }}
                >
                    <Stack spacing={2} alignItems="center">
                        <LockIcon sx={{ fontSize: 60, color: "error.main" }} />
                        <Typography variant="h5" fontWeight={700}>
                            Erişim Yetkiniz Yok
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Bu sayfaya erişim izniniz bulunmuyor.
                            <br />
                            Gerekli yetki için yöneticinizle iletişime geçebilirsiniz.
                        </Typography>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<ArrowBackIcon />}
                            onClick={() => (window.location.href = "/anasayfa")}
                            sx={{ mt: 2 }}
                        >
                            Ana Sayfaya Dön
                        </Button>
                    </Stack>
                </Paper>
            </Box>
        );
    }

    return children;
}
