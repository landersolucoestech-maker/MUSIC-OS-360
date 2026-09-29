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
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";
import { useTenant } from "@/app/providers/TenantContext";
import { useDebounce } from "@/shared/hooks/useDebounce";

export interface MusicChatTeamMember {
  auth_user_id: string;
  full_name: string | null;
  /** null for an inactive member resolved by id (the API does not expose it). */
  email: string | null;
}

export const UNASSIGNED_LABEL = "Sem responsável";
export const UNKNOWN_MEMBER_LABEL = "Agente";
/** Most ids one request resolves (QueryInternalMembersDto caps `ids` at 100); larger sets are split. */
const MAX_IDS_PER_LOOKUP = 100;

export function memberDisplayName(member: Pick<MusicChatTeamMember, "full_name" | "email">): string {
  return member.full_name?.trim() || member.email || UNKNOWN_MEMBER_LABEL;
}

/**
 * Active members for a picker (current user included), filtered on the server by
 * name/e-mail. The search is debounced and the previous result stays visible
 * while the next one loads (no request per keystroke, no emptied list).
 */
export function useMusicChatTeamMembers(search = "", enabled = true) {
  const { tenant } = useTenant();
  const term = useDebounce(search.trim(), 300);
  const query = useQuery({
    queryKey: ["musicchat", "team-members", tenant?.id ?? null, term],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ include_self: "true" });
      if (term) params.set("search", term);
      return api.get<MusicChatTeamMember[]>(`/internal-chat/members?${params.toString()}`, { signal });
    },
    enabled: enabled && !!tenant?.id,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    /** A newer search is loading while the previous result is shown. */
    isSearching: query.isFetching || term !== search.trim(),
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Resolves member ids to display names. Ids not found keep no entry (callers use
 * a fallback label). While a new id set loads, the previous names stay (no
 * flicker to the fallback); `error` tells a failed lookup apart from "not a member".
 */
export function useMusicChatMemberNames(ids: ReadonlyArray<string | null | undefined>) {
  const { tenant } = useTenant();
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))].sort();
  const query = useQuery({
    queryKey: ["musicchat", "team-member-names", tenant?.id ?? null, unique],
    queryFn: async ({ signal }) => {
      const chunks: string[][] = [];
      for (let i = 0; i < unique.length; i += MAX_IDS_PER_LOOKUP) chunks.push(unique.slice(i, i + MAX_IDS_PER_LOOKUP));
      const pages = await Promise.all(chunks.map((chunk) =>
        api.get<MusicChatTeamMember[]>(`/internal-chat/members?ids=${encodeURIComponent(chunk.join(","))}`, { signal })));
      return pages.flat();
    },
    enabled: unique.length > 0 && !!tenant?.id,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const names = new Map((query.data ?? []).map((member) => [member.auth_user_id, memberDisplayName(member)]));
  return {
    names,
    isLoading: query.isLoading && unique.length > 0,
    /** The lookup failed and nothing was loaded before: names are unknown, not missing. */
    error: query.data === undefined ? query.error : null,
    /** Display name for an id; `fallback` when it is empty or not a member. */
    nameOf: (id: string | null | undefined, fallback: string) => (id ? names.get(id) ?? fallback : fallback),
  };
}
