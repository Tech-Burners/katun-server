const { tokenGenerator, refreshTokenGenerator, resetTokenGenerator } = require("../../helpers/tokenGenerator");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const { sendOTP, verifyOTP, deleteOTP, checkOTPByEmail, checkOTPService } = require("../Otp/otp.service");
const { login, getUserByEmail, addUser, updateUserById, profileByIdService, getUserById, getUserByPhoneNumber,
  partnerProfileService,
  allUserService,
  deleteAccountService,
  allPartnersService } = require("./auth.service");
const { addToken, verifyToken, deleteToken } = require("../Token/token.service");
const jwt = require("jsonwebtoken");
const { default: status } = require("http-status");
const ApiError = require("../../helpers/ApiError");
const unlinkImage = require('../../helpers/fileExists');
const { myDocumentsService, updateDocumentsService } = require("../Partner/partner.service");
const { getAdminByUserId } = require("../Admin/admin.service");
const { add } = require("winston");



// Login
const localAuth = catchAsync(async (req, res) => {
  const { email, phoneNumber, password } = req.body;

  if ((!email && !phoneNumber) || (email && phoneNumber)) {
    throw new ApiError(status.BAD_REQUEST, "Provide either email OR phone, not both");
  }
  const identifier = email || phoneNumber;
  const type = email ? 'email' : 'phone';

  const user = await login(identifier, type, password);
  // console.log({ user });
  let admin;
  // if (user.role === 'admin' || user.role === 'hr') {
  if (['admin', 'hr', 'sub_hr_admin','sub_admin'].includes(user.role)) {
    console.log("role",user.role)
    admin = await getAdminByUserId(user._id);
  }
  const token = await tokenGenerator(user, admin);
  const refreshToken = refreshTokenGenerator(user);

  return res.status(status.OK).json(response({
    status: "OK",
    statusCode: status.OK,
    message: "Login successful",
    data: {
      _id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      role: user.role,
      image: user.image,
      isVerified: user.isVerified,
      categoryPermissions: admin?.categoryPermissions,
      parent: admin?.parent
    },
    accessToken: token,
    refreshToken:refreshToken
  }));
});


//Sign up
const signUp = catchAsync(async (req, res) => {

  const { email, phoneNumber, role, fullName } = req.body;

  if (!role) {
    throw new ApiError(status.BAD_REQUEST, "Role is required!");
  }

  /* ---------- FILE HANDLE FIX ---------- */

  if (req.files) {

    if (req.files.image?.[0]) {
      req.body.image = `/uploads/users/${req.files.image[0].filename}`;
    }

    if (req.files.certificate?.[0]) {
      req.body.certificate = `/uploads/users/${req.files.certificate[0].filename}`;
    }

    if (req.files.identityProof?.[0]) {
      req.body.identityProof = `/uploads/users/${req.files.identityProof[0].filename}`;
    }

    if (req.files.businessCertification?.[0]) {
      req.body.businessCertification = `/uploads/users/${req.files.businessCertification[0].filename}`;
    }

    if (req.files.bankStatement?.[0]) {
      req.body.bankStatement = `/uploads/users/${req.files.bankStatement[0].filename}`;
    }
  }

  /* ---------- ROLE LOGIC ---------- */

  let sentTo;
  let receiverType;
  let existingOTP;

  if (role === "user") {

    if (!phoneNumber) {
      throw new ApiError(status.BAD_REQUEST, "Phone number is required for user!");
    }

    const existingUser = await getUserByPhoneNumber(phoneNumber);

    if (existingUser) {
      throw new ApiError(status.CONFLICT, "This phone number already used!");
    }

    sentTo = phoneNumber;
    receiverType = "phone";
    existingOTP = await checkOTPService(phoneNumber, "phone");

  } else {

    if (!email) {
      throw new ApiError(status.BAD_REQUEST, "Email is required!");
    }

    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      throw new ApiError(status.CONFLICT, "This email already used!");
    }

    sentTo = email;
    receiverType = "email";
    existingOTP = await checkOTPService(email, "email");
  }

  /* ---------- OTP ---------- */

  let message = "";

  if (existingOTP) {
    message = "OTP already sent. Please wait for a few minutes.";
  } else {

    const otpData = await sendOTP(
      fullName,
      sentTo,
      receiverType,
      "email-verification"
    );

    if (otpData) {
      message =
        receiverType === "email"
          ? "OTP sent to your email"
          : "OTP sent to your phone";
    }
  }

  // console.log(req.body);

  const accessToken = jwt.sign(
    { ...req.body },
    process.env.JWT_ACCESS_TOKEN,
    { expiresIn: "1h" }
  );

  return res.status(status.CREATED).json(
    response({
      status: "OK",
      statusCode: status.CREATED,
      type: "user",
      message,
      accessToken
    })
  );
});


