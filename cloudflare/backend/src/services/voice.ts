/**
 * Rule-based NLU for in-app voice commands.
 * Runs in the Worker — no external APIs needed.
 *
 * Supports English plus romanised and native-script keywords for:
 * Hindi, Tamil, Telugu, and Kannada (common Indian farm languages).
 *
 * Recognised command_types:
 *   water_for   – water zone N for D seconds
 *   valve_on    – open valve N
 *   valve_off   – close valve N
 *   relay_on    – turn on motor / pump / relay
 *   relay_off   – turn off motor / pump / relay
 *   stop_all    – emergency stop everything
 *   query_weather – ask for weather / temperature
 *   query_aqi   – ask for air quality index
 *   query_status – ask for device / system status
 */

// ─── Number helpers ───────────────────────────────────────────────────────────

const NUM_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  // Hindi romanised
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5,
  chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
};

function extractNumber(text: string): number | null {
  const m = text.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  for (const [w, v] of Object.entries(NUM_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(text)) return v;
  }
  return null;
}

// ─── Multi-language keyword patterns ─────────────────────────────────────────

/** STOP — en / hi / ta / te / kn (romanised + native script) */
const RE_STOP = new RegExp(
  [
    '\\b(stop|cancel|halt|pause)\\b',
    '\\b(band|ruko|rok)\\b',              // Hindi romanised
    '\\b(nillisu|beda)\\b',               // Kannada romanised
    '\\b(aapu|aapaandi)\\b',              // Telugu romanised
    '\\b(nirutthu|nimirthu)\\b',          // Tamil romanised
    'बंद|रुको|रोको',                       // Hindi native
    'ನಿಲ್ಲಿಸು|ಬೇಡ',                        // Kannada native
    'ఆపు|ఆపండి',                           // Telugu native
    'நிறுத்து|நிறுத்துங்க',                // Tamil native
  ].join('|'),
);

/** WATER — en / hi / ta / te / kn */
const RE_WATER = new RegExp(
  [
    '\\b(water|irrigate|watering)\\b',
    '\\b(paani|pani|sinchai)\\b',         // Hindi romanised
    '\\b(thanneer|tanni)\\b',             // Tamil romanised
    '\\b(neeru|neerupeyu)\\b',            // Telugu / Kannada romanised
    'पानी|सिंचाई',                         // Hindi native
    'ನೀರು',                               // Kannada native
    'నీరు|నీళ్ళు',                         // Telugu native
    'தண்ணீர்',                            // Tamil native
  ].join('|'),
);

/** ON / OPEN / START */
const RE_ON = new RegExp(
  [
    '\\b(on|open|start|begin)\\b',
    '\\b(chalu|shuru|kholo)\\b',          // Hindi romanised
    '\\b(tere|tirubidi)\\b',              // Kannada / Telugu romanised
    '\\b(thira|thirakka)\\b',             // Tamil romanised
    'चालू|शुरू|खोलो',                      // Hindi native
    'ತೆರೆ|ಚಾಲು',                           // Kannada native
    'తెరువు|ప్రారంభించు',                   // Telugu native
    'திற|தொடங்கு',                         // Tamil native
  ].join('|'),
);

/** OFF / CLOSE / STOP (for relay/valve context) */
const RE_OFF = new RegExp(
  [
    '\\b(off|close|shut|stop|end)\\b',
    '\\b(band|bund|moodu|mooyi)\\b',      // Hindi/Kannada/Telugu romanised
    '\\b(moodu|mucchu)\\b',               // Kannada romanised
    '\\b(mooyi|aapivey)\\b',              // Telugu romanised
    '\\b(moodu|moodi)\\b',               // Tamil romanised
    'बंद|बंद करो',                         // Hindi native
    'ಮುಚ್ಚು|ಬಂದ್',                         // Kannada native
    'మూయి|ఆపు',                            // Telugu native
    'மூடு|நிறுத்து',                       // Tamil native
  ].join('|'),
);

/** MOTOR / PUMP / RELAY */
const RE_MOTOR = /\b(motor|pump|relay|light|moter|motar)\b/i;

/** VALVE */
const RE_VALVE = /\b(valve|valv|nal|nali)\b/i;

/** WEATHER / TEMPERATURE */
const RE_WEATHER = new RegExp(
  [
    '\\b(weather|temperature|temp|climate|forecast|rain|barish)\\b',
    '\\b(mausam|tapman|baarish)\\b',      // Hindi romanised
    '\\b(vaanam|mazhai)\\b',              // Tamil romanised
    '\\b(vaatavarana|vana|vanailu)\\b',   // Telugu romanised
    '\\b(havamana|male)\\b',              // Kannada romanised
    'मौसम|तापमान|बारिश',                   // Hindi native
    'வானிலை|மழை',                         // Tamil native
    'వాతావరణం|వర్షం',                      // Telugu native
    'ಹವಾಮಾನ|ಮಳೆ',                          // Kannada native
  ].join('|'),
  'i',
);

