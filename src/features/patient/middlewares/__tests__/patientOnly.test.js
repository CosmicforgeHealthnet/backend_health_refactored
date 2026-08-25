/* eslint-env jest */
// Unit tests for the patientOnly middleware — a small role gate, but real
// business logic (blocks anything but req.user.role === 'patient'), so it
// gets the same treatment as the auth middlewares elsewhere in this repo.

const { patientOnly } = require('../patientOnly');

function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('patientOnly', () => {
    test('allows a request from a patient through', () => {
        const req = { user: { sub: 'u1', role: 'patient' } };
        const res = makeRes();
        const next = jest.fn();

        patientOnly(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test('rejects an unauthenticated request with 401', () => {
        const req = {};
        const res = makeRes();
        const next = jest.fn();

        patientOnly(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    });

    test('rejects a non-patient role with 403 and reports both roles', () => {
        const req = { user: { sub: 'u1', role: 'doctor' } };
        const res = makeRes();
        const next = jest.fn();

        patientOnly(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Access denied. Patient role required.',
            requiredRole: 'patient',
            yourRole: 'doctor',
        });
    });
});
