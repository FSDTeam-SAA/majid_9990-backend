"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../src/app"));
describe('API Integration Tests', () => {
    it('GET /health should return 200', async () => {
        const response = await (0, supertest_1.default)(app_1.default)
            .get('/health')
            .expect(200);
        expect(response.body).toHaveProperty('status', 'ok');
    });
});
