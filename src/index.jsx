import React from 'react';
import ReactDOM from 'react-dom';

import {createStore} from 'redux';
import reducer from './reducer';
import {Provider} from 'react-redux';
import App from './containers/App';

const store = createStore(reducer);

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('app')
);
