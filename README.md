# AI採用システム

Gemini API（Google AI）でPDFのエントリーシートを評価し、面接選考の判定を行うWebアプリケーションです。

- PDFアップロード → テキスト抽出（pdf-parse） → Geminiで評価（JSON）
- Helmet/CORSで最低限のセキュリティ

## 技術スタック
- Node.js + TypeScript + Express
- Google Generative Language API (Gemini)
- pdf-parse / multer

## セットアップ
1) 依存関係のインストール
- npm install

2) 環境変数の設定
- cp .env.example .env
- .env を編集
  - GEMINI_API_KEY=your_gemini_api_key_here
  - GEMINI_MODEL=gemini-2.0-flash（任意・推奨）
  - PORT=3000（任意）

3) ビルドと起動
- npm run build
- npm start

## 使い方
- http://localhost:3000 を開く
- PDFを選択してアップロード
- decision / score / reasoning を確認

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
- .env.example: 環境変数のサンプル

## ライセンス
ISC