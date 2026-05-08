using Microsoft.AspNetCore.Mvc;
using MongoApi.Services;
using MongoDB.Bson;

namespace MongoApi.Controllers;

[ApiController]
[Route("api/collection")]
public class CollectionController(MongoDBService dbService) : ControllerBase
{
    private readonly MongoDBService _mongoDBService = dbService;

    /// <summary>
    /// List all collections in a database (defaults to configured db)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ListCollections([FromQuery] string? db = null)
    {
        var collections = await _mongoDBService.ListCollectionsAsync(db);
        return Ok(collections);
    }

    /// <summary>
    /// Create a new collection
    /// </summary>
    [HttpPost("{name}")]
    public async Task<IActionResult> CreateCollection(string name, [FromQuery] string? db = null)
    {
        await _mongoDBService.CreateCollectionAsync(name, db);
        return Ok(new { message = $"Collection '{name}' created." });
    }

    /// <summary>
    /// Drop a collection
    /// </summary>
    [HttpDelete("{name}")]
    public async Task<IActionResult> DropCollection(string name, [FromQuery] string? db = null)
    {
        await _mongoDBService.DropCollectionAsync(name, db);
        return Ok(new { message = $"Collection '{name}' dropped." });
    }

    /// <summary>
    /// Get collection stats
    /// </summary>
    [HttpGet("{name}/stats")]
    public async Task<IActionResult> GetCollectionStats(string name, [FromQuery] string? db = null)
    {
        try
        {
            var stats = await _mongoDBService.GetCollectionStatsAsync(name, db);
            return Ok(stats.ToJson());
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get documents from a collection
    /// </summary>
    [HttpGet("{name}/documents")]
    public async Task<IActionResult> GetDocuments(
        string name,
        [FromQuery] string? db = null,
        [FromQuery] string? filter = null,
        [FromQuery] int limit = 50,
        [FromQuery] int skip = 0)
    {
        try
        {
            var docs = await _mongoDBService.GetDocumentsAsync(name, db, filter, limit, skip);
            var count = await _mongoDBService.CountDocumentsAsync(name, db, filter);
            return Ok(new
            {
                total = count,
                skip,
                limit,
                documents = docs.Select(d => d.ToJson())
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get a single document by ID
    /// </summary>
    [HttpGet("{name}/documents/{id}")]
    public async Task<IActionResult> GetDocument(string name, string id, [FromQuery] string? db = null)
    {
        try
        {
            var doc = await _mongoDBService.GetDocumentByIdAsync(name, id, db);
            if (doc == null) return NotFound(new { error = "Document not found." });
            return Ok(doc.ToJson());
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Insert a document into a collection
    /// </summary>
    [HttpPost("{name}/documents")]
    public async Task<IActionResult> InsertDocument(
        string name,
        [FromBody] object json,
        [FromQuery] string? db = null)
    {
        try
        {
            var doc = await _mongoDBService.InsertDocumentAsync(name, json.ToString()!, db);
            return Created($"/api/collection/{name}/documents", doc.ToJson());
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Update a document by ID
    /// </summary>
    [HttpPatch("{name}/documents/{id}")]
    public async Task<IActionResult> UpdateDocumentById(
        string name,
        string id,
        [FromBody] object json,
        [FromQuery] string? db = null)
    {
        try
        {
            var modified = await _mongoDBService.UpdateDocumentByIdAsync(name, json.ToString()!, id, db);
            if (modified == 0) return NotFound(new { error = "No documents found or modified." });
            return Ok(new { message = "Document updated.", modifiedCount = modified });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
    [HttpPatch("{name}/documents/single")]
    public async Task<IActionResult> UpdateDocument(
        string name,
        [FromBody] object json,
        [FromQuery] string? filter = null,
        [FromQuery] string? db = null)
    {
        try
        {
            var modified = await _mongoDBService.UpdateDocumentAsync(name, json.ToString()!, filter?.ToString(), db);
            if (modified == 0) return NotFound(new { error = "Document not found or not modified" });
            return Ok(new { message = "Document updated.", modifiedCount = modified });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }


    [HttpPatch("{name}/documents")]
    public async Task<IActionResult> UpdateDocuments(
        string name,
        [FromBody] object json,
        [FromQuery] string? filter = null,
        [FromQuery] string? db = null)
    {
        try
        {
            var modified = await _mongoDBService.UpdateDocumentsAsync(name, json.ToString()!, filter?.ToString(), db);
            if (modified == 0) return NotFound(new { error = "Document not found." });
            return Ok(new { message = "Document updated.", modifiedCount = modified });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }


    /// <summary>
    /// Delete a document by ID
    /// </summary>
    [HttpDelete("{name}/documents/{id}")]
    public async Task<IActionResult> DeleteDocument(
        string name,
        string id,
        [FromQuery] string? db = null)
    {
        try
        {
            var deleted = await _mongoDBService.DeleteDocumentAsync(name, id, db);
            if (deleted == 0) return NotFound(new { error = "Document not found." });
            return Ok(new { message = "Document deleted.", deletedCount = deleted });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{name}/documents")]
    public async Task<IActionResult> DeleteDocuments(
        string name,
        [FromQuery] string? filter = null,
        [FromQuery] string? db = null)
    {
        try
        {
            var modified = await _mongoDBService.DeleteDocumentsAsync(name, filter?.ToString(), db);
            if (modified == 0) return NotFound(new { error = "Document not found." });
            return Ok(new { message = "Document updated.", modifiedCount = modified });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
