/** Admin-only UI (Watch diagnostics, photo recovery, etc.) */
export const ADMIN_EMAIL = 'aseem.munshi@gmail.com';

export function isAdminUser(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === ADMIN_EMAIL;
}
