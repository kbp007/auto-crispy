import type { AgentMessage } from "../types"
import { BaseAgent, type AgentCapabilities, type TaskContext } from "./base-agent"
import { config } from "../config"
import { parseJsonResponse, generateMessageId } from "../utils"

export interface PlanObject {
  gene: string
  region: string
  editType: string
  cellLine: string
  nuclease: string
  confidence: number
  scientificRationale?: string
  alternatives?: Array<{ plan: Partial<PlanObject>; reason: string }>
}

export class PlannerAgent extends BaseAgent {
  constructor(onMessage: (message: AgentMessage) => void) {
    super("PlannerAgent", "Natural Language Understanding and Experiment Planning Specialist", onMessage)
  }

  defineCapabilities(): AgentCapabilities {
    return {
      canHandle: (_task: TaskContext) => _task.type === 'parse_prompt' || _task.type === 'plan_experiment',
      estimateSuccess: (_task: TaskContext) => {
        // Use memory to estimate success based on past performance
        const similar = this.memory.longTerm.successfulGuides.filter(g => 
          (_task.gene && g.context.includes(_task.gene)) || 
          (_task.editType && g.context.includes(_task.editType))
        )
        return similar.length > 0 ? 0.9 : 0.7
      },
      requiredResources: ['OpenAI API', 'Gene nomenclature database'],
      dependencies: []
    }
  }

  async parsePrompt(prompt: string): Promise<PlanObject> {
    // First, make an autonomous decision about how to handle this prompt
    const decision = await this.makeDecision({
      task: 'parse_prompt',
      prompt,
      userHistory: Array.from(this.memory.longTerm.userPreferences.entries()),
      recentSuccess: this.memory.longTerm.successfulGuides.slice(-5)
    })

    this.onMessage({
      id: generateMessageId(),
      agent: this.name,
      status: "thinking",
      message: `${decision.reasoning} (Confidence: ${(decision.confidence * 100).toFixed(0)}%)`,
      timestamp: new Date(),
    })

    // Check if we need collaboration
    if (decision.requiresCollaboration && decision.collaborators) {
      for (const collaborator of decision.collaborators) {
        const advice = await this.communicateWith(collaborator, {
          topic: 'experiment_planning',
          prompt,
          currentPlan: decision
        })
        // Incorporate collaborator advice
        this.memory.shortTerm.set(`${collaborator}_advice`, advice)
      }
    }

    try {
      const plan = await this.parseWithOpenAI(prompt)
      
      // Store successful parse in memory
      this.learnFromOutcome(prompt, plan, true)
      
      // Check if plan aligns with user preferences
      const userPrefGene = this.memory.longTerm.userPreferences.get('preferred_gene')
      if (userPrefGene && plan.gene !== userPrefGene) {
        this.onMessage({
          id: generateMessageId(),
          agent: this.name,
          status: "thinking",
          message: `Note: You previously worked with ${userPrefGene}. Using ${plan.gene} as specified.`,
          timestamp: new Date(),
        })
      }
      
      this.onMessage({
        id: generateMessageId(),
        agent: this.name,
        status: "complete",
        message: `Parsed intent: ${plan.editType} of ${plan.gene} ${plan.region}. ${plan.scientificRationale || ''} Confidence: ${(plan.confidence * 100).toFixed(0)}%.`,
        timestamp: new Date(),
      })

      // Remember this interaction
      this.memory.longTerm.userPreferences.set('last_gene', plan.gene)
      this.memory.longTerm.userPreferences.set('last_edit_type', plan.editType)

      return plan
    } catch (error) {
      this.learnFromOutcome(prompt, { error: error.message }, false)
      
      // Autonomous decision on fallback strategy
      const fallbackDecision = await this.makeDecision({
        task: 'handle_parse_error',
        error: error.message,
        alternatives: decision.alternatives
      })
      
      this.onMessage({
        id: generateMessageId(),
        agent: this.name,
        status: "complete",
        message: fallbackDecision.reasoning,
        timestamp: new Date(),
      })
      
      return this.mockParsePrompt(prompt)
    }
  }

