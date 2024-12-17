import mongoose from "mongoose";

import { ApiError } from "../utils/api-error.js";

const errorHandler = (err, req, res, next) => {
  let error = err;
  console.error("Error:", err);
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || error instanceof mongoose.Error ? 400 : 500;
    const message = error.message || "Something went wrong";
    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }
  const response = {
    ...error,
    message: error.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  return res.status(error.statusCode).json(response);
};

export { errorHandler };
