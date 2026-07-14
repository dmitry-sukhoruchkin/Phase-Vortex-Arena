export const UV_SCALE = (1.2 / 4.0 / 8388607.0) * 1e6;
export const BUF_SIZE = 256;

function fft(re: Float32Array, im: Float32Array) { 
    const n = re.length;
    for (let i = 0, j = 0; i < n; i++) {
        if (j > i) {
            let tr = re[i], ti = im[i];
            re[i] = re[j]; im[i] = im[j];
            re[j] = tr; im[j] = ti;
        }
        let m = n >> 1; 
        while (m >= 1 && j >= m) { j -= m; m >>= 1; }
        j += m;
    }
    for (let s = 2; s <= n; s <<= 1) {
        let m = s >> 1, t = -2 * Math.PI / s, wr = Math.cos(t), wi = Math.sin(t);
        for (let i = 0; i < n; i += s) {
            let ar = 1, ai = 0;
            for (let j = 0; j < m; j++) {
                let u = i + j, v = u + m;
                let tr = ar * re[v] - ai * im[v], ti = ar * im[v] + ai * re[v];
                re[v] = re[u] - tr; im[v] = im[u] - ti; 
                re[u] += tr; im[u] += ti;
                let nar = ar * wr - ai * wi;
                ai = ar * wi + ai * wr;
                ar = nar;
            }
        }
    }
}

function applyNotchFilters(re: Float32Array, im: Float32Array) {
    for(let k of [51, 102]) { 
        for(let i=-1; i<=1; i++) { 
            if(re[k+i]!==undefined) {
                re[k+i]=0;
                im[k+i]=0; 
            }
        } 
    }
}

export class NeuroService {
    public onData: ((data: any) => void) | null = null;
    public numChannels = 16;
    
    private eegBuffer: Float32Array[] = [];
    private reArr: Float32Array[] = [];
    private imArr: Float32Array[] = [];
    private centered: Float32Array[] = [];
    private normRe: Float32Array[] = [];
    private normIm: Float32Array[] = [];
    
    public isConnected = false;
    private lastEegProcess = 0;

    public electrodes = [
        { x: 10.14, y: -2.72 }, { x: 7.43, y: -7.43 }, { x: 2.75, y: -4.77 }, { x: 2.72, y: -10.15 },
        { x: -2.72, y: -10.14 }, { x: -2.75, y: -4.77 }, { x: -7.42, y: -7.42 }, { x: -10.14, y: -2.73 },
        { x: -10.14, y: 2.72 }, { x: -7.43, y: 7.43 }, { x: -2.75, y: 4.76 }, { x: -2.72, y: 10.14 },
        { x: 2.72, y: 10.15 }, { x: 2.75, y: 4.77 }, { x: 7.43, y: 7.42 }, { x: 10.14, y: 2.71 }
    ];

    constructor() {
        this.initBuffers(this.numChannels);
    }

    private initBuffers(channels: number) {
        this.numChannels = channels;
        this.eegBuffer = [];
        this.reArr = [];
        this.imArr = [];
        this.centered = [];
        this.normRe = [];
        this.normIm = [];
        for(let i=0; i<channels; i++) {
            this.eegBuffer.push(new Float32Array(BUF_SIZE));
            this.reArr.push(new Float32Array(BUF_SIZE));
            this.imArr.push(new Float32Array(BUF_SIZE));
            this.centered.push(new Float32Array(BUF_SIZE));
            this.normRe.push(new Float32Array(BUF_SIZE));
            this.normIm.push(new Float32Array(BUF_SIZE));
        }
    }

