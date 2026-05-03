#!/bin/bash
# 项目构建和运行脚本

echo "======================================"
echo "  虚拟心理咨询师 - 桌面应用构建脚本"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函数：打印彩色信息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Node.js版本
check_node() {
    print_info "检查 Node.js 版本..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js 版本: $NODE_VERSION"
    else
        print_error "未安装 Node.js，请先安装 Node.js 18+"
        exit 1
    fi
}

# 安装依赖
install_dependencies() {
    print_info "安装项目依赖..."
    npm install
    print_success "依赖安装完成"
}

# 开发模式
dev_mode() {
    print_info "启动开发模式..."
    print_info "请选择运行模式:"
    echo "  1. Web 开发模式 (npm run dev)"
    echo "  2. Electron 开发模式 (npm run dev:electron)"
    read -p "请输入选项 (1/2): " choice
    
    case $choice in
        1)
            npm run dev
            ;;
        2)
            npm run dev:electron
            ;;
        *)
            print_error "无效选项"
            exit 1
            ;;
    esac
}

# 构建应用
build_app() {
    print_info "开始构建应用..."
    
    print_info "1. 构建前端..."
    npm run build
    
    print_info "2. 构建 Electron..."
    npm run build:electron
    
    print_success "构建完成！"
    print_info "构建产物位于: release/"
}

# 构建安装包
build_installer() {
    print_info "构建安装包..."
    
    echo "请选择目标平台:"
    echo "  1. Windows (NSIS)"
    echo "  2. macOS (DMG)"
    echo "  3. Linux (AppImage)"
    echo "  4. 所有平台"
    read -p "请输入选项 (1-4): " choice
    
    case $choice in
        1)
            npm run build:installer -- --win
            ;;
        2)
            npm run build:installer -- --mac
            ;;
        3)
            npm run build:installer -- --linux
            ;;
        4)
            npm run build:installer
            ;;
        *)
            print_error "无效选项"
            exit 1
            ;;
    esac
    
    print_success "安装包构建完成！"
    print_info "安装包位于: release/"
}

# 运行测试
run_test() {
    print_info "运行测试..."
    npx electron electron/test-electron.js
}

# 显示帮助
show_help() {
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "可用命令:"
    echo "  dev         启动开发模式"
    echo "  build       构建应用"
    echo "  installer   构建安装包"
    echo "  test        运行测试"
    echo "  help        显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 dev          # 启动开发模式"
    echo "  $0 build        # 构建应用"
    echo "  $0 installer    # 构建安装包"
}

# 主程序
main() {
    echo "======================================"
    echo "  虚拟心理咨询师 - 桌面应用"
    echo "======================================"
    echo ""
    
    # 检查Node.js
    check_node
    
    case "${1:-}" in
        dev)
            dev_mode
            ;;
        build)
            build_app
            ;;
        installer)
            build_installer
            ;;
        test)
            run_test
            ;;
        help|--help|-h)
            show_help
            ;;
        "")
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
