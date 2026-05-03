@echo off
chcp 65001 >nul
echo ========================================
echo Genie-TTS 数据下载
echo ========================================
echo.
echo Genie-TTS 首次运行需要下载约 391MB 的数据文件
echo 这将自动下载到默认位置
echo.
echo 按任意键开始下载...
pause >nul
echo.

cd /d "%~dp0"

echo 正在初始化 Genie-TTS（将自动下载数据）...
python -c "import genie_tts as genie; genie.load_predefined_character('mika'); print('✓ 数据下载完成')"

if %errorlevel% equ 0 (
    echo.
    echo [OK] Genie-TTS 数据下载成功！
) else (
    echo.
    echo [X] 数据下载失败，请检查网络连接
)

pause
