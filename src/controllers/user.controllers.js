import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import validator from "express-validator";
import mongoose from "mongoose";
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return {
      accessToken,
      refreshToken,
    };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;

  if (![fullName, email, username, password].every((field) => field?.trim())) {
    throw new ApiError(400, "All fields are required");
  }
  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (existedUser) {
    throw new ApiError(
      409,
      `User with email:${email} or username: ${username} already exists`
    );
  }
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, `Avatar file is missing`);
  }
  //   let coverImage = "";
  //   const avatar = await uploadOnCloudinary(avatarLocalPath);
  //   if (coverImageLocalPath) {
  //     coverImage = await uploadOnCloudinary(coverImageLocalPath);
  //   }

  let avatar;
  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);
  } catch (error) {
    throw new ApiError(500, `Failed to upload avatar`);
  }
  let coverImage;
  try {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  } catch (error) {
    throw new ApiError(500, `Failed to upload avatar`);
  }
  try {
    const user = await User.create({
      fullName,
      avatar: avatar.url,
      coverImage: coverImage.url ?? "",
      email,
      password,
      username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );
    if (!createdUser) {
      throw new ApiError(500, "Something went wrong while registering a user");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, "User created successfully!", createdUser));
  } catch (error) {
    if (avatar) {
      await deleteFromCloudinary(avatar.public_id);
    }
    if (coverImage) {
      await deleteFromCloudinary(coverImage.public_id);
    }
    throw new ApiError(
      500,
      "Something went wrong while registering a user and images were deleted"
    );
  }
});

const loginUser = asyncHandler(async (req, res) => {
  //req.body-> data
  // username or emial
  //password
  const { username, email, password } = req.body;
  if (!username || !email) {
    throw new ApiError(400, "username or email is required");
  }
  const user = await User.findOne({
    $or: [
      {
        username,
      },
      { email },
    ],
  });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user?._id
  );

  const loggedInUser = await User.findById(user?._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(200, "User logged in successfully", {
        user: loggedInUser,
        accessToken,
        refreshToken,
      })
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // const accessToken = req.cookies;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "User logout successfully", {}));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.body.refreshToken || req.cookies.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token.");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Invalid refresh token");
    }
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user?._id);
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          "Access token and refresh token successfully generated",
          {
            accessToken,
            refreshToken: newRefreshToken,
          }
        )
      );
  } catch (error) {
    console.log("");
    throw new ApiError(
      500,
      "Something went wrong while refreshing access token"
    );
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword && !oldPassword) {
    throw new ApiError(400, "Password is required");
  }
  const userId = req.user?._id;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(401, "User not found");
  }
  const isPasswordValid = user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new ApiError(400, "Old password is incorrect");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Password updated successfully, please login", {})
    );
});
const getCurrentUser = asyncHandler(async (req, res) => {
  console.log("req.user", req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, "Current user data", req.user));
});
const getUsers = asyncHandler(async (_, res) => {
  const users = await User.find().select("-password -refreshToken");
  if (!users) {
    throw new ApiError(400, "Something went wrong while getting users");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Get all users succesfully", users));
});
const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  console.log("userId", userId);
  if (!userId) {
    throw new ApiError(404, "Please provide user id");
  }
  const user = await User.findById(userId).select("-password -refreshToken");
  if (!user) {
    throw new ApiError(404, "User not found!");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, "get user data succesfully", user));
});

const updateUser = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError(400, "fullname and email is required");
  }
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          fullName,
          email: email.toLowerCase(),
        },
      },
      {
        new: true,
      }
    ).select("-password -refreshToken");
    console.log("updatedUser", updatedUser);
    return res
      .status(200)
      .json(new ApiResponse(200, "User updated successfully", updatedUser));
  } catch (error) {
    throw new ApiError(
      500,
      error.message ?? "Something went wrong while updating user"
    );
  }
});

const updateAvatar = asyncHandler(async (req, res) => {
  const localAvatarPath = req.file?.path;
  if (!localAvatarPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  try {
    const updatedAvatar = await uploadOnCloudinary(localAvatarPath);
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          avatar: updatedAvatar.url,
        },
      },
      {
        new: true,
      }
    );
    return res
      .status(200)
      .json(new ApiResponse(200, "Avatar is updated", user));
  } catch (error) {
    throw new ApiError(
      500,
      error.message ?? "Something went wrong while updating avatar"
    );
  }
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  console.log("username", username);
  if (!username) {
    throw new ApiError(400, "Username us required");
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subcriber",
        as: "subcriberedTo ",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: { $ifNull: ["$subscribers", []] },
        },
        channelSubscribedToCount: {
          $size: { $ifNull: ["$subcriberedTo", []] },
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      //necessary data
      $project: {
        fullName: 1,
        username: 1,
        email: 1,
        avatar: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        coverImage: 1,
      },
    },
  ]);
  console.log("\n\n-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_\n\n");
  console.log("channel getting data:", channel);
  console.log("\n\n-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_\n\n");

  if (!channel) {
    throw new ApiError(404, "channel not found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, "channel profile fetch successfully", channel[0])
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "videoOwner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$videoOwner",
              },
            },
          },
        ],
      },
    },
    {
      $project: {
        username: 1,
        fullName: 1,
        avatar: 1,
        watchHistory: 1,
      },
    },
  ]);

  if (!user || user.length === 0) {
    throw new ApiError(400, "Watch history not fetched");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, "watch history fetched successfully", user[0]));
});
export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  changeCurrentPassword,
  getUsers,
  getUserById,
  getCurrentUser,
  updateUser,
  updateAvatar,
  getUserChannelProfile,
  getWatchHistory,
};
