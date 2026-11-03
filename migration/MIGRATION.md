# GitHub 迁移说明

日期：2026-11-03。目标：[`zhuangshiliu536-netizen/learning-English`](https://github.com/zhuangshiliu536-netizen/learning-English)，主分支 `main`。项目版本仍为 0.4.8，本次迁移不改变原应用行为。

## 原始清点与保留策略

迁移开始时，项目根目录只有 `outputs/` 和 `work/`，没有 `.git`、项目忽略文件、嵌套仓库，也没有已配置的 Git 全局 `core.excludesfile`。因此不存在可迁移的本地提交历史；全部当前源码及尚未提交的内容以初始快照保存。远端经 GitHub 元数据及 `git ls-remote` 核实为空，采用初始化 `main` 后普通推送，不强制覆盖历史。

| 原始范围 | 项数 | 字节 | 处理 |
| --- | ---: | ---: | --- |
| 全部普通文件 | 1,599 | 72,364,752 | 已逐项清点 |
| 需保留的普通文件 | 344 | 54,514,868 | 原样纳入 Git，逐字节 SHA-256 核对 |
| 虚拟环境与 Python 缓存普通文件 | 1,255 | 17,849,884 | 留在原本机，不提交 |
| Python 环境软链接 | 3 | — | 位于 venv/bin，留在原本机，不提交 |

[完整原始清单](original-file-inventory.json) 包含每个文件路径、大小、SHA-256、可执行位、保留/排除决定，以及软链接目标。清点不限于默认 `rg --files` 输出，因此包含环境目录和缓存。被排除的文件没有从原本机删除。

保留内容包括应用源码、运行素材、AIFF 原始音频、声音样本、产品与设计文档、参考截图、历史视觉方案、生成记录、测试、一次性修改脚本、旧 JS/CSS 快照和完整 Demo ZIP。**没有忽略整个 `work/`，也没有只上传最终网页。**

额外恢复了 `work/first_day_visual_options.json` 引用的三张项目外生成原图，复制到 `outputs/historical-visual-options/option-1.png` 至 `option-3.png`；逐字节核对后记录在 [恢复素材清单](imported-historical-assets.json)。它们是未选用的历史候选，当前 UI 仍以 0.4.8 实装与现行设计规范为准。历史 JSON 和其他原文件不改写，原绝对路径作为来源证据保留。

## 忽略项检查

新增的根目录 `.gitignore` 只用于可重建环境、缓存、机器/编辑器文件和凭据。实际被忽略的原始内容只有 `work/voice-upgrade/venv/` 和 `work/voice-upgrade/__pycache__/`：

- venv 为 macOS/Python 3.12 本机环境，含平台二进制及指向本机 Python 的三个软链接，不能直接用于 Linux 云端；依赖已由原始 `requirements.txt` 保留。
- venv 中两份 `cacert.pem` 是 certifi 公共 CA 证书，不是私钥；随第三方环境排除。
- Python 字节码为缓存，不包含独有项目源码。
- 无忽略的产品源码、素材、文档、生成脚本或原始音频。

核对命令：

```sh
git status --short --ignored
git ls-files --others --ignored --exclude-standard
```

当前的 `.env*`、私钥扩展名与凭据文件规则用于避免今后误提交；本次原始项目没有这些凭据文件。不要把 API 密钥写入前端、文档、示例 URL 或仓库。当前 App 启动不需要 API 密钥。

## 安全检查

扫描范围为待提交文件，以及 Demo ZIP 内全部 224 个文件；规则覆盖私钥头、常见 GitHub/OpenAI/AWS/Google/Slack 令牌、带凭据 URL 和字面量 secret 赋值。复核未发现有效密钥；通用关键词中的 `audioToken` 为取消播放的本地计数，不是凭据。扫描只记录路径/规则/位置，不打印任何候选值。

重复检查：

```sh
python3 scripts/check_secrets.py
```

[扫描报告](security-scan.json) 记录此次暂存快照的结果。模式扫描有覆盖范围，不代表能证明任意格式的凭据绝对不存在。真实学习档案、浏览器 localStorage、内存录音与系统 GitHub 凭据均不属于项目文件，也没有导出或提交。

参考截图作为用户提供的设计研究资料保留，第三方图标保留原 MIT 许可证；不为整个项目擅自添加开源授权。原创图像和语音的生成/来源记录仍随素材清单保存。

## 验证与云端接续

新增验证脚本只核对文件与运行现有测试，不重制素材，也不执行历史 patch：

```sh
# 首次迁移核对：全部 344 个原文件哈希、资源、ZIP 与现有回归
python3 scripts/verify_project.py

# 以后有意修改源码后：跳过迁移原始字节一致性，继续检查当前资源与回归
python3 scripts/verify_project.py --current
```

迁移快照已通过：344 个原文件 SHA-256、172 个 manifest 资源及有摘要记录的资源校验、入口 HTML 相对引用、ZIP 完整性、全部应用 JS 语法检查、9 个档案/奖励测试、家长证据检查、10 个音频取消/回退测试。

原有 Markdown 包含用于换行的行尾双空格及少量空白末行，Git 通用空白检查会提示；为保证原文件字节一致，本次不顺便格式化。新增迁移文档与工具单独检查。

推送后以远端重新克隆的工作副本运行相同检查，并比对 `git rev-parse HEAD` 与 `git ls-remote origin refs/heads/main`。无需 Git LFS：本次最大单文件约 17 MB，小于 GitHub 普通文件限制；原始二进制和 ZIP 直接保留于 Git。

启动方式和开发交接见根目录 [README](../README.md) 与 [HANDOFF](../HANDOFF.md)。原运行代码保持不变；本次只新增迁移文档、清单、忽略规则、检查工具和恢复的历史原图。后续开发不要重跑 `work/implement_buddy_ui.py` 或 `work/unify_main_tabs.py`，它们是已执行过的一次性替换脚本。
