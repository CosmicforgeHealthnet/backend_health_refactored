const { Pool } = require('pg');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: '',
  port: 5909,
  user: '',
  password: '',
  database: '',
  ssl: {
    rejectUnauthorized: false // For hosted databases like Render
  },
  // Add connection timeout and other options
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
};

const pool = new Pool(dbConfig);

async function exportTableToExcel(tableName, outputFileName) {
  let client;
  
  try {
    // Connect to database
    client = await pool.connect();
    console.log(`Connected to database. Exporting table: ${tableName}`);
    
    // Get all data from the specified table
    const query = `SELECT * FROM ${tableName} ORDER BY 1`;
    const result = await client.query(query);
    
    console.log(`Found ${result.rows.length} rows in ${tableName}`);
    
    if (result.rows.length === 0) {
      console.log(`No data found in table ${tableName}`);
      return;
    }
    
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(result.rows);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, tableName);
    
    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = outputFileName || `${tableName}_export_${timestamp}.xlsx`;
    const filePath = path.join(exportsDir, fileName);
    
    // Write Excel file
    XLSX.writeFile(workbook, filePath);
    
    console.log(`Excel file exported successfully: ${filePath}`);
    console.log(`Total rows exported: ${result.rows.length}`);
    
    return filePath;
    
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function exportMultipleTablesToExcel(tableNames, outputFileName) {
  let client;
  
  try {
    client = await pool.connect();
    console.log('Connected to database. Exporting multiple tables...');
    
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
    for (const tableName of tableNames) {
      try {
        console.log(`Exporting table: ${tableName}`);
        
        const query = `SELECT * FROM ${tableName} ORDER BY 1`;
        const result = await client.query(query);
        
        console.log(`Found ${result.rows.length} rows in ${tableName}`);
        
        if (result.rows.length > 0) {
          // Convert data to worksheet
          const worksheet = XLSX.utils.json_to_sheet(result.rows);
          
          // Add worksheet to workbook (Excel sheet names have 31 char limit)
          const sheetName = tableName.length > 31 ? tableName.substring(0, 31) : tableName;
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        } else {
          console.log(`No data found in table ${tableName}, skipping...`);
        }
        
      } catch (tableError) {
        console.error(`Error exporting table ${tableName}:`, tableError.message);
        // Continue with other tables
      }
    }
    
    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = outputFileName || `database_export_${timestamp}.xlsx`;
    const filePath = path.join(exportsDir, fileName);
    
    // Write Excel file
    XLSX.writeFile(workbook, filePath);
    
    console.log(`Excel file with multiple sheets exported: ${filePath}`);
    
    return filePath;
    
  } catch (error) {
    console.error('Error exporting multiple tables to Excel:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function getAllTableNames() {
  let client;
  
  try {
    client = await pool.connect();
    
    // Query to get all table names from the current database
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const result = await client.query(query);
    return result.rows.map(row => row.table_name);
    
  } catch (error) {
    console.error('Error getting table names:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function exportAllTablesToExcel(outputFileName) {
  try {
    console.log('Getting all table names...');
    const tableNames = await getAllTableNames();
    
    console.log(`Found ${tableNames.length} tables:`, tableNames);
    
    if (tableNames.length === 0) {
      console.log('No tables found in the database');
      return;
    }
    
    return await exportMultipleTablesToExcel(tableNames, outputFileName);
    
  } catch (error) {
    console.error('Error exporting all tables:', error);
    throw error;
  }
}

// Example usage functions
async function runExport() {
  try {
    // Option 1: Export a specific table
    // await exportTableToExcel('your_table_name', 'custom_filename.xlsx');
    
    // Option 2: Export multiple specific tables
    // await exportMultipleTablesToExcel(['table1', 'table2', 'table3'], 'multiple_tables.xlsx');
    
    // Option 3: Export ALL tables in the database
    await exportAllTablesToExcel('complete_database_export.xlsx');
    
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Export functions for use in other modules
module.exports = {
  exportTableToExcel,
  exportMultipleTablesToExcel,
  exportAllTablesToExcel,
  getAllTableNames
};

// Run export if this file is executed directly
if (require.main === module) {
  runExport();
}