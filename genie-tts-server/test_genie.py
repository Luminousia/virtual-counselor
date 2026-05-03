"""
测试 Genie-TTS 基本功能
"""
import sys
import os

# 修复编码问题
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

# 设置 Genie-TTS 数据目录（可选）
# 如果不设置，Genie-TTS 会使用默认位置
genie_data_dir = os.getenv('GENIE_DATA_DIR')
if not genie_data_dir:
    # 使用当前目录下的 genie_data 文件夹
    genie_data_dir = os.path.join(os.path.dirname(__file__), 'genie_data')
    os.makedirs(genie_data_dir, exist_ok=True)
    os.environ['GENIE_DATA_DIR'] = genie_data_dir
    print(f"设置 Genie-TTS 数据目录: {genie_data_dir}")

try:
    print("正在导入 Genie-TTS...")
    print("注意：如果首次运行，可能需要下载数据文件（约 391MB）")
    print("如果出现提示 'Would you like to download it automatically from HuggingFace? (y/N):'")
    print("请输入 y 并按回车确认下载\n")
    
    import genie_tts as genie
    print("✓ Genie-TTS 导入成功")
    
    # 测试加载角色
    print("\n测试加载角色 'mika'...")
    print("提示：如果首次运行，可能需要下载角色数据")
    try:
        genie.load_predefined_character('mika')
        print("✓ 角色加载成功")
    except Exception as e:
        print(f"✗ 角色加载失败: {e}")
        print("\n可能的原因：")
        print("1. 首次运行需要下载数据文件（约 391MB）")
        print("2. 网络连接问题")
        print("3. HuggingFace 访问问题")
        print("\n解决方法：")
        print("- 运行 交互式测试.bat 进行交互式下载")
        print("- 或运行 下载数据.bat 来手动下载数据")
        sys.exit(1)
    
    # 测试语音合成
    print("\n测试语音合成...")
    try:
        # 测试短文本
        test_text = "你好，这是一个测试。"
        print(f"文本: {test_text}")
        
        # 尝试生成语音（不播放）
        result = genie.tts(
            character_name='mika',
            text=test_text,
            play=False
        )
        
        print(f"✓ 语音合成成功")
        print(f"返回类型: {type(result)}")
        print(f"返回值: {result}")
        
        # 检查返回的是文件路径还是其他
        if isinstance(result, str):
            if os.path.exists(result):
                file_size = os.path.getsize(result)
                print(f"✓ 音频文件路径: {result}")
                print(f"✓ 文件大小: {file_size} bytes")
            else:
                print(f"⚠ 返回路径但文件不存在: {result}")
        elif isinstance(result, bytes):
            print(f"✓ 返回音频数据: {len(result)} bytes")
        else:
            print(f"⚠ 未知返回类型: {type(result)}")
            
    except Exception as e:
        print(f"✗ 语音合成失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    print("\n✓ 所有测试通过！")
    
except ImportError as e:
    print(f"✗ Genie-TTS 导入失败: {e}")
    print("  请安装: pip install genie-tts")
    sys.exit(1)
