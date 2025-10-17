"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { ReviewResultsEnhanced } from "@/components/review-results-enhanced"
import { RevisionTimeline } from "@/components/revision-timeline"
import { RevisionUploader } from "@/components/revision-uploader"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-4">
              <RevisionTimeline
                revisions={revisions}
                selectedRevisionId={selectedRevisionId}
                onSelect={(rid) => setSelectedRevisionId(rid)}
                onReprocess={async (rid) => {
                  await fetch(`/api/reviews/${resolvedParams.id}/revisions/${rid}/process`, { method: 'POST' })
                  checkSessionStatus()
                }}
              />
              {/* Load template nodes for uploader */}
              <RevisionUploader
                sessionId={resolvedParams.id}
                templateNodes={[] as any}
                onCreated={async (rid) => {
                  // Immediately process the new revision
                  await fetch(`/api/reviews/${resolvedParams.id}/revisions/${rid}/process`, { method: 'POST' })
                  setSelectedRevisionId(rid)
                  checkSessionStatus()
                }}
              />
            </div>
            <div className="md:col-span-2">
              <ReviewResultsEnhanced sessionId={resolvedParams.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
