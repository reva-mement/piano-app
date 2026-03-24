// --- 0. 画面サイズ・倍率の固定設定 (維持) ---
function lockWindowSize() {
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === '=' || e.key === '-' || e.key === '0')) {
            e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });

    if (window.__TAURI__) {
        try {
            const { getCurrent } = window.__TAURI__.window;
            const appWindow = getCurrent();
            appWindow.setSize(new window.__TAURI__.window.LogicalSize(1300, 800));
            appWindow.setResizable(false);
            appWindow.setMaximizable(false);
        } catch (e) {}
    }
}

// --- 1. 定数とグローバル変数 (維持) ---
const pianoCanvas = document.getElementById('piano-canvas');
const pianoNotes = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
const keyMap = {'a':'C','w':'Cs','s':'D','e':'Ds','d':'E','f':'F','t':'Fs','g':'G','y':'Gs','h':'A','u':'As','j':'B','k':'C'};

let midiPlayer, midiFiles = [], currentIndex = -1, currentOctave = 4;
let isRecording = false, recordedEvents = [], startTime = 0, userPlaybackTimeout = [];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const audioBufferCache = {}; 
const activeSources = new Map();

let reverbNode = audioCtx.createConvolver();
let mainGain = audioCtx.createGain();
mainGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
mainGain.connect(audioCtx.destination);

// --- 2. IndexedDB (維持) ---
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

// --- 3. 鍵盤作成 (維持) ---
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

// プリロード (維持)
async function preloadSounds() {
    for (let oct = 1; oct <= 8; oct++) {
        pianoNotes.forEach(note => {
            const id = note + oct;
            fetch(`./assets/sounds/${id}.mp3`)
                .then(r => r.arrayBuffer())
                .then(buf => audioCtx.decodeAudioData(buf))
                .then(decoded => { audioBufferCache[id] = decoded; })
                .catch(() => {});
        });
    }
    fetch('./assets/sounds/reverb_ir.mp3')
        .then(r => r.arrayBuffer())
        .then(b => audioCtx.decodeAudioData(b))
        .then(d => { reverbNode.buffer = d; reverbNode.connect(mainGain); })
        .catch(() => {});
}

// --- 4. 音と光の制御 (維持) ---
function playNote(note, isMidi = false) {
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

    if (audioBufferCache[soundId]) {
        if (activeSources.has(soundId)) {
            const old = activeSources.get(soundId);
            try { 
                const fadeNow = audioCtx.currentTime;
                old.gainNode.gain.linearRampToValueAtTime(0, fadeNow + 0.05);
                old.source.stop(fadeNow + 0.1); 
            } catch(e){}
        }

        const source = audioCtx.createBufferSource();
        const gainNode = audioCtx.createGain();
        source.buffer = audioBufferCache[soundId];

        const shelf = audioCtx.createBiquadFilter();
        shelf.type = "highshelf";
        shelf.frequency.setValueAtTime(8000, audioCtx.currentTime);
        shelf.gain.setValueAtTime(4, audioCtx.currentTime); 

        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);

        source.connect(shelf);
        shelf.connect(gainNode);
        gainNode.connect(mainGain);
        
        if (reverbNode.buffer) {
            const reverbSend = audioCtx.createGain();
            reverbSend.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.connect(reverbSend);
            reverbSend.connect(reverbNode);
        }

        source.start(0);
        activeSources.set(soundId, { source, gainNode });
    }
}

function stopNote(note, isMidi = false) {
    if (!note) return;
    const conv = {"C#":"Cs","Db":"Cs","D#":"Ds","Eb":"Ds","F#":"Fs","Gb":"Fs","G#":"Gs","Ab":"Gs","A#":"As","Bb":"As"};
    const pitch = note.slice(0,-1), visualOct = note.slice(-1);
    const visualId = (conv[pitch] || pitch) + visualOct;
    
    let soundOct = parseInt(visualOct);
    if (!isMidi) soundOct = currentOctave + (note.endsWith('5') ? 1 : 0);
    const soundId = (conv[pitch] || pitch) + soundOct;

    const key = document.querySelector(`[data-note="${visualId}"]`);
    if (key) key.classList.remove('active', 'midi-active');
    
    if (activeSources.has(soundId)) {
        const { source, gainNode } = activeSources.get(soundId);
        const now = audioCtx.currentTime;
        
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4); 
        source.stop(now + 0.5);
        activeSources.delete(soundId);
    }
    
    if (isRecording && !isMidi) recordedEvents.push({ time: Date.now() - startTime, note, type: 'off' });
}

// --- 5. YouTubeプレイヤー制御 (維持) ---
function loadYouTube() {
    const urlInput = document.getElementById('youtube-url-input');
    const player = document.getElementById('youtube-player');
    if (!urlInput || !player) return;

    const url = urlInput.value;
    let videoId = '';

    if (url.includes('v=')) {
        videoId = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('embed/')) {
        videoId = url.split('embed/')[1].split('?')[0];
    }

    if (videoId) {
        player.src = `https://www.youtube.com/embed/${videoId}?mute=1&enablejsapi=1`;
    } else {
        alert("有効なYouTubeのURLを入力してください");
    }
}

// --- 6. プレイリスト & UI制御 (維持) ---
function renderPlaylist() {
    const ui = document.getElementById('midi-playlist');
    if (!ui) return;
    ui.innerHTML = '';
    midiFiles.forEach((f, i) => {
        const li = document.createElement('li');
        li.textContent = f.name;
        li.style.cssText = `padding:8px; border-bottom:1px solid #444; cursor:pointer; color:${i===currentIndex?'#f1c40f':'#eee'}; background:${i===currentIndex?'rgba(255,255,255,0.1)':'transparent'};`;
        li.onclick = () => selectMidi(i);
        ui.appendChild(li);
    });
}