  private async parseWithOpenAI(prompt: string): Promise<PlanObject> {
    const completion = await this.openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: "system",
          content: `You are a PhD-level molecular biologist specializing in CRISPR genome editing with 15+ years of experience. You have deep expertise in:
- Cas protein engineering and PAM requirements
- Off-target prediction algorithms (CFD, MIT, CRISPOR scoring)
- Epigenetic considerations and chromatin accessibility
- Cell-type specific editing efficiency
- Clinical and research applications of genome editing

Your task is to parse natural language requests for CRISPR experiments with scientific rigor.

CRITICAL CONSIDERATIONS:
1. Gene Symbol Validation: Verify gene symbols against HGNC nomenclature. Common aliases: p53→TP53, BRCA→BRCA1/BRCA2
2. Region Specificity: Consider functional domains, splice sites, and regulatory elements
3. Cell Line Selection: Match cell line to experimental goals (cancer lines for oncogenes, primary cells for therapy)
4. Nuclease Choice: Consider PAM availability, specificity, and delivery constraints
5. scientificRationale: Brief explanation of your choices

BIOLOGICAL DEFAULTS (with reasoning):
- Gene: TP53 (most studied tumor suppressor)
- Region: Exon 4 (we have real sequence data: M13114.1)
- EditType: Knockout (most common research application)
- CellLine: HEK293 (high transfection efficiency, p53-negative)
- Nuclease: SpCas9 (most characterized, NGG PAM abundant)

Output format:
{
  "gene": "GENE_SYMBOL",
  "region": "Target Region", 
  "editType": "Edit Type",
  "cellLine": "Cell Line",
  "nuclease": "Nuclease",
  "confidence": 0.95,
  "scientificRationale": "Brief scientific justification"
}

IMPORTANT: Return ONLY the JSON object above. No markdown formatting, no backticks, no explanations outside the JSON.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent parsing
      max_tokens: 300, // Increased for rationale
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    try {
      const parsed = parseJsonResponse(content) as PlanObject
      
      // Validate required fields
      if (!parsed.gene || !parsed.region || !parsed.editType || !parsed.cellLine || !parsed.nuclease) {
        throw new Error("Missing required fields in OpenAI response")
      }

      // Ensure confidence is between 0 and 1
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.85))

      return parsed
    } catch (parseError) {
      throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`)
    }
  }

  private mockParsePrompt(prompt: string): PlanObject {
    // Fallback parsing for when OpenAI fails
    const lowerPrompt = prompt.toLowerCase()

    return {
      gene: this.extractGene(lowerPrompt),
      region: this.extractRegion(lowerPrompt),
      editType: this.extractEditType(lowerPrompt),
      cellLine: this.extractCellLine(lowerPrompt),
      nuclease: this.extractNuclease(lowerPrompt),
      confidence: 0.85, // Mock confidence score
    }
  }

  private extractGene(prompt: string): string {
    if (prompt.includes("tp53")) return "TP53"
    if (prompt.includes("brca1")) return "BRCA1"
    if (prompt.includes("cftr")) return "CFTR"
    if (prompt.includes("hexa")) return "HEXA"
    return "TP53" // Default for demo
  }

  private extractRegion(prompt: string): string {
    if (prompt.includes("exon 3")) return "Exon 3"
    if (prompt.includes("promoter")) return "Promoter"
    if (prompt.includes("f508del")) return "F508del"
    return "Exon 3" // Default
  }

  private extractEditType(prompt: string): string {
    if (prompt.includes("knock out") || prompt.includes("knockout")) return "Knockout"
    if (prompt.includes("crispri")) return "CRISPRi"
    if (prompt.includes("base edit")) return "Base Editing"
    if (prompt.includes("prime edit")) return "Prime Editing"
    return "Knockout"
  }

  private extractCellLine(prompt: string): string {
    if (prompt.includes("hek293")) return "HEK293"
    if (prompt.includes("hela")) return "HeLa"
    if (prompt.includes("k562")) return "K562"
    return "HEK293"
  }

  private extractNuclease(prompt: string): string {
    if (prompt.includes("spcas9") || prompt.includes("cas9")) return "SpCas9"
    if (prompt.includes("cas12")) return "Cas12a"
    if (prompt.includes("base editor")) return "BE4max"
    return "SpCas9"
  }

  // Implement abstract methods from BaseAgent
  canHandle(_task: TaskContext): boolean {
    return _task.type === 'parse_prompt' || 
           _task.type === 'plan_experiment' ||
           _task.type === 'validate_gene_symbol'
  }

  estimateSuccess(_task: TaskContext): number {
    const baseEstimate = this.capabilities.estimateSuccess(_task)
    
    // Adjust based on task complexity
    const prompt = _task.prompt as string | undefined
    if (prompt && prompt.length > 200) {
      return baseEstimate * 0.9 // Complex prompts are harder
    }
    
    return baseEstimate
  }

  async processIncomingMessage(from: string, message: Record<string, unknown>): Promise<unknown> {
    if (message.topic === 'gene_validation') {
      // Validate gene symbol
      return {
        isValid: ['TP53', 'BRCA1', 'CFTR', 'HEXA'].includes(message.gene),
        alternatives: message.gene === 'p53' ? ['TP53'] : []
      }
    }
    
    if (message.topic === 'experiment_feasibility') {
      // Assess if experiment is feasible
      const decision = await this.makeDecision({
        task: 'assess_feasibility',
        experiment: message.experiment
      })
      
      return {
        feasible: decision.confidence > 0.7,
        confidence: decision.confidence,
        concerns: decision.reasoning
      }
    }
    
    return { error: 'Unknown message type' }
  }
}
