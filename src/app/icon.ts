import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input } from '@angular/core';
import {
  Check, ChevronLeft, ChevronRight, CircleAlert, Clipboard, Copy, Download, Eye, EyeOff, File, FileText, Files, FolderOpen, History, IdCard, Image, Landmark,
  Link, Lock, LockOpen, Mail, Pencil, Pin, PinOff, Plus, Search, Settings, ShieldCheck, Trash2, Upload, X, type IconNode,
} from 'lucide';

const ICONS: Record<string, IconNode> = {
  check: Check, left: ChevronLeft, right: ChevronRight, alert: CircleAlert, clip: Clipboard, copy: Copy, download: Download, eye: Eye, 'eye-off': EyeOff,
  file: File, doc: FileText, files: Files, folder: FolderOpen, history: History, id: IdCard, image: Image, bank: Landmark, lock: Lock, unlock: LockOpen,
  edit: Pencil, pin: Pin, unpin: PinOff, plus: Plus, search: Search, settings: Settings, shield: ShieldCheck, trash: Trash2, upload: Upload, x: X,
  text: FileText, link: Link, mail: Mail,
};
const NS = 'http://www.w3.org/2000/svg';

/** Lucide icons, drawn as inline SVG in one stroke weight. */
@Component({ selector: 'cv-icon', template: '', changeDetection: ChangeDetectionStrategy.OnPush, host: { 'aria-hidden': 'true', style: 'display:inline-flex;flex:none' } })
export class Icon {
  name = input.required<string>();
  size = input(18);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      const svg = document.createElementNS(NS, 'svg');
      const s = String(this.size());
      for (const [k, v] of Object.entries({ width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(k, v);
      for (const [tag, attrs] of ICONS[this.name()] ?? ICONS['file']) {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
        svg.appendChild(el);
      }
      this.host.nativeElement.replaceChildren(svg);
    });
  }
}
