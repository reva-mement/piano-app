/* --- src/js/instruments/piano.js 最終修正版 --- */

const WHITE_KEY_WIDTH_VW = 4.7619;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
window.audioContext = audioCtx;
const audioBufferCache = {};
const activeSources = new Map();
const DEFAULT_VOLUME = 0.6;

// 💥 フラットをシャープに変換するマップ（高音域の音抜け対策）
const FLAT_TO_SHARP = {
    'Db': 'Cs', 'Eb': 'Ds', 'Gb': 'Fs', 'Ab': 'Gs', 'Bb': 'As'
};

// 窓口を即座に作成
window.playNote = (raw) => console.warn("Piano not yet initialized, but play called:", raw);
window.stopNote = (raw) => {};

// window.pianoGain として公開し、外部（main.js）から操作可能にする
window.pianoGain = audioCtx.createGain();
window.pianoGain.gain.setValueAtTime(0.5, audioCtx.currentTime); // 初期値を50%に
window.pianoGain.connect(audioCtx.destination);

const PIANO_KEYS = [
    { n: 'A0', t: 'white' }, { n: 'As0', t: 'black' }, { n: 'B0', t: 'white' },
    { n: 'C1', t: 'white' }, { n: 'Cs1', t: 'black' }, { n: 'D1', t: 'white' }, { n: 'Ds1', t: 'black' }, { n: 'E1', t: 'white' }, { n: 'F1', t: 'white' }, { n: 'Fs1', t: 'black' }, { n: 'G1', t: 'white' }, { n: 'Gs1', t: 'black' }, { n: 'A1', t: 'white' }, { n: 'As1', t: 'black' }, { n: 'B1', t: 'white' },
    { n: 'C2', t: 'white' }, { n: 'Cs2', t: 'black' }, { n: 'D2', t: 'white' }, { n: 'Ds2', t: 'black' }, { n: 'E2', t: 'white' }, { n: 'F2', t: 'white' }, { n: 'Fs2', t: 'black' }, { n: 'G2', t: 'white' }, { n: 'Gs2', t: 'black' }, { n: 'A2', t: 'white' }, { n: 'As2', t: 'black' }, { n: 'B2', t: 'white' },
    { n: 'C3', t: 'white' }, { n: 'Cs3', t: 'black' }, { n: 'D3', t: 'white' }, { n: 'Ds3', t: 'black' }, { n: 'E3', t: 'white' }, { n: 'F3', t: 'white' }, { n: 'Fs3', t: 'black' }, { n: 'G3', t: 'white' }, { n: 'Gs3', t: 'black' }, { n: 'A3', t: 'white' }, { n: 'As3', t: 'black' }, { n: 'B3', t: 'white' },
    { n: 'C4', t: 'white' }, { n: 'Cs4', t: 'black' }, { n: 'D4', t: 'white' }, { n: 'Ds4', t: 'black' }, { n: 'E4', t: 'white' }, { n: 'F4', t: 'white' }, { n: 'Fs4', t: 'black' }, { n: 'G4', t: 'white' }, { n: 'Gs4', t: 'black' }, { n: 'A4', t: 'white' }, { n: 'As4', t: 'black' }, { n: 'B4', t: 'white' },
    { n: 'C5', t: 'white' }, { n: 'Cs5', t: 'black' }, { n: 'D5', t: 'white' }, { n: 'Ds5', t: 'black' }, { n: 'E5', t: 'white' }, { n: 'F5', t: 'white' }, { n: 'Fs5', t: 'black' }, { n: 'G5', t: 'white' }, { n: 'Gs5', t: 'black' }, { n: 'A5', t: 'white' }, { n: 'As5', t: 'black' }, { n: 'B5', t: 'white' },
    { n: 'C6', t: 'white' }, { n: 'Cs6', t: 'black' }, { n: 'D6', t: 'white' }, { n: 'Ds6', t: 'black' }, { n: 'E6', t: 'white' }, { n: 'F6', t: 'white' }, { n: 'Fs6', t: 'black' }, { n: 'G6', t: 'white' }, { n: 'Gs6', t: 'black' }, { n: 'A6', t: 'white' }, { n: 'As6', t: 'black' }, { n: 'B6', t: 'white' },
    { n: 'C7', t: 'white' }, { n: 'Cs7', t: 'black' }, { n: 'D7', t: 'white' }, { n: 'Ds7', t: 'black' }, { n: 'E7', t: 'white' }, { n: 'F7', t: 'white' }, { n: 'Fs7', t: 'black' }, { n: 'G7', t: 'white' }, { n: 'Gs7', t: 'black' }, { n: 'A7', t: 'white' }, { n: 'As7', t: 'black' }, { n: 'B7', t: 'white' },
    { n: 'C8', t: 'white' }
];

const KEY_LAYOUT = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '^', '\\',
    'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '@', '[',
    'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', ':', ']',
    'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', '_'
];

let keyAssignments = new Map();

