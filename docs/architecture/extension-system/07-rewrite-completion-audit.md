1. 修复 manifest `icon` 端到端贯通，避免公开契约与 UI 行为不一致。
2. 拆分 `runtime/host/sdk-bridge.ts`，这是最能提升系统清晰度的一步。
3. 拆分library capability，清理 library capability 的 typed facade 和 `as any`。
4. 抽象 scraper adapter 的四类媒体重复。
5. 把 `ExtensionService` 的 DTO mapping 抽出。
6. 拆分 `extension-api` 中超长 contract/validation 文件。
7. 清理 CLI 小重复。
