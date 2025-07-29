"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bot, Clock, CheckCircle } from "lucide-react"
import ExperimentalResultsForm from "@/components/experimental-results-form"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

interface AgentMessage {
  id: number
  agent: string
  status: "thinking" | "complete"
  message: string
  timestamp: Date
}

interface AgentChatProps {
  messages: AgentMessage[]
}

const agentColors = {
  PlannerAgent: "bg-purple-100 text-purple-800",
  GuideDesigner: "bg-blue-100 text-blue-800",
  RiskAnalyst: "bg-orange-100 text-orange-800",
}

export default function AgentChat({ messages }: AgentChatProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Bot className="w-5 h-5" />
          Agent Activity
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <Card key={message.id} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={agentColors[message.agent as keyof typeof agentColors] || "bg-gray-100 text-gray-800"}>
                {message.agent}
              </Badge>
              {message.status === "thinking" ? (
                <Clock className="w-4 h-4 text-yellow-500" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
            </div>

            {message.status === "thinking" ? (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <div className="flex gap-1">
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{message.message}</p>
            )}

            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </Card>
        ))}
      </div>

      {/* Experimental results submission UI */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
          onClick={() => setShowForm(!showForm)}
        >
          <span className="text-gray-700 dark:text-gray-200">Add Experimental Results</span>
          {showForm ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {showForm && (
          <div className="p-4">
            <ExperimentalResultsForm />
          </div>
        )}
      </div>
    </div>
  )
}
