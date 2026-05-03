@echo off
chcp 65001 >nul
echo ========================================
echo Genie-TTS 交互式测试
echo ========================================
echo.
echo 注意：首次运行需要下载数据文件（约 391MB）
echo 如果出现提示 "Would you like to download it automatically from HuggingFace? (y/N):"
echo 请输入 y 并按回车确认下载
echo.
echo 按任意键开始测试...
pause >nul
echo.

cd /d "%~dp0"

python test_genie.py

echo.
echo ========================================
echo 测试完成
echo ========================================
pause
