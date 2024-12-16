import { app } from "./app.js";
import dotenv from "dotenv";
import connectDB from "./db/index.js";
dotenv.config({
  path: "./.env", // Assuming your environment variables are stored in a.env file
});
const PORT = process.env.PORT || 7000;
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\nServer is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Mongodb connection error: ", err);
  });
