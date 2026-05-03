# 资源文件目录

此目录包含应用的资源文件。

## 目录结构

```
resources/
├── icons/           # 应用图标
│   ├── icon.ico     # Windows图标
│   ├── icon.icns    # macOS图标
│   ├── icon.png     # Linux图标
│   ├── install.ico  # 安装程序图标
│   ├── uninstall.ico# 卸载程序图标
│   ├── tray.png     # 托盘图标
│   └── tray-speaking.png # 说话时托盘图标
└── images/          # 图片资源
    ├── dmg-background.png  # DMG背景图
    └── nsis-header.bmp     # NSIS安装界面头部
```

## 图标要求

### Windows (icon.ico)
- 尺寸: 256x256 像素
- 格式: ICO
- 包含尺寸: 16, 32, 48, 256

### macOS (icon.icns)
- 尺寸: 1024x1024 像素 (Retina)
- 格式: ICNS
- 包含尺寸: 16, 32, 64, 128, 256, 512, 1024

### Linux (icon.png)
- 尺寸: 256x256 像素
- 格式: PNG

## 注意事项

1. 图标文件需要使用专业设计工具创建
2. 建议使用品牌色 #ff7043 (珊瑚橙)
3. 图标应简洁明了，易于识别
