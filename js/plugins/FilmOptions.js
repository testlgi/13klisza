/*:
 * @target MZ
 * @plugindesc Ekran Opcji stylizowany na stół montażowy - opcje jako kawałki taśmy.
 * @author Adam
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
 * @help FilmOptions.js
 * ============================================================
 * EKRAN OPCJI — STÓŁ MONTAŻOWY
 * ============================================================
 * Zastępuje domyślny ekran opcji interfejsem w stylu
 * stołu montażowego. Każda opcja to kawałek taśmy filmowej.
 *
 * Opcje:
 *   001 - Głośność BGM
 *   002 - Głośność BGS
 *   003 - Głośność ME
 *   004 - Głośność SE
 *   005 - Autorun (zawsze biegnij)
 *   006 - Pamięć komend
 *   007 - Dotyk / Gamepad
 *
 * Nawigacja: strzałki góra/dół, lewo/prawo zmienia wartość,
 * ESC/Backspace zapisuje i wraca.
 * ============================================================
 */

(() => {
    'use strict';

    const PLUGIN_NAME = 'FilmOptions';
    const rawP = PluginManager.parameters(PLUGIN_NAME);

    const CFG = {
        amber: String(rawP.colorAmber || '#c8912a'),
        bg:    String(rawP.colorBg    || '#1a1510'),
        dark:  String(rawP.colorDark  || '#0d0b08'),
        cream: String(rawP.colorCream || '#e8dfc0'),
    };

    const C_SCRATCH = '#3a3020';
    const C_PERF    = '#2a2318';

    function hx(s)     { return PIXI.utils.string2hex(s); }
    function pad(n, l) { return String(n).padStart(l || 2, '0'); }

    function tStyle(serif, size, color, spacing) {
        return new PIXI.TextStyle({
            fontFamily:    serif ? 'Georgia, serif' : '"Courier New", monospace',
            fontSize:      size,
            fill:          color,
            letterSpacing: spacing != null ? spacing : 1,
        });
    }

    // -------------------------------------------------------
    // Option definitions
    // -------------------------------------------------------
    function buildOptionDefs() {
        return [
            {
                key:   'bgmVolume',
                num:   '001',
                label: 'BGM',
                desc:  'głośność muzyki',
                type:  'volume',
                get:   () => ConfigManager.bgmVolume,
                set:   v  => { ConfigManager.bgmVolume = v; AudioManager.bgmVolume = v; },
            },
            {
                key:   'bgsVolume',
                num:   '002',
                label: 'BGS',
                desc:  'głośność otoczenia',
                type:  'volume',
                get:   () => ConfigManager.bgsVolume,
                set:   v  => { ConfigManager.bgsVolume = v; AudioManager.bgsVolume = v; },
            },
            {
                key:   'meVolume',
                num:   '003',
                label: 'ME',
                desc:  'głośność efektów muzycznych',
                type:  'volume',
                get:   () => ConfigManager.meVolume,
                set:   v  => { ConfigManager.meVolume = v; AudioManager.meVolume = v; },
            },
            {
                key:   'seVolume',
                num:   '004',
                label: 'SE',
                desc:  'głośność efektów dźwiękowych',
                type:  'volume',
                get:   () => ConfigManager.seVolume,
                set:   v  => { ConfigManager.seVolume = v; AudioManager.seVolume = v; },
            },
            {
                key:   'alwaysDash',
                num:   '005',
                label: 'AUTORUN',
                desc:  'zawsze biegnij',
                type:  'bool',
                get:   () => ConfigManager.alwaysDash,
                set:   v  => { ConfigManager.alwaysDash = v; },
            },
            {
                key:   'commandRemember',
                num:   '006',
                label: 'PAMIĘĆ KOMEND',
                desc:  'zapamiętaj ostatnią komendę',
                type:  'bool',
                get:   () => ConfigManager.commandRemember,
                set:   v  => { ConfigManager.commandRemember = v; },
            },
            {
                key:   'touchUI',
                num:   '007',
                label: 'INTERFEJS DOTYKOWY',
                desc:  'przyciski na ekranie',
                type:  'bool',
                get:   () => ConfigManager.touchUI,
                set:   v  => { ConfigManager.touchUI = v; },
            },
        ];
    }

    // -------------------------------------------------------
    // Scene_Options override
    // -------------------------------------------------------
    Scene_Options.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this._filmOpts = new FilmOptionsUI(this);
        this.addChild(this._filmOpts);
    };

    Scene_Options.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        this.startFadeIn(this.fadeSpeed(), false);
    };

    Scene_Options.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        if (this._filmOpts) this._filmOpts.update();
    };

    Scene_Options.prototype.isBusy = function() {
        return Scene_Base.prototype.isBusy.call(this);
    };

    Scene_Options.prototype.terminate = function() {
        Scene_Base.prototype.terminate.call(this);
        ConfigManager.save();
    };

    // -------------------------------------------------------
    // FilmOptionsUI
    // -------------------------------------------------------
    class FilmOptionsUI extends PIXI.Container {
        constructor(scene) {
            super();
            this._scene   = scene;
            this._cursor  = 0;
            this._delay   = 0;
            this._closing = false;
            this._tcF     = 0;
            this._opts    = buildOptionDefs();

            this._bgG   = new PIXI.Graphics();
            this._panG  = new PIXI.Graphics();
            this._txts  = new PIXI.Container();
            this._slotC = new PIXI.Container();

            this.addChild(this._bgG);
            this.addChild(this._panG);
            this.addChild(this._slotC);
            this.addChild(this._txts);

            this._build();
        }

        get W()     { return Graphics.width; }
        get H()     { return Graphics.height; }
        get pW()    { return Math.min(600, this.W - 60); }
        get pX()    { return (this.W - this.pW) / 2; }
        get pY()    { return 40; }
        get pH()    { return this.H - 80; }
        get FH()    { return 58; }
        get FGAP()  { return 3; }
        get PW()    { return 30; }
        get listY() { return this.pY + 60; }

        _build() {
            this._drawBg();
            this._drawPanel();
            this._drawHeader();
            this._drawFooter();
            this._buildSlots();
            this._buildMask();
        }

        _drawBg() {
            this._bgG.beginFill(hx(CFG.dark), 0.97);
            this._bgG.drawRect(0, 0, this.W, this.H);
            this._bgG.endFill();
        }

        _drawPanel() {
            const g = this._panG;
            g.lineStyle(1, hx(C_SCRATCH));
            g.beginFill(hx(CFG.dark));
            g.drawRoundedRect(this.pX, this.pY, this.pW, this.pH, 4);
            g.endFill();

            g.lineStyle(0);
            g.beginFill(hx(CFG.bg));
            g.drawRect(this.pX, this.pY, this.pW, 56);
            g.endFill();
            g.lineStyle(1, hx(C_SCRATCH));
            g.moveTo(this.pX, this.pY + 56);
            g.lineTo(this.pX + this.pW, this.pY + 56);

            g.lineStyle(0);
            g.beginFill(hx(CFG.bg));
            g.drawRect(this.pX, this.pY + this.pH - 36, this.pW, 36);
            g.endFill();
            g.lineStyle(1, hx(C_SCRATCH));
            g.moveTo(this.pX, this.pY + this.pH - 36);
            g.lineTo(this.pX + this.pW, this.pY + this.pH - 36);
        }

        _drawHeader() {
            const g  = this._panG;
            const cx = this.pX + 28, cy = this.pY + 28;

            g.lineStyle(2, hx(CFG.amber));
            g.drawCircle(cx, cy, 14);
            g.beginFill(hx(CFG.amber));
            g.drawCircle(cx, cy, 4);
            g.endFill();
            g.lineStyle(1.5, hx(CFG.amber));
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2;
                g.moveTo(cx + Math.cos(a)*5, cy + Math.sin(a)*5);
                g.lineTo(cx + Math.cos(a)*12, cy + Math.sin(a)*12);
            }

            this._mkTxt('USTAWIENIA MONTAŻU', true, 18, CFG.cream, this.pX+52, this.pY+10);
            this._mkTxt('konfiguracja toru audio i sterowania', false, 10, CFG.amber+'aa', this.pX+53, this.pY+35);
            this._tcTxt = this._mkTxt('00:00:00:00', false, 11, CFG.amber+'bb', this.pX+this.pW-115, this.pY+22);
        }

        _drawFooter() {
            const fy = this.pY + this.pH - 36;
            this._mkTxt('\u2191\u2193 nawiguj   \u2190\u2192 zmień wartość   ESC zapisz i wróć', false, 9, CFG.amber+'77', this.pX+14, fy+12);
            this._statusTxt = this._mkTxt('', false, 9, CFG.amber+'88', this.pX+this.pW-220, fy+12);
        }

        _mkTxt(str, serif, size, color, x, y) {
            const t = new PIXI.Text(str, tStyle(serif, size, color));
            t.x = x; t.y = y;
            this._txts.addChild(t);
            return t;
        }

        _buildSlots() {
            this._slotC.removeChildren();
            this._slots = [];

            this._opts.forEach((opt, i) => {
                const s = this._makeSlot(i, opt);
                s.y = i * (this.FH + this.FGAP);
                this._slotC.addChild(s);
                this._slots.push(s);
            });

            this._slotC.x = this.pX;
            this._slotC.y = this.listY;
            this._applyHighlight();
        }

        _makeSlot(idx, opt) {
            const c   = new PIXI.Container();
            const fw  = this.pW - 12;
            const act = idx === this._cursor;

            const g = new PIXI.Graphics();
            c._g = g;
            this._drawSlotBg(g, fw, act);
            c.addChild(g);

            // slot number
            const numT = new PIXI.Text(opt.num, tStyle(false, 9, CFG.amber+'88'));
            numT.x = this.PW + 8; numT.y = 22;
            c.addChild(numT);

            // label
            const lblT = new PIXI.Text(opt.label, tStyle(true, 14, act ? CFG.amber : CFG.cream, 2));
            lblT.x = this.PW + 52; lblT.y = 10;
            c._lblT = lblT;
            c.addChild(lblT);

            // desc
            const dscT = new PIXI.Text(opt.desc, tStyle(false, 9, CFG.cream+'66'));
            dscT.x = this.PW + 52; dscT.y = 32;
            c.addChild(dscT);

            // value display
            const valC = new PIXI.Container();
            valC.x = fw - 180; valC.y = 10;
            c._valC = valC;
            c.addChild(valC);
            this._drawValue(valC, opt, act);

            // arrow
            const arr = new PIXI.Graphics();
            arr.lineStyle(1.5, hx(CFG.amber));
            arr.moveTo(0,0); arr.lineTo(7,7); arr.lineTo(0,14);
            arr.x = fw - 16; arr.y = Math.floor((this.FH - 14) / 2);
            arr.alpha = act ? 1 : 0;
            c._arr = arr;
            c.addChild(arr);

            // splice
            const sl = new PIXI.Graphics();
            sl.lineStyle(1, hx(CFG.amber), 0.2);
            sl.moveTo(0, this.FH+1); sl.lineTo(fw, this.FH+1);
            c.addChild(sl);

            return c;
        }

        _drawSlotBg(g, fw, active) {
            g.clear();
            g.lineStyle(1, hx(C_SCRATCH));
            g.beginFill(hx(C_PERF));
            g.drawRect(0, 0, this.PW, this.FH);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(hx(CFG.dark));
            for (let h = 0; h < 3; h++) g.drawRoundedRect(10, 8+h*15, 10, 8, 1);
            g.endFill();
            g.lineStyle(1, hx(C_SCRATCH));
            g.beginFill(active ? hx(C_SCRATCH) : hx(CFG.bg));
            g.drawRect(this.PW, 0, fw - this.PW, this.FH);
            g.endFill();
        }

        _drawValue(container, opt, active) {
            container.removeChildren();
            const val = opt.get();

            if (opt.type === 'volume') {
                // bar + number
                const barW = 120, barH = 8;
                const filled = Math.round((val / 100) * barW);

                const bg = new PIXI.Graphics();
                bg.lineStyle(1, hx(C_SCRATCH));
                bg.beginFill(hx(CFG.dark));
                bg.drawRect(0, 12, barW, barH);
                bg.endFill();
                container.addChild(bg);

                const fill = new PIXI.Graphics();
                fill.beginFill(active ? hx(CFG.amber) : hx(CFG.amber+'88'));
                if (filled > 0) fill.drawRect(1, 13, filled - 1, barH - 2);
                fill.endFill();
                container.addChild(fill);

                const numT = new PIXI.Text(pad(val, 3) + '%', tStyle(false, 10, active ? CFG.amber : CFG.cream+'99'));
                numT.x = barW + 8; numT.y = 8;
                container.addChild(numT);

                // arrows
                const lArr = new PIXI.Graphics();
                lArr.lineStyle(1.5, hx(active ? CFG.amber : CFG.amber+'66'));
                lArr.moveTo(8,4); lArr.lineTo(0,8); lArr.lineTo(8,12);
                lArr.x = -14; lArr.y = 8;
                container.addChild(lArr);

                const rArr = new PIXI.Graphics();
                rArr.lineStyle(1.5, hx(active ? CFG.amber : CFG.amber+'66'));
                rArr.moveTo(0,4); rArr.lineTo(8,8); rArr.lineTo(0,12);
                rArr.x = barW + 38; rArr.y = 8;
                container.addChild(rArr);

            } else {
                // bool toggle — like a film cut tag
                const onColor  = active ? CFG.amber : CFG.amber + '99';
                const offColor = CFG.cream + '44';
                const label    = val ? 'ON' : 'OFF';
                const color    = val ? onColor : offColor;

                const bg2 = new PIXI.Graphics();
                bg2.lineStyle(1, hx(val ? CFG.amber : C_SCRATCH));
                bg2.beginFill(hx(val ? C_SCRATCH : CFG.dark));
                bg2.drawRoundedRect(0, 6, 52, 22, 2);
                bg2.endFill();
                container.addChild(bg2);

                const boolT = new PIXI.Text(label, tStyle(false, 12, color, 2));
                boolT.x = 26 - boolT.width/2; boolT.y = 10;
                container.addChild(boolT);
            }
        }

        _applyHighlight() {
            if (!this._slots) return;
            const fw = this.pW - 12;
            this._slots.forEach((c, i) => {
                const act = i === this._cursor;
                this._drawSlotBg(c._g, fw, act);
                if (c._lblT) c._lblT.style.fill = act ? CFG.amber : CFG.cream;
                if (c._arr)  c._arr.alpha        = act ? 1 : 0;
                this._drawValue(c._valC, this._opts[i], act);
            });
        }

        _buildMask() {
            const listH = this.pH - 96;
            const m = new PIXI.Graphics();
            m.beginFill(0xffffff);
            m.drawRect(this.pX, this.listY, this.pW, listH);
            m.endFill();
            this.addChild(m);
            this._slotC.mask = m;
        }

        // --------------------------------------------------
        update() {
            if (!this._closing && this.alpha < 1) this.alpha = Math.min(1, this.alpha + 0.05);

            this._tcF++;
            if (this._tcTxt) {
                const f = this._tcF, fps = 24;
                this._tcTxt.text = pad(Math.floor(f/fps/3600)%24)+':'+pad(Math.floor(f/fps/60)%60)+':'+pad(Math.floor(f/fps)%60)+':'+pad(f%fps);
            }

            if (!this._closing) this._handleInput();
        }

        _handleInput() {
            const opt = this._opts[this._cursor];

            // nawigacja gora/dol - z delay
            if (this._delay > 0) {
                this._delay--;
            } else {
                if (Input.isTriggered('down') || Input.isRepeated('down')) {
                    this._cursor = (this._cursor + 1) % this._opts.length;
                    this._onMove();
                } else if (Input.isTriggered('up') || Input.isRepeated('up')) {
                    this._cursor = (this._cursor - 1 + this._opts.length) % this._opts.length;
                    this._onMove();
                }
            }

            // zmiana wartosci - bez delay, zawsze reaguje
            if (Input.isTriggered('right') || Input.isRepeated('right')) {
                this._changeValue(opt, 1);
            }
            if (Input.isTriggered('left') || Input.isRepeated('left')) {
                this._changeValue(opt, -1);
            }

            if (Input.isTriggered('ok')) {
                this._changeValue(opt, 1);
            }

            if (Input.isTriggered('cancel')) {
                SoundManager.playCancel();
                this._close();
            }

            // touch
            if (TouchInput.isTriggered()) {
                const tx = TouchInput.x, ty = TouchInput.y;
                this._opts.forEach((o, i) => {
                    const fy = this.listY + i * (this.FH + this.FGAP);
                    if (ty >= fy && ty < fy + this.FH && tx >= this.pX && tx < this.pX + this.pW) {
                        if (this._cursor === i) {
                            this._changeValue(o, 1);
                        } else {
                            this._cursor = i; this._onMove();
                        }
                    }
                });
            }
        }

        _changeValue(opt, dir) {
            if (opt.type === 'volume') {
                const step = 10;
                const cur  = opt.get();
                const next = Math.max(0, Math.min(100, cur + dir * step));
                if (next !== cur) {
                    opt.set(next);
                    SoundManager.playCursor();
                    this._applyHighlight();
                    if (this._statusTxt) {
                        this._statusTxt.text = opt.label.toLowerCase() + ': ' + pad(next, 3) + '%';
                    }
                }
            } else {
                opt.set(!opt.get());
                SoundManager.playCursor();
                this._applyHighlight();
                if (this._statusTxt) {
                    this._statusTxt.text = opt.label.toLowerCase() + ': ' + (opt.get() ? 'ON' : 'OFF');
                }
            }
        }

        _onMove() {
            SoundManager.playCursor();
            this._delay = 6;
            this._applyHighlight();
            const opt = this._opts[this._cursor];
            if (this._statusTxt) {
                const val = opt.type === 'volume'
                    ? pad(opt.get(), 3) + '%'
                    : (opt.get() ? 'ON' : 'OFF');
                this._statusTxt.text = 'klatka ' + opt.num + '  \u00b7  ' + val;
            }
        }

        _close() {
            if (this._closing) return;
            this._closing = true;
            ConfigManager.save();
            let a = 1;
            const fade = () => {
                a -= 0.07; this.alpha = Math.max(0, a);
                if (a > 0) requestAnimationFrame(fade);
                else SceneManager.pop();
            };
            fade();
        }
    }

})();
