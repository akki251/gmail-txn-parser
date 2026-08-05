const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      'Missing credentials.json. Download it from Google Cloud Console ' +
        '(OAuth client, "Desktop app" type) and put it in this folder. See LIVE_SETUP.md.'
    );
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH)).installed;
}

async function authorize() {
  const { client_secret, client_id } = loadCredentials();
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3987');

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    return oAuth2Client;
  }
  return getNewToken(oAuth2Client);
}

function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });

    const server = http
      .createServer(async (req, res) => {
        try {
          const code = new URL(req.url, 'http://localhost:3987').searchParams.get('code');
          if (!code) return; // ignore favicon.ico etc.
          res.end('Authorized — you can close this tab and go back to the terminal.');
          server.close();

          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          console.log('Saved token to', TOKEN_PATH, '— future runs won\'t need to re-auth.');
          resolve(oAuth2Client);
        } catch (err) {
          reject(err);
        }
      })
      .listen(3987, () => {
        console.log('\nOpen this URL in your browser to authorize:\n', authUrl, '\n');
      });
  });
}

module.exports = { authorize };
