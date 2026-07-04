# Kisaki Extension Tooling v0.0.9

## 破坏性变更

- 调整 `createExtensionRegistryManifest`，不再默认写入远程 registry schema URL，需要 `$schema` 提示时由调用方显式传入

## 迁移说明

- 要求已有 registry 仓库将 `registry/manifest.json` 的 `$schema` 更新为本地 `@kisaki3/extension-registry` 包内 schema，并安装对应版本的 `@kisaki3/extension-registry`

## 改进

- 改进 `kisx registry init`，默认生成相对于 manifest 位置的本地 registry schema 引用
- 改进脚手架生成的 workspace，默认安装 `@kisaki3/extension-registry` 并为 registry manifest 写入本地包内 schema 引用
- 改进扩展和 registry schema 元数据，不再声明远程 canonical URL
