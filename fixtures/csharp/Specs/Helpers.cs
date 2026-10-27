namespace Specs;

#region Builders
public static class Helpers
{
    public static User Build() => new HttpClient().GetFromJsonAsync<User>("/u").Result;
}
#endregion
