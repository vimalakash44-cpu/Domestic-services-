const jwt = require("jsonwebtoken");
const JWT_SECRET = "domestic_services_secret";
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please provide a valid Bearer token."
            });
        }
        const token = authHeader.split(" ")[1];
        if (!token || token === "undefined" || token === "null" || token.trim() === "") {
            return res.status(401).json({
                success: false,
                message: "Invalid token format. Token is missing or empty."
            });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
    console.log("JWT ERROR:", error.message);

    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: "Invalid or malformed token. Please login again."
        });
    }
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: "Token expired. Please login again to get a new token."
        });
    }
    return res.status(401).json({
        success: false,
        message: "Authentication failed. Please check your credentials and try again."
    });
}
};
module.exports = authMiddleware;