using Microsoft.AspNetCore.Mvc;
using MongoApi.Services;
using MongoDB.Bson;

namespace MongoApi.Controllers;

/// <summary>
/// CRUD operations for MongoDB collections and their documents.
/// All endpoints default to the configured database unless overridden with the db query parameter.
/// </summary>
[ApiController]
[Route("api/collection")]
[Tags("Collections")]
public class CollectionController(MongoDBService dbService) : ControllerBase
{
    private readonly MongoDBService _mongoDBService = dbService;

    /// <summary>
    /// List all collections
    /// </summary>
    /// <param name="db">Optional database name override</param>
    /// <response code="200">Array of collection names</response>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListCollections([FromQuery] string? db = null)
    {
        var collections = await _mongoDBService.ListCollectionsAsync(db);
        return Ok(collections);
    }

    /// <summary>
    /// Create a new collection
    /// </summary>
    /// <param name="name">Collection name to create</param>
    /// <param name="db">Optional database name override</param>
    [HttpPost("{name}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateCollection(string name, [FromQuery] string? db = null)
    {
        await _mongoDBService.CreateCollectionAsync(name, db);
        return Ok(new { message = $"Collection '{name}' created." });
    }

    /// <summary>
    /// Drop a collection
    /// </summary>
    /// <param name="name">Collection name to drop</param>
    /// <param name="db">Optional database name override</param>
    [HttpDelete("{name}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DropCollection(string name, [FromQuery] string? db = null)
    {
        await _mongoDBService.DropCollectionAsync(name, db);
        return Ok(new { message = $"Collection '{name}' dropped." });
    }

    /// <summary>
    /// Get collection stats (document count, storage size, indexes, etc.)
    /// </summary>
    /// <param name="name">Collection name</param>
    /// <param name="db">Optional database name override</param>
    [HttpGet("{name}/stats")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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
    /// Get documents from a collection with optional filtering and pagination
    /// </summary>
    /// <param name="name">Collection name</param>
    /// <param name="db">Optional database name override</param>
    /// <param name="filter">MongoDB filter as JSON, e.g. {"age": {"$gt": 25}}</param>
    /// <param name="limit">Max documents to return (default 50)</param>
    /// <param name="skip">Number of documents to skip for pagination</param>
    [HttpGet("{name}/documents")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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
    /// Get a single document by its _id
    /// </summary>
    /// <param name="name">Collection name</param>
    /// <param name="id">Document ObjectId</param>
    /// <param name="db">Optional database name override</param>
    [HttpGet("{name}/documents/{id}")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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
    /// Insert a document
    /// </summary>
    /// <remarks>
    /// Pass any valid JSON object as the request body. An _id will be generated if not provided.
    /// </remarks>
    /// <param name="name">Collection name</param>
    /// <param name="json">JSON document to insert</param>
    /// <param name="db">Optional database name override</param>
    [HttpPost("{name}/documents")]
    [ProducesResponseType(typeof(string), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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
    /// Update a document by its _id
    /// </summary>
    /// <remarks>
    /// Pass MongoDB update operators in the body, e.g. {"$set": {"name": "Alice"}}
    /// </remarks>
    /// <param name="name">Collection name</param>
    /// <param name="id">Document ObjectId</param>
    /// <param name="json">Update operations as JSON</param>
    /// <param name="db">Optional database name override</param>
    [HttpPatch("{name}/documents/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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

    /// <summary>
    /// Update the first document matching a filter
    /// </summary>
    /// <param name="name">Collection name</param>
    /// <param name="json">Update operations as JSON</param>
    /// <param name="filter">MongoDB filter as JSON</param>
    /// <param name="db">Optional database name override</param>
    [HttpPatch("{name}/documents/single")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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

    /// <summary>
    /// Update all documents matching a filter
    /// </summary>
    /// <param name="name">Collection name</param>
    /// <param name="json">Update operations as JSON</param>
    /// <param name="filter">MongoDB filter as JSON — updates ALL documents if omitted</param>
    /// <param name="db">Optional database name override</param>
    [HttpPatch("{name}/documents")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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
            return Ok(new { message = "Documents updated.", modifiedCount = modified });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Delete a document by its _id
    /// </summary>
    /// <param name="name">Collection name</param>
    /// <param name="id">Document ObjectId</param>
    /// <param name="db">Optional database name override</param>
    [HttpDelete("{name}/documents/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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

    /// <summary>
    /// Delete all documents matching a filter
    /// </summary>
    /// <param name="name">Collection name</param>
    /// <param name="filter">MongoDB filter as JSON — deletes ALL documents if omitted</param>
    /// <param name="db">Optional database name override</param>
    [HttpDelete("{name}/documents")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DeleteDocuments(
        string name,
        [FromQuery] string? filter = null,
        [FromQuery] string? db = null)
    {
        try
        {
            var modified = await _mongoDBService.DeleteDocumentsAsync(name, filter?.ToString(), db);
            if (modified == 0) return NotFound(new { error = "Document not found." });
            return Ok(new { message = "Documents deleted.", deletedCount = modified });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}