/**
 * Team members of the tenant for the Support Center (MusicChat): assignee and
 * notification-recipient pickers, and the names shown for message authors and
 * assignees. Conversations store the member's auth user id (`assigned_to`,
 * `sender_id`, settings `defaultAssignee`/`recipientUserId`/supervisor/manager);
 * the UI never shows that raw id.
 *
 * Source: the org members directory (GET /internal-chat/members — tenant
 * scoped, viewer role). `include_self=true` lets a picker choose the current
 * user; `ids=` resolves known ids to names, including inactive members.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";
import { useTenant } from "@/app/providers/TenantContext";

export interface MusicChatTeamMember {
  auth_user_id: string;
  full_name: string | null;
  email: string;
}

export const UNASSIGNED_LABEL = "Sem responsável";
export const UNKNOWN_MEMBER_LABEL = "Agente";
/** Most ids a single name lookup resolves (QueryInternalMembersDto caps `ids` at 100). */
const MAX_IDS_PER_LOOKUP = 100;

export function memberDisplayName(member: Pick<MusicChatTeamMember, "full_name" | "email">): string {
  return member.full_name?.trim() || member.email;
}

/** Active members for a picker (current user included), filtered on the server by name/e-mail. */
export function useMusicChatTeamMembers(search = "", enabled = true) {
  const { tenant } = useTenant();
  const query = useQuery({
    queryKey: ["musicchat", "team-members", tenant?.id ?? null, search],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ include_self: "true" });
      if (search) params.set("search", search);
      return api.get<MusicChatTeamMember[]>(`/internal-chat/members?${params.toString()}`, { signal });
    },
    enabled,
    staleTime: 60_000,
  });
  return { members: query.data ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}

/** Resolves member ids to display names. Ids not found keep no entry (callers use a fallback label). */
export function useMusicChatMemberNames(ids: ReadonlyArray<string | null | undefined>) {
  const { tenant } = useTenant();
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))]
    .sort()
    .slice(0, MAX_IDS_PER_LOOKUP);
  const query = useQuery({
    queryKey: ["musicchat", "team-member-names", tenant?.id ?? null, unique],
    queryFn: ({ signal }) =>
      api.get<MusicChatTeamMember[]>(`/internal-chat/members?ids=${encodeURIComponent(unique.join(","))}`, { signal }),
    enabled: unique.length > 0,
    staleTime: 5 * 60_000,
  });
  const names = new Map((query.data ?? []).map((member) => [member.auth_user_id, memberDisplayName(member)]));
  return {
    names,
    isLoading: query.isLoading && unique.length > 0,
    /** Display name for an id; `fallback` when it is empty or not a member. */
    nameOf: (id: string | null | undefined, fallback: string) => (id ? names.get(id) ?? fallback : fallback),
  };
}
