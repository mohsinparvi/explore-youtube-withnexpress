import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

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
  console.log("i am here......");
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
    console.log("uplaoded avatar", avatar);
  } catch (error) {
    console.log("error uploading avatar", error);
    throw new ApiError(500, `Failed to upload avatar`);
  }
  let coverImage;
  try {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
    console.log("uplaoded cover Image", coverImage);
  } catch (error) {
    console.log("error uploading cover Image", error);
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
    console.log("User creation failed");
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
      $set: {
        refreshToken: undefined,
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
      http,
    };
  } catch (error) {
    console.log("");
  }
});

export { registerUser, loginUser, refreshAccessToken, logoutUser };
