/**
 * Picks an active team member of the tenant (by name/e-mail search) for the
 * MusicChat settings — menu option default assignee, escalation recipient,
 * supervisor and manager. Stores the member's auth user id; never asks the
 * user to type an id. A stored id that no longer resolves to a member is shown
 * as such so it can be replaced or cleared.
 */
import { useState } from "react";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  memberDisplayName,
  useMusicChatMemberNames,
  useMusicChatTeamMembers,
} from "../hooks/useMusicChatTeamMembers";

const NONE = "__none__";
export const MISSING_MEMBER_LABEL = "Usuário não encontrado na equipe";
export const NAME_UNAVAILABLE_LABEL = "Nome indisponível no momento";

interface MusicChatMemberPickerProps {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
  /** Accessible name of the select. */
  label: string;
  noneLabel?: string;
  className?: string;
}

export function MusicChatMemberPicker({ value, onChange, label, noneLabel = "Nenhum", className }: MusicChatMemberPickerProps) {
  const [search, setSearch] = useState("");
  const { members, isLoading, error } = useMusicChatTeamMembers(search.trim());
  const { names, isLoading: namesLoading, isFetching: namesFetching, error: namesError } = useMusicChatMemberNames([value]);
  const resolving = namesLoading || namesFetching;
  const currentListed = !!value && members.some((member) => member.auth_user_id === value);
  const currentLabel = value
    ? names.get(value) ?? (resolving ? "Carregando…" : namesError ? NAME_UNAVAILABLE_LABEL : MISSING_MEMBER_LABEL)
    : null;

  return (
    <div className={className ?? "space-y-1"}>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por nome ou e-mail"
        aria-label={`Buscar ${label.toLowerCase()}`}
        className="h-8 text-sm"
      />
      <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? null : next)}>
        <SelectTrigger className="h-8 text-sm" aria-label={label}>
          <SelectValue placeholder={noneLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{noneLabel}</SelectItem>
          {value && !currentListed && <SelectItem value={value}>{currentLabel}</SelectItem>}
          {members.map((member) => (
            <SelectItem key={member.auth_user_id} value={member.auth_user_id}>
              {memberDisplayName(member)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p className="text-xs text-destructive" role="alert">Não foi possível carregar a equipe.</p>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando equipe…</p>
      ) : null}
    </div>
  );
}
