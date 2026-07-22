const { default: mongoose } = require('mongoose');
const ApiError = require('../../helpers/ApiError');
const User = require('../User/user.model');
const bcrypt = require('bcryptjs');
const { default: status } = require('http-status');
const userModel = require('../User/user.model');
const { addPartnerService, editPartnerService } = require('../Partner/partner.service');
const partnerModel = require('../Partner/partner.model');
const employerModel = require('../Employer/employer.model');



const addUser = async (userBody) => {
  // console.log({ userBody });
  if (!userBody.fullName) {
    if (userBody.businessName) {
      userBody.fullName = userBody.businessName;
    } else {
      userBody.fullName = "User"; // fallback default
    }
  }
  // userBody.fullName = userBody.businessName ? userBody.businessName : userBody.fullName;
  const user = await userModel.create(userBody);
  if (userBody.role === 'partner') {
    const payload = {
      user: user._id,
      ...(userBody.businessName && { businessName: userBody.businessName }),
      ...(userBody.image && { image: userBody.image }),
      ...(userBody.category && { category: userBody.category }),
      ...(userBody.subcategory && { subcategory: userBody.subcategory }),
      ...(userBody.bankStatement && { bankStatement: userBody.bankStatement }),
      ...(userBody.businessCertification && { businessCertification: userBody.businessCertification }),
      ...(userBody.identityProof && { identityProof: userBody.identityProof }),
      ...(userBody.certificate && { certificate: userBody.certificate }),
    };
    // console.log({ payload })
    await addPartnerService(payload)
  }
  return user;
}

const deleteAccountService = async (id) => {

  const user = await userModel.findById(id);

  if (!user) {
    throw new Error("User not found");
  }

  // modify email if exists
  let updatedEmail = user.email;
  if (user.email) {
    updatedEmail = `deleted_${Date.now()}_${user.email}`;
  }

  // soft delete user
  const deletedUser = await userModel.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
      email: updatedEmail,
    },
    { new: true }
  );

  // role-based delete
  if (user.role === 'partner') {
    await partnerModel.findOneAndUpdate(
      { user: id },
      { isDeleted: true },
      { new: true }
    );
  }

  if (user.role === 'hr') {
    await employerModel.findOneAndUpdate(
      { user: id },
      { isDeleted: true },
      { new: true }
    );
  }

  if (user.role === 'admin') {
    await adminModel.findOneAndDelete({ user: id });
  }

  return deletedUser;
};



// const login = async (createdby, receiverType, inputPassword) => {
//   let user;

//   //  ROLE-BASED LOGIN RULE
//   if (receiverType === "phone") {
//     user = await userModel.findOne({ phoneNumber: createdby }).select("+password");

//     if (!user) throw new ApiError(status.NOT_FOUND, "User not found");

//     //  only normal users can login with phone
//     if (["admin", "hr", "partner"].includes(user.role)) {
//       throw new ApiError(
//         status.UNAUTHORIZED,
//         "This role must login using email"
//       );
//     }
//   }

//   if (receiverType === "email") {
//     user = await userModel.findOne({ email: createdby }).select("+password");

//     if (!user) throw new ApiError(status.NOT_FOUND, "User not found");

//     //  normal users cannot login with email
//     if (user.role === "user") {
//       throw new ApiError(
//         status.UNAUTHORIZED,
//         "User must login using phone number"
//       );
//     }
//   }

//   if (!user) throw new ApiError(status.NOT_FOUND, "User not found");

//   if (user.isDeleted) throw new ApiError(status.NOT_FOUND, "User not found");

//   if (user.isBan) throw new ApiError(status.FORBIDDEN, "User is banned");

//   const isMatch = await bcrypt.compare(inputPassword, user.password);

//   if (!isMatch) throw new ApiError(status.UNAUTHORIZED, "Invalid password");

//   return user;
// };

const login = async (identifier, receiverType, inputPassword) => {
  let user;

  if (receiverType === "phone") {
    user = await userModel
      .findOne({
        number: identifier.number,
        countryCode: identifier.countryCode,
      })
      .select("+password");

    if (!user) {
      throw new ApiError(status.NOT_FOUND, "User not found");
    }

    if (["admin", "hr", "partner", "sub_admin", "sub_hr_admin"].includes(user.role)) {
      throw new ApiError(
        status.UNAUTHORIZED,
        "This role must login using email"
      );
    }
  }

  if (receiverType === "email") {
    user = await userModel
      .findOne({ email: identifier.email })
      .select("+password");
    console.log("user2", user);

    if (!user) {
      throw new ApiError(status.NOT_FOUND, "User not found");
    }

    if (user.role === "user") {
      throw new ApiError(
        status.UNAUTHORIZED,
        "User must login using phone number"
      );
    }
  }

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (user.isBan) {
    throw new ApiError(status.FORBIDDEN, "User is banned");
  }

  const isMatch = await bcrypt.compare(
    inputPassword,
    user.password
  );

  if (!isMatch) {
    throw new ApiError(
      status.UNAUTHORIZED,
      "Invalid password"
    );
  }

  return user;
};


