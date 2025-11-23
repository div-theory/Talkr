import { CryptoEngine } from '../crypto/crypto';
import { E2EETransformer } from '../e2ee/e2ee-transform';

export class PeerManager {
    private pc: RTCPeerConnection | null = null;
    private ws: WebSocket;
    private roomId: string;
    private localStream: MediaStream | null = null;
    private crypto: CryptoEngine;
    private e2ee: E2EETransformer;

    private hasSentKey: boolean = false;
    private processedReceivers = new WeakSet<RTCRtpReceiver>();
    private processedSenders = new WeakSet<RTCRtpSender>();

    // Capability Flags
    private localSupportsE2EE = !!(window.RTCRtpSender && 'createEncodedStreams' in window.RTCRtpSender.prototype);
    private remoteSupportsE2EE = false;
    private isE2EEActive = false;

    public onRemoteStream: ((stream: MediaStream) => void) | null = null;

    constructor(roomId: string, signalingUrl: string) {
        this.roomId = roomId;
        this.crypto = new CryptoEngine();
        this.e2ee = new E2EETransformer(this.crypto);
        this.ws = new WebSocket(signalingUrl);
        this.setupSignaling();

        if (!this.localSupportsE2EE) {
            console.warn('[Talkr] Browser does not support Insertable Streams. Fallback mode enabled.');
        }
    }

    private initPeerConnection(iceConfig: any) {
        console.log('[WebRTC] Init PC. Local E2EE Support:', this.localSupportsE2EE);

        const config = {
            ...iceConfig,
            encodedInsertableStreams: this.localSupportsE2EE
        };

        this.pc = new RTCPeerConnection(config);
        this.setupPeerEvents();

        if (this.localStream) {
            this.addLocalTracksToPc();
        }
    }

    private addLocalTracksToPc() {
        if (!this.pc || !this.localStream) return;
        this.localStream.getTracks().forEach(track => {
            this.pc!.addTrack(track, this.localStream!);
        });
    }

    // Called ONLY after we agree that both sides support E2EE
    private enableSenderEncryption() {
        if (!this.pc || !this.localSupportsE2EE) return;
        console.log('[WebRTC] Enabling E2EE for Sender...');

        this.pc.getSenders().forEach(sender => {
            if (sender.track?.kind === 'video' && !this.processedSenders.has(sender)) {
                this.processedSenders.add(sender);
                try {
                    const streams = (sender as any).createEncodedStreams();
                    const transformStream = this.e2ee.senderTransform();
                    streams.readable.pipeThrough(transformStream).pipeTo(streams.writable);
                } catch (e) { console.error('Sender E2EE Error:', e); }
            }
        });
    }

    private getDummyStream(): MediaStream {
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext('2d')!;
        let hue = 0;
        const draw = () => {
            hue = (hue + 1) % 360;
            ctx.fillStyle = `hsl(${hue}, 50%, 50%)`;
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = 'white'; ctx.font = '40px monospace';
            ctx.fillText('NO CAMERA / DUMMY SIGNAL', 50, 240);
            requestAnimationFrame(draw);
        };
        draw();
        const stream = canvas.captureStream(30);
        const audioCtx = new AudioContext();
        const resumeAudio = () => { if (audioCtx.state === 'suspended') audioCtx.resume(); };
        document.body.addEventListener('click', resumeAudio);
        const osc = audioCtx.createOscillator();
        const dst = audioCtx.createMediaStreamDestination();
        osc.connect(dst); osc.start();
        stream.addTrack(dst.stream.getAudioTracks()[0]);
        return stream;
    }

    async start() {
        await this.crypto.generateKeyPair();
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (e) {
            console.warn('Camera failed, using dummy.', e);
            this.localStream = this.getDummyStream();
        }

        if (this.pc) this.addLocalTracksToPc();

        if (this.ws.readyState === WebSocket.OPEN) {
            this.send({ type: 'join', roomId: this.roomId });
        } else {
            this.ws.onopen = () => this.send({ type: 'join', roomId: this.roomId });
        }
    }

    private setupPeerEvents() {
        if (!this.pc) return;

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.send({ type: 'ice', candidate: event.candidate, roomId: this.roomId });
            }
        };

        this.pc.ontrack = (event) => {
            // ONLY ENABLE DECRYPTION IF BOTH SIDES SUPPORT IT
            if (event.track.kind === 'video' && this.isE2EEActive) {
                const receiver = event.receiver;
                if (!this.processedReceivers.has(receiver)) {
                    this.processedReceivers.add(receiver);
                    try {
                        console.log('[WebRTC] Enabling E2EE for Receiver...');
                        const streams = (receiver as any).createEncodedStreams();
                        const transformStream = this.e2ee.receiverTransform();
                        streams.readable.pipeThrough(transformStream).pipeTo(streams.writable);
                    } catch (e) { console.error('Receiver E2EE Error:', e); }
                }
            }
            if (this.onRemoteStream) this.onRemoteStream(event.streams[0]);
        };
    }

    private setupSignaling() {
        this.ws.onmessage = async (msg) => {
            const data = JSON.parse(msg.data);

            if (data.type === 'config-ice') {
                this.initPeerConnection(data.iceServers);
                return;
            }

            if (!this.pc) return;

            switch (data.type) {
                case 'ready':
                    const pubKey = await this.crypto.exportPublicKey();
                    // Send my Key AND my E2EE capability
                    this.send({
                        type: 'key-exchange',
                        key: pubKey,
                        roomId: this.roomId,
                        supportsE2EE: this.localSupportsE2EE
                    });
                    this.hasSentKey = true;
                    break;

                case 'key-exchange':
                    const peerKey = await this.crypto.importPeerKey(data.key);
                    await this.crypto.deriveSharedSecret(peerKey);

                    // NEGOTIATE E2EE
                    this.remoteSupportsE2EE = !!data.supportsE2EE;
                    this.isE2EEActive = this.localSupportsE2EE && this.remoteSupportsE2EE;

                    console.log(`[Talkr] E2EE Negotiation: Local=${this.localSupportsE2EE}, Remote=${this.remoteSupportsE2EE} -> Active=${this.isE2EEActive}`);

                    if (this.isE2EEActive) {
                        this.enableSenderEncryption();
                    }

                    if (!this.hasSentKey) {
                        const myKey = await this.crypto.exportPublicKey();
                        this.send({
                            type: 'key-exchange',
                            key: myKey,
                            roomId: this.roomId,
                            supportsE2EE: this.localSupportsE2EE
                        });
                        this.hasSentKey = true;

                        const offer = await this.pc.createOffer();
                        await this.pc.setLocalDescription(offer);
                        this.send({ type: 'offer', sdp: offer, roomId: this.roomId });
                    }
                    break;

                case 'offer':
                    await this.pc.setRemoteDescription(data.sdp);
                    const answer = await this.pc.createAnswer();
                    await this.pc.setLocalDescription(answer);
                    this.send({ type: 'answer', sdp: answer, roomId: this.roomId });
                    break;

                case 'answer':
                    await this.pc.setRemoteDescription(data.sdp);
                    break;

                case 'ice':
                    await this.pc.addIceCandidate(data.candidate);
                    break;
            }
        };
    }

    private send(data: any) { this.ws.send(JSON.stringify(data)); }
    public getLocalStream() { return this.localStream; }
}