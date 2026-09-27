import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  Building2,
  Check,
  ChevronRight,
  ExternalLink,
  FileKey2,
  KeyRound,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  IntegrationLogo,
  type IntegrationLogoId,
} from "@/shared/integrations";

type OAuthPlatform =
  | "meta_business"
  | "tiktok_business"
  | "google_business"
  | "youtube_business"
  | "spotify_ads"
  | "corp_spotify"
  | "docusign"
  | "stripe_connect";

type DistributorPlatform =
  | "onerpm"
  | "distrokid"
  | "symphonic"
  | "soundon"
  | "musicpro"
  | "somvibe";

interface OAuthDefinition {
  name: string;
  product: string;
  logoId: IntegrationLogoId;
  accent: string;
  background: string;
  foreground: string;
  buttonText: string;
  permissions: string[];
}

interface DistributorDefinition {
  name: string;
  logoId: IntegrationLogoId;
  portalUrl: string;
  accent: string;
  background: string;
  foreground: string;
  eyebrow: string;
  headline: string;
  instructions: string[];
  capabilities: string[];
  portalButton: string;
  confirmation: string;
}

const CALLBACK_URI = `${window.location.origin}/oauth/callback`;
const META_APP_ID = (import.meta.env.VITE_META_APP_ID as string | undefined) ?? "";
const GOOGLE_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";
const TIKTOK_KEY = (import.meta.env.VITE_TIKTOK_CLIENT_KEY as string | undefined) ?? "";
const DOCUSIGN_INTEGRATION_KEY =
  (import.meta.env.VITE_DOCUSIGN_INTEGRATION_KEY as string | undefined) ?? "";
const DOCUSIGN_AUTH_BASE_URL =
  (import.meta.env.VITE_DOCUSIGN_AUTH_BASE_URL as string | undefined) ??
  "https://account-d.docusign.com";
const STRIPE_CONNECT_CLIENT_ID =
  (import.meta.env.VITE_STRIPE_CONNECT_CLIENT_ID as string | undefined) ?? "";

const OAUTH_DEFINITIONS: Record<OAuthPlatform, OAuthDefinition> = {
  meta_business: {
    name: "Meta",
    product: "Meta Business Suite",
    logoId: "meta_business",
    accent: "#0866ff",
    background: "#f0f2f5",
    foreground: "#1c1e21",
    buttonText: "Continuar com Facebook",
    permissions: [
      "Páginas do Facebook administradas pela empresa",
      "Contas profissionais do Instagram vinculadas",
      "Insights de alcance, audiência e engajamento",
      "Contas de anúncios e ativos do Business Manager",
    ],
  },
  tiktok_business: {
    name: "TikTok",
    product: "TikTok for Business",
    logoId: "tiktok_business",
    accent: "#fe2c55",
    background: "#ffffff",
    foreground: "#161823",
    buttonText: "Continuar no TikTok for Business",
    permissions: [
      "Informações básicas da conta empresarial",
      "Lista de vídeos e métricas disponíveis",
      "Identificação da conta autorizada",
      "Recursos de anúncios sujeitos à aprovação do TikTok",
    ],
  },
  google_business: {
    name: "Google",
    product: "Google & YouTube",
    logoId: "google_business",
    accent: "#1a73e8",
    background: "#ffffff",
    foreground: "#202124",
    buttonText: "Continuar com o Google",
    permissions: [
      "YouTube Analytics e dados do canal em modo leitura",
      "Relatórios e gerenciamento permitido do Google Ads",
      "Seleção da Conta Google que representa a empresa",
      "Acesso offline quando concedido pelo Google",
    ],
  },
  youtube_business: {
    name: "Google",
    product: "YouTube Studio",
    logoId: "google_business",
    accent: "#1a73e8",
    background: "#ffffff",
    foreground: "#202124",
    buttonText: "Continuar com o Google",
    permissions: [
      "Dados básicos e analytics do canal",
      "Vídeos, Shorts e métricas de audiência",
      "Publicação somente quando autorizada",
      "Seleção da Conta Google responsável pelo canal",
    ],
  },
  spotify_ads: {
    name: "Spotify",
    product: "Spotify Ad Studio",
    logoId: "spotify_ads",
    accent: "#1ed760",
    background: "#121212",
    foreground: "#ffffff",
    buttonText: "Continuar no Spotify",
    permissions: [
      "Identificação da conta Spotify autorizada",
      "Acesso aos recursos habilitados para o aplicativo",
      "Métricas e campanhas disponíveis para a conta",
      "Revogação do acesso nas configurações do Spotify",
    ],
  },
  corp_spotify: {
    name: "Spotify",
    product: "Spotify for Artists",
    logoId: "spotify_ads",
    accent: "#1ed760",
    background: "#121212",
    foreground: "#ffffff",
    buttonText: "Continuar no Spotify",
    permissions: [
      "Identificação da conta Spotify autorizada",
      "Perfil e dados públicos disponíveis",
      "Métricas habilitadas para o aplicativo",
      "Revogação do acesso nas configurações do Spotify",
    ],
  },
  docusign: {
    name: "DocuSign",
    product: "DocuSign eSignature",
    logoId: "docusign",
    accent: "#ffcc22",
    background: "#f7f7f7",
    foreground: "#1e1e1e",
    buttonText: "Continuar no DocuSign",
    permissions: [
      "Criar, enviar e consultar envelopes",
      "Consultar status e histórico de assinaturas",
      "Acessar a conta DocuSign selecionada",
      "Manter a autorização conforme o consentimento concedido",
    ],
  },
  stripe_connect: {
    name: "Stripe",
    product: "Stripe Connect",
    logoId: "stripe",
    accent: "#635bff",
    background: "#f6f9fc",
    foreground: "#0a2540",
    buttonText: "Conectar com Stripe",
    permissions: [
      "Vincular uma conta Stripe Standard",
      "Identificar a conta conectada",
      "Operar os recursos concedidos à plataforma",
      "Revogar o vínculo pelo Dashboard da Stripe",
    ],
  },
};

