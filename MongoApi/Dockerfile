# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
 
COPY *.csproj ./
RUN dotnet restore
 
COPY . .
RUN dotnet publish -c Release -o /app
 
# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
WORKDIR /app
COPY --from=build /app .
 
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
 
ENTRYPOINT ["dotnet", "MongoApi.dll"]