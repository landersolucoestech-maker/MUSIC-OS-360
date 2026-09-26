import { useState, forwardRef } from "react";
import { Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/app/providers/AuthContext";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  EyeOff,
  Facebook,
  Globe,
  Instagram,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  User,
  UsersRound,
} from "lucide-react";
import { authRateLimiter } from "@/shared/lib/security";
import { AUTH_DISABLED, authEnvironmentLabel, maskedSupabaseRef, BUILD_COMMIT_SHA } from "@/shared/lib/env";
import { describeAuthError, isCredentialsError } from "@/shared/lib/auth-error-messages";
import { Button } from "@/shared/ui/button";
import { loginSchema, forgotSchema, type LoginData, type ForgotData } from "./login-schema";

/**
 * Parte 75 — identificador seguro de ambiente na própria tela de login.
 * Elimina ambiguidade sobre qual Supabase/build este frontend está usando
 * sem nunca expor a URL completa ou a anon key.
 */
function AuthEnvironmentBadge() {
  return (
    <p className="mt-4 text-center text-[10px] uppercase tracking-wider text-muted-foreground/60">
      Ambiente: {authEnvironmentLabel()} · Projeto: {maskedSupabaseRef()} · Build: {BUILD_COMMIT_SHA}
    </p>
  );
}

type Mode = "login" | "forgot";

export default function Auth() {
  const { user, loading } = useAuth();

  if (AUTH_DISABLED) return <AuthPage />;
  if (!loading && user) return <Navigate to="/" replace />;

  return <AuthPage />;
}

function LogoMark() {
  return (
    <div className="inline-flex items-center gap-3 select-none">
      <svg
        viewBox="0 0 155 125"
        className="h-12 w-auto shrink-0 text-primary"
        fill="currentColor"
        role="img"
        aria-label="MUSIC OS 360"
      >
        <rect x="0" y="51" width="13" height="30" rx="6" />
        <rect x="21" y="35" width="15" height="62" rx="7" />
        <rect x="44" y="21" width="17" height="90" rx="8" />
        <rect x="69" y="7" width="20" height="118" rx="10" />
        <rect x="97" y="29" width="16" height="74" rx="8" />
        <rect x="121" y="45" width="14" height="42" rx="7" />
        <rect x="143" y="55" width="12" height="22" rx="6" />
      </svg>
      <span className="flex flex-col justify-center">
        <span className="block text-2xl font-black leading-[1.15] tracking-[0.1em] text-foreground">MUSIC</span>
        <span className="block text-2xl font-black leading-[1.15] tracking-[0.1em] text-primary">OS 360</span>
      </span>
    </div>
  );
}

const benefits = [
  { icon: BarChart3, title: "Analytics", text: "Dados que geram estratégias." },
  { icon: ShieldCheck, title: "Segurança", text: "Proteção total para suas informações." },
  { icon: UsersRound, title: "Integração", text: "Conecte artistas, equipes e parceiros." },
  { icon: TrendingUp, title: "Performance", text: "Acompanhe e impulsione resultados." },
];

