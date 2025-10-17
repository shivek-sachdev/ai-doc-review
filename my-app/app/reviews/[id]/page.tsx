"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { ReviewResultsEnhanced } from "@/components/review-results-enhanced"
import { RevisionTimeline } from "@/components/revision-timeline"
import { RevisionUploader } from "@/components/revision-uploader"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ReviewProgressTracker } from "@/components/review-progress-tracker"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [sessionStatus, setSessionStatus] = useState<string>('loading')
  const [revisions, setRevisions] = useState<any[]>([])
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | undefined>(undefined)
  const [openRevisionDialog, setOpenRevisionDialog] = useState(false)

  useEffect(() => {
    checkSessionStatus()
  }, [resolvedParams.id])

  async function checkSessionStatus() {
    try {
      const response = await fetch(`/api/reviews/${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        setSessionStatus(data.session.status)
        setRevisions(data.revisions || [])
        if ((data.revisions || []).length > 0) {
          setSelectedRevisionId(data.revisions[data.revisions.length - 1].id)
        }
      }
    } catch (error) {
      console.error('Failed to check session status:', error)
      setSessionStatus('error')
    }
  }

  function handleComplete() {
    // Reload the page to show results
    router.refresh()
    setSessionStatus('completed')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Link href="/reviews">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Reviews
          </Button>
        </Link>

        {sessionStatus === 'pending' || sessionStatus === 'processing' ? (
          <ReviewProgressTracker sessionId={resolvedParams.id} onComplete={handleComplete} />
        ) : (
          <div className="space-y-4">
            <ReviewResultsEnhanced
              sessionId={resolvedParams.id}
              belowHeader={(
                <div className="grid grid-cols-1 gap-4">
                  <div className="w-full">
                    <div className="flex items-center justify-between">
                      <RevisionTimeline
                        revisions={revisions}
                        selectedRevisionId={selectedRevisionId}
                        onSelect={(rid) => setSelectedRevisionId(rid)}
                        onReprocess={async (rid) => {
                          await fetch(`/api/reviews/${resolvedParams.id}/revisions/${rid}/process`, { method: 'POST' })
                          checkSessionStatus()
                        }}
                      />
                      <Dialog open={openRevisionDialog} onOpenChange={setOpenRevisionDialog}>
                        <DialogTrigger asChild>
                          <button className="px-3 py-2 rounded-md border bg-background hover:bg-accent transition-colors">New Revision</button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Create New Revision</DialogTitle>
                          </DialogHeader>
                          <RevisionUploader
                            sessionId={resolvedParams.id}
                            onCreated={async (rid) => {
                              setOpenRevisionDialog(false)
                              await fetch(`/api/reviews/${resolvedParams.id}/revisions/${rid}/process`, { method: 'POST' })
                              setSelectedRevisionId(rid)
                              checkSessionStatus()
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              )}
            />
          </div>
        )}
      </div>
    </div>
  )
}
