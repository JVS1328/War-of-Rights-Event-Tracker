/* ══ Unit card — every breakdown the Regiments tab had ════════════ */
V.unit = () => {
  const r = D.regiments.find(x=>x.unit===state.unit) || D.regiments[0];
  const st = D.standings.find(x=>x.unit===r.unit);
  const T = D.regiments.length;
  const sel = D.regiments.map(x=>`<option value="${esc(x.unit)}"${x.unit===r.unit?' selected':''}>${esc(x.unit)}</option>`).join('');
  const rk = (k,low)=>D.regiments.slice().sort((a,b)=>low?a[k]-b[k]:b[k]-a[k]).findIndex(x=>x.unit===r.unit)+1;
  const S=[['Points',st?st.points:'—',st?st.pos:null,st?`${st.w}–${st.l} on the night`:'not in standings',D.standings.length],
    ['K/D',n2(r.kd),rk('kd'),`${r.kills} kills · ${r.deaths} lost`,T],
    ['Kills per man',n2(r.kr),rk('kr'),'size-normalised output',T],
    ['Losses per man',n2(r.lr),rk('lr',true),'lower is better',T],
    ['Cost per death',n1(r.td),rk('td',true),'tickets · ×Td',T],
    ['Value per kill',n1(r.tk),rk('tk'),'tickets · ×Tk',T],
    ['Damage dealt',(r.tdi??0)+'%',rk('tdi'),'avg share of its side',T],
    ['Damage taken',(r.tdr??0)+'%',rk('tdr',true),'lower is better',T]]
    .map(([h,v,p,x,t])=>`<div class="kpi"><div class="cap">${h}</div><div class="v">${v}</div>
      <div class="h"><b style="color:var(--ink-2)">${p?ord(p):'—'}</b> of ${t} · ${x}</div>
      <div class="pctbar"><i style="width:${p?(1-(p-1)/t)*100:0}%"></i></div></div>`).join('');

  const prHead = `<th></th><th>Night</th><th class="num">Rd</th><th>Map</th><th>Side</th><th class="num">Men</th>
    <th class="num">K</th><th class="num">D</th><th class="num">K/D</th><th class="num">KR</th><th class="num">LR</th>
    <th class="num">×Td</th><th class="num">×Tk</th><th class="num">TDI</th><th class="num">TDR</th><th>Result</th>`;
  const prRow = p => {
    const key = `ur-${r.unit}-${p.week}-${p.rd}`, open = isOpen(key);
    const det = open ? `<tr class="exp"><td colspan="16"><div class="cols">
        <div class="col">${breakdown('Casualties suffered', p.cf, p.cc)}</div>
        <div class="col">${breakdown('Casualties inflicted', p.kf, p.kc)}</div></div>
        <div class="note" style="margin-top:9px">${p.atk?'Attacking':'Defending'} on ${esc(p.map)} as ${p.team}.
          Fielded ${p.n} men for ${p.k} kills and ${p.d} losses.</div></td></tr>` : '';
    return `<tr class="click" data-exp="${key}">
      <td><span class="cap" style="width:9px;display:inline-block">${open?'▼':'▶'}</span></td>
      <td class="nm" style="color:var(--ink-2)">${esc(p.week)}</td><td class="num">${p.rd}</td>
      <td class="nm">${esc(p.map)}</td>
      <td><span class="tag ${p.team.toLowerCase()}">${p.team}</span>${p.atk?' <span class="tag q">atk</span>':''}</td>
      <td class="num">${p.n}</td><td class="num">${p.k}</td><td class="num">${p.d}</td>
      <td class="num">${n2(p.kd)}</td>
      <td class="num" style="color:var(--ink-2)">${n2(p.kr)}</td>
      <td class="num" style="color:var(--ink-2)">${n2(p.lr)}</td>
      <td class="num" style="color:var(--ink-2)">${n1(p.td)}</td>
      <td class="num" style="color:var(--ink-2)">${n1(p.tk)}</td>
      <td class="num">${p.tdiPct==null?'—':p.tdiPct+'%'}</td>
      <td class="num">${p.tdrPct==null?'—':p.tdrPct+'%'}</td>
      <td style="font-weight:${p.win?600:400};color:${p.win?'var(--ink)':'var(--ink-3)'}">${p.win?'Won':'Lost'}</td></tr>${det}`;
  };

  const rosterHead = `<th></th><th>Player</th><th class="num">Rds</th><th class="num">K</th><th class="num">D</th>
    <th class="num">K/D</th><th class="num">K/rd</th><th class="num">×Td</th><th class="num">×Tk</th>`;
  const roster = D.leaderboard.filter(p=>p.unit===r.unit).sort((a,b)=>b.k-a.k);

  return `<div class="panel">
    <div class="ctl"><span class="cap">Unit</span><select id="un-pick">${sel}</select>
      <button class="gh" data-go="cmpUnit" data-id="${esc(r.unit)}">Compare</button>
      <i class="rule"></i><span class="meta cap">${esc(r.div)} division · ${r.rounds} rounds · ${r.players} men seen</span></div>
    <div style="padding:16px 16px 12px;display:flex;align-items:baseline;gap:11px;flex-wrap:wrap">
      <span class="mid nm">${esc(r.unit)}</span><span class="tag q">${esc(r.div)}</span>
      <span class="cap">avg ${n1(r.avg)} men fielded a round</span></div>
    <div class="kpis" style="border-top:1px solid var(--line)">${S}</div></div>

  ${panel('Whole record','every round this unit played',
    `${breakdown('Casualties suffered', r.cf, r.cc)}<div style="height:16px"></div>
     ${breakdown('Casualties inflicted', r.kf, r.kc)}`)}

  <div class="stitle"><h2>Splits</h2><span class="c">the same breakdowns, sliced by context</span></div>
  ${ctxPanel(`uc-${r.unit}-usa`,'As USA', r.ctx.asUSA)}
  ${ctxPanel(`uc-${r.unit}-csa`,'As CSA', r.ctx.asCSA)}
  ${ctxPanel(`uc-${r.unit}-atk`,'Attacking', r.ctx.asAtk)}
  ${ctxPanel(`uc-${r.unit}-def`,'Defending', r.ctx.asDef)}

  <div class="panel"><header class="ph"><h2>Round by round</h2><i class="rule"></i>
    <span class="meta">click a round for its breakdown</span></header>
    <div class="pb">${paged(`ur-${r.unit}`, r.perRound, prHead, prRow,
      p=>`${p.week} ${p.map} ${p.team}`, {ph:'night or map', size:8})}</div></div>

  <div class="panel"><header class="ph"><h2>Roster</h2><i class="rule"></i>
    <span class="meta">${roster.length} players seen in this unit</span></header>
    <div class="pb">${paged(`uro-${r.unit}`, roster, rosterHead,
      (p,i)=>`<tr class="click" data-go="player" data-id="${esc(p.id)}">
        <td><span class="pos ${i===1?'q':''}">${i}</span></td>
        <td class="nm">${esc(bare(p.name))}</td><td class="num">${p.rounds}</td>
        <td class="num">${p.k}</td><td class="num">${p.d}</td><td class="num">${n2(p.kd)}</td>
        <td class="num" style="color:var(--ink-2)">${n1(p.kpr)}</td>
        <td class="num" style="color:var(--ink-2)">${n1(p.td)}</td>
        <td class="num" style="color:var(--ink-2)">${n1(p.tk)}</td></tr>`,
      p=>p.name, {ph:'player', size:10})}</div></div>`;
};

