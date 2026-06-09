DISCORDTOTO MANAGER - GITHUB PAGES SURUMU

Bu paket backend gerektirmez. GitHub Pages'e direkt atılabilir.

KURULUM:
1) Bu zip'i çıkar.
2) index.html, data klasörü ve manager_credentials.csv dosyasını GitHub repo köküne koy.
3) GitHub -> Settings -> Pages -> Deploy from branch -> main/root seç.
4) Site açılınca index.html data/*.json dosyalarını fetch ile okur.

ONEMLI:
- SQLite .db dosyası tarayıcıda doğrudan çalışmaz. Bu yüzden DB oyuncuları JSON'a çevrildi.
- Skor/kadro/admin atamaları için önce Firebase denenir. Firebase izin vermezse localStorage'a düşer.
- localStorage modu sadece o bilgisayarda görünür. Herkesin aynı veriyi görmesi için Firebase Realtime Database kuralları yazmaya izin vermeli veya gerçek backend kullanılmalı.
- users_demo.json ve manager_credentials.csv sadece prototip içindir. Public GitHub repo'da gerçek şifre tutulmaz. Gerçek yayın için Firebase Auth / Supabase Auth / backend gerekir.

ADMIN DEMO:
username: admin
password: admin2027

Takım menajer kullanıcıları manager_credentials.csv içinde.
