/*:
 * @target MZ
 * @plugindesc Menu pauzy stylizowane na stół montażowy — spójne z FilmEditingMenu.
 * @author Adam
 *
 * @param colorAmber
 * @text Kolor akcentu (hex)
 * @type string
 * @default #c8912a
 *
 * @param colorBg
 * @text Kolor tła panelu (hex)
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
 * @param itemsText
 * @text Przedmioty
 * @type string
 * @default Przedmioty
 *
 * @param skillsText
 * @text Umiejętności
 * @type string
 * @default Umiejętności
 *
 * @param equipText
 * @text Ekwipunek
 * @type string
 * @default Ekwipunek
 *
 * @param statusText
 * @text Status
 * @type string
 * @default Status
 *
 * @param saveText
 * @text Zapisz
 * @type string
 * @default Zapisz
 *
 * @param optionsText
 * @text Opcje
 * @type string
 * @default Opcje
 *
 * @param exitText
 * @text Wyjście
 * @type string
 * @default Menu
 *
 * @help FilmPauseMenu.js
 * ============================================================
 * MENU PAUZY — STÓŁ MONTAŻOWY
 * ============================================================
 * Zastępuje domyślne menu pauzy interfejsem w stylu
 * stołu montażowego — spójnym z FilmEditingMenu.js.
 *
 * Każda opcja wygląda jak klatka taśmy filmowej.
 * Panel zawiera timecode sesji i pasek statusu.
 *
 * Instalacja:
 *   Wrzuć do js/plugins/ i włącz w Plugin Managerze.
 *   Działa niezależnie od FilmEditingMenu.js.
 * ============================================================
 */

