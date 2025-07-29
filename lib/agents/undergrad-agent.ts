import type { AgentMessage, Guide, FinalSummary } from "../types"
import type { PlanObject } from "./planner-agent"
import { BaseAgent, type AgentCapabilities, type TaskContext } from "./base-agent" // eslint-disable-line @typescript-eslint/no-unused-vars
import { generateMessageId } from "../utils"

export class UndergradAgent extends BaseAgent {
  constructor(onMessage: (message: AgentMessage) => void) {
    super("UndergradAgent", "Protocol Generation and Experimental Guidance", onMessage)
  }

  defineCapabilities(): AgentCapabilities {
    return {
      canHandle: (task: TaskContext) => task.type === 'protocol_generation' || task.type === 'generate_summary' || task.type === 'execution_plan' || task.type === 'execution_preparation' || task.type === 'final_protocol_review',
      estimateSuccess: (task: TaskContext) => {
        // Use memory to estimate success based on past performance
        const similar = this.memory.longTerm.successfulGuides.filter(g => 
          g.context.includes('protocol') || g.context.includes('summary')
        )
        return similar.length > 0 ? 0.85 : 0.7
      },
      requiredResources: ['Protocol templates', 'Lab procedures database'],
      dependencies: ['RiskAnalyst']
    }
  }

  canHandle(task: TaskContext): boolean {
    return task.type === 'protocol_generation' || task.type === 'generate_summary' || task.type === 'execution_plan' || task.type === 'execution_preparation' || task.type === 'final_protocol_review'
  }

  estimateSuccess(task: TaskContext): number {
    // Use memory to estimate success based on past performance
    const similar = this.memory.longTerm.successfulGuides.filter(g => 
      g.context.includes('protocol') || g.context.includes('summary')
    )
    return similar.length > 0 ? 0.85 : 0.7
  }

  async processIncomingMessage(from: string, message: Record<string, unknown>): Promise<unknown> {
    // Handle incoming messages from other agents
    if (message.type === 'protocol_request') {
      return this.finalizeSummary(message.plan as PlanObject, message.guides as Guide[])
    }
    return null
  }

  async finalizeSummary(plan: PlanObject, guides: Guide[]): Promise<FinalSummary> {
    this.onMessage({
      id: generateMessageId(),
      agent: "UndergradAgent",
      status: "thinking",
      message: "Compiling final report and generating experimental protocol...",
      timestamp: new Date(),
    })

    await new Promise((resolve) => setTimeout(resolve, 1500))

    // TODO: Allow swap-in of actual CRISPR wet-lab protocol generator (Primer3 + Benchling SDK)
    // TODO: Add PDF/GenBank export pipeline
    // TODO: Generate primer sequences for guide cloning
    // TODO: Include transfection protocols specific to cell line

    const summary = this.generateSummary(plan, guides)

    this.onMessage({
      id: generateMessageId(),
      agent: "UndergradAgent",
      status: "complete",
      message: `Final report compiled. ${summary.recommendedGuides.length} guides recommended for experimental validation. Protocol includes cloning primers, transfection conditions, and analysis methods. Ready for download.`,
      timestamp: new Date(),
    })

    return summary
  }

  private generateSummary(plan: PlanObject, guides: Guide[]): FinalSummary {
    // Ensure guides is always an array
    const safeGuides = Array.isArray(guides) ? guides : []
    
    let recommendedGuides = safeGuides.filter((g) => g.offtargetRisk === "low")
    const highRiskGuides = safeGuides.filter((g) => g.offtargetRisk === "high")

    // If no low-risk guides, fall back to medium-risk guides
    if (recommendedGuides.length === 0) {
      recommendedGuides = safeGuides.filter((g) => g.offtargetRisk === "medium")
    }

    // Prioritise lowest off-target risk when selecting "best" guide
    const pickBest = (candidates: Guide[]): Guide | null => {
      return candidates.sort((a, b) => b.efficiency - a.efficiency)[0] || null
    }

    let bestGuide: Guide | null = null
    if (recommendedGuides.length) {
      bestGuide = pickBest(recommendedGuides)
    } else {
      const mediumRisk = safeGuides.filter((g) => g.offtargetRisk === "medium")
      if (mediumRisk.length) bestGuide = pickBest(mediumRisk)
      else if (highRiskGuides.length) bestGuide = pickBest(highRiskGuides)
    }

    if (!bestGuide) {
      bestGuide = {
        id: 'none',
        seq: 'No guides generated',
        start: 0,
        end: 0,
        efficiency: 0,
        offtargetRisk: 'high' as const,
        gcContent: 0
      }
    }

    return {
      plan,
      totalGuides: safeGuides.length,
      recommendedGuides,
      highRiskGuides,
      bestGuide,
      protocol: this.generateProtocol(plan, recommendedGuides),
      riskSummary: this.generateRiskSummary(safeGuides),
      nextSteps: this.generateNextSteps(plan),
    }
  }

  private generateProtocol(plan: PlanObject, guides: Guide[]): string {
    // Ensure guides is always an array
    const safeGuides = Array.isArray(guides) ? guides : []
    
    // TODO: Generate actual wet-lab protocol with specific reagents and conditions
    return `
CRISPR ${plan.editType} Protocol for ${plan.gene} in ${plan.cellLine}

1. Guide RNA Preparation:
   - Synthesize top ${Math.min(3, safeGuides.length)} recommended guides
   - Clone into px458 vector with ${plan.nuclease}
   - Sequence verify all constructs

2. Cell Culture & Transfection:
   - Culture ${plan.cellLine} cells to 70% confluence
   - Transfect using Lipofectamine 3000
   - Select GFP+ cells by FACS after 48h

3. Analysis:
   - Extract genomic DNA after 72h
   - PCR amplify target region
   - Analyze by Sanger sequencing or NGS
   - Quantify editing efficiency using TIDE/ICE

4. Validation:
   - Confirm on-target editing by sequencing
   - Screen for off-target effects at predicted sites
   - Validate phenotype if applicable
    `.trim()
  }

  private generateRiskSummary(guides: Guide[]): string {
    // Ensure guides is always an array
    const safeGuides = Array.isArray(guides) ? guides : []
    
    const highRisk = safeGuides.filter((g) => g.offtargetRisk === "high").length
    const mediumRisk = safeGuides.filter((g) => g.offtargetRisk === "medium").length
    const lowRisk = safeGuides.filter((g) => g.offtargetRisk === "low").length

    return `Risk Assessment: ${lowRisk} low-risk, ${mediumRisk} medium-risk, ${highRisk} high-risk guides identified. ${highRisk > 0 ? "Recommend experimental validation of off-target predictions." : "All guides show acceptable safety profiles."}`
  }

  private generateNextSteps(plan: PlanObject): string[] {
    return [
      "Order synthetic guide RNAs or cloning primers",
      `Prepare ${plan.cellLine} cell culture`,
      "Set up transfection optimization experiments",
      "Design PCR primers for target amplification",
      "Plan off-target validation experiments",
    ]
  }
}
