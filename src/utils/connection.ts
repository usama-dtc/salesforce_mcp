import jsforce from 'jsforce';

export async function createSalesforceConnection() {
  const loginUrl = process.env.SALESFORCE_INSTANCE_URL || 'https://login.salesforce.com';

  // Check which authentication method to use
  const useOAuth = process.env.SALESFORCE_CONSUMER_KEY && process.env.SALESFORCE_CONSUMER_SECRET;
  
  try {
    if (useOAuth) {
      // OAuth2 authentication with consumer key and secret
      const conn = new jsforce.Connection({
        oauth2: {
          loginUrl,
          clientId: process.env.SALESFORCE_CONSUMER_KEY!,
          clientSecret: process.env.SALESFORCE_CONSUMER_SECRET!
        }
      });

      // For OAuth2, we still need username and password for JWT bearer flow
      if (!process.env.SALESFORCE_USERNAME || !process.env.SALESFORCE_PASSWORD) {
        throw new Error('Username and password are required even when using OAuth2');
      }

      await conn.login(
        process.env.SALESFORCE_USERNAME!,
        process.env.SALESFORCE_PASSWORD!
      );
      
      return conn;
    } else {
      // Username/password authentication with security token
      if (!process.env.SALESFORCE_USERNAME || !process.env.SALESFORCE_PASSWORD || !process.env.SALESFORCE_TOKEN) {
        throw new Error('Username, password, and security token are required for password authentication');
      }

      const conn = new jsforce.Connection({
        loginUrl
      });

      await conn.login(
        process.env.SALESFORCE_USERNAME!,
        process.env.SALESFORCE_PASSWORD! + process.env.SALESFORCE_TOKEN!
      );

      return conn;
    }
  } catch (error) {
    console.error('Error connecting to Salesforce:', error);
    throw error;
  }
}