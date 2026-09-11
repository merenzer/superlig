const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Ana dizindeki tüm dosyaları (index.html, resimler vb.) erişime aç
app.use(express.static(__dirname));

// JSON Veritabanlarını Yükle
let tumOyuncular = [];
let tumTakimlar = [];

try {
    const playersData = fs.readFileSync(path.join(__dirname, 'data', 'players.json'), 'utf8');
    tumOyuncular = JSON.parse(playersData);
    
    const clubsData = fs.readFileSync(path.join(__dirname, 'data', 'clubs.json'), 'utf8');
    tumTakimlar = JSON.parse(clubsData);
    
    console.log(`✅ Veritabanı Yüklendi: ${tumTakimlar.length} Takım, ${tumOyuncular.length} Oyuncu hazır.`);
} catch (err) {
    console.log("❌ Veritabanı Hatası: " + err.message);
}

// Ana sayfaya girildiğinde index.html'i gönder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Kullanıcı siteye girdiğinde çalışacak Socket.io bağlantısı
io.on('connection', (socket) => {
    console.log('🔗 Bir menajer bağlandı:', socket.id);
    
    // Bağlanan kullanıcıya gerçek verileri gönder
    socket.emit('init_data', {
        clubs: tumTakimlar,
        players: tumOyuncular
    });
});

// Render.com'un atadığı dinamik portu kullan, lokaldeysen 3000 kullan
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 DTSL Sunucusu Başladı! Port: ${PORT}`);
});
