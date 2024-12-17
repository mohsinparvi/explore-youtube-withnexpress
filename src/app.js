import express from "express";
import cors from "cors";
const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// common middleware
app.use(express.json({ limit: "16kb" })); // parse requests of content-type - application/json
app.use(express.urlencoded({ extended: true, limit: "16kb" })); // extended: true allows to parse nested object properties  (e.g., name[title]=foo&name[desc]=bar)
app.use(express.static("public")); // serve static files from public folder

//import routes
import healthcheckRouter from "./routes/healthcheck.routes.js";

app.use("/api/v1/healthcheck", healthcheckRouter);

// Routes

export { app };
