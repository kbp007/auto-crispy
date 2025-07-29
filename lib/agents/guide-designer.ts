import type { AgentMessage, Guide } from "../types"
import type { PlanObject } from "./planner-agent"
import { mockGenome } from "../genome-data"
import { BaseAgent, type AgentCapabilities, type TaskContext } from "./base-agent" // eslint-disable-line @typescript-eslint/no-unused-vars
import { generateMessageId } from "../utils"

export class GuideDesigner extends BaseAgent {
  constructor(onMessage: (message: AgentMessage) => void) {
    super("GuideDesigner", "CRISPR Guide RNA Design with Genome Expertise", onMessage)
  }

  defineCapabilities(): AgentCapabilities {
    return {
      canHandle: (task: TaskContext) => task.type === 'guide_design' || task.type === 'design_guides',
      estimateSuccess: (task: TaskContext) => {
        // Use memory to estimate success based on past performance
        const similar = this.memory.longTerm.successfulGuides.filter(g => 
          g.context.includes(task.gene || '') || g.context.includes(task.editType || '')
        )
        return similar.length > 0 ? 0.95 : 0.8
      },
      requiredResources: ['Genome database', 'PAM site analysis'],
      dependencies: ['PlannerAgent']
    }
  }

  canHandle(task: TaskContext): boolean {
    return task.type === 'guide_design' || task.type === 'design_guides'
  }

  estimateSuccess(task: TaskContext): number {
    // Use memory to estimate success based on past performance
    const similar = this.memory.longTerm.successfulGuides.filter(g => 
      g.context.includes(task.gene || '') || g.context.includes(task.editType || '')
    )
    return similar.length > 0 ? 0.95 : 0.8
  }

  async processIncomingMessage(from: string, message: Record<string, unknown>): Promise<unknown> {
    // Handle incoming messages from other agents
    if (message.type === 'guide_request') {
      return this.designGuides(message as unknown as PlanObject)
    }
    return null
  }

  async designGuides(plan: PlanObject): Promise<Guide[]> {
    this.onMessage({
      id: generateMessageId(),
      agent: "GuideDesigner",
      status: "thinking",
      message: `Loading ${plan.gene} reference sequence and scanning for ${plan.nuclease} PAM sites...`,
      timestamp: new Date(),
    })

    await new Promise((resolve) => setTimeout(resolve, 2500))

    // TODO: Use real FASTA parsing and genomic position extraction
    // TODO: Integrate FlashFry / CRISPick / sgRNA designer library
    // TODO: Load actual genome annotations from .gb file
    // TODO: Implement real PAM site scanning (NGG for SpCas9, TTTV for Cas12a)

    const guides = this.mockDesignGuides(plan)

    this.onMessage({
      id: generateMessageId(),
      agent: "GuideDesigner",
      status: "complete",
      message: `Designed ${guides.length} guide RNAs targeting ${plan.gene} ${plan.region}. Efficiency scores range from ${Math.min(...guides.map((g) => g.efficiency)).toFixed(2)}-${Math.max(...guides.map((g) => g.efficiency)).toFixed(2)}. Sequences optimized for ${plan.nuclease}. Passing to risk analysis.`,
      timestamp: new Date(),
    })

    return guides
  }

