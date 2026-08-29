
// Central default model: real OpenAI keys get gpt-5.4-mini; the generic
// OpenAI-compatible adapter keeps deepseek-v4-flash. LLM_MODEL overrides.
export function defaultModelName(): string {
	return process.env.LLM_MODEL ?? (process.env.OPENAI_BASE_URL?.includes("openai.com") || (!process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY) ? "gpt-5.4-mini" : "deepseek-v4-flash")
}
