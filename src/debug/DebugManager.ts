import Phaser from 'phaser';

interface DebugRecord {
  textureKey: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  displayWidth: number;
  displayHeight: number;
  depth: number;
  fontSize?: number;
  wrapWidth?: number;
  fontColor?: string;
  isText?: boolean;
}

type DraggableGO = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite
                 | Phaser.GameObjects.Text  | Phaser.GameObjects.BitmapText
                 | Phaser.GameObjects.Container
                 | Phaser.GameObjects.Rectangle;

interface UndoEntry {
  obj: DraggableGO;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  depth: number;
  fontSize?: number;
  wrapWidth?: number;
  fontColor?: string;
  rectW?: number;
  rectH?: number;
}

const GAME_W = 800;
const GAME_H = 600;

class DebugManagerSingleton {
  private readonly records             = new Map<DraggableGO, DebugRecord>();
  private readonly _undoStack: UndoEntry[] = [];
  private readonly _newlyInteractive   = new Set<DraggableGO>();
  private readonly _savedPD            = new Map<Phaser.GameObjects.GameObject, Function[]>();

  private _allDraggable: DraggableGO[] = [];
  private _selected:    DraggableGO | null = null;
  private _dragScene:   Phaser.Scene | null = null;
  private _inputScene:  Phaser.Scene | null = null;
  private _dragEnabled = false;
  private _lastClickX  = -10000;
  private _lastClickY  = -10000;
  private _blockRect:  Phaser.GameObjects.Rectangle | null = null;

  // Manual drag state
  private _manualDragging  = false;
  private _dragStartWorldX = 0;
  private _dragStartWorldY = 0;
  private _dragObjStartX   = 0;
  private _dragObjStartY   = 0;

  // Event listener refs for clean removal
  private _onPointerDown:    ((p: Phaser.Input.Pointer) => void) | null = null;
  private _onManualDragDown: ((p: Phaser.Input.Pointer) => void) | null = null;
  private _onPointerMove:    ((p: Phaser.Input.Pointer) => void) | null = null;
  private _onPointerUp:      (() => void) | null = null;

  get isDragEnabled() { return this._dragEnabled; }
  get selectedRecord(): DebugRecord | undefined {
    return this._selected ? this.records.get(this._selected) : undefined;
  }

  injectDrag(scene: Phaser.Scene, inputScene?: Phaser.Scene): void {
    this._dragScene   = scene;
    this._inputScene  = inputScene ?? scene;
    this._dragEnabled = true;
    this.records.clear();
    this._selected = null;
    this._undoStack.length = 0;
    this._newlyInteractive.clear();
    this._savedPD.clear();
    this._lastClickX = this._lastClickY = -10000;
    this._manualDragging = false;

    const objs = this.collectObjects(scene.children.list)
      .filter(o => !this.isBackground(o));
    this._allDraggable = objs;
    objs.forEach(obj => { this._setupObj(obj); this.snapshot(obj); });

    // Transparent full-screen rect at max depth blocks all game-object input events.
    // Scene-level listeners (pointerdown/move/up) still fire normally.
    this._blockRect = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0)
      .setDepth(999999).setScrollFactor(0).setInteractive();

    // Selection cycling: click without Ctrl selects object under cursor.
    // Scans fresh each click to catch objects created after injectDrag().
    this._onPointerDown = (pointer) => {
      if ((pointer.event as MouseEvent)?.ctrlKey) return;
      const cam = scene.cameras.main;
      const wx = cam.scrollX + pointer.x / cam.zoom;
      const wy = cam.scrollY + pointer.y / cam.zoom;

      const fresh = this.collectObjects(scene.children.list).filter(o => !this.isBackground(o));
      fresh.forEach(obj => {
        if (!this._allDraggable.includes(obj)) {
          this._setupObj(obj);
          this._allDraggable.push(obj);
          this.snapshot(obj);
        }
      });

      // For scrollFactor=0 objects (HUD), bounds are in screen-space not world-space.
      // Use screen coords (pointer.x/zoom) for those, world coords for the rest.
      const sx = pointer.x / cam.zoom;
      const sy = pointer.y / cam.zoom;
      const hits = fresh
        .filter(o => {
          if (!o.active || !o.scene) return false;
          try {
            const sf = (o as any).scrollFactorX ?? (o.parentContainer as any)?.scrollFactorX ?? 1;
            const hx = sf === 0 ? sx : wx;
            const hy = sf === 0 ? sy : wy;
            return o.getBounds().contains(hx, hy);
          } catch { return false; }
        })
        .sort((a, b) => {
          if (b.depth !== a.depth) return b.depth - a.depth;
          const idxA = scene.children.getIndex(
            a instanceof Phaser.GameObjects.Container ? a : (a.parentContainer ?? a)
          );
          const idxB = scene.children.getIndex(
            b instanceof Phaser.GameObjects.Container ? b : (b.parentContainer ?? b)
          );
          return idxB - idxA;
        });

      if (hits.length === 0) return;

      const nearSame = Math.abs(wx - this._lastClickX) < 8 && Math.abs(wy - this._lastClickY) < 8;
      this._lastClickX = wx;
      this._lastClickY = wy;

      if (nearSame && this._selected && hits.length > 1) {
        const idx = hits.indexOf(this._selected);
        this.select(hits[(idx + 1) % hits.length], scene);
      } else {
        this.select(hits[0], scene);
      }
    };

