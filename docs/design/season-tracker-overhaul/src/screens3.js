/* ══ Balancer — full controls ═════════════════════════════════════ */
const avgOf = u => (u.min + u.max) / 2;

V.balancer = () => {
  const B = D.config.balancer, w = D.weeks[state.week];
  const REG = Object.fromEntries(D.config.registry.map(u=>[u.name,u]));
  const heads = Object.fromEntries(D.config.registry.map(u=>[u.name, avgOf(u)]));
  const roster = [...w.a, ...w.b];
  // Units held out of this night's pool — a unit sitting out is excluded, not
  // balanced around.
  const out = new Set(state.poolOut || []);
  const pool = roster.filter(u=>!out.has(u));
  // Forced opposite-side pairs: the balancer seeds one on each side, then packs
  // the rest around them.
  const pairs = state.pairs || [['CB','JD']];
  const forcedA = new Set(pairs.map(p=>p[0]).filter(Boolean));
  const forcedB = new Set(pairs.map(p=>p[1]).filter(Boolean));
  const maxDiff = state.maxDiff ?? 10;

  const opts = [0,1,2].slice(0, B.balanceOptionCount).map(i=>{
    const A=[...forcedA].filter(u=>pool.includes(u));
    const Bs=[...forcedB].filter(u=>pool.includes(u));
    pool.filter(u=>!forcedA.has(u) && !forcedB.has(u))
      .slice().sort((x,y)=>((x.charCodeAt(0)*7+i*13)%11)-((y.charCodeAt(0)*7+i*13)%11))
      .forEach((u,j)=>((j+i)%2?Bs:A).push(u));
    const sa=A.reduce((s,u)=>s+(heads[u]||0),0), sb=Bs.reduce((s,u)=>s+(heads[u]||0),0);
    const diff=Math.abs(sa-sb);
    return {A,B:Bs,sa,sb,diff, rep:[3,5,2][i], ok:diff<=maxDiff, score:97-i*6};
  }).sort((a,b)=>b.score-a.score);

  const card = (o,i)=>`<div class="col${i===0?' stripe-usa':''}">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span class="cap">Option ${i+1}</span><i class="rule"></i>
      ${i===0?'<span class="tag usa">Best</span>':''}
      ${o.ok?'':`<span class="tag q" style="border-color:var(--live);color:var(--live)">over max diff</span>`}
      <span class="meta">score ${o.score}</span></div>
    <div class="hb" style="margin-top:9px"><span>Team A</span>
      <span class="t"><i style="width:${o.sa/Math.max(o.sa,o.sb)*100}%;background:var(--union)"></i></span>
      <span class="n">~${o.sa.toFixed(0)}</span></div>
    <div class="hb"><span>Team B</span>
      <span class="t"><i style="width:${o.sb/Math.max(o.sa,o.sb)*100}%;background:var(--reb)"></i></span>
      <span class="n">~${o.sb.toFixed(0)}</span></div>
    <div class="note" style="margin-top:8px">${o.diff.toFixed(0)}-man gap (max ${maxDiff}) · ${o.A.length}v${o.B.length} units · ${o.rep} repeat pairings</div>
    <div class="rl" style="margin-top:8px">${o.A.map(u=>`<span class="tag q"${forcedA.has(u)?' style="border-color:var(--ink);color:var(--ink)"':''}>${esc(u)}${forcedA.has(u)?' ⚑':''}</span>`).join('')}</div>
    <div class="rl" style="margin-top:4px;opacity:.75">${o.B.map(u=>`<span class="tag q"${forcedB.has(u)?' style="border-color:var(--ink);color:var(--ink);opacity:1"':''}>${esc(u)}${forcedB.has(u)?' ⚑':''}</span>`).join('')}</div>
    <div style="margin-top:9px"><button class="gh"${i===0?' aria-pressed="true"':''}>Apply to ${esc(w.name)}</button></div></div>`;

  const poolChips = roster.map(u=>`<button class="tg${out.has(u)?'':' on'}" data-pool="${esc(u)}"
      aria-pressed="${!out.has(u)}">${esc(u)}<span class="n">~${(heads[u]||0).toFixed(0)}</span></button>`).join('');

  const pairRows = pairs.map((p,i)=>`<div class="pair-row">
    <select>${roster.map(u=>`<option${u===p[0]?' selected':''}>${esc(u)}</option>`).join('')}</select>
    <span class="cap">opposite</span>
    <select>${roster.map(u=>`<option${u===p[1]?' selected':''}>${esc(u)}</option>`).join('')}</select>
    <button class="gh" data-pair-del="${i}">Remove</button></div>`).join('');

  const counts = roster.map(u=>{
    const e = REG[u] || {min:0,max:0};
    return `<tr><td class="nm">${esc(u)}</td>
      <td class="num"><input value="${e.min}" style="width:56px;text-align:right"></td>
      <td class="num"><input value="${e.max}" style="width:56px;text-align:right"></td>
      <td class="num" style="color:var(--ink-2)">${avgOf(e).toFixed(1)}</td>
      <td>${e.max?'':'<span class="tag q" style="border-color:var(--live);color:var(--live)">not set</span>'}</td></tr>`;
  }).join('');
  const missing = roster.filter(u=>!(REG[u]||{}).max).length;

  return `
  <div class="panel">
    <div class="ctl"><span class="cap">Balancing</span><span class="nm">${esc(w.name)}</span>
      <button class="gh" data-go="night" data-id="${state.week}">Back to the night</button>
      <i class="rule"></i>
      <span class="meta">${pool.length} of ${roster.length} units in · ~${pool.reduce((s,u)=>s+(heads[u]||0),0).toFixed(0)} men</span></div>
  </div>

  ${panel('Available units','click to sit a unit out — held-out units are excluded, not balanced around',
    `<div class="tgs">${poolChips}</div>
     <div class="note" style="margin-top:9px">${out.size?`${out.size} sitting out: ${[...out].map(esc).join(', ')}`:'Every unit on the night is in the pool.'}</div>`)}

  ${panel('Forced opposing pairs','seeded on opposite sides before anything else is packed',
    `${pairRows || '<div class="note">No forced pairs — the balancer is free to place every unit.</div>'}
     <div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">
       <button class="gh" id="pair-add">Add a pair</button>
       <i class="rule"></i>
       <span class="meta">⚑ marks a forced unit in the options below</span></div>`)}

  ${panel('Options', `showing ${Math.min(B.balanceOptionCount,3)} · max ${maxDiff}-man difference`,
    `<div class="cols">${opts.map(card).join('')}</div>`, true)}

  ${panel('Run settings','apply to this run only',
    `<div class="grid-f">
      ${field('Max player difference', maxDiff, 'options over this are flagged, not hidden')}
      ${field('Balance options to show', B.balanceOptionCount)}
    </div>`)}

  ${panel('Weights','what the score is made of — stored per season',
    `<div class="grid-f">
      ${field('Teammate history', B.teammateWeight, 'penalises units that keep landing together')}
      ${field('Average difference', B.avgDiffWeight, 'head-count gap between the sides')}
      ${field('Unit count', B.regimentCountWeight, 'keeps the number of units even')}
      ${field('Range similarity', B.rangeSimilarityWeight, 'matches min-max spread, not just the average')}
      ${field('Division opposition', B.divisionOppositionWeight, '0 = ignore divisions when splitting')}
      ${field('Post-season skill', B.postSeasonSkillWeight, 'spreads playoff pedigree; 0 off outside playoffs')}
    </div>
    <div style="display:flex;gap:6px;margin-top:11px"><button class="gh">Reset to defaults</button></div>`)}

  <div class="panel"><header class="ph"><h2>Unit player counts</h2><i class="rule"></i>
    <span class="meta">${missing?`${missing} unit(s) have no count — they balance as 0`:'every unit has a count'}</span></header>
    <div class="ctl"><button class="gh">Paste from coord sheet</button><button class="gh">Pull last night's counts</button>
      <i class="rule"></i><span class="meta">min and max men expected, per unit</span></div>
    <div class="pb flush scroll-x"><table>
      <thead><tr><th>Unit</th><th class="num">Min</th><th class="num">Max</th><th class="num">Avg</th><th></th></tr></thead>
      <tbody>${counts}</tbody></table></div></div>

  ${panel('Company balancer','split a side into companies — same packing as the standalone splitter',
    `<div style="display:flex;gap:7px;flex-wrap:wrap">
      <button class="gh" data-go="splitter" data-id="x">Open the company splitter</button>
      <i class="rule"></i><span class="meta">company kinds and caps live there</span></div>`)}`;
};

