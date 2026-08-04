/* ══ Shared: search + pagination + expandable rows ════════════════ */
const ui = id => (state.ui[id] ||= {q:'', p:0});
const PAGE = 8;

/** Ranked list with its own search box and pager. Used by every analytics and
 *  roster section, so they all filter and page the same way. */
function paged(id, rows, head, row, searchOf, opts={}){
  const u = ui(id), size = opts.size || PAGE;
  const q = u.q.trim().toLowerCase();
  const hit = q ? rows.filter(r=>searchOf(r).toLowerCase().includes(q)) : rows;
  const pages = Math.max(1, Math.ceil(hit.length/size));
  const p = Math.min(u.p, pages-1);
  const slice = hit.slice(p*size, p*size+size);
  return `<div class="sec">
    <div class="sec-h">
      <span class="cap">${esc(opts.title||'')}</span><i class="rule"></i>
      <span class="find"><input type="search" data-q="${id}" value="${esc(u.q)}"
        placeholder="${esc(opts.ph||'search')}" aria-label="Search ${esc(opts.title||'')}"></span></div>
    ${hit.length===0 ? `<div class="note" style="padding:9px 0">no matches for "${esc(u.q.trim())}"</div>`
      : `<div class="scroll-x"><table><thead><tr>${head}</tr></thead>
         <tbody>${slice.map((r,i)=>row(r, p*size+i+1)).join('')}</tbody></table></div>`}
    ${pages>1 ? `<div class="pager">
      <span>${p*size+1}–${p*size+slice.length} of ${hit.length}</span>
      <span class="pg">
        <button data-pg="${id}|${p-1}" ${p===0?'disabled':''} aria-label="Previous">‹</button>
        <span>${p+1}/${pages}</span>
        <button data-pg="${id}|${p+1}" ${p>=pages-1?'disabled':''} aria-label="Next">›</button></span></div>`:''}
  </div>`;
}

const isOpen = k => (state.exp||[]).includes(k);
const FORM = [['in_form','In formation',1],['skirm','Skirmish',3],['oob','Out of line',5]];

/** Horizontal breakdown bars with counts and shares. */
function bars(entries, opts={}){
  const list = entries.filter(([,v])=>v>0);
  if(!list.length) return `<div class="note">No data</div>`;
  const max = Math.max(...list.map(([,v])=>v)), tot = list.reduce((s,[,v])=>s+v,0);
  return `<div class="hbars">${list.map(([k,v],i)=>`<div class="hb">
    <span class="nm">${esc(k)}</span>
    <span class="t"><i style="width:${v/max*100}%${opts.ramp?`;background:var(--st${i+1})`:''}"></i></span>
    <span class="n">${v}<span style="color:var(--ink-3)"> · ${pc(v,tot)}%</span></span></div>`).join('')}</div>`;
}
const formBars = f => bars(FORM.map(([k,l,w])=>[`${l} · ${w}tkt`, f[k]||0]), {ramp:true});
const causeBars = c => bars(Object.entries(c).sort((a,b)=>b[1]-a[1]));

/** "Casualties suffered" / "inflicted": formation and cause, side by side. */
const breakdown = (heading, f, c) => `<div class="bd">
  <div class="cap" style="color:var(--live)">${esc(heading)}</div>
  <div class="cols" style="margin-top:8px">
    <div class="col"><div class="cap">By formation</div>${formBars(f)}</div>
    <div class="col"><div class="cap">By cause</div>${causeBars(c)}</div></div></div>`;

