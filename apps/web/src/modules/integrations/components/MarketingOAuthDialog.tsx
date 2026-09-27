/**
 * modules/integrations/components/MarketingOAuthDialog.tsx
 *
 * Opens a browser popup with the platform's login page (/oauth/:platform).
 * After the user logs in in the popup, it sends a success postMessage,
 * the dialog receives it, connects and closes.
 */

import { useState, useEffect, useRef, useCallback, type ComponentType, type CSSProperties } from "react";
import { getAccessToken } from "@/shared/lib/api-client";
import { API_BASE_URL } from "@/shared/lib/env";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Loader2, Check, ShieldCheck, ExternalLink } from "lucide-react";
import {
  SiGoogle,
  SiGoogleads,
  SiInstagram,
  SiMeta,
  SiApplemusic,
  SiSoundcloud,
  SiSpotify,
  SiTiktok,
  SiYoutube,
} from "react-icons/si";
import { DeezerIcon } from "@/shared/ui/deezer-icon";
import type { MarketingPlatformId } from "@/shared/integrations/contracts/marketing.contract";
import {
  IntegrationLogo,
  type IntegrationLogoId,
} from "@/shared/integrations";
import { toUserMessage } from "@/shared/lib/errors";

// ─── Per-platform metadata ───────────────────────────────────────────────────

interface PlatformMeta {
  name: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  logoId?: IntegrationLogoId;
  buttonLabel: string;
  buttonColor: string;
  buttonTextColor: string;
  scopes: string[];
  authProvider: string;
}

