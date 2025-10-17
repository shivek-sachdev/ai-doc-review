-- Revisions support for review sessions

-- Create review_revisions table
CREATE TABLE IF NOT EXISTS review_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_review_revisions_session_id ON review_revisions(session_id);

-- Create revision_documents table (uploaded files per revision/section)
CREATE TABLE IF NOT EXISTS revision_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id UUID NOT NULL REFERENCES review_revisions(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES document_nodes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  document_data TEXT NOT NULL, -- base64 (align with existing document_uploads approach)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (revision_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_revision_documents_revision_id ON revision_documents(revision_id);

-- Add revision_id to review_results
ALTER TABLE review_results
ADD COLUMN IF NOT EXISTS revision_id UUID REFERENCES review_revisions(id) ON DELETE CASCADE;

-- Backfill: create a default Revision 1 for sessions that have results but no revisions
DO $$
BEGIN
  -- Create Rev 1 for any session missing revisions
  INSERT INTO review_revisions (session_id, revision_number, status, created_at, completed_at)
  SELECT rs.id, 1, rs.status, rs.created_at, rs.completed_at
  FROM review_sessions rs
  WHERE NOT EXISTS (
    SELECT 1 FROM review_revisions rr WHERE rr.session_id = rs.id
  );

  -- Link existing review_results to that Rev 1
  UPDATE review_results r
  SET revision_id = rr.id
  FROM review_revisions rr
  WHERE rr.session_id = r.session_id AND r.revision_id IS NULL AND rr.revision_number = 1;
END$$;


