const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- 1. VERİTABANI YÜKLEME ---
let tumOyuncular = [];
const dosyaYolu = path.join(__dirname, 'fbref_master_data.json');

try {
    let hamVeri = fs.readFileSync(dosyaYolu, 'utf8');
    hamVeri = hamVeri.replace(/:\s*NaN/g, ': 0');
    tumOyuncular = JSON.parse(hamVeri);
    console.log("✅ Gelişmiş Veritabanı Yüklendi. Toplam Oyuncu: " + tumOyuncular.length);
} catch (err) {
    console.log("❌ Veritabanı Hatası: " + err.message);
}

function degeriSayiyaCevir(degerMetni) {
    if (!degerMetni || degerMetni === "-") return 0;
    let num = parseFloat(degerMetni.replace(',', '.'));
    if (degerMetni.includes('mil')) return num * 1000000;
    if (degerMetni.includes('bin')) return num * 1000;
    return num;
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'ekran.html')));

// --- 2. GELİŞMİŞ MAÇ MOTORU ---
class MatchEngine {
    constructor(evSahibiAd, deplasmanAd, socket) {
        this.socket = socket;
        this.evAd = evSahibiAd;
        this.depAd = deplasmanAd;
        
        // Aktif Kadrolar (Sakatlanan veya atılan oyuncular buradan silinecek)
        this.kadro = {
            ev: tumOyuncular.filter(p => p.Squad === evSahibiAd),
            dep: tumOyuncular.filter(p => p.Squad === deplasmanAd)
        };
        
        // Takım Gücü (Momentum için)
        this.guc = {
            ev: this.kadro.ev.reduce((toplam, p) => toplam + degeriSayiyaCevir(p.TM_market_value), 0),
            dep: this.kadro.dep.reduce((toplam, p) => toplam + degeriSayiyaCevir(p.TM_market_value), 0)
        };

        this.skor = { ev: 0, dep: 0 };
        this.dakika = 1;
        this.dongu = null;
        
        // Kart ve Değişiklik Takibi
        this.sariKartlar = {}; // Oyuncu ismi -> Kart sayısı (2 olunca kırmızı)
        this.degisiklikHakki = { ev: 5, dep: 5 };

        // CANLI İSTATİSTİKLER (Arayüzdeki barları besleyecek)
        this.stats = {
            ev: { poss: 50, sut: 0, isabetli: 0, xg: 0, faul: 0, pas: 0, korner: 0, sari: 0, kirmizi: 0 },
            dep: { poss: 50, sut: 0, isabetli: 0, xg: 0, faul: 0, pas: 0, korner: 0, sari: 0, kirmizi: 0 }
        };

        // Başlangıç Topa Sahip Olma Ağırlığı
        let toplamGuc = this.guc.ev + this.guc.dep;
        this.stats.ev.poss = Math.round(50 + 5 + ((this.guc.ev - this.guc.dep) / toplamGuc * 20));
        if (this.stats.ev.poss > 70) this.stats.ev.poss = 70;
        if (this.stats.ev.poss < 30) this.stats.ev.poss = 30;
        this.stats.dep.poss = 100 - this.stats.ev.poss;
    }

    start() {
        this.socket.emit('mac_basladi', { mesaj: 'Maç Başladı' });
        this.dongu = setInterval(() => this.tick(), 1200);
    }

    tick() {
        this.socket.emit('zaman_guncelle', this.dakika);

        if (this.dakika === 45) {
            this.socket.emit('olay', { tur: 'devre', detay: `HT ${this.skor.ev} - ${this.skor.dep}` });
        } else if (this.dakika > 90) {
            this.socket.emit('olay', { tur: 'bitis', detay: `MS ${this.skor.ev} - ${this.skor.dep}` });
            clearInterval(this.dongu);
            return;
        } else {
            this.zarAt();
        }

        // Her saniye arayüze anlık istatistikleri gönder (Arayüzdeki barlar için)
        this.socket.emit('canli_istatistik', this.stats);
        this.dakika++;
    }

