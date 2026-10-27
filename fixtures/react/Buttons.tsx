export function PrimaryButton({ label }: { label: string }) {
  return <button className="btn btn-primary">{label}</button>;
}

export function SubmitButton({ label }: { label: string }) {
  return <button className="btn btn-primary" type="submit">{label}</button>;
}

export const BlueButton = ({ label }: { label: string }) => <button className="btn btn-blue">{label}</button>;
