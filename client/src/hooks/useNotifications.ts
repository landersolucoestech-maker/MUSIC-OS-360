import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { addDays, isAfter, isBefore, parseISO } from "date-fns";
import { QUERY_KEYS } from "@/lib/query-config";
import { MOCK_DATA } from "@/data/mockData";

/**
 * Notificações geradas a partir do MOCK_DATA local.
 *
 * Agrega contratos vencendo, eventos próximos e tarefas de marketing
 * pendentes diretamente das tabelas em memória — antes essa lógica
 * vivia parte no front e parte em jobs no backend (notificações de
 * sistema). Sem backend, mantemos só a parte client-side.
 */

interface Notification {
  id: string;
  type:
    | "contrato_vencendo"
    | "evento_proximo"
    | "tarefa_pendente"
    | "financeiro"
    | "system";
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

const READ_KEY = "lander_mock_notifications_read";

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveRead(read: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(read)));
  } catch {
    // ignora falhas de quota
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.NOTIFICATIONS, userId],
    queryFn: async (): Promise<Notification[]> => {
      const today = new Date();
      const sevenDaysFromNow = addDays(today, 7);
      const thirtyDaysFromNow = addDays(today, 30);
      const read = loadRead();
      const items: Notification[] = [];

      const contratos = (MOCK_DATA.contratos ?? []) as Array<{
        id: string;
        titulo?: string;
        data_fim?: string | null;
        status?: string;
      }>;
      contratos
        .filter((c) => c.status === "ativo")
        .forEach((contrato) => {
          if (!contrato.data_fim) return;
          const dataFim = parseISO(contrato.data_fim);
          if (isAfter(dataFim, today) && isBefore(dataFim, thirtyDaysFromNow)) {
            const id = `contrato-${contrato.id}`;
            items.push({
              id,
              type: "contrato_vencendo",
              title: "Contrato vencendo",
              message: `O contrato "${contrato.titulo ?? contrato.id}" vence em breve`,
              link: "/contratos",
              read: read.has(id),
              createdAt: today,
            });
          }
        });

      const eventos = (MOCK_DATA.eventos ?? []) as Array<{
        id: string;
        titulo?: string;
        data_inicio?: string | null;
      }>;
      eventos.forEach((evento) => {
        if (!evento.data_inicio) return;
        const dataInicio = parseISO(evento.data_inicio);
        if (isAfter(dataInicio, today) && isBefore(dataInicio, sevenDaysFromNow)) {
          const id = `evento-${evento.id}`;
          items.push({
            id,
            type: "evento_proximo",
            title: "Evento próximo",
            message: `"${evento.titulo ?? evento.id}" está agendado para breve`,
            link: "/agenda",
            read: read.has(id),
            createdAt: today,
          });
        }
      });

      const tarefas = (MOCK_DATA.tarefas_marketing ?? []) as Array<{
        id: string;
        titulo?: string;
        data_prazo?: string | null;
        status?: string;
      }>;
      tarefas
        .filter((t) => t.status === "pendente")
        .forEach((tarefa) => {
          if (!tarefa.data_prazo) return;
          const prazo = parseISO(tarefa.data_prazo);
          if (isBefore(prazo, sevenDaysFromNow)) {
            const id = `tarefa-${tarefa.id}`;
            items.push({
              id,
              type: "tarefa_pendente",
              title: "Tarefa pendente",
              message: `"${tarefa.titulo ?? tarefa.id}" precisa de atenção`,
              link: "/marketing/tarefas",
              read: read.has(id),
              createdAt: today,
            });
          }
        });

      return items;
    },
    staleTime: 60 * 1000,
  });

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const read = loadRead();
      read.add(notificationId);
      saveRead(read);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.NOTIFICATIONS, userId],
      });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const read = loadRead();
      notifications.forEach((n) => read.add(n.id));
      saveRead(read);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.NOTIFICATIONS, userId],
      });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
  };
}
