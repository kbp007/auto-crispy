"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Info } from "lucide-react"
import type { Guide } from "@/lib/types"

interface SequenceViewerProps {
  sequence: string
  guides: Guide[]
}

export default function SequenceViewer({ sequence, guides }: SequenceViewerProps) {
  const [hoveredGuide, setHoveredGuide] = useState<string | null>(null)
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null)

  const renderSequence = () => {
    const chars = sequence.split("")
    const charsPerLine = 60
    const lines = []

    for (let i = 0; i < chars.length; i += charsPerLine) {
      const lineChars = chars.slice(i, i + charsPerLine)
      const lineStart = i

      lines.push(
        <div key={i} className="font-mono text-sm mb-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {lineStart + 1}-{Math.min(lineStart + charsPerLine, chars.length)}
          </div>
          <div className="flex flex-wrap">
            {lineChars.map((char, charIndex) => {
              const globalIndex = lineStart + charIndex
              const guidesAtPosition = guides.filter((guide) => globalIndex >= guide.start && globalIndex < guide.end)

              let className = "w-3 h-6 flex items-center justify-center text-xs "

              if (guidesAtPosition.length > 0) {
                const guide = guidesAtPosition[0]
                const isHovered = hoveredGuide === guide.id
                const isSelected = selectedGuide === guide.id

                if (guide.offtargetRisk === "high") {
                  className +=
                    isHovered || isSelected
                      ? "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 border border-red-400"
                      : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                } else if (guide.offtargetRisk === "medium") {
                  className +=
                    isHovered || isSelected
                      ? "bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 border border-yellow-400"
                      : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                } else {
                  className +=
                    isHovered || isSelected
                      ? "bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 border border-blue-400"
                      : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                }

                className += " cursor-pointer hover:scale-110 transition-transform"
              } else {
                className += "text-gray-700 dark:text-gray-300"
              }

              return (
                <span
                  key={charIndex}
                  className={className}
                  onMouseEnter={() => {
                    if (guidesAtPosition.length > 0) {
                      setHoveredGuide(guidesAtPosition[0].id)
                    }
                  }}
                  onMouseLeave={() => setHoveredGuide(null)}
                  onClick={() => {
                    if (guidesAtPosition.length > 0) {
                      setSelectedGuide(selectedGuide === guidesAtPosition[0].id ? null : guidesAtPosition[0].id)
                    }
                  }}
                  title={
                    guidesAtPosition.length > 0
                      ? `Guide: ${guidesAtPosition[0].id} (${guidesAtPosition[0].offtargetRisk} risk)`
                      : undefined
                  }
                >
                  {char}
                </span>
              )
            })}
          </div>
        </div>,
      )
    }

    return lines
  }

  const selectedGuideData = selectedGuide ? guides.find((g) => g.id === selectedGuide) : null

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            DNA Sequence ({sequence.length.toLocaleString()} bp)
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900 rounded"></div>
              <span>Low Risk</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-100 dark:bg-yellow-900 rounded"></div>
              <span>Medium Risk</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-100 dark:bg-red-900 rounded"></div>
              <span>High Risk</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg max-h-96 overflow-y-auto">{renderSequence()}</div>
      </Card>

      {selectedGuideData && (
        <Card className="p-4 border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  selectedGuideData.offtargetRisk === "high"
                    ? "destructive"
                    : selectedGuideData.offtargetRisk === "medium"
                      ? "secondary"
                      : "default"
                }
              >
                {selectedGuideData.id.toUpperCase()}
              </Badge>
              <span className="font-medium">Guide Details</span>
            </div>
            {selectedGuideData.offtargetRisk === "high" && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                High Risk
              </Badge>
            )}
            {selectedGuideData.offtargetRisk === "medium" && (
              <Badge variant="secondary" className="text-xs">
                <Info className="w-3 h-3 mr-1" />
                Medium Risk
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Sequence:</span>
              <code className="block bg-white dark:bg-gray-700 px-2 py-1 rounded mt-1 font-mono">
                {selectedGuideData.seq}
              </code>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Position:</span>
              <div className="font-medium">
                {selectedGuideData.start}-{selectedGuideData.end}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Efficiency:</span>
              <div className="font-medium">{(selectedGuideData.efficiency * 100).toFixed(1)}%</div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">GC Content:</span>
              <div className="font-medium">{selectedGuideData.gcContent}%</div>
            </div>
            {selectedGuideData.pamSite && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">PAM Site:</span>
                <div className="font-medium">{selectedGuideData.pamSite}</div>
              </div>
            )}
            {selectedGuideData.strand && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Strand:</span>
                <div className="font-medium">{selectedGuideData.strand}</div>
              </div>
            )}
            {selectedGuideData.riskScore !== undefined && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Risk Score:</span>
                <div className="font-medium">{(selectedGuideData.riskScore * 100).toFixed(1)}%</div>
              </div>
            )}
            {selectedGuideData.predictedOfftargets !== undefined && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Off-targets:</span>
                <div className="font-medium">{selectedGuideData.predictedOfftargets}</div>
              </div>
            )}
          </div>

          {selectedGuideData.riskFactors && selectedGuideData.riskFactors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
              <span className="text-gray-600 dark:text-gray-400 text-sm">Risk Factors:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedGuideData.riskFactors.map((factor, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {factor}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
