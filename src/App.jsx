import { useState, useEffect, useRef } from "react";

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

const ANALYSIS_SYSTEM = `Je bent een institutioneel intraday trading analist die de HYBRID PROMPT v6.3 methode gebruikt.
Haal ALTIJD actuele marktdata op via web search voordat je analyseert.

REGELS:
- Yield check VERPLICHT voor alle assets
- Yield regime: Risk-On / Risk-Off / Stagflatie / Neutraal
- Bias: Bullish / Bearish / Neutraal / Fragiel
- Fragiel ALLEEN bij confidence onder 70%. Bij 70% of hoger: gebruik Bullish of Bearish.
- Confidence: 0-100, Hold confidence: 0-100, NOOIT hoger dan confidence
- DXY/Goud anomalie: max confidence 65%, meer dan 2 sessies max 55%
- technical_trend: Strong Uptrend / Choppy Up / Strong Downtrend / Choppy Down / Ranging / Compressing
- GEEN aanhalingstekens of apostrofs binnen string-waarden
- Retourneer ALLEEN geldige JSON, geen markdown, geen tekst buiten JSON

Formaat voor XAUUSD, US30, US100, EURUSD, GBPUSD:
{
  "timestamp": "ISO-string",
  "yield_regime": "Risk-On",
  "yield_regime_explanation": "korte uitleg",
  "dxy_change": "+0.3%",
  "dxy_direction": "up",
  "vix_level": "18.2",
  "us10y": "4.42%",
  "market_context": "korte context",
  "session": "London",
  "assets": {
    "XAUUSD": {
      "bias": "Bullish",
      "confidence": 75,
      "hold_confidence": 60,
      "price_today": "2345.50",
      "price_change_today": "+0.8%",
      "price_direction": "up",
      "correlatie_status": "Normaal",
      "dominant_mechanisme": "korte uitleg",
      "yield_regime": "Risk-Off",
      "yield_regime_explanation": "korte uitleg",
      "intraday_structuur": "HH/HL",
      "intraday_structuur_explanation": "korte uitleg",
      "market_regime": "trend",
      "market_regime_explanation": "korte uitleg",
      "trend_driver": "yields",
      "technical_trend": "Choppy Up",
      "technical_trend_explanation": "korte uitleg",
      "mini_summary": "2 zinnen analyse",
      "deep_summary": "uitgebreide analyse zonder apostrofs of aanhalingstekens",
      "hold_advies": "instructie",
      "fail_condition": "conditie",
      "macro_alignment": 80,
      "structure_integrity": 75,
      "flow_participation": 70,
      "volatility_regime": 65,
      "key_confluences": ["factor 1", "factor 2"],
      "news_items": [{"headline": "nieuwstitel", "source": "Reuters", "direction": "bullish", "time": "09:30", "url": ""}]
    },
    "US30": {"bias":"Bullish","confidence":70,"hold_confidence":60,"price_today":"","price_change_today":"","price_direction":"up","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"Risk-On","yield_regime_explanation":"","intraday_structuur":"","intraday_structuur_explanation":"","market_regime":"trend","market_regime_explanation":"","trend_driver":"risk","technical_trend":"Choppy Up","technical_trend_explanation":"","mini_summary":"","deep_summary":"","hold_advies":"","fail_condition":"","macro_alignment":75,"structure_integrity":70,"flow_participation":65,"volatility_regime":60,"key_confluences":[],"news_items":[]},
    "US100": {"bias":"Bullish","confidence":70,"hold_confidence":60,"price_today":"","price_change_today":"","price_direction":"up","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"Risk-On","yield_regime_explanation":"","intraday_structuur":"","intraday_structuur_explanation":"","market_regime":"trend","market_regime_explanation":"","trend_driver":"risk","technical_trend":"Choppy Up","technical_trend_explanation":"","mini_summary":"","deep_summary":"","hold_advies":"","fail_condition":"","macro_alignment":75,"structure_integrity":70,"flow_participation":65,"volatility_regime":60,"key_confluences":[],"news_items":[]},
    "EURUSD": {"bias":"Neutraal","confidence":55,"hold_confidence":45,"price_today":"","price_change_today":"","price_direction":"up","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"Neutraal","yield_regime_explanation":"","intraday_structuur":"","intraday_structuur_explanation":"","market_regime":"range","market_regime_explanation":"","trend_driver":"USD","technical_trend":"Ranging","technical_trend_explanation":"","mini_summary":"","deep_summary":"","hold_advies":"","fail_condition":"","macro_alignment":60,"structure_integrity":55,"flow_participation":50,"volatility_regime":50,"key_confluences":[],"news_items":[]},
    "GBPUSD": {"bias":"Neutraal","confidence":55,"hold_confidence":45,"price_today":"","price_change_today":"","price_direction":"up","correlatie_status":"Normaal","dominant_mechanisme":"","yield_regime":"Neutraal","yield_regime_explanation":"","intraday_structuur":"","intraday_structuur_explanation":"","market_regime":"range","market_regime_explanation":"","trend_driver":"USD","technical_trend":"Ranging","technical_trend_explanation":"","mini_summary":"","deep_summary":"","hold_advies":"","fail_condition":"","macro_alignment":60,"structure_integrity":55,"flow_participation":50,"volatility_regime":50,"key_confluences":[],"news_items":[]}
  }
}`;

