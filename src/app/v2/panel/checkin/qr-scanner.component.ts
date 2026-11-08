import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

type ScannerState = 'idle' | 'starting' | 'running' | 'denied' | 'unavailable';

/** Lo mínimo que se usa de los controles del lector (@zxing/browser se carga solo cuando se enciende la cámara). */
interface Controls { stop(): void }

const SAME_CODE_PAUSE_MS = 2500;

/**
 * Cámara con lector de QR. Se enciende con [active]="true" y emite el texto leído.
 * El lector (@zxing/browser) se descarga al encender la cámara por primera vez.
 */
@Component({
    selector: 'app-qr-scanner',
    standalone: true,
    imports: [TranslateModule],
    template: `
    <div class="qr" [class.qr--on]="state() === 'running'">
      <video #video class="qr__video" playsinline muted></video>
      @if (state() === 'running') { <div class="qr__frame" aria-hidden="true"></div> }
      @switch (state()) {
        @case ('starting') { <div class="qr__msg">{{ 'V2.ADMIN.CHECKIN.CAMERA_STARTING' | translate }}</div> }
        @case ('denied') { <div class="qr__msg qr__msg--warn"><i class="bi bi-camera-video-off"></i> {{ 'V2.ADMIN.CHECKIN.CAMERA_DENIED' | translate }}</div> }
        @case ('unavailable') { <div class="qr__msg qr__msg--warn"><i class="bi bi-exclamation-triangle"></i> {{ 'V2.ADMIN.CHECKIN.CAMERA_UNAVAILABLE' | translate }}</div> }
        @case ('idle') { <div class="qr__msg"><i class="bi bi-qr-code-scan"></i></div> }
      }
    </div>
  `,
    styles: [`
    :host { display: block; }
    .qr { position: relative; aspect-ratio: 1 / 1; max-height: 60vh; width: 100%; background: #0f172a; border-radius: 16px; overflow: hidden; }
    .qr__video { width: 100%; height: 100%; object-fit: cover; display: none; }
    .qr--on .qr__video { display: block; }
    .qr__frame { position: absolute; inset: 18%; border: 3px solid rgba(255, 255, 255, .9); border-radius: 16px; box-shadow: 0 0 0 999px rgba(15, 23, 42, .35); pointer-events: none; }
    .qr__msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; gap: 8px;
      padding: 24px; color: #cbd5e1; font-size: 15px; }
    .qr__msg .bi-qr-code-scan { font-size: 56px; opacity: .6; }
    .qr__msg--warn { color: #fde68a; }
  `],
})
export class QrScannerComponent implements AfterViewInit, OnDestroy {
    @ViewChild('video', { static: true }) video!: ElementRef<HTMLVideoElement>;
    @Output() decoded = new EventEmitter<string>();

    readonly state = signal<ScannerState>('idle');

    private wanted = false;
    private viewReady = false;
    private controls: Controls | null = null;
    /** Cada encendido/apagado invalida los anteriores (la cámara tarda en abrir). */
    private run = 0;
    private lastText = '';
    private lastAt = 0;

    @Input() set active(value: boolean) {
        this.wanted = value;
        if (!this.viewReady) return;
        if (value) void this.start(); else this.stop();
    }

    ngAfterViewInit() {
        this.viewReady = true;
        if (this.wanted) void this.start();
    }

    ngOnDestroy() {
        this.wanted = false;
        this.stop();
    }

    private async start() {
        if (this.controls || this.state() === 'starting') return;
        const run = ++this.run;
        this.state.set('starting');
        try {
            const { BrowserQRCodeReader } = await import('@zxing/browser');
            if (run !== this.run) return;
            const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 120 });
            const controls = await reader.decodeFromConstraints(
                { video: { facingMode: { ideal: 'environment' } } },
                this.video.nativeElement,
                (result) => { if (result) this.onText(result.getText()); },
            );
            if (run !== this.run) { controls.stop(); return; }
            this.controls = controls;
            this.state.set('running');
        } catch (err) {
            if (run !== this.run) return;
            const name = (err as { name?: string })?.name;
            this.state.set(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
        }
    }

    private stop() {
        this.run++;
        this.controls?.stop();
        this.controls = null;
        if (this.state() === 'running' || this.state() === 'starting') this.state.set('idle');
    }

    private onText(text: string) {
        const now = Date.now();
        // La cámara vuelve a leer el mismo QR varias veces por segundo: se avisa una sola vez
        if (text === this.lastText && now - this.lastAt < SAME_CODE_PAUSE_MS) return;
        this.lastText = text;
        this.lastAt = now;
        this.decoded.emit(text);
    }
}