/** One context slice (as USA / as CSA / attacking / defending). */
function ctxPanel(key, label, s){
  if(!s || !s.rounds) return '';
  const open = isOpen(key);
  return `<div class="panel">
    <header class="ph area-h" data-exp="${key}" role="button" tabindex="0" aria-expanded="${open}">
      <span class="cap" style="width:11px">${open?'▼':'▶'}</span>
      <h2>${esc(label)}</h2><i class="rule"></i>
      <span class="meta">${s.rounds}rd · ${s.fielded}p · ${s.kills}K/${s.deaths}D · ${n2(s.kd)} K/D ·
        KR ${n2(s.kr)} · LR ${n2(s.lr)} · ×Td ${n1(s.td)} · ×Tk ${n1(s.tk)}${
        s.tdi!=null?` · TDI ${s.tdi}% · TDR ${s.tdr}%`:''}</span></header>
    ${open?`<div class="pb">
      ${breakdown('Casualties suffered', s.cf, s.cc)}
      <div style="height:14px"></div>
      ${breakdown('Casualties inflicted', s.kf, s.kc)}</div>`:''}</div>`;
}

/* ══ Round view — matchup / units / killfeed / analytics ══════════ */
const ROUND_TABS = [['matchup','Matchup'],['units','Units'],['feed','Killfeed'],['analytics','Analytics']];

V.round = () => {
  const m = D.matchups[state.round];
  const tab = state.roundTab || 'matchup';
  const sel = D.matchups.map((x,i)=>`<option value="${i}"${i===state.round?' selected':''}>${esc(x.week)} · R${x.rd} · ${esc(x.map)}</option>`).join('');
  const head = `<div class="panel"><div class="ctl">
      <span class="cap">Round</span><select id="rd-pick">${sel}</select>
      <div class="seg" id="rd-tab">${ROUND_TABS.map(([k,l])=>
        `<button data-t="${k}" aria-pressed="${tab===k}">${l}</button>`).join('')}</div>
      <i class="rule"></i>
      <span class="meta cap">${esc(m.map)} · ${dur(m.dur)} · ${esc(m.attacker)} attacks</span></div></div>`;

  if(tab==='matchup') return head + roundMatchup(m);
  if(tab==='units')   return head + roundUnits(m);
  if(tab==='feed')    return head + roundFeed(m);
  return head + roundAnalytics(m);
};

