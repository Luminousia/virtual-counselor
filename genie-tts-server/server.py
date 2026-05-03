"""
Genie-TTS FastAPI 服务器
提供 HTTP API 用于文本转语音
"""
import genie_tts as genie
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import os
import sys
from typing import Optional

# 修复 Windows 控制台编码问题
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

app = FastAPI(title="Genie-TTS API", version="1.0.0")

# 配置 CORS（允许前端跨域请求）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境允许所有来源
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# 全局变量
loaded_characters = {}
GENIE_AVAILABLE = False

# 尝试导入 Genie-TTS
try:
    GENIE_AVAILABLE = True
    print("✓ Genie-TTS 模块已导入")
except ImportError as e:
    GENIE_AVAILABLE = False
    print(f"⚠ 警告: Genie-TTS 未安装: {e}")
    print("   请安装: pip install genie-tts")

class TTSRequest(BaseModel):
    text: str
    character: str = "feibi"  # 默认角色（中文角色 - 菲比）
    voice: str = None  # 兼容旧字段名
    language: str = "zh-CN"
    speed: float = 1.0  # 语速（如果支持）

@app.on_event("startup")
async def startup_event():
    """启动时加载默认角色"""
    if not GENIE_AVAILABLE:
        print("⚠ Genie-TTS 不可用，服务器将无法处理请求")
        return
    
    try:
        # 加载默认角色（使用中文角色 feibi）
        default_character = os.getenv("GENIE_DEFAULT_CHARACTER", "feibi")
        print(f"正在加载默认角色: {default_character} (中文角色 - 菲比)...")
        
        # 注意：Genie-TTS 首次运行可能需要下载数据
        genie.load_predefined_character(default_character)
        loaded_characters[default_character] = True
        print(f"✓ 已加载角色: {default_character}")
    except Exception as e:
        print(f"⚠ 加载默认角色失败: {e}")
        print("   首次运行可能需要下载数据文件（约 391MB）")
        print("   请手动运行一次 Genie-TTS 以下载数据")

@app.get("/")
async def root():
    return {
        "message": "Genie-TTS API Server",
        "version": "1.0.0",
        "status": "ready" if GENIE_AVAILABLE else "not_ready",
        "genie_available": GENIE_AVAILABLE
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy" if GENIE_AVAILABLE else "unhealthy",
        "genie_available": GENIE_AVAILABLE,
        "loaded_characters": list(loaded_characters.keys())
    }

@app.get("/characters")
async def list_characters():
    """列出可用的角色"""
    # Genie-TTS 的预定义角色列表
    # 需要根据实际文档确认
    # Genie-TTS 预定义角色列表（从 PredefinedCharacter.py 获取）
    known_characters = ["mika", "feibi", "thirtyseven"]  # mika: 日文, feibi: 中文(菲比), thirtyseven: 英文
    return {
        "characters": known_characters,
        "loaded": list(loaded_characters.keys()),
        "default": "feibi"  # 默认使用中文角色菲比
    }