/* ══ Player card — with context splits and per-round detail ═══════ */
V.player = () => {
  const p = D.leaderboard.find(r=>r.id===state.player) || D.leaderboard[0];
  const T = D.leaderboard.length;
  const sel = D.leaderboard.map(x=>`<option value="${x.id}"${x.id===p.id?' selected':''}>${esc(bare(x.name))} — ${esc(x.unit)}</option>`).join('');
  const S = [['Kills',p.k,rankOf(p.id,'k'),`${n1(p.kpr)} per round`],
    ['Deaths',p.d,rankOf(p.id,'d',true),`${n1(p.dpr)} per round`],
    ['K/D',n2(p.kd),rankOf(p.id,'kd'),'kills ÷ deaths'],
    ['Kills per man-round',n2(p.kr),rankOf(p.id,'kr'),'size-normalised'],
    ['Cost per death',n1(p.td),rankOf(p.id,'td',true),'tickets · ×Td'],
    ['Value per kill',n1(p.tk),rankOf(p.id,'tk'),'tickets · ×Tk']]
    .map(([h,v,r,x])=>`<div class="kpi"><div class="cap">${h}</div><div class="v">${v}</div>
      <div class="h"><b style="color:var(--ink-2)">${ord(r)}</b> of ${T} · ${x}</div>
      <div class="pctbar"><i style="width:${(1-(r-1)/T)*100}%"></i></div></div>`).join('');

  const log = p.log.slice().reverse(), mk = Math.max(...log.map(r=>r.k))||1;
  const wins = log.filter(r=>r.win).length;

  const gHead = `<th></th><th>Night</th><th class="num">Rd</th><th>Map</th><th>Side</th>
    <th class="num">K</th><th class="num">D</th><th class="num">K/D</th>
    <th class="num">×Td</th><th class="num">×Tk</th><th>Result</th>`;
  const gRow = (l,i) => {
    const key = `pl-${p.id}-${l.week}-${l.rd}`, open = isOpen(key);
    const det = open ? `<tr class="exp"><td colspan="11"><div class="cols">
      <div class="col"><div class="cap">His deaths this round</div>${formBars(l.df)}</div>
      <div class="col"><div class="cap">Where his victims died</div>${formBars(l.kf)}</div></div></td></tr>` : '';
    return `<tr class="click" data-exp="${key}">
      <td><span class="cap" style="width:9px;display:inline-block">${open?'▼':'▶'}</span></td>
      <td class="nm" style="color:var(--ink-2)">${esc(l.week)}</td><td class="num">${l.rd}</td>
      <td class="nm">${esc(l.map)}</td>
      <td><span class="tag ${l.team.toLowerCase()}">${l.team}</span>${l.atk?' <span class="tag q">atk</span>':''}</td>
      <td class="num">${l.k}</td><td class="num">${l.d}</td><td class="num">${n2(l.kd)}</td>
      <td class="num" style="color:var(--ink-2)">${n1(l.td)}</td>
      <td class="num" style="color:var(--ink-2)">${n1(l.tk)}</td>
      <td style="font-weight:${l.win?600:400};color:${l.win?'var(--ink)':'var(--ink-3)'}">${l.win?'Won':'Lost'}</td></tr>${det}`;
  };

  return `<div class="panel">
    <div class="ctl"><span class="cap">Player</span><select id="pl-pick">${sel}</select>
      <button class="gh" data-go="cmpPlayer" data-id="${esc(p.id)}">Compare</button>
      <i class="rule"></i><span class="meta cap">${esc(p.id)}</span></div>
    <div style="padding:16px 16px 12px;display:flex;align-items:baseline;gap:11px;flex-wrap:wrap">
      <span class="mid nm">${esc(bare(p.name))}</span>
      <button class="tag q" data-go="unit" data-id="${esc(p.unit)}">${esc(p.unit)}</button>
      <span class="cap">${/bty|batter/i.test(p.unit)?'Artillery':'Infantry'} · ${p.rounds} rounds</span></div>
    <div class="kpis" style="border-top:1px solid var(--line)">${S}</div></div>

  ${panel('Form',`${wins}–${log.length-wins} across ${log.length} rounds · most recent right`,
    `<div class="form">${log.map(r=>`<i class="${r.win?'w':''}" style="height:${Math.max(4,r.k/mk*34)}px" title="${esc(r.week)} R${r.rd} · ${esc(r.map)} — ${r.k}K ${r.d}D"></i>`).join('')}</div>
     <div class="leg"><span><i style="background:var(--ink)"></i>won</span>
     <span><i style="background:var(--ink);opacity:.2"></i>lost</span><span>bar height = kills</span></div>`)}

  ${panel('Whole record','every round played',
    `${breakdown('Deaths — where he was caught', p.cf, p.cc)}<div style="height:16px"></div>
     ${breakdown('Kills — where his victims were caught', p.kf, p.kc)}`)}

  <div class="stitle"><h2>Splits</h2><span class="c">the same breakdowns, sliced by context</span></div>
  ${ctxPanel(`pc-${p.id}-usa`,'As USA', p.ctx.asUSA)}
  ${ctxPanel(`pc-${p.id}-csa`,'As CSA', p.ctx.asCSA)}
  ${ctxPanel(`pc-${p.id}-atk`,'Attacking', p.ctx.asAtk)}
  ${ctxPanel(`pc-${p.id}-def`,'Defending', p.ctx.asDef)}

  <div class="panel"><header class="ph"><h2>Game log</h2><i class="rule"></i>
    <span class="meta">click a round for its stance split</span></header>
    <div class="pb">${paged(`pl-${p.id}`, p.log, gHead, gRow,
      l=>`${l.week} ${l.map} ${l.team}`, {ph:'night or map', size:10})}</div></div>`;
};

