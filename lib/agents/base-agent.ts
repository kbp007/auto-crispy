import type { AgentMessage } from "../types"
import OpenAI from "openai"
import { config } from "../config"
import { parseJsonResponse, generateMessageId } from '../utils'

export interface AgentMemory {
  shortTerm: Map<string, unknown>
  longTerm: {
    successfulGuides: Array<{ sequence: string; efficiency: number; context: string }>
    failedGuides: Array<{ sequence: string; reason: string; context: string }>
    userPreferences: Map<string, unknown>
    domainKnowledge: Map<string, unknown>
  }
}

export interface AgentDecision {
  action: string
  confidence: number
  reasoning: string
  alternatives: Array<{ action: string; confidence: number }>
  requiresCollaboration: boolean
  collaborators?: string[]
}

export interface TaskContext {
  type: string
  prompt?: string
  gene?: string
  editType?: string
  [key: string]: unknown
}

export interface AgentCapabilities {
  canHandle: (task: TaskContext) => boolean
  estimateSuccess: (task: TaskContext) => number
  requiredResources: string[]
  dependencies: string[]
}

export abstract class BaseAgent {
  protected name: string
  protected role: string
  protected memory: AgentMemory
  protected onMessage: (message: AgentMessage) => void
  protected openai: OpenAI
  protected capabilities: AgentCapabilities
  protected collaborators: Map<string, BaseAgent>

  constructor(name: string, role: string, onMessage: (message: AgentMessage) => void) {
    this.name = name
    this.role = role
    this.onMessage = onMessage
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
      dangerouslyAllowBrowser: true,
    })
    
    this.memory = {
      shortTerm: new Map(),
      longTerm: {
        successfulGuides: [],
        failedGuides: [],
        userPreferences: new Map(),
        domainKnowledge: new Map(),
      }
    }
    
    this.collaborators = new Map()
    this.capabilities = this.defineCapabilities()
  }

  abstract defineCapabilities(): AgentCapabilities

  // Autonomous decision-making
  async makeDecision(context: Record<string, unknown>): Promise<AgentDecision> {
    const prompt = `
You are ${this.name}, a ${this.role} in a CRISPR design system.

Current context: ${JSON.stringify(context, null, 2)}

Your memory:
- Recent successful guides: ${this.memory.longTerm.successfulGuides.length}
- Known failures to avoid: ${this.memory.longTerm.failedGuides.length}
- User preferences: ${JSON.stringify(Array.from(this.memory.longTerm.userPreferences.entries()))}

Based on your expertise and memory, decide:
1. What action should you take?
2. How confident are you (0-1)?
3. What's your reasoning?
4. What alternatives exist?
5. Do you need to collaborate with other agents?

Respond in JSON format:
{
  "action": "specific action to take",
  "confidence": 0.85,
  "reasoning": "explanation",
  "alternatives": [{"action": "alt1", "confidence": 0.6}],
  "requiresCollaboration": false,
  "collaborators": []
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting, no backticks, no explanations.
`

    const response = await this.openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: "system", content: "You are an autonomous agent making decisions. Return valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: "json_object" }
    })

    const decision = parseJsonResponse(response.choices[0]?.message?.content || '{}') as AgentDecision
    this.logDecision(decision, context)
    return decision
  }

  // Inter-agent communication
  async communicateWith(agent: string, message: Record<string, unknown>): Promise<unknown> {
    const targetAgent = this.collaborators.get(agent)
    if (!targetAgent) {
      throw new Error(`Cannot communicate with unknown agent: ${agent}`)
    }

    this.onMessage({
      id: generateMessageId(),
      agent: this.name,
      status: "thinking",
      message: `Consulting with ${agent} about ${message.topic}...`,
      timestamp: new Date(),
    })

    return await targetAgent.receiveMessage(this.name, message)
  }

  // Receive messages from other agents
  async receiveMessage(from: string, message: Record<string, unknown>): Promise<unknown> {
    this.memory.shortTerm.set(`msg_from_${from}`, message)
    
    const response = await this.processIncomingMessage(from, message)
    return response
  }

  abstract processIncomingMessage(from: string, message: Record<string, unknown>): Promise<unknown>

  // Learning and adaptation
  learnFromOutcome(action: string, outcome: Record<string, unknown>, success: boolean) {
    if (success) {
      this.memory.longTerm.successfulGuides.push({
        sequence: action,
        efficiency: (outcome.efficiency as number) || 0,
        context: JSON.stringify(outcome),
      })
    } else {
      this.memory.longTerm.failedGuides.push({
        sequence: action,
        reason: (outcome.reason as string) || "Unknown",
        context: JSON.stringify(outcome),
      })
    }

    // Update decision weights based on outcome
    this.updateDecisionWeights(action, success)
  }

  // Memory management
  rememberUserPreference(key: string, value: unknown) {
    this.memory.longTerm.userPreferences.set(key, value)
  }

  recallMemory(key: string): unknown {
    return this.memory.shortTerm.get(key) || 
           this.memory.longTerm.userPreferences.get(key) ||
           this.memory.longTerm.domainKnowledge.get(key)
  }

  // Goal decomposition
  async decomposeGoal(goal: Record<string, unknown>): Promise<Array<{ task: string; assignee: string; priority: number }>> {
    const prompt = `
Decompose this CRISPR editing goal into subtasks:
${JSON.stringify(goal)}

Consider:
- What needs to be done first?
- Which agents should handle each task?
- What are the dependencies?

Return a JSON object with a "subtasks" array containing subtask objects with assignees and priorities.
Format: {"subtasks": [...]}
`

    const response = await this.openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: "system", content: "You are planning a complex CRISPR experiment. Return valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    })

    const parsed = parseJsonResponse(response.choices[0]?.message?.content || '{"subtasks": []}') as { subtasks: unknown[] }
    return parsed.subtasks || []
  }

  // Abstract methods for agent-specific behavior
  abstract canHandle(task: TaskContext): boolean
  abstract estimateSuccess(task: TaskContext): number
  
  // Helper methods
  protected logDecision(decision: AgentDecision, context: Record<string, unknown>) {
    this.memory.shortTerm.set('last_decision', { decision, context, timestamp: Date.now() })
  }

  protected updateDecisionWeights(action: string, success: boolean) {
    const weight = (this.memory.longTerm.domainKnowledge.get(`weight_${action}`) as number) || 0.5
    const newWeight = success ? Math.min(weight + 0.1, 1) : Math.max(weight - 0.1, 0)
    this.memory.longTerm.domainKnowledge.set(`weight_${action}`, newWeight)
  }

  registerCollaborator(agent: BaseAgent) {
    this.collaborators.set(agent.name, agent)
  }
} 