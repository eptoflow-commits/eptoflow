/**
 * Plan feature matrix. Single source of truth used by backend authorization
 * AND surfaced to frontend/device.
 */
export const PLAN_FEATURES = {
  basic: {
    maxValves: 1,
    hasRelay1: true,
    hasMoisture: false,
    hasVoice: false,
    hasScheduling: false,
    moistureAutomation: false,
    allowedOutputs: new Set(['valve1', 'relay1']),
  },
  standard: {
    maxValves: 1,
    hasRelay1: true,
    hasMoisture: false,
    hasVoice: false,
    hasScheduling: true,
    moistureAutomation: false,
    allowedOutputs: new Set(['valve1', 'relay1']),
  },
  premium: {
    maxValves: 3,
    hasRelay1: true,
    hasMoisture: true,
    hasVoice: true,
    hasScheduling: true,
    moistureAutomation: true,
    // relay6/7/8 are premium add-ons activated per-device by admin
    allowedOutputs: new Set(['valve1', 'valve2', 'valve3', 'relay1', 'relay6', 'relay7', 'relay8']),
  },
};

export function planAllows(planName, output) {
  if (!planName) return false;
  const f = PLAN_FEATURES[planName];
  if (!f) return false;
  return f.allowedOutputs.has(output);
}

export function planHasVoice(planName) {
  return !!PLAN_FEATURES[planName]?.hasVoice;
}

export function planHasScheduling(planName) {
  return !!PLAN_FEATURES[planName]?.hasScheduling;
}

export function planHasMoisture(planName) {
  return !!PLAN_FEATURES[planName]?.hasMoisture;
}

export function serializePlan(planName) {
  const f = PLAN_FEATURES[planName] || PLAN_FEATURES['basic']; // fallback to basic
  return {
    plan: planName,
    maxValves: f.maxValves,
    hasRelay1: f.hasRelay1,
    hasMoisture: f.hasMoisture,
    hasVoice: f.hasVoice,
    moistureAutomation: f.moistureAutomation,
    allowedOutputs: [...f.allowedOutputs],
  };
}
