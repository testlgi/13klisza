/*:
 * @target MZ
 * @plugindesc Pasek Życia jako pasek postępu renderowania wideo. Gdy dojdzie do końca - Game Over.
 * @author ClaudeAI
 *
 * @param barWidth
 * @text Szerokość paska
 * @type number
 * @default 300
 *
 * @param barHeight
 * @text Wysokość paska
 * @type number
 * @default 20
 *
 * @param barX
 * @text Pozycja X
 * @type number
 * @default 10
 *
 * @param barY
 * @text Pozycja Y
 * @type number
 * @default 10
 *
 * @param fillSpeed
 * @text Prędkość napełniania (px/frame)
 * @type number
 * @decimals 2
 * @default 0.3
 *
 * @param normalColor
 * @text Kolor normalny (hex)
 * @type string
 * @default #00cc66
 *
 * @param warningColor
 * @text Kolor ostrzeżenia (hex, przy 75%)
 * @type string
 * @default #ffaa00
 *
 * @param errorColor
 * @text Kolor błędu - Game Over (hex)
 * @type string
 * @default #ff2222
 *
 * @param labelNormal
 * @text Etykieta normalna
 * @type string
 * @default Renderowanie...
 *
 * @param labelError
 * @text Etykieta błędu
 * @type string
 * @default Error
 *
 * @param showPercent
 * @text Pokazuj procenty
 * @type boolean
 * @default true
 *
 * @param gameOverDelay
 * @text Opóźnienie Game Over (klatki)
 * @type number
 * @default 90
 *
 * @command startBar
 * @text Uruchom pasek
 * @desc Uruchamia pasek postępu renderowania.
 *
 * @command stopBar
 * @text Zatrzymaj pasek
 * @desc Zatrzymuje pasek (bez Game Over).
 *
 * @command resetBar
 * @text Resetuj pasek
 * @desc Resetuje pasek do zera i wznawia.
 *
 * @command setSpeed
 * @text Ustaw prędkość
 * @desc Zmienia prędkość napełniania w locie.
 * @arg speed
 * @text Prędkość (px/frame)
 * @type number
 * @decimals 2
 * @default 0.3
 *
 * @help RenderLifeBar.js
 * ============================================================
 * PASEK ŻYCIA — PASEK RENDEROWANIA
 * ============================================================
 * Wyświetla pasek postępu który powoli się zapełnia.
 * Gdy dojdzie do końca:
 *   1. Zmienia kolor na czerwony i pokazuje "Error"
 *   2. Po chwili wywołuje Game Over
 *
 * Użyj komend pluginu:
 *   startBar  — uruchamia pasek
 *   stopBar   — zatrzymuje (np. gracz coś zrobił na czas)
 *   resetBar  — zeruje i wznawia
 *   setSpeed  — zmienia prędkość
 *
 * Możesz też sterować przez zmienne skryptu:
 *   $renderBar.start()
 *   $renderBar.stop()
 *   $renderBar.reset()
 *   $renderBar.setSpeed(0.5)
 *   $renderBar.isRunning()
 *   $renderBar.getProgress()  // 0.0 - 1.0
 * ============================================================
 */

