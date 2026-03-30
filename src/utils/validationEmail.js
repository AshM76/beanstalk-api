var nodemailer = require('nodemailer');
require('dotenv').config()

const { BEANSTALK_ENVIRONMENT_IP,BEANSTALK_HOST,BEANSTALK_ACCOUNT_EMAIL,BEANSTALK_ACCOUNT_PASS } = process.env

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: BEANSTALK_HOST,
  auth: {
      user: BEANSTALK_ACCOUNT_EMAIL,
      pass: BEANSTALK_ACCOUNT_PASS
  },
  from: BEANSTALK_ACCOUNT_EMAIL,
});

function sendEmailValidation(email, userId) {
    const apiAccountValidate = `http://${BEANSTALK_ENVIRONMENT_IP}:8080/api/auth/accountValidate/${userId}`
    const mailOptions = {
      from: BEANSTALK_ACCOUNT_EMAIL,
      to: email,
      subject: 'Beanstalk - Email Verification',
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
       <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <title>Verification Email</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <style type="text/css">
          .verification {
              background-color:#E19A3D;
              -webkit-border-top-left-radius:20px;
              -moz-border-radius-topleft:20px;
              border-top-left-radius:20px;
              -webkit-border-top-right-radius:20px;
              -moz-border-radius-topright:20px;
              border-top-right-radius:20px;
              -webkit-border-bottom-right-radius:20px;
              -moz-border-radius-bottomright:20px;
              border-bottom-right-radius:20px;
              -webkit-border-bottom-left-radius:20px;
              -moz-border-radius-bottomleft:20px;
              border-bottom-left-radius:20px;
          text-indent:0;
              display:inline-block;
              color:#ffffff;
              font-family:arial;
              font-size:15px;
              font-weight:bold;
              font-style:normal;
          height:50px;
              line-height:50px;
          width:140px;
              text-decoration:none;
              text-align:center;
          }.verification:active {
              position:relative;
              top:1px;
          }</style>
      </head>
      <body style="margin: 0; padding: 0;">
      <table align="center" cellpadding="0" cellspacing="0" width="600">
       <tr>
      <td style="padding: 20px 0 20px 30px;" bgcolor="#FAFAFA">
       <img src="https://drive.google.com/uc?id=1wxuLtu-qiSk-3gXEJDj0dK4b6Ov6FngR" height="120" style="display: block;" /> 
      </td>
       </tr>
       <tr>
      <td bgcolor="#FAFAFA">
      <table cellpadding="0" cellspacing="0" width="100%">
       <tr>
      <td style="padding: 10px 0 20px 30px; font-family: Arial, sans-serif; font-size: 25px; font-weight: bold;">
      Welcome
      </td>
       </tr>
       <tr>
          <td style="padding: 10px 0 20px 30px; font-family: Arial, sans-serif; font-size: 15px;">
      Thanks for joining Beanstalk The CannaCollective!
      </td>
        </tr>
       <tr>
          <td style="padding: 10px 0 30px 30px; font-family: Arial, sans-serif; font-size: 15px;">
       Please confirm your email by clicking the button below.
      </td>
       </tr>
       <tr>
      <td style="padding: 20px 0 50px 30px;">
      <a href="${apiAccountValidate}" class="verification">Confirm Email</a>
      </td>
       </tr>
      </table>
       </tr>
       <tr>
      <td align="center" bgcolor="#FFFFFF" style="padding: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 12px; font-weight: bold;">
          © 2022 Beanstalk, Inc. All Rights Reserved
      </td>
       </tr>
      </table>
      </body>
      </html>`
    };
  
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
          console.log(error);
      } else {
          console.log(':: Email sent: ' + info.response);
      }
    });
  
  }

  function sendEmailCodeRestorePassword(email, codeRestorePassword) {
    const mailOptions = {
        from: BEANSTALK_ACCOUNT_EMAIL,
        to: email,
        subject: 'Beanstalk - Password Reset Code',
        html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
         <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Verification Email</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        </head>
        <body style="margin: 0; padding: 0;">
        <table align="center" cellpadding="0" cellspacing="0" width="600">
         <tr>
        <td style="padding: 20px 0 20px 30px;" bgcolor="#FAFAFA">
         <img src="https://drive.google.com/uc?id=1wxuLtu-qiSk-3gXEJDj0dK4b6Ov6FngR" height="120" style="display: block;" /> 
        </td>
         </tr>
         <tr>
        <td bgcolor="#FAFAFA">
        <table cellpadding="0" cellspacing="0" width="100%">
         <tr>
        <td style="padding: 10px 0 20px 30px; font-family: Arial, sans-serif; font-size: 25px; font-weight: bold;">
        Password reset code
        </td>
         </tr>
         <tr>
            <td style="padding: 10px 0 20px 30px; font-family: Arial, sans-serif; font-size: 15px;">
         Please use this code to reset the password fot the Beanstalk account: ${email}
        </td>
          </tr>
         <tr>
            <td style="padding: 10px 0 30px 30px; font-family: Arial, sans-serif; font-size: 15px;">
         Here is your code: ${codeRestorePassword}
        </td>
         </tr>
         <tr>
        <td align="center" bgcolor="#FFFFFF" style="padding: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 12px; font-weight: bold;">
            © 2022 Beanstalk, Inc. All Rights Reserved
        </td>
         </tr>
        </table>
        </body>
        </html>`
    };
  
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
          console.log(error);
      } else {
          console.log(':: Email sent: ' + info.response);
      }
    });
  
  }

module.exports = { sendEmailValidation, sendEmailCodeRestorePassword }
