/* ══ CHARTS ═══════════════════════════════════════════════════════
   Every chart here does one job. Magnitude and change-over-time use a
   single hue; the faction pair is the only categorical scale on the page
   and is validated for colour-vision separation. Nothing is rainbow. */

/** Sparkline: one series, so no legend — the row label names it. Endpoint
 *  emphasised because "where it ended" is the value being read. */
function spark(vals, w=104, h=22){
  if(!vals || vals.length<2) return '';
  const lo=Math.min(...vals), hi=Math.max(...vals), span=(hi-lo)||1;
  const x=i=>i/(vals.length-1)*(w-3)+1.5;
  const y=v=>h-2 - (v-lo)/span*(h-5);
  const d=vals.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <path d="${d}" fill="none" stroke="var(--ink-3)" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="${x(vals.length-1).toFixed(1)}" cy="${y(vals[vals.length-1]).toFixed(1)}" r="2.4" fill="var(--ink)"/>
  </svg>`;
}

/** Signed bar around a centre rule. Polarity by direction, not by a second
 *  hue — the faction hues are spoken for. */
function signed(v, max, w=76){
  const mag=Math.min(Math.abs(v)/(max||1),1)*(w/2);
  return `<span class="sgn" style="width:${w}px">
    <i class="ax"></i>
    ${v===0?'':`<i class="bar" style="${v<0?`right:50%;`:`left:50%;`}width:${mag.toFixed(1)}px"></i>`}</span>`;
}

/* ── Elo ────────────────────────────────────────────────────────── */
V.elo = () => {
  const L = D.elo.ladder, E = D.elo.settings;
  const maxGap = Math.max(...L.map(r=>Math.abs(r.gap)))||1;
  const lo = Math.min(...L.map(r=>r.elo)), hi = Math.max(...L.map(r=>r.elo));
  const over = L.slice().sort((a,b)=>b.gap-a.gap)[0];
  const under = L.slice().sort((a,b)=>a.gap-b.gap)[0];

  const rows = L.map(r=>`<tr class="click" data-go="unit" data-id="${esc(r.unit)}">
    <td><span class="pos ${r.pos<=3?'q':''}">${r.pos}</span></td>
    <td class="nm">${esc(r.unit)}${r.prov?' <span class="tag q" style="opacity:.6">prov</span>':''}</td>
    <td><span class="tag q">${esc(r.div)}</span></td>
    <td class="num" style="font-weight:600">${r.elo}</td>
    <td class="num" style="color:${r.delta>0?'var(--ink)':'var(--ink-3)'}">${r.delta>0?'+':''}${r.delta}</td>
    <td>${spark(r.spark)}</td>
    <td class="num" style="color:var(--ink-2)">${r.rounds}</td>
    <td class="num" style="color:var(--ink-2)">${r.ptsRank}</td>
    <td class="num">${signed(r.gap,maxGap)}<span style="margin-left:7px">${r.gap>0?'+':''}${r.gap}</span></td></tr>`).join('');

  return `
  ${panel('Ladder', `after ${D.elo.series.length} nights · start ${E.initialElo}`,
    `<div class="kpis">
      ${[['Top rating',hi,esc(L[0].unit)],['Spread',hi-lo,'top to bottom'],
         ['K factor',E.kFactorStandard,`${E.kFactorProvisional} for the first ${E.provisionalRounds} rounds`],
         ['Lead weight',E.leadMultiplier+'×','a lead carries this much of the result']]
        .map(([h,v,x])=>`<div class="kpi"><div class="cap">${h}</div><div class="v">${v}</div><div class="h">${x}</div></div>`).join('')}
    </div>`, true)}

  <div class="panel"><header class="ph"><h2>Ratings</h2><i class="rule"></i>
    <span class="meta">trend = every night this season · gap = points rank − Elo rank</span></header>
    <div class="pb flush scroll-x"><table>
      <thead><tr><th></th><th>Unit</th><th>Div</th><th class="num">Elo</th><th class="num">Last night</th>
        <th>Trend</th><th class="num">Rounds</th><th class="num">Pts rank</th><th class="num">Gap</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="9">Elo never touches the standings — it exists so the balancer can weigh sides. A positive gap means the ladder rates a unit higher than its points do.</td></tr></tfoot>
    </table></div></div>

  ${panel('Where the ladder and the table disagree','',
    `<div class="cols" style="margin:-13px">
      <div class="col"><div class="cap">Rated above its record</div>
        <div class="mid nm" style="margin-top:5px">${esc(over.unit)}</div>
        <div class="note" style="margin-top:4px"><b>${over.elo}</b> Elo — <b>${ord(over.pos)}</b> on the ladder, <b>${ord(over.ptsRank)}</b> on points.
          It loses close rounds to strong sides and beats weak ones, which points do not reward but Elo does.</div></div>
      <div class="col"><div class="cap">Rated below its record</div>
        <div class="mid nm" style="margin-top:5px">${esc(under.unit)}</div>
        <div class="note" style="margin-top:4px"><b>${under.elo}</b> Elo — <b>${ord(under.pos)}</b> on the ladder, <b>${ord(under.ptsRank)}</b> on points.
          Assist points accrue whoever you beat; the ladder discounts wins over weak sides.</div></div>
    </div>`, true)}`;
};

/* ── Heatmaps ───────────────────────────────────────────────────── */
V.heat = () => {
  const H = D.heat, mode = state.heatMode || 'mate';
  const grid = mode==='mate' ? H.mate : H.foe;
  const max = mode==='mate' ? H.mateMax : H.foeMax;
  const avg = mode==='mate' ? H.mateAvg : H.foeAvg;
  // Sequential: one hue, light to dark. Teammate reads in ink, opponent in the
  // accent — two separate single-hue scales, never a rainbow, never faction hues.
  const hue = mode==='mate' ? 'var(--ink)' : 'var(--live)';
  const U = H.units;

  const cells = U.map((a,i)=>`<tr>
    <th scope="row" class="hm-row">${esc(a)}</th>
    ${U.map((b,j)=>{
      const v = grid[i][j];
      if(v==null) return `<td class="hm-c hm-x" aria-hidden="true"></td>`;
      const t = v/max;
      return `<td class="hm-c" style="--v:${t.toFixed(3)};--hue:${hue}"
        tabindex="0" data-tip="${esc(a)} + ${esc(b)} — ${v} round${v===1?'':'s'} ${mode==='mate'?'together':'against each other'}"
        aria-label="${esc(a)} and ${esc(b)}, ${v} rounds">${v>=max*0.75?v:''}</td>`;
    }).join('')}</tr>`).join('');

  const scale = [0,.25,.5,.75,1].map(t=>`<i style="--v:${t};--hue:${hue}"></i>`).join('');

  const pairsTable = H.top.map((p,i)=>`<tr>
    <td><span class="pos ${i===0?'q':''}">${i+1}</span></td>
    <td class="nm">${esc(p.a)} + ${esc(p.b)}</td>
    <td class="num" style="font-weight:600">${p.n}</td>
    <td class="num" style="color:var(--ink-2)">${Math.round(p.n/H.rounds[p.a]*100)}% of ${esc(p.a)}'s rounds</td></tr>`).join('');

  return `
  <div class="panel">
    <div class="ctl"><span class="cap">Matrix</span>
      <div class="seg" id="heat-mode">
        <button data-m="mate" aria-pressed="${mode==='mate'}">Same side</button>
        <button data-m="foe" aria-pressed="${mode==='foe'}">Opposite sides</button></div>
      <i class="rule"></i>
      <span class="meta">${U.length} token units · ${mode==='mate'?'rounds spent together':'rounds spent against each other'}</span></div>
  </div>

  <div class="panel"><header class="ph">
      <h2>${mode==='mate'?'Teammate composition':'Opponent exposure'}</h2><i class="rule"></i>
      <span class="meta">average ${avg} · highest ${max}</span></header>
    <div class="pb scroll-x">
      <div class="hm-legend"><span class="cap">0</span>${scale}<span class="cap">${max} rounds</span>
        <span class="note" style="margin-left:auto">darker = more often</span></div>
      <table class="hm"><thead><tr><th class="hm-corner"></th>
        ${U.map(u=>`<th class="hm-col"><span>${esc(u)}</span></th>`).join('')}</tr></thead>
        <tbody>${cells}</tbody></table>
    </div>
    <div class="note" style="padding:0 13px 13px">Counted per round, not per night, so a unit swapped across at half time is counted on both sides.
      ${mode==='mate'?'The balancer\'s teammate-history weight reads exactly this matrix.':'A blank cell would mean two units never met — there are none this season.'}</div>
  </div>

  ${panel('Most frequent pairings','the table view of the matrix above',
    `<div class="scroll-x"><table>
      <thead><tr><th></th><th>Pair</th><th class="num">Rounds together</th><th class="num">Share</th></tr></thead>
      <tbody>${pairsTable}</tbody></table></div>
     <div class="note" style="margin-top:9px">${H.never.length
       ? `${H.never.length} pair(s) never shared a side: ${H.never.map(p=>esc(p.a)+' + '+esc(p.b)).join(', ')}.`
       : 'Every pair of units has shared a side at least once.'}</div>`)}`;
};

