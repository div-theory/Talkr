import './styles/global.css';
import { PeerManager } from './webrtc/peerManager';

const PROD_SIGNALING_URL = 'wss://talkr-server.onrender.com';
const getSignalingUrl = () => (window.location.hostname.includes('localhost') || window.location.hostname.includes('127')) ? 'ws://localhost:8080' : PROD_SIGNALING_URL;

(window as any).currentAudioLevel = 0;

// NEW: Stroke-based SVGs for Dotted Effect
// We apply class="icon-svg" to these. Global CSS handles the dotting via stroke-dasharray.
const ICONS = {
    mic: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 1v14M8 11a4 4 0 0 0 8 0M12 15v6M8 21h8"/></svg>`,
    micOff: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M1 1l22 22M12 1v6M8 11a4 4 0 0 0 4 4m4 0a4 4 0 0 0 0-8M12 19v2M8 21h8"/></svg>`,
    cam: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="2" y="4" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4V8z"/></svg>`,
    camOff: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M1 1l22 22M2 4h10m4 0h.01M22 8l-6 4 6 4V8zM2 16h14"/></svg>`,
    end: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>`, // Simple X for Hangup
    copy: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    chat: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    screen: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
    pip: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2"/><rect x="11" y="11" width="8" height="8" rx="1"/></svg>`,
    ghost: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M9 19v-6a3 3 0 0 1 6 0v6M9 19l-2 2v-2H5v2l2-2M15 19l2 2v-2h2v2l-2-2"/></svg>`,
    moon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    send: `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`
};

class ParticleSystem {
    canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; particles: any[] = [];
    constructor() {
        this.canvas = document.createElement('canvas'); this.canvas.id = 'bgCanvas'; document.body.prepend(this.canvas);
        this.ctx = this.canvas.getContext('2d')!; this.resize(); window.addEventListener('resize', () => this.resize());
        for (let i = 0; i < 40; i++) this.particles.push({ x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, size: Math.random() * 2 + 1 });
        this.animate();
    }
    resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }
    animate() {
        const isDark = document.body.classList.contains('dark-theme') || window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
        const boost = 1 + ((window as any).currentAudioLevel || 0) * 0.05;
        this.particles.forEach(p => {
            p.x += p.vx * boost; p.y += p.vy * boost;
            if (p.x < 0) p.x = this.canvas.width; if (p.x > this.canvas.width) p.x = 0; if (p.y < 0) p.y = this.canvas.height; if (p.y > this.canvas.height) p.y = 0;
            this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size * (boost * 0.8), 0, Math.PI * 2); this.ctx.fill();
        });
        requestAnimationFrame(() => this.animate());
    }
}
new ParticleSystem();

const appState = { manager: null as PeerManager | null, isMuted: false, isVideoOff: true, isGhost: false, stream: null as MediaStream | null, idleTimer: 0 as any };
const appContainer = document.getElementById('app') as HTMLDivElement;

function playSfx(type: 'pop' | 'msg') {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        if (type === 'pop') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); osc.start(); osc.stop(ctx.currentTime + 0.1); }
        else { osc.type = 'triangle'; osc.frequency.setValueAtTime(400, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2); osc.start(); osc.stop(ctx.currentTime + 0.2); }
    } catch (e) { }
}

function makeDraggable(el: HTMLElement) {
    let isDragging = false, startX = 0, startY = 0, initLeft = 0, initTop = 0;
    const start = (e: any) => { isDragging = true; const p = e.touches ? e.touches[0] : e; startX = p.clientX; startY = p.clientY; const r = el.getBoundingClientRect(); initLeft = r.left; initTop = r.top; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.left = `${initLeft}px`; el.style.top = `${initTop}px`; };
    const move = (e: any) => { if (!isDragging) return; const p = e.touches ? e.touches[0] : e; el.style.left = `${initLeft + (p.clientX - startX)}px`; el.style.top = `${initTop + (p.clientY - startY)}px`; };
    const end = () => isDragging = false;
    el.addEventListener('mousedown', start); el.addEventListener('touchstart', start); window.addEventListener('mousemove', move); window.addEventListener('touchmove', move); window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
}

