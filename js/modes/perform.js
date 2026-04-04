// 1. インポートを先頭にまとめる
import { extractVideoId, showModal } from '../utils.js';

const { WebviewWindow } = window.__TAURI__.webviewWindow;

let videoWindow = null;
let pianoOverlayWindow = null;

// 2. 関数名を一つに統一（setupPerformSession）
export function setupPerformSession() {
    const playBtn = document.getElementById('video-play-btn');
    const importBtn = document.getElementById('video-import-btn');
    const display = document.getElementById('video-filename-display');

    // PLAYボタンの処理
    if (playBtn) {
        playBtn.onclick = (e) => {
            e.stopPropagation();
            const currentUrl = display ? display.textContent : "";
            handlePerformStart(currentUrl); 
        };
    }

    // IMPORTボタンの処理（自作モーダル版）
    if (importBtn) {
        importBtn.onclick = (e) => {
            e.stopPropagation();

            const html = `
                <div class="import-modal-inner">
                    <div class="modal-title-stamp">IMPORT YOUTUBE VIDEO</div>
                    
                    <div class="modal-input-wrapper">
                        <input type="text" class="modal-text-input" placeholder="https://www.youtube.com/...">
                    </div>
                    
                    <div class="modal-confirm-btn">IMPORT</div>
                </div>
            `;

            showModal(html, (url) => {
                if (url) {
                    const videoId = extractVideoId(url);
                    if (videoId && display) {
                        display.textContent = url;
                        console.log("URL updated via Custom Modal.");
                    } else {
                        alert("有効なURLではありません。");
                    }
                }
            });
        };
    }
}

// 3. 窓の生成ロジック（自作モーダル警告版）
async function handlePerformStart(url) {
    // ブラウザ標準の alert を廃止し、utils.js の showModal を使用
    if (!url || url === "No Video Loaded") {
        const alertHtml = `
            <div style="text-align: center; padding: 10px;">
                <p style="margin-bottom: 20px; font-weight: bold; color: #e0d0b0;">
                    先に動画URLをインポートしてください。
                </p>
                <button class="modal-confirm-btn" 
                        style="padding: 8px 24px; cursor: pointer; background: linear-gradient(to bottom, #5d4037, #3d2b1f); color: white; border: 1px solid #2a1b15; border-radius: 2px;">
                    OK
                </button>
            </div>
        `;
        
        // utils.js からインポートした showModal を呼び出し
        // 第2引数はOKボタン押下時のコールバック（今回は閉じるだけなので空でOK）
        showModal(alertHtml, () => {
            console.log("Alert closed");
        });
        return;
    }

    const btn = document.getElementById('video-play-btn');
    const videoId = extractVideoId(url);

    if (videoWindow) {
        await videoWindow.close();
        if (pianoOverlayWindow) await pianoOverlayWindow.close();
        videoWindow = null;
        pianoOverlayWindow = null;
        btn.textContent = "▶ PLAY";
        return;
    }

    if (!WebviewWindow) return;

    videoWindow = new WebviewWindow('video-player', {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: 'PianoWorks - Performing',
        fullscreen: true,
        alwaysOnTop: true,
    });

    pianoOverlayWindow = new WebviewWindow('piano-overlay', {
        url: 'keyboard-overlay.html',
        width: 1300,
        height: 350,
        x: 0,
        y: 450,
        transparent: true,
        decorations: false,
        alwaysOnTop: true,
    });

    setTimeout(async () => {
        if (pianoOverlayWindow) {
            await pianoOverlayWindow.setAlwaysOnTop(true);
            await pianoOverlayWindow.setFocus();
        }
    }, 500);

    videoWindow.once('tauri://close-requested', async () => {
        if (pianoOverlayWindow) await pianoOverlayWindow.close();
        videoWindow = null;
        pianoOverlayWindow = null;
        btn.textContent = "▶ PLAY";
    });

    btn.textContent = "Ⅱ PAUSE";
}