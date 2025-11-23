import './styles/global.css';
import { PeerManager } from './webrtc/peerManager';

// --- CONFIG ---
const PROD_SIGNALING_URL = 'wss://talkr-server.onrender.com';
const getSignalingUrl = () =>
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'ws://localhost:8080' : PROD_SIGNALING_URL;

// --- ICONS (SVG PATHS) ---
const ICONS = {
    mic: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
    micOff: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02 5.01L11 12.01V5c0-1.1.9-2 2-2s2 .9 2 2v5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l2.99 2.98c-1.06.63-2.28 1-3.64 1-3.53 0-6.43-2.61-6.92-6H3c0 3.87 3.13 7 7 7v3h2v-3c1.08-.17 2.09-.55 3-1.05l3.73 3.73L19.73 18 4.27 3z"/></svg>`,
    cam: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`,
    camOff: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>`,
    end: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`,
    copy: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`
};

// --- PARTICLE BACKGROUND ---
class ParticleSystem {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    particles: { x: number, y: number, vx: number, vy: number, size: number }[] = [];

    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'bgCanvas';
        document.body.prepend(this.canvas);
        this.ctx = this.canvas.getContext('2d')!;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initParticles();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initParticles() {
        // 40 Dots only, no lines
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5, // Very slow velocity
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';

        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // Wrap around screen
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize Background
new ParticleSystem();

// --- APP LOGIC ---
const appState = {
    manager: null as PeerManager | null,
    isMuted: false, isVideoOff: false
};
const appContainer = document.getElementById('app') as HTMLDivElement;

// --- CALL UI ---
async function startCall(roomId: string) {
    appContainer.innerHTML = ''; // Clear Landing

    // Video Container
    const vidWrapper = document.createElement('div');
    vidWrapper.className = 'video-container';
    appContainer.appendChild(vidWrapper);

    // Remote Video
    const remoteVideo = document.createElement('video');
    remoteVideo.className = 'remote-video';
    remoteVideo.autoplay = true; remoteVideo.playsInline = true;
    vidWrapper.appendChild(remoteVideo);

    // Local Video
    const localVideo = document.createElement('video');
    localVideo.className = 'local-video';
    localVideo.autoplay = true; localVideo.playsInline = true; localVideo.muted = true;
    vidWrapper.appendChild(localVideo);

    // Controls Bar (Floating Pill)
    const controls = document.createElement('div');
    controls.style.cssText = `
    position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 16px; z-index: 30;
    padding: 12px 24px; background: rgba(0,0,0,0.4); border-radius: 99px;
    backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);
  `;

    controls.innerHTML = `
    <button id="copyBtn" class="icon-btn" title="Copy Link">${ICONS.copy}</button>
    <button id="vidBtn" class="icon-btn active" title="Toggle Cam">${ICONS.cam}</button>
    <button id="muteBtn" class="icon-btn active" title="Toggle Mic">${ICONS.mic}</button>
    <button id="endBtn" class="icon-btn danger" title="End Call">${ICONS.end}</button>
  `;
    appContainer.appendChild(controls);

    // Status Text
    const status = document.createElement('div');
    status.style.cssText = `
    position: absolute; top: 40px; left: 50%; transform: translateX(-50%);
    font-family: monospace; color: rgba(255,255,255,0.6); font-size: 12px; letter-spacing: 2px;
    z-index: 20; text-transform: uppercase; pointer-events: none;
  `;
    status.innerText = `WAITING FOR PEER...`;
    appContainer.appendChild(status);

    // Logic
    document.getElementById('copyBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href);
        status.innerText = 'LINK COPIED';
        status.style.color = '#fff';
        setTimeout(() => { status.innerText = 'SECURE CONNECTION'; status.style.color = 'rgba(255,255,255,0.6)'; }, 2000);
    });
    document.getElementById('endBtn')?.addEventListener('click', () => window.location.href = '/');

    const signalUrl = getSignalingUrl();
    appState.manager = new PeerManager(roomId, signalUrl);

    appState.manager.onRemoteStream = (stream) => {
        remoteVideo.srcObject = stream;
        status.innerText = 'ENCRYPTED • X25519';
        status.style.color = '#4ADE80'; // Green
    };

    try {
        await appState.manager.start();
        const localStream = appState.manager.getLocalStream();
        if (localStream) localVideo.srcObject = localStream;

        // Buttons
        document.getElementById('muteBtn')?.addEventListener('click', (e) => {
            const btn = e.currentTarget as HTMLElement;
            const track = localStream?.getAudioTracks()[0];
            if (track) {
                appState.isMuted = !appState.isMuted;
                track.enabled = !appState.isMuted;
                btn.classList.toggle('active');
                btn.innerHTML = appState.isMuted ? ICONS.micOff : ICONS.mic;
            }
        });

        document.getElementById('vidBtn')?.addEventListener('click', (e) => {
            const btn = e.currentTarget as HTMLElement;
            const track = localStream?.getVideoTracks()[0];
            if (track) {
                appState.isVideoOff = !appState.isVideoOff;
                track.enabled = !appState.isVideoOff;
                btn.classList.toggle('active');
                btn.innerHTML = appState.isVideoOff ? ICONS.camOff : ICONS.cam;
            }
        });

    } catch (e) {
        status.innerText = 'CONNECTION ERROR';
        status.style.color = '#EF4444';
    }
}

// --- LANDING UI ---
function renderHome() {
    // Main Layout: Flex Column Centered
    appContainer.style.cssText = `
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100vh; position: relative; z-index: 10;
  `;

    appContainer.innerHTML = `
    <div class="card">
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 24px;">
        <div style="width: 8px; height: 8px; background: var(--accent); border-radius: 50%;"></div>
        <span style="font-size: 12px; font-weight: 600; color: var(--accent); letter-spacing: 1px;">V01.1</span>
      </div>
      
      <h1>Talkr.</h1>
      <p>Peer-to-peer encrypted video. <br/> No signup. No servers. No logs.</p>

      <div style="margin-top: 48px;">
        <button id="createBtn" class="pill-btn primary">
           Start Instant Meeting
        </button>
      </div>

      <div style="margin-top: 32px; font-size: 12px; color: var(--fg-secondary); opacity: 0.5;">
        PROTECTED BY AES-GCM & X25519
      </div>
    </div>
  `;

    document.getElementById('createBtn')?.addEventListener('click', () => {
        const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        window.history.pushState({}, '', `?m=${randomId}`);
        startCall(randomId);
    });
}

const urlParams = new URLSearchParams(window.location.search);
const meetingId = urlParams.get('m');
if (meetingId) startCall(meetingId);
else renderHome();