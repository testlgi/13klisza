/*:
 * @target MZ
 * @plugindesc Mapa kampusu jako szkic architektoniczny poplamiony kawą. Placeholder.
 * @author Adam
 *
 * @param mapTitle
 * @text Tytuł mapy
 * @type string
 * @default CAMPUS LAYOUT — GROUND FLOOR
 *
 * @param deptName
 * @text Nazwa działu
 * @type string
 * @default FILM & MEDIA ARTS DEPT.
 *
 * @param placeholderNote
 * @text Tekst placeholder
 * @type string
 * @default SZKIC ROBOCZY — v0.3 — DO WERYFIKACJI
 *
 * @param paperColor
 * @text Kolor papieru (hex)
 * @type string
 * @default #f2ead8
 *
 * @param inkColor
 * @text Kolor tuszu (hex)
 * @type string
 * @default #3a2418
 *
 * @param noteColor
 * @text Kolor adnotacji (hex)
 * @type string
 * @default #8b4030
 *
 * @param coffeeColor
 * @text Kolor plam kawy (hex)
 * @type string
 * @default #b89040
 *
 * @command showMap
 * @text Pokaż mapę
 * @desc Wyświetla ekran mapy kampusu.
 *
 * @command hideMap
 * @text Ukryj mapę
 * @desc Zamyka ekran mapy.
 *
 * @help FilmCampusMap.js
 * ============================================================
 * MAPA KAMPUSU — SZKIC ARCHITEKTONICZNY
 * ============================================================
 * Wyświetla placeholder mapy kampusu w stylu szkicu
 * technicznego na pożółkłym papierze z plamami kawy
 * i odręcznymi adnotacjami.
 *
 * Użycie:
 *   Plugin Command → showMap  — otwiera mapę
 *   Plugin Command → hideMap  — zamyka mapę
 *   Gracz naciska ESC/Enter   — zamyka mapę
 *
 * Możesz też wywołać przez skrypt:
 *   SceneManager.push(Scene_CampusMap);
 * ============================================================
 */

