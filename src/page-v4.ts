// OpsRoom War Room v4 Web Console
// Served verbatim as a TS template literal.
// CONSTRAINT: Embedded JS uses NO regexes and NO escape sequences (backslashes
// are consumed by the TS template literal parser). String ops only.
// XSS: Model-derived strings pass through esc() before HTML interpolation.
export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpsRoom — Multi-Agent Autonomous Incident War Room</title>
<style>
:root{
 --bg:#f4f6fa;--pane:#ffffff;--pane2:#f8fafc;--pane3:#edf2f7;--line:#e2e8f0;--line-subtle:#edf2f7;
 --hover:#f1f5f9;--text:#0f172a;--dim:#475569;--faint:#94a3b8;
 --primary:#0284c7;--primary-bg:#e0f2fe;
 --green:#059669;--green-bg:#ecfdf5;--green-border:#a7f3d0;
 --amber:#d97706;--amber-bg:#fffbeb;--amber-border:#fde68a;
 --red:#dc2626;--red-bg:#fef2f2;--red-border:#fecaca;
 --blue:#2563eb;--blue-bg:#eff6ff;--blue-border:#bfdbfe;
 --violet:#7c3aed;--violet-bg:#f5f3ff;--violet-border:#ddd6fe;
 --teal:#0d9488;--teal-bg:#f0fdfa;--teal-border:#99f6e4;
 --gold:#b45309;--gold-bg:#fef3c7;--gold-border:#fde68a;
 --shadow-sm:0 1px 2px rgba(0,0,0,.05);
 --shadow-md:0 4px 6px -1px rgba(0,0,0,.08),0 2px 4px -2px rgba(0,0,0,.04);
}
html[data-theme=dark]{
 --bg:#0b0f17;--pane:#121824;--pane2:#172030;--pane3:#1e293b;--line:#222f44;--line-subtle:#182234;
 --hover:#1a2538;--text:#f1f5f9;--dim:#94a3b8;--faint:#64748b;
 --primary:#38bdf8;--primary-bg:rgba(56,189,248,.12);
 --green:#34d399;--green-bg:rgba(52,211,153,.12);--green-border:rgba(52,211,153,.25);
 --amber:#fbbf24;--amber-bg:rgba(251,191,36,.12);--amber-border:rgba(251,191,36,.25);
 --red:#f87171;--red-bg:rgba(248,113,113,.12);--red-border:rgba(248,113,113,.25);
 --blue:#60a5fa;--blue-bg:rgba(96,165,250,.12);--blue-border:rgba(96,165,250,.25);
 --violet:#c084fc;--violet-bg:rgba(192,132,252,.12);--violet-border:rgba(192,132,252,.25);
 --teal:#2dd4bf;--teal-bg:rgba(45,212,191,.12);--teal-border:rgba(45,212,191,.25);
 --gold:#facc15;--gold-bg:rgba(250,204,21,.12);--gold-border:rgba(250,204,21,.25);
 --shadow-sm:0 1px 3px rgba(0,0,0,.3);
 --shadow-md:0 6px 16px rgba(0,0,0,.45);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;height:100vh;display:flex;overflow:hidden;font-size:13.5px;line-height:1.45}

/* Sidebar */
/* Sidebar - Ultra Compact (Zero Scroll) */
aside{width:260px;background:var(--pane);border-right:1px solid var(--line);flex-shrink:0;display:flex;flex-direction:column;padding:8px 8px;gap:1px;height:100vh;box-sizing:border-box;overflow:hidden}
.brand{display:flex;align-items:center;gap:8px;padding:2px 4px 6px;border-bottom:1px solid var(--line);margin-bottom:2px}
.brand-icon{width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#0284c7,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:12px;box-shadow:0 1px 4px rgba(2,132,199,.3)}
.brand-title{font-size:13.5px;font-weight:800;letter-spacing:-.2px;color:var(--text)}
.roster-status{margin-left:auto;display:flex;align-items:center;gap:5px;font-size:9.5px;font-weight:700;color:var(--dim);background:var(--pane2);border:1px solid var(--line);border-radius:6px;padding:2px 6px}
.roster-pulse{width:5.5px;height:5.5px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green)}
#nav{display:flex;flex-direction:column;gap:1px;min-height:0}
.navlabel{color:var(--faint);font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:4px 6px 1px}
.agent{display:flex;align-items:center;gap:7px;padding:2px 6px;border-radius:6px;color:var(--faint);cursor:pointer;border:1px solid transparent;transition:all .15s ease;user-select:none;opacity:.55;min-height:24px}
.agent:hover{background:var(--hover);color:var(--text);opacity:1}
.agent.used{opacity:1;color:var(--text);background:var(--pane2);border-color:var(--line);box-shadow:0 1px 2px rgba(0,0,0,.03)}
.agent.used .nm{color:var(--text);font-weight:700}
.agent.used .rl{color:var(--dim)}
.agent.used .dot{background:var(--green);box-shadow:0 0 6px rgba(16,185,129,.7)}
.agent.used .ct{background:var(--primary-bg);color:var(--primary);border-color:var(--primary);font-weight:800}
.agent.on{border-color:var(--primary);box-shadow:0 0 10px rgba(14,165,233,.35);background:var(--hover);opacity:1}
.agent.on .dot{background:var(--primary);box-shadow:0 0 8px var(--primary);transform:scale(1.25)}
.agent.sel{background:var(--primary);border-color:var(--primary);color:#fff!important;font-weight:700;opacity:1}
.agent.sel .nm,.agent.sel .rl{color:#fff!important}
.agent.sel .dot{background:#fff;box-shadow:0 0 6px #fff}
.agent.sel .ct{background:#fff;color:var(--primary);border-color:#fff;font-weight:800}
.agent .em{font-size:13px;width:17px;text-align:center;flex-shrink:0}
.agent .dot{width:5.5px;height:5.5px;border-radius:50%;background:var(--line);transition:all .2s ease;flex-shrink:0}
.agent .nm{font-size:11.5px;font-weight:600;display:block;color:inherit;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agent .rl{display:block;font-size:9px;color:var(--faint);font-weight:400;margin-top:0.5px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agent .ct{margin-left:auto;font-size:9px;background:var(--pane2);border:1px solid var(--line);border-radius:8px;padding:0 5px;color:var(--dim);min-width:16px;text-align:center;font-variant-numeric:tabular-nums;font-weight:600;transition:all .2s ease}
.help{margin-top:auto;padding:5px 7px;color:var(--faint);font-size:9.5px;line-height:1.2;border-top:1px solid var(--line);background:var(--pane2);border-radius:6px;display:flex;align-items:center;justify-content:center;white-space:nowrap}

/* Main Area */
main{flex:1;display:flex;flex-direction:column;min-width:0;height:100%}

/* Header */
header{display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--line);background:var(--pane);flex-wrap:wrap}
.header-title-group{display:flex;align-items:baseline;gap:8px}
.header-title{font-size:16px;font-weight:800;letter-spacing:-.2px}
.live-pill{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.5px;border-radius:99px;padding:3px 10px;text-transform:uppercase}
.live-pill .pulsing-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.live-pill.live{color:var(--green);background:var(--green-bg);border:1px solid var(--green-border)}
.live-pill.live .pulsing-dot{animation:dotpulse 1.4s infinite}
.live-pill.waiting{color:var(--amber);background:var(--amber-bg);border:1px solid var(--amber-border);animation:dotpulse 1.1s infinite}
.live-pill.idle{color:var(--dim);background:var(--pane2);border:1px solid var(--line)}
@keyframes dotpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.25)}}
#mode-tag{font-size:11px;padding:2px 8px;border-radius:6px;background:var(--pane2);border:1px solid var(--line);color:var(--dim);font-weight:600}
.hspace{margin-left:auto}
.btn-header{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:7px;font-weight:700;cursor:pointer;font-size:12px;transition:all .15s}
#run{background:linear-gradient(135deg,#059669,#10b981);border:none;color:#fff;box-shadow:0 2px 6px rgba(5,150,105,.3)}
#run:hover{filter:brightness(1.08);transform:translateY(-1px)}
#theme{background:none;border:1px solid var(--line);color:var(--dim);padding:6px 11px;font-size:13px}
#theme:hover{background:var(--hover);color:var(--text)}

/* Incident HUD (Heads-Up Display) */
.hud{display:flex;align-items:stretch;gap:12px;padding:8px 20px;background:var(--pane2);border-bottom:1px solid var(--line);flex-wrap:wrap}
.hud-item{display:flex;flex-direction:column;gap:2px;padding:4px 12px;background:var(--pane);border:1px solid var(--line);border-radius:7px;min-width:140px}
.hud-k{font-size:9.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--faint)}
.hud-v{font-size:12px;font-weight:700;color:var(--text);display:flex;align-items:baseline;gap:5px}
.hud-v .sub{font-size:11px;color:var(--faint);font-weight:400}
.hud-v.alert{color:var(--red)}
.hud-v.warn{color:var(--amber)}
.hud-grow{flex:1;min-width:280px}
.hud-directive{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--text)}
.hud-directive-badge{font-size:10px;font-weight:800;padding:2px 7px;border-radius:5px;background:var(--amber-bg);color:var(--amber);border:1px solid var(--amber-border);text-transform:uppercase;letter-spacing:.5px}
.hud-directive.pivot .hud-directive-badge{background:var(--gold-bg);color:var(--gold);border-color:var(--gold-border);animation:dotpulse 1.8s infinite}

