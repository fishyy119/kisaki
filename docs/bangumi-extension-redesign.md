# Bangumi 内置扩展重写计划

本文档已拆分为专题文档，入口见 [docs/bangumi-extension-redesign/README.md](bangumi-extension-redesign/README.md)。

核心方向：

- 使用 Kisaki 官方 Bangumi 应用和 Kisaki OAuth Relay；官方 `client_secret` 只保存在服务器。
- Relay 按 Docker 服务部署，可接入 `nginx-manager-proxy` 并通过 `https://kisaki.me/_tmp/bangumi-oauth/*` 这类临时域名路径暴露。
- Bangumi 扩展自行组合 `network`、`deeplinks`、`secrets`、`runtime.openExternal` 完成 OAuth flow。
- 批量导入保持并行；Bangumi API 速率由 Bangumi provider client 统一限制。
- 新增 command/background task 能力，扩展可以创建/删除自己拥有的后台 task。
- 在 `DbService` 内新增 typed event projector，把 SQLite trigger 的 raw DB 事件投影为实体级 library events。
