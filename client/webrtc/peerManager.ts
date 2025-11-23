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
    private supportsE2EE = !!(window.RTCRtpSender && 'createEncodedStreams' in window.RTCRtpSender.prototype);
    private wakeLock: any = null;
    public onRemoteStream: ((stream: MediaStream) => void) | null = null;

    constructor(roomId: string, signalingUrl: string) {
        this.roomId = roomId;
        this.crypto = new CryptoEngine();
        this.e2ee = new E2EETransformer(this.crypto);
        this.ws = new WebSocket(signalingUrl);
        this.setupSignaling();
        this.requestWakeLock();
        if (!this.supportsE2EE) console.warn('[Talkr] Legacy Mode');
    }

    private async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try { this.wakeLock = await (navigator as any).wakeLock.request('screen'); } catch (e) { }
        }
    }

    private initPeerConnection(iceConfig: any) {
        const config = { ...iceConfig, encodedInsertableStreams: this.supportsE2EE };
        this.pc = new RTCPeerConnection(config);
        this.setupPeerEvents();
        if (this.localStream) this.addLocalTracksToPc();
    }

    private addLocalTracksToPc() {
        if (!this.pc || !this.localStream) return;
        this.localStream.getTracks().forEach(track => {
            const sender = this.pc!.addTrack(track, this.localStream!);
            if (this.supportsE2EE && track.kind === 'video') {
                if (this.processedSenders.has(sender)) return;
                this.processedSenders.add(sender);
                try {
                    const streams = (sender as any).createEncodedStreams();
                    const transformStream = this.e2ee.senderTransform();
                    streams.readable.pipeThrough(transformStream).pipeTo(streams.writable);
                } catch (e) { console.error(e); }
            }
        });
    }

    // Modified Start: Accepts existing stream or handles fallback
    async start(existingStream?: MediaStream) {
        await this.crypto.generateKeyPair();

        if (existingStream) {
            this.localStream = existingStream;
        } else {
            // Fallback logic if no stream passed
            try {
                // Try Video + Audio
                this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            } catch (e) {
                console.warn('Video failed, trying Audio only...');
                try {
                    // Try Audio Only
                    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (err) {
                    console.error('No devices found.');
                    return; // App will show no signal, but won't crash
                }
            }
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
        this.pc.onicecandidate = (e) => { if (e.candidate) this.send({ type: 'ice', candidate: e.candidate, roomId: this.roomId }); };
        this.pc.ontrack = (e) => {
            // Only attach E2EE if it is a VIDEO track
            if (e.track.kind === 'video' && this.supportsE2EE) {
                const receiver = e.receiver;
                if (!this.processedReceivers.has(receiver)) {
                    this.processedReceivers.add(receiver);
                    try {
                        const streams = (receiver as any).createEncodedStreams();
                        const transformStream = this.e2ee.receiverTransform();
                        streams.readable.pipeThrough(transformStream).pipeTo(streams.writable);
                    } catch (e) { }
                }
            }
            if (this.onRemoteStream) this.onRemoteStream(e.streams[0]);
        };
    }

    private setupSignaling() {
        this.ws.onmessage = async (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'config-ice') { this.initPeerConnection(data.iceServers); return; }
            if (!this.pc) return;

            switch (data.type) {
                case 'ready':
                    const pubKey = await this.crypto.exportPublicKey();
                    this.send({ type: 'key-exchange', key: pubKey, roomId: this.roomId });
                    this.hasSentKey = true;
                    break;
                case 'key-exchange':
                    const peerKey = await this.crypto.importPeerKey(data.key);
                    await this.crypto.deriveSharedSecret(peerKey);
                    if (!this.hasSentKey) {
                        const myKey = await this.crypto.exportPublicKey();
                        this.send({ type: 'key-exchange', key: myKey, roomId: this.roomId });
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
                case 'answer': await this.pc.setRemoteDescription(data.sdp); break;
                case 'ice': await this.pc.addIceCandidate(data.candidate); break;
            }
        };
    }
    private send(data: any) { this.ws.send(JSON.stringify(data)); }
    public getLocalStream() { return this.localStream; }
}