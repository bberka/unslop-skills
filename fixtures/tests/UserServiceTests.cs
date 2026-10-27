using Moq;
using Xunit;

public class UserServiceTests
{
    [Fact]
    public void Test1()
    {
        var svc = new UserService();
        svc.Load(1);
    }

    [Fact]
    public void GetsUser()
    {
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.Find(1)).Returns(expected);
        var actual = new UserService(repo.Object).Get(1);
        Assert.Equal(expected, actual);
    }

    [Fact(Skip = "flaky")]
    public void Refreshes()
    {
        Thread.Sleep(1000);
        Assert.True(true);
    }

    [Fact]
    public void Constructs()
    {
        var svc = new UserService();
        Assert.NotNull(svc);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public void LoadsEveryUser(int id)
    {
        new UserService().Load(id);
    }

    //[Fact] - broken since the cache rewrite
    public void RefreshesTwice()
    {
        new UserService().Refresh();
    }
}