/* Incident Lifecycle Stepper */
.stepper{display:flex;align-items:center;padding:10px 20px;background:var(--pane);border-bottom:1px solid var(--line);gap:8px;overflow-x:auto}
.step{display:flex;align-items:center;gap:7px;padding:4px 10px;border-radius:8px;background:var(--pane2);border:1px solid var(--line);font-size:11.5px;color:var(--dim);transition:all .2s;white-space:nowrap}
.step-num{width:18px;height:18px;border-radius:50%;background:var(--line);color:var(--dim);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800}
.step-name{font-weight:600}
.step-arrow{color:var(--faint);font-size:10px;margin:0 -2px}
.step.active{background:var(--primary-bg);border-color:var(--primary);color:var(--text);box-shadow:var(--shadow-sm)}
.step.active .step-num{background:var(--primary);color:#fff}
.step.done{background:var(--green-bg);border-color:var(--green-border);color:var(--text)}
.step.done .step-num{background:var(--green);color:#fff}

/* Filter & Stats Bar */
.control-bar{display:flex;align-items:center;gap:12px;padding:8px 20px;background:var(--pane2);border-bottom:1px solid var(--line);flex-wrap:wrap}
.tabs{display:flex;gap:4px;background:var(--pane);padding:2px;border-radius:8px;border:1px solid var(--line)}
.tab{background:none;border:none;padding:5px 12px;border-radius:6px;font-size:11.5px;font-weight:600;color:var(--dim);cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s}
.tab:hover{color:var(--text);background:var(--hover)}
.tab.sel{background:var(--pane2);color:var(--text);font-weight:700;box-shadow:var(--shadow-sm);border:1px solid var(--line)}
.tab .badge-count{font-size:10px;background:var(--line);color:var(--dim);border-radius:8px;padding:0 5px;font-weight:700}
.stats-summary{margin-left:auto;display:flex;gap:14px;align-items:center;font-size:11px;color:var(--faint);letter-spacing:.3px}
.stat-pill{display:flex;align-items:baseline;gap:5px}
.stat-pill b{color:var(--text);font-size:13px;font-variant-numeric:tabular-nums}
.stat-pill.ev b{color:var(--green)}
.stat-pill.ho b{color:var(--amber)}
.stat-pill.es b{color:var(--red)}
#clearfilter{background:none;border:1px solid var(--primary);color:var(--primary);border-radius:6px;font-size:11px;padding:3px 10px;cursor:pointer;font-weight:600}
#clearfilter:hover{background:var(--primary-bg)}

/* Feed Area */
#feedwrap{flex:1;overflow-y:auto;display:flex;justify-content:center;padding:16px 20px;background:var(--bg)}
#feed{width:100%;max-width:880px;display:flex;flex-direction:column;gap:10px}

/* Event Rows / Cards */
.row{display:flex;gap:10px;max-width:100%;animation:cardpop .18s ease-out;position:relative}
.row.dim{opacity:.12;filter:saturate(.1)}
.row.hidden{display:none}
@keyframes cardpop{from{opacity:0;transform:translateY(6px)}}
@media (prefers-reduced-motion: reduce){.row,.live-pill.waiting,.live-pill.live .pulsing-dot{animation:none}}

.card{flex:1;background:var(--pane);border:1px solid var(--line);border-radius:10px;padding:12px 16px;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:7px;transition:border-color .2s,box-shadow .2s;min-width:0}
.card:hover{border-color:var(--primary);box-shadow:var(--shadow-md)}

/* Category Left Border Accents */
.card.cat-evidence{border-left:4px solid var(--green)}
.card.cat-safety{border-left:4px solid var(--amber)}
.card.cat-directive{border-left:4px solid var(--gold);background:linear-gradient(90deg,var(--gold-bg) 0%,var(--pane) 18%)}
.card.cat-specialist{border-left:4px solid var(--teal)}
.card.cat-telemetry{border-left:4px solid var(--line)}

/* Search & Jump Controls */
#search-box{background:var(--pane);border:1px solid var(--line);border-radius:6px;padding:4px 10px;font-size:11.5px;color:var(--text);outline:none;width:160px;transition:all .2s}
#search-box:focus{border-color:var(--primary);width:210px;box-shadow:0 0 0 2px var(--primary-bg)}
.jump-btn{position:fixed;bottom:24px;right:28px;z-index:100;background:var(--pane);border:1px solid var(--primary);color:var(--primary);font-size:12px;font-weight:700;border-radius:20px;padding:7px 16px;box-shadow:var(--shadow-md);cursor:pointer;display:inline-flex;align-items:center;gap:6px;animation:cardpop .2s ease-out}
.jump-btn:hover{background:var(--primary);color:#fff}

/* Formatted Content Callouts */
.prop-callout{background:var(--blue-bg);border:1px solid var(--blue-border);border-radius:8px;padding:9px 12px;margin-top:2px}
.prop-lead{font-size:10px;font-weight:800;color:var(--blue);text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.prop-action{font-size:13px;font-weight:600;color:var(--text);line-height:1.5}

.evidence-callout{background:var(--green-bg);border:1px solid var(--green-border);border-radius:8px;padding:9px 12px;margin-top:2px}
.ev-label{font-size:10px;font-weight:800;color:var(--green);text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.ev-text{font-size:12.5px;color:var(--text);line-height:1.5}

.challenge-callout{background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:8px;padding:9px 12px;margin-top:2px}
.ch-label{font-size:10px;font-weight:800;color:var(--amber);text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.ch-text{font-size:12.5px;font-weight:600;color:var(--text);line-height:1.5}

.status-broadcast{background:var(--pane2);border:1px solid var(--line);border-radius:8px;padding:10px 14px;display:flex;flex-direction:column;gap:8px;margin-top:2px}
.sb-main{font-size:13px;color:var(--text);line-height:1.55}
.sb-steps{background:var(--pane);border:1px solid var(--line);border-radius:7px;padding:9px 12px}
.sb-steps-title{font-size:10px;font-weight:800;color:var(--primary);letter-spacing:.7px;margin-bottom:6px;text-transform:uppercase}
.sb-list{list-style:none;display:flex;flex-direction:column;gap:5px}
.sb-list li{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--dim);line-height:1.4}
.step-check{color:var(--green);font-weight:800;font-size:13px;flex-shrink:0}

/* Card Header */
.card-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.card-avatar{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;background:var(--pane2);border:1px solid var(--line)}
.card-author{font-size:12.5px;font-weight:700;color:var(--text);display:flex;align-items:baseline;gap:6px}
.card-role{font-size:11px;font-weight:400;color:var(--faint)}
.badge{font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;border-radius:5px;padding:2px 7px;display:inline-flex;align-items:center;gap:4px;flex-shrink:0}
.badge.ev{color:var(--green);background:var(--green-bg);border:1px solid var(--green-border)}
.badge.hold{color:var(--amber);background:var(--amber-bg);border:1px solid var(--amber-border)}
.badge.esc{color:var(--red);background:var(--red-bg);border:1px solid var(--red-border)}
.badge.goal{color:var(--gold);background:var(--gold-bg);border:1px solid var(--gold-border)}
.badge.join{color:var(--teal);background:var(--teal-bg);border:1px solid var(--teal-border)}
.badge.left{color:var(--dim);background:var(--pane2);border:1px solid var(--line)}
.badge.prop{color:var(--blue);background:var(--blue-bg);border:1px solid var(--blue-border)}
.badge.hypo{color:var(--violet);background:var(--violet-bg);border:1px solid var(--violet-border)}
.badge.dec{color:var(--green);background:var(--green-bg);border:1px solid var(--green-border)}
.badge.telemetry{color:var(--dim);background:var(--pane2);border:1px solid var(--line)}
.hud-timer{font-size:11px;font-weight:700;color:var(--primary);background:var(--primary-bg);border:1px solid var(--primary);border-radius:6px;padding:2px 8px;font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.time-badge{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:var(--dim);background:var(--pane2);border:1px solid var(--line);border-radius:6px;padding:2px 7px;font-variant-numeric:tabular-nums;font-family:ui-monospace,Menlo,monospace;letter-spacing:.3px;flex-shrink:0}
.time-badge .t-rel{color:var(--primary);font-weight:700}
.time-badge .t-sep{color:var(--faint);opacity:.6}
.time-badge .t-clock{color:var(--faint);font-weight:500}

/* Plain Language Headline */
.headline{font-size:13.5px;font-weight:700;color:var(--text);line-height:1.4}
.headline.evidence{color:var(--green)}
.headline.hold{color:var(--amber)}
.headline.escalation{color:var(--red)}

/* Content Detail */
.detail{font-size:12.5px;color:var(--dim);line-height:1.5;white-space:pre-wrap;word-break:break-word}
.code{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--red);background:var(--red-bg);border:1px solid var(--red-border);border-radius:4px;padding:0 5px;font-weight:600}
.code-green{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--green);background:var(--green-bg);border:1px solid var(--green-border);border-radius:4px;padding:0 5px;font-weight:600}

/* Proposal Chips */
.prop-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.pchip{font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:5px;border:1px solid var(--line);background:var(--pane2);color:var(--dim)}
.pchip.readonly{background:var(--green-bg);color:var(--green);border-color:var(--green-border)}
.pchip.targeted{background:var(--amber-bg);color:var(--amber);border-color:var(--amber-border)}
.pchip.ev-yes{background:var(--teal-bg);color:var(--teal);border-color:var(--teal-border)}
.pchip.ev-no{background:var(--red-bg);color:var(--red);border-color:var(--red-border)}

/* Why It Matters Callout */
.why-box{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border-radius:7px;background:var(--amber-bg);border:1px solid var(--amber-border);font-size:12px;color:var(--amber);line-height:1.45}
.why-box.green{background:var(--green-bg);border-color:var(--green-border);color:var(--green)}
.why-box.gold{background:var(--gold-bg);border-color:var(--gold-border);color:var(--gold)}
.why-icon{font-size:14px;flex-shrink:0}

/* Technical Inspector Toggle */
.raw-drawer{margin-top:2px;border-top:1px dashed var(--line);padding-top:5px}
.rawbtn{background:none;border:none;color:var(--primary);font-size:11px;cursor:pointer;padding:0;font-weight:600;display:inline-flex;align-items:center;gap:4px}
.rawbtn:hover{text-decoration:underline}
.rawpre{display:none;margin-top:5px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--dim);background:var(--pane2);border:1px solid var(--line);border-radius:6px;padding:8px 10px;white-space:pre-wrap;word-break:break-word}

/* Escalation Decision Card */
.escalation-card{background:var(--pane);border:2px solid var(--red);border-radius:12px;padding:18px 20px;box-shadow:var(--shadow-md);animation:cardpop .2s ease-out;display:flex;flex-direction:column;gap:12px}
.guard-strip{display:flex;align-items:center;gap:10px;border-radius:10px;padding:10px 14px;margin:6px 0;font-size:13px;animation:cardpop .2s ease-out;max-width:860px}
.guard-blocked{background:var(--red-bg);border:1px solid var(--red-border);color:var(--red);font-weight:600}
.guard-pass{background:var(--amber-bg);border:1px solid var(--amber-border);color:var(--amber)}
.guard-icon{font-size:16px;flex-shrink:0}
.guard-text{min-width:0;word-break:break-word}
.guard-badge{display:none;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--amber);background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:999px;padding:3px 10px}
.esc-head{display:flex;align-items:center;gap:10px}
.esc-icon{width:36px;height:36px;border-radius:8px;background:var(--red-bg);border:1px solid var(--red-border);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--red);flex-shrink:0}
.esc-title{font-size:15px;font-weight:800;color:var(--red)}
.esc-sub{font-size:12px;color:var(--dim);margin-top:1px}
.esc-body{font-size:13px;color:var(--text);background:var(--pane2);border:1px solid var(--line);border-radius:8px;padding:12px 14px;line-height:1.5;white-space:pre-wrap}
.esc-actions{display:flex;gap:12px;flex-wrap:wrap}
.btn-esc{display:inline-flex;align-items:center;gap:8px;padding:9px 20px;border-radius:8px;font-weight:800;cursor:pointer;font-size:13px;transition:all .15s}
.btn-approve{background:linear-gradient(135deg,#059669,#10b981);border:none;color:#fff;box-shadow:0 2px 8px rgba(5,150,105,.35);animation:dotpulse 1.5s infinite}
.btn-approve:hover{filter:brightness(1.1);transform:translateY(-1px)}
.btn-reject{background:transparent;border:1px solid var(--red);color:var(--red)}
.btn-reject:hover{background:var(--red-bg)}
kbd{font-family:ui-monospace,Menlo,monospace;background:rgba(0,0,0,.08);border:1px solid rgba(0,0,0,.15);border-bottom-width:2px;border-radius:4px;padding:0 5px;font-size:11px}
html[data-theme=dark] kbd{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2)}

/* Final Recap Card */
.recap-card{background:var(--pane);border:1px solid var(--green-border);border-radius:12px;padding:18px 20px;box-shadow:var(--shadow-md);animation:cardpop .2s ease-out;display:flex;flex-direction:column;gap:14px}
.rc-header{display:flex;align-items:center;gap:10px}
.rc-icon{width:36px;height:36px;border-radius:8px;background:var(--green-bg);border:1px solid var(--green-border);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--green);flex-shrink:0}
.rc-title{font-size:16px;font-weight:800;color:var(--green)}
.rc-sub{font-size:12px;color:var(--dim);margin-top:1px}
.rc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.rc-stat{background:var(--pane2);border:1px solid var(--line);border-radius:9px;padding:12px;text-align:center}
.rc-stat b{display:block;font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}
.rc-stat span{font-size:10.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.7px;font-weight:700;margin-top:4px;display:block}
.rc-stat.g b{color:var(--green)}.rc-stat.a b{color:var(--amber)}.rc-stat.r b{color:var(--red)}.rc-stat.b b{color:var(--blue)}
.rc-insights{display:flex;flex-direction:column;gap:8px;background:var(--pane2);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.rc-insight-row{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--dim);line-height:1.45}
.rc-insight-row b{color:var(--text)}
.rc-check{color:var(--green);font-weight:800;font-size:14px}
.rc-footer{font-size:11.5px;color:var(--faint);text-align:center;padding-top:4px}

/* Skeleton loader */
.skelbox{max-width:540px;margin:30px auto 0;background:var(--pane);border:1px solid var(--line);border-radius:12px;padding:22px;box-shadow:var(--shadow-sm)}
.skelline{height:12px;border-radius:6px;background:linear-gradient(90deg,var(--pane2) 25%,var(--hover) 50%,var(--pane2) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-bottom:12px}
.skelline.w1{width:65%}.skelline.w2{width:90%}.skelline.w3{width:80%}.skelline.w4{width:50%}
@keyframes shimmer{to{background-position:-200% 0}}
.skeltitle{text-align:left;color:var(--dim);font-size:12.5px;font-weight:600;margin-top:6px}

@media(max-width:860px){aside{display:none}.hud-item{min-width:110px}}
</style>
</head>
<body>
<aside>
 <div class="brand">
  <div class="brand-icon">⚡</div>
  <div class="brand-title">OpsRoom</div>
  <div class="roster-status" id="roster-status" title="Active participants out of total agents"><span class="roster-pulse"></span><span id="roster-count">…</span></div>
 </div>
 <div id="nav"></div>
 <div class="help" title="Click any agent to filter. Shortcuts: y (approve), n (reject), r (restart)">
  <span><kbd>y</kbd>/<kbd>n</kbd> on-call gate · <kbd>r</kbd> restart demo</span>
 </div>
</aside>
<main>
 <header>
   <div class="header-title-group">
    <h1 class="header-title">Live Incident War Room</h1>
    <span id="hud-timer" class="hud-timer">T+0.0s</span>
    <span id="mode-tag">Deterministic Demo</span>
    <span id="guard-badge" class="guard-badge" title="Interceptor audits: state-changing tool calls reviewed this run" style="display:none">0 audits</span>
   </div>
  <span class="hspace"></span>
  <span id="state" class="live-pill idle"><span class="pulsing-dot"></span><span id="state-text">connecting</span></span>
  <button id="theme" class="btn-header" title="Switch light/dark mode">☾</button>
  <button id="run" class="btn-header">▶ Restart Demo</button>
 </header>

 <div class="hud">
  <div class="hud-item">
   <span class="hud-k">Target Service</span>
   <span class="hud-v">orders-api <span class="sub">v2.14.3 canary</span></span>
  </div>
  <div class="hud-item">
   <span class="hud-k">Checkout Latency</span>
   <span class="hud-v alert" id="hud-lat">p95 4.2s <span class="sub">(norm: 210ms)</span></span>
  </div>
  <div class="hud-item">
   <span class="hud-k">Connection Pool</span>
   <span class="hud-v warn" id="hud-pool">10/10 active <span class="sub">312 queued</span></span>
  </div>
  <div class="hud-item hud-grow">
   <span class="hud-k">Active Directive</span>
   <div class="hud-directive" id="hud-directive">
    <span class="hud-directive-badge">Standard Triage</span>
    <span id="hud-directive-text">Diagnose canary degradation & propose safe remediation</span>
   </div>
  </div>
 </div>

 <div class="stepper" id="stepper">
  <div class="step active" id="step-1"><span class="step-num">1</span><span class="step-name">Detect</span></div>
  <span class="step-arrow">→</span>
  <div class="step" id="step-2"><span class="step-num">2</span><span class="step-name">Investigate</span></div>
  <span class="step-arrow">→</span>
  <div class="step" id="step-3"><span class="step-num">3</span><span class="step-name">Deliberate</span></div>
  <span class="step-arrow">→</span>
  <div class="step" id="step-4"><span class="step-num">4</span><span class="step-name">Decide</span></div>
  <span class="step-arrow">→</span>
  <div class="step" id="step-5"><span class="step-num">5</span><span class="step-name">Resolve</span></div>
 </div>

 <div class="control-bar">
  <div class="tabs">
   <button class="tab sel" data-tab="all">All Activity <span class="badge-count" id="tc-all">0</span></button>
   <button class="tab" data-tab="safety">🛡️ Safety & Holds <span class="badge-count" id="tc-safety">0</span></button>
   <button class="tab" data-tab="evidence">🔍 Evidence & Root Cause <span class="badge-count" id="tc-evidence">0</span></button>
   <button class="tab" data-tab="telemetry">📊 Telemetry & Alerts <span class="badge-count" id="tc-telemetry">0</span></button>
  </div>
  <input id="search-box" type="search" placeholder="Search events..." title="Search incident messages" />
  <div class="stats-summary">
   <span class="stat-pill ev">Evidence <b id="c-sig">0</b></span>
   <span class="stat-pill ho">Holds <b id="c-hold">0</b></span>
   <span class="stat-pill es">Human Calls <b id="c-esc">0</b></span>
   <span class="stat-pill">Events <b id="c-msg">0</b></span>
   <button id="clearfilter" hidden>Show all agents</button>
  </div>
 </div>

 <div id="feedwrap"><div id="feed">
  <div class="skelbox">
   <div class="skelline w1"></div>
   <div class="skelline w2"></div>
   <div class="skelline w3"></div>
   <div class="skelline w4"></div>
   <div class="skeltitle">Spinning up incident response room…</div>
  </div>
 </div><button id="jump-latest" class="jump-btn" hidden>↓ Jump to latest</button></div>
</main>
<script>
window.onerror=function(m){document.title="JS ERROR: "+m}

const AGENTS={system:["⚙"],deploy:["🚀"],alert:["🚨"],metric:["📊"],log:["📄"],triage:["🩺"],sleuth:["🔍"],healer:["🗄️"],librarian:["📚"],commander:["🛡️"],comms:["📢"],oncall:["👤"],scribe:["📜"],goal:["🎯"],roster:["👥"],feed:["📡"]}
const NAMES={system:"System",deploy:"Deploy notice",alert:"Alert engine",metric:"Metric stream",log:"Raw log",triage:"Triage specialist",sleuth:"Log analyst",healer:"Database healer",librarian:"Docs librarian",commander:"Risk commander",comms:"Incident comms",oncall:"On-call (human)",scribe:"Incident scribe",goal:"Directive pivot",roster:"Roster",feed:"Incident feed"}
const ROLES={system:"Orchestration",deploy:"Canary rollout",alert:"Threshold alerts",metric:"Telemetry gauges",log:"App stdout",triage:"Diagnostician",sleuth:"Log forensics",healer:"Postgres locks",librarian:"MCP specs",commander:"Safety referee",comms:"Public updates",oncall:"Human approval",scribe:"Audit timeline",goal:"Autonomous pivot",roster:"Scaling",feed:"Telemetry source"}
const CODES=["TIMEOUT_ERROR","CHECKOUT_LOCK_ERROR","PessimisticLockException","SQLTransientConnectionException"]

let es=null,pending=null,agentFilter=null,categoryFilter="all",msgCount=0
let countSafety=0,countEvidence=0,countTelemetry=0
const agentCounts={}
let rosterIds=["deploy","alert","metric","log","triage","sleuth","healer","librarian","commander","oncall","comms","scribe"]
let startTime=Date.now()
const feed=document.getElementById("feed")

function updateRosterCount(){
 // The roster totals PARTICIPANTS (from /agents), not just speakers — but
 // the header should read as "who's working": count an agent as active only
 // once it has said something. Telemetry tags (deploy/alert/metric/log)
 // come through the feed participant, so they count toward its slot.
 let used=0
 for(let i=0;i<rosterIds.length;i++){
  if((agentCounts[rosterIds[i]]||0)>0)used++
 }
 const rCt=document.getElementById("roster-count")
 if(rCt)rCt.textContent=used+"/"+rosterIds.length+" active"
}
updateRosterCount()

function esc(s){return s.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;")}
function rich(h){
 for(const c of CODES){
  h=h.split(c).join("<span class=.code.>"+c+"</span>").split(".code.").join(String.fromCharCode(34)+"code"+String.fromCharCode(34))
 }
 return h
}
function el(html){const t=document.createElement("template");t.innerHTML=html.trim();return t.content.firstChild}

function parseTag(rest){
 for(const k of Object.keys(AGENTS)){
  if(k!=="system"&&rest.indexOf("["+k+"] ")===0)return k
 }
 return null
}

function updateStepper(stepNum){
 for(let i=1;i<=5;i++){
  const st=document.getElementById("step-"+i)
  if(!st)continue
  if(i<stepNum){st.className="step done"}
  else if(i===stepNum){st.className="step active"}
  else{st.className="step"}
 }
}

function humanLine(body){
 if(body.indexOf("hikaricp.connections.pending=312")>=0)return "All 10 database connections busy; 312 checkout requests stuck waiting in queue"
 if(body.indexOf("p95 4.2s")>=0)return "Checkout page response time surged to 4.2s (baseline: 210ms — a 20x latency degradation)"
 if(body.indexOf("PessimisticLockException")>=0)return "Database row lock contention on cart table — concurrent transactions blocking each other"
 if(body.indexOf("SQLTransientConnectionException")>=0)return "HikariCP pool timeout: app waited 5.0s unable to obtain an available connection"
 if(body.indexOf("checkout error rate 7.8%")>=0)return "Checkout failure rate reached 7.8% — alert paging on-call engineer to review"
 if(body.indexOf("orders-api v2.14.3 rolled out")>=0)return "Canary rollout of v2.14.3 deployed to 3 of 10 orders-api pods"
 if(body.indexOf("PRESERVE EVIDENCE first")>=0)return "Priority flipped: Snapshot system state & logs before executing any state changes"
 if(body.indexOf("DatabaseHealer joined")>=0)return "Database Healer joined the incident room on-demand to inspect Postgres locks"
 if(body.indexOf("DocsLibrarian joined")>=0)return "Docs Librarian joined via MCP to check configuration references"
 return null
}

function storyFor(who,body,line){
 if(line.indexOf("joined mid-incident")>=0)return {badge:"join",cat:"specialist",label:"Specialist Joined",hl:"Specialist joined on-demand to assist"}
 if(line.indexOf("left the room")>=0)return {badge:"left",cat:"specialist",label:"Specialist Clocked Out",hl:"Investigation lane resolved — specialist clocked out"}
 if(who==="goal"||line.indexOf("goal absorbed")>=0||line.indexOf("GOAL UPDATE absorbed")>=0)return {badge:"goal",cat:"directive",label:"Directive Pivot",hl:"Priority shifted: Snapshot diagnostics first before state change"}
 if(line.indexOf("ESCALATION")>=0)return {badge:"esc",cat:"safety",label:"Human Escalation",hl:"Safety limit reached: On-call sign-off requested"}
 if(line.indexOf("challenging:")>=0||line.indexOf("CHALLENGE")>=0)return {badge:"hold",cat:"safety",label:"Proposal Challenged",hl:"Risk Commander challenged proposal — requested evidence-first revision"}
 if(line.indexOf("challenge received")>=0)return {badge:"prop",cat:"safety",label:"Revising Proposal",hl:"Triage accepted risk challenge — reforming mitigation"}
 if(line.indexOf("HOLD")>=0)return {badge:"hold",cat:"safety",label:"Safety Hold Enforced",hl:"Risk Commander paused proposal — lacks proof or has high blast radius"}
 if(who==="sleuth"&&body.indexOf("error signature")>=0)return {badge:"ev",cat:"evidence",label:"Evidence Found",hl:"Confirmed exact error signature in production logs"}
 if(who==="healer"&&body.indexOf("lock analysis")>=0)return {badge:"ev",cat:"evidence",label:"Database Diagnosis",hl:"Hot-row contention confirmed in Postgres cart table"}
 if(who==="oncall")return {badge:"dec",cat:"safety",label:"Human Decision",hl:"On-call engineer delivered decision"}
 if(body.indexOf("REVISED PROPOSAL")>=0)return {badge:"prop",cat:"safety",label:"Revised Proposal",hl:"Mitigation updated to be evidence-preserving"}
 if(body.indexOf("{PROPOSAL}")>=0||body.indexOf("PROPOSAL:")>=0)return {badge:"prop",cat:"safety",label:"Fix Proposed",hl:"Remediation proposal submitted to room"}
 if(body.indexOf("{HYPOTHESIS}")>=0)return {badge:"hypo",cat:"safety",label:"Initial Hypothesis",hl:"Early theory shared based on initial signals"}
 if(who==="deploy")return {badge:"telemetry",cat:"telemetry",label:"Canary Deploy",hl:"New version rolled out to canary pods"}
 if(who==="alert")return {badge:"telemetry",cat:"telemetry",label:"Alert Fired",hl:"System alert threshold exceeded"}
 if(who==="metric")return {badge:"telemetry",cat:"telemetry",label:"Metric Spike",hl:"Connection pool saturation detected"}
 if(who==="log")return {badge:"telemetry",cat:"telemetry",label:"Log Anomaly",hl:"Application log error recorded"}
 if(who==="comms")return {badge:"telemetry",cat:"telemetry",label:"Status Broadcast",hl:"Customer-facing incident status broadcast drafted"}
 if(who==="librarian"||body.indexOf("[librarian]")>=0)return {badge:"ev",cat:"evidence",label:"Docs Verified",hl:"MCP tool checked configuration docs"}
 if(who==="commander")return {badge:"hold",cat:"safety",label:"Safety Gate",hl:"Risk Commander vetted mitigation proposal"}
 if(who==="scribe")return {badge:"telemetry",cat:"telemetry",label:"Timeline Milestone",hl:"Incident timeline recorded"}
 return {badge:"telemetry",cat:"telemetry",label:"Room Update",hl:"War room coordination update"}
}

function whyFor(line){
 if(line.indexOf("GOAL")>=0||line.indexOf("[goal]")>=0)return "Autonomous Adaptation: Incident Commander shifted the room directive. All agents adapt their proposals without human restart."
 if(line.indexOf("joined mid-incident")>=0)return "Dynamic Roster: When database trouble was identified, the room automatically brought in specialists who immediately contributed."
 if(line.indexOf("HOLD")>=0||line.indexOf("challenging:")>=0)return "Safety Gate: The proposal was challenged because restarting or blind scaling destroys diagnostic state without fixing the lock contention."
 if(line.indexOf("ESCALATION")>=0)return "Human Authority: Unsafe state changes cannot be executed by AI agents alone — on-call engineer makes the final call."
 if(line.indexOf("left the room")>=0)return "Graceful Exit: The Database Healer submitted its verified fix and clocked out to prevent room noise."
 return null
}

function parseProposalChips(body){
 let chips=""
 if(body.indexOf("blastRadius: readonly")>=0)chips+='<span class="pchip readonly">Blast Radius: Readonly</span>'
 else if(body.indexOf("blastRadius: targeted")>=0)chips+='<span class="pchip targeted">Blast Radius: Targeted</span>'
 if(body.indexOf("evidenceFirst: yes")>=0)chips+='<span class="pchip ev-yes">Evidence First: Yes</span>'
 else if(body.indexOf("evidenceFirst: no")>=0)chips+='<span class="pchip ev-no">Evidence First: No</span>'
 if(body.indexOf("cites:")>=0){
  const sp=body.indexOf("cites:")
  const end=body.indexOf("|",sp)
  if(sp>=0&&end>sp){
   const citeText=body.slice(sp+6,end).trim()
   if(citeText&&citeText!=="none")chips+='<span class="pchip">Cites: '+esc(citeText)+"</span>"
  }
 }
 return chips
}

function formatCardBody(who,body,line,story){
 let clean=body.trim()
 if(clean.indexOf("["+who+"] ")===0)clean=clean.slice(who.length+3).trim()

 if(body.indexOf("{PROPOSAL}")>=0||body.indexOf("{HYPOTHESIS}")>=0){
  const lastPipe=clean.lastIndexOf("|")
  if(lastPipe>=0){
   const actionText=clean.slice(lastPipe+1).trim()
   const isHypo=body.indexOf("{HYPOTHESIS}")>=0
   return '<div class="prop-callout"><div class="prop-lead">'+(isHypo?'💡 Theory & Hypothesis':'🎯 Proposed Mitigation')+'</div><div class="prop-action">'+rich(esc(actionText))+'</div></div>'
  }
 }

 if(body.indexOf("error signature:")>=0){
  let sigText=clean
  const sp=sigText.indexOf("error signature:")
  if(sp>=0)sigText=sigText.slice(sp+16).trim()
  return '<div class="evidence-callout"><div class="ev-label">FORENSIC LOG MATCH</div><div class="ev-text">'+rich(esc(sigText))+'</div></div>'
 }

 if(who==="healer"&&body.indexOf("lock analysis:")>=0){
  let lockText=clean
  const sp=lockText.indexOf("lock analysis:")
  if(sp>=0)lockText=lockText.slice(sp+14).trim()
  return '<div class="evidence-callout"><div class="ev-label">POSTGRES LOCK DIAGNOSIS</div><div class="ev-text">'+rich(esc(lockText))+'</div></div>'
 }

 if(line.indexOf("challenging:")>=0||line.indexOf("HOLD")>=0){
  return '<div class="challenge-callout"><div class="ch-label">⚠️ SAFETY GUARDRAIL ENFORCED</div><div class="ch-text">'+rich(esc(clean))+'</div></div>'
 }

 if(body.indexOf("STATUS UPDATE")>=0&&body.indexOf("NEXT STEPS:")>=0){
  const sp=clean.indexOf("NEXT STEPS:")
  const mainText=clean.slice(0,sp).trim()
  const nextText=clean.slice(sp+11).trim()
  const items=nextText.split(String.fromCharCode(10))
  let listHtml=""
  for(let i=0;i<items.length;i++){
   let it=items[i].trim()
   if(!it)continue
   if(it.indexOf("- ")===0)it=it.slice(2).trim()
   else if(it.indexOf("* ")===0)it=it.slice(2).trim()
   listHtml+='<li><span class="step-check">✓</span><span>'+esc(it)+'</span></li>'
  }
  return '<div class="status-broadcast"><div class="sb-main">'+esc(mainText)+'</div><div class="sb-steps"><div class="sb-steps-title">Action Items & Next Steps</div><ul class="sb-list">'+listHtml+'</ul></div></div>'
 }

 return '<div class="detail">'+rich(esc(clean))+'</div>'
}

let searchQuery=""
const searchInput=document.getElementById("search-box")
if(searchInput){
 searchInput.oninput=()=>{
  searchQuery=searchInput.value.trim().toLowerCase()
  applyFilters()
 }
}

let userScrolledUp=false
const feedwrap=document.getElementById("feedwrap")
if(feedwrap){
 feedwrap.onscroll=()=>{
  const isAtBottom=feedwrap.scrollHeight-feedwrap.scrollTop-feedwrap.clientHeight<60
  userScrolledUp=!isAtBottom
  const jBtn=document.getElementById("jump-latest")
  if(jBtn)jBtn.hidden=!userScrolledUp
 }
}
const jBtn=document.getElementById("jump-latest")
if(jBtn){
 jBtn.onclick=()=>{
  userScrolledUp=false
  feedwrap.scrollTo({top:feedwrap.scrollHeight,behavior:"smooth"})
  jBtn.hidden=true
 }
}

function applyFilters(){
 const rows=feed.querySelectorAll(".row")
 for(const r of rows){
  const matchAgent=!agentFilter||r.getAttribute("data-agent")===agentFilter
  const rowCat=r.getAttribute("data-cat")||"telemetry"
  let matchCategory=true
  if(categoryFilter==="safety")matchCategory=(rowCat==="safety"||rowCat==="directive")
  else if(categoryFilter==="evidence")matchCategory=(rowCat==="evidence")
  else if(categoryFilter==="telemetry")matchCategory=(rowCat==="telemetry")
  let matchSearch=true
  if(searchQuery){
   const text=r.textContent.toLowerCase()
   matchSearch=text.indexOf(searchQuery)>=0
  }
  const show=matchAgent&&matchCategory&&matchSearch
  r.classList.toggle("hidden",!show)
 }
 const clr=document.getElementById("clearfilter")
 clr.hidden=!agentFilter
 clr.textContent=agentFilter?("Show all agents (filtering by "+(NAMES[agentFilter]||agentFilter)+")"):""
}

function bump(id){const n=document.getElementById(id);if(n)n.textContent=String(Number(n.textContent)+1)}

function addRow(line){
 let rest=line.trim(),ts=""
 if(rest.indexOf("T+")===0){
  const sp=rest.indexOf("s ")
  if(sp>0){ts="T+"+rest.slice(2,sp)+"s";rest=rest.slice(sp+1).trim()}
 }
 if(!ts){
  const elapsed=Math.max(0,((Date.now()-startTime)/1000)).toFixed(1)
  ts="T+"+elapsed+"s"
 }
 const d=new Date()
 const pad=function(n){return n<10?"0"+n:""+n}
 const clockTime=pad(d.getHours())+":"+pad(d.getMinutes())+":"+pad(d.getSeconds())
 const hTimer=document.getElementById("hud-timer")
 if(hTimer)hTimer.textContent=ts

 const who=parseTag(rest)||"system"
 const body=rest.replace("["+who+"] ","")
 const story=storyFor(who,body,line)
 const human=humanLine(body)||story.hl
 const why=whyFor(line)
 const chips=parseProposalChips(body)
 const formattedContent=formatCardBody(who,body,line,story)
 const avatar=(AGENTS[who]&&AGENTS[who][0])||"⚙"
 const agentName=NAMES[who]||who
 const agentRole=ROLES[who]||""

 // Stepper progression
 if(who==="deploy"||who==="alert")updateStepper(1)
 if(who==="sleuth"||body.indexOf("error signature")>=0)updateStepper(2)
 if(who==="triage"||who==="healer"||line.indexOf("HOLD")>=0||who==="librarian")updateStepper(3)
 if(line.indexOf("ESCALATION")>=0||who==="oncall")updateStepper(4)
 if(line.indexOf("STATUS UPDATE")>=0)updateStepper(5)

 // HUD updates
 if(who==="goal"||line.indexOf("goal absorbed")>=0||line.indexOf("GOAL UPDATE absorbed")>=0){
  const dirBox=document.getElementById("hud-directive")
  if(dirBox){
   dirBox.className="hud-directive pivot"
   dirBox.innerHTML='<span class="hud-directive-badge">⚠️ Evidence First</span><span>Snapshot diagnostics before any state change</span>'
  }
 }

 const r=el('<div class="row" data-agent="'+who+'" data-cat="'+story.cat+'"><div class="card cat-'+story.cat+'"><div class="card-header"><span class="card-avatar">'+avatar+'</span><div class="card-author"><span>'+esc(agentName)+'</span><span class="card-role">'+esc(agentRole)+'</span></div><span class="badge '+story.badge+'">'+esc(story.label)+'</span><time class="time-badge" title="Incident time: '+ts+' · Local clock: '+clockTime+'"><span class="t-rel">'+ts+'</span><span class="t-sep">·</span><span class="t-clock">'+clockTime+'</span></time></div><div class="headline '+(story.badge==='ev'?'evidence':(story.badge==='hold'?'hold':(story.badge==='esc'?'escalation':'')))+'">'+esc(human)+'</div>'+(chips?'<div class="prop-chips">'+chips+'</div>':'')+formattedContent+(why?'<div class="why-box"><span class="why-icon">💡</span><span>'+esc(why)+'</span></div>':'')+'<div class="raw-drawer"><button class="rawbtn"><span>▸ Technical line</span></button><pre class="rawpre"></pre></div></div></div>')

 r.querySelector(".rawpre").textContent=line.trim()
 const rb=r.querySelector(".rawbtn")
 rb.onclick=()=>{
  const p=r.querySelector(".rawpre")
  const open=p.style.display==="block"
  p.style.display=open?"none":"block"
  rb.innerHTML=open?"<span>▸ Technical line</span>":"<span>▾ Hide technical line</span>"
 }

 feed.appendChild(r)
 msgCount++;bump("c-msg");bump("tc-all")

 agentCounts[who]=(agentCounts[who]||0)+1
 const ag=document.getElementById("ag-"+who)
 if(ag){
  ag.classList.add("used")
  ag.classList.add("on")
  clearTimeout(ag.t)
  ag.t=setTimeout(()=>ag.classList.remove("on"),1400)
  const ct=ag.querySelector(".ct")
  if(ct)ct.textContent=String(agentCounts[who])
 }
 updateRosterCount()

 if(story.cat==="safety"||story.cat==="directive"){countSafety++;document.getElementById("tc-safety").textContent=String(countSafety)}
 if(story.cat==="evidence"){countEvidence++;document.getElementById("tc-evidence").textContent=String(countEvidence)}
 if(story.cat==="telemetry"){countTelemetry++;document.getElementById("tc-telemetry").textContent=String(countTelemetry)}

 if(story.badge==="ev")bump("c-sig")
 if(story.badge==="hold")bump("c-hold")
 if(story.badge==="esc")bump("c-esc")

  applyFilters()
  if(!userScrolledUp){
   r.scrollIntoView({block:"end",behavior:"smooth"})
  }
  return r
 }

function addEscalation(text){
 updateStepper(4)
 pending=el('<div class="escalation-card"><div class="esc-head"><div class="esc-icon">⚠️</div><div><div class="esc-title">Human Decision Required — Safety Gate Triggered</div><div class="esc-sub">The AI agents cannot proceed with state changes without on-call authorization</div></div></div><div class="esc-body"></div><div class="esc-actions"><button id="yes" class="btn-esc btn-approve"><kbd>y</kbd> Approve Mitigation</button><button id="no" class="btn-esc btn-reject"><kbd>n</kbd> Reject (Demand Safer Fix)</button></div></div>')
 pending.querySelector(".esc-body").textContent=text
 feed.appendChild(pending)
 pending.scrollIntoView({block:"center"})
 pending.querySelector("#yes").onclick=()=>decide(true)
 pending.querySelector("#no").onclick=()=>decide(false)
}

function decide(approved){
 if(!pending)return
 const n=pending;pending=null
 n.innerHTML='<div class="esc-head"><div class="esc-icon" style="color:var(--green)">✓</div><div><div class="esc-title" style="color:var(--text)">Decision Recorded: '+(approved?'Approved by On-Call':'Rejected by On-Call — Seeking Safer Fix')+'</div><div class="esc-sub">The war room has resumed autonomous operations</div></div></div>'
 fetch("/decision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answer:approved?"y":"n"})})
}

function addRecap(sig,fnd,ch){
 updateStepper(5)
 const card=el('<div class="recap-card"><div class="rc-header"><div class="rc-icon">✓</div><div><div class="rc-title">Incident Successfully Contained & Mitigated</div><div class="rc-sub">Multi-agent governance prevented catastrophic outage and resolved lock contention</div></div></div><div class="rc-grid"><div class="rc-stat g"><b>'+(sig===undefined?"2":String(sig))+'</b><span>Evidence Signatures</span></div><div class="rc-stat a"><b>'+(fnd===undefined?"3":String(fnd))+'</b><span>Proposals Evaluated</span></div><div class="rc-stat r"><b>'+(ch===undefined?"1":String(ch))+'</b><span>Safety Holds</span></div><div class="rc-stat b"><b>'+String(msgCount)+'</b><span>Total Events</span></div></div><div class="rc-insights"><div class="rc-insight-row"><span class="rc-check">✓</span><div><b>Root Cause:</b> Row lock contention (<span class="code">CHECKOUT_LOCK_ERROR</span>) on orders-api cart table cascaded into connection pool starvation (<span class="code">TIMEOUT_ERROR</span>).</div></div><div class="rc-insight-row"><span class="rc-check">✓</span><div><b>Key Safeguard:</b> Risk Commander prevented blind pod restart (saving 60s outage); Database Healer safely localized mitigation to canary pods.</div></div></div><div class="rc-footer">Audit trail recorded by Incident Scribe → <span class="code-green">incident-timeline.md</span></div></div>')
 feed.appendChild(card)
 card.scrollIntoView({block:"center"})
}

function setStatus(txt,cls){
 const p=document.getElementById("state")
 const t=document.getElementById("state-text")
 if(t)t.textContent=txt
 if(p)p.className="live-pill "+cls
}

function render(line){
 const sk=feed.querySelector(".skelbox");if(sk)sk.remove()
 if(!line)return
 addRow(line)
}

function reset(){
 pending=null;msgCount=0;agentFilter=null;categoryFilter="all"
 countSafety=0;countEvidence=0;countTelemetry=0
 guardCount=0
 const gBtn=document.getElementById("guard-badge")
 if(gBtn){gBtn.style.display="none";gBtn.textContent="0 audits"}
 startTime=Date.now()
 userScrolledUp=false
 searchQuery=""
 const sBox=document.getElementById("search-box")
 if(sBox)sBox.value=""
 const jBtn=document.getElementById("jump-latest")
 if(jBtn)jBtn.hidden=true
 const hTimer=document.getElementById("hud-timer")
 if(hTimer)hTimer.textContent="T+0.0s"
 for(const k of Object.keys(agentCounts))agentCounts[k]=0
 for(const ct of document.querySelectorAll(".agent .ct"))ct.textContent="0"
 for(const a of document.querySelectorAll(".agent"))a.classList.remove("used","on")
 updateRosterCount()
 for(const id of["c-sig","c-hold","c-esc","c-msg","tc-all","tc-safety","tc-evidence","tc-telemetry"]){
  const elX=document.getElementById(id);if(elX)elX.textContent="0"
 }
 for(const tb of document.querySelectorAll(".tab"))tb.classList.toggle("sel",tb.getAttribute("data-tab")==="all")
 const dirBox=document.getElementById("hud-directive")
 if(dirBox){
  dirBox.className="hud-directive"
  dirBox.innerHTML='<span class="hud-directive-badge">Standard Triage</span><span id="hud-directive-text">Diagnose canary degradation & propose safe remediation</span>'
}
updateStepper(1)
feed.innerHTML='<div class="skelbox"><div class="skelline w1"></div><div class="skelline w2"></div><div class="skelline w3"></div><div class="skelline w4"></div><div class="skeltitle">Rolling out v2.14.3 canary & monitoring telemetry…</div></div>'
setStatus("live","live")
}

// Guardrail badge: a distinct amber/red strip in the feed for interceptor
// audit rows. BLOCKED = red (a state-changing call was stopped), ALLOWED or
// PASSED = amber (the gate reviewed and released it). Counts roll into the
// header guard badge too.
let guardCount=0
function renderGuard(line,blocked){
 guardCount++
 const gb=document.getElementById("guard-badge")
 if(gb){gb.textContent=guardCount+(blocked?" blocked":" audits");gb.style.display="inline-flex"}
 const who=(line.match(/-> ([\w.]+)/)||[])[1]||""
 const isBlocked=!!blocked
 const strip=el('<div class="guard-strip '+(isBlocked?"guard-blocked":"guard-pass")+'"><span class="guard-icon">'+(isBlocked?"🛡":"👁")+'</span><span class="guard-text">'+esc(line.replace(/^\[interceptor\] /,""))+'</span></div>')
 feed.appendChild(strip)
 strip.scrollIntoView({behavior:"smooth",block:"nearest"})
}

function start(){
 es=new EventSource("/events")
 es.onmessage=(ev)=>{
  let d;try{d=JSON.parse(ev.data)}catch(e){return}
  if(d.type==="row")render(d.line)
  else if(d.type==="guard")renderGuard(d.line,d.blocked)
  else if(d.type==="escalation"){setStatus("waiting for you","waiting");addEscalation(d.text)}
  else if(d.type==="reset")reset()
  else if(d.type==="state"){if(d.value==="live"&&!pending)setStatus("live","live");else if(d.value==="idle")setStatus("idle","idle")}
  else if(d.type==="summary"){render("");addRecap(d.sig,d.findings,d.challenges);setStatus("idle","idle")}
  else if(d.type==="hello"){const mt=document.getElementById("mode-tag");if(mt)mt.textContent=d.mode}
 }
}

document.getElementById("run").onclick=async()=>{await fetch("/run",{method:"POST"})}
document.getElementById("clearfilter").onclick=()=>{
 agentFilter=null
 for(const x of document.querySelectorAll(".agent"))x.classList.remove("sel")
 applyFilters()
}

// Category Tabs
for(const btn of document.querySelectorAll(".tab")){
 btn.onclick=()=>{
  for(const b of document.querySelectorAll(".tab"))b.classList.remove("sel")
  btn.classList.add("sel")
  categoryFilter=btn.getAttribute("data-tab")
  applyFilters()
 }
}

// Theme Switcher
const themeBtn=document.getElementById("theme")
function applyTheme(t){
 document.documentElement.setAttribute("data-theme",t)
 themeBtn.textContent=t==="dark"?"☀":"☾"
 try{localStorage.setItem("opsroom-theme",t)}catch(e){}
}
let savedTheme=null;try{savedTheme=localStorage.getItem("opsroom-theme")}catch(e){}
applyTheme(savedTheme||(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"))
themeBtn.onclick=()=>{applyTheme(document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark")}

// Keyboard shortcuts
document.addEventListener("keydown",(ev)=>{
 if(ev.key==="y"&&pending)decide(true)
 else if(ev.key==="n"&&pending)decide(false)
 else if(ev.key==="r"&&!pending)fetch("/run",{method:"POST"})
})

start()

// Fetch Roster
fetch("/agents").then(r=>r.json()).then((list)=>{
 const nav=document.getElementById("nav")
 let html="",group=""
 for(const a of list){
  if(a.group!==group){group=a.group;html+='<div class="navlabel">'+esc(group)+'</div>'}
  const avatar=(AGENTS[a.id]&&AGENTS[a.id][0])||"⚙"
  const currentCount=agentCounts[a.id]||0
  const isUsed=currentCount>0
  html+='<div class="agent '+(isUsed?'used':'')+'" id="ag-'+a.id+'" data-id="'+a.id+'" title="Click to filter to '+esc(a.name)+' ('+currentCount+' messages)"><span class="em">'+avatar+'</span><span class="dot"></span><span style="min-width:0"><span class="nm">'+esc(a.name)+'</span><span class="rl">'+esc(a.role)+'</span></span><span class="ct" title="Total messages sent">'+currentCount+'</span></div>'
 }
 nav.innerHTML=html
 for(const el2 of nav.querySelectorAll(".agent")){
  el2.onclick=()=>{
   const id=el2.getAttribute("data-id")
   agentFilter=(agentFilter===id)?null:id
   for(const x of nav.querySelectorAll(".agent"))x.classList.toggle("sel",x.getAttribute("data-id")===agentFilter)
   applyFilters()
  }
 }
 rosterIds=[]
 for(const a of list)rosterIds.push(a.id)
 updateRosterCount()
})
</script>
</body>
</html>`
