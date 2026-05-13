using Microsoft.Extensions.Options;
using MongoApi;
using MongoApi.Services;
using MongoDB.Driver;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFilename));
});

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

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3005")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
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
app.UseCors();
app.UseAuthorization();
app.MapControllers();

app.Run();
