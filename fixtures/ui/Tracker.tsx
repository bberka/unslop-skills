import Joyride from "react-joyride";

export function FirstRun({ steps }: { steps: { target: string; content: string }[] }) {
  return (
    <>
      <Joyride steps={steps} continuous />
      <OnboardingModal />
      <button type="button">Skip tour</button>
    </>
  );
}

export function DueDate({ days, months, years, onChange }: DueDateProps) {
  return (
    <fieldset>
      <legend>Due date</legend>
      <select name="dueDay" onChange={(e) => onChange("day", e.target.value)}>{days}</select>
      <select name="dueMonth" onChange={(e) => onChange("month", e.target.value)}>{months}</select>
      <select name="dueYear" onChange={(e) => onChange("year", e.target.value)}>{years}</select>
    </fieldset>
  );
}