/* ══ Company splitter — typed companies with caps ═════════════════ */
V.splitter = () => {
  const cfg = state.split || {regular:2, special:1, specialCap:20, cavalry:1, cavalryCap:30};
  const rows = D.config.registry.filter(u=>u.max>0);
  const paste = rows.map(u=>`${u.name}\t${u.min}\t${u.max}`).join('\n');
  const total = rows.reduce((s,u)=>s+avgOf(u),0);

  // Build the company slots in cap order — capped kinds fill first, so a 20-man
  // special never soaks up a 45-man regiment.
  const slots = [
    ...Array.from({length:cfg.special}, (_,i)=>({kind:'Special', cap:cfg.specialCap, n:i+1, units:[]})),
    ...Array.from({length:cfg.cavalry}, (_,i)=>({kind:'Cavalry', cap:cfg.cavalryCap, n:i+1, units:[]})),
    ...Array.from({length:cfg.regular}, (_,i)=>({kind:'Company', cap:null, n:i+1, units:[]})),
  ];
  const size = s => s.units.reduce((a,u)=>a+avgOf(u),0);
  const capped = slots.filter(s=>s.cap!=null), free = slots.filter(s=>s.cap==null);
  const left = [];
  // Largest first: a capped company takes the biggest unit that still fits.
  rows.slice().sort((a,b)=>avgOf(b)-avgOf(a)).forEach(u=>{
    const fit = capped.filter(s=>size(s)+avgOf(u)<=s.cap).sort((a,b)=>size(a)-size(b))[0];
    if(fit) fit.units.push(u); else left.push(u);
  });
  left.forEach(u=>{
    const t = (free.length?free:capped).slice().sort((a,b)=>size(a)-size(b))[0];
    if(t) t.units.push(u);
  });
  const over = slots.filter(s=>s.cap!=null && size(s)>s.cap);
  const freeSizes = free.map(size);
  const spread = freeSizes.length ? Math.max(...freeSizes)-Math.min(...freeSizes) : 0;

  const kindTag = k => k==='Special' ? '<span class="tag q" style="border-color:var(--st2);color:var(--st2)">Special</span>'
                     : k==='Cavalry' ? '<span class="tag q" style="border-color:var(--st1);color:var(--st1)">Cavalry</span>'
                     : '<span class="tag q">Line</span>';

  const cards = slots.map(s=>{
    const sz = size(s), pctFull = s.cap ? Math.min(sz/s.cap*100,100) : (sz/Math.max(...freeSizes,1))*100;
    return `<div class="col${s.cap!=null && sz>s.cap?' stripe-csa':''}">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${kindTag(s.kind)}<span class="cap">${s.kind==='Company'?'Line':s.kind} ${s.n}</span>
        <i class="rule"></i>
        <span class="meta">${sz.toFixed(0)}${s.cap?` / ${s.cap}`:''} men</span></div>
      <div class="hb" style="margin-top:8px"><span class="note">${s.cap?'of cap':'relative'}</span>
        <span class="t"><i style="width:${pctFull}%;background:${s.cap!=null&&sz>s.cap?'var(--live)':'var(--ink-3)'}"></i></span>
        <span class="n">${s.cap?`${Math.round(sz/s.cap*100)}%`:sz.toFixed(0)}</span></div>
      <div style="margin-top:9px">${s.units.length?s.units.map(u=>`<div class="bteam" style="border:1px solid var(--line);margin-top:4px">
        <span class="nm">${esc(u.name)}</span><span class="s">${u.min}–${u.max}</span></div>`).join('')
        :'<div class="note">empty — nothing fit under the cap</div>'}</div></div>`;
  }).join('');

  return `
  ${panel('Roster','paste from the sheet — name, min, max, tab separated',
    `<div class="cols" style="margin:-13px">
      <div class="col"><textarea rows="10" spellcheck="false">${esc(paste)}</textarea>
        <div class="note" style="margin-top:7px">${rows.length} units · ~${total.toFixed(0)} men. No week or season involved — this runs the same packing the per-night company balancer uses.</div></div>
      <div class="col">
        <div class="cap">Company types</div>
        <div class="grid-f" style="margin-top:8px">
          ${field('Line companies', cfg.regular, 'no size limit', 'sp-regular')}
          <div class="fld"><label class="cap">Line cap</label>
            <input value="none" disabled><div class="note">line companies take the remainder</div></div>
          ${field('Special companies', cfg.special, '', 'sp-special')}
          ${field('Special cap', cfg.specialCap, 'men per special company', 'sp-speccap')}
          ${field('Cavalry companies', cfg.cavalry, '', 'sp-cavalry')}
          ${field('Cavalry cap', cfg.cavalryCap, 'men per cavalry company', 'sp-cavcap')}
        </div>
        <div class="note" style="margin-top:9px">${slots.length} companies: ${cfg.regular} line, ${cfg.special} special @${cfg.specialCap}, ${cfg.cavalry} cavalry @${cfg.cavalryCap}.
          Capped companies are packed first, so a ${cfg.specialCap}-man special never swallows a ${Math.max(...rows.map(u=>Math.round(avgOf(u))))}-man regiment.</div>
        <div style="margin-top:11px">${check('Keep a unit whole', true, 'never split one unit across companies')}</div>
        <div style="margin-top:7px">${check('Balance by average, not maximum', true, 'uses (min+max) ÷ 2')}</div>
        <div style="display:flex;gap:6px;margin-top:11px;flex-wrap:wrap">
          <button class="gh" aria-pressed="true">Split</button><button class="gh">Copy result</button>
          <button class="gh" id="sp-reset">Reset</button></div></div>
    </div>`, true)}
  ${panel('Split', `${slots.length} companies · line spread ${spread.toFixed(0)} men${over.length?` · ${over.length} over cap`:''}`,
    `<div class="cols">${cards}</div>`, true)}
  ${over.length ? panel('Over cap','',
    `<div class="note">${over.map(s=>`${esc(s.kind)} ${s.n} holds ${size(s).toFixed(0)} against a ${s.cap} cap`).join(' · ')}.
      Nothing else fit under the limit, so the overflow landed here rather than being dropped. Add a line company, or raise the cap.</div>`)
   : ''}`;
};

