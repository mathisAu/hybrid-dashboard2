import { useState, useEffect, useRef } from "react";

// ── Twelve Data ───────────────────────────────────────────────────────────────
const TWELVE_MAP = {
  XAUUSD:"XAU/USD", US30:"DJI",    US100:"NDX",     EURUSD:"EUR/USD",
  GBPUSD:"GBP/USD", BTCUSD:"BTC/USD", ETHUSD:"ETH/USD", USDJPY:"USD/JPY",
  USDCHF:"USD/CHF", USOIL:"WTI",   SPX:"SPX",       DXY:"DXY", VIX:"VIX", US10Y:"TNX",
};

async function fetchTwelvePrice(id, apiKey) {
  const sym = TWELVE_MAP[id] || id;
  try {
    const [pr, qr] = await Promise.all([
      fetch(`https://api.twelvedata.com/price?symbol=${encodeURIComponent(sym)}&apikey=${apiKey}`, {signal:AbortSignal.timeout(6000)}),
      fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${apiKey}`, {signal:AbortSignal.timeout(6000)}),
    ]);
    const pd = await pr.json();
    const qd = await qr.json();
    if(qd.status==="error") return null;
    const price = parseFloat(pd.price) || parseFloat(qd.close);
    if(!price) return null;
    const prev = parseFloat(qd.previous_close);
    const chg  = prev ? ((price-prev)/prev*100) : parseFloat(qd.percent_change)||0;
    const isFx = ["EURUSD","GBPUSD","USDJPY","USDCHF"].includes(id);
    return { price:price.toFixed(isFx?4:2), change:(chg>=0?"+":"")+chg.toFixed(2)+"%", direction:chg>=0?"up":"down", raw:chg };
  } catch(_) { return null; }
}

async function fetchTwelveBatch(ids, apiKey) {
  const syms = ids.map(id=>TWELVE_MAP[id]||id).join(",");
  try {
    const [pr, qr] = await Promise.all([
      fetch(`https://api.twelvedata.com/price?symbol=${encodeURIComponent(syms)}&apikey=${apiKey}`, {signal:AbortSignal.timeout(8000)}),
      fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(syms)}&apikey=${apiKey}`, {signal:AbortSignal.timeout(8000)}),
    ]);
    const pd = await pr.json(); const qd = await qr.json();
    if(!qd || qd.status==="error") return {};
    const result = {};
    const parse = (id,q,p) => {
      if(!q||q.status==="error") return;
      const price = parseFloat(p?.price)||parseFloat(q.close); if(!price) return;
      const prev = parseFloat(q.previous_close);
      const chg  = prev ? ((price-prev)/prev*100) : parseFloat(q.percent_change)||0;
      const isFx = ["EURUSD","GBPUSD","USDJPY","USDCHF"].includes(id);
      result[id] = { price:price.toFixed(isFx?4:2), change:(chg>=0?"+":"")+chg.toFixed(2)+"%", direction:chg>=0?"up":"down", raw:chg };
    };
    if(ids.length===1){ parse(ids[0],qd,pd); return result; }
    ids.forEach(id=>parse(id, qd[TWELVE_MAP[id]||id], pd[TWELVE_MAP[id]||id]));
    return result;
  } catch(_) { return {}; }
}

// ── Finnhub ───────────────────────────────────────────────────────────────────
const FINNHUB_MAP = {
  XAUUSD:"OANDA:XAU_USD", US30:"OANDA:US30_USD",  US100:"OANDA:NAS100_USD",
  EURUSD:"OANDA:EUR_USD",  GBPUSD:"OANDA:GBP_USD", BTCUSD:"BINANCE:BTCUSDT",
  USDJPY:"OANDA:USD_JPY",  USDCHF:"OANDA:USD_CHF", USOIL:"OANDA:WTICO_USD",
  DXY:"OANDA:USD_BASKET",  VIX:"CBOE:VIX",         US10Y:"TVC:US10Y",
  SPX:"OANDA:SPX500_USD",
};

async function fetchFinnhubPrice(id, apiKey) {
  const sym = FINNHUB_MAP[id]; if(!sym) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${apiKey}`, {signal:AbortSignal.timeout(5000)});
    const d = await res.json();
    if(!d.c || d.c===0) return null;
    const chg = d.dp ?? (d.pc ? ((d.c-d.pc)/d.pc*100) : 0);
    const isFx = ["EURUSD","GBPUSD","USDJPY","USDCHF"].includes(id);
    return { price:d.c.toFixed(isFx?4:2), change:(chg>=0?"+":"")+chg.toFixed(2)+"%", direction:chg>=0?"up":"down", raw:chg };
  } catch(_) { return null; }
}

// fetchLivePrice: Finnhub eerst, 12data als fallback
const FOREX_IDS = ["EURUSD","GBPUSD","USDJPY","USDCHF"];
async function fetchLivePrice(id, tdKey, fhKey, priceSource) {
  if(priceSource==="finnhub" && fhKey) {
    const p = await fetchFinnhubPrice(id, fhKey); if(p) return p;
  }
  if(priceSource==="twelvedata" && tdKey) {
    const p = await fetchTwelvePrice(id, tdKey); if(p) return p;
  }
  if(fhKey) { const p = await fetchFinnhubPrice(id, fhKey); if(p) return p; }
  if(tdKey) { const p = await fetchTwelvePrice(id, tdKey); if(p) return p; }
  return null;
}



// ── Accent colour (user-configurable) ─────────────────────────────────────────
const DEFAULT_ACCENT = "#089981";

// ── TradingView-stijl asset logo's ────────────────────────────────────────────
const AssetLogo = ({ id, size=24 }) => {
  const s = size, r = size/2;
  const defs = {
    // Gold — warm goud cirkel met XAU tekst
    XAUUSD: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#F5C518"/><text x="16" y="20.5" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="700" fill="#7A4F00">XAU</text></svg>,
    // Dow Jones — donkerblauw met DJI
    US30: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1652F0"/><text x="16" y="19" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" fill="#fff">DJI</text></svg>,
    // Nasdaq — paars-blauw met NQ
    US100: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#7B2FBE"/><text x="16" y="19" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" fill="#fff">NQ</text></svg>,
    // EUR — blauw EU-stijl
    EURUSD: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1A3A8F"/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="15" fontWeight="700" fill="#FFD700">€</text></svg>,
    // GBP — donkerrood/Union Jack stijl
    GBPUSD: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#C8102E"/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="700" fill="#fff">£</text></svg>,
    // BTC
    BTCUSD: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#F7931A"/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="13" fontWeight="700" fill="#fff">₿</text></svg>,
    // ETH
    ETHUSD: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#627EEA"/><text x="16" y="20" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill="#fff">Ξ</text></svg>,
    // JPY
    USDJPY: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#BC002D"/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="13" fontWeight="700" fill="#fff">¥</text></svg>,
    // CHF
    USDCHF: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#D52B1E"/><text x="16" y="20" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="700" fill="#fff">CHF</text></svg>,
    // Oil
    USOIL: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#2C2C2C"/><text x="16" y="21" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" fill="#fff">OIL</text></svg>,
    // S&P500
    SPX: <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1652F0"/><text x="16" y="20" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="700" fill="#fff">SPX</text></svg>,
  };
  if (defs[id]) return defs[id];
  // Generic fallback — gebruik eerste 3 letters van ID
  const colors = ["#089981","#1652F0","#7B2FBE","#F59E0B","#EF4444","#06B6D4"];
  const bg = colors[id.charCodeAt(0) % colors.length];
  const abbr = id.replace(/USD|EUR|GBP/,"").slice(0,3);
  return <svg width={s} height={s} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill={bg}/><text x="16" y="20" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize={abbr.length>3?7:9} fontWeight="700" fill="#fff">{abbr}</text></svg>;
};

const BASE_ASSETS = [
  { id:"XAUUSD", label:"XAU/USD", full:"Gold / US Dollar",       group:"macro",  searchTerms:"gold XAU spot price" },
  { id:"US30",   label:"US30",   full:"Dow Jones Industrial",     group:"equity", searchTerms:"Dow Jones US30 DJIA" },
  { id:"US100",  label:"US100",  full:"Nasdaq 100 Index",         group:"equity", searchTerms:"Nasdaq 100 US100 NQ futures" },
  { id:"EURUSD", label:"EUR/USD",full:"Euro / US Dollar",         group:"fx",     searchTerms:"EUR/USD euro dollar forex" },
  { id:"GBPUSD", label:"GBP/USD",full:"Pound Sterling / Dollar",  group:"fx",     searchTerms:"GBP/USD pound sterling forex" },
];

const ANALYSIS_SYSTEM = `Hybrid Market Intelligence Trader. Geen web search — context aangeleverd.
Prijs/% = NOOIT bias input. Bias = fundamentele macro analyse.

DXY↑: EUR/GBP bearish, goud bearish (tenzij anomalie), indices mixed
DXY↓: EUR/GBP bullish, goud bullish
VIX>20: indices Fragiel/Bearish, goud bullish (safe haven)
Yields↑ sterk: goud bearish, US100 bearish, USD bullish
XAU anomalie (DXY+goud BEIDE zelfde richting): max confidence 65%

Elke asset krijgt ANDERE bias — verplicht.
mini_summary: max 12 woorden. hold_advies: max 6 woorden. fail_condition: max 6 woorden.
GEEN apostrofs. Alleen JSON:
{"bias":"","confidence":0,"hold_confidence":0,"market_mood":"","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"","mini_summary":"","hold_advies":"","fail_condition":"","macro_alignment":0,"structure_integrity":0,"flow_participation":0,"volatility_regime":0}`;




const INTEL_SYSTEM = `Macro market intelligence analist. Gebruik ALTIJD web search voor actuele data — geen training kennis gebruiken voor huidige marktdata.

VERPLICHT bij elke run:
1. Zoek naar echte marktdata van vandaag (DXY, yields, VIX, index futures)
2. Zoek naar echte nieuwsheadlines van vandaag
3. Rapporteer BEIDE kanten — bullish EN bearish signalen
4. Als markt mixed is, zeg dat — niet automatisch Risk-On of Risk-Off kiezen

INTEGRITEIT REGELS:
- Hallucineeer NOOIT nieuws — alleen headlines die je echt gevonden hebt via search
- Als geen nieuws gevonden: news_items = [] en leg uit in desk_view
- macro_regime reflecteert de WERKELIJKE toestand, niet een aanname
- Geef tegengestelde signalen altijd weer in cross_asset_signals

GEEN apostrofs of aanhalingstekens in strings. Alleen JSON, geen markdown.

{"timestamp":"ISO","macro_regime":"","dominant_driver":"","session_context":"","yield_analysis":{"us10y_level":"","us2y_level":"","spread":"","regime":"","implication":""},"cross_asset_signals":[{"signal":"","type":"","implication":""}],"risk_radar":{"score":0,"label":"","factors":[]},"desk_view":"","news_items":[{"time":"09:30","source":"","category":"","headline":"","impact":"high","direction":"bullish","assets_affected":[]}],"economic_calendar":[{"time":"","event":"","actual":"","expected":"","previous":"","impact":"","verdict":"","effect":"","date":"today"}]}`;

