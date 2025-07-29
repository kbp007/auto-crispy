import { PlannerAgent, type PlanObject } from "./agents/planner-agent"
import { GuideDesigner } from "./agents/guide-designer"
import { RiskAnalyst } from "./agents/risk-analyst"
import { UndergradAgent } from "./agents/undergrad-agent"
import type { AgentMessage, Guide, FinalSummary } from "./types"
import { BaseAgent } from "./agents/base-agent"
import OpenAI from "openai"
import { config } from "./config"
import { parseJsonResponse, generateMessageId } from "./utils"

interface AgentTask {
  id: string
  type: string
  assignee: string
  priority: number
  dependencies: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: unknown
}

export class CrisprOrchestrator {
  private plannerAgent: PlannerAgent
  private guideDesigner: GuideDesigner
  private riskAnalyst: RiskAnalyst
  private undergradAgent: UndergradAgent
  private onMessage: (message: AgentMessage) => void
  private agents: Map<string, BaseAgent>
  private tasks: Map<string, AgentTask>
  private openai: OpenAI
  private userFeedback: Array<{ action: string; feedback: 'positive' | 'negative'; context: Record<string, unknown> }>
  private currentPrompt: string = ""

  constructor(onMessage: (message: AgentMessage) => void) {
    this.onMessage = onMessage
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
      dangerouslyAllowBrowser: true,
    })
    
    // Initialize agents
    this.plannerAgent = new PlannerAgent(onMessage)
    this.guideDesigner = new GuideDesigner(onMessage)
    this.riskAnalyst = new RiskAnalyst(onMessage)
    this.undergradAgent = new UndergradAgent(onMessage)
    
    // Register agents for inter-agent communication
    this.agents = new Map([
      ['PlannerAgent', this.plannerAgent as BaseAgent],
      ['GuideDesigner', this.guideDesigner as BaseAgent],
      ['RiskAnalyst', this.riskAnalyst as BaseAgent],
      ['UndergradAgent', this.undergradAgent as BaseAgent]
    ])
    
    // Enable agent collaboration
    this.agents.forEach((agent, name) => {
      this.agents.forEach((collaborator, collabName) => {
        if (name !== collabName && agent instanceof BaseAgent && collaborator instanceof BaseAgent) {
          agent.registerCollaborator(collaborator)
        }
      })
    })
    
    this.tasks = new Map()
    this.userFeedback = []
  }

  async processPrompt(prompt: string): Promise<{
    plan: PlanObject
    guides: Guide[]
    summary: FinalSummary
  }> {
    this.currentPrompt = prompt
    try {
      // Autonomous task planning
      const taskPlan = await this.planTasks(prompt)
      
      this.onMessage({
        id: generateMessageId(),
        agent: "Orchestrator",
        status: "thinking",
        message: `Created autonomous execution plan with ${taskPlan.length} tasks. Agents will collaborate as needed.`,
        timestamp: new Date(),
      })

      // Execute tasks autonomously with agent collaboration
      const results = await this.executeTasksAutonomously(taskPlan)
      
      // Gather feedback and adapt
      const finalResult = await this.consolidateResults(results)
      
      // Learn from this interaction
      this.learnFromExecution(prompt, finalResult)
      
      return finalResult
    } catch (error) {
      this.onMessage({
        id: generateMessageId(),
        agent: "Orchestrator",
        status: "complete",
        message: `Error in autonomous processing: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      })
      throw error
    }
  }

  private async planTasks(prompt: string): Promise<AgentTask[]> {
    // AI-driven task planning
    const planningPrompt = `
You are orchestrating a team of specialized AI agents for CRISPR experiment design:
- PlannerAgent: Natural language understanding and experiment planning
- GuideDesigner: CRISPR guide RNA design with genome expertise  
- RiskAnalyst: Off-target prediction and safety assessment
- UndergradAgent: Protocol generation and experimental guidance

User request: "${prompt}"

Previous successful patterns: ${JSON.stringify(this.userFeedback.filter(f => f.feedback === 'positive').slice(-3))}

Create a task execution plan that:
1. Allows agents to work autonomously
2. Enables parallel execution where possible
3. Includes decision points for agent collaboration
4. Adapts based on intermediate results

Return a JSON object with a "tasks" array containing task objects. Each task should have:
- id: unique identifier
- type: task type
- assignee: agent name
- priority: 1-5 (5 highest)
- dependencies: array of task IDs that must complete first

Format: {"tasks": [...]}
`

    const response = await this.openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: "system", content: "You are an AI orchestration expert. Return valid JSON only." },
        { role: "user", content: planningPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    })

    const responseContent = response.choices[0]?.message?.content || '{"tasks": []}'
    console.log('OpenAI raw response:', responseContent)
    console.log('First 100 chars:', responseContent.substring(0, 100))
    
    const parsed = parseJsonResponse(responseContent) as { tasks: AgentTask[] }
    const tasks = parsed.tasks || []
    
    // Initialize task statuses
    tasks.forEach(task => {
      task.status = 'pending'
      this.tasks.set(task.id, task)
    })
    
    return tasks
  }

  private async executeTasksAutonomously(tasks: AgentTask[]): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>()
    const executing = new Set<string>()
    
    // Store the user prompt for all agents to access
    const userPrompt = this.currentPrompt || "Default CRISPR experiment"
    
    // Create a map for quick task lookup by ID
    const taskMap = new Map<string, AgentTask>()
    tasks.forEach(task => taskMap.set(task.id, task))
    
    let iterationCount = 0
    const maxIterations = 20 // Reduced to prevent infinite loops
    
    // Bind the onMessage callback to preserve context
    const sendMessage = this.onMessage.bind(this)
    
    // Execute tasks respecting dependencies and allowing parallel execution
    while (tasks.some(t => t.status !== 'completed' && t.status !== 'failed') && iterationCount < maxIterations) {
      iterationCount++
      
      // Double check - if all tasks are actually completed or failed, exit
      const incompleteTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'failed')
      if (incompleteTasks.length === 0) {
        console.log('🎯 All tasks completed or failed, finishing execution')
        sendMessage({
          id: generateMessageId(),
          agent: "Orchestrator", 
          status: "complete",
          message: "All workflow tasks completed.",
          timestamp: new Date(),
        })
        break
      }
      
      console.log(`\n=== ITERATION ${iterationCount} ===`)
      console.log('Current task statuses:')
      tasks.forEach(task => {
        console.log(`  ${task.id} (${task.type}) -> ${task.assignee}: ${task.status}`)
      })
      
      // Check if we have enough essential results to complete
      const hasEssentials = results.has('plan') && results.has('guides') && results.has('analyzed_guides')
      if (hasEssentials) {
        console.log('✅ Essential tasks completed, checking if we can finish early')
        const remainingTasks = tasks.filter(t => t.status === 'pending')
        const failedEssentialTasks = tasks.filter(t => t.status === 'failed' && this.isEssentialTask(t.type))
        
        // If no more pending tasks or only non-essential tasks remain, and no essential tasks failed
        if ((remainingTasks.length === 0 || remainingTasks.every(t => !this.isEssentialTask(t.type))) && failedEssentialTasks.length === 0) {
          console.log('🎯 All essential work complete, finishing execution')
          
          // Send completion message
          sendMessage({
            id: generateMessageId(),
            agent: "Orchestrator",
            status: "complete",
            message: "CRISPR guide design workflow completed successfully. All essential tasks finished.",
            timestamp: new Date(),
          })
          
          break
        }
      }
      
      // Find tasks ready to execute
      const readyTasks = tasks.filter(task => 
        task.status === 'pending' &&
        task.dependencies.every(depId => {
          const depTask = taskMap.get(depId)
          const isReady = depTask?.status === 'completed'
          console.log(`    Checking dependency ${depId}: ${depTask?.status} -> ${isReady}`)
          return isReady
        }) &&
        !executing.has(task.id)
      )

      // Additional gating: ensure prerequisites are actually available in results map
      const filteredReadyTasks = readyTasks.filter(task => {
        const norm = this.normalizeTaskType(task.type)
        if (norm === 'guide_design' && !results.has('plan')) return false
        if (norm === 'risk_assessment' && !results.has('guides')) return false
        if (norm === 'protocol_generation' && !results.has('analyzed_guides')) return false
        return true
      })

      console.log(`Ready tasks: ${filteredReadyTasks.map(t => `${t.id}(${t.type})`).join(', ')}`)
      console.log(`Executing tasks: ${Array.from(executing).join(', ')}`)
      
      // Break infinite loop if no tasks are ready
      if (filteredReadyTasks.length === 0) {
        console.warn('No ready tasks found, checking statuses:')
        tasks.forEach(task => {
          console.log(`Task ${task.id} (${task.type}): status=${task.status}, deps=${task.dependencies.join(',')}`)
          task.dependencies.forEach(depId => {
            const depTask = taskMap.get(depId)
            console.log(`  Dependency ${depId}: ${depTask?.status || 'NOT FOUND'}`)
          })
        })
        
        // Force progression only if we're making meaningful progress
        if (iterationCount < 5) {
          // If we have pending tasks but no ready tasks, there might be a circular dependency
          // Let's try to execute the first pending task without dependencies
          const pendingTasksWithoutDeps = tasks.filter(t => t.status === 'pending' && t.dependencies.length === 0)
          if (pendingTasksWithoutDeps.length > 0) {
            console.log('Found pending tasks without dependencies, executing first one:', pendingTasksWithoutDeps[0].id)
            filteredReadyTasks.push(pendingTasksWithoutDeps[0])
          } else {
            // Check if we can force progression by looking at what's needed
            const pendingTasks = tasks.filter(t => t.status === 'pending')
            console.log('Pending tasks:', pendingTasks.map(t => `${t.id}(${t.type})`).join(', '))
            
            // Force progression strategy: If we have results available, try to run tasks that can use them
            if (results.has('plan') && !results.has('guides')) {
              // We have a plan but no guides, force guide design
              const guideTask = pendingTasks.find(t => this.normalizeTaskType(t.type) === 'guide_design')
              if (guideTask) {
                console.log('🔥 FORCING guide design task:', guideTask.id)
                filteredReadyTasks.push(guideTask)
              }
            } else if (results.has('guides') && !results.has('analyzed_guides')) {
              // We have guides but no risk analysis, force risk analysis
              const riskTask = pendingTasks.find(t => this.normalizeTaskType(t.type) === 'risk_assessment')
              if (riskTask) {
                console.log('🔥 FORCING risk analysis task:', riskTask.id)
                filteredReadyTasks.push(riskTask)
              }
            }
          }
        }
        
        // If still no ready tasks after forcing, stop the loop
        if (filteredReadyTasks.length === 0) {
          console.error('Breaking execution loop - no tasks ready to execute')
          break
        }
      }
      
      // Execute ready tasks in parallel but with controlled concurrency
      const executions = filteredReadyTasks.slice(0, 3).map(async task => { // Limit to 3 concurrent tasks
        executing.add(task.id)
        task.status = 'in_progress'
        
        sendMessage({
          id: generateMessageId(),
          agent: "Orchestrator",
          status: "thinking",
          message: `Executing ${task.type} with ${task.assignee}`,
          timestamp: new Date(),
        })
        
        try {
          const agent = this.agents.get(task.assignee)
          if (!agent) throw new Error(`Unknown agent: ${task.assignee}`)
          
          console.log(`Executing task ${task.id} (${task.type}) with agent ${task.assignee}`)
          
          // Execute based on normalized task type
          let result
          const normalizedType = this.normalizeTaskType(task.type)
          
          switch (normalizedType) {
            case 'experiment_planning':
              console.log('Executing planning task with PlannerAgent')
              if (agent === this.plannerAgent) {
                result = await this.plannerAgent.parsePrompt(userPrompt)
                results.set('plan', result)
                console.log('Planning completed, result:', (result as PlanObject)?.gene || 'No gene found')
              } else {
                console.log(`Task ${task.id} assigned to ${task.assignee} instead of PlannerAgent, completing with default result`)
                result = { plan: { gene: 'default', region: 'n/a', editType: 'default', cellLine: 'default', nuclease: 'n/a', confidence: 0 }, completed: true }
              }
              break
              
            case 'guide_design':
              console.log('Executing guide design task with GuideDesigner')
              if (agent === this.guideDesigner) {
                const plan = results.get('plan') as PlanObject
                console.log('Plan for guide design:', plan?.gene || 'No plan found')
                if (!plan) throw new Error('No plan available for guide design')
                result = await this.guideDesigner.designGuides(plan)
                results.set('guides', result)
                console.log('Guide design completed, guides count:', (result as Guide[])?.length || 0)
              } else {
                console.log(`Task ${task.id} assigned to ${task.assignee} instead of GuideDesigner, completing with default result`)
                result = []  // Empty guides array
              }
              break
              
            case 'risk_assessment':
              console.log('Executing risk analysis task with RiskAnalyst')
              if (agent === this.riskAnalyst) {
                const guides = results.get('guides') as Guide[]
                console.log('Guides for risk analysis:', guides?.length || 'No guides found')
                if (!guides || guides.length === 0) throw new Error('No guides available for risk analysis')
                result = await this.riskAnalyst.analyzeRisk(guides)
                results.set('analyzed_guides', result)
                console.log('Risk analysis completed, analyzed guides count:', (result as Guide[])?.length || 0)
              } else {
                console.log(`Task ${task.id} assigned to ${task.assignee} instead of RiskAnalyst, completing with default result`)
                result = []  // Empty analyzed guides array
              }
              break
              
            case 'protocol_generation':
              console.log('Executing protocol/summary task with UndergradAgent')
              if (agent === this.undergradAgent) {
                const plan = results.get('plan') as PlanObject
                const analyzedGuides = results.get('analyzed_guides') as Guide[]
                console.log('Data for summary:', { plan: plan?.gene || 'No plan', guides: analyzedGuides?.length || 0 })
                result = await this.undergradAgent.finalizeSummary(plan, analyzedGuides)
                results.set('summary', result)
                console.log('Summary completed')
              } else {
                console.log(`Task ${task.id} assigned to ${task.assignee} instead of UndergradAgent, completing with default result`)
                result = { 
                  plan: {}, 
                  totalGuides: 0, 
                  recommendedGuides: [], 
                  highRiskGuides: [], 
                  bestGuide: { id: 'none', seq: 'N/A', start: 0, end: 0, gcContent: 0, efficiency: 0, offtargetRisk: 'high' }, 
                  protocol: 'Default protocol', 
                  riskSummary: 'No analysis performed', 
                  nextSteps: [] 
                }
              }
              break
              
            default:
              console.log(`Unknown or unhandled task type: ${task.type}, attempting to complete gracefully`)
              // For other task types, try to handle them gracefully or mark as completed with minimal work
              if (task.type.includes('experiment') || task.type.includes('planning')) {
                // Try to handle planning-related tasks with a basic completion
                result = { 
                  plan: { gene: 'completed', region: 'n/a', editType: 'completed', cellLine: 'completed', nuclease: 'n/a', confidence: 0 },
                  taskType: task.type,
                  completed: true,
                  message: 'Planning task completed'
                }
              } else if (task.type.includes('collaboration') || task.type.includes('decision')) {
                // Handle collaboration tasks
                result = { 
                  decision: 'continue',
                  reasoning: 'All essential tasks completed, no additional collaboration needed',
                  taskType: task.type,
                  completed: true
                }
              } else {
                // Default completion for unknown tasks
                result = { 
                  taskType: task.type, 
                  assignee: task.assignee,
                  completed: true,
                  message: `Completed ${task.type} task`
                }
              }
          }
          
          if (!result) {
            throw new Error(`No result produced for task ${task.id} (${task.type})`)
          }
          
          task.status = 'completed'
          task.result = result
          results.set(task.id, result)
          
          console.log(`✅ Task ${task.id} completed successfully`)
          
          sendMessage({
            id: generateMessageId(),
            agent: task.assignee,
            status: "complete",
            message: `Completed ${task.type}`,
            timestamp: new Date(),
          })
          
        } catch (error) {
          console.error(`❌ Task ${task.id} failed:`, error)
          task.status = 'failed'
          task.result = { error: error instanceof Error ? error.message : 'Unknown error' }
          
          sendMessage({
            id: generateMessageId(),
            agent: task.assignee,
            status: "complete", 
            message: `Failed ${task.type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          })
          
        } finally {
          executing.delete(task.id)
        }
      })
      
      // Wait for all tasks in this batch to complete
      if (executions.length > 0) {
        await Promise.allSettled(executions)
      } else {
        // No tasks ready, wait a bit
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    if (iterationCount >= maxIterations) {
      console.error('Max iterations reached, terminating execution')
      sendMessage({
        id: generateMessageId(),
        agent: "Orchestrator",
        status: "complete",
        message: `Execution terminated after ${maxIterations} iterations to prevent infinite loop`,
        timestamp: new Date(),
      })
    }
    
    return results
  }

  private async executeGenericTask(agent: BaseAgent, task: AgentTask, decision: Record<string, unknown>): Promise<unknown> {
    // Generic task execution based on agent decision
    this.onMessage({
      id: generateMessageId(),
      agent: task.assignee, // Use task.assignee instead of agent.name
      status: "thinking",
      message: `Executing ${task.type}: ${decision.reasoning}`,
      timestamp: new Date(),
    })
    
    return decision.action
  }

  private async consolidateResults(results: Map<string, unknown>): Promise<{
    plan: PlanObject
    guides: Guide[]
    summary: FinalSummary
  }> {
    // Find the key results with proper type assertions
    const plan = (results.get('plan') || results.get('parse_prompt')) as PlanObject
    const guides = (results.get('analyzed_guides') || results.get('guides') || []) as Guide[]
    const summary = (results.get('summary') || results.get('generate_summary')) as FinalSummary
    
    return { plan, guides, summary }
  }

  private learnFromExecution(prompt: string, result: { plan?: PlanObject; guides?: Guide[]; summary?: FinalSummary }) {
    // Store execution pattern for future learning
    this.userFeedback.push({
      action: prompt,
      feedback: 'positive', // Would be set based on actual user feedback
      context: {
        timestamp: Date.now(),
        resultSummary: {
          guidesGenerated: result.guides?.length || 0,
          confidence: (result.plan as PlanObject)?.confidence || 0
        }
      }
    })
  }

  // Allow user to provide feedback
  provideFeedback(feedback: 'positive' | 'negative', context?: Record<string, unknown>) {
    if (this.userFeedback.length > 0) {
      this.userFeedback[this.userFeedback.length - 1].feedback = feedback
      if (context) {
        this.userFeedback[this.userFeedback.length - 1].context = {
          ...this.userFeedback[this.userFeedback.length - 1].context,
          ...context
        }
      }
      
      // Propagate feedback to agents
      this.agents.forEach(agent => {
        if (agent instanceof BaseAgent) {
          agent.learnFromOutcome(
            'user_feedback',
            { feedback, context },
            feedback === 'positive'
          )
        }
      })
    }
  }

  // Helper method to normalize task types
  private normalizeTaskType(taskType: string): string {
    const normalized = taskType.toLowerCase().replace(/[^a-z_]/g, '_')
    
    if (normalized.includes('experiment') || normalized.includes('planning') || normalized.includes('parse')) {
      return 'experiment_planning'
    }
    if (normalized.includes('guide') && (normalized.includes('design') || normalized.includes('rna'))) {
      return 'guide_design'
    }
    if (normalized.includes('risk') || normalized.includes('analysis') || normalized.includes('target') || normalized.includes('safety')) {
      return 'risk_assessment'
    }
    if (normalized.includes('protocol') || normalized.includes('summary') || normalized.includes('execution') || normalized.includes('final')) {
      return 'protocol_generation'
    }
    
    return taskType
  }

  // Helper method to check if a task is essential for completion
  private isEssentialTask(taskType: string): boolean {
    const normalizedType = this.normalizeTaskType(taskType)
    return normalizedType === 'experiment_planning' || normalizedType === 'guide_design' || normalizedType === 'risk_assessment'
  }
}
