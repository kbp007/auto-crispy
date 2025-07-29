"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, ArrowLeft, AlertTriangle, CheckCircle, Clock, FileText, Beaker, ThumbsUp, ThumbsDown } from "lucide-react"
import { CrisprOrchestrator } from "@/lib/crispr-orchestrator"
import type { AgentMessage, Guide, FinalSummary } from "@/lib/types"
import type { PlanObject } from "@/lib/agents/planner-agent"
import SequenceViewer from "@/components/sequence-viewer"
import AgentChat from "@/components/agent-chat"
import { ThemeToggle } from "@/components/theme-toggle"

interface WorkspaceViewProps {
  prompt: string
}

export default function WorkspaceView({ prompt }: WorkspaceViewProps) {
  const [plan, setPlan] = useState<PlanObject | null>(null)
  const [guides, setGuides] = useState<Guide[]>([])
  const [summary, setSummary] = useState<FinalSummary | null>(null)
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(true)

  const [orchestrator, setOrchestrator] = useState<CrisprOrchestrator | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState<number>(384) // default 96 * 4 = 384px
  const [isResizing, setIsResizing] = useState(false)

  // Mouse handlers for sidebar resize
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  const stopResizing = () => {
    setIsResizing(false)
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = window.innerWidth - e.clientX
      const min = 240
      const max = 600
      if (newWidth >= min && newWidth <= max) {
        setSidebarWidth(newWidth)
      }
    },
    [isResizing]
  )

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", stopResizing)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", stopResizing)
    }
  }, [handleMouseMove])

  const runCrisprPipeline = useCallback(async () => {
    const newOrchestrator = new CrisprOrchestrator((message) => {
      setAgentMessages((prev) => [...prev, message])
    })
    setOrchestrator(newOrchestrator)

    try {
      const result = await newOrchestrator.processPrompt(prompt)
      setPlan(result.plan)
      setGuides(result.guides)
      setSummary(result.summary)
      setIsProcessing(false)
      setShowFeedback(true)
    } catch (error) {
      console.error("Pipeline error:", error)
      setIsProcessing(false)
    }
  }, [prompt])

  useEffect(() => {
    runCrisprPipeline()
  }, [runCrisprPipeline])

  const downloadCSV = () => {
    if (!guides.length) return

    const csvContent = [
      [
        "Guide ID",
        "Sequence",
        "Start",
        "End",
        "Efficiency",
        "Off-target Risk",
        "GC Content",
        "PAM Site",
        "Strand",
        "Risk Score",
        "Predicted Off-targets",
      ],
      ...guides.map((guide) => [
        guide.id,
        guide.seq,
        guide.start,
        guide.end,
        guide.efficiency,
        guide.offtargetRisk,
        guide.gcContent,
        guide.pamSite || "",
        guide.strand || "",
        guide.riskScore || "",
        guide.predictedOfftargets || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `autocrisp_guides_${plan?.gene || "unknown"}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadProtocol = () => {
    if (!summary) return

    const protocolContent = `AutoCrisp Protocol Report
Generated: ${new Date().toLocaleString()}

${summary.protocol}

Risk Summary:
${summary.riskSummary}

Next Steps:
${summary.nextSteps.map((step, i) => `${i + 1}. ${step}`).join("\n")}

Recommended Guides:
${summary.recommendedGuides.map((g) => `- ${g.id}: ${g.seq} (Efficiency: ${(g.efficiency * 100).toFixed(1)}%)`).join("\n")}
`

    const blob = new Blob([protocolContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `autocrisp_protocol_${plan?.gene || "unknown"}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              New Edit
            </Button>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AutoCrisp</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isProcessing ? (
              <Badge
                variant="secondary"
                className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
              >
                <Clock className="w-3 h-3 mr-1" />
                Processing
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel - Intent Summary */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit Summary</h2>
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                &quot;{prompt}&quot;
              </div>
            </div>

            {plan && (
              <Card className="p-4">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Parsed Intent</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Gene:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{plan.gene}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Region:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{plan.region}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Edit Type:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{plan.editType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Cell Line:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{plan.cellLine}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Nuclease:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{plan.nuclease}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {(plan.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {guides.length > 0 && (
              <Card className="p-4">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Guide Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Guides:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{guides.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">High Risk:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {guides.filter((g) => g.offtargetRisk === "high").length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Recommended:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {guides.filter((g) => g.offtargetRisk === "low").length}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {summary && summary.bestGuide && (
              <Card className={`p-4 ${
                summary.bestGuide.offtargetRisk === 'high' 
                  ? 'border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20' 
                  : 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
              }`}>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Beaker className="w-4 h-4" />
                  Best Guide
                  {summary.bestGuide.offtargetRisk === 'high' && (
                    <Badge variant="destructive" className="text-xs">High Risk</Badge>
                  )}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">ID:</span>
                    <Badge variant="secondary">{summary.bestGuide.id.toUpperCase()}</Badge>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Sequence:</span>
                    <code className="block bg-white dark:bg-gray-700 px-2 py-1 rounded mt-1 font-mono text-xs">
                      {summary.bestGuide.seq}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Off-target Risk:</span>
                    <Badge 
                      variant={
                        summary.bestGuide.offtargetRisk === 'low' 
                          ? 'secondary' 
                          : summary.bestGuide.offtargetRisk === 'medium' 
                            ? 'outline' 
                            : 'destructive'
                      }
                    >
                      {summary.bestGuide.offtargetRisk}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Efficiency:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {(summary.bestGuide.efficiency * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {summary && !summary.bestGuide && (
              <Card className="p-4 border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  No Recommended Guide
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No low-risk guides were found. All designed guides have medium or high off-target risk. 
                  Consider optimizing the target sequence or using additional safety measures.
                </p>
              </Card>
            )}

            {/* Feedback Section */}
            {showFeedback && orchestrator && (
              <Card className="p-4 border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">How did we do?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Your feedback helps our AI agents learn and improve.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      orchestrator.provideFeedback('positive')
                      setShowFeedback(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Good Results
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      orchestrator.provideFeedback('negative')
                      setShowFeedback(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Needs Improvement
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Center Panel - Sequence Viewer */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {plan?.gene || "TP53"} Sequence Visualization
              </h2>
              <div className="flex gap-2">
                {guides.length > 0 && (
                  <Button onClick={downloadCSV} size="sm" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                )}
                {summary && (
                  <Button onClick={downloadProtocol} size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Protocol
                  </Button>
                )}
              </div>
            </div>

            <SequenceViewer
              sequence={
                plan?.gene
                  ? plan.gene === "BRCA1"
                    ? "ATGGATTTCCGTCTGAGTCAGGAAACATTTTCAGACCTATGGAAACTACTTCCTGAAAACAACGTTCTGTCCCCCTTGCCGTCCCAAGCAATGGATGATTTGATGCTGTCCCCGGACGATATTGAACAATGGTTCACTGAAGACCCAGGTCCAGATGAAGCTCCCAGAATGCCAGAGGCTGCTCCCCCCGTGGCCCCTGCACCAGCAGCTCCTACACCGGCGGCCCCTGCACCAGCCCCCTCCTGGCCCCTGTCATCTTCTGTCCCTTCCCAGAAAACCTACCAGGGCAGCTACGGTTTCCGTCTGGGCTTCTTGCATTCTGGGACAGCCAAGTCTGTGACTTGCACGTACTCCCCTGCCCTCAACAAGATGTTTTGCCAACTGGCCAAGACCTGCCCTGTGCAGCTGTGGGTTGATTCCACACCCCCGCCCGGCACCCGCGTCCGCGCCATGGCCATCTACAAGCAGTCACAGCACATGACGGAGGTTGTGAGGCGCTGCCCCCACCATGAGCGCTGCTCAGATAGCGATGGTCTGGCCCCTCCTCAGCATCTTATCCGAGTGGAAGGAAATTTGCGTGTGGAGTATTTGGATGACAGAAACACTTTTCGACATAGTGTGGTGGTGCCCTATGAGCCGCCTGAGGTTGGCTCTGACTGTACCACCATCCACTACAACTACATGTGTAACAGTTCCTGCATGGGCGGCATGAACCGGAGGCCCATCCTCACCATCATCACACTGGAAGACTCCAGTGGTAATCTACTGGGACGGAACAGCTTTGAGGTGCGTGTTTGTGCCTGTCCTGGGAGAGACCGGCGCACAGAGGAAGAGAATCTCCGCAAGAAAGGGGAGCCTCACCACGAGCTGCCCCCAGGGAGCACTAAGCGAGCACTGCCCAACAACACCAGCTCCTCTCCCCAGCCAAAGAAGAAACCACTGGATGGAGAATATTTCACCCTTCAGATCCGTGGGCGTGAGCGCTTCGAGATGTTCCGAGAGCTGAATGAGGCCTTGGAACTCAAGGATGCCCAGGCTGGGAAGGAGCCAGGGGGGAGCAGGGCTCACTCCAGCCACCTGAAGTCCAAAAAGGGTCAGTCTACCTCCCGCCATAAAAAACTCATGTTCAAGACAGAAGGGCCTGACTCAGACTGACATTCTCCACTTCTTGTTCCCCACTGACAGCCTCCCACCCCCATCTCTCCCTCCCCTGCCATTTTGGGTTTTGGGTCTTTGAACCCTTGCTTGCAATAGGTGTGCGTCAGAAGCACCCAGGACTTCCATTTGCTTTGTCCCGGGGCTCCACTGAACAAGTTGGCCTGCACTGGTGTTTTGTTGTGGGGAGGAGGATGGGGAGTAGGACATACCAGCTTAGATTTTAAGGTTTTTACTGTGAGGGATGTTTGGGAGATGTAAGAAATGTTCTTGCAGTTAAGGGTTAGTTTACAATCAGCCACATTCTAGGTAGGGGCCCACTTCACCGTACTAACCAGGGAAGCTGTCCCTCACTGTTGAATTTTCTCTAACTTCAAGGCCCATATCTGTGAAATGCTGGCATTTGCACCTACCTCACAGAGTGCATTGTGAGGGTTAATGAAATAATGTACATCTGGCCTTGAAACCACCTTTTATTACATGGGGTCTAGAACTTGACCCCCTTGAGGGTGCTTGTTCCCTCTCCCTGTTGGTCGGTGGGTTGGTAGTTTCTACAGTTGGGCAGCTGGTTAGGTAGAGGGAGTTGTCAAGTCTCTGCTGGCCCAGCCAAACCCTGTCTGACAACCTCTTGGTGAACCTTAGTACCTAAAAGGAAATCTCACCCCATCCCACACCCTGGAGGATTTCATCTCTTGTATATGATGATCTGGATCCACCAAGACTTGTTTTATGCTCAGGGTCAATTTCTTTTTTCTTTTTTTTTTTTTTTTCTTTTTCTTTGAGACTGGGTCTCGCTTTGTTGCCCAGGCTGGAGTGGAGTGGCGTGATCTTGGCTTACTGCAGCCTTTGCCTCCCCGGCTCGAGCAGTCCTGCCTCAGCCTCCGGAGTAGCTGGGACCACAGGTTCATGCCACCATGGCCAGCCAACTTTTGCATGTTTTGTAGAGATGGGGTCTCACTATGTTGCCCAGGCTGGTCTCAAACTCCTGGGCTCAAGCGATCCACCTGTCTCGGCCTCCCAAAGTGCTGGGATTACAATGTGAGCCACCACGTCCAGCTGGAAGGGTCAACATCTTTTACATTCTGCAAGCACATCTGCATTTTCACCCCACCCTTCCCCTCCTTCTCCCTTTTTATATCCCATTTTTATATCGATCTCTTATTTTACAATAAAACTTTGCTGCCACCTGTGTGTCTGTGTTTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGA"
                    : "ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCTATGGAAACTACTTCCTGAAAACAACGTTCTGTCCCCCTTGCCGTCCCAAGCAATGGATGATTTGATGCTGTCCCCGGACGATATTGAACAATGGTTCACTGAAGACCCAGGTCCAGATGAAGCTCCCAGAATGCCAGAGGCTGCTCCCCCCGTGGCCCCTGCACCAGCAGCTCCTACACCGGCGGCCCCTGCACCAGCCCCCTCCTGGCCCCTGTCATCTTCTGTCCCTTCCCAGAAAACCTACCAGGGCAGCTACGGTTTCCGTCTGGGCTTCTTGCATTCTGGGACAGCCAAGTCTGTGACTTGCACGTACTCCCCTGCCCTCAACAAGATGTTTTGCCAACTGGCCAAGACCTGCCCTGTGCAGCTGTGGGTTGATTCCACACCCCCGCCCGGCACCCGCGTCCGCGCCATGGCCATCTACAAGCAGTCACAGCACATGACGGAGGTTGTGAGGCGCTGCCCCCACCATGAGCGCTGCTCAGATAGCGATGGTCTGGCCCCTCCTCAGCATCTTATCCGAGTGGAAGGAAATTTGCGTGTGGAGTATTTGGATGACAGAAACACTTTTCGACATAGTGTGGTGGTGCCCTATGAGCCGCCTGAGGTTGGCTCTGACTGTACCACCATCCACTACAACTACATGTGTAACAGTTCCTGCATGGGCGGCATGAACCGGAGGCCCATCCTCACCATCATCACACTGGAAGACTCCAGTGGTAATCTACTGGGACGGAACAGCTTTGAGGTGCGTGTTTGTGCCTGTCCTGGGAGAGACCGGCGCACAGAGGAAGAGAATCTCCGCAAGAAAGGGGAGCCTCACCACGAGCTGCCCCCAGGGAGCACTAAGCGAGCACTGCCCAACAACACCAGCTCCTCTCCCCAGCCAAAGAAGAAACCACTGGATGGAGAATATTTCACCCTTCAGATCCGTGGGCGTGAGCGCTTCGAGATGTTCCGAGAGCTGAATGAGGCCTTGGAACTCAAGGATGCCCAGGCTGGGAAGGAGCCAGGGGGGAGCAGGGCTCACTCCAGCCACCTGAAGTCCAAAAAGGGTCAGTCTACCTCCCGCCATAAAAAACTCATGTTCAAGACAGAAGGGCCTGACTCAGACTGACATTCTCCACTTCTTGTTCCCCACTGACAGCCTCCCACCCCCATCTCTCCCTCCCCTGCCATTTTGGGTTTTGGGTCTTTGAACCCTTGCTTGCAATAGGTGTGCGTCAGAAGCACCCAGGACTTCCATTTGCTTTGTCCCGGGGCTCCACTGAACAAGTTGGCCTGCACTGGTGTTTTGTTGTGGGGAGGAGGATGGGGAGTAGGACATACCAGCTTAGATTTTAAGGTTTTTACTGTGAGGGATGTTTGGGAGATGTAAGAAATGTTCTTGCAGTTAAGGGTTAGTTTACAATCAGCCACATTCTAGGTAGGGGCCCACTTCACCGTACTAACCAGGGAAGCTGTCCCTCACTGTTGAATTTTCTCTAACTTCAAGGCCCATATCTGTGAAATGCTGGCATTTGCACCTACCTCACAGAGTGCATTGTGAGGGTTAATGAAATAATGTACATCTGGCCTTGAAACCACCTTTTATTACATGGGGTCTAGAACTTGACCCCCTTGAGGGTGCTTGTTCCCTCTCCCTGTTGGTCGGTGGGTTGGTAGTTTCTACAGTTGGGCAGCTGGTTAGGTAGAGGGAGTTGTCAAGTCTCTGCTGGCCCAGCCAAACCCTGTCTGACAACCTCTTGGTGAACCTTAGTACCTAAAAGGAAATCTCACCCCATCCCACACCCTGGAGGATTTCATCTCTTGTATATGATGATCTGGATCCACCAAGACTTGTTTTATGCTCAGGGTCAATTTCTTTTTTCTTTTTTTTTTTTTTTTCTTTTTCTTTGAGACTGGGTCTCGCTTTGTTGCCCAGGCTGGAGTGGAGTGGCGTGATCTTGGCTTACTGCAGCCTTTGCCTCCCCGGCTCGAGCAGTCCTGCCTCAGCCTCCGGAGTAGCTGGGACCACAGGTTCATGCCACCATGGCCAGCCAACTTTTGCATGTTTTGTAGAGATGGGGTCTCACTATGTTGCCCAGGCTGGTCTCAAACTCCTGGGCTCAAGCGATCCACCTGTCTCGGCCTCCCAAAGTGCTGGGATTACAATGTGAGCCACCACGTCCAGCTGGAAGGGTCAACATCTTTTACATTCTGCAAGCACATCTGCATTTTCACCCCACCCTTCCCCTCCTTCTCCCTTTTTATATCCCATTTTTATATCGATCTCTTATTTTACAATAAAACTTTGCTGCCACCTGTGTGTCTGTGTTTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGA"
                  : "ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCTATGGAAACTACTTCCTGAAAACAACGTTCTGTCCCCCTTGCCGTCCCAAGCAATGGATGATTTGATGCTGTCCCCGGACGATATTGAACAATGGTTCACTGAAGACCCAGGTCCAGATGAAGCTCCCAGAATGCCAGAGGCTGCTCCCCCCGTGGCCCCTGCACCAGCAGCTCCTACACCGGCGGCCCCTGCACCAGCCCCCTCCTGGCCCCTGTCATCTTCTGTCCCTTCCCAGAAAACCTACCAGGGCAGCTACGGTTTCCGTCTGGGCTTCTTGCATTCTGGGACAGCCAAGTCTGTGACTTGCACGTACTCCCCTGCCCTCAACAAGATGTTTTGCCAACTGGCCAAGACCTGCCCTGTGCAGCTGTGGGTTGATTCCACACCCCCGCCCGGCACCCGCGTCCGCGCCATGGCCATCTACAAGCAGTCACAGCACATGACGGAGGTTGTGAGGCGCTGCCCCCACCATGAGCGCTGCTCAGATAGCGATGGTCTGGCCCCTCCTCAGCATCTTATCCGAGTGGAAGGAAATTTGCGTGTGGAGTATTTGGATGACAGAAACACTTTTCGACATAGTGTGGTGGTGCCCTATGAGCCGCCTGAGGTTGGCTCTGACTGTACCACCATCCACTACAACTACATGTGTAACAGTTCCTGCATGGGCGGCATGAACCGGAGGCCCATCCTCACCATCATCACACTGGAAGACTCCAGTGGTAATCTACTGGGACGGAACAGCTTTGAGGTGCGTGTTTGTGCCTGTCCTGGGAGAGACCGGCGCACAGAGGAAGAGAATCTCCGCAAGAAAGGGGAGCCTCACCACGAGCTGCCCCCAGGGAGCACTAAGCGAGCACTGCCCAACAACACCAGCTCCTCTCCCCAGCCAAAGAAGAAACCACTGGATGGAGAATATTTCACCCTTCAGATCCGTGGGCGTGAGCGCTTCGAGATGTTCCGAGAGCTGAATGAGGCCTTGGAACTCAAGGATGCCCAGGCTGGGAAGGAGCCAGGGGGGAGCAGGGCTCACTCCAGCCACCTGAAGTCCAAAAAGGGTCAGTCTACCTCCCGCCATAAAAAACTCATGTTCAAGACAGAAGGGCCTGACTCAGACTGACATTCTCCACTTCTTGTTCCCCACTGACAGCCTCCCACCCCCATCTCTCCCTCCCCTGCCATTTTGGGTTTTGGGTCTTTGAACCCTTGCTTGCAATAGGTGTGCGTCAGAAGCACCCAGGACTTCCATTTGCTTTGTCCCGGGGCTCCACTGAACAAGTTGGCCTGCACTGGTGTTTTGTTGTGGGGAGGAGGATGGGGAGTAGGACATACCAGCTTAGATTTTAAGGTTTTTACTGTGAGGGATGTTTGGGAGATGTAAGAAATGTTCTTGCAGTTAAGGGTTAGTTTACAATCAGCCACATTCTAGGTAGGGGCCCACTTCACCGTACTAACCAGGGAAGCTGTCCCTCACTGTTGAATTTTCTCTAACTTCAAGGCCCATATCTGTGAAATGCTGGCATTTGCACCTACCTCACAGAGTGCATTGTGAGGGTTAATGAAATAATGTACATCTGGCCTTGAAACCACCTTTTATTACATGGGGTCTAGAACTTGACCCCCTTGAGGGTGCTTGTTCCCTCTCCCTGTTGGTCGGTGGGTTGGTAGTTTCTACAGTTGGGCAGCTGGTTAGGTAGAGGGAGTTGTCAAGTCTCTGCTGGCCCAGCCAAACCCTGTCTGACAACCTCTTGGTGAACCTTAGTACCTAAAAGGAAATCTCACCCCATCCCACACCCTGGAGGATTTCATCTCTTGTATATGATGATCTGGATCCACCAAGACTTGTTTTATGCTCAGGGTCAATTTTTTTTTCTTTTTTTTTTTTTTTTCTTTTTCTTTGAGACTGGGTCTCGCTTTGTTGCCCAGGCTGGAGTGGAGTGGCGTGATCTTGGCTTACTGCAGCCTTTGCCTCCCCGGCTCGAGCAGTCCTGCCTCAGCCTCCGGAGTAGCTGGGACCACAGGTTCATGCCACCATGGCCAGCCAACTTTTGCATGTTTTGTAGAGATGGGGTCTCACTATGTTGCCCAGGCTGGTCTCAAACTCCTGGGCTCAAGCGATCCACCTGTCTCGGCCTCCCAAAGTGCTGGGATTACAATGTGAGCCACCACGTCCAGCTGGAAGGGTCAACATCTTTTACATTCTGCAAGCACATCTGCATTTTCACCCCACCCTTCCCCTCCTTCTCCCTTTTTATATCCCATTTTTATATCGATCTCTTATTTTACAATAAAACTTTGCTGCCACCTGTGTGTCTGTGTTTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGTGA"
              }
              guides={guides}
            />

            {guides.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Guide RNA Details</h3>
                <div className="grid gap-3">
                  {guides.map((guide) => (
                    <Card key={guide.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              guide.offtargetRisk === "high"
                                ? "destructive"
                                : guide.offtargetRisk === "medium"
                                  ? "secondary"
                                  : "default"
                            }
                          >
                            {guide.id.toUpperCase()}
                          </Badge>
                          <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{guide.seq}</code>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>
                            Efficiency: <strong>{(guide.efficiency * 100).toFixed(0)}%</strong>
                          </span>
                          <span>
                            GC: <strong>{guide.gcContent}%</strong>
                          </span>
                          {guide.riskScore && (
                            <span>
                              Risk: <strong>{(guide.riskScore * 100).toFixed(0)}%</strong>
                            </span>
                          )}
                          {guide.offtargetRisk === "high" && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              High Risk
                            </Badge>
                          )}
                        </div>
                      </div>
                      {guide.riskFactors && guide.riskFactors.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          Risk factors: {guide.riskFactors.join(", ")}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {summary && (
              <Card className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Final Summary & Protocol
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Risk Assessment</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{summary.riskSummary}</p>

                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Next Steps</h4>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      {summary.nextSteps.slice(0, 3).map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Recommended Guides</h4>
                    <div className="space-y-2">
                      {summary.recommendedGuides.slice(0, 3).map((guide) => (
                        <div
                          key={guide.id}
                          className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 p-2 rounded"
                        >
                          <Badge variant="outline">{guide.id.toUpperCase()}</Badge>
                          <span className="text-gray-600 dark:text-gray-400">
                            {(guide.efficiency * 100).toFixed(1)}% efficiency
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={startResizing}
          className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 transition-colors"
        ></div>

        {/* Right Panel - Agent Chat */}
        <div style={{ width: sidebarWidth }} className="bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
          <AgentChat messages={agentMessages} />
        </div>
      </div>
    </div>
  )
}
