@echo off
chcp 65001 >nul
echo ========================================
echo 测试 Genie-TTS
echo ========================================
echo.

cd /d "%~dp0"

echo 注意：如果首次运行，Genie-TTS 需要下载数据文件（约 391MB）
echo 如果出现提示，请输入 y 确认下载
echo.

python test_genie.py

pause
