# เริ่ม dev server — หยุด process เก่าที่ port 3002, ล้าง .next, แล้ว start (แบบ saha_new)
param(
  [int]$Port = 3002
)

Set-Location $PSScriptRoot\..

$connections = netstat -ano | Select-String ":$Port\s"
foreach ($line in $connections) {
  if ($line -match '\s(\d+)\s*$') {
    $procId = [int]$Matches[1]
    if ($procId -gt 0) {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}
Start-Sleep -Seconds 2

if (Test-Path .next) {
  Remove-Item -Recurse -Force .next
}

Write-Host "Starting Next.js on http://localhost:$Port"
npx next dev -p $Port