/* ── Units: every unit stat, expand for its players ─────────────── */
function roundUnits(m){
  const st = f => {
    const c = m.cas[f], t = c.total||1;
    return `<div class="col"><div style="display:flex;align-items:center;gap:8px">
      <span class="tag ${f.toLowerCase()}">${f}</span><span class="cap">${c.total} casualties</span></div>
      <div class="stack" style="margin-top:9px">
        <i style="width:${pc(c.inForm,t)}%;background:var(--st1)"></i>
        <i style="width:${pc(c.skirm,t)}%;background:var(--st2)"></i>
        <i style="width:${pc(c.oob,t)}%;background:var(--st3)"></i></div>
      <div class="leg">
        <span><i style="background:var(--st1)"></i>In formation · 1 tkt · ${c.inForm} · ${pc(c.inForm,t)}%</span>
        <span><i style="background:var(--st2)"></i>Skirmish · 3 · ${c.skirm} · ${pc(c.skirm,t)}%</span>
        <span><i style="background:var(--st3)"></i>Out of line · 5 · ${c.oob} · ${pc(c.oob,t)}%</span></div></div>`;
  };

  const side = f => {
    const rows = m.units[f];
    const tot = rows.reduce((a,u)=>({k:a.k+u.k,d:a.d+u.d,n:a.n+u.n}),{k:0,d:0,n:0});
    const head = `<th></th><th>Unit</th><th class="num">Men</th><th class="num">Kills</th><th class="num">Lost</th>
      <th class="num">K/D</th><th class="num">KR</th><th class="num">LR</th>
      <th class="num">×Td</th><th class="num">×Tk</th><th class="num">TDI</th><th class="num">TDR</th>`;
    const row = u => {
      const key = `ru-${m.week}-${m.rd}-${f}-${u.unit}`, open = isOpen(key);
      const kr=u.k/u.n, lr=u.d/u.n;
      const td=u.d?u.tdr/u.d:null, tk=u.k?u.tdi/u.k:null;
      const detail = open ? `<tr class="exp"><td colspan="12">
        <div class="cols">
          <div class="col">${breakdown('Casualties suffered', u.cf, u.cc)}</div>
          <div class="col">${breakdown('Casualties inflicted', u.kf, u.kc)}</div>
        </div>
        <div class="cap" style="margin:13px 0 6px">${u.players.length} players</div>
        <div class="scroll-x"><table><thead><tr><th></th><th>Player</th>
          <th class="num">K</th><th class="num">D</th><th class="num">K/D</th>
          <th class="num">×Td</th><th class="num">×Tk</th>
          <th>Deaths (IF/Sk/OoL)</th><th>Killed with</th><th>Died to</th></tr></thead>
        <tbody>${u.players.map((p,i)=>`<tr class="click" data-go="playerName" data-id="${esc(p.sid)}">
          <td><span class="pos ${i===0?'q':''}">${i+1}</span></td>
          <td class="nm">${esc(bare(p.name))}</td>
          <td class="num">${p.k}</td><td class="num">${p.d}</td><td class="num">${n2(p.kd)}</td>
          <td class="num" style="color:var(--ink-2)">${n1(p.td)}</td>
          <td class="num" style="color:var(--ink-2)">${n1(p.tk)}</td>
          <td style="color:var(--ink-2)">${p.df.in_form||0} / ${p.df.skirm||0} / ${p.df.oob||0}</td>
          <td style="color:var(--ink-2)">${Object.entries(p.kc).map(([k,v])=>`${esc(k)}${v>1?' ×'+v:''}`).join(' · ')||'—'}</td>
          <td style="color:var(--ink-2)">${Object.entries(p.cc).map(([k,v])=>`${esc(k)}${v>1?' ×'+v:''}`).join(' · ')||'—'}</td>
        </tr>`).join('')}</tbody></table></div></td></tr>` : '';
      return `<tr class="click" data-exp="${key}">
        <td><span class="cap" style="width:9px;display:inline-block">${open?'▼':'▶'}</span></td>
        <td class="nm">${esc(u.unit)}</td>
        <td class="num">${u.n}</td><td class="num">${u.k}</td><td class="num">${u.d}</td>
        <td class="num">${n2(u.kd)}</td>
        <td class="num" style="color:var(--ink-2)">${n2(kr)}</td>
        <td class="num" style="color:var(--ink-2)">${n2(lr)}</td>
        <td class="num" style="color:var(--ink-2)">${td==null?'—':n1(td)}</td>
        <td class="num" style="color:var(--ink-2)">${tk==null?'—':n1(tk)}</td>
        <td class="num">${u.tdiPct}%</td><td class="num">${u.tdrPct}%</td></tr>${detail}`;
    };
    return `<div class="panel"><header class="ph">
      <span class="tag ${f.toLowerCase()}">${f}</span><h2>units</h2><i class="rule"></i>
      <span class="meta">${tot.n} men · ${tot.k} kills · ${tot.d} lost · click a unit for its players</span></header>
      <div class="pb">${paged(`ru-${m.week}-${m.rd}-${f}`, rows, head, row,
        u=>u.unit+' '+u.players.map(p=>p.name).join(' '),
        {ph:'unit or player', size:12})}</div></div>`;
  };

  return panel('Casualties by stance','what each side\'s losses cost in tickets',
    `<div class="cols">${st('USA')}${st('CSA')}</div>`, true) + side('USA') + side('CSA');
}

