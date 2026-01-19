// src/repositories/verificationDocumentRepository.js
const AppDataSource = require("../../../config/database");
const { DocumentType, DocumentStatus } = require("../entities/VerificationDocument");
const { IsNull } = require("typeorm");

class VerificationDocumentRepository {
    constructor() {
        this.repository = AppDataSource.getRepository("VerificationDocument");
    }

    // Create new document
    async create(documentData) {
        const document = this.repository.create(documentData);
        return await this.repository.save(document);
    }

    // Find by ID
    async findById(id, relations = []) {
        return await this.repository.findOne({
            where: { id },
            relations
        });
    }

    // Find by verification request ID
    async findByVerificationRequestId(verificationRequestId) {
        return await this.repository.find({
            where: { verificationRequestId },
            order: { uploadedAt: "DESC" }
        });
    }

    // Find by verification request and document type
    async findByVerificationAndType(verificationRequestId, documentType) {
        return await this.repository.findOne({
            where: {
                verificationRequestId,
                documentType
            }
        });
    }

    // Find by file hash (duplicate detection)
    async findByFileHash(fileHash) {
        return await this.repository.findOne({
            where: { fileHash }
        });
    }

    // Get documents by status
    async findByStatus(status, limit = 50) {
        return await this.repository.find({
            where: { status },
            relations: ["verificationRequest", "uploadedByUser"],
            order: { uploadedAt: "ASC" },
            take: limit
        });
    }

    // Update document
    async update(id, updateData) {
        await this.repository.update(id, updateData);
        return await this.findById(id);
    }

    // Update document status
    async updateStatus(id, newStatus, verifiedBy = null, rejectionReason = null) {
        const updateData = {
            status: newStatus,
            updatedAt: new Date()
        };

        if (newStatus === DocumentStatus.VERIFIED) {
            updateData.verifiedAt = new Date();
            updateData.verifiedBy = verifiedBy;
        } else if (newStatus === DocumentStatus.REJECTED && rejectionReason) {
            updateData.rejectionReason = rejectionReason;
        }

        return await this.update(id, updateData);
    }

    // Update OCR results
    async updateOcrResults(id, ocrText, extractedData, confidence) {
        return await this.update(id, {
            ocrText,
            extractedData,
            ocrConfidence: confidence,
            status: DocumentStatus.PROCESSING
        });
    }

    // Update AI analysis results
    async updateAiAnalysis(id, aiAnalysisResult) {
        return await this.update(id, {
            aiAnalysisResult
        });
    }

    // Track document access
    async trackAccess(id, accessedBy = null) {
        const document = await this.findById(id);
        if (document) {
            return await this.update(id, {
                lastAccessedAt: new Date(),
                accessCount: (document.accessCount || 0) + 1
            });
        }
        return null;
    }

    // Get document statistics
    async getStatistics(startDate = null, endDate = null) {
        const queryBuilder = this.repository.createQueryBuilder("doc");

        if (startDate) {
            queryBuilder.andWhere("doc.uploadedAt >= :startDate", { startDate });
        }
        if (endDate) {
            queryBuilder.andWhere("doc.uploadedAt <= :endDate", { endDate });
        }

        return await queryBuilder
            .select([
                "doc.documentType",
                "doc.status",
                "COUNT(*) as count",
                "AVG(doc.fileSize) as avgSize",
                "AVG(doc.ocrConfidence) as avgOcrConfidence"
            ])
            .groupBy("doc.documentType, doc.status")
            .getRawMany();
    }

    // Get documents needing OCR processing
    async findPendingOcr(limit = 20) {
        return await this.repository.find({
            where: {
                status: DocumentStatus.UPLOADED,
                ocrText: IsNull()
            },
            order: { uploadedAt: "ASC" },
            take: limit
        });
    }

    // Delete document
    async delete(id) {
        return await this.repository.delete(id);
    }

    // Save document
    async save(document) {
        return await this.repository.save(document);
    }
}

module.exports = new VerificationDocumentRepository();
