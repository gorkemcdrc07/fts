const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

const corsOptions = {
    origin: ['http://localhost:3000', 'https://filo-web.vercel.app'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

app.post('/api/seferler', async (req, res) => {
    try {
        const now = new Date();
        const trOffset = 3 * 60 * 60 * 1000;

        const end = new Date(now.getTime() + trOffset);
        end.setHours(23, 59, 59, 999);

        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + trOffset);
        start.setHours(0, 0, 0, 0);

        const body = {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            userId: 1
        };

        console.log('[→] TR zamanlı istek:', body);
        console.log('✅ API TOKEN:', process.env.API_TOKEN); // Geçici log

        const response = await fetch('https://api.odaklojistik.com.tr/api/tmsdespatches/getall', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.API_TOKEN}`
            },
            body: JSON.stringify(body)
        });

        // 🔴 BURASI EKLENDİ
        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ API Hatası: ${response.status} ${response.statusText} - ${errText}`);
            return res.status(response.status).json({ hata: 'API isteği başarısız', detay: errText });
        }

        const text = await response.text();
        const json = JSON.parse(text);
        res.json(json);

    } catch (err) {
        console.error('❌ Sunucu hatası:', err.message);
        res.status(500).json({ hata: 'Sunucu hatası', detay: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Proxy sunucusu çalışıyor: http://localhost:${PORT}`);
});
