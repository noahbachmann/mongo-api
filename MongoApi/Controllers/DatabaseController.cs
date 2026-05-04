using MongoApi.Services;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;

namespace MongoApi.Controllers;

[ApiController]
[Route("api/db")]
public class DatabaseController(DatabaseService dbService) : ControllerBase
{
    private readonly DatabaseService _dbService = dbService;

    /// <summary>
    /// List all databases
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ListDatabases()
    {
        var databases = await _dbService.ListDatabasesAsync();
        return Ok(databases);
    }

    /// <summary>
    /// Get stats for a specific database
    /// </summary>
    [HttpGet("{dbName}/stats")]
    public async Task<IActionResult> GetDatabaseStats(string dbName)
    {
        try
        {
            var stats = await _dbService.GetDatabaseStatsAsync(dbName);
            return Ok(stats.ToJson());
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Drop a database
    /// </summary>
    [HttpDelete("{dbName}")]
    public async Task<IActionResult> DropDatabase(string dbName)
    {
        await _dbService.DropDatabaseAsync(dbName);
        return Ok(new { message = $"Database '{dbName}' dropped." });
    }
}