/* ── Standalone company splitter ────────────────────────────────── */
V.splitter = () => {
  const rows = D.config.registry.filter(u=>u.max>0).slice(0,8);
  const paste = rows.map(u=>`${u.name}\t${u.min}\t${u.max}`).join('\n');
  const total = rows.reduce((s,u)=>s+(u.min+u.max)/2,0);
  const n = 3, target = total/n;
  // Greedy largest-first packing — the same shape the real splitter uses.
  const cos = Array.from({length:n},()=>[]);
  rows.slice().sort((a,b)=>((b.min+b.max)/2)-((a.min+a.max)/2)).forEach(u=>{
    const sum = c => c.reduce((s,x)=>s+(x.min+x.max)/2,0);
    cos.sort((a,b)=>sum(a)-sum(b));
    cos[0].push(u);
  });
  const sizeOf = c => c.reduce((s,x)=>s+(x.min+x.max)/2,0);
  const sizes = cos.map(sizeOf);

  return `
  ${panel('Roster','paste from the sheet — name, min, max, tab separated',
    `<div class="cols" style="margin:-13px">
      <div class="col"><textarea rows="10" spellcheck="false">${esc(paste)}</textarea>
        <div class="note" style="margin-top:7px">${rows.length} units · ~${total.toFixed(0)} men. No week or season involved — this runs the same packing the per-night company balancer uses.</div></div>
      <div class="col">
        <div class="grid-f">${field('Companies',n)}${field('Target size',Math.round(target))}</div>
        <div style="margin-top:11px">${check('Keep a unit whole',true,'never split one unit across companies')}</div>
        <div style="margin-top:7px">${check('Balance by average, not maximum',true,'uses (min+max)÷2')}</div>
        <div style="display:flex;gap:6px;margin-top:11px;flex-wrap:wrap">
          <button class="gh" aria-pressed="true">Split</button><button class="gh">Copy result</button>
          <button class="gh">Clear</button></div></div>
    </div>`, true)}
  ${panel('Split', `${n} companies · spread ${(Math.max(...sizes)-Math.min(...sizes)).toFixed(0)} men`,
    `<div class="cols">${cos.map((c,i)=>`<div class="col">
      <div style="display:flex;align-items:center;gap:8px"><span class="cap">Company ${i+1}</span>
        <i class="rule"></i><span class="meta">~${sizeOf(c).toFixed(0)} men</span></div>
      <div class="hb" style="margin-top:8px"><span class="note">vs target</span>
        <span class="t"><i style="width:${Math.min(sizeOf(c)/Math.max(...sizes)*100,100)}%"></i></span>
        <span class="n">${sizeOf(c)>target?'+':''}${(sizeOf(c)-target).toFixed(0)}</span></div>
      <div style="margin-top:9px">${c.map(u=>`<div class="bteam" style="border:1px solid var(--line);margin-top:4px">
        <span class="nm">${esc(u.name)}</span><span class="s">${u.min}–${u.max}</span></div>`).join('')}</div>
    </div>`).join('')}</div>`, true)}`;
};

