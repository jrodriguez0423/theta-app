const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync('./AuthKey_2UZ6JQ8RK6.p8'); // path to the .p8 file
const keyId = '2UZ6JQ8RK6';  // your Key ID
const teamId = 'NU7J7RLG4M'; // your Team ID

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '1h',
  issuer: teamId,
  header: {
    kid: keyId
  }
});

console.log(token);
