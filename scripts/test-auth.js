#!/usr/bin/env node

/**
 * Authentication System Test Script
 * Tests all authentication-related functionality
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let authToken = '';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testLogin() {
  log('blue', '\n🔐 Testing Login...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'Admin@123123'
    });

    if (response.data.success) {
      authToken = response.data.data.token;
      log('green', '✅ Login successful');
      log('blue', `   Token: ${authToken.substring(0, 20)}...`);
      log('blue', `   User: ${response.data.data.user.fullName}`);
      return true;
    } else {
      log('red', '❌ Login failed: ' + response.data.message);
      return false;
    }
  } catch (error) {
    log('red', '❌ Login error: ' + error.message);
    return false;
  }
}

async function testInvalidLogin() {
  log('blue', '\n🚫 Testing Invalid Login...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'wrongpassword'
    });

    log('red', '❌ Should have failed but succeeded');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      log('green', '✅ Correctly rejected invalid login');
      return true;
    } else {
      log('red', '❌ Unexpected error: ' + error.message);
      return false;
    }
  }
}

async function testPublicEndpoint() {
  log('blue', '\n🌍 Testing Public Endpoint (Ask)...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/ask`, {
      question: 'Hello test'
    });

    if (response.status === 200) {
      log('green', '✅ Public endpoint accessible without auth');
      return true;
    } else {
      log('red', '❌ Public endpoint failed');
      return false;
    }
  } catch (error) {
    log('red', '❌ Public endpoint error: ' + error.message);
    return false;
  }
}

async function testProtectedEndpointWithoutAuth() {
  log('blue', '\n🔒 Testing Protected Endpoint Without Auth...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/upload`);
    log('red', '❌ Should have been rejected but succeeded');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      log('green', '✅ Correctly rejected request without auth');
      return true;
    } else {
      log('red', '❌ Unexpected error: ' + error.message);
      return false;
    }
  }
}

async function testProtectedEndpointWithAuth() {
  log('blue', '\n🔑 Testing Protected Endpoint With Auth...');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.data.success) {
      log('green', '✅ Protected endpoint accessible with auth');
      log('blue', `   Profile: ${response.data.data.fullName}`);
      return true;
    } else {
      log('red', '❌ Protected endpoint failed');
      return false;
    }
  } catch (error) {
    log('red', '❌ Protected endpoint error: ' + error.message);
    return false;
  }
}

async function testInvalidToken() {
  log('blue', '\n🚫 Testing Invalid Token...');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/auth/profile`, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });

    log('red', '❌ Should have been rejected but succeeded');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      log('green', '✅ Correctly rejected invalid token');
      return true;
    } else {
      log('red', '❌ Unexpected error: ' + error.message);
      return false;
    }
  }
}

async function testUserManagement() {
  log('blue', '\n👥 Testing User Management...');
  
  try {
    // Get users list
    const usersResponse = await axios.get(`${BASE_URL}/api/auth/users`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (usersResponse.data.success) {
      log('green', '✅ Can retrieve users list');
      log('blue', `   Found ${usersResponse.data.data.length} users`);
    }

    // Create test user
    const createResponse = await axios.post(`${BASE_URL}/api/auth/users`, {
      username: 'testuser',
      password: 'TestPass@123',
      fullName: 'Test User',
      phone: '0123456789',
      position: 'Tester',
      location: 'Test Location'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (createResponse.data.success) {
      log('green', '✅ Can create new user');
      const userId = createResponse.data.data.id;

      // Deactivate test user
      const deactivateResponse = await axios.delete(`${BASE_URL}/api/auth/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (deactivateResponse.data.success) {
        log('green', '✅ Can deactivate user');
      }
    }

    return true;
  } catch (error) {
    log('red', '❌ User management error: ' + error.message);
    return false;
  }
}

async function testFactoryResetProtection() {
  log('blue', '\n💣 Testing Factory Reset Protection...');
  
  try {
    // Test without auth
    try {
      await axios.post(`${BASE_URL}/api/debug/factory-reset`);
      log('red', '❌ Factory reset should require auth');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        log('green', '✅ Factory reset correctly requires auth');
      }
    }

    // Test with auth but no confirmation
    try {
      const response = await axios.post(`${BASE_URL}/api/debug/factory-reset`, {}, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      log('red', '❌ Factory reset should require confirmation');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        log('green', '✅ Factory reset correctly requires confirmation');
      }
    }

    return true;
  } catch (error) {
    log('red', '❌ Factory reset test error: ' + error.message);
    return false;
  }
}

async function runAllTests() {
  log('yellow', '🧪 Starting Authentication System Tests...');
  log('yellow', `   Testing against: ${BASE_URL}`);
  
  const tests = [
    { name: 'Login', fn: testLogin },
    { name: 'Invalid Login', fn: testInvalidLogin },
    { name: 'Public Endpoint', fn: testPublicEndpoint },
    { name: 'Protected Without Auth', fn: testProtectedEndpointWithoutAuth },
    { name: 'Protected With Auth', fn: testProtectedEndpointWithAuth },
    { name: 'Invalid Token', fn: testInvalidToken },
    { name: 'User Management', fn: testUserManagement },
    { name: 'Factory Reset Protection', fn: testFactoryResetProtection }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) passed++;
    } catch (error) {
      log('red', `❌ ${test.name} failed with error: ${error.message}`);
    }
  }

  log('yellow', `\n📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    log('green', '🎉 All authentication tests passed!');
    log('green', '🛡️ Authentication system is working correctly');
  } else {
    log('red', '⚠️  Some tests failed - check configuration');
  }

  return passed === total;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runAllTests }; 