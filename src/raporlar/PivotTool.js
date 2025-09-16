// src/raporlar/PivotTool.jsx
import React, { useMemo, useState } from "react";
import {
    Box, Card, CardContent, FormControl, InputLabel, Select, MenuItem,
    Button, Chip, Stack, Typography, Divider
} from "@mui/material";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
    LineChart, Line, PieChart, Pie, Cell
} from "recharts";

// --- küçük yardımcılar ---
const unique = (arr) => Array.from(new Set(arr));
const aggregators = {
    sum: (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0),
    count: (arr) => arr.length,
    avg: (arr) => (arr.length ? arr.reduce((a, b) => a + (Number(b) || 0), 0) / arr.length : 0),
};

function inferFields(rows) {
    if (!rows || !rows.length) return [];
    return Object.keys(rows[0]);
}

function inferNumericFields(rows, fields) {
    if (!rows?.length) return [];
    return fields.filter((f) => rows.some((r) => typeof r[f] === "number"));
}

function pivot({ rows, rowDims, colDims, measure, agg }) {
    if (!rows?.length || !measure) {
        return { table: [], rowKeys: [], colKeys: [] };
    }
    const aggFn = aggregators[agg] || aggregators.sum;

    const rowKeys = unique(rows.map((r) => rowDims.map((d) => r[d] ?? "(boş)").join(" | "))).sort();
    const colKeys = unique(
        rows.map((r) => (colDims.length ? colDims.map((d) => r[d] ?? "(boş)").join(" | ") : "Toplam"))
    ).sort();

    const cube = {};
    rows.forEach((r) => {
        const rk = rowDims.map((d) => r[d] ?? "(boş)").join(" | ");
        const ck = colDims.length ? colDims.map((d) => r[d] ?? "(boş)").join(" | ") : "Toplam";
        const key = `${rk}__${ck}`;
        if (!cube[key]) cube[key] = [];
        cube[key].push(r[measure]);
    });

    const table = rowKeys.map((rk) => {
        const row = { __rowKey: rk };
        colKeys.forEach((ck) => {
            const key = `${rk}__${ck}`;
            row[ck] = aggFn(cube[key] || []);
        });
        return row;
    });

    return { table, rowKeys, colKeys };
}

function MultiSelectChips({ options, values, onChange }) {
    const toggle = (o) => {
        if (values.includes(o)) onChange(values.filter((v) => v !== o));
        else onChange([...values, o]);
    };
    return (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {options.map((o) => (
                <Chip
                    key={o}
                    label={o}
                    onClick={() => toggle(o)}
                    color={values.includes(o) ? "primary" : "default"}
                    variant={values.includes(o) ? "filled" : "outlined"}
                    size="small"
                    sx={{ mb: 1 }}
                />
            ))}
            {!options.length && <Typography variant="caption" sx={{ opacity: 0.6 }}>Alan yok</Typography>}
        </Stack>
    );
}

