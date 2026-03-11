import { useState, useEffect, useRef } from "react";

// ── Timestamp helpers ─────────────────────────────────────────────────────────
const fmtDT = (d) => {
  if(!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if(isNaN(dt)) return String(d);
  return dt.toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
};
const fmtTime = (d) => {
  if(!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if(isNaN(dt)) return String(d);
  return dt.toLocaleTimeString("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"});
};

// ── Price source: Finnhub only (no TwelveData) ───────────────────────────────
async function fetchTwelveBatch(ids) {
  // Routes to Finnhub — kept for compatibility with existing call sites
  const results = await Promise.all(ids.map(id => fetchFinnhubPrice(id).then(r => [id, r])));
  return Object.fromEntries(results.filter(([,v])=>v));
}

// ── Finnhub ───────────────────────────────────────────────────────────────────
const FINNHUB_MAP = {
  XAUUSD:"OANDA:XAU_USD", US30:"OANDA:US30_USD",  US100:"OANDA:NAS100_USD",
  EURUSD:"OANDA:EUR_USD",  GBPUSD:"OANDA:GBP_USD", BTCUSD:"BINANCE:BTCUSDT",
  USDJPY:"OANDA:USD_JPY",  USDCHF:"OANDA:USD_CHF", USOIL:"OANDA:WTICO_USD",
  DXY:"OANDA:USD_BASKET",  VIX:"CBOE:VIX",         US10Y:"TVC:US10Y",
  SPX:"OANDA:SPX500_USD",
};

async function fetchFinnhubPrice(id) {
  const sym = FINNHUB_MAP[id]; if(!sym) return null;
  try {
    const res = await fetch(`/api/finnhub?symbol=${encodeURIComponent(sym)}`, {signal:AbortSignal.timeout(5000)});
    const d = await res.json();
    if(!d.c || d.c===0) return null;
    const chg = d.dp ?? (d.pc ? ((d.c-d.pc)/d.pc*100) : 0);
    const isFx = ["EURUSD","GBPUSD","USDJPY","USDCHF"].includes(id);
    return { price:d.c.toFixed(isFx?4:2), change:(chg>=0?"+":"")+chg.toFixed(2)+"%", direction:chg>=0?"up":"down", raw:chg };
  } catch(_) { return null; }
}

// fetchLivePrice: Finnhub only
const FOREX_IDS = ["EURUSD","GBPUSD","USDJPY","USDCHF"];
async function fetchLivePrice(id) {
  const p = await fetchFinnhubPrice(id); if(p) return p;
  return null;
}



// ── Accent colour (user-configurable) ─────────────────────────────────────────
const DEFAULT_ACCENT = "#089981";

// ── TradingView-stijl asset logo's ──────────────────────────────────────────
const AssetLogo = ({ id, size=24 }) => {
  const s = size;
  const defs = {
    XAUUSD: <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#F5C518"/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="700" fill="#7A4F00">XAU</text></svg>,
    US30:   <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1652F0"/><text x="16" y="20" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" fill="#fff">DJI</text></svg>,
    US100:  <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#7B2FBE"/><text x="16" y="20" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" fill="#fff">NQ</text></svg>,
    EURUSD: <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1A3A8F"/><text x="16" y="22" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="16" fontWeight="700" fill="#FFD700">€</text></svg>,
    GBPUSD: <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#C8102E"/><text x="16" y="22" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="15" fontWeight="700" fill="#fff">£</text></svg>,
    BTCUSD: <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#F7931A"/><text x="16" y="22" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="700" fill="#fff">₿</text></svg>,
    USDJPY: <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#BC002D"/><text x="16" y="22" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="700" fill="#fff">¥</text></svg>,
    USDCHF: <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#D52B1E"/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="700" fill="#fff">CHF</text></svg>,
    USOIL:  <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2C2C2C"/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" fill="#fff">OIL</text></svg>,
    SPX:    <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1652F0"/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" fill="#fff">SPX</text></svg>,
    DXY:    <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="var(--t3)"/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" fill="#fff">DXY</text></svg>,
  };
  if(defs[id]) return defs[id];
  const colors = ["#089981","#1652F0","#7B2FBE","#F59E0B","#EF4444","#06B6D4"];
  const bg = colors[id.charCodeAt(0) % colors.length];
  const abbr = id.replace(/USD|EUR|GBP/,"").slice(0,3);
  return <svg width={s} height={s} viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill={bg}/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize={abbr.length>3?7:9} fontWeight="700" fill="#fff">{abbr}</text></svg>;
};

const ASSET_META = {
  XAUUSD: { color:"#F5C518" }, US30: { color:"#1652F0" }, US100: { color:"#7B2FBE" },
  EURUSD: { color:"#1A3A8F" }, GBPUSD: { color:"#C8102E" }, BTCUSD: { color:"#F7931A" },
  USDJPY: { color:"#BC002D" }, USDCHF: { color:"#D52B1E" }, USOIL: { color:"#2C2C2C" },
  SPX: { color:"#1652F0" },
};


const BASE_ASSETS = [
  { id:"XAUUSD", label:"XAU/USD", full:"Gold / US Dollar",       group:"macro",  searchTerms:"gold XAU spot price" },
  { id:"US30",   label:"US30",   full:"Dow Jones Industrial",     group:"equity", searchTerms:"Dow Jones US30 DJIA" },
  { id:"US100",  label:"US100",  full:"Nasdaq 100 Index",         group:"equity", searchTerms:"Nasdaq 100 US100 NQ futures" },
  { id:"EURUSD", label:"EUR/USD",full:"Euro / US Dollar",         group:"fx",     searchTerms:"EUR/USD euro dollar forex" },
  { id:"GBPUSD", label:"GBP/USD",full:"Pound Sterling / Dollar",  group:"fx",     searchTerms:"GBP/USD pound sterling forex" },
];

const ANALYSIS_SYSTEM = `You are a Hybrid Market Intelligence Trader (HYBRID PROMPT v6.3 — Institutional Flow Edition).
No web search — all context is provided. Bias = ONLY fundamental macro analysis, NEVER based on price/%.
All output must be in Dutch.

Trading context: Scalping on 1m/3m using CVD, accumulation, aggressor and volume profile during London session (07:00-14:00 Amsterdam).
The bias is the macro filter — entries are found independently.
Do NOT include: entry suggestions, SL/TP, price levels, or COT data.

BASELINE RULE — always apply:
Hold confidence answers ONE question only: "Are conditions strong enough to stay in the trade longer?"
Do NOT mention RR, profit targets, or position sizing — trader decides that independently.
Only assess: is the intraday environment clear and aligned enough to hold, or too uncertain/conflicting to hold.

Use the 4 Macro Pillars — Economic Data Surprise, Central Bank Catalyst, Institutional Flow, Intraday Correlation — to strengthen and validate bias. All factors must work together.

━━━ PHASE 0 — SESSION CONTEXT (apply if provided, do not recalculate) ━━━
0.1 Liquidity Regime: Apply cached QE/QT/balance sheet context if available.
0.2 Yield Curve Context: Apply cached steepening/flattening/inversion context.
0.3 Political Risk (EUR/USD, GBP/USD): Apply cached political stability context.

━━━ PHASE 1 — MACRO DATA (use provided Intel context, do not recalculate) ━━━

1.1 Economic Data Surprise Impact ("Ignition Check"):
- Only most recent high-impact release of current day/last session
- Actual vs Consensus — magnitude and direction of surprise
- Strong positive surprise → Bullish bias this session | Strong negative → Bearish | In-line → No catalyst
- State: "Data Ignition: [Asset] — [Release] came in [above/below] consensus ([Actual] vs [Expected]). Session bias: [Bullish/Bearish/Neutral]."

1.2 Central Bank Catalyst Filter ("Trigger Check"):
- Only statements/decisions from past 24-72 hours
- Priced in = no edge | Surprising = active catalyst
- Speech scheduled today → ⚠️ Volatility risk, wait for reaction
- State: "Session Catalyst: [Bank] — statement [X hours ago] was [surprising/priced in]. Impact: [Bullish/Bearish/Neutral]."

1.3 Institutional Flow Filter ("Real Money Check"):
- VIX falling → Risk-on | VIX rising → Risk-off
- USD strong + indices rising → Contradictory signal
- Gold + indices both rising → ⚠️ Market searching for direction
- VIX conclusion from this pillar is the BASE for all subsequent VIX analysis — do not recalculate
- State: "Institutional Flow: VIX [falling/rising] — assets [confirm/contradict] bias. Risk appetite: [Risk-On / Risk-Off / Conflicting]."

1.4 USD Breadth Confirmation (EUR/USD, GBP/USD, Gold, Indices):
- Check EUR/USD, GBP/USD, AUD/USD, USD/JPY, USD/CAD direction
- 4-5 pairs aligned → strong USD breadth, increase confidence
- 3 pairs → moderate confirmation
- 0-2 pairs → weak breadth, reduce confidence
- USD Breadth score is foundation for all DXY-related analysis — do not recalculate

1.5 Intraday Correlation Filter ("Confirmation Check"):
- Forex: DXY confirms or contradicts direction? AUD/JPY risk barometer?
- Indices: All major indices same direction? Divergence = sector rotation, caution
- Gold: DXY direction (headwind if rising) + VIX (use Pillar 3 base) + real yields
  Override VIX only if: VIX falling AND Gold +0.5% AND concrete safe-haven trigger active
- Confirm or contradict: ✅ High conviction | ⚠️ Moderate | ❌ Low conviction

━━━ PHASE 2 — BIAS FORMATION (use Phase 0+1 conclusions, never recalculate) ━━━

2.1 Bond Market Lead Signal: Use yield direction from Pillar 1.3 as base. Is bond market leading or confirming other assets?
2.2 Geopolitical & Trade War Risk (Gold, EUR/USD, GBP/USD): Escalation → bullish gold, bearish risk currencies. Relief → reduced safe-haven demand.
2.3 DXY/Gold Correlation Status (XAU/USD):
  - Normal: DXY↑+Gold↓ or DXY↓+Gold↑ → unlimited confidence
  - Anomaly: DXY↑+Gold↑ or DXY↓+Gold↓ → label "Anomalie", max confidence 65%
  - Anomaly >2 sessions → max confidence 55%
  - Determine mechanism: safe-haven flow / stagflation hedge / technical squeeze
2.4 Yield Regime (mandatory all assets, use USD Breadth as DXY base):
  - DXY↑+Gold↑+Yields↑ → Stagflatie-flow
  - DXY↑+Gold↑+Yields↓ → Pure risk-off / safe haven
  - DXY↓+Gold↑+Yields↓ → Classic risk-off
  - DXY↓+Gold↑+Yields↑ → Inflation dominates, USD losing grip
2.5 News Timing Context: News >4h old → lower weight | Last hour → heavy weight | Expected within 1h → cautious, cap confidence
2.6 Real Yield Confirmation (Gold): Falling real yields → bullish | Rising real yields → bearish. Use Pillar 1.3 yield conclusion as base.
2.7 Intermarket Confirmation: EUR/USD bias confirmed by GBP/USD? Gold by Silver? US100 by US30? More confirmations → higher confidence.
2.8 Momentum Confirmation: Price moving in bias direction with follow-through → higher confidence. Divergence → lower confidence.
2.9 Price Reaction to News Check: Bullish news + price already up >1% → possibly priced in → exhaustion warning. Bullish news + price barely moved <0.1% → not priced in → potential further move.
2.10 Bias Timing vs London Open: Bias active before open → heavy weight. Bias >3h without confirmation → confidence decays.
2.11 Session Flow: Asia direction/driver → London confirming or reversing → NY catalysts before 14:00.
2.12 Options Gamma (only if reliable source found via web search, else state: "Gamma data not available — section skipped."):
  Positive gamma → range behaviour likely | Negative gamma → trending moves likely
2.13 Sector Leadership (Indices only): Nasdaq: tech + semis + mega-cap participation. Dow: financials + industrials. More participation → stronger bias.
2.14 Volatility Regime (Indices): Use VIX from Pillar 1.3. Rising VIX → bearish equities. Falling VIX → supportive.

━━━ PHASE 3 — CORRELATION MONITORING ━━━
3.1 Check whether correlating assets still confirm bias in real-time.
3.2 Real-time correlation drift: Are related assets maintaining or breaking alignment? Divergence → push toward WAIT.

━━━ PHASE 4 — PULSE INDICATOR (per asset) ━━━
Labels: QUIET / WAIT / TRADABLE / WILD

4.1 Technical Layer:
- ATR vs 20-day baseline: <70% = compression (QUIET) | 70-120% = normal | >120% = expansion
- Move thresholds: Forex: impulsive >0.3%, neutral 0.1-0.3%, corrective <0.1%
  Gold: impulsive >0.5%, neutral 0.2-0.5%, corrective <0.2%
  Indices: impulsive >0.8%, neutral 0.3-0.8%, corrective <0.3%
- Market structure: HH/HL trending or ranging

4.2 Fundamental Layer (use Phase 1+2 conclusions):
- Macro regime, high impact news within 30 min, yield direction, DXY, session flow

4.3 Additional layers:
- London participation: volume expanding + impulses holding → TRADABLE | Not expanding → WAIT
- News reaction phase: Pre-news compression → WAIT | Immediate reaction → WILD | Post-reaction stabilisation → TRADABLE
- Scalp horizon: estimate usable trading window

4.4 Pulse Label Decision:
QUIET = low volatility, no edge | WAIT = conflicting signals or pre-news | TRADABLE = aligned conditions | WILD = extreme volatility, news shock
Output structure: 1) Label 2) Reason 3) AI Opinion 4) Trading Environment

━━━ PHASE 5 — HOLD CONFIDENCE & MARKET STRUCTURE ━━━

5.1 MACRO HOLD CONTEXT (0-100%) — FIXED CALCULATION, no AI estimation:
This answers ONE question: "Is the macro/fundamental environment still strong enough to stay in the trade?"
Do NOT assess technical structure or volume/CVD — trader has better information on that.

CALCULATION — based only on macro/fundamental factors:

Pillar alignment (max 40pts):
- All 4 macro pillars still confirm trade direction = 40
- 3 pillars confirm = 30
- 2 pillars confirm = 18
- 1 or fewer = 8
- Majority conflicting = 0

News timing (max 25pts):
- No high-impact news expected, current news supports bias, not yet priced in = 25
- News supports but partially priced in = 15
- Neutral news environment = 10
- High-impact event within 30 min = 0

Cross-asset confirmation (max 20pts):
- All related assets still confirm bias direction = 20
- Partially confirming = 12
- Diverging = 0

Yield/DXY regime still intact (max 15pts):
- Yield regime and DXY still support bias = 15
- Partially shifted = 8
- Regime changed against bias = 0

MACRO HOLD CONTEXT LABELS:
80-100% = Voluit holden — macro volledig aligned, alle fundamentelen bevestigen nog steeds
70-79%  = Goede hold — macro sterk genoeg, fundamentelen ondersteunen de trade
60-69%  = Zeer twijfelachtig — macro zwakt af of gemengd, risicovol om te holden
40-59%  = Niet holden — macro te onduidelijk of conflicterend
<40%    = Definitief niet holden — macro heeft gedraaid tegen de bias

Score NEVER higher than bias confidence. XAU anomaly: max 60%.
Provide full Dutch explanation: which factors confirm, which have shifted, any news risk.

5.2 Technical trend and intraday structure (separate fields, do not influence bias):
technical_trend: Bullish/Bearish/Neutral | intraday_structuur: HH/HL or LH/LL or Ranging

5.3 Range vs Trend Detection: Trending / Ranging / Breakout potential. Always give explicit opinion.

━━━ PHASE 6 — CAPITAL FLOWS & MARKET REGIME ━━━
6.1 Capital Flow: Analyze flows across related assets. State direction and implication.
6.2 Market Regime: Risk-On / Risk-Off / Stagflatie / Neutraal / Choppy. Integrate into bias narrative.

━━━ PHASE 7 — BIAS RULES & CONFIDENCE ━━━

7.1 Bias Stability: Change bias ONLY on fundamental new macro news or regime shift. Small price movements = NEVER a reason. When in doubt: keep previous bias, lower confidence. Each asset has independent bias.
Confidence decay never changes bias direction. Low confidence only affects communication strength.

7.2 Confidence Decay: 5% decrease per hour. Reconfirm or lower every refresh.

7.3 Fail Condition: fail_condition max 8 words — when does the bias invalidate.

7.4 BIAS CONFIDENCE — FIXED CALCULATION (mandatory, no AI estimation):
Calculate confidence by adding points for each confirmed factor:

  Pillar alignment (max 40pts):
  - 4 pillars aligned = 40 | 3 aligned = 30 | 2 aligned = 18 | 1 aligned = 8 | 0 aligned = 0

  Intermarket bevestiging (max 15pts):
  - Related assets confirm bias = 15 | Partially = 8 | Diverging = 0

  Momentum (max 15pts):
  - Price confirms bias with follow-through = 15 | Neutral/developing = 7 | Diverging = 0

  Nieuws niet ingeprijsd (max 10pts):
  - News fresh + not yet priced in = 10 | Partially priced in = 5 | Fully priced in = 0

  Sessie timing (max 10pts):
  - Bias active at London open or forming during London = 10 | Bias >2h old, no new confirmation = 4

  Geen anomalie/conflict (max 10pts):
  - No correlation anomaly, no conflicting signals = 10 | Minor conflict = 5 | Active anomaly = 0

Total = sum of all factors. Cap at 65% if XAU correlation anomaly active. Cap at 55% if anomaly >2 sessions.

CONFIDENCE LABELS (use in confidence_label field):
0-40%   = Geen confirmatie — prijs zoekt richting, niet traden
40-50%  = Zeer zwak — nauwelijks edge, niet traden
50-60%  = Lichte bias — zwakke edge, lichte positie mogelijk
60-70%  = Redelijke bias — versterkte confirmatie, redelijke edge
70-80%  = Sterke bias — duidelijke edge, sterke fundamentele confirmatie
80-100% = Zeer sterke bias — overduidelijke edge, meerdere factoren aligned

POSITION SIZING GUIDE (include in confidence_label):
<50%  = Niet traden
50-60% = Maximaal 25% van normale positie
60-70% = 50% van normale positie
70-80% = 75% van normale positie
>80%  = Volle positie

━━━ OUTPUT FIELDS (all in Dutch) ━━━
mini_summary: MAX 1 sentence for card — core message.
confidence_label: The confidence label based on the score e.g. "Sterke bias (74%) — 75% positie" — always include % and position sizing.
ai_opinie: AI qualitative opinion separate from confidence score. 1-2 sentences. What does the AI think about the quality of this setup? Any concerns? e.g. "Structuur ziet er clean uit maar London volume nog laag — wacht op bevestiging eerste 15 min." 
analyse_uitgebreid: 2-3 sentences — (1) bias reason based on SPECIFIC news, (2) dominant driver + risk.

fail_condition: when bias invalidates, max 8 words.
technical_trend: Bullish/Bearish/Neutraal
trend_driver: 3-5 words dominant force
market_regime: Risk-On/Risk-Off/Stagflatie/Neutraal/Choppy
intraday_structuur: HH/HL or LH/LL or Ranging
correlatie_status: Normaal/Anomalie/Hersteld
pulse: QUIET/WAIT/TRADABLE/WILD
pulse_reden: 1 sentence reason for pulse label (in Dutch)

Extra explanation fields — 2-3 sentences each, in Dutch, explaining WHY:
technical_trend_uitleg: Why is the technical trend bullish/bearish/neutral? What price action or structure confirms this?
structuur_uitleg: Why this intraday structure (HH/HL, LH/LL, Ranging)? What does it mean for the session?
market_regime_uitleg: Why this market regime (Risk-On/Off/Stagflatie etc)? Which signals confirm it?
yield_regime_uitleg: Why this yield regime? How do DXY, yields and gold interact right now?
correlatie_uitleg: Why this correlation status (Normaal/Anomalie)? What is driving the divergence or alignment?
macro_alignment_uitleg: Why this macro alignment score? Which of the 4 pillars are aligned or conflicting? Include exact score e.g. "18/25 — 3 pillars aligned, Central Bank shifted neutral."
macro_hold_uitleg: Full explanation of the macro hold context score in Dutch. Which pillars still confirm? Is there news risk? Are cross-asset signals still aligned? What has shifted?

NO apostrophes. JSON only:
{"bias":"","confidence":0,"macro_hold":0,"market_mood":"","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"","mini_summary":"","analyse_uitgebreid":"","fail_condition":"","technical_trend":"","trend_driver":"","market_regime":"","intraday_structuur":"","macro_alignment":0,"pillar_news":0,"pillar_crossasset":0,"pillar_yield":0,"pulse":"WAIT","pulse_reden":"","confidence_label":"","ai_opinie":"","technical_trend_uitleg":"","structuur_uitleg":"","market_regime_uitleg":"","yield_regime_uitleg":"","correlatie_uitleg":"","macro_alignment_uitleg":"","macro_hold_uitleg":""}`;




const INTEL_SYSTEM = `Je bent een macro markt intelligence analist voor een forex/index trader. Gebruik web search voor actueel nieuws.

REGELS:
- Zoek naar actueel nieuws van vandaag via de web search tool
- Minimaal 6 news_items van echte bronnen (Reuters, Bloomberg, ForexFactory, FinancialJuice)
- Economische kalender: zoek high-impact events voor vandaag + morgen + overmorgen
- Beide kanten: bullish EN bearish altijd vermelden
- NOOIT prijsniveaus verzinnen die niet uit de aangeleverde data komen
- GEEN apostrofs. Alleen JSON, geen markdown.

{"timestamp":"ISO","macro_regime":"","dominant_driver":"","session_context":"","yield_analysis":{"us10y_level":"","us2y_level":"","spread":"","regime":"","implication":""},"cross_asset_signals":[{"signal":"","type":"bullish|bearish","implication":""}],"risk_radar":{"score":0,"label":"","factors":[]},"desk_view":"","news_items":[{"time":"HH:MM","source":"","headline":"","impact":"high|medium|low","direction":"bullish|bearish|neutraal","assets_affected":[]}],"economic_calendar":[{"time":"","event":"","actual":"","expected":"","previous":"","impact":"high|medium|low","verdict":"","effect":"","date":"today|tomorrow|day_after"}]}`;

function INTEL_USER_NOW(assetLabels, livePrices={}) {
  const now = new Date();
  // Altijd Amsterdam/CET tijd tonen
  const dateStr = now.toLocaleDateString("nl-NL",{timeZone:"Europe/Amsterdam",weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const timeStr = now.toLocaleTimeString("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"});
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
  const dayAfter = new Date(now); dayAfter.setDate(now.getDate()+2);
  const fmt = d => d.toLocaleDateString("nl-NL",{timeZone:"Europe/Amsterdam",weekday:"short",day:"numeric",month:"short"});
  // Inject actuele prijzen zodat AI NOOIT verouderde niveaus hallucineert
  const priceCtx = Object.entries(livePrices)
    .filter(([k,v])=>v?.price)
    .map(([k,v])=>`${k}: ${v.price} (${v.change})`)
    .join(", ");
  return `DATUM: ${dateStr}, ${timeStr} Amsterdam tijd.
Assets: ${assetLabels.join(", ")}.
${priceCtx ? `ACTUELE LIVE PRIJZEN (gebruik ALLEEN deze — geen verouderde niveaus verzinnen): ${priceCtx}` : ""}

BELANGRIJK: De prijzen hierboven zijn LIVE en actueel. Noem NOOIT een prijsniveau dat niet overeenkomt met deze data.
Economische kalender zoeken: vandaag=${dateStr}, morgen=${fmt(tomorrow)}, overmorgen=${fmt(dayAfter)}.
Zoek kalender events voor ALLE drie de dagen. Kalender items mogen NIET verdwijnen tussen refreshes — geef altijd de volledige lijst.

Zoek actueel financieel nieuws en economische kalender voor vandaag.
Geef per news_item de directe impact op: ${assetLabels.join(", ")}.
Kalender: today/tomorrow/day_after, alle high impact events.
Minimaal 6 nieuws items van echte bronnen. NOOIT prijsniveaus verzinnen. Alleen JSON.`;
}


// ── MARKTVISIE: AI verwerkt nieuws tot echte marktmening per asset ────────────
const MARKTVISIE_SYSTEM = `Je bent een ervaren forex en index trader die een dagelijkse marktvisie schrijft.
Je hebt zojuist nieuws gelezen. Schrijf nu een concrete marktvisie per asset.

REGELS:
- Baseer ALLES op het aangeleverde nieuws — niet op aannames
- Elke asset krijgt een eigen visie gebaseerd op HOE dat nieuws dat SPECIFIEKE asset raakt
- Wees concreet: noem het specifieke nieuws dat de doorslag geeft
- Geef aan of het nieuws al ingeprijsd kan zijn (buy-the-rumor-sell-the-news)
- Als nieuws tegenstrijdig is: zeg dat en geef een genuan­ceerde visie
- GEEN apostrofs. Alleen JSON.

{"marktvisie_tijd":"ISO","macro_samenvatting":"2-3 zinnen over het overkoepelende macro beeld vandaag","assets":{"XAUUSD":{"visie":"","bias_richting":"Bullish|Bearish|Neutraal|Fragiel","sterkte":0,"key_driver":"","risico":"","ingeprijsd":false}}}`;

function MARKTVISIE_USER(intelResult, assetLabels, crossAsset) {
  const nieuws = (intelResult?.news_items||[])
    .slice(0,8)
    .map(n=>`[${n.time||"?"}] ${n.source}: ${n.headline} → ${n.direction} (impact: ${n.impact})`)
    .join("\n");
  const breaking = (intelResult?.breakingItems||[])
    .slice(0,6)
    .map(n=>`[BREAKING] ${n.source}: ${n.headline}`)
    .join("\n");
  const regime = `Macro regime: ${intelResult?.macro_regime||"onbekend"}. Driver: ${intelResult?.dominant_driver||"?"}. ${intelResult?.desk_view||""}`;
  const yields = intelResult?.yield_analysis
    ? `US10Y: ${intelResult.yield_analysis.us10y_level}, Regime: ${intelResult.yield_analysis.regime}, Implicatie: ${intelResult.yield_analysis.implication}`
    : "";
  const assetJsonParts = assetLabels.map(l => {
    const id = l.replace("/","");
    return `"${id}":{"visie":"","bias_richting":"","sterkte":0,"key_driver":"","risico":"","ingeprijsd":false}`;
  }).join(",");

  return `NIEUWS VAN VANDAAG:
${nieuws}
${breaking}

MACRO CONTEXT:
${regime}
${yields}
LIVE PRIJZEN: ${crossAsset}

Schrijf voor elk van deze assets een concrete marktvisie: ${assetLabels.join(", ")}.
Gebruik ALLEEN het bovenstaande nieuws. Geen aannames.

{"marktvisie_tijd":"${new Date().toISOString()}","macro_samenvatting":"","assets":{${assetJsonParts}}}`;
}

function resolveBias(bias, confidence) {
  if (!bias) return bias;
  const low = bias.toLowerCase();
  if (low.includes("fragiel") && low.includes("bear")) return confidence >= 70 ? "Bearish" : "Fragiel";
  if (low.includes("fragiel") && low.includes("bull")) return confidence >= 70 ? "Bullish" : "Fragiel";
  if (bias === "Fragiel" && confidence >= 70) return "Neutraal";
  return bias;
}

const biasColors = {
  Bullish:  { bg:"rgba(34,197,94,0.1)",   border:"#22c55e", text:"#4ade80" },
  Bearish:  { bg:"rgba(239,68,68,0.1)",   border:"#ef4444", text:"#f87171" },
  Neutraal: { bg:"rgba(107,114,128,0.1)", border:"var(--t3)", text:"var(--t2)" },
  Fragiel:  { bg:"rgba(8,153,129,0.1)",   border:"#089981", text:"#0dd9b6" },
};
const corrColors  = { Normaal:"#22c55e", Anomalie:"#ef4444", Hersteld:"#089981" };
const yieldColors = { "Risk-On":"#22c55e","Risk-Off":"#ef4444","Stagflatie":"#089981","Neutraal":"var(--t2)" };
const impactColor = { high:"#ef4444", medium:"#089981", low:"var(--t3)" };
const dirColor    = { bullish:"#22c55e", bearish:"#ef4444", neutraal:"var(--t2)", up:"#22c55e", down:"#ef4444" };

// Tooltip with ⓘ icon
function InfoTooltip({ text, color="var(--t2)", children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({top:0,left:0});
  const ref = useRef(null);
  const handleEnter = () => {
    if(ref.current) {
      const r = ref.current.getBoundingClientRect();
      const tooltipW = 240;
      let left = r.left + r.width/2;
      // Clamp horizontally so it never goes off screen
      left = Math.max(tooltipW/2 + 8, Math.min(window.innerWidth - tooltipW/2 - 8, left));
      setPos({top: r.top - 12, left});
    }
    setShow(true);
  };
  return (
    <div ref={ref} style={{position:"relative",display:"inline-flex",alignItems:"center",gap:4}}
      onMouseEnter={handleEnter} onMouseLeave={()=>setShow(false)}>
      {children}
      <span style={{fontSize:9,color:color,opacity:0.6,cursor:"help",lineHeight:1}}>ⓘ</span>
      {show&&text&&(
        <div style={{position:"fixed",top:pos.top,left:pos.left,transform:"translate(-50%,-100%)",zIndex:9999,background:"var(--line)",border:`1px solid ${color}44`,borderRadius:7,padding:"9px 13px",minWidth:200,maxWidth:240,fontSize:11,color:"#d1d5db",lineHeight:1.55,boxShadow:"0 6px 24px rgba(0,0,0,0.6)",pointerEvents:"none"}}>
          {text}
          <div style={{position:"absolute",bottom:-5,left:"50%",transform:"translateX(-50%) rotate(45deg)",width:8,height:8,background:"var(--line)",borderRight:`1px solid ${color}44`,borderBottom:`1px solid ${color}44`}}/>
        </div>
      )}
    </div>
  );
}

function Bar({ value, color }) {
  return (
    <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min(100,value||0)}%`,background:color,borderRadius:2,transition:"width 1.2s cubic-bezier(0.4,0,0.2,1)"}}/>
    </div>
  );
}

function Badge({ label, color }) {
  return <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,border:`1px solid ${color}44`,background:`${color}11`,color,letterSpacing:"0.08em",fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>;
}

function Skeleton({ w="100%", h=8, mb=8 }) {
  return <div style={{height:h,width:w,background:"#1a1b1e",borderRadius:4,marginBottom:mb,animation:"pulse 1.5s infinite"}}/>;
}

// ── News Impact Popup ─────────────────────────────────────────────────────────
function NewsImpactPopup({ news, apiKey, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function analyse() {
      const headers = {"Content-Type":"application/json"};
      if(apiKey?.trim()) {

        headers["anthropic-dangerous-direct-browser-access"] = "true";
      }
      try {
        const res = await fetch("/api/anthropic", {
          method:"POST", headers,
          body: JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:300,
            system:`Je bent een FX/index trading analist. Analyseer het effect van nieuws op de gevraagde markten. Geef altijd JSON terug zonder uitleg. Geen apostrofs.`,
            messages:[{role:"user",content:`Nieuws: "${news.headline}" (bron: ${news.source})

Geef impact op XAU/USD, US30, US100, EUR/USD, GBP/USD. JSON:
{"overall":"bullish|bearish|neutraal|gemengd","pairs":{"XAUUSD":{"impact":"bullish|bearish|neutraal","reden":"max 8 woorden"},"US30":{"impact":"bullish|bearish|neutraal","reden":"max 8 woorden"},"US100":{"impact":"bullish|bearish|neutraal","reden":"max 8 woorden"},"EURUSD":{"impact":"bullish|bearish|neutraal","reden":"max 8 woorden"},"GBPUSD":{"impact":"bullish|bearish|neutraal","reden":"max 8 woorden"}}}`}]
          })
        });
        const d = await res.json();
        const text = d.content?.filter(b=>b.type==="text").map(b=>b.text).join("") || "";
        const clean = text.replace(/```json|```/g,"").trim();
        setResult(JSON.parse(clean));
      } catch(e) { setResult({error:true}); }
      setLoading(false);
    }
    analyse();
  }, []);

  const impactColor = i => i==="bullish"?"#22c55e":i==="bearish"?"#ef4444":"var(--t2)";
  const impactIcon  = i => i==="bullish"?"▲":i==="bearish"?"▼":"—";
  const pairs = [
    {id:"XAUUSD",label:"XAU/USD"},{id:"US30",label:"US30"},
    {id:"US100",label:"US100"},{id:"EURUSD",label:"EUR/USD"},{id:"GBPUSD",label:"GBP/USD"}
  ];

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg1)",border:"1px solid #1f2023",borderRadius:10,padding:20,maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.8)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,gap:10}}>
          <div style={{fontSize:10,color:"var(--t2)",lineHeight:1.5,flex:1}}>{news.headline}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--t3)",cursor:"pointer",fontSize:16,flexShrink:0,padding:0}}>✕</button>
        </div>
        <div style={{height:1,background:"var(--line)",marginBottom:14}}/>
        {loading ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {pairs.map(p=><Skeleton key={p.id} h={32}/>)}
          </div>
        ) : result?.error ? (
          <div style={{color:"#ef4444",fontSize:11}}>Analyse mislukt — probeer opnieuw</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {pairs.map(({id,label})=>{
              const r = result?.pairs?.[id];
              if(!r) return null;
              return (
                <div key={id} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.02)",border:"1px solid #1f2023",borderRadius:6,padding:"8px 12px"}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:"var(--t2)",width:58,flexShrink:0}}>{label}</span>
                  <span style={{fontSize:13,color:impactColor(r.impact),fontWeight:700,width:16,flexShrink:0}}>{impactIcon(r.impact)}</span>
                  <span style={{fontSize:11,color:"var(--t2)",flex:1}}>{r.reden}</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{marginTop:12,fontSize:9,color:"var(--t3)",textAlign:"right"}}>klik buiten popup om te sluiten</div>
      </div>
    </div>
  );
}


function btnStyle(disabled, accent=DEFAULT_ACCENT) {
  return {
    background:disabled?`${accent}11`:`linear-gradient(135deg,${accent}30,${accent}20)`,
    border:`1px solid ${disabled?accent+"33":accent}`,
    borderRadius:6, color:disabled?`${accent}55`:accent,
    fontFamily:"var(--mono)", fontSize:11, fontWeight:700,
    letterSpacing:"0.1em", padding:"9px 18px", cursor:disabled?"not-allowed":"pointer",
    display:"flex", alignItems:"center", gap:7,
  };
}

function YieldTooltip({ regime, explanation }) {
  const col = yieldColors[regime] || "var(--t2)";
  return (
    <InfoTooltip text={explanation} color={col}>
      <span style={{fontSize:9,padding:"2px 7px",borderRadius:3,border:`1px solid ${col}44`,background:`${col}11`,color:col,letterSpacing:"0.08em",fontWeight:600}}>{regime}</span>
    </InfoTooltip>
  );
}

function DeepDiveModal({ asset, data, onClose, onRefreshAsset, refreshing, accent }) {
  const bias = resolveBias(data?.bias, data?.confidence);
  const c = biasColors[bias] || biasColors.Neutraal;
  const acc = accent || DEFAULT_ACCENT;
  const trendColor = (t) => {
    if (!t) return "var(--t2)"; const l = t.toLowerCase();
    if (l.includes("strong up")) return "#22c55e";
    if (l.includes("choppy up")) return "#84cc16";
    if (l.includes("strong down")) return "#ef4444";
    if (l.includes("choppy down")) return acc;
    if (l.includes("compres")) return "#a855f7";
    return "var(--t2)";
  };
  const pijlerTooltips = {
    "Macro Alignment":"Hoe goed sluiten macro-factoren (yields, DXY, risk sentiment) aan bij de trade richting. 25% gewicht in hold score.",
    "Structure Integrity":"Houdt de prijs een hogere lows structuur aan? Geen structure break? 30% gewicht — zwaarste pijler.",
    "Flow & Participation":"Is er echte follow-through en volume achter de move? Geen absorptie of reversed reaction? 25% gewicht.",
    "Volatility Regime":"Is de ATR normaal of expansief? Geen extreme compressie of volatility collapse? 20% gewicht.",
  };
  const priceDir = data?.price_direction;
  const priceChange = data?.price_change_today;

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(8px)",overflowY:"auto",display:"flex",flexDirection:"column"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="deep-enter" style={{background:"#09090b",minHeight:"100vh",width:"100%",display:"flex",flexDirection:"column"}}>
        {/* Top accent bar */}
        <div style={{height:3,background:`linear-gradient(90deg,transparent,${c.border},transparent)`,flexShrink:0}}/>

        {/* Header */}
        <div style={{padding:"18px 32px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <span style={{flexShrink:0}}><AssetLogo id={asset.id} size={36}/></span>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3,flexWrap:"wrap"}}>
                <span style={{fontFamily:"var(--mono)",fontSize:24,fontWeight:700,color:"#e5e7eb"}}>{asset.label}</span>
                <div style={{background:c.bg,border:`1px solid ${c.border}55`,borderRadius:5,padding:"5px 14px"}}>
                  <span style={{fontSize:14,fontWeight:700,color:c.text,letterSpacing:"0.06em"}}>{bias?.toUpperCase()}</span>
                </div>
                {priceChange&&(
                  <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.04)",borderRadius:5,padding:"4px 10px"}}>
                    <span style={{fontSize:11,fontWeight:700,color:priceDir==="up"?"#22c55e":"#ef4444",fontFamily:"var(--mono)"}}>{priceDir==="up"?"↑":"↓"} {priceChange} vandaag</span>
                  </div>
                )}
                {data?.price_today&&<span style={{fontFamily:"var(--mono)",fontSize:16,fontWeight:700,color:"#e5e7eb"}}>{data.price_today}</span>}
                {data?.correlatie_status&&<Badge label={data.correlatie_status.toUpperCase()} color={corrColors[data.correlatie_status]||"var(--t2)"}/>}
              </div>
              <div style={{fontSize:12,color:"var(--t3)"}}>{asset.full}</div>
              {data?.analysed_at&&<div style={{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)",marginTop:2}}>📊 Geanalyseerd: {fmtDT(data.analysed_at)}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={onRefreshAsset} disabled={refreshing} style={{...btnStyle(refreshing,acc),padding:"7px 16px",fontSize:10}}>
              <span style={{display:"inline-block",animation:refreshing?"spin 0.8s linear infinite":"none"}}>↺</span>
              {refreshing?"UPDATING...":"UPDATE ASSET"}
            </button>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,color:"var(--t2)",padding:"7px 16px",cursor:"pointer",fontSize:12,fontFamily:"var(--mono)",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
              ← TERUG
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{padding:"24px 32px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:1400,width:"100%",margin:"0 auto",flex:1}}>

          {/* LEFT COLUMN */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {/* Confidence cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:8}}>BIAS CONFIDENCE</div>
                <div style={{fontFamily:"var(--mono)",fontSize:30,fontWeight:700,color:acc,marginBottom:8}}>{data?.confidence}%</div>
                <Bar value={data?.confidence||0} color={acc}/>
                {(()=>{
                  const c = data?.confidence||0;
                  const [label,pos,col] = c>=80?["Zeer sterke bias","Volle positie","#22c55e"]:c>=70?["Sterke bias","75% positie","#84cc16"]:c>=60?["Redelijke bias","50% positie","#f59e0b"]:c>=50?["Lichte bias","25% positie","#f97316"]:["Niet traden","0% positie","#ef4444"];
                  return <div style={{marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,color:col,fontWeight:600}}>{label}</span>
                    <span style={{fontSize:9,color:"var(--t3)"}}>{pos}</span>
                  </div>;
                })()}
                {data?.confidence_label&&<div style={{fontSize:10,color:"var(--t2)",marginTop:6,lineHeight:1.5,borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:6}}>{data.confidence_label}</div>}
              </div>
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:10}}>MACRO HOLD CONTEXT</div>
                <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:8}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:34,fontWeight:700,color:"#6366f1"}}>{data?.macro_hold||0}</span>
                  <span style={{fontSize:12,color:"var(--t3)"}}>/100</span>
                </div>
                <Bar value={data?.macro_hold||0} color="#6366f1"/>
                {(()=>{
                  const h = data?.macro_hold||0;
                  const [emoji,label,range,col] =
                    h>=80?["🟢","Voluit holden","80-100 — macro volledig aligned","#22c55e"]:
                    h>=70?["🟢","Goede hold","70-79 — macro ondersteunt de trade","#84cc16"]:
                    h>=60?["🟡","Zeer twijfelachtig","60-69 — macro gemengd, risicovol","#f59e0b"]:
                    h>=40?["⚠️","Niet holden","40-59 — macro te onduidelijk",acc]:
                           ["🔴","Definitief niet holden","0-39 — macro heeft gedraaid","#ef4444"];
                  return(
                    <div style={{marginTop:10}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:13}}>{emoji}</span>
                          <span style={{fontSize:12,fontWeight:700,color:col}}>{label}</span>
                        </div>
                        <span style={{fontSize:9,color:"var(--t3)"}}>{range}</span>
                      </div>
                      {data?.macro_hold_uitleg&&<div style={{fontSize:11,color:"var(--t2)",lineHeight:1.7,borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:8,marginTop:4}}>{data.macro_hold_uitleg}</div>}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* PULSE */}
            {data?.pulse&&(()=>{
              const pulseColors={QUIET:"var(--t3)",WAIT:"#f59e0b",TRADABLE:"#22c55e",WILD:"#ef4444"};
              const pulseEmoji={QUIET:"🔇",WAIT:"⏳",TRADABLE:"✅",WILD:"⚡"};
              const labels=["QUIET","WAIT","TRADABLE","WILD"];
              const pc=pulseColors[data.pulse]||"var(--t2)";
              const idx=labels.indexOf(data.pulse);
              return(
                <div style={{background:`${pc}09`,border:`1px solid ${pc}30`,borderRadius:8,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:14}}>{pulseEmoji[data.pulse]}</span>
                      <span style={{fontSize:9,color:pc,letterSpacing:"0.12em",fontWeight:700}}>PULSE INDICATOR</span>
                    </div>
                    <span style={{fontSize:16,fontWeight:700,color:pc,letterSpacing:"0.06em"}}>{data.pulse}</span>
                  </div>
                  <div style={{display:"flex",gap:4,marginBottom:10}}>
                    {labels.map((l,i)=>(
                      <div key={l} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{width:"100%",height:4,borderRadius:2,background:i===idx?pulseColors[l]:"rgba(255,255,255,0.06)"}}/>
                        <span style={{fontSize:8,color:i===idx?pulseColors[l]:"var(--t3)",letterSpacing:"0.06em"}}>{l}</span>
                      </div>
                    ))}
                  </div>
                  {data.pulse_reden&&<div style={{fontSize:11,color:"var(--t2)",lineHeight:1.6}}>{data.pulse_reden}</div>}
                </div>
              );
            })()}

            {/* Macro Hold Pijlers */}
            {(data?.macro_alignment!=null)&&(
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:12}}>MACRO HOLD — SCORE OPBOUW</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {l:"Pillar Alignment", v:data?.macro_alignment, max:40},
                    {l:"News Timing",      v:data?.pillar_news,     max:25},
                    {l:"Cross-Asset",      v:data?.pillar_crossasset,max:20},
                    {l:"Yield/DXY Regime",v:data?.pillar_yield,     max:15},
                  ].map(({l,v,max})=>v!=null&&(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:10,color:"var(--t3)",width:120,flexShrink:0}}>{l}</span>
                      <div style={{flex:1,height:4,borderRadius:2,background:"rgba(255,255,255,0.04)",overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${(v/max)*100}%`,background:v===max?"#22c55e":v>=max*0.6?"#6366f1":"#f59e0b",borderRadius:2,transition:"width 0.4s"}}/>
                      </div>
                      <span style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--t2)",width:40,textAlign:"right"}}>{v}/{max}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Technical + Structure + Regime + Trend Driver */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:6}}>TECHNISCHE TREND</div>
                <div style={{fontSize:13,fontWeight:700,color:trendColor(data?.technical_trend),marginBottom:4}}>{data?.technical_trend||"—"}</div>
                {data?.trend_driver&&<div style={{fontSize:10,color:"var(--t2)",marginBottom:6}}>{data.trend_driver}</div>}
                {data?.technical_trend_uitleg&&<div style={{fontSize:11,color:"var(--t2)",lineHeight:1.65,borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:8}}>{data.technical_trend_uitleg}</div>}
              </div>
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:6}}>INTRADAY STRUCTUUR</div>
                <div style={{fontSize:13,fontWeight:700,color:"var(--t2)",marginBottom:4}}>{data?.intraday_structuur||"—"}</div>
                {data?.structuur_uitleg&&<div style={{fontSize:11,color:"var(--t2)",lineHeight:1.65,borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:8}}>{data.structuur_uitleg}</div>}
              </div>
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:6}}>MARKET REGIME</div>
                <div style={{fontSize:13,fontWeight:700,color:"#6366f1",marginBottom:4}}>{data?.market_regime?.toUpperCase()||"—"}</div>
                {data?.market_regime_uitleg&&<div style={{fontSize:11,color:"var(--t2)",lineHeight:1.65,borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:8}}>{data.market_regime_uitleg}</div>}
              </div>
            </div>

            {/* Yield regime */}
            {data?.yield_regime&&data.yield_regime!=="n.v.t."&&(
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:8}}>YIELD REGIME</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:yieldColors[data.yield_regime]||"var(--t2)",boxShadow:`0 0 8px ${yieldColors[data.yield_regime]||"var(--t2)"}`}}/>
                  <span style={{fontSize:15,fontWeight:700,color:yieldColors[data.yield_regime]||"var(--t2)"}}>{data.yield_regime}</span>
                </div>
                {(data.yield_regime_uitleg||data.yield_regime_explanation)&&<div style={{fontSize:11,color:"var(--t2)",lineHeight:1.65,borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:8}}>{data.yield_regime_uitleg||data.yield_regime_explanation}</div>}
              </div>
            )}
            {/* Correlatie uitleg */}
            {data?.correlatie_status&&(
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:8}}>CORRELATIE STATUS</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:corrColors[data.correlatie_status]||"var(--t2)"}}/>
                  <span style={{fontSize:13,fontWeight:700,color:corrColors[data.correlatie_status]||"var(--t2)"}}>{data.correlatie_status}</span>
                </div>
                {data?.correlatie_uitleg&&<div style={{fontSize:11,color:"var(--t2)",lineHeight:1.65,borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:8}}>{data.correlatie_uitleg}</div>}
              </div>
            )}

            {/* Hold advies + Fail */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>

              <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.12)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#ef4444",letterSpacing:"0.1em",marginBottom:6}}>FAIL CONDITION</div>
                <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.6}}>{data?.fail_condition||"—"}</div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {/* Deep summary */}
            <div style={{background:`linear-gradient(135deg,${acc}08,rgba(99,102,241,0.04))`,border:`1px solid ${acc}20`,borderRadius:8,padding:"16px 18px"}}>
              <div style={{fontSize:9,color:acc,letterSpacing:"0.1em",marginBottom:8}}>UITGEBREIDE ANALYSE</div>
              <div style={{fontSize:12,color:"#d1d5db",lineHeight:1.8}}>{data?.analyse_uitgebreid||data?.deep_summary||data?.mini_summary||"—"}</div>
            </div>

            {/* AI Opinie */}
            {data?.ai_opinie&&(
              <div style={{background:"rgba(99,102,241,0.04)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#6366f1",letterSpacing:"0.1em",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  <span>🧠</span> AI OPINIE
                </div>
                <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.75,fontStyle:"italic"}}>{data.ai_opinie}</div>
              </div>
            )}

            {/* Bias switch history */}
            {data?.bias_switch_history?.length>0&&(
              <div style={{background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#ef4444",letterSpacing:"0.1em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                  <span>⚡</span> BIAS SWITCH GESCHIEDENIS
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {data.bias_switch_history.map((s,i)=>{
                    const vanC = biasColors[s.van]||biasColors.Neutraal;
                    const naarC = biasColors[s.naar]||biasColors.Neutraal;
                    return (
                      <div key={i} style={{borderLeft:"2px solid rgba(239,68,68,0.3)",paddingLeft:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
                          <span style={{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)"}}>{fmtDT(s.time)}</span>
                          <span style={{fontSize:10,fontWeight:700,color:vanC.text,background:vanC.bg,border:`1px solid ${vanC.border}44`,borderRadius:4,padding:"1px 7px"}}>{s.van}</span>
                          <span style={{fontSize:10,color:"var(--t3)"}}>→</span>
                          <span style={{fontSize:10,fontWeight:700,color:naarC.text,background:naarC.bg,border:`1px solid ${naarC.border}44`,borderRadius:4,padding:"1px 7px"}}>{s.naar}</span>
                          <span style={{fontSize:9,color:"var(--t3)"}}>{s.confidence}%</span>
                        </div>
                        {s.nieuws?.length>0&&(
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.08em",marginBottom:2}}>NIEUWS OP DAT MOMENT:</div>
                            {s.nieuws.map((n,j)=>(
                              <div key={j} style={{display:"flex",gap:5,alignItems:"flex-start"}}>
                                <span style={{fontSize:9,color:"var(--t3)",flexShrink:0,marginTop:1}}>[{n.source}]</span>
                                {n.url
                                  ? <a href={n.url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"var(--t2)",lineHeight:1.4,textDecoration:"none"}} onMouseEnter={e=>e.target.style.color="var(--t2)"} onMouseLeave={e=>e.target.style.color="var(--t2)"}>{n.headline}</a>
                                  : <span style={{fontSize:10,color:"var(--t2)",lineHeight:1.4}}>{n.headline}</span>
                                }
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mechanisme + Driver */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:6}}>DOMINANT MECHANISME</div>
                <div style={{fontSize:11,color:"var(--t2)",lineHeight:1.55}}>{data?.dominant_mechanisme||"—"}</div>
              </div>
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:6}}>TREND DRIVER</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t2)"}}>{data?.trend_driver?.toUpperCase()||"—"}</div>
              </div>
            </div>

            {/* Key confluences */}
            {data?.key_confluences?.length>0&&(
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:10}}>KEY CONFLUENCES</div>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {data.key_confluences.map((cf,i)=>(
                    <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:acc,marginTop:5,flexShrink:0}}/>
                      <span style={{fontSize:11,color:"var(--t2)",lineHeight:1.5}}>{cf}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* News items — clickable */}
            {data?.news_items?.length>0&&(
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:10}}>RELEVANTE NIEUWS</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {data.news_items.map((n,i)=>(
                    <div key={i} style={{borderLeft:`2px solid ${dirColor[n.direction]||"var(--t3)"}`,paddingLeft:10,cursor:n.url?"pointer":"default"}}
                      onClick={()=>n.url&&window.open(n.url,"_blank")}>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                        {n.time&&<span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)"}}>{n.time}</span>}
                        {n.date&&<span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)"}}>{n.date}</span>}
                        {n.source&&<Badge label={n.source} color="var(--t2)"/>}
                        <span style={{fontSize:11,color:dirColor[n.direction]||"var(--t2)",fontWeight:700}}>{n.direction==="bullish"?"▲":n.direction==="bearish"?"▼":"—"}</span>
                        {n.url&&<span style={{fontSize:9,color:"var(--t3)",marginLeft:"auto"}}>↗ openen</span>}
                      </div>
                      <div style={{fontSize:11,color:n.url?"#d1d5db":"var(--t2)",lineHeight:1.5,textDecoration:n.url?"underline":"none",textDecorationColor:"rgba(255,255,255,0.1)"}}>{n.headline}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBar({ value, color, animated=true }) {
  return (
    <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}>
      <div className={animated?"confidence-bar":""} style={{height:"100%",width:`${Math.min(100,value||0)}%`,background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:2,transition:"width 1.2s cubic-bezier(0.4,0,0.2,1)"}}/>
    </div>
  );
}

function PulseBadge({ pulse }) {
  const cfg = {
    QUIET:    {color:"#4b5563",bg:"rgba(75,85,99,0.15)",   dot:"#4b5563",  label:"QUIET"},
    WAIT:     {color:"#f59e0b",bg:"rgba(245,158,11,0.12)", dot:"#f59e0b",  label:"WAIT"},
    TRADABLE: {color:"#22c55e",bg:"rgba(34,197,94,0.12)",  dot:"#22c55e",  label:"TRADABLE"},
    WILD:     {color:"#ef4444",bg:"rgba(239,68,68,0.12)",  dot:"#ef4444",  label:"WILD"},
  };
  const cf = cfg[pulse] || cfg.WAIT;
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,background:cf.bg,border:`1px solid ${cf.color}30`,borderRadius:4,padding:"2px 8px"}}>
      <div style={{width:5,height:5,borderRadius:"50%",background:cf.dot,animation:"pulseDot 2s ease-in-out infinite"}}/>
      <span style={{fontSize:9,fontWeight:700,color:cf.color,letterSpacing:"0.1em"}}>{cf.label}</span>
    </div>
  );
}

function AssetCard({ asset, data, index, loading, updating: updatingProp, onClick, onUpdate, accent, livePrice }) {
  const [vis, setVis] = useState(false);
  const [updLocal, setUpdLocal] = useState(false);
  const updating = updatingProp || updLocal;
  const acc = accent || DEFAULT_ACCENT;

  useEffect(()=>{const t=setTimeout(()=>setVis(true),index*80);return()=>clearTimeout(t);},[data,loading]);

  const bias   = resolveBias(data?.bias, data?.confidence);
  const bc     = biasColors[bias] || biasColors.Neutraal;
  const assetColor = ASSET_META[asset.id]?.color || acc;
  const rawP   = livePrice?.price  || null;
  const rawChg = livePrice?.change || null;
  const price  = rawP && parseFloat(rawP) > 0 ? rawP : null;
  const chg    = rawChg && rawChg !== "+0.00%" && rawChg !== "-0.00%" ? rawChg : null;
  const up     = livePrice?.direction === "up";
  const conf   = data?.confidence || 0;
  const hold   = data?.macro_hold || 0;

  const handleRefresh = async (e) => {
    e.stopPropagation();
    if(updating || !onUpdate) return;
    setUpdLocal(true);
    try{ await onUpdate(asset); }catch(_){}
    setUpdLocal(false);
  };

  return (
    <div
      onClick={data ? onClick : undefined}
      className="card-hover card-in"
      style={{
        background:`linear-gradient(160deg,#0f1014,#0c0d11)`,
        border:`1px solid ${data?.bias ? bc.border+"44" : "rgba(255,255,255,0.06)"}`,
        borderRadius:10,
        opacity: vis ? 1 : 0,
        transform: vis ? "none" : "translateY(12px)",
        transition:"opacity 0.5s ease, transform 0.5s ease, border-color 0.3s ease",
        cursor: data ? "pointer" : "default",
        position:"relative",
        overflow:"hidden",
      }}
    >
      {/* Asset color glow */}
      <div style={{position:"absolute",top:-40,right:-40,width:120,height:120,borderRadius:"50%",background:assetColor,opacity:0.04,filter:"blur(30px)",pointerEvents:"none"}}/>
      {/* Loading bar */}
      {updating && <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${acc},transparent)`,animation:"pulse 1s infinite"}}/>}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"14px 16px 10px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <AssetLogo id={asset.id} size={38}/>
          <div>
            <div style={{fontFamily:"var(--mono)",fontSize:13,fontWeight:700,color:"var(--t1)",letterSpacing:"0.04em"}}>{asset.label}</div>
            <div style={{fontSize:10,color:"var(--t3)",marginTop:1}}>{asset.full}</div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
          {price && (
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontFamily:"var(--mono)",fontSize:13,fontWeight:600,color:"var(--t1)"}}>{price}</span>
              {chg && <span style={{fontFamily:"var(--mono)",fontSize:10,fontWeight:600,color:up?"var(--grn)":"var(--red)",background:up?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",borderRadius:4,padding:"2px 6px"}}>{up?"▲":"▼"} {chg}</span>}
            </div>
          )}
          <button onClick={handleRefresh} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,padding:"3px 8px",color:updating?acc:"var(--t3)",fontSize:11,display:"flex",alignItems:"center",gap:4}}>
            <span style={{display:"inline-block",animation:updating?"spin 0.8s linear infinite":"none"}}>⟳</span>
          </button>
        </div>
      </div>

      {data ? (
        <>
          {/* Confidence + Hold bars */}
          <div style={{padding:"6px 16px 10px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",letterSpacing:"0.1em"}}>CONFIDENCE</span>
                <span style={{fontFamily:"var(--mono)",fontSize:10,fontWeight:700,color:acc}}>{conf}%</span>
              </div>
              <ConfidenceBar value={conf} color={acc}/>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",letterSpacing:"0.1em"}}>HOLD</span>
                <span style={{fontFamily:"var(--mono)",fontSize:10,fontWeight:700,color:"#6366F1"}}>{hold}</span>
              </div>
              <ConfidenceBar value={hold} color="#6366F1"/>
            </div>
          </div>

          {/* Tags */}
          <div style={{padding:"0 16px 10px",display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
            {data.pulse && <PulseBadge pulse={data.pulse}/>}
            {data.bias && <Badge label={bias?.toUpperCase()} color={bc.border}/>}
            {data.correlatie_status && <Badge label={data.correlatie_status} color={corrColors[data.correlatie_status]||"var(--t3)"}/>}
            {data.market_regime && <Badge label={data.market_regime.slice(0,18)} color="#6366F1"/>}
          </div>

          {/* Mini summary */}
          <div style={{margin:"0 16px 10px",padding:"10px 12px",background:"rgba(255,255,255,0.02)",borderRadius:6,border:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:5}}>AI ANALYSE</div>
            <div style={{fontSize:11,color:"var(--t2)",lineHeight:1.6}}>{data.mini_summary || "—"}</div>
          </div>

          {/* Footer */}
          <div style={{padding:"8px 16px",borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(0,0,0,0.2)"}}>
            <span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)"}}>{data.analysed_at ? fmtTime(data.analysed_at) : "—"}</span>
            <span style={{fontFamily:"var(--mono)",fontSize:8,fontWeight:700,color:acc,letterSpacing:"0.1em"}}>DEEP DIVE →</span>
          </div>
        </>
      ) : loading ? (
        <div style={{padding:"0 16px 16px"}}>{[90,70,50,100,80].map((w,i)=><Skeleton key={i} w={`${w}%`}/>)}</div>
      ) : (
        <div style={{padding:"20px 16px",textAlign:"center",fontFamily:"var(--mono)",fontSize:9,color:"var(--t3)",letterSpacing:"0.1em"}}>GEEN ANALYSE</div>
      )}
    </div>
  );
}

function MarketIntelPage({ data, loading, onRefresh, status, dots, onNewsClick, accent }) {
  const acc = accent || "#089981";
  if (!data && !loading) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:420,gap:14}}>
      <div style={{fontSize:40,opacity:0.4}}>📡</div>
      <div style={{color:"var(--t3)",fontSize:12,letterSpacing:"0.05em"}}>Klik INTEL LADEN om live marktdata op te halen</div>
      <button onClick={onRefresh} style={btnStyle(false)}><span>▶</span> INTEL LADEN</button>
    </div>
  );
  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:16,paddingTop:20}}>
      {[1,2,3].map(i=><div key={i} style={{background:"var(--bg1)",borderRadius:8,padding:18}}>{[100,80,60,90,70].map((w,j)=><Skeleton key={j} w={`${w}%`} h={j===0?12:8}/>)}</div>)}
    </div>
  );

  const snap = data.market_snapshot || {};
  const snapLabels = {gold:"GOLD",us30:"US30",us100:"US100",eurusd:"EUR/USD",gbpusd:"GBP/USD"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Session + refresh row */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:12,color:"var(--t2)",marginBottom:3}}>{data.session_context}</div>
          {data.timestamp&&<div style={{fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)"}}>📡 {fmtDT(data.timestamp)}</div>}
        </div>
        <button onClick={onRefresh} disabled={status==="loading-intel"} style={btnStyle(status==="loading-intel")}>
          <span>↺</span>{status==="loading-intel"?`LADEN${".".repeat(dots)}`:"VERNIEUWEN"}
        </button>
      </div>

      {/* Regime banner */}
      <div style={{background:"var(--bg1)",border:`1px solid ${(yieldColors[data.macro_regime]||"var(--t3)")}33`,padding:"12px 18px",display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:yieldColors[data.macro_regime]||"var(--t2)",boxShadow:`0 0 8px ${yieldColors[data.macro_regime]||"var(--t2)"}`}}/>
          <span style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em"}}>MACRO REGIME</span>
          <span style={{fontSize:12,fontWeight:700,color:yieldColors[data.macro_regime]||"var(--t2)"}}>{data.macro_regime}</span>
        </div>
        <div style={{fontSize:11,color:"var(--t2)",flex:1}}>{data.dominant_driver}</div>
      </div>

      {/* Yield analysis */}
      {data.yield_analysis&&(
        <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:0,padding:"14px 18px"}}>
          <div style={{fontSize:10,color:"var(--t3)",letterSpacing:"0.12em",marginBottom:10}}>YIELD ANALYSE</div>
          <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:8}}>
            {[{l:"US10Y",v:data.yield_analysis.us10y_level},{l:"US2Y",v:data.yield_analysis.us2y_level},{l:"SPREAD",v:data.yield_analysis.spread},{l:"REGIME",v:data.yield_analysis.regime}].map(({l,v})=>(
              <div key={l} style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em"}}>{l}</span>
                <span style={{fontFamily:"var(--mono)",fontSize:12,fontWeight:700,color:acc}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,color:"var(--t2)"}}>{data.yield_analysis.implication}</div>
        </div>
      )}

      {/* News + Calendar in 2 cols */}
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.1fr) minmax(0,0.9fr)",gap:14}}>

        {/* News */}
        <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:0,padding:"14px 18px"}}>
          <div style={{fontSize:10,color:"var(--t3)",letterSpacing:"0.12em",marginBottom:12}}>NIEUWS FEED</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[...(data.news_items||[])].sort((a,b)=>{
              const t = s => { const m=String(s||"").match(/(\d{1,2}):(\d{2})/); return m?parseInt(m[1])*60+parseInt(m[2]):0; };
              return t(b.time)-t(a.time);
            }).map((n,i)=>(
              <div key={i} onClick={()=>onNewsClick&&onNewsClick({headline:n.headline,source:n.source,url:n.url})}
                style={{borderLeft:`2px solid ${impactColor[n.impact]||"var(--t3)"}`,paddingLeft:10,cursor:"pointer",borderRadius:"0 4px 4px 0",transition:"background 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,0.06)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)"}}>{n.time||"—"}</span>
                  <span style={{fontSize:9,color:"#2d3748",fontFamily:"var(--mono)"}}>{new Date().toLocaleDateString("nl-NL",{timeZone:"Europe/Amsterdam",day:"2-digit",month:"2-digit"})}</span>
                  <Badge label={n.source} color="var(--t2)"/>
                  <Badge label={n.category} color="#6366f1"/>
                  {n.impact==="high"&&<Badge label="HIGH" color="#ef4444"/>}
                  <span style={{fontSize:11,color:dirColor[n.direction]||"var(--t2)",fontWeight:700}}>{n.direction==="bullish"?"▲":n.direction==="bearish"?"▼":"—"}</span>
                  <span style={{fontSize:9,color:"var(--t3)",marginLeft:"auto"}}>⚡ impact</span>
                </div>
                <div style={{fontSize:11,color:"#d1d5db",lineHeight:1.5,marginBottom:4}}>{n.headline}</div>
                {n.assets_affected&&n.assets_affected.length>0&&(
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{n.assets_affected.map(a=><Badge key={a} label={a} color="var(--t3)"/>)}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right column: signals + risk radar only */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Cross-asset signals */}
          {data.cross_asset_signals&&data.cross_asset_signals.length>0&&(
            <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:0,padding:"14px 18px"}}>
              <div style={{fontSize:10,color:"var(--t3)",letterSpacing:"0.12em",marginBottom:10}}>CROSS-ASSET SIGNALEN</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.cross_asset_signals.map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <Badge label={s.signal} color={s.type==="anomalie"?"#ef4444":"#6366f1"}/>
                    <span style={{fontSize:11,color:"var(--t2)",flex:1,lineHeight:1.4}}>{s.implication}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk radar only */}
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
            {data.risk_radar&&(
              <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 14px"}}>
                <InfoTooltip text="Samengestelde risicoscore van 0-100 op basis van macro-omgeving, volatiliteit en cross-asset signalen. Groen (0-40) = laag risico, Oranje (40-70) = verhoogd, Rood (70-100) = hoog risico." color="var(--t2)">
                  <div style={{fontSize:10,color:"var(--t3)",letterSpacing:"0.12em",marginBottom:8}}>RISK RADAR</div>
                </InfoTooltip>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                  <div style={{position:"relative",width:48,height:48,flexShrink:0}}>
                    <svg width="48" height="48" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="18" fill="none" stroke="var(--line)" strokeWidth="3.5"/>
                      <circle cx="24" cy="24" r="18" fill="none" stroke={data.risk_radar.score>70?"#ef4444":data.risk_radar.score>40?"#f97316":"#22c55e"} strokeWidth="3.5" strokeDasharray={`${(data.risk_radar.score/100)*113} 113`} strokeLinecap="round" transform="rotate(-90 24 24)"/>
                    </svg>
                    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:"#e5e7eb"}}>{data.risk_radar.score}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:data.risk_radar.score>70?"#ef4444":data.risk_radar.score>40?"#f97316":"#22c55e",marginBottom:4}}>{data.risk_radar.label}</div>
                    {(data.risk_radar.factors_text||"").split(",").concat(data.risk_radar.factors||[]).filter(Boolean).map((f,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                        <div style={{width:3,height:3,borderRadius:"50%",background:"var(--t3)"}}/>
                        <span style={{fontSize:9,color:"var(--t2)"}}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desk view */}
      {data.desk_view&&(
        <div style={{background:"linear-gradient(135deg,rgba(249,115,22,0.05),rgba(99,102,241,0.04))",border:"1px solid rgba(249,115,22,0.15)",borderRadius:8,padding:"16px 20px"}}>
          <div style={{fontSize:10,color:acc,letterSpacing:"0.12em",marginBottom:8}}>DESK PERSPECTIEF</div>
          <div style={{fontSize:12,color:"#d1d5db",lineHeight:1.7}}>{data.desk_view}</div>
        </div>
      )}
    </div>
  );
}


// ── HOME PAGE ─────────────────────────────────────────────────────────────────
function HomePage({ assets, livePrices, aResult, presession, lastRefresh, hybridStatus, onRunHybrid, onNavigate, accent, breakingNews, rssItems }) {
  const acc = accent || DEFAULT_ACCENT;
  const isRunning = hybridStatus!=="idle"&&hybridStatus!=="done";
  const now = new Date();
  const timeStr = now.toLocaleTimeString("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"});
  const dateStr = now.toLocaleDateString("nl-NL",{timeZone:"Europe/Amsterdam",weekday:"long",day:"numeric",month:"long"});

  const allBiases = aResult ? assets.map(a=>aResult.assets?.[a.id]?.bias).filter(Boolean) : [];
  const bullCount = allBiases.filter(b=>b?.toLowerCase().includes("bull")).length;
  const bearCount = allBiases.filter(b=>b?.toLowerCase().includes("bear")).length;
  const overallSent = bullCount > bearCount ? "BULLISH" : bearCount > bullCount ? "BEARISH" : "GEMENGD";
  const sentCol = overallSent==="BULLISH"?"var(--grn)":overallSent==="BEARISH"?"var(--red)":"#f59e0b";
  const avgConf = aResult ? Math.round(assets.reduce((s,a)=>s+(aResult.assets?.[a.id]?.confidence||0),0)/assets.length) : 0;

  const newsToShow = (rssItems.length > 0 ? rssItems : breakingNews).slice(0,6);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Hero card */}
      <div style={{background:"linear-gradient(160deg,#0f1014 60%,rgba(8,153,129,0.08))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"24px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:20}}>
        <div>
          <div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--t3)",letterSpacing:"0.16em",marginBottom:10}}>
            {dateStr.toUpperCase()} · {timeStr} AMS
          </div>
          <h1 style={{fontSize:28,fontWeight:800,letterSpacing:"-0.02em",lineHeight:1.1,color:"var(--t1)",marginBottom:8}}>
            HybridTrading<br/><span style={{color:acc}}>Dashboard</span>
          </h1>
          {presession ? (
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:presession.mood?.toLowerCase().includes("bull")?"var(--grn)":presession.mood?.toLowerCase().includes("bear")?"var(--red)":"#f59e0b",animation:"pulseDot 2s infinite"}}/>
              <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t2)"}}>{presession.session} · <span style={{color:presession.mood?.toLowerCase().includes("bull")?"var(--grn)":presession.mood?.toLowerCase().includes("bear")?"var(--red)":"#f59e0b"}}>{presession.mood}</span></span>
            </div>
          ) : (
            <div style={{fontSize:11,color:"var(--t3)",lineHeight:1.5}}>Institutioneel macro-analyse systeem. Bias geeft richting — CVD &amp; aggressor geven entry.</div>
          )}
        </div>
        <button onClick={onRunHybrid} disabled={isRunning}
          style={{background:isRunning?`${acc}22`:`linear-gradient(135deg,${acc},${acc}cc)`,border:"none",borderRadius:10,padding:"12px 24px",color:isRunning?acc:"#000",fontWeight:700,fontSize:12,letterSpacing:"0.08em",fontFamily:"var(--mono)",display:"flex",alignItems:"center",gap:8,opacity:isRunning?0.8:1,cursor:isRunning?"not-allowed":"pointer"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{animation:isRunning?"spin 1s linear infinite":"none"}}>{isRunning?<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>:<path d="M8 5l11 7-11 7V5z" fill="currentColor"/>}</svg>
          {isRunning?"BEZIG...":"HYBRID ANALYSE STARTEN"}
        </button>
      </div>

      {/* Stats row — only when data exists */}
      {aResult&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {[
            {l:"SENTIMENT",  v:overallSent, col:sentCol},
            {l:"AVG CONF",   v:avgConf+"%", col:acc},
            {l:"BULL",       v:bullCount,   col:"var(--grn)"},
            {l:"BEAR",       v:bearCount,   col:"var(--red)"},
          ].map(({l,v,col})=>(
            <div key={l} style={{background:"linear-gradient(160deg,#0f1014,#0c0d11)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"14px 16px",textAlign:"center"}}>
              <div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",letterSpacing:"0.12em",marginBottom:6}}>{l}</div>
              <div style={{fontFamily:"var(--mono)",fontSize:22,fontWeight:800,color:col}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* News feed */}
      {newsToShow.length>0&&(
        <div style={{background:"linear-gradient(160deg,#0f1014,#0c0d11)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"14px 18px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#f59e0b",animation:"pulseDot 2s ease-in-out infinite"}}/>
              <span style={{fontFamily:"var(--mono)",fontSize:8,fontWeight:700,color:"var(--t2)",letterSpacing:"0.14em"}}>NEWS FEED</span>
            </div>
            <button onClick={()=>onNavigate("intel")} style={{background:"none",border:"none",color:"var(--t3)",fontSize:9,cursor:"pointer",fontFamily:"var(--mono)",letterSpacing:"0.08em"}}>MEER ›</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {newsToShow.map((n,i)=>{
              const headline = n.headline;
              const source   = n.source;
              const url      = n.link||n.url||"";
              const time     = n.time ? fmtDT(n.time instanceof Date ? n.time : new Date(n.time)) : n.timeStr||"";
              const isBull   = n.direction==="bullish";
              const isBear   = n.direction==="bearish";
              return (
                <div key={i} onClick={()=>url&&window.open(url,"_blank")}
                  className="row-hover"
                  style={{display:"flex",alignItems:"stretch",gap:8,padding:"7px 8px",borderRadius:5,cursor:url?"pointer":"default"}}>
                  <div style={{width:2,flexShrink:0,borderRadius:1,background:isBull?"var(--grn)":isBear?"var(--red)":"rgba(255,255,255,0.1)"}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
                      <span style={{fontFamily:"var(--mono)",fontSize:8,fontWeight:600,color:"#f59e0b"}}>{source}</span>
                      <span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)"}}>{time}</span>
                    </div>
                    <div style={{fontSize:11,color:"var(--t1)",lineHeight:1.45,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{headline}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


export default function HybridDashboard() {
  const [page,          setPage]          = useState("home");
  const [pageKey,       setPageKey]       = useState(0);
  const switchPage = (newPage) => { if(newPage===page) return; setPageKey(k=>k+1); setPage(newPage); };
  const [aStatus,       setAStatus]       = useState("idle");
  const [iStatus,       setIStatus]       = useState("idle");
  const [aResult,       setAResult]       = useState(null);
  const [iResult,       setIResult]       = useState(null);
  const [marktvisie,    setMarktvisie]    = useState(null); // AI marktmening op basis van nieuws
  const [aError,        setAError]        = useState("");
  const [iError,        setIError]        = useState("");
  const [dots,          setDots]          = useState(0);
  const [deepAsset,     setDeepAsset]     = useState(null);
  const [deepRefreshing,setDeepRefreshing]= useState(false);
  const [refreshingAssets, setRefreshingAssets] = useState(new Set());
  const [calFilter,     setCalFilter]     = useState("all");
  const [calDayFilter,  setCalDayFilter]  = useState("all");
  const [accent,        setAccent]        = useState(DEFAULT_ACCENT);
  const apiKey = ""; // API key now managed server-side
  const [priceSource,   setPriceSource]   = useState("finnhub");
  const [livePrices,    setLivePrices]    = useState({});

  const [showAccent,    setShowAccent]    = useState(false);
  const [assets,        setAssets]        = useState(BASE_ASSETS);
  const [showAddPair,   setShowAddPair]   = useState(false);
  const [newPairLabel,  setNewPairLabel]  = useState("");
  const [newPairFull,   setNewPairFull]   = useState("");
  const [presession,    setPresession]    = useState(null);
  const [psStatus,      setPsStatus]      = useState("idle");
  // Breaking news
  const [breakingNews,  setBreakingNews]  = useState([]);
  const [bnLoading,     setBnLoading]     = useState(false);
  const [seenHeadlines, setSeenHeadlines] = useState(new Set());
  const [newsImpact,    setNewsImpact]    = useState(null); // popup
  // Auto-refresh
  const [autoRefresh,   setAutoRefresh]   = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // minutes
  const autoRefreshRef = useRef(null);
  const [nextRefreshIn, setNextRefreshIn] = useState(null);
  const countdownRef = useRef(null);
  // RSS feed
  const [rssItems,  setRssItems]  = useState([]);
  const [rssLoading,setRssLoading]= useState(false);
  const RSS_FEEDS = [
    { url:"https://feeds.bbci.co.uk/news/business/rss.xml", name:"BBC Business" },
    { url:"https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", name:"NYT Business" },
    { url:"https://www.marketwatch.com/rss/topstories", name:"MarketWatch" },
    { url:"https://seekingalpha.com/feed.xml", name:"SeekingAlpha" },
  ];

  useEffect(()=>{
    if(aStatus==="loading"||iStatus==="loading"||psStatus==="loading"){
      const t=setInterval(()=>setDots(d=>(d+1)%4),400);
      return()=>clearInterval(t);
    }
  },[aStatus,iStatus,psStatus]);

  // Live prijzen — alleen Finnhub of 12data (geen CORS problemen)
  useEffect(()=>{
    const allIds = [...new Set([...assets.map(a=>a.id), "DXY","VIX","US10Y"])];

    async function fetchAll() {
      if(true) {
        // Batch call voor alle assets tegelijk
        try {
          const batch = await fetchTwelveBatch(allIds);
          if(Object.keys(batch).length > 0) {
            setLivePrices(prev=>({...prev,...batch}));
            return;
          }
        } catch(_) {}
      }
      if(true) {
        // Individuele calls voor Finnhub (geen batch API)
        allIds.forEach(id => {
          fetchFinnhubPrice(id)
            .then(p=>{ if(p) setLivePrices(prev=>({...prev,[id]:p})); })
            .catch(()=>{});
        });
        return;
      }
      // Fallback: probeer andere bron
      if(true) {
        try {
          const batch = await fetchTwelveBatch(allIds);
          if(Object.keys(batch).length > 0) setLivePrices(prev=>({...prev,...batch}));
        } catch(_) {}
      } else if(true) {
        allIds.forEach(id => {
          fetchFinnhubPrice(id)
            .then(p=>{ if(p) setLivePrices(prev=>({...prev,[id]:p})); })
            .catch(()=>{});
        });
      }
    }

    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return()=>clearInterval(t);
  },[assets]);

  // ── Breaking News via Finnhub (gratis, 0 tokens, geen CORS) ─────────────────
  const MARKET_KEYWORDS = ["fed","rate","inflation","gold","dollar","dxy","yield","nasdaq","dow","gdp","cpi","fomc","ecb","boe","oil","recession","tariff","powell","lagarde","treasury","bond","forex","currency","payroll","pmi"];

  async function fetchBreakingNews() {

    // Geen breaking news fetch tijdens actieve API calls
    if(hybridStatus!=="idle"&&hybridStatus!=="done") return;
    if(aStatus==="loading"||iStatus==="loading") return;
    setBnLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
      const res = await fetch('/api/finnhub?type=news&category=general', {signal:AbortSignal.timeout(5000)});
      const items = await res.json();
      if(!Array.isArray(items)) { setBnLoading(false); return; }

      const filtered = items
        .filter(n => {
          const lower = (n.headline||"").toLowerCase();
          const time = n.datetime ? new Date(n.datetime*1000) : null;
          return MARKET_KEYWORDS.some(k=>lower.includes(k)) && n.headline && (!time || time >= todayStart);
        })
        .map(n => {
          const time = new Date(n.datetime*1000);
          return {
            headline: n.headline,
            source: n.source || "Finnhub",
            url: n.url || "",
            time,
            timeStr: time.toLocaleTimeString("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"}),
            direction: "neutraal",
            impact: "medium",
            assets: [],
            isNew: !seenHeadlines.has(n.headline),
          };
        })
        .sort((a,b) => b.time - a.time)
        .slice(0, 25);

      const newItems = filtered.filter(n=>n.isNew);
      if(newItems.length>0 && seenHeadlines.size>0) {
        newItems.slice(0,2).forEach(n=>sendNotification("📰 Breaking News", n.headline, n.url));
      }
      setSeenHeadlines(new Set(filtered.map(n=>n.headline)));
      // Merge met bestaande items (Intel nieuws behouden), Finnhub items updaten
      setBreakingNews(prev => {
        const nonFinnhub = prev.filter(p => p.source !== "Finnhub" && !filtered.some(f=>f.headline===p.headline));
        return [...filtered, ...nonFinnhub].sort((a,b)=>b.time-a.time).slice(0,40);
      });
    } catch(e) { console.error("News:", e); }
    setBnLoading(false);
  }

  // Nieuws laden zodra Finnhub key beschikbaar, elke 10 min — 0 tokens
  useEffect(() => {

    fetchBreakingNews();
    const t = setInterval(fetchBreakingNews, 10*60*1000);
    return () => clearInterval(t);
  }, []);

  // ── Browser Notifications ────────────────────────────────────────────────────
  function requestNotifPermission() {
    if("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
  function sendNotification(title, body, url) {
    if(!("Notification" in window) || Notification.permission !== "granted") return;
    const n = new Notification(title, { body: body.slice(0,100), icon: "https://cdn-icons-png.flaticon.com/512/2103/2103633.png" });
    if(url) n.onclick = () => window.open(url, "_blank");
  }
  useEffect(() => { requestNotifPermission(); }, []);

  // ── Auto-refresh ─────────────────────────────────────────────────────────────
  function startAutoRefresh() {
    clearInterval(autoRefreshRef.current);
    clearInterval(countdownRef.current);
    const ms = refreshInterval * 60 * 1000;
    let remaining = ms / 1000;
    setNextRefreshIn(remaining);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setNextRefreshIn(remaining);
    }, 1000);
    autoRefreshRef.current = setInterval(() => {
      runAnalysis();
      const ni = ms / 1000;
      remaining = ni;
      setNextRefreshIn(ni);
    }, ms);
  }
  function stopAutoRefresh() {
    clearInterval(autoRefreshRef.current);
    clearInterval(countdownRef.current);
    setNextRefreshIn(null);
  }
  useEffect(() => {
    if(autoRefresh) startAutoRefresh();
    else stopAutoRefresh();
    return () => { clearInterval(autoRefreshRef.current); clearInterval(countdownRef.current); };
  }, [autoRefresh, refreshInterval]);

  const fmtCountdown = (s) => {
    if(s===null) return "";
    const m = Math.floor(s/60), sec = Math.floor(s%60);
    return `${m}:${String(sec).padStart(2,"0")}`;
  };

  function robustParse(text) {
    // Strip all markdown artifacts
    let s = text
      .replace(/```json\s*/gi,"").replace(/```\s*/g,"")
      .replace(/^---+\s*$/gm,"")
      .trim();

    // Find the outermost { ... }
    const start = s.indexOf("{");
    if(start===-1) throw new Error("Geen JSON object gevonden");

    // Walk from start to find matching closing brace
    let depth=0, end=-1;
    let inStr=false, esc=false;
    for(let i=start;i<s.length;i++){
      const c=s[i];
      if(esc){esc=false;continue;}
      if(c==="\\"&&inStr){esc=true;continue;}
      if(c==='"'){inStr=!inStr;continue;}
      if(inStr) continue;
      if(c==="{")depth++;
      else if(c==="}"){depth--;if(depth===0){end=i;break;}}
    }

    if(end===-1) {
      // JSON afgekapt — agressieve reparatie:
      // 1. Als we midden in een string zitten: sluit die
      let repairing = s.slice(start);
      // Sluit open string als nodig
      let inS2=false, es2=false, lastStrStart=-1;
      for(let i=0;i<repairing.length;i++){
        const c=repairing[i];
        if(es2){es2=false;continue;}
        if(c==="\\"&&inS2){es2=true;continue;}
        if(c==='"'){
          if(!inS2) lastStrStart=i;
          inS2=!inS2;
        }
      }
      if(inS2) repairing += '"'; // sluit open string
      // Verwijder trailing incomplete key (bijv: ,"some_key": zonder waarde)
      repairing = repairing.replace(/,\s*"[^"]*"\s*:\s*$/, '');
      repairing = repairing.replace(/,\s*"[^"]*"\s*$/, '');
      // Tel open haakjes en sluit ze
      const opens  = (repairing.match(/{/g)||[]).length - (repairing.match(/}/g)||[]).length;
      const opensA = (repairing.match(/\[/g)||[]).length - (repairing.match(/\]/g)||[]).length;
      repairing += "]".repeat(Math.max(0,opensA)) + "}".repeat(Math.max(0,opens));
      s = repairing;
      end = s.length - 1;
    } else {
      s = s.slice(start, end+1);
    }

    // Fix trailing commas
    s = s.replace(/,(\s*[}\]])/g,"$1");
    try { return JSON.parse(s); } catch(_) {}

    // Deep fix: rebuild with proper string escaping
    let out="", inS=false, es=false;
    for(let i=0;i<s.length;i++){
      const c=s[i];
      if(es){out+=c;es=false;continue;}
      if(c==="\\"&&inS){out+=c;es=true;continue;}
      if(c==='"'){
        if(!inS){inS=true;out+=c;continue;}
        let j=i+1;
        while(j<s.length&&" \t\n\r".includes(s[j]))j++;
        const nx=s[j];
        if(":"===nx||","===nx||"}"===nx||"]"===nx||j>=s.length){
          inS=false;out+=c;
        } else {
          out+='\u201C';
        }
        continue;
      }
      if(inS&&(c==="\n"||c==="\r")){out+=" ";continue;}
      if(inS&&c==="'"){out+="\u2019";continue;}
      out+=c;
    }
    s=out;
    s=s.replace(/,(\s*[}\]])/g,"$1");
    s=s.replace(/([}\]])([ \t]*\n[ \t]*")/g,'$1,$2');
    s=s.replace(/,(\s*[}\]])/g,"$1");

    try { return JSON.parse(s); } catch(e){
      const pos=parseInt(e.message.match(/position (\d+)/)?.[1]||"0");
      const snip=s.slice(Math.max(0,pos-100),pos+100);
      console.error("JSON BREAK pos="+pos+"\n---\n"+snip+"\n---");
      throw new Error(`JSON afgekapt (pos ${pos}) — verhoog max_tokens of versimpel prompt`);
    }
  }

  async function callApi(sys, usr, setResult, setError, setStatus, cacheKey=null) {
    setStatus("loading");
    const headers = {"Content-Type":"application/json"};
    const maxRetries = 3;
    for(let attempt=1; attempt<=maxRetries; attempt++) {
      try {
        const bodyObj = {
          model:"claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: sys,
          tools: [{ type:"web_search_20250305", name:"web_search" }],
          messages:[{role:"user",content:usr}]
        };
        if(cacheKey) bodyObj._cacheKey = cacheKey;
        const res = await fetch("/api/anthropic",{
          method:"POST", headers,
          body:JSON.stringify(bodyObj)
        });
        if(res.status===429){
          if(attempt<maxRetries){
            // Lees retry-after header of gebruik exponential backoff
            const retryAfter = parseInt(res.headers.get("retry-after")||"0");
            const waitSec = retryAfter > 0 ? retryAfter + 2 : attempt * 30;
            setStatus(`waiting-${waitSec}`);
            await new Promise(r=>setTimeout(r, waitSec*1000));
            setStatus("loading");
            continue;
          }
          throw new Error("Rate limit — wacht even en probeer opnieuw");
        }
        if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||`API fout: ${res.status}`);}
        const data=await res.json();
        // Web search geeft meerdere content blocks terug — combineer alleen text blocks
        const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
        setResult(sanitizeIntelResult(robustParse(text)));
        setStatus("done");
        return;
      } catch(e){
        if(attempt===maxRetries){ setError(e.message||"Onbekende fout"); setStatus("error"); }
        else await new Promise(r=>setTimeout(r,10000));
      }
    }
  }

  async function fetchRssFeeds() {
    setRssLoading(true);
    try {
      const res = await fetch("/api/rss", { signal: AbortSignal.timeout(15000) });
      if(!res.ok) { setRssLoading(false); return; }
      const data = await res.json();
      setRssItems((data.items||[]).map(item => ({...item, time: new Date(item.time)})));
    } catch(e) { console.warn("RSS fout:", e); }
    setRssLoading(false);
  }

  async function runPresession() {
    setPsStatus("loading");
    const assetList = assets.map(a=>a.label).join(", ");
    const now = new Date();
    const dateStr = now.toLocaleDateString("nl-NL",{timeZone:"Europe/Amsterdam",weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const timeStr = now.toLocaleTimeString("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"});
    // Nauwkeurige sessie detectie op basis van CET tijd
    const getCetH = () => parseInt(new Date().toLocaleString("en-US",{timeZone:"Europe/Amsterdam",hour:"numeric",hour12:false}));
    const getCetM = () => parseInt(new Date().toLocaleString("en-US",{timeZone:"Europe/Amsterdam",minute:"numeric"}));
    const cetH = getCetH(); const cetM = getCetM();
    const cetMins = cetH*60+cetM; // minuten sinds middernacht CET
    // Sessie grenzen in minuten CET:
    // Asia: 00:00-07:00 = 0-420
    // London: 07:00-16:00 = 420-960
    // Pre-NY: 13:00-15:30 = 780-930 (overlap met London)
    // NY: 15:30-00:00 = 930-1440
    const isAsia   = cetMins < 420;
    const isLondon = cetMins >= 420 && cetMins < 930 && !(cetMins >= 780 && cetMins < 930);
    const isPreNY  = cetMins >= 780 && cetMins < 930;
    const isNY     = cetMins >= 930;
    const sessionLabel = isAsia ? "Aziatische sessie (00:00-07:00 Amsterdam)" :
                         isPreNY ? "Pre-NY sessie (13:00-15:30 Amsterdam)" :
                         isNY ? "New Yorkse sessie (15:30-00:00 CET)" :
                         "Londense sessie (07:00-16:00 Amsterdam)";
    const sessionName = isAsia?"Asia" : isPreNY?"Pre-NY" : isNY?"New York" : "London";
    const sessionTime = isAsia?"00:00-07:00 Amsterdam" : isPreNY?"13:00-15:30 Amsterdam" : isNY?"15:30-00:00 CET" : "07:00-16:00 Amsterdam";
    // Inject live prices — inclusief actuele prijs zodat AI geen verouderde levels gebruikt
    const priceLines = assets.map(a=>{ const p=livePrices[a.id]; return p?`${a.label}: ${p.price} (${p.change})`:a.label; }).join(", ");
    const sys = `Pre-sessie analist. Geen web search nodig. Geen apostrofs in strings.
HUIDIGE SESSIE: ${sessionName} (${sessionTime}).
${isPreNY ? "PRE-NY: Focus op wat NY verwacht bij opening (15:30 CET). Hoe reageert NY op London? Key catalysts voor NY?" : ""}
${isNY ? "NY SESSIE: Actief. Focus op US data, Fed speakers, equity flow." : ""}
BELANGRIJK: Gebruik ALLEEN de aangeleverde live prijzen voor levels. Verzin GEEN prijsniveaus.
Alleen JSON:
{"session":"${sessionName}","session_time":"${sessionTime}","mood":"Bullish","mood_score":65,"mood_explanation":"1 zin","volatility_outlook":"Normaal","key_events_today":["event 1"],"market_narrative":"2 zinnen","analysed_at":"ISO"}`;
    // Geef breaking news mee zodat narrative niet altijd hetzelfde is
    const recentNews = breakingNews.slice(0,5).map(n=>`[${n.source}] ${n.headline}`).join("\n") || "geen recent nieuws";
    const usr = `VANDAAG ${dateStr} ${timeStr} Amsterdam tijd — ${sessionLabel}.
Live prijzen: ${priceLines}.
Recent breaking news (laatste uur):
${recentNews}
Schrijf een UNIEKE narrative gebaseerd op het nieuws hierboven. Niet generiek. Alleen JSON.`;
    try {
      const hdrs = {"Content-Type":"application/json"};
      const res = await fetch("/api/anthropic",{method:"POST",headers:hdrs,body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:300,system:sys,messages:[{role:"user",content:usr}]})});
      if(!res.ok) throw new Error(`API fout: ${res.status}`);
      const data=await res.json();
      const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
      const psData = robustParse(text);
      if(!psData.analysed_at) psData.analysed_at = new Date().toISOString();
      setPresession(psData);
      setPsStatus("done");
    } catch(e){ console.error(e); setPsStatus("error"); }
  }

  async function refreshSingleAsset(asset, openDeepDive=false) {
    if(refreshingAssets.has(asset.id)) return;
    setRefreshingAssets(prev=>new Set([...prev, asset.id]));
    setDeepRefreshing(true);
    try {
      const now = new Date();
      const hdrs2 = {"Content-Type":"application/json"};
      const p = livePrices[asset.id];
      const prev = prevBias[asset.id];

      // Zelfde macroCtx als runAnalysis — inclusief marktvisie
      let macroCtx = "";
      if(iResult) {
        macroCtx = `Regime: ${iResult.macro_regime||""}. Driver: ${iResult.dominant_driver||""}. Yields: ${iResult.yield_analysis?.us10y_level||""} (${iResult.yield_analysis?.regime||""}). ${iResult.desk_view||""}`;
        if(iResult.news_items?.length>0) {
          macroCtx += "\nNIEUWS:\n" + iResult.news_items.slice(0,8).map(n=>`- [${n.source}] ${n.headline} → ${n.direction} (impact:${n.impact})`).join("\n");
        }
        if(iResult.marktvisie?.assets?.[asset.id]) {
          const v = iResult.marktvisie.assets[asset.id];
          macroCtx += `\n\nMARKTVISIE VOOR ${asset.id}: ${v.visie} → verwachte richting: ${v.bias_richting} (sterkte:${v.sterkte}/100) | driver: ${v.key_driver} | risico: ${v.risico}${v.ingeprijsd?" | MOGELIJK INGEPRIJSD":""}`;
        }
        if(iResult.marktvisie?.macro_samenvatting) {
          macroCtx += `\nMACRO: ${iResult.marktvisie.macro_samenvatting}`;
        }
      }
      if(breakingNews?.length>0) macroCtx += "\nBREAKING:\n"+breakingNews.slice(0,4).map(n=>`- [${n.source}] ${n.headline}`).join("\n");

      const dxy   = livePrices["DXY"];
      const us10y = livePrices["US10Y"];
      const xauP  = livePrices["XAUUSD"];
      const crossAsset = [
        dxy   ? `DXY:${dxy.price} ${dxy.change}` : "DXY:?",
        us10y ? `US10Y:${us10y.price}% ${us10y.change}` : "US10Y:?",
        xauP && asset.id!=="XAUUSD" ? `XAU:${xauP.price} ${xauP.change}` : "",
      ].filter(Boolean).join(" | ");

      // Nieuw breaking news sinds de marktvisie gebouwd werd
      const visietijd = iResult?.marktvisie?.marktvisie_tijd ? new Date(iResult.marktvisie.marktvisie_tijd) : null;
      const nieuwBreaking = breakingNews.filter(n => !visietijd || n.time > visietijd).slice(0,5);

      const assetVisie = iResult?.marktvisie?.assets?.[asset.id];
      const prevBiasData = prevBias[asset.id] || (aResult?.assets?.[asset.id] ? {bias: aResult.assets[asset.id].bias, confidence: aResult.assets[asset.id].confidence} : null);

      let usr, systemPrompt;

      if(assetVisie && prevBiasData) {
        // ── VALIDATIE MODE: marktvisie bestaat — alleen checken of er reden is om te veranderen
        systemPrompt = `Je bent een forex trader die een bestaande marktvisie valideert.
REGEL: Geef de BESTAANDE bias terug tenzij er concreet NIEUW nieuws is dat de thesis ongeldig maakt.
Kleine prijsbewegingen = GEEN reden om te veranderen.
GEEN apostrofs. Alleen JSON.`;

        usr = `BESTAANDE VISIE VOOR ${asset.id}:
Bias: ${prevBiasData.bias} (${prevBiasData.confidence}%)
Visie: ${assetVisie.visie}
Key driver: ${assetVisie.key_driver}
Risico: ${assetVisie.risico}

CROSS-ASSET NU: ${crossAsset}

NIEUW BREAKING NEWS SINDS VISIE (${nieuwBreaking.length} items):
${nieuwBreaking.length > 0
  ? nieuwBreaking.map(n=>`- [${n.source}] ${n.headline}`).join("\n")
  : "GEEN nieuw breaking news — houd bestaande bias aan"}

VRAAG: Is er reden om de bias te veranderen?
- Zo NEE: retourneer exact dezelfde bias en confidence
- Zo JA: retourneer nieuwe bias met uitleg in mini_summary

JSON: {"bias":"","confidence":0,"macro_hold":0,"market_mood":"","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"","mini_summary":"","analyse_uitgebreid":"","fail_condition":"","technical_trend":"","trend_driver":"","market_regime":"","intraday_structuur":"","macro_alignment":0,"pillar_news":0,"pillar_crossasset":0,"pillar_yield":0,"pulse":"WAIT","pulse_reden":"","confidence_label":"","ai_opinie":"","technical_trend_uitleg":"","structuur_uitleg":"","market_regime_uitleg":"","yield_regime_uitleg":"","correlatie_uitleg":"","macro_alignment_uitleg":"","macro_hold_uitleg":""}`;

      } else {
        // ── FRESH MODE: geen marktvisie — normale analyse
        systemPrompt = ANALYSIS_SYSTEM;
        const prevLine = prevBiasData
          ? `VORIGE BIAS: ${prevBiasData.bias} (${prevBiasData.confidence}%) — verander ALLEEN bij concreet nieuw nieuws`
          : "geen vorige bias";
        usr = `${asset.id} | ${crossAsset} | ${prevLine}

CONTEXT:
${macroCtx || "Geen Intel geladen."}

JSON: {"bias":"","confidence":0,"macro_hold":0,"market_mood":"","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"","mini_summary":"","analyse_uitgebreid":"","fail_condition":"","technical_trend":"","trend_driver":"","market_regime":"","intraday_structuur":"","macro_alignment":0,"pillar_news":0,"pillar_crossasset":0,"pillar_yield":0,"pulse":"WAIT","pulse_reden":"","confidence_label":"","ai_opinie":"","technical_trend_uitleg":"","structuur_uitleg":"","market_regime_uitleg":"","yield_regime_uitleg":"","correlatie_uitleg":"","macro_alignment_uitleg":"","macro_hold_uitleg":""}`;
      }

      const res = await fetch("/api/anthropic",{method:"POST",headers:hdrs2,body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,system:systemPrompt,messages:[{role:"user",content:usr}]})});
      if(!res.ok) throw new Error(`API fout: ${res.status}`);
      const data=await res.json();
      const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
      const newData=robustParse(text);
      // Prijs van API injekten, niet van AI
      if(p) { newData.price_today=p.price; newData.price_change_today=p.change; newData.price_direction=p.direction; }
      newData.analysed_at = new Date().toISOString();
      if(newData.bias) {
        const oldBias = prevBias[asset.id]?.bias;
        const newsCtx = [
          ...breakingNews.slice(0,3).map(n=>({source:n.source, headline:n.headline, url:n.url||""})),
          ...(iResult?.news_items||[]).slice(0,3).map(n=>({source:n.source, headline:n.headline, url:n.url||""})),
        ].slice(0,5);

        // Bouw history direct — niet wachten op state update
        let updatedHistory = biasHistory[asset.id] || [];
        if(oldBias && oldBias !== newData.bias) {
          const newEntry = {
            time: new Date().toISOString(),
            van: oldBias,
            naar: newData.bias,
            confidence: newData.confidence,
            nieuws: newsCtx,
          };
          updatedHistory = [newEntry, ...updatedHistory].slice(0, 5);
          setBiasHistory(prev => ({...prev, [asset.id]: updatedHistory}));
        }
        // Attach direct aan newData — geen async delay
        newData.bias_switch_history = updatedHistory;
        setPrevBias(prev=>({...prev,[asset.id]:{bias:newData.bias,confidence:newData.confidence}}));
      } else {
        newData.bias_switch_history = biasHistory[asset.id] || [];
      }
      setAResult(prev=>prev?{...prev,assets:{...prev.assets,[asset.id]:newData}}:prev);
      // Update deepAsset als die open staat voor dit asset — zodat switch direct zichtbaar is
      setDeepAsset(prev => prev?.asset?.id===asset.id ? {...prev, data:newData} : prev);
      if(openDeepDive) setDeepAsset({asset,data:newData});
    } catch(e){ console.error(e); }
    setRefreshingAssets(prev=>{ const s=new Set(prev); s.delete(asset.id); return s; });
    setDeepRefreshing(false);
  }

  const [prevBias, setPrevBias] = useState({}); // geheugen vorige bias per asset
  const [biasHistory, setBiasHistory] = useState({}); // history van bias switches per asset

  function recordBiasChange(assetId, oldBias, newBias, newConfidence, newsContext) {
    if(!oldBias || oldBias === newBias) return; // geen switch, niets opslaan
    const entry = {
      time: new Date().toISOString(),
      van: oldBias,
      naar: newBias,
      confidence: newConfidence,
      // Meest relevante breaking news op dit moment
      nieuws: newsContext || [],
    };
    setBiasHistory(prev => ({
      ...prev,
      [assetId]: [entry, ...(prev[assetId]||[])].slice(0, 5) // max 5 switches onthouden
    }));
  }

  function addCustomPair() {
    if(!newPairLabel.trim()) return;
    const id = newPairLabel.replace("/","").toUpperCase();
    setAssets(prev=>[...prev,{id,label:newPairLabel.toUpperCase(),full:newPairFull||newPairLabel.toUpperCase(),group:"custom",searchTerms:newPairLabel}]);
    setNewPairLabel(""); setNewPairFull(""); setShowAddPair(false);
  }

  const runAnalysis = async () => {
    setAStatus("loading");
    setAError("");
    const now = new Date();
    const dateStr = now.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const headers = {"Content-Type":"application/json"};
    

    // Verse prijzen ophalen — alleen Finnhub of 12data
    const freshPrices = {...livePrices};
    const allFetchIds = [...new Set([...assets.map(a=>a.id), "DXY","VIX","US10Y"])];

    if(true) {
      try {
        const batch = await fetchTwelveBatch(allFetchIds);
        Object.entries(batch).forEach(([id,p])=>{ freshPrices[id]=p; setLivePrices(prev=>({...prev,[id]:p})); });
      } catch(_) {}
    } else if(true) {
      await Promise.allSettled(allFetchIds.map(async id => {
        try {
          const p = await fetchFinnhubPrice(id);
          if(p) { freshPrices[id]=p; setLivePrices(prev=>({...prev,[id]:p})); }
        } catch(_) {}
      }));
    }

    // ── Volledige macro context voor v6.3 analyse ───────────────────────────────
    let macroCtx = "";
    if(iResult) {
      // Yield regime detail — kern van v6.3 correlatie check
      const ya = iResult.yield_analysis || {};
      macroCtx += `MACRO REGIME: ${iResult.macro_regime||"onbekend"}`;
      macroCtx += `\nDOMINANT DRIVER: ${iResult.dominant_driver||"onbekend"}`;
      macroCtx += `\nYIELD ANALYSE: US10Y=${ya.us10y_level||"?"} US2Y=${ya.us2y_level||"?"} Spread=${ya.spread||"?"} Regime=${ya.regime||"?"} → ${ya.implication||""}`;
      macroCtx += `\nDESK VIEW: ${iResult.desk_view||""}`;
      // Alle nieuws items — niet gecapped, v6.3 heeft specifiek nieuws nodig
      if(iResult.news_items?.length>0) {
        macroCtx += "\n\nNIEUWS VANDAAG — gebruik specifieke headlines voor bias onderbouwing:\n";
        macroCtx += iResult.news_items.map(n=>`[${n.time||"?"}][${n.source}][${n.impact?.toUpperCase()}] ${n.headline} → ${n.direction}`).join("\n");
      }
      // Cross-asset signals van Intel
      if(iResult.cross_asset_signals?.length>0) {
        macroCtx += "\n\nCROSS-ASSET SIGNALEN:\n";
        macroCtx += iResult.cross_asset_signals.map(s=>`${s.signal} (${s.type}): ${s.implication}`).join("\n");
      }
      // Marktvisie — diepste nieuws analyse per asset
      if(iResult.marktvisie?.assets) {
        macroCtx += "\n\nMARKTVISIE PER ASSET (gebaseerd op nieuws, zwaar meewegen):\n";
        macroCtx += `Macro: ${iResult.marktvisie.macro_samenvatting||""}\n`;
        Object.entries(iResult.marktvisie.assets).forEach(([id, v]) => {
          macroCtx += `${id}: ${v.visie} → verwacht: ${v.bias_richting} (sterkte:${v.sterkte}/100) | key driver: ${v.key_driver} | risico: ${v.risico}${v.ingeprijsd?" | LET OP: MOGELIJK AL INGEPRIJSD":""}\n`;
        });
      }
    }
    // Breaking news — meest recente signalen
    if(breakingNews?.length>0) {
      macroCtx += "\n\nBREAKING NEWS (meest recent eerst):\n";
      macroCtx += breakingNews.slice(0,4).map(n=>`[${fmtTime(n.time)}][${n.source}] ${n.headline}`).join("\n");
    }

    // Analyseer alle assets in 1 call — zo kan AI onderlinge verhoudingen zien
    async function analyseAllAssets(attempt=1) {
      const dxy   = freshPrices["DXY"];
      const vix   = freshPrices["VIX"];
      const us10y = freshPrices["US10Y"];
      const xauP  = freshPrices["XAUUSD"];
      const crossAsset = [
        dxy   ? `DXY:${dxy.price} ${dxy.change}` : "DXY:?",
        us10y ? `US10Y:${us10y.price}% ${us10y.change}` : "US10Y:?",
        vix   ? `VIX:${vix.price} ${vix.change}` : "VIX:?",
        xauP  ? `XAU:${xauP.price} ${xauP.change}` : "",
      ].filter(Boolean).join(" | ");

      // Per-asset prijsbeweging vandaag — kern van "market context"
      const assetLines = assets.map(a => {
        const prev = prevBias[a.id];
        const p = freshPrices[a.id];
        const moveFloat = p ? parseFloat(p.change?.replace("%","")?.replace("+","")) : null;
        // Bepaal of move impulsief (>0.5%) of correctief (<0.3%) is
        const moveType = moveFloat === null ? "onbekend" :
          Math.abs(moveFloat) > 0.8 ? "IMPULSIEF" :
          Math.abs(moveFloat) > 0.3 ? "matig" : "correctief/ranging";
        const priceCtx = p
          ? `prijs=${p.price} move=${p.change} (${moveType}) richting=${p.direction}`
          : "geen prijs";
        const biasCtx = prev
          ? `VORIGE BIAS=${prev.bias}(${prev.confidence}%)`
          : "geen vorige bias";
        return `${a.id}: ${priceCtx} | ${biasCtx}`;
      }).join("\n");

      // Is nieuws al ingeprijsd? Vergelijk move richting met dominante driver
      const priceReactionCtx = assets.map(a => {
        const p = freshPrices[a.id];
        if(!p) return null;
        const move = parseFloat(p.change?.replace("%","")?.replace("+",""));
        if(Math.abs(move) < 0.1) return `${a.id}: nauwelijks bewogen vandaag → nieuws mogelijk nog NIET ingeprijsd`;
        if(Math.abs(move) > 1.0) return `${a.id}: grote move (${p.change}) vandaag → nieuws mogelijk AL ingeprijsd, let op reversal`;
        return null;
      }).filter(Boolean).join("\n");

      const newsLines = macroCtx || "Geen Intel geladen — baseer op cross-asset data.";

      const assetTemplate = `{"bias":"","confidence":0,"macro_hold":0,"market_mood":"","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"","mini_summary":"","analyse_uitgebreid":"","fail_condition":"","technical_trend":"","trend_driver":"","market_regime":"","intraday_structuur":"","macro_alignment":0,"pillar_news":0,"pillar_crossasset":0,"pillar_yield":0,"pulse":"WAIT","pulse_reden":"","confidence_label":"","ai_opinie":"","technical_trend_uitleg":"","structuur_uitleg":"","market_regime_uitleg":"","yield_regime_uitleg":"","correlatie_uitleg":"","macro_alignment_uitleg":"","macro_hold_uitleg":""}`;
      const assetsJson = assets.map(a=>`"${a.id}":${assetTemplate}`).join(",");

      const usr = `DATUM: ${dateStr}
LIVE CROSS-ASSET: ${crossAsset}

━━━ PRIJSBEWEGING VANDAAG (gebruik dit voor follow-through / absorptie check) ━━━
${assetLines}
${priceReactionCtx ? `\nINGEPRIJSD CHECK:\n${priceReactionCtx}` : ""}

VORIGE BIASSEN — verander ALLEEN bij concreet nieuw macro nieuws of regime shift:
${assets.map(a => prevBias[a.id] ? `${a.id}: VORIGE BIAS=${prevBias[a.id].bias}(${prevBias[a.id].confidence}%)` : `${a.id}: nieuw`).join(" | ")}

━━━ NIEUWS & MACRO CONTEXT (v6.3) ━━━
${newsLines}

Redeneer: past de prijsbeweging bij het nieuws? Is er follow-through of absorptie?
Voer v6.3 analyse uit voor ALLE ${assets.length} assets. Alleen JSON:
{"assets":{${assetsJson}}}`;

      // Shared cache key — iedereen die hetzelfde uur runt krijgt dezelfde gecachede analyse
      const analyseKey = `analyse:${assets.map(a=>a.id).join("-")}:${new Date().toISOString().slice(0,13)}`;
      const body = { model:"claude-sonnet-4-20250514", max_tokens:2800, system:ANALYSIS_SYSTEM, messages:[{role:"user",content:usr}], _cacheKey:analyseKey };
      const res = await fetch("/api/anthropic",{method:"POST",headers,body:JSON.stringify(body)});
      if(res.status===429) {
        if(attempt < 3) {
          const waitSec = attempt * 30;
          setAStatus(`waiting-${waitSec}`);
          await new Promise(r=>setTimeout(r, waitSec*1000));
          setAStatus("loading");
          return analyseAllAssets(attempt+1);
        }
        throw new Error("Rate limit — wacht 1 minuut en probeer opnieuw");
      }
      if(!res.ok) throw new Error(`Analyse API fout ${res.status}`);
      const data = await res.json();
      const text = data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
      const parsed = robustParse(text);
      return parsed.assets || parsed;
    }

    let allAssetData = {};
    try {
      allAssetData = await analyseAllAssets();
      // Fix price_today from freshPrices if AI left it empty
      assets.forEach(a => {
        const p = freshPrices[a.id];
        if(allAssetData[a.id] && p) {
          if(!allAssetData[a.id].price_today) allAssetData[a.id].price_today = p.price;
          if(!allAssetData[a.id].price_change_today) allAssetData[a.id].price_change_today = p.change;
          if(!allAssetData[a.id].price_direction) allAssetData[a.id].price_direction = p.direction;
        }
        if(allAssetData[a.id]?.bias) {
          const oldBias = prevBias[a.id]?.bias;
          const newBias = allAssetData[a.id].bias;
          if(oldBias && oldBias !== newBias) {
            const newsCtx = [
              ...breakingNews.slice(0,3).map(n=>({source:n.source, headline:n.headline, url:n.url||""})),
              ...(iResult?.news_items||[]).slice(0,3).map(n=>({source:n.source, headline:n.headline, url:n.url||""})),
            ].slice(0,5);
            setBiasHistory(prev => ({
              ...prev,
              [a.id]: [{
                time: new Date().toISOString(),
                van: oldBias,
                naar: newBias,
                confidence: allAssetData[a.id].confidence,
                nieuws: newsCtx,
              }, ...(prev[a.id]||[])].slice(0,5)
            }));
          }
          setPrevBias(prev=>({...prev,[a.id]:{bias:allAssetData[a.id].bias,confidence:allAssetData[a.id].confidence}}));
        }
      });
    } catch(e) {
      setAError("Analyse mislukt: " + e.message);
      setAStatus("error");
      return;
    }

    // Combineer resultaten
    const combined = {
      timestamp: new Date().toISOString(),
      yield_regime: "", yield_regime_explanation: "",
      dxy_change: freshPrices.DXY?.change || "",
      dxy_direction: freshPrices.DXY?.direction || "up",
      vix_level: freshPrices.VIX?.price || "",
      us10y: freshPrices.US10Y?.price || "",
      market_context: iResult?.desk_view || "",
      session: iResult?.session_context || "",
      assets: {}
    };
    assets.forEach(a => {
      const data = allAssetData[a.id];
      const p = freshPrices[a.id];
      if(data) {
        combined.assets[a.id] = {
          ...data,
          price_today: p?.price || "",
          price_change_today: p?.change || "",
          price_direction: p?.direction || "up",
          analysed_at: new Date().toISOString(),
          bias_switch_history: biasHistory[a.id] || [],
        };
        if(!combined.yield_regime && data.yield_regime) {
          combined.yield_regime = data.yield_regime;
        }
      }
    });
    setAResult(combined);
    setAStatus("done");
  };


  const runIntel = () => {
    setIError("");
    const labels = assets.map(a=>a.label);
    callApi(INTEL_SYSTEM, INTEL_USER_NOW(labels, livePrices), (result) => {
      setIResult(sanitizeIntelResult(result));
      if(result?.news_items?.length > 0) {
        const now = new Date();
        const items = result.news_items.map((n,idx) => {
          // Parseer tijd voor correcte sortering
          const m = String(n.time||"").match(/(\d{1,2}):(\d{2})/);
          const itemTime = m ? new Date(now.toDateString()+" "+m[0]) : new Date(now - idx*60000);
          return {
            headline: n.headline, source: n.source || "Intel", url: n.url || "",
            time: itemTime, timeStr: n.time || now.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"}),
            direction: n.direction, impact: n.impact, assets: n.assets_affected || [], isNew: true,
          };
        });
        setBreakingNews(prev => {
          const existing = prev.filter(p => !items.some(i => i.headline === p.headline));
          return [...items, ...existing].sort((a,b)=>b.time-a.time).slice(0, 30);
        });
      }
    }, setIError, setIStatus, `intel:${new Date().toISOString().slice(0,13)}`);
  };

  // ── HYBRID: Intel (nieuws) → Analyse (bias) in één klik ─────────────────────
  const [hybridStatus, setHybridStatus] = useState("idle");
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [loadingSteps, setLoadingSteps] = useState([]);
  const runHybrid = async () => {
    if(hybridStatus !== "idle" && hybridStatus !== "done") return;
    // Stop auto-refresh tijdens hybrid zodat geen parallel calls
    clearInterval(autoRefreshRef.current);
    clearInterval(countdownRef.current);
    setHybridStatus("intel"); setLoadingSteps(["🔍 Intel ophalen — nieuws & macro data"]);
    setIError(""); setAError("");
    const labels = assets.map(a=>a.label);

    // ── Stap 1: Intel — nieuws ophalen via web search ──────────────────────────
    let intelResult = null;
    let intelDone = false;
    await new Promise(resolve => {
      const origSet = (result) => {
        intelResult = result;
        setIResult(sanitizeIntelResult(result));
        if(result?.news_items?.length > 0) {
          const now = new Date();
          const items = result.news_items.map((n,idx) => {
            const m = String(n.time||"").match(/(\d{1,2}):(\d{2})/);
            const itemTime = m ? new Date(now.toDateString()+" "+m[0]) : new Date(now - idx*60000);
            return {
              headline: n.headline, source: n.source || "Intel", url: n.url || "",
              time: itemTime, timeStr: n.time || now.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"}),
              direction: n.direction, impact: n.impact, assets: n.assets_affected || [], isNew: true,
            };
          });
          setBreakingNews(prev => [...items, ...prev.filter(p=>!items.some(i=>i.headline===p.headline))].sort((a,b)=>b.time-a.time).slice(0,30));
        }
        if(!intelDone) { intelDone = true; resolve(result); }
      };
      callApi(INTEL_SYSTEM, INTEL_USER_NOW(labels, livePrices), origSet, setIError, (s) => {
        setIStatus(s);
        if(s === "error" && !intelDone) { intelDone = true; resolve(null); }
      });
    });

    // ── Stap 2: Marktvisie — 3 sec pauze om rate limit te voorkomen ─────────────
    await new Promise(r=>setTimeout(r,3000));
    setHybridStatus("visie");
    if(intelResult) {
      try {
        const headers = {"Content-Type":"application/json"};
        const dxy = livePrices["DXY"]; const us10y = livePrices["US10Y"]; const vix = livePrices["VIX"];
        const crossAsset = [
          dxy   ? `DXY:${dxy.price} ${dxy.change}` : "DXY:?",
          us10y ? `US10Y:${us10y.price}% ${us10y.change}` : "US10Y:?",
          vix   ? `VIX:${vix.price} ${vix.change}` : "VIX:?",
        ].join(" | ");
        // Geef breaking news ook mee aan marktvisie
        const intelMetBreaking = {...intelResult, breakingItems: breakingNews.slice(0,6)};
        let visieRes = await fetch("/api/anthropic",{
          method:"POST", headers,
          body: JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens: 900,
            system: MARKTVISIE_SYSTEM,
            messages:[{role:"user", content: MARKTVISIE_USER(intelMetBreaking, labels, crossAsset)}]
          })
        });
        // 429 retry voor marktvisie
        if(visieRes.status===429) {
          await new Promise(r=>setTimeout(r,20000));
          visieRes = await fetch("/api/anthropic",{
            method:"POST", headers,
            body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:900,system:MARKTVISIE_SYSTEM,messages:[{role:"user",content:MARKTVISIE_USER(intelMetBreaking,labels,crossAsset)}]})
          });
        }
        if(visieRes.ok) {
          const visieData = await visieRes.json();
          const visieText = visieData.content?.filter(b=>b.type==="text").map(b=>b.text).join("") || "";
          const visieParsed = JSON.parse(visieText.replace(/```json|```/g,"").trim());
          setMarktvisie(visieParsed);
          // Sla marktvisie op in iResult zodat analyse hem kan gebruiken
          intelResult = {...intelResult, marktvisie: visieParsed};
          setIResult(prev => prev ? {...prev, marktvisie: visieParsed} : prev);
        }
      } catch(e) { console.error("Marktvisie fout:", e); }
    }

    // ── Stap 3: Analyse — 3 sec pauze om rate limit te voorkomen ──────────────
    await new Promise(r=>setTimeout(r,3000));
    setHybridStatus("analyse"); setLoadingSteps(s=>[...s,"📊 Asset analyse — bias & confidence berekenen"]);
    await runAnalysis();

    // ── Stap 4: Sessie breakdown — 3 sec pauze ──────────────────────────────────
    await new Promise(r=>setTimeout(r,3000));
    setHybridStatus("sessie"); setLoadingSteps(s=>[...s,"📅 Sessie breakdown — intraday context"]);
    await runPresession();

    setHybridStatus("done");
    setLastRefresh(new Date());
    // Herstart auto-refresh als het aan stond
    if(autoRefresh) setTimeout(() => startAutoRefresh(), 5000);
    setTimeout(() => setHybridStatus("idle"), 4000);
  };
  const loading = aStatus==="loading"||iStatus==="loading";

  const RELEVANT_ASSETS = assets.flatMap(a=>[a.label,a.id]);
  const parseTime = t => { if(!t) return 0; const m=String(t).match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1])*60+parseInt(m[2]) : 0; };
  const calendarItems = (iResult?.economic_calendar||[]).slice().sort((a,b)=>{
    const dayOrder = {today:0,tomorrow:1,day_after:2};
    const da = dayOrder[a.date]??0, db = dayOrder[b.date]??0;
    if(da!==db) return da-db;
    return parseTime(a.time)-parseTime(b.time);
  });
  const newsItems = (iResult?.news_items||[]).map(n=>({...n,assets_affected:(n.assets_affected||[]).filter(a=>RELEVANT_ASSETS.some(r=>a.includes(r)||r.includes(a)))})).slice().sort((a,b)=>parseTime(b.time)-parseTime(a.time));
  const filteredCal  = calendarItems.filter(e=>(calFilter==="all"||e.impact===calFilter)&&(calDayFilter==="all"||e.date===calDayFilter));
  const filteredNews = calFilter==="all" ? newsItems : newsItems.filter(n=>n.impact===calFilter);

  const moodColor = (m) => { if(!m) return "var(--t2)"; const l=m.toLowerCase(); if(l.includes("bull")) return "#22c55e"; if(l.includes("bear")) return "#ef4444"; if(l.includes("chop")||l.includes("vol")) return accent; return "var(--t2)"; };

  // Time since last refresh
  const timeSinceRefresh = lastRefresh ? (() => {
    const diff = Math.floor((Date.now() - lastRefresh) / 1000);
    if(diff < 60) return `${diff}s geleden`;
    if(diff < 3600) return `${Math.floor(diff/60)}m geleden`;
    return `${Math.floor(diff/3600)}u geleden`;
  })() : null;

  const isRunning = hybridStatus!=="idle"&&hybridStatus!=="done";

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",fontFamily:"var(--sans)",color:"var(--t1)",display:"flex"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        :root {
          --bg:   #060608;
          --bg1:  #0d0d10;
          --bg2:  #111116;
          --bg3:  #16161c;
          --line: rgba(255,255,255,0.06);
          --line2:rgba(255,255,255,0.10);
          --t1:   #e2e4e9;
          --t2:   #9ca3af;
          --t3:   #374151;
          --acc:  ${accent};
          --red:  #ef4444;
          --grn:  #22c55e;
          --mono: 'JetBrains Mono', monospace;
          --sans: 'Syne', system-ui, sans-serif;
        }
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{background:var(--bg);color:var(--t1);font-family:var(--sans)}
        ::-webkit-scrollbar{width:3px;background:transparent}
        ::-webkit-scrollbar-thumb{background:#1f2023;border-radius:4px}
        button{cursor:pointer;font-family:var(--sans)}
        button{transition:all 0.18s cubic-bezier(0.4,0,0.2,1)!important}
        button:hover:not(:disabled){filter:brightness(1.2)}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes pulseDot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.7}}
        @keyframes pageIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
        @keyframes deepIn{from{opacity:0;transform:translateY(32px) scale(0.97)}to{opacity:1;transform:none}}
        @keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}
        .page-in{animation:pageIn 0.35s cubic-bezier(0.4,0,0.2,1) both}
        .card-in{animation:cardIn 0.4s cubic-bezier(0.4,0,0.2,1) both}
        .deep-in{animation:deepIn 0.38s cubic-bezier(0.16,1,0.3,1) both}
        .row-hover{transition:background 0.15s}
        .row-hover:hover{background:rgba(255,255,255,0.03)!important}
        .nav-btn{transition:color 0.12s,background 0.12s;border-radius:8px}
        .nav-btn:hover{background:rgba(255,255,255,0.04)!important;color:var(--t1)!important}
        .action-btn{transition:all 0.15s ease}
        .action-btn:hover:not(:disabled){filter:brightness(1.15);transform:translateY(-1px)}
        .card-hover{transition:transform 0.2s ease,box-shadow 0.2s ease,border-color 0.2s ease}
        .card-hover:hover{transform:translateY(-3px)!important;box-shadow:0 12px 40px rgba(0,0,0,0.5)!important}
        .live-dot{animation:dot 2.2s ease-in-out infinite}
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{width:240,minHeight:"100vh",background:"#0a0a0d",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",position:"fixed",left:0,top:0,zIndex:100}}>

        {/* Wordmark */}
        <div style={{padding:"18px 16px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{fontFamily:"var(--sans)",fontSize:15,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.02em",lineHeight:1}}>
            Hybrid<span style={{color:accent}}>Trader</span>
          </div>
          <div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",letterSpacing:"0.14em",marginTop:4}}>DASHBOARD</div>
        </div>

        {/* Nav */}
        <div style={{padding:"10px 8px",flex:1,display:"flex",flexDirection:"column",gap:2}}>
          <div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--t3)",letterSpacing:"0.16em",padding:"4px 8px 6px"}}>NAVIGATIE</div>
          {[
            {id:"home",    label:"Home",    sub:"Dashboard",
              icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.5"/><path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.5"/></svg>},
            {id:"analyse", label:"Analyse", sub:"Bias & Confidence",
              icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5"/></svg>},
            {id:"intel",   label:"Intel",   sub:"Nieuws & Macro",
              icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>},
            {id:"calendar",label:"Tools",   sub:"Links & Kalender",
              icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" stroke="currentColor" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>},
          ].map(({id,label,sub,icon})=>(
            <button key={id} onClick={()=>switchPage(id)} className="nav-btn"
              style={{width:"100%",border:"none",background:page===id?`${accent}15`:"transparent",color:page===id?accent:"var(--t3)",display:"flex",alignItems:"center",gap:9,padding:"8px 10px",cursor:"pointer",textAlign:"left",borderLeft:page===id?`2px solid ${accent}`:"2px solid transparent",transition:"all 0.15s"}}>
              <div style={{flexShrink:0,opacity:page===id?1:0.5,color:page===id?accent:"var(--t2)"}}>{icon}</div>
              <div>
                <div style={{fontSize:12,fontWeight:page===id?700:400,color:page===id?"var(--t1)":"var(--t2)",lineHeight:1.2}}>{label}</div>
                <div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",marginTop:2}}>{sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Status + bias overview */}
        <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:loading?accent:aResult?"var(--grn)":"var(--t3)",animation:loading?"blink 1s infinite":"none",flexShrink:0}}/>
            <span style={{fontFamily:"var(--mono)",fontSize:8,color:loading?accent:aResult?"var(--grn)":"var(--t3)",letterSpacing:"0.1em"}}>{loading?"RUNNING":aResult?"LIVE":"STANDBY"}</span>
            {lastRefresh&&<span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",marginLeft:"auto"}}>{timeSinceRefresh}</span>}
          </div>
          {aResult&&(
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:2}}>BIAS OVERZICHT</div>
              {assets.map(a=>{
                const d = aResult.assets?.[a.id];
                if(!d) return null;
                const bias = resolveBias(d.bias,d.confidence);
                const bc = biasColors[bias]||biasColors.Neutraal;
                return (
                  <div key={a.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)"}}>{a.label}</span>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontFamily:"var(--mono)",fontSize:8,fontWeight:700,color:bc.text}}>{bias?.toUpperCase().slice(0,4)||"—"}</span>
                      <span style={{fontFamily:"var(--mono)",fontSize:8,color:accent}}>{d.confidence}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* ── MAIN CONTENT AREA ── */}
      <div style={{marginLeft:240,flex:1,display:"flex",flexDirection:"column",minHeight:"100vh",background:"var(--bg)"}}>

      {/* ── HEADER ── */}
      <div style={{borderBottom:"1px solid var(--line)",padding:"0 28px",height:56,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"rgba(6,6,8,0.95)",backdropFilter:"blur(12px)",zIndex:50}}>
        {/* Left: title + status */}
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div>
              <div style={{fontSize:16,fontWeight:800,letterSpacing:"-0.02em",lineHeight:1,color:"#e2e4e9"}}>
                Hybrid<span style={{color:accent}}>Trader</span>
                {page!=="home"&&<span style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.14em",fontFamily:"var(--mono)",marginLeft:10,verticalAlign:"middle"}}>{page==="analyse"?"ANALYSE":page==="intel"?"INTEL":"TOOLS"}</span>}
              </div>
              <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.12em",marginTop:2,fontFamily:"var(--mono)"}}>
                {loading ? <span style={{color:accent,animation:"blink 1s infinite"}}>● RUNNING...</span>
                  : aResult ? <span style={{color:"#22c55e"}}>● LIVE {lastRefresh?"· "+timeSinceRefresh:""}</span>
                  : <span>● STANDBY</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Right: add pair + run button */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {(page==="analyse"||page==="home") ? (
            <div style={{display:"flex",gap:6}}>
              <button onClick={runHybrid} disabled={isRunning}
                style={{background:isRunning?`${accent}22`:`linear-gradient(135deg,${accent},${accent}cc)`,border:"none",borderRadius:8,padding:"8px 18px",color:isRunning?accent:"#000",fontWeight:700,fontSize:11,letterSpacing:"0.06em",fontFamily:"var(--mono)",display:"flex",alignItems:"center",gap:7,opacity:isRunning?0.8:1}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{animation:isRunning?"spin 1s linear infinite":"none"}}>{isRunning?<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>:<path d="M8 5l11 7-11 7V5z" fill="currentColor"/>}</svg>
                {hybridStatus==="intel"?"1/4 NIEUWS":hybridStatus==="marktvisie"?"2/4 VISIE":hybridStatus==="analyse"?"3/4 ANALYSE":hybridStatus==="sessie"?"4/4 SESSIE":hybridStatus==="done"?"KLAAR":"HYBRID ANALYSE"}
              </button>
              <button onClick={runAnalysis} disabled={aStatus==="loading"} title="Alleen analyse"
                style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"8px 12px",color:"var(--t3)",fontSize:11,fontWeight:600,fontFamily:"var(--mono)",display:"flex",alignItems:"center",gap:5}}>
                SESSIE
              </button>
            </div>
          ) : page==="intel"
            ? <button onClick={runIntel} disabled={iStatus==="loading"} style={{background:`linear-gradient(135deg,${accent},${accent}cc)`,border:"none",borderRadius:8,padding:"8px 18px",color:"#000",fontWeight:700,fontSize:11,display:"flex",alignItems:"center",gap:7}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{animation:iStatus==="loading"?"spin 1s linear infinite":"none"}}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                {iStatus==="loading"?`LADEN${".".repeat(dots)}`:"INTEL LADEN"}
              </button>
            : <button onClick={runIntel} disabled={iStatus==="loading"} style={{background:`linear-gradient(135deg,${accent},${accent}cc)`,border:"none",borderRadius:8,padding:"8px 18px",color:"#000",fontWeight:700,fontSize:11,display:"flex",alignItems:"center",gap:7}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                KALENDER
              </button>
          }
        </div>
      </div>

      {/* ── LOADING OVERLAY ── */}
      {isRunning&&(
        <div style={{position:"fixed",inset:0,marginLeft:240,background:"rgba(6,6,8,0.85)",backdropFilter:"blur(4px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#0d0d10",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"32px 40px",minWidth:340,maxWidth:420}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${accent}22`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{animation:"spin 1s linear infinite"}}><path d="M12 2a10 10 0 0 1 10 10" stroke={accent} strokeWidth="2.5" strokeLinecap="round"/></svg>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#e2e4e9"}}>Hybrid Analyse Uitvoeren</div>
                <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)",marginTop:2}}>v6.3 Institutional Flow Edition</div>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {key:"intel",    label:"Nieuws & macro intel ophalen",  step:1},
                {key:"marktvisie",label:"Marktvisie verwerken",          step:2},
                {key:"analyse",  label:"Asset analyse uitvoeren",        step:3},
                {key:"sessie",   label:"Sessie breakdown genereren",     step:4},
              ].map(({key,label,step})=>{
                const steps = ["intel","marktvisie","analyse","sessie"];
                const currentIdx = steps.indexOf(hybridStatus);
                const thisIdx = steps.indexOf(key);
                const done = currentIdx > thisIdx;
                const active = hybridStatus === key;
                return (
                  <div key={key} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,background:active?`${accent}10`:done?"rgba(34,197,94,0.06)":"transparent",border:`1px solid ${active?accent+"30":done?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.04)"}`,transition:"all 0.3s"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:done?"#22c55e":active?accent:"rgba(255,255,255,0.06)",flexShrink:0}}>
                      {done
                        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : active
                        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{animation:"spin 0.8s linear infinite"}}><path d="M12 2a10 10 0 0 1 10 10" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/></svg>
                        : <span style={{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)"}}>{step}</span>
                      }
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:active?600:400,color:done?"#22c55e":active?accent:"var(--t3)"}}>{label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div key={pageKey} className="page-in" style={{padding:"24px 28px",maxWidth:1440,margin:"0 auto",width:"100%"}}>

        {/* HOME PAGE */}
        {page==="home"&&(
          <HomePage
            assets={assets}
            livePrices={livePrices}
            aResult={aResult}
            presession={presession}
            lastRefresh={lastRefresh}
            hybridStatus={hybridStatus}
            onRunHybrid={runHybrid}
            onNavigate={switchPage}
            accent={accent}
            breakingNews={breakingNews}
            rssItems={rssItems}
          />
        )}

        {/* ANALYSE PAGE */}
        {page==="analyse"&&(
          <>
            {aStatus==="error"&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"12px 18px",marginBottom:14,color:"#f87171",fontSize:12}}><span style={{fontWeight:700}}>FOUT — </span>{aError}</div>}

            {/* Macro bar */}
            {aResult&&(
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,padding:"10px 16px",background:"var(--bg2)",border:"1px solid rgba(255,255,255,0.04)",borderRadius:8,alignItems:"center"}}>
                <YieldTooltip regime={aResult.yield_regime} explanation={aResult.yield_regime_explanation}/>
                {(livePrices.DXY||aResult.dxy_change)&&(
                  <InfoTooltip text="Dollar Index — meet de sterkte van de USD tegen een mandje van 6 valuta. Stijgt de DXY? Dan dalen EUR/USD en GBP/USD meestal, en staat Goud onder druk." color="var(--t2)">
                    <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"4px 9px"}}><span style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em"}}>DXY</span><span style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:livePrices.DXY?.direction==="up"?"#22c55e":"#ef4444"}}>{livePrices.DXY?.change||aResult.dxy_change}</span></div>
                  </InfoTooltip>
                )}
                {(livePrices.VIX||aResult.vix_level)&&(
                  <InfoTooltip text="Volatility Index — de angstmeter van de markt. Onder 15 = rustig, 15-25 = normaal, boven 25 = verhoogde onzekerheid, boven 30 = angst/crisis. Hoge VIX = risk-off, laag VIX = risk-on." color="var(--t2)">
                    <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"4px 9px"}}><span style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em"}}>VIX</span><span style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:parseFloat(livePrices.VIX?.price||aResult.vix_level)>20?"#ef4444":"var(--t2)"}}>{livePrices.VIX?.price||aResult.vix_level}</span></div>
                  </InfoTooltip>
                )}
                {(livePrices.US10Y||aResult.us10y)&&(
                  <InfoTooltip text="Amerikaanse 10-jaars rente. Stijgende yields = USD sterker, druk op Goud en groei-aandelen. Dalende yields = risk-on, gunstig voor Goud en tech. Boven 4.5% = restrictief beleid." color="var(--t2)">
                    <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"4px 9px"}}><span style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em"}}>US10Y</span><span style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:accent}}>{livePrices.US10Y?.price||aResult.us10y}</span></div>
                  </InfoTooltip>
                )}
                {aResult.session&&(
                  <InfoTooltip text="Actieve handelssessie. London (07:00-16:00 Amsterdam) = hoogste volume voor EUR/GBP. New York (13:00-22:00 CET) = hoogste volume voor USD-paren en equities. Overlap London/NY (13:00-16:00) = meest volatiel." color="#6366f1">
                    <Badge label={aResult.session.toUpperCase()+" SESSION"} color="#6366f1"/>
                  </InfoTooltip>
                )}
                {aResult.market_context&&<div style={{flex:1,minWidth:140,fontSize:11,color:"var(--t2)"}}>{aResult.market_context}</div>}
                {aResult.timestamp&&<div style={{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>📊 {fmtDT(aResult.timestamp)}</div>}
              </div>
            )}



            {/* FOR YOU — AI Marktbriefing zoals MarketReader */}
            {marktvisie?.macro_samenvatting&&(
              <div style={{marginBottom:14,display:"grid",gridTemplateColumns:"1fr 340px",gap:12}}>
                {/* Linker kolom: macro samenvatting + asset visies */}
                <div style={{background:`${accent}06`,border:`1px solid ${accent}20`,borderRadius:10,padding:"16px 20px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{fontSize:13}}>🧠</span>
                    <div>
                      <div style={{fontSize:10,color:accent,letterSpacing:"0.12em",fontWeight:700}}>AI MARKTBRIEFING</div>
                      <div style={{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)"}}>{fmtDT(marktvisie.marktvisie_tijd||Date.now())}</div>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:"#d1d5db",lineHeight:1.8,marginBottom:12}}>{marktvisie.macro_samenvatting}</div>
                  <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                    <span>📰 NIEUWS CONTEXT PER ASSET</span>
                    <span style={{color:"#2d3748"}}>— gebaseerd op Intel nieuws van {fmtDT(marktvisie.marktvisie_tijd||Date.now())}</span>
                  </div>
                  {/* Per-asset visie — alleen tekst, GEEN bias kleur (want die staat op de kaarten) */}
                  {marktvisie.assets&&(
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {Object.entries(marktvisie.assets).map(([id,v])=>{
                        return (
                          <div key={id} style={{display:"flex",gap:8,alignItems:"flex-start",background:"rgba(255,255,255,0.02)",borderRadius:6,padding:"7px 10px",borderLeft:"2px solid #1f2937"}}>
                            <span style={{fontSize:10,fontWeight:700,color:"var(--t2)",background:"rgba(255,255,255,0.04)",borderRadius:4,padding:"1px 8px",flexShrink:0,minWidth:64,textAlign:"center",fontFamily:"var(--mono)"}}>{id}</span>
                            <span style={{fontSize:10,color:"var(--t2)",lineHeight:1.6,flex:1}}>{v.visie}</span>
                            <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end",flexShrink:0,marginTop:1}}>
                              <span style={{fontSize:8,color:"var(--t3)",background:"rgba(255,255,255,0.03)",borderRadius:3,padding:"1px 5px",letterSpacing:"0.06em",border:"1px solid #1f2937"}}>🤖 AI</span>
                              {v.ingeprijsd&&<span style={{fontSize:8,color:"#f97316",background:"rgba(249,115,22,0.1)",borderRadius:3,padding:"1px 5px"}}>ingeprijsd?</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Rechter kolom: v6.3 correlatie status + high impact events */}
                <div style={{display:"flex",flexDirection:"column",gap:10}}>

                  {/* DXY / Gold correlatie — kern van v6.3 */}
                  {(()=>{
                    const dxy  = livePrices["DXY"];
                    const xau  = livePrices["XAUUSD"];
                    const us10y= livePrices["US10Y"];
                    const vix  = livePrices["VIX"];
                    if(!dxy||!xau) return null;
                    const dxyUp  = dxy.raw  > 0;
                    const xauUp  = xau.raw  > 0;
                    const anomalie = (dxyUp && xauUp) || (!dxyUp && !xauUp);
                    const corrColor = anomalie ? "#f97316" : "#22c55e";
                    const corrLabel = anomalie ? "⚠️ ANOMALIE" : "✓ NORMAAL";
                    const corrText  = anomalie
                      ? (dxyUp ? "DXY↑ + Goud↑ — max confidence 65%" : "DXY↓ + Goud↓ — max confidence 65%")
                      : (dxyUp ? "DXY↑ + Goud↓ — inverse relatie actief" : "DXY↓ + Goud↑ — inverse relatie actief");
                    // Yield regime
                    const yieldsUp = us10y?.raw > 0;
                    let yieldRegime = "";
                    if(dxyUp && xauUp && yieldsUp)  yieldRegime = "Stagflatie-flow";
                    else if(dxyUp && xauUp && !yieldsUp) yieldRegime = "Pure risk-off / safe haven";
                    else if(!dxyUp && xauUp && !yieldsUp) yieldRegime = "Klassieke risk-off";
                    else if(!dxyUp && xauUp && yieldsUp)  yieldRegime = "Inflatie domineert";
                    else yieldRegime = "Normaal macro regime";
                    return (
                      <div style={{background:"var(--bg1)",border:`1px solid ${corrColor}22`,borderRadius:8,padding:"12px 14px"}}>
                        <div style={{fontSize:9,color:"var(--t3)",letterSpacing:"0.1em",marginBottom:8}}>v6.3 CORRELATIE STATUS</div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          <span style={{fontSize:11,fontWeight:700,color:corrColor}}>{corrLabel}</span>
                        </div>
                        <div style={{fontSize:10,color:"var(--t2)",marginBottom:8}}>{corrText}</div>
                        {/* DXY / XAU / US10Y / VIX live */}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                          {[["DXY",dxy],["XAU/USD",xau],["US10Y",us10y],["VIX",vix]].filter(([,v])=>v).map(([label,v])=>(
                            <div key={label} style={{background:"rgba(255,255,255,0.02)",borderRadius:5,padding:"5px 8px"}}>
                              <div style={{fontSize:8,color:"var(--t3)",letterSpacing:"0.08em"}}>{label}</div>
                              <div style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:v.raw>0?"#22c55e":"#ef4444"}}>{v.change}</div>
                            </div>
                          ))}
                        </div>
                        {yieldRegime&&<div style={{fontSize:9,color:"#6366f1",background:"rgba(99,102,241,0.08)",borderRadius:4,padding:"4px 8px"}}>{yieldRegime}</div>}
                      </div>
                    );
                  })()}

                  {/* High impact events vandaag */}
                  {(iResult?.economic_calendar||[]).filter(e=>e.date==="today"&&e.impact==="high").slice(0,5).length>0&&(
                    <div style={{background:"var(--bg1)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 14px"}}>
                      <div style={{fontSize:9,color:"#ef4444",letterSpacing:"0.1em",marginBottom:8}}>🔴 HIGH IMPACT VANDAAG</div>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {(iResult?.economic_calendar||[]).filter(e=>e.date==="today"&&e.impact==="high").slice(0,5).map((e,i)=>(
                          <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
                            <span style={{fontFamily:"var(--mono)",fontSize:10,color:e.actual?accent:"#e5e7eb",fontWeight:700,flexShrink:0}}>{e.time}</span>
                            <span style={{fontSize:10,color:e.actual?"var(--t3)":"#e5e7eb",flex:1}}>{e.event}</span>
                            {e.actual&&<span style={{fontSize:9,fontWeight:700,color:accent,fontFamily:"var(--mono)"}}>{e.actual}</span>}
                            {!e.actual&&<span style={{fontSize:8,color:"var(--t3)"}}>→</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SESSIE BREAKDOWN — 1x, compact, enkel blok */}
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <span style={{fontSize:10,color:"var(--t3)",letterSpacing:"0.12em"}}>SESSIE BREAKDOWN</span>
                  {psStatus==="done"&&presession&&<div style={{width:8,height:8,borderRadius:"50%",background:moodColor(presession.mood),boxShadow:`0 0 6px ${moodColor(presession.mood)}`}}/>}
                  {presession?.analysed_at&&<span style={{fontSize:8,color:"#2d3748",fontFamily:"var(--mono)"}}>{fmtDT(presession.analysed_at)}</span>}
                </div>
                <button onClick={runPresession} disabled={psStatus==="loading"} style={{...btnStyle(psStatus==="loading",accent),padding:"5px 12px",fontSize:9}}>
                  <span style={{display:"inline-block",animation:psStatus==="loading"?"spin 0.8s linear infinite":"none"}}>↺</span>
                  {psStatus==="loading"?`LADEN...`:"↺ SESSIE"}
                </button>
              </div>

              {psStatus==="loading"&&<div style={{background:"var(--bg1)",border:`1px solid ${accent}22`,borderRadius:7,padding:"9px 14px",display:"flex",alignItems:"center",gap:8}}><div style={{width:13,height:13,border:`2px solid ${accent}22`,borderTopColor:accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{fontSize:10,color:accent}}>Sessie data ophalen...</span></div>}

              {psStatus==="done"&&presession&&(
                <div style={{background:"var(--bg1)",border:`1px solid ${accent}18`,borderRadius:7,padding:"9px 14px",display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:moodColor(presession.mood),boxShadow:`0 0 5px ${moodColor(presession.mood)}`}}/>
                    <span style={{fontSize:11,fontWeight:700,color:moodColor(presession.mood)}}>{presession.mood}</span>
                    <span style={{fontSize:9,color:"var(--t3)"}}>{presession.mood_score||""}%</span>
                  </div>
                  {presession.session&&<div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:9,color:"var(--t3)"}}>SESSIE</span><span style={{fontSize:10,fontWeight:600,color:accent,fontFamily:"var(--mono)"}}>{presession.session}</span>{presession.session_time&&<span style={{fontSize:9,color:"var(--t3)"}}>{presession.session_time}</span>}</div>}
                  {presession.volatility_outlook&&<Badge label={presession.volatility_outlook.toUpperCase()} color="var(--t2)"/>}
                  {presession.key_events_today?.slice(0,3).map((e,i)=><Badge key={i} label={e} color={accent}/>)}
                  <span style={{fontSize:10,color:"var(--t2)",flex:1,minWidth:160,lineHeight:1.4}}>{presession.market_narrative}</span>

                </div>
              )}

              {!presession&&psStatus!=="loading"&&(
                <div style={{background:"var(--bg2)",border:"1px solid #1a1b1e",borderRadius:7,padding:"9px 14px",textAlign:"center",color:"#2d3748",fontSize:10}}>
                  Klik BREAKDOWN LADEN voor sessie context
                </div>
              )}
            </div>

            {/* ASSET GRID */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
              {assets.map((asset,i)=>(
                <AssetCard key={asset.id} asset={asset} data={aResult?.assets?.[asset.id]||null} index={i}
                  loading={aStatus==="loading"&&!aResult?.assets?.[asset.id]}
                  updating={refreshingAssets.has(asset.id)}
                  accent={accent} livePrice={livePrices[asset.id]||null}
                  breakingNews={breakingNews}
                  onClick={()=>setDeepAsset({asset, data:aResult?.assets?.[asset.id]})}
                  onUpdate={async(a)=>{ await refreshSingleAsset(a); }}/>
              ))}
            </div>

            {/* BREAKING NEWS + RSS FEED */}
            <div style={{marginTop:8,display:"grid",gridTemplateColumns:"1fr 340px",gap:12}}>
            <div style={{border:"1px solid var(--line)",overflow:"hidden"}}>
              <div style={{padding:"7px 12px",borderBottom:"1px solid var(--line)",display:"flex",alignItems:"center",gap:8,background:"var(--bg2)"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"var(--red)",animation:"dot 2s infinite",flexShrink:0}}/>
                <span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",letterSpacing:"0.14em"}}>BREAKING NEWS</span>
                <span style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--t3)"}}>· Finnhub · Reuters · Bloomberg</span>
                {bnLoading&&<span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}><span style={{animation:"spin 0.8s linear infinite",display:"inline-block"}}>⟳</span></span>}
                {!bnLoading&&<button onClick={fetchBreakingNews} className="action-btn" style={{marginLeft:"auto",background:"none",border:"1px solid var(--line2)",padding:"2px 8px",fontFamily:"var(--mono)",color:"var(--t3)",fontSize:8,letterSpacing:"0.06em"}}>↺</button>}
              </div>
              <div style={{maxHeight:380,overflowY:"auto",display:"flex",flexDirection:"column"}}>
                {breakingNews.length===0&&!bnLoading&&(
                  <div style={{fontFamily:"var(--mono)",color:"var(--t3)",fontSize:9,textAlign:"center",padding:"28px 0",letterSpacing:"0.1em"}}>GEEN NIEUWS GELADEN</div>
                )}
                {[...breakingNews].sort((a,b)=>b.time-a.time).map((n,i)=>{
                  const isHigh = n.impact==="high";
                  const isBull = n.direction==="bullish";
                  const isBear = n.direction==="bearish";
                  const dirCol = isBull?"#22c55e":isBear?"#ef4444":"var(--t3)";
                  return (
                    <div key={i} onClick={()=>setNewsImpact(n)} className="row-hover"
                      style={{display:"flex",alignItems:"stretch",borderBottom:"1px solid var(--line)",cursor:"pointer",background:n.isNew&&i<3?"rgba(224,82,82,0.04)":"transparent"}}>
                      <div style={{width:2,flexShrink:0,background:isBull?"var(--grn)":isBear?"var(--red)":"transparent"}}/>
                      <div style={{flex:1,padding:"9px 11px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                          <span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)"}}>{n.timeStr||fmtDT(n.time)}</span>
                          <span style={{fontFamily:"var(--mono)",fontSize:8,fontWeight:600,color:"var(--t2)",border:"1px solid var(--line2)",padding:"0 4px"}}>{n.source}</span>
                          {isHigh&&<span style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--red)",border:"1px solid rgba(224,82,82,0.35)",padding:"0 3px",letterSpacing:"0.06em"}}>HIGH</span>}
                          {n.isNew&&i<3&&<span style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--grn)",border:"1px solid rgba(51,201,122,0.35)",padding:"0 3px",letterSpacing:"0.06em"}}>NEW</span>}
                          {(isBull||isBear)&&<span style={{fontFamily:"var(--mono)",fontSize:9,color:isBull?"var(--grn)":"var(--red)",marginLeft:"auto"}}>{isBull?"▲":"▼"}</span>}
                        </div>
                        <div style={{fontSize:11,color:"var(--t1)",lineHeight:1.5}}>{n.headline}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",padding:"0 8px",color:"var(--t3)",fontSize:11}}>›</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* RSS FEED */}
            <div style={{border:"1px solid var(--line)",overflow:"hidden",display:"flex",flexDirection:"column"}}>
              <div style={{padding:"7px 12px",borderBottom:"1px solid var(--line)",display:"flex",alignItems:"center",gap:8,background:"var(--bg2)"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#D97706",flexShrink:0,animation:"dot 2s infinite"}}/>
                <span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",letterSpacing:"0.14em"}}>NEWS FEED</span>
                <span style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--t3)"}}>· Reuters · FF · FXStreet</span>
                {rssLoading&&<span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)",marginLeft:"auto",animation:"spin 0.8s linear infinite",display:"inline-block"}}>⟳</span>}
                {!rssLoading&&<button onClick={fetchRssFeeds} className="action-btn" style={{marginLeft:"auto",background:"none",border:"1px solid var(--line2)",padding:"2px 8px",fontFamily:"var(--mono)",color:"var(--t3)",fontSize:8}}>↺</button>}
              </div>
              <div style={{flex:1,overflowY:"auto",maxHeight:380,display:"flex",flexDirection:"column"}}>
                {rssItems.length===0&&!rssLoading&&(
                  <div style={{fontFamily:"var(--mono)",color:"var(--t3)",fontSize:9,textAlign:"center",padding:"28px 0",letterSpacing:"0.1em"}}>LADEN...</div>
                )}
                {rssItems.map((item,i)=>(
                  <div key={i} onClick={()=>item.link&&window.open(item.link,"_blank")} className="row-hover"
                    style={{display:"flex",alignItems:"stretch",borderBottom:"1px solid var(--line)",cursor:"pointer"}}>
                    <div style={{width:2,flexShrink:0,background:"#D97706"}}/>
                    <div style={{flex:1,padding:"8px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                        <span style={{fontFamily:"var(--mono)",fontSize:8,fontWeight:600,color:"#D97706"}}>{item.source}</span>
                        <span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--t3)"}}>{fmtDT(item.time)}</span>
                      </div>
                      <div style={{fontSize:11,color:"var(--t1)",lineHeight:1.5}}>{item.headline}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",padding:"0 8px",color:"var(--t3)",fontSize:12}}>›</div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </>
        )}

        {/* INTEL PAGE */}
        {page==="intel"&&(
          <>
            {iStatus==="error"&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"12px 18px",marginBottom:14,color:"#f87171",fontSize:12}}><span style={{fontWeight:700}}>FOUT — </span>{iError}</div>}
            <MarketIntelPage data={iResult} loading={iStatus==="loading"} onRefresh={runIntel} status={iStatus} dots={dots} onNewsClick={n=>setNewsImpact(n)} accent={accent}/>
          </>
        )}

        {/* CALENDAR PAGE */}
        {page==="calendar"&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:400,gap:24,padding:"40px 20px"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:10}}>📅</div>
              <div style={{fontSize:16,fontWeight:700,color:"#e5e7eb",letterSpacing:"0.08em",marginBottom:6}}>ECONOMISCHE KALENDER</div>
              <div style={{fontSize:12,color:"var(--t3)",maxWidth:400,lineHeight:1.6}}>Bekijk alle high-impact events, verwachte cijfers en historische data direct op ForexFactory.</div>
            </div>
            <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:14,background:"rgba(255,160,0,0.06)",border:"1px solid rgba(255,160,0,0.25)",borderRadius:8,padding:"18px 28px",cursor:"pointer",textDecoration:"none",minWidth:320}}>
              <div style={{width:44,height:44,borderRadius:10,background:"rgba(255,160,0,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🏭</div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#ffa000",letterSpacing:"0.06em",marginBottom:3}}>ForexFactory Calendar</div>
                <div style={{fontSize:11,color:"var(--t2)"}}>forexfactory.com/calendar</div>
              </div>
              <div style={{marginLeft:"auto",color:"var(--t3)",fontSize:16}}>↗</div>
            </a>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
              {[
                {label:"Investing.com", url:"https://www.investing.com/economic-calendar/", emoji:"📊"},
                {label:"DailyFX",       url:"https://www.dailyfx.com/economic-calendar",   emoji:"📈"},
                {label:"Myfxbook",      url:"https://www.myfxbook.com/forex-economic-calendar", emoji:"🗓"},
              ].map(({label,url,emoji})=>(
                <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.03)",border:"1px solid #1f2023",borderRadius:8,padding:"10px 16px",cursor:"pointer",textDecoration:"none"}}>
                  <span style={{fontSize:14}}>{emoji}</span>
                  <span style={{fontSize:11,color:"var(--t2)"}}>{label}</span>
                  <span style={{fontSize:10,color:"var(--t3)",marginLeft:4}}>↗</span>
                </a>
              ))}
            </div>
            <div style={{fontSize:10,color:"var(--t3)",textAlign:"center",maxWidth:380,lineHeight:1.7}}>
              💡 <span style={{color:"var(--t3)"}}>Tip:</span> Intel haalt automatisch high-impact events op in de hybrid analyse.
            </div>
          </div>
        )}
      </div>

      {/* DEEP DIVE */}
      {deepAsset&&(
        <DeepDiveModal
          asset={deepAsset.asset}
          data={deepAsset.data}
          onClose={()=>setDeepAsset(null)}
          onRefreshAsset={()=>refreshSingleAsset(deepAsset.asset)}
          refreshing={deepRefreshing}
          accent={accent}
        />
      )}

      {newsImpact&&(
        <NewsImpactPopup
          news={newsImpact}
          apiKey={apiKey}
          onClose={()=>setNewsImpact(null)}
        />
      )}


      </div>
    </div>
  );
}
// Strip citation tags that AI sometimes adds to headlines
function sanitizeText(text) {
  if(typeof text !== "string") return text;
  return text
    .replace(/<cite[^>]*>/gi, "")
    .replace(/<\/cite>/gi, "")
    .replace(/\[\d+(-\d+)?\]/g, "")
    .trim();
}

function sanitizeIntelResult(obj) {
  if(!obj || typeof obj !== "object") return obj;
  if(Array.isArray(obj)) return obj.map(sanitizeIntelResult);
  const out = {};
  for(const [k,v] of Object.entries(obj)) {
    if(k === "headline" || k === "mini_summary" || k === "analyse_uitgebreid" || k === "desk_view") {
      out[k] = sanitizeText(v);
    } else if(typeof v === "object") {
      out[k] = sanitizeIntelResult(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}


