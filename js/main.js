import { initPiano } from './instruments/piano.js';
import { updateMasterVolume } from './utils.js';
import { setupPerformSession } from './modes/perform.js';
// recordStudioEvent を追加でインポート
import { initStudioMode, handleStopMIDI, recordStudioEvent } from './modes/studio.js';

// --- グローバル変数（状態管理） ---
let loadedMidiData = null;
let videoPlayerElement = null; 

window.isPlaying = false;
window.isGuideMode = false;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initPiano();
        console.log("PianoWorks: Piano UI Rendered.");
    } catch (e) { console.error("Piano rendering failed:", e); }

    videoPlayerElement = document.getElementById('local-video-player');
    initCommonUI(); 

    // Studioモード初期化
    await initStudioMode(() => loadedMidiData);  
    setupPerformSession();
});

// 1. 共通UI（ボリューム・MIDI読み込み）
function initCommonUI() {
    const vSlider = document.getElementById('master-volume');
    const vInput = document.getElementById('volume-input');
    if (vSlider && vInput) {
        vSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            vInput.value = Math.round(val * 100);
            updateMasterVolume(val); 
            if (videoPlayerElement) videoPlayerElement.volume = val;
        });
    }

    const midiInput = document.getElementById('midi-upload');
    const displayFilename = document.getElementById('display-filename');
    // Studioモード側のディスプレイ要素も取得
    const studioDisplay = document.getElementById('studio-song-display');

    if (midiInput) {
        midiInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            // ファイル名を各ディスプレイに反映
            if (displayFilename) displayFilename.textContent = file.name;
            if (studioDisplay) studioDisplay.textContent = file.name; // Studio側も更新

            const reader = new FileReader();
            reader.onload = (e) => { 
                loadedMidiData = e.target.result; 
                console.log("MIDI Data Ready.");
            };
            reader.readAsArrayBuffer(file);
        });
    }
}

// Ctrl + Esc で強制終了
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Escape') {
        handleStopMIDI();
        document.body.classList.remove('performance-mode');
        window.isPlaying = false;
    }
});

/* ==========================================
    PLAYLIST (ARCHIVE) LOGIC - Lottie Optimized
   ========================================== */

// 1. 変数の準備（接着剤）
const playlistIconBtn = document.getElementById('playlist-icon-btn');
const playlistModal = document.getElementById('playlist-modal-overlay');
const playlistCloseBtn = document.getElementById('playlist-close-btn');
const playlistContainer = document.getElementById('playlist-items-container');
let bookAnim = null; 

// 2. 関数の定義（設計図）
// リストを描画する関数（これがないというエラーが出ていました）
function renderPlaylist() {
    if (!playlistContainer) return;
    playlistContainer.innerHTML = '';

    const dummyHistory = [
        { type: 'MIDI', name: 'Nocturne_Op9_No2.mid' },
        { type: 'VIDEO', name: 'https://www.youtube.com/watch?v=...' }
    ];

    dummyHistory.forEach(item => {
        const div = document.createElement('div');
        div.className = 'playlist-item';
        div.textContent = `♪ [${item.type}] ${item.name}`;
        div.onclick = () => closePlaylistWithAnim();
        playlistContainer.appendChild(div);
    });
}

// Lottieを初期化する関数
function initPlaylistLottie() {
    const container = document.getElementById('book-lottie-canvas');
    if (!container) return;

    bookAnim = lottie.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        path: 'assets/Page Flipping.json' 
    });
}

// プレイリストを閉じる関数
function closePlaylistWithAnim() {
    const layer = document.getElementById('playlist-content-layer');
    if (layer) {
        layer.style.opacity = "0";
        layer.style.pointerEvents = "none";
    }

    if (bookAnim) {
        bookAnim.setDirection(-1);
        bookAnim.play();
    }

    setTimeout(() => {
        playlistModal.style.display = 'none';
    }, 800);
}

// 3. 実行とイベント登録（組み立て）
initPlaylistLottie();

if (playlistIconBtn) {
    playlistIconBtn.addEventListener('click', () => {
        playlistModal.style.display = 'flex';
        
        if (bookAnim) {
            bookAnim.setDirection(1);
            bookAnim.goToAndPlay(0, true);
        }

        setTimeout(() => {
            const layer = document.getElementById('playlist-content-layer');
            if (layer) {
                layer.style.opacity = "1";
                layer.style.pointerEvents = "auto";
            }
            renderPlaylist(); // ここで呼び出し
        }, 700);
    });
}

if (playlistCloseBtn) playlistCloseBtn.addEventListener('click', closePlaylistWithAnim);

window.addEventListener('click', (event) => {
    if (event.target === playlistModal) {
        closePlaylistWithAnim();
    }
});