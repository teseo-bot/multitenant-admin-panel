import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getTenantContext } from '@/lib/auth/get-tenant-context';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'text/csv',
  'text/markdown'
];

export async function POST(request: Request) {
  try {
    const result = await getTenantContext(request);
    if (!result.ok) return new Response(result.err.error, { status: result.err.status });
    const { user, tenantId } = result.ctx;

    const formData = await request.formData();
    const files = formData.getAll('file') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Validation
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Max size is 10MB.` },
          { status: 413 }
        );
      }
      
      // Fallback for markdown
      const isMarkdownExt = file.name.endsWith('.md');
      
      if (!ALLOWED_MIME_TYPES.includes(file.type) && !isMarkdownExt) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type || file.name}. Allowed types are PDF, JPEG, PNG, TXT, CSV, MD.` },
          { status: 400 }
        );
      }
    }

    const finalTenantId = tenantId;
    
    // Elevate privileges to bypass RLS for server-side insertions/storage
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const uploadResults = [];

    for (const file of files) {
      // Upload to Supabase Storage
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const storagePath = `${finalTenantId}/${timestamp}_${safeName}`;
      
      const { error: storageError } = await supabaseAdmin.storage
        .from('tenant_documents')
        .upload(storagePath, file);

      if (storageError) {
        console.error("[Asset Studio API] Storage upload error for", file.name, ":", storageError);
        return NextResponse.json({ error: `Failed to upload file ${file.name} to storage` }, { status: 500 });
      }

      // Insert into documents table
      const { data: docData, error: dbError } = await supabaseAdmin
        .from('documents')
        .insert({
          tenant_id: finalTenantId,
          name: file.name,
          file_path: storagePath,
          file_type: file.name.split('.').pop() || 'unknown',
          size_bytes: file.size,
          status: 'processing',
          created_by: user.id
        })
        .select()
        .single();

      if (dbError) {
        console.error("[Asset Studio API] DB insert error for", file.name, ":", dbError);
        return NextResponse.json({ error: `Failed to save document record for ${file.name}` }, { status: 500 });
      }
      
      uploadResults.push(docData);
    }
    
    return NextResponse.json({ documents: uploadResults }, { status: 201 });
  } catch (error) {
    console.error("[Asset Studio API] Error Crítico:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
