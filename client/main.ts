import './styles/global.css';
import { PeerManager } from './webrtc/peerManager';

// CONFIGURATION
// REPLACE WITH YOUR RENDER URL
const PROD_SIGNALING_URL = 'wss://talkr-server.onrender.com';

const getSignalingUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'ws://localhost:8080';
    }
    return PROD_SIGNALING_URL;
};

// UI State
const appState = {
    manager: null as PeerManager | null,
    isMuted: false,
    isVideoOff: false
};

const appContainer = document.getElementById('app') as HTMLDivElement;

function createVideoElement(isLocal: boolean): HTMLVideoElement {
    const vid = document.createElement('video');
    vid.autoplay = true; vid.playsInline = true;
    if (isLocal) vid.muted = true;

    vid.style.borderRadius = 'var(--radius-card)';
    vid.style.border = '1px solid var(--muted-stroke-light)';
    vid.style.backgroundColor = '#000';

    if (isLocal) {
        vid.style.width = '120px'; vid.style.height = 'auto';
        vid.style.position = 'absolute'; vid.style.bottom = '100px'; vid.style.right = '24px';
        vid.style.zIndex = '10'; vid.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        vid.style.transition = 'all 0.3s ease';
    } else {
        vid.style.objectFit = 'cover'; vid.style.width = '100%'; vid.style.height = '100%';
    }
    return vid;
}

async function startCall(roomId: string) {
    appContainer.innerHTML = ''; appContainer.style.backgroundColor = '#000';

    // Videos
    const remoteVideo = createVideoElement(false); appContainer.appendChild(remoteVideo);
    const localVideo = createVideoElement(true); appContainer.appendChild(localVideo);

    // Status
    const statusOverlay = document.createElement('div');
    statusOverlay.style.position = 'absolute'; statusOverlay.style.top = '50%'; statusOverlay.style.left = '50%';
    statusOverlay.style.transform = 'translate(-50%, -50%)';
    statusOverlay.style.color = 'rgba(255,255,255,0.4)'; statusOverlay.style.fontFamily = 'var(--font-mono)';
    statusOverlay.innerText = 'SECURE LINKING...';
    appContainer.appendChild(statusOverlay);

    // Top Info Bar
    const topBar = document.createElement('div');
    topBar.style.position = 'absolute'; topBar.style.top = '24px'; topBar.style.left = '24px'; topBar.style.zIndex = '20';
    topBar.innerHTML = `
    <div class="card" style="padding: 8px 16px; display: flex; gap: 12px; align-items: center; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px);">
      <span style="font-family: var(--font-mono); font-size: 14px; font-weight: 700;">${roomId}</span>
      <div style="width: 1px; height: 12px; background: rgba(0,0,0,0.1);"></div>
      <button class="btn" id="copyBtn" style="border: none; padding: 0; font-size: 11px; height: auto;">COPY LINK</button>
    </div>
  `;
    appContainer.appendChild(topBar);
    document.getElementById('copyBtn')?.addEventListener('click', (e) => {
        navigator.clipboard.writeText(window.location.href);
        (e.target as HTMLElement).innerText = 'COPIED';
    });

    // Bottom Control Bar
    const controls = document.createElement('div');
    controls.style.position = 'absolute'; controls.style.bottom = '32px';
    controls.style.left = '50%'; controls.style.transform = 'translateX(-50%)';
    controls.style.zIndex = '20';
    controls.style.display = 'flex'; controls.style.gap = '16px';

    controls.innerHTML = `
    <button id="muteBtn" class="btn" style="background: rgba(255,255,255,0.9); width: 48px; height: 48px; border-radius: 50%; padding: 0; justify-content: center;">MIC</button>
    <button id="endBtn" class="btn" style="background: #FF3333; color: white; width: 48px; height: 48px; border-radius: 50%; padding: 0; justify-content: center; border: none;">X</button>
    <button id="vidBtn" class="btn" style="background: rgba(255,255,255,0.9); width: 48px; height: 48px; border-radius: 50%; padding: 0; justify-content: center;">CAM</button>
  `;
    appContainer.appendChild(controls);

    // START ENGINE
    const signalUrl = getSignalingUrl();
    appState.manager = new PeerManager(roomId, signalUrl);

    appState.manager.onRemoteStream = (stream) => {
        remoteVideo.srcObject = stream;
        statusOverlay.innerText = 'ENCRYPTED';
        statusOverlay.style.opacity = '0';
        setTimeout(() => statusOverlay.remove(), 1000);
    };

    try {
        await appState.manager.start();
        const localStream = appState.manager.getLocalStream();
        if (localStream) localVideo.srcObject = localStream;

        // Button Logic
        document.getElementById('endBtn')?.addEventListener('click', () => {
            window.location.href = '/';
        });

        document.getElementById('muteBtn')?.addEventListener('click', (e) => {
            if (!localStream) return;
            const track = localStream.getAudioTracks()[0];
            if (track) {
                appState.isMuted = !appState.isMuted;
                track.enabled = !appState.isMuted;
                (e.target as HTMLElement).style.background = appState.isMuted ? '#ffcccc' : 'rgba(255,255,255,0.9)';
                (e.target as HTMLElement).style.textDecoration = appState.isMuted ? 'line-through' : 'none';
            }
        });

        document.getElementById('vidBtn')?.addEventListener('click', (e) => {
            if (!localStream) return;
            const track = localStream.getVideoTracks()[0];
            if (track) {
                appState.isVideoOff = !appState.isVideoOff;
                track.enabled = !appState.isVideoOff;
                (e.target as HTMLElement).style.background = appState.isVideoOff ? '#ffcccc' : 'rgba(255,255,255,0.9)';
                (e.target as HTMLElement).style.textDecoration = appState.isVideoOff ? 'line-through' : 'none';
            }
        });

    } catch (e) {
        statusOverlay.innerText = 'CONNECTION ERROR';
        statusOverlay.style.color = '#FF3333';
    }
}

function renderHome() {
    appContainer.innerHTML = `
      <main style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
        <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 24px;">TALKR</h1>
        <div class="card" style="width: 320px; text-align: center; padding: 32px;">
          <p style="margin-bottom: 24px; font-family: var(--font-mono); font-size: 11px; color: #666; text-transform: uppercase;">End-to-End Encrypted / Peer-to-Peer</p>
          <button id="createBtn" class="btn btn-primary" style="width: 100%; justify-content: center;">START MEETING &rarr;</button>
        </div>
      </main>
  `;
    document.getElementById('createBtn')?.addEventListener('click', () => {
        const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        window.history.pushState({}, '', `?m=${randomId}`);
        startCall(randomId);
    });
}

const urlParams = new URLSearchParams(window.location.search);
const meetingId = urlParams.get('m');
if (meetingId) startCall(meetingId); else renderHome();