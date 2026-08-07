class ApiResponse {
    constructor(statusCode, message, data = null) {
        this.success = statusCode >= 200 && statusCode < 300;
        this.message = message;
        this.data = data;
        this.statusCode = statusCode;
    }
}

module.exports = ApiResponse;
