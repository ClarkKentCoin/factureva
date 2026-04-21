/**
 * SendInvoiceEmailDialog — V1.
 * Lets the user prefill recipient/subject/body, attach a generated PDF
 * (provided by the parent), and send via the send-invoice-email edge function.
 * The parent owns the PDF generation (so the same DOM preview node is reused).
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type SendEmailDefaults = {
  recipient: string;
  subject: string;
  body: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoiceId: string | null;
  defaults: SendEmailDefaults;
  // Returns { base64, filename } from the parent's preview render. Called when user clicks Send.
  generatePdf: () => Promise<{ base64: string; filename: string }>;
  onSent?: (recipient: string) => void;
};

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export default function SendInvoiceEmailDialog({
  open, onOpenChange, invoiceId, defaults, generatePdf, onSent,
}: Props) {
  const { t } = useTranslation();
  const [recipient, setRecipient] = useState(defaults.recipient);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaults.subject);
  const [body, setBody] = useState(defaults.body);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setRecipient(defaults.recipient);
      setSubject(defaults.subject);
      setBody(defaults.body);
      setCc("");
    }
  }, [open, defaults.recipient, defaults.subject, defaults.body]);

  const handleSend = async () => {
    if (!invoiceId) return;
    if (!isEmail(recipient)) { toast.error(t("invoices.email.errors.recipientInvalid")); return; }
    if (cc && !isEmail(cc)) { toast.error(t("invoices.email.errors.ccInvalid")); return; }
    if (!subject.trim()) { toast.error(t("invoices.email.errors.subjectRequired")); return; }

    setSending(true);
    try {
      const { base64, filename } = await generatePdf();
      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: {
          invoice_id: invoiceId,
          recipient: recipient.trim(),
          cc: cc.trim() || null,
          subject: subject.trim(),
          body,
          pdf_base64: base64,
          pdf_filename: filename,
        },
      });
      if (error) {
        // Try to surface our typed errors
        const detail = (data as { error?: string } | null)?.error ?? error.message;
        if (detail === "email_provider_not_configured") {
          toast.error(t("invoices.email.errors.providerMissing"));
        } else {
          toast.error(t("invoices.email.errors.sendFailed"));
        }
        return;
      }
      toast.success(t("invoices.email.toasts.sent", { to: recipient }));
      onSent?.(recipient);
      onOpenChange(false);
    } catch {
      toast.error(t("invoices.email.errors.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("invoices.email.title")}</DialogTitle>
          <DialogDescription>{t("invoices.email.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("invoices.email.fields.recipient")}</Label>
            <Input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
          <div>
            <Label>{t("invoices.email.fields.cc")}</Label>
            <Input type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder={t("invoices.email.fields.ccPlaceholder")} />
          </div>
          <div>
            <Label>{t("invoices.email.fields.subject")}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>{t("invoices.email.fields.body")}</Label>
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">{t("invoices.email.attachmentNote")}</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSend} disabled={sending} className="gap-1">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("invoices.email.actions.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
