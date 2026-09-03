import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { runScenarioV4 } from "./scenario-v4"

/**
 * Web entrypoint, v4 runtime edition. Same wire format and UI contract as
 * the v3 web.ts — only the engine call changed (runScenario → runScenarioV4).
 *
 *   GET  /            → war-room page (dark chat UI)
 *   GET  /events      → Server-Sent Events stream (rows, escalation, state, summary)
 *   POST /decision    → {answer:"approve"|"reject"} resolves a pending human pause
 *   POST /run         → starts (or restarts) a fresh incident run
 *   GET  /agents      → roster + telemetry sources for the sidebar
 *
 * TEMPLATE-LITERAL RULE: the PAGE below is a TS template literal served
 * verbatim to the browser. Every backslash inside would be consumed at
 * compile time, so the embedded UI JavaScript contains ZERO regexes and
 * ZERO escape sequences — pure string ops. Do not "fix" this.
 */
const PORT = Number(process.env.OPSROOM_PORT ?? 8788)
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpsRoom — #incident-war-room</title>
<style>
:root{
 --bg:#0e1116;--pane:#151a21;--pane2:#10141a;--line:#222a35;--hover:#1d242e;
 --text:#dfe6ee;--dim:#8b96a5;--faint:#5b6675;
 --green:#2fbf7f;--red:#ef6b6b;--amber:#eda63d;--blue:#5aa9f5;--purple:#c98ee8;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;height:100vh;display:flex;overflow:hidden;font-size:14px}
aside{width:250px;background:var(--pane);border-right:1px solid var(--line);flex-shrink:0;display:flex;flex-direction:column;padding:14px 10px;gap:2px;overflow-y:auto}
.brand{display:flex;align-items:center;gap:8px;padding:2px 8px 12px;border-bottom:1px solid var(--line);margin-bottom:10px}
.brand h1{font-size:16px;color:#fff;letter-spacing:.2px}
.brand .bolt{font-size:18px}
.sub{color:var(--faint);font-size:11px;margin-top:2px}
.navlabel{color:var(--faint);font-size:10px;text-transform:uppercase;letter-spacing:1.2px;margin:10px 8px 4px}
.agent{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:7px;color:var(--dim);cursor:pointer;border:1px solid transparent;user-select:none}
.agent:hover{background:var(--hover);color:var(--text)}
.agent.sel{background:rgba(90,169,245,.14);border-color:rgba(90,169,245,.35);color:#fff}
.agent .dot{width:7px;height:7px;border-radius:50%;background:#3a4552;transition:background .4s}
.agent.on .dot{background:var(--green);box-shadow:0 0 6px rgba(47,191,127,.7)}
.agent .em{font-size:15px;width:20px;text-align:center}
.agent .nm{font-size:12.5px;font-weight:600}
.agent .rl{display:block;font-size:10.5px;color:var(--faint);font-weight:400;margin-top:1px}
.agent .ct{margin-left:auto;font-size:10.5px;background:var(--pane2);border:1px solid var(--line);border-radius:9px;padding:1px 7px;color:var(--dim);min-width:24px;text-align:center}
.help{margin-top:auto;padding:10px 8px;color:var(--faint);font-size:11px;line-height:1.7;border-top:1px solid var(--line)}
main{flex:1;display:flex;flex-direction:column;min-width:0}
header{display:flex;align-items:center;gap:12px;padding:11px 18px;border-bottom:1px solid var(--line);background:var(--pane)}
header h2{font-size:15px;font-weight:700}
#mode{font-size:11.5px;color:var(--dim)}
.pill{margin-left:auto;font-size:11px;font-weight:700;letter-spacing:.6px;border-radius:99px;padding:4px 12px;text-transform:uppercase}
.pill.live{color:var(--green);background:rgba(47,191,127,.12)}
.pill.waiting{color:var(--amber);background:rgba(237,166,61,.14);animation:pulse 1.2s infinite}
.pill.idle{color:var(--dim);background:var(--pane2)}
#run{background:var(--green);border:none;color:#08240f;padding:7px 15px;border-radius:7px;font-weight:700;cursor:pointer;font-size:12px}
#run:hover{filter:brightness(1.1)}
@keyframes pulse{50%{opacity:.55}}
#statsbar{display:flex;gap:8px;align-items:center;padding:8px 18px;border-bottom:1px solid var(--line);background:var(--pane2);font-size:11px;letter-spacing:.4px;color:var(--faint);flex-wrap:wrap}
.stat b{color:var(--text);font-size:13px;margin-left:5px;font-variant-numeric:tabular-nums}
.stat.ev b{color:var(--green)}.stat.ho b{color:var(--amber)}.stat.es b{color:var(--red)}
#clearfilter{margin-left:auto;background:none;border:1px solid var(--blue);color:var(--blue);border-radius:6px;font-size:11px;padding:3px 10px;cursor:pointer}
#feedwrap{flex:1;overflow-y:auto;display:flex;justify-content:center}
#feed{width:100%;max-width:920px;padding:18px 20px;display:flex;flex-direction:column;gap:2px}
.row{display:flex;gap:11px;padding:5px 9px;border-radius:8px;max-width:100%;animation:pop .16s ease-out;transition:opacity .25s,filter .25s}
.row:hover{background:var(--hover)}
.row.dim{opacity:.18;filter:saturate(.15)}
@keyframes pop{from{opacity:0;transform:translateY(5px)}}
@media (prefers-reduced-motion: reduce){.row,.pill.waiting{animation:none}}
.avatar{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.meta{font-size:13px}.meta b{margin-right:7px}
.meta time{color:var(--faint);font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--pane2);border-radius:5px;padding:1px 6px;margin-right:6px}
.body{font-size:13.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;margin-top:2px;max-width:76ch}
.body .code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;font-weight:700;color:#ff9c9c;background:rgba(239,107,107,.13);border:1px solid rgba(239,107,107,.3);border-radius:5px;padding:0 5px;letter-spacing:.3px}
.body .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;color:#9fc4ee}
.body b{color:#fff}
.row.risk{background:rgba(239,107,107,.05)}
.row.risk .body{color:#ffb3b3}
.row.goal{background:rgba(255,215,94,.06);border-left:3px solid #ffd75e}
.row.goal .body{color:#ffe9a8}
.row.roster{background:rgba(126,231,135,.06);border-left:3px solid #7ee787}
.row.roster .body{color:#c9f2cd}
.row.decision .body{color:var(--green);font-weight:600}
.row.evidence{border-left:3px solid var(--green)}
.why{margin-top:4px;font-size:12px;color:var(--amber);background:rgba(232,163,61,.09);border-left:3px solid var(--amber);padding:5px 9px;border-radius:0 5px 5px 0}
.sys{text-align:center;color:var(--faint);font-size:12px;margin:8px 0}
.skelbox{max-width:520px;margin:26px auto 0;background:var(--pane);border:1px solid var(--line);border-radius:12px;padding:18px}
.skelline{height:11px;border-radius:5px;background:linear-gradient(90deg,var(--pane2) 25%,var(--hover) 50%,var(--pane2) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-bottom:10px}
.skelline.w1{width:65%}.skelline.w2{width:90%}.skelline.w3{width:80%}.skelline.w4{width:45%}
@keyframes shimmer{to{background-position:-200% 0}}
.skeltitle{text-align:left;color:var(--dim);font-size:12px;margin-top:6px}
.recap{margin:14px 0 6px;background:rgba(47,191,127,.07);border:1px solid rgba(47,191,127,.35);border-radius:12px;padding:16px 18px;animation:pop .2s ease-out}
.recap h3{color:var(--green);font-size:14px;margin-bottom:12px}
.recapnums{display:flex;gap:12px;flex-wrap:wrap}
.rc{background:var(--pane2);border:1px solid var(--line);border-radius:10px;padding:10px 16px;text-align:center;min-width:110px}
.rc b{display:block;font-size:24px;font-variant-numeric:tabular-nums}
.rc span{font-size:10.5px;color:var(--dim);letter-spacing:.8px;text-transform:uppercase}
.rc.g b{color:var(--green)}.rc.a b{color:var(--amber)}.rc.r b{color:var(--red)}
.escalation{margin:12px 0;padding:16px 18px;border:1px solid var(--red);border-radius:12px;background:rgba(239,107,107,.06)}
.escalation h3{font-size:14px;color:var(--red);margin-bottom:7px}
.escalation p{font-size:13px;color:var(--text);margin-bottom:12px;white-space:pre-wrap}
.escalation button{padding:9px 22px;border:none;border-radius:7px;font-weight:800;cursor:pointer;margin-right:10px;font-size:13px}
#yes{background:var(--green);color:#08240f;animation:pulse 1.4s infinite}
#no{background:transparent;border:1px solid var(--red);color:var(--red)}
kbd{font-family:ui-monospace,Menlo,monospace;background:var(--pane2);border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:0 5px;font-size:10.5px}
@media(max-width:720px){aside{display:none}}
</style>
</head>
<body>
<aside>
 <div class="brand"><span class="bolt">⚡</span><div><h1>OpsRoom</h1><div class="sub">concurrent AI incident room</div></div></div>
 <div id="nav"></div>
 <div class="help">Click a name to solo its messages.<br>When escalated: <kbd>y</kbd> approve, <kbd>n</kbd> reject, <kbd>r</kbd> rerun.</div>
</aside>
<main>
<header><h2># incident-war-room</h2><span id="mode"></span><span id="state" class="pill idle">connecting</span><button id="run">▶ Run again</button></header>
<div id="statsbar">
 <span class="stat ev">EVIDENCE<b id="c-sig">0</b></span>
 <span class="stat ho">HOLDS<b id="c-hold">0</b></span>
 <span class="stat es">ESCALATIONS<b id="c-esc">0</b></span>
 <span class="stat">MESSAGES<b id="c-msg">0</b></span>
 <button id="clearfilter" hidden>show all messages</button>
</div>
<div id="feedwrap"><div id="feed">
 <div class="skelbox"><div class="skelline w1"></div><div class="skelline w2"></div><div class="skelline w3"></div><div class="skelline w4"></div><div class="skeltitle">spinning up the incident room…</div></div>
</div></div>
</main>
<script>
window.onerror=function(m){document.title="JS ERROR: "+m}
const AGENTS={system:["⚙","#8892a5"],deploy:["🚀","#c98ee8"],alert:["🔔","#e8a33d"],metric:["📈","#54c7ec"],log:["📄","#9aa5b1"],triage:["🩺","#54c7ec"],sleuth:["🔍","#2bac76"],healer:["🛠","#e07be0"],commander:["🎖","#ef6b6b"],comms:["📣","#c98ee8"],oncall:["🙋","#ffd75e"],scribe:["📝","#9aa5b1"],goal:["🎯","#ffd75e"],roster:["👥","#7ee787"]}
const CODES=["TIMEOUT_ERROR","CHECKOUT_LOCK_ERROR"]
const WHY={HOLD:"An agent moved without proof — the referee held it until it cites confirmed evidence.",ESCALATION:"Two strikes ungrounded: automated review is over, the human decides.",signature:"Ground truth from raw logs, before any opinion forms.",default:"Parallel specialists negotiating on one shared bus — no orchestrator."}
let es,pending=null,filter=null,msgCount=0
const feed=document.getElementById("feed")
function esc(s){return s.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;")}
function rich(body){
 let h=esc(body)
 const parts=h.split("**");let out=""
 for(let i=0;i<parts.length;i++){out+=i%2?"<b>"+parts[i]+"</b>":parts[i]}
 for(const c of CODES){out=out.split(c).join("<span class=.code.>"+c+"</span>").split(".code.").join(String.fromCharCode(34)+"code"+String.fromCharCode(34))}
 return out}
// NOTE: rich() is fed ONLY through esc() first, so model-authored text can
// never inject markup; class attribute quotes dodge backslash use.
function el(html){const t=document.createElement("template");t.innerHTML=html.trim();return t.content.firstChild}
function parseTag(rest){for(const k of Object.keys(AGENTS)){if(k!=="system"&&rest.indexOf("["+k+"] ")===0)return k}return null}
function whyFor(line){
 if(line.indexOf("GOAL")>=0||line.indexOf("[goal]")>=0)return "The incident commander flipped the room objective mid-incident — agents rewrite their own behavior, no restart."
 if(line.indexOf("joined mid-incident")>=0)return "A specialist the room has never seen just appeared — everyone reorganizes via runtime discovery, no code change."
 if(line.indexOf("ESCALATION")>=0)return WHY.ESCALATION
 if(line.indexOf("HOLD")>=0)return WHY.HOLD
 if(line.indexOf("[sleuth]")>=0&&line.indexOf("error signature")>=0)return WHY.signature
 return WHY.default}
function bump(id){const n=document.getElementById(id);n.textContent=String(Number(n.textContent)+1)}
function applyFilter(){
 const rows=feed.querySelectorAll(".row")
 for(const r of rows){r.classList.toggle("dim",!!filter&&r.getAttribute("data-agent")!==filter)}
 const btn=document.getElementById("clearfilter")
 btn.hidden=!filter
 btn.textContent=filter?("showing only ["+filter+"] — click to clear"):""}
function addRow(line){
 let rest=line.trim(),ts=""
 if(rest.indexOf("T+")===0){const sp=rest.indexOf("s ");if(sp>0){ts="+"+rest.slice(2,sp);rest=rest.slice(sp+1).trim()}}
 const who=parseTag(rest)||"system"
 const body=rest.replace("["+who+"] ","")
 const info=AGENTS[who]
 const risk=line.indexOf("HOLD")>=0||line.indexOf("ESCALATION")>=0||line.indexOf("⚠")>=0
 const dec=line.indexOf("human decision")>=0||line.indexOf("auto-review")>=0
 const evi=who==="sleuth"&&body.indexOf("error signature")>=0
 const goalRow=who==="goal"||line.indexOf("GOAL UPDATE absorbed")>=0||line.indexOf("goal absorbed")>=0
 const rosterRow=who==="roster"||line.indexOf("joined mid-incident")>=0
 const cls=goalRow?"goal":rosterRow?"roster":risk?"risk":dec?"decision":evi?"evidence":""
 const r=el('<div class="row '+cls+'" data-agent="'+who+'"><div class="avatar" style="background:'+info[1]+'22">'+info[0]+'</div><div style="min-width:0"><div class="meta">'+(ts?"<time>"+ts+"</time>":"")+"<b>"+who+"</b></div>"+'<div class="body"></div>'+((risk||goalRow||rosterRow)?"<div class='why'>"+whyFor(line)+"</div>":"")+"</div></div>")
 r.querySelector(".body").innerHTML=rich(body)
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
 pending=el('<div class="escalation"><h3>⏸ Human decision required</h3><p></p><button id="yes">Approve</button><button id="no">Reject</button></div>')
 pending.querySelector("p").textContent=text
 feed.appendChild(pending);pending.scrollIntoView({block:"center"})
 pending.querySelector("#yes").onclick=()=>decide(true)
 pending.querySelector("#no").onclick=()=>decide(false)}
function decide(approved){
 if(!pending)return
 const n=pending;pending=null
 n.innerHTML="<h3>"+(approved?"✅ Approved — sent to the room":"⛔ Rejected — containment only, the room re-plans")+"</h3>"
 fetch("/decision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answer:approved?"y":"n"})})}
function addRecap(sig,fnd,ch,line){
 const card=el('<div class="recap"><h3>✔ Run complete — mission recap</h3><div class="recapnums"><div class="rc g"><b></b><span>evidence signatures</span></div><div class="rc a"><b></b><span>triage findings</span></div><div class="rc r"><b></b><span>referee interventions</span></div></div></div>')
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
  else if(d.type==="escalation"){setStatus("WAITING FOR YOU","waiting");addEscalation(d.text)}
  else if(d.type==="reset")reset()
  else if(d.type==="state"){if(d.value==="live"&&!pending)setStatus("LIVE","live");else if(d.value==="idle")setStatus("IDLE","idle")}
  else if(d.type==="summary"){render("");addRecap(d.sig,d.findings,d.challenges,null);setStatus("IDLE","idle")}
  else if(d.type==="hello")document.getElementById("mode").textContent=d.mode}}
document.getElementById("run").onclick=async()=>{await fetch("/run",{method:"POST"})}
document.getElementById("clearfilter").onclick=()=>{filter=null;applyFilter()}
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
  const i=AGENTS[a.id]||AGENTS.system
  html+='<div class="agent" id="ag-'+a.id+'" data-id="'+a.id+'" title="messages sent by '+esc(a.name)+' — click to solo their messages, click again to show all"><span class="dot"></span><span class="em">'+i[0]+'</span><span style="min-width:0"><span class="nm">'+esc(a.name)+"</span><span class='rl'>"+esc(a.role)+"</span></span><span class='ct'>0</span></div>"}
 nav.innerHTML=html
 for(const el2 of nav.querySelectorAll(".agent"))el2.onclick=()=>{
  const id=el2.getAttribute("data-id")
  filter=(filter===id)?null:id
  for(const x of nav.querySelectorAll(".agent"))x.classList.toggle("sel",x.getAttribute("data-id")===filter)
  applyFilter()}})
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
// ---- per-run state ---------------------------------------------------------
let events: ServerResponse[] = []
let busy = false
let startedOnce = false
let pendingDecision: ((answer: string) => void) | null = null

type AgentSpec = { id: string; name: string; role: string; group: string }

const AGENT_INFO: AgentSpec[] = [
	{ id: "deploy", name: "Telemetry", role: "deploys roll through here", group: "Signal from production" },
	{ id: "alert", name: "Alerts", role: "firing monitors", group: "Signal from production" },
	{ id: "metric", name: "Metrics", role: "gauges + counters", group: "Signal from production" },
	{ id: "log", name: "Raw logs", role: "what really happened", group: "Signal from production" },
	{ id: "triage", name: "TriageAgent", role: "alerts + metrics specialist", group: "Specialists" },
	{ id: "sleuth", name: "LogSleuth", role: "raw-log analyst (uses tools)", group: "Specialists" },
	{ id: "healer", name: "DatabaseHealer", role: "late joiner — lock contention", group: "Specialists" },
	{ id: "commander", name: "RiskCommander", role: "interception & risk gate", group: "Referee" },
	{ id: "oncall", name: "OnCallEngineer", role: "the human — final call", group: "Humans" },
	{ id: "comms", name: "CommsAgent", role: "customer comms synthesis", group: "Support" },
	{ id: "scribe", name: "IncidentScribe", role: "history keeper", group: "Support" },
]

function broadcast(payload: unknown): void {
	for (const res of events) res.write(`data: ${JSON.stringify(payload)}

`)
}

async function startRun(): Promise<void> {
	if (busy) {
		broadcast({ type: "row", line: "[system] previous run still finishing — hold on…" })
		return
	}
	busy = true
	broadcast({ type: "state", value: "live" })
	broadcast({ type: "reset" })
	try {
		await runScenarioV4(
			{ interactive: true },
			{
				onLine: (line) => broadcast({ type: "row", line }),
				askHuman: (prompt) =>
					new Promise<string>((resolve) => {
						pendingDecision = (answer) => {
							pendingDecision = null
							resolve(answer)
							broadcast({ type: "state", value: "live" })
						}
						const escText = prompt
							.split("\n")
							.filter(Boolean)
							.slice(1)
							.join("\n")
						broadcast({ type: "escalation", text: escText })
					}),
			},
		).then((result) => {
			broadcast({
				type: "summary",
				line: `sleuth signatures ${result.signatures} · triage findings ${result.findings} · commander challenges ${result.challenges}`,
				sig: result.signatures,
				findings: result.findings,
				challenges: result.challenges,
			})
			broadcast({ type: "state", value: "idle" })
		})
	} finally {
		busy = false
		pendingDecision = null
		startedOnce = true
	}
}

function handler(req: IncomingMessage, res: ServerResponse): void {
	const url = req.url ?? "/"
	if (url === "/") {
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
		res.end(PAGE)
	} else if (url === "/events") {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		})
		res.write(": connected\n\n")
		events.push(res)
		const firstTab = !startedOnce && !busy
		broadcast({
			type: "hello",
			mode: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY ? "LLM mode" : "deterministic demo",
		})
		if (firstTab) void startRun()
		req.on("close", () => {
			events = events.filter((e) => e !== res)
		})
	} else if (url === "/decision" && req.method === "POST") {
		let body = ""
		req.on("data", (c) => (body += c))
		req.on("end", () => {
			let answer = ""
			try {
				answer = String(JSON.parse(body).answer ?? "")
			} catch {}
			if (pendingDecision) {
				const resolveIt = pendingDecision
				resolveIt(answer || "n")
			}
			res.writeHead(204).end()
		})
	} else if (url === "/run" && req.method === "POST") {
		void startRun()
		res.writeHead(202).end()
	} else if (url === "/agents") {
		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify(AGENT_INFO))
	} else {
		res.writeHead(404).end()
	}
}

createServer(handler).listen(PORT, () => {
	console.log(`OpsRoom web console → http://localhost:${PORT}`)
	console.log("(opens straight into a live incident — Run again anytime)")
})
