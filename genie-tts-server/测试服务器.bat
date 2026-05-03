@echo off
chcp 65001 >nul
echo ========================================
echo 测试 Genie-TTS 服务器
echo ========================================
echo.

cd /d "%~dp0"

echo [1] 检查服务器是否运行...
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo [X] 服务器未运行
    echo     请先运行: python server.py
    pause
    exit /b 1
)
echo [OK] 服务器正在运行
echo.

echo [2] 测试健康检查接口...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 3; Write-Host '[OK] 服务器响应正常'; Write-Host $response.Content } catch { Write-Host '[X] 无法连接到服务器:' $_.Exception.Message }"
echo.

echo [3] 测试 TTS 接口...
powershell -Command "$body = @{text='你好，这是一个测试';character='mika';language='zh-CN'} | ConvertTo-Json; try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/v1/audio/speech' -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing -TimeoutSec 30; Write-Host '[OK] TTS 请求成功'; Write-Host '音频大小:' $response.Content.Length 'bytes' } catch { Write-Host '[X] TTS 请求失败:' $_.Exception.Message }"
echo.

pause
