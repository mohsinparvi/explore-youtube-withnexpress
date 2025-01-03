import { Router } from "express";
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  changeCurrentPassword,
  getUsers,
  getUserById,
  getCurrentUser,
  updateUser,
  updateAvatar,
  getUserChannelProfile,
  getWatchHistory,
} from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();
router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/").get(getUsers);

//secured routes
router.route("/get-current-user").get(verifyJWT, getCurrentUser);
router
  .route("/get-channel-profile/:username")
  .get(verifyJWT, getUserChannelProfile);
router.route("/get-watch-history").get(verifyJWT, getWatchHistory);

router
  .route("/update-avatar")
  .patch(verifyJWT, upload.single("avatar"), updateAvatar);
router.route("/").patch(verifyJWT, updateUser);

router.route("/:userId").get(verifyJWT, getUserById);

router.route("/logout").post(verifyJWT, logoutUser);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);

export default router;
