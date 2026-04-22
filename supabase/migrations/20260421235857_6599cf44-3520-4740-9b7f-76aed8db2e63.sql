-- 1) Company signature (seller, reusable across all devis)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS signature_url text;

-- 2) Client signature on a devis (per-document)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_signature_url text;

-- 3) Public storage bucket for signature images
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- 4) Storage policies — tenant-folder convention: <tenant_id>/<filename>
DROP POLICY IF EXISTS "signatures_public_read" ON storage.objects;
CREATE POLICY "signatures_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures');

DROP POLICY IF EXISTS "signatures_member_insert" ON storage.objects;
CREATE POLICY "signatures_member_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signatures'
  AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "signatures_member_update" ON storage.objects;
CREATE POLICY "signatures_member_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "signatures_member_delete" ON storage.objects;
CREATE POLICY "signatures_member_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
);