// Integration tests under tests/integration/ require a live environment (DB,
// JWT_SECRET, etc.) and are intentionally excluded from ordinary runs. The
// `test` script already passes this via --testPathIgnorePatterns; declaring it
// here means direct invocations — notably the lint-staged pre-commit hook's
// `jest --findRelatedTests` — honour the same policy.
module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
};
