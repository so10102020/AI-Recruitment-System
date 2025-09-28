import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import multer from 'multer';
import path from 'path';
import pdf from 'pdf-parse';
import helmet from 'helmet';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// セキュリティ
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // インラインCSSを許可
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors());

// PDFファイルアップロード設定
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('PDFファイルのみ'));
    }
  }
});

// 静的ファイル配信の前に、トップページは no-store で必ず最新を返す
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 静的ファイル（開発中はキャッシュを無効化）
app.use(express.static(path.join(__dirname, '../public'), {
  etag: false,
  lastModified: false,
  cacheControl: false,
}));

// AI評価API
app.post('/api/evaluate-pdf', upload.single('pdf'), async (req, res) => {
  console.log('PDF評価開始');

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'PDFファイルがありません'
    });
  }

  try {
    // PDFからテキスト抽出
    const data = await pdf(req.file.buffer);
    const text = data.text;
    console.log('PDF読込完了:', text.length, '文字');

    if (!text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'PDFからテキストを読み取れませんでした'
      });
    }

    // AI評価実行
    const evaluation = await evaluateWithAI(text);
    console.log('AI評価完了:', evaluation.decision, evaluation.score);

    res.json({
      success: true,
      evaluation
    });

  } catch (error) {
    console.error('エラー:', error);
    res.status(500).json({
      success: false,
      message: 'AIによる評価ができませんでした。システム管理者にお問い合わせください。'
    });
  }
});

// 利用可能なGeminiモデルを動的取得
async function pickGeminiModel(apiKey: string): Promise<string> {
  const preferred = [
    'gemini-2.5-pro',
    'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-pro-preview-05-06',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-flash-latest',
    'gemini-pro-latest',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ];

  const envModel = (process.env.GEMINI_MODEL || '').trim();
  const normalize = (name: string) => (name?.startsWith('models/') ? name.slice('models/'.length) : name || '');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url, { method: 'GET' });
    const data = await res.json();
    console.log('Gemini ListModels ステータス:', res.status);
    console.log('Gemini ListModels レスポンス:', JSON.stringify(data, null, 2));

    if (!res.ok) {
      throw new Error(data?.error?.message || `HTTP ${res.status}`);
    }

    const models: any[] = data?.models || [];
    if (!Array.isArray(models) || models.length === 0) {
      throw new Error('ListModelsで有効なモデルが取得できませんでした');
    }

    const genCapable = models.filter(
      (m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent')
    );
    if (genCapable.length === 0) {
      throw new Error('generateContentに対応したモデルがありません');
    }

    const availableIds = genCapable.map((m) => normalize(m.name));

    // 環境変数で指定されたモデルが使えるなら最優先
    if (envModel && availableIds.includes(envModel)) {
      console.log('Gemini モデル選択(環境変数):', envModel);
      return envModel;
    }

    // 優先順位でマッチ
    for (const name of preferred) {
      if (availableIds.includes(name)) {
        console.log('Gemini モデル選択:', name);
        return name;
      }
    }

    // 先頭を採用（正規化して返す）
    const first = normalize(genCapable[0].name);
    console.log('Gemini モデル選択(先頭):', first);
    return first;
  } catch (e: any) {
    console.warn('ListModelsの取得に失敗。静的候補を使用します:', e?.message || e);
    // 環境変数が指定されていればそれを返す
    if (envModel) return envModel;
    return preferred[0];
  }
}

