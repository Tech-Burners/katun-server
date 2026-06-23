
const generate4DigitPin = () => {
  return Math.floor(1000 + Math.random() * 9000);
};

module.exports = generate4DigitPin;