    zarAt() {
        // Hangi takım atakta? (Topa sahip olma oranına göre)
        let evMi = (Math.random() * 100) <= this.stats.ev.poss;
        let atakTakim = evMi ? 'ev' : 'dep';
        let savunanTakim = evMi ? 'dep' : 'ev';
        
        // Pas istatistiğini artır
        this.stats[atakTakim].pas += Math.floor(Math.random() * 5) + 2;

        let olayZari = Math.random() * 100;
        let yorgunluk = this.dakika > 70 ? 0.8 : 1.0;

        // 1. FAUL VE KART SİSTEMİ (%25 ihtimalle savunma faul yapar)
        if (olayZari < 25) {
            this.stats[savunanTakim].faul++;
            let faulZari = Math.random() * 100;
            
            // %15 ihtimalle Sarı Kart
            if (faulZari > 85) {
                let agresifOyuncu = this.agirlikliSec(this.kadro[savunanTakim], 'CrdY');
                let isim = agresifOyuncu.Player;
                
                this.sariKartlar[isim] = (this.sariKartlar[isim] || 0) + 1;
                
                if (this.sariKartlar[isim] === 2) {
                    // İKİNCİ SARI KART -> KIRMIZI
                    this.stats[savunanTakim].kirmizi++;
                    this.kadro[savunanTakim] = this.kadro[savunanTakim].filter(p => p.Player !== isim);
                    this.socket.emit('olay', { dakika: this.dakika, tur: 'kirmizi', evSahibiMi: !evMi, oyuncu: isim, detay: 'İkinci sarıdan kırmızı!' });
                } else {
                    this.stats[savunanTakim].sari++;
                    this.socket.emit('olay', { dakika: this.dakika, tur: 'sari', evSahibiMi: !evMi, oyuncu: isim, detay: 'Sert Faul' });
                }
            } 
            // %1 ihtimalle Direkt Kırmızı
            else if (faulZari < 1) {
                let kasapOyuncu = this.agirlikliSec(this.kadro[savunanTakim], 'CrdR');
                this.stats[savunanTakim].kirmizi++;
                this.kadro[savunanTakim] = this.kadro[savunanTakim].filter(p => p.Player !== kasapOyuncu.Player);
                this.socket.emit('olay', { dakika: this.dakika, tur: 'kirmizi', evSahibiMi: !evMi, oyuncu: kasapOyuncu.Player, detay: 'Direkt Kırmızı! Çok sert müdahale.' });
            }
        }

        // 2. SAKATLIK SİSTEMİ (%1 ihtimal her dakika)
        else if (olayZari > 98 && this.degisiklikHakki[atakTakim] > 0) {
            let sakatlanan = this.kadro[atakTakim][Math.floor(Math.random() * this.kadro[atakTakim].length)];
            let giren = this.yedekSec(this.kadro[atakTakim], sakatlanan.TM_position);
            if (sakatlanan.Player !== giren.Player) {
                this.degisiklikHakki[atakTakim]--;
                this.socket.emit('olay', { dakika: this.dakika, tur: 'degisiklik', evSahibiMi: evMi, oyuncu: giren.Player, detay: `${sakatlanan.Player} (Sakatlandı)` });
            }
        }

        // 3. ŞUT VE GOL ORGANİZASYONLARI
        else if (olayZari > 70) {
            this.stats[atakTakim].sut++;
            let isSetPiece = Math.random() > 0.8; // %20 ihtimalle Korner/Serbest vuruş
            let golcu;
            let asistci = this.agirlikliSec(this.kadro[atakTakim], 'Ast');

            if (isSetPiece) {
                this.stats[atakTakim].korner++;
                // Duran topta stoperlerin şut atma ağırlığı yapay olarak artırılır
                golcu = this.kadro[atakTakim][Math.floor(Math.random() * this.kadro[atakTakim].length)]; 
            } else {
                golcu = this.agirlikliSec(this.kadro[atakTakim], 'Sh', true); // Açık oyunda kaleciler hariç
            }

            if(golcu.Player === asistci.Player) asistci = { Player: "" }; 

            // xG Hesabı (FBref'ten al, yoksa manuel hesapla)
            let oyuncuXG = (Number(golcu.xG) / (Number(golcu.Sh) || 1)) || 0.10; 
            if (isSetPiece) oyuncuXG *= 1.5; // Duran topta gol beklentisi artar
            
            this.stats[atakTakim].xg += oyuncuXG; // Takım xG'sini canlı panele ekle
            
            let isabetliMi = Math.random() < ((Number(golcu.SoT) / (Number(golcu.Sh) || 1)) + 0.1);
            if (isabetliMi) {
                this.stats[atakTakim].isabetli++;
                
                // Kaleci vs Şutçu zarı
                let finalIhtimal = (oyuncuXG * 100 * yorgunluk); 
                if (Math.random() * 100 < finalIhtimal) {
                    atakTakim === 'ev' ? this.skor.ev++ : this.skor.dep++;
                    this.socket.emit('olay', { 
                        dakika: this.dakika, tur: 'gol', evSahibiMi: evMi, 
                        oyuncu: golcu.Player, 
                        detay: isSetPiece ? `Kafa Vuruşu! (Asist: ${asistci.Player})` : `Asist: ${asistci.Player}`, 
                        skor: `${this.skor.ev} - ${this.skor.dep}` 
                    });
                }
            }
        }
        
        // 4. NORMAL OYUNCU DEĞİŞİKLİĞİ (60'dan sonra, yorgunluktan dolayı)
        else if (olayZari > 65 && this.dakika > 60 && this.degisiklikHakki[atakTakim] > 0) {
            let cikan = this.kadro[atakTakim][Math.floor(Math.random() * this.kadro[atakTakim].length)];
            let giren = this.yedekSec(this.kadro[atakTakim], cikan.TM_position);
            
            if (cikan.Player !== giren.Player && cikan.TM_position !== "Kaleci") {
                this.degisiklikHakki[atakTakim]--;
                this.socket.emit('olay', { dakika: this.dakika, tur: 'degisiklik', evSahibiMi: evMi, oyuncu: giren.Player, detay: cikan.Player });
            }
        }
    }

