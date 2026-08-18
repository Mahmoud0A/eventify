# Eventify API tester
$base = "http://localhost:3000"

Write-Host "=== GET /health ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/health" -Method GET | ConvertTo-Json

Write-Host "`n=== GET /events ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/events" -Method GET | ConvertTo-Json -Depth 5

Write-Host "`n=== POST /v1/bookings (create) ===" -ForegroundColor Cyan
$body = '{"eventId":"cf36828c-2433-480d-9ae4-4b23fff41250"}'
try {
  $r = Invoke-WebRequest -Uri "$base/v1/bookings" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
  Write-Host "Status: $($r.StatusCode)" -ForegroundColor Green
  Write-Host "Body: $($r.Content)"
} catch {
  Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
  Write-Host "Body: $($_.Exception.Message)"
}

Write-Host "`n=== GET /v1/bookings (list all) ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/v1/bookings" -Method GET | ConvertTo-Json -Depth 5