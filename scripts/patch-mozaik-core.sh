#!/usr/bin/env bash
# Patch @mozaik-ai/core cloud publisher: getParticipant() throws for departed
# participants (sleuth crash / healer clock-out are intentional demo beats),
# killing the whole process in LLM mode. Use the non-throwing state lookup.
node - <<'EOF'
const fs = require("fs")
for (const f of ["dist/index.js", "dist/index.mjs"]) {
  const p = `node_modules/@mozaik-ai/core/${f}`
  if (!fs.existsSync(p)) continue
  let s = fs.readFileSync(p, "utf8")
  const fixed = s.replace(
    "this.runtime.getParticipant(this.agentId)",
    "this.runtime.state.getParticipant(this.agentId)",
  )
  if (fixed !== s) {
    fs.writeFileSync(p, fixed)
    console.log(`patched ${f}`)
  }
}
EOF
