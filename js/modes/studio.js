// src/js/modes/studio.js
import { isNoteInView, highlightGuideKey, showModal } from '../utils.js';

// --- 状態管理 ---
let midiPlayer = null;
let isMidiLoaded = false;
let pendingGuideNotes = new Set();

// 録音データ用
let recordedEvents = [];
let startTime = 0;
let isRecording = false;

// --- 録音関数（piano.jsから呼ばれる） ---
export function recordStudioEvent(type, noteNumber, velocity = 0) {
    if (!isRecording) return;
    recordedEvents.push({
        type: type,         // 'noteOn' または 'noteOff'
        note: noteNumber,
        velocity: velocity,
        timestamp: performance.now() - startTime
    });
}
// グローバルに紐付け
window.recordStudioEvent = recordStudioEvent;

// --- モード初期化 ---
export async function initStudioMode(loadedMidiDataGetter) {
    try {
        const Lib = await import('../../midiplayer.js');
        const DefaultExport = Lib.default;
        let PlayerConstructor = DefaultExport?.Player || DefaultExport || Lib.Player;

        if (PlayerConstructor) {
            midiPlayer = new PlayerConstructor((event) => {
                handleMidiEvent(event);
            });

            midiPlayer.on('endOfFile', () => { handleStopMIDI(); });

            // UIボタンの紐付け
            setupStudioUI(loadedMidiDataGetter);
            
            window.midiPlayerInstance = midiPlayer;
        }
    } catch (e) { console.warn("Studio Setup Error:", e.message); }
}

// --- 内部処理：MIDIイベント受信時 ---
function handleMidiEvent(event) {
    const eventName = event.name || event.messageType; 
    let noteName = event.noteName;
    if (!noteName) return;

    // ノート名の変換 (Bb -> Asなど)
    const flatToSharp = { 'db': 'cs', 'eb': 'ds', 'gb': 'fs', 'ab': 'gs', 'bb': 'as' };
    let convertedNote = noteName.toLowerCase().replace('#', 's');
    for (let flat in flatToSharp) {
        if (convertedNote.startsWith(flat)) {
            convertedNote = convertedNote.replace(flat, flatToSharp[flat]);
            break;
        }
    }
    const formattedNote = convertedNote.charAt(0).toUpperCase() + convertedNote.slice(1);

    if (document.body.classList.contains('performance-mode')) return;

    const guideActive = !!window.isGuideMode; 
    const inView = isNoteInView(formattedNote);

    // Note On
    if ((eventName === 'Note on' || eventName === 'NoteOn') && event.velocity > 0) {
        if (guideActive && inView) {
            // ガイドモード：一時停止して待機
            midiPlayer.pause();
            window.isPlaying = false;
            pendingGuideNotes.add(formattedNote);
            highlightGuideKey(formattedNote); 
            updatePlayButtonUI(true); // "▶ PLAY" 表示に
        } else {
            if (window.playNote) window.playNote(formattedNote, true); 
        }
    } 
    // Note Off
    if (eventName === 'Note off' || eventName === 'NoteOff' || (event.velocity === 0)) {
        if (window.stopNote) window.stopNote(formattedNote, true);
    }
}

// --- UIイベント設定 ---
function setupStudioUI(loadedMidiDataGetter) {
    // PLAYボタン
    const studioPlayBtn = document.querySelector('#tag-studio .play-stamp');
    if (studioPlayBtn) {
        studioPlayBtn.onclick = (e) => {
            e.stopPropagation();
            handlePlayProgress(studioPlayBtn, loadedMidiDataGetter());
        };
    }

    // STOPボタン
    const stopBtn = document.querySelector('#tag-studio .stop-stamp');
    if (stopBtn) {
        stopBtn.onclick = (e) => {
            e.stopPropagation();
            handleStopMIDI();
        };
    }

    // GUIDEボタン
    const guideBtn = document.querySelector('#tag-studio .guide-stamp');
    if (guideBtn) {
        guideBtn.onclick = (e) => {
            e.stopPropagation();
            window.isGuideMode = !window.isGuideMode;
            guideBtn.classList.toggle('active', window.isGuideMode);
            guideBtn.textContent = window.isGuideMode ? "GUIDE ON" : "GUIDE OFF";
        };
    }

    // ● RECボタン
    const recBtn = document.querySelector('#tag-studio .record-stamp');
    if (recBtn) {
        recBtn.onclick = (e) => {
            e.stopPropagation();
            isRecording = !isRecording;
            if (isRecording) {
                recordedEvents = [];
                startTime = performance.now();
                recBtn.classList.add('active');
                recBtn.textContent = "● REC ON";
                console.log("Recording started...");
            } else {
                recBtn.classList.remove('active');
                recBtn.textContent = "● REC";
                console.log("Recording stopped. Data:", recordedEvents);
                if (recordedEvents.length > 0) console.table(recordedEvents);
            }
        };
    }
}

// --- 再生・一時停止の制御 ---
function handlePlayProgress(btn, loadedMidiData) {
    if (!midiPlayer || !loadedMidiData) {
        showModal(`<div style="text-align:center;padding:10px;"><p>MIDIデータを読み込んでください。</p><button class="modal-confirm-btn">OK</button></div>`);
        return;
    }

    if (midiPlayer.isPlaying && midiPlayer.isPlaying()) {
        midiPlayer.pause();
        btn.textContent = "▶ PLAY";
        btn.classList.add('paused');
        window.isPlaying = false;
    } else {
        if (!isMidiLoaded) {
            midiPlayer.loadArrayBuffer(loadedMidiData);
            isMidiLoaded = true;
        }
        midiPlayer.play();
        btn.textContent = "Ⅱ PAUSE";
        btn.classList.remove('paused');
        window.isPlaying = true;
    }
}

// --- 停止処理 ---
export function handleStopMIDI() {
    if (!midiPlayer) return;
    midiPlayer.stop();
    pendingGuideNotes.clear();
    updatePlayButtonUI(false);
    document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
    window.isPlaying = false;
}

// UI更新補助
function updatePlayButtonUI(isPaused) {
    const playBtn = document.querySelector('#tag-studio .play-stamp');
    if (playBtn) {
        playBtn.textContent = isPaused ? "▶ PLAY" : "▶ PLAY";
        if (isPaused) playBtn.classList.add('paused');
        else playBtn.classList.remove('paused');
    }
}

// ガイド解決
window.resolveGuideNote = function(noteName) {
    if (pendingGuideNotes.has(noteName)) {
        pendingGuideNotes.delete(noteName);
        const keyElement = document.querySelector(`.key[data-note="${noteName}"]`);
        if (keyElement) {
            keyElement.style.backgroundColor = "";
            keyElement.style.boxShadow = "";
        }
        if (pendingGuideNotes.size === 0 && window.isGuideMode && midiPlayer) {
            midiPlayer.play();
            window.isPlaying = true;
            const playBtn = document.querySelector('#tag-studio .play-stamp');
            if (playBtn) {
                playBtn.textContent = "Ⅱ PAUSE";
                playBtn.classList.remove('paused');
            }
        }
    }
};