const DISTRIBUTOR_DEFINITIONS: Record<DistributorPlatform, DistributorDefinition> = {
  onerpm: {
    name: "ONErpm",
    logoId: "onerpm",
    portalUrl: "https://app.onerpm.com/",
    accent: "#ef6c00",
    background: "#111111",
    foreground: "#ffffff",
    eyebrow: "ONErpm Distribution",
    headline: "Autorize sua operação de distribuição",
    instructions: [
      "Acesse o painel oficial da ONErpm.",
      "Entre com a conta responsável pelo catálogo ou label.",
      "Confirme que a conta possui acesso aos lançamentos que serão sincronizados.",
    ],
    capabilities: ["Catálogo e lançamentos", "Status de distribuição", "Analytics disponíveis"],
    portalButton: "Abrir painel ONErpm",
    confirmation: "Já validei o acesso no ONErpm",
  },
  distrokid: {
    name: "DistroKid",
    logoId: "distrokid",
    portalUrl: "https://distrokid.com/signin/",
    accent: "#88a82b",
    background: "#d9f20a",
    foreground: "#26310d",
    eyebrow: "DistroKid",
    headline: "Conecte a conta que entrega seus lançamentos",
    instructions: [
      "Abra o login oficial do DistroKid.",
      "Use a conta proprietária dos artistas e lançamentos.",
      "Conclua qualquer verificação adicional solicitada pelo DistroKid.",
    ],
    capabilities: ["Lançamentos enviados", "Artistas da conta", "Acompanhamento operacional"],
    portalButton: "Entrar no DistroKid",
    confirmation: "Conta DistroKid verificada",
  },
  symphonic: {
    name: "Symphonic",
    logoId: "symphonic",
    portalUrl: "https://app.symphonicms.com/",
    accent: "#7c3aed",
    background: "#17112f",
    foreground: "#ffffff",
    eyebrow: "SymphonicMS",
    headline: "Vincule seu portal de distribuição",
    instructions: [
      "Acesse o SymphonicMS pelo endereço oficial.",
      "Selecione a organização ou label correta.",
      "Valide que o usuário possui acesso ao catálogo que será integrado.",
    ],
    capabilities: ["Catálogo da label", "Entregas digitais", "Relatórios autorizados"],
    portalButton: "Abrir SymphonicMS",
    confirmation: "Acesso Symphonic confirmado",
  },
  soundon: {
    name: "SoundOn",
    logoId: "soundon",
    portalUrl: "https://soundon.global/",
    accent: "#fe2c55",
    background: "#ffffff",
    foreground: "#161823",
    eyebrow: "SoundOn powered by TikTok",
    headline: "Conecte sua conta SoundOn",
    instructions: [
      "Abra o portal oficial SoundOn.",
      "Entre usando o método disponibilizado pelo SoundOn na sua região.",
      "Selecione a conta responsável pelos artistas e lançamentos.",
    ],
    capabilities: ["Distribuição SoundOn", "Catálogo associado", "Dados disponibilizados pela conta"],
    portalButton: "Continuar no SoundOn",
    confirmation: "Conta SoundOn validada",
  },
  musicpro: {
    name: "MusicPro",
    logoId: "musicpro",
    portalUrl: "https://app.musicpro.com.br/",
    accent: "#6d28d9",
    background: "#f6f2ff",
    foreground: "#2e1065",
    eyebrow: "MusicPro",
    headline: "Autorize a operação da sua conta",
    instructions: [
      "Acesse o portal MusicPro.",
      "Entre com o usuário responsável pela operação da empresa.",
      "Confirme o catálogo e os recebimentos que pertencem à conta.",
    ],
    capabilities: ["Distribuição musical", "Catálogo administrado", "Recebimentos e relatórios"],
    portalButton: "Abrir portal MusicPro",
    confirmation: "Acesso MusicPro confirmado",
  },
  somvibe: {
    name: "SomVibe",
    logoId: "somvibe",
    portalUrl: "https://somvibe.com.br/",
    accent: "#7200c9",
    background: "#11051d",
    foreground: "#ffffff",
    eyebrow: "SomVibe",
    headline: "Vincule sua operação nacional",
    instructions: [
      "Acesse o ambiente oficial da SomVibe.",
      "Autentique-se com a conta comercial responsável.",
      "Valide com a SomVibe a habilitação necessária para integração.",
    ],
    capabilities: ["Catálogo nacional", "Lançamentos", "Acompanhamento de entregas"],
    portalButton: "Acessar SomVibe",
    confirmation: "Acesso SomVibe confirmado",
  },
};

