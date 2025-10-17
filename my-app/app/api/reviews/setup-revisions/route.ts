import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { readFile } from "fs/promises"
import path from "path"

export async function POST() {
  try {
    const filePath = path.join(process.cwd(), "my-app", "scripts", "004_add_review_revisions.sql")
    const ddl = await readFile(filePath, "utf-8")
    // Split on semicolons that end statements to avoid driver limitations
    const statements = ddl
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const stmt of statements) {
      try {
        await sql.unsafe(stmt)
      } catch (e) {
        // Best-effort: continue if object already exists
        console.warn("DDL statement failed/ignored:", e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("Failed to setup revisions:", e)
    return NextResponse.json({ error: "Failed to setup revisions" }, { status: 500 })
  }
}


