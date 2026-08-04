import base64, json
SC="/tmp/claude-0/-home-user-War-of-Rights-Event-Suite/8e5eb87e-a152-5fbc-9930-4245615f768c/scratchpad"
NM="/home/user/War-of-Rights-Event-Suite/season-tracker/node_modules/@fontsource-variable"
def face(fam, path):
    b64 = base64.b64encode(open(path,'rb').read()).decode()
    return (f"@font-face{{font-family:'{fam}';font-style:normal;font-display:block;font-weight:100 900;"
            f"src:url(data:font/woff2;base64,{b64}) format('woff2-variations');"
            "unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,"
            "U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}")
fonts = "\n".join([face("ST Sans", f"{NM}/geist/files/geist-latin-wght-normal.woff2"),
                   face("ST Mono", f"{NM}/geist-mono/files/geist-mono-latin-wght-normal.woff2")])
data = json.load(open(f"{SC}/data2.json"))
tpl = open(f"{SC}/v2.tpl.html").read()
out = tpl.replace("/*FONTS*/", fonts).replace("/*DATA*/", json.dumps(data, separators=(',',':')))
open(f"{SC}/season-tracker-overhaul.html","w").write(out)
print("bytes:", len(out.encode()), "=", round(len(out.encode())/1024/1024,2), "MB")
