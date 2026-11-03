# Milo · 英语故事伙伴

面向 3–8 岁孩子的英语启蒙产品原型。当前可体验版本 **0.4.8（2026-11-03）**，包含准备野餐和早餐小帮手两个完整单元，以及家长反馈、伙伴开心值、书架、旅行册与横向学习地图。

## 启动

需要 Python 3；运行 Demo 不需要安装 npm 或 Python 包。在仓库根目录执行：

```sh
python3 outputs/first-day-demo/serve.py
```

打开 <http://127.0.0.1:4173/preview.html>，体验固定 **2400×1600** 的等比缩放调试窗口；普通页面为 <http://127.0.0.1:4173/>。若端口已占用，请以脚本输出的实际端口为准。

云端需要转发预览端口时，可从仓库根目录执行：

```sh
python3 -m http.server 4173 --bind 0.0.0.0 --directory outputs/first-day-demo
```

通过云端开发环境的端口预览打开 `/preview.html`。这是一项开发服务器操作，不是生产部署；运行目录仅为 Demo。需要录音时使用浏览器认可的 HTTPS 预览地址或 localhost。

## 验证与交接

需要 Python 3 和 Node.js 20 或更新版本，无需 npm 安装：

```sh
python3 scripts/verify_project.py
```

- [云端开发交接](HANDOFF.md)：当前进度、产品决策、源码地图、验证步骤、已知边界与后续建议。
- [迁移记录](migration/MIGRATION.md)：原始文件范围、忽略项审查、安全检查和远端校验方法。
- [原始文件清单](migration/original-file-inventory.json)：迁移前全部文件/软链接、大小、SHA-256 与处理结果。
- [Demo 使用说明](outputs/first-day-demo/README.md)、[验收记录](outputs/first-day-demo/design-qa.md)、[设计规范](outputs/first-day-demo/design-spec.md)。

## 目录

| 路径 | 内容 |
| --- | --- |
| `outputs/first-day-demo/` | 实际运行的静态应用、全部本地音频/美术/图标、截图和验收材料 |
| `outputs/*.md` | 产品架构、核心流程、首日范围、竞品调研和设计规范 |
| `outputs/调研参考/`、`outputs/首页视觉对比/` | 实机参考与历史视觉方案 |
| `outputs/英语启蒙首日流程Demo.zip` | 保留的 0.4.8 便携交付包 |
| `work/` | 原始音频、生成脚本、回归检查、历史修改脚本和快照 |
| `migration/`、`scripts/` | 文件审计与可跨平台执行的迁移验证 |

`work/` 保留开发过程，但其中的历史修改脚本不应批量重跑；部分音频生成工具依赖 macOS。Python 虚拟环境和缓存保留在原本机，未提交。默认体验进度存在浏览器 localStorage 中，不在本仓库；更换域名或云端环境后使用新的本地档案。

这是前端流程原型：无正式账户、后端、真实支付、真人教室、语音识别或大模型。素材来源和第三方图标许可见 [资产说明](outputs/first-day-demo/assets/README.md)。
