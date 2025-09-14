const webpack = require('webpack');

module.exports = {
  devServer: {
    port: 25797,
    host: '0.0.0.0', // 允许外部访问
    allowedHosts: 'all', // 允许所有主机访问
  },
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "buffer": require.resolve("buffer"),
        "stream": require.resolve("stream-browserify"),
        "crypto": require.resolve("crypto-browserify"),
        "net": false,
        "tls": false,
        "fs": false,
        "dns": false,
        "vm": false,
        "pg-native": false,
        "path": require.resolve("path-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "util": require.resolve("util")
      };
      
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
      ];
      
      return webpackConfig;
    },
  },
};