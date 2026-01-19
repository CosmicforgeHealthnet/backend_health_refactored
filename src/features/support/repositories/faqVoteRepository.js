// src/repositories/faqVoteRepository.js
const AppDataSource = require('../../../config/database');
const FAQVote = require('../entities/FAQVote');

class FAQVoteRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(FAQVote);
  }

  async findUserVote(faqId, userId = null, ipAddress = null) {
    const where = { faqId };

    if (userId) {
      where.userId = userId;
    } else if (ipAddress) {
      where.ipAddress = ipAddress;
      where.userId = null;
    }

    return this.repo.findOne({ where });
  }

  async create(voteData) {
    const vote = this.repo.create(voteData);
    return this.repo.save(vote);
  }

  async update(id, updateData) {
    return this.repo.update(id, updateData);
  }

  async getVoteCounts(faqId) {
    return this.repo
      .createQueryBuilder('vote')
      .select('vote.voteType as vote_type, COUNT(*) as count')
      .where('vote.faqId = :faqId', { faqId })
      .groupBy('vote.voteType')
      .getRawMany();
  }
}

module.exports = new FAQVoteRepository();
