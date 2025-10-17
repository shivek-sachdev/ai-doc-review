import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Create a new revision for a review session and accept uploads payload
// Body: { note?: string, uploads: Array<{ node_id: string, file_name: string, file_size: number, document_data: string }> }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const uploads = Array.isArray(body?.uploads) ? body.uploads : []
    const note = body?.note || null

    // Find next revision number
    const existing = await sql`
      SELECT COALESCE(MAX(revision_number), 0) AS max_rev FROM review_revisions WHERE session_id = ${id}
    `
    const nextRev = (existing[0]?.max_rev || 0) + 1

    // Create revision row
    const created = await sql`
      INSERT INTO review_revisions (session_id, revision_number, status, note)
      VALUES (${id}, ${nextRev}, 'pending', ${note})
      RETURNING id
    `
    const revisionId = created[0].id

    // Insert uploads
    for (const u of uploads) {
      if (!u?.node_id || !u?.document_data) continue
      await sql`
        INSERT INTO revision_documents (revision_id, node_id, file_name, file_size, document_data)
        VALUES (${revisionId}, ${u.node_id}, ${u.file_name || ''}, ${u.file_size || 0}, ${u.document_data})
        ON CONFLICT (revision_id, node_id) DO UPDATE SET
          file_name = EXCLUDED.file_name,
          file_size = EXCLUDED.file_size,
          document_data = EXCLUDED.document_data
      `
    }

    return NextResponse.json({ revision_id: revisionId, revision_number: nextRev })
  } catch (error) {
    console.error('Failed to create revision:', error)
    return NextResponse.json({ error: 'Failed to create revision' }, { status: 500 })
  }
}


