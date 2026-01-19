// src/repositories/documentFolderRepository.js
const AppDataSource = require('../../../config/database');

class DocumentFolderRepository {

  static getRepository() {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }
    return AppDataSource.getRepository('DocumentFolder');
  }
  /**
   * Create a new folder
   */
  static async createFolder(folderData) {
    const repo = this.getRepository();
    const folder = repo.create(folderData);
    return await repo.save(folder);
  }

  /**
   * Get folder by ID with owner check
   */
  static async getFolderById(folderId, userId) {
    const repo = this.getRepository();
    return await repo.findOne({
      where: {
        id: folderId,
        owner: { id: userId },
        status: 'active'
      },
      relations: ['files', 'owner']
    });
  }

  /**
   * Get all folders for a user
   */
  static async getUserFolders(userId, options = {}) {
    const repo = this.getRepository();
    const {
      page = 1,
      limit = 20,
      folderType,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;

    const queryBuilder = repo.createQueryBuilder('folder')
      .leftJoinAndSelect('folder.files', 'files')
      .where('folder.owner_id = :userId', { userId })
      .andWhere('folder.status = :status', { status: 'active' });

    // Filter by folder type
    if (folderType) {
      queryBuilder.andWhere('folder.folderType = :folderType', { folderType });
    }

    // Search functionality
    if (search) {
      queryBuilder.andWhere(
        '(folder.name ILIKE :search OR folder.description ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Sorting
    queryBuilder.orderBy(`folder.${sortBy}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [folders, total] = await queryBuilder.getManyAndCount();

    return {
      folders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Update folder
   */
  static async updateFolder(folderId, userId, updateData) {
    const repo = this.getRepository();

    // Ensure user owns the folder
    const folder = await this.getFolderById(folderId, userId);
    if (!folder) {
      throw new Error('Folder not found or access denied');
    }

    await repo.update(folderId, updateData);
    return await this.getFolderById(folderId, userId);
  }

  /**
   * Delete folder (soft delete)
   */
  static async deleteFolder(folderId, userId) {
    const repo = this.getRepository();

    const folder = await this.getFolderById(folderId, userId);
    if (!folder) {
      throw new Error('Folder not found or access denied');
    }

    await repo.update(folderId, {
      status: 'deleted',
      updatedAt: new Date()
    });

    return true;
  }

  /**
   * Get folder statistics
   */
  static async getFolderStats(folderId, userId) {
    const repo = this.getRepository();
    const fileRepo = AppDataSource.getRepository('DocumentFile');

    const folder = await this.getFolderById(folderId, userId);
    if (!folder) {
      throw new Error('Folder not found or access denied');
    }

    const stats = await fileRepo.createQueryBuilder('file')
      .select([
        'COUNT(*) as total_files',
        'SUM(file.fileSize) as total_size',
        'COUNT(CASE WHEN file.status = \'ready\' THEN 1 END) as ready_files',
        'COUNT(CASE WHEN file.isEncrypted = true THEN 1 END) as encrypted_files'
      ])
      .where('file.folder_id = :folderId', { folderId })
      .getRawOne();

    return {
      folderId,
      folderName: folder.name,
      totalFiles: parseInt(stats.total_files) || 0,
      totalSize: parseInt(stats.total_size) || 0,
      readyFiles: parseInt(stats.ready_files) || 0,
      encryptedFiles: parseInt(stats.encrypted_files) || 0,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt
    };
  }

  /**
   * Get folders by type
   */
  static async getFoldersByType(userId, folderType) {
    const repo = this.getRepository();

    return await repo.find({
      where: {
        owner: { id: userId },
        folderType,
        status: 'active'
      },
      relations: ['files'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Check if user can access folder
   */
  static async canUserAccessFolder(folderId, userId) {
    const repo = this.getRepository();

    const folder = await repo.findOne({
      where: {
        id: folderId,
        status: 'active'
      },
      relations: ['owner']
    });

    if (!folder) return false;

    // Owner can always access
    if (folder.owner.id === userId) return true;

    // Check if folder is public
    if (folder.isPublic) return true;

    // Add more permission logic here if needed
    return false;
  }

  /**
   * Update folder hash
   */
  static async updateFolderHash(folderId, newHash) {
    const repo = this.getRepository();

    await repo.update(folderId, {
      folderHash: newHash,
      updatedAt: new Date()
    });
  }

  /**
   * Get recent folders
   */
  static async getRecentFolders(userId, limit = 5) {
    const repo = this.getRepository();

    return await repo.find({
      where: {
        owner: { id: userId },
        status: 'active'
      },
      relations: ['files'],
      order: { updatedAt: 'DESC' },
      take: limit
    });
  }
}

module.exports = DocumentFolderRepository;