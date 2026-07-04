# Kisaki Extension Tooling v0.0.8

## 重点

- 调整扩展兼容声明字段，从 `engines.kisaki` 改为 `engines.kisakiExtensionApi`
- 要求扩展作者更新 manifest、重新打包、重新签名并重新发布 registry release
- 改进扩展兼容文档和脚手架模板，明确兼容判断基于 Extension API 版本而不是桌面应用版本

## 破坏性变更

- 调整扩展 manifest 和 registry release 的兼容字段，旧的 `engines.kisaki` 不再被 schema、CLI、宿主安装校验或发现目录兼容判断接受
- 调整安装包签名载荷和 release 摘要，`engines.kisakiExtensionApi` 现在参与签名校验和版本摘要计算

## 迁移说明

- 要求扩展作者将 `manifest.json` 中的 `engines.kisaki` 改为 `engines.kisakiExtensionApi`
- 要求已发布扩展使用新版工具链重新运行 `kisx pack`、重新签名安装包，并用新的 registry release 更新发现目录
- 要求手写 registry manifest 的维护者同步将 release `engines.kisaki` 改为 `engines.kisakiExtensionApi`

## 改进

- 改进 `kisx validate`、打包、签名、发布和宿主安装校验中的错误信息，统一使用 Extension API 兼容字段
- 改进生成项目的 manifest 模板，新扩展默认生成 `engines.kisakiExtensionApi`
- 改进发现目录和已安装扩展详情中的扩展 API 范围展示，使用新的 registry release 字段

## 文档

- 调整扩展 API 版本策略、分发 registry 设计和工具链发布文档，统一说明 `engines.kisakiExtensionApi` 是 Extension API 兼容范围
