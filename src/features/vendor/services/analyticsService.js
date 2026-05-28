const AppDataSource     = require("../../../config/database");
const vendorRepository  = require("../repositories/vendorRepository");

class VendorAnalyticsService {

    // ─── Overview dashboard ───────────────────────────────────────────────────

    async getOverview(userId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const db = AppDataSource;

        const [
            totalOrders,
            totalRevenue,
            pendingCarts,
            totalProducts,
            approvedProducts,
            pendingProducts,
            activePromotions,
            totalPromoSpend,
        ] = await Promise.all([
            // Confirmed carts = orders
            db.getRepository("Cart")
                .createQueryBuilder("c")
                .where("c.vendorId = :vendorId AND c.status = 'confirmed'", { vendorId: vendor.id })
                .getCount(),

            // Sum of confirmed totals
            db.getRepository("Cart")
                .createQueryBuilder("c")
                .select("COALESCE(SUM(c.confirmedTotal), 0)", "total")
                .where("c.vendorId = :vendorId AND c.status = 'confirmed'", { vendorId: vendor.id })
                .getRawOne(),

            // Pending carts (submitted but not yet confirmed)
            db.getRepository("Cart")
                .createQueryBuilder("c")
                .where("c.vendorId = :vendorId AND c.status = 'submitted'", { vendorId: vendor.id })
                .getCount(),

            // Total products
            db.getRepository("Product")
                .createQueryBuilder("p")
                .where("p.vendorId = :vendorId", { vendorId: vendor.id })
                .getCount(),

            // Approved products
            db.getRepository("Product")
                .createQueryBuilder("p")
                .where("p.vendorId = :vendorId AND p.status = 'approved'", { vendorId: vendor.id })
                .getCount(),

            // Pending products
            db.getRepository("Product")
                .createQueryBuilder("p")
                .where("p.vendorId = :vendorId AND p.status = 'pending'", { vendorId: vendor.id })
                .getCount(),

            // Active promotions
            db.getRepository("Promotion")
                .createQueryBuilder("pr")
                .where("pr.vendorId = :vendorId AND pr.status = 'active'", { vendorId: vendor.id })
                .getCount(),

            // Total promotion spend (paid promotions)
            db.getRepository("Promotion")
                .createQueryBuilder("pr")
                .select("COALESCE(SUM(pr.pricePaid), 0)", "total")
                .where("pr.vendorId = :vendorId AND pr.paymentStatus = 'paid'", { vendorId: vendor.id })
                .getRawOne(),
        ]);

        return {
            orders: {
                total:   totalOrders,
                pending: pendingCarts,
            },
            revenue: {
                total:    Number(totalRevenue.total).toFixed(2),
                currency: "NGN",
            },
            products: {
                total:    totalProducts,
                approved: approvedProducts,
                pending:  pendingProducts,
            },
            promotions: {
                active:     activePromotions,
                totalSpend: Number(totalPromoSpend.total).toFixed(2),
            },
        };
    }

    // ─── Sales performance ────────────────────────────────────────────────────

    async getSalesPerformance(userId, { period = "daily", from, to }) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const { startDate, endDate, groupFormat } = this._resolvePeriod(period, from, to);

        const rows = await AppDataSource.getRepository("Cart")
            .createQueryBuilder("c")
            .select(`TO_CHAR(c.confirmedAt, '${groupFormat}')`, "period")
            .addSelect("COUNT(*)",                              "orders")
            .addSelect("COALESCE(SUM(c.confirmedTotal), 0)",   "revenue")
            .where("c.vendorId = :vendorId", { vendorId: vendor.id })
            .andWhere("c.status = 'confirmed'")
            .andWhere("c.confirmedAt BETWEEN :startDate AND :endDate", { startDate, endDate })
            .groupBy(`TO_CHAR(c.confirmedAt, '${groupFormat}')`)
            .orderBy("period", "ASC")
            .getRawMany();

