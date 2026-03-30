const Notifications = require('../../../OneSignal/onesignal.connection')
const BigQuery = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_deals')
const sanitize = require('../../../utils/string_sanitize')
// const CronJob = require("node-cron");
// const deals_cronjobs = {};

const Schedule = require("node-schedule");

//WEB: Deal List
async function loadDealsByDispensaryId(req, res) {
  console.log(':: GET')
  console.log(':: WEB/loadDealsByDispensaryId')
  console.log(`:: dispensaryid: ${req.params.dispensaryid}`)

  let dispensaryid = req.params.dispensaryid

  const result = await BigQuery.loadDealListByDispensaryId(dispensaryid);
  if (result['error']) {
    return res.status(404).send({ error: result['error'], message: result['message'] })
  } else {
    return res.status(200).send({
      data: result['data'],
      error: result['error'],
      message: result['message']
    })
  }
}

//WEB: Deal Detail
async function loadDealDetailById(req, res) {
  console.log(':: GET')
  console.log(':: WEB/loadDealDetailById')
  console.log(`:: dealid: ${req.params.dealid}`)

  let dealid = req.params.dealid;

  const result = await BigQuery.loadDealDetailById(dealid);
  if (result['error']) {
    return res.status(404).send({ error: result['error'], message: result['message'] })
  } else {
    return res.status(200).send({
      data: result['data'],
      error: result['error'],
      message: result['message']
    })
  }
}

function setPushNotification({ dealId: _dealId, title: _title, typeOfDeal: _typeOfDeal, amount: _amount, offer: _offer, date: _date, timeZone: _timeZone }) {
  // SET PUSH DEAL MESSAGE
  var message = {
    app_id: "REPLACE_WITH_ONESIGNAL_APP_ID",
    included_segments: ["Subscribed Users"],
    headings: { "en": "Deals & Offers" },
    subtitle: { "en": _title },
    contents: { "en": messageNotification(_typeOfDeal, _amount, _offer) },
    data: {
      deal_id: _dealId
    }
  };

  // var dateNotificationDeal = new Date('2022-08-06T06:00:00.000Z');
  //   console.log('::>>>>>> STRING');
  //   console.log(dateNotificationDeal.toString());

  //   console.log(':::>>>>>> UTC');
  //   console.log('::: Date: ' + dateNotificationDeal.toUTCString());

  //   console.log(':::>>>>>> TIMEZONE');
  //   console.log('::: PACIFIC: ' + dateNotificationDeal.toLocaleString("en-US",{timeZone:"America/Los_Angeles"}));
  //   console.log('::: CENTRAL: ' + dateNotificationDeal.toLocaleString("en-US",{timeZone:"America/Chicago"}));
  //   console.log('::: EASTERN: ' + dateNotificationDeal.toLocaleString("en-US",{timeZone:"America/New_York"}));

  // SET PUSH DEAL DATE
  var dateNotification = new Date(_date);
  console.log(':: Set Push Notification Date:');
  console.log(dateNotification.toLocaleString("en-US", { timeZone: _timeZone }));

  var delivery = Schedule.scheduleJob(dateNotification, function (time) {
    console.log('::: Delivery Scheduled Delivery :::');
    console.log('::: Date: ' + time);
    Notifications.sendNotification(message);
  });

  // delivery.cancel();
}

//WEB: Deal Create
async function createDeal(req, res) {
  console.log(':: POST')
  console.log(':: WEB/SaveDeal')
  console.log(req.body)

  let deal = req.body

  deal.deal_title = sanitize.specialChars(deal.deal_title)
  deal.deal_description = sanitize.specialChars(deal.deal_description)
  deal.deal_offer = sanitize.specialChars(deal.deal_offer)
  deal.deal_typeOfProduct = sanitize.specialChars(deal.deal_typeOfProduct)
  deal.deal_brandOfProduct = sanitize.specialChars(deal.deal_brandOfProduct)
  deal.deal_url = sanitize.specialChars(deal.deal_url)
  
  deal.deal_dispensary_name = sanitize.specialChars(deal.deal_dispensary_name)

  const result = await BigQuery.createDeal(deal)
  console.log(result);
  if (result['error']) {
    return res.status(404).send({ error: result['error'], message: result['message'] })
  } else {


    if (req.body.deal_status == 'published') {
      // Delivery Schedule PUSH NOTIFICATION MESSAGE
      setPushNotification({
        //notification
        dealId: result['data']['deal_id'],
        title: deal.deal_title,
        typeOfDeal: deal.deal_typeOfDeal,
        amount: deal.deal_amount,
        offer: deal.deal_offer,
        //date
        date: deal.deal_publish_pushDate,
        timeZone: deal.deal_publish_timeZone,
      });
    }

    return res.status(200).send({
      data: result['data'],
      error: result['error'],
      message: result['message']
    })


  }
}

