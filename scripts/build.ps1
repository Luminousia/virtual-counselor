#!/usr/bin/env pwsh
# PowerShell 构建脚本 - 虚拟心理咨询师

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  虚拟心理咨询师 - 桌面应用构建脚本" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 函数：打印信息
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] " -NoNewline -ForegroundColor Blue
    Write-Host $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] " -NoNewline -ForegroundColor Green
    Write-Host $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] " -NoNewline -ForegroundColor Yellow
    Write-Host $Message
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] " -NoNewline -ForegroundColor Red
    Write-Host $Message
}

# 检查Node.js版本
function Test-Node {
    Write-Info "检查 Node.js 版本..."
    try {
        $nodeVersion = node --version
        Write-Success "Node.js 版本: $nodeVersion"
    } catch {
        Write-Error "未安装 Node.js，请先安装 Node.js 18+"
        exit 1
    }
}

# 安装依赖
function Install-Dependencies {
    Write-Info "安装项目依赖..."
    npm install
    Write-Success "依赖安装完成"
}

# 开发模式
function Start-DevMode {
    Write-Info "启动开发模式..."
    Write-Host "请选择运行模式:" -ForegroundColor White
    Write-Host "  1. Web 开发模式 (npm run dev)"
    Write-Host "  2. Electron 开发模式 (npm run dev:electron)"
    $choice = Read-Host "请输入选项 (1/2)"
    
    switch ($choice) {
        "1" { npm run dev }
        "2" { npm run dev:electron }
        default { 
            Write-Error "无效选项"
            exit 1 
        }
    }
}

# 构建应用
function Build-App {
    Write-Info "开始构建应用..."
    
    Write-Info "1. 构建前端..."
    npm run build
    
    Write-Info "2. 构建 Electron..."
    npm run build:electron
    
    Write-Success "构建完成！"
    Write-Info "构建产物位于: release/"
}

# 构建安装包
function Build-Installer {
    Write-Info "构建安装包..."
    
    Write-Host "请选择目标平台:" -ForegroundColor White
    Write-Host "  1. Windows (NSIS)"
    Write-Host "  2. macOS (DMG)"
    Write-Host "  3. Linux (AppImage)"
    Write-Host "  4. 所有平台"
    $choice = Read-Host "请输入选项 (1-4)"
    
    switch ($choice) {
        "1" { npm run build:installer -- --win }
        "2" { npm run build:installer -- --mac }
        "3" { npm run build:installer -- --linux }
        "4" { npm run build:installer }
        default { 
            Write-Error "无效选项"
            exit 1 
        }
    }
    
    Write-Success "安装包构建完成！"
    Write-Info "安装包位于: release/"
}

# 运行测试
function Run-Test {
    Write-Info "运行测试..."
    npx electron electron/test-electron.js
}

# 显示帮助
function Show-Help {
    Write-Host ""
    Write-Host "用法: .\build.ps1 [命令]" -ForegroundColor White
    Write-Host ""
    Write-Host "可用命令:" -ForegroundColor White
    Write-Host "  dev         启动开发模式"
    Write-Host "  build       构建应用"
    Write-Host "  installer   构建安装包"
    Write-Host "  test        运行测试"
    Write-Host "  help        显示帮助"
    Write-Host ""
    Write-Host "示例:" -ForegroundColor White
    Write-Host "  .\build.ps1 dev          # 启动开发模式"
    Write-Host "  .\build.ps1 build        # 构建应用"
    Write-Host "  .\build.ps1 installer    # 构建安装包"
}

# 主程序
$command = $args[0]

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  虚拟心理咨询师 - 桌面应用" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 检查Node.js
Test-Node

switch ($command) {
    "dev" { Start-DevMode }
    "build" { Build-App }
    "installer" { Build-Installer }
    "test" { Run-Test }
    "help" { Show-Help }
    "" { Show-Help }
    default { 
        Write-Error "未知命令: $command"
        Show-Help
        exit 1 
    }
}
