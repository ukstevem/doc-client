// app/api/documents/[id]/route.ts
import { NextResponse } from 'next/server';
import { fetchDocumentWithHistory } from '../../../lib/documents';

export async function GET(
  _req: Request,
  context: { params: { id: string } },
) {
  try {
    const pageId = context.params.id;
    const { document, history } = await fetchDocumentWithHistory(pageId);
    return NextResponse.json({ document, history });
  } catch (err: any) {
    if (err && (err as any).code === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'Document page not found' },
        { status: 404 },
      );
    }

    console.error('Error in /api/documents/[id]:', err);
    return NextResponse.json(
      {
        error: 'Supabase config or server error (detail)',
        details: err?.message ?? String(err),
      },
      { status: 500 },
    );
  }
}
