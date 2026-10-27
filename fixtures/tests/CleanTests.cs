using NSubstitute;
using Shouldly;
using Xunit;

public class CartTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(2, 6)]
    public void TotalIsPriceTimesQuantity(int qty, decimal total)
    {
        var cart = new Cart().Add(price: 3m, qty);
        cart.Total.ShouldBe(total);
    }

    [Fact]
    public void RejectsNegativeQuantity() => Should.Throw<ArgumentException>(() => new Cart().Add(3m, -1));

    [Fact]
    public async Task CheckoutClearsTheBasket()
    {
        var repository = Substitute.For<IBasketRepository>();
        var service = new CheckoutService(repository);

        await service.CheckoutAsync("buyer-1");

        await repository.Received(1).DeleteAsync("buyer-1");
    }

    [Fact]
    public void ParsesVerbatimPaths()
    {
        var path = @"C:\carts\{id}";
        AssertRoute(path, "{id}");
    }

    private static void AssertRoute(string template, string token)
    {
        template.ShouldContain(token);
    }
}

public class LegacyTests
{
    [Test]
    [TestCase("a")]
    [TestCase("b")]
    public void StoresEveryItem(string item)
    {
        var cart = new Cart().Add(item);
        Assert.That(cart.Items, Does.Contain(item));
    }
}
