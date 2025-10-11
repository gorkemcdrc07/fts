import { GridToolbarContainer, GridToolbar } from "@mui/x-data-grid";
import { Box, Button, Select, MenuItem, Stack, Tooltip, Typography } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SummarizeIcon from "@mui/icons-material/Summarize";

export default function ToolbarLite({ onExport, onExportWithDetails, pageSize, onPageSizeChange, statText }) {
    return (
        <GridToolbarContainer sx={{ p: 0.75, gap: 0.75, flexWrap: "wrap", overflowX: "auto" }}>
            <GridToolbar />
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" sx={{ ml: 1, opacity: 0.8 }}>{statText}</Typography>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>Sayfa boyutu</Typography>
                <Select size="small" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
                    {[25, 50, 100, 200].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
            </Stack>

            <Tooltip title="Görünen sayfayı Excel'e aktar">
                <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />} onClick={onExport} sx={{ ml: 1 }}>
                    Excel
                </Button>
            </Tooltip>
            <Tooltip title="Sayfa + detaylarla aktar">
                <Button variant="outlined" size="small" startIcon={<SummarizeIcon />} onClick={onExportWithDetails}>
                    Excel (Detay)
                </Button>
            </Tooltip>
        </GridToolbarContainer>
    );
}
