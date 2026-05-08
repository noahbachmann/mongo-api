using MongoDB.Bson;
using MongoDB.Driver;

namespace MongoApi.Services;

public class MongoDBService(IMongoClient mongoClient, string defaultDatabase)
{
    private readonly IMongoClient _mongoClient = mongoClient;
    private readonly string _defaultDatabase = defaultDatabase;

    // Databases

    public async Task<List<string>> ListDatabasesAsync()
    {
        var result = await _mongoClient.ListDatabaseNamesAsync();
        return await result.ToListAsync();
    }

    public async Task<BsonDocument> GetDatabaseStatsAsync(string dbName)
    {
        var db = _mongoClient.GetDatabase(dbName);
        var command = new BsonDocument("dbStats", 1);
        return await db.RunCommandAsync<BsonDocument>(command);
    }

    public async Task DropDatabaseAsync(string dbName)
    {
        await _mongoClient.DropDatabaseAsync(dbName);
    }

    // Collections

    public async Task<List<string>> ListCollectionsAsync(string? dbName = null)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        var result = await db.ListCollectionNamesAsync();
        return await result.ToListAsync();
    }

    public async Task CreateCollectionAsync(string collectionName, string? dbName = null)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        await db.CreateCollectionAsync(collectionName);
    }

    public async Task DropCollectionAsync(string collectionName, string? dbName = null)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        await db.DropCollectionAsync(collectionName);
    }

    public async Task<BsonDocument> GetCollectionStatsAsync(string collectionName, string? dbName = null)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        var command = new BsonDocument("collStats", collectionName);
        return await db.RunCommandAsync<BsonDocument>(command);
    }

    // Documents 

    public async Task<List<BsonDocument>> GetDocumentsAsync(
        string collectionName,
        string? dbName = null,
        string? filter = null,
        int limit = 50,
        int skip = 0)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        var collection = db.GetCollection<BsonDocument>(collectionName);

        var filterDoc = string.IsNullOrEmpty(filter)
            ? FilterDefinition<BsonDocument>.Empty
            : new BsonDocumentFilterDefinition<BsonDocument>(BsonDocument.Parse(filter));

        return await collection
            .Find(filterDoc)
            .Skip(skip)
            .Limit(limit)
            .ToListAsync();
    }

    public async Task<BsonDocument?> GetDocumentByIdAsync(
        string collectionName,
        string id,
        string? dbName = null)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        var collection = db.GetCollection<BsonDocument>(collectionName);

        var filter = Builders<BsonDocument>.Filter.Eq("_id", ObjectId.Parse(id));
        return await collection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<BsonDocument> InsertDocumentAsync(
        string collectionName,
        string json,
        string? dbName = null)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        var collection = db.GetCollection<BsonDocument>(collectionName);

        var doc = BsonDocument.Parse(json);
        await collection.InsertOneAsync(doc);
        return doc;
    }

    public async Task<long> UpdateDocumentAsync(
        string collectionName,
        string json,
        string? filter,
        string? dbName)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        var collection = db.GetCollection<BsonDocument>(collectionName);

        var filterDoc = string.IsNullOrEmpty(filter)
            ? FilterDefinition<BsonDocument>.Empty
            : new BsonDocumentFilterDefinition<BsonDocument>(BsonDocument.Parse(filter));

        var update = new BsonDocument("$set", BsonDocument.Parse(json));

        var result = await collection.UpdateOneAsync(filterDoc, update);
        return result.ModifiedCount;
    }

    public async Task<long> UpdateDocumentsAsync(
        string collectionName,
        string json,
        string? filter,
        string? dbName)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        var collection = db.GetCollection<BsonDocument>(collectionName);

        var filterDoc = string.IsNullOrEmpty(filter)
            ? FilterDefinition<BsonDocument>.Empty
            : new BsonDocumentFilterDefinition<BsonDocument>(BsonDocument.Parse(filter));

        var update = new BsonDocument("$set", BsonDocument.Parse(json));

        var result = await collection.UpdateManyAsync(filterDoc, update);
        return result.ModifiedCount;
    }

    public async Task<long> DeleteDocumentAsync(
        string collectionName,
        string id,
        string? dbName = null)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        var collection = db.GetCollection<BsonDocument>(collectionName);

        var filter = Builders<BsonDocument>.Filter.Eq("_id", ObjectId.Parse(id));
        var result = await collection.DeleteOneAsync(filter);
        return result.DeletedCount;
    }

    public async Task<long> DeleteDocumentsAsync(
        string collectionName,
        string? filter,
        string? dbName = null)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        var collection = db.GetCollection<BsonDocument>(collectionName);

        var filterDoc = string.IsNullOrEmpty(filter)
            ? FilterDefinition<BsonDocument>.Empty
            : new BsonDocumentFilterDefinition<BsonDocument>(BsonDocument.Parse(filter));

        var result = await collection.DeleteManyAsync(filterDoc);
        return result.DeletedCount;
    }

    public async Task<long> CountDocumentsAsync(
        string collectionName,
        string? dbName = null,
        string? filter = null)
    {
        var db = _mongoClient.GetDatabase(dbName ?? _defaultDatabase);
        var collection = db.GetCollection<BsonDocument>(collectionName);

        var filterDoc = string.IsNullOrEmpty(filter)
            ? FilterDefinition<BsonDocument>.Empty
            : new BsonDocumentFilterDefinition<BsonDocument>(BsonDocument.Parse(filter));

        return await collection.CountDocumentsAsync(filterDoc);
    }
}