type PlatformOAuthConfig = {
  authUrl: string;
  clientId: string;
  scopes: string;
  clientIdParam?: string;
};

const PRODUCTION_OAUTH_CONFIGS: Partial<Record<OAuthPlatform, PlatformOAuthConfig>> = {
  meta_business: {
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    clientId: META_APP_ID,
    scopes: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,ads_management,business_management",
  },
  google_business: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: GOOGLE_ID,
    scopes: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/adwords",
  },
  youtube_business: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: GOOGLE_ID,
    scopes: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
  },
  tiktok_business: {
    authUrl: "https://www.tiktok.com/v2/auth/authorize",
    clientId: TIKTOK_KEY,
    clientIdParam: "client_key",
    scopes: "user.info.basic,video.list",
  },
  docusign: {
    authUrl: `${DOCUSIGN_AUTH_BASE_URL}/oauth/auth`,
    clientId: DOCUSIGN_INTEGRATION_KEY,
    clientIdParam: "client_id",
    scopes: "signature extended",
  },
  stripe_connect: {
    authUrl: "https://connect.stripe.com/oauth/authorize",
    clientId: STRIPE_CONNECT_CLIENT_ID,
    clientIdParam: "client_id",
    scopes: "read_write",
  },
};

const BACKEND_AUTH_ENDPOINTS: Partial<Record<OAuthPlatform, string>> = {
  spotify_ads: "/integrations/spotify/auth",
  corp_spotify: "/integrations/spotify/auth",
};

const OFFICIAL_ACCOUNT_PORTALS: Record<OAuthPlatform, string> = {
  meta_business: "https://business.facebook.com/",
  tiktok_business: "https://business.tiktok.com/",
  google_business: "https://accounts.google.com/",
  youtube_business: "https://accounts.google.com/",
  spotify_ads: "https://ads.spotify.com/",
  corp_spotify: "https://artists.spotify.com/",
  docusign: `${DOCUSIGN_AUTH_BASE_URL}/`,
  stripe_connect: "https://dashboard.stripe.com/",
};