// Gemini APIによるAI評価関数（モデル自動検出 + フォールバック）
async function evaluateWithAI(text: string) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('AI評価ができません（Gemini APIキー未設定）');
  }

  const prompt = `以下のエントリーシートPDFの内容を評価してください。\n\n【評価観点】\n1. 志望動機の具体性と熱意 (30%)\n2. スキル・経験の適合性 (25%) \n3. 学歴・職歴の一貫性 (20%)\n4. コミュニケーション能力 (15%)\n5. 勤務準備度 (10%)\n\n【PDFの内容】\n${text.substring(0, 2000)}\n\n【回答形式】\n必ず以下のJSON形式で回答してください。他の文章は含めないでください。\n{\n  \"decision\": \"PASS\",\n  \"score\": 85,\n  \"reasoning\": \"志望動機が具体的で熱意が感じられます。技術スキルも適切で、学歴・職歴に一貫性があります。コミュニケーション能力も文章から推察でき、勤務への準備も整っていると判断されます。\"\n}\n\n70点以上でPASS、未満でFAILとしてください。`;

  // 1) モデル自動検出
  const model = await pickGeminiModel(GEMINI_API_KEY);

  // 環境変数モデルを最優先に試す
  const envModel = (process.env.GEMINI_MODEL || '').trim();

  // 2) まず自動検出モデルで実行。404等なら静的候補でフォールバック
  const candidates = Array.from(new Set([
    envModel || model,
    model,
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-flash-latest',
    'gemini-pro-latest',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ].filter(Boolean)));

  let lastErrorText = '';

  for (const m of candidates) {
    try {
      console.log(`Gemini API呼び出し開始: model=${m}`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [ { parts: [{ text: prompt }] } ],
            generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
          })
        }
      );

      console.log('Gemini API応答ステータス:', response.status);
      const data = await response.json().catch(() => ({}));
      console.log('Gemini APIレスポンス:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        lastErrorText = `model=${m}: ${errMsg}`;
        if (response.status === 404) {
          console.warn(`モデル未対応のためフォールバック: ${lastErrorText}`);
          continue;
        }
        throw new Error(lastErrorText);
      }

      const parts = data?.candidates?.[0]?.content?.parts || [];
      const content = Array.isArray(parts) ? parts.map((p: any) => p?.text || '').join('\n').trim() : '';
      if (!content) {
        lastErrorText = `model=${m}: contentテキストを抽出できませんでした`;
        console.warn(lastErrorText);
        continue;
      }

      let evaluationResult: any;
      try {
        evaluationResult = JSON.parse(content);
      } catch {
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) {
          lastErrorText = `model=${m}: AI応答にJSON構造が含まれていません`;
          console.warn(lastErrorText);
          continue;
        }
        evaluationResult = JSON.parse(jsonMatch[0]);
      }

      const validatedResult = {
        decision: evaluationResult.decision === 'PASS' ? 'PASS' : 'FAIL',
        score: typeof evaluationResult.score === 'number' ? Math.min(100, Math.max(0, Math.round(evaluationResult.score))) : 50,
        reasoning: typeof evaluationResult.reasoning === 'string' ? evaluationResult.reasoning.substring(0, 500) : '評価理由の取得に失敗しました'
      };
      console.log('検証済み評価結果:', validatedResult);
      return validatedResult;
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`Gemini APIモデル呼び出しエラー: model=${m} ->`, msg);
      lastErrorText = `model=${m}: ${msg}`;
      continue;
    }
  }

  throw new Error(`AI評価ができません（Gemini API処理エラー）: ${lastErrorText || '原因不明'}`);
}

/**
 * テキスト分析 - 文書の基本特性を分析
 */
function analyzeText(text: string) {
  const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  const numberPattern = /\d+/g;
  const numbers = text.match(numberPattern) || [];
  
  return {
    length: text.length,
    sentenceCount: sentences.length,
    wordCount: words.length,
    paragraphCount: paragraphs.length,
    numberCount: numbers.length,
    averageSentenceLength: sentences.length > 0 ? text.length / sentences.length : 0,
    hasSpecificExamples: /例えば|たとえば|具体的には|実際に/.test(text),
    hasQuantitativeData: numbers.length >= 3,
    sentences: sentences,
    words: words
  };
}

/**
 * 高度な必須項目チェック
 */
function checkRequiredFieldsAdvanced(text: string): { present: string[]; missing: string[]; partial: string[] } {
  const textLower = text.toLowerCase();
  const present: string[] = [];
  const missing: string[] = [];
  const partial: string[] = [];
  
  const requiredChecks = [
    { 
      field: '氏名', 
      keywords: ['名前', '氏名', 'なまえ'],
      strongKeywords: ['と申します', 'です', 'といいます']
    },
    { 
      field: '学歴', 
      keywords: ['大学', '学校', '卒業', '専攻', '学部'],
      strongKeywords: ['卒業', '専攻', '学士', '修士', '博士']
    },
    { 
      field: '志望動機', 
      keywords: ['志望', '動機', '理由', 'なぜ', '応募'],
      strongKeywords: ['志望動機', '応募理由', '志望理由']
    },
    { 
      field: '自己PR', 
      keywords: ['自己pr', 'アピール', '強み', '特技', '長所'],
      strongKeywords: ['私の強みは', '得意なこと', 'アピールポイント']
    }
  ];
  
  requiredChecks.forEach(check => {
    const hasBasic = check.keywords.some(keyword => textLower.includes(keyword));
    const hasStrong = check.strongKeywords.some(keyword => textLower.includes(keyword));
    
    if (hasStrong) {
      present.push(check.field);
    } else if (hasBasic) {
      partial.push(check.field);
    } else {
      missing.push(check.field);
    }
  });
  
  return { present, missing, partial };
}