function initSpectrogram(stream: MediaStream) {
    const cvs = document.createElement('canvas'); cvs.id = 'audioCanvas';
    const ctx = cvs.getContext('2d')!;
    const container = document.querySelector('.video-container');
    if (container) container.appendChild(cvs);
    const resize = () => { cvs.width = window.innerWidth; cvs.height = 120; }; resize(); window.addEventListener('resize', resize);
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048;
    src.connect(analyser);
    const bufferLength = analyser.frequencyBinCount; const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
        if (!document.body.contains(cvs)) return;
        requestAnimationFrame(draw); analyser.getByteTimeDomainData(dataArray);
        let sum = 0; for (let i = 0; i < bufferLength; i++) sum += Math.abs(dataArray[i] - 128);
        (window as any).currentAudioLevel = sum / bufferLength;
        ctx.clearRect(0, 0, cvs.width, cvs.height); ctx.lineWidth = 2; ctx.strokeStyle = '#4ADE80'; ctx.beginPath();
        const sliceWidth = cvs.width * 1.0 / bufferLength; let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; const y = v * cvs.height / 2;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); x += sliceWidth;
        }
        ctx.lineTo(cvs.width, cvs.height / 2); ctx.stroke();
    }; draw();
}

function initTheme() {
    const btn = document.createElement('button'); btn.className = 'icon-btn theme-toggle dotted-stroke'; btn.innerHTML = ICONS.moon; btn.title = "Toggle Theme";
    document.body.appendChild(btn); btn.addEventListener('click', () => { document.body.classList.toggle('dark-theme'); });
}
initTheme();