const updateDocuments = catchAsync(async (req, res) => {
    if (req.files) {
    if (req.files.image?.[0]) {
      req.body.image = `/uploads/users/${req.files.image[0].filename}`;
    }

    if (req.files.certificate?.[0]) {
      req.body.certificate = `/uploads/users/${req.files.certificate[0].filename}`;
    }

    if (req.files.identityProof?.[0]) {
      req.body.identityProof = `/uploads/users/${req.files.identityProof[0].filename}`;
    }

    if (req.files.businessCertification?.[0]) {
      req.body.businessCertification = `/uploads/users/${req.files.businessCertification[0].filename}`;
    }

    if (req.files.bankStatement?.[0]) {
      req.body.bankStatement = `/uploads/users/${req.files.bankStatement[0].filename}`;
    }
  }
  const result = await updateDocumentsService(req.User._id, req.body);
  return res.status(status.OK).json(response({ status: 'OK', statusCode: status.OK,
     type: 'user', message: 'documents updated successfully'
     }));
});


const partnerSignUpController = catchAsync(async (req, res) => {

  const { email } = req.body;

  let sentTo;
  let receiverType;
  let existingOTP;


  if (!email) {
    throw new ApiError(status.BAD_REQUEST, "Email is required!");
  }

  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    throw new ApiError(status.CONFLICT, "This email already used!");
  }

  sentTo = email;
  receiverType = "email";
  existingOTP = await checkOTPService(email, "email");

  let message = "";

  if (existingOTP) {
    message = "OTP already sent. Please wait for a few minutes.";
  } else {

    const otpData = await sendOTP(
      fullName = 'Partner',
      sentTo,
      receiverType,
      "email-verification"
    );

    if (otpData) {
      message =
        receiverType === "email"
          ? "OTP sent to your email"
          : "OTP sent to your phone";
    }
  }

  // console.log(req.body);

  const accessToken = jwt.sign(
    { ...req.body },
    process.env.JWT_ACCESS_TOKEN,
    { expiresIn: "1h" }
  );

  return res.status(status.CREATED).json(
    response({
      status: "OK",
      statusCode: status.CREATED,
      type: "user",
      message,
      accessToken
    })
  );
});


const allUserController = catchAsync(async (req, res) => {
  const options = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    search: req.query.search || "",
    isBan: req.query.isBan,
    role: req.query.role
  }
  const result = await allUserService(options);
  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "user",
      message: "all user fetched successfully",
      data: result
    })
  );
});


// Validate email
const otpVerification = catchAsync(async (req, res) => {
  const email = req.User?.email || req.body.email;
  const phoneNumber = req.User?.phoneNumber || req.body.phoneNumber;
  let otpData;
  if (email) {
    otpData = await verifyOTP(email, "email", req.body.purpose, req.body.otp);
  }
  if (phoneNumber) {
    otpData = await verifyOTP(phoneNumber, "phone", req.body.purpose, req.body.otp);
  }
  if (otpData && otpData.purpose === 'email-verification') {
    const registeredUser = await addUser(req.User);
    const accessToken = await tokenGenerator(registeredUser);
    return res.status(status.CREATED).json(response({
      status: "OK", statusCode: status.CREATED, type: "user",
      message: 'verified', data: registeredUser,
      accessToken: accessToken,
    }));
  }
  else if (otpData && otpData.purpose === 'forget-password') {
    // let user;
    // if (phoneNumber) { user = await getUserByPhoneNumber(phoneNumber) }
    // if (email) { user = await getUserByEmail(email) }
    // const token = await tokenGenerator(user);
    // const data = { token: token, userId: user._id, purpose: "forget-password" };
    // await addToken(data);
    // return res.status(status.OK).json(response({
    //   status: "OK", statusCode: status.OK,
    //   type: "user",
    //   message: 'verified', data: user,
    //   accessToken: token,
    // }));


    let user;

    if (phoneNumber) user = await getUserByPhoneNumber(phoneNumber);
    if (email) user = await getUserByEmail(email);

    const accessToken = resetTokenGenerator(user);

    return res.status(status.OK).json(
      response({
        status: "OK",
        message: "OTP verified",
        accessToken
      })
    );

  }
});


