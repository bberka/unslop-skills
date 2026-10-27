import { forwardRef, useState, type ComponentProps } from "react";
import { cn } from "./cn";

type Status = "idle" | "saving" | "error";

export function SaveButton({ className, ...rest }: ComponentProps<"button">) {
  return <button className={cn("btn", className)} {...rest} />;
}

// React 18: the render function handed to forwardRef is not a nested component.
export const TextField = forwardRef<HTMLInputElement, ComponentProps<"input"> & { label: string }>(
  function TextField({ label, ...rest }, ref) {
    return (
      <label>
        {label}
        <input ref={ref} {...rest} />
      </label>
    );
  }
);

export function ProfileSkeleton({ rows }: { rows: number }) {
  return (
    <ul>
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="skeleton" />
      ))}
    </ul>
  );
}

export function Profile({ first, last, items }: { first: string; last: string; items: { id: string; label: string }[] }) {
  const [status, setStatus] = useState<Status>("idle");
  const fullName = `${first} ${last}`;

  function refetch(options?: { force?: boolean }) {
    return fetch(`/api/profile?force=${options?.force ?? false}`);
  }

  async function save() {
    setStatus("saving");
    try {
      await fetch("/api/profile", { method: "POST", body: JSON.stringify({ fullName }) });
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section>
      <h2>{fullName}</h2>
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
      )}
      <SaveButton onClick={save} disabled={status === "saving"}>
        Save profile
      </SaveButton>
      {/* refetch takes options, so the arrow keeps the click event out of them. */}
      <button type="button" onClick={() => refetch()}>
        Reload
      </button>
      {status === "error" && <p role="alert">Saving failed. Check your connection and try again.</p>}
    </section>
  );
}
