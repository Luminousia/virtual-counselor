# Genie-TTS 测试说明

## ⚠️ 重要提示

Genie-TTS 首次运行需要下载约 391MB 的数据文件。在非交互式环境中运行测试脚本会失败，因为需要用户确认下载。

## 测试方法

### 方法 1：使用交互式批处理文件（推荐）

双击运行 `交互式测试.bat`，当出现提示时：
```
Would you like to download it automatically from HuggingFace? (y/N):
```
输入 `y` 并按回车确认下载。

### 方法 2：手动下载数据

1. 运行 `下载数据.bat` 来初始化并下载数据
2. 然后运行 `测试Genie-TTS.bat` 进行测试

### 方法 3：在命令行中手动运行

```bash
cd genie-tts-server
python test_genie.py
```

当出现下载提示时，输入 `y` 确认。

## 测试内容

测试脚本会：
1. 导入 Genie-TTS 模块
2. 加载预定义角色 'mika'
3. 测试中文语音合成
4. 检查返回的音频数据格式

## 预期结果

如果测试成功，应该看到：
```
✓ Genie-TTS 导入成功
✓ 角色加载成功
✓ 语音合成成功
返回类型: <class 'str'> 或 <class 'bytes'>
✓ 所有测试通过！
```

## 如果测试失败

1. **导入失败**：确保已安装 `pip install genie-tts`
2. **角色加载失败**：需要先下载数据文件
3. **语音合成失败**：检查 Genie-TTS 的 API 文档

## 下一步

测试成功后，根据返回的数据格式调整 `server.py` 中的代码。
