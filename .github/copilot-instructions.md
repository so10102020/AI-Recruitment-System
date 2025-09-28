<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# AI採用システム プロジェクト指示（Copilot）

このプロジェクトは、Google Generative Language API (Gemini) を使用してエントリーシートを評価し、面接可否を判定するWebアプリケーションです。

## 構成
- バックエンド: Node.js + TypeScript + Express
- フロントエンド: バニラHTML/CSS/JavaScript
- AI評価: Gemini（generateContent, JSON応答）
- セキュリティ: Helmet, CORS

## コーディング規約
- TypeScriptの厳密型・async/await
- 例外はcatchしてユーザーフレンドリーに返す
- AI応答はJSONのみ受容し、厳格にパース・バリデーション
- ログは日本語で簡潔に

## 評価基準（重み）
1. 志望動機の具体性と熱意 (30%)
2. スキルと経験の適合性 (25%)
3. 学歴と職歴の一貫性 (20%)
4. コミュニケーション能力の推測 (15%)
5. 勤務への準備度 (10%)
- 70点以上: PASS / 69点以下: FAIL

## 重要
- 環境変数: GEMINI_API_KEY（必須）、GEMINI_MODEL（任意）
- フォールバック: モデルの自動検出・フォールバックは行うが、ローカル自動評価は行わない
- API応答は`contents[].parts[].text`からJSONを抽出

## 実装メモ
- エンドポイント: POST /api/evaluate-pdf（multerでPDF受領、pdf-parseで抽出）
- パラメータ: multipart/form-data, field=pdf
- 返却: { success, evaluation: { decision, score, reasoning } }