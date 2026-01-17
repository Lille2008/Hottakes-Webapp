import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkConstraints() {
  console.log('Checking existing constraints on submissions table...');
  
  const constraints = await prisma.$queryRaw<Array<{ constraint_name: string; constraint_type: string }>>`
    SELECT 
      con.conname as constraint_name,
      con.contype as constraint_type
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'submissions'
      AND nsp.nspname = 'public'
      AND con.contype = 'u'
    ORDER BY con.conname;
  `;
  
  return constraints;
}

async function checkIndexes() {
  console.log('Checking indexes on submissions table...');
  
  const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT 
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'submissions'
      AND schemaname = 'public'
    ORDER BY indexname;
  `;
  
  return indexes;
}

async function removeLegacyUserIdConstraint() {
  console.log('Attempting to remove legacy userId unique constraint...');
  
  try {
    // Check if there's a unique index on just userId
    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'submissions'
        AND schemaname = 'public'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%userId%'
        AND indexdef NOT LIKE '%gameDay%'
      ORDER BY indexname;
    `;
    
    if (indexes.length > 0) {
      console.log('Found legacy userId unique index:', indexes);
      
      for (const index of indexes) {
        console.log(`Dropping index: ${index.indexname}`);
        await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${index.indexname}";`);
        console.log(`✓ Dropped index: ${index.indexname}`);
      }
    } else {
      console.log('No legacy userId unique index found.');
    }
    
    // Check for unique constraint on just userId
    const constraints = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT con.conname as constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
      WHERE rel.relname = 'submissions'
        AND nsp.nspname = 'public'
        AND con.contype = 'u'
        AND array_length(con.conkey, 1) = 1
        AND att.attname = 'userId'
      ORDER BY con.conname;
    `;
    
    if (constraints.length > 0) {
      console.log('Found legacy userId unique constraint:', constraints);
      
      for (const constraint of constraints) {
        console.log(`Dropping constraint: ${constraint.constraint_name}`);
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "${constraint.constraint_name}";`
        );
        console.log(`✓ Dropped constraint: ${constraint.constraint_name}`);
      }
    } else {
      console.log('No legacy userId unique constraint found.');
    }
  } catch (error) {
    console.error('Error removing legacy constraint:', error);
    throw error;
  }
}

async function ensureCompositeConstraint() {
  console.log('Ensuring composite unique constraint on [userId, gameDay]...');
  
  try {
    // Check if the composite constraint exists
    const compositeConstraints = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT con.conname as constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'submissions'
        AND nsp.nspname = 'public'
        AND con.contype = 'u'
        AND array_length(con.conkey, 1) = 2
      ORDER BY con.conname;
    `;
    
    if (compositeConstraints.length > 0) {
      console.log('✓ Composite unique constraint exists:', compositeConstraints[0].constraint_name);
    } else {
      console.log('Creating composite unique index on [userId, gameDay]...');
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "submissions_userId_gameDay_key" 
        ON "submissions"("userId", "gameDay");
      `;
      console.log('✓ Created composite unique index.');
    }
  } catch (error) {
    console.error('Error ensuring composite constraint:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('=== Starting submissions table constraint fix ===\n');
    
    console.log('Before fix:');
    const constraintsBefore = await checkConstraints();
    console.log('Constraints:', constraintsBefore);
    const indexesBefore = await checkIndexes();
    console.log('Indexes:', indexesBefore);
    console.log('');
    
    await removeLegacyUserIdConstraint();
    console.log('');
    
    await ensureCompositeConstraint();
    console.log('');
    
    console.log('After fix:');
    const constraintsAfter = await checkConstraints();
    console.log('Constraints:', constraintsAfter);
    const indexesAfter = await checkIndexes();
    console.log('Indexes:', indexesAfter);
    
    console.log('\n=== Migration completed successfully ===');
  } catch (error) {
    console.error('\n=== Migration failed ===');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
