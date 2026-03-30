const admin = require("firebase-admin");
const CronJob = require("node-cron");

const session_cronjobs = {};

var serviceAccount = require("./beanstalk-app-39e29-firebase-adminsdk-6kcyx-21988adc22.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

function activeSessionTrack(req, res) {
  console.log('::')
  console.log(':: Start Session Track')
  console.log(req.body)

  const tracking = req.body.tracking
  const timers = req.body.timer

  const message = {
    token: tracking,//"",
    data: {
      Beanstalk: "Beanstalk Application",
    },
    notification: {
      title: "How do you feel?",
      body: "Please visit your Beanstalk session in progress to update how you feel.",
    },
    // Set Android priority to "high"
    android: {
      priority: "high",
    },
    // Add APNS (Apple) config
    apns: {
      payload: {
        aps: {
          sound: 'default',
          contentAvailable: true,
        },
      },
      headers: {
        "apns-push-type": "alert",
        "apns-priority": "5", // Must be `5` when `contentAvailable` is set to true.
        "apns-topic": "com.beanstalk.beanstalkapp", // bundle identifier
      },
    },
  };

  var sessionTime = ""+ timers + " * * * *"
  console.log(sessionTime)
  var sessionTrack = CronJob.schedule(sessionTime, function() {
    console.log('runnig a task every '+ timers +' minute');
    console.log('>> Track Notification:')
    admin.messaging().send(message)
      .then((response) => {
        console.log('Successfully sent message:', response);
      })
      .catch((error) => {
        console.log('Error sending message:', error);
        sessionTrack.stop();
      });
  })
  sessionTrack.start();

  session_cronjobs[tracking] = sessionTrack;
  
  return res.status(200).send({
    message: 'Start Session Track',
    timer: timers
  })

}



function stopSessionTrack(req, res) {
  console.log('::')
  console.log(':: Stop Session Track')
 
  const tracking = req.body.tracking

  let my_session = session_cronjobs[tracking];
  console.log(my_session);
  
  if (my_session != null) {
    my_session.stop();
  }

  return res.status(200).send({
    message: 'Stop Session Track',
  })
}

module.exports = {
  activeSessionTrack,
  stopSessionTrack
}