const otpVerificationForPartner = catchAsync(async (req, res) => {
  console.log(req.User);
  // allow both flows
  const email = req.User?.email || req.body.email;

  if (!email) {
    throw new ApiError(status.BAD_REQUEST, "Email required");
  }

  const otpData = await verifyOTP(
    email,
    "email",
    req.body.purpose,
    req.body.otp
  );

  if (!otpData) {
    throw new ApiError(status.BAD_REQUEST, "Invalid OTP");
  }

  /* ---------- SIGNUP VERIFY ---------- */

  if (otpData.purpose === "email-verification") {

    const payload = {
      email,
      role: req.User.role,
      password: req.User.password,
      otpVerified: true
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_ACCESS_TOKEN,
      { expiresIn: "30m" }
    );

    return res.status(status.CREATED).json(
      response({
        status: "OK",
        message: "Email verified",
        accessToken
      })
    );
  }

  /* ---------- FORGET PASSWORD ---------- */

  if (otpData.purpose === "forget-password") {

    const user = await getUserByEmail(email);

    if (!user) {
      throw new ApiError(status.NOT_FOUND, "User not found");
    }

    const accessToken = resetTokenGenerator(user);

    const safeUser = {
      _id: user._id,
      email: user.email,
      fullName: user.fullName
    };

    return res.status(status.OK).json(
      response({
        status: "OK",
        message: "OTP verified",
        accessToken
      })
    );
  }

});



const createPartnerController = catchAsync(async (req, res) => {

  if (!req.User?.otpVerified) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "Error",
        message: "OTP not verified"
      })
    );
  }

  /* ---------------- FILE PATHS ---------------- */

  if (req.files) {

    if (req.files.image?.[0])
      req.body.image = `/uploads/users/${req.files.image[0].filename}`;

    if (req.files.certificate?.[0]) {
      req.body.certificate = `/uploads/users/${req.files.certificate[0].filename}`;
      isCertified: true
    }

    if (req.files.identityProof?.[0])
      req.body.identityProof = `/uploads/users/${req.files.identityProof[0].filename}`;

    if (req.files.businessCertification?.[0])
      req.body.businessCertification =
        `/uploads/users/${req.files.businessCertification[0].filename}`;

    if (req.files.bankStatement?.[0])
      req.body.bankStatement =
        `/uploads/users/${req.files.bankStatement[0].filename}`;
  }

  /* ---------------- MERGE DATA ---------------- */

  const userData = {
    ...req.body,        // step-2 form data
    email: req.User.email,
    password: req.User.password,
    role: req.User.role
  };

  /* ---------------- CREATE USER ---------------- */

  const registeredUser = await addUser(userData);

  const accessToken = await tokenGenerator(registeredUser);

  return res.status(status.CREATED).json(
    response({
      status: "OK",
      message: "Partner account created",
      data: registeredUser,
      accessToken
    })
  );
});

