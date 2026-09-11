const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname)); 

let allPlayers = [];
let allClubs = [];
let gameState = {
    currentWeek: 1,
    leagues: { 1: [], 2: [] },
    fixtures: { 1: [], 2: [] },
    standings: { 1: {}, 2: {} }
};

function generateRandomFixture(teams) {
    let shuffled = [...teams].sort(() => 0.5 - Math.random());
    if (shuffled.length % 2 !== 0) shuffled.push(null);

    const totalRounds = shuffled.length - 1;
    const matchesPerRound = shuffled.length / 2;
    let rounds = [];

    for (let round = 0; round < totalRounds; round++) {
        let roundMatches = [];
        for (let match = 0; match < matchesPerRound; match++) {
            let home = shuffled[match];
            let away = shuffled[shuffled.length - 1 - match];
            if (home !== null && away !== null) {
                if (Math.random() > 0.5) roundMatches.push({ home, away });
                else roundMatches.push({ home: away, away: home });
            }
        }
        rounds.push(roundMatches);
        shuffled.splice(1, 0, shuffled.pop());
    }

    rounds = rounds.sort(() => 0.5 - Math.random());
    let secondHalf = rounds.map(round => round.map(match => ({ home: match.away, away: match.home })));
    return [...rounds, ...secondHalf];
}

function initStandings(teams) {
    let standings = {};
    teams.forEach(t => {
        standings[t.club_id] = { id: t.club_id, name: t.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, form: [] };
    });
    return standings;
}

function loadDatabase() {
    try {
        // 1. Temel oyuncu ve kulüp verilerini oku
        const playersData = fs.readFileSync(path.join(__dirname, 'players.json'), 'utf8');
        const basePlayers = JSON.parse(playersData);
        
        const clubsData = fs.readFileSync(path.join(__dirname, 'clubs.json'), 'utf8');
        allClubs = JSON.parse(clubsData).filter(c => c.club_id !== 'FREE_AGENT');
        
        // 2. FBref istatistiklerini oku
// 2. FBref istatistiklerini oku ve JSON hatasını (NaN) anında düzelt
        let fbrefDataRaw = fs.readFileSync(path.join(__dirname, 'fbref_master_data.json'), 'utf8');
        
        // Geçersiz "NaN" değerlerini JSON'un desteklediği "null" değerine çeviriyoruz
        fbrefDataRaw = fbrefDataRaw.replace(/:\s*NaN/g, ': null');
        
        const fbrefData = JSON.parse(fbrefDataRaw);

        // 3. Oyuncuları ve istatistikleri ID'ler üzerinden eşleştir
        allPlayers = basePlayers.map(player => {
            const stats = fbrefData.find(fb => fb.TM_player_id === player.player_id);
            
            // İstatistikleri (Şut, İsabetli Şut, Güven vb.) oyuncuya entegre et
            // FBref verisinde bazı değerler NaN veya boş string olabiliyor, bunu engelliyoruz.
            return {
                ...player,
                Sh: stats && !isNaN(parseFloat(stats.Sh)) ? parseFloat(stats.Sh) : 0,
                SoT: stats && !isNaN(parseFloat(stats.SoT)) ? parseFloat(stats.SoT) : 0,
                Match_Confidence: stats && !isNaN(parseInt(stats.Match_Confidence)) ? parseInt(stats.Match_Confidence) : 50,
                CrdY: stats && !isNaN(parseFloat(stats.CrdY)) ? parseFloat(stats.CrdY) : 0,
                CrdR: stats && !isNaN(parseFloat(stats.CrdR)) ? parseFloat(stats.CrdR) : 0
            };
        });

        // Ligi ve Fikstürü oluştur (Mevcut kodun)
        gameState.leagues[1] = allClubs.slice(0, 18);
        gameState.leagues[2] = allClubs.slice(18, 36);

        gameState.fixtures[1] = generateRandomFixture(gameState.leagues[1]);
        gameState.fixtures[2] = generateRandomFixture(gameState.leagues[2]);
        gameState.standings[1] = initStandings(gameState.leagues[1]);
        gameState.standings[2] = initStandings(gameState.leagues[2]);

        console.log(`✅ Veritabanı Yüklendi! ${allClubs.length} Takım ve ${allPlayers.length} Oyuncu (İstatistikleriyle) Hazır.`);
    } catch (err) {
        console.log("❌ Veritabanı Hatası: " + err.message);
    }
}

// Sunucu başlarken veritabanını yükle
loadDatabase();

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

io.on('connection', (socket) => {
    // Bağlanan kişiye mevcut kura ve puan durumunu gönder
    socket.emit('init_data', { clubs: allClubs, players: allPlayers, state: gameState });

    // Admin panelinden kura çekme emri gelirse
    socket.on('regenerate_fixtures', () => {
        console.log("🔄 Fikstürler yeniden oluşturuluyor...");
        gameState.fixtures[1] = generateRandomFixture(gameState.leagues[1]);
        gameState.fixtures[2] = generateRandomFixture(gameState.leagues[2]);
        gameState.standings[1] = initStandings(gameState.leagues[1]);
        gameState.standings[2] = initStandings(gameState.leagues[2]);
        gameState.currentWeek = 1;
        
        // Yeni fikstürü anında o an sitede olan herkese canlı olarak yansıt
        io.emit('init_data', { clubs: allClubs, players: allPlayers, state: gameState });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 DTSL Sunucusu Başladı! Port: ${PORT}`));
