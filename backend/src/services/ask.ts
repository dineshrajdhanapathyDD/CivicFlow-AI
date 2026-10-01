// Ask CivicFlow — data-grounded Q&A. Retrieves real application data via agent
// tools first, then Bedrock summarizes. The model must not invent statistics.
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { config } from '../shared/config.js';
import { buildGroundingContext } from './agentTools.js';
import { logEvent } from '../shared/util.js';

const client = new BedrockRuntimeClient({ region: config.region });

const SYSTEM_PROMPT = `You are CivicFlow's community assistant. Answer questions about community issues using ONLY the data provided in the context block.

Rules:
- Use ONLY the numbers and facts in the context. NEVER invent statistics, counts, or issue IDs.
- If the context does not contain the answer, say so plainly and suggest what data would help.
- Be concise (2-4 sentences). Use plain language a citizen understands.
- When you cite a number, it must appear verbatim in the context.
- Do not expose internal reasoning; give the answer directly.`;

export interface AskResult {
  answer: string;
  used: string[];
}

export async function askCivicFlow(question: string): Promise<AskResult> {
  const { context, used } = await buildGroundingContext(question);
  logEvent('ASK_QUERY', { used });

  const userMessage = `CONTEXT:\n${context}\n\nQUESTION: ${question}\n\nAnswer using only the context above.`;

  try {
    const res = await client.send(
      new ConverseCommand({
        modelId: config.bedrockModelId,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [{ role: 'user', content: [{ text: userMessage }] }],
        inferenceConfig: { maxTokens: 400, temperature: 0.1 },
      }),
    );
    const answer =
      res.output?.message?.content?.find((c) => 'text' in c)?.text?.trim() ||
      'I could not generate an answer right now. Please try again.';
    return { answer, used };
  } catch (err) {
    logEvent('ASK_FAILED', { message: (err as Error).message });
    // Deterministic fallback: return the factual context so the user still gets data.
    return {
      answer:
        'The AI assistant is temporarily unavailable, but here is the current community data:\n\n' +
        context,
      used,
    };
  }
}
