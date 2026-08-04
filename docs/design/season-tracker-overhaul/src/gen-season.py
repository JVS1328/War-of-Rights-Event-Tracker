import json, random, collections, math
random.seed(19)
SC="/tmp/claude-0/-home-user-War-of-Rights-Event-Suite/8e5eb87e-a152-5fbc-9930-4245615f768c/scratchpad"
S=json.load(open('/home/user/War-of-Rights-Event-Suite/SSL Season 3.json'))
PS=S['pointSystem']; NON=set(S['nonTokenUnits']); TOK=[u for u in S['units'] if u not in NON]
WEEKS=S['weeks']; DIV=S['divisions']

# ── standings, exactly as SeasonTracker computes them ────────────────────────
st={u:dict(points=0,leadWins=0,leadLosses=0,assistWins=0,assistLosses=0) for u in TOK}
for w in WEEKS:
    if not w.get('round1Winner') and not w.get('round2Winner'): continue
    po=w.get('isPlayoffs',False); srl=w.get('isSingleRoundLeads',False)
    for rn in (1,2):
        win=w.get(f'round{rn}Winner')
        if not win: continue
        A,B=w['teamA'],w['teamB']
        wt,lt=(A,B) if win=='A' else (B,A)
        if po or srl:
            lw=w.get(f'lead{win}_r{rn}'); ll=w.get(f"lead{'B' if win=='A' else 'A'}_r{rn}")
        else:
            lw=w.get(f'lead{win}'); ll=w.get(f"lead{'B' if win=='A' else 'A'}")
        for u in wt:
            if u not in st: continue
            if u==lw: st[u]['leadWins']+=1;  st[u]['points']+= 0 if po else PS['winLead']
            else:     st[u]['assistWins']+=1; st[u]['points']+= 0 if po else PS['winAssist']
        for u in lt:
            if u not in st: continue
            if u==ll: st[u]['leadLosses']+=1;  st[u]['points']+= 0 if po else PS['lossLead']
            else:     st[u]['assistLosses']+=1; st[u]['points']+= 0 if po else PS['lossAssist']
    if not po and w.get('round1Winner') and w['round1Winner']==w.get('round2Winner'):
        sw=w['round1Winner']; team=set(w['teamA'] if sw=='A' else w['teamB'])
        lead=w.get(f'lead{sw}')
        for u in team:
            if u not in st: continue
            st[u]['points'] += PS['bonus2_0Lead'] if u==lead else PS['bonus2_0Assist']
for u,v in S.get('manualAdjustments',{}).items():
    if u in st: st[u]['points']+=v
divOf={u:d['name'] for d in DIV for u in d['units']}
standings=sorted([dict(unit=u,div=divOf.get(u,'—'),**v,
                       w=v['leadWins']+v['assistWins'], l=v['leadLosses']+v['assistLosses'])
                  for u,v in st.items()], key=lambda r:(-r['points'], -r['w']))
for i,r in enumerate(standings):
    r['pos']=i+1
    r['wr']=round(100*r['w']/max(1,r['w']+r['l']))

# ── weeks for the schedule view ──────────────────────────────────────────────
weeks=[]
for i,w in enumerate(WEEKS):
    weeks.append(dict(id=str(w['id']), n=i+1, name=w['name'],
        playoffs=bool(w.get('isPlayoffs')),
        a=w['teamA'], b=w['teamB'], leadA=w.get('leadA'), leadB=w.get('leadB'),
        r1=w.get('round1Winner'), r2=w.get('round2Winner'),
        m1=w.get('round1Map'), m2=w.get('round2Map'),
        f1=bool(w.get('round1Flipped')), f2=bool(w.get('round2Flipped')),
        casA=[w.get('r1CasualtiesA'),w.get('r2CasualtiesA')],
        casB=[w.get('r1CasualtiesB'),w.get('r2CasualtiesB')]))

# ── map usage / balance from the real weeks ──────────────────────────────────
mp=collections.defaultdict(lambda: dict(played=0,aWins=0,bWins=0))
for w in WEEKS:
    for rn in (1,2):
        m=w.get(f'round{rn}Map'); win=w.get(f'round{rn}Winner')
        if not m: continue
        e=mp[m]; e['played']+=1
        if win=='A': e['aWins']+=1
        elif win=='B': e['bWins']+=1
