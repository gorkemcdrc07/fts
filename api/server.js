require('dotenv').config(); // .env dosyasını yükle
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// CORS ayarları
const allowedOrigins = [
    'https://fts-psi.vercel.app',
    'https://fts-git-main-gorkems-projects-f9c4a0e9.vercel.app',
    'https://fts-ya39ieb0j-gorkems-projects-f9c4a0e9.vercel.app',
    'https://fts-84mb.onrender.com',
    'http://localhost:3000',
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('CORS policy does not allow this origin.'), false);
        },
    })
);

app.use(express.json());

// React build klasörünü sun
app.use(express.static(path.join(__dirname, 'build')));

// 🌐 Ortam değişkenleri (Render'dan geliyor)
const API_TOKEN = process.env.API_TOKEN;
const TMS_URL = process.env.TMS_URL;

// Test endpoint
app.get('/api/proxy/tmsdespatches', (req, res) => {
    res.send('GET isteği başarılı (proxy test)');
});

// ----------------------
// 🔁 Proxy POST endpoint
// ----------------------
app.post('/api/proxy/tmsdespatches', async (req, res) => {
    console.log('Proxyye gelen body:', req.body);

    if (!TMS_URL) {
        console.error('❌ TMS_URL tanımlı değil (.env içinde eksik)');
        return res.status(500).json({ error: 'Sunucu yapılandırma hatası: TMS_URL eksik' });
    }

    // Retry + timeout logic
    const MAX_RETRIES = 3;
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(TMS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${API_TOKEN}`,
                },
                body: JSON.stringify(req.body),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            const text = await response.text();

            if (!response.ok) {
                console.error(`❌ TMS yanıtı hata [${response.status}]:`, text);
                return res
                    .status(response.status)
                    .json({ error: `TMS API hatası: ${response.status}`, detail: text });
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('❌ JSON parse hatası:', e);
                return res.status(500).json({ error: 'Geçersiz JSON yanıtı aldı' });
            }

            console.log(`✅ TMS isteği başarılı (${response.status})`);
            return res.json(data);
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ TMS isteği deneme ${attempt}/${MAX_RETRIES} başarısız:`, error.message);
            if (attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, attempt * 1500)); // backoff: 1.5s, 3s
                continue;
            }
        }
    }

    console.error('❌ Proxy sunucu hatası:', lastError);
    res
        .status(502)
        .json({ error: 'TMS sunucusuna ulaşılamadı', detail: lastError?.message || 'Bilinmeyen hata' });
});

// -----------------------
// React Router fallback
// -----------------------
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'build', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error('index.html bulunamadı!');
        res.status(404).send('index.html bulunamadı!');
    }
});

// Global hata yakalayıcı
app.use((err, req, res, next) => {
    console.error('💥 Express hata:', err.stack || err.message);
    res.status(500).send('Sunucu hatası');
});

// Sunucuyu başlat
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server ${PORT} portunda çalışıyor`);
    console.log(`🌍 TMS_URL: ${TMS_URL ? 'tanımlı' : 'tanımsız'}`);
});
