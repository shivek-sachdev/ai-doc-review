import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { GoogleGenAI } from "@google/genai"

export async function POST(request: Request, { params }: { params: Promise<{ id: string, revision_id: string }> }) {
  const { id, revision_id } = await params

  try {
    // Validate session + revision
    const sessionResult = await sql`SELECT * FROM review_sessions WHERE id = ${id}`
    if (sessionResult.length === 0) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    const revisionRows = await sql`SELECT * FROM review_revisions WHERE id = ${revision_id} AND session_id = ${id}`
    if (revisionRows.length === 0) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })

    // Load template nodes
    const templateNodes = await sql`
      SELECT tn.*, dn.name as node_name, dn.description, dn.example_content
      FROM template_nodes tn
      JOIN document_nodes dn ON tn.node_id = dn.id
      WHERE tn.template_id = ${sessionResult[0].template_id}
      ORDER BY tn.sequence_order
    `

    // Load revision documents
    const revDocs = await sql`SELECT * FROM revision_documents WHERE revision_id = ${revision_id}`

    // API key
    const apiKeyResult = await sql`SELECT value FROM settings WHERE key = 'gemini_api_key'`
    const apiKey = apiKeyResult.length > 0 ? apiKeyResult[0].value : process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })

    // Mark revision processing
    await sql`UPDATE review_revisions SET status = 'processing' WHERE id = ${revision_id}`

    const ai = new GoogleGenAI({ apiKey })

    // Phase 1: extract per section
    const extractedMap: Record<string, any> = {}
    for (const tn of templateNodes) {
      const upload = revDocs.find((d: any) => d.node_id === tn.node_id)
      if (!upload) continue
      try {
        const extraction = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { inlineData: { mimeType: 'application/pdf', data: upload.document_data } },
            { text: 'Extract structured key fields as JSON only.' }
          ]
        })
        let extracted: any = {}
        try { extracted = JSON.parse((extraction as any)?.text || '{}') } catch {}
        extractedMap[tn.node_id] = extracted
      } catch {
        extractedMap[tn.node_id] = {}
      }
    }

    // Phase 2: cross-document comparison (reuse logic from process-with-progress, trimmed)
    const allDocuments = templateNodes.map((n: any) => ({
      node_id: n.node_id,
      node_name: n.node_name,
      description: n.description,
      example_content: n.example_content,
      ai_instructions: n.ai_instructions,
      extracted: extractedMap[n.node_id] || {}
    }))

    const comparisonPrompt = `Cross-compare all documents and produce per-document sections with Critical Issues and Warnings using the exact headings as before.\n\n${JSON.stringify(allDocuments, null, 2)}`

    const contents: any[] = []
    for (const tn of templateNodes) {
      const upload = revDocs.find((d: any) => d.node_id === tn.node_id)
      if (upload) contents.push({ inlineData: { mimeType: 'application/pdf', data: upload.document_data } })
    }
    contents.push({ text: comparisonPrompt })

    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents })
    const fullFeedback = (response as any)?.text ?? ''

    // Parse per-document sections
    const documentSections: Record<string, string> = {}
    for (const tn of templateNodes) {
      const escaped = tn.node_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`##\\s*(?:\\[)?${escaped}(?:\\])?[\\s\\S]*?(?=(?:\\n##\\s+(?!#))|$)`, 'i')
      const match = fullFeedback.match(regex)
      documentSections[tn.node_id] = match ? match[0] : `## ${tn.node_name}\n\n### ⚠️ Warnings & Recommendations\n- No specific feedback generated.`
    }

    // Remove old results for this revision (idempotency)
    await sql`DELETE FROM review_results WHERE session_id = ${id} AND revision_id = ${revision_id}`

    // Insert results
    for (const tn of templateNodes) {
      await sql`
        INSERT INTO review_results (session_id, revision_id, node_id, node_name, ai_feedback, sequence_order)
        VALUES (${id}, ${revision_id}, ${tn.node_id}, ${tn.node_name}, ${documentSections[tn.node_id] || ''}, ${tn.sequence_order})
      `
    }

    await sql`UPDATE review_revisions SET status = 'completed', completed_at = NOW() WHERE id = ${revision_id}`
    await sql`UPDATE review_sessions SET status = 'completed', completed_at = NOW() WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to process revision:', error)
    await sql`UPDATE review_revisions SET status = 'failed' WHERE id = ${revision_id}`
    return NextResponse.json({ error: 'Failed to process revision' }, { status: 500 })
  }
}


