/**
 * Entrée en mode démonstration.
 *
 * La vitrine Craftline embarque Battement dans un cadre
 * (`/pulsecraft/?demo=1`) : la visite ouvre directement le journal avec des
 * données d'exemple, sans écran d'accueil vide. Le paramètre ne s'applique
 * qu'à cette entrée et ne touche jamais un journal déjà rempli.
 */
export function isDemoRequest(search: string): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const value = params.get('demo');
  return value !== null && value !== '0' && value !== 'false';
}