// ── Lichte nieuws-only fetch (elke 15 min, ~200 tokens) ──────────────────────
const NEWS_SYSTEM = `Je bent een markt nieuws monitor. Gebruik web search om de laatste breaking news te vinden.
Zoek UITSLUITEND op deze bronnen: Reuters, Bloomberg, FinancialJuice, Walter Bloomberg, ForexFactory, Fed/ECB/BoE officieel.
Hallucineeer NOOIT — alleen echte headlines die je gevonden hebt.
GEEN apostrofs. Alleen JSON array, geen wrapper, geen markdown.
[{"time":"HH:MM","source":"Reuters","headline":"...","direction":"bullish|bearish|neutraal","impact":"high|medium","assets":["XAU/USD","EUR/USD"]}]`;

function NEWS_USER_NOW() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  const timeStr = now.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"});
  return `${dateStr}, ${timeStr} CET. Zoek naar breaking financial news van de afgelopen 30 minuten.
Zoektermen: "Reuters forex news today", "Bloomberg markets breaking", "Fed ECB news ${dateStr}", "gold dollar markets ${dateStr}".
Geef max 8 items. Alleen high-impact macro nieuws. Geen crypto, geen bedrijfsnieuws tenzij marktbeweging.
Retourneer ALLEEN JSON array.`;
}



function INTEL_USER_NOW(assetLabels) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const timeStr = now.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"});
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
  const dayAfter = new Date(now); dayAfter.setDate(now.getDate()+2);
  const fmt = d => d.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long"});
  return `VANDAAG is ${dateStr}, huidige tijd: ${timeStr} CET.

VERPLICHT: Gebruik web search om ECHTE data van vandaag op te halen. Geen aannames, geen historische data.

Zoek naar:
1. "market news today ${now.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}" 
2. Huidige DXY, US10Y yield, VIX waarden
3. Fed sprekers vandaag of deze week
4. ECB/BoE nieuws vandaag
5. Economische data releases vandaag

REGELS:
- Elk news_item MOET een echte headline zijn van vandaag — geen generieke samenvattingen
- Als je geen nieuws vindt voor vandaag, zeg dat expliciet in desk_view
- Macro regime mag ALLEEN Risk-On zijn als er echte bewijzen zijn
- Geef ook bearish/negatieve signalen als die er zijn — niet alleen positief nieuws

KALENDER: events voor VANDAAG + ${fmt(tomorrow)} + ${fmt(dayAfter)}.
Elk calendar event: "date" veld "today"/"tomorrow"/"day_after".
Zoek: Fed/ECB/BoE, CPI, NFP, GDP, PMI, retail sales.

assets_affected: ALLEEN ${assetLabels.join(", ")}.
Tijden: HH:MM formaat. news_items NIEUWSTE EERST.
Retourneer alleen JSON.`;
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
  Neutraal: { bg:"rgba(107,114,128,0.1)", border:"#4b5563", text:"#9ca3af" },
  Fragiel:  { bg:"rgba(8,153,129,0.1)",   border:"#089981", text:"#0dd9b6" },
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
  return <span style={{fontSize:9,padding:"2px 7px",borderRadius:3,border:`1px solid ${color}44`,background:`${color}11`,color,letterSpacing:"0.08em",fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>;
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
        headers["x-api-key"] = apiKey.trim();
        headers["anthropic-version"] = "2023-06-01";
        headers["anthropic-dangerous-direct-browser-access"] = "true";
      }
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
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

  const impactColor = i => i==="bullish"?"#22c55e":i==="bearish"?"#ef4444":"#6b7280";
  const impactIcon  = i => i==="bullish"?"▲":i==="bearish"?"▼":"—";
  const pairs = [
    {id:"XAUUSD",label:"XAU/USD"},{id:"US30",label:"US30"},
    {id:"US100",label:"US100"},{id:"EURUSD",label:"EUR/USD"},{id:"GBPUSD",label:"GBP/USD"}
  ];

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#111214",border:"1px solid #1f2023",borderRadius:10,padding:20,maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.8)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,gap:10}}>
          <div style={{fontSize:10,color:"#9ca3af",lineHeight:1.5,flex:1}}>{news.headline}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer",fontSize:16,flexShrink:0,padding:0}}>✕</button>
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
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:"#6b7280",width:58,flexShrink:0}}>{label}</span>
                  <span style={{fontSize:13,color:impactColor(r.impact),fontWeight:700,width:16,flexShrink:0}}>{impactIcon(r.impact)}</span>
                  <span style={{fontSize:11,color:"#9ca3af",flex:1}}>{r.reden}</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{marginTop:12,fontSize:9,color:"#374151",textAlign:"right"}}>klik buiten popup om te sluiten</div>
      </div>
    </div>
  );
}


