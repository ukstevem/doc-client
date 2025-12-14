// app/api/blob/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const relPath = url.searchParams.get('path');

    if (!relPath) {
      return NextResponse.json(
        { error: 'Missing path query parameter' },
        { status: 400 }
      );
    }

    const root = process.env.HOST_DOC_ROOT;
    if (!root) {
      console.error('HOST_DOC_ROOT is not set');
      return NextResponse.json(
        { error: 'HOST_DOC_ROOT not configured on server' },
        { status: 500 }
      );
    }

    // Make sure path stays under HOST_DOC_ROOT
    const safeRel = relPath.replace(/^[/\\]+/, '');
    const fullPath = path.join(root, safeRel);
    const normalizedRoot = path.resolve(root);
    const normalizedFull = path.resolve(fullPath);

    if (
      !normalizedFull.startsWith(normalizedRoot) ||
      normalizedFull === normalizedRoot
    ) {
      console.warn('Rejected path traversal attempt:', relPath);
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const data = await fs.readFile(fullPath);

    let contentType = 'application/octet-stream';
    const lower = fullPath.toLowerCase();
    if (lower.endsWith('.png')) contentType = 'image/png';
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
      contentType = 'image/jpeg';
    else if (lower.endsWith('.webp')) contentType = 'image/webp';
    else if (lower.endsWith('.pdf')) contentType = 'application/pdf';

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Error in /api/blob:', err);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
