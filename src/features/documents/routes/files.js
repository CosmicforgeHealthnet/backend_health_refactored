const router = require('express').Router();
const { authenticateJWT } = require('../../../shared/middlewares/authMiddleware');
const fileController = require('../controllers/fileController');

router.use(authenticateJWT);

router.post('/', fileController.uploadFile);
router.get('/', fileController.listFiles);
router.get('/:id', fileController.getFile);
router.patch('/:id', fileController.updateFile);
router.delete('/:id', fileController.deleteFile);

module.exports = router;
