-- Storage bucket for company logos (public read, tenant-scoped writes)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Files are stored under "<tenant_id>/<filename>". Authorization is enforced
-- by checking that the first folder segment is a tenant the user belongs to.

-- Public read: logos are referenced from invoice documents.
CREATE POLICY "company_logos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Tenant members can upload logos under their tenant folder.
CREATE POLICY "company_logos_member_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- Tenant members can update logos under their tenant folder.
CREATE POLICY "company_logos_member_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- Tenant members can delete logos under their tenant folder.
CREATE POLICY "company_logos_member_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
);