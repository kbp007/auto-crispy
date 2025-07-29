import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate unique message IDs to prevent React key conflicts
 */
let messageIdCounter = 0
export function generateMessageId(): number {
  return Date.now() + (++messageIdCounter)
}

/**
 * Parse JSON response from LLM that might be wrapped in markdown code blocks
 */
export function parseJsonResponse<T = unknown>(content: string): T {
  if (!content) throw new Error('Empty content provided to parseJsonResponse')
  
  // Remove markdown code block markers if present
  let cleanContent = content.trim()
  
  // Log original content for debugging
  console.log('Original content:', cleanContent.substring(0, 100) + '...')
  
  // Check for ```json or ``` markers at the beginning
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.substring(7) // Remove ```json
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.substring(3) // Remove ```
  }
  
  // Remove trailing ``` if present
  if (cleanContent.endsWith('```')) {
    cleanContent = cleanContent.substring(0, cleanContent.length - 3)
  }
  
  // Trim again after removing backticks
  cleanContent = cleanContent.trim()
  
  // Remove any remaining backticks that might be scattered
  if (cleanContent.includes('`')) {
    console.warn('Found additional backticks in content, this might indicate malformed response')
  }
  
  // Try to parse the cleaned content
  try {
    return JSON.parse(cleanContent)
  } catch (error) {
    console.error('Failed to parse JSON:', error)
    console.error('Cleaned content:', cleanContent)
    console.error('First 50 chars:', cleanContent.substring(0, 50))
    console.error('Last 50 chars:', cleanContent.substring(Math.max(0, cleanContent.length - 50)))
    throw new Error(`Invalid JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
