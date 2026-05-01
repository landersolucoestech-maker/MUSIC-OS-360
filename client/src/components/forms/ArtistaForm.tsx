import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type TipoArtista = "artista_solo" | "banda" | "projeto_artistico" | "coletivo" | "produtor";
export type StatusArtista = "contratado" | "parceiro" | "independente";

export interface ArtistaFormValues {
  nome_artistico: string;
  nome_civil: string;
  tipo: TipoArtista | "";
  status: StatusArtista;
  genero_musical: string;
  email: string;
  telefone: string;
  cpf_cnpj: string;
  foto_url: string;
  observacoes: string;
}

interface ArtistaFormProps {
  mode: "full" | "public";
  values: ArtistaFormValues;
  onChange: (field: keyof ArtistaFormValues, value: string) => void;
  errors: Record<string, string>;
}

const TIPOS: Array<{ value: TipoArtista; label: string }> = [
  { value: "artista_solo", label: "Artista Solo" },
  { value: "banda", label: "Banda" },
  { value: "projeto_artistico", label: "Projeto Artístico" },
  { value: "coletivo", label: "Coletivo" },
  { value: "produtor", label: "Produtor" },
];

const STATUS_OPTIONS: Array<{ value: StatusArtista; label: string }> = [
  { value: "contratado", label: "Contratado" },
  { value: "parceiro", label: "Parceiro" },
  { value: "independente", label: "Independente" },
];

export function ArtistaForm({ mode, values, onChange, errors }: ArtistaFormProps) {
  const clearError = (field: keyof ArtistaFormValues, newValue: string) => {
    onChange(field, newValue);
  };

  return (
    <div className="space-y-4">
      {/* Nome Artístico */}
      <div className="space-y-2">
        <Label htmlFor="nome-artistico">
          Nome Artístico <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nome-artistico"
          placeholder="Nome artístico"
          value={values.nome_artistico}
          onChange={(e) => clearError("nome_artistico", e.target.value)}
          className={errors.nome_artistico ? "border-destructive" : ""}
          data-testid="input-nome-artistico"
        />
        {errors.nome_artistico && <p className="text-sm text-destructive">{errors.nome_artistico}</p>}
      </div>

      {/* Nome Civil + CPF/CNPJ */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome-civil">Nome Civil</Label>
          <Input
            id="nome-civil"
            placeholder="Nome civil completo (opcional)"
            value={values.nome_civil}
            onChange={(e) => onChange("nome_civil", e.target.value)}
            data-testid="input-nome-civil"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpf-cnpj">CPF / CNPJ</Label>
          <Input
            id="cpf-cnpj"
            placeholder="000.000.000-00"
            value={values.cpf_cnpj}
            onChange={(e) => clearError("cpf_cnpj", e.target.value)}
            className={errors.cpf_cnpj ? "border-destructive" : ""}
            data-testid="input-cpf-cnpj"
          />
          {errors.cpf_cnpj && <p className="text-sm text-destructive">{errors.cpf_cnpj}</p>}
        </div>
      </div>

      {/* Tipo + Status (status só no mode='full') */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo <span className="text-destructive">*</span></Label>
          <Select
            value={values.tipo}
            onValueChange={(v) => onChange("tipo", v)}
          >
            <SelectTrigger data-testid="select-tipo">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.tipo && <p className="text-sm text-destructive">{errors.tipo}</p>}
        </div>

        {mode === "full" && (
          <div className="space-y-2">
            <Label>Status <span className="text-destructive">*</span></Label>
            <Select
              value={values.status}
              onValueChange={(v) => onChange("status", v)}
            >
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Gênero Musical */}
      <div className="space-y-2">
        <Label htmlFor="genero">Gênero Musical</Label>
        <Input
          id="genero"
          placeholder="Ex: Funk, Pop, Rock, Forró..."
          value={values.genero_musical}
          onChange={(e) => onChange("genero_musical", e.target.value)}
          data-testid="input-genero"
        />
      </div>

      {/* E-mail + Telefone */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">
            E-mail {mode === "public" && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="email@exemplo.com"
            value={values.email}
            onChange={(e) => clearError("email", e.target.value)}
            className={errors.email ? "border-destructive" : ""}
            data-testid="input-email"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">
            Telefone {mode === "public" && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="telefone"
            placeholder="(00) 00000-0000"
            value={values.telefone}
            onChange={(e) => clearError("telefone", e.target.value)}
            className={errors.telefone ? "border-destructive" : ""}
            data-testid="input-telefone"
          />
          {errors.telefone && <p className="text-sm text-destructive">{errors.telefone}</p>}
        </div>
      </div>

      {/* Foto URL */}
      <div className="space-y-2">
        <Label htmlFor="foto-url">
          URL da Foto{" "}
          <span className="text-muted-foreground text-xs">(opcional)</span>
        </Label>
        <Input
          id="foto-url"
          type="url"
          placeholder="https://exemplo.com/foto.jpg"
          value={values.foto_url}
          onChange={(e) => clearError("foto_url", e.target.value)}
          className={errors.foto_url ? "border-destructive" : ""}
          data-testid="input-foto-url"
        />
        {errors.foto_url && <p className="text-sm text-destructive">{errors.foto_url}</p>}
        {mode === "public" && (
          <p className="text-xs text-muted-foreground">
            Cole aqui o link de uma foto (Google Drive, Dropbox, Instagram, etc.)
          </p>
        )}
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <Label htmlFor="observacoes">
          {mode === "public" ? "Biografia / Observações" : "Observações"}
        </Label>
        <Textarea
          id="observacoes"
          placeholder={
            mode === "public"
              ? "Conte um pouco sobre você, sua trajetória musical, conquistas..."
              : "Observações sobre o artista..."
          }
          value={values.observacoes}
          onChange={(e) => onChange("observacoes", e.target.value)}
          rows={3}
          data-testid="textarea-observacoes"
        />
      </div>
    </div>
  );
}
