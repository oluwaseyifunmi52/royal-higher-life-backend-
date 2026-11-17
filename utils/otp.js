const { randomInt } = require("node:crypto");

const generateOTP = () => randomInt(100000, 1000000).toString();

module.exports = {
    generateOTP,
};