/* ══ Compare — players or units ═══════════════════════════════════ */
V.compare = () => {
  const isUnit = (state.cmpMode||'player')==='unit';
  const pool = isUnit ? D.regiments : D.leaderboard;
  const idOf = x => isUnit ? x.unit : x.id;
  const nameOf = x => isUnit ? x.unit : bare(x.name);
  const a = pool.find(x=>idOf(x)===(isUnit?state.cmpUA:state.cmpA)) || pool[0];
  const b = pool.find(x=>idOf(x)===(isUnit?state.cmpUB:state.cmpB)) || pool[1];
  const opts = who => pool.map(x=>`<option value="${esc(idOf(x))}"${idOf(x)===who?' selected':''}>${esc(nameOf(x))}${isUnit?'':' — '+esc(x.unit)}</option>`).join('');

  const rows = isUnit ? [
    {label:'Rounds', a:a.rounds, b:b.rounds},
    {label:'Men seen', a:a.players, b:b.players},
    {label:'Avg fielded', sub:'men a round', a:a.avg, b:b.avg, af:n1(a.avg), bf:n1(b.avg)},
    {label:'Kills', a:a.kills, b:b.kills},
    {label:'Losses', a:a.deaths, b:b.deaths, lower:true},
    {label:'K/D', a:a.kd, b:b.kd, af:n2(a.kd), bf:n2(b.kd)},
    {label:'Kills per man', a:a.kr, b:b.kr, af:n2(a.kr), bf:n2(b.kr)},
    {label:'Losses per man', sub:'lower is better', a:a.lr, b:b.lr, af:n2(a.lr), bf:n2(b.lr), lower:true},
    {label:'Cost per death', sub:'lower is better', a:a.td, b:b.td, af:n1(a.td), bf:n1(b.td), lower:true},
    {label:'Value per kill', a:a.tk, b:b.tk, af:n1(a.tk), bf:n1(b.tk)},
    {label:'Damage dealt', sub:'avg share of its side', a:a.tdi??0, b:b.tdi??0, af:(a.tdi??0)+'%', bf:(b.tdi??0)+'%'},
    {label:'Damage taken', sub:'lower is better', a:a.tdr??0, b:b.tdr??0, af:(a.tdr??0)+'%', bf:(b.tdr??0)+'%', lower:true},
    {label:'Held the line', sub:'% of losses in formation', a:pc(a.cf.in_form,a.deaths), b:pc(b.cf.in_form,b.deaths), af:pc(a.cf.in_form,a.deaths)+'%', bf:pc(b.cf.in_form,b.deaths)+'%'},
    {label:'Caught out of line', sub:'% of losses · lower better', a:pc(a.cf.oob,a.deaths), b:pc(b.cf.oob,b.deaths), af:pc(a.cf.oob,a.deaths)+'%', bf:pc(b.cf.oob,b.deaths)+'%', lower:true},
    {label:'Melee kills', a:a.kc.Melee||0, b:b.kc.Melee||0},
  ] : [
    {label:'Rounds', a:a.rounds, b:b.rounds},
    {label:'Kills', a:a.k, b:b.k},
    {label:'Kills per round', a:a.kpr, b:b.kpr, af:n1(a.kpr), bf:n1(b.kpr)},
    {label:'Deaths', a:a.d, b:b.d, lower:true},
    {label:'Deaths per round', a:a.dpr, b:b.dpr, af:n1(a.dpr), bf:n1(b.dpr), lower:true},
    {label:'K/D', a:a.kd, b:b.kd, af:n2(a.kd), bf:n2(b.kd)},
    {label:'Cost per death', sub:'lower is better', a:a.td, b:b.td, af:n1(a.td), bf:n1(b.td), lower:true},
    {label:'Value per kill', a:a.tk, b:b.tk, af:n1(a.tk), bf:n1(b.tk)},
    {label:'Died in formation', sub:'% of own deaths', a:pc(a.cf.in_form,a.d), b:pc(b.cf.in_form,b.d), af:pc(a.cf.in_form,a.d)+'%', bf:pc(b.cf.in_form,b.d)+'%'},
    {label:'Died out of line', sub:'% · lower better', a:pc(a.cf.oob,a.d), b:pc(b.cf.oob,b.d), af:pc(a.cf.oob,a.d)+'%', bf:pc(b.cf.oob,b.d)+'%', lower:true},
    {label:'Kills out of line', sub:'% — victims caught loose', a:pc(a.kf.oob,a.k), b:pc(b.kf.oob,b.k), af:pc(a.kf.oob,a.k)+'%', bf:pc(b.kf.oob,b.k)+'%'},
    {label:'Melee kills', a:a.kc.Melee||0, b:b.kc.Melee||0},
  ];
  let aw=0,bw=0;
  rows.forEach(r=>{ if(r.a===r.b) return; ((r.lower ? r.a<r.b : r.a>r.b)?aw++:bw++); });
  const win = aw>=bw?a:b, los = aw>=bw?b:a, wn = Math.max(aw,bw);

  const ctxRow = (label,key) => {
    const A=a.ctx[key], B=b.ctx[key];
    if(!A.rounds && !B.rounds) return '';
    return `<tr><td class="nm">${esc(label)}</td>
      <td class="num">${A.rounds}</td><td class="num">${A.rounds?n2(A.kd):'—'}</td>
      <td class="num" style="color:var(--ink-2)">${A.rounds?n1(A.td):'—'}</td>
      <td class="num">${B.rounds}</td><td class="num">${B.rounds?n2(B.kd):'—'}</td>
      <td class="num" style="color:var(--ink-2)">${B.rounds?n1(B.td):'—'}</td></tr>`;
  };

  return `<div class="panel">
    <div class="ctl"><span class="cap">Compare</span>
      <div class="seg" id="cmp-mode">
        <button data-c="player" aria-pressed="${!isUnit}">Players</button>
        <button data-c="unit" aria-pressed="${isUnit}">Units</button></div>
      <select id="c-a">${opts(idOf(a))}</select><span class="cap">versus</span>
      <select id="c-b">${opts(idOf(b))}</select><button class="gh" id="c-swap">Swap</button></div>
    ${scoreline(
      {tag:`<span class="tag q">${esc(isUnit?a.div:a.unit)}</span>`, name:nameOf(a), val:n2(a.kd), sub:`K/D · ${a.rounds} rounds`},
      {tag:`<span class="tag q">${esc(isUnit?b.div:b.unit)}</span>`, name:nameOf(b), val:n2(b.kd), sub:`K/D · ${b.rounds} rounds`},
      a.kd>=b.kd?'A':'B','K/D')}
  </div>
  ${panel('Head to head', `${wn} of ${rows.length} categories`, spine(rows,'ink','ink'), true)}
  ${panel('Splits','the same context slices, side by side',
    `<div class="scroll-x"><table>
      <thead><tr><th>Context</th>
        <th class="num" colspan="3">${esc(nameOf(a))}</th>
        <th class="num" colspan="3">${esc(nameOf(b))}</th></tr>
        <tr><th></th><th class="num">Rds</th><th class="num">K/D</th><th class="num">×Td</th>
        <th class="num">Rds</th><th class="num">K/D</th><th class="num">×Td</th></tr></thead>
      <tbody>${ctxRow('As USA','asUSA')}${ctxRow('As CSA','asCSA')}${ctxRow('Attacking','asAtk')}${ctxRow('Defending','asDef')}</tbody>
    </table></div>`)}
  ${panel('Breakdowns','',
    `<div class="cols">
      <div class="col"><div class="cap">${esc(nameOf(a))} — deaths by cause</div>${causeBars(a.cc)}</div>
      <div class="col"><div class="cap">${esc(nameOf(b))} — deaths by cause</div>${causeBars(b.cc)}</div></div>
     <div class="cols" style="margin-top:13px">
      <div class="col"><div class="cap">${esc(nameOf(a))} — kills by cause</div>${causeBars(a.kc)}</div>
      <div class="col"><div class="cap">${esc(nameOf(b))} — kills by cause</div>${causeBars(b.kc)}</div></div>`, true)}
  ${panel('Read','', `<div class="prose">
     <p><b>${esc(nameOf(win))}</b> takes ${wn} of ${rows.length}.
     ${isUnit ? `${n2(win.kr)} kills a man against ${n2(los.kr)}, while losing ${n2(los.lr)} a man to ${n2(win.lr)}.`
              : `${n1(win.kpr)} kills a round against ${n1(los.kpr)}, dying ${n1(los.dpr/Math.max(win.dpr,.01))}× less often.`}</p>
     <p class="note">${win.td<los.td
       ? `Each of ${esc(nameOf(win))}'s losses also costs the side ${n1(los.td-win.td)} fewer tickets — the discipline gap, not just the gunnery.`
       : `${esc(nameOf(los))} dies more cheaply though: ${n1(win.td-los.td)} fewer tickets a casualty.`}</p></div>`)}`;
};

