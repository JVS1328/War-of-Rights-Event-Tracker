import json, collections, datetime
RAW = """1\tR1\t8th OH\tII Corps\t8/5/2026
1\tR2\tMSG\tFSB\t8/5/2026
2\tR1\t12th VA\t7th MI\t8/12/2026
2\tR2\t1st CS\t51st AL\t8/12/2026
3\tR1\t20th ME\tSussy\t9/2/2026
3\tR2\tCQB\tII Corps\t9/2/2026
4\tR1\tMSG\t5th NH\t8/26/2026
4\tR2\t51st AL\t9th LA\t8/26/2026
5\tR1\t1st CS\tJD\t8/19/2026
5\tR2\t10th US\t12th VA\t8/19/2026
6\tR1\t51st AL\t10th US\t9/9/2026
6\tR2\t8th OH\t5th NH\t9/9/2026
7\tR1\tFSB\t12th VA\t9/16/2026
7\tR2\tSussy\tJD\t9/16/2026
8\tR1\tCQB\t8th OH\t9/23/2026
8\tR2\t5th NH\t7th MI\t9/23/2026
9\tR1\t9th LA\t1st CS\t9/30/2026
9\tR2\tII Corps\tSussy\t9/30/2026
10\tR1\t7th MI\tMSG\t10/7/2026
10\tR2\tJD\t10th US\t10/7/2026
11\tR1\tII Corps\t20th ME\t10/14/2026
11\tR2\t9th LA\tCQB\t10/14/2026
12\tR1\tJD\t51st AL\t10/21/2026
12\tR2\t12th VA\tMSG\t10/21/2026
13\tR1\t5th NH\tFSB\t10/28/2026
13\tR2\t20th ME\t8th OH\t10/28/2026
14\tR1\tSussy\tCQB\t11/4/2026
14\tR2\t7th MI\t1st CS\t11/4/2026
15\tR1\t10th US\t9th LA\t11/11/2026
15\tR2\tFSB\t20th ME\t11/11/2026"""

rows=[]
for line in RAW.strip().split("\n"):
    wk,rd,home,away,date = [c.strip() for c in line.split("\t")]
    rows.append(dict(wk=int(wk), rd=int(rd[1]), home=home, away=away, date=date))

units=sorted({r['home'] for r in rows} | {r['away'] for r in rows})
S={u:dict(unit=u,total=0,home=0,away=0,r1=0,r2=0,homeR1=0,homeR2=0,awayR1=0,awayR2=0,weeks=[]) for u in units}
for r in rows:
    for side,u in (('home',r['home']),('away',r['away'])):
        e=S[u]; e['total']+=1; e[side]+=1; e[f'r{r["rd"]}']+=1
        e[f'{side}R{r["rd"]}']+=1; e['weeks'].append(r['wk'])

# target: 4 leads = 2 home + 2 away, each split 1x R1 / 1x R2
def verdict(e):
    bad=[]
    if e['total']!=4: bad.append(f"{e['total']} leads")
    if e['home']!=2 or e['away']!=2: bad.append(f"{e['home']}H/{e['away']}A")
    if e['homeR1']!=1 or e['homeR2']!=1: bad.append(f"home {e['homeR1']}×R1/{e['homeR2']}×R2")
    if e['awayR1']!=1 or e['awayR2']!=1: bad.append(f"away {e['awayR1']}×R1/{e['awayR2']}×R2")
    return bad
for u,e in S.items():
    e['issues']=verdict(e)
    e['ok']=not e['issues']
    w=sorted(e['weeks']); e['gaps']=[w[i+1]-w[i] for i in range(len(w)-1)]
    e['minGap']=min(e['gaps']) if e['gaps'] else None
    e['avgGap']=round(sum(e['gaps'])/len(e['gaps']),1) if e['gaps'] else None

# date ordering check
byWeek={}
for r in rows: byWeek[r['wk']]=r['date']
parsed={w:datetime.datetime.strptime(d,'%m/%d/%Y').date() for w,d in byWeek.items()}
outOfOrder=[w for w in sorted(parsed) if w>1 and parsed[w]<parsed[w-1]]
# repeat lead pairings
pairs=collections.Counter(tuple(sorted((r['home'],r['away']))) for r in rows)
repeats=[dict(a=k[0],b=k[1],n=v) for k,v in pairs.items() if v>1]
# same unit twice in one night
sameNight=[]
for wk in sorted({r['wk'] for r in rows}):
    ns=[r for r in rows if r['wk']==wk]
    seen=collections.Counter()
    for r in ns: seen[r['home']]+=1; seen[r['away']]+=1
    dup=[u for u,c in seen.items() if c>1]
    if dup: sameNight.append(dict(wk=wk, units=dup))

out=dict(raw=RAW, rows=rows, units=units,
  audit=sorted(S.values(), key=lambda e:(e['ok'], e['unit'])),
  ok=sum(1 for e in S.values() if e['ok']), total=len(units),
  outOfOrder=outOfOrder, dates={str(k):v for k,v in byWeek.items()},
  repeats=repeats, sameNight=sameNight,
  slots=len(rows)*2, nights=len({r['wk'] for r in rows}))
json.dump(out, open('sched.json','w'), separators=(',',':'))
print('units',len(units),'slots',len(rows)*2,'nights',out['nights'])
print('constraint pass', out['ok'],'/',out['total'])
for e in out['audit'][:6]:
    print(' ',e['unit'], e['total'],'leads', f"{e['home']}H/{e['away']}A",
          f"homeR1={e['homeR1']} homeR2={e['homeR2']} awayR1={e['awayR1']} awayR2={e['awayR2']}", e['issues'])
print('dates out of order at weeks:', outOfOrder)
print('repeat pairings:', repeats)
print('same unit twice in a night:', sameNight)
