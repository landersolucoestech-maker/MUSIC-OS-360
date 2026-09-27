import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useInternalMemberSearch } from "../hooks/useInternalChat";
import type { InternalMember } from "../services/internal-chat.service";

function initials(name: string | null, fallback: string) {
  const source = name || fallback;
  return source.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function NewInternalConversationDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (participantAuthUserIds: string[]) => void;
  isCreating: boolean;
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<InternalMember[]>([]);
  const { data: results = [], isLoading, isError } = useInternalMemberSearch(debouncedSearch);

  const toggle = (member: InternalMember) => {
    setSelected((prev) =>
      prev.some((m) => m.auth_user_id === member.auth_user_id)
        ? prev.filter((m) => m.auth_user_id !== member.auth_user_id)
        : [...prev, member],
    );
  };

  const handleCreate = () => {
    if (selected.length === 0) return;
    onCreate(selected.map((m) => m.auth_user_id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa interna</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Buscar colega por nome ou e-mail..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((member) => (
                <Badge key={member.auth_user_id} variant="secondary" className="gap-1">
                  {member.full_name || member.email}
                  <button
                    type="button"
                    onClick={() => toggle(member)}
                    aria-label={`Remover ${member.full_name || member.email}`}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border">
            {isLoading ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Buscando...</p>
            ) : isError ? (
              <p className="p-4 text-center text-sm text-destructive">Não foi possível buscar colegas.</p>
            ) : results.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {search ? "Nenhum colega encontrado." : "Digite para buscar colegas da organização."}
              </p>
            ) : (
              results.map((member) => {
                const active = selected.some((m) => m.auth_user_id === member.auth_user_id);
                return (
                  <button
                    key={member.auth_user_id}
                    type="button"
                    onClick={() => toggle(member)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${active ? "bg-primary/5" : ""}`}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">{initials(member.full_name, member.email)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">{member.full_name || member.email}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={selected.length === 0 || isCreating}>
            {isCreating ? "Criando..." : "Iniciar conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