async function startCall(roomId: string, stream: MediaStream) {
    appContainer.innerHTML = ''; playSfx('pop');

    const vidWrapper = document.createElement('div'); vidWrapper.className = 'video-container'; appContainer.appendChild(vidWrapper);
    const remoteVideo = document.createElement('video'); remoteVideo.className = 'remote-video'; remoteVideo.autoplay = true; remoteVideo.playsInline = true; vidWrapper.appendChild(remoteVideo);
    const localWrapper = document.createElement('div'); localWrapper.className = 'local-video-wrapper';
    const localVideo = document.createElement('video'); localVideo.className = 'local-video'; localVideo.autoplay = true; localVideo.playsInline = true; localVideo.muted = true; localVideo.srcObject = stream;
    localWrapper.appendChild(localVideo); vidWrapper.appendChild(localWrapper); makeDraggable(localWrapper);

    const statsPill = document.createElement('div'); statsPill.className = 'stats-pill'; statsPill.innerHTML = `<div class="stat-item">PING: <span id="statPing">--</span>ms</div><div class="stat-item">MODE: <span id="statMode">--</span></div>`; appContainer.appendChild(statsPill);

    const chatDrawer = document.createElement('div'); chatDrawer.className = 'chat-drawer';
    chatDrawer.innerHTML = `
    <div class="chat-header"><h2>Secure Chat</h2><div style="display:flex;gap:8px;"><button class="icon-btn dotted-stroke" id="ghostBtn" title="Ghost Mode" style="width:36px;height:36px;">${ICONS.ghost}</button><button class="icon-btn dotted-stroke" id="closeChat" style="width:36px;height:36px;">✕</button></div></div>
    <div class="chat-messages" id="chatArea"></div>
    <div class="chat-input-area"><input type="text" class="chat-input" id="chatInput" placeholder="Type a message..."><button class="pill-btn primary" id="sendChatBtn" style="height:42px;padding:0 16px;">Send</button></div>
  `;
    appContainer.appendChild(chatDrawer);

    const controls = document.createElement('div'); controls.className = 'controls-bar';
    controls.innerHTML = `
    <button id="copyBtn" class="icon-btn dotted-stroke" data-tooltip="Copy Link">${ICONS.copy}</button>
    <button id="screenBtn" class="icon-btn dotted-stroke" data-tooltip="Share Screen">${ICONS.screen}</button>
    <button id="pipBtn" class="icon-btn dotted-stroke" data-tooltip="Pop Out">${ICONS.pip}</button>
    <button id="vidBtn" class="icon-btn dotted-stroke" data-tooltip="Camera">${appState.isVideoOff ? ICONS.camOff : ICONS.cam}</button>
    <button id="muteBtn" class="icon-btn dotted-stroke ${appState.isMuted ? '' : 'active'}" data-tooltip="Mic">${appState.isMuted ? ICONS.micOff : ICONS.mic}</button>
    <button id="chatBtn" class="icon-btn dotted-stroke" data-tooltip="Chat">${ICONS.chat}<div class="notify-dot"></div></button>
    <button id="endBtn" class="icon-btn danger dotted-stroke" data-tooltip="End Call">${ICONS.end}</button>
  `;
    appContainer.appendChild(controls);

    const status = document.createElement('div'); status.style.cssText = `position:absolute;top:70px;left:50%;transform:translateX(-50%);text-align:center;z-index:20;pointer-events:none;`;
    status.innerHTML = `<div class="radar-loader"></div><div style="font-family:'DotGothic16',monospace;color:rgba(255,255,255,0.6);font-size:12px;letter-spacing:2px;">SCANNING NETWORK...</div>`; appContainer.appendChild(status);

    const signalUrl = getSignalingUrl();
    appState.manager = new PeerManager(roomId, signalUrl);
    await appState.manager.start(stream);

    appState.manager.onRemoteStream = (s) => { remoteVideo.srcObject = s; status.innerHTML = `<div style="font-family:'DotGothic16',monospace;color:#4ADE80;font-size:12px;letter-spacing:2px;">ENCRYPTED • X25519</div>`; initSpectrogram(s); };
    setInterval(async () => { if (appState.manager) { const stats = await appState.manager.getStats(); if (stats) { document.getElementById('statPing')!.innerText = stats.rtt; document.getElementById('statMode')!.innerText = stats.type; } } }, 2000);

    const addMsg = (text: string, type: 'me' | 'them', isGhost = false) => {
        const d = document.createElement('div'); d.className = `chat-msg ${type} ${isGhost ? 'ghost' : ''}`; d.innerText = text; document.getElementById('chatArea')!.appendChild(d); d.scrollIntoView({ behavior: 'smooth' });
    };

    appState.manager.onChatMessage = (msg) => { playSfx('msg'); addMsg(msg.text, 'them', msg.isGhost); if (!chatDrawer.classList.contains('open')) document.querySelector('.notify-dot')!.classList.add('show'); };
    appState.manager.onFileReceived = (blob, name) => { playSfx('msg'); const url = URL.createObjectURL(blob); const d = document.createElement('div'); d.className = 'chat-msg them'; d.innerHTML = `Received: <b>${name}</b> <a href="${url}" download="${name}" style="color:#4ADE80;margin-left:8px;">Download</a>`; document.getElementById('chatArea')!.appendChild(d); if (!chatDrawer.classList.contains('open')) document.querySelector('.notify-dot')!.classList.add('show'); };

    document.getElementById('sendChatBtn')?.addEventListener('click', () => {
        const input = document.getElementById('chatInput') as HTMLInputElement;
        if (input.value.trim()) {
            const msg = { text: input.value, isGhost: appState.isGhost };
            if (appState.manager && appState.manager['chatChannel']?.readyState === 'open') appState.manager['chatChannel'].send(JSON.stringify({ ...msg, time: Date.now(), sender: 'remote' }));
            addMsg(input.value, 'me', appState.isGhost); input.value = '';
        }
    });

    document.getElementById('ghostBtn')?.addEventListener('click', (e) => { appState.isGhost = !appState.isGhost; (e.currentTarget as HTMLElement).classList.toggle('active'); (e.currentTarget as HTMLElement).classList.toggle('ghost-active'); });
    document.getElementById('pipBtn')?.addEventListener('click', async () => { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await remoteVideo.requestPictureInPicture(); } catch (e) { } });
    document.getElementById('chatBtn')?.addEventListener('click', () => { chatDrawer.classList.toggle('open'); document.querySelector('.notify-dot')!.classList.remove('show'); });
    document.getElementById('closeChat')?.addEventListener('click', () => chatDrawer.classList.remove('open'));
    document.getElementById('copyBtn')?.addEventListener('click', () => { navigator.clipboard.writeText(window.location.href); const t = status.querySelector('div'); if (t) { const old = t.innerText; t.innerText = 'COPIED'; setTimeout(() => t.innerText = old, 2000); } });
    document.getElementById('endBtn')?.addEventListener('click', () => window.location.href = '/');
    document.getElementById('screenBtn')?.addEventListener('click', async () => { const s = await appState.manager?.startScreenShare(); if (s) localVideo.srcObject = s; });
    document.getElementById('muteBtn')?.addEventListener('click', (e) => { const track = stream.getAudioTracks()[0]; if (track) { appState.isMuted = !appState.isMuted; track.enabled = !appState.isMuted; (e.currentTarget as HTMLElement).classList.toggle('active'); (e.currentTarget as HTMLElement).innerHTML = appState.isMuted ? ICONS.micOff : ICONS.mic; } });
    document.getElementById('vidBtn')?.addEventListener('click', (e) => { const track = stream.getVideoTracks()[0]; if (track) { appState.isVideoOff = !appState.isVideoOff; track.enabled = !appState.isVideoOff; (e.currentTarget as HTMLElement).classList.toggle('active'); (e.currentTarget as HTMLElement).innerHTML = appState.isVideoOff ? ICONS.camOff : ICONS.cam; } });

    const resetIdle = () => { document.body.classList.remove('focus-mode'); clearTimeout(appState.idleTimer); appState.idleTimer = setTimeout(() => document.body.classList.add('focus-mode'), 3000); };
    window.addEventListener('mousemove', resetIdle); window.addEventListener('touchstart', resetIdle); resetIdle();
}

