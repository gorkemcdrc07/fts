require('dotenv').config(); // dotenv'i en üstte yükle
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');  // Burayı ekliyoruz

const app = express();

const allowedOrigins = [
    'https://fts-psi.vercel.app',
    'https://fts-git-main-gorkems-projects-f9c4a0e9.vercel.app',
    'https://fts-ya39ieb0j-gorkems-projects-f9c4a0e9.vercel.app',
    'https://fts-84mb.onrender.com',
    'http://localhost:3000', // Geliştirme ortamı için
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true); // Postman gibi araçlardan gelen isteklere izin ver
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'CORS policy does not allow this origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));

app.use(express.json());

// **React build klasörünü statik dosya olarak sunuyoruz**
app.use(express.static(path.join(__dirname, 'build')));

const API_URL = 'https://api.odaklojistik.com.tr/api/tmsdespatches/getall';
const API_TOKEN = process.env.API_TOKEN;  // Token ortam değişkeninden geliyor

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

// **React Router ile frontend routing için**
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Proxy server ${PORT} portunda çalışıyor.`));


