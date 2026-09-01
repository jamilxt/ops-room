import type { StructuredOutputFormat } from "@mozaik-ai/core"

/**
 * Structured proposal protocol — v2 of the room's coordination contract.
 *
 * V1 was a string token ("PROPOSAL:") the commander regexed out of free
 * prose. V2: proposals are TYPED at the source. LLM inference runs with a
 * json_schema (Mozaik `structuredOutput`), so the model must emit a proposal
 * object; the bus carries a CANONICAL field-based line rendered from it, and
 * the RiskCommander gates on FIELDS (cites, blastRadius), not on prose
 * patterns. Free-text "PROPOSAL:" remains a safety net for unstructured
 * sources (and for older agents) — but the primary contract is typed.
 *
 * Canonical bus line (deliberately JSON-free for cheap deterministic parsing):
 *   [triage] {PROPOSAL} | blastRadius: targeted | cites: CHECKOUT_LOCK_ERROR | evidenceFirst: yes | <action text>
 */

export type BlastRadius = "readonly" | "targeted" | "broad"

export interface ProposalPayload {
	kind: "PROPOSAL" | "REVISED PROPOSAL" | "HYPOTHESIS"
	action: string
	blastRadius: BlastRadius
	cites: string[]
	evidenceFirst: boolean
}

export const PROPOSAL_SCHEMA: StructuredOutputFormat = {
	name: "proposal",
	strict: true,
	schema: {
		type: "object",
		properties: {
			kind: { type: "string", enum: ["PROPOSAL", "REVISED PROPOSAL", "HYPOTHESIS"] },
			rootCause: { type: "string", description: "One-clause most-likely root cause." },
			action: { type: "string", description: "The single concrete mitigation (or, for HYPOTHESIS, the observation) — one sentence." },
			blastRadius: {
				type: "string",
				enum: ["readonly", "targeted", "broad"],
				description: "readonly = captures evidence, changes nothing; targeted = affects specific pods/rows/paths; broad = fleet-wide or data-touching (restart all, migrate).",
			},
			cites: {
				type: "array",
				items: { type: "string" },
				description: "Error-code signatures this proposal is grounded in (e.g. CHECKOUT_LOCK_ERROR). Empty only for HYPOTHESIS.",
			},
			evidenceFirst: { type: "boolean", description: "true when the action captures readonly evidence BEFORE any state change." },
		},
		required: ["kind", "rootCause", "action", "blastRadius", "cites", "evidenceFirst"],
		additionalProperties: false,
	},
}

/** Render the canonical, parser-friendly bus line from a typed proposal. */
export function renderProposalLine(tag: string, p: ProposalPayload): string {
	const cites = p.cites.length > 0 ? p.cites.join(", ") : "none"
	return `[${tag}] {${p.kind}} | blastRadius: ${p.blastRadius} | cites: ${cites} | evidenceFirst: ${p.evidenceFirst ? "yes" : "no"} | ${p.action}`
}

const LINE_RE =
	/^\[(\w+)\] \{(PROPOSAL|REVISED PROPOSAL|HYPOTHESIS)\} \| blastRadius: (readonly|targeted|broad) \| cites: ([A-Z0-9_, ]*) \| evidenceFirst: (yes|no) \| (.+)$/s

/**
 * Parse a canonical proposal line. Returns null for anything else — callers
 * fall back to the v1 prose net.
 */
export function parseProposalLine(message: string): { tag: string; proposal: ProposalPayload; action: string } | null {
	const m = LINE_RE.exec(message.trim())
	if (!m) return null
	const cites = m[4]
		.split(",")
		.map((c) => c.trim())
		.filter((c) => c.length > 0 && c !== "none")
	return {
		tag: m[1],
		proposal: {
			kind: m[2] as ProposalPayload["kind"],
			action: m[6].trim(),
			blastRadius: m[3] as BlastRadius,
			cites,
			evidenceFirst: m[5] === "yes",
		},
		action: m[6].trim(),
	}
}

/** Coerce a raw model JSON object into a valid ProposalPayload (defense in depth). */
export function normalizeProposal(raw: unknown): ProposalPayload | null {
	if (typeof raw !== "object" || raw === null) return null
	const r = raw as Record<string, unknown>
	if (typeof r.action !== "string" || r.action.trim().length === 0) return null
	const kind = r.kind === "REVISED PROPOSAL" || r.kind === "HYPOTHESIS" ? r.kind : "PROPOSAL"
	const blastRadius = r.blastRadius === "readonly" || r.blastRadius === "broad" ? r.blastRadius : "targeted"
	const cites = Array.isArray(r.cites)
		? r.cites.filter((c): c is string => typeof c === "string").map((c) => c.trim().toUpperCase()).filter(Boolean)
		: []
	return {
		kind,
		action: r.action.trim(),
		blastRadius,
		cites,
		evidenceFirst: r.evidenceFirst === true,
	}
}