// Forget password
const forgetPassword = catchAsync(async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    throw new ApiError(status.BAD_REQUEST, "Email or phone number is required");
  }

  let user;
  let sentTo;
  let receiverType;

  if (email) {
    user = await getUserByEmail(email);
    sentTo = email;
    receiverType = "email";
  } else if (phoneNumber) {
    user = await getUserByPhoneNumber(phoneNumber);
    sentTo = phoneNumber;
    receiverType = "phone";
  }

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  const otpData = await sendOTP(
    user.fullName,
    sentTo,
    receiverType,
    "forget-password"
  );

  if (!otpData) {
    throw new ApiError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to send OTP. Please try again."
    );
  }

  const message =
    receiverType === "email"
      ? "OTP sent to your email"
      : "OTP sent to your phone";

  const payload = {
    email: user.email,
    role: user.role,
    phoneNumber: user.phoneNumber,
    fullName: user.fullName,
  }
  const token = jwt.sign(payload, process.env.JWT_ACCESS_TOKEN, { expiresIn: "1h" });
  return res.status(status.OK).json(
    response({
      status: "OK",
      statusCode: status.OK,
      type: "user",
      message,
      data: token
    })
  );
});


// const resetPassword = catchAsync(async (req, res) => {
//   const authHeader = req.headers["authorization"];

//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     throw new ApiError(status.BAD_REQUEST, "Token missing or invalid");
//   }

//   const Bearer = authHeader.split(" ")[1];

//   const tokenData = await verifyToken(Bearer, "forget-password");
//   if (!tokenData) throw new ApiError(status.BAD_REQUEST, "Invalid Token");

//   const { password } = req.body;
//   const user = await getUserByEmail(tokenData.userId.email);

//   if (!user) {
//     return res.status(status.NOT_FOUND).json(
//       response({
//         status: "Error",
//         statusCode: status.NOT_FOUND,
//         type: "user",
//         message: "user not found",
//       })
//     );
//   }

//   user.password = password;
//   await user.save();
//   await deleteToken(tokenData._id);

//   return res.status(status.OK).json(
//     response({
//       status: "OK",
//       statusCode: status.OK,
//       type: "user",
//       message: "password changed",
//       data: user,
//     })
//   );
// });

const resetPassword = catchAsync(async (req, res) => {

  const user = await getUserById(req.ResetUser._id);
  console.log({ user });

  if (!user)
    throw new ApiError(404, "User not found");

  user.password = req.body.password;
  user.tokenVersion = user.tokenVersion + 1;

  await user.save();

  return res.status(200).json(
    response({
      status: "OK",
      statusCode: status.OK,
      type: "user",
      message: "Password reset successful"
    }));
});


const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken: refreshTokenString } = req.body;

  if (!refreshTokenString) {
    throw new ApiError(status.BAD_REQUEST, "Refresh token is required");
  }

  try {
    const decoded = jwt.verify(refreshTokenString, process.env.JWT_REFRESH_TOKEN);

    const user = await getUserById(decoded._id);
    if (!user) {
      throw new ApiError(status.NOT_FOUND, "User not found");
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      throw new ApiError(status.UNAUTHORIZED, "Session expired. Please login again.");
    }

    const admin = await getAdminByUserId(user._id);
    const newAccessToken = await tokenGenerator(user, admin);

    return res.status(status.OK).json(response({
      status: "OK",
      statusCode: status.OK,
      message: "Token refreshed successfully",
      accessToken: newAccessToken
    }));

  } catch (err) {
    throw new ApiError(status.UNAUTHORIZED, "Invalid or expired refresh token");
  }
});

const deleteAccountController = catchAsync(async (req, res) => {
  const result = await deleteAccountService(req.User._id);
  return res.status(status.OK).json(response({ status: 'OK', statusCode: status.OK, type: 'user', message: 'account deleted successfully', data: result }));
})


const changePassword = catchAsync(async (req, res) => {
  // console.log("changePassword controller:: ", req.User);
  let receiverType = "email";
  let createdBy = req.User.email;
  if (req.User.role === "user") {
    receiverType = "phone";
    createdBy = req.User.phoneNumber;
  }
  const { oldPassword, newPassword } = req.body;
  const verifyUser = await login(createdBy, receiverType, oldPassword);
  if (!verifyUser) {
    return res.status(status.BAD_REQUEST).json(response({ status: "Error", statusCode: status.BAD_REQUEST, type: "user", message: 'old password is incorrect' }));
  }
  verifyUser.password = newPassword;
  verifyUser.tokenVersion = verifyUser.tokenVersion + 1;
  verifyUser.isLoginToken = false;
  await verifyUser.save();
  return res.status(status.OK).json(response({ status: "OK", statusCode: status.OK, type: "user", message: 'password changed' })
  );
});


