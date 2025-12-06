#!/usr/bin/env node

/**
 * WarmPaws Test Data Setup Script
 * Creates test users and pets for testing
 *
 * Usage: node testing/setup-test-data.js
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

// Initialize Supabase client with SERVICE ROLE key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key to create users
);

// Test users to create
const testUsers = [
  {
    email: 'seller1@warmpaws.test',
    password: 'TestPassword123!',
    firstName: 'John',
    lastName: 'Seller',
    phone: '555-0101',
    role: 'seller'
  },
  {
    email: 'seller2@warmpaws.test',
    password: 'TestPassword123!',
    firstName: 'Jane',
    lastName: 'Seller',
    phone: '555-0102',
    role: 'seller'
  },
  {
    email: 'buyer1@warmpaws.test',
    password: 'TestPassword123!',
    firstName: 'Bob',
    lastName: 'Buyer',
    phone: '555-0103',
    role: 'buyer'
  }
];

// Test pets data
const testPets = [
  {
    name: 'Max',
    type: 'dog',
    breed: 'Golden Retriever',
    age_months: 8,
    price: 1200,
    description: 'Friendly and energetic golden retriever puppy. Great with kids!',
    location: 'Atlanta, GA',
    gender: 'male',
    vaccinated: true,
    neutered: false,
    status: 'available',
    quantity: 1
  },
  {
    name: 'Luna',
    type: 'cat',
    breed: 'Persian',
    age_months: 6,
    price: 800,
    description: 'Beautiful white Persian kitten. Very playful and affectionate.',
    location: 'Atlanta, GA',
    gender: 'female',
    vaccinated: true,
    neutered: false,
    status: 'available',
    quantity: 1
  },
  {
    name: 'Buddy',
    type: 'dog',
    breed: 'Labrador',
    age_months: 12,
    price: 1500,
    description: 'Well-trained labrador, perfect family dog.',
    location: 'Marietta, GA',
    gender: 'male',
    vaccinated: true,
    neutered: true,
    status: 'available',
    quantity: 1
  },
  {
    name: 'Mittens',
    type: 'cat',
    breed: 'Siamese',
    age_months: 4,
    price: 600,
    description: 'Adorable Siamese kitten with blue eyes.',
    location: 'Carrollton, GA',
    gender: 'female',
    vaccinated: true,
    neutered: false,
    status: 'available',
    quantity: 2
  },
  {
    name: 'Charlie',
    type: 'dog',
    breed: 'Beagle',
    age_months: 10,
    price: 900,
    description: 'Energetic beagle puppy, loves to play.',
    location: 'Atlanta, GA',
    gender: 'male',
    vaccinated: true,
    neutered: false,
    status: 'available',
    quantity: 1
  }
];

let createdUserIds = [];

/**
 * Create test users
 */
async function createTestUsers() {
  console.log(`\n${colors.cyan}━━━ Creating Test Users ━━━${colors.reset}\n`);

  for (const user of testUsers) {
    try {
      // Check if user already exists
      const { data: existingUsers } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', user.email);

      if (existingUsers && existingUsers.length > 0) {
        console.log(`  ${colors.yellow}⊙${colors.reset} User ${user.email} already exists`);
        createdUserIds.push({
          id: existingUsers[0].id,
          email: user.email,
          role: user.role
        });
        continue;
      }

      // Create user with service role
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          first_name: user.firstName,
          last_name: user.lastName,
          phone: user.phone,
          role: user.role
        }
      });

      if (error) {
        console.log(`  ${colors.red}✗${colors.reset} Failed to create ${user.email}: ${error.message}`);
        continue;
      }

      console.log(`  ${colors.green}✓${colors.reset} Created ${user.email} (${user.role})`);
      createdUserIds.push({
        id: data.user.id,
        email: user.email,
        role: user.role
      });

    } catch (err) {
      console.log(`  ${colors.red}✗${colors.reset} Error creating ${user.email}: ${err.message}`);
    }
  }

  console.log(`\n  Created/Found ${createdUserIds.length} users`);
}

/**
 * Create test pets
 */
