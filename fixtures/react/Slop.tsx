import { useEffect, useMemo, useState } from "react";

export function Profile(props: { first: string; last: string; items: string[]; initial: number }) {
  const [fullName, setFullName] = useState("");
  const [count] = useState(props.initial);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    setFullName(props.first + " " + props.last);
  }, [props.first, props.last]);

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = useMemo(() => props.first, [props.first]);

  const Row = ({ label }: { label: string }) => <li>{label}</li>;

  function handleClick() {
    setIsOpen(!isOpen);
  }

  return (
    <div className={`card ${isOpen ? "open" : ""}`}>
      <h2>{title} {fullName} {count}</h2>
      {props.items.length && <ul>{props.items.map((item, index) => <Row key={index} label={item} />)}</ul>}
      <button onClick={() => handleClick()}>Toggle</button>
      <>
        <Spinner />
      </>
      {isLoading && "Loading"} {isError && "Error"} {String(data)}
    </div>
  );
}

function Spinner() {
  return <span />;
}
