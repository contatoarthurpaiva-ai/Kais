'use client';
import { useState } from 'react';
import { criarPeca } from './actions';

function num(v: string) {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
const brl = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');

export function PieceForm() {
  const [custo, setCusto] = useState('');
  const [preco, setPreco] = useState('');
  const c = num(custo);
  const p = num(preco);
  const sobra = p - c;
  const margem = p > 0 ? (sobra / p) * 100 : 0;
  const mostrar = p > 0 || c > 0;
  const cor = sobra < 0 ? 'var(--erro)' : margem < 20 ? 'var(--alerta)' : 'var(--ok)';

  return (
    <form action={criarPeca}>
      <div className="campo">
        <label htmlFor="name">Nome da peça</label>
        <input id="name" name="name" required placeholder="Biquíni cortininha" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grade">
        <div className="campo">
          <label htmlFor="color">Cor</label>
          <input id="color" name="color" placeholder="vermelho" />
        </div>
        <div className="campo">
          <label htmlFor="size">Tamanho</label>
          <input id="size" name="size" placeholder="M" />
        </div>
        <div className="campo">
          <label htmlFor="cost">Quanto te custa fazer? (R$)</label>
          <input id="cost" name="cost" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="18,00" />
          <span className="ajuda">tecido, costura, embalagem… um valor por peça</span>
        </div>
        <div className="campo">
          <label htmlFor="tablePrice">Por quanto quer vender? (R$)</label>
          <input id="tablePrice" name="tablePrice" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="45,00" />
        </div>
      </div>

      {mostrar && (
        <div className="resultado" style={{ marginBottom: 'var(--e-2)' }}>
          <div className="linha-resultado">
            <span className="rot">Sobra por peça</span>
            <span className="val num" style={{ color: cor }}>{brl(sobra)}</span>
          </div>
          <div className="linha-resultado">
            <span className="rot">Margem</span>
            <span className="val num" style={{ color: cor }}>{p > 0 ? margem.toFixed(1) + '%' : '—'}</span>
          </div>
          {sobra < 0 && <p className="ajuda" style={{ color: 'var(--erro)' }}>⚠ Nesse preço você vende no prejuízo.</p>}
        </div>
      )}

      <button className="btn">Cadastrar peça</button>
      <style>{`@media (max-width:720px){ .grade{ grid-template-columns:1fr !important; } }`}</style>
    </form>
  );
}
