# GOEN 電子契約書アプリ

iPadでお客様に指で署名してもらう作業契約書。署名済みPDFを税理士の共有ドライブへ自動保存し、控えをメール／LINEで渡す。

- 設計：`設計書_2026-11-01.md`　計画：`実装計画_2026-11-01.md`　元の指示書：iCloud `GOEN_電子契約書_指示書.md`
- 画面：`docs/index.html`（GitHub Pages で公開。`docs/logic.js` は `gas/Logic.gs` のコピー）
- 裏方：`gas/`（GASに貼り付け。Code.gs／Logic.gs／Template.gs／appsscript.json）
- 手順：`手順書/初回セットアップ.md`、`手順書/iPadでの使い方.md`
- テスト：`npm test`（Logic.gs）／ 画面は `http://localhost:4182/index.html?mock=1`（練習モード・GASなし）

## 本番（2026-11-14 稼働開始）
- 画面: https://atsushi-goen-nagano.github.io/goen-econtract/ （repo atsushi-goen-nagano/goen-econtract、Pages=main/docs）
- GAS: https://script.google.com/d/1gaToKiNd2PESW90Bc0Htz9_y2pMoMavnf0cOCtSIpjeJjIV3L-do-WRd/edit （アカウント goen3378@gmail.com「あ」）
- ウェブアプリ デプロイID `AKfycbxFGP1CRqhAH9dbwpJjSkbHbq2tyTECBc9Y_Q15oalNBm8Q63W_GEGFuqaiDOcPCsFW`（URLは docs/index.html の GAS_URL）
- Google Cloud プロジェクト `GOEN-Keiyakusho`（クライアントID 1018313183986-…）。同意画面は「テスト中」のまま可（テストユーザー登録）
- ひな形Doc: https://docs.google.com/document/d/10FWnbl6nD8AoJTuHLuF-5JDzXMKJ7aTX1vA76hwl33w/edit
- 契約一覧: https://docs.google.com/spreadsheets/d/1_mPZILoFXcbBu0NjeTL3jFMm-8nNUtPpQzsZk0SWYsc/edit

## 直すときの約束
- `gas/Logic.gs` を直したら `cp gas/Logic.gs docs/logic.js`（画面も同じ計算を使う）
- 画面（docs/）は `git push` で公開に反映
- GASは clasp で反映（貼り付け不要）:
  ```bash
  clasp --user goen3378 push -f && clasp --user goen3378 deploy -i AKfycbxFGP1CRqhAH9dbwpJjSkbHbq2tyTECBc9Y_Q15oalNBm8Q63W_GEGFuqaiDOcPCsFW -d "説明"
  ```
  ※ `clasp create` は appsscript.json を上書きするので二度と実行しない
- 文面（Template.gs）を変えたら GASエディタで `recreateTemplate` を実行（ひな形Docを作り直す）
- 契約書の文面はコードではなく Googleドキュメント「電子契約書ひな形」で直す
- `tools/`：控枠PNG・アイコン・テスト署名の生成スクリプト（pillow が必要）

## 本番の設定値（コードに書かない）
GAS スクリプト プロパティ：`OAUTH_CLIENT_ID` / `ALLOWED_EMAILS` / `ADMIN_EMAILS`（setupAll が `SHARED_DRIVE_ID` / `CONFIG_FOLDER_ID` / `TEMPLATE_DOC_ID` / `SHEET_ID` を自動保存）