//WEB: Deal Update
async function updateDeal(req, res) {
  console.log(':: PUT')
  console.log(':: WEB/UpdateDeal')
  console.log(`:: dealid: ${req.params.dealid}`)
  console.log(req.body)

  let dealid = req.params.dealid
  let update = req.body

  update.deal_title = sanitize.specialChars(update.deal_title)
  update.deal_description = sanitize.specialChars(update.deal_description)
  update.deal_offer = sanitize.specialChars(update.deal_offer)
  update.deal_typeOfProduct = sanitize.specialChars(update.deal_typeOfProduct)
  update.deal_brandOfProduct = sanitize.specialChars(update.deal_brandOfProduct)
  update.deal_url = sanitize.specialChars(update.deal_url)

  update.deal_dispensary_name = sanitize.specialChars(update.deal_dispensary_name)

  const result = await BigQuery.updateDeal(dealid, update)
  console.log(result);
  if (result['error']) {
    return res.status(404).send({ error: result['error'], message: result['message'] })
  } else {

    if (req.body.deal_status == 'published') {
      // Delivery Schedule PUSH NOTIFICATION MESSAGE
      setPushNotification({
        //notification
        dealId: result['data']['deal']['deal_id'],
        title: result['data']['deal']['deal_title'],
        typeOfDeal: result['data']['deal']['deal_typeOfDeal'],
        amount: result['data']['deal']['deal_amount'],
        offer: result['data']['deal']['deal_offer'],
        //date
        date: result['data']['deal']['deal_publish_pushDate']['value'],
        timeZone: result['data']['deal']['deal_publish_timeZone'],
      });
    }

    return res.status(200).send({
      data: result['data'],
      error: result['error'],
      message: result['message']
    })
  }
}

function messageNotification(typeOfDeal, amount, offer) {
  switch (typeOfDeal) {
    case 'discount':
      var message = typeOfDeal[0].toUpperCase() + typeOfDeal.slice(1) + ' ' + amount + ' %' + ' Off';
      return message;
    case 'dollar':
      var message = typeOfDeal[0].toUpperCase() + typeOfDeal.slice(1) + ' ' + amount + ' $' + ' Off';
      return message;
    case 'bogo':
      var message = 'Buy One Get One For: ' + amount + ' $';
      return message;
    case 'b2g1':
      var message = 'Buy Two Get One For: ' + amount + ' $';
      return message;
    case 'offer':
      var message = offer + ' For: ' + amount + ' $';
      return message;
  }

  return '';

}

async function loadDeals(req, res) {
  console.log(':: GET')
  console.log(':: MOBILE/loadDealList')
  console.log(`:: userid: ${req.params.userid}`)

  let userid = req.params.userid

  const result = await BigQuery.loadDealList(userid);
  if (result['error']) {
    return res.status(404).send({ error: result['error'], message: result['message'] })
  } else {
    return res.status(200).send({
      data: result['data'],
      error: result['error'],
      message: result['message']
    })
  }
}

async function loadDealById(req, res) {
  console.log(':: GET')
  console.log(':: MOBILE/loadDealById')
  console.log(`:: dealid: ${req.params.dealid}`)

  let dealid = req.params.dealid;

  const result = await BigQuery.loadDealId(dealid);
  if (result['error']) {
    return res.status(404).send({ error: result['error'], message: result['message'] })
  } else {
    return res.status(200).send({
      data: result['data'],
      error: result['error'],
      message: result['message']
    })
  }
}

module.exports = { loadDealsByDispensaryId, loadDealDetailById, createDeal, updateDeal, loadDeals, loadDealById }