import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, User, Lock, Facebook, Instagram, MessageCircle, Globe, Mail, ArrowLeft } from "lucide-react";
import { authRateLimiter, isLeakedPassword } from "@/lib/security";

// Password complexity validation with leaked password protection
const passwordSchema = z
  .string()
  .min(8, "Senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
  .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
  .regex(/[0-9]/, "Senha deve conter pelo menos um número")
  .regex(/[^A-Za-z0-9]/, "Senha deve conter pelo menos um caractere especial (!@#$%^&*)")
  .refine((password) => !isLeakedPassword(password), {
    message: "Esta senha foi vazada em violações de dados. Por segurança, escolha outra senha.",
  });

const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres").max(100, "Nome muito longo"),
    email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
});

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

type AuthMode = "login" | "signup" | "forgot" | "reset";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp, resetPassword, updatePassword, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  useEffect(() => {
    // Check if we're in reset password mode (from email link)
    const modeParam = searchParams.get("mode");
    if (modeParam === "reset") {
      setMode("reset");
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && !authLoading && mode !== "reset") {
      navigate("/");
    }
  }, [user, authLoading, navigate, mode]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const handleLogin = async (data: LoginFormData) => {
    if (!authRateLimiter.check(data.email)) {
      const timeRemaining = Math.ceil(authRateLimiter.getTimeUntilReset(data.email) / 60000);
      toast.error(`Conta bloqueada temporariamente. Tente novamente em ${timeRemaining} minutos.`);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        const remaining = authRateLimiter.getRemainingAttempts(data.email);
        if (error.message.includes("Invalid login credentials")) {
          toast.error(`Email ou senha incorretos. ${remaining} tentativas restantes.`);
        } else {
          toast.error(error.message);
        }
      } else {
        authRateLimiter.reset(data.email);
        toast.success("Bem-vindo! Login realizado com sucesso");
        navigate("/");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signUp(data.email, data.password, data.fullName);
      if (error) {
        if (error.message.includes("User already registered")) {
          toast.error("Este email já está em uso. Tente fazer login.");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Conta criada! Você já pode acessar o sistema");
        navigate("/");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await resetPassword(data.email);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Email enviado! Verifique sua caixa de entrada para redefinir sua senha.");
        setMode("login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await updatePassword(data.password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Senha atualizada! Sua senha foi alterada com sucesso.");
        navigate("/");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderForm = () => {
    switch (mode) {
      case "forgot":
        return (
          <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)} className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-primary-foreground">Recuperar Senha</h2>
              <p className="text-sm text-gray-400">Digite seu email para receber um link de redefinição</p>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="email"
                  placeholder="Digite seu Email"
                  className="flex h-14 w-full rounded-lg border-0 bg-gray-100 pl-12 px-3 py-2 text-base text-gray-700 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...forgotPasswordForm.register("email")}
                />
              </div>
              {forgotPasswordForm.formState.errors.email && (
                <p className="text-sm font-medium text-destructive">
                  {forgotPasswordForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wider rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ENVIANDO...
                </>
              ) : (
                "ENVIAR LINK DE RECUPERAÇÃO"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-primary-foreground"
              onClick={() => setMode("login")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Login
            </Button>
          </form>
        );

      case "reset":
        return (
          <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-primary-foreground">Nova Senha</h2>
              <p className="text-sm text-gray-400">Digite sua nova senha</p>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="password"
                  placeholder="Nova Senha"
                  className="flex h-14 w-full rounded-lg border-0 bg-gray-100 pl-12 px-3 py-2 text-base text-gray-700 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...resetPasswordForm.register("password")}
                />
              </div>
              {resetPasswordForm.formState.errors.password && (
                <p className="text-sm font-medium text-destructive">
                  {resetPasswordForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="password"
                  placeholder="Confirmar Nova Senha"
                  className="flex h-14 w-full rounded-lg border-0 bg-gray-100 pl-12 px-3 py-2 text-base text-gray-700 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...resetPasswordForm.register("confirmPassword")}
                />
              </div>
              {resetPasswordForm.formState.errors.confirmPassword && (
                <p className="text-sm font-medium text-destructive">
                  {resetPasswordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wider rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  SALVANDO...
                </>
              ) : (
                "SALVAR NOVA SENHA"
              )}
            </Button>
          </form>
        );

      case "signup":
        return (
          <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Nome Completo"
                  className="flex h-14 w-full rounded-lg border-0 bg-gray-100 pl-12 px-3 py-2 text-base text-gray-700 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...signupForm.register("fullName")}
                />
              </div>
              {signupForm.formState.errors.fullName && (
                <p className="text-sm font-medium text-destructive">{signupForm.formState.errors.fullName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="email"
                  placeholder="Digite o Email"
                  className="flex h-14 w-full rounded-lg border-0 bg-gray-100 pl-12 px-3 py-2 text-base text-gray-700 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...signupForm.register("email")}
                />
              </div>
              {signupForm.formState.errors.email && (
                <p className="text-sm font-medium text-destructive">{signupForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="password"
                  placeholder="Senha"
                  className="flex h-14 w-full rounded-lg border-0 bg-gray-100 pl-12 px-3 py-2 text-base text-gray-700 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...signupForm.register("password")}
                />
              </div>
              {signupForm.formState.errors.password && (
                <p className="text-sm font-medium text-destructive">{signupForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="password"
                  placeholder="Confirmar Senha"
                  className="flex h-14 w-full rounded-lg border-0 bg-gray-100 pl-12 px-3 py-2 text-base text-gray-700 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...signupForm.register("confirmPassword")}
                />
              </div>
              {signupForm.formState.errors.confirmPassword && (
                <p className="text-sm font-medium text-destructive">
                  {signupForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wider rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  CADASTRANDO...
                </>
              ) : (
                "CRIAR CONTA"
              )}
            </Button>
          </form>
        );

      default: // login
        return (
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="email"
                  placeholder="Digite o Usuário"
                  className="flex h-14 w-full rounded-lg border-0 bg-gray-100 pl-12 px-3 py-2 text-base text-gray-700 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...loginForm.register("email")}
                />
              </div>
              {loginForm.formState.errors.email && (
                <p className="text-sm font-medium text-destructive">{loginForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="password"
                  placeholder="••••••"
                  className="flex h-14 w-full rounded-lg border-0 bg-gray-100 pl-12 px-3 py-2 text-base text-gray-700 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...loginForm.register("password")}
                />
              </div>
              {loginForm.formState.errors.password && (
                <p className="text-sm font-medium text-destructive">{loginForm.formState.errors.password.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wider rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ACESSANDO...
                </>
              ) : (
                "ACESSAR O SISTEMA"
              )}
            </Button>
          </form>
        );
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 p-8 relative bg-black items-center justify-center px-0 py-0 flex flex-col">
        <div className="w-full max-w-md space-y-8">
          {/* Welcome Text */}
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-wider text-primary-foreground">
              {mode === "signup"
                ? "CRIAR CONTA"
                : mode === "forgot"
                  ? "RECUPERAR SENHA"
                  : mode === "reset"
                    ? "NOVA SENHA"
                    : "SEJA BEM VINDO!"}
            </h1>
          </div>

          {/* Logo */}
          <div className="py-0 flex-col flex items-center justify-center pointer-events-none">
            <img
              src="/lovable-uploads/a21a1ab1-df8a-4b7b-a1e4-0e36f63eff02.png"
              alt="Lander Records"
              className="h-[280px] w-[280px]"
            />
          </div>

          {/* Form */}
          <div className="relative z-10">{renderForm()}</div>

          {/* Toggle Mode & Forgot Password */}
          {mode !== "reset" && (
            <div className="text-center space-y-3">
              {mode === "login" && (
                <>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-sm font-medium underline text-primary-foreground"
                  >
                    Esqueci minha senha
                  </button>
                  <div>
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Criar nova conta
                    </button>
                  </div>
                </>
              )}
              {mode === "signup" && (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-sm font-medium underline text-primary-foreground"
                >
                  Já tenho uma conta
                </button>
              )}
            </div>
          )}

          {/* Social Icons */}
          <div className="flex justify-center gap-6 pt-4 py-0">
            <a href="#" className="text-gray-500 hover:text-gray-700 transition-colors">
              <Facebook className="h-5 w-5" />
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-700 transition-colors">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-700 transition-colors">
              <MessageCircle className="h-5 w-5" />
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-700 transition-colors">
              <Globe className="h-5 w-5" />
            </a>
          </div>
        </div>

        {/* Copyright Footer */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <p className="text-xs text-gray-500 text-center">Copyright © LANDER 360º. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Right Side - Gradient Background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-red-600 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-red-800 rounded-full blur-3xl"></div>
        </div>
        {/* Logo Placeholder */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-red-600/20 flex items-center justify-center border-2 border-red-600/50">
              <span className="text-5xl font-bold text-red-500">LR</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-widest">LANDER RECORDS</h1>
          </div>
        </div>
        {/* Text Overlay */}
        <div className="absolute bottom-12 left-12 z-10">
          <h2 className="text-3xl font-bold text-white mb-2">Sistema de Gestão</h2>
          <p className="text-gray-300 text-lg">Plataforma Musical Profissional</p>
        </div>
      </div>
    </div>
  );
}
