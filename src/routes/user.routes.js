import { Router } from "express";
import { registerUser } from "../controllers/user.controllers";
const router = Router();
router.route("/").get(registerUser);

export default router;
