export function Inventory({ items }: { items: { sku: string; name: string; onHand: number }[] }) {
  if (items.length === 0) {
    return (
      <section className="p-6">
        <h2 className="text-lg font-semibold">No stock yet</h2>
        <p className="text-stone-700">Import a CSV of SKUs to start tracking stock levels.</p>
        <a className="underline focus-visible:outline-2" href="/import">
          Import SKUs
        </a>
      </section>
    );
  }
  return (
    <table className="w-full text-sm">
      <caption className="text-left font-semibold">Stock on hand</caption>
      <tbody>
        {items.map((item) => (
          <tr key={item.sku}>
            <th scope="row">{item.name}</th>
            <td>{item.onHand}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
