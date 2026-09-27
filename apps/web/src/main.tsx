import { createRoot } from "react-dom/client";
import "./index.css";
import { validateFrontendEnv } from "@/shared/lib/env";
import { installZodErrorMapPtBr } from "@/shared/lib/zod-pt-br";

installZodErrorMapPtBr();

function renderStartupError(error: unknown): void {
  const root = document.getElementById("root");
  if (!root) return;

  // Internal diagnostic: always reported to the console; rendered ONLY in dev.
  // Every string is inserted via textContent (never interpolated into HTML).
  console.error("[startup] unhandled error", error);
  const diagnostic = import.meta.env.DEV
    ? `${error instanceof Error ? error.message : String(error)}${error instanceof Error && error.stack ? `\n\n${error.stack}` : ""}`
    : null;

  const page = document.createElement("div");
  page.setAttribute("style", "min-height:100vh;background:#11161d;color:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:32px");
  const card = document.createElement("div");
  card.setAttribute("style", "max-width:880px;margin:0 auto;border:1px solid rgba(248,250,252,.16);border-radius:8px;background:rgba(23,29,37,.92);padding:24px");
  const eyebrow = document.createElement("p");
  eyebrow.setAttribute("style", "margin:0 0 8px;color:#f87171;font-size:13px;font-weight:700;letter-spacing:.04em");
  eyebrow.textContent = "Erro ao iniciar o app";
  const title = document.createElement("h1");
  title.setAttribute("style", "margin:0 0 16px;font-size:22px;line-height:1.25");
  title.textContent = "MUSIC OS 360 não conseguiu renderizar";
  const body = document.createElement("p");
  body.setAttribute("style", "margin:0 0 16px;font-size:14px;line-height:1.5");
  body.textContent = "Ocorreu um erro inesperado. Recarregue a página ou tente novamente em instantes.";
  card.append(eyebrow, title, body);
  if (diagnostic) {
    const pre = document.createElement("pre");
    pre.setAttribute("style", "white-space:pre-wrap;overflow:auto;background:#0a0d12;border:1px solid rgba(248,250,252,.12);border-radius:6px;padding:16px;font-size:12px;line-height:1.5");
    pre.textContent = diagnostic;
    card.append(pre);
  }
  page.append(card);
  root.replaceChildren(page);
}

window.addEventListener("error", (event) => {
  renderStartupError(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  renderStartupError(event.reason);
});

// Validate required env vars before mounting anything.
// Returns false and renders an error page in production if vars are missing.
if (!validateFrontendEnv()) {
  // Halt — error page already injected into #root.
  throw new Error("Missing required environment variables — see console for details.");
}

// ── Sentry (error monitoring) ─────────────────────────────────────────────
async function initObservability(): Promise<void> {
  if (import.meta.env.VITE_SENTRY_DSN) {
    try {
      const Sentry = await import("@sentry/react");
      Sentry.init({
        dsn:         import.meta.env.VITE_SENTRY_DSN as string,
        environment: import.meta.env.MODE as string,
        release:     import.meta.env.VITE_APP_VERSION as string | undefined,
        tracesSampleRate:   0.1,
        replaysSessionSampleRate: 0.05,
        replaysOnErrorSampleRate:  1.0,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
      });
    } catch (error) {
      console.warn("[MUSIC OS 360] Sentry disabled in this runtime:", error);
    }
  }

// ── PostHog (product analytics) ───────────────────────────────────────────
  if (import.meta.env.VITE_POSTHOG_KEY) {
    try {
      const { default: posthog } = await import("posthog-js");
      posthog.init(import.meta.env.VITE_POSTHOG_KEY as string, {
        api_host:        "https://app.posthog.com",
        capture_pageview: true,
        capture_pageleave: true,
        autocapture:      false,
        session_recording: { maskAllInputs: true },
      });
    } catch (error) {
      console.warn("[MUSIC OS 360] PostHog disabled in this runtime:", error);
    }
  }
}

async function bootstrap(): Promise<void> {
  try {
    const root = document.getElementById("root")!;
    await initObservability();
    const { default: App } = await import("./App");
    createRoot(root).render(<App />);
  } catch (error) {
    renderStartupError(error);
    throw error;
  }
}

void bootstrap();
