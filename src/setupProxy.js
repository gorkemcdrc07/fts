// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
    app.use(
        "/reel-api",
        createProxyMiddleware({
            target: "https://tms.odaklojistik.com.tr",
            changeOrigin: true,
            secure: true,              // TMS sertifikası geçerliyse true
            logLevel: "debug",
            pathRewrite: { "^/reel-api": "" }, // /reel-api/api/... -> https://tms.../api/...
            onProxyReq(proxyReq) {
                // Bazı servisler origin kontrol edebilir
                proxyReq.setHeader("origin", "https://tms.odaklojistik.com.tr");
            },
        })
    );
};
