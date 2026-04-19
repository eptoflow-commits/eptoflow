/**
 * Very small rule-based NLU for in-app voice commands.
 * The Web Speech API in the browser produces a transcript which we parse here.
 * Runs entirely on the backend — no external APIs used.
 */

const NUM_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function extractNumber(text) {
  const m = text.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  for (const [word, value] of Object.entries(NUM_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return value;
  }
  return null;
}

/**
 * Parse natural language into a {command_type, payload} structure.
 * Returns { parsed: {...} } or { error: 'message' } if not understood.
 */
export function parseVoiceCommand(transcriptRaw) {
  if (!transcriptRaw || typeof transcriptRaw !== 'string') {
    return { error: 'Empty transcript' };
  }
  const text = transcriptRaw.toLowerCase().trim();

  // Stop commands
  if (/(stop|cancel|halt).*(water|all|everything)/.test(text) ||
      /stop\s+watering/.test(text) ||
      /\bstop\b/.test(text)) {
    return { parsed: { command_type: 'stop_all', payload: {} } };
  }

  // Motor / pump / light mapping → relay1
  const relayMatch = /\b(motor|pump|light|relay)\b/.test(text);
  if (relayMatch) {
    if (/\boff\b|\bstop\b/.test(text))
      return { parsed: { command_type: 'relay_off', payload: { target: 'relay1' } } };
    if (/\bon\b|\bstart\b/.test(text))
      return { parsed: { command_type: 'relay_on',  payload: { target: 'relay1' } } };
  }

  // Watering for N minutes / seconds
  const forMinutes = text.match(/for\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(minute|minutes|min)/);
  const forSeconds = text.match(/for\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(second|seconds|sec)/);
  const valveNum = extractNumber(text) ?? 1;
  const valveTarget = `valve${Math.min(Math.max(valveNum, 1), 3)}`;

  if (/\bwater(ing)?\b|\birrigate\b/.test(text) && (forMinutes || forSeconds)) {
    const n = extractNumber((forMinutes || forSeconds)[0]) || 1;
    const duration = forMinutes ? n * 60 : n;
    return {
      parsed: { command_type: 'water_for', payload: { target: valveTarget, duration } },
    };
  }

  // valve on/off
  if (/\bvalve\b/.test(text) || /\bwater\b/.test(text)) {
    if (/\boff\b|\bclose\b|\bstop\b/.test(text)) {
      return { parsed: { command_type: 'valve_off', payload: { target: valveTarget } } };
    }
    if (/\bon\b|\bopen\b|\bstart\b/.test(text)) {
      return { parsed: { command_type: 'valve_on',  payload: { target: valveTarget } } };
    }
  }

  return { error: `Could not understand: "${transcriptRaw}"` };
}
