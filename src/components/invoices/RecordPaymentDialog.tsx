import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordPayment, type PaymentMethod } from "@/lib/payments";
import { useAuth } from "@/lib/auth-context";

const METHODS: PaymentMethod[] = ["bank_transfer", "card", "cash", "check", "paypal", "stripe", "other"];
const todayISO = () => new Date().toISOString().slice(0, 10);

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoiceId: string;
  tenantId: string;
  defaultAmount: number;
  onRecorded?: () => void;
};

export default function RecordPaymentDialog({
  open, onOpenChange, invoiceId, tenantId, defaultAmount, onRecorded,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState<string>(String(defaultAmount.toFixed(2)));
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setAmount(defaultAmount > 0 ? defaultAmount.toFixed(2) : "0.00");
      setMethod("bank_transfer");
      setNote("");
    }
  }, [open, defaultAmount]);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) {
      toast.error(t("invoices.payments.errors.amountInvalid")); return;
    }
    if (!date) { toast.error(t("invoices.payments.errors.dateRequired")); return; }
    setBusy(true);
    try {
      await recordPayment(tenantId, invoiceId, user?.id ?? null, {
        payment_date: date, amount: amt, method, note: note.trim() || null,
      });
      toast.success(t("invoices.payments.toasts.recorded"));
      onOpenChange(false);
      onRecorded?.();
    } catch (e: any) {
      toast.error(e?.message || t("invoices.payments.errors.saveFailed"));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invoices.payments.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("invoices.payments.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("invoices.payments.fields.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>{t("invoices.payments.fields.amount")}</Label>
              <Input type="number" step="0.01" min="0" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>{t("invoices.payments.fields.method")}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{t(`invoices.payments.method.${m}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("invoices.payments.fields.note")}</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {t("invoices.payments.actions.record")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
