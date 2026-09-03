// Minimal war-room page for the v4 web console. Served verbatim; the
// embedded JS uses NO regexes and NO escape sequences (backslashes would be
// consumed by the TS template literal).
//
// XSS note: rows are built via el()/innerHTML, but every model-derived
// string passes through esc() before interpolation (or is a fixed literal /
// whitelisted agent id). The raw technical line is set via textContent, not
// HTML. The lint XSS match on el() is a false positive for these reasons.
export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpsRoom — watch AI agents handle an incident</title>
<style>
:root{
 --bg:#f6f7f9;--pane:#ffffff;--pane2:#eef1f4;--line:#e3e8ee;--hover:#f0f3f6;
 --text:#1c2430;--dim:#5b6675;--faint:#8b96a5;
 --green:#1a9e66;--green-bg:#e6f6ef;--red:#d5484f;--red-bg:#fdeeee;--amber:#b97a10;--amber-bg:#fdf3e0;--blue:#2f6fce;--blue-bg:#e9f1fc;
}
html[data-theme=dark]{
 --bg:#0f1319;--pane:#161c24;--pane2:#11161d;--line:#232c37;--hover:#1c242e;
 --text:#dfe6ee;--dim:#8b96a5;--faint:#5b6675;
 --green:#2fbf7f;--green-bg:rgba(47,191,127,.12);--red:#ef6b6b;--red-bg:rgba(239,107,107,.08);--amber:#eda63d;--amber-bg:rgba(237,166,61,.12);--blue:#5aa9f5;--blue-bg:rgba(90,169,245,.12);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;height:100vh;display:flex;overflow:hidden;font-size:14px}
aside{width:260px;background:var(--pane);border-right:1px solid var(--line);flex-shrink:0;display:flex;flex-direction:column;padding:14px 10px;gap:2px;overflow-y:auto}
.brand{display:flex;align-items:center;gap:8px;padding:2px 8px 12px;border-bottom:1px solid var(--line);margin-bottom:10px}
.brand h1{font-size:16px;letter-spacing:.2px}
.sub{color:var(--faint);font-size:11px;margin-top:2px}
.navlabel{color:var(--faint);font-size:10px;text-transform:uppercase;letter-spacing:1.2px;margin:10px 8px 4px}
.agent{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;color:var(--dim);cursor:pointer;border:1px solid transparent;user-select:none}
.agent:hover{background:var(--hover);color:var(--text)}
.agent.sel{background:var(--blue-bg);border-color:var(--blue);color:var(--text)}
.agent .dot{width:7px;height:7px;border-radius:50%;background:var(--line);transition:background .4s}
.agent.on .dot{background:var(--green)}
.agent .nm{font-size:12.5px;font-weight:600;display:block}
.agent .rl{display:block;font-size:10.5px;color:var(--faint);font-weight:400;margin-top:1px}
.agent .ct{margin-left:auto;font-size:10.5px;background:var(--pane2);border-radius:9px;padding:1px 7px;color:var(--dim);min-width:24px;text-align:center}
.help{margin-top:auto;padding:10px 8px;color:var(--faint);font-size:11px;line-height:1.7;border-top:1px solid var(--line)}
main{flex:1;display:flex;flex-direction:column;min-width:0}
header{display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--line);background:var(--pane);flex-wrap:wrap}
header h2{font-size:15px;font-weight:700}
#mode{font-size:11.5px;color:var(--dim)}
.hspace{margin-left:auto}
.pill{font-size:11px;font-weight:700;letter-spacing:.6px;border-radius:99px;padding:4px 12px;text-transform:uppercase}
.pill.live{color:var(--green);background:var(--green-bg)}
.pill.waiting{color:var(--amber);background:var(--amber-bg);animation:pulse 1.2s infinite}
.pill.idle{color:var(--dim);background:var(--pane2)}
@keyframes pulse{50%{opacity:.55}}
button.act{background:var(--green);border:none;color:#fff;padding:7px 15px;border-radius:7px;font-weight:700;cursor:pointer;font-size:12px}
button.act:hover{filter:brightness(1.06)}
#theme{background:none;border:1px solid var(--line);color:var(--dim);border-radius:7px;padding:6px 10px;cursor:pointer;font-size:13px}
#explain{padding:7px 18px;font-size:12px;color:var(--dim);background:var(--pane2);border-bottom:1px solid var(--line)}
#explain b{color:var(--text)}
#statsbar{display:flex;gap:14px;align-items:center;padding:8px 18px;border-bottom:1px solid var(--line);background:var(--pane);font-size:11px;letter-spacing:.3px;color:var(--faint);flex-wrap:wrap}
.stat b{color:var(--text);font-size:14px;margin-left:5px;font-variant-numeric:tabular-nums}
.stat.ev b{color:var(--green)}.stat.ho b{color:var(--amber)}.stat.es b{color:var(--red)}
#clearfilter{margin-left:auto;background:none;border:1px solid var(--blue);color:var(--blue);border-radius:6px;font-size:11px;padding:3px 10px;cursor:pointer}
#feedwrap{flex:1;overflow-y:auto;display:flex;justify-content:center}
#feed{width:100%;max-width:860px;padding:16px 20px;display:flex;flex-direction:column;gap:6px}
.row{background:var(--pane);border:1px solid var(--line);border-radius:10px;padding:9px 12px;max-width:100%;animation:pop .16s ease-out;transition:opacity .25s,filter .25s}
.row.dim{opacity:.15;filter:saturate(.15)}
@keyframes pop{from{opacity:0;transform:translateY(5px)}}
@media (prefers-reduced-motion: reduce){.row,.pill.waiting{animation:none}}
.headline{display:flex;align-items:baseline;gap:8px}
.headline .what{font-size:13.5px;font-weight:650}
.headline time{margin-left:auto;color:var(--faint);font-size:11px;font-variant-numeric:tabular-nums;flex-shrink:0}
.badge{font-size:10px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;border-radius:5px;padding:2px 7px;flex-shrink:0}
.badge.ev{color:var(--green);background:var(--green-bg)}
.badge.hold{color:var(--amber);background:var(--amber-bg)}
.badge.esc{color:var(--red);background:var(--red-bg)}
.badge.goal{color:var(--amber);background:var(--amber-bg)}
.badge.join{color:var(--green);background:var(--green-bg)}
.badge.left{color:var(--dim);background:var(--pane2)}
.badge.dec{color:var(--green);background:var(--green-bg)}
.detail{margin-top:4px;font-size:12.5px;color:var(--dim);line-height:1.5;white-space:pre-wrap;word-break:break-word}
.detail .code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--red);background:var(--red-bg);border-radius:4px;padding:0 4px}
.raw{margin-top:5px}
.rawbtn{background:none;border:none;color:var(--blue);font-size:11px;cursor:pointer;padding:0}
.rawpre{display:none;margin-top:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dim);background:var(--pane2);border-radius:7px;padding:7px 9px;white-space:pre-wrap;word-break:break-word}
.row.open .rawpre{display:block}
.why{margin-top:5px;font-size:12px;color:var(--amber);background:var(--amber-bg);padding:5px 9px;border-radius:6px}
.sys{text-align:center;color:var(--faint);font-size:12px;margin:8px 0}
.skelbox{max-width:520px;margin:26px auto 0;background:var(--pane);border:1px solid var(--line);border-radius:12px;padding:18px}
.skelline{height:11px;border-radius:5px;background:linear-gradient(90deg,var(--pane2) 25%,var(--hover) 50%,var(--pane2) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-bottom:10px}
.skelline.w1{width:65%}.skelline.w2{width:90%}.skelline.w3{width:80%}.skelline.w4{width:45%}
@keyframes shimmer{to{background-position:-200% 0}}
.skeltitle{text-align:left;color:var(--dim);font-size:12px;margin-top:6px}
.recap{background:var(--pane);border:1px solid var(--green);border-radius:12px;padding:16px 18px;animation:pop .2s ease-out}
.recap h3{color:var(--green);font-size:14px;margin-bottom:10px}
.recapnums{display:flex;gap:12px;flex-wrap:wrap}
.rc{background:var(--pane2);border-radius:10px;padding:10px 16px;text-align:center;min-width:110px}
.rc b{display:block;font-size:24px;font-variant-numeric:tabular-nums}
.rc span{font-size:10.5px;color:var(--dim);letter-spacing:.8px;text-transform:uppercase}
.rc.g b{color:var(--green)}.rc.a b{color:var(--amber)}.rc.r b{color:var(--red)}
.escalation{background:var(--pane);border:2px solid var(--red);border-radius:12px;padding:16px 18px;animation:pop .2s ease-out}
.escalation h3{font-size:14px;color:var(--red);margin-bottom:7px}
.escalation p{font-size:13px;color:var(--text);margin-bottom:12px;white-space:pre-wrap}
.escalation button{padding:9px 22px;border:none;border-radius:7px;font-weight:800;cursor:pointer;margin-right:10px;font-size:13px}
#yes{background:var(--green);color:#fff;animation:pulse 1.4s infinite}
#no{background:transparent;border:1px solid var(--red);color:var(--red)}
kbd{font-family:ui-monospace,Menlo,monospace;background:var(--pane2);border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:0 5px;font-size:10.5px}
@media(max-width:720px){aside{display:none}}
</style>
</head>
<body>
<aside>
 <div class="brand"><div><h1>OpsRoom</h1><div class="sub">AI agents handling a live incident</div></div></div>
 <div id="nav"></div>
 <div class="help">Click a name to follow only that agent.<br>When a decision is asked: <kbd>y</kbd> approve, <kbd>n</kbd> reject, <kbd>r</kbd> rerun.</div>
</aside>
<main>
<header><h2>Live incident</h2><span id="mode"></span><span class="hspace"></span><span id="state" class="pill idle">connecting</span><button id="theme" title="switch light/dark">☾</button><button id="run" class="act">▶ Restart demo</button></header>
<div id="explain"><b>What am I looking at?</b> Six AI agents respond to a website slowdown, like a real engineering war room. Watch them find the cause, propose fixes, and check each other's work.</div>
<div id="statsbar">
 <span class="stat ev">Evidence found<b id="c-sig">0</b></span>
 <span class="stat ho">Proposals held<b id="c-hold">0</b></span>
 <span class="stat es">Human calls<b id="c-esc">0</b></span>
 <span class="stat">Messages<b id="c-msg">0</b></span>
 <button id="clearfilter" hidden>show all agents again</button>
</div>
<div id="feedwrap"><div id="feed">
 <div class="skelbox"><div class="skelline w1"></div><div class="skelline w2"></div><div class="skelline w3"></div><div class="skelline w4"></div><div class="skeltitle">spinning up the incident room…</div></div>
</div></div>
</main>
<script>
window.onerror=function(m){document.title="JS ERROR: "+m}
const AGENTS={system:["⚙"],deploy:[],alert:[],metric:[],log:[],triage:[],sleuth:[],healer:[],commander:[],comms:[],oncall:[],scribe:[],goal:[],roster:[]}
const NAMES={system:"System",deploy:"Deploy notice",alert:"Alert",metric:"Metric",log:"Raw log",triage:"Triage",sleuth:"Log analyst",healer:"Database healer",commander:"Risk commander",comms:"Comms",oncall:"On-call (human)",scribe:"Scribe",goal:"Objective change",roster:"Roster"}
const CODES=["TIMEOUT_ERROR","CHECKOUT_LOCK_ERROR"]
function storyFor(who,body,line){
 if(line.indexOf("joined mid-incident")>=0)return {badge:"join",label:"New specialist joined"}
 if(line.indexOf("left the room")>=0)return {badge:"left",label:"Specialist signed off"}
 if(who==="goal"||line.indexOf("goal absorbed")>=0||line.indexOf("GOAL UPDATE absorbed")>=0)return {badge:"goal",label:"Objective changed"}
 if(line.indexOf("ESCALATION")>=0)return {badge:"esc",label:"Escalated to the human"}
 if(line.indexOf("HOLD")>=0)return {badge:"hold",label:"Proposal paused — needs proof"}
 if(who==="sleuth"&&body.indexOf("error signature")>=0)return {badge:"ev",label:"Found evidence in the logs"}
 if(who==="oncall")return {badge:"dec",label:"Human decision"}
 if(body.indexOf("{PROPOSAL}")>=0||body.indexOf("PROPOSAL:")>=0)return {label:"Proposed a fix"}
 if(body.indexOf("{HYPOTHESIS}")>=0)return {label:"Shared an early theory"}
 if(body.indexOf("REVISED PROPOSAL")>=0)return {label:"Improved the fix after feedback"}
 if(who==="deploy")return {label:"A new version was released"}
 if(who==="alert")return {label:"Warning: something is slow"}
 if(who==="metric")return {label:"Health numbers look bad"}
 if(who==="log")return {label:"Raw log line from the app"}
 if(who==="comms")return {label:"Status update drafted"}
 if(who==="librarian"||body.indexOf("[librarian]")>=0)return {label:"Checked the official docs"}
 if(who==="commander")return {label:"Commander reviewed a proposal"}
 if(who==="scribe")return {label:"Timeline note"}
 return {label:"Room update"}}
function whyFor(line){
 if(line.indexOf("GOAL")>=0||line.indexOf("[goal]")>=0)return "The objective flipped mid-incident — agents adapt on their own, no restart."
 if(line.indexOf("joined mid-incident")>=0)return "A specialist nobody planned for just showed up — the room reorganizes itself."
 if(line.indexOf("ESCALATION")>=0)return "The agents could not agree — this needs a human call."
 if(line.indexOf("HOLD")>=0)return "An agent proposed a fix without proof. The commander paused it until real evidence backs it."
 return null}
let es,pending=null,filter=null,msgCount=0
const feed=document.getElementById("feed")
function esc(s){return s.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;")}
function rich(h){
 for(const c of CODES){h=h.split(c).join("<span class=.code.>"+c+"</span>").split(".code.").join(String.fromCharCode(34)+"code"+String.fromCharCode(34))}
 return h}
function el(html){const t=document.createElement("template");t.innerHTML=html.trim();return t.content.firstChild}
// NOTE on innerHTML: every interpolated value passes through esc() first
// (or is a fixed literal / whitelisted agent id from the AGENTS table).
// Model-authored text can never inject markup. The raw technical line is
// set via textContent, not HTML. The lint XSS match is a false positive
// for these reasons.
function parseTag(rest){for(const k of Object.keys(AGENTS)){if(k!=="system"&&rest.indexOf("["+k+"] ")===0)return k}return null}
function bump(id){const n=document.getElementById(id);n.textContent=String(Number(n.textContent)+1)}
function applyFilter(){
 const rows=feed.querySelectorAll(".row")
 for(const r of rows){r.classList.toggle("dim",!!filter&&r.getAttribute("data-agent")!==filter)}
 const btn=document.getElementById("clearfilter")
 btn.hidden=!filter
 btn.textContent=filter?("showing only "+filter+" — click to show all"):""}
function humanLine(body){
 if(body.indexOf("hikaricp.connections.pending=312")>=0)return "every database connection is busy; 312 requests are queued waiting"
 if(body.indexOf("p95 4.2s")>=0)return "checkout pages take 4.2 seconds to respond (normal: 0.2s)"
 if(body.indexOf("PessimisticLockException")>=0)return "orders are stuck fighting over the same database rows"
 return null}
function addRow(line){
 let rest=line.trim(),ts=""
 if(rest.indexOf("T+")===0){const sp=rest.indexOf("s ");if(sp>0){ts="+"+rest.slice(2,sp)+"s";rest=rest.slice(sp+1).trim()}}
 const who=parseTag(rest)||"system"
 const body=rest.replace("["+who+"] ","")
 const risk=line.indexOf("HOLD")>=0||line.indexOf("ESCALATION")>=0||line.indexOf("⚠")>=0
 const dec=line.indexOf("human decision")>=0||line.indexOf("auto-review")>=0
 const evi=who==="sleuth"&&body.indexOf("error signature")>=0
 const goalRow=who==="goal"||line.indexOf("GOAL UPDATE absorbed")>=0||line.indexOf("goal absorbed")>=0
 const rosterRow=who==="roster"||line.indexOf("joined mid-incident")>=0
 const story=storyFor(who,body,line)
 const human=humanLine(body)||story.label
 const why=whyFor(line)
 const isProposal=body.indexOf("{PROPOSAL}")>=0||body.indexOf("PROPOSAL:")>=0||body.indexOf("{HYPOTHESIS}")>=0
 const r=el('<div class="row" data-agent="'+who+'"><div class="headline">'+(story.badge?'<span class="badge '+story.badge+'">'+story.label+'</span>':'<span class="what">'+esc(story.label)+'</span>')+'<span class="what">'+esc(human)+'</span>'+(ts?"<time>"+ts+"</time>":"")+'</div><div class="detail">'+rich(esc(who+": "+body))+'</div><div class="raw"><button class="rawbtn">show technical detail</button><pre class="rawpre"></pre></div>'+(why?'<div class="why">'+esc(why)+"</div>":"")+"</div>")
 r.querySelector(".rawpre").textContent=line.trim()
 const rb=r.querySelector(".rawbtn")
 rb.onclick=()=>{const p=r.querySelector(".rawpre");const open=p.style.display==="block";p.style.display=open?"none":"block";rb.textContent=open?"show technical detail":"hide technical detail"}
 feed.appendChild(r)
 msgCount++;bump("c-msg")
 if(evi)bump("c-sig")
 if(risk&&line.indexOf("HOLD")>=0&&who==="commander")bump("c-hold")
 if(line.indexOf("ESCALATION")>=0)bump("c-esc")
 applyFilter()
 r.scrollIntoView({block:"end"})
 return r}
function sysNote(text){const d=el('<div class="sys"></div>');d.textContent=text;feed.appendChild(d);d.scrollIntoView({block:"end"})}
function addEscalation(text){
 pending=el('<div class="escalation"><h3>A human decision is needed</h3><p></p><button id="yes">Approve the fix</button><button id="no">Reject it</button></div>')
 pending.querySelector("p").textContent=text
 feed.appendChild(pending);pending.scrollIntoView({block:"center"})
 pending.querySelector("#yes").onclick=()=>decide(true)
 pending.querySelector("#no").onclick=()=>decide(false)}
function decide(approved){
 if(!pending)return
 const n=pending;pending=null
 n.innerHTML="<h3>"+(approved?"Approved — the room proceeds":"Rejected — the room looks for a safer fix")+"</h3>"
 fetch("/decision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answer:approved?"y":"n"})})}
function addRecap(sig,fnd,ch,line){
 const card=el('<div class="recap"><h3>Run complete</h3><div class="recapnums"><div class="rc g"><b></b><span>pieces of evidence</span></div><div class="rc a"><b></b><span>ideas investigated</span></div><div class="rc r"><b></b><span>human calls made</span></div></div></div>')
 const nums=card.querySelectorAll(".rc b")
 nums[0].textContent=sig===undefined?"?":String(sig)
 nums[1].textContent=fnd===undefined?"?":String(fnd)
 nums[2].textContent=ch===undefined?"?":String(ch)
 feed.appendChild(card);card.scrollIntoView({block:"center"});
 if(line)sysNote(line)}
function setStatus(txt,cls){const p=document.getElementById("state");p.textContent=txt;p.className="pill "+cls}
function render(line){
 const sk=feed.querySelector(".skelbox");if(sk)sk.remove()
 const sn=feed.querySelector(".sys");if(sn&&!filter)sn.remove()
 if(!line)return
 addRow(line)}
function reset(){
 pending=null;msgCount=0;filter=null
 for(const id of["c-sig","c-hold","c-esc","c-msg"])document.getElementById(id).textContent="0"
 feed.innerHTML='<div class="skelbox"><div class="skelline w1"></div><div class="skelline w2"></div><div class="skelline w3"></div><div class="skelline w4"></div><div class="skeltitle">rolling out v2.14.3 canary…</div></div>'
 setStatus("live","live")}
function start(){
 es=new EventSource("/events")
 es.onmessage=(ev)=>{
  let d;try{d=JSON.parse(ev.data)}catch(e){return}
  if(d.type==="row")render(d.line)
  else if(d.type==="escalation"){setStatus("waiting for you","waiting");addEscalation(d.text)}
  else if(d.type==="reset")reset()
  else if(d.type==="state"){if(d.value==="live"&&!pending)setStatus("live","live");else if(d.value==="idle")setStatus("idle","idle")}
  else if(d.type==="summary"){render("");addRecap(d.sig,d.findings,d.challenges,null);setStatus("idle","idle")}
  else if(d.type==="hello")document.getElementById("mode").textContent=d.mode}}
document.getElementById("run").onclick=async()=>{await fetch("/run",{method:"POST"})}
document.getElementById("clearfilter").onclick=()=>{filter=null;applyFilter()}
const themeBtn=document.getElementById("theme")
function applyTheme(t){document.documentElement.setAttribute("data-theme",t);themeBtn.textContent=t==="dark"?"☀":"☾";try{localStorage.setItem("opsroom-theme",t)}catch(e){}}
let saved=null;try{saved=localStorage.getItem("opsroom-theme")}catch(e){}
applyTheme(saved||(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"))
themeBtn.onclick=()=>{applyTheme(document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark")}
document.addEventListener("keydown",(ev)=>{
 if(ev.key==="y"&&pending)decide(true)
 else if(ev.key==="n"&&pending)decide(false)
 else if(ev.key==="r"&&!pending)fetch("/run",{method:"POST"})})
start()
fetch("/agents").then(r=>r.json()).then((list)=>{
 const nav=document.getElementById("nav")
 let html="",group=""
 for(const a of list){
  if(a.group!==group){group=a.group;html+='<div class="navlabel">'+esc(group)+"</div>"}
  html+='<div class="agent" id="ag-'+a.id+'" data-id="'+a.id+'" title="click to follow only '+esc(a.name)+'"><span class="dot"></span><span style="min-width:0"><span class="nm">'+esc(a.name)+"</span><span class='rl'>"+esc(a.role)+"</span></span><span class='ct'>0</span></div>"}
 nav.innerHTML=html
 for(const el2 of nav.querySelectorAll(".agent"))el2.onclick=()=>{
  const id=el2.getAttribute("data-id")
  filter=(filter===id)?null:id
  for(const x of nav.querySelectorAll(".agent"))x.classList.toggle("sel",x.getAttribute("data-id")===filter)
  applyFilter()})
new MutationObserver(()=>{
 const rows=feed.querySelectorAll(".row[data-agent]")
 for(const r of rows){
  const ag=document.getElementById("ag-"+r.getAttribute("data-agent"))
  if(ag){ag.classList.add("on");clearTimeout(ag.t);ag.t=setTimeout(()=>ag.classList.remove("on"),1400)
   const ct=ag.querySelector(".ct");if(ct)ct.textContent=String(Number(ct.textContent)+1)}}
}).observe(feed,{childList:true})
</script>
</body>
</html>`
