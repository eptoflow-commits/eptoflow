export type PlanName = 'basic' | 'premium';

export const PLAN_FEATURES: Record<PlanName, {
  maxValves: number;
  hasRelay1: boolean;
  hasMoisture: boolean;
  hasVoice: boolean;
  moistureAutomation: boolean;
  allowedOutputs: string[];
}> = {
  basic: {
    maxValves: 1,
    hasRelay1: true,
    hasMoisture: false,
    hasVoice: false,
    moistureAutomation: false,
    allowedOutputs: ['valve1', 'relay1'],
  },
  premium: {
    maxValves: 3,
    hasRelay1: true,
    hasMoisture: true,
    hasVoice: true,
    moistureAutomation: true,
    allowedOutputs: ['valve1', 'valve2', 'valve3', 'relay1'],
  },
};

export function planAllows(plan: PlanName | null | undefined, output: string): boolean {
  if (!plan) return false;
  return PLAN_FEATURES[plan]?.allowedOutputs.includes(output) ?? false;
}

export function serializePlan(plan: PlanName | null | undefined) {
  if (!plan) return null;
  return { plan, ...PLAN_FEATURES[plan] };
}