const PLATFORM_META: Record<MarketingPlatformId, PlatformMeta> = {
  meta_business: {
    name: "Meta Business Suite",
    icon: SiMeta,
    logoId: "meta_business",
    buttonLabel: "Entrar com o Facebook",
    buttonColor: "#1877F2",
    buttonTextColor: "#ffffff",
    authProvider: "Facebook / Meta",
    scopes: [
      "Aceder a métricas do Facebook e Instagram",
      "Gerir campanhas e conjuntos de anúncios do Meta Ads",
      "Visualizar insights de audiência e alcance",
      "Aceder ao Business Manager da conta",
    ],
  },
  youtube_business: {
    name: "YouTube Business",
    icon: SiYoutube,
    buttonLabel: "Entrar com o Google",
    buttonColor: "#4285F4",
    buttonTextColor: "#ffffff",
    authProvider: "Google",
    scopes: [
      "Aceder ao analytics e relatórios do canal YouTube",
      "Visualizar métricas de vídeos e Shorts",
      "Aceder ao YouTube Studio da conta da empresa",
      "Gerir conteúdo e configurações do canal",
    ],
  },
  tiktok_business: {
    name: "TikTok for Business",
    icon: SiTiktok,
    logoId: "tiktok_business",
    buttonLabel: "Entrar no TikTok",
    buttonColor: "#010101",
    buttonTextColor: "#ffffff",
    authProvider: "TikTok",
    scopes: [
      "Aceder a métricas e analytics do TikTok Business",
      "Visualizar insights de audiência e tendências",
      "Gerir campanhas do TikTok Ads Manager",
      "Aceder ao TikTok Business Center",
    ],
  },
  google_business: {
    name: "Google & YouTube",
    icon: SiGoogle,
    logoId: "google_business",
    buttonLabel: "Entrar com o Google",
    buttonColor: "#4285F4",
    buttonTextColor: "#ffffff",
    authProvider: "Google",
    scopes: [
      "Aceder ao Google Métricas 4 (GA4)",
      "Aceder ao Google Search Console",
      "Gerir campanhas e relatórios do Google Ads",
      "Aceder ao YouTube Studio — canal oficial e analytics",
      "Visualizar métricas de vídeos, Shorts e inscritos",
      "Gerir campanhas de YouTube Ads",
    ],
  },
  corp_spotify: {
    name: "Spotify for Artists",
    icon: SiSpotify,
    buttonLabel: "Entrar no Spotify",
    buttonColor: "#1DB954",
    buttonTextColor: "#000000",
    authProvider: "Spotify",
    scopes: [
      "Aceder ao Spotify for Artists da conta da empresa",
      "Visualizar streams, ouvintes mensais e tendências",
      "Análise de fãs e dados demográficos de audiência",
    ],
  },
  corp_deezer: {
    name: "Deezer for Artists",
    icon: DeezerIcon,
    buttonLabel: "Entrar no Deezer",
    buttonColor: "#FF0092",
    buttonTextColor: "#ffffff",
    authProvider: "Deezer",
    scopes: [
      "Aceder ao Deezer for Artists da conta da empresa",
      "Visualizar streams e dados de audiência",
    ],
  },
  corp_soundcloud: {
    name: "SoundCloud Pro",
    icon: SiSoundcloud,
    buttonLabel: "Entrar no SoundCloud",
    buttonColor: "#FF5500",
    buttonTextColor: "#ffffff",
    authProvider: "SoundCloud",
    scopes: [
      "Aceder ao perfil SoundCloud Pro da empresa",
      "Visualizar reproduções, seguidores e tendências",
    ],
  },
  corp_apple_music: {
    name: "Apple Music for Artists",
    icon: SiApplemusic,
    buttonLabel: "Continuar com o Apple",
    buttonColor: "#555555",
    buttonTextColor: "#ffffff",
    authProvider: "Apple",
    scopes: [
      "Aceder ao Apple Music for Artists",
      "Visualizar streams e dados de audiência no ecossistema Apple",
    ],
  },
  spotify_ads: {
    name: "Spotify Ad Studio",
    icon: SiSpotify,
    logoId: "spotify_ads",
    buttonLabel: "Entrar no Spotify",
    buttonColor: "#1DB954",
    buttonTextColor: "#000000",
    authProvider: "Spotify",
    scopes: [
      "Aceder ao Spotify Ad Studio",
      "Gerir campanhas de áudio e display",
      "Visualizar métricas de frequência e alcance",
    ],
  },
  deezer_ads: {
    name: "Deezer Ad Manager",
    icon: DeezerIcon,
    buttonLabel: "Entrar no Deezer",
    buttonColor: "#FF0092",
    buttonTextColor: "#ffffff",
    authProvider: "Deezer",
    scopes: ["Aceder ao Deezer Ad Manager", "Gerir campanhas de áudio"],
  },
  apple_music_ads: {
    name: "Apple Music Ads",
    icon: SiApplemusic,
    buttonLabel: "Continuar com o Apple",
    buttonColor: "#555555",
    buttonTextColor: "#ffffff",
    authProvider: "Apple",
    scopes: ["Aceder ao Apple Music Ads", "Gerir campanhas no ecossistema Apple"],
  },
  soundcloud_ads: {
    name: "SoundCloud Ads",
    icon: SiSoundcloud,
    buttonLabel: "Entrar no SoundCloud",
    buttonColor: "#FF5500",
    buttonTextColor: "#ffffff",
    authProvider: "SoundCloud",
    scopes: ["Aceder ao SoundCloud Ads", "Gerir campanhas de áudio"],
  },
  corp_instagram: {
    name: "Instagram Corporativo",
    icon: SiInstagram,
    buttonLabel: "Entrar com o Facebook",
    buttonColor: "#E1306C",
    buttonTextColor: "#ffffff",
    authProvider: "Facebook / Meta",
    scopes: ["Aceder ao Instagram Insights da conta corporativa", "Visualizar métricas de Reels e Stories"],
  },
  corp_tiktok: {
    name: "TikTok Corporativo",
    icon: SiTiktok,
    buttonLabel: "Entrar no TikTok",
    buttonColor: "#010101",
    buttonTextColor: "#ffffff",
    authProvider: "TikTok",
    scopes: ["Aceder ao TikTok Métricas da conta corporativa", "Visualizar métricas de vídeos e audiência"],
  },
  corp_youtube: {
    name: "YouTube Corporativo",
    icon: SiYoutube,
    buttonLabel: "Entrar com o Google",
    buttonColor: "#FF0000",
    buttonTextColor: "#ffffff",
    authProvider: "Google",
    scopes: ["Aceder ao YouTube Métricas do canal corporativo", "Visualizar métricas de vídeos e inscritos"],
  },
  meta_ads: {
    name: "Meta Ads",
    icon: SiMeta,
    buttonLabel: "Entrar com o Facebook",
    buttonColor: "#1877F2",
    buttonTextColor: "#ffffff",
    authProvider: "Facebook / Meta",
    scopes: ["Gerir campanhas do Meta Ads Manager", "Visualizar performance de anúncios Facebook e Instagram"],
  },
  google_ads: {
    name: "Google Ads",
    icon: SiGoogleads,
    buttonLabel: "Entrar com o Google",
    buttonColor: "#4285F4",
    buttonTextColor: "#ffffff",
    authProvider: "Google",
    scopes: ["Aceder ao Google Ads Manager", "Gerir campanhas de Search, Display e YouTube Ads"],
  },
  tiktok_ads: {
    name: "TikTok Ads",
    icon: SiTiktok,
    buttonLabel: "Entrar no TikTok",
    buttonColor: "#010101",
    buttonTextColor: "#ffffff",
    authProvider: "TikTok",
    scopes: ["Aceder ao TikTok Ads Manager", "Gerir campanhas e visualizar relatórios de anúncios"],
  },
  youtube_ads: {
    name: "YouTube Ads",
    icon: SiYoutube,
    buttonLabel: "Entrar com o Google",
    buttonColor: "#FF0000",
    buttonTextColor: "#ffffff",
    authProvider: "Google",
    scopes: ["Aceder ao Google Ads para campanhas de YouTube", "Gerir YouTube Ads e métricas de campanhas"],
  },
};

