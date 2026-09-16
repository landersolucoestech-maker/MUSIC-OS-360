import { Construction } from 'lucide-react';
import { EmptyState } from '@/shared/components/EmptyState';

/**
 * CODEBASE_MAP Gotcha #26: only the "overview" tab had a registered child
 * route under ArtistWorkspaceLayout -- clicking Lançamentos/Campanhas/
 * Financeiro/Equipe/Histórico silently fell through (no content, or the
 * app's generic 404, neither of which explains what actually happened).
 * This is the honest, explicit "not built yet" state for every other tab
 * link the layout renders, wired as the wildcard child route.
 */
export default function WorkspaceTabPlaceholder() {
  return (
    <EmptyState
      icon={Construction}
      title="Em construção"
      description="Esta aba do ambiente do artista ainda não foi implementada. Use as abas do menu principal para acessar este conteúdo."
    />
  );
}
