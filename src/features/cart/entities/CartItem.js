const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CartItem",
    tableName: "cart_items",
    columns: {
        id:        { primary: true, type: "uuid", generated: "uuid" },
        cartId:    { type: "uuid", nullable: false },
        productId: { type: "uuid", nullable: false },

        quantity:      { type: "int",     default: 1,    nullable: false },
        // Snapshot the price at time of adding — vendor price changes don't affect existing carts
        priceSnapshot: { type: "decimal", precision: 12, scale: 2, nullable: false, comment: "Product price at time of adding to cart" },
        productTitle:  { type: "varchar", nullable: false, comment: "Product title snapshot" },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        cart: {
            type: "many-to-one",
            target: "Cart",
            joinColumn: { name: "cartId" },
            onDelete: "CASCADE",
            inverseSide: "items",
        },
        product: {
            type: "many-to-one",
            target: "Product",
            joinColumn: { name: "productId" },
        },
    },
    indices: [
        { columns: ["cartId"] },
        { columns: ["productId"] },
        { columns: ["cartId", "productId"] },
    ],
});
