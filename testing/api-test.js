#!/usr/bin/env node

/**
 * WarmPaws API Test Script
 * Automated tests for Supabase integration
 *
 * Usage: node testing/api-test.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Test results
const results = {
  passed: 0,
  failed: 0,
  total: 0
};

// Test user credentials (will be created during tests)
const testUser = {
  email: `test_${Date.now()}@warmpaws.test`,
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
  phone: '555-0100',
  role: 'buyer'
};

let testSession = null;

/**
 * Helper: Print test result
 */
function printResult(testName, passed, message = '') {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`  ${colors.green}✓${colors.reset} ${testName}`);
  } else {
    results.failed++;
    console.log(`  ${colors.red}✗${colors.reset} ${testName}`);
    if (message) {
      console.log(`    ${colors.red}${message}${colors.reset}`);
    }
  }
}

/**
 * Test Suite: Authentication
 */
async function testAuthentication() {
  console.log(`\n${colors.cyan}━━━ Authentication Tests ━━━${colors.reset}\n`);

  // Test 1: User Registration
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
      options: {
        data: {
          first_name: testUser.firstName,
          last_name: testUser.lastName,
          phone: testUser.phone,
          role: testUser.role
        }
      }
    });

    printResult(
      'User registration',
      !error && data.user !== null,
      error?.message
    );

    if (!error && data.user) {
      testUser.id = data.user.id;
    }
  } catch (err) {
    printResult('User registration', false, err.message);
  }

  // Test 2: User Login
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password
    });

    printResult(
      'User login',
      !error && data.session !== null,
      error?.message
    );

    if (!error && data.session) {
      testSession = data.session;
    }
  } catch (err) {
    printResult('User login', false, err.message);
  }

  // Test 3: Get Current User
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    printResult(
      'Get current user',
      !error && user !== null && user.email === testUser.email,
      error?.message
    );
  } catch (err) {
    printResult('Get current user', false, err.message);
  }

  // Test 4: Profile Auto-Creation
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testUser.id)
      .single();

    printResult(
      'Profile auto-created',
      !error && data !== null && data.role === testUser.role,
      error?.message
    );
  } catch (err) {
    printResult('Profile auto-created', false, err.message);
  }
}

/**
 * Test Suite: Pets
 */
async function testPets() {
  console.log(`\n${colors.cyan}━━━ Pet Management Tests ━━━${colors.reset}\n`);

  let createdPetId = null;

  // Test 1: Fetch all pets
  try {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .limit(10);

    printResult(
      'Fetch all pets',
      !error && Array.isArray(data),
      error?.message
    );

    console.log(`    Found ${data?.length || 0} pets`);
  } catch (err) {
    printResult('Fetch all pets', false, err.message);
  }

  // Test 2: Fetch pets with filters
  try {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('type', 'dog')
      .gte('price', 500)
      .lte('price', 2000);

    printResult(
      'Fetch pets with filters',
      !error && Array.isArray(data),
      error?.message
    );
  } catch (err) {
    printResult('Fetch pets with filters', false, err.message);
  }

  // Test 3: Fetch pets with relationships
  try {
    const { data, error } = await supabase
      .from('pets')
      .select(`
        *,
        seller:profiles!pets_seller_id_fkey(id, first_name, last_name),
        photos:pet_photos(id, photo_url, is_primary)
      `)
      .limit(1);

    printResult(
      'Fetch pets with relationships',
      !error && data?.length > 0 && data[0].seller !== undefined,
      error?.message
    );
  } catch (err) {
    printResult('Fetch pets with relationships', false, err.message);
  }

  // Test 4: Create pet (should fail - user is buyer, not seller)
  try {
    const { data, error } = await supabase
      .from('pets')
      .insert([{
        seller_id: testUser.id,
        name: 'Test Pet',
        type: 'dog',
        breed: 'Test Breed',
        age_months: 6,
        price: 1000,
        description: 'Test description',
        location: 'Test Location',
        gender: 'male',
        vaccinated: true,
        neutered: false,
        status: 'available',
        quantity: 1
      }])
      .select()
      .single();

    // Should fail because user is buyer, not seller
    printResult(
      'RLS blocks buyer from creating pet',
      error !== null,
      'Buyer was able to create pet (RLS not working!)'
    );
  } catch (err) {
    printResult('RLS blocks buyer from creating pet', true);
  }
}

/**
 * Test Suite: Cart
 */
async function testCart() {
  console.log(`\n${colors.cyan}━━━ Shopping Cart Tests ━━━${colors.reset}\n`);

  // Test 1: Get empty cart
  try {
    const { data, error } = await supabase
      .from('cart')
      .select('*')
      .eq('user_id', testUser.id);

    printResult(
      'Get user cart',
      !error && Array.isArray(data),
      error?.message
    );
  } catch (err) {
    printResult('Get user cart', false, err.message);
  }

  // Test 2: Add to cart (need a pet first)
  try {
    // Get any available pet
    const { data: pets } = await supabase
      .from('pets')
      .select('id')
      .eq('status', 'available')
      .limit(1);

    if (pets && pets.length > 0) {
      const { data, error } = await supabase
        .from('cart')
        .insert([{
          user_id: testUser.id,
          pet_id: pets[0].id,
          quantity: 1
        }])
        .select()
        .single();

      printResult(
        'Add item to cart',
        !error && data !== null,
        error?.message
      );

      // Clean up
      if (data) {
        await supabase.from('cart').delete().eq('id', data.id);
      }
    } else {
      printResult('Add item to cart', false, 'No pets available to test');
    }
  } catch (err) {
    printResult('Add item to cart', false, err.message);
  }

  // Test 3: Cart RLS - cannot view other user's cart
  try {
    const { data, error } = await supabase
      .from('cart')
      .select('*')
      .neq('user_id', testUser.id)
      .limit(1);

    printResult(
      'RLS blocks viewing others\' carts',
      !error && data.length === 0,
      'Able to view other users\' carts (RLS not working!)'
    );
  } catch (err) {
    printResult('RLS blocks viewing others\' carts', false, err.message);
  }
}