/* ── Killfeed ───────────────────────────────────────────────────── */
function roundFeed(m){
  const feed = m.feed || [];
  const head = `<th class="num">Time</th><th>Killer</th><th>Weapon</th><th>Victim</th><th>Caught</th><th class="num">Tickets</th>`;
  const row = e => {
    const w = e.form==='in formation'?1:e.form==='skirmish'?3:5;
    return `<tr><td class="num" style="color:var(--ink-3)">${esc(e.t)}</td>
      <td class="nm"><span class="tag ${e.kt.toLowerCase()}" style="margin-right:6px">${e.kt}</span>${esc(bare(e.k))}</td>
      <td>${esc(e.cause)}</td>
      <td class="nm">${esc(bare(e.v))}</td>
      <td><span style="color:var(--st${w===1?1:w===3?2:3})">${esc(e.form)}</span></td>
      <td class="num" style="font-weight:${w===5?600:400}">${w}</td></tr>`;
  };
  return `<div class="panel"><header class="ph"><h2>Killfeed</h2><i class="rule"></i>
    <span class="meta">${feed.length} events · time from round start</span></header>
    <div class="pb">${paged(`feed-${m.week}-${m.rd}`, feed, head, row,
      e=>`${e.k} ${e.v} ${e.cause} ${e.form}`, {ph:'player or weapon', size:14})}</div></div>`;
}

/* ── Analytics ──────────────────────────────────────────────────── */
function roundAnalytics(m){
  const A = m.analytics;
  const tagOf = r => `<span class="tag ${r.team.toLowerCase()}">${r.team}</span>`;
  const pRow = (val,suffix='') => (r,i)=>`<tr class="click" data-go="playerName" data-id="${esc(r.name)}">
    <td><span class="pos ${i===1?'q':''}">${i}</span></td>
    <td class="nm">${esc(bare(r.name))}</td><td>${tagOf(r)}</td>
    <td><span class="tag q">${esc(r.unit)}</span></td>
    <td class="num" style="font-weight:600">${val(r)}${suffix}</td></tr>`;
  const uRow = val => (r,i)=>`<tr class="click" data-go="unit" data-id="${esc(r.unit)}">
    <td><span class="pos ${i===1?'q':''}">${i}</span></td>
    <td class="nm">${esc(r.unit)}</td><td>${tagOf(r)}</td>
    <td class="num" style="color:var(--ink-2)">${r.n}</td>
    <td class="num" style="font-weight:600">${val(r)}</td></tr>`;
  const pHead = `<th></th><th>Player</th><th>Side</th><th>Unit</th><th class="num">Value</th>`;
  const uHead = `<th></th><th>Unit</th><th>Side</th><th class="num">Men</th><th class="num">Value</th>`;
  const pS = r=>`${r.name} ${r.unit}`, uS = r=>r.unit;
  const id = k => `an-${m.week}-${m.rd}-${k}`;

  const two = (a,b) => `<div class="cols"><div class="col">${a}</div><div class="col">${b}</div></div>`;

  return `
  ${panel('Individual leaders','', two(
    paged(id('k'), A.topKills, pHead, pRow(r=>r.k), pS, {title:'Most kills', ph:'player or unit'}),
    paged(id('d'), A.topDeaths, pHead, pRow(r=>r.d), pS, {title:'Most deaths', ph:'player or unit'})), true)}
  ${panel('Ticket damage — players','stance-weighted', two(
    paged(id('ti'), A.topTdi, pHead, pRow(r=>`${r.tdi}`,' tkt'), pS, {title:'Most inflicted', ph:'player or unit'}),
    paged(id('tr'), A.topTdr, pHead, pRow(r=>`${r.tdr}`,' tkt'), pS, {title:'Most received', ph:'player or unit'})), true)}
  ${panel('Unit rates','size-normalised — per man fielded', two(
    paged(id('kr'), A.killRates, uHead, uRow(r=>n2(r.kr)), uS, {title:'Kills per man', ph:'unit'}),
    paged(id('lr'), A.lossRates, uHead, uRow(r=>n2(r.lr)), uS, {title:'Losses per man', ph:'unit'})), true)}
  ${panel('Ticket damage — units','share of their own side', two(
    paged(id('uti'), A.unitTdi, uHead, uRow(r=>r.tdiPct+'%'), uS, {title:'Share inflicted', ph:'unit'}),
    paged(id('utr'), A.unitTdr, uHead, uRow(r=>r.tdrPct+'%'), uS, {title:'Share received', ph:'unit'})), true)}
  ${panel('Opening and closing','', `<div class="cols">
    ${[['First death',A.first],['Last death',A.last]].map(([l,e])=>`<div class="col">
      <div class="cap">${l}</div>
      ${e?`<div class="nm" style="margin-top:6px;font-size:13px">${esc(bare(e.v))}</div>
        <div class="note" style="margin-top:3px">at <b>${esc(e.t)}</b> — ${esc(e.cause)} from
        ${esc(bare(e.k))} <span class="tag ${e.kt.toLowerCase()}">${e.kt}</span>, caught ${esc(e.form)}</div>`
        :'<div class="note">—</div>'}</div>`).join('')}</div>`, true)}
  ${A.nemeses.length ? panel('Nemeses','pairs that met more than once',
    `<div class="scroll-x"><table><thead><tr><th></th><th>Killer</th><th>Victim</th><th class="num">Times</th></tr></thead>
      <tbody>${A.nemeses.map((n,i)=>`<tr><td><span class="pos ${i===0?'q':''}">${i+1}</span></td>
        <td class="nm">${esc(bare(n.k))}</td><td class="nm">${esc(bare(n.v))}</td>
        <td class="num" style="font-weight:600">${n.n}</td></tr>`).join('')}</tbody></table></div>`) : ''}`;
}