// Platforms whose OAuth is started by the backend (they have their own endpoint)
const BACKEND_OAUTH_PLATFORMS = new Set<MarketingPlatformId>(["spotify_ads", "corp_spotify"]);

// ─── Types ────────────────────────────────────────────────────────────────────

type DialogStep = "permissions" | "waiting" | "success";

interface OAuthMessage {
  type: "musicos360_oauth_success";
  platform: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: MarketingPlatformId;
  onConnect: (platform: MarketingPlatformId, scopes: string[]) => Promise<void>;
}

interface AuthorizationPresentationProps {
  meta: PlatformMeta;
  onCancel: () => void;
  onContinue: () => void;
}

function ScopeRows({
  scopes,
  checkColor,
}: {
  scopes: string[];
  checkColor: string;
}) {
  return (
    <ul className="space-y-2">
      {scopes.map((scope) => (
        <li key={scope} className="flex items-start gap-2 text-xs leading-relaxed">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: checkColor }} />
          {scope}
        </li>
      ))}
    </ul>
  );
}

function MetaAuthorizationPresentation({
  meta,
  onCancel,
  onContinue,
}: AuthorizationPresentationProps) {
  return (
    <>
      <div className="flex items-center gap-3 bg-[#0866ff] px-6 py-5 text-white">
        <IntegrationLogo id="meta_business" className="h-12 w-12 border-0" imageClassName="h-10 w-10" />
        <div>
          <DialogTitle className="text-base text-white">Continuar com Facebook</DialogTitle>
          <DialogDescription className="text-xs text-white/80">
            Autorizar o Meta Business Suite
          </DialogDescription>
        </div>
      </div>
      <div className="space-y-4 px-6 py-5">
        <p className="text-sm font-medium">O MUSIC OS 360 solicita acesso aos ativos empresariais selecionados.</p>
        <div className="rounded-xl border bg-[#f0f2f5] p-4">
          <ScopeRows scopes={meta.scopes} checkColor="#0866ff" />
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A seleção de conta, senha e consentimento acontece exclusivamente no domínio oficial do Facebook.
        </p>
        <AuthorizationActions
          onCancel={onCancel}
          onContinue={onContinue}
          label={meta.buttonLabel}
          background="#0866ff"
          foreground="#ffffff"
        />
      </div>
    </>
  );
}

