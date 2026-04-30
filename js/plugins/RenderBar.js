/*:
 * @target MZ
 * @plugindesc Pasek postępu renderowania wideo — timer śmierci.
 * @author ClaudeAI
 *
 * @param duration
 * @text Czas trwania (sekundy)
 * @type number
 * @min 1
 * @default 60
 * @desc Ile sekund zajmuje "renderowanie" zanim nastąpi Game Over.
 *
 * @param label
 * @text Etykieta paska
 * @type string
 * @default RENDERING VIDEO...
 *
 * @param barColor
 * @text Kolor paska (normalny, hex)
 * @type string
 * @default #00c8ff
 *
 * @param errorColor
 * @text Kolor paska (Error, hex)
 * @type string
 * @default #ff2222
 *
 * @param posX
 * @text Pozycja X
 * @type number
 * @default 20
 *
 * @param posY
 * @text Pozycja Y
 * @type number
 * @default 20
 *
 * @param barWidth
 * @text Szerokość paska
 * @type number
 * @default 400
 *
 * @param barHeight
 * @text Wysokość paska
 * @type number
 * @default 22
 *
 * @param gameOverDelay
 * @text Opóźnienie Game Over (klatki po Errorze)
 * @type number
 * @default 90
 * @desc Ile klatek czekać po pokazaniu "Error" zanim wejdzie Game Over.
 *
 * @command start
 * @text Uruchom pasek
 * @desc Zaczyna odliczanie paska renderowania.
 *
 * @command stop
 * @text Zatrzymaj pasek
 * @desc Zatrzymuje i ukrywa pasek (np. gracz wygrał).
 *
 * @command pause
 * @text Pauza paska
 * @desc Pauzuje odliczanie (czas stoi).
 *
 * @command resume
 * @text Wznów pasek
 * @desc Wznawia odliczanie po pauzie.
 *
 * @help RenderBar.js
 * ============================================================
 * PASEK RENDEROWANIA — TIMER ŚMIERCI
 * ============================================================
 * Wyświetla pasek postępu na ekranie gry.
 * Pasek pełza od lewej do prawej.
 * Gdy dobiegnie końca → zmienia kolor na czerwony i
 * pokazuje "Error", po chwili następuje Game Over.
 *
 * Komendy pluginu:
 *   start  — uruchamia/resetuje pasek
 *   stop   — ukrywa pasek (gracz wygrał / koniec sceny)
 *   pause  — pauzuje czas
 *   resume — wznawia czas
 *
 * Można też wywołać przez skrypt:
 *   $renderBar.start();
 *   $renderBar.stop();
 *   $renderBar.pause();
 *   $renderBar.resume();
 * ============================================================
 */

