const { migrateDatabase } = require('./migrations/index');

// Chạy migration
migrateDatabase()
  .then(() => {
    console.log('🎉 Migration hoàn tất thành công');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration thất bại:', error);
    process.exit(1);
  });