/* ── Matchup (the scoreline + spine) ────────────────────────────── */
function roundMatchup(m){
  const U = m.cas.USA, C = m.cas.CSA;
  const tix = c => c.inForm + 3*c.skirm + 5*c.oob;
  const uT = tix(U), cT = tix(C), usaWon = m.winner==='USA';
  const men = f => m.units[f].reduce((s,u)=>s+u.n,0);
  const SIDE = {USA:{c:U,cl:'usa',adj:'Union',noun:'the Union'},CSA:{c:C,cl:'csa',adj:'Confederate',noun:'the Confederacy'}};
  const win = {t:m.winner,...SIDE[m.winner]}, los = {t:usaWon?'CSA':'USA',...SIDE[usaWon?'CSA':'USA']};
  const wU = m.units[win.t], top = wU[0], next = wU[1];
  const ool = los.c.oob*5, cap = s => s[0].toUpperCase()+s.slice(1);
  const keys = [
    [win.cl, win.adj+' discipline',
     `<b>${pc(win.c.inForm,win.c.total)}%</b> of ${win.adj} losses came in formation against <b>${pc(los.c.inForm,los.c.total)}%</b> for ${los.noun}. A death in formation costs one ticket; the rest cost three or five.`],
    [los.cl, 'Caught out of line',
     `${cap(los.noun)} lost <b>${los.c.oob}</b> men out of line — <b>${ool}</b> tickets, <b>${pc(ool,tix(los.c))}%</b> of everything given up, off <b>${pc(los.c.oob,los.c.total)}%</b> of the casualties.`],
    [win.cl, (top?top.unit:'—')+' carried it',
     top?`<b>${top.tdiPct}%</b> of ${win.adj} ticket damage off <b>${top.n}</b> men at <b>${n2(top.kd)}</b> K/D${next?`. The next ${win.adj} unit managed <b>${next.tdiPct}%</b>`:''}.`:'—'],
    ['', 'The margin', (()=>{
      const wD = win.t==='USA'?cT:uT, lD = win.t==='USA'?uT:cT;
      return wD>=lD ? `${cap(win.noun)} won the ticket exchange <b>${wD}</b> to <b>${lD}</b> — a <b>${wD-lD}</b>-ticket margin over ${dur(m.dur)}.`
        : `${cap(win.noun)} won on bodies, not tickets: more men killed, but the heavier ticket loss — <b>${lD}</b> dealt against <b>${wD}</b>. Cheap deaths in formation covered the gap.`;
    })()],
  ].map(([c,t,b])=>`<div class="col"><div style="display:flex;align-items:center;gap:7px">
      <span class="tag ${c||'q'}">${c?c.toUpperCase():'Round'}</span><strong>${esc(t)}</strong></div>
      <div class="prose" style="margin-top:6px;font-size:11.5px">${b}</div></div>`).join('');

  const unitCols = ['USA','CSA'].map(f=>{
    const mx = Math.max(...m.units[f].map(u=>u.tdiPct))||1;
    return `<div class="col ${f==='USA'?'stripe-usa':'stripe-csa'}">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
        <span class="tag ${f.toLowerCase()}">${f}</span><span class="cap">ticket damage dealt</span>
        ${m.attacker===f?'<span class="tag q">attacking</span>':'<span class="tag q">defending</span>'}</div>
      ${m.units[f].slice(0,6).map(u=>`<div class="hb"><span class="nm">${esc(u.unit)}</span>
        <span class="t"><i style="width:${u.tdiPct/mx*100}%;background:var(--${f==='USA'?'union':'reb'})"></i></span>
        <span class="n">${u.tdiPct}%</span></div>`).join('')}</div>`;
  }).join('');

  return `
    <div class="panel">
      ${scoreline(
        {tag:`<span class="tag usa">Union</span>`, name:m.leadUSA?`USA · ${m.leadUSA}`:'USA', val:C.total, sub:`casualties inflicted · ${men('USA')} men`, cls:'f-usa'},
        {tag:`<span class="tag csa">Confederate</span>`, name:m.leadCSA?`CSA · ${m.leadCSA}`:'CSA', val:U.total, sub:`casualties inflicted · ${men('CSA')} men`, cls:'f-csa'},
        usaWon?'A':'B','Final')}
      ${stripebar(C.total,U.total,'union','reb')}
    </div>
    ${panel('How the round was won','one line per metric', spine([
      {label:'Casualties inflicted', sub:'enemy men lost', a:C.total, b:U.total},
      {label:'Casualties taken', sub:'lower is better', a:U.total, b:C.total, lower:true},
      {label:'Ticket damage dealt', sub:'stance weighted', a:cT, b:uT},
      {label:'Held the line', sub:'% of losses, in formation', a:pc(U.inForm,U.total), b:pc(C.inForm,C.total), af:pc(U.inForm,U.total)+'%', bf:pc(C.inForm,C.total)+'%'},
      {label:'Caught out of line', sub:'% of losses · lower better', a:pc(U.oob,U.total), b:pc(C.oob,C.total), af:pc(U.oob,U.total)+'%', bf:pc(C.oob,C.total)+'%', lower:true},
      {label:'Cost per death', sub:'tickets, lower better', a:uT/U.total, b:cT/C.total, af:n1(uT/U.total), bf:n1(cT/C.total), lower:true},
      {label:'Melee deaths', sub:'lost at bayonet point', a:m.weapons.USA.Melee||0, b:m.weapons.CSA.Melee||0, lower:true},
      {label:'Artillery deaths', sub:'canister · shell · round shot', a:(m.weapons.USA.Canister||0)+(m.weapons.USA.Shell||0)+(m.weapons.USA['Round Shot']||0), b:(m.weapons.CSA.Canister||0)+(m.weapons.CSA.Shell||0)+(m.weapons.CSA['Round Shot']||0), lower:true},
      {txt:true, label:'Morale at the end', a:m.morale.USA, b:m.morale.CSA},
    ],'usa','csa'), true)}
    ${panel('Keys to the round','written from the numbers above', `<div class="cols">${keys}</div>`, true)}
    ${panel('Who did the damage','', `<div class="cols">${unitCols}</div>`, true)}`;
}
