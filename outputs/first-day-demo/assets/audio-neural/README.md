# 中文引导语音

本目录为首日学习 demo 的中文神经语音素材。默认音色为微软晓晓 `zh-CN-XiaoxiaoNeural`，语速 `-8%`，音高保持 `+0Hz`。相较于原有系统 Tingting，改用在线神经声音合成，并以轻微减速配合儿童听读。

合成时仅发送 `content.js` 中本项目原创的固定引导台词。App 播放本地 MP3，不需要连接在线语音服务、登录或提供 API 密钥。英文内容仍使用原有音频；原版中文 WAV 保留在 `../audio/`，可作对比和回退。

- `manifest.json`：`audio` 数组记录 `key`、原文、音色、语速、相对 App 根的路径、时长、字节数与 SHA-256。
- `[key].mp3`：完整中文引导，MP3、24 kHz、48 kbps、单声道。
- `yunxi/meet.mp3`：云希男声对比样音；并非完整男声语音包。

生成工具为独立虚拟环境中的 `edge-tts 7.3.1`。生成脚本位于工作区 `work/voice-upgrade/generate_neural.py`，支持 `voices`、`samples`、`all` 三种模式。它先导出 `SPEECH_LINES`，只筛选 `lang === 'zh-CN'`，再生成素材。

每个正式 MP3 均经 macOS `afconvert` 全文件解码，检查有效时长、非静音峰值和 RMS 后写入清单。没有以合成成功的进程状态代替音频验证。

来源与用法：[edge-tts 项目文档](https://github.com/rany2/edge-tts)。音色名称：[Microsoft 语音支持文档](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)。Edge 客户端仅支持其公开提供的基本语速、音量和音高控制，本版本未使用 Azure 专属情绪风格参数。
