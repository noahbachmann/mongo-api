# C# API with nuxt frontend

## Requirements

Docker

## How to run

Copy the project into any folder you want, then build and run it:

```
git clone https://github.com/noahbachmann/mongo-api.git
cd mongo-api
docker compose up -d
```

Now you can find the frontend at: [localhost:3005](http://localhost:3005/)  
(or whichever port you set for the FRONTEND_PORT)

And the api/swagger documentation at: [localhost:8085/swagger](http://localhost:8085/swagger)  
(Or whichever port you set for the API_PORT)

## Ports

API (API_PORT): **8085**  
frontend (FRONTEND_PORT): **3005**  
mongodb (MONGO_PORT): **44444**

you can change these values in the .env-file