const INTEL_SYSTEM = `Je bent een institutioneel macro market intelligence analist.
Gebruik web search om het volledige marktplaatje van VANDAAG op te halen.
Haal minimaal 5 nieuwsitems op via web search.
GEEN apostrofs of aanhalingstekens in string-waarden.

Retourneer UITSLUITEND JSON, geen markdown:
{
  "timestamp": "ISO-string",
  "market_snapshot": {
    "gold":   {"price": "2345", "change": "+0.8%", "direction": "up", "note": "1 zin"},
    "us30":   {"price": "38450", "change": "-0.2%", "direction": "down", "note": "1 zin"},
    "us100":  {"price": "17820", "change": "+0.4%", "direction": "up", "note": "1 zin"},
    "eurusd": {"price": "1.0842", "change": "-0.1%", "direction": "down", "note": "1 zin"},
    "gbpusd": {"price": "1.2680", "change": "+0.2%", "direction": "up", "note": "1 zin"}
  },
  "macro_regime": "Risk-On",
  "dominant_driver": "1 zin",
  "session_context": "1 zin",
  "yield_analysis": {"us10y_level": "4.42%", "us2y_level": "4.89%", "spread": "-47bp", "regime": "Inversie", "implication": "1 zin"},
  "cross_asset_signals": [{"signal": "DXY + Gold", "type": "anomalie", "implication": "1 zin"}],
  "risk_radar": {"score": 65, "label": "Elevated", "factors": ["factor 1", "factor 2"]},
  "desk_view": "2 zinnen perspectief",
  "news_items": [{"time": "09:30", "source": "Reuters", "category": "Fed", "headline": "nieuwstitel zonder apostrofs", "impact": "high", "direction": "bullish", "assets_affected": ["XAU/USD"]}],
  "economic_calendar": [{"time": "14:30", "event": "US CPI", "actual": "3.2%", "expected": "3.1%", "previous": "3.4%", "impact": "high", "verdict": "hotter", "effect": "1 zin"}]
}`;


