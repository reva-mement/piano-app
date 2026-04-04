// js/utils.js

// ボリューム更新のブリッジ
export function updateMasterVolume(volume) {
    if (window.pianoGain && window.audioContext) {
        window.pianoGain.gain.setTargetAtTime(volume, window.audioContext.currentTime, 0.01);
    }
}

// 鍵盤が画面内にあるか判定
export function isNoteInView(noteName) {
    const keyElement = document.querySelector(`.key[data-note="${noteName}"]`);
    const viewport = document.getElementById('piano-viewport');
    if (!keyElement || !viewport) return false;
    const viewRect = viewport.getBoundingClientRect();
    const keyRect = keyElement.getBoundingClientRect();
    return (keyRect.right > viewRect.left && keyRect.left < viewRect.right);
}

// YouTube等のURLからIDを抽出
export function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : null;
}

// ガイド用のハイライト（これ自体もいずれ演出モジュールへ移しますが一旦ここへ）
export function highlightGuideKey(noteName) {
    const keyElement = document.querySelector(`.key[data-note="${noteName}"]`);
    if (keyElement) {
        keyElement.style.setProperty('background-color', 'gold', 'important');
        keyElement.style.setProperty('box-shadow', '0 0 30px 10px gold', 'important');
    }
}

// モーダルを表示する共通関数
export function showModal(contentHtml, onConfirm) {
    const overlay = document.getElementById('common-modal-overlay');
    const container = document.getElementById('modal-dynamic-content');
    const closeBtn = document.getElementById('modal-close-btn');

    // 中身を流し込む
    container.innerHTML = contentHtml;
    overlay.style.display = 'flex';

    // 決定ボタンなどのイベント設定（もしあれば）
    const confirmBtn = container.querySelector('.modal-confirm-btn');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            const input = container.querySelector('input');
            onConfirm(input ? input.value : null);
            closeModal();
        };
    }

    // キャンセル処理
    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
}

function closeModal() {
    const overlay = document.getElementById('common-modal-overlay');
    overlay.style.display = 'none';
}