function selectMidi(i) {
    if (!midiFiles[i]) return;
    currentIndex = i;
    const title = document.getElementById('current-midi-title');
    if(title) title.textContent = midiFiles[i].name;
    if (midiPlayer) { midiPlayer.stop(); midiPlayer.loadArrayBuffer(midiFiles[i].data); }
    renderPlaylist();
}

// --- 7. 初期化・全イベント登録 ---
async function initApp() {
    lockWindowSize();
    createPiano();
    preloadSounds();

    if (typeof MidiPlayer !== 'undefined') {
        midiPlayer = new MidiPlayer(function(event) {
            if (event.name === 'Note on' && event.velocity > 0) playNote(event.noteName, true);
            else if (event.name === 'Note off' || (event.name === 'Note on' && event.velocity === 0)) stopNote(event.noteName, true);
        });
    }

    const octLabel = document.getElementById('octave-label');
    const userBtn = document.getElementById('user-play-pause-btn');
    const midiBtn = document.getElementById('midi-play-pause-btn');
    let userPausedAt = 0, userPlaybackStartTime = 0;

    document.getElementById('octave-up').onclick = () => { if (currentOctave < 7) { currentOctave++; if(octLabel) octLabel.textContent = `オクターブ：${currentOctave}`; } };
    document.getElementById('octave-down').onclick = () => { if (currentOctave > 1) { currentOctave--; if(octLabel) octLabel.textContent = `オクターブ：${currentOctave}`; } };

    document.getElementById('record-btn').onclick = function() {
        isRecording = !isRecording;
        this.classList.toggle('recording', isRecording);
        this.innerHTML = isRecording ? "■ STOP REC" : "● REC";
        if (isRecording) { recordedEvents = []; startTime = Date.now(); }
    };

    if(userBtn) userBtn.onclick = () => {
        if (userBtn.innerHTML.includes("Play")) {
            userBtn.innerHTML = "Ⅱ Pause";
            const offset = userPausedAt;
            userPlaybackStartTime = Date.now() - offset;
            recordedEvents.forEach(ev => {
                if (ev.time < offset) return;
                const t = setTimeout(() => { if (ev.type === 'on') playNote(ev.note); else stopNote(ev.note); }, ev.time - offset);
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
        userPausedAt = 0; if(userBtn) userBtn.innerHTML = "▶ Play";
        document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
    };

    // 修正1: querySelectorをgetElementByIdに変更し、対象を明確化
    const midiImportTrigger = document.getElementById('midi-import-trigger');
    const midiImportButton = document.getElementById('midi-import-button');
    const midiUploadElement = document.getElementById('midi-upload');

    const triggerAction = () => { if(midiUploadElement) midiUploadElement.click(); };
    if(midiImportTrigger) midiImportTrigger.onclick = triggerAction;
    if(midiImportButton) midiImportButton.onclick = triggerAction;

    if(midiBtn) midiBtn.onclick = () => {
        if (!midiPlayer) return;
        midiPlayer.isPlaying() ? (midiPlayer.pause(), midiBtn.innerHTML = "▶ Play") : (midiPlayer.play(), midiBtn.innerHTML = "Ⅱ Pause");
    };

    document.getElementById('midi-stop-btn').onclick = () => {
        if (midiPlayer) midiPlayer.stop();
        if(midiBtn) midiBtn.innerHTML = "▶ Play";
        document.querySelectorAll('.key.midi-active').forEach(k => k.classList.remove('midi-active'));
    };

    const ytLoadBtn = document.getElementById('load-youtube-btn');
    if (ytLoadBtn) ytLoadBtn.onclick = loadYouTube;

    const saved = await loadAllMidisFromDB();
    if (saved && saved.length > 0) { midiFiles = saved; renderPlaylist(); selectMidi(0); }
}

document.addEventListener('change', async (e) => {
    // 修正2: input[type="file"]全般ではなく、特定のIDに反応させる
    if (e.target.id === 'midi-upload') {
        for (const f of e.target.files) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const name = f.name.replace(/\.[^/.]+$/, "");
                midiFiles.push({ name, data: ev.target.result });
                await saveMidiToDB(name, ev.target.result);
                renderPlaylist();
                if (midiFiles.length === 1) selectMidi(0);
            };
            reader.readAsArrayBuffer(f);
        }
    }
});

const exitBtn = document.getElementById('exit-button');
if (exitBtn) {
    exitBtn.onclick = async () => {
        if (window.__TAURI__) { try { await window.__TAURI__.core.invoke('kill_app'); } catch (e) { window.close(); } }
        else if (confirm("アプリケーションを終了しますか？")) window.close();
    };
}

const navButtons = document.querySelectorAll('.nav button');
const panels = document.querySelectorAll('.view.panel');
navButtons.forEach(btn => {
    btn.onclick = () => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        panels.forEach(p => {
            p.classList.remove('active');
            if (btn.dataset.view !== 'piano' && p.id === `view-${btn.dataset.view}`) p.classList.add('active');
        });
    };
});

window.onkeydown = (e) => { if(!e.repeat){ const n = keyMap[e.key.toLowerCase()]; if(n) playNote(n + (e.key==='k'?5:4)); } };
window.onkeyup = (e) => { const n = keyMap[e.key.toLowerCase()]; if(n) stopNote(n + (e.key==='k'?5:4)); };

initApp();