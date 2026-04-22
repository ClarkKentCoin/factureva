import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** i18n key prefix, e.g. "billing.gates.devis" → expects .title and .description keys */
  featureKeyPrefix: string;
};

/**
 * Generic upgrade dialog. Shown when user attempts a feature their plan
 * does not currently grant. Never blocks reading existing data — only the
 * NEW action.
 */
export function UpgradeDialog({ open, onOpenChange, featureKeyPrefix }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-10 w-10 rounded-full bg-accent text-accent-foreground grid place-items-center mb-2">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center">{t(`${featureKeyPrefix}.title`)}</DialogTitle>
          <DialogDescription className="text-center">
            {t(`${featureKeyPrefix}.description`)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("billing.upgrade.later")}
          </Button>
          <Button onClick={() => { onOpenChange(false); navigate("/app/settings/plan"); }}>
            {t("billing.upgrade.cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
