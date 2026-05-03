@echo off
chcp 65001 >nul
echo ========================================
echo 预加载 feibi 角色（中文角色 - 菲比）
echo ========================================
echo.
echo 注意：首次加载需要从 HuggingFace 下载数据（约 391MB）
echo 下载过程可能需要几分钟，请耐心等待...
echo.

cd /d "%~dp0"

python -c "import genie_tts as genie; print('正在加载 feibi 角色...'); genie.load_predefined_character('feibi'); print('✓ feibi 角色加载成功！')"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo ✓ 预加载完成！
    echo ========================================
    echo.
    echo 现在可以启动服务器，feibi 角色已准备就绪。
) else (
    echo.
    echo ========================================
    echo ✗ 预加载失败
    echo ========================================
    echo.
    echo 可能的原因：
    echo 1. 网络问题，无法下载数据
    echo 2. Genie-TTS 未正确安装
    echo 3. 需要手动确认下载
)

pause
