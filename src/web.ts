import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { runScenario } from "./scenario"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

/**
 * Web entrypoint — the same engine as the CLI, rendered as a Slack-style
 * war-room in the browser:
 *   GET  /            → war-room page (dark chat UI)
 *   GET  /events      → Server-Sent Events stream of every bus row
 *   POST /decision    → {answer:"approve"|"reject"} resolves a pending human pause
 *   POST /run         → starts (or restarts) a fresh incident run
 *
 * Zero dependencies beyond @mozaik-ai/core — Node's built-in http.
 * The escalation pause surfaces in the UI as an ⏸ banner with two buttons;
 * nothing else in the engine changes.
 */

const PORT = Number(process.env.OPSROOM_PORT ?? 8787)

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpsRoom — #incident-war-room</title>
<style>
:root{--bg:#1a1d21;--pane:#191919;--hover:#222528;--text:#e8e8e8;--dim:#9a9ba0;--green:#2bac76;--red:#e85b5b;--amber:#e8a33d}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:"Segoe UI",system-ui,sans-serif;height:100vh;display:flex;overflow:hidden}
aside{width:230px;background:var(--pane);padding:12px;border-right:1px solid #000;flex-shrink:0;display:flex;flex-direction:column;gap:4px}
aside h1{font-size:15px;margin-bottom:10px;color:#fff}
.agent{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-size:13px;color:var(--dim)}
.agent.live{background:var(--hover);color:var(--text)}
.agent .dot{width:8px;height:8px;border-radius:50%;background:#555}
.agent.live .dot{background:var(--green)}
main{flex:1;display:flex;flex-direction:column}
header{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #000;background:var(--pane)}
header h2{font-size:15px}#mode{font-size:11px;color:var(--dim)}#run{margin-left:auto;background:var(--green);border:none;color:#fff;padding:7px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px}
#feed{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:2px}
.row{display:flex;gap:10px;padding:4px 8px;border-radius:6px;max-width:100%}
.row:hover{background:var(--hover)}
.row.t flare{color:var(--amber)}
.avatar{width:34px;height:34px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.meta{font-size:13px}.meta b{margin-right:6px}.meta time{color:var(--dim);font-size:11px}
.body{font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.row.risk .body{color:var(--red)}
.row.decision .body{color:var(--green);font-weight:600}
.why{margin-top:3px;font-size:12px;color:var(--amber);background:rgba(232,163,61,.09);border-left:3px solid var(--amber);padding:4px 8px;border-radius:0 4px 4px 0}
.escalation{margin:10px 0;padding:14px;border:1px solid var(--red);border-radius:10px;background:rgba(232,91,91,.07)}
.escalation h3{font-size:14px;color:var(--red);margin-bottom:6px}
.escalation p{font-size:13px;color:var(--text);margin-bottom:10px;white-space:pre-wrap}
.escalation button{padding:8px 18px;border:none;border-radius:6px;font-weight:700;cursor:pointer;margin-right:8px;font-size:13px}
#yes{background:var(--green);color:#fff}#no{background:transparent;border:1px solid var(--red);color:var(--red)}
#resolved{color:var(--green);font-weight:600}
.sys{text-align:center;color:var(--dim);font-size:12px;margin:6px 0}
.hold{border-left:3px solid var(--red)}.revise{border-left:3px solid var(--green)}
.system,.alert,.metric,.log,.deploy,.triage,.sleuth,.commander,.comms,.oncall{--unused:1}
@media(max-width:720px){aside{display:none}}
</style>
</head>
<body>
<aside id="sidebar"><h1>OpsRoom</h1></aside>
<main>
<header><h2># incident-war-room</h2><span id="mode"></span><button id="run">▶ Run again</button></header>
<div id="feed"><div class="sys">Starting scenario…</div></div>
</main>
<script>
const AGENTS={system:["⚙","#8892a5"],deploy:["🚀","#c98ee8"],alert:["🔔","#e8a33d"],metric:["📈","#54c7ec"],log:["📄","#9aa5b1"],triage:["🩺","#54c7ec"],sleuth:["🔍","#2bac76"],commander:["🎖","#e85b5b"],comms:["📣","#c98ee8"],oncall:["🙋","#ffd75e"]}
const WHY={HOLD:"An agent moved without proof — the referee held it until it cites confirmed evidence.",ESCALATION:"Two strikes ungrounded: automated review is over, the human decides.",decision:"The human verdict lands on the shared bus — every agent hears it.",signature:"Ground truth from raw logs, before any opinion forms.",default:"Parallel specialists negotiating on one bus — no orchestrator."}
let es,pending=null
const feed=document.getElementById("feed"),side=document.getElementById("sidebar")
function why(line){for(const k of["ESCALATION","HOLD"])if(line.includes(k))return WHY[k]
 if(/\[sleuth\].*error signature/.test(line))return WHY.signature
 if(/^\s*\[?(oncall\] human decision|✔)/.test(line))return WHY.decision
 return WHY.default}
function el(html){const t=document.createElement("template");t.innerHTML=html.trim();return t.content.firstChild}
function addRow(line){const m=line.match(/^(T\\+[\\d.]+s)?\\s*(?:\\[([a-z]+)\\])?\\s*(.*)$/)
 const who=m[2]||"system",body=(m[3]||line).replace(new RegExp("^\\\\["+who+"\\\\]\\\\s*"),"")
 const info=AGENTS[who]||AGENTS.system
 const cls=/HOLD|ESCALATION|⚠/.test(line)?"risk":/human decision|auto-review/.test(line)?"decision":""
 const r=el('<div class="row '+cls+'"><div class="avatar" style="background:'+info[1]+'22">'+info[0]+'</div><div><div class="meta"><b>'+who+'</b><time>'+((m[1]||"").replace(/^T\\+/,"+")||"")+'</time></div><div class="body"></div>'+(cls?"<div class='why'>"+why(line)+"</div>":"")+'</div></div>')
 r.querySelector(".body").textContent=body
 feed.appendChild(r);r.scrollIntoView({block:"end"});return r}
function addEscalation(text){pending=el('<div class="escalation"><h3>⏸ Human decision required</h3><p></p><button id="yes">Approve</button><button id="no">Reject</button></div>')
 pending.querySelector("p").textContent=text
 feed.appendChild(pending);pending.scrollIntoView({block:"center"})
 pending.querySelector("#yes").onclick=()=>decide(true);pending.querySelector("#no").onclick=()=>decide(false)}
function decide(approved){if(!pending)return;const n=pending;pending=null
 n.innerHTML='<h3>'+(approved?"✅ Approved":"⛔ Rejected")+' — sent to the room</h3>'
 fetch("/decision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answer:approved?"y":"n"})})}
function render(line){feed.querySelector(".sys")?.remove()
 addRow(line)}
function start(){es=new EventSource("/events")
 es.onmessage=(ev)=>{const d=JSON.parse(ev.data)
  if(d.type==="row")render(d.line)
  else if(d.type==="escalation")addEscalation(d.text)
  else if(d.type==="summary"){render("");const r=addRow("[comms] ✔ Run complete — "+d.line);r.classList.add("revise")}
  else if(d.type==="hello"){document.getElementById("mode").textContent=d.mode}}
 es.onerror=()=>{/* server restarting between runs */}}
document.getElementById("run").onclick=async()=>{await fetch("/run",{method:"POST"});}
start()
fetch("/agents").then(r=>r.json()).then(list=>{list.forEach(a=>{const i=AGENTS[a.id]||AGENTS.system
 side.insertAdjacentHTML("beforeend",'<div class="agent" id="ag-'+a.id+'"><span class="dot"></span><span>'+i[0]+'</span><span>'+a.name+" — "+a.role+"</span></div>")})})
// highlight whoever spoke most recently
new MutationObserver(()=>{}).observe(feed,{childList:true})
setInterval(()=>{},1<<30)
</script>
</body>
</html>`

// ---- per-run state ---------------------------------------------------------
let events: ServerResponse[] = []
let agentsSent = false
let busy = false
let pendingDecision: ((answer: string) => void) | null = null

const AGENT_INFO = [
	{ id: "deploy", name: "Telemetry", role: "production event feed" },
	{ id: "triage", name: "TriageAgent", role: "alerts + metrics specialist" },
	{ id: "sleuth", name: "LogSleuth", role: "raw-log analyst (uses tools)" },
	{ id: "commander", name: "RiskCommander", role: "interception & risk gate" },
	{ id: "oncall", name: "OnCallEngineer", role: "the human — final call" },
	{ id: "comms", name: "CommsAgent", role: "customer comms synthesis" },
	{ id: "scribe", name: "IncidentScribe", role: "history keeper" },
]

function broadcast(payload: unknown): void {
	for (const res of events) res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

async function startRun(): Promise<void> {
	if (busy) {
		broadcast({ type: "row", line: "[system] previous run still finishing — hold on…" })
		return
	}
	busy = true
	broadcast({ type: "reset" })
	try {
		await runScenario(
			{ interactive: true },
			{
				onLine: (line) => broadcast({ type: "row", line }),
				askHuman: (prompt) =>
					new Promise<string>((resolve) => {
						pendingDecision = resolve
						const escText = prompt.split("\n").filter(Boolean).slice(1).join("\n")
						broadcast({ type: "escalation", text: escText })
					}),
			},
		).then((result) => {
			broadcast({
				type: "summary",
				line: `summary → sleuth signatures: ${result.signatures}, triage findings: ${result.findings}, commander challenges: ${result.challenges}`,
			})
		})
	} finally {
		busy = false
		pendingDecision = null
	}
}

function handler(req: IncomingMessage, res: ServerResponse): void {
	const url = req.url ?? "/"
	if (url === "/") {
		res.writeHead(200, { "Content-Type": "text/html" })
		res.end(PAGE)
	} else if (url === "/events") {
		res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" })
		res.write(": connected\n\n")
		events.push(res)
		broadcast({
			type: "hello",
			mode: process.env.OPENAI_API_KEY ? "LLM mode (Ollama/OpenAI-compatible)" : "deterministic demo",
		})
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
			pendingDecision?.(answer || "n")
			res.writeHead(204).end()
		})
	} else if (url === "/run" && req.method === "POST") {
		void startRun()
		res.writeHead(202).end()
	} else if (url === "/agents") {
		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify(AGENT_INFO))
		agentsSent = true
	} else {
		res.writeHead(404).end()
	}
}

createServer(handler).listen(PORT, () => {
	console.log(`OpsRoom web console → http://localhost:${PORT}`)
	console.log("(open the URL, click ▶ Run again to launch a fresh incident)")
})