maps=sorted([dict(map=m,**v,bal=round(100*v['aWins']/max(1,v['aWins']+v['bWins'])))
             for m,v in mp.items()], key=lambda r:-r['played'])

# ── playoff bracket from the real playoff weeks ──────────────────────────────
po=[w for w in WEEKS if w.get('isPlayoffs')]
bracket=[dict(name=w['name'],
              a=w.get('leadA') or (w['teamA'][0] if w['teamA'] else '—'),
              b=w.get('leadB') or (w['teamB'][0] if w['teamB'] else '—'),
              r1=w.get('round1Winner'), r2=w.get('round2Winner'),
              m1=w.get('round1Map'), m2=w.get('round2Map')) for w in po]

# ── synthetic scoreboards on the REAL units, bound to the last 8 weeks ───────
RANK=['Pvt','Cpl','Sgt','Lt','Cpt']
FIRST=["Halloway","Prentiss","Renshaw","Ashcroft","Bexley","Cordell","Vandermeer","Whitlock","Ferris","Grady",
       "Lunsford","Merrick","Oakes","Pemberton","Quill","Rutherford","Sable","Thackeray","Underhill","Vance",
       "Wexler","Yardley","Zane","Abbot","Barlow","Crenshaw","Hardtack","Ironside","Marlowe","Ridgeway",
       "Calhoun","Delacroix","Beauchamp","Sturgis","Kessler","Bramble","Fisk","Ogden","Trimble","Wren",
       "Alden","Boone","Chandler","Doyle","Ellery","Foxe","Garrity","Hobbs","Innis","Jarrow",
       "Keane","Lowry","Mabry","Nettles","Orme","Pike","Quimby","Rourke","Stark","Tolliver",
       "Upton","Varley","Wick","Yarrow","Ames","Byrne","Croft","Dunmore","Ewing","Falk",
       "Gault","Hesper","Isley","Judd","Kern","Larkin","Moss","Nash","Ott","Pryor",
       "Rees","Snell","Tate","Vogel"]
CAUSES=[("Minie",56),("Melee",21),("Canister",8),("Shell",7),("Pistol",4),("Round Shot",4)]
W={'in_form':1,'skirm':3,'oob':5}
pool=[]; i=0
for u in TOK:
    for _ in range(6):
        pool.append(dict(sid=str(76561198000000000+i*911+7717), unit=u,
                         name=f"[{u.replace(' ','')}]{random.choice(RANK)}.{FIRST[i%len(FIRST)]}",
                         skill=random.uniform(.5,2.5))); i+=1
byUnit=collections.defaultdict(list)
for p in pool: byUnit[p['unit']].append(p)

P=collections.defaultdict(lambda: dict(rounds=0,k=0,d=0,dif=0,dsk=0,dob=0,kif=0,ksk=0,kob=0,
                                       kc=collections.Counter(),dc=collections.Counter(),log=[]))
R=collections.defaultdict(lambda: dict(rounds=0,k=0,d=0,pf=0,men=set(),dif=0,dsk=0,dob=0,kif=0,ksk=0,kob=0,
                                       tdi=0,tdr=0,shares=[],sharesR=[]))
