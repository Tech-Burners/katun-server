require("dotenv").config();

// Helper function to encode data into Base64
const encodeData = (data) => {
  return Buffer.from(JSON.stringify(data)).toString('base64');
};

const setSuccessDataAndRedirect = async (res, user, token) => {
  // Encode the token and user data and in fronend use atob() to decode it
  const encodedData = encodeData({ user, token });

  // Construct the redirect URL with encoded data as a query parameter
  const redirectUrl = `${process.env.SUCCESS_URL_WEB}&data=${encodedData}`;

  // Redirect the user to the frontend
  return res.redirect(redirectUrl);
};

// Function to handle errors and send a failure message in the redirect
const setErrorDataAndRedirect = async (res, err, user) => {
  let message = "An error occurred";
  if (err) message = err.message;
  if (!user) message = "Invalid credentials";

  // Encode the error message before passing it in the query string
  return res.redirect(`${process.env.FAILURE_URL_WEB}&message=${encodeURIComponent(message)}`);
};

module.exports = { setSuccessDataAndRedirect, setErrorDataAndRedirect };
