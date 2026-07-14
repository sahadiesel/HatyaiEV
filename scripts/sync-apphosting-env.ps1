# อ่าน .env.local แล้วอัปเดต Secret สำหรับ Firebase App Hosting (API key)
# รันจาก root โปรเจกต์: npm run apphosting:sync-env

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envFile = Join-Path $root ".env.local"
if (-not (Test-Path $envFile)) {
  Write-Error "ไม่พบ .env.local — คัดลอกจาก .env.local.example แล้วใส่ค่า Firebase"
}

function Get-EnvValue([string]$key) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*$key\s*=\s*(.+)\s*$") {
      return $matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

$apiKey = Get-EnvValue "NEXT_PUBLIC_FIREBASE_API_KEY"
if (-not $apiKey) {
  Write-Error "ไม่พบ NEXT_PUBLIC_FIREBASE_API_KEY ใน .env.local"
}

$tmp = New-TemporaryFile
try {
  Set-Content -Path $tmp.FullName -Value $apiKey -NoNewline -Encoding utf8
  Write-Host "ตั้งค่า secret hyevFirebaseApiKey ..."
  echo Y | firebase apphosting:secrets:set hyevFirebaseApiKey --data-file $tmp.FullName --force --project auto-repair-management --non-interactive
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  firebase apphosting:secrets:grantaccess hyevFirebaseApiKey --backend evbackend --project auto-repair-management --non-interactive
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "OK - commit and push apphosting.yaml then wait for App Hosting rollout"
} finally {
  Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue
}
