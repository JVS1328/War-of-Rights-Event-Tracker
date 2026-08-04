/* ══ Heatmaps — the tracker's own blue → purple → red ramp ════════
   Value is each pair's share of the rounds where BOTH were active, so a
   unit that missed half the season is not punished for it. Every cell
   carries its number, which is what makes a three-stop ramp readable. */
function heatRgb(p){
  let r,g,b;
  if(p<=50){ const t=p/50; r=Math.round(135+(147-135)*t); g=Math.round(206-(206-51)*t); b=235; }
  else     { const t=(p-50)/50; r=Math.round(147+(220-147)*t); g=Math.round(51-(51-38)*t); b=Math.round(235-(235-38)*t); }
  return [r,g,b];
}
const heatCss = p => `rgb(${heatRgb(p).join(',')})`;
/** Cell text flips to dark on the light end of the ramp so labels stay legible. */
const heatInk = p => {
  const [r,g,b]=heatRgb(p);
  return (0.299*r + 0.587*g + 0.114*b) > 150 ? '#12140f' : '#fff';
};

V.heat = () => {
  const H = D.heat, mode = state.heatMode || 'mate';
  const grid = mode==='mate' ? H.mate : H.foe;
  const avg  = mode==='mate' ? H.mateAvg : H.foeAvg;
  const U = H.units;
  const verb = mode==='mate' ? 'together' : 'against each other';

  const cells = U.map((a,i)=>`<tr>
    <th scope="row" class="hm-row">${esc(a)}</th>
    ${U.map((b,j)=>{
      const c = grid[i][j];
      if(!c) return `<td class="hm-c hm-x" aria-hidden="true"></td>`;
      if(!c.both) return `<td class="hm-c hm-x" data-tip="${esc(a)} + ${esc(b)} — never both on the field"></td>`;
      return `<td class="hm-c" style="background:${heatCss(c.pct)};color:${heatInk(c.pct)}"
        tabindex="0"
        data-tip="${esc(a)} + ${esc(b)} — ${c.n} of ${c.both} shared rounds ${verb} (${c.pct}%)"
        aria-label="${esc(a)} and ${esc(b)}, ${c.pct} percent">${c.pct}</td>`;
    }).join('')}</tr>`).join('');

  const stops = [0,10,20,30,40,50,60,70,80,90,100];
  const legend = `<div class="hm-legend">
    <span class="cap">0%</span>
    <span class="hm-ramp">${stops.map(p=>`<i style="background:${heatCss(p)}"></i>`).join('')}</span>
    <span class="cap">100%</span>
    <span class="note" style="margin-left:auto">share of the rounds both units were on the field</span></div>`;

  const tbl = list => list.map((p,i)=>`<tr>
    <td><span class="pos ${i===0?'q':''}">${i+1}</span></td>
    <td class="nm">${esc(p.a)} + ${esc(p.b)}</td>
    <td class="num" style="font-weight:600">${p.pct}%</td>
    <td class="num" style="color:var(--ink-2)">${p.n} of ${p.both} rounds</td></tr>`).join('');

  return `
  <div class="panel">
    <div class="ctl"><span class="cap">Matrix</span>
      <div class="seg" id="heat-mode">
        <button data-m="mate" aria-pressed="${mode==='mate'}">Same side</button>
        <button data-m="foe" aria-pressed="${mode==='foe'}">Opposite sides</button></div>
      <i class="rule"></i>
      <span class="meta">${U.length} token units · average ${avg}%</span></div>
  </div>

  <div class="panel"><header class="ph">
      <h2>${mode==='mate'?'Teammate composition':'Opponent exposure'}</h2><i class="rule"></i>
      <span class="meta">% of shared rounds spent ${verb}</span></header>
    <div class="pb scroll-x">
      ${legend}
      <table class="hm"><thead><tr><th class="hm-corner"></th>
        ${U.map(u=>`<th class="hm-col"><span>${esc(u)}</span></th>`).join('')}</tr></thead>
        <tbody>${cells}</tbody></table>
    </div>
    <div class="note" style="padding:0 13px 13px">Counted per round, not per night, so a unit swapped across at half time counts on both sides.
      ${mode==='mate'
        ? 'The balancer\'s teammate-history weight reads exactly this matrix — a hot cell is a pairing it will try to break up.'
        : 'A pair that never meets is as much an imbalance as one that always does.'}</div>
  </div>

  ${panel(mode==='mate'?'Most locked-together':'Most frequent opponents','the table view of the matrix above',
    `<div class="scroll-x"><table>
      <thead><tr><th></th><th>Pair</th><th class="num">Share</th><th class="num">Rounds</th></tr></thead>
      <tbody>${tbl(H.top)}</tbody></table></div>`)}
  ${panel(mode==='mate'?'Least locked-together':'Rarest opponents','',
    `<div class="scroll-x"><table>
      <thead><tr><th></th><th>Pair</th><th class="num">Share</th><th class="num">Rounds</th></tr></thead>
      <tbody>${tbl(H.low)}</tbody></table></div>`)}`;
};

