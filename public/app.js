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

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
    // ファイル選択ボタンのクリックイベント
    selectFileBtn.addEventListener('click', function() {
        fileInput.click();
    });

    // アップロードエリアのクリックイベント
    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });

    // ファイル入力の変更イベント
    fileInput.addEventListener('change', handleFile);

    // 再開ボタンのクリックイベント
    restartBtn.addEventListener('click', restart);

    // ドラッグ&ドロップイベント
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            // ファイル入力に設定して処理
            fileInput.files = files;
            handleFile({ target: { files } });
        }
    });
});

// ファイル処理関数
async function handleFile(event) {
    const file = event.target.files[0];
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
        showError('処理中にエラーが発生しました: ' + err.message);
        showUpload();
    }
}

// UI表示制御関数
function showProcessing() {
    uploadSection.style.display = 'none';
    processing.style.display = 'block';
    result.style.display = 'none';
}

function showResult(evaluation) {
    uploadSection.style.display = 'none';
    processing.style.display = 'none';
    result.style.display = 'block';

    result.className = evaluation.decision === 'PASS' ? 'result pass' : 'result fail';
    
    document.getElementById('score').textContent = 
        `${evaluation.decision === 'PASS' ? '✅ 2次選考通過' : '❌ 選考見送り'} (${evaluation.score}点)`;
    
    document.getElementById('reasoning').textContent = evaluation.reasoning;
}

function showUpload() {
    uploadSection.style.display = 'block';
    processing.style.display = 'none';
    result.style.display = 'none';
}

function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
}

function hideError() {
    error.style.display = 'none';
}

function restart() {
    fileInput.value = '';
    hideError();
    showUpload();
}