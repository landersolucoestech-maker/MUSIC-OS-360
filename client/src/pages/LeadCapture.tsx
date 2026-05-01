import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, CheckCircle, AlertCircle, Music } from "lucide-react";
import { SERVICOS_INTERESSE_OPTIONS } from "@/hooks/useLeads";
import { MOCK_DATA, MOCK_ORG_ID, saveMockData } from "@/data/mockData";

const leadCaptureSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().email("Email inválido").max(255, "Email muito longo"),
  telefone: z.string().min(10, "Telefone deve ter no mínimo 10 dígitos").max(20, "Telefone muito longo"),
  servico: z.string().min(1, "Selecione um serviço de interesse"),
  mensagem: z.string().max(1000, "Mensagem muito longa").optional().or(z.literal("")),
});

type LeadCaptureFormData = z.infer<typeof leadCaptureSchema>;

type SubmitState = "idle" | "loading" | "success" | "error";

export default function LeadCapture() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<LeadCaptureFormData>({
    resolver: zodResolver(leadCaptureSchema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      servico: "",
      mensagem: "",
    },
  });

  const handleSubmit = async (data: LeadCaptureFormData) => {
    setSubmitState("loading");
    setErrorMessage("");

    try {
      const leads = (MOCK_DATA.leads as Array<Record<string, unknown>>) ?? [];
      const now = new Date().toISOString();
      const newLead: Record<string, unknown> = {
        id: crypto.randomUUID(),
        org_id: MOCK_ORG_ID,
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        servicos_interesse: [data.servico],
        mensagem: data.mensagem || "",
        status: "novo",
        origem: "website",
        created_at: now,
        updated_at: now,
      };
      leads.unshift(newLead);
      MOCK_DATA.leads = leads;
      saveMockData();

      setSubmitState("success");
      form.reset();
    } catch (err: unknown) {
      setSubmitState("error");
      setErrorMessage(err instanceof Error ? err.message : "Erro inesperado. Tente novamente.");
    }
  };

  if (submitState === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black p-4">
        <Card className="w-full max-w-md p-8 text-center bg-gray-900 border-gray-800">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-green-900/30 p-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-white" data-testid="text-success-title">
              Mensagem Enviada!
            </h2>
            <p className="text-gray-400" data-testid="text-success-message">
              Obrigado pelo seu interesse! Nossa equipe entrará em contato em breve.
            </p>
            <Button
              variant="outline"
              className="mt-4 border-gray-700 text-gray-300"
              onClick={() => setSubmitState("idle")}
              data-testid="button-new-message"
            >
              Enviar outra mensagem
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black p-4">
      <Card className="w-full max-w-lg p-6 sm:p-8 bg-gray-900 border-gray-800">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="rounded-full bg-red-600/20 p-3 border border-red-600/40">
            <Music className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide" data-testid="text-form-title">
            LANDER RECORDS
          </h1>
          <p className="text-sm text-gray-400 text-center" data-testid="text-form-subtitle">
            Entre em contato conosco. Preencha o formulário abaixo.
          </p>
        </div>

        {submitState === "error" && errorMessage && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-red-900/20 border border-red-800/40" data-testid="text-error-message">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{errorMessage}</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Seu nome completo"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      data-testid="input-nome"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      data-testid="input-email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Telefone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="(11) 99999-9999"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      data-testid="input-telefone"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="servico"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Serviço de Interesse</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger
                        className="bg-gray-800 border-gray-700 text-white"
                        data-testid="select-servico"
                      >
                        <SelectValue placeholder="Selecione um serviço" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SERVICOS_INTERESSE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mensagem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Mensagem (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Conte-nos mais sobre o que você precisa..."
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 resize-none"
                      rows={4}
                      data-testid="input-mensagem"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-red-600 text-white border-red-600 font-bold tracking-wider"
              disabled={submitState === "loading"}
              data-testid="button-submit"
            >
              {submitState === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ENVIANDO...
                </>
              ) : (
                "ENVIAR MENSAGEM"
              )}
            </Button>
          </form>
        </Form>

        <p className="text-xs text-gray-500 text-center mt-4" data-testid="text-copyright">
          Copyright &copy; LANDER 360&ordm;. Todos os direitos reservados.
        </p>
      </Card>
    </div>
  );
}