function buildOAuthUrl(platform: OAuthPlatform, nonce: string): string | null {
  const config = PRODUCTION_OAUTH_CONFIGS[platform];
  if (!config?.clientId) return null;
  const params = new URLSearchParams({
    [config.clientIdParam ?? "client_id"]: config.clientId,
    redirect_uri: CALLBACK_URI,
    response_type: "code",
    scope: config.scopes,
    state: `${platform}:${nonce}`,
  });
  if (platform === "google_business" || platform === "youtube_business") {
    params.set("access_type", "offline");
    params.set("include_granted_scopes", "true");
    params.set("prompt", "consent");
  }
  return `${config.authUrl}?${params.toString()}`;
}

function ProviderFrame({
  children,
  background,
}: {
  children: ReactNode;
  background: string;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px 16px",
        background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {children}
    </main>
  );
}

function PermissionList({
  items,
  accent,
  foreground,
}: {
  items: string[];
  accent: string;
  foreground: string;
}) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
      {items.map((item) => (
        <li key={item} style={{ display: "flex", gap: 10, color: foreground, fontSize: 13, lineHeight: 1.45 }}>
          <Check size={16} color={accent} style={{ marginTop: 1, flex: "0 0 auto" }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function OAuthExperience({
  platform,
  onContinue,
}: {
  platform: OAuthPlatform;
  onContinue: () => void;
}) {
  const definition = OAUTH_DEFINITIONS[platform];
  const isSpotify = platform === "spotify_ads" || platform === "corp_spotify";
  const isMeta = platform === "meta_business";
  const isTikTok = platform === "tiktok_business";
  const isGoogle = platform === "google_business" || platform === "youtube_business";
  const isDocuSign = platform === "docusign";
  const isStripe = platform === "stripe_connect";

  if (isMeta) {
    return (
      <ProviderFrame background={definition.background}>
        <section style={{ width: "min(430px, 100%)", background: "#fff", borderRadius: 10, boxShadow: "0 2px 16px rgba(0,0,0,.16)", overflow: "hidden" }}>
          <header style={{ background: definition.accent, color: "#fff", padding: "24px 28px", display: "flex", gap: 14, alignItems: "center" }}>
            <IntegrationLogo id={definition.logoId} className="h-12 w-12 border-0" imageClassName="h-10 w-10" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 20 }}>Continuar com Facebook</div>
              <div style={{ opacity: .82, fontSize: 12 }}>para conectar o Meta Business Suite</div>
            </div>
          </header>
          <div style={{ padding: 28 }}>
            <p style={{ margin: "0 0 18px", color: "#1c1e21", fontSize: 15, fontWeight: 600 }}>
              O MUSIC OS 360 solicitará acesso aos ativos empresariais selecionados.
            </p>
            <PermissionList items={definition.permissions} accent={definition.accent} foreground="#3a3b3c" />
            <p style={{ color: "#65676b", fontSize: 12, lineHeight: 1.5, margin: "20px 0" }}>
              A senha é informada somente no domínio oficial do Facebook. O MUSIC OS 360 não recebe suas credenciais.
            </p>
            <ProviderActions definition={definition} onContinue={onContinue} />
          </div>
        </section>
      </ProviderFrame>
    );
  }

  if (isTikTok) {
    return (
      <ProviderFrame background="#fff">
        <section style={{ width: "min(420px, 100%)", color: definition.foreground }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e6e6e6", paddingBottom: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <IntegrationLogo id={definition.logoId} className="h-12 w-12" imageClassName="h-9 w-9" />
              <div>
                <strong style={{ display: "block", fontSize: 17 }}>TikTok for Business</strong>
                <span style={{ color: "#8a8b91", fontSize: 12 }}>Autorização do Business Center</span>
              </div>
            </div>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#25f4ee", boxShadow: "5px 0 0 #fe2c55" }} />
          </div>
          <div style={{ padding: "26px 4px 0" }}>
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Autorizar acesso empresarial</h1>
            <p style={{ color: "#6b6d75", fontSize: 13, lineHeight: 1.55, margin: "0 0 22px" }}>
              Você será levado ao TikTok para escolher a conta e revisar os acessos.
            </p>
            <PermissionList items={definition.permissions} accent={definition.accent} foreground={definition.foreground} />
            <div style={{ marginTop: 24 }}>
              <ProviderActions definition={definition} onContinue={onContinue} />
            </div>
          </div>
        </section>
      </ProviderFrame>
    );
  }

  if (isGoogle) {
    return (
      <ProviderFrame background="#f8fafd">
        <section style={{ width: "min(520px, 100%)", background: "#fff", border: "1px solid #dadce0", borderRadius: 24, padding: "34px 38px", color: definition.foreground }}>
          <IntegrationLogo id={definition.logoId} className="h-12 w-12 border-0 bg-transparent" imageClassName="h-10 w-10" />
          <h1 style={{ fontSize: 28, fontWeight: 400, margin: "22px 0 8px" }}>Autorizar {definition.product}</h1>
          <p style={{ color: "#5f6368", fontSize: 14, lineHeight: 1.55, margin: "0 0 24px" }}>
            O Google exibirá a seleção de conta e a tela oficial de consentimento.
          </p>
          <div style={{ border: "1px solid #dadce0", borderRadius: 12, padding: 18 }}>
            <PermissionList items={definition.permissions} accent={definition.accent} foreground={definition.foreground} />
          </div>
          <p style={{ color: "#5f6368", fontSize: 12, lineHeight: 1.5, margin: "18px 0" }}>
            Revise cada permissão na tela do Google. Nenhuma senha é digitada nesta aplicação.
          </p>
          <ProviderActions definition={definition} onContinue={onContinue} />
        </section>
      </ProviderFrame>
    );
  }

  if (isSpotify) {
    return (
      <ProviderFrame background={definition.background}>
        <section style={{ width: "min(460px, 100%)", color: definition.foreground, textAlign: "center" }}>
          <IntegrationLogo id={definition.logoId} className="mx-auto h-16 w-16 border-0 bg-transparent" imageClassName="h-14 w-14" />
          <h1 style={{ fontSize: 30, margin: "20px 0 8px" }}>Conectar ao {definition.product}</h1>
          <p style={{ color: "#b3b3b3", fontSize: 14, lineHeight: 1.55, margin: "0 auto 26px", maxWidth: 390 }}>
            Continue no Spotify para autenticar sua conta e revisar os acessos disponíveis para o aplicativo.
          </p>
          <div style={{ textAlign: "left", borderTop: "1px solid #292929", borderBottom: "1px solid #292929", padding: "20px 0" }}>
            <PermissionList items={definition.permissions} accent={definition.accent} foreground="#ffffff" />
          </div>
          <div style={{ marginTop: 24 }}>
            <ProviderActions definition={definition} onContinue={onContinue} />
          </div>
        </section>
      </ProviderFrame>
    );
  }

  if (isDocuSign) {
    return (
      <ProviderFrame background="#f7f7f7">
        <section style={{ width: "min(460px, 100%)", background: "#fff", border: "1px solid #d8d8d8", borderRadius: 8, overflow: "hidden", color: "#1e1e1e", boxShadow: "0 8px 28px rgba(0,0,0,.12)" }}>
          <header style={{ padding: "22px 28px", borderBottom: "4px solid #ffcc22", display: "flex", alignItems: "center", gap: 14 }}>
            <IntegrationLogo id="docusign" className="h-12 w-12" imageClassName="h-10 w-10" />
            <div>
              <strong style={{ display: "block", fontSize: 18 }}>DocuSign eSignature</strong>
              <span style={{ color: "#666", fontSize: 12 }}>Autorização de aplicativo</span>
            </div>
          </header>
          <div style={{ padding: 28 }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Conectar sua conta DocuSign</h1>
            <p style={{ color: "#555", fontSize: 13, lineHeight: 1.55, margin: "0 0 22px" }}>
              Você será encaminhado ao ambiente oficial do DocuSign para entrar, selecionar a conta e conceder consentimento.
            </p>
            <PermissionList items={definition.permissions} accent="#b08a00" foreground="#333" />
            <div style={{ marginTop: 24 }}>
              <ProviderActions definition={definition} onContinue={onContinue} />
            </div>
          </div>
        </section>
      </ProviderFrame>
    );
  }

  if (isStripe) {
    return (
      <ProviderFrame background="#f6f9fc">
        <section style={{ width: "min(480px, 100%)", background: "#fff", borderRadius: 14, padding: 30, color: "#0a2540", boxShadow: "0 15px 45px rgba(50,50,93,.14)" }}>
          <IntegrationLogo id="stripe" className="h-14 w-14 border-0 bg-transparent" imageClassName="h-12 w-12" />
          <h1 style={{ margin: "20px 0 8px", fontSize: 25 }}>Conectar uma conta Stripe</h1>
          <p style={{ color: "#425466", fontSize: 14, lineHeight: 1.55, margin: "0 0 22px" }}>
            A próxima etapa acontece no Stripe Connect, onde a empresa entra na conta existente ou conclui o cadastro oficial.
          </p>
          <div style={{ border: "1px solid #e6ebf1", borderRadius: 10, padding: 18 }}>
            <PermissionList items={definition.permissions} accent="#635bff" foreground="#0a2540" />
          </div>
          <p style={{ color: "#697386", fontSize: 11, lineHeight: 1.5, margin: "18px 0" }}>
            Dados bancários, identidade e credenciais são tratados exclusivamente pela Stripe.
          </p>
          <ProviderActions definition={definition} onContinue={onContinue} />
        </section>
      </ProviderFrame>
    );
  }

  return null;
}

function ProviderActions({
  definition,
  onContinue,
}: {
  definition: OAuthDefinition;
  onContinue: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
      <button
        type="button"
        onClick={() => window.close()}
        style={secondaryButton}
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onContinue}
        style={{
          ...primaryButton,
          background: definition.accent,
          color: definition.name === "Spotify" ? "#000" : "#fff",
        }}
      >
        {definition.buttonText}
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function DistributorExperience({
  platform,
}: {
  platform: DistributorPlatform;
}) {
  const definition = DISTRIBUTOR_DEFINITIONS[platform];

  return (
    <ProviderFrame background={definition.background}>
      <section
        style={{
          width: "min(480px, 100%)",
          background: definition.background,
          color: definition.foreground,
          border: `1px solid color-mix(in srgb, ${definition.foreground} 18%, transparent)`,
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 18px 50px rgba(0,0,0,.2)",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <IntegrationLogo id={definition.logoId} className="h-14 w-14" imageClassName="h-12 w-12" />
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", opacity: .65 }}>
              {definition.eyebrow}
            </span>
            <h1 style={{ fontSize: 22, lineHeight: 1.2, margin: "4px 0 0" }}>{definition.headline}</h1>
          </div>
        </div>

        <ol style={{ margin: "26px 0 22px", padding: 0, listStyle: "none", display: "grid", gap: 14 }}>
          {definition.instructions.map((instruction, index) => (
            <li key={instruction} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: definition.accent, color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, flex: "0 0 auto" }}>
                {index + 1}
              </span>
              {instruction}
            </li>
          ))}
        </ol>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 22 }}>
          {definition.capabilities.map((capability) => (
            <div key={capability} style={{ border: `1px solid color-mix(in srgb, ${definition.foreground} 18%, transparent)`, borderRadius: 10, padding: "10px 8px", fontSize: 11, textAlign: "center", lineHeight: 1.35 }}>
              {capability}
            </div>
          ))}
        </div>

        <a
          href={definition.portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...primaryButton,
            width: "100%",
            boxSizing: "border-box",
            background: definition.accent,
            color: "#fff",
            textDecoration: "none",
          }}
        >
          {definition.portalButton}
          <ExternalLink size={16} />
        </a>

        <p style={{ fontSize: 11, opacity: .62, lineHeight: 1.45, margin: "16px 0 0", textAlign: "center" }}>
          O MUSIC OS 360 não solicita nem armazena a senha da sua distribuidora.
          Abrir o portal não conecta a conta ao sistema. A integração depende de API ou parceria técnica habilitada pelo provedor.
        </p>
      </section>
    </ProviderFrame>
  );
}

function OneRpmExperience() {
  return <DistributorExperience platform="onerpm" />;
}

function DistroKidExperience() {
  return <DistributorExperience platform="distrokid" />;
}

function SymphonicExperience() {
  return <DistributorExperience platform="symphonic" />;
}

function SoundOnExperience() {
  return <DistributorExperience platform="soundon" />;
}

function MusicProExperience() {
  return <DistributorExperience platform="musicpro" />;
}

function SomvibeExperience() {
  return <DistributorExperience platform="somvibe" />;
}

function DistributorPlatformExperience({
  platform,
}: {
  platform: DistributorPlatform;
}) {
  switch (platform) {
    case "onerpm":
      return <OneRpmExperience />;
    case "distrokid":
      return <DistroKidExperience />;
    case "symphonic":
      return <SymphonicExperience />;
    case "soundon":
      return <SoundOnExperience />;
    case "musicpro":
      return <MusicProExperience />;
    case "somvibe":
      return <SomvibeExperience />;
  }
}

function NfeExperience() {
  const [method, setMethod] = useState<"a1" | "a3" | "api">("a1");
  const methods = [
    { id: "a1" as const, title: "Certificado A1", description: "Arquivo PFX/P12 e senha do certificado", icon: Upload },
    { id: "a3" as const, title: "Certificado A3", description: "Token ou cartão conectado ao ambiente emissor", icon: FileKey2 },
    { id: "api" as const, title: "Provedor fiscal", description: "Token de Focus NFe, NFe.io, PlugNotas ou equivalente", icon: KeyRound },
  ];

  return (
    <ProviderFrame background="#eef2f5">
      <section style={{ width: "min(520px, 100%)", background: "#fff", border: "1px solid #cbd5df", borderRadius: 14, overflow: "hidden", color: "#263238" }}>
        <header style={{ padding: "22px 26px", background: "linear-gradient(135deg,#176b35,#2f8d46)", color: "#fff", display: "flex", gap: 14, alignItems: "center" }}>
          <IntegrationLogo id="nfe" className="h-14 w-14" imageClassName="h-12 w-12" />
          <div>
            <span style={{ fontSize: 11, opacity: .8 }}>CONFIGURAÇÃO FISCAL</span>
            <h1 style={{ margin: "3px 0 0", fontSize: 21 }}>NF-e / Nota Fiscal Eletrônica</h1>
          </div>
        </header>
        <div style={{ padding: 26 }}>
          <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.55, color: "#546e7a" }}>
            A NF-e não utiliza um login OAuth único da SEFAZ. Selecione o método efetivamente usado pela empresa ou pelo provedor emissor.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {methods.map(({ id, title, description, icon: Icon }) => {
              const active = method === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMethod(id)}
                  style={{
                    border: active ? "2px solid #2f8d46" : "1px solid #cfd8dc",
                    borderRadius: 10,
                    background: active ? "#eef8f0" : "#fff",
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <Icon size={21} color="#2f8d46" />
                  <span style={{ flex: 1 }}>
                    <strong style={{ display: "block", color: "#263238", fontSize: 14 }}>{title}</strong>
                    <span style={{ display: "block", color: "#607d8b", fontSize: 12, marginTop: 3 }}>{description}</span>
                  </span>
                  {active && <Check size={18} color="#2f8d46" />}
                </button>
              );
            })}
          </div>
          <div style={{ background: "#f7f9fa", borderRadius: 10, padding: 14, marginTop: 18, display: "flex", gap: 10 }}>
            <ShieldCheck size={18} color="#176b35" style={{ flex: "0 0 auto" }} />
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "#546e7a" }}>
              Certificados, senhas e tokens fiscais devem ser enviados somente ao backend seguro do MUSIC OS 360.
              Eles não são solicitados nesta página de apresentação.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <button type="button" onClick={() => window.close()} style={secondaryButton}>Cancelar</button>
            <button type="button" onClick={() => window.close()} style={{ ...primaryButton, background: "#176b35", color: "#fff" }}>
              Fechar
            </button>
          </div>
        </div>
      </section>
    </ProviderFrame>
  );
}

