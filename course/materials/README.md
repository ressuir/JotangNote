# 材料源文件

`report.py` 生成 DOCX，`deck.mjs` 使用 `@oai/artifact-tool` 生成可编辑 PPTX，`diagrams.mjs` 生成报告中的技术示意图。输入为当前仓库源码、`course/evidence/current.json` 和 `Notes/screenshots` 中的真实截图。

这些生成器使用 Codex 文档与演示文稿运行时提供的 Python、Node.js 和依赖；运行项目本身不需要这些工具。DOCX 经 LibreOffice 导出 PDF，并逐页检查。最终成品保存在 `course/artifacts`。

视频自动化由 `course/record-demo.cjs` 和 `course/finalize-video.py` 执行，GitHub Actions 的 Assemble course deliverables 工作流负责 Compose 构建、真实操作录制、字幕嵌入及交付 ZIP 打包。
