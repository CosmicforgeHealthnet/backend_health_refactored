// src/controllers/fileController.js
const fileService = require("../../../shared/services/fileService");

exports.uploadFile = async (req, res, next) => {
  try {
    const { fileUrl, fileName, folderName, fileId } = req.body;
    const uploadBy = req.user.id;
    const record = await fileService.uploadFile({ uploadBy, fileUrl, fileName, folderName, fileId });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
};

exports.getFile = async (req, res, next) => {
  try {
    const rec = await fileService.getFile(req.params.id);
    if (!rec) return res.status(404).json({ error: 'File not found' });
    res.json(rec);
  } catch (err) {
    next(err);
  }
};

exports.listFiles = async (req, res, next) => {
  try {
    const { uploadBy } = req.query;
    const recs = await fileService.listFiles({ uploadBy });
    res.json(recs);
  } catch (err) {
    next(err);
  }
};

exports.updateFile = async (req, res, next) => {
  try {
    const data = req.body;
    const updated = await fileService.updateFile(req.params.id, data);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deleteFile = async (req, res, next) => {
  try {
    await fileService.deleteFile(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};