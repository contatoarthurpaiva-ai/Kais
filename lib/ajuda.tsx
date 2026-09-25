'use client';
import { useState } from 'react';

/** Botão "?" que revela uma explicação curta ao clicar (funciona no toque). */
export function Ajuda({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="ajuda-wrap">
      <button
        type="button"
        className="ajuda-btn"
        aria-label="O que é isto?"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <span className="ajuda-pop" role="tooltip" onClick={() => setOpen(false)}>
          {children}
        </span>
      )}
    </span>
  );
}
