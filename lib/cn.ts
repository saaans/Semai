import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gabungkan className dan buang kelas Tailwind yang bentrok. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
