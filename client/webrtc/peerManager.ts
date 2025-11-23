import { CryptoEngine } from '../crypto/crypto';
import { E2EETransformer } from '../e2ee/e2ee-transform';

export class PeerManager {
    private pc: RTCPeerConnection | null = null;
    private ws: WebSocket;
    private roomId: string;
    private localStream: MediaStream | null = null;
    private crypto: CryptoEngine;
    private e2ee: E2EETransformer;

    // Features
    private chatChannel: RTCDataChannel | null = null;
    private fileChannel: RTCDataChannel | null = null;
    private supportsE2EE = !!(window.RTCRtpSender && 'createEncodedStreams' in window.RTCRtpSender.prototype);

    // Trackers
    private processedSenders = new WeakSet<RTCRtpSender>();
    private processedReceivers = new WeakSet<RTCRtpReceiver>();
    private hasSentKey = false;

    // Callbacks
    public onRemoteStream: ((stream: MediaStream) => void) | null = null;
    public onChatMessage: ((msg: any) => void) | null = null;
    public onFileProgress: ((percent: number) => void) | null = null;
    public onFileReceived: ((blob: Blob, name: string) => void) | null = null;

    // File Transfer State
    private receivedBuffers: ArrayBuffer[] = [];
    private receivedSize = 0;
    private fileSize = 0;
    private fileName = '';

    constructor(roomId: string, signalingUrl: string) {
        this.roomId = roomId;
        this.crypto = new CryptoEngine();
        this.e2ee = new E2EETransformer(this.crypto);
        this.ws = new WebSocket(signalingUrl);
        this.setupSignaling();
        if (!this.supportsE2EE) console.warn('[Talkr] Legacy Mode');
    }

    // --- SETUP ---
    private initPeerConnection(iceConfig: any) {
        const config = { ...iceConfig, encodedInsertableStreams: this.supportsE2EE };
        this.pc = new RTCPeerConnection(config);
        this.setupPeerEvents();

        // DATA CHANNELS (Host creates them)
        // We rely on 'negotiated: true' so both sides create them with same ID
        // forcing simpler logic than manual offer/answer negotiation for channels
        this.chatChannel = this.pc.createDataChannel('chat', { negotiated: true, id: 0 });
        this.setupChatChannel();

        this.fileChannel = this.pc.createDataChannel('file', { negotiated: true, id: 1 });
        this.setupFileChannel();

        if (this.localStream) this.addLocalTracksToPc();
    }

    // --- DATA CHANNELS ---
    private setupChatChannel() {
        if (!this.chatChannel) return;
        this.chatChannel.onmessage = (e) => {
            if (this.onChatMessage) this.onChatMessage(JSON.parse(e.data));
        };
    }

    private setupFileChannel() {
        if (!this.fileChannel) return;
        this.fileChannel.binaryType = 'arraybuffer';
        this.fileChannel.onmessage = (e) => {
            const data = e.data;
            if (typeof data === 'string') {
                // Metadata
                const meta = JSON.parse(data);
                if (meta.type === 'start') {
                    this.receivedBuffers = [];
                    this.receivedSize = 0;
                    this.fileSize = meta.size;
                    this.fileName = meta.name;
                }
            } else {
                // Chunk
                this.receivedBuffers.push(data);
                this.receivedSize += data.byteLength;
                if (this.onFileProgress) this.onFileProgress(this.receivedSize / this.fileSize);

                if (this.receivedSize >= this.fileSize) {
                    const blob = new Blob(this.receivedBuffers);
                    if (this.onFileReceived) this.onFileReceived(blob, this.fileName);
                    this.receivedBuffers = [];
                }
            }
        };
    }

    public sendChat(text: string) {
        if (this.chatChannel?.readyState === 'open') {
            const msg = { text, time: Date.now(), sender: 'remote' };
            this.chatChannel.send(JSON.stringify(msg));
        }
    }

    public sendFile(file: File) {
        if (this.fileChannel?.readyState !== 'open') return;

        // 1. Send Metadata
        this.fileChannel.send(JSON.stringify({ type: 'start', name: file.name, size: file.size }));

        // 2. Send Chunks
        const chunkSize = 16 * 1024; // 16KB chunks
        const reader = new FileReader();
        let offset = 0;

        const readSlice = () => {
            const slice = file.slice(offset, offset + chunkSize);
            reader.readAsArrayBuffer(slice);
        };

        reader.onload = (e) => {
            if (this.fileChannel?.readyState !== 'open') return;
            this.fileChannel.send(e.target!.result as ArrayBuffer);
            offset += chunkSize;
            if (offset < file.size) {
                readSlice();
            }
        };
        readSlice();
    }

    // --- SCREEN SHARE ---
    public async startScreenShare() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];

            const sender = this.pc?.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                sender.replaceTrack(screenTrack);

                // Revert when user stops sharing
                screenTrack.onended = () => {
                    const camTrack = this.localStream?.getVideoTracks()[0];
                    if (camTrack) sender.replaceTrack(camTrack);
                };
            }
            return screenStream;
        } catch (e) {
            console.error('Screen share cancelled', e);
            return null;
        }
    }

    // --- STATS PULSE ---
    public async getStats() {
        if (!this.pc) return null;
        const stats = await this.pc.getStats();
        let result = { rtt: '0', type: 'P2P' };

        stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                result.rtt = (report.currentRoundTripTime * 1000).toFixed(0);
            }
            if (report.type === 'remote-candidate') {
                if (report.candidateType === 'relay') result.type = 'TURN';
                else result.type = 'P2P';
            }
        });
        return result;
    }

    // --- STANDARD WEBRTC LOGIC ---
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
                } catch (e) { }
            }
        });
    }

    async start(existingStream?: MediaStream) {
        await this.crypto.generateKeyPair();
        if (existingStream) this.localStream = existingStream;
        else {
            try { this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
            catch (e) { try { this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { } }
        }
        if (this.pc) this.addLocalTracksToPc();
        if (this.ws.readyState === WebSocket.OPEN) this.send({ type: 'join', roomId: this.roomId });
        else this.ws.onopen = () => this.send({ type: 'join', roomId: this.roomId });
    }

    private setupPeerEvents() {
        if (!this.pc) return;
        this.pc.onicecandidate = (e) => { if (e.candidate) this.send({ type: 'ice', candidate: e.candidate, roomId: this.roomId }); };
        this.pc.ontrack = (e) => {
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
                case 'offer': await this.pc.setRemoteDescription(data.sdp); const ans = await this.pc.createAnswer(); await this.pc.setLocalDescription(ans); this.send({ type: 'answer', sdp: ans, roomId: this.roomId }); break;
                case 'answer': await this.pc.setRemoteDescription(data.sdp); break;
                case 'ice': await this.pc.addIceCandidate(data.candidate); break;
            }
        };
    }
    private send(data: any) { this.ws.send(JSON.stringify(data)); }
    public getLocalStream() { return this.localStream; }
}