(() => {
    'use strict';

    const PLUGIN_NAME = 'FilmPauseMenu';
    const p = PluginManager.parameters(PLUGIN_NAME);

    const CFG = {
        amber: String(p.colorAmber  || '#c8912a'),
        bg:    String(p.colorBg     || '#1a1510'),
        dark:  String(p.colorDark   || '#0d0b08'),
        cream: String(p.colorCream  || '#e8dfc0'),
        items:   String(p.itemsText   || 'Przedmioty'),
        skills:  String(p.skillsText  || 'Umiejętności'),
        equip:   String(p.equipText   || 'Ekwipunek'),
        status:  String(p.statusText  || 'Status'),
        save:    String(p.saveText    || 'Zapisz'),
        options: String(p.optionsText || 'Opcje'),
        exit:    String(p.exitText    || 'Menu'),
    };

    const perf = '#2a2318';

    // ============================================================
    // Scene_Menu override
    // ============================================================
    const _Scene_Menu_create = Scene_Menu.prototype.create;
    Scene_Menu.prototype.create = function () {
        Scene_Base.prototype.create.call(this);
        this._filmPause = new FilmPauseSprite(this._onCommand.bind(this));
        this.addChild(this._filmPause);
        this._closing = false;
    };

    Scene_Menu.prototype.start = function () {
        Scene_Base.prototype.start.call(this);
        this.startFadeIn(this.fadeSpeed(), false);
    };

    Scene_Menu.prototype.update = function () {
        Scene_Base.prototype.update.call(this);
        if (this._filmPause) this._filmPause.update();
        if (Input.isTriggered('cancel') || Input.isTriggered('escape')) {
            if (!this._closing) {
                this._closing = true;
                SoundManager.playCancel();
                this._filmPause.close(() => SceneManager.pop());
            }
        }
    };

    Scene_Menu.prototype.isBusy = function () {
        return Scene_Base.prototype.isBusy.call(this);
    };

    Scene_Menu.prototype._onCommand = function (cmd) {
        switch (cmd) {
            case 'item':    this._filmPause.close(() => SceneManager.push(Scene_Item));    break;
            case 'skill':   this._filmPause.close(() => this._pushSkill());               break;
            case 'equip':   this._filmPause.close(() => this._pushEquip());               break;
            case 'status':  this._filmPause.close(() => this._pushStatus());              break;
            case 'save':    this._filmPause.close(() => SceneManager.push(Scene_Save));   break;
            case 'options': this._filmPause.close(() => SceneManager.push(Scene_Options)); break;
            case 'exit':
                this._filmPause.close(() => {
                    this.fadeOutAll();
                    SceneManager.goto(Scene_Title);
                });
                break;
        }
    };

    Scene_Menu.prototype._pushSkill = function () {
        const actor = $gameParty.members()[0];
        if (actor) {
            $gameParty.setMenuActor(actor);
            SceneManager.push(Scene_Skill);
        }
    };

    Scene_Menu.prototype._pushEquip = function () {
        const actor = $gameParty.members()[0];
        if (actor) {
            $gameParty.setMenuActor(actor);
            SceneManager.push(Scene_Equip);
        }
    };

    Scene_Menu.prototype._pushStatus = function () {
        const actor = $gameParty.members()[0];
        if (actor) {
            $gameParty.setMenuActor(actor);
            SceneManager.push(Scene_Status);
        }
    };

    // ============================================================
    // FilmPauseSprite
    // ============================================================
    class FilmPauseSprite extends PIXI.Container {
        constructor(callback) {
            super();
            this._callback    = callback;
            this._selected    = 0;
            this._inputDelay  = 0;
            this._tcFrames    = 0;
            this._closing     = false;
            this.alpha        = 0;

            this._gfx = new PIXI.Graphics();
            this.addChild(this._gfx);
            this._texts = new PIXI.Container();
            this.addChild(this._texts);

            this._buildOverlay();
            this._buildPanel();
            this._setSelected(0);
        }

        get W() { return Graphics.width; }
        get H() { return Graphics.height; }

        // Panel dimensions
        get pW() { return Math.min(480, this.W - 80); }
        get pH() { return 420; }
        get pX() { return (this.W - this.pW) / 2; }
        get pY() { return (this.H - this.pH) / 2; }

        // --------------------------------------------------------
        // Overlay (semi-transparent bg)
        // --------------------------------------------------------
        _buildOverlay() {
            const g = this._gfx;
            g.beginFill(0x000000, 0.72);
            g.drawRect(0, 0, this.W, this.H);
            g.endFill();

            // Horizontal scan lines across whole screen
            for (let y = 0; y < this.H; y += 4) {
                g.beginFill(0x000000, 0.10);
                g.drawRect(0, y, this.W, 1);
                g.endFill();
            }
        }

        // --------------------------------------------------------
        // Panel
        // --------------------------------------------------------
        _buildPanel() {
            const g = this._gfx;
            const px = this.pX, py = this.pY, pw = this.pW, ph = this.pH;

            // Panel shadow
            g.beginFill(0x000000, 0.5);
            g.drawRoundedRect(px + 6, py + 6, pw, ph, 4);
            g.endFill();

            // Panel body
            g.lineStyle(1, 0x3a3020, 1);
            g.beginFill(PIXI.utils.string2hex(CFG.dark));
            g.drawRoundedRect(px, py, pw, ph, 4);
            g.endFill();

            // Header strip
            g.lineStyle(0);
            g.beginFill(PIXI.utils.string2hex(CFG.bg));
            g.drawRect(px, py, pw, 52);
            g.endFill();

            g.lineStyle(1, 0x3a3020, 1);
            g.moveTo(px, py + 52); g.lineTo(px + pw, py + 52);

            // Footer strip
            g.lineStyle(0);
            g.beginFill(PIXI.utils.string2hex(CFG.bg));
            g.drawRect(px, py + ph - 32, pw, 32);
            g.endFill();

            g.lineStyle(1, 0x3a3020, 1);
            g.moveTo(px, py + ph - 32); g.lineTo(px + pw, py + ph - 32);

            this._buildHeader();
            this._buildFrames();
            this._buildFooter();
        }

        // --------------------------------------------------------
        // Header
        // --------------------------------------------------------
        _buildHeader() {
            const g = this._gfx;
            const px = this.pX, py = this.pY;

            // Reel icon
            const cx = px + 26, cy = py + 26;
            g.lineStyle(2, PIXI.utils.string2hex(CFG.amber), 1);
            g.drawCircle(cx, cy, 13);
            g.beginFill(PIXI.utils.string2hex(CFG.amber));
            g.drawCircle(cx, cy, 4);
            g.endFill();
            g.lineStyle(1.5, PIXI.utils.string2hex(CFG.amber), 1);
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2;
                g.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
                g.lineTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11);
            }

            // PAUSED label
            this._t('PAUSED', 18, CFG.cream, true, px + 48, py + 8);
            this._t('session · current timeline', 10, CFG.amber + 'aa', false, px + 49, py + 32);

            // Timecode (live)
            this._tcText = this._t('00:00:00:00', 11, CFG.amber + 'bb', false,
                px + this.pW - 108, py + 20);
        }

        // --------------------------------------------------------
        // Menu frames (film strip rows)
        // --------------------------------------------------------
        _buildFrames() {
            const items = [
                { key: 'item',    label: CFG.items,   num: '001', desc: 'inwentarz gracza' },
                { key: 'skill',   label: CFG.skills,  num: '002', desc: 'zdolności postaci' },
                { key: 'equip',   label: CFG.equip,   num: '003', desc: 'wyposażenie' },
                { key: 'status',  label: CFG.status,  num: '004', desc: 'statystyki' },
                { key: 'save',    label: CFG.save,    num: '005', desc: 'zapisz sesję' },
                { key: 'options', label: CFG.options, num: '006', desc: 'ustawienia' },
                { key: 'exit',    label: CFG.exit,    num: '007', desc: 'wróć do menu' },
            ];

            this._items = items;
            this._frameRects = [];

            const startY  = this.pY + 60;
            const frameH  = 40;
            const gap      = 2;
            const perfW    = 26;
            const fx       = this.pX;
            const fw       = this.pW;
            const g        = this._gfx;

            items.forEach((item, i) => {
                const fy = startY + i * (frameH + gap);

                // Perforations strip
                g.lineStyle(1, 0x3a3020, 1);
                g.beginFill(PIXI.utils.string2hex(perf));
                g.drawRect(fx, fy, perfW, frameH);
                g.endFill();

                // Perf holes
                g.lineStyle(0);
                g.beginFill(PIXI.utils.string2hex(CFG.dark));
                for (let h = 0; h < 2; h++) {
                    g.drawRoundedRect(fx + 8, fy + 7 + h * 16, 10, 8, 1);
                }
                g.endFill();

                // Frame body bg
                g.lineStyle(1, 0x3a3020, 1);
                g.beginFill(PIXI.utils.string2hex(CFG.bg));
                g.drawRect(fx + perfW, fy, fw - perfW, frameH);
                g.endFill();

                // Frame number
                this._t(item.num, 8, CFG.amber + '77', false, fx + perfW + 6, fy + 14);

                // Label text (saved ref for selection highlight)
                const lbl = this._t(item.label.toUpperCase(), 13, CFG.cream, true,
                    fx + perfW + 44, fy + 12);

                // Desc
                this._t(item.desc, 8, CFG.cream + '55', false,
                    fx + fw - 130, fy + 15);

                // Arrow (hidden until selected)
                const arr = new PIXI.Graphics();
                arr.lineStyle(1.5, PIXI.utils.string2hex(CFG.amber), 1);
                arr.moveTo(0, 4); arr.lineTo(7, 10); arr.lineTo(0, 16);
                arr.x = fx + fw - 20;
                arr.y = fy + 12;
                arr.alpha = 0;
                this.addChild(arr);

                // Splice line
                if (i < items.length - 1) {
                    g.lineStyle(1, PIXI.utils.string2hex(CFG.amber), 0.15);
                    g.moveTo(fx, fy + frameH + 1);
                    g.lineTo(fx + fw, fy + frameH + 1);
                }

                this._frameRects.push({ fy, frameH, key: item.key, lbl, arr });
            });
        }

        // --------------------------------------------------------
        // Footer
        // --------------------------------------------------------
        _buildFooter() {
            const fy = this.pY + this.pH - 32;
            const fx = this.pX;

            this._statusText = this._t('gotowy · czekam na wybór', 9,
                CFG.amber + '88', false, fx + 14, fy + 10);

            // Indicator dots
            this._dots = [];
            for (let i = 0; i < 4; i++) {
                const d = new PIXI.Graphics();
                d.beginFill(0x3a3020); d.drawCircle(0, 0, 3); d.endFill();
                d.x = this.pX + this.pW - 22 - i * 12;
                d.y = fy + 16;
                this.addChild(d);
                this._dots.push(d);
            }

            // ESC hint
            this._t('[ ESC ] zamknij', 8, CFG.cream + '33', false,
                fx + this.pW - 120, fy + 10);
        }

        // --------------------------------------------------------
        // Helper: make PIXI.Text, add to _texts container
        // --------------------------------------------------------
        _t(str, size, color, bold, x, y) {
            const style = new PIXI.TextStyle({
                fontFamily:    bold ? 'Georgia, serif' : '"Courier New", monospace',
                fontSize:      size,
                fill:          color,
                letterSpacing: 1.5,
            });
            const t = new PIXI.Text(str, style);
            t.x = x; t.y = y;
            this._texts.addChild(t);
            return t;
        }

        // --------------------------------------------------------
        // Selection highlight
        // --------------------------------------------------------
        _setSelected(idx) {
            if (this._selected === idx) return;
            this._selected = idx;
            this._refreshHighlight();
        }

        _refreshHighlight() {
            const idx = this._selected;
            const descs = [
                CFG.items   + ' · klatka 001',
                CFG.skills  + ' · klatka 002',
                CFG.equip   + ' · klatka 003',
                CFG.status  + ' · klatka 004',
                CFG.save    + ' · klatka 005',
                CFG.options + ' · klatka 006',
                CFG.exit    + ' · klatka 007',
            ];

            // Remove previous highlight graphic (rebuild each time, simplest approach)
            if (this._hlGfx) {
                this.removeChild(this._hlGfx);
                this._hlGfx.destroy();
            }
            const hl = new PIXI.Graphics();
            this._hlGfx = hl;
            this.addChildAt(hl, 1); // above overlay, below texts

            this._frameRects.forEach((fr, i) => {
                const active = i === idx;
                fr.lbl.style.fill = active ? CFG.amber : CFG.cream;
                fr.arr.alpha      = active ? 1 : 0;

                if (active) {
                    // Highlight bg
                    hl.beginFill(0x3a3020, 0.9);
                    hl.drawRect(this.pX + 26, fr.fy, this.pW - 26, fr.frameH);
                    hl.endFill();

                    // Left accent bar
                    hl.beginFill(PIXI.utils.string2hex(CFG.amber), 1);
                    hl.drawRect(this.pX + 26, fr.fy, 3, fr.frameH);
                    hl.endFill();
                }
            });

            if (this._statusText && idx >= 0) {
                this._statusText.text = descs[idx];
            }

            // Dots
            if (this._dots) {
                const dotIdx = idx % this._dots.length;
                this._dots.forEach((d, i) => {
                    d.clear();
                    d.beginFill(i === dotIdx
                        ? PIXI.utils.string2hex(CFG.amber)
                        : 0x3a3020);
                    d.drawCircle(0, 0, 3);
                    d.endFill();
                });
            }
        }

        // --------------------------------------------------------
        // Update (called each frame from Scene_Menu)
        // --------------------------------------------------------
        update() {
            // Fade in
            if (!this._closing && this.alpha < 1) {
                this.alpha = Math.min(1, this.alpha + 0.06);
            }

            // Live timecode
            this._tcFrames++;
            const fps = 24;
            const ff  = this._tcFrames % fps;
            const ss  = Math.floor(this._tcFrames / fps) % 60;
            const mm  = Math.floor(this._tcFrames / fps / 60) % 60;
            const hh  = Math.floor(this._tcFrames / fps / 3600) % 24;
            const pad = n => String(n).padStart(2, '0');
            if (this._tcText) {
                this._tcText.text = `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
            }

            if (this._closing) return;
            this._handleInput();
        }

        // --------------------------------------------------------
        // Input
        // --------------------------------------------------------
        _handleInput() {
            if (this._inputDelay > 0) { this._inputDelay--; return; }

            const n = this._frameRects.length;

            if (Input.isTriggered('down') || Input.isRepeated('down')) {
                const next = (this._selected + 1) % n;
                this._setSelected(next);
                SoundManager.playCursor();
                this._inputDelay = 8;
            }
            if (Input.isTriggered('up') || Input.isRepeated('up')) {
                const prev = (this._selected - 1 + n) % n;
                this._setSelected(prev);
                SoundManager.playCursor();
                this._inputDelay = 8;
            }

            if (Input.isTriggered('ok')) {
                SoundManager.playOk();
                const key = this._frameRects[this._selected].key;
                this._closing = true;
                this._callback(key);
            }

            // Touch / hover
            if (TouchInput.isTriggered()) {
                const tx = TouchInput.x, ty = TouchInput.y;
                this._frameRects.forEach((fr, i) => {
                    if (ty >= fr.fy && ty < fr.fy + fr.frameH &&
                        tx >= this.pX && tx < this.pX + this.pW) {
                        if (this._selected === i) {
                            SoundManager.playOk();
                            this._closing = true;
                            this._callback(fr.key);
                        } else {
                            this._setSelected(i);
                            this._selected = i;
                            SoundManager.playCursor();
                        }
                    }
                });
            }

            // Mouse hover
            const mx = TouchInput.x, my = TouchInput.y;
            this._frameRects.forEach((fr, i) => {
                if (my >= fr.fy && my < fr.fy + fr.frameH &&
                    mx >= this.pX && mx < this.pX + this.pW &&
                    this._selected !== i) {
                    this._setSelected(i);
                    this._selected = i;
                }
            });
        }

        // --------------------------------------------------------
        // Close (fade out, then callback)
        // --------------------------------------------------------
        close(callback) {
            this._closing = true;
            const step = () => {
                this.alpha -= 0.07;
                if (this.alpha <= 0) {
                    this.alpha = 0;
                    callback();
                } else {
                    requestAnimationFrame(step);
                }
            };
            step();
        }
    }

})();