@app.post("/v1/audio/speech")
async def synthesize_speech(request: TTSRequest):
    """
    文本转语音
    
    Args:
        request: TTS 请求，包含文本、角色等参数
    
    Returns:
        音频数据（WAV 格式）
    """
    if not GENIE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Genie-TTS 模块未安装或不可用。请安装: pip install genie-tts"
        )
    
    try:
        # 兼容 voice 字段（如果提供了 voice 但 character 是默认值，使用 voice）
        character = request.character
        if request.voice and request.voice != "default" and request.character == "feibi":
            character = request.voice
            print(f"[TTS请求] 使用 voice 字段: {character}")
        
        print(f"[TTS请求] 文本: {request.text[:50]}...")
        print(f"[TTS请求] 角色: {character}")
        print(f"[TTS请求] 语言: {request.language}")
        
        # 检查角色是否已加载
        if character not in loaded_characters:
            try:
                print(f"正在加载角色: {character}...")
                print(f"⚠ 注意：首次加载 {character} 角色可能需要下载数据（约 391MB），请耐心等待...")
                genie.load_predefined_character(character)
                loaded_characters[character] = True
                print(f"✓ 已加载角色: {character}")
            except Exception as e:
                print(f"⚠ 加载角色失败: {e}")
                # 如果加载失败，尝试使用默认角色 feibi
                if character != "feibi":
                    print(f"尝试使用默认角色: feibi")
                    character = "feibi"
                    if character not in loaded_characters:
                        try:
                            genie.load_predefined_character(character)
                            loaded_characters[character] = True
                            print(f"✓ 已加载默认角色: {character}")
                        except Exception as e2:
                            raise HTTPException(
                                status_code=400,
                                detail=f"无法加载角色 '{character}': {str(e2)}"
                            )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"无法加载角色 '{character}': {str(e)}"
                    )
        
        # 生成语音
        # Genie-TTS 的 tts() 方法可能返回文件路径或字节数据
        try:
            import tempfile
            
            # 创建临时文件路径
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                temp_audio_path = tmp_file.name
            
            print(f"[TTS] 临时文件路径: {temp_audio_path}")
            print(f"[TTS] 调用 genie.tts()...")
            
            # 尝试不同的调用方式
            try:
                # 方式1：尝试使用 save_path 参数
                result = genie.tts(
                    character_name=character,
                    text=request.text,
                    play=False,
                    save_path=temp_audio_path
                )
                print(f"[TTS] genie.tts() 返回类型: {type(result)}, 值: {result}")
            except TypeError as e:
                # 如果 save_path 不支持，尝试不使用
                print(f"[TTS] save_path 参数不支持，尝试不使用: {e}")
                result = genie.tts(
                    character_name=character,
                    text=request.text,
                    play=False
                )
                print(f"[TTS] genie.tts() 返回类型: {type(result)}, 值: {result}")
            
            audio_bytes = None
            
            # 优先检查临时文件是否存在（如果 save_path 生效）
            if os.path.exists(temp_audio_path):
                file_size = os.path.getsize(temp_audio_path)
                if file_size > 0:
                    print(f"[TTS] 从临时文件读取: {temp_audio_path}, 大小: {file_size} bytes")
                    with open(temp_audio_path, 'rb') as f:
                        audio_bytes = f.read()
                    # 删除临时文件
                    try:
                        os.unlink(temp_audio_path)
                    except:
                        pass
            
            # 如果临时文件不存在或为空，检查返回值
            if not audio_bytes or len(audio_bytes) == 0:
                if isinstance(result, str):
                    # 返回的是文件路径
                    if os.path.exists(result):
                        file_size = os.path.getsize(result)
                        print(f"[TTS] 从返回路径读取: {result}, 大小: {file_size} bytes")
                        with open(result, 'rb') as f:
                            audio_bytes = f.read()
                    else:
                        raise HTTPException(
                            status_code=500,
                            detail=f"返回的文件路径不存在: {result}"
                        )
                elif isinstance(result, bytes):
                    # 直接返回字节数据
                    print(f"[TTS] 使用返回的字节数据: {len(result)} bytes")
                    audio_bytes = result
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"无法获取音频数据，返回类型: {type(result)}, 值: {result}"
                    )
            
            if not audio_bytes or len(audio_bytes) == 0:
                raise HTTPException(
                    status_code=500,
                    detail="音频数据为空"
                )
            
            print(f"[TTS成功] 音频大小: {len(audio_bytes)} bytes")
            
            return Response(
                content=audio_bytes,
                media_type="audio/wav",
                headers={
                    "Content-Disposition": "attachment; filename=speech.wav"
                }
            )
        except Exception as e:
            print(f"[TTS错误] 生成语音失败: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail=f"语音合成失败: {str(e)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[错误] {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    print(f"启动 Genie-TTS 服务器，端口: {port}")
    print(f"API 文档: http://localhost:{port}/docs")
    uvicorn.run(app, host="0.0.0.0", port=port)