// 💥 修正版：あらゆる音名表記をプログラム用(Cs4など)に変換
function formatNoteName(note) {
    if (typeof note !== 'string') return note;
    let n = note.trim();
    // フラットをシャープへ (Bb4 -> As4)
    for (let flat in FLAT_TO_SHARP) {
        if (n.startsWith(flat)) {
            n = FLAT_TO_SHARP[flat] + n.slice(flat.length);
            break;
        }
    }
    return n.replace('#', 's').replace('S', 's').replace(/\s+/g, ''); // 空白も完全除去
}

async function preloadSounds() {
    console.log("Piano: Starting 88-key sound preload...");
    const loadPromises = PIANO_KEYS.map(key => {
        const id = key.n;
        return fetch(`./assets/sounds/${id}.mp3`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.arrayBuffer();
            })
            .then(buf => audioCtx.decodeAudioData(buf))
            .then(decoded => { audioBufferCache[id] = decoded; })
            .catch(err => console.error(`Failed to load ${id}:`, err));
    });
    await Promise.allSettled(loadPromises);
    console.log(`Piano: Preload complete. ${Object.keys(audioBufferCache).length} sounds ready.`);
}

function updateIndividualMapping() {
    const viewport = document.getElementById('piano-viewport');
    const canvas = document.getElementById('piano-canvas');
    if (!viewport || !canvas) return;

    const scrollLeft = viewport.scrollLeft;
    const viewportWidth = viewport.clientWidth;
    const keys = Array.from(canvas.querySelectorAll('.key'));

    keyAssignments.clear();

    const visibleKeys = keys.filter(el => {
        return (el.offsetLeft + el.offsetWidth > scrollLeft) && (el.offsetLeft < scrollLeft + viewportWidth);
    });

    visibleKeys.forEach((el, index) => {
        if (index < KEY_LAYOUT.length) {
            keyAssignments.set(KEY_LAYOUT[index], el.dataset.note);
        }
    });

    document.querySelectorAll('.key-label').forEach(label => {
        const note = label.parentElement.dataset.note;
        let foundKey = "";
        for (let [k, n] of keyAssignments) {
            if (n === note) { foundKey = k; break; }
        }
        label.innerText = foundKey;
    });
}

/**
 * 鍵盤を鳴らす関数
 * @param {string} rawNote - ノート名
 * @param {boolean} isAuto - MIDIプレイヤーからの自動演奏なら true、ユーザーなら false
 */
/**
 * 鍵盤を鳴らす関数
 * @param {string} rawNote - ノート名
 * @param {boolean} isAuto - MIDIプレイヤーからの自動演奏なら true、ユーザーなら false
 */
function playNote(rawNote, isAuto = false) {
    const note = formatNoteName(rawNote); 
    
    if (!note || !audioBufferCache[note]) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // --- 【Studioモード：録音処理】 ---
    // ユーザー自身が弾いた音 (!isAuto) の場合のみ、録音関数を呼び出す
    if (!isAuto && typeof window.recordStudioEvent === 'function') {
        window.recordStudioEvent('noteOn', note, 100); 
    }

    // --- 【修正】ガイド演奏の解決ロジック ---
    if (!isAuto && typeof window.resolveGuideNote === 'function') {
        window.resolveGuideNote(note);
    }
    // ----------------------------------------

    const keyEl = document.querySelector(`.key[data-note="${note}"]`);
    if (keyEl) keyEl.classList.add('active');

    // --- 以降、発音処理（既存のまま） ---
    if (activeSources.has(note)) {
        const old = activeSources.get(note);
        try {
            old.gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
            old.source.stop(audioCtx.currentTime + 0.1);
        } catch(e) {}
        activeSources.delete(note);
    }

    const source = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain();
    const now = audioCtx.currentTime;
    
    const currentVol = (window.pianoGain && window.pianoGain.gain) 
                        ? window.pianoGain.gain.value 
                        : (typeof DEFAULT_VOLUME !== 'undefined' ? DEFAULT_VOLUME : 0.5);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(currentVol, now + 0.01);
    
    source.buffer = audioBufferCache[note];
    
    if (window.pianoGain) {
        source.connect(gainNode).connect(window.pianoGain);
    } else {
        source.connect(gainNode).connect(audioCtx.destination);
    }
    
    source.start(now);
    activeSources.set(note, { source, gainNode });
}

function stopNote(rawNote, isAuto = false) { // 引数に isAuto を追加（デフォルトfalse）
    const note = formatNoteName(rawNote);
    if (!note) return;

    // --- 【Studioモード：録音処理】 ---
    if (!isAuto && typeof window.recordStudioEvent === 'function') {
        window.recordStudioEvent('noteOff', note);
    }
    
    const keyEl = document.querySelector(`.key[data-note="${note}"]`);
    if (keyEl) keyEl.classList.remove('active');
    
    if (activeSources.has(note)) {
        const { source, gainNode } = activeSources.get(note);
        const now = audioCtx.currentTime;
        
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        try { source.stop(now + 0.35); } catch(e) {}
        
        setTimeout(() => {
            if (activeSources.get(note)?.source === source) {
                activeSources.delete(note);
            }
        }, 400);
    }
}

