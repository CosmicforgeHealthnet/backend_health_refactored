const $RefParser = require('@apidevtools/swagger-parser');
$RefParser.bundle('src/docs/swagger.yaml')
  .then(api => console.log('✅ Bundled OK'))
  .catch(err => {
    console.error('❌ Bundle error:', err.message);
    if (err.details) console.error(err.details);
  });
