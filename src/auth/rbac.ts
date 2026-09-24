/**
 * rbac.ts — permissões por perfil (§10).
 *
 * ADMIN: altera políticas financeiras, confirma venda abaixo do mínimo.
 * OPERADOR: opera o dia a dia, mas NÃO altera políticas nem confirma abaixo do mínimo.
 * Checagem sempre no servidor, em todas as rotas e exportações.
 */
export type Role = 'ADMIN' | 'OPERADOR';

export type Permission =
  | 'policy:edit' // margens, taxas, regras
  | 'sale:confirm-below-min' // confirmar venda abaixo do preço mínimo
  | 'sale:create'
  | 'product:manage'
  | 'expense:manage'
  | 'report:export'
  | 'report:view';

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    'policy:edit',
    'sale:confirm-below-min',
    'sale:create',
    'product:manage',
    'expense:manage',
    'report:export',
    'report:view',
  ],
  OPERADOR: ['sale:create', 'product:manage', 'expense:manage', 'report:view'],
};

export function can(role: Role, perm: Permission): boolean {
  return MATRIX[role].includes(perm);
}

export class ForbiddenError extends Error {
  constructor(perm: Permission) {
    super(`Ação não permitida para este perfil: ${perm}`);
  }
}

/** Lança ForbiddenError se o perfil não tiver a permissão. Uso em rotas. */
export function assertCan(role: Role, perm: Permission): void {
  if (!can(role, perm)) throw new ForbiddenError(perm);
}
