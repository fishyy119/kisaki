# Kisaki Extension Tooling v0.0.8

## ハイライト

- 変更 拡張機能の互換性宣言を `engines.kisaki` から `engines.kisakiExtensionApi` へ移行
- 必須化 拡張機能作者による manifest 更新、パッケージ再作成、artifact 再署名、registry release 再公開
- 改善 拡張機能の互換性ドキュメントと scaffold template で、互換性判定が desktop app version ではなく Extension API version に基づくことを明確化

## 破壊的変更

- 変更 拡張機能 manifest と registry release の互換性フィールドを更新し、古い `engines.kisaki` は schema、CLI 検証、host install check、catalog 互換性判定で受け付けないよう変更
- 変更 パッケージ署名 payload と release digest で、`engines.kisakiExtensionApi` を署名検証と release digest 計算に含めるよう変更

## 移行メモ

- 必須化 拡張機能作者は `manifest.json` の `engines.kisaki` を `engines.kisakiExtensionApi` に変更
- 必須化 公開済み拡張機能は `kisx pack` を再実行し、artifact を再署名し、新しい registry release で discovery catalog を更新
- 必須化 手書き registry manifest の保守者は release の `engines.kisaki` を `engines.kisakiExtensionApi` に変更

## 改善

- 改善 `kisx validate`、packaging、signing、publishing、host install validation のメッセージを Extension API 互換性フィールドに統一
- 改善 生成 manifest template で、新しい拡張機能が既定で `engines.kisakiExtensionApi` を使用
- 改善 discovery catalog と installed extension details で、新しい registry release フィールドから Extension API range を表示

## ドキュメント

- 変更 Extension API versioning、distributed registry design、tooling release documentation で、`engines.kisakiExtensionApi` を Extension API compatibility range として説明
