"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileUp, FileText, X, Loader2 } from "lucide-react"

interface TemplateNode {
  node_id: string
  node_name: string
  sequence_order: number
  description?: string
}

interface RevisionUploaderProps {
  sessionId: string
  templateNodes?: TemplateNode[]
  onCreated?: (revisionId: string) => void
  onProcessed?: (revisionId: string) => void
}

export function RevisionUploader({ sessionId, templateNodes = [], onCreated, onProcessed }: RevisionUploaderProps) {
  const [uploads, setUploads] = useState<Map<string, { file: File, base64: string }>>(new Map())
  const [creating, setCreating] = useState(false)
  const [nodes, setNodes] = useState<TemplateNode[]>(templateNodes)
  const [processing, setProcessing] = useState(false)
  const [statusText, setStatusText] = useState<string>("")

  useEffect(() => {
    async function loadNodes() {
      if (templateNodes.length > 0) return
      try {
        const sr = await fetch(`/api/reviews/${sessionId}`)
        if (!sr.ok) return
        const sj = await sr.json()
        const tr = await fetch(`/api/templates/${sj.session.template_id}`)
        if (!tr.ok) return
        const tj = await tr.json()
        const mapped = (tj.nodes || []).map((n: any) => ({
          node_id: n.node_id,
          node_name: n.node_name || 'Section',
          sequence_order: n.sequence_order,
          description: n.description,
        })) as TemplateNode[]
        setNodes(mapped)
      } catch {}
    }
    loadNodes()
  }, [sessionId])

  async function handleFile(nodeId: string, file: File | null) {
    const next = new Map(uploads)
    if (!file) {
      next.delete(nodeId)
      setUploads(next)
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      const base64 = dataUrl.split(',')[1]
      next.set(nodeId, { file, base64 })
      setUploads(new Map(next))
    }
    reader.readAsDataURL(file)
  }

  async function createRevision() {
    if (uploads.size === 0) return
    setCreating(true)
    try {
      const payload = {
        uploads: Array.from(uploads.entries()).map(([node_id, u]) => ({
          node_id,
          file_name: u.file.name,
          file_size: u.file.size,
          document_data: u.base64,
        }))
      }
      const res = await fetch(`/api/reviews/${sessionId}/revisions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Failed to create revision')
      const json = await res.json()
      onCreated && onCreated(json.revision_id)

      // Immediately process and show inline progress
      setProcessing(true)
      setStatusText('Starting processing...')
      const processRes = await fetch(`/api/reviews/${sessionId}/revisions/${json.revision_id}/process`, { method: 'POST' })
      if (!processRes.ok) throw new Error('Failed to start processing')

      // Poll status until completed/failed
      await pollRevisionUntilDone(json.revision_id)
      onProcessed && onProcessed(json.revision_id)
    } catch (e) {
      alert('Failed to create revision')
    } finally {
      setCreating(false)
      setProcessing(false)
      setStatusText("")
    }
  }

  async function pollRevisionUntilDone(revisionId: string) {
    // Poll specific revision endpoint
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        setStatusText('Processing...')
        const r = await fetch(`/api/reviews/${sessionId}/revisions/${revisionId}`)
        if (r.ok) {
          const data = await r.json()
          const status = (data.revision?.status || '').toLowerCase()
          if (status === 'completed') {
            setStatusText('Completed')
            break
          }
          if (status === 'failed') {
            setStatusText('Failed')
            break
          }
        }
      } catch {}
      await new Promise(res => setTimeout(res, 2000))
    }
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">Create New Revision</h3>
      <div className="space-y-3">
        {nodes.map((n) => {
          const current = uploads.get(n.node_id)
          return (
            <Card key={n.node_id} className="p-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline">#{n.sequence_order}</Badge>
                <div className="flex-1">
                  <div className="font-medium">{n.node_name}</div>
                  {current ? (
                    <div className="flex items-center gap-3 p-2 bg-muted rounded">
                      <FileText className="h-4 w-4" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{current.file.name}</div>
                        <div className="text-xs text-muted-foreground">{(current.file.size/1024).toFixed(1)} KB</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleFile(n.node_id, null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <input id={`f-${n.node_id}`} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFile(n.node_id, e.target.files?.[0] || null)} />
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => document.getElementById(`f-${n.node_id}`)?.click()}>
                        <FileUp className="h-4 w-4" /> Upload PDF
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={createRevision} disabled={creating || processing || uploads.size === 0} className="gap-2">
          {(creating || processing) ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {processing ? 'Processing...' : creating ? 'Creating...' : 'Create revision & process'}
        </Button>
        {(creating || processing) && (
          <span className="text-sm text-muted-foreground">{statusText}</span>
        )}
      </div>
    </Card>
  )
}


