using Microsoft.EntityFrameworkCore;

namespace Demo.Domain;

public sealed class Order
{
    public int Id { get; init; }
    public bool IsOpen { get; set; }
}
