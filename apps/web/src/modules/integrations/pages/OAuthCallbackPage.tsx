/**
 * modules/integrations/pages/OAuthCallbackPage.tsx
 *
 * Route: /oauth/callback  (public, no layout)
 *
 * Handles the OAuth authorization code callback for all marketing platforms.
 * The popup window (OAuthPopupPage) redirects to the platform's authorization
 * endpoint; the platform then redirects here with `?code=...&state=<platform>:<nonce>`.
 *
 * Flow:
 *   1. Parse `code` and `state` (`${platform}:${nonce}`) from query params.
 *   2. Validate nonce: compare against opener's sessionStorage
 *      (`musicos360_oauth_nonce_${platform}`) — prevents CSRF / account-linking.
 *   3. POST to /api/integrations/oauth/exchange (NestJS, no auth required).
 *      Backend holds client secrets, exchanges the code and persists encrypted tokens.
 *   4. postMessage({ type, platform }) → opener (same origin); no token enters the browser.
 *   5. Close the popup.
 *
 */

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/shared/lib/env";
import { toUserMessage } from "@/shared/lib/errors";

type ExchangeState =
  | { status: "pending" }
  | { status: "success"; platform: string }
  | { status: "error"; message: string }
  | { status: "no_code" };

/** Nonce storage key used by MarketingOAuthDialog.openPopup(). */
const nonceKey = (platform: string) => `musicos360_oauth_nonce_${platform}`;

export default function OAuthCallbackPage() {
  const [state, setState] = useState<ExchangeState>({ status: "pending" });

  useEffect(() => {

    const params   = new URLSearchParams(window.location.search);
    const code     = params.get("code");
    const rawState = params.get("state") ?? "";
    const error    = params.get("error");

    if (error) {
      setState({ status: "error", message: `Autorização negada pela plataforma: ${error}` });
      return;
    }

    if (!code || !rawState) {
      setState({ status: "no_code" });
      return;
    }

    // State format: `${platform}:${nonce}` — split on first colon only
    const colonIdx = rawState.indexOf(":");
    const platform = colonIdx === -1 ? rawState : rawState.slice(0, colonIdx);
    const nonce    = colonIdx === -1 ? ""        : rawState.slice(colonIdx + 1);

    // ── CSRF nonce validation ────────────────────────────────────────────────
    // The nonce was stored in the opener's sessionStorage by MarketingOAuthDialog.
    // We read it from window.opener (same origin) and compare to what the platform
    // returned in the state param — any mismatch means the callback was not
    // initiated by this tab/session and must be rejected.
    const storedNonce: string | null = (() => {
      try {
        return (window.opener as Window | null)?.sessionStorage?.getItem(nonceKey(platform)) ?? null;
      } catch {
        return null;
      }
    })();

    if (!nonce || !storedNonce || nonce !== storedNonce) {
      setState({
        status:  "error",
        message: "OAuth state inválido ou nonce não encontrado. Inicie a autorização novamente.",
      });
      return;
    }

    // Nonce is valid — consume it immediately to prevent replay.
    try {
      (window.opener as Window | null)?.sessionStorage?.removeItem(nonceKey(platform));
    } catch { /* ignore */ }

    // ── Backend code exchange ────────────────────────────────────────────────
    (async () => {
      try {
        // `nonce` here is the server-issued exchange_token stored by MarketingOAuthDialog.
        // The backend validates it server-side (cache lookup + single-use consumption)
        // and constructs the redirect_uri itself from APP_URL config.
        const res = await fetch(`${API_BASE_URL}/api/v1/integrations/oauth/exchange`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ code, platform, exchange_token: nonce }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as Record<string, unknown>;
          const msg  =
            (body["message"] as string | undefined) ??
            (Array.isArray(body["message"]) ? (body["message"] as string[])[0] : undefined) ??
            `HTTP ${res.status}`;
          setState({ status: "error", message: `Falha na troca do código de autorização: ${msg}` });
          return;
        }

        const payload = (await res.json()) as {
          data?: { connected: boolean; platform: string };
          connected?: boolean;
          platform?: string;
        };
        const data = payload.data ?? payload;
        if (data.connected !== true) {
          setState({ status: "error", message: "O backend não confirmou a persistência da conexão OAuth." });
          return;
        }

        // Notify only the connection result. OAuth credentials remain server-side.
        if (window.opener) {
          (window.opener as Window).postMessage(
            { type: "musicos360_oauth_success", platform: data.platform ?? platform },
            window.location.origin,
          );
        }

        setState({ status: "success", platform: data.platform ?? platform });
        setTimeout(() => window.close(), 1200);
      } catch (err) {
        setState({ status: "error", message: toUserMessage(err, "Não foi possível concluir a conexão. Tente novamente.") });
      }
    })();
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "system-ui, sans-serif",
        background:     "#f5f5f5",
        padding:        24,
      }}
    >
      <div
        style={{
          background:   "#ffffff",
          borderRadius: 12,
          padding:      "36px 32px",
          maxWidth:     380,
          width:        "100%",
          boxShadow:    "0 2px 16px rgba(0,0,0,0.10)",
          textAlign:    "center",
        }}
      >
        {state.status === "pending" && (
          <>
            <Spinner />
            <h2 style={{ margin: "16px 0 8px", fontSize: 18, fontWeight: 700, color: "#111" }}>
              Conectando integração…
            </h2>
            <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
              Aguarde enquanto concluímos a autorização.
            </p>
          </>
        )}

        {state.status === "success" && (
          <>
            <div style={{ fontSize: 40 }}>✓</div>
            <h2 style={{ margin: "12px 0 8px", fontSize: 18, fontWeight: 700, color: "#16a34a" }}>
              Integração autorizada!
            </h2>
            <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
              Esta janela fechará automaticamente.
            </p>
          </>
        )}

        {state.status === "error" && (
          <>
            <div style={{ fontSize: 40 }}>✗</div>
            <h2 style={{ margin: "12px 0 8px", fontSize: 18, fontWeight: 700, color: "#dc2626" }}>
              Erro na autorização
            </h2>
            <p style={{ color: "#666", fontSize: 14, margin: "0 0 16px" }}>
              {state.message}
            </p>
            <button
              onClick={() => window.close()}
              style={{
                padding: "8px 20px", borderRadius: 6, border: "none",
                background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 14,
              }}
            >
              Fechar
            </button>
          </>
        )}

        {state.status === "no_code" && (
          <>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#374151" }}>
              Página de Callback OAuth
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
              Esta página recebe o retorno das plataformas após autorização OAuth.
              Não acesse diretamente.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 40, height: 40, margin: "0 auto", borderRadius: "50%",
        border: "3px solid #e5e7eb", borderTopColor: "#3b82f6",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}
