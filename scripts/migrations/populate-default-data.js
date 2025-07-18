const { pool } = require('../../src/config/database');
const bcrypt = require('bcrypt');

/**
 * Thêm dữ liệu mặc định vào database
 */
async function populateDefaultData(client) {
  console.log('🏢 Kiểm tra và thêm dữ liệu mặc định...');
  
  // Thêm công ty mặc định nếu chưa có
  const companiesCount = await client.query('SELECT COUNT(*) FROM companies');
  const count = parseInt(companiesCount.rows[0].count);
  
  if (count === 0) {
    console.log('📝 Thêm công ty mặc định...');
    
    const defaultCompanies = [
      {
        code: 'PDH',
        full_name: 'Phát Đạt Holdings',
        description: 'Công ty mẹ của Tập đoàn Phát Đạt',
        chairman: 'Nguyễn Văn Đạt',
        ceo: 'Dương Hồng Cẩm'
      },
      {
        code: 'PDI',
        full_name: 'Phát Đạt Industrial',
        description: 'Công ty công nghiệp của Tập đoàn Phát Đạt',
        chairman: 'Phạm Trọng Hòa',
        ceo: 'Vũ Văn Luyến'
      },
    ];
    
    for (const company of defaultCompanies) {
      await client.query(
        'INSERT INTO companies (code, full_name, description, chairman, ceo) VALUES ($1, $2, $3, $4, $5)',
        [company.code, company.full_name, company.description, company.chairman, company.ceo]
      );
      console.log(`✅ Đã thêm công ty: ${company.code} - ${company.full_name}`);
    }
  } else {
    console.log(`ℹ️  Đã có dữ liệu công ty (${count} công ty)`);
  }
  
  // Tạo hoặc cập nhật người dùng admin mặc định
  console.log('👤 Đảm bảo người dùng admin mặc định...');
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  const existingAdmin = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
  if (existingAdmin.rows.length === 0) {
    console.log('📝 Tạo người dùng admin mặc định...');
    await client.query(`
      INSERT INTO users (username, password, full_name, phone, birth_date, position, location, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      'admin',
      hashedPassword,
      'Trần Minh Khôi',
      '0988204060',
      '2002-08-07',
      'Nhân viên công nghệ thông tin',
      'Hồ Chí Minh, Việt Nam',
      'admin',
      true
    ]);
    console.log('✅ Đã tạo người dùng admin mặc định: admin/' + adminPassword);
  } else {
    console.log('🔄 Cập nhật mật khẩu cho người dùng admin...');
    await client.query('UPDATE users SET password = $1 WHERE username = $2', [hashedPassword, 'admin']);
    console.log('✅ Đã cập nhật mật khẩu admin: admin/' + adminPassword);
  }
}

module.exports = { populateDefaultData }; 