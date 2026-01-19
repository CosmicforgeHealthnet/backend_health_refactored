const { getRepository } = require("typeorm");

class FileRepository {
  getRepo() {
    return getRepository("FileRecord");
  }

  create(data) {
    const repo = this.getRepo();
    const rec = repo.create(data);
    return repo.save(rec);
  }

  findById(id) {
    const repo = this.getRepo();
    return repo.findOne({ where: { id } });
  }

  findAll() {
    const repo = this.getRepo();
    return repo.find();
  }

  findByUploader(uploadBy) {
    const repo = this.getRepo();
    return repo.find({ where: { uploadBy } });
  }

  update(id, data) {
    const repo = this.getRepo();
    return repo.update({ id }, data);
  }

  delete(id) {
    const repo = this.getRepo();
    return repo.delete({ id });
  }
}

module.exports = new FileRepository();