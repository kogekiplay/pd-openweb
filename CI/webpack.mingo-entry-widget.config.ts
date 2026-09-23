const webpack = require('webpack');
const path = require('path');
const { EsbuildPlugin } = require('esbuild-loader');
const MomentLocalesPlugin = require('moment-locales-webpack-plugin');
const webpackConfig = require('./webpack.config.ts');
const { getWebpackCacheDirectory, getWebpackCacheName } = require('./webpackCache.ts');

const config = webpackConfig();
const ROOT_PATH = path.join(__dirname, '..');
const MDHOME_MINGO_ENTRY_WIDGET_PATH = path.resolve(ROOT_PATH, '../MDHome/public/mingo-entry-widget');

module.exports = {
  resolve: config.resolve,
  plugins: [
    new webpack.DefinePlugin({
      isBuildFunction: false,
    }),
    new MomentLocalesPlugin({
      localesToKeep: ['es-us', 'zh-cn', 'zh-tw', 'ja', 'th', 'ms'],
    }),
  ],
  entry: path.join(__dirname, '../src/pages/embed/mingoEntry/widgetEntry.ts'),
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.less$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                javascriptEnabled: true,
              },
            },
          },
        ],
      },
      {
        test: /\.(woff2|gif|jpg|png|svg|mp3|woff|eot|ttf)(\?[^?]*)?$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 20000,
          },
        },
        generator: {
          filename: 'static/[name].[hash][ext]',
        },
      },
      {
        test: /\.[jt]sx?$/,
        exclude: [/node_modules/],
        use: ['babel-loader'],
      },
      {
        test: /\.html?$/,
        exclude: [/node_modules/],
        use: 'raw-loader',
      },
      {
        test: /\.m?js$/,
        include: /node_modules\/(@ctrl\/tinycolor)/,
        use: {
          loader: 'babel-loader',
          options: {
            // 目标与 .babelrc、CI/webpack.config.ts 保持一致，依据见后者那条注释
            presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
          },
        },
      },
    ],
  },
  cache: {
    type: 'filesystem',
    name: getWebpackCacheName(ROOT_PATH, ['production-mingo-entry-widget']),
    cacheDirectory: getWebpackCacheDirectory(ROOT_PATH),
    buildDependencies: {
      config: [
        __filename,
        path.resolve(ROOT_PATH, 'CI/webpack.config.ts'),
        path.resolve(ROOT_PATH, 'CI/webpackCache.ts'),
        path.resolve(ROOT_PATH, '.babelrc'),
        path.resolve(ROOT_PATH, 'package.json'),
        path.resolve(ROOT_PATH, 'bun.lock'),
      ],
    },
  },
  mode: 'production',
  output: {
    filename: 'mingo-entry-widget.js',
    chunkFilename: '[name].[contenthash].chunk.js',
    path: MDHOME_MINGO_ENTRY_WIDGET_PATH,
    publicPath: 'auto',
    library: 'MingoEntry',
    libraryTarget: 'var',
  },
  optimization: {
    minimize: true,
    minimizer: [
      new EsbuildPlugin({
        target: 'chrome58',
        minify: true,
        legalComments: 'none',
      }),
    ],
    runtimeChunk: false,
    splitChunks: false,
  },
  devtool: false,
  performance: false,
};
