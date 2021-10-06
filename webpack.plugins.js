const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const assets = ['assets'];
const assetsPlugins = assets.map(asset => {
  return new CopyWebpackPlugin({
    patterns: [{ from: path.resolve(__dirname, 'src', asset), to: asset }],
  });
});

module.exports = [
  new ForkTsCheckerWebpackPlugin(),
  ...assetsPlugins  
];
