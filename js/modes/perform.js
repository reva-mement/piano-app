// 1. インポートを先頭にまとめる
import { extractVideoId, showModal } from '../utils.js';

/**
 * 安全に WebviewWindow クラスを取得するヘルパー関数
 * 読み込み時ではなく、ボタンが押された際などに実行することでエラーを回避します
 */
function getTauriWebviewWindow() {
    try {
        // window.__TAURI__ が存在するか、その先に目的のクラスがあるかを段階的にチェック
        if (window && window.__TAURI__ && window.__TAURI__.webviewWindow) {
            return window.__TAURI__.webviewWindow.WebviewWindow;
        }
    } catch (e) {
        console.warn("Tauri API is not available in this environment.");
    }
    return null;
}

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

    // IMPORTボタンの処理
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
                        console.warn("Invalid URL");
                    }
                }
            });
        };
    }
}

// 3. 窓の生成ロジック
async function handlePerformStart(url) {
    if (!url || url === "No Video Loaded" || url === "") {
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
        showModal(alertHtml);
        return;
    }

    const btn = document.getElementById('video-play-btn');
    
    // --- 実行時に Tauri API を取得（超安全ガード） ---
    const WebviewWindow = getTauriWebviewWindow();

    // --- ブラウザ環境（GitHub Pages等）での動作制限 ---
    if (!WebviewWindow) {
        console.log("Web Mode: Perform session (Multi-window) is only available in Desktop App.");
        const webNoticeHtml = `
            <div style="text-align: center; padding: 10px;">
                <p style="color: #e0d0b0;">マルチウィンドウ演奏モードは<br>デスクトップ版（Tauri）専用機能です。</p>
                <button class="modal-confirm-btn" style="margin-top:15px; padding: 5px 20px;">閉じる</button>
            </div>
        `;
        showModal(webNoticeHtml);
        return; 
    }

    // --- 以下、Tauri環境（デスクトップ版）のみ実行される処理 ---
    const videoId = extractVideoId(url);

    if (videoWindow) {
        try {
            await videoWindow.close();
            if (pianoOverlayWindow) await pianoOverlayWindow.close();
        } catch (e) {
            console.error("Window close error:", e);
        }
        videoWindow = null;
        pianoOverlayWindow = null;
        if (btn) btn.textContent = "▶ PLAY";
        return;
    }

    try {
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
            if (pianoOverlayWindow && pianoOverlayWindow.setAlwaysOnTop) {
                await pianoOverlayWindow.setAlwaysOnTop(true);
                await pianoOverlayWindow.setFocus();
            }
        }, 500);

        videoWindow.once('tauri://close-requested', async () => {
            if (pianoOverlayWindow) await pianoOverlayWindow.close();
            videoWindow = null;
            pianoOverlayWindow = null;
            if (btn) btn.textContent = "▶ PLAY";
        });

        if (btn) btn.textContent = "Ⅱ PAUSE";

    } catch (err) {
        console.error("Tauri window creation failed:", err);
    }
}
