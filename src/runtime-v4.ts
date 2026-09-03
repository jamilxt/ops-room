import {
	defineRuntime,
	RuntimeState,
	SemanticEvent,
	SituationSpecification,
	type Participant,
	type SituationContext,
	type SituationHandler,
	type SituationProcessor,
	type InferenceInput,
} from "@mozaik-ai/core"

/**
 * v4 runtime module. defineRuntime() returns per-module functions that are
 * NOT top-level package exports — they must live in module scope, so every
 * OpsRoom v4 participant imports from this file (never from @mozaik-ai/core
 * directly for bus capabilities).
 */
export class OpsRoomState extends RuntimeState {
	/** Room-level chatter that any participant can consult. */
	meta = new Map<string, unknown>()
}

const rt = defineRuntime<OpsRoomState>()

export const initializeRuntime = rt.initializeRuntime
export const resolveRuntime = rt.resolveRuntime
export const resolveParticipant = rt.resolveParticipant
export const join = rt.join
export const leave = rt.leave
export const sendMessage = rt.sendMessage
export const sendEvent = rt.sendEvent
export const runLoop = rt.runLoop

/**
 * Idempotent runtime bootstrap for long-lived hosts (the web console runs
 * many scenarios in ONE process; "Run again" must not throw). On re-entry
 * the participant registry is cleared so a fresh scenario starts from an
 * empty room — the previous run's participants would otherwise keep
 * receiving events.
 */
export function ensureRuntime(): void {
	try {
		initializeRuntime({ state: new OpsRoomState() })
	} catch (error) {
		if ((error as Error).message !== "Runtime already initialized") throw error
		resolveRuntime().state.participants.clear()
	}
}

/** Publish a semantic event on behalf of a participant (v3 deliverSemanticEvent). */
export function deliverSemanticEvent(producer: Participant, event: SemanticEvent): void {
	sendEvent(event, producer.getId())
}

/**
 * Spec factories — the v4 replacement for handler overrides. Each v3
 * `override onX` becomes a SituationSpecification + SituationProcessor pair.
 */

/** When this participant receives a chat message from SOMEONE ELSE. */
export function whenMessageFrom(
	predicate: (message: string, event: SemanticEvent<"message.sent">) => boolean,
): SituationSpecification {
	return new (class extends SituationSpecification {
		isSatisfiedBy({ event, participant }: SituationContext): boolean {
			if (event.type !== "message.sent") return false
			// v4 note: publish() fans out to the sender too — v3 excluded the
			// sender. Filter by producerId to keep v3 semantics.
			if (event.producerId === participant.getId()) return false
			const message = (event.payload as { message?: string })?.message
			return typeof message === "string" && predicate(message, event as SemanticEvent<"message.sent">)
		}
	})()
}

/** When ANOTHER participant publishes any semantic event. */
export function whenExternalEvent(
	predicate: (event: SemanticEvent) => boolean,
): SituationSpecification {
	return new (class extends SituationSpecification {
		isSatisfiedBy({ event, participant }: SituationContext): boolean {
			if (event.type === "message.sent") return false
			return event.producerId !== participant.getId() && predicate(event)
		}
	})()
}

/** When another participant joins (and the initial-assembly window passed). */
export function whenParticipantJoins(opts: { quietForMs?: number } = {}): SituationSpecification {
	const bornAt = Date.now()
	return new (class extends SituationSpecification {
		isSatisfiedBy({ event, participant }: SituationContext): boolean {
			if (event.type !== "participant.joined") return false
			if (opts.quietForMs && Date.now() - bornAt < opts.quietForMs) return false
			return (event.payload as { id?: string })?.id !== participant.getId()
		}
	})()
}

/** When another participant leaves gracefully. */
export function whenParticipantLeaves(): SituationSpecification {
	return new (class extends SituationSpecification {
		isSatisfiedBy({ event, participant }: SituationContext): boolean {
			return event.type === "participant.left" && (event.payload as { id?: string })?.id !== participant.getId()
		}
	})()
}

/** Convenience processor that acts on the current message string. */
export function processorFor(
	act: (message: string, participant: Participant, event: SemanticEvent) => void | Promise<void>,
): SituationProcessor {
	return {
		apply({ event, participant }: SituationContext) {
			const message = (event.payload as { message?: string })?.message
			return act(typeof message === "string" ? message : "", participant, event)
		},
	}
}

/** Convenience processor for raw semantic events (goal-update etc.). */
export function eventProcessorFor(
	act: (event: SemanticEvent, participant: Participant) => void | Promise<void>,
): SituationProcessor {
	return {
		apply({ event, participant }: SituationContext) {
			return act(event, participant)
		},
	}
}

/** Helper: build an InferenceInput for an agent's memory context. */
export function inferenceInputFor(
	agent: { getMemory(): { getContext(): any } },
	model: string,
	extra: Partial<InferenceInput> = {},
): InferenceInput {
	return { model, context: agent.getMemory().getContext(), ...extra }
}