export function initPiano() {
    const viewport = document.getElementById('piano-viewport');
    const canvas = document.getElementById('piano-canvas');
    const minimapFrame = document.getElementById('minimap-viewport-frame');
    const liveBtn = document.getElementById('btn-live-mode');
    const uiLayer = document.getElementById('ui-layer');
    const pianoView = document.getElementById('view-piano');

    if (!canvas || !viewport) return;

    canvas.innerHTML = PIANO_KEYS.map(k => `
        <div class="key ${k.t}" data-note="${k.n}">
            <div class="key-label"></div>
        </div>`).join('');

    const whiteKeysCount = PIANO_KEYS.filter(k => k.t === 'white').length;
    canvas.style.width = `${whiteKeysCount * WHITE_KEY_WIDTH_VW}vw`;

    if (liveBtn && uiLayer && pianoView) {
        liveBtn.addEventListener('click', () => {
            const isNowLive = pianoView.classList.toggle('is-live');
            uiLayer.style.display = isNowLive ? 'none' : 'block';
        });
    }

    let scrollVelocity = 0; 
    const SCROLL_SPEED_BASE = 10; 

    function handleContinuousScroll() {
        if (scrollVelocity !== 0) {
            viewport.scrollLeft += scrollVelocity;
        }
        requestAnimationFrame(handleContinuousScroll);
    }
    requestAnimationFrame(handleContinuousScroll);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && pianoView.classList.contains('is-live')) {
            pianoView.classList.remove('is-live');
            uiLayer.style.display = 'block';
            return;
        }

        const key = e.key.toUpperCase();
        if (key === 'ARROWRIGHT' || key === 'ARROWLEFT') {
            const direction = (key === 'ARROWRIGHT' ? 1 : -1);
            scrollVelocity = direction * SCROLL_SPEED_BASE * (e.ctrlKey ? 3 : 1);
            e.preventDefault();
            return;
        }

        if (e.repeat) return;
        const note = keyAssignments.get(key);
        if (note) playNote(note);
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toUpperCase();
        if (key === 'ARROWRIGHT' || key === 'ARROWLEFT') {
            scrollVelocity = 0;
            return;
        }
        const note = keyAssignments.get(key);
        if (note) stopNote(note);
    });

// 1. マウスを押した瞬間
    canvas.addEventListener('mousedown', (e) => {
        const keyEl = e.target.closest('.key');
        if (keyEl) {
            window.isMouseDown = true; // 「今マウスを押してるよ」という目印を立てる
            playNote(keyEl.dataset.note);
        }
    });

    // 2. マウスが鍵盤の上に乗った時（スライド演奏用）
    canvas.addEventListener('mouseover', (e) => {
        // マウスが押された状態のまま移動してきた時だけ音を鳴らす
        if (window.isMouseDown) { 
            const keyEl = e.target.closest('.key');
            if (keyEl) playNote(keyEl.dataset.note);
        }
    });

    // 3. マウスが鍵盤から外れた時（スライド演奏用）
    canvas.addEventListener('mouseout', (e) => {
        const keyEl = e.target.closest('.key');
        if (keyEl) stopNote(keyEl.dataset.note);
    });

    // 4. 画面のどこでもマウスを離したら「目印」を下ろす
    window.addEventListener('mouseup', () => {
        window.isMouseDown = false;
    });

    const sync = () => {
        if (minimapFrame) {
            minimapFrame.style.left = (viewport.scrollLeft / viewport.scrollWidth * 100) + "%";
            minimapFrame.style.width = (viewport.clientWidth / viewport.scrollWidth * 100) + "%";
        }
        updateIndividualMapping(); 
    };
    
    viewport.addEventListener('scroll', sync);

    preloadSounds().then(() => {
        setTimeout(() => {
            viewport.scrollLeft = (viewport.scrollWidth / whiteKeysCount) * 23;
            sync();
            window.playNote = playNote;
            window.stopNote = stopNote;
            console.log("Piano: Initialized and global methods registered.");
        }, 300);
    });
}

function releaseAllKeys() {
    document.querySelectorAll('.key.active').forEach(key => {
        key.classList.remove('active');
        stopNote(key.dataset.note);
    });
}

window.addEventListener('mouseup', releaseAllKeys);

/**
 * 【Studioモード用】
 * 鍵盤の見た目（.activeクラス）を維持したまま、鳴っている音だけを強制的に消去します。
 */
window.stopAllSoundsOnly = function() {
    console.log("Piano: Stopping all sounds while keeping key states.");
    
    activeSources.forEach((value, note) => {
        const { source, gainNode } = value;
        const now = audioCtx.currentTime;

        try {
            // 音量を一瞬で 0 にする（0.05秒のフェードでプツッというノイズを防ぐ）
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setTargetAtTime(0, now, 0.05);
            
            // 少し後にソース自体も停止させてメモリを解放する
            source.stop(now + 0.1);
        } catch (e) {
            // すでに止まっている場合は無視
        }
    });

    // 鳴り終わったのでリストを空にする（鍵盤の .active は消さない！）
    activeSources.clear();
};