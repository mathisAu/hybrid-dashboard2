import React, { useState, useEffect, useRef } from "react";

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
const AssetLogo = ({ id, size = 28 }) => {
  const pairs = {
    EURUSD: ["eu", "us"],
    GBPUSD: ["gb", "us"],
    USDJPY: ["us", "jp"],
    USDCHF: ["us", "ch"],
    XAUUSD: ["gold", "us"],
    BTCUSD: ["btc", "us"],
  };

  const assetIcons = {
  XAUUSD: "https://s3-symbol-logo.tradingview.com/metal/gold.svg",
  BTCUSD: "https://s3-symbol-logo.tradingview.com/crypto/XTVCBTC.svg",
  US30: "/logos/dow-30--big.svg",
  US100: "/logos/nasdaq-100--big.svg",
  };

  const icon = assetIcons[id];
  const flags = pairs[id];

  if (icon) {
    return (
      <img
        src={icon}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "#111",
          padding: 3,
        }}
      />
    );
  }

  if (!flags) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "#1f2937",
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        position: "relative",
        width: size + 10,
      }}
    >
      <img
        src={`https://flagcdn.com/w40/${flags[0]}.png`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: "2px solid #0b0c10",
          position: "relative",
          zIndex: 2,
        }}
      />
      <img
        src={`https://flagcdn.com/w40/${flags[1]}.png`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: "2px solid #0b0c10",
          position: "absolute",
          left: size / 2,
        }}
      />
    </div>
  );
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
  // Normalize to correctly-cased key so biasColors lookup always works
  let normalized = bias;
  if (low.includes("bull")) normalized = "Bullish";
  else if (low.includes("bear")) normalized = "Bearish";
  else if (low.includes("neutr")) normalized = "Neutraal";
  else if (low.includes("fragiel")) normalized = "Fragiel";
  // Fragiel logic
  if (low.includes("fragiel") && low.includes("bear")) return confidence >= 70 ? "Bearish" : "Fragiel";
  if (low.includes("fragiel") && low.includes("bull")) return confidence >= 70 ? "Bullish" : "Fragiel";
  if (normalized === "Fragiel" && confidence >= 70) return "Neutraal";
  return normalized;
}

const biasColors = {
  Bullish:  { bg:"rgba(34,197,94,0.08)",  border:"rgba(34,197,94,0.5)",   text:"#86efac" },
  Bearish:  { bg:"rgba(239,68,68,0.08)",  border:"rgba(239,68,68,0.5)",   text:"#fca5a5" },
  Neutraal: { bg:"rgba(75,85,99,0.12)",   border:"rgba(75,85,99,0.35)",   text:"#9ca3af" },
  Fragiel:  { bg:"rgba(8,153,129,0.08)",  border:"rgba(8,153,129,0.35)",  text:"#0dd9b6" },
};
const corrColors  = { Normaal:"#22c55e", Anomalie:"#ef4444", Hersteld:"#089981" };
const yieldColors = { "Risk-On":"#22c55e","Risk-Off":"#ef4444","Stagflatie":"#089981","Neutraal":"#6b7280" };
const impactColor = { high:"#ef4444", medium:"#089981", low:"#4b5563" };
const dirColor    = { bullish:"#22c55e", bearish:"#ef4444", neutraal:"#6b7280", up:"#22c55e", down:"#ef4444" };

// Tooltip with ⓘ icon
function InfoTooltip({ text, color="#6b7280", children }) {
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
        <div style={{position:"fixed",top:pos.top,left:pos.left,transform:"translate(-50%,-100%)",zIndex:9999,background:"#1a1b1e",border:`1px solid ${color}44`,borderRadius:7,padding:"9px 13px",minWidth:200,maxWidth:240,fontSize:11,color:"#d1d5db",lineHeight:1.55,boxShadow:"0 6px 24px rgba(0,0,0,0.6)",pointerEvents:"none"}}>
          {text}
          <div style={{position:"absolute",bottom:-5,left:"50%",transform:"translateX(-50%) rotate(45deg)",width:8,height:8,background:"#1a1b1e",borderRight:`1px solid ${color}44`,borderBottom:`1px solid ${color}44`}}/>
        </div>
      )}
    </div>
  );
}

