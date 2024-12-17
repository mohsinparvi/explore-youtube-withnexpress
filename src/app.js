import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
const app = express();
import logger from "./utils/logger.js";
import morgan from "morgan";

const morganFormat = ":method :url :status :response-time ms";

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
app.use(cookieParser()); // parse cookies from cookie
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        const logObject = {
          method: message.split(" ")[0],
          url: message.split(" ")[1],
          status: message.split(" ")[2],
          responseTime: message.split(" ")[3],
        };
        logger.info(JSON.stringify(logObject));
      },
    },
  })
);

//import routes
import healthcheckRouter from "./routes/healthcheck.routes.js";
import userRouter from "./routes/user.routes.js";
import { errorHandler } from "./middlewares/error.middlewares.js";

// Routes
app.use("/api/v1/healthcheck", healthcheckRouter);
app.use("/api/v1/users", userRouter);

app.use(errorHandler);

export { app };
