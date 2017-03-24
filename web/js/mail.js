'use strict';


/**
* This is a very simple script, that allows the
* client to update their email subscription status.
*/
var data = {
  // The application data
  address: ''.concat(location.search.replace('?', '')),
  isUnsubscribed: null,
  error: false,
  feedback: '',
};

// The Vue-JS instance with all the data and functions
new Vue({
  el: 'html',
  data: data,
  methods: {
    toggle: function() {
      // Make sure, the data is already loaded
      if (data.isUnsubscribed !== null && data.address !== '') {
        // Determine what to do
        var action = 'unsubscribe';
        if (data.isUnsubscribed) {
          action = 'resubscribe';
        }
        // Set status to be indetermined
        data.isUnsubscribed = null;
        // Make the api call
        var url = '/api/mail/'.concat(action);
        url = url.concat('?address='.concat(encodeURI(data.address)));
        Vue.http.get(url).then(function(res) {
          if (res.json().data) {
            // Status changed
            if (action === 'unsubscribe') {
              data.isUnsubscribed = true;
              data.error = false;
              data.feedback = 'You will no longer recive notifications.';
            } else {
              data.isUnsubscribed = false;
              data.error = false;
              data.feedback = 'You will now recive notifications again.';
            }
          } else {
            // Status did not change (error)
            if (action === 'unsubscribe') {
              data.isUnsubscribed = false;
              data.error = true;
              data.feedback = '';
            } else {
              data.isUnsubscribed = true;
              data.error = true;
              data.feedback = '';
            }
          }
        }, function(){
          // Status did not change (error)
          if (action === 'unsubscribe') {
            data.isUnsubscribed = false;
            data.error = true;
            data.feedback = '';
          } else {
            data.isUnsubscribed = true;
            data.error = true;
            data.feedback = '';
          }
        });
      }
    }
  },
});


// Load the initial data
Vue.http.get('/api/mail/isunsubscribed'.concat('?address='.concat(encodeURI(data.address)))).then(function(res) {
  // Apply the data
  data.isUnsubscribed = !!res.json().data;
}, function(){
  // Error
  data.error = true;
});
