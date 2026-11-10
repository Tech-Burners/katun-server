const { default: mongoose } = require("mongoose");
const userModel = require("./user.model");
const {
    sendAccountSuspendedEmail,
    sendAccountActivatedEmail,
} = require("../../helpers/emailNotification");

const suspendUserService = async (id) => {
    const user = await userModel.findOneAndUpdate({ _id: id }, { isBan: true }, { new: true });
    if (user?.email) {
        sendAccountSuspendedEmail({
            email: user.email,
            fullName: user.fullName,
            role: user.role || "User",
        }).catch((err) => console.error("User suspended email error:", err.message));
    }
    return user;
};

const bulkSuspendUserService = async (userIds) => {
  const users = await userModel.find({ _id: { $in: userIds } }).select("email fullName role");
  const result = await userModel.updateMany(
    {
      _id: { $in: userIds }
    },
    {
      $set: {
        isBan: true,
      },
    }
  );
  users.forEach((u) => {
    if (u.email) {
      sendAccountSuspendedEmail({
        email: u.email,
        fullName: u.fullName,
        role: u.role || "User",
      }).catch((err) => console.error("User bulk suspended email error:", err.message));
    }
  });
  return result;
};

const activeUserService = async (id) => {
    const user = await userModel.findOneAndUpdate({ _id: id }, { isBan: false }, { new: true });
    if (user?.email) {
        sendAccountActivatedEmail({
            email: user.email,
            fullName: user.fullName,
            role: user.role || "User",
        }).catch((err) => console.error("User activated email error:", err.message));
    }
    return user;
};


const getPushNotificationService = async (id) => {
  return await userModel.findById(id).select("enabledPushNotification");
}

const togglePushNotificationService = async (id) => {
  const user = await userModel.findById(id);
  user.enabledPushNotification = !user.enabledPushNotification;
  await user.save();
  return user;
}

const bulkActiveUserService = async (userIds) => {
  const users = await userModel.find({ _id: { $in: userIds } }).select("email fullName role");
  const result = await userModel.updateMany(
    {
      _id: { $in: userIds }
    },
    {
      $set: {
        isBan: false,
      },
    }
  );
  users.forEach((u) => {
    if (u.email) {
      sendAccountActivatedEmail({
        email: u.email,
        fullName: u.fullName,
        role: u.role || "User",
      }).catch((err) => console.error("User bulk activated email error:", err.message));
    }
  });
  return result;
};

const giveFlagService=async(id)=>{
    return await userModel.findOneAndUpdate({ _id: id }, { $inc: { flagCount: 1 } }, { new: true });
}




const bulkGiveFlagService = async (userIds) => {
  const objectIds = userIds.map(id => new mongoose.Types.ObjectId(id));

  const result = await userModel.updateMany(
    {
      _id: { $in: objectIds }
    },
    {
      $inc: { flagCount: 1 },
    }
  );

  return result;
};

const deleteFcmTokenService = async (id) => {
  return await userModel.findByIdAndUpdate(id, { fcmToken: '' }, { new: true });
}

const fcmTokenService = async (id, fcm) => {
    // console.log({ id, fcm });
  return await userModel.findByIdAndUpdate(id, { fcmToken: fcm }, { new: true });
}

const giveNoteService=async(id,note)=>{
    return await userModel.findOneAndUpdate({ _id: id }, { note: note }, { new: true });
}

const bulkGiveNoteService = async (userIds, note) => {
  return await userModel.updateMany(
    {
      _id: { $in: userIds },
    //   isDeleted: false,
    },
    {
      $set: { note },
    }
  );
};

const giveCreditService = async (id, credit) => {
    return await userModel.findOneAndUpdate({ _id: id }, { digitalWallet: credit }, { new: true });
}


const bulkGiveCreditService = async (userIds, credit) => {
  return await userModel.updateMany(
    {
      _id: { $in: userIds }
    },
    {
      $inc: {
        digitalWallet: credit,
      },
    }
  );
};


module.exports={
    suspendUserService,
    activeUserService,
    giveFlagService,
    giveNoteService,
    giveCreditService,
    fcmTokenService,
    deleteFcmTokenService,
    bulkGiveFlagService,
    bulkGiveNoteService,
    bulkSuspendUserService,
    bulkGiveCreditService,
    bulkActiveUserService,
    bulkActiveUserService,
    togglePushNotificationService,
    getPushNotificationService
}