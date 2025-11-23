// app/api/upload/route.ts

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

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

/* --------- Small helpers --------- */

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

function splitName(name: string): { root: string; ext: string | null } {
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) {
    // no dot, or dot at start/end → treat as no extension
    return { root: name, ext: null };
  }
  return {
    root: name.slice(0, idx),
    ext: name.slice(idx + 1).toLowerCase(),
  };
}

function sanitiseRootName(root: string): string {
  const trimmed = root.trim().toLowerCase();
  const replaced = trimmed.replace(/\s+/g, '_');
  const cleaned = replaced.replace(/[^a-z0-9_]/g, '');
  return cleaned || 'unnamed';
}

function safeContextValue(value: string): string {
  // Keep it simple: trim and replace spaces with underscore.
  // The schema expects project/enquiry numbers like "10001" or "ENQ-1234".
  const trimmed = value.trim();
  if (!trimmed) {
    return 'unassigned';
  }
  return trimmed.replace(/\s+/g, '_');
}

/**
 * Build raw storage path and id based on the design:
 *
 * raw/enquiries/{enquirynumber}/{document_file_id}_{sanitised-root}.{ext}
 * raw/projects/{projectnumber}/{document_file_id}_{sanitised-root}.{ext}
 */
function buildRawStoragePath(
  ctx: UploadContext,
  originalName: string,
): { id: string; storagePath: string } {
  const id = randomUUID();
  const { root, ext } = splitName(originalName || 'unnamed');
  const safeRoot = sanitiseRootName(root);
  const extPart = ext ? `.${ext}` : '.pdf';

  const contextValue =
    ctx.contextType === 'project'
      ? safeContextValue(ctx.projectNumber)
      : safeContextValue(ctx.enquiryNumber);

  const dirPrefix =
    ctx.contextType === 'project'
      ? `raw/projects/${contextValue}`
      : `raw/enquiries/${contextValue}`;

  const filename = `${id}_${safeRoot}${extPart}`;
  const storagePath = path.posix.join(dirPrefix, filename);

  return { id, storagePath };
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

async function insertDocumentFileRowWithId(
  supabase: SupabaseClient,
  ctx: UploadContext,
  id: string,
  filename: string,
  size: number,
  storagePath: string,
): Promise<string | null> {
  const { ext } = splitName(filename);

  const insertPayload = {
    id, // explicit UUID

    // Linking
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
    file_ext: ext,
    storage_bucket: 'nas',
    storage_object_path: storagePath,
    file_size_bytes: size,

    // Hashes (worker will fill later if needed)
    file_sha256: null,
    file_sha1: null,

    // Processing state
    status: 'uploaded',
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
): Promise<FileResult> {
  const filename = file.name || 'unnamed';
  const size = file.size;
  const type = file.type || 'application/pdf';

  const { id, storagePath } = buildRawStoragePath(ctx, filename);

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

  const insertError = await insertDocumentFileRowWithId(
    supabase,
    ctx,
    id,
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
      const result = await handleOneFile(supabase, nasRoot, ctx, file);
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
