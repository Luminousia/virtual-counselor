@echo off
chcp 65001 >nul
echo ========================================
echo 启动 Genie-TTS 服务器
echo ========================================
echo.

cd /d "%~dp0"

echo [1] 检查 Python...
python --version
if %errorlevel% neq 0 (
    echo [X] Python 未安装
    pause
    exit /b 1
)
echo.

echo [2] 检查 Genie-TTS...
python -c "import genie_tts; print('[OK] Genie-TTS 已安装')" 2>nul
if %errorlevel% neq 0 (
    echo [!] Genie-TTS 未安装，正在安装...
    pip install genie-tts fastapi uvicorn
    if %errorlevel% neq 0 (
        echo [X] 安装失败
        pause
        exit /b 1
    )
)
echo.

echo [3] 检查端口 8000...
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo [!] 端口 8000 已被占用
    echo     请先停止占用该端口的程序
    pause
    exit /b 1
)
echo [OK] 端口 8000 可用
echo.

echo ========================================
echo 启动服务器...
echo ========================================
echo.
echo 服务器将在 http://localhost:8000 启动
echo API 文档: http://localhost:8000/docs
echo 按 Ctrl+C 停止服务器
echo.

python server.py

pause
