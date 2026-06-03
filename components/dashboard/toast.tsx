import { CheckIcon } from "@/components/icons";

export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 right-5 z-[60] flex animate-slide-up items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg">
      <CheckIcon className="h-4 w-4 text-emerald-400" />
      {message}
    </div>
  );
}
