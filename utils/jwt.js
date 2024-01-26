const jwt = require("jsonwebtoken");
const jwt_secret = "NotSecureSecret"
const createToken = (id) => {
    const token = jwt.sign({ userId: id }, jwt_secret, {
        expiresIn: '30d',
    });
    return token;
};

module.exports = {
    createToken,
};