    async connectBLE() {
        try {
            const device = await (navigator as any).bluetooth.requestDevice({ 
                filters: [{ services:["4fafc201-1fb5-459e-8fcc-c5c9c331914b"] }] 
            });
            const server = await device.gatt?.connect();
            if (!server) throw new Error("GATT Server not found");
            
            const service = await server.getPrimaryService("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
            const dataChar = await service.getCharacteristic("beb5483e-36e1-4688-b7f5-ea07361b26a8");
            const cmdChar = await service.getCharacteristic("c0de0001-36e1-4688-b7f5-ea07361b26a8");
            
            // Set gain to 4 for raw active electrodes
            await cmdChar.writeValue(new Uint8Array([0x04, 0x22, 0x22]));
            await new Promise(r => setTimeout(r, 100));
            await cmdChar.writeValue(new Uint8Array([0x05, 0x22, 0x22]));

            await dataChar.startNotifications();
            dataChar.addEventListener('characteristicvaluechanged', (e: any) => {
                const b = new Uint8Array(e.target.value.buffer);
                if(b[0] === 0xA0) {
                    const expectedChannels = Math.floor((b.length - 2) / 3);
                    const activeChannels = expectedChannels >= 16 ? 16 : (expectedChannels >= 8 ? 8 : expectedChannels);
                    
                    if (this.numChannels !== activeChannels) {
                        this.initBuffers(activeChannels);
                    }

                    for(let i=0; i<activeChannels; i++) {
                        let v = (b[2+i*3]<<16) | (b[3+i*3]<<8) | b[4+i*3];
                        if(v & 0x800000) v -= 0x1000000;
                        this.eegBuffer[i].set(this.eegBuffer[i].subarray(1)); 
                        this.eegBuffer[i][BUF_SIZE-1] = v * UV_SCALE;
                    }
                    this.process();
                }
            });
            
            this.isConnected = true;
            console.log("BLE Connected. Using Real-Time ciPLV.");
        } catch(e) {
            console.error("BLE Connect failed:", e);
        }
    }

    async connectUART() {
        if (!('serial' in navigator)) {
            alert("Web Serial is not supported in this browser. Use Chrome, Edge or Opera.");
            return;
        }
        try {
            const port = await (navigator as any).serial.requestPort();
            await port.open({ baudRate: 115200 });
            this.isConnected = true;
            console.log("UART Connected.");
            this.readSerialLoop(port);
        } catch (e) {
            console.error("Web Serial connection failed", e);
        }
    }

    private async readSerialLoop(port: any) {
        const reader = port.readable.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split("\n");
                buffer = lines.pop() || "";
                
                for (let line of lines) {
                    line = line.trim();
                    if (line.startsWith("S:")) {
                        const parts = line.substring(2).split(",");
                        if (parts.length === 3) {
                            const vx = parseFloat(parts[0]);
                            const vy = parseFloat(parts[1]);
                            const tq = parseFloat(parts[2]);
                            
                            if (!isNaN(vx) && !isNaN(vy) && !isNaN(tq)) {
                                if (this.onData) {
                                    this.onData({
                                        vx: vx / 15.0,
                                        vy: vy / 15.0,
                                        tq: tq / 2.0,
                                        freq: 0,
                                        spatial: 0,
                                        isNeuro: true
                                    });
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Serial read error", e);
        } finally {
            reader.releaseLock();
            this.isConnected = false;
        }
    }

    private get_band_ciPLV(idxA: number, idxB: number, k_start: number, k_end: number) {
        let sumIm = 0;
        let count = k_end - k_start + 1;
        for (let k = k_start; k <= k_end; k++) {
            let pA_re = this.normRe[idxA][k], pA_im = this.normIm[idxA][k];
            let pB_re = this.normRe[idxB][k], pB_im = this.normIm[idxB][k];
            sumIm += pA_im * pB_re - pA_re * pB_im;
        }
        return sumIm / count;
    }

    private get_band_power(idx: number, k_start: number, k_end: number) {
        let sum = 0;
        for (let k = k_start; k <= k_end; k++) {
            sum += Math.sqrt(this.reArr[idx][k]**2 + this.imArr[idx][k]**2);
        }
        return sum / (k_end - k_start + 1);
    }

    public process() {
        const time = performance.now();
        // Limit processing to roughly 30 FPS to save CPU, while buffers fill at 250Hz/500Hz
        if (time - this.lastEegProcess > 33) {
            this.lastEegProcess = time;
            
            // 1. Center the signals to remove DC bias
            for(let t=0; t<BUF_SIZE; t++) {
                let avg = 0; 
                for(let c=0; c<this.numChannels; c++) avg += this.eegBuffer[c][t]; 
                avg /= this.numChannels;
                for(let c=0; c<this.numChannels; c++) this.centered[c][t] = this.eegBuffer[c][t] - avg;
            }

            // 2. Perform Radix-2 FFT and Notch filtering
            for(let c=0; c<this.numChannels; c++) {
                for(let t=0; t<BUF_SIZE; t++) { 
                    this.reArr[c][t] = this.centered[c][t]; 
                    this.imArr[c][t] = 0; 
                }
                fft(this.reArr[c], this.imArr[c]); 
                applyNotchFilters(this.reArr[c], this.imArr[c]);
                
                for (let k = 0; k < BUF_SIZE / 2; k++) {
                    let mag = Math.sqrt(this.reArr[c][k] ** 2 + this.imArr[c][k] ** 2) || 1e-6;
                    this.normRe[c][k] = this.reArr[c][k] / mag;
                    this.normIm[c][k] = this.imArr[c][k] / mag;
                }
            }
            
            let tvx = 0;
            let tvy = 0;
            let ttq = 0;
            let pastPower = 0;
            let futurePower = 0;
            let alphaPower = 0;

            let pairIdx = 0;
            const RADIUS = 10;
            
            // 3. Extract Spatiotemporal features via topological ciPLV
            for(let i=0; i<this.numChannels; i++) {
                alphaPower += this.get_band_power(i, 8, 12);
                for(let j=i+1; j<this.numChannels; j++) {
                    let move_val = this.get_band_ciPLV(i, j, 18, 36); // Beta (Movement)
                    let valPast = this.get_band_ciPLV(i, j, 31, 51); // Slow Gamma
                    let valFuture = this.get_band_ciPLV(i, j, 61, 102); // Fast Gamma

                    pastPower += Math.abs(valPast);
                    futurePower += Math.abs(valFuture);
                    
                    let dx = this.electrodes[j].x - this.electrodes[i].x;
                    let dy = this.electrodes[j].y - this.electrodes[i].y;
                    tvx += move_val * dx;
                    tvy += move_val * dy;
                    ttq += (move_val * (this.electrodes[i].x * dy - this.electrodes[i].y * dx)) / (RADIUS * 10);
                    
                    pairIdx++;
                }
            }
            
            const scale = 28.0 / Math.max(1, pairIdx);
            
            // Map directly to Phase Vortex Arena Inputs
            let vx = (tvx * scale) / 15.0;
            let vy = (tvy * scale) / 15.0;
            let tq = (ttq * scale) / 2.0;

            // Freq = Past vs Future power asymmetry (Miller WM 2.0 mapping)
            let freq = 0;
            if (pastPower > 0) {
                let asymmetry = (futurePower - pastPower) / pastPower;
                freq = Math.max(-1.0, Math.min(1.0, asymmetry * 1.5));
            }

            // Spatial = Alpha relaxation (inverse)
            let spatial = 0;
            let alphaNorm = (alphaPower / this.numChannels) * 100.0;
            spatial = Math.max(-1.0, Math.min(1.0, 1.0 - alphaNorm));

            if (this.onData) {
                this.onData({
                    vx: isNaN(vx) ? 0 : vx,
                    vy: isNaN(vy) ? 0 : vy,
                    tq: isNaN(tq) ? 0 : tq,
                    freq: isNaN(freq) ? 0 : freq,
                    spatial: isNaN(spatial) ? 0 : spatial,
                    isNeuro: true
                });
            }
        }
    }
}

export const neuroService = new NeuroService();