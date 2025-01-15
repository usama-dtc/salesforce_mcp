import jsforce from 'jsforce';

export async function createSalesforceConnection() {
  const conn = new jsforce.Connection({
    loginUrl: process.env.SALESFORCE_INSTANCE_URL || 'https://login.salesforce.com'
  });

  try {
    await conn.login(
      process.env.SALESFORCE_USERNAME!,
      process.env.SALESFORCE_PASSWORD! + process.env.SALESFORCE_TOKEN!
    );
    return conn;
  } catch (error) {
    console.error('Error connecting to Salesforce:', error);
    throw error;
  }
}