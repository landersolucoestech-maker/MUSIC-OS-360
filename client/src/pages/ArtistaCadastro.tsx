import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Loader2, Save, FileText, PlusCircle, Shield, ExternalLink } from "lucide-react";
import { useArtistas } from "@/hooks/useArtistas";
import { useContratos } from "@/hooks/useContratos";
import { ArtistaForm, type ArtistaFormValues, type TipoArtista, type StatusArtista } from "@/components/forms/ArtistaForm";
import { artistaSchema, formatZodErrors } from "@/lib/validation-schemas";
import { formatDate, formatCurrency } from "@/lib/format-utils";
import { ContratoStatusBadge, getContratoSituacao } from "@/components/shared/ContratoStatusBadge";
import { isValidCpfCnpj } from "@/lib/br-validators";
import { toast } from "sonner";

const EMPTY_FORM: ArtistaFormValues = {
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

export default function ArtistaCadastro() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { artistas, addArtista, updateArtista } = useArtistas();
  const { contratos } = useContratos();

  const artistaExistente = isEdit ? artistas.find((a) => a.id === id) : null;

  const artistaContratos = useMemo(() => {
    if (!id) return [];
    return contratos.filter((c) => c.artista_id === id);
  }, [contratos, id]);

  const [values, setValues] = useState<ArtistaFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit && artistaExistente) {
      setValues({
        nome_artistico: artistaExistente.nome_artistico || "",
        nome_civil: artistaExistente.nome_civil || "",
        tipo: (artistaExistente.tipo || "artista_solo") as TipoArtista,
        status: (artistaExistente.status || "contratado") as StatusArtista,
        genero_musical: artistaExistente.genero_musical || "",
        email: artistaExistente.email || "",
        telefone: artistaExistente.telefone || "",
        cpf_cnpj: artistaExistente.cpf_cnpj || "",
        foto_url: artistaExistente.foto_url || "",
        observacoes: artistaExistente.observacoes || "",
      });
    }
  }, [isEdit, artistaExistente]);

  const handleChange = (field: keyof ArtistaFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  };

  const handleSubmit = async () => {
    // Guard: se estiver em modo edição mas o artista não foi encontrado, bloquear
    if (isEdit && !artistaExistente) {
      toast.error("Artista não encontrado. Redirecionando...");
      navigate("/artistas");
      return;
    }

    const formData = {
      nome_artistico: values.nome_artistico.trim(),
      nome_civil: values.nome_civil.trim() || null,
      tipo: values.tipo as TipoArtista,
      status: values.status,
      cpf_cnpj: values.cpf_cnpj.trim() || null,
      genero_musical: values.genero_musical.trim() || null,
      telefone: values.telefone.trim() || null,
      email: values.email.trim() || null,
      foto_url: values.foto_url.trim() || null,
      observacoes: values.observacoes.trim() || null,
    };

    const result = artistaSchema.safeParse(formData);
    if (!result.success) {
      setErrors(formatZodErrors(result.error));
      toast.error("Corrija os erros antes de salvar");
      return;
    }

    // Validar CPF/CNPJ se preenchido
    if (result.data.cpf_cnpj?.trim()) {
      if (!isValidCpfCnpj(result.data.cpf_cnpj)) {
        setErrors((prev) => ({ ...prev, cpf_cnpj: "CPF ou CNPJ inválido" }));
        toast.error("CPF/CNPJ inválido");
        return;
      }
    }

    // Verificação de duplicidade no cliente (e-mail)
    const emailNormalizado = result.data.email?.trim().toLowerCase();
    if (emailNormalizado) {
      const duplicateEmail = artistas.find(
        (a) => a.email?.toLowerCase() === emailNormalizado && a.id !== artistaExistente?.id
      );
      if (duplicateEmail) {
        setErrors((prev) => ({ ...prev, email: "Já existe um artista com este e-mail" }));
        toast.error("E-mail já cadastrado para outro artista");
        return;
      }
    }

    // Verificação de duplicidade no cliente (CPF/CNPJ normalizado)
    const cpfNorm = result.data.cpf_cnpj?.replace(/\D/g, "") || "";
    if (cpfNorm) {
      const duplicateCpf = artistas.find(
        (a) => a.cpf_cnpj?.replace(/\D/g, "") === cpfNorm && a.id !== artistaExistente?.id
      );
      if (duplicateCpf) {
        setErrors((prev) => ({ ...prev, cpf_cnpj: "Já existe um artista com este CPF/CNPJ" }));
        toast.error("CPF/CNPJ já cadastrado para outro artista");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isEdit && artistaExistente) {
        await updateArtista.mutateAsync({ id: artistaExistente.id, ...result.data });
      } else {
        await addArtista.mutateAsync(result.data);
      }
      navigate("/artistas");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout
      title={isEdit ? "Editar Artista" : "Novo Artista"}
      description={isEdit ? "Atualize os dados do artista" : "Cadastre um novo artista no casting"}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/artistas")} className="gap-1 text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />
            Artistas
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{isEdit ? "Editar" : "Novo Artista"}</span>
        </div>

        {/* Shared Form Fields */}
        <Card>
          <CardContent className="pt-6">
            <ArtistaForm
              mode="full"
              values={values}
              onChange={handleChange}
              errors={errors}
            />
          </CardContent>
        </Card>

        {/* Contratos: orientação no modo criação, listagem no modo edição */}
        {!isEdit && (
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                <FileText className="h-4 w-4" />
                Contratos Vinculados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-2">
                Após salvar o artista, você poderá vincular contratos na tela de edição.
              </p>
            </CardContent>
          </Card>
        )}

        {isEdit && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  Contratos Vinculados ({artistaContratos.length})
                </CardTitle>
                <Link
                  to="/contratos"
                  state={{ novoContratoArtistaId: id }}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Adicionar Contrato
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {artistaContratos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum contrato vinculado.{" "}
                  <Link to="/contratos" className="text-primary underline">
                    Criar contrato
                  </Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {artistaContratos.map((contrato) => (
                    <div key={contrato.id} className="flex items-center gap-3 p-2 rounded-md border bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{contrato.titulo}</span>
                          <ContratoStatusBadge situacao={getContratoSituacao([contrato])} />
                          {contrato.exclusivo && (
                            <Badge className="bg-emerald-600 text-white text-xs gap-1">
                              <Shield className="h-3 w-3" /> Exclusivo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{contrato.tipo || "—"}</span>
                          {contrato.data_inicio && (
                            <span>
                              {formatDate(contrato.data_inicio)}
                              {contrato.data_fim ? ` → ${formatDate(contrato.data_fim)}` : ""}
                            </span>
                          )}
                          {contrato.valor && <span>{formatCurrency(contrato.valor)}</span>}
                        </div>
                      </div>
                      <Link to="/contratos" title="Abrir em Contratos" className="p-1 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate("/artistas")} disabled={isSubmitting} data-testid="button-cancelar">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2" data-testid="button-salvar">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? "Salvar Alterações" : "Cadastrar Artista"}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
