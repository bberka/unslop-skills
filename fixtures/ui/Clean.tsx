export function Inventory({ items, loading }: { items: { sku: string; name: string; onHand: number }[]; loading?: boolean }) {
  if (loading) {
    return <div className="skeleton h-6 animate-pulse motion-reduce:animate-none rounded-sm bg-stone-200" aria-busy="true" />;
  }
  if (items.length === 0) {
    return (
      <section className="p-6">
        <h2 className="text-lg font-semibold">No stock yet</h2>
        <p className="text-stone-700">Import a CSV of SKUs to start tracking stock levels.</p>
        <a className="underline focus-visible:outline-2" href="/import">
          Import SKUs
        </a>
        <label>
          Supplier email
          <input
            type="email"
            placeholder="orders@example.com"
            className={[
              "rounded-sm border border-stone-400 px-2 py-1 outline-none",
              "focus-visible:ring-2 focus-visible:ring-stone-700",
              "text-stone-900 dark:text-gray-300",
            ].join(" ")}
          />
        </label>
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
