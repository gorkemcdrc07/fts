// src/setupProxy.js (sende zaten böyle)
const { createProxyMiddleware } = require("http-proxy-middleware");
module.exports = function (app) {
    app.use(
        "/reel-api",
        createProxyMiddleware({
            target: "https://tms.odaklojistik.com.tr",
            changeOrigin: true,
            secure: true,
            logLevel: "debug",
            pathRewrite: { "^/reel-api": "" }, // /reel-api/api/... -> https://tms.../api/...
            onProxyReq(proxyReq) { proxyReq.setHeader("origin", "https://tms.odaklojistik.com.tr"); },
        })
    );
};