    // Yardımcı: İstatistiğe Göre Kura
    agirlikliSec(kadro, istatistikTuru, kaleciHaric = false) {
        let filtrelenmis = kaleciHaric ? kadro.filter(p => p.TM_position !== "Kaleci") : kadro;
        if (filtrelenmis.length === 0) return kadro[0];

        let toplamDeger = filtrelenmis.reduce((toplam, p) => toplam + (Number(p[istatistikTuru]) || 0.1), 0);
        let rastgele = Math.random() * toplamDeger;

        for (let p of filtrelenmis) {
            rastgele -= (Number(p[istatistikTuru]) || 0.1);
            if (rastgele <= 0) return p;
        }
        return filtrelenmis[0];
    }
    
    // Yardımcı: Rastgele Yedek (Aynı mevkiden bulmaya çalışır)
    yedekSec(kadro, cikacakMevki) {
        let ayniMevki = kadro.filter(p => p.TM_position === cikacakMevki);
        if (ayniMevki.length > 0) return ayniMevki[Math.floor(Math.random() * ayniMevki.length)];
        return kadro[Math.floor(Math.random() * kadro.length)];
    }
}

// --- 3. SOCKET BAĞLANTISI ---
io.on('connection', (socket) => {
    let takimIsimleri = [...new Set(tumOyuncular.map(p => p.Squad))].filter(Boolean);
    let evTakim = takimIsimleri[Math.floor(Math.random() * takimIsimleri.length)];
    let depTakim = takimIsimleri[Math.floor(Math.random() * takimIsimleri.length)];

    const mac = new MatchEngine(evTakim, depTakim, socket);
    mac.start();
});

server.listen(3000, () => console.log('Matematiksel Maç Motoru Aktif! Port: 3000'));