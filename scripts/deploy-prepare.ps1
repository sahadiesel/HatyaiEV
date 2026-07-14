# เตรียมสภาพแวดล้อมก่อน deploy Firebase (Windows / corporate SSL)
# ใช้: npm run deploy:prepare  หรือเรียกก่อน deploy:rules / deploy:firestore

Remove-Item Env:NODE_EXTRA_CA_CERTS -ErrorAction SilentlyContinue
Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue
$env:NODE_OPTIONS = "--use-system-ca"

Write-Host "NODE_OPTIONS=$env:NODE_OPTIONS"
Write-Host "พร้อม deploy — ตัวอย่าง: npm run deploy:firestore"
