/*:
 * @target MZ
 * @plugindesc Okno dialogów w stylu skryptu scenariusza z adnotacjami reżyserskimi.
 * @author Adam
 *
 * @param colorPaper
 * @text Kolor papieru (tło)
 * @type string
 * @default #f5f0e8
 *
 * @param colorInk
 * @text Kolor tekstu (atrament)
 * @type string
 * @default #1a1410
 *
 * @param colorNote
 * @text Kolor adnotacji reżyserskiej
 * @type string
 * @default #8b4513
 *
 * @param colorSpeaker
 * @text Kolor imienia mówiącego
 * @type string
 * @default #2c1810
 *
 * @param fontSize
 * @text Rozmiar czcionki dialogu
 * @type number
 * @default 18
 *
 * @param windowHeight
 * @text Wysokość okna dialogu
 * @type number
 * @default 180
 *
 * @param showLineNumbers
 * @text Pokazuj numery linii (jak w skrypcie)
 * @type boolean
 * @default true
 *
 * @param directionKeyword
 * @text Keyword adnotacji (np. [ )
 * @type string
 * @default [
 *
 * @help FilmScreenplay.js
 * ============================================================
 * DIALOGI — SKRYPT SCENARIUSZA
 * ============================================================
 * Zamienia okno dialogów w RPG Maker MZ na styl
 * skryptu filmowego:
 *   - Tło jak żółknący papier maszynopisu
 *   - Czcionka Courier New (monospace)
 *   - Imię postaci wyśrodkowane WIELKIMI LITERAMI
 *   - Adnotacje reżyserskie w nawiasach [] w innym kolorze
 *   - Numery linii na marginesie
 *   - Pionowa linia marginesu po lewej
 *
 * Adnotacje reżyserskie wstawiasz normalnie w tekście:
 *   [z ironią] Tak, jasne. Oczywiście.
 *   To jest koniec. [płacząc] Żegnaj.
 *
 * ============================================================
 */

