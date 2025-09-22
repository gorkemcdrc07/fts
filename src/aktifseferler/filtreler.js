// src/aktifseferler/filtreler.js
import React, { memo } from "react";
import { Paper, TextField, MenuItem } from "@mui/material";

/**
 * Filtreler panelini ayrı bir bileşen olarak ayırdık.
 * Not: Tüm state ve setter'lar üst bileşenden (ReelAtananSeferler) prop olarak gelir.
 */
function Filtreler({
    /* görünüm */
    COLORS,
    baseInputSX,
    /* seçenekler */
    options = {},
    /* filtre state'leri */
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    seferNoTipi,
    setSeferNoTipi,
    plaka,
    setPlaka,
    musteri,
    setMusteri,
    proje,
    setProje,
    yuklemeIl,
    setYuklemeIl,
    teslimIl,
    setTeslimIl,
    aracStatu,
    setAracStatu,
    noktaSayisi,
    setNoktaSayisi,
    quick,
    setQuick,
    surucu,
    setSurucu,
}) {
    return (
        <Paper
            sx={{
                p: 1.2,
                borderRadius: 2,
                display: "grid",
                gridTemplateColumns: "repeat(12, 1fr)",
                gap: 1,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
            }}
        >
            <TextField
                label="Başlangıç"
                type="date"
                size="small"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            />

            <TextField
                label="Bitiş"
                type="date"
                size="small"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            />

            <TextField
                label="Sefer No Tipi"
                select
                size="small"
                value={seferNoTipi}
                onChange={(e) => setSeferNoTipi(e.target.value)}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            >
                <MenuItem value="">Tümü</MenuItem>
                <MenuItem value="BOS">BOS…</MenuItem>
                <MenuItem value="SFR">SFR…</MenuItem>
            </TextField>

            <TextField
                label="Plaka"
                select
                size="small"
                value={plaka}
                onChange={(e) => setPlaka(e.target.value)}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            >
                <MenuItem value="">Tümü</MenuItem>
                {(options.plaka || []).map((v) => (
                    <MenuItem key={v} value={v}>
                        {v}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Sürücü"
                select
                size="small"
                value={surucu}
                onChange={(e) => setSurucu(e.target.value)}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            >
                <MenuItem value="">Tümü</MenuItem>
                {(options.surucu_ad_soyad || []).map((v) => (
                    <MenuItem key={v} value={v}>
                        {v}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Müşteri"
                select
                size="small"
                value={musteri}
                onChange={(e) => setMusteri(e.target.value)}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            >
                <MenuItem value="">Tümü</MenuItem>
                {(options.musteri_adi || []).map((v) => (
                    <MenuItem key={v} value={v}>
                        {v}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Proje"
                select
                size="small"
                value={proje}
                onChange={(e) => setProje(e.target.value)}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            >
                <MenuItem value="">Tümü</MenuItem>
                {(options.proje_adi || []).map((v) => (
                    <MenuItem key={v} value={v}>
                        {v}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Yükleme İl"
                select
                size="small"
                value={yuklemeIl}
                onChange={(e) => setYuklemeIl(e.target.value)}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            >
                <MenuItem value="">Tümü</MenuItem>
                {(options.yukleme_ili || []).map((v) => (
                    <MenuItem key={v} value={v}>
                        {v}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Teslim İl"
                select
                size="small"
                value={teslimIl}
                onChange={(e) => setTeslimIl(e.target.value)}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            >
                <MenuItem value="">Tümü</MenuItem>
                {(options.teslim_ili || []).map((v) => (
                    <MenuItem key={v} value={v}>
                        {v}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Araç Statü"
                select
                size="small"
                value={aracStatu}
                onChange={(e) => setAracStatu(e.target.value)}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            >
                <MenuItem value="">Tümü</MenuItem>
                {(options.arac_statu || []).map((v) => (
                    <MenuItem key={v} value={v}>
                        {v}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Nokta"
                type="number"
                size="small"
                value={noktaSayisi}
                onChange={(e) => setNoktaSayisi(e.target.value)}
                sx={{ gridColumn: { xs: "span 6", md: "span 2" }, ...baseInputSX }}
            />

            <TextField
                label="Ara (metin)"
                size="small"
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                placeholder="metin ara…"
                sx={{ gridColumn: { xs: "span 12", md: "span 2" }, ...baseInputSX }}
            />
        </Paper>
    );
}

export default memo(Filtreler);

/* -----------------------------------------------------
 * ReelAtananSeferler.js içinde kullanım (örnek değişiklik)
 * -----------------------------------------------------
 * 1) Üste import ekleyin:
 *    import Filtreler from "./filtreler";
 *
 * 2) Eski filtre <Paper> bloğunu aşağıdaki ile değiştirin:
 *
 *    <Filtreler
 *      COLORS={COLORS}
 *      baseInputSX={baseInputSX}
 *      options={options}
 *      startDate={startDate}
 *      setStartDate={setStartDate}
 *      endDate={endDate}
 *      setEndDate={setEndDate}
 *      seferNoTipi={seferNoTipi}
 *      setSeferNoTipi={setSeferNoTipi}
 *      plaka={plaka}
 *      setPlaka={setPlaka}
 *      musteri={musteri}
 *      setMusteri={setMusteri}
 *      proje={proje}
 *      setProje={setProje}
 *      yuklemeIl={yuklemeIl}
 *      setYuklemeIl={setYuklemeIl}
 *      teslimIl={teslimIl}
 *      setTeslimIl={setTeslimIl}
 *      aracStatu={aracStatu}
 *      setAracStatu={setAracStatu}
 *      noktaSayisi={noktaSayisi}
 *      setNoktaSayisi={setNoktaSayisi}
 *      quick={quick}
 *      setQuick={setQuick}
 *      surucu={surucu}
 *      setSurucu={setSurucu}
 *    />
 */
