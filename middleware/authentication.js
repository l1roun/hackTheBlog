const jwt = require("jsonwebtoken");
const jwt_secret = "NotSecureSecret"

const authenticate = (req, res, next) => {
    const token = req.cookies.jwt;

    if (!token) {
        res.redirect('/login')
    }

    try {
        const decoded = jwt.verify(token, jwt_secret);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).send('Invalid token.');
    }
};
module.exports = {
    authenticate,
}