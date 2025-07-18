const { pool } = require('../../src/config/database');

/**
 * Sửa các cột trong bảng để đảm bảo tính nhất quán
 */
async function fixColumns(client) {
  console.log('🔄 Đang thực hiện sửa đổi cột...');
  
  // Fix conversation_messages table columns
  const msgColsRes = await client.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'conversation_messages'
  `);
  const msgCols = msgColsRes.rows.map(r => r.column_name);
  
  if (msgCols.includes('type') && !msgCols.includes('message_type')) {
    console.log('🔄 Đang đổi tên cột type thành message_type...');
    await client.query('ALTER TABLE conversation_messages RENAME COLUMN type TO message_type');
    console.log('✅ Đã đổi tên cột type thành message_type');
  }
  
  if (msgCols.includes('message') && !msgCols.includes('content')) {
    console.log('🔄 Đang đổi tên cột message thành content...');
    await client.query('ALTER TABLE conversation_messages RENAME COLUMN message TO content');
    console.log('✅ Đã đổi tên cột message thành content');
  }
  
  if (msgCols.includes('document_ids') && !msgCols.includes('relevant_documents')) {
    console.log('🔄 Đang chuyển đổi document_ids thành relevant_documents...');
    
    // Kiểm tra kiểu dữ liệu của document_ids
    const columnTypeCheck = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'conversation_messages' AND column_name = 'document_ids'
    `);
    
    if (columnTypeCheck.rows[0] && columnTypeCheck.rows[0].data_type === 'ARRAY') {
      await client.query(`ALTER TABLE conversation_messages ADD COLUMN relevant_documents JSONB DEFAULT '[]'::jsonb`);
      
      try {
        await client.query(`
          UPDATE conversation_messages 
          SET relevant_documents = COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('id', x)) 
             FROM unnest(document_ids) AS x),
            '[]'::jsonb
          )
          WHERE document_ids IS NOT NULL
        `);
      } catch (error) {
        console.error('❌ Lỗi khi chuyển đổi document_ids:', error.message);
      }
      
      await client.query(`ALTER TABLE conversation_messages DROP COLUMN document_ids`);
    } else {
      await client.query(`ALTER TABLE conversation_messages RENAME COLUMN document_ids TO relevant_documents`);
      await client.query(`
        ALTER TABLE conversation_messages 
        ALTER COLUMN relevant_documents TYPE JSONB 
        USING COALESCE(relevant_documents::jsonb, '[]'::jsonb)
      `);
    }
    console.log('✅ Đã chuyển đổi document_ids thành relevant_documents');
  }
  
  // Xóa cột session_id không sử dụng từ conversation_messages
  if (msgCols.includes('session_id')) {
    console.log('🔄 Đang xóa cột session_id không sử dụng...');
    await client.query('ALTER TABLE conversation_messages DROP COLUMN session_id');
    console.log('✅ Đã xóa cột session_id');
  }

  // Sửa bảng conversations - đổi session_id thành UUID nếu cần
  const conversationCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'session_id'
  `);
  
  if (conversationCols.rows.length > 0) {
    const sessionIdType = conversationCols.rows[0].data_type;
    if (sessionIdType === 'character varying') {
      console.log('🔄 Đang chuyển đổi session_id sang kiểu UUID...');
      try {
        await client.query(`
          ALTER TABLE conversations 
          ALTER COLUMN session_id TYPE UUID 
          USING session_id::UUID
        `);
        console.log('✅ Đã chuyển đổi session_id sang UUID');
      } catch (error) {
        console.error('❌ Lỗi khi chuyển đổi session_id sang UUID:', error.message);
        console.log('ℹ️  Điều này có thể xảy ra nếu dữ liệu không ở định dạng UUID');
      }
    }
  }
}

module.exports = { fixColumns }; 