/* ══ Maps — the full stat set, both sources ═══════════════════════ */
V.maps = () => {
  const MS = D.mapStats;
  const src = state.mapSrc || 'tracker';
  const S = MS[src], O = S.overall;
  const open = new Set(state.openAreas || Object.keys(MS.areas));
  const pctOf = (w,t) => t>0 ? (w/t*100).toFixed(1) : '0.0';

  const tiles = [
    ['USA overall', pctOf(O.usaWins,O.totalRounds)+'%', `${O.usaWins} of ${O.totalRounds}`],
    ['CSA overall', pctOf(O.csaWins,O.totalRounds)+'%', `${O.csaWins} of ${O.totalRounds}`],
    ['Attackers won', pctOf(O.atkWins,O.atkRounds)+'%', `${O.atkWins} of ${O.atkRounds}`],
    ['Defenders won', pctOf(O.defWins,O.atkRounds)+'%', `${O.defWins} of ${O.atkRounds}`],
  ].map(([h,v,x])=>`<div class="kpi"><div class="cap">${h}</div><div class="v">${v}</div><div class="h">${x}</div></div>`).join('');

  const casBlock = (label,total,form,cls) => `<div class="col">
    <div style="display:flex;align-items:center;gap:8px">
      ${cls?`<span class="tag ${cls}">${label}</span>`:`<span class="cap">${label}</span>`}
      <i class="rule"></i><span class="meta">${total.toLocaleString()} men</span></div>
    ${O.hasForm ? `<div class="stack" style="margin-top:9px">
        <i style="width:${pc(form[0],form[0]+form[1]+form[2])}%;background:var(--st1)"></i>
        <i style="width:${pc(form[1],form[0]+form[1]+form[2])}%;background:var(--st2)"></i>
        <i style="width:${pc(form[2],form[0]+form[1]+form[2])}%;background:var(--st3)"></i></div>
      <div class="leg">
        <span><i style="background:var(--st1)"></i>In formation ${form[0].toLocaleString()}</span>
        <span><i style="background:var(--st2)"></i>Skirmish ${form[1].toLocaleString()}</span>
        <span><i style="background:var(--st3)"></i>Out of line ${form[2].toLocaleString()}</span></div>`
      : `<div class="note" style="margin-top:7px">Week-bound rounds record a casualty total only. Switch to Scoreboards for the stance split.</div>`}</div>`;

  const maps = Object.values(S.byMap);
  const mostPlayed = maps.slice().sort((a,b)=>b.plays-a.plays).slice(0,6).map(m=>`<tr>
    <td class="nm">${esc(m.map)}</td>
    <td><span class="tag q">${esc(MS.areas[m.area]||'—')}</span></td>
    <td class="num">${m.plays}</td>
    <td class="num f-usa">${m.usaWins}</td><td class="num f-csa">${m.csaWins}</td>
    <td><div class="stack" style="width:110px"><i style="width:${pc(m.usaWins,m.plays)}%;background:var(--union)"></i>
      <i style="flex:1;background:var(--reb)"></i></div></td>
    <td class="num" style="color:var(--ink-2)">${Math.round(m.totalCas/(m.plays||1)).toLocaleString()}/rd</td></tr>`).join('');

  const card = m => `<div class="mapcard">
    <div style="display:flex;align-items:baseline;gap:8px">
      <span class="nm" style="font-size:13px">${esc(m.map)}</span><i class="rule"></i>
      <span class="meta">${m.plays} round${m.plays===1?'':'s'}</span></div>
    <div class="stack" style="margin-top:8px">
      <i style="width:${pc(m.usaWins,m.plays)}%;background:var(--union)"></i>
      <i style="width:${pc(m.csaWins,m.plays)}%;background:var(--reb)"></i>
      <i style="flex:1;background:var(--line-2)"></i></div>
    <div class="leg">
      <span><i style="background:var(--union)"></i>USA ${m.usaWins} · ${pctOf(m.usaWins,m.plays)}%</span>
      <span><i style="background:var(--reb)"></i>CSA ${m.csaWins} · ${pctOf(m.csaWins,m.plays)}%</span>
      ${m.draws?`<span><i style="background:var(--line-2)"></i>Draw ${m.draws}</span>`:''}</div>
    <dl class="mapdl">
      ${m.atkRounds?`<dt>${MS.usaAttack.includes(m.map)?'USA':'CSA'} attacks</dt>
        <dd>attacker ${m.atkWins} · defender ${m.defWins}</dd>`:''}
      <dt>Avg losses</dt>
      <dd><span class="f-usa">USA ${m.avgUsa}</span> · <span class="f-csa">CSA ${m.avgCsa}</span>
        <span style="color:var(--ink-3)">(${m.totalCas.toLocaleString()} total)</span></dd>
      ${m.hasForm?`<dt>Avg formation</dt>
        <dd><span class="f-usa">USA</span> ${m.fUsa[0]} IF · ${m.fUsa[1]} Sk · ${m.fUsa[2]} OoL<br>
            <span class="f-csa">CSA</span> ${m.fCsa[0]} IF · ${m.fCsa[1]} Sk · ${m.fCsa[2]} OoL</dd>`:''}
      ${m.morUsa?`<dt>Usual morale</dt>
        <dd><span class="f-usa">USA ${esc(m.morUsa)}</span> · <span class="f-csa">CSA ${esc(m.morCsa)}</span></dd>`:''}
    </dl></div>`;

  const areas = Object.entries(MS.areaMaps).map(([key,names])=>{
    const played = names.map(n=>S.byMap[n]).filter(Boolean).sort((a,b)=>b.plays-a.plays);
    if(!played.length) return '';
    const isOpen = open.has(key);
    const rounds = played.reduce((s,m)=>s+m.plays,0);
    const usa = played.reduce((s,m)=>s+m.usaWins,0);
    return `<div class="panel">
      <header class="ph area-h" data-area="${key}" role="button" tabindex="0" aria-expanded="${isOpen}">
        <span class="cap" style="width:11px">${isOpen?'▼':'▶'}</span>
        <h2>${esc(MS.areas[key])}</h2><i class="rule"></i>
        <span class="meta">${played.length} of ${names.length} maps drawn · ${rounds} rounds · USA ${pctOf(usa,rounds)}%</span></header>
      ${isOpen?`<div class="pb"><div class="mapgrid">${played.map(card).join('')}</div>
        ${played.length<names.length?`<div class="note" style="margin-top:11px">Never drawn: ${names.filter(n=>!S.byMap[n]).map(esc).join(' · ')}</div>`:''}
      </div>`:''}</div>`;
  }).join('');

  return `
  <div class="panel">
    <div class="ctl"><span class="cap">Source</span>
      <div class="seg" id="map-src">
        <button data-s="tracker" aria-pressed="${src==='tracker'}">Tracker (${MS.tracker.overall.totalRounds})</button>
        <button data-s="scoreboard" aria-pressed="${src==='scoreboard'}">Scoreboards (${MS.scoreboard.overall.totalRounds})</button></div>
      <i class="rule"></i>
      <span class="meta">${src==='tracker'?'rounds recorded on a night':'every imported scoreboard, bound or not'}</span></div>
  </div>
  ${panel('Overall', `${maps.length} maps drawn`, `<div class="kpis">${tiles}</div>`, true)}
  ${panel('Casualties and formation makeup', O.totalCas.toLocaleString()+' men lost',
    `<div class="cols">${casBlock('USA',O.usaCas,O.fUsa,'usa')}${casBlock('CSA',O.csaCas,O.fCsa,'csa')}${casBlock('Overall',O.totalCas,O.fTot,'')}</div>`, true)}
  <div class="panel"><header class="ph"><h2>Most played</h2><i class="rule"></i>
    <span class="meta">split bar is USA share of wins</span></header>
    <div class="pb flush scroll-x"><table>
      <thead><tr><th>Map</th><th>Area</th><th class="num">Rounds</th><th class="num">USA</th><th class="num">CSA</th>
        <th>Split</th><th class="num">Casualties</th></tr></thead>
      <tbody>${mostPlayed}</tbody></table></div></div>
  ${areas}`;
};