/**
 * Test Suite: Messages
 */
async function testMessages() {
  console.log(`\n${colors.cyan}━━━ Messaging Tests ━━━${colors.reset}\n`);

  // Test 1: Get inbox
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, first_name, last_name)
      `)
      .eq('recipient_id', testUser.id);

    printResult(
      'Fetch inbox',
      !error && Array.isArray(data),
      error?.message
    );
  } catch (err) {
    printResult('Fetch inbox', false, err.message);
  }

  // Test 2: Get sent messages
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        recipient:profiles!messages_recipient_id_fkey(id, first_name, last_name)
      `)
      .eq('sender_id', testUser.id);

    printResult(
      'Fetch sent messages',
      !error && Array.isArray(data),
      error?.message
    );
  } catch (err) {
    printResult('Fetch sent messages', false, err.message);
  }
}

/**
 * Test Suite: Orders
 */
async function testOrders() {
  console.log(`\n${colors.cyan}━━━ Order Tests ━━━${colors.reset}\n`);

  // Test 1: Get purchases
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        pet:pets(id, name),
        seller:profiles!orders_seller_id_fkey(id, first_name, last_name)
      `)
      .eq('buyer_id', testUser.id);

    printResult(
      'Fetch buyer purchases',
      !error && Array.isArray(data),
      error?.message
    );
  } catch (err) {
    printResult('Fetch buyer purchases', false, err.message);
  }

  // Test 2: Get sales (should be empty for buyer)
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('seller_id', testUser.id);

    printResult(
      'Fetch seller sales',
      !error && Array.isArray(data) && data.length === 0,
      error?.message
    );
  } catch (err) {
    printResult('Fetch seller sales', false, err.message);
  }
}

/**
 * Test Suite: Storage
 */
async function testStorage() {
  console.log(`\n${colors.cyan}━━━ Storage Tests ━━━${colors.reset}\n`);

  // Test 1: Test bucket access by listing files
  try {
    const { data, error } = await supabase.storage
      .from('pet-photos')
      .list('', {
        limit: 1
      });

    printResult(
      'Pet photos bucket is accessible',
      !error,
      error?.message || 'Cannot access bucket'
    );
  } catch (err) {
    printResult('Pet photos bucket is accessible', false, err.message);
  }

  // Test 2: Test public URL generation
  try {
    // Generate a public URL for a test path
    const { data } = supabase.storage
      .from('pet-photos')
      .getPublicUrl('test/sample.jpg');

    const hasValidUrl = data?.publicUrl && data.publicUrl.includes('pet-photos');

    printResult(
      'Public URL generation works',
      hasValidUrl,
      'Public URL not generated correctly'
    );
  } catch (err) {
    printResult('Public URL generation works', false, err.message);
  }
}

/**
 * Cleanup: Remove test user
 */
async function cleanup() {
  console.log(`\n${colors.yellow}━━━ Cleanup ━━━${colors.reset}\n`);

  try {
    // Sign out
    await supabase.auth.signOut();
    console.log('  Signed out test user');

    // Note: Can't delete auth user with anon key
    // Would need service_role key for that
    console.log('  ⚠️  Test user not deleted (requires admin/service key)');
    console.log(`     Email: ${testUser.email}`);
    console.log('     Manually delete from Supabase Dashboard if needed');

  } catch (err) {
    console.log(`  ${colors.red}Cleanup error: ${err.message}${colors.reset}`);
  }
}

/**
 * Print final results
 */
function printSummary() {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}  TEST SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  const passRate = results.total > 0 ? (results.passed / results.total * 100).toFixed(1) : 0;

  console.log(`  Total Tests: ${results.total}`);
  console.log(`  ${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`  Pass Rate: ${passRate}%\n`);

  if (results.failed === 0) {
    console.log(`  ${colors.green}✓ All tests passed!${colors.reset}\n`);
  } else {
    console.log(`  ${colors.red}✗ Some tests failed${colors.reset}\n`);
  }

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`\n${colors.blue}╔═══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║   WarmPaws API Test Suite - Supabase     ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════╝${colors.reset}\n`);

  // Check environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error(`${colors.red}Error: Missing Supabase credentials in .env${colors.reset}`);
    console.error('Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set\n');
    process.exit(1);
  }

  console.log(`  Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log(`  Using anon key: ${process.env.SUPABASE_ANON_KEY.substring(0, 20)}...\n`);

  try {
    await testAuthentication();
    await testPets();
    await testCart();
    await testMessages();
    await testOrders();
    await testStorage();
    await cleanup();
    printSummary();

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runTests();
