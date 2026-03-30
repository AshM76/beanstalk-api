const schedule = require("node-schedule");
const BigQuery = require('../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_deals')

function dealsAutoClosed() {
    
    console.log('[Beanstalk] :: Start Background Processes')

    var rule = new schedule.RecurrenceRule();
    rule.hour = 00;
    rule.minute = 10;
    rule.second = 00;
    // rule.minute = new schedule.Range(0, 59, 0);
    // schedule.scheduleJob('0 0 * * *', () => { 
    schedule.scheduleJob(rule, () => { 
        console.log('::Close Expired Deals') 
        BigQuery.autoClosedDeals()
    }) // run everyday at midnight
 }

module.exports = { dealsAutoClosed }