function TikTokAuthorizationPresentation({
  meta,
  onCancel,
  onContinue,
}: AuthorizationPresentationProps) {
  return (
    <div className="space-y-5 bg-white px-6 py-6 text-[#161823]">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <IntegrationLogo id="tiktok_business" className="h-12 w-12" imageClassName="h-9 w-9" />
          <div>
            <DialogTitle className="text-base text-[#161823]">TikTok for Business</DialogTitle>
            <DialogDescription className="text-xs">Autorização do Business Center</DialogDescription>
          </div>
        </div>
        <span className="h-2.5 w-2.5 rounded-full bg-[#25f4ee] shadow-[5px_0_0_#fe2c55]" />
      </div>
      <div>
        <p className="mb-3 text-sm font-semibold">Acessos solicitados</p>
        <ScopeRows scopes={meta.scopes} checkColor="#fe2c55" />
      </div>
      <p className="text-[11px] leading-relaxed text-[#6b6d75]">
        O TikTok exibirá a conta empresarial, os termos e as permissões finais antes da autorização.
      </p>
      <AuthorizationActions
        onCancel={onCancel}
        onContinue={onContinue}
        label={meta.buttonLabel}
        background="#161823"
        foreground="#ffffff"
      />
    </div>
  );
}

function GoogleAuthorizationPresentation({
  meta,
  onCancel,
  onContinue,
}: AuthorizationPresentationProps) {
  return (
    <div className="space-y-5 bg-[#f8fafd] px-6 py-6 text-[#202124]">
      <IntegrationLogo id="google_business" className="h-12 w-12 border-0 bg-transparent" imageClassName="h-10 w-10" />
      <div>
        <DialogTitle className="text-xl font-normal text-[#202124]">Autorizar Google & YouTube</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-[#5f6368]">
          Escolha sua Conta Google na próxima etapa.
        </DialogDescription>
      </div>
      <div className="rounded-2xl border border-[#dadce0] bg-white p-4">
        <ScopeRows scopes={meta.scopes} checkColor="#1a73e8" />
      </div>
      <p className="text-[11px] leading-relaxed text-[#5f6368]">
        O Google apresentará uma tela oficial para revisar individualmente os acessos solicitados.
      </p>
      <AuthorizationActions
        onCancel={onCancel}
        onContinue={onContinue}
        label={meta.buttonLabel}
        background="#1a73e8"
        foreground="#ffffff"
      />
    </div>
  );
}

function SpotifyAuthorizationPresentation({
  meta,
  onCancel,
  onContinue,
}: AuthorizationPresentationProps) {
  return (
    <div className="space-y-5 bg-[#121212] px-6 py-6 text-white">
      <div className="text-center">
        <IntegrationLogo id="spotify_ads" className="mx-auto h-14 w-14 border-0 bg-transparent" imageClassName="h-12 w-12" />
        <DialogTitle className="mt-4 text-xl text-white">Conectar ao Spotify Ad Studio</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-[#b3b3b3]">
          Autorize sua conta diretamente no Spotify.
        </DialogDescription>
      </div>
      <div className="border-y border-[#292929] py-4">
        <ScopeRows scopes={meta.scopes} checkColor="#1ed760" />
      </div>
      <p className="text-center text-[11px] leading-relaxed text-[#b3b3b3]">
        Os recursos disponíveis dependem das permissões liberadas pelo Spotify para este aplicativo.
      </p>
      <AuthorizationActions
        onCancel={onCancel}
        onContinue={onContinue}
        label={meta.buttonLabel}
        background="#1ed760"
        foreground="#000000"
        dark
      />
    </div>
  );
}

function AuthorizationActions({
  onCancel,
  onContinue,
  label,
  background,
  foreground,
  dark = false,
}: {
  onCancel: () => void;
  onContinue: () => void;
  label: string;
  background: string;
  foreground: string;
  dark?: boolean;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <Button
        variant="outline"
        size="sm"
        className={dark ? "flex-1 border-[#727272] bg-transparent text-white hover:bg-[#242424] hover:text-white" : "flex-1"}
        onClick={onCancel}
      >
        Cancelar
      </Button>
      <Button
        size="sm"
        className="flex-1 gap-1.5 font-semibold"
        style={{ backgroundColor: background, color: foreground, borderColor: background }}
        onClick={onContinue}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {label}
      </Button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MarketingOAuthDialog({ open, onOpenChange, platform, onConnect }: Props) {
  const [step, setStep] = useState<DialogStep>("permissions");
  const popupRef = useRef<Window | null>(null);

  const meta = PLATFORM_META[platform];
  const PlatformIcon = meta.icon;

  const handleSuccess = useCallback(async () => {
    try {
      await onConnect(platform, meta?.scopes ?? []);
      setStep("success");
      setTimeout(() => {
        onOpenChange(false);
        setTimeout(() => setStep("permissions"), 300);
      }, 1800);
    } catch (error) {
      setStep("permissions");
      const message = toUserMessage(error, "Falha ao confirmar a conexão OAuth.");
      toast.error(message);
    }
  }, [platform, meta, onConnect, onOpenChange]);

  // Listens for the popup postMessage
  useEffect(() => {
    if (!open) return;

    const handler = (event: MessageEvent<OAuthMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (
        event.data?.type === "musicos360_oauth_success" &&
        event.data?.platform === platform
      ) {
        popupRef.current = null;
        void handleSuccess();
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [open, platform, handleSuccess]);

  // Polling: detects a closed popup or the success redirect (Spotify)
  useEffect(() => {
    if (step !== "waiting") return;
    const interval = setInterval(() => {
      if (!popupRef.current) return;

      // Spotify: the backend redirects back with ?spotify=connected on the same origin
      if (BACKEND_OAUTH_PLATFORMS.has(platform)) {
        try {
          const href = popupRef.current.location.href;
          if (href.includes("spotify=connected")) {
            popupRef.current.close();
            popupRef.current = null;
            void handleSuccess();
            return;
          }
        } catch { /* cross-origin during the OAuth flow — ignore */ }
      }

      if (popupRef.current?.closed) {
        popupRef.current = null;
        setStep("permissions");
      }
    }, 500);
    return () => clearInterval(interval);
  }, [step, platform, handleSuccess]);

  const openPopup = async () => {
    const w = 480, h = 600;
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
    const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
    const popupFeatures = `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`;

    // Opens the popup IMMEDIATELY (inside the user gesture, before any await)
    // so the browser's popup blocker does not reject the window.
    // The popup starts at about:blank and is navigated to the right URL after the fetch.
    const popup = window.open("about:blank", `musicos360_oauth_${platform}`, popupFeatures);
    if (!popup) {
      toast.error(
        "Pop-up bloqueado pelo navegador. Clique no ícone 🚫 na barra de endereço e permita pop-ups para este site.",
      );
      return;
    }
    popupRef.current = popup;

    let exchangeToken: string;

    try {
      const authToken = getAccessToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/integrations/oauth/init`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ platform }),
      });
      if (!res.ok) {
        popup.close();
        popupRef.current = null;
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        // API HttpException messages are PT-BR user copy; anything else stays in the log.
        const apiMessage = typeof body["message"] === "string" ? body["message"] : null;
        console.error("[OAuth] /oauth/init failed:", res.status, body["message"]);
        toast.error(apiMessage ?? "Não foi possível iniciar a conexão com a plataforma. Tente novamente.");
        return;
      }
      const data = (await res.json()) as { exchange_token: string };
      exchangeToken = data.exchange_token;
    } catch (err) {
      popup.close();
      popupRef.current = null;
      console.error("[OAuth] /oauth/init error:", err);
      toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
      return;
    }


    sessionStorage.setItem(`musicos360_oauth_nonce_${platform}`, exchangeToken);
    popup.location.href = `/oauth/${platform}?nonce=${encodeURIComponent(exchangeToken)}`;
    setStep("waiting");
  };

  const handleClose = (val: boolean) => {
    if (!val && step === "waiting") {
      popupRef.current?.close();
      popupRef.current = null;
    }
    onOpenChange(val);
    if (!val) setTimeout(() => setStep("permissions"), 300);
  };

  if (!meta) return null;

  if (
    step === "permissions" &&
    (
      platform === "meta_business" ||
      platform === "tiktok_business" ||
      platform === "google_business" ||
      platform === "spotify_ads"
    )
  ) {
    const presentationProps: AuthorizationPresentationProps = {
      meta,
      onCancel: () => handleClose(false),
      onContinue: openPopup,
    };

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className={`overflow-hidden p-0 sm:max-w-md ${
            platform === "spotify_ads" ? "border-[#292929] bg-[#121212]" : ""
          }`}
          data-testid={`dialog-oauth-${platform}`}
        >
          {platform === "meta_business" && <MetaAuthorizationPresentation {...presentationProps} />}
          {platform === "tiktok_business" && <TikTokAuthorizationPresentation {...presentationProps} />}
          {platform === "google_business" && <GoogleAuthorizationPresentation {...presentationProps} />}
          {platform === "spotify_ads" && <SpotifyAuthorizationPresentation {...presentationProps} />}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" data-testid={`dialog-oauth-${platform}`}>

        {/* Header with the platform color */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ backgroundColor: meta.buttonColor }}
        >
          {meta.logoId ? (
            <IntegrationLogo
              id={meta.logoId}
              className="h-10 w-10 rounded-lg"
              imageClassName="h-8 w-8"
            />
          ) : (
            <PlatformIcon
              className="h-6 w-6 shrink-0"
              style={{ color: meta.buttonTextColor }}
            />
          )}
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold" style={{ color: meta.buttonTextColor }}>
              {meta.name}
            </DialogTitle>
            <DialogDescription className="text-[11px] opacity-80" style={{ color: meta.buttonTextColor }}>
              Autenticação via {meta.authProvider}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 pb-5 pt-4 space-y-4">

          {/* STEP 1: Permissions */}
          {step === "permissions" && (
            <>
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground  tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Permissões solicitadas
                </p>
                <ul className="space-y-1.5">
                  {meta.scopes.map((scope, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      {scope}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                O MUSIC OS 360 acederá apenas a leitura de métricas e dados desta conta.
                Pode revogar o acesso a qualquer momento.
              </p>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleClose(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs font-semibold gap-1.5"
                  style={{
                    backgroundColor: meta.buttonColor,
                    color: meta.buttonTextColor,
                    borderColor: meta.buttonColor,
                  }}
                  onClick={openPopup}
                  data-testid={`button-oauth-open-${platform}`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {meta.buttonLabel}
                </Button>
              </div>
            </>
          )}

          {/* STEP 2: waiting for the popup */}
          {step === "waiting" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Janela de login aberta</p>
              <p className="text-xs text-muted-foreground text-center">
                Complete o login na janela do {meta.authProvider} que foi aberta.
                <br />Não feche esta janela.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs mt-2"
                onClick={() => { popupRef.current?.focus(); }}
              >
                Reabrir janela de login
              </Button>
            </div>
          )}

          {/* STEP 3: success */}
          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">Conta conectada com sucesso!</p>
              <Badge variant="outline" className="text-xs text-primary border-primary/30">
                {meta.name}
              </Badge>
              <p className="text-xs text-muted-foreground text-center">
                Os dados começarão a sincronizar em breve.
              </p>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}


