// Quick test script for mark API
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing mark API...');
    
    // Test 1: Check if mark model exists
    console.log('\n1. Checking if mark model exists...');
    const hasMark = 'mark' in prisma;
    console.log('   Mark model available:', hasMark);
    
    // Test 2: Try to get all marks
    console.log('\n2. Fetching all marks...');
    const marks = await prisma.mark.findMany();
    console.log('   Marks found:', marks.length);
    
    // Test 3: Try to create a test mark
    console.log('\n3. Creating a test mark...');
    const testMark = await prisma.mark.create({
      data: {
        id: `MARK-${Date.now()}-test`,
        name: 'Test Mark',
        color: '#FF5733',
        latDeg: 13.7563,
        lonDeg: 100.5018,
        radiusM: 100,
      },
    });
    console.log('   Test mark created:', testMark.id);
    
    // Test 4: Delete the test mark
    console.log('\n4. Deleting test mark...');
    await prisma.mark.delete({ where: { id: testMark.id } });
    console.log('   Test mark deleted');
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();

