using Microsoft.Extensions.Options;
using MongoApi.Services;
using MongoApi;
using MongoDB.Driver;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// MongoDB
builder.Services.AddSingleton(
    builder.Configuration.GetSection("MongoDB").Get<MongoDBSettings>()!);

builder.Services.AddSingleton<IMongoClient>(sp =>
{
    var settings = sp.GetRequiredService<MongoDBSettings>();
    return new MongoClient(settings.ConnectionString);
});

builder.Services.AddScoped<MongoDBService>(sp =>
{
    var settings = sp.GetRequiredService<MongoDBSettings>();
    var client = sp.GetRequiredService<IMongoClient>();
    return new MongoDBService(client, settings.DatabaseName);
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseHttpsRedirection();
}

app.UseAuthorization();
app.MapControllers();

app.Run();
