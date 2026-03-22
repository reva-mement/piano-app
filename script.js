// --- 1. 定数とグローバル変数 ---
const pianoCanvas = document.getElementById('piano-canvas');
const pianoNotes = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
const keyMap = {'a':'C','w':'Cs','s':'D','e':'Ds','d':'E','f':'F','t':'Fs','g':'G','y':'Gs','h':'A','u':'As','j':'B','k':'C'};

let midiPlayer, midiFiles = [], currentIndex = -1, currentOctave = 4;
let isRecording = false, recordedEvents = [], startTime = 0, userPlaybackTimeout = [];

// Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let reverbNode = audioCtx.createConvolver();

// --- 2. IndexedDB (保存機能) ---
const dbName = "MidiPianoDB", storeName = "midiFiles";
function openDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = e => e.target.result.createObjectStore(storeName, { keyPath: "name" });
        request.onsuccess = e => resolve(e.target.result);
    });
}
async function saveMidiToDB(name, data) {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put({ name, data });
}
async function loadAllMidisFromDB() {
    const db = await openDB();
    return new Promise(res => {
        const req = db.transaction(storeName).objectStore(storeName).getAll();
        req.onsuccess = () => res(req.result);
    });
}

// --- 3. 鍵盤作成 (3〜5オクターブ) ---
function createPiano() {
    if(!pianoCanvas) return;
    pianoCanvas.innerHTML = '';
    for (let oct = 3; oct <= 5; oct++) {
        pianoNotes.forEach(note => {
            const fullNote = note + oct;
            const keyDiv = document.createElement('div');
            keyDiv.className = `key ${note.includes('s') ? 'black' : 'white'}`;
            keyDiv.dataset.note = fullNote;
            keyDiv.onmousedown = () => playNote(fullNote);
            keyDiv.onmouseup = () => stopNote(fullNote);
            keyDiv.onmouseleave = () => stopNote(fullNote);
            pianoCanvas.appendChild(keyDiv);
        });
    }
}

// --- 4. 音と光の制御 ---
async function playNote(note, isMidi = false) {
    if (!note) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const conv = {"C#":"Cs","Db":"Cs","D#":"Ds","Eb":"Ds","F#":"Fs","Gb":"Fs","G#":"Gs","Ab":"Gs","A#":"As","Bb":"As"};
    let pitch = note.slice(0, -1), visualOct = note.slice(-1), soundOct = parseInt(visualOct);

    if (!isMidi) {
        soundOct = currentOctave + (note.endsWith('5') ? 1 : 0);
        if (isRecording) recordedEvents.push({ time: Date.now() - startTime, note, type: 'on' });
    }

    const soundId = (conv[pitch] || pitch) + soundOct;
    const visualId = (conv[pitch] || pitch) + visualOct;

    const key = document.querySelector(`[data-note="${visualId}"]`);
    if (key) key.classList.add(isMidi ? 'midi-active' : 'active');

    try {
        const resp = await fetch(`./assets/sounds/${soundId}.mp3`);
        const buf = await resp.arrayBuffer();
        const audioBuf = await audioCtx.decodeAudioData(buf);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(reverbNode);
        source.connect(audioCtx.destination);
        source.start(0);
    } catch (e) {
        console.warn("再生エラー:", soundId);
    }
}

function stopNote(note, isMidi = false) {
    if (!note) return;
    const conv = {"C#":"Cs","Db":"Cs","D#":"Ds","Eb":"Ds","F#":"Fs","Gb":"Fs","G#":"Gs","Ab":"Gs","A#":"As","Bb":"As"};
    const visualId = (conv[note.slice(0,-1)] || note.slice(0,-1)) + note.slice(-1);
    const key = document.querySelector(`[data-note="${visualId}"]`);
    if (key) key.classList.remove('active', 'midi-active');
    
    if (isRecording && !isMidi) recordedEvents.push({ time: Date.now() - startTime, note, type: 'off' });
}

// --- 5. プレイリスト & UI制御 ---
function renderPlaylist() {
    const ui = document.getElementById('midi-playlist');
    if (!ui) return;
    ui.innerHTML = '';
    midiFiles.forEach((f, i) => {
        const li = document.createElement('li');
        li.textContent = f.name;
        li.style.cssText = `padding:8px; border-bottom:1px solid #444; cursor:pointer; color:${i===currentIndex?'#f1c40f':'#eee'}; background:${i===currentIndex?'rgba(241,196,15,0.1)':'transparent'};`;
        li.onclick = () => selectMidi(i);
        ui.appendChild(li);
    });
}

function selectMidi(i) {
    if (!midiFiles[i]) return;
    currentIndex = i;
    document.getElementById('current-midi-title').textContent = midiFiles[i].name;
    if (midiPlayer) { 
        midiPlayer.stop(); 
        midiPlayer.loadArrayBuffer(midiFiles[i].data); 
    }
    renderPlaylist();
}

