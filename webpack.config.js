var webpack = require('webpack');

var PROD = JSON.parse(process.env.PROD_DEV || false);

module.exports = {
  entry: PROD ? './src/index.jsx' : [
    'webpack-dev-server/client?http://localhost:8080',
    'webpack/hot/only-dev-server',
    './src/index.jsx'
  ],
  module: {
    loaders: [{
      test: /\.jsx?$/,
      exclude: /node_modules/,
      loader: 'react-hot!babel'
    }, {
      test: /\.css$/,
      loader: 'style!css!autoprefixer?browsers=last 2 versions'
    }]
  },
  resolve: {
    extensions: ['', '.js', '.jsx']
  },
  output: {
    path: __dirname + '/dist',
    publicPath: '/',
    filename: PROD ? 'bundle.min.js' : "bundle.js"
  },
  devServer: {
    contentBase: './dist',
    hot: PROD ? true : false
  },
  plugins: PROD ?  [ new webpack.optimize.UglifyJsPlugin({minimize: true}) ] : [ new webpack.HotModuleReplacementPlugin() ]
};
