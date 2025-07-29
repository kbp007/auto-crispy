"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Sparkles, Dna } from "lucide-react"
import WorkspaceView from "@/components/workspace-view"

const examplePrompts = [
  "Knock out TP53 exon 4 in HEK293 cells using SpCas9", // We have real exon 4 data
  "Design guides to disrupt p53 DNA binding domain in cancer cells",
  "I need to create TP53-null cells for tumor suppressor research",
  "Target p53 phosphoprotein for CRISPR knockout in HeLa cells",
]

export default function HomePage() {
  const [prompt, setPrompt] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setIsLoading(true)
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSubmitted(true)
    setIsLoading(false)
  }

  const handleExampleClick = (example: string) => {
    setPrompt(example)
  }

  if (isSubmitted) {
    return <WorkspaceView prompt={prompt} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto text-center space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Dna className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AutoCrisp
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Prompt-driven genome editing assistant. Describe your edit in natural language, and I&apos;ll design the guides,
            analyze risks, and visualize the results.
          </p>
        </div>

        {/* Main Input */}
        <Card className="p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What would you like to edit?"
                className="text-lg p-6 border-2 border-gray-200 focus:border-blue-500 rounded-xl"
                disabled={isLoading}
              />
              <Sparkles className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 text-lg rounded-xl"
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                "Design Guides"
              )}
            </Button>
          </form>
        </Card>

        {/* Example Prompts */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Try these examples:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {examplePrompts.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="p-4 text-left bg-white/60 dark:bg-gray-700/60 hover:bg-white/80 dark:hover:bg-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-400 transition-all duration-200 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                disabled={isLoading}
              >
                &quot;{example}&quot;
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This is a research prototype. Always validate designs experimentally.
        </p>
      </div>
    </div>
  )
}
