const fs = require('fs');
const path = require('path');
const base64topdf = require('base64topdf');
const readline = require('readline');
const { google } = require('googleapis');
// const pdfkit = require('pdfkit');
const hpdf = require('html-pdf');
const pdfmerge = require('pdf-merge');
var schedule = require('node-schedule');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const TOKEN_PATH = path.resolve('credentials', 'gmail-nodejs.json');

var gmail = google.gmail('v1');

var messageQ = [{ m: '', f: [] }];

var tmpf = 'temp/';
var outf = 'output/';

fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  authorize(JSON.parse(content), getRecentEmail);
});


function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];

  var OAuth2 = google.auth.OAuth2;

  var oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(path.resolve(TOKEN_PATH), function (err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter the code from that page here: ', function (code) {
    rl.close();
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

function getRecentEmail(auth) {
  var j = schedule.scheduleJob('*/1 * * * *', function (auth) {
    console.log('Running gmail query: ' + new Date().toString());
    // Only get the recent email - 'maxResults' parameter
    gmail.users.messages.list({ auth: auth, userId: 'me', maxResults: 10, }, function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
      for (i = 0; i < response.data.messages.length; ++i) {
        // Get the message id which we will need to retreive tha actual message next.
        var message_id = response['data']['messages'][i]['id'];
        console.log(message_id);
        ReadEmailTextAndAttachment(auth, message_id, false);
      }
      // mergeFiles();
    });

  }.bind(null, auth));
}

function AddToList(messageid, filename) {
  const q = messageQ.find(f => f.m === messageid);
  if (q) {
    q.f.push(tmpf + filename);
  } else {
    messageQ.push({ m: messageid, f: [tmpf + filename] });
  }
}

function ReadEmailTextAndAttachment(auth, message_id, markread) {
  // Retreive the actual message using the message id
  gmail.users.messages.get({ auth: auth, userId: 'me', id: message_id }, // format: 'raw'
    function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
      var message_raw = ''
      if (response.data.raw) {
        message_raw = response.data.raw;
      } else {
        for (i = 0; i < response.data.payload.parts.length; ++i) {
          var part = response.data.payload.parts[i];
          var isAttch = part.body.attachmentId != null;
          if (!isAttch) {
            if (part.body.data) {
              buff = Buffer.from(part.body.data, 'base64');
              text = buff.toString('utf-8');
              message_raw += text + '<hr>';
            } else {
              if (part.parts && part.parts.length > 0) {
                for (j = 0; j < part.parts.length; ++j) {
                  var p2 = part.parts[j];
                  if (p2.body.data) {
                    buff = Buffer.from(p2.body.data, 'base64');
                    text = buff.toString('utf-8');
                    message_raw += text;
                  }
                }
              }
            }
          }
          else {
            // handle attachment
            gmail.users.messages.attachments.get({ auth: this.gauth, userId: 'me', messageId: this.gmid, id: part.body.attachmentId },
              function (err, response) {
                AddToList(this.aMsgId, this.aMsgId + '_' + this.aFilename);
                base64topdf.base64Decode(response.data.data, tmpf + this.aMsgId + '_' + this.aFilename);
              }.bind({ aFilename: part.filename, aMsgId: this.gmid }));
          }
        }
      }
      if (message_raw) {
        data = message_raw;
        buff = Buffer.from(data, 'base64')
        text = buff.toString();
        var options = { format: 'Letter' };

        AddToList(this.gmid, this.gmid + '.pdf');
        hpdf.create(message_raw, options).toFile(tmpf + this.gmid + '.pdf', function (err, res) {
          if (err) return console.log(err);
          mergeFilesToOutput(res.filename);
        });
        if (markread) {
          // UNREAD
          MarkEmailAsRead(auth, message_id);
        }
      }
    }.bind({ gauth: auth, gmid: message_id }));
}

function MarkEmailAsRead(auth, message_id) {
  gmail.users.messages.modify({ auth: auth, userId: 'me', id: message_id, labelsToRemove: 'UNREAD' },
    function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
    });
}

function mergeFilesToOutput(fn) {
  var start = fn.lastIndexOf('\\');
  var end = fn.indexOf('.pdf');
  var msid = fn.substring(start + 1, end)
  const fls = messageQ.find(f => f.m === msid);
  if (fls.f.length > 1) {
    pdfmerge(fls.f, { output: outf + msid + '.pdf' })
      .then((buffer) => {
      });
  } else if (fls.f.length === 1) {
    moveFile(fn, outf + msid + '.pdf', (err) => {
      if (err) {
        console.log(err);
      }
    })
  }
  fls.f = [];
}

function moveFile(oldPath, newPath, callback) {
  fs.rename(oldPath, newPath, function (err) {
    if (err) {
      if (err.code === 'EXDEV') {
        copy();
      } else {
        callback(err);
      }
      return;
    }
    callback();
  });

  function copy() {
    var readStream = fs.createReadStream(oldPath);
    var writeStream = fs.createWriteStream(newPath);

    readStream.on('error', callback);
    writeStream.on('error', callback);

    readStream.on('close', function () {
      fs.unlink(oldPath, callback);
    });

    readStream.pipe(writeStream);
  }
}

