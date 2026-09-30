import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, Loader2 } from "lucide-react";
import { api } from "@/shared/lib/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { toast } from "sonner";
import { useTenant } from "@/app/providers/TenantContext";
import {
  ONBOARDING_INDUSTRY_OPTIONS,
  normalizeOrganizationIndustry,
  type OrganizationIndustry,
} from "../constants/organization-industry";

import { toUserMessage } from "@/shared/lib/errors";
export default function Onboarding() {
  const navigate = useNavigate();
  const { tenant, setTenant } = useTenant();
  const [companyName, setCompanyName] = useState(tenant.name);
  const [segment, setSegment] = useState<OrganizationIndustry>(normalizeOrganizationIndustry(tenant.industry));
  const [logoUrl, setLogoUrl] = useState(tenant.config.logoUrl ?? "");
  const [timezone, setTimezone] = useState(tenant.meta.timezone);
  const [saving, setSaving] = useState(false);

  const complete = async () => {
    if (companyName.trim().length < 2) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/auth/onboarding", {
        companyName: companyName.trim(),
        segment,
        logoUrl: logoUrl.trim() || undefined,
        settings: { timezone, locale: "pt-BR", currency: "BRL" },
      });
      setTenant((current) => ({
        ...current,
        name: companyName.trim(),
        industry: segment,
        config: { ...current.config, logoUrl: logoUrl.trim() || undefined },
        onboarding: {
          ...current.onboarding,
          completed: true,
          currentStep: "complete",
          steps: { ...current.onboarding.steps, company_profile: true, complete: true },
        },
      }));
      toast.success("Workspace configurado.");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(toUserMessage(error, "Não foi possível concluir o onboarding."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Configure seu workspace</h1>
            <p className="text-sm text-muted-foreground">Dados iniciais da organização</p>
          </div>
        </div>

        <div className="grid gap-5 border-y border-border py-8 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="company-name">Nome da empresa</Label>
            <Input id="company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Segmento</Label>
            <Select value={segment} onValueChange={(value) => setSegment(value as OrganizationIndustry)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ONBOARDING_INDUSTRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Fuso horário</Label>
            <Input id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="logo-url">URL do logo</Label>
            <Input
              id="logo-url"
              type="url"
              placeholder="https://..."
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Button onClick={complete} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Concluir
          </Button>
        </div>
      </div>
    </main>
  );
}
