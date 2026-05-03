# Genie-TTS 服务器

Genie-TTS FastAPI 服务器，提供 HTTP API 用于文本转语音。

## 安装

```bash
# 安装依赖
pip install -r requirements.txt
```

或者直接安装：
```bash
pip install genie-tts fastapi uvicorn
```

## 启动服务器

```bash
python server.py
```

服务器将在 `http://localhost:8000` 启动。

## API 接口

### 健康检查
```
GET /health
```

### 文本转语音
```
POST /v1/audio/speech
Content-Type: application/json

{
  "text": "你好，这是一个测试。",
  "character": "mika",
  "language": "zh-CN",
  "speed": 1.0
}
```

### 列出可用角色
```
GET /characters
```

## 配置

### 环境变量
- `PORT`: 服务器端口（默认：8000）
- `GENIE_DEFAULT_CHARACTER`: 默认角色（默认：mika）

## 注意事项

1. **首次运行**：Genie-TTS 首次运行需要下载约 391MB 的数据文件
2. **角色加载**：角色会在首次使用时自动加载
3. **编码问题**：Windows 控制台可能有编码问题，但不影响功能

## 故障排查

### 问题：无法导入 Genie-TTS
**解决**：确保已安装 `pip install genie-tts`

### 问题：角色加载失败
**解决**：首次运行需要下载数据，请耐心等待或手动下载

### 问题：音频生成失败
**解决**：检查 Genie-TTS 的 API 文档，确认 `genie.tts()` 的返回格式
