var webpack = require('webpack');
var path = require('path');
const nodeExternals = require('webpack-node-externals');

const TerserPlugin = require('terser-webpack-plugin');

const mode = process.env.MODE || "none";
let output = {
  clean: true,
  compareBeforeEmit: false,
  filename: '[name].js',
  path: __dirname + '/dist/lambda/',
  library: '[name]'.split('/')[-1],
  libraryTarget: 'commonjs2',
}
if(mode === 'production'){
  //todo specific changes for prod but wire the outputs to the upload assets in cdk
}
module.exports = {
  mode,
  target: 'node',
  entry: {
    "stack-event-processor/stack-event-processor": __dirname + '/lambda/stack-event-processor.ts',
    "failed-message-aggregator/failed-message-aggregator": __dirname + '/lambda/failed-message-aggregator.ts',
    "log-dlq-message/log-dlq-message": __dirname + '/lambda/log-dlq-message.ts',
  },
  stats: 'normal',
  output,
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "ts-loader" }
    ]
  },
  devtool: "source-map",
  externalsPresets: { node: true },
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
    ],
  },
  externals: [
    nodeExternals({
      //todo for production use only
      //allowlist: [/@aws-lambda-powertools/, /@middy/, /aws-xray-sdk-core/]
    }),
     'aws-sdk',
     //nice for development iterations only using layers
     '@middy/core',
     '@aws-lambda-powertools/logger',
     '@aws-lambda-powertools/tracer',
     '@aws-lambda-powertools/commons',
     'aws-xray-sdk-core',
     /^\/opt\//
  ]
}