import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/app/providers/AuthContext';
import { useRealtimeSync } from '@/shared/hooks/useRealtimeSync';
import { useWsEvent } from '@/shared/hooks/useWsEvent';
import type { WsNotificationPayload } from '@/shared/lib/ws-events';
import { QUERY_KEYS } from '@/shared/lib/query-config';

/**
 * Mounts all real-time subscriptions for the authenticated session.
 *
 * Renders null — pure side-effect component.
 * Must be inside: QueryClientProvider → AuthProvider.
 *
 * Responsibilities:
 *   1. useRealtimeSync  — WS domain events → TanStack Query cache invalidation
 *   2. notification:new — persisted notifications from NotificationsProcessor
 *   3. data:changed     — invalidate entity cache when another user mutates data
 *   4. Inline WS toasts — user-visible notifications for key domain events
 *
 * In mock mode (VITE_USE_MOCK=true) the socket is never created so all
 * useWsEvent hooks no-op silently.
 */
function RealtimeSyncAndNotify() {
  const qc = useQueryClient();

  // ── Cache invalidation (domain events) ───────────────────────────────────
  useRealtimeSync();

  // ── Persisted notifications (backend → NOTIFICATIONS queue → WS) ─────────
  useWsEvent<WsNotificationPayload>('notification:new', (n) => {
    // Toast based on the notification type
    const title       = n.title;
    const description = n.body ?? undefined;

    switch (n.type) {
      case 'success':
        toast.success(title, { description });
        break;
      case 'warning':
        toast.warning(title, { description });
        break;
      case 'error':
        toast.error(title, { description });
        break;
      default:
        toast.info(title, { description });
    }

    // Invalidates the notification list (topbar badge + dropdown)
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
  });

  // ── Data changed by another user of the same org ────────────────────────
  useWsEvent<{ entity: string; id: string }>('data:changed', ({ entity, id }) => {
    qc.invalidateQueries({ queryKey: [entity, id] });
    qc.invalidateQueries({ queryKey: [entity] });
  });

  // ── Toasts for domain events ─────────────────────────────────────────────
  useWsEvent('artist.created', (d) => {
    const label = (d as { nome_artistico?: string }).nome_artistico;
    toast.success('Artista cadastrado', {
      description: label ? `"${label}" foi adicionado ao roster` : undefined,
    });
  });

  useWsEvent('contract.created', () => {
    toast.info('Novo contrato criado', { description: 'Verifique a fila de contratos pendentes' });
  });

  useWsEvent('contract.signed', () => {
    toast.success('Contrato assinado', { description: 'Assinatura digital confirmada' });
  });

  useWsEvent('crm.lead.captured', (d) => {
    const nome = (d as { nome?: string }).nome;
    toast.info('Novo lead capturado', {
      description: nome ? `Lead "${nome}" adicionado ao CRM` : undefined,
    });
  });

  useWsEvent('crm.lead.converted', () => {
    toast.success('Lead convertido', { description: 'Lead promovido a artista/cliente' });
  });

  useWsEvent('finance.transaction.created', (d) => {
    const type = (d as { type?: string }).type ?? 'transação';
    toast.info(`Nova ${type} registrada`, { description: 'Financeiro atualizado' });
  });

  useWsEvent('finance.calculated', () => {
    toast.success('Apuração concluída', { description: 'Financeiro recalculado com sucesso' });
  });

  useWsEvent('catalog.music.registered', (d) => {
    const title = (d as { title?: string }).title;
    toast.success('Música registrada', {
      description: title ? `"${title}" adicionada ao catálogo` : 'Nova obra no catálogo',
    });
  });

  return null;
}

/**
 * Guard: only mounts subscriptions when the user is authenticated.
 * Avoids spurious WS connection attempts on login/logout transitions.
 */
export function RealtimeLayer() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  return <RealtimeSyncAndNotify />;
}

