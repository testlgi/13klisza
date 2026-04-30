/*:
 * @target MZ
 * @plugindesc Ekran Wczytaj/Zapisz stylizowany na stół montażowy.
 * @author Adam
 *
 * @param maxSlots
 * @text Liczba slotów zapisu
 * @type number
 * @min 1
 * @max 20
 * @default 8
 *
 * @param slotsVisible
 * @text Widoczne sloty naraz
 * @type number
 * @min 1
 * @max 8
 * @default 5
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
 * @param emptySlotText
 * @text Tekst pustego slotu
 * @type string
 * @default pusty slot
 *
 * @param confirmOverwrite
 * @text Pytaj o nadpisanie
 * @type boolean
 * @default true
 *
 * @help FilmSaveLoad.js
 * Zastępuje ekran zapisu i wczytywania stylem stołu montażowego.
 * Wrzuć do js/plugins/ i włącz w Plugin Managerze.
 */

(() => {
    'use strict';

    const PLUGIN_NAME = 'FilmSaveLoad';
    const p = PluginManager.parameters(PLUGIN_NAME);

    const CFG = {
        maxSlots:        Number(p.maxSlots)     || 8,
        slotsVisible:    Number(p.slotsVisible) || 5,
        amber:           String(p.colorAmber    || '#c8912a'),
        bg:              String(p.colorBg       || '#1a1510'),
        dark:            String(p.colorDark     || '#0d0b08'),
        cream:           String(p.colorCream    || '#e8dfc0'),
        emptySlotText:   String(p.emptySlotText || 'pusty slot'),
        confirmOverwrite: p.confirmOverwrite !== 'false',
    };

    const C_SCRATCH = '#3a3020';
    const C_PERF    = '#2a2318';

    function hx(str)   { return PIXI.utils.string2hex(str); }
    function pad(n, l) { return String(n).padStart(l || 2, '0'); }

    function tStyle(serif, size, color, spacing) {
        return new PIXI.TextStyle({
            fontFamily:    serif ? 'Georgia, serif' : '"Courier New", monospace',
            fontSize:      size,
            fill:          color,
            letterSpacing: spacing || 1,
        });
    }

    function fmtTime(frames) {
        if (!frames && frames !== 0) return '00:00:00';
        const s = Math.floor(frames / 60) % 60;
        const m = Math.floor(frames / 3600) % 60;
        const h = Math.floor(frames / 216000);
        return pad(h) + ':' + pad(m) + ':' + pad(s);
    }

    function fmtDate(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.getFullYear() + '.' + pad(d.getMonth()+1) + '.' + pad(d.getDate())
            + '  ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    // -------------------------------------------------------
    // Scene_Load
    // -------------------------------------------------------
    Scene_Load.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this._filmUI = new FilmSaveUI('load', this);
        this.addChild(this._filmUI);
    };

    Scene_Load.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        this.startFadeIn(this.fadeSpeed(), false);
    };

    Scene_Load.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        if (this._filmUI) this._filmUI.update();
    };

    Scene_Load.prototype.isBusy = function() {
        return Scene_Base.prototype.isBusy.call(this);
    };

    Scene_Load.prototype.executeLoad = function(savefileId) {
        DataManager.loadGame(savefileId)
            .then(() => {
                SoundManager.playLoad();
                this.fadeOutAll();
                SceneManager.goto(Scene_Map);
            })
            .catch(() => SoundManager.playBuzzer());
    };

    // -------------------------------------------------------
    // Scene_Save
    // -------------------------------------------------------
    Scene_Save.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this._filmUI = new FilmSaveUI('save', this);
        this.addChild(this._filmUI);
    };

    Scene_Save.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        this.startFadeIn(this.fadeSpeed(), false);
    };

    Scene_Save.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        if (this._filmUI) this._filmUI.update();
    };

    Scene_Save.prototype.isBusy = function() {
        return Scene_Base.prototype.isBusy.call(this);
    };

    Scene_Save.prototype.executeSave = function(savefileId) {
        $gameSystem.onBeforeSave();
        DataManager.saveGame(savefileId)
            .then(() => {
                SoundManager.playSave();
                if (this._filmUI) this._filmUI.onSaveSuccess();
            })
            .catch(() => SoundManager.playBuzzer());
    };

    // -------------------------------------------------------
    // FilmSaveUI
    // -------------------------------------------------------
    class FilmSaveUI extends PIXI.Container {
        constructor(mode, scene) {
            super();
            this._mode    = mode;
            this._scene   = scene;
            this._cursor  = 0;
            this._scroll  = 0;
            this._delay   = 0;
            this._closing     = false;
            this._confirmMode = false;
            this._flashTimer  = 0;
            this._tcF         = 0;
            this._saveInfo    = new Array(CFG.maxSlots).fill(null);
            this._ready       = false;

            this._bgG   = new PIXI.Graphics();
            this._panG  = new PIXI.Graphics();
            this._txts  = new PIXI.Container();
            this._slotC = new PIXI.Container();
            this._confC = new PIXI.Container();
            this._sbC   = new PIXI.Container();

            this.addChild(this._bgG);
            this.addChild(this._panG);
            this.addChild(this._slotC);
            this.addChild(this._txts);
            this.addChild(this._sbC);
            this.addChild(this._confC);

            this._fetchSaveInfo();
        }

        // layout
        get W()     { return Graphics.width; }
        get H()     { return Graphics.height; }
        get pW()    { return Math.min(580, this.W - 60); }
        get pX()    { return (this.W - this.pW) / 2; }
        get pY()    { return 40; }
        get pH()    { return this.H - 80; }
        get FH()    { return 62; }
        get FGAP()  { return 3; }
        get PW()    { return 30; }
        get listY() { return this.pY + 60; }
        get listH() { return this.pH - 96; }

        // --------------------------------------------------
        _fetchSaveInfo() {
            // MZ: info is stored in global info file
            const tryLoad = () => {
                try {
                    // DataManager.loadGlobalInfo returns a Promise in MZ
                    const result = DataManager.loadGlobalInfo();
                    if (result && typeof result.then === 'function') {
                        result.then(info => {
                            this._applyGlobalInfo(info);
                        }).catch(() => {
                            this._buildAll();
                        });
                    } else {
                        // Fallback: try _globalInfo directly
                        this._applyGlobalInfo(DataManager._globalInfo);
                    }
                } catch(e) {
                    this._buildAll();
                }
            };
            tryLoad();
        }

        _applyGlobalInfo(info) {
            if (info) {
                for (let i = 1; i <= CFG.maxSlots; i++) {
                    this._saveInfo[i-1] = info[i] || null;
                }
            }
            this._buildAll();
        }

        // --------------------------------------------------
        _buildAll() {
            this._ready = true;
            this._bgG.clear();
            this._panG.clear();
            this._txts.removeChildren();
            this._slotC.removeChildren();
            this._sbC.removeChildren();
            this._confC.removeChildren();

            this._drawBg();
            this._drawPanel();
            this._drawHeader();
            this._drawFooter();
            this._buildSlots();
            this._buildMask();
            this._buildScrollbar();
            this._buildConfirm();
        }

        _drawBg() {
            this._bgG.beginFill(hx(CFG.dark), 0.97);
            this._bgG.drawRect(0, 0, this.W, this.H);
            this._bgG.endFill();
        }

        _drawPanel() {
            const g = this._panG;
            // main panel
            g.lineStyle(1, hx(C_SCRATCH));
            g.beginFill(hx(CFG.dark));
            g.drawRoundedRect(this.pX, this.pY, this.pW, this.pH, 4);
            g.endFill();
            // header strip
            g.lineStyle(0);
            g.beginFill(hx(CFG.bg));
            g.drawRect(this.pX, this.pY, this.pW, 56);
            g.endFill();
            g.lineStyle(1, hx(C_SCRATCH));
            g.moveTo(this.pX, this.pY + 56);
            g.lineTo(this.pX + this.pW, this.pY + 56);
            // footer strip
            g.lineStyle(0);
            g.beginFill(hx(CFG.bg));
            g.drawRect(this.pX, this.pY + this.pH - 36, this.pW, 36);
            g.endFill();
            g.lineStyle(1, hx(C_SCRATCH));
            g.moveTo(this.pX, this.pY + this.pH - 36);
            g.lineTo(this.pX + this.pW, this.pY + this.pH - 36);
        }

        _drawHeader() {
            const g = this._panG;
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
            const title = this._mode === 'load' ? 'WCZYTAJ NAGRANIE' : 'ZAPISZ NAGRANIE';
            const sub   = this._mode === 'load' ? 'wybierz klatkę do odtworzenia' : 'wybierz slot do zapisu';
            this._mkTxt(title, true,  18, CFG.cream,        this.pX+52, this.pY+10);
            this._mkTxt(sub,   false, 10, CFG.amber+'aa',   this.pX+53, this.pY+35);
            this._tcTxt = this._mkTxt('00:00:00:00', false, 11, CFG.amber+'bb', this.pX+this.pW-115, this.pY+22);
        }

        _drawFooter() {
            const fy = this.pY + this.pH - 36;
            const hint = this._mode === 'load'
                ? '\u2191\u2193 nawiguj   ENTER wczytaj   ESC wr\u00f3\u0107'
                : '\u2191\u2193 nawiguj   ENTER zapisz    ESC wr\u00f3\u0107';
            this._mkTxt(hint, false, 9, CFG.amber+'77', this.pX+14, fy+12);
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
            for (let i = 0; i < CFG.maxSlots; i++) {
                const s = this._makeSlot(i);
                s.y = i * (this.FH + this.FGAP);
                this._slotC.addChild(s);
                this._slots.push(s);
            }
            this._slotC.x = this.pX;
            this._slotC.y = this.listY;
            this._applyHighlight();
            this._doScroll();
        }

        _makeSlot(idx) {
            const c    = new PIXI.Container();
            const info = this._saveInfo[idx];
            const fw   = this.pW - 12;
            const act  = idx === this._cursor;

            const g = new PIXI.Graphics();
            c._g  = g;
            c._idx = idx;
            this._drawSlotBg(g, fw, act);
            c.addChild(g);

            // number
            const numT = new PIXI.Text(pad(idx+1, 3), tStyle(false, 9, CFG.amber+'88'));
            numT.x = this.PW + 8; numT.y = 24;
            c.addChild(numT);

            if (info) {
                const name = ((info.title || '') || ('slot ' + (idx+1))).toUpperCase();
                const nameT = new PIXI.Text(name, tStyle(true, 14, act ? CFG.amber : CFG.cream, 2));
                nameT.x = this.PW + 52; nameT.y = 8;
                c._nameT = nameT;
                c.addChild(nameT);

                const ptT = new PIXI.Text('czas: ' + fmtTime(info.playtime), tStyle(false, 9, CFG.cream+'88'));
                ptT.x = this.PW + 52; ptT.y = 30;
                c.addChild(ptT);

                const dtT = new PIXI.Text(fmtDate(info.timestamp), tStyle(false, 9, CFG.amber+'99'));
                dtT.x = this.PW + 52; dtT.y = 45;
                c.addChild(dtT);

                if (info.characters && info.characters[0]) {
                    const lvT = new PIXI.Text('Lv.' + (info.characters[0].level || '?'), tStyle(false, 9, CFG.cream+'66'));
                    lvT.x = fw - 55; lvT.y = 24;
                    c.addChild(lvT);
                }
            } else {
                const emT = new PIXI.Text('\u2014 ' + CFG.emptySlotText + ' \u2014', tStyle(false, 11, act ? CFG.amber+'cc' : CFG.amber+'44'));
                emT.x = this.PW + 52; emT.y = 22;
                c._emT = emT;
                c.addChild(emT);
            }

            // arrow
            const arr = new PIXI.Graphics();
            arr.lineStyle(1.5, hx(CFG.amber));
            arr.moveTo(0,0); arr.lineTo(7,7); arr.lineTo(0,14);
            arr.x = fw - 18; arr.y = Math.floor((this.FH - 14) / 2);
            arr.alpha = act ? 1 : 0;
            c._arr = arr;
            c.addChild(arr);

            // splice divider
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
            for (let h = 0; h < 3; h++) g.drawRoundedRect(10, 9+h*16, 10, 9, 1);
            g.endFill();
            g.lineStyle(1, hx(C_SCRATCH));
            g.beginFill(active ? hx(C_SCRATCH) : hx(CFG.bg));
            g.drawRect(this.PW, 0, fw - this.PW, this.FH);
            g.endFill();
        }

        _applyHighlight() {
            if (!this._slots) return;
            const fw = this.pW - 12;
            this._slots.forEach((c, i) => {
                const act = i === this._cursor;
                this._drawSlotBg(c._g, fw, act);
                if (c._nameT) c._nameT.style.fill = act ? CFG.amber : CFG.cream;
                if (c._emT)   c._emT.style.fill   = act ? CFG.amber+'cc' : CFG.amber+'44';
                if (c._arr)   c._arr.alpha         = act ? 1 : 0;
            });
        }

        _buildMask() {
            const m = new PIXI.Graphics();
            m.beginFill(0xffffff);
            m.drawRect(this.pX, this.listY, this.pW, this.listH);
            m.endFill();
            this.addChild(m);
            this._slotC.mask = m;
        }

        _buildScrollbar() {
            if (CFG.maxSlots <= CFG.slotsVisible) return;
            const sbX = this.pX + this.pW - 9;
            const sbBg = new PIXI.Graphics();
            sbBg.beginFill(hx(C_SCRATCH), 0.5);
            sbBg.drawRect(sbX, this.listY, 4, this.listH);
            sbBg.endFill();
            this._sbC.addChild(sbBg);
            this._sbThumb = new PIXI.Graphics();
            this._sbC.addChild(this._sbThumb);
            this._updateSB();
        }

        _updateSB() {
            if (!this._sbThumb) return;
            this._sbThumb.clear();
            const ratio  = Math.min(1, CFG.slotsVisible / CFG.maxSlots);
            const tH     = Math.max(20, this.listH * ratio);
            const maxSc  = Math.max(1, CFG.maxSlots - CFG.slotsVisible);
            const tY     = this.listY + (this._scroll / maxSc) * (this.listH - tH);
            this._sbThumb.beginFill(hx(CFG.amber), 0.6);
            this._sbThumb.drawRect(this.pX + this.pW - 9, tY, 4, tH);
            this._sbThumb.endFill();
        }

        _doScroll() {
            const v0 = this._scroll, v1 = this._scroll + CFG.slotsVisible - 1;
            if (this._cursor < v0) this._scroll = this._cursor;
            if (this._cursor > v1) this._scroll = this._cursor - CFG.slotsVisible + 1;
            this._scroll = Math.max(0, Math.min(CFG.maxSlots - CFG.slotsVisible, this._scroll));
            this._slotC.y = this.listY - this._scroll * (this.FH + this.FGAP);
            this._updateSB();
        }

        _buildConfirm() {
            const dW = 320, dH = 140;
            const dX = (this.W - dW) / 2, dY = (this.H - dH) / 2;
            const g = new PIXI.Graphics();
            g.lineStyle(1, hx(CFG.amber), 0.9);
            g.beginFill(hx(CFG.dark), 0.98);
            g.drawRoundedRect(dX, dY, dW, dH, 4);
            g.endFill();
            this._confC.addChild(g);

            const q = new PIXI.Text('NADPISA\u0106 TEN SLOT?', tStyle(true, 14, CFG.cream, 2));
            q.x = dX + dW/2 - q.width/2; q.y = dY + 20;
            this._confC.addChild(q);

            const yt = new PIXI.Text('[ ENTER ]  tak, zapisz', tStyle(false, 11, CFG.amber));
            yt.x = dX + 30; yt.y = dY + 60;
            this._confC.addChild(yt);

            const nt = new PIXI.Text('[ ESC ]    nie, wr\u00f3\u0107', tStyle(false, 11, CFG.cream+'88'));
            nt.x = dX + 30; nt.y = dY + 90;
            this._confC.addChild(nt);

            this._confC.visible = false;
        }

        // --------------------------------------------------
        update() {
            if (!this._closing && this.alpha < 1) this.alpha = Math.min(1, this.alpha + 0.05);

            this._tcF++;
            if (this._tcTxt) {
                const f = this._tcF, fps = 24;
                this._tcTxt.text = pad(Math.floor(f/fps/3600)%24)+':'+pad(Math.floor(f/fps/60)%60)+':'+pad(Math.floor(f/fps)%60)+':'+pad(f%fps);
            }

            if (this._flashTimer > 0) {
                this._flashTimer--;
                if (this._flashTimer === 0) this._close();
                return;
            }
            if (!this._closing && this._ready) this._handleInput();
        }

        _handleInput() {
            if (this._delay > 0) { this._delay--; return; }

            if (this._confirmMode) {
                if (Input.isTriggered('ok')) {
                    this._confC.visible = false;
                    this._confirmMode = false;
                    this._doSave();
                }
                if (Input.isTriggered('cancel')) {
                    this._confC.visible = false;
                    this._confirmMode = false;
                    SoundManager.playCancel();
                }
                return;
            }

            if (Input.isTriggered('down')) {
                this._cursor = (this._cursor + 1) % CFG.maxSlots;
                this._onMove();
            }
            if (Input.isTriggered('up')) {
                this._cursor = (this._cursor - 1 + CFG.maxSlots) % CFG.maxSlots;
                this._onMove();
            }
            if (Input.isTriggered('ok')) {
                this._mode === 'load' ? this._doLoad() : this._trySave();
            }
            if (Input.isTriggered('cancel')) {
                SoundManager.playCancel(); this._close();
            }

            if (TouchInput.isTriggered()) {
                const tx = TouchInput.x, ty = TouchInput.y;
                for (let i = 0; i < CFG.maxSlots; i++) {
                    const fy = this.listY + (i - this._scroll) * (this.FH + this.FGAP);
                    if (ty >= fy && ty < fy + this.FH && tx >= this.pX && tx < this.pX + this.pW) {
                        if (this._cursor === i) {
                            this._mode === 'load' ? this._doLoad() : this._trySave();
                        } else {
                            this._cursor = i; this._onMove();
                        }
                    }
                }
            }
        }

        _onMove() {
            SoundManager.playCursor();
            this._delay = 8;
            this._applyHighlight();
            this._doScroll();
            const info = this._saveInfo[this._cursor];
            if (this._statusTxt) {
                this._statusTxt.text = info
                    ? 'klatka ' + pad(this._cursor+1, 3) + ' \u00b7 zaj\u0119ta'
                    : 'klatka ' + pad(this._cursor+1, 3) + ' \u00b7 pusta';
            }
        }

        _doLoad() {
            if (!this._saveInfo[this._cursor]) { SoundManager.playBuzzer(); return; }
            SoundManager.playOk();
            this._scene.executeLoad(this._cursor + 1);
        }

        _trySave() {
            if (this._saveInfo[this._cursor] && CFG.confirmOverwrite) {
                this._confirmMode = true;
                this._confC.visible = true;
                SoundManager.playCursor();
            } else {
                this._doSave();
            }
        }

        _doSave() {
            SoundManager.playOk();
            this._scene.executeSave(this._cursor + 1);
        }

        onSaveSuccess() {
            this._flashTimer = 80;
            if (this._statusTxt) {
                this._statusTxt.text = 'zapisano \u00b7 klatka ' + pad(this._cursor+1, 3);
                this._statusTxt.style.fill = CFG.amber;
            }
            DataManager.loadGlobalInfo()
                .then(info => { this._applyGlobalInfo(info); })
                .catch(() => {});
        }

        _applyGlobalInfo(info) {
            if (info) {
                for (let i = 1; i <= CFG.maxSlots; i++) {
                    this._saveInfo[i-1] = info[i] || null;
                }
            }
            this._buildAll();
        }

        _close() {
            if (this._closing) return;
            this._closing = true;
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