/**
 * コンテンツ品質評価
 */
function evaluateContentQuality(text: string, analysis: any): { total: number; structure: number; specificity: number; logic: number } {
  let structureScore = 0;
  let specificityScore = 0;
  let logicScore = 0;
  
  // 文章構造評価
  if (analysis.paragraphCount >= 4) structureScore = 10;
  else if (analysis.paragraphCount >= 3) structureScore = 8;
  else if (analysis.paragraphCount >= 2) structureScore = 6;
  else structureScore = 3;
  
  // 適切な文章長加点
  if (analysis.averageSentenceLength >= 30 && analysis.averageSentenceLength <= 80) {
    structureScore += 2;
  }
  
  // 具体性評価
  if (analysis.hasQuantitativeData && analysis.hasSpecificExamples) specificityScore = 10;
  else if (analysis.hasQuantitativeData || analysis.hasSpecificExamples) specificityScore = 7;
  else if (analysis.numberCount >= 1) specificityScore = 5;
  else specificityScore = 2;
  
  // 論理性評価（接続詞・構成の確認）
  const logicKeywords = ['そのため', 'したがって', 'その結果', 'また', 'さらに', 'しかし', '一方で', 'このように'];
  const logicCount = logicKeywords.filter(keyword => text.toLowerCase().includes(keyword)).length;
  
  if (logicCount >= 3) logicScore = 8;
  else if (logicCount >= 2) logicScore = 6;
  else if (logicCount >= 1) logicScore = 4;
  else logicScore = 2;
  
  return {
    total: Math.min(30, structureScore + specificityScore + logicScore),
    structure: Math.min(12, structureScore),
    specificity: Math.min(10, specificityScore),
    logic: Math.min(8, logicScore)
  };
}

/**
 * 高度な志望動機評価
 */
function evaluateMotivationAdvanced(textLower: string, analysis: any): { score: number; clarity: number; passion: number; understanding: number } {
  const motivationKeywords = ['志望', '理由', '動機', '目標', '将来', '貢献', '成長', '挑戦'];
  const passionKeywords = ['情熱', '熱意', 'やりがい', '魅力', '興味', '憧れ', '夢', '価値'];
  const understandingKeywords = ['企業', '会社', '事業', '業界', 'サービス', '製品', '理念', 'ビジョン'];
  
  const motivationCount = motivationKeywords.filter(keyword => textLower.includes(keyword)).length;
  const passionCount = passionKeywords.filter(keyword => textLower.includes(keyword)).length;
  const understandingCount = understandingKeywords.filter(keyword => textLower.includes(keyword)).length;
  
  let clarityScore = Math.min(12, 6 + motivationCount * 1.5);
  let passionScore = Math.min(10, 4 + passionCount * 2);
  let understandingScore = Math.min(8, 2 + understandingCount * 1.5);
  
  return {
    score: Math.round(clarityScore + passionScore + understandingScore),
    clarity: Math.round(clarityScore),
    passion: Math.round(passionScore),
    understanding: Math.round(understandingScore)
  };
}

/**
 * 高度なスキル・経験評価
 */
function evaluateSkillsAdvanced(textLower: string, analysis: any): { score: number; technical: number; practical: number; achievements: number } {
  const technicalKeywords = ['技術', '開発', 'プログラミング', 'システム', 'スキル', 'ツール', '言語'];
  const practicalKeywords = ['経験', '実務', '業務', 'プロジェクト', '担当', '責任', '参加', '従事'];
  const achievementKeywords = ['成果', '実績', '達成', '改善', '効率化', '貢献', '成功', '完了'];
  
  const technicalCount = technicalKeywords.filter(keyword => textLower.includes(keyword)).length;
  const practicalCount = practicalKeywords.filter(keyword => textLower.includes(keyword)).length;
  const achievementCount = achievementKeywords.filter(keyword => textLower.includes(keyword)).length;
  
  let technicalScore = Math.min(10, 3 + technicalCount * 1.5);
  let practicalScore = Math.min(8, 2 + practicalCount * 1.5);
  let achievementsScore = Math.min(7, 1 + achievementCount * 2);
  
  return {
    score: Math.round(technicalScore + practicalScore + achievementsScore),
    technical: Math.round(technicalScore),
    practical: Math.round(practicalScore),
    achievements: Math.round(achievementsScore)
  };
}