/* ── Round detail — matchup / units / killfeed ──────────────────── */
const ROUND_TABS = [['matchup','Matchup'],['units','Units'],['feed','Killfeed']];
const baseRound = V.round;

V.round = () => {
  const m = D.matchups[state.round];
  const tab = state.roundTab || 'matchup';
  const sel = D.matchups.map((x,i)=>`<option value="${i}"${i===state.round?' selected':''}>${esc(x.week)} · R${x.rd} · ${esc(x.map)}</option>`).join('');
  const head = `<div class="panel"><div class="ctl">
      <span class="cap">Round</span><select id="rd-pick2">${sel}</select>
      <div class="seg" id="rd-tab">${ROUND_TABS.map(([k,l])=>
        `<button data-t="${k}" aria-pressed="${tab===k}">${l}</button>`).join('')}</div>
      <i class="rule"></i>
      <span class="meta cap">${esc(m.map)} · ${dur(m.dur)}</span></div></div>`;

  if(tab==='matchup') return head + baseRound();

  if(tab==='units'){
    const cols = ['USA','CSA'].map(f=>{
      const rows = m.units[f].map(u=>{
        const kr=u.n?u.k/u.n:0, lr=u.n?u.d/u.n:0;
        const td=u.d?u.tdr/u.d:null, tk=u.k?u.tdi/u.k:null;
        return `<tr class="click" data-go="unit" data-id="${esc(u.unit)}">
          <td class="nm">${esc(u.unit)}</td>
          <td class="num">${u.n}</td>
          <td class="num">${u.k}</td><td class="num">${u.d}</td>
          <td class="num">${n2(u.kd)}</td>
          <td class="num" style="color:var(--ink-2)">${n2(kr)}</td>
          <td class="num" style="color:var(--ink-2)">${n2(lr)}</td>
          <td class="num" style="color:var(--ink-2)">${td==null?'—':n1(td)}</td>
          <td class="num" style="color:var(--ink-2)">${tk==null?'—':n1(tk)}</td>
          <td class="num">${u.tdiPct}%</td><td class="num">${u.tdrPct}%</td></tr>`;
      }).join('');
      const tot = m.units[f].reduce((a,u)=>({k:a.k+u.k,d:a.d+u.d,n:a.n+u.n}),{k:0,d:0,n:0});
      return `<div class="panel"><header class="ph">
        <span class="tag ${f.toLowerCase()}">${f}</span><h2>casualties by unit</h2><i class="rule"></i>
        <span class="meta">${tot.n} men · ${tot.k} kills · ${tot.d} lost</span></header>
        <div class="pb flush scroll-x"><table>
          <thead><tr><th>Unit</th><th class="num">Men</th><th class="num">Kills</th><th class="num">Lost</th>
            <th class="num">K/D</th><th class="num">Kills / man</th><th class="num">Losses / man</th>
            <th class="num">Cost / death</th><th class="num">Value / kill</th>
            <th class="num">Dmg dealt</th><th class="num">Dmg taken</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="11">Dealt and taken are this unit's share of its own side's stance-weighted ticket damage — each column sums to 100% down the side.</td></tr></tfoot>
        </table></div></div>`;
    }).join('');
    const st = f => {
      const c = m.cas[f], t = c.total||1;
      return `<div class="col"><div style="display:flex;align-items:center;gap:8px">
        <span class="tag ${f.toLowerCase()}">${f}</span><span class="cap">${c.total} casualties</span></div>
        <div class="stack" style="margin-top:9px">
          <i style="width:${c.inForm/t*100}%;background:var(--st1)"></i>
          <i style="width:${c.skirm/t*100}%;background:var(--st2)"></i>
          <i style="width:${c.oob/t*100}%;background:var(--st3)"></i></div>
        <div class="leg">
          <span><i style="background:var(--st1)"></i>In formation · 1 tkt · ${c.inForm} · ${pc(c.inForm,t)}%</span>
          <span><i style="background:var(--st2)"></i>Skirmish · 3 · ${c.skirm} · ${pc(c.skirm,t)}%</span>
          <span><i style="background:var(--st3)"></i>Out of line · 5 · ${c.oob} · ${pc(c.oob,t)}%</span></div></div>`;
    };
    return head + panel('Casualties by stance','what each side\'s losses cost in tickets',
      `<div class="cols">${st('USA')}${st('CSA')}</div>`, true) + cols;
  }

  // killfeed
  const feed = m.feed || [];
  return head + `<div class="panel"><header class="ph"><h2>Killfeed</h2><i class="rule"></i>
    <span class="meta">${feed.length} events · time from round start</span></header>
    <div class="ctl"><input type="search" placeholder="player, unit or weapon" aria-label="Filter killfeed">
      <div class="seg"><button aria-pressed="true">All</button><button aria-pressed="false">USA kills</button>
        <button aria-pressed="false">CSA kills</button></div>
      <i class="rule"></i><span class="meta">click a name for the player card</span></div>
    <div class="pb flush scroll-x"><table>
      <thead><tr><th class="num">Time</th><th>Killer</th><th>Unit</th><th>Weapon</th>
        <th>Victim</th><th>Unit</th><th>Caught</th><th class="num">Tickets</th></tr></thead>
      <tbody>${feed.map(e=>{
        const w = e.form==='in formation'?1:e.form==='skirmish'?3:5;
        return `<tr>
          <td class="num" style="color:var(--ink-3)">${esc(e.t)}</td>
          <td class="nm"><span class="tag ${e.kt.toLowerCase()}" style="margin-right:6px">${e.kt}</span>${esc(bare(e.k))}</td>
          <td><span class="tag q">${esc(e.ku)}</span></td>
          <td>${esc(e.cause)}</td>
          <td class="nm">${esc(bare(e.v))}</td>
          <td><span class="tag q">${esc(e.vu)}</span></td>
          <td><span style="color:var(--st${w===1?1:w===3?2:3})">${esc(e.form)}</span></td>
          <td class="num" style="font-weight:${w===5?600:400}">${w}</td></tr>`;
      }).join('')}</tbody></table></div></div>`;
};

