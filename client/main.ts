import './styles/global.css';
import { PeerManager } from './webrtc/peerManager';

const PROD_SIGNALING_URL = 'wss://talkr-server.onrender.com';
const getSignalingUrl = () => (window.location.hostname.includes('localhost') || window.location.hostname.includes('127')) ? 'ws://localhost:8080' : PROD_SIGNALING_URL;

(window as any).currentAudioLevel = 0;

const ICONS = {
    mic: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
    micOff: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02 5.01L11 12.01V5c0-1.1.9-2 2-2s2 .9 2 2v5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l2.99 2.98c-1.06.63-2.28 1-3.64 1-3.53 0-6.43-2.61-6.92-6H3c0 3.87 3.13 7 7 7v3h2v-3c1.08-.17 2.09-.55 3-1.05l3.73 3.73L19.73 18 4.27 3z"/></svg>`,
    cam: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`,
    camOff: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>`,
    end: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`,
    copy: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
    chat: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`,
    screen: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>`,
    pip: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`,
    ghost: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 2C7.58 2 4 5.58 4 10v10c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-3h2v3c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-3h2v3c0 .55.45 1 1 1h2c.55 0 1-.45 1-1V10c0-4.42-3.58-8-8-8zm0 2.5c.83 0 1.5.67 1.5 1.5S12.83 7.5 12 7.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zM9 10c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1zm6 0c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1z"/></svg>`,
    moon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>`,
    send: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`
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

function showToast(msg: string) {
    let container = document.querySelector('.toast-container');
    if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
    const toast = document.createElement('div'); toast.className = 'toast'; toast.innerText = msg;
    container.appendChild(toast); setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function makeDraggable(el: HTMLElement) {
    let isDragging = false, startX = 0, startY = 0, initLeft = 0, initTop = 0;
    const start = (e: any) => { isDragging = true; const p = e.touches ? e.touches[0] : e; startX = p.clientX; startY = p.clientY; const r = el.getBoundingClientRect(); initLeft = r.left; initTop = r.top; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.left = `${initLeft}px`; el.style.top = `${initTop}px`; };
    const move = (e: any) => { if (!isDragging) return; const p = e.touches ? e.touches[0] : e; el.style.left = `${initLeft + (p.clientX - startX)}px`; el.style.top = `${initTop + (p.clientY - startY)}px`; };
    const end = () => isDragging = false;
    el.addEventListener('mousedown', start); el.addEventListener('touchstart', start); window.addEventListener('mousemove', move); window.addEventListener('touchmove', move); window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
}

function initMagneticButtons() {
    const btns = document.querySelectorAll('.icon-btn, .pill-btn, .big-start-btn');
    btns.forEach((btn: any) => {
        btn.addEventListener('mousemove', (e: MouseEvent) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
        });
        btn.addEventListener('mouseleave', () => { btn.style.transform = 'translate(0, 0)'; });
    });
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

        // Calc Volume for Particles
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
    const btn = document.createElement('button'); btn.className = 'icon-btn theme-toggle'; btn.innerHTML = ICONS.moon; btn.title = "Toggle Theme";
    document.body.appendChild(btn); btn.addEventListener('click', () => { document.body.classList.toggle('dark-theme'); });
    btn.addEventListener('mousemove', (e: MouseEvent) => { const rect = btn.getBoundingClientRect(); btn.style.transform = `translate(${(e.clientX - rect.left - rect.width / 2) * 0.2}px, ${(e.clientY - rect.top - rect.height / 2) * 0.2}px)`; });
    btn.addEventListener('mouseleave', () => btn.style.transform = 'translate(0,0)');
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
    const dropZone = document.createElement('div'); dropZone.className = 'drop-zone'; dropZone.innerHTML = `<div class="portal-ring"></div><h2>DROP TO TELEPORT</h2>`; appContainer.appendChild(dropZone);

    const chatDrawer = document.createElement('div'); chatDrawer.className = 'chat-drawer';
    chatDrawer.innerHTML = `
    <div class="chat-header"><h2>Secure Chat</h2><div style="display:flex;gap:8px;"><button class="icon-btn" id="ghostBtn" title="Ghost Mode" style="width:36px;height:36px;">${ICONS.ghost}</button><button class="icon-btn" id="closeChat" style="width:36px;height:36px;">✕</button></div></div>
    <div class="chat-messages" id="chatArea"></div>
    <div class="chat-input-area"><input type="text" class="chat-input" id="chatInput" placeholder="Type a message..."><button class="pill-btn primary" id="sendChatBtn" style="height:42px;padding:0 16px;">Send</button></div>
  `;
    appContainer.appendChild(chatDrawer);

    const chatOverlay = document.createElement('div'); chatOverlay.className = 'chat-overlay'; chatOverlay.id = 'chatOverlay'; appContainer.appendChild(chatOverlay);
    const chatBar = document.createElement('div'); chatBar.className = 'chat-input-bar'; chatBar.id = 'chatInputBar';
    chatBar.innerHTML = `<input type="text" class="chat-input-field" id="chatInputOverlay" placeholder="Type message..." autocomplete="off"><button class="icon-btn ghost-active" id="ghostBtnOverlay" style="width:40px;height:40px;" title="Ghost Mode">${ICONS.ghost}</button><button class="icon-btn active" id="sendChatBtnOverlay" style="width:40px;height:40px;">${ICONS.send}</button>`;
    appContainer.appendChild(chatBar);

    const controls = document.createElement('div'); controls.className = 'controls-bar';
    controls.innerHTML = `
    <button id="copyBtn" class="icon-btn" data-tooltip="Copy Link">${ICONS.copy}</button>
    <button id="screenBtn" class="icon-btn" data-tooltip="Share Screen">${ICONS.screen}</button>
    <button id="pipBtn" class="icon-btn" data-tooltip="Pop Out">${ICONS.pip}</button>
    <button id="vidBtn" class="icon-btn" data-tooltip="Camera">${appState.isVideoOff ? ICONS.camOff : ICONS.cam}</button>
    <button id="muteBtn" class="icon-btn ${appState.isMuted ? '' : 'active'}" data-tooltip="Mic">${appState.isMuted ? ICONS.micOff : ICONS.mic}</button>
    <button id="chatBtn" class="icon-btn" data-tooltip="Chat">${ICONS.chat}<div class="notify-dot"></div></button>
    <button id="endBtn" class="icon-btn danger" data-tooltip="End Call">${ICONS.end}</button>
  `;
    appContainer.appendChild(controls);
    initMagneticButtons();

    const status = document.createElement('div'); status.style.cssText = `position:absolute;top:70px;left:50%;transform:translateX(-50%);text-align:center;z-index:20;pointer-events:none;`;
    status.innerHTML = `<div class="radar-loader"></div><div style="font-family:monospace;color:rgba(255,255,255,0.6);font-size:12px;letter-spacing:2px;">SCANNING NETWORK...</div>`; appContainer.appendChild(status);

    const signalUrl = getSignalingUrl();
    appState.manager = new PeerManager(roomId, signalUrl);
    await appState.manager.start(stream);

    appState.manager.onRemoteStream = (s) => {
        remoteVideo.srcObject = s; status.innerHTML = `<div style="font-family:monospace;color:#4ADE80;font-size:12px;letter-spacing:2px;">ENCRYPTED • X25519</div>`; initSpectrogram(s);
    };

    setInterval(async () => { if (appState.manager) { const stats = await appState.manager.getStats(); if (stats) { document.getElementById('statPing')!.innerText = stats.rtt; document.getElementById('statMode')!.innerText = stats.type; } } }, 2000);

    const addMsg = (text: string, type: 'me' | 'them' | 'sys', isGhost = false) => {
        const b = document.createElement('div'); b.className = `chat-bubble ${type} ${isGhost ? 'ghost' : ''}`; b.innerText = text; chatOverlay.appendChild(b); setTimeout(() => { b.style.opacity = '0'; setTimeout(() => b.remove(), 500); }, 15000);
    };

    appState.manager.onChatMessage = (msg) => { playSfx('msg'); addMsg(msg.text, 'them', msg.isGhost); if (!chatBar.classList.contains('visible')) document.querySelector('.notify-dot')!.classList.add('show'); };
    appState.manager.onFileReceived = (blob, name) => { playSfx('msg'); const url = URL.createObjectURL(blob); const b = document.createElement('div'); b.className = 'chat-bubble them'; b.innerHTML = `Received: <b>${name}</b> <a href="${url}" download="${name}" style="color:#4ADE80;margin-left:8px;">Download</a>`; chatOverlay.appendChild(b); };

    const sendMsgOverlay = () => {
        const input = document.getElementById('chatInputOverlay') as HTMLInputElement;
        if (input.value.trim()) {
            const msg = { text: input.value, isGhost: appState.isGhost };
            if (appState.manager && appState.manager['chatChannel']?.readyState === 'open') appState.manager['chatChannel'].send(JSON.stringify({ ...msg, time: Date.now(), sender: 'remote' }));
            addMsg(input.value, 'me', appState.isGhost); input.value = '';
        }
    };
    document.getElementById('sendChatBtnOverlay')?.addEventListener('click', sendMsgOverlay);
    document.getElementById('chatInputOverlay')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMsgOverlay(); });
    document.getElementById('ghostBtnOverlay')?.addEventListener('click', (e) => { appState.isGhost = !appState.isGhost; (e.currentTarget as HTMLElement).classList.toggle('active'); (e.currentTarget as HTMLElement).classList.toggle('ghost-active'); });

    document.getElementById('pipBtn')?.addEventListener('click', async () => { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await remoteVideo.requestPictureInPicture(); } catch (e) { } });
    document.getElementById('chatBtn')?.addEventListener('click', (e) => { const bar = document.getElementById('chatInputBar'); bar?.classList.toggle('visible'); (e.currentTarget as HTMLElement).classList.toggle('active'); if (bar?.classList.contains('visible')) document.getElementById('chatInputOverlay')?.focus(); document.querySelector('.notify-dot')!.classList.remove('show'); });
    document.getElementById('copyBtn')?.addEventListener('click', () => { navigator.clipboard.writeText(window.location.href); const t = status.querySelector('div'); if (t) { const old = t.innerText; t.innerText = 'COPIED'; setTimeout(() => t.innerText = old, 2000); } });
    document.getElementById('endBtn')?.addEventListener('click', () => window.location.href = '/');
    document.getElementById('screenBtn')?.addEventListener('click', async () => { const s = await appState.manager?.startScreenShare(); if (s) localVideo.srcObject = s; });
    document.getElementById('muteBtn')?.addEventListener('click', (e) => { const track = stream.getAudioTracks()[0]; if (track) { appState.isMuted = !appState.isMuted; track.enabled = !appState.isMuted; (e.currentTarget as HTMLElement).classList.toggle('active'); (e.currentTarget as HTMLElement).innerHTML = appState.isMuted ? ICONS.micOff : ICONS.mic; } });
    document.getElementById('vidBtn')?.addEventListener('click', (e) => { const track = stream.getVideoTracks()[0]; if (track) { appState.isVideoOff = !appState.isVideoOff; track.enabled = !appState.isVideoOff; (e.currentTarget as HTMLElement).classList.toggle('active'); (e.currentTarget as HTMLElement).innerHTML = appState.isVideoOff ? ICONS.camOff : ICONS.cam; } });

    window.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
    window.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) dropZone.classList.remove('active'); });
    window.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('active'); if (e.dataTransfer?.files.length) { const file = e.dataTransfer.files[0]; appState.manager?.sendFile(file); addMsg(`Sending file: ${file.name}...`, 'me'); } });

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
        <div id="noCamText" style="color:#666;font-family:monospace;">CAMERA OFF</div>
      </div>
      <div style="display:flex; gap:16px; margin: 16px 0;">
         <button id="grMicBtn" class="icon-btn active">${ICONS.mic}</button>
         <button id="grCamBtn" class="icon-btn">${ICONS.camOff}</button>
      </div>
      <button id="joinBtn" class="pill-btn primary" style="width:100%;">Join Call</button>
    </div>
  `;
    initMagneticButtons();
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

// --- NEW LANDING PAGE RENDER ---
function renderHome() {
    appContainer.style.cssText = ''; // Reset inline styles
    appContainer.innerHTML = `
    <div class="landing-layout">
        <!-- GRID LINES -->
        <div class="grid-line-x" style="top:33.33%"></div>
        <div class="grid-line-x" style="top:66.66%"></div>
        <div class="grid-line-y" style="left:33.33%"></div>
        <div class="grid-line-y" style="left:66.66%"></div>
        <!-- CROSSHAIRS -->
        <div class="crosshair" style="top:33.33%;left:33.33%;transform:translate(-50%,-50%)"></div>
        <div class="crosshair" style="top:33.33%;left:66.66%;transform:translate(-50%,-50%)"></div>
        <div class="crosshair" style="top:66.66%;left:33.33%;transform:translate(-50%,-50%)"></div>
        <div class="crosshair" style="top:66.66%;left:66.66%;transform:translate(-50%,-50%)"></div>

        <!-- CORNERS -->
        <div class="corner corner-tl">
            <h1>TALKR.</h1>
            <span class="mono-label">PROTOCOL V01.7</span>
        </div>
        <div class="corner corner-tr">
            <div class="mono-label">SYSTEM STATUS</div>
            <div class="stat-value" style="color:#4ADE80">OPTIMAL</div>
            <div class="mono-label" style="margin-top:16px">LOCAL TIME</div>
            <div class="stat-value" id="clock">00:00:00</div>
        </div>
        <div class="corner corner-bl">
            <p class="manifesto">
                End-to-End Encrypted.<br>
                Peer-to-Peer Direct.<br>
                No Servers. No Logs.<br>
                Pure Privacy.
            </p>
        </div>
        <div class="corner corner-br">
            <div style="display:flex; gap:12px;">
                <div class="mono-label">AES-GCM</div>
                <div class="mono-label">X25519</div>
                <div class="mono-label">WEBRTC</div>
            </div>
        </div>

        <!-- CENTER ACTION -->
        <div class="hero-center">
            <button id="createBtn" class="big-start-btn">
                START
                <span>INITIALIZE</span>
            </button>
        </div>
    </div>
  `;

    initMagneticButtons();

    // Clock Logic
    const clock = document.getElementById('clock');
    setInterval(() => {
        if (clock) clock.innerText = new Date().toLocaleTimeString();
    }, 1000);

    document.getElementById('createBtn')?.addEventListener('click', () => {
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();
        window.history.pushState({}, '', `?m=${id}`);
        renderGreenRoom(id);
    });
}

const id = new URLSearchParams(window.location.search).get('m');
if (id) renderGreenRoom(id); else renderHome();