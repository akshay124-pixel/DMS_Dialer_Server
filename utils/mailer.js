const nodemailer = require("nodemailer");
const path = require("path");
require('dotenv').config();

// Create a test account or replace with real credentials.
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

// Wrap in an async IIFE so we can use await.
async function sendMail(to, subject, text, html) {
 
  const middlePath = path.resolve(__dirname, "..", "..", "mydata", "public", "Promark Techsolutions Pvt Ltd.jpg");


  await transporter.sendMail({
    from: '"Promark Tech Solutions" <salesorderweb@gmail.com>',
    to,
    subject,
    text,
    html,
    attachments: [
     
      {
        filename: "Promark Techsolutions Pvt Ltd.jpg",
        path: middlePath,
        cid: "middle-image"
      },
    
    ]
  });
}

module.exports = { sendMail };