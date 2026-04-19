/**
 * Rule-based NLU for in-app voice commands. Runs in the Worker — no external APIs.
 */
const NUM_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function extractNumber(text: string): number | null {
  const m = text.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  for (const [w, v] of Object.entries(NUM_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(text)) return v;
  }
  return null;
}

export function parseVoice(transcript: string): { parsed?: any; error?: string } {
  if (!transcript) return { error: 'Empty transcript' };
  const t = transcript.toLowerCase().trim();

  if (/(stop|cancel|halt).*(water|all|everything)/.test(t)
      || /stop\s+watering/.test(t) || /\bstop\b/.test(t)) {
    return { parsed: { command_type: 'stop_all', payload: {} } };
  }

  if (/\b(motor|pump|light|relay)\b/.test(t)) {
    if (/\boff\b|\bstop\b/.test(t))
      return { parsed: { command_type: 'relay_off', payload: { target: 'relay1' } } };
    if (/\bon\b|\bstart\b/.test(t))
      return { parsed: { command_type: 'relay_on',  payload: { target: 'relay1' } } };
  }

  const forMin = t.match(/for\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(minute|minutes|min)/);
  const forSec = t.match(/for\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(second|seconds|sec)/);
  const valveN = extractNumber(t) ?? 1;
  const valve = `valve${Math.min(Math.max(valveN, 1), 3)}`;

  if ((/\bwater(ing)?\b|\birrigate\b/.test(t)) && (forMin || forSec)) {
    const n = extractNumber((forMin || forSec)![0]) || 1;
    const duration = forMin ? n * 60 : n;
    return { parsed: { command_type: 'water_for', payload: { target: valve, duration } } };
  }

  if (/\bvalve\b/.test(t) || /\bwater\b/.test(t)) {
    if (/\boff\b|\bclose\b|\bstop\b/.test(t))
      return { parsed: { command_type: 'valve_off', payload: { target: valve } } };
    if (/\bon\b|\bopen\b|\bstart\b/.test(t))
      return { parsed: { command_type: 'valve_on', payload: { target: valve } } };
  }
  return { error: `Could not understand: "${transcript}"` };
}
