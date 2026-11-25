import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'pos-data-ui-debug';
/** Strict interactive targets — never bubble past these to PANEL/PAGE parents. */
const STRICT_INTERACTIVE = 'button,a,input,select,textarea,[role="button"]';

function readUrlFlag(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('debug') === 'ui';
  } catch {
    return false;
  }
}

function readStored(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStored(on: boolean) {
  try {
    if (on) sessionStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function unlabeledHint(el: Element): string {
  const tag = el.tagName.toLowerCase();
  let text = '';
  if (tag === 'button' || tag === 'a') {
    text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28);
  }
  if (!text) {
    text = (
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('title') ||
      ''
    )
      .trim()
      .slice(0, 28);
  }
  if (text) return `未標註: <${tag}> "${text}"`;
  const cls =
    typeof (el as HTMLElement).className === 'string'
      ? (el as HTMLElement).className.trim().split(/\s+/)[0]
      : el.classList?.[0] || '';
  return cls ? `未標註: <${tag}.${cls}>` : `未標註: <${tag}>`;
}

interface Hit {
  el: Element;
  labeled: boolean;
  code: string;
}

function resolveTarget(from: Element, rootId: string): Hit | null {
  const root = document.getElementById(rootId);
  const isOverlay = (el: Element | null) => !!(el && root && (el === root || root.contains(el)));
  if (isOverlay(from)) return null;

  // 1) Prefer nearest strict interactive control
  const control = from.closest(STRICT_INTERACTIVE);
  if (control && !isOverlay(control)) {
    const own = control.getAttribute('data-ui');
    if (own) return { el: control, labeled: true, code: own };
    return { el: control, labeled: false, code: unlabeledHint(control) };
  }

  // 2) Background → nearest container data-ui
  const withUi = from.closest('[data-ui]');
  if (withUi && !isOverlay(withUi)) {
    return { el: withUi, labeled: true, code: withUi.getAttribute('data-ui') || '' };
  }
  return null;
}

/**
 * Hover-mode data-ui debug overlay. Default OFF.
 * Highlights only the hovered/touched target; does not flood the screen with tags.
 */
export function DataUiOverlay() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (readUrlFlag()) {
      writeStored(true);
      return true;
    }
    return readStored();
  });
  const [hit, setHit] = useState<Hit | null>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tagPos, setTagPos] = useState<{ top: number; left: number } | null>(null);
  const hitRef = useRef<Hit | null>(null);

  const setOn = useCallback((on: boolean) => {
    setEnabled(on);
    writeStored(on);
    if (!on) {
      hitRef.current = null;
      setHit(null);
      setBox(null);
      setTagPos(null);
    }
  }, []);

  const paint = useCallback(() => {
    const current = hitRef.current;
    if (!enabled || !current || !document.contains(current.el)) {
      setHit(null);
      setBox(null);
      setTagPos(null);
      return;
    }
    const rect = current.el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      setHit(null);
      setBox(null);
      setTagPos(null);
      return;
    }
    setHit(current);
    setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    let tagTop = rect.top - 22;
    if (tagTop < 4) tagTop = rect.bottom + 4;
    const tagLeft = Math.max(4, Math.min(rect.left, window.innerWidth - 160));
    setTagPos({ top: tagTop, left: tagLeft });
  }, [enabled]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      if (e.key !== 'U' && e.key !== 'u') return;
      e.preventDefault();
      setOn(!enabled);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, setOn]);

  useEffect(() => {
    if (!enabled) return;

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        paint();
      });
    };

    const onPointer = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Element)) {
        hitRef.current = null;
        schedule();
        return;
      }
      hitRef.current = resolveTarget(target, 'pos-data-ui-debug-root');
      schedule();
    };

    document.addEventListener('pointermove', onPointer, true);
    document.addEventListener('pointerover', onPointer, true);
    document.addEventListener('touchstart', onPointer, true);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);

    return () => {
      document.removeEventListener('pointermove', onPointer, true);
      document.removeEventListener('pointerover', onPointer, true);
      document.removeEventListener('touchstart', onPointer, true);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [enabled, paint]);

  if (!enabled || typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="pos-data-ui-debug-root"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2147483646,
        overflow: 'hidden',
      }}
    >
      {box && hit && (
        <div
          style={{
            position: 'fixed',
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            border: hit.labeled ? '2px solid #fbbf24' : '2px solid #94a3b8',
            borderRadius: 4,
            background: hit.labeled ? 'rgba(251,191,36,0.12)' : 'rgba(148,163,184,0.12)',
            boxSizing: 'border-box',
          }}
        />
      )}
      {tagPos && hit && (
        <div
          title={hit.code}
          style={{
            position: 'fixed',
            top: tagPos.top,
            left: tagPos.left,
            maxWidth: 'min(70vw, 320px)',
            padding: '2px 6px',
            borderRadius: 3,
            background: 'rgba(15,23,42,0.92)',
            color: hit.labeled ? '#fde68a' : '#e2e8f0',
            font: '600 11px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            border: hit.labeled
              ? '1px solid rgba(253,230,138,0.5)'
              : '1px solid rgba(148,163,184,0.6)',
          }}
        >
          {hit.code}
        </div>
      )}
      <div
        style={{
          position: 'fixed',
          right: 10,
          bottom: 10,
          padding: '4px 8px',
          borderRadius: 999,
          background: 'rgba(15,23,42,0.92)',
          color: '#93c5fd',
          font: '600 11px/1 ui-sans-serif, system-ui, sans-serif',
          border: '1px solid rgba(147,197,253,0.5)',
        }}
      >
        data-ui HOVER ON · Ctrl+Shift+U
      </div>
    </div>,
    document.body
  );
}

export default DataUiOverlay;