function INTEL_USER_NOW(assetLabels) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const timeStr = now.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"});
  return `VANDAAG is ${dateStr}, huidige tijd: ${timeStr} CET.
Haal live marktdata en nieuws van VANDAAG op via web search.
Live prijzen: goud, US30, US100, EURUSD, GBPUSD.
Minimaal 5 nieuwsitems van vandaag. Economische kalender van vandaag.
BELANGRIJK: Gebruik in assets_affected ALLEEN: ${assetLabels.join(", ")}.
Gebruik voor alle tijden het formaat HH:MM (bijv. 09:30, 14:30).
Sorteer news_items en economic_calendar op tijd — NIEUWSTE EERST (hoogste tijd bovenaan).
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
  const ref = useRef(null);
  return (
    <div ref={ref} style={{position:"relative",display:"inline-flex",alignItems:"center",gap:4}}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      <span style={{fontSize:9,color:color,opacity:0.6,cursor:"help",lineHeight:1}}>ⓘ</span>
      {show&&text&&(
        <div style={{position:"absolute",bottom:"calc(100% + 7px)",left:"50%",transform:"translateX(-50%)",zIndex:300,background:"#1a1b1e",border:`1px solid ${color}44`,borderRadius:7,padding:"9px 13px",minWidth:200,maxWidth:260,fontSize:11,color:"#d1d5db",lineHeight:1.55,boxShadow:"0 6px 24px rgba(0,0,0,0.6)",pointerEvents:"none"}}>
          <div style={{fontSize:9,color,letterSpacing:"0.1em",marginBottom:4,fontWeight:700}}>{typeof children==="string"?children:""}</div>
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
                <div style={{fontSize:10,color:"#4b5563",marginTop:6}}>{data?.confidence>=80?"Sterk signaal":data?.confidence>=65?"Matig signaal":"Zwak / twijfelachtig"}</div>
              </div>
              <div style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:8,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"#4b5563",letterSpacing:"0.1em",marginBottom:8}}>HOLD CONFIDENCE</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:30,fontWeight:700,color:"#6366f1",marginBottom:8}}>{data?.hold_confidence}%</div>
                <Bar value={data?.hold_confidence||0} color="#6366f1"/>
                <div style={{fontSize:10,color:"#4b5563",marginTop:6}}>{data?.hold_confidence>=80?"🟢 Hold vol":data?.hold_confidence>=60?"🟡 Bescherm winst":data?.hold_confidence>=40?"⚠️ Reduce exposure":"🔴 Exit"}</div>
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

function AssetCard({ asset, data, index, loading, onClick, accent }) {
  const [vis, setVis] = useState(false);
  const acc = accent || DEFAULT_ACCENT;
  useEffect(()=>{const t=setTimeout(()=>setVis(true),index*80);return()=>clearTimeout(t);},[data,loading]);
  const bias = resolveBias(data?.bias, data?.confidence);
  const c = biasColors[bias] || biasColors.Neutraal;
  const priceUp = data?.price_direction === "up";

  return (
    <div onClick={data ? onClick : undefined} style={{background:"linear-gradient(145deg,#111214,#0d0e10)",border:`1px solid ${data?.bias?c.border+"44":"#1a1b1e"}`,borderRadius:8,padding:"16px 18px",opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(10px)",transition:"all 0.5s cubic-bezier(0.4,0,0.2,1)",position:"relative",overflow:"hidden",cursor:data?"pointer":"default"}}>
      {data?.bias&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${c.border},transparent)`}}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2,flexWrap:"wrap"}}>
            <span style={{flexShrink:0}}><AssetLogo id={asset.id} size={22}/></span>
            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:700,color:"#e5e7eb",letterSpacing:"0.05em"}}>{asset.label}</span>
            {data?.price_change_today&&(
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:priceUp?"#22c55e":"#ef4444"}}>
                {priceUp?"↑":"↓"}{data.price_change_today}
              </span>
            )}
          </div>
          <div style={{fontSize:10,color:"#374151"}}>{asset.full}</div>
        </div>
        {data?.bias
          ? <div style={{background:c.bg,border:`1px solid ${c.border}44`,borderRadius:5,padding:"4px 10px",flexShrink:0}}><span style={{fontSize:11,fontWeight:700,color:c.text,letterSpacing:"0.06em"}}>{bias?.toUpperCase()}</span></div>
          : loading ? <Skeleton w={72} h={26} mb={0}/> : null}
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
          <div style={{marginBottom:6}}><div style={{fontSize:9,color:"#374151",letterSpacing:"0.1em",marginBottom:2}}>ANALYSE</div><div style={{fontSize:11,color:"#6b7280",lineHeight:1.55}}>{data.mini_summary}</div></div>
          <div style={{background:`${acc}09`,border:`1px solid ${acc}18`,borderRadius:5,padding:"7px 10px",marginBottom:6}}><div style={{fontSize:9,color:acc,letterSpacing:"0.1em",marginBottom:1}}>HOLD ADVIES</div><div style={{fontSize:11,color:"#d1d5db"}}>{data.hold_advies}</div></div>
          <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.12)",borderRadius:5,padding:"7px 10px"}}><div style={{fontSize:9,color:"#ef4444",letterSpacing:"0.1em",marginBottom:1}}>FAIL CONDITION</div><div style={{fontSize:11,color:"#6b7280"}}>{data.fail_condition}</div></div>
        </>
      ) : loading ? (
        <div>{[85,65,45,100,75,55].map((w,i)=><Skeleton key={i} w={`${w}%`}/>)}</div>
      ) : (
        <div style={{textAlign:"center",padding:"20px 0",color:"#2d3139",fontSize:11}}>Klik ANALYSE UITVOEREN</div>
      )}
    </div>
  );
}

