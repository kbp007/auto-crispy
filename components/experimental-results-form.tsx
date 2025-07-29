import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ExperimentalResultsForm() {
  const [fileName, setFileName] = useState<string>("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileName(e.target.files[0].name)
    } else {
      setFileName("")
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Fake submit – just visual feedback for now
    alert("✅ Experimental results submitted! (mock)")
  }

  return (
    <Card className="p-4 space-y-4 mt-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Add Experimental Results</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Attach File (CSV, FASTA, etc.)</label>
          <Input type="file" onChange={handleFileChange} />
          {fileName && <p className="text-xs text-gray-500 mt-1">Selected: {fileName}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes / Metadata</label>
          <textarea
            className="w-full h-24 p-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Cell line response, editing efficiency percentages, off-target validation data…"
          ></textarea>
        </div>

        <Button type="submit" className="w-full">Submit Results</Button>
      </form>
    </Card>
  )
} 