import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;
  console.log("req.body", req.body);
  console.log("REQ>BODY", fullName, email, username, password);
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
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage.url ?? "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).set(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering a user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, "User created successfully!", createdUser));
});

export { registerUser };
