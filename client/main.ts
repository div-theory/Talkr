import './styles/global.css';
import { PeerManager } from './webrtc/peerManager';

const PROD_SIGNALING_URL = 'wss://talkr-server.onrender.com';
const getSignalingUrl = () => (window.location.hostname.includes('localhost') || window.location.hostname.includes('127')) ? 'ws://localhost:8080' : PROD_SIGNALING_URL;

const ICONS = {
    mic: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
    micOff: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02 5.01L11 12.01V5c0-1.1.9-2 2-2s2 .9 2 2v5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l2.99 2.98c-1.06.63-2.28 1-3.64 1-3.53 0-6.43-2.61-6.92-6H3c0 3.87 3.13 7 7 7v3h2v-3c1.08-.17 2.09-.55 3-1.05l3.73 3.73L19.73 18 4.27 3z"/></svg>`,
    cam: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`,
    camOff: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>`,
    end: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`,
    copy: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
    chat: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`,
    screen: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>`
};

// --- BACKGROUND ---
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
        this.particles.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = this.canvas.width; if (p.x > this.canvas.width) p.x = 0; if (p.y < 0) p.y = this.canvas.height; if (p.y > this.canvas.height) p.y = 0; this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); this.ctx.fill(); });
        requestAnimationFrame(() => this.animate());
    }
}
new ParticleSystem();

const appState = { manager: null as PeerManager | null, isMuted: false, isVideoOff: true, stream: null as MediaStream | null };
const appContainer = document.getElementById('app') as HTMLDivElement;

// --- DRAGGABLE ---
function makeDraggable(el: HTMLElement) {
    let isDragging = false, startX = 0, startY = 0, initLeft = 0, initTop = 0;
    const start = (e: any) => { isDragging = true; const p = e.touches ? e.touches[0] : e; startX = p.clientX; startY = p.clientY; const r = el.getBoundingClientRect(); initLeft = r.left; initTop = r.top; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.left = `${initLeft}px`; el.style.top = `${initTop}px`; };
    const move = (e: any) => { if (!isDragging) return; const p = e.touches ? e.touches[0] : e; el.style.left = `${initLeft + (p.clientX - startX)}px`; el.style.top = `${initTop + (p.clientY - startY)}px`; };
    const end = () => isDragging = false;
    el.addEventListener('mousedown', start); el.addEventListener('touchstart', start); window.addEventListener('mousemove', move); window.addEventListener('touchmove', move); window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
}

// --- CALL UI ---
async function startCall(roomId: string, stream: MediaStream) {
    appContainer.innerHTML = '';

    // 1. LAYOUT
    const vidWrapper = document.createElement('div'); vidWrapper.className = 'video-container'; appContainer.appendChild(vidWrapper);
    const remoteVideo = document.createElement('video'); remoteVideo.className = 'remote-video'; remoteVideo.autoplay = true; remoteVideo.playsInline = true; vidWrapper.appendChild(remoteVideo);
    const localWrapper = document.createElement('div'); localWrapper.className = 'local-video-wrapper';
    const localVideo = document.createElement('video'); localVideo.className = 'local-video'; localVideo.autoplay = true; localVideo.playsInline = true; localVideo.muted = true; localVideo.srcObject = stream;
    localWrapper.appendChild(localVideo); vidWrapper.appendChild(localWrapper); makeDraggable(localWrapper);

    // 2. OVERLAYS
    const statsPill = document.createElement('div'); statsPill.className = 'stats-pill';
    statsPill.innerHTML = `<div class="stat-item">PING: <span id="statPing">--</span>ms</div><div class="stat-item">MODE: <span id="statMode">--</span></div>`;
    appContainer.appendChild(statsPill);

    const dropZone = document.createElement('div'); dropZone.className = 'drop-zone';
    dropZone.innerHTML = `<h2>DROP TO SHARE</h2><p>Encrypted P2P Transfer</p>`;
    appContainer.appendChild(dropZone);

    const chatDrawer = document.createElement('div'); chatDrawer.className = 'chat-drawer';
    chatDrawer.innerHTML = `
    <div class="chat-header"><h2>Secure Chat</h2><button class="icon-btn" id="closeChat">✕</button></div>
    <div class="chat-messages" id="chatArea"></div>
    <div class="chat-input-area">
        <input type="text" class="chat-input" id="chatInput" placeholder="Type a message...">
        <button class="pill-btn primary" id="sendChatBtn" style="height:42px;padding:0 16px;">Send</button>
    </div>
  `;
    appContainer.appendChild(chatDrawer);

    // 3. CONTROLS
    const controls = document.createElement('div'); controls.className = 'controls-bar';
    controls.innerHTML = `
    <button id="copyBtn" class="icon-btn" title="Copy Link">${ICONS.copy}</button>
    <button id="screenBtn" class="icon-btn" title="Share Screen">${ICONS.screen}</button>
    <button id="vidBtn" class="icon-btn" title="Cam">${ICONS.camOff}</button>
    <button id="muteBtn" class="icon-btn active" title="Mic">${ICONS.mic}</button>
    <button id="chatBtn" class="icon-btn" title="Chat">${ICONS.chat}<div class="notify-dot"></div></button>
    <button id="endBtn" class="icon-btn danger" title="End">${ICONS.end}</button>
  `;
    appContainer.appendChild(controls);

    const status = document.createElement('div'); status.style.cssText = `position:absolute;top:70px;left:50%;transform:translateX(-50%);font-family:monospace;color:rgba(255,255,255,0.6);font-size:12px;letter-spacing:2px;z-index:20;pointer-events:none;`;
    status.innerText = `WAITING FOR PEER...`; appContainer.appendChild(status);

    // 4. LOGIC
    const signalUrl = getSignalingUrl();
    appState.manager = new PeerManager(roomId, signalUrl);
    await appState.manager.start(stream);

    appState.manager.onRemoteStream = (s) => { remoteVideo.srcObject = s; status.innerText = 'ENCRYPTED • X25519'; status.style.color = '#4ADE80'; };

    // Stats Loop
    setInterval(async () => {
        if (appState.manager) {
            const stats = await appState.manager.getStats();
            if (stats) {
                document.getElementById('statPing')!.innerText = stats.rtt;
                document.getElementById('statMode')!.innerText = stats.type;
            }
        }
    }, 2000);

    // Chat Logic
    const addMsg = (text: string, type: 'me' | 'them' | 'sys') => {
        const d = document.createElement('div'); d.className = `chat-msg ${type === 'me' ? 'me' : type === 'them' ? 'them' : 'sys'}`;
        d.innerText = text; document.getElementById('chatArea')!.appendChild(d);
        d.scrollIntoView({ behavior: 'smooth' });
    };

    appState.manager.onChatMessage = (msg) => {
        addMsg(msg.text, 'them');
        if (!chatDrawer.classList.contains('open')) document.querySelector('.notify-dot')!.classList.add('show');
    };

    appState.manager.onFileReceived = (blob, name) => {
        const url = URL.createObjectURL(blob);
        const d = document.createElement('div'); d.className = 'chat-msg them';
        d.innerHTML = `<div>Received File: <b>${name}</b></div><a href="${url}" download="${name}" style="color:white;text-decoration:underline;">Download</a>`;
        document.getElementById('chatArea')!.appendChild(d);
        if (!chatDrawer.classList.contains('open')) document.querySelector('.notify-dot')!.classList.add('show');
    };

    document.getElementById('sendChatBtn')?.addEventListener('click', () => {
        const input = document.getElementById('chatInput') as HTMLInputElement;
        if (input.value.trim()) {
            appState.manager?.sendChat(input.value);
            addMsg(input.value, 'me');
            input.value = '';
        }
    });

    // Button Listeners
    document.getElementById('chatBtn')?.addEventListener('click', () => { chatDrawer.classList.toggle('open'); document.querySelector('.notify-dot')!.classList.remove('show'); });
    document.getElementById('closeChat')?.addEventListener('click', () => chatDrawer.classList.remove('open'));
    document.getElementById('copyBtn')?.addEventListener('click', () => { navigator.clipboard.writeText(window.location.href); status.innerText = 'COPIED'; setTimeout(() => status.innerText = 'SECURE', 2000); });
    document.getElementById('endBtn')?.addEventListener('click', () => window.location.href = '/');

    document.getElementById('screenBtn')?.addEventListener('click', async () => {
        const s = await appState.manager?.startScreenShare();
        if (s) localVideo.srcObject = s;
    });

    document.getElementById('muteBtn')?.addEventListener('click', (e) => {
        const track = stream.getAudioTracks()[0];
        if (track) { appState.isMuted = !appState.isMuted; track.enabled = !appState.isMuted; (e.currentTarget as HTMLElement).classList.toggle('active'); (e.currentTarget as HTMLElement).innerHTML = appState.isMuted ? ICONS.micOff : ICONS.mic; }
    });
    document.getElementById('vidBtn')?.addEventListener('click', (e) => {
        const track = stream.getVideoTracks()[0];
        if (track) { appState.isVideoOff = !appState.isVideoOff; track.enabled = !appState.isVideoOff; (e.currentTarget as HTMLElement).classList.toggle('active'); (e.currentTarget as HTMLElement).innerHTML = appState.isVideoOff ? ICONS.camOff : ICONS.cam; }
    });

    // Drag & Drop File
    window.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
    window.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) dropZone.classList.remove('active'); });
    window.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('active');
        if (e.dataTransfer?.files.length) {
            const file = e.dataTransfer.files[0];
            appState.manager?.sendFile(file);
            addMsg(`Sending file: ${file.name}...`, 'sys');
        }
    });
}

// --- GREEN ROOM ---
async function renderGreenRoom(roomId: string) {
    appContainer.style.cssText = `display:flex;justify-content:center;align-items:center;height:100vh;position:relative;z-index:10;`;
    appContainer.innerHTML = `
    <div class="card" style="width:400px;display:flex;flex-direction:column;align-items:center;">
      <h2>Green Room</h2>
      <div class="preview-wrapper" style="background:#000;display:flex;align-items:center;justify-content:center;">
        <video id="previewVid" class="preview-video" autoplay playsinline muted style="display:none;"></video>
        <div id="noCamText" style="color:#666;font-family:monospace;">CAMERA OFF</div>
      </div>
      <div style="margin-top:16px;font-size:12px;color:var(--fg-secondary);margin-bottom:16px;">Join as Voice Only (Default)</div>
      <button id="joinBtn" class="pill-btn primary" style="width:100%;">Join Call</button>
    </div>
  `;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); } catch (e) { try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (err) { alert('Mic/Cam blocked.'); return; } }

    const vid = document.getElementById('previewVid') as HTMLVideoElement;
    const track = stream.getVideoTracks()[0];
    if (track) { track.enabled = false; vid.srcObject = stream; }

    document.getElementById('joinBtn')?.addEventListener('click', () => startCall(roomId, stream));
}

// --- LANDING ---
function renderHome() {
    appContainer.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;position:relative;z-index:10;`;
    appContainer.innerHTML = `<div class="card"><div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:24px;"><div style="width:8px;height:8px;background:var(--accent);border-radius:50%;"></div><span style="font-size:12px;font-weight:600;color:var(--accent);letter-spacing:1px;">V01.2</span></div><h1>Talkr.</h1><p>Peer-to-peer encrypted video.<br/>No signup. No servers. No logs.</p><div style="margin-top:48px;"><button id="createBtn" class="pill-btn primary">Start Instant Meeting</button></div></div>`;
    document.getElementById('createBtn')?.addEventListener('click', () => { const id = Math.random().toString(36).substring(2, 8).toUpperCase(); window.history.pushState({}, '', `?m=${id}`); renderGreenRoom(id); });
}

const id = new URLSearchParams(window.location.search).get('m');
if (id) renderGreenRoom(id); else renderHome();