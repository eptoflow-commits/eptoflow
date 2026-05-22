/**
 * Rule-based NLU for in-app voice commands.
 * Runs entirely on the backend — no external APIs needed.
 *
 * Supports English plus romanised and native-script keywords for:
 * Hindi, Tamil, Telugu, and Kannada (common Indian farm languages).
 *
 * Recognised command_types:
 *   water_for    – water zone N for D seconds
 *   valve_on     – open valve N
 *   valve_off    – close valve N
 *   relay_on     – turn on motor / pump / relay
 *   relay_off    – turn off motor / pump / relay
 *   stop_all     – emergency stop everything
 *   query_weather – ask for current weather / temperature
 *   query_aqi    – ask for air quality index
 *   query_status  – ask for device / system status
 */

// ─── Number helpers ───────────────────────────────────────────────────────────

const NUM_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  // Hindi romanised
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5,
  chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
};

function extractNumber(text) {
  const m = text.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  for (const [word, value] of Object.entries(NUM_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return value;
  }
  return null;
}

// ─── Multi-language keyword patterns ─────────────────────────────────────────

const RE_STOP = new RegExp(
  [
    '\\b(stop|cancel|halt|pause)\\b',
    '\\b(band|ruko|rok)\\b',
    '\\b(nillisu|beda)\\b',
    '\\b(aapu|aapaandi)\\b',
    '\\b(nirutthu|nimirthu)\\b',
    'बंद|रुको|रोको',
    'ನಿಲ್ಲಿಸು|ಬೇಡ',
    'ఆపు|ఆపండి',
    'நிறுத்து|நிறுத்துங்க',
  ].join('|'),
);

const RE_WATER = new RegExp(
  [
    '\\b(water|irrigate|watering)\\b',
    '\\b(paani|pani|sinchai)\\b',
    '\\b(thanneer|tanni)\\b',
    '\\b(neeru|neerupeyu)\\b',
    'पानी|सिंचाई',
    'ನೀರು',
    'నీరు|నీళ్ళు',
    'தண்ணீர்',
  ].join('|'),
);

const RE_ON = new RegExp(
  [
    '\\b(on|open|start|begin)\\b',
    '\\b(chalu|shuru|kholo)\\b',
    '\\b(tere|tirubidi)\\b',
    '\\b(thira|thirakka)\\b',
    'चालू|शुरू|खोलो',
    'ತೆರೆ|ಚಾಲು',
    'తెరువు|ప్రారంభించు',
    'திற|தொடங்கு',
  ].join('|'),
);

const RE_OFF = new RegExp(
  [
    '\\b(off|close|shut|stop|end)\\b',
    '\\b(band|bund|moodu|mooyi)\\b',
    '\\b(moodu|mucchu)\\b',
    '\\b(mooyi|aapivey)\\b',
    '\\b(moodi)\\b',
    'बंद|बंद करो',
    'ಮುಚ್ಚು|ಬಂದ್',
    'మూయి|ఆపు',
    'மூடு|நிறுத்து',
  ].join('|'),
);

const RE_MOTOR  = /\b(motor|pump|relay|light|moter|motar)\b/i;
const RE_VALVE  = /\b(valve|valv|nal|nali)\b/i;

const RE_WEATHER = new RegExp(
  [
    '\\b(weather|temperature|temp|climate|forecast|rain|barish)\\b',
    '\\b(mausam|tapman|baarish)\\b',
    '\\b(vaanam|mazhai)\\b',
    '\\b(vaatavarana|vana|vanailu)\\b',
    '\\b(havamana|male)\\b',
    'मौसम|तापमान|बारिश',
    'வானிலை|மழை',
    'వాతావరణం|వర్షం',
    'ಹವಾಮಾನ|ಮಳೆ',
  ].join('|'),
  'i',
);

const RE_AQI = new RegExp(
  [
    '\\b(air\\s*quality|aqi|pollution|smog|dust|particulate)\\b',
    '\\b(hawa|vayu|pradushan)\\b',
    '\\b(kaatru|maasupadal)\\b',
    '\\b(gaali|kolushu)\\b',
    'वायु गुणवत्ता|प्रदूषण|हवा',
    'காற்று தரம்|மாசுபாடு',
    'గాలి నాణ్యత|కాలుష్యం',
    'ಗಾಳಿ ಗುಣಮಟ್ಟ|ಮಾಲಿನ್ಯ',
  ].join('|'),
  'i',
);

const RE_STATUS = new RegExp(
  [
    '\\b(status|health|working|check|diagnose|info|report)\\b',
    '\\b(jankari|sthiti|haal|kaam)\\b',
    '\\b(nilai|nila)\\b',
    '\\b(paristhiti)\\b',
    '\\b(gamathi)\\b',
    'स्थिति|जानकारी|हाल',
    'நிலை',
    'స్థితి',
    'ಸ್ಥಿತಿ',
  ].join('|'),
  'i',
);

const NUM_PATTERN = '(\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|chhe|saat|aath|nau|das)';
const RE_FOR_MIN  = new RegExp(`for\\s+${NUM_PATTERN}\\s*(minute|minutes|min|mins|मिनट|நிமிடம்|నిమిషం|ನಿಮಿಷ)`, 'i');
const RE_FOR_SEC  = new RegExp(`for\\s+${NUM_PATTERN}\\s*(second|seconds|sec|secs|सेकंड|வினாடி|సెకను|ಸೆಕೆಂಡ್)`, 'i');

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a natural-language transcript into a {command_type, payload} object.
 * @returns {{ parsed: object } | { error: string }}
 */
export function parseVoiceCommand(transcriptRaw) {
  if (!transcriptRaw || typeof transcriptRaw !== 'string') {
    return { error: 'Empty transcript' };
  }
  const t = transcriptRaw.toLowerCase().trim();

  // ── 1. Information queries ────────────────────────────────────────────────
  if (RE_AQI.test(t)) {
    return { parsed: { command_type: 'query_aqi', payload: {} } };
  }
  if (RE_WEATHER.test(t)) {
    return { parsed: { command_type: 'query_weather', payload: {} } };
  }
  if (RE_STATUS.test(t) && !RE_WATER.test(t) && !RE_MOTOR.test(t) && !RE_VALVE.test(t)) {
    return { parsed: { command_type: 'query_status', payload: {} } };
  }

  // ── 2. Emergency stop everything ─────────────────────────────────────────
  if (
    /(stop|cancel|halt|band|ruko|nillisu|aapu|nirutthu).*(water|all|everything|sab|paani)/i.test(t) ||
    /stop\s+watering/i.test(t) ||
    (RE_STOP.test(t) && !RE_VALVE.test(t) && !RE_MOTOR.test(t) && !RE_WATER.test(t))
  ) {
    return { parsed: { command_type: 'stop_all', payload: {} } };
  }

  // ── 3. Motor / pump / relay ───────────────────────────────────────────────
  if (RE_MOTOR.test(t)) {
    if (RE_OFF.test(t)) return { parsed: { command_type: 'relay_off', payload: { target: 'relay1' } } };
    if (RE_ON.test(t))  return { parsed: { command_type: 'relay_on',  payload: { target: 'relay1' } } };
  }

  // ── 4. Timed watering ────────────────────────────────────────────────────
  const valveNum = extractNumber(t) ?? 1;
  const valve    = `valve${Math.min(Math.max(valveNum, 1), 3)}`;
  const forMin   = RE_FOR_MIN.exec(t);
  const forSec   = RE_FOR_SEC.exec(t);

  if (RE_WATER.test(t) && (forMin || forSec)) {
    const match = forMin || forSec;
    const n = extractNumber(match[1]) ?? 1;
    const duration = forMin ? n * 60 : n;
    return { parsed: { command_type: 'water_for', payload: { target: valve, duration } } };
  }

  // ── 5. Valve on / off ────────────────────────────────────────────────────
  if (RE_VALVE.test(t) || RE_WATER.test(t)) {
    if (RE_OFF.test(t)) return { parsed: { command_type: 'valve_off', payload: { target: valve } } };
    if (RE_ON.test(t))  return { parsed: { command_type: 'valve_on',  payload: { target: valve } } };
  }

  return { error: `Could not understand: "${transcriptRaw}"` };
}