/**
 * 高度な一貫性評価
 */
function evaluateConsistencyAdvanced(textLower: string, analysis: any): { score: number; education: number; career: number } {
  const educationKeywords = ['大学', '学部', '専攻', '卒業', '学歴', '学校', '研究', '論文'];
  const careerKeywords = ['会社', '企業', '職歴', '勤務', '転職', '入社', '退職', '部署'];
  const timeKeywords = ['年', '月', '期間', '現在', '前職', '新卒'];
  
  const educationCount = educationKeywords.filter(keyword => textLower.includes(keyword)).length;
  const careerCount = careerKeywords.filter(keyword => textLower.includes(keyword)).length;
  const timeCount = timeKeywords.filter(keyword => textLower.includes(keyword)).length;
  
  let educationScore = Math.min(10, 4 + educationCount * 1);
  let careerScore = Math.min(10, 4 + careerCount * 1 + (timeCount >= 2 ? 2 : 0));
  
  return {
    score: Math.round(educationScore + careerScore),
    education: Math.round(educationScore),
    career: Math.round(careerScore)
  };
}

/**
 * 高度なコミュニケーション能力評価
 */
function evaluateCommunicationAdvanced(textLower: string, analysis: any): { score: number; expression: number; cooperation: number } {
  const expressionKeywords = ['説明', '伝える', '表現', '発表', 'プレゼン', '報告', '提案'];
  const cooperationKeywords = ['チーム', '協力', '連携', 'リーダー', '指導', '相談', '調整', '合意'];
  
  const expressionCount = expressionKeywords.filter(keyword => textLower.includes(keyword)).length;
  const cooperationCount = cooperationKeywords.filter(keyword => textLower.includes(keyword)).length;
  
  // 文章の表現力も評価
  let expressionScore = 4; // 基礎点
  expressionScore += Math.min(4, expressionCount * 2);
  if (analysis.averageSentenceLength >= 30 && analysis.averageSentenceLength <= 70) {
    expressionScore += 1;
  }
  
  let cooperationScore = 3; // 基礎点
  cooperationScore += Math.min(5, cooperationCount * 1.5);
  
  return {
    score: Math.round(expressionScore + cooperationScore),
    expression: Math.round(expressionScore),
    cooperation: Math.round(cooperationScore)
  };
}

/**
 * 高度な勤務準備度評価
 */
function evaluateReadinessAdvanced(textLower: string, analysis: any): { score: number } {
  const readinessKeywords = [
    '勤務', '出勤', '時間', 'フルタイム', '残業', '土日', '休日', '勤務地',
    '通勤', '出社', 'リモート', '在宅', '働く', '就業', '労働', '責任感', '継続'
  ];
  
  const foundCount = readinessKeywords.filter(keyword => textLower.includes(keyword)).length;
  
  let score = 6; // 基礎点
  score += Math.min(4, foundCount * 0.8);
  
  return { score: Math.round(score) };
}

/**
 * 品質調整（追加の加点・減点要素）
 */
function applyQualityAdjustments(text: string, analysis: any): { total: number; reasons: string[] } {
  let adjustmentScore = 0;
  const reasons: string[] = [];
  
  // 長すぎる文書の減点
  if (analysis.length > 2000) {
    adjustmentScore -= 3;
    reasons.push('文書が長すぎます (-3点)');
  }
  
  // 短すぎる文書の減点
  if (analysis.length < 200) {
    adjustmentScore -= 5;
    reasons.push('文書が短すぎます (-5点)');
  }
  
  // 優秀な文章構成の加点
  if (analysis.paragraphCount >= 4 && analysis.hasSpecificExamples && analysis.hasQuantitativeData) {
    adjustmentScore += 5;
    reasons.push('優秀な文章構成 (+5点)');
  }
  
  // 同じ単語の過度な繰り返しの減点
  const wordFreq = new Map<string, number>();
  analysis.words.forEach((word: string) => {
    if (word.length > 2) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  });
  
  const maxFreq = Math.max(...Array.from(wordFreq.values()));
  if (maxFreq > 10) {
    adjustmentScore -= 2;
    reasons.push('単語の過度な繰り返し (-2点)');
  }
  
  return { total: adjustmentScore, reasons };
}

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// SPA対応
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`AI採用システム起動: http://localhost:${PORT}`);
});

export default app;