(() => {
    'use strict';

    const PLUGIN_NAME = 'FilmCampusMap';
    const raw = PluginManager.parameters(PLUGIN_NAME);

    const CFG = {
        title:       String(raw.mapTitle        || 'CAMPUS LAYOUT — GROUND FLOOR'),
        dept:        String(raw.deptName        || 'FILM & MEDIA ARTS DEPT.'),
        placeholder: String(raw.placeholderNote || 'SZKIC ROBOCZY — v0.3 — DO WERYFIKACJI'),
        paper:       String(raw.paperColor      || '#f2ead8'),
        ink:         String(raw.inkColor        || '#3a2418'),
        note:        String(raw.noteColor       || '#8b4030'),
        coffee:      String(raw.coffeeColor     || '#b89040'),
    };

    // Plugin commands
    PluginManager.registerCommand(PLUGIN_NAME, 'showMap', () => {
        SceneManager.push(Scene_CampusMap);
    });
    PluginManager.registerCommand(PLUGIN_NAME, 'hideMap', () => {
        if (SceneManager._scene instanceof Scene_CampusMap) {
            SceneManager.pop();
        }
    });

    // -------------------------------------------------------
    // Scene_CampusMap
    // -------------------------------------------------------
    class Scene_CampusMap extends Scene_Base {
        create() {
            super.create();
            this._mapSprite = new CampusMapSprite();
            this.addChild(this._mapSprite);
        }

        start() {
            super.start();
            this.startFadeIn(this.fadeSpeed(), false);
        }

        update() {
            super.update();
            if (this._mapSprite) this._mapSprite.update();
            if (Input.isTriggered('cancel') || Input.isTriggered('ok') || TouchInput.isTriggered()) {
                SoundManager.playCancel();
                this.popScene();
            }
        }

        isBusy() { return super.isBusy(); }
    }

    window.Scene_CampusMap = Scene_CampusMap;

    // -------------------------------------------------------
    // CampusMapSprite — draws everything
    // -------------------------------------------------------
    class CampusMapSprite extends PIXI.Container {
        constructor() {
            super();
            this._tcF = 0;
            this._build();
        }

        get W() { return Graphics.width; }
        get H() { return Graphics.height; }

        _build() {
            // Paper bitmap
            const bm = new Bitmap(this.W, this.H);
            this._paper = new Sprite(bm);
            this.addChild(this._paper);
            this._bm = bm;

            this._drawAll();
            this._buildHint();
        }

        _drawAll() {
            const bm = this._bm;
            const W = this.W, H = this.H;

            // === PAPER BACKGROUND ===
            bm.fillRect(0, 0, W, H, CFG.paper);

            // Grid lines
            for (let gx = 0; gx < W; gx += 20) {
                bm.fillRect(gx, 0, 1, H, 'rgba(120,90,60,0.09)');
            }
            for (let gy = 0; gy < H; gy += 20) {
                bm.fillRect(0, gy, W, 1, 'rgba(120,90,60,0.09)');
            }

            // === COFFEE STAINS ===
            this._drawCoffeeStain(bm, W * 0.77, H * 0.16, 68, 56);
            this._drawCoffeeStain(bm, W * 0.13, H * 0.82, 52, 44);
            this._drawCoffeeRing(bm, W * 0.77, H * 0.16, 54, 46);
            this._drawCoffeeRing(bm, W * 0.13, H * 0.82, 40, 33);
            // small drip
            this._drawCoffeeRing(bm, W * 0.46, H * 0.93, 18, 13);

            // === TITLE BLOCK ===
            this._drawTitleBlock(bm, W, H);

            // === BUILDINGS ===
            const mX = W * 0.34, mY = H * 0.30;
            const mW = W * 0.30, mH = H * 0.28;
            this._drawBuilding(bm, mX, mY, mW, mH, 'BUDYNEK GŁÓWNY', '[A]', true);

            const bX = W * 0.12, bY = H * 0.54;
            this._drawBuilding(bm, bX, bY, W * 0.18, H * 0.18, 'SALA MONTAŻOWA', '[B-01]', false);

            const sX = W * 0.65, sY = H * 0.56;
            this._drawBuilding(bm, sX, sY, W * 0.20, H * 0.20, 'STUDIO NAGRAŃ', '[C-02]', false, true);

            const aX = W * 0.67, aY = H * 0.14;
            this._drawBuilding(bm, aX, aY, W * 0.17, H * 0.15, 'ARCHIWUM TAŚM', '[D-03]', false);

            const kX = W * 0.11, kY = H * 0.18;
            this._drawBuilding(bm, kX, kY, W * 0.17, H * 0.14, 'KANTYNA', '[E-04]', false, false, true);

            // === CORRIDORS ===
            bm.fillRect(W * 0.12, H * 0.47, W * 0.60, H * 0.03, 'rgba(180,155,110,0.35)');
            bm.fillRect(mX + mW * 0.4, mY, mW * 0.2, H * 0.30 - H * 0.30 + mY - H * 0.02, 'rgba(180,155,110,0.25)');

            // paths
            bm.fillRect(W * 0.64, H * 0.30, W * 0.04, H * 0.02, 'rgba(170,145,105,0.3)');
            bm.fillRect(W * 0.28, H * 0.30, W * 0.06, H * 0.02, 'rgba(170,145,105,0.3)');
            bm.fillRect(W * 0.64, H * 0.58, W * 0.04, H * 0.02, 'rgba(170,145,105,0.3)');
            bm.fillRect(W * 0.30, H * 0.58, W * 0.05, H * 0.02, 'rgba(170,145,105,0.3)');

            // === ANNOTATIONS ===
            this._drawAnnotation(bm, W * 0.06, H * 0.17, '← kawa tutaj!', -3);
            this._drawAnnotation(bm, W * 0.63, H * 0.27, 'wejście od tyłu?', 2);
            this._drawAnnotation(bm, W * 0.67, H * 0.12, 'zamknięte po 18!', -1);
            this._drawAnnotation(bm, W * 0.65, H * 0.53, 'dobre echo →', 1.5);
            this._drawAnnotation(bm, W * 0.43, H * 0.45, '?', -5, 20);

            // === LEGEND ===
            this._drawLegend(bm, W, H);

            // === NORTH ARROW ===
            this._drawNorthArrow(bm, W * 0.94, H * 0.08);

            // === SCALE BAR ===
            this._drawScaleBar(bm, W * 0.80, H * 0.93);

            // === FOLD CREASE ===
            bm.fillRect(W * 0.88, 0, 1, H * 0.06, 'rgba(100,80,50,0.15)');
        }

        _drawCoffeeStain(bm, cx, cy, rx, ry) {
            // Approximate ellipse with fillRect slices
            for (let dy = -ry; dy <= ry; dy += 2) {
                const ratio = Math.sqrt(1 - (dy*dy)/(ry*ry));
                const w = rx * ratio * 2;
                bm.fillRect(cx - w/2, cy + dy, w, 2, 'rgba(160,110,30,0.07)');
            }
        }

        _drawCoffeeRing(bm, cx, cy, r1, r2) {
            // Approximate ring
            for (let dy = -r1; dy <= r1; dy += 1) {
                const outer = Math.sqrt(Math.max(0, r1*r1 - dy*dy));
                const inner = Math.sqrt(Math.max(0, r2*r2 - dy*dy));
                if (outer > 0) {
                    bm.fillRect(cx - outer, cy + dy, outer - inner, 1.5, 'rgba(100,60,10,0.13)');
                    bm.fillRect(cx + inner, cy + dy, outer - inner, 1.5, 'rgba(100,60,10,0.13)');
                }
            }
        }

        _drawTitleBlock(bm, W, H) {
            const tx = 30, ty = 20, tw = W * 0.38, th = 52;
            // border
            for (let i = 0; i < 2; i++) {
                bm.fillRect(tx + i, ty + i, tw - i*2, 1, 'rgba(80,55,35,0.45)');
                bm.fillRect(tx + i, ty + th - i, tw - i*2, 1, 'rgba(80,55,35,0.45)');
                bm.fillRect(tx + i, ty + i, 1, th - i*2, 'rgba(80,55,35,0.45)');
                bm.fillRect(tx + tw - i, ty + i, 1, th - i*2, 'rgba(80,55,35,0.45)');
            }
            // header stripe
            bm.fillRect(tx + 1, ty + 1, tw - 2, 14, 'rgba(80,55,35,0.07)');

            bm.fontFace = '"Courier New", Courier, monospace';
            bm.fontSize = 9;
            bm.outlineWidth = 0;
            bm.textColor = 'rgba(80,55,35,0.7)';
            bm.drawText(CFG.title, tx + 6, ty + 2, tw - 12, 12, 'left');

            bm.fontSize = 13;
            bm.textColor = CFG.ink;
            bm.fontBold = true;
            bm.drawText(CFG.dept, tx + 6, ty + 16, tw - 12, 18, 'left');
            bm.fontBold = false;

            bm.fontSize = 8;
            bm.textColor = 'rgba(100,75,50,0.75)';
            bm.drawText(CFG.placeholder, tx + 6, ty + 36, tw - 12, 14, 'left');
        }

        _drawBuilding(bm, x, y, w, h, name, code, main, hatched, dashed) {
            // Fill
            bm.fillRect(x, y, w, h, 'rgba(195,175,140,0.22)');

            // Border
            if (dashed) {
                // dashed border approximation
                for (let i = 0; i < w; i += 8) {
                    bm.fillRect(x + i, y, Math.min(5, w - i), 1.5, 'rgba(55,30,18,0.65)');
                    bm.fillRect(x + i, y + h, Math.min(5, w - i), 1.5, 'rgba(55,30,18,0.65)');
                }
                for (let i = 0; i < h; i += 8) {
                    bm.fillRect(x, y + i, 1.5, Math.min(5, h - i), 'rgba(55,30,18,0.65)');
                    bm.fillRect(x + w, y + i, 1.5, Math.min(5, h - i), 'rgba(55,30,18,0.65)');
                }
            } else {
                bm.fillRect(x, y, w, 2, 'rgba(55,30,18,0.72)');
                bm.fillRect(x, y + h, w, 2, 'rgba(55,30,18,0.72)');
                bm.fillRect(x, y, 2, h, 'rgba(55,30,18,0.72)');
                bm.fillRect(x + w, y, 2, h + 2, 'rgba(55,30,18,0.72)');
            }

            // Hatch lines (horizontal for main, diagonal for hatched)
            if (main) {
                for (let ly = y + 14; ly < y + h - 4; ly += 14) {
                    bm.fillRect(x + 3, ly, w - 6, 0.5, 'rgba(100,80,50,0.35)');
                }
            }
            if (hatched) {
                for (let d = -h; d < w + h; d += 18) {
                    const x1 = x + Math.max(0, d);
                    const y1 = y + Math.max(0, -d);
                    const x2 = x + Math.min(w, d + h);
                    const y2 = y + Math.min(h, h - d);
                    if (x2 > x1) {
                        const steps = Math.abs(x2 - x1);
                        for (let s = 0; s < steps; s++) {
                            const px = x1 + s;
                            const py = y1 + (s / steps) * (y2 - y1);
                            bm.fillRect(px, py, 1, 1, 'rgba(100,80,50,0.28)');
                        }
                    }
                }
            }

            // Name text
            bm.fontFace = '"Courier New", Courier, monospace';
            bm.outlineWidth = 0;
            bm.fontBold = true;
            bm.fontSize = main ? 12 : 10;
            bm.textColor = CFG.ink;
            bm.drawText(name, x + 4, y + h * 0.35, w - 8, main ? 16 : 14, 'center');
            bm.fontBold = false;
            bm.fontSize = 8;
            bm.textColor = 'rgba(90,60,35,0.75)';
            bm.drawText(code, x + 4, y + h * 0.62, w - 8, 12, 'center');

            // Door
            const doorW = 22, doorH = 4;
            const doorX = x + w * 0.4;
            bm.fillRect(doorX, y + h, doorW, doorH, CFG.paper);
            bm.fillRect(doorX, y + h, doorW, 1, CFG.ink + 'aa');
            bm.fillRect(doorX, y + h + doorH, doorW, 1, CFG.ink + 'aa');
            bm.fillRect(doorX, y + h, 1, doorH, CFG.ink + 'aa');
            bm.fillRect(doorX + doorW, y + h, 1, doorH, CFG.ink + 'aa');
        }

        _drawAnnotation(bm, x, y, text, angle, size) {
            bm.fontFace = '"Courier New", Courier, monospace';
            bm.fontSize = size || 9;
            bm.outlineWidth = 0;
            bm.textColor = CFG.note;
            // RPG Maker Bitmap doesn't support rotate, so we draw normally
            // angle is just visual flavor in description
            bm.drawText(text, x, y, 200, 14, 'left');
        }

        _drawLegend(bm, W, H) {
            const lx = 30, ly = H * 0.75, lw = 165, lh = 100;
            bm.fillRect(lx, ly, lw, lh, 'rgba(225,210,180,0.75)');
            bm.fillRect(lx, ly, lw, 2, 'rgba(120,90,60,0.5)');
            bm.fillRect(lx, ly + lh, lw, 1, 'rgba(120,90,60,0.4)');
            bm.fillRect(lx, ly, 1, lh, 'rgba(120,90,60,0.4)');
            bm.fillRect(lx + lw, ly, 1, lh, 'rgba(120,90,60,0.4)');

            bm.fontFace = '"Courier New", Courier, monospace';
            bm.outlineWidth = 0;
            bm.fontBold = true;
            bm.fontSize = 9;
            bm.textColor = CFG.ink;
            bm.drawText('LEGENDA', lx + 8, ly + 4, 80, 12, 'left');
            bm.fontBold = false;

            // line under title
            bm.fillRect(lx + 2, ly + 16, lw - 4, 0.5, 'rgba(120,90,60,0.5)');

            const items = [
                { y: 0, label: 'budynek' },
                { y: 16, label: 'niezatwierdzone' },
                { y: 32, label: 'korytarz / droga' },
                { y: 48, label: 'drzwi' },
            ];

            items.forEach((item, i) => {
                const iy = ly + 20 + item.y;
                // icon
                bm.fillRect(lx + 8, iy, 12, 8, 'rgba(180,155,110,0.2)');
                bm.fillRect(lx + 8, iy, 12, 1, CFG.ink + 'bb');
                bm.fillRect(lx + 8, iy + 8, 12, 1, CFG.ink + 'bb');
                bm.fillRect(lx + 8, iy, 1, 8, CFG.ink + 'bb');
                bm.fillRect(lx + 20, iy, 1, 8, CFG.ink + 'bb');
                bm.fontSize = 8;
                bm.textColor = CFG.ink;
                bm.drawText(item.label, lx + 26, iy, 130, 12, 'left');
            });

            // placeholder stamp
            bm.fontSize = 8;
            bm.textColor = CFG.note + 'cc';
            bm.drawText('placeholder v1', lx + 8, ly + lh - 16, lw - 16, 12, 'left');
        }

        _drawNorthArrow(bm, cx, cy) {
            // arrow up
            bm.fillRect(cx, cy - 20, 2, 22, 'rgba(55,30,18,0.65)');
            // arrowhead
            bm.fillRect(cx - 6, cy - 18, 6, 2, 'rgba(55,30,18,0.65)');
            bm.fillRect(cx + 2, cy - 18, 6, 2, 'rgba(55,30,18,0.65)');
            bm.fillRect(cx - 4, cy - 22, 4, 2, 'rgba(55,30,18,0.65)');
            bm.fillRect(cx + 2, cy - 22, 4, 2, 'rgba(55,30,18,0.65)');
            bm.fontFace = '"Courier New", Courier, monospace';
            bm.fontSize = 11;
            bm.fontBold = true;
            bm.outlineWidth = 0;
            bm.textColor = 'rgba(55,30,18,0.7)';
            bm.drawText('N', cx - 4, cy + 4, 20, 16, 'center');
            bm.fontBold = false;
        }

        _drawScaleBar(bm, x, y) {
            bm.fillRect(x, y, 80, 1.5, 'rgba(80,55,35,0.6)');
            bm.fillRect(x, y - 5, 1.5, 10, 'rgba(80,55,35,0.6)');
            bm.fillRect(x + 40, y - 3, 1.5, 8, 'rgba(80,55,35,0.6)');
            bm.fillRect(x + 80, y - 5, 1.5, 10, 'rgba(80,55,35,0.6)');
            bm.fontFace = '"Courier New", Courier, monospace';
            bm.fontSize = 8;
            bm.outlineWidth = 0;
            bm.textColor = 'rgba(80,55,35,0.65)';
            bm.drawText('0        50m', x + 4, y + 4, 90, 12, 'left');
        }

        _buildHint() {
            const hint = new Bitmap(this.W, 30);
            hint.fontFace = '"Courier New", Courier, monospace';
            hint.fontSize = 12;
            hint.outlineWidth = 0;
            hint.textColor = 'rgba(100,70,40,0.7)';
            hint.drawText('[ ENTER / ESC ]  zamknij mapę', 0, 4, this.W, 20, 'center');
            this._hintSprite = new Sprite(hint);
            this._hintSprite.y = this.H - 32;
            this.addChild(this._hintSprite);
        }

        update() {
            this._tcF++;
            // subtle hint blink
            if (this._hintSprite) {
                this._hintSprite.opacity = 150 + Math.floor(Math.sin(this._tcF * 0.05) * 80);
            }
        }
    }

})();
