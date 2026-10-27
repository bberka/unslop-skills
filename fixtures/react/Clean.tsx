import { useState, type ComponentProps } from "react";
import { cn } from "./cn";

type Status = "idle" | "saving" | "error";

export function SaveButton({ className, ...rest }: ComponentProps<"button">) {
  return <button className={cn("btn", className)} {...rest} />;
}

export function Profile({ first, last, items }: { first: string; last: string; items: { id: string; label: string }[] }) {
  const [status, setStatus] = useState<Status>("idle");
  const fullName = `${first} ${last}`;

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
      {status === "error" && <p role="alert">Saving failed. Check your connection and try again.</p>}
    </section>
  );
}
