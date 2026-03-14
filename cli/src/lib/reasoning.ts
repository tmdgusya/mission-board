import chalk from "chalk";
import { type Reasoning, type ReasoningStep } from "../client";

export interface ReasoningOptions {
  reason?: string;
  transcript?: string;
}

/**
 * Validate transcript array format
 */
function isValidTranscript(transcript: unknown): transcript is ReasoningStep[] {
  if (!Array.isArray(transcript)) return false;
  if (transcript.length === 0 || transcript.length > 50) return false;

  for (const item of transcript) {
    if (typeof item !== "object" || item === null) return false;
    const step = (item as { step?: unknown }).step;
    const thought = (item as { thought?: unknown }).thought;
    if (typeof step !== "number" || !Number.isInteger(step) || step < 1 || step > 100) return false;
    if (typeof thought !== "string" || thought.length === 0 || thought.length > 2000) return false;
  }

  return true;
}

/**
 * Load and parse transcript from file or stdin
 */
async function loadTranscript(transcriptPath: string): Promise<ReasoningStep[]> {
  let content: string;

  if (transcriptPath === "-") {
    content = await Bun.file("/dev/stdin").text();
  } else {
    try {
      content = await Bun.file(transcriptPath).text();
    } catch {
      throw new Error(`Transcript file not found: ${transcriptPath}`);
    }
  }

  let transcript: unknown;
  try {
    transcript = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON in transcript file");
  }

  if (!isValidTranscript(transcript)) {
    throw new Error(
      "Invalid transcript format. Expected an array of objects with 'step' (number, 1-100) and 'thought' (string, 1-2000 chars). Max 50 steps."
    );
  }

  return transcript;
}

/**
 * Build a Reasoning object from command-line options.
 * Returns the reasoning object, or 1 (exit code) on validation error.
 */
export async function buildReasoning(
  options?: ReasoningOptions
): Promise<Reasoning | undefined | 1> {
  if (!options?.reason && !options?.transcript) return undefined;

  const reasoning: Reasoning = {};

  if (options.reason) {
    if (options.reason.length > 280) {
      console.error(chalk.red("Error: Reason exceeds maximum length of 280 characters"));
      return 1;
    }
    reasoning.reason = options.reason;
  }

  if (options.transcript) {
    try {
      reasoning.transcript = await loadTranscript(options.transcript);
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Failed to load transcript"}`));
      return 1;
    }
  }

  return reasoning;
}
