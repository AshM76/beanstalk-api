var sendNotification = function(data) {
    var headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": "Basic ZDFmYjRlNGQtMDBhNy00NWVmLTlmNGQtMDJhMmY5MjlhZjVk"
    };
    
    var options = {
      host: "onesignal.com",
      port: 443,
      path: "/api/v1/notifications",
      method: "POST",
      headers: headers
    };
    
    var https = require('https');
    var req = https.request(options, function(res) {  
      res.on('data', function(data) {
        console.log("Response:");
        console.log(JSON.parse(data));
      });
    });
    
    req.on('error', function(e) {
      console.log("ERROR:");
      console.log(e);
    });
    
    req.write(JSON.stringify(data));
    req.end();
  };
  
  // var message = { 
  //   app_id: "REPLACE_WITH_ONESIGNAL_APP_ID",
  //   contents: {"en": "English Message"},
  //   included_segments: ["Subscribed Users"]
  // };
  
  // sendNotification(message);

  module.exports = { sendNotification };