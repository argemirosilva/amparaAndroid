# Script para capturar APENAS logs de Ping e Sessão
# Uso: .\capture_ping_session_logs.ps1

$ADB_PATH = "C:\Users\Argemiro\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$LOG_DIR = ".\overnight_logs"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$LOG_FILE = "$LOG_DIR\ping_session_$TIMESTAMP.txt"

# Criar diretório de logs
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR | Out-Null
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   AMPARA - Logs de Ping e Sessão" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Arquivo de log: $LOG_FILE" -ForegroundColor Green
Write-Host "Iniciado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
Write-Host ""
Write-Host "Monitorando:" -ForegroundColor Yellow
Write-Host "  - Pings nativos (a cada 30s)" -ForegroundColor White
Write-Host "  - GPS (latitude, longitude)" -ForegroundColor White
Write-Host "  - Resposta do servidor (200/401)" -ForegroundColor White
Write-Host "  - Renovação de token (refresh)" -ForegroundColor White
Write-Host ""
Write-Host "SEM logs de AudioTrigger (limpo)" -ForegroundColor Green
Write-Host ""
Write-Host "Pressione Ctrl+C para parar" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Limpar logs antigos do dispositivo
& $ADB_PATH logcat -c

# Capturar APENAS logs de ping e sessão (SEM AudioTrigger)
& $ADB_PATH logcat -s `
    "KeepAliveService:*" `
    "KeepAlivePlugin:*" `
    "KeepAliveAlarmReceiver:*" `
    "SessionExpiredListener:*" `
    "Capacitor/Console:*" | Select-String -Pattern "Ping|ping|GPS|location|latitude|longitude|Token|token|Session|session|401|refresh|Refresh|KeepAlive" | Tee-Object -FilePath $LOG_FILE

Write-Host ""
Write-Host "Log salvo em: $LOG_FILE" -ForegroundColor Green
