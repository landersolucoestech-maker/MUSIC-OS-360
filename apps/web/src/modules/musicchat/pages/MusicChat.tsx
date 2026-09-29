/**
 * pages/MusicChat.tsx
 *
 * MusicChat — single navigation point (/chat) between two architecturally
 * independent domains: Internal Chat (team <-> team,
 * modules/musicchat-internal) and Support Center (team <-> external
 * public, modules/musicchat). Each has its own component tree, state,
 * hooks and service — this file only decides WHICH one to mount.
 *
 * Root-cause fix of the original bug: the previous implementation used
 * `<TabsContent forceMount>` on the support tab, which kept it
 * rendering even with "Chat Interno" active (visual/functional mix).
 * WITHOUT forceMount, Radix Tabs only mounts the active panel — never both at
 * the same time — preserving the tab experience that already existed.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/shared/components/MainLayout";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Headphones, Plus, Settings, Users } from "lucide-react";
import { useTenant } from "@/app/providers/TenantContext";
import { InternalChatView } from "@/modules/musicchat-internal/components/InternalChatView";
import { SupportCenterView } from "../components/SupportCenterView";
import type { SupportConversation } from "../services/conversations.service";
import { NewConversationDialog } from "../components/NewConversationDialog";

type MusicChatArea = "internal" | "support";

export default function MusicChat() {
  const navigate = useNavigate();
  const { hasPermission } = useTenant();
  const canManageAutomation = hasPermission("musicchat", "write") || hasPermission("settings", "write");
  const [activeArea, setActiveArea] = useState<MusicChatArea>("support");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [pendingNewConversation, setPendingNewConversation] = useState<SupportConversation | null>(null);

  const headerActions = (
    <div className="flex items-center gap-2">
      {canManageAutomation && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => navigate("/admin/musicchat/automations")}
        >
          <Settings className="h-3.5 w-3.5" />
          Configurações
        </Button>
      )}
      {/* The Support Center "Nova conversa" lives in the header (WhatsApp-only flow,
          see NewConversationDialog); Internal Chat has its own "Nova" trigger inside
          its own Card — different domains, different actions, no state
          shared between them. */}
      {activeArea === "support" && (
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          data-testid="button-nova-mensagem"
          onClick={() => setNewConversationOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Conversa
        </Button>
      )}
    </div>
  );

  return (
    <MainLayout
      title="MusicChat"
      description="Chat interno e central multicanal de atendimento"
      actions={headerActions}
    >
      <div className="space-y-4 pt-[10px] pb-[10px]">
        <Tabs value={activeArea} onValueChange={(value) => setActiveArea(value as MusicChatArea)}>
          <TabsList>
            <TabsTrigger value="internal" className="gap-2">
              <Users className="h-4 w-4" />
              Chat Interno
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <Headphones className="h-4 w-4" />
              Central de Atendimento
            </TabsTrigger>
          </TabsList>

          {/* No forceMount: Radix only mounts the active tab's panel — the other domain
              is fully unmounted, not just visually hidden. */}
          <TabsContent value="internal" className="mt-4">
            <InternalChatView />
          </TabsContent>

          <TabsContent value="support" className="mt-4">
            <SupportCenterView
              pendingNewConversation={pendingNewConversation}
              onConsumePendingNewConversation={() => setPendingNewConversation(null)}
            />
          </TabsContent>
        </Tabs>
      </div>
      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        onCreated={setPendingNewConversation}
      />
    </MainLayout>
  );
}