function btnStyle(disabled, accent=DEFAULT_ACCENT) {
  return {
    background:disabled?`${accent}11`:`linear-gradient(135deg,${accent}30,${accent}20)`,
    border:`1px solid ${disabled?accent+"33":accent}`,
    borderRadius:6, color:disabled?`${accent}55`:accent,
    fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700,
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
  const bias = resolveBias(data?.bias, data?.confidence);
  const c = biasColors[bias] || biasColors.Neutraal;
  const acc = accent || DEFAULT_ACCENT;
  const trendColor = (t) => {
    if (!t) return "#6b7280"; const l = t.toLowerCase();
    if (l.includes("strong up")) return "#22c55e";
    if (l.includes("choppy up")) return "#84cc16";
    if (l.includes("strong down")) return "#ef4444";
    if (l.includes("choppy down")) return acc;
    if (l.includes("compres")) return "#a855f7";
    return "#6b7280";
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
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)",overflowY:"auto",display:"flex",flexDirection:"column"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#09090b",minHeight:"100vh",width:"100%",display:"flex",flexDirection:"column"}}>
        {/* Top accent bar */}
        <div style={{height:3,background:`linear-gradient(90deg,transparent,${c.border},transparent)`,flexShrink:0}}/>

        {/* Header */}
        <div style={{padding:"18px 32px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <span style={{flexShrink:0}}><AssetLogo id={asset.id} size={36}/></span>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3,flexWrap:"wrap"}}>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:24,fontWeight:700,color:"#e5e7eb"}}>{asset.label}</span>
                <div style={{background:c.bg,border:`1px solid ${c.border}55`,borderRadius:5,padding:"5px 14px"}}>
                  <span style={{fontSize:14,fontWeight:700,color:c.text,letterSpacing:"0.06em"}}>{bias?.toUpperCase()}</span>
                </div>
                {priceChange&&(
                  <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.04)",borderRadius:5,padding:"4px 10px"}}>
                    <span style={{fontSize:11,fontWeight:700,color:priceDir==="up"?"#22c55e":"#ef4444",fontFamily:"'IBM Plex Mono',monospace"}}>{priceDir==="up"?"↑":"↓"} {priceChange} vandaag</span>
                  </div>
                )}
                {data?.price_today&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:16,fontWeight:700,color:"#e5e7eb"}}>{data.price_today}</span>}
                {data?.correlatie_status&&<Badge label={data.correlatie_status.toUpperCase()} color={corrColors[data.correlatie_status]||"#6b7280"}/>}
              </div>
              <div style={{fontSize:12,color:"#4b5563"}}>{asset.full}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={onRefreshAsset} disabled={refreshing} style={{...btnStyle(refreshing,acc),padding:"7px 16px",fontSize:10}}>
              <span style={{display:"inline-block",animation:refreshing?"spin 0.8s linear infinite":"none"}}>↺</span>
              {refreshing?"UPDATING...":"UPDATE ASSET"}
            </button>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,color:"#9ca3af",padding:"7px 16px",cursor:"pointer",fontSize:12,fontFamily:"'IBM Plex Mono',monospace",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
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
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:8}}>BIAS CONFIDENCE</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:30,fontWeight:700,color:acc,marginBottom:8}}>{data?.confidence}%</div>
                <Bar value={data?.confidence||0} color={acc}/>
                <div style={{fontSize:10,color:"#4b5563",marginTop:6}}>{data?.confidence>=80?"Sterk signaal":data?.confidence>=65?"Goed signaal":data?.confidence>=50?"Matig signaal":"Zwak / twijfelachtig"}</div>
              </div>
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:8}}>HOLD CONFIDENCE</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:30,fontWeight:700,color:"#6366f1",marginBottom:8}}>{data?.hold_confidence}%</div>
                <Bar value={data?.hold_confidence||0} color="#6366f1"/>
                <div style={{fontSize:10,color:"#4b5563",marginTop:6}}>{data?.hold_confidence>=80?"🟢 Trail stop, hold":data?.hold_confidence>=60?"🟡 Bescherm winst, verkort target":data?.hold_confidence>=40?"⚠️ Niet lang houden, snelle scalp":"🔴 Geen positie vasthouden"}</div>
              </div>
            </div>

            {/* Hold pijlers */}
            {(data?.macro_alignment!=null)&&(
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:12}}>HOLD CONFIDENCE PIJLERS</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[
                    {l:"Macro Alignment",    v:data?.macro_alignment,    w:"25%"},
                    {l:"Structure Integrity",v:data?.structure_integrity, w:"30%"},
                    {l:"Flow & Participation",v:data?.flow_participation, w:"25%"},
                    {l:"Volatility Regime",  v:data?.volatility_regime,   w:"20%"},
                  ].map(({l,v,w})=>v!=null&&(
                    <div key={l}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                        <InfoTooltip text={pijlerTooltips[l]} color={v>=70?"#22c55e":v>=50?acc:"#ef4444"}>
                          <span style={{fontSize:9,color:"#4b5563"}}>{l}</span>
                        </InfoTooltip>
                        <span style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:v>=70?"#22c55e":v>=50?acc:"#ef4444",fontWeight:700}}>{v}%</span>
                      </div>
                      <Bar value={v} color={v>=70?"#22c55e":v>=50?acc:"#ef4444"}/>
                      <div style={{fontSize:9,color:"#2d3748",marginTop:2}}>{w} weight</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Technical + Structure + Regime */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"12px 14px"}}>
                <InfoTooltip text={data?.technical_trend_explanation||"Technische trendanalyse op basis van price action vandaag"} color={trendColor(data?.technical_trend)}>
                  <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:6}}>TECHNISCHE TREND</div>
                </InfoTooltip>
                <div style={{fontSize:13,fontWeight:700,color:trendColor(data?.technical_trend)}}>{data?.technical_trend||"—"}</div>
              </div>
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"12px 14px"}}>
                <InfoTooltip text={data?.intraday_structuur_explanation||"HH/HL = Higher Highs + Higher Lows (bullish). LH/LL = Lower Highs + Lower Lows (bearish)."} color="#9ca3af">
                  <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:6}}>STRUCTUUR</div>
                </InfoTooltip>
                <div style={{fontSize:13,fontWeight:700,color:"#9ca3af"}}>{data?.intraday_structuur||"—"}</div>
              </div>
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"12px 14px"}}>
                <InfoTooltip text={data?.market_regime_explanation||"Het huidige markt karakter op basis van price action en volatiliteit."} color="#6366f1">
                  <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:6}}>MARKET REGIME</div>
                </InfoTooltip>
                <div style={{fontSize:13,fontWeight:700,color:"#6366f1"}}>{data?.market_regime?.toUpperCase()||"—"}</div>
              </div>
            </div>

            {/* Yield regime */}
            {data?.yield_regime&&data.yield_regime!=="n.v.t."&&(
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:8}}>YIELD REGIME</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:yieldColors[data.yield_regime]||"#6b7280",boxShadow:`0 0 8px ${yieldColors[data.yield_regime]||"#6b7280"}`}}/>
                  <span style={{fontSize:15,fontWeight:700,color:yieldColors[data.yield_regime]||"#9ca3af"}}>{data.yield_regime}</span>
                </div>
                {data.yield_regime_explanation&&<div style={{fontSize:11,color:"#6b7280",lineHeight:1.6}}>{data.yield_regime_explanation}</div>}
              </div>
            )}

            {/* Hold advies + Fail */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:`${acc}11`,border:`1px solid ${acc}22`,borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:acc,letterSpacing:"0.1em",marginBottom:6}}>HOLD ADVIES</div>
                <div style={{fontSize:12,color:"#d1d5db",lineHeight:1.6}}>{data?.hold_advies||"—"}</div>
              </div>
              <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.12)",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#ef4444",letterSpacing:"0.1em",marginBottom:6}}>FAIL CONDITION</div>
                <div style={{fontSize:12,color:"#6b7280",lineHeight:1.6}}>{data?.fail_condition||"—"}</div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {/* Deep summary */}
            <div style={{background:`linear-gradient(135deg,${acc}08,rgba(99,102,241,0.04))`,border:`1px solid ${acc}20`,borderRadius:8,padding:"16px 18px"}}>
              <div style={{fontSize:9,color:acc,letterSpacing:"0.1em",marginBottom:8}}>UITGEBREIDE ANALYSE</div>
              <div style={{fontSize:12,color:"#d1d5db",lineHeight:1.8}}>{data?.deep_summary||data?.mini_summary||"—"}</div>
            </div>

            {/* Mechanisme + Driver */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:6}}>DOMINANT MECHANISME</div>
                <div style={{fontSize:11,color:"#9ca3af",lineHeight:1.55}}>{data?.dominant_mechanisme||"—"}</div>
              </div>
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:6}}>TREND DRIVER</div>
                <div style={{fontSize:14,fontWeight:700,color:"#9ca3af"}}>{data?.trend_driver?.toUpperCase()||"—"}</div>
              </div>
            </div>

            {/* Key confluences */}
            {data?.key_confluences?.length>0&&(
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:10}}>KEY CONFLUENCES</div>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {data.key_confluences.map((cf,i)=>(
                    <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:acc,marginTop:5,flexShrink:0}}/>
                      <span style={{fontSize:11,color:"#9ca3af",lineHeight:1.5}}>{cf}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* News items — clickable */}
            {data?.news_items?.length>0&&(
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:10}}>RELEVANTE NIEUWS</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {data.news_items.map((n,i)=>(
                    <div key={i} style={{borderLeft:`2px solid ${dirColor[n.direction]||"#374151"}`,paddingLeft:10,cursor:n.url?"pointer":"default"}}
                      onClick={()=>n.url&&window.open(n.url,"_blank")}>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                        {n.time&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4b5563"}}>{n.time}</span>}
                        {n.date&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#374151"}}>{n.date}</span>}
                        {n.source&&<Badge label={n.source} color="#6b7280"/>}
                        <span style={{fontSize:11,color:dirColor[n.direction]||"#9ca3af",fontWeight:700}}>{n.direction==="bullish"?"▲":n.direction==="bearish"?"▼":"—"}</span>
                        {n.url&&<span style={{fontSize:9,color:"#374151",marginLeft:"auto"}}>↗ openen</span>}
                      </div>
                      <div style={{fontSize:11,color:n.url?"#d1d5db":"#9ca3af",lineHeight:1.5,textDecoration:n.url?"underline":"none",textDecorationColor:"rgba(255,255,255,0.1)"}}>{n.headline}</div>
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

function AssetCard({ asset, data, index, loading, updating: updatingProp, onClick, onUpdate, accent, livePrice, breakingNews }) {
  const [vis, setVis] = useState(false);
  const [updatingLocal, setUpdatingLocal] = useState(false);
  const updating = updatingProp || updatingLocal;
  const acc = accent || DEFAULT_ACCENT;
  useEffect(()=>{const t=setTimeout(()=>setVis(true),index*80);return()=>clearTimeout(t);},[data,loading]);
  const bias = resolveBias(data?.bias, data?.confidence);
  const c = biasColors[bias] || biasColors.Neutraal;
  // Verberg prijs als 0, leeg, of "0.00"
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

  return (
    <div onClick={data ? onClick : undefined} style={{background:"linear-gradient(145deg,#111214,#0d0e10)",border:`1px solid ${updating?"#6366f144":data?.bias?c.border+"44":"#1a1b1e"}`,borderRadius:8,padding:"16px 18px",opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(10px)",transition:"all 0.5s cubic-bezier(0.4,0,0.2,1)",position:"relative",overflow:"visible",cursor:data?"pointer":"default"}}>
      {updating&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#6366f1,transparent)",borderRadius:"8px 8px 0 0",animation:"shimmer 1s ease-in-out infinite"}}/>}
      {!updating&&data?.bias&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${c.border},transparent)`,borderRadius:"8px 8px 0 0"}}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2,flexWrap:"wrap"}}>
            <span style={{flexShrink:0}}><AssetLogo id={asset.id} size={22}/></span>
            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:700,color:"#e5e7eb",letterSpacing:"0.05em"}}>{asset.label}</span>
            {displayPrice&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,fontWeight:700,color:"#e5e7eb"}}>{displayPrice}</span>}
            {displayChange&&(
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:priceUp?"#22c55e":"#ef4444"}}>
                {priceUp?"↑":"↓"}{displayChange}
              </span>
            )}
          </div>
          <div style={{fontSize:10,color:"#374151"}}>{asset.full}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {/* Update knop per asset */}
          <button onClick={handleUpdate} title="Update deze asset"
            style={{background:updating?"rgba(99,102,241,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${updating?"#6366f144":"#1f2023"}`,borderRadius:5,padding:"4px 7px",cursor:updating?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:26,height:26}}>
            <span style={{fontSize:12,color:updating?"#818cf8":"#4b5563",display:"inline-block",animation:updating?"spin 0.8s linear infinite":"none"}}>⟳</span>
          </button>
          {data?.bias
            ? <div style={{background:c.bg,border:`1px solid ${c.border}44`,borderRadius:5,padding:"4px 10px"}}><span style={{fontSize:11,fontWeight:700,color:c.text,letterSpacing:"0.06em"}}>{bias?.toUpperCase()}</span></div>
            : loading ? <Skeleton w={72} h={26} mb={0}/> : null}
        </div>
      </div>
      {data ? (
        <>
          <div style={{marginBottom:6}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:"#4b5563",letterSpacing:"0.08em"}}>CONFIDENCE</span><span style={{fontSize:11,color:acc,fontFamily:"'IBM Plex Mono',monospace",fontWeight:700}}>{data.confidence}%</span></div>
            <Bar value={data.confidence} color={acc}/>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:"#4b5563",letterSpacing:"0.08em"}}>HOLD</span><span style={{fontSize:11,color:"#6366f1",fontFamily:"'IBM Plex Mono',monospace",fontWeight:700}}>{data.hold_confidence}%</span></div>
            <Bar value={data.hold_confidence} color="#6366f1"/>
          </div>
          <div style={{height:1,background:"rgba(255,255,255,0.04)",marginBottom:8}}/>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
            {data.market_mood&&(
              <div style={{fontSize:9,color:"#9ca3af",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:4,padding:"2px 8px",letterSpacing:"0.06em"}}>{data.market_mood.toUpperCase()}</div>
            )}
            {data.correlatie_status&&(
              <InfoTooltip text={data.correlatie_status==="Normaal"?"DXY en Gold bewegen in verwachte richting t.o.v. elkaar — geen anomalie.":"DXY en Gold bewegen beide dezelfde kant op — dit is een anomalie die confidence verlaagt."} color={corrColors[data.correlatie_status]||"#6b7280"}>
                <Badge label={data.correlatie_status.toUpperCase()} color={corrColors[data.correlatie_status]||"#6b7280"}/>
              </InfoTooltip>
            )}
            {data.market_regime&&(
              <InfoTooltip text={data.market_regime_explanation||"Het dominante karakter van de markt op dit moment."} color="#6366f1">
                <Badge label={data.market_regime.toUpperCase()} color="#6366f1"/>
              </InfoTooltip>
            )}
            {data.yield_regime&&data.yield_regime!=="n.v.t."&&<YieldTooltip regime={data.yield_regime} explanation={data.yield_regime_explanation}/>}
          </div>
          <div style={{marginBottom:8,background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.12)",borderRadius:6,padding:"9px 11px"}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
              <span style={{fontSize:10,color:"#6366f1"}}>✦</span>
              <span style={{fontSize:9,color:"#6366f1",letterSpacing:"0.1em",fontWeight:600}}>AI ANALYSE</span>
            </div>
            <div style={{fontSize:11,color:"#9ca3af",lineHeight:1.6}}>{data.mini_summary||"—"}</div>
          </div>
          <div style={{background:`${acc}09`,border:`1px solid ${acc}18`,borderRadius:5,padding:"7px 10px",marginBottom:6}}><div style={{fontSize:9,color:acc,letterSpacing:"0.1em",marginBottom:1}}>HOLD ADVIES</div><div style={{fontSize:11,color:"#d1d5db"}}>{data.hold_advies}</div></div>
          <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.12)",borderRadius:5,padding:"7px 10px"}}><div style={{fontSize:9,color:"#ef4444",letterSpacing:"0.1em",marginBottom:1}}>FAIL CONDITION</div><div style={{fontSize:11,color:"#6b7280"}}>{data.fail_condition}</div></div>
          {/* Breaking news relevant voor dit asset */}
          {(()=>{
            const assetKeywords = {
              XAUUSD:["gold","xau","goud","haven","bullion"],
              US30:["dow","djia","us30","wall street","nasdaq","index"],
              US100:["nasdaq","tech","us100","ndx","qqq"],
              EURUSD:["euro","eur","ecb","eurozone","lagarde"],
              GBPUSD:["pound","gbp","boe","uk","sterling","bailey"],
            };
            const kw = assetKeywords[asset.id] || [asset.id.toLowerCase().replace("usd","")];
            const relevant = (breakingNews||[]).filter(n => kw.some(k=>n.headline.toLowerCase().includes(k))).slice(0,2);
            if(!relevant.length) return null;
            return (
              <div style={{marginTop:6,borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:6}}>
                <div style={{fontSize:9,color:"#374151",letterSpacing:"0.08em",marginBottom:5}}>NIEUWS</div>
                {relevant.map((n,i)=>(
                  <div key={i} onClick={e=>{e.stopPropagation();if(n.url)window.open(n.url,"_blank");}}
                    style={{fontSize:10,color:"#6b7280",lineHeight:1.4,marginBottom:4,paddingLeft:6,borderLeft:"2px solid #374151",cursor:n.url?"pointer":"default"}}>
                    <span style={{color:"#4b5563",marginRight:4}}>{n.timeStr}</span>{n.headline}
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      ) : loading ? (
        <div>{[85,65,45,100,75,55].map((w,i)=><Skeleton key={i} w={`${w}%`}/>)}</div>
      ) : (
        <div style={{textAlign:"center",padding:"20px 0",color:"#2d3139",fontSize:11}}>Klik ANALYSE UITVOEREN</div>
      )}
    </div>
  );
}

function MarketIntelPage({ data, loading, onRefresh, status, dots, onNewsClick }) {
  if (!data && !loading) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:420,gap:14}}>
      <div style={{fontSize:40,opacity:0.4}}>📡</div>
      <div style={{color:"#374151",fontSize:12,letterSpacing:"0.05em"}}>Klik INTEL LADEN om live marktdata op te halen</div>
      <button onClick={onRefresh} style={btnStyle(false)}><span>▶</span> INTEL LADEN</button>
    </div>
  );
  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:16,paddingTop:20}}>
      {[1,2,3].map(i=><div key={i} style={{background:"#111214",borderRadius:8,padding:18}}>{[100,80,60,90,70].map((w,j)=><Skeleton key={j} w={`${w}%`} h={j===0?12:8}/>)}</div>)}
    </div>
  );

  const snap = data.market_snapshot || {};
  const snapLabels = {gold:"GOLD",us30:"US30",us100:"US100",eurusd:"EUR/USD",gbpusd:"GBP/USD"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Session + refresh row */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:12,color:"#9ca3af",marginBottom:3}}>{data.session_context}</div>
          {data.timestamp&&<div style={{fontSize:10,color:"#374151",fontFamily:"'IBM Plex Mono',monospace"}}>{new Date(data.timestamp).toLocaleString("nl-NL")}</div>}
        </div>
        <button onClick={onRefresh} disabled={status==="loading-intel"} style={btnStyle(status==="loading-intel")}>
          <span>↺</span>{status==="loading-intel"?`LADEN${".".repeat(dots)}`:"VERNIEUWEN"}
        </button>
      </div>

      {/* Regime banner */}
      <div style={{background:"#0f1011",border:`1px solid ${(yieldColors[data.macro_regime]||"#374151")}33`,borderRadius:8,padding:"12px 18px",display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:yieldColors[data.macro_regime]||"#6b7280",boxShadow:`0 0 8px ${yieldColors[data.macro_regime]||"#6b7280"}`}}/>
          <span style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em"}}>MACRO REGIME</span>
          <span style={{fontSize:12,fontWeight:700,color:yieldColors[data.macro_regime]||"#9ca3af"}}>{data.macro_regime}</span>
        </div>
        <div style={{fontSize:11,color:"#9ca3af",flex:1}}>{data.dominant_driver}</div>
      </div>

      {/* Yield analysis */}
      {data.yield_analysis&&(
        <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 18px"}}>
          <div style={{fontSize:10,color:"#374151",letterSpacing:"0.12em",marginBottom:10}}>YIELD ANALYSE</div>
          <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:8}}>
            {[{l:"US10Y",v:data.yield_analysis.us10y_level},{l:"US2Y",v:data.yield_analysis.us2y_level},{l:"SPREAD",v:data.yield_analysis.spread},{l:"REGIME",v:data.yield_analysis.regime}].map(({l,v})=>(
              <div key={l} style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontSize:9,color:"#374151",letterSpacing:"0.1em"}}>{l}</span>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,fontWeight:700,color:"#f97316"}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,color:"#6b7280"}}>{data.yield_analysis.implication}</div>
        </div>
      )}

      {/* News + Calendar in 2 cols */}
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.1fr) minmax(0,0.9fr)",gap:14}}>

        {/* News */}
        <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 18px"}}>
          <div style={{fontSize:10,color:"#374151",letterSpacing:"0.12em",marginBottom:12}}>NIEUWS FEED</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {(data.news_items||[]).map((n,i)=>(
              <div key={i} onClick={()=>onNewsClick&&onNewsClick({headline:n.headline,source:n.source,url:n.url})}
                style={{borderLeft:`2px solid ${impactColor[n.impact]||"#374151"}`,paddingLeft:10,cursor:"pointer",borderRadius:"0 4px 4px 0",transition:"background 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,0.06)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4b5563"}}>{n.time}</span>
                  <Badge label={n.source} color="#6b7280"/>
                  <Badge label={n.category} color="#6366f1"/>
                  {n.impact==="high"&&<Badge label="HIGH" color="#ef4444"/>}
                  <span style={{fontSize:11,color:dirColor[n.direction]||"#9ca3af",fontWeight:700}}>{n.direction==="bullish"?"▲":n.direction==="bearish"?"▼":"—"}</span>
                  <span style={{fontSize:9,color:"#4b5563",marginLeft:"auto"}}>⚡ impact</span>
                </div>
                <div style={{fontSize:11,color:"#d1d5db",lineHeight:1.5,marginBottom:4}}>{n.headline}</div>
                {n.assets_affected&&n.assets_affected.length>0&&(
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{n.assets_affected.map(a=><Badge key={a} label={a} color="#374151"/>)}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right column: calendar + signals + key levels */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Calendar */}
          <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 18px"}}>
            <div style={{fontSize:10,color:"#374151",letterSpacing:"0.12em",marginBottom:10}}>ECONOMISCHE KALENDER</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {(data.economic_calendar||[]).map((e,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid #1f2023",borderRadius:6,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,flexWrap:"wrap",gap:4}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4b5563"}}>{e.time}</span>
                      <span style={{fontSize:11,fontWeight:600,color:"#e5e7eb"}}>{e.event}</span>
                    </div>
                    <Badge label={(e.impact||"").toUpperCase()} color={impactColor[e.impact]||"#6b7280"}/>
                  </div>
                  {(e.actual||e.expected||e.previous)&&(
                    <div style={{display:"flex",gap:10,marginBottom:5,flexWrap:"wrap"}}>
                      {e.actual&&<div><span style={{fontSize:9,color:"#374151"}}>ACT </span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:"#f97316"}}>{e.actual}</span></div>}
                      {e.expected&&<div><span style={{fontSize:9,color:"#374151"}}>EXP </span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#6b7280"}}>{e.expected}</span></div>}
                      {e.previous&&<div><span style={{fontSize:9,color:"#374151"}}>PRV </span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#6b7280"}}>{e.previous}</span></div>}
                    </div>
                  )}
                  {e.verdict&&<div style={{marginBottom:4}}><Badge label={e.verdict.toUpperCase()} color={e.verdict.toLowerCase().includes("hot")||e.verdict.toLowerCase().includes("strong")?"#ef4444":"#22c55e"}/></div>}
                  {e.effect&&<div style={{fontSize:10,color:"#6b7280",lineHeight:1.4}}>{e.effect}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Cross-asset signals */}
          {data.cross_asset_signals&&data.cross_asset_signals.length>0&&(
            <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 18px"}}>
              <div style={{fontSize:10,color:"#374151",letterSpacing:"0.12em",marginBottom:10}}>CROSS-ASSET SIGNALEN</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.cross_asset_signals.map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <Badge label={s.signal} color={s.type==="anomalie"?"#ef4444":"#6366f1"}/>
                    <span style={{fontSize:11,color:"#6b7280",flex:1,lineHeight:1.4}}>{s.implication}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk radar only */}
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
            {data.risk_radar&&(
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"12px 14px"}}>
                <InfoTooltip text="Samengestelde risicoscore van 0-100 op basis van macro-omgeving, volatiliteit en cross-asset signalen. Groen (0-40) = laag risico, Oranje (40-70) = verhoogd, Rood (70-100) = hoog risico." color="#6b7280">
                  <div style={{fontSize:10,color:"#374151",letterSpacing:"0.12em",marginBottom:8}}>RISK RADAR</div>
                </InfoTooltip>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                  <div style={{position:"relative",width:48,height:48,flexShrink:0}}>
                    <svg width="48" height="48" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="18" fill="none" stroke="#1f2023" strokeWidth="3.5"/>
                      <circle cx="24" cy="24" r="18" fill="none" stroke={data.risk_radar.score>70?"#ef4444":data.risk_radar.score>40?"#f97316":"#22c55e"} strokeWidth="3.5" strokeDasharray={`${(data.risk_radar.score/100)*113} 113`} strokeLinecap="round" transform="rotate(-90 24 24)"/>
                    </svg>
                    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:"#e5e7eb"}}>{data.risk_radar.score}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:data.risk_radar.score>70?"#ef4444":data.risk_radar.score>40?"#f97316":"#22c55e",marginBottom:4}}>{data.risk_radar.label}</div>
                    {(data.risk_radar.factors_text||"").split(",").concat(data.risk_radar.factors||[]).filter(Boolean).map((f,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                        <div style={{width:3,height:3,borderRadius:"50%",background:"#374151"}}/>
                        <span style={{fontSize:9,color:"#6b7280"}}>{f}</span>
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
          <div style={{fontSize:10,color:"#f97316",letterSpacing:"0.12em",marginBottom:8}}>DESK PERSPECTIEF</div>
          <div style={{fontSize:12,color:"#d1d5db",lineHeight:1.7}}>{data.desk_view}</div>
        </div>
      )}
    </div>
  );
}

export default function HybridDashboard() {
  const [page,          setPage]          = useState("analyse");
  const [aStatus,       setAStatus]       = useState("idle");
  const [iStatus,       setIStatus]       = useState("idle");
  const [aResult,       setAResult]       = useState(null);
  const [iResult,       setIResult]       = useState(null);
  const [aError,        setAError]        = useState("");
  const [iError,        setIError]        = useState("");
  const [dots,          setDots]          = useState(0);
  const [deepAsset,     setDeepAsset]     = useState(null);
  const [deepRefreshing,setDeepRefreshing]= useState(false);
  const [refreshingAssets, setRefreshingAssets] = useState(new Set());
  const [calFilter,     setCalFilter]     = useState("all");
  const [calDayFilter,  setCalDayFilter]  = useState("all");
  const [accent,        setAccent]        = useState(DEFAULT_ACCENT);
  const [apiKey,        setApiKey]        = useState(() => { try { return localStorage.getItem("hd_apikey")||""; } catch(_){ return ""; }});
  const [showKey,       setShowKey]       = useState(false);
  const [tdKey,         setTdKey]         = useState(() => { try { return localStorage.getItem("hd_tdkey")||""; } catch(_){ return ""; }});
  const [fhKey,         setFhKey]         = useState(() => { try { return localStorage.getItem("hd_fhkey")||""; } catch(_){ return ""; }});
  const [priceSource,   setPriceSource]   = useState(() => { try { return localStorage.getItem("hd_psource")||"twelvedata"; } catch(_){ return "twelvedata"; }});
  const [showTdKey,     setShowTdKey]     = useState(false);
  const [livePrices,    setLivePrices]    = useState({});

  const [showKeyVal,    setShowKeyVal]    = useState(false);
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
      if(priceSource==="twelvedata" && tdKey) {
        // Batch call voor alle assets tegelijk
        try {
          const batch = await fetchTwelveBatch(allIds, tdKey);
          if(Object.keys(batch).length > 0) {
            setLivePrices(prev=>({...prev,...batch}));
            return;
          }
        } catch(_) {}
      }
      if(priceSource==="finnhub" && fhKey) {
        // Individuele calls voor Finnhub (geen batch API)
        allIds.forEach(id => {
          fetchFinnhubPrice(id, fhKey)
            .then(p=>{ if(p) setLivePrices(prev=>({...prev,[id]:p})); })
            .catch(()=>{});
        });
        return;
      }
      // Fallback: probeer andere bron
      if(tdKey) {
        try {
          const batch = await fetchTwelveBatch(allIds, tdKey);
          if(Object.keys(batch).length > 0) setLivePrices(prev=>({...prev,...batch}));
        } catch(_) {}
      } else if(fhKey) {
        allIds.forEach(id => {
          fetchFinnhubPrice(id, fhKey)
            .then(p=>{ if(p) setLivePrices(prev=>({...prev,[id]:p})); })
            .catch(()=>{});
        });
      }
    }

    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return()=>clearInterval(t);
  },[assets, tdKey, fhKey, priceSource]);

  // ── Breaking News via RSS proxy ──────────────────────────────────────────────
  // ── Breaking News via AI web search (Reuters, Bloomberg, FinancialJuice etc) ──
  const MARKET_KEYWORDS = ["fed","rate","inflation","gold","dollar","dxy","yield","nasdaq","dow","gdp","cpi","fomc","ecb","boe","oil","recession","tariff","powell","lagarde","treasury","bond","forex","currency","payroll","pmi"];

  async function fetchBreakingNews() {
    if(!apiKey?.trim()) return; // Geen Anthropic key = geen nieuws
    setBnLoading(true);
    try {
      const hdrs = {
        "Content-Type":"application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version":"2023-06-01",
        "anthropic-dangerous-direct-browser-access":"true",
      };
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers: hdrs,
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:600,
          system: NEWS_SYSTEM,
          tools:[{"type":"web_search_20250305","name":"web_search"}],
          messages:[{role:"user", content: NEWS_USER_NOW()}],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if(!res.ok) { setBnLoading(false); return; }
      const data = await res.json();
      const text = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("") || "";
      const clean = text.replace(/```json|```/g,"").trim();
      // Verwacht JSON array
      const start = clean.indexOf("[");
      const end   = clean.lastIndexOf("]");
      if(start===-1||end===-1) { setBnLoading(false); return; }
      const arr = JSON.parse(clean.slice(start, end+1));
      if(!Array.isArray(arr)) { setBnLoading(false); return; }

      const now = new Date();
      const items = arr.map(n => ({
        headline: n.headline || "",
        source:   n.source   || "News",
        url:      n.url      || "",
        time:     now,
        timeStr:  n.time     || now.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"}),
        direction:n.direction|| "neutraal",
        impact:   n.impact   || "medium",
        assets:   n.assets   || [],
        isNew:    !seenHeadlines.has(n.headline),
      })).filter(n => n.headline);

      const newItems = items.filter(n => n.isNew);
      if(newItems.length > 0 && seenHeadlines.size > 0) {
        newItems.slice(0,2).forEach(item => sendNotification("📰 Breaking News", item.headline, item.url));
      }
      setSeenHeadlines(new Set(items.map(n => n.headline)));
      setBreakingNews(items);
    } catch(e) { console.error("News fetch:", e); }
    setBnLoading(false);
  }

  // News auto-refresh: bij laden en elke 15 minuten
  useEffect(() => {
    if(!apiKey?.trim()) return;
    fetchBreakingNews();
    const t = setInterval(fetchBreakingNews, 15*60*1000);
    return () => clearInterval(t);
  }, [apiKey]);

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
      .replace(/^---+\s*$/gm,"")  // remove --- lines
      .trim();

    // Find the outermost { ... } — be careful with nested braces
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
      // JSON werd afgekapt — probeer te sluiten door ontbrekende } toe te voegen
      const opens = (s.match(/{/g)||[]).length - (s.match(/}/g)||[]).length;
      const closeArr = (s.match(/\[/g)||[]).length - (s.match(/\]/g)||[]).length;
      s = s + "]".repeat(Math.max(0,closeArr)) + "}".repeat(Math.max(0,opens));
      end = s.length - 1;
    }
    s = s.slice(start, end+1);

    // Quick fix trailing commas
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
        // Is this a real closing quote?
        let j=i+1;
        while(j<s.length&&" \t\n\r".includes(s[j]))j++;
        const nx=s[j];
        if(":"===nx||","===nx||"}"===nx||"]"===nx||j>=s.length){
          inS=false;out+=c;
        } else {
          out+='\u201C'; // replace rogue quote with typographic "
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
      const snip=s.slice(Math.max(0,pos-150),pos+150);
      console.error("JSON BREAK pos="+pos+"\n---\n"+snip+"\n---");
      throw new Error(`JSON fout pos ${pos} — open F12 console voor details`);
    }
  }

  async function callApi(sys, usr, setResult, setError, setStatus) {
    setStatus("loading");
    const headers = {"Content-Type":"application/json"};
    if(apiKey.trim()) { headers["x-api-key"] = apiKey.trim(); headers["anthropic-version"] = "2023-06-01"; headers["anthropic-dangerous-direct-browser-access"] = "true"; }
    const maxRetries = 3;
    for(let attempt=1; attempt<=maxRetries; attempt++) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST", headers,
          body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:3000, system:sys, messages:[{role:"user",content:usr}] })
        });
        if(res.status===429){
          const waitSec = attempt * 20;
          if(attempt<maxRetries){
            setStatus(`waiting-${waitSec}`);
            await new Promise(r=>setTimeout(r, waitSec*1000));
            setStatus("loading");
            continue;
          }
          throw new Error("API limiet bereikt — wacht 1-2 minuten en probeer opnieuw");
        }
        if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||`API fout: ${res.status}`);}
        const data=await res.json();
        const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
        setResult(robustParse(text));
        setStatus("done");
        return;
      } catch(e){
        if(attempt===maxRetries){ setError(e.message||"Onbekende fout"); setStatus("error"); }
        else await new Promise(r=>setTimeout(r,10000));
      }
    }
  }

  async function runPresession() {
    setPsStatus("loading");
    const assetList = assets.map(a=>a.label).join(", ");
    const now = new Date();
    const hourUTC = now.getUTCHours();
    const dateStr = now.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const timeStr = now.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"});
    const sessionCtx = hourUTC>=22||hourUTC<8 ? "Aziatische sessie" : hourUTC>=6&&hourUTC<16 ? "Londense sessie" : "New Yorkse sessie";
    // Inject live prices so no web search needed
    const priceLines = assets.map(a=>{ const p=livePrices[a.id]; return p?`${a.label}: ${p.price} ${p.change}`:a.label; }).join(", ");
    const sys = `Pre-sessie analist. Geen web search nodig. Geen apostrofs in strings. Alleen JSON:
{"session":"London","session_time":"07:00-16:00 CET","mood":"Bullish","mood_score":65,"mood_explanation":"1 zin","volatility_outlook":"Normaal","key_events_today":["event 1"],"market_narrative":"2 zinnen","watch_levels":"1 zin"}`;
    const usr = `VANDAAG ${dateStr} ${timeStr}, ${sessionCtx}. Live prijzen: ${priceLines}. Geef pre-sessie breakdown. Alleen JSON.`;
    try {
      const hdrs = {"Content-Type":"application/json",...(apiKey.trim()?{"x-api-key":apiKey.trim(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}:{})};
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:hdrs,body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,system:sys,messages:[{role:"user",content:usr}]})});
      if(!res.ok) throw new Error(`API fout: ${res.status}`);
      const data=await res.json();
      const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
      setPresession(robustParse(text));
      setPsStatus("done");
    } catch(e){ console.error(e); setPsStatus("error"); }
  }

  async function refreshSingleAsset(asset, openDeepDive=false) {
    if(refreshingAssets.has(asset.id)) return;
    setRefreshingAssets(prev=>new Set([...prev, asset.id]));
    setDeepRefreshing(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
      const hdrs2 = {"Content-Type":"application/json",...(apiKey.trim()?{"x-api-key":apiKey.trim(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}:{})};
      const p = livePrices[asset.id];
      const prev = prevBias[asset.id];
      let macroCtx = "";
      if(iResult) {
        macroCtx = `Regime: ${iResult.macro_regime||""}. Driver: ${iResult.dominant_driver||""}. ${iResult.desk_view||""}`;
        if(iResult.news_items?.length>0) macroCtx += "\nNIEUWS:\n"+iResult.news_items.slice(0,5).map(n=>`- [${n.source}] ${n.headline} → ${n.direction}`).join("\n");
      }
      if(breakingNews?.length>0) macroCtx += "\nBREAKING:\n"+breakingNews.slice(0,3).map(n=>`- [${n.source}] ${n.headline}`).join("\n");
      const dxy   = livePrices["DXY"];
      const us10y = livePrices["US10Y"];
      const xauP  = livePrices["XAUUSD"];
      const crossAsset = [
        dxy   ? `DXY: ${dxy.price} ${dxy.change} (${dxy.direction})` : "DXY: onbekend",
        us10y ? `US10Y: ${us10y.price}% ${us10y.change}` : "US10Y: onbekend",
        xauP && asset.id!=="XAUUSD" ? `XAU/USD: ${xauP.price} ${xauP.change}` : "",
      ].filter(Boolean).join(" | ");
      const newsCompact = macroCtx ? macroCtx.split("\n").slice(0,4).join(" | ") : "Geen context.";
      const prevLine = prev ? `prev=${prev.bias}(${prev.confidence}%)` : "";
      const usr = `${asset.id} | Cross-asset: ${crossAsset} | ${prevLine}
Context: ${newsCompact}
JSON: {"bias":"","confidence":0,"hold_confidence":0,"market_mood":"","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"","mini_summary":"","hold_advies":"","fail_condition":"","macro_alignment":0,"structure_integrity":0,"flow_participation":0,"volatility_regime":0}`;
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:hdrs2,body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,system:ANALYSIS_SYSTEM,messages:[{role:"user",content:usr}]})});
      if(!res.ok) throw new Error(`API fout: ${res.status}`);
      const data=await res.json();
      const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
      const newData=robustParse(text);
      // Prijs van API injekten, niet van AI
      if(p) { newData.price_today=p.price; newData.price_change_today=p.change; newData.price_direction=p.direction; }
      if(newData.bias) setPrevBias(prev=>({...prev,[asset.id]:{bias:newData.bias,confidence:newData.confidence}}));
      setAResult(prev=>prev?{...prev,assets:{...prev.assets,[asset.id]:newData}}:prev);
      if(openDeepDive) setDeepAsset({asset,data:newData});
    } catch(e){ console.error(e); }
    setRefreshingAssets(prev=>{ const s=new Set(prev); s.delete(asset.id); return s; });
    setDeepRefreshing(false);
  }

  const [prevBias, setPrevBias] = useState({}); // geheugen vorige bias per asset

  // Haal technische indicatoren op van Twelve Data (RSI, EMA)
  async function fetchTechnicals(id) {
    if(!tdKey) return null;
    const sym = TWELVE_MAP[id] || id;
    try {
      const [rsiRes, emaRes] = await Promise.all([
        fetch(`https://api.twelvedata.com/rsi?symbol=${sym}&interval=1h&time_period=14&apikey=${tdKey}&outputsize=1`),
        fetch(`https://api.twelvedata.com/ema?symbol=${sym}&interval=1h&time_period=20&apikey=${tdKey}&outputsize=1`),
      ]);
      const rsiData = await rsiRes.json();
      const emaData = await emaRes.json();
      const rsi = parseFloat(rsiData?.values?.[0]?.rsi);
      const ema20 = parseFloat(emaData?.values?.[0]?.ema);
      const price = parseFloat(livePrices[id]?.price);
      if(!rsi) return null;
      return {
        rsi: rsi.toFixed(1),
        ema20: ema20?.toFixed(2),
        priceVsEma: price && ema20 ? (price > ema20 ? "boven EMA20" : "onder EMA20") : null,
        rsiSignal: rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutraal",
      };
    } catch(_) { return null; }
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
    if(apiKey.trim()){ headers["x-api-key"]=apiKey.trim(); headers["anthropic-version"]="2023-06-01"; headers["anthropic-dangerous-direct-browser-access"]="true"; }

    // Verse prijzen ophalen — alleen Finnhub of 12data
    const freshPrices = {...livePrices};
    const allFetchIds = [...new Set([...assets.map(a=>a.id), "DXY","VIX","US10Y"])];

    if(priceSource==="twelvedata" && tdKey) {
      try {
        const batch = await fetchTwelveBatch(allFetchIds, tdKey);
        Object.entries(batch).forEach(([id,p])=>{ freshPrices[id]=p; setLivePrices(prev=>({...prev,[id]:p})); });
      } catch(_) {}
    } else if(priceSource==="finnhub" && fhKey) {
      await Promise.allSettled(allFetchIds.map(async id => {
        try {
          const p = await fetchFinnhubPrice(id, fhKey);
          if(p) { freshPrices[id]=p; setLivePrices(prev=>({...prev,[id]:p})); }
        } catch(_) {}
      }));
    }

    // Technische data ophalen
    const techData = {};
    if(tdKey) {
      await Promise.allSettled(assets.map(async a => {
        const t = await fetchTechnicals(a.id);
        if(t) techData[a.id] = t;
      }));
    }

    // Macro context van Intel + breaking news
    let macroCtx = "";
    if(iResult) {
      macroCtx = `Regime: ${iResult.macro_regime||""}. Driver: ${iResult.dominant_driver||""}. Yields: ${iResult.yield_analysis?.us10y_level||""} (${iResult.yield_analysis?.regime||""}). ${iResult.desk_view||""}`;
      if(iResult.news_items?.length>0) {
        macroCtx += "\nNIEUWS VANDAAG:\n" + iResult.news_items.slice(0,6).map(n=>`- [${n.source}] ${n.headline} → ${n.direction}`).join("\n");
      }
    }
    if(breakingNews?.length>0) {
      macroCtx += "\nBREAKING:\n" + breakingNews.slice(0,4).map(n=>`- [${n.source}] ${n.headline}`).join("\n");
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

      const assetLines = assets.map(a => {
        const p = freshPrices[a.id];
        const prev = prevBias[a.id];
        return `${a.id}${prev?` prev=${prev.bias}(${prev.confidence}%)`:""}`;
      }).join(", ");

      // Nieuws compact — max 4 items, alleen headline + richting
      const newsLines = macroCtx
        ? macroCtx.split("\n").slice(0,6).join("\n")
        : "Geen Intel.";

      const usr = `${dateStr}. Cross-asset: ${crossAsset}
Assets: ${assetLines}
Context: ${newsLines}

JSON (geen wrapper): {"assets":{"ASSET_ID":{"bias":"","confidence":0,"hold_confidence":0,"market_mood":"","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"","mini_summary":"","hold_advies":"","fail_condition":"","macro_alignment":0,"structure_integrity":0,"flow_participation":0,"volatility_regime":0}}}`;

      const body = { model:"claude-sonnet-4-20250514", max_tokens:800, system:ANALYSIS_SYSTEM, messages:[{role:"user",content:usr}] };
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers,body:JSON.stringify(body)});
      if(res.status===429 && attempt < 3) {
        await new Promise(r=>setTimeout(r, attempt * 15000));
        return analyseAllAssets(attempt+1);
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
        // Prijs komt van API, niet van AI — inject hier
        combined.assets[a.id] = {
          ...data,
          price_today: p?.price || "",
          price_change_today: p?.change || "",
          price_direction: p?.direction || "up",
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
    callApi(INTEL_SYSTEM, INTEL_USER_NOW(labels), (result) => {
      setIResult(result);
      // Sync breaking news vanuit Intel AI nieuws items
      if(result?.news_items?.length > 0) {
        const now = new Date();
        const items = result.news_items.map(n => ({
          headline: n.headline,
          source: n.source || "Intel",
          url: n.url || "",
          time: now,
          timeStr: n.time || now.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"}),
          isNew: true,
          direction: n.direction,
        }));
        setBreakingNews(items);
      }
    }, setIError, setIStatus);
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

  return (
    <div style={{minHeight:"100vh",background:"#09090b",fontFamily:"'IBM Plex Sans',-apple-system,sans-serif",color:"#e5e7eb"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;background:#09090b}
        ::-webkit-scrollbar-thumb{background:#1f2023;border-radius:2px}
        button:hover:not(:disabled){filter:brightness(1.15);transform:translateY(-1px)}
        button{transition:all 0.15s!important}
        input[type=color]{cursor:pointer;border:none;background:none;padding:0;width:28px;height:28px;border-radius:4px}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{borderBottom:`1px solid ${accent}22`,padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,position:"sticky",top:0,background:"rgba(9,9,11,0.97)",backdropFilter:"blur(8px)",zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:loading?accent:aStatus==="done"||iStatus==="done"?"#22c55e":"#1f2937",boxShadow:loading?`0 0 8px ${accent}`:aStatus==="done"||iStatus==="done"?"0 0 8px #22c55e":"none",animation:loading?"blink 1s infinite":"none"}}/>
              <span style={{fontSize:9,color:"#374151",letterSpacing:"0.12em"}}>{loading?"● OPHALEN...":aStatus==="done"||iStatus==="done"?"● LIVE":"● STANDBY"}</span>
            </div>
            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:17,fontWeight:700,color:accent,letterSpacing:"0.04em"}}>
              HYBRID <span style={{color:"#e5e7eb"}}>DASHBOARD</span>
            </span>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",gap:3,background:"#0f1011",border:"1px solid #1a1b1e",borderRadius:7,padding:3}}>
            {[{id:"analyse",label:"📊 ANALYSE"},{id:"intel",label:"📡 INTEL"},{id:"calendar",label:"📅 KALENDER"}].map(tab=>(
              <button key={tab.id} onClick={()=>setPage(tab.id)} style={{
                background:page===tab.id?`linear-gradient(135deg,${accent}30,${accent}18)`:"transparent",
                border:`1px solid ${page===tab.id?accent+"55":"transparent"}`,
                borderRadius:5,color:page===tab.id?accent:"#4b5563",
                fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:700,
                letterSpacing:"0.08em",padding:"6px 12px",cursor:"pointer",
              }}>{tab.label}</button>
            ))}
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* API Key */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowKey(s=>!s)} style={{background:apiKey?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)",border:`1px solid ${apiKey?"#22c55e44":"#ef444444"}`,borderRadius:6,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:10}}>{apiKey?"🔑":"⚠️"}</span>
              <span style={{fontSize:9,color:apiKey?"#22c55e":"#ef4444",letterSpacing:"0.08em"}}>{apiKey?"API ACTIEF":"API KEY"}</span>
            </button>
            {showKey&&(
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#111214",border:"1px solid #1f2023",borderRadius:8,padding:"14px",zIndex:100,minWidth:300}}>
                <div style={{fontSize:9,color:"#374151",letterSpacing:"0.1em",marginBottom:6}}>ANTHROPIC API KEY</div>
                <div style={{fontSize:9,color:"#4b5563",marginBottom:8,lineHeight:1.6}}>Haal je key op via <span style={{color:"#6366f1"}}>console.anthropic.com</span> → API Keys.</div>
                <div style={{position:"relative",marginBottom:8}}>
                  <input
                    type={showKeyVal?"text":"password"}
                    value={apiKey}
                    onChange={e=>{ setApiKey(e.target.value); try{localStorage.setItem("hd_apikey",e.target.value);}catch(_){} }}
                    placeholder="sk-ant-api03-..."
                    style={{width:"100%",background:"#0d0e10",border:"1px solid #1f2023",borderRadius:5,color:"#e5e7eb",padding:"7px 36px 7px 10px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",outline:"none"}}
                  />
                  <button onClick={()=>setShowKeyVal(v=>!v)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#4b5563",fontSize:13}}>
                    {showKeyVal?"🙈":"👁️"}
                  </button>
                </div>
                {apiKey&&<div style={{fontSize:9,color:"#22c55e",marginBottom:8}}>✓ Key opgeslagen</div>}
                <button onClick={()=>setShowKey(false)} style={{...btnStyle(false,accent),width:"100%",justifyContent:"center",padding:"7px"}}>SLUITEN</button>
              </div>
            )}
          </div>
          {/* Prijs bron selector */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowTdKey(s=>!s)} style={{background:(tdKey||fhKey)?"rgba(34,197,94,0.08)":"rgba(255,255,255,0.03)",border:`1px solid ${(tdKey||fhKey)?"#22c55e44":"#1f2023"}`,borderRadius:6,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:10}}>📈</span>
              <span style={{fontSize:9,color:(tdKey||fhKey)?"#22c55e":"#4b5563",letterSpacing:"0.08em"}}>
                {(tdKey||fhKey) ? priceSource.toUpperCase().replace("TWELVEDATA","12DATA") : "PRIJS DATA"}
              </span>
            </button>
            {showTdKey&&(
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#111214",border:"1px solid #1f2023",borderRadius:8,padding:"14px",zIndex:100,minWidth:300}}>
                <div style={{fontSize:9,color:"#374151",letterSpacing:"0.1em",marginBottom:10}}>PRIJS DATA BRON</div>

                {/* Source selector */}
                <div style={{display:"flex",gap:6,marginBottom:12}}>
                  {["twelvedata","finnhub","yahoo"].map(src=>(
                    <button key={src} onClick={()=>{ setPriceSource(src); try{localStorage.setItem("hd_psource",src);}catch(_){} }}
                      style={{flex:1,padding:"5px 0",fontSize:9,letterSpacing:"0.08em",borderRadius:5,border:`1px solid ${priceSource===src?"#22c55e44":"#1f2023"}`,background:priceSource===src?"rgba(34,197,94,0.1)":"transparent",color:priceSource===src?"#22c55e":"#4b5563",cursor:"pointer"}}>
                      {src==="twelvedata"?"12DATA":src.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Twelve Data key */}
                {priceSource==="twelvedata"&&(
                  <>
                    <div style={{fontSize:9,color:"#4b5563",marginBottom:6,lineHeight:1.6}}>Gratis key via <span style={{color:"#6366f1"}}>twelvedata.com</span> — 800 requests/dag.</div>
                    <input type="password" value={tdKey}
                      onChange={e=>{ setTdKey(e.target.value); try{localStorage.setItem("hd_tdkey",e.target.value);}catch(_){} }}
                      placeholder="your_twelve_data_key"
                      style={{width:"100%",background:"#0d0e10",border:"1px solid #1f2023",borderRadius:5,color:"#e5e7eb",padding:"7px 10px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",outline:"none",marginBottom:8}}/>
                    {tdKey&&<div style={{fontSize:9,color:"#22c55e",marginBottom:8}}>✓ Twelve Data actief</div>}
                  </>
                )}

                {/* Finnhub key */}
                {priceSource==="finnhub"&&(
                  <>
                    <div style={{fontSize:9,color:"#4b5563",marginBottom:6,lineHeight:1.6}}>Gratis key via <span style={{color:"#6366f1"}}>finnhub.io</span> — 60 requests/minuut, real-time.</div>
                    <input type="password" value={fhKey}
                      onChange={e=>{ setFhKey(e.target.value); try{localStorage.setItem("hd_fhkey",e.target.value);}catch(_){} }}
                      placeholder="your_finnhub_key"
                      style={{width:"100%",background:"#0d0e10",border:"1px solid #1f2023",borderRadius:5,color:"#e5e7eb",padding:"7px 10px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",outline:"none",marginBottom:8}}/>
                    {fhKey&&<div style={{fontSize:9,color:"#22c55e",marginBottom:8}}>✓ Finnhub actief — real-time data</div>}
                  </>
                )}

                {/* Yahoo */}
                {priceSource==="yahoo"&&(
                  <div style={{fontSize:9,color:"#4b5563",lineHeight:1.6,marginBottom:8}}>Yahoo Finance — gratis, geen key nodig. Futures 15 min vertraging, forex real-time.</div>
                )}

                <button onClick={()=>setShowTdKey(false)} style={{...btnStyle(false,accent),width:"100%",justifyContent:"center",padding:"7px"}}>SLUITEN</button>
              </div>
            )}
          </div>
          {/* Auto-refresh */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setAutoRefresh(v=>!v)} style={{background:autoRefresh?"rgba(99,102,241,0.12)":"rgba(255,255,255,0.03)",border:`1px solid ${autoRefresh?"#6366f1":"#1f2023"}`,borderRadius:6,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:10,animation:autoRefresh?"spin 2s linear infinite":"none",display:"inline-block"}}>⟳</span>
              <span style={{fontSize:9,color:autoRefresh?"#818cf8":"#4b5563",letterSpacing:"0.08em"}}>
                {autoRefresh ? (nextRefreshIn!==null ? fmtCountdown(nextRefreshIn) : "AUTO") : "AUTO"}
              </span>
            </button>
          </div>
          {/* Colour picker */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowAccent(s=>!s)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid #1f2023",borderRadius:6,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:12,height:12,borderRadius:"50%",background:accent}}/>
              <span style={{fontSize:9,color:"#4b5563",letterSpacing:"0.08em"}}>KLEUR</span>
            </button>
            {showAccent&&(
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#111214",border:"1px solid #1f2023",borderRadius:8,padding:"10px 12px",zIndex:100,display:"flex",flexDirection:"column",gap:8,minWidth:160}}>
                <div style={{fontSize:9,color:"#374151",letterSpacing:"0.1em"}}>ACCENT KLEUR</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["#089981","#f97316","#6366f1","#22c55e","#ef4444","#a855f7","#06b6d4","#f59e0b"].map(col=>(
                    <div key={col} onClick={()=>{setAccent(col);setShowAccent(false);}} style={{width:20,height:20,borderRadius:"50%",background:col,cursor:"pointer",border:accent===col?"2px solid white":"2px solid transparent"}}/>
                  ))}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:9,color:"#374151"}}>CUSTOM</span>
                  <input type="color" value={accent} onChange={e=>setAccent(e.target.value)}/>
                </div>
              </div>
            )}
          </div>

          {/* + Pair button */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowAddPair(s=>!s)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid #1f2023",borderRadius:6,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:14,color:accent,lineHeight:1}}>+</span>
              <span style={{fontSize:9,color:"#4b5563",letterSpacing:"0.08em"}}>PAIR</span>
            </button>
            {showAddPair&&(
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#111214",border:"1px solid #1f2023",borderRadius:8,padding:"14px",zIndex:100,minWidth:220}}>
                <div style={{fontSize:9,color:"#374151",letterSpacing:"0.1em",marginBottom:8}}>NIEUW PAIR TOEVOEGEN</div>
                <input value={newPairLabel} onChange={e=>setNewPairLabel(e.target.value)} placeholder="bijv. BTC/USD" style={{width:"100%",background:"#0d0e10",border:"1px solid #1f2023",borderRadius:5,color:"#e5e7eb",padding:"6px 10px",fontSize:11,marginBottom:6,fontFamily:"'IBM Plex Mono',monospace"}}/>
                <input value={newPairFull} onChange={e=>setNewPairFull(e.target.value)} placeholder="Bitcoin / US Dollar (optioneel)" style={{width:"100%",background:"#0d0e10",border:"1px solid #1f2023",borderRadius:5,color:"#e5e7eb",padding:"6px 10px",fontSize:11,marginBottom:10,fontFamily:"'IBM Plex Sans',sans-serif"}}/>
                <button onClick={addCustomPair} style={{...btnStyle(false,accent),width:"100%",justifyContent:"center",padding:"7px"}}>TOEVOEGEN</button>
              </div>
            )}
          </div>

          {page==="analyse"
            ? <button onClick={runAnalysis} disabled={aStatus==="loading"||aStatus?.startsWith("waiting")} style={btnStyle(aStatus==="loading"||aStatus?.startsWith("waiting"),accent)}><span>{aStatus==="loading"||aStatus?.startsWith("waiting")?"⬤":"▶"}</span>{aStatus==="loading"?`ANALYSEREN${".".repeat(dots)}`:aStatus?.startsWith("waiting")?`WACHT ${aStatus.split("-")[1]}s...`:"ANALYSE UITVOEREN"}</button>
            : page==="intel" ? <button onClick={runIntel} disabled={iStatus==="loading"} style={btnStyle(iStatus==="loading",accent)}><span>{iStatus==="loading"?"⬤":"↺"}</span>{iStatus==="loading"?`LADEN${".".repeat(dots)}`:"INTEL LADEN"}</button>
            : <button onClick={runIntel} disabled={iStatus==="loading"} style={btnStyle(iStatus==="loading",accent)}><span>{iStatus==="loading"?"⬤":"↺"}</span>{iStatus==="loading"?`LADEN${".".repeat(dots)}`:"KALENDER LADEN"}</button>
          }
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{padding:"20px 24px",maxWidth:1400,margin:"0 auto"}}>

        {/* ANALYSE PAGE */}
        {page==="analyse"&&(
          <>
            {aStatus==="error"&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"12px 18px",marginBottom:14,color:"#f87171",fontSize:12}}><span style={{fontWeight:700}}>FOUT — </span>{aError}</div>}

            {/* Macro bar */}
            {aResult&&(
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,padding:"10px 16px",background:"#0f1011",border:"1px solid rgba(255,255,255,0.04)",borderRadius:8,alignItems:"center"}}>
                <YieldTooltip regime={aResult.yield_regime} explanation={aResult.yield_regime_explanation}/>
                {(livePrices.DXY||aResult.dxy_change)&&(
                  <InfoTooltip text="Dollar Index — meet de sterkte van de USD tegen een mandje van 6 valuta. Stijgt de DXY? Dan dalen EUR/USD en GBP/USD meestal, en staat Goud onder druk." color="#6b7280">
                    <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"4px 9px"}}><span style={{fontSize:9,color:"#374151",letterSpacing:"0.1em"}}>DXY</span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:livePrices.DXY?.direction==="up"?"#22c55e":"#ef4444"}}>{livePrices.DXY?.change||aResult.dxy_change}</span></div>
                  </InfoTooltip>
                )}
                {(livePrices.VIX||aResult.vix_level)&&(
                  <InfoTooltip text="Volatility Index — de angstmeter van de markt. Onder 15 = rustig, 15-25 = normaal, boven 25 = verhoogde onzekerheid, boven 30 = angst/crisis. Hoge VIX = risk-off, laag VIX = risk-on." color="#6b7280">
                    <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"4px 9px"}}><span style={{fontSize:9,color:"#374151",letterSpacing:"0.1em"}}>VIX</span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:parseFloat(livePrices.VIX?.price||aResult.vix_level)>20?"#ef4444":"#9ca3af"}}>{livePrices.VIX?.price||aResult.vix_level}</span></div>
                  </InfoTooltip>
                )}
                {(livePrices.US10Y||aResult.us10y)&&(
                  <InfoTooltip text="Amerikaanse 10-jaars rente. Stijgende yields = USD sterker, druk op Goud en groei-aandelen. Dalende yields = risk-on, gunstig voor Goud en tech. Boven 4.5% = restrictief beleid." color="#6b7280">
                    <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"4px 9px"}}><span style={{fontSize:9,color:"#374151",letterSpacing:"0.1em"}}>US10Y</span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:accent}}>{livePrices.US10Y?.price||aResult.us10y}</span></div>
                  </InfoTooltip>
                )}
                {aResult.session&&(
                  <InfoTooltip text="Actieve handelssessie. London (07:00-16:00 CET) = hoogste volume voor EUR/GBP. New York (13:00-22:00 CET) = hoogste volume voor USD-paren en equities. Overlap London/NY (13:00-16:00) = meest volatiel." color="#6366f1">
                    <Badge label={aResult.session.toUpperCase()+" SESSION"} color="#6366f1"/>
                  </InfoTooltip>
                )}
                {aResult.market_context&&<div style={{flex:1,minWidth:140,fontSize:11,color:"#6b7280"}}>{aResult.market_context}</div>}
                {aResult.timestamp&&<div style={{fontSize:9,color:"#374151",fontFamily:"'IBM Plex Mono',monospace",marginLeft:"auto"}}>{new Date(aResult.timestamp).toLocaleString("nl-NL")}</div>}
              </div>
            )}

            {aStatus==="loading"&&(
              <div style={{background:"#0f1011",border:`1px solid ${accent}30`,borderRadius:8,padding:"14px 20px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:22,height:22,border:`2px solid ${accent}22`,borderTopColor:accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/>
                <div style={{fontSize:12,color:accent,fontWeight:600}}>Live price action & HYBRID PROMPT v6.3 uitvoeren...</div>
              </div>
            )}

            {/* PRE-SESSION BREAKDOWN */}
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <span style={{fontSize:10,color:"#374151",letterSpacing:"0.12em"}}>PRE-SESSIE BREAKDOWN</span>
                  {psStatus==="done"&&presession&&<div style={{width:8,height:8,borderRadius:"50%",background:moodColor(presession.mood),boxShadow:`0 0 6px ${moodColor(presession.mood)}`}}/>}
                </div>
                <button onClick={runPresession} disabled={psStatus==="loading"} style={{...btnStyle(psStatus==="loading",accent),padding:"5px 12px",fontSize:9}}>
                  <span style={{display:"inline-block",animation:psStatus==="loading"?"spin 0.8s linear infinite":"none"}}>↺</span>
                  {psStatus==="loading"?`LADEN...`:"BREAKDOWN LADEN"}
                </button>
              </div>

              {psStatus==="loading"&&<div style={{background:"#0f1011",border:`1px solid ${accent}22`,borderRadius:7,padding:"9px 14px",display:"flex",alignItems:"center",gap:8}}><div style={{width:13,height:13,border:`2px solid ${accent}22`,borderTopColor:accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{fontSize:10,color:accent}}>Sessie data ophalen...</span></div>}

              {psStatus==="done"&&presession&&(
                <div style={{background:"#0f1011",border:`1px solid ${accent}18`,borderRadius:7,padding:"9px 14px",display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
                  {/* Session badge */}
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:moodColor(presession.mood),boxShadow:`0 0 5px ${moodColor(presession.mood)}`}}/>
                    <span style={{fontSize:11,fontWeight:700,color:moodColor(presession.mood)}}>{presession.mood}</span>
                    <span style={{fontSize:9,color:"#374151"}}>{presession.mood_score||""}%</span>
                  </div>
                  {/* Session */}
                  {presession.session&&<div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:9,color:"#374151"}}>SESSIE</span><span style={{fontSize:10,fontWeight:600,color:accent,fontFamily:"'IBM Plex Mono',monospace"}}>{presession.session}</span>{presession.session_time&&<span style={{fontSize:9,color:"#374151"}}>{presession.session_time}</span>}</div>}
                  {/* Volatility */}
                  {presession.volatility_outlook&&<Badge label={presession.volatility_outlook.toUpperCase()} color="#6b7280"/>}
                  {/* Key events */}
                  {presession.key_events_today?.slice(0,3).map((e,i)=><Badge key={i} label={e} color={accent}/>)}
                  {/* Narrative */}
                  <span style={{fontSize:10,color:"#6b7280",flex:1,minWidth:160,lineHeight:1.4}}>{presession.market_narrative}</span>
                  {presession.watch_levels&&<span style={{fontSize:9,color:"#4b5563"}}>📍 {presession.watch_levels}</span>}
                </div>
              )}

              {!presession&&psStatus!=="loading"&&(
                <div style={{background:"#0f1011",border:"1px solid #1a1b1e",borderRadius:7,padding:"9px 14px",textAlign:"center",color:"#2d3748",fontSize:10}}>
                  Klik BREAKDOWN LADEN voor sessie context
                </div>
              )}
            </div>

            {/* ASSET GRID */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
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

            {/* BREAKING NEWS */}
            <div style={{marginTop:8,background:"#0d0e10",border:"1px solid #1a1b1e",borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid #1a1b1e",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 8px #ef4444",animation:"pulse 1.5s infinite"}}/>
                  <span style={{fontSize:10,fontWeight:700,color:"#ef4444",letterSpacing:"0.12em"}}>BREAKING NEWS</span>
                </div>
                <span style={{fontSize:9,color:"#374151"}}>Reuters · Bloomberg · FinancialJuice · Fed/ECB — elke 15 min via AI</span>
                {bnLoading&&<span style={{fontSize:9,color:"#4b5563",marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}><span style={{animation:"spin 0.8s linear infinite",display:"inline-block"}}>⟳</span> ophalen...</span>}
                {!bnLoading&&<button onClick={fetchBreakingNews} style={{marginLeft:"auto",background:"none",border:"1px solid #1f2023",borderRadius:4,color:"#4b5563",fontSize:9,padding:"3px 8px",cursor:"pointer"}}>↺ nu laden</button>}
              </div>
              <div style={{maxHeight:340,overflowY:"auto",padding:"10px 16px",display:"flex",flexDirection:"column",gap:8}}>
                {breakingNews.length===0&&!bnLoading&&(
                  <div style={{color:"#374151",fontSize:11,textAlign:"center",padding:"20px 0"}}>
                    {apiKey?.trim() ? "Klik '↺ nu laden' of wacht op auto-refresh" : "Voer Anthropic API key in voor live nieuws"}
                  </div>
                )}
                {breakingNews.map((n,i)=>(
                  <div key={i}
                    onClick={()=>setNewsImpact(n)}
                    style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 10px",background:n.isNew&&i<3?"rgba(239,68,68,0.05)":"rgba(255,255,255,0.01)",borderRadius:6,border:n.isNew&&i<3?"1px solid rgba(239,68,68,0.15)":"1px solid transparent",cursor:"pointer",transition:"background 0.2s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,0.08)"}
                    onMouseLeave={e=>e.currentTarget.style.background=n.isNew&&i<3?"rgba(239,68,68,0.05)":"rgba(255,255,255,0.01)"}>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#374151",flexShrink:0,marginTop:2}}>{n.timeStr}</span>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:2,flexWrap:"wrap"}}>
                        <Badge label={n.source} color="#6b7280"/>
                        {n.impact==="high"&&<Badge label="HIGH" color="#ef4444"/>}
                        {n.isNew&&i<3&&<Badge label="NIEUW" color="#ef4444"/>}
                        {n.direction&&n.direction!=="neutraal"&&(
                          <span style={{fontSize:11,color:n.direction==="bullish"?"#22c55e":"#ef4444",fontWeight:700}}>
                            {n.direction==="bullish"?"▲":"▼"}
                          </span>
                        )}
                        {n.assets?.length>0&&n.assets.map(a=><Badge key={a} label={a} color="#374151"/>)}
                      </div>
                      <div style={{fontSize:11,color:"#d1d5db",lineHeight:1.5}}>{n.headline}</div>
                    </div>
                    <span style={{fontSize:9,color:"#4b5563",flexShrink:0,marginTop:2}} title="Analyseer impact">⚡</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* INTEL PAGE */}
        {page==="intel"&&(
          <>
            {iStatus==="error"&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"12px 18px",marginBottom:14,color:"#f87171",fontSize:12}}><span style={{fontWeight:700}}>FOUT — </span>{iError}</div>}
            <MarketIntelPage data={iResult} loading={iStatus==="loading"} onRefresh={runIntel} status={iStatus} dots={dots} onNewsClick={n=>setNewsImpact(n)}/>
          </>
        )}

        {/* CALENDAR PAGE */}
        {page==="calendar"&&(
          <>
            {iStatus==="error"&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"12px 18px",marginBottom:14,color:"#f87171",fontSize:12}}><span style={{fontWeight:700}}>FOUT — </span>{iError}</div>}
            {!iResult&&iStatus!=="loading"&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:300,gap:12}}>
                <div style={{fontSize:36,opacity:0.3}}>📅</div>
                <div style={{color:"#374151",fontSize:12}}>Klik KALENDER LADEN om nieuws & events op te halen</div>
              </div>
            )}
            {(iResult||iStatus==="loading")&&(
              <>
                <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontSize:10,color:"#374151",letterSpacing:"0.1em"}}>IMPACT:</span>
                  {["all","high","medium","low"].map(f=>(
                    <button key={f} onClick={()=>setCalFilter(f)} style={{background:calFilter===f?`${accent}22`:"rgba(255,255,255,0.03)",border:`1px solid ${calFilter===f?accent:"rgba(255,255,255,0.07)"}`,borderRadius:5,color:calFilter===f?accent:"#4b5563",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:"0.08em",padding:"5px 12px",cursor:"pointer"}}>
                      {f==="all"?"ALLES":f==="high"?"🔴 HIGH":f==="medium"?"🟡 MEDIUM":"⚪ LOW"}
                    </button>
                  ))}
                  <span style={{fontSize:10,color:"#374151",letterSpacing:"0.1em",marginLeft:8}}>DAG:</span>
                  {["all","today","tomorrow","day_after"].map(d=>(
                    <button key={d} onClick={()=>setCalDayFilter(d)} style={{background:calDayFilter===d?`rgba(99,102,241,0.15)`:"rgba(255,255,255,0.03)",border:`1px solid ${calDayFilter===d?"#6366f1":"rgba(255,255,255,0.07)"}`,borderRadius:5,color:calDayFilter===d?"#818cf8":"#4b5563",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:"0.08em",padding:"5px 12px",cursor:"pointer"}}>
                      {d==="all"?"ALLES":d==="today"?"VANDAAG":d==="tomorrow"?"MORGEN":"OVERMORGEN"}
                    </button>
                  ))}
                  <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
                    {iResult?.timestamp&&<span style={{fontSize:9,color:"#374151",fontFamily:"'IBM Plex Mono',monospace"}}>{new Date(iResult.timestamp).toLocaleString("nl-NL")}</span>}
                  </div>
                </div>

                {iStatus==="loading"&&<div style={{background:"#0f1011",border:`1px solid ${accent}30`,borderRadius:8,padding:"14px 20px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}><div style={{width:20,height:20,border:`2px solid ${accent}22`,borderTopColor:accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/><div style={{fontSize:12,color:accent,fontWeight:600}}>Kalender & nieuws ophalen...</div></div>}

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <div>
                    <div style={{fontSize:10,color:"#374151",letterSpacing:"0.12em",marginBottom:10}}>ECONOMISCHE KALENDER</div>
                    {filteredCal.length===0&&<div style={{color:"#374151",fontSize:11,padding:"20px 0",textAlign:"center"}}>Geen events voor dit filter</div>}
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {filteredCal.map((e,i)=>(
                        <div key={i} style={{background:"#111214",borderLeft:`3px solid ${impactColor[e.impact]||"#374151"}`,borderRadius:8,padding:"12px 14px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:6}}>
                            <div style={{display:"flex",gap:7,alignItems:"center"}}>
                              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:accent,fontWeight:700}}>{e.time}</span>
                              {e.date&&e.date!=="today"&&<span style={{fontSize:9,color:"#6366f1",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:4,padding:"1px 6px",letterSpacing:"0.08em"}}>{e.date==="tomorrow"?"MORGEN":"OVERMORGEN"}</span>}
                              <span style={{fontSize:12,fontWeight:700,color:"#e5e7eb"}}>{e.event}</span>
                            </div>
                            <Badge label={(e.impact||"?").toUpperCase()} color={impactColor[e.impact]||"#6b7280"}/>
                          </div>
                          {(e.actual||e.expected||e.previous)&&(
                            <div style={{display:"flex",gap:14,marginBottom:7,flexWrap:"wrap"}}>
                              {e.actual&&<div><span style={{fontSize:9,color:"#374151",letterSpacing:"0.08em"}}>ACTUEEL </span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,fontWeight:700,color:accent}}>{e.actual}</span></div>}
                              {e.expected&&<div><span style={{fontSize:9,color:"#374151",letterSpacing:"0.08em"}}>VERWACHT </span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#6b7280"}}>{e.expected}</span></div>}
                              {e.previous&&<div><span style={{fontSize:9,color:"#374151",letterSpacing:"0.08em"}}>VORIG </span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#6b7280"}}>{e.previous}</span></div>}
                            </div>
                          )}
                          {e.verdict&&<div style={{marginBottom:5}}><Badge label={e.verdict.toUpperCase()} color={e.verdict.toLowerCase().includes("hot")||e.verdict.toLowerCase().includes("strong")?"#ef4444":"#22c55e"}/></div>}
                          {e.effect&&<div style={{fontSize:11,color:"#6b7280",lineHeight:1.5}}>{e.effect}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{fontSize:10,color:"#374151",letterSpacing:"0.12em",marginBottom:10}}>NIEUWS FEED</div>
                    {filteredNews.length===0&&<div style={{color:"#374151",fontSize:11,padding:"20px 0",textAlign:"center"}}>Geen nieuws voor dit filter</div>}
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {filteredNews.map((n,i)=>(
                        <div key={i} style={{background:"#111214",borderLeft:`3px solid ${dirColor[n.direction]||"#374151"}`,borderRadius:8,padding:"12px 14px",cursor:"pointer"}}
                          onClick={()=>setNewsImpact({headline:n.headline,source:n.source,url:n.url})}>
                          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4b5563"}}>{n.time}</span>
                            {n.date&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#374151"}}>{n.date}</span>}
                            <Badge label={n.source} color="#6b7280"/>
                            {n.category&&<Badge label={n.category} color="#6366f1"/>}
                            {n.impact==="high"&&<Badge label="HIGH" color="#ef4444"/>}
                            <span style={{fontSize:11,color:dirColor[n.direction]||"#9ca3af",fontWeight:700,marginLeft:"auto"}}>{n.direction==="bullish"?"▲":n.direction==="bearish"?"▼":"—"}</span>
                            <span style={{fontSize:9,color:"#4b5563"}}>⚡ impact</span>
                          </div>
                          <div style={{fontSize:12,color:"#d1d5db",lineHeight:1.55,marginBottom:5}}>{n.headline}</div>
                          {n.assets_affected?.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{n.assets_affected.map(a=><Badge key={a} label={a} color="#374151"/>)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
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

      <div style={{padding:"10px 24px",borderTop:"1px solid rgba(255,255,255,0.03)",display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:9,color:"#111315",letterSpacing:"0.1em"}}>HYBRID DASHBOARD — GEEN FINANCIEEL ADVIES</span>
        <span style={{fontSize:9,color:"#111315",fontFamily:"'IBM Plex Mono',monospace"}}>POWERED BY ANTHROPIC + WEB SEARCH</span>
      </div>
    </div>
  );
}
