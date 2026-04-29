/*:
 * @target MZ
 * @plugindesc Menu Główne stylizowane na stół montażowy z taśmą filmową.
 * @author Adam
 *
 * @param gameTitle
 * @text Tytuł gry
 * @type string
 * @default 13 Klatka
 *
 * @param subtitle
 * @text Podtytuł
 * @type string
 * @default editing suite · main timeline
 *
 * @param newGameText
 * @text Nowa Gra
 * @type string
 * @default Nowa Gra
 *
 * @param continueText
 * @text Kontynuuj
 * @type string
 * @default Wczytaj
 *
 * @param optionsText
 * @text Opcje
 * @type string
 * @default Opcje
 *
 * @param exitText
 * @text Wyjście
 * @type string
 * @default Wyjście
 *
 * @param newGameDesc
 * @text Opis - Nowa Gra
 * @type string
 * @default rozpocznij od początku
 *
 * @param continueDesc
 * @text Opis - Kontynuuj
 * @type string
 * @default kontynuuj nagranie
 *
 * @param optionsDesc
 * @text Opis - Opcje
 * @type string
 * @default ustawienia montażu
 *
 * @param exitDesc
 * @text Opis - Wyjście
 * @type string
 * @default koniec sesji
 *
 * @param colorAmber
 * @text Kolor akcentu (hex)
 * @type string
 * @default #c8912a
 *
 * @param colorBg
 * @text Kolor tła (hex)
 * @type string
 * @default #1a1510
 *
 * @param colorDark
 * @text Kolor ciemny (hex)
 * @type string
 * @default #0d0b08
 *
 * @param colorCream
 * @text Kolor tekstu (hex)
 * @type string
 * @default #e8dfc0
 *
 * @help FilmEditingMenu.js
 * ============================================================
 * MENU GŁÓWNE — STÓŁ MONTAŻOWY
 * ============================================================
 * Zastępuje domyślne menu tytułowe RPG Maker MZ
 * interfejsem stylizowanym na stół montażowy.
 * Opcje menu wyglądają jak kawałki taśmy filmowej.
 *
 * Instalacja:
 *   Wrzuć do js/plugins/ i włącz w Plugin Managerze.
 *   Żadnych dodatkowych ustawień nie wymaga.
 * ============================================================
 */