async function renderGreenRoom(roomId: string) {
    appContainer.style.cssText = `display:flex;justify-content:center;align-items:center;height:100vh;position:relative;z-index:10;`;
    appContainer.innerHTML = `
    <div class="card" style="width:400px;display:flex;flex-direction:column;align-items:center;">
      <h2>Green Room</h2>
      <div class="preview-wrapper" style="background:#000;display:flex;align-items:center;justify-content:center;">
        <video id="previewVid" class="preview-video" autoplay playsinline muted style="display:none;"></video>
        <div id="noCamText" style="color:#666;font-family:'DotGothic16',monospace;">CAMERA OFF</div>
      </div>
      <div style="display:flex; gap:16px; margin: 16px 0;">
         <button id="grMicBtn" class="icon-btn dotted-stroke active">${ICONS.mic}</button>
         <button id="grCamBtn" class="icon-btn dotted-stroke">${ICONS.camOff}</button>
      </div>
      <button id="joinBtn" class="pill-btn primary" style="width:100%;">Join Call</button>
    </div>
  `;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); } catch (e) { try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (err) { alert('Mic blocked.'); return; } }
    const vid = document.getElementById('previewVid') as HTMLVideoElement;
    const placeholder = document.getElementById('noCamText') as HTMLElement;
    const vidTrack = stream.getVideoTracks()[0];
    if (vidTrack) { vidTrack.enabled = false; vid.srcObject = stream; }
    document.getElementById('grMicBtn')?.addEventListener('click', (e) => { const track = stream.getAudioTracks()[0]; if (track) { appState.isMuted = !appState.isMuted; track.enabled = !appState.isMuted; (e.currentTarget as HTMLElement).classList.toggle('active'); (e.currentTarget as HTMLElement).innerHTML = appState.isMuted ? ICONS.micOff : ICONS.mic; } });
    document.getElementById('grCamBtn')?.addEventListener('click', (e) => { if (vidTrack) { appState.isVideoOff = !appState.isVideoOff; vidTrack.enabled = !appState.isVideoOff; (e.currentTarget as HTMLElement).classList.toggle('active'); (e.currentTarget as HTMLElement).innerHTML = appState.isVideoOff ? ICONS.camOff : ICONS.cam; if (appState.isVideoOff) { vid.style.display = 'none'; placeholder.style.display = 'block'; } else { vid.style.display = 'block'; placeholder.style.display = 'none'; } } });
    document.getElementById('joinBtn')?.addEventListener('click', () => startCall(roomId, stream));
}

function renderHome() {
    appContainer.style.cssText = '';
    appContainer.innerHTML = `
    <div class="landing-layout">
        <div class="grid-line-x" style="top:33.33%"></div><div class="grid-line-x" style="top:66.66%"></div><div class="grid-line-y" style="left:33.33%"></div><div class="grid-line-y" style="left:66.66%"></div>
        <div class="crosshair" style="top:33.33%;left:33.33%;transform:translate(-50%,-50%)"></div><div class="crosshair" style="top:33.33%;left:66.66%;transform:translate(-50%,-50%)"></div><div class="crosshair" style="top:66.66%;left:33.33%;transform:translate(-50%,-50%)"></div><div class="crosshair" style="top:66.66%;left:66.66%;transform:translate(-50%,-50%)"></div>
        <div class="corner corner-tl"><h1>TALKR.</h1><span class="mono-label">PROTOCOL V01.7</span></div>
        <div class="corner corner-tr"><div class="mono-label">SYSTEM STATUS</div><div class="stat-value" style="color:#4ADE80">OPTIMAL</div><div class="mono-label" style="margin-top:16px">LOCAL TIME</div><div class="stat-value" id="clock">00:00:00</div></div>
        <div class="corner corner-bl"><p class="manifesto">End-to-End Encrypted.<br>Peer-to-Peer Direct.<br>No Servers. No Logs.<br>Pure Privacy.</p></div>
        <div class="corner corner-br"><div style="display:flex; gap:12px;"><div class="mono-label">AES-GCM</div><div class="mono-label">X25519</div><div class="mono-label">WEBRTC</div></div></div>
        <div class="hero-center"><button id="createBtn" class="big-start-btn">START<span>INITIALIZE</span></button></div>
    </div>
  `;
    const clock = document.getElementById('clock'); setInterval(() => { if (clock) clock.innerText = new Date().toLocaleTimeString(); }, 1000);
    document.getElementById('createBtn')?.addEventListener('click', () => { const id = Math.random().toString(36).substring(2, 8).toUpperCase(); window.history.pushState({}, '', `?m=${id}`); renderGreenRoom(id); });
}

const id = new URLSearchParams(window.location.search).get('m');
if (id) renderGreenRoom(id); else renderHome();