'use client';

/** Botão que pede confirmação antes de enviar o formulário (para excluir). */
export function ConfirmSubmit({
  children,
  message,
}: {
  children: React.ReactNode;
  message: string;
}) {
  return (
    <button
      type="submit"
      className="btn secundario"
      style={{ padding: '4px 10px', color: 'var(--erro)', borderColor: 'var(--erro)' }}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
