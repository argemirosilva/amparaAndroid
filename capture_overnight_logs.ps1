# Script para capturar logs do Ampara durante a noite
# Uso: .\capture_overnight_logs.ps1

$ADB_PATH = "C:\Users\Argemiro\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$LOG_DIR = ".\overnight_logs"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$LOG_FILE = "$LOG_DIR\ampara_debug_$TIMESTAMP.txt"

# Criar diretório de logs
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR | Out-Null
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   AMPARA - Captura de Logs Noturna" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Arquivo de log: $LOG_FILE" -ForegroundColor Green
Write-Host "Iniciado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
Write-Host ""
Write-Host "Monitorando:" -ForegroundColor Yellow
Write-Host "  - Pings nativos (GPS + sessão)" -ForegroundColor White
Write-Host "  - Renovação de sessão (401 -> refresh)" -ForegroundColor White
Write-Host "  - AudioTrigger (monitoramento)" -ForegroundColor White
Write-Host "  - AudioFocus (WhatsApp, chamadas)" -ForegroundColor White
Write-Host ""
Write-Host "Pressione Ctrl+C para parar" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Limpar logs antigos do dispositivo
& $ADB_PATH logcat -c

# Capturar logs filtrados
& $ADB_PATH logcat -s `
    "KeepAliveService:*" `
    "KeepAlivePlugin:*" `
    "KeepAliveAlarmReceiver:*" `
    "SessionExpiredListener:*" `
    "AudioTriggerService:*" `
    "AudioTriggerPlugin:*" `
    "Capacitor/Console:*" | Tee-Object -FilePath $LOG_FILE

Write-Host ""
Write-Host "Log salvo em: $LOG_FILE" -ForegroundColor Green