        return {
            period,
            from:  startDate,
            to:    endDate,
            data:  rows.map((r) => ({
                period:  r.period,
                orders:  Number(r.orders),
                revenue: Number(r.revenue).toFixed(2),
            })),
        };
    }

    // ─── Product performance ──────────────────────────────────────────────────

    async getProductPerformance(userId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const db = AppDataSource;

        const [topProducts, lowStock, statusBreakdown] = await Promise.all([
            // Most ordered products (appear most in confirmed cart items)
            db.getRepository("CartItem")
                .createQueryBuilder("ci")
                .innerJoin("ci.cart",    "cart")
                .innerJoin("ci.product", "product")
                .select("product.id",      "productId")
                .addSelect("product.title", "title")
                .addSelect("COUNT(*)",      "orderCount")
                .addSelect("SUM(ci.quantity)", "totalUnitsSold")
                .addSelect("SUM(ci.priceSnapshot * ci.quantity)", "revenue")
                .where("cart.vendorId = :vendorId AND cart.status = 'confirmed'", { vendorId: vendor.id })
                .groupBy("product.id, product.title")
                .orderBy("orderCount", "DESC")
                .limit(10)
                .getRawMany(),

            // Low stock products (approved, stock < 10)
            db.getRepository("Product")
                .createQueryBuilder("p")
                .select(["p.id", "p.title", "p.stockQuantity", "p.category"])
                .where("p.vendorId = :vendorId AND p.status = 'approved' AND p.stockQuantity < 10", { vendorId: vendor.id })
                .orderBy("p.stockQuantity", "ASC")
                .getMany(),

            // Product count by status
            db.getRepository("Product")
                .createQueryBuilder("p")
                .select("p.status", "status")
                .addSelect("COUNT(*)", "count")
                .where("p.vendorId = :vendorId", { vendorId: vendor.id })
                .groupBy("p.status")
                .getRawMany(),
        ]);

        return {
            topProducts: topProducts.map((r) => ({
                productId:      r.productId,
                title:          r.title,
                orderCount:     Number(r.orderCount),
                totalUnitsSold: Number(r.totalUnitsSold),
                revenue:        Number(r.revenue).toFixed(2),
            })),
            lowStock: lowStock.map((p) => ({
                id:            p.id,
                title:         p.title,
                stockQuantity: p.stockQuantity,
                category:      p.category,
            })),
            statusBreakdown: statusBreakdown.reduce((acc, r) => {
                acc[r.status] = Number(r.count);
                return acc;
            }, {}),
        };
    }

    // ─── Promotion performance ────────────────────────────────────────────────

    async getPromotionPerformance(userId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const [byType, byStatus, recent] = await Promise.all([
            AppDataSource.getRepository("Promotion")
                .createQueryBuilder("p")
                .select("p.type", "type")
                .addSelect("COUNT(*)",          "count")
                .addSelect("SUM(p.pricePaid)",  "totalSpend")
                .where("p.vendorId = :vendorId AND p.paymentStatus = 'paid'", { vendorId: vendor.id })
                .groupBy("p.type")
                .getRawMany(),

            AppDataSource.getRepository("Promotion")
                .createQueryBuilder("p")
                .select("p.status", "status")
                .addSelect("COUNT(*)", "count")
                .where("p.vendorId = :vendorId", { vendorId: vendor.id })
                .groupBy("p.status")
                .getRawMany(),

            AppDataSource.getRepository("Promotion")
                .createQueryBuilder("p")
                .where("p.vendorId = :vendorId AND p.paymentStatus = 'paid'", { vendorId: vendor.id })
                .orderBy("p.createdAt", "DESC")
                .limit(5)
                .getMany(),
        ]);

        return {
            byType: byType.map((r) => ({
                type:       r.type,
                count:      Number(r.count),
                totalSpend: Number(r.totalSpend).toFixed(2),
            })),
            byStatus: byStatus.reduce((acc, r) => {
                acc[r.status] = Number(r.count);
                return acc;
            }, {}),
            recentPromotions: recent.map((p) => ({
                id:        p.id,
                title:     p.title,
                type:      p.type,
                status:    p.status,
                pricePaid: p.pricePaid,
                startDate: p.startDate,
                endDate:   p.endDate,
            })),
        };
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    _resolvePeriod(period, from, to) {
        const endDate   = to   ? new Date(to)   : new Date();
        let   startDate = from ? new Date(from)  : new Date();

        if (!from) {
            if (period === "daily")   startDate.setDate(startDate.getDate() - 7);
            if (period === "weekly")  startDate.setDate(startDate.getDate() - 28);
            if (period === "monthly") startDate.setMonth(startDate.getMonth() - 12);
        }

        const groupFormat =
            period === "daily"   ? "YYYY-MM-DD" :
            period === "weekly"  ? "IYYY-IW"    :
            "YYYY-MM";

        return { startDate, endDate, groupFormat };
    }
}

module.exports = new VendorAnalyticsService();
