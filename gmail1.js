const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {google} = require('googleapis');
const PDFDocument = require ('pdfkit');
const base64url = require('base64-url')
const base64 = require('base64topdf')
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const TOKEN_PATH = path.resolve('credentials', 'gmail-nodejs.json');

var gmail = google.gmail('v1');
// var ts = 'dGVzdCBjb250ZW50DQotLSANCipCZXN0IHJlZ2FyZHMsKg0KKkFraGlsIEt1cmlhbioNCg==';
// var b = new Buffer(ts, 'base64');
// var tx = b.toString();
// base64topdf.base64Decode('dGVzdCBjb250ZW50DQotLSANCipCZXN0IHJlZ2FyZHMsKg0KKkFraGlsIEt1cmlhbioNCg==', 'test.pdf');



fs.readFile('client_secret.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Gmail API.
  //authorize(JSON.parse(content), listLabels);
  authorize(JSON.parse(content), getRecentEmail);

});
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function listLabels(auth) {

  gmail.users.labels.list({
    userId: 'me',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const labels = res.data.labels;
    if (labels.length) {
      console.log('Labels:');
      labels.forEach((label) => {
        console.log(`- ${label.name}`);
      });
    } else {
      console.log('No labels found.');
    }
  });
}


function getRecentEmail(auth){

    //  sunil, below code commented and was working for particular message id


  //  gmail.users.messages.list({ auth: auth, userId: 'me', maxResults: 10, }, function (err, response) {
      //  if (err) {
       //   console.log('The API returned an error: ' + err);
       //   return;
       // }
    //    for (i = 0; i < response.data.messages.length; ++i) {
    //      // Get the message id which we will need to retreive tha actual message next.
    //      var message_id = response['data']['messages'][i]['id'];
    //      ReadEmailTextAndAttachment(auth, message_id, false);
    //    }
    //   });
      ReadEmailTextAndAttachment(auth, 2, false);
}

function ReadEmailTextAndAttachment(auth, message_id, markread){
  var text1 = ''; 
  var message_id= '166f02677ad799ea'; //'166f83df64b48635'
// 166f0609a8d34733
// 166f05ea62df3b0c
// 166f02a11c0990c0
// 166f02677ad799ea
  gmail.users.messages.get({ auth: auth, userId: 'me', id:message_id,format:'full' },
    function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
    debugger;
    var emailConfig=response['data'].payload.parts;
        for(var i = 0; i < emailConfig.length; i++){
    if(emailConfig[i].mimeType=="application/pdf"){
        var pdf_attachmentId=emailConfig[i].body.attachmentId;
        if(pdf_attachmentId!==null){
            GetAttachmentDataToPdf(auth,message_id,pdf_attachmentId);
        }
    }else{
      // var parts=emailConfig[i].parts;
      var parts=emailConfig;
        for(var j=0;j<parts.length;j++){
            if(parts[j].mimeType=="text/plain"){
                GetEmailBodymessageToPdf(parts[j].body.data); 
            }
        }
    }
}
    });


}

function GetAttachmentDataToPdf(auth,message_id,pdf_attachmentId){
    gmail.users.messages.attachments.get({ auth: auth, userId: 'me', id:pdf_attachmentId,messageId:message_id },
    function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
      var pdfData=response['data'].data;
     
      d=dat; 
      var t=joinBase64Strings(d,pdfData);
      base64.base64Decode(pdfData, 'attachedPdfdata.pdf');
      base64.base64Decode(t, 'combined.pdf');
    });
}


function GetEmailBodymessageToPdf(message){
  dat=message
  base64.base64Decode(message, 'emailBodyMessage.pdf');
}

function joinBase64Strings(base64Str1, base64Str2) {
  const bothData = Buffer.from(base64Str1, 'base64').toString('binary') 
        + Buffer.from(base64Str2, 'base64').toString('binary');
  const joinedBase64Result = Buffer.from(bothData.toString(), 'binary').toString('base64');
  return joinedBase64Result;
}