/* ── shared form primitives ─────────────────────────────────────── */
const field = (label,val,note,id) => `<div class="fld">
  <label class="cap">${esc(label)}</label>
  <input ${id?`id="${id}" `:''}value="${esc(val)}">
  ${note?`<div class="note">${esc(note)}</div>`:''}</div>`;
const pick = (label,opts,sel,note,id) => `<div class="fld">
  <label class="cap">${esc(label)}</label>
  <select${id?` id="${id}"`:''}>${opts.map(o=>`<option${o===sel?' selected':''}>${esc(o)}</option>`).join('')}</select>
  ${note?`<div class="note">${esc(note)}</div>`:''}</div>`;
const check = (label,on,note) => `<label class="chk"><input type="checkbox"${on?' checked':''}>
  <span><span class="l">${esc(label)}</span>${note?`<span class="note">${esc(note)}</span>`:''}</span></label>`;

/* ── Events & seasons ───────────────────────────────────────────── */
V.events = () => {
  const C = D.config;
  const evs = C.events.map(e=>`<div class="col${e.active?' stripe-usa':''}">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span class="mid nm">${esc(e.name)}</span>
      ${e.active?'<span class="tag usa">Active</span>':'<button class="gh">Switch to</button>'}</div>
    <div class="note" style="margin-top:5px">${e.registry} units in the event registry · ${e.seasons.length} season${e.seasons.length===1?'':'s'}</div>
    <div style="margin-top:10px">${e.seasons.map(s=>`<div class="bteam${s.active&&e.active?' win':''}" style="border:1px solid var(--line);margin-top:4px">
      <span class="nm">${esc(s.name)}</span>
      <span class="s">${s.units} units · ${s.weeks} nights${s.active&&e.active?' · editing':''}</span></div>`).join('')}</div>
    <div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">
      <button class="gh">Add season</button><button class="gh">Rename</button><button class="gh">Duplicate</button>
      <button class="gh" style="color:var(--live);border-color:var(--live)">Delete</button></div></div>`).join('');

  const reg = C.registry.map(u=>`<tr>
    <td class="nm">${esc(u.name)}</td>
    <td>${u.token?'<span class="tag q">Token</span>':'<span class="tag q" style="opacity:.55;border-style:dashed">Non-token</span>'}</td>
    <td>${u.div?`<span class="tag q">${esc(u.div)}</span>`:'<span style="color:var(--ink-3)">—</span>'}</td>
    <td class="num">${u.min||'—'}</td><td class="num">${u.max||'—'}</td>
    <td class="num" style="color:var(--ink-2)">${u.min&&u.max?((u.min+u.max)/2).toFixed(1):'—'}</td>
    <td><button class="gh">Edit</button></td></tr>`).join('');

  return `
  ${panel('Events','an event owns the unit registry and the Elo ladder; seasons live inside it',
    `<div class="cols">${evs}</div>`, true)}
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

/* ── Night builder ──────────────────────────────────────────────── */
const RT = ['Regular','Single round leads','Playoffs','Fun round'];
/** Round type drives everything below it: how many leads there are, whether the
 *  night scores, and whether it touches Elo and the map cooldown. */
const RT_RULES = {
  'Regular':            {leads:2, points:true,  elo:true,  cooldown:true,
    note:'One lead a side, both rounds. Two lead slots a night.'},
  'Single round leads': {leads:4, points:true,  elo:true,  cooldown:true,
    note:'Four leads a night — one per side per round. No unit leads both rounds.'},
  'Playoffs':           {leads:4, points:false, elo:true,  cooldown:true,
    note:'Leads per round, and no points are awarded. Elo still moves, at the playoff multiplier.'},
  'Fun round':          {leads:0, points:false, elo:false, cooldown:false,
    note:'Exhibition. No points, no Elo, and the maps played do not go on cooldown.'},
};

V.night = () => {
  const w = D.weeks[state.week];
  const type = state.roundType || (w.playoffs ? 'Playoffs' : 'Regular');
  const R = RT_RULES[type];
  const sel = D.weeks.map((x,i)=>`<option value="${i}"${i===state.week?' selected':''}>${esc(x.name)}</option>`).join('');
  const scores = new Set(D.standings.map(r=>r.unit));
  const all = D.config.registry.map(u=>u.name);
  const assigned = new Set([...w.a,...w.b]);
  const bench = all.filter(u=>!assigned.has(u));
  const heads = Object.fromEntries(D.config.registry.map(u=>[u.name,(u.min+u.max)/2]));
  const size = list => list.reduce((s,u)=>s+(heads[u]||0),0);

  const side = s => {
    const units = s==='A'?w.a:w.b, lead = s==='A'?w.leadA:w.leadB;
    // Regular = one lead for the night. Everything else = one per round.
    const leadFields = R.leads===0
      ? `<div class="note" style="margin-top:9px">Fun round — no lead is recorded.</div>`
      : R.leads===2
        ? pick(`Lead — Team ${s}`, ['—',...units], lead||'—', 'leads both rounds')
        : `<div class="grid-f" style="margin-top:9px">
             ${pick(`R1 lead — Team ${s}`, ['—',...units], lead||'—')}
             ${pick(`R2 lead — Team ${s}`, ['—',...units], units[1]||'—','must differ from R1')}
           </div>`;
    return `<div class="col ${s==='A'?'stripe-usa':'stripe-csa'}">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="tag ${s==='A'?'usa':'csa'}">Team ${s}</span>
        <span class="tag q">${s==='A'?'Home':'Away'}</span>
        <i class="rule"></i><span class="meta">${units.length} units · ~${size(units).toFixed(0)} men</span></div>
      <div style="margin-top:9px">${units.map(u=>`<div class="bteam" style="border:1px solid var(--line);margin-top:4px${scores.has(u)?'':';opacity:.55;border-style:dashed'}">
        <span><span class="nm">${esc(u)}</span>${u===lead&&R.leads?' <span class="tag q" style="border-color:var(--ink);color:var(--ink)">Lead ★</span>':''}</span>
        <span class="s">${heads[u]?`~${heads[u].toFixed(0)}`:'—'} <button class="gh" style="padding:1px 5px;margin-left:6px">→ ${s==='A'?'B':'A'}</button></span></div>`).join('')}</div>
      ${R.leads===2?`<div style="margin-top:9px">${leadFields}</div>`:leadFields}</div>`;
  };

  const round = r => {
    const win = r===1?w.r1:w.r2, map = r===1?w.m1:w.m2, flip = r===1?w.f1:w.f2;
    return `<div class="col">
      <div style="display:flex;align-items:center;gap:8px"><span class="cap">Round ${r}</span><i class="rule"></i>
        ${win?`<span class="tag ${win==='A'?'usa':'csa'}">Team ${win}</span>`:'<span class="meta">not played</span>'}</div>
      <div class="grid-f" style="margin-top:9px">
        ${pick('Map', [map||'—', ...D.maps.slice(0,8).map(m=>m.map)], map||'—', R.cooldown?`maps from the last ${D.config.mapCooldown} weeks are hidden`:'cooldown does not apply')}
        ${pick('Winner', ['Not played','Team A','Team B'], win==='A'?'Team A':win==='B'?'Team B':'Not played')}
        ${field('Casualties — A', w.casA[r-1] == null ? '' : w.casA[r-1])}
        ${field('Casualties — B', w.casB[r-1] == null ? '' : w.casB[r-1])}
      </div>
      <div style="margin-top:7px">${check('Sides flipped this round', flip, 'Team A played CSA')}</div>
      <div style="margin-top:5px">${pick('Balance swaps', ['None', ...w.a.slice(0,3), ...w.b.slice(0,3)], 'None', 'units moved to even the sides')}</div></div>`;
  };

  const badge = (on,label) => `<span class="tag q" style="${on?'':'opacity:.45;border-style:dashed'}">${on?'':'no '}${label}</span>`;

  return `
  <div class="panel">
    <div class="ctl"><span class="cap">Night</span><select id="nb-pick">${sel}</select>
      <button class="gh">＋ New night</button><button class="gh">Duplicate</button>
      <i class="rule"></i>
      ${badge(R.points,'points')} ${badge(R.elo,'Elo')} ${badge(R.cooldown,'map cooldown')}
      <span class="tag q">${R.leads} lead${R.leads===1?'':'s'}</span></div>
    <div class="grid-f" style="padding:13px">
      ${field('Name', w.name, 'shown in the schedule and exports')}
      ${pick('Round type', RT, type, R.note, 'nb-type')}
      ${field('Date', '—', 'drives the schedule order')}
    </div>
  </div>
  ${panel('Rosters','move a unit between sides, or send the night to the balancer',
    `<div class="cols">${side('A')}${side('B')}</div>
     <div style="display:flex;align-items:center;gap:7px;padding:11px 13px;border-top:1px solid var(--line);flex-wrap:wrap">
       <button class="gh" data-go="balancer" data-id="x">Open balancer</button>
       <button class="gh">Clear both sides</button>
       <i class="rule"></i>
       <span class="meta">${bench.length?`bench: ${bench.length} unit${bench.length===1?'':'s'} unassigned`:'every registered unit is assigned'}</span></div>
     ${bench.length?`<div style="padding:0 13px 13px"><div class="rl">${bench.map(u=>`<span class="tag q" style="opacity:.6">${esc(u)}</span>`).join('')}</div></div>`:''}`, true)}
  ${panel('Results', R.points?'filling these updates the standings immediately':'recorded, but this night awards no points',
    `<div class="cols">${round(1)}${round(2)}</div>`, true)}`;
};

/* ── Balancer ───────────────────────────────────────────────────── */
V.balancer = () => {
  const B = D.config.balancer, w = D.weeks[state.week];
  const heads = Object.fromEntries(D.config.registry.map(u=>[u.name,(u.min+u.max)/2]));
  const pool = [...w.a,...w.b];
  const opts = [0,1,2].map(i=>{
    const shuffled = pool.slice().sort((a,b)=>((a.charCodeAt(0)*7+i*13)%11)-((b.charCodeAt(0)*7+i*13)%11));
    const A=[],Bs=[];
    shuffled.forEach((u,j)=>((j+i)%2?Bs:A).push(u));
    const sa = A.reduce((s,u)=>s+(heads[u]||0),0), sb = Bs.reduce((s,u)=>s+(heads[u]||0),0);
    return {A, B:Bs, sa, sb, diff:Math.abs(sa-sb), rep:[3,5,2][i], score:(97-i*6)};
  }).sort((a,b)=>b.score-a.score);

  const cards = opts.map((o,i)=>`<div class="col${i===0?' stripe-usa':''}">
    <div style="display:flex;align-items:center;gap:8px">
      <span class="cap">Option ${i+1}</span><i class="rule"></i>
      ${i===0?'<span class="tag usa">Best</span>':''}<span class="meta">score ${o.score}</span></div>
    <div class="hb" style="margin-top:9px"><span>Team A</span>
      <span class="t"><i style="width:${o.sa/Math.max(o.sa,o.sb)*100}%;background:var(--union)"></i></span>
      <span class="n">~${o.sa.toFixed(0)}</span></div>
    <div class="hb"><span>Team B</span>
      <span class="t"><i style="width:${o.sb/Math.max(o.sa,o.sb)*100}%;background:var(--reb)"></i></span>
      <span class="n">~${o.sb.toFixed(0)}</span></div>
    <div class="note" style="margin-top:8px">${o.diff.toFixed(0)}-man gap · ${o.A.length}v${o.B.length} units · ${o.rep} repeat pairings</div>
    <div class="rl" style="margin-top:8px">${o.A.map(u=>`<span class="tag q">${esc(u)}</span>`).join('')}</div>
    <div class="rl" style="margin-top:4px;opacity:.7">${o.B.map(u=>`<span class="tag q">${esc(u)}</span>`).join('')}</div>
    <div style="margin-top:9px"><button class="gh"${i===0?' aria-pressed="true"':''}>Apply to ${esc(w.name)}</button></div></div>`).join('');

  const rosterPaste = w.a.slice(0,4).map(u=>{
    const e = D.config.registry.find(x=>x.name===u);
    return `${u}\t${e?e.min:0}\t${e?e.max:0}`;
  }).join('\n');

  return `
  <div class="panel">
    <div class="ctl"><span class="cap">Balancing</span><span class="nm">${esc(w.name)}</span>
      <button class="gh" data-go="night" data-id="${state.week}">Back to the night</button>
      <i class="rule"></i><span class="meta">${pool.length} units · ~${pool.reduce((s,u)=>s+(heads[u]||0),0).toFixed(0)} men in the pool</span></div>
  </div>
  ${panel('Options', `showing ${B.balanceOptionCount}`, `<div class="cols">${cards}</div>`, true)}
  ${panel('Weights','what the score above is made of',
    `<div class="grid-f">
      ${field('Teammate history', B.teammateWeight, 'penalises units that keep landing together')}
      ${field('Average difference', B.avgDiffWeight, 'head-count gap between the sides')}
      ${field('Unit count', B.regimentCountWeight, 'keeps the number of units even')}
      ${field('Range similarity', B.rangeSimilarityWeight, 'matches min-max spread, not just the average')}
      ${field('Division opposition', B.divisionOppositionWeight, '0 = ignore divisions when splitting')}
      ${field('Post-season skill', B.postSeasonSkillWeight, 'spreads playoff pedigree; 0 off outside playoffs')}
      ${field('Options to show', B.balanceOptionCount, 'how many splits to generate')}
    </div>
    <div style="display:flex;gap:6px;margin-top:11px"><button class="gh">Reset to defaults</button></div>`)}
  ${panel('Company balancer','split a side into companies',
    `<div class="cols" style="margin:-13px">
      <div class="col"><div class="cap">Roster paste</div>
        <textarea rows="7" style="margin-top:7px">${esc(rosterPaste)}</textarea>
        <div class="note" style="margin-top:6px">One unit a line: name, min, max — tab separated. Paste straight from the sheet.</div></div>
      <div class="col"><div class="cap">Companies</div>
        <div class="grid-f" style="margin-top:7px">${field('Company count',2)}${field('Target size',35)}</div>
        ${[1,2].map(n=>`<div style="border:1px solid var(--line);margin-top:8px">
          <div class="bteam" style="background:var(--raised)"><span class="cap">Company ${n}</span>
            <span class="s">~${n===1?42:38} men</span></div>
          ${w.a.slice(n===1?0:2,n===1?2:4).map(u=>`<div class="bteam"><span class="nm">${esc(u)}</span>
            <span class="s">~${(heads[u]||0).toFixed(0)}</span></div>`).join('')}</div>`).join('')}
        <div style="display:flex;gap:6px;margin-top:9px"><button class="gh">Copy split</button><button class="gh">Open standalone splitter</button></div></div>
    </div>`, true)}`;
};

/* ── Identity: unit merges + player pins ────────────────────────── */
V.identity = () => {
  const scoped = state.idScope !== 'overall';
  const note = scoped ? 'Applies to Season 3 only.' : 'Applies to ALL seasons.';
  const merges = [
    {from:'12thVA', to:'12th VA', s:'overall'},
    {from:'12th Virginia', to:'12th VA', s:'overall'},
    {from:'II-Corps', to:'II Corps', s:'overall'},
    {from:'MSG Arty', to:'MSG', s:'s3'},
    {from:'CB-2', to:'CB', s:'s3'},
  ].filter(m=>scoped ? true : m.s==='overall');

  const players = D.leaderboard.slice(0,8).map(p=>`<tr>
    <td class="nm">${esc(bare(p.name))}</td>
    <td style="color:var(--ink-3);font-size:11px">${esc(p.id)}</td>
    <td><span class="tag q">${esc(p.unit)}</span></td>
    <td><span class="note">${p.rounds} rounds · name tag</span></td>
    <td><select><option>${esc(p.unit)}</option>${D.regiments.filter(r=>r.unit!==p.unit).map(r=>`<option>${esc(r.unit)}</option>`).join('')}<option>Untagged</option></select></td>
  </tr>`).join('');

  return `
  <div class="panel">
    <div class="ctl"><span class="cap">Scope</span>
      <div class="seg" id="id-scope">
        <button data-s="overall" aria-pressed="${!scoped}">Overall</button>
        <button data-s="s3" aria-pressed="${scoped}">Season 3</button></div>
      <span class="tag q" style="${scoped?'border-color:var(--live);color:var(--live)':''}">${esc(note)}</span>
      <i class="rule"></i>
      <span class="meta">season rules layer over the overall ones</span></div>
    <div class="pb"><div class="prose"><p class="note">A unit that renamed between seasons keeps its old identity in the seasons it
      played under it — set the rule on Season 3 and Season 2's stats are untouched. Set it on Overall and it applies everywhere.</p></div></div>
  </div>
  <div class="panel"><header class="ph"><h2>Unit names</h2><i class="rule"></i>
    <span class="meta">${merges.length} rule${merges.length===1?'':'s'} in this scope</span></header>
    <div class="pb flush scroll-x"><table>
      <thead><tr><th>Scoreboard tag</th><th>Resolves to</th><th>Set at</th><th></th></tr></thead>
      <tbody>${merges.map(m=>`<tr>
        <td class="nm">${esc(m.from)}</td>
        <td class="nm">→ ${esc(m.to)}</td>
        <td><span class="tag q"${m.s==='overall'?'':' style="border-color:var(--live);color:var(--live)"'}>${m.s==='overall'?'Overall':'Season 3'}</span></td>
        <td style="display:flex;gap:5px"><button class="gh">Edit</button><button class="gh">Undo</button></td></tr>`).join('')}
      </tbody></table></div>
    <div style="display:flex;gap:6px;padding:11px 13px;border-top:1px solid var(--line);flex-wrap:wrap">
      <button class="gh">Rename a unit</button><button class="gh">Merge two units</button>
      <button class="gh">Send a unit to Untagged</button></div></div>
  <div class="panel"><header class="ph"><h2>Player assignments</h2><i class="rule"></i>
    <span class="meta">pin a steam id to a unit when the name tag is wrong</span></header>
    <div class="ctl"><input type="search" placeholder="player or steam id" aria-label="Find player">
      <button class="gh">Select all shown</button><button class="gh">Move selected to…</button>
      <i class="rule"></i><span class="meta">changes stage until you save</span></div>
    <div class="pb flush scroll-x"><table>
      <thead><tr><th>Player</th><th>Steam ID</th><th>Currently</th><th>Matched by</th><th>Reassign to</th></tr></thead>
      <tbody>${players}</tbody>
      <tfoot><tr><td colspan="5">Resolution order: pinned assignment → registry match → name tag. Pins are per scope, like the renames above.</td></tr></tfoot>
    </table></div>
    <div style="display:flex;gap:6px;padding:11px 13px;border-top:1px solid var(--line)">
      <button class="gh" aria-pressed="true">Save changes</button><button class="gh">Discard</button></div></div>`;
};

/* ── Schedule maker ─────────────────────────────────────────────── */
V.simulator = () => {
  const S = D.sched, mode = state.schedMode || 'paste';
  const pass = S.ok === S.total;

  const rows = S.rows.map(r=>{
    const bad = S.outOfOrder.includes(r.wk);
    return `<tr>
      <td style="color:var(--ink-3)">${r.wk}</td>
      <td class="num">R${r.rd}</td>
      <td class="nm">${esc(r.home)}</td>
      <td class="nm">${esc(r.away)}</td>
      <td${bad?' style="color:var(--live)"':' style="color:var(--ink-2)"'}>${esc(r.date)}${bad?' ⚠':''}</td></tr>`;
  }).join('');

  const audit = S.audit.map(e=>`<tr>
    <td class="nm">${esc(e.unit)}</td>
    <td class="num">${e.total}</td>
    <td class="num">${e.home}</td><td class="num">${e.away}</td>
    <td class="num">${e.homeR1}</td><td class="num">${e.homeR2}</td>
    <td class="num">${e.awayR1}</td><td class="num">${e.awayR2}</td>
    <td class="num" style="color:var(--ink-2)">${e.avgGap==null?'—':e.avgGap}</td>
    <td>${e.ok?'<span class="tag usa">Meets rule</span>'
        :`<span class="tag q" style="border-color:var(--live);color:var(--live)">${esc(e.issues.join(' · '))}</span>`}</td></tr>`).join('');

  const warn = (ok,label,detail) => `<div class="col">
    <div style="display:flex;align-items:center;gap:8px">
      <span class="tag ${ok?'usa':'q'}"${ok?'':' style="border-color:var(--live);color:var(--live)"'}>${ok?'Pass':'Check'}</span>
      <strong>${esc(label)}</strong></div>
    <div class="note" style="margin-top:5px">${detail}</div></div>`;

  const dateFix = S.outOfOrder.length
    ? `Weeks ${S.outOfOrder.join(' and ')} are dated <b>before</b> the week above them
       (W3 is ${esc(S.dates['3'])}, W4 ${esc(S.dates['4'])}, W5 ${esc(S.dates['5'])}). Sort by date, or renumber the weeks.`
    : 'Every week is dated after the one before it.';

  return `
  <div class="panel">
    <div class="ctl"><span class="cap">Source</span>
      <div class="seg" id="sched-mode">
        <button data-m="paste" aria-pressed="${mode==='paste'}">Paste a schedule</button>
        <button data-m="gen" aria-pressed="${mode==='gen'}">Generate one</button></div>
      <i class="rule"></i>
      <span class="meta">${S.nights} nights · ${S.slots} lead slots · ${S.total} units</span></div>
  </div>

  ${mode==='paste' ? `
  ${panel('Paste','one row per round: week, round, home, away, date — tab separated',
    `<textarea rows="9" spellcheck="false">${esc(S.raw)}</textarea>
     <div style="display:flex;align-items:center;gap:7px;margin-top:9px;flex-wrap:wrap">
       <button class="gh" aria-pressed="true">Parse</button>
       <button class="gh">Load a .tsv</button>
       <i class="rule"></i>
       <span class="meta">home = Team A lead · away = Team B lead</span></div>`)}
  ` : `
  ${panel('Rules','the generator solves for these, then reports what it could not hit',
    `<div class="grid-f">
      ${pick('Lead style',['Single round leads','Full lead weeks'],'Single round leads','four leads a night lets home/away and R1/R2 both balance')}
      ${field('Lead rounds per unit',4,'total across the season')}
      ${field('Home leads per unit',2,'the rest are away')}
      ${field('Of the home leads, R1',1,'the remainder land in R2')}
      ${field('Of the away leads, R1',1,'the remainder land in R2')}
      ${field('Minimum gap (nights)',2,'how long before a unit leads again')}
    </div>
    <div style="margin-top:11px">${check('Avoid repeat lead pairings', true, 'no two units meet as leads twice')}</div>
    <div style="margin-top:7px">${check('Never lead both rounds of a night', true, '')}</div>
    <div class="note" style="margin-top:11px">${S.total} units × 4 lead rounds ÷ 2 a round = <b style="color:var(--ink)">${S.slots/4} nights</b> at two rounds each.</div>
    <div style="display:flex;gap:6px;margin-top:11px"><button class="gh" aria-pressed="true">Generate</button>
      <button class="gh">Preview only</button></div>`)}
  `}

  ${panel('Constraint report', `${S.ok} of ${S.total} units meet the rule`,
    `<div class="cols">
      ${warn(pass,'Home / away and R1 / R2',
        pass ? `Every unit leads <b>4</b> rounds: <b>2 home</b>, <b>2 away</b>, and within each, one R1 and one R2.`
             : `${S.total-S.ok} unit(s) miss the split. See the table below.`)}
      ${warn(!S.repeats.length,'Repeat lead pairings',
        S.repeats.length ? `${S.repeats.length} pair(s) lead against each other more than once.`
                         : 'No two units meet as leads twice across the season.')}
      ${warn(!S.sameNight.length,'Twice in one night',
        S.sameNight.length ? `${S.sameNight.length} night(s) put a unit in both rounds.`
                           : 'No unit leads both rounds of the same night.')}
      ${warn(!S.outOfOrder.length,'Date order', dateFix)}
    </div>`, true)}

  <div class="panel"><header class="ph"><h2>Per unit</h2><i class="rule"></i>
    <span class="meta">target: 4 leads · 2H / 2A · one R1 and one R2 in each</span></header>
    <div class="pb flush scroll-x"><table>
      <thead><tr><th>Unit</th><th class="num">Leads</th><th class="num">Home</th><th class="num">Away</th>
        <th class="num">H·R1</th><th class="num">H·R2</th><th class="num">A·R1</th><th class="num">A·R2</th>
        <th class="num">Avg gap</th><th>Verdict</th></tr></thead>
      <tbody>${audit}</tbody></table></div></div>

  <div class="panel"><header class="ph"><h2>Parsed schedule</h2><i class="rule"></i>
    <span class="meta">${S.rows.length} rounds across ${S.nights} nights</span></header>
    <div class="pb flush scroll-x"><table>
      <thead><tr><th>Week</th><th class="num">Round</th><th>Home lead</th><th>Away lead</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div style="display:flex;gap:6px;padding:11px 13px;border-top:1px solid var(--line);flex-wrap:wrap">
      <button class="gh" aria-pressed="true">Write ${S.nights} nights into the schedule</button>
      <button class="gh">Copy TSV</button><button class="gh">Download CSV</button></div>
    <div class="note" style="padding:0 13px 13px">Writing creates the nights with their leads, round type and dates set.
      Nights that already have results are left alone.</div></div>`;
};

/* ── Settings (full) ────────────────────────────────────────────── */
V.settings = () => {
  const C = D.config, P = C.points, E = C.elo, EC = C.eloConfig, PO = C.playoff;
  return `
  ${panel('Point system','stored per season',
    `<div class="grid-f">
      ${field('Win — lead',P.winLead)}${field('Win — assist',P.winAssist)}
      ${field('Loss — lead',P.lossLead)}${field('Loss — assist',P.lossAssist)}
      ${field('2-0 bonus — lead',P.bonus2_0Lead)}${field('2-0 bonus — assist',P.bonus2_0Assist)}
      ${field('Balance points',P.balancePoints,'for units moved to even a round')}
      ${pick('Balance points style',['Per night','Per round','Per round (loss only)'],'Per night','loss-only awards it when the moved unit loses')}
    </div>`)}
  ${panel('Manual adjustments','points added or removed by hand',
    `<div class="scroll-x"><table><thead><tr><th>Unit</th><th class="num">Adjustment</th><th>Reason</th><th></th></tr></thead>
      <tbody>${Object.entries(C.manual).map(([u,v])=>`<tr><td class="nm">${esc(u)}</td>
        <td class="num" style="font-weight:600">${v>0?'+':''}${v}</td>
        <td><input value="administrative" style="width:100%"></td>
        <td><button class="gh">Remove</button></td></tr>`).join('')}
      </tbody></table></div>
      <div style="margin-top:9px"><button class="gh">Add adjustment</button></div>`)}
  ${panel('Elo','feeds the balancer, never the standings',
    `<div class="grid-f">
      ${field('Starting rating',E.initialElo)}${field('K factor',E.kFactorStandard)}
      ${field('Provisional K',E.kFactorProvisional)}${field('Provisional rounds',E.provisionalRounds)}
      ${field('Sweep bonus ×',E.sweepBonusMultiplier)}${field('Lead multiplier ×',E.leadMultiplier)}
      ${field('Size influence',E.sizeInfluence)}${field('Playoff multiplier ×',E.playoffMultiplier)}
    </div>`)}
  ${panel('Map and unit history','how much prior results move the expected result',
    `<div class="grid-f">
      ${field('Map weight',EC.mapWeight,'0 ignores map history; 1 uses full shrunk strength')}
      ${field('Unit weight',EC.unitWeight,'per-unit record on that map and side')}
      ${field('Shrinkage',EC.priorRounds,'rounds before a historical rate is half-trusted')}
      ${pick('Map stats scope',['Event only','All events (global)'], EC.mapStatsScope==='event'?'Event only':'All events (global)','unit history stays event-scoped either way')}
      ${field('Map cooldown (weeks)',C.mapCooldown,'hides recent maps from the pickers')}
    </div>
    <div class="cap" style="margin-top:15px">Attacker / defender bias</div>
    <div class="grid-f" style="margin-top:7px">
      ${field('Light attacker %',C.eloBias.lightAttacker)}${field('Heavy attacker %',C.eloBias.heavyAttacker)}
      ${field('Light defender %',C.eloBias.lightDefender)}${field('Heavy defender %',C.eloBias.heavyDefender)}
    </div>`)}
  ${panel('Playoff format','',
    `${check('Enable playoff tracking', PO.enabled, 'unlocks the bracket and the format planner')}
     <div class="grid-f" style="margin-top:11px">
      ${pick('Bracket style',['Conference','Seeded knockout'], PO.bracketStyle==='conference'?'Conference':'Seeded knockout',
        'knockout reseeds the whole field 1-vs-N; conference needs exactly two')}
      ${field('Top teams per division',PO.teamsPerDivision)}
      ${field('Wildcard seats',PO.wildcardTeams,'best of the rest, per conference')}
      ${field('Rounds — divisional',PO.roundFormats.divisional,'1 round = single game')}
      ${field('Rounds — conference',PO.roundFormats.conference,'2 and 3 are the same series: first to 2')}
      ${field('Rounds — finals',PO.roundFormats.finals)}
     </div>
     <div style="margin-top:11px">${check('Qualify through divisions', PO.useDivisions, 'off means the whole league seeds on points')}</div>`)}
  ${panel('Round types','what each one switches off',
    `<div class="scroll-x"><table>
      <thead><tr><th>Type</th><th class="num">Leads a night</th><th>Points</th><th>Elo</th><th>Map cooldown</th><th>Notes</th></tr></thead>
      <tbody>${RT.map(t=>{const R=RT_RULES[t];
        const y=v=>v?'<span class="tag q">Yes</span>':'<span class="tag q" style="opacity:.5;border-style:dashed">No</span>';
        return `<tr><td class="nm">${esc(t)}</td><td class="num">${R.leads||'—'}</td>
          <td>${y(R.points)}</td><td>${y(R.elo)}</td><td>${y(R.cooldown)}</td>
          <td class="note">${esc(R.note)}</td></tr>`;}).join('')}
      </tbody></table></div>`)}
  ${panel('Team names','what the two sides are called in this season',
    `<div class="grid-f">${field('Team A',C.teamNames.A,'the home side in the schedule maker')}
      ${field('Team B',C.teamNames.B,'the away side')}</div>`)}`;
};

