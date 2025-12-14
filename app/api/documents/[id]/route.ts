// app/api/documents/[id]/route.ts
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
  id: string; // page id
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


type VersionInfo = {
  id: string;
  revision: string | null;
  uploadDate: string;
  status: string;
};

function getSupabaseServerClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase env vars missing for detail route. Need SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL ' +
        'and some key such as SUPABASE_PUBLISHABLE_KEY.',
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

  const thumbnailUrl =
    row.image_bucket && row.image_object_path
      ? `${supabaseUrl}/storage/v1/object/public/${row.image_bucket}/${row.image_object_path}`
      : null;

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
    sizeLabel: undefined,
    thumbnailUrl,
    pdfUrl,
  };
}


export async function GET(
  _req: Request,
  context: { params: { id: string } },
) {
  try {
    const pageId = context.params.id;
    const { supabase, supabaseUrl } = getSupabaseServerClient();

    // 1) Load this page, joined to its file
    const { data: row, error } = await supabase
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
      .eq('id', pageId)
      .single();

    if (error || !row) {
      console.error('Detail route: document_pages lookup failed:', error);
      return NextResponse.json(
        { error: 'Document page not found' },
        { status: 404 },
      );
    }

    const document = mapRowToSummary(row, supabaseUrl);

    const file = row.document_files;
    const drawingNumber =
      row.drawing_number || file?.doc_number || file?.drawing_number || null;
    const projectnumber = file?.projectnumber ?? null;
    const enquirynumber = file?.enquirynumber ?? null;

    // 2) Build version history for same drawing/project/enquiry (first pages only)
    let history: VersionInfo[] = [];

    if (drawingNumber) {
      let histQuery = supabase
        .from('document_pages')
        .select(
          `
          id,
          created_at,
          revision,
          status,
          drawing_number,
          document_files!inner (
            enquirynumber,
            projectnumber,
            doc_revision,
            revision,
            status,
            is_superseded
          )
        `,
        )
        .eq('page_number', 1)
        .eq('drawing_number', drawingNumber)
        .order('created_at', { ascending: false });

      if (projectnumber) {
        histQuery = histQuery.eq(
          'document_files.projectnumber',
          projectnumber,
        );
      } else if (enquirynumber) {
        histQuery = histQuery.eq(
          'document_files.enquirynumber',
          enquirynumber,
        );
      }

      const { data: histRows, error: histError } = await histQuery;

      if (!histError && histRows) {
        history = histRows.map((h: any) => {
          const f = h.document_files;
          const rev =
            h.revision ||
            f?.doc_revision ||
            f?.revision ||
            null;
          const statusStr =
            h.status ||
            f?.status ||
            'unknown';

          return {
            id: h.id as string,
            revision: rev,
            uploadDate: h.created_at as string,
            status: statusStr as string,
          };
        });
      } else if (histError) {
        console.error('Detail route: history query failed:', histError);
      }
    }

    return NextResponse.json({ document, history });
  } catch (err: any) {
    console.error('Unhandled error in /api/documents/[id]:', err);
    return NextResponse.json(
      {
        error: 'Supabase config or server error (detail route)',
        details: err?.message ?? String(err),
      },
      { status: 500 },
    );
  }
}
