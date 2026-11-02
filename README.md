# GOEN 電子契約書アプリ

iPadでお客様に指で署名してもらう作業契約書。署名済みPDFを税理士の共有ドライブへ自動保存し、控えをメール／LINEで渡す。

- 設計：`設計書_2026-11-01.md`　計画：`実装計画_2026-11-01.md`　元の指示書：iCloud `GOEN_電子契約書_指示書.md`
- 画面：`docs/index.html`（GitHub Pages で公開。`docs/logic.js` は `gas/Logic.gs` のコピー）
- 裏方：`gas/`（GASに貼り付け。Code.gs／Logic.gs／Template.gs／appsscript.json）
- 手順：`手順書/初回セットアップ.md`、`手順書/iPadでの使い方.md`
- テスト：`npm test`（Logic.gs）／ 画面は `http://localhost:4182/index.html?mock=1`（練習モード・GASなし）

## 直すときの約束
- `gas/Logic.gs` を直したら `cp gas/Logic.gs docs/logic.js`（画面も同じ計算を使う）
- GASは本番プロジェクトに貼り直し →「デプロイを管理」→ 新バージョン
- 契約書の文面はコードではなく Googleドキュメント「電子契約書ひな形」で直す
- `tools/`：控枠PNG・アイコン・テスト署名の生成スクリプト（pillow が必要）

## 本番の設定値（コードに書かない）
GAS スクリプト プロパティ：`OAUTH_CLIENT_ID` / `ALLOWED_EMAILS` / `ADMIN_EMAILS`（setupAll が `SHARED_DRIVE_ID` / `CONFIG_FOLDER_ID` / `TEMPLATE_DOC_ID` / `SHEET_ID` を自動保存）
