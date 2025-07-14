require('dotenv').config(); // dotenv'i en üstte yükle
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const API_URL = 'https://api.odaklojistik.com.tr/api/tmsdespatches/getall';
const API_TOKEN = process.env.API_TOKEN;  // Token artık ortam değişkeninden geliyor

// GET test endpoint
app.get('/api/proxy/tmsdespatches', (req, res) => {
    res.send('GET isteği başarılı');
});

app.post('/api/proxy/tmsdespatches', async (req, res) => {
    console.log('Proxyye gelen body:', req.body);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${API_TOKEN}`,
            },
            body: JSON.stringify(req.body),
        });

        const responseText = await response.text();
        console.log('API yanıtı:', responseText);

        if (!response.ok) {
            console.error('API hata:', response.status, responseText);
            return res.status(500).json({ error: 'API isteği başarısız oldu' });
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('JSON parse hatası:', e);
            return res.status(500).json({ error: 'Geçersiz JSON yanıtı' });
        }

        res.json(data);
    } catch (error) {
        console.error('Proxy sunucu hatası:', error);
        res.status(500).json({ error: 'Proxy sunucu hatası' });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Proxy server ${PORT} portunda çalışıyor.`));