function MarketIntelPage({ data, loading, onRefresh, status, dots }) {
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

      {/* Snapshot grid */}
      <div>
        <div style={{fontSize:10,color:"#374151",letterSpacing:"0.12em",marginBottom:8}}>MARKET SNAPSHOT</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
          {Object.entries(snap).map(([key,val])=>{
            if(!val) return null;
            const col = val.direction==="up"?"#22c55e":"#ef4444";
            const arrow = val.direction==="up"?"↑":"↓";
            return (
              <div key={key} style={{background:"#111214",border:"1px solid #1a1b1e",borderRadius:7,padding:"10px 12px"}}>
                <div style={{fontSize:9,color:"#374151",letterSpacing:"0.1em",marginBottom:4}}>{snapLabels[key]||key.toUpperCase()}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:700,color:"#e5e7eb"}}>{val.price}</span>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:600,color:col}}>{arrow}{val.change}</span>
                </div>
                {val.note&&<div style={{fontSize:10,color:"#4b5563",lineHeight:1.4}}>{val.note}</div>}
              </div>
            );
          })}
        </div>
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
              <div key={i} style={{borderLeft:`2px solid ${impactColor[n.impact]||"#374151"}`,paddingLeft:10}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4b5563"}}>{n.time}</span>
                  <Badge label={n.source} color="#6b7280"/>
                  <Badge label={n.category} color="#6366f1"/>
                  {n.impact==="high"&&<Badge label="HIGH" color="#ef4444"/>}
                  <span style={{fontSize:11,color:dirColor[n.direction]||"#9ca3af",fontWeight:700}}>{n.direction==="bullish"?"▲":n.direction==="bearish"?"▼":"—"}</span>
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
                <div style={{fontSize:10,color:"#374151",letterSpacing:"0.12em",marginBottom:8}}>RISK RADAR</div>
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
  const [calFilter,     setCalFilter]     = useState("all");
  const [accent,        setAccent]        = useState(DEFAULT_ACCENT);
  const [apiKey,        setApiKey]        = useState(() => localStorage.getItem("hd_apikey")||"");
  const [showKey,       setShowKey]       = useState(false);
  const [showAccent,    setShowAccent]    = useState(false);
  const [assets,        setAssets]        = useState(BASE_ASSETS);
  const [showAddPair,   setShowAddPair]   = useState(false);
  const [newPairLabel,  setNewPairLabel]  = useState("");
  const [newPairFull,   setNewPairFull,]  = useState("");
  const [presession,    setPresession]    = useState(null);
  const [psStatus,      setPsStatus]      = useState("idle");

  useEffect(()=>{
    if(aStatus==="loading"||iStatus==="loading"||psStatus==="loading"){
      const t=setInterval(()=>setDots(d=>(d+1)%4),400);
      return()=>clearInterval(t);
    }
  },[aStatus,iStatus,psStatus]);

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
    if(end===-1) throw new Error("Geen sluitende } gevonden");
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
    const maxRetries = 2;
    for(let attempt=1; attempt<=maxRetries; attempt++) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:4000,
            system:sys,
            tools:[{type:"web_search_20250305",name:"web_search"}],
            messages:[{role:"user",content:usr}]
          })
        });
        if(res.status===429){
          if(attempt<maxRetries){ await new Promise(r=>setTimeout(r,8000)); continue; }
          throw new Error("API limiet bereikt — sluit dit chatvenster even of wacht 1 minuut en probeer opnieuw");
        }
        if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||`API fout: ${res.status}`);}
        const data=await res.json();
        const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
        setResult(robustParse(text));
        setStatus("done");
        return;
      } catch(e){
        if(attempt===maxRetries){ setError(e.message||"Onbekende fout"); setStatus("error"); }
        else await new Promise(r=>setTimeout(r,5000));
      }
    }
  }

  async function runPresession() {
    setPsStatus("loading");
    const assetList = assets.map(a=>a.label).join(", ");
    const now = new Date();
    const hourUTC = now.getUTCHours();
    const dateStr = now.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const sessionCtx = hourUTC>=22||hourUTC<8 ? "Aziatische sessie" : hourUTC>=6&&hourUTC<16 ? "Londense sessie" : "New Yorkse sessie";
    const sys = `Je bent een pre-sessie trading analist. VANDAAG is ${dateStr}. Actieve sessie: ${sessionCtx}.
Gebruik web search voor nieuws van VANDAAG. Geen apostrofs in strings. Retourneer ALLEEN JSON:
{"session":"London","session_time":"07:00-16:00 CET","mood":"Bullish","mood_score":65,"mood_explanation":"1 zin","volatility_outlook":"Normaal","key_events_today":["event 1"],"market_narrative":"2 zinnen","watch_levels":"1 zin"}`;
    const usr = `Pre-sessie voor VANDAAG (${dateStr}): ${assetList}. Retourneer alleen JSON.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,system:sys,tools:[{type:"web_search_20250305",name:"web_search"}],messages:[{role:"user",content:usr}]})});
      if(!res.ok) throw new Error(`API fout: ${res.status}`);
      const data=await res.json();
      const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
      setPresession(robustParse(text));
      setPsStatus("done");
    } catch(e){ console.error(e); setPsStatus("error"); }
  }

  async function refreshSingleAsset(asset) {
    if(deepRefreshing) return;
    setDeepRefreshing(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,system:ANALYSIS_SYSTEM,tools:[{type:"web_search_20250305",name:"web_search"}],messages:[{role:"user",content:`VANDAAG: ${dateStr}. Analyseer ALLEEN ${asset.label}. Gebruik web search voor live prijs. Retourneer JSON met alleen het ${asset.id} asset object (geen wrapper).`}]})});
      if(!res.ok) throw new Error(`API fout: ${res.status}`);
      const data=await res.json();
      const text=data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
      const parsed=robustParse(text);
      const newData=parsed.assets?.[asset.id]||parsed;
      setAResult(prev=>prev?{...prev,assets:{...prev.assets,[asset.id]:newData}}:prev);
      setDeepAsset({asset,data:newData});
    } catch(e){ console.error(e); }
    setDeepRefreshing(false);
  }

  function addCustomPair() {
    if(!newPairLabel.trim()) return;
    const id = newPairLabel.replace("/","").toUpperCase();
    setAssets(prev=>[...prev,{id,label:newPairLabel.toUpperCase(),full:newPairFull||newPairLabel.toUpperCase(),group:"custom",searchTerms:newPairLabel}]);
    setNewPairLabel(""); setNewPairFull(""); setShowAddPair(false);
  }

  const runAnalysis = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const ids = assets.map(a=>a.id).join(", ");
    const usr = `VANDAAG is ${dateStr}. Analyseer: ${ids}. Gebruik web search voor LIVE prijzen en % verandering van vandaag voor elk asset. Retourneer alleen JSON.`;
    setAError(""); callApi(ANALYSIS_SYSTEM, usr, setAResult, setAError, setAStatus);
  };

  const runIntel = () => {
    setIError("");
    const labels = assets.map(a=>a.label);
    callApi(INTEL_SYSTEM, INTEL_USER_NOW(labels), setIResult, setIError, setIStatus);
  };
  const loading = aStatus==="loading"||iStatus==="loading";

  const RELEVANT_ASSETS = assets.flatMap(a=>[a.label,a.id]);
  const parseTime = t => { if(!t) return 0; const m=String(t).match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1])*60+parseInt(m[2]) : 0; };
  const calendarItems = (iResult?.economic_calendar||[]).slice().sort((a,b)=>parseTime(b.time)-parseTime(a.time));
  const newsItems = (iResult?.news_items||[]).map(n=>({...n,assets_affected:(n.assets_affected||[]).filter(a=>RELEVANT_ASSETS.some(r=>a.includes(r)||r.includes(a)))})).slice().sort((a,b)=>parseTime(b.time)-parseTime(a.time));
  const filteredCal  = calFilter==="all" ? calendarItems : calendarItems.filter(e=>e.impact===calFilter);
  const filteredNews = calFilter==="all" ? newsItems      : newsItems.filter(n=>n.impact===calFilter);

  const moodColor = (m) => { if(!m) return "#6b7280"; const l=m.toLowerCase(); if(l.includes("bull")) return "#22c55e"; if(l.includes("bear")) return "#ef4444"; if(l.includes("chop")||l.includes("vol")) return accent; return "#6b7280"; };

  return (
    <div style={{minHeight:"100vh",background:"#09090b",fontFamily:"'IBM Plex Sans',-apple-system,sans-serif",color:"#e5e7eb"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
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
            ? <button onClick={runAnalysis} disabled={aStatus==="loading"} style={btnStyle(aStatus==="loading",accent)}><span>{aStatus==="loading"?"⬤":"▶"}</span>{aStatus==="loading"?`ANALYSEREN${".".repeat(dots)}`:"ANALYSE UITVOEREN"}</button>
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
                {aResult.dxy_change&&<div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"4px 9px"}}><span style={{fontSize:9,color:"#374151",letterSpacing:"0.1em"}}>DXY</span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:aResult.dxy_direction==="up"?"#22c55e":"#ef4444"}}>{aResult.dxy_change}</span></div>}
                {aResult.vix_level&&<div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"4px 9px"}}><span style={{fontSize:9,color:"#374151",letterSpacing:"0.1em"}}>VIX</span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:parseFloat(aResult.vix_level)>20?"#ef4444":"#9ca3af"}}>{aResult.vix_level}</span></div>}
                {aResult.us10y&&<div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"4px 9px"}}><span style={{fontSize:9,color:"#374151",letterSpacing:"0.1em"}}>US10Y</span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,color:accent}}>{aResult.us10y}</span></div>}
                {aResult.session&&<Badge label={aResult.session.toUpperCase()+" SESSION"} color="#6366f1"/>}
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
                <AssetCard key={asset.id} asset={asset} data={aResult?.assets?.[asset.id]||null} index={i} loading={aStatus==="loading"} accent={accent}
                  onClick={()=>setDeepAsset({asset, data:aResult?.assets?.[asset.id]})}/>
              ))}
            </div>
          </>
        )}

        {/* INTEL PAGE */}
        {page==="intel"&&(
          <>
            {iStatus==="error"&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"12px 18px",marginBottom:14,color:"#f87171",fontSize:12}}><span style={{fontWeight:700}}>FOUT — </span>{iError}</div>}
            <MarketIntelPage data={iResult} loading={iStatus==="loading"} onRefresh={runIntel} status={iStatus} dots={dots}/>
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
                  <span style={{fontSize:10,color:"#374151",letterSpacing:"0.1em"}}>FILTER:</span>
                  {["all","high","medium","low"].map(f=>(
                    <button key={f} onClick={()=>setCalFilter(f)} style={{background:calFilter===f?`${accent}22`:"rgba(255,255,255,0.03)",border:`1px solid ${calFilter===f?accent:"rgba(255,255,255,0.07)"}`,borderRadius:5,color:calFilter===f?accent:"#4b5563",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:"0.08em",padding:"5px 12px",cursor:"pointer"}}>
                      {f==="all"?"ALLES":f==="high"?"🔴 HIGH":f==="medium"?"🟡 MEDIUM":"⚪ LOW"}
                    </button>
                  ))}
                  <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:9,color:"#374151",letterSpacing:"0.06em"}}>↓ NIEUWSTE EERST</span>
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
                        <div key={i} onClick={()=>n.url&&window.open(n.url,"_blank")} style={{background:"#111214",borderLeft:`3px solid ${dirColor[n.direction]||"#374151"}`,borderRadius:8,padding:"12px 14px",cursor:n.url?"pointer":"default"}}>
                          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4b5563"}}>{n.time}</span>
                            {n.date&&<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#374151"}}>{n.date}</span>}
                            <Badge label={n.source} color="#6b7280"/>
                            {n.category&&<Badge label={n.category} color="#6366f1"/>}
                            {n.impact==="high"&&<Badge label="HIGH" color="#ef4444"/>}
                            <span style={{fontSize:11,color:dirColor[n.direction]||"#9ca3af",fontWeight:700,marginLeft:"auto"}}>{n.direction==="bullish"?"▲":n.direction==="bearish"?"▼":"—"}</span>
                            {n.url&&<span style={{fontSize:9,color:"#374151"}}>↗</span>}
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

      <div style={{padding:"10px 24px",borderTop:"1px solid rgba(255,255,255,0.03)",display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:9,color:"#111315",letterSpacing:"0.1em"}}>HYBRID DASHBOARD — GEEN FINANCIEEL ADVIES</span>
        <span style={{fontSize:9,color:"#111315",fontFamily:"'IBM Plex Mono',monospace"}}>POWERED BY ANTHROPIC + WEB SEARCH</span>
      </div>
    </div>
  );
}
