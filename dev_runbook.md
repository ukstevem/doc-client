# Doc-Control Dev Runbook

This runbook describes how to run the **doc-control** system end-to-end on a **dev machine**.

It assumes you’re familiar with the overall design and storage layout in:

- `doc-control-design-v1.md`
- `doc-control-storage-layout-v1.md`

---

## 1. Components & High-Level Flow

The doc-control system has four main pieces:

1. **Client app (Next.js)**  
   - Used to upload drawings and view processed pages.
   - Talks to Supabase and to the gateway for images/files.

2. **Gateway (`doc-gateway`, NGINX)**  
   - Exposes files under `/files/...` from the NAS root.
   - Read-only HTTP access to PDFs and rendered PNGs.

3. **Workers (`pdf_worker` & friends)**  
   - Read PDFs from the NAS.
   - Generate page PNGs, compute fingerprints, match titleblocks, extract fields.
   - Update Supabase tables (`document_files`, `document_pages`, etc.).

4. **Supabase (cloud)**  
   - Primary database for metadata and worker state.
   - Holds table schemas defined in the design docs.

**Happy-path data flow (dev):**

1. User uploads a PDF via the **client**.
2. Client writes the file into the **NAS root** and inserts a row into `document_files`.
3. Workers pick up new rows in `document_files`, create `document_pages` rows, and render page PNGs.
4. Titleblock workers match templates and extract metadata into `document_pages`.
5. Client queries `document_pages` and displays thumbnails + extracted fields in the dashboard.

---

## 2. Directory Layout on Dev

On the **dev machine (Windows)**, we use:

```text
C:\dev\cad_iot\doc_control\
    raw\
    derived\
