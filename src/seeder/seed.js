const adminModel = require("../modules/Admin/admin.model");
const User = require("../modules/User/user.model");

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

const seedAdmin = async () => {
  try {
    const superAdminExists = await adminModel.findOne({
      isSupperAdmin: true,
    });

    if (superAdminExists) {
      return;
    }
    const adminUser = await User.create({
      fullName: "Admin",
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: "admin",
      isVerified: true
    });

    await adminModel.create({
      user: adminUser._id,
      role: "admin",
      isSupperAdmin: true
    });

    console.log("✅ Super Admin created successfully.");
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  }
};


module.exports = {
  seedAdmin
}

