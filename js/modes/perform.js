// 1. インポートを先頭にまとめる
import { extractVideoId, showModal } from '../utils.js';

// --- 安全装置：Tauri環境かどうかを確認 ---
// ブラウザ版では window.__TAURI__ が存在しないため、エラーにならないように取得
const isTauri = !!window.__TAURI__;
const WebviewWindow = isTauri ? window.__TAURI__.webviewWindow.WebviewWindow : null;

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
                        // alertの代わりにブラウザでも動く簡易表示、またはshowModalを再度利用
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
        showModal(alertHtml, () => {
            console.log("Alert closed");
        });
        return;
    }

    const btn = document.getElementById('video-play-btn');

    // --- ブラウザ環境（GitHub Pages等）での動作制限 ---
    if (!isTauri || !WebviewWindow) {
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
        await videoWindow.close();
        if (pianoOverlayWindow) await pianoOverlayWindow.close();
        videoWindow = null;
        pianoOverlayWindow = null;
        if (btn) btn.textContent = "▶ PLAY";
        return;
    }

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
        if (btn) btn.textContent = "▶ PLAY";
    });

    if (btn) btn.textContent = "Ⅱ PAUSE";
}
