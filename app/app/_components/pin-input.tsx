import { Input, type InputProps } from "@/components/ui/input";

/** Input PIN 6 angka: keyboard angka di HP, isi disamarkan. */
export function PinInput(props: Omit<InputProps, "type">) {
  return (
    <Input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      placeholder="••••••"
      className="font-mono tracking-[0.4em]"
      {...props}
    />
  );
}
