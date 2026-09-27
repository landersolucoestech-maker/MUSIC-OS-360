/**
 * components/ChatInternoView.tsx
 *
 * Internal Chat (team <-> team) — its own component/state/service tree,
 * isolated from the Support Center (modules/musicchat). It never
 * imports anything from that module. Rendered by the "Chat Interno" tab in
 * modules/musicchat/pages/MusicChat.tsx — never together with the "Central de
 * Atendimento" tab (the parent does not use `forceMount`, so only the active tab is mounted).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Textarea } from "@/shared/ui/textarea";
import { MessageCircle, Plus, Search, Send, Users } from "lucide-react";
import { useAuth } from "@/app/providers/AuthContext";
import { useInternalConversations, useInternalMessages } from "../hooks/useInternalChat";
import { NewInternalConversationDialog } from "./NewInternalConversationDialog";
import type { InternalConversation } from "../services/internal-chat.service";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function conversationTitle(conversation: InternalConversation, selfAuthUserId: string | undefined) {
  if (conversation.type === "group") return conversation.name || "Grupo";
  const other = conversation.participants.find((p) => p.auth_user_id !== selfAuthUserId);
  return other?.full_name || other?.email || "Conversa";
}

// Persisted in sessionStorage (not React state) because ChatInternoView fully unmounts
// when the user switches to the Central de Atendimento tab (no forceMount, by design —
// see MusicChat.tsx). Without this, an in-progress draft or the selected conversation is
// silently lost on every tab switch.
const SELECTED_ID_KEY = "musicchat-interno:selected-id";
const draftKey = (conversationId: string) => `musicchat-interno:draft:${conversationId}`;

export function ChatInternoView() {
  const { user } = useAuth();
  const { conversations, isLoading: loadingConversations, isError: conversationsError, createConversation } = useInternalConversations();
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem(SELECTED_ID_KEY) ?? "");
  const [search, setSearch] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;
  const { messages, isLoading: loadingMessages, isError: messagesError, sendMessage, markRead } = useInternalMessages(selectedConversation?.id ?? null);

  // Falls back to the first conversation not only when nothing is selected, but also when
  // the persisted selectedId (restored from sessionStorage, possibly from a different user
  // or session) isn't among the loaded conversations — otherwise the user is stuck on the
  // "select a conversation" empty state forever despite having conversations (regression:
  // a stale/foreign id used to short-circuit this effect since it was merely truthy).
  useEffect(() => {
    if (loadingConversations || conversations.length === 0) return;
    if (!selectedId || !conversations.some((c) => c.id === selectedId)) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId, loadingConversations]);

  useEffect(() => {
    if (selectedId) sessionStorage.setItem(SELECTED_ID_KEY, selectedId);
  }, [selectedId]);

  // Restore only — writes happen directly in handleDraftChange/handleSend, not via a
  // second effect (an effect keyed on `draft` would race this restore: it would see the
  // pre-restore draft on the same render pass and immediately delete what was just read).
  useEffect(() => {
    setDraft(selectedConversation ? sessionStorage.getItem(draftKey(selectedConversation.id)) ?? "" : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!selectedConversation) return;
    if (value) sessionStorage.setItem(draftKey(selectedConversation.id), value);
    else sessionStorage.removeItem(draftKey(selectedConversation.id));
  };

  useEffect(() => {
    if (selectedConversation) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((c) => conversationTitle(c, user?.id).toLowerCase().includes(query));
  }, [conversations, search, user?.id]);

  // Stable per-attempt idempotency key: reused across a retry of the SAME logical attempt
  // (so a timeout-then-retry replays the original creation instead of duplicating it), but
  // minted fresh when the participant list actually changes (a genuinely different attempt).
  const createAttemptRef = useRef<{ key: string; signature: string } | null>(null);
  const sendAttemptRef = useRef<{ key: string; signature: string } | null>(null);

  const handleCreate = (participantAuthUserIds: string[]) => {
    const signature = participantAuthUserIds.slice().sort().join(",");
    if (createAttemptRef.current?.signature !== signature) {
      createAttemptRef.current = { key: crypto.randomUUID(), signature };
    }
    createConversation.mutate(
      {
        input: { type: participantAuthUserIds.length > 1 ? "group" : "direct", participantAuthUserIds },
        idempotencyKey: createAttemptRef.current.key,
      },
      {
        onSuccess: (conversation) => {
          createAttemptRef.current = null;
          setSelectedId(conversation.id);
          setNewConversationOpen(false);
        },
      },
    );
  };

  const handleSend = () => {
    const body = draft.trim();
    if (!body || sendMessage.isPending || !selectedConversation) return;
    const signature = `${selectedConversation.id}|${body}`;
    if (sendAttemptRef.current?.signature !== signature) {
      sendAttemptRef.current = { key: crypto.randomUUID(), signature };
    }
    sendMessage.mutate(
      { body, idempotencyKey: sendAttemptRef.current.key },
      {
        onSuccess: () => {
          sendAttemptRef.current = null;
          handleDraftChange("");
        },
      },
    );
  };

  return (
    <div className="grid min-h-[560px] gap-4 md:h-[calc(100vh-248px)] md:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="flex min-w-0 flex-col border-border bg-card">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Chat Interno
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              data-testid="button-nova-conversa-interna"
              onClick={() => setNewConversationOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Nova
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : conversationsError ? (
            <p className="p-4 text-center text-sm text-destructive">Não foi possível carregar as conversas.</p>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Nenhuma conversa ainda</p>
              <p className="text-xs text-muted-foreground">O chat interno continua isolado da Central de Atendimento.</p>
              <Button size="sm" className="mt-2 h-8 gap-1.5 text-xs" onClick={() => setNewConversationOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Iniciar nova conversa
              </Button>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const title = conversationTitle(conversation, user?.id);
              const self = conversation.participants.find((p) => p.auth_user_id === user?.id);
              const unread = self?.last_read_at ? new Date(self.last_read_at) < new Date(conversation.updated_at) : true;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                    selectedId === conversation.id ? "bg-primary/5" : ""
                  }`}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-muted text-xs">{initials(title)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{title}</p>
                    {conversation.type === "group" && (
                      <p className="truncate text-xs text-muted-foreground">{conversation.participants.length} participantes</p>
                    )}
                  </div>
                  {unread && <Badge className="h-2 w-2 rounded-full p-0" />}
                </button>
              );
            })
          )}
        </ScrollArea>
      </Card>

      <Card className="flex min-w-0 flex-col border-border bg-card">
        {!selectedConversation ? (
          <CardContent className="flex h-full flex-col items-center justify-center text-center">
            <MessageCircle className="mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">Selecione uma conversa interna</h3>
            <p className="mb-4 max-w-sm text-sm text-muted-foreground">
              Escolha uma conversa existente ou inicie uma nova com um colega.
            </p>
            <Button className="h-8 gap-1.5 text-xs" onClick={() => setNewConversationOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nova conversa
            </Button>
          </CardContent>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-muted text-xs">{initials(conversationTitle(selectedConversation, user?.id))}</AvatarFallback>
              </Avatar>
              <h3 className="text-base font-semibold text-foreground">{conversationTitle(selectedConversation, user?.id)}</h3>
            </div>
            <ScrollArea className="flex-1 bg-muted/20 px-5 py-4">
              {loadingMessages ? (
                <p className="text-center text-sm text-muted-foreground">Carregando mensagens...</p>
              ) : messagesError ? (
                <p className="text-center text-sm text-destructive">Não foi possível carregar as mensagens.</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">Nenhuma mensagem ainda. Diga olá!</p>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const own = message.sender_auth_user_id === user?.id;
                    const sender = selectedConversation.participants.find((p) => p.auth_user_id === message.sender_auth_user_id);
                    return (
                      <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[72%] rounded-lg px-3 py-2 shadow-sm ${
                            own ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground"
                          }`}
                        >
                          {!own && (
                            <p className="mb-1 text-[11px] font-medium opacity-80">{sender?.full_name || sender?.email || "Colega"}</p>
                          )}
                          <p className="text-sm leading-relaxed">{message.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            <div className="border-t border-border p-4">
              <div className="space-y-3">
                <Textarea
                  placeholder="Digite uma mensagem..."
                  className="min-h-[78px] resize-none"
                  value={draft}
                  onChange={(event) => handleDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="flex justify-end">
                  <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={sendMessage.isPending || !draft.trim()} onClick={handleSend}>
                    <Send className="h-3.5 w-3.5" />
                    {sendMessage.isPending ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <NewInternalConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        onCreate={handleCreate}
        isCreating={createConversation.isPending}
      />
    </div>
  );
}
