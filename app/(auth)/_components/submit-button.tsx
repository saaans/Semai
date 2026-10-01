"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Tombol submit yang menonaktifkan diri selama form diproses. */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: ButtonProps & { pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending} aria-busy={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
