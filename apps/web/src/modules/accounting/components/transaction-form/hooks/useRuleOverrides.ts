import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "musicos360_rule_overrides";

// Override key: "<tipoTransacao>:<tipoCliente>:<categoria>:<ruleKey>"
export type OverrideKey = string;
export type RuleOverrides = Record<OverrideKey, boolean>;

function buildKey(
  tipoTransacao: string,
  tipoCliente:   string,
  categoria:     string,
  ruleKey:       string,
): OverrideKey {
  return `${tipoTransacao}:${tipoCliente}:${categoria}:${ruleKey}`;
}

function load(): RuleOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RuleOverrides) : {};
  } catch {
    return {};
  }
}

function save(overrides: RuleOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch { /* ignore */ }
}

export interface UseRuleOverridesReturn {
  overrides:     RuleOverrides;
  toggleOverride: (tipoTransacao: string, tipoCliente: string, categoria: string, ruleKey: string, currentValue: boolean) => void;
  clearOverrides: () => void;
  hasOverrides:   boolean;
  getEffective:   (tipoTransacao: string, tipoCliente: string, categoria: string, ruleKey: string, computed: boolean) => boolean;
}

export function useRuleOverrides(): UseRuleOverridesReturn {
  const [overrides, setOverrides] = useState<RuleOverrides>(() => load());

  useEffect(() => { save(overrides); }, [overrides]);

  const toggleOverride = useCallback((
    tipoTransacao: string,
    tipoCliente:   string,
    categoria:     string,
    ruleKey:       string,
    currentValue:  boolean,
  ) => {
    const key = buildKey(tipoTransacao, tipoCliente, categoria, ruleKey);
    setOverrides(prev => {
      const next = { ...prev };
      // Toggle: if same as what the rule already produces without override, store explicit; if already overriding, remove
      if (key in next) {
        delete next[key];
      } else {
        next[key] = !currentValue;
      }
      return next;
    });
  }, []);

  const clearOverrides = useCallback(() => {
    setOverrides({});
  }, []);

  const getEffective = useCallback((
    tipoTransacao: string,
    tipoCliente:   string,
    categoria:     string,
    ruleKey:       string,
    computed:      boolean,
  ): boolean => {
    const key = buildKey(tipoTransacao, tipoCliente, categoria, ruleKey);
    return key in overrides ? overrides[key] : computed;
  }, [overrides]);

  return {
    overrides,
    toggleOverride,
    clearOverrides,
    hasOverrides: Object.keys(overrides).length > 0,
    getEffective,
  };
}

// Exported so the form hook can use it without React context
export function getStoredOverrides(): RuleOverrides { return load(); }
export { buildKey };
