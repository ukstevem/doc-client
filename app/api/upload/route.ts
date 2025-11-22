// app/api/upload/route.ts

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

type ContextType = 'project' | 'enquiry';

interface UploadContext {
  contextType: ContextType;
  projectNumber: string;
  enquiryNumber: string;
}

interface FileResult {
  filename: string;
  size: number;
  type: string;
  storagePath: string | null;
  error?: string;
}

/* --------- Small helpers (Power-of-10 style) --------- */

function getStorageBucketName(): string {
  // Logical bucket name for NAS-based storage.
  // You can make this configurable later if you like.
  const value = process.env.DOC_STORAGE_BUCKET;
  if (value && value.trim()) {
    return value.trim();
  }
  return 'nas';
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

function getNasRoot(): string {
  return readEnv('DOC_NAS_ROOT');
}

function parseContext(formData: FormData): UploadContext {
  const rawType = (formData.get('contextType') as string) || 'project';
  const contextType: ContextType =
    rawType === 'enquiry' ? 'enquiry' : 'project';

  const projectNumber = ((formData.get('projectNumber') as string) || '').trim();
  const enquiryNumber = ((formData.get('enquiryNumber') as string) || '').trim();

  if (contextType === 'project' && !projectNumber) {
    throw new Error('projectNumber is required when contextType=project');
  }

  if (contextType === 'enquiry' && !enquiryNumber) {
    throw new Error('enquiryNumber is required when contextType=enquiry');
  }

  return { contextType, projectNumber, enquiryNumber };
}

function getFilesFromForm(formData: FormData): File[] {
  const all = formData.getAll('files');
  const files = all.filter((item) => item instanceof File) as File[];
  return files;
}

function safeSegment(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'unassigned';
  }
  return trimmed.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function safeFilename(name: string): string {
  if (!name) {
    return 'unnamed.pdf';
  }
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '_');
}

function extractFileExt(name: string): string | null {
  const idx = name.lastIndexOf('.');
  if (idx === -1 || idx === name.length - 1) {
    return null;
  }
  return name.substring(idx + 1).toLowerCase();
}

/**
 * Build a NAS-relative storage_path for document_files.
 * Example (enquiry):
 *   enquiries/ENQ-1234/raw_pdfs/20251122T120000_0_File.pdf
 * Example (project):
 *   projects/10001/raw_pdfs/20251122T120000_0_File.pdf
 */
function buildStoragePath(
  ctx: UploadContext,
  fileName: string,
  index: number,
): string {
  const nowIso = new Date().toISOString().replace(/[:.]/g, '');
  const safeName = safeFilename(fileName);

  const baseSegment =
    ctx.contextType === 'project'
      ? `projects/${safeSegment(ctx.projectNumber)}`
      : `enquiries/${safeSegment(ctx.enquiryNumber)}`;

  // Use posix-style joins so storage_path always has forward slashes
  const dir = path.posix.join(baseSegment, 'raw_pdfs');
  const fileSegment = `${nowIso}_${index}_${safeName}`;
  return path.posix.join(dir, fileSegment);
}

async function writeFileToNas(
  nasRoot: string,
  storagePath: string,
  file: File,
): Promise<void> {
  const absolutePath = path.join(nasRoot, storagePath);
  const directory = path.dirname(absolutePath);

  await fs.mkdir(directory, { recursive: true });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.writeFile(absolutePath, buffer);
}

async function insertDocumentFileRow(
  supabase: SupabaseClient,
  ctx: UploadContext,
  filename: string,
  size: number,
  storagePath: string,
): Promise<string | null> {
  const fileExt = extractFileExt(filename);
  const storageBucket = getStorageBucketName();

  const insertPayload = {
    // Business keys / linking
    enquirynumber:
      ctx.contextType === 'enquiry' ? ctx.enquiryNumber || null : null,
    projectnumber:
      ctx.contextType === 'project' ? ctx.projectNumber || null : null,
    scope_ref: null,
    sub_project_item_seq: null,
    drawing_number: null,
    revision: null,

    // File / storage info
    original_filename: filename,
    file_ext: fileExt,
    storage_bucket: storageBucket,
    storage_object_path: storagePath,
    file_size_bytes: size,

    // Hashes – worker can fill these later
    file_sha256: null,
    file_sha1: null,

    // Processing state
    status: 'uploaded',     // matches schema default / worker expectations
    page_count: null,
    processing_error: null,
  };

  const { error } = await supabase
    .from('document_files')
    .insert(insertPayload);

  if (error) {
    return error.message;
  }
  return null;
}

async function handleOneFile(
  supabase: SupabaseClient,
  nasRoot: string,
  ctx: UploadContext,
  file: File,
  index: number,
): Promise<FileResult> {
  const filename = file.name || 'unnamed';
  const size = file.size;
  const type = file.type || 'application/pdf';

  const storagePath = buildStoragePath(ctx, filename, index);

  try {
    await writeFileToNas(nasRoot, storagePath, file);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Unknown error writing to NAS';
    return {
      filename,
      size,
      type,
      storagePath: null,
      error: `NAS write failed: ${msg}`,
    };
  }

  const insertError = await insertDocumentFileRow(
    supabase,
    ctx,
    filename,
    size,
    storagePath,
  );

  if (insertError) {
    return {
      filename,
      size,
      type,
      storagePath,
      error: `DB insert failed: ${insertError}`,
    };
  }

  return {
    filename,
    size,
    type,
    storagePath,
  };
}

/* --------- Request handler --------- */

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const ctx = parseContext(formData);
    const files = getFilesFromForm(formData);

    if (files.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No files found in request.',
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseClient();
    const nasRoot = getNasRoot();

    const results: FileResult[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const result = await handleOneFile(
        supabase,
        nasRoot,
        ctx,
        file,
        i,
      );
      results.push(result);
    }

    return NextResponse.json({
      ok: true,
      contextType: ctx.contextType,
      projectNumber: ctx.projectNumber,
      enquiryNumber: ctx.enquiryNumber,
      files: results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown server error';
    console.error('Error in /api/upload:', error);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 },
    );
  }
}
