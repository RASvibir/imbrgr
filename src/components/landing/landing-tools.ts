/**
 * Outcome-oriented tool definitions for the landing page.
 * Visitors do not know tool names; each tile frames a concrete creative outcome.
 *
 * Sourced directly from src/lib/tools/registry.ts instead of a hardcoded duplicate.
 */

import { getLandingTools, type OutcomeTool } from "@/lib/tools/registry";

export type { OutcomeTool };

export const OUTCOME_TOOLS: readonly OutcomeTool[] = getLandingTools();