// --- 6. 初期化・イベント登録 ---
async function initApp() {
    createPiano();

    if (typeof MidiPlayer !== 'undefined') {
        midiPlayer = new MidiPlayer(function(event) {
            if (event.name === 'Note on' && event.velocity > 0) {
                playNote(event.noteName, true);
            } else if (event.name === 'Note off' || (event.name === 'Note on' && event.velocity === 0)) {
                stopNote(event.noteName, true);
            }
        });
    }

    const octLabel = document.getElementById('octave-label');
    const userBtn = document.getElementById('user-play-pause-btn');
    const midiBtn = document.getElementById('midi-play-pause-btn');

    // ユーザー再生管理
    let userPausedAt = 0;
    let userPlaybackStartTime = 0;

    // --- [左] OCTAVE ---
    document.getElementById('octave-up').onclick = () => {
        if (currentOctave < 7) { currentOctave++; octLabel.textContent = `オクターブ：${currentOctave}`; }
    };
    document.getElementById('octave-down').onclick = () => {
        if (currentOctave > 1) { currentOctave--; octLabel.textContent = `オクターブ：${currentOctave}`; }
    };

    // --- [中] USER REC ---
    document.getElementById('record-btn').onclick = function() {
        isRecording = !isRecording;
        this.classList.toggle('recording', isRecording);
        this.innerHTML = isRecording ? "■ STOP REC" : "● REC";
        if (isRecording) { recordedEvents = []; startTime = Date.now(); }
    };

    userBtn.onclick = () => {
        if (userBtn.innerHTML.includes("Play")) {
            userBtn.innerHTML = "Ⅱ Pause";
            const offset = userPausedAt;
            userPlaybackStartTime = Date.now() - offset;

            recordedEvents.forEach(ev => {
                if (ev.time < offset) return;
                const t = setTimeout(() => {
                    if (ev.type === 'on') playNote(ev.note);
                    else stopNote(ev.note);
                }, ev.time - offset);
                userPlaybackTimeout.push(t);
            });
        } else {
            userBtn.innerHTML = "▶ Play";
            userPausedAt = Date.now() - userPlaybackStartTime;
            userPlaybackTimeout.forEach(clearTimeout);
            userPlaybackTimeout = [];
        }
    };

    document.getElementById('user-stop-btn').onclick = () => {
        userPlaybackTimeout.forEach(clearTimeout);
        userPlaybackTimeout = [];
        userPausedAt = 0; 
        userBtn.innerHTML = "▶ Play";
        document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
    };

    // --- [右] MIDI PLAYER ---
    document.getElementById('midi-import-trigger').onclick = () => {
        // 重複しているinputのうち最初のものを確実にクリック
        document.querySelector('input[type="file"]').click();
    };

    midiBtn.onclick = () => {
        if (!midiPlayer) return;
        
        // ライブラリ内のメソッド isPlaying() を使用
        if (midiPlayer.isPlaying()) {
            midiPlayer.pause();
            midiBtn.innerHTML = "▶ Play";
        } else {
            midiPlayer.play();
            midiBtn.innerHTML = "Ⅱ Pause";
        }
    };

    document.getElementById('midi-stop-btn').onclick = () => {
        if (midiPlayer) {
            midiPlayer.stop();
            midiBtn.innerHTML = "▶ Play";
        }
        document.querySelectorAll('.key.midi-active').forEach(k => k.classList.remove('midi-active'));
    };

    // リバーブ読み込み
    fetch('./assets/sounds/reverb_ir.mp3').then(r=>r.arrayBuffer()).then(b=>audioCtx.decodeAudioData(b)).then(d=>{
        reverbNode.buffer=d; 
        reverbNode.connect(audioCtx.destination);
    });

    const saved = await loadAllMidisFromDB();
    if (saved && saved.length > 0) { 
        midiFiles = saved; 
        renderPlaylist(); 
        selectMidi(0); 
    }
}

// ファイル選択イベント（共通）
document.addEventListener('change', async (e) => {
    if (e.target.type === 'file' && e.target.accept.includes('.mid')) {
        for (const f of e.target.files) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const name = f.name.replace(/\.[^/.]+$/, "");
                const midiData = ev.target.result;
                midiFiles.push({ name, data: midiData });
                await saveMidiToDB(name, midiData);
                renderPlaylist();
                if (midiFiles.length === 1) selectMidi(0);
            };
            reader.readAsArrayBuffer(f);
        }
    }
});

const importBtn = document.getElementById('midi-import-button');
if(importBtn) importBtn.onclick = () => document.querySelector('input[type="file"]').click();

window.onkeydown = (e) => { 
    if(!e.repeat){ 
        const n = keyMap[e.key.toLowerCase()]; 
        if(n) playNote(n + (e.key==='k'?5:4)); 
    } 
};
window.onkeyup = (e) => { 
    const n = keyMap[e.key.toLowerCase()]; 
    if(n) stopNote(n + (e.key==='k'?5:4)); 
};

// --- 終了ボタン (安全停止プロトコル) ---
    const exitBtn = document.getElementById('exit-button');
    if (exitBtn) {
        exitBtn.onclick = async () => {
            // 1. 録音中の場合は停止させてデータを保護
            if (isRecording) {
                isRecording = false;
                const recBtn = document.getElementById('record-btn');
                if (recBtn) {
                    recBtn.classList.remove('recording');
                    recBtn.innerHTML = "● REC";
                }
            }

            // 2. MIDI再生を停止（オーディオの安全な解放）
            if (midiPlayer) {
                midiPlayer.stop();
            }

            // 3. Tauri v2 用の終了コマンド実行
            if (window.__TAURI__) {
                try {
                    // v2 の標準的な呼び出し
                    await window.__TAURI__.core.invoke('kill_app');
                } catch (e) {
                    console.error("Tauri終了エラー:", e);
                    // 万が一のフォールバック
                    window.close();
                }
            } else {
                if (confirm("アプリケーションを終了しますか？")) window.close();
            }
        };
    }
    
initApp();