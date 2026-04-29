/*:
 * @target MZ
 * @plugindesc Ekran Wczytaj/Zapisz stylizowany na stół montażowy. Wymaga FilmEditingMenu.js
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
 * ============================================================
 * EKRAN ZAPISU / WCZYTANIA — STÓŁ MONTAŻOWY
 * ============================================================
 * Zastępuje domyślny ekran zapisu i wczytywania gry.
 * Sloty zapisu wyglądają jak klatki taśmy filmowej.
 *
 * Wymaga: FilmEditingMenu.js (dla spójności stylów)
 * Kolejność w Plugin Managerze: FilmEditingMenu → FilmSaveLoad
 *
 * Każdy slot pokazuje:
 *   - numer klatki
 *   - nazwę mapy
 *   - poziom postaci (jeśli dostępny)
 *   - datę i godzinę zapisu
 *   - czas gry
 * ============================================================
 */

(() => {
    'use strict';

    const PLUGIN_NAME = 'FilmSaveLoad';
    const p = PluginManager.parameters(PLUGIN_NAME);

    const CFG = {
        maxSlots:        Number(p.maxSlots)        || 8,
        slotsVisible:    Number(p.slotsVisible)    || 5,
        amber:           String(p.colorAmber       || '#c8912a'),
        bg:              String(p.colorBg          || '#1a1510'),
        dark:            String(p.colorDark        || '#0d0b08'),
        cream:           String(p.colorCream       || '#e8dfc0'),
        emptySlotText:   String(p.emptySlotText    || 'pusty slot'),
        confirmOverwrite: p.confirmOverwrite !== 'false',
    };

    const scratch = '#3a3020';
    const perf    = '#2a2318';

    // -------------------------------------------------------
    // Helpers
    // -------------------------------------------------------
    function hex(str) { return PIXI.utils.string2hex(str); }
    function pad(n, len = 2) { return String(n).padStart(len, '0'); }
    function makeTextStyle(serif, size, color, letterSpacing = 1) {
        return new PIXI.TextStyle({
            fontFamily:    serif ? 'Georgia, serif' : '"Courier New", monospace',
            fontSize:      size,
            fill:          color,
            letterSpacing: letterSpacing,
        });
    }

    function formatPlaytime(frames) {
        const s = Math.floor(frames / 60) % 60;
        const m = Math.floor(frames / 3600) % 60;
        const h = Math.floor(frames / 216000);
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    function formatDate(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // -------------------------------------------------------
    // Override Scene_Load
    // -------------------------------------------------------
    Scene_Load.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this._filmLoad = new FilmSaveLoadSprite('load', this);
        this.addChild(this._filmLoad);
    };

    Scene_Load.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        this.startFadeIn(this.fadeSpeed(), false);
    };

    Scene_Load.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        if (this._filmLoad) this._filmLoad.update();
    };

    Scene_Load.prototype.isBusy = function() {
        return Scene_Base.prototype.isBusy.call(this);
    };

    Scene_Load.prototype.onLoadSuccess = function() {
        SoundManager.playLoad();
        this.fadeOutAll();
        this.reloadMapIfUpdated();
        SceneManager.goto(Scene_Map);
        this._loadSuccess = true;
    };

    Scene_Load.prototype.reloadMapIfUpdated = function() {};

    // -------------------------------------------------------
    // Override Scene_Save
    // -------------------------------------------------------
    Scene_Save.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this._filmSave = new FilmSaveLoadSprite('save', this);
        this.addChild(this._filmSave);
    };

    Scene_Save.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        this.startFadeIn(this.fadeSpeed(), false);
    };

    Scene_Save.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        if (this._filmSave) this._filmSave.update();
    };

    Scene_Save.prototype.isBusy = function() {
        return Scene_Base.prototype.isBusy.call(this);
    };

    Scene_Save.prototype.onSaveSuccess = function() {
        SoundManager.playSave();
        this._filmSave.flashSuccess();
    };

    Scene_Save.prototype.onSaveFailure = function() {
        SoundManager.playBuzzer();
    };

    // -------------------------------------------------------
    // FilmSaveLoadSprite
    // -------------------------------------------------------
    class FilmSaveLoadSprite extends PIXI.Container {
        constructor(mode, scene) {
            super();
            this._mode    = mode;
            this._scene   = scene;
            this._cursor  = 0;
            this._scroll  = 0;
            this._inputDelay = 0;
            this._closing = false;
            this._tcFrames = 0;
            this._confirmMode = false;
            this._flashTimer  = 0;
            this._saveInfo    = [];

            this._bg   = new PIXI.Graphics();
            this._gfx  = new PIXI.Graphics();
            this._txts = new PIXI.Container();
            this.addChild(this._bg);
            this.addChild(this._gfx);
            this.addChild(this._txts);

            this._slotTexts = [];

            this._loadSaveInfo();
            this._build();
        }

        // --------------------------------------------------
        // Dimensions
        // --------------------------------------------------
        get W()  { return Graphics.width; }
        get H()  { return Graphics.height; }
        get pW() { return Math.min(580, this.W - 60); }
        get pX() { return (this.W - this.pW) / 2; }
        get pY() { return 40; }
        get pH() { return this.H - 80; }
        get fH() { return 62; }
        get fGap() { return 3; }
        get perfW() { return 30; }
        get listY() { return this.pY + 60; }
        get listH() { return this.pH - 60 - 40; }

        // --------------------------------------------------
        _loadSaveInfo() {
            this._saveInfo = [];
            for (let i = 1; i <= CFG.maxSlots; i++) {
                const info = DataManager.loadSavefileInfo(i);
                this._saveInfo.push(info || null);
            }
        }

        // --------------------------------------------------
        _build() {
            // Full screen bg
            this._bg.beginFill(hex(CFG.dark), 0.97);
            this._bg.drawRect(0, 0, this.W, this.H);
            this._bg.endFill();

            this._drawPanel();
            this._buildSlots();
            this._drawScrollbar();
            this._buildConfirmDialog();
        }

        _drawPanel() {
            const g = this._gfx;

            // Panel border
            g.lineStyle(1, hex(scratch));
            g.beginFill(hex(CFG.dark));
            g.drawRoundedRect(this.pX, this.pY, this.pW, this.pH, 4);
            g.endFill();

            // Header
            g.lineStyle(0);
            g.beginFill(hex(CFG.bg));
            g.drawRect(this.pX, this.pY, this.pW, 56);
            g.endFill();

            g.lineStyle(1, hex(scratch));
            g.moveTo(this.pX, this.pY + 56);
            g.lineTo(this.pX + this.pW, this.pY + 56);

            // Footer
            g.lineStyle(0);
            g.beginFill(hex(CFG.bg));
            g.drawRect(this.pX, this.pY + this.pH - 36, this.pW, 36);
            g.endFill();
            g.lineStyle(1, hex(scratch));
            g.moveTo(this.pX, this.pY + this.pH - 36);
            g.lineTo(this.pX + this.pW, this.pY + this.pH - 36);

            // Reel icon
            const cx = this.pX + 28, cy = this.pY + 28;
            g.lineStyle(2, hex(CFG.amber));
            g.drawCircle(cx, cy, 14);
            g.beginFill(hex(CFG.amber));
            g.drawCircle(cx, cy, 4);
            g.endFill();
            g.lineStyle(1.5, hex(CFG.amber));
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2;
                g.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
                g.lineTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
            }

            // Header texts
            const modeLabel = this._mode === 'load' ? 'WCZYTAJ NAGRANIE' : 'ZAPISZ NAGRANIE';
            this._addText(modeLabel, true, 18, CFG.cream, this.pX + 52, this.pY + 10);
            this._addText(this._mode === 'load' ? 'wybierz klatkę do odtworzenia' : 'wybierz slot do zapisu', false, 10, CFG.amber + 'aa', this.pX + 53, this.pY + 35);

            // Timecode
            this._tcText = this._addText('00:00:00:00', false, 11, CFG.amber + 'bb', this.pX + this.pW - 115, this.pY + 22);

            // Footer hint
            const hint = this._mode === 'load'
                ? '↑↓ nawiguj   ENTER wybierz   ESC wróć'
                : '↑↓ nawiguj   ENTER zapisz   ESC wróć';
            this._addText(hint, false, 9, CFG.amber + '77', this.pX + 14, this.pY + this.pH - 24);

            // Status text
            this._statusText = this._addText('', false, 9, CFG.amber + '88', this.pX + this.pW - 200, this.pY + this.pH - 24);
        }

        _addText(str, serif, size, color, x, y) {
            const t = new PIXI.Text(str, makeTextStyle(serif, size, color));
            t.x = x; t.y = y;
            this._txts.addChild(t);
            return t;
        }

        _buildSlots() {
            this._slotContainer = new PIXI.Container();
            this._slotContainer.x = this.pX;
            this._slotContainer.y = this.listY;
            this.addChild(this._slotContainer);

            // Mask so slots don't overflow
            const mask = new PIXI.Graphics();
            mask.beginFill(0xffffff);
            mask.drawRect(this.pX, this.listY, this.pW, this.listH);
            mask.endFill();
            this.addChild(mask);
            this._slotContainer.mask = mask;

            this._slotTexts = [];
            this._rebuildSlots();
        }

        _rebuildSlots() {
            this._slotContainer.removeChildren();
            this._slotTexts = [];

            for (let i = 0; i < CFG.maxSlots; i++) {
                const slot = this._buildSlot(i);
                slot.y = i * (this.fH + this.fGap);
                this._slotContainer.addChild(slot);
                this._slotTexts.push(slot);
            }

            this._updateSlotHighlights();
            this._updateScroll();
        }

        _buildSlot(idx) {
            const container = new PIXI.Container();
            const info = this._saveInfo[idx];
            const active = idx === this._cursor;
            const fw = this.pW - 20;

            const g = new PIXI.Graphics();
            container.addChild(g);

            // Perforations
            g.lineStyle(1, hex(scratch));
            g.beginFill(hex(perf));
            g.drawRect(0, 0, this.perfW, this.fH);
            g.endFill();

            g.lineStyle(0);
            g.beginFill(hex(CFG.dark));
            for (let h = 0; h < 3; h++) {
                g.drawRoundedRect(10, 9 + h * 16, 10, 9, 1);
            }
            g.endFill();

            // Frame bg
            g.lineStyle(1, hex(scratch));
            g.beginFill(active ? hex(scratch) : hex(CFG.bg));
            g.drawRect(this.perfW, 0, fw - this.perfW, this.fH);
            g.endFill();

            // Slot number
            const numT = new PIXI.Text(pad(idx + 1, 3), makeTextStyle(false, 9, CFG.amber + '88'));
            numT.x = this.perfW + 8; numT.y = 24;
            container.addChild(numT);

            if (info) {
                // Map name
                const mapName = info.title || ($dataMapInfos && $dataMapInfos[info.mapId] ? $dataMapInfos[info.mapId].name : 'Mapa ' + (info.mapId || '?'));
                const nameT = new PIXI.Text(mapName.toUpperCase(), makeTextStyle(true, 14, active ? CFG.amber : CFG.cream, 2));
                nameT.x = this.perfW + 50; nameT.y = 8;
                container.addChild(nameT);

                // Playtime
                const ptT = new PIXI.Text('czas: ' + formatPlaytime(info.playtime || 0), makeTextStyle(false, 9, CFG.cream + '88'));
                ptT.x = this.perfW + 50; ptT.y = 30;
                container.addChild(ptT);

                // Date
                const dateT = new PIXI.Text(formatDate(info.timestamp), makeTextStyle(false, 9, CFG.amber + '99'));
                dateT.x = this.perfW + 50; dateT.y = 45;
                container.addChild(dateT);

                // Chapter/level if available
                if (info.characters && info.characters.length > 0) {
                    const lvl = 'Lv.' + (info.characters[0].level || '?');
                    const lvlT = new PIXI.Text(lvl, makeTextStyle(false, 9, CFG.cream + '66'));
                    lvlT.x = fw - 60; lvlT.y = 24;
                    container.addChild(lvlT);
                }
            } else {
                // Empty slot
                const emT = new PIXI.Text('— ' + CFG.emptySlotText + ' —', makeTextStyle(false, 11, active ? CFG.amber + 'cc' : CFG.amber + '44'));
                emT.x = this.perfW + 50; emT.y = 22;
                container.addChild(emT);
            }

            // Arrow indicator
            const arr = new PIXI.Graphics();
            arr.lineStyle(1.5, hex(CFG.amber));
            arr.moveTo(0, 0); arr.lineTo(7, 7); arr.lineTo(0, 14);
            arr.x = fw - 20; arr.y = (this.fH - 14) / 2;
            arr.alpha = active ? 1 : 0;
            container.addChild(arr);

            // Splice line
            const sl = new PIXI.Graphics();
            sl.lineStyle(1, hex(CFG.amber), 0.2);
            sl.moveTo(0, this.fH + 1);
            sl.lineTo(fw, this.fH + 1);
            container.addChild(sl);

            return container;
        }

        _updateSlotHighlights() {
            if (!this._slotTexts) return;
            this._slotTexts.forEach((slot, i) => {
                const g = slot.children[0];
                const fw = this.pW - 20;
                const active = i === this._cursor;
                g.clear();

                // Redraw perfs
                g.lineStyle(1, hex(scratch));
                g.beginFill(hex(perf));
                g.drawRect(0, 0, this.perfW, this.fH);
                g.endFill();
                g.lineStyle(0);
                g.beginFill(hex(CFG.dark));
                for (let h = 0; h < 3; h++) {
                    g.drawRoundedRect(10, 9 + h * 16, 10, 9, 1);
                }
                g.endFill();

                // Frame bg
                g.lineStyle(1, hex(scratch));
                g.beginFill(active ? hex(scratch) : hex(CFG.bg));
                g.drawRect(this.perfW, 0, fw - this.perfW, this.fH);
                g.endFill();

                // Update text colors
                slot.children.forEach(child => {
                    if (child instanceof PIXI.Text) {
                        const txt = child.text;
                        if (!txt.match(/^\d{3}$/) && !txt.includes('czas:') && !txt.match(/^\d{4}\./)) {
                            if (!txt.includes(CFG.emptySlotText)) {
                                child.style.fill = active ? CFG.amber : CFG.cream;
                            }
                        }
                    }
                    if (child instanceof PIXI.Graphics && child !== slot.children[0]) {
                        child.alpha = active ? 1 : 0;
                    }
                });
            });
        }

        _drawScrollbar() {
            if (CFG.maxSlots <= CFG.slotsVisible) return;

            const sbX = this.pX + this.pW - 8;
            const sbY = this.listY;
            const sbH = this.listH;

            this._scrollbarBg = new PIXI.Graphics();
            this._scrollbarBg.beginFill(hex(scratch), 0.5);
            this._scrollbarBg.drawRect(sbX, sbY, 4, sbH);
            this._scrollbarBg.endFill();
            this.addChild(this._scrollbarBg);

            this._scrollbarThumb = new PIXI.Graphics();
            this.addChild(this._scrollbarThumb);
            this._updateScrollbar();
        }

        _updateScrollbar() {
            if (!this._scrollbarThumb) return;
            this._scrollbarThumb.clear();

            const ratio  = CFG.slotsVisible / CFG.maxSlots;
            const sbH    = this.listH;
            const thumbH = Math.max(20, sbH * ratio);
            const maxScroll = CFG.maxSlots - CFG.slotsVisible;
            const thumbY = this.listY + (this._scroll / Math.max(1, maxScroll)) * (sbH - thumbH);

            this._scrollbarThumb.beginFill(hex(CFG.amber), 0.6);
            this._scrollbarThumb.drawRect(this.pX + this.pW - 8, thumbY, 4, thumbH);
            this._scrollbarThumb.endFill();
        }

        _updateScroll() {
            const visStart = this._scroll;
            const visEnd   = this._scroll + CFG.slotsVisible - 1;
            if (this._cursor < visStart) this._scroll = this._cursor;
            if (this._cursor > visEnd)   this._scroll = this._cursor - CFG.slotsVisible + 1;
            this._scroll = Math.max(0, Math.min(CFG.maxSlots - CFG.slotsVisible, this._scroll));

            const offsetY = -this._scroll * (this.fH + this.fGap);
            this._slotContainer.y = this.listY + offsetY;

            this._updateScrollbar();
        }

        _buildConfirmDialog() {
            this._confirmContainer = new PIXI.Container();
            this._confirmContainer.visible = false;
            this.addChild(this._confirmContainer);

            const dW = 320, dH = 140;
            const dX = (this.W - dW) / 2;
            const dY = (this.H - dH) / 2;

            const dg = new PIXI.Graphics();
            dg.lineStyle(1, hex(CFG.amber), 0.8);
            dg.beginFill(hex(CFG.dark), 0.97);
            dg.drawRoundedRect(dX, dY, dW, dH, 4);
            dg.endFill();
            this._confirmContainer.addChild(dg);

            const qt = new PIXI.Text('NADPISAĆ TEN SLOT?', makeTextStyle(true, 14, CFG.cream, 2));
            qt.x = dX + dW / 2 - qt.width / 2; qt.y = dY + 20;
            this._confirmContainer.addChild(qt);

            const yt = new PIXI.Text('[ ENTER ]  tak, zapisz', makeTextStyle(false, 11, CFG.amber));
            yt.x = dX + 30; yt.y = dY + 60;
            this._confirmContainer.addChild(yt);

            const nt = new PIXI.Text('[ ESC ]    nie, wróć', makeTextStyle(false, 11, CFG.cream + '88'));
            nt.x = dX + 30; nt.y = dY + 85;
            this._confirmContainer.addChild(nt);
        }

        // --------------------------------------------------
        // Update
        // --------------------------------------------------
        update() {
            if (!this._closing && this.alpha < 1) {
                this.alpha = Math.min(1, this.alpha + 0.05);
            }

            this._tcFrames++;
            const f = this._tcFrames;
            const fps = 24;
            if (this._tcText) {
                this._tcText.text = `${pad(Math.floor(f/fps/3600)%24)}:${pad(Math.floor(f/fps/60)%60)}:${pad(Math.floor(f/fps)%60)}:${pad(f%fps)}`;
            }

            if (this._flashTimer > 0) {
                this._flashTimer--;
                if (this._flashTimer === 0) {
                    this._close();
                }
            }

            if (!this._closing) this._handleInput();
        }

        _handleInput() {
            if (this._inputDelay > 0) { this._inputDelay--; return; }

            if (this._confirmMode) {
                if (Input.isTriggered('ok')) {
                    this._confirmContainer.visible = false;
                    this._confirmMode = false;
                    this._doSave();
                }
                if (Input.isTriggered('cancel') || Input.isTriggered('escape')) {
                    this._confirmContainer.visible = false;
                    this._confirmMode = false;
                    SoundManager.playCancel();
                }
                return;
            }

            if (Input.isTriggered('down')) {
                this._cursor = (this._cursor + 1) % CFG.maxSlots;
                this._onCursorMove();
            }
            if (Input.isTriggered('up')) {
                this._cursor = (this._cursor - 1 + CFG.maxSlots) % CFG.maxSlots;
                this._onCursorMove();
            }

            if (Input.isTriggered('ok')) {
                if (this._mode === 'load') {
                    this._doLoad();
                } else {
                    this._tryDoSave();
                }
            }

            if (Input.isTriggered('cancel') || Input.isTriggered('escape')) {
                SoundManager.playCancel();
                this._close();
            }

            // Touch
            if (TouchInput.isTriggered()) {
                const ty = TouchInput.y;
                const tx = TouchInput.x;
                for (let i = 0; i < CFG.maxSlots; i++) {
                    const slotY = this.listY + (i - this._scroll) * (this.fH + this.fGap);
                    if (ty >= slotY && ty < slotY + this.fH &&
                        tx >= this.pX && tx < this.pX + this.pW) {
                        if (this._cursor === i) {
                            if (this._mode === 'load') this._doLoad();
                            else this._tryDoSave();
                        } else {
                            this._cursor = i;
                            this._onCursorMove();
                        }
                    }
                }
            }
        }

        _onCursorMove() {
            SoundManager.playCursor();
            this._inputDelay = 8;
            this._updateSlotHighlights();
            this._updateScroll();
            const info = this._saveInfo[this._cursor];
            this._statusText.text = info ? 'klatka ' + pad(this._cursor + 1, 3) + ' · zajęta' : 'klatka ' + pad(this._cursor + 1, 3) + ' · pusta';
        }

        _doLoad() {
            const info = this._saveInfo[this._cursor];
            if (!info) {
                SoundManager.playBuzzer();
                return;
            }
            const savefileId = this._cursor + 1;
            DataManager.loadGame(savefileId).then(() => {
                this._scene.onLoadSuccess();
            }).catch(() => {
                SoundManager.playBuzzer();
            });
        }

        _tryDoSave() {
            const info = this._saveInfo[this._cursor];
            if (info && CFG.confirmOverwrite) {
                this._confirmMode = true;
                this._confirmContainer.visible = true;
                SoundManager.playCursor();
            } else {
                this._doSave();
            }
        }

        _doSave() {
            const savefileId = this._cursor + 1;
            $gameSystem.onBeforeSave();
            DataManager.saveGame(savefileId).then(() => {
                this._scene.onSaveSuccess();
                this._loadSaveInfo();
                this._rebuildSlots();
            }).catch(() => {
                this._scene.onSaveFailure();
            });
        }

        flashSuccess() {
            this._flashTimer = 60;
            if (this._statusText) {
                this._statusText.text = 'zapisano · klatka ' + pad(this._cursor + 1, 3);
                this._statusText.style.fill = CFG.amber;
            }
        }

        _close() {
            if (this._closing) return;
            this._closing = true;
            let a = 1;
            const fade = () => {
                a -= 0.07;
                this.alpha = Math.max(0, a);
                if (a > 0) requestAnimationFrame(fade);
                else SceneManager.pop();
            };
            fade();
        }
    }

})();
