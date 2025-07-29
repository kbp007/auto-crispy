export interface AgentMessage {
  id: number
  agent: string
  status: "thinking" | "complete"
  message: string
  timestamp: Date
}

export interface Guide {
  id: string
  seq: string
  start: number
  end: number
  efficiency: number
  offtargetRisk: string
  gcContent: number
  pamSite?: string
  strand?: string
  riskScore?: number
  predictedOfftargets?: number
  riskFactors?: string[]
}

export interface RiskAssessment {
  guideId: string
  riskLevel: "low" | "medium" | "high"
  riskScore: number
  predictedOfftargets: number
  riskFactors: string[]
}

export interface FinalSummary {
  plan: unknown
  totalGuides: number
  recommendedGuides: Guide[]
  highRiskGuides: Guide[]
  bestGuide: Guide
  protocol: string
  riskSummary: string
  nextSteps: string[]
}
