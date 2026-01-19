// src/services/fileService.js
const fileRepository = require("../../features/documents/repositories/fileRepository");

class FileService {
  async uploadFile({ uploadBy, fileUrl, fileName, folderName, fileId }) {
    return fileRepository.create({ uploadBy, fileUrl, fileName, folderName, fileId });
  }

  async getFile(id) {
    return fileRepository.findById(id);
  }

  async listFiles({ uploadBy, folderName } = {}) {
    // filter by uploader or return all
    if (uploadBy) return fileRepository.findByUploader(uploadBy);
    return fileRepository.findAll();
  }

  async updateFile(id, data) {
    await fileRepository.update(id, data);
    return fileRepository.findById(id);
  }

  async deleteFile(id) {
    return fileRepository.delete(id);
  }
}

module.exports = new FileService();