function AuthPage() {
  const location = useLocation();
  const [mode, setMode] = useState<Mode>(
    location.pathname === "/forgot-password" ? "forgot" : "login",
  );

  return (
    <main className="auth-layout grid min-h-screen overflow-x-hidden bg-background text-foreground lg:grid-cols-[44%_56%]">
      {/* Painel esquerdo — login (identidade visual do sistema) */}
      <section className="auth-login-left relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-8">
        <div className="relative z-10 flex w-full max-w-[420px] flex-col">
          <div className="mb-6 flex justify-center">
            <LogoMark />
          </div>

          <div className="mb-6 text-center">
            <p className="text-base font-semibold text-foreground">
              Sistema de Gestão Musical
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Plataforma completa para gestão operacional da indústria musical.
            </p>
          </div>

          <div className="rounded-lg bg-transparent p-6 sm:p-7">
            {mode === "login" && <LoginForm onForgot={() => setMode("forgot")} />}
            {mode === "forgot" && <ForgotForm onBack={() => setMode("login")} />}
          </div>

          <footer className="pt-7">
            <div className="mb-3 flex justify-center gap-7">
              {[Facebook, Instagram, MessageCircle, Globe].map((Icon, index) => (
                <a
                  key={index}
                  href="#"
                  aria-label="Canal social MUSIC OS 360"
                  className="text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                >
                  <Icon size={20} />
                </a>
              ))}
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              © MUSIC OS 360. Todos os direitos reservados.
            </p>
            <AuthEnvironmentBadge />
          </footer>
        </div>
      </section>

      {/* Painel direito — foto do card 3D + conteudo institucional (HTML responsivo) */}
      <section
        className="auth-hero-right relative hidden min-h-screen flex-col justify-end overflow-hidden bg-[#0b0a09] bg-[length:100%_auto] bg-top bg-no-repeat lg:flex"
        style={{ backgroundImage: "url('/auth-card.png')" }}
        aria-label="MUSIC OS 360"
      >
        {/* gradiente: funde a base da foto na cor do painel */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0a09] via-[#0b0a09]/85 via-30% to-transparent to-55%" />

        <div className="relative z-10 px-8 pb-12 xl:px-14 xl:pb-16">
          <h2 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
            Gestão. Controle. Crescimento.
          </h2>
          <p className="mt-3 max-w-md text-base leading-7 text-slate-300">
            Tudo o que você precisa para levar sua empresa mais longe.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {benefits.map(({ icon: Icon, title, text }) => (
              <div key={title} className="border-l border-white/15 pl-4">
                <Icon className="mb-3 h-6 w-6 text-primary" />
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-white">
                  {title}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ElementType;
  error?: string;
  showToggle?: boolean;
  onToggle?: () => void;
  showPass?: boolean;
}

const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  function AuthInput(
    { icon: Icon, error, showToggle, onToggle, showPass, type, placeholder, ...rest },
    ref,
  ) {
    return (
      <div>
        <div className="relative flex items-center">
          <Icon
            size={16}
            className="pointer-events-none absolute left-3 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={ref}
            type={showToggle ? (showPass ? "text" : "password") : type}
            placeholder={placeholder}
            aria-label={typeof placeholder === "string" ? placeholder : undefined}
            className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-10 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            {...rest}
          />
          {showToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-2.5 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1.5 pl-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  },
);

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginData) => {
    if (authRateLimiter.isBlocked(data.email)) {
      const min = Math.ceil(
        authRateLimiter.getTimeUntilReset(data.email) / 60000,
      );
      toast.error(`Conta bloqueada. Tente em ${min} minutos.`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        // Parte 77 — só uma credencial genuinamente errada consome uma
        // tentativa; rede/servidor indisponível nunca bloqueia o usuário.
        if (isCredentialsError(error)) {
          authRateLimiter.recordFailure(data.email);
          toast.error(
            `${describeAuthError(error)} ${authRateLimiter.getRemainingAttempts(data.email)} tentativas restantes.`,
          );
        } else {
          toast.error(describeAuthError(error));
        }
      } else {
        authRateLimiter.reset(data.email);
        toast.success("Bem-vindo ao MUSIC OS 360!");
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      toast.error(describeAuthError({ message: (err as { message?: string })?.message ?? "" }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
      <AuthInput
        icon={User}
        type="email"
        placeholder="Digite seu e-mail"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <AuthInput
        icon={Lock}
        type="password"
        placeholder="Digite sua senha"
        autoComplete="current-password"
        showToggle
        showPass={showPass}
        onToggle={() => setShowPass((current) => !current)}
        error={errors.password?.message}
        {...register("password")}
      />

      <Button
        type="submit"
        disabled={loading}
        className="mt-1 h-11 w-full text-sm font-semibold uppercase tracking-[0.08em]"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Acessando...
          </>
        ) : (
          "Acessar o sistema"
        )}
      </Button>

      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={onForgot}
          className="w-full rounded text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          Esqueci minha senha
        </button>
        <Link
          to="/register"
          className="mt-3 block rounded text-sm font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          Criar nova conta
        </Link>
      </div>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotData) => {
    setLoading(true);
    try {
      const { error } = await resetPassword(data.email);
      if (error) toast.error(describeAuthError(error, "Não foi possível enviar o e-mail de recuperação. Tente novamente."));
      else {
        toast.success("Email enviado! Verifique sua caixa de entrada.");
        onBack();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-foreground">Recuperar senha</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Digite seu e-mail para receber um link de redefinição.
        </p>
      </div>

      <AuthInput
        icon={Mail}
        type="email"
        placeholder="Seu e-mail"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />

      <Button
        type="submit"
        disabled={loading}
        className="mt-1 h-11 w-full text-sm font-semibold uppercase tracking-[0.08em]"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Enviando...
          </>
        ) : (
          "Enviar link"
        )}
      </Button>

      <button
        type="button"
        onClick={onBack}
        className="flex w-full items-center justify-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <ArrowLeft size={14} /> Voltar ao login
      </button>
    </form>
  );
}
