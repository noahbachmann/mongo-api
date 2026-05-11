using MongoApi.Services;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;

namespace MongoApi.Controllers;

/// <summary>
/// Manage MongoDB databases — list, inspect, and drop databases on the connected server.
/// </summary>
[ApiController]
[Route("api/db")]
[Tags("Databases")]
public class DatabaseController(MongoDBService mongoDBService) : ControllerBase
{
    private readonly MongoDBService _mongoDBService = mongoDBService;

    /// <summary>
    /// List all databases on the server
    /// </summary>
    /// <response code="200">Array of database names</response>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListDatabases()
    {
        var databases = await _mongoDBService.ListDatabasesAsync();
        return Ok(databases);
    }

    /// <summary>
    /// Get stats for a database (storage size, document count, indexes, etc.)
    /// </summary>
    /// <param name="dbName">Database name</param>
    [HttpGet("{dbName}/stats")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetDatabaseStats(string dbName)
    {
        try
        {
            var stats = await _mongoDBService.GetDatabaseStatsAsync(dbName);
            return Ok(stats.ToJson());
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Drop a database — this permanently deletes all collections and data
    /// </summary>
    /// <param name="dbName">Database name to drop</param>
    [HttpDelete("{dbName}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DropDatabase(string dbName)
    {
        await _mongoDBService.DropDatabaseAsync(dbName);
        return Ok(new { message = $"Database '{dbName}' dropped." });
    }
}