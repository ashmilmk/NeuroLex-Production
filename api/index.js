// Vercel Serverless entry point — re-exports the Express app from backend/
const app = require('../backend/server');
module.exports = app;