/** AIR QUALITY / AQI / POLLUTION */
const RE_AQI = new RegExp(
  [
    '\\b(air\\s*quality|aqi|pollution|smog|dust|particulate)\\b',
    '\\b(hawa|vayu|pradushan|pradushan)\\b', // Hindi romanised
    '\\b(kaatru|maasupadal)\\b',            // Tamil romanised
    '\\b(gaali|kolushu)\\b',               // Telugu/Kannada romanised
    'वायु गुणवत्ता|प्रदूषण|हवा',             // Hindi native
    'காற்று தரம்|மாசுபாடு',                // Tamil native
    'గాలి నాణ్యత|కాలుష్యం',                // Telugu native
    'ಗಾಳಿ ಗುಣಮಟ್ಟ|ಮಾಲಿನ್ಯ',                // Kannada native
  ].join('|'),
  'i',
);

/** STATUS / DIAGNOSTIC */
const RE_STATUS = new RegExp(
  [
    '\\b(status|health|working|check|diagnose|info|report)\\b',
    '\\b(jankari|sthiti|haal|kaam)\\b',   // Hindi romanised
    '\\b(nilai|nila)\\b',                 // Tamil romanised
    '\\b(sthiti|paristhiti)\\b',          // Telugu romanised
    '\\b(sthiti|gamathi)\\b',             // Kannada romanised
    'स्थिति|जानकारी|हाल',                  // Hindi native
    'நிலை',                               // Tamil native
    'స్థితి',                              // Telugu native
    'ಸ್ಥಿತಿ',                              // Kannada native
  ].join('|'),
  'i',
);

// ─── Duration extraction ──────────────────────────────────────────────────────

const NUM_PATTERN = '(\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|chhe|saat|aath|nau|das)';

const RE_FOR_MIN = new RegExp(
  `for\\s+${NUM_PATTERN}\\s*(minute|minutes|min|mins|मिनट|நிமிடம்|నిమిషం|ನಿಮಿಷ)`,
  'i',
);
const RE_FOR_SEC = new RegExp(
  `for\\s+${NUM_PATTERN}\\s*(second|seconds|sec|secs|सेकंड|வினாடி|సెకను|ಸೆಕೆಂಡ್)`,
  'i',
);

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseVoice(transcript: string): { parsed?: any; error?: string } {
  if (!transcript || typeof transcript !== 'string') return { error: 'Empty transcript' };
  const t = transcript.toLowerCase().trim();

  // ── 1. Information queries (check BEFORE stop to avoid "status" → stop_all) ──

  if (RE_AQI.test(t)) {
    return { parsed: { command_type: 'query_aqi', payload: {} } };
  }

  if (RE_WEATHER.test(t)) {
    return { parsed: { command_type: 'query_weather', payload: {} } };
  }

  if (RE_STATUS.test(t) && !RE_WATER.test(t) && !RE_MOTOR.test(t) && !RE_VALVE.test(t)) {
    return { parsed: { command_type: 'query_status', payload: {} } };
  }

  // ── 2. Emergency stop everything ─────────────────────────────────────────────

  if (
    /(stop|cancel|halt|band|ruko|nillisu|aapu|nirutthu).*(water|all|everything|sab|paani|sab kuch)/i.test(t) ||
    /stop\s+watering/i.test(t) ||
    (RE_STOP.test(t) && !RE_VALVE.test(t) && !RE_MOTOR.test(t) && !RE_WATER.test(t))
  ) {
    return { parsed: { command_type: 'stop_all', payload: {} } };
  }

  // ── 3. Motor / pump / relay ───────────────────────────────────────────────────

  if (RE_MOTOR.test(t)) {
    if (RE_OFF.test(t)) return { parsed: { command_type: 'relay_off', payload: { target: 'relay1' } } };
    if (RE_ON.test(t))  return { parsed: { command_type: 'relay_on',  payload: { target: 'relay1' } } };
  }

  // ── 4. Timed watering (water zone N for D minutes/seconds) ───────────────────

  const valveN = extractNumber(t) ?? 1;
  const valve  = `valve${Math.min(Math.max(valveN, 1), 3)}`;

  const forMin = RE_FOR_MIN.exec(t);
  const forSec = RE_FOR_SEC.exec(t);

  if (RE_WATER.test(t) && (forMin || forSec)) {
    const match = (forMin || forSec)!;
    const n = extractNumber(match[1]) ?? 1;
    const duration = forMin ? n * 60 : n;
    return { parsed: { command_type: 'water_for', payload: { target: valve, duration } } };
  }

  // ── 5. Valve on/off ───────────────────────────────────────────────────────────

  if (RE_VALVE.test(t) || RE_WATER.test(t)) {
    if (RE_OFF.test(t)) return { parsed: { command_type: 'valve_off', payload: { target: valve } } };
    if (RE_ON.test(t))  return { parsed: { command_type: 'valve_on',  payload: { target: valve } } };
  }

  return { error: `Could not understand: "${transcript}"` };
}
