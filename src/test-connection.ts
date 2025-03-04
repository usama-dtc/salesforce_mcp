import { createSalesforceConnection } from './utils/connection.js';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function testConnection() {
  try {
    console.log('Testing Salesforce connection...');
    
    // Try to establish connection
    const conn = await createSalesforceConnection();
    console.log('✅ Successfully connected to Salesforce!');
    
    // Get some basic info about the connection
    console.log('\nConnection Details:');
    console.log('Instance URL:', conn.instanceUrl);
    console.log('Access Token:', conn.accessToken ? '✅ Received' : '❌ Missing');
    console.log('Auth Method:', process.env.SALESFORCE_CONSUMER_KEY ? 'OAuth2' : 'Username/Password');
    
    // Try to query a simple object to verify API access
    console.log('\nTesting API access...');
    const result = await conn.query('SELECT Id, Name FROM Account LIMIT 1');
    console.log('✅ Successfully queried Account object!');
    console.log(`Found ${result.totalSize} account(s)`);
    
    if (result.records.length > 0) {
      console.log('\nSample Account:');
      console.log('ID:', result.records[0].Id);
      console.log('Name:', result.records[0].Name);
    }

  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testConnection(); 