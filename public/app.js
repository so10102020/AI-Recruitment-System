// AI採用システム - クライアントサイドJavaScript

// DOM要素の取得
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const uploadSection = document.getElementById('uploadSection');
const processing = document.getElementById('processing');
const result = document.getElementById('result');
const error = document.getElementById('error');
const restartBtn = document.getElementById('restartBtn');

function init() {
  if (selectFileBtn) {
    selectFileBtn.addEventListener('click', () => fileInput && fileInput.click());
  }

  if (uploadArea) {
    // アップロードエリアのクリックでも選択ダイアログを開く
    uploadArea.addEventListener('click', () => fileInput && fileInput.click());

    // ドラッグ&ドロップイベント
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // fileInput.files へ直接代入は環境により不可のため、ハンドラにFilesを渡す
        handleFile({ target: { files } });
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', handleFile);
  }

  if (restartBtn) {
    restartBtn.addEventListener('click', restart);
  }
}

// DOMの準備状態に応じて初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ファイル処理関数
async function handleFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  if (file.type !== 'application/pdf') {
    showError('PDFファイルのみ対応しています');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showError('ファイルサイズは10MB以下にしてください');
    return;
  }

  hideError();
  showProcessing();

  try {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch('/api/evaluate-pdf', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      showResult(data.evaluation);
    } else {
      throw new Error(data.message || 'エラーが発生しました');
    }
  } catch (err) {
    showError('処理中にエラーが発生しました: ' + (err && err.message ? err.message : String(err)));
    showUpload();
  }
}

// UI表示制御関数
function showProcessing() {
  if (uploadSection) uploadSection.style.display = 'none';
  if (processing) processing.style.display = 'block';
  if (result) result.style.display = 'none';
}

function showResult(evaluation) {
  if (uploadSection) uploadSection.style.display = 'none';
  if (processing) processing.style.display = 'none';
  if (result) {
    result.style.display = 'block';
    result.className = evaluation.decision === 'PASS' ? 'result pass' : 'result fail';
  }

  const scoreEl = document.getElementById('score');
  const reasoningEl = document.getElementById('reasoning');
  if (scoreEl) {
    scoreEl.textContent = `${evaluation.decision === 'PASS' ? '✅ 2次選考通過' : '❌ 選考見送り'} (${evaluation.score}点)`;
  }
  if (reasoningEl) {
    reasoningEl.textContent = evaluation.reasoning;
  }
}

function showUpload() {
  if (uploadSection) uploadSection.style.display = 'block';
  if (processing) processing.style.display = 'none';
  if (result) result.style.display = 'none';
}

function showError(message) {
  if (!error) return;
  error.textContent = message;
  error.style.display = 'block';
}

function hideError() {
  if (!error) return;
  error.style.display = 'none';
}

function restart() {
  if (fileInput) fileInput.value = '';
  hideError();
  showUpload();
}