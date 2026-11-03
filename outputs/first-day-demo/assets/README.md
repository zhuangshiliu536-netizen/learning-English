# Demo 资产说明

## 基础图标

- 来源：Tabler Icons 官方仓库，https://github.com/tabler/tabler-icons。
- 文件：`icons/[name].svg`，保持官方源文件内容。
- 许可：MIT，完整声明见 `TABLER-LICENSE.txt`。
- 下载日期与每个文件的原始 URL、SHA-256 见 `icon-manifest.json`。
- 本次使用标准线性图标表达角色与食物，仅用于低保真流程体验，不代表正式角色或美术设计。

## 原版 WAV 音频

- 文本来源：本项目 `content.js` 导出的 `SPEECH_LINES`。
- 工具：本机已安装的 macOS `say` 与 `afconvert`；未调用外部语音服务。
- 英语：Samantha；中文：Tingting。
- 格式：22,050 Hz、16-bit PCM WAV。
- 文件：`audio/[speech key].wav`。
- 台词、语音、速度、时长与摘要见 `audio-manifest.json`。
- 不包含用户麦克风录音；系统合成音仅为 Demo 伴读与操作引导。

更新台词后可运行工作目录中的 `generate_demo_audio.py` 重新生成，并校验有效音频帧。生成脚本写本地音频文件，不主动播放或上传。

## 中文引导升级

0.3.4 新增 `audio-neural/`：33 条晓晓神经女声 MP3 及 manifest，默认用于中文引导；原有中文 WAV 保留作对比与回退。英文保持原声。来源与验证详见该目录 README。