async function createTestPets() {
  console.log(`\n${colors.cyan}━━━ Creating Test Pets ━━━${colors.reset}\n`);

  // Get seller users
  const sellers = createdUserIds.filter(u => u.role === 'seller');

  if (sellers.length === 0) {
    console.log(`  ${colors.red}✗${colors.reset} No sellers found. Cannot create pets.`);
    return;
  }

  let createdCount = 0;

  for (let i = 0; i < testPets.length; i++) {
    const pet = testPets[i];
    // Alternate between sellers
    const seller = sellers[i % sellers.length];

    try {
      // Check if similar pet already exists
      const { data: existingPets } = await supabase
        .from('pets')
        .select('id')
        .eq('name', pet.name)
        .eq('seller_id', seller.id);

      if (existingPets && existingPets.length > 0) {
        console.log(`  ${colors.yellow}⊙${colors.reset} Pet "${pet.name}" already exists for seller ${seller.email}`);
        continue;
      }

      const { data, error } = await supabase
        .from('pets')
        .insert([{
          ...pet,
          seller_id: seller.id
        }])
        .select()
        .single();

      if (error) {
        console.log(`  ${colors.red}✗${colors.reset} Failed to create ${pet.name}: ${error.message}`);
        continue;
      }

      console.log(`  ${colors.green}✓${colors.reset} Created ${pet.name} (${pet.type}) - Seller: ${seller.email}`);
      createdCount++;

    } catch (err) {
      console.log(`  ${colors.red}✗${colors.reset} Error creating ${pet.name}: ${err.message}`);
    }
  }

  console.log(`\n  Created ${createdCount} new pets`);
}

/**
 * Check storage bucket configuration
 */
async function checkStorageConfiguration() {
  console.log(`\n${colors.cyan}━━━ Checking Storage Configuration ━━━${colors.reset}\n`);

  // Check bucket exists
  try {
    const { data: bucket, error } = await supabase.storage.getBucket('pet-photos');

    if (error) {
      console.log(`  ${colors.red}✗${colors.reset} Bucket 'pet-photos' not found`);
      console.log(`  ${colors.yellow}→${colors.reset} Please create it in Supabase Dashboard → Storage`);
      return;
    }

    console.log(`  ${colors.green}✓${colors.reset} Bucket 'pet-photos' exists`);
    console.log(`  ${colors.blue}  Public:${colors.reset} ${bucket.public ? 'Yes' : 'No'}`);
    console.log(`  ${colors.blue}  File size limit:${colors.reset} ${bucket.file_size_limit ? bucket.file_size_limit / 1024 / 1024 + ' MB' : 'Unlimited'}`);

    if (!bucket.public) {
      console.log(`  ${colors.yellow}⚠${colors.reset}  Bucket should be public for image URLs to work`);
    }

  } catch (err) {
    console.log(`  ${colors.red}✗${colors.reset} Error checking bucket: ${err.message}`);
  }

  // Check storage policies
  console.log(`\n  ${colors.blue}Storage Policies:${colors.reset}`);
  console.log(`  Check in Supabase Dashboard → Storage → pet-photos → Policies`);
  console.log(`  Required policies:`);
  console.log(`    1. SELECT (public) - Anyone can view photos`);
  console.log(`    2. INSERT (authenticated) - Users can upload photos`);
  console.log(`    3. DELETE (authenticated) - Users can delete own photos`);
}

/**
 * Print summary
 */
function printSummary() {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}  SETUP COMPLETE${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  console.log(`  ${colors.green}✓${colors.reset} Test users created/verified`);
  console.log(`  ${colors.green}✓${colors.reset} Test pets created/verified`);
  console.log(`  ${colors.green}✓${colors.reset} Storage configuration checked\n`);

  console.log(`  ${colors.blue}Next Steps:${colors.reset}`);
  console.log(`    1. Verify storage policies are configured`);
  console.log(`    2. Run automated tests: ${colors.cyan}node testing/api-test.js${colors.reset}`);
  console.log(`    3. Test application manually: ${colors.cyan}open index.html${colors.reset}\n`);

  console.log(`  ${colors.blue}Test User Credentials:${colors.reset}`);
  console.log(`    Email: seller1@warmpaws.test`);
  console.log(`    Email: buyer1@warmpaws.test`);
  console.log(`    Password: TestPassword123!\n`);

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

/**
 * Main setup runner
 */
async function runSetup() {
  console.log(`\n${colors.blue}╔═══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║   WarmPaws Test Data Setup               ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════╝${colors.reset}\n`);

  // Check environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error(`${colors.red}Error: Missing Supabase credentials in .env${colors.reset}`);
    console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set\n');
    process.exit(1);
  }

  console.log(`  Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log(`  Using SERVICE ROLE key for admin operations\n`);

  try {
    await createTestUsers();
    await createTestPets();
    await checkStorageConfiguration();
    printSummary();

    process.exit(0);

  } catch (error) {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}\n`);
    process.exit(1);
  }
}

// Run setup
runSetup();