export default function PivotTool({ datasets = {}, defaultDataset }) {
    const datasetNames = Object.keys(datasets);
    const [datasetName, setDatasetName] = useState(
        defaultDataset && datasets[defaultDataset] ? defaultDataset : datasetNames[0]
    );

    const rows = datasets[datasetName] || [];
    const fields = useMemo(() => inferFields(rows), [rows]);
    const numericFields = useMemo(() => inferNumericFields(rows, fields), [rows, fields]);

    const [rowDims, setRowDims] = useState(fields.slice(0, 1));
    const [colDims, setColDims] = useState(fields.slice(1, 2));
    const [measure, setMeasure] = useState(numericFields[0] || "");
    const [agg, setAgg] = useState("sum");
    const [chartType, setChartType] = useState("bar"); // bar | line | pie

    const { table, colKeys } = useMemo(
        () => pivot({ rows, rowDims, colDims, measure, agg }),
        [rows, rowDims, colDims, measure, agg]
    );

    const chartData = useMemo(() => {
        return table.map((r) => {
            const o = { group: r.__rowKey };
            colKeys.forEach((ck) => (o[ck] = r[ck]));
            return o;
        });
    }, [table, colKeys]);

    return (
        <Box sx={{ display: "flex", gap: 2, p: 2 }}>
            {/* Sol Kontrol Paneli */}
            <Card sx={{ width: 320, flexShrink: 0 }}>
                <CardContent>
                    <Typography variant="subtitle2" sx={{ mb: 1, opacity: 0.7 }}>
                        Dataset
                    </Typography>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>Dataset</InputLabel>
                        <Select
                            label="Dataset"
                            value={datasetName || ""}
                            onChange={(e) => setDatasetName(e.target.value)}
                        >
                            {datasetNames.map((n) => (
                                <MenuItem key={n} value={n}>{n}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Typography variant="subtitle2" sx={{ mb: 1, opacity: 0.7 }}>
                        Satır Boyutları (Rows)
                    </Typography>
                    <MultiSelectChips
                        options={fields.filter((f) => f !== measure)}
                        values={rowDims}
                        onChange={setRowDims}
                    />

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" sx={{ mb: 1, opacity: 0.7 }}>
                        Sütun Boyutları (Columns)
                    </Typography>
                    <MultiSelectChips
                        options={fields.filter((f) => f !== measure)}
                        values={colDims}
                        onChange={setColDims}
                    />

                    <Divider sx={{ my: 2 }} />

                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>Measure</InputLabel>
                        <Select
                            label="Measure"
                            value={measure || ""}
                            onChange={(e) => setMeasure(e.target.value)}
                        >
                            {numericFields.map((n) => (
                                <MenuItem key={n} value={n}>{n}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>Agregasyon</InputLabel>
                        <Select
                            label="Agregasyon"
                            value={agg}
                            onChange={(e) => setAgg(e.target.value)}
                        >
                            {Object.keys(aggregators).map((a) => (
                                <MenuItem key={a} value={a}>{a}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Stack direction="row" spacing={1}>
                        <Button
                            variant={chartType === "bar" ? "contained" : "outlined"}
                            onClick={() => setChartType("bar")}
                            size="small"
                        >
                            Bar
                        </Button>
                        <Button
                            variant={chartType === "line" ? "contained" : "outlined"}
                            onClick={() => setChartType("line")}
                            size="small"
                        >
                            Line
                        </Button>
                        <Button
                            variant={chartType === "pie" ? "contained" : "outlined"}
                            onClick={() => setChartType("pie")}
                            size="small"
                        >
                            Pie
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            {/* Sağ: Pivot tablo + grafik */}
            <Box sx={{ flex: 1, display: "grid", gridTemplateRows: "minmax(240px, auto) 360px", gap: 2 }}>
                <Card>
                    <CardContent>
                        <Typography variant="subtitle2" sx={{ mb: 1, opacity: 0.7 }}>
                            Pivot Tablo
                        </Typography>
                        <Box sx={{ overflow: "auto", borderRadius: 1, border: "1px solid rgba(0,0,0,0.08)" }}>
                            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#fafafa" }}>
                                        <th style={{ textAlign: "left", padding: 8 }}>{rowDims.length ? rowDims.join(" · ") : "(Grup)"}</th>
                                        {colKeys.map((ck) => (
                                            <th key={ck} style={{ textAlign: "right", padding: 8, borderLeft: "1px solid #eee" }}>{ck}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {table.map((r, i) => (
                                        <tr key={i}>
                                            <td style={{ padding: 8, borderTop: "1px solid #eee", fontWeight: 600 }}>{r.__rowKey}</td>
                                            {colKeys.map((ck) => (
                                                <td key={ck} style={{ padding: 8, textAlign: "right", borderTop: "1px solid #eee", borderLeft: "1px solid #f5f5f5" }}>
                                                    {Number.isFinite(r[ck]) ? r[ck].toLocaleString() : ""}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Box>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent sx={{ height: 320 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, opacity: 0.7 }}>
                            Grafik
                        </Typography>
                        <Box sx={{ width: "100%", height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                {chartType === "bar" && (
                                    <BarChart data={chartData}>
                                        <XAxis dataKey="group" tick={{ fontSize: 12 }} height={36} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        {colKeys.map((ck, idx) => (
                                            <Bar key={ck} dataKey={ck} fill={`hsl(${(idx * 57) % 360} 70% 50%)`} />
                                        ))}
                                    </BarChart>
                                )}
                                {chartType === "line" && (
                                    <LineChart data={chartData}>
                                        <XAxis dataKey="group" tick={{ fontSize: 12 }} height={36} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        {colKeys.map((ck, idx) => (
                                            <Line key={ck} type="monotone" dataKey={ck} stroke={`hsl(${(idx * 57) % 360} 70% 45%)`} dot={false} />
                                        ))}
                                    </LineChart>
                                )}
                                {chartType === "pie" && (
                                    <PieChart>
                                        <Tooltip />
                                        <Legend />
                                        <Pie data={chartData} dataKey={colKeys[0]} nameKey="group" outerRadius={110}>
                                            {chartData.map((_, idx) => (
                                                <Cell key={idx} fill={`hsl(${(idx * 57) % 360} 70% 50%)`} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                )}
                            </ResponsiveContainer>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