(() => {
    'use strict';

    const PLUGIN_NAME = 'FilmEditingMenu';
    const p = PluginManager.parameters(PLUGIN_NAME);

    const CFG = {
        gameTitle:    String(p.gameTitle    || '13 Klatka'),
        subtitle:     String(p.subtitle     || 'editing suite · main timeline'),
        newGameText:  String(p.newGameText  || 'Nowa Gra'),
        continueText: String(p.continueText || 'Wczytaj'),
        optionsText:  String(p.optionsText  || 'Opcje'),
        exitText:     String(p.exitText     || 'Wyjście'),
        newGameDesc:  String(p.newGameDesc  || 'rozpocznij od początku'),
        continueDesc: String(p.continueDesc || 'kontynuuj nagranie'),
        optionsDesc:  String(p.optionsDesc  || 'ustawienia montażu'),
        exitDesc:     String(p.exitDesc     || 'koniec sesji'),
        amber:        String(p.colorAmber   || '#c8912a'),
        bg:           String(p.colorBg      || '#1a1510'),
        dark:         String(p.colorDark    || '#0d0b08'),
        cream:        String(p.colorCream   || '#e8dfc0'),
    };

    // Derived colours
    const amberDim  = () => CFG.amber + '88';
    const creamDim  = () => CFG.cream + '77';
    const scratch   = '#3a3020';
    const perf      = '#2a2318';

    // -------------------------------------------------------
    // Helpers
    // -------------------------------------------------------
    function hexToRgba(hex, a) {
        const r = parseInt(hex.slice(1,3),16);
        const g = parseInt(hex.slice(3,5),16);
        const b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${a})`;
    }

    // -------------------------------------------------------
    // Scene_Title override
    // -------------------------------------------------------
    const _Scene_Title_create = Scene_Title.prototype.create;
    Scene_Title.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this.createBackground();
        this._filmMenu = new FilmMenuSprite(this._onCommandSelected.bind(this));
        this.addChild(this._filmMenu);
    };

    Scene_Title.prototype.createBackground = function() {
        this._backSprite = new Sprite(new Bitmap(Graphics.width, Graphics.height));
        this._backSprite.bitmap.fillAll(CFG.dark);
        this.addChild(this._backSprite);
    };

    Scene_Title.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        SceneManager.clearStack();
        this.playTitleMusic();
        this.startFadeIn(this.fadeSpeed(), false);
    };

    Scene_Title.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        if (this._filmMenu) this._filmMenu.update();
    };

    Scene_Title.prototype.isBusy = function() {
        return Scene_Base.prototype.isBusy.call(this);
    };

    Scene_Title.prototype.playTitleMusic = function() {
        AudioManager.playBgm($dataSystem.titleBgm);
        AudioManager.stopBgs();
        AudioManager.stopMe();
    };

    Scene_Title.prototype._onCommandSelected = function(cmd) {
        switch (cmd) {
            case 'newGame':   this.commandNewGame();   break;
            case 'continue':  this.commandContinue();  break;
            case 'options':   this.commandOptions();   break;
            case 'exit':      this.commandExit();      break;
        }
    };

    Scene_Title.prototype.commandNewGame = function() {
        DataManager.setupNewGame();
        this._filmMenu.close(() => {
            this.fadeOutAll();
            SceneManager.goto(Scene_Map);
        });
    };

    Scene_Title.prototype.commandContinue = function() {
        this._filmMenu.close(() => {
            SceneManager.push(Scene_Load);
        });
    };

    Scene_Title.prototype.commandOptions = function() {
        this._filmMenu.close(() => {
            SceneManager.push(Scene_Options);
        });
    };

    Scene_Title.prototype.commandExit = function() {
        this._filmMenu.close(() => {
            SceneManager.exit();
        });
    };

    // -------------------------------------------------------
    // FilmMenuSprite — main drawable
    // -------------------------------------------------------
    class FilmMenuSprite extends PIXI.Container {
        constructor(callback) {
            super();
            this._callback = callback;
            this._selected = -1;
            this._frames   = [];
            this._closing  = false;
            this._alpha    = 0;
            this._tcFrames = 0;

            this._gfx = new PIXI.Graphics();
            this.addChild(this._gfx);

            this._texts = new PIXI.Container();
            this.addChild(this._texts);

            this._buildLayout();
            this._buildInput();
        }

        // --------------------------------------------------
        // Layout constants
        // --------------------------------------------------
        get W() { return Graphics.width; }
        get H() { return Graphics.height; }
        get panelW() { return Math.min(560, this.W - 80); }
        get panelH() { return 400; }
        get panelX() { return (this.W - this.panelW) / 2; }
        get panelY() { return (this.H - this.panelH) / 2; }

        // --------------------------------------------------
        // Build
        // --------------------------------------------------
        _buildLayout() {
            this._drawPanel();
            this._drawHeader();
            this._drawFrames();
            this._drawFooter();
        }

        _drawPanel() {
            const g = this._gfx;
            g.clear();

            // Outer panel
            g.lineStyle(1, 0x3a3020, 1);
            g.beginFill(PIXI.utils.string2hex(CFG.dark));
            g.drawRoundedRect(this.panelX, this.panelY, this.panelW, this.panelH, 4);
            g.endFill();

            // Header bg
            g.lineStyle(0);
            g.beginFill(PIXI.utils.string2hex(CFG.bg));
            g.drawRect(this.panelX, this.panelY, this.panelW, 56);
            g.endFill();

            // Header bottom border
            g.lineStyle(1, 0x3a3020, 1);
            g.moveTo(this.panelX, this.panelY + 56);
            g.lineTo(this.panelX + this.panelW, this.panelY + 56);

            // Footer bg
            g.lineStyle(0);
            g.beginFill(PIXI.utils.string2hex(CFG.bg));
            g.drawRect(this.panelX, this.panelY + this.panelH - 36, this.panelW, 36);
            g.endFill();

            g.lineStyle(1, 0x3a3020, 1);
            g.moveTo(this.panelX, this.panelY + this.panelH - 36);
            g.lineTo(this.panelX + this.panelW, this.panelY + this.panelH - 36);
        }

        _makeText(str, size, color, bold, x, y) {
            const style = new PIXI.TextStyle({
                fontFamily: bold ? 'Georgia, serif' : '"Courier New", monospace',
                fontSize:   size,
                fill:       color,
                letterSpacing: 2,
            });
            const t = new PIXI.Text(str, style);
            t.x = x; t.y = y;
            this._texts.addChild(t);
            return t;
        }

        _drawHeader() {
            const hx = this.panelX;
            const hy = this.panelY;

            // Reel circle
            const g = this._gfx;
            const cx = hx + 28, cy = hy + 28;
            g.lineStyle(2, PIXI.utils.string2hex(CFG.amber), 1);
            g.drawCircle(cx, cy, 14);
            g.beginFill(PIXI.utils.string2hex(CFG.amber));
            g.drawCircle(cx, cy, 4);
            g.endFill();

            // Reel spokes
            g.lineStyle(1.5, PIXI.utils.string2hex(CFG.amber), 1);
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                g.moveTo(cx + Math.cos(angle) * 5, cy + Math.sin(angle) * 5);
                g.lineTo(cx + Math.cos(angle) * 12, cy + Math.sin(angle) * 12);
            }

            this._makeText(CFG.gameTitle.toUpperCase(), 18, CFG.cream, true, hx + 52, hy + 10);
            this._makeText(CFG.subtitle, 10, CFG.amber + 'aa', false, hx + 53, hy + 35);

            // Timecode (updated each frame)
            this._tcText = this._makeText('00:00:00:00', 11, CFG.amber + 'bb', false, hx + this.panelW - 110, hy + 22);
        }

        _drawFrames() {
            const items = [
                { key: 'newGame',  label: CFG.newGameText,  num: '001', desc: CFG.newGameDesc },
                { key: 'continue', label: CFG.continueText, num: '002', desc: CFG.continueDesc },
                { key: 'options',  label: CFG.optionsText,  num: '003', desc: CFG.optionsDesc },
                { key: 'exit',     label: CFG.exitText,     num: '004', desc: CFG.exitDesc },
            ];

            const startY = this.panelY + 68;
            const frameH = 52;
            const gap    = 2;
            const fx     = this.panelX;
            const fw     = this.panelW;
            const perfW  = 28;

            this._frameRects = [];

            items.forEach((item, i) => {
                const fy = startY + i * (frameH + gap);

                // Perforations
                const g = this._gfx;
                g.lineStyle(1, 0x3a3020, 1);
                g.beginFill(PIXI.utils.string2hex(perf));
                g.drawRect(fx, fy, perfW, frameH);
                g.endFill();

                // Perf holes
                g.lineStyle(0);
                g.beginFill(PIXI.utils.string2hex(CFG.dark));
                for (let h = 0; h < 3; h++) {
                    g.drawRoundedRect(fx + 9, fy + 8 + h * 14, 10, 8, 1);
                }
                g.endFill();

                // Frame bg (will be redrawn on hover)
                g.lineStyle(1, 0x3a3020, 1);
                g.beginFill(PIXI.utils.string2hex(CFG.bg));
                g.drawRect(fx + perfW, fy, fw - perfW, frameH);
                g.endFill();

                // Frame number
                this._makeText(item.num, 9, CFG.amber + '88', false, fx + perfW + 8, fy + 20);

                // Frame label
                const lbl = this._makeText(item.label.toUpperCase(), 15, CFG.cream, true, fx + perfW + 48, fy + 14);

                // Frame desc
                this._makeText(item.desc, 9, CFG.cream + '77', false, fx + fw - 140, fy + 22);

                // Arrow (hidden by default)
                const arr = new PIXI.Graphics();
                arr.lineStyle(1.5, PIXI.utils.string2hex(CFG.amber), 1);
                arr.moveTo(0, 0); arr.lineTo(8, 8); arr.lineTo(0, 16);
                arr.x = fx + fw - 24;
                arr.y = fy + 18;
                arr.alpha = 0;
                this.addChild(arr);

                this._frameRects.push({ fy, frameH, key: item.key, lbl, arr });

                // Splice line between frames (not after last)
                if (i < items.length - 1) {
                    g.lineStyle(1, PIXI.utils.string2hex(CFG.amber), 0.25);
                    g.moveTo(fx, fy + frameH + 1);
                    g.lineTo(fx + fw, fy + frameH + 1);
                }
            });
        }

        _drawFooter() {
            const fy = this.panelY + this.panelH - 36;
            const fx = this.panelX;

            this._statusText = this._makeText('gotowy · czekam na wybór', 9, CFG.amber + '88', false, fx + 16, fy + 12);

            // Dots
            this._dots = [];
            for (let i = 0; i < 4; i++) {
                const g2 = new PIXI.Graphics();
                g2.beginFill(0x3a3020);
                g2.drawCircle(0, 0, 3);
                g2.endFill();
                g2.x = this.panelX + this.panelW - 24 - i * 14;
                g2.y = fy + 18;
                this.addChild(g2);
                this._dots.push(g2);
            }
        }

        _setSelected(idx) {
            if (this._selected === idx) return;
            this._selected = idx;

            const labels = [
                CFG.newGameText  + ' · klatka 001',
                CFG.continueText + ' · klatka 002',
                CFG.optionsText  + ' · klatka 003',
                CFG.exitText     + ' · klatka 004',
            ];

            this._frameRects.forEach((fr, i) => {
                const active = i === idx;
                fr.lbl.style.fill = active ? CFG.amber : CFG.cream;
                fr.arr.alpha      = active ? 1 : 0;

                // Highlight bg
                this._gfx.beginFill(active ? 0x3a3020 : PIXI.utils.string2hex(CFG.bg));
                this._gfx.lineStyle(0);
                this._gfx.drawRect(this.panelX + 28, fr.fy, this.panelW - 28, fr.frameH);
                this._gfx.endFill();
            });

            if (idx >= 0) {
                this._statusText.text = labels[idx];
                this._dots.forEach((d, i) => {
                    d.clear();
                    d.beginFill(i === (3 - idx) ? PIXI.utils.string2hex(CFG.amber) : 0x3a3020);
                    d.drawCircle(0, 0, 3);
                    d.endFill();
                });
            }
        }

        // --------------------------------------------------
        // Input
        // --------------------------------------------------
        _buildInput() {
            this._cursor = 0;
            this._inputDelay = 0;
        }

        update() {
            // Fade in
            if (!this._closing && this.alpha < 1) {
                this.alpha = Math.min(1, this.alpha + 0.04);
            }

            // Timecode
            this._tcFrames++;
            const totalFrames = this._tcFrames;
            const fps = 24;
            const ff = totalFrames % fps;
            const ss = Math.floor(totalFrames / fps) % 60;
            const mm = Math.floor(totalFrames / fps / 60) % 60;
            const hh = Math.floor(totalFrames / fps / 3600) % 24;
            const pad = n => String(n).padStart(2,'0');
            if (this._tcText) {
                this._tcText.text = `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
            }

            if (this._closing) return;

            this._handleInput();
        }

        _handleInput() {
            if (this._inputDelay > 0) { this._inputDelay--; return; }

            const numItems = this._frameRects.length;

            if (Input.isTriggered('down') || Input.isTriggered('s')) {
                this._cursor = (this._cursor + 1) % numItems;
                this._setSelected(this._cursor);
                SoundManager.playCursor();
                this._inputDelay = 8;
            }
            if (Input.isTriggered('up') || Input.isTriggered('w')) {
                this._cursor = (this._cursor - 1 + numItems) % numItems;
                this._setSelected(this._cursor);
                SoundManager.playCursor();
                this._inputDelay = 8;
            }

            if (Input.isTriggered('ok')) {
                if (this._selected < 0) {
                    this._setSelected(0);
                } else {
                    SoundManager.playOk();
                    const key = this._frameRects[this._selected].key;
                    this._callback(key);
                }
            }

            // Touch / mouse
            if (TouchInput.isTriggered()) {
                const tx = TouchInput.x;
                const ty = TouchInput.y;
                this._frameRects.forEach((fr, i) => {
                    if (ty >= fr.fy && ty < fr.fy + fr.frameH &&
                        tx >= this.panelX && tx < this.panelX + this.panelW) {
                        if (this._selected === i) {
                            SoundManager.playOk();
                            this._callback(fr.key);
                        } else {
                            this._setSelected(i);
                            this._cursor = i;
                            SoundManager.playCursor();
                        }
                    }
                });
            }

            // Hover
            const mx = TouchInput.x;
            const my = TouchInput.y;
            this._frameRects.forEach((fr, i) => {
                if (my >= fr.fy && my < fr.fy + fr.frameH &&
                    mx >= this.panelX && mx < this.panelX + this.panelW) {
                    if (this._selected !== i) {
                        this._setSelected(i);
                        this._cursor = i;
                    }
                }
            });
        }

        close(callback) {
            this._closing = true;
            const fade = () => {
                this.alpha -= 0.06;
                if (this.alpha <= 0) {
                    this.alpha = 0;
                    callback();
                } else {
                    requestAnimationFrame(fade);
                }
            };
            fade();
        }
    }

})();