function Bar({ value, color }) {
  return (
    <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${value}%`,background:color,borderRadius:2,transition:"width 1.2s cubic-bezier(0.4,0,0.2,1)"}}/>
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
        const res = await anthropicFetch({
            model:"claude-sonnet-4-20250514",
            max_tokens:300,
            system:`Je bent een FX/index trading analist. Analyseer het effect van nieuws op de gevraagde markten. Geef altijd JSON terug zonder uitleg. Geen apostrofs.`,
            messages:[{role:"user",content:`Nieuws: "${news.headline}" (bron: ${news.source})

Geef impact op XAU/USD, US30, US100, EUR/USD, GBP/USD. JSON:
{"overall":"bullish|bearish|neutraal|gemengd","pairs":{"XAUUSD":{"impact":"bullish|bearish|neutraal","reden":"max 8 woorden"},"US30":{"impact":"bullish|bearish|neutraal","reden":"max 8 woorden"},"US100":{"impact":"bullish|bearish|neutraal","reden":"max 8 woorden"},"EURUSD":{"impact":"bullish|bearish|neutraal","reden":"max 8 woorden"},"GBPUSD":{"impact":"bullish|bearish|neutraal","reden":"max 8 woorden"}}}`}]
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

  const impactColor = i => i==="bullish"?"#22c55e":i==="bearish"?"#ef4444":"#6b7280";
  const impactIcon  = i => i==="bullish"?"▲":i==="bearish"?"▼":"—";
  const pairs = [
    {id:"XAUUSD",label:"XAU/USD"},{id:"US30",label:"US30"},
    {id:"US100",label:"US100"},{id:"EURUSD",label:"EUR/USD"},{id:"GBPUSD",label:"GBP/USD"}
  ];

  return (
    <div onClick={handleClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#0d0e13",border:"1px solid #1f2023",borderRadius:10,padding:20,maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.8)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,gap:10}}>
          <div style={{fontSize:10,color:"#9ca3af",lineHeight:1.5,flex:1}}>{news.headline}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:16,flexShrink:0,padding:0}}>✕</button>
        </div>
        <div style={{height:1,background:"#1f2023",marginBottom:14}}/>
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
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"#6b7280",width:58,flexShrink:0}}>{label}</span>
                  <span style={{fontSize:13,color:impactColor(r.impact),fontWeight:700,width:16,flexShrink:0}}>{impactIcon(r.impact)}</span>
                  <span style={{fontSize:11,color:"#9ca3af",flex:1}}>{r.reden}</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{marginTop:12,fontSize:9,color:"#4b5563",textAlign:"right"}}>klik buiten popup om te sluiten</div>
      </div>
    </div>
  );
}


function btnStyle(disabled, accent=DEFAULT_ACCENT) {
  return {
    background:disabled?`${accent}11`:`linear-gradient(135deg,${accent}30,${accent}20)`,
    border:`1px solid ${disabled?accent+"33":accent}`,
    borderRadius:6, color:disabled?`${accent}55`:accent,
    fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700,
    letterSpacing:"0.1em", padding:"9px 18px", cursor:disabled?"not-allowed":"pointer",
    display:"flex", alignItems:"center", gap:7,
  };
}

function YieldTooltip({ regime, explanation }) {
  const col = yieldColors[regime] || "#6b7280";
  return (
    <InfoTooltip text={explanation} color={col}>
      <span style={{fontSize:9,padding:"2px 7px",borderRadius:3,border:`1px solid ${col}44`,background:`${col}11`,color:col,letterSpacing:"0.08em",fontWeight:600}}>{regime}</span>
    </InfoTooltip>
  );
}

function DeepDiveModal({ asset, data, onClose, onRefreshAsset, refreshing, accent }) {
  const [closing, setClosing] = React.useState(false);
  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 320);
  };
  const bias = resolveBias(data?.bias, data?.confidence);
  const bc = biasColors[bias] || biasColors.Neutraal;
  const acc = accent || DEFAULT_ACCENT;

  const trendCol = (t) => {
    if (!t) return "#6b7280";
    const l = t.toLowerCase();
    if (l.includes("strong up"))   return "#22c55e";
    if (l.includes("choppy up"))   return "#84cc16";
    if (l.includes("strong down")) return "#ef4444";
    if (l.includes("choppy down")) return "#f97316";
    if (l.includes("compres"))     return "#a855f7";
    return "#6b7280";
  };

  const holdLabel = (h) => {
    if (h >= 80) return { label:"Voluit holden",        color:"#22c55e" };
    if (h >= 70) return { label:"Goede hold",           color:"#84cc16" };
    if (h >= 60) return { label:"Twijfelachtig",        color:"#f59e0b" };
    if (h >= 40) return { label:"Niet holden",          color:"#f97316" };
    return        { label:"Definitief niet holden",     color:"#ef4444" };
  };

  const confLabel = (v) => {
    if (v >= 80) return { label:"Zeer sterke bias", color:"#22c55e" };
    if (v >= 70) return { label:"Sterke bias",      color:"#84cc16" };
    if (v >= 60) return { label:"Redelijke bias",   color:"#f59e0b" };
    if (v >= 50) return { label:"Lichte bias",      color:"#f97316" };
    return        { label:"Niet traden",            color:"#ef4444" };
  };

  const pulseColors = { QUIET:"#4b5563", WAIT:"#f59e0b", TRADABLE:"#22c55e", WILD:"#ef4444" };
  const pulseLabels = ["QUIET","WAIT","TRADABLE","WILD"];
  const pc = pulseColors[data?.pulse] || "#6b7280";
  const pulseIdx = pulseLabels.indexOf(data?.pulse);

  const conf  = data?.confidence || 0;
  const hold  = data?.macro_hold || 0;
  const cInfo = confLabel(conf);
  const hInfo = holdLabel(hold);

  // Section label
  const SectionLabel = ({text, color="#374151", icon}) => (
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
      {icon&&<span style={{fontSize:11}}>{icon}</span>}
      <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.14em",color,fontFamily:"'JetBrains Mono',monospace"}}>{text}</span>
      <div style={{flex:1,height:1,background:`${color}22`,marginLeft:4}}/>
    </div>
  );

  // Card — radial corner glow + conic hover border
  const Card = ({children, style={}, color=acc, onClick}) => {
    const hex = color;
    return (
      <div
        onClick={onClick}
        className="rc-card card-hover"
        style={{
          "--conic-color": hex,
          cursor:onClick?"pointer":"default",
          ...style
        }}
      >
        <div className="conic-border"/>
        <div style={{padding:"16px 18px"}}>{children}</div>
      </div>
    );
  };

  const ThinBar = ({value, max=100, color}) => (
    <div style={{height:3,borderRadius:2,background:"#141414",overflow:"hidden",marginTop:6}}>
      <div style={{height:"100%",width:`${Math.min(100,(value/max)*100)}%`,background:color,borderRadius:2,transition:"width 0.6s ease"}}/>
    </div>
  );

  const StatRow = ({label, value, color="#9ca3af"}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #262626"}}>
      <span style={{fontSize:10,color:"#6b7280"}}>{label}</span>
      <span style={{fontSize:11,fontWeight:700,color,fontFamily:"'JetBrains Mono',monospace"}}>{value||"—"}</span>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:closing?"rgba(0,0,0,0)":"rgba(0,0,0,0.92)",backdropFilter:"blur(10px)",overflowY:"auto",transition:closing?"background 0.3s ease":"none"}}
      onClick={e=>{if(e.target===e.currentTarget)handleClose();}}>
      <div style={{background:"#070708",minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",position:"relative",animation:closing?"slideOut 0.32s cubic-bezier(0.4,0,0.2,1) both":"slideIn 0.55s cubic-bezier(0.4,0,0.2,1) both"}}>

        {/* Deep dive page glow */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
          <div style={{position:"absolute",top:"-20%",left:"15%",width:"70%",height:"65%",background:`radial-gradient(ellipse at center,${acc}1a 0%,transparent 65%)`,filter:"blur(60px)"}}/>
          
          <div style={{position:"absolute",top:"40%",left:"-10%",width:"35%",height:"40%",background:`radial-gradient(ellipse at center,${acc}0e 0%,transparent 65%)`,filter:"blur(65px)"}}/>
        </div>

        {/* Bias color strip */}
        <div style={{height:2,background:`linear-gradient(90deg,transparent,${bc.border} 20%,${bc.border} 80%,transparent)`,position:"relative",zIndex:1}}/>

        {/* ── HEADER ── */}
        <div style={{padding:"18px 32px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,background:"rgba(8,9,14,0.5)",backdropFilter:"blur(20px)",position:"relative",zIndex:2}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <AssetLogo id={asset.id} size={38}/>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3}}>
                <span style={{fontSize:24,fontWeight:800,color:"#f1f2f4",letterSpacing:"-0.02em"}}>{asset.label}</span>
                <span style={{fontSize:11,fontWeight:700,color:bc.text,background:bc.bg,border:`1px solid ${bc.border}`,borderRadius:6,padding:"4px 12px",letterSpacing:"0.08em"}}>{bias?.toUpperCase()}</span>
                {data?.price_direction&&data?.price_change_today&&(
                  <span style={{fontSize:12,fontWeight:700,color:data.price_direction==="up"?"#22c55e":"#ef4444",fontFamily:"'JetBrains Mono',monospace",background:data.price_direction==="up"?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)",borderRadius:5,padding:"3px 10px",border:`1px solid ${data.price_direction==="up"?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.2)"}`}}>
                    {data.price_direction==="up"?"↑":"↓"} {data.price_change_today}
                  </span>
                )}
                {data?.price_today&&<span style={{fontSize:15,fontWeight:600,color:"#6b7280",fontFamily:"'JetBrains Mono',monospace"}}>{data.price_today}</span>}
              </div>
              <div style={{fontSize:11,color:"#4b5563"}}>{asset.full}
                {data?.analysed_at&&<span style={{marginLeft:10,fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:"#1f2937"}}>geanalyseerd {fmtDT(data.analysed_at)}</span>}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onRefreshAsset} disabled={refreshing}
              className="btn-primary btn-always-spin"
              style={{padding:"8px 14px",fontSize:13,color:"#fff",opacity:refreshing?0.6:1,"--btn-glow":`${acc}40`,fontFamily:"'JetBrains Mono',monospace"}}>
              <span style={{display:"inline-block",animation:refreshing?"spin 0.8s linear infinite":"none"}}>↺</span>
            </button>
            <button onClick={onClose}
              className="btn-primary btn-always-spin"
              style={{padding:"8px 18px",fontSize:10,color:"#fff","--btn-glow":`${acc}40`,fontFamily:"'JetBrains Mono',monospace"}}>
              ← TERUG
            </button>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="grid-deepdive page-pad" style={{display:"grid",gap:16,position:"relative",zIndex:1,maxWidth:1500,margin:"0 auto"}}>

          {/* ════ COL 1: SCORES ════ */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <SectionLabel text="SCORES & SIGNALEN" color={acc} icon="📊"/>

            {/* Confidence */}
            <Card color={cInfo.color}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>BIAS CONFIDENCE</span>
                <span style={{fontSize:9,color:cInfo.color,background:`${cInfo.color}15`,borderRadius:4,padding:"2px 7px",fontWeight:600}}>{cInfo.label}</span>
              </div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:44,fontWeight:800,color:cInfo.color,lineHeight:1}}>{conf}%</div>
              <ThinBar value={conf} color={cInfo.color}/>
              {data?.confidence_label&&<div style={{fontSize:10,color:"#6b7280",marginTop:10,lineHeight:1.6,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)"}}>{data.confidence_label}</div>}
            </Card>

            {/* Macro Hold */}
            <Card color="#6366f1">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>MACRO HOLD</span>
                <span style={{fontSize:9,color:hInfo.color,background:`${hInfo.color}15`,borderRadius:4,padding:"2px 7px",fontWeight:600}}>{hInfo.label}</span>
              </div>
              <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:44,fontWeight:800,color:"#6366f1",lineHeight:1}}>{hold}</span>
                <span style={{fontSize:13,color:"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>/100</span>
              </div>
              <ThinBar value={hold} color="#6366f1"/>
              {data?.macro_hold_uitleg&&<div style={{fontSize:10,color:"#6b7280",marginTop:10,lineHeight:1.6,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)"}}>{data.macro_hold_uitleg}</div>}
            </Card>

            {/* Pulse */}
            {data?.pulse&&(
              <Card color={pc} style={{background:`${pc}07`,border:`1px solid ${pc}20`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>PULSE</span>
                  <span style={{fontSize:14,fontWeight:800,color:pc,letterSpacing:"0.06em"}}>{data.pulse}</span>
                </div>
                <div style={{display:"flex",gap:4,marginBottom:10}}>
                  {pulseLabels.map((l,i)=>(
                    <div key={l} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                      <div style={{height:4,width:"100%",borderRadius:2,background:i===pulseIdx?pulseColors[l]:"rgba(255,255,255,0.06)"}}/>
                      <span style={{fontSize:7,color:i===pulseIdx?pulseColors[l]:"#2d3748",letterSpacing:"0.06em",fontFamily:"'JetBrains Mono',monospace"}}>{l}</span>
                    </div>
                  ))}
                </div>
                {data.pulse_reden&&<div style={{fontSize:10,color:"#9ca3af",lineHeight:1.6}}>{data.pulse_reden}</div>}
              </Card>
            )}

            {/* Hold Score opbouw */}
            {data?.macro_alignment!=null&&(
              <Card color="#6366f1">
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>HOLD SCORE OPBOUW</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {l:"Pillar Alignment", v:data?.macro_alignment,   max:40, color:"#22c55e"},
                    {l:"News Timing",      v:data?.pillar_news,       max:25, color:acc},
                    {l:"Cross-Asset",      v:data?.pillar_crossasset, max:20, color:"#6366f1"},
                    {l:"Yield / DXY",      v:data?.pillar_yield,      max:15, color:"#f59e0b"},
                  ].map(({l,v,max,color})=>v!=null&&(
                    <div key={l}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:10,color:"#6b7280"}}>{l}</span>
                        <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:v===max?"#22c55e":v>=max*0.6?"#9ca3af":"#6b7280"}}>{v}<span style={{color:"#2d3748"}}>/{max}</span></span>
                      </div>
                      <ThinBar value={v} max={max} color={v===max?"#22c55e":v>=max*0.6?color:"#f59e0b"}/>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* ════ COL 2: ANALYSE ════ */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <SectionLabel text="MARKTANALYSE" color={acc} icon="🧠"/>

            {/* Uitgebreide analyse */}
            <Card color={acc} style={{background:`linear-gradient(135deg,${acc}07,rgba(99,102,241,0.04))`,border:`1px solid ${acc}18`}}>
              <div style={{fontSize:11,fontWeight:600,color:"#34d399",marginBottom:10}}>✦ Uitgebreide Analyse</div>
              <div style={{fontSize:12,color:"#a8b0bf",lineHeight:1.8,fontWeight:400}}>{data?.analyse_uitgebreid||data?.mini_summary||"—"}</div>
            </Card>

            {/* AI Opinie */}
            {data?.ai_opinie&&(
              <Card color="#6366f1" style={{background:"rgba(99,102,241,0.04)",border:"1px solid rgba(99,102,241,0.12)"}}>
                <div style={{fontSize:11,fontWeight:600,color:"#34d399",marginBottom:8}}>✦ AI Opinie</div>
                <div style={{fontSize:12,color:"#a8b0bf",lineHeight:1.8,fontStyle:"italic",borderLeft:"2px solid #34d39940",paddingLeft:12}}>{data.ai_opinie}</div>
              </Card>
            )}

            {/* Compact technische stats balk */}
            {(()=>{
              const tl = (data?.technical_trend||"").toLowerCase();
              const trendIsUp   = tl.includes("up")   || tl.includes("bull");
              const trendIsDown = tl.includes("down")  || tl.includes("bear");
              const trendColor  = trendIsUp?"#22c55e":trendIsDown?"#ef4444":trendCol(data?.technical_trend);
              const trendArrow  = trendIsUp?"↑":trendIsDown?"↓":"→";
              const yc = yieldColors[data?.yield_regime]||corrColors[data?.correlatie_status]||"#6b7280";
              const yLabel = data?.yield_regime&&data.yield_regime!=="n.v.t."?data.yield_regime:data?.correlatie_status||"—";
              const yKey   = data?.yield_regime&&data.yield_regime!=="n.v.t."?"YIELD":"CORR";
              const stats = [
                { key:"TREND",     value:data?.technical_trend||"—",           color:trendColor, prefix:trendArrow },
                { key:"STRUCTUUR", value:data?.intraday_structuur||"—",         color:"#9ca3af" },
                { key:"REGIME",    value:data?.market_regime?.toUpperCase()||"—",color:"#6366f1" },
                { key:yKey,        value:yLabel,                                 color:yc, dot:true },
              ];
              return (
                <div style={{background:"#0c0d10",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"14px 18px",display:"flex",gap:0}}>
                  {stats.map((s,i)=>(
                    <div key={s.key} style={{flex:1,paddingLeft:i===0?0:16,marginLeft:i===0?0:16,borderLeft:i===0?"none":"1px solid rgba(255,255,255,0.06)"}}>
                      <div style={{fontSize:8,fontWeight:700,letterSpacing:"0.12em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:6}}>{s.key}</div>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        {s.dot&&<div style={{width:6,height:6,borderRadius:"50%",background:s.color,flexShrink:0}}/>}
                        {s.prefix&&<span style={{fontSize:13,fontWeight:800,color:s.color}}>{s.prefix}</span>}
                        <span style={{fontSize:11,fontWeight:700,color:s.color,lineHeight:1.3}}>{s.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Fail condition */}
            {data?.fail_condition&&(
              <Card color="#ef4444" style={{background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.18)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                  <span style={{fontSize:11}}>⚠️</span>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>FAIL CONDITION</span>
                </div>
                <div style={{fontSize:12,color:"#fca5a5",lineHeight:1.7}}>{data.fail_condition}</div>
              </Card>
            )}

            {/* Bias switch history */}
            {data?.bias_switch_history?.length>0&&(
              <Card color="#f97316" style={{background:"rgba(249,115,22,0.03)",border:"1px solid rgba(249,115,22,0.12)"}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#f97316",fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>BIAS SWITCH GESCHIEDENIS</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {data.bias_switch_history.map((s,i)=>{
                    const vanC = biasColors[s.van]||biasColors.Neutraal;
                    const naarC = biasColors[s.naar]||biasColors.Neutraal;
                    return (
                      <div key={i} style={{paddingBottom:i<data.bias_switch_history.length-1?10:0,borderBottom:i<data.bias_switch_history.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
                          <span style={{fontSize:8,color:"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>{fmtDT(s.time)}</span>
                          <span style={{fontSize:10,fontWeight:700,color:vanC.text,background:vanC.bg,border:`1px solid ${vanC.border}33`,borderRadius:4,padding:"1px 7px"}}>{s.van}</span>
                          <span style={{fontSize:10,color:"#4b5563"}}>→</span>
                          <span style={{fontSize:10,fontWeight:700,color:naarC.text,background:naarC.bg,border:`1px solid ${naarC.border}33`,borderRadius:4,padding:"1px 7px"}}>{s.naar}</span>
                          <span style={{fontSize:9,color:"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>{s.confidence}%</span>
                        </div>
                        {s.nieuws?.map((n,j)=>(
                          <div key={j} style={{display:"flex",gap:5,alignItems:"flex-start",marginLeft:4}}>
                            <span style={{fontSize:8,color:"#6b7280",flexShrink:0}}>[{n.source}]</span>
                            <span style={{fontSize:10,color:"#6b7280",lineHeight:1.4}}>{n.headline}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* ════ COL 3: CONTEXT ════ */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <SectionLabel text="MARKT CONTEXT" color="#9ca3af" icon="🔍"/>

            {/* Dominant mechanisme */}
            <Card color={acc}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:10}}>DOMINANT MECHANISME</div>
              <div style={{fontSize:12,color:"#d1d5db",lineHeight:1.7}}>{data?.dominant_mechanisme||"—"}</div>
            </Card>

            {/* Trend driver */}
            <Card color="#f59e0b">
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:10}}>TREND DRIVER</div>
              <div style={{fontSize:13,fontWeight:700,color:"#f59e0b",letterSpacing:"0.02em",lineHeight:1.4}}>{data?.trend_driver?.toUpperCase()||"—"}</div>
            </Card>

            {/* Correlatie (only if yield shown in col2) */}
            {data?.yield_regime&&data.yield_regime!=="n.v.t."&&data?.correlatie_status&&(
              <Card color={corrColors[data.correlatie_status]||"#6b7280"}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:10}}>CORRELATIE</div>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:corrColors[data.correlatie_status]||"#6b7280"}}/>
                  <div style={{fontSize:13,fontWeight:700,color:corrColors[data.correlatie_status]||"#9ca3af"}}>{data.correlatie_status}</div>
                </div>
                {data?.correlatie_uitleg&&<div style={{fontSize:10,color:"#6b7280",lineHeight:1.6,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.05)"}}>{data.correlatie_uitleg}</div>}
              </Card>
            )}

            {/* Relevant news */}
            {data?.news_items?.length>0&&(
              <Card color="#f59e0b">
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>RELEVANT NIEUWS</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.news_items.slice(0,5).map((n,i)=>(
                    <div key={i}
                      onClick={()=>n.url&&window.open(n.url,"_blank")}
                      style={{display:"flex",flexDirection:"column",gap:3,paddingBottom:i<Math.min(4,data.news_items.length-1)?8:0,borderBottom:i<Math.min(4,data.news_items.length-1)?"1px solid rgba(255,255,255,0.04)":"none",cursor:n.url?"pointer":"default"}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        {n.source&&<span style={{fontSize:8,fontWeight:700,color:"#6b7280",background:"rgba(255,255,255,0.05)",borderRadius:3,padding:"1px 5px"}}>{n.source}</span>}
                        {n.time&&<span style={{fontSize:8,color:"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>{n.time}</span>}
                        <span style={{marginLeft:"auto",fontSize:10,color:dirColor[n.direction]||"#6b7280",fontWeight:700}}>{n.direction==="bullish"?"▲":n.direction==="bearish"?"▼":"—"}</span>
                      </div>
                      <div style={{fontSize:10,color:"#c9cdd4",lineHeight:1.5}}>{n.headline}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function ConfidenceBar({ value, color, animated=true }) {
  return (
    <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.05)",overflow:"hidden",position:"relative"}}>
      <div className={animated?"confidence-bar":""} style={{height:"100%",width:`${Math.min(100,value||0)}%`,background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:2}}/>
    </div>
  );
}

function PulseBadge({ pulse }) {
  const cfg = {
    QUIET:    {color:"#6b7280",bg:"rgba(75,85,99,0.15)",   dot:"#4b5563",  label:"QUIET"},
    WAIT:     {color:"#f59e0b",bg:"rgba(245,158,11,0.12)", dot:"#f59e0b",  label:"WAIT"},
    TRADABLE: {color:"#22c55e",bg:"rgba(34,197,94,0.12)",  dot:"#22c55e",  label:"TRADABLE"},
    WILD:     {color:"#ef4444",bg:"rgba(239,68,68,0.12)",  dot:"#ef4444",  label:"WILD"},
  };
  const c = cfg[pulse] || cfg.WAIT;
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,background:c.bg,border:`1px solid ${c.color}30`,borderRadius:4,padding:"2px 8px"}}>
      <div style={{width:5,height:5,borderRadius:"50%",background:c.dot,animation:"pulseDot 2s ease-in-out infinite"}}/>
      <span style={{fontSize:9,fontWeight:700,color:c.color,letterSpacing:"0.1em"}}>{c.label}</span>
    </div>
  );
}

function AssetCard({ asset, data, index, loading, updating: updatingProp, onClick, onUpdate, accent, livePrice, breakingNews }) {
  const [vis, setVis] = useState(false);
  const [updatingLocal, setUpdatingLocal] = useState(false);
  const updating = updatingProp || updatingLocal;
  const acc = accent || DEFAULT_ACCENT;
  const meta = ASSET_META[asset.id] || {};

  useEffect(()=>{const t=setTimeout(()=>setVis(true),index*90);return()=>clearTimeout(t);},[data,loading]);

  const bias = resolveBias(data?.bias, data?.confidence);
  const c = biasColors[bias] || biasColors.Neutraal;
  const rawPrice  = livePrice?.price  || data?.price_today        || null;
  const rawChange = livePrice?.change || data?.price_change_today || null;
  const displayPrice  = rawPrice  && parseFloat(rawPrice)  > 0 ? rawPrice  : null;
  const displayChange = rawChange && rawChange !== "+0.00%" && rawChange !== "-0.00%" ? rawChange : null;
  const priceUp = livePrice ? livePrice.direction === "up" : data?.price_direction === "up";

  const handleUpdate = async (e) => {
    e.stopPropagation();
    if(updating || !onUpdate) return;
    setUpdatingLocal(true);
    try { await onUpdate(asset); } catch(_) {}
    setUpdatingLocal(false);
  };

  const conf = data?.confidence || 0;
  const hold = data?.macro_hold || 0;

  return (
    <div
      onClick={data ? onClick : undefined}
      className="rc-card card-hover"
      style={{
        "--conic-color": c.border||accent,
        opacity:vis?1:0,
        transform:vis?"translateY(0)":"translateY(16px)",
        transition:"opacity 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1)",
        cursor:data?"pointer":"default",
      }}
    >
      <div className="conic-border"/>
      <div style={{padding:"16px 18px"}}>
        {/* Header row */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <AssetLogo id={asset.id} size={28}/>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#f0f2f8",letterSpacing:"-.01em",marginBottom:2}}>{asset.label}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {displayPrice&&<span style={{fontSize:12,fontWeight:500,color:"#6b7280"}}>{displayPrice}</span>}
                <span style={{fontSize:10,color:"#444"}}>{asset.full}</span>
              </div>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            {data?.bias ? (
              <div style={{display:"flex",alignItems:"center",gap:5,background:`${c.border}14`,border:`1px solid ${c.border}33`,borderRadius:4,padding:"3px 9px"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:c.border}}/>
                <span style={{fontSize:10,fontWeight:600,color:c.border,letterSpacing:"0.04em"}}>{bias}</span>
              </div>
            ) : loading ? <div style={{width:80,height:24,borderRadius:6,background:"rgba(255,255,255,0.04)",animation:"pulse 1.5s ease-in-out infinite"}}/> : null}
          </div>
        </div>

        {data ? (
          <>
            {/* Confidence bar */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{fontSize:11,color:"#555",fontWeight:400}}>Confidence</span>
                <span style={{fontSize:11,fontWeight:600,color:"#9aa5bc"}}>{conf}%</span>
              </div>
              <div style={{height:4,background:"#141414",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${conf}%`,background:"#22c55e",borderRadius:2,transition:"width 0.6s ease"}}/>
              </div>
            </div>

            {/* Hold bar */}
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{fontSize:11,color:"#555",fontWeight:400}}>Hold</span>
                <span style={{fontSize:11,fontWeight:600,color:"#9aa5bc"}}>{hold}/100</span>
              </div>
              <div style={{height:4,background:"#141414",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${hold}%`,background:"linear-gradient(90deg,#4ade80,#86efac)",borderRadius:2,transition:"width 0.6s ease"}}/>
              </div>
            </div>

            {/* AI Summary inner box */}
            <div className="ai-inner-box">
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:7}}>
                <span style={{fontSize:10,color:"#34d399"}}>✦</span>
                <span style={{fontSize:11,fontWeight:600,color:"#34d399"}}>AI Analysis</span>
              </div>
              <div style={{fontSize:11,color:"#a8b0bf",lineHeight:1.7}}>{data.mini_summary||"—"}</div>
            </div>

            {/* Deep Dive CTA */}
            <div style={{marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:10,color:"#4b5563"}}>Geanalyseerd {data.analysed_at?fmtTime(data.analysed_at):"—"}</span>
              <div style={{display:"flex",alignItems:"center",gap:4,color:acc,fontSize:10,fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </>
        ) : loading ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[85,65,100,55,75].map((w,i)=><Skeleton key={i} w={`${w}%`}/>)}
          </div>
        ) : (
          <div style={{textAlign:"center",padding:"28px 0",color:"#2d3139",fontSize:11,letterSpacing:"0.08em"}}>KLIK ANALYSE UITVOEREN</div>
        )}
      </div>
    </div>
  );
}

function MarketIntelPage({ data, loading, onRefresh, onRunHybrid, status, dots, onNewsClick, accent, rssItems, rssLoading, onRefreshRss }) {
  const [showFlash, setShowFlash] = React.useState(false);
  const acc = accent || "#089981";
  if (!data && !loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Hero — no box */}
      <div style={{padding:"8px 0 4px",position:"relative"}}>
        <div style={{position:"absolute",top:-40,right:0,width:320,height:200,borderRadius:"50%",background:`radial-gradient(circle,${acc}0f,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.18em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:14}}>MARKET INTEL · POWERED BY AI</div>
          <div style={{fontSize:26,fontWeight:800,color:"#f1f2f4",letterSpacing:"-0.02em",marginBottom:10,lineHeight:1.2}}>
            Live marktdata<br/><span style={{color:acc}}>nog niet geladen</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div style={{fontSize:13,color:"#e2e4e9",lineHeight:1.7,maxWidth:480}}>
              Intel haalt real-time nieuws, macro regime, yield analyse en cross-asset signalen op via AI web search.
            </div>
            <button onClick={onRunHybrid} className="btn-primary btn-always-spin" style={{padding:"11px 28px",fontSize:12,color:"#fff","--btn-glow":`${acc}40`,flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg>
              HYBRID LADEN
            </button>
          </div>
        </div>
      </div>

      {/* What intel loads */}
      <div className="grid-nav" style={{display:"grid",gap:12}}>
        {[
          {icon:"📰", title:"Nieuws & Events",     desc:"Breaking news, macro events en katalysatoren die de markt bewegen vandaag.",          color:acc},
          {icon:"📊", title:"Macro Regime",         desc:"Yield curve analyse, DXY regime, VIX niveau en risk-on/off classificatie.",           color:"#6366f1"},
          {icon:"⚡", title:"Cross-Asset Signalen", desc:"Correlaties tussen Gold, indices en forex. Divergenties en flow-shifts detecteren.",   color:"#f59e0b"},
        ].map(({icon,title,desc,color})=>(
          <div key={title} style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"20px",boxShadow:"0 2px 14px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.04)"}}>
            <div style={{fontSize:22,marginBottom:10}}>{icon}</div>
            <div style={{fontSize:12,fontWeight:700,color:"#e2e4e9",marginBottom:6}}>{title}</div>
            <div style={{fontSize:11,color:"#e2e4e9",lineHeight:1.6}}>{desc}</div>
            <div style={{height:2,borderRadius:1,background:`${color}22`,marginTop:14}}/>
          </div>
        ))}
      </div>

      {/* Ghost preview cards */}
      <div className="grid-2col" style={{display:"grid",gap:12}}>
        {[
          {label:"MACRO REGIME",    w:"60%"},
          {label:"YIELD CURVE",     w:"45%"},
          {label:"BREAKING NIEUWS", w:"80%"},
          {label:"MARKET SNAPSHOT", w:"55%"},
        ].map(({label,w})=>(
          <div key={label} style={{background:"#0d0e13",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,padding:"16px 18px"}}>
            <div style={{fontSize:8,fontWeight:700,letterSpacing:"0.14em",color:"#2d3748",fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>{label}</div>
            <div style={{height:8,borderRadius:4,background:"rgba(255,255,255,0.04)",marginBottom:8,width:w}}/>
            <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.03)",marginBottom:6,width:"90%"}}/>
            <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.03)",width:"70%"}}/>
          </div>
        ))}
      </div>

    </div>
  );
  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:16,paddingTop:20}}>
      {[1,2,3].map(i=><div key={i} style={{background:"#0d0e13",borderRadius:8,padding:18}}>{[100,80,60,90,70].map((w,j)=><Skeleton key={j} w={`${w}%`} h={j===0?12:8}/>)}</div>)}
    </div>
  );

  const snap = data.market_snapshot || {};
  const snapLabels = {gold:"GOLD",us30:"US30",us100:"US100",eurusd:"EUR/USD",gbpusd:"GBP/USD"};

  const allNews    = [...(data.news_items||[])].sort((a,b)=>{
    const t = s=>{const m=String(s||"").match(/(\d{1,2}):(\d{2})/);return m?parseInt(m[1])*60+parseInt(m[2]):0;};
    return t(b.time)-t(a.time);
  });
  const highNews   = allNews.filter(n=>n.impact==="high");
  const normalNews = allNews.filter(n=>n.impact!=="high");

  const NewsItem = ({n}) => (
    <div onClick={()=>onNewsClick&&onNewsClick({headline:n.headline,source:n.source,url:n.url})}
      style={{padding:"6px 10px",borderRadius:6,background:"#0f0f11",border:"1px solid #1e1e22",cursor:"pointer",transition:"background 0.15s"}}
      onMouseEnter={e=>e.currentTarget.style.background="#161618"}
      onMouseLeave={e=>e.currentTarget.style.background="#0f0f11"}>
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap",minWidth:0,overflow:"hidden"}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#8a8f9a",fontWeight:600}}>{n.time||"—"}</span>
        <Badge label={n.source} color="#8a8f9a"/>
        <Badge label={n.category} color="#6366f1"/>
        {n.impact==="high"&&<Badge label="HIGH" color="#ef4444"/>}
        <span style={{fontSize:10,fontWeight:600,color:dirColor[n.direction]||"#f0f1f3",marginLeft:"auto"}}>
          {n.direction==="bullish"?"▲ Bullish":n.direction==="bearish"?"▼ Bearish":"—"}
        </span>
      </div>
      <div style={{fontSize:10,color:"#e2e4e9",lineHeight:1.45,fontWeight:400}}>{n.headline}</div>
      {n.assets_affected&&n.assets_affected.length>0&&(
        <div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:4}}>
          {n.assets_affected.map(a=><Badge key={a} label={a} color="#252525"/>)}
        </div>
      )}
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* ── FLASH TICKER + DEEP DIVE ── */}
      {(rssItems||[]).length>0&&(
        <>
          {/* Ticker bar */}
          {!showFlash&&(
            <div style={{background:"rgba(10,10,12,0.7)",backdropFilter:"blur(10px)",border:`1px solid ${acc}22`,borderRadius:8,overflow:"hidden",display:"flex",alignItems:"center",height:28}}>
              <button onClick={()=>setShowFlash(true)} style={{flexShrink:0,padding:"0 10px",borderRight:`1px solid ${acc}22`,display:"flex",alignItems:"center",gap:5,background:"none",border:"none",cursor:"pointer"}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:"#f59e0b",animation:"pulseDot 2s ease-in-out infinite"}}/>
                <span style={{fontSize:8,fontWeight:700,letterSpacing:"0.14em",color:"#f59e0b",whiteSpace:"nowrap"}}>FLASH ›</span>
              </button>
              <div style={{flex:1,overflow:"hidden",position:"relative"}}>
                <div className="ticker-track">
                  {[...(rssItems||[]),...(rssItems||[])].map((item,i)=>(
                    <span key={i}
                      onClick={()=>item.link&&window.open(item.link,"_blank")}
                      style={{display:"inline-flex",alignItems:"center",gap:6,padding:"0 20px",cursor:item.link?"pointer":"default",whiteSpace:"nowrap"}}>
                      <span style={{fontSize:8,fontWeight:700,color:"#f59e0b"}}>{item.source}</span>
                      <span style={{fontSize:10,color:"#e2e4e9"}}>{item.headline}</span>
                      <span style={{color:`${acc}44`,fontSize:10,marginLeft:4}}>·</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Flash deep dive */}
          {showFlash&&(
            <div style={{background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${acc}22`,borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"14px 18px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                  <button onClick={()=>setShowFlash(false)} style={{background:"none",border:`1px solid ${acc}33`,borderRadius:6,color:acc,fontSize:9,fontWeight:700,cursor:"pointer",padding:"3px 8px",letterSpacing:"0.08em"}}>← TERUG</button>
                  <div style={{width:4,height:4,borderRadius:"50%",background:"#f59e0b",animation:"pulseDot 2s ease-in-out infinite"}}/>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.14em",color:"#f59e0b"}}>FLASH NEWS</span>
                  <span style={{fontSize:9,color:"#555",fontFamily:"'JetBrains Mono',monospace",marginLeft:"auto"}}>{(rssItems||[]).length} items · auto-update 5min</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {(rssItems||[]).map((item,i)=>(
                    <div key={i}
                      onClick={()=>item.link&&window.open(item.link,"_blank")}
                      style={{padding:"8px 12px",borderRadius:7,background:"#0f0f11",border:"1px solid #1e1e22",cursor:item.link?"pointer":"default",display:"flex",alignItems:"center",gap:8,transition:"background 0.15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#161618"}
                      onMouseLeave={e=>e.currentTarget.style.background="#0f0f11"}>
                      <div style={{width:2,height:28,flexShrink:0,background:"rgba(245,158,11,0.5)",borderRadius:1}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                          <span style={{fontSize:8,fontWeight:700,color:"#f59e0b",letterSpacing:"0.06em"}}>{item.source}</span>
                          <span style={{fontSize:8,color:"#555",fontFamily:"'JetBrains Mono',monospace"}}>{item.timeStr||""}</span>
                        </div>
                        <div style={{fontSize:11,color:"#e2e4e9",lineHeight:1.45}}>{item.headline}</div>
                      </div>
                      {item.link&&<span style={{fontSize:12,color:"#555",flexShrink:0}}>›</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TOP BAR ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {data.session_context&&<span style={{fontSize:11,color:"#f0f1f3",fontWeight:500,wordBreak:"break-word",flex:1,minWidth:0}}>{data.session_context}</span>}
          {data.timestamp&&<span style={{fontSize:10,color:"#f0f1f3",fontFamily:"'JetBrains Mono',monospace"}}>· {fmtDT(data.timestamp)}</span>}
        </div>
        <button onClick={onRefresh} disabled={status==="loading-intel"} className="btn-primary" style={{padding:"6px 14px",fontSize:10,color:"#fff",opacity:status==="loading-intel"?0.6:1,"--btn-glow":`${acc}40`}}>
          <span style={{display:"inline-block",animation:status==="loading-intel"?"spin 0.8s linear infinite":"none"}}>↺</span>
          {status==="loading-intel"?`LADEN${".".repeat(dots)}`:"VERNIEUWEN"}
        </button>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid-intel-2col" style={{display:"grid",gap:24,alignItems:"start"}}>

        {/* LEFT: nieuws */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* HIGH IMPACT */}
          {highNews.length>0&&(
            <div style={{background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${acc}22`,borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"20px 22px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:16}}>
                  <div style={{width:4,height:4,borderRadius:"50%",background:"#ef4444"}}/>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.14em",color:"#ef4444"}}>HIGH IMPACT</span>
                  <span style={{fontSize:9,color:"#3a3a3a",fontFamily:"'JetBrains Mono',monospace"}}>{highNews.length} items</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {highNews.map((n,i)=><NewsItem key={i} n={n}/>)}
                </div>
              </div>
            </div>
          )}

          {/* ALL NEWS */}
          <div style={{background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${acc}22`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"20px 22px"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:16}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:"#f59e0b"}}/>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.14em",color:"#e2e4e9"}}>NIEUWS FEED</span>
                <span style={{fontSize:9,color:"#3a3a3a",fontFamily:"'JetBrains Mono',monospace"}}>{normalNews.length} items</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {normalNews.map((n,i)=><NewsItem key={i} n={n}/>)}
              </div>
            </div>
          </div>


        </div>

        {/* RIGHT: signalen */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Cross-asset */}
          {data.cross_asset_signals&&data.cross_asset_signals.length>0&&(
            <div style={{background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${acc}22`,borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"20px 22px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:16}}>
                  <div style={{width:4,height:4,borderRadius:"50%",background:"#6366f1"}}/>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.14em",color:"#e2e4e9"}}>CROSS-ASSET SIGNALEN</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.cross_asset_signals.map((s,i)=>(
                    <div key={i} style={{padding:"8px 11px",borderRadius:6,background:"#0f0f11",border:"1px solid #1e1e22"}}>
                      <Badge label={s.signal} color={s.type==="anomalie"?"#ef4444":"#6366f1"}/>
                      <div style={{fontSize:11,color:"#e2e4e9",marginTop:5,lineHeight:1.55}}>{s.implication}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Risk radar — score is /10 */}
          {data.risk_radar&&(()=>{
            const score = data.risk_radar.score;
            const rc = score>7?"#ef4444":score>4?"#f97316":"#22c55e";
            const circ = 2*Math.PI*16; // r=16
            return (
              <div style={{background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${acc}22`,borderRadius:10,overflow:"hidden"}}>
                <div style={{padding:"20px 22px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:16}}>
                    <div style={{width:4,height:4,borderRadius:"50%",background:rc}}/>
                    <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.14em",color:"#e2e4e9"}}>RISK RADAR</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:16}}>
                    <div style={{position:"relative",width:52,height:52,flexShrink:0}}>
                      <svg width="52" height="52" viewBox="0 0 52 52">
                        <circle cx="26" cy="26" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"/>
                        <circle cx="26" cy="26" r="16" fill="none" stroke={rc} strokeWidth="2.5"
                          strokeDasharray={`${(score/10)*circ} ${circ}`}
                          strokeLinecap="round" transform="rotate(-90 26 26)"/>
                      </svg>
                      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color:"#e5e7eb",lineHeight:1}}>{score}</span>
                        <span style={{fontSize:7,color:"#444",marginTop:1}}>/ 10</span>
                      </div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600,color:rc,marginBottom:8}}>{data.risk_radar.label}</div>
                      {(data.risk_radar.factors_text||"").split(",").concat(data.risk_radar.factors||[]).filter(Boolean).slice(0,4).map((f,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                          <div style={{width:2,height:2,borderRadius:"50%",background:"#444",flexShrink:0}}/>
                          <span style={{fontSize:10,color:"#e2e4e9"}}>{f.trim()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Yield */}
          {data.yield_analysis?.implication&&(
            <div style={{background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${acc}22`,borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"20px 22px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                  <div style={{width:4,height:4,borderRadius:"50%",background:acc}}/>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.14em",color:"#e2e4e9"}}>YIELD IMPLICATIE</span>
                </div>
                <div style={{fontSize:11,color:"#e2e4e9",lineHeight:1.65}}>{data.yield_analysis.implication}</div>
              </div>
            </div>
          )}

          {/* Macro context */}
          <div style={{background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${acc}22`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"20px 22px"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:yieldColors[data.macro_regime]||acc}}/>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.14em",color:"#e2e4e9"}}>MACRO CONTEXT</span>
                <span style={{fontSize:11,fontWeight:600,color:yieldColors[data.macro_regime]||acc,marginLeft:"auto"}}>{data.macro_regime||"—"}</span>
              </div>
              {data.dominant_driver&&(
                <div style={{fontSize:11,color:"#e2e4e9",marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <span style={{color:"#444",fontSize:9,letterSpacing:"0.08em"}}>DRIVER · </span>{data.dominant_driver}
                </div>
              )}
              {data.yield_analysis&&(
                <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:data.desk_view?10:0}}>
                  {[{l:"US10Y",v:data.yield_analysis.us10y_level},{l:"US2Y",v:data.yield_analysis.us2y_level},{l:"SPREAD",v:data.yield_analysis.spread}].map(({l,v})=>v&&(
                    <div key={l}>
                      <div style={{fontSize:8,color:"#444",letterSpacing:"0.1em",marginBottom:2}}>{l}</div>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:600,color:acc}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
              {data.desk_view&&(
                <div style={{fontSize:11,color:"#e2e4e9",lineHeight:1.65,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.04)",wordBreak:"break-word"}}>{data.desk_view}</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}


// ── HOME PAGE ─────────────────────────────────────────────────────────────────
function HomePage({ assets, livePrices, aResult, presession, lastRefresh, hybridStatus, onRunHybrid, onNavigate, accent, breakingNews, rssItems, onRefreshRss, rssLoading }) {
  const acc = accent || DEFAULT_ACCENT;
  const isRunning = hybridStatus!=="idle"&&hybridStatus!=="done";
  const now = new Date();
  const timeStr = now.toLocaleTimeString("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"});
  const dateStr = now.toLocaleDateString("nl-NL",{timeZone:"Europe/Amsterdam",weekday:"long",day:"numeric",month:"long"});

  // Overall market sentiment from results
  const allBiases = aResult ? assets.map(a=>aResult.assets?.[a.id]?.bias).filter(Boolean) : [];
  const bullCount = allBiases.filter(b=>b.toLowerCase().includes("bull")).length;
  const bearCount = allBiases.filter(b=>b.toLowerCase().includes("bear")).length;
  const overallSentiment = bullCount > bearCount ? "Bullish" : bearCount > bullCount ? "Bearish" : "Gemengd";
  const sentimentColor = overallSentiment==="Bullish"?"#22c55e":overallSentiment==="Bearish"?"#ef4444":"#f59e0b";
  const avgConf = aResult ? Math.round(assets.reduce((s,a)=>s+(aResult.assets?.[a.id]?.confidence||0),0)/assets.length) : null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* ── HERO ZWEVEND — geen box ── */}
      <div style={{padding:"10px 2px 0",position:"relative"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16}}>
          <div>
            <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.16em",fontFamily:"'JetBrains Mono',monospace",marginBottom:8}}>
              {dateStr.toUpperCase()} · {timeStr} AMS
            </div>
            <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:"#f1f2f4",lineHeight:1.1,marginBottom:6}}>
              HybridTrader <span style={{color:acc}}>Dashboard</span>
            </h1>
            <p style={{fontSize:11,color:"#c8cdd8",lineHeight:1.55,maxWidth:400}}>
              {(()=>{ const tl = T[getLang()]||T.nl; const s = getSession(); return <>{tl.welcomeBack} <span style={{color:acc,fontWeight:600}}>{s?.name||"Trader"}</span> — institutioneel macro-analyse systeem voor de London session.</>; })()}
            </p>
            {presession&&(
              <div style={{marginTop:10,display:"flex",alignItems:"center",gap:6}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",border:`1px solid ${acc}22`,borderRadius:20,padding:"4px 10px"}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:presession.mood?.toLowerCase().includes("bull")?"#22c55e":presession.mood?.toLowerCase().includes("bear")?"#ef4444":"#f59e0b",animation:"pulseDot 2s ease-in-out infinite"}}/>
                  <span style={{fontSize:10,color:"#c8cdd8",fontWeight:500}}>{presession.session}</span>
                  <span style={{fontSize:10,fontWeight:700,color:presession.mood?.toLowerCase().includes("bull")?"#22c55e":presession.mood?.toLowerCase().includes("bear")?"#ef4444":"#f59e0b"}}>{presession.mood}</span>
                </div>
              </div>
            )}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end",paddingTop:4}}>
            <button onClick={onRunHybrid} disabled={isRunning}
              className="btn-primary btn-always-spin"
              style={{padding:"9px 20px",fontSize:11,color:"#fff",opacity:isRunning?0.6:1,"--btn-glow":`${acc}40`}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{animation:isRunning?"spin 1s linear infinite":"none"}}>
                {isRunning ? <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/> : <path d="M5 3l14 9-14 9V3z" fill="currentColor"/>}
              </svg>
              {isRunning?"LADEN...":"HYBRID LADEN"}
            </button>
            {lastRefresh&&<span style={{fontSize:9,color:"#6b7280",fontFamily:"'JetBrains Mono',monospace"}}>Update: {lastRefresh.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})}</span>}
          </div>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      {aResult&&(
        <div className="grid-stats" style={{display:"grid",gap:14}}>
          {[
            {label:"Markt Sentiment",value:overallSentiment,color:sentimentColor,sub:`${bullCount}B / ${bearCount}Be / ${allBiases.length-bullCount-bearCount}N`},
            {label:"Gem. Confidence",value:avgConf+"%",color:acc,sub:"Over alle assets"},
            {label:"Assets Geanalyseerd",value:assets.length,color:"#6366f1",sub:"Live bijgewerkt"},
            {label:"Breaking News",value:breakingNews.length,color:"#f59e0b",sub:"Vandaag gefilterd"},
          ].map(({label,value,color,sub})=>(
            <div key={label} className="rc-card card-hover" style={{"--conic-color":color}}>
              <div className="conic-border"/>
              <div style={{padding:"16px 18px",position:"relative",zIndex:1}}>
              <div style={{fontSize:9,color:"#e2e4e9",letterSpacing:"0.1em",marginBottom:8,opacity:0.5}}>{label.toUpperCase()}</div>
              <div style={{fontSize:22,fontWeight:700,color,marginBottom:3,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{value}</div>
              <div style={{fontSize:10,color:"#e2e4e9",opacity:0.4}}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── NAV CARDS ── */}
      <div className="grid-nav" style={{display:"grid",gap:14}}>
        {[
          {id:"analyse", icon:"▦", title:"Asset Analyse", desc:"Bias-analyse voor alle 5 pairs met confidence, hold score en AI samenvatting.", color:acc},
          {id:"intel",   icon:"◉", title:"Market Intel",  desc:"Live nieuws, yield analyse, macro regime en cross-asset signalen.", color:"#6366f1"},
          {id:"calendar",icon:"≡", title:"Tools & Links", desc:"ForexFactory, TradingView, Investing.com en andere trading resources.", color:"#f59e0b"},
        ].map(({id,icon,title,desc,color})=>(
          <button key={id} onClick={()=>onNavigate(id)}
            className="rc-card card-hover"
            style={{"--conic-color":color,cursor:"pointer",width:"100%",textAlign:"left",border:"none",background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)"}}>
            <div className="conic-border"/>
            <div style={{padding:"18px 20px",display:"flex",flexDirection:"column",gap:10,position:"relative",zIndex:1}}>
            <div style={{width:32,height:32,borderRadius:8,background:`${color}15`,border:`1px solid ${color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color}}>
              {icon}
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#f0f1f3",marginBottom:4}}>{title}</div>
              <div style={{fontSize:10,color:"#e2e4e9",lineHeight:1.55,opacity:0.6}}>{desc}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,color,fontSize:9,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.06em",marginTop:"auto"}}>
              OPEN <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── NEWS FEED ── */}
      {(rssItems.length>0||breakingNews.length>0)&&(
        <div className="rc-card card-hover" style={{"--conic-color":acc}}>
          <div className="conic-border"/>
          <div style={{padding:"18px 20px",position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:4,height:4,borderRadius:"50%",background:"#f59e0b",animation:"pulseDot 2s ease-in-out infinite"}}/>
              <span style={{fontSize:9,fontWeight:700,color:"#e2e4e9",letterSpacing:"0.14em",opacity:0.6}}>NEWS FEED</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {rssLoading&&<span style={{fontSize:10,color:"#c8cdd8",animation:"spin 0.8s linear infinite",display:"inline-block"}}>⟳</span>}
              {!rssLoading&&onRefreshRss&&<button onClick={onRefreshRss} className="btn-primary" style={{padding:"3px 9px",fontSize:9,color:"#fff","--btn-glow":`${acc}30`}}>↺</button>}
              <button onClick={()=>onNavigate("intel")} className="btn-primary" style={{padding:"3px 10px",fontSize:9,color:"#fff","--btn-glow":`${acc}30`}}>MEER ›</button>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {(rssItems.length>0?rssItems:breakingNews).slice(0,5).map((n,i)=>{
              const headline = n.headline;
              const source = n.source;
              const time = n.time ? fmtDT(n.time) : n.timeStr||"";
              const url = n.link||n.url||"";
              return (
                <div key={i} onClick={()=>url&&window.open(url,"_blank")}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:6,background:"#0f0f11",border:"1px solid #1e1e22",cursor:url?"pointer":"default",transition:"background 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#161618"}
                  onMouseLeave={e=>e.currentTarget.style.background="#0f0f11"}>
                  <div style={{width:2,height:28,flexShrink:0,background:`${acc}55`,borderRadius:1}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
                      <span style={{fontSize:8,fontWeight:700,color:acc,letterSpacing:"0.06em"}}>{source}</span>
                      <span style={{fontSize:8,color:"#8a8f9a",fontFamily:"'JetBrains Mono',monospace"}}>{time}</span>
                    </div>
                    <div style={{fontSize:10,color:"#e2e4e9",lineHeight:1.4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{headline}</div>
                  </div>
                  {url&&<span style={{fontSize:10,color:"#8a8f9a",flexShrink:0}}>›</span>}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HybridDashboard({ injectedAccent, onAccentChange, injectedSession, onSessionUpdate, onLogout, onShowSettings }) {
  // ── Responsive breakpoints ───────────────────────────────────────────────
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile    = vw < 640;
  const isTablet    = vw >= 640 && vw < 1024;
  const isDesktop   = vw >= 1024;
  const useBottomNav = !isDesktop;
  const sidebarW    = isDesktop ? 80 : 0;
  // ────────────────────────────────────────────────────────────────────────

  const [page,          setPage]          = useState("home");
  const [pageKey,       setPageKey]       = useState(0);
  const switchPage = (newPage) => { if(newPage===page) return; setPageKey(k=>k+1); setPage(newPage); };
  const [showProfile,   setShowProfile]   = useState(false);
  const [aStatus,       setAStatus]       = useState("idle");
  const [iStatus,       setIStatus]       = useState("idle");
  const [aResult,       setAResult]       = useState(null);
  const [iResult,       setIResult]       = useState(null);
  // Refs zodat runHybrid altijd de meest recente waarden kan lezen voor de save
  const aResultRef   = useRef(null);
  const iResultRef   = useRef(null);
  const presessionRef = useRef(null);
  const [marktvisie,    setMarktvisie]    = useState(null); // AI marktmening op basis van nieuws
  const [aError,        setAError]        = useState("");
  const [iError,        setIError]        = useState("");
  const [dots,          setDots]          = useState(0);
  const [deepAsset,     setDeepAsset]     = useState(null);
  const [deepRefreshing,setDeepRefreshing]= useState(false);
  const [refreshingAssets, setRefreshingAssets] = useState(new Set());
  const [calFilter,     setCalFilter]     = useState("all");
  const [calDayFilter,  setCalDayFilter]  = useState("all");
  const [accent,        setAccentLocal]   = useState(injectedAccent || DEFAULT_ACCENT);
  const setAccent = (v) => { setAccentLocal(v); if(onAccentChange) onAccentChange(v); };
  // Sync if parent changes
  useEffect(() => { if(injectedAccent && injectedAccent !== accent) setAccentLocal(injectedAccent); }, [injectedAccent]);
  const apiKey = ""; // API key now managed server-side
  const [priceSource,   setPriceSource]   = useState("finnhub");
  const [livePrices,    setLivePrices]    = useState({});

  const [showAccent,    setShowAccent]    = useState(false);
  const [assets,        setAssets]        = useState(BASE_ASSETS);
  const [showAddPair,   setShowAddPair]   = useState(false);
  const [newPairLabel,  setNewPairLabel]  = useState("");
  const [newPairFull,   setNewPairFull]   = useState("");
  const [presession,    setPresession]    = useState(null);
  // Sync refs met state zodat ze altijd actueel zijn
  useEffect(() => { aResultRef.current = aResult; }, [aResult]);
  useEffect(() => { iResultRef.current = iResult; }, [iResult]);
  useEffect(() => { presessionRef.current = presession; }, [presession]);
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

  // ── RSS feeds ophalen bij opstarten ───────────────────────────────────────
  useEffect(() => {
    fetchRssFeeds();
    const rssInterval = setInterval(fetchRssFeeds, 5 * 60 * 1000); // elke 5 min
    return () => clearInterval(rssInterval);
  }, []);

  // ── Auto-load gedeelde staat bij opstarten ──────────────────────────────────
  useEffect(() => {
    async function loadSharedState() {
      try {
        console.log("⏳ Gedeelde staat ophalen...");
        const res = await fetch("/api/state");
        if (!res.ok) { console.warn("⚠️ /api/state:", res.status); return; }
        const data = await res.json();
        if (!data || !data.aResult) { console.warn("⚠️ Geen aResult in opgeslagen staat"); return; }
        if (data.aResult)    setAResult(data.aResult);
        if (data.iResult)    setIResult(data.iResult);
        if (data.presession) setPresession(data.presession);
        if (data.savedAt)    setLastRefresh(new Date(data.savedAt));
        console.log("✓ Gedeelde staat geladen van", data.savedAt);
      } catch(e) {
        console.error("✗ loadSharedState fout:", e);
      }
    }
    loadSharedState();
  }, []);

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
        // Individuele calls voor Finnhub — gestaggerd om 429 te vermijden
        allIds.forEach((id, idx) => {
          setTimeout(() => {
            fetchFinnhubPrice(id)
              .then(p=>{ if(p) setLivePrices(prev=>({...prev,[id]:p})); })
              .catch(()=>{});
          }, idx * 600); // 600ms tussen elke call = ~6s totaal voor 10 symbolen
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
        allIds.forEach((id, idx) => {
          setTimeout(() => {
            fetchFinnhubPrice(id)
              .then(p=>{ if(p) setLivePrices(prev=>({...prev,[id]:p})); })
              .catch(()=>{});
          }, idx * 600);
        });
      }
    }

    fetchAll();
    const t = setInterval(fetchAll, 60000); // 60s interval ipv 30s
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
        const res = await anthropicFetch(bodyObj);
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
      setRssItems((data.items||[]).map(item => ({...item, timeStr: item.time ? new Date(item.time).toLocaleTimeString("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"}) : ""})));
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
      const res = await anthropicFetch({model:"claude-haiku-4-5-20251001",max_tokens:300,system:sys,messages:[{role:"user",content:usr}]});
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

      const res = await anthropicFetch({model:"claude-haiku-4-5-20251001",max_tokens:400,system:systemPrompt,messages:[{role:"user",content:usr}]});
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
      const body = { model:"claude-sonnet-4-20250514", max_tokens:4500, system:ANALYSIS_SYSTEM, messages:[{role:"user",content:usr}], _cacheKey:analyseKey };
      const res = await anthropicFetch(body);
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
    runPresession();
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
        let visieRes = await anthropicFetch({
            model:"claude-sonnet-4-20250514",
            max_tokens: 900,
            system: MARKTVISIE_SYSTEM,
            messages:[{role:"user", content: MARKTVISIE_USER(intelMetBreaking, labels, crossAsset)}]
          });
        // 429 retry voor marktvisie
        if(visieRes.status===429) {
          await new Promise(r=>setTimeout(r,20000));
          visieRes = await anthropicFetch({model:"claude-sonnet-4-20250514",max_tokens:900,system:MARKTVISIE_SYSTEM,messages:[{role:"user",content:MARKTVISIE_USER(intelMetBreaking,labels,crossAsset)}]});
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
    const refreshTime = new Date();
    setLastRefresh(refreshTime);

    // ── Direct opslaan in Redis na afloop ────────────────────────────────────
    setTimeout(() => {
      const snapshot = {
        aResult:    aResultRef.current,
        iResult:    iResultRef.current,
        presession: presessionRef.current,
        savedAt:    new Date().toISOString(),
      };
      if (!snapshot.aResult) { console.warn("⚠️ Save: aResult nog leeg"); return; }
      console.log("💾 Opslaan naar Redis...");
      fetch("/api/state", {
        method:  "POST",
        headers: {"Content-Type":"application/json"},
        body:    JSON.stringify(snapshot),
      })
        .then(r => r.json())
        .then(r => console.log("✓ Opgeslagen in Redis:", r))
        .catch(e => console.error("✗ Redis save fout:", e));
    }, 1500);

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

  const moodColor = (m) => { if(!m) return "#6b7280"; const l=m.toLowerCase(); if(l.includes("bull")) return "#22c55e"; if(l.includes("bear")) return "#ef4444"; if(l.includes("chop")||l.includes("vol")) return accent; return "#6b7280"; };

  // Time since last refresh
  const timeSinceRefresh = lastRefresh ? (() => {
    const diff = Math.floor((Date.now() - lastRefresh) / 1000);
    if(diff < 60) return `${diff}s geleden`;
    if(diff < 3600) return `${Math.floor(diff/60)}m geleden`;
    return `${Math.floor(diff/3600)}u geleden`;
  })() : null;

  const isRunning = hybridStatus!=="idle"&&hybridStatus!=="done";

  return (
    <div style={{minHeight:"100vh",background:"#070708",fontFamily:"'Inter',sans-serif",color:"#e2e4e9",display:"flex"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif !important; }
        .mono, .mono * { font-family: 'JetBrains Mono', monospace !important; }
        :root {
          --bg: #060608;
          --bg2: #0d0d10;
          --bg3: #111116;
          --border: rgba(255,255,255,0.06);
          --border2: rgba(255,255,255,0.10);
          --text: #e2e4e9;
          --text2: #6b7280;
          --text3: #374151;
          --acc: ${accent};
          --sidebar-w: 80px;
        }
        .nav-item{transition:all 0.15s ease;border-radius:8px;color:#e2e4e9!important;}.nav-item:hover{background:rgba(255,255,255,0.05)!important;color:#fff!important;}.nav-item.active{background:rgba(255,255,255,0.06)!important;color:#fff!important;}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg)}
        ::-webkit-scrollbar{width:3px;background:transparent}
        ::-webkit-scrollbar-thumb{background:#1f2023;border-radius:4px}
        button{transition:all 0.18s cubic-bezier(0.4,0,0.2,1)!important;cursor:pointer}
        button:hover:not(:disabled){filter:brightness(1.2);transform:translateY(-1px)}
        .card-enter{animation:cardIn 0.4s cubic-bezier(0.4,0,0.2,1) both}
        @keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes countUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes scanline{0%{top:-10%}100%{top:110%}}
        @keyframes glow{0%,100%{box-shadow:0 0 8px var(--acc)}50%{box-shadow:0 0 20px var(--acc),0 0 40px var(--acc)44}}
        @keyframes loadStep{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
        .num-anim{animation:countUp 0.5s cubic-bezier(0.4,0,0.2,1) both}
        .fade-in{animation:fadeIn 0.6s ease both}
        .step-anim{animation:loadStep 0.3s ease both}
        .page-enter{animation:pageIn 0.35s cubic-bezier(0.4,0,0.2,1) both}
        @keyframes pageIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
        @keyframes slideIn{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:none}}
        @keyframes slideOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-22px)}}
        .page-exit{animation:pageOut 0.2s cubic-bezier(0.4,0,0.2,1) both}
        @keyframes pageOut{to{opacity:0;transform:translateX(-12px)}}
        .deep-enter{animation:deepIn 0.38s cubic-bezier(0.16,1,0.3,1) both}
        @keyframes deepIn{from{opacity:0;transform:translateY(32px) scale(0.97)}to{opacity:1;transform:none}}
        .card-hover{transition:transform 0.2s cubic-bezier(0.4,0,0.2,1);position:relative}
        .card-hover:hover{transform:translateY(-2px)!important}
        .conic-border{position:absolute;inset:-1px;border-radius:9px;opacity:0;transition:opacity 0.35s ease;pointer-events:none;z-index:5}
        .conic-border::before{content:"";position:absolute;inset:0;border-radius:9px;padding:1.5px;background:conic-gradient(from var(--angle,0deg),transparent 0%,transparent 50%,transparent 60%,var(--conic-color,${accent}) 80%,transparent 95%,transparent 100%);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:none}
        .card-hover:hover .conic-border{opacity:1}
        .card-hover:hover .conic-border::before{animation:conicSpin 2.5s linear infinite}
        .nav-item{transition:all 0.15s ease;border-radius:8px;position:relative;color:#9ca3af!important;}
        .nav-item:hover{background:rgba(255,255,255,0.05)!important;color:#e2e4e9!important;}
        .nav-item.active{background:transparent!important;color:${accent}!important;}
        .nav-conic{position:absolute;inset:-1px;border-radius:9px;opacity:0;transition:opacity 0.3s ease;pointer-events:none;z-index:0}
        .nav-conic::before{content:"";position:absolute;inset:0;border-radius:9px;padding:1.5px;background:conic-gradient(from var(--nav-angle,0deg),transparent 0%,transparent 50%,transparent 60%,var(--conic-color,#089981) 80%,transparent 95%,transparent 100%);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:none}
        .nav-item:hover .nav-conic{opacity:1}
        .nav-item:hover .nav-conic::before{animation:navConicSpin 3s linear infinite}
        @keyframes navConicSpin{to{--nav-angle:360deg}}
        @property --nav-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
        @keyframes conicSpin{to{--angle:360deg}}
        @keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .ticker-track{display:flex;width:max-content;animation:tickerScroll 120s linear infinite}
        .ticker-track:hover{animation-play-state:paused}
        @property --angle{syntax:"<angle>";initial-value:0deg;inherits:false}
        .news-item-hover:hover{background:rgba(255,255,255,0.03)!important}

        /* ── Clean dark card ── */
        .rc-card{
          position:relative;
          background:rgba(10,10,12,0.55);
          backdrop-filter:blur(14px);
          -webkit-backdrop-filter:blur(14px);
          border:1px solid rgba(8,153,129,0.18);
          border-radius:10px;
          overflow:hidden;
          transition:transform 0.22s cubic-bezier(0.4,0,0.2,1),box-shadow 0.22s ease,border-color 0.22s ease;
        }
        .rc-card .rc-glow{ display:none; }
        .rc-card:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(0,0,0,0.6)}
        .rc-card .conic-border{border-radius:10px;opacity:0;transition:opacity 0.35s ease}
        .rc-card .conic-border::before{border-radius:10px}
        .rc-card:hover .conic-border{opacity:1}
        .rc-card:hover .conic-border::before{animation:conicSpin 2.5s linear infinite}
        .rc-card-footer{
          position:relative;
          z-index:1;
          border-top:1px solid #2a2a2a;
          background:rgba(0,0,0,0.2);
        }
        /* AI analysis inner box */
        .ai-inner-box{
          background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:8px;
          padding:12px 14px;
          margin-top:12px;
        }

        /* ── Super button ── */
        .btn-primary{
          position:relative;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          background:linear-gradient(145deg,#0d0d10,#161820);
          border:1.5px solid rgba(255,255,255,0.15);
          border-radius:100px;
          color:#fff;
          font-weight:700;
          letter-spacing:0.06em;
          cursor:pointer;
          overflow:hidden;
          transition:all 0.4s ease-in-out!important;
          box-shadow:0 0 20px var(--btn-glow,rgba(8,153,129,0.15));
          backdrop-filter:blur(8px);
          z-index:1;
        }
        .btn-primary::before{
          content:"";
          position:absolute;
          top:-50%;left:-50%;
          width:200%;height:200%;
          background:conic-gradient(from 0deg,var(--acc),color-mix(in srgb,var(--acc) 75%,#22c55e),var(--acc));
          animation:none;
          z-index:-2;
          opacity:0;
          transition:opacity 0.3s;
        }
        .btn-primary:hover::before{
          animation:superRotate 3s linear infinite!important;
          opacity:1!important;
        }
        /* Home hero button always spins */
        .btn-always-spin::before{
          animation:superRotate 3s linear infinite!important;
          opacity:1!important;
        }
        .btn-primary::after{
          content:"";
          position:absolute;
          inset:2px;
          background:linear-gradient(145deg,#0d0d10,#161820);
          border-radius:inherit;
          z-index:-1;
        }
        .btn-primary:hover:not(:disabled){
          transform:scale(1.04)!important;
          box-shadow:0 0 40px var(--btn-glow,rgba(8,153,129,0.30))!important;
        }
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed}
        @keyframes superRotate{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @property --sb-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
        @keyframes sbSpin{to{--sb-angle:360deg}}
        /* Logo ring */
        .logo-ring{position:relative;width:34px;height:34px;flex-shrink:0}
        .logo-ring img{position:relative;z-index:1;width:30px;height:30px;border-radius:7px;object-fit:cover;margin:2px}
        .logo-ring::before{content:"";position:absolute;inset:0;border-radius:9px;padding:2px;background:conic-gradient(from 0deg,transparent 0%,transparent 30%,var(--acc) 65%,var(--acc)88 75%,transparent 95%);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:none;z-index:0;opacity:0;transition:opacity 0.3s}
        .logo-wrap{transition:transform 0.2s ease}
        .logo-wrap:hover{transform:scale(1.04)}
        .logo-wrap:hover .logo-ring::before{animation:superRotate 3s linear infinite!important;opacity:1}
        .logo-wrap:hover .logo-title{color:#fff!important;}
        .logo-wrap:hover .logo-sub{color:#4b5563!important}
        /* Header buttons: hover-only (handled by base btn-primary:hover) */
        .pulse-dot{animation:pulseDot 2s ease-in-out infinite}
        @keyframes pulseDot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.7}}
        .cal-link{transition:transform 0.15s ease,box-shadow 0.15s ease}
        .cal-link:hover{transform:scale(1.03)!important;}
        .cal-link:hover .conic-border{opacity:1}
        .cal-link:hover .conic-border::before{animation:conicSpin 2.5s linear infinite}
        .confidence-bar{transition:width 0.8s cubic-bezier(0.4,0,0.2,1)}
        .ticker-scroll{animation:tickerMove 30s linear infinite}
        @keyframes tickerMove{from{transform:translateX(0)}to{transform:translateX(-50%)}}

        /* ── No horizontal scroll ── */
        *{box-sizing:border-box}
        html,body{overflow-x:hidden;max-width:100vw}
        #root{overflow-x:hidden;width:100%}

        /* ── Responsive ─────────────────────────────────────────────────────── */
        /* Mobile: < 640px */
        @media(max-width:639px){
          .sessie-grid,.grid-stats,.grid-nav,.grid-intel-2col,.grid-intel-macro,.grid-analyse-5,.grid-marktvisie,.grid-deepdive,.grid-2col{grid-template-columns:1fr!important}
          .sessie-grid{gap:12px!important}
          .grid-stats{grid-template-columns:1fr 1fr!important}
          .hero-row{flex-direction:column!important}
          .hero-row>div:last-child{align-items:flex-start!important}
          .page-pad{padding:10px!important}
          .header-title{display:none}
          .rc-card{border-radius:8px!important}
        }
        /* Tablet: 640–1023px */
        @media(min-width:640px) and (max-width:1023px){
          .grid-stats{grid-template-columns:1fr 1fr!important}
          .grid-nav{grid-template-columns:1fr 1fr 1fr!important}
          .grid-intel-2col{grid-template-columns:1fr!important}
          .grid-analyse-5{grid-template-columns:1fr 1fr!important}
          .grid-marktvisie{grid-template-columns:1fr!important}
          .grid-deepdive{grid-template-columns:1fr!important}
          .page-pad{padding:16px!important}
        }
        /* Desktop: >= 1024px */
        @media(min-width:1024px){
          .grid-stats{grid-template-columns:repeat(4,1fr)}
          .grid-nav{grid-template-columns:1fr 1fr 1fr}
          .grid-intel-2col{grid-template-columns:1fr 360px}
          .grid-analyse-5{grid-template-columns:repeat(5,1fr)}
          .grid-marktvisie{grid-template-columns:1fr 340px}
          .grid-2col{grid-template-columns:1fr 1fr}
          .grid-deepdive{grid-template-columns:300px 1fr 280px}
        }
      `}</style>

      {/* ── SIDEBAR (desktop only) ── */}
      {isDesktop && <div style={{
      width:80,
      minHeight:"100vh",
      background:"rgba(8,9,14,0.5)",
      backdropFilter:"blur(20px)",
      WebkitBackdropFilter:"blur(20px)",
      borderRight:"1px solid rgba(255,255,255,0.07)",
      display:"flex",
      flexDirection:"column",
      position:"fixed",
      left:0,
      top:0,
      zIndex:100,
      flexShrink:0
    }}>
      {/* Logo */}
      <div style={{padding:"20px 0 16px",borderBottom:"1px solid #262626",display:"flex",justifyContent:"center"}}>
        <div onClick={()=>switchPage("home")} className="logo-wrap" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer"}}>
          <div className="logo-ring">
            <img src="/logos/logo.jpg" alt="Logo"/>
          </div>
          <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.08em",color:"#f1f2f4",lineHeight:1}}>
            Hybrid<span style={{color:accent}}>Trader</span>
          </div>
        </div>
      </div>

        {/* Navigation */}
        <div style={{padding:"16px 8px",flex:1,display:"flex",flexDirection:"column",gap:2}}>
          {[
            {id:"home",    label:"Home",
              icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>},
            {id:"analyse", label:"Analyse",
              icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>},
            {id:"intel",   label:"Intel",
              icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>},
            {id:"calendar",label:"Kalender",
              icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>},
            ...(injectedSession?.role==="admin" ? [{id:"admin",label:"Admin",
              icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M16 11l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}] : []),
          ].map(({id,label,icon})=>(
            <button key={id} onClick={()=>switchPage(id)}
              className={`nav-item${page===id?" active":""}`}
              style={{width:"100%",border:"none",background:"transparent",color:page===id?accent:"#6b7280",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"10px 6px",cursor:"pointer","--conic-color":accent,borderRadius:10,position:"relative",transition:"all 0.15s"}}>
              <div className="nav-conic"/>
              <div style={{position:"relative",zIndex:1,color:"inherit"}}>{icon}</div>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.04em",position:"relative",zIndex:1,color:"inherit"}}>{label}</div>
            </button>
          ))}
        </div>

        {/* Bottom — avatar */}
        <div style={{padding:"10px 8px 14px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
          {(()=>{
            const avatar = injectedSession?.avatar || null;
            const initials = (injectedSession?.name||"U").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
            return (
              <button onClick={()=>setShowProfile(true)}
                title="Profiel & instellingen"
                style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"8px 6px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,cursor:"pointer",transition:"all .18s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.borderColor=accent+"40";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.02)";e.currentTarget.style.borderColor="rgba(255,255,255,0.05)";}}>
                <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,overflow:"hidden",border:`2px solid ${accent}50`,position:"relative"}}>
                  {avatar
                    ? <img src={avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="avatar"/>
                    : <div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${accent}40,${accent}20)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:9,fontWeight:800,color:accent}}>{initials}</span>
                      </div>
                  }
                  <div style={{position:"absolute",bottom:0,right:0,width:7,height:7,borderRadius:"50%",background:"#22c55e",border:"2px solid #0a0a0a"}}/>
                </div>
                <div style={{fontSize:9,fontWeight:600,color:"#9ca3af",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",textAlign:"center"}}>{(injectedSession?.name||"Gebruiker").split(" ")[0]}</div>
              </button>
            );
          })()}
        </div>
      </div>}

      {/* ── BOTTOM NAV (mobile + tablet) ── */}
      {useBottomNav && (
        <div style={{
          position:"fixed",bottom:0,left:0,right:0,
          height:60,
          background:"rgba(10,10,10,0.95)",
          backdropFilter:"blur(20px)",
          WebkitBackdropFilter:"blur(20px)",
          borderTop:"1px solid #2a2a2a",
          display:"flex",alignItems:"stretch",
          zIndex:100,
        }}>
          {[
            {id:"home",    label:"Home",    icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>},
            {id:"analyse", label:"Analyse", icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>},
            {id:"intel",   label:"Intel",   icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>},
            {id:"calendar",label:"Tools",   icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>},
          ].map(({id,label,icon})=>(
            <button key={id} onClick={()=>switchPage(id)}
              style={{
                flex:1,border:"none",background:"transparent",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,
                color:page===id?accent:"#555",
                cursor:"pointer",transition:"color 0.15s",
                padding:"6px 0",
              }}>
              <div style={{color:"inherit"}}>{icon}</div>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.04em",color:"inherit"}}>{label}</div>
              {page===id && <div style={{position:"absolute",bottom:0,width:24,height:2,background:accent,borderRadius:"2px 2px 0 0"}}/>}
            </button>
          ))}
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{marginLeft:sidebarW,flex:1,display:"flex",flexDirection:"column",minHeight:"100vh",position:"relative",background:"transparent",paddingBottom:useBottomNav?60:0}}>

      {/* ProfileModal — fullscreen overlay outside sidebar */}
      {showProfile && (
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)"}} onClick={()=>setShowProfile(false)}>
          <div onClick={e=>e.stopPropagation()}>
            <ProfileModal
              session={injectedSession}
              accent={accent}
              setAccent={setAccent}
              onLogout={onLogout}
              onClose={()=>setShowProfile(false)}
              onSessionUpdate={(updated)=>{
                saveSession(updated);
                if(updated.role!=="admin"){
                  const users=getUsers();
                  saveUsers(users.map(u=>u.email===updated.email?{...u,name:updated.name,avatar:updated.avatar,password:updated.password||u.password}:u));
                }
                if(onSessionUpdate) onSessionUpdate(updated);
              }}
            />
          </div>
        </div>
      )}

        {`${accent}` && <div style={{position:"fixed",top:0,left:sidebarW,right:0,bottom:0,pointerEvents:"none",zIndex:0}}>
          <div style={{position:"absolute",top:"-5%",left:"5%",width:"90%",height:"60%",background:`radial-gradient(ellipse at center,${accent}28 0%,transparent 60%)`,filter:"blur(70px)"}}/>
          
          <div style={{position:"absolute",top:"35%",left:"-5%",width:"40%",height:"50%",background:`radial-gradient(ellipse at center,${accent}14 0%,transparent 65%)`,filter:"blur(75px)"}}/>
        </div>}

      {/* ── LOADING OVERLAY ── */}
      {isRunning&&(
        <div style={{position:"fixed",inset:0,marginLeft:0,background:"rgba(6,6,8,0.85)",backdropFilter:"blur(4px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:12,padding:"28px 24px",boxShadow:"0 8px 40px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.06)",minWidth:"min(340px,90vw)",maxWidth:"min(420px,95vw)"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${accent}22`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{animation:"spin 1s linear infinite"}}><path d="M12 2a10 10 0 0 1 10 10" stroke={accent} strokeWidth="2.5" strokeLinecap="round"/></svg>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#e2e4e9"}}>Hybrid Analyse Uitvoeren</div>
                <div style={{fontSize:11,color:"#6b7280",fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>Sluit de tab niet tijdens de analyse</div>
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
                        : <span style={{fontSize:9,color:"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>{step}</span>
                      }
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:active?600:400,color:done?"#22c55e":active?accent:"#4b5563"}}>{label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div key={pageKey} className="page-enter page-pad" style={{padding:"20px 24px",maxWidth:1440,margin:"0 auto",width:"100%",minWidth:0,position:"relative",zIndex:1,overflow:"hidden"}}>

        {/* ── Inline page header ── */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
          <div>
            <div className="header-title" style={{fontSize:22,fontWeight:800,letterSpacing:"-0.03em",color:"#e2e4e9",lineHeight:1}}>
              {page==="home"?"Home":page==="analyse"?"Analyse":page==="intel"?"Intel":page==="admin"?"Admin":"Kalender"}
            </div>
            <div style={{fontSize:10,color:"#6b7280",marginTop:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em"}}>
              {loading
                ? <span style={{color:accent,animation:"blink 1s infinite"}}>● RUNNING...</span>
                : aResult
                ? <span style={{color:"#22c55e"}}>● LIVE{lastRefresh?" · "+timeSinceRefresh:""}</span>
                : <span style={{color:"#4b5563"}}>● STANDBY</span>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {page==="analyse"&&(
              <button onClick={runAnalysis} disabled={aStatus==="loading"}
                className="btn-primary"
                style={{padding:"9px 20px",fontSize:11,color:"#fff",opacity:aStatus==="loading"?0.6:1,"--btn-glow":`${accent}40`}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{animation:aStatus==="loading"?"spin 1s linear infinite":"none",flexShrink:0}}>
                  {aStatus==="loading"?<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>:<path d="M8 5l11 7-11 7V5z" fill="currentColor"/>}
                </svg>
                {aStatus==="loading"?`LADEN${".".repeat(dots)}`:"ANALYSE LADEN"}
              </button>
            )}
            {page==="intel"&&(
              <button onClick={runIntel} disabled={iStatus==="loading"}
                className="btn-primary"
                style={{padding:"9px 20px",fontSize:11,color:"#fff","--btn-glow":`${accent}40`}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{animation:iStatus==="loading"?"spin 1s linear infinite":"none"}}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                {iStatus==="loading"?`LADEN${".".repeat(dots)}`:"INTEL LADEN"}
              </button>
            )}
          </div>
        </div>

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
            onRefreshRss={fetchRssFeeds}
            rssLoading={rssLoading}
          />
        )}

        {/* ANALYSE PAGE */}
        {page==="analyse"&&(
          <>
            {aStatus==="error"&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"12px 18px",marginBottom:14,color:"#f87171",fontSize:12}}><span style={{fontWeight:700}}>FOUT — </span>{aError}</div>}





            {/* FOR YOU — AI Marktbriefing zoals MarketReader */}
            {marktvisie?.macro_samenvatting&&(
              <div className="grid-marktvisie" style={{marginBottom:14,display:"grid",gap:12}}>
                {/* Linker kolom: macro samenvatting + asset visies */}
                <div style={{background:`${accent}06`,border:`1px solid ${accent}20`,borderRadius:10,padding:"16px 20px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{fontSize:13}}>🧠</span>
                    <div>
                      <div style={{fontSize:10,color:accent,letterSpacing:"0.12em",fontWeight:700}}>AI MARKTBRIEFING</div>
                      <div style={{fontSize:9,color:"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>{fmtDT(marktvisie.marktvisie_tijd||Date.now())}</div>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:"#d1d5db",lineHeight:1.8,marginBottom:12}}>{marktvisie.macro_samenvatting}</div>
                  <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                    <span>📰 NIEUWS CONTEXT PER ASSET</span>
                    <span style={{color:"#2d3748"}}>— gebaseerd op Intel nieuws van {fmtDT(marktvisie.marktvisie_tijd||Date.now())}</span>
                  </div>
                  {/* Per-asset visie — alleen tekst, GEEN bias kleur (want die staat op de kaarten) */}
                  {marktvisie.assets&&(
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {Object.entries(marktvisie.assets).map(([id,v])=>{
                        return (
                          <div key={id} style={{display:"flex",gap:8,alignItems:"flex-start",background:"rgba(255,255,255,0.02)",borderRadius:6,padding:"7px 10px",borderLeft:"2px solid #1f2937",minWidth:0,overflow:"hidden"}}>
                            <span style={{fontSize:10,fontWeight:700,color:"#6b7280",background:"rgba(255,255,255,0.04)",borderRadius:4,padding:"1px 8px",flexShrink:0,minWidth:64,textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>{id}</span>
                            <span style={{fontSize:10,color:"#9ca3af",lineHeight:1.6,flex:1}}>{v.visie}</span>
                            <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end",flexShrink:0,marginTop:1}}>
                              <span style={{fontSize:8,color:"#4b5563",background:"rgba(255,255,255,0.03)",borderRadius:3,padding:"1px 5px",letterSpacing:"0.06em",border:"1px solid #1f2937"}}>🤖 AI</span>
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
                      <div style={{background:"#0d0e13",border:`1px solid ${corrColor}22`,borderRadius:8,padding:"12px 14px"}}>
                        <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:8}}>v6.3 CORRELATIE STATUS</div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          <span style={{fontSize:11,fontWeight:700,color:corrColor}}>{corrLabel}</span>
                        </div>
                        <div style={{fontSize:10,color:"#6b7280",marginBottom:8}}>{corrText}</div>
                        {/* DXY / XAU / US10Y / VIX live */}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                          {[["DXY",dxy],["XAU/USD",xau],["US10Y",us10y],["VIX",vix]].filter(([,v])=>v).map(([label,v])=>(
                            <div key={label} style={{background:"rgba(255,255,255,0.02)",borderRadius:5,padding:"5px 8px"}}>
                              <div style={{fontSize:8,color:"#4b5563",letterSpacing:"0.08em"}}>{label}</div>
                              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:v.raw>0?"#22c55e":"#ef4444"}}>{v.change}</div>
                            </div>
                          ))}
                        </div>
                        {yieldRegime&&<div style={{fontSize:9,color:"#6366f1",background:"rgba(99,102,241,0.08)",borderRadius:4,padding:"4px 8px"}}>{yieldRegime}</div>}
                      </div>
                    );
                  })()}

                  {/* High impact events vandaag */}
                  {(iResult?.economic_calendar||[]).filter(e=>e.date==="today"&&e.impact==="high").slice(0,5).length>0&&(
                    <div style={{background:"#0d0e13",border:"1px solid #1a1b1e",borderRadius:8,padding:"12px 14px"}}>
                      <div style={{fontSize:9,color:"#ef4444",letterSpacing:"0.1em",marginBottom:8}}>🔴 HIGH IMPACT VANDAAG</div>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {(iResult?.economic_calendar||[]).filter(e=>e.date==="today"&&e.impact==="high").slice(0,5).map((e,i)=>(
                          <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
                            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:e.actual?accent:"#e5e7eb",fontWeight:700,flexShrink:0}}>{e.time}</span>
                            <span style={{fontSize:10,color:e.actual?"#4b5563":"#e5e7eb",flex:1}}>{e.event}</span>
                            {e.actual&&<span style={{fontSize:9,fontWeight:700,color:accent,fontFamily:"'JetBrains Mono',monospace"}}>{e.actual}</span>}
                            {!e.actual&&<span style={{fontSize:8,color:"#4b5563"}}>→</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ASSET GRID */}
            {!aResult&&aStatus!=="loading"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:20}}>
                <div style={{padding:"8px 0 4px",position:"relative"}}>
                  <div style={{position:"absolute",top:-40,right:0,width:320,height:200,borderRadius:"50%",background:`radial-gradient(circle,${accent}0f,transparent 70%)`,pointerEvents:"none"}}/>
                  <div style={{position:"relative"}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.18em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:14}}>HYBRID ANALYSE · POWERED BY AI</div>
                    <div style={{fontSize:24,fontWeight:800,color:"#f1f2f4",letterSpacing:"-0.02em",marginBottom:10,lineHeight:1.2}}>
                      Asset analyse<br/><span style={{color:accent}}>nog niet gestart</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                      <div style={{fontSize:13,color:"#6b7280",lineHeight:1.7,maxWidth:500}}>
                        Hybrid analyseert alle 5 assets tegelijk — bias richting, confidence score, Pulse timing en institutionele flow.
                      </div>
                      <button onClick={runAnalysis} disabled={aStatus==="loading"} className="btn-primary btn-always-spin" style={{padding:"11px 28px",fontSize:12,color:"#fff","--btn-glow":`${accent}40`,flexShrink:0}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{animation:aStatus==="loading"?"spin 1s linear infinite":"none"}}><path d="M8 5l11 7-11 7V5z" fill="currentColor"/></svg>
                        {aStatus==="loading"?"LADEN...":"ANALYSE STARTEN"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid-analyse-5" style={{display:"grid",gap:10}}>
                  {["XAU/USD","US30","US100","EUR/USD","GBP/USD"].map((sym,i)=>(
                    <div key={sym} style={{background:"#0d0e13",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,padding:"16px 18px"}}>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.14em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:10}}>{sym}</div>
                      <div style={{height:8,borderRadius:4,background:"rgba(255,255,255,0.04)",marginBottom:6,width:["70%","55%","80%","60%","75%"][i]}}/>
                      <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.03)",marginBottom:5,width:"90%"}}/>
                      <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.03)",width:"60%"}}/>
                      <div style={{marginTop:12,height:2,borderRadius:1,background:"rgba(255,255,255,0.04)",width:"100%"}}/>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aResult&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Asset cards grid */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
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
                {/* Macro context + Sessie info — naast elkaar onder assets */}
                <div className="grid-2col" style={{display:"grid",gap:12}}>

                  {/* Macro context kaart */}
                  <div style={{background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${accent}18`,borderRadius:10,padding:"18px 20px",display:"flex",flexDirection:"column",gap:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:3,height:3,borderRadius:"50%",background:accent,opacity:0.5}}/>
                      <span style={{fontSize:8,fontWeight:700,color:"#4b5563",letterSpacing:"0.14em",fontFamily:"'JetBrains Mono',monospace"}}>MACRO CONTEXT</span>
                      {aResult.yield_regime&&<YieldTooltip regime={aResult.yield_regime} explanation={aResult.yield_regime_explanation}/>}
                      {aResult.timestamp&&<span style={{fontSize:8,color:"#2d3748",fontFamily:"'JetBrains Mono',monospace"}}>{fmtDT(aResult.timestamp)}</span>}
                      <button onClick={runIntel} disabled={iStatus==="loading"||iStatus==="loading-intel"} className="btn-primary" title="Intel verversen" style={{marginLeft:"auto",padding:"3px 8px",fontSize:11,color:"#fff","--btn-glow":`${accent}40`,opacity:(iStatus==="loading"||iStatus==="loading-intel")?0.5:1}}>
                        <span style={{display:"inline-block",animation:(iStatus==="loading"||iStatus==="loading-intel")?"spin 0.8s linear infinite":"none"}}>↺</span>
                      </button>
                    </div>
                    {aResult.market_context ? (
                      <div style={{fontSize:11,color:"#c8cdd8",lineHeight:1.75}}>{aResult.market_context}</div>
                    ) : (
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        <div style={{fontSize:10,color:"#3a3a3a",fontStyle:"italic",marginBottom:4}}>Laad Intel voor macro context</div>
                        {["75%","55%","80%","60%","70%"].map((w,i)=>(
                          <div key={i} style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.04)",width:w}}/>
                        ))}
                      </div>
                    )}
                    {/* DXY / VIX / US10Y inline */}
                    {[
                      {l:"DXY",v:livePrices.DXY?.change||aResult.dxy_change,c:livePrices.DXY?.direction==="up"?"#22c55e":"#ef4444"},
                      {l:"VIX",v:livePrices.VIX?.price||aResult.vix_level,c:parseFloat(livePrices.VIX?.price||aResult.vix_level)>20?"#ef4444":"#9ca3af"},
                      {l:"US10Y",v:livePrices.US10Y?.price||aResult.us10y,c:accent},
                    ].filter(x=>x.v).length>0&&(
                      <div style={{display:"flex",gap:12,flexWrap:"wrap",paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                        {[
                          {l:"DXY",v:livePrices.DXY?.change||aResult.dxy_change,c:livePrices.DXY?.direction==="up"?"#22c55e":"#ef4444"},
                          {l:"VIX",v:livePrices.VIX?.price||aResult.vix_level,c:parseFloat(livePrices.VIX?.price||aResult.vix_level)>20?"#ef4444":"#9ca3af"},
                          {l:"US10Y",v:livePrices.US10Y?.price||aResult.us10y,c:accent},
                        ].filter(x=>x.v).map(({l,v,c})=>(
                          <div key={l} style={{display:"flex",flexDirection:"column",gap:2}}>
                            <span style={{fontSize:8,color:"#4b5563",letterSpacing:"0.1em"}}>{l}</span>
                            <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:c,fontWeight:700}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sessie info kaart */}
                  {(()=>{
                    if(!presession) return (
                      <div style={{background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${accent}18`,borderRadius:10,padding:"18px 20px",display:"flex",flexDirection:"column",gap:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:3,height:3,borderRadius:"50%",background:"#6366f1",opacity:0.5}}/>
                          <span style={{fontSize:8,fontWeight:700,color:"#4b5563",letterSpacing:"0.14em",fontFamily:"'JetBrains Mono',monospace"}}>SESSIE INFO</span>
                          <button onClick={runPresession} disabled={psStatus==="loading"} className="btn-primary" title="Sessie verversen" style={{marginLeft:"auto",padding:"3px 8px",fontSize:11,color:"#fff","--btn-glow":"#6366f140",opacity:psStatus==="loading"?0.5:1}}>
                            <span style={{display:"inline-block",animation:psStatus==="loading"?"spin 0.8s linear infinite":"none"}}>↺</span>
                          </button>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          <div style={{fontSize:10,color:"#3a3a3a",fontStyle:"italic",marginBottom:4}}>Sessie breakdown nog niet geladen</div>
                          {["60%","80%","45%","70%"].map((w,i)=>(
                            <div key={i} style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.04)",width:w}}/>
                          ))}
                        </div>
                      </div>
                    );
                    const moodLow=(presession.mood||"").toLowerCase();
                    const mc=moodLow.includes("bull")?"#22c55e":moodLow.includes("bear")?"#ef4444":"#f59e0b";
                    const moodIcon=moodLow.includes("bull")?"↑":moodLow.includes("bear")?"↓":"→";
                    return (
                      <div style={{background:"rgba(10,10,12,0.55)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid #6366f118`,borderRadius:10,padding:"18px 20px",display:"flex",flexDirection:"column",gap:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:3,height:3,borderRadius:"50%",background:"#6366f1",opacity:0.5}}/>
                          <span style={{fontSize:8,fontWeight:700,color:"#4b5563",letterSpacing:"0.14em",fontFamily:"'JetBrains Mono',monospace"}}>SESSIE INFO</span>
                          {presession.session&&<span style={{fontSize:9,color:"#6366f1",fontWeight:700,marginLeft:4}}>{presession.session}</span>}
                          {presession.session_time&&<span style={{fontSize:9,color:"#555",fontFamily:"'JetBrains Mono',monospace"}}>{presession.session_time}</span>}
                          <button onClick={runPresession} disabled={psStatus==="loading"} className="btn-primary" title="Sessie verversen" style={{marginLeft:"auto",padding:"3px 8px",fontSize:11,color:"#fff","--btn-glow":"#6366f140",opacity:psStatus==="loading"?0.5:1}}>
                            <span style={{display:"inline-block",animation:psStatus==="loading"?"spin 0.8s linear infinite":"none"}}>↺</span>
                          </button>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:32,height:32,borderRadius:8,background:`${mc}15`,border:`1px solid ${mc}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:mc,flexShrink:0}}>{moodIcon}</div>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:mc}}>{presession.mood}</div>
                            {presession.mood_score&&<div style={{fontSize:9,color:"#6b7280",fontFamily:"'JetBrains Mono',monospace"}}>{presession.mood_score}%</div>}
                          </div>
                          {presession.volatility_outlook&&<span style={{fontSize:9,color:"#6b7280",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:4,padding:"2px 8px",marginLeft:"auto"}}>VOL: {presession.volatility_outlook.toUpperCase()}</span>}
                        </div>
                        {presession.market_narrative&&<div style={{fontSize:11,color:"#c8cdd8",lineHeight:1.65}}>{presession.market_narrative}</div>}
                        {presession.key_events_today?.length>0&&(
                          <div style={{display:"flex",flexDirection:"column",gap:4,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                            <div style={{fontSize:8,color:"#4b5563",letterSpacing:"0.1em",marginBottom:2}}>KEY EVENTS</div>
                            {presession.key_events_today.slice(0,3).map((e,i)=>(
                              <div key={i} style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                                <div style={{width:3,height:3,borderRadius:"50%",background:accent,flexShrink:0,marginTop:4,opacity:0.5}}/>
                                <span style={{fontSize:10,color:"#a0a8b8",lineHeight:1.4}}>{e}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>
              </div>
            )}


          </>
        )}

        {/* INTEL PAGE */}
        {page==="intel"&&(
          <>
            {/* Intel page glow */}
            <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
              <div style={{position:"absolute",top:"10%",left:"20%",width:"60%",height:"50%",background:`radial-gradient(ellipse at center,${accent}0d 0%,transparent 65%)`,filter:"blur(80px)"}}/>
              
            </div>
            {iStatus==="error"&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"12px 18px",marginBottom:14,color:"#f87171",fontSize:12}}><span style={{fontWeight:700}}>FOUT — </span>{iError}</div>}
            <MarketIntelPage data={iResult} loading={iStatus==="loading"} onRefresh={runIntel} onRunHybrid={runHybrid} status={iStatus} dots={dots} onNewsClick={n=>setNewsImpact(n)} accent={accent} rssItems={rssItems} rssLoading={rssLoading} onRefreshRss={fetchRssFeeds}/>
          </>
        )}

        {/* ADMIN PAGE */}
        {page==="admin"&&injectedSession?.role==="admin"&&(
          <AdminPanel accent={accent} onNavigate={switchPage}/>
        )}

        {/* CALENDAR PAGE */}
        {page==="calendar"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>

            {/* Hero — no box */}
            <div style={{padding:"8px 0 4px",position:"relative"}}>
              <div style={{position:"absolute",top:-40,right:0,width:320,height:200,borderRadius:"50%",background:`radial-gradient(circle,${accent}0f,transparent 70%)`,pointerEvents:"none"}}/>
              <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:20}}>
                <div>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.18em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:14}}>TOOLS & KALENDER · EXTERNE LINKS</div>
                  <div style={{fontSize:24,fontWeight:800,color:"#f1f2f4",letterSpacing:"-0.02em",marginBottom:10,lineHeight:1.2}}>
                    Alles wat je nodig hebt<br/><span style={{color:accent}}>op één plek</span>
                  </div>
                  <div style={{fontSize:13,color:"#6b7280",lineHeight:1.7,maxWidth:500}}>
                    Snelle links naar economische kalenders, charting tools en macro bronnen voor de London sessie.
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,flexShrink:0}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",color:aResult?"#22c55e":"#e2e4e9",fontFamily:"'JetBrains Mono',monospace"}}>
                    {aResult?"● HYBRID GELADEN?":"● HYBRID NIET GELADEN?"}
                  </div>
                  <button onClick={runHybrid} disabled={isRunning}
                    className="btn-primary btn-always-spin"
                    style={{padding:"8px 18px",fontSize:11,color:"#fff",opacity:isRunning?0.6:1,"--btn-glow":`${accent}40`}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{animation:isRunning?"spin 1s linear infinite":"none",flexShrink:0}}>
                      {isRunning?<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>:<path d="M5 3l14 9-14 9V3z" fill="currentColor"/>}
                    </svg>
                    {isRunning?`${hybridStatus==="intel"?"1/4 NIEUWS...":hybridStatus==="marktvisie"?"2/4 VISIE...":hybridStatus==="analyse"?"3/4 ANALYSE...":hybridStatus==="sessie"?"4/4 SESSIE...":"LADEN..."}`:"HYBRID STARTEN"}
                  </button>
                </div>
              </div>
            </div>

            {/* Kalenders */}
            <div>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.16em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:10}}>ECONOMISCHE KALENDERS</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                {[
                  {label:"ForexFactory",  url:"https://www.forexfactory.com/calendar",              sub:"High-impact events",     color:"#f59e0b", icon:"🏭"},
                  {label:"Investing.com", url:"https://www.investing.com/economic-calendar/",       sub:"Breed macro overzicht",  color:accent,    icon:"📊"},
                  {label:"DailyFX",       url:"https://www.dailyfx.com/economic-calendar",          sub:"FX-gerichte kalender",   color:"#6366f1", icon:"📈"},
                  {label:"Myfxbook",      url:"https://www.myfxbook.com/forex-economic-calendar",   sub:"Forex community data",   color:"#ec4899", icon:"🗓"},
                ].map(({label,url,sub,color,icon})=>(
                  <div key={label} className="cal-link" style={{position:"relative",borderRadius:10}}>
                    <div className="conic-border" style={{"--conic-color":color}}/>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{display:"flex",flexDirection:"column",gap:10,background:"rgba(255,255,255,0.04)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",border:`1px solid ${color}20`,borderRadius:10,padding:"18px",cursor:"pointer",textDecoration:"none",boxShadow:"0 2px 14px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.04)"}}>
                      <div style={{fontSize:22}}>{icon}</div>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:"#e2e4e9",marginBottom:3}}>{label}</div>
                        <div style={{fontSize:10,color:"#6b7280"}}>{sub}</div>
                      </div>
                      <div style={{marginTop:"auto",height:2,borderRadius:1,background:`${color}30`}}><div style={{height:"100%",width:"100%",background:`${color}60`,borderRadius:1}}/></div>
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Charting & tools */}
            <div>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.16em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:10}}>CHARTING & ANALYSE</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                {[
                  {label:"TradingView",   url:"https://www.tradingview.com",                        sub:"Charts & screener",      color:accent,    icon:"📉"},
                  {label:"TradingEcon.",  url:"https://tradingeconomics.com",                       sub:"Macro indicators",       color:"#6366f1", icon:"🌐"},
                  {label:"CME FedWatch",  url:"https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html", sub:"Fed rate probs", color:"#f59e0b", icon:"🏦"},
                  {label:"Finviz",        url:"https://finviz.com/map.ashx",                        sub:"US equity heatmap",      color:"#22c55e", icon:"🗺"},
                ].map(({label,url,sub,color,icon})=>(
                  <div key={label} className="cal-link" style={{position:"relative",borderRadius:10}}>
                    <div className="conic-border" style={{"--conic-color":color}}/>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{display:"flex",flexDirection:"column",gap:10,background:"rgba(255,255,255,0.04)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",border:`1px solid ${color}20`,borderRadius:10,padding:"18px",cursor:"pointer",textDecoration:"none",boxShadow:"0 2px 14px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.04)"}}>
                      <div style={{fontSize:22}}>{icon}</div>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:"#e2e4e9",marginBottom:3}}>{label}</div>
                        <div style={{fontSize:10,color:"#6b7280"}}>{sub}</div>
                      </div>
                      <div style={{marginTop:"auto",height:2,borderRadius:1,background:`${color}30`}}><div style={{height:"100%",width:"100%",background:`${color}60`,borderRadius:1}}/></div>
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Tip */}
            <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,padding:"12px 18px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>💡</span>
              <span style={{fontSize:11,color:"#6b7280",lineHeight:1.6}}>Intel haalt automatisch high-impact events op tijdens de hybrid analyse — je hoeft de kalender niet handmatig te checken voor de daily bias.</span>
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


// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SYSTEM — Redis-backed via /api/auth
// ═══════════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = "admin@hybrid.com";

// ── i18n translations ────────────────────────────────────────────────────────
const LANGS = {
  nl: { code:"nl", label:"Nederlands", flag:"🇳🇱" },
  en: { code:"en", label:"English",    flag:"🇬🇧" },
  de: { code:"de", label:"Deutsch",    flag:"🇩🇪" },
  fr: { code:"fr", label:"Français",   flag:"🇫🇷" },
  es: { code:"es", label:"Español",    flag:"🇪🇸" },
  pt: { code:"pt", label:"Português",  flag:"🇵🇹" },
};

const T = {
  nl: {
    login:"Inloggen", register:"Registreren", name:"NAAM", email:"E-MAILADRES",
    password:"WACHTWOORD", confirmPassword:"BEVESTIG WACHTWOORD",
    passwordConfirmPlaceholder:"Herhaal wachtwoord",
    loginBtn:"INLOGGEN", registerBtn:"ACCOUNT AANMAKEN", loading:"LADEN...",
    fillAll:"Vul alle velden in.", minPw:"Wachtwoord moet minimaal 6 tekens zijn.",
    pwNoMatch:"Wachtwoorden komen niet overeen.",
    registerSuccess:"Account aangemaakt! Wacht op goedkeuring van de beheerder.",
    waitApproval:"Na registratie wacht je op goedkeuring van de beheerder.",
    connErr:"Verbindingsfout. Probeer opnieuw.", welcomeBack:"Welkom,",
    noAccess:"Geen Toegang", hello:"Hallo", waitMsg:"je account wacht nog op goedkeuring van de beheerder.",
    waitInfo:"Je aanvraag wordt beoordeeld. Je ontvangt toegang zodra je account is goedgekeurd.",
    logout:"UITLOGGEN", settings:"Instellingen", profileDashboard:"PROFIEL & DASHBOARD",
    profile:"Profiel", passwordTab:"Wachtwoord", dashboard:"Dashboard", account:"Account",
    language:"Taal", languageTab:"Taal",
    profilePhoto:"Profielfoto", uploadPhoto:"Foto uploaden", removePhoto:"Verwijderen",
    uploadInfo:"Upload een foto (JPG/PNG, max 2MB).",
    displayName:"WEERGAVENAAM", emailLabel:"E-MAILADRES", notEditable:"NIET WIJZIGBAAR",
    saveProfile:"PROFIEL OPSLAAN", saving:"OPSLAAN...", saved:"✓ Profiel opgeslagen!",
    namRequired:"Naam mag niet leeg zijn.", photoTooBig:"Foto mag maximaal 2MB zijn.",
    currentPw:"HUIDIG WACHTWOORD", newPw:"NIEUW WACHTWOORD", repeatPw:"HERHAAL NIEUW WACHTWOORD",
    strength:"STERKTE", weak:"Zwak", fair:"Matig", strong:"Sterk", veryStrong:"Zeer sterk",
    changePwBtn:"WACHTWOORD WIJZIGEN", pwChanged:"✓ Wachtwoord gewijzigd!",
    pwTooShort:"Minimaal 6 tekens vereist.", pwNoMatchErr:"Wachtwoorden komen niet overeen.",
    currentPwWrong:"Huidig wachtwoord onjuist.", fillPwAll:"Vul alle velden in.",
    accentColor:"ACCENTKLEUR", customColor:"EIGEN KLEURCODE", apply:"Toepassen",
    livePreview:"LIVE PREVIEW",
    accountInfo:"ACCOUNT INFORMATIE", nameLabel:"Naam", emailInfoLabel:"E-mail",
    roleLabel:"Rol", statusLabel:"Status", active:"Actief", pending:"In behandeling",
    administrator:"Administrator", logoutTitle:"Uitloggen",
    logoutDesc:"Je sessie wordt beëindigd. Je kunt altijd opnieuw inloggen.",
    assetsTitle:"ZICHTBARE ASSETS", assetsDesc:"Verberg assets die je niet gebruikt.",
    adminPanel:"ADMIN PANEEL · GEBRUIKERSBEHEER", manageUsers:"Beheer",
    users:"gebruikers", total:"Totaal", approved:"Goedgekeurd", inProgress:"In behandeling",
    refresh:"Vernieuwen", newRequests:"nieuwe aanvraag", newRequestsPlural:"nieuwe aanvragen",
    waitApproval2:"wachten op goedkeuring",
    allUsers:"Alle gebruikers", inProgressTab:"In behandeling",
    colName:"NAAM", colEmail:"E-MAIL", colStatus:"STATUS", colDate:"DATUM", colActions:"ACTIES",
    noRequests:"Geen aanvragen in behandeling.", noUsers:"Nog geen gebruikers geregistreerd.",
    approveBtn:"Goedkeuren", revokeBtn:"Intrekken", deleteBtn:"Verwijderen",
    deleteConfirm:"Gebruiker verwijderen?", adminInfo:"Goedgekeurde gebruikers hebben direct toegang.",
    autoRefresh:"Gebruikerslijst vernieuwt automatisch elke 15 seconden.",
    statusApproved:"Goedgekeurd", statusPending:"Wachtend", editProfile:"PROFIEL BEWERKEN",
    online:"ONLINE",
  },
  en: {
    login:"Login", register:"Register", name:"NAME", email:"EMAIL ADDRESS",
    password:"PASSWORD", confirmPassword:"CONFIRM PASSWORD",
    passwordConfirmPlaceholder:"Repeat password",
    loginBtn:"LOGIN", registerBtn:"CREATE ACCOUNT", loading:"LOADING...",
    fillAll:"Please fill in all fields.", minPw:"Password must be at least 6 characters.",
    pwNoMatch:"Passwords do not match.",
    registerSuccess:"Account created! Waiting for admin approval.",
    waitApproval:"After registration you await admin approval.",
    connErr:"Connection error. Please try again.", welcomeBack:"Welcome,",
    noAccess:"Access Denied", hello:"Hello", waitMsg:"your account is awaiting admin approval.",
    waitInfo:"Your request is being reviewed. You'll gain access once approved.",
    logout:"LOG OUT", settings:"Settings", profileDashboard:"PROFILE & DASHBOARD",
    profile:"Profile", passwordTab:"Password", dashboard:"Dashboard", account:"Account",
    language:"Language", languageTab:"Language",
    profilePhoto:"Profile photo", uploadPhoto:"Upload photo", removePhoto:"Remove",
    uploadInfo:"Upload a photo (JPG/PNG, max 2MB).",
    displayName:"DISPLAY NAME", emailLabel:"EMAIL ADDRESS", notEditable:"NOT EDITABLE",
    saveProfile:"SAVE PROFILE", saving:"SAVING...", saved:"✓ Profile saved!",
    namRequired:"Name cannot be empty.", photoTooBig:"Photo must be under 2MB.",
    currentPw:"CURRENT PASSWORD", newPw:"NEW PASSWORD", repeatPw:"REPEAT NEW PASSWORD",
    strength:"STRENGTH", weak:"Weak", fair:"Fair", strong:"Strong", veryStrong:"Very strong",
    changePwBtn:"CHANGE PASSWORD", pwChanged:"✓ Password changed!",
    pwTooShort:"Minimum 6 characters required.", pwNoMatchErr:"Passwords do not match.",
    currentPwWrong:"Current password incorrect.", fillPwAll:"Please fill in all fields.",
    accentColor:"ACCENT COLOR", customColor:"CUSTOM COLOR CODE", apply:"Apply",
    livePreview:"LIVE PREVIEW",
    accountInfo:"ACCOUNT INFORMATION", nameLabel:"Name", emailInfoLabel:"Email",
    roleLabel:"Role", statusLabel:"Status", active:"Active", pending:"Pending",
    administrator:"Administrator", logoutTitle:"Log out",
    logoutDesc:"Your session will end. You can always log back in.",
    assetsTitle:"VISIBLE ASSETS", assetsDesc:"Hide assets you don't use.",
    adminPanel:"ADMIN PANEL · USER MANAGEMENT", manageUsers:"Manage",
    users:"users", total:"Total", approved:"Approved", inProgress:"Pending",
    refresh:"Refresh", newRequests:"new request", newRequestsPlural:"new requests",
    waitApproval2:"awaiting approval",
    allUsers:"All users", inProgressTab:"Pending",
    colName:"NAME", colEmail:"EMAIL", colStatus:"STATUS", colDate:"DATE", colActions:"ACTIONS",
    noRequests:"No pending requests.", noUsers:"No users registered yet.",
    approveBtn:"Approve", revokeBtn:"Revoke", deleteBtn:"Delete",
    deleteConfirm:"Delete this user?", adminInfo:"Approved users get immediate access.",
    autoRefresh:"User list refreshes automatically every 15 seconds.",
    statusApproved:"Approved", statusPending:"Pending", editProfile:"EDIT PROFILE",
    online:"ONLINE",
  },
  de: {
    login:"Anmelden", register:"Registrieren", name:"NAME", email:"E-MAIL-ADRESSE",
    password:"PASSWORT", confirmPassword:"PASSWORT BESTÄTIGEN",
    passwordConfirmPlaceholder:"Passwort wiederholen",
    loginBtn:"ANMELDEN", registerBtn:"KONTO ERSTELLEN", loading:"LADEN...",
    fillAll:"Bitte alle Felder ausfüllen.", minPw:"Passwort muss mindestens 6 Zeichen lang sein.",
    pwNoMatch:"Passwörter stimmen nicht überein.",
    registerSuccess:"Konto erstellt! Warte auf Genehmigung des Admins.",
    waitApproval:"Nach der Registrierung wartest du auf Admin-Genehmigung.",
    connErr:"Verbindungsfehler. Bitte erneut versuchen.", welcomeBack:"Willkommen,",
    noAccess:"Kein Zugang", hello:"Hallo", waitMsg:"dein Konto wartet auf Genehmigung des Admins.",
    waitInfo:"Deine Anfrage wird geprüft. Du erhältst Zugang sobald sie genehmigt wurde.",
    logout:"ABMELDEN", settings:"Einstellungen", profileDashboard:"PROFIL & DASHBOARD",
    profile:"Profil", passwordTab:"Passwort", dashboard:"Dashboard", account:"Konto",
    language:"Sprache", languageTab:"Sprache",
    profilePhoto:"Profilfoto", uploadPhoto:"Foto hochladen", removePhoto:"Entfernen",
    uploadInfo:"Foto hochladen (JPG/PNG, max. 2MB).",
    displayName:"ANZEIGENAME", emailLabel:"E-MAIL-ADRESSE", notEditable:"NICHT ÄNDERBAR",
    saveProfile:"PROFIL SPEICHERN", saving:"SPEICHERN...", saved:"✓ Profil gespeichert!",
    namRequired:"Name darf nicht leer sein.", photoTooBig:"Foto darf maximal 2MB sein.",
    currentPw:"AKTUELLES PASSWORT", newPw:"NEUES PASSWORT", repeatPw:"NEUES PASSWORT WIEDERHOLEN",
    strength:"STÄRKE", weak:"Schwach", fair:"Mittel", strong:"Stark", veryStrong:"Sehr stark",
    changePwBtn:"PASSWORT ÄNDERN", pwChanged:"✓ Passwort geändert!",
    pwTooShort:"Mindestens 6 Zeichen erforderlich.", pwNoMatchErr:"Passwörter stimmen nicht überein.",
    currentPwWrong:"Aktuelles Passwort falsch.", fillPwAll:"Bitte alle Felder ausfüllen.",
    accentColor:"AKZENTFARBE", customColor:"EIGENER FARBCODE", apply:"Anwenden",
    livePreview:"LIVE VORSCHAU",
    accountInfo:"KONTOINFORMATIONEN", nameLabel:"Name", emailInfoLabel:"E-Mail",
    roleLabel:"Rolle", statusLabel:"Status", active:"Aktiv", pending:"Ausstehend",
    administrator:"Administrator", logoutTitle:"Abmelden",
    logoutDesc:"Deine Sitzung wird beendet. Du kannst dich jederzeit wieder anmelden.",
    assetsTitle:"SICHTBARE ASSETS", assetsDesc:"Verstecke Assets die du nicht verwendest.",
    adminPanel:"ADMIN-PANEL · BENUTZERVERWALTUNG", manageUsers:"Verwalte",
    users:"Benutzer", total:"Gesamt", approved:"Genehmigt", inProgress:"Ausstehend",
    refresh:"Aktualisieren", newRequests:"neue Anfrage", newRequestsPlural:"neue Anfragen",
    waitApproval2:"warten auf Genehmigung",
    allUsers:"Alle Benutzer", inProgressTab:"Ausstehend",
    colName:"NAME", colEmail:"E-MAIL", colStatus:"STATUS", colDate:"DATUM", colActions:"AKTIONEN",
    noRequests:"Keine ausstehenden Anfragen.", noUsers:"Noch keine Benutzer registriert.",
    approveBtn:"Genehmigen", revokeBtn:"Widerrufen", deleteBtn:"Löschen",
    deleteConfirm:"Diesen Benutzer löschen?", adminInfo:"Genehmigte Benutzer erhalten sofortigen Zugang.",
    autoRefresh:"Benutzerliste aktualisiert automatisch alle 15 Sekunden.",
    statusApproved:"Genehmigt", statusPending:"Ausstehend", editProfile:"PROFIL BEARBEITEN",
    online:"ONLINE",
  },
  fr: {
    login:"Connexion", register:"S'inscrire", name:"NOM", email:"ADRESSE E-MAIL",
    password:"MOT DE PASSE", confirmPassword:"CONFIRMER LE MOT DE PASSE",
    passwordConfirmPlaceholder:"Répéter le mot de passe",
    loginBtn:"SE CONNECTER", registerBtn:"CRÉER UN COMPTE", loading:"CHARGEMENT...",
    fillAll:"Veuillez remplir tous les champs.", minPw:"Le mot de passe doit contenir au moins 6 caractères.",
    pwNoMatch:"Les mots de passe ne correspondent pas.",
    registerSuccess:"Compte créé ! En attente d'approbation de l'administrateur.",
    waitApproval:"Après l'inscription, vous attendez l'approbation de l'admin.",
    connErr:"Erreur de connexion. Veuillez réessayer.", welcomeBack:"Bienvenue,",
    noAccess:"Accès Refusé", hello:"Bonjour", waitMsg:"votre compte attend l'approbation de l'administrateur.",
    waitInfo:"Votre demande est en cours d'examen. Vous aurez accès une fois approuvé.",
    logout:"SE DÉCONNECTER", settings:"Paramètres", profileDashboard:"PROFIL & TABLEAU DE BORD",
    profile:"Profil", passwordTab:"Mot de passe", dashboard:"Tableau de bord", account:"Compte",
    language:"Langue", languageTab:"Langue",
    profilePhoto:"Photo de profil", uploadPhoto:"Télécharger photo", removePhoto:"Supprimer",
    uploadInfo:"Téléchargez une photo (JPG/PNG, max 2Mo).",
    displayName:"NOM D'AFFICHAGE", emailLabel:"ADRESSE E-MAIL", notEditable:"NON MODIFIABLE",
    saveProfile:"SAUVEGARDER", saving:"SAUVEGARDE...", saved:"✓ Profil sauvegardé !",
    namRequired:"Le nom ne peut pas être vide.", photoTooBig:"La photo doit faire moins de 2Mo.",
    currentPw:"MOT DE PASSE ACTUEL", newPw:"NOUVEAU MOT DE PASSE", repeatPw:"RÉPÉTER LE NOUVEAU MOT DE PASSE",
    strength:"FORCE", weak:"Faible", fair:"Moyen", strong:"Fort", veryStrong:"Très fort",
    changePwBtn:"CHANGER MOT DE PASSE", pwChanged:"✓ Mot de passe changé !",
    pwTooShort:"Minimum 6 caractères requis.", pwNoMatchErr:"Les mots de passe ne correspondent pas.",
    currentPwWrong:"Mot de passe actuel incorrect.", fillPwAll:"Veuillez remplir tous les champs.",
    accentColor:"COULEUR D'ACCENT", customColor:"CODE COULEUR PERSONNALISÉ", apply:"Appliquer",
    livePreview:"APERÇU EN DIRECT",
    accountInfo:"INFORMATIONS DU COMPTE", nameLabel:"Nom", emailInfoLabel:"E-mail",
    roleLabel:"Rôle", statusLabel:"Statut", active:"Actif", pending:"En attente",
    administrator:"Administrateur", logoutTitle:"Déconnexion",
    logoutDesc:"Votre session sera terminée. Vous pourrez vous reconnecter à tout moment.",
    assetsTitle:"ACTIFS VISIBLES", assetsDesc:"Masquez les actifs que vous n'utilisez pas.",
    adminPanel:"PANNEAU ADMIN · GESTION DES UTILISATEURS", manageUsers:"Gérer les",
    users:"utilisateurs", total:"Total", approved:"Approuvés", inProgress:"En attente",
    refresh:"Actualiser", newRequests:"nouvelle demande", newRequestsPlural:"nouvelles demandes",
    waitApproval2:"en attente d'approbation",
    allUsers:"Tous les utilisateurs", inProgressTab:"En attente",
    colName:"NOM", colEmail:"E-MAIL", colStatus:"STATUT", colDate:"DATE", colActions:"ACTIONS",
    noRequests:"Aucune demande en attente.", noUsers:"Aucun utilisateur enregistré.",
    approveBtn:"Approuver", revokeBtn:"Révoquer", deleteBtn:"Supprimer",
    deleteConfirm:"Supprimer cet utilisateur ?", adminInfo:"Les utilisateurs approuvés ont un accès immédiat.",
    autoRefresh:"La liste se rafraîchit automatiquement toutes les 15 secondes.",
    statusApproved:"Approuvé", statusPending:"En attente", editProfile:"MODIFIER LE PROFIL",
    online:"EN LIGNE",
  },
  es: {
    login:"Iniciar sesión", register:"Registrarse", name:"NOMBRE", email:"CORREO ELECTRÓNICO",
    password:"CONTRASEÑA", confirmPassword:"CONFIRMAR CONTRASEÑA",
    passwordConfirmPlaceholder:"Repetir contraseña",
    loginBtn:"INICIAR SESIÓN", registerBtn:"CREAR CUENTA", loading:"CARGANDO...",
    fillAll:"Por favor completa todos los campos.", minPw:"La contraseña debe tener al menos 6 caracteres.",
    pwNoMatch:"Las contraseñas no coinciden.",
    registerSuccess:"¡Cuenta creada! Esperando aprobación del administrador.",
    waitApproval:"Tras el registro esperas la aprobación del admin.",
    connErr:"Error de conexión. Inténtalo de nuevo.", welcomeBack:"Bienvenido,",
    noAccess:"Acceso Denegado", hello:"Hola", waitMsg:"tu cuenta está esperando la aprobación del administrador.",
    waitInfo:"Tu solicitud está siendo revisada. Obtendrás acceso una vez aprobada.",
    logout:"CERRAR SESIÓN", settings:"Configuración", profileDashboard:"PERFIL & PANEL",
    profile:"Perfil", passwordTab:"Contraseña", dashboard:"Panel", account:"Cuenta",
    language:"Idioma", languageTab:"Idioma",
    profilePhoto:"Foto de perfil", uploadPhoto:"Subir foto", removePhoto:"Eliminar",
    uploadInfo:"Sube una foto (JPG/PNG, máx 2MB).",
    displayName:"NOMBRE VISIBLE", emailLabel:"CORREO ELECTRÓNICO", notEditable:"NO EDITABLE",
    saveProfile:"GUARDAR PERFIL", saving:"GUARDANDO...", saved:"✓ ¡Perfil guardado!",
    namRequired:"El nombre no puede estar vacío.", photoTooBig:"La foto debe ser menos de 2MB.",
    currentPw:"CONTRASEÑA ACTUAL", newPw:"NUEVA CONTRASEÑA", repeatPw:"REPETIR NUEVA CONTRASEÑA",
    strength:"FUERZA", weak:"Débil", fair:"Regular", strong:"Fuerte", veryStrong:"Muy fuerte",
    changePwBtn:"CAMBIAR CONTRASEÑA", pwChanged:"✓ ¡Contraseña cambiada!",
    pwTooShort:"Mínimo 6 caracteres requeridos.", pwNoMatchErr:"Las contraseñas no coinciden.",
    currentPwWrong:"Contraseña actual incorrecta.", fillPwAll:"Por favor completa todos los campos.",
    accentColor:"COLOR DE ACENTO", customColor:"CÓDIGO DE COLOR PERSONALIZADO", apply:"Aplicar",
    livePreview:"VISTA PREVIA",
    accountInfo:"INFORMACIÓN DE CUENTA", nameLabel:"Nombre", emailInfoLabel:"Correo",
    roleLabel:"Rol", statusLabel:"Estado", active:"Activo", pending:"Pendiente",
    administrator:"Administrador", logoutTitle:"Cerrar sesión",
    logoutDesc:"Tu sesión finalizará. Puedes volver a iniciar sesión cuando quieras.",
    assetsTitle:"ACTIVOS VISIBLES", assetsDesc:"Oculta los activos que no usas.",
    adminPanel:"PANEL ADMIN · GESTIÓN DE USUARIOS", manageUsers:"Gestionar",
    users:"usuarios", total:"Total", approved:"Aprobados", inProgress:"Pendiente",
    refresh:"Actualizar", newRequests:"nueva solicitud", newRequestsPlural:"nuevas solicitudes",
    waitApproval2:"esperando aprobación",
    allUsers:"Todos los usuarios", inProgressTab:"Pendiente",
    colName:"NOMBRE", colEmail:"CORREO", colStatus:"ESTADO", colDate:"FECHA", colActions:"ACCIONES",
    noRequests:"No hay solicitudes pendientes.", noUsers:"Aún no hay usuarios registrados.",
    approveBtn:"Aprobar", revokeBtn:"Revocar", deleteBtn:"Eliminar",
    deleteConfirm:"¿Eliminar este usuario?", adminInfo:"Los usuarios aprobados tienen acceso inmediato.",
    autoRefresh:"La lista se actualiza automáticamente cada 15 segundos.",
    statusApproved:"Aprobado", statusPending:"Pendiente", editProfile:"EDITAR PERFIL",
    online:"EN LÍNEA",
  },
  pt: {
    login:"Entrar", register:"Registrar", name:"NOME", email:"ENDEREÇO DE E-MAIL",
    password:"SENHA", confirmPassword:"CONFIRMAR SENHA",
    passwordConfirmPlaceholder:"Repetir senha",
    loginBtn:"ENTRAR", registerBtn:"CRIAR CONTA", loading:"CARREGANDO...",
    fillAll:"Por favor preencha todos os campos.", minPw:"A senha deve ter pelo menos 6 caracteres.",
    pwNoMatch:"As senhas não coincidem.",
    registerSuccess:"Conta criada! Aguardando aprovação do administrador.",
    waitApproval:"Após o registro você aguarda aprovação do admin.",
    connErr:"Erro de conexão. Tente novamente.", welcomeBack:"Bem-vindo,",
    noAccess:"Acesso Negado", hello:"Olá", waitMsg:"sua conta aguarda aprovação do administrador.",
    waitInfo:"Seu pedido está sendo revisado. Você terá acesso assim que aprovado.",
    logout:"SAIR", settings:"Configurações", profileDashboard:"PERFIL & PAINEL",
    profile:"Perfil", passwordTab:"Senha", dashboard:"Painel", account:"Conta",
    language:"Idioma", languageTab:"Idioma",
    profilePhoto:"Foto de perfil", uploadPhoto:"Enviar foto", removePhoto:"Remover",
    uploadInfo:"Envie uma foto (JPG/PNG, máx 2MB).",
    displayName:"NOME DE EXIBIÇÃO", emailLabel:"ENDEREÇO DE E-MAIL", notEditable:"NÃO EDITÁVEL",
    saveProfile:"SALVAR PERFIL", saving:"SALVANDO...", saved:"✓ Perfil salvo!",
    namRequired:"O nome não pode estar vazio.", photoTooBig:"A foto deve ter menos de 2MB.",
    currentPw:"SENHA ATUAL", newPw:"NOVA SENHA", repeatPw:"REPETIR NOVA SENHA",
    strength:"FORÇA", weak:"Fraca", fair:"Razoável", strong:"Forte", veryStrong:"Muito forte",
    changePwBtn:"ALTERAR SENHA", pwChanged:"✓ Senha alterada!",
    pwTooShort:"Mínimo 6 caracteres necessários.", pwNoMatchErr:"As senhas não coincidem.",
    currentPwWrong:"Senha atual incorreta.", fillPwAll:"Por favor preencha todos os campos.",
    accentColor:"COR DE DESTAQUE", customColor:"CÓDIGO DE COR PERSONALIZADO", apply:"Aplicar",
    livePreview:"VISUALIZAÇÃO AO VIVO",
    accountInfo:"INFORMAÇÕES DA CONTA", nameLabel:"Nome", emailInfoLabel:"E-mail",
    roleLabel:"Função", statusLabel:"Status", active:"Ativo", pending:"Pendente",
    administrator:"Administrador", logoutTitle:"Sair",
    logoutDesc:"Sua sessão será encerrada. Você pode entrar novamente a qualquer momento.",
    assetsTitle:"ATIVOS VISÍVEIS", assetsDesc:"Oculte os ativos que você não usa.",
    adminPanel:"PAINEL ADMIN · GERENCIAMENTO DE USUÁRIOS", manageUsers:"Gerenciar",
    users:"usuários", total:"Total", approved:"Aprovados", inProgress:"Pendente",
    refresh:"Atualizar", newRequests:"nova solicitação", newRequestsPlural:"novas solicitações",
    waitApproval2:"aguardando aprovação",
    allUsers:"Todos os usuários", inProgressTab:"Pendente",
    colName:"NOME", colEmail:"E-MAIL", colStatus:"STATUS", colDate:"DATA", colActions:"AÇÕES",
    noRequests:"Nenhuma solicitação pendente.", noUsers:"Nenhum usuário registrado ainda.",
    approveBtn:"Aprovar", revokeBtn:"Revogar", deleteBtn:"Excluir",
    deleteConfirm:"Excluir este usuário?", adminInfo:"Usuários aprovados têm acesso imediato.",
    autoRefresh:"A lista atualiza automaticamente a cada 15 segundos.",
    statusApproved:"Aprovado", statusPending:"Pendente", editProfile:"EDITAR PERFIL",
    online:"ONLINE",
  },
};

// Default assets list
const DEFAULT_ASSETS = ["xauusd","us30","us100","eurusd","gbpusd"];

// ── Preferences stored in localStorage ───────────────────────────────────────
function getPrefs() {
  try { return JSON.parse(localStorage.getItem("ht_prefs") || "{}"); } catch(_) { return {}; }
}
function savePrefs(p) { localStorage.setItem("ht_prefs", JSON.stringify(p)); }
function getLang()    { return getPrefs().lang || "nl"; }
function getHiddenAssets() { return getPrefs().hiddenAssets || []; }

// Session lives in localStorage
function getSession() {
  try { return JSON.parse(localStorage.getItem("ht_session") || "null"); } catch(_) { return null; }
}
async function anthropicFetch(body, headers={}) {
  const session = getSession();
  const fullBody = {
    ...body,
    _sessionUserId: session?.id    || "",
    _sessionEmail:  session?.email || "",
    ...(session?.adminToken ? { _adminToken: session.adminToken } : {}),
  };
  return fetch("/api/anthropic", {
    method:"POST",
    headers:{"Content-Type":"application/json", ...headers},
    body: JSON.stringify(fullBody),
  });
}
function saveSession(s) {
  if(s) localStorage.setItem("ht_session", JSON.stringify(s));
  else localStorage.removeItem("ht_session");
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiAuth(action, body) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({action, ...body}),
  });
  return res.json();
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const authInp = {
  width:"100%", padding:"16px 18px", background:"#0d0e13",
  border:"1px solid rgba(255,255,255,0.10)", borderRadius:8,
  color:"#e2e4e9", fontSize:13, outline:"none", fontFamily:"inherit",
  transition:"border-color 0.2s",
};
const btnSm = (color="#089981", bg="rgba(8,153,129,0.12)") => ({
  padding:"6px 14px", background:bg, border:`1px solid ${color}44`, borderRadius:6,
  color, fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:"0.04em",
  transition:"all .15s",
});

// ── Animated primary button ───────────────────────────────────────────────────
function AuthBtn({ onClick, children, accent, disabled }) {
  const ac = accent || "#089981";
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{position:"relative",width:"100%",padding:"13px",
        background:"linear-gradient(145deg,#0d0d10,#161820)",
        border:"1.5px solid rgba(255,255,255,0.15)",borderRadius:100,
        color:"#fff",fontSize:12,fontWeight:700,letterSpacing:"0.06em",
        cursor:disabled?"not-allowed":"pointer",overflow:"hidden",
        boxShadow:`0 0 ${hov?"40px":"20px"} ${ac}${hov?"55":"33"}`,
        transform:hov&&!disabled?"scale(1.03)":"scale(1)",
        transition:"all 0.3s ease",opacity:disabled?0.5:1,
        display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
      <div style={{position:"absolute",top:"-50%",left:"-50%",width:"200%",height:"200%",
        background:`conic-gradient(from 0deg,${ac},color-mix(in srgb,${ac} 75%,#22c55e),${ac})`,
        animation:hov?"superRotate 3s linear infinite":"none",
        opacity:hov?1:0,zIndex:0,transition:"opacity 0.3s"}}/>
      <div style={{position:"absolute",inset:2,background:"linear-gradient(145deg,#0d0d10,#161820)",borderRadius:"inherit",zIndex:1}}/>
      <span style={{position:"relative",zIndex:2}}>{children}</span>
    </button>
  );
}

// ── Glowing input wrapper ─────────────────────────────────────────────────────
function GlowInput({ accent, children, style, filled }) {
  const ac = accent || "#089981";
  const [hov, setHov]     = useState(false);
  const [focused, setFocused] = useState(false);

  const borderColor = focused ? ac : hov ? ac+"99" : filled ? ac+"55" : "rgba(255,255,255,0.10)";
  const glow        = focused ? `0 0 0 3px ${ac}33, 0 0 16px ${ac}44`
                    : hov     ? `0 0 0 2px ${ac}22, 0 0 10px ${ac}28`
                    : filled  ? `0 0 6px ${ac}20`
                    : "none";

  return (
    <div
      onMouseEnter={()=>setHov(true)}  onMouseLeave={()=>setHov(false)}
      onFocusCapture={()=>setFocused(true)} onBlurCapture={()=>setFocused(false)}
      style={{borderRadius:8, border:`1.5px solid ${borderColor}`,
        boxShadow: glow,
        transform: focused ? "scale(1.025)" : hov ? "scale(1.015)" : "scale(1)",
        transition:"all 0.2s ease", ...style}}>
      {children}
    </div>
  );
}

// ── Eye icon ──────────────────────────────────────────────────────────────────
const EyeIcon = ({open}) => open
  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;

// ── Password input with eye ───────────────────────────────────────────────────
function PwInput({ value, onChange, placeholder, accent, onKeyDown, filled }) {
  const [show, setShow] = useState(false);
  const ac = accent || "#089981";
  return (
    <GlowInput accent={ac} filled={filled}>
      <div style={{position:"relative"}}>
        <input className="auth-input" type={show?"text":"password"}
          placeholder={placeholder||"••••••••"} value={value} onChange={onChange}
          onKeyDown={onKeyDown} style={{...authInp,paddingRight:42,border:"none",background:"transparent"}}/>
        <button onClick={()=>setShow(s=>!s)}
          style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
            background:"none",border:"none",cursor:"pointer",color:show?ac:"#4b5563",
            padding:2,display:"flex",alignItems:"center",transition:"color .15s"}}>
          <EyeIcon open={show}/>
        </button>
      </div>
    </GlowInput>
  );
}

// ── Language Dropdown ─────────────────────────────────────────────────────────
function LangDropdown({ lang, onSwitch, accent }) {
  const ac = accent || "#089981";
  const [open, setOpen] = useState(false);
  const [hov, setHov]   = useState(false);
  const current = LANGS[lang] || LANGS.nl;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  return (
    <div style={{display:"inline-block",position:"relative",marginTop:14}}>
      {/* Trigger button — same glow animation as AuthBtn */}
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{position:"relative",display:"inline-flex",alignItems:"center",gap:7,
          padding:"7px 14px 7px 10px",
          background:"linear-gradient(145deg,#0d0d10,#161820)",
          border:"1.5px solid rgba(255,255,255,0.13)",borderRadius:100,
          color:"#e2e4e9",fontSize:12,fontWeight:600,cursor:"pointer",
          overflow:"hidden",letterSpacing:"0.02em",
          boxShadow:`0 0 ${hov?"28px":"12px"} ${ac}${hov?"44":"22"}`,
          transform:hov?"scale(1.04)":"scale(1)",
          transition:"all 0.25s ease"}}>
        {/* Spinning glow — same as AuthBtn */}
        <div style={{position:"absolute",top:"-50%",left:"-50%",width:"200%",height:"200%",
          background:`conic-gradient(from 0deg,${ac},color-mix(in srgb,${ac} 75%,#22c55e),${ac})`,
          animation:hov?"superRotate 3s linear infinite":"none",
          opacity:hov?1:0,zIndex:0,transition:"opacity 0.25s"}}/>
        <div style={{position:"absolute",inset:2,background:"linear-gradient(145deg,#0d0d10,#161820)",borderRadius:"inherit",zIndex:1}}/>
        <span style={{position:"relative",zIndex:2,fontSize:15}}>{current.flag}</span>
        <span style={{position:"relative",zIndex:2}}>{current.label}</span>
        {/* Chevron */}
        <svg style={{position:"relative",zIndex:2,transition:"transform .2s",transform:open?"rotate(180deg)":"rotate(0deg)"}}
          width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown — opens to the left so it stays on screen */}
      {open && (
        <div onClick={e => e.stopPropagation()}
          style={{position:"absolute",top:"calc(100% + 8px)",right:0,
            background:"linear-gradient(160deg,#111420,#0c0d12)",
            border:"1px solid rgba(255,255,255,0.10)",borderRadius:10,
            boxShadow:"0 12px 40px rgba(0,0,0,0.7)",zIndex:200,
            minWidth:160,overflow:"hidden",
            animation:"deepIn .15s cubic-bezier(.16,1,.3,1) both"}}>
          {Object.values(LANGS).map(l => (
            <button key={l.code}
              onClick={() => { onSwitch(l.code); setOpen(false); }}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,
                padding:"9px 14px",background:"transparent",border:"none",
                cursor:"pointer",textAlign:"left",transition:"background .12s",
                borderBottom:"1px solid #262626"}}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{fontSize:16}}>{l.flag}</span>
              <span style={{fontSize:12,fontWeight:lang===l.code?700:400,
                color:lang===l.code?ac:"#9ca3af",flex:1}}>{l.label}</span>
              {lang === l.code && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke={ac} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab switcher with sliding pill ───────────────────────────────────────────
function AuthTabs({ mode, onSwitch, accent, labels }) {
  const ac = accent || "#089981";
  const [hov, setHov] = useState(null);
  const active = mode === "login" ? 0 : 1;

  return (
    <div style={{position:"relative", display:"flex", gap:4,
      background:"rgba(0,0,0,0.35)", borderRadius:8, padding:4, marginBottom:24,
      boxShadow: hov ? "none" : `0 0 14px ${ac}22`,
      transition:"box-shadow 0.2s ease"}}>

      {/* Sliding pill */}
      <div style={{position:"absolute",
        top:4, bottom:4,
        left: active === 0 ? 4 : "50%",
        width:"calc(50% - 4px)",
        background:"rgba(255,255,255,0.06)",
        borderRadius:6,
        border:`1px solid ${hov ? ac+"22" : ac+"55"}`,
        boxShadow: hov ? "none" : `0 0 10px ${ac}44`,
        transition:"left 0.25s cubic-bezier(.4,0,.2,1), box-shadow 0.25s ease, border-color 0.25s ease",
        pointerEvents:"none", zIndex:0}}/>

      {[{id:"login",label:labels[0]},{id:"register",label:labels[1]}].map((tab) => (
        <button key={tab.id}
          onClick={()=>onSwitch(tab.id)}
          onMouseEnter={()=>setHov(tab.id)}
          onMouseLeave={()=>setHov(null)}
          style={{flex:1, position:"relative", zIndex:1,
            padding:"8px 18px", border:"none",
            background:"transparent",
            borderRadius:6, overflow:"hidden",
            cursor:"pointer", fontSize:12, fontWeight:600,
            letterSpacing:"0.04em",
            color: mode===tab.id ? "#fff" : hov===tab.id ? "#9ca3af" : "#4b5563",
            transition:"color 0.2s"}}>
          {/* Spinning conic layer */}
          <div style={{position:"absolute",top:"-50%",left:"-50%",width:"200%",height:"200%",
            background:`conic-gradient(from 0deg,${ac},color-mix(in srgb,${ac} 60%,#22c55e),${ac})`,
            animation:"superRotate 3s linear infinite",
            opacity: hov===tab.id ? 1 : 0,
            transition:"opacity 0.3s ease", pointerEvents:"none", zIndex:0}}/>
          {/* Inner mask — transparent so pill shows through, but hides spinning fill */}
          <div style={{position:"absolute", inset:1.5,
            background:"#0d0e13",
            borderRadius:5, zIndex:1, pointerEvents:"none"}}/>
          <span style={{position:"relative", zIndex:2}}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onLogin, accent }) {
  const [mode, setMode]     = useState("login");
  const [email, setEmail]   = useState("");
  const [pw, setPw]         = useState("");
  const [pw2, setPw2]       = useState("");
  const [name, setName]     = useState("");
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang]     = useState(getLang());
  const ac = accent || "#089981";
  const t = T[lang] || T.nl;

  // Save lang preference
  const switchLang = (l) => { setLang(l); savePrefs({...getPrefs(), lang:l}); };

  async function doLogin() {
    setError(""); setLoading(true);
    if(!email.trim() || !pw) { setError(t.fillAll); setLoading(false); return; }
    try {
      const data = await apiAuth("login", {email:email.trim().toLowerCase(), password:pw});
      if(data.error) { setError(data.error); setLoading(false); return; }
      saveSession(data.session); onLogin(data.session, pw);
    } catch(_) { setError(t.connErr); }
    setLoading(false);
  }

  async function doRegister() {
    setError(""); setLoading(true);
    if(!name.trim() || !email.trim() || !pw) { setError(t.fillAll); setLoading(false); return; }
    if(pw.length < 6) { setError(t.minPw); setLoading(false); return; }
    if(pw !== pw2) { setError(t.pwNoMatch); setLoading(false); return; }
    try {
      const data = await apiAuth("register", {email:email.trim().toLowerCase(), name:name.trim(), password:pw});
      if(data.error) { setError(data.error); setLoading(false); return; }
      setSuccess(t.registerSuccess);
      setMode("login"); setEmail(email.trim().toLowerCase()); setPw(""); setPw2("");
    } catch(_) { setError(t.connErr); }
    setLoading(false);
  }

  const onKey = (fn) => (e) => { if(e.key==="Enter") fn(); };

  return (
    <div style={{minHeight:"100vh",background:"#070708",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif",color:"#e2e4e9",padding:20}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes superRotate{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes deepIn{0%{opacity:0;transform:translateY(-6px)}100%{opacity:1;transform:translateY(0)}}
        .auth-input:focus{border-color:transparent!important;outline:none;box-shadow:none;}
        .auth-tab{cursor:pointer;padding:8px 18px;border-radius:6px;font-size:12px;font-weight:600;letter-spacing:.04em;transition:all .2s;border:none;background:transparent}
        .auth-tab.active{background:rgba(255,255,255,0.06);color:#fff}
        .auth-tab:not(.active){color:#4b5563}
        .auth-tab:not(.active):hover{color:#9ca3af;background:rgba(255,255,255,0.03)}
      `}</style>

      {/* Language dropdown — top right corner */}
      <div style={{position:"fixed",top:16,right:20,zIndex:300}}>
        <LangDropdown lang={lang} onSwitch={switchLang} accent={ac}/>
      </div>

      {/* Background glows */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Main glow — centered behind login box, strong and visible */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
          width:600,height:500,
          background:`radial-gradient(ellipse at center,${ac}35 0%,${ac}18 30%,${ac}06 60%,transparent 75%)`,
          filter:"blur(40px)"}}/>
        {/* Secondary softer halo */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
          width:900,height:700,
          background:`radial-gradient(ellipse at center,${ac}12 0%,transparent 60%)`,
          filter:"blur(80px)"}}/>
      </div>

      <div style={{position:"relative",width:"100%",maxWidth:420}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:26,fontWeight:800,letterSpacing:"-0.02em",color:"#f1f2f4"}}>Hybrid<span style={{color:ac}}>Trader</span></div>
          <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.18em",fontFamily:"'JetBrains Mono',monospace",marginTop:4}}>INSTITUTIONAL TRADING DASHBOARD</div>
        </div>

        <div style={{background:"linear-gradient(160deg,#111420,#0d1016)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:14,padding:"32px 28px",boxShadow:"0 8px 40px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.05)"}}>
          <div style={{marginBottom:24}}>
          <AuthTabs mode={mode} accent={ac}
            labels={[t.login, t.register]}
            onSwitch={(id)=>{setMode(id);setError("");setSuccess("");}}/>
          </div>

          {success && <div style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#4ade80",lineHeight:1.5}}>{success}</div>}
          {error   && <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#f87171"}}>{error}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {mode==="register" && (
              <div>
                <div style={{fontSize:10,color:"#e2e4e9",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>{t.name}</div>
                <GlowInput accent={ac} filled={!!name}>
                  <input className="auth-input" type="text" placeholder={t.name.charAt(0)+t.name.slice(1).toLowerCase()} value={name}
                    onChange={e=>setName(e.target.value)} onKeyDown={onKey(doRegister)} style={{...authInp,border:"none",background:"transparent"}}/>
                </GlowInput>
              </div>
            )}
            <div>
              <div style={{fontSize:10,color:"#e2e4e9",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>{t.email}</div>
              <GlowInput accent={ac} filled={!!email}>
                <input className="auth-input" type="email" placeholder="name@email.com" value={email}
                  onChange={e=>setEmail(e.target.value)} onKeyDown={onKey(mode==="login"?doLogin:doRegister)} style={{...authInp,border:"none",background:"transparent"}}/>
              </GlowInput>
            </div>
            <div>
              <div style={{fontSize:10,color:"#e2e4e9",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>{t.password}</div>
              <PwInput value={pw} onChange={e=>setPw(e.target.value)} filled={!!pw}
                placeholder={mode==="register"?"Min. 6":"••••••••"} accent={ac}
                onKeyDown={mode==="login"?onKey(doLogin):undefined}/>
            </div>
            {/* Confirm password — only on register */}
            {mode==="register" && (
              <div>
                <div style={{fontSize:10,color:"#e2e4e9",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>{t.confirmPassword}</div>
                <PwInput value={pw2} onChange={e=>setPw2(e.target.value)} filled={!!pw2}
                  placeholder={t.passwordConfirmPlaceholder} accent={ac}
                  onKeyDown={onKey(doRegister)}/>
                {/* Match indicator */}
                {pw2.length > 0 && (
                  <div style={{marginTop:6,fontSize:10,color:pw===pw2?"#22c55e":"#f87171",display:"flex",alignItems:"center",gap:4}}>
                    {pw===pw2 ? "✓" : "✗"} {pw===pw2 ? (lang==="nl"?"Wachtwoorden komen overeen":lang==="de"?"Passwörter stimmen überein":lang==="fr"?"Les mots de passe correspondent":"Passwords match") : t.pwNoMatch}
                  </div>
                )}
              </div>
            )}
            <AuthBtn onClick={mode==="login"?doLogin:doRegister} accent={ac} disabled={loading}>
              {loading?t.loading:(mode==="login"?t.loginBtn:t.registerBtn)}
            </AuthBtn>
            {mode==="register" && <div style={{fontSize:11,color:"#4b5563",textAlign:"center",lineHeight:1.6}}>{t.waitApproval}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Access Denied ─────────────────────────────────────────────────────────────
function AccessDenied({ user, onLogout, accent }) {
  const ac = accent || "#089981";
  const t = T[getLang()] || T.nl;
  return (
    <div style={{minHeight:"100vh",background:"#070708",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif",color:"#e2e4e9",padding:20}}>
      <style>{`@keyframes superRotate{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      <div style={{position:"fixed",inset:0,pointerEvents:"none"}}>
        <div style={{position:"absolute",top:"20%",left:"30%",width:"60%",height:"60%",background:"radial-gradient(ellipse at center,rgba(239,68,68,0.10),transparent 65%)",filter:"blur(80px)"}}/>
      </div>
      <div style={{position:"relative",textAlign:"center",maxWidth:420}}>
        <div style={{fontSize:48,marginBottom:20}}>🚫</div>
        <div style={{fontSize:22,fontWeight:800,color:"#f87171",marginBottom:10}}>{t.noAccess}</div>
        <div style={{fontSize:13,color:"#6b7280",lineHeight:1.8,marginBottom:28}}>
          {t.hello} <span style={{color:"#e2e4e9",fontWeight:600}}>{user?.name}</span>, {t.waitMsg}
        </div>
        <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"16px 20px",marginBottom:28,fontSize:12,color:"#f87171",lineHeight:1.6}}>
          ⏳ {t.waitInfo}
        </div>
        <AuthBtn onClick={onLogout} accent="#ef4444">{t.logout}</AuthBtn>
      </div>
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({ accent }) {
  const [users, setUsers]     = useState([]);
  const [tab, setTab]         = useState("users");
  const [loading, setLoading] = useState(true);
  const ac = accent || "#089981";
  const t = T[getLang()] || T.nl;
  const ADMIN_PASSWORD = getSession()?.adminKey || "";

  async function loadUsers() {
    setLoading(true);
    try {
      const s = getSession();
      const data = await apiAuth("listUsers", {
        adminKey:   getAdminKey(),
        adminToken: s?.adminToken || "",
      });
      if(data.users) setUsers(data.users);
    } catch(_) {}
    setLoading(false);
  }

  useEffect(()=>{ loadUsers(); },[]);
  useEffect(()=>{ const ti=setInterval(loadUsers,15000); return ()=>clearInterval(ti); },[]);

  async function approve(id) { const s=getSession(); await apiAuth("approveUser",{id,adminKey:getAdminKey(),adminToken:s?.adminToken||""}); loadUsers(); }
  async function deny(id)    { const s=getSession(); await apiAuth("denyUser",{id,adminKey:getAdminKey(),adminToken:s?.adminToken||""}); loadUsers(); }
  async function del(id)     {
    if(!confirm(t.deleteConfirm)) return;
    const s=getSession(); await apiAuth("deleteUser",{id,adminKey:getAdminKey(),adminToken:s?.adminToken||""}); loadUsers();
  }

  const pending  = users.filter(u=>!u.approved);
  const approved = users.filter(u=>u.approved);
  const list     = tab==="users" ? users : pending;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{padding:"8px 0 4px",position:"relative"}}>
        <div style={{position:"absolute",top:-40,right:0,width:280,height:180,borderRadius:"50%",background:`radial-gradient(circle,${ac}0f,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.18em",color:"#4b5563",fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>{t.adminPanel}</div>
          <div style={{fontSize:22,fontWeight:800,color:"#f1f2f4",letterSpacing:"-0.02em",marginBottom:8}}>{t.manageUsers} <span style={{color:ac}}>{t.users}</span></div>
          <div style={{display:"flex",gap:16,marginTop:12,alignItems:"center",flexWrap:"wrap"}}>
            {[{label:t.total,val:users.length,color:"#6b7280"},{label:t.approved,val:approved.length,color:"#22c55e"},{label:t.inProgress,val:pending.length,color:"#f59e0b"}].map(({label,val,color})=>(
              <div key={label} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"10px 16px",minWidth:80}}>
                <div style={{fontSize:20,fontWeight:800,color,fontFamily:"'JetBrains Mono',monospace"}}>{val}</div>
                <div style={{fontSize:8,color:"#4b5563",letterSpacing:"0.1em",marginTop:2}}>{label.toUpperCase()}</div>
              </div>
            ))}
            <button onClick={loadUsers} style={{marginLeft:"auto",padding:"8px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"#6b7280",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {t.refresh}
            </button>
          </div>
          {pending.length > 0 && (
            <div style={{marginTop:12,padding:"8px 12px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:6,fontSize:11,color:"#f59e0b",display:"flex",alignItems:"center",gap:6}}>
              🔔 {pending.length} {pending.length>1?t.newRequestsPlural:t.newRequests} {t.waitApproval2}
            </div>
          )}
        </div>
      </div>

      <div style={{display:"flex",gap:4,background:"rgba(0,0,0,0.3)",borderRadius:8,padding:4,width:"fit-content"}}>
        {[{id:"users",label:t.allUsers},{id:"pending",label:`${t.inProgressTab} (${pending.length})`}].map(tab2=>(
          <button key={tab2.id} onClick={()=>setTab(tab2.id)}
            style={{padding:"7px 16px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,letterSpacing:"0.04em",cursor:"pointer",
              background:tab===tab2.id?"rgba(255,255,255,0.07)":"transparent",color:tab===tab2.id?"#fff":"#4b5563",transition:"all .2s"}}>
            {tab2.label}
          </button>
        ))}
      </div>

      <div style={{background:"linear-gradient(160deg,#0f1116,#0c0d12)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1.6fr",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"10px 16px"}}>
          {[t.colName,t.colEmail,t.colStatus,t.colDate,t.colActions].map(h=>(
            <div key={h} style={{fontSize:8,fontWeight:700,color:"#4b5563",letterSpacing:"0.14em",fontFamily:"'JetBrains Mono',monospace"}}>{h}</div>
          ))}
        </div>
        {loading ? (
          <div style={{padding:"32px",textAlign:"center",color:"#4b5563",fontSize:12}}>...</div>
        ) : list.length===0 ? (
          <div style={{padding:"32px",textAlign:"center",color:"#4b5563",fontSize:12}}>
            {tab==="pending"?t.noRequests:t.noUsers}
          </div>
        ) : list.map((u,i)=>(
          <div key={u.id} style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1.6fr",padding:"12px 16px",borderBottom:i<list.length-1?"1px solid rgba(255,255,255,0.04)":"none",alignItems:"center"}}>
            <div style={{fontSize:12,fontWeight:600,color:"#e2e4e9"}}>{u.name}</div>
            <div style={{fontSize:11,color:"#6b7280",fontFamily:"'JetBrains Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email}</div>
            <div>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",padding:"3px 8px",borderRadius:4,
                background:u.approved?"rgba(34,197,94,0.10)":"rgba(245,158,11,0.10)",
                color:u.approved?"#22c55e":"#f59e0b",
                border:`1px solid ${u.approved?"rgba(34,197,94,0.25)":"rgba(245,158,11,0.25)"}`}}>
                {u.approved?t.statusApproved:t.statusPending}
              </span>
            </div>
            <div style={{fontSize:10,color:"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>
              {u.registeredAt?new Date(u.registeredAt).toLocaleDateString("nl-NL",{day:"2-digit",month:"2-digit",year:"2-digit"}):"—"}
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {!u.approved && <button onClick={()=>approve(u.id)} style={btnSm("#22c55e","rgba(34,197,94,0.08)")}>{t.approveBtn}</button>}
              {u.approved  && <button onClick={()=>deny(u.id)}    style={btnSm("#f59e0b","rgba(245,158,11,0.08)")}>{t.revokeBtn}</button>}
              <button onClick={()=>del(u.id)} style={btnSm("#ef4444","rgba(239,68,68,0.08)")}>{t.deleteBtn}</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,padding:"12px 16px",display:"flex",gap:10}}>
        <span style={{fontSize:14}}>ℹ️</span>
        <span style={{fontSize:11,color:"#6b7280",lineHeight:1.6}}>{t.autoRefresh} {t.adminInfo}</span>
      </div>
    </div>
  );
}

// ── Profile Modal ─────────────────────────────────────────────────────────────
function ProfileModal({ session, accent, setAccent, onLogout, onClose, onSessionUpdate }) {
  const ac = accent || "#089981";
  const [tab, setTab]       = useState("profiel");
  const [name, setName]     = useState(session?.name || "");
  const [avatar, setAvatar] = useState(session?.avatar || null);
  const [oldPw, setOldPw]   = useState("");
  const [newPw, setNewPw]   = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [msg, setMsg]       = useState(null);
  const [saving, setSaving] = useState(false);
  const [lang, setLang]     = useState(getLang());
  const [hidden, setHidden] = useState(getHiddenAssets());
  const presets = ["#089981","#6366f1","#f59e0b","#22c55e","#ec4899","#ef4444","#3b82f6","#a855f7"];
  const [customColor, setCustomColor] = useState(ac);
  const t = T[lang] || T.nl;

  const flash = (type, text) => { setMsg({type,text}); setTimeout(()=>setMsg(null),3500); };

  function switchLang(l) {
    setLang(l);
    savePrefs({...getPrefs(), lang:l});
  }

  function toggleAsset(id) {
    const next = hidden.includes(id) ? hidden.filter(x=>x!==id) : [...hidden, id];
    setHidden(next);
    savePrefs({...getPrefs(), hiddenAssets:next});
  }

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0]; if(!file) return;
    if(file.size > 2*1024*1024) { flash("err",t.photoTooBig); return; }
    const reader = new FileReader();
    reader.onload = ev => setAvatar(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function saveProfiel() {
    if(!name.trim()) { flash("err",t.namRequired); return; }
    setSaving(true);
    const updated = {...session, name:name.trim(), avatar};
    if(session.role !== "admin") {
      await apiAuth("updateProfile", {email:session.email, name:name.trim(), avatar});
    }
    saveSession(updated);
    onSessionUpdate(updated);
    flash("ok",t.saved);
    setSaving(false);
  }

  async function saveWachtwoord() {
    if(!newPw || !newPw2) { flash("err",t.fillPwAll); return; }
    if(newPw !== newPw2)  { flash("err",t.pwNoMatchErr); return; }
    if(newPw.length < 6)  { flash("err",t.pwTooShort); return; }
    if(session.role !== "admin") {
      if(!oldPw) { flash("err",t.fillPwAll); return; }
      const data = await apiAuth("changePassword", {email:session.email, oldPassword:oldPw, newPassword:newPw});
      if(data.error) { flash("err",data.error); return; }
    }
    setOldPw(""); setNewPw(""); setNewPw2("");
    flash("ok",t.pwChanged);
  }

  // Asset labels map
  const ASSET_LABELS = {xauusd:"XAU/USD",us30:"US30",us100:"US100",eurusd:"EUR/USD",gbpusd:"GBP/USD"};

  const tabs = [
    {id:"profiel",    label:t.profile,      icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>},
    {id:"wachtwoord", label:t.passwordTab,  icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>},
    {id:"dashboard",  label:t.dashboard,    icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>},
    {id:"taal",       label:t.languageTab,  icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" strokeWidth="1.5"/></svg>},
    {id:"account",    label:t.account,      icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>},
  ];
  const initials = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"U";

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:560,maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",background:"linear-gradient(160deg,#111420,#0c0d12)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:16,boxShadow:"0 24px 80px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.06)",animation:"deepIn .3s cubic-bezier(.16,1,.3,1) both"}}>
        <div style={{padding:"20px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:"#f1f2f4",letterSpacing:"-0.01em"}}>{t.settings}</div>
            <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.14em",fontFamily:"'JetBrains Mono',monospace",marginTop:3}}>{t.profileDashboard}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"#6b7280",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,flexShrink:0}}>×</button>
        </div>
        {/* Tab bar — scrollable on small screens */}
        <div style={{display:"flex",gap:2,padding:"16px 24px 0",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.05)",overflowX:"auto"}}>
          {tabs.map(tb=>(
            <button key={tb.id} onClick={()=>setTab(tb.id)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:"8px 8px 0 0",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:"0.03em",transition:"all .15s",marginBottom:-1,whiteSpace:"nowrap",
                background:tab===tb.id?"rgba(255,255,255,0.06)":"transparent",
                color:tab===tb.id?"#e2e4e9":"#4b5563",
                borderBottom:tab===tb.id?`2px solid ${ac}`:"2px solid transparent"}}>
              {tb.icon}{tb.label}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 24px 24px"}}>
          {msg && (
            <div style={{marginBottom:16,padding:"10px 14px",borderRadius:8,fontSize:12,fontWeight:500,
              background:msg.type==="ok"?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)",
              border:`1px solid ${msg.type==="ok"?"rgba(34,197,94,0.25)":"rgba(239,68,68,0.25)"}`,
              color:msg.type==="ok"?"#4ade80":"#f87171"}}>
              {msg.text}
            </div>
          )}

          {/* ── PROFIEL ── */}
          {tab==="profiel" && (
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
                <div style={{width:80,height:80,borderRadius:"50%",overflow:"hidden",border:`3px solid ${ac}50`,flexShrink:0}}>
                  {avatar
                    ? <img src={avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="avatar"/>
                    : <div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${ac}40,${ac}20)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:22,fontWeight:800,color:ac}}>{initials}</span>
                      </div>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:600,color:"#e2e4e9",marginBottom:6}}>{t.profilePhoto}</div>
                  <div style={{fontSize:11,color:"#6b7280",marginBottom:12,lineHeight:1.6}}>{t.uploadInfo}</div>
                  <div style={{display:"flex",gap:8}}>
                    <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",background:`${ac}15`,border:`1px solid ${ac}40`,borderRadius:8,color:ac,fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:"0.04em"}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {t.uploadPhoto}
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{display:"none"}}/>
                    </label>
                    {avatar && <button onClick={()=>setAvatar(null)} style={{padding:"8px 12px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,color:"#ef4444",fontSize:11,cursor:"pointer"}}>{t.removePhoto}</button>}
                  </div>
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>{t.displayName}</div>
                <input value={name} onChange={e=>setName(e.target.value)} style={authInp}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>{t.emailLabel}</div>
                <div style={{...authInp,color:"#6b7280",cursor:"not-allowed",display:"flex",alignItems:"center",gap:8}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.5"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.5"/></svg>
                  {session?.email}
                  <span style={{marginLeft:"auto",fontSize:9,color:"#2d3748",fontFamily:"'JetBrains Mono',monospace"}}>{t.notEditable}</span>
                </div>
              </div>
              <AuthBtn onClick={saveProfiel} accent={ac} disabled={saving}>{saving?t.saving:t.saveProfile}</AuthBtn>
            </div>
          )}

          {/* ── WACHTWOORD ── */}
          {tab==="wachtwoord" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{padding:"12px 14px",background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:8,fontSize:11,color:"#818cf8",lineHeight:1.6}}>
                🔒 {t.minPw}
              </div>
              {session?.role !== "admin" && (
                <div>
                  <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>{t.currentPw}</div>
                  <PwInput value={oldPw} onChange={e=>setOldPw(e.target.value)} placeholder="••••••••" accent={ac}/>
                </div>
              )}
              <div>
                <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>{t.newPw}</div>
                <PwInput value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="••••••••" accent={ac}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>{t.repeatPw}</div>
                <PwInput value={newPw2} onChange={e=>setNewPw2(e.target.value)} placeholder="••••••••" accent={ac}/>
              </div>
              {newPw && (
                <div>
                  <div style={{fontSize:9,color:"#4b5563",marginBottom:4,fontFamily:"'JetBrains Mono',monospace"}}>{t.strength}</div>
                  <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:2,transition:"width .3s",
                      width:newPw.length<6?"20%":newPw.length<8?"50%":newPw.length<12?"75%":"100%",
                      background:newPw.length<6?"#ef4444":newPw.length<8?"#f59e0b":newPw.length<12?"#22c55e":ac}}/>
                  </div>
                  <div style={{fontSize:9,color:"#4b5563",marginTop:3}}>
                    {newPw.length<6?t.weak:newPw.length<8?t.fair:newPw.length<12?t.strong:t.veryStrong}
                  </div>
                </div>
              )}
              <AuthBtn onClick={saveWachtwoord} accent={ac}>{t.changePwBtn}</AuthBtn>
            </div>
          )}

          {/* ── DASHBOARD (kleuren) ── */}
          {tab==="dashboard" && (
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              <div>
                <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",marginBottom:10,fontFamily:"'JetBrains Mono',monospace"}}>{t.accentColor}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
                  {presets.map(color=>(
                    <button key={color} onClick={()=>{setAccent(color);setCustomColor(color);}}
                      style={{width:36,height:36,borderRadius:"50%",background:color,cursor:"pointer",flexShrink:0,
                        transition:"transform .15s, box-shadow .15s",
                        border:accent===color?"3px solid #fff":"3px solid transparent",
                        transform:accent===color?"scale(1.18)":"scale(1)",
                        boxShadow:accent===color?`0 0 12px ${color}90`:"none"}}>
                    </button>
                  ))}
                </div>
                <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>{t.customColor}</div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input type="color" value={customColor} onChange={e=>setCustomColor(e.target.value)}
                    style={{width:34,height:34,borderRadius:6,border:"1px solid rgba(255,255,255,0.1)",background:"none",cursor:"pointer",padding:2,flexShrink:0}}/>
                  <input type="text" value={customColor} onChange={e=>setCustomColor(e.target.value)} placeholder="#089981"
                    style={{...authInp,width:110,flex:"none",padding:"9px 10px",fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}/>
                  <button onClick={()=>setAccent(customColor)}
                    style={{flex:1,padding:"9px 14px",background:`${ac}18`,border:`1px solid ${ac}40`,borderRadius:8,color:ac,fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:"0.05em",transition:"all .15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background=`${ac}30`;}}
                    onMouseLeave={e=>{e.currentTarget.style.background=`${ac}18`;}}>
                    {t.apply}
                  </button>
                </div>
              </div>
              {/* Live preview */}
              <div style={{padding:"16px 18px",background:`${accent}0c`,border:`1px solid ${accent}25`,borderRadius:10}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.12em",fontFamily:"'JetBrains Mono',monospace",marginBottom:8}}>{t.livePreview}</div>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:`${accent}20`,border:`2px solid ${accent}50`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:13,fontWeight:800,color:accent}}>{initials}</span>
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:"#f1f2f4"}}>Hybrid<span style={{color:accent}}>Trader</span></div>
                    <div style={{fontSize:8,color:accent,letterSpacing:"0.1em",fontFamily:"'JetBrains Mono',monospace",marginTop:1}}>● LIVE</div>
                  </div>
                </div>
              </div>
              {/* Assets visibility */}
              <div>
                <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",marginBottom:4,fontFamily:"'JetBrains Mono',monospace"}}>{t.assetsTitle}</div>
                <div style={{fontSize:11,color:"#4b5563",marginBottom:12}}>{t.assetsDesc}</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {DEFAULT_ASSETS.map(id=>{
                    const visible = !hidden.includes(id);
                    return (
                      <div key={id} onClick={()=>toggleAsset(id)}
                        style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",
                          background:visible?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.2)",
                          border:`1px solid ${visible?ac+"30":"rgba(255,255,255,0.05)"}`,
                          borderRadius:8,cursor:"pointer",transition:"all .15s"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:visible?ac:"#374151",transition:"background .15s"}}/>
                          <span style={{fontSize:12,fontWeight:600,color:visible?"#e2e4e9":"#4b5563",fontFamily:"'JetBrains Mono',monospace"}}>{ASSET_LABELS[id]}</span>
                        </div>
                        {/* Toggle switch */}
                        <div style={{width:36,height:20,borderRadius:10,background:visible?ac:"rgba(255,255,255,0.08)",position:"relative",transition:"background .2s",flexShrink:0}}>
                          <div style={{position:"absolute",top:3,left:visible?18:3,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── TAAL ── */}
          {tab==="taal" && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.1em",marginBottom:4,fontFamily:"'JetBrains Mono',monospace"}}>{t.language.toUpperCase()}</div>
              {Object.values(LANGS).map(l=>(
                <button key={l.code} onClick={()=>switchLang(l.code)}
                  style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",
                    background:lang===l.code?`${ac}12`:"rgba(255,255,255,0.02)",
                    border:`1px solid ${lang===l.code?ac+"40":"rgba(255,255,255,0.06)"}`,
                    borderRadius:10,cursor:"pointer",transition:"all .15s",textAlign:"left"}}>
                  <span style={{fontSize:24}}>{l.flag}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:lang===l.code?ac:"#e2e4e9"}}>{l.label}</div>
                    <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.08em",marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>{l.code.toUpperCase()}</div>
                  </div>
                  {lang===l.code && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={ac} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {tab==="account" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{padding:"16px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.12em",fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>{t.accountInfo}</div>
                {[
                  {label:t.nameLabel,  val:session?.name||"—"},
                  {label:t.emailInfoLabel, val:session?.email||"—"},
                  ...(session?.role==="admin"?[{label:t.roleLabel, val:t.administrator, color:"#f59e0b"}]:[]),
                  {label:t.statusLabel, val:session?.approved?t.active:t.pending, color:session?.approved?"#22c55e":"#f59e0b"},
                ].map(({label,val,color})=>(
                  <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #262626"}}>
                    <span style={{fontSize:11,color:"#6b7280"}}>{label}</span>
                    <span style={{fontSize:11,fontWeight:600,color:color||"#e2e4e9",fontFamily:label===t.emailInfoLabel?"'JetBrains Mono',monospace":"inherit"}}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{padding:"14px",background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:10}}>
                <div style={{fontSize:11,fontWeight:600,color:"#f87171",marginBottom:4}}>{t.logoutTitle}</div>
                <div style={{fontSize:11,color:"#6b7280",marginBottom:14,lineHeight:1.6}}>{t.logoutDesc}</div>
                <AuthBtn onClick={onLogout} accent="#ef4444">{t.logout}</AuthBtn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Settings Panel stub ───────────────────────────────────────────────────────
function SettingsPanel() { return null; }

// ── Admin key helpers (sessionStorage — cleared on tab close) ─────────────────
function getAdminKey() { try { return sessionStorage.getItem("ht_ak") || ""; } catch(_){ return ""; } }
function setAdminKey(k) { try { sessionStorage.setItem("ht_ak", k); } catch(_){} }
function clearAdminKey() { try { sessionStorage.removeItem("ht_ak"); } catch(_){} }

// ── Main App Wrapper ──────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(() => getSession());
  const [accent,  setAccent]  = useState(DEFAULT_ACCENT);

  function handleLogin(s, rawPassword) {
    setSession(s);
    // Store admin password in sessionStorage so AdminPanel can make API calls.
    // It's only kept for the duration of the browser session and never in localStorage.
    if(s.role === "admin" && rawPassword) setAdminKey(rawPassword);
  }
  function handleLogout() { saveSession(null); setSession(null); clearAdminKey(); }

  function handleSessionUpdate(updated) {
    saveSession(updated);
    setSession({...updated});
  }

  if(!session)          return <AuthScreen onLogin={handleLogin} accent={accent}/>;
  if(!session.approved) return <AccessDenied user={session} onLogout={handleLogout} accent={accent}/>;

  return (
    <HybridDashboard
      key="dashboard"
      injectedAccent={accent}
      onAccentChange={setAccent}
      injectedSession={session}
      onSessionUpdate={handleSessionUpdate}
      onLogout={handleLogout}
      onShowSettings={()=>{}}
      showSettings={false}
      hiddenAssets={getHiddenAssets()}
    />
  );
}
