import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const healthcheck = asyncHandler(async (req, res, next) => {
  return res
    .status(200)
    .json(new ApiResponse(200, "OK", "Health check is passed"));
});

export { healthcheck };
