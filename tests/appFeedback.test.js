jest.mock("../src/features/reviews/repositories/reviewRepository", () => ({
    createFeedback: jest.fn(async (data) => ({ id: "feedback-id", ...data })),
    findFeedbackByAuthor: jest.fn(async () => []),
}));

const repository = require("../src/features/reviews/repositories/reviewRepository");
const service = require("../src/features/reviews/services/appFeedbackService");
const controller = require("../src/features/reviews/controllers/appFeedbackController");

beforeEach(() => jest.clearAllMocks());

test.each([
    ["patient", "payment"],
    ["doctor", "verification"],
])("%s can give feedback without an appointment", async (role, area) => {
    const result = await service.submit("author-id", role, {
        experience: "could_not_finish", troubleAreas: [area], comment: "  Got stuck  ",
        authorId: "someone-else", role: "admin", appointmentId: "ignored",
    });
    expect(result).toEqual({ id: "feedback-id", authorId: "author-id", role,
        experience: "could_not_finish", troubleAreas: [area], comment: "Got stuck" });
});

test("only the experience is required", async () => {
    await expect(service.submit("author", "patient", { experience: "smooth" }))
        .resolves.toMatchObject({ troubleAreas: [], comment: null });
});

test.each([
    undefined,
    { experience: "invalid" },
    { experience: "smooth", troubleAreas: "payment" },
    { experience: "smooth", troubleAreas: ["verification"] },
    { experience: "smooth", troubleAreas: [null] },
    { experience: "smooth", comment: 10 },
    { experience: "smooth", comment: "a".repeat(2001) },
])("rejects invalid feedback: %j", async (payload) => {
    await expect(service.submit("author", "patient", payload)).rejects.toMatchObject({ status: 400 });
    expect(repository.createFeedback).not.toHaveBeenCalled();
});

test.each(["admin", "vendor", "toString", undefined])("rejects unsupported role %s", async (role) => {
    await expect(service.submit("author", role, { experience: "smooth" })).rejects.toMatchObject({ status: 403 });
    await expect(service.getMine("author", role)).rejects.toMatchObject({ status: 403 });
});

test("history is scoped to the authenticated author", async () => {
    await service.getMine("current-user", "doctor");
    expect(repository.findFeedbackByAuthor).toHaveBeenCalledWith("current-user");
});

test("controller takes identity and role from authentication, not request body", async () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.submit({ user: { id: "authenticated", role: "doctor" },
        body: { experience: "smooth", authorId: "spoofed", role: "patient" } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(repository.createFeedback).toHaveBeenCalledWith(expect.objectContaining({ authorId: "authenticated", role: "doctor" }));
});

test("controller reports validation failures and forwards storage failures", async () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    const req = { user: { id: "author", role: "patient" }, body: {} };
    await controller.submit(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    const error = new Error("Database unavailable");
    repository.createFeedback.mockRejectedValueOnce(error);
    await controller.submit({ ...req, body: { experience: "smooth" } }, res, next);
    expect(next).toHaveBeenCalledWith(error);
});