(() => {
    'use strict';

    const PLUGIN_NAME = 'RenderLifeBar';
    const params = PluginManager.parameters(PLUGIN_NAME);

    const BAR_WIDTH    = Number(params.barWidth)    || 300;
    const BAR_HEIGHT   = Number(params.barHeight)   || 20;
    const BAR_X        = Number(params.barX)        || 10;
    const BAR_Y        = Number(params.barY)        || 10;
    const FILL_SPEED   = parseFloat(params.fillSpeed)   || 0.3;
    const COLOR_NORMAL  = String(params.normalColor)  || '#00cc66';
    const COLOR_WARNING = String(params.warningColor) || '#ffaa00';
    const COLOR_ERROR   = String(params.errorColor)   || '#ff2222';
    const LABEL_NORMAL  = String(params.labelNormal)  || 'Renderowanie...';
    const LABEL_ERROR   = String(params.labelError)   || 'Error';
    const SHOW_PERCENT  = params.showPercent !== 'false';
    const GAMEOVER_DELAY = Number(params.gameOverDelay) || 90;

    // -------------------------------------------------------
    // Kontroler
    // -------------------------------------------------------
    class RenderBarController {
        constructor() {
            this._running  = false;
            this._progress = 0; // 0 .. BAR_WIDTH (px)
            this._speed    = FILL_SPEED;
            this._error    = false;
            this._errorTimer = 0;
        }

        start()  { this._running = true;  this._error = false; }
        stop()   { this._running = false; }
        reset()  { this._progress = 0; this._error = false; this._errorTimer = 0; this._running = true; }
        setSpeed(s) { this._speed = parseFloat(s) || FILL_SPEED; }
        isRunning()  { return this._running; }
        getProgress() { return this._progress / BAR_WIDTH; } // 0.0 - 1.0

        update() {
            if (this._error) {
                this._errorTimer++;
                if (this._errorTimer >= GAMEOVER_DELAY) {
                    this._errorTimer = 0;
                    this._error = false;
                    this._running = false;
                    SceneManager.goto(Scene_Gameover);
                }
                return;
            }
            if (!this._running) return;

            this._progress += this._speed;
            if (this._progress >= BAR_WIDTH) {
                this._progress = BAR_WIDTH;
                this._running  = false;
                this._error    = true;
                this._errorTimer = 0;
            }
        }

        get currentColor() {
            if (this._error) return COLOR_ERROR;
            const ratio = this._progress / BAR_WIDTH;
            return ratio >= 0.75 ? COLOR_WARNING : COLOR_NORMAL;
        }

        get label() {
            return this._error ? LABEL_ERROR : LABEL_NORMAL;
        }

        get filledWidth() {
            return Math.round(this._progress);
        }

        get isError() { return this._error; }
    }

    const controller = new RenderBarController();
    window.$renderBar = controller;

    // -------------------------------------------------------
    // Komendy pluginu
    // -------------------------------------------------------
    PluginManager.registerCommand(PLUGIN_NAME, 'startBar', () => {
        controller.start();
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'stopBar', () => {
        controller.stop();
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'resetBar', () => {
        controller.reset();
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'setSpeed', (args) => {
        controller.setSpeed(args.speed);
    });

    // -------------------------------------------------------
    // Sprite paska
    // -------------------------------------------------------
    class Sprite_RenderBar extends Sprite {
        constructor() {
            super();
            this._bitmap = new Bitmap(BAR_WIDTH + 4, BAR_HEIGHT + 24);
            this.bitmap  = this._bitmap;
            this.x = BAR_X;
            this.y = BAR_Y;
            this._lastFilled = -1;
            this._lastError  = null;
            this._flashTimer = 0;
            this.visible = false;
        }

        update() {
            super.update();
            this.visible = controller.isRunning() || controller.isError;

            const filled = controller.filledWidth;
            const isErr  = controller.isError;

            if (filled !== this._lastFilled || isErr !== this._lastError) {
                this._lastFilled = filled;
                this._lastError  = isErr;
                this._redraw(filled, isErr);
            }

            // Miganie przy błędzie
            if (isErr) {
                this._flashTimer++;
                this.opacity = Math.floor(this._flashTimer / 6) % 2 === 0 ? 255 : 140;
            } else {
                this.opacity = 255;
                this._flashTimer = 0;
            }
        }

        _redraw(filled, isErr) {
            const bm = this._bitmap;
            bm.clear();

            const W = BAR_WIDTH;
            const H = BAR_HEIGHT;
            const color = controller.currentColor;
            const label = controller.label;

            // Tło paska
            bm.fillRect(0, 12, W + 4, H + 2, 'rgba(0,0,0,0.7)');

            // Wypełnienie
            if (filled > 0) {
                bm.fillRect(2, 13, filled, H, color);
            }

            // Ramka
            bm.strokeRect(1, 12, W + 2, H + 2, isErr ? COLOR_ERROR : '#ffffff', 1);

            // Etykieta
            bm.fontSize = 12;
            bm.textColor = isErr ? COLOR_ERROR : '#ffffff';
            bm.outlineColor = 'rgba(0,0,0,0.8)';
            bm.outlineWidth = 3;

            let text = label;
            if (SHOW_PERCENT && !isErr) {
                const pct = Math.round((filled / W) * 100);
                text += '  ' + pct + '%';
            }
            bm.drawText(text, 2, 0, W, 12, 'left');
        }
    }

    // -------------------------------------------------------
    // Wstrzyknięcie do Scene_Map i Scene_Battle
    // -------------------------------------------------------
    function injectBar(SceneClass) {
        const _create = SceneClass.prototype.createAllWindows;
        SceneClass.prototype.createAllWindows = function() {
            _create.call(this);
            this._renderBarSprite = new Sprite_RenderBar();
            this.addChild(this._renderBarSprite);
        };

        const _update = SceneClass.prototype.update;
        SceneClass.prototype.update = function() {
            _update.call(this);
            controller.update();
        };
    }

    injectBar(Scene_Map);
    injectBar(Scene_Battle);

})();
