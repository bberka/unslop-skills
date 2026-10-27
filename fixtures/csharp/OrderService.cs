namespace Demo;

public sealed class OrderService(AppDbContext db, ILogger<OrderService> logger)
{
    public async Task<Order?> FindAsync(int id, CancellationToken ct)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == id, ct);
        if (order is null)
        {
            logger.LogWarning("Order {OrderId} not found", id);
        }
        return order;
    }

    public bool HasOpenOrders(IReadOnlyList<Order> orders) => orders.Any(o => o.IsOpen);

    // Totals are stored in minor units (cents) to avoid rounding drift; see ADR-0007.
    public static decimal ToMajorUnits(long minor) => minor / 100m;
}