(() => {
    'use strict';

    const PLUGIN_NAME = 'FilmScreenplay';
    const raw = PluginManager.parameters(PLUGIN_NAME);

    const CFG = {
        paper:       String(raw.colorPaper    || '#f5f0e8'),
        ink:         String(raw.colorInk      || '#1a1410'),
        note:        String(raw.colorNote     || '#8b4513'),
        speaker:     String(raw.colorSpeaker  || '#2c1810'),
        fontSize:    Number(raw.fontSize)     || 18,
        winHeight:   Number(raw.windowHeight) || 180,
        lineNums:    raw.showLineNumbers !== 'false',
        dirKey:      String(raw.directionKeyword || '['),
    };

    // Global line counter (resets each scene load)
    let _lineCounter = 1;
    const _alias_Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _lineCounter = 1;
        _alias_Scene_Map_start.call(this);
    };

    // -------------------------------------------------------
    // Window_Message overrides
    // -------------------------------------------------------

    const _alias_initialize = Window_Message.prototype.initialize;
    Window_Message.prototype.initialize = function(rect) {
        _alias_initialize.call(this, rect);
        this._screenplayLineNum = _lineCounter;
    };

    // Override window dimensions and position
    const _alias_updatePlacement = Window_Message.prototype.updatePlacement;
    Window_Message.prototype.updatePlacement = function() {
        _alias_updatePlacement.call(this);
        // Keep width full, adjust height
        this.width  = Graphics.boxWidth;
        this.height = CFG.winHeight + 20;
        this.x      = 0;
        // Position: bottom of screen
        if (this._positionType === 0) {
            this.y = 0;
        } else if (this._positionType === 2) {
            this.y = Graphics.boxHeight - this.height;
        } else {
            this.y = (Graphics.boxHeight - this.height) / 2;
        }
    };

    // Override background — always use paper style
    Window_Message.prototype.updateBackgroundType = function() {
        this.opacity = 255;
        this.backOpacity = 255;
    };

    // Override the entire paint method for screenplay look
    const _alias_refresh = Window_Message.prototype._refreshAllParts;
    Window_Message.prototype._refreshAllParts = function() {
        _alias_refresh.call(this);
        this._drawPaperBackground();
    };

    Window_Message.prototype._drawPaperBackground = function() {
        // Will be called via drawBackground override
    };

    // -------------------------------------------------------
    // Core: override drawBackground in the bitmap
    // -------------------------------------------------------
    const _alias_open = Window_Message.prototype.open;
    Window_Message.prototype.open = function() {
        _alias_open.call(this);
        this._screenplayLineNum = _lineCounter;
    };

    // -------------------------------------------------------
    // Text rendering override
    // -------------------------------------------------------
    const _alias_startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function() {
        this._screenplayLineNum = _lineCounter;
        _lineCounter++;
        _alias_startMessage.call(this);
    };

    // Override contentsBack to draw paper
    const _alias_createContents = Window_Message.prototype.createContents;
    Window_Message.prototype.createContents = function() {
        _alias_createContents.call(this);
        this._drawScreenplayBg();
    };

    Window_Message.prototype._drawScreenplayBg = function() {
        const bm = this.contentsBack;
        if (!bm) return;
        bm.clear();

        const W = bm.width, H = bm.height;

        // Paper background with slight texture feel
        bm.fillRect(0, 0, W, H, CFG.paper);

        // Aged paper grain - subtle darker strip at top
        bm.fillRect(0, 0, W, 2, 'rgba(0,0,0,0.06)');

        // Left margin line (red/brown like a real screenplay)
        const marginX = CFG.lineNums ? 64 : 20;
        bm.fillRect(marginX, 0, 1, H, '#c0392b44');

        // Horizontal rule at top (separator from game world)
        bm.fillRect(0, 0, W, 1, 'rgba(0,0,0,0.15)');
        bm.fillRect(0, H-1, W, 1, 'rgba(0,0,0,0.1)');

        // Subtle paper lines (like ruled paper, very faint)
        const lineH = CFG.fontSize + 6;
        let ly = lineH;
        while (ly < H - 10) {
            bm.fillRect(marginX + 2, ly, W - marginX - 4, 1, 'rgba(0,0,0,0.04)');
            ly += lineH;
        }
    };

    // -------------------------------------------------------
    // Override how text is drawn — screenplay style
    // -------------------------------------------------------
    const _alias_newPage = Window_Message.prototype.newPage;
    Window_Message.prototype.newPage = function(textState) {
        _alias_newPage.call(this, textState);
        this._drawScreenplayBg();
        this._drawLineNumber();
    };

    Window_Message.prototype._drawLineNumber = function() {
        if (!CFG.lineNums) return;
        const bm = this.contents;
        if (!bm) return;
        bm.fontFace    = '"Courier New", Courier, monospace';
        bm.fontSize    = 11;
        bm.textColor   = '#c0392b88';
        bm.outlineWidth = 0;
        bm.drawText(String(this._screenplayLineNum).padStart(3,' '), 2, 4, 56, 20, 'right');
    };

    // -------------------------------------------------------
    // Override drawItemName (speaker name window)
    // -------------------------------------------------------
    const _alias_Window_NameBox_refresh = Window_NameBox.prototype.refresh;
    Window_NameBox.prototype.refresh = function() {
        this.hide(); // Hide default name box — we draw it ourselves
    };

    // Draw speaker name inside message window, screenplay style
    const _alias_drawMessageFace = Window_Message.prototype.drawMessageFace;
    Window_Message.prototype.drawMessageFace = function() {
        _alias_drawMessageFace.call(this);
        this._drawScreenplaySpeaker();
    };

    Window_Message.prototype._drawScreenplaySpeaker = function() {
        const name = $gameMessage.speakerName ? $gameMessage.speakerName() : '';
        if (!name) return;

        const bm   = this.contents;
        const marginX = CFG.lineNums ? 68 : 24;
        const W    = bm.width - marginX - 10;

        bm.fontFace     = '"Courier New", Courier, monospace';
        bm.fontSize     = CFG.fontSize - 1;
        bm.textColor    = CFG.speaker;
        bm.fontBold     = true;
        bm.outlineWidth = 0;
        bm.outlineColor = 'rgba(0,0,0,0)';
        bm.drawText(name.toUpperCase(), marginX, 2, W, CFG.fontSize + 4, 'center');
        bm.fontBold     = false;

        // Underline under name
        bm.fillRect(marginX + Math.floor(W/2) - 60, CFG.fontSize + 5, 120, 1, CFG.speaker + '66');
    };

    // -------------------------------------------------------
    // Override processNormalCharacter to use Courier New
    // -------------------------------------------------------
    const _alias_resetFontSettings = Window_Message.prototype.resetFontSettings;
    Window_Message.prototype.resetFontSettings = function() {
        _alias_resetFontSettings.call(this);
        this.contents.fontFace     = '"Courier New", Courier, monospace';
        this.contents.fontSize     = CFG.fontSize;
        this.contents.textColor    = CFG.ink;
        this.contents.outlineWidth = 0;
        this.contents.outlineColor = 'rgba(0,0,0,0)';
    };

    // -------------------------------------------------------
    // Text pre-processing: detect [adnotacja] and color them
    // -------------------------------------------------------
    const _alias_convertEscapeCharacters = Window_Message.prototype.convertEscapeCharacters;
    Window_Message.prototype.convertEscapeCharacters = function(text) {
        // Convert [text] to colored escape sequence for director notes
        text = text.replace(/\[([^\]]+)\]/g, (match, inner) => {
            return `\x1bC[screenplay_note]\[${inner}\]\x1bC[screenplay_reset]`;
        });
        return _alias_convertEscapeCharacters.call(this, text);
    };

    // Override obtainEscapeParam to handle our custom color codes
    const _alias_processEscapeCharacter = Window_Message.prototype.processEscapeCharacter;
    Window_Message.prototype.processEscapeCharacter = function(code, textState) {
        if (code === 'C') {
            // Check for our custom tags
            const raw2 = textState.text.slice(textState.index);
            const m = raw2.match(/^\[screenplay_(\w+)\]/);
            if (m) {
                textState.index += m[0].length;
                if (m[1] === 'note') {
                    this.changeTextColor(CFG.note);
                    this.contents.fontItalic = true;
                } else if (m[1] === 'reset') {
                    this.changeTextColor(CFG.ink);
                    this.contents.fontItalic = false;
                }
                return;
            }
        }
        _alias_processEscapeCharacter.call(this, code, textState);
    };

    // -------------------------------------------------------
    // Override text start X to respect screenplay margin
    // -------------------------------------------------------
    const _alias_newLineX = Window_Message.prototype.newLineX;
    Window_Message.prototype.newLineX = function(textState) {
        const base = _alias_newLineX.call(this, textState);
        const marginX = CFG.lineNums ? 68 : 24;
        // If face is shown, keep original; otherwise add margin
        if ($gameMessage.faceName() !== '') return base;
        return Math.max(base, marginX);
    };

    // -------------------------------------------------------
    // Adjust content area Y to leave room for speaker name
    // -------------------------------------------------------
    const _alias_textAreaRect = Window_Message.prototype.textAreaRect;
    Window_Message.prototype.textAreaRect = function() {
        const rect = _alias_textAreaRect.call(this);
        const speakerOffset = $gameMessage.speakerName && $gameMessage.speakerName() ? CFG.fontSize + 10 : 0;
        rect.y      += speakerOffset;
        rect.height -= speakerOffset;
        return rect;
    };

    // -------------------------------------------------------
    // Style the choice window as screenplay too
    // -------------------------------------------------------
    const _alias_Window_ChoiceList_makeCommandList = Window_ChoiceList.prototype.makeCommandList;
    Window_ChoiceList.prototype.makeCommandList = function() {
        _alias_Window_ChoiceList_makeCommandList.call(this);
    };

    Window_ChoiceList.prototype.drawItem = function(index) {
        const rect = this.itemLineRect(index);
        const bm   = this.contents;
        bm.fontFace     = '"Courier New", Courier, monospace';
        bm.fontSize     = CFG.fontSize - 1;
        bm.outlineWidth = 0;
        bm.outlineColor = 'rgba(0,0,0,0)';

        const isSelected = index === this.index();
        bm.textColor = isSelected ? CFG.note : CFG.ink;

        const prefix = isSelected ? '> ' : '  ';
        this.drawTextEx(prefix + this.commandName(index), rect.x + 4, rect.y, rect.width - 8);
    };

    // Choice window background — paper style
    const _alias_choiceList_open = Window_ChoiceList.prototype.open;
    Window_ChoiceList.prototype.open = function() {
        _alias_choiceList_open.call(this);
        this._drawChoiceBg();
    };

    Window_ChoiceList.prototype._drawChoiceBg = function() {
        if (!this.contentsBack) return;
        const bm = this.contentsBack;
        bm.fillRect(0, 0, bm.width, bm.height, CFG.paper);
        bm.fillRect(0, 0, 1, bm.height, '#c0392b44');
    };

    const _alias_choiceRefresh = Window_ChoiceList.prototype.refresh;
    Window_ChoiceList.prototype.refresh = function() {
        _alias_choiceRefresh.call(this);
        this._drawChoiceBg();
    };

})();
