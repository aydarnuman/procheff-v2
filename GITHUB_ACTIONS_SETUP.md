# 🤖 GitHub Actions - Otomatik Deployment Kurulum Rehberi

**Süre:** 10 dakika
**Sonuç:** Her `git push` sonrası otomatik deployment

---

## 🎯 NE OLACAK?

```
Mac'te kod yaz
    ↓ git push
GitHub Actions tetiklenir
    ↓ otomatik SSH
Server'a bağlanır
    ↓ git pull
Kodu çeker
    ↓ docker restart
Container'ı yeniden başlatır
    ↓ health check
Başarılı mı kontrol eder
    ✅ DONE!
```

**Eski Workflow:**
```bash
git push
ssh root@161.35.217.113
cd /opt/procheff-v2
git pull
docker compose restart
exit
```
⏱️ **3-4 dakika**

**Yeni Workflow:**
```bash
git push
```
⏱️ **30 saniye** (otomatik!)

---

## ⚙️ KURULUM

### ADIM 1: Server'da SSH Key Oluştur (2 dk)

```bash
# Server'a bağlan
ssh root@161.35.217.113

# Yeni SSH key oluştur (şifre isterse ENTER bas - şifresiz)
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N ""

# Public key'i authorized_keys'e ekle
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Private key'i göster (KOPYALA!)
cat ~/.ssh/github_actions
```

**Çıktı şöyle olacak:**
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
(çok uzun bir key)
...
-----END OPENSSH PRIVATE KEY-----
```

**🔴 ÖNEMLİ:**
- `-----BEGIN` ile `-----END` arası HER ŞEYİ kopyala!
- Hiç boşluk eksiltme, hiç satır atlama!

---

### ADIM 2: GitHub'a Secret Ekle (3 dk)

1. **GitHub Repo'ya git:**
   ```
   https://github.com/aydarnuman/procheff-v2/settings/secrets/actions
   ```

2. **"New repository secret" tıkla**

3. **İlk Secret: SSH_PRIVATE_KEY**
   - Name: `SSH_PRIVATE_KEY`
   - Value: (yukarıda kopyaladığın tüm key)
   - "Add secret" tıkla

4. **İkinci Secret: SERVER_IP**
   - Name: `SERVER_IP`
   - Value: `161.35.217.113`
   - "Add secret" tıkla

**Sonuç:**
```
✅ SSH_PRIVATE_KEY
✅ SERVER_IP
```

---

### ADIM 3: Workflow'u Aktif Et (2 dk)

**Mac'te:**
```bash
cd /Users/numanaydar/Desktop/procheff-v2

# Yeni workflow dosyası zaten oluşturuldu
git add .github/workflows/deploy.yml
git add GITHUB_ACTIONS_SETUP.md
git commit -m "feat: GitHub Actions auto-deployment kuruldu"
git push
```

**GitHub Actions otomatik başlayacak!**

---

### ADIM 4: İlk Deployment'ı İzle (3 dk)

1. **GitHub'a git:**
   ```
   https://github.com/aydarnuman/procheff-v2/actions
   ```

2. **En üstteki workflow'a tıkla**
   - "feat: GitHub Actions auto-deployment kuruldu"

3. **"Deploy to DigitalOcean" tıkla**

4. **Logları izle:**
   ```
   🚀 Starting deployment...
   📦 Pulling latest code...
   🔄 Restarting Docker container...
   ⏳ Waiting for container to be ready...
   🏥 Health check...
   ✅ Deployment successful!
   ```

**Başarılı ise:** ✅ Yeşil tik
**Başarısız ise:** ❌ Kırmızı X (loglara bak)

---

## 🚀 ARTIK NASIL KULLANILIR?

### Her Kod Değişikliğinde:

```bash
# 1. Kod yaz
code src/app/page.tsx

# 2. Commit et
git add .
git commit -m "feat: Yeni özellik eklendi"

# 3. Push et
git push

