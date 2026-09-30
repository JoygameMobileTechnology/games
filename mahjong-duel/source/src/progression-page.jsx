import React, { useEffect, useId, useRef } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import './progression-pages.css';

export function ProgressionPage({ title, className = '', onClose, children, bodyRef, closeLabel = 'Back to main menu', hideBack = false }) {
  const id = useId(), root = useRef(null), heading = useRef(null), onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    heading.current?.focus({ preventScroll: true });
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCloseRef.current?.(); }
      if (event.key !== 'Tab') return;
      const controls = [...root.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(node => node.tabIndex >= 0 && node.getClientRects().length);
      if (!controls.length) return;
      // Safari may skip buttons during native Tab navigation; keep page navigation consistent.
      const current = controls.indexOf(document.activeElement);
      const next = current < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      event.preventDefault(); controls[next].focus();
    };
    const node = root.current; node.addEventListener('keydown', keydown);
    return () => { node.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title]);
  return <section className={`progression-page ${className}`} ref={root} role="dialog" aria-modal="true" aria-labelledby={id}>
    <header className="progression-page-header">{hideBack ? <span aria-hidden="true" /> : <button className="icon-button" type="button" aria-label={closeLabel} onClick={onClose}><ArrowLeft size={27} weight="bold" /></button>}<h2 id={id} ref={heading} tabIndex={-1}>{title}</h2><span aria-hidden="true" /></header>
    <div className="progression-page-scroll" ref={bodyRef}><div className="progression-page-content">{children}</div></div>
  </section>;
}
