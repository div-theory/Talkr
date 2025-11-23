import './styles/global.css';
import { PeerManager } from './webrtc/peerManager';

// --- CONFIG ---
const PROD_SIGNALING_URL = 'wss://talkr-server.onrender.com';
const getSignalingUrl = () =>
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'ws://localhost:8080' : PROD_SIGNALING_URL;

// --- UTILS: PIXEL DECIPHER ANIMATION ---
function decipherText(element: HTMLElement, finalString: string) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*';
    let iterations = 0;

    const interval = setInterval(() => {
        element.innerText = finalString
            .split('')
            .map((char, index) => {
                if (index < iterations) return char;
                return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('');

        if (iterations >= finalString.length) clearInterval(interval);
        iterations += 1 / 2; // Speed
    }, 30);
}

const appState = {
    manager: null as PeerManager | null,
    isMuted: false, isVideoOff: false
};

const appContainer = document.getElementById('app') as HTMLDivElement;

// --- COMPONENT: VIDEO ---
function createVideoElement(isLocal: boolean): HTMLVideoElement {
    const vid = document.createElement('video');
    vid.autoplay = true; vid.playsInline = true;
    if (isLocal) vid.muted = true;
    // Styling handled by CSS classes .video-card
    return vid;
}

// --- VIEW: CALL INTERFACE (BENTO STYLE) ---
async function startCall(roomId: string) {
    appContainer.innerHTML = `<div class="grid-overlay"></div>`; // BG Grid

    const callContainer = document.createElement('div');
    callContainer.className = 'call-grid';
    appContainer.appendChild(callContainer);

    // 1. Main View (Remote)
    const remoteWrapper = document.createElement('div');
    remoteWrapper.className = 'video-card';
    remoteWrapper.style.gridColumn = '1 / 3';
    remoteWrapper.style.gridRow = '1 / 2';
    const remoteVideo = createVideoElement(false);
    remoteWrapper.appendChild(remoteVideo);
    callContainer.appendChild(remoteWrapper);

    // 2. Status Tag (Floating)
    const statusTag = document.createElement('div');
    statusTag.className = 'tag';
    statusTag.style.position = 'absolute'; statusTag.style.top = '24px'; statusTag.style.left = '24px';
    statusTag.style.zIndex = '10';
    statusTag.innerText = 'INITIALIZING LINK...';
    remoteWrapper.appendChild(statusTag);

    // 3. Local View (Side Block)
    const localWrapper = document.createElement('div');
    localWrapper.className = 'video-card';
    localWrapper.style.gridColumn = '2 / 3';
    localWrapper.style.gridRow = '2 / 3';
    localWrapper.style.height = '180px'; // Fixed height for local view
    const localVideo = createVideoElement(true);
    localWrapper.appendChild(localVideo);
    callContainer.appendChild(localWrapper);

    // 4. Controls Dock (Main Block)
    const controlsCard = document.createElement('div');
    controlsCard.className = 'bento-card';
    controlsCard.style.gridColumn = '1 / 2';
    controlsCard.style.gridRow = '2 / 3';
    controlsCard.style.flexDirection = 'row';
    controlsCard.style.alignItems = 'center';
    controlsCard.style.padding = '0 32px';
    controlsCard.style.height = '180px'; // Match height

    controlsCard.innerHTML = `
    <div style="flex: 1;">
      <div class="tag" style="margin-bottom: 8px;">ROOM ID</div>
      <h2 style="font-size: 32px; font-weight: 700; letter-spacing: -1px;">${roomId}</h2>
    </div>
    <div style="display: flex; gap: 16px;">
      <button id="copyBtn" class="btn-icon">🔗</button>
      <button id="muteBtn" class="btn-icon">🎤</button>
      <button id="vidBtn" class="btn-icon">📷</button>
      <button id="endBtn" class="btn-icon danger">✕</button>
    </div>
  `;
    callContainer.appendChild(controlsCard);

    // EVENT LOGIC
    document.getElementById('copyBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href);
        decipherText(statusTag, 'LINK COPIED');
        setTimeout(() => statusTag.innerText = 'SECURE CONNECTION', 2000);
    });
    document.getElementById('endBtn')?.addEventListener('click', () => window.location.href = '/');

    // START ENGINE
    const signalUrl = getSignalingUrl();
    appState.manager = new PeerManager(roomId, signalUrl);

    appState.manager.onRemoteStream = (stream) => {
        remoteVideo.srcObject = stream;
        decipherText(statusTag, 'E2EE ENCRYPTED');
        statusTag.style.color = 'var(--accent)';
    };

    try {
        await appState.manager.start();
        const localStream = appState.manager.getLocalStream();
        if (localStream) localVideo.srcObject = localStream;

        // Buttons
        document.getElementById('muteBtn')?.addEventListener('click', (e) => {
            const btn = e.target as HTMLElement;
            const track = localStream?.getAudioTracks()[0];
            if (track) {
                appState.isMuted = !appState.isMuted;
                track.enabled = !appState.isMuted;
                btn.classList.toggle('active');
            }
        });

        document.getElementById('vidBtn')?.addEventListener('click', (e) => {
            const btn = e.target as HTMLElement;
            const track = localStream?.getVideoTracks()[0];
            if (track) {
                appState.isVideoOff = !appState.isVideoOff;
                track.enabled = !appState.isVideoOff;
                btn.classList.toggle('active');
            }
        });

    } catch (e) {
        statusTag.innerText = 'CONNECTION ERROR';
        statusTag.style.color = '#FF0000';
    }
}

// --- VIEW: LANDING (BENTO SPLIT) ---
function renderHome() {
    appContainer.innerHTML = `<div class="grid-overlay"></div>`;

    const wrapper = document.createElement('div');
    wrapper.className = 'bento-container';

    // 1. Hero Card
    const heroCard = document.createElement('div');
    heroCard.className = 'bento-card';
    heroCard.innerHTML = `
    <div>
        <div class="tag" style="margin-bottom: 24px;">V01.1</div>
        <h1 class="decipher-target">TALKR</h1>
        <p style="font-size: 18px; color: var(--fg-secondary); max-width: 300px; line-height: 1.5;">
            Peer-to-peer video encryption. No servers. No logs. Pure privacy.
        </p>
    </div>
    <div style="display: flex; gap: 12px; margin-top: 48px;">
        <div class="tag">AES-GCM</div>
        <div class="tag">X25519</div>
    </div>
  `;
    wrapper.appendChild(heroCard);

    // 2. Action Card
    const actionCard = document.createElement('div');
    actionCard.className = 'bento-card';
    actionCard.style.justifyContent = 'center';
    actionCard.style.alignItems = 'center';
    actionCard.style.background = 'var(--fg-primary)'; // Inverted Block
    actionCard.style.color = 'var(--bg-card)';

    actionCard.innerHTML = `
    <div style="text-align: center;">
        <div style="font-family: var(--font-mono); opacity: 0.7; margin-bottom: 16px;">INSTANT SESSION</div>
        <button id="createBtn" class="btn" style="background: var(--bg-card); color: var(--fg-primary);">
            START MEETING
        </button>
    </div>
  `;
    wrapper.appendChild(actionCard);

    appContainer.appendChild(wrapper);

    // Interactions
    const title = heroCard.querySelector('.decipher-target') as HTMLElement;
    decipherText(title, 'TALKR');

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