const resendOTP = catchAsync(async (req, res) => {
  const { email, purpose, phoneNumber } = req.body;
  let user;
  if (email) {
    user = await getUserByEmail(email);

    const fullName = user?.fullName || "User";
    const otpData = await sendOTP(fullName, email, "email", purpose);
    if (otpData) { return res.status(status.OK).json(response({ status: "OK", statusCode: status.OK, type: "user", message: 'otp resent to  email' })); }
  }
  if (phoneNumber) {
    user = await getUserByPhoneNumber(phoneNumber);

    const fullName = user?.fullName || "User";
    const otpData = await sendOTP(fullName, phoneNumber, "phone", purpose);
    if (otpData) { return res.status(status.OK).json(response({ status: "OK", statusCode: status.OK, type: "user", message: 'otp resent to phone' })); }
  }

});




const updateProfile = catchAsync(async (req, res) => {
  const user = await getUserById(req.User._id);
  if (!user) throw new ApiError(status.NOT_FOUND, 'user not found');

  if (req.file) {
    const { filename } = req.file;

    if (filename && filename.length > 0) {
      const defaultPath1 = '/uploads/users/user.png';
      const defaultPath2 = '/uploads/users/user.jpg';

      if (user.image !== defaultPath1 && user.image !== defaultPath2) {
        unlinkImage(user.image);
      }

      req.body.image = `/uploads/users/${filename}`;
    }
  }
  console.log("controileer",req.body)

  const result = await updateUserById(user._id, req.body);

  let formattedData;

  //  ROLE BASED RESPONSE
  if (user.role === 'partner') {
    formattedData = {
      businessName: result.partner?.businessName,
      aboutUs: result.partner?.aboutUs,
      location: result.user?.location,
      address: result.user?.address,
      amenities: result.partner?.amenities,
      serviceAutoApproved: result.partner?.serviceAutoApproved,
      // whatsappNumber: result.user.whatsappNumber,
      phoneNumber: result.user.phoneNumber,
      image: result.user.image
    };
  }

  else if (user.role === 'admin') {
    formattedData = {
      name: result.user.fullName,
      image: result.user.image,
      email: result.user.email
    };
  }

  else if (user.role === 'hr') {
    formattedData = {
      companyName: result.company?.companyName,
      image: result.user.image,
      manager: result.company?.contactName,
      email: result.user.email,
      phoneNumber: result.user.phoneNumber
    };
  }

  else {
    formattedData = {
      name: result.user.fullName,
      image: result.user.image,
      phone: result.user.phoneNumber,
      address: result.user.address,
      location: result.user.location
    };
  }

  return res.status(status.OK).json(
    response({
      status: 'OK',
      statusCode: status.OK,
      type: 'user',
      message: 'profile updated successfully',
      data: formattedData
    })
  );
});




// const updateProfile = catchAsync(async (req, res) => {

//   const user = await getUserById(req.User._id);

//   if (!user)
//     throw new ApiError(status.NOT_FOUND, "User not found");

//   /* ---------------- FILE UPDATE ---------------- */

//   if (req.files) {

//     const defaultImages = [
//       "/uploads/users/user.png",
//       "/uploads/users/user.jpg"
//     ];

//     /* IMAGE */
//     if (req.files.image?.[0]) {
//       if (!defaultImages.includes(user.image)) {
//         unlinkImage(user.image);
//       }

//       req.body.image =
//         `/uploads/users/${req.files.image[0].filename}`;
//     }

//     /* PARTNER DOCUMENTS */
//     if (req.files.certificate?.[0]) {
//       req.body.certificate =
//         `/uploads/users/${req.files.certificate[0].filename}`;
//     }

//     if (req.files.identityProof?.[0]) {
//       req.body.identityProof =
//         `/uploads/users/${req.files.identityProof[0].filename}`;
//     }

//     if (req.files.businessCertification?.[0]) {
//       req.body.businessCertification =
//         `/uploads/users/${req.files.businessCertification[0].filename}`;
//     }

