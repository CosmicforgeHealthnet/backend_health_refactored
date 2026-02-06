const captureRawBody = (req, res, next) => {
    let data = '';
    req.setEncoding('utf8');

    req.on('data', (chunk) => {
        data += chunk;
        // console.log('📥 Received chunk:', chunk.length, 'bytes');
    });

    req.on('end', () => {
        // console.log('📥 Raw body captured:', data.length, 'bytes');
        req.rawBody = data;
        try {
            req.body = JSON.parse(data);
            // console.log('✅ JSON parsed successfully');
            next();
        } catch (error) {
            console.error('❌ Error parsing webhook JSON:', error);
            // console.error('❌ Raw data:', data);
            res.status(400).json({ error: 'Invalid JSON' });
        }
    });

    req.on('error', (error) => {
        console.error('❌ Request error:', error);
        res.status(500).json({ error: 'Request processing failed' });
    });
};

module.exports = captureRawBody;
