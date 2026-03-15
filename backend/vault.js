/**
 * vault.js
 * 
 * Simulated Tokenizer Vault Middleware (e.g. VGS, Skyflow).
 * In a true production system, this middleware intercepts the incoming request
 * and swaps any Real PII (Emails, Names, Phone Numbers) with an `anonymousId` token
 * BEFORE it reaches the core API logic, ensuring the DB and LLMs remain out of PCI/GDPR scope.
 */

const crypto = require('crypto');

// Simulated secure in-memory vault mapping
// { "real_email@example.com": "anon_hash_12345" }
const piiVault = new Map();

function tokenizePIIMiddleware(req, res, next) {
   // Suppose the frontend passes a raw user email in the session
   if (req.body && req.body.email) {
      const email = req.body.email.toLowerCase();
      
      // Look up or create token
      let anonymousToken = piiVault.get(email);
      if (!anonymousToken) {
         // Generate a secure HMAC one-way proxy using a server-side salt
         const vaultSalt = process.env.VAULT_SECRET || 'default-insecure-salt-12345';
         anonymousToken = 'vault_' + crypto.createHmac('sha256', vaultSalt).update(email).digest('hex').substring(0, 16);
         piiVault.set(email, anonymousToken);
      }
      
      // 1. Strip the PII from the request
      delete req.body.email;
      delete req.body.name;
      
      // 2. Inject the Tokenized ID for the rest of the app to use
      req.body.anonymousId = anonymousToken;
   }
   
   next();
}

module.exports = { tokenizePIIMiddleware };