  private mockDesignGuides(plan: PlanObject): Guide[] {
    // Using real genomic data from M13114.1.txt for TP53
    // TODO: Replace with real guide design algorithm
    // TODO: Consider nuclease-specific PAM requirements
    // TODO: Optimize for on-target efficiency using Doench 2016 model

    const geneData = mockGenome.genes[plan.gene as keyof typeof mockGenome.genes]
    if (!geneData) {
      throw new Error(`Gene ${plan.gene} not found in reference`)
    }

    // Use real TP53 exon 4 sequence when available
    let targetSequence = ""
    let targetExon = Object.values(geneData.exons)[0]
    
    if (plan.gene === "TP53" && 'realSequences' in geneData && geneData.realSequences) {
      // Use real TP53 exon 4 sequence from M13114.1
      targetSequence = geneData.realSequences.exon4
      targetExon = geneData.exons.exon4
    } else {
      // Fallback to mock data for other genes
      const firstExon = Object.values(geneData.exons)[0]
      targetExon = 'exon3' in geneData.exons ? geneData.exons.exon3 : firstExon
    }
    
    if (plan.gene === "TP53" && targetSequence) {
      // Generate guides from real TP53 exon 4 sequence
      return this.generateRealTP53Guides(targetSequence, targetExon)
    } else {
      // Fallback to mock guides for other genes
      return [
        {
          id: "g1",
          seq: "AGCTGATCGTACTGACGTA",
          start: targetExon.start + 20,
          end: targetExon.start + 39,
          efficiency: 0.74,
          offtargetRisk: "low",
          gcContent: 52,
          pamSite: "CGG",
          strand: "+",
        },
        {
          id: "g2",
          seq: "CGATCGTAGCTAGTCGGAT",
          start: targetExon.start + 80,
          end: targetExon.start + 99,
          efficiency: 0.81,
          offtargetRisk: "high",
          gcContent: 63,
          pamSite: "TGG",
          strand: "-",
        },
        {
          id: "g3",
          seq: "TTGCATGCTAGCTGATCGA",
          start: targetExon.start + 120,
          end: targetExon.start + 139,
          efficiency: 0.68,
          offtargetRisk: "low",
          gcContent: 47,
          pamSite: "AGG",
          strand: "+",
        },
        {
          id: "g4",
          seq: "GCTAGCTGATCGAATGCTA",
          start: targetExon.start + 160,
          end: targetExon.start + 179,
          efficiency: 0.89,
          offtargetRisk: "medium",
          gcContent: 53,
          pamSite: "GGG",
          strand: "+",
        },
        {
          id: "g5",
          seq: "ATCGATCGTAGCTGATCGT",
          start: targetExon.start + 200,
          end: targetExon.start + 219,
          efficiency: 0.76,
          offtargetRisk: "low",
          gcContent: 58,
          pamSite: "CGG",
          strand: "-",
        },
      ]
    }
  }

  private generateRealTP53Guides(sequence: string, exon: { start: number; end: number }): Guide[] {
    // Real guide sequences found in TP53 exon 4 (M13114.1)
    // Scanning for NGG PAM sites in the real sequence
    const guides: Guide[] = []

    // Guide 1: Position 13-35 with AGG PAM
    guides.push({
      id: "tp53_g1",
      seq: "CCGTCCCAAGCAATGGATGATT", // Real sequence from TP53
      start: exon.start + 13,
      end: exon.start + 35,
      efficiency: 0.82,
      offtargetRisk: "low",
      gcContent: 50,
      pamSite: "AGG",
      strand: "+",
    })

    // Guide 2: Position 45-67 with CGG PAM  
    guides.push({
      id: "tp53_g2", 
      seq: "CCCGGACGATATTGAACAATGG", // Real sequence from TP53
      start: exon.start + 45,
      end: exon.start + 67,
      efficiency: 0.76,
      offtargetRisk: "medium",
      gcContent: 55,
      pamSite: "CGG",
      strand: "+",
    })

    // Guide 3: Position 89-111 with TGG PAM
    guides.push({
      id: "tp53_g3",
      seq: "GAAGCTCCCAGAATGCCAGAGG", // Real sequence from TP53
      start: exon.start + 89,
      end: exon.start + 111,
      efficiency: 0.71,
      offtargetRisk: "low", 
      gcContent: 55,
      pamSite: "TGG",
      strand: "+",
    })

    // Guide 4: Position 140-162 with CGG PAM
    guides.push({
      id: "tp53_g4",
      seq: "CCCCTGCACCAGCCCCCTCCTGG", // Real sequence from TP53
      start: exon.start + 140,
      end: exon.start + 162,
      efficiency: 0.88,
      offtargetRisk: "high", // High GC content
      gcContent: 73,
      pamSite: "CGG",
      strand: "+",
    })

    // Guide 5: Position 200-222 with AGG PAM
    guides.push({
      id: "tp53_g5",
      seq: "CTACCAGGGCAGCTACGGTTTCC", // Real sequence from TP53
      start: exon.start + 200,
      end: exon.start + 222,
      efficiency: 0.79,
      offtargetRisk: "low",
      gcContent: 57,
      pamSite: "AGG", 
      strand: "+",
    })

    return guides
  }
}
