const DEFAULT_PAROISSE_REGION = "REGION MONO";
const DEFAULT_PAROISSE_SOUS_REGION = "SOUS-REGION LOKOSSA";
const DEFAULT_PAROISSE_NOM = "PAROISSE SAINT MICHEL DE LOKOSSA CENTRE";
const DEFAULT_PAROISSE_BP = "BP : 202 LOKOSSA";

function getEnvValue(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value.trim() : fallback;
}

export function getParoisseReportHeaderLines(): string[] {
  return [
    getEnvValue(process.env.NEXT_PUBLIC_PAROISSE_REGION, DEFAULT_PAROISSE_REGION),
    getEnvValue(process.env.NEXT_PUBLIC_PAROISSE_SOUS_REGION, DEFAULT_PAROISSE_SOUS_REGION),
    getEnvValue(process.env.NEXT_PUBLIC_PAROISSE_NOM, DEFAULT_PAROISSE_NOM),
    getEnvValue(process.env.NEXT_PUBLIC_PAROISSE_BP, DEFAULT_PAROISSE_BP),
  ];
}