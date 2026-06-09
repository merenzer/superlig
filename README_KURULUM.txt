DiscordToto Manager V6 + Taktik Merkezi Kurulum

1) Eski index.html dosyanı yedekle: index-v6-eski.html gibi.
2) Bu zip içindeki discordtoto_manager_v6.html dosyasının adını index.html yap.
3) index.html ile discordtoto_rosters_from_db_v6.js aynı klasörde olsun.
4) LOGOCUK.png ve LOGOS klasörün aynı yerde kalmalı.

Klasör örneği:
site-klasörü/
  index.html
  discordtoto_rosters_from_db_v6.js
  LOGOCUK.png
  LOGOS/

Bu sürümde eklenenler:
- Üst menüye TAKTİK sekmesi eklendi.
- Menajer hesabına göre takım bazlı Taktik Merkezi açılır.
- Tempo, pres, savunma çizgisi, hücum genişliği, dikeylik, risk ve pas tarzı ayarlanabilir.
- Dengeli / Önde Bas / Kontra presetleri Firebase'e kaydedilir.
- Taktik verisi Firebase'de teamTactics/<takim_key> yoluna yazılır.
- DB verisi hâlâ HTML içine gömülü değildir; roster ayrı JS dosyasından okunur.

Not:
- .js dosyasını tek başına indirmekte sorun çıkarsa bu zip'i indirip klasöre çıkar.
- Sonraki DB değişimlerinde sadece discordtoto_rosters_from_db_v6.js dosyasını yenilemek yeterli olur.
- Sıradaki aşamada 2D Maç Merkezi bu taktik değerlerini okuyacak şekilde bağlanabilir.