    // Manual drag: Ctrl + pointerdown over _selected starts drag
    this._onManualDragDown = (pointer) => {
      if (!(pointer.event as MouseEvent)?.ctrlKey) return;
      if (!this._selected?.active) return;
      const cam2 = scene.cameras.main;
      const sf2  = (this._selected as any).scrollFactorX
                ?? (this._selected.parentContainer as any)?.scrollFactorX ?? 1;
      const wx2  = sf2 === 0 ? pointer.x / cam2.zoom : cam2.scrollX + pointer.x / cam2.zoom;
      const wy2  = sf2 === 0 ? pointer.y / cam2.zoom : cam2.scrollY + pointer.y / cam2.zoom;
      let inBounds = false;
      try { inBounds = this._selected.getBounds().contains(wx2, wy2); } catch {}
      if (!inBounds) return;
      this._undoStack.push({
        obj: this._selected,
        x: this._selected.x, y: this._selected.y,
        scaleX: this._selected.scaleX, scaleY: this._selected.scaleY,
        depth: this._selected.depth,
      });
      this._manualDragging  = true;
      this._dragStartWorldX = wx2;
      this._dragStartWorldY = wy2;
      this._dragObjStartX   = this._selected.x;
      this._dragObjStartY   = this._selected.y;
    };

    // Manual drag: move _selected while Ctrl held
    this._onPointerMove = (pointer) => {
      if (!this._manualDragging || !this._selected) return;
      if (!(pointer.event as MouseEvent)?.ctrlKey) { this._manualDragging = false; return; }
      const cam3 = scene.cameras.main;
      const sf3  = (this._selected as any).scrollFactorX
                ?? (this._selected.parentContainer as any)?.scrollFactorX ?? 1;
      const wx3  = sf3 === 0 ? pointer.x / cam3.zoom : cam3.scrollX + pointer.x / cam3.zoom;
      const wy3  = sf3 === 0 ? pointer.y / cam3.zoom : cam3.scrollY + pointer.y / cam3.zoom;
      this._selected.x = this._dragObjStartX + (wx3 - this._dragStartWorldX);
      this._selected.y = this._dragObjStartY + (wy3 - this._dragStartWorldY);
      this.snapshot(this._selected);
      scene.game.events.emit('debug:update', this.records.get(this._selected));
    };

    // Manual drag: end on pointerup
    this._onPointerUp = () => { this._manualDragging = false; };

