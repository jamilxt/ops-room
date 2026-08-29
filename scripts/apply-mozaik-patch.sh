#!/usr/bin/env bash
# apply-mozaik-patch.sh — re-applies the thought_signature patch to
# @mozaik-ai/core after any npm install. Idempotent: skips if already applied.
set -e
cd "$(dirname "$0")/.."
F=node_modules/@mozaik-ai/core/dist/index.mjs
if grep -q "__thoughtSignature" "$F"; then
  echo "patch already present"
  exit 0
fi
python3 - "$F" <<'PYEOF'
import sys
p = sys.argv[1]
s = open(p).read()

old1 = '''      if (part.functionCall) {
        items.push(
          FunctionCallItem.rehydrate({
            callId: (_e = part.functionCall.id) != null ? _e : "",
            name: part.functionCall.name,
            args: JSON.stringify((_f = part.functionCall.args) != null ? _f : {})
          })
        );
      }'''
new1 = '''      if (part.functionCall) {
        const callArgs = (_f = part.functionCall.args) != null ? _f : {};
        if (part.thoughtSignature) {
          callArgs["__thoughtSignature"] = part.thoughtSignature;
        }
        items.push(
          FunctionCallItem.rehydrate({
            callId: (_e = part.functionCall.id) != null ? _e : "",
            name: part.functionCall.name,
            args: JSON.stringify(callArgs)
          })
        );
      }'''
assert old1 in s, "response-side pattern not found"
s = s.replace(old1, new1)

old2 = '''      if (item instanceof FunctionCallItem) {
        callNames.set(item.callId, item.name);
        let args;
        try {
          args = JSON.parse(item.args);
        } catch (e) {
          args = {};
        }
        this.addPart(contents, "model", { functionCall: { id: item.callId, name: item.name, args } });
        continue;
      }'''
new2 = '''      if (item instanceof FunctionCallItem) {
        callNames.set(item.callId, item.name);
        let args;
        let thoughtSignature;
        try {
          args = JSON.parse(item.args);
        } catch (e) {
          args = {};
        }
        if (args && typeof args === "object" && "__thoughtSignature" in args) {
          thoughtSignature = args["__thoughtSignature"];
          delete args["__thoughtSignature"];
        }
        const callPart = { functionCall: { id: item.callId, name: item.name, args } };
        if (thoughtSignature) {
          callPart["thoughtSignature"] = thoughtSignature;
        }
        this.addPart(contents, "model", callPart);
        continue;
      }'''
assert old2 in s, "request-side pattern not found"
s = s.replace(old2, new2)

open(p, 'w').write(s)
print("thought_signature patch applied")
PYEOF
