namespace Lib;

/// <summary>
/// Retries an operation with a fixed delay between attempts.
/// </summary>
public sealed class RetryPolicy
{
    /// <summary>
    /// Gets the retry count.
    /// </summary>
    public int RetryCount { get; init; } = 3;

    /// <summary>
    /// Gets the delay.
    /// </summary>
    private TimeSpan Delay { get; } = TimeSpan.FromSeconds(1);

    /// <summary>
    /// Runs <paramref name="action"/> until it succeeds or the retry count is spent.
    /// </summary>
    /// <param name="action">The operation to retry.</param>
    /// <param name="ct">The ct.</param>
    public async Task ExecuteAsync(Func<CancellationToken, Task> action, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await action(ct).ConfigureAwait(false);
                return;
            }
            catch (Exception) when (attempt < RetryCount)
            {
                await Task.Delay(Delay, ct).ConfigureAwait(false);
            }
        }
    }
}