/* ── Maps + bias editor ─────────────────────────────────────────── */
const baseMaps = V.maps;
V.maps = () => baseMaps() + panel('Map bias','how much each map favours the attacker, used by the Elo expectation',
  `<div class="scroll-x"><table>
    <thead><tr><th>Map</th><th class="num">Bias</th><th>Favours</th><th class="num">Adjust</th></tr></thead>
    <tbody>${D.config.mapBiases.map(([m,v])=>`<tr>
      <td class="nm">${esc(m)}</td>
      <td class="num" style="font-weight:600">${v}</td>
      <td>${signed(v-1.5, 1.5)}<span style="margin-left:8px;color:var(--ink-2)">${v>1.5?'attacker':v<1.5?'defender':'even'}</span></td>
      <td class="num"><input value="${v}" style="width:64px;text-align:right"></td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td colspan="4">Showing the ${D.config.mapBiases.length} most biased of ${Object.keys(D.maps).length ? '51' : '51'} rated maps. 1.5 is even; higher favours the attacking side.</td></tr></tfoot>
  </table></div>
  <div class="note" style="margin-top:9px">Bias feeds the expected result, so a defender win on a heavily attacker-favoured map moves Elo further.</div>`);

/* ── Playoffs + format planner ──────────────────────────────────── */
const basePlayoffs = V.playoffs;
V.playoffs = () => {
  const n = D.standings.length;
  // A round hosts one matchup (one lead a side); a night is two rounds.
  const opts = [
    {field:4, series:3, style:'Seeded knockout', entry:'Top 2 per division', bo:'Best of 3 throughout'},
    {field:4, series:3, style:'Conference',      entry:'Top 2 per division', bo:'Single round until the final'},
    {field:8, series:7, style:'Seeded knockout', entry:'Top 4 per division', bo:'Single-round quarters, best of 3 after'},
  ].map(o=>{
    const nightsBo3 = Math.ceil(o.series*2.4/2), nightsSingle = Math.ceil(o.series/2);
    const nights = o.bo.startsWith('Single round until') ? Math.ceil((o.series-1)/2)+2
                 : o.bo.startsWith('Single-round') ? Math.ceil(o.series/2)+2 : nightsBo3;
    return {...o, nights, share:Math.round(o.field/n*100)};
  });

  return basePlayoffs() + panel('Format planner', `${D.bracket.length} playoff nights on the calendar`,
    `<div class="cols" style="margin:-13px">
      ${opts.map((o,i)=>`<div class="col${o.nights<=D.bracket.length?' stripe-usa':''}">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="cap">Option ${i+1}</span><i class="rule"></i>
          ${o.nights<=D.bracket.length?'<span class="tag usa">Fits</span>'
            :`<span class="tag q" style="border-color:var(--live);color:var(--live)">${o.nights-D.bracket.length} night over</span>`}</div>
        <div class="mid nm" style="margin-top:6px">${o.field}-team ${o.style.toLowerCase()}</div>
        <div class="note" style="margin-top:5px">${esc(o.entry)} · ${esc(o.bo)}</div>
        <div class="hb" style="margin-top:9px"><span class="note">nights</span>
          <span class="t"><i style="width:${Math.min(o.nights/6*100,100)}%"></i></span>
          <span class="n">${o.nights}</span></div>
        <div class="note" style="margin-top:6px"><b>${o.series}</b> series · <b>${o.share}%</b> of the league qualifies</div>
        <div style="margin-top:9px"><button class="gh"${i===0?' aria-pressed="true"':''}>Apply</button></div></div>`).join('')}
    </div>`, true)
  + panel('Why these lengths','',
    `<div class="prose">
      <p><b>A round hosts one matchup</b>, because each side has one lead — so a night fits two. That, not the
      number of stages, is what sets the length. An ${n>=8?8:4}-team bracket is ${opts[2].series} series; a 4-team one is 3.</p>
      <p><b>"Rounds per stage" is really first to (N ÷ 2) + 1 wins.</b> 2 and 3 are the same series: both need two
      wins and both can run to a third round. The planner prefers the odd setting, which says what it means.</p>
      <p class="note">Only brackets the tracker draws whole are offered. A field that half-draws — where the standings
      promise a seed the bracket never plays — is never recommended, though the audit will explain one you configure by hand.</p>
    </div>`);
};

