import { toast } from "../state";
import { Button } from "./ui";

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div class="toast" role="status">
      <span>{t.text}</span>
      {t.action ? <Button onClick={() => { toast.value = null; t.action!.run(); }}>{t.action.label}</Button> : null}
    </div>
  );
}
