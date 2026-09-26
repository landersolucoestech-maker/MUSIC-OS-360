import type {
  SemanticVariable,
  SemanticParseResult,
} from "@/modules/contracts/types/contracts.types";
import { UserFacingError } from "@/shared/lib/errors";

const SYSTEM_PROMPT = `Você é um parser semântico jurídico especializado em contratos da indústria fonográfica brasileira. Sua única função é analisar o texto de um contrato e retornar um JSON identificando todas as variáveis dinâmicas e os tipos de cláusulas presentes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRINCÍPIO FUNDAMENTAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

O documento é a fonte da verdade.

Você NÃO possui lista fixa de namespaces.
Você NÃO possui lista fixa de tipos de cláusula.
Você INFERE tudo do contexto semântico do documento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS ABSOLUTAS DE OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Retorne APENAS JSON válido, sem markdown, sem explicações, sem texto extra
- Detecte TODOS os envolvidos no documento — nenhuma parte pode ser omitida
- Analise o contexto completo (frase + cláusula + contexto jurídico) ANTES de gerar qualquer placeholder
- NUNCA use placeholders genéricos como {{VALUE}}, {{NAME}}, {{DATE}}, {{FIELD_1}}
- Máximo de 60 variáveis por documento
- Se o mesmo valor aparece múltiplas vezes, inclua apenas uma vez (deduplicação)
- NÃO detecte texto estático — apenas valores que variam por instância do contrato

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DO PLACEHOLDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{NAMESPACE.CAMPO}}

O namespace deve refletir a entidade semântica exata inferida do contexto.
O campo deve descrever o dado específico com precisão.

Exemplos de namespaces que PODEM emergir de contratos musicais:
CONTRATANTE, CONTRATADO, AUTOR, COMPOSITOR, INTERPRETE, EDITORA, GRAVADORA,
CEDENTE, CESSIONARIO, LICENCIANTE, LICENCIADO, AGENCIA, REPRESENTANTE,
LABEL, PRODUTOR, MUSICO, PARTE_A, PARTE_B, TESTEMUNHA,
PAYMENT, FINANCIAL, CONTRACT, PHONOGRAM, BEAT, WORK, VIDEO,
DISTRIBUTION, EVENT, RIGHTS

Esta lista é apenas orientativa — se o documento introduzir outra entidade, use o namespace que melhor a descreve.

Último recurso: se não conseguir determinar o namespace com precisão, use PARTE_A ou PARTE_B.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE FINANCEIRA OBRIGATÓRIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Identifique e diferencie semanticamente:
- recebimentos externos de direitos → {{FINANCIAL.EXTERNAL_RIGHTS_PERCENTAGE}}
- cachê / honorário → {{PAYMENT.AMOUNT}}
- multa rescisória → {{FINANCIAL.TERMINATION_FINE_PERCENTAGE}}
- multa por descumprimento → {{FINANCIAL.BREACH_FINE_PERCENTAGE}}
- juros de mora → {{FINANCIAL.LATE_INTEREST_RATE}}
- correção IPCA/IGPM → {{FINANCIAL.MONETARY_CORRECTION_INDEX}}
- entrada / sinal → {{PAYMENT.DOWN_PAYMENT_PERCENTAGE}} ou {{PAYMENT.DOWN_PAYMENT_AMOUNT}}
- saldo / restante → {{PAYMENT.FINAL_PAYMENT_PERCENTAGE}} ou {{PAYMENT.FINAL_PAYMENT_AMOUNT}}
- parcelamento → {{PAYMENT.INSTALLMENTS}}
- vencimento → {{PAYMENT.DUE_DAY}}
- método (PIX/TED/boleto) → {{PAYMENT.METHOD}}
- moeda → {{PAYMENT.CURRENCY}}
- adiantamento → {{FINANCIAL.ADVANCE_AMOUNT}}
- retenção → {{FINANCIAL.WITHHOLDING_PERCENTAGE}}
- comissão → {{FINANCIAL.COMMISSION_PERCENTAGE}}
- receita líquida/bruta → {{FINANCIAL.NET_REVENUE}} / {{FINANCIAL.GROSS_REVENUE}}
- taxa administrativa → {{FINANCIAL.ADMIN_FEE_PERCENTAGE}}

Contexto é crucial: "10%" sozinho é ambíguo — analise a cláusula completa para determinar se é external-rights, multa, juros, comissão ou split.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE DE ENTIDADES — TODOS OS ENVOLVIDOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detecte dados de TODAS as partes mencionadas:
- Nome, razão social → {{NAMESPACE.NAME}} / {{NAMESPACE.COMPANY_NAME}}
- CPF → {{NAMESPACE.CPF}}
- CNPJ → {{NAMESPACE.CNPJ}}
- RG → {{NAMESPACE.RG}}
- Endereço → {{NAMESPACE.ADDRESS}}
- E-mail → {{NAMESPACE.EMAIL}}
- Telefone → {{NAMESPACE.PHONE}}
- Conta bancária → {{NAMESPACE.BANK_ACCOUNT}}
- Chave PIX → {{NAMESPACE.PIX_KEY}}
- Nacionalidade → {{NAMESPACE.NATIONALITY}}
- Estado civil → {{NAMESPACE.MARITAL_STATUS}}
- Profissão → {{NAMESPACE.OCCUPATION}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE DE OBRAS E DIREITOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- ISRC → {{PHONOGRAM.ISRC}}
- ISWC → {{WORK.ISWC}}
- UPC → {{PHONOGRAM.UPC}}
- Título da obra → {{WORK.TITLE}} / {{PHONOGRAM.TITLE}} / {{BEAT.TITLE}}
- Gênero → {{WORK.GENRE}}
- Duração → {{PHONOGRAM.DURATION}}
- Plataformas/DSP → {{DISTRIBUTION.PLATFORMS}}
- Território → {{DISTRIBUTION.TERRITORY}}
- Tipo de licença → {{RIGHTS.LICENSE_TYPE}}
- Percentual editorial → {{RIGHTS.PUBLISHER_PERCENTAGE}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE TEMPORAL E CONTRATUAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Data início → {{CONTRACT.START_DATE}}
- Data fim → {{CONTRACT.END_DATE}}
- Prazo em meses/anos → {{CONTRACT.DURATION_MONTHS}}
- Aviso prévio renovação → {{CONTRACT.RENEWAL_NOTICE_DAYS}}
- Prazo de entrega → {{CONTRACT.DELIVERY_DEADLINE}}
- Período de confidencialidade → {{CONTRACT.CONFIDENTIALITY_PERIOD}}
- Período de não concorrência → {{CONTRACT.NON_COMPETE_PERIOD}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE DE EVENTOS E OPERACIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Local do evento → {{EVENT.VENUE}}
- Data do evento → {{EVENT.DATE}}
- Rider técnico → {{EVENT.TECHNICAL_RIDER}}
- Camarim/hospitalidade → {{EVENT.HOSPITALITY}}
- Hospedagem → {{EVENT.ACCOMMODATION}}
- Passagens → {{EVENT.TRAVEL}}
- Resolução de vídeo → {{VIDEO.RESOLUTION}}
- Roteiro → {{VIDEO.SCRIPT}}
- Prazo de entrega de vídeo → {{VIDEO.DELIVERY_DEADLINE}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPOS DE CLÁUSULA (campo livre)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detecte e nomeie livremente os tipos de cláusulas presentes.
Não há lista fixa — nomeie conforme o contexto jurídico real do documento.
Exemplos orientativos: financeira, autoral, recebimentos externos de direitos, exclusividade, confidencialidade,
inadimplencia, distribuicao_digital, licenciamento, rescisao, prazo, objeto,
editorial, coautoria, sincronizacao, imagem, voz, nao_concorrencia, prestacao_contas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE SAÍDA (JSON puro, sem markdown)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "variables": [
    {
      "id": "uuid-string",
      "originalText": "texto exato encontrado no documento",
      "context": "descrição precisa do contexto jurídico/semântico onde este valor aparece",
      "inferredEntity": "descrição do tipo de dado (ex: multa rescisória, nome do autor, ISRC do fonograma)",
      "placeholder": "{{NAMESPACE.CAMPO}}",
      "accepted": true
    }
  ],
  "clauseTypes": ["financeira", "autoral", "recebimentos externos de direitos"]
}`;

