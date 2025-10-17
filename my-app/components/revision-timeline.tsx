"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle2, XCircle, Loader2, Eye } from "lucide-react"

interface RevisionItem {
  id: string
  revision_number: number
  status: string
  created_at: string
  completed_at: string | null
}

interface RevisionTimelineProps {
  revisions: RevisionItem[]
  selectedRevisionId?: string
  onSelect: (revisionId: string) => void
  onReprocess: (revisionId: string) => void
}

export function RevisionTimeline({ revisions, selectedRevisionId, onSelect, onReprocess }: RevisionTimelineProps) {
  function statusBadge(status: string) {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">completed</Badge>
      case 'processing':
        return <Badge className="bg-blue-600">processing</Badge>
      case 'failed':
        return <Badge variant="destructive">failed</Badge>
      default:
        return <Badge variant="outline">pending</Badge>
    }
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">Revisions</h3>
      <div className="space-y-2">
        {revisions.map((rev) => (
          <div key={rev.id} className={`flex items-center justify-between p-2 rounded-md border ${selectedRevisionId === rev.id ? 'border-primary' : 'border-border'}`}>
            <div className="flex items-center gap-3">
              <Badge variant="outline">Rev {rev.revision_number}</Badge>
              {statusBadge(rev.status)}
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(rev.created_at).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onSelect(rev.id)}>
                <Eye className="h-3 w-3" /> View
              </Button>
              <Button size="sm" onClick={() => onReprocess(rev.id)} className="gap-1">
                <Loader2 className="h-3 w-3" /> Reprocess
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}


