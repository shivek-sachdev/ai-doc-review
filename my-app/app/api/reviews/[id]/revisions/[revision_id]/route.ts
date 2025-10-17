import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: Request, { params }: { params: Promise<{ id: string, revision_id: string }> }) {
  try {
    const { id, revision_id } = await params
    const rev = await sql`SELECT * FROM review_revisions WHERE id = ${revision_id} AND session_id = ${id}`
    if (rev.length === 0) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })

    const results = await sql`
      SELECT * FROM review_results
      WHERE session_id = ${id} AND revision_id = ${revision_id}
      ORDER BY sequence_order
    `
    return NextResponse.json({ revision: rev[0], results })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch revision' }, { status: 500 })
  }
}