/* ══ Night matchup — round types, and the rounds rolled up ════════ */
V.week = () => {
  const w = D.weeks[state.week];
  const type = w.playoffs ? 'Playoffs' : (state.roundType || 'Regular');
  const perRound = RT_RULES[type] && RT_RULES[type].leads === 4;
  const aW = (w.r1==='A'?1:0)+(w.r2==='A'?1:0), bW = 2-aW;
  const cA = (w.casA[0]||0)+(w.casA[1]||0), cB = (w.casB[0]||0)+(w.casB[1]||0);
  const sel = D.weeks.map((x,i)=>`<option value="${i}"${i===state.week?' selected':''}>${esc(x.name)}</option>`).join('');
  const P = D.season.pointSystem;
  const pts = side => {
    const wins = side==='A'?aW:bW;
    return {lead: wins*P.winLead + (2-wins)*P.lossLead,
            asst: wins*P.winAssist + (2-wins)*P.lossAssist + (wins===2?P.bonus2_0Assist:0)};
  };
  const pA = pts('A'), pB = pts('B');
  const scores = new Set(D.standings.map(r=>r.unit));

  // Scoreboards for this night, if any were imported.
  const mats = D.matchups.filter(x=>x.week===w.name).sort((x,y)=>x.rd-y.rd);
  const roll = mats.length ? (()=>{
    const acc = {USA:{k:0,d:0,n:0,cf:{in_form:0,skirm:0,oob:0},kc:{},cc:{}},
                 CSA:{k:0,d:0,n:0,cf:{in_form:0,skirm:0,oob:0},kc:{},cc:{}}};
    const units = {USA:{}, CSA:{}};
    mats.forEach(m=>['USA','CSA'].forEach(f=>{
      const c=m.cas[f]; acc[f].cf.in_form+=c.inForm; acc[f].cf.skirm+=c.skirm; acc[f].cf.oob+=c.oob;
      m.units[f].forEach(u=>{
        acc[f].k+=u.k; acc[f].d+=u.d; acc[f].n+=u.n;
        const t=(units[f][u.unit] ||= {unit:u.unit,k:0,d:0,n:0,tdi:0,tdr:0,rounds:0});
        t.k+=u.k; t.d+=u.d; t.n+=u.n; t.tdi+=u.tdi; t.tdr+=u.tdr; t.rounds++;
        Object.entries(u.kc).forEach(([c2,v])=>acc[f].kc[c2]=(acc[f].kc[c2]||0)+v);
        Object.entries(u.cc).forEach(([c2,v])=>acc[f].cc[c2]=(acc[f].cc[c2]||0)+v);
      });
    }));
    ['USA','CSA'].forEach(f=>{
      const ti=Object.values(units[f]).reduce((s,u)=>s+u.tdi,0)||1;
      const tr=Object.values(units[f]).reduce((s,u)=>s+u.tdr,0)||1;
      Object.values(units[f]).forEach(u=>{u.tdiPct=Math.round(100*u.tdi/ti); u.tdrPct=Math.round(100*u.tdr/tr);});
    });
    return {acc, units};
  })() : null;

  const tix = c => c.in_form + 3*c.skirm + 5*c.oob;

  const rounds = [1,2].map(r=>{
    const win = r===1?w.r1:w.r2, map = r===1?w.m1:w.m2, flip = r===1?w.f1:w.f2;
    const ca = w.casA[r-1], cb = w.casB[r-1];
    if(!win) return '';
    const mi = D.matchups.findIndex(x=>x.week===w.name && x.rd===r);
    const open = mi>=0;
    const lead = side => perRound ? `${side==='A'?(w.leadA||'—'):(w.leadB||'—')}` : (side==='A'?(w.leadA||'—'):(w.leadB||'—'));
    return `<div class="col${open?' click-col':''}"${open?` data-go="round" data-id="${mi}" role="button" tabindex="0"`:''}>
      <div style="display:flex;align-items:baseline;gap:8px"><span class="cap">Round ${r}</span>
        <i class="rule"></i><span class="tag ${win==='A'?'usa':'csa'}">Team ${win}</span></div>
      <div class="nm" style="margin-top:6px;font-size:13px">${esc(map)}</div>
      ${perRound?`<div class="note" style="margin-top:3px">Leads: ${esc(lead('A'))} <span style="color:var(--ink-3)">vs</span> ${esc(lead('B'))}</div>`:''}
      <div class="note" style="margin-top:3px">${flip?'sides flipped · ':''}Team A ${ca==null?'—':ca} casualties · Team B ${cb==null?'—':cb}</div>
      ${ca!=null&&cb!=null?`<div class="stack" style="margin-top:8px"><i style="width:${pc(cb,ca+cb)}%;background:var(--union)"></i><i style="flex:1;background:var(--reb)"></i></div>
      <div class="leg"><span>Team A inflicted ${cb}</span><span>Team B inflicted ${ca}</span></div>`:''}
      <div class="note" style="margin-top:9px;${open?'color:var(--live)':''}">${open?'Open the round matchup →':'No scoreboard imported for this round'}</div></div>`;
  }).join('');

  const rosters = ['A','B'].map(s=>{
    const units = s==='A'?w.a:w.b, lead = s==='A'?w.leadA:w.leadB;
    const nonTok = units.filter(u=>!scores.has(u));
    return `<div class="col ${s==='A'?'stripe-usa':'stripe-csa'}">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="tag ${s==='A'?'usa':'csa'}">Team ${s}</span>
        <span class="tag q">${s==='A'?'Home':'Away'}</span>
        <i class="rule"></i><span class="meta">${units.length} units</span></div>
      <div class="rl" style="margin-top:8px">${units.map(u=>{
        const isLead=u===lead, tok=scores.has(u);
        return `<span class="tag q" style="${isLead?'border-color:var(--ink);color:var(--ink);font-weight:600':tok?'':'opacity:.5;border-style:dashed'}">${esc(u)}${isLead?' ★':''}</span>`;
      }).join('')}</div>
      <div class="note" style="margin-top:9px">${perRound?'Leads are set per round — see the rounds above. ':'★ lead · '}${s==='A'?pA.lead:pB.lead} pts to the lead, ${s==='A'?pA.asst:pB.asst} to each assist${nonTok.length?` · ${nonTok.length} non-token score nothing`:''}</div></div>`;
  }).join('');

  const rollPanels = roll ? (()=>{
    const U=roll.acc.USA, C=roll.acc.CSA;
    const unitCols = ['USA','CSA'].map(f=>{
      const list = Object.values(roll.units[f]).sort((x,y)=>y.tdi-x.tdi);
      return `<div class="panel"><header class="ph">
        <span class="tag ${f.toLowerCase()}">${f}</span><h2>units across the night</h2><i class="rule"></i>
        <span class="meta">${mats.length} round${mats.length===1?'':'s'} imported</span></header>
        <div class="pb flush scroll-x"><table>
          <thead><tr><th>Unit</th><th class="num">Rds</th><th class="num">Men</th><th class="num">Kills</th>
            <th class="num">Lost</th><th class="num">K/D</th><th class="num">KR</th><th class="num">LR</th>
            <th class="num">TDI</th><th class="num">TDR</th></tr></thead>
          <tbody>${list.map(u=>`<tr class="click" data-go="unit" data-id="${esc(u.unit)}">
            <td class="nm">${esc(u.unit)}</td><td class="num">${u.rounds}</td><td class="num">${u.n}</td>
            <td class="num">${u.k}</td><td class="num">${u.d}</td>
            <td class="num">${n2(u.d?u.k/u.d:u.k)}</td>
            <td class="num" style="color:var(--ink-2)">${n2(u.k/u.n)}</td>
            <td class="num" style="color:var(--ink-2)">${n2(u.d/u.n)}</td>
            <td class="num">${u.tdiPct}%</td><td class="num">${u.tdrPct}%</td></tr>`).join('')}
          </tbody></table></div></div>`;
    }).join('');
    return panel('The night in scoreboards', `${mats.length} of 2 rounds imported`, spine([
        {label:'Kills', a:U.k, b:C.k},
        {label:'Casualties', sub:'lower is better', a:U.d, b:C.d, lower:true},
        {label:'Ticket damage taken', sub:'stance weighted · lower better', a:tix(U.cf), b:tix(C.cf), lower:true},
        {label:'Held the line', sub:'% of losses in formation', a:pc(U.cf.in_form,U.d), b:pc(C.cf.in_form,C.d), af:pc(U.cf.in_form,U.d)+'%', bf:pc(C.cf.in_form,C.d)+'%'},
        {label:'Caught out of line', sub:'% · lower better', a:pc(U.cf.oob,U.d), b:pc(C.cf.oob,C.d), af:pc(U.cf.oob,U.d)+'%', bf:pc(C.cf.oob,C.d)+'%', lower:true},
        {label:'Cost per death', sub:'tickets · lower better', a:U.d?tix(U.cf)/U.d:0, b:C.d?tix(C.cf)/C.d:0, af:n1(U.d?tix(U.cf)/U.d:null), bf:n1(C.d?tix(C.cf)/C.d:null), lower:true},
        {label:'Melee kills', a:U.kc.Melee||0, b:C.kc.Melee||0},
      ],'usa','csa'), true)
      + panel('Weapons across the night','', `<div class="cols">
          <div class="col"><div style="display:flex;align-items:center;gap:7px"><span class="tag usa">USA</span><span class="cap">killed with</span></div>${causeBars(U.kc)}</div>
          <div class="col"><div style="display:flex;align-items:center;gap:7px"><span class="tag csa">CSA</span><span class="cap">killed with</span></div>${causeBars(C.kc)}</div>
        </div>`, true)
      + unitCols;
  })() : panel('The night in scoreboards','',
      `<div class="note">No scoreboards imported for ${esc(w.name)}. The casualty totals above come from the night's recorded results;
        importing a scoreboard adds the stance splits, per-unit stats and the killfeed.</div>`);

  return `
    <div class="panel">
      <div class="ctl"><span class="cap">Night</span><select id="wk-pick">${sel}</select>
        <span class="tag q">${esc(type)}</span>
        ${perRound?'<span class="tag q">4 leads</span>':'<span class="tag q">2 leads</span>'}
        <button class="gh" data-go="night" data-id="${state.week}">Edit</button>
        <i class="rule"></i><span class="meta cap">${esc(w.name)}</span></div>
      ${scoreline(
        {tag:'<span class="tag usa">Team A</span>', name:perRound?'Team A':(w.leadA?`${w.leadA} leading`:'No lead recorded'), val:aW, sub:`rounds won · ${cA} casualties taken`, cls:'f-usa'},
        {tag:'<span class="tag csa">Team B</span>', name:perRound?'Team B':(w.leadB?`${w.leadB} leading`:'No lead recorded'), val:bW, sub:`rounds won · ${cB} casualties taken`, cls:'f-csa'},
        aW>bW?'A':bW>aW?'B':'', aW===bW?'Split':'Final')}
      ${stripebar(aW||0.02, bW||0.02,'union','reb')}
    </div>
    ${panel('Rounds','two rounds make a night', `<div class="cols">${rounds}</div>`, true)}
    ${panel('The night in numbers','from the recorded results', spine([
        {label:'Rounds won', a:aW, b:bW},
        {label:'Casualties inflicted', sub:'enemy men lost', a:cB, b:cA},
        {label:'Casualties taken', sub:'lower is better', a:cA, b:cB, lower:true},
        {label:'Units fielded', a:w.a.length, b:w.b.length},
        {label:'Points this night', sub:'lead + one assist', a:pA.lead+pA.asst, b:pB.lead+pB.asst},
        ...(perRound?[]:[{txt:true, label:'Lead unit', a:w.leadA||'—', b:w.leadB||'—'}]),
      ],'usa','csa'), true)}
    ${rollPanels}
    ${panel('Rosters', perRound?'leads are per round':'lead marked ★', `<div class="cols">${rosters}</div>`, true)}`;
};
