const { initializeDatabase, db } = require('./database');

async function initializeData() {
  try {
    console.log('🔄 Initializing database...');
    await initializeDatabase();

    console.log('🏢 Creating companies...');
    
    // Create PDH company
    const pdh = await db.createCompany({
      code: 'PDH',
      fullName: 'Phát Đạt Holdings',
      parentGroup: 'Phát Đạt Group',
      chairman: 'Nguyễn Văn Đạt',
      ceo: 'Dương Hồng Cẩm',
      description: 'PDH là Phát Đạt Holdings, công ty thuộc Phát Đạt Group với Chủ tịch Hội đồng Quản trị là Nguyễn Văn Đạt và Tổng Giám đốc là Dương Hồng Cẩm.',
      keywords: ['pdh', 'phát đạt holdings', 'phát đạt group']
    });
    console.log('✅ Created PDH company');

    // Create PDI company  
    const pdi = await db.createCompany({
      code: 'PDI',
      fullName: 'Phát Đạt Industrials',
      parentGroup: 'Phát Đạt Group',
      chairman: 'Nguyễn Văn Đạt',
      ceo: null,
      description: 'PDI là Phát Đạt Industrials, công ty con thuộc Phát Đạt Group chuyên về lĩnh vực công nghiệp.',
      keywords: ['pdi', 'phát đạt industrials', 'phát đạt group', 'công nghiệp']
    });
    console.log('✅ Created PDI company');

    console.log('🛡️ Creating sensitive rules...');
    
    // Create sensitive rules
    const rules = [
      {
        ruleName: 'Sexual Content',
        pattern: 'sex|tình dục|làm tình|quan hệ|khiêu dâm|porn|xxx|nude|nóng bỏng|gợi cảm',
        description: 'Chặn nội dung liên quan đến tình dục'
      },
      {
        ruleName: 'Violence/Weapons',
        pattern: 'súng|đạn|vũ khí|giết|chết|bạo lực|đánh nhau|weapon|gun|kill|violence|bomb|nổ|ma túy|drug',
        description: 'Chặn nội dung liên quan đến bạo lực và vũ khí'
      },
      {
        ruleName: 'Hate Speech',
        pattern: 'chửi|mắng|ghét|khinh|phân biệt|racist|hate',
        description: 'Chặn ngôn từ căm ghét'
      },
      {
        ruleName: 'Illegal Activities',
        pattern: 'hack|lừa đảo|scam|cheat|gian lận|bất hợp pháp|illegal',
        description: 'Chặn hoạt động bất hợp pháp'
      },
      {
        ruleName: 'Gambling',
        pattern: 'cờ bạc|gambling|bet|cược|casino',
        description: 'Chặn nội dung liên quan đến cờ bạc'
      }
    ];

    for (const rule of rules) {
      await db.createSensitiveRule(rule);
      console.log(`✅ Created rule: ${rule.ruleName}`);
    }

    console.log('📚 Creating knowledge base entries...');
    
    // Create knowledge base entries for PDH
    const pdhKnowledge = [
      {
        companyId: pdh.id,
        question: 'PDH là công ty gì?',
        answer: 'PDH là Phát Đạt Holdings, công ty thuộc Phát Đạt Group với Chủ tịch Hội đồng Quản trị là Nguyễn Văn Đạt và Tổng Giám đốc là Dương Hồng Cẩm.',
        keywords: ['pdh', 'phát đạt holdings', 'công ty'],
        category: 'Thông tin công ty'
      },
      {
        companyId: pdh.id,
        question: 'Chủ tịch PDH là ai?',
        answer: 'Chủ tịch Hội đồng Quản trị của Phát Đạt Holdings (PDH) là Nguyễn Văn Đạt.',
        keywords: ['chủ tịch', 'nguyễn văn đạt'],
        category: 'Nhân sự'
      },
      {
        companyId: pdh.id,
        question: 'Tổng giám đốc PDH là ai?',
        answer: 'Tổng Giám đốc của Phát Đạt Holdings (PDH) là Dương Hồng Cẩm.',
        keywords: ['tổng giám đốc', 'dương hồng cẩm'],
        category: 'Nhân sự'
      }
    ];

    for (const knowledge of pdhKnowledge) {
      await db.createKnowledge(knowledge);
      console.log(`✅ Created knowledge: ${knowledge.question}`);
    }

    // Create knowledge base entries for PDI  
    const pdiKnowledge = [
      {
        companyId: pdi.id,
        question: 'PDI là công ty gì?',
        answer: 'PDI là Phát Đạt Industrials, công ty con thuộc Phát Đạt Group chuyên về lĩnh vực công nghiệp.',
        keywords: ['pdi', 'phát đạt industrials', 'công nghiệp'],
        category: 'Thông tin công ty'
      },
      {
        companyId: pdi.id,
        question: 'PDI thuộc nhóm nào?',
        answer: 'PDI (Phát Đạt Industrials) là công ty con thuộc Phát Đạt Group.',
        keywords: ['pdi', 'phát đạt group', 'công ty con'],
        category: 'Thông tin công ty'
      }
    ];

    for (const knowledge of pdiKnowledge) {
      await db.createKnowledge(knowledge);
      console.log(`✅ Created knowledge: ${knowledge.question}`);
    }

    console.log('🎉 Data initialization completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Companies: ${await (await db.getCompanies()).length}`);
    console.log(`- Sensitive Rules: ${await (await db.getSensitiveRules()).length}`);
    console.log(`- Knowledge Entries: ${await (await db.searchKnowledge('')).length}`);

  } catch (error) {
    console.error('❌ Error initializing data:', error);
  }
}

// Run if called directly
if (require.main === module) {
  initializeData().then(() => {
    console.log('✅ Initialization complete!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  });
}

module.exports = { initializeData }; 