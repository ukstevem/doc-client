// app/api/documents/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ViewStatus =
  | 'clean'
  | 'needs_attention'
  | 'unmatched'
  | 'revision_check'
  | 'pending'
  | 'error'
  | 'other';

type AttentionCategory = 'clean' | 'needs_attention';

type DocumentSummary = {
  id: string; // page id (for now)
  projectOrEnquiry: string;
  drawingOrDocNumber: string;
  title: string;
  revision: string | null;
  pages: number;
  status: ViewStatus;
  attentionCategory: AttentionCategory;
  uploadDate?: string;
  originalFilename?: string;
  nasPath?: string;
  sizeLabel?: string;
  thumbnailUrl?: string | null;
  pdfUrl?: string | null;
};


function getSupabaseServerClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL; // last-resort fallback if you're using a custom name

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase env vars missing. Need one of SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL ' +
        'and one of SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY / ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  return { supabase, supabaseUrl };
}


function deriveStatus(
  pageStatusRaw: string | null,
  fileStatusRaw: string | null,
  isSuperseded: boolean,
): { status: ViewStatus; attentionCategory: AttentionCategory } {
  if (isSuperseded) {
    return { status: 'unmatched', attentionCategory: 'needs_attention' };
  }

  const s = (pageStatusRaw || fileStatusRaw || '').toLowerCase();

  if (!s) {
    return { status: 'pending', attentionCategory: 'needs_attention' };
  }

  if (s.includes('error')) {
    return { status: 'error', attentionCategory: 'needs_attention' };
  }

  if (s.startsWith('pending')) {
    return { status: 'pending', attentionCategory: 'needs_attention' };
  }

  if (s.includes('review') || s.includes('candidate')) {
    return { status: 'revision_check', attentionCategory: 'needs_attention' };
  }

  if (s === 'processed') {
    return { status: 'clean', attentionCategory: 'clean' };
  }

  return { status: 'other', attentionCategory: 'needs_attention' };
}

function mapRowToSummary(row: any, supabaseUrl: string): DocumentSummary {
  const file = row.document_files;

  const projectOrEnquiry =
    file?.projectnumber || file?.enquirynumber || '';

  const drawingOrDocNumber =
    row.drawing_number ||
    file?.doc_number ||
    file?.drawing_number ||
    '(un-numbered)';

  const title =
    row.drawing_title ||
    file?.doc_title ||
    '(no title)';

  const revision =
    row.revision ||
    file?.doc_revision ||
    file?.revision ||
    null;

  const pages = file?.page_count ?? 1;

  const { status, attentionCategory } = deriveStatus(
    row.status ?? null,
    file?.status ?? null,
    Boolean(file?.is_superseded),
  );

  // Thumbnail (page image in Supabase Storage)
  const thumbnailUrl =
    row.image_bucket && row.image_object_path
      ? `${supabaseUrl}/storage/v1/object/public/${row.image_bucket}/${row.image_object_path}`
      : null;

  // PDF (original file in Supabase Storage)
  const pdfUrl =
    file?.storage_bucket && file?.storage_object_path
      ? `${supabaseUrl}/storage/v1/object/public/${file.storage_bucket}/${file.storage_object_path}`
      : null;

  return {
    id: row.id,
    projectOrEnquiry,
    drawingOrDocNumber,
    title,
    revision,
    pages,
    status,
    attentionCategory,
    uploadDate: file?.created_at,
    originalFilename: file?.original_filename,
    nasPath: file?.storage_object_path,
    sizeLabel: undefined, // no page size yet
    thumbnailUrl,
    pdfUrl,
  };
}


export async function GET(req: Request) {
  try {
    const { supabase, supabaseUrl } = getSupabaseServerClient();
    const url = new URL(req.url);
    const projectOrEnquiry = url.searchParams.get('projectOrEnquiry');
    const drawingFilter = url.searchParams.get('drawingNumber');

    // Base query: first page of each file, joined to its document_file
    let query = supabase
      .from('document_pages')
      .select(
        `
        id,
        created_at,
        document_id,
        page_number,
        image_bucket,
        image_object_path,
        status,
        drawing_number,
        drawing_title,
        revision,
        document_files!inner (
          id,
          created_at,
          enquirynumber,
          projectnumber,
          scope_ref,
          page_count,
          original_filename,
          file_ext,
          file_size_bytes,
          status,
          revision,
          storage_bucket,
          storage_object_path,
          is_superseded,
          doc_number,
          doc_title,
          doc_revision
        )
      `,
      )
      .eq('page_number', 1)
      .eq('document_files.is_superseded', false)
      .order('created_at', { ascending: false });

    if (projectOrEnquiry) {
      // match either project or enquiry on the file side
      query = query.or(
        `document_files.projectnumber.eq.${projectOrEnquiry},document_files.enquirynumber.eq.${projectOrEnquiry}`,
      );
    }

    if (drawingFilter) {
      query = query.ilike('drawing_number', `%${drawingFilter}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error in /api/documents:', {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
      });

      return NextResponse.json(
        { error: 'Failed to load documents', details: error.message },
        { status: 500 },
      );
    }

    const documents: DocumentSummary[] = (data ?? [])
      .map((row: any) => {
        if (!row.document_files) return null;
        return mapRowToSummary(row, supabaseUrl);
      })
      .filter(Boolean) as DocumentSummary[];

    return NextResponse.json({ documents });
  } catch (err: any) {
    console.error('Unhandled error in /api/documents:', err);
    return NextResponse.json(
      {
        error: 'Supabase config or server error',
        details: err?.message ?? String(err),
      },
      { status: 500 },
    );
  }
}
