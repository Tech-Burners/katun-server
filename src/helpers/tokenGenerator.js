const jwt = require('jsonwebtoken');

const tokenGenerator = async (user, admin) => {

  const payload = {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    image: user.image, role: user.role,
    isLoginToken: user.isLoginToken ? user.isLoginToken : false
  }
  if (admin && admin !== null && admin !== 'null') {
    payload.categoryPermissions = admin.categoryPermissions,
    payload.isSupperAdmin = admin.isSupperAdmin,
    payload.parent = admin.parent
  }
  return await jwt.sign(payload, process.env.JWT_ACCESS_TOKEN, {
    expiresIn: '1y',
  });
}



const resetTokenGenerator = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      purpose: "reset-password"
    },
    process.env.JWT_ACCESS_TOKEN,
    {
      expiresIn: "10m"
    }
  );
};


module.exports = { tokenGenerator, resetTokenGenerator };