/* ══ Events — with a New event flow ═══════════════════════════════ */
V.events = () => {
  const C = D.config;
  const draft = state.newEvent;

  const evCard = e => {
    const isActive = e.id === state.event;
    return `<div class="col${isActive?' stripe-usa':''}">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="mid nm">${esc(e.name)}</span>
        ${isActive?'<span class="tag usa">Active</span>':`<button class="gh" data-ev="${e.id}">Switch to</button>`}</div>
      <div class="note" style="margin-top:5px">${e.registry} units in the event registry · ${e.seasons.length} season${e.seasons.length===1?'':'s'}</div>
      <div style="margin-top:10px">${e.seasons.map(s=>`<div class="bteam${isActive&&s.id===state.season?' win':''}" style="border:1px solid var(--line);margin-top:4px">
        <span class="nm">${esc(s.name)}</span>
        <span class="s">${s.units} units · ${s.weeks} nights${isActive&&s.id===state.season?' · editing':''}</span></div>`).join('')}</div>
      <div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">
        <button class="gh">Add season</button><button class="gh">Rename</button><button class="gh">Duplicate</button>
        <button class="gh" style="color:var(--live);border-color:var(--live)">Delete</button></div></div>`;
  };

  const draftCard = `<div class="col" style="border-left:3px solid var(--live)">
    <div style="display:flex;align-items:center;gap:8px"><span class="cap">New event</span>
      <i class="rule"></i><span class="tag q" style="border-color:var(--live);color:var(--live)">Draft</span></div>
    <div class="grid-f" style="margin-top:9px">
      ${field('Event name','Sunday Skirmish League — S4','shown everywhere the event is named')}
      ${field('First season name','Season 1','')}
      ${pick('Unit registry',['Start empty','Copy from Sunday Skirmish League','Copy from Sunday Night Fights'],'Copy from Sunday Skirmish League',
        'an event owns its registry; copying keeps the head counts')}
      ${pick('Settings',['Tracker defaults','Copy from Sunday Skirmish League'],'Copy from Sunday Skirmish League',
        'points, Elo and balancer weights')}
    </div>
    <div class="note" style="margin-top:9px">A new event starts its own Elo ladder at ${C.elo.initialElo} — ratings never cross events, because unit identity is per-event.</div>
    <div style="display:flex;gap:6px;margin-top:11px">
      <button class="gh" aria-pressed="true" id="ev-create">Create event</button>
      <button class="gh" id="ev-cancel">Cancel</button></div></div>`;

  const reg = C.registry.map(u=>`<tr>
    <td class="nm">${esc(u.name)}</td>
    <td>${u.token?'<span class="tag q">Token</span>':'<span class="tag q" style="opacity:.55;border-style:dashed">Non-token</span>'}</td>
    <td>${u.div?`<span class="tag q">${esc(u.div)}</span>`:'<span style="color:var(--ink-3)">—</span>'}</td>
    <td class="num">${u.min||'—'}</td><td class="num">${u.max||'—'}</td>
    <td class="num" style="color:var(--ink-2)">${u.min&&u.max?((u.min+u.max)/2).toFixed(1):'—'}</td>
    <td><button class="gh">Edit</button></td></tr>`).join('');

  return `
  <div class="panel"><header class="ph"><h2>Events</h2><i class="rule"></i>
      <span class="meta">an event owns the registry and the Elo ladder; seasons live inside it</span></header>
    <div class="ctl"><button class="gh" id="ev-add"${draft?' aria-pressed="true"':''}>＋ New event</button>
      <button class="gh">Import an event from JSON</button>
      <i class="rule"></i><span class="meta">${C.events.length} event${C.events.length===1?'':'s'}</span></div>
    <div class="pb flush"><div class="cols">${draft?draftCard:''}${C.events.map(evCard).join('')}</div></div></div>
  <div class="panel"><header class="ph"><h2>Unit registry</h2><i class="rule"></i>
    <span class="meta">event level · ${C.registry.length} units · ${C.nonToken.length} non-token</span></header>
    <div class="ctl"><input type="search" placeholder="find a unit" aria-label="Find unit">
      <button class="gh">Add unit</button><button class="gh">Import from season</button>
      <i class="rule"></i><span class="meta">head counts feed the balancer</span></div>
    <div class="pb flush scroll-x"><table>
      <thead><tr><th>Unit</th><th>Scoring</th><th>Division</th><th class="num">Min</th><th class="num">Max</th><th class="num">Avg</th><th></th></tr></thead>
      <tbody>${reg}</tbody>
      <tfoot><tr><td colspan="7">Non-token units field men and get balanced, but score no points and take no Elo.</td></tr></tfoot>
    </table></div></div>
  ${panel('Divisions','used for grouping, playoff qualification and the division-opposition balancer weight',
    `<div class="cols">${C.divisions.map(dv=>`<div class="col">
      <div style="display:flex;align-items:center;gap:8px"><span class="cap">${esc(dv.name)}</span>
        <i class="rule"></i><span class="meta">${dv.units.length} units</span></div>
      <div class="rl" style="margin-top:8px">${dv.units.map(u=>`<span class="tag q">${esc(u)}</span>`).join('')}</div>
      </div>`).join('')}</div>
     <div style="display:flex;gap:6px;padding:11px 13px;border-top:1px solid var(--line)">
       <button class="gh">Add division</button><button class="gh">Auto-split evenly</button></div>`, true)}`;
};

