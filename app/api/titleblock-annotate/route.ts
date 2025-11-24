// app/api/titleblock-annotate/route.ts

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type FieldKey = 'drawing_number' | 'drawing_title' | 'revision' | 'other';

interface TitleblockRectPayload {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ClickPayload {
  field: FieldKey;
  x_rel: number;
  y_rel: number;
}

interface AnnotatePayload {
  pageId: string;
  titleblock: TitleblockRectPayload;
  clicks: ClickPayload[];
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function createSupabaseClient(): SupabaseClient {
  const url = readEnv('SUPABASE_URL');
  const key = readEnv('SUPABASE_SECRET_KEY');
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function validatePayload(payload: Partial<AnnotatePayload>): string | null {
  if (!payload.pageId) {
    return 'pageId is required.';
  }
  if (!payload.titleblock) {
    return 'titleblock is required.';
  }
  const tb = payload.titleblock;
  if (
    typeof tb.x !== 'number' ||
    typeof tb.y !== 'number' ||
    typeof tb.width !== 'number' ||
    typeof tb.height !== 'number'
  ) {
    return 'titleblock x, y, width, height must be numbers.';
  }
  if (tb.width <= 0 || tb.height <= 0) {
    return 'titleblock width and height must be positive.';
  }

  if (!Array.isArray(payload.clicks)) {
    return null; // clicks are optional
  }

  for (const c of payload.clicks) {
    if (!c) {
      continue;
    }
    if (
      c.field !== 'drawing_number' &&
      c.field !== 'drawing_title' &&
      c.field !== 'revision' &&
      c.field !== 'other'
    ) {
      return 'click field must be one of drawing_number, drawing_title, revision, other.';
    }
    if (
      typeof c.x_rel !== 'number' ||
      typeof c.y_rel !== 'number'
    ) {
      return 'click x_rel and y_rel must be numbers.';
    }
    if (
      c.x_rel < 0 ||
      c.x_rel > 1 ||
      c.y_rel < 0 ||
      c.y_rel > 1
    ) {
      return 'click x_rel and y_rel must be between 0 and 1.';
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AnnotatePayload>;
    const errorMsg = validatePayload(body);

    if (errorMsg) {
      return NextResponse.json(
        { ok: false, error: errorMsg },
        { status: 400 },
      );
    }

    const payload = body as AnnotatePayload;
    const supabase = createSupabaseClient();

    const fingerprint = {
      version: 1,
      clicks: payload.clicks ?? [],
    };

    const { error: updateError } = await supabase
      .from('document_pages')
      .update({
        titleblock_x: Math.round(payload.titleblock.x),
        titleblock_y: Math.round(payload.titleblock.y),
        titleblock_width: Math.round(payload.titleblock.width),
        titleblock_height: Math.round(payload.titleblock.height),
        titleblock_fingerprint: fingerprint,
        titleblock_fingerprint_version: 1,
        status: 'tagged',
      })
      .eq('id', payload.pageId);

    if (updateError) {
      console.error(
        'Error updating document_pages titleblock + fingerprint:',
        updateError,
      );
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, fingerprint });
  } catch (error) {
    console.error('Error in POST /api/titleblock-annotate:', error);
    return NextResponse.json(
      { ok: false, error: 'Unexpected server error.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { pageId?: string };

    if (!body.pageId) {
      return NextResponse.json(
        { ok: false, error: 'pageId is required.' },
        { status: 400 },
      );
    }

    const supabase = createSupabaseClient();

    const { error: updateError } = await supabase
      .from('document_pages')
      .update({
        titleblock_x: null,
        titleblock_y: null,
        titleblock_width: null,
        titleblock_height: null,
        titleblock_fingerprint: null,
        titleblock_fingerprint_version: null,
        // status: ???  ← leaving status unchanged on clear for now
      })
      .eq('id', body.pageId);

    if (updateError) {
      console.error(
        'Error clearing document_pages titleblock + fingerprint:',
        updateError,
      );
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/titleblock-annotate:', error);
    return NextResponse.json(
      { ok: false, error: 'Unexpected server error.' },
      { status: 500 },
    );
  }
}