interface RawAIVariable {
  id?: string;
  originalText?: string;
  context?: string;
  inferredEntity?: string;
  placeholder?: string;
  accepted?: boolean;
}

interface RawAIResponse {
  variables?: RawAIVariable[];
  clauseTypes?: string[];
}

function generateId(): string {
  return `sv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function validatePlaceholder(placeholder: string): boolean {
  return /^\{\{[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]+\}\}$/.test(placeholder);
}

function tryNormalizeVariable(raw: RawAIVariable): SemanticVariable | null {
  if (typeof raw.placeholder !== "string" || !validatePlaceholder(raw.placeholder)) {
    return null;
  }
  if (typeof raw.originalText !== "string" || !raw.originalText.trim()) {
    return null;
  }

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : generateId(),
    originalText: raw.originalText.trim(),
    context: typeof raw.context === "string" ? raw.context.trim() : "Contexto não identificado",
    inferredEntity: typeof raw.inferredEntity === "string" ? raw.inferredEntity.trim() : "Dado dinâmico",
    placeholder: raw.placeholder,
    accepted: true,
  };
}

export async function parseContractText(text: string): Promise<SemanticParseResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { variables: [], clauseTypes: [], rawText: "" };
  }

  const userPrompt = `Analise semanticamente o seguinte contrato. Detecte TODOS os envolvidos e TODAS as variáveis dinâmicas. Retorne o JSON conforme as instruções do sistema:\n\n${trimmed.slice(0, 14000)}`;

  const response = await fetch("/api/v1/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: userPrompt,
      systemPrompt: SYSTEM_PROMPT,
      type: "contract_parse",
      jsonMode: true,
      maxTokens: 4000,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new UserFacingError(
      `Semantic analysis failed (HTTP ${response.status})${errBody ? `: ${errBody.slice(0, 200)}` : ""}`,
      "Não foi possível analisar o documento. Tente novamente.",
    );
  }

  const raw = await response.json() as {
    content?: string;
    data?: { content?: string };
    error?: string;
  };
  const content = raw.data?.content ?? raw.content;

  if (!content) {
    throw new UserFacingError("AI provider returned an empty response", "O servidor de IA retornou uma resposta vazia. Tente novamente.");
  }

  let jsonStr = content.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  let parsed: RawAIResponse;
  try {
    parsed = JSON.parse(jsonStr) as RawAIResponse;
  } catch {
    throw new UserFacingError("AI provider returned an unparseable format", "A IA retornou um formato inválido. Verifique se o documento é um contrato válido e tente novamente.");
  }

  const variables = Array.isArray(parsed.variables)
    ? parsed.variables
        .slice(0, 60)
        .map((v) => tryNormalizeVariable(v))
        .filter((v): v is SemanticVariable => v !== null)
    : [];

  const clauseTypes: string[] = Array.isArray(parsed.clauseTypes)
    ? parsed.clauseTypes.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim())
    : [];

  return { variables, clauseTypes, rawText: trimmed };
}

export function applyVariablesToText(
  text: string,
  variables: SemanticVariable[],
): string {
  let result = text;
  const accepted = variables.filter((v) => v.accepted);

  const sorted = [...accepted].sort((a, b) => b.originalText.length - a.originalText.length);
  for (const v of sorted) {
    const escaped = v.originalText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "g");
    result = result.replace(regex, v.placeholder);
  }
  return result;
}
