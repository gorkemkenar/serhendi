# SİLİVRİ SERHENDİ – Tek Komutla Derleme ve Yayınlama Başlatıcı (Windows PowerShell)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "==> [1/4] Sanal ortam (.venv) kontrol ediliyor..." -ForegroundColor Cyan
if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    python -m venv .venv
    attrib +h ".venv"
    .\.venv\Scripts\pip.exe install -r backend\requirements.txt
}

Write-Host "==> [2/4] React arayüzü (frontend/dist) üretim için derleniyor..." -ForegroundColor Cyan
npm.cmd --prefix frontend run build

Write-Host "==> [3/4] Veritabanı migrasyonları ve statik dosyalar hazırlanıyor..." -ForegroundColor Cyan
.\.venv\Scripts\python.exe backend\manage.py migrate
.\.venv\Scripts\python.exe backend\manage.py collectstatic --noinput

Write-Host "==> [4/4] SİLİVRİ SERHENDİ Sunucusu başlatılıyor: http://127.0.0.1:8000" -ForegroundColor Green
.\.venv\Scripts\python.exe backend\manage.py runserver 0.0.0.0:8000 --insecure
