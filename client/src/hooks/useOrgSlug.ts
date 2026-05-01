import { useQuery } from "@tanstack/react-query";
import { useCompanySettings } from "./useCompanySettings";

export function useOrgSlug() {
  const { companySettings, isLoading: settingsLoading } = useCompanySettings();
  const orgId = companySettings?.org_id ?? null;

  const { data: slug, isLoading: slugLoading } = useQuery({
    queryKey: ["org_slug", orgId],
    queryFn: async () => "lander-records",
  });

  return {
    orgSlug: slug ?? null,
    isLoading: settingsLoading || slugLoading,
  };
}