function UnknownExperience({ platform }: { platform: string }) {
  return (
    <ProviderFrame background="#f5f7fa">
      <section style={{ width: "min(400px, 100%)", padding: 28, borderRadius: 14, background: "#fff", border: "1px solid #dfe3e8", textAlign: "center" }}>
        <Building2 size={32} color="#64748b" />
        <h1 style={{ fontSize: 18 }}>Integração indisponível</h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>Não existe experiência de autorização configurada para “{platform}”.</p>
        <button type="button" onClick={() => window.close()} style={secondaryButton}>Fechar</button>
      </section>
    </ProviderFrame>
  );
}

function Redirecting({ definition }: { definition: OAuthDefinition }) {
  return (
    <ProviderFrame background={definition.background}>
      <div style={{ color: definition.foreground, textAlign: "center" }}>
        <IntegrationLogo id={definition.logoId} className="mx-auto h-14 w-14" imageClassName="h-12 w-12" />
        <Loader2 size={30} style={{ margin: "20px auto 12px", animation: "spin .8s linear infinite" }} />
        <p style={{ fontSize: 14 }}>Abrindo a autorização oficial de {definition.name}…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </ProviderFrame>
  );
}

function OAuthUnavailable({ definition }: { definition: OAuthDefinition }) {
  return (
    <ProviderFrame background={definition.background}>
      <section style={{ width: "min(400px, 100%)", padding: 28, borderRadius: 14, background: definition.name === "Spotify" ? "#181818" : "#fff", color: definition.foreground, textAlign: "center", boxShadow: "0 12px 35px rgba(0,0,0,.18)" }}>
        <IntegrationLogo id={definition.logoId} className="mx-auto h-14 w-14" imageClassName="h-12 w-12" />
        <h1 style={{ fontSize: 19 }}>OAuth não configurado</h1>
        <p style={{ fontSize: 13, lineHeight: 1.55, opacity: .72 }}>
          Configure o cliente oficial de {definition.name} no servidor antes de conectar esta integração.
        </p>
        <button type="button" onClick={() => window.close()} style={{ ...secondaryButton, color: definition.foreground }}>Fechar</button>
      </section>
    </ProviderFrame>
  );
}