//     if (req.files.bankStatement?.[0]) {
//       req.body.bankStatement =
//         `/uploads/users/${req.files.bankStatement[0].filename}`;
//     }
//   }

//   /* ---------------- UPDATE USER ---------------- */

//   const result = await updateUserById(user._id, req.body);

//   let formattedData;

//   /* ---------------- ROLE RESPONSE ---------------- */

//   if (user.role === "partner") {

//     formattedData = {
//       businessName: result.partner?.businessName,
//       aboutUs: result.partner?.aboutUs,
//       location: result.partner?.location,
//       amenities: result.partner?.amenities,
//       whatsappNumber: result.user.whatsappNumber,
//       phoneNumber: result.user.phoneNumber,
//       image: result.user.image
//     };

//   } else if (user.role === "admin") {

//     formattedData = {
//       name: result.user.fullName,
//       image: result.user.image,
//       email: result.user.email
//     };

//   } else if (user.role === "hr") {

//     formattedData = {
//       companyName: result.company?.companyName,
//       image: result.user.image,
//       manager: result.company?.contactName,
//       email: result.user.email,
//       whatsappNumber: result.user.whatsappNumber
//     };

//   } else {

//     formattedData = {
//       name: result.user.fullName,
//       image: result.user.image,
//       phone: result.user.phoneNumber
//     };
//   }

//   return res.status(status.OK).json(
//     response({
//       status: "OK",
//       statusCode: status.OK,
//       type: "user",
//       message: "Profile updated successfully",
//       data: formattedData
//     })
//   );
// });




const myDocumentsController = catchAsync(async (req, res) => {
  const document = await myDocumentsService(req.User._id);
  return res.status(status.OK).json(response({ status: 'OK', statusCode: status.OK, type: 'user', message: 'documents fetched successfully', data: document }));
});


const userDetailsByID = catchAsync(async (req, res) => {
  const result = await profileByIdService(req.User._id);
  console.log({ result });

  if (!result) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  let formattedData;

  if (result.user.role === 'partner') {
    formattedData = {
      businessName: result.partner?.businessName,
      aboutUs: result.partner?.aboutUs,
      location: result.user?.location,
      address: result.user?.address,
      amenities: result.partner?.amenities,
      serviceAutoApproved: result.partner?.serviceAutoApproved,
      // whatsappNumber: result.user.whatsappNumber,
      phoneNumber: result.user.phoneNumber,
      image: result.user.image,
      isVerified: result.user.isVerified
    };
  }

  else if (result.user.role === 'admin') {
    formattedData = {
      name: result.user.fullName,
      image: result.user.image,
      email: result.user.email
    };
  }

  else if (result.user.role === 'hr') {
    formattedData = {
      companyName: result.company?.companyName,
      image: result.user.image,
      manager: result.company?.contactName,
      email: result.user.email,
      phoneNumber: result.user.phoneNumber
    };
  }

  else {
    formattedData = {
      name: result.user.fullName,
      image: result.user.image,
      phone: result.user.phoneNumber,
      address: result.user.address,
      location: result.user.location
    };
  }

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: "User details",
      type: "user",
      data: formattedData,
      status: "OK"
    })
  );
});



const partnerProfileController = catchAsync(async (req, res) => {
  const id = req.User._id ? req.User._id : req.params.id;
  const userDetails = await partnerProfileService(id);
  return res.status(status.OK).json(response({ statusCode: status.OK, message: "user details", type: "user", data: userDetails, status: "OK" }));
})


const allPartnerController = catchAsync(async (req, res) => {
  const allPartners = await allPartnersService();
  return res.status(status.OK).json(response({ statusCode: status.OK, message: "user details", type: "user", data: allPartners, status: "OK" }));
})

module.exports = {
  localAuth,
  allPartnerController,
  signUp,
  otpVerification,
  forgetPassword,
  resetPassword,
  changePassword,
  resendOTP,
  updateProfile,
  userDetailsByID,
  partnerProfileController,
  myDocumentsController,
  createPartnerController,
  otpVerificationForPartner,
  partnerSignUpController,
  allUserController,
  deleteAccountController,
  updateDocuments,
  refreshToken
};
