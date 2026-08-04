/* ══ Schedule maker ═══════════════════════════════════════════════
   Lead style is the governing setting: it decides how many lead slots a
   night has, which in turn decides which rules can even be expressed and
   how long the season runs. Everything below it re-reads from here. */
const LEAD_STYLES = {
  full: {
    label:'Full lead weeks', perNight:2, perRound:1, splitRounds:false,
    blurb:'One lead a side for the whole night — two lead slots a night.',
  },
  single: {
    label:'Single round leads', perNight:4, perRound:2, splitRounds:true,
    blurb:'One lead per side per round — four lead slots a night, and no unit leads both rounds.',
  },
};

V.simulator = () => {
  const S = D.sched, mode = state.schedMode || 'paste';
  const styleKey = state.leadStyle || 'single';
  const ST = LEAD_STYLES[styleKey];
  const pass = S.ok === S.total;
  // The paste is a per-round schedule: two distinct lead pairs a night. That is
  // only expressible under single round leads.
  const pasteIsPerRound = S.rows.length === S.nights * 2;
  const styleMismatch = mode==='paste' && !ST.splitRounds && pasteIsPerRound;

  const rows = S.rows.map(r=>{
    const bad = S.outOfOrder.includes(r.wk);
    return `<tr>
      <td style="color:var(--ink-3)">${r.wk}</td>
      <td class="num">${ST.splitRounds?`R${r.rd}`:'—'}</td>
      <td class="nm">${esc(r.home)}</td>
      <td class="nm">${esc(r.away)}</td>
      <td${bad?' style="color:var(--live)"':' style="color:var(--ink-2)"'}>${esc(r.date)}${bad?' ⚠':''}</td></tr>`;
  }).join('');

  // Under full lead weeks there is no R1/R2 split to audit — a lead leads both.
  const auditCols = ST.splitRounds
    ? ['Unit','Leads','Home','Away','H·R1','H·R2','A·R1','A·R2','Avg gap','Verdict']
    : ['Unit','Leads','Home','Away','Avg gap','Verdict'];
  const audit = S.audit.map(e=>{
    const issues = ST.splitRounds ? e.issues
      : e.issues.filter(x=>!/R1|R2/.test(x));
    const ok = !issues.length;
    const mid = ST.splitRounds
      ? `<td class="num">${e.homeR1}</td><td class="num">${e.homeR2}</td>
         <td class="num">${e.awayR1}</td><td class="num">${e.awayR2}</td>` : '';
    return `<tr><td class="nm">${esc(e.unit)}</td>
      <td class="num">${e.total}</td><td class="num">${e.home}</td><td class="num">${e.away}</td>
      ${mid}
      <td class="num" style="color:var(--ink-2)">${e.avgGap==null?'—':e.avgGap}</td>
      <td>${ok?'<span class="tag usa">Meets rule</span>'
          :`<span class="tag q" style="border-color:var(--live);color:var(--live)">${esc(issues.join(' · '))}</span>`}</td></tr>`;
  }).join('');
  const okCount = S.audit.filter(e=>(ST.splitRounds?e.issues:e.issues.filter(x=>!/R1|R2/.test(x))).length===0).length;

  const warn = (ok,label,detail) => `<div class="col">
    <div style="display:flex;align-items:center;gap:8px">
      <span class="tag ${ok?'usa':'q'}"${ok?'':' style="border-color:var(--live);color:var(--live)"'}>${ok?'Pass':'Check'}</span>
      <strong>${esc(label)}</strong></div>
    <div class="note" style="margin-top:5px">${detail}</div></div>`;

  const dateFix = S.outOfOrder.length
    ? `Weeks ${S.outOfOrder.join(' and ')} are dated <b>before</b> the week above them
       (W3 is ${esc(S.dates['3'])}, W4 ${esc(S.dates['4'])}, W5 ${esc(S.dates['5'])}). Sort by date, or renumber the weeks.`
    : 'Every week is dated after the one before it.';

  // Rule fields follow the style: R1/R2 splits only exist when a night has a
  // lead per round.
  const leadsPerUnit = ST.splitRounds ? 4 : 2;
  const nights = Math.ceil(S.total * leadsPerUnit / ST.perNight);
  const ruleFields = `
    <div class="grid-f">
      ${pick('Lead style', Object.values(LEAD_STYLES).map(x=>x.label), ST.label, ST.blurb, 'sm-style')}
      ${field(ST.splitRounds?'Lead rounds per unit':'Lead nights per unit', leadsPerUnit, 'total across the season')}
      ${field('Home leads per unit', leadsPerUnit/2, 'the rest are away')}
      ${ST.splitRounds ? field('Of the home leads, R1', 1, 'the remainder land in R2') : ''}
      ${ST.splitRounds ? field('Of the away leads, R1', 1, 'the remainder land in R2') : ''}
      ${field('Minimum gap (nights)', 2, 'how long before a unit leads again')}
    </div>
    <div style="margin-top:11px">${check('Avoid repeat lead pairings', true, 'no two units meet as leads twice')}</div>
    ${ST.splitRounds ? `<div style="margin-top:7px">${check('Never lead both rounds of a night', true, '')}</div>` : ''}
    <div class="note" style="margin-top:11px">${S.total} units × ${leadsPerUnit} lead ${ST.splitRounds?'rounds':'nights'}
      ÷ ${ST.perNight} a night = <b style="color:var(--ink)">${nights} nights</b>.
      ${(S.total*leadsPerUnit)%ST.perNight ? `${(S.total*leadsPerUnit)%ST.perNight} slot(s) left over — that many units lead one fewer time.`
        : 'Every unit leads the same number of times.'}</div>
    <div style="display:flex;gap:6px;margin-top:11px"><button class="gh" aria-pressed="true">Generate</button>
      <button class="gh">Preview only</button></div>`;

  return `
  <div class="panel">
    <div class="ctl"><span class="cap">Source</span>
      <div class="seg" id="sched-mode">
        <button data-m="paste" aria-pressed="${mode==='paste'}">Paste a schedule</button>
        <button data-m="gen" aria-pressed="${mode==='gen'}">Generate one</button></div>
      <span class="cap">Lead style</span>
      <div class="seg" id="sched-style">
        ${Object.entries(LEAD_STYLES).map(([k,v])=>
          `<button data-l="${k}" aria-pressed="${styleKey===k}">${esc(v.label)}</button>`).join('')}</div>
      <i class="rule"></i>
      <span class="meta">${ST.perNight} lead slots a night · ${S.nights} nights · ${S.total} units</span></div>
  </div>

  ${styleMismatch ? panel('Style mismatch','',
    `<div class="note" style="color:var(--live)">This paste carries <b>two different lead pairs a night</b> — that is a
      single-round-leads schedule. Under full lead weeks a night has one lead a side for both rounds, so only the
      first pair of each night would be used and half the leads would be dropped.
      Switch the style back, or paste a one-pair-per-night schedule.</div>`) : ''}

  ${mode==='paste' ? panel('Paste',
      ST.splitRounds ? 'one row per round: week, round, home, away, date — tab separated'
                     : 'one row per night: week, home, away, date — tab separated',
    `<textarea rows="9" spellcheck="false">${esc(S.raw)}</textarea>
     <div style="display:flex;align-items:center;gap:7px;margin-top:9px;flex-wrap:wrap">
       <button class="gh" aria-pressed="true">Parse</button>
       <button class="gh">Load a .tsv</button>
       <i class="rule"></i>
       <span class="meta">home = Team A lead · away = Team B lead</span></div>`)
    : panel('Rules','the generator solves for these, then reports what it could not hit', ruleFields)}

  ${panel('Constraint report', `${okCount} of ${S.total} units meet the rule`,
    `<div class="cols">
      ${warn(okCount===S.total, ST.splitRounds?'Home / away and R1 / R2':'Home / away',
        okCount===S.total
          ? `Every unit leads <b>${S.audit[0].total}</b> times: <b>${S.audit[0].home} home</b>, <b>${S.audit[0].away} away</b>${ST.splitRounds?', and within each, one R1 and one R2':''}.`
          : `${S.total-okCount} unit(s) miss the split. See the table below.`)}
      ${warn(!S.repeats.length,'Repeat lead pairings',
        S.repeats.length ? `${S.repeats.length} pair(s) lead against each other more than once.`
                         : 'No two units meet as leads twice across the season.')}
      ${ST.splitRounds ? warn(!S.sameNight.length,'Twice in one night',
        S.sameNight.length ? `${S.sameNight.length} night(s) put a unit in both rounds.`
                           : 'No unit leads both rounds of the same night.')
        : warn(true,'Both rounds','Not applicable — a full-week lead is expected to lead both rounds.')}
      ${warn(!S.outOfOrder.length,'Date order', dateFix)}
    </div>`, true)}

  <div class="panel"><header class="ph"><h2>Per unit</h2><i class="rule"></i>
    <span class="meta">target: ${leadsPerUnit} leads · ${leadsPerUnit/2}H / ${leadsPerUnit/2}A${ST.splitRounds?' · one R1 and one R2 in each':''}</span></header>
    <div class="pb flush scroll-x"><table>
      <thead><tr>${auditCols.map((c,i)=>`<th${i?' class="num"':''}>${esc(c)}</th>`).join('').replace('<th class="num">Verdict</th>','<th>Verdict</th>')}</tr></thead>
      <tbody>${audit}</tbody></table></div></div>

  <div class="panel"><header class="ph"><h2>Parsed schedule</h2><i class="rule"></i>
    <span class="meta">${S.rows.length} ${ST.splitRounds?'rounds':'pairings'} across ${S.nights} nights</span></header>
    <div class="pb flush scroll-x"><table>
      <thead><tr><th>Week</th><th class="num">Round</th><th>Home lead</th><th>Away lead</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div style="display:flex;gap:6px;padding:11px 13px;border-top:1px solid var(--line);flex-wrap:wrap">
      <button class="gh" aria-pressed="true">Write ${S.nights} nights into the schedule</button>
      <button class="gh">Copy TSV</button><button class="gh">Download CSV</button></div>
    <div class="note" style="padding:0 13px 13px">Writing creates the nights with their leads, round type
      (<b>${esc(ST.splitRounds?'Single round leads':'Regular')}</b>) and dates set. Nights that already have results are left alone.</div></div>`;
};