    this._inputScene.input.on('pointerdown', this._onPointerDown);
    this._inputScene.input.on('pointerdown', this._onManualDragDown);
    this._inputScene.input.on('pointermove', this._onPointerMove);
    this._inputScene.input.on('pointerup',   this._onPointerUp);
  }

  removeDrag(scene: Phaser.Scene): void {
    if (!this._dragEnabled) return;
    this._dragEnabled    = false;
    this._manualDragging = false;
    if (this._selected) this._applyTint(this._selected, null);
    this._selected = null;
    this._undoStack.length = 0;

    this._blockRect?.destroy();
    this._blockRect = null;

    const inp = this._inputScene ?? scene;
    if (this._onPointerDown)    inp.input.off('pointerdown', this._onPointerDown);
    if (this._onManualDragDown) inp.input.off('pointerdown', this._onManualDragDown);
    if (this._onPointerMove)    inp.input.off('pointermove', this._onPointerMove);
    if (this._onPointerUp)      inp.input.off('pointerup',   this._onPointerUp);
    this._onPointerDown = this._onManualDragDown = null;
    this._onPointerMove = this._onPointerUp = null;
    this._inputScene = null;

    // Restore saved pointerdown handlers on game buttons
    this._savedPD.forEach((hs, go) => hs.forEach(h => (go as any).on('pointerdown', h)));
    this._savedPD.clear();

    this._allDraggable.forEach(obj => {
      this._applyTint(obj, null);
      if (this._newlyInteractive.has(obj)) {
        (obj as any).disableInteractive?.();
      }
    });
    this._allDraggable = [];
    this._newlyInteractive.clear();
  }

  resizeSelected(percentDelta: number): void {
    if (!this._selected) return;
    const obj = this._selected;
    let fontSize: number | undefined;
    if (obj instanceof Phaser.GameObjects.Text) {
      fontSize = Number.parseFloat((obj as any).style?.fontSize ?? '12') || 12;
    } else if (obj instanceof Phaser.GameObjects.BitmapText) {
      fontSize = obj.fontSize;
    }
    if (obj instanceof Phaser.GameObjects.Rectangle) {
      const rectW = obj.width;
      const rectH = obj.height;
      this._undoStack.push({ obj, x: obj.x, y: obj.y, scaleX: obj.scaleX, scaleY: obj.scaleY, depth: obj.depth, rectW, rectH });
      const f = 1 + percentDelta / 100;
      obj.setSize(Math.max(1, rectW * f), Math.max(1, rectH * f));
    } else {
      this._undoStack.push({ obj, x: obj.x, y: obj.y, scaleX: obj.scaleX, scaleY: obj.scaleY, depth: obj.depth, fontSize });
      if (obj instanceof Phaser.GameObjects.Text || obj instanceof Phaser.GameObjects.BitmapText) {
        obj.setFontSize(Math.max(4, (fontSize ?? 12) * (1 + percentDelta / 100)));
      } else {
        obj.setScale(Math.max(0.001, obj.scaleX * (1 + percentDelta / 100)));
      }
    }
    this.snapshot(obj);
    this._dragScene?.game.events.emit('debug:update', this.records.get(obj));
  }

  adjustFontSize(deltaPx: number): void {
    const obj = this._selected;
    if (!(obj instanceof Phaser.GameObjects.Text) && !(obj instanceof Phaser.GameObjects.BitmapText)) return;
    const fontSize = obj instanceof Phaser.GameObjects.Text
      ? Number.parseFloat((obj as any).style?.fontSize ?? '12') || 12
      : obj.fontSize;
    this._undoStack.push({ obj, x: obj.x, y: obj.y, scaleX: obj.scaleX, scaleY: obj.scaleY, depth: obj.depth, fontSize });
    obj.setFontSize(Math.max(4, fontSize + deltaPx));
    this.snapshot(obj);
    this._dragScene?.game.events.emit('debug:update', this.records.get(obj));
  }

  adjustWordWrap(deltaPx: number): void {
    const obj = this._selected;
    if (!obj) return;
    if (obj instanceof Phaser.GameObjects.Text) {
      const current = Math.round((obj.style as any)?.wordWrapWidth ?? obj.displayWidth);
      const newWidth = Math.max(20, current + deltaPx);
      const wrapWidth = current;
      this._undoStack.push({ obj, x: obj.x, y: obj.y, scaleX: obj.scaleX, scaleY: obj.scaleY, depth: obj.depth, wrapWidth });
      obj.setWordWrapWidth(newWidth, false);
      this.snapshot(obj);
      this._dragScene?.game.events.emit('debug:update', this.records.get(obj));
    } else if (obj instanceof Phaser.GameObjects.BitmapText) {
      const current = Math.round(obj.maxWidth > 0 ? obj.maxWidth : obj.displayWidth);
      const newWidth = Math.max(20, current + deltaPx);
      const wrapWidth = current;
      this._undoStack.push({ obj, x: obj.x, y: obj.y, scaleX: obj.scaleX, scaleY: obj.scaleY, depth: obj.depth, wrapWidth });
      obj.setMaxWidth(newWidth);
      this.snapshot(obj);
      this._dragScene?.game.events.emit('debug:update', this.records.get(obj));
    }
  }

  setFontColor(hex: string): void {
    const obj = this._selected;
    if (!obj) return;
    if (obj instanceof Phaser.GameObjects.Text) {
      const rawColor = obj.style.color;
      const fontColor = typeof rawColor === 'string' ? rawColor : '#ffffff';
      this._undoStack.push({ obj, x: obj.x, y: obj.y, scaleX: obj.scaleX, scaleY: obj.scaleY, depth: obj.depth, fontColor });
      obj.setColor(hex);
      this.snapshot(obj);
      this._dragScene?.game.events.emit('debug:update', this.records.get(obj));
    } else if (obj instanceof Phaser.GameObjects.BitmapText) {
      // Store current tint as color (BitmapText uses tint for color)
      const cur = obj.tintTopLeft;
      const fontColor = '#' + cur.toString(16).padStart(6, '0');
      this._undoStack.push({ obj, x: obj.x, y: obj.y, scaleX: obj.scaleX, scaleY: obj.scaleY, depth: obj.depth, fontColor });
      const n = Number.parseInt(hex.replace('#', ''), 16);
      obj.setTint(n);
      this.snapshot(obj);
      this._dragScene?.game.events.emit('debug:update', this.records.get(obj));
    }
  }

  get selectedIsText(): boolean {
    return this._selected instanceof Phaser.GameObjects.Text
        || this._selected instanceof Phaser.GameObjects.BitmapText;
  }

  changeDepth(delta: number): void {
    if (!this._selected) return;
    const obj = this._selected;
    this._undoStack.push({ obj, x: obj.x, y: obj.y, scaleX: obj.scaleX, scaleY: obj.scaleY, depth: obj.depth });
    obj.setDepth(obj.depth + delta);
    this.snapshot(obj);
    this._dragScene?.game.events.emit('debug:update', this.records.get(obj));
  }

  undo(): void {
    const entry = this._undoStack.pop();
    if (!entry) return;
    const { obj, x, y, scaleX, scaleY, depth } = entry;
    obj.x = x;
    obj.y = y;
    if (entry.rectW !== undefined && obj instanceof Phaser.GameObjects.Rectangle) {
      obj.setSize(entry.rectW, entry.rectH!);
    } else if (entry.fontSize !== undefined
     && (obj instanceof Phaser.GameObjects.Text || obj instanceof Phaser.GameObjects.BitmapText)) {
      obj.setFontSize(entry.fontSize);
    } else {
      obj.setScale(scaleX, scaleY);
    }
    if (entry.wrapWidth !== undefined) {
      if (obj instanceof Phaser.GameObjects.Text) obj.setWordWrapWidth(entry.wrapWidth, false);
      else if (obj instanceof Phaser.GameObjects.BitmapText) obj.setMaxWidth(entry.wrapWidth);
    }
    if (entry.fontColor !== undefined) {
      if (obj instanceof Phaser.GameObjects.Text) obj.setColor(entry.fontColor);
      else if (obj instanceof Phaser.GameObjects.BitmapText) {
        const n = Number.parseInt(entry.fontColor.replace('#', ''), 16);
        obj.setTint(n);
      }
    }
    obj.setDepth(depth);
    this.snapshot(obj);
    if (this._selected !== obj && this._dragScene) this.select(obj, this._dragScene);
    this._dragScene?.game.events.emit('debug:update', this.records.get(obj));
  }

  generateLog(sceneName: string): string {
    return JSON.stringify({
      scene: sceneName,
      timestamp: new Date().toISOString(),
      objects: [...this.records.values()],
    }, null, 2);
  }

  private select(obj: DraggableGO, scene: Phaser.Scene): void {
    if (this._selected) this._applyTint(this._selected, null);
    this._selected = obj;
    this._applyTint(obj, 0xffff00);
    this.snapshot(obj);
    scene.game.events.emit('debug:update', this.records.get(obj));
  }

  private _applyTint(obj: DraggableGO, tint: number | null): void {
    if (obj instanceof Phaser.GameObjects.Container) {
      (obj.list as any[]).forEach(c => { tint ? c.setTint?.(tint) : c.clearTint?.(); });
    } else if (obj instanceof Phaser.GameObjects.Rectangle) {
      // Rectangle has no tint — use a stroke overlay to signal selection
      if (tint) {
        obj.setStrokeStyle(2, tint, 1);
      } else {
        obj.setStrokeStyle(0);
      }
    } else {
      tint ? obj.setTint(tint) : obj.clearTint();
    }
  }

  private _saveClearPD(go: Phaser.GameObjects.GameObject): void {
    const hs = (go as any).listeners?.('pointerdown') as Function[] ?? [];
    if (hs.length) {
      this._savedPD.set(go, [...hs]);
      (go as any).removeAllListeners('pointerdown');
    }
  }

  private _setupObj(obj: DraggableGO): void {
    if (obj instanceof Phaser.GameObjects.Container) {
      (obj.list as any[]).filter(c => !!c.input).forEach(c => this._saveClearPD(c));
    } else if (obj instanceof Phaser.GameObjects.Rectangle) {
      // Rectangle.setInteractive() needs the geom shape explicitly
      obj.setInteractive(
        new Phaser.Geom.Rectangle(-obj.width / 2, -obj.height / 2, obj.width, obj.height),
        Phaser.Geom.Rectangle.Contains,
      );
      obj.input!.cursor = 'pointer';
      this._newlyInteractive.add(obj);
    } else if (obj.input) {
      this._saveClearPD(obj);
    } else {
      obj.setInteractive({ useHandCursor: true });
      this._newlyInteractive.add(obj);
    }
  }

  private snapshot(obj: DraggableGO): void {
    let textureKey: string;
    let dw: number;
    let dh: number;
    let fontSize: number | undefined;
    let wrapWidth: number | undefined;
    let fontColor: string | undefined;
    let isText: boolean | undefined;

    if (obj instanceof Phaser.GameObjects.Text || obj instanceof Phaser.GameObjects.BitmapText) {
      const raw = obj instanceof Phaser.GameObjects.BitmapText ? obj.text : (obj as any).text as string ?? '';
      textureKey = '[txt] ' + raw.substring(0, 10);
      dw = Math.round(obj.displayWidth);
      dh = Math.round(obj.displayHeight);
      isText = true;
      if (obj instanceof Phaser.GameObjects.Text) {
        fontSize = Number.parseFloat((obj as any).style?.fontSize ?? '12') || 12;
        const ww = (obj.style as any)?.wordWrapWidth;
        wrapWidth = Math.round(ww > 0 ? ww : obj.displayWidth);
        const rawColor = obj.style.color;
        fontColor = typeof rawColor === 'string' ? rawColor : '#ffffff';
      } else {
        fontSize = obj.fontSize;
        wrapWidth = Math.round(obj.maxWidth > 0 ? obj.maxWidth : obj.displayWidth);
        fontColor = '#' + obj.tintTopLeft.toString(16).padStart(6, '0');
      }
    } else if (obj instanceof Phaser.GameObjects.Container) {
      textureKey = '[btn]';
      const b = obj.getBounds();
      dw = Math.round(b.width);
      dh = Math.round(b.height);
    } else if (obj instanceof Phaser.GameObjects.Rectangle) {
      textureKey = '[rect]';
      dw = Math.round(obj.width);
      dh = Math.round(obj.height);
    } else {
      textureKey = (obj as any).texture?.key ?? 'unknown';
      dw = Math.round(obj.displayWidth);
      dh = Math.round(obj.displayHeight);
    }

    this.records.set(obj, {
      textureKey,
      x:             Math.round(obj.x * 10) / 10,
      y:             Math.round(obj.y * 10) / 10,
      scaleX:        Math.round(obj.scaleX * 10000) / 10000,
      scaleY:        Math.round(obj.scaleY * 10000) / 10000,
      displayWidth:  dw,
      displayHeight: dh,
      depth:         obj.depth,
      fontSize,
      wrapWidth,
      fontColor,
      isText,
    });
  }

  private isBackground(obj: DraggableGO): boolean {
    if (obj instanceof Phaser.GameObjects.Text
     || obj instanceof Phaser.GameObjects.BitmapText
     || obj instanceof Phaser.GameObjects.Container) return false;
    if (obj instanceof Phaser.GameObjects.Rectangle) {
      return obj.width >= GAME_W * 0.75 && obj.height >= GAME_H * 0.75;
    }
    return obj.displayWidth >= GAME_W * 0.75 && obj.displayHeight >= GAME_H * 0.75;
  }

  private collectObjects(list: Phaser.GameObjects.GameObject[]): DraggableGO[] {
    const result: DraggableGO[] = [];
    for (const obj of list) {
      if (obj instanceof Phaser.GameObjects.Image || obj instanceof Phaser.GameObjects.Sprite) {
        result.push(obj);
      } else if (obj instanceof Phaser.GameObjects.Text || obj instanceof Phaser.GameObjects.BitmapText) {
        result.push(obj);
      } else if (obj instanceof Phaser.GameObjects.Rectangle) {
        result.push(obj);
      } else if (obj instanceof Phaser.GameObjects.Container) {
        const interactiveChildren = (obj.list as any[]).filter(c => !!c.input);
        if (interactiveChildren.length === 1) {
          result.push(obj);
        } else {
          result.push(...this.collectObjects(obj.list));
        }
      }
    }
    return result;
  }
}

export const DebugManager = new DebugManagerSingleton();