const primaryButton: CSSProperties = {
  border: 0,
  borderRadius: 8,
  minHeight: 42,
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  minHeight: 42,
  padding: "0 18px",
  background: "transparent",
  color: "#475569",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

function isOAuthPlatform(value: string): value is OAuthPlatform {
  return value in OAUTH_DEFINITIONS;
}

function isDistributorPlatform(value: string): value is DistributorPlatform {
  return value in DISTRIBUTOR_DEFINITIONS;
}

export default function OAuthPopupPage() {
  const { platform = "google_business" } = useParams<{ platform: string }>();
  const nonce = new URLSearchParams(window.location.search).get("nonce") ?? "";
  const [oauthError, setOauthError] = useState(false);

  useEffect(() => {
    if (!isOAuthPlatform(platform)) return;

    const backendPath = BACKEND_AUTH_ENDPOINTS[platform];
    if (backendPath) {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001/api/v1";
      try {
        const sessionData = JSON.parse(localStorage.getItem("musicos360_auth") ?? "null") as { access_token?: string } | null;
        if (!sessionData?.access_token) {
          setOauthError(true);
          return;
        }
        fetch(`${apiBase}${backendPath}`, {
          headers: { Authorization: `Bearer ${sessionData.access_token}` },
        })
          .then((response) => response.json())
          .then((data: { url?: string }) => {
            if (data.url) window.location.replace(data.url);
            else setOauthError(true);
          })
          .catch(() => setOauthError(true));
      } catch {
        setOauthError(true);
      }
      return;
    }

    const url = buildOAuthUrl(platform, nonce);
    if (url) window.location.replace(url);
    else setOauthError(true);
  }, [nonce, platform]);

  if (platform === "nfe") return <NfeExperience />;
  if (isDistributorPlatform(platform)) {
    return <DistributorPlatformExperience platform={platform} />;
  }

  if (isOAuthPlatform(platform)) {
    const definition = OAUTH_DEFINITIONS[platform];
    return oauthError
      ? <OAuthUnavailable definition={definition} />
      : <Redirecting definition={definition} />;
  }

  return <UnknownExperience platform={platform} />;
}
