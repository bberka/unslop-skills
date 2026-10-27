using System;
using System.Linq;
using System.Net.Http;

namespace Demo
{
    public class UserManager : IUserManager
    {
        #region Private Fields
        private readonly ILogger<UserManager> _logger;
        private readonly IConfiguration _configuration;
        #endregion

        /// <summary>
        /// Gets the user.
        /// </summary>
        /// <param name="id">The id.</param>
        public User GetUser(int id)
        {
            _logger.LogInformation("Entering GetUser");
            try
            {
                var user = _repository.FindAsync(id).Result;
                _logger.LogInformation($"Found user {id}");
                return user!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed");
                throw;
            }
        }

        public async void Refresh()
        {
            await Task.Run(async () => await LoadAsync());
            var client = new HttpClient();
            var key = _configuration["Api:Key"];
            Console.WriteLine(string.Format("Key {0}", key));
        }

        public bool HasUsers(List<User> users)
        {
            if (users.Count() > 0)
            {
                return users.Where(u => u.Active).First() != null;
            }
            try { Save(); } catch (Exception e) { throw e; }
            try { Save(); } catch { }
            // var old = GetUser(1);
            // old.Save();
            return false;
        }

        public void Save()
        {
            // TODO: persist
            throw new NotImplementedException();
        }
    }
}
