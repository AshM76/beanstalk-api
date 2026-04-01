const admin = require("firebase-admin");
const CronJob = require("node-cron");

const session_cronjobs = {};

// Initialize Firebase Admin with environment variables
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    })
  });
}

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

/**
 * Send contest invitation notification
 */
async function sendContestInvite(req, res) {
  try {
    const { userTokens, contestId, contestName, message } = req.body

    if (!userTokens || !Array.isArray(userTokens) || userTokens.length === 0) {
      return res.status(400).json({ error: 'userTokens array is required' })
    }

    const notification = {
      title: `Contest Invitation: ${contestName}`,
      body: message || `You've been invited to join the ${contestName} contest!`,
    }

    const data = {
      type: 'contest_invite',
      contestId: contestId,
      Beanstalk: "Beanstalk Application",
    }

    // Send to multiple tokens
    const promises = userTokens.map(token =>
      admin.messaging().send({
        token,
        notification,
        data,
        android: { priority: "high" },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
          headers: {
            "apns-push-type": "alert",
            "apns-priority": "10",
            "apns-topic": "com.beanstalk.beanstalkapp",
          },
        },
      })
    )

    await Promise.all(promises)

    res.json({ message: `Notifications sent to ${userTokens.length} users` })
  } catch (error) {
    console.error('Contest invite notification error:', error)
    res.status(500).json({ error: 'Failed to send notifications' })
  }
}

/**
 * Send leaderboard update notification
 */
async function sendLeaderboardUpdate(req, res) {
  try {
    const { userTokens, contestName, userRank, message } = req.body

    const notification = {
      title: `Leaderboard Update - ${contestName}`,
      body: message || `You're now ranked #${userRank} in ${contestName}!`,
    }

    const data = {
      type: 'leaderboard_update',
      contestName,
      userRank: userRank.toString(),
      Beanstalk: "Beanstalk Application",
    }

    const promises = userTokens.map(token =>
      admin.messaging().send({
        token,
        notification,
        data,
        android: { priority: "high" },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
          headers: {
            "apns-push-type": "alert",
            "apns-priority": "10",
            "apns-topic": "com.beanstalk.beanstalkapp",
          },
        },
      })
    )

    await Promise.all(promises)

    res.json({ message: `Leaderboard notifications sent to ${userTokens.length} users` })
  } catch (error) {
    console.error('Leaderboard notification error:', error)
    res.status(500).json({ error: 'Failed to send notifications' })
  }
}

/**
 * Send contest winner notification
 */
async function sendContestWinner(req, res) {
  try {
    const { userTokens, contestName, prizeAmount, message } = req.body

    const notification = {
      title: `🏆 Contest Winner - ${contestName}`,
      body: message || `Congratulations! You've won ${contestName} with a prize of $${prizeAmount}!`,
    }

    const data = {
      type: 'contest_winner',
      contestName,
      prizeAmount: prizeAmount.toString(),
      Beanstalk: "Beanstalk Application",
    }

    const promises = userTokens.map(token =>
      admin.messaging().send({
        token,
        notification,
        data,
        android: { priority: "high" },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
          headers: {
            "apns-push-type": "alert",
            "apns-priority": "10",
            "apns-topic": "com.beanstalk.beanstalkapp",
          },
        },
      })
    )

    await Promise.all(promises)

    res.json({ message: `Winner notifications sent to ${userTokens.length} users` })
  } catch (error) {
    console.error('Winner notification error:', error)
    res.status(500).json({ error: 'Failed to send notifications' })
  }
}

module.exports = {
  activeSessionTrack,
  stopSessionTrack,
  sendContestInvite,
  sendLeaderboardUpdate,
  sendContestWinner
}