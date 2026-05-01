import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Music2, Instagram, Youtube } from "lucide-react";
import { ArtistaForm, type ArtistaFormValues } from "@/components/forms/ArtistaForm";
import { toast } from "sonner";
import { MOCK_DATA, MOCK_ORG_ID, saveMockData } from "@/data/mockData";

const EMPTY_VALUES: ArtistaFormValues = {
  nome_artistico: "",
  nome_civil: "",
  tipo: "",
  status: "contratado",
  genero_musical: "",
  email: "",
  telefone: "",
  cpf_cnpj: "",
  foto_url: "",
  observacoes: "",
};

export default function ArtistaSignupPublic() {
  const { orgSlug } = useParams<{ orgSlug?: string }>();

  const [values, setValues] = useState<ArtistaFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [instagram, setInstagram] = useState("");
  const [spotify, setSpotify] = useState("");
  const [youtube, setYoutube] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [slugChecking, setSlugChecking] = useState(true);
  const [slugNotFound, setSlugNotFound] = useState(false);

  useEffect(() => {
    setSlugChecking(false);
    setSlugNotFound(!orgSlug);
  }, [orgSlug]);

  const handleChange = (field: keyof ArtistaFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field])
      setErrors((prev) => {
        const e = { ...prev };
        delete e[field];
        return e;
      });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!values.nome_artistico.trim()) e.nome_artistico = "Nome artístico é obrigatório";
    if (!values.tipo) e.tipo = "Tipo de artista é obrigatório";
    if (!values.email.trim()) e.email = "E-mail é obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) e.email = "E-mail inválido";
    if (!values.telefone.trim()) e.telefone = "Telefone é obrigatório";
    if (values.foto_url.trim() && !/^https?:\/\/.+/.test(values.foto_url.trim())) {
      e.foto_url = "URL da foto inválida — deve começar com http:// ou https://";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const redesSociais = [
        instagram ? `Instagram: ${instagram}` : null,
        spotify ? `Spotify: ${spotify}` : null,
        youtube ? `YouTube: ${youtube}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const observacoes = [values.observacoes.trim(), redesSociais]
        .filter(Boolean)
        .join("\n\nRedes Sociais: ");

      const artistas = (MOCK_DATA.artistas as Array<Record<string, unknown>>) ?? [];
      const emailNormalized = values.email.trim().toLowerCase();
      const cpf = values.cpf_cnpj.trim();
      const duplicate = artistas.find((a) => {
        const sameEmail =
          typeof a.email === "string" && a.email.toLowerCase() === emailNormalized;
        const sameCpf = cpf && a.cpf_cnpj === cpf;
        return sameEmail || sameCpf;
      });

      if (duplicate) {
        const dupEmail =
          typeof duplicate.email === "string" &&
          duplicate.email.toLowerCase() === emailNormalized;
        if (dupEmail) {
          setErrors((prev) => ({ ...prev, email: "E-mail já cadastrado" }));
          toast.error("E-mail já cadastrado nesta organização.");
        } else {
          setErrors((prev) => ({ ...prev, cpf_cnpj: "CPF/CNPJ já cadastrado" }));
          toast.error("CPF/CNPJ já cadastrado nesta organização.");
        }
        return;
      }

      const now = new Date().toISOString();
      const newArtista: Record<string, unknown> = {
        id: crypto.randomUUID(),
        org_id: MOCK_ORG_ID,
        nome_artistico: values.nome_artistico.trim(),
        nome_civil: values.nome_civil.trim() || null,
        tipo: values.tipo,
        status: "ativo",
        genero_musical: values.genero_musical.trim() || null,
        email: values.email.trim(),
        telefone: values.telefone.trim(),
        cpf_cnpj: cpf || null,
        foto_url: values.foto_url.trim() || null,
        observacoes: observacoes || null,
        org_slug: orgSlug ?? null,
        created_at: now,
        updated_at: now,
      };
      artistas.unshift(newArtista);
      MOCK_DATA.artistas = artistas;
      saveMockData();

      setSuccess(true);
    } catch {
      toast.error("Erro ao enviar cadastro. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (slugChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Verificando link de cadastro…</p>
        </div>
      </div>
    );
  }

  if (!orgSlug || slugNotFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="rounded-full bg-destructive/10 p-6 w-fit mx-auto">
            <Music2 className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Link inválido</h1>
          <p className="text-muted-foreground text-sm">
            Este link de cadastro não está configurado corretamente. Entre em contato com a gravadora para obter o link correto.
          </p>
          <p className="text-xs text-muted-foreground">
            Formato esperado: <code>/signup/artista/{"{"}slug-da-gravadora{"}"}</code>
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-500/10 p-6">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Cadastro Recebido!</h1>
            <p className="text-muted-foreground mt-2">
              Seu cadastro foi recebido e <strong>ativado</strong> em nosso sistema.
              Nossa equipe entrará em contato em breve.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Verifique seu e-mail nos próximos dias para mais informações.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Music2 className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Cadastro de Artista</h1>
          <p className="text-muted-foreground text-sm">
            Preencha seus dados para entrar no nosso casting. Os campos marcados com{" "}
            <span className="text-destructive">*</span> são obrigatórios.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <ArtistaForm
                mode="public"
                values={values}
                onChange={handleChange}
                errors={errors}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Instagram className="h-4 w-4 text-primary" />
                Redes Sociais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">@</span>
                  <Input
                    id="instagram"
                    placeholder="seu_usuario"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    data-testid="input-instagram"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="spotify">Spotify</Label>
                <Input
                  id="spotify"
                  placeholder="Link do Spotify (artista)"
                  value={spotify}
                  onChange={(e) => setSpotify(e.target.value)}
                  data-testid="input-spotify"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="youtube">
                  <Youtube className="h-4 w-4 inline mr-1" />
                  YouTube
                </Label>
                <Input
                  id="youtube"
                  placeholder="Link do canal no YouTube"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  data-testid="input-youtube"
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
            data-testid="button-submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Cadastro"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Ao enviar, seu cadastro entra <strong>direto no nosso sistema</strong> e nossa equipe
            entrará em contato em breve.
          </p>
        </form>
      </div>
    </div>
  );
}