roundsOut=[]; matchups=[]
for w in WEEKS[-8:]:
    for rn in (1,2):
        win=w.get(f'round{rn}Winner'); mapn=w.get(f'round{rn}Map')
        if not win or not mapn: continue
        flip=bool(w.get(f'round{rn}Flipped'))
        sideUSA = 'B' if flip else 'A'
        teams={'USA': w['teamA'] if sideUSA=='A' else w['teamB'],
               'CSA': w['teamB'] if sideUSA=='A' else w['teamA']}
        winFaction = 'USA' if win==sideUSA else 'CSA'
        cas={}; wep={'USA':collections.Counter(),'CSA':collections.Counter()}
        rows={'USA':[],'CSA':[]}; units={'USA':[],'CSA':[]}
        agg={'USA':collections.Counter(),'CSA':collections.Counter()}
        dur=random.randint(1080,2160)
        for fac,uns in teams.items():
            adv = 1.2 if fac==winFaction else .82
            c=dict(inForm=0,skirm=0,oob=0)
            for u in uns:
                if u not in byUnit: continue
                men=random.sample(byUnit[u], random.randint(3,6))
                ua=collections.Counter()
                for p in men:
                    k=max(0,int(random.gauss(5.5*p['skill']*adv,2.6)))
                    d=max(0,int(random.gauss(5.5/max(p['skill'],.45)/adv,2.0)))
                    df=[0,0,0]
                    for _ in range(d): df[random.choices([0,1,2],weights=[5,3,2])[0]]+=1
                    kf=[0,0,0]
                    for _ in range(k): kf[random.choices([0,1,2],weights=[5,3,2])[0]]+=1
                    kc=collections.Counter(); dc=collections.Counter()
                    for _ in range(k): kc[random.choices([c0 for c0,_ in CAUSES],weights=[wt for _,wt in CAUSES])[0]]+=1
                    for _ in range(d):
                        cz=random.choices([c0 for c0,_ in CAUSES],weights=[wt for _,wt in CAUSES])[0]
                        dc[cz]+=1; wep[fac][cz]+=1
                    e=P[p['sid']]; e['name']=p['name']; e['unit']=u; e['rounds']+=1
                    e['k']+=k; e['d']+=d; e['dif']+=df[0]; e['dsk']+=df[1]; e['dob']+=df[2]
                    e['kif']+=kf[0]; e['ksk']+=kf[1]; e['kob']+=kf[2]
                    e['kc'].update(kc); e['dc'].update(dc)
                    td=(df[0]+3*df[1]+5*df[2])/d if d else None
                    tk=(kf[0]+3*kf[1]+5*kf[2])/k if k else None
                    e['log'].append(dict(week=w['name'],rd=rn,map=mapn,team=fac,k=k,d=d,
                        kd=round(k/d,2) if d else float(k), td=round(td,1) if td else None,
                        tk=round(tk,1) if tk else None, win=(fac==winFaction)))
                    rows[fac].append(dict(name=p['name'],unit=u,k=k,d=d,kd=round(k/d,2) if d else float(k)))
                    ua.update(dict(k=k,d=d,n=1,dif=df[0],dsk=df[1],dob=df[2],kif=kf[0],ksk=kf[1],kob=kf[2]))
                    r=R[u]; r['k']+=k; r['d']+=d; r['pf']+=1; r['men'].add(p['sid'])
                    r['dif']+=df[0]; r['dsk']+=df[1]; r['dob']+=df[2]
                    r['kif']+=kf[0]; r['ksk']+=kf[1]; r['kob']+=kf[2]
                    c['inForm']+=df[0]; c['skirm']+=df[1]; c['oob']+=df[2]
                    agg[fac].update(dict(k=k,d=d,n=1))
                if ua['n']:
                    units[fac].append(dict(unit=u,k=ua['k'],d=ua['d'],n=ua['n'],
                        tdi=ua['kif']+3*ua['ksk']+5*ua['kob'], tdr=ua['dif']+3*ua['dsk']+5*ua['dob'],
                        kd=round(ua['k']/ua['d'],2) if ua['d'] else float(ua['k'])))
                    R[u]['rounds']+=1
            c['total']=c['inForm']+c['skirm']+c['oob']; cas[fac]=c
        for fac in ('USA','CSA'):
            ti=sum(u['tdi'] for u in units[fac]) or 1; tr=sum(u['tdr'] for u in units[fac]) or 1
            for u in units[fac]:
                u['tdiPct']=round(100*u['tdi']/ti); u['tdrPct']=round(100*u['tdr']/tr)
                R[u['unit']]['shares'].append(u['tdiPct']); R[u['unit']]['sharesR'].append(u['tdrPct'])
            units[fac].sort(key=lambda x:-x['tdi'])
            rows[fac].sort(key=lambda x:-x['k'])
        m=dict(week=w['name'], wk=WEEKS.index(w)+1, rd=rn, map=mapn, winner=winFaction, dur=dur,
               playoffs=bool(w.get('isPlayoffs')), flipped=flip,
               sideA=sideUSA, leadUSA=(w.get('leadA') if sideUSA=='A' else w.get('leadB')),
               leadCSA=(w.get('leadB') if sideUSA=='A' else w.get('leadA')),
               cas=cas, weapons={f:dict(v) for f,v in wep.items()},
               top={f:rows[f][:8] for f in rows}, units=units,
               pop=dict(peak=sum(agg[f]['n'] for f in agg)))
        matchups.append(m)
        roundsOut.append(dict(week=w['name'],rd=rn,map=mapn,winner=winFaction,
            players=m['pop']['peak'], dur=dur, playoffs=m['playoffs'],
            casUSA=cas['USA']['total'], casCSA=cas['CSA']['total']))

