/**
 * The heuristic fallbacks of the AI Skills produce text rendered to the user
 * (SkillRunPanel). They must not interpolate technical enum values or field keys.
 * An unparseable model response forces the fallback path.
 */
import {
  parseAudiovisualBriefingResponse,
  parseCampaignPlanResponse,
  parseContactOperationsResponse,
  parsePostizResponse,
  parseSupportTriageResponse,
} from '@music-os-360/ai-skills';

const NOT_JSON = 'model returned no JSON';

function allText(value: unknown): string {
  return JSON.stringify(value);
}

describe('AI Skill fallback copy carries no technical values', () => {
  it('postiz: channel readiness is a PT-BR label', () => {
    const out = parsePostizResponse(NOT_JSON, {
      postTitle: 'Teaser', channel: 'Instagram', channelReadiness: 'requires_reauth', hasCopy: true, copyLength: 10,
    });
    const text = allText(out.blockers);
    expect(text).toContain('Canal Instagram não está conectado (autorização expirada)');
    expect(text).not.toMatch(/requires_reauth|tenant/);
  });

  it('support-triage: priority level is a PT-BR label', () => {
    const out = parseSupportTriageResponse(NOT_JSON, { subject: 'Dúvida', message: 'como faço para exportar?' });
    const text = allText({ sla: out.SLARecommendation, notes: out.internalNotes });
    expect(text).toContain('prioridade heurística (baixa)');
    expect(text).not.toMatch(/\((low|medium|high|critical)\)|: (low|medium|high|critical)\./);
  });

  it('audiovisual-briefing: content type and budget level are PT-BR labels', () => {
    const out = parseAudiovisualBriefingResponse(NOT_JSON, {
      projectTitle: 'Clipe', artistName: 'Ana', contentType: 'music-video', objective: 'lançar single', budgetLevel: 'medium',
    });
    expect(out.creativeConcept).toContain('(videoclipe)');
    expect(out.creativeConcept).toContain('orçamento de nível médio');
    expect(out.creativeConcept).not.toMatch(/music-video|\bmedium\b/);
  });

  it('campaign-plan: the legacy campaign type value is not echoed', () => {
    const out = parseCampaignPlanResponse(NOT_JSON, { campaignName: 'Verão', campaignType: 'lancamento_musical' });
    expect(out.planSummary).toContain('Campanha "Verão".');
    expect(out.planSummary).not.toContain('lancamento_musical');
  });

  it('contact-operations: no field key in the gap reason', () => {
    const out = parseContactOperationsResponse(NOT_JSON, { clientName: 'Loja X', clientCategory: 'varejo', clientPersonType: 'pj' });
    expect(allText(out.dataGaps)).toContain('Nome do responsável não informado');
    expect(allText(out)).not.toContain('responsibleName');
  });
});