(() => {
    'use strict';

    const PLUGIN_NAME = 'RenderBar';
    const p = PluginManager.parameters(PLUGIN_NAME);

    const CFG = {
        duration:      Number(p.duration      || 60),
        label:         String(p.label         || 'RENDERING VIDEO...'),
        barColor:      String(p.barColor      || '#00c8ff'),
        errorColor:    String(p.errorColor    || '#ff2222'),
        x:             Number(p.posX          || 20),
        y:             Number(p.posY          || 20),
        width:         Number(p.barWidth      || 400),
        height:        Number(p.barHeight     || 22),
        gameOverDelay: Number(p.gameOverDelay || 90),
    };

    // ============================================================
    // RenderBarManager — przechowuje stan, dostępny jako $renderBar
    // ============================================================
    class RenderBarManager {
        constructor() {
            this.reset();
        }

        reset() {
            this._active       = false;
            this._paused       = false;
            this._progress     = 0;   // 0.0 – 1.0
            this._error        = false;
            this._errorTimer   = 0;
            this._totalFrames  = CFG.duration * 60;
            this._elapsedFrames = 0;
        }

        start() {
            this.reset();
            this._active = true;
        }

        stop() {
            this._active = false;
        }

        pause() {
            this._paused = true;
        }

        resume() {
            this._paused = false;
        }

        get active()    { return this._active; }
        get progress()  { return this._progress; }
        get isError()   { return this._error; }

        update() {
            if (!this._active) return;
            if (this._error) {
                this._errorTimer++;
                if (this._errorTimer >= CFG.gameOverDelay) {
                    this._active = false;
                    SceneManager.goto(Scene_Gameover);
                }
                return;
            }
            if (!this._paused) {
                this._elapsedFrames++;
                this._progress = Math.min(1, this._elapsedFrames / this._totalFrames);
            }
            if (this._progress >= 1) {
                this._error = true;
                this._errorTimer = 0;
            }
        }
    }

    window.$renderBar = new RenderBarManager();

    // ============================================================
    // Plugin Commands
    // ============================================================
    PluginManager.registerCommand(PLUGIN_NAME, 'start',  () => $renderBar.start());
    PluginManager.registerCommand(PLUGIN_NAME, 'stop',   () => $renderBar.stop());
    PluginManager.registerCommand(PLUGIN_NAME, 'pause',  () => $renderBar.pause());
    PluginManager.registerCommand(PLUGIN_NAME, 'resume', () => $renderBar.resume());

    // ============================================================
    // Spriteset_Base — wstrzykujemy pasek do każdej sceny
    // ============================================================
    const _Spriteset_Base_createUpperLayer = Spriteset_Base.prototype.createUpperLayer;
    Spriteset_Base.prototype.createUpperLayer = function () {
        _Spriteset_Base_createUpperLayer.call(this);
        this._renderBarSprite = new Sprite_RenderBar();
        this.addChild(this._renderBarSprite);
    };

    const _Spriteset_Base_update = Spriteset_Base.prototype.update;
    Spriteset_Base.prototype.update = function () {
        _Spriteset_Base_update.call(this);
        if (this._renderBarSprite) this._renderBarSprite.update();
    };

    // ============================================================
    // Sprite_RenderBar — rysuje pasek
    // ============================================================
    class Sprite_RenderBar extends Sprite {
        constructor() {
            super();
            this.x = CFG.x;
            this.y = CFG.y;
            this._lastProgress = -1;
            this._lastError    = null;
            this._buildBitmaps();
        }

        _buildBitmaps() {
            const W = CFG.width;
            const H = CFG.height;
            const labelH = 14;
            const totalH = labelH + 4 + H + 4;  // label + gap + bar + padding

            this._bm = new Bitmap(W + 4, totalH);
            this.bitmap = this._bm;
        }

        _redraw(progress, isError) {
            const bm   = this._bm;
            const W    = CFG.width;
            const H    = CFG.height;
            const labelH = 14;
            const totalH = labelH + 4 + H + 4;

            bm.clear();

            // ── Label ──
            const statusText = isError
                ? '[ ERROR ]  ' + CFG.label
                : CFG.label;

            bm.fontFace    = '"Courier New", Courier, monospace';
            bm.fontSize    = 11;
            bm.fontBold    = false;
            bm.outlineWidth = 0;
            bm.textColor   = isError ? '#ff6666' : 'rgba(200,240,255,0.85)';
            bm.drawText(statusText, 2, 0, W, labelH, 'left');

            const barY = labelH + 4;

            // ── Tło paska ──
            bm.fillRect(0, barY, W + 4, H, 'rgba(10,10,20,0.75)');

            // ── Ramka ──
            const borderColor = isError ? 'rgba(255,60,60,0.7)' : 'rgba(0,180,255,0.45)';
            bm.fillRect(0,         barY,         W + 4, 1,     borderColor);
            bm.fillRect(0,         barY + H - 1, W + 4, 1,     borderColor);
            bm.fillRect(0,         barY,         1,     H,     borderColor);
            bm.fillRect(W + 3,     barY,         1,     H,     borderColor);

            // ── Wypełnienie paska ──
            const fillW = Math.floor((W + 2) * progress);
            if (fillW > 0) {
                const fillColor = isError ? CFG.errorColor : CFG.barColor;
                // Główny kolor
                bm.fillRect(1, barY + 1, fillW, H - 2, fillColor);
                // Jasna górna linia (highlight)
                const highlight = isError ? 'rgba(255,160,160,0.55)' : 'rgba(180,240,255,0.45)';
                bm.fillRect(1, barY + 1, fillW, Math.floor((H - 2) * 0.3), highlight);
            }

            // ── Procent ──
            const pct = Math.floor(progress * 100) + '%';
            bm.fontFace    = '"Courier New", Courier, monospace';
            bm.fontSize    = 10;
            bm.outlineWidth = 0;
            bm.textColor   = isError ? '#ffaaaa' : 'rgba(255,255,255,0.9)';
            bm.drawText(pct, 0, barY, W + 4, H, 'center');

            // ── Scanline overlay ──
            for (let sy = barY + 2; sy < barY + H - 2; sy += 3) {
                bm.fillRect(1, sy, fillW, 1, 'rgba(0,0,0,0.12)');
            }
        }

        update() {
            super.update();
            $renderBar.update();

            const vis = $renderBar.active;
            this.visible = vis;
            if (!vis) return;

            const prog  = $renderBar.progress;
            const err   = $renderBar.isError;

            // Tylko odrysuj gdy coś się zmieniło
            if (prog !== this._lastProgress || err !== this._lastError) {
                this._redraw(prog, err);
                this._lastProgress = prog;
                this._lastError    = err;
            }

            // Migotanie po Errorze
            if (err) {
                this.opacity = (Graphics.frameCount % 10 < 5) ? 255 : 180;
            } else {
                this.opacity = 255;
            }
        }
    }

})();
