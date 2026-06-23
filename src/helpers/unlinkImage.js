const fs = require("fs");
const path = require("path");

function unlinkImage(imgPath) {
  var imagePath;
  if (imgPath.startsWith('public')) {
    imagePath = imgPath;
  }
  else if (imgPath.startsWith('\\public')) {
    imagePath = imgPath.slice(1);
  }
  else {
    imagePath = path.join("public/", imgPath);
  }

  console.log("File Path ---> ", imgPath, imagePath);
  const fileExists = fs.existsSync(imagePath);
  if (!fileExists) {
    console.log(`File ${imagePath} does not exist`);
    return;
  }

  fs.unlink(imagePath, (err) => {
    if (err) {
      console.error(`Error deleting the file ${imagePath}:`, err);
    } else {
      console.log(`File ${imagePath} deleted successfully`);
    }
  });
}

module.exports = unlinkImage;

