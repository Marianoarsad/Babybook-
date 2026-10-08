const { signToken, signSocialToken, verifySocialToken } = require("../src/utils/jwt");

describe("short-lived social auth tickets", () => {
    const previousSecret = process.env.JWT_SECRET;

    beforeAll(() => { process.env.JWT_SECRET = "social-auth-test-secret"; });
    afterAll(() => { process.env.JWT_SECRET = previousSecret; });

    test("accepts its ticket and rejects a normal session token", () => {
        const ticket = signSocialToken({ provider: "google", subject: "123", email: "parent@example.com", action: "registration_required" });
        expect(verifySocialToken(ticket)).toMatchObject({ purpose: "social-auth", provider: "google", subject: "123" });
        expect(() => verifySocialToken(signToken({ sub: 1 }))).toThrow();
    });
});