# ✅ BITTI!
# GitHub Actions otomatik deploy eder
# 30 saniye sonra http://100.88.13.45:3000 güncellenir
```

**İzlemek için:**
```
https://github.com/aydarnuman/procheff-v2/actions
```

---

## 🔧 MANUEL DEPLOYMENT (Hala Çalışır)

Eğer GitHub Actions yerine manuel yapmak istersen:

```bash
ssh root@161.35.217.113 "cd /opt/procheff-v2 && git pull && docker compose restart"
```

Veya Actions'tan manuel tetikle:
```
https://github.com/aydarnuman/procheff-v2/actions/workflows/deploy.yml
→ "Run workflow" tıkla
```

---

## 📊 WORKFLOW DETAYLARI

### Ne Zaman Çalışır?

- ✅ `main` branch'e `git push` yapınca
- ✅ Manuel tetikleme (Actions sekmesinden)
- ❌ Pull request'lerde ÇALIŞMAZ (sadece merge sonrası)

### Ne Yapar?

1. **Checkout code:** GitHub'dan kodu alır
2. **SSH to server:** Server'a bağlanır
3. **Git pull:** En son kodu çeker
4. **Docker restart:** Container'ı yeniden başlatır
5. **Health check:** Çalışıyor mu kontrol eder
6. **Notify:** Başarılı/başarısız bildirir

### Süre:

- ⏱️ Ortalama: **30 saniye**
- 📦 Git pull: 5s
- 🔄 Docker restart: 10s
- 🏥 Health check: 5s
- 🎯 Total: 20-30s

---

## 🐛 SORUN GİDERME

### ❌ "Permission denied (publickey)"

**Sorun:** SSH key yanlış veya eksik

**Çözüm:**
```bash
# Server'da:
cat ~/.ssh/github_actions

# Tüm key'i yeniden kopyala
# GitHub Secret'ı güncelle
```

---

### ❌ "Health check failed"

**Sorun:** Container başlamadı

**Çözüm:**
```bash
# Server'da logları kontrol et:
ssh root@161.35.217.113
docker compose logs -f
```

---

### ❌ Workflow tetiklenmiyor

**Sorun:** Workflow dosyası hatalı

**Çözüm:**
```bash
# .github/workflows/deploy.yml kontrol et
# YAML syntax hatası olabilir
```

---

## 🔐 GÜVENLİK

### ✅ Ne Güvenli?

- SSH Private Key GitHub'da encrypted tutuluyor
- Sadece GitHub Actions erişebilir
- Server'da sadece deployment için kullanılır
- Log'larda asla görünmez

### ❌ Ne Yapma!

- SSH key'i commit etme (secret olarak ekle)
- Server IP'yi commit etme (secret olarak ekle)
- Workflow'u public yapma (zaten private)

---

## 📈 İLERİ SEVİYE

### Email Bildirimleri

Deployment sonuçlarını email'e almak istersen:

```yaml
- name: Send email on success
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    to: aydarnuman@gmail.com
    subject: ✅ ProCheff deployment başarılı
    body: Deployment tamamlandı - http://100.88.13.45:3000
```

### Slack Bildirimleri

```yaml
- name: Slack notification
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Deployment Environment

Farklı environment'lar için (staging, production):

```yaml
on:
  push:
    branches:
      - main         # production
      - staging      # staging server
```

---

## ✅ KONTROL LİSTESİ

Kurulum tamamlandı mı?

- [ ] Server'da SSH key oluşturuldu
- [ ] GitHub'a `SSH_PRIVATE_KEY` secret eklendi
- [ ] GitHub'a `SERVER_IP` secret eklendi
- [ ] Workflow dosyası push edildi
- [ ] İlk deployment başarılı oldu
- [ ] Health check geçti
- [ ] Site erişilebilir

**Hepsi ✅ ise TAMAM!**

---

## 🎉 BAŞARIYLA KURULDU!

**Artık workflow:**
```
git push → 30 saniye → ✅ Site güncellendi!
```

**İyi çalışmalar! 🚀**

---

*Son güncelleme: 8 Kasım 2025*
