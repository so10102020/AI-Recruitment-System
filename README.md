# AI採用システム

Gemini API（Google AI）でPDFのエントリーシートを評価し、面接選考の判定を行うWebアプリケーションです。

- PDFアップロード → テキスト抽出（pdf-parse） → Geminiで評価（JSON）
- Helmet/CORSで最低限のセキュリティ

## 必要な環境・注意点
- **Node.js 18.0.0以上**（Node.js 16系は非対応）
- **npm 8.0.0以上**
- **推奨ブラウザ: Chrome, Edge, Firefox**
    - SafariはローカルHTTPサーバーでもTLS（HTTPS）を強制しやすく、正常動作しません。
    - SafariでTLSエラーが出る場合は、必ずChrome/Edge/Firefoxで http://localhost:3000 を開いてください。
- **URLは必ず http://localhost:3000 でアクセス**
    - 127.0.0.1やhttpsではTLSエラーが出る場合があります。

## セットアップ
1. Node.jsバージョン確認
   ```sh
   node --version  # 18.0.0以上
   ```
2. 依存関係インストール
   ```sh
   npm install
   ```
3. 環境変数設定
   ```sh
   cp .env.example .env
   # .envを編集し、GEMINI_API_KEYを設定
   ```
4. ビルド＆起動
   ```sh
   npm run build
   npm start
   ```
5. ブラウザで http://localhost:3000 を開く

## 使い方
- PDFを選択してアップロード
- AIによる評価結果（decision / score / reasoning）を確認

## セキュリティ改善点
- インラインJavaScriptを外部ファイルに分離済み
- すべてのイベントハンドラーをaddEventListenerで実装済み
- CSP（Content Security Policy）対応済み

## API
- POST /api/evaluate-pdf
  - Content-Type: multipart/form-data
  - フィールド名: pdf（最大10MB）
- GET /api/health

## 評価基準（重み）
1. 志望動機の具体性と熱意 (30%)
2. スキル・経験の適合性 (25%)
3. 学歴・職歴の一貫性 (20%)
4. コミュニケーション能力 (15%)
5. 勤務準備度 (10%)
- 70点以上: PASS / 69点以下: FAIL

## ディレクトリ
- src/app.ts: サーバー本体（Gemini呼び出し含む）
- public/index.html: 簡易UI
- public/app.js: クライアントJS
- .env.example: 環境変数のサンプル

## ライセンス
ISC