const getUserByEmail = async (email) => {
  return await userModel.findOne({ email });
}

const getUserByPhoneNumber = async (number, countryCode) => {
  return await userModel.findOne({
    number,
    countryCode,
  });
};

const getUserById = async (id) => {
  return await userModel.findById(id);
};

const updateUserById = async (id, data) => {
  console.log({id, data });
  const userPayload = {
    fullName: data.fullName,
    image: data.image,
    email: data.email,
    location: data.location,
    address: data.address,
    // whatsappNumber: data.whatsappNumber,
    number: data.number,
    countryCode: data.countryCode
  };
console.log({ userPayload });
  const user = await userModel.findByIdAndUpdate(id, userPayload, { new: true });
  console.log({ user });

  let partnerData = null;
  let companyData = null;

  if (user.role === 'partner') {

    const partnerPayload = {
      businessName: data.fullName,
      location: data.location,
      address: data.address,
      amenities: data.amenities,
      serviceAutoApproved: data.serviceAutoApproved,
      aboutUs: data.aboutUs
    };
    console.log({ partnerPayload });

    partnerData = await partnerModel.findOneAndUpdate(
      { user: id },
      partnerPayload,
      { new: true }
    );
    console.log({ partnerData });
  }

  if (user.role === 'hr') {
    companyData = await employerModel.findOneAndUpdate(
      { user: id },
      {
        companyName: data.fullName,
        contactName: data.managers
      },
      { new: true }
    );
  }
  // console.log({ user, partnerData, companyData });
  
  return {
    user,
    partner: partnerData,
    company: companyData
  };
};


const allPartnersService = async () => {
  return await User.find({ role: 'partner' }).select('_id fullName image');
}


const profileByIdService = async (userId) => {
  const user = await userModel.findById(userId);

  if (!user) return null;

  let partnerData = null;
  let companyData = null;

  if (user.role === 'partner') {
    partnerData = await partnerModel.findOne({ user: userId });
  }

  if (user.role === 'hr') {
    companyData = await employerModel.findOne({ user: userId });
  }

  return {
    user,
    partner: partnerData,
    company: companyData
  };
};


const partnerProfileService = async (userId) => {
  return await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $lookup: {
        from: "partners",
        localField: "_id",
        foreignField: "user",
        as: "partnerData"
      }
    },
    {
      $unwind: {
        path: "$partnerData",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        businessName: '$partnerData.businessName',
        aboutUs: '$partnerData.aboutUs',
        // location: '$partnerData.location',
        // amenities: '$partnerData.amenities',
        // whatsappNumber: 1,
        number: 1,
        countryCode: 1,
        image: 1,
        location: 1,
        address: 1
      }
    }
  ]);
}


const allUserService = async (options) => {
  const { page = 1, limit = 10, search, isBan, role } = options;

  const skip = (page - 1) * limit;

  const searchMatch = search
    ? {
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { number: { $regex: search, $options: "i" } },
          { "companyData.companyName": { $regex: search, $options: "i" } },
          { role: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  const banMatch =
    isBan !== undefined ? { isBan: isBan === "true" } : {};

  const roleMatch = role
    ? { role: { $in: role.split(",") } }
    : {};

  const aggregation = [
    {
      $match: {
        isDeleted: false,
        role: { $ne: "admin" },
        isVerified: false,
        ...banMatch,
        ...roleMatch,
      },
    },

    {
      $lookup: {
        from: "employees",
        localField: "_id",
        foreignField: "user",
        as: "employeeData",
      },
    },
    { $unwind: { path: "$employeeData", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "employers",
        localField: "employeeData.company",
        foreignField: "_id",
        as: "companyData",
      },
    },
    { $unwind: { path: "$companyData", preserveNullAndEmptyArrays: true } },

    { $match: searchMatch },

    { $sort: { createdAt: -1 } },

    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              fullName: 1,
              role: 1,
              number: 1,
              countryCode: 1,
              image: 1,
              email: 1,
              isBan: 1,
              note: 1,
              reportCount: 1,
              flagCount: 1,
              wallet: 1,
              bookingCompleted: 1,
              employer: "$companyData.companyName",
              totalRevenue: 1,
              digitalWallet: 1,
              status: 1,
              createdAt: 1,
            },
          },
        ],
        totalCount: [{ $count: "total" }],
      },
    },
  ];

  const result = await userModel.aggregate(aggregation);

  const data = result[0]?.data || [];
  const totalResults = result[0]?.totalCount[0]?.total || 0;

  return {
    result: data,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
    },
  };
};


module.exports = {
  login,
  addUser,
  getUserByEmail,
  getUserByPhoneNumber,
  getUserById,
  updateUserById,
  profileByIdService,
  partnerProfileService,
  allUserService,
  deleteAccountService,
  allPartnersService
};