def td(e): return round((e['dif']+3*e['dsk']+5*e['dob'])/e['d'],1) if e['d'] else None
def tk(e): return round((e['kif']+3*e['ksk']+5*e['kob'])/e['k'],1) if e['k'] else None
lb=[]
for sid,e in P.items():
    if e['rounds']==0: continue
    lb.append(dict(id=sid,name=e['name'],unit=e['unit'],rounds=e['rounds'],k=e['k'],d=e['d'],
        kd=round(e['k']/e['d'],2) if e['d'] else float(e['k']), td=td(e), tk=tk(e),
        kpr=round(e['k']/e['rounds'],1), dpr=round(e['d']/e['rounds'],1),
        dif=e['dif'],dsk=e['dsk'],dob=e['dob'],kif=e['kif'],ksk=e['ksk'],kob=e['kob'],
        kc=dict(e['kc'].most_common(6)), dc=dict(e['dc'].most_common(6)),
        log=e['log'][::-1]))
lb.sort(key=lambda r:-r['k'])
regs=[]
for u,e in R.items():
    if not e['rounds']: continue
    regs.append(dict(unit=u,rounds=e['rounds'],men=len(e['men']),avg=round(e['pf']/e['rounds'],1),
        k=e['k'],d=e['d'],kd=round(e['k']/e['d'],2) if e['d'] else 0,
        kr=round(e['k']/e['pf'],2), lr=round(e['d']/e['pf'],2), td=td(e), tk=tk(e),
        tdi=round(sum(e['shares'])/len(e['shares'])) if e['shares'] else 0,
        tdr=round(sum(e['sharesR'])/len(e['sharesR'])) if e['sharesR'] else 0,
        dif=e['dif'],dsk=e['dsk'],dob=e['dob'],kif=e['kif'],ksk=e['ksk'],kob=e['kob'],
        div=divOf.get(u,'—'),
        top=sorted([p for p in lb if p['unit']==u], key=lambda p:-p['k'])[:5]))
regs.sort(key=lambda r:-r['kd'])

out=dict(season=dict(name='SSL Season 3', event='Sunday Skirmish League',
        units=len(TOK), weeks=len(WEEKS), regular=len([w for w in WEEKS if not w.get('isPlayoffs')]),
        divisions=[d['name'] for d in DIV],
        roundsImported=len(roundsOut), roundsPlayed=sum(1 for w in WEEKS for rn in (1,2) if w.get(f'round{rn}Winner')),
        players=len(lb), kills=sum(r['k'] for r in lb),
        pointSystem=PS, elo=S['eloSystem'], teamNames=S['teamNames']),
    standings=standings, weeks=weeks, maps=maps, bracket=bracket,
    leaderboard=lb, regiments=regs, rounds=roundsOut, matchups=matchups,
    divisions=[dict(name=d['name'],units=[u for u in d['units'] if u in st]) for d in DIV])
json.dump(out,open(f"{SC}/data2.json","w"),separators=(',',':'))
import os; print('bytes',os.path.getsize(f"{SC}/data2.json"))
print('standings top5',[(r['pos'],r['unit'],r['points'],f"{r['w']}-{r['l']}",r['div']) for r in standings[:5]])
print('players',len(lb),'regs',len(regs),'rounds',len(roundsOut))
print('maps top3',maps[:3])
print('bracket',bracket)
